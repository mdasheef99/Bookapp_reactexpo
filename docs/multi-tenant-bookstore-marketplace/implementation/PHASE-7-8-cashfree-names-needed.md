# Phase 7/8: Cashfree names SDD 02 needs

**Status:** working list, 2026-11-11. Docs lookup done the same day: see
[Answers from Cashfree's docs](#answers-from-cashfrees-docs-2026-11-11) at the end. Docs
answers are not yet CF facts; sandbox (SBX) items stay open. Each name is
to be found in Cashfree's API reference, confirmed on sandbox where marked, and then
recorded in the [fact record](./PHASE-7-8-cashfree-replies.md) with a CF ID.
**Already recorded, for context:** terminate (`PATCH /orders/{order_id}`, CF-32) and
`PAYMENT_CHARGES_WEBHOOK` (CF-29). Sonnet checked this list against SDD 02 for completeness
on 2026-11-11; its 10 gaps are added.
**Questions for Cashfree** arising from this list are queued in
[PHASE-7-8-cashfree-questions-pending.md](./PHASE-7-8-cashfree-questions-pending.md).
**Purpose:** SDD 02 §2 and §16 item 1 list these as missing. Building cannot start until
each "needed" row has a confirmed answer.

Columns: what we need; what SDD 02 uses it for; my expected name (from general knowledge,
**unconfirmed**); where to confirm (API = Cashfree's API reference, SBX = sandbox test).

## A. Calling the API

| # | What we need | Used for (SDD 02) | Expected, unconfirmed | Confirm |
|---|---|---|---|---|
| A1 | Header names for our app ID and secret | §7.1 adapter | `x-client-id`, `x-client-secret` | API |
| A2 | Header name for the API version | §7.1 (CF-41 gives the value `2026-01-01`) | `x-api-version` | API |
| A5 | Error answer shape: field names for code, type and message, and HTTP statuses used | §7.2 typed results | `code`, `type`, `message` | API |
| A6 | Rate limits and the "too many requests" answer | §7.2 timeout and `unreachable`, §11.3 | HTTP 429 | API |
| A7 | Time format and time zone of every time field | §4.2 `provider_time`, §9.3 time order | ISO 8601 with offset | API |
| A8 | The answer to wrong or old keys, and the cheapest read to prove new keys work | §13.4 step 4 | HTTP 401; a `GET /orders/{id}` read | API, SBX |

## B. Create order (§8 step 2)

| # | What we need | Used for | Expected, unconfirmed | Confirm |
|---|---|---|---|---|
| B1 | Endpoint | `createOrder` | `POST /orders` | API |
| B2 | Our order ID field, allowed characters and maximum length | §4.1 `provider_order_id` (`bc_` + 32 hex characters), §7.2 | `order_id` | API |
| B3 | Amount field and its format (rupees with 2 decimals?) | §7.3 paise conversion | `order_amount` | API |
| B4 | Currency field | `INR` | `order_currency` | API |
| B5 | Customer fields: which are required, and phone format | Contact snapshot | `customer_details.customer_id`, `customer_phone`, `customer_name`, `customer_email` | API |
| B6 | Return URL field, and how our order ID is placed in it | §8 return | `order_meta.return_url` with `{order_id}` | API, SBX |
| B7 | Webhook URL per order, or only in the dashboard | §10 endpoint | `order_meta.notify_url` | API |
| B8 | Limiting methods to UPI and card, and the exact values | D-05, §16 item 4 | `order_meta.payment_methods`, e.g. `upi,cc,dc` | API, SBX |
| B9 | Expiry field and its time format | CF-31, §5 | `order_expiry_time`, ISO 8601 with offset | API |
| B10 | Answer fields: Cashfree's order reference, session, status, expiry | §4.1 columns | `cf_order_id`, `payment_session_id`, `order_status`, `order_expiry_time` | API |
| B11 | The error when an order ID is reused | AD-03 | Error code to be found | API, SBX |
| B12 | Whether create order accepts `x-idempotency-key` (CF-38 names only split, adjustment and terminate) | §7.2, PA-06 | To be found | API |
| B13 | Minimum and maximum order amount, and the error for a refused amount | §8 step 3 `start_failed` | To be found | API |
| B14 | Retrying on the same order: after a `FAILED` or `USER_DROPPED` attempt, does the order stay `ACTIVE`, can the customer pay again with the same `payment_session_id`, and how long is a session valid? What happens if a session is used on a paid or terminated order? | §4.1 one payment per checkout, §8, Q37, PA-04, worked example 2. **The design's core assumption** | Expected yes, to be confirmed | API, SBX |

## C. Read order (§9.2)

| # | What we need | Used for | Expected, unconfirmed | Confirm |
|---|---|---|---|---|
| C1 | Endpoint | `getOrder` | `GET /orders/{order_id}` | API |
| C3 | Whether the read order answer includes `payment_session_id`, so a repeated create (B11) can recover the session | §7.2, AD-03, PA-06 | To be found | API |
| C2 | Every order status value | §4.4 `order_status`, §9.3 step 5 | `ACTIVE`, `PAID`, `EXPIRED`, `TERMINATED`, `TERMINATION_REQUESTED` | API, SBX |

## D. Read payments (§9.2, the core of verification)

| # | What we need | Used for | Expected, unconfirmed | Confirm |
|---|---|---|---|---|
| D1 | Endpoint for all payments of an order | `getPayments` | `GET /orders/{order_id}/payments` | API |
| D3 | Payment ID field | `cf_payment_id` | `cf_payment_id` | API |
| D4 | Every payment status value | §7.3 mapping | `SUCCESS`, `PENDING`, `FAILED`, `USER_DROPPED`, `NOT_ATTEMPTED`, `CANCELLED`, `VOIDED`, `FLAGGED` | API, SBX |
| D5 | Amount and currency fields of a payment | §9.3 amount check | `payment_amount`, `payment_currency` | API |
| D6 | Method group field and all its values: UPI, credit and debit card, and also netbanking, wallets and pay-later, which map to `other` | §4.2 `method_group`, §9.3 step 6, VE-13 | `payment_group`: `upi`, `credit_card`, `debit_card`, `net_banking`, `wallet`, `pay_later` | API, SBX |
| D7 | Time fields of a payment, for every status, not only success | §4.1 `paid_at`, §4.2 `provider_time`, §9.3 time order | `payment_time`, `payment_completion_time` | API |
| D8 | Whether the answer contains card, bank or UPI-handle details we must strip | §4.4 snapshot, SE-03 | `payment_method` object | API |
| D9 | How a duplicate payment that Cashfree reversed shows up: a status, a refund entry, or only in reports | §13.2 watch | Unknown | API, SBX, or ask Cashfree |
| D10 | Whether an order's refunds can be read (`GET /orders/{order_id}/refunds`), since a reversal may show only there | §13.2 watch | To be found | API, SBX |
| D11 | Whether the payments list is paged or ordered, and its maximum size | §9.2, §9.3 time order | To be found | API |

## E. Terminate order (§12)

| # | What we need | Used for | Expected, unconfirmed | Confirm |
|---|---|---|---|---|
| E2 | The answer when a payment already succeeded: status and error code | `terminate_refused_for_success`, TE-04, TE-05 | Error code to be found | API, SBX |
| E3 | The answer when the order is already terminated or expired | Replays | To be found | API, SBX |

## F. Webhooks (§10)

| # | What we need | Used for | Expected, unconfirmed | Confirm |
|---|---|---|---|---|
| F1 | Event names: payment success, failure, user-dropped | §10.3 | `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK` | API |
| F3 | Signature header and timestamp header | §10.1 | `x-webhook-signature`, `x-webhook-timestamp` | API |
| F3a | The timestamp's format and unit (epoch seconds, milliseconds or ISO), as used in the signed string and the five-minute check | §10.1, §10.5, WH-02 | Epoch milliseconds, to be confirmed | API, SBX |
| F4 | Signing formula | `verifyWebhook` | Base64 of HMAC-SHA256 over timestamp + raw body, with the client secret | API, SBX |
| F5 | Webhook version header and how to choose the version; needed because the body layout in F7 depends on it | F7, §10.3 | `x-webhook-version` | API |
| F6 | The field or header that identifies one message | §10.2 message key | To be found | API, SBX |
| F7 | Where our order ID and the payment ID sit in the body | §4.3 `payment_id`, §10.3 lookup and `unknown_order` | `data.order.order_id`, `data.payment.cf_payment_id` | API |
| F8 | Whether retries carry a fresh timestamp | §10.5 | Unknown | SBX |
| F9 | Whether the endpoint must answer within a time limit, and which HTTP codes count as delivered | §10.1 | To be found | API |
| F10 | How the webhook endpoint is registered (dashboard, per account or per order) on sandbox, and what the dashboard's test message sends, signed or not | §10.1, B7 | To be found | API, SBX |

## G. Web checkout in the app (§8 step 4, D-90)

| # | What we need | Used for | Expected, unconfirmed | Confirm |
|---|---|---|---|---|
| G1 | The web SDK package or script and its exact version | App | `@cashfreepayments/cashfree-js` | API |
| G2 | How to load it for sandbox | App | `load({ mode: "sandbox" })` | API |
| G3 | How to open checkout with a session, and the redirect, popup and inline options | App | `checkout({ paymentSessionId, redirectTarget })` | API, SBX on a real phone (D-90) |
| G4 | What the return to our page carries, if anything | §8 return | Our order ID in the return URL | SBX |

## H. Sandbox test data (all tests)

| # | What we need | Used for | Confirm |
|---|---|---|---|
| H1 | Test UPI IDs for success, failure and pending | PO, VE, TE tests | API |
| H2 | Test cards for success and failure | PA-04, VE-04 | API |
| H3 | How to make a payment stay pending, then succeed late | Worked example 4, PO-03, TE-04 | API, SBX |
| H4 | How to make two successes on one order, and a wrong amount, if possible at all | RX2-10, DU-01 to DU-03 | API, SBX, or ask Cashfree |
| H5 | How to make a success by a method other than UPI or card on sandbox | VE-13 | API, SBX |

## I. For later SDDs, not SDD 02

Refund create and read, refund statuses and webhooks (SDD 04); split, vendor, eligibility
date and settlement calls and webhooks (SDD 05); reconciliation and settlement reports
(SDD 03); dispute webhooks (SDD 09); the production base URL and a request-ID header for support
(production setup, later); the single-payment read `GET /orders/{order_id}/payments/{cf_payment_id}`
(optional; SDD 02 reads the whole list). Listed here only so they are not forgotten.

## Answers from Cashfree's docs (2026-11-11)

Read only from Cashfree's **current** Payment Gateway reference (API version `2026-01-01`,
the "latest" section, which matches CF-41). Older versions (2025-01-01, 2023-08-01) and
the Payouts, Subscription and partner pages were **not** used. Page links were taken from
Cashfree's own index (`/docs/llms.txt` and `/docs/_llms/payments-apis.txt`). Docs answers
are **not** CF facts yet: they go into the fact record only after the owner agrees, and
SBX items need a sandbox test.

**Cross-check (2026-11-11):** a separate Haiku agent answered the same questions on its
own, without seeing this table, reading the official spec
(`https://www.cashfree.com/docs/openapi/payments/v2026-01-01.yaml`) in sections plus the
same doc pages. Every row below agrees with its answers, except four points it raised. I
re-read the pages for those four and fixed the rows: F1 event names, F4 signature formula,
A5 error fields and H1 test UPI IDs. Both reads came through a web tool that summarises
pages, so exact values should still be checked once against sandbox answers.

**Sources** (all under `https://www.cashfree.com/docs/`; `…` = `api-reference/payments`):
S1 `…/latest/orders/create` · S2 `…/latest/orders/get-order.md` ·
S3 `…/latest/orders/terminate-order.md` · S4 `…/latest/payments/get-payments-for-an-order.md` ·
S5 `…/latest/payments/get-payment-by-id.md` · S6 `…/latest/refunds/get-all-refunds-for-an-order.md` ·
S7 `…/errors.md` · S8 `api-reference/authentication.md` · S9 `…/rate-limits.md` ·
S10 `…/latest/payments/webhooks` · S11 `…/latest/webhooks/signature-verification.md` (same text
as `payments/online/webhooks/signature-verification`) · S12 `…/latest/webhooks/idempotency.md` ·
S13 `…/latest/webhooks/configure.md` · S14 `api-reference/webhooks/reliability-and-operations.md` ·
S15 `…/latest/webhooks/troubleshooting.md` · S16 `…/latest/webhooks/security-checklist.md` ·
S17 `…/data-to-test-integration.md` · S18 `…/latest/simulation/simulate-payment.md` ·
S19 `payments/online/web/redirect` · S20 `…/latest/overview.md` ·
S21 `api-reference/webhooks/payloads-and-signatures.md`.

| # | Docs answer | Source | Still open |
|---|---|---|---|
| A1 | `x-client-id`, `x-client-secret`. Sandbox and production keys are separate; Payment Gateway allows **one key pair at a time** | S1, S8 | Whether new keys cancel the old ones at once (N8): ask or SBX |
| A2 | `x-api-version`, required, `YYYY-MM-DD`, default `2026-01-01`. Optional `x-request-id` for support | S1, S20 | — |
| A5 | API errors: `message`, `code`, `type` (and `help`). Types seen on our calls: `invalid_request_error`, `authentication_error`, `rate_limit_error`, `idempotency_error`, `api_error` (the errors page lists more). HTTP 400, 401, 404, 409, 422, 429, 500. The errors page's `error_code`, `error_description`, `error_source`, `error_reason` are the fields of a **failed payment's** `error_details`, not of an API error | S1, S3, S7 | — |
| A6 | 429 with headers `x-ratelimit-limit`, `-remaining`, `-retry` (1–59 s), `-type` (`ip` or `app_id`). Per minute, per account: create order 200 prod / **30 sandbox**; get order 400 / **60**; get payments 100 / **30**; terminate not listed | S1, S9 | N4 |
| A7 | ISO 8601 with offset; examples use `+05:30` ("We store timestamps in IST") | S1, S5 | — |
| A8 | Wrong keys: HTTP 401, `code: request_failed`, `type: authentication_error`, message "authentication Failed" | S3, S8 | Cheapest proof read: SBX |
| B1 | `POST /orders` | S1 | — |
| B2 | `order_id`, 3–45 characters, letters, digits, `_` and `-` only. Ours (`bc_` + 32 hex = 35) fits | S1 | — |
| B3 | `order_amount`, number, **minimum 1**, up to 2 decimals (e.g. 10.15) | S1 | — |
| B4 | `order_currency`, INR if empty | S1 | — |
| B5 | Required `customer_details` with `customer_id` (3–50, **alphanumeric**) and `customer_phone` (10 digits; `+` prefix for international). Optional `customer_name`, `customer_email` (3–100) | S1 | N5 |
| B6 | `order_meta.return_url`, max 250 characters, Cashfree sends a GET. **No `{order_id}` placeholder**: we put our own order ID in the URL | S1, S19 | — |
| B7 | Yes: `order_meta.notify_url` per order (HTTPS, max 250), besides dashboard endpoints | S1, S10 | Whether both fire when both are set: SBX |
| B8 | `order_meta.payment_methods`, comma list; values include `cc`, `dc`, `upi` (also `ccc`, `ppc`, `nb`, `app`, `paylater`, …). So `upi,cc,dc` | S1 | That checkout shows only these: SBX |
| B9 | `order_expiry_time`, ISO 8601; no limits stated | S1 | Min/max expiry: SBX |
| B10 | `cf_order_id`, `payment_session_id`, `order_status`, `order_expiry_time`, `created_at` all in the answer | S1 | — |
| B11 | HTTP 409, `code: order_already_exists` ("order with same id is already present"). The errors page also lists `order_id_already_exists` | S1, S7 | Which code sandbox really sends: SBX |
| B12 | **Yes**: create order accepts `x-idempotency-key`, **UUID format**; the same key with a different body gives 422 `idempotency_error` | S1 | N1 |
| B13 | Minimum 1 rupee; no maximum stated; refused amount `order_amount_invalid` | S1, S7 | Maximum is an account limit; ask if needed |
| B14 | Partly confirmed: "For a single `order_id`, Cashfree allows multiple payment attempts until one succeeds", each with its own `cf_payment_id`. The order stays `ACTIVE` until a success | S12, S2 | Reusing the **same session** after a failure, session lifetime, and a session used on a paid or terminated order are **not documented**: SBX |
| C1 | `GET /orders/{order_id}` | S2 | — |
| C2 | `ACTIVE`, `PAID`, `EXPIRED` ("No transaction can be initiated for an EXPIRED order"), `TERMINATED`, `TERMINATION_REQUESTED` | S2 | — |
| C3 | **Yes**, the answer includes `payment_session_id`. Data kept for the current and previous financial year | S2 | — |
| D1 | `GET /orders/{order_id}/payments` | S4 | — |
| D3 | `cf_payment_id`, **string** | S4, S5 | — |
| D4 | `SUCCESS`, `NOT_ATTEMPTED`, `FAILED`, `USER_DROPPED`, `VOID`, `CANCELLED`, `PENDING`. **No `FLAGGED`; it is `VOID`, not `VOIDED`** | S4, S5 | N2 |
| D5 | `payment_amount`, `payment_currency` (also `order_amount`, which "can differ" if a service fee is charged) | S4 | — |
| D6 | `payment_group`, 16 values: `upi`, `upi_credit_card`, `upi_ppi`, `upi_ppi_offline`, `credit_card`, `debit_card`, `prepaid_card`, `credit_card_emi`, `debit_card_emi`, `net_banking`, `wallet`, `pay_later`, `cardless_emi`, `bank_transfer`, `paypal`, `cash` | S4, S5 | N3 |
| D7 | `payment_time` = when the payment **started**; `payment_completion_time` = when it reached a final state | S4, S5 | Whether completion time is empty while pending: SBX |
| D8 | Yes, `payment_method` holds the masked card number (last 4), card network and bank, UPI ID, payer account number and IFSC, netbanking account and phone; also `error_details`, `bank_reference`, `auth_id` | S4 | — (SDD 02 already strips these) |
| D9 | Not documented. Likely visible as a refund with `refund_type` `PAYMENT_AUTO_REFUND` or `UNRECONCILED_AUTO_REFUND` (D10) | S6 | Ask Cashfree or SBX |
| D10 | **Yes**: `GET /orders/{order_id}/refunds`, an array. `refund_status`: `SUCCESS`, `PENDING`, `PENDING_APPROVAL`, `CANCELLED`, `ONHOLD`, `REJECTED` | S6 | — |
| D11 | A plain array; no paging, order or size limit stated | S4 | SDD 02 must not rely on list order |
| E2 | Not documented as an error. Docs: "order might not be terminated - confirm with the order_status in response"; a payment that "moved to success" can stop termination | S3 | N6; SBX |
| E3 | Not documented | S3 | SBX |
| F1 | `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK` (and `PAYMENT_CHARGES_WEBHOOK`, CF-29), the same in versions 2026-01-01 and 2025-01-01. The general all-products page shows a shortened `PAYMENT_SUCCESS` example; the Payment Gateway page wins | S10, S21 | Real value: SBX |
| F3 | `x-webhook-signature`, `x-webhook-timestamp`; also `x-webhook-version`, `x-webhook-attempt`, `x-idempotency-key` | S10, S16 | — |
| F3a | Not stated; examples are 13 digits (`1617695238078`), so very likely **milliseconds** | S11 | SBX |
| F4 | Base64 of HMAC-SHA256 with the client secret over the timestamp **directly followed by** the **raw** body, no separator. The general page writes `x-webhook-timestamp + rawBody`; the Payment Gateway page's `$timestamp.$payload` uses PHP's `.` join operator, not a literal dot; every code sample (Node, Python, PHP, Go, Java) joins with no separator | S11, S21 | N7: one sandbox check |
| F5 | `x-webhook-version`; versions 2026-01-01, 2025-01-01, 2023-08-01, chosen from a drop-down when adding the endpoint | S10, S13 | — |
| F6 | `x-idempotency-key` header, from webhook version 2025-01-01 on (shown in the 2026-01-01 sample as a 44-character Base64 value): "a unique hashed value for each webhook payload". Cashfree also says to de-duplicate payments on `cf_payment_id` | S14, S15, S12 | Same value on retries: SBX |
| F7 | `data.order.order_id`, `data.payment.cf_payment_id`, `data.payment.payment_status`, `payment_amount`, `payment_currency`, `payment_group`, `payment_time`; top level `type`, `event_time` | S10 | — |
| F8 | Not documented | — | SBX |
| F9 | Answer 2xx (one page says 200 only, so we answer 200). No time limit stated. Default retries: 3, at 2, 10 and 30 minutes; can be set up to 10. At-least-once; order not guaranteed | S14, S15 | — |
| F10 | Dashboard → Developers → Add Webhook Endpoint, per environment; pick version and events. Sandbox allows http. Cashfree sends a test POST when the endpoint is added; whether it is signed is not stated | S13, S15 | Test-message signing: SBX |
| G1 | npm `@cashfreepayments/cashfree-js` (version not stated), or script `https://sdk.cashfree.com/js/v3/cashfree.js` | S19 | Pin a version at build |
| G2 | npm: `await load({ mode: "sandbox" })`; script tag: `Cashfree({ mode: "sandbox" })` | S19 | — |
| G3 | `cashfree.checkout({ paymentSessionId, redirectTarget })`: `_self` (default), `_blank`, `_top` redirect; `_modal` popup; a page element = inline | S19 | Real phone: D-90 |
| G4 | Nothing documented is added to the return URL. Cashfree says to put the order's ID there yourself and always check the order on the server, not trust the redirect | S19 | SBX |
| H1 | UPI `testsuccess@gocash` (success), `testfailure@gocash` (failure), `testuserdropped@gocash` (customer abandons), `testexpired@gocash` (session times out), `testdeclineuser@gocash` (customer cancels), plus about 18 more failure kinds (bank declined, insufficient funds, wrong PIN, timeouts, fraud, …). **No pending UPI ID** | S17 | — |
| H2 | Success cards, e.g. `4706131211212123` (Visa debit), OTP `111000`, expiry `03/2028`, CVV `123`. **No failure card listed** | S17 | Use `testfailure@gocash` or H3 |
| H3 | `POST /simulate`: `entity: PAYMENTS`, `entity_id` = `cf_payment_id`, `entity_simulation.payment_status` one of `SUCCESS`, `FAILED`, `PENDING`, `USER_DROPPED` | S18 | Whether PENDING then later SUCCESS works: SBX |
| H4 | Not documented | — | Ask Cashfree |
| H5 | Netbanking "TEST Bank" (code `3333`) and a generic test wallet; these need an order **without** our UPI/card limit | S17 | SBX |

### Notes that change SDD 02 (applied 2026-11-11 at the owner's request)

All eight are applied to the [SDD 02 parts](./phase-7-8-payments-fulfillment/02-cashfree-payments/02-0-overview.md):
N1, N5 and N7 in §7.2; N2 and N3 in §7.3 and §17 items 4 and 10; N4 in §11.5 and §17 item 11;
N6 in §12.1; N8 in §13.4. The open sandbox and Cashfree questions are SDD 02 §16 items 7 to 12.

- **N1. Idempotency keys must be UUIDs.** SDD 02 §7.2 uses `terminate:<payment id>` (from
  CF-38), but the docs say UUID format. Use a UUID derived from the payment ID instead.
  Create order also accepts a key, so §7.2 can send one there too, beside the 409 fallback.
- **N2. Payment statuses.** Map `VOID` and `CANCELLED` (not `VOIDED`; there is no
  `FLAGGED`), and decide `NOT_ATTEMPTED`. Unknown still maps to `pending`.
- **N3. Method groups.** `upi_credit_card` and `upi_ppi` are UPI payments. §17 item 4 must
  say whether they count as `upi` or `other`. `prepaid_card` and the EMI groups are `other`.
- **N4. Sandbox rate limits are low.** Get payments allows 30 a minute on sandbox. A
  20-second poll uses 3 a minute per live checkout, so about 10 checkouts at once. Fine for
  tests; §11 should share one read across poll, return check and webhook, and back off on 429.
- **N5. Customer ID.** "Alphanumeric": send the user's UUID **without dashes**, as for
  `provider_order_id`. The phone is required, so checkout needs a 10-digit phone.
- **N6. Termination refused.** Cashfree may answer with the order still `PAID` (or
  `ACTIVE`) rather than an error. §12 should decide from the returned `order_status`, then
  read payments, and not rely on an error code.
- **N7. Signature formula.** Timestamp then raw body, no separator (F4). Confirm with one
  real sandbox webhook before the endpoint goes live.
- **N8. Key rotation.** One key pair at a time: §13.4 must confirm whether new keys cancel
  the old ones immediately, because webhooks and in-flight calls would then fail together.
