/* eslint-disable @typescript-eslint/no-non-null-assertion -- lookups follow explicit guards and fixture invariants */
import {
  commandAcceptedSchema,
  commandSchema,
  homeReadModelSchema,
  nextMatchReadModelSchema,
  postMatchReadModelSchema,
  squadReadModelSchema,
  standingsReadModelSchema,
  type Command,
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
  GameDate,
  FORMATION_POSITIONS,
  createLineup,
  createMatchInput,
  createTactic,
  entityId,
  validateLineupForMatch,
  type CanonicalValue,
  type Club,
  type Fixture,
  type Lineup,
  type MatchResult,
  type MatchInstruction,
  type Player,
  type Tactic,
} from '@footebas/domain';
import {
  ENGINE_VERSION,
  autoSelectLineup,
  createMatchPresentation,
  generateDoubleRoundRobin,
  simulateMatch,
} from '@footebas/engine';
import { createHash } from 'node:crypto';
import {
  FIXTURE_CONTENT_VERSION,
  createFixtureContent,
  defaultLineup,
  defaultTactic,
} from './fixture.js';
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

const VERSIONS = {
  schema: 'game-save-v1',
  engine: ENGINE_VERSION,
  rules: 'league-v1',
  content: FIXTURE_CONTENT_VERSION,
} as const;
const COMPETITION_ID = entityId('competition_fixture_league', 'competition');
const asCanonical = (value: unknown): CanonicalValue => value as CanonicalValue;

interface Standing {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}
interface Snapshot {
  managerName: string;
  currentDate: string;
  season: number;
  selectedClubId?: string;
  clubs: Club[];
  players: Player[];
  fixtures: (Omit<Fixture, 'date'> & { date: string })[];
  lineup?: Lineup;
  tactic?: Tactic;
  results: MatchResult[];
  standings: Standing[];
  contentProvenance: ReturnType<typeof createFixtureContent>['provenance'];
  pendingJobId?: string;
}

export interface ApplicationDependencies {
  readonly auth: AuthPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly jobs: JobQueuePort;
  readonly storage: StoragePort;
  readonly telemetry: TelemetryPort;
  readonly unitOfWork: UnitOfWork;
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

export class FootebasApplication {
  public constructor(private readonly deps: ApplicationDependencies) {}

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

  private async createCareer(
    userId: string,
    command: Extract<Command, { type: 'CreateCareer' }>,
  ): Promise<CommandAccepted> {
    if (command.expectedVersion !== 0)
      throw new ApplicationError(
        'VERSION_CONFLICT',
        'new careers require expectedVersion 0',
      );
    const careerId = `career_${createHash('sha256')
      .update(`${userId}:${command.idempotencyKey}`)
      .digest('hex')
      .slice(0, 20)}`;
    const response = await this.deps.unitOfWork.executeIdempotent(
      careerId,
      command.idempotencyKey,
      async (tx) => {
        const content = createFixtureContent();
        const firstDate = GameDate.parse(command.payload.startDate).addDays(7);
        const fixtures = generateDoubleRoundRobin(
          COMPETITION_ID,
          content.clubs.map(({ id }) => id),
          firstDate,
        ).map((fixture) => ({ ...fixture, date: fixture.date.toString() }));
        const snapshot: Snapshot = {
          managerName: command.payload.managerName,
          currentDate: command.payload.startDate,
          season: 1,
          clubs: [...content.clubs],
          players: [...content.players],
          fixtures,
          results: [],
          contentProvenance: content.provenance,
          standings: content.clubs.map(({ id }) => ({
            clubId: id,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0,
          })),
        };
        const save = await tx.saves.create({
          id: careerId,
          userId,
          snapshot: asCanonical(snapshot),
          seed: `career-seed:${careerId}`,
          versions: VERSIONS,
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
            snapshot.selectedClubId = club.id;
            snapshot.lineup = defaultLineup(club, snapshot.players);
            snapshot.tactic = defaultTactic();
            break;
          }
          case 'SetLineup': {
            if (snapshot.selectedClubId !== command.payload.clubId)
              throw new ApplicationError(
                'FORBIDDEN',
                'lineup club is not managed by this career',
              );
            const club = snapshot.clubs.find(
              ({ id }) => id === command.payload.clubId,
            )!;
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
            snapshot.lineup = createLineup({
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
            break;
          }
          case 'AutoPickLineup': {
            if (snapshot.selectedClubId !== command.payload.clubId)
              throw new ApplicationError(
                'FORBIDDEN',
                'lineup club is not managed by this career',
              );
            const club = snapshot.clubs.find(
              ({ id }) => id === command.payload.clubId,
            )!;
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
            if (
              !snapshot.selectedClubId ||
              !snapshot.lineup ||
              !snapshot.tactic
            )
              throw new ApplicationError(
                'VALIDATION_ERROR',
                'select a club and confirm lineup/tactics first',
              );
            if (snapshot.pendingJobId)
              throw new ApplicationError(
                'VERSION_CONFLICT',
                'a simulation is already pending',
              );
            const fixture =
              command.type === 'SimulateMatch'
                ? snapshot.fixtures.find(
                    ({ id }) =>
                      id === command.payload.fixtureId &&
                      statusOf(snapshot, command.payload.fixtureId) ===
                        'scheduled',
                  )
                : nextFixture(snapshot);
            if (
              !fixture ||
              (fixture.homeClubId !== snapshot.selectedClubId &&
                fixture.awayClubId !== snapshot.selectedClubId)
            )
              throw new ApplicationError(
                'NOT_FOUND',
                'next managed fixture not found',
              );
            if (
              command.type === 'AdvanceDate' &&
              command.payload.throughDate &&
              command.payload.throughDate < fixture.date
            )
              throw new ApplicationError(
                'VALIDATION_ERROR',
                'throughDate does not reach the next fixture',
              );
            if (command.type === 'SimulateMatch') {
              const managedSide =
                fixture.homeClubId === snapshot.selectedClubId
                  ? 'home'
                  : 'away';
              if (
                command.payload.instructions?.some(
                  ({ side }) => side !== managedSide,
                )
              )
                throw new ApplicationError(
                  'FORBIDDEN',
                  'match instructions can only target the managed club',
                );
            }
            const jobId = this.deps.ids.next('job');
            snapshot.pendingJobId = jobId;
            job = {
              id: jobId,
              commandId: command.commandId,
              careerId,
              userId,
              expectedVersion: save.version + 1,
              fixtureId: fixture.id,
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
        if (
          snapshot.results.some(({ fixtureId }) => fixtureId === job.fixtureId)
        )
          return;
        if (
          save.version !== job.expectedVersion ||
          snapshot.pendingJobId !== job.id
        )
          throw new SaveConflictError('job snapshot version is stale');
        const fixtureData = snapshot.fixtures.find(
          ({ id }) => id === job.fixtureId,
        );
        if (!fixtureData) throw new Error('fixture missing');
        const fixture = {
          ...fixtureData,
          date: GameDate.parse(fixtureData.date),
        } as Fixture;
        const result = this.simulate(
          snapshot,
          fixture,
          save.seed,
          job.instructions,
        );
        applyResult(snapshot, fixture, result);
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

  private simulate(
    snapshot: Snapshot,
    fixture: Fixture,
    seed: string,
    instructions: readonly MatchInstruction[] = [],
  ): MatchResult {
    const side = (clubId: string) => {
      const club = snapshot.clubs.find(({ id }) => id === clubId)!;
      const managed = clubId === snapshot.selectedClubId;
      return {
        club,
        lineup: managed
          ? snapshot.lineup!
          : defaultLineup(club, snapshot.players),
        tactic: managed ? snapshot.tactic! : defaultTactic(),
        players: snapshot.players.filter((player) => player.clubId === club.id),
      };
    };
    const managedSide =
      fixture.homeClubId === snapshot.selectedClubId ? 'home' : 'away';
    if (instructions.some(({ side }) => side !== managedSide))
      throw new ApplicationError(
        'FORBIDDEN',
        'match instructions can only control the managed club',
      );
    const managedClub = snapshot.clubs.find(
      ({ id }) => id === snapshot.selectedClubId,
    )!;
    validateLineupForMatch(
      snapshot.lineup!,
      managedClub,
      snapshot.players,
      snapshot.tactic!.formation,
    );
    return simulateMatch(
      createMatchInput({
        fixtureId: fixture.id,
        seed: `${seed}:${fixture.id}`,
        engineVersion: ENGINE_VERSION,
        rulesVersion: VERSIONS.rules,
        home: side(fixture.homeClubId),
        away: side(fixture.awayClubId),
        instructions,
      }),
    );
  }

  public async home(bearer: string, careerId: string): Promise<HomeReadModel> {
    return this.query(bearer, careerId, (save, s, now) =>
      homeReadModelSchema.parse({
        ...base(save, now),
        managerName: s.managerName,
        club: clubSummary(s, s.selectedClubId),
        currentDate: s.currentDate,
        season: s.season,
        nextFixtureId: nextFixture(s)?.id,
        pendingActions: s.pendingJobId
          ? ['simulation_pending']
          : nextFixture(s)
            ? ['prepare_match']
            : [],
      }),
    );
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
      const f = nextFixture(s);
      if (!f) throw new ApplicationError('NOT_FOUND', 'next fixture not found');
      return nextMatchReadModelSchema.parse({
        ...base(save, now),
        fixtureId: f.id,
        competition: 'Liga Fixture',
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
    return this.query(bearer, careerId, (save, s, now) =>
      standingsReadModelSchema.parse({
        ...base(save, now),
        competitionId: COMPETITION_ID,
        competition: 'Liga Fixture',
        rows: sortedStandings(s).map((r, index) => ({
          position: index + 1,
          club: clubSummary(s, r.clubId),
          played: r.played,
          won: r.won,
          drawn: r.drawn,
          lost: r.lost,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          goalDifference: r.goalsFor - r.goalsAgainst,
          points: r.points,
        })),
      }),
    );
  }
  public async postMatch(
    bearer: string,
    careerId: string,
  ): Promise<PostMatchReadModel> {
    return this.query(bearer, careerId, (save, s, now) => {
      const result = s.results.at(-1);
      if (!result) throw new ApplicationError('NOT_FOUND', 'no match result');
      const f = s.fixtures.find(({ id }) => id === result.fixtureId)!;
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
        tableUpdated: true,
        playback: createMatchPresentation(result).playback,
      });
    });
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
function statusOf(snapshot: Snapshot, fixtureId: string) {
  return snapshot.results.some((result) => result.fixtureId === fixtureId)
    ? 'played'
    : 'scheduled';
}
function nextFixture(snapshot: Snapshot) {
  return snapshot.fixtures.find(
    (f) =>
      statusOf(snapshot, f.id) === 'scheduled' &&
      (f.homeClubId === snapshot.selectedClubId ||
        f.awayClubId === snapshot.selectedClubId),
  );
}
function sortedStandings(snapshot: Snapshot) {
  return [...snapshot.standings].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      a.clubId.localeCompare(b.clubId),
  );
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
  fixture: Snapshot['fixtures'][number],
) {
  const opponentId =
    fixture.homeClubId === snapshot.selectedClubId
      ? fixture.awayClubId
      : fixture.homeClubId;
  const opponent = clubSummary(snapshot, opponentId)!;
  const recentForm = snapshot.results
    .filter((result) => {
      const played = snapshot.fixtures.find(
        ({ id }) => id === result.fixtureId,
      );
      return (
        played?.homeClubId === opponentId || played?.awayClubId === opponentId
      );
    })
    .slice(-5)
    .map((result) => {
      const played = snapshot.fixtures.find(
        ({ id }) => id === result.fixtureId,
      )!;
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
      .map(({ strength }) => Number(strength));
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
function applyResult(
  snapshot: Snapshot,
  fixture: Fixture,
  result: MatchResult,
): void {
  snapshot.results.push(result);
  snapshot.currentDate = fixture.date.toString();
  const home = snapshot.standings.find(
    ({ clubId }) => clubId === fixture.homeClubId,
  )!;
  const away = snapshot.standings.find(
    ({ clubId }) => clubId === fixture.awayClubId,
  )!;
  home.played += 1;
  away.played += 1;
  home.goalsFor += result.homeGoals;
  home.goalsAgainst += result.awayGoals;
  away.goalsFor += result.awayGoals;
  away.goalsAgainst += result.homeGoals;
  if (result.homeGoals > result.awayGoals) {
    home.won += 1;
    away.lost += 1;
    home.points += 3;
  } else if (result.homeGoals < result.awayGoals) {
    away.won += 1;
    home.lost += 1;
    away.points += 3;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
  const performance = new Map(
    (result.playerPerformances ?? []).map((item) => [item.playerId, item]),
  );
  snapshot.players = snapshot.players.map((player) => {
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
