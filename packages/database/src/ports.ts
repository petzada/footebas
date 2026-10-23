import type {
  CanonicalValue,
  RankedAchievementType,
  RankingLedgerEntry,
  RankingScope,
  RankingStanding,
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

/** The career that names a ranking account while it has no points. */
export interface RankingEnrollment {
  readonly careerId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly avatar?: string;
}

/**
 * Ledger of validated achievements. It is written inside the career's
 * transaction, so an achievement exists only if the save that produced it
 * was committed. Recording is idempotent per career, type, season and
 * competition, and updates the user's ranking totals in the same
 * transaction (ADR 0017).
 */
export interface AchievementLedgerPort {
  record(entries: readonly ValidatedAchievement[]): Promise<void>;
  /**
   * Links the user's ranking account to their first career (CreateCareer):
   * from then on the account is listed, with zero, under the coach name.
   * Later careers never replace the first one.
   */
  enroll(career: RankingEnrollment): Promise<void>;
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

/** Listed standings of a scope and period, read live (ADR 0017). */
export interface RankingBoard {
  readonly scope: RankingScope;
  readonly period: RankingPeriod;
  /** Every ranking account (participants), listed or not. */
  readonly total: number;
  /** Accounts with a career only, in rank order (up to `limit`). */
  readonly rows: readonly (RankingStanding & {
    readonly careerId: string;
    readonly displayName: string;
  })[];
}

/** The user's place in one scope and period, computed on read. */
export interface RankingPosition extends Omit<RankingStanding, 'position'> {
  readonly scope: RankingScope;
  readonly period: RankingPeriod;
  readonly total: number;
  /** Absent when the user has no ranking account. */
  readonly position?: number;
}

/** Leaderboards over the live totals (ADR 0017). */
export interface RankingStorePort {
  board(
    scope: RankingScope,
    period: RankingPeriod,
    limit: number,
  ): Promise<RankingBoard>;
  positionsOf(
    userId: string,
    targets: readonly { scope: RankingScope; period: RankingPeriod }[],
  ): Promise<readonly RankingPosition[]>;
  /**
   * Freezes the final standings of a past month in the monthly history.
   * Returns the rows written, or `undefined` when it was already closed.
   */
  closeMonth(period: string, closedAt: string): Promise<number | undefined>;
  /**
   * Rebuilds the totals of up to `limit` accounts flagged by the migration
   * (achievements validated before ADR 0017). Returns how many it rebuilt.
   */
  refreshPending(limit: number): Promise<number>;
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

/** Hints for `executeIdempotent`; adapters may ignore them. */
export interface IdempotentOptions {
  /**
   * The work counts this user's active careers (`countActiveByUser`, plan
   * limit). Adapters that lock (Postgres) take the user's career-set lock
   * together with the career lock and read the count with the receipt, so
   * the check costs two round trips instead of four.
   */
  readonly countsCareersOf?: string;
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
    options?: IdempotentOptions,
  ): Promise<T>;
}
