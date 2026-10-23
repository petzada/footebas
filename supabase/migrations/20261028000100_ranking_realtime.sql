-- Footebas: real-time coach ranking (ADR 0017, replaces items 1, 7 and 8 of
-- ADR 0013). Additive: the ledger (validated_achievements) does not change;
-- the totals per user and scope live in ranking_entries, written by the API
-- in the same transaction as each achievement, and every account enters the
-- ranking with zero through a trigger on auth.users.
-- Only the API touches these tables, through its own database role; RLS
-- denies every client role. No personal data: the name shown is the coach
-- name chosen in the game (never the e-mail or the account name).

-- One row per account (the "linha de ranking" of ADR 0017). It counts in
-- the positions and in the total of participants; it is listed only once it
-- has a career: career_id/display_name/avatar come from the first career
-- (CreateCareer) and name the account while it has no points.
create table footebas.ranking_players (
  user_id text primary key,
  -- Sign-up instant: orders the accounts that have no points yet.
  joined_at timestamptz not null default now(),
  career_id text,
  display_name text
    check (display_name is null or char_length(display_name) between 1 and 80),
  avatar text check (avatar is null or char_length(avatar) between 1 and 500),
  -- Achievements validated before this migration: the API rebuilds the
  -- totals of these accounts from the ledger (cron, RankingStorePort
  -- refreshPending) with the same domain rules it uses on every commit.
  needs_refresh boolean not null default false,
  check ((career_id is null) = (display_name is null))
);
create index ranking_players_joined_idx
  on footebas.ranking_players (joined_at, user_id);
create index ranking_players_refresh_idx
  on footebas.ranking_players (user_id) where needs_refresh;

-- Best total of each user in each scope (the user's best career; careers do
-- not add up). Only totals with points exist: an account without a row
-- ranks with zero. `period` is `all` for general, titles, best_season and
-- rise, and `YYYY-MM` (UTC) for monthly. `titles` is filled only in the
-- titles scope and `season` only in best_season (0 elsewhere), so one order
-- serves every scope: titles desc, points desc, season, reached_at, user_id.
create table footebas.ranking_entries (
  scope text not null
    check (scope in ('general', 'titles', 'best_season', 'rise', 'monthly')),
  period text not null
    check (period = 'all' or period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  user_id text not null
    references footebas.ranking_players (user_id) on delete cascade,
  career_id text not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar text check (avatar is null or char_length(avatar) between 1 and 500),
  points integer not null check (points > 0),
  titles integer not null default 0 check (titles >= 0),
  season integer not null default 0 check (season >= 0),
  -- Instant the career reached this total (latest counted achievement).
  reached_at timestamptz not null,
  primary key (scope, period, user_id),
  check ((scope = 'monthly') = (period <> 'all'))
);
-- Leaderboard reads and positions: ORDER BY and the row comparison of
-- `/v1/rankings/me` use these same expressions.
create index ranking_entries_rank_idx on footebas.ranking_entries
  (scope, period, (-titles), (-points), season, reached_at, user_id);
create index ranking_entries_user_idx on footebas.ranking_entries (user_id);

alter table footebas.ranking_players enable row level security;
alter table footebas.ranking_entries enable row level security;
revoke all on all tables in schema footebas from anon, authenticated;

-- Every new account enters the ranking with zero (ADR 0017, item 4).
create or replace function footebas.enroll_ranking_player()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into footebas.ranking_players (user_id, joined_at)
  values (new.id::text, coalesce(new.created_at, now()))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function footebas.enroll_ranking_player()
  from public, anon, authenticated;

create trigger footebas_enroll_ranking_player
  after insert on auth.users
  for each row execute function footebas.enroll_ranking_player();

-- Backfill 1: every existing account.
insert into footebas.ranking_players (user_id, joined_at)
select id::text, coalesce(created_at, now()) from auth.users
on conflict (user_id) do nothing;

-- Backfill 2: users with validated achievements (also any that is missing
-- from auth.users), linked to the career of their latest achievement and
-- flagged so the API rebuilds their totals with the domain rules.
insert into footebas.ranking_players
  (user_id, joined_at, career_id, display_name, avatar, needs_refresh)
select distinct on (user_id)
  user_id, recorded_at, career_id, display_name, avatar, true
from footebas.validated_achievements
order by user_id, recorded_at desc, id desc
on conflict (user_id) do update set
  career_id = coalesce(ranking_players.career_id, excluded.career_id),
  display_name = coalesce(ranking_players.display_name, excluded.display_name),
  avatar = case when ranking_players.career_id is null
    then excluded.avatar else ranking_players.avatar end,
  needs_refresh = true;

-- ranking_snapshots stays only as the monthly history (closed on day 1 by
-- the cron). Global and rise snapshots, and the partial snapshot of the
-- month still open, are no longer read.
delete from footebas.ranking_snapshots
where scope <> 'monthly'
  or period >= to_char(now() at time zone 'utc', 'YYYY-MM');
