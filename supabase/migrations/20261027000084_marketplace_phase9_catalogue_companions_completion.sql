-- Phase 9 / 02b section section 3-7,9-12,13.4,14: 7b-1 only. Forward-only; no backfill.
BEGIN;

-- 1. Immutable private provenance and durable completion receipts (section 4.4).
CREATE TABLE marketplace_sec.phase9_catalogue_companions (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 lookup_id uuid NOT NULL REFERENCES public.phase9_metadata_lookups(id) ON DELETE CASCADE,
 attempt_id uuid NOT NULL REFERENCES public.metadata_enrichment_attempts(id) ON DELETE CASCADE,
 candidate_id uuid NOT NULL REFERENCES public.image_extraction_candidates(id),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 session_id uuid NOT NULL REFERENCES public.image_extraction_sessions(id),
 provider_record_id text NOT NULL CHECK(pg_catalog.char_length(provider_record_id) BETWEEN 1 AND 256),
 option_id uuid,
 payload_version text NOT NULL CHECK(payload_version='psr-catalogue-write-v1'),
 metadata_digest text NOT NULL CHECK(metadata_digest ~ '^[0-9a-f]{64}$'),
 companion jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp()
);
CREATE UNIQUE INDEX phase9_catalogue_companions_option_idx
 ON marketplace_sec.phase9_catalogue_companions(lookup_id,attempt_id,option_id) WHERE option_id IS NOT NULL;
CREATE UNIQUE INDEX phase9_catalogue_companions_automatic_idx
 ON marketplace_sec.phase9_catalogue_companions(lookup_id,attempt_id,provider_record_id) WHERE option_id IS NULL;
CREATE INDEX phase9_catalogue_companions_source_idx
 ON marketplace_sec.phase9_catalogue_companions(lookup_id,attempt_id,provider_record_id,metadata_digest);
ALTER TABLE marketplace_sec.phase9_catalogue_companions OWNER TO postgres;
ALTER TABLE marketplace_sec.phase9_catalogue_companions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE marketplace_sec.phase9_catalogue_companions FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE marketplace_sec.phase9_catalogue_lookup_effects (
 lookup_id uuid PRIMARY KEY REFERENCES public.phase9_metadata_lookups(id) ON DELETE CASCADE,
 candidate_id uuid NOT NULL REFERENCES public.image_extraction_candidates(id),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 session_id uuid NOT NULL REFERENCES public.image_extraction_sessions(id),
 request_generation integer NOT NULL CHECK(request_generation>=0),
 completion_digest text NOT NULL CHECK(completion_digest ~ '^[0-9a-f]{64}$'),
 canonical_results jsonb NOT NULL,
 searched_work_id uuid REFERENCES public.canonical_works(id) ON DELETE SET NULL,
 search_counted boolean NOT NULL DEFAULT false,
 cache_entry_id uuid REFERENCES public.phase9_metadata_cache_entries(id) ON DELETE SET NULL,
 cache_payload_digest text CHECK(cache_payload_digest ~ '^[0-9a-f]{64}$'),
 completion_response jsonb NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp()
);
ALTER TABLE marketplace_sec.phase9_catalogue_lookup_effects OWNER TO postgres;
ALTER TABLE marketplace_sec.phase9_catalogue_lookup_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE marketplace_sec.phase9_catalogue_lookup_effects FROM PUBLIC,anon,authenticated,service_role;

-- 2. Pure companion validation (section 3.1). Optional absent facts normalize to null
-- at persistence; supplied malformed facts never turn into omission.
CREATE FUNCTION marketplace_sec.phase9_catalogue_valid_companion_v1(
 p_companion jsonb,p_metadata jsonb,p_option_id uuid)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE c jsonb:=p_companion; k text; v_valid boolean;
BEGIN
 IF pg_catalog.jsonb_typeof(c) IS DISTINCT FROM 'object'
  OR pg_catalog.jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF NOT c ?& ARRAY['version','optionId','adapterKey','adapterVersion','normalizerVersion',
   'lookupId','attemptId','providerRecordId','fetchedAt']
  OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_object_keys(c) key WHERE key<>ALL(ARRAY[
   'version','optionId','adapterKey','adapterVersion','normalizerVersion','lookupId','attemptId',
   'providerRecordId','workExternalId','fetchedAt','oclc','lccn']))
  OR c->>'version' IS DISTINCT FROM 'psr-catalogue-write-v1'
  OR pg_catalog.octet_length(c::text)>32768 THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['version','adapterKey','adapterVersion','normalizerVersion',
   'lookupId','attemptId','providerRecordId','fetchedAt'] LOOP
  IF pg_catalog.jsonb_typeof(c->k) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 END LOOP;
 IF (p_option_id IS NOT NULL AND (pg_catalog.jsonb_typeof(c->'optionId') IS DISTINCT FROM 'string'
    OR c->>'optionId' IS DISTINCT FROM p_option_id::text))
  OR (p_option_id IS NULL AND c->'optionId' IS DISTINCT FROM 'null'::jsonb)
  OR c->>'adapterKey' !~ '^[a-z][a-z0-9_-]{1,63}$'
  OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(c->>'adapterVersion',128)
  OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(c->>'normalizerVersion',128)
  OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(c->>'providerRecordId',256)
  OR c->>'lookupId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  OR c->>'attemptId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['adapterKey','adapterVersion','normalizerVersion','providerRecordId'] LOOP
  IF c->>k IS DISTINCT FROM p_metadata->>k THEN RETURN false; END IF;
 END LOOP;
 IF c->>'lookupId' IS DISTINCT FROM p_metadata->>'correlationId'
  OR c->>'attemptId' IS DISTINCT FROM p_metadata->>'attemptId'
  OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(c->>'fetchedAt',40)
  OR c->>'fetchedAt' !~ ('^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T'
    ||'([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$')
  OR (c->>'fetchedAt')::timestamptz IS DISTINCT FROM (p_metadata->>'fetchedAt')::timestamptz
 THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['workExternalId','oclc','lccn'] LOOP
  IF c ? k AND c->k<>'null'::jsonb THEN
   IF pg_catalog.jsonb_typeof(c->k) IS DISTINCT FROM 'string'
    OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(c->>k,CASE WHEN k='workExternalId' THEN 256 ELSE 64 END)
    OR (k='oclc' AND c->>k !~ '^[0-9]+$')
    OR (k='lccn' AND c->>k !~ '^[A-Za-z0-9]+([ -][A-Za-z0-9]+)*$') THEN RETURN false; END IF;
  END IF;
 END LOOP;
 SELECT ids.valid INTO v_valid FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
  c->>'adapterKey',c->>'providerRecordId',c->>'workExternalId',NULL,p_metadata->>'coverReference',NULL) ids;
 RETURN coalesce(v_valid,false);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_valid_companion_v1(jsonb,jsonb,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_valid_companion_v1(jsonb,jsonb,uuid)
 FROM PUBLIC,anon,authenticated,service_role;

-- 02b ?5/AC7-23: one provider-specific facts/accounting dispatch, preserving M78.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
 p_adapter_key text,p_record_id text,p_work_id text,p_book_url text,p_cover_url text,p_completion jsonb)
RETURNS TABLE(valid boolean,cover_ref text,logical_outcome text)
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE c jsonb:=p_completion; receipt jsonb; terminal jsonb; k text; seq integer; seen integer[]:=ARRAY[]::integer[];
BEGIN
 valid:=false; cover_ref:=NULL; logical_outcome:=NULL;
 IF p_completion IS NULL AND (NOT marketplace_sec.phase9_catalogue_safe_text_v1(p_record_id,256)
  OR (p_work_id IS NOT NULL AND NOT marketplace_sec.phase9_catalogue_safe_text_v1(p_work_id,256))
) THEN RETURN NEXT; RETURN; END IF;

 IF c IS NOT NULL THEN
  IF p_record_id IS NOT NULL OR p_work_id IS NOT NULL OR p_book_url IS NOT NULL OR p_cover_url IS NOT NULL
   OR pg_catalog.jsonb_typeof(c) IS DISTINCT FROM 'object' THEN RETURN NEXT; RETURN; END IF;
  IF NOT c ?& ARRAY['providerRole','primaryAdapterKey','predecessorOutcome','queryKind','rows','terminalReceipt','receipts']
   OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(c))<>7
   OR pg_catalog.jsonb_typeof(c->'rows') IS DISTINCT FROM 'array'
   OR pg_catalog.jsonb_typeof(c->'receipts') IS DISTINCT FROM 'array'
   OR pg_catalog.jsonb_array_length(c->'rows')>10
   OR pg_catalog.jsonb_typeof(c->'providerRole') IS DISTINCT FROM 'string'
   OR pg_catalog.jsonb_typeof(c->'primaryAdapterKey') IS DISTINCT FROM 'string'
   OR pg_catalog.jsonb_typeof(c->'queryKind') IS DISTINCT FROM 'string'
   OR c->>'queryKind' NOT IN('isbn','bibliographic','approved_strong_evidence')
   OR pg_catalog.jsonb_typeof(c->'terminalReceipt') IS DISTINCT FROM 'object'
  THEN RETURN NEXT; RETURN; END IF;
  terminal:=c->'terminalReceipt';
  IF terminal->>'status' IS DISTINCT FROM 'finalized' OR terminal->'retryable' IS DISTINCT FROM 'false'::jsonb
   OR terminal->'normalizedCandidate' IS DISTINCT FROM 'null'::jsonb
   OR terminal->'matchEvidence' IS DISTINCT FROM '[]'::jsonb
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(c->'receipts') r WHERE r=terminal)
  THEN RETURN NEXT; RETURN; END IF;
  FOR receipt IN SELECT value FROM pg_catalog.jsonb_array_elements(c->'receipts') LOOP
   IF pg_catalog.jsonb_typeof(receipt) IS DISTINCT FROM 'object' THEN RETURN NEXT; RETURN; END IF;
   IF NOT receipt ?& ARRAY['callSequence','callStage','status','egressStarted','retryable','normalizedOutcome',
     'logicalOutcome','normalizedCandidate','matchEvidence']
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(receipt))<>9
   THEN RETURN NEXT; RETURN; END IF;
  END LOOP;
 END IF;
 CASE p_adapter_key
 WHEN 'open_library' THEN
  IF c IS NOT NULL THEN
   IF NOT coalesce((c->>'providerRole'='primary' AND c->>'primaryAdapterKey'=p_adapter_key)
    OR (c->>'providerRole'='secondary' AND c->>'primaryAdapterKey'='google_books'
     AND c->>'predecessorOutcome' IN('no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
       'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open',
       'network_failure','response_too_large','unsupported_content_type')),false)
    OR pg_catalog.jsonb_array_length(c->'receipts') NOT BETWEEN 1 AND 6
   THEN RETURN NEXT; RETURN; END IF;
   FOR receipt IN SELECT value FROM pg_catalog.jsonb_array_elements(c->'receipts') LOOP
    IF pg_catalog.jsonb_typeof(receipt->'callSequence') IS DISTINCT FROM 'number'
     OR receipt->>'callSequence' !~ '^[0-5]$'
     OR pg_catalog.jsonb_typeof(receipt->'callStage') IS DISTINCT FROM 'string'
     OR receipt->>'status' IS DISTINCT FROM 'finalized'
     OR receipt->'egressStarted' IS DISTINCT FROM 'true'::jsonb
     OR receipt->'retryable' IS DISTINCT FROM 'false'::jsonb
     OR receipt->'normalizedCandidate' IS DISTINCT FROM 'null'::jsonb
     OR receipt->'matchEvidence' IS DISTINCT FROM '[]'::jsonb
    THEN RETURN NEXT; RETURN; END IF;
    seq:=(receipt->>'callSequence')::integer;
    IF seq=ANY(seen) OR NOT coalesce(
      (seq=0 AND receipt->>'callStage'='search')
      OR (seq=1 AND (receipt->>'callStage'='editions'
        OR (receipt->>'callStage'='edition' AND c->>'queryKind'='isbn')))
      OR (seq BETWEEN 2 AND 5 AND receipt->>'callStage' ~ '^author:OL[1-9][0-9]*A$'),false)
     OR NOT coalesce(receipt->>'normalizedOutcome'='no_acceptable_match'
       OR (seq BETWEEN 2 AND 5 AND receipt->>'callStage' ~ '^author:OL[1-9][0-9]*A$'
        AND receipt->>'normalizedOutcome' IN('malformed_response','unsupported_content_type','response_too_large')),false)
    THEN RETURN NEXT; RETURN; END IF;
    seen:=pg_catalog.array_append(seen,seq);
   END LOOP;
   IF NOT 0=ANY(seen) OR (pg_catalog.jsonb_array_length(c->'rows')>0 AND NOT 1=ANY(seen))
   THEN RETURN NEXT; RETURN; END IF;
   logical_outcome:=CASE WHEN EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(c->'rows') r
     WHERE r->>'eligibility'='eligible' AND r#>>'{metadata,matchRationale}'='exact_validated_isbn') THEN 'coherent_match'
    WHEN EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(c->'rows') r WHERE r->>'eligibility'='eligible') THEN 'ambiguous_match'
    ELSE 'no_acceptable_match' END;
   valid:=true; RETURN NEXT; RETURN;
  END IF;

  valid:=coalesce(p_record_id ~ '^OL[1-9][0-9]*M$'
    AND (p_work_id IS NULL OR p_work_id ~ '^OL[1-9][0-9]*W$')
    AND (p_book_url IS NULL OR p_book_url='https://openlibrary.org/books/'||p_record_id)
    AND (p_cover_url IS NULL OR p_cover_url ~ '^https://covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-M[.]jpg$'),false);
  IF valid AND p_cover_url IS NOT NULL THEN cover_ref:=pg_catalog.substring(p_cover_url,'/b/id/([1-9][0-9]*)-M[.]jpg$'); END IF;
 WHEN 'google_books' THEN
  IF c IS NOT NULL THEN
   valid:=coalesce(c->>'providerRole'='primary' AND c->>'primaryAdapterKey'=p_adapter_key
    AND terminal->>'logicalOutcome' IN('coherent_match','ambiguous_match','material_conflict','no_acceptable_match'),false);
   IF valid THEN logical_outcome:=terminal->>'logicalOutcome'; END IF;
   RETURN NEXT; RETURN;
  END IF;

  valid:=coalesce(pg_catalog.char_length(p_record_id) BETWEEN 1 AND 256 AND p_record_id ~ '^[A-Za-z0-9_-]+$'
    AND p_work_id IS NULL AND (p_book_url IS NULL OR (p_book_url ~ '^https://books[.]google[.]com/books[?]'
      AND pg_catalog.regexp_count(p_book_url,'[?&]id=')=1
      AND pg_catalog.substring(p_book_url,'[?&]id=([^&#]*)')=p_record_id))
    AND (p_cover_url IS NULL OR (p_cover_url ~ '^https://books[.]google[.]com/'
      AND pg_catalog.regexp_count(p_cover_url,'[?&]id=')<=1
      AND (pg_catalog.regexp_count(p_cover_url,'[?&]id=')=0
        OR pg_catalog.substring(p_cover_url,'[?&]id=([^&#]*)')=p_record_id))),false);
  IF valid AND p_cover_url IS NOT NULL THEN cover_ref:=pg_catalog.substring(p_cover_url,'[?&]id=([^&#]*)'); END IF;
 ELSE valid:=false;
 END CASE;
 RETURN NEXT;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

-- 02b sections 3.2/4.4: original chosen binding, never the newest lookup.
CREATE FUNCTION marketplace_sec.phase9_catalogue_companion_for_choice_v1(
 p_metadata jsonb,p_option_id uuid,p_candidate_id uuid,p_store_id uuid,p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT h.companion FROM marketplace_sec.phase9_catalogue_companions h
 JOIN public.phase9_metadata_lookups l ON l.id=h.lookup_id AND l.candidate_id=h.candidate_id AND l.store_id=h.store_id
 JOIN public.metadata_enrichment_attempts a ON a.id=h.attempt_id AND a.lookup_id=l.id
  AND a.candidate_id=h.candidate_id AND a.store_id=h.store_id
 JOIN public.image_extraction_candidates c ON c.id=h.candidate_id AND c.store_id=h.store_id AND c.session_id=h.session_id
 WHERE h.candidate_id=p_candidate_id AND h.store_id=p_store_id AND h.session_id=p_session_id
  AND h.lookup_id::text=p_metadata->>'correlationId' AND h.attempt_id::text=p_metadata->>'attemptId'
  AND h.provider_record_id=p_metadata->>'providerRecordId' AND h.option_id IS NOT DISTINCT FROM p_option_id
  AND h.metadata_digest=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_metadata::text,'UTF8')),'hex')
  AND a.adapter_key=p_metadata->>'adapterKey' AND a.adapter_version=p_metadata->>'adapterVersion'
  AND a.normalizer_version=p_metadata->>'normalizerVersion' AND l.normalizer_version=p_metadata->>'normalizerVersion'
$$;

ALTER FUNCTION marketplace_sec.phase9_catalogue_companion_for_choice_v1(jsonb,uuid,uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_companion_for_choice_v1(jsonb,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- 02b sections 6.2/7.2: caller locked this scoped receipt before shared identities.
-- A deleted work leaves true/NULL and can never reopen attribution.
CREATE FUNCTION marketplace_sec.phase9_catalogue_count_search_v1(
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_lookup_id uuid,p_work_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_work_id IS NULL THEN RETURN; END IF;
 UPDATE marketplace_sec.phase9_catalogue_lookup_effects e SET searched_work_id=p_work_id,search_counted=true
 WHERE e.lookup_id=p_lookup_id AND e.candidate_id=p_candidate_id AND e.store_id=p_store_id
  AND e.session_id=p_session_id AND NOT e.search_counted;
 IF FOUND THEN PERFORM marketplace_sec.phase9_catalogue_increment_v1(p_work_id,NULL,1,0,0); END IF;
END$$;

ALTER FUNCTION marketplace_sec.phase9_catalogue_count_search_v1(uuid,uuid,uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_count_search_v1(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- 3. Companion-aware resolver and carried fixes AC7-30/32/33.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(
 p_metadata jsonb,p_companion jsonb,p_source_policy jsonb)
RETURNS TABLE(canonical_work_id uuid,canonical_edition_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $resolve$
DECLARE
 m jsonb:=p_metadata; v_adapter text; v_record text; v_work_external text;
 v_source_work_external text; v_title text; v_authors text[]; v_isbn10 text; v_isbn13 text;
 v_fetched timestamptz; v_oclc text; v_lccn text; v_cover_ref text; v_valid boolean;
 v_hit13 uuid; v_hit10 uuid; v_hit_provider uuid; v_work_tuple uuid; v_work_key uuid;
 v_target uuid; v_work_id uuid; v_proposed uuid; v_insert_work uuid; v_planned uuid[];
 v_keys bigint[]; v_key bigint; v_ids uuid[]; v_n integer; v_message text; v_constraint text;
 v_edition public.canonical_editions; v_work public.canonical_works;
 v_source public.book_metadata_sources; v_payload jsonb;
BEGIN
 canonical_work_id:=NULL; canonical_edition_id:=NULL;
 -- section 5 Owner contract: programming errors propagate even for a denied policy.
 IF NOT coalesce(marketplace_sec.phase9_catalogue_source_policy_valid_v1(p_source_policy),false)
  OR p_source_policy->>'adapterKey' IS DISTINCT FROM m->>'adapterKey'
  OR p_source_policy->>'adapterVersion' IS DISTINCT FROM m->>'adapterVersion'
 THEN RAISE EXCEPTION 'P9_CATALOGUE_SOURCE_POLICY_INVALID'; END IF;
 -- 02b sections 3/6: validate the exact companion binding before shared writes.
 IF p_companion IS NOT NULL THEN
  IF NOT coalesce(marketplace_sec.phase9_catalogue_valid_companion_v1(p_companion,m,
    CASE WHEN p_companion->>'optionId' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      THEN (p_companion->>'optionId')::uuid ELSE NULL END),false)
  THEN RETURN NEXT; RETURN; END IF;
  v_work_external:=p_companion->>'workExternalId';
  v_oclc:=p_companion->>'oclc'; v_lccn:=p_companion->>'lccn';
 END IF;
 IF NOT (p_source_policy->>'sharedAdmitted')::boolean THEN RETURN NEXT; RETURN; END IF;
 -- The worker validator has a temporary provider allow-list. This core validates
 -- generic shape below admission, then delegates own IDs/cover to its one validator.
 IF NOT coalesce(marketplace_sec.phase9_edition_valid_metadata(
    pg_catalog.jsonb_set(m,'{coverReference}','null'::jsonb),false),false)
  OR NOT m ?& ARRAY['contractVersion','schemaVersion','adapterKey','adapterVersion',
    'normalizerVersion','correlationId','attemptId','providerRecordId','fetchedAt','matchRationale','confidence']
  OR m->>'contractVersion' IS DISTINCT FROM 'p9-contract-v1'
  OR m->>'schemaVersion' IS DISTINCT FROM 'p9-metadata-v1'
  OR coalesce(m->>'adapterKey','') !~ '^[a-z][a-z0-9_-]{1,63}$'
  OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(m->>'adapterVersion',128)
  OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(m->>'normalizerVersion',128)
  OR coalesce(m->>'correlationId','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  OR coalesce(m->>'attemptId','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  OR coalesce(m->>'fetchedAt','') !~ ('^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T'
    ||'([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$')
 THEN RETURN NEXT; RETURN; END IF;
 -- Preserve M68's UTF-16 bounds without its worker-provider allow-list.
 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_each_text('{"title":512,"subtitle":512,"description":5000,
   "publisher":256,"publishedDate":32,"language":35,"script":16,"editionStatement":256,"series":256,
   "volume":64,"format":128,"isbn10":32,"isbn13":32,"coverReference":512,"contractVersion":64,
   "schemaVersion":64,"adapterKey":64,"adapterVersion":64,"normalizerVersion":64,"correlationId":128,
   "attemptId":128,"providerRecordId":256,"fetchedAt":40,"matchRationale":512}'::jsonb) bounds
   WHERE marketplace_sec.phase9_edition_utf16_length(m->>bounds.key)>bounds.value::integer)
  OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements_text(m->'authors') au
   WHERE marketplace_sec.phase9_edition_utf16_length(au)>256)
  OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements_text(m->'categories') category
   WHERE marketplace_sec.phase9_edition_utf16_length(category)>128)
 THEN RETURN NEXT; RETURN; END IF;
 BEGIN v_fetched:=(m->>'fetchedAt')::timestamptz;
 EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN NEXT; RETURN; END;
 v_adapter:=m->>'adapterKey'; v_record:=m->>'providerRecordId';
 SELECT i.isbn10,i.isbn13,i.admitted INTO v_isbn10,v_isbn13,v_valid
  FROM marketplace_sec.phase9_catalogue_isbn_v1(m->>'isbn10',m->>'isbn13') i;
 IF NOT coalesce(v_valid,false) THEN RETURN NEXT; RETURN; END IF;
 v_title:=pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(m->>'title'));
 v_authors:=marketplace_sec.phase9_catalogue_normalized_authors_v1(
  ARRAY(SELECT pg_catalog.jsonb_array_elements_text(m->'authors')));
 IF v_title='' OR pg_catalog.cardinality(v_authors)=0 OR ''=ANY(v_authors)
 THEN RETURN NEXT; RETURN; END IF;
 SELECT * INTO v_source FROM public.book_metadata_sources s
  WHERE s.provider=v_adapter AND s.provider_book_id=v_record;
 -- Existing source proof is also an identity key when a work tuple is in flight.
 IF v_source.normalized_payload->>'version'='psr-catalogue-facts-v1'
  AND v_source.adapter_key=v_adapter AND v_source.normalized_payload->>'adapterKey'=v_adapter
  AND v_source.normalized_payload->>'providerRecordId'=v_record
 THEN v_source_work_external:=v_source.normalized_payload->>'workExternalId'; END IF;
 SELECT checked.valid,checked.cover_ref INTO v_valid,v_cover_ref
  FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(v_adapter,v_record,
    coalesce(v_work_external,v_source_work_external),NULL,m->>'coverReference',NULL) checked;
 IF NOT coalesce(v_valid,false) THEN RETURN NEXT; RETURN; END IF;
 BEGIN
  IF v_work_external IS NOT NULL AND v_source_work_external IS NOT NULL
   AND v_work_external<>v_source_work_external THEN RAISE SQLSTATE 'P9C01'; END IF;
  -- section 6.2: discover every prospective work without row locks; freeze the key set.
  SELECT ARRAY(SELECT DISTINCT w.id FROM public.canonical_works w WHERE w.id IN(
    SELECT e.work_id FROM public.canonical_editions e WHERE e.isbn_13=v_isbn13 OR e.isbn_10=v_isbn10
      OR e.id=v_source.canonical_edition_id OR e.id IN(SELECT p.canonical_edition_id
        FROM public.canonical_provider_ids p WHERE p.adapter_key=v_adapter AND p.id_kind='edition'
          AND p.external_id=v_record)) OR w.id IN(SELECT p.canonical_work_id
    FROM public.canonical_provider_ids p WHERE p.adapter_key=v_adapter AND p.id_kind='work'
      AND p.external_id=coalesce(v_work_external,v_source_work_external))
    OR (pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
      coalesce(w.title_normalized,w.primary_title)))=v_title
      AND marketplace_sec.phase9_catalogue_normalized_authors_v1(w.primary_authors)=v_authors)) INTO v_planned;
  SELECT ARRAY(SELECT DISTINCT k FROM (
    SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('work',
      pg_catalog.jsonb_build_array(v_title,v_authors)) k
    UNION ALL SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('isbn13',
      pg_catalog.jsonb_build_array(v_isbn13)) WHERE v_isbn13 IS NOT NULL
    UNION ALL SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('isbn10',
      pg_catalog.jsonb_build_array(v_isbn10)) WHERE v_isbn10 IS NOT NULL
    UNION ALL SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
      pg_catalog.jsonb_build_array(v_adapter,'edition',v_record))
    UNION ALL SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
      pg_catalog.jsonb_build_array(v_adapter,'work',coalesce(v_work_external,v_source_work_external)))
      WHERE coalesce(v_work_external,v_source_work_external) IS NOT NULL
    UNION ALL SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('work',
      pg_catalog.jsonb_build_array(pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
        coalesce(w.title_normalized,w.primary_title))),
        marketplace_sec.phase9_catalogue_normalized_authors_v1(w.primary_authors)))
      FROM public.canonical_works w WHERE w.id=ANY(v_planned)) identity_keys ORDER BY k) INTO v_keys;
  IF pg_catalog.array_position(v_keys,NULL::bigint) IS NOT NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
  FOREACH v_key IN ARRAY v_keys LOOP PERFORM pg_catalog.pg_advisory_xact_lock(v_key); END LOOP;
  SELECT e.id INTO v_hit13 FROM public.canonical_editions e WHERE e.isbn_13=v_isbn13;
  SELECT e.id INTO v_hit10 FROM public.canonical_editions e WHERE e.isbn_10=v_isbn10;
  SELECT p.canonical_edition_id INTO v_hit_provider FROM public.canonical_provider_ids p
   WHERE p.adapter_key=v_adapter AND p.id_kind='edition' AND p.external_id=v_record;
  SELECT p.canonical_work_id INTO v_work_tuple FROM public.canonical_provider_ids p
   WHERE p.adapter_key=v_adapter AND p.id_kind='work'
     AND p.external_id=coalesce(v_work_external,v_source_work_external);
  SELECT pg_catalog.array_agg(w.id ORDER BY w.id) INTO v_ids FROM public.canonical_works w
   WHERE pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
     coalesce(w.title_normalized,w.primary_title)))=v_title
     AND marketplace_sec.phase9_catalogue_normalized_authors_v1(w.primary_authors)=v_authors;
  IF pg_catalog.cardinality(v_ids)>1 THEN RAISE SQLSTATE 'P9C01'; END IF;
  v_work_key:=v_ids[1];
  SELECT pg_catalog.array_agg(DISTINCT id),pg_catalog.count(DISTINCT id)::integer INTO v_ids,v_n
   FROM pg_catalog.unnest(ARRAY[v_hit13,v_hit10,v_hit_provider]) id WHERE id IS NOT NULL;
  IF v_n>1 THEN
   -- 02a section 7.2 / 02b section 6: every conflicting hit is locked in the same order.
   PERFORM w.id FROM public.canonical_works w WHERE w.id IN(
     SELECT e.work_id FROM public.canonical_editions e WHERE e.id=ANY(v_ids))
     OR w.id=ANY(ARRAY[v_work_tuple,v_work_key]) ORDER BY w.id FOR KEY SHARE;
   PERFORM e.id FROM public.canonical_editions e WHERE e.id=ANY(v_ids) ORDER BY e.id FOR SHARE;
   RAISE SQLSTATE 'P9C01';
  END IF;
  v_target:=v_ids[1];
  IF v_target IS NOT NULL THEN
   SELECT e.work_id INTO v_work_id FROM public.canonical_editions e WHERE e.id=v_target;
   IF v_work_id IS NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
  ELSE v_work_id:=coalesce(v_work_tuple,v_work_key); END IF;
  IF (v_work_tuple IS NOT NULL AND v_work_id<>v_work_tuple)
   OR (v_work_key IS NOT NULL AND v_work_id<>v_work_key) THEN RAISE SQLSTATE 'P9C01'; END IF;
  IF v_work_id IS NULL THEN
   INSERT INTO public.canonical_works(id,title_normalized,primary_title,primary_authors,language,normalizer_version)
    VALUES(pg_catalog.gen_random_uuid(),v_title,m->>'title',v_authors,m->>'language',m->>'normalizerVersion')
    ON CONFLICT DO NOTHING;
   SELECT w.id INTO v_work_id FROM public.canonical_works w
    WHERE w.title_normalized=v_title AND w.primary_authors=v_authors;
   IF v_work_id IS NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
   v_insert_work:=v_work_id;
  END IF;
  -- Changed mappings cannot introduce a smaller, unplanned advisory key.
  SELECT * INTO v_work FROM public.canonical_works w WHERE w.id=v_work_id;
  IF v_work.id IS NULL OR NOT marketplace_sec.phase9_catalogue_identity_lock_key_v1('work',
    pg_catalog.jsonb_build_array(pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
      coalesce(v_work.title_normalized,v_work.primary_title))),
      marketplace_sec.phase9_catalogue_normalized_authors_v1(v_work.primary_authors)))=ANY(v_keys)
  THEN RAISE SQLSTATE 'P9C01'; END IF;
  PERFORM w.id FROM public.canonical_works w WHERE w.id=ANY(
    ARRAY[v_work_id,v_work_tuple,v_work_key]) ORDER BY w.id FOR KEY SHARE;
  SELECT * INTO v_work FROM public.canonical_works w WHERE w.id=v_work_id;
  IF v_target IS NULL THEN
   v_proposed:=pg_catalog.gen_random_uuid();
   INSERT INTO public.canonical_editions(id,work_id,isbn_10,isbn_13,title,subtitle,authors,
    publisher,published_date,language,description,edition_statement,volume,format,page_count,categories,
    cover_url,metadata_verified_at,metadata_selection_version,oclc,lccn,source_retention_note,normalizer_version)
   VALUES(v_proposed,v_work_id,v_isbn10,v_isbn13,m->>'title',m->>'subtitle',
    ARRAY(SELECT pg_catalog.jsonb_array_elements_text(m->'authors')),m->>'publisher',m->>'publishedDate',
    m->>'language',m->>'description',m->>'editionStatement',m->>'volume',m->>'format',
    (m->>'pageCount')::numeric::integer,ARRAY(SELECT pg_catalog.jsonb_array_elements_text(m->'categories')),
    m->>'coverReference',v_fetched,CASE WHEN v_isbn13 IS NULL THEN 'psr-catalogue-provider-id-v1'
      ELSE 'psr-catalogue-isbn-v1' END,v_oclc,v_lccn,p_source_policy->>'sharedSourceNote',m->>'normalizerVersion')
    ON CONFLICT DO NOTHING;
  END IF;
  -- section 6.1: uniqueness waits are followed by fresh statements, never RETURNING guesses.
  SELECT e.id INTO v_hit13 FROM public.canonical_editions e WHERE e.isbn_13=v_isbn13;
  SELECT e.id INTO v_hit10 FROM public.canonical_editions e WHERE e.isbn_10=v_isbn10;
  SELECT p.canonical_edition_id INTO v_hit_provider FROM public.canonical_provider_ids p
   WHERE p.adapter_key=v_adapter AND p.id_kind='edition' AND p.external_id=v_record;
  SELECT pg_catalog.array_agg(DISTINCT id),pg_catalog.count(DISTINCT id)::integer INTO v_ids,v_n
   FROM pg_catalog.unnest(ARRAY[v_hit13,v_hit10,v_hit_provider,
    CASE WHEN v_isbn13 IS NULL AND v_target IS NULL THEN v_proposed ELSE NULL END]) id WHERE id IS NOT NULL;
  IF v_n<>1 THEN RAISE SQLSTATE 'P9C01'; END IF;
  v_target:=v_ids[1];
  -- section 6.2/OQ1: a privileged edition winner appearing after an incumbent-work
  -- plan is an unplanned mapping. Preserve the atomic skip, without merging.
  IF v_proposed IS NOT NULL AND v_target<>v_proposed AND v_insert_work IS NULL
  THEN RAISE SQLSTATE 'P9C01'; END IF;
  PERFORM e.id FROM public.canonical_editions e WHERE e.id=ANY(v_ids) ORDER BY e.id FOR SHARE;
  SELECT * INTO v_edition FROM public.canonical_editions e WHERE e.id=v_target;
  -- A source's own work reference has the same tuple authority as an incoming
  -- reference. Insert/reselect it under the planned identity and target locks
  -- before testing translation coherence; never treat a proposed tuple as saved.
  IF coalesce(v_work_external,v_source_work_external) IS NOT NULL THEN
   INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_work_id)
    VALUES(v_adapter,'work',coalesce(v_work_external,v_source_work_external),v_work_id) ON CONFLICT DO NOTHING;
   SELECT p.canonical_work_id INTO v_work_tuple FROM public.canonical_provider_ids p
    WHERE p.adapter_key=v_adapter AND p.id_kind='work'
      AND p.external_id=coalesce(v_work_external,v_source_work_external);
   IF v_work_tuple IS DISTINCT FROM v_work_id THEN RAISE SQLSTATE 'P9C01'; END IF;
  END IF;
  IF NOT marketplace_sec.phase9_catalogue_pair_matches_v1(v_edition,v_work,v_title,v_authors,
    v_isbn13,v_work_tuple,v_adapter,v_record) OR (v_insert_work IS NOT NULL AND v_edition.work_id<>v_insert_work)
  THEN RAISE SQLSTATE 'P9C01'; END IF;
  INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_edition_id)
   VALUES(v_adapter,'edition',v_record,v_target) ON CONFLICT DO NOTHING;
  v_payload:=pg_catalog.jsonb_build_object('version','psr-catalogue-facts-v1','adapterKey',v_adapter,
   'adapterVersion',m->'adapterVersion','schemaVersion',m->'schemaVersion','normalizerVersion',m->'normalizerVersion',
   'providerRecordId',v_record,'workExternalId',coalesce(v_work_external,v_source_work_external),'fetchedAt',m->'fetchedAt',
   'title',m->'title','subtitle',m->'subtitle','authors',m->'authors','publisher',m->'publisher',
   'publishedDate',m->'publishedDate','language',m->'language','script',m->'script','isbn10',v_isbn10,
   'isbn13',v_isbn13,'pageCount',m->'pageCount','categories',m->'categories','description',m->'description',
   'editionStatement',m->'editionStatement','volume',m->'volume','format',m->'format','series',m->'series',
   'oclc',v_oclc,'lccn',v_lccn,'coverRef',v_cover_ref,'coverReference',m->'coverReference',
   'sourceRetentionNote',p_source_policy->'sharedSourceNote');
  INSERT INTO public.book_metadata_sources(id,canonical_edition_id,source_book_id,provider,provider_book_id,
   adapter_key,adapter_version,schema_version,reuse_policy_version,fetched_at,request_status,
   raw_payload,normalized_payload,confidence,match_strength,match_rationale,raw_delete_after,expires_at)
  VALUES(pg_catalog.gen_random_uuid(),v_target,NULL,v_adapter,v_record,v_adapter,m->>'adapterVersion',
   m->>'schemaVersion',(p_source_policy->>'policyVersion')::integer,v_fetched,'completed','{}'::jsonb,v_payload,
   NULL,NULL,NULL,v_fetched+(p_source_policy->>'rawRetentionSeconds')::integer*INTERVAL '1 second',
   v_fetched+(p_source_policy->>'revalidationSeconds')::integer*INTERVAL '1 second') ON CONFLICT DO NOTHING;
  SELECT p.canonical_edition_id INTO v_hit_provider FROM public.canonical_provider_ids p
   WHERE p.adapter_key=v_adapter AND p.id_kind='edition' AND p.external_id=v_record;
  SELECT p.canonical_work_id INTO v_work_tuple FROM public.canonical_provider_ids p
   WHERE p.adapter_key=v_adapter AND p.id_kind='work'
     AND p.external_id=coalesce(v_work_external,v_source_work_external);
  SELECT * INTO v_source FROM public.book_metadata_sources s
   WHERE s.provider=v_adapter AND s.provider_book_id=v_record;
  IF v_hit_provider IS DISTINCT FROM v_target OR v_source.id IS NULL
   OR v_source.canonical_edition_id IS DISTINCT FROM v_target OR v_source.adapter_key IS DISTINCT FROM v_adapter
   OR (coalesce(v_work_external,v_source_work_external) IS NOT NULL AND v_work_tuple IS DISTINCT FROM v_work_id)
   OR (v_source.normalized_payload->>'providerRecordId' IS NOT NULL
     AND v_source.normalized_payload->>'providerRecordId'<>v_record)
   OR (v_work_external IS NOT NULL AND v_source.normalized_payload->>'workExternalId' IS NOT NULL
     AND v_source.normalized_payload->>'workExternalId'<>v_work_external)
  THEN RAISE SQLSTATE 'P9C01'; END IF;
  canonical_work_id:=v_work_id; canonical_edition_id:=v_target;
 EXCEPTION
  WHEN SQLSTATE 'P9C01' THEN canonical_work_id:=NULL; canonical_edition_id:=NULL;
  WHEN program_limit_exceeded THEN
   GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
   IF v_message NOT LIKE 'index row size%' OR v_message !~
    'for index "(canonical_works_title_normalized_primary_authors_key|canonical_editions_isbn_10_unique|canonical_editions_isbn_13_unique|idx_canonical_editions_title_authors)"$'
   THEN RAISE; END IF;
   canonical_work_id:=NULL; canonical_edition_id:=NULL;
  WHEN unique_violation THEN
   GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
   IF v_constraint IS NULL OR v_constraint NOT IN('canonical_works_title_normalized_primary_authors_key',
     'canonical_editions_isbn_10_unique','canonical_editions_isbn_13_unique') THEN RAISE; END IF;
   canonical_work_id:=NULL; canonical_edition_id:=NULL;
   -- 02a section 7.2: fresh read-only recovery; no insertion is retried after rollback.
   BEGIN
    IF pg_catalog.array_position(v_keys,NULL::bigint) IS NOT NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
    FOREACH v_key IN ARRAY v_keys LOOP PERFORM pg_catalog.pg_advisory_xact_lock(v_key); END LOOP;
    SELECT e.id INTO v_hit13 FROM public.canonical_editions e WHERE e.isbn_13=v_isbn13;
    SELECT e.id INTO v_hit10 FROM public.canonical_editions e WHERE e.isbn_10=v_isbn10;
    SELECT p.canonical_edition_id INTO v_hit_provider FROM public.canonical_provider_ids p
     WHERE p.adapter_key=v_adapter AND p.id_kind='edition' AND p.external_id=v_record;
    v_target:=coalesce(v_hit13,v_hit10,v_hit_provider);
    IF v_target IS NULL OR (v_hit13 IS NOT NULL AND v_hit13<>v_target)
     OR (v_hit10 IS NOT NULL AND v_hit10<>v_target) OR v_hit_provider IS DISTINCT FROM v_target
    THEN RAISE SQLSTATE 'P9C01'; END IF;
    SELECT e.work_id INTO v_work_id FROM public.canonical_editions e WHERE e.id=v_target;
    SELECT * INTO v_work FROM public.canonical_works w WHERE w.id=v_work_id FOR KEY SHARE;
    SELECT * INTO v_edition FROM public.canonical_editions e WHERE e.id=v_target FOR SHARE;
    SELECT p.canonical_work_id INTO v_work_tuple FROM public.canonical_provider_ids p
     WHERE p.adapter_key=v_adapter AND p.id_kind='work'
       AND p.external_id=coalesce(v_work_external,v_source_work_external);
    SELECT * INTO v_source FROM public.book_metadata_sources s
     WHERE s.provider=v_adapter AND s.provider_book_id=v_record;
    IF NOT marketplace_sec.phase9_catalogue_pair_matches_v1(v_edition,v_work,v_title,v_authors,
      v_isbn13,v_work_tuple,v_adapter,v_record)
     OR v_source.canonical_edition_id IS DISTINCT FROM v_target OR v_source.adapter_key IS DISTINCT FROM v_adapter
     OR (coalesce(v_work_external,v_source_work_external) IS NOT NULL AND v_work_tuple IS DISTINCT FROM v_work.id)
     OR EXISTS(SELECT 1 FROM public.canonical_works w WHERE w.id<>v_work.id
       AND pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
         coalesce(w.title_normalized,w.primary_title)))=v_title
       AND marketplace_sec.phase9_catalogue_normalized_authors_v1(w.primary_authors)=v_authors)
    THEN RAISE SQLSTATE 'P9C01'; END IF;
    canonical_work_id:=v_work.id; canonical_edition_id:=v_edition.id;
   EXCEPTION WHEN SQLSTATE 'P9C01' THEN canonical_work_id:=NULL; canonical_edition_id:=NULL; END;
 END;
 RETURN NEXT;
END
$resolve$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_choice_target_v1(
 p_metadata jsonb,p_hint uuid,p_adapter_key text,p_record_id text)
RETURNS TABLE(canonical_work_id uuid,canonical_edition_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE m jsonb:=p_metadata; e public.canonical_editions; w public.canonical_works;
  v_isbn record; v_existing_isbn record; v_title text; v_authors text[];
  v_hits uuid[]; v_after uuid[]; v_work_id uuid; v_provider text; v_record text;
  v_policy jsonb; v_source public.book_metadata_sources; v_work_ref text; v_provider_valid boolean;
  v_keys bigint[]:=ARRAY[]::bigint[]; v_key bigint; v_id record;
BEGIN
  canonical_work_id:=NULL; canonical_edition_id:=NULL;
  IF NOT coalesce(marketplace_sec.phase9_edition_valid_metadata(m),false)
  THEN RETURN NEXT; RETURN; END IF;
  SELECT * INTO v_isbn FROM marketplace_sec.phase9_catalogue_isbn_v1(m->>'isbn10',m->>'isbn13');
  IF NOT v_isbn.admitted THEN RETURN NEXT; RETURN; END IF;
  v_title:=pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(m->>'title'));
  v_authors:=marketplace_sec.phase9_catalogue_normalized_authors_v1(
    ARRAY(SELECT pg_catalog.jsonb_array_elements_text(m->'authors')));
  IF v_title='' OR pg_catalog.cardinality(v_authors)=0 OR ''=ANY(v_authors)
  THEN RETURN NEXT; RETURN; END IF;
  v_provider:=p_adapter_key; v_record:=p_record_id;
  -- section section 5/7.2: no-hint attribution needs the same shared admission as Add.
  IF v_provider IS NOT NULL THEN v_policy:=marketplace_sec.phase9_catalogue_source_policy_v1(v_provider); END IF;
  IF p_hint IS NULL AND (v_provider IS NULL OR v_record IS NULL OR v_policy IS NULL
    OR NOT (v_policy->>'sharedAdmitted')::boolean)
  THEN RETURN NEXT; RETURN; END IF;
  IF v_provider IS NOT NULL AND v_record IS NOT NULL THEN
    SELECT ids.valid INTO v_provider_valid FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
      v_provider,v_record,NULL,NULL,CASE WHEN p_hint IS NULL THEN m->>'coverReference' ELSE NULL END,NULL) ids;
    IF NOT coalesce(v_provider_valid,false) THEN RETURN NEXT; RETURN; END IF;
    SELECT * INTO v_source FROM public.book_metadata_sources source
      WHERE source.provider=v_provider AND source.provider_book_id=v_record;
    IF v_source.id IS NOT NULL THEN v_work_ref:=v_source.normalized_payload->>'workExternalId'; END IF;
    IF v_work_ref IS NOT NULL THEN
      SELECT ids.valid INTO v_provider_valid FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
        v_provider,v_record,v_work_ref,NULL,CASE WHEN p_hint IS NULL THEN m->>'coverReference' ELSE NULL END,NULL) ids;
      IF NOT coalesce(v_provider_valid,false) THEN RETURN NEXT; RETURN; END IF;
    END IF;
  END IF;
  SELECT pg_catalog.array_agg(DISTINCT hit ORDER BY hit) INTO v_hits FROM (
    SELECT edition.id AS hit FROM public.canonical_editions edition
      WHERE edition.id=p_hint OR edition.isbn_13=v_isbn.isbn13 OR edition.isbn_10=v_isbn.isbn10
    UNION SELECT ids.canonical_edition_id FROM public.canonical_provider_ids ids
      WHERE ids.adapter_key=v_provider AND ids.id_kind='edition' AND ids.external_id=v_record
  ) targets;
  IF pg_catalog.cardinality(v_hits) IS DISTINCT FROM 1 THEN RETURN NEXT; RETURN; END IF;
  SELECT * INTO e FROM public.canonical_editions edition WHERE edition.id=v_hits[1];
  v_work_id:=e.work_id;
  SELECT * INTO w FROM public.canonical_works work WHERE work.id=v_work_id;
  IF w.id IS NULL THEN RETURN NEXT; RETURN; END IF;
  v_keys:=pg_catalog.array_append(v_keys,marketplace_sec.phase9_catalogue_identity_lock_key_v1(
    'work',pg_catalog.jsonb_build_array(v_title,v_authors)));
  v_keys:=pg_catalog.array_append(v_keys,marketplace_sec.phase9_catalogue_identity_lock_key_v1('work',
    pg_catalog.jsonb_build_array(pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
      coalesce(w.title_normalized,w.primary_title))),marketplace_sec.phase9_catalogue_normalized_authors_v1(w.primary_authors))));
  IF v_isbn.isbn13 IS NOT NULL THEN v_keys:=pg_catalog.array_append(v_keys,
    marketplace_sec.phase9_catalogue_identity_lock_key_v1('isbn13',pg_catalog.jsonb_build_array(v_isbn.isbn13))); END IF;
  IF v_isbn.isbn10 IS NOT NULL THEN v_keys:=pg_catalog.array_append(v_keys,
    marketplace_sec.phase9_catalogue_identity_lock_key_v1('isbn10',pg_catalog.jsonb_build_array(v_isbn.isbn10))); END IF;
  IF v_provider IS NOT NULL AND v_record IS NOT NULL THEN
    v_keys:=pg_catalog.array_append(v_keys,marketplace_sec.phase9_catalogue_identity_lock_key_v1(
      'provider',pg_catalog.jsonb_build_array(v_provider,'edition',v_record)));
    IF v_work_ref IS NOT NULL THEN v_keys:=pg_catalog.array_append(v_keys,
      marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
        pg_catalog.jsonb_build_array(v_provider,'work',v_work_ref))); END IF;
  END IF;
  FOR v_id IN SELECT ids.adapter_key,ids.id_kind,ids.external_id FROM public.canonical_provider_ids ids
    WHERE ids.canonical_edition_id=e.id OR ids.canonical_work_id=w.id
  LOOP
    v_keys:=pg_catalog.array_append(v_keys,marketplace_sec.phase9_catalogue_identity_lock_key_v1(
      'provider',pg_catalog.jsonb_build_array(v_id.adapter_key,v_id.id_kind,v_id.external_id)));
  END LOOP;
  BEGIN
  IF pg_catalog.array_position(v_keys,NULL::bigint) IS NOT NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
  FOR v_key IN SELECT DISTINCT key FROM pg_catalog.unnest(v_keys) keys(key) ORDER BY key
  LOOP PERFORM pg_catalog.pg_advisory_xact_lock(v_key); END LOOP;
  SELECT * INTO w FROM public.canonical_works work WHERE work.id=v_work_id FOR KEY SHARE;
  SELECT * INTO e FROM public.canonical_editions edition WHERE edition.id=v_hits[1] FOR SHARE;
  SELECT pg_catalog.array_agg(DISTINCT hit ORDER BY hit) INTO v_after FROM (
    SELECT edition.id AS hit FROM public.canonical_editions edition
      WHERE edition.id=p_hint OR edition.isbn_13=v_isbn.isbn13 OR edition.isbn_10=v_isbn.isbn10
    UNION SELECT ids.canonical_edition_id FROM public.canonical_provider_ids ids
      WHERE ids.adapter_key=v_provider AND ids.id_kind='edition' AND ids.external_id=v_record
  ) targets;
  SELECT * INTO v_existing_isbn FROM marketplace_sec.phase9_catalogue_isbn_v1(e.isbn_10,e.isbn_13);
  IF e.id IS NULL OR w.id IS NULL OR e.work_id IS DISTINCT FROM w.id OR v_after IS DISTINCT FROM v_hits
    OR NOT v_existing_isbn.admitted
    OR (v_existing_isbn.isbn13 IS NOT NULL AND v_isbn.isbn13 IS NOT NULL
      AND v_existing_isbn.isbn13 IS DISTINCT FROM v_isbn.isbn13)
    OR pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(e.title)) IS DISTINCT FROM v_title
    OR marketplace_sec.phase9_catalogue_normalized_authors_v1(e.authors) IS DISTINCT FROM v_authors
    OR ((pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(coalesce(w.title_normalized,w.primary_title)))
        IS DISTINCT FROM v_title OR marketplace_sec.phase9_catalogue_normalized_authors_v1(w.primary_authors)
        IS DISTINCT FROM v_authors) AND NOT marketplace_sec.phase9_catalogue_work_proof_v1(e.id,w.id,v_provider,v_record))
    OR EXISTS(SELECT 1 FROM public.canonical_works competing WHERE competing.id<>w.id
      AND pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
        coalesce(competing.title_normalized,competing.primary_title)))=v_title
      AND marketplace_sec.phase9_catalogue_normalized_authors_v1(competing.primary_authors)=v_authors)
    OR EXISTS(SELECT 1 FROM public.book_metadata_sources source WHERE source.provider=v_provider
      AND source.provider_book_id=v_record AND (source.adapter_key IS DISTINCT FROM v_provider
        OR source.canonical_edition_id IS DISTINCT FROM e.id))
    OR (v_work_ref IS NOT NULL AND EXISTS(SELECT 1 FROM public.canonical_provider_ids ids
      WHERE ids.adapter_key=v_provider AND ids.id_kind='work' AND ids.external_id=v_work_ref
        AND ids.canonical_work_id IS DISTINCT FROM w.id))
  THEN RETURN NEXT; RETURN; END IF;
  canonical_work_id:=w.id; canonical_edition_id:=e.id; RETURN NEXT; RETURN;
  EXCEPTION WHEN SQLSTATE 'P9C01' THEN canonical_work_id:=NULL; canonical_edition_id:=NULL; END;
  RETURN NEXT;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_choice_target_v1(jsonb,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_choice_target_v1(jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;

-- AC7-29/31 and original-companion/searched hooks (02b sections 3/6/7).
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(
  p_candidate_id uuid,p_session_id uuid,p_store_id uuid
) RETURNS TABLE(canonical_work_id uuid,canonical_edition_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $catalogue$
DECLARE
  c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
  x public.phase9_selected_metadata_snapshots; l public.phase9_metadata_lookups;
  a public.metadata_enrichment_attempts; v_policy jsonb; v_companion jsonb;
  v_work public.canonical_works; v_edition public.canonical_editions;
  m jsonb; v_reference jsonb; v_proof_reference jsonb; v_choice jsonb; v_hint uuid; v_work_id uuid;
  v_lookup uuid; v_attempt uuid; v_query text; v_title text; v_authors text[];
  v_isbn10 text; v_isbn13 text; v_from10 text; v_hit10 uuid; v_hit13 uuid;
  v_insert_work uuid; v_resolved_edition uuid; v_count integer; v_constraint text;
  v_message text; v_isbn record; v_existing_isbn record;
  v_keys bigint[]:=ARRAY[]::bigint[]; v_key bigint; v_id record; v_provider_valid boolean;
  v_identity_conflict boolean:=false;
BEGIN
  canonical_work_id:=NULL; canonical_edition_id:=NULL;
  SELECT * INTO c FROM public.image_extraction_candidates candidate
    WHERE candidate.id=p_candidate_id AND candidate.session_id=p_session_id AND candidate.store_id=p_store_id;
  IF c.id IS NULL THEN RETURN NEXT; RETURN; END IF;
  v_choice:=c.owner_review_snapshot#>'{value,metadataChoice}';
  IF v_choice->>'mode'='edition_option' THEN
    SELECT * INTO s FROM public.phase9_candidate_edition_state state
      WHERE state.candidate_id=c.id AND state.session_id=p_session_id AND state.store_id=p_store_id FOR UPDATE;
    IF s.selection_id IS NULL OR s.selection_id::text IS DISTINCT FROM v_choice->>'selectionId'
      OR s.query_identity IS DISTINCT FROM marketplace_sec.phase9_edition_query_identity(c)
      OR NOT coalesce(marketplace_sec.phase9_edition_saved_choice_valid(c,c.owner_review_snapshot->'value'),false)
    THEN RETURN NEXT; RETURN; END IF;
    m:=s.selected_option_snapshot; v_query:=s.query_identity;
    IF s.selected_source='current_suggestion' THEN
      SELECT * INTO x FROM public.phase9_selected_metadata_snapshots snapshot
        WHERE snapshot.id=s.selected_source_id AND snapshot.candidate_id=c.id AND snapshot.store_id=p_store_id;
      IF x.id IS NULL THEN RETURN NEXT; RETURN; END IF;
      v_hint:=x.canonical_edition_id;
    ELSIF s.selected_source IS DISTINCT FROM 'edition_option' THEN RETURN NEXT; RETURN;
    END IF;
  ELSIF v_choice->>'mode'='selected' THEN
    SELECT * INTO x FROM public.phase9_selected_metadata_snapshots snapshot
      WHERE snapshot.id=c.selected_metadata_snapshot_id AND snapshot.id::text=v_choice->>'selectionId'
        AND snapshot.candidate_id=c.id AND snapshot.store_id=p_store_id;
    IF x.id IS NULL THEN RETURN NEXT; RETURN; END IF;
    m:=x.coherent_edition; v_hint:=x.canonical_edition_id;
    -- section 6 confirmed by M73 register_structural_metadata_lookup/attempt (L298/322):
    -- automatic lookups use the observed candidate query, not M78's explicit picker query.
    v_query:=marketplace_sec.phase9_metadata_candidate_query_identity(c);
  ELSE RETURN NEXT; RETURN;
  END IF;

  -- 02b ??6.1/6.2: M81 saved-reference semantics with shared keys and source-backed grouping.
  IF v_hint IS NOT NULL THEN
    BEGIN
      SELECT * INTO v_edition FROM public.canonical_editions e WHERE e.id=v_hint;
      IF v_edition.id IS NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
      v_work_id:=v_edition.work_id;
      SELECT * INTO v_work FROM public.canonical_works w WHERE w.id=v_work_id;
      v_reference:=coalesce(nullif(m,'null'::jsonb),marketplace_sec.phase9_edition_canonical_snapshot(v_edition));
      IF NOT coalesce(marketplace_sec.phase9_edition_valid_metadata(v_reference),false)
      THEN RETURN NEXT; RETURN; END IF;
      v_proof_reference:=v_reference;
      IF s.selected_source='current_suggestion' THEN
        -- M65 projects canonical fields for an existing saved edition; its optional
        -- facts can differ from the immutable provider payload. Keep the saved
        -- reference's identity checks and use its scoped snapshot for proof IDs.
        v_proof_reference:=x.coherent_edition;
      END IF;
      IF v_proof_reference->>'adapterKey' IS NOT NULL THEN
        v_policy:=marketplace_sec.phase9_catalogue_source_policy_v1(v_proof_reference->>'adapterKey');
      END IF;
      SELECT * INTO v_isbn FROM marketplace_sec.phase9_catalogue_isbn_v1(
        v_reference->>'isbn10',v_reference->>'isbn13');
      SELECT * INTO v_existing_isbn FROM marketplace_sec.phase9_catalogue_isbn_v1(v_edition.isbn_10,v_edition.isbn_13);
      IF NOT v_isbn.admitted OR NOT v_existing_isbn.admitted THEN RETURN NEXT; RETURN; END IF;
      v_isbn10:=v_isbn.isbn10; v_isbn13:=v_isbn.isbn13;
      v_title:=pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(v_reference->>'title'));
      v_authors:=marketplace_sec.phase9_catalogue_normalized_authors_v1(
        ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_reference->'authors')));
      IF v_title='' OR pg_catalog.cardinality(v_authors)=0 OR ''=ANY(v_authors)
      THEN RETURN NEXT; RETURN; END IF;
      v_keys:=pg_catalog.array_append(v_keys,marketplace_sec.phase9_catalogue_identity_lock_key_v1('work',
        pg_catalog.jsonb_build_array(v_title,v_authors)));
      IF v_work.id IS NOT NULL THEN
        v_keys:=pg_catalog.array_append(v_keys,marketplace_sec.phase9_catalogue_identity_lock_key_v1('work',
          pg_catalog.jsonb_build_array(pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
            coalesce(v_work.title_normalized,v_work.primary_title))),
            marketplace_sec.phase9_catalogue_normalized_authors_v1(v_work.primary_authors))));
      END IF;
      FOR v_id IN SELECT 'isbn13'::text AS kind,v_isbn.isbn13 AS value
        UNION SELECT 'isbn10',v_isbn.isbn10
        UNION SELECT 'isbn13',v_existing_isbn.isbn13
        UNION SELECT 'isbn10',v_existing_isbn.isbn10
      LOOP
        IF v_id.value IS NOT NULL THEN v_keys:=pg_catalog.array_append(v_keys,
          marketplace_sec.phase9_catalogue_identity_lock_key_v1(v_id.kind,pg_catalog.jsonb_build_array(v_id.value)));
        END IF;
      END LOOP;
      IF v_proof_reference->>'adapterKey' IS NOT NULL AND v_proof_reference->>'providerRecordId' IS NOT NULL THEN
        v_keys:=pg_catalog.array_append(v_keys,marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
          pg_catalog.jsonb_build_array(v_proof_reference->>'adapterKey','edition',v_proof_reference->>'providerRecordId')));
      END IF;
      FOR v_id IN SELECT ids.adapter_key,ids.id_kind,ids.external_id FROM public.canonical_provider_ids ids
        WHERE ids.canonical_edition_id=v_edition.id OR ids.canonical_work_id=v_work.id
      LOOP
        v_keys:=pg_catalog.array_append(v_keys,marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
          pg_catalog.jsonb_build_array(v_id.adapter_key,v_id.id_kind,v_id.external_id)));
      END LOOP;
      -- A source work reference supplies its identity key even while its tuple is uncommitted.
      FOR v_id IN SELECT source.adapter_key,source.provider_book_id,source.normalized_payload
        FROM public.book_metadata_sources source WHERE source.canonical_edition_id=v_edition.id
          AND source.provider=source.adapter_key
      LOOP
        SELECT ids.valid INTO v_provider_valid FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
          v_id.adapter_key,v_id.provider_book_id,v_id.normalized_payload->>'workExternalId',NULL,
          v_id.normalized_payload->>'coverReference',NULL) ids;
        IF coalesce(v_provider_valid,false) THEN
          v_keys:=pg_catalog.array_append(v_keys,marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
            pg_catalog.jsonb_build_array(v_id.adapter_key,'edition',v_id.provider_book_id)));
          IF v_id.normalized_payload->>'workExternalId' IS NOT NULL THEN
            v_keys:=pg_catalog.array_append(v_keys,marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
              pg_catalog.jsonb_build_array(v_id.adapter_key,'work',v_id.normalized_payload->>'workExternalId')));
          END IF;
        END IF;
      END LOOP;
      IF pg_catalog.array_position(v_keys,NULL::bigint) IS NOT NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
      FOR v_key IN SELECT DISTINCT key FROM pg_catalog.unnest(v_keys) keys(key) ORDER BY key
      LOOP PERFORM pg_catalog.pg_advisory_xact_lock(v_key); END LOOP;
      SELECT * INTO v_work FROM public.canonical_works w WHERE w.id=v_work_id FOR KEY SHARE;
      SELECT * INTO v_edition FROM public.canonical_editions e WHERE e.id=v_hint FOR SHARE;
      IF v_edition.id IS NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
      -- 02a ?4: orphan remains locked for the unchanged private hydration, never repaired.
      IF v_edition.work_id IS NULL THEN RETURN NEXT; RETURN; END IF;
      IF v_work.id IS NULL OR v_edition.work_id IS DISTINCT FROM v_work_id
      THEN RAISE SQLSTATE 'P9C01'; END IF;
      -- section 6.1: every scoped edition identity must still point at the saved target.
      IF EXISTS(SELECT 1 FROM public.canonical_editions e WHERE e.id<>v_hint
          AND (e.isbn_13=v_isbn.isbn13 OR e.isbn_10=v_isbn.isbn10))
        OR EXISTS(SELECT 1 FROM public.canonical_provider_ids ids
          WHERE ids.adapter_key=v_proof_reference->>'adapterKey' AND ids.id_kind='edition'
            AND ids.external_id=v_proof_reference->>'providerRecordId'
            AND ids.canonical_edition_id IS DISTINCT FROM v_hint)
        OR EXISTS(SELECT 1 FROM public.book_metadata_sources source
          WHERE source.provider=v_proof_reference->>'adapterKey'
            AND source.provider_book_id=v_proof_reference->>'providerRecordId'
            AND (source.adapter_key IS DISTINCT FROM v_proof_reference->>'adapterKey'
              OR source.canonical_edition_id IS DISTINCT FROM v_hint))
        OR EXISTS(SELECT 1 FROM public.book_metadata_sources source
          JOIN public.canonical_provider_ids ids ON ids.adapter_key=source.adapter_key
            AND ids.id_kind='work' AND ids.external_id=source.normalized_payload->>'workExternalId'
          WHERE source.provider=v_proof_reference->>'adapterKey' AND source.adapter_key=source.provider
            AND source.provider_book_id=v_proof_reference->>'providerRecordId'
            AND source.canonical_edition_id=v_hint AND ids.canonical_work_id IS DISTINCT FROM v_work_id)
      THEN v_identity_conflict:=true; RAISE SQLSTATE 'P9C01'; END IF;
      -- section 6.1: an exact saved target cannot disambiguate duplicate normalized
      -- work keys. Match the resolver's unconditional cardinality guard.
      SELECT pg_catalog.count(*)::integer INTO v_count FROM public.canonical_works work
        WHERE pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
          coalesce(work.title_normalized,work.primary_title)))=v_title
          AND marketplace_sec.phase9_catalogue_normalized_authors_v1(work.primary_authors)=v_authors;
      IF v_count>1 THEN RAISE SQLSTATE 'P9C01'; END IF;
      SELECT * INTO v_existing_isbn FROM marketplace_sec.phase9_catalogue_isbn_v1(v_edition.isbn_10,v_edition.isbn_13);
      IF NOT v_existing_isbn.admitted
        OR (v_existing_isbn.isbn13 IS NOT NULL AND v_isbn13 IS NOT NULL
          AND v_existing_isbn.isbn13 IS DISTINCT FROM v_isbn13)
        OR pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(v_edition.title)) IS DISTINCT FROM v_title
        OR marketplace_sec.phase9_catalogue_normalized_authors_v1(v_edition.authors) IS DISTINCT FROM v_authors
        OR ((pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
          coalesce(v_work.title_normalized,v_work.primary_title))) IS DISTINCT FROM v_title
          OR marketplace_sec.phase9_catalogue_normalized_authors_v1(v_work.primary_authors) IS DISTINCT FROM v_authors)
          AND (NOT marketplace_sec.phase9_catalogue_work_proof_v1(v_edition.id,v_work.id,
              v_proof_reference->>'adapterKey',v_proof_reference->>'providerRecordId')
            OR EXISTS(SELECT 1 FROM public.canonical_works competing WHERE competing.id<>v_work.id
              AND pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
                coalesce(competing.title_normalized,competing.primary_title)))=v_title
              AND marketplace_sec.phase9_catalogue_normalized_authors_v1(competing.primary_authors)=v_authors)))
      THEN RETURN NEXT; RETURN; END IF;
      canonical_work_id:=v_work.id; canonical_edition_id:=v_edition.id;
      RETURN NEXT; RETURN;
    EXCEPTION WHEN SQLSTATE 'P9C01' THEN
      -- Aborting this saved-reference subtransaction releases its own advisory
      -- and row locks. The disappeared-ID fallback can plan a fresh sorted set.
      canonical_work_id:=NULL; canonical_edition_id:=NULL;
      IF v_identity_conflict THEN RETURN NEXT; RETURN; END IF;
    END;
  END IF;

  -- section section 3/6: current_suggestion stores a display projection, not provider provenance.
  IF s.selected_source='current_suggestion' THEN
    IF marketplace_sec.phase9_edition_snapshot(x.coherent_edition) IS DISTINCT FROM s.selected_option_snapshot
    THEN RETURN NEXT; RETURN; END IF;
    m:=x.coherent_edition;
  END IF;
  IF NOT coalesce(marketplace_sec.phase9_edition_valid_normalized_metadata(m),false)
    OR coalesce(m->>'correlationId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR coalesce(m->>'attemptId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN RETURN NEXT; RETURN; END IF;
  v_lookup:=(m->>'correlationId')::uuid; v_attempt:=(m->>'attemptId')::uuid;
  IF x.id IS NOT NULL AND (x.lookup_id IS DISTINCT FROM v_lookup
    OR x.selected_attempt_id IS DISTINCT FROM v_attempt) THEN RETURN NEXT; RETURN; END IF;
  SELECT * INTO l FROM public.phase9_metadata_lookups lookup
    WHERE lookup.id=v_lookup AND lookup.candidate_id=c.id AND lookup.store_id=p_store_id
      AND lookup.query_identity=v_query AND EXISTS(
        SELECT 1 FROM public.image_extraction_jobs job WHERE job.id=lookup.job_id
          AND job.entity_type='candidate' AND job.entity_id=c.id AND job.store_id=p_store_id);
  SELECT * INTO a FROM public.metadata_enrichment_attempts attempt
    WHERE attempt.id=v_attempt AND attempt.lookup_id=l.id
      AND attempt.candidate_id=c.id AND attempt.store_id=p_store_id;
  IF l.id IS NULL OR a.id IS NULL OR a.adapter_key IS DISTINCT FROM m->>'adapterKey'
    OR a.adapter_version IS DISTINCT FROM m->>'adapterVersion'
    OR a.normalizer_version IS DISTINCT FROM m->>'normalizerVersion'
    OR l.normalizer_version IS DISTINCT FROM m->>'normalizerVersion'
  THEN RETURN NEXT; RETURN; END IF;

  -- 02b ?5: the trusted builder holds the registry SHARE lock and binds admission/retention.
  v_policy:=marketplace_sec.phase9_catalogue_source_policy_v1(a.adapter_key);
  IF v_policy IS NULL OR v_policy->>'adapterVersion' IS DISTINCT FROM a.adapter_version
    OR v_policy->>'policyVersion' IS DISTINCT FROM l.reuse_policy_version
  THEN RETURN NEXT; RETURN; END IF;
  v_companion:=marketplace_sec.phase9_catalogue_companion_for_choice_v1(m,
    CASE WHEN s.selected_source='edition_option' THEN s.selected_source_id ELSE NULL END,c.id,p_store_id,p_session_id);
  RETURN QUERY SELECT resolved.canonical_work_id,resolved.canonical_edition_id
    FROM marketplace_sec.phase9_catalogue_resolve_v1(m,v_companion,v_policy) resolved;
END
$catalogue$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- 02b section 6.2 / Round C: owner-wide trigger target before shared catalogue locks.
-- Seed at the default revision only if absent; the existing triggers own every bump.
CREATE FUNCTION marketplace_sec.phase9_catalogue_lock_owner_scope_v1(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;
BEGIN
  SELECT s.created_by INTO v_actor FROM public.image_extraction_sessions s WHERE s.id=p_session_id;
  IF v_actor IS NULL THEN RETURN; END IF;
  INSERT INTO public.phase9_owner_review_scopes(actor_user_id,review_scope_version)
    VALUES(v_actor,1) ON CONFLICT(actor_user_id) DO NOTHING;
  PERFORM actor_user_id FROM public.phase9_owner_review_scopes
    WHERE actor_user_id=v_actor FOR UPDATE;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_lock_owner_scope_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_lock_owner_scope_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(
 p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,p_expected_metadata_revision integer,
 p_expected_review_version integer,p_source text,p_options_version integer,p_option_id uuid,p_selection_id uuid,
 p_idempotency_key text,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state; r jsonb; m jsonb;
 selected uuid; source_id uuid; fingerprint text; replay jsonb; response jsonb; q text; review jsonb;
 v_digest text; v_work uuid; v_edition uuid; v_hint uuid;
 v_lineage boolean; v_policy jsonb; v_lookup uuid; v_attempt uuid; v_snapshot public.phase9_selected_metadata_snapshots; v_proof jsonb;
 v_companion jsonb; v_foreign uuid;
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
 PERFORM marketplace_sec.phase9_catalogue_lock_owner_scope_v1(c.session_id);
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
 -- 02b ??4.4/6.2/7.2: a new, confirmed selection gets one private pending effect.
 v_digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(m::text,'UTF8')),'hex');
 IF p_source='edition_option' THEN
  v_lookup:=s.source_lookup_id; v_attempt:=s.source_attempt_id; v_proof:=m;
 ELSE
  SELECT * INTO v_snapshot FROM public.phase9_selected_metadata_snapshots snapshot
   WHERE snapshot.id=source_id AND snapshot.candidate_id=c.id AND snapshot.store_id=c.store_id;
  v_hint:=v_snapshot.canonical_edition_id;
  v_lookup:=v_snapshot.lookup_id; v_attempt:=v_snapshot.selected_attempt_id;
  -- M65's coherent display projection omits provider IDs. Proof IDs come only
  -- from this server-scoped immutable selection; m remains the coherence input.
  v_proof:=v_snapshot.coherent_edition;
 END IF;
 -- 02b section 6.2: candidate/state -> lookup effect -> choice effect -> shared.
 PERFORM effect.lookup_id FROM marketplace_sec.phase9_catalogue_lookup_effects effect
  WHERE effect.lookup_id=v_lookup AND effect.candidate_id=c.id
   AND effect.store_id=c.store_id AND effect.session_id=c.session_id FOR UPDATE;
 INSERT INTO marketplace_sec.phase9_catalogue_choice_effects(selection_id,candidate_id,store_id,session_id,
  lookup_id,attempt_id,option_id,metadata_digest)
 VALUES(selected,c.id,c.store_id,c.session_id,v_lookup,v_attempt,
  CASE WHEN p_source='edition_option' THEN source_id ELSE NULL END,v_digest);
 PERFORM effect.selection_id FROM marketplace_sec.phase9_catalogue_choice_effects effect
  WHERE effect.selection_id=selected AND effect.candidate_id=c.id
   AND effect.session_id=c.session_id AND effect.store_id=c.store_id FOR UPDATE;
 -- AC7-29: full Add lineage predicate; no temporary-source substitution.
 v_lineage:=v_hint IS NOT NULL OR EXISTS(
  SELECT 1 FROM public.phase9_metadata_lookups l
  JOIN public.metadata_enrichment_attempts a ON a.lookup_id=l.id
  JOIN public.image_extraction_jobs j ON j.id=l.job_id AND j.entity_type='candidate'
   AND j.entity_id=c.id AND j.store_id=c.store_id
  WHERE l.id=v_lookup AND a.id=v_attempt AND l.candidate_id=c.id AND l.store_id=c.store_id
   AND a.candidate_id=c.id AND a.store_id=c.store_id
   AND l.query_identity=CASE WHEN p_source='edition_option' THEN q
     ELSE marketplace_sec.phase9_metadata_candidate_query_identity(c) END
   AND v_proof->>'correlationId'=l.id::text AND v_proof->>'attemptId'=a.id::text
   AND a.adapter_key=v_proof->>'adapterKey' AND a.adapter_version=v_proof->>'adapterVersion'
   AND a.normalizer_version=v_proof->>'normalizerVersion' AND l.normalizer_version=v_proof->>'normalizerVersion');
 -- AC7-29/30: bind policy/version from the same locked registry row as Add.
 IF v_lineage AND v_hint IS NULL THEN
  v_policy:=marketplace_sec.phase9_catalogue_source_policy_v1(v_proof->>'adapterKey');
  v_lineage:=v_policy IS NOT NULL AND coalesce((v_policy->>'sharedAdmitted')::boolean,false)
   AND v_policy->>'adapterVersion'=v_proof->>'adapterVersion' AND EXISTS(
    SELECT 1 FROM public.phase9_metadata_lookups original WHERE original.id=v_lookup
     AND original.candidate_id=c.id AND original.store_id=c.store_id
     AND original.reuse_policy_version=v_policy->>'policyVersion');
 END IF;
 IF v_lineage THEN
 SELECT target.canonical_work_id,target.canonical_edition_id INTO v_work,v_edition
  FROM marketplace_sec.phase9_catalogue_choice_target_v1(
   m,v_hint,v_proof->>'adapterKey',v_proof->>'providerRecordId') target;
 -- 02b section 7.2 / AC7-31/33: an explicit option carries its stored companion;
 -- Select applies the same foreign-work refusal Add applies before counting. Only
 -- the exact selected option's companion is consulted; a missing companion (the
 -- hint path, which has no option companion by design) means no check.
 IF v_work IS NOT NULL AND p_source='edition_option' THEN
  SELECT marketplace_sec.phase9_catalogue_companion_for_choice_v1(m,source_id,c.id,c.store_id,c.session_id)
   INTO v_companion;
  IF v_companion IS NOT NULL AND v_companion->>'workExternalId' IS NOT NULL THEN
   SELECT p.canonical_work_id INTO v_foreign FROM public.canonical_provider_ids p
    WHERE p.adapter_key=v_proof->>'adapterKey' AND p.id_kind='work'
     AND p.external_id=v_companion->>'workExternalId';
   -- section 6.1: mirror the resolver's P9C01 source/companion work refusal.
   IF (v_foreign IS NOT NULL AND v_foreign IS DISTINCT FROM v_work)
    OR EXISTS(SELECT 1 FROM public.book_metadata_sources source
     WHERE source.provider=v_proof->>'adapterKey' AND source.provider_book_id=v_proof->>'providerRecordId'
      AND source.normalized_payload->>'version'='psr-catalogue-facts-v1'
      AND source.adapter_key=v_proof->>'adapterKey'
      AND source.normalized_payload->>'adapterKey'=v_proof->>'adapterKey'
      AND source.normalized_payload->>'providerRecordId'=v_proof->>'providerRecordId'
      AND source.normalized_payload->>'workExternalId'<>v_companion->>'workExternalId') THEN
    v_work:=NULL; v_edition:=NULL;
   END IF;
  END IF;
 END IF;
 END IF;
 IF v_work IS NOT NULL AND v_edition IS NOT NULL THEN
  PERFORM marketplace_sec.phase9_catalogue_count_search_v1(c.id,c.store_id,c.session_id,v_lookup,v_work);
  PERFORM marketplace_sec.phase9_catalogue_count_choice_v1(c.id,selected,v_digest,v_work,v_edition);
 END IF;
 response:=marketplace_sec.phase9_edition_choices(c);
 PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'EP_SELECT_V1',p_idempotency_key,
  response||jsonb_build_object('rows','[]'::jsonb,'optionsExpiresAt',NULL),'edition_selected_no_inventory_effect');
 RETURN response;
END$$;
ALTER FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.phase9_add_candidate_to_inventory_v1(
  p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,
  p_expected_review_version integer,p_expected_metadata_revision integer,
  p_idempotency_key text,p_command_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session public.image_extraction_sessions; v_candidate public.image_extraction_candidates;
  v_review jsonb; v_choice jsonb; v_damage jsonb; v_notes jsonb;
  v_snapshot public.phase9_selected_metadata_snapshots; v_edition public.canonical_editions;
  v_replay jsonb; v_response jsonb; v_fingerprint text; v_inventory uuid;
  v_canonical_work uuid; v_canonical_edition uuid; v_metadata_version text;
  v_isbn10 text; v_isbn13 text; v_publisher text; v_published text; v_cover text;
  v_description text; v_edition_statement text; v_volume text; v_format text;
  v_quantity integer; v_selected public.phase9_candidate_edition_state; m jsonb;
  v_gate_candidate public.image_extraction_candidates; v_gate_review jsonb; v_gate_isbn text;
  v_choice_effect marketplace_sec.phase9_catalogue_choice_effects; v_choice_digest text;
BEGIN
  v_session:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id AND c.store_id=v_session.store_id;
  IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  IF p_expected_candidate_version<1 OR p_expected_review_version<1
    OR p_expected_metadata_revision<1 OR p_command_id IS NULL
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_session_id,p_candidate_id,
    p_expected_candidate_version,p_expected_review_version,p_expected_metadata_revision,
    p_command_id),'sha256'),'hex');
  v_replay:=marketplace_sec.phase9_replay(auth.uid()::text,'U7AC01',
    p_idempotency_key,v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  v_session:=marketplace_sec.phase9_owner_ux_lock_active_session(p_session_id);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id AND c.session_id=p_session_id FOR UPDATE;
  IF v_candidate.id IS NULL OR v_candidate.store_id IS DISTINCT FROM v_session.store_id
    THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
  IF v_candidate.version<>p_expected_candidate_version
    THEN RAISE EXCEPTION 'P9_CANDIDATE_VERSION_CONFLICT'; END IF;
  IF v_candidate.review_version IS DISTINCT FROM p_expected_review_version
    OR v_candidate.metadata_revision<>p_expected_metadata_revision
    THEN RAISE EXCEPTION 'P9_VERSION_CONFLICT'; END IF;
  -- 02a section section 3.1/4: chosen-state lock follows replay/session/candidate locks.
  SELECT * INTO v_selected FROM public.phase9_candidate_edition_state state
    WHERE state.candidate_id=v_candidate.id AND state.session_id=v_session.id
      AND state.store_id=v_session.store_id FOR UPDATE;
  PERFORM marketplace_sec.phase9_catalogue_lock_owner_scope_v1(v_session.id);
  -- 02b ??6.2/7.2: current effect is locked before any shared target locks; never scan old choices.
  PERFORM effect.lookup_id FROM marketplace_sec.phase9_catalogue_lookup_effects effect
    JOIN marketplace_sec.phase9_catalogue_choice_effects choice ON choice.lookup_id=effect.lookup_id
    WHERE choice.selection_id=v_selected.selection_id AND choice.candidate_id=v_candidate.id
      AND effect.candidate_id=v_candidate.id AND effect.session_id=v_session.id
      AND effect.store_id=v_session.store_id FOR UPDATE OF effect;
  SELECT * INTO v_choice_effect FROM marketplace_sec.phase9_catalogue_choice_effects effect
    WHERE effect.selection_id=v_selected.selection_id AND effect.candidate_id=v_candidate.id
      AND effect.session_id=v_session.id AND effect.store_id=v_session.store_id FOR UPDATE;
  v_choice_digest:=pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(v_selected.selected_option_snapshot::text,'UTF8')),'hex');
  IF NOT marketplace_sec.phase9_unit7a_commit_eligible(v_candidate) THEN
    -- Recheck absence AFTER ordinary eligibility; its earlier reads may have raced a deletion.
    -- Only the exact scoped selected snapshot can authorize a transaction-local manual copy.
    v_gate_review:=v_candidate.owner_review_snapshot->'value';
    SELECT * INTO v_snapshot FROM public.phase9_selected_metadata_snapshots snapshot
      WHERE snapshot.id=v_candidate.selected_metadata_snapshot_id
        AND snapshot.id::text=v_gate_review#>>'{metadataChoice,selectionId}'
        AND snapshot.candidate_id=v_candidate.id AND snapshot.store_id=v_session.store_id;
    v_gate_isbn:=marketplace_sec.phase9_metadata_normalized_isbn13(v_candidate.observed_isbn_clue);
    IF v_gate_review#>>'{metadataChoice,mode}' IS DISTINCT FROM 'selected'
      OR v_snapshot.id IS NULL
      OR v_snapshot.manual_outcome NOT IN ('accepted_metadata_match','local_canonical_match')
      OR v_gate_isbn IS NULL
      OR (v_snapshot.canonical_edition_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM public.canonical_editions e WHERE e.id=v_snapshot.canonical_edition_id))
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
    IF v_snapshot.coherent_edition IS NOT NULL THEN
      IF NOT coalesce(marketplace_sec.phase9_edition_valid_metadata(v_snapshot.coherent_edition),false)
        OR NOT coalesce(v_gate_isbn=marketplace_sec.phase9_metadata_normalized_isbn13(v_snapshot.coherent_edition->>'isbn13')
          OR v_gate_isbn=marketplace_sec.phase9_metadata_normalized_isbn13(v_snapshot.coherent_edition->>'isbn10'),false)
        OR NOT coalesce(marketplace_sec.phase9_edition_identity_compatible(v_snapshot.coherent_edition,
          marketplace_sec.phase9_edition_query_identity(v_candidate)),false)
      THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
    END IF;
    v_gate_candidate:=v_candidate;
    v_gate_candidate.owner_review_snapshot:=jsonb_set(v_gate_candidate.owner_review_snapshot,
      '{value,metadataChoice}',jsonb_build_object('mode','manual','selectionId',NULL));
    -- Retains M55/M69 state, saved-review, confirmation, blocker and nonempty-author checks.
    IF NOT marketplace_sec.phase9_unit7a_commit_eligible(v_gate_candidate)
    THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  END IF;
  v_review:=v_candidate.owner_review_snapshot->'value';
  v_choice:=v_review->'metadataChoice'; v_damage:=v_review->'damageDisclosure';
  v_notes:=v_review->'notes'; v_quantity:=(v_review->>'quantity')::integer;
  -- 02a section 4: link IDs come only from the helper; hydration retains its independent source.
  v_canonical_work:=NULL; v_canonical_edition:=NULL;
  SELECT link.canonical_work_id,link.canonical_edition_id INTO v_canonical_work,v_canonical_edition
    FROM marketplace_sec.phase9_catalogue_link_for_add_v1(v_candidate.id,v_session.id,v_session.store_id) link;
  IF v_choice->>'mode'='edition_option' THEN
    SELECT * INTO v_selected FROM public.phase9_candidate_edition_state
      WHERE candidate_id=v_candidate.id AND session_id=v_session.id AND store_id=v_candidate.store_id FOR UPDATE;
    m:=v_selected.selected_option_snapshot;
    v_metadata_version:='edition-selection-v1:'||v_selected.selection_id::text||':metadata-r'||p_expected_metadata_revision;
    v_isbn10:=m->>'isbn10'; v_isbn13:=m->>'isbn13'; v_publisher:=m->>'publisher';
    v_published:=m->>'publishedDate'; v_cover:=m->>'coverReference'; v_description:=m->>'description';
    v_edition_statement:=m->>'editionStatement'; v_volume:=m->>'volume'; v_format:=m->>'format';
  ELSIF v_choice->>'mode'='selected' THEN
    SELECT * INTO v_snapshot FROM public.phase9_selected_metadata_snapshots s
      WHERE s.id=(v_choice->>'selectionId')::uuid
        AND s.id=v_candidate.selected_metadata_snapshot_id
        AND s.candidate_id=v_candidate.id AND s.store_id=v_candidate.store_id;
    IF v_snapshot.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
    v_metadata_version:=v_snapshot.snapshot_version;
    -- 02a section 4 hydration: only the snapshot's own surviving edition supplies these fields.
    -- An ISBN-discovered sparse incumbent must not replace coherent_edition's chosen values.
    SELECT * INTO v_edition FROM public.canonical_editions e
      WHERE e.id=v_snapshot.canonical_edition_id FOR SHARE;
    IF v_edition.id IS NOT NULL THEN
      v_isbn10:=v_edition.isbn_10;
      v_isbn13:=v_edition.isbn_13; v_publisher:=v_edition.publisher;
      v_published:=v_edition.published_date; v_cover:=v_edition.cover_url;
      v_description:=v_edition.description;
      v_edition_statement:=v_edition.edition_statement;
      v_volume:=v_edition.volume; v_format:=v_edition.format;
    ELSE
      v_isbn10:=coalesce(v_snapshot.coherent_edition->>'isbn10',v_snapshot.coherent_edition->>'isbn_10');
      v_isbn13:=coalesce(v_snapshot.coherent_edition->>'isbn13',v_snapshot.coherent_edition->>'isbn_13');
      v_publisher:=v_snapshot.coherent_edition->>'publisher';
      v_published:=coalesce(v_snapshot.coherent_edition->>'publishedDate',
        v_snapshot.coherent_edition->>'published_date');
      v_cover:=coalesce(v_snapshot.coherent_edition->>'coverReference',
        v_snapshot.coherent_edition->>'cover_url');
      v_description:=v_snapshot.coherent_edition->>'description';
      v_edition_statement:=v_snapshot.coherent_edition->>'editionStatement';
      v_volume:=v_snapshot.coherent_edition->>'volume'; v_format:=v_snapshot.coherent_edition->>'format';
    END IF;
  ELSE
    v_metadata_version:=concat('manual-review-v',p_expected_review_version,
      '-metadata-r',p_expected_metadata_revision);
  END IF;
  INSERT INTO public.store_inventory(
    id,store_id,canonical_work_id,canonical_edition_id,title,authors,isbn_10,isbn_13,
    publisher,published_date,cover_url,language,description,edition_statement,volume,format,
    condition,has_damage,damage_notes,damage_types,is_sellable,
    quantity_total,quantity_available,quantity_reserved,quantity_sold,quantity_removed,
    selling_price_minor,shelf_location,internal_notes,public_notes,visibility_status,
    publication_status,extraction_session_id,entry_method,created_from_candidate_id,
    created_by,metadata_snapshot_version)
  VALUES(gen_random_uuid(),v_session.store_id,v_canonical_work,v_canonical_edition,
    v_review->>'originalTitle',ARRAY(SELECT jsonb_array_elements_text(v_review->'authors')),
    v_isbn10,v_isbn13,v_publisher,v_published,v_cover,v_review->>'originalLanguage',
    v_description,v_edition_statement,v_volume,v_format,v_review->>'baseCondition',
    (v_damage->>'hasDamage')::boolean,
    NULLIF(v_damage->>'damageNote',''),ARRAY(SELECT jsonb_array_elements_text(v_damage->'damageTypes')),
    (v_damage->>'isSellable')::boolean,v_quantity,v_quantity,0,0,0,
    (v_review->>'priceMinor')::integer,v_review->>'shelfLocation',
    NULLIF(v_notes->>'internalNote',''),NULLIF(v_notes->>'publicNote',''),'draft','private',
    v_session.id,'image_extraction',v_candidate.id,auth.uid(),v_metadata_version)
  RETURNING id INTO v_inventory;
  -- 02b ?7.2: inventory succeeded; helper's coherent pair is the sole source for both effects.
  IF v_canonical_work IS NOT NULL AND v_canonical_edition IS NOT NULL THEN
    IF v_choice->>'mode'='edition_option' AND v_choice->>'selectionId'=v_selected.selection_id::text THEN
      PERFORM marketplace_sec.phase9_catalogue_count_choice_v1(v_candidate.id,v_selected.selection_id,
        v_choice_digest,v_canonical_work,v_canonical_edition);
    END IF;
    IF v_choice_effect.selection_id=v_selected.selection_id AND v_choice_effect.metadata_digest=v_choice_digest THEN
      PERFORM marketplace_sec.phase9_catalogue_count_search_v1(v_candidate.id,v_session.store_id,v_session.id,
        v_choice_effect.lookup_id,v_canonical_work);
    END IF;
    PERFORM marketplace_sec.phase9_catalogue_increment_v1(v_canonical_work,v_canonical_edition,0,0,1);
  END IF;
  PERFORM marketplace_sec.phase9_edition_clear_options(v_candidate.id);
  UPDATE public.image_extraction_candidates SET state='committed',
    committed_inventory_id=v_inventory,committed_listing_id=NULL,
    commit_idempotency_key=p_idempotency_key,commit_outcome='committed_private',
    publication_decision=v_review->>'publicationIntent',version=version+1,
    updated_at=transaction_timestamp()
    WHERE id=v_candidate.id RETURNING * INTO v_candidate;
  UPDATE public.image_extraction_sessions SET committed_count=committed_count+1,
    updated_at=transaction_timestamp() WHERE id=v_session.id;
  INSERT INTO public.marketplace_audit_logs(
    store_id,action,entity_type,entity_id,actor_user_id,details)
  VALUES(v_session.store_id,'phase9.candidate_commit','store_inventory',v_inventory,auth.uid(),
    jsonb_build_object('candidateId',v_candidate.id,'sessionId',v_session.id,
      'candidateVersion',v_candidate.version,'reviewVersion',p_expected_review_version,
      'metadataRevision',p_expected_metadata_revision,'commandId',p_command_id,
      'outcome','committed_private','publicationIntent',v_review->>'publicationIntent'));
  INSERT INTO public.marketplace_events(event_type,entity_type,entity_id,store_id,
    actor_user_id,payload)
  VALUES('inventory.created_from_candidate','store_inventory',v_inventory,v_session.store_id,
    auth.uid(),jsonb_build_object('candidateId',v_candidate.id,'sessionId',v_session.id,
      'commandId',p_command_id,'outcome','committed_private'));
  v_response:=jsonb_build_object('sessionId',v_session.id,'candidateId',v_candidate.id,
    'candidateVersion',v_candidate.version,'inventoryId',v_inventory,
    'inventoryVersion',1,'outcome','committed_private');
  PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'U7AC01',
    p_idempotency_key,v_response,'private_inventory_created');
  RETURN v_response;
END$$;
ALTER FUNCTION public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid) TO authenticated;

-- 02b section 6.2/AC7-22: read-only batch plan using the same identities as Add.
-- No row locks or writes: callers union every option's keys before the first lock.
CREATE FUNCTION marketplace_sec.phase9_catalogue_plan_keys_v1(p_metadata jsonb,p_companion jsonb)
RETURNS bigint[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE m jsonb:=p_metadata; v_adapter text:=m->>'adapterKey'; v_record text:=m->>'providerRecordId';
 v_work_external text:=p_companion->>'workExternalId'; v_source_work_external text;
 v_title text; v_authors text[]; v_isbn10 text; v_isbn13 text; v_valid boolean;
 v_source public.book_metadata_sources; v_planned uuid[]; v_keys bigint[];
BEGIN
 SELECT i.isbn10,i.isbn13,i.admitted INTO v_isbn10,v_isbn13,v_valid
  FROM marketplace_sec.phase9_catalogue_isbn_v1(m->>'isbn10',m->>'isbn13') i;
 IF NOT coalesce(v_valid,false) THEN RETURN ARRAY[]::bigint[]; END IF;
 v_title:=pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(m->>'title'));
 v_authors:=marketplace_sec.phase9_catalogue_normalized_authors_v1(
  ARRAY(SELECT pg_catalog.jsonb_array_elements_text(m->'authors')));
 IF v_title='' OR pg_catalog.cardinality(v_authors)=0 OR ''=ANY(v_authors) THEN RETURN ARRAY[]::bigint[]; END IF;
 SELECT * INTO v_source FROM public.book_metadata_sources src WHERE src.provider=v_adapter AND src.provider_book_id=v_record;
 IF v_source.normalized_payload->>'version'='psr-catalogue-facts-v1'
  AND v_source.adapter_key=v_adapter AND v_source.normalized_payload->>'adapterKey'=v_adapter
  AND v_source.normalized_payload->>'providerRecordId'=v_record
 THEN v_source_work_external:=v_source.normalized_payload->>'workExternalId'; END IF;
 SELECT checked.valid INTO v_valid FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
   v_adapter,v_record,coalesce(v_work_external,v_source_work_external),NULL,m->>'coverReference',NULL) checked;
 IF NOT coalesce(v_valid,false) THEN RETURN ARRAY[]::bigint[]; END IF;
  SELECT ARRAY(SELECT DISTINCT w.id FROM public.canonical_works w WHERE w.id IN(
    SELECT e.work_id FROM public.canonical_editions e WHERE e.isbn_13=v_isbn13 OR e.isbn_10=v_isbn10
      OR e.id=v_source.canonical_edition_id OR e.id IN(SELECT p.canonical_edition_id
        FROM public.canonical_provider_ids p WHERE p.adapter_key=v_adapter AND p.id_kind='edition'
          AND p.external_id=v_record)) OR w.id IN(SELECT p.canonical_work_id
    FROM public.canonical_provider_ids p WHERE p.adapter_key=v_adapter AND p.id_kind='work'
      AND p.external_id=coalesce(v_work_external,v_source_work_external))
    OR (pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
      coalesce(w.title_normalized,w.primary_title)))=v_title
      AND marketplace_sec.phase9_catalogue_normalized_authors_v1(w.primary_authors)=v_authors)) INTO v_planned;
  SELECT ARRAY(SELECT DISTINCT k FROM (
    SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('work',
      pg_catalog.jsonb_build_array(v_title,v_authors)) k
    UNION ALL SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('isbn13',
      pg_catalog.jsonb_build_array(v_isbn13)) WHERE v_isbn13 IS NOT NULL
    UNION ALL SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('isbn10',
      pg_catalog.jsonb_build_array(v_isbn10)) WHERE v_isbn10 IS NOT NULL
    UNION ALL SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
      pg_catalog.jsonb_build_array(v_adapter,'edition',v_record))
    UNION ALL SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
      pg_catalog.jsonb_build_array(v_adapter,'work',coalesce(v_work_external,v_source_work_external)))
      WHERE coalesce(v_work_external,v_source_work_external) IS NOT NULL
    UNION ALL SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('work',
      pg_catalog.jsonb_build_array(pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
        coalesce(w.title_normalized,w.primary_title))),
        marketplace_sec.phase9_catalogue_normalized_authors_v1(w.primary_authors)))
      FROM public.canonical_works w WHERE w.id=ANY(v_planned)) identity_keys ORDER BY k) INTO v_keys;

 IF pg_catalog.array_position(v_keys,NULL::bigint) IS NOT NULL THEN RETURN ARRAY[]::bigint[]; END IF;
 RETURN v_keys;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_plan_keys_v1(jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_plan_keys_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 4. 02b sections 3/5/6.2/7.1: M78 fences/accounting plus one atomic batch.
CREATE FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v2(
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
 UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,
  lease_expires_at=NULL,completed_at=pg_catalog.transaction_timestamp(),updated_at=pg_catalog.transaction_timestamp() WHERE id=p_job_id;
 RETURN response;
END
$completion$;

ALTER FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.phase9_complete_candidate_edition_options_v2(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,
 p_request_generation integer,p_query_identity text,p_lookup_id uuid,p_attempt_id uuid,
 p_source_fetched_at timestamptz,p_options_expires_at timestamptz,
 p_storage_permission_verified boolean,p_rows jsonb,p_catalogue_companions jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_complete_candidate_edition_options_v2(p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,p_lookup_id,p_attempt_id,p_source_fetched_at,p_options_expires_at,p_storage_permission_verified,p_rows,p_catalogue_companions)
$$;

ALTER FUNCTION public.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v1(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,
 p_request_generation integer,p_query_identity text,p_lookup_id uuid,p_attempt_id uuid,
 p_source_fetched_at timestamptz,p_options_expires_at timestamptz,
 p_storage_permission_verified boolean,p_rows jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_complete_candidate_edition_options_v2(p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,p_lookup_id,p_attempt_id,p_source_fetched_at,p_options_expires_at,p_storage_permission_verified,p_rows,NULL::jsonb)
$$;

ALTER FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb) TO service_role;

-- 5. Durable recovery with original legacy fallback (02b section 5).
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_recover_candidate_edition_options_v1(p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,p_request_generation integer,p_query_identity text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state; saved jsonb;
BEGIN
 c:=marketplace_sec.phase9_edition_assert_fence(p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,true);
 IF c.id IS NULL THEN RETURN jsonb_build_object('status','stale_rejected'); END IF;
 SELECT e.completion_response INTO saved FROM marketplace_sec.phase9_catalogue_lookup_effects e
 JOIN public.phase9_metadata_lookups l ON l.id=e.lookup_id
 WHERE e.candidate_id=c.id AND e.store_id=c.store_id AND e.session_id=c.session_id
  AND e.request_generation=p_request_generation AND l.job_id=p_job_id
  AND l.candidate_id=c.id AND l.store_id=c.store_id AND l.query_identity=p_query_identity
  AND l.claim_attempt_number=p_attempt_count AND l.claim_worker=p_worker
  AND l.claim_lease_token_hash=pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex')
  AND l.completed_at IS NOT NULL;
 IF saved IS NOT NULL THEN RETURN saved||pg_catalog.jsonb_build_object('status','replayed'); END IF;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 IF s.source_lookup_id IS NULL THEN RETURN jsonb_build_object('status','missing'); END IF;
 IF s.options_expires_at<=transaction_timestamp() OR NOT EXISTS(
  SELECT 1 FROM public.phase9_metadata_lookups l JOIN public.metadata_enrichment_attempts a ON a.lookup_id=l.id
   JOIN public.phase9_provider_registry r ON r.adapter_key=a.adapter_key
  WHERE l.id=s.source_lookup_id AND a.id=s.source_attempt_id AND l.job_id=p_job_id
   AND l.candidate_id=c.id AND l.store_id=c.store_id AND a.candidate_id=c.id AND a.store_id=c.store_id
   AND l.query_identity=s.query_identity AND l.completed_at IS NOT NULL
   AND r.provider_kind='metadata' AND marketplace_sec.phase9_edition_source_policy(s) AND r.adapter_version=a.adapter_version
   AND r.policy_version::text=l.reuse_policy_version AND r.enabled AND r.matching_allowed AND r.storage_allowed)
 THEN RETURN jsonb_build_object('status','stale_rejected'); END IF;
 RETURN marketplace_sec.phase9_edition_completion_receipt(s,'replayed');
END
$function$;
ALTER FUNCTION marketplace_sec.phase9_recover_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_recover_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_recover_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text) TO service_role;

-- 6. Coordinated structural/local completion (02b sections 6.2/7.2/AC7-25).
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_complete_structural_local_metadata_match(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_candidate_id uuid,p_candidate_version integer,p_query_identity text,
  p_lookup_strategy text,p_lookup_contract_version text,p_normalizer_version text,
  p_routing_policy_version text,p_privacy_scope text,p_schema_version text,
  p_canonical_edition_id uuid,p_snapshot_version text,p_selection_policy_version text,
  p_match_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_candidate public.image_extraction_candidates;
  v_scope record; v_session public.image_extraction_sessions;
BEGIN
  -- 02b sections 6.2/7.2, Owner B3 P2: scope read must not lock the candidate.
  SELECT c.session_id,c.store_id INTO v_scope FROM public.image_extraction_candidates c
    WHERE c.id=p_candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  SELECT * INTO v_session FROM public.image_extraction_sessions s
    WHERE s.id=v_scope.session_id AND s.store_id=v_scope.store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  IF v_candidate.session_id IS DISTINCT FROM v_session.id
    OR v_candidate.store_id IS DISTINCT FROM v_session.store_id THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  IF p_query_identity<>marketplace_sec.phase9_metadata_candidate_query_identity(v_candidate)
    THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN marketplace_sec.phase9_complete_local_metadata_match(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_query_identity,p_lookup_strategy,
    p_lookup_contract_version,p_normalizer_version,p_routing_policy_version,p_privacy_scope,
    p_schema_version,p_canonical_edition_id,p_snapshot_version,p_selection_policy_version,
    p_match_evidence);
END$$;
ALTER FUNCTION marketplace_sec.phase9_complete_structural_local_metadata_match(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_structural_local_metadata_match(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_structural_local_metadata_match(uuid,text,text,integer,uuid,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_complete_local_metadata_match(
  p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
  p_query_identity text,p_lookup_strategy text,p_lookup_contract_version text,
  p_normalizer_version text,p_routing_policy_version text,p_privacy_scope text,
  p_schema_version text,p_canonical_edition_id uuid,p_snapshot_version text,
  p_selection_policy_version text,p_match_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.image_extraction_jobs; v_candidate public.image_extraction_candidates;
  v_scope record; v_session public.image_extraction_sessions;
  v_lookup public.phase9_metadata_lookups;
  v_snapshot public.phase9_selected_metadata_snapshots; v_snapshot_id uuid;
  v_edition public.canonical_editions; v_work uuid; v_target uuid; v_response jsonb; v_digest text;
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
  -- 02b section 6.2: direct M15 callers also take session before claim/candidate.
  SELECT c.id AS candidate_id,c.session_id,c.store_id INTO v_scope
    FROM public.image_extraction_jobs j JOIN public.image_extraction_candidates c
      ON c.id=j.entity_id AND c.store_id=j.store_id WHERE j.id=p_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  SELECT * INTO v_session FROM public.image_extraction_sessions s
    WHERE s.id=v_scope.session_id AND s.store_id=v_scope.store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  v_job:=marketplace_sec.phase9_assert_metadata_claim(
    p_job_id,p_worker,p_lease_token,p_attempt_count);
  SELECT * INTO v_candidate FROM public.image_extraction_candidates
    WHERE id=v_job.entity_id AND store_id=v_job.store_id FOR UPDATE;
  IF NOT FOUND OR v_candidate.id IS DISTINCT FROM v_scope.candidate_id
    OR v_candidate.session_id IS DISTINCT FROM v_session.id
    OR v_candidate.store_id IS DISTINCT FROM v_session.store_id
    OR NOT EXISTS(SELECT 1 FROM public.canonical_editions e WHERE e.id=p_canonical_edition_id)
    OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations r
      WHERE r.job_id=v_job.id AND r.cost_kind='metadata')
    OR EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts a
      WHERE a.candidate_id=v_candidate.id) THEN
    RAISE EXCEPTION 'P9_STATE_CONFLICT';
  END IF;
  -- 02b sections 5/6.2/7.2: recheck discovery and lock before FK/shared writes.
  PERFORM state.candidate_id FROM public.phase9_candidate_edition_state state
    WHERE state.candidate_id=v_candidate.id AND state.store_id=v_candidate.store_id
      AND state.session_id=v_candidate.session_id FOR UPDATE;
  PERFORM marketplace_sec.phase9_catalogue_lock_owner_scope_v1(v_candidate.session_id);
  IF marketplace_sec.phase9_edition_local_match(v_candidate) IS DISTINCT FROM p_canonical_edition_id
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
  -- Lookup triggers reuse the preheld candidate/session/owner scope before identities.
  -- Its trusted-edition FK KEY SHARE is compatible with catalogue edition SHARE.
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
  SELECT * INTO v_edition FROM public.canonical_editions WHERE id=p_canonical_edition_id;
  SELECT target.canonical_work_id,target.canonical_edition_id INTO v_work,v_target
    FROM marketplace_sec.phase9_catalogue_choice_target_v1(
      marketplace_sec.phase9_edition_canonical_snapshot(v_edition),v_edition.id,NULL,NULL) target;
  IF marketplace_sec.phase9_edition_local_match(v_candidate) IS DISTINCT FROM p_canonical_edition_id
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
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
  v_response:=pg_catalog.jsonb_build_object('lookup_id',v_lookup.id,'snapshot_id',v_snapshot_id,
    'manual_outcome','local_canonical_match','creates_provider_charge',false);
  v_digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
    'psr-catalogue-write-v1',p_query_identity,p_lookup_strategy,p_lookup_contract_version,p_normalizer_version,
    p_routing_policy_version,p_privacy_scope,p_schema_version,p_canonical_edition_id,p_snapshot_version,
    p_selection_policy_version,p_match_evidence,v_work,v_target)::text,'UTF8')),'hex');
  INSERT INTO marketplace_sec.phase9_catalogue_lookup_effects(lookup_id,candidate_id,store_id,session_id,
    request_generation,completion_digest,canonical_results,completion_response)
  VALUES(v_lookup.id,v_candidate.id,v_candidate.store_id,v_candidate.session_id,0,v_digest,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('optionId',NULL,
      'canonicalWorkId',v_work,'canonicalEditionId',v_target)),v_response);
  PERFORM marketplace_sec.phase9_catalogue_count_search_v1(v_candidate.id,v_candidate.store_id,
    v_candidate.session_id,v_lookup.id,v_work);
  UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,
    lease_expires_at=NULL,lease_token_hash=NULL,completed_at=transaction_timestamp(),
    updated_at=transaction_timestamp() WHERE id=v_job.id;
  RETURN jsonb_build_object('lookup_id',v_lookup.id,'snapshot_id',v_snapshot_id,
    'manual_outcome','local_canonical_match','creates_provider_charge',false);
END$$;
ALTER FUNCTION marketplace_sec.phase9_complete_local_metadata_match(uuid,text,text,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_local_metadata_match(uuid,text,text,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_local_metadata_match(uuid,text,text,integer,text,text,text,text,text,text,text,uuid,text,text,jsonb) TO service_role;

-- 7. AC7-34: M83's exact immutable probe expressions; ISBN indexes unchanged.
CREATE INDEX canonical_works_normalized_probe_idx ON public.canonical_works
 ((pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(coalesce(title_normalized,primary_title)))),
 (marketplace_sec.phase9_catalogue_normalized_authors_v1(primary_authors)));

-- 02b section 9: reassert existing client write revocations without changing reads.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
 ON public.canonical_works,public.canonical_editions FROM PUBLIC,anon,authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
 ON public.book_metadata_sources FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
