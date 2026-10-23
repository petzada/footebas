import type { PlayerView } from '@/lib/career-api';
import {
  addDays,
  ManagementError,
  marketRefusalMessage,
  transferWindowOn,
  type ChemistryView,
  type FinanceCategories,
  type ListingInput,
  type MarketListingView,
  type MarketLoanView,
  type MarketOfferInput,
  type MarketOfferView,
  type MarketQuery,
  type MarketResultView,
  type MarketView,
  type MembershipTier,
  type MembershipView,
  type OfficeView,
  type SponsorContractView,
  type SponsorOfferView,
} from '@/lib/management-model';

/**
 * Offline demo of the market and the office for `InMemoryCareerApi`: the same
 * rules as ADR 0008 (seller and buyer AI, windows, squad limit) and ADR 0011
 * (negotiable sponsorship, fan membership) in a tiny deterministic form, so
 * the screens and their tests behave like the server without one.
 */

export const DEMO_MAX_SQUAD = 35;
const REPUTATION = 76;
const FAN_CONFIDENCE = 81;
const POINTS_PER_GAME = 1.8;

type CatalogSeed = readonly [
  name: string,
  age: number,
  position: string,
  strength: number,
  value: number,
  wage: number,
  club: string | null,
  origin: 'national' | 'foreign',
  country: string,
  listed?: boolean,
];

const CATALOG: readonly CatalogSeed[] = [
  [
    'Gustavo Scarpa',
    32,
    'MEI',
    80,
    13_500_000,
    360_000,
    'Atlético Mineiro',
    'national',
    'Brasil',
    true,
  ],
  [
    'Lucas Esquivel',
    22,
    'LE',
    74,
    9_200_000,
    170_000,
    'Athletico Paranaense',
    'national',
    'Argentina',
  ],
  [
    'Vitão',
    26,
    'ZAG',
    78,
    11_800_000,
    260_000,
    'Atlético Mineiro',
    'national',
    'Brasil',
  ],
  ['Gilberto', 31, 'LD', 69, 0, 110_000, null, 'national', 'Brasil'],
  [
    'Matías Rojas',
    29,
    'MEI',
    79,
    10_400_000,
    300_000,
    'Corinthians',
    'national',
    'Paraguai',
  ],
  [
    'Yuri Alberto',
    25,
    'ATA',
    81,
    24_000_000,
    520_000,
    'Corinthians',
    'national',
    'Brasil',
  ],
  [
    'Hulk',
    39,
    'ATA',
    78,
    2_500_000,
    700_000,
    'Atlético Mineiro',
    'national',
    'Brasil',
  ],
  [
    'Luciano Juba',
    26,
    'LE',
    75,
    7_600_000,
    180_000,
    'Bahia',
    'national',
    'Brasil',
  ],
  [
    'Everton Ribeiro',
    36,
    'MEI',
    72,
    1_200_000,
    380_000,
    'Bahia',
    'national',
    'Brasil',
  ],
  [
    'Marcos Leonardo',
    23,
    'ATA',
    77,
    18_000_000,
    320_000,
    'Al Hilal',
    'foreign',
    'Brasil',
  ],
  [
    'Miguel Borja',
    33,
    'ATA',
    76,
    4_800_000,
    350_000,
    'River Plate',
    'foreign',
    'Colômbia',
    true,
  ],
  [
    'Franco Armani',
    39,
    'GOL',
    77,
    900_000,
    300_000,
    'River Plate',
    'foreign',
    'Argentina',
  ],
  [
    'Edinson Cavani',
    39,
    'ATA',
    74,
    600_000,
    400_000,
    'Boca Juniors',
    'foreign',
    'Uruguai',
  ],
  [
    'Joaquín Piquerez',
    27,
    'LE',
    79,
    15_000_000,
    330_000,
    'Palmeiras',
    'national',
    'Uruguai',
  ],
  [
    'Weverton',
    38,
    'GOL',
    79,
    1_800_000,
    420_000,
    'Palmeiras',
    'national',
    'Brasil',
  ],
  [
    'Kaio Jorge',
    24,
    'ATA',
    80,
    21_000_000,
    380_000,
    'Cruzeiro',
    'national',
    'Brasil',
  ],
  [
    'Lucas Silva',
    33,
    'VOL',
    73,
    2_100_000,
    220_000,
    'Cruzeiro',
    'national',
    'Brasil',
  ],
  [
    'Alan Patrick',
    35,
    'MEI',
    76,
    2_900_000,
    360_000,
    'Internacional',
    'national',
    'Brasil',
  ],
  [
    'Bernabei',
    25,
    'LE',
    74,
    8_300_000,
    190_000,
    'Internacional',
    'national',
    'Argentina',
  ],
  [
    'Carlos Palacios',
    25,
    'MEI',
    75,
    9_900_000,
    210_000,
    'Colo-Colo',
    'foreign',
    'Chile',
  ],
  [
    'Felipe Loyola',
    25,
    'MC',
    74,
    6_500_000,
    160_000,
    'Independiente',
    'foreign',
    'Chile',
    true,
  ],
  [
    'Arthur Cabral',
    28,
    'ATA',
    78,
    12_000_000,
    410_000,
    'Botafogo',
    'national',
    'Brasil',
  ],
  [
    'Lucas Moura',
    33,
    'PD',
    76,
    3_200_000,
    450_000,
    'São Paulo',
    'national',
    'Brasil',
  ],
  [
    'Wendell',
    32,
    'LE',
    75,
    2_400_000,
    290_000,
    'São Paulo',
    'national',
    'Brasil',
  ],
  [
    'Robert Arboleda',
    34,
    'ZAG',
    76,
    1_900_000,
    310_000,
    'São Paulo',
    'national',
    'Equador',
  ],
  [
    'Dudu Vieira',
    20,
    'VOL',
    66,
    3_000_000,
    60_000,
    'Fluminense',
    'national',
    'Brasil',
  ],
  [
    'Neymar Jr.',
    34,
    'PE',
    82,
    16_000_000,
    1_900_000,
    'Santos',
    'national',
    'Brasil',
  ],
  [
    'Zé Rafael',
    32,
    'VOL',
    73,
    2_200_000,
    260_000,
    'Santos',
    'national',
    'Brasil',
  ],
  ['Paulinho', 31, 'LD', 68, 0, 90_000, null, 'national', 'Brasil'],
  ['Wallace', 29, 'ZAG', 66, 0, 80_000, null, 'national', 'Brasil'],
];

const SPONSORS = [
  ['Loja Vestiário', 'segura'],
  ['Banco Torcida', 'curta'],
  ['Refrigerantes Gol de Placa', 'por metas'],
] as const;

export interface DemoManagement {
  currentDate: string;
  season: number;
  cash: number;
  catalog: MarketResultView[];
  listings: MarketListingView[];
  offersReceived: MarketOfferView[];
  offersSent: MarketOfferView[];
  loans: MarketLoanView[];
  sponsorOffers: SponsorOfferView[];
  sponsorContract?: SponsorContractView;
  sponsorHistory: SponsorContractView[];
  membership: { monthlyPrice: number; tier: MembershipTier };
  /** Starters of the lineup registered at the last match. */
  lastEleven: readonly string[];
  chemistry: number;
  matches: number;
  ledger: {
    sponsor: number;
    membership: number;
    transferIn: number;
    transferOut: number;
  };
  sequence: number;
}

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export function createDemoManagement(
  startDate: string,
  starters: readonly string[],
): DemoManagement {
  const reference = 2_800_000;
  const season = Number(startDate.slice(0, 4));
  const profiles = {
    segura: { factor: 1, months: 24, bonus: [1, 1, 1], fee: 6 },
    curta: { factor: 0.92, months: 12, bonus: [2, 2, 1.5], fee: 3 },
    'por metas': { factor: 0.8, months: 36, bonus: [4, 4, 3], fee: 9 },
  } as const;
  return {
    currentDate: startDate,
    season,
    cash: 38_600_000,
    catalog: CATALOG.map((seed) => ({
      id: `cat_${slug(seed[0])}`,
      name: seed[0],
      age: seed[1],
      position: seed[2],
      strength: seed[3],
      value: seed[4],
      wage: seed[5],
      ...(seed[6]
        ? { clubId: `club_${slug(seed[6])}`, clubName: seed[6] }
        : {}),
      origin: seed[7],
      country: seed[8],
      freeAgent: seed[6] === null,
      listed: seed[9] ?? false,
    })),
    listings: [],
    offersReceived: [
      {
        id: 'offer_in_1',
        kind: 'buy',
        playerId: 'fla-19',
        playerName: 'Gonzalo Plata',
        counterpartClubName: 'Cruzeiro',
        fee: 14_000_000,
        wage: 330_000,
        status: 'pending',
        createdOn: startDate,
        expiresOn: addDays(startDate, 7),
        awaiting: 'manager',
      },
    ],
    offersSent: [],
    loans: [
      {
        playerId: 'loan_matheus',
        playerName: 'Matheus Gonçalves',
        direction: 'out',
        counterpartClubName: 'Red Bull Bragantino',
        startsOn: `${String(season)}-01-05`,
        endsOn: `${String(season)}-12-31`,
      },
    ],
    sponsorOffers: SPONSORS.map(([sponsorName, profile], index) => {
      const spec = profiles[profile];
      const monthlyValue =
        Math.round(
          (reference * spec.factor * (1 + (index - 1) * 0.03)) / 1000,
        ) * 1000;
      return {
        id: `sponsor_${String(index + 1)}`,
        sponsorName,
        monthlyValue,
        durationMonths: spec.months,
        bonuses: {
          title: monthlyValue * spec.bonus[0],
          promotion: 0,
          continental: monthlyValue * spec.bonus[2],
        },
        terminationFee: monthlyValue * spec.fee,
        status: 'pending',
        expiresOn: addDays(startDate, 45),
        counterRange: {
          min: monthlyValue + 1,
          max: Math.round(monthlyValue * 1.5),
        },
      };
    }),
    sponsorHistory: [],
    membership: { monthlyPrice: 40, tier: 'intermediate' },
    lastEleven: starters,
    chemistry: 58,
    matches: 4,
    ledger: {
      sponsor: 1_400_000,
      membership: 0,
      transferIn: 0,
      transferOut: 5_800_000,
    },
    sequence: 0,
  };
}

const nextId = (state: DemoManagement, prefix: string) => {
  state.sequence += 1;
  return `${prefix}_${String(state.sequence)}`;
};

function refuse(code: string, state: DemoManagement): never {
  throw new ManagementError(
    marketRefusalMessage(code, transferWindowOn(state.currentDate)) ??
      'Operação recusada.',
    code,
  );
}

function requireWindow(state: DemoManagement) {
  if (transferWindowOn(state.currentDate).status === 'closed')
    refuse('TRANSFER_WINDOW_CLOSED', state);
}

// --- market -----------------------------------------------------------------
export function demoMarketView(
  state: DemoManagement,
  club: string,
  players: readonly PlayerView[],
  query: MarketQuery = {},
): MarketView {
  const text = query.text?.trim().toLowerCase();
  const results = state.catalog.filter(
    (player) =>
      (!text || player.name.toLowerCase().includes(text)) &&
      (!query.position || player.position === query.position) &&
      (!query.minStrength || player.strength >= query.minStrength) &&
      (!query.maxAge || player.age <= query.maxAge) &&
      (query.maxValue === undefined || player.value <= query.maxValue) &&
      (!query.freeAgentsOnly || player.freeAgent) &&
      (!query.origin ||
        query.origin === 'all' ||
        (query.origin === 'foreign'
          ? player.origin === 'foreign'
          : player.origin !== 'foreign')),
  );
  return {
    currentDate: state.currentDate,
    club: {
      id: `club_${slug(club)}`,
      name: club,
      cash: state.cash,
      squadSize: players.length,
      maxSquadSize: DEMO_MAX_SQUAD,
      monthlyWageBill: 920_000,
    },
    window: transferWindowOn(state.currentDate),
    listings: state.listings,
    offersReceived: state.offersReceived,
    offersSent: state.offersSent,
    loans: state.loans,
    search: {
      total: results.length,
      results: results.sort((a, b) => b.strength - a.strength).slice(0, 40),
    },
  };
}

export function demoListPlayer(
  state: DemoManagement,
  players: readonly PlayerView[],
  input: ListingInput,
): void {
  const player = players.find((item) => item.id === input.playerId);
  if (!player) throw new Error('Jogador não encontrado.');
  const base = {
    playerId: player.id,
    playerName: player.name,
    position: player.primaryPosition,
    strength: player.strength,
    value: player.strength * 180_000,
    listedOn: state.currentDate,
  };
  state.listings = [
    ...state.listings.filter((item) => item.playerId !== player.id),
    input.mode === 'sale'
      ? { ...base, mode: 'sale', askingPrice: input.askingPrice }
      : {
          ...base,
          mode: 'loan',
          durationMonths: input.durationMonths,
          wageSharePercentage: input.wageSharePercentage,
        },
  ];
}

export function demoWithdrawListing(state: DemoManagement, playerId: string) {
  state.listings = state.listings.filter((item) => item.playerId !== playerId);
}

/** Result of a market move that changes the squad. */
export interface SquadChange {
  readonly add?: PlayerView;
  readonly removeId?: string;
}

function recruit(
  result: MarketResultView,
  role: PlayerView['role'],
): PlayerView {
  return {
    id: result.id,
    name: result.name,
    shirt: 0,
    age: result.age,
    nationality: result.country ?? 'Brasil',
    primaryPosition: result.position,
    secondaryPositions: [],
    side: 'centro',
    strength: result.strength,
    traits: [],
    condition: 85,
    morale: 75,
    sharpness: 70,
    role,
    injuryRounds: 0,
    suspended: false,
    yellowCards: 0,
    redCards: 0,
    goals: 0,
    appearances: 0,
    lastRating: null,
    scoutingEstimates: {
      potential:
        result.age <= 23 ? 'alto' : result.age <= 29 ? 'bom' : 'limitado',
      consistency: 'estável',
      injuryProneness: 'moderada',
      adaptation: 'em adaptação',
      professionalism: 'adequado',
      bigMatches: 'a observar',
    },
  };
}

/** Seller AI (ADR 0008 §4): accepts at the asking price, counters at 75%. */
export function demoSubmitOffer(
  state: DemoManagement,
  players: readonly PlayerView[],
  input: MarketOfferInput,
): SquadChange {
  const target = state.catalog.find((item) => item.id === input.playerId);
  if (!target) throw new Error('Atleta indisponível.');
  if (!target.freeAgent) requireWindow(state);
  if (players.length >= DEMO_MAX_SQUAD) refuse('SQUAD_LIMIT_REACHED', state);
  if (input.fee > state.cash)
    throw new ManagementError(
      'Caixa insuficiente para essa proposta.',
      'INSUFFICIENT_FUNDS',
    );
  const asking = target.freeAgent
    ? 0
    : Math.round(
        target.value * (target.age <= 23 ? 1.15 : target.age >= 34 ? 0.75 : 1),
      );
  const id = nextId(state, 'offer_out');
  const base: MarketOfferView = {
    id,
    kind: input.kind,
    playerId: target.id,
    playerName: target.name,
    ...(target.clubName ? { counterpartClubName: target.clubName } : {}),
    fee: input.fee,
    wage: input.wage,
    ...(input.loan ? { loan: input.loan } : {}),
    status: 'pending',
    createdOn: state.currentDate,
    expiresOn: addDays(state.currentDate, 7),
    awaiting: 'counterpart',
  };
  const loanAsk = Math.round(target.value * 0.08);
  const accepted =
    input.kind === 'loan'
      ? (input.loan?.wageSharePercentage ?? 0) >= 50 || input.fee >= loanAsk
      : input.fee >= asking;
  if (accepted) {
    state.offersSent = [
      { ...base, status: 'accepted', awaiting: 'none' },
      ...state.offersSent,
    ];
    state.cash -= input.fee;
    state.ledger.transferOut += input.fee;
    state.catalog = state.catalog.filter((item) => item.id !== target.id);
    if (input.kind === 'loan')
      state.loans = [
        ...state.loans,
        {
          playerId: target.id,
          playerName: target.name,
          direction: 'in',
          counterpartClubName: target.clubName ?? 'Sem clube',
          startsOn: state.currentDate,
          endsOn:
            input.loan?.endsOn ?? `${state.currentDate.slice(0, 4)}-12-31`,
        },
      ];
    return { add: recruit(target, 'reserve') };
  }
  const counterFee = input.kind === 'loan' ? loanAsk : asking;
  if (input.fee >= counterFee * 0.75) {
    const counter: MarketOfferView = {
      ...base,
      id: nextId(state, 'offer_counter'),
      fee: counterFee,
      status: 'pending',
      awaiting: 'manager',
      counterOf: id,
    };
    state.offersSent = [
      counter,
      { ...base, status: 'countered', awaiting: 'none' },
      ...state.offersSent,
    ];
    return {};
  }
  state.offersSent = [
    { ...base, status: 'rejected', awaiting: 'none' },
    ...state.offersSent,
  ];
  return {};
}

export function demoDecideOffer(
  state: DemoManagement,
  players: readonly PlayerView[],
  offerId: string,
  decision: 'accept' | 'reject',
): SquadChange {
  const received = state.offersReceived.find((item) => item.id === offerId);
  const sent = state.offersSent.find((item) => item.id === offerId);
  const offer = received ?? sent;
  if (!offer || offer.awaiting !== 'manager')
    throw new Error('Não há proposta aguardando sua decisão.');
  const settle = (status: MarketOfferView['status']) => {
    const update = (item: MarketOfferView) =>
      item.id === offerId
        ? { ...item, status, awaiting: 'none' as const }
        : item;
    state.offersReceived = state.offersReceived.map(update);
    state.offersSent = state.offersSent.map(update);
  };
  if (decision === 'reject') {
    settle('rejected');
    return {};
  }
  requireWindow(state);
  if (received) {
    settle('accepted');
    state.cash += offer.fee;
    state.ledger.transferIn += offer.fee;
    return { removeId: offer.playerId };
  }
  if (players.length >= DEMO_MAX_SQUAD) refuse('SQUAD_LIMIT_REACHED', state);
  const target = state.catalog.find((item) => item.id === offer.playerId);
  if (!target) throw new Error('Atleta indisponível.');
  settle('accepted');
  state.cash -= offer.fee;
  state.ledger.transferOut += offer.fee;
  state.catalog = state.catalog.filter((item) => item.id !== target.id);
  return { add: recruit(target, 'reserve') };
}

/** Buyer AI answers a counter at once: up to 20% above its own bid. */
export function demoCounterOffer(
  state: DemoManagement,
  offerId: string,
  terms: { fee: number; wage: number },
): SquadChange {
  const offer = state.offersReceived.find((item) => item.id === offerId);
  if (!offer || offer.awaiting !== 'manager')
    throw new Error(
      'Só é possível contrapropor uma proposta recebida pendente.',
    );
  requireWindow(state);
  const accepted = terms.fee <= Math.round(offer.fee * 1.2);
  const counter: MarketOfferView = {
    ...offer,
    id: nextId(state, 'offer_counter'),
    fee: terms.fee,
    wage: terms.wage,
    counterOf: offer.id,
    status: accepted ? 'accepted' : 'rejected',
    awaiting: 'none',
  };
  state.offersReceived = [
    counter,
    ...state.offersReceived.map((item) =>
      item.id === offerId
        ? { ...item, status: 'countered' as const, awaiting: 'none' as const }
        : item,
    ),
  ];
  if (!accepted) return {};
  state.cash += terms.fee;
  state.ledger.transferIn += terms.fee;
  return { removeId: offer.playerId };
}

// --- office -----------------------------------------------------------------
const TIERS: readonly {
  tier: MembershipTier;
  costPerMember: number;
  appeal: number;
  perception: number;
}[] = [
  { tier: 'basic', costPerMember: 2, appeal: 0.85, perception: 0.75 },
  { tier: 'intermediate', costPerMember: 6, appeal: 1, perception: 1 },
  { tier: 'premium', costPerMember: 14, appeal: 1.15, perception: 1.25 },
];

export function demoMembership(settings: {
  monthlyPrice: number;
  tier: MembershipTier;
}): MembershipView {
  const reference = 10 + 0.4 * REPUTATION;
  const base = 150 * Math.max(1, REPUTATION - 35) ** 1.5;
  const tier = TIERS.find((item) => item.tier === settings.tier) ?? TIERS[1]!;
  const demand = Math.min(
    1.3,
    Math.max(0.05, 1.6 - 0.6 * (settings.monthlyPrice / reference)),
  );
  const members = Math.floor(
    base *
      demand *
      tier.appeal *
      (0.6 + 0.8 * (FAN_CONFIDENCE / 100)) *
      (0.85 + 0.1 * POINTS_PER_GAME),
  );
  const potential = Math.floor(
    base *
      (0.6 + 0.8 * (FAN_CONFIDENCE / 100)) *
      (0.85 + 0.1 * POINTS_PER_GAME),
  );
  return {
    monthlyPrice: settings.monthlyPrice,
    tier: settings.tier,
    priceRange: { min: 5, max: 200 },
    referencePrice: Math.round(reference),
    tiers: TIERS.map(({ tier: id, costPerMember, appeal }) => ({
      tier: id,
      costPerMember,
      appeal,
    })),
    members,
    potential,
    monthlyRevenue: members * settings.monthlyPrice,
    monthlyCost: members * tier.costPerMember,
    attendanceBonus: Math.min(
      Math.round(78_838 * 0.05),
      Math.round(members * 0.1),
    ),
    fanConfidenceEffect: Math.max(
      -3,
      Math.min(
        3,
        Math.round(5 * (tier.perception - settings.monthlyPrice / reference)),
      ),
    ),
  };
}

function finances(
  state: DemoManagement,
  membership: MembershipView,
  scale: number,
): FinanceCategories {
  const income = {
    gate: Math.round(1_840_000 * scale),
    sponsor: Math.round(
      (state.sponsorContract?.monthlyValue ?? 1_400_000) * scale,
    ),
    membership: Math.round(membership.monthlyRevenue * scale),
    prize: Math.round(1_200_000 * scale),
    transfer: Math.round(state.ledger.transferIn + (scale > 1 ? 5_800_000 : 0)),
  };
  const expenses = {
    wages: Math.round(920_000 * scale),
    transfer: state.ledger.transferOut,
    stadium: Math.round(310_000 * scale),
    membership: Math.round(membership.monthlyCost * scale),
    sponsor: 0,
  };
  const totalIncome = Object.values(income).reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalExpenses = Object.values(expenses).reduce(
    (sum, value) => sum + value,
    0,
  );
  return {
    income,
    expenses,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
  };
}

export function demoChemistry(
  state: DemoManagement,
  starters: readonly string[],
): ChemistryView {
  const changed = starters.filter(
    (id) => !state.lastEleven.includes(id),
  ).length;
  return {
    value: state.chemistry,
    bonusPercent: Math.round(0.03 * state.chemistry) / 10,
    matches: state.matches,
    startersChanged: changed,
  };
}

export function demoOfficeView(
  state: DemoManagement,
  career: {
    coach: string;
    club: string;
    players: readonly PlayerView[];
    contracts: readonly {
      playerId: string;
      playerName: string;
      monthsRemaining: number;
      salary: number;
    }[];
    jobs: readonly { id: string; club: string }[];
    board: { confidence: number; fanConfidence: number };
    prestige: {
      points: number;
      seasons: number;
      titles: number;
      promotions: number;
    };
  },
): OfficeView {
  const membership = demoMembership(state.membership);
  const previousMonth = addDays(
    `${state.currentDate.slice(0, 7)}-01`,
    -1,
  ).slice(0, 7);
  const starters = career.players
    .filter((player) => player.role === 'starter')
    .map((p) => p.id);
  return {
    currentDate: state.currentDate,
    season: state.season,
    club: {
      id: `club_${slug(career.club)}`,
      name: career.club,
      division: 'serie-a',
      cash: state.cash,
      monthlyWageBill: 920_000,
    },
    proposals: {
      sponsorship: state.sponsorOffers,
      jobs: career.jobs.map((job) => ({
        id: job.id,
        clubName: job.club,
        expiresOn: addDays(state.currentDate, 20),
        minimumPrestige: 1200,
        status: 'open',
      })),
      transfers: state.offersReceived
        .filter((offer) => offer.awaiting === 'manager')
        .map((offer) => ({
          id: offer.id,
          kind: offer.kind,
          playerId: offer.playerId,
          playerName: offer.playerName,
          ...(offer.counterpartClubName
            ? { counterpartClubName: offer.counterpartClubName }
            : {}),
          fee: offer.fee,
          wage: offer.wage,
          expiresOn: offer.expiresOn,
        })),
    },
    sponsorship: {
      ...(state.sponsorContract ? { contract: state.sponsorContract } : {}),
      fallbackMonthly: 1_400_000,
      history: state.sponsorHistory,
    },
    membership,
    finances: {
      month: { period: previousMonth, ...finances(state, membership, 1) },
      season: { year: state.season, ...finances(state, membership, 7) },
      pendingGate: 1_120_000,
    },
    contracts: career.contracts.map((contract) => ({
      contractId: `contract_${contract.playerId}`,
      playerId: contract.playerId,
      playerName: contract.playerName,
      endsOn: addDays(
        state.currentDate,
        Math.round(contract.monthsRemaining * 30.4),
      ),
      wage: contract.salary,
      status: contract.monthsRemaining <= 6 ? 'expiring' : 'active',
    })),
    coach: {
      managerName: career.coach,
      employmentStatus: 'employed',
      boardConfidence: career.board.confidence,
      fanConfidence: career.board.fanConfidence,
      prestige: career.prestige.points,
      seasons: career.prestige.seasons,
      appointments: [
        {
          clubName: career.club,
          joinedOn: `${String(state.season - career.prestige.seasons)}-01-01`,
        },
      ],
      achievements: [
        { type: 'league_title', count: career.prestige.titles },
        { type: 'season_completed', count: career.prestige.seasons },
      ].filter((item) => item.count > 0),
    },
    chemistry: demoChemistry(state, starters),
  };
}

export function demoDecideSponsorship(
  state: DemoManagement,
  offerId: string,
  decision: 'accept' | 'reject',
) {
  const offer = state.sponsorOffers.find((item) => item.id === offerId);
  if (!offer || offer.status !== 'pending')
    throw new Error('Essa proposta de patrocínio já foi encerrada.');
  if (decision === 'reject') {
    state.sponsorOffers = state.sponsorOffers.map((item) =>
      item.id === offerId ? { ...item, status: 'rejected' } : item,
    );
    return;
  }
  signSponsor(state, offer, offer.monthlyValue);
}

function signSponsor(
  state: DemoManagement,
  offer: SponsorOfferView,
  monthlyValue: number,
) {
  if (state.sponsorContract) {
    state.cash -= state.sponsorContract.terminationFee;
    state.sponsorHistory = [
      { ...state.sponsorContract, status: 'terminated' },
      ...state.sponsorHistory,
    ];
  }
  const start = state.currentDate.slice(0, 7);
  const [year, month] = start.split('-').map(Number) as [number, number];
  const endIndex = year * 12 + (month - 1) + offer.durationMonths - 1;
  state.sponsorContract = {
    id: `contract_${offer.id}`,
    sponsorName: offer.sponsorName,
    monthlyValue,
    startMonth: start,
    endMonth: `${String(Math.floor(endIndex / 12))}-${String((endIndex % 12) + 1).padStart(2, '0')}`,
    monthsRemaining: offer.durationMonths,
    bonuses: offer.bonuses,
    terminationFee: offer.terminationFee,
    status: 'active',
  };
  state.sponsorOffers = state.sponsorOffers.map((item) =>
    item.id === offer.id
      ? { ...item, status: 'accepted', monthlyValue }
      : item.status === 'pending'
        ? { ...item, status: 'superseded' }
        : item,
  );
}

/** One counter per proposal; the sponsor takes up to 10% more (ADR 0011 §3). */
export function demoCounterSponsorship(
  state: DemoManagement,
  offerId: string,
  monthlyValue: number,
) {
  const offer = state.sponsorOffers.find((item) => item.id === offerId);
  if (!offer || offer.status !== 'pending')
    throw new Error('Essa proposta de patrocínio já foi encerrada.');
  if (offer.counter)
    throw new Error('Você já fez uma contraproposta a esse patrocinador.');
  if (
    !offer.counterRange ||
    monthlyValue < offer.counterRange.min ||
    monthlyValue > offer.counterRange.max
  )
    throw new Error(
      'A contraproposta precisa ficar acima da oferta e até 1,5 vez o valor.',
    );
  const accepted = monthlyValue <= Math.round(offer.monthlyValue * 1.1);
  if (accepted) {
    signSponsor(
      state,
      { ...offer, counter: { monthlyValue, outcome: 'accepted' } },
      monthlyValue,
    );
    state.sponsorOffers = state.sponsorOffers.map((item) =>
      item.id === offerId
        ? { ...item, counter: { monthlyValue, outcome: 'accepted' } }
        : item,
    );
    return;
  }
  state.sponsorOffers = state.sponsorOffers.map((item) =>
    item.id === offerId
      ? {
          ...item,
          status: 'withdrawn',
          counter: { monthlyValue, outcome: 'rejected' },
        }
      : item,
  );
}

export function demoConfigureMembership(
  state: DemoManagement,
  input: { monthlyPrice: number; tier: MembershipTier },
) {
  if (input.monthlyPrice < 5 || input.monthlyPrice > 200)
    throw new Error(
      'O preço do sócio-torcedor fica entre R$ 5 e R$ 200 por mês.',
    );
  state.membership = { ...input };
}
