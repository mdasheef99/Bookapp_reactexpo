import fs from 'fs';
import path from 'path';

const name = '20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql';
const file = path.join(process.cwd(), 'supabase', 'migrations', name);
const read = () => fs.readFileSync(file, 'utf8');
const entries = [
  ['phase9_automatic_edition_fence_v1', 'uuid,text,text,integer'],
  ['phase9_prepare_automatic_metadata_v1', 'jsonb,jsonb,boolean'],
] as const;

describe('Phase 9 U5 automatic worker prerequisites (02c §§4.3/5.1/9)', () => {
  // Catches changing an applied migration or adding schema objects to this expansion.
  it('adds exactly four new functions and no table or replacement DDL', () => {
    const sql = read();
    expect(name).toMatch(/^20261104000094_/u);
    expect(sql.match(/CREATE FUNCTION /gu)).toHaveLength(4);
    expect(sql).not.toMatch(/CREATE OR REPLACE|(?:CREATE|ALTER|DROP) TABLE|ROW LEVEL SECURITY/iu);
    expect([...sql.matchAll(/ALTER FUNCTION ([^(]+)/gu)].map(match => match[1]).sort()).toEqual(
      ['marketplace_sec','public'].flatMap(schema => entries.map(([entry]) => schema + '.' + entry)).sort());
    expect(sql.trim()).toMatch(/^--[\s\S]*\bBEGIN;[\s\S]*COMMIT;$/u);
  });

  // Catches a signature drift that would make PostgREST or delegated calls unresolved.
  it('declares the exact read and preparation arguments', () => {
    const sql = read().replace(/\s+/gu, '');
    for (const schema of ['marketplace_sec', 'public']) {
      expect(sql).toContain(schema + '.phase9_automatic_edition_fence_v1(' +
        'p_job_iduuid,p_workertext,p_lease_tokentext,p_attempt_countinteger)');
      expect(sql).toContain(schema + '.phase9_prepare_automatic_metadata_v1(' +
        'fjsonb,p_lookupjsonb,p_recheckboolean' + (schema === 'public' ? 'DEFAULTfalse' : '') + ')');
    }
    expect(sql).toContain('marketplace_sec.phase9_admission_fence_v1(f,false)');
    expect(sql).not.toContain('marketplace_sec.phase9_admission_fence_v1(f)');
  });

  for (const [entry, signature] of entries) {
    // Catches delegating definer authority to the public wrapper or losing the empty search path.
    it(entry + ' keeps private DEFINER and public INVOKER with empty search paths', () => {
      const sql = read();
      const blocks = sql.split('CREATE FUNCTION ').slice(1);
      const privateBody = blocks.find(block => block.startsWith('marketplace_sec.' + entry + '('));
      const publicBody = blocks.find(block => block.startsWith('public.' + entry + '('));
      expect(privateBody).toMatch(/RETURNS jsonb\s+LANGUAGE plpgsql SECURITY DEFINER SET search_path=''/u);
      expect(publicBody).toMatch(/RETURNS jsonb\s+LANGUAGE sql SECURITY INVOKER SET search_path=''/u);
      expect(publicBody).toContain('SELECT marketplace_sec.' + entry + '(');
    });

    // Catches default PUBLIC execute, authenticated access, or an incorrect function owner.
    it(entry + ' explicitly owns, revokes and grants both exact signatures', () => {
      const sql = read().replace(/\s+/gu, ' ');
      for (const schema of ['marketplace_sec', 'public']) {
        const target = schema + '.' + entry + '(' + signature + ')';
        expect(sql).toContain('ALTER FUNCTION ' + target + ' OWNER TO postgres;');
        expect(sql).toContain('REVOKE ALL ON FUNCTION ' + target + ' FROM PUBLIC,anon,authenticated,service_role;');
        expect(sql).toContain('GRANT EXECUTE ON FUNCTION ' + target + ' TO service_role;');
      }
      expect(sql).not.toMatch(/GRANT[^;]*\bTO (?:PUBLIC|anon|authenticated)\b/iu);
    });
  }
});
