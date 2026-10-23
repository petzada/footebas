/**
 * Ranking de treinadores (docs/09 decision 10, ADR 0013, ADR 0017). Mirrors
 * `rankingReadModel` (GET /v1/rankings, public, live with up to 30 s of edge
 * cache) and `myRankingReadModel` (GET /v1/rankings/me).
 */
export type RankingScope =
  'general' | 'titles' | 'best_season' | 'rise' | 'monthly';

export const RANKING_SCOPES: readonly RankingScope[] = [
  'general',
  'titles',
  'best_season',
  'rise',
  'monthly',
];

export interface RankingRow {
  readonly position: number;
  readonly displayName: string;
  /**
   * Coach avatar of the career: pixel id (`avatar-01`…`avatar-12`) or the
   * https URL of the coach's picture. Absent for older achievements.
   */
  readonly avatar?: string;
  /** Points of the scope (0 for coaches who have not scored yet). */
  readonly points: number;
  /** Titles of the career (titles scope). */
  readonly titles?: number;
  /** Season of the best season (best_season scope). */
  readonly season?: number;
}

export interface RankingView {
  readonly scope: RankingScope;
  /** `all` for the all-time scopes, `YYYY-MM` for monthly. */
  readonly period: string;
  /** Instant the board was read (it is live). */
  readonly generatedAt?: string;
  /** Participants: every account, listed or not. */
  readonly total: number;
  readonly rows: readonly RankingRow[];
}

export interface MyRankingEntry {
  readonly scope: RankingScope;
  readonly period: string;
  /** Participants of the scope ("Nº de M"). */
  readonly total?: number;
  readonly position?: number;
  readonly points?: number;
  readonly titles?: number;
  readonly season?: number;
  readonly displayName?: string;
  readonly avatar?: string;
}

export interface RankingPort {
  leaderboard(scope: RankingScope, period?: string): Promise<RankingView>;
  /** Positions of the signed-in player; `null` when there is no session. */
  mine(): Promise<readonly MyRankingEntry[] | null>;
}

export const SCOPE_LABEL: Record<RankingScope, string> = {
  general: 'Geral',
  titles: 'Títulos',
  best_season: 'Melhor temporada',
  rise: 'Ascensão',
  monthly: 'Mensal',
};

/** The board is live and the edge keeps it up to 30 s; so do we. */
export const RANKING_CACHE_TTL_MS = 30 * 1000;

const integer = new Intl.NumberFormat('pt-BR');
/** `1234` → `1.234`. */
export const formatCount = (value: number): string => integer.format(value);

/** Real-world month (UTC) as `YYYY-MM`. */
export function currentPeriod(now: Date = new Date()): string {
  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The last `count` months ending at `now`, newest first. */
export function recentPeriods(count: number, now: Date = new Date()): string[] {
  const periods: string[] = [];
  for (let index = 0; index < count; index++) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1),
    );
    periods.push(currentPeriod(date));
  }
  return periods;
}

export function periodLabel(period: string): string {
  if (period === 'all') return 'Todo o período';
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Memoises leaderboards per scope and period for `ttlMs`. */
export function cachedRankingPort(
  port: RankingPort,
  options: { ttlMs?: number; now?: () => number } = {},
): RankingPort {
  const ttl = options.ttlMs ?? RANKING_CACHE_TTL_MS;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { at: number; value: Promise<RankingView> }>();
  return {
    leaderboard(scope, period) {
      const key = `${scope}:${period ?? ''}`;
      const hit = cache.get(key);
      if (hit && now() - hit.at < ttl) return hit.value;
      const value = port.leaderboard(scope, period);
      cache.set(key, { at: now(), value });
      value.catch(() => cache.delete(key));
      return value;
    },
    mine: () => port.mine(),
  };
}

const demoNames = [
  'Tite da Várzea',
  'Dona Zica',
  'Professor Jardel',
  'Mestre Ivan',
  'Capitã Marta',
  'Seu Oswaldo',
  'Bicho Papão',
  'Rei do Drible',
];

const DEMO_BASE: Record<RankingScope, number> = {
  general: 420,
  titles: 420,
  best_season: 210,
  rise: 260,
  monthly: 100,
};

export function demoRankingView(
  scope: RankingScope,
  period = scope === 'monthly' ? currentPeriod() : 'all',
): RankingView {
  const base = DEMO_BASE[scope];
  return {
    scope,
    period,
    generatedAt: '2026-05-01T12:00:00.000Z',
    // Every account counts, including the ones not listed yet.
    total: 1234,
    rows: demoNames.map((displayName, index) => ({
      position: index + 1,
      displayName,
      // The last coach has no avatar yet: the screen shows the fallback.
      ...(index < demoNames.length - 1
        ? { avatar: `avatar-${String(index + 1).padStart(2, '0')}` }
        : {}),
      points: Math.max(0, base - index * (scope === 'monthly' ? 9 : 35)),
      ...(scope === 'titles' ? { titles: Math.max(0, 6 - index) } : {}),
      ...(scope === 'best_season' ? { season: 1 + (index % 4) } : {}),
    })),
  };
}

export function createFakeRankingPort(
  options: { mine?: readonly MyRankingEntry[] | null; empty?: boolean } = {},
): RankingPort {
  return {
    async leaderboard(scope, period) {
      const view = demoRankingView(scope, period);
      return options.empty ? { ...view, rows: [] } : view;
    },
    async mine() {
      return options.mine === undefined ? null : options.mine;
    },
  };
}
