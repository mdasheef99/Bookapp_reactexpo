import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

export const phase9MigrationNames = [
  '20260722000001_marketplace_phase9_catalogue_metadata_expand.sql',
  '20260722000002_marketplace_phase9_extraction_persistence.sql',
  '20260722000003_marketplace_phase9_media_registry.sql',
  '20260722000004_marketplace_phase9_condition_damage_transition.sql',
  '20260722000005_marketplace_phase9_controlled_inventory_commands.sql',
  '20260722000006_marketplace_phase9_storage_boundaries.sql',
  '20260722000007_marketplace_phase9_public_projection_search.sql',
  '20260722000008_marketplace_phase9_request_photo_seam.sql',
  '20260722000010_marketplace_phase9_public_boundary_security_correction.sql',
  '20260723000011_marketplace_phase9_ingestion_runtime_foundation.sql',
  '20260726000012_marketplace_phase9_vision_analysis_runtime.sql',
  '20260727000013_marketplace_phase9_service_rpc_wrappers.sql',
  '20260727000014_marketplace_phase9_vision_provider_attempts.sql',
];

const root = process.cwd();
export const migrationPath = (name) => path.join(root, 'supabase', 'migrations', name);

export async function createPhase9Database() {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(fs.readFileSync(path.join(root, 'supabase', 'tests', 'phase9', 'phase6_baseline.sql'), 'utf8'));
  await db.exec(`CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE FUNCTION extensions.digest(value text, algorithm text) RETURNS bytea
    LANGUAGE sql IMMUTABLE AS $$ SELECT decode(md5(value)||md5(value||algorithm),'hex') $$;`);
  for (const name of phase9MigrationNames) await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
  return db;
}

export async function scalar(db, sql) {
  const result = await db.query(sql);
  return Object.values(result.rows[0])[0];
}

export async function setActor(db, userId, role = 'authenticated') {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${userId}',false);
    SELECT set_config('request.jwt.claim.role','${role}',false); SET ROLE ${role};`);
}

export async function resetActor(db) {
  await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false); SELECT set_config('request.jwt.claim.role','',false);");
}

