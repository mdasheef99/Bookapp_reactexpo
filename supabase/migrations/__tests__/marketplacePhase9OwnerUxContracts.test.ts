import fs from 'fs';
import path from 'path';

const migrationName = '20260730000029_marketplace_phase9_owner_safe_contracts.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const sql = () => fs.readFileSync(migrationPath, 'utf8');

describe('Phase 9 Unit 6A M29 structural contract', () => {
  it('exists as one forward-only migration after immutable M01-M28', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(migrationName).toMatch(/^20260730000029_/);
  });

  it.each([
    'phase9_owner_discover_session_v1',
    'phase9_owner_session_summary_v2',
    'phase9_owner_session_inputs_v1',
    'phase9_owner_candidates_page_v2',
    'phase9_owner_candidate_detail_v2',
    'phase9_update_candidate_review_v2',
    'phase9_owner_session_readiness_v1',
    'phase9_close_session_v2',
  ])('defines exact operation function %s', (name) => {
    const source = sql();
    const match = source.match(new RegExp(
      `CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`,
      'u',
    ));
    expect(match).not.toBeNull();
    expect(match?.[0]).toContain('SECURITY DEFINER');
    expect(match?.[0]).toContain("SET search_path=''");
    expect(match?.[0]).toMatch(/public\.[a-z0-9_]+/u);
  });

  it('uses definer functions, empty paths, qualified relations, and narrow grants', () => {
    const source = sql();
    expect(source).toContain('REVOKE ALL ON FUNCTION');
    expect(source).toContain('FROM PUBLIC,anon');
    expect(source).toContain('TO authenticated');
    expect(source).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE).*authenticated/i);
  });

  it('revokes every Unit 6A helper and inherited replay helpers from API roles', () => {
    const source = sql();
    [
      'phase9_owner_ux_assert_owner()',
      'phase9_owner_ux_cursor(jsonb)',
      'phase9_owner_ux_cursor_payload(text)',
      'phase9_owner_ux_candidate_detail(public.image_extraction_sessions,public.image_extraction_candidates)',
      'phase9_owner_ux_valid_review(jsonb)',
      'phase9_replay(text,text,text,text)',
      'phase9_finish_replay(text,text,text,jsonb,text)',
    ].forEach((signature) => {
      expect(source).toContain(
        `REVOKE ALL ON FUNCTION marketplace_sec.${signature} FROM PUBLIC,anon,authenticated;`,
      );
    });
  });

  it('contains membership, cursor, version, replay, and noninterference fences', () => {
    const source = sql();
    [
      'review_scope_version', 'session_scope_version', 'metadata_revision',
      'NeedsReviewMembershipV1', 'P9_CURSOR_INVALID',
      'P9_CANDIDATE_VERSION_CONFLICT', 'P9_VERSION_CONFLICT',
      'P9_IDEMPOTENCY_MISMATCH', 'FOR UPDATE', 'phase9_owner_ux_input_session_fence',
      'phase9_owner_ux_safe_text', "'asOf'", 'phase9_owner_ux_review_blockers',
    ].forEach((marker) => expect(source).toContain(marker));
    expect(source).not.toMatch(/INSERT\s+INTO\s+public\.(store_inventory|marketplace_book_listings)/i);
    expect(source).not.toMatch(/UPDATE\s+public\.(store_inventory|marketplace_book_listings)/i);
    expect(source).not.toContain('phase9_commit_candidate(');
    expect(source).not.toContain('phase9_project_inventory(');
  });
});
