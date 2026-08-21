-- Phase 9 Unit 8C-1: complete customer storefront (Q09), match context,
-- and allowlisted public listing detail/gallery (Q10).
-- Authority: Unit 8 bookstore-first SDD §§4-6, 11-20; Marketplace SDD 05
-- §§5-12; Unit 7B §§2, 6-7, 11; Unit 7C §§2, 7-9.
-- Repository-only. Applying this migration to connected Supabase is not
-- authorized by the Unit 8C implementation session.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.phase9_bookstore_search_v1(text,integer,text,jsonb,jsonb)') IS NULL
    OR to_regprocedure('marketplace_sec.phase9_title_group_key(public.marketplace_book_listings)') IS NULL
    OR to_regprocedure('marketplace_sec.phase9_q08_cursor_encrypt(jsonb)') IS NULL
    OR to_regprocedure('marketplace_sec.phase9_q08_cursor_decrypt(text)') IS NULL
    OR to_regprocedure('marketplace_sec.phase9_q08_current_policy_version()') IS NULL
    OR to_regprocedure('marketplace_sec.phase9_publication_ineligibility(public.store_inventory)') IS NULL
    OR to_regprocedure('marketplace_sec.phase9_public_media_eligible(public.inventory_media_links,public.media_assets)') IS NULL
    OR to_regclass('public.public_store_profiles') IS NULL
    OR to_regclass('public.inventory_media_links') IS NULL
    OR to_regclass('public.media_assets') IS NULL
  THEN
    RAISE EXCEPTION 'MISSING_PREREQ: Unit 8C requires M49 and the Unit 7B/7C public boundaries';
  END IF;
END
$$;

-- One current eligibility predicate is reused by Q09 and Q10. It deliberately
-- joins the private inventory only inside this hardened boundary and returns no
-- private field.
CREATE FUNCTION marketplace_sec.phase9_q09_listing_eligible(
  p_listing public.marketplace_book_listings,
  p_inventory public.store_inventory
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p_listing.id IS NOT NULL
    AND p_inventory.id IS NOT NULL
    AND p_listing.inventory_id=p_inventory.id
    AND p_listing.store_id=p_inventory.store_id
    AND p_listing.status='active'
    AND p_listing.availability_status<>'unavailable'
    AND p_listing.moderation_status='approved'
    AND p_listing.listing_quality_status='ready'
    AND p_inventory.visibility_status='published'
    AND p_inventory.publication_status='published'
    AND marketplace_sec.phase9_store_publication_ineligibility(
      p_listing.store_id,false) IS NULL
    AND marketplace_sec.phase9_publication_ineligibility(p_inventory) IS NULL
    AND NOT EXISTS(
      SELECT 1 FROM public.listing_moderation_flags f
      WHERE f.listing_id=p_listing.id AND f.status IN ('open','under_review'))
$$;

-- Re-resolve the exact Q08 selected group for one returned bookstore. This is
-- used only to add the frozen encrypted matchContext without changing M49's
-- ranking, grouping, count, or cursor implementation.
CREATE FUNCTION marketplace_sec.phase9_q08_selected_group_key(
  p_query text,p_store_id uuid,p_filters jsonb DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_pickup boolean:=false; v_delivery boolean:=false; v_group text;
BEGIN
  BEGIN
    IF p_filters IS NOT NULL AND jsonb_typeof(p_filters)<>'object' THEN
      RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
    v_pickup:=coalesce((p_filters->>'pickup')::boolean,false);
    v_delivery:=coalesce((p_filters->>'delivery')::boolean,false);
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END;

  WITH matched AS (
    SELECT l.id,l.store_id,l.selling_price_minor,l.condition,
      l.availability_status,l.fulfillment_options,
      marketplace_sec.phase9_q07_match_class(p_query,l) AS match_rank,
      marketplace_sec.phase9_title_group_key(l) AS group_key
    FROM public.marketplace_book_listings l
    JOIN public.store_inventory i
      ON i.id=l.inventory_id AND i.store_id=l.store_id
    WHERE l.store_id=p_store_id
      AND marketplace_sec.phase9_q09_listing_eligible(l,i)
  ), grouped AS (
    SELECT group_key,min(match_rank) best_match_rank,
      min(marketplace_sec.phase9_q08_availability_rank(availability_status)) best_avail_rank,
      count(DISTINCT id) offer_count,min(selling_price_minor) lowest_price,
      min(marketplace_sec.phase9_q08_condition_rank(condition)) best_condition_rank
    FROM matched
    WHERE match_rank IS NOT NULL
      AND (NOT v_pickup OR 'pickup'=ANY(fulfillment_options))
      AND (NOT v_delivery OR 'delivery'=ANY(fulfillment_options))
    GROUP BY group_key
  )
  SELECT group_key INTO v_group FROM grouped
  ORDER BY best_match_rank,best_avail_rank,offer_count DESC,lowest_price,
    best_condition_rank,group_key LIMIT 1;
  RETURN v_group;
END
$$;

CREATE FUNCTION marketplace_sec.phase9_q09_issue_match_context(
  p_store_id uuid,p_group_key text
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT marketplace_sec.phase9_q08_cursor_encrypt(jsonb_build_object(
    'kind','q09-match-context','contextVersion','q09-match-v2',
    'issuingContractVersion','phase9-q08-v1',
    'storeId',p_store_id,'groupKey',p_group_key,
    'policyVersion',marketplace_sec.phase9_q08_current_policy_version(),
    'issuedAt',extract(epoch FROM transaction_timestamp())::bigint,
    'expiresAt',(extract(epoch FROM transaction_timestamp())::bigint)+7200))
  WHERE p_store_id IS NOT NULL AND coalesce(char_length(p_group_key),0)>0
$$;

CREATE FUNCTION marketplace_sec.phase9_q09_match_group(
  p_match_context text,p_store_id uuid,p_policy_version text
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_payload jsonb; v_expires bigint;
BEGIN
  IF coalesce(char_length(p_match_context),0)=0 THEN RETURN NULL; END IF;
  v_payload:=marketplace_sec.phase9_q08_cursor_decrypt(p_match_context);
  IF v_payload->>'kind'<>'q09-match-context'
    OR v_payload->>'contextVersion'<>'q09-match-v2'
    OR v_payload->>'issuingContractVersion'<>'phase9-q08-v1'
    OR (v_payload->>'storeId')::uuid IS DISTINCT FROM p_store_id
    OR v_payload->>'policyVersion' IS DISTINCT FROM p_policy_version
  THEN RETURN NULL; END IF;
  v_expires:=(v_payload->>'expiresAt')::bigint;
  IF v_expires IS NULL OR v_expires<extract(epoch FROM transaction_timestamp())::bigint
    OR coalesce(char_length(v_payload->>'groupKey'),0)=0
  THEN RETURN NULL; END IF;
  RETURN v_payload->>'groupKey';
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END
$$;

-- Preserve the exact M49 Q08 implementation as an internal base, then expose
-- the same public function name with only the frozen matchContext addition.
ALTER FUNCTION public.phase9_bookstore_search_v1(text,integer,text,jsonb,jsonb)
  RENAME TO phase9_bookstore_search_base_v1;

REVOKE ALL ON FUNCTION public.phase9_bookstore_search_base_v1(
  text,integer,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_bookstore_search_base_v1(
  text,integer,text,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.phase9_bookstore_search_v1(
  p_query text,
  p_page_size integer DEFAULT 20,
  p_cursor text DEFAULT NULL,
  p_filters jsonb DEFAULT NULL,
  p_locality jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_response jsonb; v_items jsonb; v_unresolved integer;
BEGIN
  v_response:=public.phase9_bookstore_search_base_v1(
    p_query,p_page_size,p_cursor,p_filters,p_locality);
  SELECT coalesce(jsonb_agg(
      CASE WHEN resolved.group_key IS NULL THEN item.value
        ELSE jsonb_set(item.value,'{matchedBook,matchContext}',
          to_jsonb(marketplace_sec.phase9_q09_issue_match_context(
            (item.value->'store'->>'publicStoreId')::uuid,resolved.group_key)),true)
      END ORDER BY item.ordinality),'[]'::jsonb),
    count(*) FILTER (WHERE resolved.group_key IS NULL)
  INTO v_items,v_unresolved
  FROM jsonb_array_elements(coalesce(v_response->'items','[]'::jsonb))
    WITH ORDINALITY AS item(value,ordinality)
  LEFT JOIN LATERAL (
    SELECT marketplace_sec.phase9_q08_selected_group_key(
      p_query,(item.value->'store'->>'publicStoreId')::uuid,p_filters) group_key
  ) resolved ON true;
  IF coalesce(v_unresolved,0)>0 THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  RETURN jsonb_set(v_response,'{items}',v_items,true);
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM IN ('P9_CURSOR_INVALID','P9_CURSOR_SECRET_MISSING','P9_REQUEST_INVALID')
    THEN RAISE; END IF;
  RAISE EXCEPTION 'P9_REQUEST_INVALID';
END
$$;

-- One allowlisted public title-group DTO. All nested offers are current,
-- eligible, independently addressable listing identities.
CREATE FUNCTION marketplace_sec.phase9_q09_title_group_json(
  p_store_id uuid,p_group_key text
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH eligible AS (
    SELECT l.*,i.cover_url AS provider_cover_source,
      marketplace_sec.phase9_q08_condition_rank(l.condition) condition_rank,
      marketplace_sec.phase9_q08_actual_copy_cover(l.id) actual_copy_cover
    FROM public.marketplace_book_listings l
    JOIN public.store_inventory i
      ON i.id=l.inventory_id AND i.store_id=l.store_id
    WHERE l.store_id=p_store_id
      AND marketplace_sec.phase9_title_group_key(l)=p_group_key
      AND marketplace_sec.phase9_q09_listing_eligible(l,i)
  ), representative AS (
    SELECT * FROM eligible
    ORDER BY selling_price_minor,condition_rank,has_damage,id LIMIT 1
  ), title_cover AS (
    SELECT coalesce(
      (SELECT NULLIF(btrim(provider_cover_source),'') FROM eligible
       WHERE NULLIF(btrim(provider_cover_source),'') IS NOT NULL
       ORDER BY selling_price_minor,condition_rank,has_damage,id LIMIT 1),
      (SELECT actual_copy_cover FROM representative),'/placeholder.png') cover
  ), offers AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'listingId',id,'priceMinor',selling_price_minor,'currency','INR',
      'condition',condition,'hasDamage',has_damage,
      'publicDamageNote',public_damage_notes,
      'damageTypes',coalesce(damage_types,'{}'::text[]),
      'availabilityStatus',availability_status,
      'fulfillmentOptions',coalesce(fulfillment_options,'{}'::text[]),
      'confirmationBeforePayment',true)
      ORDER BY selling_price_minor,condition_rank,id),'[]'::jsonb) value
    FROM eligible
  )
  SELECT jsonb_build_object(
    'safeTitlePresentation',jsonb_build_object(
      'originalTitle',r.public_title,
      'authors',coalesce(r.public_authors,'{}'::text[]),
      'language',r.language,
      'publicIsbn',coalesce(r.isbn_13,r.isbn_10),
      'cover',c.cover),
    'offers',o.value)
  FROM representative r CROSS JOIN title_cover c CROSS JOIN offers o
$$;

CREATE FUNCTION public.phase9_storefront_catalogue_v1(
  p_store_id uuid,
  p_page_size integer DEFAULT 20,
  p_cursor text DEFAULT NULL,
  p_match_context text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_contract constant text:='q09-v1';
  v_ordering constant text:='q09-order-v1';
  v_policy text; v_profile jsonb; v_cursor jsonb;
  v_highlight_group text; v_highlight jsonb; v_context_state text:='none';
  v_cursor_highlight boolean:=false; v_context_fingerprint text;
  v_last_title text; v_last_author text; v_last_group text;
  v_title_count integer:=0; v_groups jsonb:='[]'::jsonb;
  v_has_next boolean:=false; v_next_cursor text;
  v_page_last_title text; v_page_last_author text; v_page_last_group text;
BEGIN
  IF p_store_id IS NULL OR p_page_size NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;
  v_policy:=marketplace_sec.phase9_q08_current_policy_version();
  SELECT jsonb_build_object(
      'publicStoreId',p.store_id,'displayName',p.display_name,
      'description',p.description,'logo',p.logo_url,'cover',p.cover_url,
      'city',p.city,'state',p.state,'locality',p.locality_name,
      'operatingHours',coalesce(p.operating_hours,'{}'::jsonb),
      'pickup',p.pickup_enabled,'delivery',p.delivery_enabled,
      'returnPolicy',p.return_policy_type)
  INTO v_profile FROM public.public_store_profiles p
  WHERE p.store_id=p_store_id
    AND marketplace_sec.phase9_store_publication_ineligibility(p.store_id,false) IS NULL;
  IF v_profile IS NULL THEN RETURN NULL; END IF;

  IF p_match_context IS NOT NULL THEN
    v_context_fingerprint:=encode(extensions.digest(p_match_context,'sha256'),'hex');
    v_highlight_group:=marketplace_sec.phase9_q09_match_group(
      p_match_context,p_store_id,v_policy);
    IF v_highlight_group IS NOT NULL
      AND marketplace_sec.phase9_q09_title_group_json(
        p_store_id,v_highlight_group) IS NOT NULL
    THEN v_context_state:='active';
    ELSE v_highlight_group:=NULL; v_context_state:='unavailable'; END IF;
  END IF;

  IF p_cursor IS NOT NULL THEN
    BEGIN
      v_cursor:=marketplace_sec.phase9_q08_cursor_decrypt(p_cursor);
      IF v_cursor->>'kind'<>'q09-cursor'
        OR v_cursor->>'contractVersion'<>v_contract
        OR v_cursor->>'orderingVersion'<>v_ordering
        OR v_cursor->>'policyVersion' IS DISTINCT FROM v_policy
        OR (v_cursor->>'storeId')::uuid IS DISTINCT FROM p_store_id
        OR (v_cursor->>'pageSize')::integer IS DISTINCT FROM p_page_size
      THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      v_cursor_highlight:=(v_cursor->>'highlightedMode')::boolean;
      IF v_cursor_highlight THEN
        IF v_highlight_group IS NULL
          OR v_cursor->>'matchContextFingerprint' IS DISTINCT FROM v_context_fingerprint
          OR v_cursor->>'highlightGroupFingerprint' IS DISTINCT FROM
            encode(extensions.digest(v_highlight_group,'sha256'),'hex')
        THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      ELSIF p_match_context IS NOT NULL THEN
        RAISE EXCEPTION 'P9_CURSOR_INVALID';
      END IF;
      v_last_title:=v_cursor->>'lastTitle';
      v_last_author:=v_cursor->>'lastAuthor';
      v_last_group:=v_cursor->>'lastGroupKey';
      IF v_last_title IS NULL OR v_last_author IS NULL OR v_last_group IS NULL
        THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM='P9_CURSOR_SECRET_MISSING' THEN RAISE; END IF;
      RAISE EXCEPTION 'P9_CURSOR_INVALID';
    END;
  ELSE
    v_cursor_highlight:=v_highlight_group IS NOT NULL;
  END IF;

  WITH eligible AS (
    SELECT marketplace_sec.phase9_title_group_key(l) group_key,
      marketplace_sec.phase9_q08_normalize(l.public_title) order_title,
      marketplace_sec.phase9_q08_normalize(coalesce(l.public_authors[1],'')) order_author
    FROM public.marketplace_book_listings l
    JOIN public.store_inventory i
      ON i.id=l.inventory_id AND i.store_id=l.store_id
    WHERE l.store_id=p_store_id
      AND marketplace_sec.phase9_q09_listing_eligible(l,i)
  ), grouped AS (
    SELECT group_key,min(order_title) order_title,min(order_author) order_author
    FROM eligible GROUP BY group_key
  ), keyed AS (
    SELECT * FROM grouped
    WHERE (NOT v_cursor_highlight OR group_key<>v_highlight_group)
      AND (p_cursor IS NULL OR (order_title,order_author,group_key)>
        (v_last_title,v_last_author,v_last_group))
    ORDER BY order_title,order_author,group_key
  ), limited AS (
    SELECT * FROM keyed LIMIT p_page_size+1
  ), page AS (
    SELECT * FROM limited ORDER BY order_title,order_author,group_key LIMIT p_page_size
  )
  SELECT
    (SELECT count(*)::integer FROM grouped),
    (SELECT count(*) FROM limited)>p_page_size,
    coalesce((SELECT jsonb_agg(
      marketplace_sec.phase9_q09_title_group_json(p_store_id,page.group_key)
      ORDER BY page.order_title,page.order_author,page.group_key) FROM page),'[]'::jsonb),
    (SELECT order_title FROM page ORDER BY order_title DESC,order_author DESC,group_key DESC LIMIT 1),
    (SELECT order_author FROM page ORDER BY order_title DESC,order_author DESC,group_key DESC LIMIT 1),
    (SELECT group_key FROM page ORDER BY order_title DESC,order_author DESC,group_key DESC LIMIT 1)
  INTO v_title_count,v_has_next,v_groups,v_page_last_title,
    v_page_last_author,v_page_last_group;

  IF v_highlight_group IS NOT NULL AND p_cursor IS NULL THEN
    v_highlight:=marketplace_sec.phase9_q09_title_group_json(
      p_store_id,v_highlight_group);
  END IF;
  IF v_has_next THEN
    v_next_cursor:=marketplace_sec.phase9_q08_cursor_encrypt(jsonb_build_object(
      'kind','q09-cursor','contractVersion',v_contract,
      'orderingVersion',v_ordering,'policyVersion',v_policy,
      'storeId',p_store_id,'pageSize',p_page_size,
      'highlightedMode',v_cursor_highlight,
      'matchContextFingerprint',CASE WHEN v_cursor_highlight
        THEN v_context_fingerprint ELSE NULL END,
      'highlightGroupFingerprint',CASE WHEN v_cursor_highlight
        THEN encode(extensions.digest(v_highlight_group,'sha256'),'hex') ELSE NULL END,
      'lastTitle',v_page_last_title,'lastAuthor',v_page_last_author,
      'lastGroupKey',v_page_last_group));
  END IF;

  RETURN jsonb_build_object(
    'contractVersion',v_contract,'storeProfile',v_profile,
    'titleCount',coalesce(v_title_count,0),
    'matchContextState',v_context_state,
    'highlightedTitleGroup',v_highlight,
    'titleGroups',coalesce(v_groups,'[]'::jsonb),
    'pageInfo',jsonb_build_object(
      'nextCursor',v_next_cursor,'hasNextPage',coalesce(v_has_next,false)));
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM IN ('P9_CURSOR_INVALID','P9_CURSOR_SECRET_MISSING','P9_REQUEST_INVALID')
    THEN RAISE; END IF;
  IF SQLERRM LIKE 'MISSING_PREREQ%' THEN RAISE; END IF;
  RAISE EXCEPTION 'P9_REQUEST_INVALID';
END
$$;

CREATE FUNCTION marketplace_sec.phase9_q10_public_gallery(p_listing_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'url','/storage/v1/object/public/inventory-photos/'||public_media.object_path,
      'role',public_media.role,'order',public_media.public_order,
      'width',public_media.width,'height',public_media.height)
    ORDER BY public_media.public_order,public_media.id),'[]'::jsonb)
  FROM (
    SELECT l.id,l.role,l.public_order,a.object_path,a.width,a.height
    FROM public.marketplace_book_listings listing
    JOIN public.inventory_media_links l
      ON l.inventory_id=listing.inventory_id AND l.store_id=listing.store_id
    JOIN public.media_assets a
      ON a.id=l.media_asset_id AND a.store_id=listing.store_id
    WHERE listing.id=p_listing_id
      AND marketplace_sec.phase9_public_media_eligible(l,a)
    ORDER BY l.public_order,l.id
    LIMIT 3
  ) public_media
$$;

CREATE FUNCTION public.phase9_public_listing_detail_v3(p_listing_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'contractVersion','q10-v1',
    'listingId',l.id,
    'store',jsonb_build_object(
      'publicStoreId',p.store_id,'displayName',p.display_name,
      'description',p.description,'logo',p.logo_url,'cover',p.cover_url,
      'city',p.city,'state',p.state,'locality',p.locality_name,
      'pickup',p.pickup_enabled,'delivery',p.delivery_enabled,
      'returnPolicy',p.return_policy_type),
    'title',l.public_title,'authors',coalesce(l.public_authors,'{}'::text[]),
    'language',l.language,'description',l.public_description,
    'editionStatement',l.edition_statement,'volume',l.volume,
    'format',l.format,'isbn10',l.isbn_10,'isbn13',l.isbn_13,
    'cover',coalesce(NULLIF(btrim(i.cover_url),''),
      marketplace_sec.phase9_q08_actual_copy_cover(l.id),'/placeholder.png'),
    'priceMinor',l.selling_price_minor,'currency','INR',
    'condition',l.condition,'hasDamage',l.has_damage,
    'publicDamageNote',l.public_damage_notes,
    'damageTypes',coalesce(l.damage_types,'{}'::text[]),
    'availabilityStatus',l.availability_status,
    'fulfillmentOptions',coalesce(l.fulfillment_options,'{}'::text[]),
    'confirmationBeforePayment',true,
    'gallery',marketplace_sec.phase9_q10_public_gallery(l.id))
  FROM public.marketplace_book_listings l
  JOIN public.store_inventory i
    ON i.id=l.inventory_id AND i.store_id=l.store_id
  JOIN public.public_store_profiles p ON p.store_id=l.store_id
  WHERE l.id=p_listing_id
    AND marketplace_sec.phase9_q09_listing_eligible(l,i)
$$;

REVOKE ALL ON FUNCTION
  marketplace_sec.phase9_q09_listing_eligible(
    public.marketplace_book_listings,public.store_inventory),
  marketplace_sec.phase9_q08_selected_group_key(text,uuid,jsonb),
  marketplace_sec.phase9_q09_issue_match_context(uuid,text),
  marketplace_sec.phase9_q09_match_group(text,uuid,text),
  marketplace_sec.phase9_q09_title_group_json(uuid,text),
  marketplace_sec.phase9_q10_public_gallery(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
  marketplace_sec.phase9_q09_listing_eligible(
    public.marketplace_book_listings,public.store_inventory),
  marketplace_sec.phase9_q08_selected_group_key(text,uuid,jsonb),
  marketplace_sec.phase9_q09_issue_match_context(uuid,text),
  marketplace_sec.phase9_q09_match_group(text,uuid,text),
  marketplace_sec.phase9_q09_title_group_json(uuid,text),
  marketplace_sec.phase9_q10_public_gallery(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION
  public.phase9_bookstore_search_v1(text,integer,text,jsonb,jsonb),
  public.phase9_storefront_catalogue_v1(uuid,integer,text,text),
  public.phase9_public_listing_detail_v3(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_bookstore_search_v1(
  text,integer,text,jsonb,jsonb) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_storefront_catalogue_v1(
  uuid,integer,text,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_public_listing_detail_v3(uuid)
  TO anon,authenticated,service_role;

REVOKE ALL ON public.store_inventory,public.marketplace_book_listings FROM anon,authenticated;

ALTER FUNCTION marketplace_sec.phase9_q09_listing_eligible(
  public.marketplace_book_listings,public.store_inventory) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q08_selected_group_key(text,uuid,jsonb) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q09_issue_match_context(uuid,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q09_match_group(text,uuid,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q09_title_group_json(uuid,text) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_q10_public_gallery(uuid) OWNER TO postgres;
ALTER FUNCTION public.phase9_bookstore_search_base_v1(text,integer,text,jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION public.phase9_bookstore_search_v1(text,integer,text,jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION public.phase9_storefront_catalogue_v1(uuid,integer,text,text) OWNER TO postgres;
ALTER FUNCTION public.phase9_public_listing_detail_v3(uuid) OWNER TO postgres;

COMMIT;
