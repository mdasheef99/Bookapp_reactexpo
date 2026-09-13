-- REC-1: Clubs pre-010 historical reconciliation.
-- Position: after 20260212150120_create_reading_notes, before
--   20260307000500_010_clubs_identity_invitations_public_contract.
-- Purpose: migration 010 was authored against the live database after an
--   out-of-band historical transition (recovered in manual_migration_lead_to_admin.sql)
--   plus live-only author-club support. This migration establishes that missing
--   pre-010 substrate so clean replay reaches 010 in the intended state.

BEGIN;

-- 1) Historical leadership terminology rename.
--    The FK constraint name book_clubs_lead_id_fkey is intentionally preserved;
--    migration 010 contains the historical constraint rename to
--    book_clubs_admin_id_fkey.
ALTER TABLE public.book_clubs
  RENAME COLUMN lead_id TO admin_id;

-- 2) Drop the historical role CHECK before data conversion.
--    The old CHECK (member / moderator / lead) rejects 'admin'.
ALTER TABLE public.club_members
  DROP CONSTRAINT club_members_role_check;

-- 3) Convert historical lead rows to admin.
--    No-op on a clean replay; kept to preserve historical migration semantics.
UPDATE public.club_members
SET role = 'admin'
WHERE role = 'lead';

-- 4) New role CHECK matching the historical target values.
ALTER TABLE public.club_members
  ADD CONSTRAINT club_members_role_check
  CHECK (role IN ('member', 'moderator', 'admin'));

-- 5) club_type CHECK replacement: author_club support.
ALTER TABLE public.book_clubs
  DROP CONSTRAINT book_clubs_club_type_check;

ALTER TABLE public.book_clubs
  ADD CONSTRAINT book_clubs_club_type_check
  CHECK (club_type IN ('public', 'approval', 'invite_only', 'author_club'));

-- 6) author_id: nullable, no default, FK to user_profiles(id) with no
--    ON DELETE / ON UPDATE behavior (matches confirmed live definition).
ALTER TABLE public.book_clubs
  ADD COLUMN author_id uuid REFERENCES public.user_profiles(id);

-- 7) meeting_type: nullable, no default.
ALTER TABLE public.book_clubs
  ADD COLUMN meeting_type text;

ALTER TABLE public.book_clubs
  ADD CONSTRAINT book_clubs_meeting_type_check
  CHECK (meeting_type IN ('online_only', 'venue_based', 'hybrid'));

-- 8) Author-club consistency, matching confirmed live semantics.
ALTER TABLE public.book_clubs
  ADD CONSTRAINT book_clubs_author_club_check
  CHECK (
    (club_type = 'author_club' AND author_id IS NOT NULL)
    OR (club_type <> 'author_club' AND author_id IS NULL)
  );

COMMIT;
