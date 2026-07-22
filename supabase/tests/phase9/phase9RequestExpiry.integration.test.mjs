import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createPhase9Database, resetActor, scalar, setActor } from './databaseHarness.mjs';

const STORE = '93000000-0000-0000-0000-000000000001';
const STORE_B = '93000000-0000-0000-0000-000000000004';
const OWNER = '93000000-0000-0000-0000-000000000002';
const CUSTOMER = '93000000-0000-0000-0000-000000000003';
let db;

before(async () => {
  db = await createPhase9Database();
  await db.exec(`
    INSERT INTO public.stores(id,display_name) VALUES('${STORE}','Expiry Store'),('${STORE_B}','Other Store');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
      VALUES('${STORE}','${OWNER}','owner','active');
  `);
});
after(async () => db.close());

test('claimed C29 expiry releases an expired soft hold exactly once', async () => {
  const inventoryId = await scalar(db, `INSERT INTO public.store_inventory(id,store_id,title,condition,
    selling_price_minor,quantity_total,quantity_available) VALUES(gen_random_uuid(),'${STORE}',
    'Expiry Book','good',500,1,1) RETURNING id::text`);
  const requestId = await scalar(db, `INSERT INTO public.store_order_requests(id,store_id,user_id)
    VALUES(gen_random_uuid(),'${STORE}','${CUSTOMER}') RETURNING id::text`);
  const itemId = await scalar(db, `INSERT INTO public.store_order_request_items(id,order_request_id,store_id,
    inventory_id) VALUES(gen_random_uuid(),'${requestId}','${STORE}','${inventoryId}') RETURNING id::text`);
  const photoId = await scalar(db, `INSERT INTO public.order_request_photo_requests(id,store_id,
    order_request_id,order_request_item_id,customer_user_id,state,requested_count)
    VALUES(gen_random_uuid(),'${STORE}','${requestId}','${itemId}','${CUSTOMER}',
      'provided',1) RETURNING id::text`);

  await setActor(db, OWNER);
  await db.query(`SELECT public.phase9_confirm_request_photo_item('${photoId}',1,1,500,'{}',
    transaction_timestamp()-interval '1 minute','expiry-confirm-0001',gen_random_uuid())`);
  await resetActor(db);
  const jobId = await scalar(db, `SELECT id::text FROM public.image_extraction_jobs
    WHERE entity_id='${photoId}' AND job_kind='request_photo_hold_expiry'`);
  await db.exec(`SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false);
    UPDATE public.image_extraction_jobs SET status='in_progress',lease_owner='expiry-worker',
      lease_expires_at=transaction_timestamp()+interval '5 minutes' WHERE id='${jobId}'`);
  const expiredId = await scalar(db,
    `SELECT marketplace_sec.expire_request_photo_soft_hold('${jobId}','expiry-worker','${photoId}')`);
  assert.equal(await scalar(db,
    `SELECT marketplace_sec.expire_request_photo_soft_hold('${jobId}','expiry-worker','${photoId}')`), expiredId);
  await db.exec('RESET ROLE');

  assert.equal(await scalar(db, `SELECT state FROM public.order_request_photo_requests WHERE id='${photoId}'`), 'expired');
  assert.equal(await scalar(db, `SELECT quantity_available=1 AND quantity_reserved=0
    FROM public.store_inventory WHERE id='${inventoryId}'`), true);
  assert.equal(await scalar(db, `SELECT status FROM public.inventory_holds WHERE order_request_item_id='${itemId}'`), 'released');
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${jobId}'`), 'resolved');
});

test('claimed C12 worker retry is projection-only and resolves its lease', async () => {
  const inventoryId = await scalar(db, `INSERT INTO public.store_inventory(id,store_id,title,condition,
    selling_price_minor,quantity_total,quantity_available,publication_status)
    VALUES(gen_random_uuid(),'${STORE}','Retry Book','good',600,2,2,'publication_failed') RETURNING id::text`);
  const jobId = await scalar(db, `INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,
    job_kind,dedupe_key,operation_version,status,lease_owner,lease_expires_at)
    VALUES('${STORE_B}','inventory','${inventoryId}','publication_retry','retry:${inventoryId}','1',
      'in_progress','publication-worker',transaction_timestamp()+interval '5 minutes') RETURNING id::text`);
  await db.exec("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)");
  await assert.rejects(db.query(`SELECT public.phase9_retry_publication('${inventoryId}',1,
    'worker-cross-store-0001',gen_random_uuid(),'publication-worker')`));
  await db.query(`UPDATE public.image_extraction_jobs SET store_id='${STORE}',entity_type='inventory'
    WHERE id='${jobId}'`);
  await assert.rejects(db.query(`SELECT public.phase9_retry_publication('${inventoryId}',1,
    'worker-wrong-entity-0001',gen_random_uuid(),'publication-worker')`));
  await db.query(`UPDATE public.image_extraction_jobs SET entity_type='store_inventory',operation_version='2'
    WHERE id='${jobId}'`);
  await assert.rejects(db.query(`SELECT public.phase9_retry_publication('${inventoryId}',1,
    'worker-stale-intent-0001',gen_random_uuid(),'publication-worker')`));
  await db.query(`UPDATE public.image_extraction_jobs SET operation_version='1' WHERE id='${jobId}'`);
  assert.equal(await scalar(db, `SELECT public.phase9_retry_publication('${inventoryId}',1,
    'worker-publication-0001',gen_random_uuid(),'publication-worker')`), 'published');
  await db.exec('RESET ROLE');
  assert.equal(await scalar(db, `SELECT quantity_total=2 AND quantity_available=2
    FROM public.store_inventory WHERE id='${inventoryId}'`), true);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${jobId}'`), 'resolved');
});

test('C27 validates only its bound media and replays the aggregate outcome', async () => {
  const inventoryId = await scalar(db, `INSERT INTO public.store_inventory(id,store_id,title,condition,
    selling_price_minor,quantity_total,quantity_available) VALUES(gen_random_uuid(),'${STORE}',
    'Validation Book','good',700,1,1) RETURNING id::text`);
  const requestId = await scalar(db, `INSERT INTO public.store_order_requests(id,store_id,user_id)
    VALUES(gen_random_uuid(),'${STORE}','${CUSTOMER}') RETURNING id::text`);
  const itemId = await scalar(db, `INSERT INTO public.store_order_request_items(id,order_request_id,store_id,
    inventory_id) VALUES(gen_random_uuid(),'${requestId}','${STORE}','${inventoryId}') RETURNING id::text`);
  const photoId = await scalar(db, `INSERT INTO public.order_request_photo_requests(id,store_id,
    order_request_id,order_request_item_id,customer_user_id,state,requested_count)
    VALUES(gen_random_uuid(),'${STORE}','${requestId}','${itemId}','${CUSTOMER}','uploading',2) RETURNING id::text`);
  const media = [];
  for (const sequence of [1, 2]) {
    const mediaId = await scalar(db, `INSERT INTO public.media_assets(store_id,uploaded_by,purpose,
      privacy_class,bucket_id,object_path,sha256,detected_mime,bytes,width,height,request_photo_request_id,
      retention_class) VALUES('${STORE}','${OWNER}','customer_request','private_request','order-request-photos',
      '${STORE}/customer_request/${photoId}/${sequence}.webp','hash-${sequence}','image/webp',100,10,10,
      '${photoId}','request') RETURNING id::text`);
    await db.query(`INSERT INTO public.order_request_media_links(store_id,photo_request_id,media_asset_id,sequence)
      VALUES('${STORE}','${photoId}','${mediaId}',${sequence})`);
    const jobId = await scalar(db, `INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,
      job_kind,dedupe_key,operation_version,status,lease_owner,lease_expires_at)
      VALUES('${STORE}','photo_request','${photoId}','request_photo_validation','validate:${mediaId}',
      '${mediaId}','in_progress','media-worker',transaction_timestamp()+interval '5 minutes') RETURNING id::text`);
    media.push({ mediaId, jobId });
  }
  await db.exec("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)");
  assert.equal(await scalar(db, `SELECT marketplace_sec.complete_request_photo_validation(
    '${media[0].jobId}','media-worker','${photoId}',true)`), 'validation_pending');
  assert.equal(await scalar(db, `SELECT marketplace_sec.complete_request_photo_validation(
    '${media[0].jobId}','media-worker','${photoId}',true)`), 'validation_pending');
  assert.equal(await scalar(db, `SELECT lifecycle_status FROM public.media_assets WHERE id='${media[1].mediaId}'`), 'staged');
  assert.equal(await scalar(db, `SELECT marketplace_sec.complete_request_photo_validation(
    '${media[1].jobId}','media-worker','${photoId}',true)`), 'provided');
  await db.exec('RESET ROLE');
  assert.equal(await scalar(db, `SELECT state FROM public.order_request_photo_requests WHERE id='${photoId}'`), 'provided');
});
