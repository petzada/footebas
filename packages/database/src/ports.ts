import type { CanonicalValue } from '@footebas/domain';
import type { GameSave, NewGameSave, SaveUpdate } from './model.js';

export class SaveNotFoundError extends Error {}
export class SaveConflictError extends Error {}
export class SaveOwnershipError extends Error {}

export interface GameSaveRepository {
  create(input: NewGameSave): Promise<GameSave>;
  load(id: string, userId: string): Promise<GameSave | undefined>;
  /** Loads without an ownership check; callers must authorize the owner. */
  peek(id: string): Promise<GameSave | undefined>;
  /** Every save owned by a user, oldest first. */
  listByUser(userId: string): Promise<readonly GameSave[]>;
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

export interface TransactionContext {
  readonly saves: GameSaveRepository;
  readonly commands: CommandRepository;
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
