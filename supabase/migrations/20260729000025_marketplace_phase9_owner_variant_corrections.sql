-- Phase 9 M25: distinct Owner-origin corrected search variants.
BEGIN;

CREATE FUNCTION public.phase9_owner_replace_search_variant(
  p_store_id uuid,p_source_proposal_id uuid,p_expected_version integer,
  p_variant_text text,p_variant_language text,p_variant_script text,
  p_variant_type text,p_reason text,p_note text,p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_actor uuid:=auth.uid();
  v_source public.phase9_search_variant_proposals;
  v_candidate public.image_extraction_candidates;
  v_candidate_id uuid;
  v_existing public.phase9_search_variant_decisions;
  v_confirmed jsonb;
  v_normalized text;
  v_fingerprint text;
  v_replacement uuid;
  v_decision uuid;
  v_previous text;
BEGIN
  IF NOT marketplace_sec.phase9_owner_variant_authorized(p_store_id) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  IF p_expected_version<1 OR char_length(trim(p_variant_text)) NOT BETWEEN 1 AND 256
    OR p_variant_language !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    OR p_variant_script<>'Latn'
    OR p_variant_type NOT IN (
      'primary_roman','roman_alternative','translation_candidate')
    OR (p_variant_type='translation_candidate'
      AND split_part(lower(p_variant_language),'-',1)<>'en')
    OR p_reason !~ '^[a-z][a-z0-9_]{2,63}$'
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR (p_note IS NOT NULL AND char_length(trim(p_note)) NOT BETWEEN 1 AND 500)
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_normalized:=marketplace_sec.phase9_variant_compare_key(p_variant_text);
  IF char_length(v_normalized)<1 OR p_variant_text ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_store_id,
    p_source_proposal_id,p_expected_version,trim(p_variant_text),
    lower(p_variant_language),p_variant_script,p_variant_type,p_reason,
    coalesce(trim(p_note),''),p_idempotency_key),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    concat_ws('|',p_store_id,v_actor,p_idempotency_key),0));
  SELECT * INTO v_existing FROM public.phase9_search_variant_decisions
  WHERE store_id=p_store_id AND actor_user_id=v_actor
    AND idempotency_key=p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint<>v_fingerprint THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_build_object('decision_id',v_existing.id,
      'source_proposal_id',v_existing.source_proposal_id,
      'replacement_proposal_id',v_existing.replacement_proposal_id,
      'status','active','replayed',true);
  END IF;
  -- Resolve only the lock key before taking either row lock. Candidate-first
  -- matches Owner decisions, reconciliation, and candidate-refresh ordering.
  SELECT source.candidate_id INTO v_candidate_id
  FROM public.phase9_search_variant_proposals source
  WHERE source.id=p_source_proposal_id;
  SELECT * INTO v_candidate FROM public.image_extraction_candidates
  WHERE id=v_candidate_id AND store_id=p_store_id FOR SHARE;
  SELECT * INTO v_source FROM public.phase9_search_variant_proposals
  WHERE id=p_source_proposal_id FOR UPDATE;
  IF NOT marketplace_sec.phase9_owner_variant_authorized(p_store_id) THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  IF v_source.id IS NULL OR v_source.store_id<>p_store_id THEN
    RAISE EXCEPTION 'P9_CROSS_TENANT_DENIED';
  END IF;
  IF v_candidate.id IS NULL OR v_source.candidate_id<>v_candidate.id THEN
    RAISE EXCEPTION 'P9_VARIANT_SOURCE_MISMATCH';
  END IF;
  IF v_source.lifecycle_version<>p_expected_version THEN
    RAISE EXCEPTION 'P9_STALE_VERSION';
  END IF;
  IF v_source.status='rejected' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_confirmed:=marketplace_sec.phase9_confirmed_variant_source(
    v_candidate,v_source);
  IF v_confirmed IS NULL THEN RAISE EXCEPTION 'P9_VARIANT_SOURCE_MISMATCH'; END IF;
  IF v_normalized=marketplace_sec.phase9_variant_compare_key(v_confirmed->>'text')
    OR v_normalized=v_source.variant_normalized
    OR EXISTS(
      SELECT 1 FROM public.phase9_search_variant_proposals p
      WHERE p.store_id=p_store_id AND p.candidate_id=v_source.candidate_id
        AND p.source_field=v_source.source_field
        AND p.variant_normalized=v_normalized
        AND p.status IN ('proposed','active')
    ) THEN RAISE EXCEPTION 'P9_VARIANT_DUPLICATE'; END IF;

  v_replacement:=gen_random_uuid();
  INSERT INTO public.phase9_search_variant_proposals(
    id,proposal_identity,store_id,analysis_result_id,vision_job_id,candidate_id,
    observation_id,source_field,target_type,author_index,source_text,
    source_language,source_script,source_normalized,variant_text,
    variant_normalized,variant_language,variant_script,variant_type,
    proposal_schema_version,contract_version,generation_source,provider_key,
    model_key,model_version,prompt_version,status,search_eligible,
    approval_method,lifecycle_reason,lifecycle_actor_id,activated_at,
    lifecycle_version,source_proposal_id,created_by
  ) VALUES(
    v_replacement,encode(extensions.digest(
      concat_ws('|','owner-correction',v_source.id,v_actor,p_idempotency_key),
      'sha256'),'hex'),
    p_store_id,v_source.analysis_result_id,v_source.vision_job_id,
    v_source.candidate_id,v_source.observation_id,v_source.source_field,
    v_source.target_type,v_source.author_index,v_confirmed->>'text',
    v_confirmed->>'language',v_confirmed->>'script',
    marketplace_sec.phase9_variant_compare_key(v_confirmed->>'text'),
    trim(p_variant_text),v_normalized,lower(p_variant_language),
    p_variant_script,p_variant_type,v_source.proposal_schema_version,
    v_source.contract_version,'owner_correction',v_source.provider_key,
    v_source.model_key,v_source.model_version,v_source.prompt_version,
    'active',true,'owner_approved',p_reason,v_actor,transaction_timestamp(),
    1,v_source.id,v_actor
  );
  v_previous:=v_source.status;
  UPDATE public.phase9_search_variant_proposals
  SET status='rejected',search_eligible=false,approval_method=NULL,
    lifecycle_reason='owner_replaced',lifecycle_actor_id=v_actor,
    activated_at=NULL,rejected_at=transaction_timestamp(),stale_at=NULL,
    lifecycle_version=lifecycle_version+1,updated_at=transaction_timestamp()
  WHERE id=v_source.id;
  PERFORM marketplace_sec.phase9_materialize_search_variant(v_replacement);
  INSERT INTO public.phase9_search_variant_decisions(
    proposal_id,store_id,actor_user_id,action,reason,note,
    previous_lifecycle,resulting_lifecycle,expected_version,resulting_version,
    source_proposal_id,replacement_proposal_id,idempotency_key,request_fingerprint
  ) VALUES(v_source.id,p_store_id,v_actor,'replace',p_reason,nullif(trim(p_note),''),
    v_previous,'rejected',p_expected_version,p_expected_version+1,
    v_source.id,v_replacement,p_idempotency_key,v_fingerprint)
  RETURNING id INTO v_decision;
  RETURN jsonb_build_object('decision_id',v_decision,
    'source_proposal_id',v_source.id,'replacement_proposal_id',v_replacement,
    'status','active','replayed',false);
END
$function$;

ALTER FUNCTION public.phase9_owner_replace_search_variant(
  uuid,uuid,integer,text,text,text,text,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_owner_replace_search_variant(
  uuid,uuid,integer,text,text,text,text,text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_owner_replace_search_variant(
  uuid,uuid,integer,text,text,text,text,text,text,text)
  TO authenticated,service_role;

COMMIT;
