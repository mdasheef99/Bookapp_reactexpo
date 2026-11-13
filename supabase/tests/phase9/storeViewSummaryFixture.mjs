// Local-only chain through M51; compatibility shims match the storefront harness.
import fs from 'node:fs';
import { createUnit7cDatabase } from './unit7cFixture.mjs';
import { migrationPath } from './databaseHarness.mjs';
export const summaryMigration = '20261030130000_store_view_slice1b_summary.sql';
async function ensureU8cPrerequisites(db) {
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS vault;
    CREATE TABLE IF NOT EXISTS vault.decrypted_secrets(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE,
      decrypted_secret text, created_at timestamptz DEFAULT transaction_timestamp());
    CREATE SCHEMA IF NOT EXISTS extensions;
    INSERT INTO vault.decrypted_secrets(name,decrypted_secret)
    VALUES('phase9_q08_cursor_secret','u8c-test-secret-32-characters-minimum-123456')
    ON CONFLICT(name) DO UPDATE SET decrypted_secret=excluded.decrypted_secret;
    CREATE OR REPLACE FUNCTION extensions.pgp_sym_encrypt(data text,p_key text)
    RETURNS bytea LANGUAGE sql AS $$ SELECT convert_to(data||'|'||p_key,'UTF8') $$;
    CREATE OR REPLACE FUNCTION extensions.pgp_sym_decrypt(data bytea,p_key text)
    RETURNS text LANGUAGE plpgsql AS $$
    DECLARE v text:=convert_from(data,'UTF8'); BEGIN
      IF v NOT LIKE '%|'||p_key THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      RETURN substring(v from 1 for char_length(v)-char_length(p_key)-1);
    END $$;
    CREATE OR REPLACE FUNCTION extensions.digest(value text,algorithm text)
    RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(convert_to(value,'UTF8')) $$;
    CREATE OR REPLACE FUNCTION extensions.digest(value bytea,algorithm text)
    RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(value) $$;
    CREATE OR REPLACE FUNCTION marketplace_sec.phase9_variant_compare_key(p_text text)
    RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
      SELECT trim(regexp_replace(lower(normalize(coalesce(p_text,''),NFKC)),
        '[[:punct:][:space:]]+',' ','g')) $$;
  `);
  const isbnNormalizer = await db.query(`SELECT count(*)::int count FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='marketplace_sec' AND p.proname='phase9_metadata_normalized_isbn13'`);
  if (isbnNormalizer.rows[0].count === 0) {
    await db.exec(`CREATE FUNCTION marketplace_sec.phase9_metadata_normalized_isbn13(p_value text)
      RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
      SELECT CASE WHEN regexp_replace(coalesce(p_value,''),'[-[:space:]]','','g')
        IN ('9780306406157','9780006543541')
        THEN regexp_replace(p_value,'[-[:space:]]','','g') ELSE NULL END $$;`);
  }
  await db.exec(`
    ALTER TABLE public.phase9_search_variant_proposals
      DROP CONSTRAINT IF EXISTS phase9_search_variant_proposals_analysis_result_id_fkey;
    ALTER TABLE public.phase9_search_variant_proposals
      DROP CONSTRAINT IF EXISTS phase9_search_variant_proposals_vision_job_id_fkey;
    ALTER TABLE public.phase9_search_variant_proposals
      DROP CONSTRAINT IF EXISTS phase9_search_variant_proposals_candidate_id_fkey;
    ALTER TABLE public.phase9_search_variant_proposals
      DROP CONSTRAINT IF EXISTS phase9_search_variant_proposals_observation_id_fkey;
    CREATE TABLE IF NOT EXISTS public.public_store_profiles(
      store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
      display_name text NOT NULL,description text,logo_url text,cover_url text,
      city text,state text,locality_id uuid,locality_name text,location text,
      operating_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
      pickup_enabled boolean NOT NULL DEFAULT false,
      delivery_enabled boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
      return_policy_type text DEFAULT 'no_returns');
  `);
}


export async function createSummaryDatabase() {
  const db = await createUnit7cDatabase();
  await ensureU8cPrerequisites(db);
  for (const name of [
    '20260817000047_marketplace_phase9_legacy_rpc_security_remediation.sql',
    '20260817000048_marketplace_phase9_legacy_rpc_service_role_compatibility.sql',
    '20260818000049_marketplace_phase9_bookstore_first_discovery.sql',
    '20260820000050_marketplace_phase9_storefront_detail.sql',
    '20260821000051_marketplace_phase9_public_media_order_invariant.sql',
  ]) await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
  // Only this new function is omitted for Haiku's fail-first run; M01-M51 stay loaded.
  // Retain the initial fixture's flag as an alias for existing run instructions.
  if (process.env.PHASE9_SLICE1B_PRE_MIGRATION !== '1' && process.env.SLICE1B_PRE_MIGRATION !== '1')
    await db.exec(fs.readFileSync(migrationPath(summaryMigration), 'utf8'));
  return db;
}
