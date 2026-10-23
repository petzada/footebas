import {
  createPhase4View,
  type Phase4View,
  type TransferKind,
} from '@/lib/phase4-model';
import { replayFromFeed } from '@/lib/match-replay-adapter';
import type { MatchReplayInput } from '@/lib/match-replay-model';

/** Shell destinations; the first seven are the main areas of docs/09. */
export type Screen =
  | 'central'
  | 'map'
  | 'squad'
  | 'market'
  | 'office'
  | 'season'
  | 'ranking'
  | 'inbox'
  | 'calendar'
  | 'tactics'
  | 'table'
  | 'competitions'
  | 'stadium'
  | 'finance'
  | 'history';
export type Formation = '4-3-3' | '4-4-2' | '3-5-2' | '5-3-2';
export type SquadRole = 'starter' | 'bench' | 'reserve';
export type AutoPickStrategy = 'best' | 'rest' | 'develop';
export type Mentality = 'cautious' | 'balanced' | 'attacking';
export type BuildUp = 'short' | 'mixed' | 'direct';
export type Focus = 'middle' | 'wings';
export type Press = 'low' | 'medium' | 'high';
export type DefensiveLine = 'deep' | 'standard' | 'high';
export type Marking = 'light' | 'strong' | 'very-strong';
export type MatchSpeed = 1 | 2 | 4;

export interface TacticsView {
  mentality: Mentality;
  buildUp: BuildUp;
  focus: Focus;
  press: Press;
  defensiveLine: DefensiveLine;
  marking: Marking;
}

export interface PlayerView {
  id: string;
  name: string;
  shirt: number;
  age: number;
  nationality: string;
  primaryPosition: string;
  secondaryPositions: readonly string[];
  side: 'direito' | 'esquerdo' | 'ambos' | 'centro';
  strength: number;
  traits: readonly string[];
  condition: number;
  morale: number;
  sharpness: number;
  role: SquadRole;
  injuryRounds: number;
  suspended: boolean;
  yellowCards: number;
  redCards: number;
  goals: number;
  appearances: number;
  lastRating: number | null;
  scoutingEstimates: {
    potential: 'limitado' | 'bom' | 'alto';
    consistency: 'irregular' | 'estável' | 'muito estável';
    injuryProneness: 'baixa' | 'moderada' | 'alta';
    adaptation: 'em adaptação' | 'adaptado';
    professionalism: 'adequado' | 'referência';
    bigMatches: 'a observar' | 'confiável' | 'decisivo';
  };
}

export interface StandingView {
  position: number;
  club: string;
  played: number;
  points: number;
}

export interface OpponentView {
  club: string;
  formation: Formation;
  form: readonly ('V' | 'E' | 'D')[];
  approximateStrength: number;
  absences: readonly string[];
  report: string;
}

export interface MatchActionView {
  minute: number;
  type: 'substitution' | 'tactics';
  description: string;
}

export interface MatchResultView {
  score: string;
  headline: string;
  events: readonly MatchUpdate[];
  actions: readonly MatchActionView[];
  replay?: MatchReplayInput;
}

export interface FixtureView {
  competition: string;
  /** ISO game date, when the server exposes it. */
  date?: string;
  venue: 'home' | 'away';
}

export interface CareerView {
  coach: string;
  club: string;
  /** League the club plays in (standings read model). */
  division?: string;
  /** Next fixture metadata (next-match read model). */
  fixture?: FixtureView;
  round: number;
  formation: Formation;
  tactics: TacticsView;
  players: readonly PlayerView[];
  standings: readonly StandingView[];
  opponent: OpponentView;
  world: Phase4View;
  lastResult?: MatchResultView;
}

export interface MatchUpdate {
  id: string;
  progress: number;
  minute: number;
  message: string;
  score: string;
  kind: 'kickoff' | 'chance' | 'goal' | 'card' | 'save' | 'full-time';
  /** Team that owns the action; `save` belongs to the attacking side. */
  side?: 'home' | 'away';
  decisionPoint: boolean;
  done: boolean;
}

/** Public counters for the Início screen (GET /v1/public/stats). */
export interface PublicStats {
  coaches: number;
  clubs: number;
  athletes: number;
}

/** One saved career of the signed-in player. */
export interface CareerSummary {
  id: string;
  /** Career name chosen by the player, once the server stores it. */
  name?: string;
  coach: string;
  clubName?: string;
  season?: number;
  currentDate?: string;
  round?: number;
  /** ISO timestamp of the last change, once the server exposes it. */
  updatedAt?: string;
}

export interface CareerList {
  careers: readonly CareerSummary[];
  /** Careers allowed by the plan (free: 1, license: 5), when known. */
  limit?: number;
}

export const FREE_CAREER_LIMIT = 1;
export const LICENSE_CAREER_LIMIT = 5;

/** Mirrors the server refusal `CAREER_LIMIT_REACHED`. */
export class CareerLimitReachedError extends Error {
  public readonly code = 'CAREER_LIMIT_REACHED';
  public constructor(message: string) {
    super(message);
    this.name = 'CareerLimitReachedError';
  }
}

export function isCareerLimitError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error as { code?: unknown }).code === 'CAREER_LIMIT_REACHED'
  );
}

export interface CareerApiPort {
  login(email: string): Promise<void>;
  createCareer(input: { coach: string }): Promise<void>;
  selectClub(club: string): Promise<void>;
  getCareer(): Promise<CareerView | null>;
  /** Public counters; `null` hides them (endpoint missing or failing). */
  getPublicStats(): Promise<PublicStats | null>;
  listCareers(): Promise<CareerList>;
  /** Activates a career; `null` when it still needs a club. */
  openCareer(careerId: string): Promise<CareerView | null>;
  deleteCareer(careerId: string): Promise<void>;
  setPlayerRole(playerId: string, role: SquadRole): Promise<CareerView>;
  autoPick(strategy: AutoPickStrategy): Promise<CareerView>;
  setTactics(input: {
    formation: Formation;
    tactics: TacticsView;
  }): Promise<CareerView>;
  validateMatchday(): Promise<void>;
  beginMatch(): Promise<MatchUpdate>;
  nextMatchEvent(): Promise<MatchUpdate>;
  makeSubstitution(input: {
    outgoingId: string;
    incomingId: string;
  }): Promise<MatchUpdate>;
  changeMatchTactics(input: Partial<TacticsView>): Promise<MatchUpdate>;
  renewContract(playerId: string, months: 6 | 12 | 24): Promise<CareerView>;
  refuseContract(playerId: string): Promise<CareerView>;
  terminateContract(playerId: string): Promise<CareerView>;
  setSquadMarketStatus(
    playerId: string,
    status: 'listed' | 'loan-listed',
  ): Promise<CareerView>;
  scoutMarketPlayer(playerId: string): Promise<CareerView>;
  submitTransferOffer(input: {
    playerId: string;
    amount: number;
    kind: TransferKind;
  }): Promise<CareerView>;
  acceptTransferCounter(playerId: string): Promise<CareerView>;
  setTicketPrice(price: number): Promise<CareerView>;
  maintainStadium(): Promise<CareerView>;
  expandStadium(): Promise<CareerView>;
  developYouth(playerId: string): Promise<CareerView>;
  promoteYouth(playerId: string): Promise<CareerView>;
  releaseYouth(playerId: string): Promise<CareerView>;
  acceptJobProposal(proposalId: string): Promise<CareerView>;
  finishMatch(): Promise<CareerView>;
  instantResult(): Promise<CareerView>;
}

const defaultTactics: TacticsView = {
  mentality: 'balanced',
  buildUp: 'mixed',
  focus: 'middle',
  press: 'medium',
  defensiveLine: 'standard',
  marking: 'strong',
};

type RosterSeed = readonly [
  name: string,
  shirt: number,
  age: number,
  position: string,
  secondary: readonly string[],
  side: PlayerView['side'],
  strength: number,
  traits: readonly string[],
  condition: number,
  morale: number,
  sharpness: number,
  injuryRounds?: number,
  suspended?: boolean,
];

const rosterSeeds: readonly RosterSeed[] = [
  [
    'Agustín Rossi',
    1,
    30,
    'GOL',
    [],
    'centro',
    81,
    ['Reflexo', 'Pênaltis'],
    96,
    78,
    85,
  ],
  [
    'Emerson Royal',
    22,
    27,
    'LD',
    ['ALA'],
    'direito',
    83,
    ['Velocidade', 'Cruzamento'],
    88,
    74,
    82,
  ],
  [
    'Léo Ortiz',
    3,
    30,
    'ZAG',
    ['VOL'],
    'centro',
    82,
    ['Antecipação', 'Passe'],
    94,
    80,
    89,
  ],
  [
    'Léo Pereira',
    4,
    30,
    'ZAG',
    [],
    'esquerdo',
    79,
    ['Jogo aéreo', 'Desarme'],
    91,
    76,
    83,
  ],
  [
    'Ayrton Lucas',
    6,
    29,
    'LE',
    ['ALA'],
    'esquerdo',
    84,
    ['Aceleração', 'Apoio'],
    72,
    69,
    77,
  ],
  [
    'Erick Pulgar',
    5,
    32,
    'VOL',
    ['MC'],
    'centro',
    81,
    ['Marcação', 'Passe longo'],
    87,
    75,
    86,
  ],
  [
    'Nicolás de la Cruz',
    18,
    29,
    'MC',
    ['MEI'],
    'ambos',
    82,
    ['Visão', 'Bola parada'],
    85,
    83,
    90,
  ],
  [
    'Giorgian de Arrascaeta',
    10,
    32,
    'MEI',
    ['MC'],
    'ambos',
    82,
    ['Criatividade', 'Decisivo'],
    79,
    91,
    88,
  ],
  [
    'Gonzalo Plata',
    19,
    25,
    'PD',
    ['PE'],
    'esquerdo',
    80,
    ['Drible', 'Aceleração'],
    92,
    77,
    84,
  ],
  [
    'Lucas Paquetá',
    20,
    28,
    'MEI',
    ['MC'],
    'centro',
    82,
    ['Pressão', 'Finalização'],
    90,
    86,
    91,
  ],
  [
    'Samuel Lino',
    16,
    26,
    'PE',
    ['ALA'],
    'esquerdo',
    81,
    ['Velocidade', 'Um contra um'],
    89,
    79,
    87,
  ],
  [
    'Andrew',
    42,
    25,
    'GOL',
    [],
    'centro',
    74,
    ['Colocação', 'Saída'],
    100,
    67,
    60,
  ],
  [
    'Danilo',
    13,
    35,
    'ZAG',
    ['LD'],
    'direito',
    78,
    ['Liderança', 'Antecipação'],
    83,
    82,
    73,
  ],
  [
    'Alex Sandro',
    26,
    35,
    'LE',
    ['ZAG'],
    'esquerdo',
    77,
    ['Experiência', 'Passe'],
    68,
    71,
    70,
  ],
  [
    'Jorginho',
    21,
    34,
    'VOL',
    ['MC'],
    'centro',
    79,
    ['Passe', 'Comando'],
    86,
    84,
    79,
  ],
  [
    'Jorge Carrascal',
    15,
    28,
    'MEI',
    ['PE'],
    'ambos',
    78,
    ['Drible', 'Criatividade'],
    93,
    73,
    75,
  ],
  [
    'Luiz Araújo',
    7,
    30,
    'PD',
    ['PE'],
    'esquerdo',
    79,
    ['Finalização', 'Velocidade'],
    95,
    78,
    80,
  ],
  [
    'Pedro',
    9,
    29,
    'ATA',
    [],
    'centro',
    84,
    ['Finalização', 'Jogo aéreo'],
    61,
    88,
    72,
    1,
  ],
  [
    'Wallace Yan',
    64,
    21,
    'ATA',
    ['PE'],
    'direito',
    73,
    ['Potência', 'Improviso'],
    98,
    72,
    68,
  ],
  [
    'Bruno Henrique',
    27,
    35,
    'ATA',
    ['PE'],
    'direito',
    77,
    ['Velocidade', 'Decisivo'],
    76,
    80,
    74,
    0,
    true,
  ],
];

const createRoster = (): PlayerView[] =>
  rosterSeeds.map((seed, index) => ({
    id: `fla-${seed[1]}`,
    name: seed[0],
    shirt: seed[1],
    age: seed[2],
    nationality: seed[0].includes('Plata')
      ? 'Equador'
      : seed[0].includes('Arrascaeta') || seed[0].includes('De la Cruz')
        ? 'Uruguai'
        : seed[0].includes('Pulgar')
          ? 'Chile'
          : seed[0].includes('Rossi')
            ? 'Argentina'
            : 'Brasil',
    primaryPosition: seed[3],
    secondaryPositions: seed[4],
    side: seed[5],
    strength: seed[6],
    traits: seed[7].slice(0, 2),
    condition: seed[8],
    morale: seed[9],
    sharpness: seed[10],
    role: index < 11 ? 'starter' : index < 18 ? 'bench' : 'reserve',
    injuryRounds: seed[11] ?? 0,
    suspended: seed[12] ?? false,
    yellowCards: index % 4,
    redCards: 0,
    goals: index > 7 && index < 12 ? 2 : 0,
    appearances: Math.max(1, 8 - (index % 5)),
    lastRating: index < 18 ? 6.2 + (index % 6) * 0.2 : null,
    scoutingEstimates: {
      potential: seed[2] <= 23 ? 'alto' : seed[2] <= 29 ? 'bom' : 'limitado',
      consistency:
        index % 4 === 0
          ? 'muito estável'
          : index % 4 === 1
            ? 'irregular'
            : 'estável',
      injuryProneness:
        seed[8] < 70 ? 'alta' : seed[8] < 85 ? 'moderada' : 'baixa',
      adaptation: index % 5 === 0 ? 'em adaptação' : 'adaptado',
      professionalism: index % 3 === 0 ? 'referência' : 'adequado',
      bigMatches: seed[7].includes('Decisivo')
        ? 'decisivo'
        : index % 2
          ? 'confiável'
          : 'a observar',
    },
  }));

const timeline: readonly MatchUpdate[] = [
  {
    id: 'm-00',
    progress: 1,
    minute: 0,
    message: 'Bola rolando no Maracanã',
    score: '0 × 0',
    kind: 'kickoff',
    decisionPoint: false,
    done: false,
  },
  {
    id: 'm-12',
    progress: 16,
    minute: 12,
    message: 'Samuel Lino acelera pela esquerda e cruza com perigo',
    score: '0 × 0',
    kind: 'chance',
    side: 'home',
    decisionPoint: false,
    done: false,
  },
  {
    id: 'm-29',
    progress: 34,
    minute: 29,
    message: 'Rossi fecha o ângulo e salva o Flamengo',
    score: '0 × 0',
    kind: 'save',
    side: 'away',
    decisionPoint: false,
    done: false,
  },
  {
    id: 'm-43',
    progress: 49,
    minute: 43,
    message: 'GOL! Paquetá completa a jogada de Arrascaeta',
    score: '1 × 0',
    kind: 'goal',
    side: 'home',
    decisionPoint: true,
    done: false,
  },
  {
    id: 'm-58',
    progress: 65,
    minute: 58,
    message: 'Palmeiras sobe a pressão pelo corredor central',
    score: '1 × 0',
    kind: 'chance',
    side: 'away',
    decisionPoint: true,
    done: false,
  },
  {
    id: 'm-71',
    progress: 79,
    minute: 71,
    message: 'Léo Ortiz recebe amarelo ao parar o contra-ataque',
    score: '1 × 0',
    kind: 'card',
    side: 'home',
    decisionPoint: true,
    done: false,
  },
  {
    id: 'm-84',
    progress: 92,
    minute: 84,
    message: 'Luiz Araújo acerta a trave em chute cruzado',
    score: '1 × 0',
    kind: 'chance',
    side: 'home',
    decisionPoint: false,
    done: false,
  },
  {
    id: 'm-90',
    progress: 100,
    minute: 90,
    message: 'Fim de jogo. Vitória confirmada no Maracanã',
    score: '1 × 0',
    kind: 'full-time',
    decisionPoint: false,
    done: true,
  },
];

interface StoredCareer {
  readonly id: string;
  view: CareerView;
  updatedAt: string;
}

const LOCAL_CLUBS = ['Flamengo', 'Fluminense', 'Atlético Mineiro'] as const;

export class InMemoryCareerApi implements CareerApiPort {
  #authenticated = false;
  readonly #careers = new Map<string, StoredCareer>();
  #activeId: string | undefined;
  #sequence = 0;
  readonly #limit: number;
  readonly #now: () => Date;
  #eventIndex = -1;
  #matchPlayers: PlayerView[] = [];
  #matchActions: MatchActionView[] = [];

  public constructor(options: { careerLimit?: number; now?: () => Date } = {}) {
    this.#limit = options.careerLimit ?? FREE_CAREER_LIMIT;
    this.#now = options.now ?? (() => new Date());
  }

  /** The active career; writes also stamp its last update. */
  get #career(): CareerView | null {
    return this.#activeId
      ? (this.#careers.get(this.#activeId)?.view ?? null)
      : null;
  }

  set #career(view: CareerView) {
    const stored = this.#activeId && this.#careers.get(this.#activeId);
    if (!stored) throw new Error('Carreira não encontrada.');
    stored.view = view;
    stored.updatedAt = this.#now().toISOString();
  }

  async login(email: string) {
    if (!email.includes('@')) throw new Error('Informe um e-mail válido.');
    this.#authenticated = true;
  }

  async createCareer({ coach }: { coach: string }) {
    if (!this.#authenticated) throw new Error('Sessão necessária.');
    if (!coach.trim()) throw new Error('Informe o nome do treinador.');
    if (this.#careers.size >= this.#limit)
      throw new CareerLimitReachedError(
        this.#limit === FREE_CAREER_LIMIT
          ? 'O plano grátis permite 1 carreira. Exclua a atual ou ative a licença para ter até 5.'
          : `Você chegou ao limite de ${this.#limit} carreiras. Exclua uma para começar outra.`,
      );
    this.#sequence += 1;
    const id = `career-${this.#sequence}`;
    this.#careers.set(id, {
      id,
      updatedAt: this.#now().toISOString(),
      view: {
        coach: coach.trim(),
        club: '',
        division: 'Série A',
        fixture: { competition: 'Série A', venue: 'home' },
        round: 1,
        formation: '4-3-3',
        tactics: { ...defaultTactics },
        players: createRoster(),
        standings: initialTable,
        opponent: opponents[0],
        world: createPhase4View(coach.trim(), ''),
      },
    });
    this.#activeId = id;
    this.#eventIndex = -1;
  }

  async selectClub(club: string) {
    this.#require();
    if (!(LOCAL_CLUBS as readonly string[]).includes(club))
      throw new Error('Clube indisponível.');
    this.#career = {
      ...this.#career!,
      club,
      world: createPhase4View(this.#career!.coach, club),
    };
  }

  async getCareer() {
    return this.#career ? structuredClone(this.#career) : null;
  }

  async getPublicStats(): Promise<PublicStats> {
    const clubs = new Set<string>([
      ...LOCAL_CLUBS,
      ...initialTable.map(({ club }) => club),
      ...opponents.map(({ club }) => club),
    ]);
    const coaches = new Set(
      [...this.#careers.values()].map(({ view }) => view.coach),
    );
    return {
      coaches: Math.max(1, coaches.size),
      clubs: clubs.size,
      athletes: rosterSeeds.length,
    };
  }

  async listCareers(): Promise<CareerList> {
    const careers = [...this.#careers.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ id, view, updatedAt }): CareerSummary => ({
        id,
        coach: view.coach,
        ...(view.club ? { clubName: view.club } : {}),
        season: 2026,
        round: view.round,
        updatedAt,
      }));
    return { careers, limit: this.#limit };
  }

  async openCareer(careerId: string) {
    if (!this.#careers.has(careerId))
      throw new Error('Carreira não encontrada.');
    this.#activeId = careerId;
    this.#eventIndex = -1;
    const view = this.#career!;
    return view.club ? structuredClone(view) : null;
  }

  async deleteCareer(careerId: string) {
    if (!this.#careers.delete(careerId))
      throw new Error('Carreira não encontrada.');
    if (this.#activeId === careerId) {
      this.#activeId = undefined;
      this.#eventIndex = -1;
    }
  }

  async setPlayerRole(playerId: string, role: SquadRole) {
    const current = this.#require();
    const player = current.players.find((item) => item.id === playerId);
    if (!player) throw new Error('Jogador não encontrado.');
    if (role === 'starter' && (player.injuryRounds > 0 || player.suspended)) {
      throw new Error(
        player.injuryRounds > 0
          ? 'Jogador lesionado não pode ser titular.'
          : 'Jogador suspenso não pode ser titular.',
      );
    }
    const players = current.players.map((item) =>
      item.id === playerId ? { ...item, role } : item,
    );
    if (players.filter((item) => item.role === 'bench').length > 7)
      throw new Error('O banco aceita no máximo 7 jogadores.');
    if (players.filter((item) => item.role === 'starter').length > 11)
      throw new Error('A escalação aceita somente 11 titulares.');
    this.#career = { ...current, players };
    return structuredClone(this.#career);
  }

  async autoPick(strategy: AutoPickStrategy) {
    const current = this.#require();
    const eligible = current.players.filter(
      (player) => !player.injuryRounds && !player.suspended,
    );
    const score = (player: PlayerView) =>
      strategy === 'best'
        ? player.strength * 2 + player.condition + player.sharpness
        : strategy === 'rest'
          ? player.condition * 2 + player.strength + player.sharpness
          : (40 - player.age) * 3 + player.strength + player.sharpness;
    const goalkeepers = eligible
      .filter((player) => player.primaryPosition === 'GOL')
      .sort((a, b) => score(b) - score(a));
    const outfield = eligible
      .filter((player) => player.primaryPosition !== 'GOL')
      .sort((a, b) => score(b) - score(a));
    const startingPlayers = [
      ...goalkeepers.slice(0, 1),
      ...outfield.slice(0, 10),
    ];
    const remaining = eligible
      .filter(
        (player) =>
          !startingPlayers.some((starter) => starter.id === player.id),
      )
      .sort((a, b) => score(b) - score(a));
    const starters = new Set(startingPlayers.map((player) => player.id));
    const bench = new Set(remaining.slice(0, 7).map((player) => player.id));
    this.#career = {
      ...current,
      players: current.players.map((player) => ({
        ...player,
        role: starters.has(player.id)
          ? 'starter'
          : bench.has(player.id)
            ? 'bench'
            : 'reserve',
      })),
    };
    return structuredClone(this.#career);
  }

  async setTactics(input: { formation: Formation; tactics: TacticsView }) {
    this.#career = {
      ...this.#require(),
      formation: input.formation,
      tactics: { ...input.tactics },
    };
    return structuredClone(this.#career);
  }

  async validateMatchday() {
    const current = this.#require();
    const starters = current.players.filter(
      (player) => player.role === 'starter',
    );
    if (starters.length !== 11)
      throw new Error(
        `Escalação inválida: escolha 11 titulares. Agora há ${starters.length}.`,
      );
    const goalkeeperCount = starters.filter(
      (player) => player.primaryPosition === 'GOL',
    ).length;
    if (goalkeeperCount !== 1)
      throw new Error(
        'Escalação inválida: escolha exatamente um goleiro titular.',
      );
    const unavailable = starters.find(
      (player) => player.injuryRounds > 0 || player.suspended,
    );
    if (unavailable)
      throw new Error(
        `Escalação inválida: ${unavailable.name} está indisponível.`,
      );
  }

  async beginMatch() {
    await this.validateMatchday();
    this.#eventIndex = 0;
    this.#matchPlayers = structuredClone(
      this.#require().players as PlayerView[],
    );
    this.#matchActions = [];
    return structuredClone(timeline[0]);
  }

  async nextMatchEvent() {
    if (this.#eventIndex < 0) throw new Error('A partida ainda não começou.');
    this.#eventIndex = Math.min(this.#eventIndex + 1, timeline.length - 1);
    return structuredClone(timeline[this.#eventIndex]);
  }

  async makeSubstitution({
    outgoingId,
    incomingId,
  }: {
    outgoingId: string;
    incomingId: string;
  }) {
    const currentEvent = this.#currentEvent();
    if (!currentEvent.decisionPoint)
      throw new Error(
        'Substituições só podem ser feitas nas pausas da partida.',
      );
    if (
      this.#matchActions.filter((action) => action.type === 'substitution')
        .length >= 5
    )
      throw new Error('Limite de 5 substituições atingido.');
    const outgoing = this.#matchPlayers.find(
      (player) => player.id === outgoingId,
    );
    const incoming = this.#matchPlayers.find(
      (player) => player.id === incomingId,
    );
    if (
      !outgoing ||
      !incoming ||
      outgoing.role !== 'starter' ||
      incoming.role !== 'bench'
    )
      throw new Error('Escolha um titular em campo e um jogador do banco.');
    outgoing.role = 'bench';
    incoming.role = 'starter';
    this.#matchActions.push({
      minute: currentEvent.minute,
      type: 'substitution',
      description: `${incoming.name} entra no lugar de ${outgoing.name}`,
    });
    return structuredClone(currentEvent);
  }

  async changeMatchTactics(input: Partial<TacticsView>) {
    const currentEvent = this.#currentEvent();
    if (!currentEvent.decisionPoint)
      throw new Error(
        'Ajustes táticos só podem ser feitos nas pausas da partida.',
      );
    const current = this.#require();
    this.#career = { ...current, tactics: { ...current.tactics, ...input } };
    this.#matchActions.push({
      minute: currentEvent.minute,
      type: 'tactics',
      description: `Mentalidade alterada para ${input.mentality ?? current.tactics.mentality}`,
    });
    return structuredClone(currentEvent);
  }

  async renewContract(playerId: string, months: 6 | 12 | 24) {
    const current = this.#require();
    const contract = current.world.contracts.find(
      (item) => item.playerId === playerId,
    );
    if (!contract) throw new Error('Contrato não encontrado.');
    if (contract.status === 'refused')
      throw new Error(
        'A negociação já foi recusada e não pode ser reaberta agora.',
      );
    const cost = contract.renewalDemand;
    const world = this.#worldWithLedger(
      {
        ...current.world,
        contracts: current.world.contracts.map((item) =>
          item.playerId === playerId
            ? {
                ...item,
                monthsRemaining: months,
                salary: item.renewalDemand,
                status: 'renewed' as const,
              }
            : item,
        ),
        contractAlerts: current.world.contractAlerts.filter(
          (alert) => !alert.includes(contract.playerName),
        ),
        finances: {
          ...current.world.finances,
          wageBill: current.world.finances.wageBill - contract.salary + cost,
        },
      },
      `Renovação · ${contract.playerName} · ${months} meses`,
      'contract',
      -cost,
    );
    return this.#commitWorld(world);
  }

  async refuseContract(playerId: string) {
    const current = this.#require();
    const contract = current.world.contracts.find(
      (item) => item.playerId === playerId,
    );
    if (!contract) throw new Error('Contrato não encontrado.');
    return this.#commitWorld({
      ...current.world,
      contracts: current.world.contracts.map((item) =>
        item.playerId === playerId
          ? { ...item, status: 'refused' as const }
          : item,
      ),
      contractAlerts: [
        ...current.world.contractAlerts.filter(
          (alert) => !alert.includes(contract.playerName),
        ),
        `${contract.playerName} deixará o clube ao fim do vínculo.`,
      ],
    });
  }

  async terminateContract(playerId: string) {
    const current = this.#require();
    const contract = current.world.contracts.find(
      (item) => item.playerId === playerId,
    );
    if (!contract) throw new Error('Contrato não encontrado.');
    const cost = contract.salary * Math.max(1, contract.monthsRemaining);
    if (cost > current.world.finances.cash)
      throw new Error('Caixa insuficiente para pagar a rescisão.');
    const world = this.#worldWithLedger(
      {
        ...current.world,
        contracts: current.world.contracts.filter(
          (item) => item.playerId !== playerId,
        ),
        contractAlerts: current.world.contractAlerts.filter(
          (alert) => !alert.includes(contract.playerName),
        ),
      },
      `Rescisão · ${contract.playerName}`,
      'contract',
      -cost,
    );
    return this.#commitWorld(world);
  }

  async setSquadMarketStatus(
    playerId: string,
    status: 'listed' | 'loan-listed',
  ) {
    const current = this.#require();
    const player = current.players.find((item) => item.id === playerId);
    if (!player) throw new Error('Jogador não encontrado.');
    const label = status === 'listed' ? 'venda' : 'empréstimo';
    return this.#commitWorld({
      ...current.world,
      news: [
        {
          id: `n-${Date.now()}`,
          tag: 'Mercado',
          headline: `${player.name} foi colocado para ${label}`,
          detail:
            'Clubes interessados podem enviar propostas na próxima rodada.',
        },
        ...current.world.news,
      ],
    });
  }

  async scoutMarketPlayer(playerId: string) {
    const current = this.#require();
    if (!current.world.market.some((player) => player.id === playerId))
      throw new Error('Atleta não encontrado no mercado.');
    return this.#commitWorld({
      ...current.world,
      market: current.world.market.map((player) =>
        player.id === playerId ? { ...player, scouted: true } : player,
      ),
    });
  }

  async submitTransferOffer({
    playerId,
    amount,
    kind,
  }: {
    playerId: string;
    amount: number;
    kind: TransferKind;
  }) {
    const current = this.#require();
    const player = current.world.market.find((item) => item.id === playerId);
    if (!player) throw new Error('Atleta não encontrado no mercado.');
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error('Informe um valor de oferta maior que zero.');
    if (kind === 'loan' && player.availability === 'free-agent')
      throw new Error('Atleta livre não pode ser contratado por empréstimo.');
    const threshold =
      kind === 'loan'
        ? Math.max(500000, player.value * 0.08)
        : Math.max(player.salary * 4, player.value * 0.9);
    if (amount < threshold) {
      const counterAmount = Math.round(threshold / 100000) * 100000;
      return this.#commitWorld({
        ...current.world,
        market: current.world.market.map((item) =>
          item.id === playerId
            ? {
                ...item,
                offerStatus: 'countered' as const,
                counterAmount,
                pendingKind: kind,
              }
            : item,
        ),
      });
    }
    return this.#completeTransfer(playerId, amount, kind);
  }

  async acceptTransferCounter(playerId: string) {
    const current = this.#require();
    const player = current.world.market.find((item) => item.id === playerId);
    if (!player || player.offerStatus !== 'countered' || !player.counterAmount)
      throw new Error('Não há contraproposta disponível.');
    return this.#completeTransfer(
      playerId,
      player.counterAmount,
      player.pendingKind ?? (player.availability === 'loan' ? 'loan' : 'buy'),
    );
  }

  async setTicketPrice(price: number) {
    const current = this.#require();
    if (!Number.isFinite(price) || price < 10 || price > 250)
      throw new Error('O ingresso deve custar entre R$ 10 e R$ 250.');
    return this.#commitWorld({
      ...current.world,
      stadium: { ...current.world.stadium, ticketPrice: Math.round(price) },
    });
  }

  async maintainStadium() {
    const current = this.#require();
    const cost = 850000;
    if (current.world.finances.cash < cost)
      throw new Error('Caixa insuficiente para a manutenção.');
    return this.#commitWorld(
      this.#worldWithLedger(
        {
          ...current.world,
          stadium: { ...current.world.stadium, maintenance: 'em dia' },
        },
        'Estádio · manutenção preventiva',
        'stadium',
        -cost,
      ),
    );
  }

  async expandStadium() {
    const current = this.#require();
    const cost = current.world.stadium.expansionCost;
    if (
      current.world.finances.cash - cost <
      current.world.finances.transferGate
    )
      throw new Error(
        'A diretoria bloqueou a obra: preserve a reserva mínima do clube.',
      );
    return this.#commitWorld(
      this.#worldWithLedger(
        {
          ...current.world,
          stadium: {
            ...current.world.stadium,
            capacity: current.world.stadium.capacity + 5000,
            expansionCost: Math.round(cost * 1.25),
          },
        },
        'Estádio · ampliação de 5.000 lugares',
        'stadium',
        -cost,
      ),
    );
  }

  async developYouth(playerId: string) {
    const current = this.#require();
    const youth = current.world.youth.find((item) => item.id === playerId);
    if (!youth || youth.status !== 'academy')
      throw new Error('Jovem indisponível para desenvolvimento.');
    return this.#commitWorld({
      ...current.world,
      youth: current.world.youth.map((item) =>
        item.id === playerId
          ? {
              ...item,
              readiness: 'plano individual ativo · revisão em 4 rodadas',
            }
          : item,
      ),
    });
  }

  async promoteYouth(playerId: string) {
    const current = this.#require();
    const youth = current.world.youth.find((item) => item.id === playerId);
    if (!youth || youth.status !== 'academy')
      throw new Error('Jovem indisponível para promoção.');
    return this.#commitWorld({
      ...current.world,
      youth: current.world.youth.map((item) =>
        item.id === playerId ? { ...item, status: 'promoted' as const } : item,
      ),
      news: [
        {
          id: `n-${Date.now()}`,
          tag: 'Base',
          headline: `${youth.name} foi promovido`,
          detail: 'O jovem gerado passa a treinar com o elenco principal.',
        },
        ...current.world.news,
      ],
    });
  }

  async releaseYouth(playerId: string) {
    const current = this.#require();
    const youth = current.world.youth.find((item) => item.id === playerId);
    if (!youth || youth.status !== 'academy')
      throw new Error('Jovem indisponível para dispensa.');
    return this.#commitWorld({
      ...current.world,
      youth: current.world.youth.map((item) =>
        item.id === playerId ? { ...item, status: 'released' as const } : item,
      ),
    });
  }

  async acceptJobProposal(proposalId: string) {
    const current = this.#require();
    const proposal = current.world.board.proposals.find(
      (item) => item.id === proposalId,
    );
    if (!proposal) throw new Error('Proposta de trabalho indisponível.');
    this.#career = {
      ...current,
      club: proposal.club,
      world: {
        ...current.world,
        board: {
          ...current.world.board,
          confidence: 55,
          fanConfidence: 50,
          objective: proposal.objective,
          status: 'Novo trabalho iniciado',
          firingRisk: 'sem risco imediato',
          proposals: [],
        },
        history: {
          ...current.world.history,
          seasons: [
            {
              season: '2026',
              club: current.club,
              finish: 'Troca de clube durante a temporada',
              topScorer: 'Pedro · 11 gols',
            },
            ...current.world.history.seasons,
          ],
        },
        leaderboards: {
          global: current.world.leaderboards.global.map((row) =>
            row.highlight ? { ...row, club: proposal.club } : row,
          ),
          underdog: current.world.leaderboards.underdog.map((row) =>
            row.highlight ? { ...row, club: proposal.club } : row,
          ),
          monthly: current.world.leaderboards.monthly.map((row) =>
            row.highlight ? { ...row, club: proposal.club } : row,
          ),
        },
        news: [
          {
            id: `n-${Date.now()}`,
            tag: 'Carreira',
            headline: `${current.coach} assume o ${proposal.club}`,
            detail: `A carreira continua na ${proposal.division}; prestígio e histórico foram preservados.`,
          },
          ...current.world.news,
        ],
      },
    };
    return structuredClone(this.#career);
  }

  #completeTransfer(playerId: string, amount: number, kind: TransferKind) {
    const current = this.#require();
    const player = current.world.market.find((item) => item.id === playerId)!;
    if (
      amount >
      current.world.finances.cash - current.world.finances.transferGate
    )
      throw new Error(
        'A oferta ultrapassa o limite autorizado pela diretoria.',
      );
    const world = this.#worldWithLedger(
      {
        ...current.world,
        market: current.world.market.map((item) =>
          item.id === playerId ? acceptedMarketPlayer(item) : item,
        ),
      },
      `${kind === 'loan' ? 'Empréstimo' : 'Transferência'} · ${player.name} · ${player.club}`,
      'transfer',
      -amount,
    );
    return this.#commitWorld(world);
  }

  #worldWithLedger(
    world: Phase4View,
    sourceLabel: string,
    category: Phase4View['finances']['ledger'][number]['category'],
    amount: number,
  ): Phase4View {
    const balance = world.finances.cash + amount;
    return {
      ...world,
      finances: {
        ...world.finances,
        cash: balance,
        ledger: [
          {
            id: `l-${Date.now()}`,
            date: '09/07',
            sourceLabel,
            category,
            amount,
            balance,
          },
          ...world.finances.ledger,
        ],
      },
    };
  }

  #commitWorld(world: Phase4View) {
    this.#career = { ...this.#require(), world };
    return structuredClone(this.#career);
  }

  async finishMatch() {
    if (this.#eventIndex < 0) throw new Error('A partida ainda não começou.');
    return this.#commitResult();
  }

  async instantResult() {
    await this.beginMatch();
    this.#eventIndex = timeline.length - 1;
    return this.#commitResult();
  }

  #commitResult() {
    const current = this.#require();
    const events = timeline.map((event) => structuredClone(event));
    const result: MatchResultView = {
      score: '1 × 0',
      headline: 'Vitória com cara de time grande',
      events,
      actions: structuredClone(this.#matchActions),
      replay: replayFromFeed(current, events, `match-${current.round + 1}`),
    };
    this.#career = {
      ...current,
      round: current.round + 1,
      opponent: opponents[current.round % opponents.length],
      lastResult: result,
      players: current.players.map((player) => ({
        ...player,
        condition: Math.max(
          55,
          player.condition - (player.role === 'starter' ? 7 : 1),
        ),
      })),
      standings: initialTable.map((row) =>
        row.club === current.club
          ? {
              ...row,
              played: row.played + 1,
              points: row.points + 3,
              position: 2,
            }
          : row,
      ),
    };
    this.#eventIndex = -1;
    return structuredClone(this.#career);
  }

  #currentEvent() {
    if (this.#eventIndex < 0) throw new Error('A partida ainda não começou.');
    return timeline[this.#eventIndex];
  }

  #require() {
    if (!this.#career) throw new Error('Carreira não encontrada.');
    return this.#career;
  }
}

function acceptedMarketPlayer(
  player: Phase4View['market'][number],
): Phase4View['market'][number] {
  return {
    ...player,
    offerStatus: 'accepted',
    counterAmount: undefined,
    pendingKind: undefined,
  };
}

const initialTable: StandingView[] = [
  { position: 1, club: 'Palmeiras', played: 1, points: 3 },
  { position: 2, club: 'Flamengo', played: 0, points: 0 },
  { position: 3, club: 'Atlético Mineiro', played: 1, points: 1 },
  { position: 4, club: 'Fluminense', played: 1, points: 0 },
];

const opponents: readonly OpponentView[] = [
  {
    club: 'Palmeiras',
    formation: '4-3-3',
    form: ['V', 'V', 'E', 'V', 'D'],
    approximateStrength: 82,
    absences: ['Vitor Roque (suspenso)'],
    report: 'Pressiona alto e deixa espaço atrás dos laterais.',
  },
  {
    club: 'Atlético Mineiro',
    formation: '4-4-2',
    form: ['E', 'V', 'D', 'V', 'V'],
    approximateStrength: 79,
    absences: ['Hulk (lesão)'],
    report: 'Ameaça em transições e bolas paradas.',
  },
];
