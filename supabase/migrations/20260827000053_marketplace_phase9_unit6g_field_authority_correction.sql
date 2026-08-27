-- Phase 9 Unit 6G bounded field-authority correction.
-- Forward-only replacement of the M52 internal read projection. No business rows
-- are rewritten and the public RPC signature/privilege contract remains unchanged.
-- The nested compact-summary projection now represents unusable selected fields
-- as null so mirrored strict decoders can apply the existing field-source fallback.

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
  RETURN jsonb_build_object(
    'title',CASE WHEN v_title THEN v_metadata->'title' ELSE 'null'::jsonb END,
    'authors',CASE WHEN v_authors THEN v_metadata->'authors' ELSE 'null'::jsonb END,
    'language',CASE WHEN v_language THEN v_metadata->'language' ELSE 'null'::jsonb END,
    'coverReference',CASE WHEN v_cover
      THEN v_metadata->'coverReference' ELSE 'null'::jsonb END);
END$$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_unit6g_field_sources(
  p_session public.image_extraction_sessions,
  p_candidate public.image_extraction_candidates,
  p_detail jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_review jsonb:=p_detail#>'{review,value}';
  v_metadata jsonb:=p_detail#>'{metadata,snapshot}';
  v_safe_metadata jsonb;
  v_has_review boolean;
  v_selected boolean;
  v_selected_title boolean;
  v_selected_authors boolean;
  v_selected_language boolean;
  v_selected_cover boolean;
  v_observed_title boolean;
  v_observed_authors boolean;
  v_observed_language boolean;
BEGIN
  v_has_review:=p_candidate.review_disposition='reviewed'
    AND p_candidate.review_version IS NOT NULL
    AND p_detail#>'{review,reviewVersion}'=to_jsonb(p_candidate.review_version)
    AND marketplace_sec.phase9_owner_ux_valid_review(v_review);
  v_safe_metadata:=marketplace_sec.phase9_unit6g_metadata_summary(p_detail);
  v_selected:=v_safe_metadata IS NOT NULL;
  v_selected_title:=jsonb_typeof(v_safe_metadata->'title')='string';
  v_selected_authors:=jsonb_typeof(v_safe_metadata->'authors')='array';
  v_selected_language:=jsonb_typeof(v_safe_metadata->'language')='string';
  v_selected_cover:=jsonb_typeof(v_safe_metadata->'coverReference')='string';
  v_observed_title:=coalesce(char_length(btrim(p_candidate.observed_title)),0)>0;
  v_observed_authors:=coalesce(cardinality(p_candidate.observed_authors),0)>0
    AND NOT EXISTS(
      SELECT 1 FROM unnest(coalesce(p_candidate.observed_authors,ARRAY[]::text[])) author
      WHERE coalesce(char_length(btrim(author)),0)=0
    );
  v_observed_language:=coalesce(char_length(btrim(p_candidate.observed_language)),0)>0;

  RETURN jsonb_build_object(
    'cover',CASE WHEN v_selected_cover THEN 'matched' ELSE 'missing' END,
    'title',CASE WHEN v_has_review THEN CASE
        WHEN v_selected_title AND v_review->>'originalTitle'=v_metadata->>'title'
          THEN 'matched'
        WHEN v_observed_title AND v_review->>'originalTitle'=p_candidate.observed_title
          THEN 'detected'
        ELSE 'custom' END
      WHEN v_selected_title THEN 'matched'
      WHEN v_observed_title THEN 'detected' ELSE 'missing' END,
    'authors',CASE WHEN v_has_review THEN CASE
        WHEN jsonb_array_length(v_review->'authors')=0 THEN 'missing'
        WHEN v_selected_authors AND v_review->'authors'=v_metadata->'authors'
          THEN 'matched'
        WHEN v_observed_authors AND v_review->'authors'=to_jsonb(p_candidate.observed_authors)
          THEN 'detected'
        ELSE 'custom' END
      WHEN v_selected_authors THEN 'matched'
      WHEN v_observed_authors THEN 'detected' ELSE 'missing' END,
    'language',CASE WHEN v_has_review THEN CASE
        WHEN v_selected_language AND v_review->>'originalLanguage'=v_metadata->>'language'
          THEN 'matched'
        WHEN v_observed_language
          AND v_review->>'originalLanguage'=p_candidate.observed_language THEN 'detected'
        WHEN p_session.selected_language IS NOT NULL
          AND v_review->>'originalLanguage'=p_session.selected_language THEN 'default'
        ELSE 'custom' END
      WHEN v_selected_language THEN 'matched'
      WHEN v_observed_language THEN 'detected'
      WHEN p_session.selected_language IS NOT NULL THEN 'default' ELSE 'missing' END,
    'condition',CASE WHEN v_has_review THEN CASE
        WHEN p_session.default_condition IS NOT NULL
          AND v_review->>'baseCondition'=p_session.default_condition THEN 'default'
        ELSE 'custom' END
      WHEN p_session.default_condition IS NOT NULL THEN 'default' ELSE 'missing' END,
    'price',CASE WHEN v_has_review THEN CASE
        WHEN p_session.default_price_minor IS NOT NULL
          AND (v_review->>'priceMinor')::integer=p_session.default_price_minor THEN 'default'
        ELSE 'custom' END
      WHEN p_session.default_price_minor IS NOT NULL THEN 'default' ELSE 'missing' END,
    'quantity',CASE WHEN v_has_review AND (v_review->>'quantity')::integer<>1
      THEN 'custom' ELSE 'default' END,
    'location',CASE WHEN v_has_review THEN CASE
        WHEN v_review->>'shelfLocation'=p_session.default_location THEN 'default'
        ELSE 'custom' END
      WHEN p_session.default_location IS NOT NULL THEN 'default' ELSE 'missing' END,
    'publication',CASE WHEN v_has_review THEN CASE
        WHEN v_review->>'publicationIntent'=p_session.default_publication THEN 'default'
        ELSE 'custom' END
      WHEN p_session.default_publication IS NOT NULL THEN 'default' ELSE 'missing' END,
    'damage',CASE WHEN v_has_review
      AND (v_review#>>'{damageDisclosure,hasDamage}')::boolean
      THEN 'custom' ELSE 'default' END);
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
  v_actions:=jsonb_build_array('view_metadata','remove_from_scan','view_readiness');
  IF p_candidate.state IN ('ready','needs_review','possible_duplicate') THEN
    v_actions:=v_actions||'"save_review"'::jsonb;
  END IF;
  IF p_candidate.review_ready AND p_candidate.review_disposition='reviewed'
    AND p_candidate.state='ready' THEN
    v_actions:=v_actions||'"add_to_inventory"'::jsonb;
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

ALTER FUNCTION marketplace_sec.phase9_unit6g_field_sources(
  public.image_extraction_sessions,public.image_extraction_candidates,jsonb) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  public.image_extraction_sessions,public.image_extraction_candidates) OWNER TO postgres;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_metadata_summary(jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_field_sources(
  public.image_extraction_sessions,public.image_extraction_candidates,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit6g_batch_card(
  public.image_extraction_sessions,public.image_extraction_candidates)
  FROM PUBLIC,anon,authenticated;
