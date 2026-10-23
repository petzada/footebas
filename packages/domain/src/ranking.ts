/**
 * Coach ranking (docs/04, docs/09 decision 10, ADR 0013, ADR 0017). Pure
 * rules: points of a server-validated achievement, the totals of each scope
 * and the order of the standings. Storage and scheduling live in the
 * adapters; nothing here reads a clock.
 */
/**
 * `ranking-v2` (ADR 0017): same points as `ranking-v1`; titles count when the
 * competition ends instead of at the season close.
 */
export const RANKING_RULES_VERSION = 'ranking-v2' as const;

/**
 * Scopes of the ranking (ADR 0017): `general` (sum of points, formerly
 * "global"), `titles` (number of titles), `best_season` (best single season),
 * `rise` and `monthly` (ADR 0013).
 */
export const RANKING_SCOPES = [
  'general',
  'titles',
  'best_season',
  'rise',
  'monthly',
] as const;
export type RankingScope = (typeof RANKING_SCOPES)[number];

/** Period of the all-time scopes; the monthly one uses `YYYY-MM` (UTC). */
export const RANKING_ALL_TIME = 'all' as const;

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

/** Achievements that count as a title (league, cup, state, continental). */
export const TITLE_ACHIEVEMENT_TYPES = [
  'league_title',
  'cup_title',
  'state_title',
  'continental_title',
] as const satisfies readonly RankedAchievementType[];

export const isTitleAchievement = (type: RankedAchievementType): boolean =>
  (TITLE_ACHIEVEMENT_TYPES as readonly string[]).includes(type);

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

/** Points of one achievement (same table in ranking-v1 and ranking-v2). */
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

/**
 * Total of one career in one scope. The order of the standings reads the
 * fields in this order: `titles` (more first), `points` (more first),
 * `season` (older first), `reachedAt` (earlier first), then the ids.
 */
export interface CareerRankingTotal {
  readonly careerId: string;
  readonly userId: string;
  readonly displayName: string;
  /** Latest avatar the career recorded, if any. */
  readonly avatar?: string;
  /**
   * Measure of the scope: points (`general`, `monthly`, and the tiebreak of
   * `titles`), rise points (`rise`) or the points of the best season
   * (`best_season`).
   */
  readonly points: number;
  /** Titles of the career in the `titles` scope; 0 in the others. */
  readonly titles: number;
  /** Season of the best season in `best_season`; 0 in the others. */
  readonly season: number;
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
  readonly titles: number;
  readonly season: number;
}

/** `YYYY-MM` (UTC) of an instant; the monthly period of an achievement. */
export const rankingMonthOf = (instant: string): string =>
  new Date(instant).toISOString().slice(0, 7);

/** Order of the standings (see {@link CareerRankingTotal}). */
export const compareRankingTotals = (
  left: CareerRankingTotal,
  right: CareerRankingTotal,
): number =>
  right.titles - left.titles ||
  right.points - left.points ||
  left.season - right.season ||
  left.reachedAt.localeCompare(right.reachedAt) ||
  left.userId.localeCompare(right.userId) ||
  left.careerId.localeCompare(right.careerId);

interface CareerIdentity {
  readonly userId: string;
  displayName: string;
  nameAt: string;
  avatar?: string;
  avatarAt?: string;
}

/**
 * Name and avatar shown for each career: the latest ones it recorded,
 * whatever the order of the entries (mirrors the SQL of the adapters). An
 * entry without avatar (written before it was recorded) keeps the known one.
 */
function careerIdentities(
  entries: readonly RankingLedgerEntry[],
): Map<string, CareerIdentity> {
  const identities = new Map<string, CareerIdentity>();
  for (const entry of entries) {
    const known = identities.get(entry.careerId);
    if (known === undefined) {
      identities.set(entry.careerId, {
        userId: entry.userId,
        displayName: entry.displayName,
        nameAt: entry.recordedAt,
        ...(entry.avatar === undefined
          ? {}
          : { avatar: entry.avatar, avatarAt: entry.recordedAt }),
      });
      continue;
    }
    if (entry.recordedAt >= known.nameAt) {
      known.displayName = entry.displayName;
      known.nameAt = entry.recordedAt;
    }
    if (
      entry.avatar !== undefined &&
      (known.avatarAt === undefined || entry.recordedAt >= known.avatarAt)
    ) {
      known.avatar = entry.avatar;
      known.avatarAt = entry.recordedAt;
    }
  }
  return identities;
}

interface Sum {
  points: number;
  titles: number;
  reachedAt: string;
}

const add = (
  sums: Map<string, Sum>,
  key: string,
  entry: RankingLedgerEntry,
  value: number,
) => {
  const current = sums.get(key);
  const title = isTitleAchievement(entry.type) ? 1 : 0;
  sums.set(key, {
    points: (current?.points ?? 0) + value,
    titles: (current?.titles ?? 0) + title,
    reachedAt:
      current === undefined || entry.recordedAt > current.reachedAt
        ? entry.recordedAt
        : current.reachedAt,
  });
};

/**
 * Stage 1: total per career in a scope (ADR 0017). `general` and `titles`
 * sum points (`titles` also counts the titles), `rise` sums rise points,
 * `monthly` sums points recorded in `period` (`YYYY-MM`) and `best_season`
 * keeps the season with most points (older season on a tie). Careers without
 * points in the scope are left out: they rank with zero, like any account.
 */
export function careerRankingTotals(
  entries: readonly RankingLedgerEntry[],
  scope: RankingScope,
  period?: string,
): CareerRankingTotal[] {
  const identities = careerIdentities(entries);
  // Key: career, or career + season for the best season.
  const sums = new Map<string, Sum>();
  for (const entry of entries) {
    if (scope === 'monthly' && rankingMonthOf(entry.recordedAt) !== period)
      continue;
    const value = scope === 'rise' ? entry.risePoints : entry.points;
    if (value <= 0) continue;
    add(
      sums,
      scope === 'best_season'
        ? `${entry.careerId}\u0000${String(entry.season)}`
        : entry.careerId,
      entry,
      value,
    );
  }
  const totals = new Map<string, CareerRankingTotal>();
  for (const [key, sum] of sums) {
    const [careerId = key, season = '0'] = key.split('\u0000');
    const identity = identities.get(careerId);
    if (identity === undefined) continue;
    const total: CareerRankingTotal = {
      careerId,
      userId: identity.userId,
      displayName: identity.displayName,
      ...(identity.avatar === undefined ? {} : { avatar: identity.avatar }),
      points: sum.points,
      titles: scope === 'titles' ? sum.titles : 0,
      season: scope === 'best_season' ? Number(season) : 0,
      reachedAt: sum.reachedAt,
    };
    const current = totals.get(careerId);
    if (current === undefined || compareRankingTotals(total, current) < 0)
      totals.set(careerId, total);
  }
  return [...totals.values()];
}

/** Best career of each user (one career per user, ADR 0013 and 0017). */
export function bestCareerPerUser(
  totals: readonly CareerRankingTotal[],
): CareerRankingTotal[] {
  const best = new Map<string, CareerRankingTotal>();
  for (const total of totals) {
    const current = best.get(total.userId);
    if (current === undefined || compareRankingTotals(total, current) < 0)
      best.set(total.userId, total);
  }
  return [...best.values()].sort(compareRankingTotals);
}

const toRow = (total: CareerRankingTotal, index: number): RankingRow => ({
  position: index + 1,
  userId: total.userId,
  careerId: total.careerId,
  displayName: total.displayName,
  ...(total.avatar === undefined ? {} : { avatar: total.avatar }),
  points: total.points,
  titles: total.titles,
  season: total.season,
});

/**
 * Stage 2: one row per user (their best career) in the order of the
 * standings. Positions are 1-based and unique.
 */
export function rankCareerTotals(
  totals: readonly CareerRankingTotal[],
): RankingRow[] {
  return bestCareerPerUser(totals).map(toRow);
}

/** Both stages over a ledger. */
export function aggregateRanking(
  entries: readonly RankingLedgerEntry[],
  scope: RankingScope,
  period?: string,
): RankingRow[] {
  return rankCareerTotals(careerRankingTotals(entries, scope, period));
}

/** Best total of a user in one scope and period. */
export interface UserRankingEntry extends CareerRankingTotal {
  readonly scope: RankingScope;
  readonly period: string;
}

/**
 * Every total a user holds (ADR 0017): the four all-time scopes and each
 * month with points, from the user's own ledger. This is what the adapters
 * store per user and scope in the transaction of each achievement. Pass
 * `months` to compute only those months (past months never change).
 */
export function userRankingEntries(
  entries: readonly RankingLedgerEntry[],
  months?: readonly string[],
): UserRankingEntry[] {
  const targets: { scope: RankingScope; period: string }[] = (
    ['general', 'titles', 'best_season', 'rise'] as const
  ).map((scope) => ({ scope, period: RANKING_ALL_TIME }));
  const scored = new Set(
    entries
      .filter(({ points }) => points > 0)
      .map(({ recordedAt }) => rankingMonthOf(recordedAt)),
  );
  for (const month of [...scored].sort())
    if (months === undefined || months.includes(month))
      targets.push({ scope: 'monthly', period: month });
  return targets.flatMap(({ scope, period }) =>
    bestCareerPerUser(careerRankingTotals(entries, scope, period)).map(
      (total) => ({ ...total, scope, period }),
    ),
  );
}

/**
 * An account of the ranking (ADR 0017): every user enters with zero when
 * signing up. `careerId` and `displayName` come from the first career; an
 * account without career counts in positions and totals but is not listed.
 */
export interface RankingPlayer {
  readonly userId: string;
  /** Sign-up instant; orders the accounts that have no points yet. */
  readonly joinedAt: string;
  readonly careerId?: string;
  readonly displayName?: string;
  readonly avatar?: string;
}

/** One position of the full standings, with or without points. */
export interface RankingStanding {
  readonly position: number;
  readonly userId: string;
  /** Absent for accounts without career (counted, never listed). */
  readonly careerId?: string;
  readonly displayName?: string;
  readonly avatar?: string;
  readonly points: number;
  readonly titles: number;
  readonly season: number;
}

/**
 * Full standings of a scope: users with points in rank order, then every
 * other account with zero, in sign-up order (then user id). Every account is
 * a participant; users with points that are missing from `players` join
 * them (they have a career by definition).
 */
export function rankingStandings(
  rows: readonly RankingRow[],
  players: readonly RankingPlayer[],
): RankingStanding[] {
  const scored = new Set(rows.map(({ userId }) => userId));
  const zeros = players
    .filter(({ userId }) => !scored.has(userId))
    .sort(
      (left, right) =>
        left.joinedAt.localeCompare(right.joinedAt) ||
        left.userId.localeCompare(right.userId),
    );
  return [
    ...rows.map((row, index) => ({ ...row, position: index + 1 })),
    ...zeros.map((player, index) => ({
      position: rows.length + index + 1,
      userId: player.userId,
      ...(player.careerId === undefined || player.displayName === undefined
        ? {}
        : { careerId: player.careerId, displayName: player.displayName }),
      ...(player.avatar === undefined || player.careerId === undefined
        ? {}
        : { avatar: player.avatar }),
      points: 0,
      titles: 0,
      season: 0,
    })),
  ];
}
