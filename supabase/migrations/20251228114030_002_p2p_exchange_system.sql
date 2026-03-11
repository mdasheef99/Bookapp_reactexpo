-- Live migration version/name: 20251228114030 / 002_p2p_exchange_system
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251228114030
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

-- Enable PostGIS for geolocation
CREATE EXTENSION IF NOT EXISTS postgis;

-- Listings
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_book_id UUID REFERENCES user_books(id),
  owner_id UUID REFERENCES auth.users(id),
  book_id UUID REFERENCES books(id),
  condition TEXT NOT NULL,
  condition_notes TEXT,
  photos TEXT[] NOT NULL CHECK (array_length(photos, 1) >= 2),
  delivery_options TEXT[] NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'reserved', 'completed'
  )),
  location GEOGRAPHY(POINT),
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_listings_active ON listings(status) WHERE status = 'active';
CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_location_gist ON listings USING gist(location);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id),
  lender_id UUID REFERENCES auth.users(id),
  borrower_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'approved', 'declined', 'payment_pending',
    'ready_to_ship', 'shipped', 'delivered', 'completed', 'disputed'
  )),
  delivery_type TEXT NOT NULL,
  shipping_address_id UUID,
  message TEXT,
  payment_order_id TEXT,
  payment_id TEXT,
  shipping_cost NUMERIC(10,2),
  deposit_amount NUMERIC(10,2),
  awb_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transactions_lender ON transactions(lender_id, created_at DESC);
CREATE INDEX idx_transactions_borrower ON transactions(borrower_id, created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Transaction events (EVENT-SOURCED)
CREATE TABLE transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'requested', 'approved', 'declined', 'cancelled',
    'payment_completed', 'shipped', 'delivered',
    'completed', 'dispute_opened', 'dispute_resolved'
  )),
  actor_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transaction_events_txn ON transaction_events(transaction_id, created_at);

-- User addresses
CREATE TABLE user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_addresses_user ON user_addresses(user_id);

-- Transaction ratings
CREATE TABLE transaction_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags TEXT[],
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(transaction_id, from_user_id)
);

CREATE INDEX idx_ratings_to_user ON transaction_ratings(to_user_id);

-- Trigger to update trust_score
CREATE OR REPLACE FUNCTION update_trust_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET trust_score = (
    SELECT AVG(rating)::NUMERIC(3,2)
    FROM transaction_ratings
    WHERE to_user_id = NEW.to_user_id
  )
  WHERE user_id = NEW.to_user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_trust_score
AFTER INSERT OR UPDATE ON transaction_ratings
FOR EACH ROW EXECUTE FUNCTION update_trust_score();