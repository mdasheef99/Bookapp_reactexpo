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
| RX2-03 | Two checks each showing two successes | — | The first verified success counts (D-29), taking several new ones in one check in §9.3's order; the other is `duplicate_success` (D-78) | Same result; if Cashfree later gives back the counted one, §13.5 corrects the records |
| RX2-04 | Verification of a success | `expire_reservation` (SDD 01) | Converted on time; B does nothing on a verified success | B releases only after a fresh read with no success (SDD 01 §5.3); A then verifies late (`paid_late`, SDD 01 §5.6) |
| RX2-05 | Verification of a success | `expire_payment_grace` | Converted on time | Closed `payment_failed`; A verifies late |
| RX2-06 | Verification of a success | Customer cancels the checkout | Converted; the cancel gets SDD 01's `ORDER_ALREADY_PAID` | Cancelled; A verifies late and is refunded (D-85) |
| RX2-07 | Verification of a success | D-81 pause cancelling the checkout | Converted; the order continues (D-21) | Cancelled; A refunded (D-85) |
| RX2-08 | `begin_payment` | `expire_reservation` | Payment `initiating`; the expiry runs §11.6's recovery read for it first and closes only once the round is known (§12.1) | `RESERVATION_ENDED` (guard 3) |
| RX2-09 | `record_provider_order` for the current round | Checkout closing | Payment `created`; the close later leads to `closed_unpaid` and termination | Per §8 step 3's "closed meanwhile" column: an existing order becomes `closed_unpaid` with `terminate_provider_order`; no order becomes `closed_unpaid` with nothing to terminate |
| RX2-10 | A wrong-amount success and a correct success on the same order | Their checks arrive in the opposite order | Whichever is verified first is classified first: a wrong amount first makes the later correct one `duplicate_success` (§13.1); a correct one first makes the wrong amount a duplicate | Same rule; if both appear in one check, §9.3's order decides. If Cashfree keeps the other one, §13.5 applies |
| RX2-11 | Duplicate watch's refund request | A late provider reversal | Refund sent; a later confirmed double return opens a reconciliation case (D-78) | If the fresh read already contains the completed reversal, no refund. If reversal completes after that outside-lock read but before our commit, the accepted D-78 race remains; reconcile once |
| RX2-12 | Admin failed-conversion retry (SDD 01 §5.10) | Late verification of the same payment | One order (SDD 01 RX-27), one posting (keyed by `cf_payment_id`) | Same |
| RX2-13 | `record_provider_order` for current round 1 (slow) | §11.6 recovery for round 1 | A records the order; recovery is idempotent; a new Pay reuses round 1 | Recovery finding the order records it first; A cannot regress it. A negative lookup keeps the same round unknown. A genuinely old-round response after a definitive refusal/new round changes nothing |
| RX2-14 | Webhook intake (`commerce_record_webhook`) | The same message delivered again | One event, one body, one task (§10.2) | Same |
| RX2-15 | An older check first reveals a success | A newer empty/failed check already applied | Unresolved evidence is retained; a fresh read is required before classification; no orphan terminal success | The newer read never erases a classified success; any new unresolved receipt still requires a fresh check |
| RX2-16 | Poll owner A expires or a webhook verifies during A's read | Poll owner B claims after the real lease expires | Webhook does not clear A's lease; A cannot release B's token | B owns the replacement token; A's stale finish does nothing |

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
5. **Duplicate.** She pays twice in two tabs. The first verified success converts at once;
   the other is a duplicate, and she sees "You paid twice. The extra ₹400 will be returned
   to you within 2–3 working days after Cashfree reverses it." (D-108). Three business days
   later the watch's fresh refunds read shows Cashfree's completed reversal. Nothing for us
   to refund. The poll keeps reading her order for the §11.2 window in case of anything
   further.
6. **Wrong amount.** The first success on a ₹400 order is for ₹350. It is refunded in full
   (category 6, key `wrong_amount:<cf_payment_id>`), the Cashfree order is terminated, and
   the admin is alerted. "Pay" is refused from then on (guard 5); her reservation runs out
   and she can reserve again. If a ₹400 extra success followed it on the same order,
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
  a second; only definitive validation refusal is `refused`; `idempotency_error`, timeout,
  5xx and 429 lead to a read, with a negative read still unknown.
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
- PA-06 replaying a start returns the stored answer and current safe projection; concurrent
  replays before recording may repeat HTTP calls with one frozen provider key/body but
  create one Cashfree order. A changed checkout raises `INVALID_COMMAND`; a stale session
  cannot bypass a closed checkout, pending attempt, mismatch or exhausted Pay limit.
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
- PA-12 a stale `record_provider_order` from an old round changes nothing; a current-round
  answer may fill missing identity after verification but cannot regress money state
  (RX2-13).
- PA-13 §11.6 recovery: an `initiating` round older than the setting is read; an existing
  order follows §8 step 3; `not_found` after uncertainty and errors stay `initiating`.

- PA-14 a timed-out create followed by `not_found` remains unknown, including when the
  original create later succeeds; recovery uses the same body/key, closure never returns
  a session, and no new round or no-charge promise is inferred. A bare 422 idempotency
  error does not authorize expiry as no-order. A definitively refused round retried more
  than a minute later gets a fresh over-15-minute expiry; retries within one uncertain
  round keep exactly the same body/key.

**Verification**
- VE-01 a success read for the exact amount on a live checkout: one order, one posting,
  payment `paid`, `paid_at` = verification time, `provider_paid_at` = Cashfree's time.
- VE-02 the same check applied twice: the second returns the stored answer; one order.
- VE-03 a wrong amount, a wrong currency and a fractional amount on the first success are
  each `amount_mismatch`.
- VE-04 a failed then a successful attempt: one order; the failed attempt stays `failed`.
- VE-05 two successes: the first verified counts at once (D-29) and the other is
  `duplicate_success` with `watch_stage = waiting_reversal`, no refund request. Include
  two new successes in one check (§9.3's order, with reversed, tied and missing times) and
  a first read showing only one success with the other found later. Runs in slice 6.
- VE-21 a single success is counted on its first fresh read with a refunds read; a missing
  or failed refunds read leaves it `success_unresolved` until the next read, and the
  books stay held meanwhile.
- VE-06 a pending attempt keeps the payment `pending`; nothing is released.
- VE-07 a check whose `(requested_at, id)` is at or before `last_check_id`'s may add
  unresolved evidence but never leave a terminal success without a paid payment. It
  requests a fresh read before classifying; no status/schedule watermark moves back.
  Exercise earlier-request/later-answer and both commit orders.
- VE-08 an unknown raw status is treated as pending.
- VE-09 a success after the checkout expired: `paid_late` and SDD 01 §5.6 runs (D-06).
- VE-10 a success after a customer cancel: `paid_late`, full refund (D-85).
- VE-11a a success after a D-81 cancellation: refunded (D-85). VE-11b a late success while
  another live or converted checkout of the same cart and same version exists: refunded
  per D-97 through SDD 01 §5.6; a different cart version is the control.
  Runs in slice 6.
- VE-12 `convert_paid_checkout` answers `conversion_failed`: the payment stays `paid`, the
  receipt posts once, no sale posts, and the admin case and hold extension commit in the
  same transaction (D-95). A successful admin retry posts one sale without reposting the
  receipt; a refund outcome posts no sale.
- VE-13 a success by a method other than UPI or card is counted as normal and alerts the
  admin (D-105).
- VE-14 the customer's return check is limited per §5 and never changes state without §9.
- VE-15 a success whose refunds read shows a completed automatic reversal is `reversed`:
  no order, no refund, a reconciliation case; a reversal still pending does not count. Include a single first success already reversed,
  plus unavailable and unconfirmed refund evidence: neither may create an order.
- VE-16 a `TERMINATED` or `EXPIRED` order with nothing pending sets
  `provider_closed_confirmed_at` and the payment stays on the poll.

- VE-17 a success on `reservation_expired` while a D-81 ineligibility pause is active
  is refunded under D-98; ordinary pauses are controls. Runs in slice 6.
- VE-18 wrong-payment/wrong-kind/failed/missing/stale payment, refund or order checks are
  rejected before money effects; changed replay inputs raise `INVALID_COMMAND`; two
  distinct checks of the same payment both apply. Lock waits cross the freshness limit.
- VE-19 a customer return with another customer's, missing or malformed provider order
  ID makes no provider call and reveals no payment state; an authorized return returns
  only the customer projection.
- VE-20 representable receipts for counted, wrong-amount, duplicate and unresolved successes post once;
  conversion alone posts the sale, reversal alone posts its reversal, and a later admin
  retry cannot repost the receipt. Fractional or unsupported-currency evidence is kept
  exactly and never rounded into a refund or ledger money amount.

**Webhooks**
- WH-01 a forged signature is `rejected`, stores no body and answers 401.
- WH-02 a correctly signed message with a timestamp up to 24 hours old is accepted (a
  retry keeping its first timestamp, SBX-10); one over 24 hours old is rejected (D-114).
- WH-02a a message whose `x-webhook-version` is not the registered version is rejected and
  stores no body; a `cf_payment_id` is always read as a string.
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
- WH-10 after rotation, a webhook signed with the previous secret is accepted inside the
  24-hour window and rejected after the previous secret is removed; the poll recovers the
  payment. Runs in slice 7.
- WH-11 two deliveries with the same `x-idempotency-key` store one message; a delivery
  without the header uses the fallback key (§10.2).
- WH-12 bodies older than the retention setting are deleted and `body_purged_at` set; the
  event and attempts stay.

- WH-13 crash after domain handover/before finish replays safely; task/event/admin-case
  completion is atomic. The fifth attempt crashing before completion is terminalized
  before a sixth dispatch. Stale lease owners cannot mark the event processed or dead.

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
- PO-07 all triggers (customer checks, webhooks, workers, poll, watch) share the
  per-endpoint `commerce.cashfree_reads_per_minute` cap; the poll takes what is left; a 429 changes
  nothing and waits Cashfree's retry time (§11.5).
- PO-08 two overlapping poll runs never read the same payment at once under a live lease;
  a webhook does not release the poll lease; expired owners cannot finish a replacement
  token. Crashes recover through lease expiry, including creation-recovery claims.
- PO-09 concurrent mixed-trigger calls consume atomic permits before HTTP dispatch,
  including calls across minute boundaries; denied permits retry/defer without changing
  a payment outcome. Test nine live payments against the 25/minute budget: 20 seconds is a target,
  not an unconditional timing guarantee. All instances share provider 429 backoff.
- TE-01 expiry with no payment row, or a `start_failed` payment, closes the checkout
  without calling Cashfree.
- TE-02 expiry while the payment is `initiating` runs the recovery read first and does not
  close while the round is unknown.
- TE-03 `TERMINATION_REQUESTED`, and HTTP 400 `request_invalid` "order termination already
  requested", count as terminated (SBX-02).
- TE-03a HTTP 400 `order_already_paid` is handled exactly like a `PAID` answer (TE-04,
  TE-05) and never leads to another termination attempt (SBX-01).
- TE-04 a termination answered `PAID` leads to verification and conversion.
- TE-05 a termination answered `PAID` counts as terminated when no payment was counted and
  every success is `amount_mismatch`, `duplicate_success` or `reversed`, including a mix
  (SDD 01 E-28, E-31, D-113); with a counted success it does not.
- TE-06 a termination answer of `ACTIVE` or any other error leads to a payments read and a retry;
  `EXPIRED` counts as terminated (§12.1).
- TE-07 the `terminate_provider_order` task resolves on a terminated answer, retries on
  `ACTIVE` or unreachable, and is dead-lettered to an admin case after its last attempt.

- TE-08 the locked expiry wrapper re-checks no-order after a concurrent first Pay;
  initiating/unknown creation and unresolved successes never release stock. Both expiry
  phases use the correct bound check IDs. A paid termination task resolves after verified
  handling; no-payment/definitive-no-order termination resolves without a provider call.

**Wrong amount and duplicates**
- DU-01 a wrong amount requests category 6 once, keyed `wrong_amount:<cf_payment_id>`;
  replay requests nothing more.
- DU-02 a wrong amount opens termination and alerts the admin; no order.
- DU-03 a confirmed extra correct success after a wrong amount on the same order is a duplicate
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

- DU-11 an automatic reversal left `PENDING`, `PENDING_APPROVAL` or `ONHOLD` through
  the initial wait still triggers the enquiry and, after recorded contact and the
  no-answer deadline, one fallback refund; pending status never resets a deadline.
- DU-12 one check with two new duplicate receipts emits two notices with distinct child
  command IDs and per-attempt keys; replays or another check emit no further notices.
- DU-13 a completed reversal after a pending, unknown or succeeded BookConnect refund
  intent takes the post-refund branch once; an unsent intent is stopped where possible,
  and a confirmed double return posts one loss to BookConnect, never the store. Include
  provider reversal between the outside-lock read and refund-intent commit (RX2-11). Daily
  reconciliation continues beyond the ordinary payment poll window.
- DU-14 Cashfree gives back the counted payment (auto refund naming it) and keeps the
  duplicate: the order and payment status are unchanged, the reversal posts once, the
  duplicate becomes `kept_by_cashfree` and is never refunded, one reconciliation case
  opens, no customer notice (§13.5). Arrive by refunds read and by
  `AUTO_REFUND_STATUS_WEBHOOK`, in both orders with the duplicate watch.
- DU-15 Cashfree gives back the counted payment after we already refunded the duplicate:
  one reconciliation case and one `duplicate_loss` posting; nothing is refunded again.

**Schema and security**
- ST2-01 every money column refuses a negative value; `amount_minor` cannot change.
- ST2-02 one payment per checkout; `cf_payment_id` and `message_key` are unique;
  `verified_attempt_id` must be an attempt of the same payment (composite key).
- ST2-03 only the §4.1.1 payment moves are allowed, enforced by trigger.
- ST2-04 attempts never move backwards (§4.2).
- ST2-05 a payment below 100 paise is refused (D-107).
- ST2-06 verification before creation recording can reach pending/paid/paid_late;
  a closed unpaid payment stays closed with later pending evidence; unresolved success
  can reach each final class only with confirmed evidence. Missing provider completion
  time never prevents recording an otherwise verified receipt.
- SE-01 no client role can write any §4 table or call any §6 wrapper.
- SE-02 a customer cannot read another customer's payment or session.
- SE-03 no log line contains a key, a webhook body, a session ID or a phone number.
- SE-04 no Cashfree key appears in the app bundle or in any `EXPO_PUBLIC_` variable.
- SE-05 webhook bodies live only in `marketplace_private`, are service-role only and are
  deleted after the retention period (WH-12).
- SE-06 the key-rotation procedure (§13.4), rehearsed on sandbox: new reservations pause,
  live checkouts finish, old-key webhooks are rejected, the poll recovers, the owner
  restarts after a clean reconciliation (D-68, D-104). A leaked-key rehearsal skips the wait
  and the poll recovers a payment caught in the gap (D-111).

**Races**
- RX2-01 to RX2-16 each run in both orders, as §14's table says.
