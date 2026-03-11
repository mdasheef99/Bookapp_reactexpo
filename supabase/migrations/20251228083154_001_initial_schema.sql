-- Live migration version/name: 20251228083154 / 001_initial_schema
-- Classification: exact recovered migration
-- Verified directly from live database (2026-03-06):
--   - recovered from supabase_migrations.schema_migrations.version = 20251228083154
--   - statement body below matches the canonical applied migration content recorded in the live database
-- Inferred:
--   - only this explanatory header is local metadata
-- Uncertain:
--   - original file-level formatting/comments outside the stored applied statement body

-- User profiles (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  city TEXT NOT NULL,
  email TEXT,
  referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  account_type TEXT DEFAULT 'user' CHECK (account_type IN ('user', 'venue_owner', 'author', 'admin')),
  is_verified_author BOOLEAN DEFAULT false,
  membership_tier TEXT DEFAULT 'free' CHECK (membership_tier IN ('free', 'pro', 'pro_plus')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Credit events (EVENT-SOURCED - append only)
CREATE TABLE credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'signup_bonus', 'lend_completed', 'borrow_spent',
    'referral_bonus', 'admin_adjustment',
    'hold_placed', 'hold_released'
  )),
  amount NUMERIC(10,2) NOT NULL,
  transaction_id UUID,
  hold_release_reason TEXT CHECK (hold_release_reason IN (
    'transaction_completed', 'transaction_declined',
    'transaction_cancelled', 'transaction_expired', 'dispute_resolved'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Derived credit balances (updated by trigger)
CREATE TABLE user_credit_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  available NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (available >= 0),
  held NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (held >= 0),
  lifetime_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  lifetime_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Referrals tracking
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referred_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Books catalog
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_books_id TEXT UNIQUE,
  title TEXT NOT NULL,
  authors TEXT[],
  cover_url TEXT,
  isbn_10 TEXT,
  isbn_13 TEXT,
  description TEXT,
  page_count INTEGER,
  categories TEXT[],
  publisher TEXT,
  published_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User's book library
CREATE TABLE user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id),
  reading_status TEXT DEFAULT 'want_to_read' CHECK (reading_status IN ('want_to_read', 'reading', 'completed')),
  ownership TEXT DEFAULT 'owned' CHECK (ownership IN ('owned', 'wishlist', 'borrowed', 'lent_out')),
  condition TEXT CHECK (condition IN ('new', 'like_new', 'good', 'acceptable', 'poor')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  review_is_public BOOLEAN DEFAULT true,
  available_for_lending BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, book_id)
);