import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'supabase', 'migrations',
  '20260812000040_marketplace_phase9_safe_publication.sql');
const sql = fs.readFileSync(file, 'utf8');

describe('Phase 9 Unit 7B forward migration', () => {
  it('U7B-RT17 migration enforces primary fallback cardinality public promotion and no broad storage listing', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX inventory_media_one_primary_fallback_idx[\s\S]*WHERE role='primary_fallback'/u);
    expect(sql).toContain("bucket_id<>'inventory-photos'");
    expect(sql).toContain("validation_version IS NULL");
    expect(sql).toContain("'public_copy','private_scan',v_cap.bucket_id");
    expect(sql).toContain("'magick-wasm-0.0.41-webp','magick-wasm-0.0.41-strip'");
    expect(sql).toContain("'inventory-photos',p_target_path");
    expect(sql).toContain('source_media_asset_id');
    expect(sql).toMatch(/BEFORE UPDATE OF lifecycle_status OR DELETE ON public\.media_assets/u);
    expect(sql).toContain('phase9_refresh_listing_for_media_change');
    expect(sql).not.toMatch(/CREATE POLICY[\s\S]*storage\.objects[\s\S]*FOR SELECT TO (?:PUBLIC|anon)/iu);
  });

  it('uses dual versions, one projection trigger, intent-keyed retry and lease fencing', () => {
    expect(sql).toContain('p_expected_inventory_version');
    expect(sql).toContain('p_expected_publication_intent_version');
    expect(sql).toContain("'publication_retry:'||p_inventory_id::text||':'");
    expect(sql.match(/CREATE TRIGGER phase9_store_inventory_listing_sync/gu)).toHaveLength(1);
    expect(sql).toContain('lease_token IS DISTINCT FROM p_lease_token');
    expect(sql).toContain("job_kind<>'publication_retry'");
  });

  it('keeps one safe public DTO and retires obsolete callable surfaces', () => {
    for (const field of ['listingId','storeId','priceMinor','availabilityStatus',
      'friendlyInventoryFreshnessSignal']) expect(sql).toContain(`'${field}'`);
    for (const name of ['phase9_request_publication','phase9_retry_publication',
      'phase9_set_publication_state']) expect(sql).toMatch(new RegExp(
        `REVOKE ALL ON FUNCTION[\\s\\S]*?public\\.${name}`,
        'u',
      ));
  });
});
