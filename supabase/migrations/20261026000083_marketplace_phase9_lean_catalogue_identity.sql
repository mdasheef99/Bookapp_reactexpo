-- Phase 9 post-scan rework, slice 7a: LOCAL PROPOSAL; application separately authorized.
-- Authority: 02b §§1,4-7.2,9,11,12,14; Owner 2026-10-26 package 2.
-- Additive identity/provenance/stats; immutable incumbents; no historical backfill.
BEGIN;

-- 1. Schema: 02b §§4.1-4.4,4.6. Every new constraint/index is explicit.
CREATE TABLE public.canonical_provider_ids (
 adapter_key text CONSTRAINT canonical_provider_ids_adapter_nn NOT NULL,
 id_kind text CONSTRAINT canonical_provider_ids_kind_nn NOT NULL,
 external_id text CONSTRAINT canonical_provider_ids_external_nn NOT NULL,
 canonical_edition_id uuid, canonical_work_id uuid,
 created_at timestamptz CONSTRAINT canonical_provider_ids_created_nn NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
 CONSTRAINT canonical_provider_ids_pkey PRIMARY KEY(adapter_key,id_kind,external_id),
 CONSTRAINT canonical_provider_ids_adapter_key_fkey FOREIGN KEY(adapter_key) REFERENCES public.phase9_provider_registry(adapter_key) ON DELETE NO ACTION,
 CONSTRAINT canonical_provider_ids_canonical_edition_id_fkey FOREIGN KEY(canonical_edition_id) REFERENCES public.canonical_editions(id) ON DELETE CASCADE,
 CONSTRAINT canonical_provider_ids_canonical_work_id_fkey FOREIGN KEY(canonical_work_id) REFERENCES public.canonical_works(id) ON DELETE CASCADE,
 CONSTRAINT canonical_provider_ids_id_kind_check CHECK(id_kind IN('edition','work')),
 CONSTRAINT canonical_provider_ids_external_id_check CHECK(pg_catalog.char_length(external_id) BETWEEN 1 AND 256
   AND external_id=pg_catalog.btrim(external_id) AND external_id !~ '[[:cntrl:]<>\\]'
   AND external_id !~ U&'[\007F-\009F]' AND external_id !~* '^[a-z][a-z0-9+.-]*:'),
 CONSTRAINT canonical_provider_ids_target_xor_check CHECK((canonical_edition_id IS NULL)<>(canonical_work_id IS NULL)),
 CONSTRAINT canonical_provider_ids_kind_target_check CHECK((id_kind='edition' AND canonical_edition_id IS NOT NULL)
   OR (id_kind='work' AND canonical_work_id IS NOT NULL))
);
CREATE INDEX canonical_provider_ids_edition_idx ON public.canonical_provider_ids(canonical_edition_id) WHERE canonical_edition_id IS NOT NULL;
CREATE INDEX canonical_provider_ids_work_idx ON public.canonical_provider_ids(canonical_work_id) WHERE canonical_work_id IS NOT NULL;

ALTER TABLE public.canonical_editions
 ADD COLUMN oclc text,
 ADD COLUMN lccn text,
 ADD COLUMN hidden boolean CONSTRAINT canonical_editions_hidden_nn NOT NULL DEFAULT false,
 ADD COLUMN source_retention_note text,
 ADD COLUMN normalizer_version text,
 ADD CONSTRAINT canonical_editions_oclc_check CHECK(oclc IS NULL OR (pg_catalog.char_length(oclc) BETWEEN 1 AND 64 AND oclc ~ '^[0-9]+$')),
 ADD CONSTRAINT canonical_editions_lccn_check CHECK(lccn IS NULL OR (pg_catalog.char_length(lccn) BETWEEN 1 AND 64 AND lccn ~ '^[A-Za-z0-9]+([ -][A-Za-z0-9]+)*$')),
 ADD CONSTRAINT canonical_editions_source_note_check CHECK(source_retention_note IS NULL OR marketplace_sec.phase9_owner_ux_safe_text(pg_catalog.to_jsonb(source_retention_note),1,1024,false)),
 ADD CONSTRAINT canonical_editions_normalizer_check CHECK(normalizer_version IS NULL OR marketplace_sec.phase9_owner_ux_safe_text(pg_catalog.to_jsonb(normalizer_version),1,128,false));
ALTER TABLE public.canonical_works ADD COLUMN normalizer_version text,
 ADD CONSTRAINT canonical_works_normalizer_check CHECK(normalizer_version IS NULL OR marketplace_sec.phase9_owner_ux_safe_text(pg_catalog.to_jsonb(normalizer_version),1,128,false));
ALTER TABLE public.phase9_provider_registry ADD COLUMN shared_source_note text,
 ADD CONSTRAINT phase9_provider_registry_shared_note_check CHECK(shared_source_note IS NULL OR marketplace_sec.phase9_owner_ux_safe_text(pg_catalog.to_jsonb(shared_source_note),1,1024,false));

CREATE TABLE marketplace_sec.phase9_catalogue_isbn_blocklist (
 isbn13 text CONSTRAINT phase9_catalogue_isbn_blocklist_isbn_nn NOT NULL,
 list_version text CONSTRAINT phase9_catalogue_isbn_blocklist_version_nn NOT NULL,
 reason text CONSTRAINT phase9_catalogue_isbn_blocklist_reason_nn NOT NULL,
 created_at timestamptz CONSTRAINT phase9_catalogue_isbn_blocklist_created_nn NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
 CONSTRAINT phase9_catalogue_isbn_blocklist_pkey PRIMARY KEY(isbn13),
 CONSTRAINT phase9_catalogue_isbn_blocklist_isbn_check CHECK(isbn13 ~ '^97[89][0-9]{10}$'),
 CONSTRAINT phase9_catalogue_isbn_blocklist_version_check CHECK(marketplace_sec.phase9_owner_ux_safe_text(pg_catalog.to_jsonb(list_version),1,128,false)),
 CONSTRAINT phase9_catalogue_isbn_blocklist_reason_check CHECK(marketplace_sec.phase9_owner_ux_safe_text(pg_catalog.to_jsonb(reason),1,1024,false))
);
CREATE TABLE public.canonical_work_stats (
 canonical_work_id uuid CONSTRAINT canonical_work_stats_work_nn NOT NULL,
 times_searched bigint CONSTRAINT canonical_work_stats_searched_nn NOT NULL DEFAULT 0,
 updated_at timestamptz CONSTRAINT canonical_work_stats_updated_nn NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
 CONSTRAINT canonical_work_stats_pkey PRIMARY KEY(canonical_work_id),
 CONSTRAINT canonical_work_stats_work_fkey FOREIGN KEY(canonical_work_id) REFERENCES public.canonical_works(id) ON DELETE CASCADE,
 CONSTRAINT canonical_work_stats_searched_check CHECK(times_searched>=0)
);
CREATE TABLE public.canonical_edition_stats (
 canonical_edition_id uuid CONSTRAINT canonical_edition_stats_edition_nn NOT NULL,
 times_chosen bigint CONSTRAINT canonical_edition_stats_chosen_nn NOT NULL DEFAULT 0,
 times_added bigint CONSTRAINT canonical_edition_stats_added_nn NOT NULL DEFAULT 0,
 updated_at timestamptz CONSTRAINT canonical_edition_stats_updated_nn NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
 CONSTRAINT canonical_edition_stats_pkey PRIMARY KEY(canonical_edition_id),
 CONSTRAINT canonical_edition_stats_edition_fkey FOREIGN KEY(canonical_edition_id) REFERENCES public.canonical_editions(id) ON DELETE CASCADE,
 CONSTRAINT canonical_edition_stats_chosen_check CHECK(times_chosen>=0),
 CONSTRAINT canonical_edition_stats_added_check CHECK(times_added>=0)
);
CREATE TABLE marketplace_sec.phase9_catalogue_choice_effects (
 selection_id uuid CONSTRAINT phase9_catalogue_choice_effects_selection_nn NOT NULL,
 candidate_id uuid CONSTRAINT phase9_catalogue_choice_effects_candidate_nn NOT NULL,
 store_id uuid CONSTRAINT phase9_catalogue_choice_effects_store_nn NOT NULL,
 session_id uuid CONSTRAINT phase9_catalogue_choice_effects_session_nn NOT NULL,
 lookup_id uuid, attempt_id uuid, option_id uuid,
 metadata_digest text CONSTRAINT phase9_catalogue_choice_effects_digest_nn NOT NULL,
 counted boolean CONSTRAINT phase9_catalogue_choice_effects_counted_nn NOT NULL DEFAULT false,
 canonical_edition_id uuid,
 created_at timestamptz CONSTRAINT phase9_catalogue_choice_effects_created_nn NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
 completed_at timestamptz,
 CONSTRAINT phase9_catalogue_choice_effects_pkey PRIMARY KEY(selection_id),
 CONSTRAINT phase9_catalogue_choice_effects_candidate_fkey FOREIGN KEY(candidate_id) REFERENCES public.image_extraction_candidates(id) ON DELETE NO ACTION,
 CONSTRAINT phase9_catalogue_choice_effects_store_fkey FOREIGN KEY(store_id) REFERENCES public.stores(id) ON DELETE NO ACTION,
 CONSTRAINT phase9_catalogue_choice_effects_session_fkey FOREIGN KEY(session_id) REFERENCES public.image_extraction_sessions(id) ON DELETE NO ACTION,
 CONSTRAINT phase9_catalogue_choice_effects_lookup_fkey FOREIGN KEY(lookup_id) REFERENCES public.phase9_metadata_lookups(id) ON DELETE SET NULL,
 CONSTRAINT phase9_catalogue_choice_effects_attempt_fkey FOREIGN KEY(attempt_id) REFERENCES public.metadata_enrichment_attempts(id) ON DELETE SET NULL,
 CONSTRAINT phase9_catalogue_choice_effects_edition_fkey FOREIGN KEY(canonical_edition_id) REFERENCES public.canonical_editions(id) ON DELETE SET NULL,
 CONSTRAINT phase9_catalogue_choice_effects_digest_check CHECK(metadata_digest ~ '^[0-9a-f]{64}$')
);
CREATE INDEX phase9_catalogue_choice_effects_candidate_idx ON marketplace_sec.phase9_catalogue_choice_effects(candidate_id);
CREATE INDEX phase9_catalogue_choice_effects_edition_idx ON marketplace_sec.phase9_catalogue_choice_effects(canonical_edition_id) WHERE canonical_edition_id IS NOT NULL;

-- 2. Shared pure contracts, admission and registry-bound policy: 02b §§5/6.
CREATE FUNCTION marketplace_sec.phase9_catalogue_safe_text_v1(p_value text,p_limit integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(marketplace_sec.phase9_owner_ux_safe_text(pg_catalog.to_jsonb(p_value),1,p_limit,false)
   AND p_value !~ '[<>\\]' AND p_value !~ U&'[\007F-\009F]',false)
$$;
CREATE FUNCTION marketplace_sec.phase9_catalogue_normalized_authors_v1(p_authors text[])
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT ARRAY(SELECT k FROM (SELECT pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(a)) AS k
 FROM pg_catalog.unnest(p_authors) a) normalized ORDER BY k COLLATE "C")
$$;
CREATE FUNCTION marketplace_sec.phase9_catalogue_source_policy_valid_v1(p_policy jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; n numeric;
BEGIN
 IF pg_catalog.jsonb_typeof(p_policy) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF NOT p_policy ?& ARRAY['version','adapterKey','adapterVersion','policyVersion','rawRetentionSeconds','revalidationSeconds','sharedSourceNote','sharedAdmitted']
  OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_policy))<>8
  OR p_policy->>'version' IS DISTINCT FROM 'psr-catalogue-source-policy-v1'
  OR pg_catalog.jsonb_typeof(p_policy->'version') IS DISTINCT FROM 'string'
  OR pg_catalog.jsonb_typeof(p_policy->'adapterKey') IS DISTINCT FROM 'string'
  OR pg_catalog.jsonb_typeof(p_policy->'adapterVersion') IS DISTINCT FROM 'string'
  OR pg_catalog.jsonb_typeof(p_policy->'sharedAdmitted') IS DISTINCT FROM 'boolean'
 THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['policyVersion','rawRetentionSeconds','revalidationSeconds'] LOOP
  IF k='revalidationSeconds' AND p_policy->k='null'::jsonb THEN CONTINUE; END IF;
  IF pg_catalog.jsonb_typeof(p_policy->k) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
  n:=(p_policy->>k)::numeric;
  IF n<>pg_catalog.trunc(n) OR n>2147483647 OR n<(CASE WHEN k='rawRetentionSeconds' THEN 0 ELSE 1 END) THEN RETURN false; END IF;
 END LOOP;
 IF p_policy->'sharedSourceNote'<>'null'::jsonb AND NOT
  (pg_catalog.jsonb_typeof(p_policy->'sharedSourceNote')='string' AND marketplace_sec.phase9_catalogue_safe_text_v1(p_policy->>'sharedSourceNote',1024))
 THEN RETURN false; END IF;
 RETURN NOT ((p_policy->>'sharedAdmitted')::boolean AND p_policy->'sharedSourceNote'='null'::jsonb);
END$$;
CREATE FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v1(p_adapter_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.phase9_provider_registry r WHERE r.adapter_key=p_adapter_key
  AND p_adapter_key IN('open_library') AND r.provider_kind='metadata'
  AND r.enabled AND r.matching_allowed AND r.storage_allowed AND r.public_display_allowed
  AND r.adapter_version<>'' AND r.policy_version>0 AND r.raw_retention_seconds>=0
  AND (r.revalidation_seconds IS NULL OR r.revalidation_seconds>0)
  AND marketplace_sec.phase9_catalogue_safe_text_v1(r.shared_source_note,1024))
$$;
CREATE FUNCTION marketplace_sec.phase9_catalogue_source_policy_v1(p_adapter_key text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.phase9_provider_registry;
BEGIN
 SELECT * INTO r FROM public.phase9_provider_registry WHERE adapter_key=p_adapter_key FOR SHARE;
 IF r.adapter_key IS NULL THEN RETURN NULL; END IF;
 RETURN pg_catalog.jsonb_build_object('version','psr-catalogue-source-policy-v1',
  'adapterKey',r.adapter_key,'adapterVersion',r.adapter_version,'policyVersion',r.policy_version,
  'rawRetentionSeconds',r.raw_retention_seconds,'revalidationSeconds',r.revalidation_seconds,
  'sharedSourceNote',r.shared_source_note,'sharedAdmitted',marketplace_sec.phase9_catalogue_shared_admitted_v1(r.adapter_key));
END$$;
CREATE FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
 p_adapter_key text,p_record_id text,p_work_id text,p_book_url text,p_cover_url text,p_completion jsonb)
RETURNS TABLE(valid boolean,cover_ref text,logical_outcome text)
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 valid:=false; cover_ref:=NULL; logical_outcome:=NULL;
 IF p_completion IS NOT NULL
  OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(p_record_id,256)
  OR (p_work_id IS NOT NULL AND NOT marketplace_sec.phase9_catalogue_safe_text_v1(p_work_id,256))
 THEN RETURN NEXT; RETURN; END IF;
 CASE p_adapter_key
 WHEN 'open_library' THEN
  valid:=coalesce(p_record_id ~ '^OL[1-9][0-9]*M$'
    AND (p_work_id IS NULL OR p_work_id ~ '^OL[1-9][0-9]*W$')
    AND (p_book_url IS NULL OR p_book_url='https://openlibrary.org/books/'||p_record_id)
    AND (p_cover_url IS NULL OR p_cover_url ~ '^https://covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-M[.]jpg$'),false);
  IF valid AND p_cover_url IS NOT NULL THEN cover_ref:=pg_catalog.substring(p_cover_url,'/b/id/([1-9][0-9]*)-M[.]jpg$'); END IF;
 WHEN 'google_books' THEN
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
CREATE FUNCTION marketplace_sec.phase9_catalogue_identity_lock_key_v1(p_kind text,p_key jsonb)
RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE a text[]; v text;
BEGIN
 IF pg_catalog.jsonb_typeof(p_key) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
 IF p_kind='work' THEN
  IF pg_catalog.jsonb_array_length(p_key)<>2 OR pg_catalog.jsonb_typeof(p_key->0) IS DISTINCT FROM 'string'
    OR pg_catalog.jsonb_typeof(p_key->1) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
  v:=p_key->>0;
  IF v='' OR v IS DISTINCT FROM pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(v))
    OR pg_catalog.jsonb_array_length(p_key->1)=0
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_key->1) x WHERE pg_catalog.jsonb_typeof(x)<>'string') THEN RETURN NULL; END IF;
  a:=ARRAY(SELECT pg_catalog.jsonb_array_elements_text(p_key->1));
  IF ''=ANY(a) OR a IS DISTINCT FROM marketplace_sec.phase9_catalogue_normalized_authors_v1(a) THEN RETURN NULL; END IF;
 ELSIF p_kind IN('isbn13','isbn10') THEN
  IF pg_catalog.jsonb_array_length(p_key)<>1 OR pg_catalog.jsonb_typeof(p_key->0) IS DISTINCT FROM 'string' THEN RETURN NULL; END IF;
  v:=p_key->>0;
  IF marketplace_sec.phase9_metadata_normalized_isbn13(v) IS NULL
    OR (p_kind='isbn13' AND v !~ '^97[89][0-9]{10}$')
    OR (p_kind='isbn10' AND v !~ '^[0-9]{9}[0-9X]$') THEN RETURN NULL; END IF;
 ELSIF p_kind='provider' THEN
  IF pg_catalog.jsonb_array_length(p_key)<>3
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_key) x WHERE pg_catalog.jsonb_typeof(x)<>'string')
    OR p_key->>0 !~ '^[a-z][a-z0-9_-]{1,63}$' OR p_key->>1 NOT IN('edition','work')
    OR NOT marketplace_sec.phase9_catalogue_safe_text_v1(p_key->>2,256)
    OR p_key->>2 IS DISTINCT FROM pg_catalog.btrim(p_key->>2)
  THEN RETURN NULL; END IF;
 ELSE RETURN NULL;
 END IF;
 RETURN ('x' || pg_catalog.substr(pg_catalog.encode(pg_catalog.sha256(
  pg_catalog.convert_to(pg_catalog.jsonb_build_array(
    'psr-catalogue-v1', p_kind, p_key)::text, 'UTF8')), 'hex'), 1, 16)
 )::bit(64)::bigint;
END$$;
CREATE FUNCTION marketplace_sec.phase9_catalogue_isbn_v1(p_isbn10 text,p_isbn13 text)
RETURNS TABLE(isbn10 text,isbn13 text,admitted boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE converted text; probe text;
BEGIN
 isbn10:=pg_catalog.upper(pg_catalog.regexp_replace(p_isbn10,'[[:space:]-]+','','g'));
 isbn13:=pg_catalog.upper(pg_catalog.regexp_replace(p_isbn13,'[[:space:]-]+','','g'));
 converted:=marketplace_sec.phase9_metadata_normalized_isbn13(isbn10); admitted:=false;
 IF (isbn10 IS NOT NULL AND (isbn10 !~ '^[0-9]{9}[0-9X]$' OR converted IS NULL))
  OR (isbn13 IS NOT NULL AND (isbn13 !~ '^97[89][0-9]{10}$' OR marketplace_sec.phase9_metadata_normalized_isbn13(isbn13) IS NULL))
  OR (isbn10 IS NOT NULL AND isbn13 IS NOT NULL AND converted IS DISTINCT FROM isbn13)
 THEN RETURN NEXT; RETURN; END IF;
 isbn13:=coalesce(isbn13,converted);
 probe:=isbn13;
 admitted:=NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_catalogue_isbn_blocklist b WHERE b.isbn13=probe);
 RETURN NEXT;
END$$;

-- 3. Generic identity resolution: 02b sections 4-6.
-- 02b §§4.1–4.2/5/6: source-backed grouping is evidence about an existing pair.
CREATE FUNCTION marketplace_sec.phase9_catalogue_work_proof_v1(
 p_edition_id uuid,p_work_id uuid,p_adapter_key text,p_record_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $proof$
 SELECT EXISTS(
  SELECT 1 FROM public.book_metadata_sources s
  JOIN public.canonical_provider_ids e ON e.adapter_key=s.adapter_key AND e.id_kind='edition'
    AND e.external_id=s.provider_book_id AND e.canonical_edition_id=p_edition_id
  JOIN public.canonical_provider_ids w ON w.adapter_key=s.adapter_key AND w.id_kind='work'
    AND w.external_id=s.normalized_payload->>'workExternalId' AND w.canonical_work_id=p_work_id
  CROSS JOIN LATERAL marketplace_sec.phase9_catalogue_provider_ids_valid_v1(s.adapter_key,
    s.provider_book_id,s.normalized_payload->>'workExternalId',NULL,
    s.normalized_payload->>'coverReference',NULL) checked
  WHERE s.canonical_edition_id=p_edition_id AND s.provider=s.adapter_key
    AND s.adapter_key=p_adapter_key AND s.provider_book_id=p_record_id
    AND s.normalized_payload->>'version'='psr-catalogue-facts-v1'
    AND s.normalized_payload->>'adapterKey'=s.adapter_key
    AND s.normalized_payload->>'providerRecordId'=s.provider_book_id AND checked.valid
    AND marketplace_sec.phase9_catalogue_safe_text_v1(s.normalized_payload->>'workExternalId',256)
    AND s.normalized_payload->>'workExternalId'=pg_catalog.btrim(s.normalized_payload->>'workExternalId'))
$proof$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_work_proof_v1(uuid,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_work_proof_v1(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;

-- 02b §6.1: the same no-update pair comparison serves normal and defensive recovery.
CREATE FUNCTION marketplace_sec.phase9_catalogue_pair_matches_v1(
 p_edition public.canonical_editions,p_work public.canonical_works,p_title text,
 p_authors text[],p_isbn13 text,p_provider_work_id uuid,p_adapter_key text,p_record_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $pair$
 SELECT coalesce(p_edition.id IS NOT NULL AND p_work.id IS NOT NULL
  AND p_edition.work_id=p_work.id
  AND pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(p_edition.title))=p_title
  AND marketplace_sec.phase9_catalogue_normalized_authors_v1(p_edition.authors)=p_authors
  AND i.admitted AND (p_isbn13 IS NULL OR i.isbn13 IS NULL OR i.isbn13=p_isbn13)
  AND (p_provider_work_id IS NULL OR p_provider_work_id=p_work.id)
  AND ((pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
      coalesce(p_work.title_normalized,p_work.primary_title)))=p_title
    AND marketplace_sec.phase9_catalogue_normalized_authors_v1(p_work.primary_authors)=p_authors)
   OR p_provider_work_id=p_work.id
   OR marketplace_sec.phase9_catalogue_work_proof_v1(p_edition.id,p_work.id,p_adapter_key,p_record_id)),false)
 FROM marketplace_sec.phase9_catalogue_isbn_v1(p_edition.isbn_10,p_edition.isbn_13) i
$pair$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_pair_matches_v1(
 public.canonical_editions,public.canonical_works,text,text[],text,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_pair_matches_v1(
 public.canonical_editions,public.canonical_works,text,text[],text,uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;

-- 02b §§4.1–4.2/5/6/9/11: trusted policy hand-off, atomic shared identity writes.
CREATE FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(
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
 -- §5 Owner contract: programming errors propagate even for a denied policy.
 IF NOT coalesce(marketplace_sec.phase9_catalogue_source_policy_valid_v1(p_source_policy),false)
  OR p_source_policy->>'adapterKey' IS DISTINCT FROM m->>'adapterKey'
  OR p_source_policy->>'adapterVersion' IS DISTINCT FROM m->>'adapterVersion'
 THEN RAISE EXCEPTION 'P9_CATALOGUE_SOURCE_POLICY_INVALID'; END IF;
 -- §12: companion transport and validation belong to 7b.
 IF p_companion IS NOT NULL THEN RETURN NEXT; RETURN; END IF;
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
  -- §6.2: discover every prospective work without row locks; freeze the key set.
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
   -- 02a §7.2 / 02b §6: every conflicting hit is locked in the same order.
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
  -- §6.1: uniqueness waits are followed by fresh statements, never RETURNING guesses.
  SELECT e.id INTO v_hit13 FROM public.canonical_editions e WHERE e.isbn_13=v_isbn13;
  SELECT e.id INTO v_hit10 FROM public.canonical_editions e WHERE e.isbn_10=v_isbn10;
  SELECT p.canonical_edition_id INTO v_hit_provider FROM public.canonical_provider_ids p
   WHERE p.adapter_key=v_adapter AND p.id_kind='edition' AND p.external_id=v_record;
  SELECT pg_catalog.array_agg(DISTINCT id),pg_catalog.count(DISTINCT id)::integer INTO v_ids,v_n
   FROM pg_catalog.unnest(ARRAY[v_hit13,v_hit10,v_hit_provider,
    CASE WHEN v_isbn13 IS NULL AND v_target IS NULL THEN v_proposed ELSE NULL END]) id WHERE id IS NOT NULL;
  IF v_n<>1 THEN RAISE SQLSTATE 'P9C01'; END IF;
  v_target:=v_ids[1];
  -- §6.2/OQ1: a privileged edition winner appearing after an incumbent-work
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
   -- 02a §7.2: fresh read-only recovery; no insertion is retried after rollback.
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
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

-- 4. Private choice/count bookkeeping and Add/Select replacements: 02b sections 5/7.2.
-- 02b §§4.3/4.4/5/6.2/7.2: private counters; caller holds identity and private-choice locks.
CREATE FUNCTION marketplace_sec.phase9_catalogue_increment_v1(
  p_work_id uuid,p_edition_id uuid,p_searched integer,p_chosen integer,p_added integer
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT coalesce(p_searched BETWEEN 0 AND 1 AND p_chosen BETWEEN 0 AND 1
    AND p_added BETWEEN 0 AND 1,false)
    OR (p_searched=1 AND p_work_id IS NULL)
    OR ((p_chosen=1 OR p_added=1) AND (p_work_id IS NULL OR p_edition_id IS NULL))
    OR (p_work_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.canonical_works w WHERE w.id=p_work_id))
    OR (p_edition_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.canonical_editions e
      WHERE e.id=p_edition_id AND e.work_id=p_work_id))
  THEN RAISE EXCEPTION 'P9_CATALOGUE_COUNTER_INVALID'; END IF;
  IF p_searched=1 THEN
    INSERT INTO public.canonical_work_stats(canonical_work_id,times_searched)
      VALUES(p_work_id,p_searched)
    ON CONFLICT(canonical_work_id) DO UPDATE SET
      times_searched=public.canonical_work_stats.times_searched+excluded.times_searched,
      updated_at=pg_catalog.transaction_timestamp();
  END IF;
  IF p_chosen=1 OR p_added=1 THEN
    INSERT INTO public.canonical_edition_stats(canonical_edition_id,times_chosen,times_added)
      VALUES(p_edition_id,p_chosen,p_added)
    ON CONFLICT(canonical_edition_id) DO UPDATE SET
      times_chosen=public.canonical_edition_stats.times_chosen+excluded.times_chosen,
      times_added=public.canonical_edition_stats.times_added+excluded.times_added,
      updated_at=pg_catalog.transaction_timestamp();
  END IF;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_increment_v1(uuid,uuid,integer,integer,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_increment_v1(uuid,uuid,integer,integer,integer)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION marketplace_sec.phase9_catalogue_count_choice_v1(
  p_candidate_id uuid,p_selection_id uuid,p_metadata_digest text,p_work_id uuid,p_edition_id uuid
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
  effect marketplace_sec.phase9_catalogue_choice_effects;
BEGIN
  -- §6.2: callers acquired candidate→state→this effect before shared locks. No late private locks.
  SELECT * INTO c FROM public.image_extraction_candidates candidate WHERE candidate.id=p_candidate_id;
  SELECT * INTO s FROM public.phase9_candidate_edition_state state
    WHERE state.candidate_id=c.id AND state.session_id=c.session_id AND state.store_id=c.store_id;
  SELECT * INTO effect FROM marketplace_sec.phase9_catalogue_choice_effects choice
    WHERE choice.selection_id=p_selection_id AND choice.candidate_id=c.id
      AND choice.session_id=c.session_id AND choice.store_id=c.store_id;
  IF effect.selection_id IS NULL OR effect.counted OR s.selection_id IS DISTINCT FROM p_selection_id
    OR effect.metadata_digest IS DISTINCT FROM p_metadata_digest
    OR p_metadata_digest IS DISTINCT FROM pg_catalog.encode(pg_catalog.sha256(
      pg_catalog.convert_to(s.selected_option_snapshot::text,'UTF8')),'hex')
    OR p_work_id IS NULL OR p_edition_id IS NULL
    OR NOT EXISTS(SELECT 1 FROM public.canonical_editions e
      JOIN public.canonical_works w ON w.id=e.work_id
      WHERE e.id=p_edition_id AND w.id=p_work_id)
  THEN RETURN; END IF;
  PERFORM marketplace_sec.phase9_catalogue_increment_v1(p_work_id,p_edition_id,0,1,0);
  UPDATE marketplace_sec.phase9_catalogue_choice_effects SET counted=true,
    canonical_edition_id=p_edition_id,completed_at=pg_catalog.transaction_timestamp()
    WHERE selection_id=effect.selection_id;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_count_choice_v1(uuid,uuid,text,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_count_choice_v1(uuid,uuid,text,uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

-- 02b §§5/6/7.2: Select resolves existing targets only; no canonical/tuple/source creation.
CREATE FUNCTION marketplace_sec.phase9_catalogue_choice_target_v1(
 p_metadata jsonb,p_hint uuid,p_adapter_key text,p_record_id text)
RETURNS TABLE(canonical_work_id uuid,canonical_edition_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE m jsonb:=p_metadata; e public.canonical_editions; w public.canonical_works;
  v_isbn record; v_existing_isbn record; v_title text; v_authors text[];
  v_hits uuid[]; v_after uuid[]; v_work_id uuid; v_provider text; v_record text;
  v_source public.book_metadata_sources; v_work_ref text; v_provider_valid boolean;
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
  -- §§5/7.2: no-hint attribution needs the same shared admission as Add.
  IF p_hint IS NULL AND (v_provider IS NULL OR v_record IS NULL
    OR NOT marketplace_sec.phase9_catalogue_shared_admitted_v1(v_provider))
  THEN RETURN NEXT; RETURN; END IF;
  IF v_provider IS NOT NULL AND v_record IS NOT NULL THEN
    SELECT ids.valid INTO v_provider_valid FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
      v_provider,v_record,NULL,NULL,m->>'coverReference',NULL) ids;
    IF NOT coalesce(v_provider_valid,false) THEN RETURN NEXT; RETURN; END IF;
    SELECT * INTO v_source FROM public.book_metadata_sources source
      WHERE source.provider=v_provider AND source.provider_book_id=v_record;
    IF v_source.id IS NOT NULL THEN v_work_ref:=v_source.normalized_payload->>'workExternalId'; END IF;
    IF v_work_ref IS NOT NULL THEN
      SELECT ids.valid INTO v_provider_valid FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
        v_provider,v_record,v_work_ref,NULL,m->>'coverReference',NULL) ids;
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
    OR (v_work_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.canonical_provider_ids ids
      WHERE ids.adapter_key=v_provider AND ids.id_kind='work' AND ids.external_id=v_work_ref
        AND ids.canonical_work_id=w.id))
  THEN RETURN NEXT; RETURN; END IF;
  canonical_work_id:=w.id; canonical_edition_id:=e.id; RETURN NEXT; RETURN;
  EXCEPTION WHEN SQLSTATE 'P9C01' THEN canonical_work_id:=NULL; canonical_edition_id:=NULL; END;
  RETURN NEXT;
END$$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_choice_target_v1(jsonb,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_choice_target_v1(jsonb,uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;

-- 02b ??5/6/7.2; forward replacement of M81 lines 11?326.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(
  p_candidate_id uuid,p_session_id uuid,p_store_id uuid
) RETURNS TABLE(canonical_work_id uuid,canonical_edition_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $catalogue$
DECLARE
  c public.image_extraction_candidates; s public.phase9_candidate_edition_state;
  x public.phase9_selected_metadata_snapshots; l public.phase9_metadata_lookups;
  a public.metadata_enrichment_attempts; v_policy jsonb;
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
    -- §6 confirmed by M73 register_structural_metadata_lookup/attempt (L298/322):
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
      -- §6.1: every scoped edition identity must still point at the saved target.
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
      THEN v_identity_conflict:=true; RAISE SQLSTATE 'P9C01'; END IF;
      -- §6.1: an exact saved target cannot disambiguate duplicate normalized
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

  -- §§3/6: current_suggestion stores a display projection, not provider provenance.
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
  RETURN QUERY SELECT resolved.canonical_work_id,resolved.canonical_edition_id
    FROM marketplace_sec.phase9_catalogue_resolve_v1(m,NULL,v_policy) resolved;
END
$catalogue$;
ALTER FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

-- 02b ?7.2; M81 Add lines 333?502, existing eligibility/hydration/receipt retained.
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
  -- 02a §§3.1/4: chosen-state lock follows replay/session/candidate locks.
  SELECT * INTO v_selected FROM public.phase9_candidate_edition_state state
    WHERE state.candidate_id=v_candidate.id AND state.session_id=v_session.id
      AND state.store_id=v_session.store_id FOR UPDATE;
  -- 02b ??6.2/7.2: current effect is locked before any shared target locks; never scan old choices.
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
  -- 02b ?7.2: inventory succeeded; helper's coherent pair is the sole source for both effects.
  IF v_canonical_work IS NOT NULL AND v_canonical_edition IS NOT NULL THEN
    IF v_choice->>'mode'='edition_option' AND v_choice->>'selectionId'=v_selected.selection_id::text THEN
      PERFORM marketplace_sec.phase9_catalogue_count_choice_v1(v_candidate.id,v_selected.selection_id,
        v_choice_digest,v_canonical_work,v_canonical_edition);
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
REVOKE ALL ON FUNCTION public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;


-- 02b ?7.2; M73 Select lines 166?234, exact replay/version/confirmation behavior retained.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(
 p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,p_expected_metadata_revision integer,
 p_expected_review_version integer,p_source text,p_options_version integer,p_option_id uuid,p_selection_id uuid,
 p_idempotency_key text,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.image_extraction_candidates; s public.phase9_candidate_edition_state; r jsonb; m jsonb;
 selected uuid; source_id uuid; fingerprint text; replay jsonb; response jsonb; q text; review jsonb;
 v_digest text; v_work uuid; v_edition uuid; v_hint uuid;
 v_lookup uuid; v_attempt uuid; v_snapshot public.phase9_selected_metadata_snapshots; v_proof jsonb;
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
 INSERT INTO marketplace_sec.phase9_catalogue_choice_effects(selection_id,candidate_id,store_id,session_id,
  lookup_id,attempt_id,option_id,metadata_digest)
 VALUES(selected,c.id,c.store_id,c.session_id,v_lookup,v_attempt,
  CASE WHEN p_source='edition_option' THEN source_id ELSE NULL END,v_digest);
 PERFORM effect.selection_id FROM marketplace_sec.phase9_catalogue_choice_effects effect
  WHERE effect.selection_id=selected AND effect.candidate_id=c.id
   AND effect.session_id=c.session_id AND effect.store_id=c.store_id FOR UPDATE;
 SELECT target.canonical_work_id,target.canonical_edition_id INTO v_work,v_edition
  FROM marketplace_sec.phase9_catalogue_choice_target_v1(
   m,v_hint,v_proof->>'adapterKey',v_proof->>'providerRecordId') target;
 IF v_work IS NOT NULL AND v_edition IS NOT NULL THEN
  PERFORM marketplace_sec.phase9_catalogue_count_choice_v1(c.id,selected,v_digest,v_work,v_edition);
 END IF;
 response:=marketplace_sec.phase9_edition_choices(c);
 PERFORM marketplace_sec.phase9_finish_replay(auth.uid()::text,'EP_SELECT_V1',p_idempotency_key,
  response||jsonb_build_object('rows','[]'::jsonb,'optionsExpiresAt',NULL),'edition_selected_no_inventory_effect');
 RETURN response;
END$$;
ALTER FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

-- 5. M67 discovery forward replacement: 02b §§5/6.1, AC7-3/6.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_local_match(p_candidate public.image_extraction_candidates)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE isbn text:=marketplace_sec.phase9_metadata_normalized_isbn13(p_candidate.observed_isbn_clue);
 q text:=marketplace_sec.phase9_metadata_candidate_query_identity(p_candidate);
 e public.canonical_editions; matches uuid[]; allowed boolean;
BEGIN
 IF isbn IS NULL THEN
  SELECT pg_catalog.array_agg(x.id) INTO matches FROM (
   SELECT c.id FROM public.canonical_editions c
   CROSS JOIN LATERAL marketplace_sec.phase9_catalogue_isbn_v1(c.isbn_10,c.isbn_13) checked
   WHERE NOT c.hidden AND checked.admitted AND marketplace_sec.phase9_edition_identity_compatible(
    marketplace_sec.phase9_edition_canonical_snapshot(c),q) LIMIT 2
  ) x;
 ELSE
  SELECT pg_catalog.array_agg(x.id) INTO matches FROM (
   SELECT c.id FROM public.canonical_editions c
   CROSS JOIN LATERAL marketplace_sec.phase9_catalogue_isbn_v1(c.isbn_10,c.isbn_13) checked
   WHERE NOT c.hidden AND checked.admitted AND isbn=checked.isbn13 LIMIT 2
  ) x;
 END IF;
 IF pg_catalog.cardinality(matches) IS DISTINCT FROM 1 THEN RETURN NULL; END IF;
 SELECT * INTO e FROM public.canonical_editions WHERE id=matches[1];
 SELECT admitted INTO allowed FROM marketplace_sec.phase9_catalogue_isbn_v1(e.isbn_10,e.isbn_13);
 IF e.hidden OR NOT coalesce(allowed,false) OR NOT marketplace_sec.phase9_edition_identity_compatible(
  marketplace_sec.phase9_edition_canonical_snapshot(e),q) THEN RETURN NULL; END IF;
 RETURN e.id;
EXCEPTION
 WHEN insufficient_privilege OR undefined_table OR undefined_function THEN RAISE;
 WHEN others THEN RETURN NULL;
END$$;

-- 6. Explicit ownership/RLS/ACLs: 02b §9, AC7-8/28. No default-privilege change.
ALTER TABLE public.canonical_provider_ids OWNER TO postgres;
ALTER TABLE public.canonical_work_stats OWNER TO postgres;
ALTER TABLE public.canonical_edition_stats OWNER TO postgres;
ALTER TABLE marketplace_sec.phase9_catalogue_choice_effects OWNER TO postgres;
ALTER TABLE marketplace_sec.phase9_catalogue_isbn_blocklist OWNER TO postgres;
ALTER TABLE public.canonical_provider_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_work_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_edition_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_sec.phase9_catalogue_choice_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_sec.phase9_catalogue_isbn_blocklist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.canonical_provider_ids,public.canonical_work_stats,public.canonical_edition_stats,
 marketplace_sec.phase9_catalogue_choice_effects,marketplace_sec.phase9_catalogue_isbn_blocklist
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.canonical_provider_ids TO authenticated,service_role;
GRANT SELECT ON TABLE public.canonical_work_stats,public.canonical_edition_stats TO service_role;
CREATE POLICY "canonical provider ids readable" ON public.canonical_provider_ids
 FOR SELECT TO authenticated USING(true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
 ON public.canonical_works,public.canonical_editions FROM PUBLIC,anon,authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
 ON public.book_metadata_sources FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.book_metadata_sources TO service_role;
DROP POLICY "metadata sources platform write" ON public.book_metadata_sources;
CREATE POLICY "metadata sources platform read" ON public.book_metadata_sources
 FOR SELECT TO authenticated USING(marketplace_sec.is_platform_operator());

ALTER FUNCTION marketplace_sec.phase9_catalogue_safe_text_v1(text,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_safe_text_v1(text,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_normalized_authors_v1(text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_normalized_authors_v1(text[]) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_source_policy_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_source_policy_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v1(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_shared_admitted_v1(text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_source_policy_v1(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_source_policy_v1(text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_identity_lock_key_v1(text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_identity_lock_key_v1(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_isbn_v1(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_isbn_v1(text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_work_proof_v1(uuid,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_work_proof_v1(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_pair_matches_v1(public.canonical_editions,public.canonical_works,text,text[],text,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_pair_matches_v1(public.canonical_editions,public.canonical_works,text,text[],text,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_increment_v1(uuid,uuid,integer,integer,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_increment_v1(uuid,uuid,integer,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_count_choice_v1(uuid,uuid,text,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_count_choice_v1(uuid,uuid,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_choice_target_v1(jsonb,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_choice_target_v1(jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_edition_local_match(public.image_extraction_candidates) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_local_match(public.image_extraction_candidates) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid)
  TO authenticated;

-- 7. The only migration-time data change: 02b §4.2 / Owner OQ7 registry attribution.
UPDATE public.phase9_provider_registry SET shared_source_note=
 'Open Library; normalized bibliographic facts retained for shared public reuse; attribution: Open Library; no raw response or image file retained.'
 WHERE adapter_key='open_library';
COMMIT;
