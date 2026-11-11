# SDD 02, part 2: Payment flows

**Part of SDD 02.** Section numbers run across the four files; the map is in the
[overview](./02-0-overview.md). Revised 2026-11-11 after review round 1
([findings](../../PHASE-7-8-sdd02-review-r1.md)).

---

## 8. Starting a payment

The customer presses "Pay" on the Paying screen (SDD 01 §12). The app calls the Edge
Function `commerce-payment-start` with the checkout ID, an idempotency key and a command
ID. The caller's identity comes from the verified JWT, never from the body.

**Step 1, in the database:** `marketplace_sec.begin_payment(p_request_id UUID, p_user_id
UUID, p_idempotency_key TEXT, p_command_id UUID)`, called through its public wrapper (§6).
Idempotency inputs (M1), as SDD 01 §5.0: caller, key and command ID, with `p_request_id`
hashed. The same key and command ID with a different checkout raise `INVALID_COMMAND`. A
replay returns the stored answer; the app then reads `customer_payment_status` for the
current state.

Locks in SDD 01 §7's order: customer advisory lock, payment (if any), checkout. Guards,
using `clock_timestamp()` read after the locks, in this order:

| Guard | Refusal | Message |
|---|---|---|
| 1. Caller owns the checkout | `COMMERCE_ENTITY_UNAVAILABLE` | This checkout is not available. |
| 2. The payment is not `paid` or `paid_late` | `ORDER_ALREADY_PAID` | SDD 01's wording: "Your payment went through. Your order is …" (SDD 01 §5.2) |
| 3. Checkout is `reserved` and the time is before `reservation_expires_at` | `RESERVATION_ENDED` | Your reservation has ended. Please reserve again. |
| 4. The payment is not `initiating`, and no attempt is `pending` | `PAYMENT_IN_PROGRESS` | A payment is already in progress. Please wait for it to finish. |
| 5. No attempt is `amount_mismatch` | `PAYMENT_NOT_ALLOWED` | This payment can't continue. Please reserve again. |
| 6. `pay_presses` is below `commerce.payment_pay_presses_per_checkout` (D-106) | `PAYMENT_ATTEMPTS_EXCEEDED` | Too many payment attempts for this order. Please reserve again. |

There is no pause guard: a pause stops new reservations, and a checkout that is already
reserved may finish paying (D-104, D-81). Guard 2 also covers a payment kept `paid` after a
failed conversion while its checkout is still live (D-95).

Effects, after the guards pass: add 1 to `pay_presses`. Then by the payment's state:

| State | Effect |
|---|---|
| No payment row | Insert one: `initiating`, `start_round = 1`, `start_command_id = p_command_id`, `start_started_at` and `provider_order_expires_at` from the post-lock time, `amount_minor = final_total_minor` |
| `start_failed` | New round: `start_round + 1`, `start_command_id`, `start_started_at`; status `initiating` |
| `created` | Return the session: a retry after a failed or dropped attempt on the same Cashfree order (Q37) |

Answer: `{"payment_id":UUID,"status":TEXT,"start_round":INTEGER,"payment_session_id":TEXT_OR_NULL}`.
Only one round can be `initiating` at a time (guard 4), so concurrent presses make one
Cashfree call per round.

**Step 2, outside the database:** if the answer is `initiating`, call `createOrder` (§7.2)
for that round and record a `create_order` check (with any recovery read).

**Step 3, in the database:** `marketplace_sec.record_provider_order(p_payment_id UUID,
p_check_id UUID, p_start_round INTEGER)`. The command ID is `p_check_id` (M1). Locks:
customer advisory lock, payment, checkout. It acts only if the payment is still
`initiating` and `p_start_round = start_round`; otherwise it changes nothing and returns
the payment's current state (a stale or repeated call, M2).

| The check shows | Checkout still `reserved` | Checkout closed meanwhile |
|---|---|---|
| Order exists (`ok`) | `created`: set `cf_order_id`, `payment_session_id`, `next_poll_at` | `closed_unpaid`, `closed_at`; open `terminate_provider_order`. Answer `RESERVATION_ENDED` with no session (m8) |
| No order (`refused` or `not_found`) | `start_failed`. The app shows "We couldn't start the payment. Nothing was charged. Please try again." | `closed_unpaid`, `closed_at`. Nothing to terminate |
| Unknown (timeout, error, unreadable) | Stays `initiating`; §11.6 recovers it. The app shows "We are confirming your payment. Please do not pay again." | Same |

**Step 4, in the app:** with a session, open Cashfree's web checkout (D-90) as §8.1 says.
Card and bank details never touch BookConnect (CF-35).

**Return:** when Cashfree sends the customer back, the app calls `commerce-payment-check`
(§9.1). Its answer only drives the screen.

### 8.1 Web checkout in the app (m7)

The web build loads `@cashfreepayments/cashfree-js` (version pinned in `package.json` at
slice 2) with `load({ mode: "sandbox" })` on the dev project, and calls
`cashfree.checkout({ paymentSessionId, redirectTarget: "_self" })`: a full-page redirect,
which behaves the same in a phone browser and on the desktop. Cashfree returns the customer
to `return_url`, which carries our `provider_order_id`; the app reads only that ID and
calls `commerce-payment-check`. Before slice 2 is accepted, the owner pays once on a real
phone on sandbox (D-90).

## 9. Verification

### 9.1 What triggers it

Each of these asks Cashfree and applies the answer. None decides anything on its own.

- The customer's return from checkout, through `commerce-payment-check` (limited by §5).
- A webhook naming the payment (§10).
- The poll (§11).
- SDD 01's expiry workers (§12.1) and the duplicate watch (§13.2).
- SDD 03's daily reconciliation, when it finds a Cashfree payment we have not classified
  (§19).

### 9.2 Reading Cashfree (outside locks)

Call `getPayments` for the payment's Cashfree order, and `getOrder` when the order status
is needed, and record the checks (§4.4). If the payments list holds more than one success,
or a success while the payment already has a counted attempt, also call `getRefunds`, so
a success Cashfree has already reversed is recognised (B4). No database lock is held during
a call. If Cashfree cannot be reached, the check records `unreachable`, nothing else
changes, and the trigger retries later (D-101).

### 9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID)`

Service role only, through its wrapper (§6). The command ID is `p_check_id`, so one check
is applied once; a replay of the same check returns its stored answer and changes nothing
(M1). `p_refunds_check_id` is NULL unless §9.2 read refunds.

Locks in SDD 01 §7's order: customer advisory lock, payment, cart, store, checkout, order
if present, stock rows in ID order, listings; rows not needed are skipped, and every row is
re-read after locking. Post-lock `clock_timestamp()` is the verification time.

**Newer and older checks (M4).** A check is older if its `(answered_at, id)` is at or
before that of `last_check_id`. An older check may only insert attempts not yet recorded
and move recorded attempts forward (§4.2). It never changes the payment's status,
`last_check_id`, `provider_closed_confirmed_at` or `next_poll_at`. Any backward move is
skipped, never attempted.

**Order of successes (B3).** Successes not yet classified are taken in Cashfree's
completion order: `provider_completed_at`, then `provider_started_at`, then
`cf_payment_id`. The first one Cashfree completed is the one it keeps (CF-30; confirming
this is CF-A16).

For each payment in the snapshot:

1. **Record or update the attempt** by `cf_payment_id`, only forward (§4.2).
2. **Classify each success not yet classified,** testing in this order (B2, B4):

| Test | Result |
|---|---|
| The refunds check shows a completed automatic reversal of this payment (`refund_type` `PAYMENT_AUTO_REFUND` or `UNRECONCILED_AUTO_REFUND`, `refund_status` `SUCCESS`, full amount) | `reversed`: no order, no refund from us; a reconciliation case for SDD 03 (SDD 01 §5.6) |
| The payment already has a counted attempt, or any attempt on it is `amount_mismatch` | `duplicate_success` (§13.2; D-78; SDD 01 §5.6). The amount does not matter: Cashfree reverses any second success (CF-30) |
| Amount or currency differs from the payment's `amount_minor` / `INR`, or `amount_minor` is NULL (not whole paise) | `amount_mismatch` (§13.1) |
| The checkout is `reserved` or `awaiting_payment_result` | On time: attempt `success`; payment `paid`, `verified_attempt_id`, `paid_at` = verification time, `provider_paid_at`; call `convert_paid_checkout(p_request_id, p_payment_id, p_paid_at, p_command_id = p_check_id)` (SDD 01 §5.5) |
| The checkout is closed (`reservation_expired`, `customer_cancelled`, `platform_cancelled`) | Late: attempt `success`; payment `paid_late`, `verified_attempt_id`, `paid_at`, `provider_paid_at`; call `resolve_late_payment` (SDD 01 §5.6) |

3. **SDD 03's posting** of the received money is called once for the counted attempt, in
   this transaction, keyed by its `cf_payment_id`, whatever the conversion answered: the
   money was received either way, and SDD 03 decides the entries for an order, a refund or
   a failed conversion. Because the key is the payment ID, the failed-conversion retry
   (SDD 01 §5.10) can never post it again (M5).
4. **If `convert_paid_checkout` answers `conversion_failed`,** keep the payment `paid`,
   and in this transaction open the admin case with its 7-day deadline and extend the
   holds (SDD 01 §5.10, D-95). Never raise: that would roll back the record that the
   customer paid.
5. **A success by a method other than UPI or card** is classified as above and the admin is
   alerted to fix the method setting (D-105).
6. **Set the payment's status once** (M3), only for a check that is not older: `paid` and
   `paid_late` stay; otherwise `pending` while any attempt is pending, `created` while the
   checkout is live, `closed_unpaid` (with `closed_at`) once it is closed. If the order
   status is `TERMINATED` or `EXPIRED` and no attempt is pending, set
   `provider_closed_confirmed_at` if not set. Polling continues either way (§11.2, B1).
7. Set `last_check_id` and `next_poll_at` (§11.2), for a check that is not older.

Answer: `{"payment_status":TEXT,"checkout_status":TEXT,"order_id":UUID_OR_NULL,"classified":[{"cf_payment_id":TEXT,"status":TEXT}]}`.
SDD 01's expiry workers branch on `classified`.

### 9.4 What the customer sees

The Paying and Waiting screens in SDD 01 §12 read `customer_payment_status`. While a check
runs, the app shows "We are confirming your payment. Please do not pay again." The result
screens and wording are SDD 01's §10 and §12 (D-108).

## 10. Webhooks

### 10.1 Endpoint

One endpoint, registered once in Cashfree's dashboard for webhook version `2026-01-01`
with the payment, refund and settlement events; orders carry no `notify_url` (m2). Edge
Function `commerce-payment-webhook`, with JWT verification off:

1. Read the raw body before parsing it.
2. Verify the signature and the timestamp age (§7.2). On failure record a `rejected` row
   with no body, answer HTTP 401 and stop.
3. Call `public.commerce_record_webhook` (M10). In **one transaction** it inserts the
   event by `message_key` (§10.2), its body, and a `process_provider_webhook` task (dedupe
   key: the event ID). A repeated key changes nothing.
4. Answer HTTP 200 only after that transaction commits. If it fails, answer HTTP 500 so
   Cashfree retries. Processing happens later, so Cashfree never waits on our work.

### 10.2 Message key

Messages of webhook version `2026-01-01` carry an `x-idempotency-key` header ("a unique
hashed value for each webhook payload"). The message key is `cashfree:` + that header's
value. If the header is missing, the key is our own: `cashfree:` + event type + `:` + the
Cashfree payment ID (or the refund or vendor ID for other events) + `:` + the signed
timestamp. Whether Cashfree's retries repeat the same header value is CF-A21. Either way a
repeat is harmless: payments are also de-duplicated by `cf_payment_id` (§4.2), as Cashfree
recommends.

### 10.3 Processing

The `commerce-task-worker` gets a `process_provider_webhook` branch (M11). It reads the
event and body, acts, and sets `processed` with a code. A message never changes money state
by itself (BC-11).

| Event | Action |
|---|---|
| `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK` | Find the payment by our order ID (`data.order.order_id`); run §9.2 and §9.3 |
| `PAYMENT_CHARGES_WEBHOOK` | Hand the reported charge to SDD 03 (CF-29) |
| Refund events | Hand to SDD 04 |
| Vendor and settlement events | Hand to SDD 05 |
| Unknown type | `processed` with code `ignored_type` |

A payment message naming an order ID we do not have is `processed` with code
`unknown_order` and raises a reconciliation case (SDD 03).

### 10.4 Retries

Processing retries use the task framework (SDD 01 §8.1): its backoff and `max_attempts`
(5). After the last attempt the task is dead-lettered, the event is set `dead` and an admin
case opens. A dead payment message never strands a payment, because the poll reads the same
order (§11). A dead refund or settlement message is SDD 04's or SDD 05's to recover through
their own reconciliation.

### 10.5 Staleness and Cashfree's retries

Cashfree retries at 2, 10 and 30 minutes (CF-37). If a retry carries its original
timestamp, the five-minute rule rejects it and only the poll recovers that payment. The
design is safe either way (CF-A21).

### 10.6 Deleting old bodies (M13)

A daily scheduler step deletes `provider_webhook_bodies` rows older than
`commerce.webhook_body_retention_days` (by `received_at`) and sets `body_purged_at` on their
events. Events, attempts and checks stay.

## 11. The poll

### 11.1 What it polls, and how often it runs (M12)

A new Edge Function `commerce-payment-poll`, started once a minute by the same scheduler
mechanism as `commerce-scheduler`, runs three passes about 20 seconds apart within one
invocation (about 50 seconds in all). Each pass calls `public.commerce_claim_payment_polls`,
which takes up to the §11.5 budget of payments with `next_poll_at <= now()` and no live
lease, oldest first, and sets `poll_lease_until` to two minutes ahead. Each claimed payment
runs §9.2 and §9.3; the lease ends when §9.3 sets the next poll time. A crashed run's
leases simply expire.

### 11.2 Schedule (§17 items 2 and 12)

Every payment except `initiating` and `start_failed` stays on the poll, including `paid`
ones, so a later duplicate or a late success is always found (B1):

- Checkout live (reserved or in grace): every `payment_poll_live_seconds`.
- After the checkout closes or converts: every `payment_poll_after_close_seconds` for
  `payment_poll_after_close_hours`; then every `payment_poll_slow_seconds` until
  `payment_poll_hourly_days` after the close; then daily until `payment_poll_daily_days`
  after the close; then `next_poll_at` is cleared.
- After that, SDD 03's daily reconciliation against Cashfree's records is the safety net
  (D-78: every attempt is reconciled daily) and hands anything new to §9 (§19).

### 11.3 When Cashfree cannot be reached

Nothing changes and the books stay held (D-101). The next poll retries. SDD 01's expiry
workers keep retrying too (SDD 01 §5.3).

### 11.4 Long-unconfirmed closed payments

A `closed_unpaid` payment without `provider_closed_confirmed_at` after
`commerce.closed_payment_alert_hours` opens one admin case (setting
`closed_alert_raised_at`). A success that still arrives is a late payment (§9.3).

### 11.5 Cashfree's rate limits

Cashfree limits calls per minute per account: on sandbox 30 payment reads, 60 order reads
and 30 order creations; production allows more. A shared counter in the database (one row
per minute) counts **every** read of payments by any trigger. The poll claims only what
remains of `commerce.cashfree_reads_per_minute` after the reads already counted that minute,
so customer return checks, webhooks and expiry workers come first and the total stays
under Cashfree's limit (m5). On `rate_limited` (HTTP 429) nothing changes (as for
`unreachable`, D-101). The caller waits at least Cashfree's `x-ratelimit-retry` seconds: the
poll moves `next_poll_at`, webhook processing retries (§10.4), an expiry worker retries its
task, and the customer's check answers "We are still confirming your payment."

### 11.6 Recovering a start round (M2)

Each poll pass also claims payments that are `initiating` with `start_started_at` older
than `commerce.payment_start_recovery_seconds`. For each, it calls `getOrder` with our
`provider_order_id`, records a `read_order` check for that round, and calls
`record_provider_order` with it: an existing order becomes `created`, `not_found` becomes
`start_failed`, and anything else stays `initiating` for the next pass. A crash at any point
of §8 therefore ends in a known state.

## 12. Termination and SDD 01's expiry workers

### 12.1 Provider steps for SDD 01's expiry workers

SDD 01 §5.3 and §5.4 define the steps; this SDD supplies them:

- "Ask Cashfree for the payments and record the answer" is §9.2, recorded as a
  `read_payments` check with `triggered_by = expiry_worker` or `grace_worker`.
- "Run SDD 02's verification" is §9.3 with that check. Its `classified` answer (`success`
  or `amount_mismatch`) is what SDD 01's step 2 branches on.
- "Terminate the Cashfree order" is `terminateOrder`, recorded as a `terminate` check.
  Cashfree does not promise an error when it cannot terminate; it says to "confirm with
  the order_status in response". So the answer's `order_status` decides:

  | Answer | Result |
  |---|---|
  | `TERMINATED`, `TERMINATION_REQUESTED` | Terminated, for SDD 01's command (SDD 01 §5.3). The poll still continues (§11.2) |
  | `EXPIRED` | Terminated: no payment can start on an expired order |
  | `PAID` | `terminate_refused_for_success`; back to §9.2 and §9.3. When every success on the order is a recorded `amount_mismatch`, this counts as terminated (SDD 01 §5.3) |
  | `ACTIVE`, or an error answer | Not terminated: read payments (§9.2, §9.3), then retry termination |
  | `unreachable`, `timeout`, `rate_limited` | Nothing changes; retry (D-101) |

  The exact answers for a paid, expired or already terminated order are CF-A19.
- **No Cashfree order (M2).** If no payment row exists, or the payment is `start_failed`
  (Cashfree confirmed no order), there is nothing to read or terminate: the worker passes
  its own post-step time as both provider times, and the payment (if any) becomes
  `closed_unpaid` when the checkout closes. If the payment is `initiating`, the worker first
  runs §11.6's recovery read for it; while the round is still unknown it retries the task
  and never closes a checkout while a Cashfree order might exist unread.

### 12.2 `terminate_provider_order` task (replaces SDD 01's stub)

Opened by SDD 01 when a checkout closes by customer cancel or D-81, by §8 step 3 and by
§13.1. The `commerce-task-worker` branch (M11) calls `terminateOrder`, records the check
and resolves the task on any answer in §12.1's "terminated" rows. On `ACTIVE` or an error
it reads payments (§9.2, §9.3) and fails the attempt so the framework retries. If Cashfree
cannot be reached it retries; after the last attempt it is dead-lettered to an admin case.
Either way the payment stays on the poll, so a late success is still caught.

## 13. Wrong amount, duplicates and key rotation

### 13.1 Wrong amount (D-29)

Only the first success on a Cashfree order can be a wrong amount (§9.3 order). In the §9.3
transaction: attempt `amount_mismatch`; request SDD 04 category 6 for that attempt's full
amount with refund key `wrong_amount:<cf_payment_id>` (m3); set `refund_requested_at`; open
`terminate_provider_order`; alert the admin. No order is created and no further attempt is
allowed on this payment (§8 guard 5). The checkout runs out on its own timer (SDD 01 §5.3,
D-29). A later success on the same Cashfree order is a duplicate (§13.2).

### 13.2 Duplicate success (D-78)

In the §9.3 transaction: attempt `duplicate_success`, `watch_stage = waiting_reversal`,
`watch_due_at` = `commerce.duplicate_reversal_wait_business_days` business days later. No
refund request. SDD 01 emits `checkout.duplicate_payment` to the customer (D-108): "You
paid twice. The extra ₹X will be returned to you within 2–3 working days after Cashfree
reverses it."

The watch is state on the attempt, not a long-waiting task (M11). The poll (§11) and a daily
scheduler step call `public.commerce_apply_duplicate_watch` for attempts whose
`watch_due_at` has passed or whose order the poll has just read. It runs in one transaction
under SDD 01 §7's order (customer advisory lock, payment, then the rest as needed) with a
`read_refunds` check taken **just before** (B5):

| What the refunds check shows, or what has happened | Result |
|---|---|
| A completed automatic reversal of this `cf_payment_id`: `refund_type` `PAYMENT_AUTO_REFUND` or `UNRECONCILED_AUTO_REFUND`, `refund_status` `SUCCESS`, full amount | `reversal_seen_at`; `watch_stage = reversed`; done |
| Such a reversal still `PENDING`, `PENDING_APPROVAL` or `ONHOLD` | Keep watching; check again next business day |
| Such a reversal `CANCELLED` or `REJECTED`, or none, and `watch_stage = waiting_reversal` at its due time | Open the admin case "Ask Cashfree about this payment"; `watch_stage = asked_cashfree` |
| The admin records "Cashfree will not reverse" (SDD 08's checked command sets `cashfree_answer`) | `refund_due`, due within 1 business day |
| No answer `commerce.duplicate_refund_no_answer_business_days` business days after `cashfree_asked_at` | `refund_due` |
| `refund_due` and still no completed reversal in the fresh refunds check | Request SDD 04 category 6a's refund with key `duplicate:<cf_payment_id>`; `refund_requested_at`; `watch_stage = refund_requested` |
| A reversal completes after our refund | `reversal_seen_at`; open a reconciliation case; the extra amount is BookConnect's loss (D-78) |

The fresh read immediately before any refund request narrows, but cannot remove, the chance
that Cashfree reverses in the same seconds; D-78 accepts that loss and its case.

### 13.3 What never happens

- No webhook body, app message or customer claim changes money state without §9.
- No duplicate is refunded before D-78's conditions.
- No wrong-amount payment becomes an order.
- No reversed payment becomes an order.
- No stock is released while a Cashfree read is missing or stale (D-101).

### 13.4 Key rotation (CF-36, D-104)

Cashfree allows one key pair at a time. Steps, by the owner with an admin:

1. Set the global payment pause (D-55). New reservations stop; paid orders and refunds
   continue (D-104).
2. Wait until no checkout is `reserved` or `awaiting_payment_result` and no payment is
   `initiating` or `pending`: at most the 10-minute reservation plus the 15-minute grace.
3. Generate new keys in Cashfree's dashboard (Developers → API Keys; sandbox and
   production keys are separate); replace both server secrets; redeploy the functions that
   read them. Whether the old keys stop working at once is CF-A24; the procedure assumes
   they do, so calls and webhooks in this gap fail and are retried.
4. Run one sandbox read to prove the new keys work.
5. Webhooks signed with the old key during the swap are rejected and recovered by the poll.
6. Restart under D-68: reconciliation shows no stuck or mismatched payment, and the owner
   restarts with a logged reason.
