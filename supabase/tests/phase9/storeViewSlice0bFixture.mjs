import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { migrationPath } from './databaseHarness.mjs';
import { createUnit7cDatabase } from './unit7cFixture.mjs';

export const SLICE0B = '20261030120000_store_view_slice0b_media_fixes.sql';
export const preSlice0b = process.env.PHASE9_SLICE0B_PRE_MIGRATION === '1';

// A second sanitizer output from the same source, with controlled chronology.
// Run as the fixture administrator; this does not create an upload capability.
export async function cloneSlice0bDerivative(db, assetId, { seconds = 0, id = randomUUID() } = {}) {
  await db.exec(`INSERT INTO public.media_assets
      (id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
       detected_mime,bytes,width,height,validation_version,reencode_version,
       exif_strip_version,source_media_asset_id,retention_class,lifecycle_status,created_at)
    SELECT '${id}',store_id,uploaded_by,purpose,privacy_class,bucket_id,
      object_path||'-${id}','${'f'.repeat(64)}',detected_mime,bytes,width,height,
      validation_version,reencode_version,exif_strip_version,source_media_asset_id,
      retention_class,'approved',created_at+${seconds}*interval '1 second'
    FROM public.media_assets WHERE id='${assetId}'`);
  return id;
}

export async function applySlice0b(db) {
  if (!preSlice0b) await db.exec(fs.readFileSync(
    process.env.PHASE9_SLICE0B_SQL_PATH ?? migrationPath(SLICE0B), 'utf8'));
}

export async function createStoreViewSlice0bDatabase({ includeFix = true } = {}) {
  const db = await createUnit7cDatabase();
  try {
    for (const file of [
      '20260817000047_marketplace_phase9_legacy_rpc_security_remediation.sql',
      '20260817000048_marketplace_phase9_legacy_rpc_service_role_compatibility.sql',
    ]) await db.exec(fs.readFileSync(migrationPath(file), 'utf8'));

    // Same disposable cursor-crypto/profile prerequisites as the U8C fixture.
    // No cursor is used here; these stubs do not implement/test cryptography.
    await db.exec(`
      CREATE FUNCTION extensions.pgp_sym_encrypt(data text,p_key text)
      RETURNS bytea LANGUAGE sql AS $$ SELECT convert_to(data||p_key,'UTF8') $$;
      CREATE FUNCTION extensions.pgp_sym_decrypt(data bytea,p_key text)
      RETURNS text LANGUAGE sql AS $$ SELECT convert_from(data,'UTF8') $$;
      CREATE TABLE public.public_store_profiles(
        store_id uuid PRIMARY KEY REFERENCES public.stores(id),
        display_name text NOT NULL,description text,logo_url text,cover_url text,
        city text,state text,locality_id uuid,locality_name text,location text,
        operating_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
        pickup_enabled boolean NOT NULL DEFAULT false,
        delivery_enabled boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
        return_policy_type text DEFAULT 'no_returns');
    `);
    for (const file of [
      '20260818000049_marketplace_phase9_bookstore_first_discovery.sql',
      '20260820000050_marketplace_phase9_storefront_detail.sql',
      '20260821000051_marketplace_phase9_public_media_order_invariant.sql',
    ]) await db.exec(fs.readFileSync(migrationPath(file), 'utf8'));
    if (includeFix) await applySlice0b(db);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
