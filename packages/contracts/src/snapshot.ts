import { z } from 'zod';
import {
  checksumSchema,
  entityIdSchema,
  gameDateSchema,
  instantSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';

export const snapshotVersionsSchema = z.strictObject({
  schema: z.string().min(1).max(64),
  engine: z.string().min(1).max(64),
  rules: z.string().min(1).max(64),
  content: z.string().min(1).max(64),
  prng: z.string().min(1).max(64),
});
export const snapshotMetadataSchema = z.strictObject({
  version: transportVersionSchema,
  snapshotId: entityIdSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  gameDate: gameDateSchema,
  seed: z.string().min(1).max(256),
  versions: snapshotVersionsSchema,
  checksum: checksumSchema,
  createdAt: instantSchema,
});
export type SnapshotVersions = z.infer<typeof snapshotVersionsSchema>;
export type SnapshotMetadata = z.infer<typeof snapshotMetadataSchema>;
