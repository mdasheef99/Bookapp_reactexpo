import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrations = path.join(root, 'supabase', 'migrations');
const migrationName = '20260723000011_marketplace_phase9_ingestion_runtime_foundation.sql';
const migrationPath = path.join(migrations, migrationName);

describe('Phase 9 ingestion-runtime forward correction', () => {
  it('adds one forward migration after immutable M01-M08/M10 and leaves M09 absent', () => {
    const names = fs.readdirSync(migrations).filter((name) => /marketplace_phase9_.*\.sql$/.test(name));
    expect(names).toContain(migrationName);
    expect(names.some((name) => /^20260722000009_/.test(name))).toBe(false);
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('removes authenticated path authority and adds service-only intake operations', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.phase9_authorize_upload[\s\S]+authenticated/i);
    expect(sql).toMatch(/CREATE FUNCTION marketplace_sec\.phase9_issue_scan_upload/i);
    expect(sql).toMatch(/CREATE FUNCTION marketplace_sec\.phase9_register_scan_upload_completion/i);
    expect(sql).toMatch(/CREATE FUNCTION marketplace_sec\.claim_phase9_media_validation_jobs/i);
    expect(sql).toMatch(/CREATE FUNCTION marketplace_sec\.phase9_media_validation_context/i);
    expect(sql).toMatch(/CREATE FUNCTION marketplace_sec\.phase9_revalidate_media_validation_lease/i);
    expect(sql).toMatch(/CREATE FUNCTION marketplace_sec\.phase9_complete_media_validation/i);
    expect(sql).toMatch(/CREATE FUNCTION marketplace_sec\.phase9_fail_media_validation/i);
    expect(sql).toMatch(/GRANT EXECUTE[\s\S]+TO service_role/i);
    expect(sql).not.toMatch(/GRANT EXECUTE[\s\S]+phase9_issue_scan_upload[\s\S]+TO authenticated/i);
  });

  it('persists upload registration and exact-once validation/vision identities', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/upload_capability_id uuid/i);
    expect(sql).toMatch(/completion_canonical_response jsonb/i);
    expect(sql).toMatch(/source_object_identity text/i);
    expect(sql).toMatch(/source_sha256 text/i);
    expect(sql).toMatch(/source_snapshot_sha256 text/i);
    expect(sql).toMatch(/lease_token_hash text/i);
    expect(sql).toMatch(/phase9_bind_media_validation_snapshot/i);
    expect(sql).toMatch(/p_lease_token text/i);
    expect(sql).toMatch(/p_attempt_count integer/i);
    expect(sql).toMatch(/state[^;]+uploaded[^;]+validating[^;]+queued[^;]+failed/is);
    expect(sql).toMatch(/media-validate:/i);
    expect(sql).toMatch(/vision:/i);
    expect(sql).toMatch(/ON CONFLICT\s*\(dedupe_key\)\s*DO NOTHING/i);
    expect(sql).toMatch(/staging_cleanup/i);
    expect(sql).toMatch(/p_width::bigint\*p_height::bigint>16000000/i);
    expect(sql).toMatch(/attempt-'\|\|v_job\.attempt_count/i);
    expect(sql).toMatch(/declared_source_kind/i);
    expect(sql).not.toMatch(/p_width::bigint\*p_height::bigint>40000000/i);
  });
});
