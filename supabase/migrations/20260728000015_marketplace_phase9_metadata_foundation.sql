-- Phase 9 Unit 5A: provider-neutral metadata lookup, cache, attempt, and selection foundation.
-- Forward-only additive migration after M14. Creation is not authority to apply it live.
BEGIN;

CREATE FUNCTION marketplace_sec.phase9_valid_metadata_pricing_evidence(p_value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT marketplace_sec.phase9_valid_vision_pricing_input(p_value)
$$;

CREATE TABLE public.phase9_metadata_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.image_extraction_candidates(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  job_id uuid NOT NULL REFERENCES public.image_extraction_jobs(id),
  query_identity text NOT NULL CHECK (char_length(query_identity) BETWEEN 1 AND 2048),
  execution_mode text NOT NULL DEFAULT 'external'
    CHECK (execution_mode IN ('local','external')),
  provider_cache_identity text CHECK (
    provider_cache_identity IS NULL OR char_length(provider_cache_identity) BETWEEN 1 AND 3072),
  adapter_key text REFERENCES public.phase9_provider_registry(adapter_key),
  adapter_version text,
  capability_version text,
  schema_version text NOT NULL,
  lookup_strategy text NOT NULL CHECK (
    lookup_strategy IN ('isbn','bibliographic','approved_strong_evidence')),
  lookup_contract_version text NOT NULL,
  normalizer_version text NOT NULL,
  routing_policy_version text NOT NULL,
  privacy_scope text NOT NULL CHECK (privacy_scope IN ('public_bibliographic','store_private')),
  reuse_policy_version text,
  cache_policy_version text,
  cache_namespace text,
  claim_attempt_number integer NOT NULL CHECK (claim_attempt_number BETWEEN 1 AND 5),
  claim_worker text NOT NULL,
  claim_lease_token_hash text NOT NULL CHECK (claim_lease_token_hash ~ '^[0-9a-f]{64}$'),
  leader_lookup_id uuid REFERENCES public.phase9_metadata_lookups(id),
  reuse_source_attempt_id uuid,
  outcome_source_attempt_id uuid,
  normalized_outcome text NOT NULL DEFAULT 'unresolved' CHECK (normalized_outcome IN (
    'unresolved','local_canonical_match','accepted_metadata_match','ambiguous',
    'material_conflict','no_match','technical_failure','policy_denied',
    'cost_quota_denied','manual_metadata_required')),
  canonical_edition_id uuid REFERENCES public.canonical_editions(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  completed_at timestamptz,
  UNIQUE(job_id,query_identity,routing_policy_version),
  CHECK (leader_lookup_id IS NULL OR leader_lookup_id<>id),
  CHECK (
    (execution_mode='external' AND provider_cache_identity IS NOT NULL
      AND adapter_key IS NOT NULL AND adapter_version IS NOT NULL
      AND capability_version IS NOT NULL AND reuse_policy_version IS NOT NULL
      AND cache_policy_version IS NOT NULL AND cache_namespace IS NOT NULL)
    OR
    (execution_mode='local' AND provider_cache_identity IS NULL
      AND adapter_key IS NULL AND adapter_version IS NULL
      AND capability_version IS NULL AND reuse_policy_version IS NULL
      AND cache_policy_version IS NULL AND cache_namespace IS NULL
      AND leader_lookup_id IS NULL AND reuse_source_attempt_id IS NULL
      AND outcome_source_attempt_id IS NULL))
);
CREATE INDEX phase9_metadata_lookup_identity_idx ON public.phase9_metadata_lookups(
  query_identity,provider_cache_identity,routing_policy_version,privacy_scope,
  reuse_policy_version,cache_namespace,created_at);

CREATE TABLE public.phase9_metadata_cache_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_cache_identity text NOT NULL UNIQUE
    CHECK (char_length(provider_cache_identity) BETWEEN 1 AND 3072),
  query_identity text NOT NULL CHECK (char_length(query_identity) BETWEEN 1 AND 2048),
  adapter_key text NOT NULL REFERENCES public.phase9_provider_registry(adapter_key),
  adapter_version text NOT NULL,
  capability_version text NOT NULL,
  normalizer_version text NOT NULL,
  schema_version text NOT NULL,
  cache_policy_version text NOT NULL,
  reuse_policy_version text NOT NULL,
  privacy_scope text NOT NULL CHECK (privacy_scope IN ('public_bibliographic','store_private')),
  store_id uuid REFERENCES public.stores(id),
  outcome text NOT NULL CHECK (outcome IN ('positive','negative','ambiguous')),
  normalized_snapshot jsonb,
  source_attempt_id uuid,
  provider_record_id text,
  source_fetched_at timestamptz,
  expires_at timestamptz NOT NULL,
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK ((privacy_scope='public_bibliographic' AND store_id IS NULL)
    OR (privacy_scope='store_private' AND store_id IS NOT NULL)),
  CHECK ((outcome='positive' AND normalized_snapshot IS NOT NULL)
    OR (outcome<>'positive' AND normalized_snapshot IS NULL)),
  CHECK (expires_at>created_at),
  CHECK (provider_record_id IS NULL OR char_length(provider_record_id) BETWEEN 1 AND 256)
);
CREATE INDEX phase9_metadata_cache_expiry_idx
  ON public.phase9_metadata_cache_entries(expires_at) WHERE invalidated_at IS NULL;

ALTER TABLE public.metadata_enrichment_attempts
  ADD COLUMN lookup_id uuid REFERENCES public.phase9_metadata_lookups(id),
  ADD COLUMN provider_role text CHECK (provider_role IN ('primary','secondary')),
  ADD COLUMN query_identity text CHECK (
    query_identity IS NULL OR char_length(query_identity) BETWEEN 1 AND 2048),
  ADD COLUMN capability_version text,
  ADD COLUMN routing_policy_version text,
  ADD COLUMN predecessor_outcome text,
  ADD COLUMN predecessor_attempt_id uuid REFERENCES public.metadata_enrichment_attempts(id),
  ADD COLUMN provider_cache_identity text,
  ADD COLUMN normalized_outcome text,
  ADD COLUMN provider_request_id text,
  ADD COLUMN usage_reservation_id uuid REFERENCES public.phase9_usage_reservations(id),
  ADD COLUMN pricing_policy_version text,
  ADD COLUMN pricing_evidence jsonb CHECK (
    pricing_evidence IS NULL OR
    marketplace_sec.phase9_valid_metadata_pricing_evidence(pricing_evidence)),
  ADD COLUMN calculated_cost_units numeric CHECK (
    calculated_cost_units IS NULL OR calculated_cost_units BETWEEN 0 AND 1000000000),
  ADD COLUMN disposition text NOT NULL DEFAULT 'unresolved' CHECK (disposition IN (
    'unresolved','accepted','rejected','stale','failed')),
  ADD COLUMN provider_attempt_identity uuid,
  ADD COLUMN possibly_duplicate_spend_of_attempt_id uuid
    REFERENCES public.metadata_enrichment_attempts(id),
  ADD COLUMN completed_at timestamptz,
  ADD CONSTRAINT phase9_metadata_attempt_identity_unique UNIQUE(provider_attempt_identity),
  ADD CONSTRAINT phase9_metadata_attempt_role_unique UNIQUE(lookup_id,provider_role),
  ADD CONSTRAINT phase9_metadata_attempt_request_id_check CHECK (
    provider_request_id IS NULL OR
    (char_length(provider_request_id) BETWEEN 1 AND 128
      AND provider_request_id ~ '^[A-Za-z0-9._:-]+$')),
  ADD CONSTRAINT phase9_metadata_attempt_no_raw_provider_payload CHECK (
    lookup_id IS NULL OR raw_payload IS NULL);

ALTER TABLE public.phase9_metadata_lookups
  ADD CONSTRAINT phase9_metadata_lookup_reuse_attempt_fk
  FOREIGN KEY(reuse_source_attempt_id) REFERENCES public.metadata_enrichment_attempts(id);
ALTER TABLE public.phase9_metadata_lookups
  ADD CONSTRAINT phase9_metadata_lookup_outcome_attempt_fk
  FOREIGN KEY(outcome_source_attempt_id) REFERENCES public.metadata_enrichment_attempts(id);
ALTER TABLE public.phase9_metadata_cache_entries
  ADD CONSTRAINT phase9_metadata_cache_source_attempt_fk
  FOREIGN KEY(source_attempt_id) REFERENCES public.metadata_enrichment_attempts(id);

CREATE TABLE public.phase9_selected_metadata_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.image_extraction_candidates(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  lookup_id uuid NOT NULL REFERENCES public.phase9_metadata_lookups(id),
  selected_attempt_id uuid REFERENCES public.metadata_enrichment_attempts(id),
  outcome_source_attempt_id uuid REFERENCES public.metadata_enrichment_attempts(id),
  canonical_edition_id uuid REFERENCES public.canonical_editions(id),
  snapshot_version text NOT NULL,
  selection_policy_version text NOT NULL,
  coherent_edition jsonb,
  match_evidence jsonb NOT NULL DEFAULT '[]',
  manual_outcome text NOT NULL CHECK (manual_outcome IN (
    'local_canonical_match','accepted_metadata_match','ambiguous','material_conflict',
    'no_match','technical_failure','policy_denied','cost_quota_denied',
    'manual_metadata_required')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(candidate_id),
  CHECK (jsonb_typeof(match_evidence)='array'),
  CHECK ((manual_outcome='accepted_metadata_match' AND selected_attempt_id IS NOT NULL
      AND outcome_source_attempt_id=selected_attempt_id AND coherent_edition IS NOT NULL)
    OR (manual_outcome='local_canonical_match' AND canonical_edition_id IS NOT NULL
      AND selected_attempt_id IS NULL AND outcome_source_attempt_id IS NULL
      AND coherent_edition IS NULL)
    OR manual_outcome IN ('ambiguous','material_conflict','no_match','technical_failure',
      'policy_denied','cost_quota_denied','manual_metadata_required')),
  CHECK (manual_outcome IN ('local_canonical_match','accepted_metadata_match')
    OR (selected_attempt_id IS NULL AND canonical_edition_id IS NULL
      AND coherent_edition IS NULL))
);

ALTER TABLE public.image_extraction_candidates
  ADD COLUMN selected_metadata_snapshot_id uuid
    REFERENCES public.phase9_selected_metadata_snapshots(id);

CREATE FUNCTION marketplace_sec.phase9_reject_selected_metadata_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'P9_METADATA_SNAPSHOT_IMMUTABLE';
END$$;
CREATE TRIGGER phase9_selected_metadata_snapshot_immutable
  BEFORE UPDATE OR DELETE ON public.phase9_selected_metadata_snapshots
  FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_reject_selected_metadata_snapshot_mutation();

ALTER TABLE public.phase9_metadata_lookups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_metadata_cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_selected_metadata_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase9_metadata_lookups,public.phase9_metadata_cache_entries,
  public.phase9_selected_metadata_snapshots FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.phase9_metadata_lookups TO service_role;
GRANT SELECT ON public.phase9_metadata_cache_entries TO service_role;
GRANT SELECT ON public.phase9_selected_metadata_snapshots TO service_role;

CREATE FUNCTION marketplace_sec.claim_phase9_metadata_jobs(p_batch_size integer,p_worker text)
RETURNS TABLE(id uuid,attempt_count integer,lease_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_batch_size NOT BETWEEN 1 AND 10
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  RETURN QUERY WITH claimed AS (
    SELECT j.id FROM public.image_extraction_jobs j
    WHERE j.job_kind='metadata_enrich'
      AND j.status IN ('open','retry_scheduled','in_progress')
      AND j.next_attempt_at<=transaction_timestamp()
      AND (j.status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp())
      AND j.attempt_count<j.max_attempts
    ORDER BY j.next_attempt_at,j.id FOR UPDATE SKIP LOCKED LIMIT p_batch_size
  ), tokens AS (
    SELECT claimed.id,replace(gen_random_uuid()::text,'-','')
      ||replace(gen_random_uuid()::text,'-','') token FROM claimed
  )
  UPDATE public.image_extraction_jobs j SET
    status='in_progress',lease_owner=p_worker,
    lease_expires_at=transaction_timestamp()+interval '5 minutes',
    lease_token_hash=encode(extensions.digest(tokens.token,'sha256'),'hex'),
    attempt_count=j.attempt_count+1,updated_at=transaction_timestamp()
  FROM tokens WHERE j.id=tokens.id
  RETURNING j.id,j.attempt_count,tokens.token;
END$$;

CREATE FUNCTION marketplace_sec.phase9_assert_metadata_claim(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer
) RETURNS public.image_extraction_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR p_worker !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_lease_token !~ '^[0-9a-f]{64}$'
    OR p_attempt_count NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  SELECT * INTO v_job FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.job_kind IS DISTINCT FROM 'metadata_enrich'
    OR v_job.entity_type IS DISTINCT FROM 'candidate'
    OR v_job.status IS DISTINCT FROM 'in_progress'
    OR v_job.lease_owner IS DISTINCT FROM p_worker
    OR v_job.attempt_count IS DISTINCT FROM p_attempt_count
    OR v_job.lease_expires_at IS NULL OR v_job.lease_expires_at<=transaction_timestamp()
    OR v_job.lease_token_hash IS DISTINCT FROM
      encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  RETURN v_job;
END$$;

CREATE FUNCTION marketplace_sec.phase9_register_metadata_lookup(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_query_identity text,p_provider_cache_identity text,p_adapter_key text,
  p_adapter_version text,p_capability_version text,p_schema_version text,
  p_lookup_strategy text,p_lookup_contract_version text,
  p_normalizer_version text,p_routing_policy_version text,p_privacy_scope text,
  p_reuse_policy_version text,p_cache_policy_version text,p_cache_namespace text,
  p_leader_lookup_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_candidate public.image_extraction_candidates;
  v_leader public.phase9_metadata_lookups; v_lookup public.phase9_metadata_lookups;
  v_leader_snapshot public.phase9_selected_metadata_snapshots; v_copy uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR char_length(p_query_identity) NOT BETWEEN 1 AND 2048
    OR char_length(p_provider_cache_identity) NOT BETWEEN 1 AND 3072
    OR p_adapter_key !~ '^[a-z][a-z0-9._-]{1,63}$'
    OR p_lookup_strategy NOT IN ('isbn','bibliographic','approved_strong_evidence')
    OR p_privacy_scope NOT IN ('public_bibliographic','store_private')
    OR coalesce(char_length(p_lookup_contract_version),0) NOT BETWEEN 1 AND 64
    OR coalesce(char_length(p_normalizer_version),0) NOT BETWEEN 1 AND 64
    OR coalesce(char_length(p_routing_policy_version),0) NOT BETWEEN 1 AND 64
    OR coalesce(char_length(p_reuse_policy_version),0) NOT BETWEEN 1 AND 64
    OR coalesce(char_length(p_cache_policy_version),0) NOT BETWEEN 1 AND 64
    OR coalesce(char_length(p_cache_namespace),0) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups
    WHERE job_id=p_job_id AND query_identity=p_query_identity
      AND routing_policy_version=p_routing_policy_version;
  IF FOUND THEN
    IF v_lookup.execution_mode<>'external'
      OR v_lookup.claim_attempt_number<>p_attempt_count OR v_lookup.claim_worker<>p_worker
      OR v_lookup.claim_lease_token_hash<>
        encode(extensions.digest(p_lease_token,'sha256'),'hex')
      OR v_lookup.provider_cache_identity<>p_provider_cache_identity
      OR v_lookup.adapter_key<>p_adapter_key OR v_lookup.adapter_version<>p_adapter_version
      OR v_lookup.capability_version<>p_capability_version
      OR v_lookup.schema_version<>p_schema_version
      OR v_lookup.lookup_strategy<>p_lookup_strategy
      OR v_lookup.lookup_contract_version<>p_lookup_contract_version
      OR v_lookup.normalizer_version<>p_normalizer_version
      OR v_lookup.privacy_scope<>p_privacy_scope
      OR v_lookup.reuse_policy_version<>p_reuse_policy_version
      OR v_lookup.cache_policy_version<>p_cache_policy_version
      OR v_lookup.cache_namespace<>p_cache_namespace
      OR v_lookup.leader_lookup_id IS DISTINCT FROM p_leader_lookup_id THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN jsonb_build_object('lookup_id',v_lookup.id,
      'leader_lookup_id',v_lookup.leader_lookup_id,
      'reuse_source_attempt_id',v_lookup.reuse_source_attempt_id,
      'creates_provider_charge',v_lookup.leader_lookup_id IS NULL);
  END IF;
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  IF NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r
    WHERE r.adapter_key=p_adapter_key AND r.adapter_version=p_adapter_version
      AND r.provider_kind='metadata' AND r.enabled AND r.matching_allowed
      AND r.policy_version::text=p_reuse_policy_version) THEN
    RAISE EXCEPTION 'P9_METADATA_PROVIDER_DISABLED';
  END IF;
  SELECT * INTO v_candidate FROM public.image_extraction_candidates
    WHERE id=v_job.entity_id AND store_id=v_job.store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF p_leader_lookup_id IS NOT NULL THEN
    SELECT * INTO v_leader FROM public.phase9_metadata_lookups WHERE id=p_leader_lookup_id;
    IF NOT FOUND OR v_leader.query_identity<>p_query_identity
      OR v_leader.provider_cache_identity<>p_provider_cache_identity
      OR v_leader.adapter_key<>p_adapter_key
      OR v_leader.adapter_version<>p_adapter_version
      OR v_leader.capability_version<>p_capability_version
      OR v_leader.schema_version<>p_schema_version
      OR v_leader.routing_policy_version<>p_routing_policy_version
      OR v_leader.reuse_policy_version<>p_reuse_policy_version
      OR v_leader.cache_policy_version<>p_cache_policy_version
      OR v_leader.cache_namespace<>p_cache_namespace
      OR v_leader.privacy_scope<>p_privacy_scope OR v_leader.completed_at IS NULL
      OR (p_privacy_scope='store_private' AND v_leader.store_id<>v_job.store_id) THEN
      RAISE EXCEPTION 'P9_METADATA_REUSE_DENIED';
    END IF;
    SELECT * INTO v_leader_snapshot FROM public.phase9_selected_metadata_snapshots
      WHERE lookup_id=v_leader.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'P9_METADATA_REUSE_DENIED'; END IF;
  END IF;
  INSERT INTO public.phase9_metadata_lookups(
    candidate_id,store_id,job_id,query_identity,provider_cache_identity,adapter_key,
    adapter_version,capability_version,schema_version,lookup_strategy,lookup_contract_version,
    normalizer_version,routing_policy_version,privacy_scope,reuse_policy_version,
    cache_policy_version,cache_namespace,claim_attempt_number,claim_worker,
    claim_lease_token_hash,leader_lookup_id,reuse_source_attempt_id,outcome_source_attempt_id)
  VALUES(v_candidate.id,v_job.store_id,v_job.id,p_query_identity,p_provider_cache_identity,
    p_adapter_key,p_adapter_version,p_capability_version,p_schema_version,p_lookup_strategy,
    p_lookup_contract_version,p_normalizer_version,p_routing_policy_version,p_privacy_scope,
    p_reuse_policy_version,p_cache_policy_version,p_cache_namespace,p_attempt_count,p_worker,
    encode(extensions.digest(p_lease_token,'sha256'),'hex'),p_leader_lookup_id,
    CASE WHEN p_leader_lookup_id IS NULL THEN NULL
      ELSE v_leader.reuse_source_attempt_id END,
    CASE WHEN p_leader_lookup_id IS NULL THEN NULL
      ELSE v_leader.outcome_source_attempt_id END)
  ON CONFLICT(job_id,query_identity,routing_policy_version) DO NOTHING
  RETURNING * INTO v_lookup;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  IF p_leader_lookup_id IS NOT NULL THEN
    INSERT INTO public.phase9_selected_metadata_snapshots(
      candidate_id,store_id,lookup_id,selected_attempt_id,outcome_source_attempt_id,
      canonical_edition_id,
      snapshot_version,selection_policy_version,coherent_edition,match_evidence,manual_outcome)
    VALUES(v_candidate.id,v_job.store_id,v_lookup.id,v_leader_snapshot.selected_attempt_id,
      v_leader_snapshot.outcome_source_attempt_id,
      v_leader_snapshot.canonical_edition_id,v_leader_snapshot.snapshot_version,
      v_leader_snapshot.selection_policy_version,v_leader_snapshot.coherent_edition,
      v_leader_snapshot.match_evidence,v_leader_snapshot.manual_outcome)
    RETURNING id INTO v_copy;
    UPDATE public.phase9_metadata_lookups SET
      reuse_source_attempt_id=v_leader_snapshot.selected_attempt_id,
      outcome_source_attempt_id=v_leader.outcome_source_attempt_id,
      normalized_outcome=v_leader.normalized_outcome,
      canonical_edition_id=v_leader.canonical_edition_id,
      completed_at=transaction_timestamp() WHERE id=v_lookup.id;
    UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=v_copy,
      canonical_edition_id=v_leader_snapshot.canonical_edition_id,
      state=CASE WHEN v_leader_snapshot.manual_outcome IN
        ('local_canonical_match','accepted_metadata_match') THEN 'ready' ELSE 'needs_review' END,
      updated_at=transaction_timestamp() WHERE id=v_candidate.id;
    UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,
      lease_expires_at=NULL,lease_token_hash=NULL,completed_at=transaction_timestamp(),
      updated_at=transaction_timestamp() WHERE id=v_job.id;
  END IF;
  RETURN jsonb_build_object('lookup_id',v_lookup.id,'leader_lookup_id',v_lookup.leader_lookup_id,
    'reuse_source_attempt_id',CASE WHEN p_leader_lookup_id IS NULL THEN NULL
      ELSE v_leader_snapshot.selected_attempt_id END,
    'creates_provider_charge',v_lookup.leader_lookup_id IS NULL);
END$$;

CREATE FUNCTION marketplace_sec.phase9_complete_local_metadata_match(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_query_identity text,p_lookup_strategy text,p_lookup_contract_version text,
  p_normalizer_version text,p_routing_policy_version text,p_privacy_scope text,
  p_schema_version text,p_canonical_edition_id uuid,p_snapshot_version text,
  p_selection_policy_version text,p_match_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_candidate public.image_extraction_candidates;
  v_lookup public.phase9_metadata_lookups;
  v_snapshot public.phase9_selected_metadata_snapshots; v_snapshot_id uuid;
BEGIN
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups
    WHERE job_id=p_job_id AND query_identity=p_query_identity
      AND routing_policy_version=p_routing_policy_version;
  IF FOUND THEN
    SELECT * INTO v_snapshot FROM public.phase9_selected_metadata_snapshots
      WHERE lookup_id=v_lookup.id;
    IF v_lookup.execution_mode<>'local'
      OR v_lookup.claim_attempt_number<>p_attempt_count
      OR v_lookup.claim_worker<>p_worker
      OR v_lookup.claim_lease_token_hash<>
        encode(extensions.digest(p_lease_token,'sha256'),'hex')
      OR v_lookup.lookup_strategy<>p_lookup_strategy
      OR v_lookup.lookup_contract_version<>p_lookup_contract_version
      OR v_lookup.normalizer_version<>p_normalizer_version
      OR v_lookup.schema_version<>p_schema_version
      OR v_lookup.privacy_scope<>p_privacy_scope
      OR v_lookup.canonical_edition_id IS DISTINCT FROM p_canonical_edition_id
      OR v_snapshot.snapshot_version<>p_snapshot_version
      OR v_snapshot.selection_policy_version<>p_selection_policy_version
      OR v_snapshot.match_evidence<>p_match_evidence
      OR v_snapshot.manual_outcome<>'local_canonical_match' THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN jsonb_build_object('lookup_id',v_lookup.id,'snapshot_id',v_snapshot.id,
      'manual_outcome','local_canonical_match','creates_provider_charge',false);
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR char_length(p_query_identity) NOT BETWEEN 1 AND 2048
    OR p_lookup_strategy NOT IN ('isbn','bibliographic','approved_strong_evidence')
    OR p_privacy_scope NOT IN ('public_bibliographic','store_private')
    OR coalesce(char_length(p_lookup_contract_version),0) NOT BETWEEN 1 AND 64
    OR coalesce(char_length(p_normalizer_version),0) NOT BETWEEN 1 AND 64
    OR coalesce(char_length(p_routing_policy_version),0) NOT BETWEEN 1 AND 64
    OR coalesce(char_length(p_schema_version),0) NOT BETWEEN 1 AND 64
    OR coalesce(char_length(p_snapshot_version),0) NOT BETWEEN 1 AND 64
    OR coalesce(char_length(p_selection_policy_version),0) NOT BETWEEN 1 AND 64
    OR jsonb_typeof(p_match_evidence) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  IF jsonb_array_length(p_match_evidence) NOT BETWEEN 1 AND 8
    OR octet_length(p_match_evidence::text)>8192 OR EXISTS(
      SELECT 1 FROM jsonb_array_elements_text(p_match_evidence) e(value)
      WHERE e.value NOT IN ('validated_isbn','exact_original_title_author_language',
        'approved_strong_canonical_evidence')
    ) THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates
    WHERE id=v_job.entity_id AND store_id=v_job.store_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(
      SELECT 1 FROM public.canonical_editions e WHERE e.id=p_canonical_edition_id)
    OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations r
      WHERE r.job_id=v_job.id AND r.cost_kind='metadata')
    OR EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts a
      WHERE a.candidate_id=v_candidate.id) THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  INSERT INTO public.phase9_metadata_lookups(
    candidate_id,store_id,job_id,query_identity,execution_mode,schema_version,
    lookup_strategy,lookup_contract_version,normalizer_version,
    routing_policy_version,privacy_scope,claim_attempt_number,claim_worker,
    claim_lease_token_hash,normalized_outcome,canonical_edition_id,completed_at)
  VALUES(v_candidate.id,v_job.store_id,v_job.id,p_query_identity,'local',p_schema_version,
    p_lookup_strategy,p_lookup_contract_version,p_normalizer_version,
    p_routing_policy_version,p_privacy_scope,p_attempt_count,p_worker,
    encode(extensions.digest(p_lease_token,'sha256'),'hex'),'local_canonical_match',
    p_canonical_edition_id,transaction_timestamp())
  RETURNING * INTO v_lookup;
  INSERT INTO public.phase9_selected_metadata_snapshots(
    candidate_id,store_id,lookup_id,selected_attempt_id,outcome_source_attempt_id,
    canonical_edition_id,snapshot_version,selection_policy_version,coherent_edition,
    match_evidence,manual_outcome)
  VALUES(v_candidate.id,v_job.store_id,v_lookup.id,NULL,NULL,p_canonical_edition_id,
    p_snapshot_version,p_selection_policy_version,NULL,p_match_evidence,
    'local_canonical_match')
  RETURNING id INTO v_snapshot_id;
  UPDATE public.image_extraction_candidates SET
    selected_metadata_snapshot_id=v_snapshot_id,
    canonical_edition_id=p_canonical_edition_id,state='ready',
    updated_at=transaction_timestamp() WHERE id=v_candidate.id;
  UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,
    lease_expires_at=NULL,lease_token_hash=NULL,completed_at=transaction_timestamp(),
    updated_at=transaction_timestamp() WHERE id=v_job.id;
  RETURN jsonb_build_object('lookup_id',v_lookup.id,'snapshot_id',v_snapshot_id,
    'manual_outcome','local_canonical_match','creates_provider_charge',false);
END$$;

CREATE FUNCTION marketplace_sec.phase9_register_metadata_attempt(
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
        'rate_limited','provider_unavailable','circuit_breaker_open') THEN
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

CREATE FUNCTION marketplace_sec.phase9_finalize_metadata_attempt(
  p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_disposition text,p_normalized_outcome text,p_provider_request_id text,
  p_cache_status text,p_latency_ms integer,p_pricing_policy_version text,
  p_pricing_evidence jsonb,p_calculated_cost_units numeric,p_normalized_candidate jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_attempt public.metadata_enrichment_attempts;
BEGIN
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  IF p_disposition IS NULL OR p_normalized_outcome IS NULL OR p_cache_status IS NULL
    OR p_latency_ms IS NULL OR p_pricing_policy_version IS NULL
    OR p_pricing_evidence IS NULL OR p_calculated_cost_units IS NULL
    OR p_disposition NOT IN ('accepted','rejected','stale','failed')
    OR p_normalized_outcome !~ '^[a-z][a-z0-9_]{0,63}$'
    OR p_cache_status NOT IN ('miss','positive_hit','negative_hit','ambiguous_hit')
    OR p_latency_ms NOT BETWEEN 0 AND 3600000
    OR p_calculated_cost_units NOT BETWEEN 0 AND 1000000000
    OR NOT marketplace_sec.phase9_valid_metadata_pricing_evidence(p_pricing_evidence)
    OR (p_disposition='accepted'
      AND jsonb_typeof(p_normalized_candidate) IS DISTINCT FROM 'object')
    OR (p_disposition<>'accepted' AND p_normalized_candidate IS NOT NULL)
    OR (p_normalized_candidate IS NOT NULL
      AND octet_length(p_normalized_candidate::text)>65536) THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  SELECT a.* INTO v_attempt FROM public.metadata_enrichment_attempts a
    JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id
    WHERE a.id=p_attempt_id AND l.job_id=v_job.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF p_normalized_candidate IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.phase9_provider_registry r
    JOIN public.phase9_metadata_lookups l ON l.id=v_attempt.lookup_id
    WHERE r.adapter_key=v_attempt.adapter_key
      AND r.adapter_version=v_attempt.adapter_version
      AND r.provider_kind='metadata' AND r.enabled AND r.storage_allowed
      AND r.policy_version::text=l.reuse_policy_version
  ) THEN
    RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED';
  END IF;
  IF v_attempt.disposition<>'unresolved' THEN
    IF v_attempt.disposition=p_disposition AND v_attempt.normalized_outcome=p_normalized_outcome
      AND v_attempt.provider_request_id IS NOT DISTINCT FROM p_provider_request_id
      AND v_attempt.cache_status=p_cache_status AND v_attempt.latency_ms=p_latency_ms
      AND v_attempt.pricing_policy_version=p_pricing_policy_version
      AND v_attempt.pricing_evidence=p_pricing_evidence
      AND v_attempt.calculated_cost_units=p_calculated_cost_units
      AND v_attempt.normalized_payload IS NOT DISTINCT FROM p_normalized_candidate THEN
      RETURN jsonb_build_object('attempt_id',v_attempt.id,'disposition',v_attempt.disposition);
    END IF;
    RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
  END IF;
  UPDATE public.metadata_enrichment_attempts SET
    disposition=p_disposition,normalized_outcome=p_normalized_outcome,
    provider_request_id=p_provider_request_id,cache_status=p_cache_status,
    latency_ms=p_latency_ms,pricing_policy_version=p_pricing_policy_version,
    pricing_evidence=p_pricing_evidence,calculated_cost_units=p_calculated_cost_units,
    normalized_payload=p_normalized_candidate,status='completed',
    completed_at=transaction_timestamp()
  WHERE id=p_attempt_id;
  UPDATE public.phase9_usage_reservations SET status='consumed',
    actual_cost_units=coalesce(actual_cost_units,0)+p_calculated_cost_units,
    updated_at=transaction_timestamp()
  WHERE id=v_attempt.usage_reservation_id AND status IN ('reserved','consumed');
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  RETURN jsonb_build_object('attempt_id',p_attempt_id,'disposition',p_disposition);
END$$;

CREATE FUNCTION marketplace_sec.phase9_select_metadata_snapshot(
  p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_selected_attempt_id uuid,p_outcome_source_attempt_id uuid,
  p_snapshot_version text,p_selection_policy_version text,
  p_coherent_edition jsonb,p_match_evidence jsonb,p_manual_outcome text,
  p_canonical_edition_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_lookup public.phase9_metadata_lookups;
  v_attempt public.metadata_enrichment_attempts;
  v_existing public.phase9_selected_metadata_snapshots; v_snapshot uuid;
BEGIN
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups
    WHERE id=p_lookup_id AND job_id=p_job_id;
  SELECT * INTO v_existing FROM public.phase9_selected_metadata_snapshots
    WHERE lookup_id=p_lookup_id;
  IF FOUND THEN
    IF v_lookup.claim_attempt_number<>p_attempt_count OR v_lookup.claim_worker<>p_worker
      OR v_lookup.claim_lease_token_hash<>
        encode(extensions.digest(p_lease_token,'sha256'),'hex')
      OR v_existing.selected_attempt_id IS DISTINCT FROM p_selected_attempt_id
      OR v_existing.outcome_source_attempt_id IS DISTINCT FROM p_outcome_source_attempt_id
      OR v_existing.snapshot_version<>p_snapshot_version
      OR v_existing.selection_policy_version<>p_selection_policy_version
      OR v_existing.coherent_edition IS DISTINCT FROM p_coherent_edition
      OR v_existing.match_evidence<>p_match_evidence
      OR v_existing.manual_outcome<>p_manual_outcome
      OR v_existing.canonical_edition_id IS DISTINCT FROM p_canonical_edition_id THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN jsonb_build_object('snapshot_id',v_existing.id,
      'manual_outcome',v_existing.manual_outcome);
  END IF;
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups
    WHERE id=p_lookup_id AND job_id=v_job.id AND store_id=v_job.store_id FOR UPDATE;
  IF NOT FOUND OR char_length(p_snapshot_version) NOT BETWEEN 1 AND 64
    OR char_length(p_selection_policy_version) NOT BETWEEN 1 AND 64
    OR octet_length(p_match_evidence::text)>8192
    OR p_manual_outcome NOT IN (
    'local_canonical_match','accepted_metadata_match','ambiguous','material_conflict',
    'no_match','technical_failure','policy_denied','cost_quota_denied',
    'manual_metadata_required') OR jsonb_typeof(p_match_evidence)<>'array' THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  IF p_manual_outcome='accepted_metadata_match'
    AND (p_selected_attempt_id IS NULL
      OR p_outcome_source_attempt_id IS DISTINCT FROM p_selected_attempt_id
      OR jsonb_typeof(p_coherent_edition)<>'object') THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  ELSIF p_manual_outcome='local_canonical_match'
    AND (p_selected_attempt_id IS NOT NULL OR p_outcome_source_attempt_id IS NOT NULL
      OR p_canonical_edition_id IS NULL
      OR p_coherent_edition IS NOT NULL) THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  ELSIF p_manual_outcome NOT IN ('accepted_metadata_match','local_canonical_match')
    AND (p_selected_attempt_id IS NOT NULL OR p_coherent_edition IS NOT NULL
      OR p_canonical_edition_id IS NOT NULL) THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  IF p_selected_attempt_id IS NOT NULL THEN
    SELECT * INTO v_attempt FROM public.metadata_enrichment_attempts
      WHERE id=p_selected_attempt_id AND lookup_id=v_lookup.id
        AND disposition='accepted';
    IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
    IF p_coherent_edition IS DISTINCT FROM v_attempt.normalized_payload THEN
      RAISE EXCEPTION 'P9_METADATA_COHERENCE_CONFLICT';
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM public.phase9_provider_registry r
      WHERE r.adapter_key=v_attempt.adapter_key
        AND r.adapter_version=v_attempt.adapter_version
        AND r.provider_kind='metadata' AND r.enabled AND r.storage_allowed
        AND r.policy_version::text=v_lookup.reuse_policy_version
    ) THEN
      RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED';
    END IF;
  END IF;
  IF p_outcome_source_attempt_id IS NOT NULL THEN
    SELECT * INTO v_attempt FROM public.metadata_enrichment_attempts
      WHERE id=p_outcome_source_attempt_id AND lookup_id=v_lookup.id
        AND disposition<>'unresolved';
    IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  END IF;
  INSERT INTO public.phase9_selected_metadata_snapshots(
    candidate_id,store_id,lookup_id,selected_attempt_id,outcome_source_attempt_id,
    canonical_edition_id,
    snapshot_version,selection_policy_version,coherent_edition,match_evidence,manual_outcome)
  VALUES(v_lookup.candidate_id,v_lookup.store_id,v_lookup.id,p_selected_attempt_id,
    p_outcome_source_attempt_id,p_canonical_edition_id,p_snapshot_version,p_selection_policy_version,
    p_coherent_edition,p_match_evidence,p_manual_outcome)
  RETURNING id INTO v_snapshot;
  UPDATE public.image_extraction_candidates SET
    selected_metadata_snapshot_id=v_snapshot,
    metadata_attempt_id=p_selected_attempt_id,
    canonical_edition_id=p_canonical_edition_id,
    state=CASE WHEN p_manual_outcome IN ('local_canonical_match','accepted_metadata_match')
      THEN 'ready' ELSE 'needs_review' END,
    updated_at=transaction_timestamp()
  WHERE id=v_lookup.candidate_id AND selected_metadata_snapshot_id IS NULL;
  UPDATE public.phase9_metadata_lookups SET normalized_outcome=p_manual_outcome,
    canonical_edition_id=p_canonical_edition_id,
    reuse_source_attempt_id=p_selected_attempt_id,
    outcome_source_attempt_id=p_outcome_source_attempt_id,
    completed_at=transaction_timestamp()
  WHERE id=v_lookup.id AND completed_at IS NULL;
  UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,
    lease_expires_at=NULL,lease_token_hash=NULL,completed_at=transaction_timestamp(),
    updated_at=transaction_timestamp() WHERE id=v_job.id;
  RETURN jsonb_build_object('snapshot_id',v_snapshot,'manual_outcome',p_manual_outcome);
END$$;

CREATE FUNCTION marketplace_sec.phase9_store_metadata_cache(
  p_lookup_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_outcome text,p_normalized_snapshot jsonb,p_provider_record_id text,
  p_source_fetched_at timestamptz,p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_lookup public.phase9_metadata_lookups; v_attempt public.metadata_enrichment_attempts;
  v_cache public.phase9_metadata_cache_entries;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_outcome IS NULL
    OR p_outcome NOT IN ('positive','negative','ambiguous')
    OR p_expires_at IS NULL OR p_expires_at<=transaction_timestamp()
    OR (p_outcome='positive' AND jsonb_typeof(p_normalized_snapshot)<>'object')
    OR (p_outcome<>'positive' AND p_normalized_snapshot IS NOT NULL) THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups WHERE id=p_lookup_id;
  IF NOT FOUND OR v_lookup.completed_at IS NULL
    OR v_lookup.claim_attempt_number<>p_attempt_count OR v_lookup.claim_worker<>p_worker
    OR v_lookup.claim_lease_token_hash<>
      encode(extensions.digest(p_lease_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  IF v_lookup.outcome_source_attempt_id IS NOT NULL THEN
    SELECT * INTO v_attempt FROM public.metadata_enrichment_attempts
      WHERE id=v_lookup.outcome_source_attempt_id;
  END IF;
  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'P9_METADATA_CACHE_PROVENANCE_REQUIRED';
  END IF;
  IF p_outcome='positive' AND (v_attempt.id IS NULL
    OR v_attempt.disposition<>'accepted'
    OR v_attempt.normalized_payload IS DISTINCT FROM p_normalized_snapshot) THEN
    RAISE EXCEPTION 'P9_METADATA_COHERENCE_CONFLICT';
  END IF;
  IF (p_outcome='positive' AND v_lookup.normalized_outcome<>'accepted_metadata_match')
    OR (p_outcome='negative' AND v_lookup.normalized_outcome<>'no_match')
    OR (p_outcome='ambiguous'
      AND v_lookup.normalized_outcome NOT IN ('ambiguous','material_conflict')) THEN
    RAISE EXCEPTION 'P9_METADATA_COHERENCE_CONFLICT';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.phase9_provider_registry r
    WHERE r.adapter_key=v_attempt.adapter_key
      AND r.adapter_version=v_attempt.adapter_version
      AND r.provider_kind='metadata' AND r.enabled
      AND r.policy_version::text=v_lookup.reuse_policy_version
      AND (p_outcome<>'positive' OR r.storage_allowed)
  ) THEN
    RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED';
  END IF;
  INSERT INTO public.phase9_metadata_cache_entries(
    provider_cache_identity,query_identity,adapter_key,adapter_version,
    capability_version,normalizer_version,schema_version,cache_policy_version,
    reuse_policy_version,privacy_scope,store_id,outcome,normalized_snapshot,
    source_attempt_id,provider_record_id,source_fetched_at,expires_at)
  VALUES(coalesce(v_attempt.provider_cache_identity,v_lookup.provider_cache_identity),
    v_lookup.query_identity,coalesce(v_attempt.adapter_key,v_lookup.adapter_key),
    coalesce(v_attempt.adapter_version,v_lookup.adapter_version),
    coalesce(v_attempt.capability_version,v_lookup.capability_version),
    coalesce(v_attempt.normalizer_version,v_lookup.normalizer_version),
    coalesce(v_attempt.schema_version,v_lookup.schema_version),
    v_lookup.cache_policy_version,v_lookup.reuse_policy_version,
    v_lookup.privacy_scope,CASE WHEN v_lookup.privacy_scope='store_private'
      THEN v_lookup.store_id ELSE NULL END,p_outcome,p_normalized_snapshot,
    v_lookup.outcome_source_attempt_id,p_provider_record_id,p_source_fetched_at,p_expires_at)
  ON CONFLICT(provider_cache_identity) DO NOTHING RETURNING * INTO v_cache;
  IF NOT FOUND THEN
    SELECT * INTO v_cache FROM public.phase9_metadata_cache_entries
      WHERE provider_cache_identity=
        coalesce(v_attempt.provider_cache_identity,v_lookup.provider_cache_identity);
    IF v_cache.query_identity<>v_lookup.query_identity OR v_cache.outcome<>p_outcome
      OR v_cache.normalized_snapshot IS DISTINCT FROM p_normalized_snapshot
      OR v_cache.source_attempt_id IS DISTINCT FROM v_lookup.outcome_source_attempt_id
      OR v_cache.provider_record_id IS DISTINCT FROM p_provider_record_id
      OR v_cache.source_fetched_at IS DISTINCT FROM p_source_fetched_at
      OR v_cache.expires_at<>p_expires_at THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
    END IF;
  END IF;
  RETURN jsonb_build_object('cache_id',v_cache.id,'outcome',v_cache.outcome);
END$$;

CREATE FUNCTION marketplace_sec.phase9_invalidate_metadata_cache(
  p_provider_cache_identity text,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cache public.phase9_metadata_cache_entries;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR char_length(p_provider_cache_identity) NOT BETWEEN 1 AND 3072
    OR char_length(p_reason) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  SELECT * INTO v_cache FROM public.phase9_metadata_cache_entries
    WHERE provider_cache_identity=p_provider_cache_identity FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  IF v_cache.invalidated_at IS NOT NULL AND v_cache.invalidation_reason<>p_reason THEN
    RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH';
  END IF;
  UPDATE public.phase9_metadata_cache_entries SET
    invalidated_at=coalesce(invalidated_at,transaction_timestamp()),
    invalidation_reason=coalesce(invalidation_reason,p_reason)
  WHERE id=v_cache.id;
  RETURN jsonb_build_object('cache_id',v_cache.id,'status','invalidated');
END$$;

CREATE FUNCTION public.claim_phase9_metadata_jobs(p_batch_size integer,p_worker text)
RETURNS TABLE(id uuid,attempt_count integer,lease_token text)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT * FROM marketplace_sec.claim_phase9_metadata_jobs(p_batch_size,p_worker)
$$;
CREATE FUNCTION public.phase9_complete_local_metadata_match(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_query_identity text,p_lookup_strategy text,p_lookup_contract_version text,
  p_normalizer_version text,p_routing_policy_version text,p_privacy_scope text,
  p_schema_version text,p_canonical_edition_id uuid,p_snapshot_version text,
  p_selection_policy_version text,p_match_evidence jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_complete_local_metadata_match(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_query_identity,p_lookup_strategy,
    p_lookup_contract_version,p_normalizer_version,p_routing_policy_version,
    p_privacy_scope,p_schema_version,p_canonical_edition_id,p_snapshot_version,
    p_selection_policy_version,p_match_evidence)
$$;
CREATE FUNCTION public.phase9_register_metadata_lookup(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_query_identity text,p_provider_cache_identity text,p_adapter_key text,
  p_adapter_version text,p_capability_version text,p_schema_version text,
  p_lookup_strategy text,p_lookup_contract_version text,
  p_normalizer_version text,p_routing_policy_version text,p_privacy_scope text,
  p_reuse_policy_version text,p_cache_policy_version text,p_cache_namespace text,
  p_leader_lookup_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_register_metadata_lookup(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_query_identity,
    p_provider_cache_identity,p_adapter_key,p_adapter_version,p_capability_version,
    p_schema_version,p_lookup_strategy,p_lookup_contract_version,p_normalizer_version,
    p_routing_policy_version,p_privacy_scope,
    p_reuse_policy_version,p_cache_policy_version,p_cache_namespace,p_leader_lookup_id)
$$;
CREATE FUNCTION public.phase9_register_metadata_attempt(
  p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_provider_attempt_identity uuid,p_provider_cache_identity text,
  p_provider_role text,p_attempt_sequence integer,
  p_adapter_key text,p_adapter_version text,p_capability_version text,
  p_schema_version text,p_normalizer_version text,p_routing_policy_version text,
  p_predecessor_outcome text,p_usage_reservation_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_register_metadata_attempt(
    p_lookup_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_provider_attempt_identity,
    p_provider_cache_identity,p_provider_role,p_attempt_sequence,p_adapter_key,
    p_adapter_version,p_capability_version,p_schema_version,p_normalizer_version,
    p_routing_policy_version,p_predecessor_outcome,p_usage_reservation_id)
$$;
CREATE FUNCTION public.phase9_finalize_metadata_attempt(
  p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_disposition text,p_normalized_outcome text,p_provider_request_id text,
  p_cache_status text,p_latency_ms integer,p_pricing_policy_version text,
  p_pricing_evidence jsonb,p_calculated_cost_units numeric,p_normalized_candidate jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_finalize_metadata_attempt(
    p_attempt_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_disposition,
    p_normalized_outcome,p_provider_request_id,p_cache_status,p_latency_ms,
    p_pricing_policy_version,p_pricing_evidence,p_calculated_cost_units,
    p_normalized_candidate)
$$;
CREATE FUNCTION public.phase9_select_metadata_snapshot(
  p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_selected_attempt_id uuid,p_outcome_source_attempt_id uuid,
  p_snapshot_version text,p_selection_policy_version text,
  p_coherent_edition jsonb,p_match_evidence jsonb,p_manual_outcome text,
  p_canonical_edition_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_select_metadata_snapshot(
    p_lookup_id,p_job_id,p_worker,p_lease_token,p_attempt_count,p_selected_attempt_id,
    p_outcome_source_attempt_id,p_snapshot_version,p_selection_policy_version,
    p_coherent_edition,p_match_evidence,p_manual_outcome,p_canonical_edition_id)
$$;
CREATE FUNCTION public.phase9_store_metadata_cache(
  p_lookup_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_outcome text,p_normalized_snapshot jsonb,p_provider_record_id text,
  p_source_fetched_at timestamptz,p_expires_at timestamptz
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_store_metadata_cache(
    p_lookup_id,p_worker,p_lease_token,p_attempt_count,p_outcome,
    p_normalized_snapshot,p_provider_record_id,p_source_fetched_at,p_expires_at)
$$;
CREATE FUNCTION public.phase9_invalidate_metadata_cache(
  p_provider_cache_identity text,p_reason text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_invalidate_metadata_cache(
    p_provider_cache_identity,p_reason)
$$;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_reject_selected_metadata_snapshot_mutation()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_valid_metadata_pricing_evidence(jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.claim_phase9_metadata_jobs(integer,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_local_metadata_match(
  uuid,text,text,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_assert_metadata_claim(uuid,text,text,integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_metadata_lookup(
  uuid,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_finalize_metadata_attempt(
  uuid,uuid,text,text,integer,text,text,text,text,integer,text,jsonb,numeric,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_select_metadata_snapshot(
  uuid,uuid,text,text,integer,uuid,uuid,text,text,jsonb,jsonb,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_store_metadata_cache(
  uuid,text,text,integer,text,jsonb,text,timestamptz,timestamptz)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_invalidate_metadata_cache(text,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_phase9_metadata_jobs(integer,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_complete_local_metadata_match(
  uuid,text,text,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_register_metadata_lookup(
  uuid,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_register_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_finalize_metadata_attempt(
  uuid,uuid,text,text,integer,text,text,text,text,integer,text,jsonb,numeric,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_select_metadata_snapshot(
  uuid,uuid,text,text,integer,uuid,uuid,text,text,jsonb,jsonb,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_store_metadata_cache(
  uuid,text,text,integer,text,jsonb,text,timestamptz,timestamptz)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.phase9_invalidate_metadata_cache(text,text)
  FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION marketplace_sec.claim_phase9_metadata_jobs(integer,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_local_metadata_match(
  uuid,text,text,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_assert_metadata_claim(uuid,text,text,integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_metadata_lookup(
  uuid,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_finalize_metadata_attempt(
  uuid,uuid,text,text,integer,text,text,text,text,integer,text,jsonb,numeric,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_select_metadata_snapshot(
  uuid,uuid,text,text,integer,uuid,uuid,text,text,jsonb,jsonb,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_store_metadata_cache(
  uuid,text,text,integer,text,jsonb,text,timestamptz,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_invalidate_metadata_cache(text,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_phase9_metadata_jobs(integer,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_complete_local_metadata_match(
  uuid,text,text,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_register_metadata_lookup(
  uuid,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_register_metadata_attempt(
  uuid,uuid,text,text,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_finalize_metadata_attempt(
  uuid,uuid,text,text,integer,text,text,text,text,integer,text,jsonb,numeric,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_select_metadata_snapshot(
  uuid,uuid,text,text,integer,uuid,uuid,text,text,jsonb,jsonb,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_store_metadata_cache(
  uuid,text,text,integer,text,jsonb,text,timestamptz,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase9_invalidate_metadata_cache(text,text)
  TO service_role;

COMMIT;
