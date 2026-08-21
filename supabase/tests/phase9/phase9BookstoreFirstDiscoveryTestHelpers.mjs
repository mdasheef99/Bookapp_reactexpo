import { randomUUID } from 'node:crypto';

export async function seedApprovedPrimaryCopy(db, {
  storeId,
  inventoryId,
  listingId,
  uploadedBy,
  objectPath = null,
  role = 'primary_fallback',
  publicOrder = 1,
}) {
  const sourceId = randomUUID();
  const derivativeId = randomUUID();
  const sourcePath = `${storeId}/u8b-source-${sourceId}.jpg`;
  const resolvedObjectPath = objectPath ?? `${storeId}/u8-approved-${derivativeId}.webp`;
  const shaSeed = randomUUID().replaceAll('-', '');
  const shaSource = `${shaSeed}${'a'.repeat(32)}`;
  const shaDerivative = `${'b'.repeat(32)}${shaSeed}`;
  await db.exec(`
    INSERT INTO public.media_assets(
      id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
      sha256,detected_mime,bytes,width,height,retention_class,lifecycle_status
    ) VALUES(
      '${sourceId}','${storeId}','${uploadedBy}','public_copy','private_scan',
      'marketplace-media-staging','${sourcePath}','${shaSource}','image/jpeg',128,1,1,
      'phase9-public-copy-source','staged'
    );
    INSERT INTO public.media_assets(
      id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
      sha256,detected_mime,bytes,width,height,validation_version,validated_at,
      reencode_version,exif_strip_version,source_media_asset_id,retention_class,
      lifecycle_status
    ) VALUES(
      '${derivativeId}','${storeId}','${uploadedBy}','public_copy','public',
      'inventory-photos','${resolvedObjectPath}','${shaDerivative}','image/webp',256,1,1,
      'phase9-media-v1',transaction_timestamp(),'phase9-reencode-v1',
      'phase9-exif-v1','${sourceId}','phase9-public-copy','approved'
    );
    INSERT INTO public.inventory_media_links(
      id,store_id,inventory_id,media_asset_id,role,public_order,
      approval_status,approved_by,approved_at
    ) VALUES(
      '${randomUUID()}','${storeId}','${inventoryId}','${derivativeId}',
      '${role}',${publicOrder},'approved','${uploadedBy}',transaction_timestamp()
    );
    UPDATE public.marketplace_book_listings
    SET primary_public_media_id=CASE WHEN '${role}'='primary_fallback'
          THEN '${derivativeId}'::uuid ELSE primary_public_media_id END,
        public_media_count=(SELECT count(*) FROM public.inventory_media_links
          WHERE inventory_id='${inventoryId}')
    WHERE id='${listingId}';
  `);
  return { sourceId, derivativeId, objectPath: resolvedObjectPath };
}
