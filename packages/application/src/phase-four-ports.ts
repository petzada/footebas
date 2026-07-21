import type {
  BoardObjective,
  Club,
  ClubId,
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
import type { CanonicalValue } from '@footebas/domain';
import type { PhaseFourEvent, PhaseFourReceipt } from '@footebas/contracts';
import { checksumSnapshot } from '@footebas/database';
import {
  advanceCareerSeason,
  migrateCareerWorldSave,
  type CareerWorldConfig,
  type CareerWorldSave,
} from '@footebas/engine';

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
  /** Canonical engine state used only for whole-season orchestration. */
  readonly seasonWorld?: CareerWorldSave;
  /** Explicit boundary mapping from engine provenance ids to transport-safe ids. */
  readonly seasonIdentityMap?: Readonly<{
    worldManagerId: string;
    managerId: string;
    clubs: Readonly<Record<string, ClubId>>;
    players: Readonly<Record<string, Player['id']>>;
  }>;
}

export interface StoredPhaseFourReceipt {
  readonly commandFingerprint: string;
  readonly receipt: PhaseFourReceipt;
}

export interface PhaseFourStateRepository {
  load(careerId: string): Promise<PhaseFourState | undefined>;
  save(state: PhaseFourState, expectedVersion: number): Promise<void>;
  receipt(
    careerId: string,
    idempotencyKey: string,
  ): Promise<StoredPhaseFourReceipt | undefined>;
  saveReceipt(
    careerId: string,
    idempotencyKey: string,
    record: StoredPhaseFourReceipt,
  ): Promise<void>;
  receiptByCommandId(
    careerId: string,
    commandId: string,
  ): Promise<StoredPhaseFourReceipt | undefined>;
  commit(
    state: PhaseFourState,
    expectedVersion: number,
    idempotencyKey: string,
    record: StoredPhaseFourReceipt,
  ): Promise<void>;
  checksum(careerId: string): Promise<string | undefined>;
  withLock<T>(careerId: string, work: () => Promise<T>): Promise<T>;
}

export interface CareerSeasonAdvancePort {
  advance(save: CareerWorldSave): CareerWorldSave;
}

export class EngineCareerSeasonAdvanceAdapter implements CareerSeasonAdvancePort {
  public constructor(private readonly config?: CareerWorldConfig) {}

  public advance(save: CareerWorldSave): CareerWorldSave {
    const migrated = migrateCareerWorldSave(save);
    return Object.freeze({
      ...migrated,
      snapshot: advanceCareerSeason(migrated.snapshot, this.config),
    });
  }
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
const checksumState = (state: PhaseFourState): string =>
  checksumSnapshot(state as unknown as CanonicalValue);

export class InMemoryPhaseFourRepository implements PhaseFourStateRepository {
  private readonly states = new Map<string, PhaseFourState>();
  private readonly checksums = new Map<string, string>();
  private readonly receipts = new Map<string, StoredPhaseFourReceipt>();
  private readonly commandReceipts = new Map<string, StoredPhaseFourReceipt>();
  private readonly tails = new Map<string, Promise<void>>();

  public constructor(states: readonly PhaseFourState[] = []) {
    for (const state of states) {
      this.states.set(state.careerId, clone(state));
      this.checksums.set(state.careerId, checksumState(state));
    }
  }

  public load(careerId: string): Promise<PhaseFourState | undefined> {
    const value = this.states.get(careerId);
    if (
      value !== undefined &&
      checksumState(value) !== this.checksums.get(careerId)
    )
      throw new Error(`phase four state ${careerId} checksum mismatch`);
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
    this.checksums.set(state.careerId, checksumState(state));
    return Promise.resolve();
  }

  public receipt(
    careerId: string,
    idempotencyKey: string,
  ): Promise<StoredPhaseFourReceipt | undefined> {
    const value = this.receipts.get(`${careerId}:${idempotencyKey}`);
    return Promise.resolve(value === undefined ? undefined : clone(value));
  }

  public saveReceipt(
    careerId: string,
    idempotencyKey: string,
    record: StoredPhaseFourReceipt,
  ): Promise<void> {
    const key = `${careerId}:${idempotencyKey}`;
    const existing = this.receipts.get(key);
    if (
      existing !== undefined &&
      existing.commandFingerprint !== record.commandFingerprint
    )
      throw new Error('idempotency key was reused by another command');
    this.receipts.set(key, clone(record));
    this.commandReceipts.set(
      `${careerId}:${record.receipt.commandId}`,
      clone(record),
    );
    return Promise.resolve();
  }

  public receiptByCommandId(
    careerId: string,
    commandId: string,
  ): Promise<StoredPhaseFourReceipt | undefined> {
    const value = this.commandReceipts.get(`${careerId}:${commandId}`);
    return Promise.resolve(value === undefined ? undefined : clone(value));
  }

  public commit(
    state: PhaseFourState,
    expectedVersion: number,
    idempotencyKey: string,
    record: StoredPhaseFourReceipt,
  ): Promise<void> {
    const current = this.states.get(state.careerId);
    if (
      current?.version !== expectedVersion ||
      state.version !== expectedVersion + 1
    )
      throw new Error('phase four version conflict');
    const receiptKey = `${state.careerId}:${idempotencyKey}`;
    const commandKey = `${state.careerId}:${record.receipt.commandId}`;
    const existingByKey = this.receipts.get(receiptKey);
    const existingByCommand = this.commandReceipts.get(commandKey);
    if (
      (existingByKey !== undefined &&
        existingByKey.commandFingerprint !== record.commandFingerprint) ||
      (existingByCommand !== undefined &&
        existingByCommand.commandFingerprint !== record.commandFingerprint)
    )
      throw new Error('idempotency identity was reused by another command');
    const next = clone(state);
    const stored = clone(record);
    this.states.set(state.careerId, next);
    this.checksums.set(state.careerId, checksumState(next));
    this.receipts.set(receiptKey, stored);
    this.commandReceipts.set(commandKey, stored);
    return Promise.resolve();
  }

  public checksum(careerId: string): Promise<string | undefined> {
    return Promise.resolve(this.checksums.get(careerId));
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
