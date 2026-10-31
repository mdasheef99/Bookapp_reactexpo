-- Owner-authorized file creation only, 2026-10-31; NOT APPLIED.
-- Owner-reviewed ol-retained-fields-v1 install record approved 2026-10-31.
-- Description approval supersedes Tracker 37 section 2's narrower exclusion.
-- 02c §§3.1/4.1/4.2/4.4/8/9: 8a-2, against M89. No registry data changes.
-- Fixed installation boundary: registry strings never name SQL functions.
-- V2 retains the v1 physical grammar; the new ISBN stage is OQ8-6 gated.
-- Rollback is a reviewed forward replacement; saved snapshots are never rewritten.
BEGIN;

-- 02c §§3.1/4.1: payload and lookup schemas have distinct meanings.
CREATE FUNCTION marketplace_sec.phase9_provider_validation_contract_v1(p_key text,p_version text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE
  WHEN p_key='open_library' AND p_version IN('1.0.0','2.0.0') THEN
   pg_catalog.jsonb_build_object(
    'validationContract',CASE p_version WHEN '1.0.0' THEN 'open-library-v1' ELSE 'open-library-v2' END,
    'hostPolicyVersion','open-library-hosts-v1',
    'capabilityVersion',CASE p_version WHEN '1.0.0' THEN 'open-library-capability-v1' ELSE 'open-library-capability-v2' END,
    'normalizerVersion','p9-bibliographic-normalizer-v1',
    'payloadSchemaVersion','p9-metadata-v1','lookupSchemaVersion','p9-metadata-foundation-v1')
  WHEN p_key='google_books' AND p_version='1.0.0' THEN
   pg_catalog.jsonb_build_object('validationContract','google-books-v1',
    'hostPolicyVersion','google-books-hosts-v1','capabilityVersion','google-books-capability-v1',
    'normalizerVersion','p9-bibliographic-normalizer-v1',
    'payloadSchemaVersion','p9-metadata-v1','lookupSchemaVersion','p9-metadata-foundation-v1')
 END
$$;

-- 02c §3.1 / DOC-1 §13 / Owner 2026-10-31: compiled install manifest.
-- Each field has its own flags and authority. Blank denied permissions grant
-- nothing. This approves the existing bounded projection, not arbitrary fields
-- or image bytes; private evidence never enters shared facts/cache projections.
-- 02c §§3.1/4.1/4.2: no per-field duration was supplied. Intersect existing
-- registry/source deadlines and the <=24h options ceiling; do not invent one.
CREATE FUNCTION marketplace_sec.phase9_provider_field_profile_v1(p_key text,p_version text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT pg_catalog.jsonb_build_object('version','ol-retained-fields-v1',
  'adapterKey',p_key,'adapterVersion',p_version,'fields',
  pg_catalog.jsonb_object_agg(field,pg_catalog.jsonb_build_object(
   'matchingOnly',CASE WHEN use_kind<>'denied' THEN false END,
   'storageAllowed',CASE WHEN use_kind<>'denied' THEN true END,
   'publicDisplayAllowed',CASE WHEN use_kind<>'denied' THEN use_kind='shared' END,
   'imageCachingAllowed',CASE WHEN use_kind<>'denied' THEN false END,
   'attributionRequired',CASE WHEN use_kind='shared' THEN true END,
   'expiryRevalidation',CASE WHEN use_kind<>'denied' THEN pg_catalog.jsonb_build_object(
    'optionsMaxSeconds',86400,'revalidationSeconds',NULL,
    'policy','02c §§3.1/4.1/4.2: intersect current registry and source deadlines; preserve chosen snapshots') END,
   'authorityReference','Owner-approved ol-retained-fields-v1, 2026-10-31; 02c §3.1; DOC-1 §13')))
 FROM (VALUES
  ('title','shared'),('subtitle','shared'),('authors','shared'),
  ('isbn10','shared'),('isbn13','shared'),('publisher','shared'),('publishedDate','shared'),
  ('language','shared'),('script','shared'),('pageCount','shared'),('description','shared'),
  ('categories','shared'),('editionStatement','shared'),('format','shared'),('volume','shared'),
  ('workExternalId','shared'),('providerRecordId','shared'),('oclc','shared'),('lccn','shared'),
  ('bookUrl','shared'),('coverReference','shared'),
  ('confidence','private'),('matchRationale','private'),('requestId','private'),
  ('correlationId','private'),('attemptId','private'),('receiptId','private'),
  ('series','denied'),('ratings','denied'),('popularity','denied'),('otherLinks','denied'),
  ('coverImageFiles','denied'),('rawBodies','denied')
 ) AS fields(field,use_kind)
 HAVING p_key='open_library' AND p_version IN('1.0.0','2.0.0')
$$;

-- 02c §§3.1/4.2: fixed retained-field boundary, without a runtime redaction
-- engine. The normalized shape rejects ratings, extra links/raw bodies/files.
-- OL series must be blank. Google's existing private facts remain valid;
-- that validity grants no permanent reuse (M89 veto remains independent).
CREATE FUNCTION marketplace_sec.phase9_provider_retained_fields_valid_v1(
 p_key text,p_version text,p_metadata jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(CASE
  WHEN marketplace_sec.phase9_provider_field_profile_v1(p_key,p_version) IS NOT NULL
   THEN pg_catalog.jsonb_typeof(p_metadata)='object' AND p_metadata->>'series' IS NULL
  WHEN p_key='google_books' AND p_version='1.0.0' THEN true
  ELSE false END,false)
$$;

-- 02c §§3.1/4.2: version-specific admission intersects installed facts/profile
-- with registry capability/rights. Registry data cannot install a contract.
CREATE FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v2(p_adapter_key text,p_adapter_version text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key=p_adapter_key
  AND r.provider_kind='metadata' AND r.enabled AND r.matching_allowed
  AND r.storage_allowed AND r.public_display_allowed AND r.shared_catalogue_allowed
  AND marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(r.adapter_key,p_adapter_version)
  AND p_adapter_version=ANY(r.accepted_adapter_versions)
  AND r.version_contracts->p_adapter_version=
   marketplace_sec.phase9_provider_validation_contract_v1(r.adapter_key,p_adapter_version)
  AND marketplace_sec.phase9_provider_field_profile_v1(r.adapter_key,p_adapter_version) IS NOT NULL
  AND r.attribution_required AND r.policy_version>0 AND r.raw_retention_seconds>=0
  AND (r.revalidation_seconds IS NULL OR r.revalidation_seconds>0)
  AND marketplace_sec.phase9_catalogue_safe_text_v1(r.shared_source_note,1024))
$$;

-- 02c §§4.1/4.2/4.4: replace both interim bodies in this transaction, keeping
-- old signatures/active-version semantics and the exact eight-key 02b DTO.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v1(p_adapter_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT marketplace_sec.phase9_catalogue_shared_admitted_v2(r.adapter_key,r.adapter_version)
  FROM public.phase9_provider_registry r WHERE r.adapter_key=p_adapter_key),false)
$$;
CREATE FUNCTION marketplace_sec.phase9_catalogue_source_policy_v2(p_adapter_key text,p_adapter_version text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.phase9_provider_registry;
BEGIN
 SELECT * INTO r FROM public.phase9_provider_registry WHERE adapter_key=p_adapter_key FOR SHARE;
 IF r.adapter_key IS NULL OR p_adapter_version IS NULL
  OR NOT p_adapter_version=ANY(r.accepted_adapter_versions) THEN RETURN NULL; END IF;
 RETURN pg_catalog.jsonb_build_object('version','psr-catalogue-source-policy-v1',
  'adapterKey',r.adapter_key,'adapterVersion',p_adapter_version,'policyVersion',r.policy_version,
  'rawRetentionSeconds',r.raw_retention_seconds,'revalidationSeconds',r.revalidation_seconds,
  'sharedSourceNote',r.shared_source_note,'sharedAdmitted',
   marketplace_sec.phase9_catalogue_shared_admitted_v2(r.adapter_key,p_adapter_version));
END$$;
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_source_policy_v1(p_adapter_key text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.phase9_provider_registry;
BEGIN
 SELECT * INTO r FROM public.phase9_provider_registry WHERE adapter_key=p_adapter_key FOR SHARE;
 IF r.adapter_key IS NULL THEN RETURN NULL; END IF;
 RETURN marketplace_sec.phase9_catalogue_source_policy_v2(r.adapter_key,r.adapter_version);
END$$;

-- 02c §4.2: per-provider own-record facts, extracted from M84 without widening
-- its v1 ID, work, book or cover grammars. No registry reads in these functions.
CREATE FUNCTION marketplace_sec.phase9_open_library_facts_v1(
 p_record text,p_work text,p_book text,p_cover text)
RETURNS TABLE(valid boolean,cover_ref text)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(marketplace_sec.phase9_catalogue_safe_text_v1(p_record,256)
  AND (p_work IS NULL OR marketplace_sec.phase9_catalogue_safe_text_v1(p_work,256))
  AND p_record ~ '^OL[1-9][0-9]*M$'
  AND (p_work IS NULL OR p_work ~ '^OL[1-9][0-9]*W$')
  AND (p_book IS NULL OR p_book='https://openlibrary.org/books/'||p_record)
  AND (p_cover IS NULL OR p_cover ~ '^https://covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-M[.]jpg$'),false),
  pg_catalog.substring(p_cover,'/b/id/([1-9][0-9]*)-M[.]jpg$')
$$;
CREATE FUNCTION marketplace_sec.phase9_open_library_facts_v2(
 p_record text,p_work text,p_book text,p_cover text)
RETURNS TABLE(valid boolean,cover_ref text)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM marketplace_sec.phase9_open_library_facts_v1(p_record,p_work,p_book,p_cover)
$$;
CREATE FUNCTION marketplace_sec.phase9_google_books_facts_v1(
 p_record text,p_work text,p_book text,p_cover text)
RETURNS TABLE(valid boolean,cover_ref text)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(pg_catalog.char_length(p_record) BETWEEN 1 AND 256 AND p_record ~ '^[A-Za-z0-9_-]+$'
  AND p_work IS NULL AND (p_book IS NULL OR (p_book ~ '^https://books[.]google[.]com/books[?][^[:space:]\\]*$'
   AND pg_catalog.regexp_count(p_book,'[?&]id=')=1
   AND pg_catalog.substring(p_book,'[?&]id=([^&#]*)')=p_record))
  AND (p_cover IS NULL OR (p_cover ~ '^https://books[.]google[.]com/[^[:space:]\\]*$'
   AND pg_catalog.regexp_count(p_cover,'[?&]id=')<=1
   AND (pg_catalog.regexp_count(p_cover,'[?&]id=')=0
    OR pg_catalog.substring(p_cover,'[?&]id=([^&#]*)')=p_record))),false),
  pg_catalog.substring(p_cover,'[?&]id=([^&#]*)')
$$;

-- 02c §4.2: fixed version dispatch shared by metadata, rows and cache payloads.
CREATE FUNCTION marketplace_sec.phase9_provider_facts_valid_v1(
 p_key text,p_version text,p_record text,p_work text,p_book text,p_cover text)
RETURNS TABLE(valid boolean,cover_ref text)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 CASE marketplace_sec.phase9_provider_validation_contract_v1(p_key,p_version)->>'validationContract'
 WHEN 'open-library-v1' THEN RETURN QUERY
  SELECT * FROM marketplace_sec.phase9_open_library_facts_v1(p_record,p_work,p_book,p_cover);
 WHEN 'open-library-v2' THEN RETURN QUERY
  SELECT * FROM marketplace_sec.phase9_open_library_facts_v2(p_record,p_work,p_book,p_cover);
 WHEN 'google-books-v1' THEN RETURN QUERY
  SELECT * FROM marketplace_sec.phase9_google_books_facts_v1(p_record,p_work,p_book,p_cover);
 ELSE RETURN QUERY SELECT false,NULL::text;
 END CASE;
END$$;

-- 02c §4.2: the original seven-key completion and nine-key receipt envelopes.
CREATE FUNCTION marketplace_sec.phase9_provider_call_shape_v1(p_completion jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb:=p_completion; receipt jsonb; terminal jsonb;
BEGIN
 IF pg_catalog.jsonb_typeof(c) IS DISTINCT FROM 'object'
  OR NOT c ?& ARRAY['providerRole','primaryAdapterKey','predecessorOutcome','queryKind','rows','terminalReceipt','receipts']
  OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(c))<>7
  OR pg_catalog.jsonb_typeof(c->'rows') IS DISTINCT FROM 'array'
  OR pg_catalog.jsonb_typeof(c->'receipts') IS DISTINCT FROM 'array'
  OR pg_catalog.jsonb_array_length(c->'rows')>10
  OR pg_catalog.jsonb_typeof(c->'providerRole') IS DISTINCT FROM 'string'
  OR pg_catalog.jsonb_typeof(c->'primaryAdapterKey') IS DISTINCT FROM 'string'
  OR pg_catalog.jsonb_typeof(c->'queryKind') IS DISTINCT FROM 'string'
  OR c->>'queryKind' NOT IN('isbn','bibliographic','approved_strong_evidence')
  OR pg_catalog.jsonb_typeof(c->'terminalReceipt') IS DISTINCT FROM 'object'
 THEN RETURN false; END IF;
 terminal:=c->'terminalReceipt';
 IF terminal->>'status' IS DISTINCT FROM 'finalized' OR terminal->'retryable' IS DISTINCT FROM 'false'::jsonb
  OR terminal->'normalizedCandidate' IS DISTINCT FROM 'null'::jsonb
  OR terminal->'matchEvidence' IS DISTINCT FROM '[]'::jsonb
  OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(c->'receipts') r WHERE r=terminal)
 THEN RETURN false; END IF;
 FOR receipt IN SELECT value FROM pg_catalog.jsonb_array_elements(c->'receipts') LOOP
  IF pg_catalog.jsonb_typeof(receipt) IS DISTINCT FROM 'object'
   OR NOT receipt ?& ARRAY['callSequence','callStage','status','egressStarted','retryable','normalizedOutcome',
    'logicalOutcome','normalizedCandidate','matchEvidence']
   OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(receipt))<>9
  THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;

CREATE FUNCTION marketplace_sec.phase9_google_books_call_contract_v1(p_completion jsonb)
RETURNS TABLE(valid boolean,logical_outcome text)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(marketplace_sec.phase9_provider_call_shape_v1(p_completion)
  AND p_completion#>>'{terminalReceipt,logicalOutcome}' IN
   ('coherent_match','ambiguous_match','material_conflict','no_acceptable_match'),false),
  p_completion#>>'{terminalReceipt,logicalOutcome}'
$$;

-- 02c §4.2: pure installed call-contract dispatch for version-aware consumers.
CREATE FUNCTION marketplace_sec.phase9_provider_call_contract_v1(p_key text,p_version text,p_completion jsonb)
RETURNS TABLE(valid boolean,logical_outcome text)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 CASE marketplace_sec.phase9_provider_validation_contract_v1(p_key,p_version)->>'validationContract'
 WHEN 'open-library-v1' THEN RETURN QUERY
  SELECT * FROM marketplace_sec.phase9_open_library_call_contract_v1(p_completion);
 WHEN 'open-library-v2' THEN RETURN QUERY
  SELECT * FROM marketplace_sec.phase9_open_library_call_contract_v2(p_completion);
 WHEN 'google-books-v1' THEN RETURN QUERY
  SELECT * FROM marketplace_sec.phase9_google_books_call_contract_v1(p_completion);
 ELSE RETURN QUERY SELECT false,NULL::text;
 END CASE;
END$$;

-- 02c §4.2: legacy signature is retained for v1 consumers. Version-aware facts
-- dispatch above is used by metadata and rows; no registry is read from CHECKs.
-- 02c section 4.2: unchanged M84 OL receipt grammar and author-failure isolation.
CREATE FUNCTION marketplace_sec.phase9_open_library_call_contract_v1(p_completion jsonb)
RETURNS TABLE(valid boolean,logical_outcome text)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb:=p_completion; receipt jsonb; seq integer; seen integer[]:=ARRAY[]::integer[];
BEGIN
 valid:=false; logical_outcome:=NULL;
 IF NOT marketplace_sec.phase9_provider_call_shape_v1(c)
  OR pg_catalog.jsonb_array_length(c->'receipts') NOT BETWEEN 1 AND 6 THEN RETURN NEXT; RETURN; END IF;
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
END$$;
CREATE FUNCTION marketplace_sec.phase9_open_library_call_contract_v2(p_completion jsonb)
RETURNS TABLE(valid boolean,logical_outcome text)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM marketplace_sec.phase9_open_library_call_contract_v1(p_completion)
$$;

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
  OR NOT marketplace_sec.phase9_provider_call_shape_v1(c) THEN RETURN NEXT; RETURN; END IF;
 -- 02c §4.2/§4.4: retain legacy pairing until 8a-3 owns locked role/route proof.
 CASE p_adapter_key
 WHEN 'open_library' THEN
  IF NOT coalesce((c->>'providerRole'='primary' AND c->>'primaryAdapterKey'=p_adapter_key)
   OR (c->>'providerRole'='secondary' AND c->>'primaryAdapterKey'='google_books'
    AND c->>'predecessorOutcome' IN('no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
     'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open',
     'network_failure','response_too_large','unsupported_content_type')),false)
  THEN RETURN NEXT; RETURN; END IF;
  SELECT * INTO checked FROM marketplace_sec.phase9_open_library_call_contract_v1(c);
 WHEN 'google_books' THEN
  IF NOT coalesce(c->>'providerRole'='primary' AND c->>'primaryAdapterKey'=p_adapter_key,false)
  THEN RETURN NEXT; RETURN; END IF;
  SELECT * INTO checked FROM marketplace_sec.phase9_google_books_call_contract_v1(c);
 ELSE RETURN NEXT; RETURN;
 END CASE;
 valid:=checked.valid; IF valid THEN logical_outcome:=checked.logical_outcome; END IF;
 RETURN NEXT;
END$$;

-- 02c section 4.2: common M73 shape; anonymous UI snapshots retain the v1 cover grammar.
CREATE FUNCTION marketplace_sec.phase9_provider_metadata_shape_v1(p_metadata jsonb,p_worker boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
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
  OR char_length(p_metadata->>'coverReference') NOT BETWEEN 1 AND 512) THEN RETURN false; END IF;
 IF NOT p_worker AND p_metadata->'coverReference'<>'null'::jsonb AND (jsonb_typeof(p_metadata->'coverReference')<>'string'
  OR char_length(p_metadata->>'coverReference') NOT BETWEEN 1 AND 512 OR p_metadata->>'coverReference'
  !~ '^https://(books[.]google[.]com/[^[:space:]\\]*|covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-M[.]jpg)$') THEN RETURN false; END IF;
 IF p_worker THEN PERFORM (p_metadata->>'fetchedAt')::timestamptz; END IF;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_valid_metadata(p_metadata jsonb,p_worker boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE tuple jsonb; own_valid boolean;
BEGIN
 IF NOT marketplace_sec.phase9_provider_metadata_shape_v1(p_metadata,p_worker) THEN RETURN false; END IF;
 IF NOT p_worker THEN RETURN true; END IF;
 tuple:=marketplace_sec.phase9_provider_validation_contract_v1(p_metadata->>'adapterKey',p_metadata->>'adapterVersion');
 IF tuple IS NULL OR p_metadata->>'contractVersion' IS DISTINCT FROM 'p9-contract-v1'
  OR p_metadata->>'schemaVersion' IS DISTINCT FROM tuple->>'payloadSchemaVersion'
  OR p_metadata->>'normalizerVersion' IS DISTINCT FROM tuple->>'normalizerVersion'
  OR NOT marketplace_sec.phase9_provider_retained_fields_valid_v1(
   p_metadata->>'adapterKey',p_metadata->>'adapterVersion',p_metadata)
 THEN RETURN false; END IF;
 SELECT v.valid INTO own_valid FROM marketplace_sec.phase9_provider_facts_valid_v1(
  p_metadata->>'adapterKey',p_metadata->>'adapterVersion',p_metadata->>'providerRecordId',
  NULL,NULL,p_metadata->>'coverReference') v;
 RETURN coalesce(own_valid,false);
END$$;

-- 02c section 4.2: ordinal/UUID/size checks and selected-source URL binding.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_valid_rows(p_rows jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb; n integer:=0; ids uuid[]:=ARRAY[]::uuid[]; id uuid; own_valid boolean;
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
   THEN RETURN false; END IF;
   SELECT v.valid INTO own_valid FROM marketplace_sec.phase9_provider_facts_valid_v1(
    r#>>'{metadata,adapterKey}',r#>>'{metadata,adapterVersion}',r#>>'{metadata,providerRecordId}',
    NULL,r->>'googleBooksUrl',r#>>'{metadata,coverReference}') v;
   IF NOT coalesce(own_valid,false) THEN RETURN false; END IF;
  ELSE RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;

-- 02c section 4.2: M73/M84 accepted stored option rows without binding the book
-- URL to metadata.providerRecordId. The pre-M90 rules are retained only for the
-- existing CHECK path so a later UPDATE cannot reject rows already accepted; new
-- options are still written through the binding validator above.
CREATE FUNCTION marketplace_sec.phase9_edition_valid_metadata_legacy_v1(p_metadata jsonb,p_worker boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT marketplace_sec.phase9_provider_metadata_shape_v1(p_metadata,false) THEN RETURN false; END IF;
 IF p_worker AND coalesce(p_metadata->>'adapterKey','') NOT IN('google_books','open_library') THEN RETURN false; END IF;
 IF p_worker AND NOT p_metadata ?& ARRAY['contractVersion','schemaVersion','adapterKey','adapterVersion',
  'normalizerVersion','correlationId','attemptId','providerRecordId','fetchedAt','matchRationale','confidence']
 THEN RETURN false; END IF;
 IF p_worker THEN PERFORM (p_metadata->>'fetchedAt')::timestamptz; END IF;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;

CREATE FUNCTION marketplace_sec.phase9_edition_valid_rows_legacy_v1(p_rows jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb; n integer:=0; ids uuid[]:=ARRAY[]::uuid[]; id uuid;
BEGIN
 IF pg_catalog.jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR pg_catalog.jsonb_array_length(p_rows)>10
  OR pg_catalog.octet_length(p_rows::text)>2621440 THEN RETURN false; END IF;
 FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(p_rows) LOOP
  IF pg_catalog.jsonb_typeof(r)<>'object' OR (SELECT pg_catalog.array_agg(k ORDER BY k)
   FROM pg_catalog.jsonb_object_keys(r) k)
   IS DISTINCT FROM ARRAY['eligibility','googleBooksUrl','metadata','optionId','ordinal']
   OR pg_catalog.jsonb_typeof(r->'ordinal')<>'number' OR (r->>'ordinal')::numeric<>n
   OR pg_catalog.jsonb_typeof(r->'optionId')<>'string' THEN RETURN false; END IF;
  id:=(r->>'optionId')::uuid; IF id=ANY(ids) THEN RETURN false; END IF;
  ids:=pg_catalog.array_append(ids,id); n:=n+1;
  IF r->>'eligibility'='unavailable' THEN
   IF r->'metadata'<>'null'::jsonb OR r->'googleBooksUrl'<>'null'::jsonb THEN RETURN false; END IF;
  ELSIF r->>'eligibility' IN ('eligible','ineligible') THEN
   IF NOT marketplace_sec.phase9_edition_valid_metadata_legacy_v1(r->'metadata',true)
    OR pg_catalog.jsonb_typeof(r->'googleBooksUrl') IS DISTINCT FROM 'string'
    OR pg_catalog.char_length(r->>'googleBooksUrl') NOT BETWEEN 1 AND 2048
    OR r->>'googleBooksUrl' !~ '^https://(books[.]google[.]com/books([/?][^[:space:]\\]*)?|openlibrary[.]org/books/OL[1-9][0-9]*M)$'
   THEN RETURN false; END IF;
  ELSE RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;

-- The CHECK path accepts the new binding rules for installed providers and the
-- exact pre-M90 rules for rows M73/M84 already stored. Completion/write
-- functions continue to call the binding validator for every new option list.
CREATE FUNCTION marketplace_sec.phase9_edition_valid_rows_check_v1(p_rows jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_edition_valid_rows(p_rows)
  OR marketplace_sec.phase9_edition_valid_rows_legacy_v1(p_rows)
$$;

ALTER TABLE public.phase9_candidate_edition_state
 DROP CONSTRAINT phase9_candidate_edition_state_options_check;
ALTER TABLE public.phase9_candidate_edition_state
 ADD CONSTRAINT phase9_candidate_edition_state_options_check
 CHECK (marketplace_sec.phase9_edition_valid_rows_check_v1(options));

-- 02c section 4.2 F: scope-independent edition-list veto.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_valid_cache_v1(p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
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
  IF NOT marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(m->>'adapterKey',m->>'adapterVersion')
   OR marketplace_sec.phase9_provider_field_profile_v1(m->>'adapterKey',m->>'adapterVersion') IS NULL
   OR NOT coalesce(marketplace_sec.phase9_edition_valid_normalized_metadata(m),false)
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

-- 02c §4.2 / F1: CHECK compatibility is separate from new-write admission.
CREATE FUNCTION marketplace_sec.phase9_edition_valid_normalized_metadata_legacy_v1(p_metadata jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $function$
DECLARE k text; bound text; isbn10 text; isbn13 text; normalized10 text; normalized13 text;
 limits jsonb:='{"title":512,"subtitle":512,"description":5000,"publisher":256,"publishedDate":32,
 "language":35,"script":16,"editionStatement":256,"series":256,"volume":64,"format":128,
 "isbn10":32,"isbn13":32,"coverReference":512,"contractVersion":64,"schemaVersion":64,
 "adapterKey":64,"adapterVersion":64,"normalizerVersion":64,"correlationId":128,"attemptId":128,
 "providerRecordId":256,"fetchedAt":40,"matchRationale":512}';
BEGIN
 IF NOT marketplace_sec.phase9_edition_valid_metadata_legacy_v1(p_metadata,true)
  OR p_metadata->>'contractVersion' IS DISTINCT FROM 'p9-contract-v1'
  OR p_metadata->>'schemaVersion' IS DISTINCT FROM 'p9-metadata-v1'
  OR p_metadata->>'fetchedAt' !~ ('^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T'
   || '([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$')
 THEN RETURN false; END IF;
 FOR k,bound IN SELECT key,value FROM jsonb_each_text(limits) LOOP
  IF marketplace_sec.phase9_edition_utf16_length(p_metadata->>k)>bound::integer THEN RETURN false; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_metadata->'authors') a
   WHERE marketplace_sec.phase9_edition_utf16_length(a)>256)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_metadata->'categories') a
   WHERE marketplace_sec.phase9_edition_utf16_length(a)>128) THEN RETURN false; END IF;
 isbn10:=upper(regexp_replace(p_metadata->>'isbn10','[[:space:]-]+','','g'));
 isbn13:=regexp_replace(p_metadata->>'isbn13','[[:space:]-]+','','g');
 normalized10:=marketplace_sec.phase9_metadata_normalized_isbn13(isbn10);
 normalized13:=marketplace_sec.phase9_metadata_normalized_isbn13(isbn13);
 IF (isbn10 IS NOT NULL AND (isbn10 !~ '^[0-9]{9}[0-9X]$' OR normalized10 IS NULL))
  OR (isbn13 IS NOT NULL AND (isbn13 !~ '^[0-9]{13}$' OR normalized13 IS NULL))
  OR (isbn10 IS NOT NULL AND isbn13 IS NOT NULL AND normalized10 IS DISTINCT FROM normalized13)
 THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END
$function$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_valid_cache_legacy_v1(p_payload jsonb)
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
  IF NOT coalesce(marketplace_sec.phase9_edition_valid_normalized_metadata_legacy_v1(m),false)
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

CREATE FUNCTION marketplace_sec.phase9_catalogue_valid_cache_check_v1(p_payload jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_catalogue_valid_cache_v1(p_payload)
  OR marketplace_sec.phase9_catalogue_valid_cache_legacy_v1(p_payload)
$$;
ALTER TABLE public.phase9_metadata_cache_entries
 DROP CONSTRAINT phase9_metadata_cache_entries_check1,
 ADD CONSTRAINT phase9_metadata_cache_entries_check1 CHECK(
  (payload_kind='selected_snapshot_v1' AND bibliographic_payload IS NULL AND payload_digest IS NULL
   AND routing_policy_version IS NULL AND ((outcome='positive' AND normalized_snapshot IS NOT NULL)
    OR (outcome<>'positive' AND normalized_snapshot IS NULL)))
  OR (payload_kind='edition_options_v1' AND outcome='positive' AND normalized_snapshot IS NULL
   AND source_attempt_id IS NULL AND provider_record_id IS NULL AND bibliographic_payload IS NOT NULL
   AND payload_digest IS NOT NULL AND routing_policy_version IS NOT NULL AND source_fetched_at IS NOT NULL
   AND source_fetched_at<=expires_at AND expires_at>source_fetched_at
   AND marketplace_sec.phase9_catalogue_valid_cache_check_v1(bibliographic_payload)
   AND (bibliographic_payload->>'sourceFetchedAt')::timestamptz=source_fetched_at
   AND payload_digest=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(bibliographic_payload::text,'UTF8')),'hex')));


-- 02c section 4.2 B: M84 resolver retained with the independent pre-write veto.
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
 -- 02c section 4.2 B: independent pre-write veto after policy/companion binding.
 IF NOT marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(m->>'adapterKey',m->>'adapterVersion')
  OR marketplace_sec.phase9_provider_validation_contract_v1(m->>'adapterKey',m->>'adapterVersion') IS NULL
  OR marketplace_sec.phase9_provider_field_profile_v1(m->>'adapterKey',m->>'adapterVersion') IS NULL
  OR NOT marketplace_sec.phase9_provider_retained_fields_valid_v1(m->>'adapterKey',m->>'adapterVersion',m)
  OR NOT (p_source_policy->>'sharedAdmitted')::boolean THEN RETURN NEXT; RETURN; END IF;
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

-- 02c §4.2 / F2: forward the current M86 core; exact completed receipts
-- retain their original contract, while every new list uses strict validation.
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
 IF l.completed_at IS NULL AND NOT coalesce(marketplace_sec.phase9_edition_valid_rows(p_rows),false)
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
 IF l.completed_at IS NULL THEN
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
 END IF;
 IF p_catalogue_companions IS NOT NULL THEN
  IF pg_catalog.jsonb_typeof(p_catalogue_companions) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
  IF pg_catalog.jsonb_array_length(p_catalogue_companions)>10
   OR pg_catalog.octet_length(p_catalogue_companions::text)>32768
  THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
  FOR companion IN SELECT value FROM pg_catalog.jsonb_array_elements(p_catalogue_companions) LOOP
   SELECT value INTO r FROM pg_catalog.jsonb_array_elements(p_rows) WHERE value->>'optionId'=companion->>'optionId';
   IF l.completed_at IS NULL AND (r IS NULL OR r->'metadata'='null'::jsonb OR r->>'eligibility'='unavailable'
    OR NOT coalesce(marketplace_sec.phase9_catalogue_valid_companion_v1(companion,r->'metadata',(r->>'optionId')::uuid),false))
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
  -- 02c §3.1: current provider policy can shorten new explicit lists. Replay
  -- above returns the original receipt without recalculating its deadline.
  deadline:=least(deadline,(SELECT p_source_fetched_at+pr.options_retention_seconds*interval '1 second'
    FROM public.phase9_provider_registry pr WHERE pr.adapter_key=a.adapter_key));
  IF deadline<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
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
 -- 02c §3.1: identity locks may outlive the provider's retention deadline.
 IF deadline<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
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
 -- Recheck after all remaining writes/lock waits; an exception rolls back the transaction's completion effects.
 IF deadline<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
 RETURN response;
END
$completion$;

-- 02c section 8: postgres-only, including hostile default grants in the harness.
ALTER FUNCTION marketplace_sec.phase9_provider_field_profile_v1(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_field_profile_v1(text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_retained_fields_valid_v1(text,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_retained_fields_valid_v1(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v2(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v2(text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v1(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v1(text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_source_policy_v2(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_source_policy_v2(text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_source_policy_v1(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_source_policy_v1(text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_validation_contract_v1(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_validation_contract_v1(text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_open_library_facts_v1(text,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_open_library_facts_v1(text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_open_library_facts_v2(text,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_open_library_facts_v2(text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_google_books_facts_v1(text,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_google_books_facts_v1(text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_facts_valid_v1(text,text,text,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_facts_valid_v1(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_call_shape_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_call_shape_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_google_books_call_contract_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_google_books_call_contract_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_call_contract_v1(text,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_call_contract_v1(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_open_library_call_contract_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_open_library_call_contract_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_open_library_call_contract_v2(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_open_library_call_contract_v2(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_metadata_shape_v1(jsonb,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_metadata_shape_v1(jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_edition_valid_metadata(jsonb,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_valid_metadata(jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_edition_valid_rows(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_valid_rows(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_edition_valid_metadata_legacy_v1(jsonb,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_valid_metadata_legacy_v1(jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_edition_valid_rows_legacy_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_valid_rows_legacy_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_edition_valid_rows_check_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_valid_rows_check_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_valid_cache_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_valid_cache_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_edition_valid_normalized_metadata_legacy_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_valid_normalized_metadata_legacy_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_valid_cache_legacy_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_valid_cache_legacy_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_valid_cache_check_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_valid_cache_check_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
