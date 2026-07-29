import fs from 'fs';
import path from 'path';

const migration =
  '20260729000019_marketplace_phase9_search_variant_replay_fence.sql';
const file = path.join(process.cwd(), 'supabase', 'migrations', migration);
const sql = () => fs.readFileSync(file, 'utf8');

describe('Phase 9 Unit 5C-2 M19 replay-fence correction', () => {
  it('is a forward-only correction that preserves M18 and M01', () => {
    expect(fs.existsSync(file)).toBe(true);
    expect(migration).toMatch(/000019_/);
    expect(sql()).not.toMatch(
      /DROP\s+(?:TABLE|COLUMN)|ALTER\s+TABLE\s+public\.book_search_aliases/i,
    );
  });

  it('persists one immutable sidecar fingerprint per accepted analysis', () => {
    const text = sql();
    expect(text).toContain('phase9_search_variant_proposal_sets');
    expect(text).toContain('proposal_set_sha256');
    expect(text).toMatch(/analysis_result_id\s+uuid\s+PRIMARY\s+KEY/i);
    expect(text).toMatch(/CHECK\s*\(\s*proposal_set_sha256\s*~/i);
    expect(text).toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  });

  it('rejects changed accepted replays and rolls tentative inserts back', () => {
    const text = sql();
    expect(text).toContain(
      'phase9_persist_vision_analysis_with_variants_m18',
    );
    expect(text).toContain('P9_SEARCH_VARIANT_REPLAY_CONFLICT');
    expect(text).toMatch(
      /extensions\.digest\s*\(\s*coalesce\(p_variants,'null'::jsonb\)::text/i,
    );
    expect(text).toMatch(/FOR\s+UPDATE/i);
  });

  it('keeps the correction service-only with fixed empty search paths', () => {
    const text = sql();
    expect(text).toContain("SET search_path=''");
    expect(text).toMatch(
      /REVOKE\s+ALL[\s\S]*phase9_search_variant_proposal_sets[\s\S]*FROM[\s\S]*PUBLIC[\s\S]*anon[\s\S]*authenticated[\s\S]*service_role/i,
    );
    expect(text).toMatch(
      /GRANT\s+SELECT[\s\S]*phase9_search_variant_proposal_sets[\s\S]*TO\s+service_role/i,
    );
    expect(text).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|MAINTAIN|ALL)[\s\S]*phase9_search_variant_proposal_sets[\s\S]*TO\s+service_role/i,
    );
  });
});
