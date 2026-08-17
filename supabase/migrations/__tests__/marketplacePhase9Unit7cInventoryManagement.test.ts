import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'supabase', 'migrations',
  '20260814000043_marketplace_phase9_unit7c_inventory_management.sql');
const sql = fs.readFileSync(file, 'utf8');

function section(start: string, end: string) {
  const from = sql.indexOf(start);
  const to = sql.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return sql.slice(from, to);
}

describe('Phase 9 Unit 7C WU1 forward migration', () => {
  it('adds only controlled Save Stock Store View and narrow append-only history surfaces', () => {
    for (const name of [
      'phase9_update_store_inventory_details_v1',
      'phase9_adjust_inventory_stock_v2',
      'phase9_store_view_page_v1',
      'phase9_store_view_detail_v1',
      'phase9_publication_revisions',
      'phase9_append_publication_revision_v1',
    ]) expect(sql).toContain(name);
    expect(sql).toContain('phase9_publication_revisions_append_only');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FROM PUBLIC,anon,authenticated,service_role');
  });

  it('keeps Owner commands on inventory and the real trigger instead of directly writing listings', () => {
    const save = section('CREATE FUNCTION public.phase9_update_store_inventory_details_v1(',
      'CREATE FUNCTION public.phase9_adjust_inventory_stock_v2(');
    const stock = section('CREATE FUNCTION public.phase9_adjust_inventory_stock_v2(',
      'CREATE FUNCTION marketplace_sec.phase9_store_view_item_v1(');
    expect(save).not.toContain('INSERT INTO public.marketplace_book_listings');
    expect(save).not.toContain('UPDATE public.marketplace_book_listings');
    expect(stock).not.toContain('INSERT INTO public.marketplace_book_listings');
    expect(stock).not.toContain('UPDATE public.marketplace_book_listings');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.sync_marketplace_listing_from_inventory()');
  });

  it('omits generated and default-owned listing fields from explicit projection writes', () => {
    const projection = section(
      'CREATE OR REPLACE FUNCTION public.sync_marketplace_listing_from_inventory()',
      'CREATE FUNCTION public.phase9_update_store_inventory_details_v1(',
    );
    const insertColumns = projection.match(
      /INSERT INTO public\.marketplace_book_listings\(([^]*?)\) VALUES\(/u,
    )?.[1] ?? '';
    expect(insertColumns).not.toMatch(/\bid\b/u);
    expect(insertColumns).not.toContain('authors_text');
    expect(insertColumns).not.toContain('published_at');
    expect(projection).not.toMatch(/authors_text\s*=/u);
    expect(projection).not.toMatch(/published_at\s*=/u);
    expect(projection).toContain('search_document=excluded.search_document');
  });

  it('keeps initial zero-stock publication ineligible but permits live stock projection', () => {
    expect(sql).toContain("v_reason IS NOT NULL AND v_reason<>'stock'");
    expect(sql).toContain("NEW.quantity_available=0 THEN 'out_of_stock'");
    expect(sql).toContain("ELSE 'unavailable' END");
    expect(sql).not.toContain('CREATE FUNCTION public.phase9_set_publication_state_v3');
  });

  it('uses one version increment one bounded audit/event and hashed replay fingerprints per command', () => {
    for (const operation of ['U7CC01', 'U7CC02']) expect(sql).toContain(operation);
    expect(sql.match(/version=version\+1/gu)).toHaveLength(3);
    expect(sql.match(/INSERT INTO public\.marketplace_audit_logs/gu)).toHaveLength(3);
    expect(sql.match(/INSERT INTO public\.marketplace_events/gu)).toHaveLength(3);
    expect(sql).toContain("extensions.digest(concat_ws('|',auth.uid(),p_command_id");
  });
});
