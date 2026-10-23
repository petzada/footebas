import { z } from 'zod';
import { coachAvatarSchema } from './coach.js';
import { nonEmptyTextSchema, transportVersionSchema } from './primitives.js';

/**
 * Coach ranking (docs/09 decision 10, ADR 0013, ADR 0017): live leaderboards
 * built only from server-validated achievements. Every account takes part,
 * with zero points until its first achievement.
 */
export const rankingScopeSchema = z.enum([
  'general',
  'titles',
  'best_season',
  'rise',
  'monthly',
]);
/** Scopes a query accepts: `global` is the former name of `general`. */
export const rankingQueryScopeSchema = z.enum([
  ...rankingScopeSchema.options,
  'global',
]);
/** Real-world month (UTC) of the monthly leaderboard, `YYYY-MM`. */
export const rankingPeriodSchema = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);

export const rankingQuerySchema = z.strictObject({
  scope: rankingQueryScopeSchema.default('general'),
  /** Monthly only; defaults to the current month. */
  period: rankingPeriodSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

/** Measure of a row: points, plus titles or season where they rank. */
const measureShape = {
  /**
   * Points of the scope: sum of points (general, monthly, and the tiebreak of
   * titles), rise points (rise) or points of the best season (best_season).
   */
  points: z.int().min(0),
  /** Titles of the career (titles scope only). */
  titles: z.int().min(0).optional(),
  /** Season of the career's best season (best_season scope only). */
  season: z.int().positive().optional(),
};

const rankingRowSchema = z.strictObject({
  position: z.int().positive(),
  /** Coach name chosen in the game (best career of the user). */
  displayName: nonEmptyTextSchema,
  /**
   * Coach avatar of that career: pixel avatar id or picture URL. Absent for
   * achievements validated before avatars were recorded.
   */
  avatar: coachAvatarSchema.optional(),
  ...measureShape,
});

export const rankingReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  rulesVersion: z.string().min(1),
  /** As asked (`global` stays `global` for older clients). */
  scope: rankingQueryScopeSchema,
  /** `all` for the all-time scopes, `YYYY-MM` for monthly. */
  period: z.union([z.literal('all'), rankingPeriodSchema]),
  /** Instant the board was read (it is live; edge cache up to 30 s). */
  generatedAt: z.iso.datetime({ offset: true }).optional(),
  /**
   * Participants: every account, listed or not (accounts without career
   * count in the positions but are not listed).
   */
  total: z.int().min(0),
  rows: z.array(rankingRowSchema).max(100),
});

export const myRankingReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  rulesVersion: z.string().min(1),
  entries: z
    .array(
      z.strictObject({
        /**
         * The five scopes, then `global`: a copy of `general` kept for web
         * clients cached before ADR 0017. Provisional: drop it next cycle.
         */
        scope: rankingQueryScopeSchema,
        period: z.union([z.literal('all'), rankingPeriodSchema]),
        /** Participants of the scope ("you are No. N of `total`"). */
        total: z.int().min(0),
        /** Absent only while the account is not in the ranking yet. */
        position: z.int().positive().optional(),
        ...measureShape,
        /** Coach name shown for the user (absent without career). */
        displayName: nonEmptyTextSchema.optional(),
        avatar: coachAvatarSchema.optional(),
      }),
    )
    .length(6),
});

export type RankingScopeName = z.infer<typeof rankingScopeSchema>;
export type RankingQuery = z.infer<typeof rankingQuerySchema>;
export type RankingReadModel = z.infer<typeof rankingReadModelSchema>;
export type MyRankingReadModel = z.infer<typeof myRankingReadModelSchema>;
