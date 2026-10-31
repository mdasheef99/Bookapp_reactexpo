-- Owner-authorized 8a-3 file only, 2026-10-31; NOT APPLIED.
-- Authority: 02c §§4.1–4.4/8/9 AC8-5/10/11; 02c-1 §2.
-- M89/M90 and legacy stored bytes remain unchanged. No queue/retry/author cache.
BEGIN;

-- 02c §4.4 / 02c-1 §2: one operator-owned admission barrier, initially open.
CREATE TABLE marketplace_sec.phase9_external_admission_gate (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 mode text NOT NULL DEFAULT 'open' CHECK (mode IN ('open','paused','smoke')),
 epoch bigint NOT NULL DEFAULT 0 CHECK (epoch>=0),
 smoke_job_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
 expires_at timestamptz,
 CONSTRAINT phase9_external_admission_smoke_shape CHECK (
  pg_catalog.cardinality(smoke_job_ids)<=20
  AND pg_catalog.array_position(smoke_job_ids,NULL::uuid) IS NULL
  AND ((mode='smoke' AND pg_catalog.cardinality(smoke_job_ids)>0
    AND expires_at IS NOT NULL AND pg_catalog.isfinite(expires_at))
   OR (mode IN ('open','paused') AND pg_catalog.cardinality(smoke_job_ids)=0 AND expires_at IS NULL)))
);
ALTER TABLE marketplace_sec.phase9_external_admission_gate OWNER TO postgres;
ALTER TABLE marketplace_sec.phase9_external_admission_gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE marketplace_sec.phase9_external_admission_gate FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO marketplace_sec.phase9_external_admission_gate(singleton) VALUES(true);

-- Legacy calls keep NULL epochs. No backfill, relabelling or new caller input.
ALTER TABLE public.phase9_metadata_provider_calls ADD COLUMN grant_epoch bigint;

-- 02c §§4.2/4.4: the CHECK proves shape only. Locked lineage proves protocol.
-- Retain both per-claim sequence/stage indexes and the five-claim CHECK verbatim.
ALTER TABLE public.phase9_metadata_provider_calls DROP CONSTRAINT phase9_edition_http_stage;
ALTER TABLE public.phase9_metadata_provider_calls ADD CONSTRAINT phase9_edition_http_stage CHECK (
 (edition_call_sequence IS NULL AND edition_call_stage IS NULL) OR
 (edition_call_sequence IS NOT NULL AND edition_call_stage IS NOT NULL
  AND edition_call_sequence BETWEEN 0 AND 5
  AND edition_call_stage ~ '^[A-Za-z][A-Za-z0-9._:-]*$'));

-- 02c-1 §2: pause UPDATE conflicts with this SHARE lock until grant commit.
-- Smoke is a bounded operator cohort, never a service-supplied epoch/budget.
CREATE FUNCTION marketplace_sec.phase9_external_grant_epoch_v1(p_job_id uuid)
RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE g marketplace_sec.phase9_external_admission_gate;
BEGIN
 SELECT * INTO g FROM marketplace_sec.phase9_external_admission_gate WHERE singleton FOR SHARE;
 IF g.singleton IS DISTINCT FROM true OR g.mode='paused'
  OR (g.mode='smoke' AND (NOT coalesce(p_job_id=ANY(g.smoke_job_ids),false)
   OR g.expires_at<=pg_catalog.clock_timestamp()))
 THEN RAISE EXCEPTION 'P9_EXTERNAL_ADMISSION_PAUSED'; END IF;
 RETURN g.epoch;
END$$;

-- 02c §§4.1/4.2: compiled protocol boundary. No direct-ISBN stage activation.
CREATE FUNCTION marketplace_sec.phase9_provider_stage_valid_v1(
 p_key text,p_version text,p_sequence integer,p_stage text,p_query_kind text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(CASE marketplace_sec.phase9_provider_validation_contract_v1(p_key,p_version)->>'validationContract'
  WHEN 'google-books-v1' THEN p_sequence IS NULL AND p_stage IS NULL
  WHEN 'open-library-v1' THEN
   (p_sequence=0 AND p_stage='search') OR
   (p_sequence=1 AND (p_stage='editions' OR (p_stage='edition' AND p_query_kind='isbn'))) OR
   (p_sequence BETWEEN 2 AND 5 AND p_stage ~ '^author:OL[1-9][0-9]*A$')
  WHEN 'open-library-v2' THEN
   (p_sequence=0 AND p_stage='search') OR
   (p_sequence=1 AND (p_stage='editions' OR (p_stage='edition' AND p_query_kind='isbn'))) OR
   (p_sequence BETWEEN 2 AND 5 AND p_stage ~ '^author:OL[1-9][0-9]*A$')
  ELSE false END,false)
$$;

-- 02c §4.2: author-content failure isolation is provider-owned, not retry policy.
CREATE FUNCTION marketplace_sec.phase9_provider_stage_continues_v1(
 p_key text,p_version text,p_sequence integer,p_stage text,p_outcome text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(p_outcome='no_acceptable_match' OR
  (marketplace_sec.phase9_provider_validation_contract_v1(p_key,p_version)->>'validationContract'
    IN ('open-library-v1','open-library-v2')
   AND p_sequence BETWEEN 2 AND 5 AND p_stage ~ '^author:OL[1-9][0-9]*A$'
   AND p_outcome IN ('malformed_response','unsupported_content_type','response_too_large')),false)
$$;

-- 02c §4.1/R06: v1 legacy policy semantics survive until 8b is deployed.
-- Keep compatibility pairing at this boundary, never in generic registration.
CREATE FUNCTION marketplace_sec.phase9_provider_legacy_route_v1(
 p_key text,p_version text,p_explicit boolean,p_role text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(p_version='1.0.0' AND
  ((p_key='google_books' AND p_role='primary') OR
   (p_key='open_library' AND p_role IN ('primary','secondary'))),false)
$$;

-- 02c §§3.2/4.1/4.2 and 02c-1 §2: sorted locks pin a whole route snapshot.
CREATE FUNCTION marketplace_sec.phase9_metadata_route_valid_v1(
 p_key text,p_version text,p_explicit boolean,p_role text,
 p_capability text,p_schema text,p_normalizer text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.phase9_provider_registry; installed jsonb;
BEGIN
 PERFORM 1 FROM public.phase9_provider_registry WHERE provider_kind='metadata' ORDER BY adapter_key FOR SHARE;
 SELECT * INTO r FROM public.phase9_provider_registry WHERE adapter_key=p_key AND provider_kind='metadata';
 -- Legacy v1 RPCs historically did not enforce the compiled capability tuple
 -- or the NEW purpose flags. Preserve those semantics (02c §4.1); 8b uses
 -- the versioned configuration contract for route/tuple selection.
 IF marketplace_sec.phase9_provider_legacy_route_v1(p_key,p_version,p_explicit,p_role) THEN
  RETURN coalesce(r.enabled AND r.matching_allowed AND r.adapter_version=p_version,false);
 END IF;
 installed:=marketplace_sec.phase9_provider_validation_contract_v1(p_key,p_version);
 RETURN coalesce(r.enabled AND r.matching_allowed AND r.adapter_version=p_version
  AND p_role IN ('primary','secondary') AND p_explicit IS NOT NULL
  AND installed IS NOT NULL AND p_version=ANY(r.accepted_adapter_versions)
  AND r.version_contracts->p_version=installed
  AND installed->>'capabilityVersion'=p_capability
  AND installed->>'lookupSchemaVersion'=p_schema
  AND installed->>'normalizerVersion'=p_normalizer
  AND (CASE WHEN p_explicit THEN r.explicit_search_allowed AND r.explicit_role=p_role
      AND r.explicit_order=CASE p_role WHEN 'primary' THEN 1 ELSE 2 END
    ELSE r.automatic_lookup_allowed AND r.automatic_role=p_role
      AND r.automatic_order=CASE p_role WHEN 'primary' THEN 1 ELSE 2 END END),false);
END$$;

-- 02c §4.2: structural candidate/query fences precede the legacy lookup delegate.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_structural_metadata_lookup(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_candidate_version integer,p_query_identity text,p_provider_cache_identity text,
 p_adapter_key text,p_adapter_version text,p_capability_version text,p_schema_version text,p_lookup_strategy text,
 p_lookup_contract_version text,p_normalizer_version text,p_routing_policy_version text,p_privacy_scope text,
 p_reuse_policy_version text,p_cache_policy_version text,p_cache_namespace text,p_leader_lookup_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; explicit boolean;
BEGIN
 c:=marketplace_sec.phase9_assert_structural_metadata_candidate(
  p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
 SELECT operation_version='p9-owner-edition-options-v1' INTO explicit FROM public.image_extraction_jobs WHERE id=p_job_id;
 IF p_query_identity IS DISTINCT FROM (CASE WHEN explicit THEN marketplace_sec.phase9_edition_query_identity(c)
   ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END)
  OR (explicit AND (p_leader_lookup_id IS NOT NULL OR p_privacy_scope IS DISTINCT FROM 'store_private'))
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF NOT marketplace_sec.phase9_metadata_route_valid_v1(p_adapter_key,p_adapter_version,explicit,'primary',
  p_capability_version,p_schema_version,p_normalizer_version)
 THEN RAISE EXCEPTION 'P9_METADATA_PROVIDER_DISABLED'; END IF;
 RETURN marketplace_sec.phase9_register_metadata_lookup(p_job_id,p_worker,p_lease_token,p_attempt_count,p_query_identity,
  p_provider_cache_identity,p_adapter_key,p_adapter_version,p_capability_version,p_schema_version,p_lookup_strategy,
  p_lookup_contract_version,p_normalizer_version,p_routing_policy_version,p_privacy_scope,p_reuse_policy_version,
  p_cache_policy_version,p_cache_namespace,p_leader_lookup_id);
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_structural_metadata_attempt(
 p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_candidate_version integer,p_provider_attempt_identity uuid,p_provider_cache_identity text,
 p_provider_role text,p_attempt_sequence integer,p_adapter_key text,p_adapter_version text,p_capability_version text,
 p_schema_version text,p_normalizer_version text,p_routing_policy_version text,p_predecessor_outcome text,p_usage_reservation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; explicit boolean;
BEGIN
 c:=marketplace_sec.phase9_assert_structural_metadata_candidate(
  p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
 SELECT operation_version='p9-owner-edition-options-v1' INTO explicit FROM public.image_extraction_jobs WHERE id=p_job_id;
 IF NOT EXISTS(SELECT 1 FROM public.phase9_metadata_lookups l WHERE l.id=p_lookup_id AND l.job_id=p_job_id
  AND l.candidate_id=c.id AND l.store_id=c.store_id AND l.query_identity=CASE WHEN explicit
   THEN marketplace_sec.phase9_edition_query_identity(c) ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END)
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN marketplace_sec.phase9_register_metadata_attempt(p_lookup_id,p_job_id,p_worker,p_lease_token,p_attempt_count,
  p_provider_attempt_identity,p_provider_cache_identity,p_provider_role,p_attempt_sequence,p_adapter_key,p_adapter_version,
  p_capability_version,p_schema_version,p_normalizer_version,p_routing_policy_version,p_predecessor_outcome,p_usage_reservation_id);
END$$;

-- 02c §§4.2/4.4 AC8-10: terminal claim rejection happens BEFORE candidate FK
-- insertion. Do not take a candidate lock from this legacy registration path.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_metadata_attempt(
 p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_provider_attempt_identity uuid,p_provider_cache_identity text,p_provider_role text,p_attempt_sequence integer,
 p_adapter_key text,p_adapter_version text,p_capability_version text,p_schema_version text,p_normalizer_version text,
 p_routing_policy_version text,p_predecessor_outcome text,p_usage_reservation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; l public.phase9_metadata_lookups; u public.phase9_usage_reservations;
 a public.metadata_enrichment_attempts; predecessor public.metadata_enrichment_attempts; duplicate_id uuid;
BEGIN
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 SELECT * INTO l FROM public.phase9_metadata_lookups
  WHERE id=p_lookup_id AND job_id=j.id AND store_id=j.store_id FOR UPDATE;
 IF l.id IS NULL OR l.completed_at IS NOT NULL OR l.leader_lookup_id IS NOT NULL
  OR l.candidate_id IS DISTINCT FROM j.entity_id
  OR l.claim_attempt_number IS DISTINCT FROM p_attempt_count OR l.claim_worker IS DISTINCT FROM p_worker
  OR l.claim_lease_token_hash IS DISTINCT FROM pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
  OR NOT coalesce(p_provider_attempt_identity IS NOT NULL
   AND pg_catalog.char_length(p_provider_cache_identity) BETWEEN 1 AND 3072
   AND ((p_provider_role='primary' AND p_attempt_sequence=1) OR (p_provider_role='secondary' AND p_attempt_sequence=2))
   AND p_adapter_key ~ '^[a-z][a-z0-9._-]{1,63}$',false)
  OR p_routing_policy_version IS DISTINCT FROM l.routing_policy_version
  OR p_schema_version IS DISTINCT FROM l.schema_version OR p_normalizer_version IS DISTINCT FROM l.normalizer_version
  OR (p_provider_role='primary' AND (p_adapter_key IS DISTINCT FROM l.adapter_key
   OR p_adapter_version IS DISTINCT FROM l.adapter_version OR p_capability_version IS DISTINCT FROM l.capability_version
   OR p_provider_cache_identity IS DISTINCT FROM l.provider_cache_identity))
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE provider_attempt_identity=p_provider_attempt_identity;
 IF a.id IS NOT NULL THEN
  IF a.lookup_id IS DISTINCT FROM l.id OR a.candidate_id IS DISTINCT FROM l.candidate_id
   OR a.store_id IS DISTINCT FROM l.store_id OR a.provider_role IS DISTINCT FROM p_provider_role
   OR a.attempt_sequence IS DISTINCT FROM p_attempt_sequence
   OR a.provider_cache_identity IS DISTINCT FROM p_provider_cache_identity OR a.adapter_key IS DISTINCT FROM p_adapter_key
   OR a.adapter_version IS DISTINCT FROM p_adapter_version OR a.capability_version IS DISTINCT FROM p_capability_version
   OR a.schema_version IS DISTINCT FROM p_schema_version OR a.normalizer_version IS DISTINCT FROM p_normalizer_version
   OR a.routing_policy_version IS DISTINCT FROM p_routing_policy_version
   OR a.predecessor_outcome IS DISTINCT FROM p_predecessor_outcome OR a.usage_reservation_id IS DISTINCT FROM p_usage_reservation_id
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN pg_catalog.jsonb_build_object('attempt_id',a.id,'disposition',a.disposition);
 END IF;
 IF NOT marketplace_sec.phase9_metadata_route_valid_v1(p_adapter_key,p_adapter_version,
   j.operation_version='p9-owner-edition-options-v1',p_provider_role,p_capability_version,p_schema_version,p_normalizer_version)
  OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key=p_adapter_key
   AND r.policy_version::text=l.reuse_policy_version)
 THEN RAISE EXCEPTION 'P9_METADATA_PROVIDER_DISABLED'; END IF;
 IF p_provider_role='secondary' THEN
  SELECT * INTO predecessor FROM public.metadata_enrichment_attempts
   WHERE lookup_id=l.id AND candidate_id=l.candidate_id AND store_id=l.store_id
    AND provider_role='primary' AND attempt_sequence=1 AND adapter_key=l.adapter_key AND adapter_version=l.adapter_version
    AND disposition IN ('rejected','failed') FOR UPDATE;
  IF predecessor.id IS NULL OR predecessor.normalized_outcome IS DISTINCT FROM p_predecessor_outcome
   OR predecessor.adapter_key=p_adapter_key OR NOT coalesce(p_predecessor_outcome IN
    ('no_acceptable_match','ambiguous_match','material_conflict','schema_invalid','malformed_response',
     'timeout','rate_limited','provider_unavailable','circuit_breaker_open')
    OR (j.operation_version='p9-owner-edition-options-v1' AND p_predecessor_outcome IN
     ('network_failure','response_too_large','unsupported_content_type')),false)
  THEN RAISE EXCEPTION 'P9_METADATA_SECONDARY_NOT_ELIGIBLE'; END IF;
 END IF;
 SELECT * INTO u FROM public.phase9_usage_reservations WHERE id=p_usage_reservation_id
  AND job_id=j.id AND store_id=j.store_id AND cost_kind='metadata' AND status IN ('reserved','consumed')
  AND adapter_key=l.adapter_key AND adapter_version=l.adapter_version
  AND policy_version::text=l.reuse_policy_version AND idempotency_identity=j.dedupe_key FOR UPDATE;
 IF u.id IS NULL THEN RAISE EXCEPTION 'P9_METADATA_USAGE_RESERVATION_REQUIRED'; END IF;
 SELECT old.id INTO duplicate_id FROM public.metadata_enrichment_attempts old
  WHERE old.query_identity=l.query_identity AND old.adapter_key=p_adapter_key AND old.adapter_version=p_adapter_version
  ORDER BY old.created_at LIMIT 1;
 INSERT INTO public.metadata_enrichment_attempts(candidate_id,store_id,adapter_key,attempt_sequence,query_kind,
  normalized_request_clues,status,cache_status,adapter_version,schema_version,normalizer_version,reuse_policy_version,
  lookup_id,provider_role,query_identity,provider_cache_identity,capability_version,routing_policy_version,
  predecessor_outcome,predecessor_attempt_id,usage_reservation_id,provider_attempt_identity,
  possibly_duplicate_spend_of_attempt_id,disposition)
 VALUES(l.candidate_id,l.store_id,p_adapter_key,p_attempt_sequence,l.lookup_strategy,'{}','registered','miss',
  p_adapter_version,p_schema_version,p_normalizer_version,1,l.id,p_provider_role,l.query_identity,p_provider_cache_identity,
  p_capability_version,p_routing_policy_version,p_predecessor_outcome,predecessor.id,p_usage_reservation_id,
  p_provider_attempt_identity,duplicate_id,'unresolved')
 ON CONFLICT(provider_attempt_identity) DO NOTHING RETURNING * INTO a;
 IF a.id IS NULL THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
 RETURN pg_catalog.jsonb_build_object('attempt_id',a.id,'disposition',a.disposition);
END$$;

-- 02c §4.2: one lookup reservation with unchanged idempotency/cost semantics.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_reserve_metadata_usage(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_lookup_id uuid,p_adapter_key text,p_adapter_version text,p_policy_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates;
 l public.phase9_metadata_lookups; u public.phase9_usage_reservations; explicit boolean;
BEGIN
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 explicit:=j.operation_version='p9-owner-edition-options-v1';
 IF explicit THEN c:=marketplace_sec.phase9_edition_worker_candidate(j);
 ELSE
  SELECT * INTO c FROM public.image_extraction_candidates WHERE id=j.entity_id AND store_id=j.store_id;
  c:=marketplace_sec.phase9_assert_structural_metadata_candidate(
   p_job_id,p_worker,p_lease_token,p_attempt_count,c.id,c.version);
 END IF;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=p_lookup_id AND job_id=j.id
  AND candidate_id=c.id AND store_id=c.store_id AND query_identity=CASE WHEN explicit
   THEN marketplace_sec.phase9_edition_query_identity(c) ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END;
 IF l.id IS NULL OR l.completed_at IS NOT NULL OR l.leader_lookup_id IS NOT NULL
  OR l.claim_attempt_number IS DISTINCT FROM p_attempt_count OR l.claim_worker IS DISTINCT FROM p_worker
  OR l.claim_lease_token_hash IS DISTINCT FROM pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
  OR p_adapter_key IS DISTINCT FROM l.adapter_key OR p_adapter_version IS DISTINCT FROM l.adapter_version
  OR p_policy_version IS NULL OR p_policy_version<1 OR p_policy_version::text IS DISTINCT FROM l.reuse_policy_version
  OR NOT marketplace_sec.phase9_metadata_route_valid_v1(p_adapter_key,p_adapter_version,explicit,'primary',
   l.capability_version,l.schema_version,l.normalizer_version)
  OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key=p_adapter_key AND r.policy_version=p_policy_version)
 THEN RAISE EXCEPTION 'P9_METADATA_PROVIDER_DISABLED'; END IF;
 INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,operation,adapter_key,
  adapter_version,idempotency_identity,reserved_cost_units)
 VALUES(j.store_id,j.id,'metadata',p_policy_version,'metadata_lookup',p_adapter_key,p_adapter_version,j.dedupe_key,0)
 ON CONFLICT(store_id,job_id,cost_kind,policy_version) DO NOTHING;
 SELECT * INTO u FROM public.phase9_usage_reservations WHERE store_id=j.store_id AND job_id=j.id
  AND cost_kind='metadata' AND policy_version=p_policy_version;
 IF u.adapter_key IS DISTINCT FROM p_adapter_key OR u.adapter_version IS DISTINCT FROM p_adapter_version
  OR u.idempotency_identity IS DISTINCT FROM j.dedupe_key THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
 RETURN pg_catalog.jsonb_build_object('reservation_id',u.id,'status',u.status);
END$$;

-- 02c §4.4: keep the historical postgres-only automatic delegate callable.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_reserve_metadata_usage_automatic(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_lookup_id uuid,p_adapter_key text,p_adapter_version text,p_policy_version integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_reserve_metadata_usage($1,$2,$3,$4,$5,$6,$7,$8)
$$;

-- 02c §§4.2/4.4: single-call legacy automatic/explicit protocol, same receipt.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_metadata_provider_call(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_physical_call_identity uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates; a public.metadata_enrichment_attempts;
 l public.phase9_metadata_lookups; pc public.phase9_metadata_provider_calls; explicit boolean; grant_epoch bigint;
BEGIN
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 explicit:=j.operation_version='p9-owner-edition-options-v1';
 IF explicit THEN c:=marketplace_sec.phase9_edition_worker_candidate(j);
 ELSE
  SELECT * INTO c FROM public.image_extraction_candidates WHERE id=j.entity_id AND store_id=j.store_id;
  c:=marketplace_sec.phase9_assert_structural_metadata_candidate(
   p_job_id,p_worker,p_lease_token,p_attempt_count,c.id,c.version);
 END IF;
 SELECT a0.* INTO a FROM public.metadata_enrichment_attempts a0
  JOIN public.phase9_metadata_lookups l0 ON l0.id=a0.lookup_id
  JOIN public.phase9_usage_reservations u ON u.id=a0.usage_reservation_id
  WHERE a0.id=p_attempt_id AND a0.candidate_id=c.id AND a0.store_id=c.store_id AND a0.provider_role='primary'
   AND a0.disposition='unresolved' AND l0.job_id=j.id AND l0.candidate_id=c.id AND l0.store_id=c.store_id
   AND l0.completed_at IS NULL AND l0.leader_lookup_id IS NULL
   AND a0.adapter_key=l0.adapter_key AND a0.adapter_version=l0.adapter_version
   AND l0.query_identity=CASE WHEN explicit THEN marketplace_sec.phase9_edition_query_identity(c)
    ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END
   AND l0.claim_attempt_number=p_attempt_count AND l0.claim_worker=p_worker
   AND l0.claim_lease_token_hash=pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
   AND u.job_id=j.id AND u.store_id=c.store_id AND u.status IN ('reserved','consumed')
   AND u.adapter_key=l0.adapter_key AND u.adapter_version=l0.adapter_version
   AND u.policy_version::text=l0.reuse_policy_version FOR UPDATE OF a0;
 IF a.id IS NULL OR p_physical_call_identity IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=a.lookup_id;
 IF NOT marketplace_sec.phase9_provider_stage_valid_v1(a.adapter_key,a.adapter_version,NULL,NULL,l.lookup_strategy)
  AND NOT (NOT explicit AND marketplace_sec.phase9_provider_legacy_route_v1(a.adapter_key,a.adapter_version,false,'primary'))
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE physical_call_identity=p_physical_call_identity
  OR (logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count) ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF pc.id IS NOT NULL THEN
  IF pc.physical_call_identity IS DISTINCT FROM p_physical_call_identity OR pc.logical_attempt_id IS DISTINCT FROM a.id
   OR pc.job_id IS DISTINCT FROM j.id OR pc.claim_attempt_number IS DISTINCT FROM p_attempt_count
   OR pc.claim_worker IS DISTINCT FROM p_worker
   OR pc.claim_lease_token_hash IS DISTINCT FROM pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
   OR pc.edition_call_sequence IS NOT NULL OR pc.edition_call_stage IS NOT NULL
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN pg_catalog.jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
 END IF;
 grant_epoch:=marketplace_sec.phase9_external_grant_epoch_v1(j.id);
 IF NOT marketplace_sec.phase9_metadata_route_valid_v1(a.adapter_key,a.adapter_version,explicit,a.provider_role,
   a.capability_version,a.schema_version,a.normalizer_version)
  OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key=a.adapter_key
   AND r.policy_version::text=l.reuse_policy_version)
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 INSERT INTO public.phase9_metadata_provider_calls(logical_attempt_id,job_id,candidate_id,store_id,
  physical_call_identity,claim_attempt_number,claim_worker,claim_lease_token_hash,grant_epoch)
 VALUES(a.id,j.id,c.id,c.store_id,p_physical_call_identity,p_attempt_count,p_worker,
  pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex'),grant_epoch) RETURNING * INTO pc;
 RETURN pg_catalog.jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_metadata_provider_call_automatic(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_physical_call_identity uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_register_metadata_provider_call($1,$2,$3,$4,$5,$6)
$$;

-- 02c §§4.2/4.3: multi-GET registration; no new round, retry or queue helpers.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_v1(
 p_attempt_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_physical_call_identity uuid,p_call_sequence integer,p_call_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.image_extraction_jobs; c public.image_extraction_candidates; a public.metadata_enrichment_attempts;
 l public.phase9_metadata_lookups; pc public.phase9_metadata_provider_calls; explicit boolean; grant_epoch bigint;
BEGIN
 IF NOT coalesce(auth.role()='service_role' AND p_physical_call_identity IS NOT NULL
  AND p_call_sequence BETWEEN 0 AND 5
  AND p_call_stage ~ '^[A-Za-z][A-Za-z0-9._:-]*$',false) THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 j:=marketplace_sec.phase9_assert_metadata_claim(p_job_id,p_worker,p_lease_token,p_attempt_count);
 explicit:=j.operation_version='p9-owner-edition-options-v1';
 IF explicit THEN c:=marketplace_sec.phase9_edition_worker_candidate(j);
 ELSE
  SELECT * INTO c FROM public.image_extraction_candidates WHERE id=j.entity_id AND store_id=j.store_id;
  c:=marketplace_sec.phase9_assert_structural_metadata_candidate(
   p_job_id,p_worker,p_lease_token,p_attempt_count,c.id,c.version);
 END IF;
 SELECT a0.* INTO a FROM public.metadata_enrichment_attempts a0
  JOIN public.phase9_metadata_lookups l0 ON l0.id=a0.lookup_id
  JOIN public.phase9_usage_reservations u ON u.id=a0.usage_reservation_id
  WHERE a0.id=p_attempt_id AND a0.disposition='unresolved' AND a0.candidate_id=c.id AND a0.store_id=c.store_id
   AND l0.job_id=j.id AND l0.candidate_id=c.id AND l0.store_id=c.store_id
   AND l0.completed_at IS NULL AND l0.leader_lookup_id IS NULL
   AND l0.query_identity=CASE WHEN explicit THEN marketplace_sec.phase9_edition_query_identity(c)
    ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END
   AND l0.claim_attempt_number=p_attempt_count AND l0.claim_worker=p_worker
   AND l0.claim_lease_token_hash=pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
   AND u.job_id=j.id AND u.store_id=c.store_id AND u.status IN ('reserved','consumed')
   AND u.adapter_key=l0.adapter_key AND u.adapter_version=l0.adapter_version
   AND u.policy_version::text=l0.reuse_policy_version FOR UPDATE OF a0;
 IF a.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=a.lookup_id;
 IF NOT marketplace_sec.phase9_provider_stage_valid_v1(a.adapter_key,a.adapter_version,p_call_sequence,p_call_stage,l.lookup_strategy)
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 SELECT * INTO pc FROM public.phase9_metadata_provider_calls
  WHERE physical_call_identity=p_physical_call_identity OR
   (logical_attempt_id=a.id AND claim_attempt_number=p_attempt_count
    AND (edition_call_sequence=p_call_sequence OR edition_call_stage=p_call_stage))
  ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF pc.id IS NOT NULL THEN
  IF pc.physical_call_identity IS DISTINCT FROM p_physical_call_identity OR pc.logical_attempt_id IS DISTINCT FROM a.id
   OR pc.job_id IS DISTINCT FROM j.id OR pc.claim_attempt_number IS DISTINCT FROM p_attempt_count
   OR pc.claim_worker IS DISTINCT FROM p_worker
   OR pc.claim_lease_token_hash IS DISTINCT FROM pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
   OR pc.edition_call_sequence IS DISTINCT FROM p_call_sequence OR pc.edition_call_stage IS DISTINCT FROM p_call_stage
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN pg_catalog.jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
 END IF;
 grant_epoch:=marketplace_sec.phase9_external_grant_epoch_v1(j.id);
 IF NOT marketplace_sec.phase9_metadata_route_valid_v1(a.adapter_key,a.adapter_version,explicit,a.provider_role,
   a.capability_version,a.schema_version,a.normalizer_version)
  OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key=a.adapter_key
   AND r.storage_allowed AND r.policy_version::text=l.reuse_policy_version)
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF (a.provider_role='primary' AND (a.adapter_key IS DISTINCT FROM l.adapter_key OR a.adapter_version IS DISTINCT FROM l.adapter_version))
  OR (a.provider_role='secondary' AND NOT EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts pred
   WHERE pred.id=a.predecessor_attempt_id AND pred.lookup_id=l.id AND pred.candidate_id=c.id AND pred.store_id=c.store_id
    AND pred.provider_role='primary' AND pred.attempt_sequence=1 AND pred.adapter_key=l.adapter_key
    AND pred.adapter_version=l.adapter_version AND pred.disposition IN ('rejected','failed')
    AND pred.normalized_outcome=a.predecessor_outcome))
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF p_call_sequence>0 AND (SELECT count(*) FROM public.phase9_metadata_provider_calls prior
  WHERE prior.logical_attempt_id=a.id AND prior.claim_attempt_number=p_attempt_count
   AND prior.edition_call_sequence<p_call_sequence AND prior.status='finalized'
   AND prior.edition_egress_started=true AND prior.retryable=false
   AND marketplace_sec.phase9_provider_stage_continues_v1(a.adapter_key,a.adapter_version,
    prior.edition_call_sequence,prior.edition_call_stage,prior.normalized_outcome))<>p_call_sequence
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 INSERT INTO public.phase9_metadata_provider_calls(logical_attempt_id,job_id,candidate_id,store_id,
  physical_call_identity,claim_attempt_number,claim_worker,claim_lease_token_hash,edition_call_sequence,edition_call_stage,grant_epoch)
 VALUES(a.id,j.id,c.id,c.store_id,p_physical_call_identity,p_attempt_count,p_worker,
  pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex'),p_call_sequence,p_call_stage,grant_epoch) RETURNING * INTO pc;
 RETURN pg_catalog.jsonb_build_object('provider_call_id',pc.id,'status',pc.status);
END$$;

-- 02c §4.2: locked registration/completion owns role/predecessor relations;
-- this legacy pure dispatcher checks only common role shape and own protocol.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
 p_adapter_key text,p_record_id text,p_work_id text,p_book_url text,p_cover_url text,p_completion jsonb)
RETURNS TABLE(valid boolean,cover_ref text,logical_outcome text)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb:=p_completion; checked record;
BEGIN
 valid:=false; cover_ref:=NULL; logical_outcome:=NULL;
 IF c IS NULL THEN
  SELECT * INTO checked FROM marketplace_sec.phase9_provider_facts_valid_v1(
   p_adapter_key,'1.0.0',p_record_id,p_work_id,p_book_url,p_cover_url);
  valid:=checked.valid; IF valid THEN cover_ref:=checked.cover_ref; END IF;
  RETURN NEXT; RETURN;
 END IF;
 IF p_record_id IS NOT NULL OR p_work_id IS NOT NULL OR p_book_url IS NOT NULL OR p_cover_url IS NOT NULL
  OR NOT marketplace_sec.phase9_provider_call_shape_v1(c)
  OR NOT coalesce((c->>'providerRole'='primary' AND c->>'primaryAdapterKey'=p_adapter_key)
   OR (c->>'providerRole'='secondary' AND c->>'primaryAdapterKey'<>p_adapter_key
    AND c->>'predecessorOutcome' IN ('no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
     'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open',
     'network_failure','response_too_large','unsupported_content_type')),false)
 THEN RETURN NEXT; RETURN; END IF;
 SELECT * INTO checked FROM marketplace_sec.phase9_provider_call_contract_v1(p_adapter_key,'1.0.0',c);
 valid:=checked.valid; IF valid THEN logical_outcome:=checked.logical_outcome; END IF;
 RETURN NEXT;
END$$;

-- 02c §8: new helpers postgres-only. Replacements retain their existing ACL;
-- spell out the same owner/revoke/grant boundaries (no PUBLIC/API widening).
ALTER FUNCTION marketplace_sec.phase9_external_grant_epoch_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_external_grant_epoch_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_stage_valid_v1(text,text,integer,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_stage_valid_v1(text,text,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_stage_continues_v1(text,text,integer,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_stage_continues_v1(text,text,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_legacy_route_v1(text,text,boolean,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_legacy_route_v1(text,text,boolean,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_metadata_route_valid_v1(text,text,boolean,text,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_metadata_route_valid_v1(text,text,boolean,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_register_structural_metadata_lookup(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_structural_metadata_lookup(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION marketplace_sec.phase9_register_structural_metadata_attempt(uuid,uuid,text,text,integer,uuid,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_structural_metadata_attempt(uuid,uuid,text,text,integer,uuid,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION marketplace_sec.phase9_register_metadata_attempt(uuid,uuid,text,text,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_metadata_attempt(uuid,uuid,text,text,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION marketplace_sec.phase9_reserve_metadata_usage(uuid,text,text,integer,uuid,text,text,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_reserve_metadata_usage(uuid,text,text,integer,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION marketplace_sec.phase9_reserve_metadata_usage_automatic(uuid,text,text,integer,uuid,text,text,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_reserve_metadata_usage_automatic(uuid,text,text,integer,uuid,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_register_metadata_provider_call(uuid,uuid,text,text,integer,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_metadata_provider_call(uuid,uuid,text,text,integer,uuid) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION marketplace_sec.phase9_register_metadata_provider_call_automatic(uuid,uuid,text,text,integer,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_metadata_provider_call_automatic(uuid,uuid,text,text,integer,uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- Existing service grants only (M68/M73/M74); public wrappers stay untouched.
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_register_structural_metadata_lookup(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid),
 marketplace_sec.phase9_register_structural_metadata_attempt(uuid,uuid,text,text,integer,uuid,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid),
 marketplace_sec.phase9_register_metadata_attempt(uuid,uuid,text,text,integer,uuid,text,text,integer,text,text,text,text,text,text,text,uuid),
 marketplace_sec.phase9_reserve_metadata_usage(uuid,text,text,integer,uuid,text,text,integer),
 marketplace_sec.phase9_register_metadata_provider_call(uuid,uuid,text,text,integer,uuid),
 marketplace_sec.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text)
 TO service_role;

COMMIT;
