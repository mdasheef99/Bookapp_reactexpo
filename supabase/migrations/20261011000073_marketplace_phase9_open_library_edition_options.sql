-- Owner-authorized LOCAL M73, 2026-10-11. Picker SDD §§4/5/8/9/13.2 (Open Library amendment).
-- M65-M72 remain byte-preserved; no application or deployment authority.
-- Activation is separate: Open Library is installed disabled, basic facts only, raw retention zero.
-- Rollback: disable its registry row/explicit route; preserve chosen inventory facts and use a forward restoration.
BEGIN;
INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,matching_allowed,
 storage_allowed,public_display_allowed,image_cache_allowed,attribution_required,revalidation_seconds,
 raw_retention_seconds,policy_version)
VALUES('open_library','metadata','1.0.0',false,true,true,true,false,true,86400,0,1)
ON CONFLICT(adapter_key) DO NOTHING;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_valid_metadata(p_metadata jsonb,p_worker boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; v jsonb; limits jsonb:='{"title":512,"subtitle":512,"description":5000,"publisher":256,
 "publishedDate":32,"script":16,"editionStatement":256,"series":256,"volume":64,"format":128,
 "isbn10":32,"isbn13":32,"coverReference":512,"contractVersion":64,"schemaVersion":64,
 "adapterKey":64,"adapterVersion":64,"normalizerVersion":128,"correlationId":128,"attemptId":128,
 "providerRecordId":256,"fetchedAt":40,"matchRationale":1024}';
BEGIN
 IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR octet_length(p_metadata::text)>262144
  OR NOT p_metadata ?& ARRAY['title','subtitle','authors','description','isbn10','isbn13','publisher','publishedDate','language','script','editionStatement','series','volume','format','pageCount','categories','coverReference']
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_metadata) x WHERE x NOT IN
   (SELECT jsonb_object_keys(limits)) AND x NOT IN ('authors','categories','language','pageCount','confidence'))
 THEN RETURN false; END IF;
 IF p_worker AND coalesce(p_metadata->>'adapterKey','') NOT IN('google_books','open_library') THEN RETURN false; END IF;
 IF p_worker AND NOT p_metadata ?& ARRAY['contractVersion','schemaVersion','adapterKey','adapterVersion',
  'normalizerVersion','correlationId','attemptId','providerRecordId','fetchedAt','matchRationale','confidence']
 THEN RETURN false; END IF;
 FOR k IN SELECT jsonb_object_keys(limits) LOOP
  v:=p_metadata->k;
  IF v IS NULL OR k='coverReference' THEN CONTINUE; END IF;
  IF NOT coalesce(marketplace_sec.phase9_owner_ux_safe_text(v,1,(limits->>k)::integer,
   k NOT IN ('title','contractVersion','schemaVersion','adapterKey','adapterVersion','normalizerVersion',
    'correlationId','attemptId','providerRecordId','fetchedAt','matchRationale')),false) THEN RETURN false; END IF;
 END LOOP;
 IF jsonb_typeof(p_metadata->'authors') IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_metadata->'authors') NOT BETWEEN 1 AND 20
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_metadata->'authors') a
   WHERE NOT coalesce(marketplace_sec.phase9_owner_ux_safe_text(a,1,256,false),false))
  OR jsonb_typeof(p_metadata->'categories') IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_metadata->'categories')>20
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_metadata->'categories') a
   WHERE NOT coalesce(marketplace_sec.phase9_owner_ux_safe_text(a,1,128,false),false))
  OR NOT coalesce(marketplace_sec.phase9_owner_ux_canonical_language(p_metadata->'language'),false)
 THEN RETURN false; END IF;
 IF (p_metadata->>'isbn10' IS NOT NULL AND char_length(p_metadata->>'isbn10') NOT BETWEEN 10 AND 32)
  OR (p_metadata->>'isbn13' IS NOT NULL AND char_length(p_metadata->>'isbn13') NOT BETWEEN 10 AND 32)
 THEN RETURN false; END IF;
 IF p_metadata->'pageCount'<>'null'::jsonb AND
  (jsonb_typeof(p_metadata->'pageCount')<>'number' OR (p_metadata->>'pageCount')::numeric
   NOT BETWEEN 1 AND 100000 OR (p_metadata->>'pageCount')::numeric<>trunc((p_metadata->>'pageCount')::numeric))
 THEN RETURN false; END IF;
 IF p_metadata ? 'confidence' AND (jsonb_typeof(p_metadata->'confidence')<>'number'
  OR (p_metadata->>'confidence')::numeric NOT BETWEEN 0 AND 1) THEN RETURN false; END IF;
 IF p_metadata->'coverReference'<>'null'::jsonb AND (jsonb_typeof(p_metadata->'coverReference')<>'string'
  OR char_length(p_metadata->>'coverReference') NOT BETWEEN 1 AND 512 OR p_metadata->>'coverReference'
  !~ '^https://(books[.]google[.]com/[^[:space:]\\]*|covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-M[.]jpg)$') THEN RETURN false; END IF;
 IF p_worker THEN PERFORM (p_metadata->>'fetchedAt')::timestamptz; END IF;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_valid_rows(p_rows jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE r jsonb; n integer:=0; ids uuid[]:=ARRAY[]::uuid[]; id uuid;
BEGIN
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)>10
  OR octet_length(p_rows::text)>2621440 THEN RETURN false; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF jsonb_typeof(r)<>'object' OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(r) k)
   IS DISTINCT FROM ARRAY['eligibility','googleBooksUrl','metadata','optionId','ordinal']
   OR jsonb_typeof(r->'ordinal')<>'number' OR (r->>'ordinal')::numeric<>n
   OR jsonb_typeof(r->'optionId')<>'string' THEN RETURN false; END IF;
  id:=(r->>'optionId')::uuid; IF id=ANY(ids) THEN RETURN false; END IF;
  ids:=array_append(ids,id); n:=n+1;
  IF r->>'eligibility'='unavailable' THEN
   IF r->'metadata'<>'null'::jsonb OR r->'googleBooksUrl'<>'null'::jsonb THEN RETURN false; END IF;
  ELSIF r->>'eligibility' IN ('eligible','ineligible') THEN
   IF NOT marketplace_sec.phase9_edition_valid_metadata(r->'metadata',true)
    OR jsonb_typeof(r->'googleBooksUrl') IS DISTINCT FROM 'string'
    OR char_length(r->>'googleBooksUrl') NOT BETWEEN 1 AND 2048
    OR r->>'googleBooksUrl' !~ '^https://(books[.]google[.]com/books([/?][^[:space:]\\]*)?|openlibrary[.]org/books/OL[1-9][0-9]*M)$'
   THEN RETURN false; END IF;
  ELSE RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;

CREATE FUNCTION marketplace_sec.phase9_edition_source_policy(p_state public.phase9_candidate_edition_state)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $function$
 SELECT EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts a
  JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id
  JOIN public.phase9_provider_registry r ON r.adapter_key=a.adapter_key
  WHERE a.id=p_state.source_attempt_id AND l.id=p_state.source_lookup_id
   AND a.candidate_id=p_state.candidate_id AND a.store_id=p_state.store_id
   AND l.candidate_id=p_state.candidate_id AND l.store_id=p_state.store_id
   AND r.adapter_key IN('google_books','open_library') AND r.provider_kind='metadata'
   AND r.adapter_version=a.adapter_version AND r.policy_version::text=l.reuse_policy_version
   AND r.enabled AND r.matching_allowed AND r.storage_allowed)
$function$;

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
  SELECT CASE WHEN j.status IN('open','in_progress','retry_scheduled') THEN 'pending'
   WHEN j.status IN('resolved','resolved_noop') AND fresh THEN 'ready' ELSE 'failed' END INTO status
   FROM public.image_extraction_jobs j WHERE id=s.request_id;
 END IF;
 RETURN jsonb_build_object('sessionId',p_candidate.session_id,'candidateId',p_candidate.id,
  'requestGeneration',coalesce(s.request_generation,0),'optionsVersion',coalesce(s.options_version,0),
  'optionsExpiresAt',CASE WHEN fresh THEN s.options_expires_at ELSE NULL END,'rows',rows,'selection',selection,
  'lookupStatus',coalesce(status,'idle'),'candidateVersion',p_candidate.version,
  'metadataRevision',p_candidate.metadata_revision,'reviewVersion',p_candidate.review_version);
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_lookup_receipt(p_candidate public.image_extraction_candidates,p_prior jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.phase9_candidate_edition_state; operation uuid; status text; available boolean; same boolean;
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id;
 operation:=coalesce((p_prior->>'operationId')::uuid,s.request_id);
 same:=coalesce(operation=s.request_id,false);
 SELECT CASE WHEN j.status IN('open','in_progress','retry_scheduled') THEN 'pending'
  WHEN j.status IN('resolved','resolved_noop') THEN 'ready' ELSE 'failed' END INTO status
 FROM public.image_extraction_jobs j WHERE id=operation AND store_id=p_candidate.store_id AND entity_id=p_candidate.id;
 available:=coalesce(same AND s.query_identity=marketplace_sec.phase9_edition_query_identity(p_candidate)
  AND s.options_expires_at>transaction_timestamp() AND status='ready' AND marketplace_sec.phase9_edition_source_policy(s),false);
 RETURN jsonb_build_object('operationId',operation,'status',coalesce(status,'failed'),
  'requestGeneration',CASE WHEN same THEN s.request_generation ELSE coalesce((p_prior->>'requestGeneration')::integer,0) END,
  'optionsVersion',CASE WHEN same THEN s.options_version ELSE coalesce((p_prior->>'optionsVersion')::integer,0) END,
  'available',available);
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_options_due(c public.image_extraction_candidates)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.phase9_candidate_edition_state s
  JOIN public.image_extraction_sessions session ON session.id=c.session_id
  WHERE s.candidate_id=c.id AND s.options_expires_at IS NOT NULL
   AND (s.options_expires_at<=transaction_timestamp() OR c.expires_at<=transaction_timestamp()
    OR session.expires_at<=transaction_timestamp() OR c.state='committed'
    OR c.review_disposition IN('owner_removed_from_scan','skipped_false_detection')
    OR s.query_identity IS DISTINCT FROM marketplace_sec.phase9_edition_query_identity(c)
    OR NOT marketplace_sec.phase9_edition_source_policy(s)))
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(
 p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,p_expected_metadata_revision integer,
 p_expected_review_version integer,p_source text,p_options_version integer,p_option_id uuid,p_selection_id uuid,
 p_idempotency_key text,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state; r jsonb; m jsonb;
 selected uuid; source_id uuid; fingerprint text; replay jsonb; response jsonb; q text; review jsonb;
BEGIN
 c:=marketplace_sec.phase9_edition_assert_owner_candidate(p_session_id,p_candidate_id);
 IF NOT coalesce(p_expected_candidate_version>0 AND p_expected_metadata_revision>0
  AND (p_expected_review_version IS NULL OR p_expected_review_version>0)
  AND p_idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$' AND p_command_id IS NOT NULL
  AND ((p_source='edition_option' AND p_options_version>0 AND p_option_id IS NOT NULL AND p_selection_id IS NULL)
   OR (p_source='current_suggestion' AND p_selection_id IS NOT NULL AND p_options_version IS NULL AND p_option_id IS NULL)),false)
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 fingerprint:=encode(extensions.digest(jsonb_build_array(p_session_id,p_candidate_id,p_expected_candidate_version,
  p_expected_metadata_revision,p_expected_review_version,p_source,p_options_version,p_option_id,
  p_selection_id,p_command_id)::text,'sha256'),'hex');
 replay:=marketplace_sec.phase9_replay(auth.uid()::text,'EP_SELECT_V1',p_idempotency_key,fingerprint);
 -- Receipts retain only the chosen snapshot/versions. Options are always retrieved through the current read.
 IF replay IS NOT NULL THEN RETURN replay; END IF;
 IF c.metadata_revision<>p_expected_metadata_revision OR c.review_version IS DISTINCT FROM p_expected_review_version
  THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
 IF c.version<>p_expected_candidate_version THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF;
 q:=marketplace_sec.phase9_edition_query_identity(c);
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id FOR UPDATE;
 IF p_source='edition_option' THEN
  IF s.options_version IS DISTINCT FROM p_options_version THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  IF s.query_identity IS DISTINCT FROM q OR s.options_expires_at IS NULL
   OR s.options_expires_at<=transaction_timestamp() OR NOT marketplace_sec.phase9_edition_source_policy(s)
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  SELECT x INTO r FROM jsonb_array_elements(s.options) x WHERE x->>'optionId'=p_option_id::text;
  IF r IS NULL OR r->>'eligibility'<>'eligible' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  m:=r->'metadata'; source_id:=p_option_id;
 ELSE
  IF c.selected_metadata_snapshot_id IS DISTINCT FROM p_selection_id THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  m:=marketplace_sec.phase9_edition_current_snapshot(c); source_id:=p_selection_id;
 END IF;
 -- Explicit options use the same validated eligibility rule as M68 completion.
 -- Automatic/current suggestions retain their strict compatibility boundary.
 IF m IS NULL OR NOT (CASE WHEN p_source='edition_option'
  THEN marketplace_sec.phase9_edition_option_eligible(m,q)
  ELSE marketplace_sec.phase9_edition_identity_compatible(m,q) END)
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 selected:=gen_random_uuid();
 INSERT INTO public.phase9_candidate_edition_state(candidate_id,session_id,store_id,query_identity,
  selection_id,selected_source,selected_source_id,selected_option_snapshot,selected_at,selected_by)
 VALUES(c.id,c.session_id,c.store_id,q,selected,p_source,source_id,m,transaction_timestamp(),auth.uid())
 ON CONFLICT(candidate_id) DO UPDATE SET selection_id=excluded.selection_id,
  selected_source=excluded.selected_source,selected_source_id=excluded.selected_source_id,
  selected_option_snapshot=excluded.selected_option_snapshot,selected_at=excluded.selected_at,
  selected_by=excluded.selected_by,updated_at=transaction_timestamp();
 review:=c.owner_review_snapshot;
 IF jsonb_typeof(review->'value')='object' THEN
  review:=jsonb_set(review,'{value}',(review->'value')||jsonb_build_object(
   'originalTitle',m->'title','authors',m->'authors','originalLanguage',m->'language','script',m->'script',
   'metadataChoice',jsonb_build_object('mode','edition_option','selectionId',selected),
   'originalFieldConfirmation',jsonb_build_object('title',true,'authors',
    (SELECT jsonb_agg(true) FROM jsonb_array_elements(m->'authors')))));
  review:=review||jsonb_build_object('confirmed_title',jsonb_build_object('value',m->'title'),'confirmed_authors',m->'authors');
 END IF;
 UPDATE public.image_extraction_candidates SET owner_review_snapshot=review,metadata_revision=metadata_revision+1,
  review_version=CASE WHEN review_version IS NULL THEN NULL ELSE review_version+1 END,version=version+1,
  review_ready=false,updated_at=transaction_timestamp() WHERE id=c.id RETURNING * INTO c;
 response:=marketplace_sec.phase9_edition_choices(c);
 PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'EP_SELECT_V1',p_idempotency_key,
  response||jsonb_build_object('rows','[]'::jsonb,'optionsExpiresAt',NULL),'edition_selected_no_inventory_effect');
 RETURN response;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_worker_context(p_job public.image_extraction_jobs)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; state public.phase9_candidate_edition_state;
 l public.phase9_metadata_lookups; a public.metadata_enrichment_attempts; pc public.phase9_metadata_provider_calls;
 providers jsonb; review jsonb; title text; authors jsonb;
BEGIN
 c:=marketplace_sec.phase9_edition_worker_candidate(p_job);
 SELECT * INTO state FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE job_id=p_job.id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF l.id IS NOT NULL AND l.completed_at IS NULL THEN
  UPDATE public.phase9_metadata_lookups SET claim_attempt_number=p_job.attempt_count,claim_worker=p_job.lease_owner,
   claim_lease_token_hash=p_job.lease_token_hash WHERE id=l.id RETURNING * INTO l;
 END IF;
 SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE lookup_id=l.id ORDER BY attempt_sequence DESC LIMIT 1;
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT coalesce(jsonb_agg(jsonb_build_object('adapterKey',r.adapter_key,'adapterVersion',r.adapter_version,
  'enabled',r.enabled,'matchingAllowed',r.matching_allowed,'storageAllowed',r.storage_allowed,
  'reuseAllowed',r.revalidation_seconds IS NOT NULL,'policyVersion',r.policy_version)),'[]') INTO providers
 FROM public.phase9_provider_registry r WHERE r.provider_kind='metadata' AND r.adapter_key IN('google_books','open_library');
 review:=c.owner_review_snapshot->'value';
 title:=CASE WHEN review#>>'{originalFieldConfirmation,title}'='true' THEN review->>'originalTitle' ELSE c.observed_title END;
 authors:=CASE WHEN jsonb_typeof(review->'authors')='array'
  AND jsonb_typeof(review#>'{originalFieldConfirmation,authors}')='array'
  AND jsonb_array_length(review->'authors')>0
  AND jsonb_array_length(review->'authors')=jsonb_array_length(review#>'{originalFieldConfirmation,authors}')
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(review#>'{originalFieldConfirmation,authors}') x WHERE x<>'true')
 THEN review->'authors' ELSE to_jsonb(c.observed_authors) END;
 -- The normalized stored query remains authority if the Owner chose a row with additional authors.
 IF review#>>'{metadataChoice,mode}'='edition_option' THEN
  title:=state.query_identity::jsonb->>4; authors:=state.query_identity::jsonb->5; END IF;
 RETURN jsonb_build_object('contractVersion','p9-metadata-job-context-v1','purpose','edition_options',
  'jobId',p_job.id,'attempt',p_job.attempt_count,'claimExpiresAt',p_job.lease_expires_at,
  'candidateId',c.id,'candidateState',c.state,'candidateVersion',c.version,'storeId',c.store_id,
  'sessionId',c.session_id,'inputId',c.input_id,'observationId',c.analysis_observation_id,
  'title',title,'authors',authors,'isbnClue',c.observed_isbn_clue,'publisherClue',c.observed_publisher_clue,
  'language',state.query_identity::jsonb->>6,'script',coalesce(review->>'script',c.observed_script),
  'queryIdentity',state.query_identity,'requestGeneration',state.request_generation,'optionsVersion',state.options_version,
  'optionsAvailable',coalesce(state.options_expires_at>transaction_timestamp(),false),'optionsExpiresAt',state.options_expires_at,
  'metadataContractVersion','p9-metadata-foundation-v1','lookupContractVersion','p9-metadata-lookup-v1',
  'normalizerVersion','p9-bibliographic-normalizer-v1','routingPolicyVersion','p9-metadata-routing-v1',
  'selectionPolicyVersion','p9-metadata-selection-v1','localCanonicalEditionId',NULL,
  'reusableLookupId',NULL,'reusableOutcome',NULL,'currentLookupId',l.id,'currentOutcome',l.normalized_outcome,
  'currentLookupAdapterKey',l.adapter_key,'currentLookupAdapterVersion',l.adapter_version,'currentAttemptAdapterKey',a.adapter_key,
  'currentAttemptId',a.id,'currentAttemptOutcome',a.normalized_outcome,'currentAttemptDisposition',a.disposition,
  'currentAttemptCandidate',a.normalized_payload,'currentAttemptProviderRequestId',a.provider_request_id,
  'currentPhysicalStatus',pc.status,'currentPhysicalOutcome',pc.normalized_outcome,
  'currentPhysicalLogicalOutcome',pc.logical_outcome,'currentPhysicalProviderRequestId',pc.provider_request_id,
  'currentPhysicalRetryable',pc.retryable,'currentPhysicalCandidate',pc.normalized_candidate,
  'currentPhysicalEvidence',pc.match_evidence,'providerPolicies',providers);
END$$;

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
  OR (explicit AND (p_leader_lookup_id IS NOT NULL OR coalesce(p_adapter_key,'') NOT IN('google_books','open_library')
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
 IF (explicit AND (NOT ((p_adapter_key IN('google_books','open_library') AND p_provider_role='primary') OR (p_adapter_key='open_library' AND p_provider_role='secondary'))))
  OR NOT EXISTS(SELECT 1 FROM public.phase9_metadata_lookups l WHERE l.id=p_lookup_id AND l.job_id=p_job_id
   AND l.candidate_id=c.id AND l.store_id=c.store_id AND l.query_identity=CASE WHEN explicit
    THEN marketplace_sec.phase9_edition_query_identity(c) ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END
   AND (NOT explicit OR (p_provider_role='primary' AND l.adapter_key=p_adapter_key AND l.adapter_version=p_adapter_version)
    OR (p_provider_role='secondary' AND l.adapter_key='google_books' AND p_adapter_key='open_library')))
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN marketplace_sec.phase9_register_metadata_attempt(p_lookup_id,p_job_id,p_worker,p_lease_token,p_attempt_count,
  p_provider_attempt_identity,p_provider_cache_identity,p_provider_role,p_attempt_sequence,p_adapter_key,p_adapter_version,
  p_capability_version,p_schema_version,p_normalizer_version,p_routing_policy_version,p_predecessor_outcome,p_usage_reservation_id);
END
$function$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_reserve_metadata_usage(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
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
 IF l.id IS NULL OR l.completed_at IS NOT NULL OR l.leader_lookup_id IS NOT NULL OR coalesce(p_adapter_key,'') NOT IN('google_books','open_library')
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

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_recover_candidate_edition_options_v1(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
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
   AND r.provider_kind='metadata' AND r.adapter_key IN('google_books','open_library') AND r.adapter_version=a.adapter_version
   AND r.policy_version::text=l.reuse_policy_version AND r.enabled AND r.matching_allowed AND r.storage_allowed)
 THEN RETURN jsonb_build_object('status','stale_rejected'); END IF;
 RETURN marketplace_sec.phase9_edition_completion_receipt(s,'replayed');
END
$function$;

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
  OR pc.logical_outcome NOT IN('coherent_match','ambiguous_match','material_conflict','no_acceptable_match')
  OR a.disposition<>'unresolved' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF a.adapter_key='open_library' THEN
  IF (SELECT count(*) FROM public.phase9_metadata_provider_calls
   WHERE logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count
    AND edition_call_sequence IS NOT NULL) NOT BETWEEN 1 AND 6
   OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls
    WHERE logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count
     AND (status<>'finalized' OR edition_egress_started IS DISTINCT FROM true OR retryable IS DISTINCT FROM false OR normalized_outcome<>'no_acceptable_match'
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


-- Each Open Library GET has one immutable stage receipt in its logical attempt/claim.
ALTER TABLE public.phase9_metadata_provider_calls
 ADD COLUMN edition_call_sequence smallint,
 ADD COLUMN edition_call_stage text,
 ADD CONSTRAINT phase9_edition_http_stage CHECK(
  (edition_call_sequence IS NULL AND edition_call_stage IS NULL) OR
  (edition_call_sequence BETWEEN 0 AND 5 AND
   ((edition_call_sequence=0 AND edition_call_stage='search') OR
    (edition_call_sequence=1 AND edition_call_stage='editions') OR
    (edition_call_sequence BETWEEN 2 AND 5 AND edition_call_stage ~ '^author:OL[1-9][0-9]*A$'))));
CREATE UNIQUE INDEX phase9_edition_http_sequence_idx ON public.phase9_metadata_provider_calls
 (logical_attempt_id,claim_attempt_number,edition_call_sequence) WHERE edition_call_sequence IS NOT NULL;
CREATE UNIQUE INDEX phase9_edition_http_stage_idx ON public.phase9_metadata_provider_calls
 (logical_attempt_id,claim_attempt_number,edition_call_stage) WHERE edition_call_stage IS NOT NULL;
CREATE FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_v1(
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
   AND normalized_outcome='no_acceptable_match')<>p_call_sequence THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 INSERT INTO public.phase9_metadata_provider_calls(logical_attempt_id,job_id,candidate_id,store_id,
  physical_call_identity,claim_attempt_number,claim_worker,claim_lease_token_hash,edition_call_sequence,edition_call_stage)
 VALUES(a.id,j.id,c.id,c.store_id,p_physical_call_identity,p_attempt_count,p_worker,
  encode(extensions.digest(p_lease_token,'sha256'),'hex'),p_call_sequence,p_call_stage) RETURNING * INTO pc;
 RETURN jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
END
$function$;
CREATE FUNCTION public.phase9_register_edition_options_provider_call_v1(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_physical_call_identity uuid,p_call_sequence integer,p_call_stage text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $function$
 SELECT marketplace_sec.phase9_register_edition_options_provider_call_v1(
 p_attempt_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_physical_call_identity,p_call_sequence,p_call_stage)
$function$;
-- A secondary cannot be manufactured from policy/config/quota denial or an unresolved Google request.
CREATE FUNCTION marketplace_sec.phase9_finish_edition_primary_for_fallback_v1(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_outcome text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates; a public.metadata_enrichment_attempts;
BEGIN
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 IF j.operation_version IS DISTINCT FROM 'p9-owner-edition-options-v1'
  OR p_outcome NOT IN('no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
   'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open','network_failure','response_too_large','unsupported_content_type')
 THEN RAISE EXCEPTION 'P9_METADATA_SECONDARY_NOT_ELIGIBLE'; END IF;
 c:=marketplace_sec.phase9_edition_worker_candidate(j);
 SELECT a0.* INTO a FROM public.metadata_enrichment_attempts a0 JOIN public.phase9_metadata_lookups l ON l.id=a0.lookup_id
 WHERE a0.id=p_attempt_id AND a0.candidate_id=c.id AND a0.store_id=c.store_id AND a0.adapter_key='google_books'
  AND a0.provider_role='primary' AND l.job_id=j.id AND l.completed_at IS NULL
  AND l.query_identity=marketplace_sec.phase9_edition_query_identity(c) FOR UPDATE OF a0;
 IF a.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc
  WHERE pc.logical_attempt_id=a.id AND pc.job_id=j.id AND pc.claim_attempt_number=p_attempt_count
   AND pc.claim_worker=p_worker AND pc.claim_lease_token_hash=encode(extensions.digest(p_lease_token,'sha256'),'hex')
   AND pc.status IN('finalized','outcome_unknown') AND pc.logical_outcome=p_outcome)
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF a.disposition IN('rejected','failed') THEN
  IF a.normalized_outcome IS DISTINCT FROM p_outcome THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
 ELSE
  IF a.disposition<>'unresolved' THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  UPDATE public.metadata_enrichment_attempts SET disposition='failed',normalized_outcome=p_outcome,
   status='completed',completed_at=transaction_timestamp() WHERE id=a.id;
 END IF;
 RETURN jsonb_build_object('attempt_id',a.id,'status','completed');
END
$function$;
CREATE FUNCTION public.phase9_finish_edition_primary_for_fallback_v1(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_outcome text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $function$
 SELECT marketplace_sec.phase9_finish_edition_primary_for_fallback_v1(
 p_attempt_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_outcome)
$function$;


DO $function$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='marketplace_sec' AND p.proname IN(
   'phase9_edition_valid_metadata','phase9_edition_valid_rows','phase9_edition_source_policy',
   'phase9_edition_legacy_choices','phase9_edition_lookup_receipt','phase9_edition_options_due',
   'phase9_edition_legacy_select_candidate','phase9_edition_worker_context',
   'phase9_register_structural_metadata_lookup','phase9_register_structural_metadata_attempt',
   'phase9_reserve_metadata_usage','phase9_recover_candidate_edition_options_v1',
   'phase9_complete_candidate_edition_options_v1','phase9_register_edition_options_provider_call_v1',
   'phase9_finish_edition_primary_for_fallback_v1')
 LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 END LOOP;
END
$function$;
-- Public service wrappers keep the private implementation unavailable to client roles.
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text),
 marketplace_sec.phase9_finish_edition_primary_for_fallback_v1(uuid,uuid,text,text,integer,text) TO service_role;
ALTER FUNCTION public.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_finish_edition_primary_for_fallback_v1(uuid,uuid,text,text,integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text),
 public.phase9_finish_edition_primary_for_fallback_v1(uuid,uuid,text,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text),
 public.phase9_finish_edition_primary_for_fallback_v1(uuid,uuid,text,text,integer,text) TO service_role;
-- Existing private service wrappers retain their M68 grants after CREATE OR REPLACE.
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_recover_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text),
 marketplace_sec.phase9_complete_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb),
 marketplace_sec.phase9_reserve_metadata_usage(uuid,text,text,integer,uuid,text,text,integer),
 marketplace_sec.phase9_register_structural_metadata_lookup(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid),
 marketplace_sec.phase9_register_structural_metadata_attempt(uuid,uuid,text,text,integer,uuid,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid) TO service_role;

-- NULL means egress is uncertain; false is a proven registration-only cancellation, true an attempted GET.
ALTER TABLE public.phase9_metadata_provider_calls ADD COLUMN edition_egress_started boolean;
CREATE FUNCTION marketplace_sec.phase9_finalize_edition_options_provider_call_v1(
 p_provider_call_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_status text,p_outcome text,p_retryable boolean,p_egress_started boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE pc public.phase9_metadata_provider_calls; receipt jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_egress_started IS NULL
  OR (NOT p_egress_started AND (p_status IS DISTINCT FROM 'stale_rejected' OR p_outcome IS DISTINCT FROM 'cancelled' OR p_retryable IS DISTINCT FROM false))
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 PERFORM 1 FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
 SELECT pc0.* INTO pc FROM public.phase9_metadata_provider_calls pc0
 JOIN public.metadata_enrichment_attempts a ON a.id=pc0.logical_attempt_id
 WHERE pc0.id=p_provider_call_id AND pc0.job_id=p_job_id AND a.adapter_key='open_library'
  AND pc0.edition_call_sequence IS NOT NULL FOR UPDATE OF pc0;
 IF pc.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF pc.edition_egress_started IS NOT NULL AND pc.edition_egress_started IS DISTINCT FROM p_egress_started
 THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
 receipt:=marketplace_sec.phase9_finalize_metadata_provider_call(p_provider_call_id,p_job_id,p_worker,
  p_lease_token,p_attempt_count,p_status,p_outcome,p_outcome,NULL,p_retryable,NULL,'[]'::jsonb);
 UPDATE public.phase9_metadata_provider_calls SET edition_egress_started=p_egress_started WHERE id=pc.id;
 RETURN receipt;
END
$function$;
CREATE FUNCTION public.phase9_finalize_edition_options_provider_call_v1(
 p_provider_call_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_status text,p_outcome text,p_retryable boolean,p_egress_started boolean)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $function$
 SELECT marketplace_sec.phase9_finalize_edition_options_provider_call_v1(
 p_provider_call_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_status,p_outcome,p_retryable,p_egress_started)
$function$;
ALTER FUNCTION marketplace_sec.phase9_finalize_edition_options_provider_call_v1(uuid,uuid,text,text,integer,text,text,boolean,boolean) OWNER TO postgres;
ALTER FUNCTION public.phase9_finalize_edition_options_provider_call_v1(uuid,uuid,text,text,integer,text,text,boolean,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_finalize_edition_options_provider_call_v1(uuid,uuid,text,text,integer,text,text,boolean,boolean),
 public.phase9_finalize_edition_options_provider_call_v1(uuid,uuid,text,text,integer,text,text,boolean,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_finalize_edition_options_provider_call_v1(uuid,uuid,text,text,integer,text,text,boolean,boolean),
 public.phase9_finalize_edition_options_provider_call_v1(uuid,uuid,text,text,integer,text,text,boolean,boolean) TO service_role;

-- Preserve automatic secondary rules; explicit jobs admit the shared contract's other technical failures.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_metadata_attempt(
  p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_provider_attempt_identity uuid,p_provider_cache_identity text,
  p_provider_role text,p_attempt_sequence integer,
  p_adapter_key text,p_adapter_version text,p_capability_version text,
  p_schema_version text,p_normalizer_version text,p_routing_policy_version text,
  p_predecessor_outcome text,p_usage_reservation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_lookup public.phase9_metadata_lookups;
  v_res public.phase9_usage_reservations; v_attempt public.metadata_enrichment_attempts;
  v_primary public.metadata_enrichment_attempts; v_duplicate uuid;
BEGIN
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups
    WHERE id=p_lookup_id AND job_id=v_job.id AND store_id=v_job.store_id FOR UPDATE;
  IF NOT FOUND OR v_lookup.leader_lookup_id IS NOT NULL
    OR p_provider_attempt_identity IS NULL
    OR char_length(p_provider_cache_identity) NOT BETWEEN 1 AND 3072
    OR p_provider_role NOT IN ('primary','secondary')
    OR p_attempt_sequence NOT BETWEEN 1 AND 2
    OR (p_provider_role='primary' AND p_attempt_sequence<>1)
    OR (p_provider_role='secondary' AND p_attempt_sequence<>2)
    OR p_adapter_key !~ '^[a-z][a-z0-9._-]{1,63}$' THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  SELECT * INTO v_attempt FROM public.metadata_enrichment_attempts
    WHERE provider_attempt_identity=p_provider_attempt_identity;
  IF FOUND THEN
    IF v_attempt.lookup_id<>p_lookup_id OR v_attempt.provider_role<>p_provider_role
      OR v_attempt.attempt_sequence<>p_attempt_sequence
      OR v_attempt.provider_cache_identity<>p_provider_cache_identity
      OR v_attempt.adapter_key<>p_adapter_key
      OR v_attempt.adapter_version<>p_adapter_version
      OR v_attempt.capability_version<>p_capability_version
      OR v_attempt.schema_version<>p_schema_version
      OR v_attempt.normalizer_version<>p_normalizer_version
      OR v_attempt.routing_policy_version<>p_routing_policy_version
      OR v_attempt.predecessor_outcome IS DISTINCT FROM p_predecessor_outcome
      OR v_attempt.usage_reservation_id<>p_usage_reservation_id THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN jsonb_build_object('attempt_id',v_attempt.id,'disposition',v_attempt.disposition);
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.phase9_provider_registry r
    WHERE r.adapter_key=p_adapter_key AND r.provider_kind='metadata'
      AND r.adapter_version=p_adapter_version AND r.enabled AND r.matching_allowed
      AND r.policy_version::text=v_lookup.reuse_policy_version
  ) THEN RAISE EXCEPTION 'P9_METADATA_PROVIDER_DISABLED'; END IF;
  IF p_provider_role='secondary' THEN
    SELECT * INTO v_primary FROM public.metadata_enrichment_attempts
      WHERE lookup_id=v_lookup.id AND provider_role='primary'
        AND disposition IN ('rejected','failed');
    IF NOT FOUND OR v_primary.normalized_outcome IS DISTINCT FROM p_predecessor_outcome
      OR p_predecessor_outcome NOT IN ('no_acceptable_match','ambiguous_match',
        'material_conflict','schema_invalid','malformed_response','timeout',
        'rate_limited','provider_unavailable','circuit_breaker_open') AND NOT
        (v_job.operation_version='p9-owner-edition-options-v1' AND p_predecessor_outcome IN
         ('network_failure','response_too_large','unsupported_content_type')) THEN
      RAISE EXCEPTION 'P9_METADATA_SECONDARY_NOT_ELIGIBLE';
    END IF;
  END IF;
  SELECT * INTO v_res FROM public.phase9_usage_reservations
    WHERE id=p_usage_reservation_id AND job_id=v_job.id AND store_id=v_job.store_id
      AND cost_kind='metadata' AND status IN ('reserved','consumed')
      AND adapter_key=v_lookup.adapter_key
      AND adapter_version=v_lookup.adapter_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_METADATA_USAGE_RESERVATION_REQUIRED'; END IF;
  SELECT a.id INTO v_duplicate FROM public.metadata_enrichment_attempts a
    WHERE a.query_identity=v_lookup.query_identity AND a.adapter_key=p_adapter_key
      AND a.adapter_version=p_adapter_version
    ORDER BY a.created_at LIMIT 1;
  INSERT INTO public.metadata_enrichment_attempts(
    candidate_id,store_id,adapter_key,attempt_sequence,query_kind,
    normalized_request_clues,status,cache_status,adapter_version,schema_version,
    normalizer_version,reuse_policy_version,lookup_id,provider_role,query_identity,
    provider_cache_identity,capability_version,routing_policy_version,
    predecessor_outcome,predecessor_attempt_id,usage_reservation_id,
    provider_attempt_identity,possibly_duplicate_spend_of_attempt_id,disposition)
  VALUES(v_lookup.candidate_id,v_lookup.store_id,p_adapter_key,p_attempt_sequence,
    v_lookup.lookup_strategy,'{}','registered','miss',p_adapter_version,p_schema_version,
    p_normalizer_version,1,p_lookup_id,p_provider_role,v_lookup.query_identity,
    p_provider_cache_identity,p_capability_version,p_routing_policy_version,
    p_predecessor_outcome,
    CASE WHEN p_provider_role='secondary' THEN v_primary.id ELSE NULL END,
    p_usage_reservation_id,
    p_provider_attempt_identity,v_duplicate,'unresolved')
  ON CONFLICT(provider_attempt_identity) DO NOTHING
  RETURNING * INTO v_attempt;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN jsonb_build_object('attempt_id',v_attempt.id,'disposition',v_attempt.disposition);
END$$;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_metadata_attempt(uuid,uuid,text,text,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_metadata_attempt(uuid,uuid,text,text,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid) TO service_role;

-- Preserve M61 representative-cover behavior and accept the chosen OL edition's own cover.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_metadata_summary(
  p_detail jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_metadata jsonb:=p_detail#>'{metadata,snapshot}';
  v_selected boolean; v_title boolean; v_authors boolean; v_language boolean;
  v_cover boolean; v_selection_id boolean; v_selection uuid; v_representative jsonb;
BEGIN
  v_selected:=p_detail#>>'{metadata,state}'='selected'
    AND jsonb_typeof(v_metadata)='object';
  IF NOT v_selected THEN RETURN NULL; END IF;
  v_title:=marketplace_sec.phase9_owner_ux_safe_text(v_metadata->'title',1,512,false);
  v_authors:=CASE WHEN jsonb_typeof(v_metadata->'authors')='array' THEN
      jsonb_array_length(v_metadata->'authors') BETWEEN 1 AND 20
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_metadata->'authors') author
        WHERE NOT marketplace_sec.phase9_owner_ux_safe_text(author,1,256,false))
      AND (SELECT count(*) FROM jsonb_array_elements(v_metadata->'authors'))
        =(SELECT count(DISTINCT author) FROM jsonb_array_elements(v_metadata->'authors') author)
    ELSE false END;
  v_language:=marketplace_sec.phase9_owner_ux_canonical_language(v_metadata->'language');
  v_cover:=jsonb_typeof(v_metadata->'coverReference')='string'
    AND char_length(v_metadata->>'coverReference') BETWEEN 1 AND 512
    AND v_metadata->>'coverReference'
      ~* '^https://(books[.]google[.]com(?::[0-9]+)?([/?#][^[:space:]]*)?|covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-M[.]jpg)$';
  v_selection_id:=jsonb_typeof(p_detail#>'{metadata,selectionId}')='string'
    AND p_detail#>>'{metadata,selectionId}'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  IF v_selection_id AND NOT v_cover THEN
    v_selection:=(p_detail#>>'{metadata,selectionId}')::uuid;
    SELECT jsonb_build_object(
      'coverReference',r.cover_reference,'sourceRelation',r.source_relation,
      'sourceAdapter',r.adapter_key,'sourceAdapterVersion',r.adapter_version,
      'sourceRecordId',r.source_provider_record_id,
      'selectionPolicyVersion',r.selection_policy_version)
    INTO v_representative
    FROM public.phase9_selected_metadata_snapshots s
    JOIN marketplace_sec.phase9_metadata_representative_covers r
      ON r.source_attempt_id=s.outcome_source_attempt_id
    WHERE s.id=v_selection;
  END IF;
  RETURN jsonb_build_object(
    'title',CASE WHEN v_title THEN v_metadata->'title' ELSE 'null'::jsonb END,
    'authors',CASE WHEN v_authors THEN v_metadata->'authors' ELSE 'null'::jsonb END,
    'language',CASE WHEN v_language THEN v_metadata->'language' ELSE 'null'::jsonb END,
    'coverReference',CASE WHEN v_cover THEN v_metadata->'coverReference' ELSE 'null'::jsonb END,
    'selectionId',CASE WHEN v_selection_id
      THEN p_detail#>'{metadata,selectionId}' ELSE 'null'::jsonb END,
    'representativeCover',coalesce(v_representative,'null'::jsonb));
END$$;

COMMIT;
