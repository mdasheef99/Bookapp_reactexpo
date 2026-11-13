BEGIN;

CREATE FUNCTION public.phase9_store_view_summary_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store uuid; v_result jsonb;
BEGIN
  v_store:=marketplace_sec.phase9_owner_store(NULL);

  -- M43 phase9_store_view_item_v1: only the presence of a reason is needed.
  -- Keep its mapped reasons (not every ineligibility, e.g. stock/metadata)
  -- and its precedence exactly. Do not construct presentation/media JSON.
  WITH attention AS MATERIALIZED (
    SELECT i.publication_status,i.visibility_status,i.quantity_available,
      i.selling_price_minor,
      coalesce(i.listing_quality_status IN (
          'missing_metadata','missing_price','missing_condition','needs_photo')
        OR NOT i.is_sellable OR i.publication_status='publication_failed'
        OR marketplace_sec.phase9_publication_ineligibility(i) IN (
          'damage_media','moderation','store_policy','pilot_locality',
          'marketplace_feature','store_allowlist','subscription','entitlement',
          'active_listing_limit','price','condition'),false) AS needs_attention
    FROM public.store_inventory i WHERE i.store_id=v_store
  ), classified AS (
    SELECT a.*,CASE
      WHEN publication_status='publication_failed' THEN 'publication_failed'
      WHEN needs_attention THEN 'needs_attention'
      WHEN quantity_available=0 THEN 'out_of_stock'
      WHEN visibility_status='published' THEN 'live'
      WHEN visibility_status='paused' THEN 'paused'
      ELSE 'private' END AS effective_state
    FROM attention a
  )
  SELECT jsonb_build_object('counts',jsonb_build_object(
    'all',count(*) FILTER (WHERE true),
    'private',count(*) FILTER (WHERE effective_state='private'),
    'live',count(*) FILTER (WHERE effective_state='live'),
    'paused',count(*) FILTER (WHERE effective_state='paused'),
    'needsAttention',count(*) FILTER (WHERE needs_attention),
    'outOfStock',count(*) FILTER (WHERE effective_state='out_of_stock')
  ),'availableStockValueMinor',
    coalesce(sum(selling_price_minor::numeric * quantity_available::numeric),0)::text)
  INTO v_result FROM classified;
  RETURN v_result;
END$$;

ALTER FUNCTION public.phase9_store_view_summary_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_store_view_summary_v1()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_store_view_summary_v1() TO authenticated;

COMMIT;
