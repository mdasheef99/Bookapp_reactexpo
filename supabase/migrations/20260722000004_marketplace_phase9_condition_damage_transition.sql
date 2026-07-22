-- Phase 9 M04: executable condition compatibility transition and projection update.
BEGIN;

DO $$BEGIN
  IF EXISTS(SELECT 1 FROM public.store_inventory WHERE condition='damaged')
    OR EXISTS(SELECT 1 FROM public.marketplace_book_listings WHERE condition='damaged') THEN
    RAISE EXCEPTION 'Phase 9 condition transition requires damaged-row adjudication';
  END IF;
END$$;

ALTER TABLE public.store_inventory DROP CONSTRAINT store_inventory_condition_check;
ALTER TABLE public.marketplace_book_listings DROP CONSTRAINT marketplace_book_listings_condition_check;
ALTER TABLE public.store_inventory ADD CONSTRAINT store_inventory_condition_compat_check
  CHECK (condition IN ('new','like_new','very_good','good','fair','acceptable','damaged'));
ALTER TABLE public.marketplace_book_listings ADD CONSTRAINT marketplace_listing_condition_compat_check
  CHECK (condition IN ('new','like_new','very_good','good','fair','acceptable','damaged'));

CREATE OR REPLACE FUNCTION marketplace_sec.sync_marketplace_listing_from_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_media_count integer;
BEGIN
  IF NEW.condition NOT IN ('new','like_new','very_good','good','acceptable') THEN
    RAISE EXCEPTION 'P9_REQUEST_INVALID';
  END IF;
  SELECT count(*) INTO v_media_count FROM public.inventory_media_links l
    WHERE l.inventory_id=NEW.id AND l.approval_status='approved';
  IF NEW.visibility_status='published' AND NEW.quantity_available>0 AND NEW.is_sellable
    AND (NOT NEW.has_damage OR (coalesce(char_length(NEW.damage_notes),0)>0 AND v_media_count BETWEEN 1 AND 3)) THEN
    INSERT INTO public.marketplace_book_listings(
      id,inventory_id,store_id,canonical_work_id,canonical_edition_id,public_title,public_authors,isbn_10,isbn_13,
      condition,selling_price_minor,language,public_description,edition_statement,volume,format,has_damage,
      public_damage_notes,damage_types,public_media_count,search_document
    ) VALUES(
      gen_random_uuid(),NEW.id,NEW.store_id,NEW.canonical_work_id,NEW.canonical_edition_id,
      NEW.title,NEW.authors,NEW.isbn_10,NEW.isbn_13,NEW.condition,NEW.selling_price_minor,NEW.language,
      NEW.description,NEW.edition_statement,NEW.volume,NEW.format,NEW.has_damage,NEW.damage_notes,
      NEW.damage_types,v_media_count,to_tsvector('simple',coalesce(NEW.title,'')||' '||array_to_string(NEW.authors,' '))
    ) ON CONFLICT(inventory_id) DO UPDATE SET
      public_title=excluded.public_title,public_authors=excluded.public_authors,condition=excluded.condition,
      selling_price_minor=excluded.selling_price_minor,language=excluded.language,
      public_description=excluded.public_description,edition_statement=excluded.edition_statement,
      volume=excluded.volume,format=excluded.format,has_damage=excluded.has_damage,
      public_damage_notes=excluded.public_damage_notes,damage_types=excluded.damage_types,
      public_media_count=excluded.public_media_count,search_document=excluded.search_document,
      status='active',updated_at=transaction_timestamp();
    UPDATE public.store_inventory SET publication_status='published'
      WHERE id=NEW.id AND publication_status<>'published';
  ELSE
    DELETE FROM public.marketplace_book_listings WHERE inventory_id=NEW.id;
    IF NEW.publication_status='published' THEN
      UPDATE public.store_inventory SET publication_status='private' WHERE id=NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END$$;

UPDATE public.store_inventory SET condition='acceptable' WHERE condition='fair';
UPDATE public.marketplace_book_listings SET condition='acceptable' WHERE condition='fair';
UPDATE public.store_inventory SET has_damage=false,damage_types='{}' WHERE has_damage=false;

ALTER TABLE public.store_inventory ADD CONSTRAINT store_inventory_phase9_condition_check
  CHECK (condition IN ('new','like_new','very_good','good','acceptable')) NOT VALID;
ALTER TABLE public.marketplace_book_listings ADD CONSTRAINT marketplace_listing_phase9_condition_check
  CHECK (condition IN ('new','like_new','very_good','good','acceptable')) NOT VALID;
ALTER TABLE public.store_inventory VALIDATE CONSTRAINT store_inventory_phase9_condition_check;
ALTER TABLE public.marketplace_book_listings VALIDATE CONSTRAINT marketplace_listing_phase9_condition_check;
ALTER TABLE public.store_inventory DROP CONSTRAINT store_inventory_condition_compat_check;
ALTER TABLE public.marketplace_book_listings DROP CONSTRAINT marketplace_listing_condition_compat_check;

REVOKE ALL ON FUNCTION marketplace_sec.sync_marketplace_listing_from_inventory()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.sync_marketplace_listing_from_inventory() TO service_role;

COMMIT;
