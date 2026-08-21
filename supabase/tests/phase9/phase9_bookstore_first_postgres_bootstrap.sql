-- Disposable-only prerequisites for the local real-PostgreSQL U8B acceptance run.
-- This file is never applied to connected Supabase.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO vault.decrypted_secrets(name,decrypted_secret)
VALUES('phase9_q08_cursor_secret','u8b-real-postgres-disposable-secret-32-chars')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE public.public_store_profiles (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  description text,
  logo_url text,
  cover_url text,
  city text,
  state text,
  locality_id uuid,
  locality_name text,
  location text,
  operating_hours jsonb,
  pickup_enabled boolean NOT NULL DEFAULT false,
  delivery_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  return_policy_type text
);
ALTER TABLE public.public_store_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_store_profiles_read ON public.public_store_profiles
  FOR SELECT TO anon,authenticated,service_role USING (true);
REVOKE ALL ON public.public_store_profiles FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.public_store_profiles TO anon,authenticated,service_role;
