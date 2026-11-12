# Phase 7/8: Cashfree Replies and Fact Record

**Status:** record of what Cashfree has told us, updated 2026-11-11 with the fourth reply. On 2026-11-12 every fact was re-checked against the original text of all four replies; none was wrong, and seven points the record had left out were added as CF-67 to CF-73.
Ticket ID 8774207.
**Authority:** none. This is evidence for the SDDs. Business rules stay in the
[decision register](./PHASE-7-8-decision-register.md).
**Original replies:** [word for word](./PHASE-7-8-cashfree-replies-original.md) (stored 2026-11-12). Every R-tagged fact below must be traceable to that text; if they disagree, the original wins.
**Related:** [first mail](./PHASE-7-8-mail-cashfree.md) ·
[second mail](./PHASE-7-8-mail-cashfree-2.md) ·
[question list](./PHASE-7-8-questions-cashfree.md)
**Sandbox evidence:** what we observed on the Cashfree sandbox on 2026-11-12 (SBX-01 to
SBX-10: termination, session reuse, completion time, signature, duplicate webhook versions)
is kept apart in the [sandbox tests](./PHASE-7-8-cashfree-sandbox-tests.md). It is our
observation, not Cashfree's word.

Cashfree replied twice on 2026-11-10: a support reply to questions 1 to 15 and 20, and a
Tech Team reply to questions 16 to 19. The owner sent a second mail the same day. The Tech
Team's reply to that second mail (R3) was recorded here on 2026-11-10; it answers part of
the list and promises the rest. The owner sent a third mail on 2026-11-11. Cashfree's
fourth reply (R4), recorded on 2026-11-11, answers the remaining points except the
wrong-amount question, which we did not ask again.

---

## 1. How to read the facts

Every Cashfree fact used in an SDD cites an ID from this file. Each fact carries one source
tag. A fact without a tag must not be used.

| Tag | Meaning |
|---|---|
| R1 | Cashfree's first reply (support) |
| R2 | Cashfree's second reply (Tech Team) |
| R3 | Cashfree's third reply (Tech Team), answering our second mail |
| R4 | Cashfree's fourth reply, answering our third mail (2026-11-11) |
| R5 | Cashfree's fifth reply (Tech Team, Shreejoy Chatterjee), answering our fourth and fifth mails (2026-11-12) |
| DOC | Read on Cashfree's public documentation on 2026-11-10 |
| SBX | Seen by us on sandbox on 2026-11-09 |
| ASKED | Not known. Asked in the second mail; no answer yet |

**None of the R1 to R4 or DOC facts has been tested by us on sandbox yet.** Cashfree says
the 45-day window is now configured on sandbox (CF-52), so sandbox testing of Easy Split
can start.

Where a later reply contradicts an earlier one, the later fact says so and is used.

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
| CF-74 | Easy Split FAQ: "If you take no action within that window, the held amount settles to the merchant." "The 45-day period does not reverse the held vendor share to the vendor." "You must initiate the split within the applicable window for that amount to settle to the vendor." So unsplit money comes to us; a split share is paid to the store on its eligibility date (CF-43, CF-45). Answers CF-A3 for our design. | DOC (payments/split/faq, checked 2026-11-12) |
| CF-46 | Calling the Split API a few minutes after the payment, inside the T+1 split delay, is correct. The store's share then stays on hold until its eligibility date. The split delay does not need changing. | R3 |
| CF-47 | After the eligibility date the amount is credited according to the store's settlement schedule, on bank working days, for example T+1 at 11:00 AM. A weekly schedule, which settles on the first working day of the week, is also available. This refines CF-05: there is no weekly deferral release, but a store can be put on a weekly settlement schedule. | R3 |
| CF-48 | Documentation for vendor-level settlement delay: `https://www.cashfree.com/docs/payments/split/settlements/delay/vendor-level`. Not yet read by us. | R3 |
| CF-52 | The 45-day deferred settlement window is now configured on our sandbox account. This closes CF-42. | R4 |
| CF-53 | On production, the 45-day window is not automatic. It needs Cashfree's internal review and approval, asked through the Account Manager after the account is signed up and activated. Approval is not promised. | R4 |
| CF-54 | If split instructions are not given within the configured window, the whole payment settles to us (the merchant); the store's share is not released to the store after 45 days. Our plan splits minutes after payment (CF-46), so this covers only an order we never split. For a split share left at its default date, CF-43 and CF-45 say it settles to the store at that date. Cashfree has not said in so many words that a split share can return to us at the end of the window. Reference: `https://www.cashfree.com/docs/payments/split/settlements/delay/order-level`, not yet read by us. | R4 |
| CF-55 | The settlement eligibility update works per order and per vendor; with several vendors on one order, each vendor's date is updated separately. Split After Payment must be switched on for the account. Confirms CF-43, CF-44 and CF-46. | R4 |
| CF-56 | A weekly schedule is supported for Easy Split vendors: option 11, "Weekly every 1st working day". It is set per vendor at onboarding or changed later, subject to account configuration and approval. Confirms CF-47 and replaces CF-05's "no weekly schedule". | R4 |

### Stores as vendors

| ID | Fact | Source |
|---|---|---|
| CF-10 | Vendors can be created, updated and read by API, and their documents uploaded by API. | R1 |
| CF-11 | KYC: an individual vendor needs PAN and address proof. A business vendor needs GSTIN where applicable. PAN and bank details alone may not be enough. | R1 |
| CF-12 | Vendor activation takes about 10 minutes on sandbox; production time varies. Failure or review statuses: `BANK_VALIDATION_FAILED`, `BENE_CREATION_FAILED`, `ACTION_REQUIRED`, `ON_HOLD`. A vendor stuck in `IN_BENE_CREATION` for over 24 hours is raised with support. | R1 |
| CF-67 | A vendor's bank account details can be changed later through Edit Vendor or Update Vendor Details, and the account can be re-verified as part of the update. | R1 |
| CF-13 | A vendor can be marked Blocked to stop its settlements, and unblocked later. Cashfree may itself put a vendor `ON_HOLD`; its held amount stays in escrow. | R1 |
| CF-14 | A `VENDOR_STATUS_UPDATE` webhook fires when a vendor's status changes. Vendor settlement webhooks exist. | DOC |
| CF-49 | An individual vendor needs PAN and one address proof (Aadhaar, driving licence, passport or voter ID). GSTIN is not required. Which vendor type a sole proprietor without GST should use is still to be confirmed. | R3 |
| CF-57 | A sole proprietor onboarded in their own name can be an individual vendor: PAN, one address proof and bank account details, no GSTIN. A business vendor needs a business PAN and business documents, and a GSTIN once total vendor settlements against one PAN exceed ₹20 lakh in the preceding 12 months. Answers CF-A9. | R4 |
| CF-58 | A failed settlement to a store's bank is reported by the vendor settlement webhooks with a reason. The fix depends on the reason: correct the bank account or IFSC, update KYC documents, or fund a short balance; then the settlement can be retried. Whether the amount waits in the store's balance and whether Cashfree retries by itself is not stated. | R4 |

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
| CF-59 | Refund before the split: paid from our merchant payment balance and adjusted in the next settlement cycle. After the split: debited from our balance and the store's balance in proportion to the split. No recharge is needed if the balances are enough; if either is short, the refund goes `ON_HOLD` until it is funded. Answers CF-A10. | R4 |
| CF-60 | After the store has been settled and its balance is short, it is the customer's refund itself that waits `ON_HOLD`; the customer is not credited meanwhile. We fund it with Adjust Vendor Balance. The store's share is **not** recovered automatically from its later settlements. This contradicts CF-15's last sentence, which is replaced. Whether the refund resumes by itself once funded, and how long it then takes, is not stated. | R4 |
| CF-61 | `PENDING_APPROVAL` means Cashfree's team is reviewing the refund. No action is needed from us; the status updates after the review. Answers CF-A7. | R4 |
| CF-68 | The refund rules apply to full and partial refunds; several partial refunds can be made, within the refundable amount and the available balances. | R1 |
| CF-69 | Six months is the most the refund API allows. The 180-day and 120-day periods in Cashfree's terms and grievance policy belong to other policy contexts and are not interchangeable with it. A refund beyond the API window is reviewed case by case with Cashfree's team. Adds to CF-20. | R1 |
| CF-70 | For any specific failed refund, Cashfree asks for the refund ID so it can review the resolution. Besides another UPI address (CF-21), we can pay the refund from our merchant ledger and then debit the store's balance. Cards are not mentioned. | R1 |
| CF-71 | When a refund is on hold for a short store balance and we fund it by Adjust Vendor Balance, "the refund can proceed" once the balances are available. Cashfree does not say whether it restarts by itself or needs an action from us, or how long it then takes. Adds to CF-60. | R4 |

### Chargebacks

| ID | Fact | Source |
|---|---|---|
| CF-24 | A disputed amount is withheld or debited from our merchant balance, not the vendor's. Vendor settlements continue. We recover from the vendor by a debit adjustment. | R1 |
| CF-25 | There is no separate chargeback or dispute fee. If the dispute is won, the amount is released back. | R1 |
| CF-26 | Dispute APIs (read, accept, submit evidence) and dispute webhooks exist. | DOC |
| CF-72 | How Cashfree routes disputed money (from our balance, not the store's) does not by itself decide who is legally the merchant of record; that depends on the contracts and business arrangement. For the lawyer. | R1 |

### Fees

| ID | Fact | Source |
|---|---|---|
| CF-27 | The Easy Split charge shows as 0.20% on sandbox. Production pricing comes from the Account Manager. The 0% gateway-fee offer does not cover Easy Split. | R1 |
| CF-28 | Vendor payout charges follow our payout pricing and are debited from the merchant's balance. | R1, DOC |
| CF-29 | The `PAYMENT_CHARGES_WEBHOOK` event ("Success Payment TDR") reports the charge for each payment. | R1 |
| CF-51 | We can either bear the payment gateway and Easy Split charges ourselves or bill them to the store. The Easy Split charge is calculated on the order amount, not on the number of splits. How "bill to the store" is set up is not stated. Its calculation basis is contradicted by CF-62. | R3 |
| CF-62 | The gateway and Easy Split charges can be allocated to us or to the store, by billing configuration and commercial agreement. Easy Split carries a per-split charge on top of the standard gateway charge; the exact basis comes from our account's commercials, and we should not assume every Easy Split charge is on the full order amount. This contradicts CF-51's basis; the basis is open until the Account Manager states our commercials. | R4 |
| CF-63 | Production: after signup and activation, standard pricing (`https://www.cashfree.com/payment-gateway-charges/`) applies. Custom pricing is discussed with the Account Manager. | R4 |

### Payments and checkout

| ID | Fact | Source |
|---|---|---|
| CF-30 | If two payments succeed on one order, Cashfree reverses the extra payment to the customer. | R1 |
| CF-31 | `order_expiry_time` must be more than 15 minutes and less than 30 days. Without it an order expires after 30 days. | R2, SBX |
| CF-32 | An order is ended with the Terminate Order API: `PATCH /orders/{order_id}` with `order_status: TERMINATED`. The answer may be `TERMINATION_REQUESTED`. If a payment has already succeeded the order may not terminate, so the order status and payment webhooks are final. | R2, DOC |
| CF-33 | A UPI payment started before expiry and finished after it moves to `SUCCESS`. | R2 |
| CF-34 | Web checkout can open as a redirect, a popup or inline; card details are entered on Cashfree's hosted page. For an Expo app Cashfree recommends `react-native-cashfree-pg-sdk`, which needs `expo-dev-client` and `expo prebuild` and does not run in Expo Go. | R2 |
| CF-35 | A PCI DSS certificate is needed only for server-to-server card integration, not for hosted checkout or the SDK. | R2 |
| CF-73 | Which PCI DSS self-assessment questionnaire (SAQ) applies to hosted checkout should be confirmed by our PCI assessor; Cashfree did not state it. Adds to CF-35. | R2 |
| CF-64 | An automatic duplicate-payment reversal is tracked through the transaction details, payment reports and webhook notifications; no specific event was named. It takes up to 5 calendar days. Answers CF-A5 in part. | R4 |
| CF-65 | Terminating an order does not cancel a payment attempt already started at the bank or network. A UPI attempt started before expiry may still succeed, within that attempt's validity period; no maximum was given. Cashfree advises checking the final payment status and webhooks before fulfilling or cancelling. Confirms CF-33; answers CF-A8 without a time limit. | R4 |
| CF-66 | The full dispute lifecycle cannot be simulated on sandbox; some vendor settlement and reversal statuses can. Confirms CF-40; answers CF-A15. | R4 |

### Webhooks, keys and tooling

| ID | Fact | Source |
|---|---|---|
| CF-36 | Payment webhooks are signed with the API client secret. Only one key pair is active at a time, so old and new keys cannot overlap. Rotation means pausing services, generating new keys and replacing them everywhere. | R2 |
| CF-37 | Webhook delivery is at-least-once. Default retries: 3, at 2, 10 and 30 minutes; configurable per endpoint. A message whose timestamp is over five minutes old should be rejected. | DOC |
| CF-38 | Split, adjustment and terminate calls accept an `x-idempotency-key` header. | DOC |
| CF-39 | Vendor reconciliation: `POST /pg/recon/vendor` returns vendor settlements with settlement ID, time and bank reference number. A settlement reconciliation API also exists. | DOC |
| CF-40 | Sandbox can simulate a payment as `SUCCESS`, `FAILED`, `PENDING` or `USER_DROPPED`, and a vendor settlement as initiated, successful or failed. There is no dispute simulation. | DOC |
| CF-41 | Base URL `https://sandbox.cashfree.com/pg`; API version `2026-01-01`. | SBX, DOC |
| CF-75 | A reused order ID is rejected with HTTP 409, code `order_already_exists` (the spec's only example); `order_id_already_exists` appears nowhere. Answers CF-A23. | DOC (OpenAPI v2026-01-01, checked 2026-11-12) |

### From R5 (2026-11-12)

Quotes are from the [original text](./PHASE-7-8-cashfree-replies-original.md) (R5).

| ID | Fact | Source |
|---|---|---|
| CF-76 | Termination: a transaction the customer started before termination "can still be successful"; no new transaction can start. "If any payment attempt is still pending, the order remains in TERMINATION_REQUESTED until that attempt reaches a final status"; "There is no fixed time limit"; confirm with Get Order. Matches SBX-03. Answers most of CF-A17 | R5 |
| CF-77 | "USER_DROPPED is a terminal status, and such a payment cannot move to SUCCESS." "A payment in NOT_ATTEMPTED status can move to SUCCESS in the Sandbox environment." Live behaviour of `NOT_ATTEMPTED` not stated | R5 |
| CF-78 | Create Order timeout: "you can safely retry it with the same x-idempotency-key". Repeats the docs; key retention and whether a 404 is final are not answered (CF-A27 stays open) | R5 |
| CF-79 | "The payment amount can differ from the order amount when a service fee is collected from the customer." No other case named (CF-A28 partly answered) | R5 |
| CF-80 | Webhooks without a 200 are retried "by default at 2, 10 and 30 minutes"; a custom retry policy can be set in the Merchant Dashboard; a missed payment webhook can be resent with "Batch Resend" in the dashboard. No response timeout given; the retry timestamp question is not answered (CF-A21 stays open) | R5 |
| CF-81 | "Rate limits are applied per minute based on your IP and account ID", shown in response headers and under Developers > Rate Limits in the Merchant Dashboard. No numbers given (CF-A29: owner to read the dashboard) | R5 |
| CF-82 | "two successful payments cannot be simulated on a single order in the Sandbox environment" (CF-A25 closed; tests use recorded answers) | R5 |
| CF-83 | A second success on one order "is reversed automatically by Cashfree"; automatic refunds are listed in the dashboard under Payment Gateway > Transactions > Refunds > Auto Refunds. Does not say how to refund one chosen payment by API (CF-A35 open) or what `UNRECONCILED_AUTO_REFUND` means (CF-A16 open) | R5 |
| CF-84 | A refund that "cannot be processed even after the retries ... continues to show as PENDING to you, and our team handles it further from our end." (Partly answers CF-A31; R1's alternatives for a failed UPI refund, CF-21 and CF-70, are not mentioned again) | R5 |
| CF-85 | `CANCELLED`: when we cancel a refund that is on hold or pending approval (Cancel Refund API or dashboard), or when Cashfree or the bank cancels it. The amount returns to our and the vendor's balances and a refund webhook is sent. It is final; to refund again, create a new refund with a new `refund_id` once the balance is enough | R5 |
| CF-86 | "A failed vendor settlement is retried automatically, and the amount remains with Cashfree until it is settled." Answers CF-A14 | R5 |
| CF-87 | A refund on hold "resumes automatically once the vendor balance is sufficient"; on-hold refunds are re-checked about every hour; status moves `ONHOLD` → `PENDING` → `SUCCESS`; track with Get Refund. "the refund webhook is sent only for the final status (SUCCESS or CANCELLED), and not for ONHOLD or PENDING"; check the status before creating another refund. Answers CF-A32 | R5 |
| CF-88 | "Vendor credit adjustments and chargebacks are funded from your settlement balance and not from the Refund Wallet." Confirm a credit by the adjustment ID, the vendor's ledger and balance, and the merchant ledger report. Answers CF-A34's balance part. Whether "settlement balance" is the "merchant ledger" of R1/R4 (CF-72) and how it is topped up is not stated | R5 |
| CF-89 | Each vendor bank-account verification debits "A fixed fee plus GST" from our balance; it shows in the merchant ledger as a vendor onboarding entry and in invoices. No API named. Answers CF-A33 | R5 |
| CF-90 | Easy Split charges and the payment methods on the live account "depend on your account's commercials and onboarding"; the Account Manager assists. CF-A12 and CF-A34's go-live part move to the Account Manager | R5 |

## 3. Questions from the second mail

The IDs are kept so the SDDs' references stay valid.

| ID | Question | Status after R4 | Affects |
|---|---|---|---|
| CF-A1 | Which eligibility date applies if we never update an order? | Answered: CF-43 | SDD 05 |
| CF-A2 | Can an eligibility date be moved earlier as well as later? | Answered: CF-44 | SDD 05 |
| CF-A3 | At the eligibility date, is the share settled to the store; and at the maximum window, to us? | Answered for the store at the date (CF-45). For the window's end, R4 answered only the case where no split was made: all to us (CF-54). For a share we did split, CF-43 and CF-45 point to the store being paid at the end of the window. **Answered by docs 2026-11-12 (CF-74)**; a sandbox test is still worth running | SDD 05 |
| CF-A4 | With the split made minutes after payment at T+1, does the store's share stay held until its eligibility date? | Answered: CF-46, CF-55 | SDD 05 |
| CF-A5 | How is the reversal of a duplicate payment reported to us? | Partly answered: transaction details, reports and webhooks, within 5 calendar days (CF-64). No event name | SDD 02, 04 |
| CF-A6 | Can a payment succeed for a different amount, and is the amount locked? | Not asked again, by choice: the server compares the amount whatever Cashfree answers | SDD 02 |
| CF-A7 | What puts a refund in `PENDING_APPROVAL`, and does it need action from us? | Answered: CF-61 | SDD 04 |
| CF-A8 | Can a UPI payment pending at termination still succeed, and how long after? | Answered yes, with no time limit given (CF-65) | SDD 02 |
| CF-A9 | Is a sole proprietor without GST an individual or a business vendor, and what else is needed? | Answered: individual vendor (CF-57) | SDD 05 |
| CF-A10 | On a live account, can a refund soon after payment be funded from that payment, or only from a recharged balance? | Answered: from the payment balance if it is enough (CF-59) | SDD 04 |
| CF-A11 | After a store has been paid and its balance is short, does the refund wait `ONHOLD` or is it paid and recovered later? | Answered: the customer's refund waits; we fund it; no automatic recovery from the store (CF-50, CF-60) | SDD 04 |
| CF-A12 | Are the gateway and Easy Split charges taken from the store's share or ours, and on what amount is the Easy Split charge calculated? | Who pays: our choice (CF-62). Basis: reopened by CF-62; ask the Account Manager | SDD 03, 05 |
| CF-A13 | After the eligibility date, how many working days until the store's bank is credited? | Answered: by the store's settlement schedule; weekly option 11 exists (CF-47, CF-56) | SDD 05 |
| CF-A14 | If a settlement to a store's bank fails, does the amount return to the store's balance and is it retried? | Partly answered: webhook with reason, fix the cause, then retry (CF-58). Where the money waits and who retries is not stated | SDD 05 |
| CF-A15 | Can a dispute be simulated on sandbox? | Answered: no (CF-66) | SDD 09 |

Still open after R4:
- What happens to a store's share we did split, if it reaches the end of the window
  (CF-A3). Answered by the Easy Split FAQ on 2026-11-12 (CF-74); a sandbox test is still
  worth running.
- Whether a refund held `ON_HOLD` resumes by itself once funded, and how long it takes
  (CF-60).
- Where a failed settlement's money waits, and who retries (CF-A14).
- The duplicate-reversal event name (CF-A5).
- The Easy Split charge basis (CF-62).
- Whether production gets the 45-day window (CF-53).

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

### After R5 (2026-11-12). Not yet carried into the SDDs.

| Topic | Before R5 | After R5 |
|---|---|---|
| Refund webhooks (SDD 04) | A refund webhook for each change was assumed | Sent only for `SUCCESS` and `CANCELLED` (CF-87); `ONHOLD` and `PENDING` must be seen by polling Get Refund |
| Refund on hold (SDD 04, CF-A32) | Unknown whether it resumes | Resumes by itself about hourly once the balance is enough (CF-87); never create a second refund while one is on hold or pending |
| Refund that cannot be paid out (SDD 04, CF-A31) | Unknown for cards | Stays `PENDING`; Cashfree handles it (CF-84). SDD 04 needs an admin alert for a refund pending too long |
| Cancelled refund (SDD 04) | Not covered | Money returns to the balances; a new refund needs a new `refund_id` (CF-85) |
| Funding vendor credits and chargebacks (SDD 04, 05; D-14, D-54) | Merchant ledger, possibly recharged through the Refund Wallet | Settlement balance, not the Refund Wallet (CF-88). How to top up the settlement balance is still unknown |
| Failed vendor settlement (SDD 05) | Unknown | Retried automatically; money stays with Cashfree (CF-86) |
| Terminated order (SDD 02 §11.2, §12) | Poll continues | Confirmed: stays `TERMINATION_REQUESTED` while an attempt is pending, no time limit (CF-76); `USER_DROPPED` is final (CF-77) |
| Missed payment webhook | Poll only | Also Batch Resend in the dashboard (CF-80), a manual tool |
| Bank verification fee (SDD 03) | Unknown where shown | Merchant ledger "vendor onboarding" entry and invoices, no API (CF-89) |

### After R4 (2026-11-11). These rows are not yet carried into the SDDs.

| Topic | Before R4 | After R4 |
|---|---|---|
| End of the window (Q3, D-89; SDD 03, 05) | Money returns to BookConnect (CF-04) | Uncertain. R4 says the money returns to us only when no split was made (CF-54). Because we split minutes after payment, the default date points to the **store** being paid at the end of the window, even with no handover (CF-43, CF-45). SDD 03 and 05 assume the opposite. Test on sandbox; SDD 05 must cover both outcomes |
| 45 days on production (D-28) | Assumed | Needs Cashfree's approval after activation (CF-53). The plan needs a fallback if production gets a shorter window |
| Refund after payout, short balance (D-14; SDD 04, 05) | Recovered from later settlements (CF-15) | The customer's refund waits until we fund it; nothing is recovered from the store automatically (CF-60). BookConnect funds it, then recovers from the store itself |
| Easy Split fee basis (D-47; SDD 03, 05) | Whole order amount (CF-51) | Per-split charge on top of the gateway charge; basis set by our commercials (CF-62) |
| Refund balance (D-54) | Waited on CF-A10 | A quick refund is paid from the payment balance if enough (CF-59); the recharge is needed only for shortfalls |
| Sole-proprietor stores | Vendor type open | Individual vendor; GSTIN only for a business vendor above ₹20 lakh (CF-57) |
| Late UPI payments (D-06) | Confirmed real | Confirmed again, no time limit (CF-65). The design must never assume a cut-off |
| Duplicate reversal (D-29) | Asked | Up to 5 days, seen through reports and webhooks (CF-64) |
| Weekly payouts (Q51) | R3 said available | Confirmed for Easy Split vendors, per vendor (CF-56) |
| Sandbox testing | Waiting | Can start (CF-52) |

### After R3 (2026-11-10)

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
