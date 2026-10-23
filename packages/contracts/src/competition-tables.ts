import { z } from 'zod';
import {
  entityIdSchema,
  gameDateSchema,
  instantSchema,
  nonEmptyTextSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';

/**
 * Tables and brackets of every competition of the running season
 * (`GET /v1/careers/:id/tables`): league and group tables with zones,
 * knockout ties with legs, aggregate and winner, the current phase and the
 * champion once (and only once) the competition is decided.
 */
const tableClubSchema = z.strictObject({
  id: entityIdSchema,
  name: nonEmptyTextSchema,
});

/** What a table position leads to (colour band of the row). */
export const tableZoneKindSchema = z.enum([
  'title',
  'continental',
  'continental_qualifying',
  'promotion',
  'relegation',
  'advance',
]);

const tableZoneSchema = z.strictObject({
  kind: tableZoneKindSchema,
  label: nonEmptyTextSchema,
  /** 1-based positions, inclusive. */
  from: z.int().positive(),
  to: z.int().positive(),
});

const tableRowSchema = z.strictObject({
  position: z.int().positive(),
  club: tableClubSchema,
  played: z.int().min(0),
  won: z.int().min(0),
  drawn: z.int().min(0),
  lost: z.int().min(0),
  goalsFor: z.int().min(0),
  goalsAgainst: z.int().min(0),
  goalDifference: z.int(),
  points: z.int().min(0),
  zone: tableZoneKindSchema.optional(),
});

const tableGroupSchema = z.strictObject({
  id: entityIdSchema,
  /** "Classificação" for a league stage, "Grupo A"… for groups. */
  name: nonEmptyTextSchema,
  rows: z.array(tableRowSchema).max(64),
  zones: z.array(tableZoneSchema).max(6),
});

const tieLegSchema = z.strictObject({
  fixtureId: entityIdSchema,
  leg: z.int().min(1).max(2),
  date: gameDateSchema,
  homeClubId: entityIdSchema,
  awayClubId: entityIdSchema,
  homeGoals: z.int().min(0).optional(),
  awayGoals: z.int().min(0).optional(),
});

const tieSchema = z.strictObject({
  id: entityIdSchema,
  /** Home club of the first leg. */
  home: tableClubSchema,
  away: tableClubSchema,
  legs: z.array(tieLegSchema).min(1).max(2),
  /** Goals over the legs played, `home` is the first-leg home club. */
  aggregate: z
    .strictObject({ home: z.int().min(0), away: z.int().min(0) })
    .optional(),
  winnerClubId: entityIdSchema.optional(),
  /** `tiebreak` when the aggregate was level (penalties or the draw). */
  decidedBy: z.enum(['goals', 'tiebreak']).optional(),
  status: z.enum(['scheduled', 'active', 'complete']),
});

const tableStageSchema = z.strictObject({
  id: entityIdSchema,
  name: nonEmptyTextSchema,
  kind: z.enum(['league', 'groups', 'knockout']),
  status: z.enum(['scheduled', 'active', 'complete']),
  /** League: one table; groups: one per group; knockout: empty. */
  groups: z.array(tableGroupSchema).max(16),
  /** Knockout: one per tie (empty until the round is drawn). */
  ties: z.array(tieSchema).max(64),
  /** Clubs that skip the current knockout round. */
  byes: z.array(tableClubSchema).max(64),
});

const competitionTableSchema = z.strictObject({
  competitionId: entityIdSchema,
  name: nonEmptyTextSchema,
  category: z.enum(['national_league', 'national_cup', 'state', 'continental']),
  status: z.enum(['scheduled', 'active', 'complete']),
  /** The managed club takes part in it this season. */
  managed: z.boolean(),
  currentStageId: entityIdSchema,
  /** Present only after the last match of the competition. */
  champion: z
    .strictObject({ club: tableClubSchema, decidedOn: gameDateSchema })
    .optional(),
  stages: z.array(tableStageSchema).min(1).max(12),
});

export const competitionTablesReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  projectedAt: instantSchema,
  season: z.int().min(2020).max(9999),
  /**
   * Table the Central summarises now: the managed club's state league while
   * it runs, otherwise its national division.
   */
  focusCompetitionId: entityIdSchema.optional(),
  competitions: z.array(competitionTableSchema).min(1).max(20),
});

export type CompetitionTablesReadModel = z.infer<
  typeof competitionTablesReadModelSchema
>;
export type CompetitionTable =
  CompetitionTablesReadModel['competitions'][number];
export type TableZoneKind = z.infer<typeof tableZoneKindSchema>;
