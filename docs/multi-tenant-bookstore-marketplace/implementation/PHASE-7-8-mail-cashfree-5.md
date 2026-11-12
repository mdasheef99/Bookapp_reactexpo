# Phase 7/8: Fifth Mail to Cashfree (draft)

**Status:** DRAFT, written 2026-11-12, not sent. The owner sends it from their own mailbox
as a reply on ticket 8774207, after the [fourth mail](./PHASE-7-8-mail-cashfree-4.md) (9
questions, sent 2026-11-12).
**Authority:** none. It asks what the [sandbox tests](./PHASE-7-8-cashfree-sandbox-tests.md)
and a second docs check left open: CF-A35 (new), CF-A16, CF-A21 (retry freshness part),
CF-A32, CF-A28, CF-A34 (ledger part) and CF-A33. It withdraws question 5 of the fourth
mail (CF-A25), which we test ourselves.
**Review:** the question list was reviewed by Codex Sol and searched in the docs by Haiku
on 2026-11-12; the mail text was then reviewed by Codex Sol ("send after fixes"). I checked
every fix against the thread and the live docs before applying it: Cashfree's R1 already
says chargebacks are debited from the merchant ledger (so question 6 asks only how the
ledger is recharged); the Easy Split charge and tax are in the split-details API
(`split_service_charge`, `split_service_tax`), so question 7 asks only about the
bank-verification charge; the API spells the hold status `ONHOLD`, so question 4 uses plain
words. The question 9 line was removed once the owner shared the mail as sent (it has no
ledger part).

---

Subject: Re: Request to activate Easy Split and integration questions for a marketplace (Ticket 8774207, Merchant ID 11352134)

Dear Cashfree Team,

Thank you again for your help. We have reviewed our sandbox test results alongside your documentation and have a few further questions.

About my earlier mail: please disregard question 5, about creating two successful payments on one order in sandbox. We will try this ourselves first.

New questions:

1. Refunding a specific payment by API. You have confirmed that when two payments succeed on one order, the extra payment is reversed automatically. If we ever need to refund one of those payments ourselves, how do we target a particular `cf_payment_id` through the API? The documented Create Refund request has no `cf_payment_id`. How is the payment selected, and how is its remaining refundable amount enforced?

2. Automatic-reversal records. Your refund-webhook example shows a duplicate-payment reversal as `PAYMENT_AUTO_REFUND`, identifying the payment through `cf_payment_id`. When is `UNRECONCILED_AUTO_REFUND` used? Can it apply to a payment previously reported as `SUCCESS`? If so, how do we retrieve that reversal through the API when its webhook is missed?

3. Webhook retries and the five-minute check. Your documentation recommends rejecting webhooks whose `x-webhook-timestamp` is more than five minutes old. In one sandbox test, our endpoint deliberately returned HTTP 500. On webhook version `2023-08-01`, the retries we observed kept the first attempt's timestamp and signature, including one received about eight minutes later. What freshness check do you recommend, so that we accept genuine retries while still protecting against replay?

4. Resuming a refund after funding the vendor. Suppose an Easy Split refund is on hold because the vendor's balance is insufficient. After a successful credit adjustment makes both the merchant and vendor balances sufficient, does the existing refund resume automatically? If so, within what time? If not, which action or API call is required?

5. Payment amount different from the order amount. Your Get Payments documentation mentions customer service fees as a reason the amounts can differ. For our INR UPI and card setup, which does not use those fees, are there any other cases where `payment_amount` differs from `order_amount`? If so, what amount and decimal precision should `refund_amount` use to return the full payment, and how is the refund currency determined?

6. Funding vendor credits and chargebacks. Your earlier replies say vendor credit adjustments and chargebacks use our merchant ledger. Does recharging the Refund Wallet through its virtual bank account fund both of these for our Easy Split account? If not, how do we top up the merchant ledger?

7. Bank-account verification charges. Where can we retrieve each actual vendor bank-account verification charge and its GST, with a reference that identifies the vendor? An API, a report or a webhook would all work for us.

Thank you for your time and help.

Warm regards,
Md Asheef
Conceptsphere Technologies LLP
Merchant ID 11352134
