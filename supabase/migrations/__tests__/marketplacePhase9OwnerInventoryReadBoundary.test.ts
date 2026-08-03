import fs from 'node:fs';
import path from 'node:path';

const migrationName = '20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const addendumPath = path.join(
  process.cwd(),
  'docs',
  'multi-tenant-bookstore-marketplace',
  'implementation',
  'phase-9-image-inventory',
  'work-units',
  'owner-inventory-read-boundary-wu1-sdd.md',
);
const evidencePath = path.join(
  process.cwd(),
  'docs',
  'multi-tenant-bookstore-marketplace',
  'implementation',
  'phase-9-image-inventory',
  'trackers',
  '25-owner-inventory-read-boundary-wu1-evidence.md',
);
const validatorPath = path.join(
  process.cwd(),
  'docs',
  'multi-tenant-bookstore-marketplace',
  'implementation',
  'phase-9-image-inventory',
  'scripts',
  'validate-phase9-continuity.ps1',
);

function read(filePath: string) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Phase 9 WU1 owner-inventory read boundary', () => {
  it('is a new addendum with an exact applied receipt', () => {
    expect(fs.existsSync(addendumPath)).toBe(true);
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(read(addendumPath)).toContain('Application checkpoint (2026-08-04)');
    expect(read(evidencePath)).toContain('WU1_LIVE_APPLICATION=TRUE');
    expect(migrationName).toMatch(/^20260803000031_/u);
  });

  it('preserves the stable detail RPC without redefining it', () => {
    const sql = read(migrationPath);
    expect(sql).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.phase9_owner_inventory\s*\(/iu);
    expect(sql).not.toMatch(/ALTER\s+FUNCTION\s+public\.phase9_owner_inventory\s*\(/iu);
  });

  it('defines the separate paginated list RPC with the exact read boundary', () => {
    const sql = read(migrationPath);
    expect(sql).toMatch(
      /CREATE FUNCTION public\.phase9_owner_inventory_page_v1\(\s*p_page_size integer DEFAULT 25,\s*p_cursor text DEFAULT NULL,\s*p_query text DEFAULT NULL,\s*p_condition text DEFAULT NULL,\s*p_visibility_status text DEFAULT NULL,\s*p_quantity_state text DEFAULT NULL,\s*p_entry_method text DEFAULT NULL,\s*p_date_added text DEFAULT NULL\s*\)/isu,
    );
    [
      "'id'",
      "'store_id'",
      "'title'",
      "'authors'",
      "'isbn_10'",
      "'isbn_13'",
      "'condition'",
      "'quantity_available'",
      "'selling_price_minor'",
      "'visibility_status'",
      "'listing_quality_status'",
      "'public_notes'",
      "'shelf_location'",
      "'entry_method'",
      "'created_at'",
      "'updated_at'",
      "'version'",
    ].forEach((field) => expect(sql).toContain(field));
    expect(sql).toContain("'items'");
    expect(sql).toContain("'pageInfo'");
    expect(sql).toContain("'nextCursor'");
    expect(sql).toContain("'hasMore'");
  });

  it('uses signed, context-bound keyset pagination over updated_at and id', () => {
    const sql = read(migrationPath);
    [
      'phase9_owner_ux_cursor_payload',
      'phase9_owner_ux_cursor',
      "'kind', 'inventory'",
      "'actor', auth.uid()",
      "'store'",
      "'query'",
      "'condition'",
      "'visibility'",
      "'quantity'",
      "'entry'",
      "'dateAdded'",
      "'size'",
      "'contract', 'phase9-owner-inventory-v1'",
      "'order', 'updated_at.desc,id.desc'",
      "'asOf'",
      "'updatedAt'",
      "'id'",
      'P9_CURSOR_INVALID',
      'updated_at DESC',
      'id DESC',
      '(i.updated_at,i.id)<(v_after_updated_at,v_after_id)',
    ].forEach((marker) => expect(sql).toContain(marker));
    expect(sql).not.toMatch(/\bOFFSET\b/iu);
  });

  it('enforces bounded filters, server-derived ownership, and narrow grants', () => {
    const sql = read(migrationPath);
    const sdd = read(addendumPath);
    [
      'phase9_owner_ux_assert_owner()',
      'P9_REQUEST_INVALID',
      "p_page_size NOT BETWEEN 1 AND 50",
      "'last_7_days'",
      "'last_30_days'",
      "'manual'",
      "'image_extraction'",
      "'metadata_import'",
      "'new'",
      "'like_new'",
      "'very_good'",
      "'good'",
      "'acceptable'",
      "'draft'",
      "'needs_review'",
      "'published'",
      "'paused'",
      "'out_of_stock'",
      "'blocked'",
      'SECURITY DEFINER',
      "SET search_path=''",
      'ALTER FUNCTION public.phase9_owner_inventory_page_v1',
      'OWNER TO postgres',
      'REVOKE ALL ON FUNCTION public.phase9_owner_inventory_page_v1',
      'FROM PUBLIC,anon',
      'TO authenticated',
      'TO service_role',
    ].forEach((marker) => expect(sql).toContain(marker));
    expect(sdd).toContain('P9_AUTH_REQUIRED');
    expect(sdd).toContain('P9_OWNER_NOT_AUTHORIZED');
    expect(sql).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE).*store_inventory/iu);
    expect(sql).not.toMatch(/CREATE\s+POLICY/iu);
  });

  it('adds only the evidence-backed tenant/order index and documents the same contract', () => {
    const sql = read(migrationPath);
    const sdd = read(addendumPath);
    expect(sql).toContain('CREATE INDEX store_inventory_owner_read_page_idx');
    expect(sql).toContain('(store_id, updated_at DESC, id DESC)');
    expect(sdd).toContain('phase9_owner_inventory(uuid)');
    expect(sdd).toContain('phase9_owner_inventory_page_v1');
    expect(sdd).toContain('updated_at DESC, id DESC');
    expect(sdd).not.toContain('updated_at DESC, inventory_id DESC');
    expect(sdd).toContain('applied exactly once');
  });

  it('fails closed for NULL page size and normalizes unexpected SQL failures', () => {
    const sql = read(migrationPath);
    expect(sql).toContain('p_page_size IS NULL');
    expect(sql).toContain('EXCEPTION WHEN others THEN');
    expect(sql).toContain("'P9_INTERNAL_ERROR'");
  });

  it('states the asOf guarantee without claiming a full repeatable snapshot', () => {
    const sdd = read(addendumPath);
    expect(sdd).toContain('ordering horizon');
    expect(sdd).toMatch(/not a repeatable database\s+snapshot/u);
    expect(sdd).not.toContain('first-page `asOf` snapshot');
    expect(sdd).toContain('does not modify those write paths');
  });

  it('narrows cursor decoding errors and preserves unexpected errors for outer mapping', () => {
    const sql = read(migrationPath);
    const cursorBlock = sql.slice(
      sql.indexOf('IF p_cursor IS NOT NULL THEN'),
      sql.indexOf('WITH eligible AS'),
    );
    expect((sql.match(/EXCEPTION WHEN others THEN/giu) ?? []).length).toBe(1);
    expect(cursorBlock).not.toMatch(/v_payload\s*:=.*?EXCEPTION WHEN others THEN/isu);
    expect(cursorBlock).toMatch(
      /BEGIN\s+v_as_of\s*:=.*?v_after_id\s*:=.*?EXCEPTION\s+WHEN invalid_text_representation OR datetime_field_overflow THEN\s+RAISE EXCEPTION 'P9_CURSOR_INVALID'/isu,
    );
  });

  it('makes WU1 artifacts and boundary invariants continuity-gated', () => {
    const validator = read(validatorPath);
    const evidence = read(evidencePath);
    expect(validator).toContain('work-units/owner-inventory-read-boundary-wu1-sdd.md');
    expect(validator).toContain('trackers/25-owner-inventory-read-boundary-wu1-evidence.md');
    expect(validator).toContain('supabase/migrations/__tests__/marketplacePhase9OwnerInventoryReadBoundary.test.ts');
    expect(validator).toContain('supabase/tests/phase9/phase9OwnerInventoryReadBoundary.integration.test.mjs');
    expect(validator).toContain('p_page_size IS NULL');
    expect(validator).toContain('P9_INTERNAL_ERROR');
    expect(validator).toContain('WU1_DIFF_CHECK=PASS');
    expect(validator).toContain('REPOSITORY_DIFF_CHECK=');
    expect(validator).toContain('git diff --check --');
    expect(evidence).toContain('WU1_NO_LIVE_APPLICATION=TRUE');
    expect(evidence).toContain('WU1_NO_CLIENT_UI_SERVICE_OR_STALE_CODE_CHANGE=TRUE');
    expect(evidence).toContain('WU1_NO_WRITE_PATH_OR_DASHBOARD_CHANGE=TRUE');
  });
});
