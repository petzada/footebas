import type {
  BoardObjective,
  Club,
  FinancialLedger,
  HistoryEvent,
  JobProposal,
  LoanRecord,
  ManagerCareer,
  Player,
  PlayerContract,
  PrestigeAchievement,
  Stadium,
  TransferOffer,
  YouthCandidate,
} from '@footebas/domain';
import type { PhaseFourEvent, PhaseFourReceipt } from '@footebas/contracts';

export interface PhaseFourState {
  readonly careerId: string;
  readonly userId: string;
  readonly version: number;
  readonly schemaVersion: string;
  readonly currentDate: string;
  readonly season: number;
  readonly manager: ManagerCareer;
  readonly clubs: readonly Club[];
  readonly players: readonly Player[];
  readonly contracts: readonly PlayerContract[];
  readonly offers: readonly TransferOffer[];
  readonly loans: readonly LoanRecord[];
  readonly ledger: FinancialLedger;
  readonly stadiums: readonly Stadium[];
  readonly youth: readonly YouthCandidate[];
  readonly objectives: readonly BoardObjective[];
  readonly jobProposals: readonly JobProposal[];
  readonly history: readonly HistoryEvent[];
  readonly achievements: readonly PrestigeAchievement[];
  readonly events: readonly PhaseFourEvent[];
  readonly archiveKeys: readonly string[];
}

export interface PhaseFourStateRepository {
  load(careerId: string): Promise<PhaseFourState | undefined>;
  save(state: PhaseFourState, expectedVersion: number): Promise<void>;
  receipt(
    careerId: string,
    idempotencyKey: string,
  ): Promise<PhaseFourReceipt | undefined>;
  saveReceipt(
    careerId: string,
    idempotencyKey: string,
    receipt: PhaseFourReceipt,
  ): Promise<void>;
  withLock<T>(careerId: string, work: () => Promise<T>): Promise<T>;
}

export interface ArchiveStoragePort {
  put(key: string, value: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | undefined>;
}

export interface SeededRandomPort {
  next(): number;
}
export interface RandomFactoryPort {
  fromSeed(seed: string): SeededRandomPort;
}

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryPhaseFourRepository implements PhaseFourStateRepository {
  private readonly states = new Map<string, PhaseFourState>();
  private readonly receipts = new Map<string, PhaseFourReceipt>();
  private readonly tails = new Map<string, Promise<void>>();

  public constructor(states: readonly PhaseFourState[] = []) {
    for (const state of states) this.states.set(state.careerId, clone(state));
  }

  public load(careerId: string): Promise<PhaseFourState | undefined> {
    const value = this.states.get(careerId);
    return Promise.resolve(value === undefined ? undefined : clone(value));
  }

  public save(state: PhaseFourState, expectedVersion: number): Promise<void> {
    const current = this.states.get(state.careerId);
    if (current === undefined)
      throw new Error(`phase four state ${state.careerId} not found`);
    if (
      current.version !== expectedVersion ||
      state.version !== expectedVersion + 1
    )
      throw new Error(
        `phase four version conflict: expected ${String(expectedVersion)}, found ${String(current.version)}`,
      );
    this.states.set(state.careerId, clone(state));
    return Promise.resolve();
  }

  public receipt(
    careerId: string,
    idempotencyKey: string,
  ): Promise<PhaseFourReceipt | undefined> {
    const value = this.receipts.get(`${careerId}:${idempotencyKey}`);
    return Promise.resolve(value === undefined ? undefined : clone(value));
  }

  public saveReceipt(
    careerId: string,
    idempotencyKey: string,
    receipt: PhaseFourReceipt,
  ): Promise<void> {
    const key = `${careerId}:${idempotencyKey}`;
    const existing = this.receipts.get(key);
    if (existing !== undefined && existing.commandId !== receipt.commandId)
      throw new Error('idempotency key was reused by another command');
    this.receipts.set(key, clone(receipt));
    return Promise.resolve();
  }

  public async withLock<T>(
    careerId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const prior = this.tails.get(careerId) ?? Promise.resolve();
    let release!: () => void;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = prior.then(() => turn);
    this.tails.set(careerId, tail);
    await prior;
    try {
      return await work();
    } finally {
      release();
      if (this.tails.get(careerId) === tail) this.tails.delete(careerId);
    }
  }
}

export class InMemoryArchiveStorage implements ArchiveStoragePort {
  private readonly values = new Map<string, Uint8Array>();
  public put(key: string, value: Uint8Array): Promise<void> {
    this.values.set(key, value.slice());
    return Promise.resolve();
  }
  public get(key: string): Promise<Uint8Array | undefined> {
    return Promise.resolve(this.values.get(key)?.slice());
  }
}

export class Mulberry32RandomFactory implements RandomFactoryPort {
  public fromSeed(seed: string): SeededRandomPort {
    let state = 0x811c9dc5;
    for (let index = 0; index < seed.length; index++) {
      state ^= seed.charCodeAt(index);
      state = Math.imul(state, 0x01000193);
    }
    return {
      next(): number {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
      },
    };
  }
}
