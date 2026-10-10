-- ============================================================
-- CLUB-WU-L01-A · clubs L4 disposable-PG17 platform bootstrap
-- ------------------------------------------------------------
-- SCOPE RULE (L01-A): this file may create ONLY prerequisites that are
-- EXTERNAL to BookConnect application migrations — Supabase/platform
-- substrate shims. It must NEVER contain BookConnect application
-- behavior under test (functions, triggers, policies, cap logic).
-- All behavior under test is loaded from ACTUAL repository migration
-- files by clubsL4Runner.mjs.
--
-- Substrate provided here:
--   1. Supabase system roles referenced by GRANT/REVOKE in real
--      migrations (anon, authenticated, service_role).
--   2. auth schema shim: auth.users FK target + auth.uid() GUC reader,
--      identical in shape to the Supabase/F04 convention:
--      request.jwt.claim.sub GUC -> uuid.
--   3. postgis extension availability (image ships it; venues table in
--      migration 003 uses GEOGRAPHY(POINT)).
--
-- Runs as the container superuser; every object created here is
-- platform substrate, not application behavior.
-- ============================================================

-- 1. Supabase roles (NOLOGIN like hosted Supabase)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

-- 2. auth schema shim
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY,
    email text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Same GUC contract as Supabase GoTrue: request.jwt.claim.sub holds the actor id.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- 3. Extension substrate (PostGIS ships in the pinned image)
CREATE EXTENSION IF NOT EXISTS postgis;
