-- REC-2: public.book_clubs.archived_at historical reconstruction.
-- Position: after 20260529154500_club_moderation_author_lifecycle_rpc.sql,
--   before 20260529170000_club_downgrade_grace_period.sql.
-- The live schema (ahntbtktjjmvfosgkmgn) carries this column, but no migration
-- in repository history creates it. The first consumer, 20260529170000, writes
-- archived_at = coalesce(archived_at, now()) inside
-- public.process_club_downgrade_grace_period, which fails at runtime with
-- SQLSTATE 42703 (column "archived_at" does not exist) on clean replay.
-- Plain ADD COLUMN, deliberately without IF NOT EXISTS: historical
-- reconstruction must be deterministic and failure-loud so unexpected
-- migration-history drift cannot be silently masked.
-- Shape mirrors the freshly verified live definition: timestamptz, nullable,
-- no default, no constraint, no index.

begin;

alter table public.book_clubs
  add column archived_at timestamptz;

commit;
