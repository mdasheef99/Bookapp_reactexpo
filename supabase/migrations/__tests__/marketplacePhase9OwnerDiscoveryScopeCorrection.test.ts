import fs from 'fs';
import path from 'path';

const m35Name = '20260810000035_marketplace_phase9_single_image_removal.sql';
const migrationName = '20260810000037_marketplace_phase9_owner_discovery_scope_correction.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const sql = () => fs.readFileSync(migrationPath, 'utf8');

describe('Phase 9 Owner discovery scope forward correction', () => {
  it('is a forward migration after local M36 and leaves already-live M35 immutable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(migrationName).toMatch(/^20260810000037_/u);
    const liveM35 = fs.readFileSync(
      path.join(process.cwd(), 'supabase', 'migrations', m35Name),
      'utf8',
    );
    const m35Count = liveM35.match(
      /'needsReviewCount',[\s\S]*?marketplace_sec\.phase9_owner_ux_needs_review\(c,s,transaction_timestamp\(\)\)\)/u,
    )?.[0] ?? '';
    expect(m35Count).not.toContain('s.store_id=v_store');
    expect(m35Count).not.toContain('s.created_by=auth.uid()');
  });

  it('scopes the global needs-review count to the resolved active store and actor', () => {
    const source = sql();
    const countQuery = source.match(
      /'needsReviewCount',[\s\S]*?marketplace_sec\.phase9_owner_ux_needs_review\(c,s,transaction_timestamp\(\)\)\)/u,
    )?.[0] ?? '';
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.phase9_owner_discover_session_v1()');
    expect(source).toContain("SET search_path=''");
    expect(countQuery).toContain('s.store_id=v_store');
    expect(countQuery).toContain('s.created_by=auth.uid()');
  });

  it('preserves the authenticated-only public RPC grant boundary', () => {
    const source = sql();
    expect(source).toContain('OWNER TO postgres');
    expect(source).toContain('FROM PUBLIC,anon');
    expect(source).toContain('TO authenticated');
    expect(source).not.toMatch(/TO\s+(?:anon|service_role)/u);
  });
});
