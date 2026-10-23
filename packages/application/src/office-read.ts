import type { CareerOfficeReadModel, CoachMessage } from '@footebas/contracts';
import {
  clubCashBalance,
  type FinancialLedger,
  type PrestigeAchievement,
} from '@footebas/domain';
import { chemistryView } from './career-chemistry.js';
import {
  MEMBERSHIP_PRICE_MAX,
  MEMBERSHIP_PRICE_MIN,
  MEMBERSHIP_TIER_TABLE,
  OFFICE_RULES_VERSION,
  addMonthsToPeriod,
  counterRange,
  divisionOfClub,
  managedMembership,
  membershipAttendanceBonus,
  monthsBetween,
  readOffice,
  sponsorshipForMonth,
  type SponsorshipContract,
  type SponsorshipOffer,
} from './career-office.js';
import { clubWageBill, type WorldContext } from './career-world-rules.js';
import { transferOfferMessages } from './market-read.js';
import type { CareerSnapshot } from './service.js';

const brl = (minor: number): string =>
  (minor / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

export const sponsorDecisionIdOf = (offerId: string): string =>
  `decision_${offerId}`;

/** Inbox items for sponsorship proposals waiting for the manager. */
export function sponsorOfferMessages(snapshot: CareerSnapshot): CoachMessage[] {
  const managedId = snapshot.world.manager.currentClubId;
  if (managedId === undefined) return [];
  return readOffice(snapshot.world)
    .sponsorOffers.filter(
      (offer) =>
        offer.clubId === managedId &&
        offer.status === 'pending' &&
        offer.expiresOn >= snapshot.currentDate,
    )
    .map((offer) => {
      const goals = [
        offer.bonuses.title > 0 ? `título ${brl(offer.bonuses.title)}` : '',
        offer.bonuses.promotion > 0
          ? `acesso ${brl(offer.bonuses.promotion)}`
          : '',
        offer.bonuses.continental > 0
          ? `vaga continental ${brl(offer.bonuses.continental)}`
          : '',
      ].filter((text) => text.length > 0);
      return {
        id: `mail_${offer.id}`,
        kind: 'sponsor_offer' as const,
        subject: `Proposta de patrocínio: ${offer.sponsorName}`,
        body: `${offer.sponsorName} oferece ${brl(offer.monthlyValue)} por mês durante ${String(offer.durationMonths)} meses. Bônus por meta: ${goals.join(', ')}. Multa rescisória de ${brl(offer.terminationFee)}. A proposta vale até ${offer.expiresOn}.`,
        occurredOn: offer.createdOn,
        decision: {
          id: sponsorDecisionIdOf(offer.id),
          offerId: offer.id,
          options:
            offer.counter === undefined
              ? (['accept', 'reject', 'counter'] as const).slice()
              : (['accept', 'reject'] as const).slice(),
          expiresOn: offer.expiresOn,
        },
      };
    });
}

type FinanceCategories = Omit<
  CareerOfficeReadModel['finances']['season'],
  'year'
>;

/** Income and expenses of one club by ledger account, optionally per month. */
export function financesByCategory(
  ledger: FinancialLedger,
  clubId: string,
  period?: string,
): FinanceCategories {
  const income = { gate: 0, sponsor: 0, membership: 0, prize: 0, transfer: 0 };
  const expenses = {
    wages: 0,
    transfer: 0,
    stadium: 0,
    membership: 0,
    sponsor: 0,
  };
  const prefix = `club:${clubId}:`;
  for (const entry of ledger.entries) {
    if (period !== undefined && entry.occurredAt.slice(0, 7) !== period)
      continue;
    for (const posting of entry.postings) {
      if (!posting.account.startsWith(prefix)) continue;
      const [kind, category] = posting.account.slice(prefix.length).split(':');
      if (kind === 'income' && category !== undefined && category in income)
        income[category as keyof typeof income] -= Number(posting.amount);
      else if (
        kind === 'expense' &&
        category !== undefined &&
        category in expenses
      )
        expenses[category as keyof typeof expenses] += Number(posting.amount);
    }
  }
  const totalIncome = Object.values(income).reduce((sum, v) => sum + v, 0);
  const totalExpenses = Object.values(expenses).reduce((sum, v) => sum + v, 0);
  return {
    income,
    expenses,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
  };
}

function offerView(offer: SponsorshipOffer, date: string) {
  const open = offer.status === 'pending' && offer.expiresOn >= date;
  return {
    id: offer.id,
    sponsorName: offer.sponsorName,
    season: offer.season,
    monthlyValue: offer.monthlyValue,
    durationMonths: offer.durationMonths,
    bonuses: { ...offer.bonuses },
    terminationFee: offer.terminationFee,
    status:
      offer.status === 'pending' && !open ? ('expired' as const) : offer.status,
    createdOn: offer.createdOn,
    expiresOn: offer.expiresOn,
    ...(offer.counter === undefined ? {} : { counter: { ...offer.counter } }),
    ...(open ? { decisionId: sponsorDecisionIdOf(offer.id) } : {}),
    ...(open && offer.counter === undefined
      ? { counterRange: counterRange(offer) }
      : {}),
  };
}

function contractView(contract: SponsorshipContract, openMonth: string) {
  return {
    id: contract.id,
    offerId: contract.offerId,
    sponsorName: contract.sponsorName,
    monthlyValue: contract.monthlyValue,
    startMonth: contract.startMonth,
    endMonth: contract.endMonth,
    monthsRemaining:
      contract.status === 'active'
        ? Math.max(0, monthsBetween(openMonth, contract.endMonth) + 1)
        : 0,
    bonuses: { ...contract.bonuses },
    terminationFee: contract.terminationFee,
    status: contract.status,
    bonusesPaid: contract.bonusesPaid.map((paid) => ({ ...paid })),
  };
}

export interface CareerOfficeInput {
  readonly careerId: string;
  readonly aggregateVersion: number;
  readonly projectedAt: string;
  readonly seed: string;
  readonly snapshot: CareerSnapshot;
  readonly context: WorldContext;
}

/** Office screen; read-only over the snapshot. */
export function projectCareerOffice(
  input: CareerOfficeInput,
): CareerOfficeReadModel {
  const { snapshot, context } = input;
  const { world } = snapshot;
  const office = readOffice(world);
  const managedId = world.manager.currentClubId;
  const club = snapshot.clubs.find(({ id }) => id === managedId);
  const clubName = new Map(snapshot.clubs.map(({ id, name }) => [id, name]));
  const playerName = new Map(
    snapshot.players.map(({ id, name }) => [id, name]),
  );
  const lastSettled = addMonthsToPeriod(world.openMonth, -1);
  const wageBill = club === undefined ? 0 : clubWageBill(world, club.id);
  const membership = managedMembership(context);
  const stadium = world.stadiums.find(({ clubId }) => clubId === managedId);
  const contracts = office.sponsorContracts.filter(
    (contract) => contract.clubId === managedId,
  );
  const active = contracts.find(({ status }) => status === 'active');
  const awaitingTransfers = new Set(
    transferOfferMessages(snapshot).map(({ decision }) => decision?.offerId),
  );
  const achievements = new Map<PrestigeAchievement['type'], number>();
  for (const achievement of world.achievements)
    achievements.set(
      achievement.type,
      (achievements.get(achievement.type) ?? 0) + 1,
    );
  const division =
    managedId === undefined ? undefined : divisionOfClub(context, managedId);
  return {
    version: 1,
    careerId: input.careerId,
    aggregateVersion: input.aggregateVersion,
    projectedAt: input.projectedAt,
    rulesVersion: OFFICE_RULES_VERSION,
    currentDate: snapshot.currentDate,
    season: snapshot.season,
    ...(club === undefined
      ? {}
      : {
          club: {
            id: club.id,
            name: club.name,
            ...(division === undefined ? {} : { division }),
            cash: Number(clubCashBalance(world.ledger, club.id, club.balance)),
            monthlyWageBill: wageBill,
          },
        }),
    proposals: {
      sponsorship: office.sponsorOffers
        .filter((offer) => offer.clubId === managedId)
        .slice(-12)
        .reverse()
        .map((offer) => offerView(offer, snapshot.currentDate)),
      jobs: world.jobProposals.map((proposal) => ({
        id: proposal.id,
        clubId: proposal.clubId,
        clubName: clubName.get(proposal.clubId) ?? proposal.clubId,
        expiresOn: proposal.expiresOn,
        minimumPrestige: proposal.minimumPrestige,
        status: proposal.status,
      })),
      transfers: world.offers
        .filter((offer) => awaitingTransfers.has(offer.id))
        .map((offer) => {
          const counterpartId =
            offer.counterOf === undefined ? offer.toClubId : offer.fromClubId;
          return {
            id: offer.id,
            kind: offer.kind,
            playerId: offer.playerId,
            playerName: playerName.get(offer.playerId) ?? offer.playerId,
            ...(counterpartId === undefined
              ? {}
              : {
                  counterpartClubId: counterpartId,
                  counterpartClubName:
                    clubName.get(counterpartId) ?? counterpartId,
                }),
            fee: Number(offer.fee),
            wage: Number(offer.wage),
            expiresOn: offer.expiresOn,
            decisionId: `decision_${offer.id}`,
          };
        }),
    },
    sponsorship: {
      ...(active === undefined
        ? {}
        : { contract: contractView(active, world.openMonth) }),
      fallbackMonthly:
        club === undefined
          ? 0
          : active === undefined
            ? sponsorshipForMonth(world, club.id, world.openMonth, wageBill)
                .amount
            : 0,
      history: contracts
        .filter(({ status }) => status !== 'active')
        .slice(-10)
        .reverse()
        .map((contract) => contractView(contract, world.openMonth)),
    },
    ...(membership === undefined
      ? {}
      : {
          membership: {
            monthlyPrice: membership.plan.monthlyPrice,
            tier: membership.plan.tier,
            priceRange: {
              min: MEMBERSHIP_PRICE_MIN,
              max: MEMBERSHIP_PRICE_MAX,
            },
            referencePrice: membership.referencePrice,
            tiers: (['basic', 'intermediate', 'premium'] as const).map(
              (tier) => ({
                tier,
                costPerMember: MEMBERSHIP_TIER_TABLE[tier].costPerMember,
                appeal: MEMBERSHIP_TIER_TABLE[tier].appeal,
              }),
            ),
            members: membership.members,
            potential: membership.potential,
            monthlyRevenue: membership.monthlyRevenue,
            monthlyCost: membership.monthlyCost,
            attendanceBonus:
              stadium === undefined
                ? 0
                : membershipAttendanceBonus(
                    membership.members,
                    stadium.capacity,
                  ),
            fanConfidenceEffect: membership.fanConfidenceEffect,
          },
        }),
    finances: {
      month: {
        period: lastSettled,
        ...financesByCategory(world.ledger, managedId ?? '', lastSettled),
      },
      season: {
        year: snapshot.competition.year,
        ...financesByCategory(world.ledger, managedId ?? ''),
      },
      pendingGate:
        managedId === undefined ? 0 : Math.round(world.gate[managedId] ?? 0),
    },
    contracts: world.contracts
      .filter((contract) => contract.clubId === managedId)
      .map((contract) => ({
        contractId: contract.id,
        playerId: contract.playerId,
        playerName: playerName.get(contract.playerId) ?? contract.playerId,
        endsOn: contract.endsOn,
        wage: Number(contract.wage),
        status: contract.status,
      })),
    coach: {
      managerName: snapshot.managerName,
      profile: snapshot.coach,
      employmentStatus: world.manager.employmentStatus,
      ...(managedId === undefined ? {} : { clubId: managedId }),
      boardConfidence: world.manager.boardConfidence,
      fanConfidence: world.manager.fanConfidence,
      prestige: world.manager.prestige,
      seasons: world.manager.seasons,
      appointments: world.manager.appointments.map((appointment) => ({
        clubId: appointment.clubId,
        clubName: clubName.get(appointment.clubId) ?? appointment.clubId,
        joinedOn: appointment.joinedOn,
        ...(appointment.leftOn === undefined
          ? {}
          : { leftOn: appointment.leftOn }),
        ...(appointment.reason === undefined
          ? {}
          : { reason: appointment.reason }),
      })),
      achievements: [...achievements.entries()].map(([type, count]) => ({
        type,
        count,
      })),
    },
    ...(managedId === undefined || snapshot.selectedClubId !== managedId
      ? {}
      : {
          chemistry: chemistryView(
            world,
            managedId,
            snapshot.lineup?.starters.map(({ playerId }) => playerId),
          ),
        }),
  };
}
