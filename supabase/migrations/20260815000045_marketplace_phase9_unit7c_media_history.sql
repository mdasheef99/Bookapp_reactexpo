-- Phase 9 Unit 7C WU4: owner media management and read-only activity/history.
-- Source: Unit 7C SDD §§2, 5, 8, 11, 13-15.
-- Forward-only candidate after M44. M39-M44 remain immutable.
-- Reuses the Unit 7B upload/validation/submit pipeline unchanged; adds the
-- controlled owner-safe media read, reorder, remove, and atomic approved-link
-- replacement commands plus the bounded owner activity/public-revision read.

BEGIN;

-- Bind the Store View operation before upload starts. Existing Unit 7B
-- capabilities retain the bounded ADD default; only the new Store View
-- authorization surface writes a replacement target.
ALTER TABLE public.phase9_upload_capabilities
  ADD COLUMN operation_kind text NOT NULL DEFAULT 'add',
  ADD COLUMN target_media_link_id uuid REFERENCES public.inventory_media_links(id),
  ADD CONSTRAINT phase9_upload_capability_operation_kind_check
    CHECK (operation_kind IN ('add','replace')),
  ADD CONSTRAINT phase9_upload_capability_operation_target_check
    CHECK ((operation_kind='add' AND target_media_link_id IS NULL)
      OR (operation_kind='replace' AND target_media_link_id IS NOT NULL));

-- M45 forward successor of the M43 sync projection: primary selection becomes
-- deterministic by public_order so reorder/replace semantics are well-defined
-- and the selected primary id and cover path always agree. All other M43
-- zero-stock/listing behavior is preserved verbatim.
CREATE OR REPLACE FUNCTION public.sync_marketplace_listing_from_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store public.stores; v_locality text; v_media_count integer;
  v_primary uuid; v_primary_path text; v_cover text; v_availability text;
  v_status text; v_reason text;
BEGIN
  SELECT * INTO v_store FROM public.stores WHERE id=NEW.store_id;
  SELECT name INTO v_locality FROM public.marketplace_localities WHERE id=v_store.locality_id;
  IF NEW.visibility_status='paused' THEN
    UPDATE public.marketplace_book_listings SET status='paused',
      availability_status='unavailable',updated_at=transaction_timestamp()
      WHERE inventory_id=NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.visibility_status<>'published'
    OR NEW.publication_status NOT IN ('publication_pending','published') THEN
    IF EXISTS(SELECT 1 FROM public.store_order_request_items ri
      JOIN public.marketplace_book_listings l ON l.id=ri.listing_id
      WHERE l.inventory_id=NEW.id) THEN
      UPDATE public.marketplace_book_listings SET status='paused',
        availability_status='unavailable',updated_at=transaction_timestamp()
        WHERE inventory_id=NEW.id;
    ELSE DELETE FROM public.marketplace_book_listings WHERE inventory_id=NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  v_reason:=marketplace_sec.phase9_publication_ineligibility(NEW);
  IF v_reason IS NOT NULL AND v_reason<>'stock' THEN
    RAISE EXCEPTION 'P9_PUBLICATION_INELIGIBLE';
  END IF;
  SELECT count(*),
    (array_agg(a.id ORDER BY l.public_order,l.created_at)
      FILTER (WHERE l.role='primary_fallback'))[1],
    (array_agg(a.object_path ORDER BY l.public_order,l.created_at)
      FILTER (WHERE l.role='primary_fallback'))[1]
  INTO v_media_count,v_primary,v_primary_path
  FROM public.inventory_media_links l JOIN public.media_assets a ON a.id=l.media_asset_id
  WHERE l.inventory_id=NEW.id AND marketplace_sec.phase9_public_media_eligible(l,a);
  v_cover:=coalesce(NEW.cover_url,
    CASE WHEN v_primary_path IS NULL THEN NULL ELSE
      '/storage/v1/object/public/inventory-photos/'||v_primary_path END);
  v_availability:=CASE WHEN NEW.quantity_available=1 THEN 'low_stock'
    WHEN NEW.quantity_available>1 THEN 'available' ELSE 'unavailable' END;
  v_status:=CASE WHEN NEW.quantity_available=0 THEN 'out_of_stock' ELSE 'active' END;

  INSERT INTO public.marketplace_book_listings(
    inventory_id,store_id,canonical_work_id,canonical_edition_id,public_title,
    public_authors,public_cover_url,isbn_10,isbn_13,condition,
    public_condition_notes,selling_price_minor,availability_status,
    fulfillment_options,status,listing_quality_status,
    store_city,store_locality_id,store_locality_name,pickup_available,
    delivery_available,language,public_description,edition_statement,volume,
    format,has_damage,public_damage_notes,damage_types,primary_public_media_id,
    public_media_count,last_inventory_verified_bucket,search_document,updated_at
  ) VALUES(
    NEW.id,NEW.store_id,NEW.canonical_work_id,NEW.canonical_edition_id,NEW.title,
    NEW.authors,v_cover,NEW.isbn_10,NEW.isbn_13,
    NEW.condition,coalesce(NEW.public_notes,NEW.condition_notes),NEW.selling_price_minor,
    v_availability,array_remove(ARRAY[
      CASE WHEN v_store.pickup_enabled THEN 'pickup' END,
      CASE WHEN v_store.delivery_enabled THEN 'delivery' END],NULL),
    v_status,NEW.listing_quality_status,v_store.city,v_store.locality_id,
    v_locality,v_store.pickup_enabled,v_store.delivery_enabled,NEW.language,
    NEW.description,NEW.edition_statement,NEW.volume,NEW.format,NEW.has_damage,
    NEW.damage_notes,NEW.damage_types,v_primary,least(v_media_count,3),
    CASE WHEN NEW.last_verified_at IS NULL THEN 'not_recently_verified'
      WHEN NEW.last_verified_at>transaction_timestamp()-interval '7 days' THEN 'recent'
      ELSE 'needs_confirmation' END,
    to_tsvector('simple',coalesce(NEW.title,'')||' '||array_to_string(NEW.authors,' ')),
    transaction_timestamp()
  ) ON CONFLICT(inventory_id) DO UPDATE SET
    canonical_work_id=excluded.canonical_work_id,
    canonical_edition_id=excluded.canonical_edition_id,
    public_title=excluded.public_title,public_authors=excluded.public_authors,
    public_cover_url=excluded.public_cover_url,
    isbn_10=excluded.isbn_10,isbn_13=excluded.isbn_13,condition=excluded.condition,
    public_condition_notes=excluded.public_condition_notes,
    selling_price_minor=excluded.selling_price_minor,
    availability_status=excluded.availability_status,
    fulfillment_options=excluded.fulfillment_options,status=excluded.status,
    listing_quality_status=excluded.listing_quality_status,
    store_city=excluded.store_city,store_locality_id=excluded.store_locality_id,
    store_locality_name=excluded.store_locality_name,
    pickup_available=excluded.pickup_available,delivery_available=excluded.delivery_available,
    language=excluded.language,public_description=excluded.public_description,
    edition_statement=excluded.edition_statement,volume=excluded.volume,format=excluded.format,
    has_damage=excluded.has_damage,public_damage_notes=excluded.public_damage_notes,
    damage_types=excluded.damage_types,primary_public_media_id=excluded.primary_public_media_id,
    public_media_count=excluded.public_media_count,
    last_inventory_verified_bucket=excluded.last_inventory_verified_bucket,
    search_document=excluded.search_document,updated_at=transaction_timestamp();
  RETURN NEW;
END$$;

-- M45 forward successor of the M40 media-change refresh. Behavior is identical
-- to M40 except for two bounded forward corrections required by Unit 7C:
-- (1) a live zero-stock row is a valid M43 out-of-stock state, so the
-- 'stock' ineligibility reason no longer blocks media-change projection
-- refresh (matching the M43 listing sync); (2) inside a transaction that set
-- the controlled phase9.media_atomic_swap flag (only the Unit 7C replace
-- command does this), the block evaluation is skipped and the ordinary
-- projection refresh path re-derives the listing from the committed atomic
-- swap state.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_refresh_listing_for_media_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_change record; v_inventory public.store_inventory; v_was_primary boolean;
  v_atomic boolean; v_reason text;
BEGIN
  v_atomic:=coalesce(nullif(current_setting('phase9.media_atomic_swap',true),''),'off')='on';
  FOR v_change IN
    SELECT DISTINCT inventory_id,media_asset_id FROM (
      SELECT OLD.inventory_id,OLD.media_asset_id WHERE TG_OP IN ('UPDATE','DELETE')
      UNION ALL
      SELECT NEW.inventory_id,NEW.media_asset_id WHERE TG_OP IN ('INSERT','UPDATE')
    ) changed
  LOOP
    SELECT * INTO v_inventory FROM public.store_inventory
      WHERE id=v_change.inventory_id FOR UPDATE;
    CONTINUE WHEN v_inventory.id IS NULL;
    IF v_atomic THEN
      UPDATE public.store_inventory SET cover_url=cover_url WHERE id=v_change.inventory_id;
      CONTINUE;
    END IF;
    SELECT EXISTS(SELECT 1 FROM public.marketplace_book_listings l
      WHERE l.inventory_id=v_change.inventory_id
        AND l.primary_public_media_id=v_change.media_asset_id) INTO v_was_primary;
    v_reason:=marketplace_sec.phase9_publication_ineligibility(v_inventory);
    IF v_inventory.visibility_status='published'
      AND ((v_reason IS NOT NULL AND v_reason<>'stock')
        OR (v_was_primary AND NOT EXISTS(
          SELECT 1 FROM public.inventory_media_links link
          JOIN public.media_assets asset ON asset.id=link.media_asset_id
          WHERE link.inventory_id=v_change.inventory_id
            AND link.media_asset_id=v_change.media_asset_id
            AND link.role='primary_fallback'
            AND marketplace_sec.phase9_public_media_eligible(link,asset)))) THEN
      UPDATE public.store_inventory SET visibility_status='blocked',publication_status='private',
        updated_at=transaction_timestamp() WHERE id=v_change.inventory_id;
    ELSE
      UPDATE public.store_inventory SET cover_url=cover_url WHERE id=v_change.inventory_id;
    END IF;
  END LOOP;
  RETURN coalesce(NEW,OLD);
END$$;

-- Store View upload authorization is the authoritative operation boundary.
-- It preserves the Unit 7B transport/validation pipeline while recording the
-- bounded operation and, for replacement, the exact approved link identity.
CREATE FUNCTION public.phase9_authorize_store_view_media_upload_v1(
  p_inventory_id uuid,p_role text,p_ordinal integer,p_operation_kind text,
  p_target_media_link_id uuid,p_declared_mime text,p_declared_bytes bigint,
  p_envelope_sha256 text,p_expires_at timestamptz,p_idempotency_key text,
  p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.store_inventory; v_target public.inventory_media_links;
  v_id uuid; v_path text; v_replay jsonb; v_result jsonb; v_fingerprint text;
BEGIN
  SELECT * INTO v FROM public.store_inventory
    WHERE id=p_inventory_id FOR UPDATE;
  IF v.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF p_command_id IS NULL OR p_operation_kind IS NULL
    OR p_operation_kind NOT IN ('add','replace')
    OR (p_operation_kind='add' AND p_target_media_link_id IS NOT NULL)
    OR (p_operation_kind='replace' AND p_target_media_link_id IS NULL)
    OR p_role NOT IN ('damage','actual_copy','primary_fallback')
    OR p_ordinal NOT BETWEEN 1 AND 3
    OR p_declared_mime NOT IN ('image/jpeg','image/png','image/webp')
    OR p_declared_bytes NOT BETWEEN 1 AND 10485760
    OR p_envelope_sha256!~'^[a-f0-9]{64}$'
    OR p_expires_at<=transaction_timestamp()
    OR p_expires_at>transaction_timestamp()+interval '20 minutes'
    OR coalesce(char_length(p_idempotency_key),0) NOT BETWEEN 1 AND 200
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;

  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_command_id,
    p_inventory_id,p_operation_kind,coalesce(p_target_media_link_id::text,''),
    p_role,p_ordinal,p_declared_mime,p_declared_bytes,p_envelope_sha256),
    'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7CC06',
    p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF p_operation_kind='replace' THEN
    SELECT l.* INTO v_target
    FROM public.inventory_media_links l
    JOIN public.media_assets a ON a.id=l.media_asset_id
    WHERE l.id=p_target_media_link_id AND l.inventory_id=p_inventory_id
      AND l.store_id=v.store_id AND l.approval_status='approved'
      AND marketplace_sec.phase9_public_media_eligible(l,a)
    FOR UPDATE OF l;
    IF v_target.id IS NULL OR v_target.role<>p_role
      OR v_target.public_order<>p_ordinal
    THEN RAISE EXCEPTION 'P9_MEDIA_LINK_NOT_FOUND'; END IF;
  END IF;

  v_path:=v.store_id::text||'/public_copy/'||v.id::text||'/'||gen_random_uuid()::text;
  INSERT INTO public.phase9_upload_capabilities(
    store_id,issued_to_user_id,initiating_owner_user_id,purpose,
    bound_entity_type,bound_entity_id,bound_ordinal,bucket_id,object_path,
    envelope_sha256,nonce_hash,expires_at,declared_mime,declared_bytes,
    public_copy_role,operation_kind,target_media_link_id
  ) VALUES(
    v.store_id,auth.uid(),auth.uid(),'public_copy','inventory',v.id,p_ordinal,
    'marketplace-media-staging',v_path,p_envelope_sha256,
    encode(extensions.digest(concat_ws('|',p_idempotency_key,p_command_id),
      'sha256'),'hex'),p_expires_at,p_declared_mime,p_declared_bytes,p_role,
    p_operation_kind,p_target_media_link_id
  ) RETURNING id INTO v_id;
  v_result:=jsonb_build_object('capabilityId',v_id,
    'bucket','marketplace-media-staging','path',v_path,'expiresAt',p_expires_at);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7CC06',
    p_idempotency_key,v_result,'store_view_media_capability_issued');
  RETURN v_result;
END$$;

-- Owner-safe media records: approved public links plus bounded in-flight
-- replacement evidence. Never returns staging paths, upload secrets, scan or
-- request media.
CREATE FUNCTION marketplace_sec.phase9_owner_media_records_v1(
  p_inventory public.store_inventory
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_media jsonb; v_pending jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'linkId',l.id,'mediaAssetId',a.id,'role',l.role,'publicOrder',l.public_order,
      'approvalStatus',l.approval_status,'approvedAt',l.approved_at,
      'url','/storage/v1/object/public/inventory-photos/'||a.object_path,
      'width',a.width,'height',a.height) ORDER BY l.public_order),'[]'::jsonb)
  INTO v_media
  FROM public.inventory_media_links l
  JOIN public.media_assets a ON a.id=l.media_asset_id
  WHERE l.inventory_id=p_inventory.id AND l.approval_status='approved'
    AND marketplace_sec.phase9_public_media_eligible(l,a);
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'capabilityId',c.id,'role',c.public_copy_role,'order',c.bound_ordinal,
      'operationKind',coalesce(c.operation_kind,'add'),
      'targetLinkId',CASE WHEN c.operation_kind='replace'
        THEN c.target_media_link_id ELSE NULL END,
      'state',CASE WHEN c.consumed_media_asset_id IS NULL THEN 'upload_pending'
        WHEN d.id IS NOT NULL THEN 'approved'
        WHEN s.lifecycle_status='failed' THEN 'failed' ELSE 'processing' END,
      'sourceMediaAssetId',c.consumed_media_asset_id,'mediaAssetId',d.id,
      'safeErrorCode',CASE WHEN d.id IS NULL AND s.lifecycle_status='failed'
        THEN (SELECT j.last_safe_error_code FROM public.image_extraction_jobs j
              WHERE j.entity_type='media_asset' AND j.entity_id=s.id
                AND j.job_kind='media_validate_sanitize'
              ORDER BY j.updated_at DESC LIMIT 1) END)
    ORDER BY c.created_at,c.id),'[]'::jsonb)
  INTO v_pending
  FROM public.phase9_upload_capabilities c
  LEFT JOIN public.media_assets s ON s.id=c.consumed_media_asset_id
  LEFT JOIN LATERAL (
    SELECT d.id FROM public.media_assets d
    WHERE d.source_media_asset_id=s.id AND d.purpose='public_copy'
      AND d.bucket_id='inventory-photos' AND d.lifecycle_status IN ('approved','linked')
    ORDER BY d.created_at DESC LIMIT 1
  ) d ON true
  WHERE c.purpose='public_copy' AND c.bound_entity_type='inventory'
    AND c.bound_entity_id=p_inventory.id AND c.store_id=p_inventory.store_id
    AND (c.status='consumed' OR (c.status='issued' AND c.expires_at>transaction_timestamp()))
    AND NOT EXISTS(SELECT 1 FROM public.inventory_media_links l
      WHERE l.media_asset_id=d.id);
  RETURN jsonb_build_object('media',v_media,'pendingReplacements',v_pending);
END$$;

CREATE FUNCTION public.phase9_store_view_media_v1(p_inventory_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory; v_records jsonb;
BEGIN
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_records:=marketplace_sec.phase9_owner_media_records_v1(v_inventory);
  RETURN jsonb_build_object('inventoryId',v_inventory.id,
    'media',v_records->'media','pendingReplacements',v_records->'pendingReplacements');
END$$;

CREATE FUNCTION public.phase9_reorder_store_view_media_v1(
  p_inventory_id uuid,p_expected_inventory_version integer,p_ordered_link_ids uuid[],
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory; v_store uuid; v_replay jsonb;
  v_fingerprint text; v_current uuid[]; v_result jsonb; v_revision integer; v_pos integer;
BEGIN
  IF p_command_id IS NULL OR coalesce(char_length(p_idempotency_key),0) NOT BETWEEN 1 AND 200
    OR p_ordered_link_ids IS NULL
    OR coalesce(array_length(p_ordered_link_ids,1),0) NOT BETWEEN 1 AND 3
    OR EXISTS(SELECT 1 FROM unnest(p_ordered_link_ids) WITH ORDINALITY x(id,pos)
      JOIN unnest(p_ordered_link_ids) WITH ORDINALITY y(id,pos) ON x.id=y.id AND x.pos<>y.pos)
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  SELECT store_id INTO v_store FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_store IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_store) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',auth.uid(),p_command_id,
    p_inventory_id,p_expected_inventory_version,array_to_string(p_ordered_link_ids,',')),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7CC03',p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_inventory FROM public.store_inventory
    WHERE id=p_inventory_id FOR UPDATE;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF v_inventory.version<>p_expected_inventory_version THEN
    RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  SELECT coalesce(array_agg(l.id ORDER BY l.id),'{}'::uuid[]) INTO v_current
    FROM public.inventory_media_links l
    JOIN public.media_assets a ON a.id=l.media_asset_id
    WHERE l.inventory_id=p_inventory_id AND l.approval_status='approved'
      AND marketplace_sec.phase9_public_media_eligible(l,a);
  IF v_current=(SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[])
      FROM unnest(p_ordered_link_ids) AS ids(id)) THEN
    IF (SELECT coalesce(array_agg(l.id ORDER BY l.public_order),'{}'::uuid[])
        FROM public.inventory_media_links l
        JOIN public.media_assets a ON a.id=l.media_asset_id
        WHERE l.inventory_id=p_inventory_id AND l.approval_status='approved'
          AND marketplace_sec.phase9_public_media_eligible(l,a))
       = p_ordered_link_ids THEN
      RAISE EXCEPTION 'P9_NO_CHANGES'; END IF;
  ELSE
    RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;

  UPDATE public.inventory_media_links l SET public_order=NULL
    WHERE l.inventory_id=p_inventory_id AND l.approval_status='approved'
      AND EXISTS(SELECT 1 FROM public.media_assets a
        WHERE a.id=l.media_asset_id
          AND marketplace_sec.phase9_public_media_eligible(l,a));
  FOR v_pos IN 1..array_length(p_ordered_link_ids,1) LOOP
    UPDATE public.inventory_media_links SET public_order=v_pos
      WHERE inventory_id=p_inventory_id AND id=p_ordered_link_ids[v_pos];
  END LOOP;

  UPDATE public.store_inventory SET version=version+1,updated_at=transaction_timestamp()
    WHERE id=p_inventory_id RETURNING * INTO v_inventory;
  v_revision:=marketplace_sec.phase9_append_publication_revision_v1(
    v_inventory,'media_change',p_command_id,false);
  INSERT INTO public.marketplace_audit_logs(
    store_id,action,entity_type,entity_id,actor_user_id,details
  ) VALUES(v_inventory.store_id,'phase9.inventory.media_reordered','store_inventory',
    v_inventory.id,auth.uid(),jsonb_build_object('commandId',p_command_id,
      'inventoryVersion',v_inventory.version,'mediaLinkIds',to_jsonb(p_ordered_link_ids)));
  INSERT INTO public.marketplace_events(
    store_id,event_type,entity_type,entity_id,actor_user_id,source,payload
  ) VALUES(v_inventory.store_id,'inventory.media.reordered','store_inventory',
    v_inventory.id,auth.uid(),'store_owner_app',jsonb_build_object(
      'commandId',p_command_id,'inventoryVersion',v_inventory.version));
  v_result:=jsonb_build_object('inventoryId',v_inventory.id,
    'inventoryVersion',v_inventory.version,
    'publicationIntentVersion',v_inventory.publication_intent_version,
    'mediaLinkIds',to_jsonb(p_ordered_link_ids),
    'publicRevisionNumber',v_revision,'outcome','media_reordered');
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7CC03',
    p_idempotency_key,v_result,'inventory_media_reordered');
  RETURN v_result;
END$$;

CREATE FUNCTION public.phase9_remove_store_view_media_v1(
  p_inventory_id uuid,p_expected_inventory_version integer,p_link_id uuid,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory; v_store uuid; v_replay jsonb;
  v_fingerprint text; v_link public.inventory_media_links; v_result jsonb;
  v_revision integer; v_other boolean;
BEGIN
  IF p_command_id IS NULL OR p_link_id IS NULL
    OR coalesce(char_length(p_idempotency_key),0) NOT BETWEEN 1 AND 200
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  SELECT store_id INTO v_store FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_store IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_store) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',auth.uid(),p_command_id,
    p_inventory_id,p_expected_inventory_version,p_link_id),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7CC04',p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_inventory FROM public.store_inventory
    WHERE id=p_inventory_id FOR UPDATE;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF v_inventory.version<>p_expected_inventory_version THEN
    RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  SELECT * INTO v_link FROM public.inventory_media_links
    WHERE id=p_link_id AND inventory_id=p_inventory_id AND approval_status='approved';
  IF v_link.id IS NULL THEN RAISE EXCEPTION 'P9_MEDIA_LINK_NOT_FOUND'; END IF;
  IF v_inventory.visibility_status='published' THEN
    IF v_link.role='primary_fallback' THEN
      SELECT EXISTS(SELECT 1 FROM public.inventory_media_links l
        JOIN public.media_assets a ON a.id=l.media_asset_id
        WHERE l.inventory_id=p_inventory_id AND l.id<>v_link.id
          AND l.role='primary_fallback' AND l.approval_status='approved'
          AND marketplace_sec.phase9_public_media_eligible(l,a)) INTO v_other;
      IF NOT v_other THEN RAISE EXCEPTION 'P9_MEDIA_CHANGE_UNSAFE'; END IF;
    END IF;
    IF v_inventory.has_damage AND v_link.role='damage' THEN
      SELECT EXISTS(SELECT 1 FROM public.inventory_media_links l
        JOIN public.media_assets a ON a.id=l.media_asset_id
        WHERE l.inventory_id=p_inventory_id AND l.id<>v_link.id
          AND l.role='damage' AND l.approval_status='approved'
          AND marketplace_sec.phase9_public_media_eligible(l,a)) INTO v_other;
      IF NOT v_other THEN RAISE EXCEPTION 'P9_MEDIA_CHANGE_UNSAFE'; END IF;
    END IF;
  END IF;
  DELETE FROM public.inventory_media_links WHERE id=v_link.id;

  UPDATE public.store_inventory SET version=version+1,updated_at=transaction_timestamp()
    WHERE id=p_inventory_id RETURNING * INTO v_inventory;
  v_revision:=marketplace_sec.phase9_append_publication_revision_v1(
    v_inventory,'media_change',p_command_id,false);
  INSERT INTO public.marketplace_audit_logs(
    store_id,action,entity_type,entity_id,actor_user_id,details
  ) VALUES(v_inventory.store_id,'phase9.inventory.media_removed','store_inventory',
    v_inventory.id,auth.uid(),jsonb_build_object('commandId',p_command_id,
      'inventoryVersion',v_inventory.version,'mediaAssetId',v_link.media_asset_id,
      'role',v_link.role));
  INSERT INTO public.marketplace_events(
    store_id,event_type,entity_type,entity_id,actor_user_id,source,payload
  ) VALUES(v_inventory.store_id,'inventory.media.removed','store_inventory',
    v_inventory.id,auth.uid(),'store_owner_app',jsonb_build_object(
      'commandId',p_command_id,'inventoryVersion',v_inventory.version));
  v_result:=jsonb_build_object('inventoryId',v_inventory.id,
    'inventoryVersion',v_inventory.version,
    'publicationIntentVersion',v_inventory.publication_intent_version,
    'removedMediaAssetId',v_link.media_asset_id,
    'publicRevisionNumber',v_revision,'outcome','media_removed');
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7CC04',
    p_idempotency_key,v_result,'inventory_media_removed');
  RETURN v_result;
END$$;

CREATE FUNCTION public.phase9_replace_store_view_media_v1(
  p_inventory_id uuid,p_expected_inventory_version integer,p_capability_id uuid,
  p_media_asset_id uuid,p_target_link_id uuid,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory; v_store uuid; v_replay jsonb;
  v_fingerprint text; v_cap public.phase9_upload_capabilities;
  v_asset public.media_assets; v_source public.media_assets;
  v_link public.inventory_media_links; v_removed uuid; v_result jsonb; v_revision integer;
BEGIN
  IF p_command_id IS NULL OR p_capability_id IS NULL OR p_media_asset_id IS NULL
    OR p_target_link_id IS NULL OR coalesce(char_length(p_idempotency_key),0) NOT BETWEEN 1 AND 200
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  SELECT store_id INTO v_store FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_store IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_store) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',auth.uid(),p_command_id,
    p_inventory_id,p_expected_inventory_version,p_capability_id,p_media_asset_id,
    p_target_link_id),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7CC05',p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_inventory FROM public.store_inventory
    WHERE id=p_inventory_id FOR UPDATE;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF v_inventory.version<>p_expected_inventory_version THEN
    RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  SELECT * INTO v_link FROM public.inventory_media_links
    WHERE id=p_target_link_id AND inventory_id=p_inventory_id AND approval_status='approved';
  IF v_link.id IS NULL THEN RAISE EXCEPTION 'P9_MEDIA_LINK_NOT_FOUND'; END IF;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=p_capability_id FOR UPDATE;
  SELECT * INTO v_asset FROM public.media_assets WHERE id=p_media_asset_id;
  SELECT * INTO v_source FROM public.media_assets WHERE id=v_asset.source_media_asset_id;
  IF v_cap.id IS NULL OR v_cap.status<>'consumed' OR v_cap.bound_entity_id<>p_inventory_id
    OR v_cap.store_id<>v_inventory.store_id OR v_cap.issued_to_user_id<>auth.uid()
    OR v_cap.public_copy_role<>v_link.role
    OR v_cap.operation_kind<>'replace'
    OR v_cap.target_media_link_id IS DISTINCT FROM p_target_link_id
    OR v_cap.consumed_media_asset_id<>v_source.id
    OR v_source.id IS NULL OR v_source.purpose<>'public_copy'
    OR v_source.lifecycle_status NOT IN ('staged','validated')
    OR v_asset.lifecycle_status NOT IN ('approved','linked')
    OR v_asset.bucket_id<>'inventory-photos' OR v_asset.purpose<>'public_copy'
    OR v_source.bucket_id<>v_cap.bucket_id OR v_source.object_path<>v_cap.object_path
    OR v_source.sha256<>v_cap.source_sha256 OR v_asset.store_id<>v_inventory.store_id
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  IF EXISTS(SELECT 1 FROM public.inventory_media_links l WHERE l.media_asset_id=p_media_asset_id)
    THEN RAISE EXCEPTION 'P9_MEDIA_ALREADY_LINKED'; END IF;
  v_removed:=v_link.media_asset_id;
  PERFORM set_config('phase9.media_atomic_swap','on',true);
  UPDATE public.inventory_media_links SET media_asset_id=v_asset.id,
    approved_by=auth.uid(),approved_at=transaction_timestamp()
    WHERE id=v_link.id RETURNING * INTO v_link;
  PERFORM set_config('phase9.media_atomic_swap','off',true);

  UPDATE public.store_inventory SET version=version+1,updated_at=transaction_timestamp()
    WHERE id=p_inventory_id RETURNING * INTO v_inventory;
  v_revision:=marketplace_sec.phase9_append_publication_revision_v1(
    v_inventory,'media_change',p_command_id,false);
  INSERT INTO public.marketplace_audit_logs(
    store_id,action,entity_type,entity_id,actor_user_id,details
  ) VALUES(v_inventory.store_id,'phase9.inventory.media_replaced','store_inventory',
    v_inventory.id,auth.uid(),jsonb_build_object('commandId',p_command_id,
      'inventoryVersion',v_inventory.version,'mediaAssetId',v_asset.id,
      'removedMediaAssetId',v_removed,'role',v_link.role));
  INSERT INTO public.marketplace_events(
    store_id,event_type,entity_type,entity_id,actor_user_id,source,payload
  ) VALUES(v_inventory.store_id,'inventory.media.replaced','store_inventory',
    v_inventory.id,auth.uid(),'store_owner_app',jsonb_build_object(
      'commandId',p_command_id,'inventoryVersion',v_inventory.version));
  v_result:=jsonb_build_object('inventoryId',v_inventory.id,
    'inventoryVersion',v_inventory.version,
    'publicationIntentVersion',v_inventory.publication_intent_version,
    'mediaLinkId',v_link.id,'mediaAssetId',v_asset.id,
    'removedMediaAssetId',v_removed,
    'publicRevisionNumber',v_revision,'outcome','media_replaced');
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7CC05',
    p_idempotency_key,v_result,'inventory_media_replaced');
  RETURN v_result;
END$$;

-- Read-only bounded owner history: activity from authoritative audit/event/job
-- records and the append-only public revision list. No private snapshot fields,
-- no media storage paths, no undo/restore surface.
CREATE FUNCTION public.phase9_store_view_history_v1(p_inventory_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inventory public.store_inventory; v_activity jsonb; v_revisions jsonb;
BEGIN
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  WITH source_entries AS (
    SELECT jsonb_build_object('kind','audit','action',a.action,'createdAt',a.created_at,
        'details',jsonb_strip_nulls(jsonb_build_object(
          'commandId',a.details->'commandId',
          'inventoryVersion',a.details->'inventoryVersion',
          'publicationIntentVersion',a.details->'publicationIntentVersion',
          'outcome',a.details->'outcome',
          'changedFields',a.details->'changedFields',
          'delta',a.details->'delta',
          'mediaLinkIds',a.details->'mediaLinkIds',
          'mediaAssetId',a.details->'mediaAssetId',
          'removedMediaAssetId',a.details->'removedMediaAssetId',
          'role',a.details->'role'))) AS entry,
      a.created_at AS occurred_at,'audit'::text AS entry_kind,a.id::text AS entry_id
    FROM public.marketplace_audit_logs a
    WHERE a.store_id=v_inventory.store_id AND a.entity_type='store_inventory'
      AND a.entity_id=p_inventory_id
    UNION ALL
    SELECT jsonb_build_object('kind','event','eventType',e.event_type,'source',e.source,
        'severity',e.severity,'createdAt',e.created_at,
        'payload',jsonb_strip_nulls(jsonb_build_object(
          'commandId',e.payload->'commandId',
          'inventoryVersion',e.payload->'inventoryVersion',
          'publicationIntentVersion',e.payload->'publicationIntentVersion',
          'outcome',e.payload->'outcome',
          'changedFields',e.payload->'changedFields',
          'delta',e.payload->'delta',
          'mediaLinkIds',e.payload->'mediaLinkIds',
          'mediaAssetId',e.payload->'mediaAssetId',
          'removedMediaAssetId',e.payload->'removedMediaAssetId',
          'role',e.payload->'role'))) AS entry,
      e.created_at AS occurred_at,'event'::text AS entry_kind,e.id::text AS entry_id
    FROM public.marketplace_events e
    WHERE e.store_id=v_inventory.store_id AND e.entity_type='store_inventory'
      AND e.entity_id=p_inventory_id
    UNION ALL
    SELECT jsonb_build_object('kind','publication_retry','status',j.status,
        'attemptCount',j.attempt_count,'maxAttempts',j.max_attempts,
        'safeErrorCode',j.last_safe_error_code,'createdAt',j.created_at,
        'updatedAt',j.updated_at,'completedAt',j.completed_at) AS entry,
      j.created_at AS occurred_at,'publication_retry'::text AS entry_kind,j.id::text AS entry_id
    FROM public.image_extraction_jobs j
    WHERE j.store_id=v_inventory.store_id AND j.entity_type='store_inventory'
      AND j.entity_id=p_inventory_id AND j.job_kind='publication_retry'
  ), bounded_entries AS (
    SELECT entry,occurred_at,entry_kind,entry_id
    FROM source_entries
    ORDER BY occurred_at DESC,entry_kind ASC,entry_id DESC
    LIMIT 50
  )
  SELECT coalesce(jsonb_agg(entry ORDER BY occurred_at DESC,entry_kind ASC,entry_id DESC),
    '[]'::jsonb)
  INTO v_activity
  FROM bounded_entries;
  SELECT coalesce(jsonb_agg(jsonb_build_object('revisionNumber',t.revision_number,
    'sourceAction',t.source_action,'createdAt',t.created_at,'listingId',t.listing_id,
    'publicSnapshot',t.public_snapshot) ORDER BY t.revision_number DESC),'[]'::jsonb)
  INTO v_revisions
  FROM (SELECT * FROM public.phase9_publication_revisions r
        WHERE r.inventory_id=p_inventory_id
        ORDER BY r.revision_number DESC LIMIT 25) t;
  RETURN jsonb_build_object('inventoryId',p_inventory_id,
    'activity',v_activity,'publicRevisions',v_revisions);
END$$;

ALTER FUNCTION public.sync_marketplace_listing_from_inventory() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_refresh_listing_for_media_change() OWNER TO postgres;
ALTER FUNCTION public.phase9_authorize_store_view_media_upload_v1(
  uuid,text,integer,text,uuid,text,bigint,text,timestamptz,text,uuid) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_owner_media_records_v1(
  public.store_inventory) OWNER TO postgres;
ALTER FUNCTION public.phase9_store_view_media_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_reorder_store_view_media_v1(
  uuid,integer,uuid[],text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_remove_store_view_media_v1(
  uuid,integer,uuid,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_replace_store_view_media_v1(
  uuid,integer,uuid,uuid,uuid,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_store_view_history_v1(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.sync_marketplace_listing_from_inventory()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_marketplace_listing_from_inventory()
  TO service_role;

REVOKE ALL ON FUNCTION
  marketplace_sec.phase9_refresh_listing_for_media_change(),
  marketplace_sec.phase9_owner_media_records_v1(public.store_inventory)
  FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION
  public.phase9_authorize_store_view_media_upload_v1(
    uuid,text,integer,text,uuid,text,bigint,text,timestamptz,text,uuid),
  public.phase9_store_view_media_v1(uuid),
  public.phase9_reorder_store_view_media_v1(uuid,integer,uuid[],text,uuid),
  public.phase9_remove_store_view_media_v1(uuid,integer,uuid,text,uuid),
  public.phase9_replace_store_view_media_v1(uuid,integer,uuid,uuid,uuid,text,uuid),
  public.phase9_store_view_history_v1(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
  public.phase9_authorize_store_view_media_upload_v1(
    uuid,text,integer,text,uuid,text,bigint,text,timestamptz,text,uuid),
  public.phase9_store_view_media_v1(uuid),
  public.phase9_reorder_store_view_media_v1(uuid,integer,uuid[],text,uuid),
  public.phase9_remove_store_view_media_v1(uuid,integer,uuid,text,uuid),
  public.phase9_replace_store_view_media_v1(uuid,integer,uuid,uuid,uuid,text,uuid),
  public.phase9_store_view_history_v1(uuid)
  TO authenticated,service_role;

COMMIT;
