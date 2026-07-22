-- Phase 9 M07: positive public projection and bookstore-first grouped queries.
BEGIN;

CREATE INDEX marketplace_book_listings_search_document_idx
  ON public.marketplace_book_listings USING gin(search_document);
CREATE INDEX marketplace_book_listings_store_search_idx
  ON public.marketplace_book_listings(store_id,status,availability_status,selling_price_minor,id);
CREATE INDEX store_inventory_publication_retry_idx
  ON public.store_inventory(publication_status,updated_at)
  WHERE publication_status IN ('publication_pending','publication_failed');

CREATE VIEW public.phase9_public_listing_projection WITH (security_barrier=true) AS
SELECT l.id,l.inventory_id,l.store_id,l.canonical_work_id,l.canonical_edition_id,
  l.public_title AS title,l.public_authors AS authors,
  l.isbn_10,l.isbn_13,l.language,l.public_description,l.edition_statement,l.volume,l.format,
  l.condition,l.selling_price_minor AS price_paise,l.has_damage,l.public_damage_notes,l.damage_types,
  l.primary_public_media_id,l.public_media_count,l.availability_status,l.status AS listing_status,
  l.updated_at
FROM public.marketplace_book_listings l
JOIN public.stores s ON s.id=l.store_id
WHERE l.status='active' AND l.moderation_status='approved' AND l.listing_quality_status='ready'
  AND l.availability_status<>'unavailable' AND s.status='active' AND s.setup_status='complete'
  AND s.selling_status='allowed';

CREATE FUNCTION marketplace_sec.phase9_internal_book_match(p_query text)
RETURNS TABLE(listing_id uuid,store_id uuid,rank integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p.id,p.store_id,
    CASE WHEN p.isbn_10=p_query OR p.isbn_13=p_query THEN 1
      WHEN lower(p.title)=lower(p_query) THEN 2
      WHEN EXISTS(SELECT 1 FROM public.book_search_aliases a
        WHERE a.approval_status='approved' AND a.alias_normalized=lower(p_query)
          AND (a.canonical_edition_id=p.canonical_edition_id OR a.inventory_id=p.inventory_id)) THEN 3
      ELSE 4 END
  FROM public.phase9_public_listing_projection p
  WHERE p.isbn_10=p_query OR p.isbn_13=p_query OR lower(p.title) LIKE '%'||lower(p_query)||'%'
    OR EXISTS(SELECT 1 FROM public.book_search_aliases a WHERE a.approval_status='approved'
      AND a.alias_normalized LIKE '%'||lower(p_query)||'%'
      AND (a.canonical_edition_id=p.canonical_edition_id OR a.inventory_id=p.inventory_id))
$$;

CREATE FUNCTION public.phase9_marketplace_store_search(
  p_query text,p_page_size integer DEFAULT 20,p_cursor jsonb DEFAULT NULL
) RETURNS TABLE(store_id uuid,store_name text,offer_count bigint,lowest_price_paise integer,
  matched_title text,matched_condition text,has_damage boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_hash text:=md5(lower(trim(p_query)));
BEGIN
  IF p_cursor IS NOT NULL AND (p_cursor->>'query_hash'<>v_hash
    OR p_cursor->>'ranking_version'<>'phase9-r1') THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
  RETURN QUERY WITH grouped AS (
    SELECT p.store_id,min(m.rank) AS best_rank,count(*) AS offers,min(p.price_paise) AS lowest,
      min(p.title) AS title,min(p.condition) AS condition,bool_or(p.has_damage) AS damaged
    FROM marketplace_sec.phase9_internal_book_match(p_query) m
    JOIN public.phase9_public_listing_projection p ON p.id=m.listing_id GROUP BY p.store_id
  ) SELECT g.store_id,s.display_name,g.offers,g.lowest,g.title,g.condition,g.damaged
    FROM grouped g JOIN public.stores s ON s.id=g.store_id
    WHERE p_cursor IS NULL OR (g.best_rank,g.store_id)>
      ((p_cursor->>'last_rank')::integer,(p_cursor->>'last_store_id')::uuid)
    ORDER BY g.best_rank,g.store_id LIMIT least(greatest(p_page_size,1),50);
END
$$;

CREATE FUNCTION public.phase9_storefront_catalogue(
  p_store_id uuid,p_page_size integer DEFAULT 20,p_cursor jsonb DEFAULT NULL
) RETURNS SETOF public.phase9_public_listing_projection
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_cursor IS NOT NULL AND (p_cursor->>'filter_version'<>'phase9-storefront-v1'
    OR (p_cursor->>'store_id')::uuid<>p_store_id) THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
  RETURN QUERY SELECT p.* FROM public.phase9_public_listing_projection p WHERE p.store_id=p_store_id
    AND (p_cursor IS NULL OR (p.title,p.id)>((p_cursor->>'last_title'),
      (p_cursor->>'last_listing_id')::uuid))
    ORDER BY p.title,p.id LIMIT least(greatest(p_page_size,1),50);
END
$$;

CREATE FUNCTION public.phase9_listing_detail(p_listing_id uuid)
RETURNS SETOF public.phase9_public_listing_projection
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p.* FROM public.phase9_public_listing_projection p WHERE p.id=p_listing_id
$$;

REVOKE ALL ON public.phase9_public_listing_projection FROM PUBLIC;
GRANT SELECT ON public.phase9_public_listing_projection TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_internal_book_match(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_internal_book_match(text) TO service_role;
REVOKE ALL ON FUNCTION public.phase9_marketplace_store_search(text,integer,jsonb),
  public.phase9_storefront_catalogue(uuid,integer,jsonb),public.phase9_listing_detail(uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phase9_marketplace_store_search(text,integer,jsonb),
  public.phase9_storefront_catalogue(uuid,integer,jsonb),public.phase9_listing_detail(uuid)
  TO anon,authenticated,service_role;

COMMIT;
