-- M60. Phase 9 duplicate input confirmation.
-- Forward-only replacement of terminal duplicate rejection. M52-M59 remain immutable.
BEGIN;

ALTER TABLE public.image_extraction_inputs
  ADD COLUMN duplicate_of_input_id uuid REFERENCES public.image_extraction_inputs(id);
ALTER TABLE public.image_extraction_inputs
  DROP CONSTRAINT image_extraction_inputs_store_id_sha256_orchestration_versi_key,
  DROP CONSTRAINT image_extraction_inputs_state_check,
  DROP CONSTRAINT phase9_input_validation_state_coherence;
ALTER TABLE public.image_extraction_inputs
  ADD CONSTRAINT image_extraction_inputs_state_check CHECK (state IN
    ('uploaded','validating','awaiting_duplicate_confirmation','queued','processing','ready','failed','skipped')),
  ADD CONSTRAINT phase9_input_validation_state_coherence CHECK (
    state IN ('uploaded','validating','failed')
    OR (state='awaiting_duplicate_confirmation' AND media_asset_id IS NULL AND sha256 IS NOT NULL
      AND duplicate_of_input_id IS NOT NULL AND validation_error_code='P9_MEDIA_DUPLICATE_INPUT')
    OR (state='skipped' AND quality_reason IN ('P9_OWNER_REMOVED','P9_DUPLICATE_CANCELLED','P9_DUPLICATE_EXPIRED'))
    OR (state IN ('queued','processing','ready','skipped') AND media_asset_id IS NOT NULL AND sha256 IS NOT NULL)
  );
CREATE UNIQUE INDEX phase9_input_canonical_sanitized_hash
  ON public.image_extraction_inputs(store_id,sha256,orchestration_version)
  WHERE sha256 IS NOT NULL AND duplicate_of_input_id IS NULL;

CREATE FUNCTION marketplace_sec.phase9_enforce_duplicate_input_relationship()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE canonical public.image_extraction_inputs;
BEGIN
  IF NEW.sha256 IS NULL THEN
    IF NEW.duplicate_of_input_id IS NOT NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.duplicate_of_input_id IS NULL THEN
    IF EXISTS(SELECT 1 FROM public.image_extraction_inputs d
      WHERE d.duplicate_of_input_id=NEW.id AND (d.store_id IS DISTINCT FROM NEW.store_id
        OR d.sha256 IS DISTINCT FROM NEW.sha256
        OR d.orchestration_version IS DISTINCT FROM NEW.orchestration_version))
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
    IF EXISTS(SELECT 1 FROM public.image_extraction_inputs i
      WHERE i.store_id=NEW.store_id AND i.sha256=NEW.sha256
        AND i.orchestration_version=NEW.orchestration_version
        AND i.duplicate_of_input_id IS NULL AND i.id<>NEW.id) THEN
      RAISE unique_violation USING CONSTRAINT='image_extraction_inputs_store_id_sha256_orchestration_versi_key';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.duplicate_of_input_id=NEW.id THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  SELECT * INTO canonical FROM public.image_extraction_inputs i
    WHERE i.id=NEW.duplicate_of_input_id FOR UPDATE;
  IF canonical.id IS NULL OR canonical.duplicate_of_input_id IS NOT NULL
    OR canonical.store_id IS DISTINCT FROM NEW.store_id
    OR canonical.sha256 IS DISTINCT FROM NEW.sha256
    OR canonical.orchestration_version IS DISTINCT FROM NEW.orchestration_version
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN NEW;
END$$;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_enforce_duplicate_input_relationship()
  FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER phase9_input_duplicate_relationship
  BEFORE INSERT OR UPDATE OF store_id,sha256,orchestration_version,duplicate_of_input_id
  ON public.image_extraction_inputs FOR EACH ROW
  EXECUTE FUNCTION marketplace_sec.phase9_enforce_duplicate_input_relationship();

CREATE FUNCTION marketplace_sec.phase9_fence_pending_duplicate_terminal_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.state='awaiting_duplicate_confirmation' AND NEW.state<>OLD.state
  AND NEW.quality_reason NOT IN ('P9_DUPLICATE_CANCELLED','P9_DUPLICATE_EXPIRED')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN NEW;
END$$;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_fence_pending_duplicate_terminal_change()
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER phase9_pending_duplicate_terminal_fence BEFORE UPDATE OF state
 ON public.image_extraction_inputs FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.phase9_fence_pending_duplicate_terminal_change();

CREATE TABLE marketplace_sec.phase9_duplicate_input_confirmations (
  input_id uuid PRIMARY KEY REFERENCES public.image_extraction_inputs(id),
  session_id uuid NOT NULL REFERENCES public.image_extraction_sessions(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  media_job_id uuid NOT NULL UNIQUE REFERENCES public.image_extraction_jobs(id),
  sanitized_intent_id uuid NOT NULL UNIQUE REFERENCES marketplace_sec.phase9_media_output_intents(id),
  canonical_input_id uuid NOT NULL REFERENCES public.image_extraction_inputs(id),
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  sanitized_sha256 text NOT NULL CHECK(sanitized_sha256~'^[0-9a-f]{64}$'),
  sanitized_bytes bigint NOT NULL CHECK(sanitized_bytes BETWEEN 1 AND 10485760),
  width integer NOT NULL CHECK(width BETWEEN 1 AND 8192),
  height integer NOT NULL CHECK(height BETWEEN 1 AND 8192),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','proceeded','cancelled','expired')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  expires_at timestamptz NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE INDEX phase9_duplicate_confirmation_expiry
  ON marketplace_sec.phase9_duplicate_input_confirmations(expires_at) WHERE state='pending';
ALTER TABLE marketplace_sec.phase9_duplicate_input_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketplace_sec.phase9_duplicate_input_confirmations FROM PUBLIC,anon,authenticated,service_role;

-- Keep the fully validated M58 completion implementation and translate only new
-- duplicate outcomes. Existing receipts are returned unchanged.
ALTER FUNCTION public.phase9_complete_media_validation_v2(
  uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer
) RENAME TO phase9_complete_media_validation_v2_duplicate_rejection_legacy;
REVOKE ALL ON FUNCTION public.phase9_complete_media_validation_v2_duplicate_rejection_legacy(
  uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer
) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.phase9_complete_media_validation_v2(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_source_identity text,
 p_source_sha256 text,p_snapshot_path text,p_target_path text,p_sha256 text,p_bytes bigint,p_width integer,p_height integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; receipt marketplace_sec.phase9_media_completion_receipts;
 v_result jsonb; i public.image_extraction_inputs; s public.image_extraction_sessions;
 intent marketplace_sec.phase9_media_output_intents; canonical public.image_extraction_inputs;
 v_canonical_id uuid; command jsonb; constraint_name text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
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
 BEGIN
  v_result:=public.phase9_complete_media_validation_v2_duplicate_rejection_legacy(
   p_job_id,p_worker,p_lease_token,p_attempt_count,p_source_identity,p_source_sha256,
   p_snapshot_path,p_target_path,p_sha256,p_bytes,p_width,p_height);
 EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS constraint_name=CONSTRAINT_NAME;
  IF constraint_name IS DISTINCT FROM 'phase9_input_canonical_sanitized_hash' OR j.entity_type<>'input' THEN RAISE; END IF;
  UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_expires_at=NULL,
   lease_token_hash=NULL,last_safe_error_category='media_validation',
   last_safe_error_code='P9_MEDIA_DUPLICATE_INPUT',completed_at=transaction_timestamp(),
   updated_at=transaction_timestamp() WHERE id=j.id;
  v_result:=jsonb_build_object('state','duplicate_rejected','safe_error_code','P9_MEDIA_DUPLICATE_INPUT','input_id',j.entity_id);
 END;
 IF v_result->>'state'<>'duplicate_rejected' THEN RETURN v_result; END IF;

 SELECT * INTO i FROM public.image_extraction_inputs WHERE id=j.entity_id;
 SELECT * INTO intent FROM marketplace_sec.phase9_media_output_intents x
  WHERE x.job_id=j.id AND x.attempt_count=p_attempt_count AND x.output_kind='sanitized' FOR UPDATE;
 SELECT * INTO canonical FROM public.image_extraction_inputs x
  WHERE x.store_id=i.store_id AND x.sha256=p_sha256 AND x.orchestration_version=i.orchestration_version
    AND x.duplicate_of_input_id IS NULL AND x.id<>i.id ORDER BY x.id LIMIT 1;
 v_canonical_id:=canonical.id;
 PERFORM 1 FROM public.image_extraction_inputs x WHERE x.id IN(i.id,v_canonical_id) ORDER BY x.id FOR UPDATE;
 SELECT * INTO i FROM public.image_extraction_inputs WHERE id=j.entity_id;
 SELECT * INTO canonical FROM public.image_extraction_inputs x WHERE x.id=v_canonical_id;
 SELECT * INTO s FROM public.image_extraction_sessions WHERE id=i.session_id FOR UPDATE;
 IF canonical.id IS NULL OR intent.id IS NULL OR s.status<>'active' OR s.expires_at<=transaction_timestamp()
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 UPDATE public.image_extraction_inputs SET state='awaiting_duplicate_confirmation',sha256=p_sha256,
  duplicate_of_input_id=canonical.id,validation_error_code='P9_MEDIA_DUPLICATE_INPUT',
  version=version+1,updated_at=transaction_timestamp() WHERE id=i.id RETURNING * INTO i;
 INSERT INTO marketplace_sec.phase9_duplicate_input_confirmations(input_id,session_id,store_id,
  media_job_id,sanitized_intent_id,canonical_input_id,bucket_id,object_path,sanitized_sha256,
  sanitized_bytes,width,height,expires_at)
 VALUES(i.id,s.id,s.store_id,j.id,intent.id,canonical.id,intent.bucket_id,intent.object_path,
  p_sha256,p_bytes,p_width,p_height,s.expires_at);
 UPDATE marketplace_sec.phase9_media_output_intents SET next_cleanup_at=s.expires_at,
  updated_at=transaction_timestamp() WHERE id=intent.id;
 v_result:=jsonb_build_object('state','confirmation_required','safe_error_code','P9_MEDIA_DUPLICATE_INPUT',
  'input_id',i.id);
 INSERT INTO marketplace_sec.phase9_media_completion_receipts(job_id,store_id,command,result)
 VALUES(j.id,j.store_id,command,v_result)
 ON CONFLICT(job_id) DO UPDATE SET result=excluded.result;
 RETURN v_result;
END$$;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_complete_media_validation(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_source_identity text,
 p_source_sha256 text,p_snapshot_path text,p_target_path text,p_sha256 text,p_bytes bigint,p_width integer,p_height integer
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.phase9_complete_media_validation_v2(p_job_id,p_worker,p_lease_token,p_attempt_count,
 p_source_identity,p_source_sha256,p_snapshot_path,p_target_path,p_sha256,p_bytes,p_width,p_height)
$$;

-- Preflight is intentionally read-only: only the resolver claims a new
-- idempotency key. This lets a first request verify Storage and then call the
-- resolver with the same key without manufacturing a pending replay row.
CREATE FUNCTION marketplace_sec.phase9_peek_duplicate_resolution_replay(
 p_actor text,p_operation text,p_key text,p_fingerprint text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.phase9_idempotency_keys;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 SELECT * INTO v FROM public.phase9_idempotency_keys
  WHERE actor_or_service=p_actor AND operation=p_operation AND idempotency_key=p_key;
 IF v.id IS NULL THEN RETURN NULL; END IF;
 IF v.request_fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
 IF v.status='completed' THEN RETURN v.canonical_response; END IF;
 RETURN NULL;
END$$;

CREATE FUNCTION marketplace_sec.phase9_duplicate_resolution_context(
 p_actor uuid,p_session_id uuid,p_input_id uuid,p_decision text,p_expected_input_version integer,
 p_expected_confirmation_version integer,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.image_extraction_inputs; s public.image_extraction_sessions;
 c marketplace_sec.phase9_duplicate_input_confirmations; replay jsonb; fingerprint text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_decision NOT IN ('cancel','proceed')
  OR p_expected_input_version<1 OR p_expected_confirmation_version<1 OR p_command_id IS NULL
  OR p_idempotency_key IS NULL OR char_length(p_idempotency_key) NOT BETWEEN 16 AND 128
 THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 fingerprint:=concat_ws('|',p_session_id,p_input_id,p_decision,p_expected_input_version,
  p_expected_confirmation_version,p_command_id);
 replay:=marketplace_sec.phase9_peek_duplicate_resolution_replay(p_actor::text,'P9_OWNER_DUPLICATE_INPUT',p_idempotency_key,fingerprint);
 IF replay IS NOT NULL THEN RETURN jsonb_build_object('replay',true,'response',replay); END IF;
 PERFORM marketplace_sec.phase9_assert_actor_session_owner(p_actor,p_session_id);
 SELECT * INTO i FROM public.image_extraction_inputs WHERE id=p_input_id AND session_id=p_session_id;
 SELECT * INTO s FROM public.image_extraction_sessions WHERE id=p_session_id;
 SELECT * INTO c FROM marketplace_sec.phase9_duplicate_input_confirmations WHERE input_id=p_input_id;
 IF i.id IS NULL OR c.input_id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
 IF s.status<>'active' OR s.expires_at<=transaction_timestamp() OR c.state<>'pending'
  OR i.state<>'awaiting_duplicate_confirmation' OR i.version<>p_expected_input_version
  OR c.version<>p_expected_confirmation_version THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN jsonb_build_object('replay',false,'bucket_id',c.bucket_id,'object_path',c.object_path,
  'sha256',c.sanitized_sha256,'bytes',c.sanitized_bytes,'mime','image/webp');
END$$;

CREATE FUNCTION marketplace_sec.phase9_resolve_duplicate_scan_input(
 p_actor uuid,p_session_id uuid,p_input_id uuid,p_decision text,p_expected_input_version integer,
 p_expected_confirmation_version integer,p_idempotency_key text,p_command_id uuid,
 p_observed_object_identity text DEFAULT NULL,p_observed_sha256 text DEFAULT NULL,
 p_observed_bytes bigint DEFAULT NULL,p_observed_mime text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.image_extraction_inputs; canonical public.image_extraction_inputs;
 s public.image_extraction_sessions; c marketplace_sec.phase9_duplicate_input_confirmations;
 intent marketplace_sec.phase9_media_output_intents; j public.image_extraction_jobs;
 replay jsonb; response jsonb; fingerprint text; media_id uuid; vision_id uuid;
 session_version integer; v_presentation_revision integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL OR p_decision NOT IN ('cancel','proceed')
 THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 fingerprint:=concat_ws('|',p_session_id,p_input_id,p_decision,p_expected_input_version,
  p_expected_confirmation_version,p_command_id);
 replay:=marketplace_sec.phase9_replay(p_actor::text,'P9_OWNER_DUPLICATE_INPUT',p_idempotency_key,fingerprint);
 IF replay IS NOT NULL THEN RETURN replay; END IF;
 PERFORM marketplace_sec.phase9_assert_actor_session_owner(p_actor,p_session_id);
 SELECT * INTO c FROM marketplace_sec.phase9_duplicate_input_confirmations WHERE input_id=p_input_id;
 IF c.input_id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=c.media_job_id FOR UPDATE;
 SELECT * INTO intent FROM marketplace_sec.phase9_media_output_intents WHERE id=c.sanitized_intent_id FOR UPDATE;
 -- Same-table rows lock in UUID order; relationship and media-path triggers reuse these locks.
 PERFORM 1 FROM public.image_extraction_inputs x WHERE x.id IN (p_input_id,c.canonical_input_id) ORDER BY x.id FOR UPDATE;
 SELECT * INTO i FROM public.image_extraction_inputs WHERE id=p_input_id;
 SELECT * INTO canonical FROM public.image_extraction_inputs WHERE id=c.canonical_input_id;
 SELECT * INTO s FROM public.image_extraction_sessions WHERE id=p_session_id FOR UPDATE;
 SELECT * INTO c FROM marketplace_sec.phase9_duplicate_input_confirmations WHERE input_id=p_input_id FOR UPDATE;
 IF s.status<>'active' OR s.expires_at<=transaction_timestamp() OR c.state<>'pending'
  OR i.state<>'awaiting_duplicate_confirmation' OR i.version<>p_expected_input_version
  OR c.version<>p_expected_confirmation_version OR i.store_id<>s.store_id OR c.store_id<>s.store_id
  OR canonical.id IS NULL OR canonical.store_id<>s.store_id OR canonical.sha256<>c.sanitized_sha256
  OR canonical.orchestration_version<>i.orchestration_version OR canonical.duplicate_of_input_id IS NOT NULL
  OR intent.state<>'pending' OR intent.bucket_id<>c.bucket_id OR intent.object_path<>c.object_path
  OR c.bucket_id<>'image-extraction-inputs'
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

 IF p_decision='proceed' THEN
  IF p_observed_object_identity IS NULL OR p_observed_object_identity!~'^[0-9a-f]{64}$'
   OR p_observed_sha256 IS DISTINCT FROM c.sanitized_sha256
   OR p_observed_bytes IS DISTINCT FROM c.sanitized_bytes OR p_observed_mime IS DISTINCT FROM 'image/webp'
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  INSERT INTO public.media_assets(store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
   detected_mime,bytes,width,height,validation_version,validated_at,reencode_version,exif_strip_version,
   session_id,retention_class,lifecycle_status)
  VALUES(s.store_id,s.created_by,'scan_input','private_scan',c.bucket_id,c.object_path,c.sanitized_sha256,
   'image/webp',c.sanitized_bytes,c.width,c.height,'phase9-media-v1',transaction_timestamp(),
   'magick-wasm-0.0.41-webp','magick-wasm-0.0.41-strip',s.id,'phase9-private-scan','linked')
  ON CONFLICT(bucket_id,object_path) DO NOTHING RETURNING id INTO media_id;
  IF media_id IS NULL THEN
   SELECT id INTO media_id FROM public.media_assets m WHERE m.bucket_id=c.bucket_id AND m.object_path=c.object_path
    AND m.store_id=s.store_id AND m.uploaded_by=s.created_by AND m.sha256=c.sanitized_sha256
    AND m.bytes=c.sanitized_bytes AND m.detected_mime='image/webp' AND m.session_id=s.id
    AND m.purpose='scan_input' AND m.privacy_class='private_scan' AND m.lifecycle_status='linked';
   IF media_id IS NULL THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  END IF;
  UPDATE public.image_extraction_inputs SET media_asset_id=media_id,state='queued',validation_error_code=NULL,
   version=version+1,updated_at=transaction_timestamp() WHERE id=i.id RETURNING * INTO i;
  UPDATE public.phase9_upload_capabilities SET consumed_media_asset_id=media_id,updated_at=transaction_timestamp()
   WHERE id=i.upload_capability_id AND consumed_media_asset_id IS NULL;
  INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
   VALUES(s.store_id,'input',i.id,'vision_extract','vision:'||i.id::text,i.orchestration_version)
   ON CONFLICT(dedupe_key) DO NOTHING RETURNING id INTO vision_id;
  IF vision_id IS NULL THEN SELECT id INTO vision_id FROM public.image_extraction_jobs WHERE dedupe_key='vision:'||i.id::text; END IF;
  PERFORM marketplace_sec.phase9_ensure_vision_usage_reservation(vision_id);
  UPDATE marketplace_sec.phase9_media_output_intents SET state='accepted',updated_at=transaction_timestamp()
   WHERE id=intent.id;
  UPDATE marketplace_sec.phase9_duplicate_input_confirmations SET state='proceeded',version=version+1,
   resolved_at=transaction_timestamp(),updated_at=transaction_timestamp() WHERE input_id=i.id;
 ELSE
  UPDATE public.image_extraction_inputs SET state='skipped',quality_result='owner_cancelled',
   quality_reason='P9_DUPLICATE_CANCELLED',validation_error_code=NULL,processed_at=transaction_timestamp(),
   delete_after=transaction_timestamp()+interval '24 hours',version=version+1,updated_at=transaction_timestamp()
   WHERE id=i.id RETURNING * INTO i;
  UPDATE marketplace_sec.phase9_media_output_intents SET next_cleanup_at=transaction_timestamp(),
   updated_at=transaction_timestamp() WHERE id=intent.id;
  UPDATE marketplace_sec.phase9_duplicate_input_confirmations SET state='cancelled',version=version+1,
   resolved_at=transaction_timestamp(),updated_at=transaction_timestamp() WHERE input_id=i.id;
 END IF;
 UPDATE public.image_extraction_sessions x SET version=x.version+1,presentation_revision=x.presentation_revision+1,
  updated_at=transaction_timestamp() WHERE x.id=s.id RETURNING x.version,x.presentation_revision
  INTO session_version,v_presentation_revision;
 response:=jsonb_build_object('sessionId',s.id,'inputId',i.id,'decision',p_decision,
  'outcome',CASE WHEN p_decision='proceed' THEN 'processing_started' ELSE 'cancelled' END,
  'inputState',i.state,'inputVersion',i.version,'sessionVersion',session_version,
  'presentationRevision',v_presentation_revision);
 PERFORM marketplace_sec.phase9_finish_replay(p_actor::text,'P9_OWNER_DUPLICATE_INPUT',
  p_idempotency_key,response,CASE WHEN p_decision='proceed' THEN 'vision_job_created' ELSE 'input_cancelled' END);
 RETURN response;
END$$;

-- Owner projection carries only safe confirmation authority, never hash/path/canonical ids.
CREATE OR REPLACE FUNCTION public.phase9_owner_session_inputs_v1(
 p_session_id uuid,p_page_size integer DEFAULT 20,p_cursor text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.image_extraction_sessions; v_payload jsonb; v_after_at timestamptz;
 v_after_id uuid; v_rows jsonb; v_has_more boolean; v_next text;
BEGIN
 v:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
 IF p_page_size NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 IF p_cursor IS NOT NULL THEN
  BEGIN
   v_payload:=marketplace_sec.phase9_owner_ux_cursor_payload(p_cursor);
   IF v_payload->>'kind'<>'inputs' OR (v_payload->>'actor')::uuid<>auth.uid()
    OR (v_payload->>'session')::uuid<>p_session_id OR (v_payload->>'size')::integer<>p_page_size
    OR (v_payload->>'revision')::integer<>v.presentation_revision OR v_payload->>'contract'<>'phase9-owner-ux-v1'
   THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
   v_after_at:=(v_payload->>'at')::timestamptz; v_after_id:=(v_payload->>'id')::uuid;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END;
 END IF;
 WITH ranked AS (
  SELECT i.*,row_number() OVER(ORDER BY i.created_at,i.id)::integer ordinal,
   (SELECT j.status FROM public.image_extraction_jobs j WHERE j.entity_type='input' AND j.entity_id=i.id
    ORDER BY j.created_at DESC,j.id DESC LIMIT 1) job_status,
   (SELECT count(*)::integer FROM public.image_extraction_candidates c WHERE c.input_id=i.id) accepted_count,
   dc.version confirmation_version,dc.expires_at confirmation_expires_at
  FROM public.image_extraction_inputs i LEFT JOIN marketplace_sec.phase9_duplicate_input_confirmations dc
   ON dc.input_id=i.id AND dc.state='pending'
  WHERE i.session_id=p_session_id AND i.quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'
 ), page AS (SELECT * FROM ranked WHERE p_cursor IS NULL OR (created_at,id)>(v_after_at,v_after_id)
  ORDER BY created_at,id LIMIT p_page_size+1), sliced AS (SELECT * FROM page ORDER BY created_at,id LIMIT p_page_size)
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'inputId',id,'ordinal',ordinal,'sourceKind',source_kind,'inputState',state,'inputVersion',version,
  'presentationState',CASE WHEN state='awaiting_duplicate_confirmation' THEN 'duplicate_confirmation_required'
   WHEN state IN ('uploaded','validating','queued') THEN 'checking_image' WHEN state='processing' THEN 'finding_books'
   WHEN state='ready' THEN 'ready' ELSE 'needs_attention' END,
  'safeCode',CASE WHEN state IN ('failed','awaiting_duplicate_confirmation') THEN validation_error_code ELSE NULL END,
  'retryState',CASE WHEN job_status='retry_scheduled' THEN 'server_retrying' WHEN state='failed' THEN 'new_upload_required' ELSE 'none' END,
  'terminal',state IN ('ready','failed','skipped'),'polling',state IN ('uploaded','validating','queued','processing'),
  'detectedCandidateCount',detected_candidate_count,'acceptedCandidateCount',accepted_count,
  'duplicateConfirmationVersion',confirmation_version,'duplicateConfirmationExpiresAt',confirmation_expires_at,
  'createdAt',created_at,'updatedAt',updated_at) ORDER BY created_at,id),'[]'::jsonb),
  (SELECT count(*)>p_page_size FROM page),
  (SELECT marketplace_sec.phase9_owner_ux_cursor(jsonb_build_object('kind','inputs','actor',auth.uid(),
   'session',p_session_id,'size',p_page_size,'revision',v.presentation_revision,'contract','phase9-owner-ux-v1',
   'at',created_at,'id',id)) FROM sliced ORDER BY created_at DESC,id DESC LIMIT 1)
 INTO v_rows,v_has_more,v_next FROM sliced;
 IF NOT v_has_more THEN v_next:=NULL; END IF;
 RETURN jsonb_build_object('items',v_rows,'pageInfo',jsonb_build_object('nextCursor',v_next,'hasMore',v_has_more),
  'sessionVersion',v.version,'presentationRevision',v.presentation_revision);
END$$;

-- Expiry follows the existing session deadline. Lock order is job -> intent ->
-- input rows (UUID order) -> session -> confirmation.
CREATE FUNCTION marketplace_sec.phase9_expire_duplicate_confirmations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c marketplace_sec.phase9_duplicate_input_confirmations; n integer:=0; changed integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 FOR c IN SELECT x.* FROM marketplace_sec.phase9_duplicate_input_confirmations x
  WHERE x.state='pending' AND x.expires_at<=transaction_timestamp() ORDER BY x.media_job_id LOOP
  PERFORM 1 FROM public.image_extraction_jobs WHERE id=c.media_job_id FOR UPDATE;
  PERFORM 1 FROM marketplace_sec.phase9_media_output_intents WHERE id=c.sanitized_intent_id FOR UPDATE;
  PERFORM 1 FROM public.image_extraction_inputs WHERE id IN(c.input_id,c.canonical_input_id) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.image_extraction_sessions WHERE id=c.session_id FOR UPDATE;
  PERFORM 1 FROM marketplace_sec.phase9_duplicate_input_confirmations WHERE input_id=c.input_id FOR UPDATE;
  UPDATE public.image_extraction_inputs SET state='skipped',quality_result='expired',quality_reason='P9_DUPLICATE_EXPIRED',
   validation_error_code=NULL,processed_at=transaction_timestamp(),delete_after=transaction_timestamp(),
   version=version+1,updated_at=transaction_timestamp()
   WHERE id=c.input_id AND state='awaiting_duplicate_confirmation';
      UPDATE marketplace_sec.phase9_duplicate_input_confirmations SET state='expired',version=version+1,
       resolved_at=transaction_timestamp(),updated_at=transaction_timestamp() WHERE input_id=c.input_id AND state='pending';
      GET DIAGNOSTICS changed=ROW_COUNT;
      UPDATE marketplace_sec.phase9_media_output_intents SET next_cleanup_at=transaction_timestamp(),updated_at=transaction_timestamp()
       WHERE id=c.sanitized_intent_id;
      n:=n+changed;
 END LOOP;
 RETURN n;
END$$;

-- Existing cleanup definitions remain authoritative, with an atomic expiry pass
-- and a hard exclusion for still-pending confirmations.
ALTER FUNCTION public.claim_phase9_media_output_cleanup_jobs(integer,text)
 RENAME TO claim_phase9_media_output_cleanup_jobs_m59;
CREATE FUNCTION public.claim_phase9_media_output_cleanup_jobs(p_batch_size integer,p_worker text)
RETURNS TABLE(intent_id uuid,bucket_id text,object_path text,lease_token text,attempt_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; r marketplace_sec.phase9_media_output_intents;
 token text; n integer:=0; protected boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker IS NULL OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
  OR p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 PERFORM marketplace_sec.phase9_expire_duplicate_confirmations();
 FOR j IN SELECT jobs.* FROM public.image_extraction_jobs jobs WHERE EXISTS(
  SELECT 1 FROM marketplace_sec.phase9_media_output_intents x WHERE x.job_id=jobs.id AND x.state<>'accepted'
   AND x.cleanup_status<>'manual_reconciliation' AND x.next_cleanup_at<=transaction_timestamp()
   AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_duplicate_input_confirmations c
    WHERE c.sanitized_intent_id=x.id AND c.state='pending')
   AND (x.cleanup_status<>'leased' OR x.cleanup_expires_at<=transaction_timestamp())
   AND (x.state='delete_reserved' OR jobs.status<>'in_progress' OR jobs.attempt_count<>x.attempt_count
    OR jobs.lease_token_hash IS DISTINCT FROM x.claim_hash OR jobs.lease_expires_at<=transaction_timestamp()))
  ORDER BY jobs.id FOR UPDATE SKIP LOCKED LOOP
  FOR r IN SELECT x.* FROM marketplace_sec.phase9_media_output_intents x WHERE x.job_id=j.id AND x.state<>'accepted'
   AND x.cleanup_status<>'manual_reconciliation' AND x.next_cleanup_at<=transaction_timestamp()
   AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_duplicate_input_confirmations c
    WHERE c.sanitized_intent_id=x.id AND c.state='pending')
   AND (x.cleanup_status<>'leased' OR x.cleanup_expires_at<=transaction_timestamp())
   AND (x.state='delete_reserved' OR j.status<>'in_progress' OR j.attempt_count<>x.attempt_count
    OR j.lease_token_hash IS DISTINCT FROM x.claim_hash OR j.lease_expires_at<=transaction_timestamp())
   ORDER BY x.id FOR UPDATE SKIP LOCKED LOOP
   SELECT EXISTS(SELECT 1 FROM public.media_assets m WHERE m.bucket_id=r.bucket_id AND m.object_path=r.object_path)
    OR EXISTS(SELECT 1 FROM public.image_extraction_inputs i WHERE i.source_snapshot_bucket=r.bucket_id AND i.source_snapshot_path=r.object_path)
    OR (r.bucket_id='image-extraction-inputs' AND EXISTS(SELECT 1 FROM public.phase9_upload_capabilities c
      WHERE c.completion_canonical_response->>'snapshot_path'=r.object_path)) INTO protected;
   IF protected THEN
    UPDATE marketplace_sec.phase9_media_output_intents SET state=CASE WHEN state='delete_reserved' THEN state ELSE 'accepted' END,
     cleanup_status=CASE WHEN state='delete_reserved' THEN 'manual_reconciliation' ELSE cleanup_status END,
     updated_at=transaction_timestamp() WHERE id=r.id;
    CONTINUE;
   END IF;
   IF r.cleanup_status='leased' THEN r.cleanup_failures:=r.cleanup_failures+1; END IF;
   IF r.cleanup_failures>=5 THEN
    UPDATE marketplace_sec.phase9_media_output_intents SET cleanup_status='manual_reconciliation',
     cleanup_failures=r.cleanup_failures,last_cleanup_outcome='acknowledgment_unknown',updated_at=transaction_timestamp()
     WHERE id=r.id;
    CONTINUE;
   END IF;
   token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
   UPDATE marketplace_sec.phase9_media_output_intents SET state='delete_reserved',cleanup_status='leased',
    cleanup_attempt_count=cleanup_attempt_count+1,cleanup_failures=r.cleanup_failures,cleanup_worker=p_worker,
    cleanup_token_hash=encode(extensions.digest(token,'sha256'),'hex'),
    cleanup_expires_at=transaction_timestamp()+interval '2 minutes',updated_at=transaction_timestamp()
    WHERE id=r.id RETURNING cleanup_attempt_count INTO attempt_count;
   intent_id:=r.id; bucket_id:=r.bucket_id; object_path:=r.object_path; lease_token:=token; RETURN NEXT;
   n:=n+1; IF n>=p_batch_size THEN RETURN; END IF;
  END LOOP;
 END LOOP;
END$$;
ALTER FUNCTION public.phase9_finish_media_output_cleanup(uuid,text,text,integer,text)
 RENAME TO phase9_finish_media_output_cleanup_m59;
CREATE FUNCTION public.phase9_finish_media_output_cleanup(p_intent_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_outcome text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job_id uuid;
BEGIN
 SELECT x.job_id INTO v_job_id FROM marketplace_sec.phase9_media_output_intents x WHERE x.id=p_intent_id;
 PERFORM 1 FROM public.image_extraction_jobs WHERE id=v_job_id FOR UPDATE;
 PERFORM 1 FROM marketplace_sec.phase9_media_output_intents WHERE id=p_intent_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM marketplace_sec.phase9_duplicate_input_confirmations c
  WHERE c.sanitized_intent_id=p_intent_id AND c.state='pending') THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN public.phase9_finish_media_output_cleanup_m59(p_intent_id,p_worker,p_lease_token,p_attempt_count,p_outcome);
END$$;
CREATE OR REPLACE FUNCTION marketplace_sec.has_claimable_phase9_work(p_job_kind text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_job_kind NOT IN ('media_validate_sanitize','vision_extract','metadata_enrich','publication_retry')
 THEN RAISE EXCEPTION 'P9_DISPATCH_KIND_INVALID'; END IF;
 RETURN EXISTS(SELECT 1 FROM public.image_extraction_jobs j WHERE j.job_kind=p_job_kind
  AND j.status IN ('open','retry_scheduled','in_progress') AND j.next_attempt_at<=transaction_timestamp()
  AND (j.status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp()) AND j.attempt_count<j.max_attempts)
 OR (p_job_kind='media_validate_sanitize' AND EXISTS(SELECT 1
  FROM marketplace_sec.phase9_media_output_intents x JOIN public.image_extraction_jobs j ON j.id=x.job_id
  WHERE x.state<>'accepted' AND x.cleanup_status<>'manual_reconciliation' AND x.next_cleanup_at<=transaction_timestamp()
   AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_duplicate_input_confirmations c
    WHERE c.sanitized_intent_id=x.id AND c.state='pending' AND c.expires_at>transaction_timestamp())
   AND (x.cleanup_status<>'leased' OR x.cleanup_expires_at<=transaction_timestamp())
   AND (x.state='delete_reserved' OR j.status<>'in_progress' OR j.attempt_count<>x.attempt_count
    OR j.lease_token_hash IS DISTINCT FROM x.claim_hash OR j.lease_expires_at<=transaction_timestamp())));
END$$;
CREATE OR REPLACE FUNCTION public.phase9_media_output_cleanup_health() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 SELECT jsonb_build_object('manual_reconciliation',count(*) FILTER(WHERE x.cleanup_status='manual_reconciliation'),
  'protected_pending_confirmation',count(*) FILTER(WHERE c.state='pending' AND c.expires_at>transaction_timestamp()),
  'due_count',count(*) FILTER(WHERE x.cleanup_status<>'manual_reconciliation' AND x.next_cleanup_at<=transaction_timestamp()
   AND (c.input_id IS NULL OR c.state<>'pending' OR c.expires_at<=transaction_timestamp())),
  'oldest_due_seconds',coalesce(max(greatest(0,extract(epoch FROM transaction_timestamp()-x.next_cleanup_at)))
   FILTER(WHERE x.cleanup_status<>'manual_reconciliation' AND x.next_cleanup_at<=transaction_timestamp()
    AND (c.input_id IS NULL OR c.state<>'pending' OR c.expires_at<=transaction_timestamp())),0)) INTO result
 FROM marketplace_sec.phase9_media_output_intents x JOIN public.image_extraction_jobs j ON j.id=x.job_id
 LEFT JOIN marketplace_sec.phase9_duplicate_input_confirmations c ON c.sanitized_intent_id=x.id
 WHERE x.state<>'accepted' AND (x.state='delete_reserved' OR j.status<>'in_progress' OR j.attempt_count<>x.attempt_count
  OR j.lease_token_hash IS DISTINCT FROM x.claim_hash OR j.lease_expires_at<=transaction_timestamp());
 RETURN result;
END$$;

ALTER FUNCTION public.phase9_complete_media_validation_v2(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_duplicate_resolution_context(uuid,uuid,uuid,text,integer,integer,text,uuid) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_peek_duplicate_resolution_replay(text,text,text,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_resolve_duplicate_scan_input(uuid,uuid,uuid,text,integer,integer,text,uuid,text,text,bigint,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_expire_duplicate_confirmations() OWNER TO postgres;
ALTER FUNCTION public.phase9_owner_session_inputs_v1(uuid,integer,text) OWNER TO postgres;
ALTER FUNCTION public.claim_phase9_media_output_cleanup_jobs(integer,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_finish_media_output_cleanup(uuid,text,text,integer,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.has_claimable_phase9_work(text) OWNER TO postgres;
ALTER FUNCTION public.phase9_media_output_cleanup_health() OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_duplicate_resolution_context(uuid,uuid,uuid,text,integer,integer,text,uuid),
 marketplace_sec.phase9_peek_duplicate_resolution_replay(text,text,text,text),
 marketplace_sec.phase9_resolve_duplicate_scan_input(uuid,uuid,uuid,text,integer,integer,text,uuid,text,text,bigint,text),
 marketplace_sec.phase9_expire_duplicate_confirmations() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_duplicate_resolution_context(uuid,uuid,uuid,text,integer,integer,text,uuid),
 marketplace_sec.phase9_peek_duplicate_resolution_replay(text,text,text,text),
 marketplace_sec.phase9_resolve_duplicate_scan_input(uuid,uuid,uuid,text,integer,integer,text,uuid,text,text,bigint,text),
 marketplace_sec.phase9_expire_duplicate_confirmations() TO service_role;
REVOKE ALL ON FUNCTION public.phase9_complete_media_validation_v2(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer),
 public.claim_phase9_media_output_cleanup_jobs(integer,text),public.phase9_finish_media_output_cleanup(uuid,text,text,integer,text),
 public.phase9_media_output_cleanup_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_complete_media_validation_v2(uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer),
 public.claim_phase9_media_output_cleanup_jobs(integer,text),public.phase9_finish_media_output_cleanup(uuid,text,text,integer,text),
 public.phase9_media_output_cleanup_health() TO service_role;
REVOKE ALL ON FUNCTION public.claim_phase9_media_output_cleanup_jobs_m59(integer,text),
 public.phase9_finish_media_output_cleanup_m59(uuid,text,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;

-- PostgREST exposes public, not marketplace_sec. Match the M13 service-only
-- invoker delegate boundary without exposing the private schema to clients.
CREATE FUNCTION public.phase9_duplicate_resolution_context(
 p_actor uuid,p_session_id uuid,p_input_id uuid,p_decision text,p_expected_input_version integer,
 p_expected_confirmation_version integer,p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_duplicate_resolution_context(
  p_actor,p_session_id,p_input_id,p_decision,p_expected_input_version,
  p_expected_confirmation_version,p_idempotency_key,p_command_id)
$$;
CREATE FUNCTION public.phase9_resolve_duplicate_scan_input(
 p_actor uuid,p_session_id uuid,p_input_id uuid,p_decision text,p_expected_input_version integer,
 p_expected_confirmation_version integer,p_idempotency_key text,p_command_id uuid,
 p_observed_object_identity text DEFAULT NULL,p_observed_sha256 text DEFAULT NULL,
 p_observed_bytes bigint DEFAULT NULL,p_observed_mime text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_resolve_duplicate_scan_input(
  p_actor,p_session_id,p_input_id,p_decision,p_expected_input_version,
  p_expected_confirmation_version,p_idempotency_key,p_command_id,
  p_observed_object_identity,p_observed_sha256,p_observed_bytes,p_observed_mime)
$$;
ALTER FUNCTION public.phase9_duplicate_resolution_context(uuid,uuid,uuid,text,integer,integer,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_resolve_duplicate_scan_input(uuid,uuid,uuid,text,integer,integer,text,uuid,text,text,bigint,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_duplicate_resolution_context(uuid,uuid,uuid,text,integer,integer,text,uuid),
 public.phase9_resolve_duplicate_scan_input(uuid,uuid,uuid,text,integer,integer,text,uuid,text,text,bigint,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_duplicate_resolution_context(uuid,uuid,uuid,text,integer,integer,text,uuid),
 public.phase9_resolve_duplicate_scan_input(uuid,uuid,uuid,text,integer,integer,text,uuid,text,text,bigint,text)
 TO service_role;

COMMIT;
