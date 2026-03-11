# BookTalks Mobile - Complete Technical Architecture

> **Historical architecture note (2026-03-06):** This document contains valuable design context,
> but its embedded migration inventory and many inline SQL blocks are not the canonical live database reference.
> For live schema truth, use `docs/audits/LIVE_SCHEMA_RECONCILIATION_2026-03-06.md` and
> `supabase/migrations/LIVE_MIGRATION_HISTORY_2026-03-06.md`.

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
- **React Native**: Via Expo SDK 54 (~54.0.30)
- **Expo Router**: File-based routing (v6+)
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

**Edge Functions** (Deno runtime) — 10 total functions:
**Critical Priority (5):**
- `create-payment-order`: Razorpay order creation for deposits
- `verify-payment`: Razorpay webhook handler (HMAC verification)
- `book-shipment`: Porter/Dunzo API integration for delivery
- `complete-transaction`: Atomic credit transfer (3 events)
- `transfer-credits`: Manual credit operations (admin)

**High Priority (3):**
- `wishlist-notify`: Listing match notifications (database trigger)
- `check-membership-limits`: Club creation tier limits enforcement
- `send-notification`: Firebase Cloud Messaging push notifications

**Medium Priority (2):**
- `refund-deposit`: Razorpay refund processing
- `moderate-content`: Auto-moderation (profanity, spam detection)

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

**Status Legend:**
- ✅ = Fully implemented and tested
- 🟡 = Partially implemented or in progress
- ❌ = Not yet implemented (planned)

```
booktalks-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               ✅  Root layout (auth guard)
│   ├── index.tsx                 ✅  Root redirect logic
│   ├── (auth)/                   ✅  Auth group (guest-only)
│   │   ├── _layout.tsx           ✅
│   │   ├── login.tsx             ✅
│   │   ├── verify-otp.tsx        ✅
│   │   └── setup-profile.tsx     ✅
│   ├── (tabs)/                   🟡  Main app (authenticated)
│   │   ├── _layout.tsx           ✅  Tab bar navigation
│   │   ├── library/              ✅  Book library feature
│   │   │   ├── index.tsx         ✅
│   │   │   ├── search.tsx        ✅
│   │   │   ├── _layout.tsx       ✅
│   │   │   ├── notes.tsx         ✅
│   │   │   └── [bookId].tsx      ✅  Book detail (dynamic route)
│   │   ├── exchange/             ❌  P2P exchange feature
│   │   │   ├── index.tsx         ❌  Browse listings
│   │   │   ├── create.tsx        ❌  Create listing
│   │   │   └── [transactionId].tsx ❌
│   │   ├── clubs/                ❌  Book clubs feature
│   │   │   ├── index.tsx         ❌
│   │   │   ├── [clubId]/         ❌
│   │   │   │   ├── index.tsx     ❌  Club detail + chat
│   │   │   │   ├── members.tsx   ❌
│   │   │   │   └── settings.tsx  ❌
│   │   └── profile/              ❌  User profile feature
│   │       ├── index.tsx         ❌
│   │       ├── credits.tsx       ❌  Credit history
│   │       └── settings.tsx      ❌
│   └── +not-found.tsx            ✅  404 fallback
│
├── src/
│   ├── assets/                   ❌  Images, fonts, icons
│   │   ├── images/               ❌
│   │   ├── fonts/                ❌
│   │   └── icons/                ❌
│   │
│   ├── components/               🟡  Shared UI components
│   │   ├── ui/                   🟡  Primitive components
│   │   │   ├── AtmosphericBackground.tsx ✅
│   │   │   ├── OfflineBanner.tsx ✅
│   │   │   ├── Button.tsx        ❌
│   │   │   ├── Input.tsx         ❌
│   │   │   ├── Card.tsx          ❌
│   │   │   └── Modal.tsx         ❌
│   │   ├── layout/               ❌  Layout components
│   │   │   ├── Screen.tsx        ❌
│   │   │   ├── Header.tsx        ❌
│   │   │   └── TabBar.tsx        ❌
│   │   ├── library/              ✅  Library-specific components
│   │   │   ├── ConditionPicker.tsx ✅
│   │   │   ├── DeleteBookModal.tsx ✅
│   │   │   ├── OwnershipSelector.tsx ✅
│   │   │   ├── RatingInput.tsx   ✅
│   │   │   └── StatusSelector.tsx ✅
│   │   ├── search/               ✅  Search-specific components
│   │   │   ├── BookCard.tsx      ✅
│   │   │   ├── FilterModal.tsx   ✅
│   │   │   ├── GenreTag.tsx      ✅
│   │   │   ├── SearchBar.tsx     ✅
│   │   │   ├── SearchSuggestions.tsx ✅
│   │   │   ├── SortModal.tsx     ✅
│   │   │   └── WishlistButton.tsx ✅
│   │   ├── notes/                ✅  Notes-specific components
│   │   │   ├── NoteCard.tsx      ✅
│   │   │   ├── NoteEditor.tsx    ✅
│   │   │   ├── NotesList.tsx     ✅
│   │   │   └── TagSelector.tsx   ✅
│   │   └── feedback/             ❌  Loading, errors, empty states
│   │       ├── Skeleton.tsx      ❌
│   │       ├── ErrorBoundary.tsx ❌
│   │       └── EmptyState.tsx    ❌
│   │
│   ├── features/                 🟡  Domain feature modules
│   │   ├── auth/                 ✅  Authentication feature
│   │   │   ├── services/         ✅  Supabase auth calls
│   │   │   ├── hooks/            ✅  Auth-specific hooks
│   │   │   └── types.ts          ✅
│   │   │
│   │   ├── books/                ✅  Books/library feature
│   │   │   ├── services/         ✅  Google Books & library services
│   │   │   └── types.ts          ✅
│   │   │
│   │   ├── exchange/             ❌  P2P exchange feature
│   │   │   ├── api/              ❌  Listings & transactions services
│   │   │   ├── hooks/            ❌  Exchange-specific hooks
│   │   │   ├── components/       ❌  Exchange UI components
│   │   │   ├── store/            ❌  Complex UI state (Zustand)
│   │   │   └── types.ts          ❌
│   │   │
│   │   ├── clubs/                ❌  Book clubs feature
│   │   │   ├── api/              ❌  Clubs & messages services
│   │   │   ├── hooks/            ❌  Clubs-specific hooks
│   │   │   ├── components/       ❌  Clubs UI components
│   │   │   └── types.ts          ❌
│   │   │
│   │   ├── venues/               ❌  Venues feature
│   │   │   ├── api/              ❌  Venues service
│   │   │   ├── hooks/            ❌  Venues-specific hooks
│   │   │   ├── components/       ❌  Venues UI components
│   │   │   └── types.ts          ❌
│   │   │
│   │   └── credits/              ❌  Credits system feature
│   │       ├── api/              ❌  Credits service
│   │       ├── hooks/            ❌  Credits-specific hooks
│   │       ├── components/       ❌  Credits UI components
│   │       └── types.ts          ❌
│   │
│   ├── hooks/                    🟡  Global shared hooks
│   │   ├── useTheme.ts           ✅  Atmospheric theme logic
│   │   ├── useDebounce.ts        ✅  Search optimization
│   │   ├── useNetworkStatus.ts   ✅  Network status detection
│   │   ├── useRecentSearches.ts  ✅  Recent searches management
│   │   ├── useWishlist.ts        ✅  Wishlist management
│   │   ├── useAtmosphericTheme.ts ✅  Atmospheric theme hook
│   │   └── useLocation.ts        ❌  City geolocation
│   │
│   ├── lib/                      🟡  Third-party configs
│   │   ├── supabase.ts           ✅  Supabase client init
│   │   ├── constants.ts          ✅  App constants
│   │   ├── queryClient.ts        ❌  TanStack Query setup
│   │   └── mmkv.ts               ❌  MMKV storage instance
│   │
│   ├── store/                    🟡  Global state stores
│   │   └── themeStore.ts         ✅  Theme state (Zustand)
│   │
│   ├── services/                 ❌  Global shared services
│   │   ├── uploadService.ts      ❌  Supabase storage uploads
│   │   └── notificationService.ts ❌
│   │
│   ├── types/                    🟡  Global TypeScript types
│   │   ├── nativewind-env.d.ts   ✅  NativeWind types
│   │   ├── database.ts           ❌  Supabase-generated types
│   │   ├── api.ts                ❌  External API types
│   │   └── index.ts              ❌
│   │
│   └── utils/                    🟡  Helper functions
│       ├── format.ts             ❌  Date, currency formatters
│       ├── validation.ts         ❌  Zod schemas
│       └── constants.ts          ✅  App constants
│
├── supabase/                     ❌  Supabase backend code
│   ├── migrations/               🟡  SQL schema files
│   │   ├── 20260101105319_create_user_wishlist.sql ✅  Live-versioned wishlist migration
│   │   ├── 20260212150120_create_reading_notes.sql ✅  Live-versioned reading notes migration
│   │   └── LIVE_MIGRATION_HISTORY_2026-03-06.md ✅  Canonical live migration manifest
│   │
│   ├── functions/                ❌  Edge Functions (Deno)
│   │   ├── create-payment-order/ ❌  Razorpay order creation
│   │   ├── verify-payment/       ❌  Razorpay webhook handler
│   │   ├── book-shipment/        ❌  Porter/Dunzo integration
│   │   ├── complete-transaction/ ❌  Atomic credit transfer
│   │   ├── transfer-credits/     ❌  Manual credit operations
│   │   ├── wishlist-notify/      ❌  Listing match notifications
│   │   ├── check-membership-limits/ ❌  Club tier enforcement
│   │   ├── send-notification/    ❌  FCM push notifications
│   │   ├── refund-deposit/       ❌  Razorpay refund processing
│   │   └── moderate-content/     ❌  Auto-moderation
│   │
│   └── seed.sql                  ❌  Dev/test data
│
├── docs/                         ✅  Documentation
│   ├── README.md                 ✅
│   ├── ARCHITECTURE.md           ✅
│   ├── DATABASE.md               ✅
│   ├── architecture_react_expo.md ✅
│   └── (other docs)              ✅
│
├── .env.example                  ✅  Environment variables template
├── app.json                      ✅  Expo configuration
├── eas.json                      ❌  EAS Build configuration
├── babel.config.js               ✅
├── tailwind.config.js            ✅  NativeWind theme extension
├── tsconfig.json                 ✅
└── package.json                  ✅
```

**Implementation Summary:**
- **Total Files:** 120+ planned
- **Implemented:** ~35 files (29%)
- **In Progress:** ~15 files (13%)
- **Not Started:** ~70 files (58%)

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
  idempotency_key TEXT UNIQUE,  -- Prevents duplicate credit operations
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_events_user ON credit_events(user_id, created_at DESC);
CREATE INDEX idx_credit_events_transaction ON credit_events(transaction_id);

-- RLS: credit_events is LOCKED DOWN
-- INSERT: WITH CHECK (false) - only SECURITY DEFINER functions can insert
-- UPDATE: USING (false) - append-only, no modifications
-- DELETE: USING (false) - append-only, no deletions
-- SELECT: Users can view their own credit events

-- Derived credit balances (regular table, updated in real-time by trigger)
-- NOTE: This is a TABLE (not a materialized view) for real-time updates
-- Materialized views require periodic REFRESH (introduces lag)
-- Table + trigger provides immediate balance reflection (critical for UX)
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

-- =====================================================
-- TRANSACTION STATE MACHINE & ATOMIC CREDIT FUNCTIONS
-- All are SECURITY DEFINER (bypass RLS, elevated privileges)
-- =====================================================

-- Enforces valid state transitions with role-based checks
CREATE OR REPLACE FUNCTION transition_transaction_status(
  p_transaction_id UUID,
  p_new_status TEXT,
  p_actor_id UUID
)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn transactions;
  v_current_status TEXT;
  v_allowed_transitions TEXT[];
BEGIN
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction % not found', p_transaction_id; END IF;
  IF v_txn.lender_id != p_actor_id AND v_txn.borrower_id != p_actor_id THEN
    RAISE EXCEPTION 'Actor % is not a participant in transaction %', p_actor_id, p_transaction_id;
  END IF;

  v_current_status := v_txn.status;
  CASE v_current_status
    WHEN 'requested' THEN v_allowed_transitions := ARRAY['approved', 'declined'];
    WHEN 'approved' THEN v_allowed_transitions := ARRAY['cancelled', 'payment_pending'];
    WHEN 'payment_pending' THEN v_allowed_transitions := ARRAY['cancelled', 'ready_to_ship'];
    WHEN 'ready_to_ship' THEN v_allowed_transitions := ARRAY['cancelled', 'shipped'];
    WHEN 'shipped' THEN v_allowed_transitions := ARRAY['delivered'];
    WHEN 'delivered' THEN v_allowed_transitions := ARRAY['completed', 'disputed'];
    WHEN 'disputed' THEN v_allowed_transitions := ARRAY['completed'];
    ELSE v_allowed_transitions := ARRAY[]::TEXT[];
  END CASE;

  IF NOT (p_new_status = ANY(v_allowed_transitions)) THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', v_current_status, p_new_status;
  END IF;

  -- Role-based checks
  CASE
    WHEN p_new_status IN ('approved','declined','shipped') AND p_actor_id != v_txn.lender_id THEN
      RAISE EXCEPTION 'Only the lender can perform this action';
    WHEN p_new_status IN ('payment_pending','delivered') AND p_actor_id != v_txn.borrower_id THEN
      RAISE EXCEPTION 'Only the borrower can perform this action';
    ELSE NULL;
  END CASE;

  UPDATE transactions SET status = p_new_status, updated_at = now()
  WHERE id = p_transaction_id RETURNING * INTO v_txn;
  RETURN v_txn;
END;
$$;

-- Atomically completes a transaction: release hold → debit borrower → credit lender → set completed
CREATE OR REPLACE FUNCTION complete_transaction(
  p_transaction_id UUID,
  p_actor_id UUID
)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn transactions;
  v_hold_event credit_events;
BEGIN
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction % not found', p_transaction_id; END IF;
  IF v_txn.status NOT IN ('delivered', 'disputed') THEN
    RAISE EXCEPTION 'Cannot complete transaction in status %', v_txn.status;
  END IF;
  IF v_txn.lender_id != p_actor_id AND v_txn.borrower_id != p_actor_id THEN
    RAISE EXCEPTION 'Actor is not a participant';
  END IF;

  SELECT * INTO v_hold_event FROM credit_events
  WHERE transaction_id = p_transaction_id AND event_type = 'hold_placed' AND user_id = v_txn.borrower_id
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hold_placed event found'; END IF;

  -- Step 1: Release hold (hold → spent, NOT back to available)
  INSERT INTO credit_events (user_id, event_type, amount, transaction_id, hold_release_reason, metadata, idempotency_key)
  VALUES (v_txn.borrower_id, 'hold_released', v_hold_event.amount, p_transaction_id,
    'transaction_completed', jsonb_build_object('completed_by', p_actor_id),
    'complete_hold_release_' || p_transaction_id::text);

  -- Step 2: Debit borrower
  INSERT INTO credit_events (user_id, event_type, amount, transaction_id, metadata, idempotency_key)
  VALUES (v_txn.borrower_id, 'borrow_spent', ABS(v_hold_event.amount), p_transaction_id,
    jsonb_build_object('completed_by', p_actor_id),
    'complete_borrow_spent_' || p_transaction_id::text);

  -- Step 3: Credit lender (1 credit per exchange)
  INSERT INTO credit_events (user_id, event_type, amount, transaction_id, metadata, idempotency_key)
  VALUES (v_txn.lender_id, 'lend_completed', 1, p_transaction_id,
    jsonb_build_object('borrower_id', v_txn.borrower_id),
    'complete_lend_credit_' || p_transaction_id::text);

  -- Step 4: Update status
  UPDATE transactions SET status = 'completed', updated_at = now()
  WHERE id = p_transaction_id RETURNING * INTO v_txn;
  RETURN v_txn;
END;
$$;

-- Atomically cancels a transaction: release hold (back to available) → set cancelled
CREATE OR REPLACE FUNCTION cancel_transaction(
  p_transaction_id UUID,
  p_actor_id UUID
)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn transactions;
  v_hold_event credit_events;
BEGIN
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction % not found', p_transaction_id; END IF;
  IF v_txn.status NOT IN ('approved', 'payment_pending', 'ready_to_ship') THEN
    RAISE EXCEPTION 'Cannot cancel transaction in status %', v_txn.status;
  END IF;
  IF v_txn.lender_id != p_actor_id AND v_txn.borrower_id != p_actor_id THEN
    RAISE EXCEPTION 'Actor is not a participant';
  END IF;

  SELECT * INTO v_hold_event FROM credit_events
  WHERE transaction_id = p_transaction_id AND event_type = 'hold_placed' AND user_id = v_txn.borrower_id
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    INSERT INTO credit_events (user_id, event_type, amount, transaction_id, hold_release_reason, metadata, idempotency_key)
    VALUES (v_txn.borrower_id, 'hold_released', v_hold_event.amount, p_transaction_id,
      'transaction_cancelled', jsonb_build_object('cancelled_by', p_actor_id),
      'cancel_hold_release_' || p_transaction_id::text);
  END IF;

  UPDATE transactions SET status = 'cancelled', updated_at = now()
  WHERE id = p_transaction_id RETURNING * INTO v_txn;
  RETURN v_txn;
END;
$$;

-- =====================================================
-- PHASE B: ATOMIC CREDIT & TRANSACTION REQUEST FUNCTIONS
-- All are SECURITY DEFINER (bypass RLS, elevated privileges)
-- =====================================================

-- Idempotent signup bonus grant (1 credit)
CREATE OR REPLACE FUNCTION grant_signup_bonus(p_user_id UUID)
RETURNS credit_events
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_event credit_events;
BEGIN
  SELECT * INTO v_event FROM credit_events
  WHERE idempotency_key = 'signup_bonus_' || p_user_id::text;
  IF FOUND THEN RETURN v_event; END IF;

  INSERT INTO credit_events (user_id, event_type, amount, metadata, idempotency_key)
  VALUES (p_user_id, 'signup_bonus', 1,
    jsonb_build_object('granted_at', now()),
    'signup_bonus_' || p_user_id::text)
  RETURNING * INTO v_event;
  RETURN v_event;
END;
$$;

-- Atomic credit hold: locks balance FOR UPDATE, validates available >= amount
CREATE OR REPLACE FUNCTION place_hold(
  p_user_id UUID, p_transaction_id UUID, p_amount NUMERIC DEFAULT 1
)
RETURNS credit_events
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_balance user_credit_balances; v_event credit_events;
BEGIN
  SELECT * INTO v_event FROM credit_events
  WHERE idempotency_key = 'hold_placed_' || p_transaction_id::text;
  IF FOUND THEN RETURN v_event; END IF;

  SELECT * INTO v_balance FROM user_credit_balances
  WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No balance for user %', p_user_id; END IF;
  IF v_balance.available < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: available=%, required=%', v_balance.available, p_amount;
  END IF;

  INSERT INTO credit_events (user_id, event_type, amount, transaction_id, metadata, idempotency_key)
  VALUES (p_user_id, 'hold_placed', p_amount, p_transaction_id,
    jsonb_build_object('held_at', now()),
    'hold_placed_' || p_transaction_id::text)
  RETURNING * INTO v_event;
  RETURN v_event;
END;
$$;

-- Release a held credit (reason determines if credits return to available or stay spent)
CREATE OR REPLACE FUNCTION release_hold(
  p_transaction_id UUID, p_actor_id UUID, p_reason TEXT
)
RETURNS credit_events
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_hold_event credit_events; v_event credit_events;
BEGIN
  SELECT * INTO v_event FROM credit_events
  WHERE idempotency_key = 'hold_released_' || p_reason || '_' || p_transaction_id::text;
  IF FOUND THEN RETURN v_event; END IF;

  SELECT * INTO v_hold_event FROM credit_events
  WHERE transaction_id = p_transaction_id AND event_type = 'hold_placed'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hold for txn %', p_transaction_id; END IF;

  INSERT INTO credit_events (user_id, event_type, amount, transaction_id, hold_release_reason, metadata, idempotency_key)
  VALUES (v_hold_event.user_id, 'hold_released', v_hold_event.amount, p_transaction_id, p_reason,
    jsonb_build_object('released_by', p_actor_id, 'released_at', now()),
    'hold_released_' || p_reason || '_' || p_transaction_id::text)
  RETURNING * INTO v_event;
  RETURN v_event;
END;
$$;

-- Atomic transaction request: validate listing + create txn + hold credit + record event
CREATE OR REPLACE FUNCTION request_transaction(
  p_listing_id UUID, p_borrower_id UUID, p_delivery_type TEXT,
  p_message TEXT DEFAULT NULL, p_shipping_address_id UUID DEFAULT NULL
)
RETURNS transactions
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_listing listings; v_balance user_credit_balances; v_txn transactions;
BEGIN
  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing % not found', p_listing_id; END IF;
  IF v_listing.status != 'active' THEN RAISE EXCEPTION 'Listing not active: %', v_listing.status; END IF;
  IF v_listing.owner_id = p_borrower_id THEN RAISE EXCEPTION 'Cannot borrow own listing'; END IF;

  SELECT * INTO v_balance FROM user_credit_balances WHERE user_id = p_borrower_id FOR UPDATE;
  IF NOT FOUND OR v_balance.available < 1 THEN RAISE EXCEPTION 'Insufficient credits'; END IF;

  INSERT INTO transactions (listing_id, lender_id, borrower_id, status, delivery_type, message, shipping_address_id)
  VALUES (p_listing_id, v_listing.owner_id, p_borrower_id, 'requested', p_delivery_type, p_message, p_shipping_address_id)
  RETURNING * INTO v_txn;

  INSERT INTO credit_events (user_id, event_type, amount, transaction_id, metadata, idempotency_key)
  VALUES (p_borrower_id, 'hold_placed', 1, v_txn.id,
    jsonb_build_object('listing_id', p_listing_id), 'hold_placed_' || v_txn.id::text);

  INSERT INTO transaction_events (transaction_id, event_type, actor_id, metadata)
  VALUES (v_txn.id, 'requested', p_borrower_id, jsonb_build_object('listing_id', p_listing_id));

  UPDATE listings SET status = 'reserved', updated_at = now() WHERE id = p_listing_id;
  RETURN v_txn;
END;
$$;

-- Lender approves a request: requested → approved
CREATE OR REPLACE FUNCTION approve_transaction(p_transaction_id UUID, p_actor_id UUID)
RETURNS transactions
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_txn transactions;
BEGIN
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction % not found', p_transaction_id; END IF;
  IF v_txn.lender_id != p_actor_id THEN RAISE EXCEPTION 'Only lender can approve'; END IF;
  IF v_txn.status != 'requested' THEN RAISE EXCEPTION 'Must be requested, got %', v_txn.status; END IF;

  UPDATE transactions SET status = 'approved', updated_at = now()
  WHERE id = p_transaction_id RETURNING * INTO v_txn;

  INSERT INTO transaction_events (transaction_id, event_type, actor_id, metadata)
  VALUES (p_transaction_id, 'approved', p_actor_id, jsonb_build_object('approved_at', now()));
  RETURN v_txn;
END;
$$;

-- Lender declines a request: requested → declined, releases hold, resets listing
CREATE OR REPLACE FUNCTION decline_transaction(p_transaction_id UUID, p_actor_id UUID)
RETURNS transactions
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_txn transactions; v_hold_event credit_events;
BEGIN
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction % not found', p_transaction_id; END IF;
  IF v_txn.lender_id != p_actor_id THEN RAISE EXCEPTION 'Only lender can decline'; END IF;
  IF v_txn.status != 'requested' THEN RAISE EXCEPTION 'Must be requested, got %', v_txn.status; END IF;

  SELECT * INTO v_hold_event FROM credit_events
  WHERE transaction_id = p_transaction_id AND event_type = 'hold_placed' AND user_id = v_txn.borrower_id
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    INSERT INTO credit_events (user_id, event_type, amount, transaction_id, hold_release_reason, metadata, idempotency_key)
    VALUES (v_txn.borrower_id, 'hold_released', v_hold_event.amount, p_transaction_id,
      'transaction_declined', jsonb_build_object('declined_by', p_actor_id),
      'hold_released_transaction_declined_' || p_transaction_id::text);
  END IF;

  UPDATE transactions SET status = 'declined', updated_at = now()
  WHERE id = p_transaction_id RETURNING * INTO v_txn;

  INSERT INTO transaction_events (transaction_id, event_type, actor_id, metadata)
  VALUES (p_transaction_id, 'declined', p_actor_id, jsonb_build_object('declined_at', now()));

  UPDATE listings SET status = 'active', updated_at = now() WHERE id = v_txn.listing_id;
  RETURN v_txn;
END;
$$;

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
  owner_id UUID REFERENCES auth.users(id),  -- Standardized to owner_id for semantic clarity
  book_id UUID REFERENCES books(id),
  condition TEXT NOT NULL,
  condition_notes TEXT,
  photos TEXT[] NOT NULL CHECK (array_length(photos, 1) >= 2 AND array_length(photos, 1) <= 4),
  delivery_options TEXT[] NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'on_hold', 'lent_out', 'inactive'
  )),  -- Tracks listing availability: active → on_hold (requested) → lent_out (borrowed) → inactive
  exclusive_type TEXT CHECK (exclusive_type IN ('signed_edition', 'early_release', 'manuscript_preview')),  -- Author-only: type of exclusive listing
  exclusive_until TIMESTAMPTZ,  -- Author-only: exclusive to author club members until this time
  signed_copy_count INTEGER DEFAULT 0 CHECK (signed_copy_count >= 0),  -- Author-only: available signed copies
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
    'requested', 'approved', 'declined', 'cancelled', 'payment_pending',
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
  is_signed_copy BOOLEAN DEFAULT false,  -- NEW: Whether this is for a signed copy from an author listing
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT transactions_no_self_lend CHECK (lender_id <> borrower_id)
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
    'cafe', 'library', 'bookstore', 'community_center'
  )),  -- Standardized to book-sharing context (removed 'coworking', 'other')
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
  club_type TEXT NOT NULL CHECK (club_type IN ('public', 'approval', 'invite_only', 'author_club')),
  access_level TEXT DEFAULT 'all' CHECK (access_level IN ('all', 'pro', 'pro_plus')),
  meeting_type TEXT CHECK (meeting_type IN ('online_only', 'venue_based', 'hybrid')),  -- NEW: Club meeting format
  current_book_id UUID REFERENCES books(id),
  admin_id UUID REFERENCES auth.users(id),  -- RENAMED from lead_id
  author_id UUID REFERENCES user_profiles(id),  -- NEW: Verified author who owns this author_club (NULL for regular clubs)
  member_count INTEGER DEFAULT 0,
  max_members INTEGER,  -- NULL = unlimited
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,  -- NEW: Track when club was archived
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT book_clubs_author_club_check CHECK (
    (club_type = 'author_club' AND author_id IS NOT NULL) OR
    (club_type != 'author_club' AND author_id IS NULL)
  )
);

CREATE INDEX idx_clubs_type ON book_clubs(club_type);
CREATE INDEX idx_clubs_active ON book_clubs(is_archived) WHERE is_archived = false;
CREATE INDEX idx_clubs_author ON book_clubs(author_id) WHERE club_type = 'author_club';

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
  event_type TEXT NOT NULL CHECK (event_type IN ('offline', 'online', 'ama', 'virtual_signing')),
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

-- AMA Event Questions (Author Feature)
CREATE TABLE club_event_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES club_events(id) ON DELETE CASCADE,
  asked_by UUID NOT NULL REFERENCES auth.users(id),
  question_text TEXT NOT NULL,
  author_answer TEXT,
  is_pinned BOOLEAN DEFAULT false,
  upvote_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ
);

CREATE INDEX idx_event_questions_event ON club_event_questions(event_id, upvote_count DESC);
CREATE INDEX idx_event_questions_status ON club_event_questions(event_id, status);

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

> **IMPORTANT:** Transaction completion and cancellation use atomic DB functions instead of
> direct `credit_events` inserts. The `credit_events` table has `WITH CHECK (false)` on INSERT —
> only SECURITY DEFINER functions can write to it. Never insert credit events directly from client or Edge Function code.

```typescript
// supabase/functions/complete-transaction/index.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    const { transaction_id, actor_id } = await req.json();

    // Call the atomic DB function — handles ALL credit operations in one transaction:
    // 1. Release borrower's hold (hold_released with reason 'transaction_completed')
    // 2. Debit borrower (borrow_spent)
    // 3. Credit lender (lend_completed, 1 credit)
    // 4. Update transaction status to 'completed'
    // All with idempotency keys to prevent duplicate operations on retry.
    const { data: completedTxn, error: completeError } = await supabase
      .rpc('complete_transaction', {
        p_transaction_id: transaction_id,
        p_actor_id: actor_id,
      });

    if (completeError) throw completeError;

    return new Response(JSON.stringify({ success: true, transaction: completedTxn }), {
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

#### Transaction Cancellation (Atomic Hold Release)
```typescript
// supabase/functions/cancel-transaction/index.ts (or inline in Edge Function)
// Releases held credits back to borrower's available balance atomically.
const { data: cancelledTxn, error } = await supabase
  .rpc('cancel_transaction', {
    p_transaction_id: transaction_id,
    p_actor_id: actor_id,
  });
```

#### State Machine Transitions (via RPC)
```typescript
// All status changes should go through the DB function:
const { data: updatedTxn, error } = await supabase
  .rpc('transition_transaction_status', {
    p_transaction_id: transaction_id,
    p_new_status: 'approved',  // or 'shipped', 'delivered', etc.
    p_actor_id: currentUserId,
  });
// The function enforces:
// - Valid state transitions (e.g., can't go from 'requested' → 'shipped')
// - Role-based permissions (e.g., only lender can approve/ship)
// - Row-level locking (prevents race conditions)
```

#### Signup Bonus (Idempotent)
```typescript
// In setup-profile.tsx — replaces direct credit_events INSERT
const { data: bonusEvent, error } = await supabase
  .rpc('grant_signup_bonus', { p_user_id: user.id });
// Safe to call multiple times — idempotency key prevents duplicates
```

#### Request Transaction (Atomic: create txn + hold credit + record event)
```typescript
// Borrower requests a book exchange — single RPC does everything:
const { data: newTxn, error } = await supabase
  .rpc('request_transaction', {
    p_listing_id: listing.id,
    p_borrower_id: currentUserId,
    p_delivery_type: 'meetup',  // 'porter' | 'dunzo' | 'meetup'
    p_message: 'I loved this book! Can we exchange?',
    p_shipping_address_id: null,  // required for porter/dunzo
  });
// Atomically: validates listing is active → checks credits → creates transaction
// → places 1-credit hold → records transaction_event → sets listing to 'reserved'
```

#### Approve / Decline Transaction
```typescript
// Lender approves:
const { data: approved, error } = await supabase
  .rpc('approve_transaction', {
    p_transaction_id: txn.id,
    p_actor_id: currentUserId,
  });

// Lender declines (releases hold, resets listing to active):
const { data: declined, error } = await supabase
  .rpc('decline_transaction', {
    p_transaction_id: txn.id,
    p_actor_id: currentUserId,
  });
```

#### Standalone Hold Operations (used internally, rarely called directly)
```typescript
// Place hold manually:
const { data: hold, error } = await supabase
  .rpc('place_hold', {
    p_user_id: userId,
    p_transaction_id: txnId,
    p_amount: 1,
  });

// Release hold manually:
const { data: released, error } = await supabase
  .rpc('release_hold', {
    p_transaction_id: txnId,
    p_actor_id: currentUserId,
    p_reason: 'transaction_expired',
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
  photos: z.array(z.string().url()).min(2).max(4),
  delivery_options: z.array(z.enum(['shipping', 'meet_in_person'])).min(1),
  // Author-only fields (optional — only validated when author creates listing)
  exclusive_type: z.enum(['signed_edition', 'early_release', 'manuscript_preview']).optional(),
  exclusive_until: z.string().datetime().optional(),
  signed_copy_count: z.number().int().min(0).optional(),
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
