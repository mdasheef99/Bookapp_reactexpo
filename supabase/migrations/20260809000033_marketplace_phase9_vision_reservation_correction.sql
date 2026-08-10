-- Phase 9 M33: atomically bind every sanitized-media vision job to its usage reservation.
BEGIN;

CREATE FUNCTION marketplace_sec.phase9_ensure_vision_usage_reservation(
  p_job_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_job public.image_extraction_jobs;
  v_input public.image_extraction_inputs;
  v_session public.image_extraction_sessions;
  v_media public.media_assets;
  v_reservation public.phase9_usage_reservations;
BEGIN
  IF p_job_id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

  SELECT * INTO v_job
  FROM public.image_extraction_jobs
  WHERE id=p_job_id
  FOR UPDATE;
  IF NOT FOUND OR v_job.job_kind IS DISTINCT FROM 'vision_extract'
    OR v_job.entity_type IS DISTINCT FROM 'input'
    OR v_job.status NOT IN ('open','retry_scheduled')
    OR v_job.attempt_count>=v_job.max_attempts
    OR v_job.lease_owner IS NOT NULL OR v_job.lease_expires_at IS NOT NULL
    OR v_job.lease_token_hash IS NOT NULL
    OR v_job.completed_at IS NOT NULL OR v_job.dead_lettered_at IS NOT NULL
    OR v_job.dedupe_key IS DISTINCT FROM 'vision:'||v_job.entity_id::text THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;

  SELECT * INTO v_input
  FROM public.image_extraction_inputs
  WHERE id=v_job.entity_id
  FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO v_session
    FROM public.image_extraction_sessions
    WHERE id=v_input.session_id;
    SELECT * INTO v_media
    FROM public.media_assets
    WHERE id=v_input.media_asset_id;
  END IF;
  IF v_input.id IS NULL OR v_session.id IS NULL OR v_media.id IS NULL
    OR v_input.store_id IS DISTINCT FROM v_job.store_id
    OR v_session.store_id IS DISTINCT FROM v_job.store_id
    OR v_media.store_id IS DISTINCT FROM v_job.store_id
    OR v_session.status IS DISTINCT FROM 'active'
    OR v_input.session_id IS DISTINCT FROM v_session.id
    OR v_input.media_asset_id IS DISTINCT FROM v_media.id
    OR v_media.session_id IS DISTINCT FROM v_session.id
    OR v_media.uploaded_by IS DISTINCT FROM v_session.created_by
    OR v_job.operation_version IS DISTINCT FROM v_input.orchestration_version
    OR v_input.state NOT IN ('queued','processing') OR v_input.deleted_at IS NOT NULL
    OR v_media.purpose IS DISTINCT FROM 'scan_input'
    OR v_media.privacy_class IS DISTINCT FROM 'private_scan'
    OR v_media.lifecycle_status IS DISTINCT FROM 'linked'
    OR v_media.detected_mime IS DISTINCT FROM 'image/webp'
    OR v_media.validated_at IS NULL OR v_media.reencode_version IS NULL
    OR v_media.exif_strip_version IS NULL OR v_media.deleted_at IS NOT NULL
    OR v_input.sha256 IS DISTINCT FROM v_media.sha256 THEN
    RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED';
  END IF;

  INSERT INTO public.phase9_usage_reservations(
    store_id,job_id,cost_kind,policy_version,operation,adapter_key,
    adapter_version,idempotency_identity,reserved_cost_units
  ) VALUES (
    v_job.store_id,v_job.id,'vision',1,'extract',NULL,NULL,v_job.dedupe_key,1
  )
  ON CONFLICT(store_id,job_id,cost_kind,policy_version) DO NOTHING;

  SELECT * INTO v_reservation
  FROM public.phase9_usage_reservations r
  WHERE r.store_id=v_job.store_id AND r.job_id=v_job.id
    AND r.cost_kind='vision' AND r.policy_version=1
  FOR UPDATE;
  IF NOT FOUND OR v_reservation.operation IS DISTINCT FROM 'extract'
    OR v_reservation.adapter_key IS NOT NULL
    OR v_reservation.adapter_version IS NOT NULL
    OR v_reservation.idempotency_identity IS DISTINCT FROM v_job.dedupe_key
    OR v_reservation.reserved_cost_units IS DISTINCT FROM 1::numeric
    OR v_reservation.actual_cost_units IS NOT NULL
    OR v_reservation.status IS DISTINCT FROM 'reserved' THEN
    RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
  END IF;
  RETURN v_reservation.id;
END
$$;

ALTER FUNCTION marketplace_sec.phase9_ensure_vision_usage_reservation(uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_ensure_vision_usage_reservation(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_ensure_vision_usage_reservation(uuid)
  FROM service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_complete_media_validation(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_source_identity text,
  p_source_sha256 text,p_snapshot_path text,p_target_path text,p_sha256 text,p_bytes bigint,
  p_width integer,p_height integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_input public.image_extraction_inputs;
  v_cap public.phase9_upload_capabilities; v_session public.image_extraction_sessions;
  v_media uuid; v_vision uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF v_job.job_kind<>'media_validate_sanitize' OR v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker
    OR v_job.attempt_count<>p_attempt_count OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  SELECT * INTO v_input FROM public.image_extraction_inputs WHERE id=v_job.entity_id FOR UPDATE;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=v_input.upload_capability_id FOR UPDATE;
  SELECT * INTO v_session FROM public.image_extraction_sessions WHERE id=v_input.session_id;
  IF v_input.state<>'validating' OR v_input.source_object_identity<>p_source_identity
    OR v_input.source_sha256<>p_source_sha256 OR v_input.source_snapshot_path<>p_snapshot_path
    OR v_input.source_snapshot_sha256<>p_source_sha256 OR v_input.source_snapshot_bytes<>v_input.source_bytes
    OR v_input.store_id<>v_job.store_id OR v_cap.store_id<>v_job.store_id OR v_cap.purpose<>'scan_input'
    OR v_cap.bound_session_id<>v_session.id OR v_cap.initiating_owner_user_id<>v_session.created_by
    OR p_target_path<>v_job.store_id::text||'/scan_input/'||v_session.id::text||'/'||v_input.id::text||
      '/attempt-'||v_job.attempt_count::text||'.webp'
    OR p_sha256 !~ '^[0-9a-f]{64}$' OR p_bytes NOT BETWEEN 1 AND 10485760 OR p_width NOT BETWEEN 1 AND 8192
    OR p_height NOT BETWEEN 1 AND 8192 OR p_width::bigint*p_height::bigint>16000000 THEN
    RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  INSERT INTO public.media_assets(store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
    detected_mime,bytes,width,height,validation_version,validated_at,reencode_version,exif_strip_version,
    session_id,retention_class,lifecycle_status)
  VALUES(v_job.store_id,v_session.created_by,'scan_input','private_scan','image-extraction-inputs',p_target_path,
    p_sha256,'image/webp',p_bytes,p_width,p_height,'phase9-media-v1',transaction_timestamp(),
    'magick-wasm-0.0.41-webp','magick-wasm-0.0.41-strip',v_session.id,'phase9-private-scan','linked')
  ON CONFLICT(bucket_id,object_path) DO NOTHING RETURNING id INTO v_media;
  IF v_media IS NULL THEN
    SELECT id INTO v_media FROM public.media_assets WHERE bucket_id='image-extraction-inputs' AND object_path=p_target_path
      AND store_id=v_job.store_id AND uploaded_by=v_session.created_by AND purpose='scan_input' AND privacy_class='private_scan'
      AND sha256=p_sha256 AND detected_mime='image/webp' AND bytes=p_bytes AND width=p_width AND height=p_height
      AND session_id=v_session.id AND lifecycle_status='linked';
    IF v_media IS NULL THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  END IF;
  UPDATE public.image_extraction_inputs SET media_asset_id=v_media,sha256=p_sha256,state='queued',
    validation_error_code=NULL,version=version+1,updated_at=transaction_timestamp() WHERE id=v_input.id;
  UPDATE public.phase9_upload_capabilities SET consumed_media_asset_id=v_media,updated_at=transaction_timestamp()
    WHERE id=v_cap.id AND consumed_media_asset_id IS NULL;
  INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
  VALUES(v_job.store_id,'input',v_input.id,'vision_extract','vision:'||v_input.id::text,v_input.orchestration_version)
  ON CONFLICT (dedupe_key) DO NOTHING RETURNING id INTO v_vision;
  IF v_vision IS NULL THEN
    SELECT id INTO v_vision FROM public.image_extraction_jobs
    WHERE dedupe_key='vision:'||v_input.id::text;
  END IF;
  PERFORM marketplace_sec.phase9_ensure_vision_usage_reservation(v_vision);
  UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_expires_at=NULL,
    lease_token_hash=NULL,completed_at=transaction_timestamp(),updated_at=transaction_timestamp() WHERE id=v_job.id;
  RETURN jsonb_build_object('input_id',v_input.id,'media_asset_id',v_media,'vision_job_id',v_vision,'state','queued');
END
$$;

ALTER FUNCTION marketplace_sec.phase9_complete_media_validation(
  uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer
) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_media_validation(
  uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_media_validation(
  uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer
) TO service_role;

DO $$
DECLARE v_job_id uuid;
BEGIN
  FOR v_job_id IN
    SELECT j.id
    FROM public.image_extraction_jobs j
    JOIN public.image_extraction_inputs i ON i.id=j.entity_id
    JOIN public.image_extraction_sessions s ON s.id=i.session_id
    JOIN public.media_assets m ON m.id=i.media_asset_id
    WHERE j.job_kind='vision_extract' AND j.entity_type='input'
      AND j.status IN ('open','retry_scheduled')
      AND j.attempt_count<j.max_attempts
      AND j.lease_owner IS NULL AND j.lease_expires_at IS NULL
      AND j.lease_token_hash IS NULL
      AND j.completed_at IS NULL AND j.dead_lettered_at IS NULL
      AND j.dedupe_key='vision:'||j.entity_id::text
      AND j.operation_version=i.orchestration_version
      AND i.store_id=j.store_id AND s.store_id=j.store_id AND m.store_id=j.store_id
      AND s.status='active'
      AND i.session_id=s.id AND i.media_asset_id=m.id AND m.session_id=s.id
      AND m.uploaded_by=s.created_by
      AND i.state IN ('queued','processing') AND i.deleted_at IS NULL
      AND m.purpose='scan_input' AND m.privacy_class='private_scan'
      AND m.lifecycle_status='linked' AND m.detected_mime='image/webp'
      AND m.validated_at IS NOT NULL AND m.reencode_version IS NOT NULL
      AND m.exif_strip_version IS NOT NULL AND m.deleted_at IS NULL
      AND i.sha256=m.sha256
      AND NOT EXISTS (
        SELECT 1 FROM public.phase9_usage_reservations r
        WHERE r.store_id=j.store_id AND r.job_id=j.id
          AND r.cost_kind='vision' AND r.policy_version=1
      )
    ORDER BY j.id
    FOR UPDATE OF j
  LOOP
    PERFORM marketplace_sec.phase9_ensure_vision_usage_reservation(v_job_id);
  END LOOP;
END
$$;

COMMIT;
