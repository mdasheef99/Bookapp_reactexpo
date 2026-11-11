# SDD 02: Cashfree Payments, Webhooks and Verification (skeleton)

**Status:** skeleton for owner review, 2026-11-10. Not approved.
**Authority:** none yet. Rules come from the [decision register](../PHASE-7-8-decision-register.md).
**Owns:** the single Cashfree adapter, creating the Cashfree order, the webhook endpoint,
verification, failures, retries, duplicates and late payments.
**Related:** [master](./00-master-state-model-sdd.md) · [checkout](./01-checkout-reservation-sdd.md) ·
[Cashfree mail](../PHASE-7-8-mail-cashfree.md)

---

## 1. Rules this SDD implements

- Customers pay through Cashfree checkout by UPI or card only (Q1, Q4, Q34, D-05).
- The server decides a payment's result by asking Cashfree; the app is never trusted
  (BC-11).
- Retries and delayed responses never cause a double charge or double fulfilment (Q37,
  BC-15).
- A payment still processing when the reservation ends is not treated as failed (BC-10).
- The first verified payment counts. A duplicate goes back to the customer automatically:
  Cashfree reverses it itself (CF-30), so BookConnect confirms the reversal and does not
  send a second refund. A wrong-amount payment is not treated as paid and is refunded in
  full, with an admin alert (D-29).

## 2. Cashfree facts this SDD relies on

Each ID is in the [fact record](../PHASE-7-8-cashfree-replies.md), with its source. None
has been tested by us on sandbox except where the record says so.

- Base URL and API version `2026-01-01` (CF-41).
- Order expiry must be over 15 minutes and under 30 days; the default is 30 days (CF-31).
- An order is ended with the Terminate Order API; a payment that already succeeded wins
  (CF-32).
- A UPI payment started before expiry can succeed after it (CF-33).
- Cashfree reverses a second successful payment on one order (CF-30).
- Checkout can be web (redirect, popup or inline) or the React Native SDK (CF-34). No PCI
  certificate is needed for either (CF-35).
- Webhooks are signed with the API client secret; keys cannot overlap (CF-36). Delivery is
  at-least-once with retries; stale timestamps are rejected after five minutes (CF-37).
- The charge for each payment is reported by `PAYMENT_CHARGES_WEBHOOK` (CF-29).
- Sandbox can simulate success, failure, pending and dropped payments (CF-40).

## 3. Adapter

One server-side module is the only code that calls Cashfree. Operations: create order, get
order, get payments for an order, end an active order, create refund, get refund, verify
a webhook signature. Easy Split operations are added by SDD 05. Keys live only in server
secrets; test keys only on the dev project (handoff §7). Every call that changes something
at Cashfree carries our own stable key; the terminate call takes an `x-idempotency-key`
(CF-38).

The read calls (get order, get payments for an order, get refund) and the field used to
tell one webhook message from another are standard in Cashfree's API reference but are not
yet in the fact record. They are added to it, with their exact names, before the full SDD
is written (§11). Until then webhook messages are de-duplicated on our own key: the
Cashfree payment or refund ID, the event type and the event time.

**Abuse limit:** a cap on payment attempts per customer in a period, as a setting (handoff
§7; master §14).

## 4. Payment flow

1. After `create_reservation`, the server creates one Cashfree order with our own unique
   order ID, the amount from the database, the customer phone, and an expiry just above
   Cashfree's 15-minute minimum (CF-31; a setting, proposed 16 minutes, forced by Cashfree
   and not a business rule). Our own 10-minute reservation is the real limit:
   when it ends with no payment in progress, the server terminates the Cashfree order
   (CF-32).
2. The app opens Cashfree's hosted checkout with the session it receives. Card data never
   touches BookConnect.
3. Cashfree sends a webhook; the app also returns from checkout. Either one only triggers
   verification.
4. Verification asks Cashfree for the order and its payments, then compares amount and
   currency with the checkout row.
5. On a verified match, `convert_paid_checkout` (SDD 01) and the ledger posting (SDD 03)
   run in one database transaction.

## 5. Payment states (`payments.status`, one row per Cashfree order)

| State | Meaning | Next |
|---|---|---|
| `created` | Cashfree order exists; no attempt yet | `pending`, `closed_unpaid` |
| `pending` | An attempt is in progress or its result is unknown. A failed attempt leaves the payment here, or back at `created`, so the customer can retry (Q37) | `paid`, `closed_unpaid` |
| `paid` | Verified success for the exact amount | Terminal for payment; refunds are tracked in SDD 04 |
| `closed_unpaid` | We ended the checkout with no success. Cashfree may not have finished: the terminate call can answer `TERMINATION_REQUESTED` (CF-32), and a UPI payment already started can still succeed (CF-33) | Stays on the status poll until Cashfree shows the order ended with no pending attempt. A verified success goes to `paid_late` |
| `paid_late` | Verified success after the checkout closed | Handled by `resolve_late_payment` (SDD 01): an order, or a full automatic refund |

`closed_unpaid` is therefore not final until Cashfree confirms it. How long that can take
is asked (CF-A8). The poll does not stop at the Cashfree order's own expiry, because a UPI
payment started before it can still succeed after it (CF-33). It stops only when Cashfree
shows the order ended with no attempt pending, as master §7 says. A payment still
unresolved after a set time (a setting, fixed once CF-A8 is answered) raises an admin case
and stays on the poll.

A wrong-amount success is recorded on the attempt, not on the payment: the attempt becomes
`amount_mismatch`, that money is refunded in full automatically with an admin alert (D-29),
and the payment stays open so the customer can still pay the right amount inside the
reservation (D-29: "the reservation follows Q36/BC-10"). Only one attempt may be in
progress at a time; a new one is refused while another is `pending`.

Attempt states (`payment_attempts.status`): `initiated`, `pending`, `success`, `failed`,
`dropped`, `amount_mismatch`, `duplicate_success` (a second success on an order already paid: Cashfree
reverses it, CF-30; we record it and wait for the reversal to appear; if it has not
appeared by a set time, an admin case opens and the admin asks Cashfree. BookConnect never
refunds it automatically, because a refund plus a late reversal would pay the customer
twice).

Webhook message states (`provider_webhook_events.processing_status`): `received`,
`rejected` (bad signature or stale; final), `queued`, `processed` (final), `failed_retrying`,
`dead` (retries used up; admin case; the poll still resolves the payment).

## 6. Webhooks

- Verify the signature and reject stale timestamps on every message.
- Store each message once, by the key in §3 (the Cashfree payment or refund ID, the event
  type and the event time) until Cashfree's own message identifier is confirmed; a repeat
  is acknowledged and ignored.
- Cashfree retries at 2, 10 and 30 minutes (CF-37). If a retry carries the original
  timestamp, the five-minute staleness rule rejects the 10 and 30 minute retries, and only
  the poll recovers that payment. Whether retries carry a fresh timestamp is checked on
  sandbox; the design is safe either way because of the poll.
- A webhook never changes money state by itself; it queues verification.
- Failed processing goes to a retry queue with a replay job.
- An independent poll checks every `created`, `pending` and unconfirmed `closed_unpaid`
  payment, so a lost webhook cannot strand a payment.
- Key rotation has no overlap period (CF-36). The procedure: pause new payments with the
  global pause (D-55), generate the new keys, replace them in server secrets, resume. A
  webhook signed with the old key during the swap fails verification and is recovered by
  the poll.
- Raw payloads are stored privately and never logged.

## 7. Failures and races the full SDD specifies

| Case | Handling |
|---|---|
| Attempt fails inside the 10 minutes | Customer may retry on the same order (Q37) |
| Reservation ends | The expiry does not trust our own records, because a payment started seconds earlier may not have reached us yet. Under the checkout lock it asks Cashfree for the order's payments, then acts on the answer in the three rows below. Stock is released only after Cashfree shows no pending and no successful attempt |
| Reservation ends, Cashfree shows a success | Verified and converted as a normal on-time payment, not a late one |
| Reservation ends, Cashfree shows no attempt pending | Terminate the Cashfree order first (CF-32), then checkout `reservation_expired`, holds released, payment `closed_unpaid`. If the terminate call answers that a payment already succeeded, convert as normal |
| Reservation ends, attempt pending | Checkout `awaiting_payment_result`; stock stays held for the grace period (BC-10) |
| Grace ends, still no result | `expire_payment_grace` (SDD 01): checkout `reservation_expired`, stock released, payment `closed_unpaid`, Cashfree order terminated, payment stays on the poll |
| Grace timer and a success at the same moment | One lock order; if the success commits first the order is created; if the grace commits first the success is a late payment |
| Customer cancels, or the store becomes ineligible, with an attempt pending | Checkout closed, Cashfree order terminated, payment stays on the poll; a success is refunded in full (D-85) |
| Success arrives after stock was released | Late-payment rule (D-06, Q38) |
| Webhook and expiry timer at the same moment | One lock order; whichever commits second sees the first's result |
| Webhook and poll verify the same payment together | Both lock the payment row; the second finds it `paid` and does nothing. One `paid` payment per checkout is also a database constraint |
| Two successes for one order | First counts; Cashfree reverses the second (CF-30, D-29). No automatic refund from us. If Cashfree's records show no reversal after the set wait, the admin checks the record for that payment and refunds it within 1 business day (D-78) |
| Success for a different amount | Attempt `amount_mismatch`; that money refunded in full; payment stays open for a correct attempt (D-29) |
| Customer closes the app mid-payment | Poll and webhook still resolve it |
| Paid at Cashfree but no order row | Reconciliation case and admin exception queue (SDD 03, SDD 08) |

## 8. Tables

- **New** `payments`: checkout id, order id once it exists, store, customer, our provider
  order ID (unique), Cashfree's order ID, amount in paise, currency, status, expiry,
  timestamps. Unique: at most one `paid` or `paid_late` payment per checkout.
- **New** `payment_attempts`: payment, Cashfree payment ID (unique), method group (UPI or
  card), amount, status, provider time.
- **New** `provider_webhook_events`: provider, message key (unique; see §6), type, received time,
  signature result, processing status, attempts, private payload.

No client can write any of these tables. Customers read only their own payments through a
safe view.

## 9. Worked examples the full SDD will include

Success on first try; fail then succeed; pending past the 10 minutes then success; pending
then failure; duplicate success; wrong amount; lost webhook recovered by the poll.

## 10. Test list headings

Forged webhook; replayed webhook; stale timestamp; tampered amount; duplicate event;
concurrent webhook and poll; concurrent webhook and expiry; cross-customer read; no secret
or payload in logs.

## 11. Open points

- Decided (D-90): Cashfree's web checkout for the pilot, tried on a real phone first. The
  app has a web build and no `expo-dev-client` today (checked 2026-11-10); the SDK would
  need a dev client and a prebuild step and does not cover the web build.
- Decided (D-78, amending D-29): Cashfree reverses a duplicate payment itself (CF-30) and
  BookConnect sends no refund of its own at first. If Cashfree's records show no reversal
  after a set wait (a setting, starting at 3 business days; reviewed when CF-A5 is answered), the
  admin checks Cashfree's record for that payment and refunds it within 1 business day.
  The customer does not wait on a written reply.
- Key rotation: handoff §7 still asks for an overlap period, which Cashfree does not
  support (CF-36). The steps in §6 replace it; paid orders and refunds continue during the
  short pause (D-55).
- The poll interval, as a setting, short enough that a payment made near the end of the
  reservation is seen before the grace ends.
- Add to the fact record, from Cashfree's API reference: the read calls in §3, the webhook
  field that identifies a message, and the raw payment status names.
- How Cashfree reports the reversal of a duplicate payment (CF-A5). Until answered, the
  "set time" before an admin case is a setting.
- Whether a payment can succeed for a different amount, and amount locking (CF-A6). Our
  own amount check stays whatever the answer.
- Whether a UPI payment pending at termination can still succeed, and for how long
  (CF-A8). This sets how long a closed order is watched.
- The length of the payment-result grace (master SDD §10 choice 3), which follows CF-A8.
