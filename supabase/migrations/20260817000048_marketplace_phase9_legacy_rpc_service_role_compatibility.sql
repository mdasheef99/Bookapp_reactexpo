BEGIN;

-- Keep the obsolete projection-row RPCs unavailable to customer-capable roles.
-- Restore only trusted service-role EXECUTE compatibility after M47's broader
-- revoke; the current Marketplace client remains on the allowlisted v2 JSON RPCs.
REVOKE EXECUTE ON FUNCTION
  public.phase9_storefront_catalogue(uuid, integer, jsonb),
  public.phase9_listing_detail(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.phase9_storefront_catalogue(uuid, integer, jsonb),
  public.phase9_listing_detail(uuid)
TO service_role;

COMMIT;
