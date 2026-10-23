import type { CareerWorldReadModel } from '@footebas/contracts';
import {
  ACADEMY_MAX_AGE,
  ACADEMY_MAX_PROSPECTS,
  ACADEMY_PROMOTION_MIN_AGE,
  MAX_SQUAD_SIZE,
  STADIUM_MAX_CAPACITY,
  crowdDemand,
  money,
  stadiumExpansionPlans,
  stadiumMaintenancePlans,
  type Player,
  type Position,
  type Stadium,
} from '@footebas/domain';
import { nextIntakeOn } from './career-club.js';
import {
  CROWD_IMPORTANCE,
  crowdForm,
  referenceTicketPrice,
  type WorldContext,
} from './career-world-rules.js';
import {
  managedMembership,
  membershipAttendanceBonus,
} from './career-office.js';
import type { CareerSnapshot } from './service.js';

type WorldClub = NonNullable<CareerWorldReadModel['club']>;
type Division = NonNullable<WorldClub['division']>;

const DAY = 86_400_000;
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);

/** Squad shape the academy fills: players wanted per position. */
const SQUAD_SHAPE: Readonly<Record<Position, number>> = {
  GK: 3,
  CB: 4,
  RB: 2,
  LB: 2,
  DM: 2,
  CM: 3,
  AM: 2,
  RW: 2,
  LW: 2,
  ST: 3,
};

export function divisionOfClub(
  snapshot: CareerSnapshot,
  clubId: string,
): Division | undefined {
  return (
    Object.entries(snapshot.competition.divisions) as [
      Division,
      readonly string[],
    ][]
  ).find(([, ids]) => ids.includes(clubId))?.[0];
}

/**
 * Stadium as the club screen shows it: today's demand for an ordinary league
 * match (against an average opponent of the division), this season's home
 * crowds, works in progress and the works the club can order now.
 */
export function stadiumView(
  snapshot: CareerSnapshot,
  context: WorldContext,
  stadium: Stadium,
): WorldClub['stadium'] {
  const { world } = snapshot;
  const club = snapshot.clubs.find(({ id }) => id === stadium.clubId);
  const reputation = Number(club?.reputation ?? 50);
  const division = divisionOfClub(snapshot, stadium.clubId);
  const rivals =
    division === undefined
      ? []
      : snapshot.competition.divisions[division].filter(
          (id) => id !== stadium.clubId,
        );
  const rivalReputation =
    rivals.length === 0
      ? 50
      : rivals.reduce(
          (total, id) =>
            total +
            Number(snapshot.clubs.find((item) => item.id === id)?.reputation),
          0,
        ) / rivals.length;
  const referencePrice = referenceTicketPrice(reputation);
  const demand = crowdDemand({
    capacity: stadium.capacity,
    ticketPrice: stadium.ticketPrice,
    referencePrice: money(referencePrice),
    homeReputation: reputation,
    awayReputation: Math.round(rivalReputation),
    importance: CROWD_IMPORTANCE.national_league,
    recentForm: crowdForm(context.managedForm ?? []),
    fanMood: world.manager.fanConfidence,
    stadiumQuality: stadium.quality,
  });
  const members =
    stadium.clubId === world.manager.currentClubId
      ? (managedMembership(context)?.members ?? 0)
      : 0;
  const crowd =
    world.crowd?.clubId === stadium.clubId &&
    world.crowd.year === Number(snapshot.currentDate.slice(0, 4))
      ? world.crowd
      : undefined;
  return {
    capacity: stadium.capacity,
    maxCapacity: STADIUM_MAX_CAPACITY,
    ticketPrice: Number(stadium.ticketPrice),
    referencePrice,
    maintenance: Number(stadium.maintenance),
    quality: stadium.quality,
    ...(stadium.lastMaintenanceOn === undefined
      ? {}
      : { lastMaintenanceOn: stadium.lastMaintenanceOn }),
    demand,
    expectedCrowd: Math.min(
      stadium.capacity,
      demand + membershipAttendanceBonus(members, stadium.capacity),
    ),
    homeMatches: crowd?.matches ?? 0,
    averageCrowd:
      crowd === undefined || crowd.matches === 0
        ? 0
        : Math.round(crowd.total / crowd.matches),
    ...(crowd?.last === undefined ? {} : { lastCrowd: crowd.last }),
    ...(stadium.expansion
      ? {
          expansion: {
            addedCapacity: stadium.expansion.addedCapacity,
            cost: Number(stadium.expansion.cost),
            completesOn: stadium.expansion.completesOn,
          },
        }
      : {}),
    expansionPlans: stadiumExpansionPlans(stadium).map((plan) => ({
      id: plan.id,
      addedCapacity: plan.addedCapacity,
      cost: Number(plan.cost),
      days: plan.days,
      completesOn: addDays(snapshot.currentDate, plan.days),
    })),
    maintenancePlans: stadiumMaintenancePlans(stadium).map((plan) => ({
      id: plan.id,
      qualityGain: plan.qualityGain,
      cost: Number(plan.cost),
    })),
  };
}

/** Positions the first team is short of, the biggest gap first. */
function squadNeeds(players: readonly Player[]): Position[] {
  const count = new Map<Position, number>();
  for (const player of players)
    count.set(player.position, (count.get(player.position) ?? 0) + 1);
  return (Object.entries(SQUAD_SHAPE) as [Position, number][])
    .map(([position, wanted]) => ({
      position,
      gap: wanted - (count.get(position) ?? 0),
    }))
    .filter(({ gap }) => gap > 0)
    .sort((left, right) => right.gap - left.gap)
    .map(({ position }) => position);
}

/**
 * The managed academy: kids still in it (with visible strength, their
 * characteristics and how close they are to the first team) and the
 * graduates of the last intakes, plus limits and the squad's needs.
 */
export function academyView(
  snapshot: CareerSnapshot,
): Pick<CareerWorldReadModel, 'youth' | 'academy'> {
  const { world } = snapshot;
  const clubId = world.manager.currentClubId;
  const club = snapshot.clubs.find(({ id }) => id === clubId);
  if (clubId === undefined || club === undefined) return { youth: [] };
  const byId = new Map(snapshot.players.map((player) => [player.id, player]));
  const squad = club.squad.flatMap((id) => {
    const player = byId.get(id);
    return player === undefined ? [] : [player];
  });
  const core = [...squad]
    .sort((left, right) => Number(right.strength) - Number(left.strength))
    .slice(0, 18);
  const coreStrength =
    core.length === 0
      ? 50
      : core.reduce((total, player) => total + Number(player.strength), 0) /
        core.length;
  const roomInSquad = club.squad.length < MAX_SQUAD_SIZE;
  const entries = world.youth.filter(({ player }) => player.clubId === clubId);
  const prospects = entries.filter(({ status }) => status === 'academy');
  return {
    youth: entries.map((candidate) => {
      // A graduate keeps growing in the squad: read him from the players.
      const player = byId.get(candidate.player.id) ?? candidate.player;
      const strength = Number(player.strength);
      return {
        playerId: player.id,
        name: player.name,
        position: player.position,
        age: player.age,
        estimate: candidate.estimate,
        status: candidate.status,
        strength,
        ...(candidate.initialStrength === undefined
          ? {}
          : { initialStrength: candidate.initialStrength }),
        traits: [...player.traits],
        highlight: candidate.highlight === true,
        ...(candidate.joinedOn === undefined
          ? {}
          : { joinedOn: candidate.joinedOn }),
        readiness:
          strength >= coreStrength - 8
            ? ('ready' as const)
            : strength >= coreStrength - 15
              ? ('close' as const)
              : ('developing' as const),
        promotable:
          candidate.status === 'academy' &&
          player.age >= ACADEMY_PROMOTION_MIN_AGE &&
          roomInSquad,
      };
    }),
    academy: {
      prospects: prospects.length,
      capacity: ACADEMY_MAX_PROSPECTS,
      nextIntakeOn: nextIntakeOn(snapshot.currentDate),
      squadSize: club.squad.length,
      maxSquadSize: MAX_SQUAD_SIZE,
      minPromotionAge: ACADEMY_PROMOTION_MIN_AGE,
      maxAge: ACADEMY_MAX_AGE,
      needs: squadNeeds(squad),
    },
  };
}

/** Job proposals with the size of the club that calls. */
export function jobProposalsView(
  snapshot: CareerSnapshot,
): CareerWorldReadModel['jobProposals'] {
  return snapshot.world.jobProposals.map((proposal) => {
    const club = snapshot.clubs.find(({ id }) => id === proposal.clubId);
    const division = divisionOfClub(snapshot, proposal.clubId);
    return {
      id: proposal.id,
      clubId: proposal.clubId,
      clubName: club?.name ?? proposal.clubId,
      offeredOn: proposal.offeredOn,
      expiresOn: proposal.expiresOn,
      minimumPrestige: proposal.minimumPrestige,
      status: proposal.status,
      reputation: Number(club?.reputation ?? 0),
      ...(division === undefined ? {} : { division }),
      ...(proposal.reason === undefined ? {} : { reason: proposal.reason }),
    };
  });
}
