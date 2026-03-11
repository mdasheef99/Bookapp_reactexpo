-- Live migration version/name: 20251228114143 / 005_add_missing_user_profile_fields
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251228114143
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

-- Add missing fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS trust_score NUMERIC(3,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();