/* eslint-disable @typescript-eslint/no-non-null-assertion -- lookups follow explicit guards and content invariants */
import {
  commandAcceptedSchema,
  careerWorldReadModelSchema,
  commandSchema,
  homeReadModelSchema,
  matchInstructionSchema,
  nextMatchReadModelSchema,
  postMatchReadModelSchema,
  squadReadModelSchema,
  standingsReadModelSchema,
  type Command,
  type CareerWorldReadModel,
  type CommandAccepted,
  type HomeReadModel,
  type JobStatus,
  type NextMatchReadModel,
  type PostMatchReadModel,
  type SquadReadModel,
  type StandingsReadModel,
} from '@footebas/contracts';
import {
  SaveConflictError,
  SaveNotFoundError,
  SaveOwnershipError,
  verifyChecksum,
  type GameSave,
  type TransactionContext,
  type UnitOfWork,
} from '@footebas/database';
import {
  FORMATION_POSITIONS,
  DomainError,
  clubCashBalance,
  createLineup,
  createMatchInput,
  createTactic,
  entityId,
  validateLineupForMatch,
  type CanonicalValue,
  type Club,
  type CompetitionCalendarFixture,
  type CompetitionId,
  type CompetitionMatchResult,
  type Lineup,
  type MatchResult,
  type MatchInstruction,
  type MatchInput,
  type Player,
  type Tactic,
} from '@footebas/domain';
import {
  CAREER_SEASON_VERSION,
  ENGINE_VERSION,
  autoSelectLineup,
  careerSeasonSystem,
  closeCareerSeason,
  createCareerSeason,
  createMatchPresentation,
  fixturesOn,
  isSeasonComplete,
  liveStandings,
  nextMatchDate,
  pendingFixtures,
  recordSeasonResults,
  simulateMatch,
  type CareerSeasonState,
  type MvpCompetitionConfig,
  type MvpDivisionId,
} from '@footebas/engine';
import {
  projectCalendar,
  projectPyramid,
  projectTransition,
  type SeasonSummary,
} from './career-competitions.js';
import {
  closeSeasonWorld,
  createCareerWorld,
  employManager,
  recordGate,
  settleMonths,
  type CareerWorldState,
  type WorldContext,
} from './career-world-rules.js';
import {
  catalogCareerContent,
  type CareerContent,
  type CareerContentPort,
} from './career-content.js';
import { defaultTactic } from './tactics.js';
import {
  AuthenticationError,
  type AuthPort,
  type Clock,
  type IdGenerator,
  type JobQueuePort,
  type SimulationJob,
  type StoragePort,
  type TelemetryPort,
} from './ports.js';

export const CAREER_SAVE_SCHEMA = 'game-save-v2' as const;
const RULES_VERSION = CAREER_SEASON_VERSION;
/** Full match detail kept for the managed club; older scores live in the season. */
const KEPT_MANAGED_MATCHES = 10;
const asCanonical = (value: unknown): CanonicalValue => value as CanonicalValue;

export interface ManagedMatch {
  fixture: CompetitionCalendarFixture;
  result: MatchResult;
}
/** The single career aggregate: world, competitions and matchday in one save. */
export interface CareerSnapshot {
  managerName: string;
  currentDate: string;
  season: number;
  contentVersion: string;
  selectedClubId?: string;
  clubs: Club[];
  players: Player[];
  competition: CareerSeasonState;
  lineup?: Lineup;
  tactic?: Tactic;
  matches: ManagedMatch[];
  history: SeasonSummary[];
  world: CareerWorldState;
  pendingJobId?: string;
}

type Snapshot = CareerSnapshot;

/** Runs world rules over the snapshot and writes the results back. */
function withWorld(snapshot: Snapshot, work: (context: WorldContext) => void) {
  const context: WorldContext = {
    clubs: snapshot.clubs,
    players: snapshot.players,
    world: snapshot.world,
  };
  work(context);
  snapshot.clubs = context.clubs;
  snapshot.players = context.players;
  snapshot.world = context.world;
}

export interface ApplicationDependencies {
  readonly auth: AuthPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly jobs: JobQueuePort;
  readonly storage: StoragePort;
  readonly telemetry: TelemetryPort;
  readonly unitOfWork: UnitOfWork;
  readonly content?: CareerContentPort;
  readonly failPoint?: (
    point: 'before-persist-result',
    job: SimulationJob,
  ) => void;
}

export class ApplicationError extends Error {
  public constructor(
    public readonly code:
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'VERSION_CONFLICT'
      | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message);
  }
}

async function careerIdFor(userId: string, key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${userId}:${key}`),
  );
  return `career_${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 20)}`;
}

export class FootebasApplication {
  private readonly content: CareerContentPort;

  public constructor(private readonly deps: ApplicationDependencies) {
    this.content = deps.content ?? catalogCareerContent;
  }

  public async execute(
    bearer: string,
    input: unknown,
  ): Promise<CommandAccepted> {
    const identity = await this.identity(bearer);
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success)
      throw new ApplicationError('VALIDATION_ERROR', parsed.error.message);
    const command = parsed.data;
    try {
      return command.type === 'CreateCareer'
        ? await this.createCareer(identity.userId, command)
        : await this.mutate(identity.userId, command);
    } catch (error) {
      throw this.translate(error);
    }
  }

  private async identity(bearer: string) {
    try {
      return await this.deps.auth.authenticate(bearer);
    } catch (error) {
      if (error instanceof AuthenticationError)
        throw new ApplicationError('UNAUTHORIZED', error.message);
      throw error;
    }
  }

  private loadContent(version?: string): CareerContent {
    const content = this.content.load();
    if (version !== undefined && content.version !== version)
      throw new ApplicationError(
        'VERSION_CONFLICT',
        `save uses content ${version}; ${content.version} requires migration`,
      );
    return content;
  }

  private async createCareer(
    userId: string,
    command: Extract<Command, { type: 'CreateCareer' }>,
  ): Promise<CommandAccepted> {
    if (command.expectedVersion !== 0)
      throw new ApplicationError(
        'VERSION_CONFLICT',
        'new careers require expectedVersion 0',
      );
    const careerId = await careerIdFor(userId, command.idempotencyKey);
    const response = await this.deps.unitOfWork.executeIdempotent(
      careerId,
      command.idempotencyKey,
      async (tx) => {
        const content = this.loadContent();
        const seed = `career-seed:${careerId}`;
        const year = Number(command.payload.startDate.slice(0, 4));
        const snapshot: Snapshot = {
          managerName: command.payload.managerName,
          currentDate: command.payload.startDate,
          season: 1,
          contentVersion: content.version,
          clubs: [...content.clubs],
          players: [...content.players],
          competition: createCareerSeason(content.competitions, {
            season: 1,
            year,
            seed,
            divisions: content.divisions,
            continentalDirect: content.continentalDirect,
            continentalPreliminary: content.continentalPreliminary,
          }),
          matches: [],
          history: [],
          world: createCareerWorld(
            content.clubs,
            content.players,
            command.payload.startDate,
            `manager_${careerId.slice('career_'.length)}`,
          ),
        };
        const save = await tx.saves.create({
          id: careerId,
          userId,
          snapshot: asCanonical(snapshot),
          seed,
          versions: {
            schema: CAREER_SAVE_SCHEMA,
            engine: ENGINE_VERSION,
            rules: RULES_VERSION,
            content: content.version,
          },
        });
        this.deps.telemetry.event('career.created', { careerId });
        return asCanonical(this.accepted(command, save));
      },
    );
    return commandAcceptedSchema.parse(response);
  }

  private async mutate(
    userId: string,
    command: Exclude<Command, { type: 'CreateCareer' }>,
  ): Promise<CommandAccepted> {
    const careerId = command.payload.careerId;
    let jobToEnqueue: SimulationJob | undefined;
    const response = await this.deps.unitOfWork.executeIdempotent(
      careerId,
      command.idempotencyKey,
      async (tx) => {
        const save = await this.load(tx, careerId, userId);
        if (save.version !== command.expectedVersion)
          throw new SaveConflictError(
            `expected version ${String(command.expectedVersion)}, found ${String(save.version)}`,
          );
        const snapshot = structuredClone(save.snapshot) as unknown as Snapshot;
        let job: SimulationJob | undefined;
        switch (command.type) {
          case 'SelectClub': {
            const club = snapshot.clubs.find(
              ({ id }) => id === command.payload.clubId,
            );
            if (!club)
              throw new ApplicationError('NOT_FOUND', 'club not found');
            const manager = snapshot.world.manager;
            if (
              manager.employmentStatus === 'employed' &&
              manager.currentClubId !== club.id
            )
              throw new ApplicationError(
                'FORBIDDEN',
                'career already manages a club; accept a job proposal to move',
              );
            const division = divisionOf(snapshot, club.id);
            const rank =
              [...snapshot.competition.divisions[division]]
                .map((id) => snapshot.clubs.find((item) => item.id === id)!)
                .sort(
                  (left, right) =>
                    Number(right.reputation) - Number(left.reputation),
                )
                .findIndex(({ id }) => id === club.id) + 1;
            if (manager.employmentStatus !== 'employed')
              withWorld(snapshot, (context) =>
                employManager(
                  context,
                  club.id,
                  snapshot.currentDate,
                  division,
                  rank,
                ),
              );
            snapshot.selectedClubId = club.id;
            snapshot.lineup = autoSelectLineup({
              club,
              players: snapshot.players,
              formation: '4-4-2',
              mode: 'best',
            });
            snapshot.tactic = defaultTactic();
            break;
          }
          case 'SetLineup': {
            const club = this.managedClub(snapshot, command.payload.clubId);
            const memberIds = new Set(club.squad);
            if (
              [
                ...command.payload.starters.map(({ playerId }) => playerId),
                ...command.payload.substitutes,
                ...(command.payload.reserves ?? []),
              ].some((id) => !memberIds.has(entityId(id, 'player')))
            )
              throw new ApplicationError(
                'VALIDATION_ERROR',
                'lineup contains a player outside the selected club',
              );
            const lineup = createLineup({
              clubId: entityId(command.payload.clubId, 'club'),
              starters: command.payload.starters.map((slot) => ({
                playerId: entityId(slot.playerId, 'player'),
                position: slot.position,
              })),
              substitutes: command.payload.substitutes.map((id) =>
                entityId(id, 'player'),
              ),
              ...(command.payload.reserves
                ? {
                    reserves: command.payload.reserves.map((id) =>
                      entityId(id, 'player'),
                    ),
                  }
                : {}),
              captainId: entityId(command.payload.captainId, 'player'),
            });
            snapshot.lineup = validateLineupForMatch(
              lineup,
              club,
              snapshot.players,
              (snapshot.tactic ?? defaultTactic()).formation,
            );
            break;
          }
          case 'AutoPickLineup': {
            const club = this.managedClub(snapshot, command.payload.clubId);
            snapshot.lineup = autoSelectLineup({
              club,
              players: snapshot.players,
              formation: command.payload.formation,
              mode: command.payload.mode,
            });
            snapshot.tactic = createTactic({
              ...(snapshot.tactic ?? defaultTactic()),
              formation: command.payload.formation,
            });
            break;
          }
          case 'SetTactics':
            if (
              snapshot.lineup &&
              snapshot.tactic?.formation !== command.payload.formation
            )
              snapshot.lineup = reformLineup(
                snapshot.lineup,
                snapshot.players,
                command.payload.formation,
              );
            snapshot.tactic = createTactic({
              formation: command.payload.formation,
              mentality: command.payload.mentality,
              attackDirection: command.payload.attackDirection,
              marking: command.payload.marking,
              ...(command.payload.buildUp
                ? { buildUp: command.payload.buildUp }
                : {}),
              ...(command.payload.focus
                ? { focus: command.payload.focus }
                : {}),
              ...(command.payload.press
                ? { press: command.payload.press }
                : {}),
              ...(command.payload.defensiveLine
                ? { defensiveLine: command.payload.defensiveLine }
                : {}),
              ...(command.payload.markingStyle
                ? { markingStyle: command.payload.markingStyle }
                : {}),
            });
            break;
          case 'AdvanceDate':
          case 'SimulateMatch': {
            this.requireMatchday(snapshot);
            if (snapshot.pendingJobId)
              throw new ApplicationError(
                'VERSION_CONFLICT',
                'a simulation is already pending',
              );
            const fixture = managedFixture(snapshot);
            if (command.type === 'SimulateMatch') {
              if (fixture?.id !== command.payload.fixtureId)
                throw new ApplicationError(
                  'NOT_FOUND',
                  'next managed fixture not found',
                );
              const instructions = command.payload.instructions ?? [];
              this.assertManagedInstructions(snapshot, fixture, instructions);
            } else if (
              fixture &&
              command.payload.throughDate &&
              command.payload.throughDate < fixture.date
            )
              throw new ApplicationError(
                'VALIDATION_ERROR',
                'throughDate does not reach the next fixture',
              );
            if (fixture)
              validateLineupForMatch(
                snapshot.lineup!,
                this.managedClub(snapshot, snapshot.selectedClubId!),
                snapshot.players,
                snapshot.tactic!.formation,
              );
            const jobId = this.deps.ids.next('job');
            snapshot.pendingJobId = jobId;
            job = {
              id: jobId,
              commandId: command.commandId,
              careerId,
              userId,
              expectedVersion: save.version + 1,
              ...(fixture ? { fixtureId: fixture.id } : {}),
              ...(command.type === 'SimulateMatch' &&
              command.payload.instructions
                ? {
                    instructions: command.payload
                      .instructions as readonly MatchInstruction[],
                  }
                : {}),
            };
            break;
          }
        }
        const updated = await tx.saves.update(careerId, userId, save.version, {
          snapshot: asCanonical(snapshot),
          seed: save.seed,
          versions: save.versions,
        });
        jobToEnqueue = job;
        return asCanonical(this.accepted(command, updated, job?.id));
      },
    );
    if (jobToEnqueue) {
      await this.setJobStatus(jobToEnqueue, 'queued', 1);
      await this.deps.jobs.enqueue(jobToEnqueue);
    }
    return commandAcceptedSchema.parse(response);
  }

  public async runNextJob(): Promise<JobStatus | undefined> {
    const job = await this.deps.jobs.take();
    if (!job) return undefined;
    const prior = await this.deps.jobs.status(job.id);
    if (prior?.state === 'succeeded') return prior;
    const attempt =
      prior?.state === 'failed' ? prior.attempt + 1 : (prior?.attempt ?? 1);
    await this.setJobStatus(job, 'running', attempt);
    try {
      await this.deps.unitOfWork.withCareerLock(job.careerId, async (tx) => {
        const save = await this.load(tx, job.careerId, job.userId);
        const snapshot = structuredClone(save.snapshot) as unknown as Snapshot;
        if (snapshot.pendingJobId !== job.id) {
          if (save.version > job.expectedVersion) return;
          throw new SaveConflictError('job snapshot version is stale');
        }
        if (save.version !== job.expectedVersion)
          throw new SaveConflictError('job snapshot version is stale');
        const content = this.loadContent(snapshot.contentVersion);
        this.playThrough(
          snapshot,
          save.seed,
          content.competitions,
          job.fixtureId,
          job.instructions,
        );
        if (job.fixtureId === undefined)
          rollSeason(snapshot, content.competitions, save.seed);
        delete snapshot.pendingJobId;
        this.deps.failPoint?.('before-persist-result', job);
        await tx.saves.update(job.careerId, job.userId, save.version, {
          snapshot: asCanonical(snapshot),
          seed: save.seed,
          versions: save.versions,
        });
      });
      return await this.setJobStatus(
        job,
        'succeeded',
        (await this.deps.jobs.status(job.id))?.attempt ?? 1,
      );
    } catch (error) {
      this.deps.telemetry.error(error, { jobId: job.id });
      await this.deps.jobs.enqueue(job);
      return await this.setJobStatus(
        job,
        'failed',
        (await this.deps.jobs.status(job.id))?.attempt ?? 1,
        'SIMULATION_FAILED',
      );
    }
  }

  /**
   * Plays every pending fixture in date order up to the managed fixture (or
   * to the end of the season). The same deterministic path backs both the
   * committed job and the non-committing preview, so a preview is exact.
   */
  private playThrough(
    snapshot: Snapshot,
    seed: string,
    config: MvpCompetitionConfig,
    targetId?: string,
    instructions: readonly MatchInstruction[] = [],
  ): ManagedMatch | undefined {
    const target =
      targetId === undefined
        ? undefined
        : snapshot.competition.fixtures.find(({ id }) => id === targetId);
    if (targetId !== undefined && !target)
      throw new ApplicationError('NOT_FOUND', 'fixture not found');
    let managed: ManagedMatch | undefined;
    const tiers = new Map(
      careerSeasonSystem(config, snapshot.competition).definitions.map(
        (definition) => [definition.id, definition.tier],
      ),
    );
    for (
      let date = nextMatchDate(snapshot.competition);
      date !== undefined && (target === undefined || date <= target.date);
      date = nextMatchDate(snapshot.competition)
    ) {
      withWorld(snapshot, (context) => settleMonths(context, date));
      const today = fixturesOn(snapshot.competition, date);
      const scores: CompetitionMatchResult[] = [];
      const playing = new Set<string>();
      for (const fixture of today) {
        const isTarget = fixture.id === target?.id;
        const result = simulateMatch(
          this.matchInput(
            snapshot,
            fixture,
            seed,
            isTarget ? instructions : [],
          ),
        );
        applyPerformances(snapshot, fixture, result);
        withWorld(snapshot, (context) =>
          recordGate(context, fixture, tiers.get(fixture.competitionId)!),
        );
        playing.add(fixture.homeClubId).add(fixture.awayClubId);
        scores.push({
          fixtureId: fixture.id,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
        });
        if (isTarget) managed = { fixture, result };
      }
      recoverIdlePlayers(snapshot, playing);
      snapshot.competition = recordSeasonResults(
        config,
        snapshot.competition,
        scores,
      );
      snapshot.currentDate = date;
    }
    if (managed) {
      snapshot.matches = [...snapshot.matches, managed].slice(
        -KEPT_MANAGED_MATCHES,
      );
    }
    return managed;
  }

  private matchInput(
    snapshot: Snapshot,
    fixture: CompetitionCalendarFixture,
    seed: string,
    instructions: readonly MatchInstruction[],
  ): MatchInput {
    const side = (clubId: string) => {
      const club = snapshot.clubs.find(({ id }) => id === clubId)!;
      const managed = clubId === snapshot.selectedClubId;
      return {
        club,
        lineup: managed
          ? snapshot.lineup!
          : autoSelectLineup({
              club,
              players: snapshot.players,
              formation: '4-4-2',
              mode: 'best',
            }),
        tactic: managed ? snapshot.tactic! : defaultTactic(),
        players: snapshot.players.filter((player) => player.clubId === club.id),
      };
    };
    return createMatchInput({
      fixtureId: entityId(fixture.id, 'fixture'),
      seed: `${seed}:${fixture.id}`,
      engineVersion: ENGINE_VERSION,
      rulesVersion: RULES_VERSION,
      home: side(fixture.homeClubId),
      away: side(fixture.awayClubId),
      instructions,
    });
  }

  private requireMatchday(snapshot: Snapshot): void {
    if (!snapshot.selectedClubId || !snapshot.lineup || !snapshot.tactic)
      throw new ApplicationError(
        'VALIDATION_ERROR',
        'select a club and confirm lineup/tactics first',
      );
  }

  private managedClub(snapshot: Snapshot, clubId: string): Club {
    if (snapshot.selectedClubId !== clubId)
      throw new ApplicationError(
        'FORBIDDEN',
        'lineup club is not managed by this career',
      );
    return snapshot.clubs.find(({ id }) => id === clubId)!;
  }

  private assertManagedInstructions(
    snapshot: Snapshot,
    fixture: CompetitionCalendarFixture,
    instructions: readonly { side: 'home' | 'away' }[],
  ): void {
    const managedSide =
      fixture.homeClubId === snapshot.selectedClubId ? 'home' : 'away';
    if (instructions.some(({ side }) => side !== managedSide))
      throw new ApplicationError(
        'FORBIDDEN',
        'match instructions can only target the managed club',
      );
  }

  /**
   * Simulates the next managed match with tentative instructions without
   * committing anything. Feeds the narrated feed and tactical pauses.
   */
  public async previewMatch(
    bearer: string,
    careerId: string,
    rawInstructions: unknown,
  ): Promise<PostMatchReadModel> {
    const parsed = matchInstructionSchema
      .array()
      .max(12)
      .safeParse(rawInstructions ?? []);
    if (!parsed.success)
      throw new ApplicationError('VALIDATION_ERROR', parsed.error.message);
    return this.query(bearer, careerId, (save, stored, now) => {
      const snapshot = structuredClone(stored);
      this.requireMatchday(snapshot);
      const fixture = managedFixture(snapshot);
      if (!fixture)
        throw new ApplicationError(
          'NOT_FOUND',
          'next managed fixture not found',
        );
      this.assertManagedInstructions(snapshot, fixture, parsed.data);
      const content = this.loadContent(snapshot.contentVersion);
      const played = this.playThrough(
        snapshot,
        save.seed,
        content.competitions,
        fixture.id,
        parsed.data as readonly MatchInstruction[],
      )!;
      return postMatchModel(save, snapshot, played, now, false);
    });
  }

  public async home(bearer: string, careerId: string): Promise<HomeReadModel> {
    return this.query(bearer, careerId, (save, s, now) => {
      const club = s.clubs.find(({ id }) => id === s.selectedClubId);
      const next = managedFixture(s);
      return homeReadModelSchema.parse({
        ...base(save, now),
        managerName: s.managerName,
        club: clubSummary(s, s.selectedClubId),
        currentDate: s.currentDate,
        season: s.season,
        ...(club ? { balance: club.balance } : {}),
        nextFixtureId: next?.id,
        pendingActions: s.pendingJobId
          ? ['simulation_pending']
          : next
            ? ['prepare_match']
            : s.selectedClubId
              ? ['finish_season']
              : ['select_club'],
      });
    });
  }
  public async squad(
    bearer: string,
    careerId: string,
  ): Promise<SquadReadModel> {
    return this.query(bearer, careerId, (save, s, now) => {
      const club = s.clubs.find(({ id }) => id === s.selectedClubId);
      if (!club) throw new ApplicationError('NOT_FOUND', 'club not selected');
      return squadReadModelSchema.parse({
        ...base(save, now),
        club: clubSummary(s, club.id),
        players: s.players
          .filter(({ clubId }) => clubId === club.id)
          .map((p) => ({
            id: p.id,
            name: p.name,
            age: p.age,
            position: p.position,
            secondaryPositions: p.secondaryPositions,
            ...(p.preferredSide ? { preferredSide: p.preferredSide } : {}),
            strength: p.strength,
            traits: p.traits,
            condition: p.condition,
            morale: p.morale,
            matchSharpness: p.matchSharpness,
            squadStatus: p.squadStatus,
            injuryRounds: p.injuryRounds,
            suspensionRounds: p.suspensionRounds,
            availability:
              p.injuryRounds > 0
                ? 'injured'
                : p.suspensionRounds > 0
                  ? 'suspended'
                  : 'available',
            ...(p.lastMatchRating === undefined
              ? {}
              : { lastMatchRating: p.lastMatchRating }),
            careerStats: {
              appearances: p.careerStats.appearances,
              goals: p.careerStats.goals,
              assists: p.careerStats.assists,
              yellowCards: p.careerStats.yellowCards,
              redCards: p.careerStats.redCards,
              ...(p.careerStats.ratedAppearances
                ? {
                    averageRating: Number(
                      (
                        (p.careerStats.ratingTotal ?? 0) /
                        p.careerStats.ratedAppearances
                      ).toFixed(2),
                    ),
                  }
                : {}),
            },
            hiddenEstimates: hiddenEstimates(p),
          })),
        lineupPlayerIds: s.lineup
          ? [
              ...s.lineup.starters.map(({ playerId }) => playerId),
              ...s.lineup.substitutes,
              ...(s.lineup.reserves ?? []),
            ]
          : [],
        lineup:
          s.lineup && s.tactic
            ? {
                formation: s.tactic.formation,
                starters: s.lineup.starters.map(({ playerId }) => playerId),
                bench: s.lineup.substitutes,
                reserves: s.lineup.reserves ?? [],
              }
            : undefined,
      });
    });
  }
  public async nextMatch(
    bearer: string,
    careerId: string,
  ): Promise<NextMatchReadModel> {
    return this.query(bearer, careerId, (save, s, now) => {
      const f = managedFixture(s);
      if (!f) throw new ApplicationError('NOT_FOUND', 'next fixture not found');
      const content = this.loadContent(s.contentVersion);
      return nextMatchReadModelSchema.parse({
        ...base(save, now),
        fixtureId: f.id,
        competition: competitionName(content.competitions, s, f.competitionId),
        round: f.round,
        date: f.date,
        homeClub: clubSummary(s, f.homeClubId),
        awayClub: clubSummary(s, f.awayClubId),
        status: s.pendingJobId
          ? 'running'
          : s.lineup && s.tactic
            ? 'ready'
            : 'scheduled',
        preparation: matchPreparation(s, f),
      });
    });
  }
  public async standings(
    bearer: string,
    careerId: string,
  ): Promise<StandingsReadModel> {
    return this.query(bearer, careerId, (save, s, now) => {
      const content = this.loadContent(s.contentVersion);
      const division = (
        Object.keys(s.competition.divisions) as MvpDivisionId[]
      ).find((key) =>
        s.competition.divisions[key].some(
          (clubId) => clubId === s.selectedClubId,
        ),
      );
      if (division === undefined)
        throw new ApplicationError('NOT_FOUND', 'club not selected');
      const competitionId = careerSeasonSystem(
        content.competitions,
        s.competition,
      ).ids.divisions[division];
      return standingsReadModelSchema.parse({
        ...base(save, now),
        competitionId,
        competition: competitionName(content.competitions, s, competitionId),
        rows: liveStandings(
          content.competitions,
          s.competition,
          competitionId,
        ).map((row, index) => ({
          position: index + 1,
          club: clubSummary(s, row.clubId),
          played: row.played,
          won: row.wins,
          drawn: row.draws,
          lost: row.losses,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          points: row.points,
        })),
      });
    });
  }
  public async postMatch(
    bearer: string,
    careerId: string,
  ): Promise<PostMatchReadModel> {
    return this.query(bearer, careerId, (save, s, now) => {
      const played = s.matches.at(-1);
      if (!played) throw new ApplicationError('NOT_FOUND', 'no match result');
      return postMatchModel(save, s, played, now, true);
    });
  }
  public async careerWorld(
    bearer: string,
    careerId: string,
  ): Promise<CareerWorldReadModel> {
    return this.query(bearer, careerId, (save, s, now) => {
      const content = this.loadContent(s.contentVersion);
      const { world } = s;
      const names = new Map(s.clubs.map(({ id, name }) => [id, name]));
      const playerNames = new Map(s.players.map(({ id, name }) => [id, name]));
      const competitions = new Map(
        careerSeasonSystem(content.competitions, s.competition).definitions.map(
          ({ id, name }) => [id, name],
        ),
      );
      const clubId = world.manager.currentClubId;
      const club = s.clubs.find(({ id }) => id === clubId);
      const stadium = world.stadiums.find((item) => item.clubId === clubId);
      const cashAccount = `club:${clubId ?? ''}:cash`;
      const ledger = world.ledger.entries
        .flatMap((entry) => {
          const posting = entry.postings.find(
            ({ account }) => account === cashAccount,
          );
          if (!posting) return [];
          const source = entry.source;
          const label =
            source.type === 'wages'
              ? `Folha salarial · ${source.period}`
              : source.type === 'gate'
                ? `Bilheteria · ${source.matchId.replace('month_', '')}`
                : source.type === 'sponsor'
                  ? `Patrocínio · ${source.period}`
                  : source.type === 'prize'
                    ? `Premiação · ${competitions.get(source.competitionId as CompetitionId) ?? source.competitionId}`
                    : source.type === 'transfer'
                      ? `Transferência · ${playerNames.get(source.playerId as Player['id']) ?? source.playerId}`
                      : 'Estádio';
          return [
            {
              id: entry.id,
              occurredAt: entry.occurredAt,
              kind: source.type,
              amount: Number(posting.amount),
              label,
            },
          ];
        })
        .reverse()
        .slice(0, 200);
      return careerWorldReadModelSchema.parse({
        ...base(save, now),
        season: s.season,
        currentDate: s.currentDate,
        manager: {
          managerId: world.manager.managerId,
          employmentStatus: world.manager.employmentStatus,
          ...(clubId === undefined ? {} : { clubId }),
          boardConfidence: world.manager.boardConfidence,
          fanConfidence: world.manager.fanConfidence,
          prestige: world.manager.prestige,
          seasons: world.manager.seasons,
        },
        ...(club && stadium
          ? {
              club: {
                id: club.id,
                name: club.name,
                cash: Number(
                  clubCashBalance(world.ledger, club.id, club.balance),
                ),
                openingBalance: Number(club.balance),
                monthlyWageBill: world.contracts
                  .filter(
                    (contract) =>
                      contract.clubId === club.id &&
                      (contract.status === 'active' ||
                        contract.status === 'expiring'),
                  )
                  .reduce((sum, { wage }) => sum + Number(wage), 0),
                stadium: {
                  capacity: stadium.capacity,
                  ticketPrice: Number(stadium.ticketPrice),
                  maintenance: Number(stadium.maintenance),
                  quality: stadium.quality,
                  ...(stadium.expansion
                    ? {
                        expansion: {
                          addedCapacity: stadium.expansion.addedCapacity,
                          cost: Number(stadium.expansion.cost),
                          completesOn: stadium.expansion.completesOn,
                        },
                      }
                    : {}),
                },
              },
            }
          : {}),
        ledger,
        objectives: world.objectives.map(
          ({ id, metric, target, progress, status }) => ({
            id,
            metric,
            target,
            progress,
            status,
          }),
        ),
        jobProposals: world.jobProposals.map((proposal) => ({
          id: proposal.id,
          clubId: proposal.clubId,
          clubName: names.get(proposal.clubId) ?? proposal.clubId,
          expiresOn: proposal.expiresOn,
          minimumPrestige: proposal.minimumPrestige,
          status: proposal.status,
        })),
        contracts: world.contracts
          .filter((contract) => contract.clubId === clubId)
          .map((contract) => ({
            contractId: contract.id,
            playerId: contract.playerId,
            playerName: playerNames.get(contract.playerId) ?? contract.playerId,
            endsOn: contract.endsOn,
            wage: Number(contract.wage),
            status: contract.status,
          })),
        youth: world.youth
          .filter(({ player }) => player.clubId === clubId)
          .map(({ player, estimate, status }) => ({
            playerId: player.id,
            name: player.name,
            position: player.position,
            age: player.age,
            estimate,
            status,
          })),
        history: world.history
          .slice(-200)
          .reverse()
          .map((event) => ({
            id: event.id,
            type: event.type,
            season: event.season,
            occurredOn: event.occurredOn,
            ...(event.clubId === undefined
              ? {}
              : { clubName: names.get(event.clubId) ?? event.clubId }),
            ...(event.competitionId === undefined
              ? {}
              : { competitionId: event.competitionId }),
            ...(event.playerId === undefined
              ? {}
              : {
                  playerName: playerNames.get(event.playerId) ?? event.playerId,
                }),
          })),
      });
    });
  }

  private competitionView<T>(
    bearer: string,
    careerId: string,
    project: (input: Parameters<typeof projectPyramid>[0]) => T,
  ): Promise<T> {
    return this.query(bearer, careerId, (save, s, now) =>
      project({
        careerId: save.id,
        aggregateVersion: save.version,
        projectedAt: now,
        config: this.loadContent(s.contentVersion).competitions,
        competition: s.competition,
        clubNames: new Map(s.clubs.map(({ id, name }) => [id, name])),
        ...(s.selectedClubId === undefined
          ? {}
          : { managedClubId: s.selectedClubId }),
        history: s.history,
      }),
    );
  }
  public competitions(bearer: string, careerId: string) {
    return this.competitionView(bearer, careerId, projectPyramid);
  }
  public calendar(bearer: string, careerId: string) {
    return this.competitionView(bearer, careerId, projectCalendar);
  }
  public seasonTransition(bearer: string, careerId: string) {
    return this.competitionView(bearer, careerId, projectTransition);
  }

  public async checksum(bearer: string, careerId: string): Promise<string> {
    const user = await this.identity(bearer);
    const save = await this.deps.unitOfWork.withCareerLock(careerId, (tx) =>
      this.load(tx, careerId, user.userId),
    );
    return save.checksum;
  }

  private async query<T>(
    bearer: string,
    careerId: string,
    project: (save: GameSave, snapshot: Snapshot, now: string) => T,
  ): Promise<T> {
    const user = await this.identity(bearer);
    try {
      return await this.deps.unitOfWork.withCareerLock(careerId, async (tx) => {
        const save = await this.load(tx, careerId, user.userId);
        return project(
          save,
          save.snapshot as unknown as Snapshot,
          this.deps.clock.now().toISOString(),
        );
      });
    } catch (e) {
      throw this.translate(e);
    }
  }
  private async load(
    tx: TransactionContext,
    id: string,
    userId: string,
  ): Promise<GameSave> {
    const save = await tx.saves.load(id, userId);
    if (!save) throw new SaveNotFoundError(`save ${id} not found`);
    if (!verifyChecksum(save)) throw new Error('save checksum mismatch');
    if (save.versions.schema !== CAREER_SAVE_SCHEMA)
      throw new ApplicationError(
        'VERSION_CONFLICT',
        `save schema ${save.versions.schema} requires migration`,
      );
    return save;
  }
  private accepted(
    command: Command,
    save: GameSave,
    jobId?: string,
  ): CommandAccepted {
    return commandAcceptedSchema.parse({
      version: 1,
      commandId: command.commandId,
      careerId: save.id,
      aggregateVersion: save.version,
      ...(jobId ? { jobId } : {}),
    });
  }
  private translate(error: unknown): Error {
    if (error instanceof ApplicationError) return error;
    if (error instanceof DomainError)
      return new ApplicationError('VALIDATION_ERROR', error.message);
    if (error instanceof SaveOwnershipError)
      return new ApplicationError('FORBIDDEN', error.message);
    if (error instanceof SaveNotFoundError)
      return new ApplicationError('NOT_FOUND', error.message);
    if (error instanceof SaveConflictError)
      return new ApplicationError('VERSION_CONFLICT', error.message);
    return error instanceof Error ? error : new Error(String(error));
  }
  private async setJobStatus(
    job: SimulationJob,
    state: JobStatus['state'],
    attempt: number,
    errorCode?: string,
  ): Promise<JobStatus> {
    const now = this.deps.clock.now().toISOString();
    const old = await this.deps.jobs.status(job.id);
    const status: JobStatus = {
      version: 1,
      jobId: job.id,
      commandId: job.commandId,
      careerId: job.careerId,
      state,
      progress: {
        current: state === 'succeeded' ? 1 : 0,
        total: 1,
        percent: state === 'succeeded' ? 100 : 0,
        stage: state,
      },
      attempt,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      ...(errorCode ? { errorCode } : {}),
    };
    await this.deps.jobs.update(status);
    return status;
  }
}

function base(save: GameSave, projectedAt: string) {
  return {
    version: 1 as const,
    careerId: save.id,
    aggregateVersion: save.version,
    projectedAt,
  };
}
function clubSummary(snapshot: Snapshot, id?: string) {
  if (!id) return undefined;
  const club = snapshot.clubs.find((candidate) => candidate.id === id);
  return club && { id: club.id, name: club.name, shortName: club.shortName };
}
function managedFixture(
  snapshot: Snapshot,
): CompetitionCalendarFixture | undefined {
  if (!snapshot.selectedClubId) return undefined;
  return pendingFixtures(snapshot.competition).find(
    (f) =>
      f.homeClubId === snapshot.selectedClubId ||
      f.awayClubId === snapshot.selectedClubId,
  );
}
function competitionName(
  config: MvpCompetitionConfig,
  snapshot: Snapshot,
  competitionId: CompetitionId,
): string {
  return (
    careerSeasonSystem(config, snapshot.competition).definitions.find(
      ({ id }) => id === competitionId,
    )?.name ?? competitionId
  );
}
function divisionOf(snapshot: Snapshot, clubId: string): MvpDivisionId {
  const division = (
    Object.keys(snapshot.competition.divisions) as MvpDivisionId[]
  ).find((key) =>
    snapshot.competition.divisions[key].some((id) => id === clubId),
  );
  if (division === undefined)
    throw new ApplicationError('NOT_FOUND', 'club is outside the pyramid');
  return division;
}
/** Closes a finished season, runs the world's season end and opens the next. */
function rollSeason(
  snapshot: Snapshot,
  config: MvpCompetitionConfig,
  seed: string,
): void {
  if (!isSeasonComplete(snapshot.competition)) return;
  const closure = closeCareerSeason(config, snapshot.competition);
  const system = careerSeasonSystem(config, snapshot.competition);
  snapshot.history = [
    ...snapshot.history,
    {
      season: snapshot.season,
      year: snapshot.competition.year,
      movements: closure.generation.events.flatMap((event) =>
        event.type === 'ClubPromoted' || event.type === 'ClubRelegated'
          ? [
              {
                clubId: event.clubId,
                fromCompetitionId: event.fromCompetitionId,
                toCompetitionId: event.toCompetitionId,
                kind:
                  event.type === 'ClubPromoted'
                    ? ('promoted' as const)
                    : ('relegated' as const),
              },
            ]
          : [],
      ),
      qualifiers: closure.generation.events.flatMap((event) =>
        event.type === 'ClubQualified'
          ? [
              {
                clubId: event.clubId,
                fromCompetitionId: event.fromCompetitionId,
                toCompetitionId: event.toCompetitionId,
              },
            ]
          : [],
      ),
      champions: closure.outcomes.map((outcome) => ({
        competitionId: outcome.competitionId,
        championId: outcome.championId,
        ...(outcome.runnerUpId === undefined
          ? {}
          : { runnerUpId: outcome.runnerUpId }),
      })),
    },
  ];
  const managedForm = snapshot.matches.slice(-5).map(({ fixture, result }) => {
    const home = fixture.homeClubId === snapshot.selectedClubId;
    const goalsFor = home ? result.homeGoals : result.awayGoals;
    const goalsAgainst = home ? result.awayGoals : result.homeGoals;
    return goalsFor > goalsAgainst
      ? ('W' as const)
      : goalsFor < goalsAgainst
        ? ('L' as const)
        : ('D' as const);
  });
  withWorld(snapshot, (context) =>
    closeSeasonWorld(context, {
      season: snapshot.season,
      year: snapshot.competition.year,
      seed,
      outcomes: closure.outcomes,
      definitions: system.definitions,
      generation: closure.generation,
      divisionCompetitionIds: system.ids.divisions,
      managedForm,
      pyramidClubIds: Object.values(closure.next.divisions).flat(),
    }),
  );
  snapshot.competition = createCareerSeason(config, closure.next);
  snapshot.season = closure.next.season;
  snapshot.currentDate = `${String(closure.next.year)}-01-01`;
  syncManagedClub(snapshot);
}
/** Keeps the matchday club aligned with the manager after firings or moves. */
export function syncManagedClub(snapshot: Snapshot): void {
  const clubId = snapshot.world.manager.currentClubId;
  if (clubId === snapshot.selectedClubId) {
    if (snapshot.lineup && clubId !== undefined) {
      const club = snapshot.clubs.find(({ id }) => id === clubId)!;
      const squad = new Set<string>(club.squad);
      const lineup = snapshot.lineup;
      const ids = [
        ...lineup.starters.map(({ playerId }) => playerId),
        ...lineup.substitutes,
      ];
      if (ids.some((id) => !squad.has(id)))
        snapshot.lineup = autoSelectLineup({
          club,
          players: snapshot.players,
          formation: snapshot.tactic?.formation ?? '4-4-2',
          mode: 'best',
        });
    }
    return;
  }
  if (clubId === undefined) {
    delete snapshot.selectedClubId;
    delete snapshot.lineup;
    return;
  }
  const club = snapshot.clubs.find(({ id }) => id === clubId)!;
  snapshot.selectedClubId = clubId;
  snapshot.tactic = snapshot.tactic ?? defaultTactic();
  snapshot.lineup = autoSelectLineup({
    club,
    players: snapshot.players,
    formation: snapshot.tactic.formation,
    mode: 'best',
  });
}
function postMatchModel(
  save: GameSave,
  s: Snapshot,
  played: ManagedMatch,
  now: string,
  committed: boolean,
): PostMatchReadModel {
  const { fixture: f, result } = played;
  const timeline: Record<string, unknown>[] = [];
  for (const event of result.timeline) {
    if (event.type === 'goal')
      timeline.push({
        type: 'goal',
        minute: event.minute,
        side: event.side,
        playerId: event.scorerId,
      });
    else if (event.type === 'chance')
      timeline.push({
        type: 'chance',
        minute: event.minute,
        side: event.side,
        xg: event.xg,
      });
    else if (event.type === 'card')
      timeline.push({
        type: 'card',
        minute: event.minute,
        side: event.side,
        playerId: event.playerId,
        card: event.card,
      });
    else if (event.type === 'injury')
      timeline.push({
        type: 'injury',
        minute: event.minute,
        side: event.side,
        playerId: event.playerId,
        rounds: event.rounds,
      });
    else if (event.type === 'substitution')
      timeline.push({
        type: 'substitution',
        minute: event.minute,
        side: event.side,
        playerOutId: event.playerOutId,
        playerInId: event.playerInId,
        ...(event.source ? { source: event.source } : {}),
      });
    else
      timeline.push({
        type: 'tactical_change',
        minute: event.minute,
        side: event.side,
        formation: event.tactic.formation,
        mentality: event.tactic.mentality,
      });
  }
  return postMatchReadModelSchema.parse({
    ...base(save, now),
    matchId: result.matchId,
    fixtureId: result.fixtureId,
    homeClub: clubSummary(s, f.homeClubId),
    awayClub: clubSummary(s, f.awayClubId),
    score: { home: result.homeGoals, away: result.awayGoals },
    timeline,
    tableUpdated: committed,
    playback: createMatchPresentation(result).playback,
  });
}
function reformLineup(
  lineup: Lineup,
  players: readonly Player[],
  formation: Tactic['formation'],
): Lineup {
  const byId = new Map(players.map((player) => [player.id, player]));
  const goalkeeper = lineup.starters.find(
    ({ playerId }) => byId.get(playerId)?.position === 'GK',
  );
  if (!goalkeeper)
    throw new ApplicationError(
      'VALIDATION_ERROR',
      'lineup has no goalkeeper for the selected formation',
    );
  const ordered = [
    goalkeeper,
    ...lineup.starters.filter(
      ({ playerId }) => playerId !== goalkeeper.playerId,
    ),
  ];
  return createLineup({
    ...lineup,
    starters: FORMATION_POSITIONS[formation].map((position, index) => ({
      playerId: ordered[index]?.playerId ?? goalkeeper.playerId,
      position,
    })),
  });
}
function estimate(value: number): 'low' | 'average' | 'good' | 'excellent' {
  return value < 40
    ? 'low'
    : value < 65
      ? 'average'
      : value < 82
        ? 'good'
        : 'excellent';
}
function hiddenEstimates(player: Player) {
  return {
    potential: estimate(Number(player.hidden.potential)),
    consistency: estimate(Number(player.hidden.consistency)),
    injuryRisk:
      Number(player.hidden.injuryProneness) < 25
        ? ('low' as const)
        : Number(player.hidden.injuryProneness) < 55
          ? ('average' as const)
          : ('high' as const),
    adaptation: estimate(Number(player.hidden.adaptation)),
    professionalism: estimate(Number(player.hidden.professionalism)),
    bigGames: estimate(Number(player.hidden.bigGame)),
  };
}
function matchPreparation(
  snapshot: Snapshot,
  fixture: CompetitionCalendarFixture,
) {
  const opponentId =
    fixture.homeClubId === snapshot.selectedClubId
      ? fixture.awayClubId
      : fixture.homeClubId;
  const opponent = clubSummary(snapshot, opponentId)!;
  const { fixtures, results } = snapshot.competition;
  const recentForm = fixtures
    .filter(
      (played) =>
        results[played.id] !== undefined &&
        (played.homeClubId === opponentId || played.awayClubId === opponentId),
    )
    .slice(-5)
    .map((played) => {
      const result = results[played.id]!;
      const goalsFor =
        played.homeClubId === opponentId ? result.homeGoals : result.awayGoals;
      const goalsAgainst =
        played.homeClubId === opponentId ? result.awayGoals : result.homeGoals;
      return goalsFor > goalsAgainst
        ? ('W' as const)
        : goalsFor < goalsAgainst
          ? ('L' as const)
          : ('D' as const);
    });
  const mean = (clubId: string) => {
    const values = snapshot.players
      .filter(
        (player) =>
          player.clubId === clubId &&
          player.injuryRounds === 0 &&
          player.suspensionRounds === 0,
      )
      .map(({ strength }) => Number(strength))
      .sort((left, right) => right - left)
      .slice(0, 16);
    return (
      values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
    );
  };
  const difference = mean(opponentId) - mean(snapshot.selectedClubId!);
  const approximateStrength =
    difference < -7
      ? ('much_weaker' as const)
      : difference < -2
        ? ('weaker' as const)
        : difference <= 2
          ? ('similar' as const)
          : difference <= 7
            ? ('stronger' as const)
            : ('much_stronger' as const);
  const absences = snapshot.players
    .filter(
      (player) =>
        player.clubId === opponentId &&
        (player.injuryRounds > 0 || player.suspensionRounds > 0),
    )
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      reason:
        player.injuryRounds > 0 ? ('injury' as const) : ('suspension' as const),
      rounds: Math.max(player.injuryRounds, player.suspensionRounds),
    }));
  return {
    opponent,
    venue:
      fixture.homeClubId === snapshot.selectedClubId
        ? ('home' as const)
        : ('away' as const),
    recentForm,
    approximateStrength,
    absences,
  };
}
/** Applies one match to both squads; absences count down per club match. */
function applyPerformances(
  snapshot: Snapshot,
  fixture: CompetitionCalendarFixture,
  result: MatchResult,
): void {
  const performance = new Map(
    (result.playerPerformances ?? []).map((item) => [item.playerId, item]),
  );
  const clubs = new Set<string>([fixture.homeClubId, fixture.awayClubId]);
  snapshot.players = snapshot.players.map((player) => {
    if (player.clubId === undefined || !clubs.has(player.clubId)) return player;
    const played = performance.get(player.id);
    if (!played)
      return {
        ...player,
        injuryRounds: Math.max(0, player.injuryRounds - 1),
        suspensionRounds: Math.max(0, player.suspensionRounds - 1),
        condition: Math.min(100, Number(player.condition) + 3),
      } as Player;
    const ratedAppearances = (player.careerStats.ratedAppearances ?? 0) + 1;
    return {
      ...player,
      condition: Math.max(
        0,
        Math.min(100, Number(player.condition) + played.conditionDelta),
      ),
      morale: Math.max(
        0,
        Math.min(100, Number(player.morale) + played.moraleDelta),
      ),
      matchSharpness: Math.min(
        100,
        Number(player.matchSharpness) + (played.started ? 2 : 1),
      ),
      injuryRounds: Math.max(
        Math.max(0, player.injuryRounds - 1),
        played.injuryRounds,
      ),
      suspensionRounds: Math.max(
        Math.max(0, player.suspensionRounds - 1),
        played.suspensionRounds,
      ),
      lastMatchRating: played.rating,
      careerStats: {
        ...player.careerStats,
        appearances: player.careerStats.appearances + 1,
        goals: player.careerStats.goals + played.goals,
        assists: player.careerStats.assists + played.assists,
        yellowCards: player.careerStats.yellowCards + played.yellowCards,
        redCards: player.careerStats.redCards + played.redCards,
        ratedAppearances,
        ratingTotal: Number(
          ((player.careerStats.ratingTotal ?? 0) + played.rating).toFixed(1),
        ),
      },
    } as Player;
  });
}
/** Clubs without a match on a date still recover a little condition. */
function recoverIdlePlayers(
  snapshot: Snapshot,
  playing: ReadonlySet<string>,
): void {
  snapshot.players = snapshot.players.map((player) =>
    player.clubId !== undefined &&
    !playing.has(player.clubId) &&
    Number(player.condition) < 100
      ? ({
          ...player,
          condition: Math.min(100, Number(player.condition) + 2),
        } as Player)
      : player,
  );
}
