import fs from 'fs';
import path from 'path';

const migrationName = '20260827000053_marketplace_phase9_unit6g_field_authority_correction.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const sql = () => fs.readFileSync(migrationPath, 'utf8');

describe('Phase 9 Unit 6G M53 field-authority correction', () => {
  it('is one forward migration after immutable M52', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(migrationName).toMatch(/^20260827000053_/u);
  });

  it('replaces the internal safe-summary, field-source, and batch-card projection helpers', () => {
    const source = sql();
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_metadata_summary(',
    );
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_field_sources(',
    );
    expect(source).toContain('marketplace_sec.phase9_owner_ux_valid_review(v_review)');
    expect(source).toContain("p_candidate.review_disposition='reviewed'");
    expect(source).toContain('p_candidate.review_version IS NOT NULL');
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_batch_card(',
    );
    expect(source).not.toMatch(/CREATE OR REPLACE FUNCTION public\./u);
    expect(source).not.toMatch(/phase9_add_candidate_to_inventory|phase9_close_session/u);
  });

  it('derives sources only from usable backing authority and preserves empty-author missing', () => {
    const source = sql();
    expect(source).toContain("p_detail#>>'{metadata,state}'='selected'");
    expect(source).toContain("jsonb_array_length(v_review->'authors')=0 THEN 'missing'");
    expect(source).toContain("WHEN v_selected_title THEN 'matched'");
    expect(source).toContain("WHEN v_observed_title THEN 'detected'");
    expect(source).toContain("WHEN p_session.default_condition IS NOT NULL THEN 'default'");
    expect(source).toContain('marketplace_sec.phase9_owner_ux_safe_text');
    expect(source).toContain('marketplace_sec.phase9_owner_ux_canonical_language');
    expect(source).toContain("'authors',CASE WHEN v_authors THEN v_metadata->'authors' ELSE 'null'::jsonb END");
    expect(source).toMatch(/'coverReference',CASE WHEN v_cover\s+THEN v_metadata->'coverReference' ELSE 'null'::jsonb END/u);
    expect(source).toContain(
      'v_summary:=marketplace_sec.phase9_unit6g_metadata_summary(v_detail);',
    );
  });

  it('has no table, data, privilege, RLS, or public RPC mutation', () => {
    const source = sql();
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER TABLE|CREATE TABLE|DROP TABLE)\b/iu);
    expect(source).not.toMatch(/GRANT\s+/iu);
    expect(source).not.toMatch(/CREATE POLICY|ALTER POLICY|DISABLE ROW LEVEL SECURITY/iu);
    expect(source).toContain('SECURITY DEFINER');
    expect(source).toContain("SET search_path=''");
    expect(source).toContain('OWNER TO postgres');
    expect(source).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC,anon,authenticated/u);
  });
});
