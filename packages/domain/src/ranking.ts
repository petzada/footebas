/**
 * Global coach ranking (docs/04, docs/09 decision 10, ADR 0013). Pure rules:
 * points of a server-validated achievement and the aggregation that turns a
 * ledger of achievements into ranked rows. Storage and scheduling live in
 * the adapters; nothing here reads a clock.
 */
export const RANKING_RULES_VERSION = 'ranking-v1' as const;

export const RANKING_SCOPES = ['global', 'rise', 'monthly'] as const;
export type RankingScope = (typeof RANKING_SCOPES)[number];

export const RANKED_ACHIEVEMENT_TYPES = [
  'league_title',
  'cup_title',
  'state_title',
  'continental_title',
  'promotion',
  'season_completed',
] as const;
export type RankedAchievementType = (typeof RANKED_ACHIEVEMENT_TYPES)[number];
export type RankingDivision = 'serie-a' | 'serie-b' | 'serie-c';

const LEAGUE_TITLE_POINTS: Readonly<Record<RankingDivision, number>> =
  Object.freeze({ 'serie-a': 100, 'serie-b': 60, 'serie-c': 40 });
const POINTS: Readonly<
  Record<Exclude<RankedAchievementType, 'league_title'>, number>
> = Object.freeze({
  continental_title: 180,
  cup_title: 70,
  state_title: 25,
  promotion: 45,
  season_completed: 5,
});

/** Clubs above this reputation earn nothing in the rise ranking. */
export const RISE_MAX_REPUTATION = 65;
/** Reputation floor of the rise multiplier (smaller clubs count as this). */
export const RISE_MIN_REPUTATION = 35;

/** Global points of one achievement (ranking-v1). */
export function rankingPoints(
  type: RankedAchievementType,
  division?: RankingDivision,
): number {
  return type === 'league_title'
    ? LEAGUE_TITLE_POINTS[division ?? 'serie-a']
    : POINTS[type];
}

/**
 * Rise ("ascensão") points: feats of small clubs. Only titles and promotions
 * of clubs with reputation up to {@link RISE_MAX_REPUTATION} count, scaled by
 * `1 + (65 − reputation) / 15` (reputation floored at 35: up to 3×).
 */
export function risePoints(
  type: RankedAchievementType,
  points: number,
  clubReputation: number,
): number {
  if (type === 'season_completed' || clubReputation > RISE_MAX_REPUTATION)
    return 0;
  const reputation = Math.max(RISE_MIN_REPUTATION, clubReputation);
  return Math.round(points * (1 + (RISE_MAX_REPUTATION - reputation) / 15));
}

/** One validated achievement as the ledger stores it. */
export interface RankingLedgerEntry {
  readonly careerId: string;
  readonly userId: string;
  readonly displayName: string;
  /**
   * Coach avatar of the career when it was recorded: a pixel avatar id or
   * the https URL of the coach's picture. Absent in older entries.
   */
  readonly avatar?: string;
  readonly type: RankedAchievementType;
  readonly season: number;
  readonly competitionId: string;
  readonly points: number;
  readonly risePoints: number;
  /** Server instant of the commit that validated it (ISO 8601, UTC). */
  readonly recordedAt: string;
}

export interface CareerRankingTotal {
  readonly careerId: string;
  readonly userId: string;
  readonly displayName: string;
  /** Latest avatar the career recorded, if any. */
  readonly avatar?: string;
  readonly points: number;
  /** Instant the career reached its total (latest counted achievement). */
  readonly reachedAt: string;
}

export interface RankingRow {
  readonly position: number;
  readonly userId: string;
  readonly careerId: string;
  readonly displayName: string;
  readonly avatar?: string;
  readonly points: number;
}

/** `YYYY-MM` (UTC) of an instant; the monthly period of an achievement. */
export const rankingMonthOf = (instant: string): string =>
  new Date(instant).toISOString().slice(0, 7);

/**
 * Stage 1: total per career in a scope. `global` sums points, `rise` sums
 * rise points and `monthly` sums points recorded in `period` (`YYYY-MM`).
 * Careers without points in the scope are left out.
 */
export function careerRankingTotals(
  entries: readonly RankingLedgerEntry[],
  scope: RankingScope,
  period?: string,
): CareerRankingTotal[] {
  const totals = new Map<string, CareerRankingTotal>();
  // Instant of the avatar kept per career: the avatar shown is the latest
  // one recorded, whatever the order of the entries (mirrors the SQL stage).
  const avatarAt = new Map<string, string>();
  for (const entry of entries) {
    if (scope === 'monthly' && rankingMonthOf(entry.recordedAt) !== period)
      continue;
    const value = scope === 'rise' ? entry.risePoints : entry.points;
    if (value <= 0) continue;
    const current = totals.get(entry.careerId);
    const newer =
      current === undefined || entry.recordedAt >= current.reachedAt;
    // Entries without an avatar (written before it was recorded) keep the
    // one already known instead of erasing it.
    const knownAt = avatarAt.get(entry.careerId);
    const newerAvatar =
      entry.avatar !== undefined &&
      (knownAt === undefined || entry.recordedAt >= knownAt);
    if (newerAvatar) avatarAt.set(entry.careerId, entry.recordedAt);
    const avatar = newerAvatar ? entry.avatar : current?.avatar;
    totals.set(entry.careerId, {
      careerId: entry.careerId,
      userId: entry.userId,
      // The name shown is the latest one the career recorded.
      displayName: newer ? entry.displayName : current.displayName,
      ...(avatar === undefined ? {} : { avatar }),
      points: (current?.points ?? 0) + value,
      reachedAt: newer ? entry.recordedAt : current.reachedAt,
    });
  }
  return [...totals.values()];
}

const byRank = (left: CareerRankingTotal, right: CareerRankingTotal) =>
  right.points - left.points ||
  left.reachedAt.localeCompare(right.reachedAt) ||
  left.userId.localeCompare(right.userId) ||
  left.careerId.localeCompare(right.careerId);

/**
 * Stage 2: one row per user (their best career), ordered by points, then by
 * who reached the total first, then by user id. Positions are 1-based and
 * unique.
 */
export function rankCareerTotals(
  totals: readonly CareerRankingTotal[],
): RankingRow[] {
  const best = new Map<string, CareerRankingTotal>();
  for (const total of totals) {
    const current = best.get(total.userId);
    if (current === undefined || byRank(total, current) < 0)
      best.set(total.userId, total);
  }
  return [...best.values()].sort(byRank).map((total, index) => ({
    position: index + 1,
    userId: total.userId,
    careerId: total.careerId,
    displayName: total.displayName,
    ...(total.avatar === undefined ? {} : { avatar: total.avatar }),
    points: total.points,
  }));
}

/** Both stages over a ledger. */
export function aggregateRanking(
  entries: readonly RankingLedgerEntry[],
  scope: RankingScope,
  period?: string,
): RankingRow[] {
  return rankCareerTotals(careerRankingTotals(entries, scope, period));
}
