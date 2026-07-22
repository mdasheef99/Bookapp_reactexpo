import fs from 'fs';
import path from 'path';

const names = [
  '20260722000001_marketplace_phase9_catalogue_metadata_expand.sql',
  '20260722000002_marketplace_phase9_extraction_persistence.sql',
  '20260722000003_marketplace_phase9_media_registry.sql',
  '20260722000004_marketplace_phase9_condition_damage_transition.sql',
  '20260722000005_marketplace_phase9_controlled_inventory_commands.sql',
  '20260722000006_marketplace_phase9_storage_boundaries.sql',
  '20260722000007_marketplace_phase9_public_projection_search.sql',
  '20260722000008_marketplace_phase9_request_photo_seam.sql',
];
const read = (name: string) => fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', name), 'utf8');
const all = () => names.map(read).join('\n');

describe('Phase 9 M01-M08 migration contracts', () => {
  it('anchors the fixture to the complete ordered Phase 6 migration ledger and live names', () => {
    const phase6 = fs.readdirSync(path.join(process.cwd(), 'supabase', 'migrations'))
      .filter((name) => /202607160000\d{2}_marketplace_phase6_.*\.sql/.test(name)).sort();
    expect(phase6).toHaveLength(39);
    expect(phase6[0]).toMatch(/^20260716000001_/);
    expect(phase6[38]).toMatch(/^20260716000039_/);
    const baseline = fs.readFileSync(path.join(process.cwd(), 'supabase', 'tests', 'phase9', 'phase6_baseline.sql'), 'utf8');
    ['display_name','setup_status','selling_status','source_book_id','selling_price_minor',
      'visibility_status','public_title','public_authors','user_id','actor_user_id','release_reason_code']
      .forEach((column) => expect(baseline).toContain(column));
    expect(baseline).not.toContain('is_setup_complete');
    expect(baseline).not.toContain('selling_allowed');
  });

  it('contains exactly the eight approved ordered groups and no M09', () => {
    names.forEach((name) => expect(fs.existsSync(path.join(process.cwd(), 'supabase', 'migrations', name))).toBe(true));
    expect(names).toHaveLength(8);
    expect(all()).not.toContain('VALIDATE CONSTRAINT store_inventory_quantity_balance');
  });

  it('implements provider registry, aliases, additive snapshots and deferred FK order', () => {
    const sql = all();
    expect(sql).toContain('CREATE TABLE public.phase9_provider_registry');
    expect(sql).toContain("'transliteration','translation','common_spelling','recognized_title'");
    ['store_inventory_created_from_candidate_fk','candidate_metadata_attempt_fk','input_media_asset_fk',
      'listing_primary_public_media_fk','capability_consumed_media_fk','media_request_photo_request_fk']
      .forEach((name) => expect(sql).toContain(name));
  });

  it('persists sessions, language, cap rejection, capabilities, jobs and candidates', () => {
    const sql = read(names[1]);
    ['image_extraction_sessions','image_extraction_inputs','image_extraction_candidates',
      'phase9_upload_capabilities','image_extraction_jobs'].forEach((table) => expect(sql).toContain(table));
    expect(sql).toContain('detected_candidate_count BETWEEN 0 AND 15');
    expect(sql).toContain('selected_language');
    expect(sql).toContain("status IN ('issued','consumed','revoked','failed','expired')");
  });

  it('implements claim/lease/retry/dead-letter and exact cost uniqueness', () => {
    const sql = read(names[1]);
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain("interval '5 minutes'");
    expect(sql).toContain("'dead_letter'");
    expect(sql).toContain('UNIQUE(store_id,job_id,cost_kind,policy_version)');
  });

  it('makes the condition transition executable and damage orthogonal', () => {
    const sql = read(names[3]);
    expect(sql.indexOf('store_inventory_condition_compat_check')).toBeLessThan(sql.indexOf("SET condition='acceptable'"));
    expect(sql).toContain("condition IN ('new','like_new','very_good','good','acceptable')");
    expect(sql).toContain("WHERE condition='damaged'");
    expect(sql).toContain('has_damage');
  });

  it('provides named, server-authorized, idempotent command/query boundaries', () => {
    const sql = read(names[4]);
    ['phase9_start_session','phase9_authorize_upload','phase9_consume_upload_capability',
      'phase9_accept_scan_input',
      'phase9_owner_session_summary','phase9_commit_candidate','phase9_request_publication',
      'phase9_retry_publication','phase9_adjust_inventory_quantity','phase9_needs_review',
      'phase9_candidate_detail','phase9_edit_inventory_metadata','phase9_edit_inventory_commercial',
      'phase9_edit_inventory_condition_damage','phase9_set_publication_state']
      .forEach((fn) => expect(sql).toContain(fn));
    expect(sql).toContain('phase9_owner_store');
    expect(sql).toContain('phase9_idempotency_keys');
    ['C01','C02','C03','C04','C05','C06','C07','C11','C12','C13','C14','C15','C16',
      'C17','C18','C19','C20','C21','C22','C23','C24','C25','C26','C28']
      .forEach((command) => expect(all()).toContain(`'${command}'`));
    ['commit_idempotency_key','P9_IDEMPOTENCY_MISMATCH','FOR UPDATE']
      .forEach((marker) => expect(sql).toContain(marker));
  });

  it('denies broad authenticated private access and separates worker grants', () => {
    const sql = all();
    expect(sql).toContain('FROM PUBLIC,anon,authenticated');
    expect(sql).toContain('TO service_role');
    expect(sql).not.toContain('GRANT SELECT ON public.image_extraction_sessions TO authenticated');
    expect(sql).not.toContain('GRANT EXECUTE ON FUNCTION marketplace_sec.claim_phase9_jobs(integer,text,boolean) TO authenticated');
  });

  it('uses typed media and server-only storage policies', () => {
    const sql = `${read(names[2])}\n${read(names[5])}`;
    expect(sql).toContain('media_assets_purpose_privacy_check');
    expect(sql).toContain("'marketplace-media-staging'");
    expect(sql).toContain("'order-request-photos'");
    expect(sql).not.toContain('REVOKE ALL ON storage.objects FROM PUBLIC,anon,authenticated');
    expect(sql).not.toContain('REVOKE ALL ON storage.buckets FROM PUBLIC,anon,authenticated');
    expect(sql).toContain('CREATE POLICY "mkt owner upload"');
    expect(sql).not.toMatch(/bucket_id IN \([^)]*'(?:image-extraction-inputs|inventory-photos)'/);
  });

  it('projects only safe fields and groups stores before pagination', () => {
    const sql = read(names[6]);
    expect(sql).toContain('phase9_public_listing_projection');
    expect(sql.indexOf('GROUP BY p.store_id')).toBeLessThan(sql.indexOf('LIMIT least'));
    ['quantity_total','quantity_available','shelf_location','object_path','customer_user_id']
      .forEach((field) => expect(sql.match(new RegExp(`CREATE VIEW[\\s\\S]*${field}`, 'i'))).toBeNull());
  });

  it('implements the request-photo persistence and Phase 6 hold seam', () => {
    const sql = read(names[7]);
    ['order_request_photo_requests','order_request_media_links','phase9_request_current_copy_photos',
      'phase9_authorize_request_photo_upload','phase9_supply_request_photo',
      'create_or_refresh_request_soft_hold','phase9_accept_request_photos','phase9_request_photo_status']
      .forEach((name) => expect(sql).toContain(name));
    expect(sql).toContain('request_photo_validation');
    expect(sql).toContain('expire_request_photo_soft_hold');
    expect(sql).toContain("hold_type='soft'");
    expect(sql).not.toContain('payment_provider');
  });

  it('contains forward-disable controls and excludes Phase 7/8 abstractions', () => {
    const sql = all();
    expect(sql).toContain('enabled boolean');
    expect(sql).not.toMatch(/CREATE TABLE public\.(payments|store_orders|finance_ledger_entries)\b/);
    expect(sql).not.toContain('cron.schedule');
    expect(sql).not.toContain('workflow_engine');
  });
});
