import { z } from 'zod';
import { nonEmptyTextSchema, transportVersionSchema } from './primitives.js';

/**
 * Global coach ranking (docs/09 decision 10, ADR 0013): snapshots of the
 * leaderboards built only from server-validated achievements.
 */
export const rankingScopeSchema = z.enum(['global', 'rise', 'monthly']);
/** Real-world month (UTC) of the monthly leaderboard, `YYYY-MM`. */
export const rankingPeriodSchema = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);

export const rankingQuerySchema = z.strictObject({
  scope: rankingScopeSchema.default('global'),
  /** Monthly only; defaults to the current month. */
  period: rankingPeriodSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

const rankingRowSchema = z.strictObject({
  position: z.int().positive(),
  /** Coach name chosen in the game (best career of the user). */
  displayName: nonEmptyTextSchema,
  points: z.int().positive(),
});

export const rankingReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  rulesVersion: z.string().min(1),
  scope: rankingScopeSchema,
  /** `all` for global and rise, `YYYY-MM` for monthly. */
  period: z.union([z.literal('all'), rankingPeriodSchema]),
  /** Absent until the first snapshot of this scope and period. */
  generatedAt: z.iso.datetime({ offset: true }).optional(),
  /** Ranked coaches in the snapshot (rows may be truncated by `limit`). */
  total: z.int().min(0),
  rows: z.array(rankingRowSchema).max(100),
});

export const myRankingReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  rulesVersion: z.string().min(1),
  entries: z
    .array(
      z.strictObject({
        scope: rankingScopeSchema,
        period: z.union([z.literal('all'), rankingPeriodSchema]),
        /** Absent while the user has no validated points in the scope. */
        position: z.int().positive().optional(),
        points: z.int().positive().optional(),
        displayName: nonEmptyTextSchema.optional(),
        generatedAt: z.iso.datetime({ offset: true }).optional(),
      }),
    )
    .length(3),
});

export type RankingScopeName = z.infer<typeof rankingScopeSchema>;
export type RankingQuery = z.infer<typeof rankingQuerySchema>;
export type RankingReadModel = z.infer<typeof rankingReadModelSchema>;
export type MyRankingReadModel = z.infer<typeof myRankingReadModelSchema>;
