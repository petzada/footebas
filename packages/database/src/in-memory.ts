import { canonicalJson, type CanonicalValue } from '@footebas/domain';
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
  type CommandReceipt,
  type CommandRepository,
  type GameSaveRepository,
  type TransactionContext,
  type UnitOfWork,
} from './ports.js';

const clone = <T>(value: T): T => structuredClone(value);
interface State {
  saves: Map<string, GameSave>;
  commands: Map<string, CommandReceipt>;
}

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
  load(id: string, userId: string): Promise<GameSave | undefined> {
    const save = this.state.saves.get(id);
    if (!save) return Promise.resolve(undefined);
    if (save.userId !== userId)
      throw new SaveOwnershipError(`save ${id} does not belong to user`);
    return Promise.resolve(clone(save));
  }
  peek(id: string): Promise<GameSave | undefined> {
    const save = this.state.saves.get(id);
    return Promise.resolve(save === undefined ? undefined : clone(save));
  }
  update(
    id: string,
    userId: string,
    expectedVersion: number,
    update: SaveUpdate,
  ): Promise<GameSave> {
    assertRequiredMetadata(update.seed, update.versions);
    const current = this.state.saves.get(id);
    if (!current) throw new SaveNotFoundError(`save ${id} not found`);
    if (current.userId !== userId)
      throw new SaveOwnershipError(`save ${id} does not belong to user`);
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

export class InMemoryUnitOfWork implements UnitOfWork {
  private state: State = { saves: new Map(), commands: new Map() };
  private readonly tails = new Map<string, Promise<void>>();
  constructor(private readonly clock: Clock) {}
  repositories(): TransactionContext {
    return this.context(this.state);
  }
  private context(state: State): TransactionContext {
    return {
      saves: new MemorySaveRepository(state, this.clock),
      commands: new MemoryCommandRepository(state),
    };
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
