// Unit of work of the career Durable Object (ADR 0014): the hydrated career
// stays in memory, commands of the career run one at a time, idempotency
// receipts live in the object's storage, and every committed change is
// written to Postgres (conditional, idempotent) and to the object's storage.
import {
  CAREER_SAVE_SCHEMA,
  HYDRATED_SAVES,
  dehydrateCareer,
  hydrateStoredSave,
  type CareerContentPort,
  type CareerSnapshot,
  type HydratedUnitOfWork,
} from '@footebas/application';
import {
  SaveConflictError,
  SaveNotFoundError,
  SaveOwnershipError,
  assertRequiredMetadata,
  checksumSnapshot,
  type CareerSaveStore,
  type Clock,
  type CommandReceipt,
  type GameSave,
  type GameSaveRepository,
  type TransactionContext,
  type ValidatedAchievement,
} from '@footebas/database';

type CanonicalValue = GameSave['snapshot'];

/** Subset of `DurableObjectStorage` (asynchronous KV API) used here. */
export interface CareerObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
  delete(keys: string[]): Promise<number>;
}

export interface DurableCareerDependencies {
  readonly storage: CareerObjectStorage;
  /** Durable copy in Postgres (created per request by the object). */
  readonly store: () => CareerSaveStore;
  readonly content: CareerContentPort;
  readonly clock: Clock;
}

const SAVE_KEY = 'save';
const CAREER_KEY = 'career';
const ARCHIVED_KEY = 'archived';
const receiptKey = (commandId: string) => `receipt:${commandId}`;

/** Read paths share the in-memory aggregate: freezing makes a mutation loud. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

const unsupported = (operation: string) =>
  Promise.reject(
    new Error(`${operation} is not available in the career Durable Object`),
  );

class CareerTransaction {
  public staged: GameSave | undefined;
  public archived = false;
  public deleted = false;
  /** Postgres changed during the work (archive/delete). */
  public touchedDurable = false;
  public readonly receipts = new Map<string, CommandReceipt>();
  public readonly achievements: ValidatedAchievement[] = [];

  public constructor(
    private readonly careerId: string,
    public readonly base: GameSave | undefined,
    private readonly deps: DurableCareerDependencies,
  ) {}

  private view(id: string): GameSave | undefined {
    if (id !== this.careerId || this.archived || this.deleted) return undefined;
    return this.staged ?? this.base;
  }

  private owned(id: string, userId: string): GameSave {
    const save = this.view(id);
    if (save === undefined) throw new SaveNotFoundError(`save ${id} not found`);
    if (save.userId !== userId)
      throw new SaveOwnershipError(`save ${id} does not belong to user`);
    return save;
  }

  private expect(save: GameSave, expectedVersion: number): void {
    if (save.version !== expectedVersion)
      throw new SaveConflictError(
        `expected version ${String(expectedVersion)}, found ${String(save.version)}`,
      );
  }

  public context(): TransactionContext {
    const saves: GameSaveRepository = {
      create: () => unsupported('creating a career'),
      load: (id, userId) => {
        const save = this.view(id);
        if (save !== undefined && save.userId !== userId)
          return Promise.reject(
            new SaveOwnershipError(`save ${id} does not belong to user`),
          );
        return Promise.resolve(save);
      },
      peek: (id) => Promise.resolve(this.view(id)),
      listByUser: () => unsupported('listing careers'),
      countActiveByUser: () => unsupported('counting careers'),
      countActiveUsers: () => unsupported('counting users'),
      archive: async (id, userId, expectedVersion) => {
        this.expect(this.owned(id, userId), expectedVersion);
        const archived = await this.deps
          .store()
          .archive(id, userId, expectedVersion);
        this.archived = true;
        this.touchedDurable = true;
        return archived;
      },
      delete: async (id, userId) => {
        this.owned(id, userId);
        await this.deps.store().delete(id, userId);
        this.deleted = true;
        this.touchedDurable = true;
      },
      update: (id, userId, expectedVersion, update) => {
        try {
          const save = this.owned(id, userId);
          this.expect(save, expectedVersion);
          assertRequiredMetadata(update.seed, update.versions);
          this.staged = {
            ...save,
            snapshot: update.snapshot,
            seed: update.seed,
            versions: update.versions,
            version: save.version + 1,
            updatedAt: this.deps.clock.now().toISOString(),
          };
          return Promise.resolve(this.staged);
        } catch (error) {
          return Promise.reject(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      },
    };
    return {
      saves,
      commands: {
        load: async <T extends CanonicalValue>(
          careerId: string,
          commandId: string,
        ) => {
          if (careerId !== this.careerId) return undefined;
          const staged = this.receipts.get(commandId);
          if (staged !== undefined) return staged as CommandReceipt<T>;
          return this.deps.storage.get<CommandReceipt<T>>(
            receiptKey(commandId),
          );
        },
        save: <T extends CanonicalValue>(receipt: CommandReceipt<T>) => {
          if (receipt.careerId !== this.careerId)
            return unsupported('receipts of another career');
          this.receipts.set(receipt.commandId, receipt);
          return Promise.resolve();
        },
      },
      achievements: {
        record: (entries) => {
          this.achievements.push(...entries);
          return Promise.resolve();
        },
        listByCareer: (careerId) =>
          this.deps.store().listAchievements(careerId),
      },
    };
  }
}

/**
 * One career per Durable Object. Commands are serialized by a promise chain
 * (I/O to Postgres would otherwise let requests interleave); reads see the
 * committed in-memory aggregate.
 */
export class DurableCareerUnitOfWork implements HydratedUnitOfWork {
  public readonly [HYDRATED_SAVES] = true as const;
  private current: GameSave | undefined;
  private loaded = false;
  private careerId: string | undefined;
  private tail: Promise<unknown> = Promise.resolve();

  public constructor(private readonly deps: DurableCareerDependencies) {}

  public withCareerLock<T>(
    careerId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.serialize(() => this.run(careerId, undefined, work));
  }

  public executeIdempotent<T extends CanonicalValue>(
    careerId: string,
    commandId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.serialize(() => this.run(careerId, commandId, work));
  }

  /** Forgets the in-memory aggregate; the next access reloads it. */
  public reset(): void {
    this.loaded = false;
    this.current = undefined;
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const turn = this.tail.then(task, task);
    this.tail = turn.catch(() => undefined);
    return turn;
  }

  private async bind(careerId: string): Promise<void> {
    if (this.careerId === undefined) {
      const bound = await this.deps.storage.get<string>(CAREER_KEY);
      if (bound === undefined)
        await this.deps.storage.put({ [CAREER_KEY]: careerId });
      this.careerId = bound ?? careerId;
    }
    if (this.careerId !== careerId)
      throw new Error(
        `career object ${this.careerId} cannot serve career ${careerId}`,
      );
  }

  /**
   * Local storage first; Postgres decides whether it is current (a cheap
   * version check on cold start) and supplies the save when it is not.
   */
  private async ensureLoaded(careerId: string): Promise<void> {
    if (this.loaded) return;
    if ((await this.deps.storage.get<boolean>(ARCHIVED_KEY)) === true) {
      this.current = undefined;
      this.loaded = true;
      return;
    }
    const store = this.deps.store();
    const local = await this.deps.storage.get<GameSave>(SAVE_KEY);
    const durable = await store.versionOf(careerId);
    let stored: GameSave | undefined;
    if (durable === undefined) stored = undefined;
    else if (local?.version === durable) stored = local;
    else {
      stored = await store.peek(careerId);
      if (stored !== undefined)
        await this.deps.storage.put({ [SAVE_KEY]: stored });
    }
    this.current =
      stored === undefined
        ? undefined
        : deepFreeze(hydrateStoredSave(stored, this.deps.content.load()));
    this.loaded = true;
  }

  private async run<T>(
    careerId: string,
    commandId: string | undefined,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    await this.bind(careerId);
    await this.ensureLoaded(careerId);
    if (commandId !== undefined) {
      const receipt = await this.deps.storage.get<CommandReceipt>(
        receiptKey(commandId),
      );
      if (receipt !== undefined) return receipt.response as T;
    }
    const tx = new CareerTransaction(careerId, this.current, this.deps);
    let result: T;
    try {
      result = await work(tx.context());
      if (commandId !== undefined)
        tx.receipts.set(commandId, {
          careerId,
          commandId,
          response: result as CanonicalValue,
          createdAt: this.deps.clock.now().toISOString(),
        });
      await this.commit(tx);
    } catch (error) {
      if (tx.touchedDurable || error instanceof SaveConflictError) this.reset();
      throw error;
    }
    return result;
  }

  private async commit(tx: CareerTransaction): Promise<void> {
    const receipts: Record<string, unknown> = {};
    for (const receipt of tx.receipts.values())
      receipts[receiptKey(receipt.commandId)] = receipt;
    if (tx.archived || tx.deleted) {
      await this.deps.storage.delete([SAVE_KEY]);
      await this.deps.storage.put({ ...receipts, [ARCHIVED_KEY]: true });
      this.current = undefined;
      return;
    }
    const staged = tx.staged;
    const base = tx.base;
    if (staged === undefined || base === undefined) {
      if (tx.achievements.length > 0)
        throw new Error('achievements need the save that produced them');
      if (tx.receipts.size > 0) await this.deps.storage.put(receipts);
      return;
    }
    const snapshot =
      staged.versions.schema === CAREER_SAVE_SCHEMA
        ? dehydrateCareer(
            this.deps.content.load(),
            staged.snapshot as unknown as CareerSnapshot,
          )
        : staged.snapshot;
    const stored: GameSave = {
      ...staged,
      snapshot,
      checksum: checksumSnapshot(snapshot),
    };
    // Postgres first: a failed durable write leaves the object unchanged.
    await this.deps.store().commit(stored, base.version, tx.achievements);
    await this.deps.storage.put({ ...receipts, [SAVE_KEY]: stored });
    this.current = deepFreeze({ ...staged, checksum: stored.checksum });
  }
}
