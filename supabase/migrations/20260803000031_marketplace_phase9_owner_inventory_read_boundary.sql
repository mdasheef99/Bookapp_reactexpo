-- Phase 9 WU1: controlled Owner inventory read boundary.
-- Forward draft only. Creation does not authorize Supabase application.
-- Stable public.phase9_owner_inventory(uuid) is intentionally untouched.
BEGIN;

-- Evidence-backed keyset index: tenant scope plus the exact descending order.
CREATE INDEX store_inventory_owner_read_page_idx
  ON public.store_inventory (store_id, updated_at DESC, id DESC);

CREATE FUNCTION public.phase9_owner_inventory_page_v1(
  p_page_size integer DEFAULT 25,
  p_cursor text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_visibility_status text DEFAULT NULL,
  p_quantity_state text DEFAULT NULL,
  p_entry_method text DEFAULT NULL,
  p_date_added text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v_store uuid;
  v_payload jsonb;
  v_after_updated_at timestamptz;
  v_after_id uuid;
  v_rows jsonb;
  v_has_more boolean;
  v_next text;
  v_as_of timestamptz := transaction_timestamp();
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_condition text := coalesce(nullif(btrim(p_condition), ''), 'all');
  v_visibility text := coalesce(nullif(btrim(p_visibility_status), ''), 'all');
  v_quantity text := coalesce(nullif(btrim(p_quantity_state), ''), 'all');
  v_entry text := coalesce(nullif(btrim(p_entry_method), ''), 'all');
  v_date_added text := coalesce(nullif(btrim(p_date_added), ''), 'all');
BEGIN
  v_store := marketplace_sec.phase9_owner_ux_assert_owner();

  IF p_page_size IS NULL
    OR p_page_size NOT BETWEEN 1 AND 50
    OR char_length(v_query) > 100
    OR v_condition NOT IN ('all', 'new', 'like_new', 'very_good', 'good', 'acceptable')
    OR v_visibility NOT IN ('all', 'draft', 'needs_review', 'published', 'paused', 'out_of_stock', 'blocked')
    OR v_quantity NOT IN ('all', 'available', 'low_stock', 'out_of_stock')
    OR v_entry NOT IN ('all', 'manual', 'image_extraction', 'metadata_import')
    OR v_date_added NOT IN ('all', 'last_7_days', 'last_30_days')
  THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;

  IF p_cursor IS NOT NULL THEN
    v_payload := marketplace_sec.phase9_owner_ux_cursor_payload(p_cursor);
    IF v_payload->>'kind' <> 'inventory'
      OR v_payload->>'actor' <> auth.uid()::text
      OR v_payload->>'store' <> v_store::text
      OR v_payload->>'query' <> v_query
      OR v_payload->>'condition' <> v_condition
      OR v_payload->>'visibility' <> v_visibility
      OR v_payload->>'quantity' <> v_quantity
      OR v_payload->>'entry' <> v_entry
      OR v_payload->>'dateAdded' <> v_date_added
      OR v_payload->>'size' <> p_page_size::text
      OR v_payload->>'contract' <> 'phase9-owner-inventory-v1'
      OR v_payload->>'order' <> 'updated_at.desc,id.desc'
      OR v_payload->>'asOf' IS NULL
      OR v_payload->>'updatedAt' IS NULL
      OR v_payload->>'id' IS NULL
    THEN
      RAISE EXCEPTION 'P9_CURSOR_INVALID';
    END IF;
    BEGIN
      v_as_of := (v_payload->>'asOf')::timestamptz;
      v_after_updated_at := (v_payload->>'updatedAt')::timestamptz;
      v_after_id := (v_payload->>'id')::uuid;
    EXCEPTION
      WHEN invalid_text_representation OR datetime_field_overflow THEN
        RAISE EXCEPTION 'P9_CURSOR_INVALID';
    END;
  END IF;

  WITH eligible AS (
    SELECT i.*
    FROM public.store_inventory i
    WHERE i.store_id = v_store
      AND i.updated_at <= v_as_of
      AND (p_cursor IS NULL OR (i.updated_at,i.id)<(v_after_updated_at,v_after_id))
      AND (
        v_query = ''
        OR position(v_query in lower(i.title)) > 0
        OR position(v_query in lower(coalesce(i.isbn_10, ''))) > 0
        OR position(v_query in lower(coalesce(i.isbn_13, ''))) > 0
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(i.authors, ARRAY[]::text[])) author
          WHERE position(v_query in lower(author)) > 0
        )
      )
      AND (v_condition = 'all' OR i.condition = v_condition)
      AND (v_visibility = 'all' OR i.visibility_status = v_visibility)
      AND (
        v_quantity = 'all'
        OR (v_quantity = 'available' AND i.quantity_available > 1)
        OR (v_quantity = 'low_stock' AND i.quantity_available = 1)
        OR (v_quantity = 'out_of_stock' AND i.quantity_available = 0)
      )
      AND (v_entry = 'all' OR i.entry_method = v_entry)
      AND (
        v_date_added = 'all'
        OR (v_date_added = 'last_7_days' AND i.created_at >= v_as_of - interval '7 days')
        OR (v_date_added = 'last_30_days' AND i.created_at >= v_as_of - interval '30 days')
      )
  ), page AS (
    SELECT *
    FROM eligible
    ORDER BY updated_at DESC, id DESC
    LIMIT p_page_size + 1
  ), sliced AS (
    SELECT *
    FROM page
    ORDER BY updated_at DESC, id DESC
    LIMIT p_page_size
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'store_id', s.store_id,
      'title', s.title,
      'authors', s.authors,
      'isbn_10', s.isbn_10,
      'isbn_13', s.isbn_13,
      'condition', s.condition,
      'quantity_available', s.quantity_available,
      'selling_price_minor', s.selling_price_minor,
      'visibility_status', s.visibility_status,
      'listing_quality_status', s.listing_quality_status,
      'public_notes', s.public_notes,
      'shelf_location', s.shelf_location,
      'entry_method', s.entry_method,
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      'version', s.version
    ) ORDER BY s.updated_at DESC, s.id DESC), '[]'::jsonb),
    (SELECT count(*) > p_page_size FROM page),
    (SELECT marketplace_sec.phase9_owner_ux_cursor(jsonb_build_object(
      'kind', 'inventory',
      'actor', auth.uid(),
      'store', v_store,
      'query', v_query,
      'condition', v_condition,
      'visibility', v_visibility,
      'quantity', v_quantity,
      'entry', v_entry,
      'dateAdded', v_date_added,
      'size', p_page_size,
      'contract', 'phase9-owner-inventory-v1',
      'order', 'updated_at.desc,id.desc',
      'asOf', v_as_of::text,
      'updatedAt', s.updated_at::text,
      'id', s.id
    ))
    FROM sliced s
    ORDER BY s.updated_at ASC, s.id ASC
    LIMIT 1)
  INTO v_rows, v_has_more, v_next
  FROM sliced s;

  IF NOT v_has_more THEN
    v_next := NULL;
  END IF;

  RETURN jsonb_build_object(
    'contractVersion', 'phase9-owner-inventory-v1',
    'items', v_rows,
    'pageInfo', jsonb_build_object(
      'nextCursor', v_next,
      'hasMore', v_has_more
    )
  );
EXCEPTION WHEN others THEN
  IF SQLERRM = ANY (ARRAY[
    'P9_AUTH_REQUIRED',
    'P9_OWNER_NOT_AUTHORIZED',
    'P9_REQUEST_INVALID',
    'P9_CURSOR_INVALID',
    'P9_INTERNAL_ERROR'
  ]) THEN
    RAISE;
  END IF;
  RAISE EXCEPTION 'P9_INTERNAL_ERROR';
END
$function$;

ALTER FUNCTION public.phase9_owner_inventory_page_v1(integer,text,text,text,text,text,text,text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_owner_inventory_page_v1(integer,text,text,text,text,text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_owner_inventory_page_v1(integer,text,text,text,text,text,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_owner_inventory_page_v1(integer,text,text,text,text,text,text,text)
  TO service_role;

COMMIT;
