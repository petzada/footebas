-- Footebas: owner-deleted careers are archived to free their plan slot
-- (docs/09 decision 5). Archived saves stay invisible to every read.
alter table footebas.game_saves add column archived_at timestamptz;

-- Counts active careers per user (plan limit) and distinct coaches (Início).
create index game_saves_active_user_idx
  on footebas.game_saves (user_id)
  where archived_at is null;
