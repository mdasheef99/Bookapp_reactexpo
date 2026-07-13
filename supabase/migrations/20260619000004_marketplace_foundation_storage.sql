-- Phase 1D: Multi-Tenant Bookstore Marketplace Foundation - Storage
-- Creates storage buckets and object-level policies for marketplace
-- assets. Depends on Part B (helper functions).
-- Governance decisions (Phase 1 review questions) recorded in DOC-13.

BEGIN;
-- =====================================================================
-- STORAGE BUCKETS AND POLICIES
-- Public buckets: object-URL access only, NO broad listing (no SELECT
-- policy). Private buckets: path-scoped owner access OR platform read.
-- First path segment must be the store_id for all store-scoped assets.
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('storefront-assets', 'storefront-assets', true, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('inventory-photos', 'inventory-photos', true, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('seller-verification-docs', 'seller-verification-docs', false, 10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('order-dispute-evidence', 'order-dispute-evidence', false, 10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('image-extraction-inputs', 'image-extraction-inputs', false, 10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Owner-scoped writes across all marketplace buckets (store_id = path[1]).
CREATE POLICY "mkt owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN (
      'storefront-assets', 'inventory-photos', 'seller-verification-docs',
      'order-dispute-evidence', 'image-extraction-inputs'
    )
    AND EXISTS (
      SELECT 1 FROM public.store_administrators sa
      WHERE sa.user_id = auth.uid() AND sa.status = 'active'
        AND sa.store_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "mkt owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN (
      'storefront-assets', 'inventory-photos', 'seller-verification-docs',
      'order-dispute-evidence', 'image-extraction-inputs'
    )
    AND EXISTS (
      SELECT 1 FROM public.store_administrators sa
      WHERE sa.user_id = auth.uid() AND sa.status = 'active'
        AND sa.store_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id IN (
      'storefront-assets', 'inventory-photos', 'seller-verification-docs',
      'order-dispute-evidence', 'image-extraction-inputs'
    )
    AND EXISTS (
      SELECT 1 FROM public.store_administrators sa
      WHERE sa.user_id = auth.uid() AND sa.status = 'active'
        AND sa.store_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "mkt owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN (
      'storefront-assets', 'inventory-photos', 'seller-verification-docs',
      'order-dispute-evidence', 'image-extraction-inputs'
    )
    AND EXISTS (
      SELECT 1 FROM public.store_administrators sa
      WHERE sa.user_id = auth.uid() AND sa.status = 'active'
        AND sa.store_id::text = (storage.foldername(name))[1]
    )
  );

-- Private buckets: owner path access OR platform reviewer/finance/admin read.
-- (Public buckets intentionally have NO SELECT policy -> no API listing.)
CREATE POLICY "mkt private read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN (
      'seller-verification-docs', 'order-dispute-evidence', 'image-extraction-inputs'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.store_administrators sa
        WHERE sa.user_id = auth.uid() AND sa.status = 'active'
          AND sa.store_id::text = (storage.foldername(name))[1]
      )
      OR marketplace_sec.has_platform_role(
        ARRAY['platform_admin', 'store_reviewer', 'finance_ops']
      )
    )
  );

COMMIT;
