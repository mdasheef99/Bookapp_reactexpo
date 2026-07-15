-- Phase 5 live-smoke remediation: public RLS must evaluate through the
-- column-safe store projection, not the private stores table. The projection
-- trigger removes rows whenever a store is no longer publicly eligible.
BEGIN;

DROP POLICY IF EXISTS "public profiles readable"
  ON public.public_store_profiles;

CREATE POLICY "public profiles readable"
  ON public.public_store_profiles
  FOR SELECT TO anon, authenticated
  USING (
    locality_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.marketplace_localities l
      WHERE l.id = public_store_profiles.locality_id
        AND l.is_pilot_enabled = true
    )
  );

DROP POLICY IF EXISTS "marketplace listings anonymous public select"
  ON public.marketplace_book_listings;
DROP POLICY IF EXISTS "marketplace listings authenticated select"
  ON public.marketplace_book_listings;

CREATE POLICY "marketplace listings anonymous public select"
  ON public.marketplace_book_listings
  FOR SELECT TO anon
  USING (
    status = 'active'
    AND moderation_status = 'approved'
    AND EXISTS (
      SELECT 1
      FROM public.public_store_profiles p
      WHERE p.store_id = marketplace_book_listings.store_id
    )
  );

CREATE POLICY "marketplace listings authenticated select"
  ON public.marketplace_book_listings
  FOR SELECT TO authenticated
  USING (
    (
      status = 'active'
      AND moderation_status = 'approved'
      AND EXISTS (
        SELECT 1
        FROM public.public_store_profiles p
        WHERE p.store_id = marketplace_book_listings.store_id
      )
    )
    OR marketplace_sec.is_store_admin(store_id)
    OR marketplace_sec.is_platform_operator()
  );

COMMIT;
