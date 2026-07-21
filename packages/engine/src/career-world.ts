import { hashSeed } from './prng.js';

export const CAREER_WORLD_VERSION = 'career-world-v1' as const;
export const CAREER_RULES_VERSION = 'phase4-rules-v1' as const;
export const CAREER_SAVE_VERSION = 'career-save-v1' as const;
export const CAREER_ARCHIVE_VERSION = 'career-archive-v1' as const;

export type CareerDivision = 'serie-a' | 'serie-b';
export type CareerPosition = 'GK' | 'DEF' | 'MID' | 'FWD';
export type PlayerIdentitySource = 'raw-markdown' | 'generated-derived';
export type LedgerType =
  | 'ticket'
  | 'sponsor'
  | 'prize'
  | 'salary'
  | 'transfer'
  | 'free-agent'
  | 'stadium-maintenance'
  | 'stadium-expansion';

export interface CareerContentPlayer {
  readonly id: string;
  readonly name: string;
  readonly position: CareerPosition;
  readonly strength: number;
  readonly age: number;
  readonly potential: number;
  readonly identitySource: 'raw-markdown';
  readonly identitySourceId: string;
  readonly attributesVersion: string;
  readonly attributesSeed: string;
}

export interface CareerContentClub {
  readonly id: string;
  readonly name: string;
  readonly division: CareerDivision;
  readonly tier: string;
  readonly players: readonly CareerContentPlayer[];
}

export interface CareerWorldContent {
  readonly version: string;
  readonly sourceIds: readonly string[];
  readonly clubs: readonly CareerContentClub[];
}

export interface CareerContract {
  readonly expiresAfterSeason: number;
  readonly salary: number;
}

export interface CareerPlayer {
  readonly id: string;
  readonly name: string;
  readonly position: CareerPosition;
  readonly strength: number;
  readonly potential: number;
  readonly age: number;
  readonly value: number;
  readonly clubId: string | null;
  readonly contract: CareerContract | null;
  readonly loanFromClubId: string | null;
  readonly loanReturnSeason: number | null;
  readonly identity: Readonly<{
    source: PlayerIdentitySource;
    sourceId: string;
  }>;
  readonly attributes: Readonly<{
    source: 'derived';
    version: string;
    seed: string;
  }>;
  readonly career: Readonly<{
    seasons: number;
    goals: number;
    clubs: readonly string[];
  }>;
}

export interface CareerClub {
  readonly id: string;
  readonly name: string;
  readonly division: CareerDivision;
  readonly tier: string;
  readonly reputation: number;
  readonly balance: number;
  readonly stadium: Readonly<{
    capacity: number;
    ticketPrice: number;
    quality: number;
    averageAttendance: number;
  }>;
  readonly squad: readonly string[];
}

export interface LedgerPosting {
  readonly accountId: string;
  readonly amount: number;
}

export interface LedgerEntry {
  readonly id: string;
  readonly season: number;
  readonly type: LedgerType;
  readonly sourceId: string;
  readonly postings: readonly LedgerPosting[];
}

export interface CareerSeasonHistory {
  readonly season: number;
  readonly champions: Readonly<Record<CareerDivision, string>>;
  readonly promoted: readonly string[];
  readonly relegated: readonly string[];
  readonly topScorerId: string;
  readonly transfers: number;
  readonly loans: number;
  readonly freeAgentSignings: number;
  readonly retired: number;
  readonly generated: number;
  readonly managerClubId: string;
  readonly managerFinish: number;
}

export interface CareerArchive {
  readonly version: typeof CAREER_ARCHIVE_VERSION;
  readonly throughSeason: number;
  readonly seasons: number;
  readonly champions: Readonly<Record<string, number>>;
  readonly newsCount: number;
  readonly transfers: number;
  readonly loans: number;
  readonly freeAgentSignings: number;
}

export interface CareerNews {
  readonly id: string;
  readonly season: number;
  readonly type:
    | 'title'
    | 'promotion'
    | 'relegation'
    | 'transfer'
    | 'retirement'
    | 'youth'
    | 'manager-fired'
    | 'manager-appointed';
  readonly template: string;
  readonly subjectIds: readonly string[];
}

export interface CareerManager {
  readonly id: string;
  readonly name: string;
  readonly clubId: string;
  readonly confidence: number;
  readonly prestige: number;
  readonly titles: number;
  readonly promotions: number;
  readonly seasons: number;
  readonly dismissals: number;
  readonly jobHistory: readonly Readonly<{
    clubId: string;
    fromSeason: number;
    toSeason: number | null;
    reason: 'appointed' | 'dismissed';
  }>[];
}

export interface CareerLeaderboardEntry {
  readonly managerId: string;
  readonly name: string;
  readonly prestige: number;
  readonly titles: number;
  readonly promotions: number;
}

export interface CareerWorld {
  readonly schemaVersion: typeof CAREER_WORLD_VERSION;
  readonly rulesVersion: typeof CAREER_RULES_VERSION;
  readonly contentVersion: string;
  readonly seed: string;
  readonly season: number;
  readonly clubs: readonly CareerClub[];
  readonly players: readonly CareerPlayer[];
  readonly ledger: readonly LedgerEntry[];
  readonly history: readonly CareerSeasonHistory[];
  readonly archive: CareerArchive;
  readonly news: readonly CareerNews[];
  readonly manager: CareerManager;
  readonly leaderboard: readonly CareerLeaderboardEntry[];
}

export interface CareerWorldConfig {
  readonly clubsPerDivision: number;
  readonly movementPlaces: number;
  readonly minimumSquad: number;
  readonly maximumSquad: number;
  readonly recentHistorySeasons: number;
  readonly maximumNews: number;
}

export const DEFAULT_CAREER_WORLD_CONFIG: CareerWorldConfig = Object.freeze({
  clubsPerDivision: 20,
  movementPlaces: 4,
  minimumSquad: 22,
  maximumSquad: 28,
  recentHistorySeasons: 5,
  maximumNews: 160,
});

const POSITION_MINIMUM: Readonly<Record<CareerPosition, number>> =
  Object.freeze({ GK: 2, DEF: 6, MID: 6, FWD: 4 });

interface MutableClub {
  id: string;
  name: string;
  division: CareerDivision;
  tier: string;
  reputation: number;
  balance: number;
  stadium: {
    capacity: number;
    ticketPrice: number;
    quality: number;
    averageAttendance: number;
  };
  squad: string[];
}

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

interface MutablePlayer extends Omit<Mutable<CareerPlayer>, 'career'> {
  career: { seasons: number; goals: number; clubs: string[] };
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

function roll(seed: string, ...segments: readonly (number | string)[]): number {
  return hashSeed([seed, ...segments].join('|')) / 4_294_967_296;
}

function integer(
  seed: string,
  minimum: number,
  maximum: number,
  ...segments: readonly (number | string)[]
): number {
  return (
    minimum + Math.floor(roll(seed, ...segments) * (maximum - minimum + 1))
  );
}

function rounded(value: number): number {
  return Math.round(value);
}

function deepFreezeArray<T>(values: readonly T[]): readonly T[] {
  for (const value of values)
    if (typeof value === 'object' && value !== null) Object.freeze(value);
  return Object.freeze([...values]);
}

function freezePlayer(player: MutablePlayer | CareerPlayer): CareerPlayer {
  return Object.freeze({
    ...player,
    contract:
      player.contract === null ? null : Object.freeze({ ...player.contract }),
    identity: Object.freeze({ ...player.identity }),
    attributes: Object.freeze({ ...player.attributes }),
    career: Object.freeze({
      ...player.career,
      clubs: Object.freeze([...player.career.clubs]),
    }),
  });
}

function freezeClub(club: MutableClub | CareerClub): CareerClub {
  return Object.freeze({
    ...club,
    stadium: Object.freeze({ ...club.stadium }),
    squad: Object.freeze([...club.squad]),
  });
}

function freezeManager(manager: CareerManager): CareerManager {
  return Object.freeze({
    ...manager,
    jobHistory: deepFreezeArray(
      manager.jobHistory.map((job) => Object.freeze({ ...job })),
    ),
  });
}

function freezeWorld(world: CareerWorld): CareerWorld {
  return Object.freeze({
    ...world,
    clubs: Object.freeze(world.clubs.map(freezeClub)),
    players: Object.freeze(world.players.map(freezePlayer)),
    ledger: Object.freeze(
      world.ledger.map((entry) =>
        Object.freeze({
          ...entry,
          postings: deepFreezeArray(
            entry.postings.map((posting) => Object.freeze({ ...posting })),
          ),
        }),
      ),
    ),
    history: Object.freeze(
      world.history.map((item) =>
        Object.freeze({
          ...item,
          champions: Object.freeze({ ...item.champions }),
          promoted: Object.freeze([...item.promoted]),
          relegated: Object.freeze([...item.relegated]),
        }),
      ),
    ),
    archive: Object.freeze({
      ...world.archive,
      champions: Object.freeze({ ...world.archive.champions }),
    }),
    news: Object.freeze(
      world.news.map((item) =>
        Object.freeze({
          ...item,
          subjectIds: Object.freeze([...item.subjectIds]),
        }),
      ),
    ),
    manager: freezeManager(world.manager),
    leaderboard: deepFreezeArray(
      world.leaderboard.map((item) => Object.freeze({ ...item })),
    ),
  });
}

function marketValue(strength: number, age: number, potential: number): number {
  const ageFactor = age <= 23 ? 1.35 : age <= 28 ? 1 : age <= 32 ? 0.66 : 0.35;
  return Math.max(
    80_000,
    rounded(strength * strength * 2_100 * ageFactor * (0.75 + potential / 200)),
  );
}

function salaryFor(strength: number, reputation: number): number {
  return Math.max(
    2_000,
    rounded(strength * strength * (2.1 + reputation / 100)),
  );
}

function validateConfig(config: CareerWorldConfig): void {
  for (const value of Object.values(config))
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error('Career config values must be positive safe integers');
  if (config.minimumSquad > config.maximumSquad)
    throw new Error('Minimum squad cannot exceed maximum squad');
  if (config.movementPlaces >= config.clubsPerDivision)
    throw new Error('Movement places must be below division size');
}

export function createCareerWorld(
  content: CareerWorldContent,
  options: Readonly<{
    seed?: string;
    managerName?: string;
    managerClubId?: string;
    config?: CareerWorldConfig;
  }> = {},
): CareerWorld {
  const config = options.config ?? DEFAULT_CAREER_WORLD_CONFIG;
  validateConfig(config);
  const seed = options.seed ?? 'footebas-career-v1';
  const clubIds = new Set(content.clubs.map(({ id }) => id));
  if (clubIds.size !== content.clubs.length)
    throw new Error('Career content club IDs must be unique');
  for (const division of ['serie-a', 'serie-b'] as const) {
    if (
      content.clubs.filter((club) => club.division === division).length !==
      config.clubsPerDivision
    )
      throw new Error(
        `${division} requires ${String(config.clubsPerDivision)} clubs`,
      );
  }
  const playerIds = new Set<string>();
  const clubs = content.clubs.map((club, clubIndex): CareerClub => {
    if (club.players.length < 18)
      throw new Error(`Club ${club.id} lacks a playable real-identity squad`);
    const reputation = clamp(
      rounded(
        club.players.reduce((sum, player) => sum + player.strength, 0) /
          club.players.length,
      ),
      1,
      100,
    );
    const squad = club.players
      .slice(0, config.maximumSquad)
      .map(({ id }) => id);
    for (const id of squad) {
      if (playerIds.has(id)) throw new Error(`Duplicate player ID ${id}`);
      playerIds.add(id);
    }
    const divisionFactor = club.division === 'serie-a' ? 1 : 0.55;
    return freezeClub({
      id: club.id,
      name: club.name,
      division: club.division,
      tier: club.tier,
      reputation,
      balance: rounded((26_000_000 + reputation * 720_000) * divisionFactor),
      stadium: {
        capacity:
          rounded(
            (12_000 +
              reputation * 430 +
              integer(seed, 0, 8_000, 'stadium', clubIndex)) /
              500,
          ) * 500,
        ticketPrice: club.division === 'serie-a' ? 58 : 38,
        quality: clamp(rounded(reputation * 0.8), 35, 95),
        averageAttendance: 0,
      },
      squad,
    });
  });
  const clubById = new Map(clubs.map((club) => [club.id, club]));
  const players = content.clubs.flatMap((contentClub) => {
    const club = clubById.get(contentClub.id);
    if (!club) throw new Error(`Missing normalized club ${contentClub.id}`);
    return contentClub.players
      .slice(0, config.maximumSquad)
      .map((player, index): CareerPlayer => {
        const age = clamp(player.age, 17, 39);
        const contractYears = 1 + integer(seed, 0, 2, 'contract', player.id);
        return freezePlayer({
          id: player.id,
          name: player.name,
          position: player.position,
          strength: clamp(player.strength, 1, 100),
          potential: clamp(player.potential, 1, 100),
          age,
          value: marketValue(player.strength, age, player.potential),
          clubId: contentClub.id,
          contract: {
            expiresAfterSeason: contractYears,
            salary: salaryFor(player.strength, club.reputation),
          },
          loanFromClubId: null,
          loanReturnSeason: null,
          identity: {
            source: player.identitySource,
            sourceId: player.identitySourceId,
          },
          attributes: {
            source: 'derived',
            version: player.attributesVersion,
            seed: player.attributesSeed,
          },
          career: { seasons: 0, goals: index % 8, clubs: [contentClub.id] },
        });
      });
  });
  const managerClubId =
    options.managerClubId ??
    content.clubs.find(({ division }) => division === 'serie-b')?.id;
  if (!managerClubId || !clubIds.has(managerClubId))
    throw new Error('Manager club must exist in career content');
  const manager: CareerManager = {
    id: `manager:${hashSeed(`${seed}|${options.managerName ?? 'Treinador'}`).toString(36)}`,
    name: options.managerName ?? 'Treinador',
    clubId: managerClubId,
    confidence: 60,
    prestige: 10,
    titles: 0,
    promotions: 0,
    seasons: 0,
    dismissals: 0,
    jobHistory: [
      {
        clubId: managerClubId,
        fromSeason: 1,
        toSeason: null,
        reason: 'appointed',
      },
    ],
  };
  return freezeWorld({
    schemaVersion: CAREER_WORLD_VERSION,
    rulesVersion: CAREER_RULES_VERSION,
    contentVersion: content.version,
    seed,
    season: 1,
    clubs,
    players,
    ledger: [],
    history: [],
    archive: {
      version: CAREER_ARCHIVE_VERSION,
      throughSeason: 0,
      seasons: 0,
      champions: {},
      newsCount: 0,
      transfers: 0,
      loans: 0,
      freeAgentSignings: 0,
    },
    news: [],
    manager,
    leaderboard: [
      {
        managerId: manager.id,
        name: manager.name,
        prestige: manager.prestige,
        titles: 0,
        promotions: 0,
      },
    ],
  });
}

function averageStrength(
  club: MutableClub,
  players: readonly MutablePlayer[],
): number {
  const members = players
    .filter((player) => player.clubId === club.id)
    .sort((left, right) => right.strength - left.strength)
    .slice(0, 18);
  return members.length === 0
    ? 1
    : members.reduce((sum, player) => sum + player.strength, 0) /
        members.length;
}

function standingsFor(
  world: CareerWorld,
  clubs: MutableClub[],
  players: MutablePlayer[],
  division: CareerDivision,
): MutableClub[] {
  return clubs
    .filter((club) => club.division === division)
    .sort((left, right) => {
      const leftScore =
        averageStrength(left, players) * 10 +
        left.reputation * 1.5 +
        roll(world.seed, world.season, division, left.id, 'table') * 240;
      const rightScore =
        averageStrength(right, players) * 10 +
        right.reputation * 1.5 +
        roll(world.seed, world.season, division, right.id, 'table') * 240;
      return rightScore - leftScore || left.id.localeCompare(right.id);
    });
}

function positionCount(
  clubId: string,
  position: CareerPosition,
  players: readonly MutablePlayer[],
): number {
  return players.filter(
    (player) => player.clubId === clubId && player.position === position,
  ).length;
}

function clonePlayer(player: CareerPlayer): MutablePlayer {
  return {
    ...player,
    identity: { ...player.identity },
    attributes: { ...player.attributes },
    contract: player.contract === null ? null : { ...player.contract },
    career: { ...player.career, clubs: [...player.career.clubs] },
  };
}

function updateClubSquads(
  clubs: MutableClub[],
  players: readonly MutablePlayer[],
): void {
  for (const club of clubs)
    club.squad = players
      .filter((player) => player.clubId === club.id)
      .map(({ id }) => id)
      .sort();
}

interface TransactionCounts {
  transfers: number;
  loans: number;
  freeAgents: number;
  generated: number;
}

export function advanceCareerSeason(
  world: CareerWorld,
  config: CareerWorldConfig = DEFAULT_CAREER_WORLD_CONFIG,
): CareerWorld {
  validateConfig(config);
  const completedSeason = world.season;
  const clubs: MutableClub[] = world.clubs.map((club) => ({
    ...club,
    stadium: { ...club.stadium },
    squad: [...club.squad],
  }));
  let players: MutablePlayer[] = world.players.map(clonePlayer);
  const ledger = [...world.ledger];
  const news = [...world.news];
  let ledgerSequence = 0;
  let newsSequence = 0;
  const addNews = (
    type: CareerNews['type'],
    template: string,
    subjectIds: readonly string[],
  ): void => {
    news.push(
      Object.freeze({
        id: `news:${String(completedSeason)}:${String(newsSequence++)}`,
        season: completedSeason,
        type,
        template,
        subjectIds: Object.freeze([...subjectIds]),
      }),
    );
  };
  const journal = (
    type: LedgerType,
    sourceId: string,
    postings: readonly LedgerPosting[],
  ): void => {
    const sum = postings.reduce((total, posting) => total + posting.amount, 0);
    if (sum !== 0 || sourceId.length === 0 || postings.length < 2)
      throw new Error('Ledger entry must be balanced and source-identified');
    for (const posting of postings) {
      if (!Number.isSafeInteger(posting.amount))
        throw new Error('Ledger amounts must be safe integers');
      if (posting.accountId.startsWith('club:')) {
        const club = clubs.find(({ id }) => `club:${id}` === posting.accountId);
        if (!club)
          throw new Error(`Unknown ledger club account ${posting.accountId}`);
        club.balance += posting.amount;
      }
    }
    ledger.push(
      Object.freeze({
        id: `ledger:${String(completedSeason)}:${String(ledgerSequence++)}`,
        season: completedSeason,
        type,
        sourceId,
        postings: deepFreezeArray(
          postings.map((posting) => Object.freeze({ ...posting })),
        ),
      }),
    );
  };

  // Loans return before contracts and the next market are evaluated.
  for (const player of players) {
    if (
      player.loanFromClubId !== null &&
      player.loanReturnSeason !== null &&
      player.loanReturnSeason <= completedSeason
    ) {
      player.clubId = player.loanFromClubId;
      player.loanFromClubId = null;
      player.loanReturnSeason = null;
    }
  }
  updateClubSquads(clubs, players);

  const tableA = standingsFor(world, clubs, players, 'serie-a');
  const tableB = standingsFor(world, clubs, players, 'serie-b');
  const relegated = tableA.slice(-config.movementPlaces).map(({ id }) => id);
  const promoted = tableB.slice(0, config.movementPlaces).map(({ id }) => id);
  const champions = {
    'serie-a': tableA[0]?.id ?? '',
    'serie-b': tableB[0]?.id ?? '',
  } as const;
  for (const clubId of relegated) {
    const club = clubs.find(({ id }) => id === clubId);
    if (club) club.division = 'serie-b';
    addNews('relegation', '{club} foi rebaixado.', [clubId]);
  }
  for (const clubId of promoted) {
    const club = clubs.find(({ id }) => id === clubId);
    if (club) club.division = 'serie-a';
    addNews('promotion', '{club} conquistou o acesso.', [clubId]);
  }
  for (const [division, clubId] of Object.entries(champions))
    addNews('title', `{club} venceu ${division}.`, [clubId]);

  for (const club of clubs) {
    const rankingA = tableA.findIndex(({ id }) => id === club.id);
    const ranking =
      rankingA >= 0 ? rankingA : tableB.findIndex(({ id }) => id === club.id);
    const completedDivision: CareerDivision =
      rankingA >= 0 ? 'serie-a' : 'serie-b';
    const strength = averageStrength(club, players);
    const attendance = clamp(
      rounded(
        club.stadium.capacity *
          (0.46 +
            club.reputation / 220 -
            (club.stadium.ticketPrice - 35) / 240),
      ),
      rounded(club.stadium.capacity * 0.3),
      club.stadium.capacity,
    );
    club.stadium.averageAttendance = attendance;
    const ticketRevenue = attendance * club.stadium.ticketPrice * 19;
    const sponsorRevenue = rounded(
      (8_000_000 + club.reputation * 250_000) *
        (club.division === 'serie-a' ? 1 : 0.55),
    );
    const prizeRevenue = rounded(
      (completedDivision === 'serie-a' ? 24_000_000 : 10_000_000) *
        (1 - Math.max(0, ranking) / 28),
    );
    const wages = players
      .filter((player) => player.clubId === club.id)
      .reduce((sum, player) => sum + (player.contract?.salary ?? 0) * 52, 0);
    const maintenance = rounded(
      club.stadium.capacity *
        (650 + club.stadium.quality * 6) *
        (club.division === 'serie-a' ? 1 : 0.65),
    );
    journal('ticket', `attendance:${String(completedSeason)}:${club.id}`, [
      { accountId: `club:${club.id}`, amount: ticketRevenue },
      { accountId: 'external:supporters', amount: -ticketRevenue },
    ]);
    journal('sponsor', `sponsor:${String(completedSeason)}:${club.id}`, [
      { accountId: `club:${club.id}`, amount: sponsorRevenue },
      { accountId: 'external:sponsors', amount: -sponsorRevenue },
    ]);
    journal('prize', `league:${String(completedSeason)}:${club.id}`, [
      { accountId: `club:${club.id}`, amount: prizeRevenue },
      { accountId: 'external:competition', amount: -prizeRevenue },
    ]);
    journal('salary', `payroll:${String(completedSeason)}:${club.id}`, [
      { accountId: `club:${club.id}`, amount: -wages },
      { accountId: 'external:players', amount: wages },
    ]);
    journal(
      'stadium-maintenance',
      `stadium:${String(completedSeason)}:${club.id}`,
      [
        { accountId: `club:${club.id}`, amount: -maintenance },
        { accountId: 'external:stadium', amount: maintenance },
      ],
    );
    if (
      club.balance > 130_000_000 &&
      club.stadium.capacity < 70_000 &&
      roll(world.seed, completedSeason, club.id, 'expand') < 0.18
    ) {
      const expansion = 2_000;
      const cost = expansion * 5_500;
      journal(
        'stadium-expansion',
        `expansion:${String(completedSeason)}:${club.id}`,
        [
          { accountId: `club:${club.id}`, amount: -cost },
          { accountId: 'external:construction', amount: cost },
        ],
      );
      club.stadium.capacity += expansion;
      club.stadium.quality = clamp(club.stadium.quality + 1, 1, 100);
    }
    club.reputation = clamp(
      rounded(
        club.reputation * 0.94 +
          strength * 0.04 +
          (ranking >= 0 ? (20 - ranking) * 0.1 : 0),
      ),
      20,
      95,
    );
  }

  let retired = 0;
  const survivors: MutablePlayer[] = [];
  for (const player of players) {
    const retirementChance =
      player.age < 34 ? 0 : clamp((player.age - 33) * 0.16, 0.12, 0.92);
    if (
      player.age >= 34 &&
      roll(world.seed, completedSeason, player.id, 'retire') < retirementChance
    ) {
      retired += 1;
      addNews('retirement', '{player} anunciou a aposentadoria.', [player.id]);
      continue;
    }
    const age = player.age + 1;
    const growth =
      age <= 22
        ? (player.potential - player.strength) * 0.06 + 0.25
        : age <= 27
          ? 0.1
          : age <= 30
            ? -0.2
            : -(age - 29) * 0.65;
    const variation =
      roll(world.seed, completedSeason, player.id, 'evolve') * 1.5 - 0.75;
    player.age = age;
    player.strength = clamp(
      rounded(player.strength + growth + variation),
      28,
      96,
    );
    player.value = marketValue(player.strength, age, player.potential);
    player.career.seasons += 1;
    player.career.goals +=
      player.position === 'FWD'
        ? integer(world.seed, 2, 18, completedSeason, player.id, 'goals')
        : integer(world.seed, 0, 6, completedSeason, player.id, 'goals');
    if (
      player.contract !== null &&
      player.contract.expiresAfterSeason <= completedSeason &&
      player.loanFromClubId === null
    ) {
      const currentClub = clubs.find(({ id }) => id === player.clubId);
      if (
        currentClub !== undefined &&
        roll(world.seed, completedSeason, player.id, 'renew') < 0.72
      ) {
        player.contract = {
          expiresAfterSeason:
            completedSeason +
            2 +
            integer(world.seed, 0, 1, completedSeason, player.id, 'renew-term'),
          salary: salaryFor(player.strength, currentClub.reputation),
        };
      } else {
        player.clubId = null;
        player.contract = null;
      }
    }
    survivors.push(player);
  }
  players = survivors;
  updateClubSquads(clubs, players);

  const counts: TransactionCounts = {
    transfers: 0,
    loans: 0,
    freeAgents: 0,
    generated: 0,
  };
  const positions = ['GK', 'DEF', 'MID', 'FWD'] as const;
  const signPlayer = (
    player: MutablePlayer,
    buyer: MutableClub,
    kind: 'transfer' | 'loan' | 'free-agent',
  ): void => {
    const sellerId = player.clubId;
    if (kind === 'loan' && sellerId !== null) {
      player.loanFromClubId = sellerId;
      player.loanReturnSeason = completedSeason + 1;
      player.clubId = buyer.id;
      counts.loans += 1;
      addNews('transfer', '{player} foi emprestado a {club}.', [
        player.id,
        buyer.id,
      ]);
      return;
    }
    const fee =
      kind === 'free-agent'
        ? Math.min(1_500_000, rounded(player.value * 0.08))
        : Math.min(
            rounded(player.value * 0.42),
            Math.max(0, buyer.balance - 5_000_000),
          );
    if (fee > 0) {
      const receivingAccount =
        sellerId === null ? 'external:free-agents' : `club:${sellerId}`;
      journal(
        kind === 'free-agent' ? 'free-agent' : 'transfer',
        `${kind}:${String(completedSeason)}:${player.id}:${buyer.id}`,
        [
          { accountId: `club:${buyer.id}`, amount: -fee },
          { accountId: receivingAccount, amount: fee },
        ],
      );
    }
    player.clubId = buyer.id;
    player.loanFromClubId = null;
    player.loanReturnSeason = null;
    player.contract = {
      expiresAfterSeason:
        completedSeason +
        2 +
        integer(world.seed, 0, 1, completedSeason, player.id, buyer.id, 'term'),
      salary: salaryFor(player.strength, buyer.reputation),
    };
    if (!player.career.clubs.includes(buyer.id))
      player.career.clubs.push(buyer.id);
    if (kind === 'transfer') counts.transfers += 1;
    else counts.freeAgents += 1;
    addNews(
      'transfer',
      kind === 'transfer'
        ? '{player} foi negociado com {club}.'
        : '{club} contratou {player}, que estava livre.',
      [player.id, buyer.id],
    );
  };

  const processedClubIds = new Set<string>();
  for (const club of [...clubs].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    for (const position of positions) {
      while (
        positionCount(club.id, position, players) < POSITION_MINIMUM[position]
      ) {
        const free = players
          .filter(
            (player) => player.clubId === null && player.position === position,
          )
          .sort(
            (left, right) =>
              right.strength - left.strength || left.id.localeCompare(right.id),
          )[0];
        const candidate = players
          .filter(
            (player) =>
              player.clubId !== null &&
              player.clubId !== club.id &&
              !processedClubIds.has(player.clubId) &&
              player.position === position &&
              positionCount(player.clubId, position, players) >
                POSITION_MINIMUM[position] &&
              player.loanFromClubId === null,
          )
          .sort(
            (left, right) =>
              left.value - right.value || left.id.localeCompare(right.id),
          )[0];
        const preferMarket =
          candidate !== undefined &&
          roll(
            world.seed,
            completedSeason,
            club.id,
            position,
            'market-choice',
          ) < 0.38;
        if (
          candidate &&
          preferMarket &&
          candidate.age <= 22 &&
          roll(world.seed, completedSeason, candidate.id, club.id, 'loan') <
            0.48
        ) {
          signPlayer(candidate, club, 'loan');
          continue;
        }
        if (
          candidate &&
          preferMarket &&
          club.balance > candidate.value * 0.2 + 8_000_000
        ) {
          signPlayer(candidate, club, 'transfer');
          continue;
        }
        if (free) {
          signPlayer(free, club, 'free-agent');
          continue;
        }
        const generatedIndex = counts.generated++;
        const id = `generated:${String(completedSeason)}:${club.id}:${position}:${String(generatedIndex)}`;
        const strengthFloor = club.division === 'serie-a' ? 60 : 52;
        const strength = clamp(
          Math.max(
            strengthFloor,
            rounded(
              averageStrength(club, players) -
                7 +
                roll(world.seed, id, 'strength') * 7,
            ),
          ),
          38,
          82,
        );
        const generated: MutablePlayer = {
          id,
          name: `Jogador gerado ${hashSeed(`${world.seed}|${id}`).toString(36).toUpperCase()}`,
          position,
          strength,
          potential: clamp(
            strength + integer(world.seed, 5, 20, id, 'potential'),
            45,
            94,
          ),
          age: integer(world.seed, 17, 20, id, 'age'),
          value: marketValue(strength, 18, strength + 12),
          clubId: club.id,
          contract: {
            expiresAfterSeason: completedSeason + 3,
            salary: salaryFor(strength, club.reputation),
          },
          loanFromClubId: null,
          loanReturnSeason: null,
          identity: {
            source: 'generated-derived',
            sourceId: `generator:${CAREER_RULES_VERSION}`,
          },
          attributes: {
            source: 'derived',
            version: CAREER_RULES_VERSION,
            seed: `${world.seed}|${id}`,
          },
          career: { seasons: 0, goals: 0, clubs: [club.id] },
        };
        players.push(generated);
        addNews('youth', '{club} promoveu um atleta gerado pela base.', [
          club.id,
          generated.id,
        ]);
      }
    }
    while (
      players.filter((player) => player.clubId === club.id).length <
      config.minimumSquad
    ) {
      const position =
        positions[
          integer(
            world.seed,
            0,
            positions.length - 1,
            completedSeason,
            club.id,
            'depth',
            players.length,
          )
        ] ?? 'MID';
      const id = `generated:${String(completedSeason)}:${club.id}:${position}:depth:${String(counts.generated++)}`;
      const strength = clamp(
        Math.max(
          club.division === 'serie-a' ? 58 : 50,
          rounded(
            averageStrength(club, players) - 9 + roll(world.seed, id) * 6,
          ),
        ),
        36,
        78,
      );
      players.push({
        id,
        name: `Jogador gerado ${hashSeed(id).toString(36).toUpperCase()}`,
        position,
        strength,
        potential: clamp(strength + 14, 40, 92),
        age: integer(world.seed, 17, 20, id),
        value: marketValue(strength, 18, strength + 14),
        clubId: club.id,
        contract: {
          expiresAfterSeason: completedSeason + 3,
          salary: salaryFor(strength, club.reputation),
        },
        loanFromClubId: null,
        loanReturnSeason: null,
        identity: {
          source: 'generated-derived',
          sourceId: `generator:${CAREER_RULES_VERSION}`,
        },
        attributes: {
          source: 'derived',
          version: CAREER_RULES_VERSION,
          seed: `${world.seed}|${id}`,
        },
        career: { seasons: 0, goals: 0, clubs: [club.id] },
      });
    }
    const members = players
      .filter((player) => player.clubId === club.id)
      .sort(
        (left, right) =>
          right.strength - left.strength || left.id.localeCompare(right.id),
      );
    for (const released of members.slice(config.maximumSquad)) {
      released.clubId = null;
      released.contract = null;
      released.loanFromClubId = null;
      released.loanReturnSeason = null;
    }
    processedClubIds.add(club.id);
  }
  const retainedFreeAgents = new Set(
    players
      .filter(({ clubId }) => clubId === null)
      .sort(
        (left, right) =>
          right.strength - left.strength || left.id.localeCompare(right.id),
      )
      .slice(0, config.clubsPerDivision * 2)
      .map(({ id }) => id),
  );
  players = players.filter(
    (player) => player.clubId !== null || retainedFreeAgents.has(player.id),
  );
  updateClubSquads(clubs, players);

  const managerTable = tableA.some(({ id }) => id === world.manager.clubId)
    ? tableA
    : tableB;
  const managerFinish = Math.max(
    1,
    managerTable.findIndex(({ id }) => id === world.manager.clubId) + 1,
  );
  const managerWasChampion =
    champions['serie-a'] === world.manager.clubId ||
    champions['serie-b'] === world.manager.clubId;
  const managerWasPromoted = promoted.includes(world.manager.clubId);
  const confidenceDelta = managerWasChampion
    ? 25
    : managerWasPromoted
      ? 18
      : (11 - managerFinish) * 2 - 3;
  let manager: CareerManager = {
    ...world.manager,
    confidence: clamp(world.manager.confidence + confidenceDelta, 0, 100),
    prestige: clamp(
      world.manager.prestige +
        (managerWasChampion
          ? 15
          : managerWasPromoted
            ? 8
            : managerFinish <= 8
              ? 2
              : -1),
      0,
      1000,
    ),
    titles: world.manager.titles + (managerWasChampion ? 1 : 0),
    promotions: world.manager.promotions + (managerWasPromoted ? 1 : 0),
    seasons: world.manager.seasons + 1,
  };
  if (manager.confidence < 24) {
    const oldClubId = manager.clubId;
    const candidates = clubs
      .filter((club) => club.id !== oldClubId)
      .sort(
        (left, right) =>
          Math.abs(left.reputation - (45 + manager.prestige / 5)) -
            Math.abs(right.reputation - (45 + manager.prestige / 5)) ||
          left.id.localeCompare(right.id),
      );
    const nextClub = candidates[0];
    if (!nextClub)
      throw new Error('Manager dismissal requires an available club');
    const closedJobs = manager.jobHistory.map((job, index) =>
      index === manager.jobHistory.length - 1
        ? { ...job, toSeason: completedSeason, reason: 'dismissed' as const }
        : job,
    );
    manager = {
      ...manager,
      clubId: nextClub.id,
      confidence: 55,
      dismissals: manager.dismissals + 1,
      jobHistory: [
        ...closedJobs,
        {
          clubId: nextClub.id,
          fromSeason: completedSeason + 1,
          toSeason: null,
          reason: 'appointed',
        },
      ],
    };
    addNews('manager-fired', '{manager} foi demitido.', [
      manager.id,
      oldClubId,
    ]);
    addNews('manager-appointed', '{manager} assumiu um novo clube.', [
      manager.id,
      nextClub.id,
    ]);
  }

  const topScorer = [...players].sort(
    (left, right) =>
      right.career.goals - left.career.goals || left.id.localeCompare(right.id),
  )[0];
  if (!topScorer)
    throw new Error('Career world cannot continue without players');
  const historyItem: CareerSeasonHistory = {
    season: completedSeason,
    champions,
    promoted,
    relegated,
    topScorerId: topScorer.id,
    transfers: counts.transfers,
    loans: counts.loans,
    freeAgentSignings: counts.freeAgents,
    retired,
    generated: counts.generated,
    managerClubId: world.manager.clubId,
    managerFinish,
  };
  let history = [...world.history, historyItem];
  let archive: CareerArchive = world.archive;
  if (history.length > config.recentHistorySeasons) {
    const compacted = history.slice(
      0,
      history.length - config.recentHistorySeasons,
    );
    const archiveChampions = { ...archive.champions };
    for (const item of compacted)
      for (const clubId of Object.values(item.champions))
        archiveChampions[clubId] = (archiveChampions[clubId] ?? 0) + 1;
    archive = {
      version: CAREER_ARCHIVE_VERSION,
      throughSeason: compacted.at(-1)?.season ?? archive.throughSeason,
      seasons: archive.seasons + compacted.length,
      champions: archiveChampions,
      newsCount:
        archive.newsCount +
        news.filter((item) => item.season <= (compacted.at(-1)?.season ?? 0))
          .length,
      transfers:
        archive.transfers +
        compacted.reduce((sum, item) => sum + item.transfers, 0),
      loans:
        archive.loans + compacted.reduce((sum, item) => sum + item.loans, 0),
      freeAgentSignings:
        archive.freeAgentSignings +
        compacted.reduce((sum, item) => sum + item.freeAgentSignings, 0),
    };
    history = history.slice(-config.recentHistorySeasons);
  }
  const retainedNews = news
    .filter((item) => item.season > archive.throughSeason)
    .slice(-config.maximumNews);
  const leaderboard: readonly CareerLeaderboardEntry[] = [
    {
      managerId: manager.id,
      name: manager.name,
      prestige: manager.prestige,
      titles: manager.titles,
      promotions: manager.promotions,
    },
  ];
  return freezeWorld({
    schemaVersion: CAREER_WORLD_VERSION,
    rulesVersion: CAREER_RULES_VERSION,
    contentVersion: world.contentVersion,
    seed: world.seed,
    season: completedSeason + 1,
    clubs,
    players,
    ledger,
    history,
    archive,
    news: retainedNews,
    manager,
    leaderboard,
  });
}

export interface CareerWorldSave {
  readonly schemaVersion: typeof CAREER_SAVE_VERSION;
  readonly rulesVersion: typeof CAREER_RULES_VERSION;
  readonly migrationHistory: readonly string[];
  readonly snapshot: CareerWorld;
}

export interface LegacyCareerWorldSave {
  readonly schemaVersion: 'career-save-v0';
  readonly snapshot: CareerWorld;
}

export function createCareerWorldSave(world: CareerWorld): CareerWorldSave {
  return Object.freeze({
    schemaVersion: CAREER_SAVE_VERSION,
    rulesVersion: CAREER_RULES_VERSION,
    migrationHistory: Object.freeze([]),
    snapshot: world,
  });
}

export function migrateCareerWorldSave(
  save: CareerWorldSave | LegacyCareerWorldSave,
): CareerWorldSave {
  if (save.schemaVersion === CAREER_SAVE_VERSION) return save;
  return Object.freeze({
    schemaVersion: CAREER_SAVE_VERSION,
    rulesVersion: CAREER_RULES_VERSION,
    migrationHistory: Object.freeze(['career-save-v0->career-save-v1']),
    snapshot: save.snapshot,
  });
}

export function ledgerConservationErrors(
  entries: readonly LedgerEntry[],
): readonly string[] {
  return Object.freeze(
    entries.flatMap((entry) => {
      const errors: string[] = [];
      if (entry.sourceId.length === 0)
        errors.push(`${entry.id}: missing source`);
      if (
        entry.postings.reduce((sum, posting) => sum + posting.amount, 0) !== 0
      )
        errors.push(`${entry.id}: unbalanced`);
      if (
        entry.postings.some((posting) => !Number.isSafeInteger(posting.amount))
      )
        errors.push(`${entry.id}: unsafe amount`);
      return errors;
    }),
  );
}
