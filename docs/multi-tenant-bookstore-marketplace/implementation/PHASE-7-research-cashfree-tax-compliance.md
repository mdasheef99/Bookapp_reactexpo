# PHASE-7 Research Brief: Cashfree, Tax, and Marketplace Compliance

**Status:** research input — not a source specification, not legal/tax advice
**Date:** 2026-10-16
**Scope:** Phase 7 (payment, ledger, settlement) and Phase 8 (pickup) planning with Cashfree
**Authority:** None. This brief informs the Phase 7/8 documentation pass and the CA/Cashfree
conversations. DOC-6, DOC-14, and DOC-15 remain authoritative until they are changed through
the normal documentation process.

Research was done with web search on 2026-10-16. Confidence labels:

- **Official** — read from a government or Cashfree primary page.
- **Secondary** — from tax/legal commentary; consistent across several sources.
- **Uncertain** — sources conflict or are silent; must be confirmed by the CA or Cashfree.

---

## 1. Summary

1. **Cashfree Easy Split fits the DOC-15 "do not pool funds" rule.** Cashfree (an RBI-regulated
   payment aggregator) holds funds in its escrow and settles store shares directly to each
   store's bank account. BookConnect never holds customer money.
2. **Easy Split has hard timing limits that shape the design:** the split must be posted within a
   configurable delay of at most 48 hours after payment, and a store's share can be held
   (deferred settlement) for at most 45 days from the transaction. Orders must therefore be
   picked up and past their return window within about 45 days, or cancelled/refunded.
3. **Chargebacks are withheld from BookConnect's balance, not the store's.** Recovery from the
   store is our job (vendor debit adjustment or a negative balance against future payouts).
4. **Printed books (HSN 4901) are most likely still GST-exempt after the September 2025 rate
   changes**, but one news report says otherwise and used books are not addressed by any
   ruling found. This is CA question 1.
5. **Income-tax TDS on e-commerce (old section 194-O) is now under the Income-tax Act, 2025,
   section 393(1), Table Sl. 8(v), from 1 April 2026, at 0.1%.** It applies even when the books
   are GST-exempt. BookConnect will likely need a TAN, must deduct from store payouts, file
   quarterly, and issue certificates. DOC-15 does not mention this yet.
6. **GST TCS (section 52) applies only to taxable supplies.** If all books are exempt, TCS is
   likely nil — but whether BookConnect must still register as an e-commerce operator is
   unresolved. This is CA question 2.
7. **Our Expo 54 app has no development build.** Cashfree's React Native SDK needs
   `expo-dev-client` plus prebuild/EAS builds. A web-checkout path avoids native code for web.

---

## 2. Tax Findings

### 2.1 GST on books

| Point | Finding | Confidence |
|---|---|---|
| New printed books, HSN 4901 | Exempt under Notification 2/2017-Central Tax (Rate), entry 119; advance rulings confirm. | Official (rulings) |
| After GST rate rationalisation (Notification 9/2025-CT(Rate), effective 22 Sep 2025) | Tax commentary says printed books remain nil; brochures/leaflets under the same heading are 5%. One news report (The Wire, 19 Sep 2025) claims printed books moved to 18%, apparently conflating paper/printing inputs; no correction found. | Uncertain — verify against CBIC gazette text |
| Used / second-hand books | No ruling found. One trade summary lists old books at 0% under 4901; antique books may fall under 9706 at 12%. Margin scheme (Rule 32(5)) applicability is unclear. | Uncertain |

### 2.2 GST TCS on the e-commerce operator (section 52)

| Point | Finding | Confidence |
|---|---|---|
| Who collects | An e-commerce operator that collects consideration for supplies made through it. | Official (CBIC TCS FAQ) |
| Base | "Net value of **taxable** supplies" — taxable supplies minus returns in the month. | Official (CBIC TCS FAQ) |
| Rate | Reduced from 1% to 0.5% total from 10 July 2024 (0.25% CGST + 0.25% SGST, or 0.5% IGST). The 2018 FAQ still shows the old 1%. | Secondary |
| Exempt-only marketplace | Since the base is taxable supplies, exempt books appear to produce nil TCS. No source addresses this case directly. | Uncertain (inference) |
| Operator registration | Section 24(x): an operator "required to collect TCS" must register regardless of turnover, in each State/UT where it has suppliers. If no TCS obligation arises, registration may instead follow the normal threshold for BookConnect's own taxable services. | Official text; application to exempt-only is uncertain |
| Return | GSTR-8 monthly for the TCS registration (from general knowledge; confirm). | Uncertain |

### 2.3 GST registration for the stores

| Point | Finding | Confidence |
|---|---|---|
| Section 23(1)(a) | A person engaged **exclusively** in wholly exempt supplies is not liable to register. | Secondary |
| Section 24(ix) | Persons supplying goods through an operator "required to collect TCS" must register regardless of turnover. | Official (CBIC TCS FAQ) |
| Notification 34/2023-CT (from 1 Oct 2023) | Small sellers of goods through an operator may skip registration if under the state threshold, intra-state only, one State/UT, with PAN and an enrolment number. | Secondary |
| Combined effect for book-only stores | Commentary says the interaction is unsettled; if BookConnect has no TCS obligation, section 24(ix) may not bite. | Uncertain — CA question 3 |

### 2.4 Income-tax TDS on e-commerce (old 194-O, now Income-tax Act 2025)

| Point | Finding | Confidence |
|---|---|---|
| Current law | From 1 April 2026, section 194-O of the 1961 Act maps to section 393(1), Table Sl. No. 8(v) of the Income-tax Act, 2025. Obligations arising on/after that date follow the new Act. | Secondary (several sources) |
| Rate | 0.1% of gross amount of sales (reduced from 1% on 1 Oct 2024). One article still shows 1% — outdated. | Secondary |
| Small-seller exemption | No deduction for a resident individual/HUF seller whose gross sales through the platform in the year do not exceed ₹5 lakh and who has furnished PAN/Aadhaar. Crossing ₹5 lakh triggers deduction on the whole amount. | Secondary |
| No PAN | Higher deduction rate (5%) when PAN/Aadhaar is not furnished. | Secondary |
| GST-exempt goods | 194-O is based on gross sales, not GST taxability, so it can apply to exempt books. | Secondary (inference from base) |
| Operational duty | TAN, deduction at credit/payment, quarterly TDS return, certificates to sellers. | Secondary — confirm form numbers under the new Act |

### 2.5 GST on BookConnect's own revenue

| Point | Finding | Confidence |
|---|---|---|
| Commission charged to stores | Support service (heading 9985) at 18%. | Secondary |
| Subscription fees to stores | Likely the same treatment. | Uncertain |
| Registration | Depends on whether section 24(x) applies (2.2) or the normal services threshold. | Uncertain |

---

## 3. Payments Regulation and Consumer Rules

### 3.1 RBI (Regulation of Payment Aggregators) Directions, 2025

Issued 15 September 2025 (RBI/DPSS/2025-26/141), effective immediately unless stated otherwise.
Relevant points (Official, as reproduced by TaxGuru):

- Non-bank PAs keep merchant funds in an escrow account with a scheduled commercial bank.
- Settlement timelines to merchants are "as per the agreement between the PA and the merchant",
  which must state them transparently. The reproduced text did not contain a fixed T+1 rule;
  some commentary still mentions T+1. **Confirm with Cashfree** which timeline governs our
  vendor holds.
- A PA must ensure that a marketplace onboarded by it does not accept payments for a seller
  not onboarded on its platform. → A store must be an ACTIVE Easy Split vendor before it can
  take payments.
- Refunds go to the original payment method unless the payer instructs otherwise, routed back
  through escrow. Chargeback rights are unaffected.
- The escrow cannot be used for cash-on-delivery transactions.

### 3.2 Consumer Protection (E-Commerce) Rules, 2020 — marketplace duties

Secondary sources (law-firm notes) summarise Rule 5 as requiring the marketplace to:

- display seller details clearly;
- prominently display the grievance officer's name, designation and contact (Rule 5(3)(e));
  regulators have issued notices for non-compliance;
- give complaint ticket numbers so consumers can track complaints;
- display return, refund, exchange, warranty, delivery and grievance information;
- obtain seller undertakings that listing content is accurate.

Seller duties (Rule 6) include providing all relevant details of the goods. Confirm the exact
clauses against the notified text.

---

## 4. Cashfree Findings

### 4.1 Payment Gateway

| Topic | Finding | Source |
|---|---|---|
| Base URLs | Sandbox `https://sandbox.cashfree.com/pg`; production `https://api.cashfree.com/pg`. | Official (Create Order) |
| API version header | `x-api-version: 2026-01-01`. | Official |
| Auth | `x-client-id` + `x-client-secret`, server-side only. | Official |
| Create order | `POST /orders`. Required: `order_amount` (decimal rupees, min 1), `order_currency`, `customer_details.customer_id` (3–50 alphanumeric), `customer_details.customer_phone` (10 digits). | Official |
| Our order ID | `order_id` 3–45 chars, letters/digits/`_`/`-`, unique. Use our payment-attempt ID. | Official |
| Expiry | `order_expiry_time` ISO 8601; set it no later than `payment_expires_at`. Min/max bounds not documented — confirm. | Official / confirm |
| Callbacks | `order_meta.return_url` (customer redirect), `order_meta.notify_url` (HTTPS). | Official |
| Checkout | Response `payment_session_id` is the only value the app needs. | Official |
| Order status | `ACTIVE`, `PAID`, `EXPIRED`, `TERMINATED`, `TERMINATION_REQUESTED`. | Official |
| Idempotency | Optional `x-idempotency-key` (UUID) on create order and refunds; reusing a key with a different body returns 422; `x-idempotency-replayed: true` on replay. | Official |
| Splits at creation | `order_splits` array (`vendor_id` + `amount` or `percentage`) when Easy Split is enabled. | Official |

### 4.2 Webhooks

| Topic | Finding | Source |
|---|---|---|
| Events | `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK`, `PAYMENT_CHARGES_WEBHOOK` (fees; needs subscription). Separate dispute webhooks exist. | Official |
| Key fields | `data.order.order_id`, `data.payment.cf_payment_id`, `payment_status` (`SUCCESS`/`FAILED`/`USER_DROPPED`), `payment_amount`, `payment_currency`. | Official |
| Signature | `x-webhook-timestamp` + raw body → HMAC-SHA256 with the PG secret → Base64 → compare with `x-webhook-signature`. Must use the **raw** body; JSON parsing can change `170.00` to `170` and break the signature. | Official |
| Delivery | `x-webhook-attempt` and (API versions 2025-01-01/2026-01-01) `x-idempotency-key` headers; duplicates possible; no ordering guarantee documented. | Official (silent on ordering) |

Design consequence: dedupe on the idempotency key plus `cf_payment_id`, then confirm state with
Cashfree's Get Order / Get Payments APIs before acting.

### 4.3 Refunds

| Topic | Finding | Source |
|---|---|---|
| Endpoint | `POST /orders/{order_id}/refunds`. | Official |
| Fields | `refund_amount` (≤ transaction amount), `refund_id` (3–40 chars — use our refund ID), optional `refund_note`, `refund_speed` (`STANDARD`/`INSTANT`), `refund_splits` (`vendor_id`, `amount`). | Official |
| Statuses | `SUCCESS`, `PENDING`, `PENDING_APPROVAL`, `CANCELLED`, `ONHOLD`, `REJECTED`. | Official |
| Time limit | Within six months of the original successful transaction. | Official |
| Multiple partial refunds | Not stated on the API page — confirm with Cashfree. | Uncertain |

### 4.4 Easy Split (marketplace settlement)

| Topic | Finding | Source |
|---|---|---|
| Activation | Must be enabled for test and production via support form or account manager. Split After Payment is off by default and cannot apply to earlier transactions. | Official (FAQ) |
| Vendor onboarding | Dashboard or API (`/easy-split/vendors`, KYC docs via `/easy-split/vendor-docs/{vendor_id}`). Needs account holder name, account number, IFSC or UPI VPA, vendor/business type, PAN-based KYC. GST not mentioned. Activation is asynchronous (`IN_BENE_CREATION` → ACTIVE). Bank verification is chargeable. | Official |
| Split after payment | `/pg/easy-split/orders/{order_id}/split`, by amount or percentage, captured payments only. Max configurable delay up to 48 hours after payment; if no split is posted, the full amount settles to BookConnect. | Official (FAQ + guide) |
| Deferred settlement | Store share can be held via a settlement eligibility date (`settlementEligibilityDateUpdate`), up to 45 days from the transaction; not extendable. Default delay and API path differ between pages — confirm for our account. | Official, with inconsistencies |
| Settlement types | Instant, Standard (scheduled), On-Demand; vendors get one payout per day. | Official (FAQ) |
| Refund before split | Refunded to the customer from the next settlement. | Official |
| Refund after split | Recovered from BookConnect's and the store's balances per the split (proportional by default); if the store's balance is insufficient, adjust first. | Official |
| Chargebacks | Disputed amount withheld from **BookConnect's** balance, not the store's; store settlements continue. | Official |
| Manual adjustments | Vendor `CREDIT`/`DEBIT` transfers, only if the debited side has balance. | Official |
| Limits and fees | Max 5 vendors per transaction (we use 1). 0.2% per split on top of PG charges; vendor payout charges set by the account manager. | Official |

### 4.5 Merchant onboarding

| Topic | Finding | Source |
|---|---|---|
| Website/app | A live website or published app; business name on the site must match KYC documents; business category is checked. | Official (onboarding FAQ) |
| Policies | Refund/cancellation, privacy, terms and conditions, contact/support info are reviewed. | Cashfree blog (generic) |
| KYC | Proprietorship: PAN, bank, Aadhaar/CKYC, two business proofs. Company: PAN, incorporation certificate, MOA/AOA, board resolution, signatory/beneficial-owner IDs. LLP/partnership: PAN, registration, partner checks. Signed service agreement. | Official / blog |
| Review time | Around 48 hours after complete documents (embedded-onboarding guide). Easy Split is a separate enablement. | Official (partner guide) |

### 4.6 React Native / Expo

| Topic | Finding | Source |
|---|---|---|
| Package | `react-native-cashfree-pg-sdk` (v2.4.0+ in the subscription guide). | Official |
| Expo | Cashfree documents `expo-dev-client` + `npx expo prebuild` + `expo run:*`; no config plugin found; iOS needs `LSApplicationQueriesSchemes` for UPI apps. | Official |
| This repo | Expo `~54.0.36`, React Native `0.81.5`, no `expo-dev-client`, no `android/` or `ios/` folders; `eas.json` exists. | Local check |

Decision needed: native SDK (dev build + EAS) versus Cashfree web checkout (JS SDK) for web
and an in-app browser on mobile. The second is faster to ship; UPI-intent behaviour in an
in-app browser must be tested.

---

## 5. Design Consequences for the Phase 7/8 Documentation Pass

1. **Store payment eligibility** requires an ACTIVE Easy Split vendor (RBI rule in 3.1). DOC-2
   and `seller_payout_accounts` gain vendor ID and vendor status.
2. **Split timing:** post the split within 48 hours of payment with the store's share deferred;
   set the settlement eligibility date to pickup + return window. Unpicked or unresolved orders
   must be cancelled/refunded before the 45-day ceiling.
3. **Split amount** = order total − BookConnect commission − GST on commission (if applicable) −
   income-tax TDS (0.1% where applicable) − any fees DOC-15 assigns to the store. Every component
   is a ledger account and a configurable policy value.
4. **Chargebacks and post-payout refunds** hit BookConnect first → explicit store negative
   balance and recovery (vendor DEBIT or offset against future splits) in DOC-15 §7.
5. **Fees** (PG charges via `PAYMENT_CHARGES_WEBHOOK`, 0.2% split fee, payout and bank
   verification fees) need ledger accounts and an owner decision.
6. **Amounts** are integer paise internally and decimal rupees at the Cashfree boundary; one
   conversion function, checked on every request and webhook.
7. **Customer phone** is mandatory for Cashfree orders → privacy notice and DPDP processor entry.
8. **Webhooks** are deduplicated and confirmed via Get Order/Get Payments; out-of-order and
   missing webhooks are handled by a polling reconciliation job.
9. **Refunds** use our refund ID as `refund_id` and an idempotency key; six-month limit;
   handle `PENDING_APPROVAL`/`ONHOLD`.
10. **Marketplace disclosures** (seller details, grievance officer, complaint ticket, return
    and refund terms) are required in the customer UI.
11. **DOC-15 tax fields** gain income-tax TDS alongside the reserved GST TCS fields.

---

## 6. Questions for the CA

Ask for short written answers; most are yes/no.

1. Are new and used printed books (HSN 4901) sold by independent bookstores nil-rated/exempt
   after Notification 9/2025-CT(Rate)? Are there common exceptions (antique books, stationery
   bundles)?
2. If every supply through BookConnect is exempt, is BookConnect "required to collect TCS"
   under section 52, and therefore required to register under section 24(x) in each state? Or
   does BookConnect register only for its own commission/subscription income at the normal
   threshold?
3. Do stores that sell only exempt books through BookConnect need GST registration (section 23
   vs section 24(ix) vs Notification 34/2023)? Can we onboard unregistered stores?
4. Income-tax Act 2025, section 393(1) Sl. 8(v): please confirm the 0.1% rate, the base
   (book subtotal only, or including delivery and platform fees), the ₹5 lakh individual/HUF
   exemption, the timing (at split/credit or payout), the return and certificate forms, and that
   we need a TAN. Is deducting it from the store's Easy Split share acceptable?
5. GST on our commission and subscription: 18%? Must we register now? Should we issue one tax
   invoice per store per settlement period?
6. Customer receipts: should the store issue a bill of supply for exempt books, and can
   BookConnect generate it on the store's behalf? How should refunds of exempt supplies be
   documented?
7. Which business structure (proprietorship, LLP, private limited) do you recommend for
   BookConnect, given Cashfree KYC, TAN, possible GST registration, and investor plans?
8. Anything else required before taking live payments (Shops & Establishments registration,
   professional tax, accounting exports we should build)?

## 7. Questions for Cashfree

1. Enable Easy Split (test and production) with Split After Payment and deferred settlement.
   What maximum split delay and settlement deferral can our account have? Is the 45-day cap
   firm?
2. Commercials: PG pricing by method (UPI, cards, netbanking), 0.2% split fee, vendor payout
   fee, bank verification fee, refund fees.
3. Vendor KYC for small proprietor bookstores without GST: is PAN plus a bank account enough?
4. Refunds after the store's share is settled: how is recovery handled when the vendor balance
   is insufficient? Are multiple partial refunds per order supported?
5. Chargebacks under Easy Split: process, timelines, evidence, and recovery from the vendor.
6. Settlement timelines under the RBI 2025 PA Directions for marketplace vendors.
7. Expo 54 / React Native 0.81 support for `react-native-cashfree-pg-sdk`, or recommended
   web checkout for a hybrid Expo app.
8. Minimum and maximum `order_expiry_time`, and whether an `ACTIVE` order can be terminated
   when our payment window closes.

---

## 8. Sources

Government and regulator:

- [CBIC / GST Council — FAQs on TCS (updated 30.11.2018)](https://www.gstcouncil.gov.in/sites/default/files/2024-02/faqs_tcs.pdf)
- [GST Council — Notification 34/2023-Central Tax](https://gstcouncil.gov.in/node/4389)
- [Income Tax Department — TDS rates](https://www.incometaxindia.gov.in/w/tds-rates-1)
- [RBI (Regulation of Payment Aggregators) Directions, 2025 — reproduced by TaxGuru](https://taxguru.in/rbi/rbi-regulation-payment-aggregators-directions-2025.html)

Tax and legal commentary:

- [Taxscan — printed books exempt under entry 119](https://www.taxscan.in/?p=56402)
- [Tax Garden — GST on printing services, books and packaging (2026)](https://taxgarden.in/blog/gst-on-printing-services-books-packaging-india-2026)
- [Disytax — HSN chapter 49 GST](https://disytax.com/hsn-chapter-49-printed-matter-books-gst/)
- [The Wire — claim of 18% on printed books (conflicting)](https://m.thewire.in/article/economy/18-gst-on-pens-school-bags-printed-books-from-sept-22-under-new-cbic-rules/amp)
- [KPMG — 56th GST Council recommendations](https://www.in.kpmg.com/taxflashnews/KPMG-Flash-News-Recommendations-of-56th-GST-Council-meeting.pdf)
- [TaxTMI — old/antique books trade summary](https://www.taxtmi.com/tmi_blog_details?id=575596)
- [TaxAJ — section 52 TCS step-by-step](https://www.taxaj.com/learn/gst-on-e-commerce-operators-tcs-under-section-52-step-by-step-guide/)
- [TaxGuru — registration with exempt supplies](https://taxguru.in/goods-and-service-tax/registration-requirements-case-exempt-supplies.html)
- [ClearTax — section 194-O](https://cleartax.in/s/section-194o)
- [TDSMAN — TDS on e-commerce, section 393(1) / 194-O](https://blog.tdsman.com/2026/07/tds-on-e-commerce-transactions-section-3931-194o/)
- [SmartGST — TDS rules from April 2026](https://smartgst.in/blog/tds-new-rules-april-2026)
- [Saral — section 194-O now section 393(1) Sl. 8(v)](https://saral.pro/blogs/section-194o/)
- [LiveLaw — GST on e-commerce transactions](https://www.livelaw.in/columns/goods-and-services-tax-on-e-commerce-transactions-150601)
- [Khaitan & Co — Consumer Protection (E-Commerce) Rules, 2020](https://khaitanco.com/sites/default/files/2020-08/Stricter%20Regulations%20on%20E-Commerce%20%E2%80%93%20The%20Consumer%20Protection%20(E-Commerce)%20Rules,%202020.pdf)
- [Moneylife — CCPA notices under Rule 5(3)(e)](https://www.moneylife.in/article/consumer-protection-authority-sends-over-200-notices-to-sellers-on-e-commerce-platforms/65462.html)

Cashfree:

- [Create Order API](https://www.cashfree.com/docs/api-reference/payments/latest/orders/create)
- [Payment webhooks](https://www.cashfree.com/docs/api-reference/payments/latest/payments/webhooks)
- [Verify webhook signatures](https://www.cashfree.com/docs/payments/online/webhooks/signature-verification)
- [Create Refund API](https://www.cashfree.com/docs/api-reference/payments/latest/refunds/create)
- [Easy Split overview](https://www.cashfree.com/docs/payments/split/overview)
- [Easy Split features](https://www.cashfree.com/docs/payments/split/features)
- [Easy Split FAQs](https://www.cashfree.com/docs/help/easy-split/faqs/faqs)
- [Split after payment guide](https://www.cashfree.com/docs/payments/split/recipes/split-a-payment)
- [Add Easy Split vendor](https://www.cashfree.com/docs/payments/split/vendor/add)
- [Vendor KYC](https://www.cashfree.com/docs/payments/split/vendor/kyc)
- [Delayed settlement](https://www.cashfree.com/docs/payments/split/settlements/delay/overview)
- [On-demand vendor settlements](https://www.cashfree.com/docs/payments/split/settlements/on-demand)
- [Account onboarding FAQs](https://www.cashfree.com/docs/help/onboarding-related/onboarding-faqs)
- [Embedded merchant onboarding](https://www.cashfree.com/docs/partners/embedded/embedded-merchant-onboarding)
- [React Native SDK (subscription guide, Expo steps)](https://www.cashfree.com/docs/payments/subscription/subscription_checkout_react_native_sdk)
