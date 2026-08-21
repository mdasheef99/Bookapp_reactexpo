import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createUnit7cDatabase, publishInventory, seedUnit7cInventory } from './unit7cFixture.mjs';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import { seedApprovedPrimaryCopy } from './phase9BookstoreFirstDiscoveryTestHelpers.mjs';

const migration = (name) => path.join(process.cwd(), 'supabase', 'migrations', name);
const M49 = migration('20260818000049_marketplace_phase9_bookstore_first_discovery.sql');
const M50 = migration('20260820000050_marketplace_phase9_storefront_detail.sql');
const M51 = migration('20260821000051_marketplace_phase9_public_media_order_invariant.sql');

async function ensureU8cPrerequisites(db) {
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS vault;
    CREATE TABLE IF NOT EXISTS vault.decrypted_secrets(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE,
      decrypted_secret text, created_at timestamptz DEFAULT transaction_timestamp());
    CREATE SCHEMA IF NOT EXISTS extensions;
    INSERT INTO vault.decrypted_secrets(name,decrypted_secret)
    VALUES('phase9_q08_cursor_secret','u8c-test-secret-32-characters-minimum-123456')
    ON CONFLICT(name) DO UPDATE SET decrypted_secret=excluded.decrypted_secret;
    CREATE OR REPLACE FUNCTION extensions.pgp_sym_encrypt(data text,p_key text)
    RETURNS bytea LANGUAGE sql AS $$ SELECT convert_to(data||'|'||p_key,'UTF8') $$;
    CREATE OR REPLACE FUNCTION extensions.pgp_sym_decrypt(data bytea,p_key text)
    RETURNS text LANGUAGE plpgsql AS $$
    DECLARE v text:=convert_from(data,'UTF8'); BEGIN
      IF v NOT LIKE '%|'||p_key THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      RETURN substring(v from 1 for char_length(v)-char_length(p_key)-1);
    END $$;
    CREATE OR REPLACE FUNCTION extensions.digest(value text,algorithm text)
    RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(convert_to(value,'UTF8')) $$;
    CREATE OR REPLACE FUNCTION extensions.digest(value bytea,algorithm text)
    RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(value) $$;
    CREATE OR REPLACE FUNCTION marketplace_sec.phase9_variant_compare_key(p_text text)
    RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
      SELECT trim(regexp_replace(lower(normalize(coalesce(p_text,''),NFKC)),
        '[[:punct:][:space:]]+',' ','g')) $$;
  `);
  const isbnNormalizer = await db.query(`SELECT count(*)::int count FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='marketplace_sec' AND p.proname='phase9_metadata_normalized_isbn13'`);
  if (isbnNormalizer.rows[0].count === 0) {
    await db.exec(`CREATE FUNCTION marketplace_sec.phase9_metadata_normalized_isbn13(p_value text)
      RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
      SELECT CASE WHEN regexp_replace(coalesce(p_value,''),'[-[:space:]]','','g')
        IN ('9780306406157','9780006543541')
        THEN regexp_replace(p_value,'[-[:space:]]','','g') ELSE NULL END $$;`);
  }
  await db.exec(`
    ALTER TABLE public.phase9_search_variant_proposals
      DROP CONSTRAINT IF EXISTS phase9_search_variant_proposals_analysis_result_id_fkey;
    ALTER TABLE public.phase9_search_variant_proposals
      DROP CONSTRAINT IF EXISTS phase9_search_variant_proposals_vision_job_id_fkey;
    ALTER TABLE public.phase9_search_variant_proposals
      DROP CONSTRAINT IF EXISTS phase9_search_variant_proposals_candidate_id_fkey;
    ALTER TABLE public.phase9_search_variant_proposals
      DROP CONSTRAINT IF EXISTS phase9_search_variant_proposals_observation_id_fkey;
    CREATE TABLE IF NOT EXISTS public.public_store_profiles(
      store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
      display_name text NOT NULL,description text,logo_url text,cover_url text,
      city text,state text,locality_id uuid,locality_name text,location text,
      operating_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
      pickup_enabled boolean NOT NULL DEFAULT false,
      delivery_enabled boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
      return_policy_type text DEFAULT 'no_returns');
  `);
}

async function createDatabase({ includeM51 = true } = {}) {
  const db = await createUnit7cDatabase({ includeM46: true });
  await ensureU8cPrerequisites(db);
  await db.exec(fs.readFileSync(M49, 'utf8'));
  await db.exec(fs.readFileSync(M50, 'utf8'));
  if (includeM51) await db.exec(fs.readFileSync(M51, 'utf8'));
  await db.exec(`
    CREATE OR REPLACE FUNCTION marketplace_sec.sync_u8c_test_profile()
    RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      INSERT INTO public.public_store_profiles(
        store_id,display_name,city,state,locality_id,locality_name,
        pickup_enabled,delivery_enabled,return_policy_type)
      VALUES(NEW.id,NEW.display_name,coalesce(NEW.city,'Pune'),'',NEW.locality_id,
        (SELECT name FROM public.marketplace_localities WHERE id=NEW.locality_id),
        coalesce(NEW.pickup_enabled,false),coalesce(NEW.delivery_enabled,false),'no_returns')
      ON CONFLICT(store_id) DO UPDATE SET display_name=excluded.display_name,
        city=excluded.city,locality_id=excluded.locality_id,
        locality_name=excluded.locality_name;
      RETURN NEW; END $$;
    DROP TRIGGER IF EXISTS u8c_sync_profile ON public.stores;
    CREATE TRIGGER u8c_sync_profile AFTER INSERT OR UPDATE ON public.stores
      FOR EACH ROW EXECUTE FUNCTION marketplace_sec.sync_u8c_test_profile();
  `);
  return db;
}

async function seedPublished(db, overrides = {}) {
  const fixture = await seedUnit7cInventory(db, {
    quantityTotal: 3, quantityAvailable: 3, condition: 'good', ...overrides,
  });
  await publishInventory(db, fixture);
  await resetActor(db);
  const listingId = await db.query(`SELECT id FROM public.marketplace_book_listings
    WHERE inventory_id='${fixture.inventoryId}'`).then((result) => result.rows[0].id);
  await setActor(db, fixture.ownerId);
  return { ...fixture, listingId };
}

async function storefront(db, storeId, pageSize = 20, cursor = null, matchContext = null) {
  const quoted = (value) => value == null ? 'NULL' : `'${value.replaceAll("'", "''")}'`;
  return scalar(db, `SELECT public.phase9_storefront_catalogue_v1(
    '${storeId}',${pageSize},${quoted(cursor)},${quoted(matchContext)})`);
}

function assertRecursivelyPrivateSafe(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    'inventoryId','inventory_id','quantityAvailable','quantity_available',
    'shelfLocation','internalNotes','objectPath','object_path','moderationReason',
    'aliasProvenance','rankingScore','staging',
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);
}

test('U8C-Q09 complete grouped catalogue, highlight traversal, and Clear Search', async () => {
  const db = await createDatabase();
  try {
    const alpha = await seedPublished(db, { title: 'Alpha', isbn13: '9780306406157' });
    await seedPublished(db, {
      storeId: alpha.storeId, ownerId: alpha.ownerId,
      title: 'Alpha alternate copy', isbn13: '9780306406157', priceMinor: 525,
    });
    await seedPublished(db, { storeId: alpha.storeId, ownerId: alpha.ownerId, title: 'Beta' });
    await seedPublished(db, { storeId: alpha.storeId, ownerId: alpha.ownerId, title: 'Gamma' });
    const q08 = await scalar(db, `SELECT public.phase9_bookstore_search_v1(
      'Alpha',20,NULL,NULL,NULL)`);
    const context = q08.items[0].matchedBook.matchContext;
    assert.equal(typeof context, 'string');
    assert.equal(context.includes(alpha.inventoryId), false);

    const first = await storefront(db, alpha.storeId, 1, null, context);
    assert.equal(first.titleCount, 3);
    assert.equal(first.matchContextState, 'active');
    assert.equal(first.highlightedTitleGroup.offers.length, 2);
    assert.equal(first.titleGroups.length, 1);
    const highlightedIds = new Set(first.highlightedTitleGroup.offers.map((offer) => offer.listingId));
    assert.equal(first.titleGroups.some((group) =>
      group.offers.some((offer) => highlightedIds.has(offer.listingId))), false);
    assert.equal(first.pageInfo.hasNextPage, true);
    const second = await storefront(db, alpha.storeId, 1, first.pageInfo.nextCursor, context);
    assert.equal(second.highlightedTitleGroup, null);
    const ordinaryIds = [...first.titleGroups, ...second.titleGroups]
      .flatMap((group) => group.offers.map((offer) => offer.listingId));
    assert.equal(new Set(ordinaryIds).size, ordinaryIds.length);

    const cleared = await storefront(db, alpha.storeId, 20);
    assert.equal(cleared.titleCount, 3);
    assert.equal(cleared.highlightedTitleGroup, null);
    assert.equal(cleared.matchContextState, 'none');
    assert.equal(cleared.titleGroups.length, 3);
    assertRecursivelyPrivateSafe(cleared);
  } finally { await db.close(); }
});

test('U8C-Q09 wrong-store/stale context degrades safely and highlighted cursor fails closed', async () => {
  const db = await createDatabase();
  try {
    const source = await seedPublished(db, { title: 'Searched title' });
    await seedPublished(db, { storeId: source.storeId, ownerId: source.ownerId, title: 'Browse title' });
    await seedPublished(db, { storeId: source.storeId, ownerId: source.ownerId, title: 'Later title' });
    const other = await seedPublished(db, { title: 'Other store title' });
    const q08 = await scalar(db, `SELECT public.phase9_bookstore_search_v1(
      'Searched title',20,NULL,NULL,NULL)`);
    const context = q08.items.find((item) => item.store.publicStoreId === source.storeId)
      .matchedBook.matchContext;
    const wrongStore = await storefront(db, other.storeId, 20, null, context);
    assert.equal(wrongStore.matchContextState, 'unavailable');
    assert.equal(wrongStore.highlightedTitleGroup, null);
    assert.equal(wrongStore.titleGroups.length, 1);

    const first = await storefront(db, source.storeId, 1, null, context);
    await resetActor(db);
    await db.exec(`UPDATE public.store_inventory SET quantity_available=0,
      quantity_total=0 WHERE id='${source.inventoryId}'`);
    const stale = await storefront(db, source.storeId, 20, null, context);
    assert.equal(stale.matchContextState, 'unavailable');
    assert.equal(stale.highlightedTitleGroup, null);
    await assert.rejects(
      storefront(db, source.storeId, 1, first.pageInfo.nextCursor, context),
      /P9_CURSOR_INVALID/,
    );
  } finally { await db.close(); }
});

test('U8C-Q09 rejects the prior match-context contract version as unavailable', async () => {
  const db = await createDatabase();
  try {
    const fixture = await seedPublished(db, { title: 'Version-bound title' });
    await resetActor(db);
    const oldContext = await scalar(db, `SELECT marketplace_sec.phase9_q08_cursor_encrypt(
      jsonb_build_object('kind','q09-match-context','contextVersion','q09-match-v1',
        'storeId','${fixture.storeId}','groupKey','listing:${fixture.listingId}',
        'policyVersion',marketplace_sec.phase9_q08_current_policy_version(),
        'issuedAt',extract(epoch FROM transaction_timestamp())::bigint,
        'expiresAt',(extract(epoch FROM transaction_timestamp())::bigint)+7200))`);
    const page = await storefront(db, fixture.storeId, 20, null, oldContext);
    assert.equal(page.matchContextState, 'unavailable');
    assert.equal(page.highlightedTitleGroup, null);
    assert.equal(page.titleGroups.length, 1);
  } finally { await db.close(); }
});

test('U8C-Q10 returns safe current detail/gallery and rejects unavailable listing', async () => {
    const db = await createDatabase();
  try {
    const fixture = await seedPublished(db, { title: 'Detail title', priceMinor: 999 });
    await resetActor(db);
    await seedApprovedPrimaryCopy(db, {
      storeId: fixture.storeId, inventoryId: fixture.inventoryId,
      listingId: fixture.listingId, uploadedBy: fixture.ownerId,
      role: 'primary_fallback', publicOrder: 3,
    });
    await seedApprovedPrimaryCopy(db, {
      storeId: fixture.storeId, inventoryId: fixture.inventoryId,
      listingId: fixture.listingId, uploadedBy: fixture.ownerId,
      role: 'actual_copy', publicOrder: 1,
    });
    await seedApprovedPrimaryCopy(db, {
      storeId: fixture.storeId, inventoryId: fixture.inventoryId,
      listingId: fixture.listingId, uploadedBy: fixture.ownerId,
      role: 'actual_copy', publicOrder: 2,
    });
    const excluded = {
      sourceId: randomUUID(), derivativeId: randomUUID(), linkId: randomUUID(),
      objectPath: `${fixture.storeId}/u8c-pending-${randomUUID()}.webp`,
    };
    await db.exec(`
      INSERT INTO public.media_assets(
        id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
        sha256,detected_mime,bytes,width,height,retention_class,lifecycle_status
      ) VALUES(
        '${excluded.sourceId}','${fixture.storeId}','${fixture.ownerId}',
        'public_copy','private_scan','marketplace-media-staging',
        '${fixture.storeId}/u8c-private-${excluded.sourceId}.jpg',
        '${'c'.repeat(64)}','image/jpeg',128,1,1,'phase9-public-copy-source','staged');
      INSERT INTO public.media_assets(
        id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
        sha256,detected_mime,bytes,width,height,validation_version,validated_at,
        reencode_version,exif_strip_version,source_media_asset_id,retention_class,
        lifecycle_status
      ) VALUES(
        '${excluded.derivativeId}','${fixture.storeId}','${fixture.ownerId}',
        'public_copy','public','inventory-photos','${excluded.objectPath}',
        '${'d'.repeat(64)}','image/webp',256,1,1,'phase9-media-v1',
        transaction_timestamp(),'phase9-reencode-v1','phase9-exif-v1',
        '${excluded.sourceId}','phase9-public-copy','approved');
      INSERT INTO public.inventory_media_links(
        id,store_id,inventory_id,media_asset_id,role,public_order,approval_status
      ) VALUES(
        '${excluded.linkId}','${fixture.storeId}','${fixture.inventoryId}',
        '${excluded.derivativeId}','actual_copy',NULL,'pending');
    `);
    await setActor(db, fixture.ownerId);
    const detail = await scalar(db, `SELECT public.phase9_public_listing_detail_v3(
      '${fixture.listingId}')`);
    assert.equal(detail.contractVersion, 'q10-v1');
    assert.equal(detail.listingId, fixture.listingId);
    assert.equal(detail.store.publicStoreId, fixture.storeId);
    assert.equal(detail.priceMinor, 999);
    assert.equal(detail.gallery.length, 3);
    assert.deepEqual(detail.gallery.map((item) => item.order), [1, 2, 3]);
    assert.deepEqual(detail.gallery.map((item) => item.role),
      ['actual_copy', 'actual_copy', 'primary_fallback']);
    assert.equal(detail.gallery.some((item) => item.url.includes(excluded.objectPath)), false);
    assert.match(detail.gallery[0].url, /^\/storage\/v1\/object\/public\/inventory-photos\//);
    assertRecursivelyPrivateSafe(detail);

    await resetActor(db);
    await db.exec(`UPDATE public.store_inventory SET quantity_available=0,
      quantity_total=0 WHERE id='${fixture.inventoryId}'`);
    assert.equal(await scalar(db, `SELECT public.phase9_public_listing_detail_v3(
      '${fixture.listingId}')`), null);
    await db.exec(`UPDATE public.store_inventory SET quantity_available=1,
      quantity_total=1 WHERE id='${fixture.inventoryId}'`);
    assert.equal((await scalar(db, `SELECT public.phase9_public_listing_detail_v3(
      '${fixture.listingId}')`)).listingId, fixture.listingId);
  } finally { await db.close(); }
});

test('U8C public media requires unique order 1..3 and rejects a fourth slot', async () => {
  const db = await createDatabase();
  try {
    const fixture = await seedPublished(db, { title: 'Bounded gallery title' });
    await resetActor(db);
    await seedApprovedPrimaryCopy(db, {
      storeId: fixture.storeId, inventoryId: fixture.inventoryId,
      listingId: fixture.listingId, uploadedBy: fixture.ownerId,
      role: 'actual_copy', publicOrder: 1,
    });
    await assert.rejects(seedApprovedPrimaryCopy(db, {
      storeId: fixture.storeId, inventoryId: fixture.inventoryId,
      listingId: fixture.listingId, uploadedBy: fixture.ownerId,
      role: 'actual_copy', publicOrder: null,
    }), /P9_PUBLIC_MEDIA_ORDER_REQUIRED/);
    await assert.rejects(seedApprovedPrimaryCopy(db, {
      storeId: fixture.storeId, inventoryId: fixture.inventoryId,
      listingId: fixture.listingId, uploadedBy: fixture.ownerId,
      role: 'actual_copy', publicOrder: 1,
    }), /unique|duplicate/i);
    await assert.rejects(seedApprovedPrimaryCopy(db, {
      storeId: fixture.storeId, inventoryId: fixture.inventoryId,
      listingId: fixture.listingId, uploadedBy: fixture.ownerId,
      role: 'actual_copy', publicOrder: 4,
    }), /check|public_order|P9_PUBLIC_MEDIA_ORDER_REQUIRED/i);
  } finally { await db.close(); }
});

test('M51 fails closed on existing eligible NULL order', async () => {
  const db = await createDatabase({ includeM51: false });
  try {
    const fixture = await seedPublished(db, { title: 'Legacy null public order' });
    await resetActor(db);
    await seedApprovedPrimaryCopy(db, {
      storeId: fixture.storeId, inventoryId: fixture.inventoryId,
      listingId: fixture.listingId, uploadedBy: fixture.ownerId,
      role: 'actual_copy', publicOrder: null,
    });
    await assert.rejects(db.exec(fs.readFileSync(M51, 'utf8')),
      /M51_PUBLIC_MEDIA_ORDER_INVARIANT_EXISTING_ROWS/);
  } finally { await db.close(); }
});

test('M51 guards asset lifecycle transitions that would expose a legacy NULL order', async () => {
  const db = await createDatabase({ includeM51: false });
  try {
    const fixture = await seedPublished(db, { title: 'Lifecycle transition title' });
    await resetActor(db);
    const legacy = await seedApprovedPrimaryCopy(db, {
      storeId: fixture.storeId, inventoryId: fixture.inventoryId,
      listingId: fixture.listingId, uploadedBy: fixture.ownerId,
      role: 'actual_copy', publicOrder: null,
    });
    await db.exec(`UPDATE public.media_assets SET lifecycle_status='delete_pending'
      WHERE id='${legacy.derivativeId}'`);
    await db.exec(fs.readFileSync(M51, 'utf8'));
    await assert.rejects(db.exec(`UPDATE public.media_assets SET lifecycle_status='approved'
      WHERE id='${legacy.derivativeId}'`), /P9_PUBLIC_MEDIA_ORDER_REQUIRED/);
  } finally { await db.close(); }
});

test('U8C security grants and safe v2 compatibility remain bounded', async () => {
  const db = await createDatabase();
  try {
    const fixture = await seedPublished(db, { title: 'Compatibility title' });
    await resetActor(db);
    const grants = (await db.query(`SELECT
      has_function_privilege('anon','public.phase9_storefront_catalogue_v1(uuid,integer,text,text)','EXECUTE') q09,
      has_function_privilege('authenticated','public.phase9_public_listing_detail_v3(uuid)','EXECUTE') q10,
      has_function_privilege('anon','marketplace_sec.phase9_q09_issue_match_context(uuid,text)','EXECUTE') helper`)).rows[0];
    assert.deepEqual(grants, { q09: true, q10: true, helper: false });
    await setActor(db, fixture.ownerId, 'anon');
    await assert.rejects(db.query(`SELECT marketplace_sec.phase9_q09_issue_match_context(
      '${fixture.storeId}','listing:${fixture.listingId}')`), /permission denied/);
    const v2 = await scalar(db, `SELECT public.phase9_public_listing_detail_v2(
      '${fixture.listingId}')`);
    assert.equal(v2.listingId, fixture.listingId);
  } finally { await db.close(); }
});
