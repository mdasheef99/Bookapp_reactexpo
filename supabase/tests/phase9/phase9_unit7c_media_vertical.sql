\set ON_ERROR_STOP on

CREATE FUNCTION pg_temp.assert_true(p_ok boolean,p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(p_ok,false) THEN RAISE EXCEPTION 'UNIT7C_MEDIA_PROOF:%',p_message; END IF;
END$$;

-- Disposable fixtures (mirrors the Unit 7B concurrency seeding).
INSERT INTO public.marketplace_localities(id,name,is_pilot_enabled)
VALUES('d5000000-0000-4000-8000-000000000001','Unit 7C Media Locality',true);
INSERT INTO public.stores(
  id,display_name,status,verification_status,setup_status,selling_status,
  pickup_enabled,delivery_enabled,city,locality_id
) VALUES(
  'd5000000-0000-4000-8000-000000000002','Unit 7C Media Store','active','approved',
  'complete','allowed',true,false,'Pune','d5000000-0000-4000-8000-000000000001'
);
INSERT INTO public.store_administrators(store_id,user_id,role,status)
VALUES('d5000000-0000-4000-8000-000000000002',
  'd5000000-0000-4000-8000-000000000003','owner','active');
INSERT INTO public.store_subscriptions(store_id,status)
VALUES('d5000000-0000-4000-8000-000000000002','trialing');
INSERT INTO public.store_entitlements(store_id,feature_key,limit_value,is_enabled)
VALUES('d5000000-0000-4000-8000-000000000002','active_listing_limit',100,true);
INSERT INTO public.marketplace_policy_config(
  policy_key,scope_type,store_id,value,value_type,policy_version,is_active,effective_from
) VALUES
  ('marketplace_enabled','global',NULL,'true','boolean',1,true,
    transaction_timestamp()-interval '1 day'),
  ('commerce.store_allowlisted','store','d5000000-0000-4000-8000-000000000002',
    'true','boolean',1,true,transaction_timestamp()-interval '1 day');

INSERT INTO public.store_inventory(
  id,store_id,title,authors,language,condition,selling_price_minor,
  quantity_total,quantity_available,visibility_status,publication_status,
  publication_intent_version,version,is_sellable,has_damage,damage_types,damage_notes,
  listing_quality_status,entry_method,created_by
) VALUES
('d5000000-0000-4000-8000-000000000011','d5000000-0000-4000-8000-000000000002',
 'Media vertical title',array['Media Author'],'en','good',725,3,3,
 'draft','private',1,1,true,false,'{}',NULL,'ready','manual',
 'd5000000-0000-4000-8000-000000000003'),
('d5000000-0000-4000-8000-000000000012','d5000000-0000-4000-8000-000000000002',
 'Damage vertical title',array['Damage Author'],'en','good',725,2,2,
 'draft','private',1,1,true,true,array['cover'],'Worn cover','ready','manual',
 'd5000000-0000-4000-8000-000000000003');

SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

-- Initial primary through the real Unit 7B pipeline, then submit the link.
SELECT (public.phase9_authorize_public_copy_upload_v2(
  'd5000000-0000-4000-8000-000000000011','primary_fallback',1,'image/png',128,
  repeat('a',64),transaction_timestamp()+interval '10 minutes',
  'wu4-media-auth-01','d5000000-0000-4000-8000-000000000101'))->>'capabilityId'
  AS capability_id \gset auth1_
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.role','service_role',false);
SET ROLE service_role;
SELECT (public.phase9_register_public_copy_upload_v1(
  'd5000000-0000-4000-8000-000000000003',:'auth1_capability_id',repeat('a',64),
  repeat('a',64),'image/png',128,'wu4-media-reg-01',
  'd5000000-0000-4000-8000-000000000102'))->>'media_asset_id' AS source_id \gset reg1_
SELECT id AS job_id,attempt_count,lease_token FROM public.claim_phase9_media_validation_jobs(
  1,'media-worker-wu4') \gset job1_
SELECT (public.phase9_media_validation_context_v2(
  :'job1_job_id','media-worker-wu4',:'job1_lease_token',:job1_attempt_count))->>'snapshot_path'
  AS snapshot_path,
  (public.phase9_media_validation_context_v2(
  :'job1_job_id','media-worker-wu4',:'job1_lease_token',:job1_attempt_count))->>'source_sha256'
  AS source_sha256,
  (public.phase9_media_validation_context_v2(
  :'job1_job_id','media-worker-wu4',:'job1_lease_token',:job1_attempt_count))->>'source_bytes'
  AS source_bytes,
  (public.phase9_media_validation_context_v2(
  :'job1_job_id','media-worker-wu4',:'job1_lease_token',:job1_attempt_count))->>'source_mime'
  AS source_mime,
  (public.phase9_media_validation_context_v2(
  :'job1_job_id','media-worker-wu4',:'job1_lease_token',:job1_attempt_count))->>'source_object_identity'
  AS source_object_identity,
  (public.phase9_media_validation_context_v2(
  :'job1_job_id','media-worker-wu4',:'job1_lease_token',:job1_attempt_count))->>'target_path'
  AS target_path \gset ctx1_
SELECT public.phase9_bind_media_validation_snapshot_v2(
  :'job1_job_id','media-worker-wu4',:'job1_lease_token',:job1_attempt_count,
  :'ctx1_snapshot_path',:'ctx1_source_sha256',:ctx1_source_bytes::bigint,:'ctx1_source_mime');
SELECT (public.phase9_complete_media_validation_v2(
  :'job1_job_id','media-worker-wu4',:'job1_lease_token',:job1_attempt_count,
  :'ctx1_source_object_identity',:'ctx1_source_sha256',:'ctx1_snapshot_path',
  :'ctx1_target_path',repeat('b',64),96,1,1))->>'media_asset_id' AS media_asset_id \gset done1_
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;
SELECT public.phase9_submit_public_copy_media_v2(
  'd5000000-0000-4000-8000-000000000011',:'auth1_capability_id',
  :'done1_media_asset_id','primary_fallback',1,'wu4-media-link-01',
  'd5000000-0000-4000-8000-000000000103') AS link_id \gset link1_

-- Publish: live listing with one revision and the approved primary cover.
SELECT public.phase9_set_publication_state_v2(
  'd5000000-0000-4000-8000-000000000011',1,1,'publish','wu4-media-publish-01',
  'd5000000-0000-4000-8000-000000000104');
RESET ROLE;
SELECT pg_temp.assert_true(EXISTS(
  SELECT 1 FROM public.marketplace_book_listings l
  WHERE l.inventory_id='d5000000-0000-4000-8000-000000000011'
    AND l.status='active' AND l.primary_public_media_id=:'done1_media_asset_id'),
  'live listing does not carry the approved primary');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.phase9_publication_revisions r
  WHERE r.inventory_id='d5000000-0000-4000-8000-000000000011')=1,
  'publish did not create exactly one revision');
SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

-- Replacement upload while the old primary stays public.
SELECT (public.phase9_authorize_public_copy_upload_v2(
  'd5000000-0000-4000-8000-000000000011','primary_fallback',1,'image/png',128,
  repeat('c',64),transaction_timestamp()+interval '10 minutes',
  'wu4-media-auth-02','d5000000-0000-4000-8000-000000000105'))->>'capabilityId'
  AS capability_id \gset auth2_
SELECT set_config('request.jwt.claim.role','service_role',false);
SET ROLE service_role;
SELECT public.phase9_register_public_copy_upload_v1(
  'd5000000-0000-4000-8000-000000000003',:'auth2_capability_id',repeat('d',64),
  repeat('c',64),'image/png',128,'wu4-media-reg-02',
  'd5000000-0000-4000-8000-000000000106');
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;
RESET ROLE;
SELECT pg_temp.assert_true((SELECT primary_public_media_id FROM
  public.marketplace_book_listings WHERE inventory_id='d5000000-0000-4000-8000-000000000011')
  = :'done1_media_asset_id','old primary changed during replacement processing');
SELECT set_config('request.jwt.claim.role','service_role',false);
SET ROLE service_role;
SELECT id AS job_id,attempt_count,lease_token FROM public.claim_phase9_media_validation_jobs(
  1,'media-worker-wu4') \gset job2_
SELECT (public.phase9_media_validation_context_v2(
  :'job2_job_id','media-worker-wu4',:'job2_lease_token',:job2_attempt_count))->>'snapshot_path'
  AS snapshot_path,
  (public.phase9_media_validation_context_v2(
  :'job2_job_id','media-worker-wu4',:'job2_lease_token',:job2_attempt_count))->>'source_sha256'
  AS source_sha256,
  (public.phase9_media_validation_context_v2(
  :'job2_job_id','media-worker-wu4',:'job2_lease_token',:job2_attempt_count))->>'source_bytes'
  AS source_bytes,
  (public.phase9_media_validation_context_v2(
  :'job2_job_id','media-worker-wu4',:'job2_lease_token',:job2_attempt_count))->>'source_mime'
  AS source_mime,
  (public.phase9_media_validation_context_v2(
  :'job2_job_id','media-worker-wu4',:'job2_lease_token',:job2_attempt_count))->>'source_object_identity'
  AS source_object_identity,
  (public.phase9_media_validation_context_v2(
  :'job2_job_id','media-worker-wu4',:'job2_lease_token',:job2_attempt_count))->>'target_path'
  AS target_path \gset ctx2_
SELECT public.phase9_bind_media_validation_snapshot_v2(
  :'job2_job_id','media-worker-wu4',:'job2_lease_token',:job2_attempt_count,
  :'ctx2_snapshot_path',:'ctx2_source_sha256',:ctx2_source_bytes::bigint,:'ctx2_source_mime');
SELECT (public.phase9_complete_media_validation_v2(
  :'job2_job_id','media-worker-wu4',:'job2_lease_token',:job2_attempt_count,
  :'ctx2_source_object_identity',:'ctx2_source_sha256',:'ctx2_snapshot_path',
  :'ctx2_target_path',repeat('e',64),96,1,1))->>'media_asset_id' AS media_asset_id \gset done2_
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

-- Atomic approved replacement through the Unit 7C command.
SELECT (public.phase9_replace_store_view_media_v1(
  'd5000000-0000-4000-8000-000000000011',1,:'auth2_capability_id',
  :'done2_media_asset_id',:'link1_link_id',
  'wu4-media-replace-01','d5000000-0000-4000-8000-000000000107'))->>'outcome' AS outcome,
  (public.phase9_replace_store_view_media_v1(
  'd5000000-0000-4000-8000-000000000011',1,:'auth2_capability_id',
  :'done2_media_asset_id',:'link1_link_id',
  'wu4-media-replace-01','d5000000-0000-4000-8000-000000000107'))->>'mediaAssetId'
  AS media_asset_id \gset replaced_
RESET ROLE;
SELECT pg_temp.assert_true(:'replaced_outcome'='media_replaced','replacement outcome invalid');
SELECT pg_temp.assert_true((SELECT primary_public_media_id FROM
  public.marketplace_book_listings WHERE inventory_id='d5000000-0000-4000-8000-000000000011')
  = :'done2_media_asset_id','listing does not carry the swapped approved primary');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.phase9_publication_revisions r
  WHERE r.inventory_id='d5000000-0000-4000-8000-000000000011')=2,
  'live media replacement did not append exactly one revision');
SELECT pg_temp.assert_true((SELECT source_action FROM public.phase9_publication_revisions r
  WHERE r.inventory_id='d5000000-0000-4000-8000-000000000011'
  ORDER BY revision_number DESC LIMIT 1)='media_change','replacement revision source invalid');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.inventory_media_links l
  WHERE l.inventory_id='d5000000-0000-4000-8000-000000000011')=1
  AND (SELECT count(*) FROM public.inventory_media_links l
  WHERE l.inventory_id='d5000000-0000-4000-8000-000000000011'
    AND l.media_asset_id=:'done1_media_asset_id')=0,
  'old link remained effective after atomic swap');
SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

-- Exact replay adds zero new effects.
SELECT (public.phase9_replace_store_view_media_v1(
  'd5000000-0000-4000-8000-000000000011',1,:'auth2_capability_id',
  :'done2_media_asset_id',:'link1_link_id',
  'wu4-media-replace-01','d5000000-0000-4000-8000-000000000107'))->>'mediaAssetId'
  AS media_asset_id \gset replay_
RESET ROLE;
SELECT pg_temp.assert_true(:'replay_media_asset_id'=:'done2_media_asset_id','replay result diverged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.phase9_publication_revisions r
  WHERE r.inventory_id='d5000000-0000-4000-8000-000000000011')=2,'replay appended a revision');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.marketplace_audit_logs a
  WHERE a.entity_id='d5000000-0000-4000-8000-000000000011')=2,
  'replay appended audit evidence');
SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

-- Damage evidence: unsafe removal is rejected and the previous public state survives.
SELECT (public.phase9_authorize_public_copy_upload_v2(
  'd5000000-0000-4000-8000-000000000012','damage',1,'image/png',128,
  repeat('f',64),transaction_timestamp()+interval '10 minutes',
  'wu4-media-auth-03','d5000000-0000-4000-8000-000000000108'))->>'capabilityId'
  AS capability_id \gset auth3_
SELECT set_config('request.jwt.claim.role','service_role',false);
SET ROLE service_role;
SELECT public.phase9_register_public_copy_upload_v1(
  'd5000000-0000-4000-8000-000000000003',:'auth3_capability_id',repeat('a',64),
  repeat('f',64),'image/png',128,'wu4-media-reg-03',
  'd5000000-0000-4000-8000-000000000109');
SELECT id AS job_id,attempt_count,lease_token FROM public.claim_phase9_media_validation_jobs(
  1,'media-worker-wu4') \gset job3_
SELECT (public.phase9_media_validation_context_v2(
  :'job3_job_id','media-worker-wu4',:'job3_lease_token',:job3_attempt_count))->>'snapshot_path'
  AS snapshot_path,
  (public.phase9_media_validation_context_v2(
  :'job3_job_id','media-worker-wu4',:'job3_lease_token',:job3_attempt_count))->>'source_sha256'
  AS source_sha256,
  (public.phase9_media_validation_context_v2(
  :'job3_job_id','media-worker-wu4',:'job3_lease_token',:job3_attempt_count))->>'source_bytes'
  AS source_bytes,
  (public.phase9_media_validation_context_v2(
  :'job3_job_id','media-worker-wu4',:'job3_lease_token',:job3_attempt_count))->>'source_mime'
  AS source_mime,
  (public.phase9_media_validation_context_v2(
  :'job3_job_id','media-worker-wu4',:'job3_lease_token',:job3_attempt_count))->>'source_object_identity'
  AS source_object_identity,
  (public.phase9_media_validation_context_v2(
  :'job3_job_id','media-worker-wu4',:'job3_lease_token',:job3_attempt_count))->>'target_path'
  AS target_path \gset ctx3_
SELECT public.phase9_bind_media_validation_snapshot_v2(
  :'job3_job_id','media-worker-wu4',:'job3_lease_token',:job3_attempt_count,
  :'ctx3_snapshot_path',:'ctx3_source_sha256',:ctx3_source_bytes::bigint,:'ctx3_source_mime');
SELECT (public.phase9_complete_media_validation_v2(
  :'job3_job_id','media-worker-wu4',:'job3_lease_token',:job3_attempt_count,
  :'ctx3_source_object_identity',:'ctx3_source_sha256',:'ctx3_snapshot_path',
  :'ctx3_target_path',repeat('a',64),96,1,1))->>'media_asset_id' AS media_asset_id \gset done3_
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;
SELECT public.phase9_submit_public_copy_media_v2(
  'd5000000-0000-4000-8000-000000000012',:'auth3_capability_id',
  :'done3_media_asset_id','damage',1,'wu4-media-link-03',
  'd5000000-0000-4000-8000-000000000110') AS link_id \gset dlink_
SELECT public.phase9_set_publication_state_v2(
  'd5000000-0000-4000-8000-000000000012',1,1,'publish','wu4-media-publish-03',
  'd5000000-0000-4000-8000-000000000111');
RESET ROLE;
SELECT pg_temp.assert_true(EXISTS(
  SELECT 1 FROM public.marketplace_book_listings l
  WHERE l.inventory_id='d5000000-0000-4000-8000-000000000012' AND l.status='active'),
  'damage inventory did not publish');
SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

\set ON_ERROR_STOP off
SELECT public.phase9_remove_store_view_media_v1(
  'd5000000-0000-4000-8000-000000000012',1,:'dlink_link_id',
  'wu4-media-remove-unsafe','d5000000-0000-4000-8000-000000000112');
\set ON_ERROR_STOP on
RESET ROLE;
SELECT pg_temp.assert_true((SELECT visibility_status FROM public.store_inventory
  WHERE id='d5000000-0000-4000-8000-000000000012')='published'
  AND (SELECT status FROM public.marketplace_book_listings
  WHERE inventory_id='d5000000-0000-4000-8000-000000000012')='active',
  'unsafe damage removal mutated the live public state');
SELECT pg_temp.assert_true((SELECT version FROM public.store_inventory
  WHERE id='d5000000-0000-4000-8000-000000000012')=1,
  'unsafe removal incremented the inventory version');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.inventory_media_links l
  WHERE l.inventory_id='d5000000-0000-4000-8000-000000000012')=1,
  'unsafe removal changed the media set');
SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

-- Valid approved damage replacement succeeds atomically without extra revision churn.
SELECT (public.phase9_authorize_public_copy_upload_v2(
  'd5000000-0000-4000-8000-000000000012','damage',1,'image/png',128,
  repeat('b',64),transaction_timestamp()+interval '10 minutes',
  'wu4-media-auth-04','d5000000-0000-4000-8000-000000000113'))->>'capabilityId'
  AS capability_id \gset auth4_
SELECT set_config('request.jwt.claim.role','service_role',false);
SET ROLE service_role;
SELECT public.phase9_register_public_copy_upload_v1(
  'd5000000-0000-4000-8000-000000000003',:'auth4_capability_id',repeat('c',64),
  repeat('b',64),'image/png',128,'wu4-media-reg-04',
  'd5000000-0000-4000-8000-000000000114');
SELECT id AS job_id,attempt_count,lease_token FROM public.claim_phase9_media_validation_jobs(
  1,'media-worker-wu4') \gset job4_
SELECT (public.phase9_media_validation_context_v2(
  :'job4_job_id','media-worker-wu4',:'job4_lease_token',:job4_attempt_count))->>'snapshot_path'
  AS snapshot_path,
  (public.phase9_media_validation_context_v2(
  :'job4_job_id','media-worker-wu4',:'job4_lease_token',:job4_attempt_count))->>'source_sha256'
  AS source_sha256,
  (public.phase9_media_validation_context_v2(
  :'job4_job_id','media-worker-wu4',:'job4_lease_token',:job4_attempt_count))->>'source_bytes'
  AS source_bytes,
  (public.phase9_media_validation_context_v2(
  :'job4_job_id','media-worker-wu4',:'job4_lease_token',:job4_attempt_count))->>'source_mime'
  AS source_mime,
  (public.phase9_media_validation_context_v2(
  :'job4_job_id','media-worker-wu4',:'job4_lease_token',:job4_attempt_count))->>'source_object_identity'
  AS source_object_identity,
  (public.phase9_media_validation_context_v2(
  :'job4_job_id','media-worker-wu4',:'job4_lease_token',:job4_attempt_count))->>'target_path'
  AS target_path \gset ctx4_
SELECT public.phase9_bind_media_validation_snapshot_v2(
  :'job4_job_id','media-worker-wu4',:'job4_lease_token',:job4_attempt_count,
  :'ctx4_snapshot_path',:'ctx4_source_sha256',:ctx4_source_bytes::bigint,:'ctx4_source_mime');
SELECT (public.phase9_complete_media_validation_v2(
  :'job4_job_id','media-worker-wu4',:'job4_lease_token',:job4_attempt_count,
  :'ctx4_source_object_identity',:'ctx4_source_sha256',:'ctx4_snapshot_path',
  :'ctx4_target_path',repeat('d',64),96,1,1))->>'media_asset_id' AS media_asset_id \gset done4_
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;
SELECT public.phase9_replace_store_view_media_v1(
  'd5000000-0000-4000-8000-000000000012',1,:'auth4_capability_id',
  :'done4_media_asset_id',:'dlink_link_id',
  'wu4-media-replace-04','d5000000-0000-4000-8000-000000000115');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT media_asset_id FROM public.inventory_media_links l
  WHERE l.inventory_id='d5000000-0000-4000-8000-000000000012')
  = :'done4_media_asset_id','damage replacement did not swap the approved asset');
SELECT pg_temp.assert_true((SELECT status FROM public.marketplace_book_listings
  WHERE inventory_id='d5000000-0000-4000-8000-000000000012')='active',
  'damage replacement disturbed the live listing');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.phase9_publication_revisions r
  WHERE r.inventory_id='d5000000-0000-4000-8000-000000000012')=1,
  'identical public snapshot replacement appended a revision');
SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

-- Owner media read: approved public records only, no staging paths.
SELECT public.phase9_store_view_media_v1(
  'd5000000-0000-4000-8000-000000000011') AS media \gset m_
SELECT pg_temp.assert_true(jsonb_typeof(:'m_media'::jsonb->'media')='array'
  AND jsonb_array_length(:'m_media'::jsonb->'media')=1,'media read shape invalid');
SELECT pg_temp.assert_true(:'m_media'::jsonb->'media'->0->>'url'
  LIKE '/storage/v1/object/public/inventory-photos/%','media read exposed a non-public URL');
SELECT pg_temp.assert_true(position('marketplace-media-staging' in :'m_media'::text)=0,
  'media read exposed a staging path');

-- Activity/history read: authoritative records with no private fields, append-only.
SELECT public.phase9_store_view_history_v1(
  'd5000000-0000-4000-8000-000000000011') AS history \gset h_
SELECT pg_temp.assert_true(jsonb_array_length(:'h_history'::jsonb->'publicRevisions')=2,
  'history read did not return both revisions');
SELECT pg_temp.assert_true(jsonb_array_length(:'h_history'::jsonb->'activity')>0,
  'history read returned no activity');
SELECT pg_temp.assert_true(position('shelfLocation' in :'h_history'::text)=0
  AND position('internalNotes' in :'h_history'::text)=0
  AND position('quantityTotal' in :'h_history'::text)=0
  AND position('object_path' in :'h_history'::text)=0,
  'history read exposed private fields');

\set ON_ERROR_STOP off
SELECT set_config('request.jwt.claim.role','service_role',false);
SET ROLE service_role;
DELETE FROM public.phase9_publication_revisions
  WHERE inventory_id='d5000000-0000-4000-8000-000000000011';
RESET ROLE;
\set ON_ERROR_STOP on
SELECT pg_temp.assert_true((SELECT count(*) FROM public.phase9_publication_revisions r
  WHERE r.inventory_id='d5000000-0000-4000-8000-000000000011')=2,
  'append-only history accepted a mutation');
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

-- Cross-store media identity: non-enumerating rejection.
SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000099',false);
\set ON_ERROR_STOP off
SELECT public.phase9_store_view_media_v1('d5000000-0000-4000-8000-000000000011');
\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;

SELECT 'UNIT_7C_WU4_REAL_POSTGRES_MEDIA_PASS';
