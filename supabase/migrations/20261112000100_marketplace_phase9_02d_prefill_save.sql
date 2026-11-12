-- 02d SDD §§3/3.1/5/6/8, Unit 1a: retain automatic Open Library alternatives.
-- Local forward artifact only; deployment/application have separate authority.
-- M93 completion and M75 read are copied below with only the approved hook/read changes.
BEGIN;

-- Called only inside the already-fenced automatic completion, after its candidate UPDATE.
-- 02d §3: use the registry facts already validated by that completion, not a fresh snapshot.
CREATE FUNCTION marketplace_sec.phase9_prefill_automatic_editions_v1(
 p_candidate public.image_extraction_candidates,p_job public.image_extraction_jobs,
 p_lookup public.phase9_metadata_lookups,p_attempt public.metadata_enrichment_attempts,
 p_rows jsonb,p_fetched timestamptz,p_deadline timestamptz,p_generation integer,
 p_registry public.phase9_provider_registry
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.phase9_candidate_edition_state; registry public.phase9_provider_registry:=p_registry;
 reason text; expires timestamptz; inserted_id uuid; r jsonb; truthful boolean;
BEGIN
 -- Binding failures remain errors, including for defensive helper callers (ACP-2/13).
 IF p_candidate.id IS NULL OR p_candidate.session_id IS NULL OR p_candidate.store_id IS NULL
  OR p_job.id IS NULL OR p_job.entity_id IS DISTINCT FROM p_candidate.id
  OR p_job.store_id IS DISTINCT FROM p_candidate.store_id
  OR p_job.entity_type IS DISTINCT FROM 'candidate' OR p_job.job_kind IS DISTINCT FROM 'metadata_enrich'
  OR p_lookup.id IS NULL OR p_lookup.job_id IS DISTINCT FROM p_job.id
  OR p_lookup.candidate_id IS DISTINCT FROM p_candidate.id OR p_lookup.store_id IS DISTINCT FROM p_candidate.store_id
  OR p_generation IS NULL OR p_generation<0
  OR (p_rows IS NOT NULL AND p_lookup.execution_mode='external' AND p_attempt.id IS NULL)
  OR (p_attempt.id IS NOT NULL AND (p_attempt.lookup_id IS DISTINCT FROM p_lookup.id
   OR p_attempt.candidate_id IS DISTINCT FROM p_candidate.id OR p_attempt.store_id IS DISTINCT FROM p_candidate.store_id
   OR p_attempt.normalizer_version IS DISTINCT FROM p_lookup.normalizer_version))
 THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF p_rows IS NOT NULL AND NOT coalesce(marketplace_sec.phase9_edition_valid_rows(p_rows),false)
 THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;

 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id FOR UPDATE;
 IF s.candidate_id IS NOT NULL AND (s.session_id IS DISTINCT FROM p_candidate.session_id
  OR s.store_id IS DISTINCT FROM p_candidate.store_id) THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;

 -- 02d §3: first match wins. No writes, including row insertion, precede these skips.
 IF p_candidate.review_disposition IN ('owner_removed_from_scan','skipped_false_detection')
  OR p_candidate.committed_inventory_id IS NOT NULL THEN reason:='not_reviewable';
 ELSIF s.selection_id IS NOT NULL THEN reason:='selected';
 ELSIF s.request_id IS NOT NULL OR coalesce(s.request_generation,p_generation)<>p_generation THEN reason:='superseded';
 ELSIF p_lookup.query_identity IS DISTINCT FROM marketplace_sec.phase9_edition_query_identity(p_candidate)
 THEN reason:='identity_mismatch';
 ELSIF p_rows IS NULL OR p_lookup.execution_mode IS DISTINCT FROM 'external'
  OR p_fetched IS NULL OR p_deadline IS NULL OR NOT coalesce(registry.storage_allowed,false)
 THEN reason:='no_retention';
 ELSIF p_attempt.adapter_key IS DISTINCT FROM 'open_library' THEN reason:='source_not_allowed';
 END IF;
 IF reason IS NOT NULL THEN RETURN jsonb_build_object('status','skipped','reason',reason); END IF;

 -- The completion verified retention before calling us. Defensive empty-list callers
 -- distinguish absent evidence (above) from present but untruthful proof (Owner ruling).
 truthful:=coalesce(isfinite(p_fetched) AND isfinite(p_deadline)
  AND p_fetched<=clock_timestamp() AND p_deadline>p_fetched
  AND registry.enabled AND registry.matching_allowed AND registry.storage_allowed
  AND registry.adapter_version=p_attempt.adapter_version AND registry.policy_version::text=p_lookup.reuse_policy_version,false);
 IF jsonb_array_length(p_rows)=0 AND NOT truthful
 THEN RETURN jsonb_build_object('status','skipped','reason','empty_unproven'); END IF;
 IF p_attempt.id IS NULL OR NOT truthful THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 FOR r IN SELECT value->'metadata' FROM jsonb_array_elements(p_rows) WHERE value->'metadata'<>'null'::jsonb LOOP
  IF r->>'correlationId' IS DISTINCT FROM p_lookup.id::text OR r->>'attemptId' IS DISTINCT FROM p_attempt.id::text
   OR r->>'adapterKey' IS DISTINCT FROM p_attempt.adapter_key OR r->>'adapterVersion' IS DISTINCT FROM p_attempt.adapter_version
   OR r->>'normalizerVersion' IS DISTINCT FROM p_attempt.normalizer_version
   OR (r->>'fetchedAt')::timestamptz IS DISTINCT FROM p_fetched
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 END LOOP;
 expires:=least(p_deadline,p_fetched+interval '24 hours',
  p_fetched+registry.options_retention_seconds*interval '1 second');

 -- An untouched processing card normally has no row. A concurrent insert never
 -- grants permission to overwrite it; lock and re-check the captured values.
 IF s.candidate_id IS NULL THEN
  INSERT INTO public.phase9_candidate_edition_state(candidate_id,session_id,store_id,query_identity,request_generation)
  VALUES(p_candidate.id,p_candidate.session_id,p_candidate.store_id,p_lookup.query_identity,p_generation)
  ON CONFLICT(candidate_id) DO NOTHING RETURNING candidate_id INTO inserted_id;
  SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id FOR UPDATE;
  IF inserted_id IS NULL THEN RETURN jsonb_build_object('status','skipped','reason','superseded'); END IF;
 END IF;
 IF s.candidate_id IS NULL OR s.session_id IS DISTINCT FROM p_candidate.session_id
  OR s.store_id IS DISTINCT FROM p_candidate.store_id THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF s.selection_id IS NOT NULL THEN RETURN jsonb_build_object('status','skipped','reason','selected'); END IF;
 IF s.request_id IS NOT NULL OR s.request_generation<>p_generation
 THEN RETURN jsonb_build_object('status','skipped','reason','superseded'); END IF;
 IF s.query_identity IS DISTINCT FROM p_lookup.query_identity
 THEN RETURN jsonb_build_object('status','skipped','reason','identity_mismatch'); END IF;

 -- Keep row identity, generation, every option byte and the independent Owner selection.
 UPDATE public.phase9_candidate_edition_state SET request_id=p_job.id,query_identity=p_lookup.query_identity,
  options=p_rows,options_version=options_version+1,source_lookup_id=p_lookup.id,source_attempt_id=p_attempt.id,
  source_fetched_at=p_fetched,options_expires_at=expires,updated_at=transaction_timestamp()
  WHERE candidate_id=p_candidate.id RETURNING * INTO s;
 RETURN jsonb_build_object('status','saved','requestId',s.request_id,'requestGeneration',s.request_generation,
  'optionsVersion',s.options_version,'optionsExpiresAt',s.options_expires_at);
END$$;

ALTER FUNCTION marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,
 public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer,
 public.phase9_provider_registry) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,
 public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer,
 public.phase9_provider_registry) FROM PUBLIC,anon,authenticated,service_role;

-- Defensive direct-helper entry: retain its original signature and current-registry checks.
-- Automatic completion uses the registry-row overload above so saving adds no second read.
CREATE FUNCTION marketplace_sec.phase9_prefill_automatic_editions_v1(
 p_candidate public.image_extraction_candidates,p_job public.image_extraction_jobs,
 p_lookup public.phase9_metadata_lookups,p_attempt public.metadata_enrichment_attempts,
 p_rows jsonb,p_fetched timestamptz,p_deadline timestamptz,p_generation integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE registry public.phase9_provider_registry;
BEGIN
 SELECT * INTO registry FROM public.phase9_provider_registry WHERE adapter_key=p_attempt.adapter_key;
 RETURN marketplace_sec.phase9_prefill_automatic_editions_v1(
  p_candidate,p_job,p_lookup,p_attempt,p_rows,p_fetched,p_deadline,p_generation,registry);
END$$;

ALTER FUNCTION marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,
 public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer)
 OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,
 public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_complete_automatic_metadata_v1(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb:=p_command->'fence'; result jsonb:=p_command->'result'; o jsonb:=result->'outcome';
 c public.image_extraction_candidates; sess public.image_extraction_sessions; j public.image_extraction_jobs;
 l public.phase9_metadata_lookups; a public.metadata_enrichment_attempts; pc public.phase9_metadata_provider_calls;
 state public.phase9_candidate_edition_state; prior marketplace_sec.phase9_automatic_completion_effects;
 m jsonb:=nullif(o->'selected','null'::jsonb); r jsonb; cm jsonb; companion jsonb; proof jsonb;
 rows jsonb:=nullif(result->'rows','null'::jsonb); companions jsonb:=coalesce(nullif(result->'catalogueCompanions','null'::jsonb),'[]'::jsonb);
 policy jsonb; receipts jsonb; terminal jsonb; envelope jsonb; response jsonb; replay jsonb;
 digest text; claim_hash text; summary text; logical_outcome text; valid boolean; selected_id uuid;
 v_lookup_id uuid; v_attempt_id uuid; v_snapshot_id uuid; pair record;
 selected_work uuid; selected_edition uuid; registry public.phase9_provider_registry;
 v_results jsonb:='[]'; keys bigint[]:=ARRAY[]::bigint[]; next_keys bigint[]; key bigint;
 seen uuid[]:=ARRAY[]::uuid[]; fetched timestamptz; deadline timestamptz; queue_terminal text; prefill jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role'
  OR pg_catalog.jsonb_typeof(p_command) IS DISTINCT FROM 'object'
  OR NOT p_command ?& ARRAY['fence','lookupId','attemptId','result','selectedOptionId','source']
  OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(p_command))<>6
  OR NOT marketplace_sec.phase9_auto_fence_valid_v1(f)
  OR NOT marketplace_sec.phase9_auto_result_valid_v1(result)
  OR pg_catalog.jsonb_typeof(p_command->'lookupId') IS DISTINCT FROM 'string'
  OR p_command->>'lookupId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  OR pg_catalog.jsonb_typeof(p_command->'source') IS DISTINCT FROM 'string'
  OR p_command->>'source' NOT IN ('external','local') THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
 IF (p_command->'attemptId'<>'null'::jsonb AND (pg_catalog.jsonb_typeof(p_command->'attemptId')<>'string'
  OR p_command->>'attemptId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
  OR (p_command->'selectedOptionId'<>'null'::jsonb AND (pg_catalog.jsonb_typeof(p_command->'selectedOptionId')<>'string'
  OR p_command->>'selectedOptionId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
 THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
 v_lookup_id:=(p_command->>'lookupId')::uuid; v_attempt_id:=(p_command->>'attemptId')::uuid;
 selected_id:=(p_command->>'selectedOptionId')::uuid;
 claim_hash:=pg_catalog.encode(extensions.digest(f->>'leaseToken','sha256'),'hex');
 -- Raw lease token is excluded; exact JSON result/retention/selection are hashed.
 digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  (p_command||pg_catalog.jsonb_build_object('fence',(f-'leaseToken')||
   pg_catalog.jsonb_build_object('leaseTokenHash',claim_hash)))::text,'UTF8')),'hex');
 replay:=marketplace_sec.phase9_recover_automatic_metadata_v1(f);
 IF replay->>'status'='replayed' THEN
  SELECT * INTO prior FROM marketplace_sec.phase9_automatic_completion_effects e WHERE e.job_id=(f->>'jobId')::uuid;
  IF prior.lookup_id IS DISTINCT FROM v_lookup_id OR prior.completion_digest IS DISTINCT FROM digest
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN replay;
 ELSIF replay->>'status'='stale_rejected' THEN RETURN replay; END IF;
 -- Session -> job -> candidate -> state -> lookup/attempt -> calls -> policy -> identities.
 SELECT * INTO sess FROM public.image_extraction_sessions WHERE id=(f->>'sessionId')::uuid FOR KEY SHARE;
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=(f->>'jobId')::uuid FOR UPDATE;
 SELECT * INTO prior FROM marketplace_sec.phase9_automatic_completion_effects e WHERE e.job_id=j.id;
 IF prior.lookup_id IS NOT NULL THEN
  IF prior.completion_digest IS DISTINCT FROM digest THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN marketplace_sec.phase9_recover_automatic_metadata_v1(f);
 END IF;
 IF sess.store_id::text IS DISTINCT FROM f->>'storeId'
  OR NOT marketplace_sec.phase9_owner_ux_session_mutable(sess)
  OR j.entity_id::text IS DISTINCT FROM f->>'candidateId' OR j.store_id IS DISTINCT FROM sess.store_id
  OR j.job_kind IS DISTINCT FROM 'metadata_enrich' OR j.entity_type IS DISTINCT FROM 'candidate'
  OR j.operation_version='p9-owner-edition-options-v1'
  OR j.status IS DISTINCT FROM 'in_progress' OR j.lease_owner IS DISTINCT FROM f->>'worker'
  OR j.lease_token_hash IS DISTINCT FROM claim_hash OR j.attempt_count<>(f->>'claimAttempt')::integer
  OR j.lease_expires_at IS NULL OR j.lease_expires_at<=pg_catalog.clock_timestamp()
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 c:=marketplace_sec.phase9_assert_structural_metadata_candidate(j.id,f->>'worker',f->>'leaseToken',
  (f->>'claimAttempt')::integer,(f->>'candidateId')::uuid,(f->>'candidateVersion')::integer);
 IF c.session_id IS DISTINCT FROM sess.id OR c.store_id IS DISTINCT FROM sess.store_id
  OR c.expires_at<=pg_catalog.clock_timestamp()
  OR marketplace_sec.phase9_metadata_candidate_query_identity(c) IS DISTINCT FROM f->>'queryIdentity'
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 SELECT * INTO state FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id FOR UPDATE;
 IF coalesce(state.request_generation,0)<>(f->>'requestGeneration')::integer
  OR state.request_id IS DISTINCT FROM (f->>'capturedRequestId')::uuid
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=v_lookup_id AND job_id=j.id
  AND candidate_id=c.id AND store_id=c.store_id AND query_identity=f->>'queryIdentity' FOR UPDATE;
 IF l.id IS NULL AND EXISTS(SELECT 1 FROM public.phase9_metadata_lookups source WHERE source.id=v_lookup_id)
 THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF l.id IS NOT NULL AND (l.claim_attempt_number<>(f->>'claimAttempt')::integer
  OR l.claim_worker IS DISTINCT FROM f->>'worker' OR l.claim_lease_token_hash IS DISTINCT FROM claim_hash
  OR l.completed_at IS NOT NULL OR l.leader_lookup_id IS NOT NULL)
 THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF rows IS NULL AND selected_id IS NOT NULL THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 IF m IS NULL AND selected_id IS NOT NULL THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 IF rows IS NOT NULL AND m IS NOT NULL AND (selected_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM pg_catalog.jsonb_array_elements(rows) row WHERE row->>'optionId'=selected_id::text
   AND row->>'eligibility'='eligible' AND row->'metadata'=m))
 THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 summary:=CASE o->>'outcome' WHEN 'coherent_match' THEN 'accepted_metadata_match'
  WHEN 'ambiguous_match' THEN 'ambiguous' WHEN 'material_conflict' THEN 'material_conflict'
  WHEN 'no_acceptable_match' THEN 'no_match' WHEN 'insufficient_query' THEN 'manual_metadata_required'
  WHEN 'cost_quota_denied' THEN 'cost_quota_denied'
  WHEN 'policy_denied' THEN 'policy_denied' WHEN 'provider_disabled' THEN 'policy_denied'
  WHEN 'legal_launch_denied' THEN 'policy_denied' WHEN 'cancelled' THEN 'policy_denied'
  WHEN 'authentication_configuration_failure' THEN 'policy_denied' ELSE 'technical_failure' END;
 -- 02c §4.3: 8a-5 owns retry scheduling while claims remain. Exhaustion
 -- uses the existing terminal transaction; an expired fifth lease cannot be
 -- reclaimed by M15 or failed by the lease-fenced M32 failure handler.
 queue_terminal:=marketplace_sec.phase9_automatic_terminal_run_v1(p_command);
 IF (o->>'retryable')::boolean AND (queue_terminal IS NULL AND j.attempt_count<j.max_attempts OR summary<>'technical_failure')
 THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF p_command->>'source'='local' THEN
  -- Zero-egress manual result. Existing canonical-local/cache hits continue
  -- through their validated legacy boundaries, with no invented provider rows.
  IF v_attempt_id IS NOT NULL OR m IS NOT NULL OR rows IS NOT NULL OR companions<>'[]'::jsonb
   OR o->'candidates'<>'[]'::jsonb OR o->'representativeCover'<>'null'::jsonb
   OR EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts a0 WHERE a0.lookup_id=v_lookup_id)
   OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations u WHERE u.job_id=j.id)
   OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls call WHERE call.job_id=j.id)
   OR (l.id IS NOT NULL AND l.execution_mode<>'local')
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF l.id IS NULL THEN
   INSERT INTO public.phase9_metadata_lookups(id,candidate_id,store_id,job_id,query_identity,execution_mode,
    schema_version,lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,
    privacy_scope,claim_attempt_number,claim_worker,claim_lease_token_hash)
   VALUES(v_lookup_id,c.id,c.store_id,j.id,f->>'queryIdentity','local','p9-metadata-foundation-v1',
    CASE WHEN marketplace_sec.phase9_metadata_normalized_isbn13(c.observed_isbn_clue) IS NULL
     THEN 'bibliographic' ELSE 'isbn' END,'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','store_private',(f->>'claimAttempt')::integer,f->>'worker',claim_hash)
   RETURNING * INTO l;
  END IF;
 ELSE
  IF l.id IS NULL OR v_attempt_id IS NULL OR l.execution_mode<>'external'
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE id=v_attempt_id AND lookup_id=l.id
   AND candidate_id=c.id AND store_id=c.store_id FOR UPDATE;
  IF a.id IS NULL OR a.disposition<>'unresolved' OR a.provider_role NOT IN ('primary','secondary')
   OR a.normalizer_version IS DISTINCT FROM l.normalizer_version OR a.schema_version IS DISTINCT FROM l.schema_version
   OR a.routing_policy_version IS DISTINCT FROM l.routing_policy_version
   OR (a.provider_role='primary' AND (a.adapter_key IS DISTINCT FROM l.adapter_key OR a.adapter_version IS DISTINCT FROM l.adapter_version))
   OR (a.provider_role='secondary' AND NOT EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts pred
    WHERE pred.id=a.predecessor_attempt_id AND pred.lookup_id=l.id AND pred.candidate_id=c.id AND pred.store_id=c.store_id
     AND pred.provider_role='primary' AND pred.adapter_key=l.adapter_key AND pred.adapter_version=l.adapter_version
     AND pred.disposition IN ('rejected','failed') AND pred.normalized_outcome=a.predecessor_outcome
     AND pred.normalized_outcome IN ('no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
      'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open',
      'network_failure','response_too_large','unsupported_content_type')))
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF queue_terminal='no_egress_terminal' THEN
   -- Exact persisted unsent breaker decision; no fabricated current receipt.
   pc:=NULL;
  ELSE
  PERFORM 1 FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id
   AND call.claim_attempt_number=j.attempt_count ORDER BY call.created_at,call.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id
   AND call.claim_attempt_number=j.attempt_count AND (call.job_id IS DISTINCT FROM j.id
    OR call.candidate_id IS DISTINCT FROM c.id OR call.store_id IS DISTINCT FROM c.store_id
    OR call.claim_worker IS DISTINCT FROM f->>'worker' OR call.claim_lease_token_hash IS DISTINCT FROM claim_hash
    OR call.status IS DISTINCT FROM 'finalized'
    OR (call.retryable AND NOT ((j.attempt_count>=j.max_attempts OR coalesce(queue_terminal='physical_terminal',false)) AND (o->>'retryable')::boolean))))
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=a.id
   AND claim_attempt_number=j.attempt_count ORDER BY created_at DESC,id DESC LIMIT 1;
  IF pc.id IS NULL THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF pc.edition_call_sequence IS NULL THEN
    -- 02c §§3.2/4.3: installed single-call protocol, including legacy receipts.
   IF pc.logical_outcome IS DISTINCT FROM o->>'outcome' OR pc.provider_request_id IS DISTINCT FROM o->>'providerRequestId'
    OR pc.normalized_candidate IS DISTINCT FROM m
    OR pc.match_evidence IS DISTINCT FROM o->'evidence'
     OR pc.retryable IS DISTINCT FROM (o->>'retryable')::boolean
    OR (SELECT count(*) FROM public.phase9_metadata_provider_calls call
     WHERE call.logical_attempt_id=a.id AND call.claim_attempt_number=j.attempt_count)<>1
     OR pc.edition_call_stage IS NOT NULL
     OR (NOT coalesce(marketplace_sec.phase9_provider_stage_valid_v1(
       a.adapter_key,a.adapter_version,NULL,NULL,l.lookup_strategy),false)
      AND NOT marketplace_sec.phase9_provider_legacy_route_v1(a.adapter_key,a.adapter_version,false,a.provider_role))
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  ELSE
   -- 02c §4.3: fan-out receipts do not bind selected metadata bytes. A winner
   -- must therefore have the exact retained row and companion checked below.
   IF m IS NOT NULL AND rows IS NULL THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
   SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('callSequence',call.edition_call_sequence,
    'callStage',call.edition_call_stage,'status',call.status,'egressStarted',call.edition_egress_started,
    'retryable',call.retryable,'normalizedOutcome',call.normalized_outcome,'logicalOutcome',call.logical_outcome,
    'normalizedCandidate',call.normalized_candidate,'matchEvidence',call.match_evidence) ORDER BY call.created_at,call.id)
   INTO receipts FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id AND call.claim_attempt_number=j.attempt_count;
   terminal:=receipts->(pg_catalog.jsonb_array_length(receipts)-1);
   envelope:=pg_catalog.jsonb_build_object('providerRole',a.provider_role,'primaryAdapterKey',l.adapter_key,
    'predecessorOutcome',a.predecessor_outcome,'queryKind',l.lookup_strategy,'rows',coalesce(rows,'[]'::jsonb),
    'terminalReceipt',terminal,'receipts',receipts);
   IF (o->>'retryable')::boolean THEN
    -- 02c §4.3: the success/list validator cannot validate a technical
    -- failure. On exhaustion only, prove the terminal failure and its complete
    -- registered stage prefix; no retained list or selected bytes are admitted.
    IF rows IS NOT NULL OR m IS NOT NULL OR companions<>'[]'::jsonb
     OR o->'candidates'<>'[]'::jsonb OR o->'evidence'<>'[]'::jsonb
     OR o->'representativeCover'<>'null'::jsonb OR pc.retryable IS DISTINCT FROM true
     OR pc.normalized_outcome IS DISTINCT FROM o->>'outcome'
     OR pc.logical_outcome IS DISTINCT FROM o->>'outcome'
     OR pc.provider_request_id IS DISTINCT FROM o->>'providerRequestId'
     OR pg_catalog.jsonb_array_length(receipts)<>pc.edition_call_sequence+1
     OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls call
      WHERE call.logical_attempt_id=a.id AND call.claim_attempt_number=j.attempt_count
       AND (call.edition_egress_started IS DISTINCT FROM true
        OR call.edition_call_sequence NOT BETWEEN 0 AND pc.edition_call_sequence
        OR NOT coalesce(marketplace_sec.phase9_provider_stage_valid_v1(a.adapter_key,a.adapter_version,
         call.edition_call_sequence,call.edition_call_stage,l.lookup_strategy),false)
        OR call.normalized_candidate IS NOT NULL OR call.match_evidence IS DISTINCT FROM '[]'::jsonb
        OR (call.id<>pc.id AND (call.retryable OR NOT coalesce(
         marketplace_sec.phase9_provider_stage_continues_v1(a.adapter_key,a.adapter_version,
          call.edition_call_sequence,call.edition_call_stage,call.normalized_outcome),false)))))
    THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
    valid:=true; logical_outcome:=pc.logical_outcome;
   ELSE
     -- 02c §4.3: this validator proves the successful list/physical protocol.
     -- Its explicit-list summary does not rank the automatic winner or ties.
     IF o->>'outcome' NOT IN ('coherent_match','ambiguous_match','material_conflict','no_acceptable_match')
      OR (o->>'outcome'='ambiguous_match' AND pg_catalog.jsonb_array_length(o->'candidates')=0)
     THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
    SELECT checked.valid,checked.logical_outcome INTO valid,logical_outcome
     FROM marketplace_sec.phase9_provider_call_contract_v1(a.adapter_key,a.adapter_version,envelope) checked;
   END IF;
    IF NOT coalesce(valid,false)
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  END IF;
  END IF;
  PERFORM 1 FROM public.phase9_usage_reservations u WHERE u.id=a.usage_reservation_id
   AND u.job_id=j.id AND u.store_id=c.store_id AND u.status IN ('reserved','consumed') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  policy:=marketplace_sec.phase9_catalogue_source_policy_v2(a.adapter_key,a.adapter_version);
  SELECT * INTO registry FROM public.phase9_provider_registry pr WHERE pr.adapter_key=a.adapter_key;
  IF queue_terminal IS NULL AND (policy IS NULL OR policy->>'policyVersion' IS DISTINCT FROM l.reuse_policy_version
   OR NOT coalesce(registry.enabled AND registry.matching_allowed AND registry.storage_allowed
    AND registry.adapter_version=a.adapter_version AND registry.automatic_lookup_allowed
    AND registry.automatic_role=a.provider_role AND registry.automatic_order=CASE a.provider_role WHEN 'primary' THEN 1 ELSE 2 END
    AND marketplace_sec.phase9_provider_automatic_supported_v1(a.adapter_key,a.adapter_version)
    AND registry.version_contracts->a.adapter_version=marketplace_sec.phase9_provider_validation_contract_v1(a.adapter_key,a.adapter_version)
    AND registry.version_contracts#>>ARRAY[a.adapter_version,'capabilityVersion']=a.capability_version
    AND registry.version_contracts#>>ARRAY[a.adapter_version,'lookupSchemaVersion']=a.schema_version
    AND registry.version_contracts#>>ARRAY[a.adapter_version,'normalizerVersion']=a.normalizer_version,false))
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF rows IS NOT NULL THEN
   fetched:=(result#>>'{retention,sourceFetchedAt}')::timestamptz;
   deadline:=(result#>>'{retention,permittedDeadlineAt}')::timestamptz;
   IF result#>>'{retention,policyVersion}' IS DISTINCT FROM policy->>'policyVersion'
    OR NOT marketplace_sec.phase9_provider_retention_valid_v1(result#>>'{retention,retentionContract}',fetched,deadline,policy)
    OR fetched>pg_catalog.clock_timestamp() OR deadline<=pg_catalog.clock_timestamp()
    OR (registry.options_retention_seconds IS NOT NULL AND deadline>fetched+registry.options_retention_seconds*interval '1 second')
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  END IF;
  FOR proof IN SELECT value FROM pg_catalog.jsonb_array_elements(o->'candidates')
   UNION ALL SELECT value->'metadata' FROM pg_catalog.jsonb_array_elements(coalesce(rows,'[]'::jsonb))
    WHERE value->'metadata'<>'null'::jsonb LOOP
   IF proof->>'correlationId' IS DISTINCT FROM l.id::text OR proof->>'attemptId' IS DISTINCT FROM a.id::text
    OR proof->>'adapterKey' IS DISTINCT FROM a.adapter_key OR proof->>'adapterVersion' IS DISTINCT FROM a.adapter_version
    OR proof->>'normalizerVersion' IS DISTINCT FROM a.normalizer_version
    OR (proof->>'fetchedAt')::timestamptz>pg_catalog.clock_timestamp()
   THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
  END LOOP;
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(coalesce(rows,'[]'::jsonb)) LOOP
   IF r->'metadata'='null'::jsonb THEN CONTINUE; END IF;
   IF (r#>>'{metadata,fetchedAt}')::timestamptz IS DISTINCT FROM fetched
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  END LOOP;
  FOR companion IN SELECT value FROM pg_catalog.jsonb_array_elements(companions) LOOP
   IF rows IS NULL AND pg_catalog.jsonb_array_length(companions)>1
   THEN RAISE EXCEPTION 'P9_CATALOGUE_COMPANION_INVALID'; END IF;
   IF rows IS NULL THEN proof:=m;
   ELSE SELECT value->'metadata' INTO proof FROM pg_catalog.jsonb_array_elements(rows)
    WHERE value->>'optionId'=companion->>'optionId'; END IF;
   IF proof IS NULL OR NOT coalesce(marketplace_sec.phase9_catalogue_valid_companion_v1(companion,proof,
    CASE WHEN rows IS NULL THEN NULL ELSE (companion->>'optionId')::uuid END),false)
    OR (rows IS NOT NULL AND (companion->>'optionId')::uuid=ANY(seen))
   THEN RAISE EXCEPTION 'P9_CATALOGUE_COMPANION_INVALID'; END IF;
   seen:=pg_catalog.array_append(seen,(companion->>'optionId')::uuid);
   INSERT INTO marketplace_sec.phase9_catalogue_companions(lookup_id,attempt_id,candidate_id,store_id,session_id,
    provider_record_id,option_id,payload_version,metadata_digest,companion)
   VALUES(l.id,a.id,c.id,c.store_id,c.session_id,companion->>'providerRecordId',(companion->>'optionId')::uuid,
    companion->>'version',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(proof::text,'UTF8')),'hex'),companion);
  END LOOP;
  IF rows IS NOT NULL AND m IS NOT NULL AND NOT selected_id=ANY(seen)
  THEN RAISE EXCEPTION 'P9_CATALOGUE_COMPANION_INVALID'; END IF;
  INSERT INTO marketplace_sec.phase9_catalogue_lookup_effects(lookup_id,candidate_id,store_id,session_id,
   request_generation,completion_digest,canonical_results,completion_response)
  VALUES(l.id,c.id,c.store_id,c.session_id,(f->>'requestGeneration')::integer,digest,'[]','{}');
  -- Complete bounded plan before acquiring any canonical identity lock.
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(coalesce(rows,CASE WHEN m IS NOT NULL THEN
   pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('optionId',NULL,'eligibility','eligible','metadata',m)) ELSE '[]'::jsonb END)) LOOP
   IF (policy->>'sharedAdmitted')::boolean AND r->>'eligibility'='eligible' THEN
    SELECT value INTO cm FROM pg_catalog.jsonb_array_elements(companions)
     WHERE value->'optionId' IS NOT DISTINCT FROM r->'optionId';
    -- Explicit eligibility stays authoritative; automatic query is independently derived.
    IF marketplace_sec.phase9_edition_option_eligible(r->'metadata',marketplace_sec.phase9_edition_query_identity(c)) THEN
     keys:=keys||marketplace_sec.phase9_catalogue_plan_keys_v1(r->'metadata',cm);
    END IF;
   END IF;
  END LOOP;
  FOR key IN SELECT DISTINCT k FROM pg_catalog.unnest(keys) k ORDER BY k LOOP
   PERFORM pg_catalog.pg_advisory_xact_lock(key);
  END LOOP;
  IF j.lease_expires_at<=pg_catalog.clock_timestamp() OR deadline<=pg_catalog.clock_timestamp()
  THEN RAISE SQLSTATE 'P9A01'; END IF;
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(coalesce(rows,CASE WHEN m IS NOT NULL THEN
   pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('optionId',NULL,'eligibility','eligible','metadata',m)) ELSE '[]'::jsonb END)) LOOP
   IF NOT (policy->>'sharedAdmitted')::boolean OR r->>'eligibility'<>'eligible'
    OR NOT marketplace_sec.phase9_edition_option_eligible(r->'metadata',marketplace_sec.phase9_edition_query_identity(c)) THEN CONTINUE; END IF;
   SELECT value INTO cm FROM pg_catalog.jsonb_array_elements(companions)
    WHERE value->'optionId' IS NOT DISTINCT FROM r->'optionId';
   next_keys:=marketplace_sec.phase9_catalogue_plan_keys_v1(r->'metadata',cm);
   IF NOT next_keys<@keys THEN CONTINUE; END IF;
   SELECT * INTO pair FROM marketplace_sec.phase9_catalogue_resolve_v1(r->'metadata',cm,policy);
   v_results:=v_results||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'optionId',r->'optionId','canonicalWorkId',pair.canonical_work_id,'canonicalEditionId',pair.canonical_edition_id));
  END LOOP;
  -- Preserve every original position, including an explicit skipped pair.
  IF rows IS NOT NULL THEN
   SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('optionId',original->'optionId',
    'canonicalWorkId',hit->'canonicalWorkId','canonicalEditionId',hit->'canonicalEditionId')
    ORDER BY (original->>'ordinal')::integer),'[]'::jsonb) INTO v_results
   FROM pg_catalog.jsonb_array_elements(rows) original LEFT JOIN LATERAL (
    SELECT value AS hit FROM pg_catalog.jsonb_array_elements(v_results)
    WHERE value->'optionId'=original->'optionId') resolved ON true;
  END IF;
  SELECT (value->>'canonicalWorkId')::uuid,(value->>'canonicalEditionId')::uuid
   INTO selected_work,selected_edition FROM pg_catalog.jsonb_array_elements(v_results)
   WHERE m IS NOT NULL AND value->>'optionId' IS NOT DISTINCT FROM selected_id::text;
  UPDATE marketplace_sec.phase9_catalogue_lookup_effects SET canonical_results=v_results
   WHERE lookup_id=l.id;
  UPDATE public.metadata_enrichment_attempts SET disposition=CASE WHEN m IS NULL THEN 'rejected' ELSE 'accepted' END,
    -- 02c §§4.2/4.3: accepted attempts use the canonical outcome consumed by
    -- the existing representative-cover writer; physical receipts stay intact.
    normalized_outcome=CASE WHEN m IS NOT NULL THEN summary ELSE o->>'outcome' END,
    normalized_payload=m,provider_request_id=pc.provider_request_id,
   status='completed',completed_at=pg_catalog.transaction_timestamp() WHERE id=a.id;
  UPDATE public.phase9_usage_reservations SET status='consumed',actual_cost_units=coalesce(actual_cost_units,0),
   updated_at=pg_catalog.transaction_timestamp() WHERE id=a.usage_reservation_id;
  IF o->'representativeCover'<>'null'::jsonb THEN
   proof:=o->'representativeCover';
   IF m IS NULL OR m->>'coverReference' IS NOT NULL OR pg_catalog.jsonb_typeof(proof)<>'object'
    OR NOT proof ?& ARRAY['coverReference','sourceRelation','sourceProviderRecordId','selectionPolicyVersion','matchEvidence']
    OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(proof))<>5 OR NOT EXISTS(
     SELECT 1 FROM pg_catalog.jsonb_array_elements(o->'candidates') source
     WHERE source->>'providerRecordId'=proof->>'sourceProviderRecordId'
      AND source->>'providerRecordId'<>m->>'providerRecordId' AND source->'coverReference'=proof->'coverReference'
      AND marketplace_sec.phase9_metadata_normalized_text(source->>'title')=marketplace_sec.phase9_metadata_normalized_text(m->>'title')
      AND pg_catalog.split_part(pg_catalog.lower(source->>'language'),'-',1)=pg_catalog.split_part(pg_catalog.lower(m->>'language'),'-',1)
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['subtitle','series','volume']) field
       WHERE source->>field IS NOT NULL AND m->>field IS NOT NULL
        AND marketplace_sec.phase9_metadata_normalized_text(source->>field)<>marketplace_sec.phase9_metadata_normalized_text(m->>field))
      AND marketplace_sec.phase9_catalogue_normalized_authors_v1(ARRAY(SELECT pg_catalog.jsonb_array_elements_text(source->'authors')))
       =marketplace_sec.phase9_catalogue_normalized_authors_v1(ARRAY(SELECT pg_catalog.jsonb_array_elements_text(m->'authors'))))
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
   PERFORM marketplace_sec.phase9_store_metadata_representative_cover_v1(a.id,l.id,j.id,f->>'worker',
    f->>'leaseToken',(f->>'claimAttempt')::integer,c.id,c.version,proof->>'coverReference',
    proof->>'sourceProviderRecordId',proof->>'sourceRelation',proof->>'selectionPolicyVersion',proof->'matchEvidence');
  END IF;
 END IF;
 -- Late stale refusal rolls back private and shared writes in this block too.
 IF j.lease_expires_at<=pg_catalog.clock_timestamp() OR sess.expires_at<=pg_catalog.clock_timestamp()
  OR c.expires_at<=pg_catalog.clock_timestamp() OR deadline<=pg_catalog.clock_timestamp()
 THEN RAISE SQLSTATE 'P9A01'; END IF;
 -- 02d alone owns alternatives publication. Preserve selected bytes and binding.
 INSERT INTO public.phase9_selected_metadata_snapshots(candidate_id,store_id,lookup_id,canonical_edition_id,selected_attempt_id,
  outcome_source_attempt_id,snapshot_version,selection_policy_version,coherent_edition,match_evidence,manual_outcome)
 VALUES(c.id,c.store_id,l.id,selected_edition,CASE WHEN m IS NOT NULL THEN a.id END,a.id,
  'p9-selected-v1','p9-metadata-selection-v1',m,o->'evidence',summary) RETURNING id INTO v_snapshot_id;
 UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=v_snapshot_id,
  canonical_edition_id=selected_edition,
  metadata_attempt_id=CASE WHEN m IS NOT NULL THEN a.id END,
  state=CASE WHEN m IS NOT NULL THEN 'ready' ELSE 'needs_review' END,updated_at=pg_catalog.transaction_timestamp() WHERE id=c.id RETURNING * INTO c;
 prefill:=marketplace_sec.phase9_prefill_automatic_editions_v1(c,j,l,a,rows,fetched,deadline,(f->>'requestGeneration')::integer,registry);
 UPDATE public.phase9_metadata_lookups SET normalized_outcome=summary,outcome_source_attempt_id=a.id,canonical_edition_id=selected_edition,
  reuse_source_attempt_id=CASE WHEN m IS NOT NULL THEN a.id END,completed_at=pg_catalog.transaction_timestamp() WHERE id=l.id;
 response:=pg_catalog.jsonb_build_object('version','p9-auto-completion-v1','status','completed',
  'lookupId',l.id,'snapshotId',v_snapshot_id,'outcome',summary,'selectedOptionId',selected_id,
  'prefill',prefill);
 INSERT INTO marketplace_sec.phase9_automatic_completion_effects(lookup_id,job_id,candidate_id,store_id,session_id,
  candidate_version,query_identity,claim_worker,claim_lease_token_hash,claim_attempt_number,request_generation,
  captured_request_id,selected_option_id,snapshot_id,completion_digest,receipt)
 VALUES(l.id,j.id,c.id,c.store_id,c.session_id,(f->>'candidateVersion')::integer,f->>'queryIdentity',f->>'worker',claim_hash,
  (f->>'claimAttempt')::integer,(f->>'requestGeneration')::integer,(f->>'capturedRequestId')::uuid,
  selected_id,v_snapshot_id,digest,response);
 IF a.id IS NOT NULL THEN
  UPDATE marketplace_sec.phase9_catalogue_lookup_effects SET completion_response=response WHERE lookup_id=l.id;
  IF selected_work IS NOT NULL THEN PERFORM marketplace_sec.phase9_catalogue_count_search_v1(
   c.id,c.store_id,c.session_id,l.id,selected_work); END IF;
 END IF;
 UPDATE public.image_extraction_jobs SET status=CASE WHEN summary='technical_failure' THEN 'dead_letter' ELSE 'resolved' END,
  lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,completed_at=pg_catalog.transaction_timestamp(),
   -- 02c §4.3 / M32 terminal semantics: record failure evidence and clear old retries on success.
   dead_lettered_at=CASE WHEN summary='technical_failure' THEN pg_catalog.transaction_timestamp() END,
   last_safe_error_code=CASE WHEN summary='technical_failure' THEN
      CASE WHEN j.attempt_count>=j.max_attempts THEN 'P9_METADATA_ATTEMPTS_EXHAUSTED'
       ELSE 'P9_METADATA_TECHNICAL_FAILURE' END
     WHEN summary='accepted_metadata_match' THEN NULL ELSE pg_catalog.upper('P9_METADATA_'||summary) END,
   last_safe_error_category=CASE WHEN summary<>'accepted_metadata_match' THEN 'metadata' END,
  updated_at=pg_catalog.transaction_timestamp() WHERE id=j.id;
 RETURN response;
EXCEPTION WHEN SQLSTATE 'P9A01' THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected');
 WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow
 OR numeric_value_out_of_range THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID';
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_legacy_choices(p_candidate public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.phase9_candidate_edition_state; rows jsonb:='[]'; selection jsonb; m jsonb; status text:='idle';
 fresh boolean:=false; query_ok boolean;
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id
  AND store_id=p_candidate.store_id AND session_id=p_candidate.session_id;
 query_ok:=s.query_identity=marketplace_sec.phase9_edition_query_identity(p_candidate);
 fresh:=coalesce(query_ok AND s.options_expires_at>transaction_timestamp() AND marketplace_sec.phase9_edition_source_policy(s),false);
 IF fresh THEN SELECT coalesce(jsonb_agg(jsonb_set(r,'{metadata}',CASE WHEN r->'metadata'='null'
  THEN 'null'::jsonb ELSE marketplace_sec.phase9_edition_snapshot(r->'metadata') END) ORDER BY ordinal),'[]')
  INTO rows FROM jsonb_array_elements(s.options) WITH ORDINALITY x(r,ordinal); END IF;
 IF query_ok AND s.selection_id IS NOT NULL THEN
  selection:=jsonb_build_object('selectionId',s.selection_id,'source',s.selected_source,'optionId',
   CASE WHEN s.selected_source='edition_option' THEN s.selected_source_id ELSE NULL END,
   'snapshot',marketplace_sec.phase9_edition_snapshot(s.selected_option_snapshot));
 ELSE
  m:=marketplace_sec.phase9_edition_current_snapshot(p_candidate);
  IF m IS NOT NULL THEN selection:=jsonb_build_object('selectionId',p_candidate.selected_metadata_snapshot_id,
   'source','current_suggestion','optionId',NULL,'snapshot',m); END IF;
 END IF;
 IF s.request_id IS NOT NULL AND query_ok THEN
  SELECT CASE WHEN j.operation_version IS DISTINCT FROM 'p9-owner-edition-options-v1'
    THEN CASE WHEN fresh THEN 'ready' ELSE 'idle' END
   WHEN marketplace_sec.phase9_edition_job_exhausted(j) THEN 'failed'
   WHEN j.status IN('open','in_progress','retry_scheduled') THEN 'pending'
   WHEN j.status IN('resolved','resolved_noop') AND fresh THEN 'ready' ELSE 'failed' END INTO status
   FROM public.image_extraction_jobs j WHERE id=s.request_id;
 END IF;
 RETURN jsonb_build_object('sessionId',p_candidate.session_id,'candidateId',p_candidate.id,
  'requestGeneration',coalesce(s.request_generation,0),'optionsVersion',coalesce(s.options_version,0),
  'optionsExpiresAt',CASE WHEN fresh THEN s.options_expires_at ELSE NULL END,'rows',rows,'selection',selection,
  'lookupStatus',coalesce(status,'idle'),'candidateVersion',p_candidate.version,
  'metadataRevision',p_candidate.metadata_revision,'reviewVersion',p_candidate.review_version,
  'queryLanguage',nullif(s.query_identity::jsonb->>6,'und'));
END$$;

-- CREATE OR REPLACE preserves the existing public wrappers; keep the private ACLs explicit.
ALTER FUNCTION marketplace_sec.phase9_complete_automatic_metadata_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_automatic_metadata_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_automatic_metadata_v1(jsonb) TO service_role;
ALTER FUNCTION marketplace_sec.phase9_edition_legacy_choices(public.image_extraction_candidates) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_legacy_choices(public.image_extraction_candidates) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
