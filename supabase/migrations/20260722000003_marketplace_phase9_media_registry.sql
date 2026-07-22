-- Phase 9 M03: typed media registry, links, and lifecycle evidence.
BEGIN;

CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  uploaded_by uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN
    ('scan_input','public_copy','customer_request','dispute_evidence')),
  privacy_class text NOT NULL CHECK (privacy_class IN ('private_scan','public','private_request','restricted')),
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  sha256 text NOT NULL,
  detected_mime text NOT NULL CHECK (detected_mime IN ('image/jpeg','image/png','image/webp')),
  bytes bigint NOT NULL CHECK (bytes BETWEEN 1 AND 10485760),
  width integer NOT NULL CHECK (width>0),
  height integer NOT NULL CHECK (height>0),
  validation_version text,
  validated_at timestamptz,
  reencode_version text,
  exif_strip_version text,
  source_media_asset_id uuid REFERENCES public.media_assets(id),
  session_id uuid REFERENCES public.image_extraction_sessions(id),
  request_photo_request_id uuid,
  retention_class text NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'staged' CHECK (lifecycle_status IN
    ('staged','validated','approved','linked','delete_pending','deleted','failed','held')),
  delete_after timestamptz,
  deleted_at timestamptz,
  hold_type text,
  hold_reason text,
  hold_authority text,
  hold_started_at timestamptz,
  hold_released_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(bucket_id,object_path),
  CONSTRAINT media_assets_purpose_privacy_check CHECK (
    (purpose='scan_input' AND privacy_class='private_scan') OR
    (purpose='public_copy' AND privacy_class='public') OR
    (purpose='customer_request' AND privacy_class='private_request') OR
    (purpose='dispute_evidence' AND privacy_class='restricted')
  ),
  CONSTRAINT media_assets_hold_coherence CHECK (
    (hold_type IS NULL AND hold_started_at IS NULL) OR
    (hold_type IS NOT NULL AND hold_started_at IS NOT NULL)
  )
);
CREATE INDEX media_assets_lifecycle_idx
  ON public.media_assets(store_id,purpose,lifecycle_status,delete_after);
CREATE INDEX media_assets_session_idx ON public.media_assets(session_id) WHERE session_id IS NOT NULL;

CREATE TABLE public.inventory_media_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  inventory_id uuid NOT NULL REFERENCES public.store_inventory(id),
  media_asset_id uuid NOT NULL REFERENCES public.media_assets(id),
  role text NOT NULL CHECK (role IN ('damage','actual_copy','primary_fallback')),
  public_order smallint CHECK (public_order BETWEEN 1 AND 3),
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(inventory_id,media_asset_id),
  UNIQUE(inventory_id,public_order),
  CONSTRAINT inventory_media_approval_coherence CHECK (
    (approval_status='approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR approval_status<>'approved'
  )
);
CREATE INDEX inventory_media_links_store_inventory_idx
  ON public.inventory_media_links(store_id,inventory_id,public_order);

CREATE FUNCTION marketplace_sec.validate_inventory_media_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_asset public.media_assets; v_inventory public.store_inventory;
BEGIN
  SELECT * INTO v_asset FROM public.media_assets WHERE id=NEW.media_asset_id;
  SELECT * INTO v_inventory FROM public.store_inventory WHERE id=NEW.inventory_id;
  IF v_asset.id IS NULL OR v_inventory.id IS NULL OR v_asset.store_id<>NEW.store_id
    OR v_inventory.store_id<>NEW.store_id OR v_asset.purpose<>'public_copy'
    OR v_asset.privacy_class<>'public' OR v_asset.lifecycle_status NOT IN ('approved','linked') THEN
    RAISE EXCEPTION 'P9_MEDIA_NOT_APPROVED';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER inventory_media_link_guard BEFORE INSERT OR UPDATE ON public.inventory_media_links
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.validate_inventory_media_link();

CREATE TABLE public.media_lifecycle_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL REFERENCES public.media_assets(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 20),
  lease_owner text,
  lease_expires_at timestamptz,
  action text NOT NULL CHECK (action IN ('validate','promote','delete','orphan_reconcile')),
  outcome text NOT NULL,
  safe_error_code text,
  object_result text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(media_asset_id,action,attempt_number)
);

ALTER TABLE public.image_extraction_inputs ADD CONSTRAINT input_media_asset_fk
  FOREIGN KEY(media_asset_id) REFERENCES public.media_assets(id);
ALTER TABLE public.marketplace_book_listings ADD CONSTRAINT listing_primary_public_media_fk
  FOREIGN KEY(primary_public_media_id) REFERENCES public.media_assets(id);
ALTER TABLE public.phase9_upload_capabilities ADD CONSTRAINT capability_consumed_media_fk
  FOREIGN KEY(consumed_media_asset_id) REFERENCES public.media_assets(id);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_media_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_lifecycle_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_assets,public.inventory_media_links,public.media_lifecycle_attempts
  FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.media_assets,public.inventory_media_links,
  public.media_lifecycle_attempts TO service_role;
REVOKE ALL ON FUNCTION marketplace_sec.validate_inventory_media_link() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.validate_inventory_media_link() TO service_role;

COMMIT;

