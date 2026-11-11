# SDD 01: Reserve-First Checkout and Paid-Order Acceptance

**Status:** full draft, 2026-11-11, owner decisions on §17 applied (D-95 to D-103), plus the late-payment table, closure warning, printed price and RX-29 from the owner's outside review, corrected against the Phase 6 code and traced to the
register. First paired review done; the third review's findings and the final check's four
findings are applied. Not approved. No code
or migration may be written from it until the owner approves it.
**Authority:** none yet. Business rules come from the
[decision register](../../PHASE-7-8-decision-register.md); this document must not add any.
Where it had to choose something the register does not decide, the choice is listed in
§17 for the owner.
**Owns:** the change from "store confirms, then customer pays" to "reserve, pay, then store
accepts" (BC-08, P-5 step 1); the paid order from payment until it is ready; the Phase 6
rework; the record of pauses.
**Related:** [master](../00-master-state-model-sdd.md) · [payments](../02-cashfree-payments-sdd.md) ·
[refunds](../04-refunds-returns-recovery-sdd.md) · [pickup](../06-pickup-sdd.md) ·
[Phase 6 impact check](../../PHASE-7-8-phase6-impact-check.md)


**Split on 2026-11-11 into six parts by topic.** Section numbers are unchanged, so every
reference to "SDD 01 §n" stays valid. Build from these parts; the single-file copy
[01-checkout-reservation-sdd.md](../01-checkout-reservation-sdd.md) is kept for reference only.

| Sections | File | Contents |
|---|---|---|
| §1, §2, §16, §17, §18, §19, §20, §21 | [01-0-overview.md](./01-0-overview.md) | Overview, decisions and build order |
| §3, §4 | [01-1-data-and-settings.md](./01-1-data-and-settings.md) | Data model and settings |
| §5 | [01-2-checkout-commands.md](./01-2-checkout-commands.md) | Checkout commands |
| §6, §7 | [01-3-paid-order-and-races.md](./01-3-paid-order-and-races.md) | Paid-order commands and races |
| §8, §9, §10, §11, §12, §13, §15 | [01-4-timers-stock-notices.md](./01-4-timers-stock-notices.md) | Timers, stock, notices, receipt, screens, scans and Phase 6 rework |
| §14 | [01-5-tests.md](./01-5-tests.md) | Tests |

---

## 1. Flow

```text
cart -> "Reserve and pay"
     -> server checks eligibility and stock, holds the books for 10 minutes
     -> Cashfree payment (SDD 02)
     -> verified payment: holds become sales, paid order created (awaiting_store)
     -> store accepts within 24 hours, or reports missing books
     -> [photo check if a photo request was open at payment]
     -> ready (SDD 06 pickup, SDD 07 delivery)
```

In plain words: the customer's books are held for 10 minutes while they pay. Once the
payment is confirmed the order waits for the store (`awaiting_store`), which has 24 hours to
accept it or say a book is missing. If the store does nothing, the customer gets all their
money back automatically.

This SDD stops when the order is marked ready. Pickup is SDD 06. Delivery is SDD 07; until
SDD 07 is live, `create_reservation` refuses the delivery method with
`DELIVERY_NOT_AVAILABLE_YET` (§5.1), so the first build is pickup only.

## 2. What exists today (read-only check, 2026-11-11)

Dev project `ahntbtktjjmvfosgkmgn`; 213 migrations applied; latest version `20261108143327`.

- `store_order_requests` has 0 rows; `inventory_holds` has 0 active rows. Nothing to migrate.
- `store_order_requests` has a 12-value status CHECK, `UNIQUE (cart_id)`, and these NOT NULL
  confirm-first columns: `provisional_delivery_tariff_minor`, `money_calculator_version`,
  `delivery_tariff_version`, `confirmation_reminder_at`, `confirmation_due_at`.
- Eight triggers sit on `store_order_requests`. Two run on INSERT
  (`snapshot_submission_schedule`, `snapshot_submission_pause_policy`). Five run BEFORE or
  AFTER UPDATE and act only on confirm-first states. `store_order_requests_terminal_guard`
  checks that no hold is active when a row enters a closed state.
- `inventory_holds` has `hold_type` (`soft`, `firm`), `status` (`active`, `released`,
  `converted_to_sale`), `expires_at` NOT NULL, and a unique index on one active hold per
  request item. `converted_to_sale` is defined and unused.
- `store_inventory` keeps `quantity_total = quantity_available + quantity_reserved +
  quantity_sold + quantity_removed` by a CHECK, and clients cannot update it.
- `marketplace_sec.create_bucket_transfer_holds` and `release_request_holds` lock the stock
  row, move quantity between available and reserved, and refuse when stock is short. The
  first reads `confirmed_quantity`, which pay-first never sets.
- `public.submit_order_request` snapshots the cart, items, contact, address, seller and
  policies, writes events, the transition log and notices, and starts two confirm-first
  timers. It marks the cart `submitted`.
- The task framework (`event_action_tasks`), the worker `commerce-task-worker`, idempotent
  commands (`claim_phase6_command`), the transition log, the audit log, events and in-app
  notices all exist and are reused.
- No `store_orders`, `store_order_items` or pauses table exists.
- `snapshot_submission_schedule` refuses an insert during a planned closure, which D-07
  does not allow for pay-first (§15).
- `evaluate_phase6_eligibility` checks the store's status, verification, setup and selling
  state, its subscription, its entitlements, the rollout flags and allowlist, and that an
  entitled owner exists. It also reads `stores.pickup_enabled` and applies a delivery
  minimum and free threshold, which handoff §11 item 15 and D-36 remove (§15).
- The key `commerce.acceptance_window_seconds` already exists at 1800 seconds for the old
  customer-decision step, so it is not reused (§4).
- `event_action_tasks` requires `source_request_version` on checkout tasks. The worker
  passes that version to the command as its expected version.
- The schedule engine reads the store's current schedule by store ID, not a snapshot.
- `format` is empty on 38 of the 48 stock rows, so it cannot tell a printed book from
  anything else.
- `sync_marketplace_listing_from_inventory` keeps each listing in step with its stock (§9).

Read for this draft: migrations 0001, 0005, 0006, 0010, 0011, 0017 in part, 0020, 0026 in
part, 0029 in part, and the live triggers. Checked for the functions named in §15 during the
first review: 0003, 0007, 0008, 0018, 0024, 0029, 0033, 0036.
The third review also checked 0003's open-task index, 0024's notification seed,
0025's commerce inbox and mark-read functions, 0040's publication locks, the Phase 9
photo seam and the worker's missing email transport, in the supplied read-only evidence.

## 16. Worked examples

1. **₹400 book, pickup, UPI.** Reservation at 11:00 for ₹400 (book ₹400, delivery ₹0).
   Paid at 11:03: stock reserved 1 becomes sold 1; order `BC-100042`, `awaiting_store`,
   accept by 11:03 next day. The store closes at 20:00, so "expected today" and
   `promised_ready_by` is 20:00. Accepted at 11:20. Marked ready at 13:00 (SDD 06).
2. **Two books (₹400, ₹250), delivery ₹70; one missing; keeps the rest.** Paid ₹720. The
   store reports the ₹250 book missing at hour 2: order `accepted`, outcome pending. It
   records `keeps_rest` at hour 3: refund ₹250 requested; the order continues for ₹470
   (₹400 + ₹70). The ₹250 copy is written off.
3. **Same order; customer cancels all.** `cancelled_all`: refund ₹720 in full; the ₹400
   copy goes back on sale; the ₹250 copy is written off; one store fault.
4. **Payment succeeds at minute 12; book still free.** The checkout expired at minute 10
   and the hold was released. Verification at minute 12 takes the copy again and creates
   the order; the customer is told the payment arrived late and the order is placed.
5. **Payment succeeds at minute 12; book sold at minute 11.** Full refund of ₹400
   requested; no order; the customer is told the amount and 2–3 working days.
6. **Store never accepts.** Reminder at 30 open minutes, escalation at 45. At 24 hours:
   `cancelled`, `store_not_accepted`; the copy goes back on sale; refund ₹400. Fault
   `platform` during test mode; once the alert channel is reliable, `store` if the alert was
   shown on the owner's device.
7. **Photo request open at payment; customer rejects.** The store accepts and sends photos
   at hour 5. The customer rejects at hour 9 as "does not match": `cancelled`,
   `photos_rejected`, fault `store`, refund in full, copy written off.
8. **Unaccepted order with a missing book.** Three books; at hour 20 the store reports one
   missing: the order is `accepted` (D-94) and the 24-hour timer stops. The outcome is
   recorded, or the system records `keeps_rest` at hour 44.

## 17. Choices made in this document, for the owner

The owner approved every item below on 2026-11-11 ("Approve all"). The business rules
among them are recorded in the register as D-95 to D-103, named against each item; the
rest are technical choices approved as written.

All wording of messages and notices is also mine.

1. **A price that changed between cart and "Reserve and pay" stops the reservation** and
   asks the customer to review the cart. Phase 6 silently used the lower price.
2. **The cart looks normal but cannot be changed while a payment is in progress**, and is
   closed only when an order is created. This is what lets a customer reserve again after
   an expiry.
3. **Customer attempt and open-checkout caps (handoff §7):** 6 attempts an hour
   and 2 open at once. The daily paid-order cap is off by D-56.
4. **(D-97) A late payment is refunded, not converted, when the same cart with the same contents
   already has another live or completed checkout**, so a customer who paid twice for the
   same books gets one order and one refund. This narrows D-06; approved as D-97.
5. **(D-98) A late payment is refunded when the store has since been suspended for fraud, lost
   its payment permission or been closed by the admin** (the D-81 list), even if the book
   is free. This goes beyond handoff §11 item 4, which says a late payment proceeds despite
   a later pause; approved as D-98.
6. **Order numbers look like `BC-100042`.**
7. **(D-103) Photo rejection:** the customer picks a reason: "Doesn't match the condition
   label or description" (store fault) or "Changed my mind" (no fault). The store may
   dispute a store fault; an admin compares the photos with the listing and its condition
   label and may change it to no fault (§6.5). The refund is never affected.
8. **"Alert delivered" means the notice was shown on an owner's device or an owner opened
   the order**, and it only counts once the alert channel is declared reliable.
9. **A written-off copy is removed from stock for good; a returned or refused copy waits
   for the store to re-list it.**
10. **The D-79 clock does not run during the customer's photo check**; on approval the
    promised day is worked out afresh.
11. **(D-99) A store that accepts after its promised day** gets the alert at the end of the next
    fair day, not one that has already passed. D-79 read strictly would count from the
    original promised day, which could leave the store minutes; approved as D-99.
12. **The "not prepared" cancel waits while a missing-book outcome is pending.**
13. **Selecting every book as missing is refused**; the store uses "I don't have any of
    these".
14. **Only one missing-book report at a time per order.**
15. **Delivery is refused at checkout until SDD 07 is live**, following the plan of
    payments and pickup first.
16. **The Cashfree check before expiry must be under 60 seconds old.**
17. **Receipt wording** until the CA answers: "Payment receipt", naming the store as seller
    and BookConnect as the platform.
18. **`no_fault` is added to the causes in master §9**, for "counts against nobody" (D-43,
    D-53).
19. **An order counts as at most one store fault**, however many things went wrong on it.
20. **(D-100) A store with no open day within `commerce.schedule_horizon_days` (default 62 days)
    cannot take a reservation**, because nobody could accept the order and it would only be refunded. D-07 says customers may
    order while a store is closed, so this is a narrow exception, approved as D-100. If its schedule empties after payment, the affected time falls back
    to 24 elapsed hours and an admin case is opened.
21. **Reconciliation flags an expired reservation still open after 5 minutes.**
22. **Times already worked out do not move if a store changes its hours later.**
23. **An order never accepted counts as "not accepted", even if photos were also due.**
24. **If every book the customer asked for photos of goes missing, the photo step is dropped.**
25. **A customer who cancels while a missing-book outcome is pending** is treated as
    D-61's "cancelled all": the missing book caused the cancellation, so D-61's store
    fault applies. This applies D-61 and is not a new rule.
26. **(D-101) Books stay held if Cashfree cannot be reached**, until it can be or the customer
    cancels. An admin can retry the check but cannot release the books without it.
27. **A "platform failure" that protects a store from a fault** is a recorded period when
    BookConnect's own alerts or app were failing (§3.12). In the pilot an admin records
    and ends incidents by hand through SDD 08; the worker does not create them.
28. **(D-96) Restriction on late missing-book reports:** `report_missing_books` is
    refused after `preparation_expires_at`, or after `photo_send_due_at` while photos are
    unsent, so a late report cannot move a deadline or clear the photo step (§6, M-23).
    This narrows D-83's "any time before ready".
29. **(D-95) Way out of a failed paid conversion:** an admin may retry conversion only
    within the 24 hours from the original verified payment, reading `clock_timestamp()`
    after the locks; the order keeps `acceptance_due_at = paid_at + 24 hours`, and if it
    then expires unaccepted the fault is `platform` (D-04). Otherwise the admin issues a
    full category 5 refund, closing the checkout as `platform_cancelled` with
    `conversion_failed` (§5.10). Nothing refunds automatically. The case deadline is 7 days
    after the failure is recorded; holds are extended to at least that time, and an open
    case past it is escalated to the owner. Nothing releases the holds by itself.
30. **(D-102) Payment-result grace:** 15 minutes (`commerce.payment_grace_seconds = 900`),
    as in master §8. SDD 02 uses the same setting.
31. **Report a receipt still not emailed after 24 hours** when the customer gave an email.
    It goes to the admin queue; the email task keeps retrying. D-50 requires the email,
    but does not choose this scan's timing.

## 18. Open points and checks at slice start

- The live triggers on checkouts were checked: none blocks a change out of a closed state.
- **Phase 9 prerequisites before slice 2:** the listing-trigger publication check must
  allow stock-only changes (§9). In a forward migration, the three 0040 publication
  functions must take the store lock before inventory, then listings (§7, §20):
  `phase9_set_publication_state_v2`, `phase9_retry_publication_owner_v1` and
  `phase9_retry_publication_worker_v1`. Until then 01 retries any `40P01` as a whole
  transaction with the same idempotency key and command ID.
- **Phase 9 photo contract before slice 7** (BC-06/07, D-43, D-53): for each requested
  item, return the request ID at conversion for `store_order_items.photo_request_id`;
  provide a server check that validated, viewable photos exist for every remaining
  requested item; and provide the photo references shown on the customer screen.
  The current seam is tied to a checkout item that does not exist before payment and
  needs rework. Slice 7 uses a test double until the contract is implemented; customer
  photo use waits for it. Until the payment-time request function exists, the flag is
  false (§5.5); that fallback alone does not satisfy the slice-7 dependency.
- **Phase 9 before live payments:** a reliable printed-book field and D-49 listing check.
  This lane does not edit Phase 9 files; all three handovers are recorded in §20.
- Whether the store screens already have a quick "mark sold" (stage 0 check 3; D-15).
- The reliable store-alert channel before live payments (D-02; handoff §11 item 25).
- **Receipt sender needed before live payments (D-50):** the current worker has no email
  transport and returns `transport_not_configured`. Supply an idempotent sender for
  `receipt_email` (§11, §19 slice 10); until then the task stays retrying and §13 reports
  unsent receipts after 24 hours (§17 item 31).
- Delivery: quote lifetime against the 10-minute reservation (handoff §11 item 13), and
  everything else in SDD 07.
- Receipt issuer (CA question 7).
- Design choice 1 in the master SDD (a separate `store_orders` table), which this document
  assumes.

## 19. Build order (slices)

Each slice is one package for the coder, with its own tests, and leaves the app working.

Before slice 2: Phase 9's stock-only listing-trigger change and forward publication
lock-order migration (§7, §9, §18, §20). Before slice 7: Phase 9's full photo contract,
with its test double available for slice tests. Before live payments: the receipt sender.
Every slice uses §5.0's command contracts and runs its relevant O-03 and O-04 checks.

1. Schema and framework: migration groups 1 to 5 of §3.9, with static schema, grant,
   registry and trigger tests; the timer helpers, reconciliation exemptions, incident
   commands, `replaced_by_task_id`, resolve-before-insert task opener,
   already-resolved completion guard, all §10 audience-specific notification seeds and
   `terminate_provider_order` recording stub are present. Register `receipt_email` and
   its retrying-without-sender branch. Test ST-04's non-negative money CHECKs. Until slice 6,
   `set_commerce_pause` refuses the three cancelling kinds; test R-17.
2. Reservation: migration 6 hold and stock helpers, `evaluate_reservation_eligibility`,
   `snapshot_reservation_policies`, `create_reservation`, `cancel_reservation`, customer
   advisory, payment, cart, store, checkout, stock-in-ID-order and listing locks,
   skipping rows not needed (§7); guards on the old commands; tests R-01 to R-14, R-16, R-18, R-19,
   ST-01, ST-02, RX-01 and RX-28's three publication races, with whole-transaction
   `40P01` retry checks. The termination stub records customer-cancel requests.
3. Expiry and conversion, against a payment-state test double until SDD 02's slices:
   `expire_reservation`, `expire_payment_grace`, `convert_paid_checkout` with the daily
   limit, `resolve_late_payment`, idempotent `requeue_checkout_timer`, and
   `resolve_failed_conversion` with both `retry_convert` and `refund` (D-95).
   Include §8.2 and §8.3 calculations, receipt creation with transactional `receipt_email`
   enqueue, and the failed-conversion hold extension and overdue-case escalation.
   Tests E and L, including all of E-12, except E-23's sender checks (slice 10); run
   E-23's missing-sender check now. RX-02, RX-03, RX-12, RX-13, RX-15, RX-17, RX-27; E-17 checks
   checkout timers and termination here. Defer E-21's paid-order timers to their slices,
   and L-04's platform-cancel and L-05's D-81 pause cases to slice 6. E-28 runs here with
   SDD 02's verification test double. E-29 waits for slice 6 and E-30 for slices 4 and 10.
4. Acceptance: `accept_order`, `report_order_unavailable`, `cancel_paid_order`,
   `acknowledge_store_alert`, and the three acceptance timers. E-30's cancellation part
   with the missing-sender worker (the task stays open). Tests A, C-01 in
   `awaiting_store` and `accepted`, PR-10, RX-05, RX-19, RX-25. Run O-01 for commands
   present and O-02 for these transitions; the rest run as their commands arrive.
5. Missing books and preparation: §6.2, the D-79 timers, `mark_order_ready`; tests M except
   M-08, M-15 and M-21 (photo cases in slice 7); PR except PR-04 and the photo part of PR-09;
   M-20 checks the cancellation commands present; its photo cancellations wait for slice 7.
   ST-03; RX-06, RX-07, RX-10, RX-18, RX-20, RX-22. E-17 and PR-07 now prove the old
   preparation task is resolved before replacement, with the unique index and duplicate
   scan kept, and a finishing old worker records nothing. Test the new timers' E-21 replays.
6. Ineligibility: §5.7, enable the three cancelling pause kinds; R-15, the D-81 cases,
   E-14's ineligibility races, L-04's platform-cancel and L-05's D-81 pause cases,
   E-29's per-checkout identities, RX-04, RX-14, RX-16, RX-29.
7. Photos: §6.5; tests PH, M-08, M-15, M-20's photo cancellations, M-21, PR-04,
   all remaining C-01, E-21, O-01 and
   O-02 cases, and RX-08, RX-09, RX-11, RX-21, RX-23, RX-24, RX-26. Run the photo part of
   PR-09. PH-08 uses Phase 9's full-contract test double for request IDs, complete
   validated/viewable photos, `PHOTOS_INCOMPLETE` and customer photo references. The
   real Phase 9 contract is a slice-7 dependency; customer photo use waits for it. At this point every §7 race has its both-order test.
8. Screens and projections: migration 9 and §12, including E-22's screen wording and R-20's closure warning, with
   customer and store flows checked in the browser; `submit_order_request` closed to
   clients (§15). Run the complete security tests S-01 to S-08.
9. Reconciliation scans and observability: migration 10 and §13; RC-01, E-27 and the full
   E-17, including unsent receipts after 24 hours (§17 item 31) and overdue case escalation.
   Earlier slices contain migration 5's two cleanup exemptions, not a duplicate-task exemption.
10. Receipt email sender: later transport slice, required before live payments (D-50).
    Wire the §11 idempotent sender to `receipt_email`; E-30's sender cases run here; E-23 proves one email per order
    through a test double, including send/replay recovery and `emailed_at`. Until then
    the task stays retrying and the §13 unsent scan reports it.

Refund requests in slices 3 to 7 call SDD 04's request function. Until SDD 04 is built
they call a stub that records the request, and the tests assert on that record. The stub
deduplicates by the supplied refund key, including the payment ID in §5.6. The matching
§5.10 refund uses the same stub and the same payment ID key.
Before SDD 02 is built, `terminate_provider_order` likewise uses its migration 5 recording
stub. Each slice runs its relevant grants, events and timer-replay checks; tests that need
a later command run in that command's slice, as listed above.

## 20. Handovers to other SDDs

What this SDD calls, and what calls it. A change on either side must be checked here.

Third-review record, 2026-11-11: only this SDD changed. The handovers below record changes
needed elsewhere; no sibling, tracker, code or migration was edited. Document checks cover
command signatures and worker mappings, notification seeds and audiences, settings,
owner proposals, task/deadline wording and the unchanged §16. SQL and worker tests in §14
are acceptance tests for the build; they were not run in this documentation session.
No git command, network request, database/storage change, staging, commit, push or
deployment was performed.

| With | Direction | Contract |
|---|---|---|
| SDD 02 | 02 calls 01 | Use §5.0's exact `marketplace_sec.convert_paid_checkout` and `marketplace_sec.resolve_late_payment` contracts inside verification after amount checks and in §7 lock order. On `conversion_failed`, commit the verified payment, case with 7-day deadline and hold extension together (§5.10). Recovery reads that payment and keeps its original `paid_at`; expiry does nothing on verified success. A retry is allowed only before the original D-04 deadline using post-lock `clock_timestamp()`; it races verification through the same payment lock and one-order constraints. Payment conversion also opens `receipt_email` when an email was given |
| SDD 02 | 01 needs from 02 | Use §5.0 for all 01 calls. Worker provider steps: §5.3 for reservation expiry; §5.4 for grace end, terminating even a still-processing attempt, with `TERMINATION_REQUESTED` accepted and a success verified instead. Payment stays on the poll after grace closure. Own the `terminate_provider_order` handler registered in migration 5; until built, its stub records and resolves. Confirm `commerce.payment_grace_seconds`, 900 (D-102). Grace ends at `reservation_expires_at + commerce.payment_grace_seconds`, even if already past when expiry runs. Requeues keep original `p_task_due_at`, dedupe by admin command ID, record `replaced_by_task_id`, and run now through `next_attempt_at` |
| SDD 02 | 02 needs from 01 | The checkout's `final_total_minor`, and whether it is `reserved` before a payment may start |
| SDD 04 | 01 calls 04 | One request function: order or payment, category, item list for a partial refund, cause, stable key. The caller already holds the payment row lock (§6, §7). Categories: 1, 2, 3, 4, 5, 7, 8, 19. Category 5 also covers the admin failed-conversion refund (D-95, §5.0, §5.10). Both that refund and §5.6 use the payment ID key, so a later replay never refunds twice; missing reports use their own report ID. Every whole-order cancel closes an open report without changing its own category except §6.4's existing rule. When an admin changes a photo-mismatch fault to `no_fault` (D-103), 04 re-attributes that order's non-returned fee to BookConnect (D-27) |
| SDD 04 | 01 calls 04 | Record a store fault: order, kind (`sold_out`, `missed_deadline`, `photos_not_sent`, `photos_mismatch`, `not_prepared`) |
| SDD 03, 04, 05 | They call 01 | Use §5.0's exact `set_commerce_pause` and `clear_commerce_pause` contracts for their kinds (§3.6), with §7 lock order and command identity preserved |
| SDD 05 | 05 sets | The entitlement `commerce_online_payment_enabled` |
| SDD 05 | 05 reads | `store_orders`, for the split amount from `store_order_items`: `(quantity - removed_quantity) * unit_price_minor` |
| SDD 06, 07 | They call 01 | Use §5.0's exact `mark_order_ready` and `restock_order_item` contracts. `mark_order_ready` (§6.7): photos approved if requested and still required; a set `photo_requirement_cleared_at` satisfies the photo guard. Deadline uses `clock_timestamp()` read after the locks. Everything after ready is theirs; each SDD extends §6.8's trigger in its own migration with its later transitions. Call `restock_order_item` with `pickup:<order id>:<item id>` for pickup and `return:<case id>:<item id>` for a return; §9's three outcomes and quantity/replay rules apply. The last four cancel reasons remain theirs. SDD 07 owns guard 11's valid-quote rules; until it is live guard 10 refuses delivery first |
| SDD 08 | 01 needs | Admin queue for escalations, D-79 alerts, dead-lettered tasks, failed conversions, receipts unsent after 24 hours (§17 item 31) and store disputes of photo-mismatch faults (D-103, §6.5, PH-09). Checked wrappers use §5.0's exact service-only `requeue_checkout_timer`, `resolve_failed_conversion`, `record_platform_incident` and `end_platform_incident` contracts, preserving the checked admin actor, key and command ID. Show one requeue replacement through `replaced_by_task_id`. Build both failed-conversion actions, `retry_convert` and `refund` (D-95); nothing refunds without an admin action. Record the retry action and order ID so an unaccepted expiry is fault `platform` (D-04). An open case past its 7-day deadline escalates to the owner and never releases holds itself. The pilot records incidents by hand; flag one left open over 24 hours. Until 08 exists, an owner notice in test mode (handoff §11 item 25) |
| Phase 9 lane | 01 needs | **Before slice 2:** stock-only listing-trigger exemption (§9), and a forward migration changing 0040's `phase9_set_publication_state_v2`, `phase9_retry_publication_owner_v1` and `phase9_retry_publication_worker_v1` to lock store before inventory, then listings. Until then any 01 `40P01` retries the whole transaction with the same key and command ID (§7, RX-28). **Before slice 7:** per requested item, the open request's ID at conversion, kept as `photo_request_id`; a check that validated, viewable photos exist for every remaining requested item; and the photo references the customer screen shows (§18, PH-08). Provide the matching test double; `send_requested_photos` uses it to prove `PHOTOS_INCOMPLETE`. **Before live payments:** D-49 printed-book field and listing-side enforcement |
| Receipt email sender | 01 needs | Needed before live payments (D-50). Supply §11's idempotent sender for `receipt_email`, key type plus order ID, then set `emailed_at` on success. The current worker returns `transport_not_configured`; keep tasks retrying until slice 10, and report unsent receipts after 24 hours (§13, §17 item 31). No new in-app event or notification type is needed |
| SDD 00 and decision register | Needs later update | Done 2026-11-11: the register records D-95 to D-103, and master §5 and SDD 04 category 5 include the admin `conversion_failed` refund (D-95). Still to do: align master grace anchoring with §4/§5.3, unchanged event names and audience-specific notification types with §10, and cleared-photo readiness with §6.7. Item 31's 24-hour unsent-receipt scan was approved with §17. Master §12 now records D-49 as a listing rule with no checkout re-check (done 2026-11-11) |
| SDD 09 | Needs later update | Carry §14 tests and §5.0 command/JSON contracts into its full test plan: E-02/E-11 anchored late grace; E-12 failed-conversion recovery; E-13/E-24 idempotent requeue and replacement pointer; E-17/PR-07 atomic task replacement and no-op completion; E-18 both inbox audiences and mark-read; E-19/E-23 receipt enqueue and sender replay; E-25 to E-27 recovery window and owner escalation; E-28 wrong-amount expiry; E-29 batch cancel identities; E-30 receipt survives cancellation; A-09 platform fault; PH-08 full Phase 9 photo contract; O-02 current §6.8 trigger; O-03 post-lock deadline clock; O-04 exact worker calls; ST-04 non-negative parts; RX-27 retry/verification and RX-28 all three publication races; RX-29 multi-checkout pause with verifications. Keep §3.8 grants, §6 refusals and §8.1 timer replay checks. E-12 includes the D-95 refund |

## 21. Traceability

Each decision this SDD owns (master §12), and where it is met.

| Decision | Section | Decision | Section |
|---|---|---|---|
| BC-04, BC-05 | §3.1, §3.2, §3.5, §5.1, §12, R-19 | D-34 | §8.3 |
| BC-06, BC-07 | §3.5, §5.5, §18, §20, PH-08: Phase 9 request ID and photo references | D-35, D-42 | §12 |
| BC-08 | §1 | D-36 | §5.1, §15 |
| BC-09 | §5.1, §9 | D-43 | §3.5, §6.5, §8.3, §18, PH-08 |
| BC-10 | §4, §5.3, §5.4, §8.1, E-02, E-11, E-13 | D-49 | A listing rule, Phase 9 lane: §5.1, §18 |
| BC-12, BC-13 | §3.4, §6.6, §8.2, A-07 | D-50 | §3.9, §3.10, §5.1 guard 9, §5.5, §8.1, §11, §13, §18 to §20, E-19, E-23, E-30 |
| BC-14 | §8.3 | D-53 | §6.5 |
| Q15, D-11 | §3.1 (zero-fee CHECK) | D-56, D-65 | §3.1, §4, §5.1 guards 5 and 13, R-13 |
| Q33 | §5.1 guard 3 | D-61 | §6.2 |
| Q36 | §4, §5.1 | D-79 | §4, §6, §6.6, §8.3, PR-11, PR-12, M-21 |
| Q38, D-06 | §5.6 | D-81 | §3.6, §5.7, E-29, RX-29 |
| Q49 | §6.1, §6.7, §6.8, M-15 | D-83 | §3.11, §6, §6.2, M-19 to M-22 |
| Q55 | §6.3 | D-84 | §5.6 |
| Q65 | §6.2 | D-85 | §5.6 |
| P-6 | §5.1 guards 10 and 11, SDD 07 quote contract | D-94 | §6, §6.2, §7, M-18 |
| D-04 | §3.12, §5.10, §6, §6.1, §6.6, §8.4, A-06, A-08, A-09, E-25, E-26, O-03 | D-20, D-66 | §3.6, §5.5 |
| D-07 | §3.6, §5.1, §12 closure warning, §15, R-20 | D-21 | §3.6, §5.1 guards 7 and 8 |
| D-15 | §5.1, §6.3 | D-25 | §5.1 (no photo guard), §5.5 |
| D-55 | §3.6, §8.3 | D-67, Q45 | §6.4 |
| D-02 | §3.9 group 5, §10, E-18, S-08 | | |
| Handoff §7 | §3.8, §5.1 guard 5, §7, R-18, S-01 to S-08 | | |
| Engineering proof (no new business rule) | §3.8, §3.9, §5.0, §7, §8.1, §9, §10, §13, §15, §19, §20; E-13, E-17, E-18, E-21, E-24, O-02 to O-04, ST-03, ST-04, RX-01 to RX-29, RC-01 | D-95 to D-103 (owner, 2026-11-11) | §5.6, §5.10, §6.2, §6.5, §8.2, §13, §17, E-12, E-26, E-27 |
