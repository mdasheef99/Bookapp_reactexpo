# SDD 02, part 3: Races, worked examples and tests

**Part of SDD 02.** Section numbers run across the four files; the map is in the
[overview](./02-0-overview.md). Revised 2026-11-11 after review round 1.

---

## 14. Races

Every money-changing step takes SDD 01 §7's lock order: customer advisory lock, payment,
cart, store, checkout, order, stock rows in ID order, listings. No Cashfree call is made
while a lock is held. A command that gets SQLSTATE `40P01` (deadlock) is retried as a whole
transaction with the same idempotency key and command ID (SDD 01 §7).

| ID | A | B | A commits first | B commits first |
|---|---|---|---|---|
| RX2-01 | Webhook verification | Poll verification, same payment | A applies; B finds the attempt already classified and does nothing | Same, reversed |
| RX2-02 | Webhook verification | The customer's return check | As RX2-01 | As RX2-01 |
| RX2-03 | Two checks each showing two successes | — | Both classify in completion order (§9.3): the first completed counts, the second is `duplicate_success` | Same result |
| RX2-04 | Verification of a success | `expire_reservation` (SDD 01) | Converted on time; B does nothing on a verified success | B releases only after a fresh read with no success (SDD 01 §5.3); A then verifies late (`paid_late`, SDD 01 §5.6) |
| RX2-05 | Verification of a success | `expire_payment_grace` | Converted on time | Closed `payment_failed`; A verifies late |
| RX2-06 | Verification of a success | Customer cancels the checkout | Converted; the cancel gets SDD 01's `ORDER_ALREADY_PAID` | Cancelled; A verifies late and is refunded (D-85) |
| RX2-07 | Verification of a success | D-81 pause cancelling the checkout | Converted; the order continues (D-21) | Cancelled; A refunded (D-85) |
| RX2-08 | `begin_payment` | `expire_reservation` | Payment `initiating`; the expiry runs §11.6's recovery read for it first and closes only once the round is known (§12.1) | `RESERVATION_ENDED` (guard 3) |
| RX2-09 | `record_provider_order` for the current round | Checkout closing | Payment `created`; the close later leads to `closed_unpaid` and termination | Per §8 step 3's "closed meanwhile" column: an existing order becomes `closed_unpaid` with `terminate_provider_order`; no order becomes `closed_unpaid` with nothing to terminate |
| RX2-10 | Wrong-amount success completed first | Correct success completed later, same order | A is `amount_mismatch`; B is `duplicate_success` (§13.1) | Same: classification follows Cashfree's completion order, not which check arrives first (§9.3, B3) |
| RX2-11 | Duplicate watch's refund request | A late reversal | Refund sent; the reversal opens a reconciliation case (D-78) | The fresh refunds check sees the reversal; no refund |
| RX2-12 | Admin failed-conversion retry (SDD 01 §5.10) | Late verification of the same payment | One order (SDD 01 RX-27), one posting (keyed by `cf_payment_id`) | Same |
| RX2-13 | `record_provider_order` for round 1 (slow) | §11.6 recovery for round 1, then a new "Pay" starting round 2 | A's round no longer matches: it changes nothing and returns the current state | Same |
| RX2-14 | Webhook intake (`commerce_record_webhook`) | The same message delivered again | One event, one body, one task (§10.2) | Same |

## 15. Worked examples and tests

### 15.1 Worked examples

1. **First try.** Priya reserves (₹400), presses "Pay", pays by UPI. The webhook and her
   return both trigger checks; one converts the checkout, the other finds it done. One
   order, one ledger posting.
2. **Fail, then succeed.** Her card is declined. The attempt is `failed`; the payment is
   `created`. She presses "Pay" again within the 10 minutes, gets the same session, pays by
   UPI. One order. Her two presses count toward the limit of 5 (D-106).
3. **Pending past 10 minutes.** Her UPI payment is still processing when the 10 minutes
   end. The expiry worker reads Cashfree, sees a pending attempt; the checkout enters
   `awaiting_payment_result` for 15 minutes (D-102). The poll sees the success 4 minutes
   later; the order is created on time.
4. **Pending, then nothing.** At grace end the payment is still processing. The worker
   terminates the Cashfree order (`TERMINATION_REQUESTED`), the checkout closes
   `payment_failed`, the books are released, and she sees "We have not received your
   payment. If you were charged, it will be refunded automatically." The poll keeps
   watching; 3 hours later a success arrives: a late payment. Her book is still free, so
   the order is created (D-06).
5. **Duplicate.** She pays twice in two tabs. The success Cashfree completed first converts;
   the other is a duplicate, and she sees "You paid twice. The extra ₹400 will be returned
   to you within 2–3 working days after Cashfree reverses it." (D-108). Three business days
   later the watch's fresh refunds read shows Cashfree's completed reversal. Nothing for us
   to refund. The poll keeps reading her order for the §11.2 window in case of anything
   further.
6. **Wrong amount.** The first success on a ₹400 order is for ₹350. It is refunded in full
   (category 6, key `wrong_amount:<cf_payment_id>`), the Cashfree order is terminated, and
   the admin is alerted. "Pay" is refused from then on (guard 5); her reservation runs out
   and she can reserve again. If a ₹400 success had completed after it on the same order,
   that one would be a duplicate, not an order.
7. **Lost webhook.** Cashfree's webhook never arrives. The poll, 20 seconds later, finds
   the success and converts the checkout.
8. **Crash during start.** The Edge Function dies after Cashfree created the order but
   before `record_provider_order`. The payment stays `initiating`. Thirty seconds later
   the poll's recovery read finds the order and records it as `created`; her next "Pay"
   opens the same session.

### 15.2 Tests

**Adapter (sandbox and recorded answers)**
- AD-01 each of Cashfree's seven payment statuses and 16 method groups maps as §7.3 says;
  an unknown status maps to `pending` and an unknown group to `other`.
- AD-02 rupees to paise and back, exactly; a fractional paisa leaves `amount_minor` NULL
  and keeps `amount_text`.
- AD-03 `createOrder` answered 409 (either code) reads the existing order instead of making
  a second; 400/422 is `refused`; timeout, 5xx and 429 lead to a read.
- AD-04 the adapter refuses to start on the dev project unless `CASHFREE_ENV` is `sandbox`.
- AD-05 every `x-idempotency-key` sent is a UUID; the same payment and round give the same
  create key; a new round gets a new key; a terminate key is its check ID.
- AD-06 `verifyWebhook` accepts a recorded sandbox webhook and rejects it after one byte of
  the body, the timestamp or the signature changes.
- AD-07 HTTP 401 maps to `auth_failed` and HTTP 429 to `rate_limited` with Cashfree's wait
  time; the customer ID sent has no dashes and the phone has 10 digits (D-50).
- AD-08 `getRefunds` maps refund type and status as §7.3 says.

**Payment start**
- PA-01 a reserved checkout's owner starts a payment; a stranger gets
  `COMMERCE_ENTITY_UNAVAILABLE`.
- PA-02 start at and after `reservation_expires_at`, including after a lock wait, gets
  `RESERVATION_ENDED` (post-lock clock).
- PA-03 a global or store pause set after the checkout was reserved does not block "Pay";
  the payment proceeds (D-104).
- PA-04 a start while an attempt is pending, or while the payment is `initiating`, gets
  `PAYMENT_IN_PROGRESS`; after a failed attempt it returns the same session (Q37). Runs in
  slice 3.
- PA-05 a start after an `amount_mismatch` gets `PAYMENT_NOT_ALLOWED`.
- PA-06 replaying a start returns the stored answer; Cashfree is called once; the same key
  and command ID with a different checkout raise `INVALID_COMMAND`.
- PA-07 Cashfree refuses to create the order: `start_failed`, nothing charged; a new "Pay"
  starts round 2 on the same row with a new create key.
- PA-08 the checkout closes while the order is being created: both columns of §8 step 3's
  "closed meanwhile" (order exists → termination task; no order → nothing to terminate).
- PA-09 (sandbox) after `testfailure@gocash`, the same session opens checkout again and
  `testsuccess@gocash` pays the same Cashfree order (CF-A18); a `NOT_ATTEMPTED` payment does
  not block a new "Pay". Runs in slice 3.
- PA-10 the sixth "Pay" on one checkout gets `PAYMENT_ATTEMPTS_EXCEEDED` (D-106); replays
  do not count as presses.
- PA-11 "Pay" on a payment already `paid` or `paid_late` gets `ORDER_ALREADY_PAID`,
  including one kept `paid` after a failed conversion (D-95).
- PA-12 a stale `record_provider_order` (old round, or payment no longer `initiating`)
  changes nothing (RX2-13).
- PA-13 §11.6 recovery: an `initiating` round older than the setting is read; an existing
  order becomes `created`, `not_found` becomes `start_failed`, an error stays `initiating`.

**Verification**
- VE-01 a success read for the exact amount on a live checkout: one order, one posting,
  payment `paid`, `paid_at` = verification time, `provider_paid_at` = Cashfree's time.
- VE-02 the same check applied twice: the second returns the stored answer; one order.
- VE-03 a wrong amount, a wrong currency and a fractional amount on the first success are
  each `amount_mismatch`.
- VE-04 a failed then a successful attempt: one order; the failed attempt stays `failed`.
- VE-05 two successes: the one completed first counts whichever is listed or read first;
  the other is `duplicate_success` with `watch_stage = waiting_reversal` and no refund
  request. Runs in slice 6.
- VE-06 a pending attempt keeps the payment `pending`; nothing is released.
- VE-07 a check whose `(answered_at, id)` is at or before `last_check_id`'s may add new
  attempts and move attempts forward but changes no payment field; nothing moves back.
- VE-08 an unknown raw status is treated as pending.
- VE-09 a success after the checkout expired: `paid_late` and SDD 01 §5.6 runs (D-06).
- VE-10 a success after a customer cancel: `paid_late`, full refund (D-85).
- VE-11a a success after a D-81 cancellation: refunded (D-98). VE-11b a success while
  another live checkout of the same cart exists: handled per D-97 through SDD 01 §5.6.
  Runs in slice 6.
- VE-12 `convert_paid_checkout` answers `conversion_failed`: the payment stays `paid`, the
  posting is made once, and the admin case and hold extension commit in the same
  transaction; nothing is rolled back (D-95).
- VE-13 a success by a method other than UPI or card is counted as normal and alerts the
  admin (D-105).
- VE-14 the customer's return check is limited per §5 and never changes state without §9.
- VE-15 a success whose refunds read shows a completed automatic reversal is `reversed`:
  no order, no refund, a reconciliation case; a reversal still pending does not count.
- VE-16 a `TERMINATED` or `EXPIRED` order with nothing pending sets
  `provider_closed_confirmed_at` and the payment stays on the poll.

**Webhooks**
- WH-01 a forged signature is `rejected`, stores no body and answers 401.
- WH-02 a timestamp over five minutes old is rejected.
- WH-03 a replayed message (same key) answers 200 and changes nothing.
- WH-04 a webhook claiming success while Cashfree's read shows pending changes nothing.
- WH-05 a tampered amount in the body is ignored; the read decides.
- WH-06 a processing failure retries through the task framework and, after 5 attempts, the
  event is `dead` with an admin case; the poll still converts the payment. Runs in slice 7.
- WH-07 an unknown order ID is `processed` with `unknown_order` and opens a reconciliation
  case.
- WH-08 charges, refund and settlement events are handed to SDD 03, 04 and 05.
- WH-09 the endpoint answers 200 only after the event, body and task commit together, and
  500 if that transaction fails (nothing half-stored).
- WH-10 a webhook signed with an old key after rotation is rejected, and the poll recovers
  the payment. Runs in slice 7.
- WH-11 two deliveries with the same `x-idempotency-key` store one message; a delivery
  without the header uses the fallback key (§10.2).
- WH-12 bodies older than the retention setting are deleted and `body_purged_at` set; the
  event and attempts stay.

**Poll and termination**
- PO-01 the poll follows §11.2's schedule, including for `paid` payments, through the
  hourly and daily windows, then clears `next_poll_at`; a duplicate arriving on day 3 is
  found.
- PO-02 a success seen during grace converts on time (BC-10, D-102).
- PO-03 a success seen hours after close is a late payment.
- PO-04 Cashfree unreachable: nothing changes and the books stay held (D-101).
- PO-05 a closed payment unconfirmed for 24 hours opens one admin case and stays on the
  poll.
- PO-06 the poll and a webhook on the same payment produce one result (RX2-01).
- PO-07 all Cashfree reads together (customer checks, webhooks, workers, poll, watch) stay
  within `commerce.cashfree_reads_per_minute`; the poll takes what is left; a 429 changes
  nothing and waits Cashfree's retry time (§11.5).
- PO-08 two overlapping poll runs never read the same payment at once (leases); a crashed
  run's leases expire and the payments are picked up again.
- TE-01 expiry with no payment row, or a `start_failed` payment, closes the checkout
  without calling Cashfree.
- TE-02 expiry while the payment is `initiating` runs the recovery read first and does not
  close while the round is unknown.
- TE-03 `TERMINATION_REQUESTED` counts as terminated.
- TE-04 a termination answered `PAID` leads to verification and conversion.
- TE-05 a termination answered `PAID` when every success is `amount_mismatch` counts as
  terminated (SDD 01 E-28).
- TE-06 a termination answer of `ACTIVE` or an error leads to a payments read and a retry;
  `EXPIRED` counts as terminated (§12.1).
- TE-07 the `terminate_provider_order` task resolves on a terminated answer, retries on
  `ACTIVE` or unreachable, and is dead-lettered to an admin case after its last attempt.

**Wrong amount and duplicates**
- DU-01 a wrong amount requests category 6 once, keyed `wrong_amount:<cf_payment_id>`;
  replay requests nothing more.
- DU-02 a wrong amount opens termination and alerts the admin; no order.
- DU-03 a correct success completed after a wrong amount on the same order is a duplicate
  and is not refunded twice (RX2-10).
- DU-04 a duplicate whose fresh refunds read shows a `SUCCESS` automatic reversal before the
  due time is closed `reversed` with no refund; a `PENDING` reversal keeps watching.
- DU-05 a duplicate not reversed opens the "Ask Cashfree" admin case at the due time.
- DU-06 admin records "will not reverse": refund within 1 business day, once, keyed
  `duplicate:<cf_payment_id>`.
- DU-07 no answer after the setting's business days: refund once.
- DU-08 a reversal after our refund opens a reconciliation case; no second refund.
- DU-09 the duplicate emits SDD 01's `checkout.duplicate_payment` once with D-108's
  wording and the right amount.
- DU-10 business days skip weekends and the admin's holiday list.

**Schema and security**
- ST2-01 every money column refuses a negative value; `amount_minor` cannot change.
- ST2-02 one payment per checkout; `cf_payment_id` and `message_key` are unique;
  `verified_attempt_id` must be an attempt of the same payment (composite key).
- ST2-03 only the §4.1.1 payment moves are allowed, enforced by trigger.
- ST2-04 attempts never move backwards (§4.2).
- ST2-05 a payment below 100 paise is refused (D-107).
- SE-01 no client role can write any §4 table or call any §6 wrapper.
- SE-02 a customer cannot read another customer's payment or session.
- SE-03 no log line contains a key, a webhook body, a session ID or a phone number.
- SE-04 no Cashfree key appears in the app bundle or in any `EXPO_PUBLIC_` variable.
- SE-05 webhook bodies live only in `marketplace_private`, are service-role only and are
  deleted after the retention period (WH-12).
- SE-06 the key-rotation procedure (§13.4), rehearsed on sandbox: new reservations pause,
  live checkouts finish, old-key webhooks are rejected, the poll recovers, the owner
  restarts after a clean reconciliation (D-68, D-104).

**Races**
- RX2-01 to RX2-14 each run in both orders, as §14's table says.
