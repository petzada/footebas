import { createHash } from 'node:crypto';
import { canonicalJson, type CanonicalValue } from '@footebas/domain';

export interface Clock {
  now(): Date;
}
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export interface SaveVersions {
  readonly engine: string;
  readonly rules: string;
  readonly content: string;
  readonly schema: string;
}

export interface GameSave {
  readonly id: string;
  readonly userId: string;
  readonly snapshot: CanonicalValue;
  readonly checksum: string;
  readonly seed: string;
  readonly versions: SaveVersions;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Set when the owner deleted the career; archived saves are invisible. */
  readonly archivedAt?: string;
}

export type NewGameSave = Omit<
  GameSave,
  'checksum' | 'version' | 'createdAt' | 'updatedAt' | 'archivedAt'
>;
export type SaveUpdate = Pick<GameSave, 'snapshot' | 'seed' | 'versions'>;

export function checksumSnapshot(snapshot: CanonicalValue): string {
  return createHash('sha256')
    .update(canonicalJson(snapshot), 'utf8')
    .digest('hex');
}

export function assertRequiredMetadata(
  seed: string,
  versions: SaveVersions,
): void {
  const values = [
    seed,
    versions.engine,
    versions.rules,
    versions.content,
    versions.schema,
  ];
  if (values.some((value) => value.trim().length === 0))
    throw new Error('seed and all save versions are required');
}

export function verifyChecksum(save: GameSave): boolean {
  return checksumSnapshot(save.snapshot) === save.checksum;
}
