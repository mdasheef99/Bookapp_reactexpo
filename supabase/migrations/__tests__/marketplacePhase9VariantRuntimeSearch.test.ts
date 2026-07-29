import fs from 'fs';
import path from 'path';

const migration20 =
  '20260729000020_marketplace_phase9_variant_runtime_search.sql';
const migration21 =
  '20260729000021_marketplace_phase9_defer_active_variant_search.sql';
const read = (migration: string) => fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'migrations', migration),
  'utf8',
);

describe('Phase 9 Unit 5C-3 lifecycle boundary after M21 scope correction', () => {
  it('preserves forward migration history after M19 without destructive data operations', () => {
    expect(fs.existsSync(path.join(
      process.cwd(), 'supabase', 'migrations', migration20,
    ))).toBe(true);
    expect(fs.existsSync(path.join(
      process.cwd(), 'supabase', 'migrations', migration21,
    ))).toBe(true);
    expect(`${read(migration20)}\n${read(migration21)}`)
      .not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
  });

  it('permits only trusted proposed-to-active and proposed/active-to-stale transitions', () => {
    const text = read(migration21);
    expect(text).toContain('phase9_reconcile_search_variants');
    expect(text).toMatch(/WHERE id=v_proposal\.id AND status='proposed'/i);
    expect(text).toMatch(/status='stale'[\s\S]*search_eligible=false/i);
    const staleBranch = text.match(
      /ELSIF v_proposal\.status='stale'[\s\S]*?END IF;/i,
    )?.[0] ?? '';
    expect(staleBranch).not.toMatch(/UPDATE public\.phase9_search_variant_proposals/i);
  });

  it('derives store and exact field confirmation on the server', () => {
    const text = read(migration20);
    expect(text).toContain('owner_review_snapshot');
    expect(text).toContain('observed_title');
    expect(text).toContain('observed_authors');
    expect(text).toContain('P9_CROSS_TENANT_DENIED');
  });

  it('defers Unit 5C-4 alias materialization and public search consumption', () => {
    const text = read(migration21);
    expect(text).toMatch(/DROP FUNCTION public\.phase9_active_variant_listing_ids\(text\)/i);
    expect(text).toMatch(
      /DROP FUNCTION marketplace_sec\.phase9_materialize_search_variant\(uuid\)/i,
    );
    expect(text).toContain('phase9_search_variant_private_foundation_check');
    expect(text).not.toMatch(/INSERT\s+INTO\s+public\.book_search_aliases/i);
  });

  it('keeps mutation RPC-only and fixed-search-path', () => {
    const text = read(migration21);
    expect(text).toContain("SET search_path=''");
    expect(read(migration20)).toMatch(
      /GRANT\s+EXECUTE[\s\S]*phase9_reconcile_search_variants[\s\S]*TO\s+service_role/i,
    );
    expect(text).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|MAINTAIN|ALL)[\s\S]*phase9_search_variant_proposals[\s\S]*TO\s+service_role/i,
    );
  });
});
