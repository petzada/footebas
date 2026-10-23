/**
 * Ranking global (docs/09 decision 10, ADR 0013). Mirrors `rankingReadModel`
 * (GET /v1/rankings, public) and `myRankingReadModel` (GET /v1/rankings/me).
 */
export type RankingScope = 'global' | 'rise' | 'monthly';

export interface RankingRow {
  readonly position: number;
  readonly displayName: string;
  /**
   * Coach avatar of the career: pixel id (`avatar-01`…`avatar-12`) or the
   * https URL of the coach's picture. Absent for older achievements.
   */
  readonly avatar?: string;
  readonly points: number;
}

export interface RankingView {
  readonly scope: RankingScope;
  /** `all` for global and rise, `YYYY-MM` for monthly. */
  readonly period: string;
  readonly generatedAt?: string;
  readonly total: number;
  readonly rows: readonly RankingRow[];
}

export interface MyRankingEntry {
  readonly scope: RankingScope;
  readonly period: string;
  readonly position?: number;
  readonly points?: number;
  readonly displayName?: string;
  readonly avatar?: string;
}

export interface RankingPort {
  leaderboard(scope: RankingScope, period?: string): Promise<RankingView>;
  /** Positions of the signed-in player; `null` when there is no session. */
  mine(): Promise<readonly MyRankingEntry[] | null>;
}

export const SCOPE_LABEL: Record<RankingScope, string> = {
  global: 'Global',
  rise: 'Ascensão',
  monthly: 'Mensal',
};

/** Snapshots change every 15 min and the edge caches 5 min; so do we. */
export const RANKING_CACHE_TTL_MS = 5 * 60 * 1000;

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

export function demoRankingView(
  scope: RankingScope,
  period = scope === 'monthly' ? currentPeriod() : 'all',
): RankingView {
  const base = scope === 'global' ? 420 : scope === 'rise' ? 260 : 100;
  return {
    scope,
    period,
    generatedAt: '2026-05-01T12:00:00.000Z',
    total: demoNames.length,
    rows: demoNames.map((displayName, index) => ({
      position: index + 1,
      displayName,
      // The last coach has no avatar yet: the screen shows the fallback.
      ...(index < demoNames.length - 1
        ? { avatar: `avatar-${String(index + 1).padStart(2, '0')}` }
        : {}),
      points: base - index * (scope === 'monthly' ? 9 : 35),
    })),
  };
}

export function createFakeRankingPort(
  options: { mine?: readonly MyRankingEntry[] | null; empty?: boolean } = {},
): RankingPort {
  return {
    async leaderboard(scope, period) {
      const view = demoRankingView(scope, period);
      return options.empty ? { ...view, total: 0, rows: [] } : view;
    },
    async mine() {
      return options.mine === undefined ? null : options.mine;
    },
  };
}
