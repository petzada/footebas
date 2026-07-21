import { z } from 'zod';
import {
  entityIdSchema,
  gameDateSchema,
  moneySchema,
  nonEmptyTextSchema,
  percentageSchema,
  positionSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';

const readBase = {
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  projectedAt: z.iso.datetime({ offset: true }),
} as const;
const clubSummarySchema = z.strictObject({
  id: entityIdSchema,
  name: nonEmptyTextSchema,
  shortName: z.string().trim().min(1).max(24),
});
const scoreSchema = z.strictObject({
  home: z.int().min(0).max(99),
  away: z.int().min(0).max(99),
});
export const homeReadModelSchema = z.strictObject({
  ...readBase,
  managerName: nonEmptyTextSchema,
  club: clubSummarySchema.optional(),
  currentDate: gameDateSchema,
  season: z.int().positive(),
  balance: moneySchema.optional(),
  nextFixtureId: entityIdSchema.optional(),
  pendingActions: z.array(z.string().min(1).max(120)).max(20),
});
const squadPlayerSchema = z.strictObject({
  id: entityIdSchema,
  name: nonEmptyTextSchema,
  age: z.int().min(15).max(60),
  position: positionSchema,
  strength: z.number().min(1).max(100),
  condition: percentageSchema,
  morale: percentageSchema,
  injuryRounds: z.int().min(0),
  suspensionRounds: z.int().min(0),
});
export const squadReadModelSchema = z.strictObject({
  ...readBase,
  club: clubSummarySchema,
  players: z.array(squadPlayerSchema).max(100),
  lineupPlayerIds: z.array(entityIdSchema).max(23),
});
export const nextMatchReadModelSchema = z.strictObject({
  ...readBase,
  fixtureId: entityIdSchema,
  competition: nonEmptyTextSchema,
  round: z.int().positive(),
  date: gameDateSchema,
  homeClub: clubSummarySchema,
  awayClub: clubSummarySchema,
  status: z.enum(['scheduled', 'ready', 'running']),
});
const standingRowSchema = z.strictObject({
  position: z.int().positive(),
  club: clubSummarySchema,
  played: z.int().min(0),
  won: z.int().min(0),
  drawn: z.int().min(0),
  lost: z.int().min(0),
  goalsFor: z.int().min(0),
  goalsAgainst: z.int().min(0),
  goalDifference: z.int(),
  points: z.int().min(0),
});
export const standingsReadModelSchema = z.strictObject({
  ...readBase,
  competitionId: entityIdSchema,
  competition: nonEmptyTextSchema,
  rows: z.array(standingRowSchema).min(2).max(100),
});
const timelineEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('chance'),
    minute: z.int().min(0).max(130),
    side: z.enum(['home', 'away']),
    xg: z.number().min(0).max(1),
  }),
  z.strictObject({
    type: z.literal('goal'),
    minute: z.int().min(0).max(130),
    side: z.enum(['home', 'away']),
    playerId: entityIdSchema,
  }),
  z.strictObject({
    type: z.literal('card'),
    minute: z.int().min(0).max(130),
    side: z.enum(['home', 'away']),
    playerId: entityIdSchema,
    card: z.enum(['yellow', 'red']),
  }),
]);
export const postMatchReadModelSchema = z.strictObject({
  ...readBase,
  matchId: entityIdSchema,
  fixtureId: entityIdSchema,
  homeClub: clubSummarySchema,
  awayClub: clubSummarySchema,
  score: scoreSchema,
  timeline: z.array(timelineEventSchema).max(500),
  tableUpdated: z.boolean(),
});
export type HomeReadModel = z.infer<typeof homeReadModelSchema>;
export type SquadReadModel = z.infer<typeof squadReadModelSchema>;
export type NextMatchReadModel = z.infer<typeof nextMatchReadModelSchema>;
export type StandingsReadModel = z.infer<typeof standingsReadModelSchema>;
export type PostMatchReadModel = z.infer<typeof postMatchReadModelSchema>;
