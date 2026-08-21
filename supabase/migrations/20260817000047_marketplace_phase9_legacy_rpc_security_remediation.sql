BEGIN;

-- The current Marketplace client uses the allowlisted v2 JSON RPCs. Retire
-- customer and service-role access to the obsolete projection-row functions;
-- the postgres owner remains available for controlled database maintenance.
REVOKE ALL ON FUNCTION
  public.phase9_storefront_catalogue(uuid,integer,jsonb),
  public.phase9_listing_detail(uuid)
FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
