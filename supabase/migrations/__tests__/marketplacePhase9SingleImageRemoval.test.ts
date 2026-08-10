import fs from 'fs';
import path from 'path';

const migrationName = '20260810000035_marketplace_phase9_single_image_removal.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const sql = () => fs.readFileSync(migrationPath, 'utf8');

describe('Phase 9 single-image and safe input-removal contract', () => {
  it('is one unapplied forward migration after M34', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(migrationName).toMatch(/^20260810000035_/u);
  });

  it('defines an authenticated, server-derived, versioned removal RPC', () => {
    const source = sql();
    const fn = source.match(
      /CREATE OR REPLACE FUNCTION public\.phase9_remove_scan_input_v1\([\s\S]*?\$\$;/u,
    )?.[0] ?? '';
    expect(fn).toContain('SECURITY DEFINER');
    expect(fn).toContain("SET search_path=''");
    expect(fn).toContain('marketplace_sec.phase9_owner_ux_assert_session(p_session_id)');
    expect(fn).toContain('p_expected_input_version');
    expect(fn).not.toMatch(/p_store_id|storeId/u);
    expect(source).toContain('GRANT EXECUTE ON FUNCTION public.phase9_remove_scan_input_v1');
    expect(source).toContain('TO authenticated;');
  });

  it('rejects candidate lineage and never cascades into books, inventory, or listings', () => {
    const source = sql();
    expect(source).toMatch(/EXISTS[\s\S]*public\.image_extraction_candidates[\s\S]*c\.input_id=p_input_id/u);
    expect(source).toContain('P9_INPUT_HAS_CANDIDATES');
    expect(source).not.toMatch(/DELETE\s+FROM\s+public\.image_extraction_candidates/iu);
    expect(source).not.toMatch(/(?:DELETE|UPDATE|INSERT)\s+(?:FROM|INTO)?\s*public\.(?:store_inventory|marketplace_book_listings)/iu);
  });

  it('cancels only the exact input jobs and schedules hold-aware media cleanup', () => {
    const source = sql();
    expect(source).toContain("j.entity_type='input'");
    expect(source).toContain('j.entity_id=p_input_id');
    expect(source).toContain("j.job_kind IN ('media_validate_sanitize','vision_extract')");
    expect(source).toContain("status='cancelled'");
    expect(source).toContain("quality_reason='P9_OWNER_REMOVED'");
    expect(source).toContain('ma.hold_type IS NULL');
    expect(source).not.toMatch(/storage\.objects|supabase\.storage|DELETE\s+FROM\s+public\.media_assets/iu);
  });

  it('enforces one current input at both upload issuance and registration', () => {
    const source = sql();
    expect(source.match(/P9_SINGLE_IMAGE_LIMIT/gu)).toHaveLength(2);
    expect(source).toContain('marketplace_sec.phase9_issue_scan_upload');
    expect(source).toContain('marketplace_sec.phase9_register_scan_upload_completion');
    expect(source).toMatch(/phase9_upload_capabilities[\s\S]*status='issued'/u);
    expect(source).toMatch(/image_extraction_inputs[\s\S]*quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'/u);
  });

  it('hides owner-removed inputs without rewriting historical session counts', () => {
    const source = sql();
    expect(source).toContain('phase9_owner_discover_session_v1');
    expect(source).toContain('phase9_owner_session_inputs_v1');
    expect(source.match(/quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'/gu)?.length).toBeGreaterThanOrEqual(4);
    expect(source).not.toMatch(/SET\s+input_count\s*=\s*input_count\s*-/iu);
  });

  it('scopes the global needs-review discovery count to the resolved active store and actor', () => {
    const source = sql();
    const discover = source.match(
      /CREATE OR REPLACE FUNCTION public\.phase9_owner_discover_session_v1\(\)[\s\S]*?\$\$;/u,
    )?.[0] ?? '';
    const countQuery = discover.match(
      /'needsReviewCount',[\s\S]*?marketplace_sec\.phase9_owner_ux_needs_review\(c,s,transaction_timestamp\(\)\)\)/u,
    )?.[0] ?? '';
    expect(countQuery).toContain('s.store_id=v_store');
    expect(countQuery).toContain('s.created_by=auth.uid()');
  });
});
