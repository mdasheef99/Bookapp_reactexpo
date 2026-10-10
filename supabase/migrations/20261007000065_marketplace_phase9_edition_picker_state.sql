-- Owner edition-picker SDD §§4.3/5–6/8–9; forward expand only, no live application authority.
BEGIN;
CREATE FUNCTION marketplace_sec.phase9_edition_snapshot(p_metadata jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_object_agg(k,coalesce(p_metadata->k,'null'::jsonb))
 FROM unnest(ARRAY['title','subtitle','authors','description','isbn10','isbn13','publisher','publishedDate','language','script','editionStatement','series','volume','format','pageCount','categories','coverReference']) k
$$;
CREATE FUNCTION marketplace_sec.phase9_edition_valid_metadata(p_metadata jsonb,p_worker boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
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
 IF p_worker AND p_metadata->>'adapterKey' IS DISTINCT FROM 'google_books' THEN RETURN false; END IF;
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
  OR char_length(p_metadata->>'coverReference') NOT BETWEEN 1 AND 512 OR p_metadata->>'coverReference'
  !~ '^https://books[.]google[.]com/[^[:space:]\\]*$') THEN RETURN false; END IF;
 IF p_worker THEN PERFORM (p_metadata->>'fetchedAt')::timestamptz; END IF;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_valid_rows(p_rows jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE r jsonb; n integer:=0; ids uuid[]:=ARRAY[]::uuid[]; id uuid;
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
    OR r->>'googleBooksUrl' !~ '^https://books[.]google[.]com/books([/?][^[:space:]\\]*)?$'
   THEN RETURN false; END IF;
  ELSE RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;

ALTER TABLE public.image_extraction_candidates ADD CONSTRAINT phase9_edition_candidate_identity
 UNIQUE(id,session_id,store_id);
ALTER TABLE public.image_extraction_jobs ADD CONSTRAINT phase9_edition_job_identity UNIQUE(id,entity_id,store_id);
ALTER TABLE public.phase9_metadata_lookups ADD CONSTRAINT phase9_edition_lookup_identity UNIQUE(id,candidate_id,store_id);
ALTER TABLE public.metadata_enrichment_attempts ADD CONSTRAINT phase9_edition_attempt_identity
 UNIQUE(id,lookup_id,candidate_id,store_id);
CREATE TABLE public.phase9_candidate_edition_state(
 candidate_id uuid PRIMARY KEY,session_id uuid NOT NULL,store_id uuid NOT NULL,
 request_id uuid,request_generation integer NOT NULL DEFAULT 0 CHECK(request_generation>=0),
 query_identity text NOT NULL CHECK(char_length(query_identity) BETWEEN 1 AND 2048),
 options_version integer NOT NULL DEFAULT 0 CHECK(options_version>=0),
 options jsonb NOT NULL DEFAULT '[]' CHECK(marketplace_sec.phase9_edition_valid_rows(options)),
 source_lookup_id uuid,source_attempt_id uuid,source_fetched_at timestamptz,options_expires_at timestamptz,
 selection_id uuid,selected_source text,selected_source_id uuid,selected_option_snapshot jsonb,
 selected_at timestamptz,selected_by uuid,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 FOREIGN KEY(candidate_id,session_id,store_id) REFERENCES public.image_extraction_candidates(id,session_id,store_id) ON DELETE CASCADE,
 FOREIGN KEY(request_id,candidate_id,store_id) REFERENCES public.image_extraction_jobs(id,entity_id,store_id),
 FOREIGN KEY(source_lookup_id,candidate_id,store_id) REFERENCES public.phase9_metadata_lookups(id,candidate_id,store_id),
 FOREIGN KEY(source_attempt_id,source_lookup_id,candidate_id,store_id)
  REFERENCES public.metadata_enrichment_attempts(id,lookup_id,candidate_id,store_id),
 CHECK((options_expires_at IS NULL AND source_fetched_at IS NULL AND source_lookup_id IS NULL
  AND source_attempt_id IS NULL AND options='[]'::jsonb)
  OR (options_expires_at IS NOT NULL AND source_fetched_at IS NOT NULL AND source_lookup_id IS NOT NULL
   AND source_attempt_id IS NOT NULL AND options_version>0 AND options_expires_at>=source_fetched_at
   AND options_expires_at<=source_fetched_at+interval '24 hours')),
 CHECK((selection_id IS NULL AND selected_source IS NULL AND selected_source_id IS NULL
   AND selected_option_snapshot IS NULL AND selected_at IS NULL AND selected_by IS NULL)
  OR (selection_id IS NOT NULL AND selected_source IS NOT NULL
   AND selected_source IN ('edition_option','current_suggestion')
   AND selected_source_id IS NOT NULL AND selected_at IS NOT NULL AND selected_by IS NOT NULL
   AND selected_option_snapshot IS NOT NULL AND marketplace_sec.phase9_edition_valid_metadata(selected_option_snapshot)))
);
CREATE INDEX phase9_edition_expiry_idx ON public.phase9_candidate_edition_state(options_expires_at)
 WHERE options_expires_at IS NOT NULL;
ALTER TABLE public.phase9_candidate_edition_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_candidate_edition_state OWNER TO postgres;
REVOKE ALL ON TABLE public.phase9_candidate_edition_state FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION marketplace_sec.phase9_edition_query_identity(p_candidate public.image_extraction_candidates)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates:=p_candidate; r jsonb:=c.owner_review_snapshot->'value';
 s public.phase9_candidate_edition_state;
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=c.id;
 -- Choosing a coherent edition does not redefine the original query; an actual identity edit does.
 IF r#>>'{metadataChoice,mode}'='edition_option' AND r#>>'{metadataChoice,selectionId}'=s.selection_id::text
  AND r->'originalTitle'=s.selected_option_snapshot->'title' AND r->'authors'=s.selected_option_snapshot->'authors'
  AND r->'originalLanguage'=s.selected_option_snapshot->'language'
  AND s.query_identity::jsonb->3 IS NOT DISTINCT FROM marketplace_sec.phase9_metadata_candidate_query_identity(c)::jsonb->3
  AND s.query_identity::jsonb->7 IS NOT DISTINCT FROM marketplace_sec.phase9_metadata_candidate_query_identity(c)::jsonb->7
 THEN RETURN s.query_identity; END IF;
 IF r#>>'{originalFieldConfirmation,title}'='true' AND r->>'originalTitle' IS NOT NULL THEN
  c.observed_title:=r->>'originalTitle'; END IF;
 IF jsonb_typeof(r->'authors')='array' AND jsonb_array_length(r->'authors')>0
  AND jsonb_typeof(r#>'{originalFieldConfirmation,authors}')='array'
  AND jsonb_array_length(r->'authors')=jsonb_array_length(r#>'{originalFieldConfirmation,authors}')
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r#>'{originalFieldConfirmation,authors}') x WHERE x<>'true')
 THEN c.observed_authors:=ARRAY(SELECT jsonb_array_elements_text(r->'authors')); END IF;
 IF r->>'originalLanguage' IS NOT NULL THEN c.observed_language:=r->>'originalLanguage'; END IF;
 RETURN marketplace_sec.phase9_metadata_candidate_query_identity(c);
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_identity_compatible(p_metadata jsonb,p_query text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE q jsonb:=p_query::jsonb; title text:=q->>4; authors jsonb:=q->5;
 isbn text:=q->>3; i10 text; i13 text;
BEGIN
 IF NOT marketplace_sec.phase9_edition_valid_metadata(p_metadata) THEN RETURN false; END IF;
 i10:=marketplace_sec.phase9_metadata_normalized_isbn13(p_metadata->>'isbn10');
 i13:=marketplace_sec.phase9_metadata_normalized_isbn13(p_metadata->>'isbn13');
 IF (p_metadata->>'isbn10' IS NOT NULL AND i10 IS NULL)
  OR (p_metadata->>'isbn13' IS NOT NULL AND i13 IS NULL)
  OR (i10 IS NOT NULL AND i13 IS NOT NULL AND i10<>i13) THEN RETURN false; END IF;
 IF title<>'' AND marketplace_sec.phase9_metadata_normalized_text(p_metadata->>'title')<>title THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(authors) a WHERE NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements_text(p_metadata->'authors') b
  WHERE marketplace_sec.phase9_metadata_normalized_text(b)=a)) THEN RETURN false; END IF;
 IF split_part(q->>6,'-',1)<>split_part(p_metadata->>'language','-',1) THEN RETURN false; END IF;
 RETURN (title<>'' AND jsonb_array_length(authors)>0) OR (isbn IS NOT NULL AND isbn IN(i10,i13));
EXCEPTION WHEN others THEN RETURN false;
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_canonical_snapshot(p_edition public.canonical_editions)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('title',p_edition.title,'subtitle',p_edition.subtitle,'authors',to_jsonb(p_edition.authors),
  'language',p_edition.language,'script',NULL,'description',p_edition.description,'isbn10',p_edition.isbn_10,
  'isbn13',p_edition.isbn_13,'publisher',p_edition.publisher,'publishedDate',p_edition.published_date,
  'editionStatement',p_edition.edition_statement,'series',NULL,'volume',p_edition.volume,'format',p_edition.format,
  'pageCount',p_edition.page_count,'categories',coalesce(to_jsonb(p_edition.categories),'[]'::jsonb),
  'coverReference',p_edition.cover_url)
$$;
CREATE FUNCTION marketplace_sec.phase9_edition_current_snapshot(p_candidate public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.phase9_selected_metadata_snapshots; e public.canonical_editions; m jsonb;
BEGIN
 SELECT * INTO s FROM public.phase9_selected_metadata_snapshots WHERE id=p_candidate.selected_metadata_snapshot_id
  AND candidate_id=p_candidate.id AND store_id=p_candidate.store_id;
 IF s.id IS NULL OR s.manual_outcome NOT IN('accepted_metadata_match','local_canonical_match') THEN RETURN NULL; END IF;
 IF s.canonical_edition_id IS NOT NULL THEN
  SELECT * INTO e FROM public.canonical_editions WHERE id=s.canonical_edition_id;
  m:=marketplace_sec.phase9_edition_canonical_snapshot(e);
 ELSE m:=marketplace_sec.phase9_edition_snapshot(s.coherent_edition); END IF;
 IF NOT marketplace_sec.phase9_edition_identity_compatible(m,marketplace_sec.phase9_edition_query_identity(p_candidate))
 THEN RETURN NULL; END IF;
 RETURN m;
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_assert_owner_candidate(p_session_id uuid,p_candidate_id uuid)
RETURNS public.image_extraction_candidates LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.image_extraction_sessions; c public.image_extraction_candidates;
BEGIN
 s:=marketplace_sec.phase9_owner_ux_lock_active_session(p_session_id);
 SELECT * INTO c FROM public.image_extraction_candidates WHERE id=p_candidate_id AND session_id=s.id
  AND store_id=s.store_id FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'P9_NOT_FOUND'; END IF;
 IF c.state NOT IN('ready','needs_review','possible_duplicate') OR c.committed_inventory_id IS NOT NULL
  OR c.expires_at<=transaction_timestamp() OR c.review_disposition IN('owner_removed_from_scan','skipped_false_detection')
 THEN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END IF;
 RETURN c;
END$$;
CREATE FUNCTION marketplace_sec.phase9_edition_choices(p_candidate public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.phase9_candidate_edition_state; rows jsonb:='[]'; selection jsonb; m jsonb; status text:='idle';
 fresh boolean:=false; query_ok boolean;
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id
  AND store_id=p_candidate.store_id AND session_id=p_candidate.session_id;
 query_ok:=s.query_identity=marketplace_sec.phase9_edition_query_identity(p_candidate);
 fresh:=coalesce(query_ok AND s.options_expires_at>transaction_timestamp() AND EXISTS(
  SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key='google_books'
   AND r.enabled AND r.matching_allowed AND r.storage_allowed),false);
 IF fresh THEN SELECT coalesce(jsonb_agg(jsonb_set(r,'{metadata}',CASE WHEN r->'metadata'='null'
  THEN 'null'::jsonb ELSE marketplace_sec.phase9_edition_snapshot(r->'metadata') END) ORDER BY ordinal),'[]')
  INTO rows FROM jsonb_array_elements(s.options) WITH ORDINALITY x(r,ordinal); END IF;
 IF query_ok AND s.selection_id IS NOT NULL THEN
  selection:=jsonb_build_object('selectionId',s.selection_id,'source',s.selected_source,'optionId',
   CASE WHEN s.selected_source='edition_option' THEN s.selected_source_id ELSE NULL END,
   'snapshot',marketplace_sec.phase9_edition_snapshot(s.selected_option_snapshot));
 ELSE
  m:=marketplace_sec.phase9_edition_current_snapshot(p_candidate);
  IF m IS NOT NULL THEN selection:=jsonb_build_object('selectionId',p_candidate.selected_metadata_snapshot_id,
   'source','current_suggestion','optionId',NULL,'snapshot',m); END IF;
 END IF;
 IF s.request_id IS NOT NULL AND query_ok THEN
  SELECT CASE WHEN j.status IN('open','in_progress','retry_scheduled') THEN 'pending'
   WHEN j.status IN('resolved','resolved_noop') AND fresh THEN 'ready' ELSE 'failed' END INTO status
   FROM public.image_extraction_jobs j WHERE id=s.request_id;
 END IF;
 RETURN jsonb_build_object('sessionId',p_candidate.session_id,'candidateId',p_candidate.id,
  'requestGeneration',coalesce(s.request_generation,0),'optionsVersion',coalesce(s.options_version,0),
  'optionsExpiresAt',CASE WHEN fresh THEN s.options_expires_at ELSE NULL END,'rows',rows,'selection',selection,
  'lookupStatus',coalesce(status,'idle'),'candidateVersion',p_candidate.version,
  'metadataRevision',p_candidate.metadata_revision,'reviewVersion',p_candidate.review_version);
END$$;
DO $$DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='marketplace_sec' AND p.proname LIKE 'phase9_edition_%'
 LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature); END LOOP;
END$$;
COMMIT;
