-- Owner edition-picker SDD §§4.3/5–6/9: operation-specific fences, preserve automatic history.
BEGIN;
ALTER TABLE public.metadata_enrichment_attempts
 DROP CONSTRAINT metadata_enrichment_attempts_candidate_id_adapter_key_attem_key;
CREATE UNIQUE INDEX phase9_edition_legacy_attempt_sequence ON public.metadata_enrichment_attempts(candidate_id,adapter_key,attempt_sequence)
 WHERE lookup_id IS NULL;
CREATE UNIQUE INDEX phase9_edition_lookup_attempt_sequence ON public.metadata_enrichment_attempts(lookup_id,adapter_key,attempt_sequence)
 WHERE lookup_id IS NOT NULL;
-- Existing provider_attempt_identity and (lookup_id,provider_role) uniqueness is unchanged.
CREATE FUNCTION marketplace_sec.phase9_edition_local_match(p_candidate public.image_extraction_candidates)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE isbn text:=marketplace_sec.phase9_metadata_normalized_isbn13(p_candidate.observed_isbn_clue);
 q text:=marketplace_sec.phase9_metadata_candidate_query_identity(p_candidate);
 e public.canonical_editions; matches uuid[];
BEGIN
 IF isbn IS NULL THEN
  -- A unique safe text match is a medium suggestion; the existing gateway records text evidence.
  SELECT array_agg(x.id) INTO matches FROM (
   SELECT c.id FROM public.canonical_editions c
   WHERE marketplace_sec.phase9_edition_identity_compatible(
    marketplace_sec.phase9_edition_canonical_snapshot(c),q) LIMIT 2
  ) x;
 ELSE
  -- Count identifier conflicts before filtering metadata; never choose an arbitrary ISBN duplicate.
  SELECT array_agg(x.id) INTO matches FROM (
   SELECT c.id FROM public.canonical_editions c WHERE isbn IN(
    marketplace_sec.phase9_metadata_normalized_isbn13(c.isbn_13),
    marketplace_sec.phase9_metadata_normalized_isbn13(c.isbn_10)) LIMIT 2
  ) x;
 END IF;
 IF cardinality(matches) IS DISTINCT FROM 1 THEN RETURN NULL; END IF;
 SELECT * INTO e FROM public.canonical_editions WHERE id=matches[1];
 IF NOT marketplace_sec.phase9_edition_identity_compatible(
  marketplace_sec.phase9_edition_canonical_snapshot(e),q) THEN RETURN NULL; END IF;
 RETURN e.id;
EXCEPTION WHEN others THEN RETURN NULL;
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_worker_candidate(p_job public.image_extraction_jobs)
RETURNS public.image_extraction_candidates LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.image_extraction_sessions; state public.phase9_candidate_edition_state;
BEGIN
 SELECT * INTO c FROM public.image_extraction_candidates WHERE id=p_job.entity_id AND store_id=p_job.store_id FOR UPDATE;
 IF c.id IS NULL OR p_job.operation_version IS DISTINCT FROM 'p9-owner-edition-options-v1'
  OR c.state NOT IN('ready','needs_review','possible_duplicate') OR c.committed_inventory_id IS NOT NULL
  OR c.expires_at<=transaction_timestamp() OR c.review_disposition IN('owner_removed_from_scan','skipped_false_detection')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO s FROM public.image_extraction_sessions WHERE id=c.session_id AND store_id=c.store_id;
 SELECT * INTO state FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id
  AND session_id=c.session_id AND store_id=c.store_id AND request_id=p_job.id;
 IF s.id IS NULL OR state.candidate_id IS NULL OR NOT marketplace_sec.phase9_owner_ux_session_mutable(s)
  OR state.query_identity IS DISTINCT FROM marketplace_sec.phase9_edition_query_identity(c)
  OR NOT EXISTS(SELECT 1 FROM public.store_administrators a JOIN public.stores store ON store.id=a.store_id
   WHERE a.store_id=c.store_id AND a.user_id=s.created_by AND a.role='owner' AND a.status='active'
    AND store.status='active' AND store.setup_status='complete' AND store.selling_status='allowed')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN c;
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_worker_context(p_job public.image_extraction_jobs)
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
 SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE lookup_id=l.id AND provider_role='primary';
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT coalesce(jsonb_agg(jsonb_build_object('adapterKey',r.adapter_key,'adapterVersion',r.adapter_version,
  'enabled',r.enabled,'matchingAllowed',r.matching_allowed,'storageAllowed',r.storage_allowed,
  'reuseAllowed',r.revalidation_seconds IS NOT NULL,'policyVersion',r.policy_version)),'[]') INTO providers
 FROM public.phase9_provider_registry r WHERE r.provider_kind='metadata' AND r.adapter_key='google_books';
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
  'currentAttemptId',a.id,'currentAttemptOutcome',a.normalized_outcome,'currentAttemptDisposition',a.disposition,
  'currentAttemptCandidate',a.normalized_payload,'currentAttemptProviderRequestId',a.provider_request_id,
  'currentPhysicalStatus',pc.status,'currentPhysicalOutcome',pc.normalized_outcome,
  'currentPhysicalLogicalOutcome',pc.logical_outcome,'currentPhysicalProviderRequestId',pc.provider_request_id,
  'currentPhysicalRetryable',pc.retryable,'currentPhysicalCandidate',pc.normalized_candidate,
  'currentPhysicalEvidence',pc.match_evidence,'providerPolicies',providers);
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_metadata_job_context(p_job_id uuid, p_worker text, p_lease_token text, p_attempt_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_job public.image_extraction_jobs;
  v_candidate public.image_extraction_candidates;
  v_session public.image_extraction_sessions;
  v_input public.image_extraction_inputs;
  v_observation public.image_analysis_observations;
  v_result public.image_analysis_results;
  v_lookup public.phase9_metadata_lookups;
  v_local_edition_id uuid;
  v_reusable_lookup_id uuid;
  v_reusable_outcome text;
  v_current_attempt_id uuid;
  v_current_attempt_outcome text;
  v_current_attempt_disposition text;
  v_current_attempt_payload jsonb;
  v_current_attempt_request_id text;
  v_physical_status text;
  v_physical_outcome text;
  v_physical_logical_outcome text;
  v_physical_request_id text;
  v_physical_retryable boolean;
  v_physical_candidate jsonb;
  v_physical_evidence jsonb;
  v_query_identity text;
  v_providers jsonb;
BEGIN
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=v_job.entity_id AND c.store_id=v_job.store_id FOR UPDATE;
  IF v_job.operation_version='p9-owner-edition-options-v1' THEN
    RETURN marketplace_sec.phase9_edition_worker_context(v_job)||jsonb_build_object('claimToken',p_lease_token);
  END IF;
  IF NOT FOUND OR v_candidate.state<>'processing'
    OR v_candidate.vision_job_id IS NULL
    OR v_candidate.analysis_observation_id IS NULL THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  SELECT * INTO v_session FROM public.image_extraction_sessions s
    WHERE s.id=v_candidate.session_id AND s.store_id=v_job.store_id;
  SELECT * INTO v_input FROM public.image_extraction_inputs i
    WHERE i.id=v_candidate.input_id AND i.session_id=v_session.id
      AND i.store_id=v_job.store_id;
  SELECT * INTO v_observation FROM public.image_analysis_observations o
    WHERE o.id=v_candidate.analysis_observation_id
      AND o.input_id=v_input.id AND o.store_id=v_job.store_id;
  SELECT * INTO v_result FROM public.image_analysis_results r
    WHERE r.id=v_observation.analysis_result_id
      AND r.vision_job_id=v_candidate.vision_job_id
      AND r.input_id=v_input.id AND r.session_id=v_session.id
      AND r.store_id=v_job.store_id AND r.analysis_schema_version='p9-vision-v2'
      AND r.authoritative_outcome IN ('accepted','accepted_with_language_skips');
  IF v_session.id IS NULL OR v_input.id IS NULL OR v_observation.id IS NULL
    OR v_result.id IS NULL OR v_observation.disposition<>'candidate'
    OR NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs vj
      WHERE vj.id=v_candidate.vision_job_id AND vj.job_kind='vision_extract'
        AND vj.entity_type='input' AND vj.entity_id=v_input.id
        AND vj.store_id=v_job.store_id) THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;

  v_query_identity:=marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate);
  v_local_edition_id:=marketplace_sec.phase9_edition_local_match(v_candidate);

  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups l
    WHERE l.job_id=v_job.id ORDER BY l.created_at DESC,l.id DESC LIMIT 1;
  IF v_lookup.id IS NOT NULL AND v_lookup.completed_at IS NULL
    AND (v_lookup.claim_attempt_number<>p_attempt_count
      OR v_lookup.claim_worker<>p_worker
      OR v_lookup.claim_lease_token_hash<>
        encode(extensions.digest(p_lease_token,'sha256'),'hex')) THEN
    UPDATE public.phase9_metadata_lookups SET claim_attempt_number=p_attempt_count,
      claim_worker=p_worker,
      claim_lease_token_hash=encode(extensions.digest(p_lease_token,'sha256'),'hex')
    WHERE id=v_lookup.id AND candidate_id=v_candidate.id AND store_id=v_job.store_id
      AND completed_at IS NULL RETURNING * INTO v_lookup;
  END IF;
  IF v_lookup.id IS NOT NULL THEN
    SELECT a.id,a.normalized_outcome,a.disposition,a.normalized_payload,a.provider_request_id
      INTO v_current_attempt_id,v_current_attempt_outcome,v_current_attempt_disposition,
        v_current_attempt_payload,v_current_attempt_request_id
    FROM public.metadata_enrichment_attempts a WHERE a.lookup_id=v_lookup.id
      AND a.provider_role='primary' ORDER BY a.created_at DESC,a.id DESC LIMIT 1;
    IF v_current_attempt_id IS NOT NULL THEN
      SELECT pc.status,pc.normalized_outcome,pc.logical_outcome,pc.provider_request_id,pc.retryable,
        pc.normalized_candidate,pc.match_evidence
        INTO v_physical_status,v_physical_outcome,v_physical_logical_outcome,v_physical_request_id,
          v_physical_retryable,v_physical_candidate,v_physical_evidence
      FROM public.phase9_metadata_provider_calls pc
      WHERE pc.logical_attempt_id=v_current_attempt_id
      ORDER BY pc.created_at DESC,pc.id DESC LIMIT 1;
    END IF;
  END IF;
  -- Cache reuse is resolved later against the exact provider-cache identity.
  v_reusable_lookup_id:=NULL; v_reusable_outcome:=NULL;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'adapterKey',r.adapter_key,'adapterVersion',r.adapter_version,
    'enabled',r.enabled,'matchingAllowed',r.matching_allowed,
    'storageAllowed',r.storage_allowed,'reuseAllowed',r.revalidation_seconds IS NOT NULL,
    'policyVersion',r.policy_version
  ) ORDER BY r.adapter_key),'[]'::jsonb) INTO v_providers
  FROM public.phase9_provider_registry r WHERE r.provider_kind='metadata';

  RETURN jsonb_build_object(
    'contractVersion','p9-metadata-job-context-v1',
    'jobId',v_job.id,'attempt',v_job.attempt_count,
    'claimToken',p_lease_token,'claimExpiresAt',v_job.lease_expires_at,
    'candidateId',v_candidate.id,'candidateState',v_candidate.state,
    'candidateVersion',v_candidate.version,'storeId',v_job.store_id,
    'sessionId',v_session.id,'inputId',v_input.id,
    'observationId',v_observation.id,
    'title',v_candidate.observed_title,'authors',to_jsonb(v_candidate.observed_authors),
    'isbnClue',v_candidate.observed_isbn_clue,
    'publisherClue',v_candidate.observed_publisher_clue,
    'language',v_candidate.observed_language,'script',v_candidate.observed_script,
    'queryIdentity',v_query_identity,
    'metadataContractVersion','p9-metadata-foundation-v1',
    'lookupContractVersion','p9-metadata-lookup-v1',
    'normalizerVersion','p9-bibliographic-normalizer-v1',
    'routingPolicyVersion','p9-metadata-routing-v1',
    'selectionPolicyVersion','p9-metadata-selection-v1',
    'localCanonicalEditionId',v_local_edition_id,
    'reusableLookupId',v_reusable_lookup_id,'reusableOutcome',v_reusable_outcome,
    'currentLookupId',v_lookup.id,'currentOutcome',v_lookup.normalized_outcome,
    'currentAttemptId',v_current_attempt_id,
    'currentAttemptOutcome',v_current_attempt_outcome,
    'currentAttemptDisposition',v_current_attempt_disposition,
    'currentAttemptCandidate',v_current_attempt_payload,
    'currentAttemptProviderRequestId',v_current_attempt_request_id,
    'currentPhysicalStatus',v_physical_status,
    'currentPhysicalOutcome',v_physical_outcome,
    'currentPhysicalLogicalOutcome',v_physical_logical_outcome,
    'currentPhysicalProviderRequestId',v_physical_request_id,
    'currentPhysicalRetryable',v_physical_retryable,
    'currentPhysicalCandidate',v_physical_candidate,
    'currentPhysicalEvidence',v_physical_evidence,
    'providerPolicies',v_providers
  );
END$function$;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_assert_structural_metadata_candidate(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_candidate_id uuid,p_candidate_version integer)
RETURNS public.image_extraction_candidates LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job public.image_extraction_jobs; c public.image_extraction_candidates;
BEGIN
 job:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 IF job.operation_version='p9-owner-edition-options-v1' THEN
  IF p_candidate_id IS DISTINCT FROM job.entity_id OR coalesce(p_candidate_version,0)<1 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN marketplace_sec.phase9_edition_worker_candidate(job);
 END IF;
 SELECT c0.* INTO c FROM public.image_extraction_candidates c0
  JOIN public.image_analysis_observations o ON o.id=c0.analysis_observation_id
  JOIN public.image_analysis_results r ON r.id=o.analysis_result_id JOIN public.image_extraction_inputs i ON i.id=c0.input_id
  JOIN public.image_extraction_sessions s ON s.id=c0.session_id JOIN public.image_extraction_jobs vj ON vj.id=c0.vision_job_id
  WHERE c0.id=job.entity_id AND c0.id=p_candidate_id AND c0.version=p_candidate_version AND c0.store_id=job.store_id
   AND c0.state='processing' AND c0.analysis_schema_version='p9-vision-v2'
   AND o.disposition='candidate' AND o.input_id=c0.input_id AND o.store_id=c0.store_id
   AND r.vision_job_id=c0.vision_job_id AND r.input_id=c0.input_id AND r.session_id=c0.session_id AND r.store_id=c0.store_id
   AND r.analysis_schema_version='p9-vision-v2' AND r.authoritative_outcome IN('accepted','accepted_with_language_skips')
   AND i.session_id=c0.session_id AND i.store_id=c0.store_id AND s.store_id=c0.store_id AND vj.job_kind='vision_extract'
   AND vj.entity_type='input' AND vj.entity_id=c0.input_id AND vj.store_id=c0.store_id FOR UPDATE OF c0;
 IF c.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN c;
END$$;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_lookup_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate uuid:=coalesce(NEW.candidate_id,OLD.candidate_id);
BEGIN
 IF EXISTS(SELECT 1 FROM public.image_extraction_jobs WHERE id=coalesce(NEW.job_id,OLD.job_id)
  AND operation_version='p9-owner-edition-options-v1') THEN RETURN coalesce(NEW,OLD); END IF;
 UPDATE public.image_extraction_candidates SET metadata_revision=metadata_revision+1,review_ready=false,
  updated_at=transaction_timestamp() WHERE id=candidate;
 RETURN coalesce(NEW,OLD);
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_identity_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_query text; new_query text; s public.phase9_candidate_edition_state; r jsonb:=NEW.owner_review_snapshot->'value';
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=NEW.id;
 IF s.candidate_id IS NULL THEN RETURN NEW; END IF;
 -- The controlled select command saved this exact coherent choice before updating the review.
 IF r#>>'{metadataChoice,mode}'='edition_option' AND r#>>'{metadataChoice,selectionId}'=s.selection_id::text
  AND r->'originalTitle'=s.selected_option_snapshot->'title' AND r->'authors'=s.selected_option_snapshot->'authors'
  AND r->'originalLanguage'=s.selected_option_snapshot->'language'
  AND ROW(NEW.observed_title,NEW.observed_authors,NEW.observed_language,NEW.observed_isbn_clue,
   NEW.observed_publisher_clue,NEW.state,NEW.review_disposition) IS NOT DISTINCT FROM
   ROW(OLD.observed_title,OLD.observed_authors,OLD.observed_language,OLD.observed_isbn_clue,
    OLD.observed_publisher_clue,OLD.state,OLD.review_disposition) THEN RETURN NEW; END IF;
 old_query:=marketplace_sec.phase9_edition_query_identity(OLD);
 new_query:=marketplace_sec.phase9_edition_query_identity(NEW);
 IF old_query IS DISTINCT FROM new_query OR NEW.review_disposition IN('owner_removed_from_scan','skipped_false_detection') THEN
  UPDATE public.phase9_candidate_edition_state SET request_generation=request_generation+1,request_id=NULL,
   query_identity=new_query,options='[]',source_lookup_id=NULL,source_attempt_id=NULL,source_fetched_at=NULL,
   options_expires_at=NULL,selection_id=NULL,selected_source=NULL,selected_source_id=NULL,
   selected_option_snapshot=NULL,selected_at=NULL,selected_by=NULL,updated_at=transaction_timestamp() WHERE candidate_id=NEW.id;
  IF old_query IS DISTINCT FROM new_query THEN
   NEW.metadata_revision:=greatest(NEW.metadata_revision,OLD.metadata_revision+1); NEW.review_ready:=false;
   IF jsonb_typeof(NEW.owner_review_snapshot->'value')='object' THEN
    NEW.owner_review_snapshot:=jsonb_set(NEW.owner_review_snapshot,'{value,metadataChoice}',
     jsonb_build_object('mode','manual','selectionId',NULL)); END IF;
  END IF;
 END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER phase9_edition_identity_change BEFORE UPDATE OF owner_review_snapshot,observed_title,
 observed_authors,observed_language,observed_isbn_clue,observed_publisher_clue,state,review_disposition
 ON public.image_extraction_candidates FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_edition_identity_change();
DO $$DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='marketplace_sec' AND p.proname LIKE 'phase9_edition_%'
 LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature); END LOOP;
END$$;
COMMIT;
