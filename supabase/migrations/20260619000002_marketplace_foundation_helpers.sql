-- Phase 1B: Multi-Tenant Bookstore Marketplace Foundation - Helpers
-- Creates the private marketplace_sec helper schema, SECURITY DEFINER
-- helper functions, and the public_store_profiles sync trigger.
-- Depends on Part A (tables must exist).
-- Governance decisions (Phase 1 review questions) recorded in DOC-13.
BEGIN;
-- =====================================================================
-- Private security-helper schema (NOT exposed to PostgREST/REST API).
-- Functions are created after tables exist (see Helper Functions block).
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS marketplace_sec;
REVOKE ALL ON SCHEMA marketplace_sec FROM PUBLIC;
-- =====================================================================
-- HELPER FUNCTIONS (private schema, SECURITY DEFINER, pinned search_path).
-- Owned by the migration role (table owner) so they bypass RLS on the
-- tables they read, preventing policy recursion. Not exposed to PostgREST.
-- =====================================================================
CREATE FUNCTION marketplace_sec.is_store_admin(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_administrators sa
    WHERE sa.store_id = p_store_id
      AND sa.user_id = auth.uid()
      AND sa.status = 'active'
  );
$$;

CREATE FUNCTION marketplace_sec.has_platform_role(p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_user_roles pr
    WHERE pr.user_id = auth.uid()
      AND pr.status = 'active'
      AND pr.role = ANY (p_roles)
  );
$$;

CREATE FUNCTION marketplace_sec.is_platform_operator()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_user_roles pr
    WHERE pr.user_id = auth.uid()
      AND pr.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION marketplace_sec.is_store_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION marketplace_sec.has_platform_role(TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION marketplace_sec.is_platform_operator() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA marketplace_sec TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.is_store_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.has_platform_role(TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.is_platform_operator() TO authenticated, service_role;

-- =====================================================================
-- PUBLIC PROJECTION SYNC (SECURITY DEFINER trigger; not a REST endpoint).
-- Mirrors only safe columns of qualifying stores into public_store_profiles.
-- =====================================================================
CREATE FUNCTION marketplace_sec.sync_public_store_profile()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.public_store_profiles WHERE store_id = OLD.id;
    RETURN OLD;
  END IF;

  IF (NEW.status = 'active'
      AND NEW.verification_status = 'approved'
      AND NEW.setup_status = 'complete'
      AND NEW.selling_status = 'allowed') THEN
    INSERT INTO public.public_store_profiles (
      store_id, display_name, description, logo_url, cover_url,
      city, state, locality_id, locality_name, location, operating_hours,
      pickup_enabled, delivery_enabled, updated_at
    ) VALUES (
      NEW.id, NEW.display_name, NEW.description, NEW.logo_url, NEW.cover_url,
      NEW.city, NEW.state, NEW.locality_id,
      (SELECT name FROM public.marketplace_localities WHERE id = NEW.locality_id),
      NEW.location, NEW.operating_hours,
      NEW.pickup_enabled, NEW.delivery_enabled, now()
    )
    ON CONFLICT (store_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      description = EXCLUDED.description,
      logo_url = EXCLUDED.logo_url,
      cover_url = EXCLUDED.cover_url,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      locality_id = EXCLUDED.locality_id,
      locality_name = EXCLUDED.locality_name,
      location = EXCLUDED.location,
      operating_hours = EXCLUDED.operating_hours,
      pickup_enabled = EXCLUDED.pickup_enabled,
      delivery_enabled = EXCLUDED.delivery_enabled,
      updated_at = now();
  ELSE
    DELETE FROM public.public_store_profiles WHERE store_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_public_store_profile
AFTER INSERT OR UPDATE OR DELETE ON public.stores
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.sync_public_store_profile();
COMMIT;
