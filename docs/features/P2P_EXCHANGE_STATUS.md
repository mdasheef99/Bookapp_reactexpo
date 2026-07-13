# P2P Exchange — Feature Status Document

**Document Type:** Feature Status / Technical Handoff
**Feature:** P2P Book Exchange (P0-priority MVP feature)
**Last Updated:** 2026-05-11 (dispute filing flow applied)
**Review Conducted By:** Sessions 2–3 comprehensive analysis
**Overall Status:** ~60-65% complete end-to-end; meetup path is active, payment/shipping paths are intentionally disabled in-app

---

## 1. Feature Overview

The P2P Exchange is the core transactional feature of BookTalks Mobile. It enables city-filtered, credit-based peer-to-peer book lending between registered users in the same city. It is the primary value driver of the product — without Exchange, BookTalks is a library app; with Exchange, it becomes a community lending marketplace.

### 1.1 Credit Economy

BookTalks operates on a democratic 1-credit-per-book system:

- Every new user receives **1 free credit** on signup (via `grant_signup_bonus()` RPC)
- **Borrowing** costs 1 credit (held at request, debited atomically on completion)
- **Lending** earns 1 credit (credited atomically on transaction completion)
- Credits are non-monetary — earned only by participating, never purchasable
- All credit operations are **event-sourced** and append-only via `credit_events` table

### 1.2 The 8-Step Transaction Flow

```
Step 1: Browse Listings     → City-filtered with condition/delivery filters
Step 2: Request Book        → Select delivery method + shipping address (porter/dunzo)
Step 3: Approve / Decline   → Lender reviews request; 48-hour acceptance window
Step 4: Payment             → Borrower pays refundable ₹100–500 deposit (Razorpay)
Step 5: Ship                → Lender books delivery (Porter/Dunzo) or confirms meetup
Step 6: Delivery Confirm    → Borrower confirms receipt
Step 7: Complete Exchange   → Atomic: hold released, borrower debited, lender credited
Step 8: Rate & Review       → Both parties rate the exchange (1–5 stars + text)
```

### 1.3 Delivery Options

- **Meetup** (`meetup`) — In-person handoff. No deposit, no logistics integration required.
- **Porter** (`porter`) — Intra-city bike courier. Requires shipping address + `book-shipment` Edge Function.
- **Dunzo** (`dunzo`) — Intra-city delivery service. Requires shipping address + `book-shipment` Edge Function.

---

## 2. Implementation Status Summary

**Overall Exchange completion: ~70%** (meetup path active with ratings and dispute filing)

### 2.1 What Works Today (End-to-End)

The **meetup delivery path is fully functional** end-to-end:

- ✅ Browse city-filtered listings with condition and enabled delivery filters
- ✅ Create listing with 2–4 photos, condition rating, and enabled delivery options
- ✅ Request a book (meetup) — credit hold placed atomically via `request_transaction()` RPC
- ✅ Lender receives pending request; can approve or decline
- ✅ Borrower confirms delivery; lender marks complete
- ✅ `complete_transaction()` RPC atomically releases hold, debits borrower, credits lender
- ✅ Credit balance visible on Profile screen (available + held/earned/spent grid)
- ✅ Dedicated address management surface available from Profile (`app/(tabs)/profile/addresses.tsx`, route `/(tabs)/profile/addresses`)
- ✅ Delivery/payment capability gating centralized in `src/features/exchange/config/exchangeConfig.ts`
- ⚠️ Porter/Dunzo are currently hidden from browse/create request surfaces until shipping and payment integrations are complete

### 2.2 What Is Blocked

Steps 4–5 require external API keys not yet available:

- ❌ Razorpay payment deposit collection (Step 4) — awaiting sandbox credentials
- ❌ Porter/Dunzo delivery booking (Step 5) — awaiting API access
- ❌ `create-payment-order`, `verify-payment`, and `book-shipment` Edge Functions are not deployed

### 2.3 What Is Not Started

- ✅ Rating & review frontend/service flow — completed transactions now prompt each participant to rate the other
- ✅ Rating RPC hardening is applied via `submit_transaction_rating`, deriving `from_user_id` from `auth.uid()` and `to_user_id` from the completed transaction; direct INSERT policy also validates the opposite participant
- ✅ Credit history screen — `app/(tabs)/profile/credit-history.tsx` surfaces balance and event history from `creditService.getCreditHistory()`
- ✅ Dispute filing flow — participants can file a dispute on delivered exchanges; `file_transaction_dispute()` records `dispute_opened` in `transaction_events.metadata`
- ⚠️ Dispute resolution is currently "Resolve & Complete" via existing `complete_transaction()` from `disputed`; dedicated admin/moderation resolution remains future work

---

## 3. Technical Architecture

### 3.1 Service Layer

| File | Lines | Purpose |
|------|-------|---------|
| `src/features/exchange/services/listingsService.ts` | 313 | Listing CRUD, city-filtered browse, photo upload to `listing-photos` storage bucket |
| `src/features/exchange/services/transactionsService.ts` | 258 | Wraps all 6 transaction RPCs + query functions (`getMyTransactionsWithListings`, `getTransactionDetails`, `getIncomingRequests`) |
| `src/features/exchange/services/addressesService.ts` | 155 | Full CRUD for `user_addresses`: getAddresses, getDefaultAddress, createAddress, updateAddress, deleteAddress, setDefaultAddress |
| `src/features/exchange/services/ratingsService.ts` | — | Fetches/submits current user's `transaction_ratings` row for a completed exchange |
| `src/features/credits/services/creditService.ts` | 145 | `getCreditBalance()`, `getCreditHistory()`, `subscribeToCreditBalance()` Realtime subscription |
| `src/features/auth/services/profileService.ts` | 86 | `getProfileSummary()` + batch helper used by transaction detail screen |
| `src/features/exchange/utils/transactionActionResolver.ts` | — | Pure role/status/delivery resolver for transaction detail CTAs and guard messages |

### 3.2 Hooks

| File | Exported Hooks |
|------|----------------|
| `src/features/exchange/hooks/useListings.ts` | `useListingDetails`, `useMyListings`, `useBrowseListings`, `useCreateListing`, `usePauseListing`, `useActivateListing`, `useDeleteListing` |
| `src/features/exchange/hooks/useTransactions.ts` | `useRequestTransaction`, `useApproveTransaction`, `useDeclineTransaction`, `useCancelTransaction`, `useCompleteTransaction`, `useMyTransactionsWithListings` |
| `src/features/exchange/hooks/useAddresses.ts` | `useAddresses`, `useDefaultAddress`, `useCreateAddress`, `useUpdateAddress`, `useDeleteAddress`, `useSetDefaultAddress` |

### 3.3 Frontend Screens

| Screen | Path | Lines | Status |
|--------|------|-------|--------|
| Browse Listings | `app/(tabs)/exchange/index.tsx` | 293 | ✅ Complete |
| Create Listing | `app/(tabs)/exchange/create.tsx` | ~350 | ✅ Complete |
| Listing Detail + Request CTA | `app/(tabs)/exchange/[listingId].tsx` | 310 | ✅ Complete |
| Transaction Detail | `app/(tabs)/exchange/transaction/[transactionId].tsx` | 484 | ✅ Complete |
| My Transactions | `app/(tabs)/exchange/my-transactions.tsx` | 280 | ✅ Complete |

### 3.4 Components

| Component | Path | Purpose |
|-----------|------|---------|
| `AddressPicker` | `src/components/exchange/AddressPicker.tsx` | Address selection + creation modal. Radio list, 7-field form, default badge. Available for future shipping/address management surfaces; not currently rendered in Listing Detail while Porter/Dunzo are disabled. |
| `AddressesScreen` | `app/(tabs)/profile/addresses.tsx` | Profile-linked address management surface for listing, adding, editing, deleting, and setting a default saved address. Legacy `/(tabs)/addresses` deep links redirect here. |
| `ListingCard` | Inline in `exchange/index.tsx` | Book cover, title, condition badge, delivery option chips |
| `TransactionCard` | `src/components/exchange/TransactionCard.tsx` | Role-aware card — status badge (10 states), role badge, timestamp, and detail navigation |
| `TransactionRatingPrompt` | `src/components/exchange/TransactionRatingPrompt.tsx` | Completed-exchange rating form with stars, quick tags, optional review, and submitted-rating state |

### 3.5 Database Functions (SECURITY DEFINER)

All transaction state mutations go through these RPCs. Direct `UPDATE` on `transactions` is now blocked at the RLS layer (see §5.1). No client code should ever write to `transactions` directly.

| Function | Role Required | What It Does |
|----------|--------------|--------------|
| `request_transaction(listing_id, borrower_id, delivery_type, message, shipping_address_id)` | Borrower | Validates listing active, checks borrower credit ≥1, creates txn, places 1-credit hold, sets listing → `reserved` |
| `approve_transaction(transaction_id, actor_id)` | Lender only | `requested` → `approved` + emits `transaction_event` |
| `decline_transaction(transaction_id, actor_id)` | Lender only | `requested` → `declined` + releases credit hold + resets listing → `active` |
| `cancel_transaction(transaction_id, actor_id)` | Either party | `approved` → `cancelled` + releases credit hold |
| `complete_transaction(transaction_id, actor_id)` | Either party | Atomic: release hold → debit borrower → credit lender → status `completed`. Idempotency-keyed. |
| `transition_transaction_status(transaction_id, new_status, actor_id)` | Role-gated | State machine enforcer with `FOR UPDATE` row locking. Used internally by the RPCs above. |
| `grant_signup_bonus(user_id)` | System | Idempotent 1-credit signup bonus. Called from `setup-profile.tsx` post-registration. |

### 3.6 RLS Policies (Post-Session 3 — Tightened)

| Table | Operation | USING | WITH CHECK | Notes |
|-------|-----------|-------|------------|-------|
| `listings` | SELECT | `status = 'active' OR owner_id = auth.uid()` | — | Public active listings |
| `listings` | INSERT | — | `owner_id = auth.uid() AND owns user_book` | Must own the book |
| `listings` | UPDATE | `owner_id = auth.uid()` | `owner_id = auth.uid()` | Owner edits only |
| `listings` | DELETE | `owner_id = auth.uid()` | — | Owner deletes only |
| `transactions` | SELECT | `lender_id = auth.uid() OR borrower_id = auth.uid()` | — | Participants only |
| `transactions` | INSERT | — | `borrower_id = auth.uid()` | Borrower creates |
| `transactions` | **UPDATE** | **`false`** | **`false`** | **Tightened 2026-02-18 — all writes via RPC only** |
| `user_addresses` | SELECT/INSERT/UPDATE/DELETE | `user_id = auth.uid()` | `user_id = auth.uid()` | Full CRUD, own data only |
| `credit_events` | INSERT | — | `false` | SECURITY DEFINER functions only |
| `credit_events` | UPDATE/DELETE | `false` | — | Append-only, immutable audit trail |

---

## 4. 8-Step Flow Implementation Map

| Step | Description | Frontend | Backend RPC / Function | Status |
|------|-------------|----------|------------------------|--------|
| **1** | Browse Listings | `exchange/index.tsx` — filter chips (condition ×5, delivery ×3), pull-to-refresh | `listingsService.browseListings(city, filters)` | ✅ **Complete** |
| **2** | Request Book | `[listingId].tsx` — meetup-only Request Book CTA while shipping integrations are disabled | `request_transaction()` RPC | ✅ **Complete for meetup / deferred for Porter-Dunzo** |
| **3** | Approve / Decline | `transaction/[transactionId].tsx` — Approve / Decline buttons (lender, `requested` status) | `approve_transaction()` / `decline_transaction()` | ✅ **Complete** |
| **4** | Payment | Status banner `payment_pending` shown; no action button rendered | `create-payment-order` Edge Fn ❌ / `verify-payment` Edge Fn ❌ | ❌ **Blocked — Razorpay API key** |
| **5** | Ship | Delivery-based actions are guarded with explanatory meetup-only copy | `book-shipment` Edge Fn ❌ | ❌ **Blocked — Porter/Dunzo API key** |
| **6** | Delivery Confirm | "Confirm Delivery" button — borrower, `shipped` status | `transition_transaction_status()` → `delivered` | ✅ **Complete** |
| **7** | Complete Exchange | "Complete Exchange" button — either party, `delivered` status | `complete_transaction()` RPC — atomic credit transfer | ✅ **Complete** |
| **8** | Rate & Review | Completed transaction detail prompt; rating service + hook | `submit_transaction_rating()` RPC; tight INSERT policy validates opposite participant | ✅ **Complete with server-side hardening** |
| **Disputes** | File dispute | Delivered transaction detail form + disputed status banner | `file_transaction_dispute()` RPC + `transaction_events.dispute_opened` metadata | ✅ **Participant filing complete; admin resolution deferred** |

**Summary: Meetup covers the core request → approve → confirm → complete → rate path. Steps 4–5 remain blocked by external APIs and are hidden/guarded in-app.**

---

## 5. Critical Findings

### 5.1 RLS Security — Transactions UPDATE Policy ✅ RESOLVED

**Issue:** The policy `Participants can update their transactions` originally used `USING (lender_id = auth.uid() OR borrower_id = auth.uid())`, allowing either transaction participant to directly UPDATE any column (including `status`) without going through the controlled RPCs.

**Fix applied 2026-02-18 (Session 3):**
```sql
ALTER POLICY "Participants can update their transactions"
  ON public.transactions
  USING (false)
  WITH CHECK (false);
```

**Verified via:**
```sql
SELECT policyname, cmd, qual, with_check
  FROM pg_policies
 WHERE tablename = 'transactions' AND cmd = 'UPDATE';
-- Result: qual = 'false', with_check = 'false' ✅
```

All direct `UPDATE` mutations on `transactions` are now rejected at the database layer. Every state transition must go through a SECURITY DEFINER RPC function. The SELECT policy is unchanged.

### 5.2 Address Phone Field — No Server-Side Validation ⚠️ OPEN

**Issue:** `user_addresses.phone` has no CHECK constraint. `AddressPicker.tsx` (line 66) validates only presence (non-empty), not format.

**Risk:** A direct Supabase client call can write any string to `phone`, bypassing the mobile UI validation.

**Recommended fix:**
```sql
ALTER TABLE user_addresses
  ADD CONSTRAINT phone_format CHECK (phone ~ '^[0-9]{10}$');
```

**Why LOW severity:** All `user_addresses` RLS policies are scoped to `auth.uid() = user_id`. A user can only corrupt their own address data — no cross-user blast radius, no financial impact. A malformed phone number would only surface as a delivery communication issue.

### 5.3 Schema ↔ Service Layer Consistency ✅ No Issues

All service calls verified against live DB schema:

| Service Call | DB Column | Match |
|---|---|---|
| `requestTransaction({ shippingAddressId })` | `transactions.shipping_address_id UUID` | ✅ |
| `addressesService.createAddress()` | `user_addresses` (11 columns) | ✅ |
| `creditService.getCreditBalance()` | `user_credit_balances` (6 columns) | ✅ |
| `listingsService.browseListings()` filter by city | `listings.city TEXT` | ✅ |
| `listingsService.createListing()` photos array | `listings.photos TEXT[]` | ✅ |

### 5.4 TypeScript Errors ✅ Zero

All 5 Exchange screens, 3 new service/hook files, and `AddressPicker` compile with zero TypeScript errors under strict mode. One cosmetically dead branch exists in `[listingId].tsx` (last `else` of the CTA text ternary) — negligible, not a crash risk.

---

## 6. Testing Coverage

### 6.1 Current Coverage

Exchange now has focused automated tests for listing detail, transaction detail, ratings, service instrumentation, delivery capability gating, credit history, and address management. Full lifecycle E2E coverage is still pending.

### 6.2 Recommended Test Priorities

| Test | Type | Priority | Rationale |
|------|------|----------|-----------|
| Porter/Dunzo delivery → address required → request sent with non-null `shipping_address_id` | E2E | **HIGH** | This was the data integrity gap that was broken before Session 2. Most important regression to prevent. |
| Meetup delivery → address picker NOT shown → request sent | E2E | **HIGH** | Verifies the `needsAddress` gate logic doesn't over-restrict |
| Lender: approve → borrower sees `approved` state with correct action buttons | E2E | **MEDIUM** | Verifies role-aware UI rendering for the core approval flow |
| `addressesService.createAddress()` with `isDefault: true` clears previous defaults | Integration | **MEDIUM** | Atomicity of the default-clearing logic. Client-side logic, no DB constraint enforces it. |
| Credit balance display: loads from `user_credit_balances`, shows correct values | Unit | **LOW** | Low logic complexity; `getCreditBalance()` is a direct pass-through query |

### 6.3 Critical Untested Flows

- Complete exchange transaction from browse → request → approve → confirm → complete (full E2E path)
- Credit balance update after `complete_transaction()` (requires real-time query invalidation)
- Error handling when `request_transaction()` RPC fails (insufficient credits, listing already reserved)

---

## 7. Blockers & Dependencies

### 7.1 External API Keys Required

| Integration | Purpose | Status | Impact |
|---|---|---|---|
| **Razorpay** | Refundable deposit payment (₹100–500) | ❌ No sandbox key | Blocks Steps 4 of the transaction flow |
| **Porter** | Intra-city bike courier booking | ❌ No API access | Blocks porter delivery path (Step 5) |
| **Dunzo** | Intra-city delivery booking | ❌ No API access | Blocks dunzo delivery path (Step 5) |

**Action required:** Submit sandbox credential requests for all three providers. Estimated wait: 1–3 business days (Razorpay sandbox is self-serve; Porter and Dunzo require business verification).

### 7.2 Edge Functions Deployment Status

| # | Function | Priority | External Dep | Status |
|---|----------|----------|--------------|--------|
| 1 | `create-payment-order` | CRITICAL | Razorpay | ❌ Blocked |
| 2 | `verify-payment` | CRITICAL | Razorpay webhook | ❌ Blocked |
| 3 | `book-shipment` | CRITICAL | Porter or Dunzo | ❌ Blocked |
| 4 | `complete-transaction` | CRITICAL | **None** | ✅ **Deployed 2026-02-18** |
| 5 | `transfer-credits` | CRITICAL | **None** | ✅ **Deployed 2026-02-18** |
| 6 | `wishlist-notify` | HIGH | FCM | ❌ Blocked |
| 7 | `check-membership-limits` | HIGH | None | ⚡ Buildable now |
| 8 | `send-notification` | HIGH | FCM | ❌ Blocked |
| 9 | `moderate-content` | MEDIUM | None | ⚡ Buildable now |
| 10 | `author-analytics` | LOW | None | ⚡ Buildable now |
| 11 | `generate-referral-code` | LOW | None | ⚡ Buildable now |

**Deployed 2026-02-18:** Functions 4 (`complete-transaction`) and 5 (`transfer-credits`) deployed via Supabase Management API (status: ACTIVE, version 1, verify_jwt: true). Functions 7, 9, 10, 11 remain buildable with no external dependencies.

---

## 8. Recommendation: Complete Now vs. Defer

### 8.1 Decision: Option B — Move to Book Clubs, Defer Exchange Completion

**Recommended next steps:** Deploy `complete-transaction` and `transfer-credits` Edge wrappers (~45 minutes, zero blockers), then context-switch to Clubs frontend for the next 3–4 sessions.

### 8.2 Justification

**Exchange is production-ready for the highest-value flow today.** Steps 1–3 and 6–7 form a complete, testable user journey: browse → request (meetup) → lender approves → borrower confirms → exchange complete, credits transferred. This is the most common real-world use case for early adopters in an Indian city (meetup is culturally preferred over paid delivery for casual book lending).

The two broken steps (4: payment, 5: delivery) are **purely gated by external API key availability** — no amount of frontend or backend engineering unblocks them until Razorpay and Porter/Dunzo credentials arrive. Building stubs or mock flows is waste that will be thrown away.

**Clubs is fully buildable right now.** The database has 13 tables with complete RLS policies. Browse clubs, join a club, view current reading book, and real-time chat all require only PostgREST + Supabase Realtime — zero external dependencies. For an MVP investor demo, a live real-time club chat is more compelling than a payment flow that ends at a disabled button.

### 8.3 Exchange Completion Roadmap (After API Keys Arrive)

| When | Work | Estimated Effort |
|------|------|-----------------|
| This session (now) | Deploy `complete-transaction` + `transfer-credits` Edge wrappers | 45 min |
| Week 5–6 (after Clubs) | `create-payment-order` + `verify-payment` Edge Functions (Razorpay) | 6–8 hours |
| Week 5–6 | `book-shipment` Edge Function (Porter or Dunzo) | 4–6 hours |
| Done 2026-05-10 | Rating & review frontend/service flow | Completed transaction prompt + existing `transaction_ratings` table |
| Done 2026-05-11 | Rating RPC / stricter DB policy | Live RPC and tightened INSERT policy applied; anon EXECUTE revoked |
| Done 2026-05-10 | Credit history screen | Implemented as hidden Profile-linked tab route |
| Done 2026-05-10 | Dedicated address management surface | Implemented as hidden Profile-linked tab route |
| Done 2026-05-11 | Dispute filing flow | Live RPC, frontend form, disputed banner, and resolve/complete action |
| Future | Dedicated dispute moderation/admin resolution | Add staff/admin workflow if product requires adjudication beyond participant resolution |

**Total remaining Exchange effort (post-API-keys):** ~20–26 hours across Weeks 5–7.

### 8.4 Recommended Clubs Build Order (Next 3–4 Sessions)

1. `clubsService.ts` + `useClubs.ts` hooks — service layer first
2. Browse Clubs screen — replaces 11-line placeholder, proves service layer
3. Club Detail screen — join/leave flow, member list, current book
4. `messagesService.ts` + Realtime hook — highest architectural risk, tackle before chat UI
5. Club Chat screen — most complex screen; built with full context established
6. Create Club screen — simplest, gated by membership tier check

---

*This document reflects the state of the P2P Exchange feature as of 2026-02-18, Week 2 Day 1, Session 3. For the authoritative project-wide status including all features, see `docs/audits/PROJECT_STATUS_2026-02-17.md`.*

