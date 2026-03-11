# BookTalks Mobile - Edge Functions

> **Planning note (2026-03-06):** This document is useful for Edge Function design and sequencing,
> but database object names and schema assumptions should be checked against the live-schema references:
> `docs/audits/LIVE_SCHEMA_RECONCILIATION_2026-03-06.md` and
> `supabase/migrations/LIVE_MIGRATION_HISTORY_2026-03-06.md`.

**Runtime:** Deno
**Total Functions:** 11 (6 Critical, 3 High Priority, 2 Medium Priority)
**Last Updated:** 2026-02-18

---

## 1. Overview

Edge Functions handle server-side operations that require:
- Secure API key storage (never exposed to client)
- Atomic database operations (credit transfers)
- Third-party API integration (Razorpay, Porter, Dunzo)
- Webhook signature verification
- Scheduled background jobs

All Edge Functions use Supabase service role key for database access and run in Deno runtime.

---

## 2. Critical Priority Functions

### create-payment-order

**Purpose:** Creates Razorpay order for refundable deposit when transaction is approved.

**Trigger:** Called by client when borrower initiates payment

**Input:** `{ transaction_id: string }`

**Process:**
1. Fetch transaction and listing details from database
2. Calculate deposit based on book condition:
   - New: ₹500
   - Like New: ₹400
   - Good: ₹300
   - Acceptable: ₹200
   - Poor: ₹100
3. Create Razorpay order (deposit only, NOT delivery cost)
4. Update transaction with payment_order_id and deposit_amount
5. Return Razorpay order details to client

**Output:** Razorpay order object (id, amount, currency, receipt, status)

**Error Handling:** Retry logic for Razorpay API failures, rollback transaction update on error

---

### verify-payment

**Purpose:** Webhook handler for Razorpay payment verification.

**Trigger:** Razorpay webhook on payment.captured event

**Input:** Razorpay webhook payload with HMAC signature

**Process:**
1. Verify HMAC signature (CRITICAL for security)
2. Find transaction by payment_order_id
3. Validate payment amount matches deposit_amount
4. Update transaction status to ready_to_ship
5. Insert payment_completed event in transaction_events
6. Send push notification to lender

**Security:** HMAC signature verification prevents fraudulent webhook calls

**Error Handling:** Log failed verifications, alert admin on signature mismatch

---

### book-shipment

**Purpose:** Integrates with Porter/Dunzo APIs to create delivery orders.

**Trigger:** Called by client when lender marks "Ready to Ship"

**Input:** `{ transaction_id: string, delivery_service: "porter" | "dunzo" }`

**Process:**
1. Fetch lender and borrower addresses from user_addresses
2. Validate intra-city delivery (both addresses in same city)
3. Calculate distance using Google Maps Distance Matrix API
4. Call Porter or Dunzo API based on delivery_service:
   - Porter: POST to /v1/orders/create
   - Dunzo: POST to /api/v1/tasks
5. Store awb_number, tracking_url, shipping_cost in transaction
6. Update transaction status to shipped
7. Send tracking link to both parties via push notification

**Output:** `{ awb_number, tracking_url, estimated_cost, pickup_time }`

**Error Handling:** Fallback to alternative service if primary fails, retry logic with exponential backoff

---

### complete-transaction

**Purpose:** Executes atomic credit transfer when transaction reaches COMPLETED state. Wraps the `complete_transaction()` SECURITY DEFINER database function.

**Status:** ✅ **Deployed 2026-02-18** — function ID `99e49d75-6909-4f83-b64e-a47d7bddecac`, version 1, status ACTIVE

**Trigger:** Called by either lender or borrower to confirm physical handoff

**Input:** `{ transaction_id: string, actor_id: string }`

**Authentication:** `verify_jwt: true` — gateway-level JWT validation. `actor_id` must match the authenticated user (prevents spoofing).

**Process:**
1. Validate JWT; enforce `actor_id === auth.uid()`
2. Call `complete_transaction(p_transaction_id, p_actor_id)` SECURITY DEFINER RPC
3. DB function atomically: releases borrower's `hold_placed` credit, debits borrower (`borrow_spent`), credits lender (`lend_completed`), updates transaction status to `completed`

**Error Mapping:**
- `not found` → 404
- `not a participant` → 403
- `Cannot complete transaction in status` → 409
- Other DB errors → 400

**Atomicity:** All credit events and status update happen inside the SECURITY DEFINER function within a single transaction.

---

### transfer-credits

**Purpose:** Admin-initiated manual credit transfer between two users. Used for dispute resolution, compensation, and corrections. Wraps the `transfer_credits()` SECURITY DEFINER database function.

**Status:** ✅ **Deployed 2026-02-18** — function ID `e5a00d25-6919-4ded-8e27-be5404a5b023`, version 1, status ACTIVE

**Trigger:** Called manually by an admin user

**Input:** `{ from_user_id: string, to_user_id: string, amount: number, reason: string, admin_id: string }`

**Authentication:** `verify_jwt: true`. `admin_id` must match the authenticated caller (ensures accurate audit trail in `credit_events.metadata`).

**Validation (before DB call):**
- `amount` must be a positive integer
- All three UUIDs (`from_user_id`, `to_user_id`, `admin_id`) must be valid
- `from_user_id` ≠ `to_user_id`

**Process:**
1. Validate JWT; enforce `admin_id === auth.uid()`
2. Validate all input fields
3. Call `transfer_credits(p_from_user_id, p_to_user_id, p_amount, p_reason, p_admin_id)` SECURITY DEFINER RPC
4. DB function verifies source user has sufficient `available` credits, inserts 2 `admin_adjustment` events (debit + credit), updates both `user_credit_balances` via the `update_credit_balance` trigger

**Error Mapping:**
- `not found` → 404
- `Insufficient credits` → 422
- Other DB errors → 400

---

### wishlist-notify

**Purpose:** Database trigger that notifies users when a wishlisted book is listed.

**Trigger:** Automatically on listings.INSERT

**Input:** New listing record from database trigger

**Process:**
1. Extract google_books_id and city from new listing
2. Query user_wishlist for matching books
3. Filter users by same city (from user_profiles)
4. Fetch push tokens from user_push_tokens
5. Send FCM notification with listing link
6. Batch notifications (max 5 books per notification if multiple matches)

**Performance:** Async execution, doesn't block listing creation

**Error Handling:** Log failed notifications, retry once on FCM error

---

## 3. High Priority Functions

### check-membership-limits

**Purpose:** Enforces membership tier limits for club creation.

**Trigger:** Called before club creation and during downgrade checks

**Input:** `{ user_id: string, action: "create_club" | "check_downgrade" }`

**Process:**
1. Fetch user's membership tier from user_profiles
2. Count non-archived clubs created by user
3. Check against tier limits:
   - Free: 0 clubs
   - Pro: 5 clubs
   - Pro+: 15 clubs
4. Return allowed status with current count and max allowed

**Output:** `{ allowed: boolean, current_count: number, max_allowed: number, tier: string }`

---

### handle-downgrade-grace-period

**Purpose:** Scheduled job to manage membership downgrade grace period.

**Trigger:** Runs daily via pg_cron or external scheduler

**Process:**
1. Find users in downgrade grace period (tier changed in last 30 days)
2. Calculate days remaining in grace period
3. Send warnings on Day 7, 14, 21, 29 via push notification
4. On Day 30:
   - Prompt user to select clubs to keep (if not already selected)
   - Archive excess clubs based on user choice or chronology
   - Update book_clubs.is_archived and archived_at
5. Send final notification with archived club list

**Scheduling:** Daily execution at 2 AM UTC

---

### refund-deposit

**Purpose:** Processes Razorpay refund for deposit after successful delivery or dispute resolution.

**Trigger:** Called after transaction completion or dispute resolution

**Input:** `{ transaction_id: string, refund_type: "full" | "partial", amount?: number }`

**Process:**
1. Fetch transaction and payment details
2. Call Razorpay refund API
3. Retry logic: 3 attempts with exponential backoff
4. If all retries fail, add to admin manual refund queue
5. Update transaction with refund status and refund_id

**Output:** `{ refund_id: string, status: "processed" | "failed", amount: number }`

---

## 4. Medium Priority Functions

### send-batch-notifications

**Purpose:** Batches and sends push notifications for club activity to reduce spam.

**Trigger:** Runs hourly via scheduler

**Process:**
1. Aggregate club messages from last hour
2. Group by club and user
3. Send single notification per club with message count
4. Respect user notification preferences (mute, frequency)

**Example Notification:** "15 new messages in 'Harry Potter Discussion' club"

---

### cleanup-expired-holds

**Purpose:** Scheduled job to release credit holds for expired transactions.

**Trigger:** Runs every 6 hours via scheduler

**Process:**
1. Find transactions in requested state older than 48 hours
2. Update status to declined
3. Insert hold_released event with reason transaction_expired
4. Send notification to borrower

**Timeout:** 48 hours from transaction request

---

## 5. Implementation Priority

**Week 1-2 (Before Exchange Features) — Completed:**
1. ~~create-payment-order~~ → ❌ Blocked (Razorpay keys required)
2. ~~verify-payment~~ → ❌ Blocked (Razorpay webhook required)
3. ✅ `complete-transaction` — Deployed 2026-02-18
4. ✅ `transfer-credits` — Deployed 2026-02-18

**Week 3-4 (Exchange System):**
5. book-shipment (CRITICAL - blocks delivery, Porter/Dunzo keys required)
6. refund-deposit (Razorpay keys required)

**Week 5-6 (Clubs & Notifications):**
7. wishlist-notify
8. check-membership-limits

**Week 7-8 (Scheduled Jobs):**
9. handle-downgrade-grace-period
10. cleanup-expired-holds
11. send-batch-notifications

---

## 6. Deployment

**Deploy Command:**
```
supabase functions deploy <function-name>
```

**Environment Variables:**
Configure in Supabase dashboard under Edge Functions settings:
- SUPABASE_SERVICE_ROLE_KEY
- RZP_KEY_ID, RZP_KEY_SECRET
- PORTER_API_KEY
- DUNZO_API_KEY, DUNZO_CLIENT_ID
- GOOGLE_MAPS_API_KEY
- FCM_SERVER_KEY

**Webhook Registration:**
- verify-payment: Register with Razorpay webhook settings
- book-shipment: Register with Porter/Dunzo webhook settings

**Scheduled Jobs:**
Configure via pg_cron extension or external scheduler (GitHub Actions, Vercel Cron)

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and data flow
- **[DATABASE.md](./DATABASE.md)** - Database schema and tables
- **[THIRD_PARTY_INTEGRATIONS.md](./THIRD_PARTY_INTEGRATIONS.md)** - API integration details
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide and environment setup

