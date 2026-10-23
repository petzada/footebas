-- Footebas Fase 8: licença única via Woovi/PIX.
-- Only the API touches these tables, through its own database role; the
-- browser never reads or writes them, so RLS denies every client role.
-- Payloads are stored with personal data (CPF, payer, bank accounts) removed
-- by the API before insert (LGPD: keep only what reconciliation needs).

create schema if not exists footebas;

-- One row per checkout attempt. `correlation_id` is the Woovi charge
-- correlationID (unique and idempotent per order).
create table footebas.orders (
  id text primary key,
  user_id text not null,
  correlation_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'refunded')),
  woovi_charge jsonb,
  br_code text,
  qr_code_image text,
  payment_link_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  pix_end_to_end_id text,
  refund_status text
    check (refund_status in ('requested', 'confirmed', 'rejected')),
  refund_attempts integer not null default 0 check (refund_attempts >= 0),
  refund_correlation_id text unique,
  refund_end_to_end_id text,
  refund_payload jsonb,
  refund_requested_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- At most one open checkout per user: concurrent checkouts reuse it.
create unique index orders_one_pending_per_user
  on footebas.orders (user_id) where status = 'pending';
create index orders_user_created_idx on footebas.orders (user_id, created_at desc);
create index orders_pix_e2e_idx
  on footebas.orders (pix_end_to_end_id) where pix_end_to_end_id is not null;
create index orders_refund_e2e_idx
  on footebas.orders (refund_end_to_end_id) where refund_end_to_end_id is not null;

-- Woovi webhook deliveries. Woovi sends no event id, so the API derives a
-- stable key (event type + charge correlationID or refund endToEndId) and the
-- primary key makes redeliveries no-ops.
create table footebas.webhook_events (
  id text primary key,
  provider text not null default 'woovi',
  type text not null,
  payload jsonb not null,
  outcome text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- The entitlement source of truth: an `active` row means plan `licensed`.
create table footebas.licenses (
  user_id text primary key,
  order_id text not null references footebas.orders (id),
  status text not null check (status in ('active', 'revoked')),
  granted_at timestamptz not null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);
create index licenses_order_idx on footebas.licenses (order_id);

alter table footebas.orders enable row level security;
alter table footebas.webhook_events enable row level security;
alter table footebas.licenses enable row level security;

revoke all on schema footebas from anon, authenticated;
revoke all on all tables in schema footebas from anon, authenticated;
