-- Phase 9 Unit 4B: durable vision-provider spend lineage and final egress fence.
-- Forward-only additive migration. This file is not authorization to apply it.
BEGIN;

CREATE TABLE public.vision_provider_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_call_id uuid NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  job_id uuid NOT NULL REFERENCES public.image_extraction_jobs(id),
  correlation_id uuid NOT NULL,
  claim_attempt_number integer NOT NULL CHECK (claim_attempt_number BETWEEN 1 AND 5),
  claim_worker text NOT NULL CHECK (claim_worker ~ '^[A-Za-z0-9._:-]{16,128}$'),
  claim_lease_token_hash text NOT NULL CHECK (claim_lease_token_hash ~ '^[0-9a-f]{64}$'),
  usage_reservation_id uuid NOT NULL REFERENCES public.phase9_usage_reservations(id),
  provider_role text NOT NULL CHECK (provider_role IN ('primary','approved_fallback')),
  provider_key text NOT NULL,
  adapter_key text NOT NULL,
  adapter_version text NOT NULL,
  model_key text NOT NULL,
  model_version text NOT NULL,
  prompt_version text NOT NULL,
  schema_version text NOT NULL,
  spend_identity text NOT NULL CHECK (spend_identity ~ '^[0-9a-f]{64}$'),
  provider_request_id text,
  started_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  completed_at timestamptz,
  normalized_outcome text,
  prompt_tokens integer CHECK (prompt_tokens BETWEEN 0 AND 1000000000),
  output_tokens integer CHECK (output_tokens BETWEEN 0 AND 1000000000),
  total_tokens integer CHECK (total_tokens BETWEEN 0 AND 1000000000),
  cached_tokens integer CHECK (cached_tokens BETWEEN 0 AND 1000000000),
  thinking_tokens integer CHECK (thinking_tokens BETWEEN 0 AND 1000000000),
  pricing_policy_version text,
  pricing_input jsonb,
  calculated_cost_units numeric CHECK (
    calculated_cost_units IS NULL OR calculated_cost_units BETWEEN 0 AND 1000000000
  ),
  disposition text NOT NULL DEFAULT 'registered' CHECK (disposition IN
    ('registered','response_received','accepted','stale_rejected','failed','outcome_unknown')),
  analysis_result_id uuid REFERENCES public.image_analysis_results(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK (provider_request_id IS NULL OR
    (char_length(provider_request_id) BETWEEN 1 AND 128
      AND provider_request_id ~ '^[A-Za-z0-9._:-]+$')),
  CHECK (normalized_outcome IS NULL OR
    (char_length(normalized_outcome) BETWEEN 1 AND 64
      AND normalized_outcome ~ '^[a-z][a-z0-9_]*$')),
  CHECK (pricing_policy_version IS NULL OR
    (char_length(pricing_policy_version) BETWEEN 1 AND 64
      AND pricing_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$')),
  CHECK (pricing_input IS NULL OR
    (jsonb_typeof(pricing_input)='object' AND octet_length(pricing_input::text)<=4096)),
  CHECK ((disposition='accepted')=(analysis_result_id IS NOT NULL))
);
CREATE INDEX vision_provider_attempts_spend_idx
  ON public.vision_provider_attempts(spend_identity,started_at);
CREATE INDEX vision_provider_attempts_reconcile_idx
  ON public.vision_provider_attempts(job_id,claim_attempt_number,disposition);
CREATE UNIQUE INDEX vision_provider_attempts_accepted_job_idx
  ON public.vision_provider_attempts(job_id) WHERE disposition='accepted';

ALTER TABLE public.vision_provider_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vision_provider_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.vision_provider_attempts TO service_role;

CREATE FUNCTION marketplace_sec.phase9_register_vision_provider_attempt(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_job_reference text,p_correlation_id uuid,p_sanitized_media_reference text,
  p_external_call_id uuid,p_provider_role text,p_provider_key text,p_adapter_key text,
  p_adapter_version text,p_model_key text,p_model_version text,p_prompt_version text,
  p_schema_version text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_job public.image_extraction_jobs;
  v_input public.image_extraction_inputs;
  v_session public.image_extraction_sessions;
  v_media public.media_assets;
  v_reservation public.phase9_usage_reservations;
  v_attempt public.vision_provider_attempts;
  v_spend text;
  v_expected_job text;
  v_expected_media text;
  v_duplicate_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_job_id IS NULL
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$' OR p_attempt_count NOT BETWEEN 1 AND 5
    OR p_job_reference !~ '^job_[A-Za-z0-9._:-]{16,124}$' OR p_correlation_id IS NULL
    OR p_sanitized_media_reference !~ '^media_[0-9a-f]{48}$'
    OR p_external_call_id IS NULL OR p_provider_role NOT IN ('primary','approved_fallback')
    OR p_provider_key !~ '^[a-z][a-z0-9._-]{1,63}$'
    OR p_adapter_key !~ '^[a-z][a-z0-9._-]{1,63}$'
    OR p_adapter_version !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    OR p_model_key !~ '^[a-z][a-z0-9._-]{1,63}$'
    OR p_model_version !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    OR p_prompt_version !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    OR p_schema_version !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.job_kind IS DISTINCT FROM 'vision_extract'
    OR v_job.entity_type IS DISTINCT FROM 'input'
    OR v_job.status IS DISTINCT FROM 'in_progress'
    OR v_job.correlation_id IS DISTINCT FROM p_correlation_id
    OR v_job.lease_owner IS DISTINCT FROM p_worker
    OR v_job.attempt_count IS DISTINCT FROM p_attempt_count
    OR v_job.lease_expires_at IS NULL OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash IS DISTINCT FROM
      encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  v_expected_job:='job_'||replace(v_job.correlation_id::text,'-','');
  IF p_job_reference IS DISTINCT FROM v_expected_job THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  SELECT * INTO v_input FROM public.image_extraction_inputs WHERE id=v_job.entity_id;
  IF FOUND THEN
    SELECT * INTO v_session FROM public.image_extraction_sessions WHERE id=v_input.session_id;
    SELECT * INTO v_media FROM public.media_assets WHERE id=v_input.media_asset_id;
  END IF;
  v_expected_media:='media_'||substr(
    encode(extensions.digest(v_media.id::text||':'||v_job.id::text,'sha256'),'hex'),1,48);
  IF v_input.id IS NULL OR v_session.id IS NULL OR v_media.id IS NULL
    OR v_input.store_id IS DISTINCT FROM v_job.store_id
    OR v_session.store_id IS DISTINCT FROM v_job.store_id
    OR v_media.store_id IS DISTINCT FROM v_job.store_id
    OR v_input.session_id IS DISTINCT FROM v_session.id
    OR v_input.media_asset_id IS DISTINCT FROM v_media.id
    OR v_media.session_id IS DISTINCT FROM v_session.id
    OR v_input.sha256 IS DISTINCT FROM v_media.sha256
    OR v_input.state IS DISTINCT FROM 'processing'
    OR v_media.purpose IS DISTINCT FROM 'scan_input'
    OR v_media.privacy_class IS DISTINCT FROM 'private_scan'
    OR v_media.lifecycle_status IS DISTINCT FROM 'linked'
    OR v_media.detected_mime IS DISTINCT FROM 'image/webp'
    OR v_media.validated_at IS NULL OR v_media.reencode_version IS NULL
    OR v_media.exif_strip_version IS NULL
    OR p_sanitized_media_reference IS DISTINCT FROM v_expected_media THEN
    RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED';
  END IF;
  SELECT * INTO v_reservation FROM public.phase9_usage_reservations
    WHERE job_id=v_job.id AND store_id=v_job.store_id AND cost_kind='vision'
      AND status IN ('reserved','consumed') ORDER BY policy_version DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_VISION_USAGE_RESERVATION_REQUIRED'; END IF;
  v_spend:=encode(extensions.digest(concat_ws('|',v_job.id,p_correlation_id,
    p_attempt_count,p_provider_role,p_provider_key,p_adapter_key,p_model_key),'sha256'),'hex');
  SELECT * INTO v_attempt FROM public.vision_provider_attempts
    WHERE external_call_id=p_external_call_id;
  IF FOUND THEN
    IF v_attempt.job_id IS DISTINCT FROM v_job.id
      OR v_attempt.claim_attempt_number IS DISTINCT FROM p_attempt_count
      OR v_attempt.claim_worker IS DISTINCT FROM p_worker
      OR v_attempt.claim_lease_token_hash IS DISTINCT FROM
        encode(extensions.digest(p_lease_token,'sha256'),'hex')
      OR v_attempt.spend_identity IS DISTINCT FROM v_spend THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
    END IF;
  ELSE
    INSERT INTO public.vision_provider_attempts(
      external_call_id,store_id,job_id,correlation_id,claim_attempt_number,
      claim_worker,claim_lease_token_hash,usage_reservation_id,provider_role,
      provider_key,adapter_key,adapter_version,model_key,model_version,
      prompt_version,schema_version,spend_identity
    ) VALUES (
      p_external_call_id,v_job.store_id,v_job.id,v_job.correlation_id,p_attempt_count,
      p_worker,encode(extensions.digest(p_lease_token,'sha256'),'hex'),v_reservation.id,
      p_provider_role,p_provider_key,p_adapter_key,p_adapter_version,p_model_key,
      p_model_version,p_prompt_version,p_schema_version,v_spend
    ) RETURNING * INTO v_attempt;
  END IF;
  SELECT count(*)::integer INTO v_duplicate_count
    FROM public.vision_provider_attempts WHERE spend_identity=v_spend;
  RETURN jsonb_build_object(
    'attempt_id',v_attempt.id,'usage_reservation_id',v_reservation.id,
    'spend_identity',v_spend,'duplicate_spend_count',v_duplicate_count,
    'media_bucket',v_media.bucket_id,'media_path',v_media.object_path,
    'media_mime',v_media.detected_mime
  );
END$$;

CREATE FUNCTION marketplace_sec.phase9_finalize_vision_provider_attempt(
  p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_disposition text,p_normalized_outcome text,p_provider_request_id text,
  p_usage jsonb,p_pricing_policy_version text,p_pricing_input jsonb,p_cost_units numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_attempt public.vision_provider_attempts; v_reservation uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_attempt_id IS NULL OR p_job_id IS NULL
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$' OR p_lease_token !~ '^[0-9a-f]{64}$'
    OR p_attempt_count NOT BETWEEN 1 AND 5
    OR p_disposition NOT IN ('response_received','failed','outcome_unknown')
    OR p_normalized_outcome !~ '^[a-z][a-z0-9_]{0,63}$'
    OR (p_provider_request_id IS NOT NULL AND
      (char_length(p_provider_request_id)>128 OR p_provider_request_id !~ '^[A-Za-z0-9._:-]+$'))
    OR jsonb_typeof(p_usage)<>'object' OR octet_length(p_usage::text)>1024
    OR (SELECT count(*) FROM jsonb_object_keys(p_usage))<>5
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_usage) k WHERE k<>ALL(ARRAY[
      'prompt_tokens','output_tokens','total_tokens','cached_tokens','thinking_tokens']))
    OR EXISTS (SELECT 1 FROM jsonb_each(p_usage) e
      WHERE jsonb_typeof(e.value)<>'number' OR (e.value::text)::numeric<0
        OR (e.value::text)::numeric>1000000000 OR trunc((e.value::text)::numeric)<>(e.value::text)::numeric)
    OR (p_pricing_policy_version IS NULL)<>(p_cost_units IS NULL)
    OR (p_pricing_input IS NULL)<>(p_cost_units IS NULL)
    OR (p_cost_units IS NOT NULL AND
      (p_cost_units<0 OR p_cost_units>1000000000
       OR p_pricing_policy_version !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
       OR jsonb_typeof(p_pricing_input)<>'object' OR octet_length(p_pricing_input::text)>4096
       OR (SELECT count(*) FROM jsonb_object_keys(p_pricing_input))>7
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_pricing_input) k
         WHERE k<>ALL(ARRAY['currency','input_basis','input_unit_cost',
           'output_unit_cost','cached_unit_cost','thinking_unit_cost',
           'pricing_source_version']))
       OR EXISTS (SELECT 1 FROM jsonb_each(p_pricing_input) e
         WHERE jsonb_typeof(e.value) NOT IN ('string','number'))))
    THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  SELECT * INTO v_attempt FROM public.vision_provider_attempts
    WHERE id=p_attempt_id AND job_id=p_job_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.claim_worker IS DISTINCT FROM p_worker
    OR v_attempt.claim_attempt_number IS DISTINCT FROM p_attempt_count
    OR v_attempt.claim_lease_token_hash IS DISTINCT FROM
      encode(extensions.digest(p_lease_token,'sha256'),'hex')
    OR v_attempt.disposition IS DISTINCT FROM 'registered' THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  UPDATE public.vision_provider_attempts SET
    provider_request_id=p_provider_request_id,completed_at=transaction_timestamp(),
    normalized_outcome=p_normalized_outcome,
    prompt_tokens=(p_usage->>'prompt_tokens')::integer,
    output_tokens=(p_usage->>'output_tokens')::integer,
    total_tokens=(p_usage->>'total_tokens')::integer,
    cached_tokens=(p_usage->>'cached_tokens')::integer,
    thinking_tokens=(p_usage->>'thinking_tokens')::integer,
    pricing_policy_version=p_pricing_policy_version,pricing_input=p_pricing_input,
    calculated_cost_units=p_cost_units,disposition=p_disposition,
    updated_at=transaction_timestamp() WHERE id=p_attempt_id
    RETURNING usage_reservation_id INTO v_reservation;
  UPDATE public.phase9_usage_reservations r SET
    actual_cost_units=(SELECT coalesce(sum(a.calculated_cost_units),0)
      FROM public.vision_provider_attempts a WHERE a.usage_reservation_id=r.id
        AND a.disposition<>'registered'),
    status='consumed',updated_at=transaction_timestamp() WHERE r.id=v_reservation;
  RETURN jsonb_build_object('attempt_id',p_attempt_id,'disposition',p_disposition);
END$$;

CREATE FUNCTION marketplace_sec.phase9_associate_vision_provider_attempt(
  p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_attempt public.vision_provider_attempts; v_result public.image_analysis_results;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_attempt_id IS NULL
    OR p_job_id IS NULL
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$' OR p_attempt_count NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  SELECT * INTO v_attempt FROM public.vision_provider_attempts
    WHERE id=p_attempt_id AND job_id=p_job_id FOR UPDATE;
  SELECT * INTO v_result FROM public.image_analysis_results
    WHERE vision_job_id=p_job_id AND completing_attempt=p_attempt_count
      AND completing_worker=p_worker
      AND completing_lease_token_hash=
        encode(extensions.digest(p_lease_token,'sha256'),'hex');
  IF v_attempt.id IS NULL OR v_result.id IS NULL
    OR v_attempt.disposition IS DISTINCT FROM 'response_received'
    OR v_attempt.claim_attempt_number IS DISTINCT FROM p_attempt_count
    OR v_attempt.claim_worker IS DISTINCT FROM p_worker
    OR v_attempt.claim_lease_token_hash IS DISTINCT FROM
      encode(extensions.digest(p_lease_token,'sha256'),'hex')
    OR v_result.completing_attempt IS DISTINCT FROM p_attempt_count
    OR v_result.completing_worker IS DISTINCT FROM p_worker
    OR v_result.completing_lease_token_hash IS DISTINCT FROM
      encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  UPDATE public.vision_provider_attempts SET disposition='accepted',
    analysis_result_id=v_result.id,updated_at=transaction_timestamp()
    WHERE id=v_attempt.id;
  UPDATE public.vision_provider_attempts SET disposition='stale_rejected',
    normalized_outcome=coalesce(normalized_outcome,'superseded_provider_spend'),
    updated_at=transaction_timestamp()
    WHERE job_id=p_job_id AND id<>v_attempt.id AND disposition='response_received';
  RETURN jsonb_build_object('attempt_id',v_attempt.id,'disposition','accepted');
END$$;

CREATE FUNCTION marketplace_sec.phase9_mark_vision_provider_attempt(
  p_attempt_id uuid,p_job_id uuid,p_disposition text,p_normalized_outcome text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_attempt public.vision_provider_attempts;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_attempt_id IS NULL OR p_job_id IS NULL
    OR p_disposition NOT IN ('stale_rejected','failed','outcome_unknown')
    OR p_normalized_outcome !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  SELECT * INTO v_attempt FROM public.vision_provider_attempts
    WHERE id=p_attempt_id AND job_id=p_job_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.disposition='accepted' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  UPDATE public.vision_provider_attempts SET disposition=p_disposition,
    normalized_outcome=p_normalized_outcome,completed_at=coalesce(completed_at,transaction_timestamp()),
    updated_at=transaction_timestamp() WHERE id=p_attempt_id;
  RETURN jsonb_build_object('attempt_id',p_attempt_id,'disposition',p_disposition);
END$$;

CREATE FUNCTION public.phase9_register_vision_provider_attempt(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_job_reference text,p_correlation_id uuid,p_sanitized_media_reference text,
  p_external_call_id uuid,p_provider_role text,p_provider_key text,p_adapter_key text,
  p_adapter_version text,p_model_key text,p_model_version text,p_prompt_version text,
  p_schema_version text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_register_vision_provider_attempt(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_job_reference,p_correlation_id,
    p_sanitized_media_reference,p_external_call_id,p_provider_role,p_provider_key,
    p_adapter_key,p_adapter_version,p_model_key,p_model_version,p_prompt_version,p_schema_version)
$$;
CREATE FUNCTION public.phase9_finalize_vision_provider_attempt(
  p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_disposition text,p_normalized_outcome text,p_provider_request_id text,
  p_usage jsonb,p_pricing_policy_version text,p_pricing_input jsonb,p_cost_units numeric
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_finalize_vision_provider_attempt(
    p_attempt_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_disposition,
    p_normalized_outcome,p_provider_request_id,p_usage,p_pricing_policy_version,
    p_pricing_input,p_cost_units)
$$;
CREATE FUNCTION public.phase9_associate_vision_provider_attempt(
  p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_associate_vision_provider_attempt(
    p_attempt_id,p_job_id,p_worker,p_lease_token,p_attempt_count)
$$;
CREATE FUNCTION public.phase9_mark_vision_provider_attempt(
  p_attempt_id uuid,p_job_id uuid,p_disposition text,p_normalized_outcome text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_mark_vision_provider_attempt(
    p_attempt_id,p_job_id,p_disposition,p_normalized_outcome)
$$;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_vision_provider_attempt(
  uuid,text,text,integer,text,uuid,text,uuid,text,text,text,text,text,text,text,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_finalize_vision_provider_attempt(
  uuid,uuid,text,text,integer,text,text,text,jsonb,text,jsonb,numeric)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_associate_vision_provider_attempt(
  uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_mark_vision_provider_attempt(
  uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_register_vision_provider_attempt(
  uuid,text,text,integer,text,uuid,text,uuid,text,text,text,text,text,text,text,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_finalize_vision_provider_attempt(
  uuid,uuid,text,text,integer,text,text,text,jsonb,text,jsonb,numeric)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_associate_vision_provider_attempt(
  uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_mark_vision_provider_attempt(
  uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_vision_provider_attempt(
  uuid,text,text,integer,text,uuid,text,uuid,text,text,text,text,text,text,text,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_finalize_vision_provider_attempt(
  uuid,uuid,text,text,integer,text,text,text,jsonb,text,jsonb,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_associate_vision_provider_attempt(
  uuid,uuid,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_mark_vision_provider_attempt(
  uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_register_vision_provider_attempt(
  uuid,text,text,integer,text,uuid,text,uuid,text,text,text,text,text,text,text,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_finalize_vision_provider_attempt(
  uuid,uuid,text,text,integer,text,text,text,jsonb,text,jsonb,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_associate_vision_provider_attempt(
  uuid,uuid,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_mark_vision_provider_attempt(
  uuid,uuid,text,text) TO service_role;

COMMIT;
