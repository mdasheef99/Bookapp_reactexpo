# Phase 7/8: Cashfree questions waiting to be sent

**Purpose:** one place to collect every open question for Cashfree, so they go out together
in one mail. Started 2026-11-11 at the owner's request.
**How it works:** add new questions here as they come up. When the owner says "send", I draft
the mail from this list for the owner to send (I never send it). When Cashfree replies, each
answer becomes a CF fact in the [fact record](./PHASE-7-8-cashfree-replies.md) and the question
moves to "Answered" below.
**Sources:** the [names list](./PHASE-7-8-cashfree-names-needed.md) (items Cashfree's docs do
not answer), [SDD 02 review round 1](./PHASE-7-8-sdd02-review-r1.md), and questions from
earlier mails that were only partly answered.

"Sandbox" means we can also find the answer ourselves by testing; asking may save time.

## Waiting to be sent

| ID | Question (plain words, ready for the mail) | Why we need it | Can we test it? | Affects |
|---|---|---|---|---|
| CF-A16 | When two payments succeed on the same order, which one do you reverse: the one that completed later? (Docs checked 2026-11-12: not stated; the refund API and `AUTO_REFUND_STATUS_WEBHOOK` show `PAYMENT_AUTO_REFUND` naming the refunded `cf_payment_id`. Also: what does `UNRECONCILED_AUTO_REFUND` mean? Per D-109 the answer no longer blocks orders.) How does the reversal show in `GET /orders/{order_id}/refunds` (for example `refund_type` `PAYMENT_AUTO_REFUND`), and is it final only when `refund_status` is `SUCCESS`? | We must keep the payment you keep, and know when the reversal is really done (review B3, B5; names D9; completes CF-A5) | No | SDD 02 §9.3, §13.2 |
| CF-A17 | After you terminate an order (`TERMINATION_REQUESTED` or `TERMINATED`), can a payment shown as `FAILED`, `USER_DROPPED` or `NOT_ATTEMPTED` still become `SUCCESS` later? Does `GET /orders/{order_id}/payments` always list every attempt, including one started at the bank but not finished? Does `TERMINATION_REQUESTED` always end as `TERMINATED`, and how quickly? | Decides how long we keep checking a closed order (review B1) | Partly | SDD 02 §9.3, §11, §12 |
| CF-A18 | If a payment attempt fails or the customer leaves, can the customer pay again with the **same** `payment_session_id`? How long is a session valid? What happens if a session is opened on an order that is paid, expired or terminated? | Our design keeps one Cashfree order per checkout and reuses its session (names B14) | Yes | SDD 02 §8 |
| CF-A19 | When we terminate an order that already has a successful payment, what do you return: HTTP 200 with `order_status: PAID`, or an error (which code)? And for an order already expired or terminated? | Our expiry worker decides from your answer (names E2, E3) | Yes | SDD 02 §12.1 |
| CF-A20 | Webhook signature: is the signed text the `x-webhook-timestamp` value directly followed by the raw body, with no dot between them? Is the timestamp in milliseconds? (Your pseudocode shows `$timestamp.$payload`; your code samples join them with nothing.) | We must verify every webhook exactly (names F3a, F4) | Yes | SDD 02 §7.2 |
| CF-A21 | When you retry a webhook, do the `x-idempotency-key`, `x-webhook-timestamp` and signature stay the same as the first delivery? Within how many seconds must our endpoint answer, and which HTTP codes count as delivered? | De-duplication, and our five-minute age check (names F6, F8, F9) | Partly | SDD 02 §10 |
| CF-A22 | If an order has a `notify_url` and the account also has a dashboard webhook endpoint, are payment webhooks sent to both? Is the dashboard's test message signed? | Avoid missed or doubled deliveries (names B7, F10) | Yes | SDD 02 §10 |
| CF-A23 | When an order ID is reused, which error code do you send: `order_already_exists` or `order_id_already_exists`? | Retry safety when creating an order (names B11) | Yes | SDD 02 §7.2 |
| CF-A24 | When we generate new Payment Gateway keys, do the old keys stop working immediately, or is there an overlap? What happens to webhooks already in flight? | Our key-change procedure (names N8, A1) | No (we would lose our sandbox keys) | SDD 02 §13.4 |
| CF-A25 | On sandbox, how can we make two successful payments on one order, or a payment for a different amount? Can `POST /simulate` move a payment to `PENDING` first and to `SUCCESS` later? | Testing duplicates, wrong amounts and late payments (names H3, H4) | Partly | SDD 02 tests |
| CF-A26 | In `GET /orders/{order_id}/payments`, is `payment_completion_time` empty while a payment is pending, and is the list in any fixed order? | Choosing the counted payment by completion time (names D7, D11) | Yes | SDD 02 §9.3 |

## Carried over from earlier mails (partly answered)

| ID | What is still open | Affects |
|---|---|---|
| CF-A3 | At the maximum window's end, what happens to a split that was made: is it settled to us or to the store? (R4 answered only the case with no split) | SDD 05 |
| CF-A12 | On what amount is the Easy Split charge calculated? (CF-62 reopened the basis; to the accounts team) | SDD 03, 05 |
| CF-A14 | When a settlement to a store's bank fails, where does the money wait until it is retried? | SDD 05 |

## Answered

None yet.
