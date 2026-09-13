import fs from 'fs';
import path from 'path';

const migrationName = '20260913000061_marketplace_phase9_representative_edition_cover.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const projectionMigrationPath = path.join(process.cwd(), 'supabase', 'migrations',
  '20260913000062_marketplace_phase9_representative_cover_detail_projection.sql');
const sql = () => fs.readFileSync(migrationPath, 'utf8');
const projectionSql = () => fs.readFileSync(projectionMigrationPath, 'utf8');

function functionBody(source: string, qualifiedName: string) {
  const escaped = qualifiedName.replaceAll('.', '\\.');
  return source.match(new RegExp(
    `CREATE OR REPLACE FUNCTION ${escaped}\\([\\s\\S]*?\\$\\$;`, 'u',
  ))?.[0] ?? '';
}

describe('Phase 9 representative-edition cover persistence', () => {
  it('is a forward-only M61 migration with no historical rewrite', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(sql()).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(sql()).not.toMatch(/UPDATE public\.store_inventory|DELETE FROM|TRUNCATE/iu);
  });

  it('keeps representative cover provenance private and service-only', () => {
    const source = sql();
    expect(source).toContain('CREATE TABLE marketplace_sec.phase9_metadata_representative_covers');
    expect(source).toContain('ENABLE ROW LEVEL SECURITY');
    expect(source).toContain('FROM PUBLIC,anon,authenticated,service_role');
    expect(source).toContain('GRANT EXECUTE ON FUNCTION public.phase9_store_metadata_representative_cover_v1');
    expect(source).toContain('TO service_role');
    expect(source).not.toContain('TO authenticated');
  });

  it('projects a labelled fallback but preserves exact cover and public publication behavior', () => {
    const source = sql();
    const summary = functionBody(source, 'marketplace_sec.phase9_unit6g_metadata_summary');
    const inventory = functionBody(source, 'marketplace_sec.phase9_set_inventory_representative_cover');
    expect(summary).toContain("'representativeCover'");
    expect(summary).toContain('outcome_source_attempt_id');
    expect(inventory).toContain('representative_cover');
    expect(inventory).toContain('outcome_source_attempt_id');
    expect(source).not.toMatch(/phase9_refresh_public_listing|public_listing|storefront/iu);
  });

  it('uses forward-only M62 to align standalone detail and review-save responses', () => {
    expect(fs.existsSync(projectionMigrationPath)).toBe(true);
    const source = projectionSql();
    expect(source).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(source).toContain('phase9_owner_ux_with_representative_cover');
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.phase9_owner_candidate_detail_v2');
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.phase9_update_candidate_review_v2');
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_with_representative_cover(jsonb)',
    );
    expect(source).toContain('FROM PUBLIC,anon,authenticated,service_role');
    expect(source).toContain(
      'GRANT EXECUTE ON FUNCTION public.phase9_owner_candidate_detail_v2(uuid,uuid)',
    );
    expect(source).toContain('TO authenticated');
    expect(source).not.toMatch(/ALTER TABLE|INSERT INTO|DELETE FROM|TRUNCATE/iu);
    expect(source).not.toMatch(/UPDATE public\.store_inventory/iu);
    expect(source).not.toMatch(/phase9_refresh_public_listing|public_listing|storefront/iu);
  });
});
