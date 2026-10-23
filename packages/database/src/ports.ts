import type {
  CanonicalValue,
  RankedAchievementType,
  RankingLedgerEntry,
  RankingRow,
  RankingScope,
} from '@footebas/domain';
import type { GameSave, NewGameSave, SaveUpdate } from './model.js';

export class SaveNotFoundError extends Error {}
export class SaveConflictError extends Error {}
export class SaveOwnershipError extends Error {}

/**
 * Archived saves (deleted by their owner) are invisible to `load`, `peek`,
 * `listByUser`, `update` and the counters; they only keep their id taken.
 */
export interface GameSaveRepository {
  create(input: NewGameSave): Promise<GameSave>;
  load(id: string, userId: string): Promise<GameSave | undefined>;
  /** Loads without an ownership check; callers must authorize the owner. */
  peek(id: string): Promise<GameSave | undefined>;
  /** Every active save owned by a user, oldest first. */
  listByUser(userId: string): Promise<readonly GameSave[]>;
  /**
   * Active saves of a user. Adapters that can race (Postgres) also lock the
   * user's career set until the transaction ends, so a count followed by a
   * create in the same transaction cannot exceed a limit.
   */
  countActiveByUser(userId: string): Promise<number>;
  /** Distinct users with at least one active save. */
  countActiveUsers(): Promise<number>;
  /** Soft delete by the owner: hides the save and frees its slot. */
  archive(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<GameSave>;
  /** Hard delete by the owner, with its command receipts. */
  delete(id: string, userId: string): Promise<void>;
  update(
    id: string,
    userId: string,
    expectedVersion: number,
    update: SaveUpdate,
  ): Promise<GameSave>;
}

export interface CommandReceipt<T extends CanonicalValue = CanonicalValue> {
  readonly careerId: string;
  readonly commandId: string;
  readonly response: T;
  readonly createdAt: string;
}

export interface CommandRepository {
  load<T extends CanonicalValue>(
    careerId: string,
    commandId: string,
  ): Promise<CommandReceipt<T> | undefined>;
  save<T extends CanonicalValue>(receipt: CommandReceipt<T>): Promise<void>;
}

/** A server-validated achievement of one career (ADR 0013). */
export interface ValidatedAchievement extends RankingLedgerEntry {
  readonly type: RankedAchievementType;
  readonly clubId: string;
  readonly clubReputation: number;
  /** In-game date of the achievement (`YYYY-MM-DD`). */
  readonly gameDate: string;
  readonly rulesVersion: string;
}

/**
 * Ledger of validated achievements. It is written inside the career's
 * transaction, so an achievement exists only if the save that produced it
 * was committed. Recording is idempotent per career, type, season and
 * competition.
 */
export interface AchievementLedgerPort {
  record(entries: readonly ValidatedAchievement[]): Promise<void>;
  /** Every achievement of a career, oldest first. */
  listByCareer(careerId: string): Promise<readonly ValidatedAchievement[]>;
}

export interface TransactionContext {
  readonly saves: GameSaveRepository;
  readonly commands: CommandRepository;
  readonly achievements: AchievementLedgerPort;
}

/** `all` for the all-time scopes, `YYYY-MM` for the monthly one. */
export type RankingPeriod = string;

export interface RankingSnapshotRow extends RankingRow {
  readonly scope: RankingScope;
  readonly period: RankingPeriod;
  readonly generatedAt: string;
}

export interface RankingSnapshot {
  readonly scope: RankingScope;
  readonly period: RankingPeriod;
  readonly generatedAt: string;
  readonly total: number;
  readonly rows: readonly RankingRow[];
}

/** Snapshots of the leaderboards, served with cache (ADR 0005, ADR 0013). */
export interface RankingStorePort {
  /** Ranked rows (best career per user) computed from the ledger. */
  aggregate(scope: RankingScope, period?: string): Promise<RankingRow[]>;
  /** Replaces the snapshot of a scope and period atomically. */
  replaceSnapshot(
    scope: RankingScope,
    period: RankingPeriod,
    rows: readonly RankingRow[],
    generatedAt: string,
  ): Promise<void>;
  snapshot(
    scope: RankingScope,
    period: RankingPeriod,
    limit: number,
  ): Promise<RankingSnapshot | undefined>;
  /** The user's row in the given snapshots, when ranked. */
  positionsOf(
    userId: string,
    snapshots: readonly { scope: RankingScope; period: RankingPeriod }[],
  ): Promise<readonly RankingSnapshotRow[]>;
}

/**
 * Durable copy of the career saves kept by the career Durable Object
 * (ADR 0014). Each write is a single conditional statement, idempotent when
 * retried with the same save, so the object can persist after every command
 * without a lock transaction.
 */
export interface CareerSaveStore {
  /** Active save in its stored form, without ownership check. */
  peek(id: string): Promise<GameSave | undefined>;
  /** Version of the active save (cheap freshness check). */
  versionOf(id: string): Promise<number | undefined>;
  /**
   * Stores `save` (already at `expectedVersion + 1`, with the checksum of its
   * stored snapshot) when the stored version is `expectedVersion`. A retry of
   * the same write succeeds without changing anything; any other mismatch is
   * a `SaveConflictError`. Achievements commit atomically with the save.
   */
  commit(
    save: GameSave,
    expectedVersion: number,
    achievements: readonly ValidatedAchievement[],
  ): Promise<void>;
  archive(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<GameSave>;
  delete(id: string, userId: string): Promise<void>;
  listAchievements(careerId: string): Promise<readonly ValidatedAchievement[]>;
}

export interface UnitOfWork {
  withCareerLock<T>(
    careerId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T>;
  executeIdempotent<T extends CanonicalValue>(
    careerId: string,
    commandId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T>;
}
