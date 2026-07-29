import fs from 'fs';
import path from 'path';

const migrationName =
  '20260729000023_marketplace_phase9_active_variant_search_correction.sql';
const migrationPath = path.join(
  process.cwd(), 'supabase', 'migrations', migrationName,
);
const readSql = () => fs.readFileSync(migrationPath, 'utf8');

describe('Phase 9 Unit 5C-4 forward-only search correction', () => {
  it('keeps applied M22 immutable and replaces only the affected functions', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = readSql();
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION marketplace_sec.phase9_materialize_search_variant',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION marketplace_sec.phase9_internal_book_match',
    );
    expect(sql).not.toMatch(/DROP\s+(?:TABLE|FUNCTION)|TRUNCATE\s+TABLE/i);
  });

  it('fails closed unless source field, text, language, and script still reconcile', () => {
    const sql = readSql();
    expect(sql).toContain('observation_ordinal');
    expect(sql).toContain("'observation:%s:title'");
    expect(sql).toContain("'observation:%s:author:%s'");
    expect(sql).toMatch(
      /phase9_variant_reconciliation_outcome\([\s\S]*v_candidate,v_proposal[\s\S]*\)<>'equivalent'/i,
    );
    expect(sql).toContain('P9_VARIANT_SOURCE_MISMATCH');
  });

  it('preserves exact rank three while retaining partial alias eligibility', () => {
    const sql = readSql();
    expect(sql).toMatch(
      /ranked_alias\.alias_normalized=lower\(p_query\)[\s\S]*THEN 3 ELSE 4/i,
    );
    expect(sql).toMatch(
      /position\(lower\(p_query\) in a\.alias_normalized\)>0/i,
    );
    expect(sql).not.toMatch(
      /ranked_alias[\s\S]{0,180}position\(lower\(p_query\) in ranked_alias\.alias_normalized\)>0/i,
    );
  });
});
