-- Phase 9 8c follow-up. Forward-only. Clears stale zero-slot claims (D1) and
-- zero-call crashed automatic runs (D2) under the approved bounded rules.
-- M95/M96 and every applied migration stay unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate record; affected integer; closed integer:=0; ids jsonb:='[]'; released_store uuid;
BEGIN
 -- Reuse M69:279-283 maintenance batch bounds, not provider operating limits.
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 FOR candidate IN
  SELECT j.id,j.store_id FROM public.image_extraction_jobs j
  WHERE j.job_kind='metadata_enrich' AND j.status IN('open','in_progress','retry_scheduled')
  AND j.attempt_count>=j.max_attempts
  AND (j.status<>'in_progress' OR j.lease_expires_at IS NULL OR j.lease_expires_at<=transaction_timestamp())
  AND NOT EXISTS(SELECT 1 FROM public.phase9_usage_reservations u WHERE u.job_id=j.id AND u.status='reserved')
  -- D2: unknown always blocks. A queued/running run is blocking unless it is the
  -- approved zero-call crash shape: an admission exists for that run's claim and
  -- the job has no provider-call row at all (C4).
  AND NOT EXISTS(
   SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs r
   WHERE r.job_id=j.id
    AND (r.status='unknown' OR (r.status IN('queued','running') AND NOT (
     NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id)
     AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_metadata_admissions a
      WHERE a.job_id=j.id AND a.claim_attempt_number=r.claim_attempt_number
       AND a.claim_worker IS NOT DISTINCT FROM r.claim_worker
       AND a.claim_lease_token_hash IS NOT DISTINCT FROM r.claim_lease_token_hash)))))
  -- R1: only positive slots block, with the approved Q3 crash exception.
  AND NOT EXISTS(
   SELECT 1 FROM marketplace_sec.phase9_metadata_admissions a
   WHERE a.job_id=j.id AND a.slots_remaining>0
    AND NOT (j.status='in_progress'
     AND (j.lease_expires_at IS NULL OR j.lease_expires_at<=transaction_timestamp())
     AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id)
     AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs r
      WHERE r.job_id=j.id AND r.status IN('queued','running')
       AND a.claim_attempt_number=r.claim_attempt_number
       AND a.claim_worker IS NOT DISTINCT FROM r.claim_worker
       AND a.claim_lease_token_hash IS NOT DISTINCT FROM r.claim_lease_token_hash)))
  AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id AND
   (pc.status IN('registered','outcome_unknown') OR (pc.edition_call_sequence IS NOT NULL AND pc.edition_egress_started IS NULL)))
  ORDER BY j.next_attempt_at,j.id LIMIT p_limit FOR UPDATE OF j SKIP LOCKED
 LOOP
  -- CHANGE-1: each candidate owns a savepoint. Only P9S01 rollback is swallowed;
  -- every other error still aborts the sweep.
  BEGIN
   -- C1: detach only the matching stale claim. BEFORE M93:108-110 does not fire
   -- for in_progress->in_progress. AFTER M93:111-114 fires on the token change,
   -- zeroes slots and wakes the store (M93:104-105).
   UPDATE public.image_extraction_jobs j
   SET lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,updated_at=transaction_timestamp()
   WHERE j.id=candidate.id AND j.status='in_progress'
    AND (j.lease_expires_at IS NULL OR j.lease_expires_at<=transaction_timestamp())
    AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_metadata_admissions a
     WHERE a.job_id=j.id
      AND a.claim_attempt_number=j.attempt_count
      AND a.claim_worker IS NOT DISTINCT FROM j.lease_owner
      AND a.claim_lease_token_hash IS NOT DISTINCT FROM j.lease_token_hash
      AND (a.slots_remaining=0 OR (
       NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id)
       AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs r
        WHERE r.job_id=j.id AND r.status IN('queued','running')
         AND a.claim_attempt_number=r.claim_attempt_number
         AND a.claim_worker IS NOT DISTINCT FROM r.claim_worker
         AND a.claim_lease_token_hash IS NOT DISTINCT FROM r.claim_lease_token_hash))));

   -- Q2/Q4: only the zero-call crash shape reaches this point. The run is
   -- terminalized with an empty-set receipt (M93:602-607), no breaker claim.
   UPDATE marketplace_sec.phase9_automatic_provider_runs r
   SET status='finalized',retry_allowed=false,due_at=NULL,outcome=NULL,no_egress_recheck=false,
       receipt_digest=marketplace_sec.phase9_run_receipt_digest_v1(
         candidate.id,r.primary_attempt_id,r.claim_attempt_number)
   WHERE r.job_id=candidate.id AND r.status IN('queued','running')
    AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=candidate.id)
    AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_metadata_admissions a
     WHERE a.job_id=candidate.id
      AND a.claim_attempt_number=r.claim_attempt_number
      AND a.claim_worker IS NOT DISTINCT FROM r.claim_worker
      AND a.claim_lease_token_hash IS NOT DISTINCT FROM r.claim_lease_token_hash);

   -- Q3: any positive hold left after the trigger path is zeroed explicitly and
   -- the store is woken exactly like M93:659-660 / :727-728.
   released_store:=NULL;
   UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=0
   WHERE job_id=candidate.id AND slots_remaining>0
   RETURNING store_id INTO released_store;
   IF released_store IS NOT NULL THEN
    PERFORM marketplace_sec.phase9_wake_store_admission_v1(released_store);
   END IF;

   -- M75:14-20 exhaustion, repeated AFTER the row lock. M75:110-113 exact
   -- terminal assignments. Every candidate SELECT predicate is repeated verbatim.
   UPDATE public.image_extraction_jobs j
   SET status='dead_letter',lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,
       last_safe_error_code='P9_METADATA_ATTEMPTS_EXHAUSTED',last_safe_error_category='metadata',
       completed_at=transaction_timestamp(),dead_lettered_at=transaction_timestamp(),
       updated_at=transaction_timestamp()
   WHERE j.id=candidate.id AND j.job_kind='metadata_enrich'
    AND j.status IN('open','in_progress','retry_scheduled')
    AND j.attempt_count>=j.max_attempts
    AND (j.status<>'in_progress' OR j.lease_expires_at IS NULL OR j.lease_expires_at<=transaction_timestamp())
    AND NOT EXISTS(SELECT 1 FROM public.phase9_usage_reservations u WHERE u.job_id=j.id AND u.status='reserved')
    AND NOT EXISTS(
     SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs r
     WHERE r.job_id=j.id
      AND (r.status='unknown' OR (r.status IN('queued','running') AND NOT (
       NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id)
       AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_metadata_admissions a
        WHERE a.job_id=j.id AND a.claim_attempt_number=r.claim_attempt_number
         AND a.claim_worker IS NOT DISTINCT FROM r.claim_worker
         AND a.claim_lease_token_hash IS NOT DISTINCT FROM r.claim_lease_token_hash)))))
    AND NOT EXISTS(
     SELECT 1 FROM marketplace_sec.phase9_metadata_admissions a
     WHERE a.job_id=j.id AND a.slots_remaining>0
      AND NOT (j.status='in_progress'
       AND (j.lease_expires_at IS NULL OR j.lease_expires_at<=transaction_timestamp())
       AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id)
       AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_automatic_provider_runs r
        WHERE r.job_id=j.id AND r.status IN('queued','running')
         AND a.claim_attempt_number=r.claim_attempt_number
         AND a.claim_worker IS NOT DISTINCT FROM r.claim_worker
         AND a.claim_lease_token_hash IS NOT DISTINCT FROM r.claim_lease_token_hash)))
    AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id AND
     (pc.status IN('registered','outcome_unknown') OR (pc.edition_call_sequence IS NOT NULL AND pc.edition_egress_started IS NULL)));
   GET DIAGNOSTICS affected=ROW_COUNT;
   IF affected<>1 THEN
    RAISE EXCEPTION 'P9_SWEEP_CANDIDATE_SKIPPED' USING ERRCODE='P9S01';
   END IF;
   closed:=closed+1;
   ids:=ids||jsonb_build_array(candidate.id);
  EXCEPTION WHEN SQLSTATE 'P9S01' THEN NULL;
  END;
 END LOOP;
 RETURN jsonb_build_object('closed',closed,'jobIds',ids);
END$$;
ALTER FUNCTION marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(integer) TO service_role;

-- D3: a scanned card whose only metadata attempt is dead-lettered and left no
-- lookup must let the Owner reopen the picker.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_metadata_state(p_candidate_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE
  WHEN (marketplace_sec.phase9_edition_projection_selection(c)).selection_id IS NOT NULL THEN 'selected'
  WHEN legacy.state='pending'
    AND NOT EXISTS (SELECT 1 FROM public.image_extraction_jobs j WHERE j.entity_type='candidate' AND j.entity_id=c.id
      AND j.store_id=c.store_id AND j.status IN('open','in_progress','retry_scheduled'))
    AND (
    EXISTS (SELECT 1 FROM public.phase9_candidate_edition_state s
      JOIN public.phase9_metadata_lookups ml ON ml.id=s.source_lookup_id AND ml.candidate_id=c.id AND ml.store_id=c.store_id
      WHERE s.candidate_id=c.id AND s.store_id=c.store_id AND s.session_id=c.session_id
        AND s.query_identity=marketplace_sec.phase9_edition_query_identity(c)
        AND ml.normalized_outcome='accepted_metadata_match'
        AND NOT EXISTS (SELECT 1 FROM public.phase9_metadata_lookups newer WHERE newer.candidate_id=c.id
          AND (newer.created_at,newer.id)>(ml.created_at,ml.id)))
    OR (c.input_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.phase9_metadata_lookups ml WHERE ml.candidate_id=c.id AND ml.store_id=c.store_id))
    OR (c.selected_metadata_snapshot_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.phase9_candidate_edition_state st
        WHERE st.candidate_id=c.id AND st.store_id=c.store_id AND st.source_lookup_id IS NULL)
      AND EXISTS (SELECT 1 FROM public.phase9_selected_metadata_snapshots snap
        JOIN public.phase9_metadata_lookups newest ON newest.candidate_id=c.id AND newest.store_id=c.store_id
        WHERE snap.id=c.selected_metadata_snapshot_id AND snap.candidate_id=c.id AND snap.store_id=c.store_id
          AND newest.completed_at IS NOT NULL
          AND newest.normalized_outcome='accepted_metadata_match'
          AND newest.query_identity=marketplace_sec.phase9_edition_query_identity(c)
          AND NOT EXISTS (SELECT 1 FROM public.phase9_metadata_lookups newer
            WHERE newer.candidate_id=c.id AND newer.store_id=c.store_id
              AND (newer.created_at,newer.id)>(newest.created_at,newest.id))
          AND snap.lookup_id IS DISTINCT FROM newest.id
          AND snap.manual_outcome IS DISTINCT FROM 'accepted_metadata_match'))
    OR (c.input_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.phase9_metadata_lookups ml
        WHERE ml.candidate_id=c.id AND ml.store_id=c.store_id)
      AND EXISTS (SELECT 1 FROM public.image_extraction_jobs j
        WHERE j.entity_type='candidate' AND j.entity_id=c.id AND j.store_id=c.store_id
          AND j.job_kind='metadata_enrich' AND j.status='dead_letter'))
  ) THEN 'ambiguous'
  ELSE legacy.state END
  FROM public.image_extraction_candidates c
  CROSS JOIN LATERAL (SELECT marketplace_sec.phase9_edition_legacy_metadata_state(c.id) AS state) legacy
  WHERE c.id=p_candidate_id
$$;
-- M69:341-347 ACL form; M95 preserved it; no service_role grant.
ALTER FUNCTION marketplace_sec.phase9_owner_ux_metadata_state(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_metadata_state(uuid)
 FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
