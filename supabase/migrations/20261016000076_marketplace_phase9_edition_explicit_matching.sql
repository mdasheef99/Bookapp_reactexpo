-- M76: explicit Owner edition-option matching and opt-in rejection reasons.
-- Owner amendments 2026-10-13/16; DOC-3 §5.2.1; picker SDD §§3.1/4.1.
-- M65-M74 are APPLIED and byte-preserved. M75 (exhausted lookup recovery) stays deferred.
-- Explicit options only: comparison keys never rewrite stored titles/authors or query identity.
-- Automatic/current-suggestion identity (phase9_edition_identity_compatible) stays exact.
-- Apply before the metadata worker that emits these rules; SQL must admit every worker-eligible row.
-- Mirrors supabase/functions/_shared/imageInventory/metadata/explicitEditionTitle.ts.
BEGIN;

-- Latin combining accents only (U+0300-U+036F); English titles compare "&" as "and".
CREATE FUNCTION marketplace_sec.phase9_edition_title_key(p_value text,p_english boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text:=pg_catalog.regexp_replace(normalize(
 marketplace_sec.phase9_metadata_normalized_text(p_value),NFD),'[\u0300-\u036f]','','g');
BEGIN
 IF p_english THEN
  k:=pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.replace(k,'&',' and '),'[[:space:]]+',' ','g'));
 END IF;
 RETURN k;
END$$;

-- Accent-folded author key: full stops ignored, consecutive single-letter initials joined.
CREATE FUNCTION marketplace_sec.phase9_edition_author_key(p_value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE w text; initials text:=''; result text[]:=ARRAY[]::text[];
BEGIN
 FOR w IN SELECT x FROM pg_catalog.regexp_split_to_table(pg_catalog.btrim(pg_catalog.regexp_replace(
  pg_catalog.replace(pg_catalog.regexp_replace(normalize(
   marketplace_sec.phase9_metadata_normalized_text(p_value),NFD),'[\u0300-\u036f]','','g'),'.',' '),
  '[[:space:]]+',' ','g')),' ') x WHERE x<>''
 LOOP
  IF pg_catalog.char_length(w)=1 THEN initials:=initials||w;
  ELSE
   IF initials<>'' THEN result:=result||initials; initials:=''; END IF;
   result:=result||w;
  END IF;
 END LOOP;
 IF initials<>'' THEN result:=result||initials; END IF;
 RETURN pg_catalog.array_to_string(result,' ');
END$$;

-- Returns the query rewritten to the matched provider values plus per-field results.
-- Unmatched fields keep their original values, so the strict check still rejects them.
CREATE FUNCTION marketplace_sec.phase9_edition_explicit_query(p_metadata jsonb,p_query text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE q jsonb:=p_query::jsonb; observed text:=coalesce(q->>4,'');
 qlang text:=pg_catalog.split_part(coalesce(q->>6,''),'-',1);
 rlang text:=pg_catalog.split_part(coalesce(p_metadata->>'language',''),'-',1);
 english boolean; okey text; skey text; same_title boolean; title_ok boolean; authors_ok boolean:=true;
 a text; k text; m text; matched jsonb:='[]'::jsonb;
BEGIN
 english:=qlang='en' AND rlang='en';
 okey:=marketplace_sec.phase9_edition_title_key(observed,english);
 skey:=marketplace_sec.phase9_edition_title_key(p_metadata->>'title',english);
 same_title:=observed<>'' AND okey=skey;
 title_ok:=observed='' OR okey=skey OR (english
  AND pg_catalog.regexp_replace(okey,'^the ','')<>''
  AND pg_catalog.regexp_replace(okey,'^the ','')=pg_catalog.regexp_replace(skey,'^the ',''));
 IF title_ok AND observed<>'' THEN
  q:=jsonb_set(q,'{4}',to_jsonb(marketplace_sec.phase9_metadata_normalized_text(p_metadata->>'title')));
 END IF;
 FOR a IN SELECT jsonb_array_elements_text(coalesce(q->5,'[]'::jsonb)) LOOP
  k:=marketplace_sec.phase9_edition_author_key(a); m:=NULL;
  IF k<>'' THEN
   SELECT b INTO m FROM jsonb_array_elements_text(coalesce(p_metadata->'authors','[]'::jsonb)) b
   WHERE marketplace_sec.phase9_edition_author_key(b)=k
    OR (same_title AND pg_catalog.strpos(k,' ')=0 AND pg_catalog.char_length(k)>=2
     AND (pg_catalog.regexp_split_to_array(marketplace_sec.phase9_edition_author_key(b),' '))[
      pg_catalog.array_length(pg_catalog.regexp_split_to_array(marketplace_sec.phase9_edition_author_key(b),' '),1)]=k)
   LIMIT 1;
  END IF;
  IF m IS NULL THEN authors_ok:=false; matched:=matched||to_jsonb(a);
  ELSE matched:=matched||to_jsonb(marketplace_sec.phase9_metadata_normalized_text(m)); END IF;
 END LOOP;
 IF jsonb_typeof(q->5)='array' THEN q:=jsonb_set(q,'{5}',matched); END IF;
 -- Unknown result language only after a complete known-language text match.
 IF rlang='und' AND qlang NOT IN('und','') AND observed<>'' AND title_ok AND authors_ok
  AND jsonb_array_length(coalesce(q->5,'[]'::jsonb))>0
 THEN q:=jsonb_set(q,'{6}',to_jsonb(p_metadata->>'language')); END IF;
 RETURN jsonb_build_object('query',q,'titleOk',title_ok,'authorsOk',authors_ok);
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_option_eligible(p_metadata jsonb,p_query text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE original jsonb:=p_query::jsonb; q jsonb;
BEGIN
 q:=marketplace_sec.phase9_edition_explicit_query(p_metadata,p_query)->'query';
 -- Preserve the existing exact-ISBN unknown-query-language exception.
 IF original->>6='und' AND original->>3 IS NOT NULL
  AND original->>3=marketplace_sec.phase9_metadata_normalized_isbn13(p_metadata->>'isbn13')
 THEN q:=jsonb_set(q,'{6}',p_metadata->'language'); END IF;
 RETURN marketplace_sec.phase9_edition_identity_compatible(p_metadata,q::text);
EXCEPTION WHEN others THEN RETURN false;
END$$;

-- Display-only diagnosis of an already-blocked row; never changes eligibility or state.
CREATE FUNCTION marketplace_sec.phase9_edition_rejection_reason(p_row jsonb,p_query text,p_rows jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE m jsonb:=p_row->'metadata'; q jsonb:=p_query::jsonb; explicit jsonb;
 query_language text:=pg_catalog.split_part(q->>6,'-',1); result_language text:=pg_catalog.split_part(m->>'language','-',1);
 exact_isbn boolean; reference_volume text; reference_count integer; supplied_volume text;
BEGIN
 IF p_row->>'eligibility'='eligible' THEN RETURN NULL; END IF;
 IF p_row->>'eligibility'='unavailable' THEN RETURN 'result_unavailable'; END IF;
 IF NOT marketplace_sec.phase9_edition_valid_metadata(m,true) THEN RETURN 'identity_unverified'; END IF;
 explicit:=marketplace_sec.phase9_edition_explicit_query(m,p_query);
 IF NOT (explicit->>'titleOk')::boolean THEN RETURN 'title_differs'; END IF;
 IF NOT (explicit->>'authorsOk')::boolean THEN RETURN 'author_differs'; END IF;
 exact_isbn:=coalesce(q->>3 IS NOT NULL
  AND q->>3=marketplace_sec.phase9_metadata_normalized_isbn13(m->>'isbn13'),false);
 IF result_language='und' OR (query_language='und' AND NOT exact_isbn) THEN RETURN 'language_unknown'; END IF;
 IF query_language<>result_language AND NOT (query_language='und' AND exact_isbn)
 THEN RETURN 'language_differs'; END IF;
 supplied_volume:=marketplace_sec.phase9_metadata_normalized_text(m->>'volume');
 IF coalesce(supplied_volume,'')<>'' AND q->>3 IS NOT NULL THEN
  SELECT min(marketplace_sec.phase9_metadata_normalized_text(x#>>'{metadata,volume}')),
   count(DISTINCT marketplace_sec.phase9_metadata_normalized_text(x#>>'{metadata,volume}'))
  INTO reference_volume,reference_count FROM jsonb_array_elements(p_rows) x
  WHERE x->>'eligibility'='eligible' AND x#>>'{metadata,matchRationale}'='exact_validated_isbn'
   AND q->>3=marketplace_sec.phase9_metadata_normalized_isbn13(x#>>'{metadata,isbn13}')
   AND coalesce(marketplace_sec.phase9_metadata_normalized_text(x#>>'{metadata,volume}'),'')<>''
   AND marketplace_sec.phase9_edition_option_eligible(x->'metadata',p_query);
  IF reference_count=1 AND supplied_volume<>reference_volume THEN RETURN 'volume_differs'; END IF;
 END IF;
 RETURN 'identity_unverified';
EXCEPTION WHEN others THEN
 RETURN CASE WHEN p_row->>'eligibility'='eligible' THEN NULL
  WHEN p_row->>'eligibility'='unavailable' THEN 'result_unavailable' ELSE 'identity_unverified' END;
END$$;

-- Same body as M70 plus reasons for the exact opt-in x-client-info capability only.
-- Legacy callers, including direct RPC users, keep the existing response shape.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_choices(p_candidate public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE response jsonb; s public.phase9_candidate_edition_state; confirmed boolean;
 include_reasons boolean:=false; rows jsonb;
BEGIN
 response:=marketplace_sec.phase9_edition_legacy_choices(p_candidate);
 BEGIN
  include_reasons:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-client-info'
   ='bookconnect/edition-reasons-v1',false);
 EXCEPTION WHEN others THEN include_reasons:=false; END;
 IF include_reasons AND jsonb_array_length(response->'rows')>0 THEN
  SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=p_candidate.id
   AND store_id=p_candidate.store_id AND session_id=p_candidate.session_id;
  SELECT jsonb_agg(jsonb_set(r,'{rejectionReason}',coalesce(to_jsonb(
   marketplace_sec.phase9_edition_rejection_reason(s.options->((r->>'ordinal')::integer),s.query_identity,s.options)),
   'null'::jsonb)) ORDER BY ordinal)
  INTO rows FROM jsonb_array_elements(response->'rows') WITH ORDINALITY x(r,ordinal);
  response:=jsonb_set(response,'{rows}',rows);
 END IF;
 IF jsonb_typeof(response->'selection')='object' THEN
  s:=marketplace_sec.phase9_edition_projection_selection(p_candidate);
  confirmed:=coalesce(s.selection_id::text=response#>>'{selection,selectionId}'
   AND s.selected_at IS NOT NULL AND s.selected_by IS NOT NULL,false);
  response:=jsonb_set(response,'{selection,confirmedByOwner}',to_jsonb(confirmed));
 END IF;
 RETURN response;
END$$;

-- New private helpers are postgres-only, matching the existing private edition helpers.
ALTER FUNCTION marketplace_sec.phase9_edition_title_key(text,boolean) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_edition_author_key(text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_edition_explicit_query(jsonb,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_edition_rejection_reason(jsonb,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_title_key(text,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_author_key(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_explicit_query(jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_rejection_reason(jsonb,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
