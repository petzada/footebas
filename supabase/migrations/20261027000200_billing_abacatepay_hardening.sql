-- Footebas: AbacatePay hardening (refunds/disputes made outside the app,
-- scheduled reconciliation). Additive only; safe to run on a live table.

-- `disputed`: the payer opened a PIX dispute (AbacatePay `transparent.disputed`
-- / `UNDER_DISPUTE`). The license is revoked while the money is contested.
alter table footebas.orders
  drop constraint if exists orders_refund_status_check;
alter table footebas.orders
  add constraint orders_refund_status_check
  check (refund_status in ('requested', 'confirmed', 'rejected', 'disputed'));

-- The 15-minute reconciliation cron reads recent orders whose provider state
-- may have moved without a webhook (pending/expired, refund in flight).
create index if not exists orders_reconcile_idx
  on footebas.orders (created_at)
  where provider_charge_id is not null
    and (status in ('pending', 'expired') or refund_status = 'requested');
