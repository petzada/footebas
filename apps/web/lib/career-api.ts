export type Screen = 'home' | 'squad' | 'tactics' | 'table';
export type Formation = '4-3-3' | '4-4-2' | '3-5-2';
export type Tactic = 'equilibrio' | 'pressao' | 'contra-ataque';

export interface PlayerView {
  id: string;
  name: string;
  position: string;
  rating: number;
  starter: boolean;
}
export interface StandingView {
  position: number;
  club: string;
  played: number;
  points: number;
}
export interface CareerView {
  coach: string;
  club: string;
  round: number;
  nextOpponent: string;
  formation: Formation;
  tactic: Tactic;
  players: readonly PlayerView[];
  standings: readonly StandingView[];
  lastResult?: { score: string; headline: string };
}
export interface MatchUpdate {
  progress: number;
  minute: number;
  message: string;
  score: string;
  done: boolean;
}
export interface CareerApiPort {
  login(email: string): Promise<void>;
  createCareer(input: { coach: string }): Promise<void>;
  selectClub(club: string): Promise<void>;
  getCareer(): Promise<CareerView | null>;
  setLineup(playerId: string): Promise<CareerView>;
  setTactics(input: {
    formation: Formation;
    tactic: Tactic;
  }): Promise<CareerView>;
  advanceMatch(onUpdate: (update: MatchUpdate) => void): Promise<CareerView>;
}

const roster: PlayerView[] = [
  ['p1', 'Agustín Rossi', 'GOL', 81],
  ['p2', 'Emerson Royal', 'LD', 83],
  ['p3', 'Léo Ortiz', 'ZAG', 82],
  ['p4', 'Léo Pereira', 'ZAG', 79],
  ['p5', 'Ayrton Lucas', 'LE', 84],
  ['p6', 'Erick Pulgar', 'VOL', 81],
  ['p7', 'Nicolás de la Cruz', 'MC', 82],
  ['p8', 'Giorgian de Arrascaeta', 'MEI', 82],
  ['p9', 'Gonzalo Plata', 'PD', 80],
  ['p10', 'Lucas Paquetá', 'MEI', 82],
  ['p11', 'Samuel Lino', 'PE', 81],
  ['p12', 'Luiz Araújo', 'PD', 79],
].map(([id, name, position, rating], index) => ({
  id: String(id),
  name: String(name),
  position: String(position),
  rating: Number(rating),
  starter: index < 11,
}));

export class InMemoryCareerApi implements CareerApiPort {
  #authenticated = false;
  #career: CareerView | null = null;
  async login(email: string) {
    if (!email.includes('@')) throw new Error('Informe um e-mail válido.');
    this.#authenticated = true;
  }
  async createCareer({ coach }: { coach: string }) {
    if (!this.#authenticated) throw new Error('Sessão necessária.');
    this.#career = {
      coach,
      club: '',
      round: 1,
      nextOpponent: 'Palmeiras',
      formation: '4-3-3',
      tactic: 'equilibrio',
      players: roster,
      standings: initialTable,
    };
  }
  async selectClub(club: string) {
    this.#require();
    this.#career = { ...this.#career!, club };
  }
  async getCareer() {
    return this.#career ? structuredClone(this.#career) : null;
  }
  async setLineup(playerId: string) {
    const current = this.#require();
    const target = current.players.find((p) => p.id === playerId);
    if (!target) throw new Error('Jogador não encontrado.');
    const starters = current.players.filter((p) => p.starter);
    const next = current.players.map((p) =>
      p.id === playerId ? { ...p, starter: !p.starter } : p,
    );
    if (!target.starter && starters.length >= 11) {
      const first = next.find((p) => p.starter);
      if (first) first.starter = false;
    }
    this.#career = { ...current, players: next };
    return structuredClone(this.#career);
  }
  async setTactics(input: { formation: Formation; tactic: Tactic }) {
    this.#career = { ...this.#require(), ...input };
    return structuredClone(this.#career);
  }
  async advanceMatch(onUpdate: (update: MatchUpdate) => void) {
    const updates: MatchUpdate[] = [
      {
        progress: 18,
        minute: 12,
        message: 'Flamengo pressiona pela direita',
        score: '0 × 0',
        done: false,
      },
      {
        progress: 53,
        minute: 48,
        message: 'GOL! Lucas Paquetá completa o cruzamento',
        score: '1 × 0',
        done: false,
      },
      {
        progress: 82,
        minute: 76,
        message: 'Agustín Rossi salva no canto',
        score: '1 × 0',
        done: false,
      },
      {
        progress: 100,
        minute: 90,
        message: 'Fim de jogo',
        score: '1 × 0',
        done: true,
      },
    ];
    for (const update of updates) {
      onUpdate(update);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    const current = this.#require();
    this.#career = {
      ...current,
      round: current.round + 1,
      nextOpponent: 'Atlético Mineiro',
      lastResult: {
        score: '1 × 0',
        headline: 'Vitória com cara de time grande',
      },
      standings: initialTable.map((row) =>
        row.club === current.club
          ? { ...row, points: row.points + 3, position: 2 }
          : row,
      ),
    };
    return structuredClone(this.#career);
  }
  #require() {
    if (!this.#career) throw new Error('Carreira não encontrada.');
    return this.#career;
  }
}

const initialTable: StandingView[] = [
  { position: 1, club: 'Palmeiras', played: 1, points: 3 },
  { position: 2, club: 'Flamengo', played: 0, points: 0 },
  { position: 3, club: 'Atlético Mineiro', played: 1, points: 0 },
  { position: 4, club: 'Fluminense', played: 0, points: 0 },
];
