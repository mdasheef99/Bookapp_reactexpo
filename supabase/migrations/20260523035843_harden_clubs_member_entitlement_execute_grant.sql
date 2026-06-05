-- Keep the club-membership entitlement trigger function off public RPC roles.

REVOKE EXECUTE ON FUNCTION public.enforce_club_member_entitlement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_club_member_entitlement() TO service_role;
