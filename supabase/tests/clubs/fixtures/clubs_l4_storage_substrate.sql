-- ============================================================
-- CLUB-WU-L01-C · SUPABASE PLATFORM TEST SUBSTRATE
-- NOT APPLICATION POLICY LOGIC
-- NOT TEST-07 REPLAY PROOF
-- ------------------------------------------------------------
-- SCOPE RULE (L01-C): this file provides ONLY the minimum
-- Supabase-platform structural substrate required for actual
-- repository Storage policies (storage.objects) to execute under
-- real PostgreSQL RLS. It MUST NEVER contain BookConnect
-- authorization logic under test — all B01 policy behavior comes
-- from ACTUAL repository migration
-- 20260822233000_clubs_b01_banner_storage_lockdown.sql loaded by
-- clubsL4Runner.mjs.
--
-- Substrate provided here:
--   1. storage schema
--   2. storage.buckets table (minimal)
--   3. storage.objects table with columns required by B01 policy
--      evaluation: id, bucket_id, name, owner, created_at
--      plus owner_id compat if needed; bucket_id+name unique.
--   4. storage.foldername(text) helper — immutable split on '/'
--      identical to the hosted Supabase definition used by B01
--      policies: (storage.foldername(name))[1]::uuid = clubId
--   5. storage.objects RLS enabled (platform default)
--   6. club-banners bucket row (public=true, 5MB, jpeg/png/webp)
--
-- POSITION: applied by clubsL4Runner.mjs AFTER platform bootstrap
-- and BEFORE B01 migration, only for RLS-contract databases.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS storage;

-- storage.buckets minimal
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

-- storage.foldername helper (hosted Supabase shape)
CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_split_to_array(name, '/')
$$;

-- storage.objects minimal — only columns referenced by B01 or
-- strict FK/unique constraints the real migration expects.
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL,
  owner uuid,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  last_accessed_at timestamptz,
  metadata jsonb,
  UNIQUE (bucket_id, name)
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grants expected by Supabase platform (needed for SET ROLE tests)
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;
GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;

-- Seed club-banners bucket exactly as live (public=true, 5MB, mime jpg/png/webp)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('club-banners', 'club-banners', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- CLUBS RLS GRANTS — platform-level privilege substrate
-- Live Supabase grants SELECT/INSERT/UPDATE/DELETE on club_messages
-- (and related clubs tables) to anon/authenticated so RLS policies
-- can be evaluated as those roles. Without these, permission-denied
-- would mask policy evaluation. This is platform substrate, not
-- authorization logic.
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_messages TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_clubs TO anon, authenticated, service_role;
