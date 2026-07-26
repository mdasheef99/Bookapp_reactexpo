import fs from 'node:fs';
import path from 'node:path';

const migrations = path.join(process.cwd(), 'supabase', 'migrations');
const migrationName = '20260726000012_marketplace_phase9_vision_analysis_runtime.sql';
const migrationPath = path.join(migrations, migrationName);

describe('Phase 9 M12 vision-analysis runtime migration', () => {
  it('is one forward migration after M11 without creating M09', () => {
    const names = fs.readdirSync(migrations);
    expect(names).toContain(migrationName);
    expect(names.some((name) => /^20260722000009_/.test(name))).toBe(false);
  });

  it('adds immutable result/observation evidence and candidate provenance', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/CREATE TABLE public\.image_analysis_results/i);
    expect(sql).toMatch(/CREATE TABLE public\.image_analysis_observations/i);
    expect(sql).toMatch(/canonical_result_sha256/i);
    expect(sql).toMatch(/completing_lease_token_hash/i);
    expect(sql).toMatch(/observed_publisher_clue/i);
    expect(sql).toMatch(/analysis_observation_id/i);
    expect(sql).toMatch(/UNIQUE\s*\(vision_job_id,analysis_schema_version\)/i);
    expect(sql).toMatch(/UNIQUE\s*\(analysis_result_id,observation_ordinal\)/i);
    expect(sql).toMatch(/octet_length\(convert_to\(p_result::text,'UTF8'\)\)/i);
    expect(sql).toMatch(/digest\(p_result::text,'sha256'\)/i);
    expect(sql).not.toMatch(/p_canonical_result_sha256 text/i);
  });

  it('adds vision-only lease-fenced context, persist, and fail functions', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    for (const name of [
      'claim_phase9_vision_jobs',
      'phase9_vision_job_context',
      'phase9_persist_vision_analysis',
      'phase9_fail_vision_job',
    ]) expect(sql).toMatch(new RegExp(`CREATE FUNCTION marketplace_sec\\.${name}`, 'i'));
    expect(sql).toMatch(/job_kind IS DISTINCT FROM 'vision_extract'/i);
    expect(sql).toMatch(/p_attempt_count integer/i);
    expect(sql).toMatch(/p_lease_token text/i);
    expect(sql).not.toMatch(/phase9_fail_vision_job\([\s\S]{0,180}p_retryable boolean/i);
    expect(sql).toMatch(/v_retryable:=p_safe_error_code IN/i);
    expect(sql).toMatch(/lease_token_hash IS DISTINCT FROM\s+encode\(extensions\.digest\(p_lease_token,'sha256'\),'hex'\)/i);
    expect(sql).toMatch(/P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED/i);
  });

  it('uses pinned service-only grants, RLS, immutable guards, and no inventory/publication DML', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/SECURITY DEFINER SET search_path=''/i);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/REVOKE ALL ON (TABLE )?public\.image_analysis_results FROM PUBLIC,anon,authenticated/i);
    expect(sql).toMatch(/GRANT EXECUTE[\s\S]+phase9_persist_vision_analysis[\s\S]+TO service_role/i);
    expect(sql).toMatch(/phase9_reject_analysis_evidence_mutation/i);
    expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:store_inventory|marketplace_book_listings|marketplace_events)/i);
    expect(sql).not.toMatch(/raw_provider|raw_response|signed_url|storage_path/i);
  });
});
