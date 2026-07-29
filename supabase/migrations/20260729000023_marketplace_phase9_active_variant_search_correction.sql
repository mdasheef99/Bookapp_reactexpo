-- Phase 9 M23: forward-only source validation and legacy alias-rank correction.
-- M22 is already applied; this migration does not rewrite its history.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_materialize_search_variant(
  p_proposal_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_proposal public.phase9_search_variant_proposals;
  v_candidate public.image_extraction_candidates;
  v_inventory uuid;
  v_listing uuid;
  v_alias uuid;
  v_observation_ordinal smallint;
  v_expected_source_field text;
  v_link public.phase9_search_variant_alias_links;
BEGIN
  SELECT * INTO v_proposal
  FROM public.phase9_search_variant_proposals
  WHERE id=p_proposal_id FOR UPDATE;
  IF v_proposal.id IS NULL THEN RETURN false; END IF;

  SELECT * INTO v_link FROM public.phase9_search_variant_alias_links
  WHERE proposal_id=v_proposal.id FOR UPDATE;
  IF v_proposal.status<>'active' OR NOT v_proposal.search_eligible THEN
    IF v_link.proposal_id IS NOT NULL THEN
      UPDATE public.phase9_search_variant_alias_links
      SET retracted_at=coalesce(retracted_at,transaction_timestamp())
      WHERE proposal_id=v_proposal.id;
      IF NOT EXISTS(
        SELECT 1 FROM public.phase9_search_variant_alias_links link
        JOIN public.phase9_search_variant_proposals p
          ON p.id=link.proposal_id
        WHERE link.alias_id=v_link.alias_id AND link.retracted_at IS NULL
          AND p.status='active' AND p.search_eligible
      ) THEN
        UPDATE public.book_search_aliases
        SET approval_status='rejected',approved_at=NULL,approved_by=NULL,
          rejection_reason='inactive_source',updated_at=transaction_timestamp()
        WHERE id=v_link.alias_id AND source_type='automated';
      END IF;
    END IF;
    RETURN false;
  END IF;

  SELECT * INTO v_candidate FROM public.image_extraction_candidates
  WHERE id=v_proposal.candidate_id AND store_id=v_proposal.store_id;
  SELECT observation_ordinal INTO v_observation_ordinal
  FROM public.image_analysis_observations
  WHERE id=v_proposal.observation_id AND store_id=v_proposal.store_id;
  v_expected_source_field:=CASE v_proposal.target_type
    WHEN 'title' THEN format(
      'observation:%s:title',v_observation_ordinal
    )
    ELSE format(
      'observation:%s:author:%s',
      v_observation_ordinal,v_proposal.author_index
    )
  END;
  IF v_candidate.id IS NULL
    OR v_candidate.analysis_observation_id IS DISTINCT FROM
      v_proposal.observation_id
    OR v_observation_ordinal IS NULL
    OR v_proposal.source_field IS DISTINCT FROM v_expected_source_field
    OR marketplace_sec.phase9_variant_reconciliation_outcome(
      v_candidate,v_proposal
    )<>'equivalent' THEN
    RAISE EXCEPTION 'P9_VARIANT_SOURCE_MISMATCH';
  END IF;
  v_inventory:=v_candidate.committed_inventory_id;
  IF v_inventory IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.store_inventory i
    WHERE i.id=v_inventory AND i.store_id=v_proposal.store_id
  ) THEN
    RAISE EXCEPTION 'P9_CROSS_TENANT_DENIED';
  END IF;
  SELECT id INTO v_listing FROM public.marketplace_book_listings
  WHERE inventory_id=v_inventory AND store_id=v_proposal.store_id;

  UPDATE public.phase9_search_variant_proposals
  SET inventory_id=v_inventory,listing_id=v_listing,
    updated_at=transaction_timestamp()
  WHERE id=v_proposal.id;

  INSERT INTO public.book_search_aliases(
    store_id,inventory_id,alias_text,alias_normalized,alias_language,
    alias_script,alias_type,source_type,source_ref,approval_status,
    approved_at
  ) VALUES(
    v_proposal.store_id,v_inventory,v_proposal.variant_text,
    v_proposal.variant_normalized,v_proposal.variant_language,
    v_proposal.variant_script,
    CASE v_proposal.variant_type
      WHEN 'translation_candidate' THEN 'translation'
      WHEN 'roman_alternative' THEN 'common_spelling'
      ELSE 'transliteration' END,
    'automated',v_proposal.id::text,'approved',v_proposal.activated_at
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_alias FROM public.book_search_aliases
  WHERE inventory_id=v_inventory AND store_id=v_proposal.store_id
    AND alias_normalized=v_proposal.variant_normalized
    AND source_type='automated';
  IF v_alias IS NULL THEN RAISE EXCEPTION 'P9_ALIAS_CONFLICT'; END IF;
  IF v_link.proposal_id IS NOT NULL AND v_link.alias_id<>v_alias THEN
    RAISE EXCEPTION 'P9_ALIAS_LINK_CONFLICT';
  END IF;

  INSERT INTO public.phase9_search_variant_alias_links(
    proposal_id,alias_id,store_id,inventory_id,source_field,target_type,
    author_index,retracted_at
  ) VALUES(
    v_proposal.id,v_alias,v_proposal.store_id,v_inventory,
    v_proposal.source_field,v_proposal.target_type,v_proposal.author_index,NULL
  ) ON CONFLICT(proposal_id) DO UPDATE
    SET retracted_at=NULL
    WHERE phase9_search_variant_alias_links.alias_id=excluded.alias_id;
  UPDATE public.book_search_aliases
  SET approval_status='approved',approved_at=v_proposal.activated_at,
    approved_by=NULL,rejection_reason=NULL,updated_at=transaction_timestamp()
  WHERE id=v_alias;
  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_internal_book_match(
  p_query text
) RETURNS TABLE(listing_id uuid,store_id uuid,rank integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT listing.id,listing.store_id,
    CASE WHEN listing.isbn_10=p_query OR listing.isbn_13=p_query THEN 1
      WHEN lower(listing.title)=lower(p_query) THEN 2
      WHEN alias_match.listing_id IS NOT NULL OR EXISTS(
        SELECT 1 FROM public.book_search_aliases ranked_alias
        WHERE ranked_alias.approval_status='approved'
          AND ranked_alias.source_type<>'automated'
          AND ranked_alias.alias_normalized=lower(p_query)
          AND (
            ranked_alias.canonical_edition_id=listing.canonical_edition_id
            OR (ranked_alias.store_id=listing.store_id
              AND ranked_alias.inventory_id=listing.inventory_id)
          )
      ) THEN 3 ELSE 4 END
  FROM public.phase9_public_listing_projection listing
  LEFT JOIN marketplace_sec.phase9_active_variant_listing_ids(p_query)
    alias_match ON alias_match.listing_id=listing.id
  WHERE listing.isbn_10=p_query OR listing.isbn_13=p_query
    OR position(lower(p_query) in lower(listing.title))>0
    OR alias_match.listing_id IS NOT NULL
    OR EXISTS(
      SELECT 1 FROM public.book_search_aliases a
      WHERE a.approval_status='approved' AND a.source_type<>'automated'
        AND position(lower(p_query) in a.alias_normalized)>0
        AND (a.canonical_edition_id=listing.canonical_edition_id
          OR (a.store_id=listing.store_id
            AND a.inventory_id=listing.inventory_id))
    )
$function$;

COMMIT;
