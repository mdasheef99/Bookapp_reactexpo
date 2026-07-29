-- Phase 9 M22: active store-scoped multilingual alias materialization/search.
-- Forward-only after immutable M18-M21. No inventory, listing or publication writes.
BEGIN;

ALTER TABLE public.phase9_search_variant_proposals
  DROP CONSTRAINT phase9_search_variant_private_foundation_check,
  ADD CONSTRAINT phase9_search_variant_store_target_coherence CHECK (
    canonical_work_id IS NULL AND canonical_edition_id IS NULL
    AND (listing_id IS NULL OR inventory_id IS NOT NULL)
  );

ALTER TABLE public.book_search_aliases
  DROP CONSTRAINT book_search_aliases_approval_coherence,
  ADD CONSTRAINT book_search_aliases_approval_coherence CHECK (
    approval_status<>'approved'
    OR (approved_at IS NOT NULL
      AND (approved_by IS NOT NULL OR source_type='automated'))
  );

CREATE TABLE public.phase9_search_variant_alias_links (
  proposal_id uuid PRIMARY KEY
    REFERENCES public.phase9_search_variant_proposals(id) ON DELETE RESTRICT,
  alias_id uuid NOT NULL
    REFERENCES public.book_search_aliases(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  inventory_id uuid NOT NULL REFERENCES public.store_inventory(id),
  source_field text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('title','author')),
  author_index smallint CHECK (author_index BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  retracted_at timestamptz,
  CONSTRAINT phase9_variant_alias_link_target_check CHECK (
    (target_type='title' AND author_index IS NULL)
    OR (target_type='author' AND author_index IS NOT NULL)
  )
);
CREATE INDEX phase9_variant_alias_links_active_alias_idx
  ON public.phase9_search_variant_alias_links(alias_id,store_id,inventory_id)
  WHERE retracted_at IS NULL;

CREATE FUNCTION marketplace_sec.phase9_validate_variant_alias_link()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NOT EXISTS(
    SELECT 1
    FROM public.phase9_search_variant_proposals p
    JOIN public.book_search_aliases a ON a.id=NEW.alias_id
    WHERE p.id=NEW.proposal_id
      AND p.store_id=NEW.store_id AND p.inventory_id=NEW.inventory_id
      AND p.source_field=NEW.source_field AND p.target_type=NEW.target_type
      AND p.author_index IS NOT DISTINCT FROM NEW.author_index
      AND a.store_id=NEW.store_id AND a.inventory_id=NEW.inventory_id
      AND a.source_type='automated'
  ) THEN
    RAISE EXCEPTION 'P9_VARIANT_ALIAS_LINK_INVALID';
  END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER phase9_variant_alias_link_guard
BEFORE INSERT OR UPDATE ON public.phase9_search_variant_alias_links
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_validate_variant_alias_link();

CREATE FUNCTION marketplace_sec.phase9_materialize_search_variant(
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
  IF v_candidate.id IS NULL
    OR v_candidate.analysis_observation_id IS DISTINCT FROM
      v_proposal.observation_id THEN
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

CREATE FUNCTION public.phase9_materialize_search_variant(
  p_store_id uuid,p_proposal_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_store uuid; v_materialized boolean;
BEGIN
  IF auth.role()<>'service_role' THEN
    RAISE EXCEPTION 'P9_OWNER_NOT_AUTHORIZED';
  END IF;
  SELECT store_id INTO v_store FROM public.phase9_search_variant_proposals
  WHERE id=p_proposal_id;
  IF v_store IS NULL OR v_store<>p_store_id THEN
    RAISE EXCEPTION 'P9_CROSS_TENANT_DENIED';
  END IF;
  v_materialized:=marketplace_sec.phase9_materialize_search_variant(
    p_proposal_id
  );
  RETURN jsonb_build_object(
    'proposal_id',p_proposal_id,'materialized',v_materialized
  );
END
$function$;

CREATE FUNCTION marketplace_sec.phase9_proposal_alias_refresh()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  PERFORM marketplace_sec.phase9_materialize_search_variant(NEW.id);
  RETURN NEW;
END
$function$;
CREATE TRIGGER phase9_proposal_alias_refresh
AFTER UPDATE OF status,search_eligible
ON public.phase9_search_variant_proposals
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  OR OLD.search_eligible IS DISTINCT FROM NEW.search_eligible
)
EXECUTE FUNCTION marketplace_sec.phase9_proposal_alias_refresh();

CREATE OR REPLACE FUNCTION marketplace_sec.phase9_candidate_variant_refresh()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_proposal public.phase9_search_variant_proposals;
  v_outcome text;
BEGIN
  FOR v_proposal IN SELECT * FROM public.phase9_search_variant_proposals
    WHERE candidate_id=NEW.id AND store_id=NEW.store_id
      AND status IN ('proposed','active') FOR UPDATE
  LOOP
    v_outcome:=marketplace_sec.phase9_variant_reconciliation_outcome(
      NEW,v_proposal
    );
    IF v_outcome IN (
      'materially_changed','conflicting','invalid_source_reference'
    ) OR (v_proposal.status='active' AND v_outcome='not_confirmed') THEN
      UPDATE public.phase9_search_variant_proposals
      SET status='stale',search_eligible=false,
        lifecycle_reason=v_outcome,stale_at=transaction_timestamp(),
        updated_at=transaction_timestamp()
      WHERE id=v_proposal.id AND status IN ('proposed','active');
      PERFORM marketplace_sec.phase9_materialize_search_variant(v_proposal.id);
    ELSIF NEW.committed_inventory_id IS NOT NULL
      AND v_proposal.status='active' AND v_proposal.search_eligible THEN
      PERFORM marketplace_sec.phase9_materialize_search_variant(v_proposal.id);
    END IF;
  END LOOP;
  RETURN NEW;
END
$function$;
DROP TRIGGER phase9_candidate_variant_refresh
ON public.image_extraction_candidates;
CREATE TRIGGER phase9_candidate_variant_refresh
AFTER UPDATE OF owner_review_snapshot,committed_inventory_id
ON public.image_extraction_candidates
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_candidate_variant_refresh();

CREATE FUNCTION marketplace_sec.phase9_active_variant_listing_ids(p_query text)
RETURNS TABLE(listing_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT l.id
  FROM public.phase9_public_listing_projection l
  WHERE char_length(
      marketplace_sec.phase9_variant_compare_key(p_query)
    )>0
    AND EXISTS(
      SELECT 1 FROM public.phase9_search_variant_alias_links link
      JOIN public.phase9_search_variant_proposals p
        ON p.id=link.proposal_id
        AND p.status='active' AND p.search_eligible
      JOIN public.book_search_aliases a ON a.id=link.alias_id
      WHERE link.retracted_at IS NULL
        AND link.store_id=l.store_id AND link.inventory_id=l.inventory_id
        AND p.store_id=l.store_id AND p.inventory_id=l.inventory_id
        AND a.store_id=l.store_id AND a.inventory_id=l.inventory_id
        AND a.approval_status='approved' AND a.source_type='automated'
        AND position(marketplace_sec.phase9_variant_compare_key(p_query)
          in a.alias_normalized)>0
    )
$function$;

CREATE FUNCTION public.phase9_search_marketplace_listings(
  p_query text,p_from integer DEFAULT 0,p_to integer DEFAULT 19
) RETURNS TABLE(
  id uuid,store_id uuid,canonical_edition_id uuid,public_title text,
  public_authors text[],public_cover_url text,isbn_10 text,isbn_13 text,
  condition text,public_condition_notes text,selling_price_minor integer,
  availability_status text,fulfillment_options text[],store_city text,
  store_locality_name text,pickup_available boolean,delivery_available boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF coalesce(char_length(trim(p_query)),0)<1 OR p_from<0 OR p_to<p_from
    OR p_to-p_from>=50 THEN RAISE EXCEPTION 'P9_SEARCH_INPUT_INVALID'; END IF;
  RETURN QUERY
  SELECT l.id,l.store_id,l.canonical_edition_id,l.public_title,
    l.public_authors,l.public_cover_url,l.isbn_10,l.isbn_13,l.condition,
    l.public_condition_notes,l.selling_price_minor,l.availability_status,
    l.fulfillment_options,l.store_city,l.store_locality_name,
    l.pickup_available,l.delivery_available
  FROM public.marketplace_book_listings l
  JOIN public.phase9_public_listing_projection eligible ON eligible.id=l.id
  WHERE (
      position(lower(trim(p_query)) in lower(l.public_title))>0
      OR position(lower(trim(p_query)) in lower(l.authors_text))>0
      OR l.id IN (
        SELECT matched.listing_id
        FROM marketplace_sec.phase9_active_variant_listing_ids(p_query) matched
      )
    )
  ORDER BY l.updated_at DESC,l.id
  OFFSET p_from LIMIT p_to-p_from+1;
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
          AND position(lower(p_query) in ranked_alias.alias_normalized)>0
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

ALTER TABLE public.phase9_search_variant_alias_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase9_search_variant_alias_links OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_validate_variant_alias_link()
  OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_materialize_search_variant(uuid)
  OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_proposal_alias_refresh()
  OWNER TO postgres;
ALTER FUNCTION public.phase9_materialize_search_variant(uuid,uuid)
  OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_active_variant_listing_ids(text)
  OWNER TO postgres;
ALTER FUNCTION public.phase9_search_marketplace_listings(text,integer,integer)
  OWNER TO postgres;

REVOKE ALL PRIVILEGES ON TABLE public.phase9_search_variant_alias_links
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.phase9_search_variant_alias_links TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_validate_variant_alias_link(),
  marketplace_sec.phase9_materialize_search_variant(uuid),
  marketplace_sec.phase9_proposal_alias_refresh()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_materialize_search_variant(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_materialize_search_variant(uuid,uuid)
  TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_active_variant_listing_ids(text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase9_search_marketplace_listings(
  text,integer,integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phase9_search_marketplace_listings(
  text,integer,integer
) TO anon,authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN
  ON public.phase9_search_variant_proposals,public.book_search_aliases,
  public.phase9_search_variant_alias_links FROM service_role;
GRANT SELECT ON public.phase9_search_variant_proposals,
  public.book_search_aliases,public.phase9_search_variant_alias_links
  TO service_role;

COMMIT;
