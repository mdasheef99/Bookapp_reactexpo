# Phase 7/8: Questions for the Chartered Accountant (CA)

**Status:** draft, not sent. The owner sends it (handoff §6).
**Date:** 2026-11-09
**Needed by:** TDS, invoicing and ledger accounts in weeks 2–4; GST on delivery by week 5;
registrations and filings before live (handoff §6 table). Short written answers are
enough.
**Authority:** none. Every question is taken from an existing planning file (Part B). The
bracketed notes summarise our own web research from 2026-10-16. That research is not advice;
please correct it where it is wrong.

Related: [Cashfree questions](./PHASE-7-8-questions-cashfree.md) ·
[Lawyer questions](./PHASE-7-8-questions-lawyer.md)

---

## Part A: message to send

**About us.** BookConnect is a brand of our existing LLP. It is a marketplace app where
independent Bengaluru bookstores sell new and used printed books to customers.
- **Who sells:** the store is the seller; BookConnect is the marketplace.
- **Payments:** customers pay through Cashfree. Using Cashfree Easy Split, each store's share
  is meant to go straight to the store's bank account; BookConnect's part of a payment is
  the delivery charge, which it pays on to the delivery provider.
- **Store fees in the pilot:** none for three months. Later we plan a commission plus a
  subscription for stores.
- **Customer charges:** customers pay no platform fee, but they pay for delivery. BookConnect
  books a same-day bike delivery and charges the customer the provider's quote, with no
  markup.
- **Who pays which costs:**
  - stores pay the Cashfree payment fee, deducted from their share;
  - BookConnect sometimes advances refunds and recovers them from the store's later payouts;
  - BookConnect absorbs some losses, up to a monthly limit (for example part of a delivery
    bill above the quote, or a refund it cannot recover from a store).

### GST

1. Are new and used printed books (HSN 4901) sold by independent bookstores still
   exempt after Notification 9/2025-Central Tax (Rate), effective 22 September 2025? Are
   there common exceptions, such as antique books or bundles with stationery? [Most
   commentary says printed books stayed exempt. One news report said 18%. We found no
   ruling on used books.]
2. The delivery charge: BookConnect collects the bike-delivery provider's quote from the
   customer and pays the provider, with no markup. Please cover:
   - What GST applies?
   - Is it BookConnect's own supply or a pass-through?
   - What should BookConnect invoice for delivery, and to whom?
   - If a customer causes a failed delivery, we keep the quoted delivery charge and the return
     trip cost out of the refund; if the failure is not the customer's fault, we refund the
     delivery charge in full. How should each case be invoiced or credited?
   - Can BookConnect claim input tax credit on the delivery provider's invoice?
   - Do our payments to the delivery provider need income-tax deduction (TDS)?
3. E-commerce TCS (section 52): does it apply if the books are exempt but the delivery and
   any future commission are taxable? Must BookConnect register as an e-commerce operator
   (section 24(x)) in each state where it has sellers? Or does it register only for its own
   taxable income, at the normal threshold? If TCS applies, please confirm the rate (we read
   0.5% from 10 July 2024), the return (GSTR-8, monthly?) and when it is collected.
4. Do stores that sell only exempt books need GST registration to sell through BookConnect?
   The relevant rules are section 23, section 24(ix) and Notification 34/2023. Can we
   onboard stores that are not GST-registered?
5. GST on our future commission and subscription: is it 18%? Must we register now, during
   the pilot when we charge stores nothing? Should we issue one tax invoice per store per
   settlement period?

### Income-tax deduction on payments to stores

6. Under the Income-tax Act, 2025, section 393(1), Table Sl. 8(v) (formerly section 194-O):
   - Does it apply even though the books are GST-exempt?
   - Is the rate 0.1%? What is the rate when a store has not furnished a PAN?
   - Is the base the book amount only, or does it include delivery?
   - How does the ₹5 lakh exemption for individual or HUF sellers work?
   - When must we deduct: at the split or credit, or at payout?
   - Do we need a TAN, and which return and certificate forms apply?
   - Is it acceptable to deduct the tax from the store's Easy Split share?

### Invoices and receipts

7. Should the store issue the customer's bill of supply for exempt books? May BookConnect
   generate it on the store's behalf? How should a refund of an exempt supply be documented?

### Accounting

8. How should we account for each of these?
   - Store money that passes through Cashfree (we treat it as not BookConnect's revenue).
   - The Cashfree payment fee deducted from the store's share.
   - The Cashfree fee on a refunded payment, borne by the store or by BookConnect depending
     on who caused the refund.
   - Refunds BookConnect pays at once and later recovers from the store.
   - Chargebacks.
   - Delivery claims against the provider.
   - Losses BookConnect absorbs and writes off, including the part of a delivery bill above
     the quote that BookConnect pays.
9. When we recover a store's debt from its future payouts, what is the accounting and the
   effect on the income-tax deduction in question 6?
10. Which ledger account classes should our system keep? Which accounting exports do you
    need from us, and how often?

### Business structure and registrations

11. We want the store to be the seller of record and BookConnect only the marketplace. Is
    that workable from an accounting and tax view? A lawyer will review the contracts
    separately.
12. Is our existing LLP suitable for running this marketplace? Which extra registrations or
    filings does it need before we take live payments? For example: TAN, GST or TCS
    registration, Shops and Establishments registration, professional tax.

---

## Part B: where each question comes from

Source keys:
- **HO** is [the handoff](./PHASE-7-8-HANDOFF.md).
- **RB** is [the research brief](./PHASE-7-research-cashfree-tax-compliance.md).
- **QB** is [the question bank](./PHASE-7-8-question-bank.md).
- **REG** is [the decision register](./PHASE-7-8-decision-register.md).

| # | Sources | Decision it affects |
|---|---|---|
| 1 | HO 6.2 #1; RB §6 #1, §2.1; QB Q87 | tax fields (DOC-15) |
| 2 | HO 6.2 #2, #7 (delivery part); HO §6 table (GST on delivery, week 5); REG BC-28, BC-22, §10; sub-bullets 4–6 are Claude's additions from REG D-26, D-39 | BC-22, BC-28, D-26, D-39 |
| 3 | HO 6.2 #3; RB §6 #2, §2.2 (rate and GSTR-8 marked "confirm"); QB Q88 | registration |
| 4 | HO 6.2 #4; RB §6 #3, §2.3; QB Q89 | store onboarding |
| 5 | HO 6.2 #6; RB §6 #5, §2.5; QB Q92, Q94; REG Q6, D-23 | future pricing |
| 6 | HO 6.2 #5; RB §6 #4, §2.4 (exempt goods: "inference from base"); QB Q90, Q91 | settlement amounts |
| 7 | HO 6.2 #7; RB §6 #6; QB Q93 | receipts |
| 8 | HO 6.2 #8; REG D-08, D-13, D-14, D-27, D-31, D-41 | ledger design |
| 9 | HO 6.2 #9; REG D-14 | store debt |
| 10 | HO §6 table (ledger account classes); RB §6 #8; QB Q85, Q86 | ledger design |
| 11 | REG Q2 ("legal/accounting confirmation needed") | Q2 |
| 12 | HO 6.2 #10; HO §6 table (registrations, TCS, TAN, LLP filings); RB §6 #7–#8; REG Q95; QB Q95 | BC-43 live gate |

**Coverage check:**
- HO 6.2 items 1 to 10 → questions 1, 2, 3, 4, 6, 5, 7 (and 2), 8, 9, 12.
- RB §6 items 1 to 8 → questions 1, 3, 4, 6, 5, 7, 12, 10 and 12.
- QB "Ask the CA" (confirm Q87–Q92; Q93–Q95) → questions 1, 3, 4, 6, 5, 7, 5, 12.
- REG §10 "Needs CA or lawyer" items that are tax or accounting:
  - delivery money ownership, invoicing and GST → question 2;
  - TDS → question 6;
  - seller of record → question 11.

**Routed to the lawyer instead:** QB Q99–Q100 (naming Cashfree in the privacy policy; the
store agreement). The question bank listed them under "Ask the CA", but they are legal
questions. Their lawyer questions are 5 and 2.

**Question RB §6 #7 changed:** the research brief asked which structure to choose
(proprietorship, LLP or company). The owner has since decided to run BookConnect under the
existing LLP (REG Q95), so question 12 asks whether the LLP is suitable.
