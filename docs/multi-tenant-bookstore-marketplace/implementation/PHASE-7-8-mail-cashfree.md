# Phase 7/8: Mail to Cashfree (ready to send)

**Status:** sent by the owner on 2026-11-10. Cashfree replied twice the same day; see the
[replies and fact record](./PHASE-7-8-cashfree-replies.md) and the
[second mail](./PHASE-7-8-mail-cashfree-2.md).
**Date:** 2026-11-10
**Authority:** none. It is the [Cashfree questions](./PHASE-7-8-questions-cashfree.md) as one
mail, with the Easy Split activation request first. Part 1 can be pasted alone into the
Support Form. Question numbers match that document, except A to D, which are confirmations
of things we read or saw in sandbox. Fill in the three `<...>` fields before sending.

---

**Subject:** Enable Easy Split on sandbox (Merchant ID 11352134) and integration questions for a marketplace

Hello Cashfree team,

We are BookConnect, a brand of `<LLP name>`. Our Merchant ID is 11352134. BookConnect is a
marketplace app where independent Bengaluru bookstores sell new and used printed books. Each
store is the seller. We are integrating the Payment Gateway with Easy Split, on API version
`2026-01-01`.

This mail has two parts: one request that blocks our testing now, and our integration
questions. If the questions go to a different team, please forward them and deal with Part 1
first.

## Part 1: please enable Easy Split on our sandbox account

Easy Split is not active on our test account, so we cannot test vendors, splits or vendor
settlements.

- Calling `/simulate/easy-split/enable` on `https://sandbox.cashfree.com/pg` returns HTTP 500.
- Ordinary orders, payments and refunds work on the same account.

Please enable Easy Split for sandbox on Merchant ID 11352134, with Split After Payment and
deferred (on-hold) vendor settlement, and tell us when it is active. Please also tell us
what we must do to get the same setup on the production account later.

## Part 2: integration questions

**How we plan to use Cashfree.** Customers pay by UPI or card only; there is no cash on
delivery. Each order has one store (one vendor). The store's share should stay with Cashfree
until we release it, and then be settled to the store's bank account. BookConnect's own part
of a payment is the delivery charge, which we pay on to the delivery provider. We do not
want BookConnect to hold pooled customer money.

**Most urgent**, because they shape our design: questions 1, 2, 4, 5a, 6, 7 and 8. Fees (13,
14) can follow. Going live (20) is needed before launch.

### Easy Split setup and payout timing

1. What is the longest split delay and the longest settlement hold our account can have? Is
   the 45-day maximum hold firm? Your pages describe a 48-hour maximum split delay and a
   45-day hold, and the default delay and API path differ between pages.
2. We want to hold each store's share until we release it. Our plan is to release it 3 days
   after the store hands the book over, in the next weekly Monday payout.
   - Can the release date be set or changed for each order by API after payment (we have
     seen `settlementEligibilityDateUpdate`)?
   - Your v2 settlement-eligibility API says a date can be set only within the maximum
     deferral window. What is that window for our account?
   - What happens to a held share when its limit is reached?
3. Can each store be paid once a week, on Mondays? Which settlement types does our account
   have (instant, standard, on-demand)? Which settlement timelines apply to marketplace
   vendors under the RBI Payment Aggregator Directions, 2025?
4. Where does the customer's money sit between payment and settlement, and who holds it? Is
   Easy Split suitable for us, given that the delivery-charge part of each payment goes to
   BookConnect? Could the delivery provider instead be added as a vendor, so its share is
   split to it directly?

### Store (vendor) onboarding

5. Can vendors be created, verified and updated by API? Which KYC is required? Many of our
   stores are small proprietors without GST registration: is a PAN plus a bank account
   enough? How long does activation take, why can it be rejected, and how is a store
   re-verified when it changes its bank details?

5a. Can we pause one store's settlements at any time (for example during a fraud review, or
   while the store owes us money) and release them later? If you suspend or freeze a store's
   vendor account yourselves, how are we told, and what happens to its held money and to
   refunds on its orders?

### Refunds

6. How does a refund take back the store's share? Please cover full refunds, partial refunds
   and several partial refunds on one order, both before and after the store has been paid.
   Is the store's share reversed automatically, or must we specify it on each refund (for
   example with `refund_splits`)? What causes the `PENDING_APPROVAL` and `ONHOLD` refund
   statuses, and how long can a refund stay in them?
7. If a store's balance is too low to cover a refund or a chargeback, what happens: is the
   refund blocked, does BookConnect's balance pay, or is it recovered from the store's later
   settlements?
8. Can BookConnect keep a refund reserve or float with Cashfree, to fund refunds and
   chargebacks when a store's balance is short? How is refund funding handled on a live
   account, and how do we top up that balance?
9. Refund time limit: your API page says six months, the merchant terms say 180 days, and
   the grievance policy says 120 days. Which applies to our account? After that limit, what
   compliant way do you support to refund a customer who is still entitled to a refund?
10. If a refund to the original UPI or card account fails (for example the account is closed
    or the refund is rejected), where does the money go, and what is the compliant
    alternative?
11. When a payment is refunded, in full or in part, is your payment fee returned to us?

### Chargebacks

12. Under Easy Split, who is debited for a chargeback, and how is the store's share
    recovered? Please describe the process, the timelines and the evidence you need.
    - For chargebacks, who is the merchant of record: BookConnect or the store? Your pages
      say the disputed amount is withheld from the marketplace's balance, not the vendor's.
    - Is there a chargeback or dispute fee?
    - If we win the dispute, or it is reversed, are the amount and any fee returned?

### Fees

13. What are your fees for each payment method (UPI, cards), the Easy Split fee per split (we
    have seen 0.2% and 0.25%), vendor payouts, refunds (standard and instant) and bank
    account verification? Is there startup or promotional pricing? We saw an offer of zero
    fees on the first ₹20 lakh until 31 March 2027: does it apply to our account, and does
    it cover Easy Split?
14. Can the payment fee be reported per transaction (for example through the payment charges
    webhook), so we can deduct it from that store's share? How is that webhook enabled for
    our account?

### Payments and checkout

15. How are two successful payments for one order reported? How is a paid amount that
    differs from the order amount reported? Can the amount be locked when the order is
    created?
16. What are the minimum and maximum `order_expiry_time`? Can we end an `ACTIVE` order when
    our own 10-minute payment window closes? Can a payment still succeed after the order
    expires, and how is a UPI payment that is still pending at expiry reported to us?
17. Is your web checkout a full redirect to a Cashfree-hosted page, or an embedded component?
    Does that keep us in PCI DSS SAQ A scope? Our app is a hybrid Expo 54 / React Native 0.81
    app: do you recommend web checkout or `react-native-cashfree-pg-sdk` for it?
18. Do you require a PCI self-assessment or another security attestation from us during
    onboarding?
19. Can the webhook secret be rotated with an overlap period, so that old and new secrets
    both work for a short time?

### Going live

20. For live mode: which documents do you need from an LLP, how long does the review take,
    and which website or app policy pages do you check? When and how is Easy Split enabled
    for live mode? Can live mode start with UPI and cards only?

### Please confirm what we read or saw

These are things we took from your public pages or saw in sandbox. Please confirm each, or
correct it.

- A. The platform adds vendors itself, by dashboard or API; a store does not register with
  Cashfree separately.
- B. In sandbox, a refund made right after a paid order went `ONHOLD` with "insufficient
  account balance". Is that the expected behaviour, and does a live account behave the same
  way until the payment is settled?
- C. In sandbox, an order created without `order_expiry_time` got an expiry 30 days later.
  Is 30 days the default on live accounts too?
- D. `2026-01-01` is the right API version for a new integration, and Easy Split, refunds
  and webhooks all support it.

A written reply by email is what we need, since we will build to these answers. We are also
happy to go through them on a call first.

Thank you,
`<Name>`
`<Designation>`, BookConnect (`<LLP name>`)
`<Phone>` · Merchant ID 11352134
