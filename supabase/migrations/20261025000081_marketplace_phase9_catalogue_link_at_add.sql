-- Phase 9 post-scan rework, slice 6: PROPOSED, not applied.
-- Design: work-units/post-scan-rework/02a-slice6-catalogue-link-sdd.md, revision 3 + §6.1.
-- Authority: 02a §§3-7, 9.2, 10-11, 14; local file creation authorized 2026-10-25.
-- OQ1: sorted text_key, normalized incumbent comparison, no key rewrites.
-- OQ2: blocklist deferred to slice 7. OQ3: surviving coherent pairs only; no orphan repair.
-- OQ4: immutable incumbents; fetchedAt / psr-catalogue-isbn-v1 stamps on new editions.
-- OQ6: client canonical writes revoked. OQ7: unexpected database errors propagate.
BEGIN;

-- 02a §§3-7: private, server-scoped catalogue boundary; skips always return one NULL pair.
CREATE FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(
  p_candidate_id uuid,p_session_id uuid,p_store_id uuid
) RETURNS TABLE(canonical_work_id uuid,canonical_edition_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $catalogue$
DECLARE
  c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
  x public.phase9_selected_metadata_snapshots; l public.phase9_metadata_lookups;
  a public.metadata_enrichment_attempts; r public.phase9_provider_registry;
  v_work public.canonical_works; v_edition public.canonical_editions;
  m jsonb; v_reference jsonb; v_choice jsonb; v_hint uuid; v_work_id uuid;
  v_lookup uuid; v_attempt uuid; v_query text; v_title text; v_authors text[];
  v_isbn10 text; v_isbn13 text; v_from10 text; v_hit10 uuid; v_hit13 uuid;
  v_insert_work uuid; v_resolved_edition uuid; v_count integer; v_constraint text;
  v_message text;
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
    -- §6 confirmed by M73 register_structural_metadata_lookup/attempt (L298/322):
    -- automatic lookups use the observed candidate query, not M78's explicit picker query.
    v_query:=marketplace_sec.phase9_metadata_candidate_query_identity(c);
  ELSE RETURN NEXT; RETURN;
  END IF;

  -- §§3.1/4/7.2: a trusted saved ID is link-only. A failed reference attempt
  -- releases its locks before provider admission; never chase a work after its edition.
  IF v_hint IS NOT NULL THEN
    BEGIN
      SELECT * INTO v_edition FROM public.canonical_editions e WHERE e.id=v_hint;
      IF v_edition.id IS NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
      v_work_id:=v_edition.work_id;
      SELECT * INTO v_work FROM public.canonical_works w WHERE w.id=v_work_id FOR KEY SHARE;
      SELECT * INTO v_edition FROM public.canonical_editions e WHERE e.id=v_hint FOR SHARE;
      IF v_edition.id IS NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
      -- Keep a surviving orphan locked for private hydration, but never repair or link it.
      IF v_edition.work_id IS NULL THEN RETURN NEXT; RETURN; END IF;
      IF v_work.id IS NULL OR v_edition.work_id IS DISTINCT FROM v_work_id
      THEN RAISE SQLSTATE 'P9C01'; END IF;
      v_reference:=coalesce(nullif(m,'null'::jsonb),marketplace_sec.phase9_edition_canonical_snapshot(v_edition));
      IF NOT coalesce(marketplace_sec.phase9_edition_valid_metadata(v_reference),false)
      THEN RETURN NEXT; RETURN; END IF;
      v_title:=pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(v_reference->>'title'));
      v_authors:=ARRAY(SELECT k FROM (SELECT pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(au)) AS k
        FROM pg_catalog.jsonb_array_elements_text(v_reference->'authors') AS author(au)) normalized
      ORDER BY k COLLATE pg_catalog."C");
      v_isbn13:=marketplace_sec.phase9_metadata_normalized_isbn13(coalesce(
        v_reference->>'isbn13',v_reference->>'isbn10'));
      IF v_edition.id IS NULL OR v_work.id IS NULL
      OR v_edition.work_id IS DISTINCT FROM v_work.id
      OR v_title='' OR pg_catalog.cardinality(v_authors)=0 OR ''=ANY(v_authors)
      OR pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(v_edition.title)) IS DISTINCT FROM v_title
      OR ARRAY(SELECT k FROM (SELECT pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(au)) AS k
        FROM pg_catalog.unnest(v_edition.authors) AS author(au)) normalized
      ORDER BY k COLLATE pg_catalog."C") IS DISTINCT FROM v_authors
      OR pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(coalesce(v_work.title_normalized,v_work.primary_title))) IS DISTINCT FROM v_title
      OR ARRAY(SELECT k FROM (SELECT pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(au)) AS k
        FROM pg_catalog.unnest(v_work.primary_authors) AS author(au)) normalized
      ORDER BY k COLLATE pg_catalog."C") IS DISTINCT FROM v_authors
      OR (v_edition.isbn_13 IS NOT NULL AND (
        pg_catalog.upper(pg_catalog.regexp_replace(v_edition.isbn_13,'[[:space:]-]+','','g')) !~ '^97[89][0-9]{10}$'
        OR marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_13) IS NULL
        OR (v_isbn13 IS NOT NULL AND marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_13)
          IS DISTINCT FROM v_isbn13)))
      OR (v_edition.isbn_10 IS NOT NULL AND (
        pg_catalog.upper(pg_catalog.regexp_replace(v_edition.isbn_10,'[[:space:]-]+','','g')) !~ '^[0-9]{9}[0-9X]$'
        OR marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_10) IS NULL
        OR (v_isbn13 IS NOT NULL AND marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_10)
          IS DISTINCT FROM v_isbn13)))
      OR (v_edition.isbn_10 IS NOT NULL AND v_edition.isbn_13 IS NOT NULL
        AND marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_10)
          IS DISTINCT FROM marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_13))
        OR (v_reference->>'isbn13' IS NOT NULL
          AND marketplace_sec.phase9_metadata_normalized_isbn13(v_reference->>'isbn13') IS NULL)
        OR (v_reference->>'isbn10' IS NOT NULL AND (
          marketplace_sec.phase9_metadata_normalized_isbn13(v_reference->>'isbn10') IS NULL
          OR marketplace_sec.phase9_metadata_normalized_isbn13(v_reference->>'isbn10') IS DISTINCT FROM v_isbn13))
      THEN RETURN NEXT; RETURN; END IF;
      canonical_work_id:=v_work.id; canonical_edition_id:=v_edition.id;
      RETURN NEXT; RETURN;
    EXCEPTION WHEN SQLSTATE 'P9C01' THEN
      canonical_work_id:=NULL; canonical_edition_id:=NULL;
    END;
  END IF;

  -- §§3/6: current_suggestion stores a display projection, not provider provenance.
  IF s.selected_source='current_suggestion' THEN
    IF marketplace_sec.phase9_edition_snapshot(x.coherent_edition) IS DISTINCT FROM s.selected_option_snapshot
    THEN RETURN NEXT; RETURN; END IF;
    m:=x.coherent_edition;
  END IF;
  IF NOT coalesce(marketplace_sec.phase9_edition_valid_normalized_metadata(m),false)
    OR m->>'adapterKey' IS DISTINCT FROM 'open_library'
    OR (m->>'coverReference' IS NOT NULL
      AND m->>'coverReference' !~ '^https://covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-M[.]jpg$')
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
  IF l.id IS NULL OR a.id IS NULL OR a.adapter_key IS DISTINCT FROM 'open_library'
    OR a.adapter_version IS DISTINCT FROM m->>'adapterVersion'
    OR a.normalizer_version IS DISTINCT FROM m->>'normalizerVersion'
    OR l.normalizer_version IS DISTINCT FROM m->>'normalizerVersion'
  THEN RETURN NEXT; RETURN; END IF;
  -- §4: no lookup/job/attempt locks; the admitted registry SHARE lock precedes all provider catalogue locks.
  SELECT * INTO r FROM public.phase9_provider_registry registry
    WHERE registry.adapter_key=a.adapter_key FOR SHARE;
  IF r.adapter_key IS NULL OR r.provider_kind IS DISTINCT FROM 'metadata'
    OR NOT (r.enabled AND r.matching_allowed AND r.storage_allowed AND r.public_display_allowed)
    OR r.adapter_version IS DISTINCT FROM a.adapter_version
    OR r.policy_version::text IS DISTINCT FROM l.reuse_policy_version
  THEN RETURN NEXT; RETURN; END IF;

  -- §5.1: keep the shared checksum/conversion routine unchanged; add the local ISBN prefix guard.
  v_isbn10:=pg_catalog.upper(pg_catalog.regexp_replace(m->>'isbn10','[[:space:]-]+','','g'));
  v_isbn13:=pg_catalog.upper(pg_catalog.regexp_replace(m->>'isbn13','[[:space:]-]+','','g'));
  v_from10:=marketplace_sec.phase9_metadata_normalized_isbn13(v_isbn10);
  IF (v_isbn10 IS NOT NULL AND (v_isbn10 !~ '^[0-9]{9}[0-9X]$' OR v_from10 IS NULL))
    OR (v_isbn13 IS NOT NULL AND (v_isbn13 !~ '^97[89][0-9]{10}$'
      OR marketplace_sec.phase9_metadata_normalized_isbn13(v_isbn13) IS NULL))
    OR (v_isbn10 IS NOT NULL AND v_isbn13 IS NOT NULL AND v_from10 IS DISTINCT FROM v_isbn13)
  THEN RETURN NEXT; RETURN; END IF;
  v_isbn13:=coalesce(v_isbn13,v_from10);
  IF v_isbn13 IS NULL THEN RETURN NEXT; RETURN; END IF;
  v_title:=pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(m->>'title'));
  v_authors:=ARRAY(SELECT k FROM (SELECT pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(au)) AS k
        FROM pg_catalog.jsonb_array_elements_text(m->'authors') AS author(au)) normalized
      ORDER BY k COLLATE pg_catalog."C");
  IF v_title='' OR pg_catalog.cardinality(v_authors)=0 OR ''=ANY(v_authors)
  THEN RETURN NEXT; RETURN; END IF;

  -- §7.2: all shared writes and final rechecks belong to this rollback boundary.
  BEGIN
    SELECT e.id INTO v_hit13 FROM public.canonical_editions e WHERE e.isbn_13=v_isbn13;
    SELECT e.id INTO v_hit10 FROM public.canonical_editions e WHERE e.isbn_10=v_isbn10;
    IF v_hit13 IS NULL AND v_hit10 IS NULL THEN
      INSERT INTO public.canonical_works(id,title_normalized,primary_title,primary_authors,language)
        VALUES(pg_catalog.gen_random_uuid(),v_title,m->>'title',v_authors,m->>'language')
        ON CONFLICT DO NOTHING;
      SELECT * INTO v_work FROM public.canonical_works w
        WHERE w.title_normalized=v_title AND w.primary_authors=v_authors FOR KEY SHARE;
      IF v_work.id IS NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
      v_insert_work:=v_work.id;
      -- §7.1: explicit UUIDs, provider display facts only, table timestamp defaults.
      INSERT INTO public.canonical_editions(
        id,work_id,isbn_10,isbn_13,title,subtitle,authors,publisher,published_date,language,
        description,edition_statement,volume,format,page_count,categories,cover_url,
        metadata_verified_at,metadata_selection_version)
      VALUES(pg_catalog.gen_random_uuid(),v_work.id,v_isbn10,v_isbn13,m->>'title',m->>'subtitle',
        ARRAY(SELECT pg_catalog.jsonb_array_elements_text(m->'authors')),m->>'publisher',
        m->>'publishedDate',m->>'language',m->>'description',m->>'editionStatement',m->>'volume',
        m->>'format',(m->>'pageCount')::numeric::integer,
        ARRAY(SELECT pg_catalog.jsonb_array_elements_text(m->'categories')),m->>'coverReference',
        (m->>'fetchedAt')::timestamptz,'psr-catalogue-isbn-v1')
      ON CONFLICT DO NOTHING;
      -- A separate statement sees the winner after a native unique-key wait.
    SELECT e.id INTO v_hit13 FROM public.canonical_editions e WHERE e.isbn_13=v_isbn13;
    SELECT e.id INTO v_hit10 FROM public.canonical_editions e WHERE e.isbn_10=v_isbn10;
    END IF;
    -- §§4/7.2: probes discover a work; lock that work before UUID-ordered editions.
    SELECT e.work_id INTO v_work_id FROM public.canonical_editions e
      WHERE e.id=coalesce(v_hit13,v_hit10);
    IF v_work_id IS NULL OR (v_insert_work IS NOT NULL AND v_insert_work<>v_work_id) THEN
      RAISE SQLSTATE 'P9C01';
    END IF;
    SELECT * INTO v_work FROM public.canonical_works w WHERE w.id=v_work_id FOR KEY SHARE;
    IF v_work.id IS NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
    -- Acquire every matching edition lock before inspecting/refusing alternate-key hits.
    PERFORM e.id FROM public.canonical_editions e
      WHERE e.id=ANY(ARRAY[v_hit13,v_hit10]) ORDER BY e.id FOR SHARE;
    v_count:=0;
    FOR v_edition IN SELECT e.* FROM public.canonical_editions e
      WHERE e.id=ANY(ARRAY[v_hit13,v_hit10]) ORDER BY e.id
    LOOP
      v_count:=v_count+1;
      IF v_edition.id IS NULL OR v_work.id IS NULL
      OR v_edition.work_id IS DISTINCT FROM v_work.id
      OR v_title='' OR pg_catalog.cardinality(v_authors)=0 OR ''=ANY(v_authors)
      OR pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(v_edition.title)) IS DISTINCT FROM v_title
      OR ARRAY(SELECT k FROM (SELECT pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(au)) AS k
        FROM pg_catalog.unnest(v_edition.authors) AS author(au)) normalized
      ORDER BY k COLLATE pg_catalog."C") IS DISTINCT FROM v_authors
      OR pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(coalesce(v_work.title_normalized,v_work.primary_title))) IS DISTINCT FROM v_title
      OR ARRAY(SELECT k FROM (SELECT pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(au)) AS k
        FROM pg_catalog.unnest(v_work.primary_authors) AS author(au)) normalized
      ORDER BY k COLLATE pg_catalog."C") IS DISTINCT FROM v_authors
      OR (v_edition.isbn_13 IS NOT NULL AND (
        pg_catalog.upper(pg_catalog.regexp_replace(v_edition.isbn_13,'[[:space:]-]+','','g')) !~ '^97[89][0-9]{10}$'
        OR marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_13) IS NULL
        OR (v_isbn13 IS NOT NULL AND marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_13)
          IS DISTINCT FROM v_isbn13)))
      OR (v_edition.isbn_10 IS NOT NULL AND (
        pg_catalog.upper(pg_catalog.regexp_replace(v_edition.isbn_10,'[[:space:]-]+','','g')) !~ '^[0-9]{9}[0-9X]$'
        OR marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_10) IS NULL
        OR (v_isbn13 IS NOT NULL AND marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_10)
          IS DISTINCT FROM v_isbn13)))
      OR (v_edition.isbn_10 IS NOT NULL AND v_edition.isbn_13 IS NOT NULL
        AND marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_10)
          IS DISTINCT FROM marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_13))
        OR NOT coalesce(v_edition.isbn_13=v_isbn13
          OR (v_isbn10 IS NOT NULL AND v_edition.isbn_10=v_isbn10),false)
      THEN RAISE SQLSTATE 'P9C01'; END IF;
      v_resolved_edition:=v_edition.id;
    END LOOP;
    IF v_count<>1 OR (v_hit13 IS NOT NULL AND v_hit10 IS NOT NULL AND v_hit13<>v_hit10)
    THEN RAISE SQLSTATE 'P9C01'; END IF;
    canonical_work_id:=v_work.id; canonical_edition_id:=v_resolved_edition;
  EXCEPTION
    WHEN SQLSTATE 'P9C01' THEN
      canonical_work_id:=NULL; canonical_edition_id:=NULL;
    WHEN program_limit_exceeded THEN
      GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
      IF v_message NOT LIKE 'index row size%' OR v_message !~
        'for index "(canonical_works_title_normalized_primary_authors_key|canonical_editions_isbn_10_unique|canonical_editions_isbn_13_unique|idx_canonical_editions_title_authors)"$'
      THEN RAISE; END IF;
      -- Owner 2026-10-25, 02a §§7.2/14 OQ7: only known catalogue key overflows skip.
      -- The failed subtransaction has rolled back every helper write.
      canonical_work_id:=NULL; canonical_edition_id:=NULL;
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
      IF v_constraint IS NULL OR v_constraint NOT IN ('canonical_works_title_normalized_primary_authors_key',
        'canonical_editions_isbn_10_unique','canonical_editions_isbn_13_unique')
      THEN RAISE; END IF;
      -- The failed subtransaction has rolled back every attempted write.
      -- §7.2: fresh, read-only recovery; never retry either INSERT here.
      canonical_work_id:=NULL; canonical_edition_id:=NULL; v_insert_work:=NULL;
      BEGIN
    SELECT e.id INTO v_hit13 FROM public.canonical_editions e WHERE e.isbn_13=v_isbn13;
    SELECT e.id INTO v_hit10 FROM public.canonical_editions e WHERE e.isbn_10=v_isbn10;
    -- §§4/7.2: probes discover a work; lock that work before UUID-ordered editions.
    SELECT e.work_id INTO v_work_id FROM public.canonical_editions e
      WHERE e.id=coalesce(v_hit13,v_hit10);
    IF v_work_id IS NULL OR (v_insert_work IS NOT NULL AND v_insert_work<>v_work_id) THEN
      RAISE SQLSTATE 'P9C01';
    END IF;
    SELECT * INTO v_work FROM public.canonical_works w WHERE w.id=v_work_id FOR KEY SHARE;
    IF v_work.id IS NULL THEN RAISE SQLSTATE 'P9C01'; END IF;
    -- Acquire every matching edition lock before inspecting/refusing alternate-key hits.
    PERFORM e.id FROM public.canonical_editions e
      WHERE e.id=ANY(ARRAY[v_hit13,v_hit10]) ORDER BY e.id FOR SHARE;
    v_count:=0;
    FOR v_edition IN SELECT e.* FROM public.canonical_editions e
      WHERE e.id=ANY(ARRAY[v_hit13,v_hit10]) ORDER BY e.id
    LOOP
      v_count:=v_count+1;
      IF v_edition.id IS NULL OR v_work.id IS NULL
      OR v_edition.work_id IS DISTINCT FROM v_work.id
      OR v_title='' OR pg_catalog.cardinality(v_authors)=0 OR ''=ANY(v_authors)
      OR pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(v_edition.title)) IS DISTINCT FROM v_title
      OR ARRAY(SELECT k FROM (SELECT pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(au)) AS k
        FROM pg_catalog.unnest(v_edition.authors) AS author(au)) normalized
      ORDER BY k COLLATE pg_catalog."C") IS DISTINCT FROM v_authors
      OR pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(coalesce(v_work.title_normalized,v_work.primary_title))) IS DISTINCT FROM v_title
      OR ARRAY(SELECT k FROM (SELECT pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(au)) AS k
        FROM pg_catalog.unnest(v_work.primary_authors) AS author(au)) normalized
      ORDER BY k COLLATE pg_catalog."C") IS DISTINCT FROM v_authors
      OR (v_edition.isbn_13 IS NOT NULL AND (
        pg_catalog.upper(pg_catalog.regexp_replace(v_edition.isbn_13,'[[:space:]-]+','','g')) !~ '^97[89][0-9]{10}$'
        OR marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_13) IS NULL
        OR (v_isbn13 IS NOT NULL AND marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_13)
          IS DISTINCT FROM v_isbn13)))
      OR (v_edition.isbn_10 IS NOT NULL AND (
        pg_catalog.upper(pg_catalog.regexp_replace(v_edition.isbn_10,'[[:space:]-]+','','g')) !~ '^[0-9]{9}[0-9X]$'
        OR marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_10) IS NULL
        OR (v_isbn13 IS NOT NULL AND marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_10)
          IS DISTINCT FROM v_isbn13)))
      OR (v_edition.isbn_10 IS NOT NULL AND v_edition.isbn_13 IS NOT NULL
        AND marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_10)
          IS DISTINCT FROM marketplace_sec.phase9_metadata_normalized_isbn13(v_edition.isbn_13))
        OR NOT coalesce(v_edition.isbn_13=v_isbn13
          OR (v_isbn10 IS NOT NULL AND v_edition.isbn_10=v_isbn10),false)
      THEN RAISE SQLSTATE 'P9C01'; END IF;
      v_resolved_edition:=v_edition.id;
    END LOOP;
    IF v_count<>1 OR (v_hit13 IS NOT NULL AND v_hit10 IS NOT NULL AND v_hit13<>v_hit10)
    THEN RAISE SQLSTATE 'P9C01'; END IF;
    canonical_work_id:=v_work.id; canonical_edition_id:=v_resolved_edition;
      EXCEPTION WHEN SQLSTATE 'P9C01' THEN
        canonical_work_id:=NULL; canonical_edition_id:=NULL;
      END;
  END;
  RETURN NEXT;
END
$catalogue$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

-- 02a §§3.1/4/7.3: M69 body, LF length 8972 / MD5 f38185ddd742cd0fbb249db1a903738e,
-- with only the scoped disappearance gate, helper call and decoupled hydration changes.
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
  -- 02a §§3.1/4: chosen-state lock follows replay/session/candidate locks.
  SELECT * INTO v_selected FROM public.phase9_candidate_edition_state state
    WHERE state.candidate_id=v_candidate.id AND state.session_id=v_session.id
      AND state.store_id=v_session.store_id FOR UPDATE;
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
  -- 02a §4: link IDs come only from the helper; hydration retains its independent source.
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
    -- 02a §4 hydration: only the snapshot's own surviving edition supplies these fields.
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

-- 02a §11 / M78 ACL pattern: the unchanged public Add RPC remains Owner-authenticated only.
REVOKE ALL ON FUNCTION public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid)
  TO authenticated;

-- 02a §9.2 / §11 step 4, OQ6: preserve SELECT and every service_role privilege.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.canonical_works FROM anon,authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.canonical_editions FROM anon,authenticated;

COMMIT;

