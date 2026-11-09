# Phase 7/8: Questions for the Delivery Provider

**Status:** draft, not sent. The owner sends it to each candidate (for example Shiprocket
Quick, Porter, Borzo) in weeks 1–2 (handoff §6.4, D-24).
**Date:** 2026-11-10
**Authority:** none. These are questions. Each one comes from handoff §6.4 or a register
decision (Part B). The answers decide which provider is chosen (register §10) and fill in
the delivery SDD.

Related: [Cashfree questions](./PHASE-7-8-questions-cashfree.md) ·
[CA questions](./PHASE-7-8-questions-ca.md) ·
[Lawyer questions](./PHASE-7-8-questions-lawyer.md) ·
[Decision register](./PHASE-7-8-decision-register.md)

---

## Part A: message to send

**About us.** BookConnect is a brand of an existing LLP. It is a marketplace app where
independent Bengaluru bookstores sell new and used printed books. For a three-month pilot
with five stores, we want same-day bike delivery from the store to the customer within
Bengaluru. BookConnect would hold the business account, book each delivery by API when the
store has packed the order, and charge the customer your quote with no markup. We expect
low volumes at first.

### Quotes and booking

1. Can we get a quote by API for a pickup address and a drop address, before the customer
   pays? How long is a quote valid, and is the final bill always the quoted amount? If not,
   when and why can it differ?
2. Can we book by API when the parcel is ready, using a quote obtained earlier? What happens
   if no rider accepts the booking: how long do you keep trying, and how are we told?
3. Which Bengaluru pincodes or areas do you serve, and can we get that list by API or as a
   file?

### Status and proof

4. Do you send delivery status updates by webhook, or must we poll? Which statuses exist
   (rider assigned, picked up, delivered, failed, returned)?
5. What proof of pickup and proof of delivery do you give? In particular:
   - Can the customer give a one-time code (OTP) to the rider at the door?
   - Otherwise, does the "delivered" event include the time, the location and a rider photo?

### Cancellations, failures and returns

6. What does it cost to cancel a booking before the rider collects the parcel, and after?
7. If the customer is not available, what happens to the parcel, is it brought back to the
   store, and what are the charges?
8. Can we book a reverse pickup from the customer back to the store (for a returned book) by
   API? What does it cost, and what happens if the customer is not there?

### Liability and account

9. What is your liability for a lost or damaged parcel? Is there a cap per parcel? How do we
   claim, what evidence do you need, and how long does a claim take?
10. Business account terms: how are we billed (prepaid wallet, postpaid, per delivery)? What
    invoices and GST do you charge on deliveries? Are you registered for GST?
11. Do you have a test or sandbox environment for the API?

---

## Part B: where each question comes from

| # | Sources | Decision it affects |
|---|---|---|
| 1 | HO §6.4 (quote by address); REG BC-22, D-24, D-31, D-41; HO §11 #13 (quote expiry vs the 10-minute reservation) | BC-22, D-31 |
| 2 | HO §6.4 (booking); REG D-17, D-77 | D-17, D-77 |
| 3 | HO §6.4 (serviceable area); REG D-18 | D-18 |
| 4 | HO §6.4 (status webhooks or polling) | delivery SDD |
| 5 | HO §6.4 (proof of pickup and delivery); REG D-74, Q50b, BC-27 | D-74, Q50b |
| 6 | HO §6.4 (cancellation and its charge); REG D-31, Q45 | D-31 |
| 7 | HO §6.4 (failed delivery and return-to-store); REG D-09, D-39 | D-09 |
| 8 | REG D-32, D-71 (reverse pickup is not in the HO §6.4 list) | D-32, D-71 |
| 9 | REG BC-35, D-09; lawyer question 7 | BC-35 |
| 10 | HO §6.4 (business account terms and billing); CA question 2 (input tax credit, TDS) | BC-28, CA Q2 |
| 11 | HO §6.4 (test or sandbox access) | build plan |

**Coverage check:** each HO §6.4 item maps to a question:
- quote → 1;
- booking → 2;
- status → 4;
- cancellation → 6;
- failed delivery and return → 7;
- proof → 5;
- serviceable area → 3;
- account terms and billing → 10;
- sandbox → 11.
