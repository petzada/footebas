/* eslint-disable @typescript-eslint/no-non-null-assertion -- ids come from the same aggregate and are validated on creation */
import type { PhaseFourEvent } from '@footebas/contracts';
import {
  applyPersonalityToConfidence,
  coachEffects,
  planStrength,
  scaleIntegerDelta,
  appendLedgerEntry,
  calculateAttendance,
  calculateManagerPrestige,
  clubCashBalance,
  createClubIncomeTransaction,
  createContract,
  createLedger,
  createStadium,
  createWageTransaction,
  developPlayer,
  evaluateManagerConfidence,
  generateYouthCandidates,
  leaveClub,
  money,
  jobMarketOffers,
  promoteYouth,
  shouldFireManager,
  wearStadium,
  type BoardObjective,
  type Club,
  type CoachPersonality,
  type ClubId,
  type CompetitionCalendarFixture,
  type CompetitionDefinition,
  type CompetitionOutcome,
  type FinancialLedger,
  type HistoryEvent,
  type JobProposal,
  type LoanRecord,
  type ManagerCareer,
  type Player,
  type PlayerContract,
  type PlayerId,
  type PrestigeAchievement,
  type Stadium,
  type TransferListing,
  type TransferOffer,
  type YouthCandidate,
} from '@footebas/domain';
import { createPrng, hashSeed, type SeasonGeneration } from '@footebas/engine';
import {
  closeSponsorMonth,
  emptyOffice,
  managedMembership,
  membershipAttendanceBonus,
  membershipContextOf,
  membershipFanEffect,
  membershipPlanOf,
  paySponsorBonuses,
  settleMembershipMonth,
  sponsorshipForMonth,
  type CareerOfficeState,
  type Division,
  type MatchForm,
} from './career-office.js';

export const WORLD_RULES_VERSION = 'career-world-rules-v1';

/** Phase four world kept inside the single career save. */
export interface CareerWorldState {
  schemaVersion: string;
  manager: ManagerCareer;
  contracts: PlayerContract[];
  offers: TransferOffer[];
  loans: LoanRecord[];
  ledger: FinancialLedger;
  stadiums: Stadium[];
  youth: YouthCandidate[];
  objectives: BoardObjective[];
  jobProposals: JobProposal[];
  history: HistoryEvent[];
  achievements: PrestigeAchievement[];
  events: PhaseFourEvent[];
  archiveKeys: string[];
  /** First month whose wages, sponsorship and gate are not settled yet. */
  openMonth: string;
  /** Gate income (minor units) accumulated per club during the open month. */
  gate: Record<string, number>;
  /** Counter behind every id minted by world rules, so replays are exact. */
  sequence: number;
  /** Transfer list of the managed club (docs/adr/0008); absent in old saves. */
  market?: CareerMarketState;
  /** Sponsorship, fan membership and chemistry (docs/adr/0011); absent in old saves. */
  office?: CareerOfficeState;
  /** Crowds of the managed club this season; absent in old saves. */
  crowd?: CrowdState;
  /** Academy intakes (peneiras) and training already run; absent in old saves. */
  academy?: AcademyState;
  /** Last month the coach job market ran; absent in old saves. */
  jobMarket?: JobMarketState;
}

/** Home crowds of the managed club: season totals and the open month. */
export interface CrowdState {
  clubId: string;
  year: number;
  matches: number;
  total: number;
  last?: number;
  monthMatches: number;
  monthTotal: number;
  monthCapacity: number;
}

export interface AcademyState {
  /** Intake keys already generated (`club|year|half`, `club|first`). */
  intakes: string[];
  /** Last month the academy trained (`YYYY-MM`). */
  trainedThrough: string;
  /** Last season the prospects aged. */
  agedThrough: number;
}

export interface JobMarketState {
  /** Last month the market was checked (`YYYY-MM`). */
  checkedThrough: string;
  /** Latest managed league standing of a season, for in-season performance. */
  league?: { position: number; rounds: number; season: number };
}

export interface CareerMarketState {
  listings: TransferListing[];
}

export interface WorldContext {
  clubs: Club[];
  players: Player[];
  world: CareerWorldState;
  /** Coach personality of the career (ADR 0007); absent means the default. */
  personality?: CoachPersonality;
  /** National divisions of the season (office rules, ADR 0011). */
  divisions?: Readonly<Record<Division, readonly ClubId[]>>;
  /** Recent managed results, oldest first (office rules, ADR 0011). */
  managedForm?: readonly MatchForm[];
}

/** Development quality every club gets; the managed youth may get more. */
export const BASE_DEVELOPMENT_QUALITY = 60;
const YOUTH_DEVELOPMENT_MAX_AGE = 21;

/** Prize money in BRL for the champion; lower places earn a decreasing share. */
export const PRIZE_BY_TIER: Readonly<
  Record<CompetitionDefinition['tier'], number>
> = {
  national_league: 40_000_000,
  national_cup: 70_000_000,
  state: 5_000_000,
  continental: 120_000_000,
};
const DIVISION_PRIZE_FACTOR = [1, 0.25, 0.08] as const;

function nextId(world: CareerWorldState, kind: string): string {
  world.sequence += 1;
  return `${kind}_${String(world.sequence)}`;
}
/** Ids minted by any world rule share the same exact-replay sequence. */
export const nextWorldId = nextId;

function nextMonth(month: string): string {
  const [year, value] = month.split('-').map(Number) as [number, number];
  return value === 12
    ? `${String(year + 1)}-01`
    : `${String(year)}-${String(value + 1).padStart(2, '0')}`;
}

function addYears(date: string, years: number): string {
  return `${String(Number(date.slice(0, 4)) + years)}${date.slice(4)}`;
}

/** Ticket price the crowd of a club judges by (minor units). */
export function referenceTicketPrice(reputation: number): number {
  return 2_000 + reputation * 60;
}

/** Ticket prices the board accepts (R$ 10 to R$ 250, minor units). */
export const TICKET_PRICE_MIN = 1_000;
export const TICKET_PRICE_MAX = 25_000;

/** Stakes of a match by competition tier (crowd appeal). */
export const CROWD_IMPORTANCE: Readonly<
  Record<CompetitionDefinition['tier'], number>
> = {
  continental: 90,
  national_cup: 70,
  national_league: 55,
  state: 35,
};

/** Recent form as the crowd reads it: +3 per win, -3 per defeat. */
export function crowdForm(form: readonly ('W' | 'D' | 'L')[]): number {
  return form
    .slice(-5)
    .reduce(
      (total, result) => total + (result === 'W' ? 3 : result === 'L' ? -3 : 0),
      0,
    );
}

function stadiumFor(club: Club): Stadium {
  const reputation = Number(club.reputation);
  return createStadium({
    clubId: club.id,
    capacity: Math.max(6_000, Math.round((reputation - 40) * 1_600)),
    ticketPrice: money(2_000 + reputation * 60),
    maintenance: money(Math.round((reputation - 30) * 40_000)),
    quality: Math.max(30, Math.min(95, reputation)),
  });
}

export function createCareerWorld(
  clubs: readonly Club[],
  players: readonly Player[],
  startDate: string,
  managerId: string,
): CareerWorldState {
  const year = Number(startDate.slice(0, 4));
  const contracts = players.map((player) =>
    createContract({
      id: `contract_${player.id}`,
      playerId: player.id,
      clubId: player.clubId!,
      startsOn: `${String(year)}-01-01`,
      endsOn: `${String(year + (hashSeed(`contract|${player.id}`) % 4))}-12-31`,
      wage: player.salary,
      status: 'active',
      terminationCost: money(Number(player.salary) * 6),
      revision: 1,
    }),
  );
  return {
    schemaVersion: '4',
    manager: {
      managerId,
      employmentStatus: 'available',
      boardConfidence: 50,
      fanConfidence: 50,
      prestige: 0,
      seasons: 0,
      appointments: [],
    },
    contracts,
    offers: [],
    loans: [],
    ledger: createLedger(),
    stadiums: clubs.map(stadiumFor),
    youth: [],
    objectives: [],
    jobProposals: [],
    history: [],
    achievements: [],
    events: [],
    archiveKeys: [],
    openMonth: startDate.slice(0, 7),
    gate: {},
    sequence: 0,
    market: { listings: [] },
    office: emptyOffice(),
  };
}

/** Board objectives scale with the club's standing inside its division. */
export function boardObjectives(
  world: CareerWorldState,
  division: 'serie-a' | 'serie-b' | 'serie-c',
  divisionRank: number,
): BoardObjective[] {
  const objective = (
    metric: BoardObjective['metric'],
    target: number,
    weight: number,
  ): BoardObjective => ({
    id: nextId(world, 'objective'),
    metric,
    target,
    progress: 0,
    weight,
    status: 'active',
  });
  const league =
    division === 'serie-a'
      ? divisionRank <= 6
        ? objective('league_position', 6, 20)
        : objective('avoid_relegation', 16, 20)
      : divisionRank <= 6
        ? objective('promotion', 4, 20)
        : objective('league_position', 10, 15);
  return [league, objective('financial_balance', 0, 10)];
}

export function employManager(
  context: WorldContext,
  clubId: ClubId,
  onDate: string,
  division: 'serie-a' | 'serie-b' | 'serie-c',
  divisionRank: number,
): void {
  const { world } = context;
  world.manager = {
    ...world.manager,
    currentClubId: clubId,
    employmentStatus: 'employed',
    boardConfidence: 60,
    fanConfidence: 55,
    appointments: [...world.manager.appointments, { clubId, joinedOn: onDate }],
  };
  world.objectives = boardObjectives(world, division, divisionRank);
}

export function recordGate(
  context: WorldContext,
  fixture: CompetitionCalendarFixture,
  tier: CompetitionDefinition['tier'],
): void {
  const stadium = context.world.stadiums.find(
    ({ clubId }) => clubId === fixture.homeClubId,
  );
  const home = context.clubs.find(({ id }) => id === fixture.homeClubId);
  const away = context.clubs.find(({ id }) => id === fixture.awayClubId);
  if (!stadium || !home || !away) return;
  const { world } = context;
  const managed = home.id === world.manager.currentClubId;
  // The managed crowd also reads form, fan mood and the stadium state; the
  // other clubs keep a neutral context (their stadiums do not wear).
  const attendance = calculateAttendance({
    capacity: stadium.capacity,
    ticketPrice: stadium.ticketPrice,
    referencePrice: money(referenceTicketPrice(Number(home.reputation))),
    homeReputation: Number(home.reputation),
    awayReputation: Number(away.reputation),
    importance: CROWD_IMPORTANCE[tier],
    recentForm: managed ? crowdForm(context.managedForm ?? []) : 0,
    ...(managed
      ? {
          fanMood: world.manager.fanConfidence,
          stadiumQuality: stadium.quality,
        }
      : {}),
  });
  // Fan members fill a few more seats at the managed club (ADR 0011).
  const members = managed ? (managedMembership(context)?.members ?? 0) : 0;
  const crowd = Math.min(
    stadium.capacity,
    attendance + membershipAttendanceBonus(members, stadium.capacity),
  );
  world.gate[home.id] =
    (world.gate[home.id] ?? 0) + crowd * Number(stadium.ticketPrice);
  if (!managed) return;
  recordCrowd(world, home.id, fixture.date, crowd, stadium.capacity);
  // Every home match wears pitch and stands a little.
  world.stadiums = world.stadiums.map((item) =>
    item.clubId === home.id ? wearStadium(item, 1) : item,
  );
}

function recordCrowd(
  world: CareerWorldState,
  clubId: string,
  date: string,
  crowd: number,
  capacity: number,
): void {
  const year = Number(date.slice(0, 4));
  const current =
    world.crowd?.clubId === clubId && world.crowd.year === year
      ? world.crowd
      : {
          clubId,
          year,
          matches: 0,
          total: 0,
          monthMatches: 0,
          monthTotal: 0,
          monthCapacity: 0,
        };
  world.crowd = {
    ...current,
    matches: current.matches + 1,
    total: current.total + crowd,
    last: crowd,
    monthMatches: current.monthMatches + 1,
    monthTotal: current.monthTotal + crowd,
    monthCapacity: current.monthCapacity + capacity,
  };
}

/**
 * A full stadium lifts the fans' mood, an empty one sours it (one point a
 * month). This is how ticket prices reach the job security.
 */
function settleCrowdMonth(world: CareerWorldState): void {
  const crowd = world.crowd;
  if (crowd === undefined) return;
  if (
    crowd.monthMatches > 0 &&
    crowd.monthCapacity > 0 &&
    crowd.clubId === world.manager.currentClubId
  ) {
    const occupancy = crowd.monthTotal / crowd.monthCapacity;
    const delta = occupancy >= 0.9 ? 1 : occupancy <= 0.35 ? -1 : 0;
    if (delta !== 0)
      world.manager = {
        ...world.manager,
        fanConfidence: Math.max(
          0,
          Math.min(100, world.manager.fanConfidence + delta),
        ),
      };
  }
  world.crowd = { ...crowd, monthMatches: 0, monthTotal: 0, monthCapacity: 0 };
}

/**
 * Monthly wages a club pays: its active contracts, with loaned players split
 * by the loan's wage share (the borrower pays its share, the owner the rest).
 */
export function clubWageBill(
  world: Pick<CareerWorldState, 'contracts' | 'loans' | 'offers'>,
  clubId: ClubId,
): number {
  const shares = new Map<string, { borrower: ClubId; share: number }>();
  for (const loan of world.loans) {
    if (loan.status !== 'active') continue;
    const offer = world.offers.find(({ id }) => id === loan.offerId);
    shares.set(loan.playerId, {
      borrower: loan.borrowingClubId,
      share: offer?.loan?.wageSharePercentage ?? 0,
    });
  }
  let total = 0;
  for (const contract of world.contracts) {
    if (contract.status !== 'active' && contract.status !== 'expiring')
      continue;
    const loan = shares.get(contract.playerId);
    const borrowerPart =
      loan === undefined
        ? 0
        : Math.round((Number(contract.wage) * loan.share) / 100);
    if (contract.clubId === clubId)
      total += Number(contract.wage) - borrowerPart;
    if (loan?.borrower === clubId) total += borrowerPart;
  }
  return total;
}
const wageBill = clubWageBill;

/** Settles every closed month before `date`: gate, sponsorship and wages. */
export function settleMonths(context: WorldContext, date: string): void {
  const { world } = context;
  while (world.openMonth < date.slice(0, 7)) {
    const period = world.openMonth;
    const occurredAt = `${period}-28`;
    for (const club of context.clubs) {
      const bill = wageBill(world, club.id);
      const gate = Math.round(world.gate[club.id] ?? 0);
      if (gate > 0)
        world.ledger = appendLedgerEntry(
          world.ledger,
          createClubIncomeTransaction({
            id: nextId(world, 'ledger'),
            occurredAt,
            clubId: club.id,
            amount: money(gate),
            source: { type: 'gate', matchId: `month_${period}`, attendance: 0 },
          }),
        );
      // Contract, one-off (managed club) or neutral sponsorship (ADR 0011).
      const sponsor = sponsorshipForMonth(world, club.id, period, bill);
      if (sponsor.amount > 0)
        world.ledger = appendLedgerEntry(
          world.ledger,
          createClubIncomeTransaction({
            id: nextId(world, 'ledger'),
            occurredAt,
            clubId: club.id,
            amount: money(sponsor.amount),
            source: {
              type: 'sponsor',
              agreementId: sponsor.agreementId,
              period,
            },
          }),
        );
      if (bill > 0) {
        world.ledger = appendLedgerEntry(
          world.ledger,
          createWageTransaction({
            id: nextId(world, 'ledger'),
            occurredAt,
            clubId: club.id,
            period,
            amount: money(bill),
          }),
        );
      }
    }
    settleMembershipMonth(context, period, occurredAt);
    closeSponsorMonth(world, period);
    settleCrowdMonth(world);
    world.gate = {};
    world.openMonth = nextMonth(period);
  }
}

export interface SeasonEndInput {
  readonly season: number;
  readonly year: number;
  readonly seed: string;
  readonly outcomes: readonly CompetitionOutcome[];
  readonly definitions: readonly CompetitionDefinition[];
  readonly generation: SeasonGeneration;
  readonly divisionCompetitionIds: Readonly<Record<string, string>>;
  readonly managedForm: readonly ('W' | 'D' | 'L')[];
  /** Clubs of next season's national pyramid; only they can offer jobs. */
  readonly pyramidClubIds: readonly string[];
  /** Clubs entering next season's continental cup (sponsor goals). */
  readonly continentalClubIds?: readonly string[];
}

/** Sponsorship goal bonuses of the season (ADR 0011). */
function paySponsorGoals(context: WorldContext, input: SeasonEndInput): void {
  const titled = new Set(['national_league', 'national_cup', 'continental']);
  paySponsorBonuses(context.world, {
    season: input.season,
    year: input.year,
    titleClubIds: input.outcomes
      .filter((outcome) =>
        titled.has(
          input.definitions.find(({ id }) => id === outcome.competitionId)
            ?.tier ?? 'state',
        ),
      )
      .map(({ championId }) => championId),
    promotedClubIds: input.generation.events.flatMap((event) =>
      event.type === 'ClubPromoted' ? [event.clubId] : [],
    ),
    continentalClubIds: input.continentalClubIds ?? [],
  });
}

function payPrizes(context: WorldContext, input: SeasonEndInput): void {
  const { world } = context;
  const occurredAt = `${String(input.year)}-12-20`;
  const divisionOrder = ['serie-a', 'serie-b', 'serie-c'];
  for (const outcome of input.outcomes) {
    const definition = input.definitions.find(
      ({ id }) => id === outcome.competitionId,
    );
    if (!definition) continue;
    const divisionIndex = divisionOrder.findIndex(
      (division) =>
        input.divisionCompetitionIds[division] === outcome.competitionId,
    );
    const base =
      PRIZE_BY_TIER[definition.tier] *
      (divisionIndex < 0
        ? 1
        : DIVISION_PRIZE_FACTOR[divisionIndex as 0 | 1 | 2]);
    const ranking = outcome.stages.at(-1)?.orderedClubIds ?? [];
    ranking.slice(0, 8).forEach((clubId, position) => {
      const amount = Math.round((base * 100) / (position + 1) ** 1.3);
      if (amount <= 0) return;
      world.ledger = appendLedgerEntry(
        world.ledger,
        createClubIncomeTransaction({
          id: nextId(world, 'ledger'),
          occurredAt,
          clubId,
          amount: money(amount),
          source: {
            type: 'prize',
            competitionId: outcome.competitionId,
            season: input.season,
          },
        }),
      );
    });
  }
}

function evaluateObjectives(
  context: WorldContext,
  input: SeasonEndInput,
  openingBalance: number,
): void {
  const { world } = context;
  const clubId = world.manager.currentClubId;
  if (clubId === undefined) return;
  const division = Object.entries(input.divisionCompetitionIds).find(
    ([, competitionId]) =>
      input.outcomes
        .find((outcome) => outcome.competitionId === competitionId)
        ?.stages.at(-1)
        ?.orderedClubIds.includes(clubId),
  );
  const ranking =
    input.outcomes
      .find(({ competitionId }) => competitionId === division?.[1])
      ?.stages.at(-1)?.orderedClubIds ?? [];
  const position = ranking.indexOf(clubId) + 1;
  const promoted = input.generation.events.some(
    (event) => event.type === 'ClubPromoted' && event.clubId === clubId,
  );
  const relegated = input.generation.events.some(
    (event) => event.type === 'ClubRelegated' && event.clubId === clubId,
  );
  const club = context.clubs.find(({ id }) => id === clubId)!;
  const balance = Number(clubCashBalance(world.ledger, clubId, club.balance));
  world.objectives = world.objectives.map((objective) => {
    const met =
      objective.metric === 'league_position'
        ? position > 0 && position <= objective.target
        : objective.metric === 'promotion'
          ? promoted
          : objective.metric === 'avoid_relegation'
            ? !relegated
            : objective.metric === 'financial_balance'
              ? balance >= openingBalance
              : false;
    return {
      ...objective,
      progress: objective.metric === 'league_position' ? position : met ? 1 : 0,
      status: met ? 'met' : 'failed',
    };
  });
}

function recordAchievements(
  context: WorldContext,
  input: SeasonEndInput,
): void {
  const { world } = context;
  const occurredOn = `${String(input.year)}-12-31`;
  for (const outcome of input.outcomes) {
    const definition = input.definitions.find(
      ({ id }) => id === outcome.competitionId,
    );
    world.history.push({
      id: nextId(world, 'history'),
      type: 'title',
      season: input.season,
      occurredOn,
      clubId: outcome.championId,
      competitionId: outcome.competitionId,
    });
    const clubId = world.manager.currentClubId;
    if (clubId === undefined || outcome.championId !== clubId || !definition)
      continue;
    const reputation = Number(
      context.clubs.find(({ id }) => id === clubId)!.reputation,
    );
    const type =
      definition.tier === 'national_league'
        ? 'league_title'
        : definition.tier === 'continental'
          ? 'continental_title'
          : 'cup_title';
    world.achievements.push({
      id: nextId(world, 'achievement'),
      managerId: world.manager.managerId,
      occurredOn,
      type,
      clubReputation: reputation,
    });
  }
  for (const event of input.generation.events) {
    if (event.type !== 'ClubPromoted' && event.type !== 'ClubRelegated')
      continue;
    world.history.push({
      id: nextId(world, 'history'),
      type: event.type === 'ClubPromoted' ? 'promotion' : 'relegation',
      season: input.season,
      occurredOn,
      clubId: event.clubId,
      competitionId: event.toCompetitionId,
    });
    if (
      event.type === 'ClubPromoted' &&
      event.clubId === world.manager.currentClubId
    )
      world.achievements.push({
        id: nextId(world, 'achievement'),
        managerId: world.manager.managerId,
        occurredOn,
        type: 'promotion',
        clubReputation: Number(
          context.clubs.find(({ id }) => id === event.clubId)!.reputation,
        ),
      });
  }
  if (world.manager.currentClubId !== undefined)
    world.achievements.push({
      id: nextId(world, 'achievement'),
      managerId: world.manager.managerId,
      occurredOn,
      type: 'season_completed',
      clubReputation: Number(
        context.clubs.find(({ id }) => id === world.manager.currentClubId)!
          .reputation,
      ),
    });
}

function boardVerdict(context: WorldContext, input: SeasonEndInput): void {
  const { world } = context;
  const nextSeasonStart = `${String(input.year + 1)}-01-01`;
  const verdict = applyPersonalityToConfidence(
    world.manager,
    evaluateManagerConfidence(
      world.manager,
      world.objectives,
      input.managedForm,
    ),
    context.personality,
  );
  world.manager = {
    ...verdict,
    fanConfidence: Math.max(
      0,
      Math.min(100, verdict.fanConfidence + membershipFanDelta(context)),
    ),
    prestige: calculateManagerPrestige(world.achievements),
    seasons: world.manager.seasons + 1,
  };
  if (shouldFireManager(world.manager)) {
    const firedFrom = world.manager.currentClubId!;
    world.manager = leaveClub(world.manager, nextSeasonStart, 'fired');
    world.history.push({
      id: nextId(world, 'history'),
      type: 'manager_fired',
      season: input.season,
      occurredOn: nextSeasonStart,
      clubId: firedFrom,
    });
  }
  const firedReputation = reputationOf(
    context,
    world.manager.appointments.at(-1)?.clubId,
  );
  const currentReputation = reputationOf(context, world.manager.currentClubId);
  const employed = currentReputation !== undefined;
  const performance = seasonPerformance(world.objectives, input.managedForm);
  world.jobProposals = [
    ...keptProposals(world.jobProposals, nextSeasonStart),
    ...jobMarketOffers({
      career: world.manager,
      ...(currentReputation !== undefined
        ? { currentReputation }
        : firedReputation === undefined
          ? {}
          : { lastReputation: firedReputation }),
      performance,
      clubs: jobMarketClubs(
        context,
        input.pyramidClubIds,
        `${input.seed}|vacancy|${String(input.season)}`,
      ),
      excludedClubIds: openProposalClubIds(world.jobProposals),
      onDate: nextSeasonStart,
      maxOffers: !employed
        ? 3
        : performance >= 0.5
          ? 3
          : performance >= 0
            ? 2
            : 1,
      nextId: () => nextId(world, 'proposal'),
    }),
  ];
}

function reputationOf(
  context: WorldContext,
  clubId: string | undefined,
): number | undefined {
  const club =
    clubId === undefined
      ? undefined
      : context.clubs.find(({ id }) => id === clubId);
  return club === undefined ? undefined : Number(club.reputation);
}

/**
 * Pyramid clubs as the coach job market sees them: about one in four has a
 * vacancy each time the market runs (deterministic per `key`).
 */
export function jobMarketClubs(
  context: WorldContext,
  pyramidClubIds: readonly string[],
  key: string,
): { clubId: ClubId; reputation: number; interested: boolean }[] {
  const pyramid = new Set(pyramidClubIds);
  return context.clubs
    .filter((club) => pyramid.has(club.id))
    .map((club) => ({
      clubId: club.id,
      reputation: Number(club.reputation),
      interested: hashSeed(`${key}|${club.id}`) % 4 === 0,
    }));
}

/** Clubs that already have an open proposal on the table. */
export function openProposalClubIds(
  proposals: readonly JobProposal[],
): ClubId[] {
  return proposals
    .filter(({ status }) => status === 'open')
    .map(({ clubId }) => clubId);
}

/**
 * Proposals kept in the save: open ones still valid on `date` plus the
 * last answered ones (history for the screens).
 */
export function keptProposals(
  proposals: readonly JobProposal[],
  date: string,
): JobProposal[] {
  const updated = proposals.map((proposal) =>
    proposal.status === 'open' && proposal.expiresOn < date
      ? { ...proposal, status: 'expired' as const }
      : proposal,
  );
  return [
    ...updated.filter(({ status }) => status !== 'open').slice(-6),
    ...updated.filter(({ status }) => status === 'open'),
  ];
}

const clampUnit = (value: number) => Math.max(-1, Math.min(1, value));

/** Recent results from -1 (five defeats) to 1 (five wins). */
export function formScore(form: readonly ('W' | 'D' | 'L')[]): number {
  const recent = form.slice(-5);
  if (recent.length === 0) return 0;
  const points = recent.reduce(
    (total, result) => total + (result === 'W' ? 3 : result === 'D' ? 1 : 0),
    0,
  );
  const expected = (recent.length * 7) / 5;
  return clampUnit((points - expected) / expected);
}

/** Season verdict from -1 to 1: objectives met or failed, then form. */
export function seasonPerformance(
  objectives: readonly BoardObjective[],
  form: readonly ('W' | 'D' | 'L')[],
): number {
  const weight = objectives.reduce((total, item) => total + item.weight, 0);
  const score =
    weight === 0
      ? 0
      : objectives.reduce(
          (total, item) =>
            total +
            (item.status === 'met'
              ? item.weight
              : item.status === 'failed'
                ? -item.weight
                : 0),
          0,
        ) / weight;
  return clampUnit(score * 0.7 + formScore(form) * 0.3);
}

/**
 * In-season work from -1 to 1: league standing against the objective
 * (after six rounds), recent form and board confidence.
 */
export function workPerformance(
  manager: ManagerCareer,
  objectives: readonly BoardObjective[],
  form: readonly ('W' | 'D' | 'L')[],
  league: { position: number; rounds: number } | undefined,
): number {
  const objective = objectives.find(
    ({ status, metric }) =>
      status === 'active' &&
      (metric === 'league_position' ||
        metric === 'avoid_relegation' ||
        metric === 'promotion'),
  );
  const standing =
    objective === undefined || league === undefined || league.rounds < 6
      ? 0
      : clampUnit((objective.target - league.position) / 6);
  const board = clampUnit((manager.boardConfidence - 50) / 40);
  return clampUnit(standing * 0.45 + formScore(form) * 0.35 + board * 0.2);
}

/** Fan membership value perception at the season verdict (±3, ADR 0011). */
function membershipFanDelta(context: WorldContext): number {
  const clubId = context.world.manager.currentClubId;
  if (clubId === undefined) return 0;
  const plan = membershipPlanOf(context, clubId);
  const membership = membershipContextOf(context, clubId);
  return plan === undefined || membership === undefined
    ? 0
    : membershipFanEffect(plan, membership.reputation);
}

function renewOrRelease(context: WorldContext, input: SeasonEndInput): void {
  const { world } = context;
  const seasonEnd = `${String(input.year)}-12-31`;
  const managed = world.manager.currentClubId;
  const leaving = new Set<string>();
  world.contracts = world.contracts.map((contract) => {
    if (contract.endsOn > seasonEnd || contract.status === 'terminated')
      return contract;
    const player = context.players.find(({ id }) => id === contract.playerId);
    if (!player || contract.clubId === managed || player.age >= 34) {
      leaving.add(contract.playerId);
      return { ...contract, status: 'expired' as const };
    }
    return createContract({
      ...contract,
      startsOn: `${String(input.year + 1)}-01-01`,
      endsOn: addYears(seasonEnd, 2),
      revision: contract.revision + 1,
    });
  });
  if (leaving.size === 0) return;
  context.players = context.players.map((player) => {
    if (!leaving.has(player.id)) return player;
    const { clubId: _clubId, ...free } = player;
    void _clubId;
    return { ...free, squadStatus: 'listed' };
  });
  context.clubs = context.clubs.map((club) => ({
    ...club,
    squad: club.squad.filter((id) => !leaving.has(id)),
  }));
}

export interface MatchDeltas {
  readonly conditionDelta: number;
  readonly moraleDelta: number;
}

/**
 * Coach personality on one managed player's post-match deltas (ADR 0007):
 * morale after wins/defeats, extra morale loss on a losing streak and
 * condition lost. Integer and deterministic per `key`.
 */
export function coachedMatchDeltas(
  personality: CoachPersonality | undefined,
  played: MatchDeltas,
  context: { readonly lossStreak: boolean; readonly key: string },
): MatchDeltas {
  const effects = coachEffects(personality);
  const moraleFactor =
    played.moraleDelta > 0
      ? effects.moraleAfterWin
      : effects.moraleAfterLoss *
        (context.lossStreak ? effects.moraleAfterLossStreak : 1);
  return {
    conditionDelta:
      played.conditionDelta < 0
        ? scaleIntegerDelta(
            played.conditionDelta,
            effects.conditionLoss,
            `${context.key}|condition`,
          )
        : played.conditionDelta,
    moraleDelta: scaleIntegerDelta(
      played.moraleDelta,
      moraleFactor,
      `${context.key}|morale`,
    ),
  };
}

/** Match-only copies with the Estrategista edge; never persisted. */
export function withMatchPlanStrength(
  players: readonly Player[],
  personality: CoachPersonality | undefined,
): Player[] {
  return players.map(
    (player) =>
      ({
        ...player,
        strength: planStrength(Number(player.strength), personality),
      }) as Player,
  );
}

/** Development quality for one player; the coach style tilts managed youth. */
export function developmentQualityFor(
  player: Pick<Player, 'age' | 'clubId'>,
  managedClubId: string | undefined,
  personality: CoachPersonality | undefined,
): number {
  return managedClubId !== undefined &&
    player.clubId === managedClubId &&
    player.age <= YOUTH_DEVELOPMENT_MAX_AGE
    ? Math.min(
        100,
        Math.round(
          BASE_DEVELOPMENT_QUALITY * coachEffects(personality).youthDevelopment,
        ),
      )
    : BASE_DEVELOPMENT_QUALITY;
}

function developSquads(
  context: WorldContext,
  input: SeasonEndInput,
  managedClubId: string | undefined,
): void {
  const random = createPrng(
    `${input.seed}|development|${String(input.season)}`,
  );
  const retired = new Set<string>();
  context.players = context.players.flatMap((player) => {
    const minutes =
      player.clubId === undefined
        ? 0
        : player.squadStatus === 'starter'
          ? 2_700
          : player.squadStatus === 'rotation'
            ? 1_300
            : 400;
    const result = developPlayer(player, {
      usefulMinutes: minutes,
      developmentQuality: developmentQualityFor(
        player,
        managedClubId,
        context.personality,
      ),
      random,
    });
    if (result.outcome === 'retired') {
      retired.add(player.id);
      return [];
    }
    return [{ ...result.player, injuryRounds: 0, suspensionRounds: 0 }];
  });
  if (retired.size === 0) return;
  context.clubs = context.clubs.map((club) => ({
    ...club,
    squad: club.squad.filter((id) => !retired.has(id)),
  }));
  context.world.contracts = context.world.contracts.filter(
    ({ playerId }) => !retired.has(playerId),
  );
  context.world.history.push(
    ...[...retired].slice(0, 20).map((playerId) => ({
      id: nextId(context.world, 'history'),
      type: 'retirement' as const,
      season: input.season,
      occurredOn: `${String(input.year)}-12-31`,
      playerId: playerId as PlayerId,
    })),
  );
}

/** Keeps every squad playable by promoting generated academy players. */
function refillSquads(context: WorldContext, input: SeasonEndInput): void {
  const { world } = context;
  for (const club of context.clubs) {
    const minimum = club.id === world.manager.currentClubId ? 18 : 24;
    const missing = minimum - club.squad.length;
    if (missing <= 0) continue;
    const candidates = generateYouthCandidates({
      clubId: club.id,
      seed: `${input.seed}|youth|${String(input.season)}|${club.id}`,
      generatorVersion: WORLD_RULES_VERSION,
      maximumCandidates: missing,
      existingCandidates: 0,
      currentSeason: input.season,
      nextId: (kind) => nextId(world, kind),
      random: createPrng(
        `${input.seed}|youth|${String(input.season)}|${club.id}`,
      ),
    });
    for (const candidate of candidates) {
      const promoted = promoteYouth(candidate, club.squad.length, 40).player;
      context.players.push(promoted);
      context.clubs = context.clubs.map((item) =>
        item.id === club.id
          ? { ...item, squad: [...item.squad, promoted.id] }
          : item,
      );
      world.contracts.push(
        createContract({
          id: `contract_${promoted.id}`,
          playerId: promoted.id,
          clubId: club.id,
          startsOn: `${String(input.year + 1)}-01-01`,
          endsOn: `${String(input.year + 3)}-12-31`,
          wage: promoted.salary,
          status: 'active',
          terminationCost: money(Number(promoted.salary) * 6),
          revision: 1,
        }),
      );
    }
  }
}

/** Ledger restarts every season from each club's closing cash balance. */
function rollLedger(context: WorldContext): void {
  const { world } = context;
  context.clubs = context.clubs.map((club) => ({
    ...club,
    balance: clubCashBalance(world.ledger, club.id, club.balance),
  }));
  world.ledger = createLedger();
}

export function closeSeasonWorld(
  context: WorldContext,
  input: SeasonEndInput,
): void {
  settleMonths(context, `${String(input.year + 1)}-01-01`);
  const managed = context.world.manager.currentClubId;
  const opening =
    managed === undefined
      ? 0
      : Number(context.clubs.find(({ id }) => id === managed)!.balance);
  payPrizes(context, input);
  paySponsorGoals(context, input);
  evaluateObjectives(context, input, opening);
  recordAchievements(context, input);
  boardVerdict(context, input);
  renewOrRelease(context, input);
  developSquads(context, input, managed);
  refillSquads(context, input);
  rollLedger(context);
}
