-- Phase 4 security hardening: the listing projection synchronizer is a trigger
-- implementation detail and must not be callable through PostgREST RPC.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.sync_marketplace_listing_from_inventory() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_marketplace_listing_from_inventory() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_marketplace_listing_from_inventory() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_marketplace_listing_from_inventory() TO service_role;

COMMIT;
