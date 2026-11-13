# Phase 7/8: Sixth Mail to Cashfree (draft, not sent)

> **2026-11-13:** this mail was sent: Cashfree's replies R6 and R7 answer its questions by
> number (stored in the [replies file](./PHASE-7-8-cashfree-replies-original.md)). The text
> as sent was not pasted, so the draft below may differ from what was sent.

**Status:** DRAFT, written 2026-11-12 after Cashfree's fifth reply (R5). Not sent as of
2026-11-12. The owner sends it from their own mailbox as a reply on ticket 8774207, then
pastes the text as sent so it can be stored here and in the
[thread file](./PHASE-7-8-cashfree-thread-original.md).
**Authority:** none. It asks only what R5 left open: CF-A35 (refund targeting), the
settlement balance from CF-88 (CF-A34 part), CF-84's pending duration (CF-A31 part),
CF-A21 (response timeout and retry age), CF-A16 and CF-A27. Questions 1 and 2 matter most:
they decide how refunds and store credits work at go-live.

---

**Subject:** Re: Request to activate Easy Split and integration questions for a marketplace (Ticket 8774207, Merchant ID 11352134)

Dear Shreejoy,

Thank you very much for your detailed reply. It answered most of our questions and has helped us finalise our design.

A few points are still open, and we would be grateful for your help with them:

1. **Refunding a specific payment.** When two payments succeed on one order, we understand the extra payment is reversed automatically. If we ever need to refund one of those payments ourselves through the API, how do we choose which payment is refunded? The Create Refund request has no `cf_payment_id`. If this is not possible, what is the recommended safe procedure?

2. **Settlement balance.** You mentioned that vendor credit adjustments and chargebacks are funded from our settlement balance. Is this the same as the "merchant ledger" mentioned in earlier replies? How do we add funds to it when it is low, and how can we check its current balance (API or report)?

3. **Refunds that stay pending.** You mentioned that a refund that cannot be processed stays as PENDING while your team handles it. Roughly how long can this take, and will we be notified (for example by email or webhook) when it is resolved?

4. **Webhook timing.** Within how many seconds must our endpoint respond to a webhook? Also, retries keep the original timestamp and signature: does your five-minute timestamp check apply to retries as well?

5. **`UNRECONCILED_AUTO_REFUND`.** When is this refund type used?

6. **Create Order timeouts.** How long is an `x-idempotency-key` remembered? And after a timeout, if Get Order returns 404, is that final?

Thank you again for your time and support.

Warm regards,
Md Asheef
Conceptsphere Technologies LLP
Merchant ID 11352134
