import { z } from 'zod';
import { coachProfileSchema } from './coach.js';
import {
  commandIdSchema,
  entityIdSchema,
  gameDateSchema,
  idempotencyKeySchema,
  instantSchema,
  moneySchema,
  nonEmptyTextSchema,
  percentageSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';

/**
 * Office (Escritório, docs/09 decision 8, ADR 0011): negotiable sponsorship,
 * fan membership (sócio-torcedor), finances, contracts and coach career.
 */
const envelopeFields = {
  version: transportVersionSchema,
  commandId: commandIdSchema,
  idempotencyKey: idempotencyKeySchema,
  expectedVersion: versionSchema,
} as const;

const signedMoneySchema = z
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
/** Calendar month as `YYYY-MM`. */
export const gameMonthSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);

export const MEMBERSHIP_TIERS = ['basic', 'intermediate', 'premium'] as const;
export const membershipTierSchema = z.enum(MEMBERSHIP_TIERS);
/** Monthly membership price bounds in minor units (R$ 5 to R$ 200). */
export const MEMBERSHIP_PRICE_RANGE = Object.freeze({
  min: 500,
  max: 20_000,
});

/** Accept or reject one sponsorship proposal of the managed club. */
export const decideSponsorshipOfferCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('DecideSponsorshipOffer'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    offerId: entityIdSchema,
    decision: z.enum(['accept', 'reject']),
  }),
});
/**
 * Asks a higher monthly value, once per proposal. The sponsor answers at
 * once: accepting signs the contract, refusing withdraws the proposal.
 */
export const counterSponsorshipOfferCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('CounterSponsorshipOffer'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    offerId: entityIdSchema,
    monthlyValue: moneySchema.min(1),
  }),
});
/** Monthly price and benefit tier of the managed club's fan membership. */
export const configureFanMembershipCommandSchema = z.strictObject({
  ...envelopeFields,
  type: z.literal('ConfigureFanMembership'),
  payload: z.strictObject({
    careerId: entityIdSchema,
    monthlyPrice: z
      .int()
      .min(MEMBERSHIP_PRICE_RANGE.min)
      .max(MEMBERSHIP_PRICE_RANGE.max),
    tier: membershipTierSchema,
  }),
});

const sponsorBonusesSchema = z.strictObject({
  /** National or continental title (state titles do not count). */
  title: moneySchema,
  promotion: moneySchema,
  continental: moneySchema,
});

export const sponsorOfferReadModelSchema = z.strictObject({
  id: entityIdSchema,
  sponsorName: nonEmptyTextSchema,
  season: z.int().positive(),
  monthlyValue: moneySchema,
  durationMonths: z.int().min(1).max(60),
  bonuses: sponsorBonusesSchema,
  terminationFee: moneySchema,
  status: z.enum([
    'pending',
    'accepted',
    'rejected',
    'withdrawn',
    'expired',
    'superseded',
  ]),
  createdOn: gameDateSchema,
  expiresOn: gameDateSchema,
  counter: z
    .strictObject({
      monthlyValue: moneySchema,
      outcome: z.enum(['accepted', 'rejected']),
    })
    .optional(),
  /** Inbox decision id while the proposal waits for the manager. */
  decisionId: entityIdSchema.optional(),
  /** Counter bounds while a counter is still allowed. */
  counterRange: z
    .strictObject({ min: moneySchema, max: moneySchema })
    .optional(),
});

export const sponsorContractReadModelSchema = z.strictObject({
  id: entityIdSchema,
  offerId: entityIdSchema,
  sponsorName: nonEmptyTextSchema,
  monthlyValue: moneySchema,
  startMonth: gameMonthSchema,
  endMonth: gameMonthSchema,
  monthsRemaining: z.int().min(0),
  bonuses: sponsorBonusesSchema,
  terminationFee: moneySchema,
  status: z.enum(['active', 'ended', 'terminated']),
  bonusesPaid: z.array(
    z.strictObject({
      goal: z.enum(['title', 'promotion', 'continental']),
      season: z.int().positive(),
      amount: moneySchema,
    }),
  ),
});

export const fanMembershipReadModelSchema = z.strictObject({
  monthlyPrice: moneySchema,
  tier: membershipTierSchema,
  priceRange: z.strictObject({ min: moneySchema, max: moneySchema }),
  /** Price at which the club's demand curve is neutral. */
  referencePrice: moneySchema,
  tiers: z
    .array(
      z.strictObject({
        tier: membershipTierSchema,
        costPerMember: moneySchema,
        appeal: z.number().positive(),
      }),
    )
    .length(3),
  /** Members with the current settings, form and fan confidence. */
  members: z.int().min(0),
  /** Members the club could reach at the neutral price and form. */
  potential: z.int().min(0),
  monthlyRevenue: moneySchema,
  monthlyCost: moneySchema,
  /** Extra attendance per home match, capped by capacity share. */
  attendanceBonus: z.int().min(0),
  /** Fan confidence change applied at the season verdict (−3 to +3). */
  fanConfidenceEffect: z.int().min(-3).max(3),
});

const financeCategoriesSchema = z.strictObject({
  income: z.strictObject({
    gate: moneySchema,
    sponsor: moneySchema,
    membership: moneySchema,
    prize: moneySchema,
    transfer: moneySchema,
  }),
  expenses: z.strictObject({
    wages: moneySchema,
    transfer: moneySchema,
    stadium: moneySchema,
    membership: moneySchema,
    sponsor: moneySchema,
  }),
  totalIncome: moneySchema,
  totalExpenses: moneySchema,
  net: signedMoneySchema,
});

/** Chemistry (entrosamento, ADR 0011) of the managed starting eleven. */
export const chemistryReadModelSchema = z.strictObject({
  value: z.int().min(0).max(100),
  /** Effective strength bonus before the match engine (0 to 3). */
  bonusPercent: z.number().min(0).max(3),
  matches: z.int().min(0),
  /** Starters of the saved lineup that did not start the last match. */
  startersChanged: z.int().min(0).max(11),
});

export const careerOfficeReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  projectedAt: instantSchema,
  rulesVersion: z.string().min(1),
  currentDate: gameDateSchema,
  season: z.int().positive(),
  club: z
    .strictObject({
      id: entityIdSchema,
      name: nonEmptyTextSchema,
      division: z.enum(['serie-a', 'serie-b', 'serie-c']).optional(),
      cash: signedMoneySchema,
      monthlyWageBill: moneySchema,
    })
    .optional(),
  proposals: z.strictObject({
    sponsorship: z.array(sponsorOfferReadModelSchema).max(12),
    jobs: z.array(
      z.strictObject({
        id: entityIdSchema,
        clubId: entityIdSchema,
        clubName: nonEmptyTextSchema,
        expiresOn: gameDateSchema,
        minimumPrestige: z.number().min(0),
        status: z.enum(['open', 'accepted', 'rejected', 'expired']),
      }),
    ),
    /** Market proposals for the managed club's players awaiting the manager. */
    transfers: z.array(
      z.strictObject({
        id: entityIdSchema,
        kind: z.enum(['buy', 'loan']),
        playerId: entityIdSchema,
        playerName: nonEmptyTextSchema,
        counterpartClubId: entityIdSchema.optional(),
        counterpartClubName: nonEmptyTextSchema.optional(),
        fee: moneySchema,
        wage: moneySchema,
        expiresOn: gameDateSchema,
        decisionId: entityIdSchema,
      }),
    ),
  }),
  sponsorship: z.strictObject({
    contract: sponsorContractReadModelSchema.optional(),
    /** Monthly one-off sponsorship while the club has no contract. */
    fallbackMonthly: moneySchema,
    history: z.array(sponsorContractReadModelSchema).max(10),
  }),
  membership: fanMembershipReadModelSchema.optional(),
  finances: z.strictObject({
    /** Last settled month (the open month settles on the next month). */
    month: financeCategoriesSchema.extend({ period: gameMonthSchema }),
    season: financeCategoriesSchema.extend({ year: z.int().min(1900) }),
    /** Gate income already earned in the open month, settled at its end. */
    pendingGate: moneySchema,
  }),
  contracts: z.array(
    z.strictObject({
      contractId: entityIdSchema,
      playerId: entityIdSchema,
      playerName: nonEmptyTextSchema,
      endsOn: gameDateSchema,
      wage: moneySchema,
      status: z.enum(['active', 'expiring', 'expired', 'terminated']),
    }),
  ),
  coach: z.strictObject({
    managerName: nonEmptyTextSchema,
    profile: coachProfileSchema,
    employmentStatus: z.enum(['employed', 'available', 'retired']),
    clubId: entityIdSchema.optional(),
    boardConfidence: percentageSchema,
    fanConfidence: percentageSchema,
    prestige: z.number().min(0),
    seasons: z.int().min(0),
    appointments: z.array(
      z.strictObject({
        clubId: entityIdSchema,
        clubName: nonEmptyTextSchema,
        joinedOn: gameDateSchema,
        leftOn: gameDateSchema.optional(),
        reason: z.enum(['fired', 'resigned', 'accepted_offer']).optional(),
      }),
    ),
    achievements: z.array(
      z.strictObject({
        type: z.enum([
          'league_title',
          'cup_title',
          'continental_title',
          'promotion',
          'season_completed',
        ]),
        count: z.int().positive(),
      }),
    ),
  }),
  chemistry: chemistryReadModelSchema.optional(),
});

export type DecideSponsorshipOfferCommand = z.infer<
  typeof decideSponsorshipOfferCommandSchema
>;
export type CounterSponsorshipOfferCommand = z.infer<
  typeof counterSponsorshipOfferCommandSchema
>;
export type ConfigureFanMembershipCommand = z.infer<
  typeof configureFanMembershipCommandSchema
>;
export type MembershipTier = z.infer<typeof membershipTierSchema>;
export type SponsorOfferReadModel = z.infer<typeof sponsorOfferReadModelSchema>;
export type SponsorContractReadModel = z.infer<
  typeof sponsorContractReadModelSchema
>;
export type FanMembershipReadModel = z.infer<
  typeof fanMembershipReadModelSchema
>;
export type ChemistryReadModel = z.infer<typeof chemistryReadModelSchema>;
export type CareerOfficeReadModel = z.infer<typeof careerOfficeReadModelSchema>;
