BEGIN;

ALTER VIEW public.phase9_public_listing_projection SET (security_invoker=true);

REVOKE ALL ON public.phase9_public_listing_projection FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION
  public.phase9_marketplace_store_search(text,integer,jsonb),
  public.phase9_storefront_catalogue(uuid,integer,jsonb),
  public.phase9_listing_detail(uuid)
TO anon;

COMMIT;
