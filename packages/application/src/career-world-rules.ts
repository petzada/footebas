/* eslint-disable @typescript-eslint/no-non-null-assertion -- ids come from the same aggregate and are validated on creation */
import type { PhaseFourEvent } from '@footebas/contracts';
import {
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
  promoteYouth,
  proposeJobs,
  shouldFireManager,
  type BoardObjective,
  type Club,
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
  type TransferOffer,
  type YouthCandidate,
} from '@footebas/domain';
import { createPrng, hashSeed, type SeasonGeneration } from '@footebas/engine';

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
}

export interface WorldContext {
  clubs: Club[];
  players: Player[];
  world: CareerWorldState;
}

const SPONSOR_SHARE = 0.85;
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

function nextMonth(month: string): string {
  const [year, value] = month.split('-').map(Number) as [number, number];
  return value === 12
    ? `${String(year + 1)}-01`
    : `${String(year)}-${String(value + 1).padStart(2, '0')}`;
}

function addYears(date: string, years: number): string {
  return `${String(Number(date.slice(0, 4)) + years)}${date.slice(4)}`;
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
  const attendance = calculateAttendance({
    capacity: stadium.capacity,
    ticketPrice: stadium.ticketPrice,
    referencePrice: money(2_000 + Number(home.reputation) * 60),
    homeReputation: Number(home.reputation),
    awayReputation: Number(away.reputation),
    importance:
      tier === 'continental'
        ? 90
        : tier === 'national_cup'
          ? 70
          : tier === 'state'
            ? 35
            : 55,
    recentForm: 0,
  });
  context.world.gate[home.id] =
    (context.world.gate[home.id] ?? 0) +
    attendance * Number(stadium.ticketPrice);
}

function wageBill(world: CareerWorldState, clubId: ClubId): number {
  return world.contracts
    .filter(
      (contract) =>
        contract.clubId === clubId &&
        (contract.status === 'active' || contract.status === 'expiring'),
    )
    .reduce((sum, { wage }) => sum + Number(wage), 0);
}

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
      if (bill > 0) {
        world.ledger = appendLedgerEntry(
          world.ledger,
          createClubIncomeTransaction({
            id: nextId(world, 'ledger'),
            occurredAt,
            clubId: club.id,
            amount: money(Math.round(bill * SPONSOR_SHARE)),
            source: {
              type: 'sponsor',
              agreementId: `sponsor_${club.id}`,
              period,
            },
          }),
        );
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
  world.manager = {
    ...evaluateManagerConfidence(
      world.manager,
      world.objectives,
      input.managedForm,
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
  const vacancies = context.clubs
    .filter((club) => club.id !== world.manager.currentClubId)
    .filter(
      (club) =>
        hashSeed(`${input.seed}|vacancy|${String(input.season)}|${club.id}`) %
          6 ===
        0,
    );
  world.jobProposals = [
    ...proposeJobs(
      world.manager,
      vacancies.map((club) => ({
        clubId: club.id,
        reputation: Number(club.reputation),
        hasVacancy: true,
      })),
      nextSeasonStart,
      () => nextId(world, 'proposal'),
    ),
  ];
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

function developSquads(context: WorldContext, input: SeasonEndInput): void {
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
      developmentQuality: 60,
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
  evaluateObjectives(context, input, opening);
  recordAchievements(context, input);
  boardVerdict(context, input);
  renewOrRelease(context, input);
  developSquads(context, input);
  refillSquads(context, input);
  rollLedger(context);
}
