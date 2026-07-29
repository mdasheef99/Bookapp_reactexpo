import fs from 'fs';
import path from 'path';

const migrationName =
  '20260729000022_marketplace_phase9_active_variant_search.sql';
const migrationPath = path.join(
  process.cwd(), 'supabase', 'migrations', migrationName,
);
const readSql = () => fs.readFileSync(migrationPath, 'utf8');

describe('Phase 9 Unit 5C-4 active variant materialization and search', () => {
  it('adds a forward-only proposal-to-alias linkage without rewriting M18-M21', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = readSql();
    expect(sql).toContain('CREATE TABLE public.phase9_search_variant_alias_links');
    expect(sql).toContain('proposal_id uuid PRIMARY KEY');
    expect(sql).toContain('alias_id uuid NOT NULL');
    expect(sql).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
  });

  it('materializes only active proposals against a same-store committed inventory', () => {
    const sql = readSql();
    expect(sql).toContain('marketplace_sec.phase9_materialize_search_variant');
    expect(sql).toMatch(/status<>'active'[\s\S]*NOT v_proposal\.search_eligible/i);
    expect(sql).toContain('committed_inventory_id');
    expect(sql).toContain('P9_CROSS_TENANT_DENIED');
    expect(sql).toMatch(/ON CONFLICT[\s\S]*DO UPDATE|ON CONFLICT[\s\S]*DO NOTHING/i);
    expect(sql).not.toMatch(
      /INSERT\s+INTO\s+public\.(?:store_inventory|marketplace_book_listings)/i,
    );
  });

  it('fails closed by checking proposal activity during alias search', () => {
    const sql = readSql();
    expect(sql).toContain('phase9_search_variant_alias_links');
    expect(sql).toMatch(/p\.status='active'\s+AND p\.search_eligible/i);
    expect(sql).toContain('link.retracted_at IS NULL');
    expect(sql).toMatch(
      /char_length\(\s*marketplace_sec\.phase9_variant_compare_key\(p_query\)\s*\)>0/i,
    );
    expect(sql).toMatch(/EXISTS\s*\(/i);
  });

  it('preserves public listing eligibility, response fields, and deduplication', () => {
    const sql = readSql();
    expect(sql).toContain('phase9_search_marketplace_listings');
    expect(sql).toContain('RETURNS TABLE');
    expect(sql).toContain('public_title');
    expect(sql).toContain('public_authors');
    expect(sql).toContain('isbn_10');
    expect(sql).toContain('isbn_13');
    expect(sql).toContain('public.phase9_public_listing_projection');
    expect(sql).toMatch(
      /phase9_search_marketplace_listings[\s\S]*SECURITY DEFINER SET search_path=''/i,
    );
    expect(sql).toMatch(
      /WHEN alias_match\.listing_id IS NOT NULL OR EXISTS\([\s\S]*source_type<>'automated'[\s\S]*THEN 3/i,
    );
    expect(sql).toMatch(/ORDER BY l\.updated_at DESC,l\.id/i);
  });

  it('keeps mutation RPC-only with fixed search paths and no client table DML', () => {
    const sql = readSql();
    expect(sql).toContain("SET search_path=''");
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.phase9_materialize_search_variant\(uuid,uuid\)[\s\S]*TO service_role/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL PRIVILEGES ON TABLE public\.phase9_search_variant_alias_links[\s\S]*FROM PUBLIC,anon,authenticated,service_role/i,
    );
    expect(sql).toMatch(
      /REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN[\s\S]*book_search_aliases[\s\S]*FROM service_role/i,
    );
  });
});
