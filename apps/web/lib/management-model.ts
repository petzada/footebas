import type {
  Formation,
  PlayerView,
  SquadRole,
  TacticsView,
} from '@/lib/career-api';

/**
 * Pure model behind the management screens (Elenco, Mercado, Escritório of
 * docs/09): formation layouts, the lineup board and its moves, validation,
 * tactic presets, saved lineups and the client views of market and office.
 * Money is in whole reais on the client; adapters convert minor units.
 */

// --- formations -----------------------------------------------------------
/** Client position codes (Portuguese) in the order the server slots use. */
export type PositionCode =
  'GOL' | 'LD' | 'ZAG' | 'LE' | 'VOL' | 'MC' | 'MEI' | 'PD' | 'PE' | 'ATA';

export interface FormationSlot {
  readonly position: PositionCode;
  /** Percent of the pitch width, left to right (attacking upwards). */
  readonly x: number;
  /** Percent of the pitch height, 0 = opponent goal, 100 = own goal. */
  readonly y: number;
}

/** Formations the server accepts (`formationSchema`); 5-3-2 is client-only. */
export type ServerFormation = Exclude<Formation, '5-3-2'>;
export const SERVER_FORMATIONS: readonly ServerFormation[] = [
  '4-4-2',
  '4-3-3',
  '3-5-2',
];

export const FORMATION_LAYOUT: Readonly<
  Record<ServerFormation, readonly FormationSlot[]>
> = {
  '4-4-2': [
    { position: 'GOL', x: 50, y: 91 },
    { position: 'LD', x: 84, y: 72 },
    { position: 'ZAG', x: 63, y: 76 },
    { position: 'ZAG', x: 37, y: 76 },
    { position: 'LE', x: 16, y: 72 },
    { position: 'MC', x: 62, y: 50 },
    { position: 'MC', x: 38, y: 50 },
    { position: 'PD', x: 86, y: 44 },
    { position: 'PE', x: 14, y: 44 },
    { position: 'ATA', x: 38, y: 18 },
    { position: 'ATA', x: 62, y: 18 },
  ],
  '4-3-3': [
    { position: 'GOL', x: 50, y: 91 },
    { position: 'LD', x: 84, y: 72 },
    { position: 'ZAG', x: 63, y: 76 },
    { position: 'ZAG', x: 37, y: 76 },
    { position: 'LE', x: 16, y: 72 },
    { position: 'VOL', x: 50, y: 58 },
    { position: 'MC', x: 30, y: 46 },
    { position: 'MEI', x: 70, y: 44 },
    { position: 'PD', x: 82, y: 22 },
    { position: 'PE', x: 18, y: 22 },
    { position: 'ATA', x: 50, y: 14 },
  ],
  '3-5-2': [
    { position: 'GOL', x: 50, y: 91 },
    { position: 'ZAG', x: 72, y: 75 },
    { position: 'ZAG', x: 50, y: 78 },
    { position: 'ZAG', x: 28, y: 75 },
    { position: 'LD', x: 88, y: 50 },
    { position: 'LE', x: 12, y: 50 },
    { position: 'VOL', x: 50, y: 58 },
    { position: 'MC', x: 32, y: 44 },
    { position: 'MEI', x: 68, y: 42 },
    { position: 'ATA', x: 38, y: 16 },
    { position: 'ATA', x: 62, y: 16 },
  ],
};

export function isServerFormation(value: Formation): value is ServerFormation {
  return value !== '5-3-2';
}

export const POSITION_NAME: Readonly<Record<PositionCode, string>> = {
  GOL: 'Goleiro',
  LD: 'Lateral direito',
  ZAG: 'Zagueiro',
  LE: 'Lateral esquerdo',
  VOL: 'Volante',
  MC: 'Meio-campo',
  MEI: 'Meia',
  PD: 'Ponta direita',
  PE: 'Ponta esquerda',
  ATA: 'Atacante',
};

/** How well a player fits a slot: 2 natural, 1 secondary, 0 out of place. */
export function positionFit(player: PlayerView, position: string): 0 | 1 | 2 {
  if (player.primaryPosition === position) return 2;
  if (player.secondaryPositions.includes(position)) return 1;
  return 0;
}

export const MAX_BENCH = 7;

// --- lineup board ---------------------------------------------------------
export interface LineupBoard {
  readonly formation: ServerFormation;
  /** One entry per formation slot; `null` while the slot is empty. */
  readonly slots: readonly (string | null)[];
  readonly bench: readonly string[];
  readonly reserves: readonly string[];
}

export type BoardTarget =
  | { readonly kind: 'slot'; readonly index: number }
  | { readonly kind: 'bench' }
  | { readonly kind: 'reserves' };

/** Where a player sits on the board. */
export function locate(board: LineupBoard, playerId: string): BoardTarget {
  const index = board.slots.indexOf(playerId);
  if (index >= 0) return { kind: 'slot', index };
  if (board.bench.includes(playerId)) return { kind: 'bench' };
  return { kind: 'reserves' };
}

/**
 * Builds the board from the squad roles: starters fill the formation slots
 * by best fit (natural position, then secondary, then anything left), so
 * the same eleven always lands on the same slots.
 */
export function buildBoard(
  players: readonly PlayerView[],
  formation: Formation,
): LineupBoard {
  const target: ServerFormation = isServerFormation(formation)
    ? formation
    : '4-4-2';
  const layout = FORMATION_LAYOUT[target];
  const starters = players.filter((player) => player.role === 'starter');
  const pending = [...starters];
  const slots: (string | null)[] = layout.map(() => null);
  const explicit = pending.filter((player) => player.lineupPosition);
  // Pass 0: positions the server/adapter already assigned.
  for (const player of explicit) {
    const index = layout.findIndex(
      (slot, at) => slot.position === player.lineupPosition && !slots[at],
    );
    if (index >= 0) {
      slots[index] = player.id;
      pending.splice(pending.indexOf(player), 1);
    }
  }
  for (const fit of [2, 1] as const) {
    layout.forEach((slot, index) => {
      if (slots[index]) return;
      const at = pending.findIndex(
        (player) => positionFit(player, slot.position) === fit,
      );
      if (at >= 0) slots[index] = pending.splice(at, 1)[0]!.id;
    });
  }
  layout.forEach((_, index) => {
    if (!slots[index] && pending.length) slots[index] = pending.shift()!.id;
  });
  const placed = new Set(slots.filter(Boolean));
  return {
    formation: target,
    slots,
    bench: [
      ...players
        .filter((player) => player.role === 'bench')
        .map((player) => player.id),
      ...pending.map((player) => player.id),
    ].filter((id) => !placed.has(id)),
    reserves: players
      .filter((player) => player.role === 'reserve')
      .map((player) => player.id),
  };
}

/** Changes the formation keeping the eleven, re-fitting them to the slots. */
export function reformBoard(
  board: LineupBoard,
  players: readonly PlayerView[],
  formation: ServerFormation,
): LineupBoard {
  if (formation === board.formation) return board;
  const starters = new Set(board.slots.filter(Boolean));
  const bench = new Set(board.bench);
  const roled = players.map((player): PlayerView => ({
    ...player,
    role: starters.has(player.id)
      ? 'starter'
      : bench.has(player.id)
        ? 'bench'
        : 'reserve',
    lineupPosition: undefined,
  }));
  return buildBoard(roled, formation);
}

const without = (list: readonly string[], id: string) =>
  list.filter((item) => item !== id);

/**
 * Moves a player to a target with swap semantics: dropping on an occupied
 * slot sends its occupant to where the mover came from; dropping on the
 * bench or reserves just relocates. Used by drag and keyboard alike, so both
 * paths produce the same board.
 */
export function placePlayer(
  board: LineupBoard,
  playerId: string,
  target: BoardTarget,
): LineupBoard {
  const origin = locate(board, playerId);
  const slots = [...board.slots];
  let bench = without(board.bench, playerId);
  let reserves = without(board.reserves, playerId);
  const originIndex = origin.kind === 'slot' ? origin.index : -1;
  if (originIndex >= 0) slots[originIndex] = null;

  if (target.kind === 'slot') {
    const occupant = slots[target.index] ?? null;
    slots[target.index] = playerId;
    if (occupant && occupant !== playerId) {
      if (originIndex >= 0) slots[originIndex] = occupant;
      else if (origin.kind === 'bench') bench = [...bench, occupant];
      else reserves = [...reserves, occupant];
    }
  } else if (target.kind === 'bench') {
    bench = [...bench, playerId];
  } else {
    reserves = [...reserves, playerId];
  }
  return { ...board, slots, bench, reserves };
}

/** Role of each player implied by the board. */
export function boardRoles(board: LineupBoard): Map<string, SquadRole> {
  const roles = new Map<string, SquadRole>();
  for (const id of board.slots) if (id) roles.set(id, 'starter');
  for (const id of board.bench) roles.set(id, 'bench');
  for (const id of board.reserves) roles.set(id, 'reserve');
  return roles;
}

/** Problems that stop the lineup from being sent, in Portuguese. */
export function validateBoard(
  board: LineupBoard,
  players: readonly PlayerView[],
): string[] {
  const byId = new Map(players.map((player) => [player.id, player]));
  const problems: string[] = [];
  const filled = board.slots.filter(Boolean).length;
  if (filled < 11)
    problems.push(
      `Faltam ${String(11 - filled)} titular(es): a escalação precisa de 11.`,
    );
  const layout = FORMATION_LAYOUT[board.formation];
  board.slots.forEach((id, index) => {
    if (!id) return;
    const player = byId.get(id);
    if (!player) return;
    if (player.injuryRounds > 0)
      problems.push(`${player.name} está lesionado e não pode ser titular.`);
    else if (player.suspended)
      problems.push(`${player.name} está suspenso e não pode ser titular.`);
    const slot = layout[index]!;
    if (slot.position === 'GOL' && player.primaryPosition !== 'GOL')
      problems.push(`${player.name} não é goleiro: o gol precisa de um.`);
    if (slot.position !== 'GOL' && player.primaryPosition === 'GOL')
      problems.push(`${player.name} é goleiro e está na linha.`);
  });
  if (board.bench.length > MAX_BENCH)
    problems.push(`O banco aceita no máximo ${String(MAX_BENCH)} jogadores.`);
  return problems;
}

/** Payload of `SetLineup` as the port takes it (positions are client codes). */
export interface LineupInput {
  readonly formation: ServerFormation;
  readonly starters: readonly { playerId: string; position: PositionCode }[];
  readonly bench: readonly string[];
  readonly reserves: readonly string[];
  readonly captainId: string;
}

export function lineupInput(
  board: LineupBoard,
  players: readonly PlayerView[],
  captainId?: string,
): LineupInput {
  const layout = FORMATION_LAYOUT[board.formation];
  const starters = board.slots.flatMap((id, index) =>
    id ? [{ playerId: id, position: layout[index]!.position }] : [],
  );
  const byId = new Map(players.map((player) => [player.id, player]));
  const captain =
    captainId && starters.some((slot) => slot.playerId === captainId)
      ? captainId
      : [...starters]
          .map((slot) => byId.get(slot.playerId))
          .filter((player): player is PlayerView => Boolean(player))
          .sort((a, b) => b.strength - a.strength)[0]?.id;
  return {
    formation: board.formation,
    starters,
    bench: board.bench,
    reserves: board.reserves,
    captainId: captain ?? starters[0]?.playerId ?? '',
  };
}

/** Average strength of the eleven weighted by how well each fits its slot. */
export function boardStrength(
  board: LineupBoard,
  players: readonly PlayerView[],
): number {
  const byId = new Map(players.map((player) => [player.id, player]));
  const layout = FORMATION_LAYOUT[board.formation];
  const values = board.slots.flatMap((id, index) => {
    const player = id ? byId.get(id) : undefined;
    if (!player) return [];
    const fit = positionFit(player, layout[index]!.position);
    return [player.strength * (fit === 2 ? 1 : fit === 1 ? 0.92 : 0.8)];
  });
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / 11);
}

// --- tactics --------------------------------------------------------------
export interface TacticPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly formation: ServerFormation;
  readonly tactics: TacticsView;
}

export const TACTIC_PRESETS: readonly TacticPreset[] = [
  {
    id: 'equilibrio',
    name: 'Equilíbrio',
    description: 'Padrão de casa: posse mista e marcação forte.',
    formation: '4-4-2',
    tactics: {
      mentality: 'balanced',
      buildUp: 'mixed',
      focus: 'middle',
      press: 'medium',
      defensiveLine: 'standard',
      marking: 'strong',
    },
  },
  {
    id: 'pressao-alta',
    name: 'Pressão alta',
    description: 'Linha alta, saída curta e pressão no campo rival.',
    formation: '4-3-3',
    tactics: {
      mentality: 'attacking',
      buildUp: 'short',
      focus: 'wings',
      press: 'high',
      defensiveLine: 'high',
      marking: 'strong',
    },
  },
  {
    id: 'contra-ataque',
    name: 'Contra-ataque',
    description: 'Bloco baixo, bola longa e velocidade pelos lados.',
    formation: '4-4-2',
    tactics: {
      mentality: 'cautious',
      buildUp: 'direct',
      focus: 'wings',
      press: 'low',
      defensiveLine: 'deep',
      marking: 'very-strong',
    },
  },
  {
    id: 'ferrolho',
    name: 'Ferrolho',
    description: 'Três zagueiros, alas recuados e marcação muito forte.',
    formation: '3-5-2',
    tactics: {
      mentality: 'cautious',
      buildUp: 'mixed',
      focus: 'middle',
      press: 'low',
      defensiveLine: 'deep',
      marking: 'very-strong',
    },
  },
];

export const TACTIC_LABEL = {
  mentality: {
    cautious: 'Cautela',
    balanced: 'Equilibrada',
    attacking: 'Ofensiva',
  },
  buildUp: { short: 'Curta', mixed: 'Mista', direct: 'Direta' },
  focus: { middle: 'Meio', wings: 'Laterais' },
  press: { low: 'Baixa', medium: 'Média', high: 'Alta' },
  defensiveLine: { deep: 'Recuada', standard: 'Normal', high: 'Alta' },
  marking: { light: 'Leve', strong: 'Forte', 'very-strong': 'Muito forte' },
} as const;

// --- saved lineups (client side, per career) ------------------------------
/**
 * The server has no saved-lineup resource yet, so up to three named lineups
 * per career live in the browser (localStorage). They hold ids, formation and
 * tactics; applying one re-validates against the current squad.
 */
export interface SavedLineup {
  readonly name: string;
  readonly board: LineupBoard;
  readonly tactics: TacticsView;
  readonly savedAt: string;
}

export const MAX_SAVED_LINEUPS = 3;
const LINEUPS_KEY = 'footebas:lineups:';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function storageOf(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSavedLineups(
  careerId: string,
  storage?: StorageLike,
): SavedLineup[] {
  const store = storageOf(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(`${LINEUPS_KEY}${careerId}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? (parsed as SavedLineup[]).slice(0, MAX_SAVED_LINEUPS)
      : [];
  } catch {
    return [];
  }
}

export function storeSavedLineups(
  careerId: string,
  lineups: readonly SavedLineup[],
  storage?: StorageLike,
): void {
  const store = storageOf(storage);
  if (!store) return;
  try {
    store.setItem(
      `${LINEUPS_KEY}${careerId}`,
      JSON.stringify(lineups.slice(0, MAX_SAVED_LINEUPS)),
    );
  } catch {
    // Private mode or quota: the lineups just are not remembered.
  }
}

/** Adds or replaces by name; refuses a fourth name. */
export function upsertSavedLineup(
  lineups: readonly SavedLineup[],
  lineup: SavedLineup,
): SavedLineup[] {
  const name = lineup.name.trim();
  const others = lineups.filter(
    (item) => item.name.toLowerCase() !== name.toLowerCase(),
  );
  if (others.length >= MAX_SAVED_LINEUPS)
    throw new Error(
      `Você já tem ${String(MAX_SAVED_LINEUPS)} escalações salvas. Substitua uma pelo mesmo nome ou apague.`,
    );
  return [...others, { ...lineup, name }];
}

/** A saved board only applies while every id still belongs to the squad. */
export function applySavedLineup(
  lineup: SavedLineup,
  players: readonly PlayerView[],
): LineupBoard {
  const ids = new Set(players.map((player) => player.id));
  const slots = lineup.board.slots.map((id) => (id && ids.has(id) ? id : null));
  const kept = new Set(slots.filter(Boolean));
  const bench = lineup.board.bench.filter((id) => ids.has(id) && !kept.has(id));
  for (const id of bench) kept.add(id);
  const reserves = players
    .map((player) => player.id)
    .filter((id) => !kept.has(id));
  return { formation: lineup.board.formation, slots, bench, reserves };
}

// --- chemistry ------------------------------------------------------------
export interface ChemistryView {
  readonly value: number;
  readonly bonusPercent: number;
  readonly matches: number;
  readonly startersChanged: number;
}

export function chemistryLabel(value: number): string {
  return value >= 80
    ? 'Time entrosado'
    : value >= 60
      ? 'Bom entrosamento'
      : value >= 40
        ? 'Em construção'
        : 'Time novo';
}

// --- market ---------------------------------------------------------------
export type MarketOrigin = 'all' | 'national' | 'foreign';

export interface MarketQuery {
  readonly text?: string | undefined;
  readonly position?: PositionCode | undefined;
  readonly minStrength?: number | undefined;
  readonly maxAge?: number | undefined;
  /** Whole reais. */
  readonly maxValue?: number | undefined;
  readonly origin?: MarketOrigin | undefined;
  readonly freeAgentsOnly?: boolean | undefined;
}

export interface TransferWindowView {
  readonly status: 'open' | 'closed';
  readonly name?: string;
  readonly closesOn?: string;
  readonly daysRemaining?: number;
  readonly nextName: string;
  readonly nextOpensOn: string;
  readonly daysUntilNext: number;
}

export interface MarketResultView {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly position: string;
  readonly strength: number;
  readonly value: number;
  readonly wage: number;
  readonly clubId?: string;
  readonly clubName?: string;
  readonly origin: 'national' | 'state' | 'foreign';
  readonly country?: string;
  readonly freeAgent: boolean;
  readonly listed: boolean;
}

export interface MarketOfferView {
  readonly id: string;
  readonly kind: 'buy' | 'loan';
  readonly playerId: string;
  readonly playerName: string;
  readonly counterpartClubName?: string;
  readonly fee: number;
  readonly wage: number;
  readonly loan?: { endsOn: string; wageSharePercentage: number };
  readonly status:
    'pending' | 'countered' | 'accepted' | 'rejected' | 'cancelled';
  readonly createdOn: string;
  readonly expiresOn: string;
  readonly awaiting: 'manager' | 'counterpart' | 'none';
  readonly counterOf?: string;
}

export type MarketListingView =
  | {
      readonly mode: 'sale';
      readonly playerId: string;
      readonly playerName: string;
      readonly position: string;
      readonly strength: number;
      readonly value: number;
      readonly askingPrice: number;
      readonly listedOn: string;
    }
  | {
      readonly mode: 'loan';
      readonly playerId: string;
      readonly playerName: string;
      readonly position: string;
      readonly strength: number;
      readonly value: number;
      readonly durationMonths: number;
      readonly wageSharePercentage: number;
      readonly listedOn: string;
    };

export interface MarketLoanView {
  readonly playerId: string;
  readonly playerName: string;
  readonly direction: 'out' | 'in';
  readonly counterpartClubName: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface MarketView {
  readonly currentDate: string;
  readonly club?: {
    readonly id: string;
    readonly name: string;
    readonly cash: number;
    readonly squadSize: number;
    readonly maxSquadSize: number;
    readonly monthlyWageBill: number;
  };
  readonly window: TransferWindowView;
  readonly listings: readonly MarketListingView[];
  readonly offersReceived: readonly MarketOfferView[];
  readonly offersSent: readonly MarketOfferView[];
  readonly loans: readonly MarketLoanView[];
  readonly search: {
    readonly total: number;
    readonly results: readonly MarketResultView[];
  };
}

export type ListingInput =
  | {
      readonly playerId: string;
      readonly mode: 'sale';
      readonly askingPrice: number;
    }
  | {
      readonly playerId: string;
      readonly mode: 'loan';
      readonly durationMonths: number;
      readonly wageSharePercentage: number;
    };

export interface MarketOfferInput {
  readonly playerId: string;
  readonly kind: 'buy' | 'loan';
  /** Whole reais. */
  readonly fee: number;
  readonly wage: number;
  readonly loan?: { endsOn: string; wageSharePercentage: number };
}

/** Error with the server refusal code, so screens can word it. */
export class ManagementError extends Error {
  public constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ManagementError';
  }
}

export function marketRefusalMessage(
  code: string,
  window?: TransferWindowView,
): string | undefined {
  if (code === 'TRANSFER_WINDOW_CLOSED')
    return window
      ? `A janela de transferências está fechada. A ${window.nextName.toLowerCase()} abre em ${formatDate(window.nextOpensOn)} (${String(window.daysUntilNext)} dias).`
      : 'A janela de transferências está fechada. Negociações entre clubes só na próxima janela.';
  if (code === 'SQUAD_LIMIT_REACHED')
    return 'Elenco cheio: o clube já tem o máximo de atletas. Venda ou empreste alguém antes de contratar.';
  return undefined;
}

// --- transfer windows (ADR 0008, transfer-windows-v1) ---------------------
const WINDOWS = [
  { id: 'pre_season', name: 'Janela de pré-temporada', from: 0, to: 47 },
  { id: 'mid_season', name: 'Janela do meio do ano', from: 106, to: 127 },
] as const;

function dayOfYear(date: string): number {
  const [year, month, day] = date.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const start = Date.UTC(year, 0, 1);
  return Math.round((Date.UTC(year, month - 1, day) - start) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Window state for a career date, mirroring the server rules. */
export function transferWindowOn(date: string): TransferWindowView {
  const day = dayOfYear(date);
  const year = date.slice(0, 4);
  const startOfYear = `${year}-01-01`;
  const current = WINDOWS.find(({ from, to }) => day >= from && day <= to);
  const upcoming = WINDOWS.find(({ from }) => from > day);
  const next = upcoming
    ? { name: upcoming.name, opensOn: addDays(startOfYear, upcoming.from) }
    : {
        name: WINDOWS[0].name,
        opensOn: `${String(Number(year) + 1)}-01-01`,
      };
  const daysUntilNext = Math.max(
    1,
    Math.round(
      (Date.parse(`${next.opensOn}T00:00:00Z`) -
        Date.parse(`${date}T00:00:00Z`)) /
        86_400_000,
    ),
  );
  return current
    ? {
        status: 'open',
        name: current.name,
        closesOn: addDays(startOfYear, current.to),
        daysRemaining: current.to - day,
        nextName: next.name,
        nextOpensOn: next.opensOn,
        daysUntilNext,
      }
    : {
        status: 'closed',
        nextName: next.name,
        nextOpensOn: next.opensOn,
        daysUntilNext,
      };
}

// --- office ---------------------------------------------------------------
export type MembershipTier = 'basic' | 'intermediate' | 'premium';
export const MEMBERSHIP_TIER_LABEL: Readonly<Record<MembershipTier, string>> = {
  basic: 'Básico',
  intermediate: 'Intermediário',
  premium: 'Premium',
};

export interface SponsorOfferView {
  readonly id: string;
  readonly sponsorName: string;
  readonly monthlyValue: number;
  readonly durationMonths: number;
  readonly bonuses: { title: number; promotion: number; continental: number };
  readonly terminationFee: number;
  readonly status:
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'withdrawn'
    | 'expired'
    | 'superseded';
  readonly expiresOn: string;
  readonly counter?: { monthlyValue: number; outcome: 'accepted' | 'rejected' };
  readonly counterRange?: { min: number; max: number };
}

export interface SponsorContractView {
  readonly id: string;
  readonly sponsorName: string;
  readonly monthlyValue: number;
  readonly startMonth: string;
  readonly endMonth: string;
  readonly monthsRemaining: number;
  readonly bonuses: { title: number; promotion: number; continental: number };
  readonly terminationFee: number;
  readonly status: 'active' | 'ended' | 'terminated';
}

export interface MembershipView {
  readonly monthlyPrice: number;
  readonly tier: MembershipTier;
  readonly priceRange: { min: number; max: number };
  readonly referencePrice: number;
  readonly tiers: readonly {
    tier: MembershipTier;
    costPerMember: number;
    appeal: number;
  }[];
  readonly members: number;
  readonly potential: number;
  readonly monthlyRevenue: number;
  readonly monthlyCost: number;
  readonly attendanceBonus: number;
  readonly fanConfidenceEffect: number;
}

export interface FinanceCategories {
  readonly income: {
    gate: number;
    sponsor: number;
    membership: number;
    prize: number;
    transfer: number;
  };
  readonly expenses: {
    wages: number;
    transfer: number;
    stadium: number;
    membership: number;
    sponsor: number;
  };
  readonly totalIncome: number;
  readonly totalExpenses: number;
  readonly net: number;
}

export interface OfficeView {
  readonly currentDate: string;
  readonly season: number;
  readonly club?: {
    readonly id: string;
    readonly name: string;
    readonly division?: string;
    readonly cash: number;
    readonly monthlyWageBill: number;
  };
  readonly proposals: {
    readonly sponsorship: readonly SponsorOfferView[];
    readonly jobs: readonly {
      id: string;
      clubName: string;
      expiresOn: string;
      minimumPrestige: number;
      status: 'open' | 'accepted' | 'rejected' | 'expired';
    }[];
    readonly transfers: readonly {
      id: string;
      kind: 'buy' | 'loan';
      playerId: string;
      playerName: string;
      counterpartClubName?: string;
      fee: number;
      wage: number;
      expiresOn: string;
    }[];
  };
  readonly sponsorship: {
    readonly contract?: SponsorContractView;
    readonly fallbackMonthly: number;
    readonly history: readonly SponsorContractView[];
  };
  readonly membership?: MembershipView;
  readonly finances: {
    readonly month: FinanceCategories & { period: string };
    readonly season: FinanceCategories & { year: number };
    readonly pendingGate: number;
  };
  readonly contracts: readonly {
    contractId: string;
    playerId: string;
    playerName: string;
    endsOn: string;
    wage: number;
    status: 'active' | 'expiring' | 'expired' | 'terminated';
  }[];
  readonly coach: {
    readonly managerName: string;
    readonly employmentStatus: 'employed' | 'available' | 'retired';
    readonly boardConfidence: number;
    readonly fanConfidence: number;
    readonly prestige: number;
    readonly seasons: number;
    readonly appointments: readonly {
      clubName: string;
      joinedOn: string;
      leftOn?: string;
      reason?: 'fired' | 'resigned' | 'accepted_offer';
    }[];
    readonly achievements: readonly { type: string; count: number }[];
  };
  readonly chemistry?: ChemistryView;
}

export const INCOME_LABEL: Readonly<
  Record<keyof FinanceCategories['income'], string>
> = {
  gate: 'Bilheteria',
  sponsor: 'Patrocínio',
  membership: 'Sócio-torcedor',
  prize: 'Premiações',
  transfer: 'Vendas',
};
export const EXPENSE_LABEL: Readonly<
  Record<keyof FinanceCategories['expenses'], string>
> = {
  wages: 'Salários',
  transfer: 'Contratações',
  stadium: 'Estádio',
  membership: 'Sócio-torcedor',
  sponsor: 'Multas de patrocínio',
};

// --- formatting -----------------------------------------------------------
const brlFull = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** "R$ 12,5 mi", "R$ 850 mil", "R$ 65". */
export function formatBrl(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000)
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 10_000)
    return `${sign}R$ ${Math.round(abs / 1000).toLocaleString('pt-BR')} mil`;
  return `${sign}${brlFull.format(abs)}`;
}

export function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return day && month && year ? `${day}/${month}/${year}` : date;
}

export function formatMonth(month: string): string {
  const [year, value] = month.split('-');
  const names = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  return `${names[Number(value) - 1] ?? value}/${year ?? ''}`;
}
