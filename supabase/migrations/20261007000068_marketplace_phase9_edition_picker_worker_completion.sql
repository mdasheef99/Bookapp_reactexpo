-- Picker SDD §§4.1-4.3/5/8-9: forward Task 4 only. Local creation authorized 2026-10-07.
-- M65-M67 and applied migrations are immutable. No live application authority.
BEGIN;


-- SQL proposal §4 / MAS-17: bounded replay evidence, no metadata, plaintext token or job-status mirror.
ALTER TABLE public.phase9_candidate_edition_state ADD COLUMN failure_receipt jsonb
 CHECK(failure_receipt IS NULL OR (jsonb_typeof(failure_receipt)='object' AND octet_length(failure_receipt::text)<=1024));
-- Picker §§4.1/5/9 and SQL proposal §3.6: validate every normalized record before suitability.
CREATE FUNCTION marketplace_sec.phase9_edition_utf16_length(p_text text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path='' AS $function$
 SELECT char_length(p_text)+(SELECT count(*)::integer FROM generate_series(1,char_length(p_text)) i
  WHERE ascii(substr(p_text,i,1))>65535)
$function$;
CREATE FUNCTION marketplace_sec.phase9_edition_valid_normalized_metadata(p_metadata jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $function$
DECLARE k text; bound text; isbn10 text; isbn13 text; normalized10 text; normalized13 text;
 limits jsonb:='{"title":512,"subtitle":512,"description":5000,"publisher":256,"publishedDate":32,
 "language":35,"script":16,"editionStatement":256,"series":256,"volume":64,"format":128,
 "isbn10":32,"isbn13":32,"coverReference":512,"contractVersion":64,"schemaVersion":64,
 "adapterKey":64,"adapterVersion":64,"normalizerVersion":64,"correlationId":128,"attemptId":128,
 "providerRecordId":256,"fetchedAt":40,"matchRationale":512}';
BEGIN
 IF NOT marketplace_sec.phase9_edition_valid_metadata(p_metadata,true)
  OR p_metadata->>'contractVersion' IS DISTINCT FROM 'p9-contract-v1'
  OR p_metadata->>'schemaVersion' IS DISTINCT FROM 'p9-metadata-v1'
  OR p_metadata->>'fetchedAt' !~ ('^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T'
   || '([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$')
 THEN RETURN false; END IF;
 FOR k,bound IN SELECT key,value FROM jsonb_each_text(limits) LOOP
  IF marketplace_sec.phase9_edition_utf16_length(p_metadata->>k)>bound::integer THEN RETURN false; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_metadata->'authors') a
   WHERE marketplace_sec.phase9_edition_utf16_length(a)>256)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_metadata->'categories') a
   WHERE marketplace_sec.phase9_edition_utf16_length(a)>128) THEN RETURN false; END IF;
 isbn10:=upper(regexp_replace(p_metadata->>'isbn10','[[:space:]-]+','','g'));
 isbn13:=regexp_replace(p_metadata->>'isbn13','[[:space:]-]+','','g');
 normalized10:=marketplace_sec.phase9_metadata_normalized_isbn13(isbn10);
 normalized13:=marketplace_sec.phase9_metadata_normalized_isbn13(isbn13);
 IF (isbn10 IS NOT NULL AND (isbn10 !~ '^[0-9]{9}[0-9X]$' OR normalized10 IS NULL))
  OR (isbn13 IS NOT NULL AND (isbn13 !~ '^[0-9]{13}$' OR normalized13 IS NULL))
  OR (isbn10 IS NOT NULL AND isbn13 IS NOT NULL AND normalized10 IS DISTINCT FROM normalized13)
 THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END
$function$;
-- Picker §4.1: an absent language clue cannot contradict a validated exact ISBN.
CREATE FUNCTION marketplace_sec.phase9_edition_option_eligible(p_metadata jsonb,p_query text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $function$
DECLARE q jsonb:=p_query::jsonb;
BEGIN
 IF q->>6='und' AND q->>3 IS NOT NULL AND q->>3=marketplace_sec.phase9_metadata_normalized_isbn13(p_metadata->>'isbn13')
 THEN q:=jsonb_set(q,'{6}',p_metadata->'language'); END IF;
 RETURN marketplace_sec.phase9_edition_identity_compatible(p_metadata,q::text);
EXCEPTION WHEN others THEN RETURN false;
END
$function$;
CREATE FUNCTION marketplace_sec.phase9_edition_assert_fence(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text,p_completed boolean DEFAULT false,p_failed boolean DEFAULT false)
RETURNS public.image_extraction_candidates LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 IF NOT coalesce(p_job_id IS NOT NULL AND p_candidate_id IS NOT NULL AND p_store_id IS NOT NULL
  AND p_session_id IS NOT NULL AND p_request_id=p_job_id AND p_request_generation>=0
  AND p_worker ~ '^[A-Za-z0-9._:-]{16,128}$' AND p_lease_token ~ '^[0-9a-f]{64}$'
  AND p_attempt_count BETWEEN 1 AND 5 AND char_length(p_query_identity) BETWEEN 1 AND 2048,false)
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.store_id IS DISTINCT FROM p_store_id OR j.entity_id IS DISTINCT FROM p_candidate_id
  OR j.job_kind IS DISTINCT FROM 'metadata_enrich' OR j.entity_type IS DISTINCT FROM 'candidate'
  OR j.operation_version IS DISTINCT FROM 'p9-owner-edition-options-v1' OR j.attempt_count<>p_attempt_count
 THEN RETURN NULL; END IF;
 BEGIN c:=marketplace_sec.phase9_edition_worker_candidate(j);
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='P9_STATE_CONFLICT' THEN RETURN NULL; END IF; RAISE;
 END;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id FOR UPDATE;
 IF c.session_id IS DISTINCT FROM p_session_id OR s.request_id IS DISTINCT FROM p_request_id
  OR s.request_generation IS DISTINCT FROM p_request_generation OR s.query_identity IS DISTINCT FROM p_query_identity
 THEN RETURN NULL; END IF;
 IF j.status='in_progress' THEN
  IF j.lease_owner IS DISTINCT FROM p_worker OR j.lease_token_hash IS DISTINCT FROM
   encode(extensions.digest(p_lease_token,'sha256'),'hex') OR j.lease_expires_at IS NULL
   OR j.lease_expires_at<=transaction_timestamp() THEN RETURN NULL; END IF;
 ELSIF NOT (p_completed AND j.status IN('resolved','dead_letter') AND EXISTS(
  SELECT 1 FROM public.phase9_metadata_lookups l WHERE l.job_id=j.id AND l.candidate_id=j.entity_id
   AND l.store_id=j.store_id AND l.claim_worker=p_worker AND l.claim_attempt_number=p_attempt_count
   AND l.claim_lease_token_hash=encode(extensions.digest(p_lease_token,'sha256'),'hex') AND l.completed_at IS NOT NULL))
 THEN
  IF NOT (p_failed AND j.status IN('retry_scheduled','resolved','dead_letter') AND coalesce(s.failure_receipt @>
   jsonb_build_object('requestId',p_request_id,'requestGeneration',p_request_generation,
    'queryHash',encode(extensions.digest(p_query_identity,'sha256'),'hex'),'worker',p_worker,
    'leaseTokenHash',encode(extensions.digest(p_lease_token,'sha256'),'hex'),'claimAttempt',p_attempt_count),false))
  THEN RETURN NULL; END IF;
 END IF;
 RETURN c;
END
$function$;

CREATE FUNCTION marketplace_sec.phase9_edition_completion_receipt(p_state public.phase9_candidate_edition_state,p_status text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $function$
 SELECT jsonb_build_object('status',p_status,'requestId',p_state.request_id,
  'requestGeneration',p_state.request_generation,'optionsVersion',p_state.options_version,
  'optionsExpiresAt',p_state.options_expires_at)
$function$;

CREATE FUNCTION marketplace_sec.phase9_recover_candidate_edition_options_v1(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
BEGIN
 c:=marketplace_sec.phase9_edition_assert_fence(p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,true);
 IF c.id IS NULL THEN RETURN jsonb_build_object('status','stale_rejected'); END IF;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 IF s.source_lookup_id IS NULL THEN RETURN jsonb_build_object('status','missing'); END IF;
 IF s.options_expires_at<=transaction_timestamp() OR NOT EXISTS(
  SELECT 1 FROM public.phase9_metadata_lookups l JOIN public.metadata_enrichment_attempts a ON a.lookup_id=l.id
   JOIN public.phase9_provider_registry r ON r.adapter_key=a.adapter_key
  WHERE l.id=s.source_lookup_id AND a.id=s.source_attempt_id AND l.job_id=p_job_id
   AND l.candidate_id=c.id AND l.store_id=c.store_id AND a.candidate_id=c.id AND a.store_id=c.store_id
   AND l.query_identity=s.query_identity AND l.completed_at IS NOT NULL
   AND r.provider_kind='metadata' AND r.adapter_key='google_books' AND r.adapter_version=a.adapter_version
   AND r.policy_version::text=l.reuse_policy_version AND r.enabled AND r.matching_allowed AND r.storage_allowed)
 THEN RETURN jsonb_build_object('status','stale_rejected'); END IF;
 RETURN marketplace_sec.phase9_edition_completion_receipt(s,'replayed');
END
$function$;
CREATE FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v1(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
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
  AND candidate_id=c.id AND store_id=c.store_id AND provider_role='primary' AND adapter_key='google_books' FOR UPDATE;
 IF l.id IS NULL OR a.id IS NULL OR l.execution_mode<>'external' OR l.leader_lookup_id IS NOT NULL
  OR l.claim_attempt_number<>p_attempt_count OR l.claim_worker<>p_worker
  OR l.claim_lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
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
   char_length(r#>>'{metadata,providerRecordId}') NOT BETWEEN 1 AND 256
   OR r#>>'{metadata,providerRecordId}' !~ '^[A-Za-z0-9_-]+$'
   OR r->>'googleBooksUrl' !~ '^https://books[.]google[.]com/books[?]'
   OR regexp_count(r->>'googleBooksUrl','[?&]id=')<>1
   OR substring(r->>'googleBooksUrl' FROM '[?&]id=([^&#]*)') IS DISTINCT FROM r#>>'{metadata,providerRecordId}'
   OR (r#>>'{metadata,coverReference}' IS NOT NULL AND (
    regexp_count(r#>>'{metadata,coverReference}','[?&]id=')>1 OR (
     regexp_count(r#>>'{metadata,coverReference}','[?&]id=')=1 AND
     substring(r#>>'{metadata,coverReference}' FROM '[?&]id=([^&#]*)') IS DISTINCT FROM r#>>'{metadata,providerRecordId}')))
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
  OR pc.logical_outcome NOT IN('coherent_match','ambiguous_match','material_conflict','no_acceptable_match')
  OR a.disposition<>'unresolved' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
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
CREATE FUNCTION marketplace_sec.phase9_fail_candidate_edition_options_v1(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
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
  UPDATE public.phase9_usage_reservations r SET status='consumed',actual_cost_units=coalesce(actual_cost_units,0),
   updated_at=transaction_timestamp() WHERE r.job_id=j.id AND r.store_id=c.store_id AND r.cost_kind='metadata'
   AND EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.job_id=j.id);
 END IF;
 UPDATE public.image_extraction_jobs SET status=job_status,lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,
  last_safe_error_code=CASE WHEN outcome='technical_failure' THEN 'P9_METADATA_ATTEMPTS_EXHAUSTED' ELSE upper('P9_METADATA_'||outcome) END,
  last_safe_error_category='metadata',completed_at=transaction_timestamp(),
  dead_lettered_at=CASE WHEN job_status='dead_letter' THEN transaction_timestamp() ELSE NULL END,updated_at=transaction_timestamp()
  WHERE id=j.id;
 RETURN jsonb_build_object('status',job_status,'manual_outcome',outcome);
END
$function$;
CREATE FUNCTION public.phase9_recover_candidate_edition_options_v1(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $function$
 SELECT marketplace_sec.phase9_recover_candidate_edition_options_v1(p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity)
$function$;
CREATE FUNCTION public.phase9_complete_candidate_edition_options_v1(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text,p_lookup_id uuid,p_attempt_id uuid,p_source_fetched_at timestamptz,
 p_options_expires_at timestamptz,p_storage_permission_verified boolean,p_rows jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $function$
 SELECT marketplace_sec.phase9_complete_candidate_edition_options_v1(p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,p_lookup_id,p_attempt_id,p_source_fetched_at,p_options_expires_at,p_storage_permission_verified,p_rows)
$function$;
CREATE FUNCTION public.phase9_fail_candidate_edition_options_v1(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text,p_failure_kind text,p_retryable boolean)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $function$
 SELECT marketplace_sec.phase9_fail_candidate_edition_options_v1(p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,p_failure_kind,p_retryable)
$function$;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_structural_metadata_lookup(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_candidate_version integer,p_query_identity text,p_provider_cache_identity text,
 p_adapter_key text,p_adapter_version text,p_capability_version text,p_schema_version text,p_lookup_strategy text,
 p_lookup_contract_version text,p_normalizer_version text,p_routing_policy_version text,p_privacy_scope text,
 p_reuse_policy_version text,p_cache_policy_version text,p_cache_namespace text,p_leader_lookup_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE c public.image_extraction_candidates; explicit boolean;
BEGIN
 c:=marketplace_sec.phase9_assert_structural_metadata_candidate(
  p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
 SELECT operation_version='p9-owner-edition-options-v1' INTO explicit FROM public.image_extraction_jobs WHERE id=p_job_id;
 IF p_query_identity IS DISTINCT FROM (CASE WHEN explicit THEN marketplace_sec.phase9_edition_query_identity(c)
  ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END)
  OR (explicit AND (p_leader_lookup_id IS NOT NULL OR p_adapter_key IS DISTINCT FROM 'google_books'
   OR p_privacy_scope IS DISTINCT FROM 'store_private')) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN marketplace_sec.phase9_register_metadata_lookup(p_job_id,p_worker,p_lease_token,p_attempt_count,p_query_identity,
  p_provider_cache_identity,p_adapter_key,p_adapter_version,p_capability_version,p_schema_version,p_lookup_strategy,
  p_lookup_contract_version,p_normalizer_version,p_routing_policy_version,p_privacy_scope,p_reuse_policy_version,
  p_cache_policy_version,p_cache_namespace,p_leader_lookup_id);
END
$function$;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_structural_metadata_attempt(p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_candidate_version integer,p_provider_attempt_identity uuid,p_provider_cache_identity text,
 p_provider_role text,p_attempt_sequence integer,p_adapter_key text,p_adapter_version text,p_capability_version text,
 p_schema_version text,p_normalizer_version text,p_routing_policy_version text,p_predecessor_outcome text,p_usage_reservation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE c public.image_extraction_candidates; explicit boolean;
BEGIN
 c:=marketplace_sec.phase9_assert_structural_metadata_candidate(
  p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
 SELECT operation_version='p9-owner-edition-options-v1' INTO explicit FROM public.image_extraction_jobs WHERE id=p_job_id;
 IF (explicit AND (p_adapter_key IS DISTINCT FROM 'google_books' OR p_provider_role IS DISTINCT FROM 'primary'))
  OR NOT EXISTS(SELECT 1 FROM public.phase9_metadata_lookups l WHERE l.id=p_lookup_id AND l.job_id=p_job_id
   AND l.candidate_id=c.id AND l.store_id=c.store_id AND l.query_identity=CASE WHEN explicit
    THEN marketplace_sec.phase9_edition_query_identity(c) ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END)
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN marketplace_sec.phase9_register_metadata_attempt(p_lookup_id,p_job_id,p_worker,p_lease_token,p_attempt_count,
  p_provider_attempt_identity,p_provider_cache_identity,p_provider_role,p_attempt_sequence,p_adapter_key,p_adapter_version,
  p_capability_version,p_schema_version,p_normalizer_version,p_routing_policy_version,p_predecessor_outcome,p_usage_reservation_id);
END
$function$;
ALTER FUNCTION marketplace_sec.phase9_reserve_metadata_usage(uuid,text,text,integer,uuid,text,text,integer) RENAME TO phase9_reserve_metadata_usage_automatic;
ALTER FUNCTION marketplace_sec.phase9_register_metadata_provider_call(uuid,uuid,text,text,integer,uuid) RENAME TO phase9_register_metadata_provider_call_automatic;
ALTER FUNCTION marketplace_sec.phase9_finalize_metadata_provider_call(uuid,uuid,text,text,integer,text,text,text,text,boolean,jsonb,jsonb) RENAME TO phase9_finalize_metadata_provider_call_automatic;
ALTER FUNCTION marketplace_sec.phase9_reconcile_metadata_provider_call(uuid,uuid,text,text,integer) RENAME TO phase9_reconcile_metadata_provider_call_automatic;
ALTER FUNCTION marketplace_sec.phase9_fail_metadata_job(uuid,text,text,integer,uuid,integer,text,text,boolean) RENAME TO phase9_fail_metadata_job_automatic;
CREATE FUNCTION marketplace_sec.phase9_reserve_metadata_usage(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_lookup_id uuid,p_adapter_key text,p_adapter_version text,p_policy_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates; l public.phase9_metadata_lookups;
 reservation public.phase9_usage_reservations;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs WHERE id=p_job_id AND operation_version='p9-owner-edition-options-v1')
 THEN RETURN marketplace_sec.phase9_reserve_metadata_usage_automatic(p_job_id,p_worker,p_lease_token,p_attempt_count,p_lookup_id,p_adapter_key,p_adapter_version,p_policy_version); END IF;
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 c:=marketplace_sec.phase9_edition_worker_candidate(j);
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=p_lookup_id AND job_id=j.id AND candidate_id=c.id
  AND store_id=c.store_id AND query_identity=marketplace_sec.phase9_edition_query_identity(c);
 IF l.id IS NULL OR l.completed_at IS NOT NULL OR l.leader_lookup_id IS NOT NULL OR p_adapter_key IS DISTINCT FROM 'google_books'
  OR p_adapter_key IS DISTINCT FROM l.adapter_key OR p_adapter_version IS DISTINCT FROM l.adapter_version
  OR p_policy_version IS NULL OR p_policy_version<1 OR p_policy_version::text IS DISTINCT FROM l.reuse_policy_version
  OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key=p_adapter_key AND r.provider_kind='metadata'
   AND r.adapter_version=p_adapter_version AND r.enabled AND r.matching_allowed AND r.policy_version=p_policy_version)
 THEN RAISE EXCEPTION 'P9_METADATA_PROVIDER_DISABLED'; END IF;
 INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,operation,adapter_key,
  adapter_version,idempotency_identity,reserved_cost_units)
 VALUES(j.store_id,j.id,'metadata',p_policy_version,'metadata_lookup',p_adapter_key,p_adapter_version,j.dedupe_key,0)
 ON CONFLICT(store_id,job_id,cost_kind,policy_version) DO NOTHING;
 SELECT * INTO reservation FROM public.phase9_usage_reservations WHERE store_id=j.store_id AND job_id=j.id
  AND cost_kind='metadata' AND policy_version=p_policy_version;
 IF reservation.adapter_key IS DISTINCT FROM p_adapter_key OR reservation.adapter_version IS DISTINCT FROM p_adapter_version
  OR reservation.idempotency_identity IS DISTINCT FROM j.dedupe_key THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
 RETURN jsonb_build_object('reservation_id',reservation.id,'status',reservation.status);
END
$function$;
CREATE FUNCTION marketplace_sec.phase9_register_metadata_provider_call(p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
 p_attempt_count integer,p_physical_call_identity uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates; a public.metadata_enrichment_attempts;
 pc public.phase9_metadata_provider_calls;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs WHERE id=p_job_id AND operation_version='p9-owner-edition-options-v1')
 THEN RETURN marketplace_sec.phase9_register_metadata_provider_call_automatic(p_attempt_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_physical_call_identity); END IF;
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 c:=marketplace_sec.phase9_edition_worker_candidate(j);
 SELECT a0.* INTO a FROM public.metadata_enrichment_attempts a0 JOIN public.phase9_metadata_lookups l ON l.id=a0.lookup_id
  JOIN public.phase9_usage_reservations r ON r.id=a0.usage_reservation_id
  JOIN public.phase9_provider_registry pr ON pr.adapter_key=a0.adapter_key
  WHERE a0.id=p_attempt_id AND l.job_id=j.id AND l.candidate_id=c.id AND l.store_id=c.store_id
   AND a0.candidate_id=c.id AND a0.store_id=c.store_id AND a0.adapter_key='google_books' AND a0.provider_role='primary'
   AND l.completed_at IS NULL AND l.leader_lookup_id IS NULL AND a0.disposition='unresolved'
   AND l.query_identity=marketplace_sec.phase9_edition_query_identity(c)
   AND l.claim_attempt_number=p_attempt_count AND l.claim_worker=p_worker
   AND l.claim_lease_token_hash=encode(extensions.digest(p_lease_token,'sha256'),'hex')
   AND r.job_id=j.id AND r.store_id=c.store_id AND r.status IN('reserved','consumed')
   AND pr.enabled AND pr.matching_allowed AND pr.adapter_version=a0.adapter_version
   AND pr.policy_version::text=l.reuse_policy_version FOR UPDATE OF a0;
 IF a.id IS NULL OR p_physical_call_identity IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE physical_call_identity=p_physical_call_identity
  OR (logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count) ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF pc.id IS NOT NULL THEN
  IF pc.physical_call_identity<>p_physical_call_identity OR pc.logical_attempt_id<>a.id OR pc.job_id<>j.id
   OR pc.claim_attempt_number<>p_attempt_count OR pc.claim_worker<>p_worker
   OR pc.claim_lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
 END IF;
 INSERT INTO public.phase9_metadata_provider_calls(logical_attempt_id,job_id,candidate_id,store_id,physical_call_identity,
  claim_attempt_number,claim_worker,claim_lease_token_hash)
 VALUES(a.id,j.id,c.id,c.store_id,p_physical_call_identity,p_attempt_count,p_worker,encode(extensions.digest(p_lease_token,'sha256'),'hex'))
 RETURNING * INTO pc;
 RETURN jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
END
$function$;
CREATE FUNCTION marketplace_sec.phase9_finalize_metadata_provider_call(p_provider_call_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_status text,p_normalized_outcome text,p_logical_outcome text,p_provider_request_id text,p_retryable boolean,
 p_normalized_candidate jsonb,p_match_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.image_extraction_jobs; pc public.phase9_metadata_provider_calls; c public.image_extraction_candidates;
 effective text; active boolean:=false;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs WHERE id=p_job_id AND operation_version='p9-owner-edition-options-v1')
 THEN RETURN marketplace_sec.phase9_finalize_metadata_provider_call_automatic(p_provider_call_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_status,p_normalized_outcome,p_logical_outcome,p_provider_request_id,p_retryable,p_normalized_candidate,p_match_evidence); END IF;
 IF NOT coalesce(auth.role()='service_role' AND p_worker ~ '^[A-Za-z0-9._:-]{16,128}$'
  AND p_lease_token ~ '^[0-9a-f]{64}$' AND p_attempt_count BETWEEN 1 AND 5
  AND p_status IN('finalized','outcome_unknown','stale_rejected') AND p_normalized_outcome ~ '^[a-z][a-z0-9_]{0,63}$'
  AND p_logical_outcome ~ '^[a-z][a-z0-9_]{0,63}$' AND p_retryable IS NOT NULL
  AND p_normalized_candidate IS NULL AND p_match_evidence='[]'::jsonb
  AND (p_provider_request_id IS NULL OR (char_length(p_provider_request_id) BETWEEN 1 AND 128
   AND p_provider_request_id ~ '^[A-Za-z0-9._:-]+$')),false) THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
 SELECT pc0.* INTO pc FROM public.phase9_metadata_provider_calls pc0
  JOIN public.metadata_enrichment_attempts a ON a.id=pc0.logical_attempt_id
  JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id
  WHERE pc0.id=p_provider_call_id AND pc0.job_id=j.id AND pc0.candidate_id=j.entity_id AND pc0.store_id=j.store_id
   AND a.candidate_id=j.entity_id AND a.store_id=j.store_id AND l.job_id=j.id
   AND l.candidate_id=j.entity_id AND l.store_id=j.store_id FOR UPDATE OF pc0;
 IF pc.id IS NULL OR pc.claim_attempt_number<>p_attempt_count OR pc.claim_worker<>p_worker
  OR pc.claim_lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF pc.status<>'registered' THEN
  IF pc.status<>p_status OR pc.normalized_outcome IS DISTINCT FROM p_normalized_outcome
   OR pc.logical_outcome IS DISTINCT FROM p_logical_outcome OR pc.provider_request_id IS DISTINCT FROM p_provider_request_id
   OR pc.retryable IS DISTINCT FROM p_retryable THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
 END IF;
 BEGIN
  PERFORM marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
  c:=marketplace_sec.phase9_edition_worker_candidate(j); active:=c.id IS NOT NULL;
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT IN('P9_STATE_CONFLICT','P9_OWNER_NOT_AUTHORIZED') THEN RAISE; END IF;
 END;
 effective:=CASE WHEN active THEN p_status ELSE 'stale_rejected' END;
 UPDATE public.phase9_metadata_provider_calls SET status=effective,normalized_outcome=p_normalized_outcome,
  logical_outcome=p_logical_outcome,provider_request_id=p_provider_request_id,retryable=p_retryable,
  normalized_candidate=NULL,match_evidence='[]',completed_at=transaction_timestamp() WHERE id=pc.id;
 RETURN jsonb_build_object('provider_call_id',pc.id,'status',effective);
END
$function$;
CREATE FUNCTION marketplace_sec.phase9_reconcile_metadata_provider_call(p_provider_call_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE pc public.phase9_metadata_provider_calls; ignored jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs WHERE id=p_job_id AND operation_version='p9-owner-edition-options-v1')
 THEN RETURN marketplace_sec.phase9_reconcile_metadata_provider_call_automatic(p_provider_call_id,p_job_id,p_worker,p_lease_token,p_attempt_count); END IF;
 IF NOT coalesce(auth.role()='service_role' AND p_worker ~ '^[A-Za-z0-9._:-]{16,128}$'
  AND p_lease_token ~ '^[0-9a-f]{64}$' AND p_attempt_count BETWEEN 1 AND 5,false)
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 PERFORM 1 FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE id=p_provider_call_id AND job_id=p_job_id FOR UPDATE;
 IF pc.id IS NULL OR pc.claim_worker<>p_worker OR pc.claim_attempt_number<>p_attempt_count
  OR pc.claim_lease_token_hash<>encode(extensions.digest(p_lease_token,'sha256'),'hex')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF pc.status='registered' THEN
  ignored:=marketplace_sec.phase9_finalize_metadata_provider_call(p_provider_call_id,p_job_id,p_worker,p_lease_token,
   p_attempt_count,'outcome_unknown','provider_unavailable','provider_unavailable',NULL,true,NULL,'[]');
  SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE id=p_provider_call_id;
 END IF;
 RETURN jsonb_build_object('provider_call_id',pc.id,'status',pc.status,'normalized_outcome',pc.normalized_outcome,
  'logical_outcome',pc.logical_outcome,'provider_request_id',pc.provider_request_id,'retryable',pc.retryable,
  'normalized_candidate',NULL,'match_evidence','[]'::jsonb);
END
$function$;
CREATE FUNCTION marketplace_sec.phase9_fail_metadata_job(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_candidate_version integer,p_query_identity text,p_failure_kind text,p_retryable boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs WHERE id=p_job_id AND operation_version='p9-owner-edition-options-v1')
 THEN RETURN marketplace_sec.phase9_fail_metadata_job_automatic(p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version,p_query_identity,p_failure_kind,p_retryable); END IF;
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 c:=marketplace_sec.phase9_edition_worker_candidate(j);
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 IF (p_candidate_id IS NOT NULL AND p_candidate_id<>c.id) OR (p_candidate_version IS NOT NULL AND p_candidate_version<1)
  OR (p_query_identity IS NOT NULL AND p_query_identity<>s.query_identity) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN marketplace_sec.phase9_fail_candidate_edition_options_v1(p_job_id,p_worker,p_lease_token,p_attempt_count,
  c.id,c.store_id,c.session_id,j.id,s.request_generation,s.query_identity,p_failure_kind,p_retryable);
END
$function$;

-- Picker §5: explicit work cannot write automatic snapshots, audit payloads, reuse caches or coalesced results.
CREATE FUNCTION marketplace_sec.phase9_edition_guard_automatic_payload()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE job uuid; lookup uuid;
BEGIN
 IF TG_TABLE_NAME='phase9_metadata_lookups' THEN
  job:=NEW.job_id;
  IF EXISTS(SELECT 1 FROM public.image_extraction_jobs WHERE id=job AND operation_version='p9-owner-edition-options-v1')
   AND (NEW.execution_mode<>'external' OR NEW.leader_lookup_id IS NOT NULL OR NEW.privacy_scope<>'store_private')
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF; RETURN NEW;
 ELSIF TG_TABLE_NAME='phase9_metadata_cache_entries' THEN
  SELECT lookup_id INTO lookup FROM public.metadata_enrichment_attempts WHERE id=NEW.source_attempt_id;
 ELSE lookup:=NEW.lookup_id; END IF;
 SELECT job_id INTO job FROM public.phase9_metadata_lookups WHERE id=lookup;
 IF EXISTS(SELECT 1 FROM public.image_extraction_jobs WHERE id=job AND operation_version='p9-owner-edition-options-v1') THEN
  IF TG_TABLE_NAME='metadata_enrichment_attempts' THEN
   IF NEW.normalized_payload IS NOT NULL THEN RAISE EXCEPTION 'P9_EDITION_AUTOMATIC_PAYLOAD_DENIED'; END IF;
  ELSE RAISE EXCEPTION 'P9_EDITION_AUTOMATIC_PAYLOAD_DENIED'; END IF;
 END IF;
 RETURN NEW;
END
$function$;
CREATE TRIGGER phase9_edition_guard_lookup BEFORE INSERT OR UPDATE ON public.phase9_metadata_lookups
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_edition_guard_automatic_payload();
CREATE TRIGGER phase9_edition_guard_attempt BEFORE INSERT OR UPDATE OF normalized_payload ON public.metadata_enrichment_attempts
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_edition_guard_automatic_payload();
CREATE TRIGGER phase9_edition_guard_snapshot BEFORE INSERT OR UPDATE ON public.phase9_selected_metadata_snapshots
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_edition_guard_automatic_payload();
CREATE TRIGGER phase9_edition_guard_cache BEFORE INSERT OR UPDATE ON public.phase9_metadata_cache_entries
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_edition_guard_automatic_payload();

DO $grant$
DECLARE f record;
BEGIN
 FOR f IN SELECT n.nspname,p.proname,p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE (n.nspname='marketplace_sec' AND (p.proname LIKE 'phase9_edition_%'
   OR p.proname IN('phase9_recover_candidate_edition_options_v1','phase9_complete_candidate_edition_options_v1',
    'phase9_fail_candidate_edition_options_v1','phase9_register_structural_metadata_lookup','phase9_register_structural_metadata_attempt',
    'phase9_reserve_metadata_usage','phase9_register_metadata_provider_call','phase9_finalize_metadata_provider_call',
    'phase9_reconcile_metadata_provider_call','phase9_fail_metadata_job',
    'phase9_reserve_metadata_usage_automatic','phase9_register_metadata_provider_call_automatic',
    'phase9_finalize_metadata_provider_call_automatic','phase9_reconcile_metadata_provider_call_automatic',
    'phase9_fail_metadata_job_automatic')))
   OR (n.nspname='public' AND p.proname IN('phase9_recover_candidate_edition_options_v1',
    'phase9_complete_candidate_edition_options_v1','phase9_fail_candidate_edition_options_v1'))
 LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
  IF f.proname NOT LIKE 'phase9_edition_%' AND f.proname NOT LIKE '%_automatic'
  THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature); END IF;
 END LOOP;
END
$grant$;
COMMIT;
