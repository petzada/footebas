-- Footebas: PIX provider switch to AbacatePay (ADR 0016). AbacatePay reads and
-- refunds a charge by its own id (`pix_char_…`), kept next to our correlation id.
alter table footebas.orders add column provider_charge_id text;
create index orders_provider_charge_idx
  on footebas.orders (provider_charge_id) where provider_charge_id is not null;
