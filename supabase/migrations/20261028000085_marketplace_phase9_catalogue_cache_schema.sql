-- 02b sections 4.5,5,8.2,9,12: M85 / package 9a, cache schema and guards.
-- Depends on M84 and earlier applied migrations; those files remain immutable.
-- Creates the strict payload validator and deferred receipt guard; replaces the
-- lookup/cache CHECKs, M68 automatic guard, M73 source policy and legacy cache
-- reader/writer bodies. Deliberately idle: no publication, reuse or worker deploy.
BEGIN;

-- Pure shape validation reuses the established normalized metadata and companion
-- validators with fixed, non-provenance placeholders for the stripped envelope.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_valid_cache_v1(p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE r jsonb; m jsonb; c jsonb; n integer:=-1; own_valid boolean;
 dummy uuid:='00000000-0000-4000-8000-000000000001';
BEGIN
 IF pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR (SELECT array_agg(k ORDER BY k) FROM pg_catalog.jsonb_object_keys(p_payload) k)
    IS DISTINCT FROM ARRAY['rows','sourceFetchedAt','version']
  OR p_payload->>'version' IS DISTINCT FROM 'psr-edition-cache-v1'
  OR pg_catalog.jsonb_typeof(p_payload->'sourceFetchedAt') IS DISTINCT FROM 'string'
  OR pg_catalog.char_length(p_payload->>'sourceFetchedAt') NOT BETWEEN 1 AND 40
  OR p_payload->>'sourceFetchedAt' !~ ('^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T'
   ||'([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$')
  OR pg_catalog.jsonb_typeof(p_payload->'rows') IS DISTINCT FROM 'array'
  OR pg_catalog.jsonb_array_length(p_payload->'rows') NOT BETWEEN 1 AND 10
  OR pg_catalog.octet_length(p_payload::text)>2621440 THEN RETURN false; END IF;
 PERFORM (p_payload->>'sourceFetchedAt')::timestamptz;
 FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(p_payload->'rows') LOOP
  IF pg_catalog.jsonb_typeof(r) IS DISTINCT FROM 'object'
   OR (SELECT array_agg(k ORDER BY k) FROM pg_catalog.jsonb_object_keys(r) k)
    IS DISTINCT FROM ARRAY['companion','eligibility','googleBooksUrl','metadata','ordinal','providerRecordId']
   OR pg_catalog.jsonb_typeof(r->'ordinal') IS DISTINCT FROM 'number'
   OR (r->>'ordinal')::numeric<>trunc((r->>'ordinal')::numeric)
   OR (r->>'ordinal')::integer NOT BETWEEN 0 AND 9 OR (r->>'ordinal')::integer<=n
  THEN RETURN false; END IF;
  n:=(r->>'ordinal')::integer;
  IF r->>'eligibility'='unavailable' THEN
   IF r->'metadata' IS DISTINCT FROM 'null'::jsonb OR r->'companion' IS DISTINCT FROM 'null'::jsonb
    OR r->'googleBooksUrl' IS DISTINCT FROM 'null'::jsonb OR r->'providerRecordId' IS DISTINCT FROM 'null'::jsonb
   THEN RETURN false; END IF;
   CONTINUE;
  END IF;
  IF r->>'eligibility' NOT IN('eligible','ineligible') OR r->>'eligibility' IS NULL
   OR pg_catalog.jsonb_typeof(r->'metadata') IS DISTINCT FROM 'object'
   OR pg_catalog.jsonb_typeof(r->'companion') IS DISTINCT FROM 'object'
   OR pg_catalog.jsonb_typeof(r->'providerRecordId') IS DISTINCT FROM 'string'
   OR pg_catalog.jsonb_typeof(r->'googleBooksUrl') IS DISTINCT FROM 'string'
   OR pg_catalog.char_length(r->>'googleBooksUrl') NOT BETWEEN 1 AND 2048
   OR r->'metadata' ?| ARRAY['correlationId','attemptId','matchRationale','confidence']
   OR r->>'providerRecordId' IS DISTINCT FROM r#>>'{metadata,providerRecordId}'
   OR (SELECT array_agg(k ORDER BY k) FROM pg_catalog.jsonb_object_keys(r->'companion') k)
    IS DISTINCT FROM ARRAY['lccn','oclc','version','workExternalId'] THEN RETURN false; END IF;
  m:=r->'metadata'||pg_catalog.jsonb_build_object('correlationId',dummy,'attemptId',dummy,
    'matchRationale','confirmation_required_text_evidence','confidence',0);
  IF NOT coalesce(marketplace_sec.phase9_edition_valid_normalized_metadata(m),false)
   OR (m->>'fetchedAt')::timestamptz IS DISTINCT FROM (p_payload->>'sourceFetchedAt')::timestamptz
  THEN RETURN false; END IF;
  c:=r->'companion'||pg_catalog.jsonb_build_object('optionId',dummy,'lookupId',dummy,'attemptId',dummy,
   'adapterKey',m->'adapterKey','adapterVersion',m->'adapterVersion','normalizerVersion',m->'normalizerVersion',
   'providerRecordId',m->'providerRecordId','fetchedAt',m->'fetchedAt');
  IF NOT coalesce(marketplace_sec.phase9_catalogue_valid_companion_v1(c,m,dummy),false)
  THEN RETURN false; END IF;
  SELECT v.valid INTO own_valid FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
   m->>'adapterKey',m->>'providerRecordId',c->>'workExternalId',r->>'googleBooksUrl',m->>'coverReference',NULL) v;
  IF NOT coalesce(own_valid,false) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation OR numeric_value_out_of_range
 THEN RETURN false;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_valid_cache_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_valid_cache_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.phase9_metadata_cache_entries
 ADD COLUMN IF NOT EXISTS payload_kind text NOT NULL DEFAULT 'selected_snapshot_v1'
  CHECK(payload_kind IN('selected_snapshot_v1','edition_options_v1')),
 ADD COLUMN IF NOT EXISTS bibliographic_payload jsonb,
 ADD COLUMN IF NOT EXISTS payload_digest text CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 ADD COLUMN IF NOT EXISTS routing_policy_version text CHECK(routing_policy_version IS NULL OR
  (pg_catalog.char_length(routing_policy_version) BETWEEN 1 AND 128 AND pg_catalog.btrim(routing_policy_version)<>'')),
 DROP CONSTRAINT IF EXISTS phase9_metadata_cache_entries_check1,
 ADD CONSTRAINT phase9_metadata_cache_entries_check1 CHECK(
  (payload_kind='selected_snapshot_v1' AND bibliographic_payload IS NULL AND payload_digest IS NULL
   AND routing_policy_version IS NULL AND ((outcome='positive' AND normalized_snapshot IS NOT NULL)
    OR (outcome<>'positive' AND normalized_snapshot IS NULL)))
  OR (payload_kind='edition_options_v1' AND outcome='positive' AND normalized_snapshot IS NULL
   AND source_attempt_id IS NULL AND provider_record_id IS NULL AND bibliographic_payload IS NOT NULL
   AND payload_digest IS NOT NULL AND routing_policy_version IS NOT NULL AND source_fetched_at IS NOT NULL
   AND source_fetched_at<=expires_at AND expires_at>source_fetched_at
   AND marketplace_sec.phase9_catalogue_valid_cache_v1(bibliographic_payload)
   AND (bibliographic_payload->>'sourceFetchedAt')::timestamptz=source_fetched_at
   AND payload_digest=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(bibliographic_payload::text,'UTF8')),'hex')));

-- Actual M15 names, captured in the supplied read-only preflight (02b 13.2).
ALTER TABLE public.phase9_metadata_lookups
 DROP CONSTRAINT IF EXISTS phase9_metadata_lookups_execution_mode_check,
 ADD CONSTRAINT phase9_metadata_lookups_execution_mode_check CHECK(execution_mode IN('local','external','cache_hit')),
 DROP CONSTRAINT IF EXISTS phase9_metadata_lookups_check1,
 ADD CONSTRAINT phase9_metadata_lookups_check1 CHECK(
  (execution_mode='external' AND provider_cache_identity IS NOT NULL AND adapter_key IS NOT NULL
   AND adapter_version IS NOT NULL AND capability_version IS NOT NULL AND reuse_policy_version IS NOT NULL
   AND cache_policy_version IS NOT NULL AND cache_namespace IS NOT NULL)
  OR (execution_mode='local' AND provider_cache_identity IS NULL AND adapter_key IS NULL
   AND adapter_version IS NULL AND capability_version IS NULL AND reuse_policy_version IS NULL
   AND cache_policy_version IS NULL AND cache_namespace IS NULL AND leader_lookup_id IS NULL
   AND reuse_source_attempt_id IS NULL AND outcome_source_attempt_id IS NULL)
  OR (execution_mode='cache_hit' AND provider_cache_identity IS NOT NULL AND adapter_key IS NOT NULL
   AND adapter_version IS NOT NULL AND capability_version IS NOT NULL AND reuse_policy_version IS NOT NULL
   AND cache_policy_version IS NOT NULL AND cache_namespace IS NOT NULL AND leader_lookup_id IS NULL
   AND reuse_source_attempt_id IS NULL AND privacy_scope='store_private' AND canonical_edition_id IS NULL));

-- Deferred proof reads the final lookup, rather than an intermediate trigger NEW
-- image: the attempt's FK needs the lookup inserted before its outcome pointer.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_cache_receipt_guard()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.phase9_metadata_lookups;
BEGIN
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=NEW.id;
 IF l.id IS NULL OR l.execution_mode<>'cache_hit' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_catalogue_lookup_effects e
  JOIN public.phase9_candidate_edition_state s ON s.candidate_id=e.candidate_id
  JOIN public.image_extraction_candidates c ON c.id=e.candidate_id
  JOIN public.image_extraction_jobs j ON j.id=l.job_id
  JOIN public.metadata_enrichment_attempts a ON a.id=l.outcome_source_attempt_id
  JOIN public.phase9_metadata_cache_entries cache ON cache.id=e.cache_entry_id
  WHERE e.lookup_id=l.id AND e.candidate_id=l.candidate_id AND e.store_id=l.store_id
   AND e.session_id=c.session_id AND e.session_id=s.session_id AND s.store_id=l.store_id
   AND s.source_lookup_id=l.id AND s.source_attempt_id=a.id AND s.request_id=l.job_id
   AND s.request_generation=e.request_generation AND s.query_identity=l.query_identity
   AND e.cache_payload_digest=cache.payload_digest AND cache.payload_kind='edition_options_v1'
   AND l.provider_cache_identity=cache.provider_cache_identity AND l.completed_at IS NOT NULL
   AND e.completion_response->>'status'='completed' AND e.completion_response->>'requestId'=l.job_id::text
   AND a.lookup_id=l.id AND a.store_id=l.store_id AND a.candidate_id=l.candidate_id
   AND a.adapter_key=l.adapter_key AND a.adapter_version=l.adapter_version AND a.provider_role='primary'
   AND a.status='completed' AND a.disposition='rejected' AND a.cache_status='positive_hit'
   AND a.attempt_sequence=1 AND a.usage_reservation_id IS NULL AND a.provider_request_id IS NULL
   AND a.normalized_payload IS NULL AND a.raw_payload IS NULL AND a.calculated_cost_units=0
   AND j.entity_id=l.candidate_id AND j.store_id=l.store_id AND j.status='resolved'
   AND j.operation_version='p9-owner-edition-options-v1')
  OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc
   WHERE pc.logical_attempt_id=l.outcome_source_attempt_id OR pc.job_id=l.job_id)
  OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations u WHERE u.job_id=l.job_id)
 THEN RAISE EXCEPTION 'P9_EDITION_CACHE_RECEIPT_REQUIRED'; END IF;
 RETURN NULL;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_cache_receipt_guard() OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_cache_receipt_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE CONSTRAINT TRIGGER phase9_catalogue_cache_receipt_guard
 AFTER INSERT OR UPDATE ON public.phase9_metadata_lookups DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_catalogue_cache_receipt_guard();

-- M68: cache-hit lookups gain deferred proof, never an automatic snapshot.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_guard_automatic_payload()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $function$
DECLARE job uuid; lookup uuid;
BEGIN
 IF TG_TABLE_NAME='phase9_metadata_lookups' THEN
  job:=NEW.job_id;
  IF EXISTS(SELECT 1 FROM public.image_extraction_jobs WHERE id=job AND operation_version='p9-owner-edition-options-v1')
   AND (NEW.execution_mode NOT IN('external','cache_hit') OR NEW.leader_lookup_id IS NOT NULL OR NEW.privacy_scope<>'store_private')
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF; RETURN NEW;
 ELSIF TG_TABLE_NAME='phase9_metadata_cache_entries' THEN
  IF NEW.payload_kind='edition_options_v1' AND NEW.source_attempt_id IS NULL
   AND NEW.normalized_snapshot IS NULL THEN RETURN NEW; END IF;
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
ALTER FUNCTION marketplace_sec.phase9_edition_guard_automatic_payload() OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_guard_automatic_payload() FROM PUBLIC,anon,authenticated,service_role;

-- M73: external lineage keeps its existing rules; cache-only lineage additionally
-- requires its same-tenant private receipt, current registry and zero egress.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_source_policy(p_state public.phase9_candidate_edition_state)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $function$
 SELECT EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts a
  JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id
  JOIN public.phase9_provider_registry r ON r.adapter_key=a.adapter_key
  WHERE a.id=p_state.source_attempt_id AND l.id=p_state.source_lookup_id
   AND a.candidate_id=p_state.candidate_id AND a.store_id=p_state.store_id
   AND l.candidate_id=p_state.candidate_id AND l.store_id=p_state.store_id
   AND r.provider_kind='metadata' AND r.adapter_version=a.adapter_version
   AND r.policy_version::text=l.reuse_policy_version AND r.enabled AND r.matching_allowed AND r.storage_allowed
   AND ((l.execution_mode<>'cache_hit' AND r.adapter_key IN('google_books','open_library'))
    OR (l.execution_mode='cache_hit' AND r.public_display_allowed
    AND marketplace_sec.phase9_catalogue_shared_admitted_v1(r.adapter_key)
    AND a.usage_reservation_id IS NULL AND a.normalized_payload IS NULL AND a.raw_payload IS NULL
    AND a.provider_request_id IS NULL AND a.cache_status='positive_hit' AND a.calculated_cost_units=0
    AND NOT EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls pc WHERE pc.logical_attempt_id=a.id)
    AND EXISTS(SELECT 1 FROM marketplace_sec.phase9_catalogue_lookup_effects e
     WHERE e.lookup_id=l.id AND e.candidate_id=p_state.candidate_id AND e.store_id=p_state.store_id
      AND e.session_id=p_state.session_id AND e.request_generation=p_state.request_generation
      AND e.cache_entry_id IS NOT NULL AND e.cache_payload_digest IS NOT NULL
      AND l.outcome_source_attempt_id=a.id AND l.completed_at IS NOT NULL))))
$function$;
ALTER FUNCTION marketplace_sec.phase9_edition_source_policy(public.phase9_candidate_edition_state) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_source_policy(public.phase9_candidate_edition_state) FROM PUBLIC,anon,authenticated,service_role;

-- 02b sections 4.5/8.2/10: preserve legacy algorithms, discriminate only by kind.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_metadata_cache_reuse_context(
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
    WHERE c.payload_kind='selected_snapshot_v1' AND c.provider_cache_identity=p_provider_cache_identity
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
ALTER FUNCTION marketplace_sec.phase9_metadata_cache_reuse_context(uuid,text,text,integer,uuid,integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_metadata_cache_reuse_context(uuid,text,text,integer,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_metadata_cache_reuse_context(uuid,text,text,integer,uuid,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_complete_metadata_cache_reuse(
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
    WHERE c.payload_kind='selected_snapshot_v1' AND c.provider_cache_identity=p_provider_cache_identity
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
ALTER FUNCTION marketplace_sec.phase9_complete_metadata_cache_reuse(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_metadata_cache_reuse(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_metadata_cache_reuse(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_store_metadata_cache(
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
    IF v_cache.payload_kind IS DISTINCT FROM 'selected_snapshot_v1' THEN
      RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
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
ALTER FUNCTION marketplace_sec.phase9_store_metadata_cache(uuid,text,text,integer,text,jsonb,text,timestamptz,timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_store_metadata_cache(uuid,text,text,integer,text,jsonb,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_store_metadata_cache(uuid,text,text,integer,text,jsonb,text,timestamptz,timestamptz) TO service_role;

COMMIT;
