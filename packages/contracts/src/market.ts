import { z } from 'zod';
import {
  entityIdSchema,
  gameDateSchema,
  instantSchema,
  moneySchema,
  nonEmptyTextSchema,
  positionSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';
import { marketSearchQuerySchema } from './phase-four.js';

const signedMoneySchema = z
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);

const transferWindowSchema = z.strictObject({
  id: z.enum(['pre_season', 'mid_season']),
  name: nonEmptyTextSchema,
  opensOn: gameDateSchema,
  closesOn: gameDateSchema,
});

/** Transfer window state on the career date (docs/adr/0008). */
export const transferWindowReadModelSchema = z.strictObject({
  rulesVersion: z.string().min(1),
  status: z.enum(['open', 'closed']),
  current: transferWindowSchema.optional(),
  /** Whole days after today until the current window closes. */
  daysRemaining: z.int().min(0).optional(),
  next: transferWindowSchema,
  daysUntilNext: z.int().min(1),
  windows: z.array(transferWindowSchema).length(2),
});

/** Origin of a club in the content catalog: national pyramid/state or abroad. */
export const clubOriginSchema = z.enum(['national', 'state', 'foreign']);

/** Market search: Phase 4 filters plus origin, page size and own-squad toggle. */
export const careerMarketQuerySchema = marketSearchQuerySchema.extend({
  origin: z.enum(['all', 'national', 'foreign']).optional(),
  includeOwnSquad: z.boolean().optional(),
  limit: z.int().min(1).max(100).optional(),
});

const loanTermsReadModelSchema = z.strictObject({
  endsOn: gameDateSchema,
  wageSharePercentage: z.int().min(0).max(100),
});

const offerReadModelSchema = z.strictObject({
  id: entityIdSchema,
  kind: z.enum(['buy', 'loan']),
  playerId: entityIdSchema,
  playerName: nonEmptyTextSchema,
  counterpartClubId: entityIdSchema.optional(),
  counterpartClubName: nonEmptyTextSchema.optional(),
  fee: moneySchema,
  wage: moneySchema,
  loan: loanTermsReadModelSchema.optional(),
  status: z.enum(['pending', 'countered', 'accepted', 'rejected', 'cancelled']),
  createdOn: gameDateSchema,
  expiresOn: gameDateSchema,
  counterOf: entityIdSchema.optional(),
  /** Who must act next on a pending offer. */
  awaiting: z.enum(['manager', 'counterpart', 'none']),
  /** Inbox decision id when the manager must answer. */
  decisionId: entityIdSchema.optional(),
});

const listingReadModelSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('sale'),
    playerId: entityIdSchema,
    playerName: nonEmptyTextSchema,
    position: positionSchema,
    strength: z.number().min(1).max(100),
    value: moneySchema,
    askingPrice: moneySchema,
    listedOn: gameDateSchema,
  }),
  z.strictObject({
    mode: z.literal('loan'),
    playerId: entityIdSchema,
    playerName: nonEmptyTextSchema,
    position: positionSchema,
    strength: z.number().min(1).max(100),
    value: moneySchema,
    durationMonths: z.int().min(1).max(12),
    wageSharePercentage: z.int().min(0).max(100),
    listedOn: gameDateSchema,
  }),
]);

const loanReadModelSchema = z.strictObject({
  playerId: entityIdSchema,
  playerName: nonEmptyTextSchema,
  direction: z.enum(['out', 'in']),
  counterpartClubId: entityIdSchema,
  counterpartClubName: nonEmptyTextSchema,
  startsOn: gameDateSchema,
  endsOn: gameDateSchema,
});

export const marketSearchResultSchema = z.strictObject({
  id: entityIdSchema,
  name: nonEmptyTextSchema,
  age: z.int().min(15).max(60),
  position: positionSchema,
  strength: z.number().min(1).max(100),
  value: moneySchema,
  wage: moneySchema,
  clubId: entityIdSchema.optional(),
  clubName: nonEmptyTextSchema.optional(),
  origin: clubOriginSchema.optional(),
  country: z.string().min(1).max(64).optional(),
  freeAgent: z.boolean(),
  listed: z.boolean(),
});

/** Market screen: cash, window, squad status, offers, list and search. */
export const careerMarketReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  projectedAt: instantSchema,
  rulesVersion: z.string().min(1),
  currentDate: gameDateSchema,
  club: z
    .strictObject({
      id: entityIdSchema,
      name: nonEmptyTextSchema,
      cash: signedMoneySchema,
      squadSize: z.int().min(0),
      maxSquadSize: z.int().positive(),
      monthlyWageBill: moneySchema,
    })
    .optional(),
  window: transferWindowReadModelSchema,
  listings: z.array(listingReadModelSchema),
  offersReceived: z.array(offerReadModelSchema),
  offersSent: z.array(offerReadModelSchema),
  loans: z.array(loanReadModelSchema),
  search: z.strictObject({
    total: z.int().min(0),
    results: z.array(marketSearchResultSchema).max(100),
  }),
});

export type TransferWindowReadModel = z.infer<
  typeof transferWindowReadModelSchema
>;
export type CareerMarketQuery = z.infer<typeof careerMarketQuerySchema>;
export type CareerMarketReadModel = z.infer<typeof careerMarketReadModelSchema>;
export type MarketSearchResult = z.infer<typeof marketSearchResultSchema>;
