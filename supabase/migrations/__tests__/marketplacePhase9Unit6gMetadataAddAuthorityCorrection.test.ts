import fs from 'fs';
import path from 'path';

const migrationName = '20260830000055_marketplace_phase9_unit6g_metadata_add_authority_correction.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const sql = () => fs.readFileSync(migrationPath, 'utf8');

function functionBody(source: string, qualifiedName: string) {
  const escaped = qualifiedName.replaceAll('.', '\\.');
  return source.match(new RegExp(
    `CREATE OR REPLACE FUNCTION ${escaped}\\([\\s\\S]*?\\$\\$;`, 'u',
  ))?.[0] ?? '';
}

describe('Phase 9 Unit 6G bounded metadata/Add authority correction', () => {
  it('is a forward-only M55 migration after the lifecycle fence', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(migrationName).toMatch(/^20260830000055_/u);
    expect(sql()).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
  });

  it('carries selected snapshot identity into compact metadata summaries', () => {
    const body = functionBody(sql(), 'marketplace_sec.phase9_unit6g_metadata_summary');
    expect(body).toContain("p_detail#>'{metadata,selectionId}'");
    expect(body).toContain("'selectionId'");
    expect(body).toContain('v_selection_id:=');
    expect(body).toMatch(/v_selection_id[\s\S]*~\*/iu);
  });

  it('keeps review authors optional but requires authors at the Add boundary', () => {
    const source = sql();
    const identity = functionBody(source, 'marketplace_sec.phase9_metadata_candidate_query_identity');
    const blockers = functionBody(source, 'marketplace_sec.phase9_owner_ux_review_blockers');
    const commit = functionBody(source, 'marketplace_sec.phase9_unit7a_commit_eligible');
    const batch = functionBody(source, 'marketplace_sec.phase9_unit6g_batch_card');
    expect(identity).toContain("THEN 'bibliographic' ELSE 'isbn' END");
    expect(blockers).not.toContain('duplicate_intent_missing');
    expect(commit).toContain("jsonb_array_length(coalesce(r->'authors','[]'::jsonb))<1");
    expect(batch).toContain('marketplace_sec.phase9_unit7a_commit_eligible(p_candidate)');
  });

  it('does not mutate tables, rows, policies, or public RPC signatures', () => {
    const source = sql();
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER TABLE|CREATE TABLE|DROP TABLE)\b/iu);
    expect(source).not.toMatch(/CREATE POLICY|ALTER POLICY|DISABLE ROW LEVEL SECURITY/iu);
    expect(source).not.toMatch(/CREATE OR REPLACE FUNCTION public\./u);
    expect(source).toContain('OWNER TO postgres');
    expect(source).toContain('REVOKE ALL ON FUNCTION');
  });
});
