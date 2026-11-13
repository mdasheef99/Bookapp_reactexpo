# Phase 7/8: SDD 02 review, round 1 (2026-11-11)

**Subject:** [SDD 02 draft](./phase-7-8-payments-fulfillment/02-cashfree-payments/02-0-overview.md),
frozen in `p78sdd02review/` (sha256 manifest checked unchanged after all runs).
**Reviewers (read-only, independent):** Muse (OpenCode, decisions; 10 findings), DeepSeek
v4.1 flash (OpenCode, money and stock races; 11; needed one resume to write its report),
Codex Sol xhigh (buildability against code and schema; 18), Codex Luna max (whole review; 17).
All four: NOT READY. 56 findings, merged below into 31 items after checking each one against
the files. Agent output is input, not authority: each item below was verified by me.

**Status:** nothing in SDD 02 is changed yet. Fixes wait for the owner's answers to the
questions in the last section.

## Confirmed: blockers (money can be lost or paid twice)

| # | Finding | Reviewers | Verified against |
|---|---|---|---|
| B1 | The poll stops while money can still arrive: §9.3 step 5 stops on `TERMINATION_REQUESTED`/`EXPIRED`/`TERMINATED` with no attempt pending, but a failed or dropped attempt may still succeed (§4.2) and CF-65 gives no time limit; §11.2 also stops polling once `paid`, so a later duplicate is never seen if its webhook is lost. SDD 01 §5.4 says the payment "stays on SDD 02's poll after this checkout closes" | DS-1, MU-03, LU-01, SO-11 | 02-2 §9.3, §11.2; CF-65; SDD 01 §5.4 |
| B2 | A second success for the wrong amount after a verified payment is refunded by us (category 6) and also reversed by Cashfree (CF-30): paid back twice. §9.3 tests amount before "already verified"; SDD 01 §5.6 says any second success after a verified payment is a duplicate | SO-01, LU-02 | 02-2 §9.3, RX2-10; SDD 01 §5.6 table |
| B3 | When two successes appear in one read, the counted one is chosen by `payment_time` (when the attempt **started**). Cashfree reverses the extra one; if its "extra" is by completion, the order would be backed by money that is returned | LU-03 | 02-2 §9.3; names list D7; CF-30 |
| B4 | A success Cashfree has already reversed has no branch: SDD 01 §5.6 requires "no order and no refund from us", but §9.3 would convert it | SO-02 | SDD 01 §5.6 last rows; 02-2 §9.3 |
| B5 | The duplicate watch counts a reversal by the existence of an automatic refund, without requiring `refund_status = SUCCESS`; a pending or later rejected reversal stops the watch. The watch also does not re-read Cashfree immediately before requesting our own refund | SO-03, DS-8 | 02-2 §13.2; names list D10 |

## Confirmed: major (cannot be built as written, or a gap that strands money or books)

| # | Finding | Reviewers |
|---|---|---|
| M1 | Idempotency inputs are not stated for `begin_payment`, `record_provider_order` and `apply_payment_check` (SDD 01 §5.0 states them for every command); a reused command ID could replay a stale "nothing found" answer or another checkout's session | DS-4, DS-5, DS-11 |
| M2 | The payment start round has no recovery: a crash after `initiating` is never picked up; a create timeout is treated as failure and tells the customer "Nothing was charged" though the order may exist; `start_failed` has no expiry path (the worker tries to read an order that does not exist); a late `record_provider_order` from an old round can overwrite a newer state; only one of the two documented 409 codes is handled | SO-05, SO-06, DS-9, DS-10, MU-06, LU-12, LU-16 |
| M3 | The state rules forbid moves the flows need: `initiating → closed_unpaid` (§8 step 3); a `paid` payment receiving a later pending attempt; `begin_payment` has no branch for `initiating`, `paid`, `paid_late` (possible after a failed conversion, D-95) | SO-04, LU-07, DS-6 |
| M4 | "Newer" and "older" checks are never defined; an old check could move a payment back or overwrite `last_check_id` | DS-3 |
| M5 | SDD 03's posting must run only when conversion (or the late order) actually happens, keyed so a failed-conversion retry cannot post twice | DS-7 |
| M6 | A check record cannot carry what later steps need: creation answers (`cf_order_id`, session, expiry) and an exact fractional amount (attempt `amount_minor` is an integer) | SO-07 |
| M7 | `paid_at` is defined as Cashfree's success time; approved SDD 01 defines it as the verification time and builds the 24-hour acceptance deadline from it | SO-13 |
| M8 | Schema gaps: `marketplace_private` does not exist in any migration and the body table has no columns or keys; the `store_orders.payment_id` foreign key SDD 01 assigns to SDD 02's migration is missing; nothing ensures `verified_attempt_id` belongs to the same payment | SO-14, SO-15 |
| M9 | `marketplace_sec` is not reachable from Edge Functions (foundation migration: "NOT exposed to PostgREST"); public service-only wrappers are needed, as Phase 6 does | SO-12, LU-11 |
| M10 | Webhooks: no worker is defined to process `queued` messages; message, body and work must be stored in one step before answering 200; the existing task framework caps attempts at 5, not 8 | SO-09, LU-09 |
| M11 | The task worker throws `unsupported_task_type` for unknown types; the duplicate watch needs a worker branch and a way to wait days for an admin answer, which the current task statuses do not support | SO-08, LU-10 |
| M12 | The scheduler runs once a minute (`scheduler_cadence` default `'1 minute'`), so a 20-second poll needs its own mechanism or a slower promise | SO-10 |
| M13 | Webhook bodies have no deletion job for the 180-day rule | LU-13 |
| M14 | Slice test lists depend on later slices (e.g. PA-04 needs §9; VE-05 needs §13; WH-06 needs §11) | SO-17 |
| M15 | `begin_payment` blocks payment during a store or global pause; D-81 says those pauses stop new reservations only and "a customer already reserving may finish paying". D-55 says a pause blocks "new reservations and payments" (owner question 1) | SO-16, LU-06 |
| M16 | §17 item 4 counts a payment by a method other than UPI or card; D-05 allows UPI and cards only (owner question 2) | MU-02, LU-05 |
| M17 | The master SDD requires a cap on payment attempts per customer, owned by SDD 01 and SDD 02; SDD 02 has none (owner question 3) | LU-08 |
| M18 | Customer messages: the duplicate notice has no SDD 01 event or screen and omits D-48's "2–3 working days"; the pause, expiry and start-failure texts differ from SDD 01's approved wording (`PLATFORM_PAUSED` etc.) (owner question 5) | MU-04, MU-05 |

## Confirmed: minor

| # | Finding | Reviewers |
|---|---|---|
| m1 | A checkout total under ₹1 cannot be paid (Cashfree minimum); listing prices may be 0 (owner question 4) | SO-18 |
| m2 | Say whether webhooks come from the dashboard endpoint or a per-order `notify_url` | MU-07 |
| m3 | The refund request to SDD 04 needs an exact key and a per-attempt refund cap | MU-09 |
| m4 | Traceability lacks D-81, D-50, D-48, D-21 | MU-08 |
| m5 | Poll cap of 25 does not count other reads; a shared budget is needed under Cashfree's 30/minute | LU-14 |
| m6 | VE-11 mixes D-85, D-97 and D-98; split it | LU-15 |
| m7 | Web checkout details (SDK version, redirect mode, return handling) and the real-phone test (D-90) are not in the SDD | LU-17 |
| m8 | If the checkout closes while the Cashfree order is being created, the start answer must be `RESERVATION_ENDED` with no session (downgraded from DS-2: the order is terminated, so no money can be taken) | DS-2 |

## Rejected

| Finding | Why |
|---|---|
| MU-01: a correct payment after a wrong-amount one should become an order | Approved SDD 01 §5.6 decides it: "A success after a wrong-amount attempt on the same Cashfree order: same as a duplicate". It is the second success on that Cashfree order, so Cashfree reverses it (CF-30); making it an order would back the order with money that is returned |
| MU-10: provider-check freshness under lock waits | SDD 01 §5.3/§5.4 already handle it: a stale read raises `PROVIDER_CHECK_STALE` and the task retries with a new read |
| LU-04: a success after the deadline but before the worker runs is converted | Approved SDD 01 §5.5 and §5.6 define "on time" by checkout status; the books are still held. Not an SDD 02 defect |

## Questions for the owner

1. **Pause while a customer is already reserving (M15).** D-55 says a pause blocks payments;
   D-81 (later) says a customer already reserving may finish paying. Proposal: follow D-81.
   Key rotation then waits up to 25 minutes for existing reservations to finish.
2. **Payment by a method we did not offer (M16).** If Cashfree's UPI-and-card limit ever
   fails: (a) count it and alert the admin, as an amendment to D-05; or (b) refund it in
   full with no order.
3. **Payment-attempt cap (M17).** Proposal: at most 5 "Pay" presses per checkout.
4. **Totals under ₹1 (m1).** Proposal: a checkout total must be at least ₹1 (an SDD 01
   reservation guard).
5. **Duplicate and other messages (M18).** Proposal: reuse SDD 01's wording; add a
   duplicate notice: "You paid twice. The extra ₹X will be returned to you within 2–3
   working days after Cashfree reverses it."

Plus one question for Cashfree (B3): when two payments succeed on one order, which one is
reversed — the one that completed later?

## Fixes applied (2026-11-11, by Claude)

The owner answered the five questions as D-104 to D-108. All confirmed items B1–B5,
M1–M18 and m1–m8 were addressed in the four SDD 02 parts (02-1 and 02-2 rewritten; 02-0
status, §1, §16–§20; 02-3 races RX2-01 to RX2-14, examples 1–8, tests). SDD 01 (parts and
reference copy) gained guard 13a and `commerce.min_checkout_total_minor` (D-107), the
`checkout.duplicate_payment` event and notification type (D-108) and test R-21.
Nothing has been checked by a reviewer yet. **Round 2 goes to Codex Sol**, which confirms
each fix against this list and corrects what is still wrong (owner, 2026-11-11).

## Round 2 (2026-11-12, Codex Sol confirm-and-fix)

Sol's report: [PHASE-7-8-sdd02-review-r2-sol.md](./PHASE-7-8-sdd02-review-r2-sol.md); verdict READY WITH
FIXES, 24 new findings (S2-01..S2-24), edits to the four SDD 02 parts and the D-107/D-108
lines of SDD 01. Claude spot-checked its schema evidence (unique `(command_id, event_type)`
index, claim attempt increment, `pay_presses` default) and the SDD 01 scope: correct.
One change was reversed on the owner's decision D-109: Sol's gate holding every order
until Cashfree answers CF-A16. Replaced by "count first, correct later" (§9.3, §13.5,
DU-14, DU-15, VE-21). Sol's owner questions 2–5 and Cashfree additions (CF-A27..A29) are
still open.
Owner answered Sol's remaining questions on 2026-11-12 as D-110 (refund clock starts when
the case opens), D-111 (normal key change waits; leaked key changes at once), D-112
(paid-but-no-order message) and D-113 (widened `PAID` refusal shortcut, SDD 01 §5.3/§5.4
and test E-31). Applied to SDD 02 and SDD 01 (parts and reference copy). Sol's proposed
Cashfree questions were checked against Cashfree's docs on 2026-11-12 and the unanswered
parts added to the pending file as CF-A27 to CF-A29.
