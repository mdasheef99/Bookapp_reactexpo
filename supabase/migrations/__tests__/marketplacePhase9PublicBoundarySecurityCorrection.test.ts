import fs from 'fs';
import path from 'path';

const migrationName = '20260722000010_marketplace_phase9_public_boundary_security_correction.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);

describe('Phase 9 public-boundary forward security correction', () => {
  it('uses M10 and leaves the reserved M09 filename absent', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const phase9Files = fs.readdirSync(path.join(process.cwd(), 'supabase', 'migrations'))
      .filter((name) => name.includes('marketplace_phase9'));
    expect(phase9Files.some((name) => /^20260722000009_/.test(name))).toBe(false);
  });

  it('makes the projection invoker-safe and removes every direct role grant', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain(
      'ALTER VIEW public.phase9_public_listing_projection SET (security_invoker=true)',
    );
    expect(sql).toContain(
      'REVOKE ALL ON public.phase9_public_listing_projection FROM PUBLIC,anon,authenticated,service_role',
    );
    expect(sql).not.toMatch(/GRANT\s+SELECT\s+ON\s+public\.phase9_public_listing_projection/i);
  });

  it('restores only the three public discovery RPCs without wildcard grant logic', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    [
      'public.phase9_marketplace_store_search(text,integer,jsonb)',
      'public.phase9_storefront_catalogue(uuid,integer,jsonb)',
      'public.phase9_listing_detail(uuid)',
    ].forEach((signature) => expect(sql).toContain(signature));
    expect(sql.match(/\bTO anon\b/g)).toHaveLength(1);
    expect(sql).not.toMatch(/proname\s+LIKE\s+'phase9_%'/i);
    expect(sql).not.toMatch(/\bDO\s+\$\$/i);
    expect(sql).not.toContain('phase9_request_photo');
    expect(sql).not.toContain('marketplace_sec.');
  });
});
