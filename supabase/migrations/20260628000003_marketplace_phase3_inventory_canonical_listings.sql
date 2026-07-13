-- Phase 3: Inventory, Canonical Books, and Listings
-- Manual inventory + public listing projection before image-to-LLM automation.
BEGIN;

CREATE TABLE public.canonical_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_normalized TEXT NOT NULL,
  primary_title TEXT NOT NULL,
  primary_authors TEXT[] NOT NULL DEFAULT '{}'::text[],
  language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (title_normalized, primary_authors)
);

CREATE TABLE public.canonical_editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID REFERENCES public.canonical_works(id) ON DELETE SET NULL,
  isbn_10 TEXT,
  isbn_13 TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  authors TEXT[] NOT NULL DEFAULT '{}'::text[],
  publisher TEXT,
  published_date TEXT,
  language TEXT,
  cover_url TEXT,
  page_count INTEGER,
  categories TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT canonical_editions_isbn_10_unique UNIQUE (isbn_10),
  CONSTRAINT canonical_editions_isbn_13_unique UNIQUE (isbn_13)
);

CREATE TABLE public.book_metadata_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_edition_id UUID REFERENCES public.canonical_editions(id) ON DELETE SET NULL,
  source_book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google_books', 'open_library', 'isbn_provider', 'manual')),
  provider_book_id TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,4),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_book_id)
);

CREATE TABLE public.store_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  canonical_work_id UUID REFERENCES public.canonical_works(id) ON DELETE SET NULL,
  canonical_edition_id UUID REFERENCES public.canonical_editions(id) ON DELETE SET NULL,
  source_book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  authors TEXT[] DEFAULT '{}'::text[],
  isbn_10 TEXT,
  isbn_13 TEXT,
  publisher TEXT,
  published_date TEXT,
  cover_url TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'damaged')),
  condition_notes TEXT,
  quantity_total INTEGER NOT NULL DEFAULT 0 CHECK (quantity_total >= 0),
  quantity_available INTEGER NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_sold INTEGER NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  quantity_removed INTEGER NOT NULL DEFAULT 0 CHECK (quantity_removed >= 0),
  selling_price_minor INTEGER NOT NULL CHECK (selling_price_minor >= 0),
  acquisition_cost_minor INTEGER,
  shelf_location TEXT,
  internal_notes TEXT,
  public_notes TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}'::text[],
  visibility_status TEXT NOT NULL DEFAULT 'draft' CHECK (visibility_status IN (
    'draft', 'needs_review', 'published', 'paused', 'out_of_stock', 'blocked'
  )),
  listing_quality_status TEXT NOT NULL DEFAULT 'missing_metadata' CHECK (listing_quality_status IN (
    'ready', 'missing_price', 'missing_condition', 'missing_metadata',
    'low_confidence_match', 'needs_photo', 'blocked'
  )),
  metadata_confidence NUMERIC(5,4),
  duplicate_resolution_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_session_id UUID,
  entry_method TEXT NOT NULL DEFAULT 'manual' CHECK (entry_method IN ('manual', 'image_extraction', 'metadata_import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT store_inventory_quantity_balance CHECK (
    quantity_total >= quantity_available + quantity_reserved + quantity_sold + quantity_removed
  )
);

CREATE TABLE public.marketplace_book_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL UNIQUE REFERENCES public.store_inventory(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  canonical_work_id UUID REFERENCES public.canonical_works(id) ON DELETE SET NULL,
  canonical_edition_id UUID REFERENCES public.canonical_editions(id) ON DELETE SET NULL,
  public_title TEXT NOT NULL,
  public_authors TEXT[] DEFAULT '{}'::text[],
  public_cover_url TEXT,
  isbn_10 TEXT,
  isbn_13 TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'damaged')),
  public_condition_notes TEXT,
  selling_price_minor INTEGER NOT NULL CHECK (selling_price_minor >= 0),
  availability_status TEXT NOT NULL DEFAULT 'confirmation_required' CHECK (availability_status IN (
    'available', 'low_stock', 'confirmation_required', 'unavailable'
  )),
  fulfillment_options TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'out_of_stock', 'blocked')),
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'pending', 'blocked', 'prohibited')),
  listing_quality_status TEXT NOT NULL DEFAULT 'ready',
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  store_city TEXT,
  store_locality_id UUID REFERENCES public.marketplace_localities(id) ON DELETE SET NULL,
  store_locality_name TEXT,
  pickup_available BOOLEAN NOT NULL DEFAULT false,
  delivery_available BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.listing_moderation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_book_listings(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_canonical_editions_title_authors ON public.canonical_editions(title, authors);
CREATE INDEX idx_metadata_sources_provider_book ON public.book_metadata_sources(provider, provider_book_id);
CREATE INDEX idx_store_inventory_store ON public.store_inventory(store_id);
CREATE INDEX idx_store_inventory_store_isbn13_condition ON public.store_inventory(store_id, isbn_13, condition);
CREATE INDEX idx_store_inventory_store_title ON public.store_inventory(store_id, title);
CREATE INDEX idx_marketplace_listings_store ON public.marketplace_book_listings(store_id);
CREATE INDEX idx_marketplace_listings_isbn13 ON public.marketplace_book_listings(isbn_13);
CREATE INDEX idx_marketplace_listings_status ON public.marketplace_book_listings(status, moderation_status);
CREATE INDEX idx_listing_flags_listing ON public.listing_moderation_flags(listing_id);

ALTER TABLE public.canonical_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_metadata_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_book_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_moderation_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "canonical works readable" ON public.canonical_works
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "canonical editions readable" ON public.canonical_editions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "metadata sources platform write" ON public.book_metadata_sources
  FOR ALL TO authenticated
  USING (marketplace_sec.is_platform_operator())
  WITH CHECK (marketplace_sec.is_platform_operator());

CREATE POLICY "inventory owner select" ON public.store_inventory
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id) OR marketplace_sec.is_platform_operator());
CREATE POLICY "inventory owner insert" ON public.store_inventory
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.is_store_admin(store_id));
CREATE POLICY "inventory owner update" ON public.store_inventory
  FOR UPDATE TO authenticated
  USING (marketplace_sec.is_store_admin(store_id))
  WITH CHECK (marketplace_sec.is_store_admin(store_id));
CREATE POLICY "inventory platform delete" ON public.store_inventory
  FOR DELETE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

CREATE POLICY "marketplace listings public select" ON public.marketplace_book_listings
  FOR SELECT TO anon, authenticated
  USING (
    (
      status = 'active'
      AND moderation_status = 'approved'
      AND EXISTS (
        SELECT 1
        FROM public.stores s
        WHERE s.id = marketplace_book_listings.store_id
          AND s.status = 'active'
          AND s.verification_status = 'approved'
          AND s.setup_status = 'complete'
          AND s.selling_status = 'allowed'
      )
    )
    OR marketplace_sec.is_store_admin(store_id)
    OR marketplace_sec.is_platform_operator()
  );
CREATE POLICY "marketplace listings platform update" ON public.marketplace_book_listings
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','moderator']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','moderator']));

CREATE POLICY "listing flags platform all" ON public.listing_moderation_flags
  FOR ALL TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','moderator']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','moderator']));

CREATE OR REPLACE FUNCTION public.sync_marketplace_listing_from_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.stores%ROWTYPE;
  locality_name TEXT;
  can_publish BOOLEAN;
  next_status TEXT;
  availability TEXT;
BEGIN
  SELECT * INTO s FROM public.stores WHERE id = NEW.store_id;
  SELECT name INTO locality_name FROM public.marketplace_localities WHERE id = s.locality_id;

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
    DELETE FROM public.marketplace_book_listings WHERE inventory_id = NEW.id;
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
    NEW.condition, COALESCE(NEW.public_notes, NEW.condition_notes), NEW.selling_price_minor, availability,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN s.pickup_enabled THEN 'pickup' END,
      CASE WHEN s.delivery_enabled THEN 'delivery' END
    ], NULL),
    next_status, 'approved', NEW.listing_quality_status,
    s.city, s.locality_id, locality_name,
    s.pickup_enabled, s.delivery_enabled, now()
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
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_marketplace_listing_from_inventory_trg
AFTER INSERT OR UPDATE OF
  title, authors, cover_url, isbn_10, isbn_13, condition, condition_notes,
  quantity_available, selling_price_minor, public_notes, visibility_status,
  listing_quality_status, canonical_work_id, canonical_edition_id
ON public.store_inventory
FOR EACH ROW
EXECUTE FUNCTION public.sync_marketplace_listing_from_inventory();

COMMIT;
