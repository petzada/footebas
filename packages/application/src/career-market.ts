import {
  AI_MINIMUM_SQUAD_SIZE,
  MARKET_AI_RULES_VERSION,
  MAX_SQUAD_SIZE,
  POSITIONS,
  POSITION_MINIMUMS,
  POSITION_TARGETS,
  TRANSFER_WINDOW_RULES_VERSION,
  appendLedgerEntry,
  createContract,
  createTransferOffer,
  isKeyPlayer,
  money,
  positionCounts,
  sellerAskingPrice,
  transferWindowStatus,
  transitionOffer,
  type Club,
  type ClubId,
  type FinancialLedger,
  type LedgerPosting,
  type Money,
  type Player,
  type PlayerId,
} from '@footebas/domain';
import { hashSeed } from '@footebas/engine';
import type {
  CareerMarketState,
  CareerWorldState,
  WorldContext,
} from './career-world-rules.js';

/** Versions of every market rule a save depends on (docs/adr/0008). */
export const MARKET_RULES_VERSION =
  `${MARKET_AI_RULES_VERSION}+${TRANSFER_WINDOW_RULES_VERSION}` as const;

/** New AI proposals for managed players per market day. */
export const MAX_AI_OFFERS_PER_DAY = 2;
/** AI-to-AI transfers per market day. */
export const MAX_AI_TRANSFERS_PER_DAY = 3;
/** Days an AI proposal stays open (never past the window close). */
export const AI_OFFER_DAYS = 7;
/** Resolved offers older than this are pruned (unless they back a loan). */
const OFFER_RETENTION_DAYS = 120;
/** Daily chance that an AI club bids for a managed player. */
const INTEREST = { listed: 0.35, star: 0.1, other: 0.02 } as const;

export function marketOf(world: CareerWorldState): CareerMarketState {
  world.market ??= { listings: [] };
  return world.market;
}

/** Uniform number in [0, 1) from the career seed and a stable key. */
export function marketRoll(seed: string, ...parts: readonly string[]): number {
  return hashSeed([seed, 'market', ...parts].join('|')) / 4_294_967_296;
}

const DAY = 86_400_000;
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
}
function addMonths(date: string, months: number): string {
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCMonth(instant.getUTCMonth() + months);
  return instant.toISOString().slice(0, 10);
}

/** Cash of every club in one pass over the ledger. */
export function cashByClub(
  clubs: readonly Club[],
  ledger: FinancialLedger,
): Map<ClubId, number> {
  const cash = new Map<ClubId, number>(
    clubs.map(({ id, balance }) => [id, Number(balance)]),
  );
  const accounts = new Map<string, ClubId>(
    clubs.map(({ id }) => [`club:${id}:cash`, id]),
  );
  for (const entry of ledger.entries)
    for (const posting of entry.postings) {
      const clubId = accounts.get(posting.account);
      if (clubId !== undefined)
        cash.set(clubId, (cash.get(clubId) ?? 0) + Number(posting.amount));
    }
  return cash;
}

/** Ledger postings of a club-to-club fee; always balances to zero. */
export function transferPostings(
  buyerId: ClubId,
  sellerId: ClubId | undefined,
  fee: Money,
): LedgerPosting[] {
  const postings: LedgerPosting[] = [
    {
      account: `club:${buyerId}:cash`,
      amount: -Number(fee) as Money,
      clubId: buyerId,
    },
    {
      account: `club:${buyerId}:expense:transfer`,
      amount: fee,
      clubId: buyerId,
    },
  ];
  if (sellerId !== undefined)
    postings.push(
      { account: `club:${sellerId}:cash`, amount: fee, clubId: sellerId },
      {
        account: `club:${sellerId}:income:transfer`,
        amount: -Number(fee) as Money,
        clubId: sellerId,
      },
    );
  return postings;
}

function nextId(world: CareerWorldState, kind: string): string {
  world.sequence += 1;
  return `${kind}_${String(world.sequence)}`;
}

function squadsOf(players: readonly Player[]): Map<ClubId, Player[]> {
  const squads = new Map<ClubId, Player[]>();
  for (const player of players) {
    if (player.clubId === undefined) continue;
    const squad = squads.get(player.clubId);
    if (squad === undefined) squads.set(player.clubId, [player]);
    else squad.push(player);
  }
  return squads;
}

/** Players on an active loan, by id, with the borrowing club. */
function activeLoans(world: CareerWorldState): Map<PlayerId, ClubId> {
  return new Map(
    world.loans
      .filter(({ status }) => status === 'active')
      .map(({ playerId, borrowingClubId }) => [playerId, borrowingClubId]),
  );
}

function moveSquadMember(
  context: WorldContext,
  playerId: PlayerId,
  fromClubId: ClubId | undefined,
  toClubId: ClubId,
): void {
  context.clubs = context.clubs.map((club) =>
    club.id === toClubId
      ? {
          ...club,
          squad: [...club.squad.filter((id) => id !== playerId), playerId],
        }
      : club.id === fromClubId
        ? { ...club, squad: club.squad.filter((id) => id !== playerId) }
        : club,
  );
}

/** Loans whose term ended go back to the owning club. */
export function returnDueLoans(context: WorldContext, date: string): void {
  const { world } = context;
  if (
    !world.loans.some((loan) => loan.status === 'active' && loan.endsOn <= date)
  )
    return;
  world.loans = world.loans.map((loan) => {
    if (loan.status !== 'active' || loan.endsOn > date) return loan;
    const player = context.players.find(({ id }) => id === loan.playerId);
    if (player?.clubId === loan.borrowingClubId) {
      context.players = context.players.map((item) =>
        item.id === player.id
          ? { ...item, clubId: loan.owningClubId, squadStatus: 'rotation' }
          : item,
      );
      moveSquadMember(
        context,
        player.id,
        loan.borrowingClubId,
        loan.owningClubId,
      );
    }
    return { ...loan, status: 'returned' as const };
  });
}

/** Expires stale proposals and prunes old resolved ones. */
export function expireOffers(world: CareerWorldState, date: string): void {
  const backingLoans = new Set(
    world.loans
      .filter(({ status }) => status === 'active')
      .map(({ offerId }) => offerId),
  );
  const horizon = addDays(date, -OFFER_RETENTION_DAYS);
  world.offers = world.offers
    .map((offer) =>
      offer.status === 'pending' && offer.expiresOn < date
        ? transitionOffer(offer, 'cancelled')
        : offer,
    )
    .filter(
      (offer) =>
        offer.status === 'pending' ||
        offer.createdOn >= horizon ||
        backingLoans.has(offer.id),
    );
}

/** Drops listings of players who left the managed club. */
export function pruneListings(context: WorldContext): void {
  const market = marketOf(context.world);
  const clubOf = new Map(
    context.players.map(({ id, clubId }) => [id, clubId] as const),
  );
  market.listings = market.listings.filter(
    (listing) => clubOf.get(listing.playerId) === listing.clubId,
  );
}

interface DayState {
  readonly squads: Map<ClubId, Player[]>;
  readonly cash: Map<ClubId, number>;
  readonly reputation: Map<ClubId, number>;
  readonly loans: Map<PlayerId, ClubId>;
}

/**
 * AI clubs bid for managed players: listed players attract most interest,
 * the three strongest some, everyone else a little. One open bid per player.
 */
export function aiOffersForManagedPlayers(
  context: WorldContext,
  date: string,
  seed: string,
  closesOn: string,
  day: DayState,
): void {
  const { world } = context;
  const managedId = world.manager.currentClubId;
  if (managedId === undefined || world.manager.employmentStatus !== 'employed')
    return;
  const squad = day.squads.get(managedId) ?? [];
  const listings = new Map(
    marketOf(world)
      .listings.filter(({ clubId }) => clubId === managedId)
      .map((listing) => [listing.playerId, listing] as const),
  );
  const pending = world.offers.filter(({ status }) => status === 'pending');
  const bidFor = new Set(
    pending
      .filter(({ fromClubId }) => fromClubId === managedId)
      .map(({ playerId }) => playerId),
  );
  const incoming = new Map<ClubId, number>();
  for (const offer of pending)
    incoming.set(offer.toClubId, (incoming.get(offer.toClubId) ?? 0) + 1);
  const stars = new Set(
    [...squad]
      .sort(
        (left, right) =>
          Number(right.strength) - Number(left.strength) ||
          left.id.localeCompare(right.id),
      )
      .slice(0, 3)
      .map(({ id }) => id),
  );
  const chosen = squad
    .filter(
      (player) =>
        !bidFor.has(player.id) && day.loans.get(player.id) !== managedId,
    )
    .map((player) => ({
      player,
      listing: listings.get(player.id),
      roll: marketRoll(seed, 'interest', date, player.id),
    }))
    .filter(
      ({ player, listing, roll }) =>
        roll <
        (listing !== undefined
          ? INTEREST.listed
          : stars.has(player.id)
            ? INTEREST.star
            : INTEREST.other),
    )
    .sort(
      (left, right) =>
        left.roll - right.roll || left.player.id.localeCompare(right.player.id),
    )
    .slice(0, MAX_AI_OFFERS_PER_DAY);
  const expiresOn =
    addDays(date, AI_OFFER_DAYS) < closesOn
      ? addDays(date, AI_OFFER_DAYS)
      : closesOn;
  for (const { player, listing } of chosen) {
    const priceRoll = marketRoll(seed, 'price', date, player.id);
    const loan = listing?.mode === 'loan' ? listing : undefined;
    const fee = (
      loan !== undefined
        ? 0
        : listing?.mode === 'sale'
          ? Math.floor(Number(listing.askingPrice) * (0.85 + 0.2 * priceRoll))
          : Math.floor(Number(player.value) * (1 + 0.3 * priceRoll))
    ) as Money;
    const strength = Number(player.strength);
    const buyer = context.clubs
      .filter((club) => {
        if (club.id === managedId) return false;
        const size =
          (day.squads.get(club.id)?.length ?? 0) + (incoming.get(club.id) ?? 0);
        const reputation = day.reputation.get(club.id) ?? 0;
        return (
          size < MAX_SQUAD_SIZE &&
          (day.cash.get(club.id) ?? 0) >= fee &&
          strength <= reputation + 12 &&
          strength >= reputation - (listing === undefined ? 15 : 25)
        );
      })
      .map((club) => {
        const counts = positionCounts(day.squads.get(club.id) ?? []);
        return {
          club,
          needs: counts[player.position] < POSITION_TARGETS[player.position],
          roll: marketRoll(seed, 'buyer', date, player.id, club.id),
        };
      })
      .sort(
        (left, right) =>
          Number(right.needs) - Number(left.needs) ||
          left.roll - right.roll ||
          left.club.id.localeCompare(right.club.id),
      )[0]?.club;
    if (buyer === undefined) continue;
    const offer = createTransferOffer({
      id: nextId(world, 'market_offer'),
      kind: loan === undefined ? 'buy' : 'loan',
      playerId: player.id,
      fromClubId: managedId,
      toClubId: buyer.id,
      fee,
      wage: money(
        loan === undefined
          ? Math.max(
              Number(player.salary),
              Math.round(Number(player.salary) * 1.1),
            )
          : Number(player.salary),
      ),
      createdOn: date,
      expiresOn,
      status: 'pending',
      revision: 1,
      ...(loan === undefined
        ? {}
        : {
            loan: {
              endsOn: addMonths(date, loan.durationMonths),
              wageSharePercentage: loan.wageSharePercentage,
            },
          }),
    });
    world.offers = [...world.offers, offer];
    incoming.set(buyer.id, (incoming.get(buyer.id) ?? 0) + 1);
  }
}

/** Completes an AI-to-AI purchase: squads, contract and balanced ledger. */
function completeAiTransfer(
  context: WorldContext,
  day: DayState,
  player: Player,
  sellerId: ClubId,
  buyerId: ClubId,
  fee: Money,
  date: string,
): void {
  const { world } = context;
  const offerId = nextId(world, 'market_deal');
  if (fee > 0)
    world.ledger = appendLedgerEntry(world.ledger, {
      id: nextId(world, 'market_ledger'),
      occurredAt: date,
      source: { type: 'transfer', offerId, playerId: player.id },
      postings: transferPostings(buyerId, sellerId, fee),
    });
  const moved: Player = { ...player, clubId: buyerId, squadStatus: 'rotation' };
  context.players = context.players.map((item) =>
    item.id === player.id ? moved : item,
  );
  moveSquadMember(context, player.id, sellerId, buyerId);
  world.contracts = [
    ...world.contracts.filter(
      (contract) =>
        contract.playerId !== player.id ||
        (contract.status !== 'active' && contract.status !== 'expiring'),
    ),
    createContract({
      id: nextId(world, 'market_contract'),
      playerId: player.id,
      clubId: buyerId,
      startsOn: date,
      endsOn: `${String(Number(date.slice(0, 4)) + 2)}-12-31`,
      wage: player.salary,
      status: 'active',
      terminationCost: money(Number(player.salary) * 6),
      revision: 1,
    }),
  ];
  day.cash.set(buyerId, (day.cash.get(buyerId) ?? 0) - Number(fee));
  day.cash.set(sellerId, (day.cash.get(sellerId) ?? 0) + Number(fee));
  day.squads.set(
    sellerId,
    (day.squads.get(sellerId) ?? []).filter(({ id }) => id !== player.id),
  );
  day.squads.set(buyerId, [...(day.squads.get(buyerId) ?? []), moved]);
}

/**
 * Simple AI-to-AI deals: a club below the minimum at a position buys from a
 * club with surplus there, within budget (half its cash) and the 35 cap.
 */
export function aiToAiTransfers(
  context: WorldContext,
  date: string,
  seed: string,
  day: DayState,
): void {
  const { world } = context;
  const managedId = world.manager.currentClubId;
  const pendingPlayers = new Set(
    world.offers
      .filter(({ status }) => status === 'pending')
      .map(({ playerId }) => playerId),
  );
  const contractEnd = new Map(
    world.contracts
      .filter(({ status }) => status === 'active' || status === 'expiring')
      .map(({ playerId, endsOn }) => [playerId, endsOn] as const),
  );
  const ai = context.clubs.filter(({ id }) => id !== managedId);
  const order = ai
    .map((club) => ({ club, roll: marketRoll(seed, 'order', date, club.id) }))
    .sort(
      (left, right) =>
        left.roll - right.roll || left.club.id.localeCompare(right.club.id),
    );
  const busy = new Set<ClubId>();
  let deals = 0;
  for (const { club: buyer } of order) {
    if (deals >= MAX_AI_TRANSFERS_PER_DAY) break;
    if (busy.has(buyer.id)) continue;
    const squad = day.squads.get(buyer.id) ?? [];
    if (squad.length >= MAX_SQUAD_SIZE) continue;
    const counts = positionCounts(squad);
    const position = POSITIONS.find(
      (item) => counts[item] < POSITION_MINIMUMS[item],
    );
    if (position === undefined) continue;
    const reputation = day.reputation.get(buyer.id) ?? 0;
    const budget = Math.floor((day.cash.get(buyer.id) ?? 0) / 2);
    let best: { player: Player; sellerId: ClubId; fee: Money } | undefined;
    for (const seller of ai) {
      if (seller.id === buyer.id || busy.has(seller.id)) continue;
      const sellerSquad = day.squads.get(seller.id) ?? [];
      if (
        sellerSquad.length <= AI_MINIMUM_SQUAD_SIZE ||
        positionCounts(sellerSquad)[position] <= POSITION_TARGETS[position]
      )
        continue;
      for (const player of sellerSquad) {
        if (
          player.position !== position ||
          Number(player.strength) > reputation + 8 ||
          day.loans.has(player.id) ||
          pendingPlayers.has(player.id) ||
          isKeyPlayer(player, sellerSquad)
        )
          continue;
        const fee = sellerAskingPrice({
          player,
          sellerSquad,
          sellerReputation: day.reputation.get(seller.id) ?? 0,
          contractEndsOn: contractEnd.get(player.id),
          onDate: date,
        });
        if (fee > budget) continue;
        if (
          best === undefined ||
          Number(player.strength) > Number(best.player.strength) ||
          (Number(player.strength) === Number(best.player.strength) &&
            (fee < best.fee ||
              (fee === best.fee && player.id < best.player.id)))
        )
          best = { player, sellerId: seller.id, fee };
      }
    }
    if (best === undefined) continue;
    completeAiTransfer(
      context,
      day,
      best.player,
      best.sellerId,
      buyer.id,
      best.fee,
      date,
    );
    busy.add(buyer.id).add(best.sellerId);
    deals += 1;
  }
}

/**
 * One market day of the career (docs/adr/0008): loans come back, stale
 * proposals expire and, inside a window, AI clubs bid for managed players
 * and trade among themselves. Pure over the context: the same seed and date
 * always produce the same moves, and every fee is a balanced ledger entry.
 */
export function runMarketDay(
  context: WorldContext,
  date: string,
  seed: string,
): void {
  returnDueLoans(context, date);
  expireOffers(context.world, date);
  pruneListings(context);
  const status = transferWindowStatus(date);
  if (status.current === undefined) return;
  const day: DayState = {
    squads: squadsOf(context.players),
    cash: cashByClub(context.clubs, context.world.ledger),
    reputation: new Map(
      context.clubs.map(({ id, reputation }) => [id, Number(reputation)]),
    ),
    loans: activeLoans(context.world),
  };
  aiOffersForManagedPlayers(context, date, seed, status.current.closesOn, day);
  aiToAiTransfers(context, date, seed, day);
}
