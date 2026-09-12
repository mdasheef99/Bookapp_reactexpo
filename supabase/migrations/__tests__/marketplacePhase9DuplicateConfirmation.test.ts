import fs from 'node:fs';
import path from 'node:path';

const migration = path.join(process.cwd(), 'supabase', 'migrations',
  '20260911000060_marketplace_phase9_duplicate_confirmation.sql');

describe('Phase 9 duplicate confirmation forward migration', () => {
  const source = () => fs.readFileSync(migration, 'utf8');

  it('uses a canonical-only partial uniqueness rule and server-enforced relationship', () => {
    const sql = source();
    expect(sql).toContain('duplicate_of_input_id');
    expect(sql).toMatch(/CREATE UNIQUE INDEX phase9_input_canonical_sanitized_hash[\s\S]*WHERE sha256 IS NOT NULL AND duplicate_of_input_id IS NULL/u);
    expect(sql).toContain('phase9_enforce_duplicate_input_relationship');
    expect(sql).toContain('FOR UPDATE');
  });

  it('keeps pending media protected and makes cleanup, dispatch, and health confirmation-aware', () => {
    const sql = source();
    expect(sql).toContain('phase9_duplicate_input_confirmations');
    expect(sql).toContain("state='pending'");
    expect(sql).toContain('claim_phase9_media_output_cleanup_jobs');
    expect(sql).toContain('phase9_finish_media_output_cleanup');
    expect(sql).toContain('has_claimable_phase9_work');
    expect(sql).toContain('phase9_media_output_cleanup_health');
  });

  it('exposes only service-role preflight and resolver functions', () => {
    const sql = source();
    expect(sql).toContain('phase9_peek_duplicate_resolution_replay');
    expect(sql).toContain('phase9_duplicate_resolution_context');
    expect(sql).toContain('phase9_resolve_duplicate_scan_input');
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION marketplace_sec\.phase9_duplicate_resolution_context[\s\S]*FROM PUBLIC,anon,authenticated/u);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION marketplace_sec\.phase9_duplicate_resolution_context[\s\S]*marketplace_sec\.phase9_resolve_duplicate_scan_input[\s\S]*TO service_role/u);
  });
});
