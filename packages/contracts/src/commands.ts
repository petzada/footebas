import { z } from 'zod';
import {
  attackDirectionSchema,
  attackFocusSchema,
  buildUpStyleSchema,
  commandIdSchema,
  entityIdSchema,
  formationSchema,
  gameDateSchema,
  idempotencyKeySchema,
  markingIntensitySchema,
  markingStyleSchema,
  mentalitySchema,
  pressingStyleSchema,
  defensiveLineSchema,
  nonEmptyTextSchema,
  positionSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';
import { careerNameSchema, coachProfileSchema } from './coach.js';
import {
  configureFanMembershipCommandSchema,
  counterSponsorshipOfferCommandSchema,
  decideSponsorshipOfferCommandSchema,
} from './office.js';

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
    /** Optional for compatibility; defaults to "Carreira de <managerName>". */
    careerName: careerNameSchema.optional(),
    /** Optional for compatibility; defaults to BR, avatar-01, estrategista. */
    coach: coachProfileSchema.optional(),
  }),
});
/** Archives the career (owner only) and frees its slot in the plan limit. */
export const deleteCareerCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('DeleteCareer'),
  payload: z.strictObject({ careerId: entityIdSchema }),
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
    reserves: z.array(entityIdSchema).max(100).optional(),
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
    buildUp: buildUpStyleSchema.optional(),
    focus: attackFocusSchema.optional(),
    press: pressingStyleSchema.optional(),
    defensiveLine: defensiveLineSchema.optional(),
    markingStyle: markingStyleSchema.optional(),
  }),
});
export const autoPickLineupCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('AutoPickLineup'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    clubId: entityIdSchema,
    formation: formationSchema,
    mode: z.enum(['best', 'rest', 'develop']),
  }),
});
const tacticSchema = z.strictObject({
  formation: formationSchema,
  mentality: mentalitySchema,
  attackDirection: attackDirectionSchema,
  marking: markingIntensitySchema,
  buildUp: buildUpStyleSchema.optional(),
  focus: attackFocusSchema.optional(),
  press: pressingStyleSchema.optional(),
  defensiveLine: defensiveLineSchema.optional(),
  markingStyle: markingStyleSchema.optional(),
});
/**
 * Decision 18 (docs/09): the manager may pause at any minute, so an
 * instruction can target any whole minute of the match (ADR 0015).
 */
const matchInstructionMinuteSchema = z.int().min(0).max(93);
export const matchInstructionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('substitution'),
    minute: matchInstructionMinuteSchema,
    side: z.enum(['home', 'away']),
    playerOutId: entityIdSchema,
    playerInId: entityIdSchema,
    position: positionSchema,
  }),
  z.strictObject({
    type: z.literal('tactical_change'),
    minute: matchInstructionMinuteSchema,
    side: z.enum(['home', 'away']),
    tactic: tacticSchema,
  }),
]);
export const advanceDateCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('AdvanceDate'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    throughDate: gameDateSchema.optional(),
  }),
});
/**
 * Answers a generated inbox message (board, athletes, press, contract end).
 * Idempotent: repeating the chosen option changes nothing; a different
 * option on a resolved message, or any option after `expiresOn`, is refused.
 */
export const resolveInboxDecisionCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('ResolveInboxDecision'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    messageId: entityIdSchema,
    optionId: entityIdSchema,
  }),
});
export const simulateMatchCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('SimulateMatch'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    fixtureId: entityIdSchema,
    instructions: z.array(matchInstructionSchema).max(12).optional(),
  }),
});

export const commandSchema = z.discriminatedUnion('type', [
  createCareerCommandSchema,
  deleteCareerCommandSchema,
  selectClubCommandSchema,
  setLineupCommandSchema,
  autoPickLineupCommandSchema,
  setTacticsCommandSchema,
  advanceDateCommandSchema,
  simulateMatchCommandSchema,
  decideSponsorshipOfferCommandSchema,
  counterSponsorshipOfferCommandSchema,
  configureFanMembershipCommandSchema,
  resolveInboxDecisionCommandSchema,
]);
export const commandAcceptedSchema = z.strictObject({
  version: transportVersionSchema,
  commandId: commandIdSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  jobId: entityIdSchema.optional(),
});

export type CreateCareerCommand = z.infer<typeof createCareerCommandSchema>;
export type DeleteCareerCommand = z.infer<typeof deleteCareerCommandSchema>;
export type SelectClubCommand = z.infer<typeof selectClubCommandSchema>;
export type SetLineupCommand = z.infer<typeof setLineupCommandSchema>;
export type SetTacticsCommand = z.infer<typeof setTacticsCommandSchema>;
export type AutoPickLineupCommand = z.infer<typeof autoPickLineupCommandSchema>;
export type AdvanceDateCommand = z.infer<typeof advanceDateCommandSchema>;
export type SimulateMatchCommand = z.infer<typeof simulateMatchCommandSchema>;
export type ResolveInboxDecisionCommand = z.infer<
  typeof resolveInboxDecisionCommandSchema
>;
export type Command = z.infer<typeof commandSchema>;
export type CommandAccepted = z.infer<typeof commandAcceptedSchema>;
