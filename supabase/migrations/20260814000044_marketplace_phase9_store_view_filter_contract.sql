BEGIN;

CREATE FUNCTION public.phase9_store_view_page_v2(
  p_page_size integer DEFAULT 20,
  p_cursor text DEFAULT NULL,
  p_filter text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_store uuid;
  v_filter text:=coalesce(nullif(btrim(p_filter),''),'all');
  v_cursor_time timestamptz;
  v_cursor_id uuid;
  v_decoded text;
  v_parts text[];
  v_items jsonb;
  v_has_next boolean;
  v_next text;
BEGIN
  IF p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 50
    OR coalesce(char_length(p_cursor),0)>512
    OR v_filter NOT IN (
      'all','private','live','paused','needs_attention','out_of_stock'
    )
  THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;

  v_store:=marketplace_sec.phase9_owner_store(NULL);

  IF p_cursor IS NOT NULL THEN
    BEGIN
      v_decoded:=convert_from(decode(p_cursor,'base64'),'UTF8');
      v_parts:=string_to_array(v_decoded,'|');
      IF cardinality(v_parts)<>6
        OR v_parts[1]<>'phase9-store-view-v2'
        OR v_parts[2]<>v_filter
        OR v_parts[3]<>auth.uid()::text
        OR v_parts[4]<>v_store::text
      THEN RAISE EXCEPTION 'P9_CURSOR_INVALID'; END IF;
      v_cursor_time:=v_parts[5]::timestamptz;
      v_cursor_id:=v_parts[6]::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'P9_CURSOR_INVALID';
    END;
  END IF;

  WITH composed AS MATERIALIZED (
    SELECT i,marketplace_sec.phase9_store_view_item_v1(i,false) AS item
    FROM public.store_inventory i
    WHERE i.store_id=v_store
  ), filtered AS MATERIALIZED (
    SELECT c.i,c.item
    FROM composed c
    WHERE v_filter='all'
      OR (v_filter='needs_attention'
        AND c.item#>>'{attention,attentionState}'='action_required')
      OR (v_filter<>'needs_attention'
        AND c.item#>>'{lifecycle,effectiveState}'=v_filter)
  ), candidates AS (
    SELECT f.i,f.item
    FROM filtered f
    WHERE v_cursor_time IS NULL OR (f.i).updated_at<v_cursor_time
      OR ((f.i).updated_at=v_cursor_time AND (f.i).id<v_cursor_id)
    ORDER BY (f.i).updated_at DESC,(f.i).id DESC
    LIMIT p_page_size+1
  ), numbered AS (
    SELECT c.i,c.item,
      row_number() OVER (ORDER BY (c.i).updated_at DESC,(c.i).id DESC) AS rn
    FROM candidates c
  )
  SELECT coalesce(jsonb_agg(n.item
      ORDER BY (n.i).updated_at DESC,(n.i).id DESC)
      FILTER (WHERE n.rn<=p_page_size),'[]'::jsonb),
    count(*)>p_page_size,
    max(CASE WHEN n.rn=p_page_size THEN translate(encode(convert_to(
      'phase9-store-view-v2|'||v_filter||'|'||auth.uid()::text||'|'||v_store::text||'|'||
        (n.i).updated_at::text||'|'||(n.i).id::text,
      'UTF8'),'base64'),chr(10)||chr(13),'') END)
  INTO v_items,v_has_next,v_next
  FROM numbered n;

  RETURN jsonb_build_object('items',v_items,'pageInfo',jsonb_build_object(
    'hasNextPage',v_has_next,
    'nextCursor',CASE WHEN v_has_next THEN v_next END));
END$$;

ALTER FUNCTION public.phase9_store_view_page_v2(integer,text,text)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.phase9_store_view_page_v2(integer,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_store_view_page_v2(integer,text,text)
  TO authenticated;

COMMIT;
