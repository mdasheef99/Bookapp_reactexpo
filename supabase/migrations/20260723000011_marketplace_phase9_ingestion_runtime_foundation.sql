-- Phase 9 ingestion-runtime foundation. Forward correction after M10; M09 remains reserved.
BEGIN;

ALTER TABLE public.phase9_upload_capabilities
  ADD COLUMN declared_mime text,
  ADD COLUMN declared_bytes bigint,
  ADD COLUMN declared_source_kind text,
  ADD COLUMN source_object_identity text,
  ADD COLUMN source_sha256 text,
  ADD COLUMN observed_mime text,
  ADD COLUMN observed_bytes bigint,
  ADD COLUMN completion_canonical_response jsonb;

ALTER TABLE public.phase9_upload_capabilities
  ADD CONSTRAINT phase9_capability_declared_mime_check
    CHECK (declared_mime IS NULL OR declared_mime IN ('image/jpeg','image/png','image/webp')),
  ADD CONSTRAINT phase9_capability_declared_bytes_check
    CHECK (declared_bytes IS NULL OR declared_bytes BETWEEN 1 AND 10485760),
  ADD CONSTRAINT phase9_capability_declared_source_kind_check
    CHECK (declared_source_kind IS NULL OR declared_source_kind IN ('camera','gallery')),
  ADD CONSTRAINT phase9_capability_source_identity_check
    CHECK (source_object_identity IS NULL OR source_object_identity ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT phase9_capability_source_sha_check
    CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT phase9_capability_completion_response_check
    CHECK (completion_canonical_response IS NULL OR jsonb_typeof(completion_canonical_response)='object');

ALTER TABLE public.image_extraction_inputs
  ALTER COLUMN sha256 DROP NOT NULL,
  ADD COLUMN upload_capability_id uuid REFERENCES public.phase9_upload_capabilities(id),
  ADD COLUMN source_object_identity text,
  ADD COLUMN source_sha256 text,
  ADD COLUMN source_bytes bigint,
  ADD COLUMN source_mime text,
  ADD COLUMN source_snapshot_bucket text,
  ADD COLUMN source_snapshot_path text,
  ADD COLUMN source_snapshot_sha256 text,
  ADD COLUMN source_snapshot_bytes bigint,
  ADD COLUMN source_snapshot_bound_attempt integer,
  ADD COLUMN validation_error_code text,
  -- persisted state progression: uploaded -> validating -> queued | failed
  ADD CONSTRAINT phase9_input_upload_capability_unique UNIQUE(upload_capability_id),
  ADD CONSTRAINT phase9_input_source_hash_check CHECK (
    source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT phase9_input_snapshot_coherence CHECK (
    (source_snapshot_path IS NULL AND source_snapshot_bucket IS NULL AND source_snapshot_sha256 IS NULL
      AND source_snapshot_bytes IS NULL AND source_snapshot_bound_attempt IS NULL)
    OR (source_snapshot_path IS NOT NULL AND source_snapshot_bucket='image-extraction-inputs'
      AND source_snapshot_sha256 ~ '^[0-9a-f]{64}$' AND source_snapshot_bytes BETWEEN 1 AND 10485760
      AND source_snapshot_bound_attempt BETWEEN 1 AND 5)
  ),
  ADD CONSTRAINT phase9_input_validation_state_coherence CHECK (
    (state IN ('uploaded','validating','failed')) OR
    (state IN ('queued','processing','ready','skipped') AND media_asset_id IS NOT NULL AND sha256 IS NOT NULL)
  );

ALTER TABLE public.image_extraction_jobs
  ADD COLUMN lease_token_hash text,
  ADD CONSTRAINT phase9_job_lease_token_hash_check
    CHECK (lease_token_hash IS NULL OR lease_token_hash ~ '^[0-9a-f]{64}$');

CREATE FUNCTION marketplace_sec.phase9_assert_actor_session_owner(p_actor uuid,p_session_id uuid)
RETURNS public.image_extraction_sessions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v FROM public.image_extraction_sessions WHERE id=p_session_id;
  IF v.id IS NULL OR v.created_by<>p_actor OR v.status<>'active' OR NOT EXISTS(
    SELECT 1 FROM public.store_administrators sa JOIN public.stores s ON s.id=sa.store_id
    WHERE sa.store_id=v.store_id AND sa.user_id=p_actor AND sa.role='owner' AND sa.status='active'
      AND s.status='active' AND s.setup_status='complete' AND s.selling_status='allowed'
  ) THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN v;
END$$;

CREATE FUNCTION marketplace_sec.phase9_issue_scan_upload(
  p_actor uuid,p_session_id uuid,p_source_kind text,p_declared_mime text,p_declared_bytes bigint,
  p_ordinal integer,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_cap uuid; v_path text; v_replay jsonb;
  v_expiry timestamptz:=transaction_timestamp()+interval '10 minutes'; v_fingerprint text;
BEGIN
  v_session:=marketplace_sec.phase9_assert_actor_session_owner(p_actor,p_session_id);
  IF p_source_kind NOT IN ('camera','gallery') OR p_declared_mime NOT IN ('image/jpeg','image/png','image/webp')
    OR p_declared_bytes NOT BETWEEN 1 AND 10485760 OR p_ordinal NOT BETWEEN 1 AND 15 THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=concat_ws('|',p_session_id,p_source_kind,p_declared_mime,p_declared_bytes,p_ordinal,p_command_id);
  v_replay:=marketplace_sec.phase9_replay(p_actor::text,'P9_INGEST_ISSUE',p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  v_cap:=gen_random_uuid();
  v_path:=v_session.store_id::text||'/scan_input/'||v_session.id::text||'/'||v_cap::text||
    CASE p_declared_mime WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' ELSE '.webp' END;
  INSERT INTO public.phase9_upload_capabilities(id,store_id,issued_to_user_id,initiating_owner_user_id,
    purpose,bound_entity_type,bound_entity_id,bound_session_id,bound_ordinal,bucket_id,object_path,
    envelope_sha256,nonce_hash,expires_at,declared_mime,declared_bytes,declared_source_kind)
  VALUES(v_cap,v_session.store_id,p_actor,p_actor,'scan_input','session',p_session_id,p_session_id,p_ordinal,
    'marketplace-media-staging',v_path,
    encode(extensions.digest(concat_ws('|',p_declared_mime,p_declared_bytes,p_source_kind),'sha256'),'hex'),
    encode(extensions.digest(v_cap::text||p_idempotency_key,'sha256'),'hex'),v_expiry,p_declared_mime,p_declared_bytes,p_source_kind);
  v_replay:=jsonb_build_object('capability_id',v_cap,'bucket_id','marketplace-media-staging',
    'object_path',v_path,'expires_at',v_expiry);
  PERFORM marketplace_sec.phase9_finish_replay(p_actor::text,'P9_INGEST_ISSUE',p_idempotency_key,v_replay,'capability_issued');
  RETURN v_replay;
END$$;

CREATE FUNCTION marketplace_sec.phase9_scan_upload_context(p_actor uuid,p_capability_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cap public.phase9_upload_capabilities; v_session public.image_extraction_sessions;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=p_capability_id;
  IF v_cap.id IS NULL OR v_cap.purpose<>'scan_input' OR v_cap.issued_to_user_id<>p_actor
    OR v_cap.initiating_owner_user_id<>p_actor OR v_cap.status NOT IN ('issued','consumed') THEN
    RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  v_session:=marketplace_sec.phase9_assert_actor_session_owner(p_actor,v_cap.bound_session_id);
  IF v_session.store_id<>v_cap.store_id OR v_cap.bound_entity_id<>v_session.id THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  RETURN jsonb_build_object('bucket_id',v_cap.bucket_id,'object_path',v_cap.object_path,
    'declared_mime',v_cap.declared_mime,'declared_bytes',v_cap.declared_bytes,'expires_at',v_cap.expires_at);
END$$;

CREATE FUNCTION marketplace_sec.phase9_register_scan_upload_completion(
  p_actor uuid,p_capability_id uuid,p_source_kind text,p_bucket text,p_path text,p_object_identity text,
  p_source_sha256 text,p_observed_mime text,p_observed_bytes bigint,p_orchestration_version text,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cap public.phase9_upload_capabilities; v_session public.image_extraction_sessions;
  v_input uuid; v_job uuid; v_existing public.image_extraction_inputs; v_response jsonb;
  v_fingerprint text; v_replay jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=p_capability_id FOR UPDATE;
  IF v_cap.id IS NULL OR v_cap.purpose<>'scan_input' OR v_cap.issued_to_user_id<>p_actor
    OR v_cap.initiating_owner_user_id<>p_actor OR v_cap.bound_entity_type<>'session'
    OR p_source_kind<>v_cap.declared_source_kind OR p_bucket<>v_cap.bucket_id OR p_path<>v_cap.object_path
    OR p_observed_mime<>v_cap.declared_mime OR p_observed_bytes<>v_cap.declared_bytes
    OR p_object_identity !~ '^[0-9a-f]{64}$' OR p_source_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  v_session:=marketplace_sec.phase9_assert_actor_session_owner(p_actor,v_cap.bound_session_id);
  IF v_session.store_id<>v_cap.store_id OR v_cap.bound_entity_id<>v_session.id THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  SELECT * INTO v_existing FROM public.image_extraction_inputs WHERE upload_capability_id=p_capability_id;
  IF v_cap.status='consumed' THEN
    IF v_existing.id IS NULL OR v_existing.source_kind<>p_source_kind
      OR v_existing.source_object_identity<>p_object_identity OR v_existing.source_sha256<>p_source_sha256
      OR v_existing.source_bytes<>p_observed_bytes OR v_existing.source_mime<>p_observed_mime
      OR v_cap.completion_canonical_response IS NULL THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
    RETURN v_cap.completion_canonical_response;
  END IF;
  IF v_cap.status<>'issued' OR v_cap.expires_at<=transaction_timestamp() THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_fingerprint:=concat_ws('|',p_capability_id,p_source_kind,p_bucket,p_path,p_object_identity,p_source_sha256,
    p_observed_mime,p_observed_bytes,p_orchestration_version,p_command_id);
  v_replay:=marketplace_sec.phase9_replay(p_actor::text,'P9_INGEST_COMPLETE',p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  INSERT INTO public.image_extraction_inputs(session_id,store_id,source_kind,state,sha256,orchestration_version,
    upload_capability_id,source_object_identity,source_sha256,source_bytes,source_mime)
  VALUES(v_session.id,v_session.store_id,p_source_kind,'uploaded',NULL,p_orchestration_version,p_capability_id,
    p_object_identity,p_source_sha256,p_observed_bytes,p_observed_mime) RETURNING id INTO v_input;
  INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
  VALUES(v_session.store_id,'input',v_input,'media_validate_sanitize','media-validate:'||v_input::text,p_orchestration_version)
  ON CONFLICT (dedupe_key) DO NOTHING RETURNING id INTO v_job;
  IF v_job IS NULL THEN SELECT id INTO v_job FROM public.image_extraction_jobs WHERE dedupe_key='media-validate:'||v_input::text; END IF;
  v_response:=jsonb_build_object('input_id',v_input,'job_id',v_job,'state','uploaded');
  UPDATE public.phase9_upload_capabilities SET status='consumed',consumed_at=transaction_timestamp(),
    source_object_identity=p_object_identity,source_sha256=p_source_sha256,observed_mime=p_observed_mime,
    observed_bytes=p_observed_bytes,completion_canonical_response=v_response,
    version=version+1,updated_at=transaction_timestamp() WHERE id=p_capability_id;
  UPDATE public.image_extraction_sessions SET input_count=input_count+1,updated_at=transaction_timestamp() WHERE id=v_session.id;
  PERFORM marketplace_sec.phase9_finish_replay(p_actor::text,'P9_INGEST_COMPLETE',p_idempotency_key,
    v_response,'input_validation_job_created');
  RETURN v_response;
END$$;

CREATE FUNCTION marketplace_sec.claim_phase9_media_validation_jobs(p_batch_size integer,p_worker text)
RETURNS TABLE(id uuid,attempt_count integer,lease_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_batch_size NOT BETWEEN 1 AND 10
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  RETURN QUERY WITH claimed AS (
    SELECT j.id FROM public.image_extraction_jobs j WHERE j.job_kind='media_validate_sanitize'
      AND j.status IN ('open','retry_scheduled','in_progress') AND j.next_attempt_at<=transaction_timestamp()
      AND (j.status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp()) AND j.attempt_count<j.max_attempts
    ORDER BY j.next_attempt_at,j.id FOR UPDATE SKIP LOCKED LIMIT p_batch_size
  ), tokenized AS MATERIALIZED (
    SELECT c.id,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','') AS token FROM claimed c
  ), updated AS (
    UPDATE public.image_extraction_jobs j SET status='in_progress',lease_owner=p_worker,
      lease_expires_at=transaction_timestamp()+interval '5 minutes',attempt_count=j.attempt_count+1,
      lease_token_hash=encode(extensions.digest(t.token,'sha256'),'hex'),updated_at=transaction_timestamp()
    FROM tokenized t WHERE j.id=t.id RETURNING j.id,j.attempt_count,t.token
  ) SELECT u.id,u.attempt_count,u.token FROM updated u;
END$$;

CREATE FUNCTION marketplace_sec.phase9_media_validation_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_input public.image_extraction_inputs;
  v_cap public.phase9_upload_capabilities; v_session public.image_extraction_sessions;
  v_snapshot text; v_target text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF v_job.job_kind<>'media_validate_sanitize' OR v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker
    OR v_job.attempt_count<>p_attempt_count OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  SELECT * INTO v_input FROM public.image_extraction_inputs WHERE id=v_job.entity_id FOR UPDATE;
  SELECT * INTO v_cap FROM public.phase9_upload_capabilities WHERE id=v_input.upload_capability_id;
  SELECT * INTO v_session FROM public.image_extraction_sessions WHERE id=v_input.session_id;
  IF v_input.store_id<>v_job.store_id OR v_cap.store_id<>v_job.store_id OR v_session.store_id<>v_job.store_id
    OR v_cap.purpose<>'scan_input' OR v_cap.bound_session_id<>v_session.id OR v_cap.initiating_owner_user_id<>v_session.created_by
    OR v_input.state NOT IN ('uploaded','validating') OR v_input.source_sha256<>v_cap.source_sha256
    OR v_input.source_object_identity<>v_cap.source_object_identity THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  UPDATE public.image_extraction_inputs SET state='validating',version=version+1,updated_at=transaction_timestamp()
    WHERE id=v_input.id AND state='uploaded';
  v_snapshot:=coalesce(v_input.source_snapshot_path,v_job.store_id::text||'/scan_input/'||v_session.id::text||
    '/'||v_input.id::text||'/source-attempt-'||v_job.attempt_count::text||'.bin');
  v_target:=v_job.store_id::text||'/scan_input/'||v_session.id::text||'/'||v_input.id::text||
    '/attempt-'||v_job.attempt_count::text||'.webp';
  RETURN jsonb_build_object('input_id',v_input.id,'source_bucket',v_cap.bucket_id,'source_path',v_cap.object_path,
    'source_object_identity',v_input.source_object_identity,'source_sha256',v_input.source_sha256,
    'source_bytes',v_input.source_bytes,'source_mime',v_input.source_mime,
    'snapshot_bucket','image-extraction-inputs','snapshot_path',v_snapshot,
    'source_snapshot_path',v_input.source_snapshot_path,'source_snapshot_sha256',v_input.source_snapshot_sha256,
    'source_snapshot_bytes',v_input.source_snapshot_bytes,
    'target_bucket','image-extraction-inputs','target_path',v_target);
END$$;

CREATE FUNCTION marketplace_sec.phase9_revalidate_media_validation_lease(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_source_identity text,p_source_sha256 text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_input public.image_extraction_inputs;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  SELECT * INTO v_input FROM public.image_extraction_inputs WHERE id=v_job.entity_id;
  IF v_job.job_kind<>'media_validate_sanitize' OR v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker
    OR v_job.attempt_count<>p_attempt_count OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
    OR v_input.state<>'validating' OR v_input.source_object_identity<>p_source_identity
    OR v_input.source_sha256<>p_source_sha256 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN true;
END$$;

CREATE FUNCTION marketplace_sec.phase9_bind_media_validation_snapshot(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_snapshot_path text,
  p_snapshot_sha256 text,p_snapshot_bytes bigint,p_snapshot_mime text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_input public.image_extraction_inputs;
  v_session public.image_extraction_sessions; v_expected text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  SELECT * INTO v_input FROM public.image_extraction_inputs WHERE id=v_job.entity_id FOR UPDATE;
  SELECT * INTO v_session FROM public.image_extraction_sessions WHERE id=v_input.session_id;
  IF v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker OR v_job.attempt_count<>p_attempt_count
    OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_expected:=v_job.store_id::text||'/scan_input/'||v_session.id::text||'/'||v_input.id::text||
    '/source-attempt-'||v_job.attempt_count::text||'.bin';
  IF v_input.source_snapshot_path IS NOT NULL THEN
    IF v_input.source_snapshot_path=p_snapshot_path AND v_input.source_snapshot_sha256=p_snapshot_sha256
      AND v_input.source_snapshot_bytes=p_snapshot_bytes AND v_input.source_mime=p_snapshot_mime THEN RETURN true; END IF;
    RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
  END IF;
  IF p_snapshot_path<>v_expected OR p_snapshot_sha256<>v_input.source_sha256
    OR p_snapshot_bytes<>v_input.source_bytes OR p_snapshot_mime<>v_input.source_mime THEN
    RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  UPDATE public.image_extraction_inputs SET source_snapshot_bucket='image-extraction-inputs',
    source_snapshot_path=p_snapshot_path,source_snapshot_sha256=p_snapshot_sha256,
    source_snapshot_bytes=p_snapshot_bytes,source_snapshot_bound_attempt=p_attempt_count,
    version=version+1,updated_at=transaction_timestamp() WHERE id=v_input.id;
  RETURN true;
END$$;

CREATE FUNCTION marketplace_sec.phase9_complete_media_validation(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_source_identity text,
  p_source_sha256 text,p_snapshot_path text,p_target_path text,p_sha256 text,p_bytes bigint,
  p_width integer,p_height integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_input public.image_extraction_inputs;
  v_cap public.phase9_upload_capabilities; v_session public.image_extraction_sessions; v_media uuid; v_vision uuid;
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
  IF v_vision IS NULL THEN SELECT id INTO v_vision FROM public.image_extraction_jobs WHERE dedupe_key='vision:'||v_input.id::text; END IF;
  UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_expires_at=NULL,
    lease_token_hash=NULL,completed_at=transaction_timestamp(),updated_at=transaction_timestamp() WHERE id=v_job.id;
  RETURN jsonb_build_object('input_id',v_input.id,'media_asset_id',v_media,'vision_job_id',v_vision,'state','queued');
END$$;

CREATE FUNCTION marketplace_sec.phase9_fail_media_validation(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_retryable boolean,p_safe_error_code text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_input public.image_extraction_inputs; v_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$'
    OR p_safe_error_code NOT IN ('P9_MEDIA_SIGNATURE_INVALID','P9_MEDIA_MIME_MISMATCH','P9_MEDIA_TOO_LARGE',
      'P9_MEDIA_DECODE_FAILED','P9_MEDIA_DIMENSIONS_EXCEEDED','P9_MEDIA_PIXEL_LIMIT','P9_MEDIA_OBJECT_CHANGED',
      'P9_MEDIA_MULTIFRAME_UNSUPPORTED','P9_MEDIA_PROCESSING_RETRYABLE') THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF v_job.job_kind<>'media_validate_sanitize' OR v_job.status<>'in_progress' OR v_job.lease_owner<>p_worker
    OR v_job.attempt_count<>p_attempt_count OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  SELECT * INTO v_input FROM public.image_extraction_inputs WHERE id=v_job.entity_id FOR UPDATE;
  v_status:=CASE WHEN p_retryable AND v_job.attempt_count<v_job.max_attempts THEN 'retry_scheduled'
    WHEN v_job.attempt_count>=v_job.max_attempts THEN 'dead_letter' ELSE 'resolved' END;
  UPDATE public.image_extraction_jobs SET status=v_status,lease_owner=NULL,lease_expires_at=NULL,lease_token_hash=NULL,
    next_attempt_at=transaction_timestamp()+interval '2 minutes',last_safe_error_category='media_validation',
    last_safe_error_code=left(p_safe_error_code,128),completed_at=CASE WHEN v_status='resolved' THEN transaction_timestamp() END,
    dead_lettered_at=CASE WHEN v_status='dead_letter' THEN transaction_timestamp() END,updated_at=transaction_timestamp()
    WHERE id=v_job.id;
  IF v_status IN ('resolved','dead_letter') THEN
    UPDATE public.image_extraction_inputs SET state='failed',validation_error_code=left(p_safe_error_code,128),
      version=version+1,updated_at=transaction_timestamp() WHERE id=v_input.id;
    INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
    VALUES(v_input.store_id,'input',v_input.id,'staging_cleanup','staging-cleanup:'||v_input.id::text,v_input.orchestration_version)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN v_status;
END$$;

REVOKE ALL ON FUNCTION public.phase9_authorize_upload(uuid,text,text,text,text,integer,timestamptz,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_accept_scan_input(uuid,uuid,uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_authorize_upload(uuid,text,text,text,text,integer,timestamptz,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_accept_scan_input(uuid,uuid,uuid,text,text,text,uuid) TO service_role;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_assert_actor_session_owner(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_issue_scan_upload(uuid,uuid,text,text,bigint,integer,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_scan_upload_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_scan_upload_completion(uuid,uuid,text,text,text,text,text,text,bigint,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.claim_phase9_media_validation_jobs(integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_media_validation_context(uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_revalidate_media_validation_lease(uuid,text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_bind_media_validation_snapshot(uuid,text,text,integer,text,text,bigint,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_media_validation(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_fail_media_validation(uuid,text,text,integer,boolean,text) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_assert_actor_session_owner(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_issue_scan_upload(uuid,uuid,text,text,bigint,integer,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_scan_upload_context(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_scan_upload_completion(uuid,uuid,text,text,text,text,text,text,bigint,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.claim_phase9_media_validation_jobs(integer,text) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_media_validation_context(uuid,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_revalidate_media_validation_lease(uuid,text,text,integer,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_bind_media_validation_snapshot(uuid,text,text,integer,text,text,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_media_validation(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_fail_media_validation(uuid,text,text,integer,boolean,text) TO service_role;

COMMIT;
