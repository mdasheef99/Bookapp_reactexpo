BEGIN;

-- Unit 6G bounded correction. Selected metadata must carry its snapshot identity
-- into the compact card, and final inventory commit requires an author while
-- review/save remains compatible with the SDD's empty-author state.
-- This migration changes only internal projection helpers and the existing
-- readiness blocker predicate; it does not rewrite business rows.

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_metadata_candidate_query_identity(
  p_candidate public.image_extraction_candidates
) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT jsonb_build_array(
    'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1',
    CASE WHEN marketplace_sec.phase9_metadata_normalized_text(
      p_candidate.observed_title)<>''
      OR EXISTS(SELECT 1 FROM unnest(coalesce(
        p_candidate.observed_authors,ARRAY[]::text[])) authors(author_name)
        WHERE marketplace_sec.phase9_metadata_normalized_text(author_name)<>'')
      THEN 'bibliographic' ELSE 'isbn' END,
    marketplace_sec.phase9_metadata_normalized_isbn13(
      p_candidate.observed_isbn_clue),
    marketplace_sec.phase9_metadata_normalized_text(p_candidate.observed_title),
    to_jsonb(ARRAY(SELECT marketplace_sec.phase9_metadata_normalized_text(author_name)
      FROM unnest(coalesce(p_candidate.observed_authors,ARRAY[]::text[]))
        WITH ORDINALITY a(author_name,ordinality)
      WHERE marketplace_sec.phase9_metadata_normalized_text(author_name)<>''
      ORDER BY ordinality)),
    marketplace_sec.phase9_metadata_normalized_language(p_candidate.observed_language),
    to_jsonb(ARRAY(SELECT DISTINCT clue FROM (SELECT
      marketplace_sec.phase9_metadata_normalized_text(
        p_candidate.observed_publisher_clue) clue) normalized
      WHERE clue<>'' ORDER BY clue))
  )::text
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_metadata_summary(
  p_detail jsonb
) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE
  v_metadata jsonb:=p_detail#>'{metadata,snapshot}';
  v_selected boolean;
  v_title boolean;
  v_authors boolean;
  v_language boolean;
  v_cover boolean;
  v_selection_id boolean;
BEGIN
  v_selected:=p_detail#>>'{metadata,state}'='selected'
    AND jsonb_typeof(v_metadata)='object';
  IF NOT v_selected THEN RETURN NULL; END IF;
  v_title:=marketplace_sec.phase9_owner_ux_safe_text(
    v_metadata->'title',1,512,false);
  v_authors:=CASE WHEN jsonb_typeof(v_metadata->'authors')='array' THEN
      jsonb_array_length(v_metadata->'authors') BETWEEN 1 AND 20
      AND NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(v_metadata->'authors') author
        WHERE NOT marketplace_sec.phase9_owner_ux_safe_text(author,1,256,false)
      )
      AND (SELECT count(*) FROM jsonb_array_elements(v_metadata->'authors'))
        =(SELECT count(DISTINCT author) FROM jsonb_array_elements(v_metadata->'authors') author)
    ELSE false END;
  v_language:=marketplace_sec.phase9_owner_ux_canonical_language(
    v_metadata->'language');
  v_cover:=jsonb_typeof(v_metadata->'coverReference')='string'
    AND char_length(v_metadata->>'coverReference') BETWEEN 1 AND 512
    AND v_metadata->>'coverReference'
      ~* '^https://books[.]google[.]com(?::[0-9]+)?([/?#][^[:space:]]*)?$';
  v_selection_id:=jsonb_typeof(p_detail#>'{metadata,selectionId}')='string'
    AND p_detail#>>'{metadata,selectionId}'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  RETURN jsonb_build_object(
    'title',CASE WHEN v_title THEN v_metadata->'title' ELSE 'null'::jsonb END,
    'authors',CASE WHEN v_authors THEN v_metadata->'authors' ELSE 'null'::jsonb END,
    'language',CASE WHEN v_language THEN v_metadata->'language' ELSE 'null'::jsonb END,
    'coverReference',CASE WHEN v_cover
      THEN v_metadata->'coverReference' ELSE 'null'::jsonb END,
    'selectionId',CASE WHEN v_selection_id
      THEN p_detail#>'{metadata,selectionId}' ELSE 'null'::jsonb END);
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_ux_review_blockers(
  p_candidate public.image_extraction_candidates
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb:=p_candidate.owner_review_snapshot->'value'; v jsonb:='[]'::jsonb;
  d jsonb;
BEGIN
  IF p_candidate.state='processing' THEN v:=v||jsonb_build_array(jsonb_build_object(
    'code','candidate_processing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,
    'field',NULL,'safeMessage','Book analysis is still running.')); END IF;
  IF p_candidate.state='failed' THEN v:=v||jsonb_build_array(jsonb_build_object(
    'code','candidate_failed','candidateId',p_candidate.id,'inputId',p_candidate.input_id,
    'field',NULL,'safeMessage','Book analysis needs attention.')); END IF;
  IF r IS NULL THEN
    v:=v||jsonb_build_array(jsonb_build_object('code','review_missing',
      'candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field',NULL,
      'safeMessage','Review this book.'));
    RETURN v;
  END IF;
  IF coalesce((r#>>'{originalFieldConfirmation,title}')::boolean,false)=false
    THEN v:=v||jsonb_build_array(jsonb_build_object('code','title_unconfirmed','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','originalTitle','safeMessage','Confirm the title.')); END IF;
  IF jsonb_array_length(coalesce(r->'authors','[]')) <>
      jsonb_array_length(coalesce(r#>'{originalFieldConfirmation,authors}','[]'))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(r#>'{originalFieldConfirmation,authors}','[]')) x WHERE x<>'true'::jsonb)
    THEN v:=v||jsonb_build_array(jsonb_build_object('code','author_confirmation_incomplete','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','authors','safeMessage','Confirm every author.')); END IF;
  IF coalesce(r->>'originalLanguage','')='' THEN v:=v||jsonb_build_array(jsonb_build_object('code','language_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','originalLanguage','safeMessage','Choose a language.')); END IF;
  IF r->'metadataChoice' IS NULL OR r->'metadataChoice'='null'::jsonb THEN v:=v||jsonb_build_array(jsonb_build_object('code','metadata_choice_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','metadataChoice','safeMessage','Choose metadata.')); END IF;
  IF coalesce((r->>'quantity')::integer,0)<1 THEN v:=v||jsonb_build_array(jsonb_build_object('code','quantity_invalid','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','quantity','safeMessage','Enter a valid quantity.')); END IF;
  IF coalesce((r->>'priceMinor')::integer,-1)<0 OR (r->>'publicationIntent'='publish' AND coalesce((r->>'priceMinor')::integer,0)=0) THEN v:=v||jsonb_build_array(jsonb_build_object('code','price_invalid','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','priceMinor','safeMessage','Enter a valid price.')); END IF;
  IF coalesce(r->>'baseCondition','')='' THEN v:=v||jsonb_build_array(jsonb_build_object('code','condition_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','baseCondition','safeMessage','Choose a condition.')); END IF;
  d:=r->'damageDisclosure';
  IF d IS NULL OR d='null'::jsonb THEN
    v:=v||jsonb_build_array(jsonb_build_object('code','damage_answer_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','damageDisclosure','safeMessage','Answer the damage question.'));
    v:=v||jsonb_build_array(jsonb_build_object('code','damage_details_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','damageDisclosure','safeMessage','Complete damage details.'));
  ELSIF coalesce((d->>'hasDamage')::boolean,false) AND
    (jsonb_array_length(coalesce(d->'damageTypes','[]'))=0 OR coalesce(d->>'damageNote','')='')
  THEN v:=v||jsonb_build_array(jsonb_build_object('code','damage_details_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','damageDisclosure','safeMessage','Complete damage details.')); END IF;
  IF coalesce(r->>'shelfLocation','')='' THEN v:=v||jsonb_build_array(jsonb_build_object('code','location_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','shelfLocation','safeMessage','Enter a shelf location.')); END IF;
  IF coalesce(r->>'publicationIntent','')='' THEN v:=v||jsonb_build_array(jsonb_build_object('code','publication_intent_missing','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','publicationIntent','safeMessage','Choose a publication intent.')); END IF;
  IF EXISTS(SELECT 1 FROM public.phase9_search_variant_proposals p
    WHERE p.candidate_id=p_candidate.id AND p.status='stale')
  THEN v:=v||jsonb_build_array(jsonb_build_object('code','variant_source_stale','candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field',NULL,'safeMessage','Review changed search wording.')); END IF;
  RETURN v;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN v||jsonb_build_array(jsonb_build_object('code','quantity_invalid',
    'candidateId',p_candidate.id,'inputId',p_candidate.input_id,'field','quantity',
    'safeMessage','Enter valid review values.'));
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit7a_commit_eligible(
  p_candidate public.image_extraction_candidates
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb:=p_candidate.owner_review_snapshot->'value'; choice jsonb;
BEGIN
  IF p_candidate.state<>'ready' OR p_candidate.review_disposition IS DISTINCT FROM 'reviewed'
    OR NOT p_candidate.review_ready OR p_candidate.review_version IS NULL
    OR NOT marketplace_sec.phase9_owner_ux_valid_review(r)
    OR jsonb_array_length(marketplace_sec.phase9_owner_ux_review_blockers(p_candidate))>0
  THEN RETURN false; END IF;
  -- Empty authors remain saveable review state, but cannot cross the inventory
  -- commit boundary. The Add action is therefore hidden and the RPC rejects it.
  IF jsonb_array_length(coalesce(r->'authors','[]'::jsonb))<1 THEN RETURN false; END IF;
  choice:=r->'metadataChoice';
  IF choice->>'mode'='manual' THEN RETURN choice->'selectionId'='null'::jsonb; END IF;
  RETURN choice->>'mode'='selected' AND EXISTS(
    SELECT 1 FROM public.phase9_selected_metadata_snapshots s
    WHERE s.id=(choice->>'selectionId')::uuid
      AND s.id=p_candidate.selected_metadata_snapshot_id
      AND s.candidate_id=p_candidate.id AND s.store_id=p_candidate.store_id);
EXCEPTION WHEN others THEN RETURN false;
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  p_session public.image_extraction_sessions,
  p_candidate public.image_extraction_candidates
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_detail jsonb;
  v_summary jsonb;
  v_sources jsonb;
  v_actions jsonb;
BEGIN
  v_detail:=marketplace_sec.phase9_owner_ux_candidate_detail(p_session,p_candidate);
  v_sources:=marketplace_sec.phase9_unit6g_field_sources(
    p_session,p_candidate,v_detail);
  v_summary:=marketplace_sec.phase9_unit6g_metadata_summary(v_detail);
  IF marketplace_sec.phase9_owner_ux_session_mutable(p_session) THEN
    v_actions:=jsonb_build_array('view_metadata','remove_from_scan','view_readiness');
    IF p_candidate.state IN ('ready','needs_review','possible_duplicate') THEN
      v_actions:=v_actions||'"save_review"'::jsonb;
    END IF;
    IF marketplace_sec.phase9_unit7a_commit_eligible(p_candidate) THEN
      v_actions:=v_actions||'"add_to_inventory"'::jsonb;
    END IF;
  ELSE
    v_actions:=jsonb_build_array('view_metadata','view_readiness');
  END IF;
  RETURN jsonb_build_object(
    'sessionId',p_session.id,'candidateId',p_candidate.id,'inputId',p_candidate.input_id,
    'ordinal',p_candidate.candidate_index,'candidateState',p_candidate.state,
    'candidateVersion',p_candidate.version,
    'metadataState',v_detail#>'{metadata,state}',
    'metadataRevision',p_candidate.metadata_revision,
    'reviewVersion',p_candidate.review_version,
    'reviewDisposition',p_candidate.review_disposition,
    'observed',v_detail->'observed','metadataSummary',v_summary,
    'review',v_detail#>'{review,value}',
    'fieldSources',v_sources,
    'attentionCodes',v_detail->'attentionCodes',
    'blockers',v_detail#>'{readiness,blockers}',
    'reviewReady',p_candidate.review_ready,'allowedActions',v_actions,
    'updatedAt',p_candidate.updated_at);
END$$;

ALTER FUNCTION marketplace_sec.phase9_unit6g_metadata_summary(jsonb) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_owner_ux_review_blockers(
  public.image_extraction_candidates) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  public.image_extraction_sessions,public.image_extraction_candidates) OWNER TO postgres;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_metadata_summary(jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_owner_ux_review_blockers(
  public.image_extraction_candidates) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  public.image_extraction_sessions,public.image_extraction_candidates)
  FROM PUBLIC,anon,authenticated;

COMMIT;
