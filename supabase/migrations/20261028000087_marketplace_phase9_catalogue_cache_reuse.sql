-- 02b sections 5,6.2,7.2,8,9,12: M87 / package 9c, cache-only reuse.
-- Depends on M84/M85/M86. Creates the postgres-only reuse core and the private
-- service entry/public invoker wrapper with explicit ACLs. Deliberately creates
-- no physical calls, usage reservations, automatic snapshots or worker deployment.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_reuse_cache_core_v1(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,
 p_request_generation integer,p_query_identity text,p_cache_versions jsonb,p_source_policy jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
 sess public.image_extraction_sessions; registry public.phase9_provider_registry;
 cache public.phase9_metadata_cache_entries; locked public.phase9_metadata_cache_entries;
 v jsonb:=p_cache_versions; k text; scope text; identity text; replay jsonb;
 lookup_id uuid; attempt_id uuid; option_id uuid; r jsonb; m jsonb; companion jsonb;
 rows jsonb:='[]'; companions jsonb:='[]'; plan jsonb:='[]'; results jsonb:='[]';
 keys bigint[]:=ARRAY[]::bigint[]; option_keys bigint[]; key bigint; pair record; item record;
 summary text; outcome text; response jsonb; digest text; eligible boolean; ok boolean;
 deadline timestamptz; original_digest text; isbn10 text; isbn13 text;
BEGIN
 SELECT * INTO sess FROM public.image_extraction_sessions WHERE id=p_session_id FOR KEY SHARE;
 c:=marketplace_sec.phase9_edition_assert_fence(p_job_id,p_worker,p_lease_token,p_attempt_count,
  p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,true);
 IF c.id IS NULL OR sess.store_id IS DISTINCT FROM c.store_id THEN RETURN pg_catalog.jsonb_build_object('status','miss'); END IF;
 replay:=marketplace_sec.phase9_recover_candidate_edition_options_v1(p_job_id,p_worker,p_lease_token,p_attempt_count,
  p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity);
 IF replay->>'status'='replayed' THEN RETURN replay; END IF;
 IF EXISTS(SELECT 1 FROM public.phase9_metadata_lookups WHERE job_id=p_job_id)
  OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations WHERE job_id=p_job_id)
  OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls WHERE job_id=p_job_id)
 THEN RETURN pg_catalog.jsonb_build_object('status','miss'); END IF;
 IF pg_catalog.jsonb_typeof(v) IS DISTINCT FROM 'object'
  OR (SELECT array_agg(name ORDER BY name) FROM pg_catalog.jsonb_object_keys(v) name)
   IS DISTINCT FROM ARRAY['adapterKey','adapterVersion','cachePolicyVersion','capabilityVersion','companionVersion',
    'normalizerVersion','reusePolicyVersion','routingPolicyVersion','schemaVersion']
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 FOR k IN SELECT pg_catalog.jsonb_object_keys(v) LOOP
  IF pg_catalog.jsonb_typeof(v->k) IS DISTINCT FROM 'string'
   OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(v->>k,128)
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 END LOOP;
 IF v->>'companionVersion'<>'psr-catalogue-write-v1' THEN RETURN pg_catalog.jsonb_build_object('status','miss'); END IF;
 IF NOT coalesce(marketplace_sec.phase9_catalogue_source_policy_valid_v1(p_source_policy),false)
  OR p_source_policy->>'adapterKey' IS DISTINCT FROM v->>'adapterKey'
  OR p_source_policy->>'adapterVersion' IS DISTINCT FROM v->>'adapterVersion'
 THEN RAISE EXCEPTION 'P9_CATALOGUE_SOURCE_POLICY_INVALID'; END IF;
 IF NOT (p_source_policy->>'sharedAdmitted')::boolean THEN RETURN pg_catalog.jsonb_build_object('status','miss'); END IF;
 SELECT * INTO registry FROM public.phase9_provider_registry WHERE adapter_key=v->>'adapterKey' FOR SHARE;
 IF p_source_policy->>'policyVersion' IS DISTINCT FROM registry.policy_version::text
  OR p_source_policy->'rawRetentionSeconds' IS DISTINCT FROM pg_catalog.to_jsonb(registry.raw_retention_seconds)
  OR p_source_policy->'revalidationSeconds' IS DISTINCT FROM coalesce(pg_catalog.to_jsonb(registry.revalidation_seconds),'null'::jsonb)
  OR p_source_policy->'sharedSourceNote' IS DISTINCT FROM coalesce(pg_catalog.to_jsonb(registry.shared_source_note),'null'::jsonb)
 THEN RAISE EXCEPTION 'P9_CATALOGUE_SOURCE_POLICY_INVALID'; END IF;
 IF registry.provider_kind IS DISTINCT FROM 'metadata' OR NOT registry.enabled OR NOT registry.matching_allowed
  OR NOT registry.storage_allowed OR NOT registry.public_display_allowed OR registry.revalidation_seconds IS NULL
  OR registry.adapter_version IS DISTINCT FROM v->>'adapterVersion'
  OR registry.policy_version::text IS DISTINCT FROM v->>'reusePolicyVersion'
 THEN RETURN pg_catalog.jsonb_build_object('status','miss'); END IF;
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 scope:=marketplace_sec.phase9_catalogue_query_scope_v1(c.id,NULL);
 identity:='psr-edition-cache-v1:'||pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
  'psr-edition-cache-v1',scope,CASE WHEN scope='store_private' THEN c.store_id ELSE NULL END,p_query_identity,
  v->>'adapterKey',v->>'adapterVersion',v->>'capabilityVersion',v->>'normalizerVersion',v->>'schemaVersion',
  v->>'routingPolicyVersion',v->>'cachePolicyVersion',v->>'reusePolicyVersion',v->>'companionVersion')::text,'UTF8')),'hex');
 -- Tentative immutable copy: DO NOT take a cache SHARE lock before identity locks.
 SELECT * INTO cache FROM public.phase9_metadata_cache_entries WHERE provider_cache_identity=identity
  AND payload_kind='edition_options_v1' AND query_identity=p_query_identity AND privacy_scope=scope
  AND store_id IS NOT DISTINCT FROM CASE WHEN scope='store_private' THEN c.store_id ELSE NULL END
  AND adapter_key=v->>'adapterKey' AND adapter_version=v->>'adapterVersion'
  AND capability_version=v->>'capabilityVersion' AND normalizer_version=v->>'normalizerVersion'
  AND schema_version=v->>'schemaVersion' AND routing_policy_version=v->>'routingPolicyVersion'
  AND cache_policy_version=v->>'cachePolicyVersion' AND reuse_policy_version=v->>'reusePolicyVersion'
  AND invalidated_at IS NULL AND expires_at>pg_catalog.clock_timestamp();
 IF cache.id IS NULL OR NOT marketplace_sec.phase9_catalogue_valid_cache_v1(cache.bibliographic_payload)
  OR cache.source_fetched_at>pg_catalog.clock_timestamp()
  OR cache.payload_digest IS DISTINCT FROM pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(cache.bibliographic_payload::text,'UTF8')),'hex')
 THEN RETURN pg_catalog.jsonb_build_object('status','miss'); END IF;
 deadline:=least(cache.expires_at,cache.source_fetched_at+registry.revalidation_seconds*interval '1 second');
 IF deadline<=pg_catalog.clock_timestamp() THEN RETURN pg_catalog.jsonb_build_object('status','miss'); END IF;
 original_digest:=cache.payload_digest;
 -- Everything below is one rollback boundary, including private FK-dependent
 -- rows. P9C02 means the tentative entry changed/expired: no partial hit survives.
 BEGIN
  lookup_id:=pg_catalog.gen_random_uuid(); attempt_id:=pg_catalog.gen_random_uuid();
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(cache.bibliographic_payload->'rows') LOOP
   option_id:=pg_catalog.gen_random_uuid(); m:=r->'metadata'; companion:=NULL;
   IF r->>'eligibility'<>'unavailable' THEN
    SELECT i.admitted,i.isbn10,i.isbn13 INTO ok,isbn10,isbn13
     FROM marketplace_sec.phase9_catalogue_isbn_v1(m->>'isbn10',m->>'isbn13') i;
    IF NOT coalesce(ok,false) OR EXISTS(SELECT 1 FROM public.canonical_editions ed WHERE ed.hidden
     AND (ed.id IN(SELECT p.canonical_edition_id FROM public.canonical_provider_ids p
       WHERE p.adapter_key=v->>'adapterKey' AND p.id_kind='edition' AND p.external_id=m->>'providerRecordId')
      OR ed.isbn_13=isbn13 OR ed.isbn_10=isbn10))
    THEN CONTINUE; END IF;
    m:=m||pg_catalog.jsonb_build_object('correlationId',lookup_id,'attemptId',attempt_id,'confidence',0,
     'matchRationale',CASE WHEN p_query_identity::jsonb->>3 IS NOT NULL
      AND p_query_identity::jsonb->>3=coalesce(marketplace_sec.phase9_metadata_normalized_isbn13(m->>'isbn13'),
       marketplace_sec.phase9_metadata_normalized_isbn13(m->>'isbn10')) THEN 'exact_validated_isbn'
      ELSE 'confirmation_required_text_evidence' END);
    IF NOT marketplace_sec.phase9_edition_valid_normalized_metadata(m)
     OR m->>'adapterKey' IS DISTINCT FROM v->>'adapterKey' OR m->>'adapterVersion' IS DISTINCT FROM v->>'adapterVersion'
     OR m->>'normalizerVersion' IS DISTINCT FROM v->>'normalizerVersion' THEN RAISE SQLSTATE 'P9C02'; END IF;
    companion:=r->'companion'||pg_catalog.jsonb_build_object('optionId',option_id,'lookupId',lookup_id,'attemptId',attempt_id,
     'adapterKey',m->'adapterKey','adapterVersion',m->'adapterVersion','normalizerVersion',m->'normalizerVersion',
     'providerRecordId',m->'providerRecordId','fetchedAt',m->'fetchedAt');
    IF NOT marketplace_sec.phase9_catalogue_valid_companion_v1(companion,m,option_id) THEN RAISE SQLSTATE 'P9C02'; END IF;
    companions:=companions||pg_catalog.jsonb_build_array(companion);
    eligible:=marketplace_sec.phase9_edition_option_eligible(m,p_query_identity);
   ELSE eligible:=false; END IF;
   -- Display ordinals are compacted after filtering, as required by the existing
   -- M73 strict row validator. Cache ordinals retain their original source slots.
   rows:=rows||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('optionId',option_id,
    'ordinal',pg_catalog.jsonb_array_length(rows),'eligibility',CASE WHEN r->>'eligibility'='unavailable'
     THEN 'unavailable' WHEN eligible THEN 'eligible' ELSE 'ineligible' END,'googleBooksUrl',r->'googleBooksUrl','metadata',m));
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(rows) row WHERE row->>'eligibility'='eligible')
   OR NOT marketplace_sec.phase9_edition_valid_rows(rows) THEN RAISE SQLSTATE 'P9C02'; END IF;
  IF pg_catalog.octet_length(companions::text)>32768 THEN RAISE SQLSTATE 'P9C02'; END IF;
  summary:=CASE WHEN EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(rows) row
    WHERE row->>'eligibility'='eligible' AND row#>>'{metadata,matchRationale}'='exact_validated_isbn')
   THEN 'accepted_metadata_match' ELSE 'ambiguous' END;
  outcome:=CASE summary WHEN 'accepted_metadata_match' THEN 'coherent_match' ELSE 'ambiguous_match' END;
  INSERT INTO public.phase9_metadata_lookups(id,candidate_id,store_id,job_id,query_identity,execution_mode,
   provider_cache_identity,adapter_key,adapter_version,capability_version,schema_version,lookup_strategy,
   lookup_contract_version,normalizer_version,routing_policy_version,privacy_scope,reuse_policy_version,
   cache_policy_version,cache_namespace,claim_attempt_number,claim_worker,claim_lease_token_hash)
  VALUES(lookup_id,c.id,c.store_id,p_job_id,p_query_identity,'cache_hit',identity,v->>'adapterKey',v->>'adapterVersion',
   v->>'capabilityVersion',v->>'schemaVersion',p_query_identity::jsonb->>2,p_query_identity::jsonb->>0,
   v->>'normalizerVersion',v->>'routingPolicyVersion','store_private',v->>'reusePolicyVersion',
   v->>'cachePolicyVersion','psr-edition-cache-v1',p_attempt_count,p_worker,
   pg_catalog.encode(extensions.digest(p_lease_token,'sha256'),'hex'));
  INSERT INTO public.metadata_enrichment_attempts(id,candidate_id,store_id,lookup_id,adapter_key,adapter_version,
   capability_version,schema_version,normalizer_version,routing_policy_version,reuse_policy_version,
   provider_cache_identity,provider_role,provider_attempt_identity,attempt_sequence,query_kind,query_identity,
   normalized_request_clues,status,cache_status,disposition,normalized_outcome,calculated_cost_units,delete_after,completed_at)
  VALUES(attempt_id,c.id,c.store_id,lookup_id,v->>'adapterKey',v->>'adapterVersion',v->>'capabilityVersion',
   v->>'schemaVersion',v->>'normalizerVersion',v->>'routingPolicyVersion',registry.policy_version,identity,
   'primary',pg_catalog.gen_random_uuid(),1,p_query_identity::jsonb->>2,p_query_identity,'{}','completed',
   'positive_hit','rejected',outcome,0,deadline,pg_catalog.transaction_timestamp());
  digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object('version','psr-edition-cache-v1',
   'cacheId',cache.id,'payloadDigest',cache.payload_digest,'requestId',p_request_id,'requestGeneration',p_request_generation,
   'queryIdentity',p_query_identity,'rows',rows,'companions',companions)::text,'UTF8')),'hex');
  INSERT INTO marketplace_sec.phase9_catalogue_lookup_effects(lookup_id,candidate_id,store_id,session_id,
   request_generation,completion_digest,canonical_results,completion_response)
  VALUES(lookup_id,c.id,c.store_id,c.session_id,p_request_generation,digest,'[]','{}');
  FOR companion IN SELECT value FROM pg_catalog.jsonb_array_elements(companions) LOOP
   SELECT value->'metadata' INTO m FROM pg_catalog.jsonb_array_elements(rows) WHERE value->>'optionId'=companion->>'optionId';
   INSERT INTO marketplace_sec.phase9_catalogue_companions(lookup_id,attempt_id,candidate_id,store_id,session_id,
    provider_record_id,option_id,payload_version,metadata_digest,companion)
   VALUES(lookup_id,attempt_id,c.id,c.store_id,c.session_id,m->>'providerRecordId',(companion->>'optionId')::uuid,
    companion->>'version',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(m::text,'UTF8')),'hex'),companion);
  END LOOP;
  -- Full deduplicated batch plan, before catalogue row locks, exactly as M84.
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(rows) LOOP
   SELECT value INTO companion FROM pg_catalog.jsonb_array_elements(companions) WHERE value->>'optionId'=r->>'optionId';
   option_keys:=ARRAY[]::bigint[];
   IF r->>'eligibility'='eligible' THEN option_keys:=marketplace_sec.phase9_catalogue_plan_keys_v1(r->'metadata',companion); END IF;
   keys:=keys||option_keys;
   plan:=plan||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('row',r,'companion',companion,'keys',option_keys));
  END LOOP;
  FOR key IN SELECT DISTINCT value FROM pg_catalog.unnest(keys) value ORDER BY value
  LOOP PERFORM pg_catalog.pg_advisory_xact_lock(key); END LOOP;
  FOR item IN SELECT value AS payload FROM pg_catalog.jsonb_array_elements(plan)
   ORDER BY (SELECT pg_catalog.min(value::text::bigint) FROM pg_catalog.jsonb_array_elements(value->'keys') value),
    (value#>>'{row,ordinal}')::integer LOOP
   r:=item.payload->'row'; companion:=nullif(item.payload->'companion','null'::jsonb);
   IF pg_catalog.jsonb_array_length(item.payload->'keys')=0 THEN CONTINUE; END IF;
   option_keys:=marketplace_sec.phase9_catalogue_plan_keys_v1(r->'metadata',companion);
   IF NOT option_keys <@ keys THEN CONTINUE; END IF;
   SELECT resolved.canonical_work_id,resolved.canonical_edition_id INTO pair
    FROM marketplace_sec.phase9_catalogue_resolve_v1(r->'metadata',companion,p_source_policy) resolved;
   results:=results||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('optionId',r->'optionId',
    'canonicalWorkId',pair.canonical_work_id,'canonicalEditionId',pair.canonical_edition_id));
  END LOOP;
  SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('optionId',opt->'optionId',
   'canonicalWorkId',hit->'canonicalWorkId','canonicalEditionId',hit->'canonicalEditionId') ORDER BY (opt->>'ordinal')::integer),'[]'::jsonb)
  INTO results FROM pg_catalog.jsonb_array_elements(rows) opt LEFT JOIN LATERAL (
   SELECT value AS hit FROM pg_catalog.jsonb_array_elements(results) WHERE value->'optionId'=opt->'optionId') resolved ON true;
  -- AC7-6 / 02b sections 6.2/8.2: cover ALL retained rows after the existing
  -- locks, even ineligible rows and null-pair skips. Do not acquire unplanned
  -- edition locks after the resolver's ordered phase. Such unlocked matches
  -- retain a final-read-to-commit hide window; P9C02 keeps refusal atomic.
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(rows) row
   CROSS JOIN marketplace_sec.phase9_catalogue_isbn_v1(row#>>'{metadata,isbn10}',row#>>'{metadata,isbn13}') i
   JOIN public.canonical_editions ed ON ed.isbn_10=i.isbn10 OR ed.isbn_13=i.isbn13 OR ed.id IN(
    SELECT p.canonical_edition_id FROM public.canonical_provider_ids p WHERE p.adapter_key=v->>'adapterKey'
     AND p.id_kind='edition' AND p.external_id=row#>>'{metadata,providerRecordId}')
   WHERE row->>'eligibility'<>'unavailable' AND ed.hidden) THEN RAISE SQLSTATE 'P9C02'; END IF;
  UPDATE public.phase9_candidate_edition_state SET options_version=options_version+1,options=rows,
   source_lookup_id=lookup_id,source_attempt_id=attempt_id,source_fetched_at=cache.source_fetched_at,
   options_expires_at=deadline,updated_at=pg_catalog.transaction_timestamp() WHERE candidate_id=c.id RETURNING * INTO s;
  UPDATE public.phase9_metadata_lookups SET normalized_outcome=summary,outcome_source_attempt_id=attempt_id,
   completed_at=pg_catalog.transaction_timestamp() WHERE id=lookup_id;
  response:=marketplace_sec.phase9_edition_completion_receipt(s,'completed');
  UPDATE marketplace_sec.phase9_catalogue_lookup_effects e SET canonical_results=results,completion_response=response
   WHERE e.lookup_id=s.source_lookup_id;
  -- Recheck and lock cache LAST. The already-held private locks allow the final
  -- job write without taking a new private lock after this shared phase.
  SELECT * INTO locked FROM public.phase9_metadata_cache_entries WHERE id=cache.id FOR UPDATE;
  IF locked.id IS NULL OR locked IS DISTINCT FROM cache OR locked.payload_digest IS DISTINCT FROM original_digest
   OR locked.bibliographic_payload IS DISTINCT FROM cache.bibliographic_payload OR locked.invalidated_at IS NOT NULL
   OR locked.expires_at<=pg_catalog.clock_timestamp() OR deadline<=pg_catalog.clock_timestamp()
  THEN RAISE SQLSTATE 'P9C02'; END IF;
  -- Bind cache provenance only now: the cache FK itself takes a KEY SHARE lock,
  -- so filling it before catalogue locks would violate the lock graph.
  UPDATE marketplace_sec.phase9_catalogue_lookup_effects e SET cache_entry_id=locked.id,
   cache_payload_digest=locked.payload_digest WHERE e.lookup_id=s.source_lookup_id;
  UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,
   lease_expires_at=NULL,completed_at=pg_catalog.transaction_timestamp(),updated_at=pg_catalog.transaction_timestamp() WHERE id=p_job_id;
  RETURN response;
 EXCEPTION WHEN SQLSTATE 'P9C02' THEN RETURN pg_catalog.jsonb_build_object('status','miss');
 END;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_reuse_cache_core_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_reuse_cache_core_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_reuse_candidate_edition_cache_v1(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,
 p_request_generation integer,p_query_identity text,p_cache_versions jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; sess public.image_extraction_sessions; policy jsonb; replay jsonb; k text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED'; END IF;
 SELECT * INTO sess FROM public.image_extraction_sessions WHERE id=p_session_id FOR KEY SHARE;
 c:=marketplace_sec.phase9_edition_assert_fence(p_job_id,p_worker,p_lease_token,p_attempt_count,
  p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,true);
 IF c.id IS NULL OR sess.store_id IS DISTINCT FROM c.store_id THEN RETURN pg_catalog.jsonb_build_object('status','miss'); END IF;
 replay:=marketplace_sec.phase9_recover_candidate_edition_options_v1(p_job_id,p_worker,p_lease_token,p_attempt_count,
  p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity);
 IF replay->>'status'='replayed' THEN RETURN replay; END IF;
 IF pg_catalog.jsonb_typeof(p_cache_versions) IS DISTINCT FROM 'object'
  OR (SELECT array_agg(name ORDER BY name) FROM pg_catalog.jsonb_object_keys(p_cache_versions) name)
   IS DISTINCT FROM ARRAY['adapterKey','adapterVersion','cachePolicyVersion','capabilityVersion','companionVersion',
    'normalizerVersion','reusePolicyVersion','routingPolicyVersion','schemaVersion']
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 FOR k IN SELECT pg_catalog.jsonb_object_keys(p_cache_versions) LOOP
  IF pg_catalog.jsonb_typeof(p_cache_versions->k) IS DISTINCT FROM 'string'
   OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(p_cache_versions->>k,128)
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 END LOOP;
 IF p_cache_versions->>'companionVersion'<>'psr-catalogue-write-v1' THEN RETURN pg_catalog.jsonb_build_object('status','miss'); END IF;
 policy:=marketplace_sec.phase9_catalogue_source_policy_v1(p_cache_versions->>'adapterKey');
 IF policy IS NULL OR policy->>'adapterVersion' IS DISTINCT FROM p_cache_versions->>'adapterVersion'
  OR policy->>'policyVersion' IS DISTINCT FROM p_cache_versions->>'reusePolicyVersion'
 THEN RETURN pg_catalog.jsonb_build_object('status','miss'); END IF;
 RETURN marketplace_sec.phase9_catalogue_reuse_cache_core_v1(p_job_id,p_worker,p_lease_token,p_attempt_count,
  p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,p_cache_versions,policy);
END$$;
ALTER FUNCTION marketplace_sec.phase9_reuse_candidate_edition_cache_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_reuse_candidate_edition_cache_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_reuse_candidate_edition_cache_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.phase9_reuse_candidate_edition_cache_v1(
 p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_candidate_id uuid,p_store_id uuid,p_session_id uuid,p_request_id uuid,
 p_request_generation integer,p_query_identity text,p_cache_versions jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_reuse_candidate_edition_cache_v1(p_job_id,p_worker,p_lease_token,p_attempt_count,
  p_candidate_id,p_store_id,p_session_id,p_request_id,p_request_generation,p_query_identity,p_cache_versions)
$$;
ALTER FUNCTION public.phase9_reuse_candidate_edition_cache_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_reuse_candidate_edition_cache_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_reuse_candidate_edition_cache_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb) TO service_role;
COMMIT;
