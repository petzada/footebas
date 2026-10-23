// Global ranking persistence (ADR 0013): the ledger of validated
// achievements, written inside the career transaction, and the leaderboard
// snapshots that the scheduled job regenerates (ADR 0005: snapshots in
// Postgres served with cache).
import {
  rankCareerTotals,
  type RankedAchievementType,
  type RankingRow,
  type RankingScope,
} from '@footebas/domain';
import type postgres from 'postgres';
import type {
  AchievementLedgerPort,
  RankingPeriod,
  RankingSnapshot,
  RankingSnapshotRow,
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

/** Ledger bound to the career transaction (`PostgresUnitOfWork`). */
export class PostgresAchievementLedger implements AchievementLedgerPort {
  public constructor(private readonly sql: Sql) {}

  public async record(entries: readonly ValidatedAchievement[]): Promise<void> {
    for (const entry of entries)
      await this.sql`
        insert into footebas.validated_achievements
          (career_id, user_id, display_name, avatar, type, season,
           competition_id, club_id, club_reputation, game_date, points,
           rise_points, rules_version, recorded_at)
        values (
          ${entry.careerId}, ${entry.userId}, ${entry.displayName},
          ${entry.avatar ?? null}, ${entry.type}, ${entry.season}, ${entry.competitionId},
          ${entry.clubId}, ${entry.clubReputation}, ${entry.gameDate},
          ${entry.points}, ${entry.risePoints}, ${entry.rulesVersion},
          ${entry.recordedAt}
        )
        on conflict (career_id, type, season, competition_id) do nothing`;
  }

  public async listByCareer(
    careerId: string,
  ): Promise<readonly ValidatedAchievement[]> {
    const rows = await this.sql<AchievementRow[]>`
      select * from footebas.validated_achievements
      where career_id = ${careerId}
      order by recorded_at, id`;
    return rows.map((row) => ({
      careerId: row.career_id,
      userId: row.user_id,
      displayName: row.display_name,
      ...withAvatar(row.avatar),
      type: row.type,
      season: row.season,
      competitionId: row.competition_id,
      clubId: row.club_id,
      clubReputation: row.club_reputation,
      gameDate: day(row.game_date),
      points: row.points,
      risePoints: row.rise_points,
      rulesVersion: row.rules_version,
      recordedAt: iso(row.recorded_at),
    }));
  }
}

interface TotalRow {
  career_id: string;
  user_id: string;
  display_name: string;
  avatar: string | null;
  points: number;
  reached_at: Date | string;
}

interface SnapshotRow {
  scope: RankingScope;
  period: string;
  position: number;
  user_id: string;
  career_id: string;
  display_name: string;
  avatar: string | null;
  points: number;
  generated_at: Date | string;
}

const toRankingRow = (row: SnapshotRow): RankingRow => ({
  position: row.position,
  userId: row.user_id,
  careerId: row.career_id,
  displayName: row.display_name,
  ...withAvatar(row.avatar),
  points: row.points,
});

/** Month bounds `[start, end)` of a `YYYY-MM` period, in UTC. */
function monthBounds(period: string): [string, string] {
  const [year, month] = period.split('-').map(Number) as [number, number];
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  return [start, end];
}

const SNAPSHOT_INSERT_CHUNK = 500;

export class PostgresRankingStore implements RankingStorePort {
  public constructor(private readonly sql: postgres.Sql) {}

  /** Stage 1 (per-career totals) in SQL, stage 2 in the domain rule. */
  public async aggregate(
    scope: RankingScope,
    period?: string,
  ): Promise<RankingRow[]> {
    const points = scope === 'rise' ? this.sql`rise_points` : this.sql`points`;
    const window =
      scope === 'monthly' && period !== undefined
        ? this.sql`and recorded_at >= ${monthBounds(period)[0]}
                   and recorded_at < ${monthBounds(period)[1]}`
        : this.sql``;
    const rows = await this.sql<TotalRow[]>`
      select career_id, user_id,
        (array_agg(display_name order by recorded_at desc, id desc))[1]
          as display_name,
        (array_agg(avatar order by recorded_at desc, id desc)
          filter (where avatar is not null))[1] as avatar,
        sum(${points})::int as points,
        max(recorded_at) as reached_at
      from footebas.validated_achievements
      where ${points} > 0 ${window}
      group by career_id, user_id`;
    return rankCareerTotals(
      rows.map((row) => ({
        careerId: row.career_id,
        userId: row.user_id,
        displayName: row.display_name,
        ...withAvatar(row.avatar),
        points: row.points,
        reachedAt: iso(row.reached_at),
      })),
    );
  }

  public async replaceSnapshot(
    scope: RankingScope,
    period: RankingPeriod,
    rows: readonly RankingRow[],
    generatedAt: string,
  ): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx`
        delete from footebas.ranking_snapshots
        where scope = ${scope} and period = ${period}`;
      for (let start = 0; start < rows.length; start += SNAPSHOT_INSERT_CHUNK) {
        const chunk = rows
          .slice(start, start + SNAPSHOT_INSERT_CHUNK)
          .map((row) => ({
            scope,
            period,
            position: row.position,
            user_id: row.userId,
            career_id: row.careerId,
            display_name: row.displayName,
            avatar: row.avatar ?? null,
            points: row.points,
            generated_at: generatedAt,
          }));
        await tx`insert into footebas.ranking_snapshots ${tx(chunk)}`;
      }
    });
  }

  public async snapshot(
    scope: RankingScope,
    period: RankingPeriod,
    limit: number,
  ): Promise<RankingSnapshot | undefined> {
    const meta = await this.sql<
      { total: number; generated_at: Date | string | null }[]
    >`
      select count(*)::int as total, max(generated_at) as generated_at
      from footebas.ranking_snapshots
      where scope = ${scope} and period = ${period}`;
    const header = meta[0];
    const generatedAt = header?.generated_at ?? null;
    if (header === undefined || generatedAt === null || header.total === 0)
      return undefined;
    const rows = await this.sql<SnapshotRow[]>`
      select * from footebas.ranking_snapshots
      where scope = ${scope} and period = ${period}
      order by position
      limit ${limit}`;
    return {
      scope,
      period,
      generatedAt: iso(generatedAt),
      total: header.total,
      rows: rows.map(toRankingRow),
    };
  }

  public async positionsOf(
    userId: string,
    snapshots: readonly { scope: RankingScope; period: RankingPeriod }[],
  ): Promise<readonly RankingSnapshotRow[]> {
    const rows = await this.sql<SnapshotRow[]>`
      select * from footebas.ranking_snapshots
      where user_id = ${userId}`;
    return snapshots.flatMap(({ scope, period }) => {
      const row = rows.find(
        (item) => item.scope === scope && item.period === period,
      );
      return row === undefined
        ? []
        : [
            {
              ...toRankingRow(row),
              scope,
              period,
              generatedAt: iso(row.generated_at),
            },
          ];
    });
  }
}
