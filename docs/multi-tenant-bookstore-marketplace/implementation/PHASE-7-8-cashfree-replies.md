# Phase 7/8: Cashfree Replies and Fact Record

**Status:** record of what Cashfree has told us, 2026-11-10. Ticket ID 8774207.
**Authority:** none. This is evidence for the SDDs. Business rules stay in the
[decision register](./PHASE-7-8-decision-register.md).
**Related:** [first mail](./PHASE-7-8-mail-cashfree.md) ·
[second mail](./PHASE-7-8-mail-cashfree-2.md) ·
[question list](./PHASE-7-8-questions-cashfree.md)

Cashfree replied twice on 2026-11-10: a support reply to questions 1 to 15 and 20, and a
Tech Team reply to questions 16 to 19. The owner sent a second mail the same day. The Tech
Team's reply to that second mail (R3) was recorded here on 2026-11-10; it answers part of
the list and promises the rest.

---

## 1. How to read the facts

Every Cashfree fact used in an SDD cites an ID from this file. Each fact carries one source
tag. A fact without a tag must not be used.

| Tag | Meaning |
|---|---|
| R1 | Cashfree's first reply (support) |
| R2 | Cashfree's second reply (Tech Team) |
| R3 | Cashfree's third reply (Tech Team), answering our second mail |
| DOC | Read on Cashfree's public documentation on 2026-11-10 |
| SBX | Seen by us on sandbox on 2026-11-09 |
| ASKED | Not known. Asked in the second mail; no answer yet |

**None of the R1, R2, R3 or DOC facts has been tested by us on sandbox yet.** Sandbox testing
of Easy Split waits for Cashfree to switch on deferred settlement.

## 2. Facts

### Holding and releasing a store's money

| ID | Fact | Source |
|---|---|---|
| CF-01 | Easy Split is enabled on our sandbox account. | R1 |
| CF-02 | Deferred settlement can be configured up to 45 days. The split delay for Split After Payment can be 1 to 45 days. Our account has Split After Payment at T+1; deferred settlement was not yet enabled, and Cashfree had requested 3 days. We asked for 45. | R1 |
| CF-03 | The settlement eligibility date can be updated per order and per vendor: `PUT /api/v2/easy-split/orders/{orderid}/settlement-eligibility/vendors/{vendorid}`, parameter `settlementEligibilityDateUpdate`. The date must fall inside the configured maximum window, counted from the transaction date. Beyond it the API answers "Settlement eligibility cannot be beyond max_eligibility_date". | R1 |
| CF-04 | When the maximum window is reached, the held amount settles to our merchant account, not to the vendor. | R1, DOC |
| CF-05 | There is no recurring weekly (Monday) schedule. When a deferral period ends, the eligible amount is released for settlement automatically. | R1 |
| CF-06 | A vendor receives one settlement a day, grouping its unsettled transactions. | DOC |
| CF-07 | The 45-day limit "should not be treated as an unconditional extension of the statutory settlement requirements" under the RBI Payment Aggregator Directions, 2025. Cashfree gave no view on our arrangement. | R1 |
| CF-08 | Customer funds sit in Cashfree's escrow account until distributed. BookConnect can keep its own share of a payment. A delivery provider could be added as a vendor. | R1 |
| CF-09 | Split After Payment: `POST /easy-split/orders/{order_id}/split`, by amount or percentage per vendor; call it at least 2 minutes after the payment succeeds. If no split is made, the whole amount settles to the merchant. | DOC |
| CF-42 | Cashfree has noted a 45-day deferred settlement window for our sandbox account. It is not yet configured; Cashfree will confirm when it is. | R3 |
| CF-43 | If we never update an order, its settlement eligibility date is the transaction date and time plus the deferral period. With a 45-day window, an untouched share is therefore held for the full 45 days by default. | R3 |
| CF-44 | The eligibility date can be updated to any date inside the deferral window, so it can be moved earlier as well as later. A date beyond the maximum is rejected. Format `YYYY-MM-DD HH:mm:ss`. Sandbox URL: `PUT https://test.cashfree.com/api/v2/easy-split/orders/{orderid}/settlement-eligibility/vendors/{vendorid}`. This API supports only one split per vendor for an order. | R3 |
| CF-45 | Once the eligibility date is reached, the store's share is settled to the store according to the store's settlement schedule. What happens when the maximum window is reached is still to be confirmed by Cashfree (see CF-04 and CF-A3). | R3 |
| CF-46 | Calling the Split API a few minutes after the payment, inside the T+1 split delay, is correct. The store's share then stays on hold until its eligibility date. The split delay does not need changing. | R3 |
| CF-47 | After the eligibility date the amount is credited according to the store's settlement schedule, on bank working days, for example T+1 at 11:00 AM. A weekly schedule, which settles on the first working day of the week, is also available. This refines CF-05: there is no weekly deferral release, but a store can be put on a weekly settlement schedule. | R3 |
| CF-48 | Documentation for vendor-level settlement delay: `https://www.cashfree.com/docs/payments/split/settlements/delay/vendor-level`. Not yet read by us. | R3 |

### Stores as vendors

| ID | Fact | Source |
|---|---|---|
| CF-10 | Vendors can be created, updated and read by API, and their documents uploaded by API. | R1 |
| CF-11 | KYC: an individual vendor needs PAN and address proof. A business vendor needs GSTIN where applicable. PAN and bank details alone may not be enough. | R1 |
| CF-12 | Vendor activation takes about 10 minutes on sandbox; production time varies. Failure or review statuses: `BANK_VALIDATION_FAILED`, `BENE_CREATION_FAILED`, `ACTION_REQUIRED`, `ON_HOLD`. A vendor stuck in `IN_BENE_CREATION` for over 24 hours is raised with support. | R1 |
| CF-13 | A vendor can be marked Blocked to stop its settlements, and unblocked later. Cashfree may itself put a vendor `ON_HOLD`; its held amount stays in escrow. | R1 |
| CF-14 | A `VENDOR_STATUS_UPDATE` webhook fires when a vendor's status changes. Vendor settlement webhooks exist. | DOC |
| CF-49 | An individual vendor needs PAN and one address proof (Aadhaar, driving licence, passport or voter ID). GSTIN is not required. Which vendor type a sole proprietor without GST should use is still to be confirmed. | R3 |

### Refunds

| ID | Fact | Source |
|---|---|---|
| CF-15 | Before the vendor split, a refund is paid from our merchant balance. After the split and before vendor settlement, the merchant and vendor balances are debited, including the vendor's held balance. After vendor settlement, the vendor's share is adjusted against its later settlements. | R1 |
| CF-16 | By default a refund debits vendor balances in proportion to their split. This can be switched off; we then name the vendor amounts in `refund_splits`. | R1 |
| CF-17 | A refund goes `ONHOLD` when the merchant ledger or the vendor balance is too low. To release it we recharge the merchant ledger, or create a credit adjustment to the vendor balance funded from the merchant ledger. | R1, SBX |
| CF-18 | There is no separate refund reserve or float. Refunds and chargebacks are funded from our merchant ledger, which we recharge. | R1 |
| CF-19 | Vendor balance adjustment: `POST /easy-split/vendors/{vendor_id}/adjustment`, type `CREDIT` or `DEBIT`. A debit fails with "Vendor does not have sufficient balance", so a vendor balance cannot go below zero. | DOC |
| CF-20 | A refund can be started up to six months after the payment was captured. | R1 |
| CF-21 | If a refund to the original UPI address fails, it can go to another UPI address of the customer with the customer's consent, or be paid from our merchant ledger. | R1 |
| CF-22 | Fees are not returned on a refund: the gateway fee, the Easy Split fee, GST on both, and settlement charges. | R1 |
| CF-23 | Standard refunds carry no separate fee. Instant refunds are priced separately. | R1 |
| CF-50 | After a store has been settled, if its balance is lower than its share of a refund, the refund is put on hold until the balance is available. We can fund it by creating an adjustment to the store's balance. | R3 |

### Chargebacks

| ID | Fact | Source |
|---|---|---|
| CF-24 | A disputed amount is withheld or debited from our merchant balance, not the vendor's. Vendor settlements continue. We recover from the vendor by a debit adjustment. | R1 |
| CF-25 | There is no separate chargeback or dispute fee. If the dispute is won, the amount is released back. | R1 |
| CF-26 | Dispute APIs (read, accept, submit evidence) and dispute webhooks exist. | DOC |

### Fees

| ID | Fact | Source |
|---|---|---|
| CF-27 | The Easy Split charge shows as 0.20% on sandbox. Production pricing comes from the Account Manager. The 0% gateway-fee offer does not cover Easy Split. | R1 |
| CF-28 | Vendor payout charges follow our payout pricing and are debited from the merchant's balance. | R1, DOC |
| CF-29 | The `PAYMENT_CHARGES_WEBHOOK` event ("Success Payment TDR") reports the charge for each payment. | R1 |
| CF-51 | We can either bear the payment gateway and Easy Split charges ourselves or bill them to the store. The Easy Split charge is calculated on the order amount, not on the number of splits. How "bill to the store" is set up is not stated. | R3 |

### Payments and checkout

| ID | Fact | Source |
|---|---|---|
| CF-30 | If two payments succeed on one order, Cashfree reverses the extra payment to the customer. | R1 |
| CF-31 | `order_expiry_time` must be more than 15 minutes and less than 30 days. Without it an order expires after 30 days. | R2, SBX |
| CF-32 | An order is ended with the Terminate Order API: `PATCH /orders/{order_id}` with `order_status: TERMINATED`. The answer may be `TERMINATION_REQUESTED`. If a payment has already succeeded the order may not terminate, so the order status and payment webhooks are final. | R2, DOC |
| CF-33 | A UPI payment started before expiry and finished after it moves to `SUCCESS`. | R2 |
| CF-34 | Web checkout can open as a redirect, a popup or inline; card details are entered on Cashfree's hosted page. For an Expo app Cashfree recommends `react-native-cashfree-pg-sdk`, which needs `expo-dev-client` and `expo prebuild` and does not run in Expo Go. | R2 |
| CF-35 | A PCI DSS certificate is needed only for server-to-server card integration, not for hosted checkout or the SDK. | R2 |

### Webhooks, keys and tooling

| ID | Fact | Source |
|---|---|---|
| CF-36 | Payment webhooks are signed with the API client secret. Only one key pair is active at a time, so old and new keys cannot overlap. Rotation means pausing services, generating new keys and replacing them everywhere. | R2 |
| CF-37 | Webhook delivery is at-least-once. Default retries: 3, at 2, 10 and 30 minutes; configurable per endpoint. A message whose timestamp is over five minutes old should be rejected. | DOC |
| CF-38 | Split, adjustment and terminate calls accept an `x-idempotency-key` header. | DOC |
| CF-39 | Vendor reconciliation: `POST /pg/recon/vendor` returns vendor settlements with settlement ID, time and bank reference number. A settlement reconciliation API also exists. | DOC |
| CF-40 | Sandbox can simulate a payment as `SUCCESS`, `FAILED`, `PENDING` or `USER_DROPPED`, and a vendor settlement as initiated, successful or failed. There is no dispute simulation. | DOC |
| CF-41 | Base URL `https://sandbox.cashfree.com/pg`; API version `2026-01-01`. | SBX, DOC |

## 3. Questions from the second mail

The IDs are kept so the SDDs' references stay valid.

| ID | Question | Status after R3 | Affects |
|---|---|---|---|
| CF-A1 | Which eligibility date applies if we never update an order? | Answered: CF-43 | SDD 05 |
| CF-A2 | Can an eligibility date be moved earlier as well as later? | Answered: CF-44 | SDD 05 |
| CF-A3 | At the eligibility date, is the share settled to the store; and at the maximum window, to us? | Half answered: to the store at the date (CF-45). The maximum-window part is promised. It matters more now: the default date is the end of the window (CF-43), so "the date arrived" and "the window ended" are the same moment for an order we never update | SDD 05 |
| CF-A4 | With the split made minutes after payment at T+1, does the store's share stay held until its eligibility date? | Answered: CF-46 | SDD 05 |
| CF-A5 | How is the reversal of a duplicate payment reported to us? | Promised | SDD 02, 04 |
| CF-A6 | Can a payment succeed for a different amount, and is the amount locked? | Promised | SDD 02 |
| CF-A7 | What puts a refund in `PENDING_APPROVAL`, and does it need action from us? | Promised | SDD 04 |
| CF-A8 | Can a UPI payment pending at termination still succeed, and how long after? | Promised | SDD 02 |
| CF-A9 | Is a sole proprietor without GST an individual or a business vendor, and what else is needed? | Half answered: an individual vendor needs no GSTIN (CF-49). The vendor type is promised | SDD 05 |
| CF-A10 | On a live account, can a refund soon after payment be funded from that payment, or only from a recharged balance? | Promised | SDD 04 |
| CF-A11 | After a store has been paid and its balance is short, does the refund wait `ONHOLD` or is it paid and recovered later? | Answered: it waits; we fund it by an adjustment (CF-50) | SDD 04 |
| CF-A12 | Are the gateway and Easy Split charges taken from the store's share or ours, and on what amount is the Easy Split charge calculated? | Mostly answered: our choice, and on the order amount (CF-51). How billing to the store is switched on is to be found in the docs or asked of the Account Manager | SDD 03, 05 |
| CF-A13 | After the eligibility date, how many working days until the store's bank is credited? | Answered: by the store's settlement schedule (CF-47) | SDD 05 |
| CF-A14 | If a settlement to a store's bank fails, does the amount return to the store's balance and is it retried? | Promised | SDD 05 |
| CF-A15 | Can a dispute be simulated on sandbox? | Promised | SDD 09 |

Still open after R3: the maximum-window half of CF-A3, CF-A5, CF-A6, CF-A7, CF-A8, the
vendor type in CF-A9, CF-A10, CF-A14, CF-A15, and the confirmation that the 45-day window
is configured (CF-42).

Cashfree gave the documentation link (CF-48) and said it will coordinate with our Account
Manager on production pricing and onboarding.

## 4. Not asked, by choice

- Instant and on-demand settlement: the plan does not use them.
- Whether holding a store's share until handover fits the RBI settlement rules (CF-07):
  this goes to the lawyer.
- Anything we can try on sandbox: creating a vendor, splitting, setting and moving a
  release date, refunds before and after the split, a simulated settlement, terminating an
  order with a payment pending, blocking a vendor.

## 5. What these answers change

| Topic | Before | Now |
|---|---|---|
| Hold until handover (D-28, P-3) | Unverified | Confirmed in writing: held by default for the whole window (CF-43), split minutes after payment is correct (CF-46), date movable earlier at handover (CF-44). Still to test on sandbox |
| Monday payouts (Q51) | Unverified | A weekly settlement schedule exists and pays on the first working day of the week (CF-47). Set each order's date to handover plus 3 days and put the store on the weekly schedule |
| End of the window (Q3) | Money returns to BookConnect (CF-04) | Cashfree is re-confirming (CF-45, CF-A3) |
| Refund after payout, short balance (D-14) | Asked | The refund waits; we fund it by an adjustment (CF-50) |
| Who pays Cashfree's charges (D-13, D-47) | Asked | Our choice; can be billed to the store (CF-51). The Easy Split charge is on the whole order amount, so it also covers the delivery charge |
| Sole-proprietor KYC | Asked | Individual vendor: PAN and one address proof, no GSTIN (CF-49) |
| Per-store pause (D-63) | Unverified | Block and unblock (CF-13) |
| Refund after payout (D-14) | Unverified | Matches CF-15, CF-17, CF-19 |
| Refund balance (D-54) | Amount unknown | No reserve product; our own recharged ledger (CF-18); amount waits on CF-A10 |
| Fee on refunded payments (D-27) | Unknown if returned | Never returned (CF-22) |
| Easy Split fee (D-47) | Rate unverified | 0.20% on sandbox (CF-27); the store bears it per D-47 |
| Fee method (D-13) | Open | Reported per payment (CF-29) |
| Duplicate payment (D-29) | We refund | Cashfree reverses it (CF-30); we must not refund again |
| Order expiry | Unknown | Over 15 minutes only (CF-31); we terminate at 10 minutes (CF-32) |
| Late payments (D-06, Q38) | Possible | Confirmed real (CF-33) |
| Web checkout or SDK | Open | Cashfree recommends the SDK (CF-34); owner decision still open |
| PCI attestation | Unknown | Not needed (CF-35) |
| Webhook secret rotation | Overlap hoped for | No overlap (CF-36); needs a planned pause |
| Store KYC | PAN and bank assumed | PAN and address proof at least (CF-11) |
