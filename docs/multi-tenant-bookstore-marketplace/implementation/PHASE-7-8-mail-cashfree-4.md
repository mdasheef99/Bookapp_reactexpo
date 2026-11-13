# Phase 7/8: Fourth Mail to Cashfree (draft)

**Status:** SENT 2026-11-12 by the owner, in a shorter form: 9 questions, not the 20 in the
draft below. The text as sent is stored word for word in the section "As sent" at the end
of this file, and wins over the draft. The draft is kept as the record of how the questions
were prepared.
**Authority:** none. It asks the 20 open questions in the
[pending list](./PHASE-7-8-cashfree-questions-pending.md) (CF-A12, A14, A16 to A22, A24 to
A34). CF-A3 and CF-A23 are left out because Cashfree's docs answer them. Every "your
documentation says" line below was checked by me against the live page on 2026-11-12.
**Tone:** our last mail (11 Nov) said every point had been answered, so this one presents
the questions as new ones that came up while building, and says plainly where an earlier
answer left a gap (Easy Split charge basis, failed vendor settlement).
**Review:** Sonnet reviewed it on 2026-11-12 (no misquotes found). Fixes applied the same
day at the owner's approval: honest opening, Q1, Q8, Q9, Q14, Q18 and Q20 reworded. Two
suggestions were not taken: dropping Q7/Q13 (sandbox shows one run, not a guarantee) and
re-adding CF-A3 (the Easy Split FAQ answers it).

---

Subject: Re: Request to activate Easy Split and integration questions for a marketplace
(Ticket 8774207, Merchant ID 11352134)

Dear Cashfree Team,

Greetings, and thank you once again for configuring the 45-day deferred settlement window
on our sandbox account. We have now started building and testing our integration.

In our last mail we said that every point had been answered. As we have moved into detailed
design and testing, a few further questions have come up. We checked your documentation
first, and where it answers part of a question we say so, so that you only need to confirm
or complete it. We are grateful for any help you can give.

The questions in Parts 1 and 2 affect our payment design most directly, so a reply on those
first would help us the most. The rest can follow whenever convenient.

**Part 1: Orders and payments**

1. Duplicate payments on one order. Your earlier reply confirmed that an additional
   successful payment is reversed to the customer within about 5 calendar days. In the
   Get All Refunds for an Order API we can see `refund_type` values `PAYMENT_AUTO_REFUND`
   and `UNRECONCILED_AUTO_REFUND`, and the `cf_payment_id` of the payment refunded.
   Could you please confirm:
   - Your earlier reply says the "additional" payment is reversed. Is that always the one
     that completed later?
   - What do `PAYMENT_AUTO_REFUND` and `UNRECONCILED_AUTO_REFUND` each mean?

2. Payments after we terminate an order. Your earlier reply explained that a UPI payment
   started before termination may still succeed, and your help pages note that a "Failed"
   transaction may, in rare cases, later move to "Success". Could you please confirm:
   - Can a payment shown as `USER_DROPPED` or `NOT_ATTEMPTED` also become `SUCCESS` later?
   - Does Get Payments for an Order always list every attempt, including one that was
     started at the bank but has not finished?
   - Does `TERMINATION_REQUESTED` always end as `TERMINATED`, and roughly how quickly?

3. Terminating an order that is already paid. Your Terminate Order page says the order
   "might not get terminated" if a transaction has moved to success, and asks us to check
   `order_status` in the response. What exactly does the API return in that case: HTTP 200
   with `order_status` `PAID`, or an error (and which code)? And what does it return for an
   order that is already expired or terminated?

4. Paying again with the same session. If a payment attempt fails or the customer leaves
   the checkout, can the customer try again with the same `payment_session_id`, or must we
   create a new one? How long is a session valid? Your Elements FAQ says sessions are
   single-use and expire after 30 minutes; does that also apply to the standard checkout
   and the React Native SDK? What happens if a session is opened for an order that is
   paid, expired or terminated?

5. Create Order timeouts. Your Create Order page says a request that times out can be
   safely retried with the same `x-idempotency-key`. Could you please confirm:
   - After a timeout, can the order exist even if Get Order returns 404 at first? Is a 404
     final?
   - How long is an idempotency key remembered?
   - Does a retry with the same key return the first response, or is the request checked
     again (for example `order_expiry_time`, which may by then be less than 15 minutes
     away)?

6. Payment amount. For an INR order, can a payment's `payment_amount` ever differ from
   `order_amount`, have more than two decimals, or be in another currency? If it can, can
   we refund exactly that amount through the refund API? (In your first reply you
   mentioned the Technical team was checking the amount-mismatch behaviour; we would be
   grateful for that answer here.)

7. Payment list details. In Get Payments for an Order, is `payment_completion_time` empty
   while a payment is pending? Is the list returned in any fixed order?

**Part 2: Webhooks, keys and rate limits**

8. Webhook signature. Your Webhooks page (payments/webhooks) shows the signed text as
   `$timestamp.$payload`, while your Payloads and Signatures page, and all the code samples,
   join the `x-webhook-timestamp` value and the raw body with nothing between them. We will
   follow the latter unless you advise otherwise. Could you please confirm this, and that
   the timestamp is in milliseconds (the examples have 13 digits)?

9. Webhook retries. Your documentation says the default policy retries at 2, 10 and 30
   minutes and counts any non-2xx response as a failure, while another line says delivery
   is retried when our endpoint does not return 200. Could you please confirm:
   - Within how many seconds must our endpoint respond?
   - Does any 2xx response count as delivered, or only 200?
   - On a retry, are `x-idempotency-key`, `x-webhook-timestamp` and the signature the same
     as on the first delivery?

10. Webhook endpoints. Your documentation describes the default `NOTIFY_URL` configuration
    for the `notify_url` sent with an order, and separately configured dashboard URLs. If an
    order has a `notify_url` and the account also has a dashboard webhook URL, is a payment
    webhook sent to both? Is the dashboard's test webhook signed in the same way?

11. Key regeneration. Thank you for explaining that only one key pair is active at a time
    and that there is no overlap period. One detail remains: when we generate new keys,
    webhooks that are already queued or being retried, are they signed with the old key or
    the new one?

12. Rate limits. Your rate-limit page lists Get Refund at 60 per minute in sandbox and 30
    in production. Could you please confirm that this is correct, and tell us the limits
    for Get All Refunds for an Order (`GET /orders/{order_id}/refunds`) and Terminate Order
    (`PATCH /orders/{order_id}`), which the page does not list?

**Part 3: Sandbox testing**

13. Your Simulate Payment API lets us set a payment to `SUCCESS`, `FAILED`, `PENDING` or
    `USER_DROPPED`. Is there a way on sandbox to create two successful payments on one
    order, or a payment for a different amount? Can a payment be set to `PENDING` first and
    moved to `SUCCESS` later?

**Part 4: Easy Split, refunds and balances**

14. Failed vendor settlement. Thank you for explaining that a failed vendor settlement is
    reported through the Vendor Settlement Webhooks with its reason, and that the next step
    depends on that reason. Your settlements help page says that a failed merchant
    settlement returns to Cashfree's nodal account and is retried automatically in the next
    cycle. For a vendor settlement that failed for a reason we have since fixed (for example
    corrected bank details), is it retried automatically in the vendor's next settlement
    cycle, and where does the money wait meanwhile (for example in the vendor's balance)?

15. Refund on hold, after funding. Your earlier replies explained that a refund stays
    `ON_HOLD` until the merchant and vendor balances are sufficient, and then "can proceed".
    Your end-customer refunds page says that after a Refund Wallet recharge, the refund is
    auto-processed. After we fund a vendor balance through Adjust Vendor Balance (or recharge
    our merchant ledger), does an `ON_HOLD` refund restart automatically, and how soon? Or
    must we take an action?

16. Failed card refunds. Your earlier reply explained what can be done when a UPI refund
    fails (another UPI ID with the customer's consent, or a refund from our merchant
    ledger). What happens when a refund to a card fails, for example because the card is
    closed or blocked: where does the money go, how are we told, and what should we do?

17. Merchant balance statement. Your documentation describes the Vendor Reconciliation
    report and API (`POST /pg/recon/vendor`) for vendor-wise details. Is there an API or
    report for our own merchant ledger: its current balance and a statement of every
    movement (payments, refunds, adjustments and charges)? Or is the dashboard the only
    source?

**Part 5: Charges and going live**

18. Easy Split charge basis. We had understood from your Tech Team's reply that the Easy
    Split charge is calculated on the order amount; your later reply asked us to refer to
    our account-specific commercials, and your FAQ mentions 0.2% per split. To be sure we
    calculate it correctly: is the charge calculated on the full order amount or on the
    vendor's split amount? If this depends on our account's commercials, we are happy to
    take it up with our Account Manager; please just let us know whom to contact.

19. Bank account verification charge. Where is the vendor bank account verification charge
    reported to us: in an API, a report or a webhook?

20. Going live. Can our live account start with UPI and cards only? Also, your refunds help
    page describes recharging the Refund Wallet through a linked virtual bank account, with
    the credits shown within 30 minutes. Is this the same as the "merchant ledger" mentioned
    in your earlier replies, and does it work the same way on a live account?

Thank you very much for your time and patience. Your answers so far have shaped our design,
and these last points will help us complete it correctly. As before, a written reply is
most useful to us, and we are happy to discuss any of these on a call if that is easier.

Warm regards,
Md Asheef
Conceptsphere Technologies LLP
Merchant ID 11352134

## As sent (2026-11-12, word for word as pasted by the owner)

The owner shared the text without the subject line or send time. Mapping: 1 = CF-A17,
2 = CF-A27, 3 = CF-A21 (response time), 4 = CF-A29, 5 = CF-A25, 6 = CF-A14, 7 = CF-A31,
8 = CF-A12, 9 = CF-A34 (UPI and cards only).

```text
Dear Cashfree Team,
Greetings, and thank you once again for configuring the 45-day deferred settlement window on our sandbox account. We have now started building and testing our integration.
 As we have moved into detailed design and testing, a few further questions have come up.
Part 1: Orders and payments

1. Payments after we terminate an order. Your earlier reply explained that a UPI payment started before termination may still succeed, and your help pages note that a “Failed” transaction may, in rare cases, later move to “Success”. Could you please confirm whether a payment shown as `USER_DROPPED` or `NOT_ATTEMPTED` can also become `SUCCESS` after the order is terminated? Also, does `TERMINATION_REQUESTED` always end as `TERMINATED`, and roughly how quickly?
2. Create Order timeouts. Your Create Order page says a request that times out can be safely retried with the same `x-idempotency-key`. Could you please confirm:
   * After a timeout, can the order exist even if Get Order returns 404 at first? Is a 404 final?
   * How long is an idempotency key remembered?

Part 2: Webhooks and rate limits

3. Webhook response time. Within how many seconds must our endpoint respond to a webhook before it is treated as a failure and retried?
4. Rate limits on a live account. Your rate-limit page does not list Get All Refunds for an Order (`GET /orders/{order_id}/refunds`) or Terminate Order (`PATCH /orders/{order_id}`). What are their limits on a production account?

Part 3: Sandbox testing

5. Your Simulate Payment API lets us set a payment to `SUCCESS`, `FAILED`, `PENDING` or `USER_DROPPED`. Is there a way on sandbox to create two successful payments on one order, so that we can test how the automatic reversal of the extra payment is reported?

Part 4: Easy Split and refunds

6. Failed vendor settlement. Thank you for explaining that a failed vendor settlement is reported through the Vendor Settlement Webhooks with its reason, and that the next step depends on that reason. Your settlements help page says that a failed merchant settlement returns to Cashfree’s nodal account and is retried automatically in the next cycle. For a vendor settlement that failed for a reason we have since fixed (for example corrected bank details), is it retried automatically in the vendor’s next settlement cycle, and where does the money wait meanwhile (for example in the vendor’s balance)?
7. Failed card refunds. Your earlier reply explained what can be done when a UPI refund fails (another UPI ID with the customer’s consent, or a refund from our merchant ledger). What happens when a refund to a card fails, for example because the card is closed or blocked: where does the money go, how are we told, and what should we do?

Part 5: Charges and going live

8. Easy Split charge basis. We had understood from your Tech Team’s reply that the Easy Split charge is calculated on the order amount; your later reply asked us to refer to our account-specific commercials, and your FAQ mentions 0.2% per split. To be sure we calculate it correctly: is the charge calculated on the full order amount or on the vendor’s split amount? If this depends on our account’s commercials, we are happy to take it up with our Account Manager; please just let us know whom to contact.
9. Going live. Can our live account start with UPI and cards only?

Thank you very much for your time and patience. Your answers so far have shaped our design, and these last points will help us complete it correctly. As before, a written reply is most useful to us, and we are happy to discuss any of these on a call if that is easier.
Warm regards,
Md Asheef
Conceptsphere Technologies LLP
Merchant ID 11352134
```
