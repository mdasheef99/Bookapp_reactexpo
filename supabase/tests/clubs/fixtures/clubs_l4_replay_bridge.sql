-- ============================================================
-- CLUB-WU-L01-A · clubs L4 REPLAY BRIDGE  ⚠ FLAGGED EVIDENCE ⚠
-- ------------------------------------------------------------
-- STATUS (Owner Decision 2, 2026-08-26):
--   TEMPORARY L01-A TEST SUBSTRATE
--   NOT TEST-07 CLOSURE
--   NOT AUTHORITATIVE MIGRATION HISTORY
--   TO BE RESOLVED BY L01-D / migration replay reconciliation
--   (CLUB-TEST-07 remains OPEN; production migration history must
--   NOT be repaired here and no new production migration is created
--   for this gap in L01-A.)
-- ------------------------------------------------------------
-- WHAT THIS IS:
--   Restoration of historical book_clubs schema prerequisites that
--   migration 20260307000500_010 (clubs identity/public contract)
--   ASSUMES but that NO repository migration performs.
--
-- WHY IT EXISTS (replay-gap evidence, live-verified 2026-08-26 via
-- Supabase MCP read-only against ahntbtktjjmvfosgkmgn):
--   Migration 003 creates book_clubs with `lead_id` and no
--   meeting_type/author_id columns. Migration 010 renames the FK
--   constraint lead_id->admin_id, and its view + author-club trigger
--   read bc.admin_id / bc.meeting_type / bc.author_id — none of which
--   any tracked migration adds. The live database HAS them, so the
--   schema change was applied to production as UNTRACKED MANUAL DDL
--   (same class as the HIER-01 finding already recorded in
--   docs/user/clubs/TRACKER.md for club_members_role_check).
--
-- LIVE GROUND TRUTH THIS RESTORES (column-for-column):
--   book_clubs.admin_id     uuid NULL REFERENCES auth.users(id)
--   book_clubs.meeting_type text NULL
--     CONSTRAINT book_clubs_meeting_type_check
--       CHECK (meeting_type = ANY (ARRAY['online_only','venue_based','hybrid']))
--   book_clubs.author_id    uuid NULL REFERENCES user_profiles(id)
--   club_members.role       CHECK ('member','moderator','admin')
--     (003 ships ('member','moderator','lead'); the live constraint is
--      ('member','moderator','admin') from untracked manual DDL — the
--      exact drift already recorded in docs/user/clubs/TRACKER.md under
--      HIER-01. Without this restore, the REAL create_club RPC cannot
--      insert its admin membership row at all.)
--
-- SCOPE GUARD (L01-A Correction #1 compliance):
--   This file contains NO BookConnect behavior under test — no
--   functions, triggers, policies, or cap logic. It restores only the
--   historical column substrate required for the REAL migrations to
--   apply at all. Without it, migration 010 cannot be replayed from
--   the repository chain alone. This gap must be reported to the
--   tracker; it is NOT silently patched product behavior.
--
-- POSITION IN SEQUENCE: applied by clubsL4Runner.mjs AFTER 003 and
-- BEFORE 004/010.
-- ============================================================

ALTER TABLE public.book_clubs RENAME COLUMN lead_id TO admin_id;

ALTER TABLE public.book_clubs
    ADD COLUMN meeting_type text;

ALTER TABLE public.book_clubs
    ADD CONSTRAINT book_clubs_meeting_type_check
    CHECK (meeting_type = ANY (ARRAY['online_only'::text, 'venue_based'::text, 'hybrid'::text]));

ALTER TABLE public.book_clubs
    ADD COLUMN author_id uuid REFERENCES public.user_profiles(id);

ALTER TABLE public.club_members DROP CONSTRAINT club_members_role_check;

ALTER TABLE public.club_members
    ADD CONSTRAINT club_members_role_check
    CHECK (role = ANY (ARRAY['member'::text, 'moderator'::text, 'admin'::text]));
