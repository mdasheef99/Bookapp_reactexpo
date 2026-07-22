-- Phase 9 M06: server-mediated Storage buckets and least-privilege policies.
BEGIN;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('marketplace-media-staging','marketplace-media-staging',false,10485760,
  ARRAY['image/jpeg','image/png','image/webp']),
 ('order-request-photos','order-request-photos',false,5242880,
  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=excluded.public,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
UPDATE storage.buckets SET public=false,file_size_limit=10485760,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']
  WHERE id='image-extraction-inputs';
UPDATE storage.buckets SET public=true,file_size_limit=5242880,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']
  WHERE id='inventory-photos';

DROP POLICY IF EXISTS "mkt owner upload" ON storage.objects;
DROP POLICY IF EXISTS "mkt owner update" ON storage.objects;
DROP POLICY IF EXISTS "mkt owner delete" ON storage.objects;
DROP POLICY IF EXISTS "mkt private read" ON storage.objects;

CREATE POLICY "mkt owner upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id IN ('storefront-assets','seller-verification-docs','order-dispute-evidence') AND EXISTS(
    SELECT 1 FROM public.store_administrators sa WHERE sa.user_id=auth.uid() AND sa.status='active'
      AND sa.store_id::text=(storage.foldername(name))[1]));
CREATE POLICY "mkt owner update" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id IN ('storefront-assets','seller-verification-docs','order-dispute-evidence') AND EXISTS(
    SELECT 1 FROM public.store_administrators sa WHERE sa.user_id=auth.uid() AND sa.status='active'
      AND sa.store_id::text=(storage.foldername(name))[1])) WITH CHECK (
  bucket_id IN ('storefront-assets','seller-verification-docs','order-dispute-evidence') AND EXISTS(
    SELECT 1 FROM public.store_administrators sa WHERE sa.user_id=auth.uid() AND sa.status='active'
      AND sa.store_id::text=(storage.foldername(name))[1]));
CREATE POLICY "mkt owner delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id IN ('storefront-assets','seller-verification-docs','order-dispute-evidence') AND EXISTS(
    SELECT 1 FROM public.store_administrators sa WHERE sa.user_id=auth.uid() AND sa.status='active'
      AND sa.store_id::text=(storage.foldername(name))[1]));
CREATE POLICY "mkt private read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id IN ('seller-verification-docs','order-dispute-evidence') AND (EXISTS(
    SELECT 1 FROM public.store_administrators sa WHERE sa.user_id=auth.uid() AND sa.status='active'
      AND sa.store_id::text=(storage.foldername(name))[1]) OR marketplace_sec.has_platform_role(
        ARRAY['platform_admin','store_reviewer','finance_ops'])));

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO service_role;
GRANT SELECT ON storage.buckets TO service_role;

-- Object writes are deliberately service-mediated. A persisted capability is consumed by
-- a named transaction before the service writes or promotes bytes; no direct client policy exists.
COMMIT;
