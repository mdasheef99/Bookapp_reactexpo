-- 02c §§4.3/7/8/9; 02c-1 §2; Owner 2026-11-04: close EMPTY exhausted jobs only.
-- Local forward file. No settlement/accounting helper, registry change or trigger alteration.
BEGIN;
CREATE FUNCTION marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate record; affected integer; closed integer:=0; ids jsonb:='[]';
BEGIN
 -- Reuse M69:279–283 maintenance batch bounds, not provider operating limits.
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 FOR candidate IN SELECT j.id FROM public.image_extraction_jobs j
 WHERE j.job_kind='metadata_enrich' AND j.status IN('open','in_progress','retry_scheduled')
 AND j.attempt_count>=j.max_attempts
 AND (j.status<>'in_progress' OR j.lease_expires_at IS NULL OR j.lease_expires_at<=transaction_timestamp()) AND NOT EXISTS(SELECT 1 FROM public.phase9_usage_reservations u WHERE u.job_id=j.id AND u.status='reserved')
 AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=j.id AND r.status IN('queued','running','unknown'))
 AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_metadata_admissions a WHERE a.job_id=j.id AND
  (a.slots_remaining>0 OR (j.status='in_progress' AND a.claim_attempt_number=j.attempt_count
   AND a.claim_worker IS NOT DISTINCT FROM j.lease_owner AND a.claim_lease_token_hash IS NOT DISTINCT FROM j.lease_token_hash)))
 AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id AND
  (pc.status IN('registered','outcome_unknown') OR (pc.edition_call_sequence IS NOT NULL AND pc.edition_egress_started IS NULL)))
 ORDER BY j.next_attempt_at,j.id LIMIT p_limit FOR UPDATE OF j SKIP LOCKED
 LOOP
  -- M75:14–20 exhaustion, repeated AFTER the row lock. No next_attempt_at gate.
  -- M93:89–101 matching admissions are excluded, including zero-slot markers.
  -- M75:110–113 exact terminal assignments; intentionally no new request.
  UPDATE public.image_extraction_jobs j SET status='dead_letter',lease_owner=NULL,lease_token_hash=NULL,
   lease_expires_at=NULL,last_safe_error_code='P9_METADATA_ATTEMPTS_EXHAUSTED',last_safe_error_category='metadata',
   completed_at=transaction_timestamp(),dead_lettered_at=transaction_timestamp(),updated_at=transaction_timestamp()
  WHERE j.id=candidate.id AND j.job_kind='metadata_enrich' AND j.status IN('open','in_progress','retry_scheduled')
 AND j.attempt_count>=j.max_attempts
 AND (j.status<>'in_progress' OR j.lease_expires_at IS NULL OR j.lease_expires_at<=transaction_timestamp()) AND NOT EXISTS(SELECT 1 FROM public.phase9_usage_reservations u WHERE u.job_id=j.id AND u.status='reserved')
 AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=j.id AND r.status IN('queued','running','unknown'))
 AND NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_metadata_admissions a WHERE a.job_id=j.id AND
  (a.slots_remaining>0 OR (j.status='in_progress' AND a.claim_attempt_number=j.attempt_count
   AND a.claim_worker IS NOT DISTINCT FROM j.lease_owner AND a.claim_lease_token_hash IS NOT DISTINCT FROM j.lease_token_hash)))
 AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id AND
  (pc.status IN('registered','outcome_unknown') OR (pc.edition_call_sequence IS NOT NULL AND pc.edition_egress_started IS NULL)));
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected=1 THEN closed:=closed+1;ids:=ids||jsonb_build_array(candidate.id); END IF;
 END LOOP;
 RETURN jsonb_build_object('closed',closed,'jobIds',ids);
END$$;
ALTER FUNCTION marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(integer) TO service_role;
CREATE FUNCTION public.phase9_sweep_exhausted_metadata_jobs_v1(p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(p_limit)
$$;
ALTER FUNCTION public.phase9_sweep_exhausted_metadata_jobs_v1(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_sweep_exhausted_metadata_jobs_v1(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_sweep_exhausted_metadata_jobs_v1(integer) TO service_role;

-- Latest body M69:295–306, with a second isolated maintenance block.
-- Copy M69:299–304's BEGIN/EXCEPTION WHEN OTHERS/fallback/END pattern.
CREATE OR REPLACE FUNCTION marketplace_sec.dispatch_phase9_worker_wakes()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cleanup jsonb;
BEGIN
 BEGIN PERFORM marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1();
 EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'phase9 exhausted metadata sweep failed [%]: %',SQLSTATE,SQLERRM;
 END;
 BEGIN cleanup:=marketplace_sec.phase9_edition_cleanup_due();
 EXCEPTION WHEN OTHERS THEN
  cleanup:=jsonb_build_object('cleared',0,'failed',1,'remaining',
   (SELECT count(*)::integer FROM public.image_extraction_candidates candidate
    WHERE marketplace_sec.phase9_edition_options_due(candidate)));
 END;
 RETURN marketplace_sec.phase9_edition_legacy_dispatch()||jsonb_build_object('editionOptionsCleanup',cleanup);
END$$;
-- CREATE OR REPLACE preserves M69 owner/ACL/volatility/security/search_path.
COMMIT;
