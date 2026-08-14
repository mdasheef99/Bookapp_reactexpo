-- Phase 9 Unit 7B: keep generated listing authors projection database-owned.
-- Source: Phase 9 master SDD Unit 7B safe-publication projection contract.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_marketplace_listing_from_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_store public.stores; v_locality text; v_media_count integer;
  v_primary uuid; v_primary_path text; v_cover text; v_availability text;
BEGIN
  SELECT * INTO v_store FROM public.stores WHERE id=NEW.store_id;
  SELECT name INTO v_locality FROM public.marketplace_localities WHERE id=v_store.locality_id;
  IF NEW.visibility_status='paused' THEN
    UPDATE public.marketplace_book_listings SET status='paused',
      availability_status='unavailable',updated_at=transaction_timestamp()
      WHERE inventory_id=NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.visibility_status<>'published' OR NEW.publication_status NOT IN ('publication_pending','published') THEN
    IF EXISTS(SELECT 1 FROM public.store_order_request_items ri
      JOIN public.marketplace_book_listings l ON l.id=ri.listing_id
      WHERE l.inventory_id=NEW.id) THEN
      UPDATE public.marketplace_book_listings SET status='paused',
        availability_status='unavailable',updated_at=transaction_timestamp()
        WHERE inventory_id=NEW.id;
    ELSE DELETE FROM public.marketplace_book_listings WHERE inventory_id=NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  IF marketplace_sec.phase9_publication_ineligibility(NEW) IS NOT NULL THEN
    RAISE EXCEPTION 'P9_PUBLICATION_INELIGIBLE';
  END IF;
  SELECT count(*),(array_agg(a.id) FILTER (WHERE l.role='primary_fallback'))[1],
    max(a.object_path) FILTER (WHERE l.role='primary_fallback')
  INTO v_media_count,v_primary,v_primary_path
  FROM public.inventory_media_links l JOIN public.media_assets a ON a.id=l.media_asset_id
  WHERE l.inventory_id=NEW.id AND marketplace_sec.phase9_public_media_eligible(l,a);
  v_cover:=coalesce(NEW.cover_url,
    CASE WHEN v_primary_path IS NULL THEN NULL ELSE
      '/storage/v1/object/public/inventory-photos/'||v_primary_path END);
  v_availability:=CASE WHEN NEW.quantity_available=1 THEN 'low_stock'
    WHEN NEW.quantity_available>1 THEN 'available' ELSE 'unavailable' END;

  INSERT INTO public.marketplace_book_listings(
    inventory_id,store_id,canonical_work_id,canonical_edition_id,public_title,
    public_authors,public_cover_url,isbn_10,isbn_13,condition,
    public_condition_notes,selling_price_minor,availability_status,
    fulfillment_options,status,moderation_status,listing_quality_status,
    store_city,store_locality_id,store_locality_name,pickup_available,
    delivery_available,language,public_description,edition_statement,volume,
    format,has_damage,public_damage_notes,damage_types,primary_public_media_id,
    public_media_count,last_inventory_verified_bucket,search_document,updated_at
  ) VALUES(
    NEW.id,NEW.store_id,NEW.canonical_work_id,NEW.canonical_edition_id,NEW.title,
    NEW.authors,v_cover,NEW.isbn_10,NEW.isbn_13,
    NEW.condition,coalesce(NEW.public_notes,NEW.condition_notes),NEW.selling_price_minor,
    v_availability,array_remove(ARRAY[
      CASE WHEN v_store.pickup_enabled THEN 'pickup' END,
      CASE WHEN v_store.delivery_enabled THEN 'delivery' END],NULL),
    'active','approved',NEW.listing_quality_status,v_store.city,v_store.locality_id,
    v_locality,v_store.pickup_enabled,v_store.delivery_enabled,NEW.language,
    NEW.description,NEW.edition_statement,NEW.volume,NEW.format,NEW.has_damage,
    NEW.damage_notes,NEW.damage_types,v_primary,least(v_media_count,3),
    CASE WHEN NEW.last_verified_at IS NULL THEN 'not_recently_verified'
      WHEN NEW.last_verified_at>transaction_timestamp()-interval '7 days' THEN 'recent'
      ELSE 'needs_confirmation' END,
    to_tsvector('simple',coalesce(NEW.title,'')||' '||array_to_string(NEW.authors,' ')),
    transaction_timestamp()
  ) ON CONFLICT(inventory_id) DO UPDATE SET
    canonical_work_id=excluded.canonical_work_id,
    canonical_edition_id=excluded.canonical_edition_id,
    public_title=excluded.public_title,public_authors=excluded.public_authors,
    public_cover_url=excluded.public_cover_url,
    isbn_10=excluded.isbn_10,isbn_13=excluded.isbn_13,condition=excluded.condition,
    public_condition_notes=excluded.public_condition_notes,
    selling_price_minor=excluded.selling_price_minor,
    availability_status=excluded.availability_status,
    fulfillment_options=excluded.fulfillment_options,status='active',
    listing_quality_status=excluded.listing_quality_status,
    store_city=excluded.store_city,store_locality_id=excluded.store_locality_id,
    store_locality_name=excluded.store_locality_name,
    pickup_available=excluded.pickup_available,delivery_available=excluded.delivery_available,
    language=excluded.language,public_description=excluded.public_description,
    edition_statement=excluded.edition_statement,volume=excluded.volume,format=excluded.format,
    has_damage=excluded.has_damage,public_damage_notes=excluded.public_damage_notes,
    damage_types=excluded.damage_types,primary_public_media_id=excluded.primary_public_media_id,
    public_media_count=excluded.public_media_count,
    last_inventory_verified_bucket=excluded.last_inventory_verified_bucket,
    search_document=excluded.search_document,updated_at=transaction_timestamp();
  RETURN NEW;
END$$;

ALTER FUNCTION public.sync_marketplace_listing_from_inventory() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_marketplace_listing_from_inventory()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_marketplace_listing_from_inventory()
  TO service_role;

COMMIT;
