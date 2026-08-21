import fs from 'node:fs';
import path from 'node:path';

const migrationName =
  '20260817000048_marketplace_phase9_legacy_rpc_service_role_compatibility.sql';
const migrationPath = path.join(
  process.cwd(), 'supabase', 'migrations', migrationName,
);

describe('Phase 9 legacy Marketplace RPC service-role compatibility correction', () => {
  it('preserves only trusted service-role execution after customer revocation', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION\n'
        + '  public.phase9_storefront_catalogue(uuid, integer, jsonb),\n'
        + '  public.phase9_listing_detail(uuid)\n'
        + 'FROM PUBLIC, anon, authenticated;',
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION\n'
        + '  public.phase9_storefront_catalogue(uuid, integer, jsonb),\n'
        + '  public.phase9_listing_detail(uuid)\n'
        + 'TO service_role;',
    );
    expect(sql).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i);
    expect(sql).not.toMatch(/DROP\s+FUNCTION|ALTER\s+FUNCTION/i);
    expect(sql).not.toContain('phase9_public_listing_search_v2');
    expect(sql).not.toContain('phase9_public_listing_detail_v2');
  });

  it('does not mutate business data, schema objects, or Storage policy', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).not.toMatch(/INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|TRUNCATE/i);
    expect(sql).not.toMatch(/CREATE\s+(TABLE|INDEX)|ALTER\s+(TABLE|VIEW)|DROP\s+(TABLE|VIEW)/i);
    expect(sql).not.toMatch(/storage\.|storage\/|bucket/i);
  });
});
