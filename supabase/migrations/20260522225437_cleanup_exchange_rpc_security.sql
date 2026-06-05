-- Cleanup Exchange RPC security and duplicate live policies.
--
-- This is intentionally a Phase 1 hardening migration:
-- - tighten function execution grants
-- - pin search_path on existing SECURITY DEFINER functions
-- - remove duplicate/obsolete RLS policies
-- - keep transaction and credit business logic unchanged

-- ---------------------------------------------------------------------------
-- Remove duplicate or overly broad live RLS policies.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can add addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can update their addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can delete their addresses" ON public.user_addresses;

DROP POLICY IF EXISTS "Participants can view transaction events" ON public.transaction_events;
DROP POLICY IF EXISTS "Participants can create transaction events" ON public.transaction_events;

-- Keep transaction_events RPC/service-written only. Participants can read via
-- the canonical policy created in the previous Exchange hardening migration.

-- ---------------------------------------------------------------------------
-- Pin function search_path for existing SECURITY DEFINER Exchange RPCs.
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.request_transaction(uuid, uuid, text, text, uuid)
  SET search_path = public;

ALTER FUNCTION public.approve_transaction(uuid, uuid)
  SET search_path = public;

ALTER FUNCTION public.decline_transaction(uuid, uuid)
  SET search_path = public;

ALTER FUNCTION public.cancel_transaction(uuid, uuid)
  SET search_path = public;

ALTER FUNCTION public.complete_transaction(uuid, uuid)
  SET search_path = public;

ALTER FUNCTION public.transition_transaction_status(uuid, text, uuid)
  SET search_path = public;

ALTER FUNCTION public.grant_signup_bonus(uuid)
  SET search_path = public;

ALTER FUNCTION public.place_hold(uuid, uuid, numeric)
  SET search_path = public;

ALTER FUNCTION public.release_hold(uuid, uuid, text)
  SET search_path = public;

ALTER FUNCTION public.update_credit_balance()
  SET search_path = public;

-- ---------------------------------------------------------------------------
-- Tighten function execution grants.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.request_transaction(uuid, uuid, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_transaction(uuid, uuid, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_transaction(uuid, uuid, text, text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.approve_transaction(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_transaction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_transaction(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.decline_transaction(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decline_transaction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.decline_transaction(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_transaction(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_transaction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_transaction(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.complete_transaction(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_transaction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_transaction(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.transition_transaction_status(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transition_transaction_status(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.transition_transaction_status(uuid, text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.set_default_user_address(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_default_user_address(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_default_user_address(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.grant_signup_bonus(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_signup_bonus(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.grant_signup_bonus(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.place_hold(uuid, uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_hold(uuid, uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.place_hold(uuid, uuid, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.place_hold(uuid, uuid, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_hold(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_hold(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_hold(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_hold(uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.transfer_credits(uuid, uuid, integer, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transfer_credits(uuid, uuid, integer, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_credits(uuid, uuid, integer, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_credits(uuid, uuid, integer, text, uuid) TO service_role;

-- Trigger functions should not be directly callable through exposed API roles.
REVOKE EXECUTE ON FUNCTION public.update_credit_balance() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_credit_balance() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_credit_balance() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_credit_balance() TO service_role;
