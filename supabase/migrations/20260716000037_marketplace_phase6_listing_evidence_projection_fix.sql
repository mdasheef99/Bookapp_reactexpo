-- Phase 6 persisted-gate corrective: preserve listing rows referenced by
-- immutable order-request evidence while keeping them out of public discovery.
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_marketplace_listing_from_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s public.stores%ROWTYPE;
  locality_name TEXT;
  can_publish BOOLEAN;
  next_status TEXT;
  availability TEXT;
BEGIN
  SELECT * INTO s FROM public.stores WHERE id = NEW.store_id;
  SELECT name INTO locality_name
    FROM public.marketplace_localities
   WHERE id = s.locality_id;

  can_publish :=
    NEW.visibility_status = 'published'
    AND NEW.listing_quality_status = 'ready'
    AND NEW.quantity_available > 0
    AND NEW.selling_price_minor > 0
    AND s.status = 'active'
    AND s.verification_status = 'approved'
    AND s.setup_status = 'complete'
    AND s.selling_status = 'allowed';

  IF NOT can_publish THEN
    IF EXISTS (
      SELECT 1
        FROM public.store_order_request_items ri
        JOIN public.marketplace_book_listings listing ON listing.id = ri.listing_id
       WHERE listing.inventory_id = NEW.id
    ) THEN
      UPDATE public.marketplace_book_listings
         SET status = CASE WHEN NEW.quantity_available = 0 THEN 'out_of_stock'
                           WHEN NEW.visibility_status = 'blocked' THEN 'blocked'
                           ELSE 'paused' END,
             availability_status = 'unavailable',
             updated_at = pg_catalog.now()
       WHERE inventory_id = NEW.id;
    ELSE
      DELETE FROM public.marketplace_book_listings WHERE inventory_id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  next_status := CASE
    WHEN NEW.visibility_status = 'blocked' THEN 'blocked'
    WHEN NEW.quantity_available = 0 THEN 'out_of_stock'
    ELSE 'active'
  END;
  availability := CASE
    WHEN NEW.quantity_available = 1 THEN 'low_stock'
    ELSE 'confirmation_required'
  END;

  INSERT INTO public.marketplace_book_listings (
    inventory_id, store_id, canonical_work_id, canonical_edition_id,
    public_title, public_authors, public_cover_url, isbn_10, isbn_13,
    condition, public_condition_notes, selling_price_minor, availability_status,
    fulfillment_options, status, moderation_status, listing_quality_status,
    store_city, store_locality_id, store_locality_name,
    pickup_available, delivery_available, updated_at
  )
  VALUES (
    NEW.id, NEW.store_id, NEW.canonical_work_id, NEW.canonical_edition_id,
    NEW.title, NEW.authors, NEW.cover_url, NEW.isbn_10, NEW.isbn_13,
    NEW.condition, COALESCE(NEW.public_notes, NEW.condition_notes), NEW.selling_price_minor,
    availability,
    pg_catalog.array_remove(ARRAY[
      CASE WHEN s.pickup_enabled THEN 'pickup' END,
      CASE WHEN s.delivery_enabled THEN 'delivery' END
    ], NULL),
    next_status, 'approved', NEW.listing_quality_status,
    s.city, s.locality_id, locality_name,
    s.pickup_enabled, s.delivery_enabled, pg_catalog.now()
  )
  ON CONFLICT (inventory_id) DO UPDATE SET
    public_title = EXCLUDED.public_title,
    public_authors = EXCLUDED.public_authors,
    public_cover_url = EXCLUDED.public_cover_url,
    isbn_10 = EXCLUDED.isbn_10,
    isbn_13 = EXCLUDED.isbn_13,
    condition = EXCLUDED.condition,
    public_condition_notes = EXCLUDED.public_condition_notes,
    selling_price_minor = EXCLUDED.selling_price_minor,
    availability_status = EXCLUDED.availability_status,
    fulfillment_options = EXCLUDED.fulfillment_options,
    status = EXCLUDED.status,
    listing_quality_status = EXCLUDED.listing_quality_status,
    store_city = EXCLUDED.store_city,
    store_locality_id = EXCLUDED.store_locality_id,
    store_locality_name = EXCLUDED.store_locality_name,
    pickup_available = EXCLUDED.pickup_available,
    delivery_available = EXCLUDED.delivery_available,
    updated_at = pg_catalog.now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_marketplace_listing_from_inventory()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_marketplace_listing_from_inventory() TO service_role;

COMMIT;
