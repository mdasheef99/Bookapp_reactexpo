-- Owner M82 correction (2026-10-26); picker SDD sections 5-8/11; slice 6 SDD section 3.
-- Preserve a coherent edition choice through first review; retain removal and identity resets.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_edition_identity_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_query text; new_query text; s public.phase9_candidate_edition_state; r jsonb:=NEW.owner_review_snapshot->'value';
BEGIN
 SELECT * INTO s FROM public.phase9_candidate_edition_state WHERE candidate_id=NEW.id;
 -- A real title/author edit clears ISBN even before an edition state exists.
 IF OLD.owner_isbn13 IS NOT NULL AND NEW.owner_isbn13 IS NOT DISTINCT FROM OLD.owner_isbn13
  AND NOT coalesce((r#>>'{metadataChoice,mode}'='edition_option' AND r#>>'{metadataChoice,selectionId}'=s.selection_id::text
  AND r->'originalTitle'=s.selected_option_snapshot->'title' AND r->'authors'=s.selected_option_snapshot->'authors'
  AND r->'originalLanguage'=s.selected_option_snapshot->'language'
  AND ROW(NEW.observed_title,NEW.observed_authors,NEW.observed_language,NEW.observed_isbn_clue,
   NEW.observed_publisher_clue,NEW.owner_isbn13) IS NOT DISTINCT FROM
   ROW(OLD.observed_title,OLD.observed_authors,OLD.observed_language,OLD.observed_isbn_clue,
    OLD.observed_publisher_clue,OLD.owner_isbn13)
  AND NOT (NEW.review_disposition IN ('owner_removed_from_scan','skipped_false_detection') AND NEW.review_disposition IS DISTINCT FROM OLD.review_disposition)),false)
  AND (marketplace_sec.phase9_metadata_normalized_text(marketplace_sec.phase9_edition_effective_title(NEW))
    IS DISTINCT FROM marketplace_sec.phase9_metadata_normalized_text(marketplace_sec.phase9_edition_effective_title(OLD))
   OR (SELECT jsonb_agg(marketplace_sec.phase9_metadata_normalized_text(value) ORDER BY ordinal)
    FROM jsonb_array_elements_text(marketplace_sec.phase9_edition_effective_authors(NEW)) WITH ORDINALITY x(value,ordinal)) IS DISTINCT FROM (SELECT jsonb_agg(marketplace_sec.phase9_metadata_normalized_text(value) ORDER BY ordinal)
    FROM jsonb_array_elements_text(marketplace_sec.phase9_edition_effective_authors(OLD)) WITH ORDINALITY x(value,ordinal)))
 THEN NEW.owner_isbn13:=NULL; END IF;
 IF s.candidate_id IS NULL THEN RETURN NEW; END IF;
 -- The controlled select command saved this exact coherent choice before updating the review.
 IF r#>>'{metadataChoice,mode}'='edition_option' AND r#>>'{metadataChoice,selectionId}'=s.selection_id::text
  AND r->'originalTitle'=s.selected_option_snapshot->'title' AND r->'authors'=s.selected_option_snapshot->'authors'
  AND r->'originalLanguage'=s.selected_option_snapshot->'language'
  AND ROW(NEW.observed_title,NEW.observed_authors,NEW.observed_language,NEW.observed_isbn_clue,
   NEW.observed_publisher_clue,NEW.owner_isbn13) IS NOT DISTINCT FROM
   ROW(OLD.observed_title,OLD.observed_authors,OLD.observed_language,OLD.observed_isbn_clue,
    OLD.observed_publisher_clue,OLD.owner_isbn13)
  AND NOT (NEW.review_disposition IN ('owner_removed_from_scan','skipped_false_detection') AND NEW.review_disposition IS DISTINCT FROM OLD.review_disposition) THEN RETURN NEW; END IF;
 IF OLD.owner_isbn13 IS DISTINCT FROM NEW.owner_isbn13 THEN
  IF jsonb_typeof(NEW.owner_review_snapshot->'value')='object' THEN
   NEW.owner_review_snapshot:=jsonb_set(NEW.owner_review_snapshot,'{value,metadataChoice}',
    jsonb_build_object('mode','manual','selectionId',NULL)); END IF;
 END IF;
 IF ROW(NEW.observed_title,NEW.observed_authors,NEW.observed_language,NEW.observed_isbn_clue,NEW.observed_publisher_clue)
  IS DISTINCT FROM ROW(OLD.observed_title,OLD.observed_authors,OLD.observed_language,OLD.observed_isbn_clue,OLD.observed_publisher_clue)
  AND OLD.owner_isbn13 IS NOT DISTINCT FROM NEW.owner_isbn13 THEN
  IF NEW.owner_isbn13 IS NOT NULL THEN
   old_query:=marketplace_sec.phase9_edition_query_identity(OLD);
   new_query:=marketplace_sec.phase9_edition_query_identity(NEW);
  ELSE
   old_query:=marketplace_sec.phase9_metadata_candidate_query_identity(OLD);
   new_query:=marketplace_sec.phase9_metadata_candidate_query_identity(NEW);
  END IF;
 ELSE old_query:=marketplace_sec.phase9_edition_query_identity(OLD);
  new_query:=marketplace_sec.phase9_edition_query_identity(NEW); END IF;
 IF old_query IS DISTINCT FROM new_query OR OLD.owner_isbn13 IS DISTINCT FROM NEW.owner_isbn13
  OR NEW.review_disposition IN('owner_removed_from_scan','skipped_false_detection') THEN
  UPDATE public.phase9_candidate_edition_state SET request_generation=request_generation+1,request_id=NULL,
   query_identity=new_query,options='[]',source_lookup_id=NULL,source_attempt_id=NULL,source_fetched_at=NULL,
   options_expires_at=NULL,selection_id=NULL,selected_source=NULL,selected_source_id=NULL,
   selected_option_snapshot=NULL,selected_at=NULL,selected_by=NULL,updated_at=transaction_timestamp() WHERE candidate_id=NEW.id;
  IF old_query IS DISTINCT FROM new_query OR OLD.owner_isbn13 IS DISTINCT FROM NEW.owner_isbn13 THEN
   NEW.metadata_revision:=greatest(NEW.metadata_revision,OLD.metadata_revision+1); NEW.review_ready:=false;
   IF jsonb_typeof(NEW.owner_review_snapshot->'value')='object' THEN
    NEW.owner_review_snapshot:=jsonb_set(NEW.owner_review_snapshot,'{value,metadataChoice}',
     jsonb_build_object('mode','manual','selectionId',NULL)); END IF;
  END IF;
 END IF;
 RETURN NEW;
END$$;

ALTER FUNCTION marketplace_sec.phase9_edition_identity_change() OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_edition_identity_change() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
