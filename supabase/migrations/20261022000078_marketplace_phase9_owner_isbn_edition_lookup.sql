-- Slice 5a typed ISBN: approved SDD sections 5.1-5.8 and 7.
-- Forward-only; M01-M77 remain immutable. File creation only, no live application.
BEGIN;

ALTER TABLE public.image_extraction_candidates
 ADD COLUMN owner_isbn13 text NULL
 CONSTRAINT phase9_candidate_owner_isbn13_shape
 CHECK (owner_isbn13 IS NULL OR owner_isbn13 ~ '^97[89][0-9]{10}$');

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_query_identity(p_candidate public.image_extraction_candidates)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates:=p_candidate; r jsonb:=c.owner_review_snapshot->'value';
 s public.phase9_candidate_edition_state;
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 IF c.owner_isbn13 IS NOT NULL THEN
  RETURN jsonb_build_array('p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1',
   'isbn',c.owner_isbn13,'','[]'::jsonb,'und','[]'::jsonb)::text;
 END IF;
 -- Choosing a coherent edition does not redefine the original query; an actual identity edit does.
 IF r#>>'{metadataChoice,mode}'='edition_option' AND r#>>'{metadataChoice,selectionId}'=s.selection_id::text
  AND r->'originalTitle'=s.selected_option_snapshot->'title' AND r->'authors'=s.selected_option_snapshot->'authors'
  AND r->'originalLanguage'=s.selected_option_snapshot->'language'
  AND s.query_identity::jsonb->3 IS NOT DISTINCT FROM marketplace_sec.phase9_metadata_candidate_query_identity(c)::jsonb->3
  AND s.query_identity::jsonb->7 IS NOT DISTINCT FROM marketplace_sec.phase9_metadata_candidate_query_identity(c)::jsonb->7
 THEN RETURN s.query_identity; END IF;
 IF r#>>'{originalFieldConfirmation,title}'='true' AND r->>'originalTitle' IS NOT NULL THEN
  c.observed_title:=r->>'originalTitle'; END IF;
 IF jsonb_typeof(r->'authors')='array' AND jsonb_array_length(r->'authors')>0
  AND jsonb_typeof(r#>'{originalFieldConfirmation,authors}')='array'
  AND jsonb_array_length(r->'authors')=jsonb_array_length(r#>'{originalFieldConfirmation,authors}')
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r#>'{originalFieldConfirmation,authors}') x WHERE x<>'true')
 THEN c.observed_authors:=ARRAY(SELECT jsonb_array_elements_text(r->'authors')); END IF;
 IF r->>'originalLanguage' IS NOT NULL THEN c.observed_language:=r->>'originalLanguage'; END IF;
 RETURN marketplace_sec.phase9_metadata_candidate_query_identity(c);
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
  'title',CASE WHEN c.owner_isbn13 IS NOT NULL THEN '' ELSE title END,'authors',CASE WHEN c.owner_isbn13 IS NOT NULL THEN '[]'::jsonb ELSE authors END,'isbnClue',coalesce(c.owner_isbn13,c.observed_isbn_clue),'publisherClue',CASE WHEN c.owner_isbn13 IS NOT NULL THEN NULL ELSE c.observed_publisher_clue END,
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

-- Review-or-observed facts only: deliberately no coherent-edition override.
CREATE FUNCTION marketplace_sec.phase9_edition_effective_title(c public.image_extraction_candidates)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN c.owner_review_snapshot#>>'{value,originalFieldConfirmation,title}'='true'
  THEN c.owner_review_snapshot#>>'{value,originalTitle}' ELSE c.observed_title END
$$;
CREATE FUNCTION marketplace_sec.phase9_edition_effective_authors(c public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE review jsonb:=c.owner_review_snapshot->'value';
BEGIN
 RETURN CASE WHEN jsonb_typeof(review->'authors')='array'
  AND jsonb_typeof(review#>'{originalFieldConfirmation,authors}')='array'
  AND jsonb_array_length(review->'authors')>0
  AND jsonb_array_length(review->'authors')=jsonb_array_length(review#>'{originalFieldConfirmation,authors}')
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(review#>'{originalFieldConfirmation,authors}') x WHERE x<>'true')
 THEN review->'authors' ELSE to_jsonb(c.observed_authors) END;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_identity_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_query text; new_query text; s public.phase9_candidate_edition_state; r jsonb:=NEW.owner_review_snapshot->'value';
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=NEW.id;
 -- A real title/author edit clears ISBN even before an edition state exists.
 IF OLD.owner_isbn13 IS NOT NULL AND NEW.owner_isbn13 IS NOT DISTINCT FROM OLD.owner_isbn13
  AND NOT coalesce((r#>>'{metadataChoice,mode}'='edition_option' AND r#>>'{metadataChoice,selectionId}'=s.selection_id::text
  AND r->'originalTitle'=s.selected_option_snapshot->'title' AND r->'authors'=s.selected_option_snapshot->'authors'
  AND r->'originalLanguage'=s.selected_option_snapshot->'language'
  AND ROW(NEW.observed_title,NEW.observed_authors,NEW.observed_language,NEW.observed_isbn_clue,
   NEW.observed_publisher_clue,NEW.state,NEW.review_disposition,NEW.owner_isbn13) IS NOT DISTINCT FROM
   ROW(OLD.observed_title,OLD.observed_authors,OLD.observed_language,OLD.observed_isbn_clue,
    OLD.observed_publisher_clue,OLD.state,OLD.review_disposition,OLD.owner_isbn13)),false)
  AND (marketplace_sec.phase9_metadata_normalized_text(marketplace_sec.phase9_edition_effective_title(NEW))
    IS DISTINCT FROM marketplace_sec.phase9_metadata_normalized_text(marketplace_sec.phase9_edition_effective_title(OLD))
   OR (SELECT jsonb_agg(marketplace_sec.phase9_metadata_normalized_text(value) ORDER BY ordinal)
    FROM jsonb_array_elements_text(marketplace_sec.phase9_edition_effective_authors(NEW)) WITH ORDINALITY x(value,ordinal)) IS DISTINCT FROM (SELECT jsonb_agg(marketplace_sec.phase9_metadata_normalized_text(value) ORDER BY ordinal)
    FROM jsonb_array_elements_text(marketplace_sec.phase9_edition_effective_authors(OLD)) WITH ORDINALITY x(value,ordinal)))
 THEN NEW.owner_isbn13:=NULL; END IF;
 IF s.candidate_id IS NULL THEN RETURN NEW; END IF;
 -- The controlled select command saved this exact coherent choice before updating the review.
 IF r#>>'{metadataChoice,mode}'='edition_option' AND r#>>'{metadataChoice,selectionId}'=s.selection_id::text
  AND r->'originalTitle'=s.selected_option_snapshot->'title' AND r->'authors'=s.selected_option_snapshot->'authors'
  AND r->'originalLanguage'=s.selected_option_snapshot->'language'
  AND ROW(NEW.observed_title,NEW.observed_authors,NEW.observed_language,NEW.observed_isbn_clue,
   NEW.observed_publisher_clue,NEW.state,NEW.review_disposition,NEW.owner_isbn13) IS NOT DISTINCT FROM
   ROW(OLD.observed_title,OLD.observed_authors,OLD.observed_language,OLD.observed_isbn_clue,
    OLD.observed_publisher_clue,OLD.state,OLD.review_disposition,OLD.owner_isbn13) THEN RETURN NEW; END IF;
 IF OLD.owner_isbn13 IS DISTINCT FROM NEW.owner_isbn13 THEN
  IF jsonb_typeof(NEW.owner_review_snapshot->'value')='object' THEN
   NEW.owner_review_snapshot:=jsonb_set(NEW.owner_review_snapshot,'{value,metadataChoice}',
    jsonb_build_object('mode','manual','selectionId',NULL)); END IF;
 END IF;
 IF ROW(NEW.observed_title,NEW.observed_authors,NEW.observed_language,NEW.observed_isbn_clue,NEW.observed_publisher_clue)
  IS DISTINCT FROM ROW(OLD.observed_title,OLD.observed_authors,OLD.observed_language,OLD.observed_isbn_clue,OLD.observed_publisher_clue)
  AND OLD.owner_isbn13 IS NOT DISTINCT FROM NEW.owner_isbn13 THEN
  IF NEW.owner_isbn13 IS NOT NULL THEN
   old_query:=marketplace_sec.phase9_edition_query_identity(OLD);
   new_query:=marketplace_sec.phase9_edition_query_identity(NEW);
  ELSE
   old_query:=marketplace_sec.phase9_metadata_candidate_query_identity(OLD);
   new_query:=marketplace_sec.phase9_metadata_candidate_query_identity(NEW);
  END IF;
 ELSE old_query:=marketplace_sec.phase9_edition_query_identity(OLD);
  new_query:=marketplace_sec.phase9_edition_query_identity(NEW); END IF;
 IF old_query IS DISTINCT FROM new_query OR OLD.owner_isbn13 IS DISTINCT FROM NEW.owner_isbn13
  OR NEW.review_disposition IN('owner_removed_from_scan','skipped_false_detection') THEN
  UPDATE public.phase9_candidate_edition_state SET request_generation=request_generation+1,request_id=NULL,
   query_identity=new_query,options='[]',source_lookup_id=NULL,source_attempt_id=NULL,source_fetched_at=NULL,
   options_expires_at=NULL,selection_id=NULL,selected_source=NULL,selected_source_id=NULL,
   selected_option_snapshot=NULL,selected_at=NULL,selected_by=NULL,updated_at=transaction_timestamp() WHERE candidate_id=NEW.id;
  IF old_query IS DISTINCT FROM new_query OR OLD.owner_isbn13 IS DISTINCT FROM NEW.owner_isbn13 THEN
   NEW.metadata_revision:=greatest(NEW.metadata_revision,OLD.metadata_revision+1); NEW.review_ready:=false;
   IF jsonb_typeof(NEW.owner_review_snapshot->'value')='object' THEN
    NEW.owner_review_snapshot:=jsonb_set(NEW.owner_review_snapshot,'{value,metadataChoice}',
     jsonb_build_object('mode','manual','selectionId',NULL)); END IF;
  END IF;
 END IF;
 RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS phase9_edition_identity_change ON public.image_extraction_candidates;
CREATE TRIGGER phase9_edition_identity_change BEFORE UPDATE OF owner_review_snapshot,observed_title,
 observed_authors,observed_language,observed_isbn_clue,observed_publisher_clue,state,review_disposition,owner_isbn13
 ON public.image_extraction_candidates FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_edition_identity_change();

CREATE FUNCTION public.phase9_set_candidate_isbn_v1(
 p_session_id uuid,p_candidate_id uuid,p_command_id uuid,p_idempotency_key text,
 p_expected_candidate_version integer,p_isbn13 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
 fingerprint text; replay jsonb; response jsonb;
BEGIN
 IF NOT coalesce(p_command_id IS NOT NULL AND p_idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$'
  AND (p_isbn13 IS NULL OR (p_isbn13 ~ '^97[89][0-9]{10}$'
   AND marketplace_sec.phase9_metadata_normalized_isbn13(p_isbn13)=p_isbn13)),false)
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 fingerprint:=encode(extensions.digest(jsonb_build_array(p_session_id,p_candidate_id,
  p_expected_candidate_version,p_isbn13)::text,'sha256'),'hex');
 replay:=marketplace_sec.phase9_replay(auth.uid()::text,'EP_ISBN_V1',p_idempotency_key,fingerprint);
 IF replay IS NOT NULL THEN RETURN replay; END IF;
 c:=marketplace_sec.phase9_edition_assert_owner_candidate(p_session_id,p_candidate_id);
 IF c.version IS DISTINCT FROM p_expected_candidate_version THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id FOR UPDATE;
 IF c.owner_isbn13 IS NOT DISTINCT FROM p_isbn13 THEN
  response:=jsonb_build_object('sessionId',c.session_id,'candidateId',c.id,'candidateVersion',c.version,
   'metadataRevision',c.metadata_revision,'requestGeneration',coalesce(s.request_generation,0),'ownerIsbn13',c.owner_isbn13);
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'EP_ISBN_V1',p_idempotency_key,response,'edition_isbn_only');
  RETURN response;
 END IF;
 INSERT INTO public.phase9_candidate_edition_state(candidate_id,session_id,store_id,query_identity)
 VALUES(c.id,c.session_id,c.store_id,marketplace_sec.phase9_edition_query_identity(c)) ON CONFLICT(candidate_id) DO NOTHING;
 UPDATE public.image_extraction_candidates SET owner_isbn13=p_isbn13,version=version+1,
  updated_at=transaction_timestamp() WHERE id=c.id RETURNING * INTO c;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 response:=jsonb_build_object('sessionId',c.session_id,'candidateId',c.id,'candidateVersion',c.version,
  'metadataRevision',c.metadata_revision,'requestGeneration',s.request_generation,'ownerIsbn13',c.owner_isbn13);
 PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'EP_ISBN_V1',p_idempotency_key,response,'edition_isbn_only');
 RETURN response;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_option_eligible(p_metadata jsonb,p_query text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE original jsonb:=p_query::jsonb; q jsonb;
BEGIN
 q:=marketplace_sec.phase9_edition_explicit_query(p_metadata,p_query)->'query';
 -- Preserve the existing exact-ISBN unknown-query-language exception.
 IF original->>6='und' AND original->>3 IS NOT NULL
  AND original->>3 IN (marketplace_sec.phase9_metadata_normalized_isbn13(p_metadata->>'isbn13'),
                      marketplace_sec.phase9_metadata_normalized_isbn13(p_metadata->>'isbn10'))
 THEN q:=jsonb_set(q,'{6}',p_metadata->'language'); END IF;
 RETURN marketplace_sec.phase9_edition_identity_compatible(p_metadata,q::text);
EXCEPTION WHEN others THEN RETURN false;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_v1(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_physical_call_identity uuid,p_call_sequence integer,p_call_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates;
 a public.metadata_enrichment_attempts; pc public.phase9_metadata_provider_calls; lookup_row public.phase9_metadata_lookups;
BEGIN
 IF NOT coalesce(auth.role()='service_role' AND p_physical_call_identity IS NOT NULL AND
  ((p_call_sequence=0 AND p_call_stage='search') OR (p_call_sequence=1 AND p_call_stage IN('editions','edition'))
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
 SELECT * INTO lookup_row FROM public.phase9_metadata_lookups WHERE id=a.lookup_id;
 IF p_call_stage='edition' AND lookup_row.query_identity::jsonb->>2 IS DISTINCT FROM 'isbn'
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
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
    WHERE logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count AND edition_call_sequence=1 AND (edition_call_stage='editions'
     OR (edition_call_stage='edition' AND l.query_identity::jsonb->>2='isbn'))))
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

ALTER TABLE public.phase9_metadata_provider_calls DROP CONSTRAINT phase9_edition_http_stage;
ALTER TABLE public.phase9_metadata_provider_calls ADD CONSTRAINT phase9_edition_http_stage CHECK(
 (edition_call_sequence IS NULL AND edition_call_stage IS NULL) OR
 (edition_call_sequence BETWEEN 0 AND 5 AND
  ((edition_call_sequence=0 AND edition_call_stage='search') OR
   (edition_call_sequence=1 AND edition_call_stage IN('editions','edition')) OR
   (edition_call_sequence BETWEEN 2 AND 5 AND edition_call_stage ~ '^author:OL[1-9][0-9]*A$'))));

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_choices(p_candidate public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE response jsonb; s public.phase9_candidate_edition_state; confirmed boolean;
 include_reasons boolean:=false; include_owner_isbn boolean:=false; rows jsonb;
BEGIN
 response:=marketplace_sec.phase9_edition_legacy_choices(p_candidate);
 BEGIN
  include_reasons:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-client-info'
   IN('bookconnect/edition-reasons-v1','bookconnect/edition-reasons-v2'),false);
  include_owner_isbn:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-client-info'
   ='bookconnect/edition-reasons-v2',false);
 EXCEPTION WHEN others THEN include_reasons:=false; include_owner_isbn:=false; END;
 IF include_reasons AND jsonb_array_length(response->'rows')>0 THEN
  SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id
   AND store_id=p_candidate.store_id AND session_id=p_candidate.session_id;
  SELECT jsonb_agg(jsonb_set(r,'{rejectionReason}',coalesce(to_jsonb(
   marketplace_sec.phase9_edition_rejection_reason(s.options->((r->>'ordinal')::integer),s.query_identity,s.options)),
   'null'::jsonb)) ORDER BY ordinal)
  INTO rows FROM jsonb_array_elements(response->'rows') WITH ORDINALITY x(r,ordinal);
  response:=jsonb_set(response,'{rows}',rows);
 END IF;
 IF jsonb_typeof(response->'selection')='object' THEN
  s:=marketplace_sec.phase9_edition_projection_selection(p_candidate);
  confirmed:=coalesce(s.selection_id::text=response#>>'{selection,selectionId}'
   AND s.selected_at IS NOT NULL AND s.selected_by IS NOT NULL,false);
  response:=jsonb_set(response,'{selection,confirmedByOwner}',to_jsonb(confirmed));
 END IF;
 IF include_owner_isbn THEN
  response:=response||jsonb_build_object('ownerIsbn13',p_candidate.owner_isbn13);
 END IF;
 RETURN response;
END$$;

ALTER FUNCTION marketplace_sec.phase9_edition_query_identity(public.image_extraction_candidates) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_edition_worker_context(public.image_extraction_jobs) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_edition_effective_title(public.image_extraction_candidates) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_edition_effective_authors(public.image_extraction_candidates) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_edition_identity_change() OWNER TO postgres;
ALTER FUNCTION public.phase9_set_candidate_isbn_v1(uuid,uuid,uuid,text,integer,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_edition_option_eligible(jsonb,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_edition_choices(public.image_extraction_candidates) OWNER TO postgres;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_effective_title(public.image_extraction_candidates)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_effective_authors(public.image_extraction_candidates)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_set_candidate_isbn_v1(uuid,uuid,uuid,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase9_set_candidate_isbn_v1(uuid,uuid,uuid,text,integer,text) TO authenticated;
COMMIT;
