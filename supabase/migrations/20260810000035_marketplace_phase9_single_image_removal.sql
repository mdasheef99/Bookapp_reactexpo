BEGIN;

-- DOC-4 §3/§5 and the Owner's 2026-08-10 decision: one current scan image.
-- Removal is logical and hold-aware; physical object deletion remains lifecycle work.
ALTER TABLE public.image_extraction_inputs
  DROP CONSTRAINT phase9_input_validation_state_coherence;
ALTER TABLE public.image_extraction_inputs
  ADD CONSTRAINT phase9_input_validation_state_coherence CHECK (
    state IN ('uploaded','validating','failed')
    OR (state='skipped' AND quality_reason='P9_OWNER_REMOVED')
    OR (
      state IN ('queued','processing','ready','skipped')
      AND media_asset_id IS NOT NULL
      AND sha256 IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.phase9_remove_scan_input_v1(
  p_session_id uuid,
  p_input_id uuid,
  p_expected_input_version integer,
  p_idempotency_key text,
  p_command_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_session public.image_extraction_sessions;
  v_input public.image_extraction_inputs;
  v_replay jsonb;
  v_response jsonb;
  v_fingerprint text;
  v_session_version integer;
  v_presentation_revision integer;
BEGIN
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  IF p_input_id IS NULL OR p_expected_input_version<1 OR p_command_id IS NULL
    OR p_idempotency_key IS NULL OR char_length(p_idempotency_key) NOT BETWEEN 8 AND 160
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;

  SELECT * INTO v_input
  FROM public.image_extraction_inputs i
  WHERE i.id=p_input_id AND i.session_id=p_session_id AND i.store_id=v_session.store_id;
  IF v_input.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;

  v_fingerprint:=concat_ws('|',p_session_id,p_input_id,p_expected_input_version,p_command_id);
  v_replay:=marketplace_sec.phase9_replay(
    auth.uid()::text,'P9_OWNER_REMOVE_INPUT',p_idempotency_key,v_fingerprint
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  UPDATE public.image_extraction_jobs j
  SET status='cancelled',lease_owner=NULL,lease_expires_at=NULL,lease_token_hash=NULL,
      completed_at=coalesce(j.completed_at,transaction_timestamp()),
      last_safe_error_code='P9_OWNER_REMOVED',last_safe_error_category='owner_action',
      updated_at=transaction_timestamp()
  WHERE j.store_id=v_session.store_id AND j.entity_type='input' AND j.entity_id=p_input_id
    AND j.job_kind IN ('media_validate_sanitize','vision_extract')
    AND j.status IN ('open','in_progress','retry_scheduled');

  SELECT * INTO v_input
  FROM public.image_extraction_inputs i
  WHERE i.id=p_input_id AND i.session_id=p_session_id AND i.store_id=v_session.store_id
  FOR UPDATE;
  SELECT * INTO v_session FROM public.image_extraction_sessions s
  WHERE s.id=p_session_id;
  IF v_session.status<>'active' OR v_session.expires_at<=transaction_timestamp()
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_input.quality_reason='P9_OWNER_REMOVED'
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_input.version<>p_expected_input_version
  THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.image_extraction_candidates c
    WHERE c.input_id=p_input_id
  ) THEN RAISE EXCEPTION 'P9_INPUT_HAS_CANDIDATES'; END IF;

  UPDATE public.image_extraction_inputs i
  SET state='skipped',quality_result='owner_removed',quality_reason='P9_OWNER_REMOVED',
      validation_error_code=NULL,processed_at=coalesce(i.processed_at,transaction_timestamp()),
      delete_after=transaction_timestamp()+interval '24 hours',
      version=i.version+1,updated_at=transaction_timestamp()
  WHERE i.id=p_input_id
  RETURNING * INTO v_input;

  UPDATE public.media_assets ma
  SET delete_after=least(
        coalesce(ma.delete_after,transaction_timestamp()+interval '24 hours'),
        transaction_timestamp()+interval '24 hours'
      ),version=ma.version+1,updated_at=transaction_timestamp()
  WHERE ma.id=v_input.media_asset_id AND ma.store_id=v_session.store_id
    AND ma.hold_type IS NULL AND ma.deleted_at IS NULL;

  -- A media worker may have inserted a vision job after the first statement snapshot.
  UPDATE public.image_extraction_jobs j
  SET status='cancelled',lease_owner=NULL,lease_expires_at=NULL,lease_token_hash=NULL,
      completed_at=coalesce(j.completed_at,transaction_timestamp()),
      last_safe_error_code='P9_OWNER_REMOVED',last_safe_error_category='owner_action',
      updated_at=transaction_timestamp()
  WHERE j.store_id=v_session.store_id AND j.entity_type='input' AND j.entity_id=p_input_id
    AND j.job_kind IN ('media_validate_sanitize','vision_extract')
    AND j.status IN ('open','in_progress','retry_scheduled');

  UPDATE public.image_extraction_sessions s
  SET version=s.version+1,updated_at=transaction_timestamp()
  WHERE s.id=p_session_id
  RETURNING s.version,s.presentation_revision
  INTO v_session_version,v_presentation_revision;

  v_response:=jsonb_build_object(
    'sessionId',p_session_id,'inputId',p_input_id,'inputState','skipped',
    'inputVersion',v_input.version,'sessionVersion',v_session_version,
    'presentationRevision',v_presentation_revision
  );
  PERFORM marketplace_sec.phase9_finish_replay(
    auth.uid()::text,'P9_OWNER_REMOVE_INPUT',p_idempotency_key,v_response,'input_logically_removed'
  );
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase9_owner_discover_session_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_store uuid; v_active jsonb; v_scope bigint;
BEGIN
  v_store:=marketplace_sec.phase9_owner_ux_assert_owner();
  SELECT coalesce((SELECT s.review_scope_version FROM public.phase9_owner_review_scopes s
    WHERE s.actor_user_id=auth.uid()),1) INTO v_scope
  FROM (VALUES(1)) seed(value);
  SELECT jsonb_build_object(
    'sessionId',x.id,'status',x.status,'sessionVersion',x.version,
    'startedAt',x.started_at,'updatedAt',x.updated_at,
    'inputCount',(SELECT count(*) FROM public.image_extraction_inputs i
      WHERE i.session_id=x.id AND i.quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'),
    'candidateCount',(SELECT count(*) FROM public.image_extraction_candidates c WHERE c.session_id=x.id),
    'attentionCount',(SELECT count(*) FROM public.image_extraction_candidates c
      WHERE c.session_id=x.id
        AND marketplace_sec.phase9_owner_ux_needs_review(c,x,transaction_timestamp())))
  INTO v_active FROM public.image_extraction_sessions x
  WHERE x.store_id=v_store AND x.created_by=auth.uid()
    AND x.status IN ('active','closing') AND x.expires_at>transaction_timestamp()
  ORDER BY x.updated_at DESC,x.id DESC LIMIT 1;
  RETURN jsonb_build_object(
    'activeSession',v_active,
    'needsReviewCount',(SELECT count(*) FROM public.image_extraction_candidates c
      JOIN public.image_extraction_sessions s ON s.id=c.session_id
      WHERE marketplace_sec.phase9_owner_ux_needs_review(c,s,transaction_timestamp())),
    'reviewScopeVersion',v_scope);
END;
$$;

CREATE OR REPLACE FUNCTION public.phase9_owner_session_inputs_v1(
  p_session_id uuid,
  p_page_size integer DEFAULT 20,
  p_cursor text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v public.image_extraction_sessions; v_payload jsonb; v_after_at timestamptz;
  v_after_id uuid; v_rows jsonb; v_has_more boolean; v_next text;
BEGIN
  v:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  IF p_page_size NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF p_cursor IS NOT NULL THEN
    BEGIN
      v_payload:=marketplace_sec.phase9_owner_ux_cursor_payload(p_cursor);
      IF v_payload->>'kind'<>'inputs' OR (v_payload->>'actor')::uuid<>auth.uid()
        OR (v_payload->>'session')::uuid<>p_session_id
        OR (v_payload->>'size')::integer<>p_page_size
        OR (v_payload->>'revision')::integer<>v.presentation_revision
        OR v_payload->>'contract'<>'phase9-owner-ux-v1'
      THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      v_after_at:=(v_payload->>'at')::timestamptz; v_after_id:=(v_payload->>'id')::uuid;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'P9_CURSOR_INVALID';
    END;
  END IF;
  WITH ranked AS (
    SELECT i.*,row_number() OVER(ORDER BY i.created_at,i.id)::integer ordinal,
      (SELECT j.status FROM public.image_extraction_jobs j
       WHERE j.entity_type='input' AND j.entity_id=i.id
       ORDER BY j.created_at DESC,j.id DESC LIMIT 1) job_status,
      (SELECT count(*)::integer FROM public.image_extraction_candidates c
       WHERE c.input_id=i.id) accepted_count
    FROM public.image_extraction_inputs i
    WHERE i.session_id=p_session_id
      AND i.quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'
  ), page AS (
    SELECT * FROM ranked WHERE p_cursor IS NULL OR (created_at,id)>(v_after_at,v_after_id)
    ORDER BY created_at,id LIMIT p_page_size+1
  ), sliced AS (SELECT * FROM page ORDER BY created_at,id LIMIT p_page_size)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'inputId',id,'ordinal',ordinal,'sourceKind',source_kind,'inputState',state,
      'inputVersion',version,
      'presentationState',CASE WHEN state IN ('uploaded','validating','queued') THEN 'checking_image'
        WHEN state='processing' THEN 'finding_books' WHEN state='ready' THEN 'ready'
        ELSE 'needs_attention' END,
      'safeCode',CASE WHEN state='failed' THEN validation_error_code ELSE NULL END,
      'retryState',CASE WHEN job_status='retry_scheduled' THEN 'server_retrying'
        WHEN state='failed' THEN 'new_upload_required' ELSE 'none' END,
      'terminal',state IN ('ready','failed','skipped'),
      'polling',state IN ('uploaded','validating','queued','processing'),
      'detectedCandidateCount',detected_candidate_count,
      'acceptedCandidateCount',accepted_count,'createdAt',created_at,'updatedAt',updated_at)
      ORDER BY created_at,id),'[]'::jsonb),
    (SELECT count(*)>p_page_size FROM page),
    (SELECT marketplace_sec.phase9_owner_ux_cursor(jsonb_build_object(
      'kind','inputs','actor',auth.uid(),'session',p_session_id,'size',p_page_size,
      'revision',v.presentation_revision,'contract','phase9-owner-ux-v1',
      'at',created_at,'id',id)) FROM sliced ORDER BY created_at DESC,id DESC LIMIT 1)
  INTO v_rows,v_has_more,v_next FROM sliced;
  IF NOT v_has_more THEN v_next:=NULL; END IF;
  RETURN jsonb_build_object('items',v_rows,'pageInfo',jsonb_build_object(
    'nextCursor',v_next,'hasMore',v_has_more),
    'sessionVersion',v.version,'presentationRevision',v.presentation_revision);
END;
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_issue_scan_upload(
  p_actor uuid,p_session_id uuid,p_source_kind text,p_declared_mime text,
  p_declared_bytes bigint,p_ordinal integer,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_session public.image_extraction_sessions; v_cap uuid; v_path text; v_replay jsonb;
  v_expiry timestamptz:=transaction_timestamp()+interval '10 minutes'; v_fingerprint text;
BEGIN
  PERFORM marketplace_sec.phase9_assert_actor_session_owner(p_actor,p_session_id);
  SELECT * INTO v_session FROM public.image_extraction_sessions s WHERE s.id=p_session_id FOR UPDATE;
  IF v_session.status<>'active' OR v_session.expires_at<=transaction_timestamp()
  THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  IF p_source_kind NOT IN ('camera','gallery') OR p_declared_mime NOT IN ('image/jpeg','image/png','image/webp')
    OR p_declared_bytes NOT BETWEEN 1 AND 10485760 OR p_ordinal<>1 THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=concat_ws('|',p_session_id,p_source_kind,p_declared_mime,p_declared_bytes,p_ordinal,p_command_id);
  v_replay:=marketplace_sec.phase9_replay(p_actor::text,'P9_INGEST_ISSUE',p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF EXISTS(
    SELECT 1 FROM public.image_extraction_inputs i
    WHERE i.session_id=p_session_id AND i.quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'
  ) OR EXISTS(
    SELECT 1 FROM public.phase9_upload_capabilities c
    WHERE c.bound_session_id=p_session_id AND c.purpose='scan_input'
      AND c.status='issued' AND c.expires_at>transaction_timestamp()
  ) THEN RAISE EXCEPTION 'P9_SINGLE_IMAGE_LIMIT'; END IF;
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
END;
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_scan_upload_completion(
  p_actor uuid,p_capability_id uuid,p_source_kind text,p_bucket text,p_path text,
  p_object_identity text,p_source_sha256 text,p_observed_mime text,p_observed_bytes bigint,
  p_orchestration_version text,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
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
  PERFORM marketplace_sec.phase9_assert_actor_session_owner(p_actor,v_cap.bound_session_id);
  SELECT * INTO v_session FROM public.image_extraction_sessions s
  WHERE s.id=v_cap.bound_session_id FOR UPDATE;
  IF v_session.store_id<>v_cap.store_id OR v_cap.bound_entity_id<>v_session.id
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  SELECT * INTO v_existing FROM public.image_extraction_inputs WHERE upload_capability_id=p_capability_id;
  IF v_cap.status='consumed' THEN
    IF v_existing.id IS NULL OR v_existing.source_kind<>p_source_kind
      OR v_existing.source_object_identity<>p_object_identity OR v_existing.source_sha256<>p_source_sha256
      OR v_existing.source_bytes<>p_observed_bytes OR v_existing.source_mime<>p_observed_mime
      OR v_cap.completion_canonical_response IS NULL THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
    RETURN v_cap.completion_canonical_response;
  END IF;
  IF v_cap.status<>'issued' OR v_cap.expires_at<=transaction_timestamp()
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.image_extraction_inputs i
    WHERE i.session_id=v_session.id AND i.quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'
  ) THEN RAISE EXCEPTION 'P9_SINGLE_IMAGE_LIMIT'; END IF;
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
  UPDATE public.image_extraction_sessions SET input_count=input_count+1,updated_at=transaction_timestamp()
  WHERE id=v_session.id;
  PERFORM marketplace_sec.phase9_finish_replay(p_actor::text,'P9_INGEST_COMPLETE',p_idempotency_key,
    v_response,'input_validation_job_created');
  RETURN v_response;
END;
$$;

ALTER FUNCTION public.phase9_remove_scan_input_v1(uuid,uuid,integer,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_discover_session_v1() OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_session_inputs_v1(uuid,integer,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_issue_scan_upload(uuid,uuid,text,text,bigint,integer,text,uuid) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_register_scan_upload_completion(uuid,uuid,text,text,text,text,text,text,bigint,text,text,uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.phase9_remove_scan_input_v1(uuid,uuid,integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase9_remove_scan_input_v1(uuid,uuid,integer,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.phase9_owner_discover_session_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase9_owner_discover_session_v1() TO authenticated;
REVOKE ALL ON FUNCTION public.phase9_owner_session_inputs_v1(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase9_owner_session_inputs_v1(uuid,integer,text) TO authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_issue_scan_upload(uuid,uuid,text,text,bigint,integer,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_issue_scan_upload(uuid,uuid,text,text,bigint,integer,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_scan_upload_completion(uuid,uuid,text,text,text,text,text,text,bigint,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_scan_upload_completion(uuid,uuid,text,text,text,text,text,text,bigint,text,text,uuid) TO service_role;

COMMIT;
