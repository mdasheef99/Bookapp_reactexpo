# BookTalks Mobile - Complete Technical Architecture

## 1. Architectural Philosophy

BookTalks follows a **Layered Feature-Based Architecture** with Domain-Driven Design principles. The system prioritizes:
- **Data Integrity** via Event Sourcing
- **Scalability** through modular features
- **Offline-First** for core library features
- **Security** via Row-Level Security (RLS)

---

## 2. Technology Stack

### 2.1 Frontend (Mobile Application)
**Core Framework:**
- **React Native**: Via Expo SDK 52+
- **Expo Router**: File-based routing (v3+)
- **TypeScript**: Strict mode enabled

**UI & Styling:**
- **NativeWind**: Tailwind CSS for React Native (v4)
- **expo-image**: Aggressive caching for book covers
- **expo-linear-gradient**: Atmospheric theme transitions
- **react-native-reanimated**: Smooth animations

**State Management:**
- **Zustand**: Lightweight stores for auth, theme, UI
- **TanStack Query** (React Query v5): Server state, caching
- **MMKV**: Synchronous, high-speed persistence (faster than AsyncStorage)

**Forms & Validation:**
- **React Hook Form**: Performance-optimized forms
- **Zod**: Runtime type safety + validation schemas

**Utilities:**
- **date-fns**: Date manipulation (lighter than Moment.js)
- **expo-location**: City-level geolocation
- **expo-camera**: Photo upload for listings (Phase 1.5)

### 2.2 Backend (Supabase)
**Database:**
- **PostgreSQL**: v15+ with PostGIS extension
- **Row-Level Security (RLS)**: Enforced on all public tables
- **Real-time Subscriptions**: Supabase Realtime for club chat

**Authentication:**
- **Supabase Auth**: Phone OTP via Twilio integration
- **JWT**: Session management with refresh tokens

**Storage:**
- **Supabase Storage**: Book cover uploads, venue photos
- **Bucket Policies**: Public read, authenticated write

**Edge Functions** (Deno runtime):
- `create-payment-order`: Razorpay integration
- `verify-payment`: Webhook handler
- `book-shipment`: Porter/Dunzo API calls
- `complete-transaction`: Atomic credit transfers
- `wishlist-notify`: On listing creation trigger

### 2.3 Third-Party Integrations
**Google Books API:**
- Endpoint: `https://www.googleapis.com/books/v1/volumes`
- Rate Limit: 1000 requests/day (free tier)
- Fallback: Manual entry UI

**Razorpay:**
- SDK: `react-native-razorpay`
- Webhook: HMAC verification
- Test Cards: Provided in sandbox

**Porter (Intra-City Delivery):**
- API Endpoint: `https://api.porter.in/v1/`
- Authentication: API Key (Header: `X-API-KEY`)
- Features: Create order, track shipment, cost estimation
- Webhook Events: order_created, pickup_complete, in_transit, delivered, cancelled
- Pricing: Dynamic based on distance and vehicle type
- Coverage: Major Indian cities (Mumbai, Delhi, Bangalore, etc.)

**Dunzo (Intra-City Delivery):**
- API Endpoint: `https://apis.dunzo.in/api/v1/`
- Authentication: API Key + Client ID
- Features: Create task, track delivery, cost estimation
- Webhook Events: task_created, runner_assigned, picked_up, delivered, cancelled
- Pricing: Dynamic based on distance
- Coverage: Major Indian cities (Bangalore, Mumbai, Delhi, Pune, etc.)

**Google Maps:**
- Geocoding API: Address → Lat/Long
- Distance Matrix API: Proximity calculations
- Places API: Venue search autocomplete

**Firebase Cloud Messaging (FCM):**
- Push notifications (expo-notifications wrapper)
- Topic subscriptions for club messages
- Silent notifications for background credit updates

### 2.4 Development Tools
**Code Quality:**
- ESLint + Prettier: Consistent code style
- TypeScript strict mode: Catch errors at compile-time
- Husky: Pre-commit hooks (lint, format, test)

**Testing:**
- Jest: Unit tests for utilities
- React Native Testing Library: Component tests
- Detox (Phase 2): E2E tests

**CI/CD:**
- **EAS Build**: Cloud builds for iOS/Android
- **EAS Submit**: Automated app store submissions
- **EAS Update**: Over-the-air updates for JS bundles
- GitHub Actions: Automated testing on PR

---

## 3. Project Structure

```
booktalks-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               #   Root layout (auth guard)
│   ├── index.tsx                 #   Root redirect logic
│   ├── (auth)/                   #   Auth group (guest-only)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── verify-otp.tsx
│   │   └── setup-profile.tsx
│   ├── (tabs)/                   #   Main app (authenticated)
│   │   ├── _layout.tsx           #     Tab bar navigation
│   │   ├── library/
│   │   │   ├── index.tsx
│   │   │   ├── search.tsx
│   │   │   └── [bookId].tsx      #     Book detail (dynamic route)
│   │   ├── exchange/
│   │   │   ├── index.tsx         #     Browse listings
│   │   │   ├── create.tsx        #     Create listing
│   │   │   └── [transactionId].tsx
│   │   ├── clubs/
│   │   │   ├── index.tsx
│   │   │   ├── [clubId]/
│   │   │   │   ├── index.tsx     #     Club detail + chat
│   │   │   │   ├── members.tsx
│   │   │   │   └── settings.tsx
│   │   └── profile/
│   │       ├── index.tsx
│   │       ├── credits.tsx       #     Credit history
│   │       └── settings.tsx
│   └── +not-found.tsx            # 404 fallback
│
├── src/
│   ├── assets/                   # Images, fonts, icons
│   │   ├── images/
│   │   ├── fonts/
│   │   └── icons/
│   │
│   ├── components/               # Shared UI components
│   │   ├── ui/                   #   Primitive components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Modal.tsx
│   │   ├── layout/               #   Layout components
│   │   │   ├── Screen.tsx
│   │   │   ├── Header.tsx
│   │   │   └── TabBar.tsx
│   │   └── feedback/             #   Loading, errors, empty states
│   │       ├── Skeleton.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── features/                 # Domain feature modules
│   │   ├── auth/
│   │   │   ├── api/              #   Supabase auth calls
│   │   │   │   └── authService.ts
│   │   │   ├── hooks/            #   Auth-specific hooks
│   │   │   │   └── useAuth.ts    #     Zustand store
│   │   │   ├── components/       #   Auth UI components
│   │   │   │   ├── PhoneInput.tsx
│   │   │   │   └── OtpInput.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── books/
│   │   │   ├── api/
│   │   │   │   ├── googleBooksService.ts
│   │   │   │   └── libraryService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useBookSearch.ts   # TanStack Query
│   │   │   │   └── useLibrary.ts
│   │   │   ├── components/
│   │   │   │   ├── BookCard.tsx
│   │   │   │   ├── BookCover.tsx
│   │   │   │   └── StatusBadge.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── exchange/
│   │   │   ├── api/
│   │   │   │   ├── listingsService.ts
│   │   │   │   └── transactionsService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useListings.ts
│   │   │   │   ├── useTransactionFlow.ts  # Multi-step state
│   │   │   │   └── usePayment.ts
│   │   │   ├── components/
│   │   │   │   ├── ListingCard.tsx
│   │   │   │   ├── TransactionTimeline.tsx
│   │   │   │   └── ConditionPicker.tsx
│   │   │   ├── store/             #   Complex UI state (Zustand)
│   │   │   │   └── createListingStore.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── clubs/
│   │   │   ├── api/
│   │   │   │   ├── clubsService.ts
│   │   │   │   └── messagesService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useClubs.ts
│   │   │   │   ├── useRealtimeMessages.ts  # Supabase Realtime
│   │   │   │   └── useVoting.ts
│   │   │   ├── components/
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── SpoilerText.tsx
│   │   │   │   └── MemberList.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── venues/
│   │   │   ├── api/
│   │   │   │   └── venuesService.ts
│   │   │   ├── hooks/
│   │   │   │   └── useNearbyVenues.ts
│   │   │   ├── components/
│   │   │   │   ├── VenueCard.tsx
│   │   │   │   └── VenueMap.tsx
│   │   │   └── types.ts
│   │   │
│   │   └── credits/
│   │       ├── api/
│   │       │   └── creditsService.ts
│   │       ├── hooks/
│   │       │   └── useCreditBalance.ts
│   │       ├── components/
│   │       │   ├── CreditDisplay.tsx
│   │       │   └── EventHistory.tsx
│   │       └── types.ts
│   │
│   ├── hooks/                    # Global shared hooks
│   │   ├── useTheme.ts           #   Atmospheric theme logic
│   │   ├── useLocation.ts        #   City geolocation
│   │   └── useDebounce.ts        #   Search optimization
│   │
│   ├── lib/                      # Third-party configs
│   │   ├── supabase.ts           #   Supabase client init
│   │   ├── queryClient.ts        #   TanStack Query setup
│   │   └── mmkv.ts               #   MMKV storage instance
│   │
│   ├── services/                 # Global shared services
│   │   ├── uploadService.ts      #   Supabase storage uploads
│   │   └── notificationService.ts
│   │
│   ├── types/                    # Global TypeScript types
│   │   ├── database.ts           #   Supabase-generated types
│   │   ├── api.ts                #   External API types
│   │   └── index.ts
│   │
│   └── utils/                    # Helper functions
│       ├── format.ts             #   Date, currency formatters
│       ├── validation.ts         #   Zod schemas
│       └── constants.ts          #   App constants
│
├── supabase/                     # Supabase backend code
│   ├── migrations/               #   SQL schema files
│   │   ├── 001_initial_schema.sql          # ⚠️ TO BE CREATED
│   │   ├── 002_exchange_schema.sql         # ⚠️ TO BE CREATED
│   │   ├── 003_venues_clubs_schema.sql     # ⚠️ TO BE CREATED
│   │   ├── 004_rename_lead_to_admin.sql    # ⚠️ TO BE CREATED
│   │   └── 005_chat_moderation_schema.sql  # ⚠️ TO BE CREATED
│   │
│   ├── functions/                #   Edge Functions (⚠️ ALL TO BE IMPLEMENTED)
│   │   ├── create-payment-order/
│   │   │   └── index.ts
│   │   ├── verify-payment/
│   │   │   └── index.ts
│   │   ├── book-shipment/
│   │   │   └── index.ts
│   │   ├── complete-transaction/
│   │   │   └── index.ts
│   │   ├── wishlist-notify/
│   │   │   └── index.ts
│   │   └── check-membership-limits/
│   │       └── index.ts
│   │
│   └── seed.sql                  #   Dev/test data
│
├── docs/                         # Documentation
│   ├── booktalks_mobile_spec.md
│   ├── architecture_react_expo.md
│   └── API.md                    #   API documentation
│
├── .env.example                  # Environment variables template
├── app.json                      # Expo configuration
├── babel.config.js
├── tailwind.config.js            # NativeWind theme extension
├── tsconfig.json
└── package.json
```

---

## 4. Database Architecture

### 4.1 Complete Schema (PostgreSQL)

#### Migration 001: Users & Credits (Event-Sourced)

**⚠️ NOTE:** This migration file needs to be created at `supabase/migrations/001_initial_schema.sql` before implementation. The SQL below represents the complete schema for this migration.

```sql
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
  account_type TEXT DEFAULT 'user' CHECK (account_type IN (
    'user', 'venue_owner', 'author', 'admin'
  )),
  is_verified_author BOOLEAN DEFAULT false,
  membership_tier TEXT DEFAULT 'free' CHECK (membership_tier IN (
    'free', 'pro', 'pro_plus'
  )),  -- Free: unlimited joins, 0 creates; Pro: unlimited joins, 5 creates; Pro+: unlimited joins, 15 creates
  trust_score NUMERIC(3,2) DEFAULT 5.00,  -- Aggregate from ratings
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_city ON user_profiles(city);
CREATE INDEX idx_profiles_referral ON user_profiles(referral_code);

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

CREATE INDEX idx_credit_events_user ON credit_events(user_id, created_at DESC);
CREATE INDEX idx_credit_events_transaction ON credit_events(transaction_id);

-- Derived credit balances (updated by trigger)
CREATE TABLE user_credit_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  available NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (available >= 0),
  held NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (held >= 0),
  lifetime_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  lifetime_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger function to update balances
CREATE OR REPLACE FUNCTION update_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert balance record
  INSERT INTO user_credit_balances (user_id, available, held, lifetime_earned, lifetime_spent)
  VALUES (NEW.user_id, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Update based on event type
  CASE NEW.event_type
    WHEN 'signup_bonus', 'lend_completed', 'referral_bonus' THEN
      UPDATE user_credit_balances
      SET available = available + NEW.amount,
          lifetime_earned = lifetime_earned + NEW.amount,
          updated_at = now()
      WHERE user_id = NEW.user_id;
    
    WHEN 'borrow_spent' THEN
      UPDATE user_credit_balances
      SET lifetime_spent = lifetime_spent + ABS(NEW.amount),
          updated_at = now()
      WHERE user_id = NEW.user_id;
    
    WHEN 'hold_placed' THEN
      UPDATE user_credit_balances
      SET available = available - ABS(NEW.amount),
          held = held + ABS(NEW.amount),
          updated_at = now()
      WHERE user_id = NEW.user_id;
    
    WHEN 'hold_released' THEN
      UPDATE user_credit_balances
      SET held = held - ABS(NEW.amount),
          available = CASE
            WHEN NEW.hold_release_reason = 'transaction_completed' THEN available
            ELSE available + ABS(NEW.amount)
          END,
          updated_at = now()
      WHERE user_id = NEW.user_id;
    
    WHEN 'admin_adjustment' THEN
      UPDATE user_credit_balances
      SET available = available + NEW.amount,
          updated_at = now()
      WHERE user_id = NEW.user_id;
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_credit_balance
AFTER INSERT ON credit_events
FOR EACH ROW EXECUTE FUNCTION update_credit_balance();

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

CREATE INDEX idx_referrals_status ON referrals(status) WHERE status = 'pending';

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

CREATE INDEX idx_books_google_id ON books(google_books_id);
CREATE INDEX idx_books_title_search ON books USING gin(to_tsvector('english', title));

-- User's book library
CREATE TABLE user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id),
  reading_status TEXT DEFAULT 'want_to_read' CHECK (reading_status IN (
    'want_to_read', 'reading', 'completed'
  )),
  ownership TEXT DEFAULT 'owned' CHECK (ownership IN (
    'owned', 'wishlist', 'borrowed', 'lent_out'
  )),
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

CREATE INDEX idx_user_books_user ON user_books(user_id, created_at DESC);
CREATE INDEX idx_user_books_status ON user_books(user_id, reading_status);
CREATE INDEX idx_user_books_wishlist ON user_books(user_id) WHERE ownership = 'wishlist';

-- Reading Notes
CREATE TABLE reading_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_book_id UUID NOT NULL, -- Logical link to user_books (no FK to allow loose coupling if needed, but currently strictly tied)
  content TEXT NOT NULL,
  tag TEXT NOT NULL CHECK (tag IN ('quote', 'reflect', 'distill', 'apply')),
  page_number INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reading_notes_user_book ON reading_notes(user_book_id);
CREATE INDEX idx_reading_notes_user ON reading_notes(user_id);
CREATE INDEX idx_reading_notes_tag ON reading_notes(tag);
```

#### Migration 002: P2P Exchange

**⚠️ NOTE:** This migration file needs to be created at `supabase/migrations/002_exchange_schema.sql` before implementation. The SQL below represents the complete schema for this migration.

```sql
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
  city TEXT NOT NULL,  -- REQUIRED: For intra-city matching (extracted from owner's profile address)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_listings_active ON listings(status) WHERE status = 'active';
CREATE INDEX idx_listings_city ON listings(city);  -- CRITICAL: Used for intra-city filtering
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
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('porter', 'dunzo', 'meetup')),  -- UPDATED: Porter/Dunzo for intra-city
  delivery_service TEXT,  -- NEW: Stores which service was chosen ('porter' or 'dunzo'), NULL for meetup
  shipping_address_id UUID,
  message TEXT,
  payment_order_id TEXT,  -- Razorpay order ID for deposit
  payment_id TEXT,  -- Razorpay payment ID for deposit
  shipping_cost NUMERIC(10,2),  -- Paid directly to Porter/Dunzo (not via Razorpay)
  deposit_amount NUMERIC(10,2),  -- Refundable deposit (₹100-500) paid via Razorpay
  awb_number TEXT,  -- Tracking number from Porter/Dunzo
  tracking_url TEXT,  -- NEW: Real-time tracking link
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
  tags TEXT[],  -- ['fast_shipping', 'good_communication', 'book_as_described']
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
```

#### Migration 003: Venues & Clubs

**⚠️ NOTE:** This migration file needs to be created at `supabase/migrations/003_venues_clubs_schema.sql` before implementation. The SQL below represents the complete schema for this migration.

```sql
-- Venues
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_code TEXT UNIQUE,  -- BT-VEN-BLR-00001
  name TEXT NOT NULL,
  description TEXT,
  venue_type TEXT NOT NULL CHECK (venue_type IN (
    'cafe', 'library', 'coworking', 'bookstore', 'other'
  )),
  cover_url TEXT,
  photos TEXT[],
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  location GEOGRAPHY(POINT),
  operating_hours JSONB,  
  -- Format: {"monday": {"open": "09:00", "close": "21:00"}, ...}
  amenities TEXT[],  -- ['wifi', 'parking', 'food', 'power_outlets']
  max_capacity INTEGER,
  booking_required BOOLEAN DEFAULT false,
  owner_user_id UUID REFERENCES auth.users(id),
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'approved', 'rejected', 'suspended'
  )),
  is_exchange_partner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_venues_city ON venues(city);
CREATE INDEX idx_venues_status ON venues(verification_status);
CREATE INDEX idx_venues_location_gist ON venues USING gist(location);

-- Book Clubs
CREATE TABLE book_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  club_type TEXT NOT NULL CHECK (club_type IN ('public', 'approval', 'invite_only')),
  access_level TEXT DEFAULT 'all' CHECK (access_level IN ('all', 'pro', 'pro_plus')),
  meeting_type TEXT CHECK (meeting_type IN ('online_only', 'venue_based', 'hybrid')),  -- NEW: Club meeting format
  current_book_id UUID REFERENCES books(id),
  admin_id UUID REFERENCES auth.users(id),  -- RENAMED from lead_id
  member_count INTEGER DEFAULT 0,
  max_members INTEGER,  -- NULL = unlimited
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,  -- NEW: Track when club was archived
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clubs_type ON book_clubs(club_type);
CREATE INDEX idx_clubs_active ON book_clubs(is_archived) WHERE is_archived = false;

-- Club join questions
CREATE TABLE club_join_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  order_index INTEGER NOT NULL,
  CHECK (order_index >= 0)
);

CREATE INDEX idx_join_questions_club ON club_join_questions(club_id, order_index);

-- Join applications
CREATE TABLE club_join_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  answers JSONB NOT NULL,  -- {"question_id": "answer", ...}
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  decline_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, user_id)
);

CREATE INDEX idx_applications_pending ON club_join_applications(club_id, status) 
WHERE status = 'pending';

-- Club members
CREATE TABLE club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),  -- CHANGED: 'lead' → 'admin'
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'muted', 'banned')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, user_id)
);

CREATE INDEX idx_members_club ON club_members(club_id);
CREATE INDEX idx_members_user ON club_members(user_id);

-- Trigger to update member_count
CREATE OR REPLACE FUNCTION update_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE book_clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE book_clubs SET member_count = member_count - 1 WHERE id = OLD.club_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_member_count
AFTER INSERT OR DELETE ON club_members
FOR EACH ROW EXECUTE FUNCTION update_member_count();

-- Club ↔ Venue association
CREATE TABLE club_venues (
  club_id UUID REFERENCES book_clubs(id),
  venue_id UUID REFERENCES venues(id),
  is_primary BOOLEAN DEFAULT false,
  PRIMARY KEY (club_id, venue_id)
);

-- Book nominations & voting
CREATE TABLE book_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  book_id UUID REFERENCES books(id),
  nominated_by UUID REFERENCES auth.users(id),
  vote_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'selected', 'rejected')),
  voting_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, book_id, status) 
);

CREATE TABLE book_votes (
  nomination_id UUID REFERENCES book_nominations(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (nomination_id, user_id)
);

CREATE OR REPLACE FUNCTION update_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE book_nominations 
    SET vote_count = vote_count + 1 
    WHERE id = NEW.nomination_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE book_nominations 
    SET vote_count = vote_count - 1 
    WHERE id = OLD.nomination_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_vote_count
AFTER INSERT OR DELETE ON book_votes
FOR EACH ROW EXECUTE FUNCTION update_vote_count();
```

#### Migration 004: Terminology Update (Lead → Admin)

**⚠️ CRITICAL:** This migration file MUST be created at `supabase/migrations/004_rename_lead_to_admin.sql` before implementation. This is a breaking change that affects existing data.

**Purpose:** Rename "Lead" to "Admin" across all database objects for consistency with user-facing terminology.

**Manual Execution Required:** A standalone SQL script `manual_migration_lead_to_admin.sql` has been provided for manual execution. See the end of this document for the complete script.

```sql
-- Migration 004: Rename Lead to Admin
-- Date: 2024-01-XX
-- Description: Updates club leadership terminology from "Lead" to "Admin"

-- Step 1: Rename column in book_clubs table
ALTER TABLE book_clubs RENAME COLUMN lead_id TO admin_id;

-- Step 2: Update role enum values in club_members
UPDATE club_members SET role = 'admin' WHERE role = 'lead';

-- Step 3: Drop and recreate CHECK constraint with new enum values
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_role_check;
ALTER TABLE club_members ADD CONSTRAINT club_members_role_check
  CHECK (role IN ('member', 'moderator', 'admin'));

-- Step 4: Update any RLS policies referencing lead_id (if applicable)
-- Note: RLS policies will be updated in subsequent migrations as needed

-- Rollback Script (if needed):
-- ALTER TABLE book_clubs RENAME COLUMN admin_id TO lead_id;
-- UPDATE club_members SET role = 'lead' WHERE role = 'admin';
-- ALTER TABLE club_members DROP CONSTRAINT club_members_role_check;
-- ALTER TABLE club_members ADD CONSTRAINT club_members_role_check
--   CHECK (role IN ('member', 'moderator', 'lead'));
```

**Impact:**
- All existing clubs retain their leadership structure
- No data loss or corruption
- Frontend must update all references from "Lead" to "Admin"
- Edge Functions must use `admin_id` instead of `lead_id`

---

#### Migration 005: Chat & Moderation

**⚠️ NOTE:** This migration file needs to be created at `supabase/migrations/005_chat_moderation_schema.sql` before implementation. The SQL below represents the complete schema for this migration.

```sql
-- Club messages
CREATE TABLE club_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  chapter_tag INTEGER,  -- NULL if not chapter-specific
  has_spoiler BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deleted_by UUID REFERENCES auth.users(id),
  deleted_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_club ON club_messages(club_id, created_at DESC);
CREATE INDEX idx_messages_chapter ON club_messages(club_id, chapter_tag);

-- Message reactions
CREATE TABLE message_reactions (
  message_id UUID REFERENCES club_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Club events
CREATE TABLE club_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT CHECK (event_type IN ('offline', 'online')),
  venue_id UUID REFERENCES venues(id),
  location_address TEXT,
  meeting_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  max_attendees INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_club ON club_events(club_id, starts_at);
CREATE INDEX idx_events_upcoming ON club_events(starts_at) 
WHERE starts_at > now();

-- Event RSVPs
CREATE TABLE club_event_rsvps (
  event_id UUID REFERENCES club_events(id),
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Reading schedules
CREATE TABLE reading_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  book_id UUID REFERENCES books(id),
  milestones JSONB NOT NULL,  
  -- [{"chapter": 1, "due_date": "2024-01-15", "title": "Intro"}, ...]
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Member progress
CREATE TABLE member_progress (
  club_id UUID REFERENCES book_clubs(id),
  user_id UUID REFERENCES auth.users(id),
  book_id UUID REFERENCES books(id),
  chapters_completed INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (club_id, user_id, book_id)
);

-- Moderation: complaints
CREATE TABLE club_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  reporter_id UUID REFERENCES auth.users(id),
  reported_user_id UUID REFERENCES auth.users(id),
  message_id UUID REFERENCES club_messages(id),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'reviewing', 'resolved', 'dismissed'
  )),
  resolved_by UUID REFERENCES auth.users(id),
  resolution_action TEXT,  -- 'warned', 'muted', 'banned', 'no_action'
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_complaints_status ON club_complaints(status);
CREATE INDEX idx_complaints_club ON club_complaints(club_id);

-- Moderation: actions
CREATE TABLE club_member_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT CHECK (action_type IN (
    'warning', 'mute', 'ban', 'unmute', 'unban'
  )),
  reason TEXT,
  duration_hours INTEGER,  -- NULL for permanent or warnings
  expires_at TIMESTAMPTZ,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_actions_active_mutes ON club_member_actions(club_id, user_id, expires_at)
WHERE action_type = 'mute' AND (expires_at IS NULL OR expires_at > now());

-- Push tokens
CREATE TABLE user_push_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 Row-Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- user_profiles
CREATE POLICY "Public profiles viewable by all" 
  ON user_profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update own profile" 
  ON user_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- credit_events
CREATE POLICY "Users can view own credit events" 
  ON credit_events FOR SELECT 
  USING (auth.uid() = user_id);

-- Note: INSERT restricted to Edge Functions via service_role key

-- listings
CREATE POLICY "Users can view listings in their city"
  ON listings FOR SELECT
  USING (
    (status = 'active' AND city = (
      SELECT city FROM user_profiles WHERE user_id = auth.uid()
    ))
    OR owner_id = auth.uid()
  );

CREATE POLICY "Owners can manage their listings"
  ON listings FOR ALL
  USING (owner_id = auth.uid());

-- transactions
CREATE POLICY "Participants can view their transactions" 
  ON transactions FOR SELECT 
  USING (lender_id = auth.uid() OR borrower_id = auth.uid());

CREATE POLICY "Participants can update transaction status" 
  ON transactions FOR UPDATE 
  USING (lender_id = auth.uid() OR borrower_id = auth.uid());

-- club_messages
CREATE POLICY "Club members can view messages" 
  ON club_messages FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM club_members 
      WHERE club_id = club_messages.club_id 
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Active members can send messages" 
  ON club_messages FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members 
      WHERE club_id = club_messages.club_id 
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Additional policies for other tables follow similar patterns...
```

---

## 5. Design System (MVP Approach)

**Note:** The Atmospheric Theme Engine (time-based theme switching) has been **deferred to Phase 2**. See Appendix A for full implementation details.

### 5.1 MVP Theme Configuration

For the 8-week MVP, BookTalks uses a single, consistent theme based on the "Daylight" color palette:

```javascript
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic color tokens (easy to swap in Phase 2)
        'bg-primary': '#F8FAFC',      // Pale Slate
        'bg-card': '#FFFFFF',          // Pure White
        'bg-secondary': '#F1F5F9',     // Slate 100
        'text-primary': '#0F172A',     // Slate 900
        'text-secondary': '#64748B',   // Slate 500
        'text-muted': '#94A3B8',       // Slate 400
        'accent': '#6366F1',           // Indigo 500
        'accent-hover': '#4F46E5',     // Indigo 600
        'accent-light': '#E0E7FF',     // Indigo 100
        'success': '#10B981',          // Green 500
        'warning': '#F59E0B',          // Amber 500
        'error': '#EF4444',            // Red 500
        'border': '#E2E8F0',           // Slate 200
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'serif': ['Merriweather', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
```

### 5.2 Component Usage Pattern

```tsx
import { View, Text } from 'react-native';

export function BookCard() {
  return (
    <View className="bg-card rounded-lg shadow-md p-4 border border-border">
      <Text className="text-primary text-lg font-semibold">
        Book Title
      </Text>
      <Text className="text-secondary text-sm mt-1">
        Author Name
      </Text>
    </View>
  );
}
```

**Benefits of Semantic Tokens:**
- Easy to swap color values in Phase 2 without changing components
- Consistent design language across the app
- Accessibility-friendly (WCAG AA compliant)
- Dark mode ready (just swap token values)

---

## 5.3 Phase 2: Atmospheric Theme Engine (Deferred)

**See Appendix A** at the end of this document for the complete Atmospheric Theme Engine implementation, including:
- Time-based theme switching (Daylight, Golden Hour, Midnight)
- ThemeContext Provider architecture
- Automatic phase detection and transitions
- Manual theme override functionality

---

## 6. Edge Functions (Detailed Implementation)

### 6.1 Payment Order Creation
```typescript
// supabase/functions/create-payment-order/index.ts
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const rzp = new Razorpay({
  key_id: Deno.env.get('RZP_KEY_ID')!,
  key_secret: Deno.env.get('RZP_KEY_SECRET')!,
});

Deno.serve(async (req) => {
  try {
    const { transaction_id } = await req.json();
    
    // Fetch transaction details
    const { data: txn, error } = await supabase
      .from('transactions')
      .select('*, listing:listings(book:books(title))')
      .eq('id', transaction_id)
      .single();
    
    if (error) throw error;

    // Calculate deposit amount (refundable)
    // NOTE: Delivery cost is paid separately to Porter/Dunzo, not via Razorpay
    const deposit = calculateDeposit(txn.listing.condition); // ₹100-500 based on condition

    function calculateDeposit(condition: string): number {
      const depositMap = {
        'new': 500,
        'like_new': 400,
        'good': 300,
        'acceptable': 200,
        'poor': 100,
      };
      return depositMap[condition] || 200;
    }

    // Create Razorpay order (deposit only)
    const order = await rzp.orders.create({
      amount: deposit * 100, // Razorpay expects paise
      currency: 'INR',
      receipt: `TXN_${transaction_id}`,
      notes: {
        transaction_id,
        borrower_id: txn.borrower_id,
        book_title: txn.listing.book.title,
        type: 'refundable_deposit',
      },
    });

    // Update transaction with order ID
    await supabase
      .from('transactions')
      .update({
        payment_order_id: order.id,
        deposit_amount: deposit,
      })
      .eq('id', transaction_id);

    return new Response(JSON.stringify(order), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### 6.2 Transaction Completion (Atomic Credit Transfer)
```typescript
// supabase/functions/complete-transaction/index.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    const { transaction_id } = await req.json();
    
    // Begin atomic transaction
    const { data: txn, error: txnError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();
    
    if (txnError) throw txnError;

    // Insert credit events (trigger will update balances)
    const { error: eventsError } = await supabase
      .from('credit_events')
      .insert([
        {
          user_id: txn.lender_id,
          event_type: 'lend_completed',
          amount: 1.0,
          transaction_id,
        },
        {
          user_id: txn.borrower_id,
          event_type: 'borrow_spent',
          amount: -1.0,
          transaction_id,
        },
        {
          user_id: txn.borrower_id,
          event_type: 'hold_released',
          amount: -1.0,
          transaction_id,
          hold_release_reason: 'transaction_completed',
        },
      ]);

    if (eventsError) throw eventsError;

    // Update transaction status
    await supabase
      .from('transactions')
      .update({ status: 'completed' })
      .eq('id', transaction_id);

    // Transfer book ownership
    const { error: ownershipError } = await supabase
      .from('user_books')
      .update({
        user_id: txn.borrower_id,
        ownership: 'owned',
      })
      .eq('id', txn.listing.user_book_id);

    if (ownershipError) throw ownershipError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## 7. Performance Optimizations

### 7.1 Image Caching
```typescript
// src/components/ui/BookCover.tsx
import { Image, ImageContentFit } from 'expo-image';

interface BookCoverProps {
  uri: string;
  size?: 'small' | 'medium' | 'large';
}

const SIZES = {
  small: { width: 60, height: 90 },
  medium: { width: 100, height: 150 },
  large: { width: 200, height: 300 },
};

export function BookCover({ uri, size = 'medium' }: BookCoverProps) {
  return (
    <Image
      source={{ uri }}
      style={SIZES[size]}
      contentFit="cover"
      cachePolicy="memory-disk"  // Aggressive caching
      recyclingKey={uri}  // Reuse images across components
      placeholder={require('@/assets/book-placeholder.png')}
      transition={200}
    />
  );
}
```

### 7.2 List Virtualization
```typescript
<FlatList
  data={books}
  renderItem={renderBookCard}
  keyExtractor={(item) => item.id}
  
  // Performance optimizations
  windowSize={5}  // Number of screens to render
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  removeClippedSubviews={true}
  
  // For uniform item heights
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### 7.3 Query Optimizations
```typescript
// src/hooks/useInfiniteListings.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { listingsService } from '@/features/exchange/api/listingsService';

export function useInfiniteListings(filters) {
  return useInfiniteQuery({
    queryKey: ['listings', filters],
    queryFn: ({ pageParam = 0 }) => 
      listingsService.getListings({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 5 * 60 * 1000,  // 5 minutes
    cacheTime: 10 * 60 * 1000,  // 10 minutes
  });
}
```

---

## 8. Security Best Practices

### 8.1 Environment Variables
```bash
# .env.example
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Public
SUPABASE_SERVICE_ROLE_KEY=***  # Never expose to client
RZP_KEY_ID=rzp_test_***
RZP_KEY_SECRET=***
PORTER_API_KEY=***  # Porter delivery service
DUNZO_API_KEY=***  # Dunzo delivery service
DUNZO_CLIENT_ID=***  # Dunzo client ID
GOOGLE_BOOKS_API_KEY=***  # Optional (public API)
GOOGLE_MAPS_API_KEY=***  # For geocoding and places
```

### 8.2 API Key Rotation
- Rotate Supabase service role key quarterly
- Razorpay keys rotated on security incidents
- All keys stored in EAS Secrets (encrypted)

### 8.3 Input Validation
```typescript
// src/utils/validation.ts
import { z } from 'zod';

export const createListingSchema = z.object({
  condition: z.enum(['new', 'like_new', 'good', 'acceptable', 'poor']),
  condition_notes: z.string().max(200),
  photos: z.array(z.string().url()).min(2).max(5),
  delivery_options: z.array(z.enum(['shipping', 'meet_in_person'])).min(1),
});

// Usage in component
const { handleSubmit, formState } = useForm({
  resolver: zodResolver(createListingSchema),
});
```

---

## 9. Deployment & CI/CD

### 9.1 EAS Build Configuration
```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "APP_ENV": "staging"
      }
    },
    "production": {
      "channel": "production",
      "env": {
        "APP_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "apple@booktalks.in",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCDE12345"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
```

### 9.2 GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test & Build

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npx tsc --noEmit
```

---

## 10. Monitoring & Analytics

### 10.1 Error Tracking (Sentry)
```typescript
// app/_layout.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://***@sentry.io/***',
  environment: process.env.APP_ENV,
  tracesSampleRate: 0.1,  // 10% of transactions
});

export default function RootLayout() {
  return (
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      {/* App content */}
    </Sentry.ErrorBoundary>
  );
}
```

### 10.2 Analytics Events
```typescript
// src/services/analyticsService.ts
import mixpanel from 'mixpanel-react-native';

export const analytics = {
  init: () => mixpanel.init(process.env.MIXPANEL_TOKEN!),
  
  trackEvent: (name: string, properties?: Record<string, any>) => {
    mixpanel.track(name, properties);
  },
  
  identify: (userId: string) => {
    mixpanel.identify(userId);
  },
};

// Usage
analytics.trackEvent('Book Listed', {
  book_id: '123',
  condition: 'good',
  delivery_options: ['shipping', 'meet'],
});
```

---

## 11. Testing Strategy

### 11.1 Unit Tests
```typescript
// src/utils/__tests__/format.test.ts
import { formatCurrency } from '../format';

describe('formatCurrency', () => {
  it('formats Indian currency correctly', () => {
    expect(formatCurrency(100)).toBe('₹100.00');
    expect(formatCurrency(1500.5)).toBe('₹1,500.50');
  });
});
```

### 11.2 Integration Tests
```typescript
// src/features/books/__tests__/addToLibrary.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useLibrary } from '../hooks/useLibrary';

describe('Add to Library', () => {
  it('adds book and updates cache', async () => {
    const { result } = renderHook(() => useLibrary());
    
    await waitFor(() => {
      result.current.addBook.mutate({
        google_books_id: 'test123',
        title: 'Test Book',
      });
    });

    expect(result.current.library).toContainEqual(
      expect.objectContaining({ title: 'Test Book' })
    );
  });
});
```

---

## 12. Scalability Considerations

### 12.1 Database Indexing Strategy
- Primary keys: UUID v4 (random, no hotspots)
- Geospatial queries: PostGIS GIST indexes
- Text search: GIN indexes on tsvector columns
- Covering indexes for common query patterns

### 12.2 Caching Strategy
- **Client-side** (TanStack Query): 5-10 minute staleTime for lists
- **CDN** (Supabase Storage): Book covers, venue photos
- **Edge Function** (Deno Deploy): Response caching for static data

### 12.3 Database Partitioning (Future)
- Partition `credit_events` by created_at (monthly)
- Partition `club_messages` by created_at (quarterly)
- Enables efficient archival and faster queries

---

## Appendix: Technology Justifications

### Why Expo over bare React Native?
- **EAS Build/Submit**: Eliminates macOS requirement for iOS builds
- **Over-the-Air Updates**: Critical bug fixes without app store review
- **expo-image**: Superior performance over react-native-fast-image
- **Expo Router**: Type-safe navigation, faster than React Navigation setup

### Why Zustand over Redux?
- **Simplicity**: No boilerplate, smaller bundle size
- **Performance**: No unnecessary re-renders
- **TypeScript**: Better type inference
- **Use Case**: Auth and theme are simple global state, not complex reducers

### Why TanStack Query?
- **Server State Expertise**: Built specifically for async data
- **Caching**: Automatic background refetching, stale-while-revalidate
- **Offline Support**: Built-in persistence layer
- **DevTools**: Excellent debugging experience

### Why Supabase over Firebase?
- **PostgreSQL**: Relational data model fits book exchanges better than NoSQL
- **RLS**: Row-level security easier than Firestore rules
- **SQL**: Direct database access for complex queries
- **Open Source**: Self-hostable if needed

### Why NativeWind over Styled-Components?
- **Performance**: Static extraction, no runtime cost
- **Familiarity**: Tailwind syntax widely known
- **Atmospheric Themes**: Easy to swap entire color palettes

---

**End of Architecture Document**

This document should be treated as a living specification and updated as the project evolves.
