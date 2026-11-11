# Phase 7/8: Cashfree sandbox tests (2026-11-12)

**Status:** run on 2026-11-12 (about 03:30 to 04:45 IST) at the owner's request, on the
Cashfree **sandbox** (test money only). The keys were read from `.env.local` by the
test scripts and never shown or stored. The raw log of every API call (73 calls, session
tokens removed) is in
[PHASE-7-8-cashfree-sandbox-raw-2026-11-12.json](./PHASE-7-8-cashfree-sandbox-raw-2026-11-12.json).
**Authority:** these are observations, not Cashfree statements. Where Cashfree's own
words exist ([fact record](./PHASE-7-8-cashfree-replies.md)), they win. Where an SBX fact
answers an open question in the [pending list](./PHASE-7-8-cashfree-questions-pending.md),
that is noted there.

## How the tests were run

- API version header `2025-01-01`, base `https://sandbox.cashfree.com/pg`.
- Payments were started with Pay Order (UPI collect, `testsuccess@gocash` /
  `testfailure@gocash`). In the sandbox these stay `NOT_ATTEMPTED` on their own, so the
  outcome was set with **Simulate Payment** (`POST /simulate`: `SUCCESS`, `PENDING`,
  `USER_DROPPED`). Simulating `FAILED` was refused (`entity_simulation_payment_error_code_failed`:
  it needs a `payment_error_code`), so a real `FAILED` attempt was not tested.
- Webhooks were received by a temporary function on the **dev** Supabase project
  (`ahntbtktjjmvfosgkmgn`, function `sbx-cf-webhook-probe`, no database access, no
  secrets; it only logs headers and the raw body). It was given as the order's
  `order_meta.notify_url`. Signatures were checked locally with the client secret.
- **Caveat for all results:** simulated outcomes may not behave exactly like real banks.
  Treat them as strong evidence of how Cashfree's system reacts, not as a guarantee.

## Results

| ID | What we saw | Answers |
|---|---|---|
| SBX-01 | Terminating an order that is **PAID**: HTTP 400, `code` `order_already_paid`, message "order has already been paid.". The order stays `PAID`. | CF-A19 (paid case) |
| SBX-02 | Terminating an unpaid `ACTIVE` order: HTTP 200, `order_status` `TERMINATION_REQUESTED`; a `GET` 3 seconds later showed `TERMINATED`. Terminating it again: HTTP 400, `code` `request_invalid`, message "order termination already requested". | CF-A19 (terminated case); part of CF-A17 |
| SBX-03 | Order with a `PENDING` payment, then terminated: HTTP 200 `TERMINATION_REQUESTED`, still `TERMINATION_REQUESTED` 3 seconds later. The payment was then simulated to `SUCCESS`: the order became **`PAID`**. So termination does not stop a late success. | Part of CF-A17 (confirms the risk; how it behaves on live is still asked) |
| SBX-04 | After an attempt left `NOT_ATTEMPTED` or simulated `USER_DROPPED`, Pay Order with the **same** `payment_session_id` was accepted and created a second payment; simulating it `SUCCESS` made the order `PAID`. On an order that is `PAID` or `TERMINATED`, the same session is refused: HTTP 400, `code` `order_inactive`, message "order is no longer active". Not tested: a real `FAILED` attempt, and how long a session lives. | CF-A18 (mostly) |
| SBX-05 | `payment_completion_time` is `null` while a payment is `NOT_ATTEMPTED`, but is **filled as soon as the payment is `PENDING`** (and updated again on `SUCCESS`); it is also filled for `USER_DROPPED`. In all three orders with two attempts, `GET /orders/{id}/payments` listed the newest attempt first (by `payment_time`). | CF-A26 (do not read a filled completion time as "finished"; always check `payment_status`. List order seen 3 times only; not a promise) |
| SBX-06 | Every response carried `X-Ratelimit-Limit: 30000`, `X-Ratelimit-Remaining`, `X-Ratelimit-Type: app_id`, `X-Ratelimit-Retry: 0`. No per-endpoint or per-minute figures. | CF-A29 not answered by headers |
| SBX-07 | A refund returned `refund_status` `PENDING`; a few seconds later the refunds list showed `SUCCESS`, `refund_arn` `Test_ARN`, `refund_type` `MERCHANT_INITIATED`. The sandbox also accepted a refund on an order whose only payment was `NOT_ATTEMPTED` (order `sbx_paid_2ade6de73f`), so the sandbox is **not a reliable guide to refund rules**. An `ON_HOLD` refund could not be produced. | CF-A32 not answered |
| SBX-08 | Webhook signature = Base64(HMAC-SHA256(client secret, `x-webhook-timestamp` + raw body)), joined with **no dot**. The version with a dot did not match. `x-webhook-timestamp` is 13 digits (milliseconds). Checked on 3 of 3 deliveries. | CF-A20 answered |
| SBX-09 | With `notify_url` on the order, **each event was delivered twice**: once with `x-webhook-version` `2021-09-21` and once with `2023-08-01`, each with its own body and signature. The bodies differ: `cf_payment_id` is a **number** in 2021-09-21 and a **string** in 2023-08-01, and only 2023-08-01 has `payment_gateway_details`. Headers seen: `x-webhook-attempt` (`1`), `x-webhook-signature`, `x-webhook-timestamp`, `x-webhook-version`; there was **no `x-idempotency-key`**. Deliveries came about 2 seconds after the payment succeeded. | Part of CF-A21 and CF-A22 |
| SBX-10 | Our probe answered HTTP 500 on purpose for one order. Only the `2023-08-01` delivery was retried; the `2021-09-21` one was not. Retries came about 1, 3 and 8 minutes after the first try (attempts 2, 3, 4 seen up to 23:14 UTC; the docs' default of 2, 10, 30 minutes did not match). Each retry carried the **same** `x-webhook-timestamp` and the **same** signature as the first try, with `x-webhook-attempt` counting up. So the timestamp is the original send time: a check that rejects messages older than 5 minutes would have rejected attempt 4. | Part of CF-A21 (retries: same timestamp and signature) |

## Not tested

- **CF-A22 dashboard half:** whether payments are also sent to an endpoint set in the
  Cashfree dashboard. Needs the owner to add the probe URL in the sandbox dashboard
  (Developers → Webhooks); changing dashboard settings is the owner's action.
- **CF-A25:** two successful payments on one order. Once an order is `PAID`, the session
  is refused (SBX-04), so this cannot be done through the API.
- **CF-A27, CF-A28:** a timed-out Create Order and odd payment amounts cannot be produced.

## What this changes for the design (to be taken into SDD 02 when it is next revised)

1. Webhook check: use timestamp + raw body with no dot (SBX-08).
2. De-duplication cannot rely on `x-idempotency-key` (SBX-09). Either accept only one
   `x-webhook-version`, or de-duplicate on the event type plus `cf_payment_id` plus status.
   Read `cf_payment_id` as text, since its type differs by version.
3. The expiry worker must treat `order_already_paid` as "paid" (SBX-01), and treat
   `request_invalid` "already requested" as "termination in progress" (SBX-02).
4. A filled `payment_completion_time` does not mean finished (SBX-05).
5. The five-minute age check must not reject retries: the timestamp stays at the first
   send time (SBX-10). Either drop the age check, widen it, or accept old timestamps when
   the signature is valid and the event is not a duplicate.

## Clean-up

The probe function `sbx-cf-webhook-probe` was deleted from the dev project on 2026-11-12
(after the retry check), at the owner's request. No database or storage changes were made.
