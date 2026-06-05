BEGIN;

ALTER VIEW public.club_public_details
  SET (security_invoker = true);

REVOKE ALL ON public.club_public_details FROM PUBLIC;
GRANT SELECT ON public.club_public_details TO anon, authenticated, service_role;

COMMIT;
