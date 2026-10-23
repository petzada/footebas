import { z } from 'zod';
import {
  entityIdSchema,
  gameDateSchema,
  nonEmptyTextSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';

/**
 * Season screen (Temporada, docs/09): read-only statistics derived from the
 * career save. Scorers, assists and ratings come from the match engine's
 * player performances; nothing is estimated.
 */
const clubRefSchema = z.strictObject({
  id: entityIdSchema,
  name: nonEmptyTextSchema,
});
const leaderSchema = z.strictObject({
  playerId: entityIdSchema,
  playerName: nonEmptyTextSchema,
  club: clubRefSchema.optional(),
  appearances: z.int().min(0),
  value: z.number().min(0),
});
const clubRecordSchema = z.strictObject({
  club: clubRefSchema,
  played: z.int().min(0),
  won: z.int().min(0),
  drawn: z.int().min(0),
  lost: z.int().min(0),
  goalsFor: z.int().min(0),
  goalsAgainst: z.int().min(0),
  goalDifference: z.int(),
});
const positionsSchema = z.strictObject({
  competitionId: entityIdSchema,
  competition: nonEmptyTextSchema,
  rounds: z
    .array(
      z.strictObject({
        round: z.int().positive(),
        date: gameDateSchema,
        position: z.int().positive(),
      }),
    )
    .max(80),
});
const championSchema = z.strictObject({
  competitionId: entityIdSchema,
  competition: nonEmptyTextSchema,
  club: clubRefSchema,
});
const awardSchema = z.strictObject({
  kind: z.enum(['top_scorer', 'top_assists', 'best_rating']),
  playerId: entityIdSchema,
  playerName: nonEmptyTextSchema,
  club: clubRefSchema.optional(),
  value: z.number().min(0),
});

export const careerSeasonReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  projectedAt: z.iso.datetime({ offset: true }),
  rulesVersion: z.string().min(1),
  season: z.int().positive(),
  year: z.int().positive(),
  currentDate: gameDateSchema,
  /**
   * `complete` when every match of the season was recorded; `partial` for
   * saves that started recording mid-season (created before this version).
   */
  coverage: z.enum(['complete', 'partial']),
  /** Managed club across every competition of the season. */
  club: clubRecordSchema.optional(),
  topScorers: z.array(leaderSchema).max(10),
  topAssists: z.array(leaderSchema).max(10),
  /** Average rating; only players with the minimum appearances. */
  topRatings: z.array(leaderSchema).max(10),
  minimumRatedAppearances: z.int().min(1),
  /** Managed club position after each of its league rounds. */
  positions: z.array(positionsSchema).max(8),
  /** Champions of competitions already decided this season. */
  champions: z.array(championSchema).max(20),
  /** Current leaders, final once the season closes. */
  awards: z.array(awardSchema).max(3),
  history: z
    .array(
      z.strictObject({
        season: z.int().positive(),
        year: z.int().positive(),
        club: clubRecordSchema.optional(),
        champions: z.array(championSchema).max(20),
        awards: z.array(awardSchema).max(3),
        topScorers: z.array(leaderSchema).max(5),
        positions: z.array(positionsSchema).max(8),
      }),
    )
    .max(30),
});

export type CareerSeasonReadModel = z.infer<typeof careerSeasonReadModelSchema>;
