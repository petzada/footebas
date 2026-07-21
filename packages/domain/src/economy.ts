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
  | { readonly type: 'stadium'; readonly projectId: string };

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
      | Extract<LedgerSource, { type: 'prize' }>;
  }>,
): LedgerTransaction {
  assertPositiveAmount(input.amount);
  const incomeAccount =
    input.source.type === 'gate'
      ? (`club:${input.clubId}:income:gate` as const)
      : input.source.type === 'sponsor'
        ? (`club:${input.clubId}:income:sponsor` as const)
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
  readonly quality: number;
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
}

/** Pure demand curve: raising price can never raise attendance for identical context. */
export function calculateAttendance(input: CrowdInput): number {
  if (input.capacity < 1 || input.referencePrice < 1 || input.ticketPrice < 0)
    throw new DomainError('INVALID_VALUE', 'invalid crowd inputs');
  const appeal =
    0.2 +
    input.homeReputation / 250 +
    input.awayReputation / 500 +
    Math.max(0, Math.min(100, input.importance)) / 500 +
    Math.max(-20, Math.min(20, input.recentForm)) / 200;
  const priceRatio = input.ticketPrice / input.referencePrice;
  const priceFactor = Math.max(0.15, Math.min(1.25, 1.35 - priceRatio * 0.45));
  return Math.max(
    0,
    Math.min(input.capacity, Math.floor(input.capacity * appeal * priceFactor)),
  );
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
