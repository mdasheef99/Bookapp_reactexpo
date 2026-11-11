# SDD 01: Reserve-First Checkout and Paid-Order Acceptance (skeleton)

**Status:** skeleton for owner review, 2026-11-10. Not approved.
**Authority:** none yet. Rules come from the [decision register](../PHASE-7-8-decision-register.md).
**Owns:** the change from "store confirms, then customer pays" to "reserve, pay, then store
accepts" (BC-08, P-5 step 1); the paid order until it is ready; the Phase 6 rework.
**Related:** [master](./00-master-state-model-sdd.md) ·
[Phase 6 impact check](../PHASE-7-8-phase6-impact-check.md)

---

## 1. Flow

```text
cart -> "Reserve and pay"
     -> server checks eligibility and stock, holds the books for 10 minutes
     -> Cashfree payment (SDD 02)
     -> verified payment: holds become sales, paid order created (awaiting_store)
     -> store accepts within 24 hours, or reports missing books
     -> [photo check if a photo request was open at payment]
     -> ready (SDD 06 pickup, SDD 07 delivery)
```

## 2. Reservation

The full SDD specifies each check, its error message and its test.

| Check at "Reserve and pay" | Decision |
|---|---|
| One store per cart | Q33 |
| Store has the "accept online payment" permission | BC-41, D-59 |
| Store has not paused online orders; a closed store may still take orders | D-07 |
| Store is not paused: for reaching a daily-order or unsettled limit (D-20, D-66), for 3 faults in 30 days, suspected fraud or an overdue debt (D-21) | D-20, D-21, D-66 |
| Customer is under the caps on open reservations and payment attempts (settings) | Handoff §7 |
| No global or loss-cap pause of new payments | D-08, D-55 |
| Every book is in stock, a printed book, and not held by someone else | D-15, D-49, BC-09 |
| Book total is at most ₹5,000 | D-56, D-65 |
| Customer gave a phone number | D-50 |
| For delivery: address is in a served pincode and a quote was obtained | D-18, BC-22 |

- Amount: book prices from the database plus the delivery quote; platform fee ₹0. The
  client sends only IDs (BC-05, D-11). No minimum order and no free-delivery threshold (D-36).
- If the delivery quote is unavailable, pickup can still be chosen (P-6).
- A limit or pause that arrives after the reservation does not stop that customer paying
  (handoff §11 item 4).
- Reaching a D-20 limit sets a pause on the store's new orders that stays until the admin
  reviews it. It does not lift by itself when the unsettled amount falls (D-20). The pause
  and its release are recorded; the admin screen is SDD 08.
- The store is worked out on the server from the cart, never taken from the app (master
  §14).
- Holds are created at reservation, in one transaction with the checkout row, under a lock
  on the stock row. A database constraint proves no double sale (handoff §11 item 1).

## 3. Checkout commands

| Command | Actor | Result |
|---|---|---|
| `create_reservation` | Customer | Checkout `reserved`; holds active; 10-minute timer |
| `cancel_reservation` | Customer | `customer_cancelled`; holds released; Cashfree order terminated (SDD 02) |
| `expire_reservation` | Timer | First asks Cashfree for the order's payments (SDD 02 §7). Then `reservation_expired`, or `awaiting_payment_result` if a payment is still processing (BC-10), or `converted` if one already succeeded. Holds are released only after Cashfree shows nothing pending |
| `expire_payment_grace` | Timer (SDD 02 owns the length) | `awaiting_payment_result` → `reservation_expired`; holds released; Cashfree order terminated; the payment stays watched |
| `convert_paid_checkout` | Payment verification (SDD 02) | `converted`; holds become sales; `store_orders` row created |
| `resolve_late_payment` | Payment verification | After `reservation_expired`: book still available, reserve again and convert (D-06); not available, full automatic refund (Q38). After `customer_cancelled` or `platform_cancelled`: full automatic refund, no order (D-85) |
| `cancel_for_store_ineligibility` | System | `platform_cancelled`; holds released; Cashfree order terminated |

- **Late payment with more than one book.** All or nothing, under one lock: if every book
  in the checkout is still free, all are reserved again and the order is created (D-06);
  if any one is not, the whole payment is refunded (D-84, Q38, category 5). The customer is told
  in the app which happened and, for a refund, the amount and the 2–3 working days (D-48).
- **Late payment after a pause or limit.** The re-reservation checks stock only. A daily
  or unsettled limit, a 3-fault pause, the loss-cap pause, the global pause or the store's
  own switch that began after the reservation ended does not block it, because the
  customer has already paid (handoff §11 item 4). Only the closed list below (D-81) does;
  then the payment is refunded in full.
- **What makes a store "ineligible" for a live reservation** (D-81, a closed list): the
  admin suspends the store for suspected fraud; the store loses the "accept online
  payment" permission; the store is closed or removed by the admin. A daily or unsettled
  limit, a 3-fault pause, the loss-cap pause, the global pause and the store's own "pause
  online orders" switch do not cancel a live reservation; they only stop new ones (handoff
  §11 item 4).
- A cart can be reserved again after its checkout expired or was cancelled; §5 lists the
  database change that allows it.

Checkout states are in the master SDD §5. Re-reserving for a late payment needs holds to be
taken again against a checkout that Phase 6 treats as closed; §5 lists that rework.

## 4. Paid-order acceptance

| Command | Actor | Result | Decision |
|---|---|---|---|
| `accept_order` | Store | `awaiting_store` → `accepted` | Q49 |
| `report_missing_books` | Store, after phoning the customer | Selected items `removed_unavailable`; outcome "keeps the rest" (partial refund) or "cancelled all" (full refund) | D-61, Q65 |
| `report_order_unavailable` | Store | `cancelled`; full automatic refund; store fault | Q55, D-15, D-35 |
| `send_reminder`, `escalate` | Timers | In-app notices at 30 and 45 open-hour minutes | BC-12, BC-13 |
| `expire_unaccepted_order` | Timer at 24 elapsed hours | `cancelled`; full automatic refund | D-04 |
| `send_requested_photos` | Store | `accepted` → `awaiting_photo_check` | D-43 |
| `expire_photo_send` | Timer at 24 elapsed hours from payment | Photos were requested and not sent: `cancelled`; full automatic refund as unavailable; store fault | D-43 |
| `respond_to_photos` | Customer | Approve: continue. Reject: `cancelled`, full refund | D-43, D-53 |
| `expire_photo_check` | Timer at 24 hours from the photos | Customer silent: `cancelled`, full refund | D-53 |

Races, each settled by the rule in master §14 (lock the order, re-check, first commit wins):

- `accept_order` against `expire_unaccepted_order`: an acceptance committed before the
  expiry command stands; after it, the store sees "this order was cancelled".
- `send_requested_photos` against `expire_photo_send`; `respond_to_photos` against
  `expire_photo_check`.
- `expire_unaccepted_order` against `expire_photo_send`, which fall due at the same moment:
  the photo timer acts only on an order the store has accepted. An order never accepted is
  always the 24-hour case (refund category 1), so the "alert delivered" rule decides fault.
- `report_missing_books` against a customer cancel: if the cancel commits first, the whole
  order is refunded and the report does nothing; if the report commits first, its partial
  refund stands and a later cancel refunds the rest (SDD 04 §1).

- `report_missing_books` against `expire_unaccepted_order`: a report on an order still
  `awaiting_store` counts as the store's acknowledgement (my reading of D-04, for the owner
  to confirm). "Keeps the rest" moves the order to `accepted` and stops the 24-hour timer;
  "cancelled all" ends it as `cancelled`. If the report commits first, the timer finds the
  order no longer `awaiting_store` and does nothing; if the timer commits first, the whole
  order is refunded and the report is refused with "this order was cancelled".

`report_missing_books` is allowed while the order is `awaiting_store` or `accepted`, up to
"ready". If the customer cannot be reached, the store records "keeps the rest" within 24
hours of making the report (D-83, which refines D-61). If the store records nothing by
then, the system records "keeps the rest" and sends the partial refund (D-83).

**Accepted but not prepared (D-79).** If an accepted order is not marked ready or packed
by the end of the day it was promised for (BC-14, D-34: the same business day when ordered
at least 2 hours before closing, otherwise the next), the store and the admin are alerted.
If it is still not ready by the end of the following business day,
`expire_unprepared_order` cancels it and refunds it in full automatically as a store
fault. Both times are settings. It races
"Mark ready" under the same rule as the other timers.

**Stock after a cancellation or refund.** At payment the holds become sales. When an order
or an item ends without the customer keeping the book, the stock is put right in the same
transaction as the cancellation:

- the store does not have the book (categories 2, 3, 4, and photos that do not match): the
  copy is not put back on sale;
- the book is still at the store (24-hour expiry, customer cancel, photo silence or
  rejection for another reason, missed or refused pickup): the copy goes back on sale,
  except a refused copy that does not match its listing, which the store must re-list;
- a returned book or a parcel back at the store (`returned_to_store`): not put back
  automatically; the store re-lists it after checking it.

**Pauses: one place for the state.** Several rules stop new orders or payments: the store's
own switch (D-07), store limits (D-20), store faults, fraud and overdue debt (D-21), the
payout block (D-63), the loss cap (D-08), the global pause (D-55) and the owner's restart
(D-68). This SDD owns the record of them: one table of pauses with scope (one store or the
whole platform), kind, who set it, when, the reason, and who cleared it. The reservation
check in §2 reads only this table. Each owning SDD (03, 04, 05) sets and clears its own
kind through a server function. The store's "pause online orders" switch is on the store's
settings screen.

Only the winning command creates its notice, refund or next timer.

**Receipt (D-50).** Created when the payment is verified. Always shown in the app on the
order; emailed too when the customer gave an email; no SMS. Who is named as issuer waits
on CA question 7. A refund adds a refund note to the same order.

- No substitutes and no price changes by the store; an alternative is a new order (D-35,
  D-42).
- D-61 with an unreachable customer: the store records "keeps the rest" within the 24
  hours.
- The same-day estimate shown to the customer follows BC-14 and D-34, including "expected
  next opening day" wording (handoff §11 item 24).
- Refunds are requested from SDD 04; this SDD never calls Cashfree.

## 5. Phase 6 rework (new migrations only; applied files are never edited)

| Area | Action |
|---|---|
| Status CHECK on `store_order_requests` | Replace with the new checkout states |
| `UNIQUE (cart_id)` on `store_order_requests`, which allows one checkout per cart for ever | Replace with "one open checkout per cart", so a customer can reserve again after an expiry or cancel; the cart returns to an editable status |
| Other confirm-first columns that are NOT NULL (`provisional_delivery_tariff_minor`, `delivery_tariff_version`, `money_calculator_version` and any others found) | List every one from the applied migrations and relax or fill each |
| Terminal-state triggers and the one-active-hold index | Change so a late payment can take holds again on an expired checkout (impact check §3) |
| `payment_ready` amount and hold invariant triggers | Retire or replace with the reservation's own checks |
| `confirmation_reminder_at` and the other confirm-first timestamps, which are NOT NULL | Make nullable in a new migration, or fill with the reservation time; decided after reading the later applied migrations |
| `submit_order_request` | Becomes `create_reservation`: creates holds, no store confirmation tasks |
| `create_bucket_transfer_holds`, `release_request_holds` | Keep; called from reservation, using requested quantity |
| Store confirm, partial confirm, clarification, customer acceptance | Retire |
| Confirmation-window calculator and emergency-pause clock | Bypass; D-04 uses elapsed hours, and pause semantics are not kept (D-55) |
| `payment_ready_window_seconds` policy (minimum 1,800) | New key `commerce.reservation_window_seconds` |
| Timer task types, event and notification registry, projections, reconciliation scans | Add new types; retire the confirm-first ones |
| `stores.pickup_enabled` and the `pickup_enabled` policy key | Stop using: pickup is always offered (handoff §11 item 15) |
| Old `payment_ready` rows | None exist on dev (checked 2026-11-10), so nothing to migrate |
| Screens | Cart: "Reserve and pay". Customer detail: payment and countdown. Store: paid-order inbox with accept and missing-books |

The old Phase 6 decision step is retired only after the Phase 9 lane's photo-request
rework lands (handoff §9).

## 6. Tables

- `store_order_requests`: new states; `reservation_expires_at`; delivery quote reference.
  Confirm-first columns stay but are unused.
- `store_order_request_items`: requested quantity and the server-bound price only.
- `inventory_holds`: 10-minute expiry; `converted_to_sale` used at payment.
- **New** `store_orders`: checkout id, store, customer, fulfilment method, amounts in
  paise (book total, delivery charge, total), status, reason code, acceptance deadline,
  whether a photo request was open at payment, the photo-send and photo-check deadlines,
  seller and policy snapshots, timestamps. The photo request itself belongs to the Phase 9
  lane and is keyed to the listing; this SDD reads it once, at payment, through a function
  that lane provides.
- **New** pauses table (§4).
- **New** `store_order_items`: order, listing, stock row, title and condition snapshots,
  quantity, unit price, status.

## 7. Worked examples the full SDD will include

1. ₹400 book, pickup, paid by UPI, accepted, ready.
2. Two books (₹400, ₹250) with delivery ₹70; one missing; customer keeps the rest.
3. Same order; customer cancels all.
4. Payment succeeds at minute 12; book still available (D-06).
5. Payment succeeds at minute 12; book sold meanwhile (Q38).
6. Store never accepts; 24-hour automatic refund (D-04).
7. Photo request open at payment; customer rejects the photos (D-43).

## 8. Test list headings

Reservation races (two customers, one copy); expiry against a webhook arriving at the same
moment; late payment; limits and pauses; acceptance timers on open hours and elapsed
hours; missing-book outcomes; tenant isolation; idempotent retries of every command.

## 9. Open points

- Decided on 2026-11-10 and now in the register: D-79 (accepted but not prepared), D-81
  (what cancels a live reservation), D-83 (missing book found later), D-84 (late payment
  with several books), D-85 (payment after a cancelled checkout).
- Design choice 1 in the master SDD (separate `store_orders` table).
- Quote lifetime against the 10-minute reservation (handoff §11 item 13): waits on the
  delivery provider.
- The reliable store-alert channel for test mode (D-02; handoff §11 item 25).
- Whether the store screens already have a quick "mark sold" (stage 0 check 3; D-15).
