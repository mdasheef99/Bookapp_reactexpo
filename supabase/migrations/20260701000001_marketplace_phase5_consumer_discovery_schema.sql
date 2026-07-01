-- Phase 5: Consumer Discovery schema completion
-- Adds author partial-search support, public return policy projection,
-- and privacy-preserving unavailable-search demand capture.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.marketplace_authors_text(p_authors TEXT[])
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT array_to_string(COALESCE(p_authors, '{}'::text[]), ' ');
$$;

ALTER TABLE public.marketplace_book_listings
  ADD COLUMN IF NOT EXISTS authors_text TEXT GENERATED ALWAYS AS (
    public.marketplace_authors_text(public_authors)
  ) STORED;

CREATE INDEX idx_marketplace_listings_authors_text_trgm
  ON public.marketplace_book_listings USING gin (authors_text gin_trgm_ops);

CREATE INDEX idx_marketplace_listings_isbn10
  ON public.marketplace_book_listings(isbn_10);

ALTER TABLE public.public_store_profiles
  ADD COLUMN IF NOT EXISTS return_policy_type TEXT NOT NULL DEFAULT 'no_returns';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_store_profiles_return_policy_type_check'
  ) THEN
    ALTER TABLE public.public_store_profiles
      ADD CONSTRAINT public_store_profiles_return_policy_type_check
      CHECK (return_policy_type IN (
        'no_returns',
        'no_returns_except_wrong_item',
        'returns_within_3_days',
        'returns_within_7_days'
      ));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION marketplace_sec.sync_public_store_profile()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.public_store_profiles WHERE store_id = OLD.id;
    RETURN OLD;
  END IF;

  IF (NEW.status = 'active'
      AND NEW.verification_status = 'approved'
      AND NEW.setup_status = 'complete'
      AND NEW.selling_status = 'allowed') THEN
    INSERT INTO public.public_store_profiles (
      store_id, display_name, description, logo_url, cover_url,
      city, state, locality_id, locality_name, location, operating_hours,
      pickup_enabled, delivery_enabled, return_policy_type, updated_at
    ) VALUES (
      NEW.id, NEW.display_name, NEW.description, NEW.logo_url, NEW.cover_url,
      NEW.city, NEW.state, NEW.locality_id,
      (SELECT name FROM public.marketplace_localities WHERE id = NEW.locality_id),
      NEW.location, NEW.operating_hours,
      NEW.pickup_enabled, NEW.delivery_enabled, NEW.return_policy_type, now()
    )
    ON CONFLICT (store_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      description = EXCLUDED.description,
      logo_url = EXCLUDED.logo_url,
      cover_url = EXCLUDED.cover_url,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      locality_id = EXCLUDED.locality_id,
      locality_name = EXCLUDED.locality_name,
      location = EXCLUDED.location,
      operating_hours = EXCLUDED.operating_hours,
      pickup_enabled = EXCLUDED.pickup_enabled,
      delivery_enabled = EXCLUDED.delivery_enabled,
      return_policy_type = EXCLUDED.return_policy_type,
      updated_at = now();
  ELSE
    DELETE FROM public.public_store_profiles WHERE store_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

INSERT INTO public.public_store_profiles (
  store_id, display_name, description, logo_url, cover_url,
  city, state, locality_id, locality_name, location, operating_hours,
  pickup_enabled, delivery_enabled, return_policy_type, updated_at
)
SELECT
  s.id, s.display_name, s.description, s.logo_url, s.cover_url,
  s.city, s.state, s.locality_id, l.name, s.location, s.operating_hours,
  s.pickup_enabled, s.delivery_enabled, s.return_policy_type, now()
FROM public.stores s
LEFT JOIN public.marketplace_localities l ON l.id = s.locality_id
WHERE s.status = 'active'
  AND s.verification_status = 'approved'
  AND s.setup_status = 'complete'
  AND s.selling_status = 'allowed'
ON CONFLICT (store_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  logo_url = EXCLUDED.logo_url,
  cover_url = EXCLUDED.cover_url,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  locality_id = EXCLUDED.locality_id,
  locality_name = EXCLUDED.locality_name,
  location = EXCLUDED.location,
  operating_hours = EXCLUDED.operating_hours,
  pickup_enabled = EXCLUDED.pickup_enabled,
  delivery_enabled = EXCLUDED.delivery_enabled,
  return_policy_type = EXCLUDED.return_policy_type,
  updated_at = now();

CREATE TABLE public.marketplace_search_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  selected_listing_id UUID REFERENCES public.marketplace_book_listings(id) ON DELETE SET NULL,
  selected_store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  location_context JSONB,
  source TEXT NOT NULL DEFAULT 'consumer_marketplace',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.book_demand_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL DEFAULT 'unavailable_search'
    CHECK (signal_type IN ('unavailable_search')),
  query_text TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  canonical_work_id UUID REFERENCES public.canonical_works(id) ON DELETE SET NULL,
  canonical_edition_id UUID REFERENCES public.canonical_editions(id) ON DELETE SET NULL,
  isbn_10 TEXT,
  isbn_13 TEXT,
  location_context JSONB,
  source TEXT NOT NULL DEFAULT 'consumer_marketplace',
  dedupe_key TEXT NOT NULL UNIQUE,
  signal_count INTEGER NOT NULL DEFAULT 1 CHECK (signal_count > 0),
  moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_search_events_normalized
  ON public.marketplace_search_events(normalized_query);
CREATE INDEX idx_marketplace_search_events_created
  ON public.marketplace_search_events(created_at);
CREATE INDEX idx_book_demand_signals_normalized
  ON public.book_demand_signals(normalized_query);
CREATE INDEX idx_book_demand_signals_created
  ON public.book_demand_signals(created_at);

ALTER TABLE public.marketplace_search_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_demand_signals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketplace_search_events FROM anon, authenticated;
REVOKE ALL ON public.book_demand_signals FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_marketplace_unavailable_search(
  p_query TEXT,
  p_result_count INTEGER DEFAULT 0,
  p_location_context JSONB DEFAULT NULL,
  p_source TEXT DEFAULT 'consumer_marketplace'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_query TEXT := btrim(COALESCE(p_query, ''));
  v_normalized TEXT;
  v_event_id UUID;
  v_dedupe_key TEXT;
BEGIN
  IF v_query = '' THEN
    RETURN NULL;
  END IF;

  v_normalized := lower(regexp_replace(v_query, '\s+', ' ', 'g'));

  INSERT INTO public.marketplace_search_events (
    user_id, query, normalized_query, result_count, location_context, source
  )
  VALUES (
    auth.uid(), v_query, v_normalized, GREATEST(COALESCE(p_result_count, 0), 0),
    p_location_context, COALESCE(p_source, 'consumer_marketplace')
  )
  RETURNING id INTO v_event_id;

  IF COALESCE(p_result_count, 0) = 0 THEN
    v_dedupe_key := COALESCE(auth.uid()::text, 'anon') || ':' || md5(v_normalized);

    INSERT INTO public.book_demand_signals (
      user_id, signal_type, query_text, normalized_query,
      location_context, source, dedupe_key
    )
    VALUES (
      auth.uid(), 'unavailable_search', v_query, v_normalized,
      p_location_context, COALESCE(p_source, 'consumer_marketplace'), v_dedupe_key
    )
    ON CONFLICT (dedupe_key) DO UPDATE SET
      signal_count = public.book_demand_signals.signal_count + 1,
      last_seen_at = now();
  END IF;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_marketplace_unavailable_search(TEXT, INTEGER, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_marketplace_unavailable_search(TEXT, INTEGER, JSONB, TEXT) TO anon, authenticated;

COMMIT;
