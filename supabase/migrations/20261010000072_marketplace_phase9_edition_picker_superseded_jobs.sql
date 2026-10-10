-- Picker §§4.3/5/9, Master §8/MAS-17: claim-fenced terminal outcome for superseded requests.
-- Forward-only correction. M65-M71 are immutable; this migration is not applied here.
BEGIN;
CREATE FUNCTION marketplace_sec.phase9_resolve_superseded_edition_job_v1(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.image_extraction_jobs; state public.phase9_candidate_edition_state;
 token_hash text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
  OR p_lease_token !~ '^[0-9a-f]{64}$' OR p_attempt_count NOT BETWEEN 1 AND 5
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 token_hash:=encode(extensions.digest(p_lease_token,'sha256'),'hex');
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF j.job_kind IS DISTINCT FROM 'metadata_enrich' OR j.entity_type IS DISTINCT FROM 'candidate'
  OR j.operation_version IS DISTINCT FROM 'p9-owner-edition-options-v1'
 THEN RETURN jsonb_build_object('status','not_applicable'); END IF;
 -- Same claim replay is safe after response loss; token remains represented only by its hash.
 IF j.status='resolved_noop' AND j.last_safe_error_code='P9_EDITION_REQUEST_SUPERSEDED' THEN
  IF j.attempt_count IS DISTINCT FROM p_attempt_count OR j.lease_owner IS DISTINCT FROM p_worker
   OR j.lease_token_hash IS DISTINCT FROM token_hash THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN jsonb_build_object('status','resolved_noop','outcome','request_superseded');
 END IF;
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 SELECT * INTO state FROM public.phase9_candidate_edition_state
  WHERE candidate_id=j.entity_id AND store_id=j.store_id;
 -- Missing state or a still-current request is not evidence that this job was superseded.
 IF state.candidate_id IS NULL OR state.request_id IS NOT DISTINCT FROM j.id
 THEN RETURN jsonb_build_object('status','not_superseded'); END IF;
 UPDATE public.image_extraction_jobs SET status='resolved_noop',
  last_safe_error_code='P9_EDITION_REQUEST_SUPERSEDED',last_safe_error_category='metadata',
  lease_expires_at=NULL,completed_at=transaction_timestamp(),dead_lettered_at=NULL,
  updated_at=transaction_timestamp()
 WHERE id=j.id;
 RETURN jsonb_build_object('status','resolved_noop','outcome','request_superseded');
END
$function$;
CREATE FUNCTION public.phase9_resolve_superseded_edition_job_v1(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $function$
 SELECT marketplace_sec.phase9_resolve_superseded_edition_job_v1($1,$2,$3,$4)
$function$;
ALTER FUNCTION marketplace_sec.phase9_resolve_superseded_edition_job_v1(uuid,text,text,integer) OWNER TO postgres;
ALTER FUNCTION public.phase9_resolve_superseded_edition_job_v1(uuid,text,text,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_resolve_superseded_edition_job_v1(uuid,text,text,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_resolve_superseded_edition_job_v1(uuid,text,text,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_resolve_superseded_edition_job_v1(uuid,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_resolve_superseded_edition_job_v1(uuid,text,text,integer) TO service_role;
COMMIT;
