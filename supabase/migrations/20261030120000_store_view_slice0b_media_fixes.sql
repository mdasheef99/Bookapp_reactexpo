-- Store View v2 Slice 0b: reorder and pending-list fixes only.
-- Based on the 2026-10-30 live-definition snapshot, not older local headers.
-- File creation/testing only; application requires separate Owner approval.
-- No data backfill or lifecycle/Storage/permission change.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.validate_inventory_media_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_asset public.media_assets; v_inventory public.store_inventory;
BEGIN
  SELECT * INTO v_asset FROM public.media_assets WHERE id=NEW.media_asset_id;
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=NEW.inventory_id;
  IF v_asset.id IS NULL OR v_inventory.id IS NULL
    OR v_asset.store_id<>NEW.store_id OR v_inventory.store_id<>NEW.store_id
    OR v_asset.purpose<>'public_copy' OR v_asset.privacy_class<>'public'
    OR v_asset.bucket_id<>'inventory-photos'
    OR v_asset.lifecycle_status NOT IN ('approved','linked')
    OR v_asset.validation_version IS NULL OR v_asset.reencode_version IS NULL
    OR v_asset.exif_strip_version IS NULL
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  IF NEW.role='primary_fallback' AND NEW.approval_status<>'approved' THEN
    RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED';
  END IF;
  IF marketplace_sec.phase9_public_media_eligible(NEW,v_asset)
    AND (NEW.public_order IS NULL OR NEW.public_order NOT BETWEEN 1 AND 3)
    -- Only NULL is a temporary reorder slot; invalid integer orders still fail.
    AND NOT (NEW.public_order IS NULL
      AND coalesce(current_setting('phase9.media_reorder',true),'off')='on')
  THEN RAISE EXCEPTION 'P9_PUBLIC_MEDIA_ORDER_REQUIRED'; END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.phase9_reorder_store_view_media_v1(p_inventory_id uuid, p_expected_inventory_version integer, p_ordered_link_ids uuid[], p_idempotency_key text, p_command_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_inventory public.store_inventory; v_store uuid; v_replay jsonb;
  v_fingerprint text; v_current uuid[]; v_hidden uuid[]; v_move_hidden uuid[];
  v_result jsonb; v_revision integer; v_pos integer;
BEGIN
  PERFORM set_config('phase9.media_reorder','off',true);
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

  -- Hidden links share the immediate UNIQUE slots. Preserve their relative
  -- order after the eligible 1..n positions, including on later approval.
  SELECT coalesce(array_agg(l.id ORDER BY l.public_order NULLS LAST,l.id),'{}'::uuid[])
    INTO v_hidden FROM public.inventory_media_links l
    WHERE l.inventory_id=p_inventory_id AND NOT (l.id=ANY(v_current));
  IF cardinality(v_current)+cardinality(v_hidden)>3 THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  -- Leave hidden rows already in their final slot untouched: their asset may
  -- since have become held/delete_pending, and the asset guard stays strict.
  SELECT coalesce(array_agg(l.id),'{}'::uuid[]) INTO v_move_hidden
    FROM unnest(v_hidden) WITH ORDINALITY h(id,pos)
    JOIN public.inventory_media_links l ON l.id=h.id
    WHERE l.public_order IS DISTINCT FROM cardinality(v_current)+h.pos;
  IF EXISTS(SELECT 1 FROM public.inventory_media_links l
      JOIN public.media_assets a ON a.id=l.media_asset_id
      WHERE l.id=ANY(v_move_hidden) AND (a.lifecycle_status NOT IN ('approved','linked')
        OR a.validation_version IS NULL OR a.reencode_version IS NULL
        OR a.exif_strip_version IS NULL))
  THEN RAISE EXCEPTION 'P9_MEDIA_CHANGE_UNSAFE'; END IF;
  -- An immovable hidden row in 1..n prevents compact eligible positions.
  -- Stage only eligible rows and hidden rows whose destination changes.
  PERFORM set_config('phase9.media_reorder','on',true);
  UPDATE public.inventory_media_links l SET public_order=NULL
    WHERE l.inventory_id=p_inventory_id
      AND (l.id=ANY(v_current) OR l.id=ANY(v_move_hidden));
  FOR v_pos IN 1..array_length(p_ordered_link_ids,1) LOOP
    UPDATE public.inventory_media_links SET public_order=v_pos
      WHERE inventory_id=p_inventory_id AND id=p_ordered_link_ids[v_pos];
  END LOOP;
  FOR v_pos IN 1..cardinality(v_hidden) LOOP
    UPDATE public.inventory_media_links
      SET public_order=cardinality(v_current)+v_pos
      WHERE inventory_id=p_inventory_id AND id=v_hidden[v_pos]
        AND id=ANY(v_move_hidden);
  END LOOP;
  PERFORM set_config('phase9.media_reorder','off',true);
  IF (SELECT coalesce(array_agg(l.public_order::integer ORDER BY l.public_order),
        '{}'::integer[])
      FROM public.inventory_media_links l
      JOIN public.media_assets a ON a.id=l.media_asset_id
      WHERE l.inventory_id=p_inventory_id AND l.approval_status='approved'
        AND marketplace_sec.phase9_public_media_eligible(l,a))
    IS DISTINCT FROM ARRAY(SELECT generate_series(1,array_length(p_ordered_link_ids,1)))
  THEN RAISE EXCEPTION 'P9_PUBLIC_MEDIA_ORDER_REQUIRED'; END IF;

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
EXCEPTION WHEN OTHERS THEN
  -- The subtransaction restores staged rows/effects before resetting the GUC.
  PERFORM set_config('phase9.media_reorder','off',true);
  RAISE;
END$function$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_media_records_v1(p_inventory store_inventory)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      AND d.store_id=p_inventory.store_id
      AND d.bucket_id='inventory-photos' AND d.lifecycle_status IN ('approved','linked')
      AND d.deleted_at IS NULL AND d.validation_version IS NOT NULL
      AND d.reencode_version IS NOT NULL AND d.exif_strip_version IS NOT NULL
      -- Select from genuinely pending derivatives BEFORE choosing the newest.
      AND NOT EXISTS(SELECT 1 FROM public.inventory_media_links l
        WHERE l.media_asset_id=d.id)
      AND NOT EXISTS(SELECT 1 FROM public.marketplace_audit_logs h
        WHERE h.store_id=p_inventory.store_id AND h.entity_type='store_inventory'
          AND h.entity_id=p_inventory.id
          AND ((h.action='phase9.inventory.media_removed'
                AND h.details->>'mediaAssetId'=d.id::text)
            OR (h.action='phase9.inventory.media_replaced'
                AND h.details->>'removedMediaAssetId'=d.id::text)))
    ORDER BY d.created_at DESC,d.id DESC LIMIT 1
  ) d ON true
  WHERE c.purpose='public_copy' AND c.bound_entity_type='inventory'
    AND c.bound_entity_id=p_inventory.id AND c.store_id=p_inventory.store_id
    AND (c.status='consumed' OR (c.status='issued' AND c.expires_at>transaction_timestamp()))
    -- No approved pending derivative: linked/retired lineage is settled, not
    -- processing. Retirement is independent of the old asset's lifecycle.
    AND (d.id IS NOT NULL OR NOT EXISTS(
      SELECT 1 FROM public.media_assets linked
      JOIN public.inventory_media_links l ON l.media_asset_id=linked.id
      WHERE linked.source_media_asset_id=s.id
        AND linked.store_id=p_inventory.store_id
        AND linked.purpose='public_copy' AND linked.bucket_id='inventory-photos'))
    AND (d.id IS NOT NULL OR NOT EXISTS(
      SELECT 1 FROM public.media_assets retired
      JOIN public.marketplace_audit_logs h
        ON h.store_id=p_inventory.store_id AND h.entity_type='store_inventory'
        AND h.entity_id=p_inventory.id
        AND ((h.action='phase9.inventory.media_removed'
              AND h.details->>'mediaAssetId'=retired.id::text)
          OR (h.action='phase9.inventory.media_replaced'
              AND h.details->>'removedMediaAssetId'=retired.id::text))
      WHERE retired.source_media_asset_id=s.id
        AND retired.store_id=p_inventory.store_id
        AND retired.purpose='public_copy' AND retired.bucket_id='inventory-photos'));
  RETURN jsonb_build_object('media',v_media,'pendingReplacements',v_pending);
END$function$;

ALTER FUNCTION marketplace_sec.validate_inventory_media_link() OWNER TO postgres;
ALTER FUNCTION public.phase9_reorder_store_view_media_v1(
  uuid,integer,uuid[],text,uuid) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_owner_media_records_v1(
  public.store_inventory) OWNER TO postgres;

-- CREATE OR REPLACE preserves the existing M45/M51 ACLs; intentionally no
-- GRANT/REVOKE here, so later live ACL corrections are also preserved.
COMMIT;
