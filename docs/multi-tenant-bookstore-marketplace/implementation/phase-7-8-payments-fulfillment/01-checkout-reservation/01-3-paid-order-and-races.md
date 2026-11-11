# SDD 01, part 3: Paid-order commands and races

**Part of SDD 01.** Section numbers are those of the whole SDD, so a reference such as
"SDD 01 §5.3" means §5.3 in whichever part holds it. The map is in the
[overview](./01-0-overview.md). The full single-file copy
[01-checkout-reservation-sdd.md](../01-checkout-reservation-sdd.md) is kept for reference
only; build from these parts.

---

## 6. Paid-order commands

Each follows the §7 lock order, checks the version, and re-checks its guard (master §14).
A command that will request a refund locks the payment row (SDD 02) before the order row.
Store commands require `has_phase6_owner_capability(store, 'phase6_order_commands')`, which
checks an active owner of that store with the entitlement; otherwise
`COMMERCE_ENTITY_UNAVAILABLE`. Customer commands require the caller to be the order's
`user_id`, with the same refusal. A command on a cancelled order raises
`ORDER_ALREADY_CANCELLED` ("This order was cancelled.").

Every command that cancels an order also closes any open missing-book report as
`cancelled_all`, setting `outcome_at` and `outcome_by` to its actor (`store`, `customer`
or `system`); clears `missing_outcome_pending`; resolves all of the order's open tasks
except an unsent `receipt_email`, which keeps running because the receipt is still owed
(D-50, §8.1);
and asks SDD 04 to refund only what has not already been refunded. Closing the report does
not change that cancellation's reason, fault or refund category; §6.4 keeps its existing
rule. An order records at most one store fault, whichever events it goes through (§17).

Every deadline below is checked using `clock_timestamp()` read after all required
locks, including the order row lock. At a time equal to or after the deadline, refuse the action and leave its timer to
act. A late worker never extends the customer's or store's action window.

| Command or case | Refusal | Code | Message |
|---|---|---|---|
| Any caller without access | Caller cannot act on this order | `COMMERCE_ENTITY_UNAVAILABLE` | This order is not available. |
| A versioned command | Version no longer matches | `STALE_VERSION` | This order has changed. Please review it. |
| Any paid-order action on `cancelled` | Already cancelled | `ORDER_ALREADY_CANCELLED` | This order was cancelled. |
| `accept_order`, `report_missing_books`, `record_missing_outcome`, `report_order_unavailable`, `cancel_paid_order`, `send_requested_photos`, `respond_to_photos`, `mark_order_ready` | State or photo guard in §6.1 to §6.7 does not allow the action | `ORDER_STATE_INVALID` | This order can't do that right now. |
| `report_missing_books`, `mark_order_ready` | An outcome is still pending | `MISSING_OUTCOME_PENDING` | Please record the missing-book outcome first. |
| `record_missing_outcome` | No outcome is pending | `MISSING_OUTCOME_NOT_PENDING` | There is no missing-book outcome to record. |
| `report_missing_books` | Every remaining copy was selected | `USE_ORDER_UNAVAILABLE` | Please use "I don't have any of these". |
| `report_missing_books`, `record_missing_outcome`, `respond_to_photos` | Invalid items, quantities, outcome, decision or required rejection reason | `INVALID_COMMAND` | Please check your choices and try again. |
| `accept_order`, `report_missing_books` on `awaiting_store` | Time is at or after `acceptance_due_at` | `ACCEPTANCE_DEADLINE_PASSED` | The 24 hours to accept this order have passed. |
| `send_requested_photos` | Photos are missing, not validated or not viewable for a remaining requested book | `PHOTOS_INCOMPLETE` | Please add photos for every requested book. |
| `send_requested_photos` | Time is at or after `photo_send_due_at` | `PHOTO_DEADLINE_PASSED` | The time to send these photos has passed. |
| `respond_to_photos` | Time is at or after `photo_check_due_at` | `PHOTO_DEADLINE_PASSED` | The time to check these photos has passed. |
| `record_missing_outcome` | Time is at or after `missing_outcome_due_at` | `MISSING_OUTCOME_WINDOW_PASSED` | The 24 hours to record the outcome have passed. The system will keep the rest. |
| `mark_order_ready` | Time is at or after `preparation_expires_at` | `PREPARATION_DEADLINE_PASSED` | The time to prepare this order has passed. |
| `report_missing_books` | Time is at or after `preparation_expires_at` (D-96) | `PREPARATION_DEADLINE_PASSED` | The time to prepare this order has passed. |
| `report_missing_books` | Photos are requested and unsent, and time is at or after `photo_send_due_at` (D-96) | `PHOTO_DEADLINE_PASSED` | The time to send these photos has passed. |

Check access and cancelled state, then version, before the action's state, pending-outcome,
input and deadline guards. Timers use their state and due-time guards and do nothing when
those no longer match; they do not raise these user-action refusals.
`acknowledge_store_alert` uses the owner access check and records the fact once (§8.4).

### 6.1 `accept_order` (store)

Guard: status `awaiting_store`; `clock_timestamp()` read after the locks is before `acceptance_due_at`, otherwise
`ACCEPTANCE_DEADLINE_PASSED` (§6 table). Effects: `accepted`, `accepted_at`, `accepted_by`,
`acknowledged_via = 'accept'`; resolves `acceptance_reminder`, `acceptance_escalation`,
`acceptance_expiry`; notice to the customer ("The store accepted your order"). If no photos
were requested, the D-79 times are set and their two tasks opened (§8.3). If
`photo_requested_at_payment`, the order stays `accepted` until the photos are sent (§6.5),
and the D-79 times and tasks wait for the customer's approval.

### 6.2 `report_missing_books` (store), in two steps (D-61, D-83, D-94)

Step one, `report_missing_books(p_order_id, p_expected_version, p_items JSONB,
p_idempotency_key, p_command_id)`, where `p_items` lists each item's ID and how many copies
are missing:

- Guards: status `awaiting_store`, `accepted` or `awaiting_photo_check` (D-83: any time before
  ready); on `awaiting_store`, `clock_timestamp()` read after the locks is before `acceptance_due_at`, otherwise
  `ACCEPTANCE_DEADLINE_PASSED`; no outcome already pending; the list is not empty; every item ID
  is an `active` item of this order and each quantity is above 0 and at most the copies left
  on it (`INVALID_COMMAND`); at least one copy stays on the order (if every book is
  missing, the store must use `report_order_unavailable`, raised as `USE_ORDER_UNAVAILABLE`).
- Effects: a row in `order_missing_reports` with its items (§3.11). Each item's
  `removed_quantity` goes up by the copies reported; an item with none left becomes
  `removed_unavailable`. Those copies are written off (§9). `missing_outcome_pending = true`,
  `missing_reported_at = clock_timestamp()` read after the locks,
  `missing_outcome_due_at = missing_reported_at + 24 hours`. On an
  `awaiting_store` order this is the acknowledgement: status `accepted`,
  `acknowledged_via = 'missing_report'`, the three acceptance tasks are resolved (D-94), and
  the D-79 times are set as in §6.1: with a photo requirement still in force, they wait for
  photo approval. An order in `awaiting_photo_check` stays there with the
  mark set; approval returns it to `accepted` with the mark kept, and a rejection or expiry
  cancels the whole order. If no copy of any `photo_requested` item is left, the photo step
  no longer applies: `photo_requirement_cleared_at` is set, tasks `photo_send_expiry` and
  `photo_check_expiry` are resolved, an order in `awaiting_photo_check` returns to `accepted`,
  and the D-79 times are set if they are not yet (§17). A store fault is recorded (D-61,
  D-21). Task `missing_outcome_expiry` opened. Notice to the customer ("The store could not find one of
  your books and will call you").
- No refund yet.

Step two, `record_missing_outcome` with §5.0's exact parameters and outcome
`keeps_rest` or `cancelled_all`:

- Guard: `missing_outcome_pending`, otherwise `MISSING_OUTCOME_NOT_PENDING`;
  `clock_timestamp()` read after the locks is before `missing_outcome_due_at`, otherwise `MISSING_OUTCOME_WINDOW_PASSED`. The
  timer records `keeps_rest` after that deadline (D-83). Both store outcomes close the open
  report with `outcome_at` and `outcome_by = 'store'`, and resolve its `missing_outcome_expiry` task.
- `keeps_rest`: clears the mark; asks SDD 04 for a partial refund of **this report's** copies
  only (their quantity times `unit_price_minor`, category 3), with the report ID as the key,
  so an earlier report is never refunded twice; the order continues. The delivery charge is
  not refunded (Q65).
- `cancelled_all`: status `cancelled`, reason `customer_cancelled_after_missing`, fault
  `store`; remaining copies restocked (§9); SDD 04 asked for a full refund, less anything
  already refunded (category 4). No second store fault.
- After `keeps_rest`, if `preparation_expires_at` is set and is earlier than the closing time
  of the next open day after the outcome, it is rewritten to that closing time and a new
  `preparation_expiry` task is opened for it, so the store always has a full open day left
  (§6.6, §8.1). In the same transaction, first resolve the old `preparation_expiry` as
  `resolved_noop` when it is `open`, `in_progress` or `retry_scheduled`; only then
  insert its replacement. They never stay open together. A worker finishing the resolved
  old task records nothing and returns no-op. A task already closed needs no second close.
  Every repeated `missing_outcome_expiry` follows the same resolve-before-insert rule.

`expire_missing_outcome` (timer): acts only if the mark is still set and the task's due time
equals `missing_outcome_due_at`; the system then records `keeps_rest` itself with
`outcome_by = 'system'` (D-83). This timer applies the outcome itself; it does not call the
store command whose deadline has passed. A timer
left over from an earlier report therefore does nothing.

While the mark is set the order cannot be marked ready (`MISSING_OUTCOME_PENDING`), and a
second report is refused until the first has an outcome.

### 6.3 `report_order_unavailable` (store)

Guard: status `awaiting_store`, `accepted` or `awaiting_photo_check`. Effects: `cancelled`,
reason `store_unavailable`, fault `store`; every active item written off (§9); full automatic
refund requested (category 2); store fault recorded (Q55, D-15, D-21).

### 6.4 `cancel_paid_order` (customer, before ready)

Guard: status `awaiting_store`, `accepted` or `awaiting_photo_check`. After the order is
ready the cancel belongs to SDD 06 or SDD 07. Effects: `cancelled`, reason
`customer_cancelled`, fault `customer`; remaining copies go back on sale (§9); full automatic
refund requested, less anything already refunded (category 7; Q45, D-67, D-91).

If a missing-book outcome is pending, the customer's cancel is the "cancelled all" outcome
instead: reason `customer_cancelled_after_missing`, fault `store`, category 4, and the report
is closed with outcome `cancelled_all` (D-61, §17). The store fault already recorded stands.
If an earlier report was settled as "keeps the rest" and none is pending, it is an ordinary
customer cancel of what remains; the earlier partial refund and store fault stand.

### 6.5 Photos (D-43, D-53), only when `photo_requested_at_payment`

| Command | Actor | Guard | Result |
|---|---|---|---|
| `send_requested_photos` | Store | `accepted`; photos not yet sent; requirement not cleared; Phase 9 validates viewable photos for every remaining requested item, otherwise `PHOTOS_INCOMPLETE`; `clock_timestamp()` read after the locks is before `photo_send_due_at`, otherwise `PHOTO_DEADLINE_PASSED` | `awaiting_photo_check`; `photos_sent_at`; `photo_check_due_at = photos_sent_at + 24 hours`; resolves `photo_send_expiry`; opens `photo_check_expiry`; notice to the customer |
| `respond_to_photos` approve (§5.0) | Customer | `awaiting_photo_check`; `clock_timestamp()` read after the locks is before `photo_check_due_at`, otherwise `PHOTO_DEADLINE_PASSED` | Back to `accepted`; `photos_approved_at` set; resolves `photo_check_expiry`; the promised day is worked out afresh and the D-79 times and tasks set (§8.3) |
| `respond_to_photos` reject | Customer | `awaiting_photo_check`; `clock_timestamp()` read after the locks is before `photo_check_due_at`, otherwise `PHOTO_DEADLINE_PASSED`; `p_reject_reason` is `does_not_match_listing` (shown as "Doesn't match the condition label or description") or `other` (shown as "Changed my mind"); `INVALID_COMMAND` if absent | `cancelled`, `photos_rejected`; full refund either way. For `does_not_match_listing`: fault `store`, one store fault, copy written off (D-43, D-21, D-103); the store may dispute it through SDD 08, where an admin compares the photos with the listing and its condition label and may change the fault to `no_fault`. For `other`: `no_fault` and the copy goes back on sale (D-43) |
| `expire_photo_send` | Timer at `photo_send_due_at` | Order `accepted`, photos not sent, requirement not cleared | `cancelled`, `photos_not_sent`, fault `store`; refund as unavailable; store fault |
| `expire_photo_check` | Timer | `awaiting_photo_check`, requirement not cleared | `cancelled`, `photos_not_answered`, `no_fault` (D-53); full refund; copy back on sale |

The photo upload and storage belong to Phase 9. Before slice 7 it must supply the full
§18 contract, including the request IDs kept on conversion, the completeness check and
the photo references shown on the customer screen. `send_requested_photos` refuses with
`PHOTOS_INCOMPLETE` ("Please add photos for every requested book.") unless every
remaining requested item passes that check. `photos_sent_at` uses post-lock
`clock_timestamp()`. These commands ship in slice 7 (§19); the test double covers the
contract, and customer use waits for the Phase 9 implementation.

### 6.6 Timer commands

| Command | Guard | Result |
|---|---|---|
| `send_acceptance_reminder` | `awaiting_store` at `acceptance_reminder_at` | In-app notice to the store (BC-12) |
| `escalate_acceptance` | `awaiting_store` at `acceptance_escalation_at` | Second notice to the store; item in the admin queue (BC-13, SDD 08) |
| `expire_unaccepted_order` | `awaiting_store` at `acceptance_due_at` | `cancelled`, `store_not_accepted`; items back on sale; full automatic refund (category 1). An order created by `retry_convert` is always fault `platform` (D-04; §5.10). Otherwise fault `store` only if `commerce.store_alert_channel_reliable` is true, `store_alert_delivered_at` is set, and no platform failure is recorded; otherwise `platform` (master §9; handoff §11 item 5). The refund never waits |
| `alert_unprepared_order` | `accepted`, not ready, at `preparation_alert_at` | Notice to the store; item in the admin queue (D-79) |
| `expire_unprepared_order` | `accepted`, not ready, at `preparation_expires_at` | `cancelled`, `not_prepared`, fault `store`; items back on sale; full automatic refund (category 19); store fault (D-79) |

Each timer command acts only if post-lock `clock_timestamp()` is at or after its due
time and that due time equals the matching column on the order, so an out-of-date or
early task does nothing. `expire_unprepared_order` also does nothing while a
missing-book outcome is pending; the task ends, and the outcome sets a new deadline and opens
a new task (§6.2). `alert_unprepared_order` fires as usual while an outcome is pending, since
it is only a notice.

### 6.7 Handing over to SDD 06 and SDD 07

`marketplace_sec.mark_order_ready` with §5.0's exact parameters is provided here and called by SDD 06
("Mark ready") and SDD 07 ("Packed"). Guards: `accepted`; no missing outcome pending; if
photos were requested, photos were approved, or `photo_requirement_cleared_at` is set;
`clock_timestamp()` read after the locks is before `preparation_expires_at`, otherwise
`PREPARATION_DEADLINE_PASSED`. It sets `ready_for_pickup` or `ready_to_ship`,
`ready_at`, and resolves `preparation_alert` and `preparation_expiry`. Everything after
that is theirs.

### 6.8 Order transitions owned here

| From | To | By |
|---|---|---|
| (payment) | `awaiting_store` | `convert_paid_checkout`, `resolve_late_payment` |
| `awaiting_store` | `accepted` | `accept_order`; `report_missing_books` |
| `awaiting_store` | `cancelled` | `expire_unaccepted_order`; `report_order_unavailable`; `cancel_paid_order` |
| `accepted` | `awaiting_photo_check` | `send_requested_photos` |
| `accepted` | `ready_for_pickup` / `ready_to_ship` | `mark_order_ready` |
| `accepted` | `cancelled` | `record_missing_outcome` (cancelled all); `report_order_unavailable`; `cancel_paid_order`; `expire_photo_send`; `expire_unprepared_order` |
| `awaiting_photo_check` | `accepted` | `respond_to_photos` (approve); `report_missing_books` when the photo requirement is cleared |
| `awaiting_photo_check` | `cancelled` | `respond_to_photos` (reject); `expire_photo_check`; `cancel_paid_order`; `report_order_unavailable`; `record_missing_outcome` (cancelled all) |

The trigger built here uses §6.8 itself as its transition table. It refuses every
unlisted status change and every change out of a final state. SDD 06 and SDD 07 extend
this trigger with their own transitions in their own migrations.

## 7. Races

Each is settled by the rule in master §14: lock the row, re-check the guard, first commit
wins, the loser does nothing or gets the stated error. Only the winner creates its notice,
refund or next timer. Each race has a test in both orders (§14).

| Test | Race | If A commits first | If B commits first |
|---|---|---|---|
| RX-01 | Two customers reserve the last copy | A holds it; B gets `INSUFFICIENT_INVENTORY` | The reverse |
| RX-02 | `expire_reservation` (A) and payment verification (B) | A found no success in a fresh read, so the checkout is `reservation_expired`; B then runs `resolve_late_payment` | Checkout `converted`; A does nothing |
| RX-03 | `cancel_reservation` (A) and payment verification (B) | `customer_cancelled`; B refunds in full (D-85) | `converted`; A gets `ORDER_ALREADY_PAID` |
| RX-04 | `cancel_for_store_ineligibility` (A) and payment verification (B) | `platform_cancelled`; B refunds in full | `converted`; the order continues (D-21) |
| RX-05 | `accept_order` (A) and `expire_unaccepted_order` (B) | `accepted`; B does nothing | `cancelled` and refunded; A gets `ORDER_ALREADY_CANCELLED` |
| RX-06 | `report_missing_books` (A) and `expire_unaccepted_order` (B) | `accepted` with the outcome pending; B does nothing (D-94) | `cancelled` and refunded in full; A gets `ORDER_ALREADY_CANCELLED` |
| RX-07 | `report_missing_books` or `record_missing_outcome` (A) and `cancel_paid_order` (B) | After a report, B closes it as `cancelled_all`, category 4. After `keeps_rest`, A's partial refund stands and B refunds the rest (SDD 04 §1) | Whole order refunded; A gets `ORDER_ALREADY_CANCELLED` |
| RX-08 | `send_requested_photos` (A) and `expire_photo_send` (B) | `awaiting_photo_check`; B does nothing | `cancelled`; A gets `ORDER_ALREADY_CANCELLED` |
| RX-09 | `respond_to_photos` (A) and `expire_photo_check` (B) | A's answer stands | `cancelled`; A gets `ORDER_ALREADY_CANCELLED` |
| RX-10 | `mark_order_ready` (A) and `expire_unprepared_order` (B) | Ready; B does nothing | `cancelled`; A gets `ORDER_ALREADY_CANCELLED` |
| RX-11 | `expire_unaccepted_order` and `expire_photo_send`, due at the same moment | The photo timer acts only on an `accepted` order, so an order never accepted is always the 24-hour case (category 1) | Same |
| RX-12 | Two late payments on two expired checkouts of one cart at the same version | The first converts; the second, waiting on the cart lock, then finds a converted checkout at that version and refunds | The reverse |
| RX-13 | `cancel_reservation` (A) and `expire_reservation` (B) | `customer_cancelled`; B does nothing | `reservation_expired`; A gets `COMMERCE_ENTITY_UNAVAILABLE` and the app shows the ended reservation |
| RX-14 | `cancel_for_store_ineligibility` (A) and `expire_reservation` or `expire_payment_grace` (B) | `platform_cancelled`; B does nothing | `reservation_expired`; A skips it, no longer live |
| RX-15 | `cancel_reservation` (A) and `expire_payment_grace` (B) | `customer_cancelled`; B does nothing | `reservation_expired`; A gets `COMMERCE_ENTITY_UNAVAILABLE` |
| RX-16 | `set_commerce_pause` for a D-81 kind (A) and `create_reservation` (B) | The pause is seen under the store lock; B gets `STORE_NOT_ACCEPTING_ORDERS` | B's checkout is committed before the pause gets the lock, so the pause finds and cancels it |
| RX-17 | Two conversions reaching the daily limit | The store lock makes them count one at a time; the one that reaches the limit sets the pause | The reverse |
| RX-18 | `expire_missing_outcome` (A) and `record_missing_outcome` or `cancel_paid_order` (B) | System `keeps_rest` stands; B's outcome gets `MISSING_OUTCOME_NOT_PENDING`, or B's cancel refunds the rest | B's result stands; A does nothing |
| RX-19 | `accept_order` (A) and `report_order_unavailable` (B) | `accepted`; B then cancels from `accepted` | `cancelled`; A gets `ORDER_ALREADY_CANCELLED` |
| RX-20 | `report_missing_books` (A) and `report_order_unavailable` (B) | Outcome pending; B cancels the whole order and closes the report; one store fault | `cancelled`; A gets `ORDER_ALREADY_CANCELLED` |
| RX-21 | `respond_to_photos` approve (A) and `cancel_paid_order` (B) | `accepted`; B cancels from `accepted` | `cancelled`; A gets `ORDER_ALREADY_CANCELLED` |
| RX-22 | `report_missing_books` (A) and `mark_order_ready` (B) | Outcome pending; B gets `MISSING_OUTCOME_PENDING` | Ready; A gets `ORDER_STATE_INVALID` |
| RX-23 | `send_requested_photos` (A) and `cancel_paid_order` (B) | Photo check started; B cancels it | Cancelled; A gets `ORDER_ALREADY_CANCELLED` |
| RX-24 | `send_requested_photos` (A) and `report_missing_books` (B) | B reports from `awaiting_photo_check`; it stays there unless the requirement is cleared, then `accepted` | B's report stands; A sends if photos remain required, or gets `ORDER_STATE_INVALID` if the requirement was cleared |
| RX-25 | `accept_order` (A) and `cancel_paid_order` (B) | Accepted; B cancels from `accepted` | Cancelled; A gets `ORDER_ALREADY_CANCELLED` |
| RX-26 | `expire_photo_check` (A) and `report_missing_books` (B) | Cancelled; B gets `ORDER_ALREADY_CANCELLED` | If B clears the photo requirement, A does nothing; otherwise A cancels and closes the report as `cancelled_all` |
| RX-27 | `retry_convert` (A) and late SDD 02 verification of the same payment (B), inside the D-04 window | One order; B returns the existing conversion | One order; A sees the converted checkout and does nothing |
| RX-28 | Reservation (A) and each of Phase 9's three publication functions in 0040 (B) on the same book | B waits in the shared store, stock, listing order; re-checks after A | A waits and re-checks stock/listing after B. Any `40P01` before the forward fix retries the whole 01 transaction with the same identities |
| RX-29 | One D-81 pause cancelling several live checkouts of a store (A) and payment verifications on two of them (B, C) at the same time | Each checkout is either cancelled with B or C then refunding in full by §5.6, or converted first and left for D-21; no deadlock lasts, and each checkout gets exactly one outcome | Same, in the other orders |

Action-first tests against their timers commit the action before its deadline; timer-first
tests run at or after it. At or after the deadline an action cannot win merely because its
timer has not run (§6).

**Lock order, for every command:** customer transaction advisory lock (on the customer's
ID, for guard 5), payment (SDD 02), cart, store, checkout, order, stock rows in ID order,
then listings. A command skips those it does not need but never takes them out of
order. `create_reservation` takes the store as `FOR SHARE`; `set_commerce_pause` and the
conversions take it `FOR UPDATE`, which is what closes the pause and daily-limit races.
Read `clock_timestamp()` only after all required locks for deadline checks (§5.0, §6).
Phase 9's three publication functions in 0040 currently take inventory before store; they
must change to store before inventory in a forward migration before slice 2 (§18, §20).
Until that change lands, SQLSTATE `40P01` retries the whole 01 transaction with the
same idempotency key and command ID; never retry only its last statement.
