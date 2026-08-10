-- Phase 9: distinguish same-claim provider reconciliation from later job retries.

CREATE FUNCTION marketplace_sec.phase9_metadata_job_context_v2(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_context jsonb;
  v_attempt_id uuid;
  v_physical_claim_attempt integer;
BEGIN
  v_context:=marketplace_sec.phase9_metadata_job_context(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  IF jsonb_typeof(v_context)<>'object'
    OR v_context->>'contractVersion'<>'p9-metadata-job-context-v1' THEN
    RAISE EXCEPTION 'P9_METADATA_CONTEXT_INVALID';
  END IF;
  IF v_context->>'currentAttemptId' IS NOT NULL THEN
    v_attempt_id:=(v_context->>'currentAttemptId')::uuid;
    SELECT pc.claim_attempt_number INTO v_physical_claim_attempt
    FROM public.phase9_metadata_provider_calls pc
    WHERE pc.logical_attempt_id=v_attempt_id
    ORDER BY pc.created_at DESC,pc.id DESC LIMIT 1;
  END IF;
  RETURN (v_context-'contractVersion')||jsonb_build_object(
    'contractVersion','p9-metadata-job-context-v2',
    'currentPhysicalClaimAttempt',v_physical_claim_attempt);
END$$;

ALTER FUNCTION marketplace_sec.phase9_metadata_job_context_v2(uuid,text,text,integer)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_metadata_job_context_v2(uuid,text,text,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_metadata_job_context_v2(uuid,text,text,integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.phase9_metadata_job_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_metadata_job_context_v2(
    p_job_id,p_worker,p_lease_token,p_attempt_count)
$$;

ALTER FUNCTION public.phase9_metadata_job_context(uuid,text,text,integer)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_metadata_job_context(uuid,text,text,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_metadata_job_context(uuid,text,text,integer)
  TO service_role;
