-- Phase 9 Unit 7A -> Unit 7B listing-quality handoff correction.
-- Forward-only migration; M39 and M40 remain immutable.
BEGIN;

CREATE FUNCTION marketplace_sec.phase9_inventory_quality_status_v1(
  p_inventory public.store_inventory
) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_damage_media_count integer;
BEGIN
  IF coalesce(char_length(btrim(p_inventory.title)),0)=0
    OR coalesce(char_length(btrim(p_inventory.language)),0)=0
  THEN RETURN 'missing_metadata'; END IF;
  IF p_inventory.selling_price_minor<=0 THEN RETURN 'missing_price'; END IF;
  IF p_inventory.condition NOT IN ('new','like_new','very_good','good','acceptable')
  THEN RETURN 'missing_condition'; END IF;
  IF NOT p_inventory.is_sellable THEN RETURN 'blocked'; END IF;
  IF p_inventory.has_damage THEN
    SELECT count(*) INTO v_damage_media_count
    FROM public.inventory_media_links l
    JOIN public.media_assets a ON a.id=l.media_asset_id
    WHERE l.inventory_id=p_inventory.id AND l.role='damage'
      AND marketplace_sec.phase9_public_media_eligible(l,a);
    IF coalesce(char_length(btrim(p_inventory.damage_notes)),0)=0
      OR coalesce(array_length(p_inventory.damage_types,1),0)=0
      OR v_damage_media_count NOT BETWEEN 1 AND 3
    THEN RETURN 'needs_photo'; END IF;
  END IF;
  RETURN 'ready';
END$$;

CREATE FUNCTION marketplace_sec.phase9_unit7a_set_inventory_quality_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.entry_method='image_extraction' AND NEW.created_from_candidate_id IS NOT NULL THEN
    -- Ignore any supplied value: the persisted server-owned inventory row is authoritative.
    NEW.listing_quality_status:=marketplace_sec.phase9_inventory_quality_status_v1(NEW);
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER phase9_unit7a_inventory_quality_handoff
BEFORE INSERT ON public.store_inventory
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_unit7a_set_inventory_quality_v1();

-- A quality downgrade of a published row follows the existing M40 media-invalidity
-- transition before the projection trigger runs, allowing deterministic retraction.
CREATE FUNCTION marketplace_sec.phase9_prepare_quality_projection_refresh_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.listing_quality_status IS DISTINCT FROM NEW.listing_quality_status
    AND NEW.listing_quality_status<>'ready'
    AND NEW.visibility_status='published'
  THEN
    NEW.visibility_status:='blocked';
    NEW.publication_status:='private';
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER phase9_prepare_quality_projection_refresh
BEFORE UPDATE OF listing_quality_status ON public.store_inventory
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_prepare_quality_projection_refresh_v1();

-- Recreate only the M40-origin trigger, adding the omitted quality dependency.
DROP TRIGGER IF EXISTS phase9_store_inventory_listing_sync ON public.store_inventory;
CREATE TRIGGER phase9_store_inventory_listing_sync
AFTER INSERT OR UPDATE OF visibility_status,publication_status,title,authors,
  language,description,edition_statement,volume,format,isbn_10,isbn_13,condition,
  public_notes,condition_notes,selling_price_minor,quantity_available,is_sellable,
  has_damage,damage_notes,damage_types,cover_url,last_verified_at,listing_quality_status
ON public.store_inventory FOR EACH ROW
EXECUTE FUNCTION public.sync_marketplace_listing_from_inventory();

-- Deterministic, provenance-bounded correction only. This does not blanket-set
-- rows to ready and does not touch manual or metadata-import inventory.
UPDATE public.store_inventory i
SET listing_quality_status=marketplace_sec.phase9_inventory_quality_status_v1(i),
  updated_at=transaction_timestamp()
WHERE i.entry_method='image_extraction'
  AND i.created_from_candidate_id IS NOT NULL
  AND i.listing_quality_status='missing_metadata'
  AND i.listing_quality_status IS DISTINCT FROM
    marketplace_sec.phase9_inventory_quality_status_v1(i);

ALTER FUNCTION marketplace_sec.phase9_inventory_quality_status_v1(
  public.store_inventory) OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_unit7a_set_inventory_quality_v1() OWNER TO postgres;
ALTER FUNCTION marketplace_sec.phase9_prepare_quality_projection_refresh_v1() OWNER TO postgres;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_inventory_quality_status_v1(
  public.store_inventory) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit7a_set_inventory_quality_v1()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase9_prepare_quality_projection_refresh_v1()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_inventory_quality_status_v1(
  public.store_inventory) TO service_role;

COMMIT;
