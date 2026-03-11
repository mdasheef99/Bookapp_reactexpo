-- HISTORICAL / NON-CANONICAL WARNING
-- This script is NOT present in live supabase_migrations.schema_migrations as of 2026-03-06.
-- The live database is the source of truth for BookTalks Mobile. Do not run this
-- against the current live project without an explicit recovery plan.
-- See docs/audits/LIVE_SCHEMA_RECONCILIATION_2026-03-06.md for the canonical snapshot.
-- ============================================================================
-- ============================================================================
-- BookTalks Migration 004: Rename Lead to Admin
-- ============================================================================
-- Purpose: Updates club leadership terminology from "Lead" to "Admin"
-- Date: 2024-01-XX
-- Author: BookTalks Development Team
-- 
-- IMPORTANT: This is a BREAKING CHANGE that affects existing data
-- 
-- Pre-requisites:
--   1. Backup your database before running this migration
--   2. Ensure no active transactions are modifying book_clubs or club_members
--   3. Notify all users of potential brief downtime
-- 
-- Execution Instructions:
--   1. Run this script in Supabase SQL Editor
--   2. Verify all changes with the verification queries at the end
--   3. If issues occur, use the rollback script provided
-- ============================================================================

-- Start transaction for atomic execution
BEGIN;

-- ============================================================================
-- STEP 1: Rename column in book_clubs table
-- ============================================================================
DO $$
BEGIN
    -- Check if column exists before renaming
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'book_clubs' AND column_name = 'lead_id'
    ) THEN
        ALTER TABLE book_clubs RENAME COLUMN lead_id TO admin_id;
        RAISE NOTICE 'Successfully renamed book_clubs.lead_id to admin_id';
    ELSE
        RAISE NOTICE 'Column book_clubs.lead_id does not exist (may already be renamed)';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Update role enum values in club_members
-- ============================================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update all 'lead' roles to 'admin'
    UPDATE club_members SET role = 'admin' WHERE role = 'lead';
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % club_members records from lead to admin', updated_count;
END $$;

-- ============================================================================
-- STEP 3: Update CHECK constraint on club_members.role
-- ============================================================================
DO $$
BEGIN
    -- Drop old constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'club_members_role_check' 
        AND table_name = 'club_members'
    ) THEN
        ALTER TABLE club_members DROP CONSTRAINT club_members_role_check;
        RAISE NOTICE 'Dropped old club_members_role_check constraint';
    END IF;
    
    -- Add new constraint with updated enum values
    ALTER TABLE club_members ADD CONSTRAINT club_members_role_check
        CHECK (role IN ('member', 'moderator', 'admin'));
    RAISE NOTICE 'Added new club_members_role_check constraint';
END $$;

-- ============================================================================
-- STEP 4: Update RLS policies referencing lead_id (if any exist)
-- ============================================================================
-- Note: Add specific RLS policy updates here if your database has policies
-- that reference lead_id. Example:
-- 
-- DROP POLICY IF EXISTS "Club leads can manage club" ON book_clubs;
-- CREATE POLICY "Club admins can manage club" ON book_clubs
--   FOR ALL USING (admin_id = auth.uid());

RAISE NOTICE 'RLS policies update step completed (add specific policies as needed)';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify success

-- Verify column rename
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'book_clubs' AND column_name = 'admin_id'
    ) THEN
        RAISE NOTICE '✓ Verification: book_clubs.admin_id column exists';
    ELSE
        RAISE EXCEPTION '✗ Verification FAILED: book_clubs.admin_id column not found';
    END IF;
END $$;

-- Verify no 'lead' roles remain
DO $$
DECLARE
    lead_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO lead_count FROM club_members WHERE role = 'lead';
    IF lead_count = 0 THEN
        RAISE NOTICE '✓ Verification: No lead roles found in club_members';
    ELSE
        RAISE EXCEPTION '✗ Verification FAILED: % lead roles still exist', lead_count;
    END IF;
END $$;

-- Verify CHECK constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'club_members_role_check'
    ) THEN
        RAISE NOTICE '✓ Verification: club_members_role_check constraint exists';
    ELSE
        RAISE EXCEPTION '✗ Verification FAILED: club_members_role_check constraint not found';
    END IF;
END $$;

-- Commit transaction if all steps succeeded
COMMIT;

RAISE NOTICE '============================================================================';
RAISE NOTICE 'Migration 004 completed successfully!';
RAISE NOTICE 'All existing clubs retain their leadership structure';
RAISE NOTICE 'Frontend must now update all references from "Lead" to "Admin"';
RAISE NOTICE 'Edge Functions must use admin_id instead of lead_id';
RAISE NOTICE '============================================================================';

-- ============================================================================
-- ROLLBACK SCRIPT (Run this if you need to revert changes)
-- ============================================================================
/*
BEGIN;

-- Revert column rename
ALTER TABLE book_clubs RENAME COLUMN admin_id TO lead_id;

-- Revert role updates
UPDATE club_members SET role = 'lead' WHERE role = 'admin';

-- Revert CHECK constraint
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_role_check;
ALTER TABLE club_members ADD CONSTRAINT club_members_role_check
    CHECK (role IN ('member', 'moderator', 'lead'));

COMMIT;

-- Verify rollback
SELECT 'Rollback completed' AS status;
*/

