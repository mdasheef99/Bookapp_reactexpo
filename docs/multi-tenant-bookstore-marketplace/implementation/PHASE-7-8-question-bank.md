# Phase 7/8 Pre-Build Question Bank

**Status:** research input — not a source specification, not legal/tax advice
**Historical (2026-11-10):** older rows here (courier aggregator, ₹80 charge, 45-day and
120-day limits, Q99–Q100 to the CA, the "Still open" list) are kept as written. The
[decision register](./PHASE-7-8-decision-register.md), the three outside question documents
and the [decision coverage](./PHASE-7-8-decision-coverage.md) review win.
**Created:** 2026-11-04
**Scope:** Phase 7 (payment, ledger, refund, settlement) and Phase 8 (pickup)
**Related:** [Phase 7 tracker](./PHASE-7-payment-ledger-settlement.md),
[Cashfree/tax/compliance research brief](./PHASE-7-research-cashfree-tax-compliance.md)

This file merges the 132 open questions raised in the 2026-10/11 planning discussion
(`Q1`–`Q132`) with questions taken from patterns that larger marketplace and payments
companies publish (`E1`–`E30`). Nothing here is decided. It records no product behavior,
status change, or implementation authority.

---

## 0. Owner decisions and pending items (2026-11-05)

### 0.1 Decisions the owner confirmed

> **Superseded 2026-11-07:** the canonical decision list is now the
> [Phase 7/8 decision register](./PHASE-7-8-decision-register.md) (current version in its header). Where this
> section differs, the register wins. In particular, the "₹80 delivery charge" below is
> replaced by the verified checkout quote with no markup (BC-22), and the pricing model
> (commission plus subscription, Q6) matches DOC-16 rather than conflicting with it. Section
> 0.2 is kept as history; open items are tracked in register §10.

The owner accepted these on 2026-11-05 ("go with what is given"). They come from the
owner's own planning sessions. They are **not yet recorded in DOC-13 or the root specs**,
and some reverse them; the Phase 7/8 documentation pass must reconcile them.

| Decision | Conflicts with |
|---|---|
| **Pay-first checkout:** the customer pays immediately; stock is reserved for 10 minutes; the store acknowledges after payment (acknowledgment target wording unclear: "45 open-hours minutes") | DOC-6, DOC-14 and the Phase 7 goal (payment only after store confirmation); the Phase 6 → 7 seam |
| **Pilot launches with pickup and standard delivery** in Bengaluru; ₹80 delivery charge; BookConnect contracts a courier aggregator (Shiprocket candidate) | DOC-12 and DOC-16 (delivery is Phase 10; pickup first); the 3-week Phase 7/8 estimate assumed pickup only |
| Pilot: five stores, three-month introductory period, zero platform fees | DOC-16 commission/subscription model |
| New and used books | — |
| Unavailable paid items get an automatic partial refund; substitution not approved | — |
| Store payouts intended weekly on Mondays | DOC-9/15 weekly default (consistent) |
| Pickup window 3 days; full refund on no-show | — |
| Store-caused refunds and store-caused chargebacks are recovered from the store's future payouts | — |
| BookConnect may absorb small shipping-charge differences | — |
| Returns: condition-based eligibility, customer reports within 48 hours (subject to legal review) | — |
| Business entity: LLP | — |
| Planning assumptions only (not loss limits or spending authority): about ₹1.6 lakh expenses over three months, ₹2 lakh cushion | — |

### 0.2 Pending owner decisions

Numbers in brackets refer to the owner's 39-item agenda of 2026-11-05.

**Money when things go wrong (decide first):**

1. Can every listed book be bought immediately, or must stores mark stock as eligible for
   pay-first? How do offline counter sales affect it? [1]
2. Who pays Cashfree payment, split, payout and refund charges during the introductory
   period? [2]
3. Shipping money: who legally supplies delivery, receives the ₹80, invoices it, and
   carries the supplier obligation? [3]
4. Fallback if Cashfree cannot hold store money until Monday or until pickup/handover.
   (Known: Cashfree can hold up to 45 days and release on a set date; needs Cashfree
   confirmation for the account.) [4, 5]
5. Loss when a store cannot or will not repay, and has no future sales. (Practice:
   platform absorbs, then restricts the store.) [7]
6. Courier loss above the courier's compensation cap: BookConnect or store? [8]
7. Chargebacks from stolen cards, customer fraud, platform error, or unclear fault: who
   carries the loss? (Known: Cashfree takes chargebacks from BookConnect's balance first.) [9]
8. Maximum shipping difference BookConnect absorbs; when stores repay weight or packaging
   surcharges. [10]
9. Who pays forward shipping, return-to-store and extra courier charges in each failure
   cause (customer, store, courier, platform)? [11]

**Checkout and store operations:**

10. Payment methods at launch (UPI, cards, netbanking, wallets, cash on delivery). [12]
11. Ordering while a store is closed, paused, or its stock is stale. [13]
12. Final deadline and action when a store misses the acknowledgment target; confirm the
    target itself. [14]
13. Payment succeeds after the 10-minute reservation expired but stock is still there:
    keep the order or refund? [15]
14. Books only, or stationery too? [17]
15. Minimum/maximum order value and per-customer or per-store limits. [18]

**Pickup and delivery operations:**

16. When the courier is booked: after acknowledgment, packing, or ready. [19]
17. Who pays for packaging, normal and unusual. [20]
18. Courier misses or cancels collection. [21]
19. Evidence required for store-to-courier handover and for delivery. [22]
20. Authorized store staff handing over; someone else collecting for the customer.
    (Practice: Target allows a named alternate person.) [23]
21. Book missing, damaged, or different when the customer arrives to pick up. [24]
22. Delivery localities and pincodes. [25]

**Refunds and returns:**

23. Refund returns at courier collection or after inspection. [26]
24. How disputes over wrong, incomplete or damaged returns are decided. [27]
25. Shipping deducted on voluntary cancellation after courier collection. [28]
26. Shipping refund on partial refunds. [29]
27. Which refunds run automatically and which need manual approval. [30]
28. Offer instant refunds, and who pays the extra charge. (Known: Cashfree offers
    standard or instant.) [31]

**Pilot management (before live money, not before sandbox work):**

29. Pilot start date and the five stores. [32]
30. What happens after the three-month waiver: notice, consent, no surprise charges. [33]
31. Special terms for founding stores. [34]
32. Who handles complaints, refund disputes, payment failures and courier escalations.
    (Law fixes the timing: acknowledge in 48 hours, resolve in one month.) [35]
33. Penalties for unreliable stores; when to suspend a store's payments or payouts. [36, 37]
34. Exposure limits for refunds, courier losses, negative store balances, emergencies. [38]
35. Who can pause all payments, approve exceptional refunds and restart after an
    incident. [39]

### 0.3 Pending outside confirmations

- **Cashfree:** Easy Split eligibility, fees and any promotional pricing, holding store
  money to Monday or pickup, refund funding and partial-refund reversals, negative
  balances, chargebacks, limits, payment methods, checkout type and PCI attestation.
- **Courier aggregator (Shiprocket or other):** selection, doorstep pickup from stores,
  rates and weight adjustments, scheduling, delivery attempts, return-to-store charges,
  proof of handover, liability caps and claims.
- **CA:** LLP marketplace accounting, GST on books and on shipping, e-commerce TCS,
  income-tax TDS, invoices, refund accounting, settlement reconciliation.
- **Lawyer:** seller of record and shipping relationship, store agreement and recovery
  clauses, cancellation deductions, customer rights, grievance and privacy duties.

### 0.4 Pending authority (needed before any documentation or code work)

- Resume Phases 7 and 8 as a second lane, and record that in DOC-13.
- Approve the Phase 7/8 documentation pass that rewrites DOC-6/7/12/14/15/16 for
  pay-first and pilot delivery.
- Folder/branch setup, migration range, and how dev-project migrations are approved.

---

## 1. How to use this file

Adopting these questions into the project is a later step. When that happens:

1. Give each question one status:
   - `documented decision` — answered in a root DOC; confirm it still holds
   - `conflicting spec` — root DOCs disagree
   - `design gap` — nobody has answered it
   - `waiting on outside party` — Cashfree, CA, stores, or lawyer
   - `needs verification` — answer exists but must be checked (live DB, provider docs)
   - `not for pilot` — deliberately deferred
2. Record each answer in its owning document (DOC-6/7/9/14/15/16 or the Phase 7/8 SDD),
   not here. This file only tracks the question and where its answer lives.
3. Copy the **questions**, not other companies' **answers**. Their provider tools,
   liability terms, and laws differ (for example, Stripe can recover from a connected
   account's balance in ways Cashfree Easy Split may not). Indian rules (RBI PA
   Directions 2025, GST TCS, Income-tax Act 2025 s.393, E-Commerce Rules 2020) override
   foreign patterns.

The `Pilot` column on `E` questions is a first suggestion: `pilot` (before building the
relevant slice), `before live` (before real money), `later` (after the pilot).

---

## 2. Enterprise patterns consulted

| Source | Pattern taken |
|---|---|
| Stripe Connect (design guide, risk best practices, refunds/disputes) | Negative-balance liability is an explicit choice; hold payouts for new sellers until delivery; pause payouts during review; alert on risky accounts (disputes above ~0.75% treated as excessive); written refund/dispute responsibilities in seller agreements |
| Razorpay Route (reversals, settlement holds) | Refunds come from the platform account and need a matching reversal from the seller; holds can be immediate, scheduled, or indefinite and changed later; reversals after settlement depend on available balance; partial refunds may not auto-reverse; optional refund credit pool |
| Modern Treasury (ledger articles) | Double-entry, immutable once posted, pending vs posted entries, idempotency keys created once outside the retry loop, concurrency control, account normal balances |
| Airbnb engineering ("Avoiding Double Payments") | Split each provider call into before/call/after phases; classify errors as retryable or not; read idempotency records from the primary database only |
| Shopify local pickup | Staff verify items before "ready"; per-location ready notification text; resend notification |
| PCI DSS SAQ A guidance | Redirect to a provider-hosted payment page keeps the merchant in the smallest scope; no payment-page element may come from the merchant site; embedded/iframe options may change the scope |

These are published patterns, summarized from vendor and engineering pages (see §5). They
were not checked against each company's current full checklist.

---

## 3. Question bank

### A. Business model and money flow

1. Does BookConnect collect customer payments in the app, or do stores take payment at the counter?
2. Who is the legal seller: the bookstore or BookConnect?
3. Will BookConnect ever hold customer money itself, or only through Cashfree?
4. Which payment provider: Cashfree, or another?
5. Do stores receive their money directly from the provider (split), or does BookConnect pay them out?
6. How does BookConnect make money: commission, subscription, customer fee, or a mix?
7. What is the commission rate during the pilot?
8. What is the commission rate after the pilot?
9. Is commission calculated on the book price only, or including other charges?
10. Is the commission quoted including GST or excluding it?
11. Is there a cap or minimum on commission per order?
12. Can the commission rate differ by store, book category, or how the customer arrived?
13. Is there a store subscription, how much, and when does it start?
14. Is the subscription billed through Cashfree or separately?
15. Is there a customer-side fee (convenience, platform, handling)?
16. Who pays Cashfree's payment fees: BookConnect, the store or the customer?
17. Who pays the Cashfree split fee (0.2%; the pricing page also shows 0.25%)?
18. Who pays payout and bank-verification fees?
19. When is the pilot, and when does it end?
20. What do store terms promise ("free during the pilot until X")?
21. Will founding stores get special terms after the pilot?
22. Do we record "who brought the customer" on every order?
23. How exactly is "brought by BookConnect" defined?
24. Do stores see shadow invoices during the pilot, showing what they would have paid?
25. What numbers decide the post-pilot pricing, and on what date?

| ID | Question | Pattern | Pilot |
|---|---|---|---|
| E1 | If a refund or chargeback is larger than what BookConnect still holds for that store, who carries the loss: BookConnect, the store, or Cashfree? | Stripe negative-balance liability | pilot |
| E2 | Does Cashfree offer a refund reserve or credit pool, and does BookConnect keep a float there? | Razorpay refund credits | before live |
| E3 | Under the Cashfree contract, who is the merchant of record for chargebacks: BookConnect or the vendor? | Stripe merchant of record | before live |

### B. Pilot scope

26. Pickup only, or delivery as well?
27. Books only, or also stationery and other items?
28. Bangalore only? Which localities?
29. How many stores, and which ones?
30. Used books, new books, or both?
31. Is there a minimum or maximum order value?
32. Is there a limit on orders per customer or per store?
33. Can a customer pay for more than one store's order at once? (Currently: one store per cart.)

### C. Customer payment experience

34. Which payment methods: UPI, cards, netbanking, wallets, EMI?
35. Web checkout, or Cashfree's native SDK in the app?
36. How long does the customer have to pay after the store confirms (payment window)?
37. What happens if a payment fails: can they retry, and how many times?
38. What happens if they pay after the window closes: automatic refund, or keep the order if the book is still available?
39. What does the customer see while a payment is pending?
40. What receipt does the customer get, and who issues it?
41. Is the receipt shown in the app only, or also sent by email or SMS?
42. What notifications does the customer get (payment success, failure, refund, ready for pickup)?
43. Is the customer's phone number required? (Cashfree requires one on every order.)
44. Is the customer's email required?
45. Can a customer cancel after paying, and until when?

### D. Store owner experience

46. What must a store complete before it can accept payments (vendor KYC, PAN, bank, GST)?
47. Who registers the store with Cashfree: the store itself, or BookConnect on its behalf?
48. What happens to a store that never completes Cashfree verification?
49. What does a store see when an order is paid?
50. When does a store get its money: immediately, after pickup, or after the return window?
51. How often are stores paid: daily, weekly, or another schedule?
52. What does a store's statement show, and how often?
53. Can stores download statements or invoices?
54. What happens if a store's bank details are wrong and a payout fails?
55. Can a store cancel a paid order, and what are the consequences?
56. What happens to a store that repeatedly can't fulfil paid orders?

| ID | Question | Pattern | Pilot |
|---|---|---|---|
| E4 | Are new stores' payouts held until pickup (or the return window) ends, even if established stores are paid sooner? | Stripe: hold payouts for new sellers | pilot |
| E5 | Which events pause a store's payouts (dispute, repeated cancellations, review), and who can release the pause? | Stripe payout pause | before live |
| E6 | Which store-risk signals raise an alert (dispute rate, cancellation rate, negative balance, failed payouts), and at what thresholds? | Stripe risk monitoring | before live |
| E7 | Does the store agreement state who handles and pays for refunds, disputes, and chargebacks? | Stripe: written responsibilities | before live |

### E. Refunds, returns and disputes

57. Who decides refunds: platform staff, the store, or automatic rules?
58. Store can't fulfil after payment: full refund automatically?
59. Customer doesn't collect: full refund, or refund minus fees?
60. Which return windows are allowed (0, 3 or 7 days, or others)?
61. Are used books returnable, and under what conditions?
62. Who bears the cost of a refund: store, BookConnect or customer?
63. Is commission reversed on a refund?
64. Are Cashfree's fees on refunds absorbed or passed on?
65. Are partial refunds allowed, and can there be more than one per order?
66. Refund speed: standard or instant (instant may cost extra)?
67. How do we recover money from a store already paid when a refund happens later?
68. How are chargebacks handled: by hand or automated, and who pays?
69. Is there a maximum time for refund requests? (Cashfree documents conflict: six months in the API doc, 180 days in the merchant terms, 120 days in the grievance policy. Design for 120 until Cashfree confirms.)
70. Can a customer get a substitute book instead of a refund?

| ID | Question | Pattern | Pilot |
|---|---|---|---|
| E8 | After a split, is the vendor's share reversed automatically on refund, or must BookConnect request it? Does that also work for partial refunds? | Razorpay reversals; `reverse_all` not for partial refunds | pilot |
| E9 | If the store's Cashfree balance is too low to reverse, what happens: refund blocked, BookConnect pays, or recovered from later payouts? | Razorpay: reversal needs available balance | pilot |
| E10 | Can a refund still happen after a store's order is picked up and settled (post-pickup return)? | Audit F-01; Razorpay post-settlement reversal | pilot |

### F. Pickup (Phase 8)

71. How long does a customer have to collect after the order is ready?
72. What happens at the deadline: automatic cancel and refund?
73. How does the pickup code work (format, single use, expiry)?
74. Who checks the code: the store owner only, or staff too?
75. What if the customer arrives but the book is missing or damaged?
76. Can someone else collect on the customer's behalf?
77. Does the store need to mark the order "packed" before "ready"?
78. What does the customer see about pickup (address, hours, instructions)?
79. Does pickup completion start the return window?

| ID | Question | Pattern | Pilot |
|---|---|---|---|
| E11 | Must the store confirm each item is in hand before marking the order ready? | Shopify: verify items before ready | pilot |
| E12 | Can the ready notification be resent, and can stores add their own pickup instructions? | Shopify ready notification | pilot |
| E13 | Can part of an order be ready while other items are not, or is readiness all-or-nothing? | Shopify per-item fulfillment | pilot |
| E14 | Does the customer get a reminder before the pickup deadline, and when? | Common BOPIS practice | pilot |

### G. Settlement and accounting

80. How long is a store's money held, and is Cashfree's 45-day maximum enough?
81. What happens to orders not completed within 45 days?
82. How does BookConnect keep money to cover chargebacks and refund fees (a float in Cashfree)?
83. How are store negative balances handled: deducted from future payouts, or collected by hand?
84. Is settlement matched against Cashfree's reports automatically or by hand?
85. What accounting exports are needed (for your CA)?
86. What ledger accounts are needed?

| ID | Question | Pattern | Pilot |
|---|---|---|---|
| E15 | For each ledger account, what is its normal balance (debit or credit), and who owns it (customer, store, platform, provider)? | Modern Treasury account normality | pilot |
| E16 | Can ledger entries be pending before they are posted, and which events post them? | Modern Treasury pending vs posted | pilot |
| E17 | Does the database reject any money movement without both a source and a destination account? | Modern Treasury: money is not created or destroyed | pilot |
| E18 | How often is the ledger reconciled against Cashfree's settlement report (daily?), and who reviews mismatches? | Ledger reconciliation practice | before live |

### H. Tax and legal

87. Are new and used printed books GST-exempt?
88. Must BookConnect collect GST TCS, and register as an e-commerce operator?
89. Must stores be GST-registered to sell through BookConnect?
90. Does income-tax TDS (old 194-O, now section 393) apply, and does BookConnect need a TAN?
91. When is TDS deducted, and on what amount?
92. Is GST due on BookConnect's commission or subscription income?
93. Who issues the customer's receipt or bill of supply?
94. What does BookConnect invoice stores for, and how often?
95. Is BookConnect's current business structure suitable (proprietorship, LLP, company)?
96. Which E-Commerce Rules 2020 duties apply: seller details, grievance officer, complaint tickets?
97. Who is the grievance officer?
98. Which policy pages are needed: Terms, Privacy, Refund & Cancellation, Pickup, Contact?
99. Does the privacy policy need to name Cashfree as a data processor?
100. Is a store agreement needed, and what does it cover?

### I. Operations and support

101. Who handles refunds, disputes and payout problems during the pilot: you, or someone else?
102. What is the support response time?
103. How do customers contact support: in-app, email, phone, WhatsApp?
104. What do finance screens need to show in the pilot?
105. Who can approve refunds and manual adjustments (roles)?
106. How are problem cases tracked (queue, email, spreadsheet)?

| ID | Question | Pattern | Pilot |
|---|---|---|---|
| E19 | Is there one view of stuck payments, failed payouts, and stores with negative balances? | Stripe negative-balance filter | before live |
| E20 | Do large refunds or manual adjustments need a second person's approval? | Enterprise dual control | later |

### J. Technical and architecture

107. One shared repo with a separate folder and branch for Phase 7/8?
108. Use the existing Supabase dev project for testing?
109. Which migration number range does Phase 7/8 use?
110. How are migrations to the shared dev project coordinated with Phase 9?
111. Does Phase 7 change any inventory tables Phase 9 uses?
112. Where do Cashfree test keys live (`.env.local`, Supabase secrets)?
113. Which Cashfree API version?
114. Payment-provider interface, so Cashfree can be swapped later?
115. Which money rules does the database itself enforce (balanced ledger, no edits, one successful payment per order)?
116. What happens to Phase 6's deferred items (inventory constraint, timed expiry test)?
117. Should slices be built vertically (working payment first) or by layer?
118. How many slices, and in what order?
119. Production Supabase project: when is it created, and how are migrations moved there?

| ID | Question | Pattern | Pilot |
|---|---|---|---|
| E21 | For each Cashfree call, which errors are safe to retry, which are final, and which are "unknown" (timeout) and need a status check before anything else? | Airbnb error classification | pilot |
| E22 | Is every provider call recorded as an intent before the call and a result after, so a crash between them can be recovered? | Airbnb before/call/after phases | pilot |
| E23 | Where is each idempotency key created (once, outside any retry), and how long is it kept? | Modern Treasury idempotency | pilot |
| E24 | How are two concurrent actions on the same money (two refunds, refund vs settlement) prevented from both succeeding? | Modern Treasury concurrency control | pilot |
| E25 | Is a webhook treated as a trigger to fetch the true status from Cashfree, or as the truth itself? | Common provider guidance | pilot |
| E26 | Are idempotency and payment-state reads always from the primary database, never a replica or cache? | Airbnb primary-only reads | pilot |

### Security (new area)

| ID | Question | Pattern | Pilot |
|---|---|---|---|
| E27 | Does checkout redirect to a Cashfree-hosted page, with no card fields and no BookConnect element on the payment page, to stay in PCI SAQ A scope? | PCI SAQ A | pilot |
| E28 | Is Cashfree's web checkout a full redirect or an embedded/iframe component, and does that change BookConnect's PCI scope? | PCI SAQ A vs A-EP | before live |
| E29 | Does Cashfree require a PCI self-assessment or other security attestation from BookConnect at onboarding? | PCI merchant obligations | before live |

### K. Process and authority

120. Do you authorize resuming Phases 7 and 8 as a second lane?
121. Do you approve the documentation pass?
122. Can dev-project migrations and deploys be approved in a batch, or one at a time?
123. Does SDD-0's process apply to Phase 7, and with which changes?
124. Which models handle coding, reviews, tests and browser checks?
125. Will you review money-critical PRs yourself (payment success, refunds)?
126. Should SDD-0's process rules move into a shared process document?

### L. Launch readiness (needed before live payments, not before building)

127. When is the Cashfree live account verified, and with which documents?
128. When is Easy Split enabled for live mode?
129. Have the CA's answers been received and applied?
130. Have pilot stores been signed up and registered as Cashfree vendors?
131. Who tests a real-money payment before launch, and with how much?
132. What is the rollback plan if live payments go wrong?

| ID | Question | Pattern | Pilot |
|---|---|---|---|
| E30 | Is there a switch to turn off payments for one store or for everyone, and has a full sandbox settlement cycle (pay, pickup, refund, reconcile) been rehearsed before going live? | Common launch practice | before live |

---

## 4. Deliberately not for the pilot

These appear in enterprise checklists but do not fit a solo-run Bangalore pickup pilot:
instant or real-time payouts, multi-currency, automated fraud scoring, automated dispute
evidence submission, SOC 2 or similar audits, multi-region ledger scaling, and dual-control
approval (E20, until there is a second operator).

---

## 5. How established companies answer these

Researched 2026-11-04. This records what other companies **do**, not what BookConnect
should do. `Official` means the company's own page; `third-party` means blogs, news, or
forums, so treat those as indicative. Questions not listed have no published company
answer that was found.

### Money flow and fees

| Q | What companies do | Who | Source type |
|---|---|---|---|
| Q1, Q3, Q5 | The marketplace collects the customer's payment in its own checkout and pays sellers later on a cycle. Split-payment providers let a platform split each payment and hold the seller's share. | Amazon.in, Flipkart, Swiggy/Zomato; Stripe Connect, Razorpay Route | official / third-party |
| Q6, Q9 | Commission is a percentage of item price by category, plus small fixed per-order fees. | Amazon.in (referral + closing fee), Flipkart (commission + fixed fee + collection fee) | official examples |
| Q7, Q8 | Books commission is low on Indian marketplaces: Amazon.in's own worked example uses 4.5% for books. Flipkart commission ranges 2.5–28% by category. Food aggregators charge 15–35%. | Amazon.in, Flipkart, Swiggy/Zomato | official example / third-party |
| Q10 | Food aggregators add 18% GST on top of commission. | Swiggy/Zomato | third-party |
| Q16 | The seller pays the gateway cost, not the customer. Flipkart charges sellers a "collection fee" (2% prepaid in its own example) that covers the gateway. | Flipkart | official |

### Store payouts and holds

| Q | What companies do | Who | Source type |
|---|---|---|---|
| Q50, Q51 | First settlement 14 days after registration, then every 7 days. | Amazon.in | official |
| Q50, Q51 | Payment counted from dispatch, "as fast as 7 days", depending on seller tier (roughly 7–15 days). | Flipkart | official / third-party |
| Q51 | Weekly payouts; Zomato added an optional daily payout for small restaurants in 2024. | Swiggy/Zomato | third-party |
| Q51 | Daily rolling payouts by default, configurable or manual. | Stripe Connect | official |
| Q50 | A reserve until 7 days after delivery ("DD+7") is reported for Amazon, but not confirmed for India. | Amazon | third-party, unverified for India |
| E4, Q80 | New sellers are held longer: Stripe recommends holding new sellers' payouts until delivery; eBay says new sellers usually get funds within about 14 days; Etsy reserves new shops' funds, reportedly up to about 90 days. | Stripe, eBay, Etsy | official (Stripe, eBay) / third-party (Etsy) |
| E5 | Payouts can be paused while an account is under review, until the review clears. | Stripe, eBay | official |
| Q84, E18 | The marketplace publishes a settlement report for each payout; sellers reconcile orders delivered but not yet settled as pending. | Amazon.in, Flipkart | official / third-party |

### Refunds, chargebacks and losses

| Q | What companies do | Who | Source type |
|---|---|---|---|
| E1, Q83 | The platform chooses who carries negative balances. If the platform is liable and the seller's balance is too low, the shortfall is taken from the platform's balance. Stripe advises new platforms to let Stripe carry it. | Stripe Connect | official |
| Q67, E8, E9 | Refunds come out of the platform's account; the platform then reverses the seller's share. Reversals work even after the seller is paid, if the seller has enough balance. Automatic reversal does not cover partial refunds. | Razorpay Route | official |
| Q62 | If the seller is at fault, the marketplace refunds the buyer and debits the seller's account. | Amazon (US policy) | official |
| Q58, Q62 | Who pays for a cancellation depends on the stage: before the restaurant accepts, the restaurant gets nothing; after accepting, about 50%; after the food is ready, 100%. | Swiggy/Zomato (via an integrator's rules) | third-party |
| Q68, E3 | If the buyer files a bank chargeback, Amazon's own guarantee claim no longer applies; the chargeback process decides it. | Amazon | official |
| Q69 | Buyers can file a guarantee claim up to 90 days after the order. | Amazon | third-party |
| Q56, E6 | Seller health targets: order defects (chargebacks, claims, negative feedback) under 1% over 60 days; seller cancellations under 2.5% over 7 days; late dispatch under 4%. Stripe treats disputes above about 0.75% as excessive. | Amazon, Stripe | third-party (Amazon) / official (Stripe) |
| Q60, Q61 | Not confirmed for Amazon.in books. One Indian online bookseller allows returns within 10 days of dispatch and excludes used books. | fmpl.in | official (that seller only) |

### Pickup

| Q | What companies do | Who | Source type |
|---|---|---|---|
| Q71, Q72 | Order held 3 days, then cancelled and refunded to the original payment method; the customer can ask for 3 more days before the deadline. | Target | official |
| Q71, Q72 | Order held 7 days from "ready", then cancelled and refunded to the original payment method. | Walmart Canada | official |
| Q71, Q72 | Package held 3 days from arrival, then returned and refunded automatically. | Amazon Locker | official |
| Q73 | A unique 6-digit pickup code is sent in the notification and shown in the app. | Amazon Locker | third-party |
| Q78, E12 | The ready notification includes a "collect by" date. Shopify lets each location customise the ready message. | Walmart Canada, Amazon Locker, Shopify | official |
| E11, Q77 | Staff check each item, then mark the order ready and notify the customer. | Shopify | official |

### Engineering

| Q | What companies do | Who | Source type |
|---|---|---|---|
| E21, E22, E26 | Each provider call has three recorded phases (before, call, after); errors are classified as retryable or not; idempotency records are read only from the primary database. | Airbnb | official engineering blog |
| E23 | The client creates the idempotency key once, outside the retry loop; keys are kept at least 24 hours. | Modern Treasury | official blog |
| E15–E17, E24 | Double-entry with a source and destination for every movement; entries may be pending, then become immutable once posted; concurrency control prevents races. | Modern Treasury | official blog |
| E27, E28 | A full redirect to a provider-hosted payment page qualifies for PCI SAQ A; any payment-page element served from the merchant's site breaks that; sources disagree on iframes. | PCI SSC guidance via assessors | third-party |

### Round 2: more company practice

| Q | What companies do | Who | Source type |
|---|---|---|---|
| Q15 | Customer-side "platform fees" are common in India: Flipkart about ₹3 per order (2024), Amazon India ₹5 marketplace fee, Zomato about ₹12–15, Swiggy about ₹15–17.58 (2025–26). | Flipkart, Amazon India, Zomato, Swiggy | third-party news |
| Q12, Q22, Q23 | 0% commission on buyers the seller brings itself through its own link, and on all later orders from those buyers; normal commission on buyers the marketplace finds. A buyer counts as the seller's if they ordered from the seller off-platform in the past 4 years or the seller invited them in the past 3 months. | Faire ("Faire Direct") | official |
| Q20, Q21 | Fee waivers are used to attract sellers: Amazon.in cut referral fees to zero on products under ₹300 from 7 April 2025 (books coverage not confirmed). | Amazon.in | official announcement |
| Q63 | On a refund, the marketplace returns its commission minus a refund administration fee (lesser of $5 or 20% of the commission); reportedly the full fee is returned for books and other media. | Amazon (US) | third-party |
| Q64 | The payment provider keeps its processing fee on refunds. The platform's own fee is not returned to the seller unless the platform chooses to. | Stripe | official |
| Q68 | Who pays the dispute fee is a configuration choice; with direct charges the disputed amount comes from the seller and the dispute fee from the platform. | Stripe | official |
| Q65 | Partial refunds and more than one refund per order are supported, though sellers report occasional failures. | Amazon | forum / help references |
| Q66 | Cashfree refunds take a speed setting: standard or instant. | Cashfree | official (brief) |
| Q45 | Customers can cancel any time before the order ships; the refund goes back to the original method. UPI refunds generally take 1–7 working days. | Amazon.in; PayU guide | third-party |
| Q40, Q93 | Two invoices per order: the seller issues the invoice for the goods, the marketplace issues its own for its fees. In the UK, a seller must supply an invoice within two working days if asked. | Amazon.in (sample invoices), Amazon UK | third-party / official (UK) |
| Q46, Q48 | A seller cannot take payments or receive payouts until required details are verified; while checks run, status is "pending"; the platform sends the seller back to the hosted form to fix gaps. | Stripe Connect | official |
| Q47 | The provider hosts the onboarding form, or the platform embeds or builds it. Cashfree vendors are added by the platform through the dashboard or API. | Stripe; Cashfree | official |
| Q54 | A failed payout rolls over to the next cycle once the seller fixes bank details; changing bank details starts a 3-day security hold. | Amazon | forum |
| Q76 | The customer can add an alternate pickup person after ordering (name and email); a photo ID is reportedly shown at pickup. | Target | official / third-party (ID) |
| Q97, Q102, Q103 | By law, the grievance officer must acknowledge a complaint within 48 hours, resolve it within one month, and give the customer a ticket number. Every marketplace must do this. | E-Commerce Rules 2020 | law-firm summaries |

### Cashfree answers already in the research brief

| Q | Answer | Source type |
|---|---|---|
| Q17 | Split fee 0.2% per split, on top of payment charges (pricing page also shows 0.25%). | official |
| Q43 | Customer phone number (10 digits) is required on every Cashfree order. | official |
| Q46 | Vendor needs account holder name, bank account and IFSC (or UPI ID), business type, PAN-based KYC. GST is not mentioned. Bank verification is charged. A store must be an active vendor before it can be paid (RBI rule). | official |
| Q51 | Vendors get at most one payout per day; settlement can be instant, scheduled, or on demand. | official FAQ |
| Q80, Q81 | The store's share can be held up to 45 days from the payment, not extendable, so orders must finish (picked up, past return window) or be refunded within about 45 days. | official, with page inconsistencies |
| Q113 | API version `2026-01-01`. | official |
| E8 | Refunds can name the vendor share to reverse (`refund_splits`). Recovery when the vendor's balance is too low is BookConnect's job (vendor debit or offset); details need Cashfree. | official / open |
| E25 | Webhooks can arrive more than once and no ordering is guaranteed, so they must be checked against a status fetch. | official |

### Tax answers already in the research brief (likely, CA must confirm)

| Q | Likely answer |
|---|---|
| Q87 | Printed books (HSN 4901) most likely still GST-exempt after September 2025; one news report conflicts. |
| Q88 | GST TCS applies only to taxable supplies, so exempt books likely give nil TCS; whether BookConnect must still register as an operator is uncertain. |
| Q89 | A store selling only exempt books is likely not required to register for GST (section 23(1)(a)). |
| Q90, Q91 | Income-tax TDS (Income-tax Act 2025 s.393, formerly 194-O) at 0.1% of gross sales applies even to exempt books; no deduction for an individual/HUF store under ₹5 lakh a year with PAN; BookConnect likely needs a TAN. Timing and base need the CA. |
| Q92 | GST at 18% on BookConnect's commission and subscription (support services). |
| Q96 | E-Commerce Rules duties apply: seller details, grievance officer, complaint tickets (see brief §3). |

### Still open after both rounds

- **Ask Cashfree:** E2 (refund reserve), E3 (who carries chargebacks), E9 (low vendor
  balance), E28/E29 (checkout type and PCI attestation), multiple partial refunds per
  order (Q65), live onboarding (Q127–Q128).
- **Ask the CA:** confirm Q87–Q92; Q93–Q95, Q99–Q100.
- **No company answer found:** Q36–Q39 (payment window after store confirms; Amazon and
  Flipkart take payment at order time), Q75 (missing or damaged book at pickup), E14
  (pickup reminders), Q70 (substitutes).
- **Only you can decide:** pilot scope and dates (Q19, Q26–Q33), payment methods and
  checkout choice (Q34–Q35), pricing numbers (Q7–Q8, Q11, Q13–Q14, Q24–Q25), process,
  authority, and setup (Q107–Q126), launch readiness (Q129–Q132).

---

## 6. Sources

- [Stripe Connect: design an integration](https://docs.stripe.com/connect/design-an-integration)
- [Stripe Connect: risk management best practices](https://docs.stripe.com/connect/risk-management/best-practices)
- [Stripe Connect: refunds and disputes](https://edge-docs.stripe.com/connect/saas/tasks/refunds-disputes)
- [Razorpay Route: reversals](https://razorpay.com/docs/payments/route/reversal)
- [Razorpay Route: linked account reversals and settlements](https://razorpay.com/docs/payments/route/linked-account/reversals-settlements.md)
- [Modern Treasury: enforcing immutability in a double-entry ledger](https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger)
- [Modern Treasury: how to scale a ledger, part V](https://moderntreasury.com/journal/how-to-scale-a-ledger-part-v)
- [Modern Treasury: account normality](https://moderntreasury.com/learn/what-is-account-normality)
- [Airbnb: avoiding double payments in a distributed payments system](https://medium.com/airbnb-engineering/avoiding-double-payments-in-a-distributed-payments-system-2981f6b070bb)
- [Shopify: local pickup for online orders](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/order-management/local-pickup-for-online-orders)
- [Schellman: SAQ A vs SAQ A-EP](https://www.schellman.com/blog/saq-a-vs-saq-a-ep)
- [Hyperproof: PCI DSS 4.0 SAQ A eligibility](https://hyperproof.io/resource/pci-dss-4-0-update-new-saq-a-eligibility-criteria/)
- [Cashfree grievance redressal policy (120-day refund limit)](https://www.cashfree.com/grievance-redressal-policy/)
- [Amazon.in: how payments work for online selling](https://sell.amazon.in/seller-blog/how-payments-work-for-online-selling)
- [Amazon.in: fees and pricing](https://sell.amazon.in/fees-and-pricing)
- [Flipkart Seller Hub: fees and commission](https://seller.flipkart.com/fees-and-commission)
- [Amazon A-to-z Guarantee claims (seller help)](https://sellercentral.amazon.com/gp/help/external/G27951)
- [Amazon A-to-z Guarantee protection (Amazon Pay help)](https://pay.amazon.com/help/201212340)
- [Target: order pickup hold period](https://www.target.com/help/article/000062599)
- [Walmart Canada: pickup help](https://www.walmart.ca/en/help/article/walmart-pickup/d8cd902fb99a485fa25e19dd1de48bf5)
- [Amazon: how to use Amazon Locker](https://aboutamazon.com/news/operations/how-to-use-amazon-locker)
- [eBay: pending payments for new sellers](https://www.ebay.ca/help/selling/getting-paid/getting-paid-items-youve-sold/payments-hold?id=4816)
- [Simply Business: Etsy withholding sellers' money](https://www.simplybusiness.co.uk/knowledge/articles/etsy-withholding-sellers-money/)
- [Petpooja: why Swiggy/Zomato deposits never match](https://blog.petpooja.com/operations-workflows/why-swiggy-zomato-sales-bank-deposits-never-match/)
- [UrbanPiper: aggregator status updates and cancellation share](https://support.urbanpiper.com/support/solutions/articles/12000070095-significance-of-status-updates-for-aggregators)
- [Feedvisor: Amazon seller performance measurements](https://feedvisor.com/university/seller-performance-measurements/)
- [fmpl.in: return policy](https://fmpl.in/pages/return-policy)
- [Inc42: Amazon India ₹5 marketplace fee](https://inc42.com/buzz/amazon-india-rolls-out-inr-5-marketplace-fee-for-all-users)
- [YourStory: Flipkart ₹3 platform fee](https://yourstory.com/2024/08/flipkart-introduces-platform-fees-on-its-ecommerce-platform)
- [5paisa: Swiggy platform fee ₹17.58](https://www.5paisa.com/news/swiggy-raises-platform-fee-by-17-to-rs1758-per-order-matches-zomato-pricing)
- [Faire: Faire Direct policy](https://www.faire.com/blog/selling/faire-direct-policy-update)
- [Amazon.in: seller fee change 2025](https://sell.amazon.in/ml/seller-blog/reduce-your-amazon-selling-costs--complete-guide-to-seller-fee-change-2025)
- [Helium 10: Amazon seller fees (refund administration fee)](https://www.helium10.com/blog/amazon-fba-seller-fees/)
- [Stripe: fees on refunded payments](https://support.stripe.com/questions/understanding-fees-for-refunded-payments)
- [Stripe Connect: marketplace refunds and disputes](https://edge-docs.stripe.com/connect/marketplace/tasks/refunds-disputes)
- [Stripe Connect: marketplace onboarding](https://docs.stripe.com/connect/marketplace/tasks/onboard)
- [Stripe Connect: handling API verification](https://docs.stripe.com/connect/handling-api-verification)
- [PayU: how UPI refunds work](https://payu.in/blog/?p=14665)
- [Amazon UK: print an invoice](https://digprjsurvey.amazon.co.uk/csad/help/node/GRPUHK7RCNVRBURD)
- [Target: alternate pickup person](https://www.target.com/help/article/000098994)
- [Amazon seller forum: failed disbursement](https://sellercentral-europe.amazon.com/seller-forums/discussions/t/d49b9b279fb67727caf42c80d9049254)
- [IndiaLaw: E-Commerce Rules 2020 summary](https://www.indialaw.in/guides/civil/consumer-protection-e-commerce-rules/)
