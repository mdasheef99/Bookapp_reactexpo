# SDD 03: Ledger and Reconciliation (skeleton)

**Status:** skeleton for owner review, 2026-11-10. Not approved.
**Authority:** none yet. Rules come from the [decision register](../PHASE-7-8-decision-register.md)
and DOC-15 §5.
**Owns:** the ledger's accounts and posting rules, store balances, the loss-cap total, and
reconciliation against Cashfree.
**Related:** [master](./00-master-state-model-sdd.md) · [refunds](./04-refunds-returns-recovery-sdd.md)

---

## 1. Principles

- The ledger is the source of truth for money. Screens and payouts read from it, never
  from order status (Q86, DOC-15 §5).
- Rows are append-only. A mistake is fixed by a reversal entry, never an edit (Q86).
- Amounts are whole paise, never negative; direction is a separate debit or credit field.
- Every posting is a group of entries that sums to zero.
- Each posting has an idempotency key, so a repeated event posts once.
- It records what each party is owed, whoever holds the cash. Under Easy Split the cash
  sits in Cashfree's escrow (CF-08; Q3 is IN PRINCIPLE).
- Earning money and being paid it are separate events (BC-37). Fulfilment and finance are
  separate lifecycles (E10).
- **Rounding (D-88; this SDD owns the rule):** a store's sale proceeds are
  never rounded; prices are whole paise and commission is 0%. BookConnect never computes a
  Cashfree fee; it records the paise Cashfree reports. Where one amount of cost is divided
  between the store and BookConnect, such as the fee on a partial refund (D-86), the
  store's part of the cost is rounded down to a whole paisa and BookConnect bears the
  remainder, so the odd paisa is never charged to the store and the parts always add up
  to the total exactly. Partial refunds are tracked as a running total against the amount
  paid, never recomputed from percentages.

## 2. Accounts (proposal for review)

| Account | Meaning |
|---|---|
| `provider_clearing` | Money Cashfree holds for an order, until refunded or paid out |
| `store_unearned` | The store's share of a paid order before handover |
| `store_earned` | Earned at handover; waiting for payout (Q50a, Q50b) |
| `store_paid_out` | Paid to the store's bank |
| `store_debt` | The store owes BookConnect (D-14) |
| `delivery_charge_collected` | The customer's delivery charge, due to BookConnect |
| `delivery_cost` | What the delivery provider bills |
| `provider_fees` | Cashfree fees, tagged by kind (gateway, Easy Split, GST, payout, bank verification) and by who bears them (D-13, D-47, D-27). Never returned on a refund (CF-22) |
| `refunds_payable` | A refund approved and owed to the customer but not yet confirmed by Cashfree, including one waiting `ONHOLD` (D-54) |
| `refunds_to_customer` | Refunds Cashfree has confirmed as sent |
| `platform_cashfree_balance` | BookConnect's own recharged balance at Cashfree, which funds refunds and chargebacks (CF-18, D-54) |
| `platform_bank` | BookConnect's own bank account, outside Cashfree: the other side of a recharge, of a debt a store repays directly, and of money Cashfree settles to BookConnect |
| `platform_refund_advance` | BookConnect's own money used for a refund the store must repay (D-14, D-54) |
| `platform_loss` | Losses BookConnect absorbs; feeds the loss cap (D-08, D-30) |
| `chargeback_hold` | Amounts under a chargeback |
| `tax_payable` | Reserved; unused until the CA answers |

No commission accounts in the pilot (0%, Q63).

`platform_refund_advance` and `store_debt` are two stages of one amount, never both at
once: the advance is BookConnect's money paid out for a refund; it becomes `store_debt`
when the store is asked to repay. `store_paid_out` only mirrors a settlement Cashfree
reports; it is not a second movement of cash. The full SDD shows both with posting lines,
and drops either account if the lines show it is not needed.

Two accounts stand for cash at Cashfree and must not overlap. `provider_clearing` is the
customers' money for particular orders, in escrow. `platform_cashfree_balance` is
BookConnect's own money there. An order's money leaves `provider_clearing` only by a
payout to the store, a refund, or Cashfree settling BookConnect's part (the delivery
charge, or a share returned at the end of the window, CF-04). Whether BookConnect's part
lands in its Cashfree balance or its bank, and when, is read on sandbox before the full
SDD writes the posting lines.

## 3. Posting rules

The full SDD gives the exact debit and credit lines, with a rupee example, for each event:

| Event | Source SDD |
|---|---|
| Payment verified | 02 |
| Cashfree payment fee reported for a payment (CF-29) | 02, 05 |
| Easy Split, payout and bank-verification fees charged (evidence for each is open, §11) | 05 |
| Share returned to BookConnect at the end of the settlement window (CF-04) | 05 |
| Handover (pickup code verified; rider collected) | 06, 07 |
| Payout sent; payout failed | 05 |
| Refund before the store earned the money | 04 |
| Refund after earning but before payout | 04 |
| Refund after payout (store debt) | 04 |
| Partial refund for missing books | 04 |
| Customer-fault deduction (D-39) | 04, 07 |
| Delivery provider bills the quoted charge (matched against the charge the customer paid, BC-22) | 07 |
| Delivery bill above the quote; cancellation fee (D-31, D-41) | 07 |
| Refund approved (owed); refund confirmed by Cashfree | 04 |
| Debt recovered from a payout; debt repaid; debt written off | 04, 05 |
| Chargeback opened, lost, won (debited from BookConnect's balance, CF-24) | 04 |
| Duplicate payment received and reversed by Cashfree (CF-30) | 02 |
| BookConnect's Cashfree balance recharged (CF-18) | 05 |
| Store balance adjusted by BookConnect, credit or debit (CF-19) | 04, 05 |
| Loss becomes final (once per debt or shortfall; a later recovery posts against it) | 04 |
| Correction by reversal (admin, with a reason) | 08 |

## 4. Store balances

Derived views, never stored totals. Each rupee of a store's share is in exactly one of
three places: unearned (paid, before handover), earned and awaiting payout, or paid out.
Debt is separate. "Held" is not a fourth amount: it describes where unearned and earned
money sits at Cashfree.

"Unsettled" for the ₹25,000 cap is unearned plus earned awaiting payout, that is, all
money paid for the store's orders and not yet paid out to it (D-20, D-66). A ₹400 share
counts as ₹400 before handover and ₹400 after it, never ₹800. SDD 01 §2 and SDD 05 §6 use
this one definition.

The store sees a restricted view of its own lines; statement CSV is in SDD 05 (D-60).

## 5. Loss cap

- Total of `platform_loss` entries made final in the India-time calendar month, net of
  recoveries (D-30).
- A Cashfree fee that BookConnect bears on a refunded payment counts too (D-27). It is
  posted to `platform_loss` once, when the refund is confirmed, so the cap needs only this
  one account and the fee is not counted twice.
- A recovery that arrives after a loss was made final reduces the total of the month in
  which it arrives, not the earlier month (D-87, which refines D-30).
- On a partial refund, the fee's bearer under D-27 takes only the part of the fee that
  belongs to the refunded amount (D-86). On a ₹470 payment with a ₹9.40 fee and a ₹250
  book refunded, that part is ₹5.00; the other ₹4.40 stays with the store as the fee on
  the sale that still happened (D-13). The division follows the rounding rule in §1.
- At ₹10,000 the system blocks new reservations and payments only; paid orders, the D-04
  refund and all refunds continue (D-08, D-55).
- Only the owner restarts, after a clean reconciliation; the restart is logged (D-68).

## 6. Reconciliation (Q84)

| Run | Compares | When |
|---|---|---|
| Payments | Cashfree's payments against `payments` and the ledger | Daily |
| Refunds | Cashfree's refunds against `refunds` and the ledger | Daily |
| Settlements | Cashfree's vendor settlements against payouts and the ledger | Weekly (SDD 05) |
| Store balance adjustments | Each credit or debit we sent (CF-19) against Cashfree's record and the ledger | Daily |
| Chargebacks | Cashfree's disputes (CF-26) against `chargebacks` and the ledger | Daily |
| BookConnect's Cashfree balance | Opening balance, plus recharges, less refunds, chargebacks and fees, equals Cashfree's closing balance | Daily |
| Duplicate payments | Each `duplicate_success` attempt against a reversal at Cashfree | Daily, until matched |
| Fees | Each fee posting against Cashfree's report for that fee kind | Daily for payment fees; others once their evidence is known |
| Internal | Every posting group sums to zero; balances match their entries | Daily |

Every event in §3 appears in one of these runs. Where Cashfree's evidence is not yet known
(duplicate reversals, CF-A5; BookConnect's balance statement; Easy Split, payout and
bank-verification fees), the run is listed and its source is an open point in §11.

- Tolerance is zero paise.
- Each mismatch opens a case in `finance_reconciliation_cases` with a type: paid at
  Cashfree but no order; order paid but no ledger posting; amount differs; refund missing
  on one side; payment with no split; settlement, adjustment, chargeback or fee missing on
  one side; duplicate payment with no reversal; BookConnect's balance does not add up;
  unknown provider record.
- Each run has a named owner and a recorded sign-off (handoff §7).
- Sources: order and payment reads for payments; refund reads for refunds; the vendor
  reconciliation API, which gives each settlement's ID, time and bank reference (CF-39);
  and the per-payment charges webhook for fees (CF-29).

## 7. Database enforcement

- No client role can write finance tables; only server functions can.
- A trigger blocks UPDATE and DELETE on ledger rows.
- A check at commit proves each posting group sums to zero.
- Unique idempotency key per posting.
- Total refunds for a payment can never exceed the amount paid. A chargeback on the same
  payment is counted with them when working out what the store owes (SDD 04 §5).

## 8. Tables

- **New** `finance_ledger_entries`: posting group ID, account, direction, amount in paise,
  currency, store, order, payment, refund, payout references, source type and ID,
  idempotency key, bearer tag for fees, created time.
- **New** `reconciliation_runs`: type, period, counts, mismatches, owner, sign-off.
- **Existing, empty** `finance_reconciliation_cases`: reused for mismatch cases, with
  added typed columns.

## 9. Worked examples the full SDD will include

1. ₹400 book, pickup, UPI: payment, fee, handover, payout.
2. ₹400 book plus ₹70 delivery: payment through delivery.
3. Full refund before handover.
4. Missing book partial refund on a two-book order.
5. Store-fault refund after payout: ₹400 book, ₹70 delivery, 2% fee, ₹60 reverse pickup;
   store debt ₹530 (handoff §11 item 19).
6. ₹80 over the delivery quote caused by the store: BookConnect ₹50, store ₹30 (D-41).
7. Chargeback lost on a complied order: BookConnect bears it (Q68, D-69).

## 10. Test list headings

Unbalanced posting rejected; edit and delete rejected; duplicate event posts once; refund
above the paid amount rejected; concurrent refunds; balances equal the sum of entries;
loss-cap month boundary in India time; reconciliation finds each seeded mismatch type.

## 11. Open points

- Settled: the ledger records the payment fee Cashfree reports for each payment (CF-29,
  D-13). CF-29 covers only that fee.
- How Cashfree reports the Easy Split fee, the payout fee and the bank-verification fee,
  so each can be posted and reconciled. Payout charges are debited from BookConnect's
  balance (CF-28), so they are passed on to the store through the split amount or a debit
  adjustment (D-47). To be found in the docs or on sandbox, then added to the fact record.
- Where BookConnect's Cashfree balance statement comes from, for the daily balance run.
- The two paired accounts in §2: confirmed or dropped when the posting lines are written.
- Settled: a refunded payment's fee is never returned (CF-22). D-27 says who bears it and
  D-86 says how much on a partial refund.
- Settled: rounding (D-88) and the month of a late recovery (D-87).
- Cashfree's charges can be borne by us or billed to the store, and the Easy Split charge
  is on the whole order amount (CF-51). D-13 and D-47 say the store bears them, so billing
  to the store is to be switched on; how is still to be found. Until then the split amount
  is reduced to pass them on.
- How large BookConnect's Cashfree balance must be (CF-A10, D-54).
- The account list above is my proposal and is the main thing for the money reviewer to
  check.
