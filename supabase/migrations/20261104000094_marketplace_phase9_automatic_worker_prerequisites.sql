-- Owner-authorized U5 prerequisite FILE only, 2026-11-04. NOT APPLIED.
-- Authority: 02c §§4.3/5.1/9; approved U5 SQL plans rounds 1/2.
-- M15/M32/M67/M93 unchanged. No tables, RLS, registry activation or worker changes.
BEGIN;

CREATE FUNCTION marketplace_sec.phase9_automatic_edition_fence_v1(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  j public.image_extraction_jobs;
  c public.image_extraction_candidates;
  l public.phase9_metadata_lookups;
  a public.metadata_enrichment_attempts;
  r marketplace_sec.phase9_automatic_provider_runs;
  session_id uuid;
  generation integer;
  request_id uuid;
  lineage jsonb := NULL;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;

  SELECT candidate.session_id INTO session_id
  FROM public.image_extraction_jobs job
  JOIN public.image_extraction_candidates candidate
    ON candidate.id=job.entity_id AND candidate.store_id=job.store_id
  WHERE job.id=p_job_id
    AND job.job_kind='metadata_enrich' AND job.entity_type='candidate';

  PERFORM 1 FROM public.image_extraction_sessions
  WHERE id=session_id FOR KEY SHARE;

  -- M15: (uuid,text,text,integer) -> public.image_extraction_jobs.
  j := marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  IF j.operation_version IS NOT DISTINCT FROM 'p9-owner-edition-options-v1' THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;

  SELECT candidate.* INTO c
  FROM public.image_extraction_candidates candidate
  WHERE candidate.id=j.entity_id AND candidate.store_id=j.store_id
  FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

  -- M67: (uuid,text,text,integer,uuid,integer) -> candidate composite.
  c := marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,c.id,c.version);

  SELECT state.request_generation,state.request_id INTO generation,request_id
  FROM public.phase9_candidate_edition_state state WHERE state.candidate_id=c.id;

  SELECT run.* INTO r
  FROM marketplace_sec.phase9_automatic_provider_runs run
  WHERE run.job_id=j.id ORDER BY run.round DESC LIMIT 1 FOR SHARE;

  IF r.lookup_id IS NOT NULL THEN
    SELECT lookup.* INTO l FROM public.phase9_metadata_lookups lookup
    WHERE lookup.id=r.lookup_id AND lookup.job_id=j.id
      AND lookup.candidate_id=c.id AND lookup.store_id=j.store_id FOR SHARE;
    SELECT attempt.* INTO a FROM public.metadata_enrichment_attempts attempt
    WHERE attempt.id=r.primary_attempt_id AND attempt.lookup_id=l.id
      AND attempt.candidate_id=c.id AND attempt.store_id=j.store_id FOR SHARE;

    IF l.id IS NULL OR a.id IS NULL
      OR l.execution_mode IS DISTINCT FROM 'external'
      OR l.leader_lookup_id IS NOT NULL OR l.completed_at IS NOT NULL
      OR a.provider_role IS DISTINCT FROM 'primary'
      OR a.attempt_sequence::integer IS DISTINCT FROM 1
      OR a.adapter_key IS DISTINCT FROM l.adapter_key
      OR a.adapter_version IS DISTINCT FROM l.adapter_version
      OR a.adapter_key IS DISTINCT FROM r.adapter_key
      OR a.adapter_version IS DISTINCT FROM r.adapter_version
      OR l.query_identity IS DISTINCT FROM
         marketplace_sec.phase9_metadata_candidate_query_identity(c)
      OR r.query_identity_hash IS DISTINCT FROM
         encode(extensions.digest(l.query_identity,'sha256'),'hex')
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

    IF l.reuse_policy_version IS NULL
      OR l.reuse_policy_version !~ '^[1-9][0-9]{0,9}$'
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
    IF l.reuse_policy_version::numeric>2147483647
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

    -- Lookup policy and run claim are historical; context may rebase lookup claims.
    lineage := jsonb_build_object(
      'adapterKey',a.adapter_key,'adapterVersion',a.adapter_version,
      'purpose','automatic','role',a.provider_role,
      'sequence',a.attempt_sequence::integer,'lookupId',l.id,'attemptId',a.id,
      'claimAttempt',r.claim_attempt_number,
      'policyVersion',l.reuse_policy_version::integer);
  END IF;

  -- 02c §4.3: blocking reads must not outlive the current claim's wall-clock lease.
  IF NOT EXISTS(
    SELECT 1 FROM public.image_extraction_jobs job
    WHERE job.id=j.id AND job.status='in_progress'
      AND job.lease_owner=p_worker AND job.attempt_count=p_attempt_count
      AND job.lease_token_hash=encode(extensions.digest(p_lease_token,'sha256'),'hex')
      AND job.lease_expires_at>clock_timestamp()
  ) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

  RETURN jsonb_build_object(
    'candidateVersion',c.version,'requestGeneration',coalesce(generation,0),
    'capturedRequestId',request_id,'lineage',lineage);
END
$function$;

CREATE FUNCTION public.phase9_automatic_edition_fence_v1(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$
  SELECT marketplace_sec.phase9_automatic_edition_fence_v1(
    p_job_id,p_worker,p_lease_token,p_attempt_count)
$function$;

ALTER FUNCTION marketplace_sec.phase9_automatic_edition_fence_v1(uuid,text,text,integer) OWNER TO postgres;
ALTER FUNCTION public.phase9_automatic_edition_fence_v1(uuid,text,text,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_automatic_edition_fence_v1(uuid,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_automatic_edition_fence_v1(uuid,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_automatic_edition_fence_v1(uuid,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_automatic_edition_fence_v1(uuid,text,text,integer) TO service_role;

CREATE FUNCTION marketplace_sec.phase9_prepare_automatic_metadata_v1(
  f jsonb,p_lookup jsonb,p_recheck boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  keys constant text[] := ARRAY[
    'provider_cache_identity','adapter_key','adapter_version',
    'capability_version','schema_version','lookup_strategy',
    'lookup_contract_version','normalizer_version','routing_policy_version',
    'privacy_scope','reuse_policy_version','cache_policy_version','cache_namespace'];
  j public.image_extraction_jobs;
  spec public.phase9_metadata_lookups;
  leader public.phase9_metadata_lookups;
  admission jsonb := NULL;
  election jsonb := NULL;
BEGIN
  -- M93: (jsonb,boolean) -> job composite; explicit false also matches live arity.
  j := marketplace_sec.phase9_admission_fence_v1(f,false);

  IF p_recheck IS NULL OR jsonb_typeof(p_lookup) IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF NOT (p_lookup ?& keys) OR p_lookup-keys<>'{}'::jsonb
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p_lookup) item
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'string')
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  spec := jsonb_populate_record(NULL::public.phase9_metadata_lookups,p_lookup);

  -- Continuations never elect another follower; M93 alone grants a retry round.
  IF EXISTS(SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs WHERE job_id=j.id) THEN
    admission := marketplace_sec.phase9_begin_automatic_provider_run_v1(
      f,spec.adapter_key,spec.adapter_version);
    RETURN jsonb_build_object('admission',admission,'coalescing',NULL);
  END IF;
  IF EXISTS(SELECT 1 FROM public.phase9_metadata_lookups WHERE job_id=j.id)
    OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations WHERE job_id=j.id)
    OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls WHERE job_id=j.id)
  THEN
    RETURN jsonb_build_object(
      'admission',jsonb_build_object('status','recovery_only'),'coalescing',NULL);
  END IF;

  -- M32's election mutex spans the fresh admission and the eventual insertion.
  LOCK TABLE public.phase9_metadata_lookups IN SHARE ROW EXCLUSIVE MODE;
  -- M93: (jsonb,text) -> boolean; use wall-clock scope after the blocking lock.
  IF NOT marketplace_sec.phase9_admission_scope_current_v1(
    f,encode(extensions.digest(f->>'leaseToken','sha256'),'hex'))
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

  -- Preserve M32:513-518's exact choice, including its first-row ordering.
  SELECT lookup.* INTO leader FROM public.phase9_metadata_lookups lookup
  WHERE lookup.job_id<>j.id AND lookup.leader_lookup_id IS NULL
    AND lookup.query_identity=f->>'queryIdentity'
    AND lookup.provider_cache_identity=spec.provider_cache_identity
    AND (lookup.privacy_scope='public_bibliographic' OR lookup.store_id=j.store_id)
  ORDER BY (lookup.completed_at IS NULL) DESC,lookup.created_at,lookup.id LIMIT 1;

  IF leader.id IS NULL OR (leader.completed_at IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.phase9_selected_metadata_snapshots WHERE lookup_id=leader.id))
  THEN
    -- M93: (jsonb,text,text) -> jsonb. This call reserves before external lineage.
    admission := marketplace_sec.phase9_begin_automatic_provider_run_v1(
      f,spec.adapter_key,spec.adapter_version);
    IF admission->>'status' IS DISTINCT FROM 'started' OR p_recheck THEN
      RETURN jsonb_build_object('admission',admission,'coalescing',NULL);
    END IF;
  END IF;

  -- M32: 21 arguments -> jsonb. Delegate waiter handling and lookup insertion.
  election := marketplace_sec.phase9_metadata_coalescing_context(
    j.id,f->>'worker',f->>'leaseToken',(f->>'claimAttempt')::integer,
    (f->>'candidateId')::uuid,(f->>'candidateVersion')::integer,f->>'queryIdentity',
    spec.provider_cache_identity,spec.adapter_key,spec.adapter_version,
    spec.capability_version,spec.schema_version,spec.lookup_strategy,
    spec.lookup_contract_version,spec.normalizer_version,spec.routing_policy_version,
    spec.privacy_scope,spec.reuse_policy_version,spec.cache_policy_version,
    spec.cache_namespace,NULL::uuid);
  IF admission IS NOT NULL AND election->>'mode' IS DISTINCT FROM 'leader'
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF NOT marketplace_sec.phase9_admission_scope_current_v1(
    f,encode(extensions.digest(f->>'leaseToken','sha256'),'hex'))
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN jsonb_build_object('admission',admission,'coalescing',election);
END
$function$;

CREATE FUNCTION public.phase9_prepare_automatic_metadata_v1(
  f jsonb,p_lookup jsonb,p_recheck boolean DEFAULT false
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$
  SELECT marketplace_sec.phase9_prepare_automatic_metadata_v1(f,p_lookup,p_recheck)
$function$;

ALTER FUNCTION marketplace_sec.phase9_prepare_automatic_metadata_v1(jsonb,jsonb,boolean) OWNER TO postgres;
ALTER FUNCTION public.phase9_prepare_automatic_metadata_v1(jsonb,jsonb,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_prepare_automatic_metadata_v1(jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_prepare_automatic_metadata_v1(jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_prepare_automatic_metadata_v1(jsonb,jsonb,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_prepare_automatic_metadata_v1(jsonb,jsonb,boolean) TO service_role;

COMMIT;
