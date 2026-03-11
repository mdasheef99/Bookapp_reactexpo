# BookTalks Mobile — Project Status Report

> **Historical note (2026-03-06):** This is a dated project status snapshot, not the canonical database reference.
> For database tables, migration history, and live schema naming, use
> `docs/audits/LIVE_SCHEMA_RECONCILIATION_2026-03-06.md` and
> `supabase/migrations/LIVE_MIGRATION_HISTORY_2026-03-06.md`.
>
> In particular, Sections 2 and 3 below contain database/backend details that were accurate for an earlier moment
> in the project but are now partially superseded by the live database.

**Date:** 2026-02-17 (End of Week 1)
**Last Updated:** 2026-02-18 (Week 2 Day 1 — Session 2)
**Timeline:** Feb 17 – Apr 28, 2026 (10 weeks)
**Overall Completion:** ~48%
**MVP Deadline:** Week 8 (Apr 13, 2026)

---

## 1. Core Features Status

| Feature | Status | Details |
|---------|--------|---------|
| Authentication (Phone OTP) | ✅ Complete | Supabase Auth, +91 prefix, dev bypass via `EXPO_PUBLIC_DEV_SKIP_AUTH` |
| User Profiles | 🟡 In Progress | `setup-profile.tsx` currently covers name, city, referral code, and signup bonus against `public.user_profiles`. Avatar/edit flows are still pending. |
| Personal Library | ✅ Complete | Google Books search, add/remove books, reading notes CRUD |
| P2P Exchange System | 🟡 In Progress | Backend 100% (Phase A+B + 9 SECURITY DEFINER fns), service layer complete (listingsService, transactionsService, addressesService). Exchange screens: browse ✅, create listing ✅, listing detail ✅, transaction detail ✅, my transactions list ✅. Address picker integrated for porter/dunzo ✅. Remaining: payment/delivery Edge Functions (blocked by API keys), rating system |
| Book Clubs | ❌ Not Started | `app/(tabs)/clubs.tsx` is 11-line placeholder |
| Venues / Meetup Points | ❌ Not Started | DB tables exist, no frontend |
| Credit System | 🟡 In Progress | DB layer 100% (9 functions), creditService.ts created, credit balance display on Profile screen ✅. No credit history screen yet. |
| Notifications | ❌ Not Started | No FCM integration, no Edge Function |
| Payments (Razorpay) | ❌ Not Started | No Edge Functions deployed |
| Delivery (Porter/Dunzo) | ❌ Not Started | No Edge Functions deployed |
| Author Features | 🟡 In Progress | DB schema complete, no frontend |

---

## 2. Database Status

### 2.1 Tables (31 app-facing tables in public schema as of 2026-03-06)

All tables exist in live Supabase (`ahntbtktjjmvfosgkmgn`, region `ap-southeast-2`):

| Category | Tables |
|----------|--------|
| **Auth/Users** | `user_profiles`, `user_addresses`, `user_credit_balances`, `credit_events`, `referrals` |
| **Books** | `books`, `user_books`, `reading_notes` |
| **Exchange** | `listings`, `transactions`, `transaction_events`, `transaction_ratings` |
| **Clubs** | `book_clubs`, `club_members`, `club_events`, `club_event_questions`, `club_messages`, `book_votes`, `club_join_questions`, `club_join_applications`, `club_member_actions`, `book_nominations`, `reading_schedules`, `member_reading_progress`, `event_rsvps`, `club_complaints`, `club_venues` |
| **Venues** | `venues` |
| **Social** | `user_wishlist`, `user_push_tokens` |
| **System** | Live table inventory is canonical in `LIVE_SCHEMA_RECONCILIATION_2026-03-06.md` |

### 2.2 FK Architecture (Updated 2026-02-18)

Some high-traffic exchange FKs now point to `user_profiles(user_id)`, but not all user-referencing FKs do:

| FK Constraint | Source Column | Target | Status |
|---------------|--------------|--------|--------|
| `listings_owner_id_fkey` | `listings.owner_id` | `user_profiles(user_id)` | ✅ Fixed 2026-02-18 |
| `transactions_lender_id_fkey` | `transactions.lender_id` | `user_profiles(user_id)` | ✅ Fixed 2026-02-18 |
| `transactions_borrower_id_fkey` | `transactions.borrower_id` | `user_profiles(user_id)` | ✅ Fixed 2026-02-18 |
| `user_profiles_user_id_fkey` | `user_profiles.user_id` | `auth.users(id)` | Unchanged |
| `reading_notes_user_id_fkey` | `reading_notes.user_id` | `auth.users(id)` | Live canonical |
| `user_wishlist_user_id_fkey` | `user_wishlist.user_id` | `auth.users(id)` | Live canonical |

**Why:** Enables direct PostgREST embedded joins between listings/transactions and user_profiles without broken join hints.

### 2.3 RLS Policies

~90 RLS policies active + 12 storage policies. Key security:
- `credit_events` INSERT: `WITH CHECK (false)` — only SECURITY DEFINER functions can write
- `credit_events` UPDATE/DELETE: `USING (false)` — append-only immutable audit trail
- Storage: owner-only write via `auth.uid()::text = (storage.foldername(name))[1]`
- All tables enforce user-scoped access

### 2.3 CHECK Constraints (Deployed)

| Table | Constraint | Values |
|-------|-----------|--------|
| `credit_events` | `event_type` | `signup_bonus`, `lend_completed`, `borrow_spent`, `referral_bonus`, `admin_adjustment`, `hold_placed`, `hold_released` |
| `credit_events` | `hold_release_reason` | `transaction_completed`, `transaction_declined`, `transaction_cancelled`, `transaction_expired`, `dispute_resolved` |
| `transactions` | `status` | `requested`, `approved`, `declined`, `cancelled`, `payment_pending`, `ready_to_ship`, `shipped`, `delivered`, `completed`, `disputed` |
| `transactions` | `no_self_lend` | `lender_id <> borrower_id` |
| `transactions` | `delivery_type` | `porter`, `dunzo`, `meetup` |
| `listings` | `status` | `active`, `paused`, `reserved`, `completed` |
| `listings` | `photos` | `array_length(photos, 1) >= 2 AND array_length(photos, 1) <= 4` |

### 2.4 SECURITY DEFINER Functions (9 deployed)

**Phase A (3 functions — data integrity):**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `transition_transaction_status` | `(p_transaction_id UUID, p_new_status TEXT, p_actor_id UUID) → transactions` | State machine enforcement with role-based checks + FOR UPDATE locking |
| `complete_transaction` | `(p_transaction_id UUID, p_actor_id UUID) → transactions` | Atomic: release hold → debit borrower → credit lender → status 'completed' |
| `cancel_transaction` | `(p_transaction_id UUID, p_actor_id UUID) → transactions` | Atomic: release hold (back to available) → status 'cancelled' |

**Phase B (6 functions — transaction lifecycle):**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `grant_signup_bonus` | `(p_user_id UUID) → credit_events` | Idempotent 1-credit signup bonus. Key: `signup_bonus_<user_id>` |
| `place_hold` | `(p_user_id UUID, p_transaction_id UUID, p_amount NUMERIC DEFAULT 1) → credit_events` | FOR UPDATE lock → validate balance → insert hold_placed |
| `release_hold` | `(p_transaction_id UUID, p_actor_id UUID, p_reason TEXT) → credit_events` | Release held credit with reason. Key: `hold_released_<reason>_<txn_id>` |
| `request_transaction` | `(p_listing_id UUID, p_borrower_id UUID, p_delivery_type TEXT, p_message TEXT, p_shipping_address_id UUID) → transactions` | Atomic: validate listing → create txn → hold credit → record event → reserve listing |
| `approve_transaction` | `(p_transaction_id UUID, p_actor_id UUID) → transactions` | Lender-only: requested → approved + transaction_event |
| `decline_transaction` | `(p_transaction_id UUID, p_actor_id UUID) → transactions` | Lender-only: requested → declined + release hold + reset listing |

**Trigger function:**
| `update_credit_balance` | Trigger on `credit_events` INSERT | Auto-updates `user_credit_balances` (available, held, lifetime_earned, lifetime_spent) |

### 2.5 Indexes (Key ones)

- `idx_credit_events_user` — user_id + created_at DESC
- `idx_credit_events_transaction` — transaction_id
- `credit_events_idempotency_key_key` — UNIQUE on idempotency_key
- `idx_transactions_lender`, `idx_transactions_borrower`, `idx_transactions_status`
- `idx_listings_city_status` — city-based listing queries

---

## 3. Backend Implementation Status

### 3.1 Edge Functions (0 of 11 deployed)

| # | Function | Priority | Status |
|---|----------|----------|--------|
| 1 | `create-payment-order` | CRITICAL | ❌ Not deployed |
| 2 | `verify-payment` | CRITICAL | ❌ Not deployed |
| 3 | `book-shipment` | CRITICAL | ❌ Not deployed |
| 4 | `complete-transaction` | CRITICAL | ❌ Not deployed (DB function exists, Edge wrapper missing) |
| 5 | `transfer-credits` | CRITICAL | ❌ Not deployed |
| 6 | `wishlist-notify` | HIGH | ❌ Not deployed |
| 7 | `check-membership-limits` | HIGH | ❌ Not deployed |
| 8 | `send-notification` | HIGH | ❌ Not deployed |
| 9 | `moderate-content` | MEDIUM | ❌ Not deployed |
| 10 | `author-analytics` | LOW | ❌ Not deployed |
| 11 | `generate-referral-code` | LOW | ❌ Not deployed |

### 3.2 Supabase Storage Buckets (Created 2026-02-18)

**3 buckets configured** with RLS policies (12 total, 4 per bucket):

| Bucket | Public | Size Limit | MIME Types | RLS |
|--------|--------|-----------|------------|-----|
| `listing-photos` | ✅ | 5MB | jpeg, png, webp | Public read, owner-only write |
| `profile-avatars` | ✅ | 5MB | jpeg, png, webp | Public read, owner-only write |
| `club-banners` | ✅ | 5MB | jpeg, png, webp | Public read, owner-only write |

## 4. Frontend Implementation Status

### 4.1 Screens (`app/` directory)

| Screen | Path | Status | Notes |
|--------|------|--------|-------|
| Root Layout | `app/_layout.tsx` | ✅ | Auth routing, font loading |
| Entry Redirect | `app/index.tsx` | ✅ | Redirects based on auth state |
| Login (Phone OTP) | `app/(auth)/login.tsx` | ✅ | Full OTP flow, +91 prefix |
| OTP Verification | `app/(auth)/verify-otp.tsx` | ✅ | 6-digit code, resend timer, and `user_profiles` existence check so returning users enter the app instead of being sent to duplicate profile setup |
| Profile Setup | `app/(auth)/setup-profile.tsx` | ✅ | New-user setup only: name, city, referral code, and `grant_signup_bonus()` RPC. Existing users should bypass this screen after OTP verification. |
| Tab Layout | `app/(tabs)/_layout.tsx` | ✅ | 4 tabs: Library, Exchange, Clubs, Profile |
| Library | `app/(tabs)/library/index.tsx` | ✅ | Book grid, search, filters |
| Book Detail | `app/(tabs)/library/[bookId].tsx` | ✅ | Full detail with notes |
| Book Search | `app/(tabs)/library/search.tsx` | ✅ | Google Books API integration |
| Reading Notes | `app/(tabs)/library/notes.tsx` | ✅ | CRUD for reading notes |
| Exchange Browse | `app/(tabs)/exchange/index.tsx` | ✅ | Filter chips (condition ×5, delivery ×3), ListingCard, empty/loading/error states, pull-to-refresh. P0-5 |
| Create Listing | `app/(tabs)/exchange/create.tsx` | ✅ | Book picker, ImagePicker (2–4 photos), condition+delivery chips, form validation (RHF+Zod), city warning. P0-6 |
| Listing Detail | `app/(tabs)/exchange/[listingId].tsx` | ✅ | Photo carousel, book info, owner card, condition/delivery, Request Book CTA → `request_transaction()`. P0-7 |
| Transaction Detail | `app/(tabs)/exchange/transaction/[transactionId].tsx` | ✅ | Timeline progress bar, profile cards, status-based action buttons (all 10 statuses × lender/borrower role). P0-8 |
| My Transactions | `app/(tabs)/exchange/my-transactions.tsx` | ✅ | Role-aware cards, 3-segment filter (All/Borrowing/Lending), skeleton+error+empty states, pull-to-refresh. P0-9 |
| Clubs | `app/(tabs)/clubs.tsx` | ❌ | 11-line placeholder |
| Profile | `app/(tabs)/profile.tsx` | 🟡 | Credit balance card live ✅ (available + held/earned/spent grid, loading skeletons, empty state). No edit functionality yet. |

### 4.2 Services & Hooks (`src/`)

| File | Status | Purpose |
|------|--------|---------|
| `src/lib/supabase.ts` | ✅ | Supabase client with MMKV storage adapter |
| `src/features/auth/hooks/useAuth.ts` | ✅ | Global auth state, dev bypass, singleton pattern |
| `src/features/auth/services/authService.ts` | ✅ | OTP sign-in, verify, sign-out, getSession |
| `src/features/books/services/booksService.ts` | ✅ | Google Books search, library CRUD (285 lines) |
| `src/features/books/services/notesService.ts` | ✅ | Reading notes CRUD (144 lines) |
| `src/features/auth/services/profileService.ts` | ✅ | Profile summary + batch fetching helper (86 lines). Created 2026-02-18 |
| `src/features/exchange/services/listingsService.ts` | ✅ | Listing CRUD, browse, photo upload (313 lines). Lean Lists pattern. Created 2026-02-18 |
| `src/features/exchange/services/transactionsService.ts` | ✅ | Wraps all 6 RPC calls + queries (258 lines). Includes `getMyTransactionsWithListings()`. Lean Lists pattern. Created 2026-02-18 |
| `src/features/credits/services/creditService.ts` | ✅ | Balance, history, Realtime subscription (145 lines). Created 2026-02-18 |
| `src/features/exchange/hooks/useTransactions.ts` | ✅ | `useRequestTransaction`, `useApproveTransaction`, `useDeclineTransaction`, `useCancelTransaction`, `useCompleteTransaction`, `useMyTransactionsWithListings`. Created 2026-02-18 |
| `src/features/exchange/services/addressesService.ts` | ✅ | Address CRUD for `user_addresses`: `getAddresses`, `getDefaultAddress`, `createAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress` + 3 TS interfaces (155 lines). Created 2026-02-18 |
| `src/features/exchange/hooks/useAddresses.ts` | ✅ | TanStack Query hooks: `useAddresses`, `useDefaultAddress`, `useCreateAddress`, `useUpdateAddress`, `useDeleteAddress`, `useSetDefaultAddress` (97 lines). Created 2026-02-18 |
| `src/components/exchange/AddressPicker.tsx` | ✅ | Address selection + creation component — radio list, modal form (7 fields), default badge, validation (200 lines). Created 2026-02-18 |
| `src/features/clubs/services/*` | ❌ | Not created |

### 4.3 DB Function Integration Status

| Frontend Code | DB Function Used | Status |
|---------------|-----------------|--------|
| `setup-profile.tsx` line 85 | `grant_signup_bonus()` | ✅ Integrated (Phase B.7) |
| Exchange request flow | `request_transaction()` | ✅ Wired in `[listingId].tsx` Request Book button |
| Exchange approve/decline | `approve_transaction()` / `decline_transaction()` | ✅ Wired in `transaction/[transactionId].tsx` lender action buttons |
| Transaction completion | `complete_transaction()` | ✅ Wired in `transaction/[transactionId].tsx` Complete Exchange button |
| Transaction cancellation | `cancel_transaction()` | ✅ Wired in `transaction/[transactionId].tsx` Cancel button |
| Status transitions | `transition_transaction_status()` | ✅ Used internally by all RPC functions (server-side) |

---

## 5. Integration Status

| Service | Purpose | Status | Notes |
|---------|---------|--------|-------|
| **Supabase Auth** | Phone OTP | ✅ Configured | +91 India prefix, working |
| **Google Books API** | Book search | 🟡 Partial | Used in `booksService.ts`, no API key management |
| **Razorpay** | Payments (deposit) | ❌ Not configured | Needs Edge Functions + SDK |
| **Porter** | Intra-city delivery | ❌ Not configured | Needs Edge Function + API key |
| **Dunzo** | Intra-city delivery | ❌ Not configured | Needs Edge Function + API key |
| **Firebase FCM** | Push notifications | ❌ Not configured | Needs `send-notification` Edge Function |
| **Google Maps** | Geocoding/distance | ❌ Not configured | Needed for meetup venues |

---

## 6. Timeline & Milestones

```
Week 1  (Feb 17-23) ← CURRENT  Phase 0: Foundation + Auth ✅ + Phase A/B DB functions ✅
Week 2  (Feb 24-Mar 2)          Phase 2: Exchange Backend (Edge Functions, Storage)
Week 3  (Mar 3-9)               Phase 2-3: Exchange Backend + Frontend
Week 4  (Mar 10-16)             Phase 3: Exchange Frontend completion
Week 5  (Mar 17-23)             Phase 4: Clubs Backend + Frontend
Week 6  (Mar 24-30)             Phase 4: Clubs completion + Payments
Week 7  (Mar 31-Apr 6)          Phase 5: Notifications + Delivery integration
Week 8  (Apr 7-13)              MVP DEADLINE — feature freeze
Week 9  (Apr 14-20)             Phase 6: Polish, testing, bug fixes
Week 10 (Apr 21-28)             Phase 7: Launch prep, final QA
```

---

## 7. Known Issues & Inconsistencies

| Issue | Severity | Details |
|-------|----------|---------|
| Listings status enum mismatch | MEDIUM | Live DB: `active, paused, reserved, completed`. Docs (SCHEMA_REFERENCE_GUIDE): `active, on_hold, lent_out, inactive`. DB is source of truth. |
| 0 Edge Functions deployed | HIGH | Blocks payment, delivery, and notification features. All blocked by external API keys (Razorpay, Porter, Dunzo). |
| ~~Transactions RLS UPDATE too permissive~~ | ~~MEDIUM~~ | **RESOLVED 2026-02-18 (Session 3)** — Policy `Participants can update their transactions` altered: `USING (false) WITH CHECK (false)`. All direct `UPDATE` mutations on `transactions` are now blocked at the RLS layer. All writes must go through the controlled SECURITY DEFINER RPCs (`approve_transaction`, `decline_transaction`, `cancel_transaction`, `complete_transaction`, `transition_transaction_status`). SELECT policy unchanged. Verified via `pg_policies` query. |
| Address phone field: no server-side validation | LOW | **Current state:** `user_addresses.phone` has no CHECK constraint. `AddressPicker.tsx` (line 66) validates presence only (non-empty check) — it does not validate the 10-digit format. **Risk:** A direct Supabase client call (bypassing the mobile UI) can write any string to `phone`, including malformed or empty-after-trim values, without error. **Recommended fix:** `ALTER TABLE user_addresses ADD CONSTRAINT phone_format CHECK (phone ~ '^[0-9]{10}$');` — adds server-side enforcement of exactly 10 digits. **Why LOW severity:** RLS `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies on `user_addresses` all scope access to `auth.uid() = user_id`. A user can only corrupt their own address records. No cross-user blast radius, no financial impact. Address data integrity matters for delivery, but a malformed phone is caught when the delivery partner attempts to contact the recipient. |
| ~~Profile screen incomplete~~ | ~~LOW~~ | **PARTIALLY RESOLVED 2026-02-18 (Session 2)** — Credit balance card added ✅. Edit functionality still missing. |
| ~~No TanStack Query hooks for exchange~~ | ~~MEDIUM~~ | **RESOLVED 2026-02-18** — `useTransactions.ts` created with all required hooks |
| ~~Transaction requests pass null shipping_address_id~~ | ~~HIGH~~ | **RESOLVED 2026-02-18 (Session 2)** — `addressesService.ts`, `useAddresses.ts`, `AddressPicker` created. Listing detail screen wired. Porter/Dunzo now require a valid address UUID. |

---

## 8. Completion by Layer

| Layer | Completion | Notes |
|-------|-----------|-------|
| Database Schema | 97% | 34 tables, all constraints, triggers, FK architecture fixed |
| DB Functions | 95% | 9 SECURITY DEFINER + 1 trigger function |
| RLS Policies | 95% | ~90 table policies + 12 storage policies, credit_events fully locked |
| Edge Functions | 0% | 0 of 11 deployed — blocked by external API keys |
| Storage | 100% | 3 buckets configured with RLS ✅ |
| Service Layer | 88% | 7 services + exchange/address hooks complete. Clubs hooks/services pending |
| Frontend — Auth | 100% | Login, OTP, profile setup |
| Frontend — Library | 90% | Search, CRUD, notes |
| Frontend — Exchange | 65% | 5 screens ✅ + AddressPicker ✅ + address service layer ✅. Payment/delivery Edge Functions pending. |
| Frontend — Clubs | 0% | Placeholder only |
| Frontend — Profile | 45% | Credit balance card ✅ (available + stats grid). Edit functionality pending. |
| Third-party Integrations | 5% | Only Google Books partially |
| **Overall** | **~48%** | Strong DB + service foundation + Exchange screens + address integrity complete |


---

## 9. Session Log: 2026-02-18 (Week 2, Day 1)

### 9.1 What Was Fixed
- **FK Constraints**: Dropped 3 FK constraints pointing to `auth.users.id`, re-added pointing to `user_profiles(user_id)`. Enables direct PostgREST joins. Tables were empty (0 rows) so no data migration needed.

### 9.2 What Was Created
- **Storage Buckets**: 3 buckets (`listing-photos`, `profile-avatars`, `club-banners`) with 12 RLS policies
- **`profileService.ts`** (86 lines): `getProfile()`, `getProfileSummary()`, `getProfileSummaries()` batch helper
- **`listingsService.ts`** (313 lines): `createListing()`, `browseListings()`, `getListingDetails()`, `getMyListings()`, `pauseListing()`, `activateListing()`, `deleteListing()`, `uploadListingPhoto()`
- **`transactionsService.ts`** (236 lines): Wraps all 6 RPC calls (`requestTransaction`, `approveTransaction`, `declineTransaction`, `cancelTransaction`, `completeTransaction`, `transitionStatus`) + query functions
- **`creditService.ts`** (145 lines): `getCreditBalance()`, `getCreditHistory()`, `subscribeToCreditBalance()` (Realtime)

### 9.3 What Was Refactored
- **`listingsService.ts`**: Removed broken `user_profiles!listings_owner_id_fkey(...)` join hints. Applied "Lean Lists, Rich Details" pattern — browse queries fetch book only, detail views fetch profile separately.
- **`transactionsService.ts`**: Removed all profile join hints. List queries are lean (listing+book only), detail view uses batch `profileService.getProfileSummaries()`.

### 9.4 What Was Documented
- **`DATABASE.md`**: Added FK target documentation for listings/transactions tables. Added new Section 4: "Query Coding Standard: Lean Lists, Rich Details" with examples and rules.

### 9.5 Coding Standard Established
**"Lean Lists, Rich Details"** — established 2026-02-18:
- List/Browse queries: Max 1-level join, only data shown in card UI
- Detail views: Max 2-level join, fetch profiles separately via `profileService`
- My items: No profile joins needed (current user's data)
- Profile data: Always use `profileService.getProfileSummary()` or batch method

### 9.6 Exchange Frontend Screens Built

#### P0-5: Exchange Browse Screen (`app/(tabs)/exchange/index.tsx`)
- **What was created**: Browse screen with filter chips (condition ×5, delivery ×3), ListingCard component, empty/loading/error states, pull-to-refresh. Navigates to listing detail on card press + icon button to My Exchanges screen
- **Files created**: `app/(tabs)/exchange/index.tsx`, `app/(tabs)/exchange/_layout.tsx`
- **Bug fixed**: Infinite loading spinner — changed condition from `!profile && !!session?.user?.id` to `profileLoading`, added `retry: 1`
- **QA**: Zero TypeScript errors, Playwright tested ✅

#### P0-6: Create Listing Screen (`app/(tabs)/exchange/create.tsx`)
- **What was created**: Full create listing form — book picker (from user library), ImagePicker for 2–4 required photos, condition chips (5 options), delivery option chips (meetup/porter/dunzo), condition notes, city warning banner, form validation (RHF+Zod), 3-step upload (insert placeholder → upload photos → update row)
- **Bug fixed**: Book picker infinite spinner — added `retry: 0` + destructured `isError` to show empty state on 401
- **Files modified**: `app/(tabs)/exchange/create.tsx`
- **QA**: Zero TypeScript errors, Playwright tested ✅

#### P0-7: Listing Detail Screen (`app/(tabs)/exchange/[listingId].tsx`)
- **What was created**: Photo carousel, book info card (title/authors/cover), owner profile card, condition badge, delivery options display, Request Book CTA button → calls `request_transaction()` RPC → navigates to transaction detail on success
- **Files created**: `app/(tabs)/exchange/[listingId].tsx`
- **Navigation wired**: Browse `handleListingPress` → `/(tabs)/exchange/${listing.id}`
- **QA**: Zero TypeScript errors, Playwright tested (error state, navigation) ✅

#### P0-8: Transaction Detail Screen (`app/(tabs)/exchange/transaction/[transactionId].tsx`)
- **What was created**: Timeline progress bar, book card, lender/borrower profile cards, status-aware action buttons for all 10 statuses × both roles
- **Action buttons per status**: Approve/Decline (lender, requested) • Cancel (both, approved) • Mark Shipped (lender, ready_to_ship) • Confirm Delivery (borrower, shipped) • Complete Exchange (both, delivered) • Terminal banners (declined/cancelled/disputed/completed)
- **Files created**: `app/(tabs)/exchange/transaction/[transactionId].tsx`, `app/(tabs)/exchange/transaction/_layout.tsx`
- **QA**: Zero TypeScript errors, Playwright tested (error state, navigation) ✅

#### P0-9: My Transactions List Screen (`app/(tabs)/exchange/my-transactions.tsx`)
- **What was created**: My Exchanges list screen with role-aware `TransactionCard` components (book cover thumbnail, title/authors, status badge with color coding, role badge 📥/📤, date), 3-segment filter (All / Borrowing / Lending), loading skeleton (4 cards), error state with Retry button, empty state with "Browse books to start exchanging" CTA, pull-to-refresh
- **Files modified**: 5 files
  - `src/features/exchange/services/transactionsService.ts` — added `getMyTransactionsWithListings()` (lean join: listing+book only)
  - `src/features/exchange/hooks/useTransactions.ts` — added `myList` query key + `useMyTransactionsWithListings()` hook
  - `app/(tabs)/exchange/_layout.tsx` — registered `my-transactions` route
  - `app/(tabs)/exchange/my-transactions.tsx` — new screen (280 lines)
  - `app/(tabs)/exchange/index.tsx` — added `🔄` icon button in header + `headerActions`/`myExchangesBtn` styles
- **Design patterns**: Lean Lists (1-level join, listing+book only), role-aware UI, status color coding (10 statuses)
- **QA**: Zero TypeScript errors, Playwright tests passed — navigation, segment switching, error state, back navigation all verified ✅

---

## 10. Session Log: 2026-02-18 (Week 2, Day 1 — Session 2)

### 10.1 Strategic Decision
Adopted **hybrid approach**: complete 2 Exchange loose ends (address integrity + credit display) this session, then jump to Clubs frontend for next 3–4 sessions while waiting for Razorpay/Porter/Dunzo API keys. Original plan superseded — Phase 3 work was already done in Phase 1; continuing to Exchange Edge Functions is blocked by external dependencies.

### 10.2 What Was Created
- **`src/features/exchange/services/addressesService.ts`** (155 lines): Full CRUD service for `user_addresses` table. Methods: `getAddresses`, `getDefaultAddress`, `createAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`. Auto-clears existing default when a new default is set.
- **`src/features/exchange/hooks/useAddresses.ts`** (97 lines): TanStack Query hooks wrapping `addressesService`. Query keys pattern established: `addressKeys.list(userId)`, `addressKeys.default(userId)`.
- **`src/components/exchange/AddressPicker.tsx`** (200 lines): Address selection + creation UI component. Features: radio-button address list, "Add new address" modal form (7 fields: name, phone, line1, line2, city, state, pincode + isDefault toggle), default badge, client-side validation. Uses `useTheme()` colors throughout.

### 10.3 What Was Modified
- **`app/(tabs)/exchange/[listingId].tsx`**: Added `AddressPicker` import, `selectedAddressId` state, `needsAddress` computed gate (`selectedDelivery !== 'meetup'`), address requirement in `canRequest` boolean, `shippingAddressId` passed to `requestMutation`, picker rendered conditionally for porter/dunzo only, dynamic CTA text.
  - **Impact**: Transaction requests now pass a real `shipping_address_id` UUID instead of `null` for porter/dunzo delivery. Data integrity gap closed.
- **`app/(tabs)/profile.tsx`**: Added credit balance `useQuery` (staleTime 60s, enabled only when `userId` present), inserted **Credit Balance Card** between profile header and settings — glassmorphism style consistent with rest of screen. Three states: loading skeletons → live balance display (large `available` + held/earned/spent 3-column grid) → empty-state message. Added 11 credit card styles.

### 10.4 Issues Found During Review
1. **Transactions RLS UPDATE too permissive** (MEDIUM): Direct column updates are technically possible for any participant. All writes currently go through SECURITY DEFINER RPCs, but raw UPDATE path is not blocked.
2. **Address phone: no server-side validation** (LOW): `user_addresses.phone` has no CHECK constraint. Validation is client-only in `AddressPicker`.

### 10.5 Next Session Plan
1. Submit API key requests: Razorpay sandbox, Porter sandbox, Dunzo sandbox (30-min background task)
2. Start Clubs frontend — recommended build order:
   - `clubsService.ts` + `useClubs.ts` hooks
   - Browse Clubs screen (`app/(tabs)/clubs/index.tsx`) — replaces placeholder
   - Club Detail screen (`app/(tabs)/clubs/[clubId].tsx`) — join/leave flow
   - `messagesService.ts` + Realtime hook — tackle before chat UI (highest architectural risk)
   - Club Chat screen (`app/(tabs)/clubs/[clubId]/chat.tsx`)
   - Create Club screen (`app/(tabs)/clubs/create.tsx`)