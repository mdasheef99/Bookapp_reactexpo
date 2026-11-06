-- Phase 9 fix round 8c, Unit 1. Pipeline SDD sections 10-11/15;
-- 02c sections 4.3/8/9; DOC-8 section 4; inventory-read WU1 section 6.
-- Forward only. No historical reconciliation or shared-database application.
BEGIN;

-- Called only by the existing terminal transitions, while their job lock is held.
-- Registration precedes egress (metadataProductionGateway / metadataEditionProviderCalls).
-- Physical metadata receipts have no cost: count each logical attempt exactly once.
CREATE FUNCTION marketplace_sec.phase9_settle_terminal_usage_v1(
 p_job_id uuid,p_store_id uuid,p_cost_kind text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; r public.phase9_usage_reservations;
 a public.metadata_enrichment_attempts; l public.phase9_metadata_lookups;
 pc public.phase9_metadata_provider_calls; v public.vision_provider_attempts;
 unknown_cost boolean; sent boolean; attempt_sent boolean; total_cost numeric;
 next_status text; actual_cost numeric;
BEGIN
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=p_job_id AND store_id=p_store_id
  AND status IN('resolved','dead_letter') AND lease_owner IS NULL AND lease_token_hash IS NULL
  AND lease_expires_at IS NULL AND ((p_cost_kind='metadata' AND job_kind='metadata_enrich' AND entity_type='candidate')
   OR (p_cost_kind='vision' AND job_kind='vision_extract' AND entity_type='input'));
 IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 -- A1: settled rows are immutable here, including legacy consumed-at-zero rows.
 FOR r IN SELECT * FROM public.phase9_usage_reservations
  WHERE job_id=j.id AND store_id=j.store_id AND cost_kind=p_cost_kind AND status='reserved'
  ORDER BY id FOR UPDATE
 LOOP
  unknown_cost:=false; sent:=false; total_cost:=0;
  IF p_cost_kind='metadata' THEN
   -- Do not silently discard malformed or cross-kind lineage by joining it away.
   IF EXISTS(SELECT 1 FROM public.vision_provider_attempts WHERE usage_reservation_id=r.id)
    OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls p
     JOIN public.metadata_enrichment_attempts x ON x.id=p.logical_attempt_id
     LEFT JOIN public.phase9_metadata_lookups y ON y.id=x.lookup_id
     LEFT JOIN public.phase9_usage_reservations u ON u.id=x.usage_reservation_id
     WHERE p.job_id=j.id AND x.usage_reservation_id IS DISTINCT FROM r.id
      AND (u.id IS NULL OR y.id IS NULL OR u.job_id IS DISTINCT FROM p.job_id
       OR y.job_id IS DISTINCT FROM p.job_id OR u.cost_kind IS DISTINCT FROM 'metadata'
       OR p.store_id IS DISTINCT FROM j.store_id OR p.candidate_id IS DISTINCT FROM j.entity_id
       OR u.store_id IS DISTINCT FROM p.store_id OR x.store_id IS DISTINCT FROM p.store_id
       OR y.store_id IS DISTINCT FROM p.store_id OR x.candidate_id IS DISTINCT FROM p.candidate_id
       OR y.candidate_id IS DISTINCT FROM p.candidate_id))
   THEN unknown_cost:=true; END IF;
   FOR a IN SELECT * FROM public.metadata_enrichment_attempts WHERE usage_reservation_id=r.id
   LOOP
    SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=a.lookup_id;
    IF l.id IS NULL OR l.job_id IS DISTINCT FROM j.id OR l.store_id IS DISTINCT FROM j.store_id
     OR a.store_id IS DISTINCT FROM j.store_id OR a.candidate_id IS DISTINCT FROM j.entity_id
     OR l.candidate_id IS DISTINCT FROM a.candidate_id
    THEN unknown_cost:=true; CONTINUE; END IF;
    attempt_sent:=false;
    FOR pc IN SELECT * FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=a.id
    LOOP
     IF pc.job_id IS DISTINCT FROM j.id OR pc.store_id IS DISTINCT FROM j.store_id
      OR pc.candidate_id IS DISTINCT FROM a.candidate_id THEN
      unknown_cost:=true;
     ELSIF pc.edition_call_sequence IS NOT NULL AND pc.edition_egress_started IS FALSE
      AND pc.status='stale_rejected' AND pc.normalized_outcome='cancelled'
      AND pc.logical_outcome='cancelled' AND pc.retryable IS FALSE AND pc.completed_at IS NOT NULL
      AND pc.provider_request_id IS NULL AND pc.normalized_candidate IS NULL
      AND pc.match_evidence='[]'::jsonb THEN
      -- M92:1172-1191 is explicit pre-egress evidence, not a generic error label.
      NULL;
     ELSIF pc.completed_at IS NOT NULL AND pc.normalized_outcome IS NOT NULL
      AND pc.logical_outcome IS NOT NULL AND pc.retryable IS NOT NULL
      AND ((pc.edition_call_sequence IS NOT NULL AND pc.edition_egress_started IS TRUE
        AND pc.status IN('finalized','stale_rejected'))
       OR (pc.edition_call_sequence IS NULL AND pc.edition_call_stage IS NULL
        AND pc.edition_egress_started IS DISTINCT FROM false AND pc.status='finalized')) THEN
      attempt_sent:=true;
     ELSE unknown_cost:=true;
     END IF;
    END LOOP;
    IF attempt_sent THEN
     sent:=true;
     IF a.calculated_cost_units IS NULL OR a.completed_at IS NULL OR a.status<>'completed'
      OR a.disposition='unresolved' THEN unknown_cost:=true;
     ELSE total_cost:=total_cost+a.calculated_cost_units;
     END IF;
    ELSIF a.provider_request_id IS NOT NULL OR a.provider_record_id IS NOT NULL
     OR a.normalized_payload IS NOT NULL OR a.raw_payload IS NOT NULL
     OR (a.calculated_cost_units IS NOT NULL AND a.calculated_cost_units<>0) THEN
     unknown_cost:=true;
    END IF;
   END LOOP;
  ELSE
   -- The analyzer's persisted pre-egress reasons are the only entry gate.
   -- Marking and retrying never settle usage; this runs in the terminal job RPC.
   IF NOT EXISTS(SELECT 1 FROM public.vision_provider_attempts x
    WHERE x.usage_reservation_id=r.id AND x.job_id=j.id AND x.store_id=j.store_id
     AND x.claim_attempt_number=j.attempt_count AND x.completed_at IS NOT NULL
     AND ((x.normalized_outcome IN('claim_invalid_before_media_download','claim_invalid_before_provider_egress')
       AND x.disposition='stale_rejected') OR (x.normalized_outcome='media_unavailable' AND x.disposition='failed')))
   THEN CONTINUE; END IF;
   IF EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts WHERE usage_reservation_id=r.id)
   THEN unknown_cost:=true; END IF;
   FOR v IN SELECT * FROM public.vision_provider_attempts WHERE usage_reservation_id=r.id
   LOOP
    IF v.job_id IS DISTINCT FROM j.id OR v.store_id IS DISTINCT FROM j.store_id THEN
     unknown_cost:=true;
    ELSIF v.completed_at IS NOT NULL
     AND ((v.normalized_outcome IN('claim_invalid_before_media_download','claim_invalid_before_provider_egress')
       AND v.disposition='stale_rejected') OR (v.normalized_outcome='media_unavailable' AND v.disposition='failed'))
     AND v.provider_request_id IS NULL AND v.prompt_tokens IS NULL AND v.output_tokens IS NULL
     AND v.total_tokens IS NULL AND v.cached_tokens IS NULL AND v.thinking_tokens IS NULL
     AND v.pricing_policy_version IS NULL AND v.pricing_input IS NULL
     AND v.calculated_cost_units IS NULL AND v.analysis_result_id IS NULL THEN
     NULL;
    ELSIF v.completed_at IS NOT NULL AND v.disposition IN('response_received','accepted','stale_rejected','failed')
     AND v.normalized_outcome IS NOT NULL AND v.normalized_outcome NOT IN(
      'claim_invalid_before_media_download','media_unavailable','claim_invalid_before_provider_egress')
     AND v.calculated_cost_units IS NOT NULL AND v.pricing_policy_version IS NOT NULL
     AND v.pricing_input IS NOT NULL AND v.prompt_tokens IS NOT NULL AND v.output_tokens IS NOT NULL
     AND v.total_tokens IS NOT NULL AND v.cached_tokens IS NOT NULL AND v.thinking_tokens IS NOT NULL THEN
     sent:=true; total_cost:=total_cost+v.calculated_cost_units;
    ELSE unknown_cost:=true;
    END IF;
   END LOOP;
  END IF;
  IF unknown_cost THEN next_status:='reserved'; actual_cost:=NULL;
  ELSIF sent THEN next_status:='consumed'; actual_cost:=total_cost;
  ELSE next_status:='released'; actual_cost:=0;
  END IF;
  UPDATE public.phase9_usage_reservations SET status=next_status,actual_cost_units=actual_cost,
   updated_at=transaction_timestamp() WHERE id=r.id AND job_id=j.id AND store_id=j.store_id
   AND cost_kind=p_cost_kind AND status='reserved'
   AND (status IS DISTINCT FROM next_status OR actual_cost_units IS DISTINCT FROM actual_cost);
 END LOOP;
END$$;
ALTER FUNCTION marketplace_sec.phase9_settle_terminal_usage_v1(uuid,uuid,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_settle_terminal_usage_v1(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;

-- Non-locking authorization preserves every predicate of M54 + M65.
CREATE OR REPLACE FUNCTION public.phase9_owner_candidate_edition_choices_v1(p_session_id uuid,p_candidate_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.image_extraction_sessions;
BEGIN
 s:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
 IF NOT marketplace_sec.phase9_owner_ux_session_mutable(s) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO c FROM public.image_extraction_candidates WHERE id=p_candidate_id AND session_id=s.id
  AND store_id=s.store_id;
 IF c.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
 IF c.state NOT IN('ready','needs_review','possible_duplicate') OR c.committed_inventory_id IS NOT NULL
  OR c.expires_at<=transaction_timestamp() OR c.review_disposition IN('owner_removed_from_scan','skipped_false_detection')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN marketplace_sec.phase9_edition_choices(c);
END$$;
ALTER FUNCTION public.phase9_owner_candidate_edition_choices_v1(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_owner_candidate_edition_choices_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_owner_candidate_edition_choices_v1(uuid,uuid) TO authenticated;

-- WU1 section 6 / M31: no client store hint; full active Owner capability.
-- These six counts are row counts; quantity predicates overlap visibility.
CREATE FUNCTION public.phase9_owner_dashboard_inventory_counts_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid; result jsonb;
BEGIN
 v_store:=marketplace_sec.phase9_owner_ux_assert_owner();
 SELECT jsonb_build_object('total',count(*),
  'published',count(*) FILTER(WHERE visibility_status='published'),
  'draft',count(*) FILTER(WHERE visibility_status='draft'),
  'paused',count(*) FILTER(WHERE visibility_status='paused'),
  'lowStock',count(*) FILTER(WHERE quantity_available=1),
  'outOfStock',count(*) FILTER(WHERE quantity_available=0)) INTO result
 FROM public.store_inventory WHERE store_id=v_store;
 RETURN result;
EXCEPTION WHEN others THEN
 IF SQLERRM=ANY(ARRAY['P9_AUTH_REQUIRED','P9_OWNER_NOT_AUTHORIZED','P9_INTERNAL_ERROR']) THEN RAISE; END IF;
 RAISE EXCEPTION 'P9_INTERNAL_ERROR';
END$$;
ALTER FUNCTION public.phase9_owner_dashboard_inventory_counts_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_owner_dashboard_inventory_counts_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_owner_dashboard_inventory_counts_v1() TO authenticated;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_fail_metadata_job_automatic(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_failure_kind text,p_retryable boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_candidate public.image_extraction_candidates;
  v_lookup public.phase9_metadata_lookups; v_snapshot public.phase9_selected_metadata_snapshots;
  v_outcome_attempt_id uuid;
  v_manual_outcome text; v_job_status text; v_snapshot_id uuid;
  v_query_identity text; v_lookup_exists boolean:=false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_job_id IS NULL
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$' OR p_attempt_count NOT BETWEEN 1 AND 5
    OR (p_candidate_id IS NULL)<>(p_candidate_version IS NULL)
    OR (p_query_identity IS NOT NULL
      AND char_length(p_query_identity) NOT BETWEEN 1 AND 2048)
    OR p_failure_kind NOT IN (
      'insufficient_query','no_acceptable_match','ambiguous_match','material_conflict',
      'provider_unavailable','timeout','network_failure','rate_limited',
      'circuit_breaker_open','malformed_response','schema_invalid','response_too_large',
      'unsupported_content_type','authentication_configuration_failure','policy_denied',
      'legal_launch_denied','cost_quota_denied','provider_disabled','cancelled') THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs j
    WHERE j.id=p_job_id AND j.job_kind='metadata_enrich'
      AND j.entity_type='candidate';
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=v_job.entity_id AND c.store_id=v_job.store_id;
  IF v_job.id IS NULL OR v_candidate.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF p_candidate_id IS NOT NULL AND (p_candidate_id<>v_candidate.id
    OR p_candidate_version<>v_candidate.version) THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  v_query_identity:=marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate);
  IF p_query_identity IS NOT NULL AND p_query_identity<>v_query_identity THEN
    RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
  END IF;
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups l
    WHERE l.job_id=v_job.id AND l.candidate_id=v_candidate.id
      AND l.store_id=v_job.store_id AND l.query_identity=v_query_identity
    ORDER BY l.created_at DESC,l.id DESC LIMIT 1;
  IF FOUND AND v_lookup.completed_at IS NOT NULL
    AND v_lookup.claim_attempt_number=p_attempt_count
    AND v_lookup.claim_worker=p_worker
    AND v_lookup.claim_lease_token_hash=encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    SELECT * INTO v_snapshot FROM public.phase9_selected_metadata_snapshots s
      WHERE s.lookup_id=v_lookup.id AND s.candidate_id=v_candidate.id
        AND s.store_id=v_job.store_id;
    IF FOUND THEN RETURN jsonb_build_object('status','replayed',
      'job_status',(SELECT j.status FROM public.image_extraction_jobs j WHERE j.id=p_job_id),
      'manual_outcome',v_snapshot.manual_outcome,'snapshot_id',v_snapshot.id); END IF;
  END IF;
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=v_job.entity_id AND c.store_id=v_job.store_id FOR UPDATE;
  IF NOT FOUND OR v_candidate.state<>'processing' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,
    COALESCE(p_candidate_id,v_candidate.id),COALESCE(p_candidate_version,v_candidate.version));
  v_query_identity:=marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate);
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups l
    WHERE l.job_id=v_job.id AND l.candidate_id=v_candidate.id
      AND l.store_id=v_job.store_id AND l.query_identity=v_query_identity
    ORDER BY l.created_at DESC,l.id DESC LIMIT 1;
  v_lookup_exists:=v_lookup.id IS NOT NULL;

  IF p_retryable AND v_job.attempt_count<v_job.max_attempts
    AND p_failure_kind IN ('provider_unavailable','timeout','network_failure','rate_limited',
      'circuit_breaker_open') THEN
    UPDATE public.image_extraction_jobs SET status='retry_scheduled',
      next_attempt_at=transaction_timestamp()+interval '1 minute',
      lease_owner=NULL,lease_expires_at=NULL,lease_token_hash=NULL,
      last_safe_error_code='P9_METADATA_TECHNICAL_RETRY',
      last_safe_error_category='metadata',updated_at=transaction_timestamp()
    WHERE id=v_job.id;
    RETURN jsonb_build_object('status','retry_scheduled','manual_outcome',NULL);
  END IF;

  v_manual_outcome:=CASE
    WHEN p_failure_kind='insufficient_query' THEN 'manual_metadata_required'
    WHEN p_failure_kind='no_acceptable_match' THEN 'no_match'
    WHEN p_failure_kind='ambiguous_match' THEN 'ambiguous'
    WHEN p_failure_kind='material_conflict' THEN 'material_conflict'
    WHEN p_failure_kind='cost_quota_denied' THEN 'cost_quota_denied'
    WHEN p_failure_kind IN ('authentication_configuration_failure','policy_denied',
      'legal_launch_denied','provider_disabled','cancelled') THEN 'policy_denied'
    ELSE 'technical_failure' END;
  v_job_status:=CASE WHEN v_manual_outcome='technical_failure' THEN 'dead_letter' ELSE 'resolved' END;

  IF v_manual_outcome='technical_failure' AND v_lookup_exists THEN
    UPDATE public.metadata_enrichment_attempts SET disposition='failed',
      normalized_outcome='technical_failure',status='completed',
      completed_at=transaction_timestamp()
    WHERE lookup_id=v_lookup.id AND disposition='unresolved';
  END IF;

  IF NOT v_lookup_exists THEN
    INSERT INTO public.phase9_metadata_lookups(
      candidate_id,store_id,job_id,query_identity,execution_mode,schema_version,
      lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,
      privacy_scope,claim_attempt_number,claim_worker,claim_lease_token_hash,
      normalized_outcome,completed_at
    ) VALUES(v_candidate.id,v_job.store_id,v_job.id,v_query_identity,'local',
      'p9-metadata-foundation-v1',CASE
        WHEN marketplace_sec.phase9_metadata_normalized_isbn13(
          v_candidate.observed_isbn_clue) IS NULL THEN 'bibliographic' ELSE 'isbn' END,
      'p9-metadata-lookup-v1',
      'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','store_private',
      p_attempt_count,p_worker,encode(extensions.digest(p_lease_token,'sha256'),'hex'),
      v_manual_outcome,transaction_timestamp()) RETURNING * INTO v_lookup;
  ELSE
    UPDATE public.phase9_metadata_lookups SET normalized_outcome=v_manual_outcome,
      claim_attempt_number=p_attempt_count,claim_worker=p_worker,
      claim_lease_token_hash=encode(extensions.digest(p_lease_token,'sha256'),'hex'),
      completed_at=transaction_timestamp() WHERE id=v_lookup.id
      AND candidate_id=v_candidate.id AND store_id=v_job.store_id
      RETURNING * INTO v_lookup;
  END IF;
  SELECT a.id INTO v_outcome_attempt_id FROM public.metadata_enrichment_attempts a
    WHERE a.lookup_id=v_lookup.id AND a.disposition<>'unresolved'
    ORDER BY a.attempt_sequence DESC,a.created_at DESC LIMIT 1;
  INSERT INTO public.phase9_selected_metadata_snapshots(
    candidate_id,store_id,lookup_id,outcome_source_attempt_id,
    snapshot_version,selection_policy_version,
    coherent_edition,match_evidence,manual_outcome
  ) VALUES(v_candidate.id,v_job.store_id,v_lookup.id,v_outcome_attempt_id,
    'p9-selected-metadata-v1',
    'p9-metadata-selection-v1',NULL,'[]'::jsonb,v_manual_outcome)
  RETURNING id INTO v_snapshot_id;
  UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=v_snapshot_id,
    state='needs_review',updated_at=transaction_timestamp() WHERE id=v_candidate.id;
  UPDATE public.image_extraction_jobs SET status=v_job_status,
    lease_owner=NULL,lease_expires_at=NULL,lease_token_hash=NULL,
    last_safe_error_code=CASE WHEN v_manual_outcome='technical_failure'
      THEN CASE WHEN v_job.attempt_count>=v_job.max_attempts THEN 'P9_METADATA_ATTEMPTS_EXHAUSTED'
        ELSE 'P9_METADATA_TECHNICAL_FAILURE' END ELSE upper('P9_METADATA_'||v_manual_outcome) END,
    last_safe_error_category='metadata',completed_at=transaction_timestamp(),
    dead_lettered_at=CASE WHEN v_job_status='dead_letter' THEN transaction_timestamp() ELSE NULL END,
    updated_at=transaction_timestamp() WHERE id=v_job.id;
  PERFORM marketplace_sec.phase9_settle_terminal_usage_v1(v_job.id,v_job.store_id,'metadata');
  RETURN jsonb_build_object('status',v_job_status,'manual_outcome',v_manual_outcome,
    'snapshot_id',v_snapshot_id);
END$$;
ALTER FUNCTION marketplace_sec.phase9_fail_metadata_job_automatic(uuid,text,text,integer,uuid,integer,text,text,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_fail_metadata_job_automatic(uuid,text,text,integer,uuid,integer,text,text,boolean)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_fail_candidate_edition_options_v1(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text,p_failure_kind text,p_retryable boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE c public.image_extraction_candidates; j public.image_extraction_jobs; l public.phase9_metadata_lookups;
 s public.phase9_candidate_edition_state; claim jsonb; receipt jsonb; outcome text; job_status text;
BEGIN
 IF p_retryable IS NULL OR p_failure_kind IS NULL OR p_failure_kind NOT IN(
  'no_acceptable_match','ambiguous_match','material_conflict','insufficient_query','provider_unavailable',
  'timeout','network_failure','rate_limited','circuit_breaker_open','malformed_response','schema_invalid',
  'response_too_large','unsupported_content_type','authentication_configuration_failure','policy_denied',
  'legal_launch_denied','cost_quota_denied','provider_disabled','cancelled')
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 c:=marketplace_sec.phase9_edition_assert_fence(p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,true,true);
 IF c.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=p_job_id;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 outcome:=CASE WHEN p_failure_kind='insufficient_query' THEN 'manual_metadata_required'
  WHEN p_failure_kind='no_acceptable_match' THEN 'no_match' WHEN p_failure_kind='ambiguous_match' THEN 'ambiguous'
  WHEN p_failure_kind='material_conflict' THEN 'material_conflict' WHEN p_failure_kind='cost_quota_denied' THEN 'cost_quota_denied'
  WHEN p_failure_kind IN('authentication_configuration_failure','policy_denied','legal_launch_denied','provider_disabled','cancelled')
  THEN 'policy_denied' ELSE 'technical_failure' END;
 job_status:=CASE WHEN outcome='technical_failure' THEN 'dead_letter' ELSE 'resolved' END;
 IF p_retryable AND j.attempt_count<j.max_attempts AND p_failure_kind IN(
  'provider_unavailable','timeout','network_failure','rate_limited','circuit_breaker_open')
 THEN job_status:='retry_scheduled'; outcome:=NULL; END IF;
 claim:=jsonb_build_object('requestId',p_request_id,'requestGeneration',p_request_generation,
  'queryHash',encode(extensions.digest(p_query_identity,'sha256'),'hex'),'worker',p_worker,
  'leaseTokenHash',encode(extensions.digest(p_lease_token,'sha256'),'hex'),'claimAttempt',p_attempt_count);
 receipt:=claim||jsonb_build_object('failureKind',p_failure_kind,'retryable',p_retryable);
 IF j.status<>'in_progress' THEN
  IF coalesce(s.failure_receipt @> claim,false) THEN
   IF s.failure_receipt IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
   IF j.status IS DISTINCT FROM job_status THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
   RETURN jsonb_build_object('status','replayed','job_status',j.status,'manual_outcome',outcome);
  END IF;
  -- A completed successful lookup may be observed after response loss; never regress its saved set.
  IF j.status IN('resolved','dead_letter') THEN RETURN jsonb_build_object('status','replayed','job_status',j.status); END IF;
  RAISE EXCEPTION 'P9_STATE_CONFLICT';
 END IF;
 UPDATE public.phase9_candidate_edition_state SET failure_receipt=receipt WHERE candidate_id=c.id;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE job_id=j.id AND candidate_id=c.id AND store_id=c.store_id
  AND query_identity=p_query_identity ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF job_status='retry_scheduled' THEN
  UPDATE public.image_extraction_jobs SET status='retry_scheduled',next_attempt_at=transaction_timestamp()+interval '1 minute',
   lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,last_safe_error_code='P9_METADATA_TECHNICAL_RETRY',
   last_safe_error_category='metadata',updated_at=transaction_timestamp() WHERE id=j.id;
  RETURN jsonb_build_object('status','retry_scheduled','manual_outcome',NULL);
 END IF;
 IF l.id IS NOT NULL THEN
  UPDATE public.metadata_enrichment_attempts SET disposition='failed',normalized_outcome=p_failure_kind,normalized_payload=NULL,
   status='completed',completed_at=transaction_timestamp() WHERE lookup_id=l.id AND disposition='unresolved';
  UPDATE public.phase9_metadata_lookups SET normalized_outcome=outcome,completed_at=transaction_timestamp()
   WHERE id=l.id;
 END IF;
 UPDATE public.image_extraction_jobs SET status=job_status,lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,
  last_safe_error_code=CASE WHEN outcome='technical_failure' THEN CASE WHEN j.attempt_count>=j.max_attempts THEN 'P9_METADATA_ATTEMPTS_EXHAUSTED'
    ELSE 'P9_METADATA_TECHNICAL_FAILURE' END ELSE upper('P9_METADATA_'||outcome) END,
  last_safe_error_category='metadata',completed_at=transaction_timestamp(),
  dead_lettered_at=CASE WHEN job_status='dead_letter' THEN transaction_timestamp() ELSE NULL END,updated_at=transaction_timestamp()
  WHERE id=j.id;
 PERFORM marketplace_sec.phase9_settle_terminal_usage_v1(j.id,j.store_id,'metadata');
 RETURN jsonb_build_object('status',job_status,'manual_outcome',outcome);
END
$function$;
ALTER FUNCTION marketplace_sec.phase9_fail_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,text,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_fail_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,text,boolean)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_fail_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_fail_vision_job(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_safe_error_code text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_job public.image_extraction_jobs;
  v_input public.image_extraction_inputs;
  v_session public.image_extraction_sessions;
  v_media public.media_assets;
  v_status text;
  v_retryable boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_job_id IS NULL
    OR p_worker IS NULL OR p_lease_token IS NULL OR p_attempt_count IS NULL
    OR p_safe_error_code IS NULL
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$'
    OR p_attempt_count NOT BETWEEN 1 AND 5
    OR p_safe_error_code NOT IN (
      'P9_VISION_SCHEMA_INVALID','P9_VISION_ANALYZER_TIMEOUT',
      'P9_VISION_ANALYZER_UNAVAILABLE','P9_VISION_MEDIA_UNAVAILABLE',
      'P9_VISION_DATABASE_RETRYABLE','P9_VISION_INTERNAL_PERMANENT'
    ) THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
  v_retryable:=p_safe_error_code IN (
    'P9_VISION_ANALYZER_TIMEOUT','P9_VISION_ANALYZER_UNAVAILABLE',
    'P9_VISION_DATABASE_RETRYABLE'
  );
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_job.status='resolved'
    AND v_job.last_safe_error_code='P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED' THEN
    RETURN marketplace_sec.phase9_finish_vision_relationship_reconciliation(
      p_job_id,p_worker,p_lease_token,p_attempt_count
    )->>'outcome';
  END IF;
  IF v_job.job_kind IS DISTINCT FROM 'vision_extract'
    OR v_job.status IS DISTINCT FROM 'in_progress'
    OR v_job.lease_owner IS DISTINCT FROM p_worker
    OR v_job.attempt_count IS DISTINCT FROM p_attempt_count
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash IS DISTINCT FROM
      encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  SELECT * INTO v_input FROM public.image_extraction_inputs WHERE id=v_job.entity_id FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO v_session FROM public.image_extraction_sessions WHERE id=v_input.session_id;
    IF FOUND THEN
      SELECT * INTO v_media FROM public.media_assets WHERE id=v_input.media_asset_id;
    END IF;
  END IF;
  IF v_job.entity_type IS DISTINCT FROM 'input' OR v_input.id IS NULL
    OR v_session.id IS NULL OR v_media.id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id=v_job.store_id)
    OR v_input.store_id IS DISTINCT FROM v_job.store_id
    OR v_session.store_id IS DISTINCT FROM v_job.store_id
    OR v_media.store_id IS DISTINCT FROM v_job.store_id
    OR v_input.session_id IS DISTINCT FROM v_session.id
    OR v_input.media_asset_id IS DISTINCT FROM v_media.id
    OR v_media.session_id IS DISTINCT FROM v_session.id
    OR v_input.sha256 IS DISTINCT FROM v_media.sha256
    OR v_media.purpose IS DISTINCT FROM 'scan_input'
    OR v_media.privacy_class IS DISTINCT FROM 'private_scan'
    OR v_media.lifecycle_status IS DISTINCT FROM 'linked'
    OR v_media.detected_mime IS DISTINCT FROM 'image/webp'
    OR v_media.validated_at IS NULL OR v_media.reencode_version IS NULL
    OR v_media.exif_strip_version IS NULL
    OR v_input.state NOT IN ('queued','processing') THEN
    RETURN marketplace_sec.phase9_finish_vision_relationship_reconciliation(
      p_job_id,p_worker,p_lease_token,p_attempt_count
    )->>'outcome';
  END IF;
  v_status:=CASE
    WHEN v_retryable AND v_job.attempt_count<v_job.max_attempts THEN 'retry_scheduled'
    WHEN v_retryable AND v_job.attempt_count>=v_job.max_attempts THEN 'dead_letter'
    ELSE 'resolved' END;
  UPDATE public.image_extraction_jobs
  SET status=v_status,lease_owner=NULL,lease_expires_at=NULL,lease_token_hash=NULL,
    next_attempt_at=transaction_timestamp()+CASE attempt_count
      WHEN 1 THEN interval '30 seconds' WHEN 2 THEN interval '2 minutes'
      WHEN 3 THEN interval '10 minutes' WHEN 4 THEN interval '30 minutes'
      ELSE interval '2 hours' END,
    last_safe_error_category='vision_analysis',last_safe_error_code=p_safe_error_code,
    completed_at=CASE WHEN v_status='resolved' THEN transaction_timestamp() END,
    dead_lettered_at=CASE WHEN v_status='dead_letter' THEN transaction_timestamp() END,
    updated_at=transaction_timestamp()
  WHERE id=v_job.id;
  IF v_status IN ('resolved','dead_letter') THEN
    UPDATE public.image_extraction_inputs
    SET state='failed',quality_result='quality_rejected',
      quality_reason=p_safe_error_code,processed_at=transaction_timestamp(),
      version=version+1,updated_at=transaction_timestamp()
    WHERE id=v_input.id;
    PERFORM marketplace_sec.phase9_settle_terminal_usage_v1(v_job.id,v_job.store_id,'vision');
  END IF;
  RETURN v_status;
END$$;
ALTER FUNCTION marketplace_sec.phase9_fail_vision_job(uuid,text,text,integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_fail_vision_job(uuid,text,text,integer,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_fail_vision_job(uuid,text,text,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_mark_vision_provider_attempt(
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
  -- Identical replay must not rewrite timestamps or destroy a finalized receipt.
  IF v_attempt.disposition=p_disposition AND v_attempt.normalized_outcome=p_normalized_outcome THEN
    RETURN jsonb_build_object('attempt_id',p_attempt_id,'disposition',p_disposition);
  END IF;
  IF v_attempt.disposition='response_received' OR v_attempt.provider_request_id IS NOT NULL
    OR v_attempt.prompt_tokens IS NOT NULL OR v_attempt.output_tokens IS NOT NULL
    OR v_attempt.total_tokens IS NOT NULL OR v_attempt.cached_tokens IS NOT NULL
    OR v_attempt.thinking_tokens IS NOT NULL OR v_attempt.pricing_policy_version IS NOT NULL
    OR v_attempt.pricing_input IS NOT NULL OR v_attempt.calculated_cost_units IS NOT NULL
    OR v_attempt.analysis_result_id IS NOT NULL
    OR (p_normalized_outcome IN('claim_invalid_before_media_download','media_unavailable',
      'claim_invalid_before_provider_egress') AND v_attempt.disposition<>'registered')
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  UPDATE public.vision_provider_attempts SET disposition=p_disposition,
    normalized_outcome=p_normalized_outcome,completed_at=coalesce(completed_at,transaction_timestamp()),
    updated_at=transaction_timestamp() WHERE id=p_attempt_id;
  RETURN jsonb_build_object('attempt_id',p_attempt_id,'disposition',p_disposition);
END$$;
ALTER FUNCTION marketplace_sec.phase9_mark_vision_provider_attempt(uuid,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_mark_vision_provider_attempt(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_mark_vision_provider_attempt(uuid,uuid,text,text) TO service_role;

COMMIT;
