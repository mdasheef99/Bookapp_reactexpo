\set ON_ERROR_STOP on

CREATE FUNCTION pg_temp.u8c_assert(p_ok boolean,p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(p_ok,false) THEN
    RAISE EXCEPTION 'U8C_ACCEPTANCE:%',p_message;
  END IF;
END$$;

RESET ROLE;
INSERT INTO public.store_inventory(
  id,store_id,title,authors,language,condition,selling_price_minor,
  quantity_total,quantity_available,visibility_status,publication_status,
  publication_intent_version,version,is_sellable,has_damage,damage_types,
  damage_notes,listing_quality_status,entry_method,created_by
) VALUES
  ('a1000000-0000-4000-8000-000000000013','a1000000-0000-4000-8000-000000000002',
   'U8C Alpha',ARRAY['U8C Author'],'en','good',600,2,2,'draft','private',1,1,
   true,false,'{}',NULL,'ready','manual','a1000000-0000-4000-8000-000000000004'),
  ('a1000000-0000-4000-8000-000000000014','a1000000-0000-4000-8000-000000000002',
   'U8C Omega',ARRAY['U8C Author'],'en','good',700,2,2,'draft','private',1,1,
   true,false,'{}',NULL,'ready','manual','a1000000-0000-4000-8000-000000000004');
INSERT INTO public.marketplace_book_listings(
  id,inventory_id,store_id,public_title,public_authors,condition,
  selling_price_minor,availability_status,status,moderation_status,
  listing_quality_status,fulfillment_options,pickup_available,delivery_available,
  language,has_damage,damage_types,public_media_count,last_inventory_verified_bucket,
  search_document,updated_at
) VALUES
  ('a1000000-0000-4000-8000-000000000113','a1000000-0000-4000-8000-000000000013',
   'a1000000-0000-4000-8000-000000000002','U8C Alpha',ARRAY['U8C Author'],'good',600,
   'available','active','approved','ready',ARRAY['pickup'],true,false,'en',false,'{}',0,
   'recent',to_tsvector('simple','U8C Alpha U8C Author'),transaction_timestamp()),
  ('a1000000-0000-4000-8000-000000000114','a1000000-0000-4000-8000-000000000014',
   'a1000000-0000-4000-8000-000000000002','U8C Omega',ARRAY['U8C Author'],'good',700,
   'available','active','approved','ready',ARRAY['pickup'],true,false,'en',false,'{}',0,
   'recent',to_tsvector('simple','U8C Omega U8C Author'),transaction_timestamp());
UPDATE public.store_inventory SET visibility_status='published',publication_status='published'
WHERE id IN ('a1000000-0000-4000-8000-000000000013',
  'a1000000-0000-4000-8000-000000000014');

SELECT set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;
SELECT public.phase9_bookstore_search_v1(
  'U8B Real PostgreSQL',20,NULL,'{}'::jsonb,NULL
) AS result \gset q08_
SELECT :'q08_result'::jsonb->'items'->0->'matchedBook'->>'matchContext'
  AS match_context \gset match_
SELECT pg_temp.u8c_assert(:'match_match_context' IS NOT NULL,
  'Q08 did not issue matchContext');
SELECT public.phase9_storefront_catalogue_v1(
  'a1000000-0000-4000-8000-000000000002',1,NULL,:'match_match_context'
) AS result \gset first_
SELECT pg_temp.u8c_assert((:'first_result'::jsonb->>'titleCount')::integer=3,
  'Q09 titleCount is not grouped title cardinality');
SELECT pg_temp.u8c_assert(jsonb_array_length(
  :'first_result'::jsonb->'highlightedTitleGroup'->'offers')=2,
  'Q09 did not group both matched physical offers');
SELECT pg_temp.u8c_assert(jsonb_array_length(
  :'first_result'::jsonb->'titleGroups')=1,
  'highlight consumed an ordinary page slot');
SELECT :'first_result'::jsonb->'pageInfo'->>'nextCursor' AS cursor \gset next_
SELECT pg_temp.u8c_assert(:'next_cursor' IS NOT NULL,'Q09 did not paginate groups');
SELECT public.phase9_storefront_catalogue_v1(
  'a1000000-0000-4000-8000-000000000002',1,:'next_cursor',:'match_match_context'
) AS result \gset second_
SELECT pg_temp.u8c_assert(:'second_result'::jsonb->'highlightedTitleGroup'='null'::jsonb,
  'highlight repeated on page two');
SELECT public.phase9_storefront_catalogue_v1(
  'a1000000-0000-4000-8000-000000000002',20,NULL,NULL
) AS result \gset clear_
SELECT pg_temp.u8c_assert(jsonb_array_length(:'clear_result'::jsonb->'titleGroups')=3,
  'Clear Search did not restore complete ordinary catalogue');

RESET ROLE;
INSERT INTO public.media_assets(
  id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
  sha256,detected_mime,bytes,width,height,retention_class,lifecycle_status
) VALUES
  ('a1000000-0000-4000-8000-000000000214','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','public_copy','private_scan','marketplace-media-staging','a1000000-0000-4000-8000-000000000002/private-2.jpg',repeat('c',64),'image/jpeg',128,1,1,'phase9-public-copy-source','staged'),
  ('a1000000-0000-4000-8000-000000000216','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','public_copy','private_scan','marketplace-media-staging','a1000000-0000-4000-8000-000000000002/private-3.jpg',repeat('d',64),'image/jpeg',128,1,1,'phase9-public-copy-source','staged'),
  ('a1000000-0000-4000-8000-000000000218','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','public_copy','private_scan','marketplace-media-staging','a1000000-0000-4000-8000-000000000002/private-pending.jpg',repeat('e',64),'image/jpeg',128,1,1,'phase9-public-copy-source','staged');
INSERT INTO public.media_assets(
  id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
  sha256,detected_mime,bytes,width,height,validation_version,validated_at,
  reencode_version,exif_strip_version,source_media_asset_id,retention_class,
  lifecycle_status
) VALUES
  ('a1000000-0000-4000-8000-000000000215','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','public_copy','public','inventory-photos','a1000000-0000-4000-8000-000000000002/approved-copy-2.webp',repeat('f',64),'image/webp',256,1,1,'phase9-media-v1',transaction_timestamp(),'phase9-reencode-v1','phase9-exif-v1','a1000000-0000-4000-8000-000000000214','phase9-public-copy','approved'),
  ('a1000000-0000-4000-8000-000000000217','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','public_copy','public','inventory-photos','a1000000-0000-4000-8000-000000000002/approved-copy-3.webp',repeat('1',64),'image/webp',256,1,1,'phase9-media-v1',transaction_timestamp(),'phase9-reencode-v1','phase9-exif-v1','a1000000-0000-4000-8000-000000000216','phase9-public-copy','approved'),
  ('a1000000-0000-4000-8000-000000000219','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','public_copy','public','inventory-photos','a1000000-0000-4000-8000-000000000002/unapproved-copy.webp',repeat('2',64),'image/webp',256,1,1,'phase9-media-v1',transaction_timestamp(),'phase9-reencode-v1','phase9-exif-v1','a1000000-0000-4000-8000-000000000218','phase9-public-copy','approved');
INSERT INTO public.inventory_media_links(
  id,store_id,inventory_id,media_asset_id,role,public_order,
  approval_status,approved_by,approved_at
) VALUES
  ('a1000000-0000-4000-8000-000000000215','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000215','actual_copy',2,'approved','a1000000-0000-4000-8000-000000000004',transaction_timestamp()),
  ('a1000000-0000-4000-8000-000000000217','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000217','actual_copy',3,'approved','a1000000-0000-4000-8000-000000000004',transaction_timestamp()),
  ('a1000000-0000-4000-8000-000000000219','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000219','actual_copy',NULL,'pending',NULL,NULL);
UPDATE public.marketplace_book_listings SET public_media_count=3
WHERE id='a1000000-0000-4000-8000-000000000111';

DO $$
BEGIN
  BEGIN
    UPDATE public.inventory_media_links SET approval_status='approved',
      approved_by='a1000000-0000-4000-8000-000000000004',approved_at=transaction_timestamp()
    WHERE id='a1000000-0000-4000-8000-000000000219';
    RAISE EXCEPTION 'NULL_ORDER_WAS_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'P9_PUBLIC_MEDIA_ORDER_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.inventory_media_links SET public_order=1,approval_status='approved',
      approved_by='a1000000-0000-4000-8000-000000000004',approved_at=transaction_timestamp()
    WHERE id='a1000000-0000-4000-8000-000000000219';
    RAISE EXCEPTION 'DUPLICATE_ORDER_WAS_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.inventory_media_links SET public_order=4,approval_status='approved',
      approved_by='a1000000-0000-4000-8000-000000000004',approved_at=transaction_timestamp()
    WHERE id='a1000000-0000-4000-8000-000000000219';
    RAISE EXCEPTION 'ORDER_FOUR_WAS_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'P9_PUBLIC_MEDIA_ORDER_REQUIRED' THEN RAISE; END IF;
  END;
END$$;

SET ROLE authenticated;
SELECT public.phase9_public_listing_detail_v3(
  'a1000000-0000-4000-8000-000000000111'
) AS result \gset detail_
SELECT pg_temp.u8c_assert(:'detail_result'::jsonb->>'listingId'=
  'a1000000-0000-4000-8000-000000000111','Q10 listing identity mismatch');
SELECT pg_temp.u8c_assert(jsonb_array_length(:'detail_result'::jsonb->'gallery')=3,
  'Q10 did not return the bounded approved gallery');
SELECT pg_temp.u8c_assert(:'detail_result'::jsonb->'gallery'->0->>'order'='1'
  AND :'detail_result'::jsonb->'gallery'->1->>'order'='2'
  AND :'detail_result'::jsonb->'gallery'->2->>'order'='3',
  'Q10 gallery order is not 1,2,3');
SELECT pg_temp.u8c_assert(position('unapproved-copy.webp' in :'detail_result')=0
  AND position('private-pending.jpg' in :'detail_result')=0,
  'Q10 exposed unapproved or private staging media');
SELECT pg_temp.u8c_assert(position('inventoryId' in :'detail_result')=0
  AND position('objectPath' in :'detail_result')=0,'Q10 leaked a private field');

RESET ROLE;
UPDATE public.store_inventory SET quantity_available=0,quantity_total=0
WHERE id='a1000000-0000-4000-8000-000000000011';
SET ROLE authenticated;
SELECT pg_temp.u8c_assert(public.phase9_public_listing_detail_v3(
  'a1000000-0000-4000-8000-000000000111') IS NULL,
  'zero-stock Q10 remained addressable');

RESET ROLE;
SELECT pg_temp.u8c_assert(has_function_privilege('anon',
  'public.phase9_storefront_catalogue_v1(uuid,integer,text,text)','EXECUTE'),
  'anon lacks Q09 execution');
SELECT pg_temp.u8c_assert(has_function_privilege('authenticated',
  'public.phase9_public_listing_detail_v3(uuid)','EXECUTE'),
  'authenticated lacks Q10 execution');
SELECT pg_temp.u8c_assert(NOT has_function_privilege('authenticated',
  'marketplace_sec.phase9_q09_issue_match_context(uuid,text)','EXECUTE'),
  'customer can execute match-context helper');
SELECT 'U8C_REAL_POSTGRES_ACCEPTANCE_PASS';
