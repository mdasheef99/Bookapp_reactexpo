# SDD 05: Store Money: Vendors, Easy Split and Payouts (skeleton)

**Status:** skeleton for owner review, 2026-11-10. R5 carried in on 2026-11-12. Not approved.
**Authority:** none yet. Rules come from the [decision register](../PHASE-7-8-decision-register.md).
Cashfree facts come from the [fact record](../PHASE-7-8-cashfree-replies.md) and are cited
by CF ID.
**Owns:** a store's Cashfree vendor account, the three store permissions, the split of each
payment, holding and releasing the store's share, payouts, payout pauses, store limits,
fees on the store's lines, and the store's statement.
**Related:** [master](./00-master-state-model-sdd.md) · [ledger](./03-ledger-reconciliation-sdd.md) ·
[refunds](./04-refunds-returns-recovery-sdd.md)

**None of the Cashfree behaviour below has been tested by us on sandbox yet.** This SDD is
not approved until it has been.

---

## 1. Rules this SDD implements

Four of these are IN PRINCIPLE in the register, not final: Q3, P-3, Q50b and Q51. They
wait on Cashfree's written confirmation, sandbox testing or the lawyer. This skeleton
designs for them as intended and names the fallback where one exists; the full SDD is not
approved until the register marks them decided.

- The bookstore is the intended seller (Q2). BookConnect is not to hold pooled customer
  money (Q3, IN PRINCIPLE): the money sits in Cashfree's escrow (CF-08). The one known
  exception is the end of the settlement window (§6).
- Cashfree Easy Split is the intended way to settle the store (P-3, IN PRINCIPLE).
- A store earns its money at handover: pickup code verified (Q50a), or, for delivery, the
  parcel handed to the rider with evidence (Q50b, IN PRINCIPLE). Earning and being paid
  are separate events (BC-37).
- Earned money waits 3 days after handover, then is paid on the next Monday (D-28; Q51,
  IN PRINCIPLE). Cashfree offers a weekly settlement schedule that pays on the first
  working day of the week (CF-47), so the plan is: set each order's release date to
  handover plus 3 days, and put every store on the weekly schedule (§4).
- Three separate store permissions: receive orders, accept online payment, receive payouts
  (BC-41). A store that never completes Cashfree verification never gets "accept online
  payment" (D-59).
- The store pays Cashfree's fees: the payment fee (D-13, Q16), and the Easy Split, payout
  and bank-verification fees (D-47). Each is shown on its settlement lines.
- New stores start at 20 paid orders a day and ₹25,000 unsettled; held money counts toward
  the ₹25,000 (D-20, D-66).
- Payouts pause during a fraud review or while a debt is unpaid past 7 days; only the
  owner releases them (D-63).
- The store can download its settlement lines as CSV for any date range (D-60).
- Commission is 0% and subscription ₹0 for the first five pilot stores for three months
  (Q6, Q7, Q13, Q20). Nothing is billed automatically afterwards (BC-02). Any later charge
  needs 30 days' written notice, and the store must accept it in the app to keep taking
  paid orders (D-23).

## 2. Cashfree facts this SDD relies on

- A release date can be set per order and per store, inside a window of up to 45 days from
  the payment (CF-02, CF-03). Cashfree has noted 45 days for our sandbox account but has
  not yet confirmed it is configured (CF-42). Every rule below uses "the configured
  window", stored as a setting from what Cashfree confirms, never an assumed 45.
- An order we never update is held for the whole window by default (CF-43). The date can
  be moved to any earlier or later date inside the window (CF-44). The update call
  supports one split per store per order (CF-44), which fits one store per cart (Q33).
- Splitting a few minutes after payment is correct, and the share then stays on hold until
  its date (CF-46).
- At the date, the share is settled to the store by the store's settlement schedule, on
  bank working days; a weekly schedule pays on the first working day of the week (CF-45,
  CF-47).
- An individual vendor needs PAN and one address proof, and no GSTIN (CF-49).
- Charges can be borne by BookConnect or billed to the store; the Easy Split charge is on
  the whole order amount (CF-51).
- Cashfree's first reply said that at the end of the window the held amount goes to
  BookConnect, not the store (CF-04). Its third reply is re-confirming this (CF-45), so it
  is treated as unconfirmed.
- Split, adjustment and terminate calls take an idempotency key (CF-38).
- A share is released when its date arrives (CF-05). The first reply said there was no
  weekly schedule (CF-05); the third says a weekly settlement schedule exists (CF-47). The
  later, more specific answer is used, and it is tested on sandbox before anything relies
  on it. A store gets one settlement a day at most (CF-06).
- The split is made by an API call at least 2 minutes after payment, by amount (CF-09).
- Stores are created and updated by API; KYC needs PAN and address proof at least
  (CF-10, CF-11); activation statuses are listed in CF-12.
- A store can be blocked and unblocked; Cashfree can also put it on hold (CF-13). Status
  changes and settlements arrive by webhook (CF-14).
- Settlements are reconciled through the vendor reconciliation API (CF-39).
- A failed vendor settlement is retried automatically; the money stays with Cashfree
  until it is settled (CF-86). BookConnect detects, alerts and reconciles; it does not
  send a replacement settlement.
- Vendor credit adjustments and chargebacks use the settlement balance, not the Refund
  Wallet. A credit is confirmed by adjustment ID, vendor ledger/balance and merchant
  ledger report; how the settlement balance is topped up is not stated (CF-88).
- Sandbox can simulate a store settlement, successful or failed (CF-40).

## 3. The store as a Cashfree vendor

| Our state | Meaning | Cashfree status |
|---|---|---|
| `not_started` | No vendor created | None |
| `submitted` | Details and documents sent | `IN_BENE_CREATION` |
| `action_required` | Cashfree wants a correction. The store or admin sends it and the vendor goes back to `submitted`; an item left here shows in the admin queue | `ACTION_REQUIRED`, `BANK_VALIDATION_FAILED`, `BENE_CREATION_FAILED` |
| `active` | Verified; can be paid | The success status; its exact name is not in the fact record and is read on sandbox |
| `blocked_by_platform` | BookConnect paused payouts (D-63) | Blocked |
| `on_hold_by_cashfree` | Cashfree paused the store | `ON_HOLD` |

- "Accept online payment" (the entitlement `commerce_online_payment_enabled`, which SDD 01
  §5.1 reads and this SDD sets) is granted only when the vendor is `active` and the store's
  opening hours are set (BC-41, D-59).
- BookConnect creates the vendor; the store does not register with Cashfree itself.
- A bank-detail change re-verifies the account, blocks that store's payouts for a cooling
  period, and alerts the admin (handoff §7). The length of the cooling period is a
  setting the full SDD fixes.
- `blocked_by_platform` ends only when the owner unblocks (D-63). `on_hold_by_cashfree`
  ends when Cashfree's status webhook reports the vendor active again; meanwhile an admin
  case is open.
- A vendor stuck in `submitted` for over 24 hours raises an admin case (CF-12).
- Status changes arrive by webhook (CF-14), and a webhook can be lost. So a daily job also
  reads each vendor's status through the API (CF-10) and corrects ours; a difference opens
  a reconciliation case.

## 4. The money path for one order

1. **Payment verified** (SDD 02). The ledger records the store's share as unearned.
2. **Split.** A few minutes later the server calls the split API with its own key (CF-38):
   the store's share is the book total, less any store-borne fee that Cashfree does not
   itself take from the store (§7; CF-A12 decides which), by amount; BookConnect keeps the
   rest, which is the delivery charge (CF-08, CF-09). If the store's vendor account has
   been blocked or put on hold since the reservation, the split is not sent and an admin
   case opens; how Cashfree treats a split to such a vendor is not known (CF-13). Just before calling, the server locks the order and works out the
   amount from what is still on the order: if the whole order is cancelled or refunded, no
   split is made; if a book has already been refunded, the split covers only the books that
   remain, and the refunded part stays out of the store's share (CF-15). The line records
   that the call was sent before it is sent, so a call with an unknown result is never
   mistaken for one not made. An unknown answer is looked up, not sent again. If the split still cannot be confirmed, an admin case opens well before
   Cashfree would settle the whole amount to BookConnect (CF-09).
3. **Hold.** The store's share must not be released before handover, which can be days
   after the split. Cashfree holds it by default: an order we never update keeps its
   share on hold until the end of the configured window (CF-43, CF-46). The server sets no
   date at this step; it reads the order's date back once after the split and raises an
   alert if it is not the end of the window. This is confirmed in writing and still to be
   tested on sandbox.
4. **Handover** (SDD 06, SDD 07). The store has earned the money. The server moves the
   release date earlier, to 3 full days after handover in India time (D-28), and sends it
   to Cashfree (CF-44). The store is on Cashfree's weekly settlement schedule, so the share
   is paid on the first working day of the following week (CF-47). If 3 days after
   handover would fall beyond the end of the window, the guard in §6 has already raised a
   case. If the call fails or its answer is unknown, the line
   stays `held` with "release date not yet sent", a job retries it, and an admin case opens
   if it is still unsent a day later. The ledger already shows the money as earned.
5. **Release and settlement.** When the date arrives the share is settled to the store by
   its settlement schedule (CF-45). What happens at the very end of the window is being
   re-confirmed by Cashfree: its first reply said the money goes to BookConnect (CF-04),
   and the default date is that same moment (CF-43), so this is the one open point that
   decides whether the guard in §6 protects the store or is only a late-payment alarm
   (CF-A3). The settlement webhook and the reconciliation run record the payout with
   its bank reference. A failed vendor settlement is retried by Cashfree automatically,
   with the money remaining there (CF-86). Keep the admin alert and reconciliation open
   until its result is confirmed; BookConnect sends no replacement settlement.
6. **Cancelled before handover.** If a split call has been sent and its result is unknown,
   the refund waits until the lookup shows whether the split happened, and then follows
   the matching rule below. If the lookup cannot answer within a set time (a setting), an
   admin case opens, so the customer is not left waiting unnoticed. Before the split: the
   refund is paid from BookConnect's balance and no split is made (CF-15). After the split: the refund takes the share back
   from the store's held balance (CF-15). Nothing is paid out either way.

A refund, return, dispute or chargeback can still follow after step 5 (E10); SDD 04 owns it.

**Handover before the split.** The store earns the money at handover whether or not the
split has been confirmed (Q50a, Q50b). The ledger records it as earned at once, and the
line keeps the handover time; no second handover event is needed.

**A partial refund before the split.** The refund is paid from BookConnect's balance
(CF-15), and the split, when made, covers only the books that remain. The line stays
`split_pending` until then and goes on to `held` for the reduced amount.

**A partial refund.** When one book of several is refunded (SDD 04 category 3) after the
split, the line is not reversed. Its share is reduced by that book's price: the store's held balance is
debited through the refund's own split (CF-16), the line's amount and the ledger are
updated together, and the "unsettled" total falls by the same amount. The line keeps its
state. A partial refund that crosses a release follows the rule below.

**A refund that crosses a release.** If a refund is sent while Cashfree is releasing the
same share, we do not guess which happened first. The line stays as it is until Cashfree's
records show whether the store's balance was debited (a full refund: the line becomes `reversed`; a partial refund: the line's amount falls by the
refunded part and it keeps its state and release date) or the share
had already been settled (line becomes `settled`, and SDD 04 §6 opens a debt for the refunded part only). A settlement
webhook that arrives for a line already marked `reversed` opens a reconciliation case.

## 5. States

Per-order release line (`store_payout_lines.status`):

| State | Meaning | Moved on by |
|---|---|---|
| `split_pending` | Payment verified; split not yet confirmed | The split job and its retry; a full refund first (`not_split`); a partial refund first leaves it here for a smaller split; an admin case if it stays here |
| `not_split` | Order cancelled before the split; nothing went to the store | Final |
| `held` | Split made; not yet earned | Handover; a refund (`reversed`); the settlement-window guard. If the handover was recorded while the line was still `split_pending`, the line does not wait here: on split confirmation it goes straight to `release_scheduled`, with the date worked out from the recorded handover time, or the earliest date Cashfree accepts if that has passed |
| `release_scheduled` | Earned; release date sent to Cashfree | Cashfree's settlement webhook and the weekly reconciliation |
| `settled` | Cashfree reports the settlement succeeded | Final for payout; a later refund is SDD 04 §6 |
| `settlement_failed` | Cashfree reports failure; admin case and alert (D-64). Money stays with Cashfree until settled (CF-86) | Cashfree retries automatically. The admin follows up and fixes the reported cause where needed (CF-58); webhook and reconciliation confirm the result. BookConnect never re-sends the settlement |
| `reversed` | Refunded before settlement; confirmed by Cashfree's records | Final |
| `returned_to_platform` | The configured window ended first and the money went to BookConnect (CF-04); admin case | Admin: the store is still owed its earned share. The proposed route is a credit to the store's Cashfree balance (CF-19) and a fresh release, then `settled`. Needs the lawyer (Q3) and a sandbox test. The guard (§6) only warns, so this state can be reached, for example while a debt keeps payouts blocked. If it is, the ledger keeps showing the share as owed to the store, BookConnect does not count it as its own money, and the case stays open until the route is approved |

Payouts (`store_payouts.status`, one row per Cashfree settlement to a store): `reported`,
`succeeded`, `failed`. Set only from Cashfree's webhook and the reconciliation read.

**Weekly run (`settlement_batches`).** Cashfree releases each share on its date and pays
it by the store's weekly schedule (CF-05, CF-47), so the run sends no money. It is
BookConnect's own record, one row per store per Monday, of the lines whose release date
fell in the week before and are therefore due that day: `planned` (lines assigned), `due` (the Monday arrived),
`reconciled` (every line matched to a Cashfree settlement, CF-39), `has_exceptions` (a
line did not match; a case is open). The reconciliation job moves it; an unreconciled run
shows in the admin queue.

## 6. Pauses, limits and guards

- **Payout pause (D-63):** during a fraud review, or while a debt is unpaid past 7 days,
  the store is blocked at Cashfree (CF-13). Only the owner unblocks it, with a logged
  reason. Suspected fraud and an overdue debt also stop new paid orders at once (D-21; SDD
  04 §7).
- **Cashfree hold:** a status webhook moves the store to `on_hold_by_cashfree` and raises an
  admin case. The full SDD says whether new paid orders stop.
- **Store limits (D-20, D-66):** "unsettled" is read from the ledger and defined once, in
  SDD 03 §4. Reaching either limit pauses the store's new orders until the admin reviews
  it; the pause does not lift by itself (D-20). The checkout check is in SDD 01 §2.
- **Open return or dispute (D-93):** if a return or dispute is open on an order
  whose share is not yet released, only that order's share waits. The server moves that
  order's date later at Cashfree (CF-44) and reads it back; a ledger entry alone holds
  nothing. The wait ends when the case is decided, and no later than the guard below. A
  share already paid out is not held; recovery follows SDD 04 §6.
- **One date update at a time, always from the current facts.** Every change to a release
  date, including a retry, locks the line, works out the date afresh from the line's
  current state and any open return, dispute or pause, and sends that. A retry never
  re-sends a date worked out earlier. Only one call per line is in flight; the next waits
  for its answer. After each call the server reads the date back, and if it differs from
  what the current facts require, it sends the correct one. So a handover update cannot
  undo a newer hold (D-93).
- **Settlement-window guard:** a daily check (master §7). A share still unreleased a set
  number of days before its window ends raises an admin case, so money does not fall back
  to BookConnect unnoticed (CF-04). The number of days is a setting, starting at 7
  (D-89). An earned share only waits for its date, so the case is nearly always an order
  not yet handed over. The admin must look at the case within 1 business day. That is a
  deadline to respond, not to finish the order (D-89). The case may stay open while the
  order continues, while a return or dispute is decided (D-93), or until the order is
  cancelled under its own rules. What the admin does with
  an earned share that still cannot be released is an owner and lawyer question (§13), and
  depends on what Cashfree confirms about the end of the window (CF-A3).

## 7. Fees on the store's lines

- The payment fee is recorded as Cashfree reports it for each payment (CF-29). CF-29
  covers that fee only. How the Easy Split fee and the payout fee are reported is still
  an open point in SDD 03 §11. Each vendor bank-account verification debits a fixed fee
  plus GST from BookConnect's balance, shown as a vendor onboarding entry in the merchant
  ledger and in invoices, without an API source (CF-89). It has no sale payment to attach
  to: post each reported verification charge and match its invoice (SDD 03 §§3, 6).
  Easy Split is 0.20% on sandbox (CF-27); live charges depend on our commercials and
  onboarding, to be confirmed with the Account Manager (CF-90).
- The store bears them (D-13, D-47). Cashfree lets us bill the gateway and Easy Split
  charges to the store (CF-51); if that is switched on, Cashfree deducts them and the split
  amount is the plain book total. Payout charges are debited from BookConnect's balance
  (CF-28). Anything Cashfree does not deduct from the store itself is passed on by reducing the
  split amount, or by a debit adjustment, so the store still bears them; a fee with nothing
  to deduct from becomes a store debt (SDD 04 §6).
- A fee on a refunded payment is never returned (CF-22); D-27 says who bears it.
- Commission and subscription lines exist as settings at 0% and ₹0. Nothing bills
  automatically (BC-02). The in-app acceptance of later pricing (D-23) is outside the pilot
  build.

## 8. BookConnect's own Cashfree balances (D-54)

- Vendor credit adjustments and chargebacks are funded from BookConnect's **settlement
  balance, not the Refund Wallet** (CF-88). The earlier description of a recharged
  merchant ledger (CF-18) does not establish that the two balances are the same. How to
  top up the settlement balance is unknown (CF-A34); no mechanism is assumed.
- Confirm each vendor credit with its adjustment ID, the vendor's ledger and balance,
  and the merchant ledger report (CF-88); SDD 03 reconciles the same evidence.
- After a vendor credit funds an on-hold refund, Cashfree resumes it automatically,
  checking about hourly (CF-87). SDD 04 polls the existing refund, never resubmits it.
- The full SDD defines a low-balance alert as a setting and names the funding operator
  once the settlement-balance top-up route is confirmed.
- The amount is set after CF-A10 and pilot volumes are known.

## 9. Tables

- **Existing, empty** `seller_payout_accounts`: reused as the vendor record: store,
  Cashfree vendor ID, state, KYC state, verification time. Bank details are held by
  Cashfree, not stored in full by us. Its status CHECK allows only `not_started`,
  `submitted`, `verified`, `needs_review`, `rejected`, `disabled`, and it has no KYC
  column, so a new migration replaces the CHECK with the §3 states and adds the columns.
- **New** `store_payout_lines`: order, store, share, fees, earned time, release date sent,
  state, our split key, Cashfree settlement reference.
- **Existing, empty** `settlement_batches`: reused as the weekly run record, one row per
  store per Monday (its `store_id` is required). Its status CHECK holds the generic case
  states, so a new migration replaces it with the §5 run states. If that reshaping turns
  out larger than a new table, the full SDD uses a new table instead and leaves this one
  unused.
- **New** `store_payouts`: one row per Cashfree settlement to a store: amount, bank
  reference, time, status.
- Applied migrations are never edited; every change above is a new migration.

No client can write these tables. A store reads only its own lines through a safe view.

## 10. Screens

- Store: payout setup and its status; balances (unearned, earned and waiting, paid, owed);
  statement with CSV download (D-60).
- Admin: vendor statuses; the weekly run; failed settlements; pause and release with a
  reason; BookConnect's Cashfree balance.

## 11. Worked examples the full SDD will include

1. ₹400 book collected on a Wednesday: release date, fees, amount settled.
2. Handover on a Friday: which Monday.
3. Order cancelled before handover: share reversed, nothing settled.
4. Store blocked for an unpaid debt: lines wait, then release after the owner unblocks.
5. Settlement fails: admin case and alert; money stays with Cashfree, which retries
   automatically; webhook/reconciliation confirm settlement without our re-sending it
   (CF-86).
6. Store at ₹24,800 unsettled takes a ₹400 order: the limit check.
7. Order cancelled two minutes after payment, before the split: no split, refund from
   BookConnect's balance.

## 12. Test list headings

Split sent once per payment; no release before handover; release date across a month end
and in India time; settlement recorded once; failed settlement followed by Cashfree's
automatic retry, with alert/reconciliation and no settlement re-sent by us (CF-86);
vendor credit funded from the settlement balance and confirmed by adjustment ID, vendor
ledger/balance and merchant ledger report, without using the Refund Wallet (CF-88);
blocked store; another
store cannot read these lines; statement totals equal the ledger; settlement-window guard
fires; refund before the split; refund crossing a release, both orders; split answer
unknown then looked up; bank-detail change blocks payouts.

## 13. Open points

- **Owner check:** when a return or dispute is open on an order whose share has not yet
  been released, should that order's payout wait until it is decided? No decision covers
  this. E10 only says a payout does not close the case.
- Settled by Cashfree's third reply: the split is made a few minutes after payment
  (CF-46); the default date is the end of the window (CF-43); dates can move earlier
  (CF-44); the store is paid by its settlement schedule (CF-45, CF-47).
- **Design choice (recommended):** Monday payouts through Cashfree's weekly settlement
  schedule, with each order's date set to handover plus 3 days. The other way is to work
  out the Monday ourselves and keep stores on a daily schedule, but a daily schedule
  may credit a working day later (CF-47 gives T+1 only as an example), so the store could
  be paid on Tuesday; this is checked on sandbox before the choice is final. To test on
  sandbox: that the weekly schedule can be set per store, which day it pays when Monday is
  a bank holiday, and that a share whose date arrives on a Monday is included that day.
- What happens at the end of the window (CF-A3, second half; CF-45).
- Which vendor type a sole proprietor without GST uses (CF-A9; CF-49 covers individuals).
- How billing Cashfree's charges to the store is switched on (CF-51), and its effect on
  the split amount in §4 and §7.
- Easy Split charge basis/rate (CF-A12) and live payment methods (CF-A34's go-live part)
  go to the Account Manager: R5 says they depend on commercials and onboarding (CF-90).
  D-47 still decides who bears the fee; no live charge basis is assumed here.
- CF-A14 answered: a failed vendor settlement is retried automatically, and money stays
  with Cashfree until settled (CF-86). Detection, admin alerts and reconciliation remain;
  no BookConnect settlement retry is designed.
- CF-A34's balance distinction is answered (CF-88): vendor credits and chargebacks use
  the settlement balance, not the Refund Wallet. Whether it is the earlier merchant
  ledger and how it is topped up remain open. The Account Manager handles the separate
  live-methods question (CF-90).
- Whether holding a store's share until handover fits the RBI settlement rules (CF-07):
  lawyer.
- If money returns to BookConnect at the end of the window (CF-04), BookConnect would be
  holding a store's money, which touches Q3: lawyer, the guard in §6, and the route out of
  `returned_to_platform` in §5.
- The configured window for our account (CF-02), and the exact name of the vendor success
  status: read on sandbox once deferred settlement is enabled.
- Q3, P-3, Q50b and Q51 are IN PRINCIPLE (§1).
