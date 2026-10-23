// Coach ranking persistence (ADR 0013, ADR 0017): the ledger of validated
// achievements and the live totals per user and scope, both written inside
// the career transaction; reads order the totals by index. The monthly
// history (`ranking_snapshots`) is only written when a month closes.
import {
  rankingMonthOf,
  userRankingEntries,
  type RankedAchievementType,
  type RankingLedgerEntry,
  type RankingScope,
} from '@footebas/domain';
import type postgres from 'postgres';
import type {
  AchievementLedgerPort,
  RankingBoard,
  RankingEnrollment,
  RankingPeriod,
  RankingPosition,
  RankingStorePort,
  ValidatedAchievement,
} from './ports.js';

type Sql = postgres.Sql | postgres.TransactionSql;

const iso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const day = (value: Date | string) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
/** Optional avatar column (null in rows written before it existed). */
const withAvatar = (avatar: string | null | undefined) =>
  avatar === null || avatar === undefined ? {} : { avatar };

interface AchievementRow {
  career_id: string;
  user_id: string;
  display_name: string;
  avatar: string | null;
  type: RankedAchievementType;
  season: number;
  competition_id: string;
  club_id: string;
  club_reputation: number;
  game_date: Date | string;
  points: number;
  rise_points: number;
  rules_version: string;
  recorded_at: Date | string;
}

const toLedgerEntry = (row: AchievementRow): RankingLedgerEntry => ({
  careerId: row.career_id,
  userId: row.user_id,
  displayName: row.display_name,
  ...withAvatar(row.avatar),
  type: row.type,
  season: row.season,
  competitionId: row.competition_id,
  points: row.points,
  risePoints: row.rise_points,
  recordedAt: iso(row.recorded_at),
});

/**
 * Creates the user's ranking account if missing (sign-ups before the
 * trigger) and links it to `career` while it has none. The upsert also locks
 * the account row, so two careers of the same user that commit at once
 * rebuild the totals one after the other.
 */
async function upsertPlayer(
  sql: Sql,
  career: RankingEnrollment,
): Promise<{ needsRefresh: boolean }> {
  const [row] = await sql<{ needs_refresh: boolean }[]>`
    insert into footebas.ranking_players
      (user_id, career_id, display_name, avatar)
    values (${career.userId}, ${career.careerId}, ${career.displayName},
      ${career.avatar ?? null})
    on conflict (user_id) do update set
      career_id = coalesce(ranking_players.career_id, excluded.career_id),
      display_name = case when ranking_players.career_id is null
        then excluded.display_name else ranking_players.display_name end,
      avatar = case when ranking_players.career_id is null
        then excluded.avatar else ranking_players.avatar end
    returning needs_refresh`;
  return { needsRefresh: row?.needs_refresh ?? false };
}

/**
 * Rebuilds the user's totals from their own ledger with the domain rules
 * (ADR 0017). `months` limits the monthly rows rebuilt (past months never
 * change); without it every row of the user is rebuilt.
 */
async function refreshUserTotals(
  sql: Sql,
  userId: string,
  months?: readonly string[],
): Promise<void> {
  const ledger = await sql<AchievementRow[]>`
    select * from footebas.validated_achievements
    where user_id = ${userId}
    order by recorded_at, id`;
  const entries = userRankingEntries(ledger.map(toLedgerEntry), months);
  await (months === undefined
    ? sql`delete from footebas.ranking_entries where user_id = ${userId}`
    : sql`
        delete from footebas.ranking_entries
        where user_id = ${userId}
          and (period = 'all' or period in ${sql([...months])})`);
  if (entries.length > 0)
    await sql`insert into footebas.ranking_entries ${sql(
      entries.map((entry) => ({
        scope: entry.scope,
        period: entry.period,
        user_id: entry.userId,
        career_id: entry.careerId,
        display_name: entry.displayName,
        avatar: entry.avatar ?? null,
        points: entry.points,
        titles: entry.titles,
        season: entry.season,
        reached_at: entry.reachedAt,
      })),
    )}`;
  // A full rebuild is what the migration's flag waits for.
  if (months === undefined)
    await sql`
      update footebas.ranking_players set needs_refresh = false
      where user_id = ${userId} and needs_refresh`;
}

/** Ledger bound to the career transaction (`PostgresUnitOfWork`). */
export class PostgresAchievementLedger implements AchievementLedgerPort {
  public constructor(private readonly sql: Sql) {}

  public async record(entries: readonly ValidatedAchievement[]): Promise<void> {
    if (entries.length === 0) return;
    await this.sql`
      insert into footebas.validated_achievements ${this.sql(
        entries.map((entry) => ({
          career_id: entry.careerId,
          user_id: entry.userId,
          display_name: entry.displayName,
          avatar: entry.avatar ?? null,
          type: entry.type,
          season: entry.season,
          competition_id: entry.competitionId,
          club_id: entry.clubId,
          club_reputation: entry.clubReputation,
          game_date: entry.gameDate,
          points: entry.points,
          rise_points: entry.risePoints,
          rules_version: entry.rulesVersion,
          recorded_at: entry.recordedAt,
        })),
      )}
      on conflict (career_id, type, season, competition_id) do nothing`;
    // Totals in the same transaction (ADR 0017): one account per user.
    const users = new Map<string, ValidatedAchievement>();
    for (const entry of entries) users.set(entry.userId, entry);
    for (const [userId, latest] of users) {
      const { needsRefresh } = await upsertPlayer(this.sql, latest);
      const months = [
        ...new Set(
          entries
            .filter((entry) => entry.userId === userId)
            .map(({ recordedAt }) => rankingMonthOf(recordedAt)),
        ),
      ];
      // An account the migration flagged was never built: build it whole.
      await refreshUserTotals(
        this.sql,
        userId,
        needsRefresh ? undefined : months,
      );
    }
  }

  public async enroll(career: RankingEnrollment): Promise<void> {
    await upsertPlayer(this.sql, career);
  }

  public async listByCareer(
    careerId: string,
  ): Promise<readonly ValidatedAchievement[]> {
    const rows = await this.sql<AchievementRow[]>`
      select * from footebas.validated_achievements
      where career_id = ${careerId}
      order by recorded_at, id`;
    return rows.map((row) => ({
      ...toLedgerEntry(row),
      clubId: row.club_id,
      clubReputation: row.club_reputation,
      gameDate: day(row.game_date),
      rulesVersion: row.rules_version,
    }));
  }
}

interface EntryRow {
  user_id: string;
  career_id: string | null;
  display_name: string | null;
  avatar: string | null;
  points: number;
  titles: number;
  season: number;
  position: number | null;
}

interface PositionRow extends EntryRow {
  scope: RankingScope;
  period: string;
  total: number;
}

export class PostgresRankingStore implements RankingStorePort {
  public constructor(private readonly sql: postgres.Sql) {}

  /**
   * Accounts with points, by index; then, while the page has room, the
   * accounts without points in sign-up order. Accounts without career count
   * in the positions and the total but are not listed.
   */
  public async board(
    scope: RankingScope,
    period: RankingPeriod,
    limit: number,
  ): Promise<RankingBoard> {
    const [counts] = await this.sql<{ total: number; scored: number }[]>`
      select
        (select count(*)::int from footebas.ranking_players) as total,
        (select count(*)::int from footebas.ranking_entries
          where scope = ${scope} and period = ${period}) as scored`;
    const total = counts?.total ?? 0;
    const scored = counts?.scored ?? 0;
    const rows = await this.sql<EntryRow[]>`
      select user_id, career_id, display_name, avatar, points, titles, season
      from footebas.ranking_entries
      where scope = ${scope} and period = ${period}
      -- Order of the standings (domain compareRankingTotals), as written in
      -- the expression index ranking_entries_rank_idx.
      order by -titles, -points, season, reached_at, user_id
      limit ${limit}`;
    const listed = rows.map((row, index) => ({ ...row, position: index + 1 }));
    if (listed.length < limit && total > scored) {
      const zeros = await this.sql<EntryRow[]>`
        select user_id, career_id, display_name, avatar,
          0 as points, 0 as titles, 0 as season, position::int as position
        from (
          select p.user_id, p.career_id, p.display_name, p.avatar,
            row_number() over (order by p.joined_at, p.user_id) as position
          from footebas.ranking_players p
          where not exists (
            select 1 from footebas.ranking_entries e
            where e.scope = ${scope} and e.period = ${period}
              and e.user_id = p.user_id)
        ) zeros
        where career_id is not null
        order by position
        limit ${limit - listed.length}`;
      listed.push(
        ...zeros.map((row) => ({
          ...row,
          position: scored + (row.position ?? 0),
        })),
      );
    }
    return {
      scope,
      period,
      total,
      rows: listed.flatMap((row) =>
        row.career_id === null || row.display_name === null
          ? []
          : [
              {
                position: row.position,
                userId: row.user_id,
                careerId: row.career_id,
                displayName: row.display_name,
                ...withAvatar(row.avatar),
                points: row.points,
                titles: row.titles,
                season: row.season,
              },
            ],
      ),
    };
  }

  /**
   * One statement for every scope: the user's row and how many rows rank
   * ahead of it; without points, every account with points plus the
   * accounts without points that signed up earlier.
   */
  public async positionsOf(
    userId: string,
    targets: readonly { scope: RankingScope; period: RankingPeriod }[],
  ): Promise<readonly RankingPosition[]> {
    const rows = await this.sql<PositionRow[]>`
      select t.scope, t.period, c.total, ${userId}::text as user_id,
        coalesce(e.career_id, p.career_id) as career_id,
        coalesce(e.display_name, p.display_name) as display_name,
        case when e.user_id is null then p.avatar else e.avatar end as avatar,
        coalesce(e.points, 0) as points,
        coalesce(e.titles, 0) as titles,
        coalesce(e.season, 0) as season,
        case
          when e.user_id is not null then 1 + (
            select count(*) from footebas.ranking_entries o
            where o.scope = t.scope and o.period = t.period
              and (-o.titles, -o.points, o.season, o.reached_at, o.user_id)
                < (-e.titles, -e.points, e.season, e.reached_at, e.user_id))
          when p.user_id is not null then 1 + (
            select count(*) from footebas.ranking_entries o
            where o.scope = t.scope and o.period = t.period) + (
            select count(*) from footebas.ranking_players q
            where (q.joined_at, q.user_id) < (p.joined_at, p.user_id)
              and not exists (
                select 1 from footebas.ranking_entries o
                where o.scope = t.scope and o.period = t.period
                  and o.user_id = q.user_id))
        end::int as position
      from unnest(
        ${this.sql.array(targets.map(({ scope }) => scope))}::text[],
        ${this.sql.array(targets.map(({ period }) => period))}::text[]
      ) as t(scope, period)
      cross join (
        select count(*)::int as total from footebas.ranking_players
      ) c
      left join footebas.ranking_players p on p.user_id = ${userId}
      left join footebas.ranking_entries e
        on e.scope = t.scope and e.period = t.period
          and e.user_id = ${userId}`;
    return targets.map(({ scope, period }) => {
      const row = rows.find(
        (item) => item.scope === scope && item.period === period,
      );
      return {
        scope,
        period,
        total: row?.total ?? 0,
        userId,
        ...(row?.position === null || row?.position === undefined
          ? {}
          : { position: row.position }),
        ...(row?.career_id === null ||
        row?.career_id === undefined ||
        row.display_name === null
          ? {}
          : { careerId: row.career_id, displayName: row.display_name }),
        ...withAvatar(row?.avatar),
        points: row?.points ?? 0,
        titles: row?.titles ?? 0,
        season: row?.season ?? 0,
      };
    });
  }

  /** Copies the final monthly standings into the history, once. */
  public async closeMonth(
    period: string,
    closedAt: string,
  ): Promise<number | undefined> {
    const closed = await this.sql<{ rows: number }[]>`
      select count(*)::int as rows from footebas.ranking_snapshots
      where scope = 'monthly' and period = ${period}`;
    if ((closed[0]?.rows ?? 0) > 0) return undefined;
    const written = await this.sql<{ rows: number }[]>`
      with inserted as (
        insert into footebas.ranking_snapshots
          (scope, period, position, user_id, career_id, display_name, avatar,
           points, generated_at)
        select 'monthly', period,
          row_number() over (
            order by -titles, -points, season, reached_at, user_id),
          user_id, career_id, display_name, avatar, points, ${closedAt}
        from footebas.ranking_entries
        where scope = 'monthly' and period = ${period}
        on conflict do nothing
        returning 1
      )
      select count(*)::int as rows from inserted`;
    return written[0]?.rows ?? 0;
  }

  /** Accounts flagged by the migration, each rebuilt in its own transaction. */
  public async refreshPending(limit: number): Promise<number> {
    const pending = await this.sql<{ user_id: string }[]>`
      select user_id from footebas.ranking_players
      where needs_refresh
      order by user_id
      limit ${limit}`;
    for (const { user_id: userId } of pending)
      await this.sql.begin(async (tx) => {
        // Locks the account like a commit with achievements does.
        await tx`
          select 1 from footebas.ranking_players
          where user_id = ${userId} for update`;
        await refreshUserTotals(tx, userId);
      });
    return pending.length;
  }
}
