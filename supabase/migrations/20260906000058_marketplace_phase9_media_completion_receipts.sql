-- M58. Approved Unit 6G correction §4.1; Master SDD §3 MAS-08/MAS-17; Pipeline §10.
BEGIN;
CREATE TABLE marketplace_sec.phase9_media_completion_receipts (
 job_id uuid PRIMARY KEY REFERENCES public.image_extraction_jobs(id),store_id uuid NOT NULL REFERENCES public.stores(id),
 command jsonb NOT NULL, result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
ALTER TABLE marketplace_sec.phase9_media_completion_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketplace_sec.phase9_media_completion_receipts FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_complete_media_validation(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer) RENAME TO phase9_complete_media_validation_legacy;
ALTER FUNCTION public.phase9_complete_media_validation_v2(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer) RENAME TO phase9_complete_media_validation_v2_legacy;
ALTER FUNCTION marketplace_sec.phase9_bind_media_validation_snapshot(uuid,text,text,integer,text,text,bigint,text) RENAME TO phase9_bind_media_validation_snapshot_legacy;
ALTER FUNCTION public.phase9_bind_media_validation_snapshot_v2(uuid,text,text,integer,text,text,bigint,text) RENAME TO phase9_bind_media_validation_snapshot_v2_legacy;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_media_validation_legacy(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer),
 public.phase9_complete_media_validation_v2_legacy(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer),
 marketplace_sec.phase9_bind_media_validation_snapshot_legacy(uuid,text,text,integer,text,text,bigint,text),
 public.phase9_bind_media_validation_snapshot_v2_legacy(uuid,text,text,integer,text,text,bigint,text)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.phase9_bind_media_validation_snapshot_v2(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_snapshot_path text,p_snapshot_sha256 text,p_snapshot_bytes bigint,p_snapshot_mime text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; r marketplace_sec.phase9_media_output_intents; ok boolean;
BEGIN
 j:=marketplace_sec.phase9_lock_media_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 SELECT * INTO r FROM marketplace_sec.phase9_media_output_intents WHERE job_id=j.id AND attempt_count=j.attempt_count AND output_kind='snapshot' FOR UPDATE;
 IF r.id IS NULL OR r.state='delete_reserved' OR r.claim_hash IS DISTINCT FROM j.lease_token_hash
 OR r.object_path IS DISTINCT FROM p_snapshot_path OR r.context->>'source_sha256' IS DISTINCT FROM p_snapshot_sha256
 OR (r.context->>'source_bytes')::bigint IS DISTINCT FROM p_snapshot_bytes OR r.context->>'source_mime' IS DISTINCT FROM p_snapshot_mime
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF r.state<>'accepted' THEN
  IF j.entity_type='input' THEN ok:=marketplace_sec.phase9_bind_media_validation_snapshot_legacy(
   p_job_id,p_worker,p_lease_token,p_attempt_count,p_snapshot_path,p_snapshot_sha256,p_snapshot_bytes,p_snapshot_mime);
  ELSE ok:=public.phase9_bind_media_validation_snapshot_v2_legacy(
   p_job_id,p_worker,p_lease_token,p_attempt_count,p_snapshot_path,p_snapshot_sha256,p_snapshot_bytes,p_snapshot_mime); END IF;
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 END IF;
 UPDATE marketplace_sec.phase9_media_output_intents SET state='accepted',updated_at=transaction_timestamp() WHERE id=r.id;
 RETURN true;
END$$;
CREATE FUNCTION marketplace_sec.phase9_bind_media_validation_snapshot(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_snapshot_path text,p_snapshot_sha256 text,p_snapshot_bytes bigint,p_snapshot_mime text
) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.phase9_bind_media_validation_snapshot_v2(p_job_id,p_worker,p_lease_token,p_attempt_count,
 p_snapshot_path,p_snapshot_sha256,p_snapshot_bytes,p_snapshot_mime)
$$;

CREATE FUNCTION public.phase9_complete_media_validation_v2(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_source_identity text,
 p_source_sha256 text,p_snapshot_path text,p_target_path text,p_sha256 text,p_bytes bigint,p_width integer,p_height integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; r marketplace_sec.phase9_media_output_intents;
 receipt marketplace_sec.phase9_media_completion_receipts; command jsonb; result jsonb; c jsonb;
 m public.media_assets; src public.media_assets; i public.image_extraction_inputs; s public.image_extraction_sessions;
 cap public.phase9_upload_capabilities; owner_id uuid; session_id uuid; source_id uuid;
 purpose text; privacy text; retention text; expected_state text; constraint_name text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker IS NULL OR p_lease_token IS NULL
 OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$' OR p_lease_token !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 -- Lock job before receipts/intents everywhere. Receipts survive clearing the lease.
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 command:=jsonb_build_array(p_job_id,j.store_id,p_worker,p_attempt_count,
 encode(extensions.digest(p_lease_token,'sha256'),'hex'),p_source_identity,p_source_sha256,
 p_snapshot_path,p_target_path,p_sha256,p_bytes,p_width,p_height,'phase9-media-v1',
 'magick-wasm-0.0.41-webp','magick-wasm-0.0.41-strip',j.entity_type,j.entity_id,j.operation_version);
 SELECT * INTO receipt FROM marketplace_sec.phase9_media_completion_receipts WHERE job_id=j.id;
 IF receipt.job_id IS NOT NULL THEN
  IF receipt.command IS DISTINCT FROM command THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN receipt.result;
 END IF;
 j:=marketplace_sec.phase9_lock_media_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 SELECT * INTO r FROM marketplace_sec.phase9_media_output_intents
 WHERE job_id=j.id AND attempt_count=j.attempt_count AND output_kind='sanitized' FOR UPDATE;
 IF r.id IS NULL OR r.state<>'pending' OR r.claim_hash IS DISTINCT FROM j.lease_token_hash
 OR r.worker IS DISTINCT FROM p_worker THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 c:=public.phase9_media_validation_context_v2(p_job_id,p_worker,p_lease_token,p_attempt_count);
 IF p_source_identity IS NULL OR p_source_sha256 IS NULL OR p_snapshot_path IS NULL OR p_target_path IS NULL
 OR p_sha256 IS NULL OR p_bytes IS NULL OR p_width IS NULL OR p_height IS NULL
 OR r.context->>'source_object_identity' IS DISTINCT FROM p_source_identity OR r.context->>'source_sha256' IS DISTINCT FROM p_source_sha256
 OR r.context->>'source_bytes' IS DISTINCT FROM c->>'source_bytes' OR r.context->>'source_bucket' IS DISTINCT FROM c->>'source_bucket'
 OR r.context->>'source_path' IS DISTINCT FROM c->>'source_path'
 OR c->>'source_object_identity' IS DISTINCT FROM p_source_identity OR c->>'source_sha256' IS DISTINCT FROM p_source_sha256
 OR c->>'source_snapshot_path' IS DISTINCT FROM p_snapshot_path OR c->>'source_snapshot_sha256' IS DISTINCT FROM p_source_sha256
 OR c->>'source_snapshot_bytes' IS DISTINCT FROM c->>'source_bytes'
 OR r.object_path IS DISTINCT FROM p_target_path OR r.bucket_id IS DISTINCT FROM c->>'target_bucket'
 OR c->>'target_path' IS DISTINCT FROM p_target_path OR p_sha256 !~ '^[0-9a-f]{64}$'
 OR p_bytes NOT BETWEEN 1 AND 10485760 OR p_width NOT BETWEEN 1 AND 8192 OR p_height NOT BETWEEN 1 AND 8192
 OR p_width::bigint*p_height::bigint>16000000 THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
 IF j.entity_type='input' THEN
  SELECT * INTO i FROM public.image_extraction_inputs WHERE id=j.entity_id FOR UPDATE;
  SELECT * INTO s FROM public.image_extraction_sessions WHERE id=i.session_id FOR UPDATE;
  SELECT * INTO cap FROM public.phase9_upload_capabilities WHERE id=i.upload_capability_id FOR UPDATE;
  IF i.id IS NULL OR s.id IS NULL OR cap.id IS NULL OR i.deleted_at IS NOT NULL
   OR i.state IS DISTINCT FROM 'validating' OR s.status IS DISTINCT FROM 'active'
   OR i.store_id IS DISTINCT FROM j.store_id OR s.store_id IS DISTINCT FROM j.store_id
   OR cap.store_id IS DISTINCT FROM j.store_id OR cap.purpose IS DISTINCT FROM 'scan_input' OR cap.status IS DISTINCT FROM 'consumed'
   OR cap.bound_session_id IS DISTINCT FROM s.id OR cap.initiating_owner_user_id IS DISTINCT FROM s.created_by
   THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  owner_id:=s.created_by; session_id:=s.id; purpose:='scan_input'; privacy:='private_scan'; retention:='phase9-private-scan'; expected_state:='linked';
 ELSIF j.entity_type='media_asset' THEN
  SELECT * INTO src FROM public.media_assets WHERE id=j.entity_id FOR UPDATE;
  SELECT * INTO cap FROM public.phase9_upload_capabilities WHERE consumed_media_asset_id=src.id FOR UPDATE;
  IF src.id IS NULL OR cap.id IS NULL OR src.store_id IS DISTINCT FROM j.store_id OR cap.store_id IS DISTINCT FROM j.store_id
   OR src.uploaded_by IS DISTINCT FROM cap.initiating_owner_user_id OR src.purpose IS DISTINCT FROM 'public_copy'
   OR src.retention_class IS DISTINCT FROM 'phase9-public-copy-source' OR src.privacy_class IS DISTINCT FROM 'private_scan' OR src.bucket_id IS DISTINCT FROM 'marketplace-media-staging' OR src.deleted_at IS NOT NULL OR src.delete_after IS NOT NULL OR src.lifecycle_status NOT IN ('staged','validated')
   OR (src.hold_type IS NOT NULL AND src.hold_released_at IS NULL) OR src.lifecycle_status='held'
   OR cap.purpose IS DISTINCT FROM 'public_copy' OR cap.status IS DISTINCT FROM 'consumed'
   THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  owner_id:=src.uploaded_by; source_id:=src.id; purpose:='public_copy'; privacy:='public'; retention:='phase9-public-copy'; expected_state:='approved';
 ELSE RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
 -- Enforce full policy/derivation for existing-path reuse before legacy linkage.
 SELECT * INTO m FROM public.media_assets WHERE bucket_id=r.bucket_id AND object_path=p_target_path FOR UPDATE;
 IF m.id IS NOT NULL AND (m.store_id IS DISTINCT FROM j.store_id OR m.uploaded_by IS DISTINCT FROM owner_id
 OR m.purpose IS DISTINCT FROM purpose OR m.privacy_class IS DISTINCT FROM privacy OR m.sha256 IS DISTINCT FROM p_sha256
 OR m.detected_mime IS DISTINCT FROM 'image/webp' OR m.bytes IS DISTINCT FROM p_bytes OR m.width IS DISTINCT FROM p_width OR m.height IS DISTINCT FROM p_height
 OR m.validation_version IS DISTINCT FROM 'phase9-media-v1' OR m.validated_at IS NULL
 OR m.reencode_version IS DISTINCT FROM 'magick-wasm-0.0.41-webp' OR m.exif_strip_version IS DISTINCT FROM 'magick-wasm-0.0.41-strip'
 OR m.retention_class IS DISTINCT FROM retention OR m.lifecycle_status IS DISTINCT FROM expected_state
 OR m.session_id IS DISTINCT FROM session_id OR m.source_media_asset_id IS DISTINCT FROM source_id
 OR m.deleted_at IS NOT NULL OR m.delete_after IS NOT NULL OR (m.hold_type IS NOT NULL AND m.hold_released_at IS NULL))
 THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
 BEGIN
  IF j.entity_type='input' THEN result:=marketplace_sec.phase9_complete_media_validation_legacy(
   p_job_id,p_worker,p_lease_token,p_attempt_count,p_source_identity,p_source_sha256,p_snapshot_path,p_target_path,p_sha256,p_bytes,p_width,p_height);
  ELSE result:=public.phase9_complete_media_validation_v2_legacy(
   p_job_id,p_worker,p_lease_token,p_attempt_count,p_source_identity,p_source_sha256,p_snapshot_path,p_target_path,p_sha256,p_bytes,p_width,p_height); END IF;
 EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS constraint_name=CONSTRAINT_NAME;
  IF constraint_name IS DISTINCT FROM 'image_extraction_inputs_store_id_sha256_orchestration_versi_key' OR j.entity_type<>'input' THEN RAISE; END IF;
  UPDATE public.image_extraction_inputs SET state='failed',validation_error_code='P9_MEDIA_DUPLICATE_INPUT',version=version+1,updated_at=transaction_timestamp() WHERE id=i.id;
  UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_expires_at=NULL,lease_token_hash=NULL,
   last_safe_error_category='media_validation',last_safe_error_code='P9_MEDIA_DUPLICATE_INPUT',completed_at=transaction_timestamp(),updated_at=transaction_timestamp() WHERE id=j.id;
  result:=jsonb_build_object('state','duplicate_rejected','safe_error_code','P9_MEDIA_DUPLICATE_INPUT','input_id',i.id);
 END;
 IF result->>'state'<>'duplicate_rejected' THEN
  UPDATE marketplace_sec.phase9_media_output_intents SET state='accepted',updated_at=transaction_timestamp() WHERE id=r.id;
 END IF;
 INSERT INTO marketplace_sec.phase9_media_completion_receipts(job_id,store_id,command,result) VALUES(j.id,j.store_id,command,result);
 RETURN result;
END$$;
CREATE FUNCTION marketplace_sec.phase9_complete_media_validation(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_source_identity text,
 p_source_sha256 text,p_snapshot_path text,p_target_path text,p_sha256 text,p_bytes bigint,p_width integer,p_height integer
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.phase9_complete_media_validation_v2(p_job_id,p_worker,p_lease_token,p_attempt_count,
 p_source_identity,p_source_sha256,p_snapshot_path,p_target_path,p_sha256,p_bytes,p_width,p_height)
$$;
REVOKE ALL ON FUNCTION public.phase9_complete_media_validation_v2(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer),
 marketplace_sec.phase9_complete_media_validation(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer),
 public.phase9_bind_media_validation_snapshot_v2(uuid,text,text,integer,text,text,bigint,text),
 marketplace_sec.phase9_bind_media_validation_snapshot(uuid,text,text,integer,text,text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_complete_media_validation_v2(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer),
 marketplace_sec.phase9_complete_media_validation(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer),
 public.phase9_bind_media_validation_snapshot_v2(uuid,text,text,integer,text,text,bigint,text),
 marketplace_sec.phase9_bind_media_validation_snapshot(uuid,text,text,integer,text,text,bigint,text) TO service_role;
ALTER FUNCTION public.phase9_bind_media_validation_snapshot_v2(uuid,text,text,integer,text,text,bigint,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_bind_media_validation_snapshot(uuid,text,text,integer,text,text,bigint,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_complete_media_validation_v2(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_complete_media_validation(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer) OWNER TO postgres;
COMMIT;
