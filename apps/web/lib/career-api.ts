export type Screen = 'home' | 'squad' | 'tactics' | 'table';
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
}

export interface CareerView {
  coach: string;
  club: string;
  round: number;
  formation: Formation;
  tactics: TacticsView;
  players: readonly PlayerView[];
  standings: readonly StandingView[];
  opponent: OpponentView;
  lastResult?: MatchResultView;
}

export interface MatchUpdate {
  id: string;
  progress: number;
  minute: number;
  message: string;
  score: string;
  kind: 'kickoff' | 'chance' | 'goal' | 'card' | 'save' | 'full-time';
  decisionPoint: boolean;
  done: boolean;
}

export interface CareerApiPort {
  login(email: string): Promise<void>;
  createCareer(input: { coach: string }): Promise<void>;
  selectClub(club: string): Promise<void>;
  getCareer(): Promise<CareerView | null>;
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

export class InMemoryCareerApi implements CareerApiPort {
  #authenticated = false;
  #career: CareerView | null = null;
  #eventIndex = -1;
  #matchPlayers: PlayerView[] = [];
  #matchActions: MatchActionView[] = [];

  async login(email: string) {
    if (!email.includes('@')) throw new Error('Informe um e-mail válido.');
    this.#authenticated = true;
  }

  async createCareer({ coach }: { coach: string }) {
    if (!this.#authenticated) throw new Error('Sessão necessária.');
    if (!coach.trim()) throw new Error('Informe o nome do treinador.');
    this.#career = {
      coach: coach.trim(),
      club: '',
      round: 1,
      formation: '4-3-3',
      tactics: { ...defaultTactics },
      players: createRoster(),
      standings: initialTable,
      opponent: opponents[0],
    };
  }

  async selectClub(club: string) {
    this.#require();
    if (!['Flamengo', 'Fluminense', 'Atlético Mineiro'].includes(club))
      throw new Error('Clube indisponível.');
    this.#career = { ...this.#career!, club };
  }

  async getCareer() {
    return this.#career ? structuredClone(this.#career) : null;
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
    const result: MatchResultView = {
      score: '1 × 0',
      headline: 'Vitória com cara de time grande',
      events: timeline.map((event) => structuredClone(event)),
      actions: structuredClone(this.#matchActions),
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
