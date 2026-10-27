import { DomainError } from './errors.js';
import type { ClubId } from './entities.js';
import type { Money } from './values.js';

export type LedgerAccount =
  | `club:${string}:cash`
  | `club:${string}:expense:wages`
  | `club:${string}:expense:transfer`
  | `club:${string}:expense:stadium`
  | `club:${string}:income:transfer`
  | `club:${string}:income:gate`
  | `club:${string}:income:sponsor`
  | `club:${string}:income:prize`
  | `club:${string}:income:membership`
  | `club:${string}:expense:membership`
  | `club:${string}:expense:sponsor`
  | 'world:transfer_clearing'
  | 'world:gate_source'
  | 'world:sponsor_source'
  | 'world:prize_source';

export type LedgerSource =
  | { readonly type: 'wages'; readonly clubId: ClubId; readonly period: string }
  | {
      readonly type: 'transfer';
      readonly offerId: string;
      readonly playerId: string;
    }
  | {
      readonly type: 'gate';
      readonly matchId: string;
      readonly attendance: number;
    }
  | {
      readonly type: 'sponsor';
      readonly agreementId: string;
      readonly period: string;
    }
  | {
      readonly type: 'prize';
      readonly competitionId: string;
      readonly season: number;
    }
  | { readonly type: 'stadium'; readonly projectId: string }
  /** Fan membership (sócio-torcedor): revenue or benefit costs of a month. */
  | { readonly type: 'membership'; readonly period: string }
  /** Fee the club pays to end a sponsorship contract early. */
  | { readonly type: 'sponsor_termination'; readonly agreementId: string };

export interface LedgerPosting {
  readonly account: LedgerAccount;
  /** Signed minor units. Every transaction must sum to zero. */
  readonly amount: Money;
  readonly clubId?: ClubId;
}

export interface LedgerTransaction {
  readonly id: string;
  readonly occurredAt: string;
  readonly source: LedgerSource;
  readonly postings: readonly LedgerPosting[];
}

export interface FinancialLedger {
  readonly version: 1;
  readonly entries: readonly LedgerTransaction[];
}

const clonePosting = (posting: LedgerPosting): LedgerPosting =>
  Object.freeze({ ...posting });

export function createLedger(
  entries: readonly LedgerTransaction[] = [],
): FinancialLedger {
  let ledger: FinancialLedger = Object.freeze({ version: 1, entries: [] });
  for (const entry of entries) ledger = appendLedgerEntry(ledger, entry);
  return ledger;
}

export function appendLedgerEntry(
  ledger: FinancialLedger,
  transaction: LedgerTransaction,
): FinancialLedger {
  if (
    transaction.id.trim().length === 0 ||
    transaction.occurredAt.trim().length === 0
  )
    throw new DomainError(
      'INVALID_ENTITY',
      'ledger entry requires id and occurrence time',
    );
  if (ledger.entries.some(({ id }) => id === transaction.id))
    throw new DomainError('INVALID_ENTITY', 'ledger entry id must be unique', {
      transactionId: transaction.id,
    });
  if (transaction.postings.length < 2)
    throw new DomainError(
      'INVALID_ENTITY',
      'ledger entry requires at least two postings',
    );
  let total = 0;
  for (const posting of transaction.postings) {
    if (!Number.isSafeInteger(posting.amount))
      throw new DomainError(
        'INVALID_VALUE',
        'ledger posting must use safe minor units',
      );
    total += posting.amount;
    if (!Number.isSafeInteger(total))
      throw new DomainError('INVALID_VALUE', 'ledger transaction overflow');
  }
  if (total !== 0)
    throw new DomainError(
      'INVALID_ENTITY',
      'ledger transaction must balance to zero',
      {
        transactionId: transaction.id,
        imbalance: total,
      },
    );
  const entry = Object.freeze({
    ...transaction,
    source: Object.freeze({ ...transaction.source }),
    postings: Object.freeze(transaction.postings.map(clonePosting)),
  });
  return Object.freeze({
    version: 1,
    entries: Object.freeze([...ledger.entries, entry]),
  });
}

export function accountBalance(
  ledger: FinancialLedger,
  account: LedgerAccount,
): Money {
  let total = 0;
  for (const entry of ledger.entries) {
    for (const posting of entry.postings) {
      if (posting.account !== account) continue;
      total += posting.amount;
      if (!Number.isSafeInteger(total))
        throw new DomainError('INVALID_VALUE', 'ledger balance overflow');
    }
  }
  return total as Money;
}

export function clubCashBalance(
  ledger: FinancialLedger,
  clubId: ClubId,
  openingBalance: Money,
): Money {
  const balance =
    Number(openingBalance) +
    Number(accountBalance(ledger, `club:${clubId}:cash`));
  if (!Number.isSafeInteger(balance))
    throw new DomainError('INVALID_VALUE', 'club cash balance overflow');
  return balance as Money;
}

export function createWageTransaction(
  input: Readonly<{
    id: string;
    occurredAt: string;
    clubId: ClubId;
    period: string;
    amount: Money;
  }>,
): LedgerTransaction {
  assertPositiveAmount(input.amount);
  return Object.freeze({
    id: input.id,
    occurredAt: input.occurredAt,
    source: Object.freeze({
      type: 'wages' as const,
      clubId: input.clubId,
      period: input.period,
    }),
    postings: Object.freeze([
      Object.freeze({
        account: `club:${input.clubId}:cash` as const,
        amount: -Number(input.amount) as Money,
        clubId: input.clubId,
      }),
      Object.freeze({
        account: `club:${input.clubId}:expense:wages` as const,
        amount: input.amount,
        clubId: input.clubId,
      }),
    ]),
  });
}

export function createClubIncomeTransaction(
  input: Readonly<{
    id: string;
    occurredAt: string;
    clubId: ClubId;
    amount: Money;
    source:
      | Extract<LedgerSource, { type: 'gate' }>
      | Extract<LedgerSource, { type: 'sponsor' }>
      | Extract<LedgerSource, { type: 'prize' }>
      | Extract<LedgerSource, { type: 'membership' }>;
  }>,
): LedgerTransaction {
  assertPositiveAmount(input.amount);
  const incomeAccount =
    input.source.type === 'gate'
      ? (`club:${input.clubId}:income:gate` as const)
      : input.source.type === 'sponsor'
        ? (`club:${input.clubId}:income:sponsor` as const)
        : input.source.type === 'membership'
          ? (`club:${input.clubId}:income:membership` as const)
          : (`club:${input.clubId}:income:prize` as const);
  return Object.freeze({
    id: input.id,
    occurredAt: input.occurredAt,
    source: Object.freeze({ ...input.source }),
    postings: Object.freeze([
      Object.freeze({
        account: `club:${input.clubId}:cash` as const,
        amount: input.amount,
        clubId: input.clubId,
      }),
      Object.freeze({
        account: incomeAccount,
        amount: -Number(input.amount) as Money,
        clubId: input.clubId,
      }),
    ]),
  });
}

/**
 * Club expense outside wages and transfers: fan membership benefits, the fee
 * to end a sponsorship early or stadium works. Cash leaves, the expense
 * account grows.
 */
export function createClubExpenseTransaction(
  input: Readonly<{
    id: string;
    occurredAt: string;
    clubId: ClubId;
    amount: Money;
    source:
      | Extract<LedgerSource, { type: 'membership' }>
      | Extract<LedgerSource, { type: 'sponsor_termination' }>
      | Extract<LedgerSource, { type: 'stadium' }>;
  }>,
): LedgerTransaction {
  assertPositiveAmount(input.amount);
  const expenseAccount =
    input.source.type === 'membership'
      ? (`club:${input.clubId}:expense:membership` as const)
      : input.source.type === 'stadium'
        ? (`club:${input.clubId}:expense:stadium` as const)
        : (`club:${input.clubId}:expense:sponsor` as const);
  return Object.freeze({
    id: input.id,
    occurredAt: input.occurredAt,
    source: Object.freeze({ ...input.source }),
    postings: Object.freeze([
      Object.freeze({
        account: `club:${input.clubId}:cash` as const,
        amount: -Number(input.amount) as Money,
        clubId: input.clubId,
      }),
      Object.freeze({
        account: expenseAccount,
        amount: input.amount,
        clubId: input.clubId,
      }),
    ]),
  });
}

function assertPositiveAmount(amount: Money): void {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new DomainError(
      'INVALID_VALUE',
      'financial transaction amount must be positive',
    );
}

export interface Stadium {
  readonly clubId: ClubId;
  readonly capacity: number;
  readonly ticketPrice: Money;
  readonly maintenance: Money;
  /** Pitch, stands and facilities (0-100); wears with every home match. */
  readonly quality: number;
  /** Game date of the last one-off maintenance. */
  readonly lastMaintenanceOn?: string;
  readonly expansion?: Readonly<{
    projectId: string;
    addedCapacity: number;
    cost: Money;
    completesOn: string;
  }>;
}

export function createStadium(input: Stadium): Stadium {
  if (!Number.isSafeInteger(input.capacity) || input.capacity < 1)
    throw new DomainError(
      'INVALID_ENTITY',
      'stadium capacity must be positive',
    );
  if (!Number.isSafeInteger(input.ticketPrice) || input.ticketPrice < 0)
    throw new DomainError(
      'INVALID_ENTITY',
      'ticket price must be non-negative',
    );
  if (!Number.isSafeInteger(input.maintenance) || input.maintenance < 0)
    throw new DomainError('INVALID_ENTITY', 'maintenance must be non-negative');
  if (
    !Number.isInteger(input.quality) ||
    input.quality < 0 ||
    input.quality > 100
  )
    throw new DomainError(
      'INVALID_ENTITY',
      'stadium quality must be from 0 to 100',
    );
  return Object.freeze({
    ...input,
    ...(input.expansion === undefined
      ? {}
      : { expansion: Object.freeze({ ...input.expansion }) }),
  });
}

export interface CrowdInput {
  readonly capacity: number;
  readonly ticketPrice: Money;
  readonly referencePrice: Money;
  readonly homeReputation: number;
  readonly awayReputation: number;
  readonly importance: number;
  readonly recentForm: number;
  /** Fan confidence in the work (0-100); 50 is neutral. */
  readonly fanMood?: number;
  /** Stadium quality (0-100); 60 is neutral. */
  readonly stadiumQuality?: number;
}

/**
 * Fans a club can draw for an ordinary match at its reference price: bigger
 * clubs (reputation) pull a crowd far larger than a small club's.
 */
export function clubFanBase(reputation: number): number {
  const above = Math.max(0, reputation - 40);
  return Math.round(9_000 + above * above * 40);
}

/**
 * Fans who want a ticket, before the stadium caps them. Price works against
 * the club's own reference price, so a big club charges more for the same
 * pull; opponent, stakes, form, fan mood and stadium quality add appeal.
 */
export function crowdDemand(input: CrowdInput): number {
  if (input.capacity < 1 || input.referencePrice < 1 || input.ticketPrice < 0)
    throw new DomainError('INVALID_VALUE', 'invalid crowd inputs');
  const appeal = Math.max(
    0.2,
    Math.min(
      1.6,
      0.6 +
        (input.awayReputation - 50) / 250 +
        Math.max(0, Math.min(100, input.importance)) / 400 +
        Math.max(-20, Math.min(20, input.recentForm)) / 100 +
        (Math.max(0, Math.min(100, input.fanMood ?? 50)) - 50) / 250 +
        (Math.max(0, Math.min(100, input.stadiumQuality ?? 60)) - 60) / 400,
    ),
  );
  const priceRatio = input.ticketPrice / input.referencePrice;
  const priceFactor = Math.max(0.15, Math.min(1.25, 1.35 - priceRatio * 0.45));
  return Math.max(
    0,
    Math.floor(clubFanBase(input.homeReputation) * appeal * priceFactor),
  );
}

/** Pure demand curve: raising price can never raise attendance for identical context. */
export function calculateAttendance(input: CrowdInput): number {
  return Math.min(input.capacity, crowdDemand(input));
}

export function startStadiumExpansion(
  stadium: Stadium,
  project: NonNullable<Stadium['expansion']>,
): Stadium {
  if (stadium.expansion !== undefined)
    throw new DomainError(
      'INVALID_ENTITY',
      'stadium already has an active expansion',
    );
  if (
    !Number.isSafeInteger(project.addedCapacity) ||
    project.addedCapacity < 100
  )
    throw new DomainError('INVALID_ENTITY', 'stadium expansion is too small');
  if (!Number.isSafeInteger(project.cost) || project.cost <= 0)
    throw new DomainError(
      'INVALID_ENTITY',
      'stadium expansion cost must be positive',
    );
  return createStadium({ ...stadium, expansion: project });
}

export function completeStadiumExpansion(
  stadium: Stadium,
  onDate: string,
): Stadium {
  if (stadium.expansion === undefined || stadium.expansion.completesOn > onDate)
    throw new DomainError('INVALID_ENTITY', 'stadium expansion is not ready');
  const { expansion: _expansion, ...withoutExpansion } = stadium;
  void _expansion;
  return createStadium({
    ...withoutExpansion,
    capacity: stadium.capacity + stadium.expansion.addedCapacity,
  });
}

/** Largest stadium a club can grow into. */
export const STADIUM_MAX_CAPACITY = 90_000;

export type StadiumExpansionPlanId = 'small' | 'medium' | 'large';

export interface StadiumExpansionPlan {
  readonly id: StadiumExpansionPlanId;
  readonly addedCapacity: number;
  readonly cost: Money;
  /** Days from the order to the opening of the new seats. */
  readonly days: number;
}

/** Seats, cost per seat (minor units) and duration of each work. */
const EXPANSION_PLANS: Readonly<
  Record<
    StadiumExpansionPlanId,
    Readonly<{ seats: number; seatCost: number; days: number }>
  >
> = {
  small: { seats: 2_000, seatCost: 150_000, days: 90 },
  medium: { seats: 5_000, seatCost: 180_000, days: 150 },
  large: { seats: 10_000, seatCost: 220_000, days: 240 },
};

/**
 * Works the club can order, priced by the server (the client only picks
 * one). Seats stop at {@link STADIUM_MAX_CAPACITY}; a stadium with works
 * already running offers none.
 */
export function stadiumExpansionPlans(
  stadium: Stadium,
): readonly StadiumExpansionPlan[] {
  if (stadium.expansion !== undefined) return Object.freeze([]);
  const room = STADIUM_MAX_CAPACITY - stadium.capacity;
  return Object.freeze(
    (Object.keys(EXPANSION_PLANS) as StadiumExpansionPlanId[]).flatMap((id) => {
      const plan = EXPANSION_PLANS[id];
      const seats = Math.min(plan.seats, room);
      if (seats < 100) return [];
      return [
        Object.freeze({
          id,
          addedCapacity: seats,
          cost: (seats * plan.seatCost) as Money,
          days: plan.days,
        }),
      ];
    }),
  );
}

export type StadiumMaintenancePlanId =
  'repairs' | 'renovation' | 'modernization';

export interface StadiumMaintenancePlan {
  readonly id: StadiumMaintenancePlanId;
  /** Quality points the work restores (never past 100). */
  readonly qualityGain: number;
  readonly cost: Money;
}

/** Quality points and cost per seat (minor units) of each one-off work. */
const MAINTENANCE_PLANS: Readonly<
  Record<StadiumMaintenancePlanId, Readonly<{ gain: number; seatCost: number }>>
> = {
  repairs: { gain: 10, seatCost: 1_500 },
  renovation: { gain: 25, seatCost: 3_500 },
  modernization: { gain: 45, seatCost: 7_000 },
};

/**
 * One-off maintenance the club can pay for, priced by stadium size. A work
 * that would pass 100 restores only the missing points and costs pro rata.
 */
export function stadiumMaintenancePlans(
  stadium: Stadium,
): readonly StadiumMaintenancePlan[] {
  const missing = 100 - stadium.quality;
  return Object.freeze(
    (Object.keys(MAINTENANCE_PLANS) as StadiumMaintenancePlanId[]).flatMap(
      (id) => {
        const plan = MAINTENANCE_PLANS[id];
        const gain = Math.min(plan.gain, missing);
        if (gain <= 0) return [];
        return [
          Object.freeze({
            id,
            qualityGain: gain,
            cost: Math.max(
              1,
              Math.round((stadium.capacity * plan.seatCost * gain) / plan.gain),
            ) as Money,
          }),
        ];
      },
    ),
  );
}

export function maintainStadium(
  stadium: Stadium,
  qualityGain: number,
  onDate: string,
): Stadium {
  if (!Number.isInteger(qualityGain) || qualityGain <= 0)
    throw new DomainError('INVALID_VALUE', 'maintenance must restore quality');
  return createStadium({
    ...stadium,
    quality: Math.min(100, stadium.quality + qualityGain),
    lastMaintenanceOn: onDate,
  });
}

/** Wear of the stands and pitch; quality never drops below zero. */
export function wearStadium(stadium: Stadium, points: number): Stadium {
  if (!Number.isInteger(points) || points < 0)
    throw new DomainError('INVALID_VALUE', 'stadium wear must be natural');
  if (points === 0 || stadium.quality === 0) return stadium;
  return createStadium({
    ...stadium,
    quality: Math.max(0, stadium.quality - points),
  });
}
