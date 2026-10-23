import {
  careerMarketReadModelSchema,
  type CareerMarketQuery,
  type CareerMarketReadModel,
  type CoachMessage,
  type TransferWindowReadModel,
} from '@footebas/contracts';
import {
  MAX_SQUAD_SIZE,
  clubCashBalance,
  searchTransferMarket,
  transferWindowStatus,
  type Money,
  type Player,
  type TransferOffer,
} from '@footebas/domain';
import { clubWageBill } from './career-world-rules.js';
import { MARKET_RULES_VERSION } from './career-market.js';
import type { CareerSnapshot } from './service.js';

export type ClubOrigin = Readonly<{
  origin: 'national' | 'state' | 'foreign';
  country: string;
}>;

const DEFAULT_SEARCH_LIMIT = 30;

const brl = (minor: number): string =>
  (minor / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

/** Who must act next on an offer, seen from the managed club. */
function awaiting(
  offer: TransferOffer,
  managedId: string | undefined,
): 'manager' | 'counterpart' | 'none' {
  if (offer.status !== 'pending' || managedId === undefined) return 'none';
  const managerDecides =
    offer.counterOf === undefined
      ? offer.fromClubId === managedId
      : offer.toClubId === managedId;
  return managerDecides ? 'manager' : 'counterpart';
}

export const decisionIdOf = (offerId: string): string => `decision_${offerId}`;

/** Transfer window state on a date, as the read models expose it. */
export function transferWindowView(date: string): TransferWindowReadModel {
  const status = transferWindowStatus(date);
  return {
    rulesVersion: status.rulesVersion,
    status: status.open ? 'open' : 'closed',
    ...(status.current === undefined
      ? {}
      : {
          current: { ...status.current },
          daysRemaining: status.daysRemaining,
        }),
    next: { ...status.next },
    daysUntilNext: status.daysUntilNext,
    windows: status.windows.map((window) => ({ ...window })),
  };
}

/** Inbox items for proposals that wait for the manager's decision. */
export function transferOfferMessages(
  snapshot: CareerSnapshot,
): CoachMessage[] {
  const managedId = snapshot.world.manager.currentClubId;
  if (managedId === undefined) return [];
  const clubName = new Map(snapshot.clubs.map(({ id, name }) => [id, name]));
  const playerName = new Map(
    snapshot.players.map(({ id, name }) => [id, name]),
  );
  return snapshot.world.offers
    .filter((offer) => awaiting(offer, managedId) === 'manager')
    .map((offer) => {
      const incoming = offer.counterOf === undefined;
      const counterpartId = incoming ? offer.toClubId : offer.fromClubId;
      const club =
        (counterpartId === undefined
          ? undefined
          : clubName.get(counterpartId)) ?? 'Um clube';
      const player = playerName.get(offer.playerId) ?? 'um atleta';
      const terms =
        offer.kind === 'loan' && offer.loan !== undefined
          ? `empréstimo até ${offer.loan.endsOn}, com ${String(offer.loan.wageSharePercentage)}% do salário pago por eles${offer.fee > 0 ? ` e taxa de ${brl(Number(offer.fee))}` : ''}`
          : `${brl(Number(offer.fee))} e salário de ${brl(Number(offer.wage))} por mês`;
      return {
        id: `mail_${offer.id}`,
        kind: 'transfer_offer' as const,
        subject: incoming
          ? `Proposta do ${club} por ${player}`
          : `Contraproposta do ${club} por ${player}`,
        body: incoming
          ? `O ${club} quer ${player}: ${terms}. A proposta vale até ${offer.expiresOn}.`
          : `O ${club} respondeu à sua oferta por ${player}: ${terms}. Vale até ${offer.expiresOn}.`,
        occurredOn: offer.createdOn,
        decision: {
          id: decisionIdOf(offer.id),
          offerId: offer.id,
          options: incoming
            ? (['accept', 'reject', 'counter'] as const).slice()
            : (['accept', 'reject'] as const).slice(),
          expiresOn: offer.expiresOn,
        },
      };
    });
}

export interface CareerMarketInput {
  readonly careerId: string;
  readonly aggregateVersion: number;
  readonly projectedAt: string;
  readonly snapshot: CareerSnapshot;
  readonly query: CareerMarketQuery;
  readonly origins: ReadonlyMap<string, ClubOrigin>;
}

/** Market screen: cash, window, squad, list, offers, loans and search. */
export function projectCareerMarket(
  input: CareerMarketInput,
): CareerMarketReadModel {
  const { snapshot, query } = input;
  const { world } = snapshot;
  const managedId = world.manager.currentClubId;
  const club = snapshot.clubs.find(({ id }) => id === managedId);
  const clubName = new Map(snapshot.clubs.map(({ id, name }) => [id, name]));
  const players = new Map<string, Player>(
    snapshot.players.map((player) => [player.id, player]),
  );
  const nameOf = (id: string) => players.get(id)?.name ?? id;
  const listings = (world.market?.listings ?? []).filter(
    ({ clubId }) => clubId === managedId,
  );
  const listed = new Set<string>(listings.map(({ playerId }) => playerId));
  const offerView = (offer: TransferOffer) => {
    const counterpartId =
      offer.fromClubId === managedId ? offer.toClubId : offer.fromClubId;
    const next = awaiting(offer, managedId);
    return {
      id: offer.id,
      kind: offer.kind,
      playerId: offer.playerId,
      playerName: nameOf(offer.playerId),
      ...(counterpartId === undefined
        ? {}
        : {
            counterpartClubId: counterpartId,
            counterpartClubName: clubName.get(counterpartId) ?? counterpartId,
          }),
      fee: Number(offer.fee),
      wage: Number(offer.wage),
      ...(offer.loan === undefined
        ? {}
        : {
            loan: {
              endsOn: offer.loan.endsOn,
              wageSharePercentage: offer.loan.wageSharePercentage,
            },
          }),
      status: offer.status,
      createdOn: offer.createdOn,
      expiresOn: offer.expiresOn,
      ...(offer.counterOf === undefined ? {} : { counterOf: offer.counterOf }),
      awaiting: next,
      ...(next === 'manager' ? { decisionId: decisionIdOf(offer.id) } : {}),
    };
  };
  const newestFirst = (left: TransferOffer, right: TransferOffer) =>
    right.createdOn.localeCompare(left.createdOn) ||
    right.id.localeCompare(left.id);
  const offers =
    managedId === undefined ? [] : [...world.offers].sort(newestFirst);
  const { origin, includeOwnSquad, limit, maxValue, ...filters } = query;
  const matches = searchTransferMarket(snapshot.players, {
    ...filters,
    ...(maxValue === undefined ? {} : { maxValue: maxValue as Money }),
  }).filter((player) => {
    if (includeOwnSquad !== true && player.clubId === managedId) return false;
    if (origin === undefined || origin === 'all') return true;
    const clubOrigin =
      player.clubId === undefined
        ? undefined
        : input.origins.get(player.clubId)?.origin;
    return origin === 'foreign'
      ? clubOrigin === 'foreign'
      : clubOrigin !== 'foreign';
  });
  return careerMarketReadModelSchema.parse({
    version: 1,
    careerId: input.careerId,
    aggregateVersion: input.aggregateVersion,
    projectedAt: input.projectedAt,
    rulesVersion: MARKET_RULES_VERSION,
    currentDate: snapshot.currentDate,
    ...(club === undefined
      ? {}
      : {
          club: {
            id: club.id,
            name: club.name,
            cash: Number(clubCashBalance(world.ledger, club.id, club.balance)),
            squadSize: club.squad.length,
            maxSquadSize: MAX_SQUAD_SIZE,
            monthlyWageBill: clubWageBill(world, club.id),
          },
        }),
    window: transferWindowView(snapshot.currentDate),
    listings: listings.flatMap((listing) => {
      const player = players.get(listing.playerId);
      if (player === undefined) return [];
      const common = {
        playerId: listing.playerId,
        playerName: player.name,
        position: player.position,
        strength: Number(player.strength),
        value: Number(player.value),
        listedOn: listing.listedOn,
      };
      return [
        listing.mode === 'sale'
          ? {
              ...common,
              mode: 'sale',
              askingPrice: Number(listing.askingPrice),
            }
          : {
              ...common,
              mode: 'loan',
              durationMonths: listing.durationMonths,
              wageSharePercentage: listing.wageSharePercentage,
            },
      ];
    }),
    offersReceived: offers
      .filter(({ fromClubId }) => fromClubId === managedId)
      .slice(0, 50)
      .map(offerView),
    offersSent: offers
      .filter(({ toClubId }) => toClubId === managedId)
      .slice(0, 50)
      .map(offerView),
    loans: world.loans
      .filter(
        ({ status, owningClubId, borrowingClubId }) =>
          status === 'active' &&
          managedId !== undefined &&
          (owningClubId === managedId || borrowingClubId === managedId),
      )
      .map((loan) => {
        const out = loan.owningClubId === managedId;
        const counterpartId = out ? loan.borrowingClubId : loan.owningClubId;
        return {
          playerId: loan.playerId,
          playerName: nameOf(loan.playerId),
          direction: out ? 'out' : 'in',
          counterpartClubId: counterpartId,
          counterpartClubName: clubName.get(counterpartId) ?? counterpartId,
          startsOn: loan.startsOn,
          endsOn: loan.endsOn,
        };
      }),
    search: {
      total: matches.length,
      results: matches.slice(0, limit ?? DEFAULT_SEARCH_LIMIT).map((player) => {
        const clubOrigin =
          player.clubId === undefined
            ? undefined
            : input.origins.get(player.clubId);
        return {
          ...player,
          value: Number(player.value),
          wage: Number(player.wage),
          ...(player.clubId === undefined
            ? {}
            : { clubName: clubName.get(player.clubId) ?? player.clubId }),
          ...(clubOrigin === undefined
            ? {}
            : { origin: clubOrigin.origin, country: clubOrigin.country }),
          freeAgent: player.clubId === undefined,
          listed: listed.has(player.id),
        };
      }),
    },
  });
}
