import {
  aggregateRanking,
  canonicalJson,
  type CanonicalValue,
  type RankingRow,
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
  type CommandReceipt,
  type CommandRepository,
  type GameSaveRepository,
  type RankingPeriod,
  type RankingSnapshot,
  type RankingSnapshotRow,
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

class MemoryAchievementLedger implements AchievementLedgerPort {
  constructor(private readonly state: State) {}
  record(entries: readonly ValidatedAchievement[]): Promise<void> {
    for (const entry of entries) {
      const key = achievementKey(entry);
      if (!this.state.achievements.has(key))
        this.state.achievements.set(key, clone(entry));
    }
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
      achievements: new MemoryAchievementLedger(state),
    };
  }
  /** Committed validated achievements (for the in-memory ranking store). */
  achievements(): readonly ValidatedAchievement[] {
    return [...this.state.achievements.values()].map(clone);
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

/** Ranking snapshots over the in-memory ledger (tests, local server). */
export class InMemoryRankingStore implements RankingStorePort {
  private readonly snapshots = new Map<string, RankingSnapshot>();
  constructor(private readonly ledger: () => readonly ValidatedAchievement[]) {}
  aggregate(scope: RankingScope, period?: string): Promise<RankingRow[]> {
    return Promise.resolve(aggregateRanking(this.ledger(), scope, period));
  }
  replaceSnapshot(
    scope: RankingScope,
    period: RankingPeriod,
    rows: readonly RankingRow[],
    generatedAt: string,
  ): Promise<void> {
    this.snapshots.set(`${scope}|${period}`, {
      scope,
      period,
      generatedAt,
      total: rows.length,
      rows: rows.map(clone),
    });
    return Promise.resolve();
  }
  snapshot(
    scope: RankingScope,
    period: RankingPeriod,
    limit: number,
  ): Promise<RankingSnapshot | undefined> {
    const stored = this.snapshots.get(`${scope}|${period}`);
    return Promise.resolve(
      stored === undefined
        ? undefined
        : { ...stored, rows: stored.rows.slice(0, limit).map(clone) },
    );
  }
  positionsOf(
    userId: string,
    snapshots: readonly { scope: RankingScope; period: RankingPeriod }[],
  ): Promise<readonly RankingSnapshotRow[]> {
    return Promise.resolve(
      snapshots.flatMap(({ scope, period }) => {
        const stored = this.snapshots.get(`${scope}|${period}`);
        const row = stored?.rows.find((item) => item.userId === userId);
        return stored === undefined || row === undefined
          ? []
          : [{ ...row, scope, period, generatedAt: stored.generatedAt }];
      }),
    );
  }
}
