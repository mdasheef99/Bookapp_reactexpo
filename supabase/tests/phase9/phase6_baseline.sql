-- Executable snapshot of the Phase 9-relevant live Phase 6 surface, reconciled by
-- read-only schema inspection on 2026-07-22. Auth/storage helpers are local stubs.
-- This is a disposable test fixture, never a live migration.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA marketplace_sec;

CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_split_to_array(name,'/')
$$;
CREATE FUNCTION marketplace_sec.has_platform_role(roles text[]) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT false $$;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')
$$;

CREATE TABLE public.stores (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  setup_status text NOT NULL DEFAULT 'complete',
  selling_status text NOT NULL DEFAULT 'allowed'
);
CREATE TABLE public.store_administrators (
  store_id uuid NOT NULL REFERENCES public.stores(id),
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'active',
  PRIMARY KEY (store_id, user_id)
);
CREATE FUNCTION marketplace_sec.is_store_admin(p_store_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_administrators sa
    WHERE sa.store_id=p_store_id AND sa.user_id=auth.uid()
      AND sa.status='active'
  )
$$;

CREATE TABLE public.canonical_works (
  id uuid PRIMARY KEY,
  title_normalized text NOT NULL,
  primary_title text NOT NULL,
  primary_authors text[] NOT NULL DEFAULT '{}',
  language text,
  UNIQUE (title_normalized, primary_authors)
);
CREATE TABLE public.canonical_editions (
  id uuid PRIMARY KEY,
  work_id uuid REFERENCES public.canonical_works(id),
  isbn_10 text UNIQUE,
  isbn_13 text UNIQUE,
  title text NOT NULL,
  subtitle text,
  authors text[] NOT NULL DEFAULT '{}',
  publisher text,
  published_date text,
  language text,
  cover_url text,
  page_count integer,
  categories text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE public.book_metadata_sources (
  id uuid PRIMARY KEY,
  canonical_edition_id uuid REFERENCES public.canonical_editions(id),
  provider text NOT NULL,
  provider_book_id text NOT NULL,
  raw_payload jsonb,
  normalized_payload jsonb,
  confidence numeric,
  CONSTRAINT book_metadata_sources_provider_check
    CHECK (provider IN ('google_books','open_library','isbn_provider','manual')),
  UNIQUE (provider, provider_book_id)
);
CREATE TABLE public.store_inventory (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  canonical_work_id uuid REFERENCES public.canonical_works(id),
  canonical_edition_id uuid REFERENCES public.canonical_editions(id),
  source_book_id uuid,
  title text NOT NULL,
  authors text[] NOT NULL DEFAULT '{}',
  isbn_10 text,
  isbn_13 text,
  publisher text,
  published_date text,
  cover_url text,
  condition text NOT NULL DEFAULT 'good',
  condition_notes text,
  selling_price_minor integer NOT NULL DEFAULT 0,
  shelf_location text,
  internal_notes text,
  public_notes text,
  photos text[] NOT NULL DEFAULT '{}',
  quantity_total integer NOT NULL DEFAULT 0,
  quantity_available integer NOT NULL DEFAULT 0,
  quantity_reserved integer NOT NULL DEFAULT 0,
  quantity_sold integer NOT NULL DEFAULT 0,
  quantity_removed integer NOT NULL DEFAULT 0,
  visibility_status text NOT NULL DEFAULT 'draft',
  listing_quality_status text NOT NULL DEFAULT 'missing_metadata',
  metadata_confidence numeric,
  duplicate_resolution_state jsonb NOT NULL DEFAULT '{}',
  extraction_session_id uuid,
  entry_method text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT store_inventory_condition_check
    CHECK (condition IN ('new','like_new','good','fair','damaged')),
  CONSTRAINT store_inventory_nonnegative CHECK (
    quantity_total>=0 AND quantity_available>=0 AND quantity_reserved>=0
    AND quantity_sold>=0 AND quantity_removed>=0
  )
);
ALTER TABLE public.store_inventory ADD CONSTRAINT store_inventory_quantity_balance
  CHECK (quantity_total=quantity_available+quantity_reserved+quantity_sold+quantity_removed)
  NOT VALID;
CREATE TABLE public.marketplace_book_listings (
  id uuid PRIMARY KEY,
  inventory_id uuid NOT NULL UNIQUE REFERENCES public.store_inventory(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  canonical_work_id uuid REFERENCES public.canonical_works(id),
  canonical_edition_id uuid REFERENCES public.canonical_editions(id),
  public_title text NOT NULL,
  public_authors text[] NOT NULL DEFAULT '{}',
  authors_text text,
  public_cover_url text,
  isbn_10 text,
  isbn_13 text,
  condition text NOT NULL,
  public_condition_notes text,
  selling_price_minor integer NOT NULL,
  availability_status text NOT NULL DEFAULT 'available',
  fulfillment_options text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  moderation_status text NOT NULL DEFAULT 'approved',
  listing_quality_status text NOT NULL DEFAULT 'ready',
  store_city text,
  store_locality_name text,
  pickup_available boolean NOT NULL DEFAULT false,
  delivery_available boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT marketplace_book_listings_condition_check
    CHECK (condition IN ('new','like_new','good','fair','damaged'))
);
CREATE FUNCTION marketplace_sec.sync_marketplace_listing_from_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.visibility_status='published' AND NEW.quantity_available>0 THEN
    INSERT INTO public.marketplace_book_listings(
      id,inventory_id,store_id,canonical_work_id,canonical_edition_id,public_title,public_authors,
      isbn_10,isbn_13,condition,selling_price_minor
    ) VALUES(
      gen_random_uuid(),NEW.id,NEW.store_id,NEW.canonical_work_id,NEW.canonical_edition_id,
      NEW.title,NEW.authors,NEW.isbn_10,NEW.isbn_13,NEW.condition,NEW.selling_price_minor
    ) ON CONFLICT(inventory_id) DO UPDATE SET
      public_title=excluded.public_title,public_authors=excluded.public_authors,condition=excluded.condition,
      selling_price_minor=excluded.selling_price_minor,updated_at=transaction_timestamp();
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER store_inventory_listing_sync AFTER INSERT OR UPDATE ON public.store_inventory
FOR EACH ROW EXECUTE FUNCTION marketplace_sec.sync_marketplace_listing_from_inventory();

CREATE TABLE public.store_order_requests (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  version integer NOT NULL DEFAULT 1
);
CREATE TABLE public.store_order_request_items (
  id uuid PRIMARY KEY,
  order_request_id uuid NOT NULL REFERENCES public.store_order_requests(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  inventory_id uuid NOT NULL REFERENCES public.store_inventory(id),
  requested_quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  version integer NOT NULL DEFAULT 1
);
CREATE TABLE public.inventory_holds (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  inventory_id uuid NOT NULL REFERENCES public.store_inventory(id),
  order_request_id uuid NOT NULL REFERENCES public.store_order_requests(id),
  order_request_item_id uuid NOT NULL REFERENCES public.store_order_request_items(id),
  hold_type text NOT NULL CHECK (hold_type IN ('soft','firm')),
  status text NOT NULL CHECK (status IN ('active','released','converted_to_sale')),
  quantity integer NOT NULL CHECK (quantity>0),
  version integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  release_reason_code text,
  command_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  released_at timestamptz
);
CREATE TABLE public.marketplace_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  actor_user_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE public.marketplace_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  actor_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(bucket_id,name)
);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('image-extraction-inputs','image-extraction-inputs',false,10485760,ARRAY['image/jpeg','image/png','image/webp']),
 ('inventory-photos','inventory-photos',true,5242880,ARRAY['image/jpeg','image/png','image/webp']),
 ('order-dispute-evidence','order-dispute-evidence',false,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
 ('listing-photos','listing-photos',true,5242880,ARRAY['image/jpeg','image/png','image/webp']);

ALTER TABLE public.store_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_book_listings ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.store_inventory TO authenticated;
GRANT SELECT ON public.marketplace_book_listings TO anon,authenticated;
