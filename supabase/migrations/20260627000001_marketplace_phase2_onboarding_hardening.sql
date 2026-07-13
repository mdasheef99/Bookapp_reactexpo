-- Phase 2A: Store Owner Gate, Auth, and Security - onboarding write hardening
-- Store owner application writes move to controlled service paths in later Phase 2 work.
-- Generic PostgREST owner updates must not mutate privileged status/review columns.

BEGIN;

DROP POLICY IF EXISTS "stores update" ON public.stores;
CREATE POLICY "stores platform update" ON public.stores
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

DROP POLICY IF EXISTS "verif_req update" ON public.store_verification_requests;
CREATE POLICY "verif_req platform update" ON public.store_verification_requests
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));

DROP POLICY IF EXISTS "verif_doc update" ON public.store_verification_documents;
CREATE POLICY "verif_doc platform update" ON public.store_verification_documents
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));

COMMENT ON POLICY "stores platform update" ON public.stores IS
  'Phase 2 hardening: privileged store fields are updated through controlled Edge Functions or platform roles, not broad owner PostgREST updates.';

COMMENT ON POLICY "verif_req platform update" ON public.store_verification_requests IS
  'Phase 2 hardening: verification review/status fields are platform managed until controlled owner application paths are added.';

COMMENT ON POLICY "verif_doc platform update" ON public.store_verification_documents IS
  'Phase 2 hardening: verification document review/status fields are platform managed.';

COMMIT;
