-- Footebas: authoritative career storage (ADR 0006).
-- Only the API touches these tables, through its own database role; the
-- browser never reads or writes them, so RLS denies every client role.

create schema if not exists footebas;

create table footebas.game_saves (
  id text primary key,
  user_id text not null,
  snapshot jsonb not null,
  checksum text not null,
  seed text not null,
  versions jsonb not null,
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_saves_user_id_idx on footebas.game_saves (user_id, created_at);

create table footebas.command_receipts (
  career_id text not null,
  command_id text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (career_id, command_id)
);

-- Simulation jobs: Cloudflare Queues carries the job, this table keeps the
-- observable status (queued/running/succeeded/failed) for polling and SSE.
create table footebas.simulation_jobs (
  id text primary key,
  career_id text not null,
  user_id text not null,
  job jsonb not null,
  status jsonb,
  updated_at timestamptz not null default now()
);
create index simulation_jobs_career_idx on footebas.simulation_jobs (career_id);

alter table footebas.game_saves enable row level security;
alter table footebas.command_receipts enable row level security;
alter table footebas.simulation_jobs enable row level security;

revoke all on schema footebas from anon, authenticated;
revoke all on all tables in schema footebas from anon, authenticated;
