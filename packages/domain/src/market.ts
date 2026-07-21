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
): 'accept' | 'refuse' {
  if (contract.status === 'terminated' || contract.status === 'expired')
    return 'refuse';
  if (proposal.endsOn <= contract.endsOn || proposal.wage < 0) return 'refuse';
  const ageFactor = player.age >= 34 ? 0.88 : player.age <= 22 ? 1.05 : 1;
  const ambition = 0.72 + Number(player.hidden.professionalism) / 250;
  const expected = Math.floor(
    Number(contract.wage) * ageFactor * ambition +
      Number(player.strength) * 100 +
      (100 - clubReputation) * 20,
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
    Number(player.value) * (needed ? 1.15 : 1) * (player.age <= 23 ? 1.1 : 1);
  if (offer.fee >= Math.floor(fairValue * 0.92)) return 'accept';
  return offer.fee >= Math.floor(fairValue * 0.65) ? 'counter' : 'reject';
}
