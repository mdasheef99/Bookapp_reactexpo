import fs from 'fs';
import path from 'path';

const migration = '20260728000016_marketplace_phase9_sensitive_table_acl_correction.sql';
const file = path.join(process.cwd(), 'supabase', 'migrations', migration);
const sql = () => fs.readFileSync(file, 'utf8');

describe('Phase 9 M16 sensitive-table ACL correction', () => {
  it('is a narrow forward-only migration after M15 and does not reuse M09', () => {
    expect(fs.existsSync(file)).toBe(true);
    expect(migration).toMatch(/000016_/);
    expect(sql()).not.toMatch(/000009|DROP TABLE|DROP COLUMN|ALTER DEFAULT PRIVILEGES/i);
  });

  it('revokes every direct service-role mutation privilege from the four RPC-only tables', () => {
    const text = sql();
    [
      'public.vision_provider_attempts',
      'public.phase9_metadata_lookups',
      'public.phase9_metadata_cache_entries',
      'public.phase9_selected_metadata_snapshots',
    ].forEach((table) => expect(text).toContain(table));
    expect(text).toMatch(
      /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE,\s*TRUNCATE,\s*REFERENCES,\s*TRIGGER[\s\S]+FROM service_role/i,
    );
    expect(text).toMatch(/GRANT\s+SELECT[\s\S]+TO service_role/i);
  });

  it('preserves client denial without changing functions, data, or application behavior', () => {
    const text = sql();
    expect(text).toMatch(/REVOKE ALL[\s\S]+FROM PUBLIC,\s*anon,\s*authenticated/i);
    expect(text).not.toMatch(
      /\b(?:CREATE|ALTER|DROP)\s+(?:FUNCTION|TRIGGER|POLICY)\b|(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO|FROM)?\s*public\./i,
    );
  });
});
