import fs from 'fs';
import path from 'path';

const migration = '20260728000017_marketplace_phase9_maintain_acl_correction.sql';
const file = path.join(process.cwd(), 'supabase', 'migrations', migration);
const rollbackGate = path.join(
  process.cwd(), 'scripts', 'verify-phase9-m17-postgres17.ps1',
);
const sql = () => fs.readFileSync(file, 'utf8');

describe('Phase 9 M17 PostgreSQL 17 MAINTAIN ACL correction', () => {
  it('is a narrow forward-only migration after M16 and leaves M09 absent', () => {
    expect(fs.existsSync(file)).toBe(true);
    expect(migration).toMatch(/000017_/);
    expect(sql()).not.toMatch(
      /000009|DROP TABLE|DROP COLUMN|ALTER DEFAULT PRIVILEGES/i,
    );
  });

  it('resets exactly four service-role ACLs before restoring SELECT only', () => {
    const text = sql();
    [
      'public.vision_provider_attempts',
      'public.phase9_metadata_lookups',
      'public.phase9_metadata_cache_entries',
      'public.phase9_selected_metadata_snapshots',
    ].forEach((table) => expect(text).toContain(table));
    expect(text).toMatch(
      /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+TABLE[\s\S]+FROM\s+service_role/i,
    );
    expect(text).toMatch(/GRANT\s+SELECT\s+ON\s+TABLE[\s\S]+TO\s+service_role/i);
    expect(text).toMatch(
      /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+TABLE[\s\S]+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(text).not.toMatch(
      /\b(?:CREATE|ALTER|DROP)\s+(?:FUNCTION|TRIGGER|POLICY)\b|(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO|FROM)?\s*public\./i,
    );
  });

  it('retains a rollback-only PostgreSQL 17 effective-privilege gate', () => {
    expect(fs.existsSync(rollbackGate)).toBe(true);
    const gate = fs.readFileSync(rollbackGate, 'utf8');
    expect(gate).toContain("current_setting('server_version_num')");
    expect(gate).toContain("'MAINTAIN'");
    expect(gate).toContain('has_table_privilege');
    expect(gate).toContain('ROLLBACK;');
    expect(gate).toContain('P9_M17_ROLLBACK_INCOMPLETE');
    expect(gate).toContain('--no-password');
  });
});
