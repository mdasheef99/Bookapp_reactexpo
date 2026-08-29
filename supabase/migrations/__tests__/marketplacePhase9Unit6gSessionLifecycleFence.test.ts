import fs from 'fs';
import path from 'path';

const migrationName = '20260829000054_marketplace_phase9_unit6g_session_lifecycle_fence.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const sql = () => fs.readFileSync(migrationPath, 'utf8');

function functionBody(source: string, qualifiedName: string) {
  const escaped = qualifiedName.replaceAll('.', '\\.');
  return source.match(new RegExp(
    `CREATE OR REPLACE FUNCTION ${escaped}\\([\\s\\S]*?\\$\\$;`, 'u',
  ))?.[0] ?? '';
}

describe('Phase 9 Unit 6G M54 session lifecycle fence', () => {
  it('is one forward migration after immutable M53', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(migrationName).toMatch(/^20260829000054_/u);
  });

  it('defines one shared mutable predicate and a locking mutation boundary', () => {
    const source = sql();
    const lock = functionBody(source,
      'marketplace_sec.phase9_owner_ux_lock_active_session');
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_session_mutable(',
    );
    expect(lock).toContain('FOR UPDATE');
    expect(lock).toContain('phase9_owner_ux_assert_owner()');
    expect(lock).toContain('phase9_owner_ux_session_mutable(v_session)');
    expect(lock).toContain("RAISE EXCEPTION 'P9_STATE_CONFLICT'");
    expect(lock).toContain("RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'");
  });

  it.each([
    'public.phase9_update_candidate_review_v2',
    'public.phase9_add_candidate_to_inventory_v1',
    'public.phase9_owner_remove_candidate_v1',
  ])('%s preserves replay before acquiring the active-session effect lock', (name) => {
    const body = functionBody(sql(), name);
    expect(body).toContain('marketplace_sec.phase9_replay(');
    expect(body).toContain('marketplace_sec.phase9_owner_ux_lock_active_session(');
    expect(body).toContain('FOR UPDATE');
    expect(body.indexOf('marketplace_sec.phase9_replay(')).toBeLessThan(
      body.indexOf('marketplace_sec.phase9_owner_ux_lock_active_session('),
    );
    expect(body.indexOf('marketplace_sec.phase9_owner_ux_lock_active_session(')).toBeLessThan(
      body.indexOf('FOR UPDATE'),
    );
  });

  it('makes detail, batch and completed Save replay read-only when session mutation is denied', () => {
    const source = sql();
    const detail = functionBody(source, 'public.phase9_owner_candidate_detail_v2');
    const batch = functionBody(source, 'marketplace_sec.phase9_unit6g_batch_card');
    const save = functionBody(source, 'public.phase9_update_candidate_review_v2');
    expect(detail).toContain('phase9_owner_ux_session_mutable(v_session)');
    expect(detail).toContain('phase9_owner_ux_read_only_candidate_detail(');
    expect(batch).toContain('phase9_owner_ux_session_mutable(p_session)');
    expect(save).toContain('phase9_owner_ux_read_only_candidate_detail(v_replay)');
  });

  it('changes only functions and preserves public signatures and narrow grants', () => {
    const source = sql();
    expect(source).not.toMatch(/\b(?:ALTER TABLE|CREATE TABLE|DROP TABLE)\b/iu);
    expect(source).not.toMatch(/CREATE POLICY|ALTER POLICY|DISABLE ROW LEVEL SECURITY/iu);
    expect(source).toContain("SET search_path=''");
    expect(source).toContain('OWNER TO postgres');
    expect(source).toContain('FROM PUBLIC,anon');
    expect(source).toContain('TO authenticated');
  });
});
