-- Owner-authorized migration FILE only; NOT APPLIED. Depends on M89-M91.
-- 02c §§4.2-4.4,8,9 / AC8-7/10/11/12/14; 02b §§6.2/7.2. 8a-4 only.
-- Existing signatures/ACLs/DTOs and stored data are preserved. New entry is idle
-- until 8b. No 02d options publication, 8a-5 queue/retry/protection, or activation.
BEGIN;


-- 02c section 4.2: legacy edition-list publication.
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
 -- 02c section 4.2 / AC8-12 G: veto before ANY incumbent/effect hint.
 IF NOT marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(l.adapter_key,l.adapter_version)
  OR NOT marketplace_sec.phase9_catalogue_shared_admitted_v2(l.adapter_key,l.adapter_version)
 THEN RETURN NULL; END IF;
 SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE id=l.outcome_source_attempt_id
  AND lookup_id=l.id AND candidate_id=l.candidate_id AND store_id=l.store_id;
 IF a.id IS NULL OR a.adapter_key IS DISTINCT FROM l.adapter_key
  OR a.adapter_version IS DISTINCT FROM l.adapter_version
  OR NOT marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(a.adapter_key,a.adapter_version)
 THEN RETURN NULL; END IF;
 IF NOT (p_source_policy->>'sharedAdmitted')::boolean THEN RETURN NULL; END IF;
 SELECT * INTO registry FROM public.phase9_provider_registry WHERE adapter_key=l.adapter_key;
 IF p_source_policy->>'policyVersion' IS DISTINCT FROM registry.policy_version::text
  OR p_source_policy->'rawRetentionSeconds' IS DISTINCT FROM pg_catalog.to_jsonb(registry.raw_retention_seconds)
  OR p_source_policy->'revalidationSeconds' IS DISTINCT FROM coalesce(pg_catalog.to_jsonb(registry.revalidation_seconds),'null'::jsonb)
  OR p_source_policy->'sharedSourceNote' IS DISTINCT FROM coalesce(pg_catalog.to_jsonb(registry.shared_source_note),'null'::jsonb)
 THEN RAISE EXCEPTION 'P9_CATALOGUE_SOURCE_POLICY_INVALID'; END IF;
 IF registry.provider_kind IS DISTINCT FROM 'metadata' OR NOT registry.enabled OR NOT registry.matching_allowed
  OR NOT registry.storage_allowed OR NOT registry.public_display_allowed OR NOT l.adapter_version=ANY(registry.accepted_adapter_versions)
  OR registry.policy_version::text<>l.reuse_policy_version OR registry.revalidation_seconds IS NULL
 THEN RETURN NULL; END IF;
 SELECT * INTO e FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=l.id
  AND candidate_id=l.candidate_id AND store_id=l.store_id;
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
 -- 02c §4.2 G: all saved rows/companions above must still bind this source
 -- before the original cache-entry hint may short-circuit publication.
 IF e.cache_entry_id IS NOT NULL THEN RETURN e.cache_entry_id; END IF;
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

-- 02c sections 4.2/4.3: saved automatic and explicit Add lineage.
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
  v_identity_conflict boolean:=false; v_reused_lineage boolean:=false;
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
  -- 02c section 4.2 / AC8-12 E: source veto precedes the saved-ID hint.
  v_proof_reference:=CASE WHEN x.id IS NOT NULL THEN x.coherent_edition ELSE m END;
  IF v_proof_reference->>'adapterKey' IS NOT NULL THEN
    IF NOT marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(
      v_proof_reference->>'adapterKey',v_proof_reference->>'adapterVersion')
    THEN RETURN NEXT; RETURN; END IF;
    v_policy:=marketplace_sec.phase9_catalogue_source_policy_v2(
      v_proof_reference->>'adapterKey',v_proof_reference->>'adapterVersion');
    IF v_policy IS NULL OR NOT (v_policy->>'sharedAdmitted')::boolean
    THEN RETURN NEXT; RETURN; END IF;
    IF x.selected_attempt_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.metadata_enrichment_attempts source
      JOIN public.phase9_metadata_lookups origin ON origin.id=source.lookup_id
        AND origin.candidate_id=source.candidate_id AND origin.store_id=source.store_id
      JOIN public.phase9_metadata_lookups receiving ON receiving.id=x.lookup_id
        AND receiving.candidate_id=c.id AND receiving.store_id=p_store_id
      WHERE source.id=x.selected_attempt_id AND source.disposition='accepted'
        AND source.normalized_payload=x.coherent_edition
        AND source.adapter_key=v_proof_reference->>'adapterKey'
        AND source.adapter_version=v_proof_reference->>'adapterVersion'
        AND (origin.id=receiving.id OR (receiving.leader_lookup_id=origin.id
          AND receiving.reuse_source_attempt_id=source.id
          AND receiving.completed_at IS NOT NULL AND origin.completed_at IS NOT NULL
          AND receiving.query_identity=origin.query_identity
          AND receiving.adapter_key=source.adapter_key AND receiving.adapter_version=source.adapter_version
          AND (receiving.privacy_scope='public_bibliographic' OR origin.store_id=p_store_id)
          AND EXISTS(SELECT 1 FROM public.phase9_selected_metadata_snapshots leader
            WHERE leader.lookup_id=origin.id AND leader.candidate_id=origin.candidate_id
              AND leader.store_id=origin.store_id AND leader.selected_attempt_id=source.id
              AND leader.coherent_edition=x.coherent_edition
              AND leader.canonical_edition_id IS NOT DISTINCT FROM x.canonical_edition_id
              AND leader.match_evidence=x.match_evidence))))
    THEN RETURN NEXT; RETURN; END IF;
    -- 02c §4.2: the proof above also authorizes the no-hint fallback. Its
    -- receiving snapshot keeps the leader's immutable metadata/attempt IDs.
    v_reused_lineage:=x.selected_attempt_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM public.phase9_metadata_lookups receiving WHERE receiving.id=x.lookup_id
        AND receiving.leader_lookup_id::text=x.coherent_edition->>'correlationId'
        AND receiving.reuse_source_attempt_id=x.selected_attempt_id);
  END IF;
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
        v_policy:=marketplace_sec.phase9_catalogue_source_policy_v2(v_proof_reference->>'adapterKey',v_proof_reference->>'adapterVersion');
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
    IF EXISTS(SELECT 1 FROM public.phase9_metadata_lookups source
      JOIN public.image_extraction_jobs job ON job.id=source.job_id
      WHERE source.id=x.lookup_id AND job.operation_version IS DISTINCT FROM 'p9-owner-edition-options-v1')
    THEN v_query:=marketplace_sec.phase9_metadata_candidate_query_identity(c); END IF;
  END IF;
  IF NOT coalesce(marketplace_sec.phase9_edition_valid_normalized_metadata(m),false)
    OR coalesce(m->>'correlationId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR coalesce(m->>'attemptId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN RETURN NEXT; RETURN; END IF;
  v_lookup:=(m->>'correlationId')::uuid; v_attempt:=(m->>'attemptId')::uuid;
  IF x.id IS NOT NULL AND ((x.lookup_id IS DISTINCT FROM v_lookup AND NOT v_reused_lineage)
    OR x.selected_attempt_id IS DISTINCT FROM v_attempt) THEN RETURN NEXT; RETURN; END IF;
  SELECT * INTO l FROM public.phase9_metadata_lookups lookup
    WHERE lookup.id=v_lookup AND ((lookup.candidate_id=c.id AND lookup.store_id=p_store_id) OR v_reused_lineage)
      AND lookup.query_identity=v_query AND EXISTS(
        SELECT 1 FROM public.image_extraction_jobs job WHERE job.id=lookup.job_id
          AND job.entity_type='candidate' AND job.entity_id=lookup.candidate_id AND job.store_id=lookup.store_id);
  SELECT * INTO a FROM public.metadata_enrichment_attempts attempt
    WHERE attempt.id=v_attempt AND attempt.lookup_id=l.id
      AND attempt.candidate_id=l.candidate_id AND attempt.store_id=l.store_id;
  IF l.id IS NULL OR a.id IS NULL OR a.adapter_key IS DISTINCT FROM m->>'adapterKey'
    OR a.adapter_version IS DISTINCT FROM m->>'adapterVersion'
    OR a.normalizer_version IS DISTINCT FROM m->>'normalizerVersion'
    OR l.normalizer_version IS DISTINCT FROM m->>'normalizerVersion'
  THEN RETURN NEXT; RETURN; END IF;

  -- 02b ?5: the trusted builder holds the registry SHARE lock and binds admission/retention.
  v_policy:=marketplace_sec.phase9_catalogue_source_policy_v2(a.adapter_key,a.adapter_version);
  IF v_policy IS NULL OR v_policy->>'adapterVersion' IS DISTINCT FROM a.adapter_version
    OR v_policy->>'policyVersion' IS DISTINCT FROM l.reuse_policy_version
  THEN RETURN NEXT; RETURN; END IF;
  -- 02c §§4.2/4.3 / AC8-14: the proved cache leader owns the original binding.
  v_companion:=marketplace_sec.phase9_catalogue_companion_for_choice_v1(m,
    CASE WHEN s.selected_source='edition_option' THEN s.selected_source_id ELSE NULL END,
    l.candidate_id,l.store_id,(SELECT source.session_id FROM public.image_extraction_candidates source
      WHERE source.id=l.candidate_id AND source.store_id=l.store_id));
  RETURN QUERY SELECT resolved.canonical_work_id,resolved.canonical_edition_id
    FROM marketplace_sec.phase9_catalogue_resolve_v1(m,v_companion,v_policy) resolved;
END
$catalogue$;

-- 02c §4.2: legacy mode reads current enabled policy; no lock is taken here.
-- The version-bound source-policy builder takes FOR SHARE before identity locks.
-- 8b owns v2-mode automatic capability gating; stored bytes remain unchanged.
CREATE FUNCTION marketplace_sec.phase9_representative_source_enabled_v1(p_key text,p_version text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.phase9_provider_registry r
  WHERE r.adapter_key=p_key AND r.provider_kind='metadata' AND r.enabled
   AND (r.adapter_version=p_version OR p_version=ANY(r.accepted_adapter_versions)))
$$;
ALTER FUNCTION marketplace_sec.phase9_representative_source_enabled_v1(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_representative_source_enabled_v1(text,text)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_with_representative_cover(
  p_detail jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_selection_id uuid; v_candidate_id uuid; v_cover jsonb;
BEGIN
  v_selection_id:=NULLIF(p_detail#>>'{metadata,selectionId}','')::uuid;
  v_candidate_id:=NULLIF(p_detail->>'candidateId','')::uuid;
  IF p_detail#>>'{metadata,state}'='selected'
    AND v_selection_id IS NOT NULL
    AND v_candidate_id IS NOT NULL
    AND coalesce(p_detail#>>'{metadata,snapshot,coverReference}','')=''
  THEN
    SELECT jsonb_build_object(
      'coverReference',r.cover_reference,
      'sourceRelation',r.source_relation,
      'sourceAdapter',r.adapter_key,
      'sourceAdapterVersion',r.adapter_version,
      'sourceRecordId',r.source_provider_record_id,
      'selectionPolicyVersion',r.selection_policy_version)
    INTO v_cover
    FROM public.phase9_selected_metadata_snapshots s
    JOIN marketplace_sec.phase9_metadata_representative_covers r
      ON r.source_attempt_id=s.outcome_source_attempt_id
      AND marketplace_sec.phase9_representative_source_enabled_v1(r.adapter_key,r.adapter_version)
      AND r.source_candidate_id=s.candidate_id
      AND r.source_store_id=s.store_id
    WHERE s.id=v_selection_id AND s.candidate_id=v_candidate_id;
  END IF;
  RETURN jsonb_set(p_detail,'{metadata,representativeCover}',
    coalesce(v_cover,'null'::jsonb),true);
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_metadata_summary(
  p_detail jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_metadata jsonb:=p_detail#>'{metadata,snapshot}';
  v_selected boolean; v_title boolean; v_authors boolean; v_language boolean;
  v_cover boolean; v_selection_id boolean; v_selection uuid; v_representative jsonb;
BEGIN
  v_selected:=p_detail#>>'{metadata,state}'='selected'
    AND jsonb_typeof(v_metadata)='object';
  IF NOT v_selected THEN RETURN NULL; END IF;
  v_title:=marketplace_sec.phase9_owner_ux_safe_text(v_metadata->'title',1,512,false);
  v_authors:=CASE WHEN jsonb_typeof(v_metadata->'authors')='array' THEN
      jsonb_array_length(v_metadata->'authors') BETWEEN 1 AND 20
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_metadata->'authors') author
        WHERE NOT marketplace_sec.phase9_owner_ux_safe_text(author,1,256,false))
      AND (SELECT count(*) FROM jsonb_array_elements(v_metadata->'authors'))
        =(SELECT count(DISTINCT author) FROM jsonb_array_elements(v_metadata->'authors') author)
    ELSE false END;
  v_language:=marketplace_sec.phase9_owner_ux_canonical_language(v_metadata->'language');
  v_cover:=jsonb_typeof(v_metadata->'coverReference')='string'
    AND char_length(v_metadata->>'coverReference') BETWEEN 1 AND 512
    AND v_metadata->>'coverReference'
      ~* '^https://(books[.]google[.]com(?::[0-9]+)?([/?#][^[:space:]]*)?|covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-M[.]jpg)$';
  v_selection_id:=jsonb_typeof(p_detail#>'{metadata,selectionId}')='string'
    AND p_detail#>>'{metadata,selectionId}'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  IF v_selection_id AND NOT v_cover THEN
    v_selection:=(p_detail#>>'{metadata,selectionId}')::uuid;
    SELECT jsonb_build_object(
      'coverReference',r.cover_reference,'sourceRelation',r.source_relation,
      'sourceAdapter',r.adapter_key,'sourceAdapterVersion',r.adapter_version,
      'sourceRecordId',r.source_provider_record_id,
      'selectionPolicyVersion',r.selection_policy_version)
    INTO v_representative
    FROM public.phase9_selected_metadata_snapshots s
    JOIN marketplace_sec.phase9_metadata_representative_covers r
      ON r.source_attempt_id=s.outcome_source_attempt_id
      AND marketplace_sec.phase9_representative_source_enabled_v1(r.adapter_key,r.adapter_version)
    WHERE s.id=v_selection;
  END IF;
  RETURN jsonb_build_object(
    'title',CASE WHEN v_title THEN v_metadata->'title' ELSE 'null'::jsonb END,
    'authors',CASE WHEN v_authors THEN v_metadata->'authors' ELSE 'null'::jsonb END,
    'language',CASE WHEN v_language THEN v_metadata->'language' ELSE 'null'::jsonb END,
    'coverReference',CASE WHEN v_cover THEN v_metadata->'coverReference' ELSE 'null'::jsonb END,
    'selectionId',CASE WHEN v_selection_id
      THEN p_detail#>'{metadata,selectionId}' ELSE 'null'::jsonb END,
    'representativeCover',coalesce(v_representative,'null'::jsonb));
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_set_inventory_representative_cover()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cover jsonb;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.representative_cover IS DISTINCT FROM OLD.representative_cover
      OR NEW.created_from_candidate_id IS DISTINCT FROM OLD.created_from_candidate_id
      OR NEW.entry_method IS DISTINCT FROM OLD.entry_method
    THEN RAISE EXCEPTION 'P9_METADATA_REPRESENTATIVE_COVER_IMMUTABLE'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.representative_cover IS NOT NULL THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  IF NEW.entry_method='image_extraction' AND NEW.created_from_candidate_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'coverReference',r.cover_reference,'sourceRelation',r.source_relation,
      'sourceAdapter',r.adapter_key,'sourceAdapterVersion',r.adapter_version,
      'sourceRecordId',r.source_provider_record_id,
      'selectionPolicyVersion',r.selection_policy_version)
    INTO v_cover
    FROM public.image_extraction_candidates c
    JOIN public.phase9_selected_metadata_snapshots s
      ON s.id=c.selected_metadata_snapshot_id AND s.candidate_id=c.id AND s.store_id=c.store_id
    JOIN marketplace_sec.phase9_metadata_representative_covers r
      ON r.source_attempt_id=s.outcome_source_attempt_id
      AND marketplace_sec.phase9_representative_source_enabled_v1(r.adapter_key,r.adapter_version)
    WHERE c.id=NEW.created_from_candidate_id AND c.store_id=NEW.store_id
      AND c.owner_review_snapshot#>>'{value,metadataChoice,mode}'='selected'
      AND c.owner_review_snapshot#>>'{value,metadataChoice,selectionId}'=s.id::text
      AND coalesce(s.coherent_edition->>'coverReference','')='';
    NEW.representative_cover:=v_cover;
  END IF;
  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_store_metadata_representative_cover_v1(
  p_attempt_id uuid,p_lookup_id uuid,p_job_id uuid,p_worker text,p_lease_token text,
  p_attempt_count integer,p_candidate_id uuid,p_candidate_version integer,
  p_cover_reference text,p_source_provider_record_id text,p_source_relation text,
  p_selection_policy_version text,p_match_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_candidate public.image_extraction_candidates;
  v_lookup public.phase9_metadata_lookups;
  v_attempt public.metadata_enrichment_attempts;
  v_existing marketplace_sec.phase9_metadata_representative_covers;
BEGIN
  IF p_attempt_id IS NULL OR p_lookup_id IS NULL OR p_candidate_id IS NULL
    OR p_cover_reference !~* '^https://books[.]google[.]com(?::[0-9]+)?([/?#][^[:space:]]*)?$'
    OR char_length(p_cover_reference) NOT BETWEEN 1 AND 512
    OR char_length(p_source_provider_record_id) NOT BETWEEN 1 AND 256
    OR p_source_relation<>'representative_edition'
    OR p_selection_policy_version<>'p9-representative-cover-v1'
    OR p_match_evidence<>'["exact_title","exact_author_set","language_compatible"]'::jsonb
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;

  SELECT * INTO v_existing
  FROM marketplace_sec.phase9_metadata_representative_covers r
  WHERE r.source_attempt_id=p_attempt_id;
  IF FOUND THEN
    IF v_existing.cover_reference<>p_cover_reference
      OR v_existing.source_lookup_id<>p_lookup_id
      OR v_existing.source_candidate_id<>p_candidate_id
      OR v_existing.source_job_id<>p_job_id
      OR v_existing.source_provider_record_id<>p_source_provider_record_id
      OR v_existing.source_relation<>p_source_relation
      OR v_existing.selection_policy_version<>p_selection_policy_version
      OR v_existing.match_evidence<>p_match_evidence
    THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
    RETURN jsonb_build_object('source_attempt_id',v_existing.source_attempt_id,
      'status','replayed');
  END IF;

  v_candidate:=marketplace_sec.phase9_assert_structural_metadata_candidate(
    p_job_id,p_worker,p_lease_token,p_attempt_count,p_candidate_id,p_candidate_version);
  SELECT * INTO v_lookup FROM public.phase9_metadata_lookups l
    WHERE l.id=p_lookup_id AND l.job_id=p_job_id
      AND l.candidate_id=v_candidate.id AND l.store_id=v_candidate.store_id;
  SELECT * INTO v_attempt FROM public.metadata_enrichment_attempts a
    WHERE a.id=p_attempt_id AND a.lookup_id=p_lookup_id
      AND a.disposition='accepted' AND a.normalized_outcome='accepted_metadata_match';
  IF v_lookup.id IS NULL OR v_attempt.id IS NULL
    OR v_attempt.normalized_payload IS NULL
    OR coalesce(v_attempt.normalized_payload->>'coverReference','')<>''
    OR v_attempt.normalized_payload->>'providerRecordId'=p_source_provider_record_id
    OR v_attempt.adapter_key IS NULL OR v_attempt.adapter_version IS NULL
    OR NOT marketplace_sec.phase9_representative_source_enabled_v1(v_attempt.adapter_key,v_attempt.adapter_version)
    OR NOT EXISTS(SELECT 1 FROM public.phase9_provider_registry r
      WHERE r.adapter_key=v_attempt.adapter_key
        AND r.adapter_version=v_attempt.adapter_version
        AND r.provider_kind='metadata' AND r.enabled AND r.storage_allowed)
  THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;

  INSERT INTO marketplace_sec.phase9_metadata_representative_covers(
    source_attempt_id,source_lookup_id,source_candidate_id,source_store_id,source_job_id,
    cover_reference,adapter_key,adapter_version,
    source_provider_record_id,source_relation,selection_policy_version,match_evidence)
  VALUES(p_attempt_id,p_lookup_id,v_candidate.id,v_candidate.store_id,p_job_id,
    p_cover_reference,v_attempt.adapter_key,v_attempt.adapter_version,
    p_source_provider_record_id,p_source_relation,p_selection_policy_version,p_match_evidence)
  ON CONFLICT(source_attempt_id) DO NOTHING;
  SELECT * INTO v_existing
  FROM marketplace_sec.phase9_metadata_representative_covers r
  WHERE r.source_attempt_id=p_attempt_id;
  IF v_existing.cover_reference<>p_cover_reference
    OR v_existing.source_lookup_id<>p_lookup_id
    OR v_existing.source_candidate_id<>p_candidate_id
    OR v_existing.source_job_id<>p_job_id
    OR v_existing.source_provider_record_id<>p_source_provider_record_id
    OR v_existing.source_relation<>p_source_relation
    OR v_existing.selection_policy_version<>p_selection_policy_version
    OR v_existing.match_evidence<>p_match_evidence
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN jsonb_build_object('source_attempt_id',v_existing.source_attempt_id,'status','stored');
END$$;

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
  IF v_lookup.privacy_scope='public_bibliographic' AND
    (NOT marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(v_attempt.adapter_key,v_attempt.adapter_version)
     OR NOT marketplace_sec.phase9_catalogue_shared_admitted_v2(v_attempt.adapter_key,v_attempt.adapter_version))
  THEN RAISE EXCEPTION 'P9_METADATA_STORAGE_DENIED'; END IF;
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
  IF v_cache.privacy_scope='public_bibliographic' AND
    (NOT marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(v_cache.adapter_key,v_cache.adapter_version)
     OR NOT marketplace_sec.phase9_catalogue_shared_admitted_v2(v_cache.adapter_key,v_cache.adapter_version))
  THEN RAISE EXCEPTION 'P9_METADATA_REUSE_DENIED'; END IF;
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
  IF p_privacy_scope='public_bibliographic' AND
    (NOT marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(p_adapter_key,p_adapter_version)
     OR NOT marketplace_sec.phase9_catalogue_shared_admitted_v2(p_adapter_key,p_adapter_version))
  THEN RAISE EXCEPTION 'P9_METADATA_REUSE_DENIED'; END IF;
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

-- 02c section 4.2: latest explicit v2 core; v1 delegate/recovery unchanged.
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
 policy:=marketplace_sec.phase9_catalogue_source_policy_v2(a.adapter_key,a.adapter_version);
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

-- 02c §4.2/AC8-9a/14: identity/Select/Add also validate full tagged records
-- through the default mode. Preserve EVERY legacy anonymous acceptance, but
-- permit additional full records only through installed tuple/profile/facts.
-- Stripped anonymous snapshots do not gain a third-host grammar (8b/AC8-9b).
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_valid_metadata(p_metadata jsonb,p_worker boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE tuple jsonb; own_valid boolean;
BEGIN
 IF NOT p_worker AND marketplace_sec.phase9_provider_metadata_shape_v1(p_metadata,false) THEN RETURN true; END IF;
 IF NOT marketplace_sec.phase9_provider_metadata_shape_v1(p_metadata,true) THEN RETURN false; END IF;
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

-- 02c §§4.2/4.3/5.1, AC8-9a: active M73 fan-out finalization still had an
-- OL-only gate. Re-prove the locked source's installed protocol instead. Keep
-- receipts finalizable during a policy drain; no new egress grant is made here.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_finalize_edition_options_provider_call_v1(
 p_provider_call_id uuid,p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,
 p_status text,p_outcome text,p_retryable boolean,p_egress_started boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE pc public.phase9_metadata_provider_calls; receipt jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_egress_started IS NULL
  OR (NOT p_egress_started AND (p_status IS DISTINCT FROM 'stale_rejected' OR p_outcome IS DISTINCT FROM 'cancelled' OR p_retryable IS DISTINCT FROM false))
 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
 PERFORM 1 FROM public.image_extraction_jobs WHERE id=p_job_id FOR UPDATE;
 SELECT pc0.* INTO pc FROM public.phase9_metadata_provider_calls pc0
 JOIN public.metadata_enrichment_attempts a ON a.id=pc0.logical_attempt_id
 JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id AND l.job_id=pc0.job_id
 WHERE pc0.id=p_provider_call_id AND pc0.job_id=p_job_id
  AND a.candidate_id=pc0.candidate_id AND a.store_id=pc0.store_id
  AND l.candidate_id=pc0.candidate_id AND l.store_id=pc0.store_id
  AND pc0.edition_call_sequence IS NOT NULL
  AND ((pc0.grant_epoch IS NULL AND a.adapter_key='open_library')
   OR marketplace_sec.phase9_provider_stage_valid_v1(a.adapter_key,a.adapter_version,
    pc0.edition_call_sequence,pc0.edition_call_stage,l.lookup_strategy)) FOR UPDATE OF pc0;
 IF pc.id IS NULL THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 IF pc.edition_egress_started IS NOT NULL AND pc.edition_egress_started IS DISTINCT FROM p_egress_started
 THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
 receipt:=marketplace_sec.phase9_finalize_metadata_provider_call(p_provider_call_id,p_job_id,p_worker,
  p_lease_token,p_attempt_count,p_status,p_outcome,p_outcome,NULL,p_retryable,NULL,'[]'::jsonb);
 UPDATE public.phase9_metadata_provider_calls SET edition_egress_started=p_egress_started WHERE id=pc.id;
 RETURN receipt;
END
$function$;

-- 02c section 4.3: private receipt, not a queue, retry ledger or option list.
CREATE TABLE marketplace_sec.phase9_automatic_completion_effects (
 lookup_id uuid PRIMARY KEY REFERENCES public.phase9_metadata_lookups(id) ON DELETE CASCADE,
 job_id uuid NOT NULL UNIQUE REFERENCES public.image_extraction_jobs(id),
 candidate_id uuid NOT NULL REFERENCES public.image_extraction_candidates(id),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 session_id uuid NOT NULL REFERENCES public.image_extraction_sessions(id),
 candidate_version integer NOT NULL CHECK(candidate_version>0),
 query_identity text NOT NULL CHECK(char_length(query_identity) BETWEEN 1 AND 2048),
 claim_worker text NOT NULL,
 claim_lease_token_hash text NOT NULL CHECK(claim_lease_token_hash ~ '^[0-9a-f]{64}$'),
 claim_attempt_number integer NOT NULL CHECK(claim_attempt_number BETWEEN 1 AND 5),
 request_generation integer NOT NULL CHECK(request_generation>=0),
 captured_request_id uuid,
 selected_option_id uuid,
 snapshot_id uuid REFERENCES public.phase9_selected_metadata_snapshots(id),
 completion_digest text NOT NULL CHECK(completion_digest ~ '^[0-9a-f]{64}$'),
 receipt jsonb NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp()
);
ALTER TABLE marketplace_sec.phase9_automatic_completion_effects OWNER TO postgres;
ALTER TABLE marketplace_sec.phase9_automatic_completion_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE marketplace_sec.phase9_automatic_completion_effects FROM PUBLIC,anon,authenticated,service_role;

-- Pure common validators; no policy read or SQL name supplied by the caller.
-- 02c sections 4.3/8: JSON types are checked before casts, including integers.
CREATE FUNCTION marketplace_sec.phase9_auto_fence_valid_v1(f jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE k text;
BEGIN
 IF pg_catalog.jsonb_typeof(f) IS DISTINCT FROM 'object'
  OR NOT f ?& ARRAY['jobId','worker','leaseToken','claimAttempt','candidateId','storeId','sessionId',
   'candidateVersion','queryIdentity','capturedRequestId','requestGeneration']
  OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(f))<>11 THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['jobId','candidateId','storeId','sessionId','capturedRequestId'] LOOP
  IF k='capturedRequestId' AND f->k='null'::jsonb THEN CONTINUE; END IF;
  IF pg_catalog.jsonb_typeof(f->k) IS DISTINCT FROM 'string'
   OR f->>k !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN RETURN false; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['claimAttempt','candidateVersion','requestGeneration'] LOOP
  IF pg_catalog.jsonb_typeof(f->k) IS DISTINCT FROM 'number' OR f->>k !~ '^(0|[1-9][0-9]*)$'
   OR (f->>k)::numeric>2147483647 THEN RETURN false; END IF;
 END LOOP;
 RETURN coalesce((f->>'claimAttempt')::integer BETWEEN 1 AND 5
  AND (f->>'candidateVersion')::integer>0
  AND pg_catalog.jsonb_typeof(f->'worker')='string' AND pg_catalog.char_length(f->>'worker')>0
  AND pg_catalog.jsonb_typeof(f->'leaseToken')='string' AND f->>'leaseToken' ~ '^[0-9a-f]{64}$'
  AND marketplace_sec.phase9_owner_ux_safe_text(f->'queryIdentity',1,2048,false),false);
EXCEPTION WHEN numeric_value_out_of_range THEN RETURN false;
END$$;
ALTER FUNCTION marketplace_sec.phase9_auto_fence_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_auto_fence_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION marketplace_sec.phase9_auto_result_valid_v1(r jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE o jsonb:=r->'outcome'; m jsonb; k text;
BEGIN
 IF pg_catalog.jsonb_typeof(r) IS DISTINCT FROM 'object'
  OR NOT r ?& ARRAY['version','purpose','outcome','rows','catalogueCompanions','retention']
  OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(r))<>6
  OR r->>'version' IS DISTINCT FROM 'p9-metadata-result-v2'
  OR r->>'purpose' IS DISTINCT FROM 'automatic'
  OR pg_catalog.jsonb_typeof(o) IS DISTINCT FROM 'object'
  OR NOT o ?& ARRAY['outcome','candidates','selected','evidence','retryable','secondaryEligible',
   'providerRequestId','representativeCover']
  OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(o))<>8
  OR pg_catalog.jsonb_typeof(o->'outcome') IS DISTINCT FROM 'string'
  OR o->>'outcome' NOT IN ('coherent_match','no_acceptable_match','ambiguous_match','material_conflict',
   'provider_unavailable','timeout','network_failure','rate_limited','circuit_breaker_open','malformed_response',
   'schema_invalid','response_too_large','unsupported_content_type','authentication_configuration_failure',
   'insufficient_query','policy_denied','legal_launch_denied','cost_quota_denied','provider_disabled','cancelled')
  OR pg_catalog.jsonb_typeof(o->'candidates') IS DISTINCT FROM 'array'
  OR pg_catalog.jsonb_array_length(o->'candidates')>10
  OR pg_catalog.jsonb_typeof(o->'evidence') IS DISTINCT FROM 'array'
  OR pg_catalog.jsonb_array_length(o->'evidence')>32
  OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(o->'evidence') e
   WHERE pg_catalog.jsonb_typeof(e)<>'string' OR e#>>'{}' !~ '^[a-z][a-z0-9_]{0,63}$')
  OR pg_catalog.jsonb_typeof(o->'retryable') IS DISTINCT FROM 'boolean'
  OR pg_catalog.jsonb_typeof(o->'secondaryEligible') IS DISTINCT FROM 'boolean'
  OR (o->'providerRequestId'<>'null'::jsonb AND NOT coalesce(
   marketplace_sec.phase9_owner_ux_safe_text(o->'providerRequestId',1,128,false),false))
 THEN RETURN false; END IF;
 IF o->>'outcome' NOT IN ('coherent_match','no_acceptable_match','ambiguous_match','material_conflict')
  AND pg_catalog.jsonb_array_length(o->'candidates')<>0 THEN RETURN false; END IF;
 IF (o->>'retryable')::boolean IS DISTINCT FROM (o->>'outcome' IN
   ('provider_unavailable','timeout','network_failure','rate_limited','circuit_breaker_open'))
  OR (o->>'secondaryEligible')::boolean IS DISTINCT FROM (o->>'outcome' IN
   ('no_acceptable_match','ambiguous_match','material_conflict','provider_unavailable','timeout',
    'network_failure','rate_limited','circuit_breaker_open','malformed_response','schema_invalid',
    'response_too_large','unsupported_content_type')) THEN RETURN false; END IF;
 FOR m IN SELECT value FROM pg_catalog.jsonb_array_elements(o->'candidates') LOOP
  IF NOT coalesce(marketplace_sec.phase9_edition_valid_normalized_metadata(m),false) THEN RETURN false; END IF;
 END LOOP;
 IF o->>'outcome'='coherent_match' THEN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(o->'candidates') c WHERE c=o->'selected')
   OR NOT coalesce(marketplace_sec.phase9_edition_valid_normalized_metadata(o->'selected'),false)
   OR pg_catalog.jsonb_array_length(o->'evidence')=0 THEN RETURN false; END IF;
 ELSIF o->'selected' IS DISTINCT FROM 'null'::jsonb THEN RETURN false;
 END IF;
 IF r->'rows'='null'::jsonb THEN
  IF r->'retention' IS DISTINCT FROM 'null'::jsonb
   OR r->'catalogueCompanions' IS DISTINCT FROM 'null'::jsonb THEN RETURN false; END IF;
 ELSE
  IF NOT coalesce(marketplace_sec.phase9_edition_valid_rows(r->'rows'),false)
   OR pg_catalog.jsonb_typeof(r->'retention') IS DISTINCT FROM 'object'
   OR NOT r->'retention' ?& ARRAY['sourceFetchedAt','permittedDeadlineAt','policyVersion','storagePermissionVerified','retentionContract']
   OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(r->'retention'))<>5
   OR r#>'{retention,storagePermissionVerified}' IS DISTINCT FROM 'true'::jsonb
   OR pg_catalog.jsonb_typeof(r#>'{retention,policyVersion}') IS DISTINCT FROM 'number'
   OR r#>>'{retention,policyVersion}' !~ '^[1-9][0-9]*$'
   OR (r#>>'{retention,policyVersion}')::numeric>2147483647
   OR pg_catalog.jsonb_typeof(r#>'{retention,retentionContract}') IS DISTINCT FROM 'string'
   OR r#>>'{retention,retentionContract}' !~ '^[a-z][a-z0-9-]{0,63}$'
   OR pg_catalog.jsonb_typeof(r#>'{retention,permittedDeadlineAt}') IS DISTINCT FROM 'string'
  THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['sourceFetchedAt','permittedDeadlineAt'] LOOP
   IF pg_catalog.jsonb_typeof(r->'retention'->k) IS DISTINCT FROM 'string'
    OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(r->'retention'->>k,40)
    OR r->'retention'->>k !~ ('^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T'
     ||'([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$')
   THEN RETURN false; END IF;
   PERFORM (r->'retention'->>k)::timestamptz;
  END LOOP;
 END IF;
 IF r->'catalogueCompanions'<>'null'::jsonb THEN
  IF pg_catalog.jsonb_typeof(r->'catalogueCompanions') IS DISTINCT FROM 'array'
   OR pg_catalog.jsonb_array_length(r->'catalogueCompanions')>10
   OR pg_catalog.octet_length((r->'catalogueCompanions')::text)>32768 THEN RETURN false; END IF;
 END IF;
 RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END$$;
ALTER FUNCTION marketplace_sec.phase9_auto_result_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_auto_result_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 02c §§3.1/3.2/5.1 / AC8-9a: provider-owned purpose/retention dispatch.
-- The installed field-profile validator may declare purpose/retention contracts
-- by validation-contract key. Registry data cannot name or execute a function;
-- installing a provider never replaces these generic dispatchers.
CREATE FUNCTION marketplace_sec.phase9_provider_purpose_contract_v1(p_key text,p_version text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE contract text:=marketplace_sec.phase9_provider_validation_contract_v1(p_key,p_version)->>'validationContract';
 profile jsonb:=marketplace_sec.phase9_provider_field_profile_v1(p_key,p_version); purpose jsonb;
BEGIN
 IF profile->>'adapterKey'=p_key AND profile->>'adapterVersion'=p_version THEN
  purpose:=profile->'purposeContracts'->contract;
 END IF;
 -- Preserve the installed Google transition and OL v1/v2 contracts exactly.
 purpose:=coalesce(purpose,'{
  "google-books-v1":{"automaticAllowed":true,"retentionContract":null},
  "open-library-v1":{"automaticAllowed":false,"retentionContract":"open-library-options-v1"},
  "open-library-v2":{"automaticAllowed":true,"retentionContract":"open-library-options-v1"}
 }'::jsonb->contract);
 IF pg_catalog.jsonb_typeof(purpose) IS DISTINCT FROM 'object'
  OR pg_catalog.jsonb_typeof(purpose->'automaticAllowed') IS DISTINCT FROM 'boolean'
  OR NOT purpose ? 'retentionContract'
  OR (purpose->'retentionContract'<>'null'::jsonb AND
   (pg_catalog.jsonb_typeof(purpose->'retentionContract') IS DISTINCT FROM 'string'
    OR purpose->>'retentionContract' !~ '^[a-z][a-z0-9-]{0,63}$')) THEN RETURN NULL; END IF;
 RETURN purpose;
END$$;

CREATE FUNCTION marketplace_sec.phase9_open_library_retention_valid_v1(
 p_contract text,p_source_fetched_at timestamptz,p_deadline timestamptz,p_current_policy jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(p_contract='open-library-options-v1'
  AND p_deadline>p_source_fetched_at AND p_deadline<=p_source_fetched_at+interval '24 hours'
  AND (p_current_policy->>'revalidationSeconds' IS NULL
   OR p_deadline<=p_source_fetched_at+(p_current_policy->>'revalidationSeconds')::integer*interval '1 second'),false)
$$;

CREATE FUNCTION marketplace_sec.phase9_provider_retention_contract_valid_v1(
 p_key text,p_version text,p_contract text,p_source_fetched_at timestamptz,p_deadline timestamptz,p_current_policy jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE contract text:=marketplace_sec.phase9_provider_validation_contract_v1(p_key,p_version)->>'validationContract';
 profile jsonb:=marketplace_sec.phase9_provider_field_profile_v1(p_key,p_version); retention jsonb;
BEGIN
 IF profile->>'adapterKey'=p_key AND profile->>'adapterVersion'=p_version THEN
  retention:=profile->'retentionContracts'->contract->p_contract;
 END IF;
 IF retention IS NOT NULL THEN
  -- 02c §§3.1/4.2/5.1: provider-owned bounded retention declaration,
  -- intersected with the trusted source policy and existing 24-hour ceiling.
  RETURN coalesce(pg_catalog.jsonb_typeof(retention->'maxSeconds')='number'
   AND retention->>'maxSeconds' ~ '^[1-9][0-9]*$'
   AND (retention->>'maxSeconds')::numeric<=86400
   AND marketplace_sec.phase9_catalogue_source_policy_valid_v1(p_current_policy)
   AND p_current_policy->>'adapterKey'=p_key AND p_current_policy->>'adapterVersion'=p_version
   AND p_contract=marketplace_sec.phase9_provider_purpose_contract_v1(p_key,p_version)->>'retentionContract'
   AND pg_catalog.isfinite(p_source_fetched_at) AND pg_catalog.isfinite(p_deadline)
   AND p_deadline>p_source_fetched_at
   AND p_deadline<=p_source_fetched_at+(retention->>'maxSeconds')::integer*interval '1 second'
   AND (p_current_policy->>'revalidationSeconds' IS NULL OR
    p_deadline<=p_source_fetched_at+(p_current_policy->>'revalidationSeconds')::integer*interval '1 second'),false);
 END IF;
 CASE contract
 WHEN 'open-library-v1','open-library-v2' THEN RETURN
  marketplace_sec.phase9_open_library_retention_valid_v1(p_contract,p_source_fetched_at,p_deadline,p_current_policy);
 ELSE RETURN false; END CASE;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END$$;

CREATE FUNCTION marketplace_sec.phase9_provider_automatic_supported_v1(p_key text,p_version text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce((marketplace_sec.phase9_provider_purpose_contract_v1(p_key,p_version)->>'automaticAllowed')::boolean,false)
$$;

-- Pure generic admission: installed key/version, declared retention ID, trusted
-- source policy and full-field profile must all agree before provider validation.
CREATE FUNCTION marketplace_sec.phase9_provider_retention_valid_v1(
 p_contract text,p_source_fetched_at timestamptz,p_deadline timestamptz,p_current_policy jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE key text:=p_current_policy->>'adapterKey'; version text:=p_current_policy->>'adapterVersion';
BEGIN
 IF NOT coalesce(marketplace_sec.phase9_catalogue_source_policy_valid_v1(p_current_policy),false)
  OR p_contract IS NULL OR p_contract !~ '^[a-z][a-z0-9-]{0,63}$'
  OR p_source_fetched_at IS NULL OR p_deadline IS NULL
  OR p_contract IS DISTINCT FROM marketplace_sec.phase9_provider_purpose_contract_v1(key,version)->>'retentionContract'
  OR marketplace_sec.phase9_provider_field_profile_v1(key,version) IS NULL THEN RETURN false; END IF;
 RETURN coalesce(marketplace_sec.phase9_provider_retention_contract_valid_v1(
  key,version,p_contract,p_source_fetched_at,p_deadline,p_current_policy),false);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END$$;

-- 02c section 4.3: receipt-first recovery never needs a current active lease.
-- All original scope/claim/query/generation fields still have to agree.
CREATE FUNCTION marketplace_sec.phase9_recover_automatic_metadata_v1(p_fence jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb:=p_fence; e marketplace_sec.phase9_automatic_completion_effects;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT marketplace_sec.phase9_auto_fence_valid_v1(f)
 THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
 SELECT * INTO e FROM marketplace_sec.phase9_automatic_completion_effects WHERE job_id=(f->>'jobId')::uuid;
 IF e.lookup_id IS NULL THEN
  PERFORM 1 FROM public.image_extraction_sessions WHERE id=(f->>'sessionId')::uuid FOR KEY SHARE;
  PERFORM 1 FROM public.image_extraction_jobs WHERE id=(f->>'jobId')::uuid FOR UPDATE;
  SELECT * INTO e FROM marketplace_sec.phase9_automatic_completion_effects WHERE job_id=(f->>'jobId')::uuid;
 END IF;
 IF e.lookup_id IS NOT NULL THEN
  IF e.candidate_id::text IS DISTINCT FROM f->>'candidateId' OR e.store_id::text IS DISTINCT FROM f->>'storeId'
   OR e.session_id::text IS DISTINCT FROM f->>'sessionId' OR e.candidate_version<>(f->>'candidateVersion')::integer
   OR e.query_identity IS DISTINCT FROM f->>'queryIdentity' OR e.claim_worker IS DISTINCT FROM f->>'worker'
   OR e.claim_attempt_number<>(f->>'claimAttempt')::integer
   OR e.claim_lease_token_hash IS DISTINCT FROM pg_catalog.encode(extensions.digest(f->>'leaseToken','sha256'),'hex')
   OR e.request_generation<>(f->>'requestGeneration')::integer
   OR e.captured_request_id IS DISTINCT FROM (f->>'capturedRequestId')::uuid
  THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
  RETURN e.receipt||pg_catalog.jsonb_build_object('status','replayed');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs j
  JOIN public.image_extraction_candidates c ON c.id=j.entity_id AND c.store_id=j.store_id
  JOIN public.image_extraction_sessions s ON s.id=c.session_id AND s.store_id=c.store_id
  WHERE j.id=(f->>'jobId')::uuid AND j.job_kind='metadata_enrich' AND j.entity_type='candidate'
   AND c.id=(f->>'candidateId')::uuid AND c.store_id=(f->>'storeId')::uuid AND s.id=(f->>'sessionId')::uuid
   AND c.version=(f->>'candidateVersion')::integer
   AND marketplace_sec.phase9_metadata_candidate_query_identity(c)=f->>'queryIdentity'
   AND j.attempt_count=(f->>'claimAttempt')::integer AND j.lease_owner=f->>'worker'
   AND j.lease_token_hash=pg_catalog.encode(extensions.digest(f->>'leaseToken','sha256'),'hex')
   AND j.status='in_progress' AND j.lease_expires_at>pg_catalog.clock_timestamp()
   AND j.operation_version IS DISTINCT FROM 'p9-owner-edition-options-v1'
   AND marketplace_sec.phase9_owner_ux_session_mutable(s) AND c.expires_at>pg_catalog.clock_timestamp()
   AND coalesce((SELECT st.request_generation FROM public.phase9_candidate_edition_state st WHERE st.candidate_id=c.id),0)
    =(f->>'requestGeneration')::integer
   AND (SELECT st.request_id FROM public.phase9_candidate_edition_state st WHERE st.candidate_id=c.id)
    IS NOT DISTINCT FROM (f->>'capturedRequestId')::uuid)
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 RETURN pg_catalog.jsonb_build_object('status','missing');
END$$;

-- 02c sections 4.2/4.3: one transaction through job terminal. Existing pure
-- validators, plan/resolver/count helpers are the factored private core.
CREATE FUNCTION marketplace_sec.phase9_complete_automatic_metadata_v1(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb:=p_command->'fence'; result jsonb:=p_command->'result'; o jsonb:=result->'outcome';
 c public.image_extraction_candidates; sess public.image_extraction_sessions; j public.image_extraction_jobs;
 l public.phase9_metadata_lookups; a public.metadata_enrichment_attempts; pc public.phase9_metadata_provider_calls;
 state public.phase9_candidate_edition_state; prior marketplace_sec.phase9_automatic_completion_effects;
 m jsonb:=nullif(o->'selected','null'::jsonb); r jsonb; cm jsonb; companion jsonb; proof jsonb;
 rows jsonb:=nullif(result->'rows','null'::jsonb); companions jsonb:=coalesce(nullif(result->'catalogueCompanions','null'::jsonb),'[]'::jsonb);
 policy jsonb; receipts jsonb; terminal jsonb; envelope jsonb; response jsonb; replay jsonb;
 digest text; claim_hash text; summary text; logical_outcome text; valid boolean; selected_id uuid;
 v_lookup_id uuid; v_attempt_id uuid; v_snapshot_id uuid; pair record;
 selected_work uuid; selected_edition uuid; registry public.phase9_provider_registry;
 v_results jsonb:='[]'; keys bigint[]:=ARRAY[]::bigint[]; next_keys bigint[]; key bigint;
 seen uuid[]:=ARRAY[]::uuid[]; fetched timestamptz; deadline timestamptz;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role'
  OR pg_catalog.jsonb_typeof(p_command) IS DISTINCT FROM 'object'
  OR NOT p_command ?& ARRAY['fence','lookupId','attemptId','result','selectedOptionId','source']
  OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(p_command))<>6
  OR NOT marketplace_sec.phase9_auto_fence_valid_v1(f)
  OR NOT marketplace_sec.phase9_auto_result_valid_v1(result)
  OR pg_catalog.jsonb_typeof(p_command->'lookupId') IS DISTINCT FROM 'string'
  OR p_command->>'lookupId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  OR pg_catalog.jsonb_typeof(p_command->'source') IS DISTINCT FROM 'string'
  OR p_command->>'source' NOT IN ('external','local') THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
 IF (p_command->'attemptId'<>'null'::jsonb AND (pg_catalog.jsonb_typeof(p_command->'attemptId')<>'string'
  OR p_command->>'attemptId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
  OR (p_command->'selectedOptionId'<>'null'::jsonb AND (pg_catalog.jsonb_typeof(p_command->'selectedOptionId')<>'string'
  OR p_command->>'selectedOptionId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
 THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID'; END IF;
 v_lookup_id:=(p_command->>'lookupId')::uuid; v_attempt_id:=(p_command->>'attemptId')::uuid;
 selected_id:=(p_command->>'selectedOptionId')::uuid;
 claim_hash:=pg_catalog.encode(extensions.digest(f->>'leaseToken','sha256'),'hex');
 -- Raw lease token is excluded; exact JSON result/retention/selection are hashed.
 digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  (p_command||pg_catalog.jsonb_build_object('fence',(f-'leaseToken')||
   pg_catalog.jsonb_build_object('leaseTokenHash',claim_hash)))::text,'UTF8')),'hex');
 replay:=marketplace_sec.phase9_recover_automatic_metadata_v1(f);
 IF replay->>'status'='replayed' THEN
  SELECT * INTO prior FROM marketplace_sec.phase9_automatic_completion_effects e WHERE e.job_id=(f->>'jobId')::uuid;
  IF prior.lookup_id IS DISTINCT FROM v_lookup_id OR prior.completion_digest IS DISTINCT FROM digest
  THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN replay;
 ELSIF replay->>'status'='stale_rejected' THEN RETURN replay; END IF;
 -- Session -> job -> candidate -> state -> lookup/attempt -> calls -> policy -> identities.
 SELECT * INTO sess FROM public.image_extraction_sessions WHERE id=(f->>'sessionId')::uuid FOR KEY SHARE;
 SELECT * INTO j FROM public.image_extraction_jobs WHERE id=(f->>'jobId')::uuid FOR UPDATE;
 SELECT * INTO prior FROM marketplace_sec.phase9_automatic_completion_effects e WHERE e.job_id=j.id;
 IF prior.lookup_id IS NOT NULL THEN
  IF prior.completion_digest IS DISTINCT FROM digest THEN RAISE EXCEPTION 'P9_IDEMPOTENCY_MISMATCH'; END IF;
  RETURN marketplace_sec.phase9_recover_automatic_metadata_v1(f);
 END IF;
 IF sess.store_id::text IS DISTINCT FROM f->>'storeId'
  OR NOT marketplace_sec.phase9_owner_ux_session_mutable(sess)
  OR j.entity_id::text IS DISTINCT FROM f->>'candidateId' OR j.store_id IS DISTINCT FROM sess.store_id
  OR j.job_kind IS DISTINCT FROM 'metadata_enrich' OR j.entity_type IS DISTINCT FROM 'candidate'
  OR j.operation_version='p9-owner-edition-options-v1'
  OR j.status IS DISTINCT FROM 'in_progress' OR j.lease_owner IS DISTINCT FROM f->>'worker'
  OR j.lease_token_hash IS DISTINCT FROM claim_hash OR j.attempt_count<>(f->>'claimAttempt')::integer
  OR j.lease_expires_at IS NULL OR j.lease_expires_at<=pg_catalog.clock_timestamp()
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 c:=marketplace_sec.phase9_assert_structural_metadata_candidate(j.id,f->>'worker',f->>'leaseToken',
  (f->>'claimAttempt')::integer,(f->>'candidateId')::uuid,(f->>'candidateVersion')::integer);
 IF c.session_id IS DISTINCT FROM sess.id OR c.store_id IS DISTINCT FROM sess.store_id
  OR c.expires_at<=pg_catalog.clock_timestamp()
  OR marketplace_sec.phase9_metadata_candidate_query_identity(c) IS DISTINCT FROM f->>'queryIdentity'
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 SELECT * INTO state FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id FOR UPDATE;
 IF coalesce(state.request_generation,0)<>(f->>'requestGeneration')::integer
  OR state.request_id IS DISTINCT FROM (f->>'capturedRequestId')::uuid
 THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected'); END IF;
 SELECT * INTO l FROM public.phase9_metadata_lookups WHERE id=v_lookup_id AND job_id=j.id
  AND candidate_id=c.id AND store_id=c.store_id AND query_identity=f->>'queryIdentity' FOR UPDATE;
 IF l.id IS NULL AND EXISTS(SELECT 1 FROM public.phase9_metadata_lookups source WHERE source.id=v_lookup_id)
 THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF l.id IS NOT NULL AND (l.claim_attempt_number<>(f->>'claimAttempt')::integer
  OR l.claim_worker IS DISTINCT FROM f->>'worker' OR l.claim_lease_token_hash IS DISTINCT FROM claim_hash
  OR l.completed_at IS NOT NULL OR l.leader_lookup_id IS NOT NULL)
 THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF rows IS NULL AND selected_id IS NOT NULL THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 IF m IS NULL AND selected_id IS NOT NULL THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 IF rows IS NOT NULL AND m IS NOT NULL AND (selected_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM pg_catalog.jsonb_array_elements(rows) row WHERE row->>'optionId'=selected_id::text
   AND row->>'eligibility'='eligible' AND row->'metadata'=m))
 THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
 summary:=CASE o->>'outcome' WHEN 'coherent_match' THEN 'accepted_metadata_match'
  WHEN 'ambiguous_match' THEN 'ambiguous' WHEN 'material_conflict' THEN 'material_conflict'
  WHEN 'no_acceptable_match' THEN 'no_match' WHEN 'insufficient_query' THEN 'manual_metadata_required'
  WHEN 'cost_quota_denied' THEN 'cost_quota_denied'
  WHEN 'policy_denied' THEN 'policy_denied' WHEN 'provider_disabled' THEN 'policy_denied'
  WHEN 'legal_launch_denied' THEN 'policy_denied' WHEN 'cancelled' THEN 'policy_denied'
  WHEN 'authentication_configuration_failure' THEN 'policy_denied' ELSE 'technical_failure' END;
 -- 02c §4.3: 8a-5 owns retry scheduling while claims remain. Exhaustion
 -- uses the existing terminal transaction; an expired fifth lease cannot be
 -- reclaimed by M15 or failed by the lease-fenced M32 failure handler.
 IF (o->>'retryable')::boolean AND (j.attempt_count<j.max_attempts OR summary<>'technical_failure')
 THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
 IF p_command->>'source'='local' THEN
  -- Zero-egress manual result. Existing canonical-local/cache hits continue
  -- through their validated legacy boundaries, with no invented provider rows.
  IF v_attempt_id IS NOT NULL OR m IS NOT NULL OR rows IS NOT NULL OR companions<>'[]'::jsonb
   OR o->'candidates'<>'[]'::jsonb OR o->'representativeCover'<>'null'::jsonb
   OR EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts a0 WHERE a0.lookup_id=v_lookup_id)
   OR EXISTS(SELECT 1 FROM public.phase9_usage_reservations u WHERE u.job_id=j.id)
   OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls call WHERE call.job_id=j.id)
   OR (l.id IS NOT NULL AND l.execution_mode<>'local')
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF l.id IS NULL THEN
   INSERT INTO public.phase9_metadata_lookups(id,candidate_id,store_id,job_id,query_identity,execution_mode,
    schema_version,lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,
    privacy_scope,claim_attempt_number,claim_worker,claim_lease_token_hash)
   VALUES(v_lookup_id,c.id,c.store_id,j.id,f->>'queryIdentity','local','p9-metadata-foundation-v1',
    CASE WHEN marketplace_sec.phase9_metadata_normalized_isbn13(c.observed_isbn_clue) IS NULL
     THEN 'bibliographic' ELSE 'isbn' END,'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','store_private',(f->>'claimAttempt')::integer,f->>'worker',claim_hash)
   RETURNING * INTO l;
  END IF;
 ELSE
  IF l.id IS NULL OR v_attempt_id IS NULL OR l.execution_mode<>'external'
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  SELECT * INTO a FROM public.metadata_enrichment_attempts WHERE id=v_attempt_id AND lookup_id=l.id
   AND candidate_id=c.id AND store_id=c.store_id FOR UPDATE;
  IF a.id IS NULL OR a.disposition<>'unresolved' OR a.provider_role NOT IN ('primary','secondary')
   OR a.normalizer_version IS DISTINCT FROM l.normalizer_version OR a.schema_version IS DISTINCT FROM l.schema_version
   OR a.routing_policy_version IS DISTINCT FROM l.routing_policy_version
   OR (a.provider_role='primary' AND (a.adapter_key IS DISTINCT FROM l.adapter_key OR a.adapter_version IS DISTINCT FROM l.adapter_version))
   OR (a.provider_role='secondary' AND NOT EXISTS(SELECT 1 FROM public.metadata_enrichment_attempts pred
    WHERE pred.id=a.predecessor_attempt_id AND pred.lookup_id=l.id AND pred.candidate_id=c.id AND pred.store_id=c.store_id
     AND pred.provider_role='primary' AND pred.adapter_key=l.adapter_key AND pred.adapter_version=l.adapter_version
     AND pred.disposition IN ('rejected','failed') AND pred.normalized_outcome=a.predecessor_outcome
     AND pred.normalized_outcome IN ('no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
      'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open',
      'network_failure','response_too_large','unsupported_content_type')))
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  PERFORM 1 FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id
   AND call.claim_attempt_number=j.attempt_count ORDER BY call.created_at,call.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id
   AND call.claim_attempt_number=j.attempt_count AND (call.job_id IS DISTINCT FROM j.id
    OR call.candidate_id IS DISTINCT FROM c.id OR call.store_id IS DISTINCT FROM c.store_id
    OR call.claim_worker IS DISTINCT FROM f->>'worker' OR call.claim_lease_token_hash IS DISTINCT FROM claim_hash
    OR call.status IS DISTINCT FROM 'finalized'
    OR (call.retryable AND NOT (j.attempt_count>=j.max_attempts AND (o->>'retryable')::boolean))))
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  SELECT * INTO pc FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=a.id
   AND claim_attempt_number=j.attempt_count ORDER BY created_at DESC,id DESC LIMIT 1;
  IF pc.id IS NULL THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF pc.edition_call_sequence IS NULL THEN
    -- 02c §§3.2/4.3: installed single-call protocol, including legacy receipts.
   IF pc.logical_outcome IS DISTINCT FROM o->>'outcome' OR pc.provider_request_id IS DISTINCT FROM o->>'providerRequestId'
    OR pc.normalized_candidate IS DISTINCT FROM m
    OR pc.match_evidence IS DISTINCT FROM o->'evidence'
     OR pc.retryable IS DISTINCT FROM (o->>'retryable')::boolean
    OR (SELECT count(*) FROM public.phase9_metadata_provider_calls call
     WHERE call.logical_attempt_id=a.id AND call.claim_attempt_number=j.attempt_count)<>1
     OR pc.edition_call_stage IS NOT NULL
     OR (NOT coalesce(marketplace_sec.phase9_provider_stage_valid_v1(
       a.adapter_key,a.adapter_version,NULL,NULL,l.lookup_strategy),false)
      AND NOT marketplace_sec.phase9_provider_legacy_route_v1(a.adapter_key,a.adapter_version,false,a.provider_role))
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  ELSE
   -- 02c §4.3: fan-out receipts do not bind selected metadata bytes. A winner
   -- must therefore have the exact retained row and companion checked below.
   IF m IS NOT NULL AND rows IS NULL THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
   SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('callSequence',call.edition_call_sequence,
    'callStage',call.edition_call_stage,'status',call.status,'egressStarted',call.edition_egress_started,
    'retryable',call.retryable,'normalizedOutcome',call.normalized_outcome,'logicalOutcome',call.logical_outcome,
    'normalizedCandidate',call.normalized_candidate,'matchEvidence',call.match_evidence) ORDER BY call.created_at,call.id)
   INTO receipts FROM public.phase9_metadata_provider_calls call WHERE call.logical_attempt_id=a.id AND call.claim_attempt_number=j.attempt_count;
   terminal:=receipts->(pg_catalog.jsonb_array_length(receipts)-1);
   envelope:=pg_catalog.jsonb_build_object('providerRole',a.provider_role,'primaryAdapterKey',l.adapter_key,
    'predecessorOutcome',a.predecessor_outcome,'queryKind',l.lookup_strategy,'rows',coalesce(rows,'[]'::jsonb),
    'terminalReceipt',terminal,'receipts',receipts);
   IF (o->>'retryable')::boolean THEN
    -- 02c §4.3: the success/list validator cannot validate a technical
    -- failure. On exhaustion only, prove the terminal failure and its complete
    -- registered stage prefix; no retained list or selected bytes are admitted.
    IF rows IS NOT NULL OR m IS NOT NULL OR companions<>'[]'::jsonb
     OR o->'candidates'<>'[]'::jsonb OR o->'evidence'<>'[]'::jsonb
     OR o->'representativeCover'<>'null'::jsonb OR pc.retryable IS DISTINCT FROM true
     OR pc.normalized_outcome IS DISTINCT FROM o->>'outcome'
     OR pc.logical_outcome IS DISTINCT FROM o->>'outcome'
     OR pc.provider_request_id IS DISTINCT FROM o->>'providerRequestId'
     OR pg_catalog.jsonb_array_length(receipts)<>pc.edition_call_sequence+1
     OR EXISTS(SELECT 1 FROM public.phase9_metadata_provider_calls call
      WHERE call.logical_attempt_id=a.id AND call.claim_attempt_number=j.attempt_count
       AND (call.edition_egress_started IS DISTINCT FROM true
        OR call.edition_call_sequence NOT BETWEEN 0 AND pc.edition_call_sequence
        OR NOT coalesce(marketplace_sec.phase9_provider_stage_valid_v1(a.adapter_key,a.adapter_version,
         call.edition_call_sequence,call.edition_call_stage,l.lookup_strategy),false)
        OR call.normalized_candidate IS NOT NULL OR call.match_evidence IS DISTINCT FROM '[]'::jsonb
        OR (call.id<>pc.id AND (call.retryable OR NOT coalesce(
         marketplace_sec.phase9_provider_stage_continues_v1(a.adapter_key,a.adapter_version,
          call.edition_call_sequence,call.edition_call_stage,call.normalized_outcome),false)))))
    THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
    valid:=true; logical_outcome:=pc.logical_outcome;
   ELSE
     -- 02c §4.3: this validator proves the successful list/physical protocol.
     -- Its explicit-list summary does not rank the automatic winner or ties.
     IF o->>'outcome' NOT IN ('coherent_match','ambiguous_match','material_conflict','no_acceptable_match')
      OR (o->>'outcome'='ambiguous_match' AND pg_catalog.jsonb_array_length(o->'candidates')=0)
     THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
    SELECT checked.valid,checked.logical_outcome INTO valid,logical_outcome
     FROM marketplace_sec.phase9_provider_call_contract_v1(a.adapter_key,a.adapter_version,envelope) checked;
   END IF;
    IF NOT coalesce(valid,false)
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  END IF;
  PERFORM 1 FROM public.phase9_usage_reservations u WHERE u.id=a.usage_reservation_id
   AND u.job_id=j.id AND u.store_id=c.store_id AND u.status IN ('reserved','consumed') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  policy:=marketplace_sec.phase9_catalogue_source_policy_v2(a.adapter_key,a.adapter_version);
  SELECT * INTO registry FROM public.phase9_provider_registry pr WHERE pr.adapter_key=a.adapter_key;
  IF policy IS NULL OR policy->>'policyVersion' IS DISTINCT FROM l.reuse_policy_version
   OR NOT coalesce(registry.enabled AND registry.matching_allowed AND registry.storage_allowed
    AND registry.adapter_version=a.adapter_version AND registry.automatic_lookup_allowed
    AND registry.automatic_role=a.provider_role AND registry.automatic_order=CASE a.provider_role WHEN 'primary' THEN 1 ELSE 2 END
    AND marketplace_sec.phase9_provider_automatic_supported_v1(a.adapter_key,a.adapter_version)
    AND registry.version_contracts->a.adapter_version=marketplace_sec.phase9_provider_validation_contract_v1(a.adapter_key,a.adapter_version)
    AND registry.version_contracts#>>ARRAY[a.adapter_version,'capabilityVersion']=a.capability_version
    AND registry.version_contracts#>>ARRAY[a.adapter_version,'lookupSchemaVersion']=a.schema_version
    AND registry.version_contracts#>>ARRAY[a.adapter_version,'normalizerVersion']=a.normalizer_version,false)
  THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  IF rows IS NOT NULL THEN
   fetched:=(result#>>'{retention,sourceFetchedAt}')::timestamptz;
   deadline:=(result#>>'{retention,permittedDeadlineAt}')::timestamptz;
   IF result#>>'{retention,policyVersion}' IS DISTINCT FROM policy->>'policyVersion'
    OR NOT marketplace_sec.phase9_provider_retention_valid_v1(result#>>'{retention,retentionContract}',fetched,deadline,policy)
    OR fetched>pg_catalog.clock_timestamp() OR deadline<=pg_catalog.clock_timestamp()
    OR (registry.options_retention_seconds IS NOT NULL AND deadline>fetched+registry.options_retention_seconds*interval '1 second')
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  END IF;
  FOR proof IN SELECT value FROM pg_catalog.jsonb_array_elements(o->'candidates')
   UNION ALL SELECT value->'metadata' FROM pg_catalog.jsonb_array_elements(coalesce(rows,'[]'::jsonb))
    WHERE value->'metadata'<>'null'::jsonb LOOP
   IF proof->>'correlationId' IS DISTINCT FROM l.id::text OR proof->>'attemptId' IS DISTINCT FROM a.id::text
    OR proof->>'adapterKey' IS DISTINCT FROM a.adapter_key OR proof->>'adapterVersion' IS DISTINCT FROM a.adapter_version
    OR proof->>'normalizerVersion' IS DISTINCT FROM a.normalizer_version
    OR (proof->>'fetchedAt')::timestamptz>pg_catalog.clock_timestamp()
   THEN RAISE EXCEPTION 'P9_EDITION_ROWS_INVALID'; END IF;
  END LOOP;
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(coalesce(rows,'[]'::jsonb)) LOOP
   IF r->'metadata'='null'::jsonb THEN CONTINUE; END IF;
   IF (r#>>'{metadata,fetchedAt}')::timestamptz IS DISTINCT FROM fetched
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
  END LOOP;
  FOR companion IN SELECT value FROM pg_catalog.jsonb_array_elements(companions) LOOP
   IF rows IS NULL AND pg_catalog.jsonb_array_length(companions)>1
   THEN RAISE EXCEPTION 'P9_CATALOGUE_COMPANION_INVALID'; END IF;
   IF rows IS NULL THEN proof:=m;
   ELSE SELECT value->'metadata' INTO proof FROM pg_catalog.jsonb_array_elements(rows)
    WHERE value->>'optionId'=companion->>'optionId'; END IF;
   IF proof IS NULL OR NOT coalesce(marketplace_sec.phase9_catalogue_valid_companion_v1(companion,proof,
    CASE WHEN rows IS NULL THEN NULL ELSE (companion->>'optionId')::uuid END),false)
    OR (rows IS NOT NULL AND (companion->>'optionId')::uuid=ANY(seen))
   THEN RAISE EXCEPTION 'P9_CATALOGUE_COMPANION_INVALID'; END IF;
   seen:=pg_catalog.array_append(seen,(companion->>'optionId')::uuid);
   INSERT INTO marketplace_sec.phase9_catalogue_companions(lookup_id,attempt_id,candidate_id,store_id,session_id,
    provider_record_id,option_id,payload_version,metadata_digest,companion)
   VALUES(l.id,a.id,c.id,c.store_id,c.session_id,companion->>'providerRecordId',(companion->>'optionId')::uuid,
    companion->>'version',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(proof::text,'UTF8')),'hex'),companion);
  END LOOP;
  IF rows IS NOT NULL AND m IS NOT NULL AND NOT selected_id=ANY(seen)
  THEN RAISE EXCEPTION 'P9_CATALOGUE_COMPANION_INVALID'; END IF;
  INSERT INTO marketplace_sec.phase9_catalogue_lookup_effects(lookup_id,candidate_id,store_id,session_id,
   request_generation,completion_digest,canonical_results,completion_response)
  VALUES(l.id,c.id,c.store_id,c.session_id,(f->>'requestGeneration')::integer,digest,'[]','{}');
  -- Complete bounded plan before acquiring any canonical identity lock.
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(coalesce(rows,CASE WHEN m IS NOT NULL THEN
   pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('optionId',NULL,'eligibility','eligible','metadata',m)) ELSE '[]'::jsonb END)) LOOP
   IF (policy->>'sharedAdmitted')::boolean AND r->>'eligibility'='eligible' THEN
    SELECT value INTO cm FROM pg_catalog.jsonb_array_elements(companions)
     WHERE value->'optionId' IS NOT DISTINCT FROM r->'optionId';
    -- Explicit eligibility stays authoritative; automatic query is independently derived.
    IF marketplace_sec.phase9_edition_option_eligible(r->'metadata',marketplace_sec.phase9_edition_query_identity(c)) THEN
     keys:=keys||marketplace_sec.phase9_catalogue_plan_keys_v1(r->'metadata',cm);
    END IF;
   END IF;
  END LOOP;
  FOR key IN SELECT DISTINCT k FROM pg_catalog.unnest(keys) k ORDER BY k LOOP
   PERFORM pg_catalog.pg_advisory_xact_lock(key);
  END LOOP;
  IF j.lease_expires_at<=pg_catalog.clock_timestamp() OR deadline<=pg_catalog.clock_timestamp()
  THEN RAISE SQLSTATE 'P9A01'; END IF;
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(coalesce(rows,CASE WHEN m IS NOT NULL THEN
   pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('optionId',NULL,'eligibility','eligible','metadata',m)) ELSE '[]'::jsonb END)) LOOP
   IF NOT (policy->>'sharedAdmitted')::boolean OR r->>'eligibility'<>'eligible'
    OR NOT marketplace_sec.phase9_edition_option_eligible(r->'metadata',marketplace_sec.phase9_edition_query_identity(c)) THEN CONTINUE; END IF;
   SELECT value INTO cm FROM pg_catalog.jsonb_array_elements(companions)
    WHERE value->'optionId' IS NOT DISTINCT FROM r->'optionId';
   next_keys:=marketplace_sec.phase9_catalogue_plan_keys_v1(r->'metadata',cm);
   IF NOT next_keys<@keys THEN CONTINUE; END IF;
   SELECT * INTO pair FROM marketplace_sec.phase9_catalogue_resolve_v1(r->'metadata',cm,policy);
   v_results:=v_results||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'optionId',r->'optionId','canonicalWorkId',pair.canonical_work_id,'canonicalEditionId',pair.canonical_edition_id));
  END LOOP;
  -- Preserve every original position, including an explicit skipped pair.
  IF rows IS NOT NULL THEN
   SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('optionId',original->'optionId',
    'canonicalWorkId',hit->'canonicalWorkId','canonicalEditionId',hit->'canonicalEditionId')
    ORDER BY (original->>'ordinal')::integer),'[]'::jsonb) INTO v_results
   FROM pg_catalog.jsonb_array_elements(rows) original LEFT JOIN LATERAL (
    SELECT value AS hit FROM pg_catalog.jsonb_array_elements(v_results)
    WHERE value->'optionId'=original->'optionId') resolved ON true;
  END IF;
  SELECT (value->>'canonicalWorkId')::uuid,(value->>'canonicalEditionId')::uuid
   INTO selected_work,selected_edition FROM pg_catalog.jsonb_array_elements(v_results)
   WHERE m IS NOT NULL AND value->>'optionId' IS NOT DISTINCT FROM selected_id::text;
  UPDATE marketplace_sec.phase9_catalogue_lookup_effects SET canonical_results=v_results
   WHERE lookup_id=l.id;
  UPDATE public.metadata_enrichment_attempts SET disposition=CASE WHEN m IS NULL THEN 'rejected' ELSE 'accepted' END,
    -- 02c §§4.2/4.3: accepted attempts use the canonical outcome consumed by
    -- the existing representative-cover writer; physical receipts stay intact.
    normalized_outcome=CASE WHEN m IS NOT NULL THEN summary ELSE o->>'outcome' END,
    normalized_payload=m,provider_request_id=pc.provider_request_id,
   status='completed',completed_at=pg_catalog.transaction_timestamp() WHERE id=a.id;
  UPDATE public.phase9_usage_reservations SET status='consumed',actual_cost_units=coalesce(actual_cost_units,0),
   updated_at=pg_catalog.transaction_timestamp() WHERE id=a.usage_reservation_id;
  IF o->'representativeCover'<>'null'::jsonb THEN
   proof:=o->'representativeCover';
   IF m IS NULL OR m->>'coverReference' IS NOT NULL OR pg_catalog.jsonb_typeof(proof)<>'object'
    OR NOT proof ?& ARRAY['coverReference','sourceRelation','sourceProviderRecordId','selectionPolicyVersion','matchEvidence']
    OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(proof))<>5 OR NOT EXISTS(
     SELECT 1 FROM pg_catalog.jsonb_array_elements(o->'candidates') source
     WHERE source->>'providerRecordId'=proof->>'sourceProviderRecordId'
      AND source->>'providerRecordId'<>m->>'providerRecordId' AND source->'coverReference'=proof->'coverReference'
      AND marketplace_sec.phase9_metadata_normalized_text(source->>'title')=marketplace_sec.phase9_metadata_normalized_text(m->>'title')
      AND pg_catalog.split_part(pg_catalog.lower(source->>'language'),'-',1)=pg_catalog.split_part(pg_catalog.lower(m->>'language'),'-',1)
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['subtitle','series','volume']) field
       WHERE source->>field IS NOT NULL AND m->>field IS NOT NULL
        AND marketplace_sec.phase9_metadata_normalized_text(source->>field)<>marketplace_sec.phase9_metadata_normalized_text(m->>field))
      AND marketplace_sec.phase9_catalogue_normalized_authors_v1(ARRAY(SELECT pg_catalog.jsonb_array_elements_text(source->'authors')))
       =marketplace_sec.phase9_catalogue_normalized_authors_v1(ARRAY(SELECT pg_catalog.jsonb_array_elements_text(m->'authors'))))
   THEN RAISE EXCEPTION 'P9_AUTO_SOURCE_INVALID'; END IF;
   PERFORM marketplace_sec.phase9_store_metadata_representative_cover_v1(a.id,l.id,j.id,f->>'worker',
    f->>'leaseToken',(f->>'claimAttempt')::integer,c.id,c.version,proof->>'coverReference',
    proof->>'sourceProviderRecordId',proof->>'sourceRelation',proof->>'selectionPolicyVersion',proof->'matchEvidence');
  END IF;
 END IF;
 -- Late stale refusal rolls back private and shared writes in this block too.
 IF j.lease_expires_at<=pg_catalog.clock_timestamp() OR sess.expires_at<=pg_catalog.clock_timestamp()
  OR c.expires_at<=pg_catalog.clock_timestamp() OR deadline<=pg_catalog.clock_timestamp()
 THEN RAISE SQLSTATE 'P9A01'; END IF;
 -- 02d alone owns alternatives publication. Preserve selected bytes and binding.
 INSERT INTO public.phase9_selected_metadata_snapshots(candidate_id,store_id,lookup_id,canonical_edition_id,selected_attempt_id,
  outcome_source_attempt_id,snapshot_version,selection_policy_version,coherent_edition,match_evidence,manual_outcome)
 VALUES(c.id,c.store_id,l.id,selected_edition,CASE WHEN m IS NOT NULL THEN a.id END,a.id,
  'p9-selected-v1','p9-metadata-selection-v1',m,o->'evidence',summary) RETURNING id INTO v_snapshot_id;
 UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=v_snapshot_id,
  canonical_edition_id=selected_edition,
  metadata_attempt_id=CASE WHEN m IS NOT NULL THEN a.id END,
  state=CASE WHEN m IS NOT NULL THEN 'ready' ELSE 'needs_review' END,updated_at=pg_catalog.transaction_timestamp() WHERE id=c.id;
 UPDATE public.phase9_metadata_lookups SET normalized_outcome=summary,outcome_source_attempt_id=a.id,canonical_edition_id=selected_edition,
  reuse_source_attempt_id=CASE WHEN m IS NOT NULL THEN a.id END,completed_at=pg_catalog.transaction_timestamp() WHERE id=l.id;
 response:=pg_catalog.jsonb_build_object('version','p9-auto-completion-v1','status','completed',
  'lookupId',l.id,'snapshotId',v_snapshot_id,'outcome',summary,'selectedOptionId',selected_id,
  'prefill',pg_catalog.jsonb_build_object('status','skipped','reason','not_installed'));
 INSERT INTO marketplace_sec.phase9_automatic_completion_effects(lookup_id,job_id,candidate_id,store_id,session_id,
  candidate_version,query_identity,claim_worker,claim_lease_token_hash,claim_attempt_number,request_generation,
  captured_request_id,selected_option_id,snapshot_id,completion_digest,receipt)
 VALUES(l.id,j.id,c.id,c.store_id,c.session_id,(f->>'candidateVersion')::integer,f->>'queryIdentity',f->>'worker',claim_hash,
  (f->>'claimAttempt')::integer,(f->>'requestGeneration')::integer,(f->>'capturedRequestId')::uuid,
  selected_id,v_snapshot_id,digest,response);
 IF a.id IS NOT NULL THEN
  UPDATE marketplace_sec.phase9_catalogue_lookup_effects SET completion_response=response WHERE lookup_id=l.id;
  IF selected_work IS NOT NULL THEN PERFORM marketplace_sec.phase9_catalogue_count_search_v1(
   c.id,c.store_id,c.session_id,l.id,selected_work); END IF;
 END IF;
 UPDATE public.image_extraction_jobs SET status=CASE WHEN summary='technical_failure' THEN 'dead_letter' ELSE 'resolved' END,
  lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,completed_at=pg_catalog.transaction_timestamp(),
   -- 02c §4.3 / M32 terminal semantics: record failure evidence and clear old retries on success.
   dead_lettered_at=CASE WHEN summary='technical_failure' THEN pg_catalog.transaction_timestamp() END,
   last_safe_error_code=CASE WHEN summary='technical_failure' THEN 'P9_METADATA_ATTEMPTS_EXHAUSTED'
     WHEN summary='accepted_metadata_match' THEN NULL ELSE pg_catalog.upper('P9_METADATA_'||summary) END,
   last_safe_error_category=CASE WHEN summary<>'accepted_metadata_match' THEN 'metadata' END,
  updated_at=pg_catalog.transaction_timestamp() WHERE id=j.id;
 RETURN response;
EXCEPTION WHEN SQLSTATE 'P9A01' THEN RETURN pg_catalog.jsonb_build_object('status','stale_rejected');
 WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow
 OR numeric_value_out_of_range THEN RAISE EXCEPTION 'P9_AUTO_COMMAND_INVALID';
END$$;

-- 02c section 4.3/AC8-14: exact accepted automatic selected-option binding.
-- Explicit option IDs still require their original equality; never use latest.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_companion_for_choice_v1(
 p_metadata jsonb,p_option_id uuid,p_candidate_id uuid,p_store_id uuid,p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT h.companion FROM marketplace_sec.phase9_catalogue_companions h
 JOIN public.phase9_metadata_lookups l ON l.id=h.lookup_id AND l.candidate_id=h.candidate_id AND l.store_id=h.store_id
 JOIN public.metadata_enrichment_attempts a ON a.id=h.attempt_id AND a.lookup_id=l.id
  AND a.candidate_id=h.candidate_id AND a.store_id=h.store_id
 JOIN public.image_extraction_candidates c ON c.id=h.candidate_id AND c.store_id=h.store_id AND c.session_id=h.session_id
 WHERE h.candidate_id=p_candidate_id AND h.store_id=p_store_id AND h.session_id=p_session_id
  AND h.lookup_id::text=p_metadata->>'correlationId' AND h.attempt_id::text=p_metadata->>'attemptId'
  AND h.provider_record_id=p_metadata->>'providerRecordId'
  AND (h.option_id IS NOT DISTINCT FROM p_option_id OR (p_option_id IS NULL AND EXISTS(
   SELECT 1 FROM marketplace_sec.phase9_automatic_completion_effects e
   JOIN public.phase9_selected_metadata_snapshots s ON s.id=e.snapshot_id AND s.lookup_id=e.lookup_id
   WHERE e.lookup_id=h.lookup_id AND e.candidate_id=h.candidate_id AND e.store_id=h.store_id
    AND e.session_id=h.session_id AND e.selected_option_id=h.option_id AND s.selected_attempt_id=h.attempt_id
    AND s.coherent_edition=p_metadata)))
  AND h.metadata_digest=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_metadata::text,'UTF8')),'hex')
  AND a.adapter_key=p_metadata->>'adapterKey' AND a.adapter_version=p_metadata->>'adapterVersion'
  AND a.normalizer_version=p_metadata->>'normalizerVersion' AND l.normalizer_version=p_metadata->>'normalizerVersion'
$$;

ALTER FUNCTION marketplace_sec.phase9_complete_automatic_metadata_v1(jsonb) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_recover_automatic_metadata_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_complete_automatic_metadata_v1(jsonb),
 marketplace_sec.phase9_recover_automatic_metadata_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
-- Invoker wrapper calls only these delegated service entries, never table grants.
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_complete_automatic_metadata_v1(jsonb),
 marketplace_sec.phase9_recover_automatic_metadata_v1(jsonb) TO service_role;
CREATE FUNCTION public.phase9_complete_automatic_metadata_v1(p_command jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_complete_automatic_metadata_v1(p_command)
$$;
CREATE FUNCTION public.phase9_recover_automatic_metadata_v1(p_fence jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT marketplace_sec.phase9_recover_automatic_metadata_v1(p_fence)
$$;
ALTER FUNCTION public.phase9_complete_automatic_metadata_v1(jsonb) OWNER TO postgres;
ALTER FUNCTION public.phase9_recover_automatic_metadata_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_complete_automatic_metadata_v1(jsonb),
 public.phase9_recover_automatic_metadata_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_complete_automatic_metadata_v1(jsonb),
 public.phase9_recover_automatic_metadata_v1(jsonb) TO service_role;

ALTER FUNCTION marketplace_sec.phase9_provider_purpose_contract_v1(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_purpose_contract_v1(text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_open_library_retention_valid_v1(text,timestamptz,timestamptz,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_open_library_retention_valid_v1(text,timestamptz,timestamptz,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_retention_contract_valid_v1(text,text,text,timestamptz,timestamptz,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_retention_contract_valid_v1(text,text,text,timestamptz,timestamptz,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_automatic_supported_v1(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_automatic_supported_v1(text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_provider_retention_valid_v1(text,timestamptz,timestamptz,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_provider_retention_valid_v1(text,timestamptz,timestamptz,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
