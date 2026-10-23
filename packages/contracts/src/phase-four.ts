import { z } from 'zod';
import {
  commandIdSchema,
  entityIdSchema,
  gameDateSchema,
  idempotencyKeySchema,
  instantSchema,
  moneySchema,
  nonEmptyTextSchema,
  positionSchema,
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

const loanTermsSchema = z.strictObject({
  endsOn: gameDateSchema,
  wageSharePercentage: z.int().min(0).max(100),
  optionToBuy: moneySchema.optional(),
});

export const renewPlayerContractCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('RenewPlayerContract'),
  payload: z.strictObject({
    contractId: entityIdSchema,
    wage: moneySchema,
    endsOn: gameDateSchema,
  }),
});
export const terminatePlayerContractCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('TerminatePlayerContract'),
  payload: z.strictObject({ contractId: entityIdSchema }),
});
export const submitTransferOfferCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('SubmitTransferOffer'),
  payload: z.strictObject({
    playerId: entityIdSchema,
    fromClubId: entityIdSchema.optional(),
    toClubId: entityIdSchema,
    kind: z.enum(['buy', 'loan']),
    fee: moneySchema,
    wage: moneySchema,
    expiresOn: gameDateSchema,
    loan: loanTermsSchema.optional(),
  }),
});
export const counterTransferOfferCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('CounterTransferOffer'),
  payload: z.strictObject({
    offerId: entityIdSchema,
    fee: moneySchema,
    wage: moneySchema,
    expiresOn: gameDateSchema,
  }),
});
export const decideTransferOfferCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('DecideTransferOffer'),
  payload: z.strictObject({
    offerId: entityIdSchema,
    decision: z.enum(['accept', 'reject']),
  }),
});
/** Puts a managed player on the transfer list (sale with asking price or loan). */
export const listPlayerForTransferCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('ListPlayerForTransfer'),
  payload: z.discriminatedUnion('mode', [
    z.strictObject({
      playerId: entityIdSchema,
      mode: z.literal('sale'),
      askingPrice: moneySchema,
    }),
    z.strictObject({
      playerId: entityIdSchema,
      mode: z.literal('loan'),
      durationMonths: z.int().min(1).max(12),
      wageSharePercentage: z.int().min(0).max(100),
    }),
  ]),
});
export const withdrawTransferListingCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('WithdrawTransferListing'),
  payload: z.strictObject({ playerId: entityIdSchema }),
});
export const setTicketPriceCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('SetTicketPrice'),
  payload: z.strictObject({ clubId: entityIdSchema, ticketPrice: moneySchema }),
});
export const expandStadiumCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('ExpandStadium'),
  payload: z.strictObject({
    clubId: entityIdSchema,
    addedCapacity: z.int().min(100),
    cost: moneySchema.positive(),
    completesOn: gameDateSchema,
  }),
});
export const generateYouthCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('GenerateYouth'),
  payload: z.strictObject({
    clubId: entityIdSchema,
    seed: nonEmptyTextSchema,
    maximumCandidates: z.int().min(0).max(20),
  }),
});
export const promoteYouthCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('PromoteYouth'),
  payload: z.strictObject({ playerId: entityIdSchema }),
});
export const releaseYouthCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('ReleaseYouth'),
  payload: z.strictObject({ playerId: entityIdSchema }),
});
export const leaveClubCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('LeaveClub'),
  payload: z.strictObject({ reason: z.enum(['fired', 'resigned']) }),
});
export const acceptJobProposalCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('AcceptJobProposal'),
  payload: z.strictObject({ proposalId: entityIdSchema }),
});
export const migrateSaveCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('MigrateSave'),
  payload: z.strictObject({ targetSchemaVersion: z.string().min(1).max(64) }),
});
export const compactHistoryCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('CompactHistory'),
  payload: z.strictObject({ retainFromSeason: z.int().positive() }),
});
export const advanceCareerSeasonCommandSchema = z.strictObject({
  ...envelope,
  type: z.literal('AdvanceCareerSeason'),
  payload: z.strictObject({}),
});

export const phaseFourCommandSchema = z.discriminatedUnion('type', [
  renewPlayerContractCommandSchema,
  terminatePlayerContractCommandSchema,
  submitTransferOfferCommandSchema,
  counterTransferOfferCommandSchema,
  decideTransferOfferCommandSchema,
  listPlayerForTransferCommandSchema,
  withdrawTransferListingCommandSchema,
  setTicketPriceCommandSchema,
  expandStadiumCommandSchema,
  generateYouthCommandSchema,
  promoteYouthCommandSchema,
  releaseYouthCommandSchema,
  leaveClubCommandSchema,
  acceptJobProposalCommandSchema,
  migrateSaveCommandSchema,
  compactHistoryCommandSchema,
  advanceCareerSeasonCommandSchema,
]);

export const marketSearchQuerySchema = z.strictObject({
  text: z.string().trim().max(160).optional(),
  position: positionSchema.optional(),
  minStrength: z.number().min(1).max(100).optional(),
  maxAge: z.int().min(15).max(60).optional(),
  maxValue: moneySchema.optional(),
  freeAgentsOnly: z.boolean().optional(),
});
export const scoutPlayerQuerySchema = z.strictObject({
  careerId: entityIdSchema,
  playerId: entityIdSchema,
});
export const comparePlayersQuerySchema = z.strictObject({
  careerId: entityIdSchema,
  playerIds: z.array(entityIdSchema).min(2).max(4),
});

export const phaseFourEventSchema = z.strictObject({
  id: entityIdSchema,
  careerId: entityIdSchema,
  sequence: z.int().positive(),
  type: z.enum([
    'CONTRACT_RENEWED',
    'CONTRACT_REFUSED',
    'CONTRACT_TERMINATED',
    'TRANSFER_OFFERED',
    'TRANSFER_COUNTERED',
    'TRANSFER_ACCEPTED',
    'TRANSFER_REJECTED',
    'TRANSFER_COMPLETED',
    'LOAN_STARTED',
    'TRANSFER_LISTED',
    'TRANSFER_UNLISTED',
    'TICKET_PRICE_CHANGED',
    'STADIUM_EXPANSION_STARTED',
    'YOUTH_GENERATED',
    'YOUTH_PROMOTED',
    'YOUTH_RELEASED',
    'MANAGER_FIRED',
    'MANAGER_RESIGNED',
    'MANAGER_CHANGED_CLUB',
    'SAVE_MIGRATED',
    'HISTORY_ARCHIVED',
    'SEASON_ADVANCED',
  ]),
  occurredAt: instantSchema,
  gameDate: gameDateSchema,
  commandId: commandIdSchema,
  payload: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
});

export const phaseFourReceiptSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  commandId: commandIdSchema,
  aggregateVersion: versionSchema,
  eventIds: z.array(entityIdSchema),
  outcome: z.enum(['applied', 'refused']),
});

const hiddenEstimateSchema = z.enum(['low', 'average', 'good', 'excellent']);
export const marketPlayerReadModelSchema = z.strictObject({
  id: entityIdSchema,
  name: nonEmptyTextSchema,
  age: z.int().min(15).max(60),
  position: positionSchema,
  strength: z.number().min(1).max(100),
  value: moneySchema,
  wage: moneySchema,
  clubId: entityIdSchema.optional(),
  scouting: z
    .strictObject({
      confidence: z.int().min(1).max(100),
      estimates: z.strictObject({
        potential: hiddenEstimateSchema,
        consistency: hiddenEstimateSchema,
        injuryProneness: hiddenEstimateSchema,
        adaptation: hiddenEstimateSchema,
        professionalism: hiddenEstimateSchema,
        bigGame: hiddenEstimateSchema,
      }),
    })
    .optional(),
});

export const phaseFourCareerReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  projectedAt: instantSchema,
  contractAlerts: z.array(
    z.strictObject({
      contractId: entityIdSchema,
      playerId: entityIdSchema,
      kind: z.enum(['expires_soon', 'expired']),
      daysRemaining: z.int().min(0),
    }),
  ),
  freeAgentIds: z.array(entityIdSchema),
  pendingOfferIds: z.array(entityIdSchema),
  boardConfidence: z.number().min(0).max(100),
  fanConfidence: z.number().min(0).max(100),
  managerPrestige: z.number().min(0),
  schemaVersion: z.string().min(1),
  archiveKeys: z.array(z.string().min(1)),
});

const historyEventReadModelSchema = z.strictObject({
  id: entityIdSchema,
  type: z.enum([
    'title',
    'promotion',
    'relegation',
    'top_scorer',
    'record',
    'idol',
    'manager_fired',
    'transfer',
    'retirement',
  ]),
  season: z.int().positive(),
  occurredOn: gameDateSchema,
  clubId: entityIdSchema.optional(),
  playerId: entityIdSchema.optional(),
  competitionId: entityIdSchema.optional(),
  value: z.number().optional(),
});

export const phaseFourHistoryReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  currentSeason: z.int().positive(),
  history: z.array(historyEventReadModelSchema),
  archivedThroughSeason: z.int().nonnegative(),
  archivedSeasonCount: z.int().nonnegative(),
});

const leaderboardRowSchema = z.strictObject({
  managerId: entityIdSchema,
  score: z.number().nonnegative(),
  rank: z.int().positive(),
});

export const phaseFourLeaderboardReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  month: z.string().regex(/^\d{4}-\d{2}$/),
  global: z.array(leaderboardRowSchema),
  underdog: z.array(leaderboardRowSchema),
  monthly: z.array(leaderboardRowSchema),
});

export type PhaseFourCommand = z.infer<typeof phaseFourCommandSchema>;
export type PhaseFourEvent = z.infer<typeof phaseFourEventSchema>;
export type PhaseFourReceipt = z.infer<typeof phaseFourReceiptSchema>;
export type MarketSearchQuery = z.infer<typeof marketSearchQuerySchema>;
export type PhaseFourCareerReadModel = z.infer<
  typeof phaseFourCareerReadModelSchema
>;
export type PhaseFourHistoryReadModel = z.infer<
  typeof phaseFourHistoryReadModelSchema
>;
export type PhaseFourLeaderboardReadModel = z.infer<
  typeof phaseFourLeaderboardReadModelSchema
>;
