# BookTalks Schema Reference Guide

> **Status note (2026-03-06):** This guide has been partially corrected to match the live Supabase schema,
> but the canonical database reference is `docs/audits/LIVE_SCHEMA_RECONCILIATION_2026-03-06.md`.
> Use that file when this quick guide and the live DB differ.

**Quick reference for developers implementing database migrations and features.**

---

## Listings Table

```sql
CREATE TABLE listings (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES user_profiles(user_id),  -- Lender/owner of listing
  book_id UUID REFERENCES books(id),
  city TEXT NOT NULL,  -- REQUIRED: Intra-city filtering
  status TEXT CHECK (status IN (
    'active',      -- Available for borrowing requests
    'paused',      -- Temporarily unavailable
    'reserved',    -- Tied to an in-flight request/transaction
    'completed'    -- Listing lifecycle completed
  )),
  condition TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Key Points:**
- Use `owner_id` (not `user_id`) for semantic clarity
- Status tracks listing availability (not transaction state)
- `deposit_amount` belongs on `transactions`, not `listings`
- City field is REQUIRED for intra-city matching

---

## Credit Balances Table

```sql
CREATE TABLE user_credit_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  available NUMERIC(10,2),      -- Spendable credits
  held NUMERIC(10,2),           -- Locked in pending transactions
  lifetime_earned NUMERIC(10,2),
  lifetime_spent NUMERIC(10,2),
  updated_at TIMESTAMPTZ
);
```

**Key Points:**
- Regular TABLE (not materialized view)
- Updated in real-time via AFTER INSERT trigger on `credit_events`
- Trigger function: `update_credit_balance()`
- Real-time updates critical for UX

---

## Venues Table

```sql
CREATE TABLE venues (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  venue_type TEXT CHECK (venue_type IN (
    'cafe',              -- Coffee shops, cafes
    'library',           -- Public libraries
    'bookstore',         -- Bookstores, retailers
    'community_center'   -- Community centers, schools, cultural spaces
  )),
  location GEOGRAPHY(POINT),  -- PostGIS for proximity queries
  verification_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Key Points:**
- Venue types are specific to book-sharing context
- Location uses PostGIS for distance calculations
- No 'coworking' or 'other' types

---

## Edge Functions

See `docs/architecture/EDGE_FUNCTIONS.md` for the planning-oriented Edge Function inventory.
Deployment status should be verified separately from code and infrastructure, not from this quick schema guide.

- `create-payment-order`, `verify-payment`, `book-shipment`
- `complete-transaction`, `transfer-credits`
- `wishlist-notify`, `check-membership-limits`
- Additional planned functions may exist in broader architecture docs; defer to the dedicated Edge Functions document.

---

## Enum Values Reference

### Listings Status
- `'active'` - Available
- `'paused'` - Temporarily unavailable
- `'reserved'` - Requested/in-flight
- `'completed'` - Closed

### Venue Types
- `'cafe'`
- `'library'`
- `'bookstore'`
- `'community_center'`

### Transaction Status
- `'requested'` - Borrower requested
- `'approved'` - Lender approved
- `'payment_pending'` - Awaiting deposit
- `'ready_to_ship'` - Ready for delivery
- `'shipped'` - In transit
- `'delivered'` - Received
- `'completed'` - Dispute window passed
- `'declined'` / `'disputed'` - Rejected/disputed

### Credit Event Types
- `'signup_bonus'` - Initial credits
- `'lend_completed'` - Lending reward
- `'borrow_spent'` - Borrowing cost
- `'hold_placed'` - Credit locked
- `'hold_released'` - Credit unlocked
- `'referral_bonus'` - Referral reward
- `'admin_adjustment'` - Manual adjustment

---

## Column Naming Conventions

| Concept | Column Name | Table |
|---------|-------------|-------|
| Book owner/lender | `owner_id` | listings |
| Transaction lender | `lender_id` | transactions |
| Transaction borrower | `borrower_id` | transactions |
| User reference | `user_id` | most tables |
| Club admin | `admin_id` | book_clubs |

---

## Documentation References

- **Canonical Live Schema:** `docs/audits/LIVE_SCHEMA_RECONCILIATION_2026-03-06.md`
- **Live Migration History:** `supabase/migrations/LIVE_MIGRATION_HISTORY_2026-03-06.md`
- **Database Design Reference:** `docs/architecture/DATABASE.md`
- **Edge Functions Planning:** `docs/architecture/EDGE_FUNCTIONS.md`

---

**Last Updated:** 2026-03-06  
**Status:** 🟡 Partially corrected; defer to live reconciliation docs for canonical truth

