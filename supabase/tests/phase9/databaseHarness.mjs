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
  '20260728000015_marketplace_phase9_metadata_foundation.sql',
  '20260728000016_marketplace_phase9_sensitive_table_acl_correction.sql',
  '20260728000017_marketplace_phase9_maintain_acl_correction.sql',
  '20260729000018_marketplace_phase9_search_variant_proposals.sql',
  '20260729000019_marketplace_phase9_search_variant_replay_fence.sql',
  '20260729000020_marketplace_phase9_variant_runtime_search.sql',
  '20260729000021_marketplace_phase9_defer_active_variant_search.sql',
  '20260729000022_marketplace_phase9_active_variant_search.sql',
  '20260729000023_marketplace_phase9_active_variant_search_correction.sql',
  '20260729000024_marketplace_phase9_owner_variant_decisions.sql',
  '20260729000025_marketplace_phase9_owner_variant_corrections.sql',
  '20260729000026_marketplace_phase9_variant_benchmark_rollout.sql',
  '20260729000027_marketplace_phase9_exact_rollout_activation.sql',
  '20260729000028_marketplace_phase9_variant_benchmark_evidence_read.sql',
];

const root = process.cwd();
export const migrationPath = (name) => path.join(root, 'supabase', 'migrations', name);

export async function createPhase9Database(options = {}) {
  const throughMigration = options.throughMigration
    ?? '20260729000023_marketplace_phase9_active_variant_search_correction.sql';
  const db = new PGlite();
  await db.waitReady;
  await db.exec(fs.readFileSync(path.join(root, 'supabase', 'tests', 'phase9', 'phase6_baseline.sql'), 'utf8'));
  await db.exec(`CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE FUNCTION extensions.digest(value text, algorithm text) RETURNS bytea
    LANGUAGE sql IMMUTABLE AS $$
      SELECT CASE WHEN algorithm='sha256'
        THEN sha256(convert_to(value,'UTF8')) ELSE NULL END
    $$;`);
  for (const name of phase9MigrationNames) {
    await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
    if (name === throughMigration) break;
  }
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

