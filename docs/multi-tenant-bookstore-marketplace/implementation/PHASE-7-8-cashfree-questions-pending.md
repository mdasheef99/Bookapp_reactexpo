# Phase 7/8: Cashfree questions waiting to be sent

**Purpose:** one place to collect every open question for Cashfree, so they go out together
in one mail. Started 2026-11-11 at the owner's request.
**How it works:** add new questions here as they come up. When the owner says "send", I draft
the mail from this list for the owner to send (I never send it). When Cashfree replies, each
answer becomes a CF fact in the [fact record](./PHASE-7-8-cashfree-replies.md) and the question
moves to "Answered" below.
**Sources:** Cashfree's [original replies](./PHASE-7-8-cashfree-replies-original.md) (word for word), the [names list](./PHASE-7-8-cashfree-names-needed.md) (items Cashfree's docs do
not answer), [SDD 02 review round 1](./PHASE-7-8-sdd02-review-r1.md), and questions from
earlier mails that were only partly answered. The whole mail thread as sent is in the
[thread file](./PHASE-7-8-cashfree-thread-original.md).
**State 2026-11-12:** 20 questions open. The [fourth mail](./PHASE-7-8-mail-cashfree-4.md)
asking all of them is drafted and reviewed, not sent.
**Update 2026-11-12 (sandbox):** the [sandbox tests](./PHASE-7-8-cashfree-sandbox-tests.md)
answered CF-A19 and CF-A20 (moved to Answered) and narrowed CF-A17, CF-A18, CF-A21,
CF-A22 and CF-A26. 18 questions open. The mail is to be cut down to the questions only
Cashfree can answer.
**Update 2026-11-12 (mails):** the owner sent the [fourth mail](./PHASE-7-8-mail-cashfree-4.md)
with 9 questions (text as sent stored there). The questions were then reviewed by Codex
Sol and searched in the docs again by Haiku; the result is the table below. The
[fifth mail](./PHASE-7-8-mail-cashfree-5.md) (7 questions, reviewed by Sol) is drafted,
not sent. The tables further down keep the original wording and checks.

## Where each open question stands (2026-11-12)

| ID | Where | Note |
|---|---|---|
| CF-A17 | Asked: mail 4, Q1 | Docs (payment lifecycle): a pending payment that succeeds while termination is processing moves the order to success; SBX-03 saw the same. Sol: the design does not need a time limit (it keeps reconciling) |
| CF-A27 | Asked: mail 4, Q2 | Docs: a timed-out create can be retried with the same key; `x-idempotency-replayed` header exists. Key retention not documented |
| CF-A21 | Asked: mail 4, Q3 (response time) and mail 5, Q3 (retries keep the first timestamp, five-minute check) | SBX-10 |
| CF-A29 | Asked: mail 4, Q4 | Docs give the headers' meaning ("per minute"), not these two limits |
| CF-A25 | Withdrawn in mail 5 | We test it ourselves: start two attempts while the order is unpaid, then simulate both as successful (not yet tried) |
| CF-A14 | Asked: mail 4, Q6 | |
| CF-A31 | Asked: mail 4, Q7 | |
| CF-A12 | Asked: mail 4, Q8 | |
| CF-A34 | Asked: mail 4, Q9 (UPI and cards only) and mail 5, Q6 (how the merchant ledger is recharged) | R1 already says chargebacks and vendor credits use the merchant ledger |
| CF-A35 (new) | Mail 5, Q1 | How to refund one particular payment by API: the Create Refund request has no `cf_payment_id` (checked on the live spec 2026-11-12) |
| CF-A16 | Mail 5, Q2 (narrowed to `UNRECONCILED_AUTO_REFUND`) | Docs show `PAYMENT_AUTO_REFUND` with reason "Multiple payments were performed against same order." |
| CF-A32 | Mail 5, Q4 | R4: "Once the required balances are available, the refund can be processed" does not say it resumes by itself |
| CF-A28 | Mail 5, Q5 | Docs: amounts may differ when a service fee is collected from the customer |
| CF-A33 | Mail 5, Q7 (verification charge only) | Easy Split charge and tax are in the split-details API (`split_service_charge`, `split_service_tax`) |
| CF-A18 | Test ourselves | SBX-04 used the API; still to test through the real hosted checkout, and a session after expiry |
| CF-A30 | Test ourselves (owner) | Docs list a PG Reconciliation API and a Ledger Report; check they cover every movement |
| CF-A22 | Dropped | SDD 02 uses only the dashboard endpoint, no `notify_url`. Webhook version is chosen per endpoint in the dashboard; `x-idempotency-key` comes only from version 2025-01-01 |
| CF-A26 | Dropped | SBX-05: status decides, not the completion time; our own sort decides the order |
| CF-A24 | Answered by docs | "Cashfree signs webhooks using the client secret that was active at the time the event was sent" (Payloads and Signatures page): keep the old secret for checking until in-flight webhooks are done |

"Sandbox" means we can also find the answer ourselves by testing; asking may save time.

## Waiting to be sent

| ID | Question (plain words, ready for the mail) | Why we need it | Can we test it? | Affects |
|---|---|---|---|---|
| CF-A16 | When two payments succeed on the same order, which one do you reverse: the one that completed later? (Docs checked 2026-11-12: not stated; the refund API and `AUTO_REFUND_STATUS_WEBHOOK` show `PAYMENT_AUTO_REFUND` naming the refunded `cf_payment_id`. Also: what does `UNRECONCILED_AUTO_REFUND` mean? Per D-109 the answer no longer blocks orders.) How does the reversal show in `GET /orders/{order_id}/refunds` (for example `refund_type` `PAYMENT_AUTO_REFUND`), and is it final only when `refund_status` is `SUCCESS`? | We must keep the payment you keep, and know when the reversal is really done (review B3, B5; names D9; completes CF-A5) | No | SDD 02 §9.3, §13.2 |
| CF-A17 | After you terminate an order (`TERMINATION_REQUESTED` or `TERMINATED`), can a payment shown as `FAILED`, `USER_DROPPED` or `NOT_ATTEMPTED` still become `SUCCESS` later? Does `GET /orders/{order_id}/payments` always list every attempt, including one started at the bank but not finished? Does `TERMINATION_REQUESTED` always end as `TERMINATED`, and how quickly? | Decides how long we keep checking a closed order (review B1) | Partly | SDD 02 §9.3, §11, §12 |
| CF-A18 | If a payment attempt fails or the customer leaves, can the customer pay again with the **same** `payment_session_id`? How long is a session valid? What happens if a session is opened on an order that is paid, expired or terminated? | Our design keeps one Cashfree order per checkout and reuses its session (names B14) | Yes | SDD 02 §8 |
| CF-A21 | When you retry a webhook, do the `x-idempotency-key`, `x-webhook-timestamp` and signature stay the same as the first delivery? Within how many seconds must our endpoint answer, and which HTTP codes count as delivered? | De-duplication, and our five-minute age check (names F6, F8, F9) | Partly | SDD 02 §10 |
| CF-A22 | If an order has a `notify_url` and the account also has a dashboard webhook endpoint, are payment webhooks sent to both? Is the dashboard's test message signed? | Avoid missed or doubled deliveries (names B7, F10) | Yes | SDD 02 §10 |
| CF-A24 | When we generate new Payment Gateway keys, do the old keys stop working immediately, or is there an overlap? What happens to webhooks already in flight? | Our key-change procedure (names N8, A1) | No (we would lose our sandbox keys) | SDD 02 §13.4 |
| CF-A25 | On sandbox, how can we make two successful payments on one order, or a payment for a different amount? Can `POST /simulate` move a payment to `PENDING` first and to `SUCCESS` later? | Testing duplicates, wrong amounts and late payments (names H3, H4) | Partly | SDD 02 tests |
| CF-A26 | In `GET /orders/{order_id}/payments`, is `payment_completion_time` empty while a payment is pending, and is the list in any fixed order? | Choosing the counted payment by completion time (names D7, D11) | Yes | SDD 02 §9.3 |
| CF-A27 | If our `POST /orders` call times out, can the order still have been created even though `GET /orders/{order_id}` then answers 404? Is a 404 final? How long is an `x-idempotency-key` remembered, and does a retry with the same key replay the first answer, or is `order_expiry_time` checked again (it may by then be less than 15 minutes away)? | Docs (checked 2026-11-12) only say a timed-out request can be retried safely with the same key; we must never release books while an order might exist (review S2-02, S2-22) | Partly (sandbox) | SDD 02 §7.2, §11.6 |
| CF-A28 | On an INR order, can a payment's `payment_amount` ever differ from `order_amount`, have more than two decimals, or be in another currency? If so, can we refund exactly that amount through the refund API? | Docs (checked 2026-11-12) say order amounts have at most two decimals, at least ₹1, and a refund may not exceed the payment, but say nothing about the payment side (review S2-09) | No | SDD 02 §13.1 |
| CF-A29 | What are the rate limits for `GET /orders/{order_id}/refunds` (Get All Refunds for an Order) and for terminating an order (`PATCH /orders/{order_id}`), in sandbox and production? Your rate-limit page shows Get Refund at 60 a minute in sandbox but 30 in production: is that right? | Our shared per-minute read budget must stay under every limit (review S2-13) | Partly (headers) | SDD 02 §11.5 |
| CF-A30 | Is there an API or report for our own merchant ledger: its balance and a statement of every movement (payments, refunds, adjustments, charges)? Or only the dashboard? | Reconciling our own balance (docs: only the vendor recon report/API `POST /pg/recon/vendor`) | No | SDD 05 |
| CF-A31 | If a refund to a card fails (card closed or blocked), where does the money go, how are we told, and what should we do? | Customer refund promise (R1 covers only failed UPI refunds, CF-21, CF-70) | No | SDD 04 |
| CF-A32 | After we fund a vendor balance (Adjust Vendor Balance) or recharge our ledger, does an `ON_HOLD` refund restart by itself, and how soon? | Refund follow-up work (CF-71; docs say auto-processed only for the Refund Wallet) | Yes (sandbox) | SDD 04 |
| CF-A33 | Where is the vendor bank-account verification charge reported (API, report or webhook)? | Charging it to the right place (R1 gives only "as per pricing") | No | SDD 03 |
| CF-A34 | Can a live account start with UPI and cards only? Is the Refund Wallet (recharged via a virtual bank account, credits within 30 minutes per the help page) the same as the "merchant ledger" in R1, and the same on live? | Going live and refund funding (asked in our second mail, not answered) | No | SDD 04, go-live |

## Carried over from earlier mails (partly answered)

| ID | What is still open | Affects |
|---|---|---|
| CF-A12 | On what amount is the Easy Split charge calculated? (R3: order amount; R4: per split, check commercials; docs FAQ: "0.2% per split", base not stated. To the Account Manager) | SDD 03, 05 |
| CF-A14 | For a vendor settlement that failed and has been fixed, is it retried automatically, and where does the money wait meanwhile? (R4: depends on the failure reason; the settlements help page says a failed merchant settlement returns to the nodal account and is retried next cycle, but does not mention vendors) | SDD 05 |

## Check of 2026-11-12 (mails and docs, before drafting the fourth mail)

Every open question was checked one by one against Cashfree's four replies and against
their docs (three Haiku searches; the key pages re-opened by me; mail draft reviewed by
Sonnet). Result: 2 answered (moved below), 10 partly answered, 10 not answered. The
partly answered ones are asked in the [fourth mail draft](./PHASE-7-8-mail-cashfree-4.md)
with what the docs already say, so Cashfree only confirms or completes them.

| ID | Status | What the mails and docs already give | Mail 4 question |
|---|---|---|---|
| CF-A16 | Partly | R1: "the additional payment amount is reversed"; R4: tracked via transaction details, reports, webhooks, up to 5 calendar days; docs list `PAYMENT_AUTO_REFUND`, `UNRECONCILED_AUTO_REFUND` without meaning | 1 |
| CF-A17 | Partly | R2/R4: a UPI attempt started before expiry can still succeed; termination does not cancel it at the bank. Help page: a "Failed" transaction may rarely later move to "Success" | 2 |
| CF-A19 | Answered by sandbox (SBX-01, SBX-02) | Terminate Order page: "order might not get terminated", check `order_status`; response codes listed, none for this case | 3 |
| CF-A18 | Not answered | Elements FAQ only: sessions single-use, 30 minutes (that product) | 4 |
| CF-A27 | Partly | Create Order page: a timed-out request can be retried with the same key | 5 |
| CF-A28 | Not answered | R1 said the Technical team was checking; never answered | 6 |
| CF-A26 | Not answered | Spec: completion time = "when the payment reaches its terminal state" | 7 |
| CF-A20 | Answered by sandbox (SBX-08) | Webhooks page shows `$timestamp.$payload`; Payloads and Signatures page and all code samples join with nothing | 8 |
| CF-A21 | Partly | Reliability page: default retries at 2, 10, 30 minutes; non-2xx is a failure | 9 |
| CF-A22 | Partly | Webhooks page: `NOTIFY_URL` default config vs custom URLs | 10 |
| CF-A24 | Partly | R2: one key pair at a time, no overlap; only in-flight webhooks open | 11 |
| CF-A29 | Not answered | Rate-limit page (Production and Sandbox tabs) confirms Get Refund 30 / 60; refunds list and terminate not listed | 12 |
| CF-A25 | Not answered | Simulate Payment can set SUCCESS, FAILED, PENDING, USER_DROPPED | 13 |
| CF-A14 | Partly | See carried-over table | 14 |
| CF-A32 | Partly | See above | 15 |
| CF-A31 | Not answered | R1 covers UPI only | 16 |
| CF-A30 | Partly | Vendor recon report and API exist; nothing for our own ledger | 17 |
| CF-A12 | Partly | See carried-over table | 18 |
| CF-A33 | Not answered | R1 pricing line only | 19 |
| CF-A34 | Partly | Refunds help page describes the Refund Wallet recharge | 20 |

## Answered

| ID | Answer | Source |
|---|---|---|
| CF-A3 | Money we never split goes to us when the window ends: "If you take no action within that window, the held amount settles to the merchant." and "You must initiate the split within the applicable window for that amount to settle to the vendor." (matches R1 point 2 and R4 point 2). A share we did split is paid to the store on its eligibility date, which can never be later than the window's end (R3; CF-43, CF-45). Design rule: always send the split, and set the release date ourselves before day 45. A sandbox test of a split share left untouched to day 45 is still worth running. | Easy Split FAQ (payments/split/faq), checked 2026-11-12; CF-74 |
| CF-A19 | Paid order: HTTP 400 `order_already_paid` ("order has already been paid."), order stays `PAID`. Unpaid order: 200 `TERMINATION_REQUESTED`, then `TERMINATED` within 3 seconds; a second terminate gives 400 `request_invalid` ("order termination already requested"). | Sandbox test SBX-01, SBX-02 (2026-11-12) |
| CF-A20 | Signature = Base64(HMAC-SHA256(client secret, `x-webhook-timestamp` + raw body)), no dot; timestamp in milliseconds (13 digits). 3 of 3 deliveries matched. | Sandbox test SBX-08 (2026-11-12) |
| CF-A23 | The documented code for a reused order ID is `order_already_exists` (HTTP 409); `order_id_already_exists` appears nowhere in the API spec. Treat any 409 "already exists" the same. | OpenAPI spec v2026-01-01, checked 2026-11-12; CF-75 |
