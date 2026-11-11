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
| 2. The payment is not `paid` or `paid_late` | `ORDER_ALREADY_PAID` | For an existing order, SDD 01's wording: "Your payment went through. Your order is …" (§5.2). Without an order (failed conversion, D-95): "Your payment went through. We're finishing your order and will let you know. If we can't, you'll get a full refund." (D-112) |
| 3. Checkout is `reserved` and the time is before `reservation_expires_at` | `RESERVATION_ENDED` | SDD 01 §12's ended screen, selected by whether an attempt exists (§9.4) |
| 4. The payment is neither `initiating` nor `pending`, and no attempt is `pending` or `success_unresolved` | `PAYMENT_IN_PROGRESS` | A payment is already in progress. Please wait for it to finish. |
| 5. No attempt is `amount_mismatch` | `PAYMENT_NOT_ALLOWED` | This payment can't continue. Please reserve again. |
| 6. `pay_presses` is below `commerce.payment_pay_presses_per_checkout` (D-106) | `PAYMENT_ATTEMPTS_EXCEEDED` | Too many payment attempts for this order. Please reserve again. |

There is no pause guard: a pause stops new reservations, and a checkout that is already
reserved may finish paying (D-104, D-81). Guard 2 also covers a payment kept `paid` after a
failed conversion while its checkout is still live (D-95).

Effects, after the guards pass: set `pay_presses = 1` on insertion, or increment an
existing row once. A replay never increments it. Then by the payment's state:

| State | Effect |
|---|---|
| No payment row | Insert one: `initiating`, `start_round = 1`, `start_command_id = p_command_id`, `start_started_at` and `provider_order_expires_at` from the post-lock time, `amount_minor = final_total_minor`, `pay_presses = 1`; freeze `create_request_snapshot` from server-owned amount/contact/return configuration |
| `start_failed` | New round: `start_round + 1`, `start_command_id`, `start_started_at`; refresh expiry from the post-lock clock and freeze that round's body (CF-31); status `initiating` |
| `created` | Return the session: a retry after a failed or dropped attempt on the same Cashfree order (Q37) |

Answer: `{"payment_id":UUID,"status":TEXT,"start_round":INTEGER,"payment_session_id":TEXT_OR_NULL}`.
Only one round can be `initiating` at a time (guard 4). Replayed HTTP requests may repeat
a create call with the same frozen body and provider key; they create one provider order,
not necessarily one physical HTTP call. On replay the app first reads the current payment
state and opens checkout only after a newly accepted Pay press or its own still-valid
start answer; a stale stored session never bypasses the current guards.

**Step 2, outside the database:** if the answer is `initiating`, call `createOrder` (§7.2)
for that round and record a `create_order` check (with any recovery read).

**Step 3, in the database:** `marketplace_sec.record_provider_order(p_payment_id UUID,
p_check_id UUID, p_start_round INTEGER)`. The command ID is `p_check_id` (M1). Locks:
customer advisory lock, payment, checkout. It acts only if `p_start_round = start_round`; an old round changes nothing. An `ok`
answer may fill missing provider identity for the current round even if verification
already won, but never replaces conflicting identity or changes a `paid`/`paid_late`
state. The table's state changes apply only while still `initiating`. Replays return the
current state without another effect (M2). Validate that the check belongs
to this payment and round and is a `create_order` or recovery `read_order` check; other
inputs raise `INVALID_COMMAND`. An `ok` answer always persists the provider IDs, session
and initial poll time before applying the table. A session is returned only while the
checkout is `reserved` and post-lock time is before `reservation_expires_at`; after that,
return `RESERVATION_ENDED` without a session and let the expiry worker finish. If the
checkout closed, set `poll_window_started_at` and enqueue termination in the same commit.

| The check shows | Checkout still `reserved` | Checkout closed meanwhile |
|---|---|---|
| Order exists (`ok`) | `created`: set `cf_order_id`, `payment_session_id`, `next_poll_at` | `closed_unpaid`, `closed_at`; open `terminate_provider_order`. Answer `RESERVATION_ENDED` with no session (m8) |
| No order (definitive `refused`, §7.2) | `start_failed`. The app shows "We couldn't start the payment. Nothing was charged. Please try again." | `closed_unpaid`, `closed_at`. Nothing to terminate |
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
calls `commerce-payment-check`. Before slice 3 is accepted, the owner pays once on a real
phone on sandbox, including the verified return (D-90).

## 9. Verification

### 9.1 What triggers it

Each of these asks Cashfree and applies the answer. None decides anything on its own.
`commerce-payment-check` verifies the JWT and resolves the checkout's owner on the server
before any provider call. A stranger or unknown order gets `COMMERCE_ENTITY_UNAVAILABLE`
with no provider call. The answer is only the caller's `customer_payment_status`
projection, never §9.3's internal attempts or check IDs.

- The customer's return from checkout, through `commerce-payment-check` (limited by §5).
- A webhook naming the payment (§10).
- The poll (§11).
- SDD 01's expiry workers (§12.1) and the duplicate watch (§13.2).
- SDD 03's daily reconciliation, when it finds a Cashfree payment we have not classified
  (§19).

### 9.2 Reading Cashfree (outside locks)

Call `getPayments` for the payment's Cashfree order, and `getOrder` when the order status
is needed, and record the checks (§4.4). For every reported success, including a single first success,
also call `getRefunds`, so a success Cashfree has already reversed is recognised (B4). No database lock is held during
a call. The caller passes each read's check ID explicitly to §9.3; checks from another
payment or of a different kind are never interchangeable. If Cashfree cannot be reached, the check records `unreachable`, nothing else
changes, and the trigger retries later (D-101).

### 9.3 Applying the answer: `marketplace_sec.apply_payment_check(p_payment_id UUID, p_check_id UUID, p_refunds_check_id UUID, p_order_check_id UUID)`

Service role only, through its wrapper (§6). The command ID is `p_check_id`, so one check
is applied once; a replay of the same check returns its stored answer and changes nothing
(M1). `p_refunds_check_id` is NULL unless §9.2 read refunds. Bind both IDs and
`p_payment_id` and nullable `p_order_check_id` to the saved command inputs; any changed tuple raises `INVALID_COMMAND`.
The checks must belong to this payment: `p_check_id` is `read_payments`, the optional
refunds check is `read_refunds`, and the optional order check is `read_order`. They must
have outcome `ok` and be
complete. Any required read that failed or is older than
`commerce.provider_check_max_age_seconds` by the post-lock clock returns
`PROVIDER_CHECK_STALE` before classification, conversion or refund; the trigger retries
with fresh checks. A missing refunds check for a reported success also fails closed.
A cached pre-refund check cannot authorize a later refund request. Order status is used
only from `p_order_check_id`, never inferred from a payments list. NULL means that no
order-status fact is applied.

Locks in SDD 01 §7's order: customer advisory lock, payment, cart, store, checkout, order
if present, stock rows in ID order, listings; rows not needed are skipped, and every row is
re-read after locking. Post-lock `clock_timestamp()` is the verification time.

**Newer and older checks (M4).** A check is older if its `(requested_at, id)` is at or
before that of `last_check_id`. Only `read_payments` checks participate in this ordering.
An older check may add attempt evidence and a reported success as `success_unresolved`,
but may not finalize a newly discovered success or invoke conversion or refund. Receipt
posting remains allowed and idempotent, as step 3 requires for every observed receipt.
It returns `needs_fresh_read = true`; the caller obtains and applies a new check, even if
the older check was otherwise replayed. It never changes the payment's status,
`last_check_id`, `provider_closed_confirmed_at` or `next_poll_at`. A recorded terminal
attempt is not downgraded by an older pending/failed answer. This prevents both a stale
status overwrite and a success marked terminal with no matching paid payment.

**Which success counts (B3; D-109).** D-29: the first verified success counts
and becomes the order; any success verified after it on the same Cashfree order is a
duplicate. A single success is counted as soon as it is verified; it never waits for a
Cashfree answer. If one check shows several successes not yet classified, they are taken
in this order: `provider_completed_at`, then `provider_started_at`, then `cf_payment_id`
(missing times sort last). This order only makes the choice repeatable; it is not a claim
about which payment Cashfree keeps. Cashfree's docs do not say which one it keeps (CF-A16;
checked 2026-11-12). They do show that its automatic refund names the payment it gave back
(`cf_payment_id` on the refund and on `AUTO_REFUND_STATUS_WEBHOOK`). If Cashfree gives back
the payment we counted, the customer has still paid once and has one order; §13.5 corrects
our records. No money is lost by counting first.

`success_unresolved` is only a short wait for evidence, never a hold on Cashfree's answer:
a success seen by an older check (above), or one whose refunds read is missing, failed or
stale, stays `success_unresolved` until the next fresh read classifies it. While Cashfree
cannot be read, the books stay held (D-101).

For each payment in the snapshot:

1. **Record or update the attempt** by `cf_payment_id`, only forward (§4.2). A newly
   reported success remains `success_unresolved` until step 2 chooses its final class.
2. **Classify each success not yet classified,** testing in this order (B2, B4):

| Test | Result |
|---|---|
| The refunds read shows a completed automatic reversal of this payment (`refund_type` `PAYMENT_AUTO_REFUND` or `UNRECONCILED_AUTO_REFUND`, `refund_status` `SUCCESS`, same currency and full amount) | `reversed`: no order, no refund from us; a reconciliation case for SDD 03 (SDD 01 §5.6) |
| The refunds read for this success is missing, failed or stale, or the check is older (above) | `success_unresolved` until the next fresh read; no conversion or refund yet |
| This is a distinct extra success after the payment already has a counted attempt or an `amount_mismatch` | `duplicate_success` (§13.2; D-78; SDD 01 §5.6). The amount does not matter: Cashfree reverses any second success (CF-30) |
| Amount or currency differs from the payment's `amount_minor` / `INR`, or `amount_minor` is NULL (not whole paise) | `amount_mismatch` (§13.1) |
| The checkout is `reserved` or `awaiting_payment_result` | On time: attempt `success`; payment `paid`, `verified_attempt_id`, `paid_at` = verification time, `provider_paid_at`; call `convert_paid_checkout(p_request_id, p_payment_id, p_paid_at, p_command_id = p_check_id)` (SDD 01 §5.5) |
| The checkout is closed (`reservation_expired`, `customer_cancelled`, `platform_cancelled`) | Late: attempt `success`; payment `paid_late`, `verified_attempt_id`, `paid_at`, `provider_paid_at`; call `resolve_late_payment` (SDD 01 §5.6) |

3. **SDD 03's receipt posting** is called once for every observed successful receipt,
   including unresolved, wrong-amount and duplicate receipts, keyed by
   `receipt:<cf_payment_id>`. For an unrepresentable fractional amount or unsupported
   currency, record exact receipt evidence and a reconciliation case first; do not invent
   a whole-paisa ledger amount. Posting waits for Cashfree's exact monetary correction. It records receipt of money, not a sale. A sale posting runs
   only on `converted`, keyed by `order:<order_id>`, including a later successful admin
   retry (SDD 01 §5.10). No sale posts for `conversion_failed` or `refund_requested`.
   Reversals use `reversal:<cf_refund_id>`; SDD 04 posts our refunds by its own refund ID.
   Repeated checks and conversion retries cannot post the same fact twice (M5; SDD 03 §3).
4. **If `convert_paid_checkout` answers `conversion_failed`,** keep the payment `paid`,
   and in this transaction open the admin case with its 7-day deadline and extend the
   holds (SDD 01 §5.10, D-95). Never raise: that would roll back the record that the
   customer paid.
5. **A success by a method other than UPI or card** is classified as above and the admin is
   alerted to fix the method setting (D-105).
6. **Set the payment's status once** (M3), only for a check that is not older: `paid` and
   `paid_late` stay; otherwise `closed_unpaid` (with `closed_at`) once the checkout closed,
   even while attempts remain pending. While live, use `pending` for any pending or
   unresolved success; otherwise retain `initiating` until creation is recorded, or use
   `created` for a known provider order. A `start_failed` payment is not sent to this step. If the order
   status is `TERMINATED` or `EXPIRED` and no attempt is pending, set
   `provider_closed_confirmed_at` if not set. Polling continues either way (§11.2, B1).
7. Set `last_check_id` and `next_poll_at` (§11.2), for a check that is not older. Set
   `poll_window_started_at` once on close or conversion. Never release another trigger's
   poll lease; only its token holder finishes it (§11.1).

Answer: `{"payment_status":TEXT,"checkout_status":TEXT,"order_id":UUID_OR_NULL,"classified":[{"cf_payment_id":TEXT,"status":TEXT}],"needs_fresh_read":BOOLEAN}`.
SDD 01's expiry workers branch on `classified`.

### 9.4 What the customer sees

The Paying and Waiting screens in SDD 01 §12 read `customer_payment_status`. While a check
runs, the app shows "We are confirming your payment. Please do not pay again." The result
screens and wording are SDD 01's §10 and §12 (D-108). A customer whose payment was verified but whose order could not yet be created (D-95)
sees "Your payment went through. We're finishing your order and will let you know. If we can't, you'll get a full refund." (D-112).

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
cleaned dispatch envelope through `commerce_read_webhook_work`, acts, and uses
`commerce_finish_webhook_work` to complete it. No raw body leaves the database. A message never changes money state
by itself (BC-11).

| Event | Action |
|---|---|
| `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK` | Find the payment by our order ID (`data.order.order_id`); run §9.2 and §9.3 |
| `PAYMENT_CHARGES_WEBHOOK` | Hand the reported charge to SDD 03 (CF-29) |
| `AUTO_REFUND_STATUS_WEBHOOK` (Cashfree's automatic refund, for example "Multiple payments were performed against same order") | Find the payment by our order ID; run §9.2 and §9.3 (with the refunds read), then the duplicate watch (§13.2) and §13.5 |
| Other refund events (`REFUND_STATUS_WEBHOOK`) | Hand to SDD 04 |
| Vendor and settlement events | Hand to SDD 05 |
| Unknown type | `processed` with code `ignored_type` |

A payment message naming an order ID we do not have is `processed` with code
`unknown_order` and raises a reconciliation case (SDD 03).

### 10.4 Retries

Processing retries use the task framework (SDD 01 §8.1): its backoff and `max_attempts`
(5). After the last attempt the task is dead-lettered, the event is set `dead` and an admin
case opens. The finish wrapper validates event/task identity, the live lease owner and
attempt number, then calls the framework completion and updates the event and case in
one transaction. It handles success, retry and final failure; terminal replays are no-ops.
This branch does not also call the worker's generic completion path. A crash after an
idempotent domain handover but before finish replays that handover without another effect.
The migration adds a pre-dispatch reclaim guard for this SDD's task types: an expired
lease already at `max_attempts` is dead-lettered with its event and case atomically,
without dispatching a sixth attempt. The existing Phase 6 claim increments on every
expired-lease reclaim, so its configured cap alone does not provide this guard.
A dead payment message never strands a payment, because the poll reads the same
order (§11). A dead refund or settlement message is SDD 04's or SDD 05's to recover through
their own reconciliation.

### 10.5 Staleness and Cashfree's retries

Cashfree retries at 2, 10 and 30 minutes (CF-37). If a retry carries its original
timestamp, the five-minute rule rejects it and only the poll recovers that payment. The
design is safe either way (CF-A21).

### 10.6 Deleting old bodies (M13)

A daily scheduler step deletes `provider_webhook_bodies` rows older than
`commerce.webhook_body_retention_days` (by `received_at`) and sets `body_purged_at` on their
events, through `commerce_purge_webhook_bodies`. The daily runner uses the scheduler's
checked service boundary; it repeats bounded batches until no expired body remains.
Events, attempts and checks stay.

## 11. The poll

### 11.1 What it polls, and how often it runs (M12)

A new Edge Function `commerce-payment-poll` needs its own authenticated once-a-minute
scheduler registration; the existing scheduler contract enables no cron by itself.
Use the scheduler's checked secret boundary, with no public unauthenticated dispatch.
It starts passes at about 0, 20 and 40 seconds, bounds the invocation to 50 seconds,
and stops claiming work it cannot finish within that budget. Each pass calls
`public.commerce_claim_payment_polls`, which claims due rows oldest first with
`FOR UPDATE SKIP LOCKED`, sets `poll_lease_until` two minutes ahead and a fresh
`poll_lease_token`. Each claim runs §9.2 and §9.3 and then
`commerce_finish_payment_poll` with its token. Ordinary verification never releases the
lease. A stale owner cannot clear or reschedule a replacement lease. Stop provider calls
before lease expiry; a crashed run's lease expires. Recovery in §11.6 uses this same
claim/fence. Twenty seconds is a target under the shared read budget, not a guarantee
under load. Calls denied a permit are rescheduled without guessing a payment outcome.

### 11.2 Schedule (§17 items 2 and 12)

Every payment except `initiating` and `start_failed` stays on the poll, including `paid`
ones; §11.6 recovers `initiating`. A later duplicate or late success is discovered by this
poll or by the required daily reconciliation after its window (B1):

- Checkout live (reserved or in grace): every `payment_poll_live_seconds`.
- After the checkout closes or converts: every `payment_poll_after_close_seconds` for
  `payment_poll_after_close_hours`; then every `payment_poll_slow_seconds` until
  `payment_poll_hourly_days` after the close; then daily until `payment_poll_daily_days`
  after `poll_window_started_at`; then `next_poll_at` is cleared. The same timestamp
  anchors every after-close interval above and is not reset by later checks or refunds.
- After that, SDD 03's daily reconciliation against Cashfree's records is the safety net
  (D-78: every attempt is reconciled daily) and hands anything new to §9 (§19). Do not
  clear the poll until that repair handover is implemented and healthy; otherwise keep
  daily polling. Unresolved successes and duplicate watches also retain their recovery.

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
per account, environment and endpoint, §4) admits **every** provider read by any trigger
before the HTTP call. `commerce_take_cashfree_read_permit` locks the current budget row,
checks its rolling prior-minute usage and `retry_not_before`, and atomically consumes one
permit or returns a retry time. A permit is consumed even if the call times out. Poll
claims are not permits. Payment reads share `commerce.cashfree_reads_per_minute` (25);
order reads also share a conservative 25/minute local cap, below the documented 60;
refund reads use the same conservative cap pending confirmation of their limit. Customer
checks, webhooks and expiry work are dispatched before background poll claims; they still
need permits and may wait. Budget denial is retryable under the same task backoff;
no payment outcome changes.
No caller bypasses the counter. Keep minute rows for at least two minutes and count the
current and previous bucket so boundary bursts cannot exceed the rolling cap (m5).
Use the greatest `retry_not_before` across retained bucket rows, so crossing a minute
boundary never bypasses provider backoff. On `rate_limited` (HTTP 429) nothing changes (as for
`unreachable`, D-101). The caller waits at least Cashfree's `x-ratelimit-retry` seconds: the
poll moves `next_poll_at`, webhook processing retries (§10.4), an expiry worker retries its
task, and the customer's check uses §9.4's confirming text. Persist the endpoint's
`retry_not_before` so all invocations observe the same backoff.

### 11.6 Recovering a start round (M2)

Each poll pass also claims payments that are `initiating` with `start_started_at` older
than `commerce.payment_start_recovery_seconds`. For each, it calls `getOrder` with our
`provider_order_id`, records a `read_order` check for that round, and calls
`record_provider_order` with it: an existing order follows §8 step 3, including its
closed-checkout branch. A `not_found` after an uncertain create stays `initiating`:
CF-A23 does not establish finality of a negative read. While still eligible to pay, recovery
may retry the identical frozen create body and original round key, never a fresh round
for an unknown outcome. If Cashfree refuses that frozen expiry or the result stays unknown,
keep reconciling the stable order ID and open an admin case; never report "Nothing was
charged" from a negative lookup alone. After closure, recovery never returns a session;
once it finds an order it schedules termination and the normal poll. The additional
create-finality question in §16 must be answered before relying on a negative lookup to
release stock. Uncertain retries preserve that round's original expiry; they never silently extend it.
Only a new round after definitive no-order refreshes it, so a retry more than a minute
later can still meet Cashfree's over-15-minute minimum (CF-31).

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
  | `PAID` | `terminate_refused_for_success`; back to §9.2 and §9.3. When no payment on the order was counted and every success on it is a recorded `amount_mismatch`, `duplicate_success` or `reversed` (D-113), this counts as terminated (SDD 01 §5.3) |
  | `ACTIVE`, or an error answer | Not terminated: read payments (§9.2, §9.3), then retry termination |
  | `unreachable`, `timeout`, `rate_limited` | Nothing changes; retry (D-101) |

  The exact answers for a paid, expired or already terminated order are CF-A19. SDD 01's
  `PAID` refusal shortcut covers any mix of `amount_mismatch`, `duplicate_success` and
  `reversed` successes when none was counted (D-113); otherwise, without a terminating
  answer, retain the holds and retry.
- **Locked evidence boundary (M2; RX2-08).** The worker calls
  `commerce_expire_with_payment_evidence` (§6), not SDD 01's expiry RPC directly. In the
  full SDD 01 §7 order, this wrapper takes the customer advisory lock, re-resolves and locks
  the payment if present, then cart, store, checkout and any remaining required rows. It
  re-reads the payment before using the no-order shortcut. Only if no payment exists, or
  a definitive `start_failed` with no unresolved create exists, may it derive both provider
  times from its post-lock clock. A payment inserted since the worker's earlier read
  invalidates that shortcut and raises `PROVIDER_CHECK_STALE`. Otherwise it validates the
  supplied check IDs, their payment/kinds/outcomes and fresh payments read using the
  post-lock clock, then calls the unchanged SDD 01 expiry command in this transaction,
  deriving the two timestamps from that evidence. NULL IDs are accepted only for the
  locked no-order case. A `success_unresolved` attempt (waiting for its fresh read, §9.3)
  returns `PROVIDER_CHECK_STALE`, including at grace end, so the worker reads again; it
  cannot release stock.
  When creation is `initiating`, run §11.6 recovery outside locks and retry while unknown.
  When the checkout closes, this transaction sets the unpaid payment `closed_unpaid`,
  `closed_at`, `poll_window_started_at` and `next_poll_at` together. An unknown create is
  never treated as no order. Customer cancellation remains SDD 01 §5.2's explicit option.

### 12.2 `terminate_provider_order` task (replaces SDD 01's stub)

Opened by SDD 01 when a checkout closes by customer cancel or D-81, by §8 step 3 and by
§13.1. First synchronize the closed checkout in a database transaction under customer
advisory lock, payment, then checkout: preserve counted `paid`/`paid_late`; keep an unknown
`initiating` round recoverable; otherwise set unpaid `closed_unpaid` and `closed_at`.
Set `poll_window_started_at` once and schedule the known provider order's poll, including
customer and D-81 cancellations. A definitive no-order payment needs no payment poll.
The `commerce-task-worker` branch (M11) calls `terminateOrder`, records the check
and resolves the task on any answer in §12.1's "terminated" rows. On `PAID`, first
run verification: resolve if the counted receipt is handled, or all receipts are known
mismatch/duplicate/reversed cases; otherwise retry and alert the admin. With no payment
row or definitive `start_failed`, resolve without a provider call. An `initiating` payment
runs recovery first and never treats a negative lookup as completed termination. On `ACTIVE` or an error
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
The request carries the attempt ID, `cf_payment_id`, exact amount text and currency as
well as whole paise when representable. SDD 04 locks this payment and deduplicates by
that attempt/key; all sent, pending and unknown refunds count toward the attempt's cap.
A fractional-paisa or unsupported-currency receipt is never rounded into an INR refund:
record the mismatch and an admin case, and obtain Cashfree's exact refundable amount and
currency before the money call (additional question in §16). D-29 still requires its full
refund. Persist the refund intent with SDD 04 in this transaction; external refund calls
happen later, outside locks.

### 13.2 Duplicate success (D-78)

In the §9.3 transaction: attempt `duplicate_success`, `watch_stage = waiting_reversal`,
`watch_due_at` = `commerce.duplicate_reversal_wait_business_days` business days later. No
refund request. SDD 01 emits `checkout.duplicate_payment` to the customer (D-108): "You
paid twice. The extra ₹X will be returned to you within 2–3 working days after Cashfree
reverses it."
Use a child event command UUID derived from the attempt ID and `checkout.duplicate_payment`,
and event key `checkout.duplicate_payment:<cf_payment_id>`; keep the check ID as
correlation. Two duplicates in one check get separate identities. This obeys Phase 6's
unique `(command_id, event_type)` index and emits each notice once across later checks.

The watch is state on the attempt, not a long-waiting task (M11). The poll (§11) and a daily
scheduler step call `public.commerce_apply_duplicate_watch` for attempts whose
`watch_due_at` has passed or whose order the poll has just read. It runs in one transaction
under SDD 01 §7's order (customer advisory lock, payment, then the rest as needed) with a
`read_refunds` check taken **just before** (B5). Its check must belong to this payment,
have kind `read_refunds`, outcome `ok` and be fresh by the post-lock clock (§9.3's maximum
age). Missing, failed, stale or unconfirmed reversal evidence never means "no reversal".
Validate the check ID/attempt binding; store `last_watch_check_id`. Replays are no-ops.
Re-read the attempt, refund intent and reversal facts under the payment lock before
requesting a refund. The rows below are evaluated in order; ordinary waiting never
postpones a D-78 deadline:

SDD 08's checked command records `cashfree_asked_at` on the actual enquiry, and
`cashfree_answered_at` on `will_not_reverse`, once with an audit trail. Opening the case
alone is not a claim that Cashfree was contacted. The no-answer period starts when the case
opens (`ask_case_opened_at`), whether or not anyone has contacted Cashfree yet (D-110); an
uncontacted case stays visible to the admin and owner until resolved.

| What the refunds check shows, or what has happened | Result |
|---|---|
| Cashfree gave back the payment we counted instead (§13.5), this duplicate has no completed reversal, and no refund intent exists | This duplicate is the payment Cashfree kept: `watch_stage = kept_by_cashfree`; never refunded; done. If several duplicates qualify, only the first in §9.3's order is kept; the others keep being watched |
| A confirmed completed full-amount, same-currency automatic reversal of this `cf_payment_id` appears after our refund intent (`refund_requested_at` set) | Set `reversal_seen_at` once; alert SDD 04 to stop an unsent intent if it can. If our refund succeeded or its result is unknown, open one reconciliation case and hand SDD 03 the confirmed extra loss when known (D-78); never send another refund |
| A completed automatic reversal of this `cf_payment_id`, before our refund intent: confirmed representation, `refund_status` `SUCCESS`, same currency and full amount | Set `reversal_seen_at`; `watch_stage = reversed`; post the reversal to SDD 03 once; done |
| No completed reversal and `watch_stage = waiting_reversal` at its due time, including a `PENDING`, `PENDING_APPROVAL`, `ONHOLD`, `CANCELLED` or `REJECTED` reversal | Open one admin case "Ask Cashfree about this payment"; set `ask_case_opened_at`; `watch_stage = asked_cashfree`; keep the enquiry due until recorded |
| The admin records "Cashfree will not reverse", and no refund intent exists | Set `refund_due_at` no later than 1 business day after `cashfree_answered_at`; `watch_stage = refund_due` |
| No answer `commerce.duplicate_refund_no_answer_business_days` business days after `ask_case_opened_at` (D-110), and no refund intent exists | Set `refund_due_at` to that deadline; `watch_stage = refund_due` |
| `refund_due` and no completed reversal in the fresh refunds check | Persist SDD 04 category 6a's intent with attempt identity, exact amount/currency and key `duplicate:<cf_payment_id>`; set `refund_requested_at` and `watch_stage = refund_requested`; one request only, outside-lock sender later |
| Incomplete reversal and no refund deadline reached | Keep watching; next check no later than the earlier of next business day and the current policy deadline |
| `refund_requested` and no completed reversal | Continue daily reconciliation with SDD 03 and SDD 04, including after the ordinary payment-poll window; never request again |

The same check may advance the watch through enquiry/answer/deadline rows and request the
refund in that transaction; it must not wait for another day after a deadline. The first
completed-reversal row also posts that reversal once by its provider refund ID. SDD 03
posts any confirmed double-return loss with key `duplicate_loss:<cf_payment_id>`, feeding
D-08 once and never charging the store. The watch's daily runner has the same checked
scheduler boundary as §11.1. SDD 04 receives pending/unknown refund amounts in the same
attempt-level cap used for wrong amounts (§13.1).

The fresh read immediately before any refund request narrows, but cannot remove, the chance
that Cashfree reverses in the same seconds; D-78 accepts that loss and its case.

### 13.3 What never happens

- No webhook body, app message or customer claim changes money state without §9.
- No duplicate is refunded before D-78's conditions.
- No wrong-amount payment becomes an order.
- No reversed payment becomes an order.
- No order waits for Cashfree to say which of two payments it keeps (§9.3, §13.5).
- No stock is released while a Cashfree read is missing or stale (D-101).

### 13.4 Key rotation (CF-36, D-104)

Cashfree allows one key pair at a time. Steps, by the owner with an admin:

1. Set the global payment pause (D-55). New reservations stop; paid orders and refunds
   continue (D-104).
2. Wait until no checkout is `reserved` or `awaiting_payment_result` and no payment is
   `initiating` or `pending`. This usually takes up to 25 minutes (the 10-minute
   reservation plus the 15-minute grace), but that is not a deadline: a Cashfree outage
   (D-101) or a failed conversion (D-95) can keep a checkout open longer, and the admin
   clears those cases first (D-111).
   **If a key has leaked, skip this wait** and go straight to step 3 (D-111). Payments in
   progress during the swap are recovered by the poll (§11) once the new keys work; any
   that cannot be recovered open admin cases.
3. Generate new keys in Cashfree's dashboard (Developers → API Keys; sandbox and
   production keys are separate); replace both server secrets; redeploy the functions that
   read them. Whether the old keys stop working at once is CF-A24; the procedure assumes
   they do, so calls and webhooks in this gap fail and are retried.
4. Run one sandbox read to prove the new keys work.
5. Webhooks signed with the old key during the swap are rejected and recovered by the poll.
6. Restart under D-68: reconciliation shows no stuck or mismatched payment, and the owner
   restarts with a logged reason.

### 13.5 Cashfree gives back the payment we counted (D-109)

We count the first verified success (§9.3, D-29). Cashfree may instead keep the other
payment and give back the one we counted; its docs do not say which it keeps (CF-A16).
The customer has still paid once and has one order, so nothing changes for them or for
the order. Only our records are corrected.

Seen when a fresh refunds read (from §9.3, the duplicate watch or an
`AUTO_REFUND_STATUS_WEBHOOK`) shows a completed automatic reversal (as in §9.3's first row)
of the attempt named by `verified_attempt_id`. In one transaction under SDD 01 §7's order:

1. Set `reversal_seen_at` on the counted attempt once. Its status stays `success`, the
   payment stays `paid` or `paid_late`, and the order is not touched.
2. Post the reversal to SDD 03 once, keyed `reversal:<cf_refund_id>`.
3. Run the duplicate watch (§13.2) for this payment's duplicates in the same transaction:
   the first one without a completed reversal becomes `kept_by_cashfree` and is never
   refunded by us.
4. Open one reconciliation case so SDD 03 records which receipt Cashfree kept. If no
   duplicate qualifies (each already reversed, or already refunded by us), the customer
   got all their money back while keeping the order: the case says so and SDD 03 records
   the loss once with key `duplicate_loss:<cf_payment_id>` (D-78).
5. No customer notice: D-108's "the extra ₹X will be returned" is still true.

A payment counted as `paid_late` and refunded under SDD 01 §5.6 follows SDD 04's refund
rules; if Cashfree also gave it back, the same case and loss key apply. Where the first
success was an `amount_mismatch` (refunded by us under §13.1) and Cashfree keeps a later
correct payment, no order is created automatically: the reconciliation case goes to the
admin to decide by hand.
