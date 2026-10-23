-- Footebas: coach avatar on the global ranking (ADR 0013, HANDOFF item 6).
-- The avatar is the one the career's coach profile had when the server
-- validated the achievement: a pixel avatar id (`avatar-01`..`avatar-12`) or
-- the https URL of the coach's picture on the Footebas CDN or Google
-- (`coachAvatarSchema`). Rows written before this migration keep it null and
-- the screen falls back to a pixel avatar. Snapshots copy the latest avatar
-- of the user's best career. The avatar is public on the leaderboard, like the
-- coach name; the coach chose it in the game.

alter table footebas.validated_achievements
  add column avatar text
    check (avatar is null or char_length(avatar) between 1 and 500);

alter table footebas.ranking_snapshots
  add column avatar text
    check (avatar is null or char_length(avatar) between 1 and 500);
