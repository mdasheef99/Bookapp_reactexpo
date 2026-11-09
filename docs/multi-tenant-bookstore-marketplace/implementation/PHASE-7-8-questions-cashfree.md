# Phase 7/8: Questions for Cashfree

**Status:** draft, not sent. The owner sends it from the owner's own account (handoff §6).
**Date:** 2026-11-09
**Needed by:** design questions by the end of week 1; fees by week 4; live items before live
(handoff §6 table).
**Authority:** none. These are questions. Every question is taken from an existing planning
file (Part B); none adds a product rule. Facts in brackets come from our 2026-10-16 research
brief (2026-10-16), the question bank (2026-11-04) and the register's provider-facts table,
all read from Cashfree's public pages. Cashfree must confirm them in writing.

Related: [CA questions](./PHASE-7-8-questions-ca.md) ·
[Lawyer questions](./PHASE-7-8-questions-lawyer.md) ·
[Handoff §6](./PHASE-7-8-HANDOFF.md) · [Decision register](./PHASE-7-8-decision-register.md)

---

## Part A: message to send

**About us.** BookConnect is a brand of an existing LLP. It is a marketplace where independent
Bengaluru bookstores sell new and used books. Each store is the seller. We want to use the
Payment Gateway with Easy Split. Our intention is that customer money stays with Cashfree
and each store's share is settled to the store's bank account. BookConnect's own part of a
payment would be the delivery charge, which we pay on to the delivery provider. We plan to accept UPI and cards only, with no
cash on delivery, and to use one vendor per order.

### Easy Split setup and payout timing

1. Please enable Easy Split for our test account, and later for production, with Split
   After Payment and deferred settlement. What is the longest split delay and the longest
   settlement hold our account can have? Is the 45-day maximum hold firm? [Your pages
   describe a 48-hour maximum split delay and a 45-day hold. The default delay and the API
   path differ between pages.]
2. We want to hold each store's share until we release it. Our plan is to release it 3 days
   after the store hands the book over, in the next weekly Monday payout. Can the release
   date be set or changed for each order by API after payment (we have seen
   `settlementEligibilityDateUpdate`)? What happens to a held share when its limit is reached?
3. Can each store be paid once a week, on Mondays? Which settlement types does our account
   have (instant, standard, on-demand)? Which settlement timelines apply to marketplace
   vendors under the RBI Payment Aggregator Directions, 2025?
4. Please describe where the customer's money sits between payment and settlement, and who
   holds it. We do not want BookConnect to hold pooled customer money. Is Easy Split suitable
   for that, given that the delivery-charge part of each payment goes to BookConnect?

### Store (vendor) onboarding

5. Can vendors be created, verified and updated by API? Which KYC is required? Many of our
   stores are small proprietors without GST registration. Is a PAN plus a bank account
   enough? How long does activation take, why can it be rejected, and how is a store
   re-verified when it changes its bank details?
5a. Can we pause one store's settlements at any time (for example during a fraud review or
   while the store owes us money) and release them later?

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
   chargebacks when a store's balance is short? In sandbox, refunds went `ONHOLD` with
   "insufficient account balance" right after a paid order: how is refund funding handled on a
   live account, and how do we top up that balance?
9. Refund time limit: your API page says six months, the merchant terms say 180 days, and
   the grievance policy says 120 days. Which applies to our account? After that limit, what
   compliant way do you support to refund a customer who is still entitled to a refund?
10. If a refund to the original UPI or card account fails (for example the account is
    closed or the refund is rejected), where does the money go, and what is the compliant
    alternative?
11. When a payment is refunded, in full or in part, is your payment fee returned to us?

### Chargebacks

12. Under Easy Split, who is debited for a chargeback, and how is the store's share
    recovered? Please describe the process, the timelines and the evidence you need. For
    chargebacks, who is the merchant of record: BookConnect or the store? [Your pages say the
    disputed amount is withheld from the marketplace's balance, not the vendor's.] Is there a
    chargeback or dispute fee? If we win the dispute, or it is reversed, are the amount and
    any fee returned?

### Fees

13. What are your fees for each payment method (UPI, cards), the Easy Split fee per split
    (we have seen 0.2% and 0.25%), vendor payouts, refunds (standard and instant) and bank
    account verification? Is there startup or promotional pricing?
14. Can the payment fee be reported per transaction (for example through the payment
    charges webhook), so we can deduct it from that store's share?

### Payments and checkout

15. How are two successful payments for one order reported? How is a paid amount that
    differs from the order amount reported? Can the amount be locked when the order is
    created?
16. What are the minimum and maximum `order_expiry_time`? Can we end an `ACTIVE` order when
    our own 10-minute payment window closes? Can a payment still succeed after the order
    expires, and how is a UPI payment that is still pending at expiry reported to us?
17. Is your web checkout a full redirect to a Cashfree-hosted page, or an embedded
    component? Does that keep us in PCI DSS SAQ A scope? Our app is a hybrid Expo 54 / React
    Native 0.81 app: do you recommend web checkout or `react-native-cashfree-pg-sdk` for it?
18. Do you require a PCI self-assessment or another security attestation from us during
    onboarding?
19. Can the webhook secret be rotated with an overlap period, so that old and new secrets
    both work for a short time?

### Going live

20. For live mode: which documents do you need from an LLP, how long does the review take,
    and which website or app policy pages do you check? When and how is Easy Split enabled
    for live mode? Can live mode start with UPI and cards only?

---

## Part B: where each question comes from

Source keys:
- **HO** is [the handoff](./PHASE-7-8-HANDOFF.md).
- **RB** is [the research brief](./PHASE-7-research-cashfree-tax-compliance.md).
- **QB** is [the question bank](./PHASE-7-8-question-bank.md).
- **REG** is [the decision register](./PHASE-7-8-decision-register.md).

| # | Sources | Decision it affects |
|---|---|---|
| 1 | HO 6.1 #1; RB §7 #1, §4.4; REG §9 "Easy Split settlement hold"; QB §0.2 #4 | P-3, D-28 |
| 2 | HO 6.1 #1; REG P-3, D-28, Q51 | D-28 payout timing |
| 3 | RB §7 #6, §3.1, §4.4 (settlement types); REG Q51, P-3 | Q51 Monday payouts |
| 4 | REG Q3; RB §1 #1 | Q3 no pooled funds |
| 5 | HO 6.1 #5; RB §7 #3, §4.4 (activation asynchronous); QB Q46; REG BC-41 ("provider KYC rules to verify"); HO §7 (re-verify changed bank details) | store onboarding |
| 5a | QB E5; REG D-21 (pause at once for suspected fraud or unpaid debt) | D-21 |
| 6 | HO 6.1 #2; RB §7 #4; RB §5 #9 (`PENDING_APPROVAL`/`ONHOLD`); QB E8, "Still open" (multiple partial refunds) | D-14, D-26, D-39 |
| 7 | HO 6.1 #3; RB §7 #4; QB E1, E9; REG §9 chargebacks row | D-14 store debt |
| 8 | QB E2, Q82; sandbox probe 2026-11-09 (refunds `ONHOLD`) | D-08, D-14, D-54 |
| 9 | HO 6.1 #6; REG §9 "Refund window"; QB Q69 | refund rules |
| 10 | HO 6.1 #9 | refund failure handling |
| 11 | HO 6.1 #10; QB Q64 | D-27 |
| 12 | HO 6.1 #4; RB §7 #5; QB E3; HO §11 #6 (chargeback fee treatment, reversal) | D-08, D-14 |
| 13 | HO 6.1 #7; HO §6 table (fees, week 4); RB §7 #2; QB Q17, §0.2 #28 | D-13, D-27 |
| 14 | HO 6.1 #8 | D-13 |
| 15 | HO 6.1 #11 | D-29 |
| 16 | RB §7 #8; REG Q36, BC-10 (payment still processing at expiry), D-06 | Q36 10-minute reservation |
| 17 | RB §7 #7, §4.6; QB E27, E28, Q35; HO §7 (hosted checkout, SAQ A) | security baseline |
| 18 | QB E29 | live onboarding |
| 19 | HO 6.1 #12 | security baseline |
| 20 | HO §6 table (live approval, Easy Split live, payment methods); QB Q127, Q128; RB §4.5; REG D-05 | BC-43 live gate |

**Coverage check.** Each source item maps to the question numbers in Part A:
- HO 6.1 items 1 to 12 → questions 1–2, 6, 7, 12, 5, 9, 13, 14, 10, 11, 15, 19.
- RB §7 items 1 to 8 → questions 1, 13, 5, 6–7, 12, 3, 17, 16.
- QB "Still open / Ask Cashfree" (E2, E3, E9, E28, E29, multiple partial refunds, Q127–Q128)
  → questions 8, 12, 7, 17, 18, 6, 20.
- REG §9 unverified rows (settlement hold, refund window, chargebacks / negative balances /
  refund funding / payment methods / Monday payouts / fees) → questions 1, 9, 12, 7, 6, 20,
  3, 13.

**Left out on purpose:**
- QB Q47 (who registers the vendor): the research brief already answers it from Cashfree's
  pages (the platform adds vendors by dashboard or API).
- Delivery-provider questions: these go to the bike provider, not Cashfree (handoff §6.4).
