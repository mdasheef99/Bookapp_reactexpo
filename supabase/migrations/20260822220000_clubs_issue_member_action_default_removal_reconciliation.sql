-- REC-4: issue_club_member_action DEFAULT-removal reconciliation.
-- Position: after 20260821000051_marketplace_phase9_public_media_order_invariant.sql,
--   before 20260822230000_clubs_wave2_attribution_guards_expiry.sql.
-- Purpose: older migration 20260529154500_club_moderation_author_lifecycle_rpc.sql
--   created public.issue_club_member_action(uuid,uuid,text,text,integer) with
--   p_duration_hours integer DEFAULT NULL. Wave-2 recreates the same identity
--   without that default to add guards. PostgreSQL CREATE OR REPLACE cannot
--   remove parameter defaults (SQLSTATE 42P13). Plain DROP allows Wave-2 to
--   create the intended default-free definition.

BEGIN;

DROP FUNCTION public.issue_club_member_action(
uuid,
uuid,
text,
text,
integer
);

COMMIT;
