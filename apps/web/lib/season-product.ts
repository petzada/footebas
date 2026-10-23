/**
 * Temporada (docs/09): read-only season statistics. Mirrors
 * `careerSeasonReadModelSchema` (GET /v1/careers/:id/season); nothing here is
 * estimated on the client.
 */
import type { Phase4View } from '@/lib/phase4-model';

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
  /** Date of the deciding match (champions of the running season). */
  readonly decidedOn?: string;
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

type WorldHistory = Phase4View['history'];

function finishOf(
  positions: readonly SeasonPositions[],
  record: SeasonClubRecord | undefined,
  current: boolean,
): string {
  const league = positions.find(({ rounds }) => rounds.length > 0);
  const last = league?.rounds.at(-1);
  const place = last
    ? `${String(last.position)}º na ${league!.competition}`
    : '';
  const campaign =
    record && record.played > 0
      ? `${String(record.won)}V ${String(record.drawn)}E ${String(record.lost)}D`
      : '';
  const text = [place, campaign].filter(Boolean).join(' · ');
  if (current)
    return text ? `${text} · em andamento` : 'Em andamento · sem jogos';
  return text || 'Temporada encerrada';
}

function scorerOf(
  scorers: readonly SeasonLeader[],
  clubId: string | undefined,
): string {
  const best = scorers.find((leader) => leader.club?.id === clubId);
  if (!best || best.value <= 0) return 'Sem artilheiro';
  return `${best.playerName} · ${String(best.value)} ${best.value === 1 ? 'gol' : 'gols'}`;
}

function awardValue(award: SeasonAward): string {
  return award.kind === 'best_rating'
    ? award.value.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : `${String(award.value)} ${award.kind === 'top_scorer' ? 'gols' : 'assist.'}`;
}

/**
 * Histórico fed by the season read model (`GET /v1/careers/:id/season`):
 * one row per season (current one included), champions and awards, merged
 * with the career milestones the world read model already carries. The
 * HTTP adapter left `seasons` empty, so the screen showed nothing until a
 * title happened.
 */
export function worldHistoryFromSeason(
  view: SeasonView,
  base: WorldHistory,
): WorldHistory {
  const clubId = view.club?.club.id;
  const entries = [
    {
      season: view.season,
      year: view.year,
      club: view.club,
      champions: view.champions,
      awards: view.awards,
      topScorers: view.topScorers,
      positions: view.positions,
      current: true,
    },
    ...[...view.history]
      .sort((left, right) => right.season - left.season)
      .map((entry) => ({ ...entry, current: false })),
  ];
  const seasons = entries
    .filter((entry) => entry.club || entry.positions.length > 0)
    .map((entry) => ({
      season: String(entry.year),
      club: entry.club?.club.name ?? '—',
      finish: finishOf(entry.positions, entry.club, entry.current),
      topScorer: scorerOf(entry.topScorers, entry.club?.club.id ?? clubId),
    }));
  const known = new Set(seasons.map(({ season }) => season));
  const champions = entries.flatMap((entry) =>
    entry.champions.map((champion) => ({
      key: `${String(entry.season)}|${champion.competitionId}`,
      season: String(entry.year),
      competition: champion.competition,
      club: champion.club.name,
    })),
  );
  const seen = new Set(champions.map(({ key }) => key));
  const records = entries.flatMap((entry) =>
    entry.awards.map((award) => ({
      label: `${AWARD_LABEL[award.kind]} ${String(entry.year)}${entry.current ? ' (parcial)' : ''}`,
      value: awardValue(award),
      holder: award.club
        ? `${award.playerName} (${award.club.name})`
        : award.playerName,
    })),
  );
  const goals = new Map<string, { name: string; goals: number }>();
  for (const entry of entries)
    for (const leader of entry.topScorers)
      if (leader.club?.id === clubId && leader.value > 0) {
        const total = goals.get(leader.playerId) ?? {
          name: leader.playerName,
          goals: 0,
        };
        total.goals += leader.value;
        goals.set(leader.playerId, total);
      }
  const idols = [...goals.values()]
    .sort((left, right) => right.goals - left.goals)
    .slice(0, 3)
    .map(({ name, goals: total }) => ({
      name,
      reason: `Artilheiro do clube · ${String(total)} ${total === 1 ? 'gol' : 'gols'}`,
    }));
  return {
    seasons: [
      ...seasons,
      ...base.seasons.filter(({ season }) => !known.has(season)),
    ],
    champions: [
      ...champions.map(({ season, competition, club }) => ({
        season,
        competition,
        club,
      })),
      ...base.champions.filter(
        ({ season, competition }) => !seen.has(`${season}|${competition}`),
      ),
    ],
    records: [...records, ...base.records],
    idols: [
      ...idols,
      ...base.idols.filter(
        ({ name }) => !idols.some((idol) => idol.name === name),
      ),
    ],
  };
}

export function createFakeSeasonPort(
  view: SeasonView = demoSeasonView(),
): SeasonPort {
  return { load: async () => structuredClone(view) };
}
