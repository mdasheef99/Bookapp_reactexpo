-- Unit C file-only; 02c sections 4.3/7/9 and 02c-1 section 2; K1-K7/P1-P4.
-- Forward-only: copied M15 claim and M93 four-argument finish retain all other behavior.
BEGIN;

-- R1/P1: an unlocked hint, then the existing job-before-gate locked recheck.
-- A transition between the reads conflicts without reversing admission lock order.
CREATE FUNCTION marketplace_sec.phase9_defer_paused_metadata_admission_v1(f jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE gate marketplace_sec.phase9_external_admission_gate;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
 END IF;
 SELECT * INTO gate FROM marketplace_sec.phase9_external_admission_gate WHERE singleton;
 IF gate.singleton IS DISTINCT FROM true OR gate.mode='open' THEN
  RAISE EXCEPTION 'P9_STATE_CONFLICT';
 END IF;
 RETURN marketplace_sec.phase9_defer_metadata_admission_v1(f,gate.epoch);
END$$;
CREATE FUNCTION public.phase9_defer_paused_metadata_admission_v1(f jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_defer_paused_metadata_admission_v1(f)
$$;

-- R2: M15:195-224, one predicate; mirrors M93:328,336-337's blocked epoch rule.
CREATE OR REPLACE FUNCTION marketplace_sec.claim_phase9_metadata_jobs(p_batch_size integer,p_worker text)
RETURNS TABLE(id uuid,attempt_count integer,lease_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_batch_size NOT BETWEEN 1 AND 10
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  RETURN QUERY WITH claimed AS (
    SELECT j.id FROM public.image_extraction_jobs j
    WHERE j.job_kind='metadata_enrich'
      AND j.status IN ('open','retry_scheduled','in_progress')
      AND j.next_attempt_at<=transaction_timestamp()
      AND (j.status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp())
      AND j.attempt_count<j.max_attempts
      AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_job_admission_wait w
        WHERE w.job_id=j.id AND w.blocked_epoch=(
         SELECT g.epoch FROM marketplace_sec.phase9_external_admission_gate g WHERE g.singleton))
    ORDER BY j.next_attempt_at,j.id FOR UPDATE SKIP LOCKED LIMIT p_batch_size
  ), tokenized AS MATERIALIZED (
    SELECT c.id,replace(gen_random_uuid()::text,'-','')
      ||replace(gen_random_uuid()::text,'-','') token FROM claimed c
  ), updated AS (
    UPDATE public.image_extraction_jobs j SET
      status='in_progress',lease_owner=p_worker,
      lease_expires_at=transaction_timestamp()+interval '5 minutes',
      lease_token_hash=encode(extensions.digest(t.token,'sha256'),'hex'),
      attempt_count=j.attempt_count+1,updated_at=transaction_timestamp()
    FROM tokenized t WHERE j.id=t.id
    RETURNING j.id,j.attempt_count,t.token
  )
  SELECT u.id,u.attempt_count,u.token FROM updated u;
END$$;

-- R3: M93:610-686, one bound; finalized replay returns persisted state before this check.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_finish_automatic_provider_run_v1(f jsonb,p_key text,p_version text,p_not_before timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; run marketplace_sec.phase9_automatic_provider_runs;
 calls jsonb; final_call public.phase9_metadata_provider_calls; registry public.phase9_provider_registry;
 policy jsonb; safe boolean; due timestamptz;
BEGIN
 -- Receipt-first recovery after a scheduled retry has released the old lease.
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT coalesce(marketplace_sec.phase9_auto_fence_valid_v1(f),false)
 THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
 IF p_not_before IS NOT NULL AND NOT isfinite(p_not_before) THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 SELECT r.* INTO run FROM marketplace_sec.phase9_automatic_provider_runs r
  JOIN public.image_extraction_jobs old_job ON old_job.id=r.job_id
  JOIN public.image_extraction_candidates c ON c.id=old_job.entity_id AND c.store_id=old_job.store_id
  WHERE r.job_id=(f->>'jobId')::uuid AND r.adapter_key=p_key AND r.adapter_version=p_version
   AND r.query_identity_hash=encode(extensions.digest(f->>'queryIdentity','sha256'),'hex')
   AND r.claim_attempt_number=(f->>'claimAttempt')::integer AND r.claim_worker=f->>'worker'
   AND r.claim_lease_token_hash=encode(extensions.digest(f->>'leaseToken','sha256'),'hex')
   AND c.id=(f->>'candidateId')::uuid AND c.store_id=(f->>'storeId')::uuid AND c.session_id=(f->>'sessionId')::uuid
   AND r.fence_digest=marketplace_sec.phase9_run_fence_digest_v1(f) ORDER BY r.round DESC LIMIT 1;
 IF run.status='finalized' THEN
  IF run.retry_not_before IS DISTINCT FROM p_not_before THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN jsonb_build_object('status',CASE WHEN run.retry_allowed THEN 'retry_scheduled' ELSE 'finalized' END,
   'round',run.round,'dueAt',run.due_at);
 ELSIF run.status='unknown' THEN RETURN jsonb_build_object('status','recovery_only'); END IF;
 j:=marketplace_sec.phase9_admission_fence_v1(f);
 SELECT * INTO run FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=j.id
  AND r.query_identity_hash=encode(extensions.digest(f->>'queryIdentity','sha256'),'hex')
  AND r.adapter_key=p_key AND r.adapter_version=p_version
  AND r.candidate_version=(f->>'candidateVersion')::integer
  AND r.captured_request_id IS NOT DISTINCT FROM (f->>'capturedRequestId')::uuid
  AND r.request_generation=(f->>'requestGeneration')::integer
  AND r.fence_digest=marketplace_sec.phase9_run_fence_digest_v1(f) ORDER BY r.round DESC LIMIT 1 FOR UPDATE;
 IF run.job_id IS NULL OR run.claim_attempt_number<>j.attempt_count OR run.claim_worker IS DISTINCT FROM f->>'worker'
  OR run.claim_lease_token_hash IS DISTINCT FROM encode(extensions.digest(f->>'leaseToken','sha256'),'hex')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF run.status<>'running' THEN RETURN jsonb_build_object('status','recovery_only'); END IF;
 PERFORM 1 FROM public.phase9_provider_registry ORDER BY adapter_key FOR SHARE;
 PERFORM 1 FROM marketplace_sec.phase9_store_admission WHERE store_id=j.store_id FOR UPDATE;
 IF NOT marketplace_sec.phase9_admission_scope_current_v1(f,j.lease_token_hash) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at,c.id) INTO calls FROM public.phase9_metadata_provider_calls c
  WHERE c.job_id=j.id AND c.logical_attempt_id=run.primary_attempt_id AND c.claim_attempt_number=j.attempt_count;
 SELECT * INTO final_call FROM public.phase9_metadata_provider_calls c WHERE c.job_id=j.id
  AND c.logical_attempt_id=run.primary_attempt_id AND c.claim_attempt_number=j.attempt_count
  ORDER BY c.created_at DESC,c.id DESC LIMIT 1;
 IF final_call.id IS NULL OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls c WHERE c.job_id=j.id
  AND c.claim_attempt_number=j.attempt_count AND (c.status<>'finalized' OR c.logical_attempt_id IS DISTINCT FROM run.primary_attempt_id))
 THEN
  UPDATE marketplace_sec.phase9_automatic_provider_runs SET status='unknown' WHERE job_id=run.job_id
   AND query_identity_hash=run.query_identity_hash AND adapter_key=p_key AND adapter_version=p_version AND round=run.round;
  UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=0 WHERE job_id=j.id;
  PERFORM marketplace_sec.phase9_wake_store_admission_v1(j.store_id);
  RETURN jsonb_build_object('status','recovery_only');
 END IF;
 SELECT * INTO registry FROM public.phase9_provider_registry WHERE adapter_key=p_key FOR SHARE;
 policy:=registry.protection_policy;
 safe:=final_call.retryable IS TRUE AND final_call.logical_outcome IN ('rate_limited','provider_unavailable','timeout','network_failure');
 IF safe AND run.round=0 AND j.attempt_count<j.max_attempts AND policy IS NOT NULL
  AND registry.enabled AND registry.matching_allowed AND registry.storage_allowed
  AND registry.automatic_lookup_allowed AND registry.automatic_role='primary'
  AND registry.adapter_version=p_version AND policy->>'mode'='single_instance'
  AND marketplace_sec.phase9_capacity_configuration_valid_v1(policy) THEN
  -- One retry: first exponential step, bounded jitter; no invented numeric policy.
  due:=clock_timestamp()+make_interval(secs=>least((policy->>'backoffMaxMs')::double precision,
   (policy->>'backoffBaseMs')::double precision*(1+random()))/1000);
  due:=greatest(due,p_not_before);
  IF p_not_before IS NOT NULL
   AND p_not_before>clock_timestamp()+make_interval(
    secs=>(policy->>'backoffMaxMs')::double precision/1000)
  THEN due:=NULL; END IF;
 END IF;
 UPDATE marketplace_sec.phase9_automatic_provider_runs SET status='finalized',retry_allowed=(due IS NOT NULL),
  due_at=due,retry_not_before=p_not_before,outcome=final_call.logical_outcome,
  receipt_digest=marketplace_sec.phase9_run_receipt_digest_v1(j.id,run.primary_attempt_id,j.attempt_count) WHERE job_id=run.job_id
   AND query_identity_hash=run.query_identity_hash AND adapter_key=p_key AND adapter_version=p_version AND round=run.round;
 UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=0 WHERE job_id=j.id;
 PERFORM marketplace_sec.phase9_wake_store_admission_v1(j.store_id);
 IF due IS NULL THEN RETURN jsonb_build_object('status','finalized','round',run.round); END IF;
 UPDATE public.image_extraction_jobs SET status='retry_scheduled',next_attempt_at=due,
  lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,updated_at=clock_timestamp() WHERE id=j.id;
 RETURN jsonb_build_object('status','retry_scheduled','round',run.round,'dueAt',due);
END$$;

-- Same service-only wrapper ACL pattern as M93:1462-1465,1485-1511.
ALTER FUNCTION marketplace_sec.phase9_defer_paused_metadata_admission_v1(jsonb) OWNER TO postgres;
ALTER FUNCTION public.phase9_defer_paused_metadata_admission_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_defer_paused_metadata_admission_v1(jsonb),
 public.phase9_defer_paused_metadata_admission_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_defer_paused_metadata_admission_v1(jsonb),
 public.phase9_defer_paused_metadata_admission_v1(jsonb) TO service_role;
-- Existing M15 claim owner/ACL (CREATE OR REPLACE preserves both).
ALTER FUNCTION marketplace_sec.claim_phase9_metadata_jobs(integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.claim_phase9_metadata_jobs(integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.claim_phase9_metadata_jobs(integer,text) TO service_role;
ALTER FUNCTION marketplace_sec.phase9_finish_automatic_provider_run_v1(jsonb,text,text,timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_finish_automatic_provider_run_v1(jsonb,text,text,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_finish_automatic_provider_run_v1(jsonb,text,text,timestamptz) TO service_role;
COMMIT;
