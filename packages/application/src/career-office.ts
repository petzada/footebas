/**
 * Office rules (docs/09 decision 8, docs/adr/0011): negotiable sponsorship
 * and fan membership (sócio-torcedor) of the managed club. Pure functions
 * over the career world; every number here is a game parameter, not real data.
 */
import {
  appendLedgerEntry,
  createClubExpenseTransaction,
  createClubIncomeTransaction,
  money,
  type Club,
  type ClubId,
} from '@footebas/domain';
import { hashSeed } from '@footebas/engine';
import type { CareerWorldState, WorldContext } from './career-world-rules.js';
import type { ChemistryState } from './career-chemistry.js';

export const OFFICE_RULES_VERSION = 'career-office-v1';

export type Division = 'serie-a' | 'serie-b' | 'serie-c';
export type MembershipTier = 'basic' | 'intermediate' | 'premium';
export type MatchForm = 'W' | 'D' | 'L';
export type SponsorGoal = 'title' | 'promotion' | 'continental';

export interface SponsorBonuses {
  readonly title: number;
  readonly promotion: number;
  readonly continental: number;
}

export interface SponsorshipOffer {
  id: string;
  clubId: string;
  /** Career season number and calendar year the proposal belongs to. */
  season: number;
  year: number;
  sponsorName: string;
  monthlyValue: number;
  durationMonths: number;
  bonuses: SponsorBonuses;
  terminationFee: number;
  status:
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'withdrawn'
    | 'expired'
    | 'superseded';
  createdOn: string;
  expiresOn: string;
  counter?: { monthlyValue: number; outcome: 'accepted' | 'rejected' };
}

export interface SponsorshipContract {
  id: string;
  offerId: string;
  clubId: string;
  sponsorName: string;
  monthlyValue: number;
  /** First and last month paid, as `YYYY-MM`. */
  startMonth: string;
  endMonth: string;
  bonuses: SponsorBonuses;
  terminationFee: number;
  status: 'active' | 'ended' | 'terminated';
  terminatedOn?: string;
  bonusesPaid: { goal: SponsorGoal; season: number; amount: number }[];
}

export interface FanMembershipPlan {
  monthlyPrice: number;
  tier: MembershipTier;
}

/** Office state inside the career world; absent in saves before ADR 0011. */
export interface CareerOfficeState {
  sponsorOffers: SponsorshipOffer[];
  sponsorContracts: SponsorshipContract[];
  /** `${clubId}|${year}` keys whose three proposals were already generated. */
  generated: string[];
  /** Membership settings per club the manager configured or inherited. */
  membership: Record<string, FanMembershipPlan>;
  /** Chemistry of the managed club (ADR 0011). */
  chemistry: Record<string, ChemistryState>;
}

export class OfficeRuleError extends Error {
  public constructor(
    public readonly code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'FORBIDDEN',
    message: string,
  ) {
    super(message);
  }
}

export function emptyOffice(): CareerOfficeState {
  return {
    sponsorOffers: [],
    sponsorContracts: [],
    generated: [],
    membership: {},
    chemistry: {},
  };
}

const EMPTY_OFFICE: CareerOfficeState = Object.freeze(emptyOffice());

/** Office state for reads; never mutates the world (old saves lack it). */
export function readOffice(
  world: Pick<CareerWorldState, 'office'>,
): CareerOfficeState {
  return world.office ?? EMPTY_OFFICE;
}

/** Office state for writes; creates it on saves from before ADR 0011. */
export function officeOf(world: CareerWorldState): CareerOfficeState {
  world.office ??= emptyOffice();
  return world.office;
}

function nextId(world: CareerWorldState, kind: string): string {
  world.sequence += 1;
  return `${kind}_${String(world.sequence)}`;
}

/** Uniform number in [0, 1) from the career seed and a stable key. */
function roll(seed: string, ...parts: readonly string[]): number {
  return hashSeed([seed, 'office', ...parts].join('|')) / 4_294_967_296;
}

const DAY = 86_400_000;
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
}
export function addMonthsToPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number) as [number, number];
  const index = year * 12 + (month - 1) + months;
  return `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, '0')}`;
}
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return ty * 12 + tm - (fy * 12 + fm);
}
const roundTo = (value: number, step: number): number =>
  Math.max(step, Math.round(value / step) * step);

/** Points per game of up to the last five managed matches (1.5 if none). */
export function pointsPerGame(form: readonly MatchForm[] | undefined): number {
  const recent = (form ?? []).slice(-5);
  if (recent.length === 0) return 1.5;
  const points = recent.reduce(
    (total, result) => total + (result === 'W' ? 3 : result === 'D' ? 1 : 0),
    0,
  );
  return points / recent.length;
}

export function divisionOfClub(
  context: Pick<WorldContext, 'divisions'>,
  clubId: string,
): Division | undefined {
  const divisions = context.divisions;
  if (divisions === undefined) return undefined;
  return (Object.keys(divisions) as Division[]).find((division) =>
    divisions[division].includes(clubId as ClubId),
  );
}

// ---------------------------------------------------------------------------
// Sponsorship
// ---------------------------------------------------------------------------

/** Proposals per club and season. */
export const SPONSOR_OFFERS_PER_SEASON = 3;
/** Days a proposal stays open. */
export const SPONSOR_OFFER_DAYS = 45;
/** Share of the neutral sponsorship the managed club gets without a contract. */
export const SPONSOR_FALLBACK_SHARE = 0.5;
/** Neutral monthly sponsorship of clubs without a contract: share of wages. */
export const NEUTRAL_SPONSOR_SHARE = 0.85;
/** Counter bounds over the proposal and the sponsor's hidden tolerance. */
export const SPONSOR_COUNTER_MAX = 1.5;
const SPONSOR_TOLERANCE_BASE = 0.05;
const SPONSOR_TOLERANCE_SPREAD = 0.1;
/** Reference sponsorship in BRL: k × (reputation − 40)², floor 5 points. */
const SPONSOR_REFERENCE_K = 5_200;
export const SPONSOR_DIVISION_FACTOR: Readonly<Record<Division, number>> = {
  'serie-a': 1,
  'serie-b': 0.95,
  'serie-c': 0.9,
};

interface SponsorProfile {
  readonly value: number;
  readonly months: number;
  readonly bonus: SponsorBonuses;
  readonly feeMonths: number;
}
/** Safe two-year deal, short deal with mid bonuses, long deal paid by goals. */
export const SPONSOR_PROFILES: readonly SponsorProfile[] = Object.freeze([
  {
    value: 1,
    months: 24,
    bonus: { title: 1, promotion: 1, continental: 1 },
    feeMonths: 6,
  },
  {
    value: 0.92,
    months: 12,
    bonus: { title: 2, promotion: 2, continental: 1.5 },
    feeMonths: 3,
  },
  {
    value: 0.8,
    months: 36,
    bonus: { title: 4, promotion: 4, continental: 3 },
    feeMonths: 9,
  },
]);

/** Fictional, generic company names; none is meant to be a real brand. */
export const SPONSOR_NAMES: readonly string[] = Object.freeze([
  'Brisamar Logística',
  'Cerradão Alimentos',
  'Tupãnema Energia',
  'Ventania Telecom',
  'Lumiara Seguros',
  'Pindorama Tintas',
  'Quintalão Atacarejo',
  'Aroeira Vida Saúde',
  'Jatobaí Construtora',
  'Maré Cheia Bebidas',
  'Ipê Dourado Turismo',
  'Serra Anil Mineração',
  'Calango Digital',
  'Sabiá Escola Online',
  'Carcará Cargas',
  'Mandacaru Agronegócio',
  'Pitangueira Cosméticos',
  'Correnteza Têxtil',
  'Guará Crédito',
  'Siriema Calçados',
  'Buritizal Óleos',
  'Tucanaré Pescados',
  'Juriti Móveis',
  'Ventoforte Eólica',
]);

/** Monthly reference sponsorship in minor units. */
export function sponsorReferenceMonthly(
  reputation: number,
  division: Division | undefined,
  form: readonly MatchForm[] | undefined,
): number {
  const points = Math.max(5, reputation - 40);
  const formFactor = 0.9 + pointsPerGame(form) / 15;
  return Math.round(
    SPONSOR_REFERENCE_K *
      points ** 2 *
      SPONSOR_DIVISION_FACTOR[division ?? 'serie-c'] *
      formFactor *
      100,
  );
}

/** The three proposals of one club and season (deterministic). */
export function generateSponsorOffers(input: {
  readonly seed: string;
  readonly club: Pick<Club, 'id' | 'reputation'>;
  readonly division: Division | undefined;
  readonly form: readonly MatchForm[] | undefined;
  readonly season: number;
  readonly date: string;
  readonly nextId: () => string;
}): SponsorshipOffer[] {
  const year = Number(input.date.slice(0, 4));
  const reference = sponsorReferenceMonthly(
    Number(input.club.reputation),
    input.division,
    input.form,
  );
  const names = [...SPONSOR_NAMES]
    .map((name) => ({
      name,
      order: roll(input.seed, 'name', input.club.id, String(year), name),
    }))
    .sort((left, right) => left.order - right.order)
    .slice(0, SPONSOR_OFFERS_PER_SEASON)
    .map(({ name }) => name);
  return SPONSOR_PROFILES.map((profile, index) => {
    const jitter =
      0.95 +
      0.1 *
        roll(input.seed, 'value', input.club.id, String(year), String(index));
    const monthlyValue = roundTo(reference * profile.value * jitter, 100_000);
    const bonus = (factor: number) =>
      factor === 0 ? 0 : roundTo(monthlyValue * factor, 100_000);
    return {
      id: input.nextId(),
      clubId: input.club.id,
      season: input.season,
      year,
      sponsorName: names[index] ?? SPONSOR_NAMES[index] ?? 'Patrocinador',
      monthlyValue,
      durationMonths: profile.months,
      bonuses: {
        title: bonus(profile.bonus.title),
        // A top-flight club cannot be promoted: no promotion bonus.
        promotion:
          input.division === 'serie-a' ? 0 : bonus(profile.bonus.promotion),
        continental: bonus(profile.bonus.continental),
      },
      terminationFee: monthlyValue * profile.feeMonths,
      status: 'pending' as const,
      createdOn: input.date,
      expiresOn: addDays(input.date, SPONSOR_OFFER_DAYS),
    };
  });
}

/** Hidden share above the proposal the sponsor still accepts (5% to 15%). */
export function sponsorTolerance(seed: string, offerId: string): number {
  return (
    SPONSOR_TOLERANCE_BASE +
    SPONSOR_TOLERANCE_SPREAD * roll(seed, 'counter', offerId)
  );
}

export function counterRange(offer: Pick<SponsorshipOffer, 'monthlyValue'>): {
  min: number;
  max: number;
} {
  return {
    min: offer.monthlyValue + 1,
    max: Math.round(offer.monthlyValue * SPONSOR_COUNTER_MAX),
  };
}

/**
 * Daily office upkeep: expires stale proposals, withdraws proposals of clubs
 * the manager no longer runs and generates the season's three proposals.
 */
export function runOfficeDay(
  context: WorldContext,
  date: string,
  seed: string,
  season: number,
): void {
  const { world } = context;
  const managed = world.manager.currentClubId;
  const hasPending = world.office?.sponsorOffers.some(
    ({ status }) => status === 'pending',
  );
  const year = Number(date.slice(0, 4));
  const key = `${managed ?? ''}|${String(year)}`;
  const needsOffers =
    managed !== undefined && !(world.office?.generated ?? []).includes(key);
  if (!hasPending && !needsOffers) return;
  const office = officeOf(world);
  for (const offer of office.sponsorOffers) {
    if (offer.status !== 'pending') continue;
    if (offer.clubId !== managed) offer.status = 'withdrawn';
    else if (offer.expiresOn < date || offer.year < year)
      offer.status = 'expired';
  }
  if (needsOffers) {
    const club = context.clubs.find(({ id }) => id === managed);
    if (club !== undefined) {
      office.sponsorOffers.push(
        ...generateSponsorOffers({
          seed,
          club,
          division: divisionOfClub(context, club.id),
          form: context.managedForm,
          season,
          date,
          nextId: () => nextId(world, 'sponsor_offer'),
        }),
      );
      office.generated = [...office.generated, key].slice(-20);
    }
  }
  // Keep the proposals of the last two seasons only.
  office.sponsorOffers = office.sponsorOffers.filter(
    (offer) => offer.year >= year - 1,
  );
}

function pendingOffer(
  world: CareerWorldState,
  offerId: string,
  date: string,
): SponsorshipOffer {
  const offer = readOffice(world).sponsorOffers.find(
    ({ id }) => id === offerId,
  );
  if (offer === undefined)
    throw new OfficeRuleError('NOT_FOUND', 'sponsorship offer not found');
  if (offer.clubId !== world.manager.currentClubId)
    throw new OfficeRuleError(
      'FORBIDDEN',
      'sponsorship offer belongs to another club',
    );
  if (offer.status !== 'pending' || offer.expiresOn < date)
    throw new OfficeRuleError(
      'VALIDATION_ERROR',
      `sponsorship offer is ${offer.status === 'pending' ? 'expired' : offer.status}`,
    );
  return offer;
}

export function activeSponsorContract(
  world: Pick<CareerWorldState, 'office'>,
  clubId: string,
): SponsorshipContract | undefined {
  return readOffice(world).sponsorContracts.find(
    (contract) => contract.clubId === clubId && contract.status === 'active',
  );
}

/** Signs a contract from a proposal, ending the current one with its fee. */
function signSponsorContract(
  world: CareerWorldState,
  offer: SponsorshipOffer,
  monthlyValue: number,
  date: string,
): SponsorshipContract {
  const office = officeOf(world);
  const current = activeSponsorContract(world, offer.clubId);
  if (current !== undefined) {
    current.status = 'terminated';
    current.terminatedOn = date;
    if (current.terminationFee > 0)
      world.ledger = appendLedgerEntry(
        world.ledger,
        createClubExpenseTransaction({
          id: nextId(world, 'ledger'),
          occurredAt: date,
          clubId: offer.clubId as ClubId,
          amount: money(current.terminationFee),
          source: { type: 'sponsor_termination', agreementId: current.id },
        }),
      );
  }
  const ratio = monthlyValue / offer.monthlyValue;
  const scale = (value: number) => Math.round(value * ratio);
  const contract: SponsorshipContract = {
    id: nextId(world, 'sponsor_contract'),
    offerId: offer.id,
    clubId: offer.clubId,
    sponsorName: offer.sponsorName,
    monthlyValue,
    startMonth: world.openMonth,
    endMonth: addMonthsToPeriod(world.openMonth, offer.durationMonths - 1),
    bonuses: offer.bonuses,
    terminationFee: scale(offer.terminationFee),
    status: 'active',
    bonusesPaid: [],
  };
  office.sponsorContracts = [...office.sponsorContracts, contract].slice(-12);
  offer.status = 'accepted';
  for (const other of office.sponsorOffers)
    if (
      other.id !== offer.id &&
      other.clubId === offer.clubId &&
      other.status === 'pending'
    )
      other.status = 'superseded';
  return contract;
}

export function decideSponsorOffer(
  world: CareerWorldState,
  offerId: string,
  decision: 'accept' | 'reject',
  date: string,
): void {
  const offer = pendingOffer(world, offerId, date);
  if (decision === 'reject') {
    offer.status = 'rejected';
    return;
  }
  signSponsorContract(world, offer, offer.monthlyValue, date);
}

/**
 * One counter per proposal. Within the sponsor's hidden tolerance the
 * contract is signed at the asked value; above it the sponsor walks away.
 */
export function counterSponsorOffer(
  world: CareerWorldState,
  offerId: string,
  monthlyValue: number,
  date: string,
  seed: string,
): 'accepted' | 'rejected' {
  const offer = pendingOffer(world, offerId, date);
  if (offer.counter !== undefined)
    throw new OfficeRuleError(
      'VALIDATION_ERROR',
      'sponsorship offer was already countered',
    );
  const range = counterRange(offer);
  if (monthlyValue < range.min || monthlyValue > range.max)
    throw new OfficeRuleError(
      'VALIDATION_ERROR',
      `counter must be between ${String(range.min)} and ${String(range.max)}`,
    );
  const accepted =
    monthlyValue <=
    Math.floor(offer.monthlyValue * (1 + sponsorTolerance(seed, offer.id)));
  offer.counter = { monthlyValue, outcome: accepted ? 'accepted' : 'rejected' };
  if (accepted) signSponsorContract(world, offer, monthlyValue, date);
  else offer.status = 'withdrawn';
  return offer.counter.outcome;
}

/**
 * Sponsorship a club receives for one settled month: its contract, the
 * reduced one-off sponsorship for the managed club without a contract, or
 * the neutral share of wages for every other club.
 */
export function sponsorshipForMonth(
  world: Pick<CareerWorldState, 'office' | 'manager'>,
  clubId: string,
  period: string,
  wageBill: number,
): { amount: number; agreementId: string } {
  const contract = activeSponsorContract(world, clubId);
  if (
    contract !== undefined &&
    contract.startMonth <= period &&
    period <= contract.endMonth
  )
    return { amount: contract.monthlyValue, agreementId: contract.id };
  const neutral = Math.round(wageBill * NEUTRAL_SPONSOR_SHARE);
  return {
    amount:
      clubId === world.manager.currentClubId
        ? Math.round(neutral * SPONSOR_FALLBACK_SHARE)
        : neutral,
    agreementId: `sponsor_${clubId}`,
  };
}

/** Marks contracts whose last month was settled as ended. */
export function closeSponsorMonth(
  world: CareerWorldState,
  period: string,
): void {
  for (const contract of world.office?.sponsorContracts ?? [])
    if (contract.status === 'active' && contract.endMonth <= period)
      contract.status = 'ended';
}

export interface SeasonGoals {
  readonly season: number;
  readonly year: number;
  /** National or continental champions (state titles excluded). */
  readonly titleClubIds: readonly string[];
  readonly promotedClubIds: readonly string[];
  readonly continentalClubIds: readonly string[];
}

/**
 * Season-end bonuses of every contract that covered December and was not
 * terminated, paid as sponsorship income in the ledger.
 */
export function paySponsorBonuses(
  world: CareerWorldState,
  goals: SeasonGoals,
): void {
  const december = `${String(goals.year)}-12`;
  const occurredAt = `${String(goals.year)}-12-20`;
  for (const contract of world.office?.sponsorContracts ?? []) {
    if (
      contract.status === 'terminated' ||
      contract.startMonth > december ||
      contract.endMonth < december
    )
      continue;
    const reached: SponsorGoal[] = [];
    if (goals.titleClubIds.includes(contract.clubId)) reached.push('title');
    if (goals.promotedClubIds.includes(contract.clubId))
      reached.push('promotion');
    if (goals.continentalClubIds.includes(contract.clubId))
      reached.push('continental');
    for (const goal of reached) {
      const amount = contract.bonuses[goal];
      if (
        amount <= 0 ||
        contract.bonusesPaid.some(
          (paid) => paid.goal === goal && paid.season === goals.season,
        )
      )
        continue;
      world.ledger = appendLedgerEntry(
        world.ledger,
        createClubIncomeTransaction({
          id: nextId(world, 'ledger'),
          occurredAt,
          clubId: contract.clubId as ClubId,
          amount: money(amount),
          source: {
            type: 'sponsor',
            agreementId: contract.id,
            period: `${String(goals.year)}-bonus-${goal}`,
          },
        }),
      );
      contract.bonusesPaid.push({ goal, season: goals.season, amount });
    }
  }
}

// ---------------------------------------------------------------------------
// Fan membership (sócio-torcedor)
// ---------------------------------------------------------------------------

export const MEMBERSHIP_PRICE_MIN = 500;
export const MEMBERSHIP_PRICE_MAX = 20_000;
/** Cost per member per month (minor units), appeal and value perception. */
export const MEMBERSHIP_TIER_TABLE: Readonly<
  Record<
    MembershipTier,
    { costPerMember: number; appeal: number; satisfaction: number }
  >
> = Object.freeze({
  basic: { costPerMember: 200, appeal: 0.85, satisfaction: 0.75 },
  intermediate: { costPerMember: 600, appeal: 1, satisfaction: 1 },
  premium: { costPerMember: 1_400, appeal: 1.15, satisfaction: 1.25 },
});
/** Member pool: k × (reputation − 35)^1.5 × division factor. */
const MEMBERSHIP_POOL_K = 150;
export const MEMBERSHIP_DIVISION_FACTOR: Readonly<Record<Division, number>> = {
  'serie-a': 1,
  'serie-b': 0.6,
  'serie-c': 0.35,
};
const MEMBERSHIP_DEFAULT_PRICE_FACTOR: Readonly<Record<Division, number>> = {
  'serie-a': 1,
  'serie-b': 0.85,
  'serie-c': 0.7,
};
/** Extra attendance: at most 5% of capacity and 10% of the members. */
export const MEMBERSHIP_ATTENDANCE_CAPACITY_SHARE = 0.05;
export const MEMBERSHIP_ATTENDANCE_MEMBER_SHARE = 0.1;
/** Fan confidence change at the season verdict, in points. */
export const MEMBERSHIP_FAN_EFFECT_LIMIT = 3;

export interface MembershipContext {
  readonly reputation: number;
  readonly division: Division | undefined;
  readonly fanConfidence: number;
  readonly form: readonly MatchForm[] | undefined;
}

/** Price (minor units) at which demand is neutral: 10 + 0.40 × reputation BRL. */
export function membershipReferencePrice(reputation: number): number {
  return roundTo(1_000 + reputation * 40, 100);
}

export function membershipPotential(
  reputation: number,
  division: Division | undefined,
): number {
  return Math.floor(
    MEMBERSHIP_POOL_K *
      Math.max(1, reputation - 35) ** 1.5 *
      MEMBERSHIP_DIVISION_FACTOR[division ?? 'serie-c'],
  );
}

/** Initial settings derived from the club's size and division. */
export function defaultMembershipPlan(
  reputation: number,
  division: Division | undefined,
): FanMembershipPlan {
  const price = roundTo(
    membershipReferencePrice(reputation) *
      MEMBERSHIP_DEFAULT_PRICE_FACTOR[division ?? 'serie-c'],
    100,
  );
  return {
    monthlyPrice: Math.min(
      MEMBERSHIP_PRICE_MAX,
      Math.max(MEMBERSHIP_PRICE_MIN, price),
    ),
    tier: division === 'serie-a' ? 'intermediate' : 'basic',
  };
}

/** Members for a plan: pool × price × appeal × fans × form, floored. */
export function membershipMembers(
  plan: FanMembershipPlan,
  context: MembershipContext,
): number {
  const reference = membershipReferencePrice(context.reputation);
  const priceFactor = Math.max(
    0.05,
    Math.min(1.3, 1.6 - (0.6 * plan.monthlyPrice) / reference),
  );
  const fanFactor =
    0.6 + (0.8 * Math.max(0, Math.min(100, context.fanConfidence))) / 100;
  const formFactor = 0.85 + 0.1 * pointsPerGame(context.form);
  return Math.floor(
    membershipPotential(context.reputation, context.division) *
      priceFactor *
      MEMBERSHIP_TIER_TABLE[plan.tier].appeal *
      fanFactor *
      formFactor,
  );
}

export interface MembershipProjection {
  readonly members: number;
  readonly potential: number;
  readonly monthlyRevenue: number;
  readonly monthlyCost: number;
  readonly referencePrice: number;
  readonly fanConfidenceEffect: number;
}

export function projectMembership(
  plan: FanMembershipPlan,
  context: MembershipContext,
): MembershipProjection {
  const members = membershipMembers(plan, context);
  return {
    members,
    potential: membershipPotential(context.reputation, context.division),
    monthlyRevenue: members * plan.monthlyPrice,
    monthlyCost: members * MEMBERSHIP_TIER_TABLE[plan.tier].costPerMember,
    referencePrice: membershipReferencePrice(context.reputation),
    fanConfidenceEffect: membershipFanEffect(plan, context.reputation),
  };
}

/** Extra home attendance from members, limited by capacity and members. */
export function membershipAttendanceBonus(
  members: number,
  capacity: number,
): number {
  return Math.max(
    0,
    Math.min(
      Math.floor(capacity * MEMBERSHIP_ATTENDANCE_CAPACITY_SHARE),
      Math.floor(members * MEMBERSHIP_ATTENDANCE_MEMBER_SHARE),
    ),
  );
}

/**
 * Season-verdict fan confidence change: value perception (tier minus price
 * relative to the reference) × 5, rounded and limited to ±3 points.
 */
export function membershipFanEffect(
  plan: FanMembershipPlan,
  reputation: number,
): number {
  const satisfaction =
    MEMBERSHIP_TIER_TABLE[plan.tier].satisfaction -
    plan.monthlyPrice / membershipReferencePrice(reputation);
  const effect = Math.round(satisfaction * 5) || 0;
  return Math.max(
    -MEMBERSHIP_FAN_EFFECT_LIMIT,
    Math.min(MEMBERSHIP_FAN_EFFECT_LIMIT, effect),
  );
}

/** Settings of a club: what the manager configured or the club's default. */
export function membershipPlanOf(
  context: Pick<WorldContext, 'world' | 'clubs' | 'divisions'>,
  clubId: string,
): FanMembershipPlan | undefined {
  const stored = readOffice(context.world).membership[clubId];
  if (stored !== undefined) return stored;
  const club = context.clubs.find(({ id }) => id === clubId);
  return club === undefined
    ? undefined
    : defaultMembershipPlan(
        Number(club.reputation),
        divisionOfClub(context, clubId),
      );
}

export function membershipContextOf(
  context: Pick<WorldContext, 'world' | 'clubs' | 'divisions' | 'managedForm'>,
  clubId: string,
): MembershipContext | undefined {
  const club = context.clubs.find(({ id }) => id === clubId);
  if (club === undefined) return undefined;
  return {
    reputation: Number(club.reputation),
    division: divisionOfClub(context, clubId),
    fanConfidence: context.world.manager.fanConfidence,
    form: context.managedForm,
  };
}

/** Membership projection of the managed club (undefined without one). */
export function managedMembership(
  context: Pick<WorldContext, 'world' | 'clubs' | 'divisions' | 'managedForm'>,
): (MembershipProjection & { plan: FanMembershipPlan }) | undefined {
  const clubId = context.world.manager.currentClubId;
  if (clubId === undefined) return undefined;
  const plan = membershipPlanOf(context, clubId);
  const membership = membershipContextOf(context, clubId);
  if (plan === undefined || membership === undefined) return undefined;
  return { ...projectMembership(plan, membership), plan };
}

export function configureMembership(
  context: WorldContext,
  plan: FanMembershipPlan,
): void {
  const clubId = context.world.manager.currentClubId;
  if (clubId === undefined)
    throw new OfficeRuleError('FORBIDDEN', 'career does not manage a club');
  if (
    !Number.isSafeInteger(plan.monthlyPrice) ||
    plan.monthlyPrice < MEMBERSHIP_PRICE_MIN ||
    plan.monthlyPrice > MEMBERSHIP_PRICE_MAX
  )
    throw new OfficeRuleError(
      'VALIDATION_ERROR',
      'membership price is outside the allowed range',
    );
  officeOf(context.world).membership[clubId] = {
    monthlyPrice: plan.monthlyPrice,
    tier: plan.tier,
  };
}

/** Membership revenue and benefit costs of the managed club for a month. */
export function settleMembershipMonth(
  context: WorldContext,
  period: string,
  occurredAt: string,
): void {
  const projection = managedMembership(context);
  const clubId = context.world.manager.currentClubId;
  if (projection === undefined || clubId === undefined) return;
  const { world } = context;
  if (projection.monthlyRevenue > 0)
    world.ledger = appendLedgerEntry(
      world.ledger,
      createClubIncomeTransaction({
        id: nextId(world, 'ledger'),
        occurredAt,
        clubId: clubId,
        amount: money(projection.monthlyRevenue),
        source: { type: 'membership', period },
      }),
    );
  if (projection.monthlyCost > 0)
    world.ledger = appendLedgerEntry(
      world.ledger,
      createClubExpenseTransaction({
        id: nextId(world, 'ledger'),
        occurredAt,
        clubId: clubId,
        amount: money(projection.monthlyCost),
        source: { type: 'membership', period },
      }),
    );
}
