# BookTalks Edge Functions - Complete Implementation List

## Overview
This document lists ALL Edge Functions required for the BookTalks MVP, including their priority, purpose, and dependencies.

**Total Functions Required:** 10
- **Critical:** 5 functions (must be implemented before MVP launch)
- **High Priority:** 3 functions (required for core features)
- **Medium Priority:** 2 functions (nice-to-have for MVP)

---

## CRITICAL PRIORITY (Must Implement First)

### 1. `create-payment-order`
**Path:** `supabase/functions/create-payment-order/index.ts`

**Purpose:** Creates a Razorpay order for the refundable deposit when a transaction is approved. Calculates deposit amount based on book condition (₹100-500).

**Dependencies:**
- Razorpay API credentials (RZP_KEY_ID, RZP_KEY_SECRET)
- Supabase service role key
- Access to `transactions` and `listings` tables

**Input:**
```typescript
{ transaction_id: string }
```

**Output:**
```typescript
{
  id: string,           // Razorpay order ID
  amount: number,       // Amount in paise
  currency: "INR",
  receipt: string,
  status: "created"
}
```

**Key Logic:**
- Fetch transaction and listing details
- Calculate deposit: new=₹500, like_new=₹400, good=₹300, acceptable=₹200, poor=₹100
- Create Razorpay order (deposit only, NOT delivery cost)
- Update transaction with `payment_order_id` and `deposit_amount`

**Status:** ❌ Not implemented (documented in architecture doc)

---

### 2. `verify-payment`
**Path:** `supabase/functions/verify-payment/index.ts`

**Purpose:** Webhook handler for Razorpay payment verification. Validates HMAC signature and updates transaction status from PAYMENT_PENDING to READY_TO_SHIP.

**Dependencies:**
- Razorpay webhook secret
- Supabase service role key
- Access to `transactions` and `transaction_events` tables

**Input (Webhook Payload):**
```typescript
{
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: string,
        order_id: string,
        amount: number,
        status: "captured"
      }
    }
  }
}
```

**Key Logic:**
- Verify HMAC signature (security critical!)
- Find transaction by `payment_order_id`
- Update transaction status to `ready_to_ship`
- Insert `payment_completed` event in `transaction_events`
- Send push notification to lender

**Status:** ❌ Not implemented

---

### 3. `book-shipment`
**Path:** `supabase/functions/book-shipment/index.ts`

**Purpose:** Integrates with Porter/Dunzo APIs to create delivery orders. Handles both Porter and Dunzo based on user selection.

**Dependencies:**
- Porter API key (PORTER_API_KEY)
- Dunzo API key + client ID (DUNZO_API_KEY, DUNZO_CLIENT_ID)
- Supabase service role key
- Access to `transactions`, `user_addresses` tables

**Input:**
```typescript
{
  transaction_id: string,
  delivery_service: "porter" | "dunzo"
}
```

**Output:**
```typescript
{
  awb_number: string,      // Tracking number
  tracking_url: string,    // Real-time tracking link
  estimated_cost: number,  // Delivery cost in ₹
  pickup_time: string      // ISO timestamp
}
```

**Key Logic:**
- Fetch lender and borrower addresses
- Calculate distance (intra-city validation)
- Call Porter or Dunzo API based on `delivery_service`
- Store `awb_number`, `tracking_url`, `shipping_cost` in transaction
- Update transaction status to `shipped`
- Send tracking link to both parties

**Status:** ❌ Not implemented (BLOCKING - mentioned in spec but no code)

---

### 4. `complete-transaction`
**Path:** `supabase/functions/complete-transaction/index.ts`

**Purpose:** Executes atomic credit transfer when transaction reaches COMPLETED state. Wraps the `complete_transaction()` SECURITY DEFINER database function.

**Dependencies:**
- Supabase service role key
- Access to `transactions`, `credit_events`, `user_credit_balances` tables

**Input:**
```typescript
{ transaction_id: string, actor_id: string }
```

**Authentication:** `verify_jwt: true` — requires valid user JWT. `actor_id` is validated to match the authenticated caller.

**Key Logic:**
- Validates JWT and enforces `actor_id === auth.uid()` (no spoofing)
- Calls `complete_transaction(p_transaction_id, p_actor_id)` SECURITY DEFINER RPC
- Maps DB exception messages to semantic HTTP codes: 404 (not found), 403 (not participant), 409 (wrong status), 400 (other)
- All atomic credit logic (hold release, borrow_spent, lend_completed) is handled inside the DB function

**Status:** ✅ Deployed 2026-02-18 — function ID `99e49d75-6909-4f83-b64e-a47d7bddecac`, version 1, status ACTIVE

---

### 5. `transfer-credits`
**Path:** `supabase/functions/transfer-credits/index.ts`

**Purpose:** Admin-initiated manual credit transfer between two users. Wraps the `transfer_credits()` SECURITY DEFINER database function. Used for dispute resolution credits, compensation, and corrections.

**Dependencies:**
- Supabase service role key
- Access to `credit_events`, `user_credit_balances`, `user_profiles` tables

**Input:**
```typescript
{
  from_user_id: string,
  to_user_id: string,
  amount: number,      // positive integer
  reason: string,
  admin_id: string     // must match authenticated caller
}
```

**Authentication:** `verify_jwt: true` — requires valid user JWT. `admin_id` is validated to match the authenticated caller (audit trail, not role-gating).

**Key Logic:**
- Validates JWT and enforces `admin_id === auth.uid()`
- Validates amount is a positive integer, UUIDs are valid, from ≠ to
- Calls `transfer_credits(p_from_user_id, p_to_user_id, p_amount, p_reason, p_admin_id)` SECURITY DEFINER RPC
- DB function: verifies source user has sufficient available credits, inserts 2 `admin_adjustment` events (debit + credit), updates both `user_credit_balances` via the existing `update_credit_balance` trigger
- Maps DB exceptions to HTTP codes: 404 (user not found), 422 (insufficient credits), 400 (other)

**Status:** ✅ Deployed 2026-02-18 — function ID `e5a00d25-6919-4ded-8e27-be5404a5b023`, version 1, status ACTIVE

---

### 6. `wishlist-notify`
**Path:** `supabase/functions/wishlist-notify/index.ts`

**Purpose:** Database trigger function that runs on `listings.INSERT`. Checks if any users have the listed book in their wishlist (same city) and sends push notifications.

**Dependencies:**
- Supabase service role key
- Firebase Cloud Messaging (FCM) credentials
- Access to `listings`, `user_wishlist`, `user_profiles`, `user_push_tokens` tables

**Input (Trigger):**
```typescript
NEW listing record from listings table
```

**Key Logic:**
- Extract `google_books_id` and `city` from new listing
- Query `user_wishlist` for matching books
- Filter users by same city (from `user_profiles`)
- Fetch push tokens from `user_push_tokens`
- Send FCM notification with listing link
- Batch notifications (max 5 books per notification if multiple matches)

**Status:** ❌ Not implemented

---

## HIGH PRIORITY (Required for Core Features)

### 6. `check-membership-limits`
**Path:** `supabase/functions/check-membership-limits/index.ts`

**Purpose:** Enforces membership tier limits for club creation. Called before club creation and during downgrade grace period.

**Dependencies:**
- Supabase service role key
- Access to `user_profiles`, `book_clubs` tables

**Input:**
```typescript
{
  user_id: string,
  action: "create_club" | "check_downgrade"
}
```

**Output:**
```typescript
{
  allowed: boolean,
  current_count: number,
  max_allowed: number,
  tier: "free" | "pro" | "pro_plus"
}
```

**Key Logic:**
- Fetch user's membership tier
- Count non-archived clubs created by user
- Check against tier limits: Free=0, Pro=5, Pro+=15
- Return allowed status

**Status:** ❌ Not implemented (mentioned in update summary)

---

### 7. `handle-downgrade-grace-period`
**Path:** `supabase/functions/handle-downgrade-grace-period/index.ts`

**Purpose:** Scheduled job (runs daily) to manage membership downgrade grace period. Sends warnings on Day 7, 14, 21, 29 and auto-archives clubs on Day 30.

**Dependencies:**
- Supabase service role key
- FCM for push notifications
- Access to `user_profiles`, `book_clubs`, `club_members` tables

**Input (Scheduled):**
```typescript
// Runs daily via pg_cron or external scheduler
```

**Key Logic:**
- Find users in downgrade grace period (tier changed in last 30 days)
- Calculate days remaining
- Send warnings on Day 7, 14, 21, 29
- On Day 30: Archive excess clubs (user choice or chronology)
- Update `book_clubs.is_archived` and `archived_at`

**Status:** ❌ Not implemented (mentioned in update summary)

---

### 8. `refund-deposit`
**Path:** `supabase/functions/refund-deposit/index.ts`

**Purpose:** Processes Razorpay refund for deposit after successful delivery or dispute resolution.

**Dependencies:**
- Razorpay API credentials
- Supabase service role key
- Access to `transactions` table

**Input:**
```typescript
{
  transaction_id: string,
  refund_type: "full" | "partial",
  amount?: number  // For partial refunds
}
```

**Output:**
```typescript
{
  refund_id: string,
  status: "processed" | "failed",
  amount: number
}
```

**Key Logic:**
- Fetch transaction and payment details
- Call Razorpay refund API
- Retry logic (3 attempts with exponential backoff)
- If all retries fail, add to admin manual refund queue
- Update transaction with refund status

**Status:** ❌ Not implemented

---

## MEDIUM PRIORITY (Nice-to-Have for MVP)

### 9. `send-batch-notifications`
**Path:** `supabase/functions/send-batch-notifications/index.ts`

**Purpose:** Batches and sends push notifications for club activity, reducing notification spam. Runs hourly.

**Dependencies:**
- FCM credentials
- Supabase service role key
- Access to `club_messages`, `club_members`, `user_push_tokens` tables

**Input (Scheduled):**
```typescript
// Runs hourly via scheduler
```

**Key Logic:**
- Aggregate club messages from last hour
- Group by club and user
- Send single notification per club with message count
- Respect user notification preferences

**Status:** ❌ Not implemented

---

### 10. `cleanup-expired-holds`
**Path:** `supabase/functions/cleanup-expired-holds/index.ts`

**Purpose:** Scheduled job to release credit holds for expired transactions (48-hour timeout). Runs every 6 hours.

**Dependencies:**
- Supabase service role key
- Access to `transactions`, `credit_events` tables

**Input (Scheduled):**
```typescript
// Runs every 6 hours via scheduler
```

**Key Logic:**
- Find transactions in `requested` state older than 48 hours
- Update status to `declined`
- Insert `hold_released` event with reason `transaction_expired`
- Send notification to borrower

**Status:** ❌ Not implemented

---

## Implementation Priority Order

**Week 1-2 (Before Exchange Features):**
1. `create-payment-order` ✓
2. `verify-payment` ✓
3. `complete-transaction` ✓

**Week 3-4 (Exchange System):**
4. `book-shipment` ✓ (CRITICAL - blocks delivery)
5. `refund-deposit` ✓

**Week 5-6 (Clubs & Notifications):**
6. `wishlist-notify` ✓
7. `check-membership-limits` ✓

**Week 7-8 (Scheduled Jobs):**
8. `handle-downgrade-grace-period` ✓
9. `cleanup-expired-holds` ✓
10. `send-batch-notifications` ✓

**Week 9 (Author Features):**
11. `author-analytics` ✓

---

## AUTHOR FEATURES — Edge Functions

### 11. `author-analytics`
**Path:** `supabase/functions/author-analytics/index.ts`

**Purpose:** Returns analytics dashboard data for verified authors. No new tables needed — aggregates from existing tables.

**Dependencies:**
- Supabase service role key

**Request:**
```json
{
  "author_id": "uuid"
}
```

**Response:**
```json
{
  "club_stats": {
    "total_members": 142,
    "member_growth_30d": 23,
    "active_members_7d": 87
  },
  "listing_stats": {
    "total_listings": 8,
    "exclusive_listings": 3,
    "signed_copies_remaining": 12,
    "total_transactions": 45
  },
  "engagement": {
    "ama_questions_received": 67,
    "ama_questions_answered": 54,
    "avg_event_attendance": 34,
    "top_cities": ["Mumbai", "Bangalore", "Delhi"]
  }
}
```

**Key Logic:**
- Verify caller is the author (auth.uid() = author_id AND is_verified_author = true)
- Query `club_members` for member counts and growth (JOIN `book_clubs` WHERE `author_id`)
- Query `listings` for listing stats (WHERE `owner_id = author_id`)
- Query `club_event_questions` for AMA engagement (JOIN `club_events` → `book_clubs`)
- Query `event_rsvps` for event attendance averages
- Query `club_members` → `user_profiles` for top cities (geographic distribution)

**Status:** ❌ Not implemented

---

## Testing Requirements

Each Edge Function must have:
- Unit tests for core logic
- Integration tests with Supabase
- Mock tests for third-party APIs (Razorpay, Porter, Dunzo)
- Error handling tests
- Webhook signature verification tests (where applicable)

---

## Deployment Checklist

Before deploying each function:
- [ ] Environment variables configured in Supabase dashboard
- [ ] Function deployed via `supabase functions deploy <function-name>`
- [ ] Webhook endpoints registered (for verify-payment, book-shipment)
- [ ] Scheduled jobs configured (for periodic functions)
- [ ] Monitoring and logging enabled
- [ ] Error alerting configured

---

**Last Updated:** 2024-01-XX
**Status:** All functions pending implementation

