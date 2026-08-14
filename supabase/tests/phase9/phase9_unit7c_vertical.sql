\set ON_ERROR_STOP on

CREATE FUNCTION pg_temp.assert_true(p_ok boolean,p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(p_ok,false) THEN RAISE EXCEPTION 'UNIT7C_PROOF:%',p_message; END IF;
END$$;

INSERT INTO public.marketplace_localities(id,name,is_pilot_enabled)
VALUES('7c000000-0000-4000-8000-000000000001','Unit 7C Locality',true);
INSERT INTO public.stores(
  id,display_name,status,verification_status,setup_status,selling_status,
  pickup_enabled,delivery_enabled,city,locality_id
) VALUES(
  '7c000000-0000-4000-8000-000000000002','Unit 7C Store','active','approved',
  'complete','allowed',true,false,'Pune','7c000000-0000-4000-8000-000000000001'
);
INSERT INTO public.store_administrators(store_id,user_id,role,status)
VALUES('7c000000-0000-4000-8000-000000000002',
  '7c000000-0000-4000-8000-000000000003','owner','active');
INSERT INTO public.store_subscriptions(store_id,status)
VALUES('7c000000-0000-4000-8000-000000000002','trialing');
INSERT INTO public.store_entitlements(store_id,feature_key,limit_value,is_enabled)
VALUES('7c000000-0000-4000-8000-000000000002','active_listing_limit',100,true);
INSERT INTO public.marketplace_policy_config(
  policy_key,scope_type,store_id,value,value_type,policy_version,is_active,effective_from
) VALUES
  ('marketplace_enabled','global',NULL,'true','boolean',1,true,
    transaction_timestamp()-interval '1 day'),
  ('commerce.store_allowlisted','store','7c000000-0000-4000-8000-000000000002',
    'true','boolean',1,true,transaction_timestamp()-interval '1 day');

INSERT INTO public.image_extraction_sessions(
  id,store_id,created_by,status,selected_language,selected_script,
  default_condition,default_location,default_quantity,default_publication
) VALUES(
  '7c000000-0000-4000-8000-000000000004',
  '7c000000-0000-4000-8000-000000000002',
  '7c000000-0000-4000-8000-000000000003','active','en','Latn',
  'good','Shelf 7C',1,'private'
);
INSERT INTO public.image_extraction_candidates(
  id,session_id,store_id,candidate_index,observed_title,observed_authors,
  observed_language,observed_script,owner_review_snapshot,review_disposition,
  state,version,metadata_revision,review_ready,review_version
) VALUES(
  '7c000000-0000-4000-8000-000000000005',
  '7c000000-0000-4000-8000-000000000004',
  '7c000000-0000-4000-8000-000000000002',1,'Observed seam title',
  ARRAY['Observed seam author'],'en','Latn',
  '{
    "value": {
      "originalTitle": "Unit 7C Vertical",
      "authors": ["Unit 7C Author"],
      "originalLanguage": "en",
      "script": "Latn",
      "metadataChoice": {"mode": "manual", "selectionId": null},
      "quantity": 1,
      "priceMinor": 725,
      "baseCondition": "good",
      "damageDisclosure": {
        "hasDamage": false, "damageTypes": [], "damageNote": null,
        "isSellable": true, "completeReadableSafe": true
      },
      "shelfLocation": "Shelf 7C",
      "notes": {"publicNote": "Clean copy", "internalNote": "Private receipt"},
      "publicationIntent": "private",
      "duplicateIntent": null,
      "originalFieldConfirmation": {"title": true, "authors": [true]},
      "candidateDisposition": "reviewed"
    },
    "confirmed_title": {"value": "Unit 7C Vertical"},
    "confirmed_authors": ["Unit 7C Author"]
  }'::jsonb,
  'reviewed','ready',1,1,true,1
);

SELECT set_config('request.jwt.claim.sub','7c000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;
SELECT (public.phase9_add_candidate_to_inventory_v1(
  '7c000000-0000-4000-8000-000000000004',
  '7c000000-0000-4000-8000-000000000005',1,1,1,
  'unit7c-vertical-commit-0001','7c000000-0000-4000-8000-000000000006'
)->>'inventoryId')::uuid AS inventory_id \gset
RESET ROLE;

SELECT pg_temp.assert_true((SELECT listing_quality_status='ready'
  AND version=1 AND quantity_total=1 AND quantity_available=1
  AND quantity_reserved=0 AND quantity_sold=0 AND quantity_removed=0
  FROM public.store_inventory WHERE id=:'inventory_id'::uuid),
  'legitimate Unit 7A private source path did not produce ready balanced inventory');

SET ROLE authenticated;
SELECT public.phase9_set_publication_state_v2(
  :'inventory_id'::uuid,1,1,'publish','unit7c-vertical-publish-0001',
  '7c000000-0000-4000-8000-000000000007') AS publish_result \gset
RESET ROLE;
SELECT id AS listing_id FROM public.marketplace_book_listings
  WHERE inventory_id=:'inventory_id'::uuid \gset
SELECT pg_temp.assert_true((:'publish_result'::jsonb->>'outcome')='published',
  'initial Publish failed');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.phase9_publication_revisions
  WHERE inventory_id=:'inventory_id'::uuid AND revision_number=1
    AND source_action='initial_publish'),'initial Publish did not create Revision 1');
SELECT pg_temp.assert_true((SELECT authors_text='Unit 7C Author'
  AND id=:'listing_id'::uuid AND published_at IS NOT NULL
  FROM public.marketplace_book_listings WHERE inventory_id=:'inventory_id'::uuid),
  'generated/default listing fields were not produced naturally');

SET ROLE authenticated;
SELECT public.phase9_update_store_inventory_details_v1(
  :'inventory_id'::uuid,1,
  '{"authors":["Generated Seam Author"],"sellingPriceMinor":975}'::jsonb,
  'unit7c-vertical-save-0001','7c000000-0000-4000-8000-000000000008'
) AS save_result \gset
SELECT public.phase9_update_store_inventory_details_v1(
  :'inventory_id'::uuid,1,
  '{"authors":["Generated Seam Author"],"sellingPriceMinor":975}'::jsonb,
  'unit7c-vertical-save-0001','7c000000-0000-4000-8000-000000000008'
) AS save_replay \gset
RESET ROLE;
SELECT pg_temp.assert_true(:'save_result'::jsonb=:'save_replay'::jsonb,
  'Save exact replay was not canonical');
SELECT pg_temp.assert_true((SELECT id=:'listing_id'::uuid
  AND selling_price_minor=975 AND authors_text='Generated Seam Author'
  FROM public.marketplace_book_listings WHERE inventory_id=:'inventory_id'::uuid),
  'live Save did not preserve identity and project customer fields');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.phase9_publication_revisions
  WHERE inventory_id=:'inventory_id'::uuid),'live Save/replay revision count was not exact');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.marketplace_audit_logs
  WHERE entity_id=:'inventory_id'::uuid AND action='phase9.inventory.details_updated'),
  'Save replay duplicated audit');

SET ROLE authenticated;
SELECT public.phase9_adjust_inventory_stock_v2(
  :'inventory_id'::uuid,2,-1,'unit7c-vertical-stock-zero-0001',
  '7c000000-0000-4000-8000-000000000009') AS zero_result \gset
RESET ROLE;
SELECT pg_temp.assert_true((SELECT quantity_total=0 AND quantity_available=0
  AND visibility_status='published' AND publication_status='published'
  FROM public.store_inventory WHERE id=:'inventory_id'::uuid),
  'live 1 to 0 did not commit while preserving live intent');
SELECT pg_temp.assert_true((SELECT id=:'listing_id'::uuid AND status='out_of_stock'
  AND availability_status='unavailable' FROM public.marketplace_book_listings
  WHERE inventory_id=:'inventory_id'::uuid),'live 1 to 0 projection is not unavailable');
SELECT pg_temp.assert_true(jsonb_array_length(public.phase9_public_listing_search_v2(
  NULL,'7c000000-0000-4000-8000-000000000002',20))=0,
  'out-of-stock listing remained discoverable');

SET ROLE authenticated;
SELECT public.phase9_adjust_inventory_stock_v2(
  :'inventory_id'::uuid,3,1,'unit7c-vertical-stock-restore-0001',
  '7c000000-0000-4000-8000-000000000010') AS restore_result \gset
RESET ROLE;
SELECT pg_temp.assert_true((SELECT id=:'listing_id'::uuid AND status='active'
  AND availability_status='low_stock' FROM public.marketplace_book_listings
  WHERE inventory_id=:'inventory_id'::uuid),'live 0 to 1 did not restore availability');
SELECT pg_temp.assert_true(jsonb_array_length(public.phase9_public_listing_search_v2(
  NULL,'7c000000-0000-4000-8000-000000000002',20))=1,
  'restored listing was not discoverable');

DO $$
DECLARE v_inventory uuid; v_before_inventory jsonb; v_before_listing jsonb;
  v_before_revisions integer; v_failed boolean:=false;
BEGIN
  SELECT id INTO v_inventory FROM public.store_inventory
    WHERE created_from_candidate_id='7c000000-0000-4000-8000-000000000005';
  SELECT to_jsonb(i) INTO v_before_inventory FROM public.store_inventory i WHERE i.id=v_inventory;
  SELECT to_jsonb(l) INTO v_before_listing FROM public.marketplace_book_listings l WHERE l.inventory_id=v_inventory;
  SELECT count(*) INTO v_before_revisions FROM public.phase9_publication_revisions r
    WHERE r.inventory_id=v_inventory;
  BEGIN
    PERFORM public.phase9_update_store_inventory_details_v1(v_inventory,4,
      '{"hasDamage":true,"damageTypes":["cover"],"damageNote":"Visible mark"}'::jsonb,
      'unit7c-vertical-invalid-save-0001','7c000000-0000-4000-8000-000000000011');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ '^P9_(MEDIA_NOT_APPROVED|PUBLICATION_INELIGIBLE)' THEN RAISE; END IF;
    v_failed:=true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'UNIT7C_PROOF:invalid live Save succeeded'; END IF;
  IF (SELECT to_jsonb(i) FROM public.store_inventory i WHERE i.id=v_inventory)
      IS DISTINCT FROM v_before_inventory
    OR (SELECT to_jsonb(l) FROM public.marketplace_book_listings l WHERE l.inventory_id=v_inventory)
      IS DISTINCT FROM v_before_listing
    OR (SELECT count(*) FROM public.phase9_publication_revisions r WHERE r.inventory_id=v_inventory)
      <>v_before_revisions
  THEN RAISE EXCEPTION 'UNIT7C_PROOF:invalid live Save did not roll back atomically'; END IF;
END$$;

SELECT pg_temp.assert_true((SELECT count(*)=4 FROM public.phase9_publication_revisions
  WHERE inventory_id=:'inventory_id'::uuid),'public revision sequence is not deterministic');
SELECT pg_temp.assert_true((SELECT array_agg(revision_number ORDER BY revision_number)=ARRAY[1,2,3,4]
  FROM public.phase9_publication_revisions WHERE inventory_id=:'inventory_id'::uuid),
  'public revision numbers contain a gap or duplicate');
SELECT pg_temp.assert_true((SELECT bool_and(NOT (public_snapshot ?| ARRAY[
  'quantity_total','quantity_reserved','shelf_location','internal_notes','actor',
  'provider','object_path','token'])) FROM public.phase9_publication_revisions
  WHERE inventory_id=:'inventory_id'::uuid),'public revision snapshot leaked private keys');

SELECT 'UNIT_7C_REAL_POSTGRES_VERTICAL_PASS' AS result;
