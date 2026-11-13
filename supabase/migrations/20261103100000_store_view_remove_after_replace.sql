-- Store View remove-after-replace correction, written against the live
-- definitions supplied by the Owner, using the Slice 0b reader as its source.
-- Apply only after the Owner's separate approval. No data backfill.
-- Four functions' worth of changes: drop the target-link FK, replace the
-- owner reader (pending-replace target-existence guard), replace the submit
-- guard (reject replace capabilities on the add path), restore ownership.

BEGIN;

-- The ALTER TABLE below needs an exclusive lock; fail fast instead of
-- queueing behind a long transaction (re-run if it times out).
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.phase9_upload_capabilities
  DROP CONSTRAINT IF EXISTS phase9_upload_capabilities_target_media_link_id_fkey;

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
    AND (c.operation_kind IS DISTINCT FROM 'replace' OR EXISTS(
      SELECT 1 FROM public.inventory_media_links t
      WHERE t.id=c.target_media_link_id AND t.inventory_id=p_inventory.id))
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

ALTER FUNCTION marketplace_sec.phase9_owner_media_records_v1(
  public.store_inventory) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.phase9_submit_public_copy_media_v2(p_inventory_id uuid,p_capability_id uuid,p_media_asset_id uuid,p_role text,p_public_order integer,p_idempotency_key text,p_command_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_inventory public.store_inventory; v_cap public.phase9_upload_capabilities;
  v_asset public.media_assets; v_source public.media_assets; v_link uuid; v_replay jsonb;
BEGIN
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=p_inventory_id;
  IF v_inventory.id IS NULL OR NOT marketplace_sec.phase9_is_store_owner(v_inventory.store_id)
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7BC21',p_idempotency_key,
    concat_ws('|',p_command_id,p_inventory_id,p_capability_id,p_media_asset_id,p_role,p_public_order));
  IF v_replay IS NOT NULL THEN RETURN (v_replay->>'mediaLinkId')::uuid; END IF;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=p_capability_id FOR UPDATE;
  SELECT * INTO v_asset FROM public.media_assets WHERE id=p_media_asset_id;
  SELECT * INTO v_source FROM public.media_assets WHERE id=v_asset.source_media_asset_id;
  IF v_cap.id IS NULL OR v_cap.status<>'consumed'
    OR v_cap.bound_entity_id<>p_inventory_id OR v_cap.store_id<>v_inventory.store_id
    OR v_cap.issued_to_user_id<>auth.uid() OR v_cap.bound_ordinal<>p_public_order
    OR p_role<>v_cap.public_copy_role
    OR v_cap.consumed_media_asset_id<>v_source.id
    OR v_source.bucket_id<>v_cap.bucket_id OR v_source.object_path<>v_cap.object_path
    OR v_source.sha256<>v_cap.source_sha256 OR v_asset.store_id<>v_inventory.store_id
    OR v_cap.operation_kind='replace'
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  INSERT INTO public.inventory_media_links(store_id,inventory_id,media_asset_id,role,
    public_order,approval_status,approved_by,approved_at)
  VALUES(v_inventory.store_id,p_inventory_id,p_media_asset_id,p_role,p_public_order,
    'approved',auth.uid(),transaction_timestamp()) RETURNING id INTO v_link;
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7BC21',p_idempotency_key,
    jsonb_build_object('mediaLinkId',v_link),'public_media_linked'); RETURN v_link;
END$function$;

ALTER FUNCTION public.phase9_submit_public_copy_media_v2(uuid,uuid,uuid,text,integer,text,uuid) OWNER TO postgres;

COMMIT;
