import { z } from 'zod';
import {
  commandIdSchema,
  entityIdSchema,
  gameDateSchema,
  idempotencyKeySchema,
  instantSchema,
  moneySchema,
  nonEmptyTextSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';

const envelope = {
  version: transportVersionSchema,
  commandId: commandIdSchema,
  idempotencyKey: idempotencyKeySchema,
  expectedVersion: versionSchema,
  careerId: entityIdSchema,
} as const;

export const publishSeasonCalendarCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('PublishSeasonCalendar'),
  payload: z.strictObject({ season: z.int().min(2020).max(9999) }),
});

export const generateNextSeasonCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('GenerateNextSeason'),
  payload: z.strictObject({
    completedSeason: z.int().min(2020).max(9998),
  }),
});

export const phaseFiveCommandSchema = z.discriminatedUnion('type', [
  publishSeasonCalendarCommandSchema,
  generateNextSeasonCommandSchema,
]);

const phaseKindSchema = z.enum([
  'league',
  'single_round_robin',
  'qualifying',
  'groups',
  'knockout',
]);

const competitionPhaseSchema = z
  .strictObject({
    id: entityIdSchema,
    name: nonEmptyTextSchema,
    kind: phaseKindSchema,
    status: z.enum(['scheduled', 'active', 'complete']),
    startsOn: gameDateSchema,
    endsOn: gameDateSchema,
    participantCount: z.int().positive(),
  })
  .superRefine((phase, context) => {
    if (phase.startsOn > phase.endsOn)
      context.addIssue({
        code: 'custom',
        path: ['endsOn'],
        message: 'Competition phase cannot end before it starts',
      });
  });

const qualificationSchema = z
  .strictObject({
    label: nonEmptyTextSchema,
    places: z.int().positive(),
    destinationCompetitionId: entityIdSchema.optional(),
    destinationDivisionId: entityIdSchema.optional(),
  })
  .superRefine((qualification, context) => {
    const destinations = [
      qualification.destinationCompetitionId,
      qualification.destinationDivisionId,
    ].filter((value) => value !== undefined);
    if (destinations.length !== 1)
      context.addIssue({
        code: 'custom',
        message: 'Qualification must own exactly one destination',
      });
  });

const competitionSchema = z.strictObject({
  id: entityIdSchema,
  name: nonEmptyTextSchema,
  category: z.enum(['national_league', 'national_cup', 'state', 'continental']),
  tier: z.int().positive().optional(),
  formatLabel: nonEmptyTextSchema,
  currentPhase: nonEmptyTextSchema,
  status: z.enum(['scheduled', 'active', 'complete']),
  participantCount: z.int().positive(),
  phases: z.array(competitionPhaseSchema).min(1),
  qualifications: z.array(qualificationSchema),
  prize: moneySchema,
  prestige: z.int().nonnegative(),
});

export const competitionPyramidReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  projectedAt: instantSchema,
  season: z.int().min(2020).max(9999),
  divisions: z.array(competitionSchema).length(3),
  cups: z.array(competitionSchema).min(3),
});

const calendarEntrySchema = z.strictObject({
  id: entityIdSchema,
  competitionId: entityIdSchema,
  competitionName: nonEmptyTextSchema,
  phaseName: nonEmptyTextSchema,
  date: gameDateSchema,
  label: nonEmptyTextSchema,
  status: z.enum(['reserved', 'scheduled', 'played']),
  homeClubId: entityIdSchema.optional(),
  awayClubId: entityIdSchema.optional(),
});

export const competitionCalendarReadModelSchema = z
  .strictObject({
    version: transportVersionSchema,
    careerId: entityIdSchema,
    aggregateVersion: versionSchema,
    projectedAt: instantSchema,
    season: z.int().min(2020).max(9999),
    status: z.enum(['draft', 'validated', 'published']),
    validation: z.strictObject({
      valid: z.boolean(),
      checkedAt: instantSchema,
      conflictCount: z.int().nonnegative(),
    }),
    entries: z.array(calendarEntrySchema),
  })
  .superRefine((calendar, context) => {
    if (calendar.validation.valid && calendar.validation.conflictCount !== 0)
      context.addIssue({
        code: 'custom',
        path: ['validation', 'conflictCount'],
        message: 'Calendar validity and conflict count disagree',
      });
    if (calendar.status !== 'draft' && !calendar.validation.valid)
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Only a valid calendar can be validated or published',
      });
  });

const movementSchema = z.strictObject({
  clubId: entityIdSchema,
  clubName: nonEmptyTextSchema,
  fromDivisionId: entityIdSchema,
  toDivisionId: entityIdSchema,
  kind: z.enum(['promoted', 'relegated']),
});

export const nextSeasonTransitionReadModelSchema = z
  .strictObject({
    version: transportVersionSchema,
    careerId: entityIdSchema,
    aggregateVersion: versionSchema,
    projectedAt: instantSchema,
    completedSeason: z.int().min(2020).max(9998),
    nextSeason: z.int().min(2021).max(9999),
    status: z.enum(['pending', 'ready', 'generated']),
    movements: z.array(movementSchema),
    qualifiers: z.array(
      z.strictObject({
        clubId: entityIdSchema,
        clubName: nonEmptyTextSchema,
        competitionId: entityIdSchema,
        competitionName: nonEmptyTextSchema,
        route: nonEmptyTextSchema,
      }),
    ),
    awards: z.array(
      z.strictObject({
        id: entityIdSchema,
        competitionId: entityIdSchema,
        clubId: entityIdSchema,
        label: nonEmptyTextSchema,
        prize: moneySchema,
        prestige: z.int().nonnegative(),
      }),
    ),
  })
  .superRefine((transition, context) => {
    if (transition.nextSeason !== transition.completedSeason + 1)
      context.addIssue({
        code: 'custom',
        path: ['nextSeason'],
        message: 'nextSeason must immediately follow completedSeason',
      });
  });

export const phaseFiveReceiptSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  commandId: commandIdSchema,
  aggregateVersion: versionSchema,
  occurredAt: instantSchema,
  outcome: z.enum(['applied', 'already_applied']),
});

export type PhaseFiveCommand = z.infer<typeof phaseFiveCommandSchema>;
export type PhaseFiveReceipt = z.infer<typeof phaseFiveReceiptSchema>;
export type CompetitionPyramidReadModel = z.infer<
  typeof competitionPyramidReadModelSchema
>;
export type CompetitionCalendarReadModel = z.infer<
  typeof competitionCalendarReadModelSchema
>;
export type NextSeasonTransitionReadModel = z.infer<
  typeof nextSeasonTransitionReadModelSchema
>;
