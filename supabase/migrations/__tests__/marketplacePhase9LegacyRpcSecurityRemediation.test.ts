import fs from 'node:fs';
import path from 'node:path';

const migrationName =
  '20260817000047_marketplace_phase9_legacy_rpc_security_remediation.sql';
const migrationPath = path.join(
  process.cwd(), 'supabase', 'migrations', migrationName,
);

describe('Phase 9 legacy Marketplace RPC security remediation', () => {
  it('exists as a revoke-only forward migration for the obsolete RPCs', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION\n'
        + '  public.phase9_storefront_catalogue(uuid,integer,jsonb),\n'
        + '  public.phase9_listing_detail(uuid)\n'
        + 'FROM PUBLIC,anon,authenticated,service_role;',
    );
    expect(sql).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i);
    expect(sql).not.toMatch(/DROP\s+FUNCTION|ALTER\s+FUNCTION/i);
    expect(sql).not.toContain('phase9_public_listing_search_v2');
    expect(sql).not.toContain('phase9_public_listing_detail_v2');
  });

  it('does not mutate business data or Storage policy', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).not.toMatch(/INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|TRUNCATE/i);
    expect(sql).not.toMatch(/CREATE\s+(TABLE|INDEX)|ALTER\s+(TABLE|VIEW)|DROP\s+(TABLE|VIEW)/i);
    expect(sql).not.toMatch(/storage\.|storage\/|bucket/i);
  });
});
