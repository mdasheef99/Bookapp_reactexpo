-- 02b sections 5,7.1,8,9,12: M86 / package 9b, scope and publication.
-- Depends on M85 and M84. Creates query_scope_v1 and store_cache_v1 and forward
-- replaces M84 completion v2 to publish inside its transaction, after the effect
-- and before job resolution. Deliberately no cache reader, worker change or deploy.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_query_scope_v1(p_candidate_id uuid,p_lookup_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; original public.image_extraction_candidates;
 o public.image_analysis_observations; query text;
BEGIN
 SELECT * INTO c FROM public.image_extraction_candidates WHERE id=p_candidate_id;
 SELECT query_identity INTO query FROM public.phase9_metadata_lookups
  WHERE id=p_lookup_id AND candidate_id=c.id AND store_id=c.store_id;
 -- NULL lookup is used before creation of a receiving cache-hit lookup. The
 -- already-fenced current edition request is the registered query in that case.
 IF p_lookup_id IS NULL THEN SELECT s.query_identity INTO query FROM public.phase9_candidate_edition_state s
  WHERE s.candidate_id=c.id AND s.store_id=c.store_id AND s.session_id=c.session_id; END IF;
 IF c.id IS NULL OR query IS NULL OR c.owner_isbn13 IS NOT NULL OR c.owner_review_snapshot IS NOT NULL
  OR c.analysis_schema_version IS DISTINCT FROM 'p9-vision-v2' THEN RETURN 'store_private'; END IF;
 SELECT obs.* INTO o FROM public.image_analysis_observations obs
  JOIN public.image_analysis_results result ON result.id=obs.analysis_result_id
  JOIN public.image_extraction_inputs input ON input.id=obs.input_id
  JOIN public.image_extraction_jobs job ON job.id=result.vision_job_id
  WHERE obs.id=c.analysis_observation_id AND obs.store_id=c.store_id AND obs.input_id=c.input_id
   AND obs.disposition='candidate' AND result.input_id=c.input_id AND result.session_id=c.session_id
   AND result.store_id=c.store_id AND result.vision_job_id=c.vision_job_id
   AND result.analysis_schema_version=c.analysis_schema_version
   AND result.authoritative_outcome IN('accepted','accepted_with_language_skips')
   AND input.store_id=c.store_id AND input.session_id=c.session_id AND input.source_kind IN('camera','gallery')
   AND job.store_id=c.store_id AND job.entity_id=input.id AND job.entity_type='input' AND job.job_kind='vision_extract'
   AND result.canonical_result_snapshot->'observations' @> pg_catalog.jsonb_build_array(obs.observation_snapshot)
   AND result.canonical_result_sha256=pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(result.canonical_result_snapshot::text,'UTF8')),'hex');
 IF o.id IS NULL THEN RETURN 'store_private'; END IF;
 original:=c;
 original.observed_title:=o.observation_snapshot->>'title_guess';
 original.observed_authors:=ARRAY(SELECT pg_catalog.jsonb_array_elements_text(o.observation_snapshot->'author_guesses'));
 original.observed_isbn_clue:=o.observation_snapshot->>'isbn_clue';
 original.observed_publisher_clue:=o.observation_snapshot->>'publisher_clue';
 original.observed_language:=o.observation_snapshot->>'detected_language';
 IF marketplace_sec.phase9_metadata_candidate_query_identity(original) IS NOT DISTINCT FROM query
  AND marketplace_sec.phase9_edition_query_identity(c) IS NOT DISTINCT FROM query
 THEN RETURN 'public_bibliographic'; END IF;
 RETURN 'store_private';
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_query_scope_v1(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_query_scope_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Caller owns all private locks and the registry SHARE lock before catalogue
-- resolution. This helper acquires only the final cache lock (02b section 6.2).
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_store_cache_v1(p_lookup_id uuid,p_source_policy jsonb)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.phase9_metadata_lookups; a public.metadata_enrichment_attempts;
 s public.phase9_candidate_edition_state; e marketplace_sec.phase9_catalogue_lookup_effects;
 registry public.phase9_provider_registry; cache public.phase9_metadata_cache_entries;
 r jsonb; m jsonb; companion jsonb; safe_companion jsonb; rows jsonb:='[]'; payload jsonb;
 digest text; key text; scope text; deadline timestamptz; source_deadline timestamptz; ok boolean; isbn10 text; isbn13 text;
BEGIN
 IF NOT coalesce(marketplace_sec.phase9_catalogue_source_policy_valid_v1(p_source_policy),false)
 THEN RAISE EXCEPTION 'P9_CATALOGUE_SOURCE_POLICY_INVALID'; END IF;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=p_lookup_id;
 IF l.id IS NULL OR p_source_policy->>'adapterKey' IS DISTINCT FROM l.adapter_key
  OR p_source_policy->>'adapterVersion' IS DISTINCT FROM l.adapter_version
 THEN RAISE EXCEPTION 'P9_CATALOGUE_SOURCE_POLICY_INVALID'; END IF;
 IF NOT (p_source_policy->>'sharedAdmitted')::boolean THEN RETURN NULL; END IF;
 SELECT * INTO registry FROM public.phase9_provider_registry WHERE adapter_key=l.adapter_key;
 IF p_source_policy->>'policyVersion' IS DISTINCT FROM registry.policy_version::text
  OR p_source_policy->'rawRetentionSeconds' IS DISTINCT FROM pg_catalog.to_jsonb(registry.raw_retention_seconds)
  OR p_source_policy->'revalidationSeconds' IS DISTINCT FROM coalesce(pg_catalog.to_jsonb(registry.revalidation_seconds),'null'::jsonb)
  OR p_source_policy->'sharedSourceNote' IS DISTINCT FROM coalesce(pg_catalog.to_jsonb(registry.shared_source_note),'null'::jsonb)
 THEN RAISE EXCEPTION 'P9_CATALOGUE_SOURCE_POLICY_INVALID'; END IF;
 IF registry.provider_kind IS DISTINCT FROM 'metadata' OR NOT registry.enabled OR NOT registry.matching_allowed
  OR NOT registry.storage_allowed OR NOT registry.public_display_allowed OR registry.adapter_version<>l.adapter_version
  OR registry.policy_version::text<>l.reuse_policy_version OR registry.revalidation_seconds IS NULL
 THEN RETURN NULL; END IF;
 SELECT * INTO e FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=l.id
  AND candidate_id=l.candidate_id AND store_id=l.store_id;
 IF e.cache_entry_id IS NOT NULL THEN RETURN e.cache_entry_id; END IF;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE source_lookup_id=l.id
  AND candidate_id=l.candidate_id AND store_id=l.store_id AND session_id=e.session_id
  AND request_id=l.job_id AND request_generation=e.request_generation;
 SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE id=l.outcome_source_attempt_id
  AND lookup_id=l.id AND candidate_id=l.candidate_id AND store_id=l.store_id;
 IF e.lookup_id IS NULL OR s.candidate_id IS NULL OR a.id IS NULL OR l.completed_at IS NULL
  OR l.execution_mode<>'external' OR a.status<>'completed' OR a.adapter_key<>l.adapter_key
  OR a.adapter_version<>l.adapter_version OR a.normalizer_version<>l.normalizer_version
  OR a.capability_version<>l.capability_version OR a.schema_version<>l.schema_version
  OR s.source_fetched_at IS NULL OR s.source_fetched_at>pg_catalog.clock_timestamp()
  OR NOT marketplace_sec.phase9_edition_valid_rows(s.options)
  OR e.completion_response->>'status' IS DISTINCT FROM 'completed'
 THEN RETURN NULL; END IF;
 FOREACH key IN ARRAY ARRAY[l.adapter_version,l.capability_version,l.normalizer_version,l.schema_version,
   l.routing_policy_version,l.cache_policy_version,l.reuse_policy_version] LOOP
  IF NOT marketplace_sec.phase9_catalogue_safe_text_v1(key,128) THEN RETURN NULL; END IF;
 END LOOP;
 deadline:=least(s.options_expires_at,s.source_fetched_at+registry.revalidation_seconds*interval '1 second');
 FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(s.options) LOOP
  m:=r->'metadata'; companion:=NULL;
  IF r->>'eligibility'<>'unavailable' THEN
   IF m->>'correlationId' IS DISTINCT FROM l.id::text OR m->>'attemptId' IS DISTINCT FROM a.id::text
    OR m->>'adapterKey' IS DISTINCT FROM a.adapter_key OR m->>'adapterVersion' IS DISTINCT FROM a.adapter_version
    OR m->>'normalizerVersion' IS DISTINCT FROM l.normalizer_version
    OR (m->>'fetchedAt')::timestamptz IS DISTINCT FROM s.source_fetched_at THEN RETURN NULL; END IF;
   SELECT cp.companion INTO companion FROM marketplace_sec.phase9_catalogue_companions cp
    WHERE cp.lookup_id=l.id AND cp.attempt_id=a.id AND cp.candidate_id=l.candidate_id
     AND cp.store_id=l.store_id AND cp.session_id=e.session_id AND cp.option_id=(r->>'optionId')::uuid
     AND cp.provider_record_id=m->>'providerRecordId' AND cp.metadata_digest=pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(m::text,'UTF8')),'hex');
   -- Legacy v1 options remain successful, but cannot publish an unproven companion.
   IF companion IS NULL OR NOT marketplace_sec.phase9_catalogue_valid_companion_v1(companion,m,(r->>'optionId')::uuid)
   THEN RETURN NULL; END IF;
   SELECT i.admitted,i.isbn10,i.isbn13 INTO ok,isbn10,isbn13
    FROM marketplace_sec.phase9_catalogue_isbn_v1(m->>'isbn10',m->>'isbn13') i;
   IF NOT coalesce(ok,false) THEN CONTINUE; END IF;
   IF EXISTS(SELECT 1 FROM public.canonical_editions ed
    WHERE ed.hidden AND (ed.id IN(SELECT p.canonical_edition_id FROM public.canonical_provider_ids p
      WHERE p.adapter_key=a.adapter_key AND p.id_kind='edition' AND p.external_id=m->>'providerRecordId')
     OR ed.isbn_13=isbn13 OR ed.isbn_10=isbn10))
   THEN CONTINUE; END IF;
   SELECT min(src.expires_at) INTO source_deadline FROM public.book_metadata_sources src
    WHERE src.provider=a.adapter_key AND src.provider_book_id=m->>'providerRecordId'
     AND src.fetched_at=s.source_fetched_at;
   deadline:=least(deadline,source_deadline);
   safe_companion:=pg_catalog.jsonb_build_object('version',companion->'version',
    'workExternalId',companion->'workExternalId','oclc',companion->'oclc','lccn',companion->'lccn');
   m:=m-ARRAY['correlationId','attemptId','matchRationale','confidence'];
  ELSE m:='null'; safe_companion:='null'; END IF;
  rows:=rows||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('ordinal',r->'ordinal',
   'eligibility',r->'eligibility','googleBooksUrl',r->'googleBooksUrl','providerRecordId',m->'providerRecordId',
   'metadata',m,'companion',safe_companion));
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(rows) row WHERE row->>'eligibility'<>'unavailable')
  OR deadline<=pg_catalog.clock_timestamp() THEN RETURN NULL; END IF;
 scope:=marketplace_sec.phase9_catalogue_query_scope_v1(l.candidate_id,l.id);
 -- AC7-6 / 02b sections 6.2/8.2: recheck every retained identity after the
 -- existing catalogue locks, including ineligible and conflict-skipped rows.
 -- Do not append unplanned edition locks here: earlier resolver locks may have
 -- larger UUIDs. These unlocked rows retain a recheck-to-commit hide window.
 SELECT coalesce(pg_catalog.jsonb_agg(row ORDER BY (row->>'ordinal')::integer),'[]'::jsonb) INTO rows
 FROM pg_catalog.jsonb_array_elements(rows) row
 WHERE row->>'eligibility'='unavailable' OR NOT EXISTS(
  SELECT 1 FROM public.canonical_editions ed
   CROSS JOIN marketplace_sec.phase9_catalogue_isbn_v1(row#>>'{metadata,isbn10}',row#>>'{metadata,isbn13}') i
  WHERE ed.hidden AND (ed.isbn_10=i.isbn10 OR ed.isbn_13=i.isbn13 OR ed.id IN(
   SELECT p.canonical_edition_id FROM public.canonical_provider_ids p WHERE p.adapter_key=a.adapter_key
    AND p.id_kind='edition' AND p.external_id=row->>'providerRecordId')));
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(rows) row WHERE row->>'eligibility'<>'unavailable')
 THEN RETURN NULL; END IF;
 payload:=pg_catalog.jsonb_build_object('version','psr-edition-cache-v1','sourceFetchedAt',s.source_fetched_at,'rows',rows);
 IF NOT marketplace_sec.phase9_catalogue_valid_cache_v1(payload) THEN RETURN NULL; END IF;
 digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(payload::text,'UTF8')),'hex');
 key:='psr-edition-cache-v1:'||pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
  'psr-edition-cache-v1',scope,CASE WHEN scope='store_private' THEN l.store_id ELSE NULL END,l.query_identity,
  l.adapter_key,l.adapter_version,l.capability_version,l.normalizer_version,l.schema_version,l.routing_policy_version,
  l.cache_policy_version,l.reuse_policy_version,'psr-catalogue-write-v1')::text,'UTF8')),'hex');
 INSERT INTO public.phase9_metadata_cache_entries(provider_cache_identity,query_identity,adapter_key,adapter_version,
  capability_version,normalizer_version,schema_version,cache_policy_version,reuse_policy_version,privacy_scope,store_id,
  outcome,normalized_snapshot,source_attempt_id,provider_record_id,source_fetched_at,expires_at,payload_kind,
  bibliographic_payload,payload_digest,routing_policy_version)
 VALUES(key,l.query_identity,l.adapter_key,l.adapter_version,l.capability_version,l.normalizer_version,l.schema_version,
  l.cache_policy_version,l.reuse_policy_version,scope,CASE WHEN scope='store_private' THEN l.store_id ELSE NULL END,
  'positive',NULL,NULL,NULL,s.source_fetched_at,deadline,'edition_options_v1',payload,digest,l.routing_policy_version)
 ON CONFLICT(provider_cache_identity) DO NOTHING;
 SELECT * INTO cache FROM public.phase9_metadata_cache_entries WHERE provider_cache_identity=key FOR UPDATE;
 IF cache.payload_kind<>'edition_options_v1' THEN RETURN NULL; END IF;
 IF cache.invalidated_at IS NOT NULL OR cache.expires_at<=pg_catalog.clock_timestamp()
  OR NOT marketplace_sec.phase9_catalogue_valid_cache_v1(cache.bibliographic_payload)
  OR cache.payload_digest IS DISTINCT FROM pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(cache.bibliographic_payload::text,'UTF8')),'hex') THEN
  UPDATE public.phase9_metadata_cache_entries SET bibliographic_payload=payload,payload_digest=digest,
   source_fetched_at=s.source_fetched_at,expires_at=deadline,created_at=pg_catalog.transaction_timestamp(),
   invalidated_at=NULL,invalidation_reason=NULL WHERE id=cache.id RETURNING * INTO cache;
 END IF;
 -- A live incumbent wins, including a different valid digest. Bind the receipt
 -- to what actually won; never refresh its bytes/deadline on completion replay.
 UPDATE marketplace_sec.phase9_catalogue_lookup_effects SET cache_entry_id=cache.id,cache_payload_digest=cache.payload_digest
  WHERE lookup_id=l.id;
 RETURN cache.id;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_store_cache_v1(uuid,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_store_cache_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v2(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,
 p_request_generation integer,p_query_identity text,p_lookup_id uuid,p_attempt_id uuid,
 p_source_fetched_at timestamptz,p_options_expires_at timestamptz,
 p_storage_permission_verified boolean,p_rows jsonb,p_catalogue_companions jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $completion$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
 l public.phase9_metadata_lookups; a public.metadata_enrichment_attempts; pc public.phase9_metadata_provider_calls;
 effect marketplace_sec.phase9_catalogue_lookup_effects;
 deadline timestamptz; r jsonb; companion jsonb; companions jsonb:='[]'::jsonb; metadata jsonb;
 summary text; policy jsonb; envelope jsonb; receipts jsonb; terminal jsonb; receipt jsonb;
 digest text; response jsonb; results jsonb:='[]'::jsonb; plan jsonb:='[]'::jsonb;
 keys bigint[]:=ARRAY[]::bigint[]; option_keys bigint[]; key bigint; pair record; item record;
  valid boolean; logical_outcome text; seen uuid[]:=ARRAY[]::uuid[];
  v_session public.image_extraction_sessions;
BEGIN
 -- 02b section 6.2: session before candidate, matching Add's order
 -- (owner_ux_lock_active_session then candidate FOR UPDATE). FOR KEY SHARE is
 -- the weakest lock conflicting with Add's FOR UPDATE; it is held through the
 -- effect insert so the session FK needs no new session lock. Scope is
 -- revalidated after the fence; behaviour, error codes and digest are unchanged.
 SELECT * INTO v_session FROM public.image_extraction_sessions sess
  WHERE sess.id=p_session_id FOR KEY SHARE;
 c:=marketplace_sec.phase9_edition_assert_fence(p_job_id,p_worker,p_lease_token,p_attempt_count,
   p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,true);
 IF c.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 IF v_session.id IS NULL OR v_session.id IS DISTINCT FROM c.session_id
  OR v_session.store_id IS DISTINCT FROM c.store_id
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=p_lookup_id AND job_id=p_job_id
  AND candidate_id=c.id AND store_id=c.store_id AND query_identity=p_query_identity FOR UPDATE;
 SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE id=p_attempt_id AND lookup_id=l.id
  AND candidate_id=c.id AND store_id=c.store_id AND provider_role IN('primary','secondary') FOR UPDATE;
 IF l.id IS NULL OR a.id IS NULL OR l.execution_mode<>'external' OR l.leader_lookup_id IS NOT NULL
  OR (a.provider_role='primary' AND (a.adapter_key<>l.adapter_key OR a.adapter_version<>l.adapter_version))
  OR l.claim_attempt_number<>p_attempt_count OR l.claim_worker<>p_worker
  OR l.claim_lease_token_hash<>pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF a.provider_role='secondary' AND NOT EXISTS(
  SELECT 1 FROM public.metadata_enrichment_attempts predecessor
  WHERE predecessor.lookup_id=l.id AND predecessor.id=a.predecessor_attempt_id
   AND predecessor.candidate_id=c.id AND predecessor.store_id=c.store_id
   AND predecessor.provider_role='primary' AND predecessor.adapter_key=l.adapter_key
   AND predecessor.adapter_version=l.adapter_version AND predecessor.disposition IN('rejected','failed')
   AND predecessor.normalized_outcome=a.predecessor_outcome)
 THEN RAISE EXCEPTION 'P9_METADATA_SECONDARY_NOT_ELIGIBLE'; END IF;
 SELECT * INTO effect FROM marketplace_sec.phase9_catalogue_lookup_effects e
  WHERE e.lookup_id=l.id AND e.candidate_id=c.id AND e.store_id=c.store_id AND e.session_id=c.session_id
   AND e.request_generation=p_request_generation FOR UPDATE;
 IF p_source_fetched_at IS NULL OR p_options_expires_at IS NULL
 THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
 deadline:=least(p_options_expires_at,p_source_fetched_at+interval '24 hours');
 IF NOT coalesce(marketplace_sec.phase9_edition_valid_rows(p_rows),false)
 THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 -- Pre-M84 completions keep the original M78 replay contract and get no effects.
 IF l.completed_at IS NOT NULL AND effect.lookup_id IS NULL THEN
  IF p_storage_permission_verified IS DISTINCT FROM true OR p_source_fetched_at>pg_catalog.transaction_timestamp()
   OR deadline<=pg_catalog.transaction_timestamp() THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
  IF NOT marketplace_sec.phase9_edition_source_policy(s)
  THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
  IF s.source_lookup_id IS DISTINCT FROM l.id OR s.source_attempt_id IS DISTINCT FROM a.id
   OR s.source_fetched_at IS DISTINCT FROM p_source_fetched_at OR s.options_expires_at IS DISTINCT FROM deadline
   OR s.options IS DISTINCT FROM p_rows THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN marketplace_sec.phase9_edition_completion_receipt(s,'replayed');
 END IF;
 FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(p_rows) LOOP
  metadata:=r->'metadata';
  IF metadata<>'null'::jsonb THEN
   IF NOT coalesce(marketplace_sec.phase9_edition_valid_normalized_metadata(metadata),false)
    OR metadata->>'correlationId' IS DISTINCT FROM l.id::text
    OR metadata->>'attemptId' IS DISTINCT FROM a.id::text
    OR metadata->>'adapterKey' IS DISTINCT FROM a.adapter_key
    OR metadata->>'adapterVersion' IS DISTINCT FROM a.adapter_version
    OR metadata->>'normalizerVersion' IS DISTINCT FROM a.normalizer_version
    OR metadata->>'normalizerVersion' IS DISTINCT FROM l.normalizer_version
    OR (metadata->>'fetchedAt')::timestamptz IS DISTINCT FROM p_source_fetched_at
   THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
   SELECT checked.valid INTO valid FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
     a.adapter_key,metadata->>'providerRecordId',NULL,r->>'googleBooksUrl',metadata->>'coverReference',NULL) checked;
   IF NOT coalesce(valid,false) OR r->>'googleBooksUrl' IS NULL
    OR (r->>'eligibility'='eligible' AND NOT marketplace_sec.phase9_edition_option_eligible(metadata,p_query_identity))
   THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
  END IF;
 END LOOP;
 IF p_catalogue_companions IS NOT NULL THEN
  IF pg_catalog.jsonb_typeof(p_catalogue_companions) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
  IF pg_catalog.jsonb_array_length(p_catalogue_companions)>10
   OR pg_catalog.octet_length(p_catalogue_companions::text)>32768
  THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
  FOR companion IN SELECT value FROM pg_catalog.jsonb_array_elements(p_catalogue_companions) LOOP
   SELECT value INTO r FROM pg_catalog.jsonb_array_elements(p_rows) WHERE value->>'optionId'=companion->>'optionId';
   IF r IS NULL OR r->'metadata'='null'::jsonb OR r->>'eligibility'='unavailable'
    OR NOT coalesce(marketplace_sec.phase9_catalogue_valid_companion_v1(companion,r->'metadata',(r->>'optionId')::uuid),false)
   THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
   IF (r->>'optionId')::uuid=ANY(seen) THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
   seen:=pg_catalog.array_append(seen,(r->>'optionId')::uuid);
   companions:=companions||pg_catalog.jsonb_build_array(companion||pg_catalog.jsonb_build_object(
    'workExternalId',coalesce(companion->'workExternalId','null'::jsonb),
    'oclc',coalesce(companion->'oclc','null'::jsonb),'lccn',coalesce(companion->'lccn','null'::jsonb)));
  END LOOP;
 END IF;
 IF pg_catalog.octet_length(companions::text)>32768 THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
  'version','psr-catalogue-write-v1','requestId',p_request_id,'requestGeneration',p_request_generation,
  'queryIdentity',p_query_identity,'lookupId',l.id,'attemptId',a.id,'sourceFetchedAt',p_source_fetched_at,
  'optionsExpiresAt',p_options_expires_at,'rows',p_rows,'companions',companions)::text,'UTF8')),'hex');
 IF l.completed_at IS NOT NULL THEN
  IF effect.completion_digest IS DISTINCT FROM digest THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN effect.completion_response||pg_catalog.jsonb_build_object('status','replayed');
 END IF;
 IF effect.lookup_id IS NOT NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF p_storage_permission_verified IS DISTINCT FROM true OR p_source_fetched_at>pg_catalog.transaction_timestamp()
  OR deadline<=pg_catalog.transaction_timestamp() THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
 -- M78 terminal receipt plus every current-claim call; lock before shared writes.
 PERFORM call.id FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id
  AND call.claim_attempt_number=p_attempt_count ORDER BY call.created_at,call.id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id
  AND call.claim_attempt_number=p_attempt_count AND (call.job_id IS DISTINCT FROM p_job_id
   OR call.candidate_id IS DISTINCT FROM c.id OR call.store_id IS DISTINCT FROM c.store_id
   OR call.claim_worker IS DISTINCT FROM p_worker OR call.claim_lease_token_hash IS DISTINCT FROM l.claim_lease_token_hash))
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=a.id AND job_id=p_job_id
  AND candidate_id=c.id AND store_id=c.store_id AND claim_attempt_number=p_attempt_count
  AND claim_worker=p_worker AND claim_lease_token_hash=l.claim_lease_token_hash
  AND status='finalized' AND retryable=false ORDER BY created_at DESC,id DESC LIMIT 1;
 IF pc.id IS NULL OR a.disposition<>'unresolved' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('callSequence',call.edition_call_sequence,
  'callStage',call.edition_call_stage,'status',call.status,'egressStarted',call.edition_egress_started,
  'retryable',call.retryable,'normalizedOutcome',call.normalized_outcome,'logicalOutcome',call.logical_outcome,
  'normalizedCandidate',call.normalized_candidate,'matchEvidence',call.match_evidence) ORDER BY call.created_at,call.id)
 INTO receipts FROM public.phase9_metadata_provider_calls call
 WHERE call.logical_attempt_id=a.id AND call.claim_attempt_number=p_attempt_count;
 terminal:=pg_catalog.jsonb_build_object('callSequence',pc.edition_call_sequence,'callStage',pc.edition_call_stage,
  'status',pc.status,'egressStarted',pc.edition_egress_started,'retryable',pc.retryable,
  'normalizedOutcome',pc.normalized_outcome,'logicalOutcome',pc.logical_outcome,
  'normalizedCandidate',pc.normalized_candidate,'matchEvidence',pc.match_evidence);
 envelope:=pg_catalog.jsonb_build_object('providerRole',a.provider_role,'primaryAdapterKey',l.adapter_key,
  'predecessorOutcome',a.predecessor_outcome,'queryKind',p_query_identity::jsonb->>2,
  'rows',p_rows,'terminalReceipt',terminal,'receipts',receipts);
 SELECT checked.valid,checked.logical_outcome INTO valid,logical_outcome
  FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(a.adapter_key,NULL,NULL,NULL,NULL,envelope) checked;
 IF NOT coalesce(valid,false) THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 PERFORM reservation.id FROM public.phase9_usage_reservations reservation
  WHERE reservation.id=a.usage_reservation_id AND reservation.job_id=p_job_id AND reservation.store_id=c.store_id
   AND reservation.status IN('reserved','consumed') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 -- Registry SHARE always precedes identity keys, even when publication is denied.
 policy:=marketplace_sec.phase9_catalogue_source_policy_v1(a.adapter_key);
 IF policy IS NULL OR policy->>'adapterVersion' IS DISTINCT FROM a.adapter_version
  OR policy->>'policyVersion' IS DISTINCT FROM l.reuse_policy_version OR NOT EXISTS(
   SELECT 1 FROM public.phase9_provider_registry pr WHERE pr.adapter_key=a.adapter_key
    AND pr.provider_kind='metadata' AND pr.enabled AND pr.matching_allowed AND pr.storage_allowed)
 THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
 INSERT INTO marketplace_sec.phase9_catalogue_lookup_effects(lookup_id,candidate_id,store_id,session_id,
  request_generation,completion_digest,canonical_results,completion_response)
 VALUES(l.id,c.id,c.store_id,c.session_id,p_request_generation,digest,'[]'::jsonb,'{}'::jsonb);
 FOR companion IN SELECT value FROM pg_catalog.jsonb_array_elements(companions) LOOP
  SELECT value->'metadata' INTO metadata FROM pg_catalog.jsonb_array_elements(p_rows)
   WHERE value->>'optionId'=companion->>'optionId';
  INSERT INTO marketplace_sec.phase9_catalogue_companions(lookup_id,attempt_id,candidate_id,store_id,session_id,
   provider_record_id,option_id,payload_version,metadata_digest,companion)
  VALUES(l.id,a.id,c.id,c.store_id,c.session_id,companion->>'providerRecordId',(companion->>'optionId')::uuid,
   companion->>'version',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(metadata::text,'UTF8')),'hex'),companion);
 END LOOP;
 -- Freeze the bounded plan, then acquire its full signed, deduplicated key set.
 FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(p_rows) LOOP
  SELECT value INTO companion FROM pg_catalog.jsonb_array_elements(companions) WHERE value->>'optionId'=r->>'optionId';
  option_keys:=ARRAY[]::bigint[];
  IF (policy->>'sharedAdmitted')::boolean AND r->>'eligibility'='eligible'
   AND marketplace_sec.phase9_edition_option_eligible(r->'metadata',p_query_identity)
  THEN option_keys:=marketplace_sec.phase9_catalogue_plan_keys_v1(r->'metadata',companion); END IF;
  keys:=keys||option_keys;
  plan:=plan||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('row',r,'companion',companion,'keys',option_keys));
 END LOOP;
 FOR key IN SELECT DISTINCT k FROM pg_catalog.unnest(keys) k ORDER BY k
 LOOP PERFORM pg_catalog.pg_advisory_xact_lock(key); END LOOP;
 FOR item IN SELECT value AS payload FROM pg_catalog.jsonb_array_elements(plan)
  ORDER BY (SELECT pg_catalog.min(k::text::bigint) FROM pg_catalog.jsonb_array_elements(value->'keys') k),
   (value#>>'{row,ordinal}')::integer LOOP
  r:=item.payload->'row'; companion:=nullif(item.payload->'companion','null'::jsonb);
  IF pg_catalog.jsonb_array_length(item.payload->'keys')=0 THEN CONTINUE; END IF;
  -- Refuse an unplanned mapping instead of taking a newly discovered smaller key.
  option_keys:=marketplace_sec.phase9_catalogue_plan_keys_v1(r->'metadata',companion);
  IF NOT option_keys <@ keys THEN CONTINUE; END IF;
  SELECT resolved.canonical_work_id,resolved.canonical_edition_id INTO pair
   FROM marketplace_sec.phase9_catalogue_resolve_v1(r->'metadata',companion,policy) resolved;
  results:=results||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('optionId',r->'optionId',
   'canonicalWorkId',pair.canonical_work_id,'canonicalEditionId',pair.canonical_edition_id));
 END LOOP;
 -- Every original position has a durable pair/skip in original display order.
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('optionId',result_option->'optionId',
  'canonicalWorkId',hit->'canonicalWorkId','canonicalEditionId',hit->'canonicalEditionId') ORDER BY (result_option->>'ordinal')::integer),'[]'::jsonb)
 INTO results FROM pg_catalog.jsonb_array_elements(p_rows) result_option LEFT JOIN LATERAL (
  SELECT value AS hit FROM pg_catalog.jsonb_array_elements(results) WHERE value->'optionId'=result_option->'optionId') resolved ON true;
 summary:=CASE logical_outcome WHEN 'coherent_match' THEN 'accepted_metadata_match'
  WHEN 'ambiguous_match' THEN 'ambiguous' WHEN 'material_conflict' THEN 'material_conflict' ELSE 'no_match' END;
 UPDATE public.phase9_candidate_edition_state SET options_version=options_version+1,options=p_rows,
  source_lookup_id=l.id,source_attempt_id=a.id,source_fetched_at=p_source_fetched_at,options_expires_at=deadline,
  updated_at=pg_catalog.transaction_timestamp() WHERE candidate_id=c.id RETURNING * INTO s;
 UPDATE public.metadata_enrichment_attempts SET disposition='rejected',normalized_outcome=logical_outcome,
  normalized_payload=NULL,provider_request_id=pc.provider_request_id,status='completed',completed_at=pg_catalog.transaction_timestamp()
  WHERE id=a.id;
 UPDATE public.phase9_usage_reservations SET status='consumed',actual_cost_units=coalesce(actual_cost_units,0),
  updated_at=pg_catalog.transaction_timestamp() WHERE id=a.usage_reservation_id AND job_id=p_job_id AND store_id=c.store_id
  AND status IN('reserved','consumed');
 IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 UPDATE public.phase9_metadata_lookups SET normalized_outcome=summary,outcome_source_attempt_id=a.id,
  completed_at=pg_catalog.transaction_timestamp() WHERE id=l.id;
 response:=marketplace_sec.phase9_edition_completion_receipt(s,'completed');
 UPDATE marketplace_sec.phase9_catalogue_lookup_effects SET canonical_results=results,completion_response=response
  WHERE lookup_id=l.id;
 -- 02b sections 7.1/8.2: effect and options exist; publication is atomic with completion.
 -- A secondary attempt keeps M84 completion/accounting. Its facts cannot use
 -- the primary provider's cache tuple (02b sections 7.1/8.1).
 IF a.adapter_key=l.adapter_key THEN
  PERFORM marketplace_sec.phase9_catalogue_store_cache_v1(l.id,policy);
 END IF;
 UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,
  lease_expires_at=NULL,completed_at=pg_catalog.transaction_timestamp(),updated_at=pg_catalog.transaction_timestamp() WHERE id=p_job_id;
 RETURN response;
END
$completion$;

ALTER FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb) TO service_role;

COMMIT;
