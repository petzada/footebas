import { z } from 'zod';
import {
  attackDirectionSchema,
  commandIdSchema,
  entityIdSchema,
  formationSchema,
  gameDateSchema,
  idempotencyKeySchema,
  markingIntensitySchema,
  mentalitySchema,
  nonEmptyTextSchema,
  positionSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';

const envelopeFields = {
  version: transportVersionSchema,
  commandId: commandIdSchema,
  idempotencyKey: idempotencyKeySchema,
  expectedVersion: versionSchema,
} as const;

export const createCareerCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('CreateCareer'),
  payload: z.strictObject({
    managerName: nonEmptyTextSchema,
    startDate: gameDateSchema,
  }),
});
export const selectClubCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('SelectClub'),
  payload: z.strictObject({ careerId: entityIdSchema, clubId: entityIdSchema }),
});
const lineupSlotSchema = z.strictObject({
  playerId: entityIdSchema,
  position: positionSchema,
});
export const setLineupCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('SetLineup'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    clubId: entityIdSchema,
    starters: z.array(lineupSlotSchema).length(11),
    substitutes: z.array(entityIdSchema).max(12),
    captainId: entityIdSchema,
  }),
});
export const setTacticsCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('SetTactics'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    formation: formationSchema,
    mentality: mentalitySchema,
    attackDirection: attackDirectionSchema,
    marking: markingIntensitySchema,
  }),
});
export const advanceDateCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('AdvanceDate'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    throughDate: gameDateSchema.optional(),
  }),
});
export const simulateMatchCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('SimulateMatch'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    fixtureId: entityIdSchema,
  }),
});

export const commandSchema = z.discriminatedUnion('type', [
  createCareerCommandSchema,
  selectClubCommandSchema,
  setLineupCommandSchema,
  setTacticsCommandSchema,
  advanceDateCommandSchema,
  simulateMatchCommandSchema,
]);
export const commandAcceptedSchema = z.strictObject({
  version: transportVersionSchema,
  commandId: commandIdSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  jobId: entityIdSchema.optional(),
});

export type CreateCareerCommand = z.infer<typeof createCareerCommandSchema>;
export type SelectClubCommand = z.infer<typeof selectClubCommandSchema>;
export type SetLineupCommand = z.infer<typeof setLineupCommandSchema>;
export type SetTacticsCommand = z.infer<typeof setTacticsCommandSchema>;
export type AdvanceDateCommand = z.infer<typeof advanceDateCommandSchema>;
export type SimulateMatchCommand = z.infer<typeof simulateMatchCommandSchema>;
export type Command = z.infer<typeof commandSchema>;
export type CommandAccepted = z.infer<typeof commandAcceptedSchema>;
