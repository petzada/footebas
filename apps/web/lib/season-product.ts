/**
 * Temporada (docs/09): read-only season statistics. Mirrors
 * `careerSeasonReadModelSchema` (GET /v1/careers/:id/season); nothing here is
 * estimated on the client.
 */
export interface SeasonClubRef {
  readonly id: string;
  readonly name: string;
}

export interface SeasonLeader {
  readonly playerId: string;
  readonly playerName: string;
  readonly club?: SeasonClubRef;
  readonly appearances: number;
  readonly value: number;
}

export interface SeasonClubRecord {
  readonly club: SeasonClubRef;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
}

export interface SeasonPositions {
  readonly competitionId: string;
  readonly competition: string;
  readonly rounds: readonly {
    readonly round: number;
    readonly date: string;
    readonly position: number;
  }[];
}

export interface SeasonChampion {
  readonly competitionId: string;
  readonly competition: string;
  readonly club: SeasonClubRef;
}

export type SeasonAwardKind = 'top_scorer' | 'top_assists' | 'best_rating';

export interface SeasonAward {
  readonly kind: SeasonAwardKind;
  readonly playerId: string;
  readonly playerName: string;
  readonly club?: SeasonClubRef;
  readonly value: number;
}

export interface SeasonHistoryEntry {
  readonly season: number;
  readonly year: number;
  readonly club?: SeasonClubRecord;
  readonly champions: readonly SeasonChampion[];
  readonly awards: readonly SeasonAward[];
  readonly topScorers: readonly SeasonLeader[];
  readonly positions: readonly SeasonPositions[];
}

export interface SeasonView {
  readonly season: number;
  readonly year: number;
  readonly currentDate: string;
  /** `partial` for saves that started recording mid-season. */
  readonly coverage: 'complete' | 'partial';
  readonly club?: SeasonClubRecord;
  readonly topScorers: readonly SeasonLeader[];
  readonly topAssists: readonly SeasonLeader[];
  readonly topRatings: readonly SeasonLeader[];
  readonly minimumRatedAppearances: number;
  readonly positions: readonly SeasonPositions[];
  readonly champions: readonly SeasonChampion[];
  readonly awards: readonly SeasonAward[];
  readonly history: readonly SeasonHistoryEntry[];
}

export interface SeasonPort {
  load(): Promise<SeasonView>;
}

export const AWARD_LABEL: Record<SeasonAwardKind, string> = {
  top_scorer: 'Artilheiro',
  top_assists: 'Garçom',
  best_rating: 'Craque da temporada',
};

const club = (id: string, name: string): SeasonClubRef => ({ id, name });
const leader = (
  id: string,
  playerName: string,
  team: SeasonClubRef,
  appearances: number,
  value: number,
): SeasonLeader => ({
  playerId: id,
  playerName,
  club: team,
  appearances,
  value,
});

/** Offline demo season for the in-memory career. */
export function demoSeasonView(
  overrides: Partial<SeasonView> = {},
): SeasonView {
  const fla = club('club_fla', 'Flamengo');
  const pal = club('club_pal', 'Palmeiras');
  const cam = club('club_cam', 'Atlético Mineiro');
  const rounds = [3, 2, 4, 2, 1, 1, 2, 1, 1, 1].map((position, index) => ({
    round: index + 1,
    date: `2026-0${Math.min(9, 2 + Math.floor(index / 4))}-${String(
      (index * 7) % 28 || 1,
    ).padStart(2, '0')}`,
    position,
  }));
  return {
    season: 1,
    year: 2026,
    currentDate: '2026-05-03',
    coverage: 'complete',
    club: {
      club: fla,
      played: 10,
      won: 7,
      drawn: 2,
      lost: 1,
      goalsFor: 21,
      goalsAgainst: 8,
      goalDifference: 13,
    },
    topScorers: [
      leader('p_pedro', 'Pedro', fla, 10, 9),
      leader('p_flaco', 'Flaco López', pal, 10, 7),
      leader('p_hulk', 'Hulk', cam, 9, 6),
      leader('p_arrasca', 'Arrascaeta', fla, 10, 4),
    ],
    topAssists: [
      leader('p_arrasca', 'Arrascaeta', fla, 10, 7),
      leader('p_raphael', 'Raphael Veiga', pal, 10, 5),
      leader('p_gerson', 'Gerson', fla, 9, 4),
    ],
    topRatings: [
      leader('p_arrasca', 'Arrascaeta', fla, 10, 7.9),
      leader('p_pedro', 'Pedro', fla, 10, 7.6),
      leader('p_weverton', 'Weverton', pal, 10, 7.3),
    ],
    minimumRatedAppearances: 5,
    positions: [{ competitionId: 'serie_a', competition: 'Série A', rounds }],
    champions: [
      {
        competitionId: 'carioca',
        competition: 'Campeonato Carioca',
        club: fla,
      },
    ],
    awards: [
      {
        kind: 'top_scorer',
        playerId: 'p_pedro',
        playerName: 'Pedro',
        club: fla,
        value: 9,
      },
      {
        kind: 'top_assists',
        playerId: 'p_arrasca',
        playerName: 'Arrascaeta',
        club: fla,
        value: 7,
      },
      {
        kind: 'best_rating',
        playerId: 'p_arrasca',
        playerName: 'Arrascaeta',
        club: fla,
        value: 7.9,
      },
    ],
    history: [],
    ...overrides,
  };
}

export function createFakeSeasonPort(
  view: SeasonView = demoSeasonView(),
): SeasonPort {
  return { load: async () => structuredClone(view) };
}
