import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  createPhase9Database, migrationPath, resetActor, scalar, setActor,
} from './databaseHarness.mjs';

export const M39 = '20260812000039_marketplace_phase9_create_only_inventory_commit.sql';
export const M40 = '20260812000040_marketplace_phase9_safe_publication.sql';
export const M41 = '20260813000041_marketplace_phase9_unit7a_quality_handoff.sql';

export async function applyUnit7aQualityHandoff(db) {
  await db.exec(fs.readFileSync(migrationPath(M41), 'utf8'));
}

export async function createUnit7bDatabase() {
  const db = await createPhase9Database({
    throughMigration: '20260810000035_marketplace_phase9_single_image_removal.sql',
  });
  await installDispatcherStubs(db);
  for (const tail of [
    '20260810000036_marketplace_phase9_worker_wake_dispatcher.sql',
    '20260810000037_marketplace_phase9_owner_discovery_scope_correction.sql',
    '20260810000038_marketplace_phase9_metadata_retry_correction.sql',
  ]) await db.exec(fs.readFileSync(migrationPath(tail), 'utf8'));
  await db.exec(fs.readFileSync(migrationPath(M39), 'utf8'));
  await db.exec(`
    CREATE TABLE public.marketplace_localities(id uuid PRIMARY KEY,name text NOT NULL,
      is_pilot_enabled boolean NOT NULL DEFAULT true);
    CREATE TABLE public.store_subscriptions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid NOT NULL,
      status text NOT NULL,updated_at timestamptz NOT NULL DEFAULT transaction_timestamp());
    CREATE TABLE public.store_entitlements(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid NOT NULL,
      feature_key text NOT NULL,limit_value integer,is_enabled boolean NOT NULL DEFAULT true,
      UNIQUE(store_id,feature_key));
    CREATE TABLE public.marketplace_policy_config(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),policy_key text NOT NULL,
      scope_type text NOT NULL,scope_value text,store_id uuid,value jsonb NOT NULL,
      value_type text NOT NULL,policy_version integer NOT NULL,is_active boolean NOT NULL,
      effective_from timestamptz NOT NULL,effective_to timestamptz,
      normalized_scope_identity text);
    CREATE TABLE public.listing_moderation_flags(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),listing_id uuid NOT NULL
        REFERENCES public.marketplace_book_listings(id),store_id uuid NOT NULL,
      flag_type text NOT NULL,status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT transaction_timestamp());
    ALTER TABLE public.stores
      ADD COLUMN verification_status text NOT NULL DEFAULT 'approved',
      ADD COLUMN pickup_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN delivery_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN city text,
      ADD COLUMN locality_id uuid REFERENCES public.marketplace_localities(id);
    ALTER TABLE public.store_order_request_items
      ADD COLUMN listing_id uuid REFERENCES public.marketplace_book_listings(id);
  `);
  await db.exec(fs.readFileSync(migrationPath(M40), 'utf8'));
  return db;
}

async function installDispatcherStubs(db) {
  await db.exec(`
    CREATE SCHEMA vault;
    CREATE TABLE vault.decrypted_secrets(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text UNIQUE,
      decrypted_secret text,created_at timestamptz DEFAULT transaction_timestamp()
    );
    CREATE SCHEMA net;
    CREATE TABLE net._http_response(
      id bigint PRIMARY KEY,status_code integer,timed_out boolean,error_msg text
    );
    CREATE FUNCTION net.http_post(
      url text,body jsonb DEFAULT '{}'::jsonb,params jsonb DEFAULT '{}'::jsonb,
      headers jsonb DEFAULT '{}'::jsonb,timeout_milliseconds integer DEFAULT 5000
    ) RETURNS bigint LANGUAGE sql AS $$SELECT 1::bigint$$;
    CREATE SCHEMA cron;
    CREATE TABLE cron.job(
      jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,jobname text UNIQUE,
      schedule text,command text,database text,username text,active boolean DEFAULT true
    );
    CREATE FUNCTION cron.schedule(job_name text,schedule text,command text)
    RETURNS bigint LANGUAGE plpgsql AS $$DECLARE v bigint; BEGIN
      INSERT INTO cron.job(jobname,schedule,command) VALUES(job_name,schedule,command)
      RETURNING jobid INTO v; RETURN v; END$$;
    CREATE FUNCTION cron.unschedule(job_name text) RETURNS boolean LANGUAGE plpgsql AS $$
      BEGIN DELETE FROM cron.job WHERE jobname=cron.unschedule.job_name; RETURN true; END$$;
    CREATE FUNCTION cron.alter_job(
      job_id bigint,schedule text DEFAULT NULL,command text DEFAULT NULL,
      database text DEFAULT NULL,username text DEFAULT NULL,active boolean DEFAULT NULL
    ) RETURNS void LANGUAGE sql AS $$UPDATE cron.job SET active=coalesce(alter_job.active,cron.job.active)
      WHERE jobid=job_id$$;
  `);
}

export async function seedPublicationInventory(db, overrides = {}) {
  await resetActor(db);
  const storeId = overrides.storeId ?? randomUUID();
  const ownerId = overrides.ownerId ?? randomUUID();
  const otherOwnerId = overrides.otherOwnerId ?? randomUUID();
  const inventoryId = randomUUID();
  const localityId = overrides.localityId ?? randomUUID();
  if (!overrides.storeId) await db.exec(`
    INSERT INTO public.marketplace_localities(id,name,is_pilot_enabled)
    VALUES('${localityId}','Unit 7B Locality',${overrides.pilotEnabled ?? true});
    INSERT INTO public.stores(
      id,display_name,status,verification_status,setup_status,selling_status,
      pickup_enabled,delivery_enabled,city,locality_id
    ) VALUES(
      '${storeId}','Unit 7B Store','${overrides.storeStatus ?? 'active'}',
      '${overrides.verificationStatus ?? 'approved'}','${overrides.setupStatus ?? 'complete'}',
      '${overrides.sellingStatus ?? 'allowed'}',true,false,'Pune','${localityId}'
    );
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES('${storeId}','${ownerId}','owner','${overrides.ownerStatus ?? 'active'}');
    INSERT INTO public.store_subscriptions(store_id,status)
    VALUES('${storeId}','${overrides.subscriptionStatus ?? 'trialing'}');
    INSERT INTO public.store_entitlements(store_id,feature_key,limit_value,is_enabled)
    VALUES('${storeId}','active_listing_limit',${overrides.activeListingLimit ?? 100},
      ${overrides.marketplaceEntitled ?? true});
    INSERT INTO public.marketplace_policy_config(
      policy_key,scope_type,store_id,value,value_type,policy_version,is_active,effective_from
    ) VALUES
      ('marketplace_enabled','global',NULL,'${overrides.marketplaceEnabled ?? true}'::jsonb,
        'boolean',1,true,transaction_timestamp()-interval '1 day'),
      ('commerce.store_allowlisted','store','${storeId}','${overrides.storeAllowlisted ?? true}'::jsonb,
        'boolean',1,true,transaction_timestamp()-interval '1 day');
  `);
  await db.exec(`
    INSERT INTO public.store_inventory(
      id,store_id,title,authors,language,description,edition_statement,volume,format,
      isbn_10,isbn_13,condition,selling_price_minor,quantity_total,quantity_available,quantity_reserved,
      quantity_sold,quantity_removed,visibility_status,publication_status,
      publication_intent_version,version,is_sellable,has_damage,damage_types,damage_notes,
      listing_quality_status,entry_method,created_by,public_notes,shelf_location,internal_notes
    ) VALUES(
      '${inventoryId}','${storeId}','${sql(overrides.title ?? 'Unit 7B Title')}',
      ARRAY['Unit 7B Author'],'en','Public description','First edition','1','paperback',
      ${nullableSql(overrides.isbn10 ?? null)},${nullableSql(overrides.isbn13 ?? null)},
      '${overrides.condition ?? 'good'}',${overrides.priceMinor ?? 725},
      ${overrides.quantityTotal ?? 3},${overrides.quantityAvailable ?? 3},0,0,0,
      '${overrides.visibilityStatus ?? 'draft'}','${overrides.publicationStatus ?? 'private'}',
      ${overrides.intentVersion ?? 1},${overrides.inventoryVersion ?? 1},
      ${overrides.isSellable ?? true},${overrides.hasDamage ?? false},
      ${arraySql(overrides.damageTypes ?? [])},${nullableSql(overrides.damageNote ?? null)},
      '${overrides.qualityStatus ?? 'ready'}','${overrides.entryMethod ?? 'manual'}',
      '${ownerId}','Owner public note','Shelf Z9','private internal note'
    );
  `);
  await setActor(db, ownerId);
  return { storeId, ownerId, otherOwnerId, inventoryId };
}

export async function grantPublicationEligibility(db, fixture, overrides = {}) {
  await resetActor(db);
  const localityId = randomUUID();
  await db.exec(`
    INSERT INTO public.marketplace_localities(id,name,is_pilot_enabled)
    VALUES('${localityId}','Unit 7B Existing Store',true);
    UPDATE public.stores SET locality_id='${localityId}' WHERE id='${fixture.storeId}';
    INSERT INTO public.store_subscriptions(store_id,status)
    VALUES('${fixture.storeId}','${overrides.subscriptionStatus ?? 'trialing'}');
    INSERT INTO public.store_entitlements(store_id,feature_key,limit_value,is_enabled)
    VALUES('${fixture.storeId}','active_listing_limit',100,true);
    INSERT INTO public.marketplace_policy_config(
      policy_key,scope_type,store_id,value,value_type,policy_version,is_active,effective_from
    ) VALUES
      ('marketplace_enabled','global',NULL,'true','boolean',1,true,
        transaction_timestamp()-interval '1 day'),
      ('commerce.store_allowlisted','store','${fixture.storeId}','true','boolean',1,true,
        transaction_timestamp()-interval '1 day');
  `);
  await setActor(db, fixture.ownerId);
}

export function setPublicationSql(fixture, overrides = {}) {
  return `SELECT public.phase9_set_publication_state_v2(
    '${overrides.inventoryId ?? fixture.inventoryId}',
    ${overrides.inventoryVersion ?? 1},
    ${overrides.intentVersion ?? 1},
    '${overrides.intent ?? 'publish'}',
    '${overrides.idempotencyKey ?? `u7b-command-${fixture.inventoryId}`}',
    '${overrides.commandId ?? randomUUID()}'
  )`;
}

export async function setPublication(db, fixture, overrides = {}) {
  return scalar(db, setPublicationSql(fixture, overrides));
}

export async function addApprovedPublicMedia(db, fixture, role, order = 1) {
  return addPublicMedia(db, fixture, { role, order });
}

export async function addPublicMedia(db, fixture, options = {}) {
  await resetActor(db);
  const sourceId = randomUUID();
  const assetId = randomUUID();
  const linkId = randomUUID();
  const role = options.role ?? 'actual_copy';
  const order = options.order ?? 1;
  const approvalStatus = options.approvalStatus ?? 'approved';
  const lifecycleStatus = options.lifecycleStatus ?? 'approved';
  const bucketId = options.bucketId ?? 'inventory-photos';
  const validationVersion = options.sanitized === false ? null : 'p9-public-v1';
  const reencodeVersion = options.sanitized === false ? null : 'webp-v1';
  const exifStripVersion = options.sanitized === false ? null : 'exif-v1';
  await db.exec(`
    INSERT INTO public.media_assets(
      id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
      detected_mime,bytes,width,height,retention_class,lifecycle_status
    ) VALUES(
      '${sourceId}','${fixture.storeId}','${fixture.ownerId}','scan_input','private_scan',
      'image-extraction-inputs','${fixture.storeId}/source/${sourceId}.png','${'b'.repeat(64)}',
      'image/png',128,100,100,'phase9-source','validated'
    );
    INSERT INTO public.media_assets(
      id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
      detected_mime,bytes,width,height,validation_version,reencode_version,
      exif_strip_version,source_media_asset_id,retention_class,lifecycle_status
    ) VALUES(
      '${assetId}','${fixture.storeId}','${fixture.ownerId}','public_copy','public',
      '${bucketId}','${fixture.storeId}/public_copy/${fixture.inventoryId}/${assetId}.webp',
      '${'a'.repeat(64)}','image/webp',128,100,100,${nullableSql(validationVersion)},
      ${nullableSql(reencodeVersion)},${nullableSql(exifStripVersion)},'${sourceId}',
      'public_inventory','${lifecycleStatus}'
    );
    INSERT INTO public.inventory_media_links(
      id,store_id,inventory_id,media_asset_id,role,public_order,
      approval_status,approved_by,approved_at
    ) VALUES(
      '${linkId}','${fixture.storeId}','${fixture.inventoryId}','${assetId}',
      '${role}',${order},'${approvalStatus}','${fixture.ownerId}',transaction_timestamp()
    );
  `);
  await setActor(db, fixture.ownerId);
  return { assetId, linkId, sourceId };
}

export async function businessEffectSnapshot(db, fixture) {
  await resetActor(db);
  const [inventory, counts] = await Promise.all([
    db.query(`SELECT id,version,publication_intent_version,visibility_status,
      publication_status,quantity_total,quantity_available,quantity_reserved,
      quantity_sold,quantity_removed FROM public.store_inventory
      WHERE id='${fixture.inventoryId}'`),
    db.query(`SELECT
      (SELECT count(*)::int FROM public.store_inventory WHERE id='${fixture.inventoryId}') inventory_rows,
      (SELECT count(*)::int FROM public.marketplace_book_listings WHERE inventory_id='${fixture.inventoryId}') listings,
      (SELECT count(*)::int FROM public.image_extraction_jobs WHERE entity_id='${fixture.inventoryId}' AND job_kind='publication_retry') jobs,
      (SELECT count(*)::int FROM public.marketplace_audit_logs WHERE entity_id='${fixture.inventoryId}') audits,
      (SELECT count(*)::int FROM public.marketplace_events WHERE entity_id='${fixture.inventoryId}') events,
      (SELECT count(*)::int FROM public.phase9_idempotency_keys WHERE request_fingerprint LIKE '%${fixture.inventoryId}%') idempotency`),
  ]);
  await setActor(db, fixture.ownerId);
  return { inventory: inventory.rows[0], ...counts.rows[0] };
}

export async function registerPublicCopySource(db, fixture, options = {}) {
  const role = options.role ?? 'primary_fallback';
  const ordinal = options.ordinal ?? 1;
  const mime = options.mime ?? 'image/png';
  const bytes = options.bytes ?? 128;
  const envelopeSha256 = options.envelopeSha256 ?? 'b'.repeat(64);
  const authorization = await scalar(db, `SELECT public.phase9_authorize_public_copy_upload_v2(
    '${fixture.inventoryId}','${role}',${ordinal},'${mime}',${bytes},'${envelopeSha256}',
    transaction_timestamp()+interval '10 minutes','u7b-media-auth-${randomUUID()}','${randomUUID()}')`);
  await setActor(db, fixture.ownerId, 'service_role');
  const registered = await scalar(db, `SELECT public.phase9_register_public_copy_upload_v1(
    '${fixture.ownerId}','${authorization.capabilityId}','${'c'.repeat(64)}','${'d'.repeat(64)}',
    '${options.observedMime ?? mime}',${options.observedBytes ?? bytes},
    'u7b-media-register-${randomUUID()}','${randomUUID()}')`);
  await setActor(db, fixture.ownerId);
  return { authorization, registered, role, ordinal, mime, bytes };
}

export async function completePublicCopyDerivative(db, fixture, source) {
  await setActor(db, fixture.ownerId, 'service_role');
  const claim = (await db.query(`SELECT id,attempt_count,lease_token FROM public.claim_phase9_media_validation_jobs(
    1,'media-worker-0000000001')`).catch(tag('public-copy claim'))).rows[0];
  const context = await scalar(db, `SELECT public.phase9_media_validation_context_v2(
    '${claim.id}','media-worker-0000000001','${claim.lease_token}',${claim.attempt_count})`)
    .catch(tag('public-copy context'));
  await scalar(db, `SELECT public.phase9_bind_media_validation_snapshot_v2(
    '${claim.id}','media-worker-0000000001','${claim.lease_token}',${claim.attempt_count},
    '${context.snapshot_path}','${context.source_sha256}',${context.source_bytes},'${context.source_mime}')`)
    .catch(tag('public-copy snapshot'));
  const completed = await scalar(db, `SELECT public.phase9_complete_media_validation_v2(
    '${claim.id}','media-worker-0000000001','${claim.lease_token}',${claim.attempt_count},
    '${context.source_object_identity}','${context.source_sha256}','${context.snapshot_path}',
    '${context.target_path}','${'e'.repeat(64)}',96,1,1)`).catch(tag('public-copy complete'));
  await setActor(db, fixture.ownerId);
  return { claim, context, completed, ...source };
}

export async function linkPublicCopyDerivative(db, fixture, completed) {
  return scalar(db, `SELECT public.phase9_submit_public_copy_media_v2(
    '${fixture.inventoryId}','${completed.authorization.capabilityId}',
    '${completed.completed.media_asset_id}','${completed.role}',${completed.ordinal},
    'u7b-media-link-${randomUUID()}','${randomUUID()}')`);
}

export async function installTransientProjectionFault(db, fixture = null) {
  await resetActor(db);
  await db.exec(`
    CREATE FUNCTION marketplace_sec.phase9_test_projection_fault()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF current_setting('phase9.test_projection_fault',true)='on'
        AND NEW.visibility_status='published' THEN
        RAISE EXCEPTION 'P9_PUBLICATION_TRANSIENT';
      END IF;
      RETURN NEW;
    END$$;
    CREATE TRIGGER phase9_test_projection_fault
      BEFORE UPDATE ON public.store_inventory
      FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_test_projection_fault();
  `);
  const actor = fixture?.ownerId
    ?? (await db.query(`SELECT created_by FROM public.store_inventory ORDER BY created_at DESC LIMIT 1`)).rows[0].created_by;
  await setActor(db, actor);
  await db.exec("SELECT set_config('phase9.test_projection_fault','on',false)");
}

export async function disableTransientProjectionFault(db) {
  await db.exec("SELECT set_config('phase9.test_projection_fault','off',false)");
}

export async function state(db, fixture) {
  await resetActor(db);
  const inventory = (await db.query(`SELECT * FROM public.store_inventory WHERE id='${fixture.inventoryId}'`)).rows[0];
  const listings = (await db.query(`SELECT * FROM public.marketplace_book_listings WHERE inventory_id='${fixture.inventoryId}'`)).rows;
  const jobs = (await db.query(`SELECT * FROM public.image_extraction_jobs WHERE entity_id='${fixture.inventoryId}' AND job_kind='publication_retry'`)).rows;
  await setActor(db, fixture.ownerId);
  return { inventory, listings, jobs };
}

function sql(value) { return String(value).replaceAll("'", "''"); }
function nullableSql(value) { return value == null ? 'NULL' : `'${sql(value)}'`; }
function arraySql(values) { return values.length ? `ARRAY[${values.map(nullableSql).join(',')}]` : "'{}'::text[]"; }
function tag(label) { return (error) => { error.message = `${label}: ${error.message}`; throw error; }; }
