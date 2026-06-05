BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.club_public_details FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.club_public_details FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.club_public_details FROM authenticated;

GRANT SELECT ON TABLE public.club_public_details TO anon, authenticated, service_role;

COMMIT;
