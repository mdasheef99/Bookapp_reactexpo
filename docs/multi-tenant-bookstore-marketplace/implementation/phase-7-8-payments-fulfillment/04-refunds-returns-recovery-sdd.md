# SDD 04: Refunds, Returns, Recovery and Chargebacks (skeleton)

**Status:** skeleton for owner review, 2026-11-10. Not approved.
**Authority:** none yet. Rules come from the [decision register](../PHASE-7-8-decision-register.md).
**Owns:** every way money goes back to a customer, return and dispute cases, store debts,
store fault records, chargebacks, and the losses BookConnect absorbs.
**Related:** [master](./00-master-state-model-sdd.md) · [ledger](./03-ledger-reconciliation-sdd.md)

---

## 1. Rules that apply to every refund

- Only BookConnect's controlled process refunds; stores never do (Q57, Q105, D-45).
- To the original payment method, at standard speed; customers are told 2–3 working days
  (D-10, D-48). The one exception is a refund that Cashfree cannot return to the original
  method; §6a covers it.
- The total refunded can never exceed the amount paid; concurrent refunds are locked. A
  "full refund" means bringing the total refunded up to the amount paid: if ₹250 was
  already refunded for a missing book on a ₹720 order and the customer then cancels all,
  the second refund is ₹470, not ₹720. Refunds already sent, pending or of unknown result
  all count toward the total.
- A refund and a chargeback on the same payment are counted together (§5).
- Each automatic refund is tied to the one cancellation event that caused it. If two
  triggers fire for the same order, such as the 24-hour deadline and a store's
  "unavailable" report, the second finds the order already cancelled and creates nothing.
- Each refund carries our own unique ID. An unknown outcome is queried by that ID, never
  re-sent with a new one (handoff §7).
- Pickup, delivery or payout never closes a valid refund, return, dispute or chargeback
  (E10, BC-40).
- Customers never bear costs the store or the provider caused (BC-34).

## 2. Refund categories

"Auto" means no person approves it; above ₹1,000 the admin is alerted afterwards (D-29).

| # | Trigger | Approval | Amount | Fee borne by | Decisions |
|---|---|---|---|---|---|
| 1 | Store did not accept in 24 hours | Auto | Full, with delivery | Store only if the alert was delivered and no platform or notification failure is found; else BookConnect | D-04, D-22, D-26, D-27 |
| 2 | Store has none of the books | Auto | Full, with delivery | Store | Q55, D-15, D-27 |
| 3 | Missing books, customer keeps the rest | Auto | Those books' prices; delivery charge stands | Store | D-61, Q65, D-26 |
| 4 | Missing books, customer cancels all | Auto | Full, with delivery (less anything already refunded under 3) | Store | D-61 |
| 5 | Late payment and the book is gone | Auto | The whole payment | BookConnect | Q38, D-22 |
| 6 | Wrong-amount payment | Auto | That payment in full | BookConnect | D-29 |
| 6a | Duplicate payment | None: not a refund of ours | Nothing from BookConnect. Cashfree reverses it (CF-30); we record and confirm the reversal (SDD 02 §5) | BookConnect, if any fee arises | D-29, CF-30 |
| 7 | Customer cancels before ready (pickup) or before collection (delivery) | Auto (D-91) | Full, with delivery | BookConnect; provider fee per D-31 | Q45, D-67 |
| 8 | Photos not sent, rejected, or not approved in time | Auto | Full, with delivery | Store if photos were not sent or do not match; else BookConnect | D-43, D-53 |
| 9 | Pickup missed | Auto | Full | BookConnect | Q72, Q59, D-22 |
| 10 | Refused at pickup | Auto (D-91) | Full | Store if the book does not match | D-44 |
| 11 | No rider, customer cancels | Auto (D-91) | Full, with delivery | BookConnect | D-77 |
| 12 | Failed delivery, parcel back at the store | Auto once the store confirms; opened or damaged parcel goes to the admin queue | By cause. Customer fault: paid minus quoted delivery minus actual return trip, never below zero. Store-caused: full, and the store bears the book refund and the delivery costs that cannot be recovered (BC-38, IN PRINCIPLE) | By cause | D-40, D-09, D-39, BC-38 |
| 13 | Customer cancels after collection, meaning once the order is `out_for_delivery` | As 12 | As 12, customer fault. Q45b is IN PRINCIPLE and subject to law: until the lawyer answers, this goes to the admin queue with a one-business-day deadline and is not automatic (D-82) | BookConnect | Q45b, D-39, D-82 |
| 14 | Parcel lost by the provider | Auto | Full, with delivery | BookConnect; shortfall counts toward the loss cap | D-22, BC-35 |
| 15 | Approved return | Admin approves the request, with a typed reason above ₹1,000 (D-38, D-29); refund releases automatically after inspection passes | Store fault on a delivered order: book price plus forward delivery; the store also bears the reverse pickup (D-70). Less the cost of a failed return trip the customer caused (D-71) | By cause: the store when it caused the return; BookConnect when the delivery provider damaged the book or the cause is unclear (D-27, BC-35) | D-38, D-10, D-70, D-71, D-27, Q62 |
| 16 | Dispute | Admin, any amount; typed reason above ₹1,000 | As decided | By cause | D-38 |
| 17 | Goodwill | Admin starts it; typed reason above ₹1,000 | As decided | BookConnect | D-29, D-38 |
| 18 | Store asks for a refund | Auto up to ₹1,000; admin with typed reason above | As requested, up to the amount paid | Store, with any delivery charge | D-45 |

## 3. Refund states (`refunds.status`)

| State | Meaning | Moved on by |
|---|---|---|
| `requested` | Created by a rule or a person | The system at once: to `approved` (automatic categories) or `awaiting_approval` |
| `awaiting_approval` | Categories 13 and 16 to 18 where approval is needed. A return (15) is approved on the return case, so its refund is created already `approved` when inspection passes | Admin; overdue items show in the admin queue |
| `rejected` | Admin said no; reason recorded | Final |
| `approved` | Cleared to send | The refund sender, a server job that retries until Cashfree answers |
| `submitted` | Sent to Cashfree with our refund ID; the answer may be unknown | The refund webhook, and the refund status poll by our refund ID |
| `processing` | Our name for a refund Cashfree has accepted but not finished, including `ONHOLD`. `ONHOLD` is a normal state (D-54): BookConnect's balance or the store's balance is too low, and it is released by recharging or by a credit adjustment (CF-17). It raises an admin alert | The same webhook and poll; an item still here after a set time goes to the admin queue |
| `succeeded` | Cashfree confirms; ledger posted | Final |
| `failed` | Cashfree reports failure | The `refund_failed` admin queue (handoff §11 item 7), then §6a |

Cashfree's own refund status names other than `ONHOLD` (CF-17) and `PENDING_APPROVAL`
(CF-A7) are not yet in the fact record; they are added from the API reference before the
full SDD maps them.

Races (master §14):

- Two refunds on one payment: both lock the payment; the second sees the first's amount in
  the total.
- A refund created before the split call: the split is cancelled or reduced first (SDD 05
  §4), and the refund is paid from BookConnect's balance (CF-15).
- A refund while the store's share is being released: SDD 05 §4.
- A refund and a chargeback: §5.

## 4. Returns (Q61, D-12, Q60)

Allowed for misdescription, defect, wrong edition, missing pages or similar; not for change
of mind. Reporting target 48 hours; for pickup it counts from handover (D-44).

| State | Meaning | Decision |
|---|---|---|
| `requested` | Customer opened it with evidence | Q61 |
| `awaiting_store_reply` | Store has 24 business hours; overdue goes to the admin queue | D-37, BC-36 |
| `approved` / `rejected` | Admin decision, at any amount | D-38 |
| `awaiting_handover` | Delivered order: reverse pickup booked. Pickup order: customer brings it back. 5 days from approval, reminder on day 4 | D-32, D-72 |
| `handover_retry` | Customer missed the reverse pickup: one free rebook, then drop-off at the store. The cost of the failed trip the customer caused is deducted from the refund | D-71, D-09 |
| `awaiting_inspection` | Book is at the store; 48 hours; overdue goes to the admin queue | D-10 |
| `inspection_passed` | Refund releases automatically | D-38 |
| `inspection_failed` | Becomes a dispute | D-38 |
| `lapsed` | Not handed over in 5 days; closed without refund | D-72 |
| `closed` | Finished | |

## 5. Disputes and chargebacks

- **Disputes:** opened by a customer, a store or the admin; evidence from both sides;
  admin decides; outcome may create a refund, a store fault, or nothing. States
  (`dispute_cases.status`): `opened`, `awaiting_store_reply` (24 business hours, D-37;
  overdue goes to the admin queue), `awaiting_decision` (admin), `decided`, `closed`.
- **Chargebacks** (Q68, D-69): recorded when Cashfree reports one. Cashfree debits the
  amount from BookConnect's balance, not the store's, and charges no chargeback fee
  (CF-24, CF-25). Store-caused: recovered from the store like a post-payout refund. Fraud
  where the store complied, platform error, or unclear fault: BookConnect bears it, counted
  toward the loss cap. The full SDD defines the evidence standard for "the store complied"
  and reversal if fault is reassigned (handoff §11 item 6). States (`chargebacks.status`):
  `reported`, `evidence_due` (admin, by Cashfree's deadline), `evidence_sent`, `won` (amount
  released back, CF-25), `lost`, `accepted` (we chose not to contest). Cashfree's dispute
  webhook and a daily read of open disputes (CF-26) move it on.
- **Refund and chargeback on the same payment.** The customer must not be paid twice and
  the store must not be charged twice.
  - A chargeback opens after a refund succeeded: the refund is sent to Cashfree as
    evidence and the chargeback is contested.
  - A refund is due while a chargeback is open on the same payment, whether the refund was
    created before or after it (D-80). Sending it blindly risks paying the customer twice;
    blocking it would leave a cancelled order unrefunded for weeks. So the refund goes to
    the admin queue with a one-business-day deadline, the customer is told it is being
    checked, and the admin either sends it and uses it as evidence, or accepts the
    chargeback and closes the refund.
  - What is recovered from the store is worked out once per payment, on the net amount the
    customer finally received, and never more than the store's share. Every debit Cashfree
    actually makes is still recorded.

## 6. Refund after the store was paid, and store debt

- How Cashfree takes back the store's share depends on timing (CF-15). Before the split,
  the refund is paid from BookConnect's balance and the split is not made. After the split
  and before the store is paid, its held balance is debited and no debt arises. After it is
  paid, its balance may be too low and the refund would go `ONHOLD` (CF-17).
- So after payout BookConnect refunds the customer at once from its own Cashfree balance,
  by a credit adjustment where needed (CF-19), and records a store debt (D-14, Q67, D-54).
  The customer does not wait for the store.
- **One recovery route per debt.** Cashfree has confirmed what it does when a paid
  store's balance is short: the refund waits until the balance is there, and we can fund
  it with an adjustment (CF-50). So the route is fixed. BookConnect credits the store's
  balance by the missing amount (CF-19), Cashfree's refund then takes exactly that money,
  and the amount credited is the store's debt. It is recovered later by BookConnect's own
  debit adjustment and by nothing else. BookConnect never leaves the refund waiting for
  the store's future sales, which would both delay the customer (D-14) and take the money
  a second time. The sandbox test confirms the refund consumes the credit and nothing more.
- **How "recovered from the next payout" works.** Release dates are already with Cashfree
  and fire by themselves, so waiting for the payout would let it leave first. When a debt
  opens, the server locks that store's unsettled lines and at once sends a debit against
  the store's held balance, before any of those lines can be released. If the balance is
  too low, the release dates of earned lines are moved later, which Cashfree allows inside
  the window (CF-44), until the debit succeeds. Each recovery records which line paid which debt.
- A debit fails when the balance is short (CF-19). The debt then stays open and is tried
  again when the store next has a balance. Each debit carries its own key (CF-38), so an unknown result is
  looked up and never sent twice. A debit and a settlement on the same day cannot overdraw
  the store: Cashfree refuses the debit.
- **Which stage applies is decided by what Cashfree actually did**, not by our own clock. If
  a refund is sent while the share is being released, reconciliation shows whether the
  share was debited or had already been settled; only then is the line marked `reversed`
  or a debt opened (SDD 05 §4).
- Debt states (`store_debts.status`): `open`, `partly_recovered`, `repayment_requested`
  (7-day clock running), `recovered` (final), `written_off` (final loss, posted once).
  Money received after a write-off is posted as a recovery against that loss, and the debt
  is not reopened. There is one outstanding amount per debt, reduced by every recovery
  whatever its route.
- Each refund names the store's and BookConnect's parts explicitly (`refund_splits`,
  CF-16), so a delivery charge is never taken from the store by Cashfree's default split.
- The debt is recovered from the store's next payout. A repayment request is issued on the
  first payout run that does not clear it, or at once if the store has nothing awaiting
  payout; 7 days count from then (handoff §11 item 21).
- Unpaid past 7 days: new paid orders and payouts pause for that store (D-21, D-63), and
  the debt becomes a final loss counted toward the cap (D-08, D-30).
- A fee or cost with no payout to deduct from also becomes a debt.

## 6a. Refunds Cashfree cannot send the usual way

A customer's right to a refund does not depend on Cashfree's limits (register §9; Q60 is a
reporting target, not a cutoff; handoff §11 item 12).

- **After Cashfree's refund window** (six months, CF-20; other Cashfree pages give 180 and
  120 days, so the exact limit is confirmed before the full SDD): the refund goes to the
  admin queue and is paid by another route.
- **A refund that fails to the original UPI address** can go to another UPI address of the
  customer with consent, or be paid from BookConnect's balance (CF-21). CF-21 covers UPI
  only; a failed card refund has no confirmed alternative yet.
- Rules for any alternative route: the owner approves each one; the original refund is
  first confirmed as failed or impossible at Cashfree and closed, so it can never also go
  through; the payment is recorded in the ledger and audit log against the same refund; the
  total-refunded limit in §1 still applies.
- The route itself (bank transfer or another Cashfree product) and the consent wording are
  lawyer and Cashfree questions (§9). Until the lawyer confirms a route is lawful, none is
  switched on: the handoff's "original payment method only" rule (§7) stands, and such a
  refund waits in the admin queue with the customer told.

## 7. Store faults

`store_fault_events` records each fault with its cause and evidence: missed 24-hour
deadline (only with the "alert delivered" fact and no platform failure, D-04), sold-out
paid book, wrong item, photos that do not match. Three in 30 days pause new paid orders
until admin review (D-21). Suspected fraud, or a debt unpaid past 7 days, pauses new paid
orders at once, without waiting for three faults (D-21); payouts pause too (D-63).
Existing orders and refunds continue. The check at checkout is SDD 01 §2.

## 8. Tables

- **New** `refunds`: order, payment, category, cause, amounts in paise (books, delivery,
  deductions), who bears the fee, status, our refund ID (unique), Cashfree's ID, approver
  and reason where needed.
- **New** `return_cases`, `dispute_cases`, `chargebacks`, `store_debts`,
  `store_fault_events`.
- **Existing, empty** `refund_cases`: reused as the admin queue item that points at a
  refund, return or dispute. It has no column for that pointer today, so a new migration
  adds typed reference columns, as SDD 03 does for its reused table.

## 8a. Screens

- Customer: refund status on the order; "report a problem" with photos (opens a return);
  return progress and what to do next; open a dispute.
- Store: reply to a return or dispute with evidence; confirm a returned book and its
  inspection; ask for a refund (D-45); debts owed and repayment request.
- Admin queues are SDD 08. The customer complaint form and ticket number (D-51) are also
  SDD 08, whose scope is widened to cover support intake.

## 9. Open points

- Decided on 2026-11-10 and now in the register: D-80 (refund while a chargeback is open),
  D-82 (category 13 goes to the admin until the lawyer answers), D-91 (categories 7, 10
  and 11 are automatic).
- On a live account, whether a refund soon after payment can be funded from that payment
  or only from a recharged balance (CF-A10). This sets the size of the balance (D-54).
- Settled by Cashfree's third reply: after payout with a short store balance the refund
  waits, and we fund it by an adjustment (CF-50). BookConnect tops up at once so the
  customer does not wait (D-14).
- What puts a refund in `PENDING_APPROVAL` and whether it needs action from us (CF-A7).
- §6a: the exact refund window, the alternative route after it, the route for a failed
  card refund, and the consent wording (Cashfree and lawyer).
- Q45b and BC-38 are IN PRINCIPLE (categories 12 and 13).
- Whether deducting delivery costs from a customer-fault refund is allowed (lawyer).

## 10. Worked examples and tests the full SDD will include

A rupee example for each of the 18 categories and the duplicate-payment case (6a), plus
the ₹530 post-payout debt case. Tests: double refund; refund above the amount paid; partial
then full refund; refund against chargeback, each order; two triggers on one order; debt
recovered once by one route; recovery after write-off; refund after the Cashfree window; `ONHOLD` then success; failure then queue;
approval thresholds at ₹1,000 and ₹1,001; return lapse on day 5; debt clock; fault count
window.
