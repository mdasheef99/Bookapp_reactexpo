# SDD 00: Master and State Model (skeleton)

**Status:** skeleton for owner review, 2026-11-10. Not approved.
**Authority:** none yet. Business rules come from the
[decision register](../PHASE-7-8-decision-register.md) (REG); this document must not add any.
**Owns:** the list of entities, the five lifecycles and how they connect, shared timers and
settings, the fault model, and the map of which SDD owns which decision.

---

## 1. Scope

- **In:** pay-first checkout, Cashfree test-mode payments, the ledger, refunds and returns,
  store money, pickup, and the Bengaluru bike-delivery pilot.
- **Out:** live payments (BC-43), push notifications (D-02), a courier option (D-16, P-7),
  intercity delivery (BC-17), a second payment provider (BC-44), commission and
  subscription billing (0% and ₹0 in the pilot: Q7, Q13).

## 2. What exists today (checked 2026-11-10, read-only)

Dev Supabase project `ahntbtktjjmvfosgkmgn`:

- All 39 Phase 6 migrations are applied. `store_order_requests` has 0 rows and there are 0
  active holds, so no existing order data needs migrating.
- No `payments`, ledger, or paid-order tables exist.
- Five empty tables from the 2026-06-19 foundation migration exist: `refund_cases`,
  `finance_reconciliation_cases`, `settlement_batches`, `seller_payout_accounts`,
  `delivery_ops_cases`. The first, second and fifth share one generic "ops case" shape.
- `marketplace_policy_config` holds settings by key and scope. `store_entitlements` holds
  per-store feature keys. `stores` has `operating_hours`, `pickup_enabled`,
  `delivery_enabled` and `minimum_delivery_order_value_minor`.
- Reusable from Phase 6 ([impact check](../PHASE-7-8-phase6-impact-check.md)): inventory
  locking and holds, the timer task framework (`event_action_tasks`), the task worker,
  idempotent commands, the transition log, audit log, events and in-app notifications.

## 3. Entities

| Entity | Table | New? | Owner |
|---|---|---|---|
| Cart | `marketplace_carts`, `marketplace_cart_items` | Exists, kept | 01 |
| Checkout (reservation) | `store_order_requests`, `store_order_request_items` | Exists, changed | 01 |
| Stock hold | `inventory_holds` | Exists, small change | 01 |
| Paid order | `store_orders`, `store_order_items` | New (§10 choice 1) | 01 |
| Payment (one Cashfree order) | `payments` | New | 02 |
| Payment attempt | `payment_attempts` | New | 02 |
| Webhook message | `provider_webhook_events` | New | 02 |
| Ledger entry | `finance_ledger_entries` | New | 03 |
| Reconciliation run and case | `reconciliation_runs`; `finance_reconciliation_cases` | New; exists | 03 |
| Refund | `refunds` | New | 04 |
| Admin queue item for a refund, return or dispute | `refund_cases` | Exists | 04 |
| Return, dispute, chargeback case | `return_cases`, `dispute_cases`, `chargebacks` | New | 04 |
| Store debt | `store_debts` | New | 04 |
| Store fault | `store_fault_events` | New | 04 |
| Vendor account | `seller_payout_accounts` | Exists | 05 |
| Payout line, weekly run, payout | `store_payout_lines`; `settlement_batches`; `store_payouts` | New; exists; new | 05 |
| Pickup code | `pickup_codes` | New | 06 |
| Delivery quote, shipment | `delivery_quotes`, `delivery_shipments` | New | 07 |

## 4. Five separate lifecycles (E10, BC-37)

Each has its own status field. One never overwrites another.

1. **Checkout**: reserve stock, wait for payment. Ends when paid or closed. (01)
2. **Payment**: the Cashfree order and its attempts. (02)
3. **Order fulfilment**: store accepts, prepares, hands over. (01, 06, 07)
4. **Refunds, returns, disputes, chargebacks**: can start before or after fulfilment
   ends, and after the store was paid. (04)
5. **Store money**: unearned, earned, paid out, owed back. (03, 05)

```text
cart -> checkout reserved --verified payment--> order awaiting_store -> accepted
          |                                          |                    |
          v                                          v                    v
   reservation_expired                    cancelled + refund      ready_for_pickup -> picked_up
   (late payment: D-06/Q38)                                       ready_to_ship -> ... -> delivered
```

## 5. Checkout states (`store_order_requests.status`)

The 12 Phase 6 states stop being used for new rows. New values:

| State | Meaning | Leaves by |
|---|---|---|
| `reserved` | Stock held for 10 minutes (Q36); payment may be in progress | Verified payment (`converted`); timer (`reservation_expired` or `awaiting_payment_result`); customer cancel (`customer_cancelled`); store became ineligible (`platform_cancelled`) |
| `awaiting_payment_result` | The 10 minutes ended while a payment was still processing; stock stays held (BC-10) | Verified success (`converted`); failure, or the grace timer ending (`reservation_expired`, holds released, Cashfree order terminated) |
| `converted` | Payment verified; a paid order exists; holds became sales | Final |
| `reservation_expired` | No successful payment; holds released | Final, except a verified late payment (D-06, Q38) |
| `customer_cancelled` | Customer left before paying; holds released; Cashfree order terminated (CF-32) | Final, except a verified late payment |
| `platform_cancelled` | Store became ineligible before payment; holds released; Cashfree order terminated | Final, except a verified late payment |

A payment can still succeed after any of the last three states (CF-33). After
`reservation_expired` the late-payment rule applies (D-06, Q38). After `customer_cancelled`
or `platform_cancelled` the payment is refunded in full automatically and no order is
created (D-85). Only the three events in D-81 lead to `platform_cancelled`.

## 6. Order states (`store_orders.status`)

| State | Meaning | Decisions |
|---|---|---|
| `awaiting_store` | Paid; the store must accept within 24 elapsed hours | Q49, BC-12, BC-13, D-04 |
| `accepted` | Store accepted and is preparing | Q49, BC-14, D-34 |
| `awaiting_photo_check` | Store sent the requested photos; customer has 24 hours | D-43, D-53 |
| `ready_for_pickup` | All books ready; pickup code issued | D-61, D-44, Q71, D-73 |
| `picked_up` | Code verified at handover; fulfilment complete | BC-33, Q50a |
| `ready_to_ship` | Packed; delivery is being booked | D-17, D-77 |
| `delivery_booked` | A rider accepted | D-24 |
| `out_for_delivery` | Rider collected the parcel | Q50b, BC-27 |
| `delivered` | Proof of delivery recorded; fulfilment complete | D-74 |
| `delivery_failed` | Delivery failed; parcel returning | D-09, BC-25 |
| `returned_to_store` | Store confirmed the parcel is back. Final for fulfilment; the refund is SDD 04 category 12 | D-40 |
| `cancelled` | Closed without the customer getting the books; a reason code says why | See below |

Final states: `picked_up`, `delivered`, `returned_to_store`, `cancelled`. Every other state
has a timer or a named actor that moves it on. `accepted` has the D-79 deadline: an alert
at the end of the next business day, and an automatic refund as a store fault a business
day later. The transitions for the four delivery states are SDD 07's. "After collection"
in Q45b means from `out_for_delivery` onward (D-82).

`cancelled` reason codes: store did not accept (D-04); store has none of the books (Q55);
customer cancelled all after missing books (D-61); customer cancelled (Q45, D-67); photos
not sent, rejected, or not approved (D-43, D-53); pickup missed (Q72); refused at pickup
(D-44); no rider and customer cancelled (D-77); parcel lost (BC-35).

Item level (`store_order_items.status`): `active` or `removed_unavailable` (D-61 "keeps
the rest").

Payment states are in SDD 02. Refund, return and dispute states are in SDD 04.

## 7. Timers

All run on the server through the existing task framework. Client timers are display only.

| Timer | Starts at | Length | Clock | Decision | Owner |
|---|---|---|---|---|---|
| Reservation | Reservation created | 10 minutes | Elapsed | Q36 | 01 |
| Payment-result grace | Reservation end with a payment pending | To be set (§10 choice 3) | Elapsed | BC-10 | 02 |
| Payment status poll | Payment created | Repeats until Cashfree shows a final result, including after `closed_unpaid` | Elapsed | BC-11 | 02 |
| Acceptance reminder | Verified payment | 30 minutes | Store open hours | BC-12 | 01 |
| Acceptance escalation | Verified payment | 45 minutes | Store open hours | BC-12, BC-13 | 01 |
| Acceptance deadline | Verified payment | 24 hours | Elapsed | D-04 | 01 |
| Store sends requested photos | Verified payment | 24 hours | Elapsed | D-43 | 01 |
| Customer photo check | Photos sent | 24 hours | Elapsed | D-43, D-53 | 01 |
| Pre-payment photo request | Request made | 24 hours | Store business hours | D-75 | Phase 9 lane |
| Pickup window | Ready notice | 3 days | Store open days | Q71, D-73 | 06 |
| Pickup reminder | 24 hours before the pickup deadline | One notice | Elapsed | D-57 | 06 |
| Store reply on a return or dispute | Case opened | 24 hours | Store business hours | D-37 | 04 |
| Return handover | Return approved | 5 days, reminder on day 4 | Elapsed | D-72 | 04 |
| Return inspection | Book arrives at the store | 48 hours | Elapsed | D-10 | 04 |
| Refund status poll | Refund submitted | Repeats until Cashfree shows a final result | Elapsed | Handoff §7 | 04 |
| Store debt repayment | Repayment request | 7 days | Elapsed | D-14 | 04 |
| Payout wait | Handover | 3 days (release date), then Cashfree's weekly schedule pays on the first working day of the next week (CF-47) | Elapsed, India time | D-28, Q51 | 05 |
| Vendor verification stuck | Vendor submitted | 24 hours | Elapsed | CF-12 | 05 |
| Settlement-window guard | Daily check | Fires a set number of days before a share's window ends (setting) | Calendar | CF-04 | 05 |
| Vendor status read | Daily | Repeats | Calendar | CF-14 | 05 |
| Release date not sent after handover | Handover | Retry, then an admin case after 1 day (setting) | Elapsed | D-28 | 05 |
| Accepted order not ready | Acceptance | Alert at the end of the promised day (BC-14, D-34); automatic refund at the end of the following business day (settings) | Store business days | D-79 | 01 |
| Duplicate-payment reversal wait | Duplicate recorded | 3 business days (setting; reviewed when CF-A5 is answered), then an admin refund within 1 business day | Business days | D-78, CF-30 | 02 |
| Refund stuck in `processing` | Refund submitted | Setting, to be set; then the admin queue | Elapsed | D-54 | 04 |
| Admin queue deadline (refund held for a chargeback; category 13) | Item queued | 1 business day | Support hours (D-19) | D-80, D-82 | 04 |
| Chargeback evidence | Chargeback reported | Cashfree's deadline, read from the dispute | Elapsed | Q68 | 04 |
| Vendor correction wait | `action_required` | Setting, to be set; then the admin queue | Elapsed | D-59 | 05 |
| No-rider rebook | No rider found | Next day | Calendar | D-77 | 07 |
| Loss-cap month | First of the month | India-time calendar month | Calendar | D-30 | 03 |

## 8. Settings (stored in `marketplace_policy_config`)

| Setting | Default | Decision |
|---|---|---|
| Reservation window | 600 seconds | Q36 |
| Maximum book total per order | ₹5,000 | D-56, D-65 |
| Per-customer order limit | Off | D-56 |
| Store starter limits | 20 paid orders a day; ₹25,000 unsettled | D-20, D-66 |
| Monthly loss cap | ₹10,000 | D-08 |
| Refund approval threshold | ₹1,000 | D-22, D-29 |
| Delivery-charge absorption | ₹50 per order | D-31, D-41 |
| Store fault rule | 3 faults in 30 days | D-21 |
| Acceptance deadline; photo limits; return handover and reminder | 24 h; 24 h and 24 h; 5 days and day 4 | D-04, D-43, D-72 |
| Delivery pincode list | Set after the provider check | D-18 |
| Risk-alert thresholds | To be set | D-64 |
| Fee rates | The payment fee is recorded as Cashfree reports it per payment (CF-29); Easy Split 0.20% on sandbox, production rate unconfirmed (CF-27); how the other fees are reported is open (SDD 03 §11) | D-13, D-47 |
| Caps on open reservations and payment attempts per customer | To be set | Handoff §7 |
| Engineering settings with no register decision | Payment-result grace (proposed 15 minutes); Cashfree order expiry (proposed 16 minutes, CF-31); settlement window (as Cashfree confirms, CF-02); settlement-window guard (proposed 7 days); wait before a duplicate-payment case; bank-change cooling period; low-balance alert | SDDs 02, 05 |

## 9. Fault model

Every cancellation, refund, failed delivery and chargeback records one cause:
`store`, `customer`, `delivery_provider`, `platform`, or `unclear`. The cause drives who
bears costs (D-09, D-27, D-31, D-41, D-69, D-70), store fault counts (D-21) and the loss
cap (D-08). A missed D-04 deadline counts as a store fault only when an "alert delivered"
fact exists and no platform or notification failure is found for that order (D-04; handoff
§11 item 5). Otherwise the cause is `platform`.

## 10. Design choices to confirm at this review

1. **Paid orders in a new `store_orders` table (recommended)**, created at verified
   payment, with the checkout row closed as `converted`. The other option is to keep
   extending `store_order_requests`. A separate table matches DOC-6, DOC-14 and DOC-15,
   keeps finance rows pointing at a stable order, and leaves Phase 6's terminal-state rules
   intact. The impact check estimates 1 to 2 extra days of screen changes.
2. **One Cashfree order per checkout, with retries inside it (recommended)**, against a
   new Cashfree order per attempt. Cashfree's shortest order expiry is over 15 minutes
   (CF-31), so our 10-minute reservation ends first and the server terminates the Cashfree
   order (CF-32).
3. **Length of the payment-result grace** before a still-pending payment is treated as
   unpaid and left to the late-payment rule. Proposed: 15 minutes, as a setting. A late
   UPI success is confirmed possible (CF-33); how late is asked (CF-A8).
4. **Reuse the empty foundation tables** as the admin queue and vendor-account records,
   and add dedicated tables for refunds, returns and payouts (recommended).
5. **Ledger scope:** it records what each party is owed, whoever physically holds the cash,
   because Cashfree holds the money in escrow under Easy Split (CF-08; Q3).

## 11. Dependencies

- **Cashfree:** three replies recorded with sources in the
  [fact record](../PHASE-7-8-cashfree-replies.md) (CF-01 to CF-51). Every Cashfree fact in
  these SDDs cites a CF ID from it. Of the fifteen points asked (CF-A1 to CF-A15), the
  third reply answered CF-A1, A2, A4, A11 and A13, most of A12, and half of A3 and A9. The
  rest are promised; the parts that depend on them are marked as open points.
- **Sandbox testing of Easy Split:** not started. SDD 05 is not approved until its
  Cashfree facts are tested.
- **Delivery provider check:** SDD 07 in full; the quote step in SDD 01.
- **Phase 9 lane:** the photo-request rework (handoff §9). SDD 01 builds pay-first beside
  the old Phase 6 step and retires it only after that rework lands.
- **CA and lawyer:** settings, wording and tax fields only.

## 12. Which SDD owns which decision

| SDD | Register IDs |
|---|---|
| 00 Master | D-02 (in-app notices only; the event list in §13) |
| Decisions D-78 to D-92 (2026-11-10, from this review) | 01: D-79, D-81, D-83, D-84, D-85. 02: D-78, D-90. 03: D-86, D-87, D-88. 04: D-80, D-82, D-91. 05: D-89, D-93. 06: D-92. All approved by the owner on 2026-11-10 (register) |
| 01 Checkout and acceptance | BC-05, BC-08, BC-09, Q33, Q36, Q38, D-06, D-15, D-07, D-11, Q15, D-36, D-49, D-50, D-56, D-65, P-6, Q49, BC-12, BC-13, BC-14, D-04, D-34, Q55, Q65, D-35, D-42, D-61, BC-06, BC-07, D-25, D-43, D-53 |
| 02 Payments | Q1, Q4, Q34, D-05, BC-11, BC-15, Q37, BC-10, D-29 |
| 03 Ledger | Q86, Q84, BC-37, E10, Q63, D-08, D-30, D-68, D-55 |
| 04 Refunds and recovery | Q57, Q59, Q60, Q61, Q62, Q45, Q45b, BC-34, BC-36, BC-40, D-09, D-10, D-12, D-14, Q67, Q68, D-21, D-22, D-26, D-27, D-37, D-38, D-39, D-40, D-45, D-48, D-54, D-69, D-70, D-71, D-72, BC-38, BC-39 |
| 05 Store money | Q2, Q3, P-3, Q50a, Q50b, Q51, D-28, BC-41, D-59, D-13, Q16, D-47, D-20, D-66, D-63, D-60, D-23, BC-02, Q6, Q7, Q13, Q20 |
| 06 Pickup | Q71, Q72, Q73, BC-33, D-44, D-57, D-62, D-67, D-73 |
| 07 Delivery | Q26, Q28, D-24, D-17, D-18, BC-16, BC-18, BC-19, BC-20, BC-22, BC-23, BC-24, BC-25, BC-26, BC-27, BC-28, BC-29, BC-30, BC-32, BC-35, D-31, D-41, D-32, D-74, D-76, D-77 |
| 08 Admin and customer support | Q101, Q105, D-19, D-51, D-52, D-64 |
| 09 Security and tests | Handoff §7 |

**Already built outside this lane; checkout only reads the result:** BC-03 and BC-04 (the
store sets prices and discounts in its inventory screens; checkout reads the current price,
BC-05), Q30 (new and used books; D-49 limits checkout to printed books).

**Phase 9 lane:** D-75 (photo request before payment).

**No system behaviour in this lane:** Q19, Q29, Q95, BC-01, BC-42, BC-43, BC-44, BC-45,
BC-17, BC-21, BC-31, D-16, P-7 (courier option, deferred), P-4, P-5, Q120, D-01, D-03,
D-33, D-46, D-58. Superseded: P-1, P-2.

**Decisions still IN PRINCIPLE in the register:** Q3, P-3, Q50b, Q51, Q45b, BC-38. Each
SDD that uses one says so, and the full SDD keeps the alternative open until the register
changes.

## 13. What the full SDD adds

Transition tables with actor, guards and side effects for each state; the event and
notification list (in-app only, D-02), including the store alert that D-02 requires to be
reliable before live payments; acceptance criteria; and the cross-SDD test index.

## 14. Rules every SDD carries

- **One winner in a race.** Every command that changes a checkout, order, refund, payout
  line or debt locks that row first and re-checks its guard. The first to commit wins; the
  other finds the state changed and does nothing. A timer acts only if the state is still
  the one it was set for. Each SDD lists its own races and tests both orders.
- **The store is worked out on the server.** No command trusts a `store_id` sent by the
  app (handoff §7).
- **No client writes money tables.** Only server functions do.
- **Every call to Cashfree that moves money carries a stable key** of our own, so an
  unknown result is looked up and never sent again as a new request (handoff §7). Refunds
  use our own refund ID; split, adjustment and terminate calls use Cashfree's idempotency
  header (CF-38).
- **Abuse limits (handoff §7):** a cap on open reservations and on payment attempts per
  customer, as settings, owned by SDD 01 and SDD 02. The per-customer order limit stays
  off (D-56).
- **Personal data:** the customer's phone and address go only to the store and the
  delivery provider that need them, and never into logs or error reports (handoff §7).
- **Rounding:** owned by SDD 03 §1.

## 15. Words used

- **Paise:** money is stored in paise (₹1 = 100 paise) so there are no fractions.
- **Idempotency key:** a unique label on a request, so sending it twice has the effect of
  sending it once.
- **Escrow:** an account where Cashfree keeps the customer's money until it is paid out.
- **Vendor:** Cashfree's word for a store that receives money through Easy Split.
- **Split:** telling Cashfree how much of a payment belongs to the store.
- **T+1:** one day after the payment day (T). Whether Cashfree counts working days is to be
  checked on sandbox.
- **`ONHOLD`:** Cashfree's status for a refund that is waiting because a balance is too low.
