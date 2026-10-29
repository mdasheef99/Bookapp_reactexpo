-- 02b sections 6.2,7.1,8.2,12: M88 / slice 7b-2 cache hardening.
-- Owner 2026-10-29; review m88-candidates sections A/I/J. Creation only.
-- Depends on M83-M87. Replaces only the definer-only publication helper.
BEGIN;

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
  -- M88 review A1 / Terra closeout 1: never publish under another routing policy.
  OR a.routing_policy_version IS DISTINCT FROM l.routing_policy_version
  -- M88 review A2 / Muse closeout 1: only the primary attempt publishes.
  OR a.provider_role IS DISTINCT FROM 'primary'
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
 -- M88 review A3 / Terra slice 1 #2: the key-lock wait can exhaust this deadline.
 -- An already-expired just-inserted row is intentionally left for later replacement.
 IF deadline<=pg_catalog.clock_timestamp() THEN RETURN NULL; END IF;
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

COMMIT;
