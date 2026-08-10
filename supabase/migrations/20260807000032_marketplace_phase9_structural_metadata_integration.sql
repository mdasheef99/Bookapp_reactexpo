-- Phase 9 structural vision-candidate to metadata integration.
-- Forward-only after WU1. Creation does not authorize live application.
BEGIN;

CREATE FUNCTION marketplace_sec.phase9_metadata_normalized_text(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT pg_catalog.lower(pg_catalog.regexp_replace(
    pg_catalog.btrim(normalize(coalesce(p_value,''),NFKC)),
    '[[:space:]]+',' ','g'))
$$;

CREATE FUNCTION marketplace_sec.phase9_metadata_normalized_language(p_value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_parts text[]; v_part text; v_result text:=''; v_index integer;
BEGIN
  v_parts:=pg_catalog.string_to_array(p_value,'-');
  IF v_parts IS NULL OR coalesce(pg_catalog.array_length(v_parts,1),0)<1
    OR v_parts[1] !~ '^[A-Za-z]{2,3}$' THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  FOR v_index IN 1..pg_catalog.array_length(v_parts,1) LOOP
    v_part:=v_parts[v_index];
    IF v_part !~ '^[A-Za-z0-9]{2,8}$' THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_part:=CASE
      WHEN v_index=1 THEN pg_catalog.lower(v_part)
      WHEN pg_catalog.char_length(v_part)=4 AND v_part~'^[A-Za-z]+$'
        THEN pg_catalog.upper(pg_catalog.substr(v_part,1,1))||
          pg_catalog.lower(pg_catalog.substr(v_part,2))
      WHEN (pg_catalog.char_length(v_part)=2 AND v_part~'^[A-Za-z]+$')
        OR v_part~'^[0-9]{3}$' THEN pg_catalog.upper(v_part)
      ELSE pg_catalog.lower(v_part) END;
    v_result:=v_result||CASE WHEN v_index=1 THEN '' ELSE '-' END||v_part;
  END LOOP;
  RETURN v_result;
END$$;

CREATE FUNCTION marketplace_sec.phase9_metadata_normalized_isbn13(p_value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_clean text; v_sum integer:=0; v_index integer; v_digit integer; v_base text;
BEGIN
  v_clean:=pg_catalog.upper(pg_catalog.regexp_replace(
    coalesce(p_value,''),'[[:space:]-]+','','g'));
  IF v_clean~'^[0-9]{9}[0-9X]$' THEN
    FOR v_index IN 1..9 LOOP
      v_sum:=v_sum+(11-v_index)*(pg_catalog.substr(v_clean,v_index,1)::integer);
    END LOOP;
    v_sum:=v_sum+CASE WHEN pg_catalog.substr(v_clean,10,1)='X' THEN 10
      ELSE pg_catalog.substr(v_clean,10,1)::integer END;
    IF v_sum%11<>0 THEN RETURN NULL; END IF;
    v_base:='978'||pg_catalog.substr(v_clean,1,9); v_sum:=0;
    FOR v_index IN 1..12 LOOP
      v_digit:=pg_catalog.substr(v_base,v_index,1)::integer;
      v_sum:=v_sum+v_digit*CASE WHEN v_index%2=1 THEN 1 ELSE 3 END;
    END LOOP;
    RETURN v_base||((10-(v_sum%10))%10)::text;
  ELSIF v_clean~'^[0-9]{13}$' THEN
    FOR v_index IN 1..12 LOOP
      v_digit:=pg_catalog.substr(v_clean,v_index,1)::integer;
      v_sum:=v_sum+v_digit*CASE WHEN v_index%2=1 THEN 1 ELSE 3 END;
    END LOOP;
    IF ((10-(v_sum%10))%10)=pg_catalog.substr(v_clean,13,1)::integer THEN
      RETURN v_clean;
    END IF;
  END IF;
  RETURN NULL;
END$$;

CREATE FUNCTION marketplace_sec.phase9_metadata_candidate_query_identity(
  p_candidate public.image_extraction_candidates
) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT jsonb_build_array(
    'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1',
    CASE WHEN marketplace_sec.phase9_metadata_normalized_isbn13(
      p_candidate.observed_isbn_clue) IS NULL THEN 'bibliographic' ELSE 'isbn' END,
    marketplace_sec.phase9_metadata_normalized_isbn13(p_candidate.observed_isbn_clue),
    marketplace_sec.phase9_metadata_normalized_text(p_candidate.observed_title),
    to_jsonb(ARRAY(SELECT marketplace_sec.phase9_metadata_normalized_text(author_name)
      FROM unnest(p_candidate.observed_authors) WITH ORDINALITY a(author_name,ordinality)
      WHERE marketplace_sec.phase9_metadata_normalized_text(author_name)<>''
      ORDER BY ordinality)),
    marketplace_sec.phase9_metadata_normalized_language(p_candidate.observed_language),
    to_jsonb(ARRAY(SELECT DISTINCT clue FROM (SELECT
      marketplace_sec.phase9_metadata_normalized_text(
        p_candidate.observed_publisher_clue) clue) normalized
      WHERE clue<>'' ORDER BY clue))
  )::text
$$;

CREATE FUNCTION marketplace_sec.phase9_enqueue_candidate_metadata_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_query_identity text;
  v_semantic_identity jsonb;
  v_dedupe_key text;
BEGIN
  -- Only model-created usable candidates enter this producer. Manual missed
  -- candidates retain their separately approved Owner workflow.
  IF NEW.vision_job_id IS NULL OR NEW.analysis_observation_id IS NULL
    OR NEW.analysis_schema_version IS DISTINCT FROM 'p9-vision-v2'
    OR NEW.state<>'processing' OR NOT EXISTS(
      SELECT 1 FROM public.image_analysis_observations o
      JOIN public.image_analysis_results r ON r.id=o.analysis_result_id
      JOIN public.image_extraction_jobs j ON j.id=r.vision_job_id
      JOIN public.image_extraction_inputs i ON i.id=NEW.input_id
      JOIN public.image_extraction_sessions s ON s.id=NEW.session_id
      WHERE o.id=NEW.analysis_observation_id AND o.disposition='candidate'
        AND o.store_id=NEW.store_id AND o.input_id=NEW.input_id
        AND r.vision_job_id=NEW.vision_job_id AND r.store_id=NEW.store_id
        AND r.input_id=NEW.input_id AND r.session_id=NEW.session_id
        AND r.analysis_schema_version='p9-vision-v2'
        AND r.authoritative_outcome IN ('accepted','accepted_with_language_skips')
        AND j.job_kind='vision_extract' AND j.entity_type='input'
        AND j.entity_id=NEW.input_id AND j.store_id=NEW.store_id
        AND i.session_id=NEW.session_id AND i.store_id=NEW.store_id
        AND s.store_id=NEW.store_id) THEN
    RETURN NEW;
  END IF;
  v_query_identity:=marketplace_sec.phase9_metadata_candidate_query_identity(NEW);
  v_semantic_identity:=jsonb_build_object(
    'kind','metadata_enrich',
    'contractVersion','p9-metadata-foundation-v1',
    'candidateId',NEW.id,
    'queryIdentity',v_query_identity,
    'routingPolicyVersion','p9-metadata-routing-v1',
    'selectionPolicyVersion','p9-metadata-selection-v1'
  );
  v_dedupe_key:='metadata_enrich:'||encode(
    extensions.digest(v_semantic_identity::text,'sha256'),'hex');

  INSERT INTO public.image_extraction_jobs(
    store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version
  ) VALUES (
    NEW.store_id,'candidate',NEW.id,'metadata_enrich',v_dedupe_key,
    'p9-metadata-foundation-v1'
  );
  RETURN NEW;
END$$;

CREATE TRIGGER phase9_enqueue_candidate_metadata_job
  AFTER INSERT ON public.image_extraction_candidates
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_enqueue_candidate_metadata_job();

CREATE FUNCTION marketplace_sec.phase9_assert_structural_metadata_candidate(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer
) RETURNS public.image_extraction_candidates
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_candidate public.image_extraction_candidates;
BEGIN
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  SELECT c.* INTO v_candidate FROM public.image_extraction_candidates c
    JOIN public.image_analysis_observations o ON o.id=c.analysis_observation_id
    JOIN public.image_analysis_results r ON r.id=o.analysis_result_id
    JOIN public.image_extraction_inputs i ON i.id=c.input_id
    JOIN public.image_extraction_sessions s ON s.id=c.session_id
    JOIN public.image_extraction_jobs vj ON vj.id=c.vision_job_id
    WHERE c.id=v_job.entity_id AND c.id=p_candidate_id
      AND c.version=p_candidate_version AND c.store_id=v_job.store_id
      AND c.state='processing' AND c.analysis_schema_version='p9-vision-v2'
      AND o.disposition='candidate' AND o.input_id=c.input_id AND o.store_id=c.store_id
      AND r.vision_job_id=c.vision_job_id AND r.input_id=c.input_id
      AND r.session_id=c.session_id AND r.store_id=c.store_id
      AND r.analysis_schema_version='p9-vision-v2'
      AND r.authoritative_outcome IN ('accepted','accepted_with_language_skips')
      AND i.session_id=c.session_id AND i.store_id=c.store_id
      AND s.store_id=c.store_id AND vj.job_kind='vision_extract'
      AND vj.entity_type='input' AND vj.entity_id=c.input_id
      AND vj.store_id=c.store_id FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN v_candidate;
END$$;

CREATE FUNCTION marketplace_sec.phase9_complete_structural_local_metadata_match(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_lookup_strategy text,p_lookup_contract_version text,p_normalizer_version text,
  p_routing_policy_version text,p_privacy_scope text,p_schema_version text,
  p_canonical_edition_id uuid,p_snapshot_version text,p_selection_policy_version text,
  p_match_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_candidate public.image_extraction_candidates;
BEGIN
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  IF p_query_identity<>marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate)
    THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN marketplace_sec.phase9_complete_local_metadata_match(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_query_identity,p_lookup_strategy,
    p_lookup_contract_version,p_normalizer_version,p_routing_policy_version,p_privacy_scope,
    p_schema_version,p_canonical_edition_id,p_snapshot_version,p_selection_policy_version,
    p_match_evidence);
END$$;

CREATE FUNCTION public.phase9_complete_structural_local_metadata_match(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_lookup_strategy text,p_lookup_contract_version text,p_normalizer_version text,
  p_routing_policy_version text,p_privacy_scope text,p_schema_version text,
  p_canonical_edition_id uuid,p_snapshot_version text,p_selection_policy_version text,
  p_match_evidence jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_complete_structural_local_metadata_match(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version,
    p_query_identity,p_lookup_strategy,p_lookup_contract_version,p_normalizer_version,
    p_routing_policy_version,p_privacy_scope,p_schema_version,p_canonical_edition_id,
    p_snapshot_version,p_selection_policy_version,p_match_evidence)
$$;

CREATE TABLE public.phase9_metadata_provider_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_attempt_id uuid NOT NULL REFERENCES public.metadata_enrichment_attempts(id),
  job_id uuid NOT NULL REFERENCES public.image_extraction_jobs(id),
  candidate_id uuid NOT NULL REFERENCES public.image_extraction_candidates(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  physical_call_identity uuid NOT NULL UNIQUE,
  claim_attempt_number integer NOT NULL CHECK (claim_attempt_number BETWEEN 1 AND 5),
  claim_worker text NOT NULL,
  claim_lease_token_hash text NOT NULL CHECK (claim_lease_token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'registered' CHECK (status IN
    ('registered','finalized','outcome_unknown','stale_rejected')),
  normalized_outcome text,
  logical_outcome text,
  provider_request_id text,
  retryable boolean,
  normalized_candidate jsonb,
  match_evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  completed_at timestamptz,
  UNIQUE(logical_attempt_id,claim_attempt_number,physical_call_identity)
);
CREATE INDEX phase9_metadata_provider_calls_lineage_idx
  ON public.phase9_metadata_provider_calls(logical_attempt_id,created_at,id);
ALTER TABLE public.phase9_metadata_provider_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_metadata_provider_calls OWNER TO postgres;
REVOKE ALL ON public.phase9_metadata_provider_calls FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.phase9_metadata_provider_calls TO service_role;

CREATE TABLE public.phase9_metadata_coalescing_waiters (
  job_id uuid PRIMARY KEY REFERENCES public.image_extraction_jobs(id),
  candidate_id uuid NOT NULL REFERENCES public.image_extraction_candidates(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  leader_lookup_id uuid NOT NULL REFERENCES public.phase9_metadata_lookups(id),
  query_identity text NOT NULL,
  provider_cache_identity text NOT NULL,
  privacy_scope text NOT NULL CHECK (privacy_scope IN ('public_bibliographic','store_private')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  resolved_at timestamptz
);
CREATE INDEX phase9_metadata_coalescing_waiters_leader_idx
  ON public.phase9_metadata_coalescing_waiters(leader_lookup_id,created_at,job_id);
ALTER TABLE public.phase9_metadata_coalescing_waiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_metadata_coalescing_waiters OWNER TO postgres;
REVOKE ALL ON public.phase9_metadata_coalescing_waiters FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.phase9_metadata_coalescing_waiters TO service_role;

CREATE FUNCTION marketplace_sec.phase9_metadata_job_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  IF marketplace_sec.phase9_metadata_normalized_isbn13(
    v_candidate.observed_isbn_clue) IS NOT NULL THEN
    SELECT e.id INTO v_local_edition_id FROM public.canonical_editions e
    WHERE marketplace_sec.phase9_metadata_normalized_isbn13(v_candidate.observed_isbn_clue)
      IN (marketplace_sec.phase9_metadata_normalized_isbn13(e.isbn_13),
        marketplace_sec.phase9_metadata_normalized_isbn13(e.isbn_10))
    ORDER BY e.id LIMIT 1;
  END IF;
  IF v_local_edition_id IS NULL THEN
    SELECT e.id INTO v_local_edition_id FROM public.canonical_editions e
    WHERE marketplace_sec.phase9_metadata_normalized_text(e.title)=
        marketplace_sec.phase9_metadata_normalized_text(v_candidate.observed_title)
      AND ARRAY(SELECT marketplace_sec.phase9_metadata_normalized_text(x)
        FROM unnest(e.authors) x WHERE marketplace_sec.phase9_metadata_normalized_text(x)<>'')=
        ARRAY(SELECT marketplace_sec.phase9_metadata_normalized_text(x)
        FROM unnest(v_candidate.observed_authors) x
        WHERE marketplace_sec.phase9_metadata_normalized_text(x)<>'')
      AND marketplace_sec.phase9_metadata_normalized_language(e.language)=
        marketplace_sec.phase9_metadata_normalized_language(v_candidate.observed_language)
    ORDER BY e.id LIMIT 1;
  END IF;

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
END$$;

CREATE FUNCTION public.phase9_metadata_job_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_metadata_job_context(
    p_job_id,p_worker,p_lease_token,p_attempt_count)
$$;

CREATE FUNCTION marketplace_sec.phase9_metadata_cache_reuse_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_provider_cache_identity text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_candidate public.image_extraction_candidates;
  v_cache public.phase9_metadata_cache_entries; v_attempt public.metadata_enrichment_attempts;
  v_lookup public.phase9_metadata_lookups; v_query_identity text;
BEGIN
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  IF char_length(p_provider_cache_identity) NOT BETWEEN 1 AND 3072 THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  v_query_identity:=marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate);
  SELECT * INTO v_cache FROM public.phase9_metadata_cache_entries c
    WHERE c.provider_cache_identity=p_provider_cache_identity
      AND c.query_identity=v_query_identity AND c.invalidated_at IS NULL
      AND c.expires_at>transaction_timestamp()
      AND (c.privacy_scope='public_bibliographic' OR c.store_id=v_job.store_id);
  IF NOT FOUND THEN RETURN jsonb_build_object(
    'leaderLookupId',NULL,'normalizedOutcome',NULL); END IF;
  SELECT * INTO v_attempt FROM public.metadata_enrichment_attempts a
    WHERE a.id=v_cache.source_attempt_id AND a.adapter_key=v_cache.adapter_key
      AND a.adapter_version=v_cache.adapter_version
      AND a.provider_cache_identity=v_cache.provider_cache_identity
      AND a.disposition<>'unresolved';
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups l
    WHERE l.id=v_attempt.lookup_id AND l.completed_at IS NOT NULL
      AND l.query_identity=v_query_identity
      AND l.provider_cache_identity=p_provider_cache_identity
      AND l.normalizer_version=v_cache.normalizer_version
      AND l.schema_version=v_cache.schema_version
      AND l.cache_policy_version=v_cache.cache_policy_version
      AND l.reuse_policy_version=v_cache.reuse_policy_version
      AND (l.privacy_scope='public_bibliographic' OR l.store_id=v_job.store_id);
  IF v_attempt.id IS NULL OR v_lookup.id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.phase9_provider_registry r
    WHERE r.adapter_key=v_cache.adapter_key AND r.provider_kind='metadata'
      AND r.adapter_version=v_cache.adapter_version AND r.enabled
      AND r.revalidation_seconds IS NOT NULL
      AND r.policy_version::text=v_cache.reuse_policy_version) THEN
    RETURN jsonb_build_object('leaderLookupId',NULL,'normalizedOutcome',NULL);
  END IF;
  RETURN jsonb_build_object('leaderLookupId',v_lookup.id,
    'normalizedOutcome',v_lookup.normalized_outcome);
END$$;

CREATE FUNCTION public.phase9_metadata_cache_reuse_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_provider_cache_identity text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_metadata_cache_reuse_context(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,
    p_candidate_version,p_provider_cache_identity)
$$;

CREATE FUNCTION marketplace_sec.phase9_metadata_coalescing_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_provider_cache_identity text,p_adapter_key text,p_adapter_version text,
  p_capability_version text,p_schema_version text,p_lookup_strategy text,
  p_lookup_contract_version text,p_normalizer_version text,p_routing_policy_version text,
  p_privacy_scope text,p_reuse_policy_version text,p_cache_policy_version text,
  p_cache_namespace text,p_leader_lookup_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_candidate public.image_extraction_candidates;
  v_leader public.phase9_metadata_lookups; v_lookup public.phase9_metadata_lookups;
BEGIN
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  IF p_leader_lookup_id IS NOT NULL OR p_query_identity<>
      marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate)
    OR p_privacy_scope NOT IN ('public_bibliographic','store_private')
    OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r
      WHERE r.provider_kind='metadata' AND r.adapter_key=p_adapter_key
        AND r.adapter_version=p_adapter_version AND r.enabled AND r.matching_allowed
        AND r.revalidation_seconds IS NOT NULL
        AND r.policy_version::text=p_reuse_policy_version) THEN
    RAISE EXCEPTION 'P9_METADATA_REUSE_DENIED';
  END IF;
  LOCK TABLE public.phase9_metadata_lookups IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups l
    WHERE l.job_id=p_job_id AND l.query_identity=p_query_identity
      AND l.routing_policy_version=p_routing_policy_version;
  IF FOUND THEN RETURN jsonb_build_object('mode','leader','lookupId',v_lookup.id); END IF;
  SELECT l.* INTO v_leader FROM public.phase9_metadata_lookups l
    WHERE l.job_id<>p_job_id AND l.leader_lookup_id IS NULL
      AND l.query_identity=p_query_identity
      AND l.provider_cache_identity=p_provider_cache_identity
      AND (l.privacy_scope='public_bibliographic' OR l.store_id=v_job.store_id)
    ORDER BY (l.completed_at IS NULL) DESC,l.created_at,l.id LIMIT 1;
  IF FOUND THEN
    IF v_leader.completed_at IS NULL THEN
      INSERT INTO public.phase9_metadata_coalescing_waiters(
        job_id,candidate_id,store_id,leader_lookup_id,query_identity,
        provider_cache_identity,privacy_scope)
      VALUES(v_job.id,v_candidate.id,v_job.store_id,v_leader.id,p_query_identity,
        p_provider_cache_identity,p_privacy_scope)
      ON CONFLICT(job_id) DO NOTHING;
      IF NOT EXISTS(SELECT 1 FROM public.phase9_metadata_coalescing_waiters w
        WHERE w.job_id=v_job.id AND w.candidate_id=v_candidate.id
          AND w.store_id=v_job.store_id AND w.leader_lookup_id=v_leader.id
          AND w.query_identity=p_query_identity
          AND w.provider_cache_identity=p_provider_cache_identity
          AND w.privacy_scope=p_privacy_scope) THEN
        RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
      END IF;
      RETURN jsonb_build_object(
        'mode','follower_pending','leaderLookupId',v_leader.id);
    END IF;
    IF EXISTS(SELECT 1 FROM public.phase9_selected_metadata_snapshots s
      WHERE s.lookup_id=v_leader.id) THEN
      UPDATE public.phase9_metadata_coalescing_waiters SET resolved_at=transaction_timestamp()
        WHERE job_id=v_job.id AND leader_lookup_id=v_leader.id AND resolved_at IS NULL;
      RETURN jsonb_build_object('mode','follower','leaderLookupId',v_leader.id);
    END IF;
  END IF;
  INSERT INTO public.phase9_metadata_lookups(candidate_id,store_id,job_id,query_identity,
    provider_cache_identity,adapter_key,adapter_version,capability_version,schema_version,
    lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,
    privacy_scope,reuse_policy_version,cache_policy_version,cache_namespace,
    claim_attempt_number,claim_worker,claim_lease_token_hash)
  VALUES(v_candidate.id,v_job.store_id,v_job.id,p_query_identity,p_provider_cache_identity,
    p_adapter_key,p_adapter_version,p_capability_version,p_schema_version,p_lookup_strategy,
    p_lookup_contract_version,p_normalizer_version,p_routing_policy_version,p_privacy_scope,
    p_reuse_policy_version,p_cache_policy_version,p_cache_namespace,p_attempt_count,p_worker,
    encode(extensions.digest(p_lease_token,'sha256'),'hex')) RETURNING * INTO v_lookup;
  RETURN jsonb_build_object('mode','leader','lookupId',v_lookup.id);
END$$;

CREATE FUNCTION public.phase9_metadata_coalescing_context(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_provider_cache_identity text,p_adapter_key text,p_adapter_version text,
  p_capability_version text,p_schema_version text,p_lookup_strategy text,
  p_lookup_contract_version text,p_normalizer_version text,p_routing_policy_version text,
  p_privacy_scope text,p_reuse_policy_version text,p_cache_policy_version text,
  p_cache_namespace text,p_leader_lookup_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_metadata_coalescing_context(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version,
    p_query_identity,p_provider_cache_identity,p_adapter_key,p_adapter_version,
    p_capability_version,p_schema_version,p_lookup_strategy,p_lookup_contract_version,
    p_normalizer_version,p_routing_policy_version,p_privacy_scope,p_reuse_policy_version,
    p_cache_policy_version,p_cache_namespace,p_leader_lookup_id)
$$;

CREATE FUNCTION marketplace_sec.phase9_complete_metadata_cache_reuse(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_provider_cache_identity text,p_adapter_key text,
  p_adapter_version text,p_capability_version text,p_schema_version text,
  p_lookup_strategy text,p_lookup_contract_version text,p_normalizer_version text,
  p_routing_policy_version text,p_privacy_scope text,p_reuse_policy_version text,
  p_cache_policy_version text,p_cache_namespace text,
  p_snapshot_version text,p_selection_policy_version text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_candidate public.image_extraction_candidates;
  v_cache public.phase9_metadata_cache_entries; v_attempt public.metadata_enrichment_attempts;
  v_leader public.phase9_metadata_lookups;
  v_leader_snapshot public.phase9_selected_metadata_snapshots;
  v_lookup public.phase9_metadata_lookups; v_snapshot_id uuid;
BEGIN
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  IF p_query_identity<>
      marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate)
    OR p_lookup_strategy NOT IN ('isbn','bibliographic','approved_strong_evidence')
    OR p_privacy_scope NOT IN ('public_bibliographic','store_private') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  SELECT * INTO v_cache FROM public.phase9_metadata_cache_entries c
    WHERE c.provider_cache_identity=p_provider_cache_identity
      AND c.query_identity=p_query_identity AND c.adapter_key=p_adapter_key
      AND c.adapter_version=p_adapter_version
      AND c.capability_version=p_capability_version
      AND c.schema_version=p_schema_version
      AND c.normalizer_version=p_normalizer_version
      AND c.cache_policy_version=p_cache_policy_version
      AND c.reuse_policy_version=p_reuse_policy_version
      AND c.privacy_scope=p_privacy_scope AND c.invalidated_at IS NULL
      AND c.expires_at>transaction_timestamp()
      AND (c.privacy_scope='public_bibliographic' OR c.store_id=v_job.store_id)
    FOR SHARE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r
    WHERE r.adapter_key=p_adapter_key AND r.provider_kind='metadata'
      AND r.adapter_version=p_adapter_version AND r.enabled
      AND r.revalidation_seconds IS NOT NULL
      AND r.policy_version::text=p_reuse_policy_version
      AND (v_cache.outcome<>'positive' OR r.storage_allowed)) THEN
    RAISE EXCEPTION 'P9_METADATA_REUSE_DENIED';
  END IF;
  SELECT * INTO v_attempt FROM public.metadata_enrichment_attempts a
    WHERE a.id=v_cache.source_attempt_id AND a.disposition<>'unresolved'
      AND a.provider_cache_identity=p_provider_cache_identity
      AND a.adapter_key=p_adapter_key AND a.adapter_version=p_adapter_version;
  SELECT * INTO v_leader FROM public.phase9_metadata_lookups l
    WHERE l.id=v_attempt.lookup_id AND l.completed_at IS NOT NULL
      AND l.query_identity=p_query_identity
      AND l.provider_cache_identity=p_provider_cache_identity
      AND l.routing_policy_version=p_routing_policy_version
      AND l.cache_namespace=p_cache_namespace;
  SELECT * INTO v_leader_snapshot FROM public.phase9_selected_metadata_snapshots s
    WHERE s.lookup_id=v_leader.id AND s.snapshot_version=p_snapshot_version
      AND s.selection_policy_version=p_selection_policy_version;
  IF v_attempt.id IS NULL OR v_leader.id IS NULL OR v_leader_snapshot.id IS NULL
    OR (v_cache.outcome='positive'
      AND v_leader.normalized_outcome<>'accepted_metadata_match')
    OR (v_cache.outcome='negative' AND v_leader.normalized_outcome<>'no_match')
    OR (v_cache.outcome='ambiguous'
      AND v_leader.normalized_outcome NOT IN ('ambiguous','material_conflict')) THEN
    RAISE EXCEPTION 'P9_METADATA_REUSE_DENIED';
  END IF;
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups l
    WHERE l.job_id=v_job.id AND l.query_identity=p_query_identity
      AND l.routing_policy_version=p_routing_policy_version;
  IF FOUND THEN
    IF v_lookup.leader_lookup_id<>v_leader.id OR v_lookup.completed_at IS NULL
      OR v_lookup.provider_cache_identity<>p_provider_cache_identity
      OR v_lookup.store_id<>v_job.store_id OR v_lookup.candidate_id<>v_candidate.id THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN jsonb_build_object('lookup_id',v_lookup.id,'status','replayed',
      'normalized_outcome',v_lookup.normalized_outcome);
  END IF;
  INSERT INTO public.phase9_metadata_lookups(
    candidate_id,store_id,job_id,query_identity,provider_cache_identity,adapter_key,
    adapter_version,capability_version,schema_version,lookup_strategy,
    lookup_contract_version,normalizer_version,routing_policy_version,privacy_scope,
    reuse_policy_version,cache_policy_version,cache_namespace,claim_attempt_number,
    claim_worker,claim_lease_token_hash,leader_lookup_id,reuse_source_attempt_id,
    outcome_source_attempt_id,normalized_outcome,canonical_edition_id,completed_at)
  VALUES(v_candidate.id,v_job.store_id,v_job.id,p_query_identity,p_provider_cache_identity,
    p_adapter_key,p_adapter_version,p_capability_version,p_schema_version,p_lookup_strategy,
    p_lookup_contract_version,p_normalizer_version,p_routing_policy_version,p_privacy_scope,
    p_reuse_policy_version,p_cache_policy_version,p_cache_namespace,p_attempt_count,p_worker,
    encode(extensions.digest(p_lease_token,'sha256'),'hex'),v_leader.id,
    v_leader_snapshot.selected_attempt_id,v_leader.outcome_source_attempt_id,
    v_leader.normalized_outcome,v_leader.canonical_edition_id,transaction_timestamp())
  RETURNING * INTO v_lookup;
  INSERT INTO public.phase9_selected_metadata_snapshots(
    candidate_id,store_id,lookup_id,selected_attempt_id,outcome_source_attempt_id,
    canonical_edition_id,snapshot_version,selection_policy_version,coherent_edition,
    match_evidence,manual_outcome)
  VALUES(v_candidate.id,v_job.store_id,v_lookup.id,v_leader_snapshot.selected_attempt_id,
    v_leader_snapshot.outcome_source_attempt_id,v_leader_snapshot.canonical_edition_id,
    v_leader_snapshot.snapshot_version,v_leader_snapshot.selection_policy_version,
    v_leader_snapshot.coherent_edition,v_leader_snapshot.match_evidence,
    v_leader_snapshot.manual_outcome) RETURNING id INTO v_snapshot_id;
  UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=v_snapshot_id,
    canonical_edition_id=v_leader_snapshot.canonical_edition_id,
    state=CASE WHEN v_leader_snapshot.manual_outcome IN
      ('local_canonical_match','accepted_metadata_match') THEN 'ready' ELSE 'needs_review' END,
    updated_at=transaction_timestamp() WHERE id=v_candidate.id AND store_id=v_job.store_id;
  UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,
    lease_expires_at=NULL,lease_token_hash=NULL,completed_at=transaction_timestamp(),
    updated_at=transaction_timestamp() WHERE id=v_job.id;
  RETURN jsonb_build_object('lookup_id',v_lookup.id,'status','completed',
    'normalized_outcome',v_lookup.normalized_outcome);
END$$;

CREATE FUNCTION public.phase9_complete_metadata_cache_reuse(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_provider_cache_identity text,p_adapter_key text,
  p_adapter_version text,p_capability_version text,p_schema_version text,
  p_lookup_strategy text,p_lookup_contract_version text,p_normalizer_version text,
  p_routing_policy_version text,p_privacy_scope text,p_reuse_policy_version text,
  p_cache_policy_version text,p_cache_namespace text,
  p_snapshot_version text,p_selection_policy_version text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_complete_metadata_cache_reuse(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version,
    p_query_identity,p_provider_cache_identity,p_adapter_key,p_adapter_version,p_capability_version,
    p_schema_version,p_lookup_strategy,p_lookup_contract_version,p_normalizer_version,
    p_routing_policy_version,p_privacy_scope,p_reuse_policy_version,
    p_cache_policy_version,p_cache_namespace,p_snapshot_version,p_selection_policy_version)
$$;

CREATE FUNCTION marketplace_sec.phase9_select_structural_metadata_snapshot(
  p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_selected_attempt_id uuid,
  p_outcome_source_attempt_id uuid,p_snapshot_version text,p_selection_policy_version text,
  p_coherent_edition jsonb,p_match_evidence jsonb,p_manual_outcome text,
  p_canonical_edition_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_candidate public.image_extraction_candidates;
BEGIN
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  IF NOT EXISTS(SELECT 1 FROM public.phase9_metadata_lookups l
    WHERE l.id=p_lookup_id AND l.job_id=p_job_id AND l.candidate_id=v_candidate.id
      AND l.store_id=v_candidate.store_id
      AND l.query_identity=marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate))
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN marketplace_sec.phase9_select_metadata_snapshot(
    p_lookup_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_selected_attempt_id,
    p_outcome_source_attempt_id,p_snapshot_version,p_selection_policy_version,
    p_coherent_edition,p_match_evidence,p_manual_outcome,p_canonical_edition_id);
END$$;

CREATE FUNCTION public.phase9_select_structural_metadata_snapshot(
  p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_selected_attempt_id uuid,
  p_outcome_source_attempt_id uuid,p_snapshot_version text,p_selection_policy_version text,
  p_coherent_edition jsonb,p_match_evidence jsonb,p_manual_outcome text,
  p_canonical_edition_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_select_structural_metadata_snapshot(
    p_lookup_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,
    p_candidate_version,p_selected_attempt_id,p_outcome_source_attempt_id,
    p_snapshot_version,p_selection_policy_version,p_coherent_edition,p_match_evidence,
    p_manual_outcome,p_canonical_edition_id)
$$;

CREATE FUNCTION marketplace_sec.phase9_register_metadata_provider_call(
  p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer,p_physical_call_identity uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_attempt public.metadata_enrichment_attempts;
  v_candidate public.image_extraction_candidates;
  v_call public.phase9_metadata_provider_calls;
BEGIN
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=v_job.entity_id AND c.store_id=v_job.store_id;
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,v_job.entity_id,v_candidate.version);
  SELECT a.* INTO v_attempt FROM public.metadata_enrichment_attempts a
    JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id
    JOIN public.image_extraction_candidates c ON c.id=l.candidate_id
    WHERE a.id=p_attempt_id AND l.job_id=v_job.id AND l.candidate_id=v_job.entity_id
      AND l.store_id=v_job.store_id AND a.candidate_id=l.candidate_id
      AND a.store_id=l.store_id AND c.store_id=l.store_id AND c.state='processing'
      AND l.completed_at IS NULL AND a.disposition='unresolved'
      AND l.query_identity=marketplace_sec.phase9_metadata_candidate_query_identity(c);
  IF NOT FOUND OR v_attempt.provider_role<>'primary' OR p_physical_call_identity IS NULL THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  SELECT * INTO v_call FROM public.phase9_metadata_provider_calls c
    WHERE c.physical_call_identity=p_physical_call_identity;
  IF FOUND THEN
    IF v_call.logical_attempt_id<>p_attempt_id OR v_call.job_id<>p_job_id
      OR v_call.claim_attempt_number<>p_attempt_count OR v_call.claim_worker<>p_worker
      OR v_call.claim_lease_token_hash<>
        encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN jsonb_build_object('provider_call_id',v_call.id,'status',v_call.status);
  END IF;
  INSERT INTO public.phase9_metadata_provider_calls(
    logical_attempt_id,job_id,candidate_id,store_id,physical_call_identity,
    claim_attempt_number,claim_worker,claim_lease_token_hash
  ) VALUES(v_attempt.id,v_job.id,v_job.entity_id,v_job.store_id,p_physical_call_identity,
    p_attempt_count,p_worker,encode(extensions.digest(p_lease_token,'sha256'),'hex'))
  RETURNING * INTO v_call;
  RETURN jsonb_build_object('provider_call_id',v_call.id,'status',v_call.status);
END$$;

CREATE FUNCTION marketplace_sec.phase9_finalize_metadata_provider_call(
  p_provider_call_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer,p_status text,p_normalized_outcome text,
  p_logical_outcome text,p_provider_request_id text,p_retryable boolean,p_normalized_candidate jsonb,
  p_match_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_call public.phase9_metadata_provider_calls;
  v_effective_status text; v_claim_active boolean; v_candidate_version integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$' OR p_attempt_count NOT BETWEEN 1 AND 5
    OR p_status NOT IN ('finalized','outcome_unknown','stale_rejected')
    OR p_normalized_outcome IS NULL OR p_logical_outcome IS NULL OR p_retryable IS NULL
    OR p_normalized_outcome !~ '^[a-z][a-z0-9_]{0,63}$'
    OR (p_provider_request_id IS NOT NULL AND
      (char_length(p_provider_request_id) NOT BETWEEN 1 AND 128
        OR p_provider_request_id !~ '^[A-Za-z0-9._:-]+$')) THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs j
    WHERE j.id=p_job_id AND j.job_kind='metadata_enrich'
      AND j.entity_type='candidate' FOR UPDATE;
  SELECT pc.* INTO v_call FROM public.phase9_metadata_provider_calls pc
    JOIN public.metadata_enrichment_attempts a ON a.id=pc.logical_attempt_id
    JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id
    JOIN public.image_extraction_candidates c ON c.id=pc.candidate_id
    WHERE pc.id=p_provider_call_id AND pc.job_id=v_job.id
      AND pc.candidate_id=v_job.entity_id AND pc.store_id=v_job.store_id
      AND l.job_id=v_job.id AND l.candidate_id=pc.candidate_id
      AND l.store_id=pc.store_id AND a.candidate_id=pc.candidate_id
      AND a.store_id=pc.store_id AND c.store_id=pc.store_id FOR UPDATE OF pc;
  IF v_job.id IS NULL OR v_call.id IS NULL OR v_call.claim_attempt_number<>p_attempt_count
    OR v_call.claim_worker<>p_worker OR v_call.claim_lease_token_hash<>
      encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  SELECT c.version INTO v_candidate_version FROM public.image_extraction_candidates c
    WHERE c.id=v_job.entity_id AND c.store_id=v_job.store_id;
  PERFORM marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,v_job.entity_id,v_candidate_version);
  IF p_normalized_candidate IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.phase9_provider_registry r
    JOIN public.metadata_enrichment_attempts a ON a.id=v_call.logical_attempt_id
    WHERE r.provider_kind='metadata' AND r.adapter_key=a.adapter_key
      AND r.adapter_version=a.adapter_version AND r.enabled AND r.storage_allowed
  ) THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
  v_claim_active:=v_job.status='in_progress' AND v_job.lease_owner=p_worker
    AND v_job.attempt_count=p_attempt_count
    AND v_job.lease_token_hash=encode(extensions.digest(p_lease_token,'sha256'),'hex')
    AND v_job.lease_expires_at>transaction_timestamp()
    AND EXISTS(SELECT 1 FROM public.image_extraction_candidates c
      WHERE c.id=v_job.entity_id AND c.store_id=v_job.store_id AND c.state='processing');
  v_effective_status:=CASE WHEN v_claim_active THEN p_status ELSE 'stale_rejected' END;
  IF v_call.status<>'registered' THEN
    IF v_call.status<>v_effective_status OR v_call.normalized_outcome<>p_normalized_outcome
      OR v_call.logical_outcome IS DISTINCT FROM p_logical_outcome
      OR v_call.provider_request_id IS DISTINCT FROM p_provider_request_id
      OR v_call.retryable IS DISTINCT FROM p_retryable
      OR v_call.normalized_candidate IS DISTINCT FROM p_normalized_candidate
      OR v_call.match_evidence IS DISTINCT FROM p_match_evidence THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN jsonb_build_object('provider_call_id',v_call.id,'status',v_call.status);
  END IF;
  UPDATE public.phase9_metadata_provider_calls SET status=v_effective_status,
    normalized_outcome=p_normalized_outcome,provider_request_id=p_provider_request_id,
    logical_outcome=p_logical_outcome,
    retryable=p_retryable,normalized_candidate=p_normalized_candidate,
    match_evidence=p_match_evidence,
    completed_at=transaction_timestamp() WHERE id=v_call.id;
  RETURN jsonb_build_object('provider_call_id',v_call.id,'status',v_effective_status);
END$$;

CREATE FUNCTION marketplace_sec.phase9_reconcile_metadata_provider_call(
  p_provider_call_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_call public.phase9_metadata_provider_calls;
  v_candidate_version integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$' OR p_attempt_count NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs j
    WHERE j.id=p_job_id AND j.job_kind='metadata_enrich'
      AND j.entity_type='candidate' FOR UPDATE;
  SELECT pc.* INTO v_call FROM public.phase9_metadata_provider_calls pc
    JOIN public.metadata_enrichment_attempts a ON a.id=pc.logical_attempt_id
    JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id
    JOIN public.image_extraction_candidates c ON c.id=pc.candidate_id
    WHERE pc.id=p_provider_call_id AND pc.job_id=v_job.id
      AND pc.candidate_id=v_job.entity_id AND pc.store_id=v_job.store_id
      AND l.job_id=v_job.id AND l.candidate_id=pc.candidate_id
      AND l.store_id=pc.store_id AND a.candidate_id=pc.candidate_id
      AND a.store_id=pc.store_id AND c.store_id=pc.store_id FOR UPDATE OF pc;
  IF v_job.id IS NULL OR v_call.id IS NULL OR v_call.claim_attempt_number<>p_attempt_count
    OR v_call.claim_worker<>p_worker OR v_call.claim_lease_token_hash<>
      encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  IF v_call.status='registered' THEN
    SELECT c.version INTO v_candidate_version FROM public.image_extraction_candidates c
      WHERE c.id=v_job.entity_id AND c.store_id=v_job.store_id;
    PERFORM marketplace_sec.phase9_assert_structural_metadata_candidate(
      p_job_id,p_worker,p_lease_token,p_attempt_count,v_job.entity_id,v_candidate_version);
    UPDATE public.phase9_metadata_provider_calls SET status='outcome_unknown',
      normalized_outcome='provider_unavailable',logical_outcome='provider_unavailable',
      provider_request_id=NULL,retryable=true,normalized_candidate=NULL,
      match_evidence='[]'::jsonb,completed_at=transaction_timestamp()
      WHERE id=v_call.id RETURNING * INTO v_call;
  END IF;
  RETURN jsonb_build_object('provider_call_id',v_call.id,'status',v_call.status,
    'normalized_outcome',v_call.normalized_outcome,'logical_outcome',v_call.logical_outcome,
    'provider_request_id',v_call.provider_request_id,'retryable',v_call.retryable,
    'normalized_candidate',v_call.normalized_candidate,'match_evidence',v_call.match_evidence);
END$$;

CREATE FUNCTION public.phase9_register_metadata_provider_call(
  p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer,p_physical_call_identity uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_register_metadata_provider_call(p_attempt_id,p_job_id,
    p_worker,p_lease_token,p_attempt_count,p_physical_call_identity)
$$;
CREATE FUNCTION public.phase9_finalize_metadata_provider_call(
  p_provider_call_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer,p_status text,p_normalized_outcome text,p_logical_outcome text,
  p_provider_request_id text,
  p_retryable boolean,p_normalized_candidate jsonb,p_match_evidence jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_finalize_metadata_provider_call(p_provider_call_id,p_job_id,
    p_worker,p_lease_token,p_attempt_count,p_status,p_normalized_outcome,p_logical_outcome,p_provider_request_id,
    p_retryable,p_normalized_candidate,p_match_evidence)
$$;
CREATE FUNCTION public.phase9_reconcile_metadata_provider_call(
  p_provider_call_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_reconcile_metadata_provider_call(
    p_provider_call_id,p_job_id,p_worker,p_lease_token,p_attempt_count)
$$;

CREATE FUNCTION marketplace_sec.phase9_reserve_metadata_usage(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_lookup_id uuid,p_adapter_key text,p_adapter_version text,p_policy_version integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_lookup public.phase9_metadata_lookups;
  v_reservation public.phase9_usage_reservations;
  v_candidate public.image_extraction_candidates;
BEGIN
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=v_job.entity_id AND c.store_id=v_job.store_id;
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,v_job.entity_id,v_candidate.version);
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups l
    WHERE l.id=p_lookup_id AND l.job_id=v_job.id AND l.store_id=v_job.store_id
      AND l.candidate_id=v_candidate.id
      AND l.query_identity=marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate);
  IF NOT FOUND OR p_policy_version<1 OR NOT EXISTS(
    SELECT 1 FROM public.phase9_provider_registry r
    WHERE r.adapter_key=p_adapter_key AND r.provider_kind='metadata'
      AND r.adapter_version=p_adapter_version AND r.enabled AND r.matching_allowed
      AND r.policy_version=p_policy_version) THEN
    RAISE EXCEPTION 'P9_METADATA_PROVIDER_DISABLED';
  END IF;
  INSERT INTO public.phase9_usage_reservations(
    store_id,job_id,cost_kind,policy_version,operation,adapter_key,
    adapter_version,idempotency_identity,reserved_cost_units
  ) VALUES(v_job.store_id,v_job.id,'metadata',p_policy_version,'metadata_lookup',
    p_adapter_key,p_adapter_version,v_job.dedupe_key,0)
  ON CONFLICT(store_id,job_id,cost_kind,policy_version) DO NOTHING;
  SELECT * INTO v_reservation FROM public.phase9_usage_reservations r
    WHERE r.store_id=v_job.store_id AND r.job_id=v_job.id
      AND r.cost_kind='metadata' AND r.policy_version=p_policy_version;
  IF NOT FOUND OR v_reservation.adapter_key<>p_adapter_key
    OR v_reservation.adapter_version<>p_adapter_version
    OR v_reservation.idempotency_identity<>v_job.dedupe_key THEN
    RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
  END IF;
  RETURN jsonb_build_object('reservation_id',v_reservation.id,
    'status',v_reservation.status);
END$$;

CREATE FUNCTION public.phase9_reserve_metadata_usage(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_lookup_id uuid,p_adapter_key text,p_adapter_version text,p_policy_version integer
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_reserve_metadata_usage(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_lookup_id,
    p_adapter_key,p_adapter_version,p_policy_version)
$$;

CREATE FUNCTION marketplace_sec.phase9_fail_metadata_job(
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
      THEN 'P9_METADATA_ATTEMPTS_EXHAUSTED' ELSE upper('P9_METADATA_'||v_manual_outcome) END,
    last_safe_error_category='metadata',completed_at=transaction_timestamp(),
    dead_lettered_at=CASE WHEN v_job_status='dead_letter' THEN transaction_timestamp() ELSE NULL END,
    updated_at=transaction_timestamp() WHERE id=v_job.id;
  RETURN jsonb_build_object('status',v_job_status,'manual_outcome',v_manual_outcome,
    'snapshot_id',v_snapshot_id);
END$$;

CREATE FUNCTION public.phase9_fail_metadata_job(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_failure_kind text,p_retryable boolean
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_fail_metadata_job(p_job_id,p_worker,p_lease_token,
    p_attempt_count,p_candidate_id,p_candidate_version,p_query_identity,
    p_failure_kind,p_retryable)
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_metadata_state(p_candidate_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE
    WHEN c.owner_review_snapshot#>>'{value,metadataChoice,mode}'='manual' THEN 'manual'
    WHEN s.manual_outcome IN ('local_canonical_match','accepted_metadata_match') THEN 'selected'
    WHEN l.normalized_outcome='manual_metadata_required' THEN 'manual'
    WHEN l.normalized_outcome='no_match' THEN 'no_match'
    WHEN l.normalized_outcome IN ('ambiguous','material_conflict') THEN 'ambiguous'
    WHEN l.normalized_outcome='technical_failure' THEN 'temporarily_unavailable'
    WHEN l.normalized_outcome IN ('policy_denied','cost_quota_denied') THEN 'failed'
    ELSE 'pending' END
  FROM public.image_extraction_candidates c
  LEFT JOIN public.phase9_selected_metadata_snapshots s
    ON s.id=c.selected_metadata_snapshot_id AND s.candidate_id=c.id
      AND s.store_id=c.store_id
  LEFT JOIN LATERAL (SELECT ml.normalized_outcome FROM public.phase9_metadata_lookups ml
    WHERE ml.candidate_id=c.id ORDER BY ml.created_at DESC,ml.id DESC LIMIT 1) l ON true
  WHERE c.id=p_candidate_id
$$;

CREATE FUNCTION marketplace_sec.phase9_register_structural_metadata_lookup(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_provider_cache_identity text,p_adapter_key text,p_adapter_version text,
  p_capability_version text,p_schema_version text,p_lookup_strategy text,
  p_lookup_contract_version text,p_normalizer_version text,p_routing_policy_version text,
  p_privacy_scope text,p_reuse_policy_version text,p_cache_policy_version text,
  p_cache_namespace text,p_leader_lookup_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_candidate public.image_extraction_candidates;
BEGIN
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  IF p_query_identity<>marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate)
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN marketplace_sec.phase9_register_metadata_lookup(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_query_identity,
    p_provider_cache_identity,p_adapter_key,p_adapter_version,p_capability_version,
    p_schema_version,p_lookup_strategy,p_lookup_contract_version,p_normalizer_version,
    p_routing_policy_version,p_privacy_scope,p_reuse_policy_version,
    p_cache_policy_version,p_cache_namespace,p_leader_lookup_id);
END$$;

CREATE FUNCTION public.phase9_register_structural_metadata_lookup(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_provider_cache_identity text,p_adapter_key text,p_adapter_version text,
  p_capability_version text,p_schema_version text,p_lookup_strategy text,
  p_lookup_contract_version text,p_normalizer_version text,p_routing_policy_version text,
  p_privacy_scope text,p_reuse_policy_version text,p_cache_policy_version text,
  p_cache_namespace text,p_leader_lookup_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_register_structural_metadata_lookup(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version,
    p_query_identity,p_provider_cache_identity,p_adapter_key,p_adapter_version,
    p_capability_version,p_schema_version,p_lookup_strategy,p_lookup_contract_version,
    p_normalizer_version,p_routing_policy_version,p_privacy_scope,p_reuse_policy_version,
    p_cache_policy_version,p_cache_namespace,p_leader_lookup_id)
$$;

CREATE FUNCTION marketplace_sec.phase9_register_structural_metadata_attempt(
  p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_provider_attempt_identity uuid,
  p_provider_cache_identity text,p_provider_role text,p_attempt_sequence integer,
  p_adapter_key text,p_adapter_version text,p_capability_version text,p_schema_version text,
  p_normalizer_version text,p_routing_policy_version text,p_predecessor_outcome text,
  p_usage_reservation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_candidate public.image_extraction_candidates;
BEGIN
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  IF NOT EXISTS(SELECT 1 FROM public.phase9_metadata_lookups l
    WHERE l.id=p_lookup_id AND l.job_id=p_job_id AND l.candidate_id=v_candidate.id
      AND l.store_id=v_candidate.store_id
      AND l.query_identity=marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate))
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN marketplace_sec.phase9_register_metadata_attempt(
    p_lookup_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_provider_attempt_identity,
    p_provider_cache_identity,p_provider_role,p_attempt_sequence,p_adapter_key,
    p_adapter_version,p_capability_version,p_schema_version,p_normalizer_version,
    p_routing_policy_version,p_predecessor_outcome,p_usage_reservation_id);
END$$;

CREATE FUNCTION public.phase9_register_structural_metadata_attempt(
  p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_provider_attempt_identity uuid,
  p_provider_cache_identity text,p_provider_role text,p_attempt_sequence integer,
  p_adapter_key text,p_adapter_version text,p_capability_version text,p_schema_version text,
  p_normalizer_version text,p_routing_policy_version text,p_predecessor_outcome text,
  p_usage_reservation_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_register_structural_metadata_attempt(
    p_lookup_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,
    p_candidate_version,p_provider_attempt_identity,p_provider_cache_identity,
    p_provider_role,p_attempt_sequence,p_adapter_key,p_adapter_version,p_capability_version,
    p_schema_version,p_normalizer_version,p_routing_policy_version,p_predecessor_outcome,
    p_usage_reservation_id)
$$;

CREATE FUNCTION marketplace_sec.phase9_finalize_structural_metadata_attempt(
  p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_disposition text,
  p_normalized_outcome text,p_provider_request_id text,p_cache_status text,
  p_latency_ms integer,p_pricing_policy_version text,p_pricing_evidence jsonb,
  p_calculated_cost_units numeric,p_normalized_candidate jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_candidate public.image_extraction_candidates;
BEGIN
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  IF NOT EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts a
    JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id
    WHERE a.id=p_attempt_id AND a.candidate_id=v_candidate.id
      AND a.store_id=v_candidate.store_id AND l.job_id=p_job_id
      AND l.candidate_id=v_candidate.id AND l.store_id=v_candidate.store_id)
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN marketplace_sec.phase9_finalize_metadata_attempt(
    p_attempt_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_disposition,
    p_normalized_outcome,p_provider_request_id,p_cache_status,p_latency_ms,
    p_pricing_policy_version,p_pricing_evidence,p_calculated_cost_units,
    p_normalized_candidate);
END$$;

CREATE FUNCTION public.phase9_finalize_structural_metadata_attempt(
  p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_disposition text,
  p_normalized_outcome text,p_provider_request_id text,p_cache_status text,
  p_latency_ms integer,p_pricing_policy_version text,p_pricing_evidence jsonb,
  p_calculated_cost_units numeric,p_normalized_candidate jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_finalize_structural_metadata_attempt(
    p_attempt_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,
    p_candidate_version,p_disposition,p_normalized_outcome,p_provider_request_id,
    p_cache_status,p_latency_ms,p_pricing_policy_version,p_pricing_evidence,
    p_calculated_cost_units,p_normalized_candidate)
$$;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_metadata_candidate_query_identity(
  public.image_extraction_candidates) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_structural_metadata_lookup(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_register_structural_metadata_lookup(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_structural_metadata_lookup(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_register_structural_metadata_lookup(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_structural_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_register_structural_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_structural_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_register_structural_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid)
  TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_finalize_structural_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,integer,text,jsonb,numeric,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_finalize_structural_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,integer,text,jsonb,numeric,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_finalize_structural_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,integer,text,jsonb,numeric,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_finalize_structural_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,integer,text,jsonb,numeric,jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_metadata_normalized_text(text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_metadata_normalized_language(text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_metadata_normalized_isbn13(text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_enqueue_candidate_metadata_job()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_assert_structural_metadata_candidate(
  uuid,text,text,integer,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_structural_local_metadata_match(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_complete_structural_local_metadata_match(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_structural_local_metadata_match(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_complete_structural_local_metadata_match(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_metadata_job_context(uuid,text,text,integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_metadata_job_context(uuid,text,text,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_metadata_job_context(uuid,text,text,integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_metadata_job_context(uuid,text,text,integer)
  TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_metadata_cache_reuse_context(
  uuid,text,text,integer,uuid,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_metadata_cache_reuse_context(
  uuid,text,text,integer,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_metadata_cache_reuse_context(
  uuid,text,text,integer,uuid,integer,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_metadata_cache_reuse_context(
  uuid,text,text,integer,uuid,integer,text) TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_metadata_coalescing_context(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_metadata_coalescing_context(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_metadata_coalescing_context(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_metadata_coalescing_context(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_metadata_cache_reuse(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_complete_metadata_cache_reuse(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_metadata_cache_reuse(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_complete_metadata_cache_reuse(
  uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_select_structural_metadata_snapshot(
  uuid,uuid,text,text,integer,uuid,integer,uuid,uuid,text,text,jsonb,jsonb,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_select_structural_metadata_snapshot(
  uuid,uuid,text,text,integer,uuid,integer,uuid,uuid,text,text,jsonb,jsonb,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_select_structural_metadata_snapshot(
  uuid,uuid,text,text,integer,uuid,integer,uuid,uuid,text,text,jsonb,jsonb,text,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_select_structural_metadata_snapshot(
  uuid,uuid,text,text,integer,uuid,integer,uuid,uuid,text,text,jsonb,jsonb,text,uuid)
  TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_metadata_provider_call(
  uuid,uuid,text,text,integer,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_finalize_metadata_provider_call(
  uuid,uuid,text,text,integer,text,text,text,text,boolean,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_register_metadata_provider_call(
  uuid,uuid,text,text,integer,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_finalize_metadata_provider_call(
  uuid,uuid,text,text,integer,text,text,text,text,boolean,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_reconcile_metadata_provider_call(
  uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_reconcile_metadata_provider_call(
  uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_metadata_provider_call(
  uuid,uuid,text,text,integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_finalize_metadata_provider_call(
  uuid,uuid,text,text,integer,text,text,text,text,boolean,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_register_metadata_provider_call(
  uuid,uuid,text,text,integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_finalize_metadata_provider_call(
  uuid,uuid,text,text,integer,text,text,text,text,boolean,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_reconcile_metadata_provider_call(
  uuid,uuid,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_reconcile_metadata_provider_call(
  uuid,uuid,text,text,integer) TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_reserve_metadata_usage(
  uuid,text,text,integer,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_reserve_metadata_usage(
  uuid,text,text,integer,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_reserve_metadata_usage(
  uuid,text,text,integer,uuid,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_reserve_metadata_usage(
  uuid,text,text,integer,uuid,text,text,integer) TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_fail_metadata_job(
  uuid,text,text,integer,uuid,integer,text,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_fail_metadata_job(
  uuid,text,text,integer,uuid,integer,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_fail_metadata_job(
  uuid,text,text,integer,uuid,integer,text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_fail_metadata_job(
  uuid,text,text,integer,uuid,integer,text,text,boolean) TO service_role;

COMMIT;
