-- DOC-3 §5.2.1; picker §§5/9/13.14; Master MAS-17.
-- Forward-only correction: applied M65-M73 remain immutable; no data/registry/ACL expansion.
-- Only finalized, proven-egress, nonretryable author-content failures allow later reads/completion.
-- Search/editions, retryable transport, policy/config, stale authority and unknown egress remain blocking.
-- Compatibility: install disabled before the corrected worker; old workers remain valid.
-- Rollback: disable OL/halt new claims, then separately review forward restoration of M73 guards
-- with a compatible worker. Preserve receipts, chosen facts and inventory; no destructive rollback.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v1(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text,p_lookup_id uuid,p_attempt_id uuid,p_source_fetched_at timestamptz,
 p_options_expires_at timestamptz,p_storage_permission_verified boolean,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
 l public.phase9_metadata_lookups; a public.metadata_enrichment_attempts; pc public.phase9_metadata_provider_calls;
 deadline timestamptz; r jsonb; summary text;
BEGIN
 c:=marketplace_sec.phase9_edition_assert_fence(p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,true);
 IF c.id IS NULL THEN RETURN jsonb_build_object('status','stale_rejected'); END IF;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 IF p_storage_permission_verified IS DISTINCT FROM true OR p_source_fetched_at IS NULL
  OR p_options_expires_at IS NULL OR p_source_fetched_at>transaction_timestamp()
  OR p_options_expires_at<=transaction_timestamp() THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
 deadline:=least(p_options_expires_at,p_source_fetched_at+interval '24 hours');
 IF deadline<=transaction_timestamp() THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
 IF p_lookup_id IS NULL OR p_attempt_id IS NULL OR NOT marketplace_sec.phase9_edition_valid_rows(p_rows)
 THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=p_lookup_id AND job_id=p_job_id
  AND candidate_id=c.id AND store_id=c.store_id AND query_identity=p_query_identity FOR UPDATE;
 SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE id=p_attempt_id AND lookup_id=l.id
  AND candidate_id=c.id AND store_id=c.store_id AND ((provider_role='primary' AND adapter_key IN('google_books','open_library')) OR (provider_role='secondary' AND adapter_key='open_library')) FOR UPDATE;
 IF l.id IS NULL OR a.id IS NULL OR l.execution_mode<>'external' OR l.leader_lookup_id IS NOT NULL
  OR (a.provider_role='primary' AND (a.adapter_key<>l.adapter_key OR a.adapter_version<>l.adapter_version))
  OR (a.provider_role='secondary' AND l.adapter_key<>'google_books')
  OR l.claim_attempt_number<>p_attempt_count OR l.claim_worker<>p_worker
  OR l.claim_lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF a.provider_role='secondary' AND NOT EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts primary_attempt
  WHERE primary_attempt.lookup_id=l.id AND primary_attempt.id=a.predecessor_attempt_id
   AND primary_attempt.provider_role='primary' AND primary_attempt.adapter_key='google_books'
   AND primary_attempt.disposition IN('rejected','failed')
   AND primary_attempt.normalized_outcome=a.predecessor_outcome
   AND a.predecessor_outcome IN('no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
    'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open','network_failure','response_too_large','unsupported_content_type'))
 THEN RAISE EXCEPTION 'P9_METADATA_SECONDARY_NOT_ELIGIBLE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry pr WHERE pr.adapter_key=a.adapter_key
  AND pr.adapter_version=a.adapter_version AND pr.provider_kind='metadata' AND pr.enabled
  AND pr.matching_allowed AND pr.storage_allowed AND pr.policy_version::text=l.reuse_policy_version)
 THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF r->'metadata'<>'null'::jsonb AND NOT marketplace_sec.phase9_edition_valid_normalized_metadata(r->'metadata')
  THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
  IF r->'metadata'<>'null'::jsonb AND (r#>>'{metadata,correlationId}' IS DISTINCT FROM l.id::text
   OR r#>>'{metadata,attemptId}' IS DISTINCT FROM a.id::text
   OR r#>>'{metadata,adapterVersion}' IS DISTINCT FROM a.adapter_version
   OR (r#>>'{metadata,fetchedAt}')::timestamptz IS DISTINCT FROM p_source_fetched_at)
  THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
  IF r->'metadata'<>'null'::jsonb AND (
   r#>>'{metadata,adapterKey}' IS DISTINCT FROM a.adapter_key
   OR (a.adapter_key='google_books' AND (
    char_length(r#>>'{metadata,providerRecordId}') NOT BETWEEN 1 AND 256
    OR r#>>'{metadata,providerRecordId}' !~ '^[A-Za-z0-9_-]+$'
    OR r->>'googleBooksUrl' !~ '^https://books[.]google[.]com/books[?]'
    OR regexp_count(r->>'googleBooksUrl','[?&]id=')<>1
    OR substring(r->>'googleBooksUrl' FROM '[?&]id=([^&#]*)') IS DISTINCT FROM r#>>'{metadata,providerRecordId}'
    OR (r#>>'{metadata,coverReference}' IS NOT NULL AND (
     r#>>'{metadata,coverReference}' !~ '^https://books[.]google[.]com/'
     OR regexp_count(r#>>'{metadata,coverReference}','[?&]id=')>1 OR (
      regexp_count(r#>>'{metadata,coverReference}','[?&]id=')=1 AND
      substring(r#>>'{metadata,coverReference}' FROM '[?&]id=([^&#]*)') IS DISTINCT FROM r#>>'{metadata,providerRecordId}')))))
   OR (a.adapter_key='open_library' AND (
    r#>>'{metadata,providerRecordId}' !~ '^OL[1-9][0-9]*M$'
    OR r->>'googleBooksUrl' IS DISTINCT FROM 'https://openlibrary.org/books/'||(r#>>'{metadata,providerRecordId}')
    OR (r#>>'{metadata,coverReference}' IS NOT NULL AND
     r#>>'{metadata,coverReference}' !~ '^https://covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-M[.]jpg$')))
   OR (r->>'eligibility'='eligible' AND NOT marketplace_sec.phase9_edition_option_eligible(r->'metadata',p_query_identity)))
  THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 END LOOP;
 IF l.completed_at IS NOT NULL THEN
  IF s.source_lookup_id IS DISTINCT FROM l.id OR s.source_attempt_id IS DISTINCT FROM a.id
   OR s.source_fetched_at IS DISTINCT FROM p_source_fetched_at OR s.options_expires_at IS DISTINCT FROM deadline
   OR s.options IS DISTINCT FROM p_rows THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN marketplace_sec.phase9_edition_completion_receipt(s,'replayed');
 END IF;
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=a.id AND job_id=p_job_id
  AND candidate_id=c.id AND store_id=c.store_id AND claim_attempt_number=p_attempt_count
  AND claim_worker=p_worker AND claim_lease_token_hash=encode(extensions.digest(p_lease_token,'sha256'),'hex')
  AND status='finalized' AND retryable=false ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF pc.id IS NULL OR pc.normalized_candidate IS NOT NULL OR pc.match_evidence<>'[]'::jsonb
  OR (a.adapter_key<>'open_library' AND pc.logical_outcome NOT IN('coherent_match','ambiguous_match','material_conflict','no_acceptable_match'))
  OR a.disposition<>'unresolved' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF a.adapter_key='open_library' THEN
  IF (SELECT count(*) FROM public.phase9_metadata_provider_calls
   WHERE logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count
    AND edition_call_sequence IS NOT NULL) NOT BETWEEN 1 AND 6
   OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls
    WHERE logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count
     AND (status<>'finalized' OR edition_egress_started IS DISTINCT FROM true OR retryable IS DISTINCT FROM false
      OR NOT coalesce(normalized_outcome='no_acceptable_match' OR
       (edition_call_sequence BETWEEN 2 AND 5 AND edition_call_stage ~ '^author:OL[1-9][0-9]*A$'
        AND normalized_outcome IN('malformed_response','unsupported_content_type','response_too_large')),false)
      OR normalized_candidate IS NOT NULL OR match_evidence<>'[]'::jsonb OR edition_call_sequence IS NULL))
   OR NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls
    WHERE logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count AND edition_call_sequence=0 AND edition_call_stage='search')
   OR (jsonb_array_length(p_rows)>0 AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls
    WHERE logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count AND edition_call_sequence=1 AND edition_call_stage='editions'))
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  -- Individual successful HTTP reads are not coherent-match claims; final logical outcome is derived from validated rows.
  pc.logical_outcome:=CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) ol_row
    WHERE ol_row->>'eligibility'='eligible' AND ol_row#>>'{metadata,matchRationale}'='exact_validated_isbn') THEN 'coherent_match'
   WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) ol_row WHERE ol_row->>'eligibility'='eligible') THEN 'ambiguous_match'
   ELSE 'no_acceptable_match' END;
 END IF;
 summary:=CASE pc.logical_outcome WHEN 'coherent_match' THEN 'accepted_metadata_match'
  WHEN 'ambiguous_match' THEN 'ambiguous' WHEN 'material_conflict' THEN 'material_conflict' ELSE 'no_match' END;
 UPDATE public.phase9_candidate_edition_state SET options_version=options_version+1,options=p_rows,
  source_lookup_id=l.id,source_attempt_id=a.id,source_fetched_at=p_source_fetched_at,options_expires_at=deadline,
  updated_at=transaction_timestamp() WHERE candidate_id=c.id RETURNING * INTO s;
 UPDATE public.metadata_enrichment_attempts SET disposition='rejected',normalized_outcome=pc.logical_outcome,
  normalized_payload=NULL,provider_request_id=pc.provider_request_id,status='completed',completed_at=transaction_timestamp()
  WHERE id=a.id;
 UPDATE public.phase9_usage_reservations SET status='consumed',actual_cost_units=coalesce(actual_cost_units,0),
  updated_at=transaction_timestamp() WHERE id=a.usage_reservation_id AND job_id=p_job_id AND store_id=c.store_id
  AND status IN('reserved','consumed');
 IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 UPDATE public.phase9_metadata_lookups SET normalized_outcome=summary,outcome_source_attempt_id=a.id,
  completed_at=transaction_timestamp() WHERE id=l.id;
 UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,
  lease_expires_at=NULL,completed_at=transaction_timestamp(),updated_at=transaction_timestamp() WHERE id=p_job_id;
 RETURN marketplace_sec.phase9_edition_completion_receipt(s,'completed');
END
$function$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_v1(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_physical_call_identity uuid,p_call_sequence integer,p_call_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates;
 a public.metadata_enrichment_attempts; pc public.phase9_metadata_provider_calls;
BEGIN
 IF NOT coalesce(auth.role()='service_role' AND p_physical_call_identity IS NOT NULL AND
  ((p_call_sequence=0 AND p_call_stage='search') OR (p_call_sequence=1 AND p_call_stage='editions')
   OR (p_call_sequence BETWEEN 2 AND 5 AND p_call_stage ~ '^author:OL[1-9][0-9]*A$')),false)
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 IF j.operation_version IS DISTINCT FROM 'p9-owner-edition-options-v1' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 c:=marketplace_sec.phase9_edition_worker_candidate(j);
 SELECT a0.* INTO a FROM public.metadata_enrichment_attempts a0
 JOIN public.phase9_metadata_lookups l ON l.id=a0.lookup_id
 JOIN public.phase9_usage_reservations u ON u.id=a0.usage_reservation_id
 JOIN public.phase9_provider_registry pr ON pr.adapter_key=a0.adapter_key
 WHERE a0.id=p_attempt_id AND a0.adapter_key='open_library' AND a0.disposition='unresolved'
  AND a0.candidate_id=c.id AND a0.store_id=c.store_id AND l.job_id=j.id
  AND l.candidate_id=c.id AND l.store_id=c.store_id AND l.completed_at IS NULL
  AND l.leader_lookup_id IS NULL AND l.query_identity=marketplace_sec.phase9_edition_query_identity(c)
  AND l.claim_attempt_number=p_attempt_count AND l.claim_worker=p_worker
  AND l.claim_lease_token_hash=encode(extensions.digest(p_lease_token,'sha256'),'hex')
  AND u.job_id=j.id AND u.store_id=c.store_id AND u.status IN('reserved','consumed')
  AND pr.provider_kind='metadata' AND pr.enabled AND pr.matching_allowed AND pr.storage_allowed
  AND pr.adapter_version=a0.adapter_version AND pr.policy_version::text=l.reuse_policy_version
 FOR UPDATE OF a0;
 IF a.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls
 WHERE physical_call_identity=p_physical_call_identity OR
  (logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count
   AND (edition_call_sequence=p_call_sequence OR edition_call_stage=p_call_stage))
 ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF pc.id IS NOT NULL THEN
  IF pc.physical_call_identity<>p_physical_call_identity OR pc.logical_attempt_id<>a.id
   OR pc.job_id<>j.id OR pc.claim_attempt_number<>p_attempt_count OR pc.claim_worker<>p_worker
   OR pc.claim_lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
   OR pc.edition_call_sequence IS DISTINCT FROM p_call_sequence
   OR pc.edition_call_stage IS DISTINCT FROM p_call_stage THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
 END IF;
 IF p_call_sequence>0 AND (SELECT count(*) FROM public.phase9_metadata_provider_calls
  WHERE logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count
   AND edition_call_sequence<p_call_sequence AND status='finalized' AND edition_egress_started=true AND retryable=false
   AND (normalized_outcome='no_acceptable_match' OR
    (edition_call_sequence BETWEEN 2 AND 5 AND edition_call_stage ~ '^author:OL[1-9][0-9]*A$'
     AND normalized_outcome IN('malformed_response','unsupported_content_type','response_too_large'))))<>p_call_sequence THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 INSERT INTO public.phase9_metadata_provider_calls(logical_attempt_id,job_id,candidate_id,store_id,
  physical_call_identity,claim_attempt_number,claim_worker,claim_lease_token_hash,edition_call_sequence,edition_call_stage)
 VALUES(a.id,j.id,c.id,c.store_id,p_physical_call_identity,p_attempt_count,p_worker,
  encode(extensions.digest(p_lease_token,'sha256'),'hex'),p_call_sequence,p_call_stage) RETURNING * INTO pc;
 RETURN jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
END
$function$;

-- CREATE OR REPLACE retains existing signatures/owners. Reassert the unchanged service-only boundary.
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb),
 marketplace_sec.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb),
 marketplace_sec.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text)
 TO service_role;
COMMIT;
