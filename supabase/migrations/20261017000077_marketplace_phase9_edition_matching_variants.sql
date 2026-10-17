-- M77: explicit edition-option matching variants. Owner decisions 2026-10-17; DOC-3 §5.2.1;
-- picker SDD §4.1 amendment. Mirrors supabase/functions/_shared/imageInventory/metadata/explicitEditionTitle.ts.
-- Forward-only: M65-M76 stay unchanged. Apply before the metadata worker that emits these rules;
-- SQL must admit every worker-eligible row, so M76's documented supersets (marks on any base letter,
-- comma-form and joined-initial surnames) are kept, not narrowed.
--  * Titles (all languages): hyphens/dashes and apostrophes join words; other listed punctuation
--    separates words. Explicit code points only, never locale-dependent character classes.
--  * English titles: "æ" reads "ae", then "ae" reads "e" ("Encyclopaedia" = "Encyclopedia").
--  * Authors: same first and last names with each middle name equal or given by its initial.
-- Automatic/current-suggestion identity (phase9_edition_identity_compatible) stays exact.
-- Rollback: forward-restore the M76 bodies of title_key/explicit_query and drop the new helper.
BEGIN;

-- Latin combining accents only in the worker; SQL folds U+0300-U+036F on any letter (superset).
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_title_key(p_value text,p_english boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text:=pg_catalog.regexp_replace(normalize(
 marketplace_sec.phase9_metadata_normalized_text(p_value),NFD),'['||pg_catalog.chr(768)||'-'||pg_catalog.chr(879)||']','','g');
 -- Joining: - U+2010..U+2015 ' U+2018 U+2019 U+02BC. Separating: . , : ; ! ? " U+201C U+201D ( ) [ ] /
 -- U+00AB U+00BB U+00BF U+00A1.
 joining text:='-'||pg_catalog.chr(8208)||pg_catalog.chr(8209)||pg_catalog.chr(8210)||pg_catalog.chr(8211)
  ||pg_catalog.chr(8212)||pg_catalog.chr(8213)||''''||pg_catalog.chr(8216)||pg_catalog.chr(8217)||pg_catalog.chr(700);
 separating text:='.,:;!?"'||pg_catalog.chr(8220)||pg_catalog.chr(8221)||'()[]/'
  ||pg_catalog.chr(171)||pg_catalog.chr(187)||pg_catalog.chr(191)||pg_catalog.chr(161);
BEGIN
 k:=pg_catalog.translate(k,joining,'');
 k:=pg_catalog.translate(k,separating,pg_catalog.repeat(' ',pg_catalog.char_length(separating)));
 IF p_english THEN
  k:=pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(k,'&',' and '),pg_catalog.chr(230),'ae'),'ae','e');
 END IF;
 RETURN pg_catalog.btrim(pg_catalog.regexp_replace(k,'[[:space:]]+',' ','g'));
END$$;

-- Same first and last words, equal word counts (at least three), and each middle word equal or a
-- one-letter initial of the other. Words use the author-key folding without joining initials.
CREATE FUNCTION marketplace_sec.phase9_edition_author_middle_match(p_left text,p_right text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE a text[]; b text[]; n integer; i integer;
BEGIN
 SELECT coalesce(array_agg(x ORDER BY o),ARRAY[]::text[]) INTO a FROM pg_catalog.regexp_split_to_table(pg_catalog.btrim(
  pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.regexp_replace(normalize(
   marketplace_sec.phase9_metadata_normalized_text(p_left),NFD),'['||pg_catalog.chr(768)||'-'||pg_catalog.chr(879)||']','','g'),
   '.',' '),'[[:space:]]+',' ','g')),' ') WITH ORDINALITY t(x,o) WHERE x<>'';
 SELECT coalesce(array_agg(x ORDER BY o),ARRAY[]::text[]) INTO b FROM pg_catalog.regexp_split_to_table(pg_catalog.btrim(
  pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.regexp_replace(normalize(
   marketplace_sec.phase9_metadata_normalized_text(p_right),NFD),'['||pg_catalog.chr(768)||'-'||pg_catalog.chr(879)||']','','g'),
   '.',' '),'[[:space:]]+',' ','g')),' ') WITH ORDINALITY t(x,o) WHERE x<>'';
 n:=coalesce(pg_catalog.array_length(a,1),0);
 IF n<3 OR n<>coalesce(pg_catalog.array_length(b,1),0) OR a[1]<>b[1] OR a[n]<>b[n] THEN RETURN false; END IF;
 FOR i IN 2..n-1 LOOP
  IF NOT (a[i]=b[i] OR (pg_catalog.char_length(a[i])=1 AND pg_catalog.left(b[i],1)=a[i])
   OR (pg_catalog.char_length(b[i])=1 AND pg_catalog.left(a[i],1)=b[i])) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END$$;

-- Same body as M76 plus the middle-initial author alternative.
CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_explicit_query(p_metadata jsonb,p_query text)
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
    OR marketplace_sec.phase9_edition_author_middle_match(a,b)
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

-- The new private helper is postgres-only, matching the existing private edition helpers.
ALTER FUNCTION marketplace_sec.phase9_edition_author_middle_match(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_author_middle_match(text,text)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
