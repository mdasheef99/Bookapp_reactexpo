# SDD 01, part 5: Tests

**Part of SDD 01.** Section numbers are those of the whole SDD, so a reference such as
"SDD 01 §5.3" means §5.3 in whichever part holds it. The map is in the
[overview](./01-0-overview.md). The full single-file copy
[01-checkout-reservation-sdd.md](../01-checkout-reservation-sdd.md) is kept for reference
only; build from these parts.

---

## 14. Tests

Named so each maps to one rule. SQL integration tests run against the dev database with
test-only stores and users, and clean up after themselves.

**Reservation**
- R-01 each enabled guard in §5.1 refuses with its code, and writes nothing. Until SDD 07
  is live, guard 10 refuses delivery first; guard 11's valid-quote tests belong to SDD 07.
- R-02 the amount equals the database prices plus the delivery charge; a tampered client
  amount is ignored.
- R-03 `PRICE_CHANGED` when a price moved after the cart was built.
- R-04 two customers, one copy, run together: exactly one hold.
- R-05 the same command repeated with the same key returns the first answer and holds once.
- R-06 a cart can be reserved again after expiry and after cancel; never while one is live;
  and again after a late conversion left a changed cart active.
- R-07 cart edits are refused while a checkout is live.
- R-08 a closed store still accepts a reservation (D-07).
- R-09 each pause kind blocks or does not block as in §3.6.
- R-10 a store in a planned closure still accepts a reservation (D-07).
- R-11 a store with `pickup_enabled` false still offers pickup, and a book can be added to
  and replaced in a cart there.
- R-12 a price rise and a price fall: the refreshed cart shows the listing price, the next
  attempt with it succeeds, and the one with the old price raises `PRICE_CHANGED`.
- R-13 attempts and live-checkout caps; the daily paid-order cap defaults to `null` and
  does not refuse orders (D-56); when set, it refuses at that cap.
- R-14 a direct call to the old `submit_order_request` for a new cart is refused,
  with or without a live reservation; its different lock order is unreachable (§15).
- R-15 a D-81 pause and a reservation together, both orders; no live checkout survives.
- R-16 support cancellation of a pay-first checkout is refused.
- R-17 until §5.7 exists, each of the three cancelling pause kinds raises
  `PAUSE_KIND_NOT_AVAILABLE` and writes nothing.
- R-18 two reservations for one customer run together at the live-checkout cap: the
  customer advisory lock makes one re-check after the other commits.
- R-19 a reservation copies each book's `printed_mrp_minor` (or null) beside its selling
  price, and conversion copies it to the order item; the charged amount ignores it.
- R-20 the cart shows the closure warning when the store's next opening is 24 hours or
  more away, and not otherwise; payment is never blocked by it (D-07).

**Expiry and payment**
- E-01 expiry with no payment releases the holds and restores the stock exactly.
- E-02 expiry with a pending attempt keeps the holds and enters `awaiting_payment_result`.
  Grace ends at `reservation_expires_at + commerce.payment_grace_seconds`, never run time
  plus grace. Run expiry after that end too: it still enters the state, with the grace
  task due at the past time and immediately runnable.
- E-03 expiry with a stale or missing provider read changes nothing.
- E-04 expiry and verification together, both orders.
- E-05 grace end with no success releases the holds.
- E-06 conversion moves reserved to sold, creates one order and its items, and sets every
  deadline.
- E-07 conversion called twice creates one order.
- E-08 a checkout's version changes before expiry: the timer still acts.
- E-09 terminate answers that a payment succeeded: converted as on time, not late.
- E-10 terminate fails: nothing changes and the task retries.
- E-11 a payment still processing at grace end: terminate is called despite that attempt;
  `TERMINATION_REQUESTED` permits closure as `payment_failed`; a later success is late.
  Termination reporting success verifies and converts; a failed termination keeps holds.
  A late reservation expiry or grace worker never moves the anchored grace end (E-02).
- E-12 a failed conversion guard: no order; verified payment, admin case and hold extension
  to its 7-day deadline commit together. Both expiry commands do nothing and holds
  stay until an admin acts. Test that `refund` releases holds, closes as `platform_cancelled` with
  `conversion_failed`, resolves tasks and requests category 5 once. Replay the admin
  action and then §5.6: the shared payment ID key prevents a second refund.
- E-13 a dead-lettered reservation or grace expiry: the source is not open. Requeue keeps
  the original anchored deadline as `due_at` and `p_task_due_at`, adds the admin command
  ID to the dedupe key and runs now through `next_attempt_at`. It records
  `replaced_by_task_id`. After a fresh Cashfree read and termination it really closes
  the checkout; a stale read refuses and keeps holds. Requeuing reservation expiry after
  the anchored grace end still opens an immediately due grace task (E-02).
- E-14 cancel and expiry together, cancel and verification together, ineligibility and
  verification or expiry together, cancel and grace together: both orders.
- E-15 `ORDER_ALREADY_PAID` when the payment is already verified.
- E-16 every transition not in §5.8 is refused by the trigger.
- E-17 change the checkout's version, run `reconcile_phase6_operations`, then run the
  original timer: it still acts. Check the version-cleanup exemption for every §8.1 type.
  After a cancel, reconciliation leaves `terminate_provider_order` open and its handler
  runs. For an old `preparation_expiry` in each of `open`, `in_progress` and
  `retry_scheduled`, replacement resolves it as `resolved_noop` before insertion in
  one transaction. The unique index holds and the duplicate scan stays enabled.
  A worker completing the resolved old task writes no answer, completion, event or notice;
  the replacement acts. Check the same opener rule for repeated missing-outcome,
  photo, preparation-alert, termination and requeue work.
- E-18 `order.placed` writes `commerce.order.placed.customer` and
  `commerce.order.placed.store` in the same payment transaction, with the registry's
  matching audiences. A rollback leaves neither notice. After commit both recipients
  see their own notice in the commerce inbox and can mark it read through 0025.
- E-19 the receipt is created once with the order's non-negative amounts; with an email,
  its `receipt_email` task is opened in that payment transaction with type/order dedupe.
  No email gives no email task. Conversion replay creates neither a second receipt nor task.
- E-20 the daily limit sets the pause at 20; two conversions together both count.
- E-21 replay each §5 and §6 timer through the new claim and completion helpers, with no
  actor or expected version: same answer, one effect. Check scope, logical entity ID and
  command ID (§8.1), and a new task ID for a requeue.
- E-22 `checkout.converted` and `checkout.payment_pending` have no notice;
  `checkout.payment_not_received` and its screen use §10's wording, with `payment_failed`
  at grace end; "You were not charged" appears only on an expiry with no attempt.
- E-23 test-double sender: one receipt email per order, including replay and a retry after
  send but before `emailed_at` was recorded. The same type/order key reaches the sender;
  success sets `emailed_at` once. Without a sender, `transport_not_configured` keeps
  the task retrying. The unsent-after-24-hours scan opens a case (§13; slice 10).
- E-24 repeat a requeue with the same key/command ID, then run two concurrent commands
  on the same source: one replacement ID, recorded once on the dead-lettered source,
  returned by every call. Also refuse a non-dead-lettered source, a non-checkout timer
  and a no-longer-live checkout on a first call; each writes nothing.
- E-25 a retry inside the D-04 window reads the saved payment and original `paid_at`;
  the order keeps `acceptance_due_at = paid_at + 24 hours`. Replay and race SDD 02's
  late verification of that same payment: one order, receipt, stock conversion and notice
  per audience (RX-27).
- E-26 retry at and after `paid_at + 24 hours` is refused using post-lock
  `clock_timestamp()`, including a lock wait that crosses the deadline. Case and holds
  stay open until the admin refunds (D-95); nothing refunds automatically.
- E-27 a failed-conversion case still open after its 7-day deadline escalates
  to the owner through the admin queue. No timer, scan or escalation releases its holds.
- E-28 a wrong-amount success found at reservation expiry, and again at grace expiry:
  verification records `amount_mismatch` and refunds it; the worker continues, terminates
  (or treats Cashfree's refusal as terminated), reads again and closes the checkout,
  releasing the holds, with `checkout.payment_not_received`. No order is created and the
  task does not retry forever. A later correct success on that Cashfree order is
  handled by SDD 02 as a duplicate (CF-30, D-78): no order, no immediate refund, and
  §5.6 is not called.
- E-29 one D-81 pause cancels three live checkouts of a store in one transaction: three
  `checkout.platform_cancelled` events with distinct child command IDs and keys, each
  carrying the pause command ID. Replaying the pause changes nothing.
- E-30 cancel an order before its `receipt_email` is claimed, while the sender runs, and
  after sending but before `emailed_at` is recorded: the task stays open, the same
  type/order key reaches the sender, and exactly one email is sent.

**Late payment**
- L-01 single book still free: order created (D-06).
- L-02 book sold meanwhile: full refund requested once (Q38).
- L-03 two books, one gone: full refund, nothing taken (D-84).
- L-04 after a customer cancel and after a platform cancel: refund, no order (D-85).
- L-05 a limit or pause set after expiry does not block; a D-81 pause does.
- L-06 a second checkout of the same cart at the same version is live or converted: refund;
  at a different version: converts.
- L-08 two late payments together, at the same version and at different versions.
- L-07 a late conversion leaves a cart changed after expiry alone.

**Acceptance**
- A-01 accept inside 24 hours; reminder and escalation due at 30 and 45 open minutes across
  a closing time.
- A-02 no accept: cancelled at 24 elapsed hours, stock back on sale, refund requested.
- A-03 fault is `platform` when the alert channel setting is off, even with the fact
  recorded; with it on, `platform` when no alert was delivered and `store` when it was.
- A-04 accept and expiry together, both orders.
- A-05 `report_order_unavailable` writes the stock off and records a store fault.
- A-06 `accept_order` at and after `acceptance_due_at`, before its timer runs, raises
  `ACCEPTANCE_DEADLINE_PASSED` and writes nothing.
- A-07 no open time inside the horizon, or a reminder/escalation due after
  `acceptance_due_at`: that task is not opened and its column is null; no open time also
  opens an admin case. Check reminder and escalation separately.
- A-08 with reliable delivered alerts, an incident overlapping `paid_at` to
  `acceptance_due_at` makes fault `platform`; a non-overlapping incident leaves fault
  `store`. Both incident commands are admin-only; recording and ending are audited.
- A-09 an order created by `retry_convert` that expires unaccepted is fault `platform`,
  even with reliable, delivered store alerts and no separate incident (D-04).

**Missing books**
- M-01 report on `awaiting_store` accepts the order and stops the 24-hour timer (D-94).
- M-02 `keeps_rest` refunds only the removed items' prices; delivery charge untouched.
- M-03 `cancelled_all` refunds in full and restocks the rest.
- M-04 no outcome in 24 hours: the system records `keeps_rest` (D-83).
- M-05 cannot mark ready while an outcome is pending.
- M-06 report and customer cancel together, both orders.
- M-07 all books selected is refused with `USE_ORDER_UNAVAILABLE`.
- M-08 a report during the photo check keeps the state; rejection or expiry cancels all.
- M-09 one store fault per order, whichever outcome follows.
- M-10 a second report after the first has an outcome gets its own 24-hour timer.
- M-11 two successive reports: each refund covers only its own copies, and replaying either
  outcome refunds nothing more.
- M-12 two copies on one line, one missing: one copy stays, one is refunded.
- M-13 an empty report and a quantity above what is left are refused.
- M-14 the first report's timer does nothing against the second report's mark.
- M-15 the only photo-requested book removed: the photo step ends and its timers do not
  cancel the order, from `accepted` and from `awaiting_photo_check`; record `keeps_rest`,
  then `mark_order_ready` succeeds without photo approval.
- M-16 customer cancel with an outcome pending: `cancelled_all`, fault `store`, category 4.
- M-17 outcome racing its timer, and report racing `report_order_unavailable`: both orders.
- M-18 `report_missing_books` on `awaiting_store` at and after `acceptance_due_at`, before
  its timer runs, raises `ACCEPTANCE_DEADLINE_PASSED` and writes nothing.
- M-19 `record_missing_outcome` at and after `missing_outcome_due_at`, before its timer
  runs, raises `MISSING_OUTCOME_WINDOW_PASSED`; the timer then records `keeps_rest`.
- M-20 each whole-order cancellation with an open report closes it as `cancelled_all`,
  with its actor, and clears the mark; its own reason, fault and category stand (§6).
  Check §6.4's category 4 exception too.
- M-21 a missing report on `awaiting_store` acknowledges a photo order but opens no D-79
  timers while photos remain required; approval sets them, or clearing the requirement
  starts them (§6.2, D-79).
- M-23 `report_missing_books` at and after `preparation_expires_at`, and at and after
  `photo_send_due_at` with photos unsent, is refused before its timer runs and writes
  nothing; no deadline moves and the photo step is not cleared (D-96).
- M-22 the §3.11 FKs, non-null report times, allowed outcome/actor values and all-null or
  all-set outcome CHECK reject invalid rows.

**Photos, preparation, cancel**
- PH-01 to PH-05 each row of §6.5; a matching rejection and silence record `no_fault`.
- PH-06 `send_requested_photos` at and after `photo_send_due_at`, before its timer runs,
  raises `PHOTO_DEADLINE_PASSED` and writes nothing.
- PH-07 approve and reject at and after `photo_check_due_at`, before its timer runs,
  raise `PHOTO_DEADLINE_PASSED` and write nothing.
- PH-09 a store dispute of a `does_not_match_listing` rejection: the admin's change to
  `no_fault` removes that store fault once and re-attributes the fee through SDD 04; the
  customer's refund is unchanged; a replayed admin decision changes nothing (D-103).
- PH-08 Phase 9 test double: conversion keeps the request ID for each requested item.
  `send_requested_photos` raises `PHOTOS_INCOMPLETE` with its message and writes nothing
  if any remaining requested item has missing, unvalidated or unviewable photos.
  It succeeds only when every such item passes; removed items need no photos.
  The customer projection shows the matching photo references (§18).
- PR-01 alert at the promised time; cancel and refund at the end of the next business day
  (D-79); neither fires once the order is ready.
- PR-02 the promised day for an order paid 3 hours and 1 hour before closing, before
  opening on an open day, and on a closed day.
- PR-03 an order accepted after its promised day still gets its alert and a full next day.
- PR-04 the D-79 clock does not run during the photo check.
- PR-05 an order accepted before its promised time, inside the last 2 hours of the day, is
  alerted at the promised time.
- PR-06 no open day in the horizon: the time falls back and an admin case is opened.
- PR-07 preparation expiry during a pending outcome: no cancel; after the outcome a new
  deadline and task, which then fires. Also close the outcome before the old expiry
  runs, for old `open`, `in_progress` and `retry_scheduled` tasks: resolve as
  `resolved_noop` before inserting the replacement. At most one open task of that type;
  an old worker's completion writes nothing (E-17).
- PR-08 a store changes its hours after payment: stored times do not move.
- PR-09 `mark_order_ready` and expiry together, both orders; approve and cancel together.
- PR-10 the alert acknowledgement sets `store_alert_delivered_at` once.
- PR-11 `mark_order_ready` at and after `preparation_expires_at`, before its timer runs,
  raises `PREPARATION_DEADLINE_PASSED` and writes nothing.
- PR-12 changing `commerce.preparation_grace_business_days` from 1 to 2 moves a newly
  calculated expiry to the second open day's closing time; an already stored time stays.
- O-01 each refusal in the §6 table has its stated code and message and writes nothing,
  as R-01 does for reservations.
- O-02 the §6.8 trigger accepts the listed transitions, including a photo requirement
  cleared by a missing report, and rejects every unlisted transition or exit from a final
  state. The table built now is §6.8 itself. Later fulfilment transitions are refused
  until SDD 06 and SDD 07 add them in their migrations; those SDDs test their extensions.
- O-03 start an action before its deadline, hold its row lock elsewhere, then release the
  lock after the deadline. The action reads `clock_timestamp()` after the locks, refuses
  with its deadline code and writes nothing. Cover acceptance, a missing report on
  `awaiting_store`, missing outcome, photo send, photo response and ready; E-26 covers retry.
  Check provider-read freshness and timer-not-yet-due comparisons the same way.
- O-04 each §5.0 signature, JSON answer and no-op answer matches its call site and §8.1
  worker mapping; no omitted parameter, client actor on a timer or expected timer version.
- C-01 customer cancel in each allowed state restocks and requests a full refund.

**Security**
- S-01 a customer cannot read or act on another customer's checkout or order.
- S-02 a store owner cannot read or act on another store's order.
- S-03 no client role can write any table in §3.
- S-04 a `store_id` sent by the app is ignored.
- S-05 system commands cannot be called by a client role.
- S-06 notices and logs contain no phone number or address.
- S-07 each row of the §3.8 grant table: a caller outside it is refused, and a customer
  cannot cancel or answer photos on another customer's order.
- S-08 the validators reject an unregistered `checkout.*` or `order.*` event and a payload
  with personal data; a notice on a `store_order` reaches only its own customer or owners.
  Every §10 type has exactly its suffix audience in the group-5 seed and uses `commerce.`
  so the inbox and mark-read functions include it (E-18).

**Stock**
- ST-01 each outcome in §9 moves the right bucket by the right quantity.
- ST-02 a stock move on a listing that became ineligible still succeeds (§9).
- ST-03 two copies on an item: a report writes one off, then a cancel returns the one
  left. Replay both keys: one written off, one back on sale, two movement records, no
  further stock change.
- ST-04 every new money column in §3.4, §3.5 and §3.10 refuses a negative value.
  Negative book or delivery parts are refused even when their total still balances.

**Reconciliation**
- RC-01 the §13 scans find missing timers for `awaiting_photo_check` and a pending missing
  outcome, an open report with no outcome pending, a verified unconverted payment and an
  incident open over 24 hours; photo scans skip cleared requirements. Check stock-movement
  consistency, post-close termination and both reconciliation exemptions in §15.
  Report receipts unsent after 24 hours and open failed-conversion cases past their
  7-day deadline; neither scan releases holds or fabricates a sent receipt.
  No old preparation task stays open beside its replacement; duplicate scans stay on.

**Races**

Each RX test runs its §7 row twice: A commits before B, then B before A, checking the
stated result, stock, refunds, notices and tasks. For a second versioned action, also
check its stale-version refusal, then reload the current version to check the stated
state result. For a row with alternative commands,
run every alternative in both orders. Deadline races follow §7's timing rule.

- RX-01 last copy reserved by two customers.
- RX-02 reservation expiry and verification.
- RX-03 reservation cancel and verification.
- RX-04 ineligibility cancel and verification.
- RX-05 accept and acceptance expiry.
- RX-06 missing report and acceptance expiry.
- RX-07 missing report or outcome and customer cancel.
- RX-08 send photos and photo-send expiry.
- RX-09 photo response and photo-check expiry.
- RX-10 mark ready and preparation expiry.
- RX-11 acceptance expiry and photo-send expiry at the same time.
- RX-12 two late payments on the same cart version.
- RX-13 reservation cancel and reservation expiry.
- RX-14 ineligibility cancel and either checkout expiry.
- RX-15 reservation cancel and grace expiry.
- RX-16 a D-81 pause and a new reservation.
- RX-17 two conversions reaching the store daily limit.
- RX-18 missing-outcome expiry and store outcome or customer cancel.
- RX-19 accept and whole-order unavailability.
- RX-20 missing report and whole-order unavailability.
- RX-21 photo approval and customer cancel.
- RX-22 missing report and mark ready.
- RX-23 send photos and customer cancel.
- RX-24 send photos and missing report; photo requirement kept and cleared.
- RX-25 accept and customer cancel.
- RX-26 photo-check expiry and missing report; photo requirement kept and cleared.
- RX-27 failed-conversion retry and late SDD 02 verification of the same payment, both orders.
- RX-28 reservation together with each Phase 9 publication function on the same book:
  `phase9_set_publication_state_v2`, `phase9_retry_publication_owner_v1` and
  `phase9_retry_publication_worker_v1`. After the forward lock-order migration there is
  no lasting deadlock. Before it lands, force SQLSTATE `40P01` and retry the whole 01
  transaction with the same key and command ID; no repeated hold, order or notice.
- RX-29 one pause cancelling several checkouts while two of them are being verified:
  every checkout gets exactly one outcome and no deadlock lasts.
