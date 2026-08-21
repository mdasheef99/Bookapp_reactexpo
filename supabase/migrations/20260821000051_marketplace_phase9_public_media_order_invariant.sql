-- Phase 9 Units 7/8 final bounded public-media cardinality reconciliation.
-- Authority: Unit 7B SDD §6 and Unit 8 SDD §§7, 15.
-- Repository-only: this migration is not authorized for live application.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure(
      'marketplace_sec.phase9_public_media_eligible(public.inventory_media_links,public.media_assets)'
    ) IS NULL
    OR to_regprocedure('marketplace_sec.validate_inventory_media_link()') IS NULL
    OR to_regclass('public.inventory_media_links') IS NULL
    OR to_regclass('public.media_assets') IS NULL
  THEN
    RAISE EXCEPTION 'MISSING_PREREQ: M51 requires the Unit 7B public-media boundary';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_media_links l
    JOIN public.media_assets a ON a.id=l.media_asset_id
    WHERE marketplace_sec.phase9_public_media_eligible(l,a)
      AND (l.public_order IS NULL OR l.public_order NOT BETWEEN 1 AND 3)
  ) THEN
    RAISE EXCEPTION 'M51_PUBLIC_MEDIA_ORDER_INVARIANT_EXISTING_ROWS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_media_links l
    JOIN public.media_assets a ON a.id=l.media_asset_id
    WHERE marketplace_sec.phase9_public_media_eligible(l,a)
    GROUP BY l.inventory_id,l.public_order
    HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'M51_PUBLIC_MEDIA_ORDER_DUPLICATE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_media_links l
    JOIN public.media_assets a ON a.id=l.media_asset_id
    WHERE marketplace_sec.phase9_public_media_eligible(l,a)
    GROUP BY l.inventory_id
    HAVING count(*)>3
  ) THEN
    RAISE EXCEPTION 'M51_PUBLIC_MEDIA_CARDINALITY_EXCEEDED';
  END IF;
END
$$;

-- A link may keep a NULL public_order while pending/rejected. Once the complete
-- shared predicate makes it public, its order must occupy one of the three
-- existing per-inventory unique slots.
CREATE OR REPLACE FUNCTION marketplace_sec.validate_inventory_media_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_asset public.media_assets; v_inventory public.store_inventory;
BEGIN
  SELECT * INTO v_asset FROM public.media_assets WHERE id=NEW.media_asset_id;
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=NEW.inventory_id;
  IF v_asset.id IS NULL OR v_inventory.id IS NULL
    OR v_asset.store_id<>NEW.store_id OR v_inventory.store_id<>NEW.store_id
    OR v_asset.purpose<>'public_copy' OR v_asset.privacy_class<>'public'
    OR v_asset.bucket_id<>'inventory-photos'
    OR v_asset.lifecycle_status NOT IN ('approved','linked')
    OR v_asset.validation_version IS NULL OR v_asset.reencode_version IS NULL
    OR v_asset.exif_strip_version IS NULL
  THEN RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED'; END IF;
  IF NEW.role='primary_fallback' AND NEW.approval_status<>'approved' THEN
    RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED';
  END IF;
  IF marketplace_sec.phase9_public_media_eligible(NEW,v_asset)
    AND (NEW.public_order IS NULL OR NEW.public_order NOT BETWEEN 1 AND 3)
  THEN RAISE EXCEPTION 'P9_PUBLIC_MEDIA_ORDER_REQUIRED'; END IF;
  RETURN NEW;
END
$$;

-- Eligibility can also become true because an already-linked asset completes
-- validation/promotion. Guard that lifecycle seam before the existing AFTER
-- projection refresh runs.
CREATE FUNCTION marketplace_sec.phase9_guard_media_asset_public_orders()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.inventory_media_links l
    WHERE l.media_asset_id=NEW.id
      AND marketplace_sec.phase9_public_media_eligible(l,NEW)
      AND (l.public_order IS NULL OR l.public_order NOT BETWEEN 1 AND 3)
  ) THEN
    RAISE EXCEPTION 'P9_PUBLIC_MEDIA_ORDER_REQUIRED';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER phase9_guard_media_asset_public_orders
BEFORE UPDATE OF store_id,purpose,privacy_class,bucket_id,object_path,
  validation_version,reencode_version,exif_strip_version,source_media_asset_id,
  lifecycle_status,deleted_at
ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_guard_media_asset_public_orders();

REVOKE ALL ON FUNCTION marketplace_sec.phase9_guard_media_asset_public_orders()
  FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION marketplace_sec.phase9_guard_media_asset_public_orders() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.validate_inventory_media_link() OWNER TO postgres;

COMMENT ON FUNCTION marketplace_sec.phase9_guard_media_asset_public_orders() IS
  'M51: fail closed if an asset lifecycle transition would expose an unordered public inventory link.';

COMMIT;
