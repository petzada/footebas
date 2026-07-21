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
  createLineup,
  createMatchInput,
  createTactic,
  entityId,
  type CanonicalValue,
  type Club,
  type Fixture,
  type Lineup,
  type MatchResult,
  type Player,
  type Tactic,
} from '@footebas/domain';
import {
  ENGINE_VERSION,
  generateDoubleRoundRobin,
  simulateMatch,
} from '@footebas/engine';
import { createHash } from 'node:crypto';
import {
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
  content: 'fixture-v1',
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
    const careerId = `career_${createHash('sha256').update(command.commandId).digest('hex').slice(0, 20)}`;
    const response = await this.deps.unitOfWork.executeIdempotent(
      careerId,
      command.commandId,
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
    const response = await this.deps.unitOfWork.executeIdempotent(
      careerId,
      command.commandId,
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
              captainId: entityId(command.payload.captainId, 'player'),
            });
            break;
          }
          case 'SetTactics':
            snapshot.tactic = createTactic(command.payload);
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
            const jobId = this.deps.ids.next('job');
            snapshot.pendingJobId = jobId;
            job = {
              id: jobId,
              commandId: command.commandId,
              careerId,
              userId,
              expectedVersion: save.version + 1,
              fixtureId: fixture.id,
            };
            break;
          }
        }
        const updated = await tx.saves.update(careerId, userId, save.version, {
          snapshot: asCanonical(snapshot),
          seed: save.seed,
          versions: save.versions,
        });
        if (job) await this.deps.jobs.enqueue(job);
        return asCanonical(this.accepted(command, updated, job?.id));
      },
    );
    return commandAcceptedSchema.parse(response);
  }

  public async runNextJob(): Promise<JobStatus | undefined> {
    const job = await this.deps.jobs.take();
    if (!job) return undefined;
    const prior = await this.deps.jobs.status(job.id);
    if (prior?.state === 'succeeded') return prior;
    await this.setJobStatus(
      job,
      'running',
      prior?.attempt ? prior.attempt + 1 : 1,
    );
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
        const result = this.simulate(snapshot, fixture, save.seed);
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
    return simulateMatch(
      createMatchInput({
        fixtureId: fixture.id,
        seed: `${seed}:${fixture.id}`,
        engineVersion: ENGINE_VERSION,
        rulesVersion: VERSIONS.rules,
        home: side(fixture.homeClubId),
        away: side(fixture.awayClubId),
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
            strength: p.strength,
            condition: p.condition,
            morale: p.morale,
            injuryRounds: p.injuryRounds,
            suspensionRounds: p.suspensionRounds,
          })),
        lineupPlayerIds: s.lineup
          ? [
              ...s.lineup.starters.map(({ playerId }) => playerId),
              ...s.lineup.substitutes,
            ]
          : [],
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
  const starters = new Set([
    ...(snapshot.lineup?.starters.map(({ playerId }) => playerId) ?? []),
  ]);
  snapshot.players = snapshot.players.map((player) =>
    starters.has(player.id)
      ? ({
          ...player,
          condition: Math.max(0, Number(player.condition) - 6),
          matchSharpness: Math.min(100, Number(player.matchSharpness) + 2),
          careerStats: {
            ...player.careerStats,
            appearances: player.careerStats.appearances + 1,
          },
        } as Player)
      : player,
  );
}
