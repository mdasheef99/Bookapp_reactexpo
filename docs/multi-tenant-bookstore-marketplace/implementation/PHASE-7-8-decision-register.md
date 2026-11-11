# Phase 7/8 Business Decision Register

**Version:** 4 (2026-11-08) — owner decisions D-01 to D-77 recorded; consistency and review passes applied
**Base:** owner's "Decision Register" of 05 November 2026 (v1, sources S1–S4 and chat)
**Status:** `DECIDED` rows are current owner direction. `PROPOSED` rows would need owner
approval (none at present). This register is not a source specification and grants no implementation,
migration, deployment, or live-payment authority.
**Related:** [handoff and session start](./PHASE-7-8-HANDOFF.md) (read first),
[question bank](./PHASE-7-8-question-bank.md) (research history),
[admin console proposal](./PHASE-7-8-admin-console-proposal.md),
[Cashfree/tax/compliance brief](./PHASE-7-research-cashfree-tax-compliance.md),
[Phase 7 tracker](./PHASE-7-payment-ledger-settlement.md)

This register is the single list of the owner's business decisions for Phase 7 (payments,
finance, settlement), Phase 8 (pickup), and the pilot subset of Phase 10 (Bengaluru
delivery). Where this register and the question bank disagree, this register wins. The
approved rules move into the root specifications (DOC-6, 7, 9, 12, 14, 15, 16 and others)
during the authorized documentation pass.

**Status labels**

- `DECIDED` — explicit current owner direction.
- `IN PRINCIPLE` — direction chosen; legal, provider, or detail conditions outstanding.
- `DEFERRED` — excluded from this pilot.
- `SUPERSEDED` — replaced by a later decision named in the row.
- `PROPOSED` — needs owner approval before it counts as decided.
- `UNVERIFIED` — a provider fact that must be confirmed in writing; never encode as a rule.
- `OPEN` — no decision yet.

**Precedence between decided rows:** a later D-row governs the case it addresses; an
earlier Q or BC row stays valid for every case the later row does not mention. Examples:
Q55 (full refund when the store cannot fulfil a paid order) applies to the whole order,
while D-26 and D-35 govern the one-of-several-books case; D-27 amends D-13 and Q16 for fees
on refunded payments only; D-39 narrows D-09's customer-fault deduction; D-38 and D-40 amend D-22; D-31 extends D-16's logic to the pilot bike provider; D-29
clarifies the scope of D-22, so Q57's "approval rules per D-22" means D-22 as clarified by
D-29. D-08's parenthesised list is illustrative: every row that says "counted toward
D-08" (D-09, D-14, D-16, D-27, D-31, Q68, BC-35) is included.

IDs: `Q`/`E` match the question bank; `BC-` are owner-register IDs; `P-` are proposals; `D-`
are owner decisions taken on 2026-11-07 to 2026-11-10; `OQ-` are owner questions from the 2026-11-08
review. `N` numbers come from the owner's open-item list of 2026-11-05, which is not in the
repository; every D-row is self-contained, and the N tag is only a cross-reference: N01 →
D-04, N02 → D-12, N03 → D-15, N05 → D-09, N06 → BC-35/D-09, N07 → D-10, N08/N09 → D-14,
N10 → D-08, N14 → D-07.

---

## 1. Marketplace, pilot, and commercial terms

| ID | Decision | Status |
|---|---|---|
| Q1 | Customers pay through BookConnect using Cashfree checkout, not at the store counter. | DECIDED |
| Q2 | The independent bookstore is the intended seller of record; legal/accounting confirmation needed. | IN PRINCIPLE |
| Q3 | BookConnect does not run an unlicensed pooled customer-funds arrangement; the Cashfree model must support that. | IN PRINCIPLE |
| Q4 | Cashfree is the payment provider. Account capabilities are verified separately. | DECIDED |
| Q6 | Future model: store commission plus store subscription. A customer platform fee is a separate possible charge, not approved for the pilot. | DECIDED |
| Q7 | First five pilot stores pay 0% commission during the three-month introductory period. | DECIDED |
| Q13 | First five pilot stores pay ₹0 subscription during the introductory period. Later rates not approved. | DECIDED |
| Q15 | Customer platform fee in the pilot is ₹0 (reconfirmed as D-11). Customers still pay delivery. | DECIDED |
| Q19 | Introductory pilot lasts three months. Calendar dates not set. | DECIDED |
| Q20 | Founding-store terms: 0% commission and ₹0 subscription for three months; no automatic conversion to unspecified fees. The Cashfree payment fee is separate and paid by the store (D-13). | DECIDED |
| Q26 | Launch fulfilment: store pickup and home delivery within Bengaluru. Delivery method for the pilot: same-day local bike delivery (D-24). | DECIDED |
| Q28 | Pilot city: Bengaluru. Delivery area per D-18. | DECIDED |
| Q29 | Start with five stores; consider ten after operations stabilize (not a commitment). | DECIDED |
| Q30 | New and used books. | DECIDED |
| Q33 | One store per cart and payment. | DECIDED |
| Q95 | BookConnect operates as a brand of the existing LLP. Marketplace tax/legal treatment needs review. | DECIDED |
| BC-01 | Sample post-pilot tiers (₹299/₹799/₹1,999; 5%/4%/3%) are illustrative only. | DEFERRED |
| BC-02 | No automatic billing after the waiver; later pricing needs notice and store acceptance (D-23). | DECIDED |

## 2. Catalogue, prices, and photos

| ID | Decision | Status |
|---|---|---|
| BC-03 | Each store sets its own book prices. | DECIDED |
| BC-04 | Stores may run discounts, festival promotions, and bulk price edits. | DECIDED |
| BC-05 | Checkout keeps a server-verified, unchangeable price and discount breakdown; the client never sets the payable amount. | DECIDED |
| BC-06 | A customer may request extra real photos of a used book before paying. | DECIDED |
| BC-07 | A photo request does not reserve the book. | DECIDED |

## 3. Checkout, reservation, and paid orders

| ID | Decision | Status |
|---|---|---|
| BC-08 | Store confirmation before payment is no longer required. Flow: stock check → reservation → Cashfree payment → server verification → store acknowledgment and preparation. Supersedes the Phase 6 business flow; implementation not yet changed. | DECIDED |
| BC-09 | Eligible stock (every in-stock listing, D-15) is checked and reserved before payment starts. | DECIDED |
| Q34 | Payment methods: UPI and cards only (D-05). | DECIDED |
| Q36 | Reservation lasts 10 minutes. A payment still processing at expiry is handled separately and safely. | DECIDED |
| Q37 | Customers may retry a failed payment while the reservation is valid, protected against double charges and double fulfilment. | DECIDED |
| Q38 | Payment succeeds after the reservation expired: book unavailable → automatic full refund; book still available → re-reserve and continue (D-06). | DECIDED |
| BC-10 | A payment still processing at expiry is not treated as failed; it follows a separate resolution path, with no unsafe stock release or second charge. | DECIDED |
| BC-11 | The backend verifies the Cashfree result; client state is never authoritative. | DECIDED |
| Q49 | After verified payment, the store receives the order, acknowledges it, prepares it, and marks it ready for pickup or "Ready to ship" for delivery (D-17). | DECIDED |
| BC-12 | Acknowledgment target: 45 minutes of the store's opening hours; reminder after 30 opening-hour minutes. | DECIDED |
| BC-13 | Missing the target triggers follow-up and escalation, not immediate cancellation. The final deadline is D-04. | DECIDED |
| BC-14 | Orders received at least two hours before closing are prepared the same business day; later orders the next business day. | DECIDED |
| Q55 | If the store cannot fulfil any of a paid order, the customer gets a full refund. | DECIDED |
| Q65 | One item unavailable: keep the rest, notify the customer, automatically refund that item's price. | DECIDED (amended by D-61: the store calls the customer first and records the outcome in the app) |
| BC-15 | Retries and delayed provider responses must never cause double charges or double fulfilment. | DECIDED |

## 4. Delivery

D-24 changed the pilot delivery method from a courier aggregator to same-day local bike
delivery. Rows below that apply only to a later courier option say so.

| ID | Decision | Status |
|---|---|---|
| BC-16 | Design anticipates four options: pickup, standard Bengaluru courier, same-day Bengaluru, intercity. The pilot launches pickup and same-day bike delivery (D-24); standard courier is added later if needed. | SUPERSEDED in part by D-24 |
| BC-17 | Intercity delivery is not in the first live release. (Same-day is now the pilot method, D-24.) | DEFERRED (intercity only) |
| BC-18 | One delivery-provider integration in the pilot (D-24). | DECIDED |
| BC-19 | Shiprocket was the leading courier-aggregator candidate. For the pilot, the provider is chosen after the D-24 API check (Shiprocket Quick, Porter, Borzo, or other). | SUPERSEDED by D-24 for the pilot |
| BC-20 | The rider or courier collects from the store's doorstep; stores never visit a branch or post office. | DECIDED |
| BC-21 | India Post only if offered through an aggregator with doorstep collection (courier option only). | DEFERRED with courier option |
| BC-22 | Customer pays the provider's verified delivery quote shown at checkout; no BookConnect markup in the pilot. | DECIDED |
| BC-23 | No separate customer charge for another delivery attempt. | DECIDED |
| BC-24 | Number of delivery attempts follows the actual provider service. | DECIDED |
| BC-25 | After the last failed attempt, the parcel returns to the store. Cost allocation per D-09. | DECIDED |
| BC-26 | BookConnect coordinates delivery problems, returns, and claims with customers and pursues the provider. | DECIDED |
| BC-27 | Store photographs the sealed, labelled parcel before handover. | DECIDED |
| BC-28 | BookConnect intends to contract with the delivery provider, subject to CA/legal review of charges, invoicing, GST, and liability. | IN PRINCIPLE |
| BC-29 | Stores pack orders. Entering weight and dimensions applies only to the later courier option (P-7). | DECIDED |
| BC-30 | Delivery booking trigger: resolved by D-17. | DECIDED |
| BC-31 | Quote-vs-bill differences: resolved by D-16 (courier option only). | DECIDED |
| BC-32 | No shipment insurance by default until provider liability and limits are understood. | DECIDED |

## 5. Pickup, cancellation, returns

| ID | Decision | Status |
|---|---|---|
| Q71 | Pickup window: three calendar days from the ready notification. | DECIDED |
| Q72 | Missed pickup: cancel and full refund. | DECIDED |
| Q59 | Missed-pickup refund includes any platform fee (₹0 in the pilot). | DECIDED |
| Q73 | Pickup is verified by an OTP/code; who may verify and who may collect are settled by D-44; OTP design is engineering detail for the pickup SDD within the security baseline. | DECIDED (D-44) |
| BC-33 | Pickup is complete on verified physical handover using the OTP. | DECIDED |
| Q45 | Customer cancels before delivery collection: full refund. | DECIDED |
| Q45b | Customer cancels after collection: customer may bear actual forward and return delivery costs, subject to law (consistent with D-09; deduction per D-39). | IN PRINCIPLE |
| BC-34 | Customers never bear delivery or return costs caused by the store or provider; cost follows responsibility. | DECIDED |
| Q61 | Used books are returnable for genuine misdescription, defects, wrong edition, missing pages, or similar; not for change of mind, subject to legal rights. New books follow the same rule (D-12). | DECIDED |
| Q60 | 48-hour reporting target for visible condition problems; not a cutoff for legal rights or later-discovered defects. | DECIDED |
| Q57 | BookConnect controls refund approval and administration; stores do not refund on their own. Approval rules per D-22, D-29, D-38, D-40, D-45 and D-61. | DECIDED |
| Q62 | When the store caused the problem, it bears return delivery and the customer gets a full refund. | DECIDED |
| BC-35 | Delivery loss/damage: BookConnect handles the customer remedy and pursues the provider; a store that handed over correctly is not penalized. BookConnect absorbs any unrecovered shortfall (N06, D-09), counted toward D-08. | DECIDED |
| BC-36 | Stores respond to return/dispute cases in the seller dashboard within 24 business hours (D-37). | DECIDED |
| E10 | Pickup or payout does not close valid refunds, returns, disputes, or chargebacks; fulfilment and finance lifecycles are separate. | DECIDED |

## 6. Store entitlement, settlement, refunds, accounting

| ID | Decision | Status |
|---|---|---|
| Q50a | Pickup orders: the store earns its proceeds on verified OTP handover to the customer. | DECIDED |
| Q50b | Delivery orders: the store earns its proceeds on correct, evidenced handover to the delivery partner (not necessarily the Cashfree transfer date). | IN PRINCIPLE |
| Q51 | Weekly Monday payouts intended, subject to Cashfree capability and contract. | IN PRINCIPLE |
| BC-37 | Earned entitlement and actual cash payout are separate events in the finance model. | DECIDED |
| Q16 | The store pays the Cashfree payment fee, disclosed (D-13). | DECIDED |
| Q67 | Refunds after payout: BookConnect advances, recovers from later payouts, store repays within 7 days otherwise (D-14). Contract wording needs the lawyer. | DECIDED |
| Q68 | Store-caused chargebacks are recovered like Q67 once responsibility is established. Fraud chargebacks where the store complied: BookConnect bears them, counted toward D-08. | DECIDED |
| BC-38 | Store-caused delivery failure: store bears merchandise and unrecoverable delivery costs, subject to enforceable terms (D-09). | IN PRINCIPLE |
| BC-39 | Provider-caused loss: BookConnect manages the remedy and seeks recovery; no presumed store fault; BookConnect absorbs the shortfall (BC-35). | DECIDED |
| Q86 | Ledger is auditable and balanced; history preserved; errors corrected by reversal entries, never edits. | DECIDED |
| Q84 | BookConnect reconciles its ledger with actual Cashfree payment, refund, and settlement facts. | DECIDED |
| Q63 | No pilot commission exists to reverse on refund (0% during the introductory period). | DECIDED |
| BC-40 | Refunds and disputes stay operable after the store has been paid; recovery tracked separately. | DECIDED |
| BC-41 | Three separate store permissions: receive orders, accept online payment, receive payouts. A store must have its opening hours set before it receives the accept-online-payment permission; stores have a "pause online orders" switch (D-07); store times use India time (IST). Store-hours part approved 2026-11-07 (handoff §3 item 6). Provider KYC rules to verify. | DECIDED |

## 7. Operations, launch safeguards, deferrals

| ID | Decision | Status |
|---|---|---|
| Q101 | BookConnect centrally coordinates refund and delivery disputes. Support hours D-19; staffing beyond the owner not decided. | DECIDED |
| Q105 | Stores cannot execute refunds or financial adjustments; only controlled BookConnect paths can. | DECIDED |
| BC-42 | The owner develops the app and recruits the first five stores. | DECIDED |
| Q120 | Phases 7 and 8 remain deferred until separate explicit authorization recorded in DOC-13. | DECIDED |
| BC-43 | No live customer payments before provider, legal, finance, operations, and end-to-end acceptance. Sandbox development is a separate stage. | DECIDED |
| BC-44 | No second payment provider is built for the pilot. | DEFERRED |
| BC-45 | Intercity delivery is not built for the first live release. (Same-day is the pilot method, D-24.) | DEFERRED (intercity only) |

---

## 8. Owner decisions of 2026-11-07 to 2026-11-10, and proposals

| ID | Decision or proposal | Status |
|---|---|---|
| P-1 | Final deadline for unacknowledged paid orders, "earlier of 8 opening hours or 24 elapsed hours". | SUPERSEDED by D-04 |
| P-2 | New-book returns follow the used-book rule. | SUPERSEDED by D-12 |
| P-3 | **Cashfree Easy Split.** BookConnect intends to use Easy Split for provider-managed store settlement. Weekly Monday payouts and fulfilment-based settlement eligibility are intended arrangements, subject to Cashfree's written confirmation of allocation timing, settlement controls, and contractual limits. The system must support valid refunds and recovery after actual payout. | IN PRINCIPLE (owner approved 2026-11-07; Cashfree written confirmation pending) |
| P-4 | **Customer-source attribution.** Optionally record observable order sources (store invitation link, marketplace search, campaign) as pilot analytics. Does not decide customer ownership or future commission. | OPEN (can wait until after the pilot) |
| P-5 | **Build sequence (engineering, not launch scope):** (1) reconcile Phase 6 for pay-first checkout and inventory states; (2) Phase 7 sandbox payments, refunds, ledger, reconciliation; (3) Phase 8 pickup; (4) Bengaluru delivery (D-24) and delivery finance; (5) integrated acceptance before live payments. Building pickup first does not mean a pickup-only launch. | DECIDED (owner approved 2026-11-07) |
| P-6 | **Pickup must not depend on the delivery quote.** If the delivery provider's quote is unavailable, the customer can still choose store pickup; checkout handles the two fulfilment choices separately. | DECIDED (owner approved 2026-11-07) |
| P-7 | **Parcel weight for a later courier option.** Owner idea: an average weight per book times the number of books. Refined option C: default weight by binding (paperback 350 g, hardcover 700 g, unknown 400 g) plus 100 g packaging, rounded up to the courier's weight step; stores mark heavy or oversized listings; real weight entered at packing is used for booking, differences under D-16. Alternative D (fixed fee table) would revise BC-22. | DEFERRED with the courier option; not needed for the pilot |
| D-01 | **Delivery target:** Option A. Payments (Phase 7) and pickup (Phase 8) fully working in Cashfree test mode within 4 weeks of authorization; Bengaluru delivery (the pilot subset of Phase 10, D-24) follows in the next 1.5–2 weeks. Conditions: authorization given promptly, Cashfree test account and Easy Split ready in week 1, owner decisions answered within about a day, and a moderate Phase 6 pay-first rework. Live payments remain gated by BC-43. Progress is tracked daily with dated entries in the Phase 7/8 tracker. | DECIDED |
| D-02 | **Notifications later:** push notifications (Phase 11) are not built during the Phase 7/8 test-mode work; in-app notices only. Before live payments, stores must be reliably alerted to paid orders and reminders, because the 45-minute acknowledgment target (BC-12) depends on it. | DECIDED |
| D-03 | **Workspace:** implementation starts in a separate folder with a fresh pull of `origin/main`, only after the whole plan and the implementation timeline are finalized. | DECIDED |
| D-04 | **Final deadline for an unacknowledged paid order (N01):** 24 real (elapsed) hours from verified payment, regardless of store opening hours, closed days, or holidays. If the store has not acknowledged by then, BookConnect cancels the order and starts a full refund automatically. The 30-minute reminder and 45-minute escalation (BC-12/13) still count in store opening hours. The failure is recorded; store fault is attributed only after ruling out platform notification or system failures. | DECIDED |
| D-05 | **Payment methods at launch (Q34):** UPI and cards only. No cash on delivery. Netbanking, wallets, and EMI may be enabled later. | DECIDED |
| D-06 | **Late payment, book still available (rest of Q38):** if a payment succeeds after the 10-minute reservation expired and the book is still available, re-reserve it and continue as a normal paid order. | DECIDED |
| D-07 | **Closed or paused stores (N14):** customers may order while a store is closed; the store acts when it opens (BC-14; the D-04 deadline still applies). A store that has paused online orders receives no new orders. | DECIDED |
| D-08 | **Monthly loss cap (N10):** ₹10,000 per month of losses BookConnect absorbs (delivery shortfalls, fraud chargebacks, unrecovered store debts, delivery-charge differences). Reaching it pauses new payments for owner review; refunds continue. Stored as a setting. | DECIDED |
| D-09 | **Failed-delivery and return-to-store costs by cause (N05):** customer fault (refused, wrong address, unreachable) → actual forward and return delivery costs deducted from the customer's refund; store fault → store pays; provider fault → BookConnect claims from the provider and absorbs any shortfall (N06); cause unclear → BookConnect pays. Absorbed amounts count toward D-08. Cause recording and deduction wording need the delivery SDD and lawyer review of customer terms. | DECIDED |
| D-10 | **Return refund timing (N07):** for an approved return, the customer is refunded only after the store inspects the returned book, whatever the amount. Inspection target: within 48 hours of the parcel arriving at the store; overdue inspections go to the admin exception queue. Refund goes to the original payment method. | DECIDED |
| D-11 | **Customer platform fee in the pilot (Q15):** ₹0. Customers pay book price plus the delivery quote (BC-22) only. | DECIDED |
| D-12 | **New-book returns (N02):** same rule as used books (Q61) — genuine defect, damage, wrong edition, missing pages, or misdescription; no change-of-mind returns; subject to legal rights. Legal wording review still required. | DECIDED |
| D-13 | **Payment gateway fee bearer (Q16):** the store pays Cashfree's payment fee, deducted from its share and disclosed in the store agreement and on every settlement line. Exact method (fee reported by Cashfree per payment vs per-method rate) is an engineering decision for the settlement SDD; fee rates are unverified until Cashfree confirms. | DECIDED |
| D-14 | **Refund after store payout (Q67, Q83, N08, N09):** BookConnect refunds the customer at once from its own balance, records a store debt, and recovers it from the store's next payout; if not recovered within 7 days, the store repays. Unrecovered debts count toward D-08. Repayment term requires the store agreement (lawyer). | DECIDED |
| D-15 | **Pay-now stock (N03):** every listing marked in stock is payable immediately. Stores must mark counter sales sold promptly. A paid book the store no longer has is refunded in full (Q55), or by D-04 if the store never acknowledges, and recorded as store fault. Week-1 check: whether store screens offer a quick "mark sold". | DECIDED |
| D-16 | **Courier charge above quote (courier option only):** the customer is never charged more after paying. BookConnect absorbs up to ₹50 per order; above ₹50, the store pays when its weight entry or packaging caused the difference, otherwise BookConnect. Absorbed amounts count toward D-08. ₹50 stored as a setting. Not used in the pilot (D-24) unless a courier is added. | DECIDED |
| D-17 | **Delivery booking trigger:** delivery is booked when the store marks the order packed ("Ready to ship"), not at acknowledgement. With a courier option, the store also enters the final weight then. | DECIDED |
| D-18 | **Pilot delivery area:** delivery only to Bengaluru urban (BBMP-area) pincodes the delivery provider serves; elsewhere only pickup is offered. The pincode list is a setting that can be widened. | DECIDED |
| D-19 | **Pilot support hours:** 10am–7pm, Monday–Saturday, published. Tickets outside hours receive an automatic acknowledgement (E-Commerce Rules 48-hour acknowledgement). Automatic refunds and the D-04 cancel run around the clock. | DECIDED |
| D-20 | **Starter store limits:** each new store starts at up to 20 paid orders per day and ₹25,000 unsettled at any time; reaching either pauses new orders for that store until admin review. Per-store settings raised as trust builds. | DECIDED |
| D-21 | **Store suspension:** 3 store faults (missed D-04 deadline, sold-out paid book, wrong item) within 30 days pause new paid orders until admin review; existing orders and refunds continue. Suspected fraud, or a store debt unpaid past the D-14 7 days, pauses at once. | DECIDED |
| D-22 | **Refund approval:** automatic refunds for D-04 cancels, store rejection or unavailability, failed or late payments (Q38), missed pickups (Q72), and parcels lost by the delivery provider. Failed deliveries returned to the store are also automatic (D-40). Returns and disputes need admin approval at any amount, with the refund for an approved return released after inspection (D-38). Scope of the ₹1,000 rule as clarified by D-29: automatic categories run at any amount (admin alerted afterwards above ₹1,000); returns, disputes, and goodwill refunds above ₹1,000 need approval with a typed reason. ₹1,000 stored as a setting. | DECIDED (scope clarified by D-29; amended by D-38, D-40) |
| D-23 | **Post-introductory pricing:** 30 days' written notice before any commission or subscription starts or changes; the store must accept in-app to keep taking paid orders. Rates to be decided before the waiver ends. | DECIDED |
| D-24 | **Pilot delivery method:** same-day local bike delivery only, priced from the provider's actual distance quote with no markup (BC-22), with free store pickup always offered beside it. Booking at "Ready to ship" (D-17); failed trips follow D-09 by cause. No weight estimation in the pilot. Track how many customers abandon at the delivery price; if high, add a standard courier option using P-7 and D-16. **Condition:** a provider (Shiprocket Quick, Porter, Borzo, or other) must offer automated quote, booking, status updates, and cancellation for our system; confirm in weeks 1–2. If none does, fall back to a courier aggregator with P-7. This changes the Phase 10 pilot subset from a courier-aggregator adapter to a local-delivery adapter; the Phase 10 docs must be updated in the documentation pass. | DECIDED (conditional on provider API check) |
| D-25 | **Photo requests do not block payment (owner decision, 2026-11-07):** a customer who has requested extra photos (BC-06) may pay without waiting for them. The request does not reserve the book (BC-07), so the book can sell to someone else meanwhile. If the customer pays while a request is open, the order proceeds normally; the store may still answer the request, and the usual rules apply: free cancellation before collection (Q45) and returns for misdescription (Q61, D-12). Replaces DOC-14's "no proceed-without-photo outcome" in the documentation pass. | DECIDED (amended by D-43) |
| D-26 | **Delivery charge in refunds (owner decision, 2026-11-08; OQ-1):** when a paid order is refunded for a reason that is not the customer's fault and nothing was delivered, the refund includes the delivery charge. When only one of several books is removed (Q65) and the rest are still delivered, only that book's price is refunded; the delivery charge stands. | DECIDED |
| D-27 | **Cashfree fee on refunded payments (owner decision, 2026-11-08; OQ-2):** by cause. The store bears the non-returned fee when the store caused the refund (unavailable book, wrong item, missed D-04 deadline); otherwise BookConnect bears it, counted toward D-08. Amends DOC-15's platform-borne `gateway_fee_non_refundable_loss`. | DECIDED |
| D-28 | **Payout timing (owner decision, 2026-11-08; OQ-3):** a store's earned money (Q50a/Q50b) waits 3 days after handover, then joins the next Monday payout (Q51). Changes cash timing only, not entitlement. Subject to Cashfree hold capabilities (register §9). | DECIDED |
| D-29 | **Automatic refunds and the ₹1,000 rule (owner decision, 2026-11-08; OQ-4):** automatic refund categories (D-22) run at any amount; the admin is alerted afterwards for those above ₹1,000. Duplicate successful payments are refunded automatically (the first verified payment counts). A payment whose amount differs from the order total is not treated as paid: it is refunded in full automatically, the reservation follows Q36/BC-10, and the admin is alerted. The ₹1,000 manual-approval rule applies per refund to returns, disputes, and goodwill refunds only (returns and disputes: amended by D-38, which requires approval at any amount). | DECIDED |
| D-30 | **Loss-cap accounting (owner decision, 2026-11-08; OQ-5):** the D-08 month is the India-time calendar month. A loss counts when final (store debt still unpaid 7 days after the D-14 repayment request, provider claim rejected, chargeback lost), net of recoveries. | DECIDED |
| D-31 | **Bike cancellation fee and bills above the quote (owner decision, 2026-11-08; OQ-6):** the customer never pays more after paying, and a cancellation before collection stays a full refund (Q45). BookConnect absorbs a provider cancellation fee or a bill above the quote up to ₹50 per order; above ₹50, by cause (store if its fault, otherwise BookConnect). Counted toward D-08. Applies D-16's logic to the pilot bike provider. Customer-fault deductions follow D-09 and D-39; D-31 applies only to the part of a forward bill above the quote. Split of the first ₹50: D-41. | DECIDED |
| D-32 | **Return travel (owner decision, 2026-11-08; OQ-7):** for delivered orders, BookConnect books a reverse bike pickup from the customer through the delivery provider, cost by cause (Q62, BC-34, D-09); the D-10 inspection clock starts when the book reaches the store. For pickup orders, the customer brings the book back to the store. | DECIDED |
| D-33 | **Authority on recording the approvals (owner decision, 2026-11-08; OQ-8):** recording the handoff §3 approvals in DOC-13 and ACTIVE.md authorizes the documentation pass, read-only stage 0 work, product code for each slice once its SDD and test list are approved, and a standing authorization to create and apply test-mode migrations on the dev Supabase project for approved slices (project verified before each migration and recorded in the migration ledger). Anything touching production or live money stays gated by BC-43. | DECIDED |
| D-34 | **Same-day promise (owner decision, 2026-11-08; OQ-9):** orders placed at least 2 hours before the store closes show "expected today"; later orders show "expected tomorrow" (BC-14). Shown as an estimate, with no compensation if late. | DECIDED |
| D-35 | **No substitutes in the pilot (owner decision, 2026-11-08; OQ-10):** an unavailable paid book is refunded automatically (Q65); stores do not offer substitutes. | DECIDED (clarified by D-42) |
| D-36 | **No delivery minimums in the pilot (owner decision, 2026-11-08; OQ-11):** no minimum order value and no free-delivery threshold. The customer sees the real quote and can always choose pickup. Revisit with the D-24 abandonment data. | DECIDED |
| D-37 | **Store response to returns and disputes (owner decision, 2026-11-08; OQ-12; resolves BC-36):** 24 of the store's business hours; overdue cases go to the admin exception queue. | DECIDED |
| D-38 | **Return and dispute approval (owner decision, 2026-11-08; final-read F-01):** every return request and every dispute needs admin approval, at any amount. For a return, the admin approves the request before the reverse pickup is booked (D-32; for pickup orders, before the customer brings the book back); the refund is then released automatically once the store's D-10 inspection passes, and a failed inspection becomes an admin dispute. Above ₹1,000 the approval needs a typed reason (D-29). Goodwill refunds are always admin-initiated. Replaces D-22's sentence on returns and disputes. | DECIDED |
| D-39 | **Customer-fault deduction (owner decision, 2026-11-08; final-read F-02):** when a delivery fails or is cancelled after collection through the customer's fault (D-09, Q45b), the refund is the amount paid minus the quoted forward delivery charge and minus the actual return-trip cost, never below zero. Any forward bill above the quote is not charged to the customer; it follows D-31 and D-41. Narrows D-09's "actual forward" cost to the quoted charge. | DECIDED |
| D-40 | **Refund for a failed delivery returned to the store (owner decision, 2026-11-08; final-read F-03):** automatic once the store confirms the parcel is back, with costs allocated by cause (D-09, D-39). A parcel the store reports as opened or damaged goes to the admin exception queue instead. Added to D-22's automatic list. | DECIDED |
| D-41 | **How the ₹50 absorption splits (owner decision, 2026-11-08; final-read F-14):** BookConnect always absorbs the first ₹50 of a cancellation fee or bill above the quote per order; only the part above ₹50 goes by cause. Example: ₹80 over the quote caused by the store → BookConnect ₹50, store ₹30; not the store's fault → BookConnect ₹80. Applies to D-16 and D-31. | DECIDED |
| D-42 | **Alternative book or edition (owner decision, 2026-11-09):** an unavailable paid book is refunded automatically as usual (Q65, D-35). If the customer wants an alternative the store has (another copy, edition, or book), she places a new order through BookConnect. Stores and customers do not settle price differences or payments outside BookConnect. Clarifies D-35. | DECIDED |
| D-43 | **Photo check before handover (owner decision, 2026-11-09; amends D-25):** when a customer pays while her photo request is still open, the store accepts the order as usual (D-04) and must send the photos within the same 24 hours; if it cannot, the order is refunded automatically as unavailable. The order then waits in "waiting for the customer to check photos": the store may not hand it over and delivery is not booked. The customer has 24 hours to respond. Approved or no response: the order continues (pickup notice and the Q71 three days start then, or delivery is booked per D-17). Rejected: full refund including the delivery charge (D-26). Fault: photos that do not match the listing are a store fault (D-21); a rejection when the book matches the listing counts against nobody (as Q45). The photo request itself still never reserves the book (BC-07); only payment does. The same-day estimate (D-34) shows the extra wait. Both 24-hour limits are settings. | DECIDED (no-response rule amended by D-53) |
| D-44 | **Pickup rules (owner decision, 2026-11-09; settles Q73):** authorized bookstore staff may verify the pickup OTP and hand over the book; anyone presenting the customer's valid OTP may collect. Before marking an order ready, the store checks the book is present and matches the edition and condition listed. The customer may refuse a damaged, wrong, or missing book at pickup: she gets a full refund, and when the book does not match the listing it is a store fault (D-21; the store bears the D-27 fee). Resending the pickup notice is allowed; it does not reset the Q71 three days and creates no second order or delivery. For pickup orders, the Q60 condition-reporting window starts at the verified OTP handover, not when the store marks the order ready. | DECIDED |
| D-45 | **Store-requested refunds (owner decision, 2026-11-09):** a store may raise a refund request for an order through BookConnect (for example a problem it found after accepting). The refund itself is executed only through BookConnect's controlled refund process (D-22, D-29), recorded in the ledger and audit trail; stores never refund customers directly. Approval: automatic up to ₹1,000, admin approval with a typed reason above (as D-29); the store bears the cost (Cashfree fee and any delivery charge). | DECIDED |
| D-46 | **Planning order and schedule rules (owner decision, 2026-11-09):** (1) D-03 reading: the SDD set (handoff §11) is written and reviewed before the fresh folder is created, in the docs worktree on branch `docs/phase7-8-planning`, outside the Phase 9 working folder; the fresh folder starts from approved SDDs. Writing SDDs is documentation only: no DOC-13, ACTIVE.md, or AGENTS.md status changes, no product code, no database or provider writes. (2) The lane's working week is Monday to Saturday (4 weeks = 24 working days). (3) If the week-4 milestone is at risk, the owner and Claude decide at that time what to cut or move; there is no pre-agreed cut list. | DECIDED |
| D-47 | **Other Cashfree fees (owner decision, 2026-11-10; Q17, Q18):** the store also pays the Easy Split fee, vendor payout fees, and the bank-account verification fee, deducted from its share and shown on its settlement lines, as for the payment fee (D-13). Rates are unverified until Cashfree confirms. | DECIDED |
| D-48 | **Refund speed (owner decision, 2026-11-10; Q66):** all refunds use Cashfree's standard speed; customers are told 2–3 working days. No instant refunds in the pilot. | DECIDED |
| D-49 | **Pilot catalogue (owner decision, 2026-11-10; Q27, refines Q30):** only new and used printed books (HSN 4901) may be listed; no stationery or other items. Keeps the pilot to GST-exempt supplies, so stores without GST registration can sell (CA questions 1 and 4 confirm). | DECIDED |
| D-50 | **Customer contact and receipts (owner decision, 2026-11-10; Q40, Q41, Q43, Q44):** phone number required (Cashfree requires it); email optional. The receipt is always shown in the app and is also emailed when the customer gave an email; no SMS. Who issues the receipt follows CA question 7. | DECIDED |
| D-51 | **Customer support channels (owner decision, 2026-11-10; Q102, Q103):** an in-app complaint form that creates a ticket number, plus a support email; no WhatsApp or phone in the pilot. First-reply target: one business day within D-19 hours; the E-Commerce Rules limits (48-hour acknowledgement, resolution within one month) remain the outer limits. | DECIDED |
| D-52 | **Grievance officer (owner decision, 2026-11-10; Q97):** the owner is the named grievance officer, subject to the lawyer's confirmation (lawyer question 6). | DECIDED |
| D-53 | **Photo check with no response (owner decision, 2026-11-10; amends D-43):** if the customer does not approve the photos within 24 hours, the order is cancelled and fully refunded, including the delivery charge (D-26); it counts against nobody. Silence is no longer treated as approval. A rejection is handled as in D-43. | DECIDED |
| D-54 | **Refund balance at Cashfree (owner decision, 2026-11-10; E2):** BookConnect agrees in principle to keep a refund balance in its Cashfree account so that D-14 refunds are not held. The amount is set after Cashfree answers question 8 and pilot volumes are known. Sandbox evidence (2026-11-09): Cashfree put two refunds `ONHOLD` with "Refund on hold because of insufficient account balance"; the refund flow treats `ONHOLD` as a normal state. | IN PRINCIPLE |
| D-55 | **Emergency pause (owner decision, 2026-11-10; Phase 6 impact check open item):** a pause of payments, including the D-08 loss-cap pause, blocks only new reservations and payments. Orders already paid continue: stores accept and fulfil, the D-04 24-hour automatic refund still runs, and refunds still go out. | DECIDED |
| D-56 | **Order limits (owner decision, 2026-11-10; Q31, Q32):** maximum order value ₹5,000 per order in the pilot, stored as a setting. No per-customer order limit (a setting exists but is off). Store limits remain per D-20. | DECIDED |
| D-57 | **Pickup reminder (owner decision, 2026-11-10; E14):** one reminder 24 hours before the Q71 three-day pickup deadline, in the app and by email when given. | DECIDED |
| D-58 | **Packaging (owner decision, 2026-11-10; QB §0.2 #17):** stores pay for ordinary packing materials as part of their own cost; nothing is deducted or reimbursed. | DECIDED |
| D-59 | **Store without Cashfree verification (owner decision, 2026-11-10; Q48):** a store that never completes vendor verification never receives the "accept online payment" permission (BC-41), so its books cannot be bought in the app. | DECIDED |
| D-60 | **Store statements (owner decision, 2026-11-10; Q53):** the store console offers a CSV download of the store's settlement lines (sales, fees, refunds, payouts) for any date range. | DECIDED |
| D-61 | **Readiness and missing books (owner decision, 2026-11-10; E13, refines Q65):** an order is ready only when all of its available books are ready; no part-ready orders and no split pickups or deliveries. When some books are missing, the store phones the customer, then selects the missing books in the app and records the outcome: "customer keeps the rest" (the missing books are refunded automatically) or "customer cancelled all" (full refund). If the customer cannot be reached within the D-04 24-hour window, the store records "keeps the rest" and the customer is told in the app. The refund is issued by BookConnect's system (D-45), counts as a store fault (D-21), and the store bears the fee (D-27). | DECIDED |
| D-62 | **Store pickup instructions (owner decision, 2026-11-10; E12):** each store may add one short text instruction, shown with the ready-for-pickup notice beside its address and hours. | DECIDED |
| D-63 | **Payout pause (owner decision, 2026-11-10; E5):** a store's payouts pause during a fraud review, or while it owes BookConnect money past the D-14 7-day repayment; only the owner (admin) releases them. Depends on Cashfree question 5a for a per-store hold. | DECIDED |
| D-64 | **Store-risk alerts (owner decision, 2026-11-10; E6):** dispute-rate, cancellation-rate and failed-payout alerts appear in the admin console only; thresholds are settings; nothing pauses automatically beyond D-21. | DECIDED |
| D-65 | **Order cap base (owner decision, 2026-11-10; refines D-56):** the ₹5,000 maximum applies to the book total; the delivery charge is added on top. | DECIDED |
| D-66 | **Held money and the store cap (owner decision, 2026-11-10; handoff §11 #23):** money paid but not yet paid out to the store, including money held under D-28, counts toward the D-20 ₹25,000 unsettled cap. | DECIDED |
| D-67 | **Pickup cancellation (owner decision, 2026-11-10; Q45):** a pickup customer may cancel for a full refund until the store marks the order ready. After that, an uncollected order is refunded in full at the Q71 deadline (Q72). | DECIDED |
| D-68 | **Restart after a pause (owner decision, 2026-11-10; QB §0.2 #35, D-55):** only the owner (admin) restarts payments, after reconciliation shows no stuck or mismatched payments; the restart and its reason are logged. | DECIDED |
| D-69 | **Platform-error and unclear-fault chargebacks (owner decision, 2026-11-10; extends Q68):** BookConnect bears them, counted toward the D-08 monthly loss cap. | DECIDED |
| D-70 | **Store-fault return of a delivered book (owner decision, 2026-11-10; extends D-26):** the customer is refunded the book price and the forward delivery charge; the store bears that charge and the reverse pickup (BC-34, D-09). | DECIDED |
| D-71 | **Failed return pickup (owner decision, 2026-11-10; extends D-32):** if the customer is not available for the reverse pickup, one free rebooking is made. If that also fails, the customer must bring the book to the store. The cost of a failed trip the customer caused is deducted from the refund (D-09). | DECIDED |
| D-72 | **Return never handed over (owner decision, 2026-11-10; extends D-10):** the customer has 5 days from approval to hand the book over (reverse pickup or drop-off), with a reminder on day 4. After that the return closes without a refund and the customer is told in the app. Both numbers are settings. | DECIDED |
| D-73 | **Pickup window and closed days (owner decision, 2026-11-10; refines Q71):** the three-day pickup window counts only days on which the store is open, per its set hours and closures. The customer sees the actual last pickup date. | DECIDED |
| D-74 | **Proof of delivery (owner decision, 2026-11-10; Q50b):** use a customer delivery OTP if the provider supports it; otherwise the provider's "delivered" event with time, location and rider photo. A provider offering neither is not chosen (handoff §6.4). | DECIDED |
| D-75 | **Photo request before payment (owner decision, 2026-11-10; extends D-43):** target reply within 24 of the store's business hours; after that the request expires with an in-app note. The customer may still buy at any time. No penalty for the store. | DECIDED |
| D-76 | **Drop-out at the delivery price (owner decision, 2026-11-10; D-24, D-36):** track the share of checkouts that see the delivery price and then leave without paying or switching to pickup. The owner reviews it at the end of pilot month 1; no fixed trigger. | DECIDED |
| D-77 | **No rider available (owner decision, 2026-11-10; D-24, D-17):** if no rider accepts a delivery booking, it is rebooked for the next day and the customer is told in the app. The customer may cancel for a full refund including the delivery charge. Not counted against the store; any extra cost is BookConnect's (D-08). | DECIDED |
| D-78 | **Duplicate payments (owner decision, 2026-11-10; amends D-29 after Cashfree's reply):** Cashfree reverses a second successful payment on an order itself (CF-30). BookConnect does not send its own refund for it, so the customer is never paid twice. The order is fulfilled once only, and every attempt is reconciled daily. If Cashfree's records show no reversal after a set wait (a setting; proposed start 3 business days, to be fixed when Cashfree answers CF-A5), the admin checks Cashfree's record for that payment and refunds it within 1 business day. The customer does not wait on a written reply from Cashfree. The rest of D-29 stands. | DECIDED (owner approved 2026-11-10) |
| D-79 | **Accepted but not prepared (owner decision, 2026-11-10; skeleton review):** if an accepted order is not marked ready (pickup) or packed (delivery) by the end of the day it was promised for under BC-14 and D-34 (the same business day when ordered at least 2 hours before closing, otherwise the next), the store and the admin are alerted. If it is still not ready by the end of the following business day, it is cancelled and refunded in full automatically as a store fault. Both times are settings. | DECIDED (owner approved 2026-11-10) |
| D-80 | **Refund due while a chargeback is open on the same payment (owner decision, 2026-11-10):** the refund is neither blocked nor sent blindly. It goes to the admin queue with a one-business-day deadline and the customer is told it is being checked. The admin either sends it and uses it as evidence against the chargeback, or accepts the chargeback and closes the refund. | DECIDED |
| D-81 | **Which store-side or admin events cancel a live reservation (owner decision, 2026-11-10; refines D-21 and handoff §11 item 4):** this rule is only about a store becoming ineligible; ordinary expiry, a failed payment and the customer's own cancel are separate rules and are unchanged. Three events only: the admin suspends the store for suspected fraud; the store loses the "accept online payment" permission; the admin closes or removes the store. Store limits, the 3-fault pause, the loss-cap pause, the global pause and the store's own pause switch stop new reservations only; a customer already reserving may finish paying. | DECIDED |
| D-82 | **Customer cancels after the rider collected (owner decision, 2026-11-10; Q45b):** until the lawyer answers Q45b, this refund is not automatic. It goes to the admin with a one-business-day deadline. "After collection" means once the order is out for delivery. | DECIDED |
| D-83 | **Missing book found after acceptance (owner decision, 2026-11-10; refines D-61):** a store may report missing books at any time before the order is ready. If the customer cannot be reached, the store records "keeps the rest" within 24 hours of making the report. If the store records nothing by then, the system records "keeps the rest" itself and sends the partial refund for the missing books, so the order cannot hang. | DECIDED (owner approved 2026-11-10) |
| D-84 | **Late payment on a checkout with several books (owner decision, 2026-11-10; refines D-06, Q38):** all or nothing. If every book is still free, all are reserved again and the order goes ahead. If any one is not, the whole payment is refunded automatically. This applies only to a payment verified after its reservation expired. A normally paid order where the store later finds a book missing still keeps the rest with a partial refund (D-61, Q65). | DECIDED |
| D-85 | **Payment that succeeds after the checkout was cancelled (owner decision, 2026-11-10):** if the customer cancelled the checkout, or a D-81 event cancelled it, a payment that succeeds afterwards is refunded in full automatically and no order is created. D-06 applies only to an expired reservation. | DECIDED |
| D-86 | **Cashfree fee on a partial refund (owner decision, 2026-11-10; refines D-27; handoff §11 item 20):** this covers only Cashfree's payment-processing fee. Commission is 0% in the pilot, there is no platform fee, and the delivery charge follows its own refund rules. Whoever bears the fee under D-27 bears only the part of it that belongs to the refunded amount. The rest belongs to the sale that still happened and stays with the store (D-13). | DECIDED |
| D-87 | **Month of a late recovery (owner decision, 2026-11-10; refines D-30):** money recovered after a loss was made final reduces the loss total of the month in which it arrives. Earlier months are not reopened. This is a rule for the ₹10,000 monthly loss-cap total only (D-08, D-30). It is not an accounting or tax rule; how the books recognise the debt and its repayment is the CA's question. | DECIDED |
| D-88 | **Rounding (2026-11-10):** a store's sale proceeds are never rounded: prices are whole paise and commission is 0%. BookConnect never computes a Cashfree fee; it records what Cashfree reports. The rule applies only where one amount of cost is divided between the store and BookConnect, such as the fee on a partial refund (D-86): the store's part of that cost is rounded down to a whole paisa and BookConnect bears the remainder, so the odd paisa is never charged to the store and the parts always add up exactly. When a commission or tax is introduced, this rule is decided again. | DECIDED (owner approved 2026-11-10) |
| D-89 | **Settlement-window guard (2026-11-10):** an admin case is raised 7 days before a store's held share would reach the end of Cashfree's settlement window (CF-04). The number of days is a setting. It is an alert only: it is not a deadline by which an order must be paid out, completed or refunded. What the admin does with the case is set in SDD 05 §6. | DECIDED (owner approved 2026-11-10) |
| D-90 | **Checkout method for the pilot (2026-11-10; CF-34):** Cashfree's web checkout, not the React Native SDK, tried on a real phone first. | DECIDED (owner approved 2026-11-10) |
| D-91 | **Three more automatic refunds (2026-11-10; extends D-22):** a customer cancel before ready or before collection (Q45, D-67), a refusal at pickup (D-44), and a customer cancel when no rider is available (D-77) are refunded automatically, like the D-22 categories. Amount, who bears it, the one-refund-per-event rule and the chargeback check (D-80) are in SDD 04 §2, categories 7, 10 and 11. | DECIDED (owner approved 2026-11-10) |
| D-92 | **Who verifies the pickup code in the pilot (2026-11-10; refines D-44):** only the store owner's login. Staff accounts are deferred. | DECIDED (owner approved 2026-11-10) |
| D-93 | **Payout while a return or dispute is open (2026-11-10):** if a return or dispute is open on an order whose share has not yet been released, only that order's share waits; the store's other money is paid as usual. The wait is made at Cashfree by moving that order's date later (CF-44), never by a ledger entry alone. It ends when the case is decided, and no later than the settlement-window guard (D-89). A share already paid out is not held; D-14 recovery applies. | DECIDED (owner approved 2026-11-10) |
| D-94 | **Missing-book report on an order not yet accepted (owner decision, 2026-11-11; refines D-04):** if a store reports missing books on an order it has not yet accepted, the report counts as the store's acknowledgement. "Keeps the rest" accepts the order and stops the 24-hour auto-cancel; the customer is refunded for the missing books only. "Cancelled all" cancels the order with a full refund. If the 24-hour timer has already cancelled the order, the report is refused. | DECIDED (owner approved 2026-11-11) |

Status words in this table: DECIDED means the owner approved the rule. PROPOSED means it is
Claude's wording or number and is not yet policy. The owner approved D-88 to D-93 and the
numbers in D-78, D-79 and D-83 on 2026-11-10 ("Approve all"). Neither word says anything
about Git; none of this file's 2026-11-10 changes are committed.

Clarifications for the specifications (no owner decision needed):

- Q65 and Q57 do not conflict: partial refunds for missing books run automatically once the
  store records the outcome under D-61 (D-22 rules); no staff approval is needed for each case.
- BC-12 and BC-14 require reliable store operating hours, closures, holidays, and timezone.
  Hours exist (`operating_hours`, `special_hours`, Store Profile screen); holiday handling
  and data quality are unverified (week-1 check). D-04 uses elapsed hours, so it does not
  depend on store hours.
- BC-06/07, D-25, D-43 photo requests: the Phase 9 request-photo migration
  (`20260722000008_marketplace_phase9_request_photo_seam.sql`, live, unused, zero rows on
  2026-11-08) was built for the old rule (photos before payment, soft hold, tied to the Phase 6
  request) and must be reworked by the Phase 9 lane before Phase 7/8 retires the old step.
  Findings and fix plan: handoff §9 "Photo-request rework".
- BC-22 makes the provider's live quote a checkout dependency: P-6 defines behaviour when
  it is unavailable.

## 9. Provider facts — unverified, never encode as rules

**Update 2026-11-10:** Cashfree has since answered many of the points below. The current
record, with sources, is [PHASE-7-8-cashfree-replies.md](./PHASE-7-8-cashfree-replies.md)
(CF-01 to CF-41; open questions CF-A1 to CF-A15), and it replaces the Cashfree rows of
this table where they differ. In particular, at the end of the settlement window the held
money goes to BookConnect, not to the store (CF-04), and the first reply said there is no Monday schedule
(CF-05). The third reply says a weekly settlement schedule, paying on the first working
day of the week, is available (CF-47); Cashfree is asked to confirm which holds. The refund-window row stands: the exact limit is still to be confirmed.

| Topic | What public documents say | Treatment |
|---|---|---|
| Easy Split settlement hold | A settlement-eligibility date up to 45 days from the transaction appears in Cashfree docs, with inconsistent default delays and API paths across pages. | UNVERIFIED. Confirm in writing for BookConnect's account. If a hold limit exists, it means a store could be paid before it has earned the money, raising recovery risk; it does **not** mean customer orders or refund rights end at that limit. |
| Refund window | Cashfree API page: six months; merchant terms (updated 10 March 2026) §15: 180 days; grievance policy: 120 days unless the acquiring bank allows an exception. | UNVERIFIED, conflicting. Customer refund rights are independent of provider limits. BookConnect must handle valid refunds after the provider window through a legally compliant, provider-approved alternative, with audit records and double-refund protection. |
| Chargebacks, negative balances, refund funding after split, payment methods, Monday payouts, fees | Partly described in Easy Split and PG docs. | UNVERIFIED. Cashfree questions in the handoff document §6. |
| Delivery rates, Bengaluru (web search 2026-11-07, third-party blogs, mostly not official rate cards) | Aggregator surface courier, 0.5 kg same-city prepaid: Shiprocket about ₹27–45 by plan; Shipmozo about ₹20–26; NimbusPost about ₹19–25.50 by volume; Delhivery direct about ₹30–45. Billed in 0.5 kg steps on the higher of real or size weight; GST extra. Hyperlocal bike (same day): Shiprocket Quick from ₹10/km or from ₹45; Porter two-wheeler base ₹48 incl. 1 km, up to 20 kg; Borzo from about ₹27–45. Hyperlocal price is distance-based; weight barely matters for books. Dunzo shut down (January 2025). No official API documentation was checked. | UNVERIFIED. Confirm the chosen provider's rate card and API in weeks 1–2 (D-24). |

## 10. Open items

Owner decisions still open:

- Pilot store names and launch dates (needed before live, not before building).
- Bike-delivery provider choice, after the weeks 1–2 API check (D-24).
- Staffing beyond the owner for support (Q101).
- P-4 attribution (can wait until after the pilot).
- Offline stock synchronization beyond "mark sold" (depends on the week-1 check).
- Delivery GST (after the CA answers): since 1 November 2026, delivery services for goods
  ordered through an e-commerce operator are reported at 5% without input tax credit, with
  the operator liable when the provider need not register (Notifications 06/2026 and
  09/2026-Central Tax (Rate), per tax commentary; gazette text not yet read). Owner to decide
  whether the customer pays the quote plus GST or BookConnect absorbs it (BC-22).
- Refund balance amount (D-54), after Cashfree question 8.

The 2026-11-10 coverage review ([decision coverage](./PHASE-7-8-decision-coverage.md)) lists
every question-bank item with its status. Its owner items were decided as D-58 to D-77, except
these, which wait on outside answers: the fallback if Cashfree cannot hold store money
(Cashfree Q1–Q2), web checkout or the native SDK (Cashfree Q17), delivery GST and the refund
balance amount (above). Before live: production Supabase timing (Q119), the real-money test
(Q131) and the rollback plan (Q132). Process: owner review of money-critical PRs (Q125) and
the shared process document (Q126). Post-pilot items: Q8–Q12, Q14, Q21–Q25.

Needs CA or lawyer (see handoff §6): delivery money ownership, invoicing, and GST; TDS on
store payments; seller of record (Q2); enforceability of D-09, D-12, D-14 and the store
agreement.

Review owner questions OQ-1 to OQ-12 (2026-11-08 planning review) were all answered by the
owner on 2026-11-08 with the recommended option and are recorded as D-26 to D-37.
Four final-read owner questions (F-01, F-02, F-03, F-14) were answered on 2026-11-08 with the
recommended option and are recorded as D-38 to D-41.
On 2026-11-09 the owner reviewed a further list of pickup and cancellation questions:
new answers are D-42 to D-45 (D-46 records the planning order); "cancellation before packing: full refund, no handling
charge" and "book unavailable: refund by default" confirm Q45 and Q65; a proposed
"warning at 3, suspension at 5" rule was considered and D-21 was kept unchanged.

Owner approvals: all seven handoff §3 items approved on 2026-11-07 (phase resumption,
two-lane rule, SDD folder, P-3/P-5/P-6, admin option B, store-hours rule, process
additions). DOC-13 and ACTIVE.md still need updating on day 1 (handoff §10).

## 11. Planning assumptions (not approvals)

- At least five orders per store per day as a working expectation, not a forecast.
- About ₹1.6 lakh three-month expense estimate; not a spending cap.
- About ₹2 lakh funding cushion target; not confirmed cash.
- Explore DPIIT recognition, grants, incubators; not guaranteed funding.

## 12. Superseded assumptions

- Store confirmation before payment → replaced by reserve-first, pay-first (BC-08).
- Pickup-only live pilot → replaced by pickup plus Bengaluru delivery (Q26).
- Seven-day pickup window → three calendar days (Q71).
- Possible nonzero pilot customer platform fee → ₹0 (Q15, D-11).
- "BookConnect definitely bears all payment charges" → stores pay the Cashfree fee (D-13).
- Weekly Monday target ≠ proof that Cashfree can hold funds; settlement ≠ entitlement.
- A fixed ₹80 delivery charge (recorded in the question bank on 2026-11-05) → replaced by
  the verified checkout quote with no markup (BC-22).
- Standard courier through an aggregator for the pilot (BC-16, BC-19; BC-18 now reads as one provider integration) → same-day
  bike delivery (D-24); courier kept as a later option.
- Same-day delivery deferred (BC-17, BC-45) → same-day is the pilot method (D-24).
- Assistant proposal "auto-cancel at the 45-minute acknowledgment target" → rejected by
  BC-13; final deadline is D-04.
- Assistant proposal "refund minus ₹80 after courier collection" → replaced by actual
  forward and return costs (Q45b, D-09).
- Assistant claims "orders must finish within 45 days" and "120-day refund limit" →
  withdrawn; see §9.
