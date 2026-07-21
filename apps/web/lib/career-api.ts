export type Screen = "home" | "squad" | "tactics" | "table";
export type Formation = "4-3-3" | "4-4-2" | "3-5-2";
export type Tactic = "equilibrio" | "pressao" | "contra-ataque";

export interface PlayerView { id: string; name: string; position: string; rating: number; starter: boolean }
export interface StandingView { position: number; club: string; played: number; points: number }
export interface CareerView {
  coach: string; club: string; round: number; nextOpponent: string; formation: Formation; tactic: Tactic;
  players: readonly PlayerView[]; standings: readonly StandingView[]; lastResult?: { score: string; headline: string };
}
export interface MatchUpdate { progress: number; minute: number; message: string; score: string; done: boolean }
export interface CareerApiPort {
  login(email: string): Promise<void>;
  createCareer(input: { coach: string }): Promise<void>;
  selectClub(club: string): Promise<void>;
  getCareer(): Promise<CareerView | null>;
  setLineup(playerId: string): Promise<CareerView>;
  setTactics(input: { formation: Formation; tactic: Tactic }): Promise<CareerView>;
  advanceMatch(onUpdate: (update: MatchUpdate) => void): Promise<CareerView>;
}

const roster: PlayerView[] = [
  ["p1", "Caio Ventura", "GOL", 72], ["p2", "Breno Luz", "LD", 68], ["p3", "Ícaro Reis", "ZAG", 73],
  ["p4", "Davi Sena", "ZAG", 70], ["p5", "Luan Prado", "LE", 69], ["p6", "Nando Brás", "VOL", 74],
  ["p7", "Ravi Melo", "MC", 71], ["p8", "Téo Farias", "MEI", 76], ["p9", "Cauã Neri", "PD", 75],
  ["p10", "Jota Vale", "ATA", 78], ["p11", "Miro Dantas", "PE", 73], ["p12", "Gui Porto", "ATA", 67],
].map(([id, name, position, rating], index) => ({ id: String(id), name: String(name), position: String(position), rating: Number(rating), starter: index < 11 }));

export class InMemoryCareerApi implements CareerApiPort {
  #authenticated = false;
  #career: CareerView | null = null;
  async login(email: string) { if (!email.includes("@")) throw new Error("Informe um e-mail válido."); this.#authenticated = true; }
  async createCareer({ coach }: { coach: string }) { if (!this.#authenticated) throw new Error("Sessão necessária."); this.#career = { coach, club: "", round: 1, nextOpponent: "União Serrana", formation: "4-3-3", tactic: "equilibrio", players: roster, standings: initialTable }; }
  async selectClub(club: string) { this.#require(); this.#career = { ...this.#career!, club }; }
  async getCareer() { return this.#career ? structuredClone(this.#career) : null; }
  async setLineup(playerId: string) { const current = this.#require(); const target = current.players.find((p) => p.id === playerId); if (!target) throw new Error("Jogador não encontrado."); const starters = current.players.filter((p) => p.starter); const next = current.players.map((p) => p.id === playerId ? { ...p, starter: !p.starter } : p); if (!target.starter && starters.length >= 11) { const first = next.find((p) => p.starter); if (first) first.starter = false; } this.#career = { ...current, players: next }; return structuredClone(this.#career); }
  async setTactics(input: { formation: Formation; tactic: Tactic }) { this.#career = { ...this.#require(), ...input }; return structuredClone(this.#career); }
  async advanceMatch(onUpdate: (update: MatchUpdate) => void) {
    const updates: MatchUpdate[] = [
      { progress: 18, minute: 12, message: "Aurora pressiona pela direita", score: "0 × 0", done: false },
      { progress: 53, minute: 48, message: "GOL! Jota Vale completa o cruzamento", score: "1 × 0", done: false },
      { progress: 82, minute: 76, message: "Caio Ventura salva no canto", score: "1 × 0", done: false },
      { progress: 100, minute: 90, message: "Fim de jogo no Campo do Povo", score: "1 × 0", done: true },
    ];
    for (const update of updates) { onUpdate(update); await new Promise((resolve) => setTimeout(resolve, 120)); }
    const current = this.#require();
    this.#career = { ...current, round: current.round + 1, nextOpponent: "Ferroviário Central", lastResult: { score: "1 × 0", headline: "Vitória com cara de time grande" }, standings: initialTable.map((row) => row.club === current.club ? { ...row, points: row.points + 3, position: 2 } : row) };
    return structuredClone(this.#career);
  }
  #require() { if (!this.#career) throw new Error("Carreira não encontrada."); return this.#career; }
}

const initialTable: StandingView[] = [
  { position: 1, club: "União Serrana", played: 1, points: 3 }, { position: 2, club: "Atlético Aurora", played: 0, points: 0 },
  { position: 3, club: "Ferroviário Central", played: 1, points: 0 }, { position: 4, club: "Esporte Litorâneo", played: 0, points: 0 },
];
