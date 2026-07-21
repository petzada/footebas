-- Initial server-authoritative save store. Code only: activation against Supabase is pending.
create table public.game_saves (
  id uuid primary key,
  user_id uuid not null,
  snapshot jsonb not null,
  checksum char(64) not null,
  seed text not null,
  engine_version text not null,
  rules_version text not null,
  content_version text not null,
  schema_version text not null,
  version integer not null default 1,
  created_at timestamptz(3) not null default now(),
  updated_at timestamptz(3) not null default now(),
  constraint game_saves_checksum_sha256_check check (checksum ~ '^[0-9a-f]{64}$'),
  constraint game_saves_seed_check check (length(btrim(seed)) > 0),
  constraint game_saves_versions_check check (
    length(btrim(engine_version)) > 0 and length(btrim(rules_version)) > 0 and
    length(btrim(content_version)) > 0 and length(btrim(schema_version)) > 0
  ),
  constraint game_saves_version_positive_check check (version > 0),
  constraint game_saves_instants_check check (updated_at >= created_at)
);

create index game_saves_user_updated_idx on public.game_saves (user_id, updated_at desc);

create table public.game_events (
  id bigint generated always as identity primary key,
  game_save_id uuid not null references public.game_saves(id) on delete cascade,
  ordinal integer not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz(3) not null default now(),
  constraint game_events_ordinal_check check (ordinal >= 0),
  constraint game_events_type_check check (length(btrim(event_type)) > 0),
  constraint game_events_save_ordinal_key unique (game_save_id, ordinal)
);
create index game_events_save_created_idx on public.game_events (game_save_id, created_at);

create table public.command_receipts (
  id bigint generated always as identity primary key,
  game_save_id uuid not null references public.game_saves(id) on delete cascade,
  command_id uuid not null,
  response jsonb not null,
  created_at timestamptz(3) not null default now(),
  constraint command_receipts_save_command_key unique (game_save_id, command_id)
);
create index command_receipts_save_created_idx on public.command_receipts (game_save_id, created_at);

alter table public.game_saves enable row level security;
alter table public.game_events enable row level security;
alter table public.command_receipts enable row level security;

-- Defense in depth. The service-role API remains the only canonical writer.
create policy game_saves_owner_select on public.game_saves for select to authenticated
  using ((select auth.uid()) = user_id);
create policy game_events_owner_select on public.game_events for select to authenticated
  using (exists (select 1 from public.game_saves s where s.id = game_save_id and s.user_id = (select auth.uid())));
create policy command_receipts_owner_select on public.command_receipts for select to authenticated
  using (exists (select 1 from public.game_saves s where s.id = game_save_id and s.user_id = (select auth.uid())));

-- No INSERT/UPDATE/DELETE policies are granted to authenticated: clients cannot mutate canonical state.
-- Repository transaction strategy:
--   select pg_advisory_xact_lock(hashtextextended(game_save_id::text, 0));
--   update game_saves set ..., version = version + 1
--     where id = game_save_id and user_id = owner_id and version = expected_version;
-- A zero-row update is an optimistic-concurrency conflict. The transaction-scoped advisory lock is
-- automatically released on commit/rollback. Keep simulation outside this short transaction.
