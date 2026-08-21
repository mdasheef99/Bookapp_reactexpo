\set ON_ERROR_STOP on

CREATE FUNCTION pg_temp.assert_true(p_ok boolean,p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(p_ok,false) THEN
    RAISE EXCEPTION 'U8B_ACCEPTANCE:%',p_message;
  END IF;
END$$;

INSERT INTO public.marketplace_localities(id,name,is_pilot_enabled)
VALUES('a1000000-0000-4000-8000-000000000001','U8B Acceptance Locality',true);
INSERT INTO public.stores(
  id,display_name,status,verification_status,setup_status,selling_status,
  pickup_enabled,delivery_enabled,city,locality_id
) VALUES
  ('a1000000-0000-4000-8000-000000000002','U8B Store A','active','approved','complete','allowed',true,true,'Pune','a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000003','U8B Store B','active','approved','complete','allowed',true,true,'Pune','a1000000-0000-4000-8000-000000000001');
INSERT INTO public.store_administrators(store_id,user_id,role,status)
VALUES
  ('a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','owner','active'),
  ('a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000004','owner','active');
INSERT INTO public.store_subscriptions(store_id,status)
VALUES
  ('a1000000-0000-4000-8000-000000000002','active'),
  ('a1000000-0000-4000-8000-000000000003','active');
INSERT INTO public.store_entitlements(store_id,feature_key,limit_value,is_enabled)
VALUES
  ('a1000000-0000-4000-8000-000000000002','active_listing_limit',100,true),
  ('a1000000-0000-4000-8000-000000000003','active_listing_limit',100,true);
INSERT INTO public.public_store_profiles(
  store_id,display_name,city,state,locality_id,locality_name,
  pickup_enabled,delivery_enabled,return_policy_type
) VALUES
  ('a1000000-0000-4000-8000-000000000002','U8B Store A','Pune','MH','a1000000-0000-4000-8000-000000000001','U8B Acceptance Locality',true,true,'no_returns'),
  ('a1000000-0000-4000-8000-000000000003','U8B Store B','Pune','MH','a1000000-0000-4000-8000-000000000001','U8B Acceptance Locality',true,true,'no_returns');
INSERT INTO public.marketplace_policy_config(
  policy_key,scope_type,scope_value,store_id,value,value_type,
  policy_version,is_active,effective_from
) VALUES
  ('marketplace_enabled','global',NULL,NULL,'true'::jsonb,'boolean',1,true,transaction_timestamp()-interval '1 day'),
  ('commerce.store_allowlisted','global',NULL,NULL,'true'::jsonb,'boolean',1,true,transaction_timestamp()-interval '1 day'),
  ('unrelated.high.version','global',NULL,NULL,'true'::jsonb,'boolean',99,true,transaction_timestamp()-interval '1 day');

INSERT INTO public.store_inventory(
  id,store_id,title,authors,language,condition,selling_price_minor,
  quantity_total,quantity_available,visibility_status,publication_status,
  publication_intent_version,version,is_sellable,has_damage,damage_types,
  damage_notes,listing_quality_status,entry_method,created_by,cover_url,isbn_13
) VALUES
  ('a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000002','U8B Real PostgreSQL',ARRAY['U8B Author'],'en','good',300,3,3,'draft','private',1,1,true,false,'{}',NULL,'ready','manual','a1000000-0000-4000-8000-000000000004',NULL,'9780306406157'),
  ('a1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000002','U8B Real PostgreSQL',ARRAY['U8B Author'],'en','good',400,3,3,'draft','private',1,1,true,false,'{}',NULL,'ready','manual','a1000000-0000-4000-8000-000000000004','https://provider.example.com/u8b-cover.jpg','9780306406157'),
  ('a1000000-0000-4000-8000-000000000021','a1000000-0000-4000-8000-000000000003','U8B Real PostgreSQL',ARRAY['U8B Author'],'en','good',500,3,3,'draft','private',1,1,true,false,'{}',NULL,'ready','manual','a1000000-0000-4000-8000-000000000004',NULL,'9780306406157');
INSERT INTO public.marketplace_book_listings(
  id,inventory_id,store_id,public_title,public_authors,isbn_13,condition,
  selling_price_minor,availability_status,status,moderation_status,
  listing_quality_status,fulfillment_options,pickup_available,delivery_available,
  language,has_damage,damage_types,public_media_count,last_inventory_verified_bucket,
  search_document,updated_at,public_cover_url
) VALUES
  ('a1000000-0000-4000-8000-000000000111','a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000002','U8B Real PostgreSQL',ARRAY['U8B Author'],'9780306406157','good',300,'available','active','approved','ready',ARRAY['pickup','delivery'],true,true,'en',false,'{}',0,'recent',to_tsvector('simple','U8B Real PostgreSQL U8B Author'),transaction_timestamp(),'https://cdn.example.com/actual-copy.jpg'),
  ('a1000000-0000-4000-8000-000000000112','a1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000002','U8B Real PostgreSQL',ARRAY['U8B Author'],'9780306406157','good',400,'available','active','approved','ready',ARRAY['pickup','delivery'],true,true,'en',false,'{}',0,'recent',to_tsvector('simple','U8B Real PostgreSQL U8B Author'),transaction_timestamp(),'https://provider.example.com/u8b-cover.jpg'),
  ('a1000000-0000-4000-8000-000000000121','a1000000-0000-4000-8000-000000000021','a1000000-0000-4000-8000-000000000003','U8B Real PostgreSQL',ARRAY['U8B Author'],'9780306406157','good',500,'available','active','approved','ready',ARRAY['pickup','delivery'],true,true,'en',false,'{}',0,'recent',to_tsvector('simple','U8B Real PostgreSQL U8B Author'),transaction_timestamp(),NULL);
UPDATE public.store_inventory
SET visibility_status='published',publication_status='published'
WHERE id IN (
  'a1000000-0000-4000-8000-000000000011',
  'a1000000-0000-4000-8000-000000000012',
  'a1000000-0000-4000-8000-000000000021'
);

-- One approved primary actual-copy derivative for the cheaper offer.
INSERT INTO public.media_assets(
  id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
  sha256,detected_mime,bytes,width,height,retention_class,lifecycle_status
) VALUES(
  'a1000000-0000-4000-8000-000000000211','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004',
  'public_copy','private_scan','marketplace-media-staging','a1000000-0000-4000-8000-000000000002/source.jpg',
  repeat('a',64),'image/jpeg',128,1,1,'phase9-public-copy-source','staged'
);
INSERT INTO public.media_assets(
  id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
  sha256,detected_mime,bytes,width,height,validation_version,validated_at,
  reencode_version,exif_strip_version,source_media_asset_id,retention_class,
  lifecycle_status
) VALUES(
  'a1000000-0000-4000-8000-000000000212','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004',
  'public_copy','public','inventory-photos','a1000000-0000-4000-8000-000000000002/approved-copy.webp',
  repeat('b',64),'image/webp',256,1,1,'phase9-media-v1',transaction_timestamp(),
  'phase9-reencode-v1','phase9-exif-v1','a1000000-0000-4000-8000-000000000211',
  'phase9-public-copy','approved'
);
INSERT INTO public.inventory_media_links(
  id,store_id,inventory_id,media_asset_id,role,public_order,
  approval_status,approved_by,approved_at
) VALUES(
  'a1000000-0000-4000-8000-000000000213','a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000212',
  'primary_fallback',1,'approved','a1000000-0000-4000-8000-000000000004',transaction_timestamp()
);
UPDATE public.marketplace_book_listings
SET primary_public_media_id='a1000000-0000-4000-8000-000000000212',
    public_media_count=1,
    public_cover_url='https://cdn.example.com/actual-copy.jpg'
WHERE id='a1000000-0000-4000-8000-000000000111';
UPDATE public.marketplace_book_listings
SET public_cover_url='https://provider.example.com/u8b-cover.jpg'
WHERE id='a1000000-0000-4000-8000-000000000112';

SELECT set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;
SELECT public.phase9_bookstore_search_v1(
  'U8B Real PostgreSQL',1,NULL,'{}'::jsonb,NULL
) AS result \gset first_
SELECT pg_temp.assert_true((:'first_result'::jsonb->>'bookstoreCount')::integer=2,
  'bookstore count did not include both stores');
SELECT pg_temp.assert_true(:'first_result'::jsonb->'items'->0->'store'->>'publicStoreId'='a1000000-0000-4000-8000-000000000002',
  'offer-count ranking did not place the two-offer store first');
SELECT pg_temp.assert_true(:'first_result'::jsonb->'items'->0->'matchedBook'->>'cover'='https://provider.example.com/u8b-cover.jpg',
  'provider cover was not selected from upstream inventory provenance');
SELECT pg_temp.assert_true(position('inventoryId' in :'first_result')=0,
  'public DTO exposed inventoryId');
SELECT :'first_result'::jsonb->'pageInfo'->>'nextCursor' AS next_cursor \gset first_
SELECT pg_temp.assert_true(:'first_next_cursor' IS NOT NULL,
  'page one did not produce a cursor');

-- A relevant policy change must invalidate even with an unrelated higher version.
RESET ROLE;
INSERT INTO public.marketplace_policy_config(
  policy_key,scope_type,scope_value,store_id,value,value_type,
  policy_version,is_active,effective_from
) VALUES('marketplace_enabled','global',NULL,NULL,'true'::jsonb,'boolean',2,true,transaction_timestamp());
SET ROLE authenticated;
SELECT set_config('u8b.first_cursor', :'first_next_cursor', false);
DO $$
DECLARE v_message text;
BEGIN
  BEGIN
    PERFORM public.phase9_bookstore_search_v1(
      'U8B Real PostgreSQL',1,current_setting('u8b.first_cursor'),'{}'::jsonb,NULL
    );
    RAISE EXCEPTION 'U8B_ACCEPTANCE:stale cursor was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'P9_CURSOR_INVALID' THEN
      RAISE EXCEPTION 'U8B_ACCEPTANCE:unexpected stale cursor error:%',v_message;
    END IF;
  END;
END$$;

-- Reissue a cursor under the new policy epoch and corrupt its decrypted page size.
SELECT public.phase9_bookstore_search_v1(
  'U8B Real PostgreSQL',1,NULL,'{}'::jsonb,NULL
) AS result \gset fresh_
SELECT :'fresh_result'::jsonb->'pageInfo'->>'nextCursor' AS next_cursor \gset fresh_
RESET ROLE;
SET ROLE service_role;
SELECT marketplace_sec.phase9_q08_cursor_encrypt(
  jsonb_set(
    marketplace_sec.phase9_q08_cursor_decrypt(:'fresh_next_cursor'),
    '{pageSize}','"not-an-integer"'::jsonb
  )
) AS cursor \gset malformed_
SELECT set_config('u8b.malformed_cursor', :'malformed_cursor', false);
SET ROLE authenticated;
DO $$
DECLARE v_message text;
BEGIN
  BEGIN
    PERFORM public.phase9_bookstore_search_v1(
      'U8B Real PostgreSQL',1,current_setting('u8b.malformed_cursor'),'{}'::jsonb,NULL
    );
    RAISE EXCEPTION 'U8B_ACCEPTANCE:malformed cursor was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'P9_CURSOR_INVALID' THEN
      RAISE EXCEPTION 'U8B_ACCEPTANCE:unexpected malformed cursor error:%',v_message;
    END IF;
  END;
END$$;

-- Remove provider provenance; the approved representative media must win.
RESET ROLE;
UPDATE public.store_inventory
SET cover_url=NULL
WHERE id='a1000000-0000-4000-8000-000000000012';
UPDATE public.marketplace_book_listings
SET public_cover_url='https://cdn.example.com/actual-copy.jpg'
WHERE id='a1000000-0000-4000-8000-000000000111';
SET ROLE authenticated;
SELECT public.phase9_bookstore_search_v1(
  'U8B Real PostgreSQL',1,NULL,'{}'::jsonb,NULL
) AS result \gset fallback_
SELECT pg_temp.assert_true(:'fallback_result'::jsonb->'items'->0->'matchedBook'->>'cover'='/storage/v1/object/public/inventory-photos/a1000000-0000-4000-8000-000000000002/approved-copy.webp',
  'approved representative actual-copy cover was not selected');

RESET ROLE;
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','marketplace_sec.phase9_q07_match_class(text,public.marketplace_book_listings)','EXECUTE'),
  'anon can execute Q07 internals');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','marketplace_sec.phase9_q07_match_class(text,public.marketplace_book_listings)','EXECUTE'),
  'authenticated can execute Q07 internals');
SELECT pg_temp.assert_true(has_function_privilege('anon','public.phase9_bookstore_search_v1(text,integer,text,jsonb,jsonb)','EXECUTE'),
  'anon cannot execute the public Q08 RPC');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.phase9_bookstore_search_v1(text,integer,text,jsonb,jsonb)','EXECUTE'),
  'authenticated cannot execute the public Q08 RPC');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','marketplace_sec.phase9_q08_actual_copy_cover(uuid)','EXECUTE'),
  'authenticated can execute the internal cover helper');
SELECT pg_temp.assert_true((SELECT r.rolname='postgres'
  FROM pg_roles r JOIN pg_proc p ON p.proowner=r.oid
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='phase9_bookstore_search_v1'),
  'Q08 owner is not postgres');
SELECT pg_temp.assert_true((SELECT array_to_string(p.proconfig,',') LIKE '%search_path=%'
  AND array_to_string(p.proconfig,',') NOT LIKE '%public%'
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='phase9_bookstore_search_v1'),
  'Q08 does not pin an empty search_path');
SELECT pg_temp.assert_true(EXISTS(
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='extensions' AND p.proname='pgp_sym_encrypt'
), 'pgcrypto is not installed in extensions');
SELECT pg_temp.assert_true(length(marketplace_sec.phase9_q08_current_policy_version())=64,
  'publication policy fingerprint is not a SHA-256 hex value');

SELECT 'U8B_REAL_POSTGRES_ACCEPTANCE_PASS';
