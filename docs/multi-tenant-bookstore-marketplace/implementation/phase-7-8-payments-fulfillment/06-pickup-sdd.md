# SDD 06: Pickup (skeleton)

**Status:** skeleton for owner review, 2026-11-10. Not approved.
**Authority:** none yet. Rules come from the [decision register](../PHASE-7-8-decision-register.md).
**Owns:** a paid pickup order from "accepted" to "picked up": readiness, the pickup code,
handover, the pickup window, missed and refused pickups.
**Related:** [master](./00-master-state-model-sdd.md) · [checkout](./01-checkout-reservation/01-0-overview.md) ·
[refunds](./04-refunds-returns-recovery-sdd.md)

---

## 1. Flow

```text
accepted -> [photo check, if any] -> store marks ready -> customer notified with code
         -> customer comes within 3 open days -> store verifies code -> picked_up
```

Pickup is always offered and a store cannot switch it off (D-24; handoff §11 item 15). It
does not depend on a delivery quote (P-6).

## 2. States used (from the master SDD §6)

| From | To | Actor | Guard | Decision |
|---|---|---|---|---|
| `accepted` | `ready_for_pickup` | Store | Every remaining book is present and matches the listed edition and condition; photos approved if they were requested and still required (SDD 01 §6.7) | D-61, D-44, D-43 |
| `ready_for_pickup` | `picked_up` | Store | Valid pickup code | BC-33, Q73 |
| `ready_for_pickup` | `cancelled` (pickup missed) | Timer | Window ended | Q72 |
| `ready_for_pickup` | `cancelled` (refused at pickup) | Store, on the customer's refusal | Reason recorded | D-44 |
| `awaiting_store`, `accepted`, `awaiting_photo_check` | `cancelled` (customer cancelled) | Customer | Not yet marked ready | D-67 |

After "ready", the customer cannot cancel in the app; an uncollected order is refunded in
full at the deadline (D-67, Q72).

Races, each settled by the rule in master §14 (lock the order, re-check, first commit wins):

- **Code verified against the window ending.** If the code check commits first, the order
  is `picked_up` and the expiry does nothing. If the expiry commits first, the order is
  cancelled and refunded and the code no longer works; the store sees "this order was
  cancelled and refunded, do not hand over the book". Using the code, changing the order,
  and recording that the store earned the money happen in one transaction.
- **Customer cancels against "Mark ready".** If the cancel commits first, there is a
  refund and no code. If "Mark ready" commits first, there is a code and the cancel is
  refused. Never both.
- **Refusal at the counter against the window ending:** either way the order is cancelled
  and refunded once; the first to commit sets the reason.

## 3. Ready notice

In the app only (D-02):

- the store's address and opening hours;
- the store's one short pickup instruction, if set (D-62);
- the pickup code;
- the actual last pickup date (D-73).

One reminder 24 hours before the deadline, in the app and by email when given (D-57). The
email does not carry the pickup code. The store may resend the notice; that
does not reset the window or create a second order (D-44).

## 4. Pickup window

- Three days, counting only days the store is open, from the ready notice (Q71, D-73).
- Computed on the server from the store's hours and closures in India time, and stored as
  a fixed deadline when the order becomes ready.
- If a photo check applies, the notice and the three days start only after the customer
  approves (D-43).
- The full SDD defines what happens if the store adds a closure after the deadline was
  set.

## 5. Pickup code

Within the security baseline (handoff §7): random, single-use, expiring at the pickup
deadline, attempt-limited, stored hashed.

- Issued when the order becomes ready; shown to the customer only.
- Anyone who presents the valid code may collect (D-44).
- Verified by the store on its order screen; the server checks it.
- The full SDD sets the code length, the attempt limit and what happens after too many
  wrong tries.
- Code states (`pickup_codes.status`): `active`; `used` (final); `expired` (window ended;
  final); `cancelled` (order cancelled; final); `locked` (too many wrong tries; the admin
  or a fresh code issued by the store's resend unlocks it, as the full SDD sets).

## 6. Handover and what it triggers

- `picked_up` is recorded with the time and the staff account.
- The store earns its money at this moment (Q50a). The ledger posts it (SDD 03); the
  payout wait starts (D-28, SDD 05).
- The 48-hour condition-reporting target starts now, not at "ready" (D-44, Q60).

## 7. Refusal, missed pickup and returns

- **Refusal:** the customer may refuse a damaged, wrong or missing book at the counter.
  Full refund. If the book does not match the listing it is a store fault and the store
  bears the fee (D-44, D-27).
- **Missed pickup:** cancelled and refunded in full automatically (Q72, Q59). Counts
  against nobody.
- **Stock after a cancelled pickup:** the full SDD defines how the books go back on sale.
- **Returns of a picked-up book:** the customer brings the book back to the store (D-32);
  the case itself is in SDD 04.

## 8. Tables

- **New** `pickup_codes`: order, store, customer, code hash, status, attempts, expiry,
  verified time.
- `store_orders`: `ready_at`, `pickup_deadline_at`, `picked_up_at`, who verified.
- Store profile: one short pickup-instruction text (D-62).

## 9. Screens

- Customer: order detail with status, address, hours, code and last pickup date; cancel
  button until ready.
- Store: paid pickup orders; "Mark ready" with the check-the-book confirmation; code
  entry; "Customer refused" with a reason; resend notice.

## 10. Worked examples the full SDD will include

1. Ready on Friday evening, store closed Sunday: last pickup date shown.
2. Customer collects on day 2: code verified, store earns ₹400 less the fee.
3. Customer never comes: automatic full refund on the deadline.
4. Customer refuses a book with an unlisted torn cover: full refund, store fault.

## 11. Test list headings

Wrong code; reused code; expired code; attempt limit; another store's staff cannot verify;
the customer of another order cannot see the code; window across closed days; reminder
sent once; cancel blocked after ready; missed-pickup refund fires once; code check against
window end, both orders; customer cancel against "Mark ready", both orders.

## 12. Open points

- Decided (D-92): in the pilot only the store owner's login verifies the code. D-44 says
  "authorized bookstore staff", and staff accounts are deferred.
- Store-hours data quality and holiday handling (stage 0 check 2), which the window
  depends on.
- Whether the reminder and ready notice need the reliable store-alert channel work (D-02).
