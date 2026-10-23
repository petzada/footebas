import {
  aggregateRanking,
  canonicalJson,
  RANKING_ALL_TIME,
  rankingStandings,
  type CanonicalValue,
  type RankingPlayer,
  type RankingScope,
} from '@footebas/domain';
import {
  assertRequiredMetadata,
  checksumSnapshot,
  type Clock,
  type GameSave,
  type NewGameSave,
  type SaveUpdate,
} from './model.js';
import {
  SaveConflictError,
  SaveNotFoundError,
  SaveOwnershipError,
  type AchievementLedgerPort,
  type CareerSaveStore,
  type CommandReceipt,
  type CommandRepository,
  type GameSaveRepository,
  type RankingBoard,
  type RankingEnrollment,
  type RankingPeriod,
  type RankingPosition,
  type RankingStorePort,
  type TransactionContext,
  type UnitOfWork,
  type ValidatedAchievement,
} from './ports.js';

const clone = <T>(value: T): T => structuredClone(value);
interface State {
  saves: Map<string, GameSave>;
  commands: Map<string, CommandReceipt>;
  achievements: Map<string, ValidatedAchievement>;
  /** Ranking accounts by user (ADR 0017). */
  players: Map<string, RankingPlayer>;
}

/** Uniqueness of a validated achievement (career, type, season, competition). */
export const achievementKey = (
  entry: Pick<
    ValidatedAchievement,
    'careerId' | 'type' | 'season' | 'competitionId'
  >,
): string =>
  `${entry.careerId}|${entry.type}|${String(entry.season)}|${entry.competitionId}`;

class MemorySaveRepository implements GameSaveRepository {
  constructor(
    private readonly state: State,
    private readonly clock: Clock,
  ) {}
  create(input: NewGameSave): Promise<GameSave> {
    assertRequiredMetadata(input.seed, input.versions);
    if (this.state.saves.has(input.id))
      throw new SaveConflictError(`save ${input.id} already exists`);
    const instant = this.clock.now().toISOString();
    const save: GameSave = {
      ...clone(input),
      checksum: checksumSnapshot(input.snapshot),
      version: 1,
      createdAt: instant,
      updatedAt: instant,
    };
    this.state.saves.set(save.id, save);
    return Promise.resolve(clone(save));
  }
  private active(id: string): GameSave | undefined {
    const save = this.state.saves.get(id);
    return save?.archivedAt === undefined ? save : undefined;
  }
  private owned(id: string, userId: string): GameSave {
    const save = this.active(id);
    if (!save) throw new SaveNotFoundError(`save ${id} not found`);
    if (save.userId !== userId)
      throw new SaveOwnershipError(`save ${id} does not belong to user`);
    return save;
  }
  load(id: string, userId: string): Promise<GameSave | undefined> {
    const save = this.active(id);
    if (!save) return Promise.resolve(undefined);
    if (save.userId !== userId)
      throw new SaveOwnershipError(`save ${id} does not belong to user`);
    return Promise.resolve(clone(save));
  }
  peek(id: string): Promise<GameSave | undefined> {
    const save = this.active(id);
    return Promise.resolve(save === undefined ? undefined : clone(save));
  }
  private activeSaves(): GameSave[] {
    return [...this.state.saves.values()].filter(
      (save) => save.archivedAt === undefined,
    );
  }
  listByUser(userId: string): Promise<readonly GameSave[]> {
    return Promise.resolve(
      this.activeSaves()
        .filter((save) => save.userId === userId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map(clone),
    );
  }
  countActiveByUser(userId: string): Promise<number> {
    return Promise.resolve(
      this.activeSaves().filter((save) => save.userId === userId).length,
    );
  }
  countActiveUsers(): Promise<number> {
    return Promise.resolve(
      new Set(this.activeSaves().map(({ userId }) => userId)).size,
    );
  }
  archive(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<GameSave> {
    const current = this.owned(id, userId);
    if (current.version !== expectedVersion)
      throw new SaveConflictError(
        `expected version ${String(expectedVersion)}, found ${String(current.version)}`,
      );
    const instant = this.clock.now().toISOString();
    const archived: GameSave = {
      ...current,
      version: current.version + 1,
      updatedAt: instant,
      archivedAt: instant,
    };
    this.state.saves.set(id, archived);
    return Promise.resolve(clone(archived));
  }
  delete(id: string, userId: string): Promise<void> {
    const save = this.state.saves.get(id);
    if (!save) throw new SaveNotFoundError(`save ${id} not found`);
    if (save.userId !== userId)
      throw new SaveOwnershipError(`save ${id} does not belong to user`);
    this.state.saves.delete(id);
    for (const key of [...this.state.commands.keys()])
      if (key.startsWith(`${id}:`)) this.state.commands.delete(key);
    return Promise.resolve();
  }
  update(
    id: string,
    userId: string,
    expectedVersion: number,
    update: SaveUpdate,
  ): Promise<GameSave> {
    assertRequiredMetadata(update.seed, update.versions);
    const current = this.owned(id, userId);
    if (current.version !== expectedVersion)
      throw new SaveConflictError(
        `expected version ${String(expectedVersion)}, found ${String(current.version)}`,
      );
    const next: GameSave = {
      ...current,
      ...clone(update),
      checksum: checksumSnapshot(update.snapshot),
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    this.state.saves.set(id, next);
    return Promise.resolve(clone(next));
  }
}

class MemoryCommandRepository implements CommandRepository {
  constructor(private readonly state: State) {}
  load<T extends CanonicalValue>(
    careerId: string,
    commandId: string,
  ): Promise<CommandReceipt<T> | undefined> {
    return Promise.resolve(
      clone(this.state.commands.get(`${careerId}:${commandId}`)) as
        CommandReceipt<T> | undefined,
    );
  }
  save<T extends CanonicalValue>(receipt: CommandReceipt<T>): Promise<void> {
    const key = `${receipt.careerId}:${receipt.commandId}`;
    const existing = this.state.commands.get(key);
    if (
      existing &&
      canonicalJson(existing.response) !== canonicalJson(receipt.response)
    )
      throw new SaveConflictError(
        'command id reused with a different response',
      );
    this.state.commands.set(key, clone(receipt));
    return Promise.resolve();
  }
}

/** Links an account to a career only while it has none. */
function enrollPlayer(
  state: State,
  career: RankingEnrollment,
  joinedAt: string,
): void {
  const current = state.players.get(career.userId);
  if (current?.careerId !== undefined) return;
  state.players.set(career.userId, {
    userId: career.userId,
    joinedAt: current?.joinedAt ?? joinedAt,
    careerId: career.careerId,
    displayName: career.displayName,
    ...(career.avatar === undefined ? {} : { avatar: career.avatar }),
  });
}

class MemoryAchievementLedger implements AchievementLedgerPort {
  constructor(
    private readonly state: State,
    private readonly clock: Clock,
  ) {}
  record(entries: readonly ValidatedAchievement[]): Promise<void> {
    for (const entry of entries) {
      const key = achievementKey(entry);
      if (!this.state.achievements.has(key))
        this.state.achievements.set(key, clone(entry));
      // Totals are derived from the ledger on read; the account must exist.
      enrollPlayer(this.state, entry, this.clock.now().toISOString());
    }
    return Promise.resolve();
  }
  enroll(career: RankingEnrollment): Promise<void> {
    enrollPlayer(this.state, career, this.clock.now().toISOString());
    return Promise.resolve();
  }
  listByCareer(careerId: string): Promise<readonly ValidatedAchievement[]> {
    return Promise.resolve(
      [...this.state.achievements.values()]
        .filter((entry) => entry.careerId === careerId)
        .sort(
          (left, right) =>
            left.recordedAt.localeCompare(right.recordedAt) ||
            achievementKey(left).localeCompare(achievementKey(right)),
        )
        .map(clone),
    );
  }
}

export class InMemoryUnitOfWork implements UnitOfWork {
  private state: State = {
    saves: new Map(),
    commands: new Map(),
    achievements: new Map(),
    players: new Map(),
  };
  private readonly tails = new Map<string, Promise<void>>();
  constructor(private readonly clock: Clock) {}
  repositories(): TransactionContext {
    return this.context(this.state);
  }
  private context(state: State): TransactionContext {
    return {
      saves: new MemorySaveRepository(state, this.clock),
      commands: new MemoryCommandRepository(state),
      achievements: new MemoryAchievementLedger(state, this.clock),
    };
  }
  /**
   * Career save store over the committed state (the career Durable Object's
   * durable copy in tests and the local server).
   */
  careerSaveStore(): CareerSaveStore {
    const repositories = () => this.repositories();
    const commit = async (
      save: GameSave,
      expectedVersion: number,
      achievements: readonly ValidatedAchievement[],
    ) => {
      assertRequiredMetadata(save.seed, save.versions);
      const current = this.state.saves.get(save.id);
      if (current === undefined || current.archivedAt !== undefined)
        throw new SaveNotFoundError(`save ${save.id} not found`);
      if (current.userId !== save.userId)
        throw new SaveOwnershipError(`save ${save.id} does not belong to user`);
      if (
        current.version === save.version &&
        current.checksum === save.checksum
      )
        return;
      if (current.version !== expectedVersion)
        throw new SaveConflictError(
          `expected version ${String(expectedVersion)}, found ${String(current.version)}`,
        );
      this.state.saves.set(save.id, clone(save));
      await repositories().achievements.record(achievements);
    };
    return {
      peek: (id) => repositories().saves.peek(id),
      versionOf: async (id) => (await repositories().saves.peek(id))?.version,
      commit,
      archive: (id, userId, expectedVersion) =>
        repositories().saves.archive(id, userId, expectedVersion),
      delete: (id, userId) => repositories().saves.delete(id, userId),
      listAchievements: (careerId) =>
        repositories().achievements.listByCareer(careerId),
    };
  }
  /** Committed validated achievements (for the in-memory ranking store). */
  achievements(): readonly ValidatedAchievement[] {
    return [...this.state.achievements.values()].map(clone);
  }
  /** Committed ranking accounts (for the in-memory ranking store). */
  rankingPlayers(): readonly RankingPlayer[] {
    return [...this.state.players.values()].map(clone);
  }
  /** Sign-up of an account (the `auth.users` trigger of the migration). */
  signUp(userId: string, joinedAt = this.clock.now().toISOString()): void {
    if (!this.state.players.has(userId))
      this.state.players.set(userId, { userId, joinedAt });
  }
  async withCareerLock<T>(
    careerId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const prior = this.tails.get(careerId) ?? Promise.resolve();
    let release!: () => void;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = prior.then(() => turn);
    this.tails.set(careerId, tail);
    await prior;
    const draft: State = {
      saves: new Map([...this.state.saves].map(([k, v]) => [k, clone(v)])),
      commands: new Map(
        [...this.state.commands].map(([k, v]) => [k, clone(v)]),
      ),
      achievements: new Map(
        [...this.state.achievements].map(([k, v]) => [k, clone(v)]),
      ),
      players: new Map([...this.state.players].map(([k, v]) => [k, clone(v)])),
    };
    try {
      const result = await work(this.context(draft));
      this.state = draft;
      return result;
    } finally {
      release();
      if (this.tails.get(careerId) === tail) this.tails.delete(careerId);
    }
  }
  async executeIdempotent<T extends CanonicalValue>(
    careerId: string,
    commandId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.withCareerLock(careerId, async (tx) => {
      const previous = await tx.commands.load<T>(careerId, commandId);
      if (previous) return previous.response;
      const response = await work(tx);
      await tx.commands.save({
        careerId,
        commandId,
        response,
        createdAt: this.clock.now().toISOString(),
      });
      return clone(response);
    });
  }
}

/** What the in-memory ranking reads (an `InMemoryUnitOfWork`). */
export interface InMemoryRankingSource {
  achievements(): readonly ValidatedAchievement[];
  rankingPlayers(): readonly RankingPlayer[];
}

/**
 * Live leaderboards over the in-memory ledger (tests, local server): the
 * same domain rules the Postgres adapter stores per user (ADR 0017).
 */
export class InMemoryRankingStore implements RankingStorePort {
  /** Closed months: period -> rows written. */
  private readonly closed = new Map<string, number>();
  constructor(private readonly source: InMemoryRankingSource) {}
  private standings(scope: RankingScope, period: RankingPeriod) {
    const rows = aggregateRanking(
      this.source.achievements(),
      scope,
      scope === 'monthly' ? period : undefined,
    );
    return {
      rows,
      standings: rankingStandings(rows, this.source.rankingPlayers()),
    };
  }
  board(
    scope: RankingScope,
    period: RankingPeriod,
    limit: number,
  ): Promise<RankingBoard> {
    const { standings } = this.standings(scope, period);
    return Promise.resolve({
      scope,
      period,
      total: standings.length,
      rows: standings
        .flatMap((row) =>
          row.careerId === undefined || row.displayName === undefined
            ? []
            : [
                {
                  ...row,
                  careerId: row.careerId,
                  displayName: row.displayName,
                },
              ],
        )
        .slice(0, limit),
    });
  }
  positionsOf(
    userId: string,
    targets: readonly { scope: RankingScope; period: RankingPeriod }[],
  ): Promise<readonly RankingPosition[]> {
    return Promise.resolve(
      targets.map(({ scope, period }) => {
        const { standings } = this.standings(scope, period);
        const row = standings.find((item) => item.userId === userId);
        if (row === undefined)
          return {
            scope,
            period,
            total: standings.length,
            userId,
            points: 0,
            titles: 0,
            season: 0,
          };
        return { ...row, scope, period, total: standings.length };
      }),
    );
  }
  closeMonth(period: string): Promise<number | undefined> {
    if (period === RANKING_ALL_TIME || this.closed.has(period))
      return Promise.resolve(undefined);
    const rows = this.standings('monthly', period).rows.length;
    this.closed.set(period, rows);
    return Promise.resolve(rows);
  }
  refreshPending(): Promise<number> {
    // Totals are derived from the ledger on every read: nothing to rebuild.
    return Promise.resolve(0);
  }
}
