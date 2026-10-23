import { DomainError } from './errors.js';
import type { ClubId, Player, PlayerId } from './entities.js';
import type { Money, Position } from './values.js';

export type ContractStatus = 'active' | 'expiring' | 'expired' | 'terminated';
export interface PlayerContract {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly clubId: ClubId;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly wage: Money;
  readonly status: ContractStatus;
  readonly terminationCost: Money;
  readonly revision: number;
}

export function createContract(contract: PlayerContract): PlayerContract {
  if (
    contract.id.trim().length === 0 ||
    contract.startsOn > contract.endsOn ||
    !Number.isSafeInteger(contract.wage) ||
    contract.wage < 0 ||
    !Number.isSafeInteger(contract.terminationCost) ||
    contract.terminationCost < 0 ||
    !Number.isSafeInteger(contract.revision) ||
    contract.revision < 1
  )
    throw new DomainError('INVALID_ENTITY', 'invalid player contract');
  return Object.freeze({ ...contract });
}

export interface ContractAlert {
  readonly contractId: string;
  readonly playerId: PlayerId;
  readonly kind: 'expires_soon' | 'expired';
  readonly daysRemaining: number;
}

const millisecondsPerDay = 86_400_000;
const dayDistance = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      millisecondsPerDay,
  );

export function contractAlerts(
  contracts: readonly PlayerContract[],
  onDate: string,
  horizonDays = 90,
): readonly ContractAlert[] {
  return Object.freeze(
    contracts
      .filter(({ status }) => status === 'active' || status === 'expiring')
      .map((contract) => ({
        contract,
        days: dayDistance(onDate, contract.endsOn),
      }))
      .filter(({ days }) => days <= horizonDays)
      .sort(
        (a, b) => a.days - b.days || a.contract.id.localeCompare(b.contract.id),
      )
      .map(({ contract, days }) =>
        Object.freeze({
          contractId: contract.id,
          playerId: contract.playerId,
          kind: days < 0 ? ('expired' as const) : ('expires_soon' as const),
          daysRemaining: Math.max(0, days),
        }),
      ),
  );
}

export interface RenewalProposal {
  readonly wage: Money;
  readonly endsOn: string;
}

export function evaluateRenewal(
  contract: PlayerContract,
  proposal: RenewalProposal,
  player: Pick<Player, 'age' | 'strength' | 'hidden'>,
  clubReputation: number,
  /** Coach negotiation factor (ADR 0007); 1 is neutral. */
  priceFactor = 1,
): 'accept' | 'refuse' {
  if (contract.status === 'terminated' || contract.status === 'expired')
    return 'refuse';
  if (proposal.endsOn <= contract.endsOn || proposal.wage < 0) return 'refuse';
  const ageFactor = player.age >= 34 ? 0.88 : player.age <= 22 ? 1.05 : 1;
  const ambition = 0.72 + Number(player.hidden.professionalism) / 250;
  const expected = Math.floor(
    (Number(contract.wage) * ageFactor * ambition +
      Number(player.strength) * 100 +
      (100 - clubReputation) * 20) *
      priceFactor,
  );
  return proposal.wage >= expected ? 'accept' : 'refuse';
}

export function renewContract(
  contract: PlayerContract,
  proposal: RenewalProposal,
): PlayerContract {
  if (contract.status === 'terminated' || contract.status === 'expired')
    throw new DomainError(
      'INVALID_ENTITY',
      'inactive contract cannot be renewed',
    );
  return createContract({
    ...contract,
    endsOn: proposal.endsOn,
    wage: proposal.wage,
    status: 'active',
    revision: contract.revision + 1,
  });
}

export function terminateContract(contract: PlayerContract): PlayerContract {
  if (contract.status === 'terminated' || contract.status === 'expired')
    throw new DomainError('INVALID_ENTITY', 'contract is already inactive');
  return createContract({
    ...contract,
    status: 'terminated',
    revision: contract.revision + 1,
  });
}

export function freeAgentIds(
  players: readonly Pick<Player, 'id' | 'clubId'>[],
  contracts: readonly PlayerContract[],
): readonly PlayerId[] {
  const active = new Set(
    contracts
      .filter(({ status }) => status === 'active' || status === 'expiring')
      .map(({ playerId }) => playerId),
  );
  return Object.freeze(
    players
      .filter((player) => player.clubId === undefined && !active.has(player.id))
      .map(({ id }) => id),
  );
}

export type TransferKind = 'buy' | 'loan';
export type OfferStatus =
  'pending' | 'countered' | 'accepted' | 'rejected' | 'cancelled';
export interface TransferOffer {
  readonly id: string;
  readonly kind: TransferKind;
  readonly playerId: PlayerId;
  readonly fromClubId?: ClubId;
  readonly toClubId: ClubId;
  readonly fee: Money;
  readonly wage: Money;
  readonly createdOn: string;
  readonly expiresOn: string;
  readonly status: OfferStatus;
  readonly revision: number;
  readonly counterOf?: string;
  readonly loan?: Readonly<{
    endsOn: string;
    wageSharePercentage: number;
    optionToBuy?: Money;
  }>;
}

export function createTransferOffer(offer: TransferOffer): TransferOffer {
  if (
    offer.id.trim().length === 0 ||
    offer.fromClubId === offer.toClubId ||
    offer.createdOn > offer.expiresOn ||
    offer.fee < 0 ||
    offer.wage < 0 ||
    !Number.isSafeInteger(offer.fee) ||
    !Number.isSafeInteger(offer.wage) ||
    !Number.isSafeInteger(offer.revision) ||
    offer.revision < 1
  )
    throw new DomainError('INVALID_ENTITY', 'invalid transfer offer');
  if (
    (offer.kind === 'loan') !== (offer.loan !== undefined) ||
    (offer.loan !== undefined &&
      (offer.loan.endsOn <= offer.createdOn ||
        !Number.isInteger(offer.loan.wageSharePercentage) ||
        offer.loan.wageSharePercentage < 0 ||
        offer.loan.wageSharePercentage > 100))
  )
    throw new DomainError('INVALID_ENTITY', 'invalid loan terms');
  return Object.freeze({
    ...offer,
    ...(offer.loan === undefined
      ? {}
      : { loan: Object.freeze({ ...offer.loan }) }),
  });
}

export function transitionOffer(
  offer: TransferOffer,
  status: Exclude<OfferStatus, 'pending'>,
): TransferOffer {
  if (offer.status !== 'pending')
    throw new DomainError(
      'INVALID_ENTITY',
      'only pending offers can transition',
    );
  return createTransferOffer({
    ...offer,
    status,
    revision: offer.revision + 1,
  });
}

export function counterOffer(
  offer: TransferOffer,
  id: string,
  terms: Pick<TransferOffer, 'fee' | 'wage' | 'expiresOn'>,
): readonly [TransferOffer, TransferOffer] {
  const original = transitionOffer(offer, 'countered');
  const counter = createTransferOffer({
    ...offer,
    ...terms,
    id,
    ...(offer.fromClubId === undefined ? {} : { fromClubId: offer.fromClubId }),
    createdOn: offer.createdOn,
    status: 'pending',
    revision: 1,
    counterOf: offer.id,
  });
  return Object.freeze([original, counter]);
}

export interface LoanRecord {
  readonly offerId: string;
  readonly playerId: PlayerId;
  readonly owningClubId: ClubId;
  readonly borrowingClubId: ClubId;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: 'active' | 'returned';
}

export function completeAcceptedOffer(
  offer: TransferOffer,
  player: Player,
): { readonly player: Player; readonly loan?: LoanRecord } {
  if (offer.status !== 'accepted')
    throw new DomainError(
      'INVALID_ENTITY',
      'offer must be accepted before completion',
    );
  if (offer.fromClubId !== undefined && player.clubId !== offer.fromClubId)
    throw new DomainError('INVALID_ENTITY', 'seller does not own player');
  if (offer.kind === 'buy')
    return Object.freeze({
      player: Object.freeze({ ...player, clubId: offer.toClubId }),
    });
  if (offer.fromClubId === undefined || offer.loan === undefined)
    throw new DomainError(
      'INVALID_ENTITY',
      'loan requires an owning club and terms',
    );
  return Object.freeze({
    player: Object.freeze({ ...player, clubId: offer.toClubId }),
    loan: Object.freeze({
      offerId: offer.id,
      playerId: player.id,
      owningClubId: offer.fromClubId,
      borrowingClubId: offer.toClubId,
      startsOn: offer.createdOn,
      endsOn: offer.loan.endsOn,
      status: 'active',
    }),
  });
}

export function returnLoan(
  loan: LoanRecord,
  player: Player,
  onDate: string,
): { readonly loan: LoanRecord; readonly player: Player } {
  if (
    loan.status !== 'active' ||
    onDate < loan.endsOn ||
    player.clubId !== loan.borrowingClubId
  )
    throw new DomainError('INVALID_ENTITY', 'loan cannot return yet');
  return Object.freeze({
    loan: Object.freeze({ ...loan, status: 'returned' }),
    player: Object.freeze({ ...player, clubId: loan.owningClubId }),
  });
}

export interface MarketFilter {
  readonly text?: string | undefined;
  readonly position?: Position | undefined;
  readonly minStrength?: number | undefined;
  readonly maxAge?: number | undefined;
  readonly maxValue?: Money | undefined;
  readonly freeAgentsOnly?: boolean | undefined;
}

export interface MarketPlayerView {
  readonly id: PlayerId;
  readonly name: string;
  readonly age: number;
  readonly position: Position;
  readonly strength: number;
  readonly value: Money;
  readonly wage: Money;
  readonly clubId?: ClubId;
}

export function searchTransferMarket(
  players: readonly Player[],
  filter: MarketFilter,
): readonly MarketPlayerView[] {
  const text = filter.text?.trim().toLocaleLowerCase('pt-BR');
  return Object.freeze(
    players
      .filter(
        (player) =>
          (text === undefined ||
            player.name.toLocaleLowerCase('pt-BR').includes(text)) &&
          (filter.position === undefined ||
            player.position === filter.position ||
            player.secondaryPositions.includes(filter.position)) &&
          (filter.minStrength === undefined ||
            Number(player.strength) >= filter.minStrength) &&
          (filter.maxAge === undefined || player.age <= filter.maxAge) &&
          (filter.maxValue === undefined || player.value <= filter.maxValue) &&
          (filter.freeAgentsOnly !== true || player.clubId === undefined),
      )
      .sort(
        (a, b) =>
          Number(b.strength) - Number(a.strength) || a.id.localeCompare(b.id),
      )
      .map(({ id, name, age, position, strength, value, salary, clubId }) =>
        Object.freeze({
          id,
          name,
          age,
          position,
          strength: Number(strength),
          value,
          wage: salary,
          ...(clubId === undefined ? {} : { clubId }),
        }),
      ),
  );
}

export type HiddenEstimate = 'low' | 'average' | 'good' | 'excellent';
const estimate = (value: number): HiddenEstimate =>
  value < 40
    ? 'low'
    : value < 60
      ? 'average'
      : value < 80
        ? 'good'
        : 'excellent';

export interface ScoutingReport {
  readonly playerId: PlayerId;
  readonly observedOn: string;
  readonly confidence: number;
  readonly estimates: Readonly<Record<keyof Player['hidden'], HiddenEstimate>>;
}

export function scoutPlayer(
  player: Player,
  observedOn: string,
  confidence = 50,
): ScoutingReport {
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 100)
    throw new DomainError(
      'INVALID_VALUE',
      'scouting confidence must be from 1 to 100',
    );
  return Object.freeze({
    playerId: player.id,
    observedOn,
    confidence,
    estimates: Object.freeze({
      potential: estimate(Number(player.hidden.potential)),
      consistency: estimate(Number(player.hidden.consistency)),
      injuryProneness: estimate(100 - Number(player.hidden.injuryProneness)),
      adaptation: estimate(Number(player.hidden.adaptation)),
      professionalism: estimate(Number(player.hidden.professionalism)),
      bigGame: estimate(Number(player.hidden.bigGame)),
    }),
  });
}

export interface ClubTransferProfile {
  readonly clubId: ClubId;
  readonly balance: Money;
  readonly wageCeiling: Money;
  readonly reputation: number;
  readonly minimumSquadSize: number;
  readonly maximumSquadSize: number;
  readonly needs: readonly Position[];
}

export function decideClubOffer(
  offer: TransferOffer,
  player: Player,
  buyer: ClubTransferProfile,
  seller: ClubTransferProfile | undefined,
  buyerSquad: readonly Player[],
  sellerSquad: readonly Player[],
  /** Coach negotiation factor (ADR 0007); 1 is neutral. */
  priceFactor = 1,
): 'accept' | 'counter' | 'reject' {
  if (offer.toClubId !== buyer.clubId || offer.status !== 'pending')
    return 'reject';
  if (
    buyerSquad.length >= buyer.maximumSquadSize ||
    offer.fee > buyer.balance ||
    offer.wage > buyer.wageCeiling
  )
    return 'reject';
  const needed = buyer.needs.includes(player.position);
  const reputationFit = Number(player.strength) <= buyer.reputation + 35;
  const ageFit = player.age <= 34 || (needed && player.age <= 37);
  if (!needed && buyerSquad.length >= buyer.minimumSquadSize) return 'reject';
  if (!reputationFit || !ageFit) return 'reject';
  if (seller !== undefined && sellerSquad.length <= seller.minimumSquadSize)
    return 'reject';
  const fairValue =
    Number(player.value) *
    (needed ? 1.15 : 1) *
    (player.age <= 23 ? 1.1 : 1) *
    priceFactor;
  if (offer.fee >= Math.floor(fairValue * 0.92)) return 'accept';
  return offer.fee >= Math.floor(fairValue * 0.65) ? 'counter' : 'reject';
}

/** Catalog squad cap (docs/adr/0008): no transfer may push a squad above it. */
export const MAX_SQUAD_SIZE = 35;
/** AI clubs never sell below this squad size. */
export const AI_MINIMUM_SQUAD_SIZE = 22;
export const MARKET_AI_RULES_VERSION = 'market-ai-v1' as const;

/** Fewest players per primary position a squad needs; below it the club buys. */
export const POSITION_MINIMUMS: Readonly<Record<Position, number>> =
  Object.freeze({
    GK: 2,
    RB: 1,
    CB: 3,
    LB: 1,
    DM: 1,
    CM: 2,
    AM: 1,
    RW: 1,
    LW: 1,
    ST: 2,
  });
/** Above this count a position is surplus and the club accepts selling. */
export const POSITION_TARGETS: Readonly<Record<Position, number>> =
  Object.freeze({
    GK: 3,
    RB: 2,
    CB: 4,
    LB: 2,
    DM: 2,
    CM: 3,
    AM: 2,
    RW: 2,
    LW: 2,
    ST: 3,
  });

export type TransferListing =
  | Readonly<{
      playerId: PlayerId;
      clubId: ClubId;
      mode: 'sale';
      askingPrice: Money;
      listedOn: string;
    }>
  | Readonly<{
      playerId: PlayerId;
      clubId: ClubId;
      mode: 'loan';
      durationMonths: number;
      wageSharePercentage: number;
      listedOn: string;
    }>;

export function createTransferListing(
  listing: TransferListing,
): TransferListing {
  if (
    listing.mode === 'sale' &&
    (!Number.isSafeInteger(listing.askingPrice) || listing.askingPrice < 0)
  )
    throw new DomainError('INVALID_ENTITY', 'invalid asking price');
  if (
    listing.mode === 'loan' &&
    (!Number.isInteger(listing.durationMonths) ||
      listing.durationMonths < 1 ||
      listing.durationMonths > 12 ||
      !Number.isInteger(listing.wageSharePercentage) ||
      listing.wageSharePercentage < 0 ||
      listing.wageSharePercentage > 100)
  )
    throw new DomainError('INVALID_ENTITY', 'invalid loan listing');
  return Object.freeze({ ...listing });
}

/** Position counts of a squad (primary positions only). */
export function positionCounts(
  squad: readonly Pick<Player, 'position'>[],
): Readonly<Record<Position, number>> {
  const counts: Record<Position, number> = {
    GK: 0,
    RB: 0,
    CB: 0,
    LB: 0,
    DM: 0,
    CM: 0,
    AM: 0,
    RW: 0,
    LW: 0,
    ST: 0,
  };
  for (const player of squad) counts[player.position] += 1;
  return counts;
}

/** True when the player is among the 11 strongest of the squad. */
export function isKeyPlayer(
  player: Pick<Player, 'id' | 'strength'>,
  squad: readonly Pick<Player, 'id' | 'strength'>[],
): boolean {
  const stronger = squad.filter(
    (other) =>
      other.id !== player.id &&
      (Number(other.strength) > Number(player.strength) ||
        (Number(other.strength) === Number(player.strength) &&
          other.id < player.id)),
  ).length;
  return stronger < 11;
}

export interface SellerContext {
  readonly player: Pick<
    Player,
    'id' | 'age' | 'position' | 'strength' | 'value'
  >;
  readonly sellerSquad: readonly Pick<Player, 'id' | 'position' | 'strength'>[];
  readonly sellerReputation: number;
  /** Contract end of the player at the seller; undefined counts as long. */
  readonly contractEndsOn?: string | undefined;
  readonly onDate: string;
  /** Coach negotiation factor of the buyer (ADR 0007); 1 is neutral. */
  readonly priceFactor?: number;
}

/**
 * Price an AI seller asks for one of its players: value adjusted by age,
 * contract length, the player's weight in the squad and positional need.
 */
export function sellerAskingPrice(context: SellerContext): Money {
  const { player, sellerSquad } = context;
  const needed =
    positionCounts(sellerSquad)[player.position] <=
    POSITION_MINIMUMS[player.position];
  const key = isKeyPlayer(player, sellerSquad);
  const age =
    player.age <= 23
      ? 1.15
      : player.age >= 34
        ? 0.75
        : player.age >= 31
          ? 0.9
          : 1;
  const months =
    context.contractEndsOn === undefined
      ? 36
      : dayDistance(context.onDate, context.contractEndsOn) / 30;
  const contract =
    months <= 6 ? 0.7 : months <= 12 ? 0.85 : months >= 36 ? 1.1 : 1;
  const star =
    Number(player.strength) >= context.sellerReputation + 5 ? 1.1 : 1;
  const price =
    Number(player.value) *
    age *
    contract *
    star *
    (key ? 1.25 : 1) *
    (needed ? 1.35 : 1) *
    (context.priceFactor ?? 1);
  return Math.max(0, Math.floor(price)) as Money;
}

export type SellerDecision =
  | Readonly<{ decision: 'accept' }>
  | Readonly<{ decision: 'reject'; reason: string }>
  | Readonly<{ decision: 'counter'; fee: Money }>;

/**
 * How an AI club answers an offer for one of its players (docs/adr/0008):
 * value, age, contract, strength and need. Pure and deterministic.
 */
export function decideSellerResponse(
  offer: Pick<TransferOffer, 'kind' | 'fee' | 'loan'>,
  context: SellerContext,
): SellerDecision {
  if (context.sellerSquad.length <= AI_MINIMUM_SQUAD_SIZE)
    return Object.freeze({ decision: 'reject', reason: 'squad_too_small' });
  const asking = Number(sellerAskingPrice(context));
  const key = isKeyPlayer(context.player, context.sellerSquad);
  const needed =
    positionCounts(context.sellerSquad)[context.player.position] <=
    POSITION_MINIMUMS[context.player.position];
  if (offer.kind === 'loan') {
    if (key || needed)
      return Object.freeze({ decision: 'reject', reason: 'key_player' });
    const share = offer.loan?.wageSharePercentage ?? 0;
    const loanFee = Math.floor(asking * 0.08);
    if (share >= 50 || offer.fee >= loanFee)
      return Object.freeze({ decision: 'accept' });
    return Object.freeze({
      decision: 'counter',
      fee: Math.max(offer.fee + 1, loanFee) as Money,
    });
  }
  if (offer.fee >= asking) return Object.freeze({ decision: 'accept' });
  if (offer.fee >= Math.floor(asking * 0.75))
    return Object.freeze({
      decision: 'counter',
      fee: Math.max(offer.fee + 1, asking) as Money,
    });
  return Object.freeze({ decision: 'reject', reason: 'fee_too_low' });
}

/**
 * Highest fee an AI buyer accepts after the seller counters its offer: 20%
 * above its own bid, never more than 1.6x value nor its available cash. A
 * loan bidder accepts a loan fee up to 10% of the player's value.
 */
export function buyerCounterLimit(
  originalFee: Money,
  playerValue: Money,
  buyerCash: Money,
  kind: TransferKind = 'buy',
): Money {
  const ceiling =
    kind === 'loan'
      ? Math.max(
          Math.floor(Number(originalFee) * 1.2),
          Math.floor(Number(playerValue) * 0.1),
        )
      : Math.min(
          Math.floor(Number(originalFee) * 1.2),
          Math.floor(Number(playerValue) * 1.6),
        );
  return Math.max(0, Math.min(ceiling, Number(buyerCash))) as Money;
}
