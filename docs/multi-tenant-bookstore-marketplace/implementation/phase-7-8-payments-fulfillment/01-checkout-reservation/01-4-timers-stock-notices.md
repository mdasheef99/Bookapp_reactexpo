# SDD 01, part 4: Timers, stock, notices, receipt, screens, scans and Phase 6 rework

**Part of SDD 01.** Section numbers are those of the whole SDD, so a reference such as
"SDD 01 §5.3" means §5.3 in whichever part holds it. The map is in the
[overview](./01-0-overview.md). The full single-file copy
[01-checkout-reservation-sdd.md](../01-checkout-reservation-sdd.md) is kept for reference
only; build from these parts.

---

## 8. Timers

### 8.1 Task types added to the framework

| Task type | Entity | Due at | Command (exact contract in §5.0) |
|---|---|---|---|
| `reservation_expiry` | checkout | `reservation_expires_at` | provider read, then `expire_reservation` |
| `payment_grace_expiry` | checkout | `payment_grace_expires_at` | §5.4 provider read and termination, then `expire_payment_grace` |
| `terminate_provider_order` | checkout | Cancel or closure time; run through `next_attempt_at` | SDD 02's termination handler (§20); not a §5/§6 command. Until its slices exist, a stub records the request and resolves |
| `receipt_email` | order | Payment transaction; run through `next_attempt_at` | §11's sender handler; not a deadline command. One per order, dedupe key type plus order ID |
| `acceptance_reminder` | order | §8.2 | `send_acceptance_reminder` |
| `acceptance_escalation` | order | §8.2 | `escalate_acceptance` |
| `acceptance_expiry` | order | `acceptance_due_at` | `expire_unaccepted_order` |
| `photo_send_expiry` | order | `photo_send_due_at` | `expire_photo_send` |
| `photo_check_expiry` | order | `photo_check_due_at` | `expire_photo_check` |
| `missing_outcome_expiry` | order | `missing_outcome_due_at` | `expire_missing_outcome` |
| `preparation_alert` | order | `preparation_alert_at` | `alert_unprepared_order` |
| `preparation_expiry` | order | `preparation_expires_at` | `expire_unprepared_order` |

The framework's entity types gain `store_order`. A deadline task's dedupe key is its
type, entity ID and due time. An admin requeue (§5.9) adds the admin command ID, never
the requeue time; it keeps the original `due_at` and sets `next_attempt_at` to post-lock
`clock_timestamp()`. `receipt_email` uses only its type and order ID, without a due time.
The source's `replaced_by_task_id` returns an admin requeue's existing replacement (§5.9).
The key's unique index is permanent. A changed due time or admin requeue gets a new key.
A deadline task's command identity is its own ID; §5.0 gives its exact RPC parameters.

For every §8.1 type, open work under the entity's §7 locks. Reuse a task with the same
dedupe key. Before inserting a different key of the same type for that entity, resolve
any `open`, `in_progress` or `retry_scheduled` task as `resolved_noop`, in the same
transaction. This keeps 0003's `event_action_tasks_open_entity_type_unique` intact.
It applies to repeated `missing_outcome_expiry`, changed `preparation_expiry` and
`preparation_alert`, photo deadlines, repeated termination and admin requeue too.
New-checkout and new-order task types use the same opener; they have no earlier task.
The source of an admin requeue is already dead-lettered, so it is not open (§5.9).

A worker re-checks the task under lock before effects or completion. If replacement or
cancellation already resolved it, return `{"outcome":"noop"}` and record nothing.
Both `complete_commerce_timer_command` and `complete_phase6_task` keep that guard;
a worker finishing the old task cannot write another answer, completion, event or notice.
Normal timer replays return their stored answer when one exists and repeat no effect.

`receipt_email` runs outside database locks through the §11 sender. It reads the saved
email on the server, uses `receipt_email:<order id>` as the sender's idempotency key,
and sets `order_receipts.emailed_at` only after success. Without a sender, keep it
`retry_scheduled` with `transport_not_configured`; do not consume a send attempt or
resolve it as sent. It remains retrying until the dependency exists (§18, §19).

Every timer command in §5 and §6 claims through
`marketplace_sec.claim_commerce_timer_command(p_command_name TEXT, p_task_id UUID,
p_idempotency_key TEXT, p_request JSONB)`, then stores its answer through
`marketplace_sec.complete_commerce_timer_command(p_command_name TEXT, p_task_id UUID,
p_idempotency_key TEXT, p_response JSONB)` in the same transaction, unless the task
has already been resolved as above. These new helpers use
`commerce_idempotency_keys`, scoped as `timer:<command>:<task id>`; `logical_entity_id`
is the checkout or order ID read from the task, and `command_id` is the task ID.
They need neither an actor nor an expected version. They check that the registered task
matches the command and entity, hash the stable task request, and replay its stored
response without repeating effects. The stable request contains the entity ID and original
due time; refreshed provider-read timestamps are proof inputs, not a changed task request.
A failed transaction rolls back the claim so the task can retry.

Migration 0006's `claim_phase6_command` refuses a null actor. Migration 0017's
`claim_phase6_system_command` requires an expected version. Neither is used for these
timers. Both new helpers are private as §3.8 says.

The deadline timers here, for checkouts and orders, are guarded by status and due time, not by
version, because a row's version can change between the task being opened and it firing.
Treating a version change as "nothing to do" would silently drop the expiry and leave books
held. The worker gets a separate branch for them: it passes `p_task_due_at` and no expected
version. `source_request_version` is still filled in on checkout tasks, because the table
requires it, and is not read. A dead-lettered task opens an admin case (SDD 08). The client
shows countdowns for display only. `terminate_provider_order` is SDD 02's post-close task,
not a deadline command; it must run on a closed checkout too. `receipt_email` must also
run after an order has closed; neither is treated as a §5/§6 deadline command. Register it in migration 5;
the recording stub is used by tests until SDD 02 supplies its handler.

### 8.2 Open-hours timers (BC-12, BC-13)

The reminder is due when 30 minutes of the store's open time have passed since `paid_at`,
and the escalation at 45, worked out at payment with the existing schedule engine
(`add_store_open_seconds`), passing `commerce.schedule_horizon_days`. Store the results
in `acceptance_reminder_at` and `acceptance_escalation_at` and each task's `due_at`. If the store is closed when
the order is paid, the count starts at its next opening. If the engine finds no open time
within `commerce.schedule_horizon_days`, or a result would fall after `acceptance_due_at`,
that task is not opened and its column stays null; for the first case an admin case is
opened (§17). The 24-hour acceptance deadline runs on elapsed time whether the store is
open or not (D-04).

### 8.3 Promised day and the D-79 times (BC-14, D-34)

`promised_ready_by` is worked out at payment with the schedule engine, in the store's
timezone, using `commerce.schedule_horizon_days` for each search. "Closing time" means
the last closing time of that day's open hours.

- If the store has open hours today and `paid_at` is at least 2 hours before today's closing
  time, it is that closing time, whether or not the store is open at that moment (D-07,
  BC-14). The customer sees "expected today".
- Otherwise it is the closing time of the store's next open day. The customer sees
  "expected tomorrow", or "expected next opening day" when that is not tomorrow (handoff
  §11 item 24).

The D-79 times are set when the order is accepted, or on photo approval when photos were
requested and still required. Clearing the requirement starts them as §6.2 says:

- `preparation_alert_at` is `promised_ready_by` when the order is accepted before that time
  (D-79). When it is accepted later, it is the rule above applied to the acceptance time,
  so the store still gets a fair day and the alert is not lost (§17).
- `preparation_expires_at` is the closing time after
  `commerce.preparation_grace_business_days` open days following the alert day (default 1:
  the next open day's closing time). Changing the setting changes newly worked-out
  deadlines; stored times stay as below.
- On photo approval `promised_ready_by` is updated too, and the customer sees the new
  estimate (D-43).

These are shown as an estimate. The old emergency-pause clock is not kept (D-55).

Guard 7 of §5.1 finds an open day at reservation, but the schedule can change afterwards.
If the engine finds no open day when any of these times is worked out, that time is set
24 elapsed hours later and an admin case is opened, so no order is left without a deadline
(§17).

Times are worked out when stated above and stored. If a store changes its hours or adds a
closure later, the times already stored are not recalculated (§17); the next one to be worked
out uses the new schedule.

### 8.4 The store alert and the "alert delivered" fact (D-02, D-04)

The alert is the in-app notice "New paid order" to every active owner of the store,
created in the payment transaction. `store_alert_delivered_at` is set when the store app
confirms it showed the notice (`acknowledge_store_alert`, called from the owner's device) or when an
owner opens the order, whichever is first. Which extra channel makes this reliable before
live payments is open (D-02; §18). Until `commerce.store_alert_channel_reliable` is set,
every missed deadline is recorded as fault `platform`, never `store`, even if the fact is
recorded (handoff §11 item 5).

## 9. Stock rules

All in the same transaction as the command, under a lock on the stock row.

`marketplace_sec.restock_order_item` with §5.0's exact parameters
moves exactly `p_quantity` copies. `p_outcome` is one of the three values in the table
below. The caller holds the order row lock; take the stock lock in §7 order and record
the movement in
`order_item_stock_movements` (§3.13) in the same transaction. A recorded `movement_key`
does nothing on replay. Count earlier movements so no copy is moved out of sold twice.

- Missing write-off: key `report:<report id>:<item id>`, quantity from that report.
- Whole-order cancel: key `cancel:<order id>:<item id>`, quantity still left on the item,
  excluding copies already moved by a missing report.
- Pickup and return callers use `pickup:<order id>:<item id>` and
  `return:<case id>:<item id>` (§20).

| Helper | Movement | Used by |
|---|---|---|
| `create_reservation_holds` | available → reserved; one `firm` `active` hold per item, from `requested_quantity` | `create_reservation` |
| `release_request_holds` (exists) | reserved → available; hold `released` | cancel, expiry, ineligibility |
| `convert_request_holds` | reserved → sold; hold `converted_to_sale` | `convert_paid_checkout` |
| late-payment take | available → sold; hold row written as `converted_to_sale` | `resolve_late_payment` |
| `restock_order_item` with `returned_to_sale` | sold → available | book still at the store: 24-hour expiry, customer cancel, photo silence, photo rejection for another reason, not prepared, missed pickup, refused pickup where the copy matches |
| `restock_order_item` with `written_off` | sold → removed | the store does not have the book: categories 2, 3, 4, photos not sent, photos rejected as not matching |
| `restock_order_item` with `awaiting_relist` | sold → removed | a refused copy that does not match its listing; a returned book; a parcel back at the store. The store re-lists it after checking it, through its inventory screens |

Every command releases or converts the holds before it changes the checkout's status,
because the terminal guard fails if an active hold remains.

The balance CHECK on `store_inventory` proves every movement keeps the total. The partial
unique index on active holds, with the `quantity_available >=` guard, proves one copy is
never held or sold twice (handoff §11 item 1).

The listing follows the stock by itself: `sync_marketplace_listing_from_inventory` marks it
`out_of_stock` at 0 and `active` above 0. That same trigger raises
`P9_PUBLICATION_INELIGIBLE` when `quantity_available` changes on a published row that has
become ineligible for any reason other than stock, such as a store suspension or an open
moderation flag. A hold, sale, release, restock or late take must never fail for that
reason, or a customer's stock or refund could be stuck. The trigger needs to skip that
check on stock-only changes. It belongs to the Phase 9 lane, so it is raised there (§18).

## 10. Events and notices (in-app only, D-02)

Registered in the event and notification registry (migration 0024's framework). The existing
validators only cover `order_request.*` and `marketplace_cart.*` events and two entity types,
so they get new versions (§15). `checkout.*` events are on the checkout entity; `order.*`
events are on the `store_order` entity. Each event is registered with schema version 1,
entity `store_order_request` for `checkout.*` or `store_order` for `order.*`, and a
separate notification type for each notice audience: `commerce.<event>.customer` or
`commerce.<event>.store`. Each type has exactly that audience in the registry (§3.9
group 5). The `commerce.` prefix is required by 0025's inbox and mark-read functions.

| Event | To customer | To store | Notification types |
|---|---|---|---|
| `checkout.reserved` | none (the screen shows the countdown) | none | none |
| `checkout.converted` | none | none | none |
| `checkout.payment_pending` | none (entering `awaiting_payment_result`; the screen shows it) | none | none |
| `checkout.expired` | "Your reservation ended. You were not charged." Only for expiry with no attempt | none | `commerce.checkout.expired.customer` |
| `checkout.payment_not_received` | "We have not received your payment. If you were charged, it will be refunded automatically." Grace end with `payment_failed`, or another expiry after an attempt | none | `commerce.checkout.payment_not_received.customer` |
| `checkout.cancelled` | none | none | none |
| `checkout.platform_cancelled` | "This store cannot take your order right now. You have not been charged; if you were, it will be refunded automatically." (§5.7) | none | `commerce.checkout.platform_cancelled.customer` |
| `order.placed` | "Order placed. The store has 24 hours to accept." | "New paid order. Accept it or report a problem." | `commerce.order.placed.customer`; `commerce.order.placed.store` |
| `order.acceptance_reminder`, `order.acceptance_escalated` | none | "A paid order is waiting for you." | `commerce.order.acceptance_reminder.store`; `commerce.order.acceptance_escalated.store` |
| `order.accepted` | "The store accepted your order. Expected today / tomorrow." | none | `commerce.order.accepted.customer` |
| `order.missing_reported` | "The store could not find a book and will call you." | none | `commerce.order.missing_reported.customer` |
| `order.missing_outcome_recorded` | "You are keeping the rest. ₹X will be refunded in 2–3 working days." | "Outcome recorded." | `commerce.order.missing_outcome_recorded.customer`; `commerce.order.missing_outcome_recorded.store` |
| `order.photos_sent` | "The store sent the photos you asked for. Please check within 24 hours." | none | `commerce.order.photos_sent.customer` |
| `order.photos_approved` | none | "The customer approved the photos." | `commerce.order.photos_approved.store` |
| `order.cancelled` | Wording by reason, always with the refund amount and "2–3 working days" (D-48) | Wording by reason | `commerce.order.cancelled.customer`; `commerce.order.cancelled.store` |
| `order.late_payment_converted` | "Your payment arrived late, and your order is placed." | as `order.placed` | `commerce.order.late_payment_converted.customer`; `commerce.order.late_payment_converted.store` |
| `checkout.late_payment_refunded` | By reason, always with ₹X and "will be refunded in 2–3 working days". Book gone: "Your payment arrived after the reservation ended and the book was no longer available." Cancelled: "You cancelled, but the payment still went through." Store ineligible: "This store can no longer take your order." Same cart: "You already have an order for these books, so this extra payment is being returned." | none | `commerce.checkout.late_payment_refunded.customer` |
| `checkout.duplicate_payment` | "You paid twice. The extra ₹X will be returned to you within 2–3 working days after Cashfree reverses it." Emitted once per duplicate when SDD 02 §13.2 records it (D-108) | none | `commerce.checkout.duplicate_payment.customer` |
| `order.preparation_alert` | none | "This order should be ready by now." | `commerce.order.preparation_alert.store` |

Notices never contain the customer's phone or address (master §14). The confirm-first
events and notices stay registered until the old step is retired. Commands in §5 and §6
write the corresponding registered event in this table in the same transaction as their
effect; a replay or a timer that does nothing creates no new event or notice.
Both `order.placed` audiences are written in that same payment transaction. Each recipient
sees their own type in the commerce inbox and can mark it read (E-18).
Receipt email is the separate `receipt_email` task (§8.1, §11), not an in-app notice type.

## 11. Receipt (D-50)

Created in the payment transaction as a row in `order_receipts` (§3.10). Always shown in the app on the order. Emailed too
when the customer gave an email; no SMS. Who is named as issuer waits on CA question 7;
until then the receipt is labelled "Payment receipt" and names the store as seller and
BookConnect as the platform, and is not called a tax invoice. A refund adds a refund note
to the same order (SDD 04).

When the saved contact contains an email, the payment transaction also opens
`receipt_email`, entity order, dedupe key `receipt_email:<order id>`. Its worker sends
the saved receipt through an email sender outside locks, then sets `emailed_at`.
The sender must accept that stable key, so a replay, including a crash after send but
before recording success, sends one email per order. A test double proves the contract.
The current worker has no email transport: non-push delivery returns
`transport_not_configured`. This handler must keep the task retrying until the sender
is supplied (§8.1). The sender is needed before live payments (D-50; §18, slice 10 in §19).
The §13 scan reports receipts still unsent after 24 hours.

## 12. Screens

**Customer**

| Screen | Shows | Actions |
|---|---|---|
| Cart | Items, prices (with the printed price and saving when recorded, §3.5), total, pickup or delivery. When the store's next opening, from the schedule engine, is 24 hours or more away: "This store is closed until {day, time}. If it can't accept your order within 24 hours of payment, you'll get a full refund automatically." (D-04, D-07). The warning informs only; it never blocks payment | "Reserve and pay". Each guard's message from §5.1 |
| Paying | The amount, a 10-minute countdown, the payment page (SDD 02) | "Cancel" |
| Waiting for payment result | "We are confirming your payment. Please do not pay again." | "Cancel" (a payment that still succeeds is refunded in full) |
| Reservation ended, no payment attempt | "Your reservation ended. You were not charged." | "Back to cart" |
| Payment not received (`payment_failed` at grace end, or expiry after an attempt) | "We have not received your payment. If you were charged, it will be refunded automatically." | "Back to cart" |
| Payment refunded | The reason (§10), the amount, "2–3 working days" | "Back to cart" |
| Order detail | Order number, items, amounts, receipt, the Phase 9 photo references for each requested item (§18), status in plain words, "expected today / tomorrow / next opening day", refund notes | "Cancel order" until ready; "Approve" or "Reject" photos. "Reject" asks for the reason: "Doesn't match the condition label or description" or "Changed my mind" (§6.5, D-103) |

**Store owner**

| Screen | Shows | Actions |
|---|---|---|
| Paid orders | New, accepted, ready, with the time left to accept | Open an order |
| Order detail | Items, pickup or delivery, the customer's phone once the order is paid, time left | "Accept"; "A book is missing" (choose books and how many copies, then record the outcome after calling the customer); "I don't have any of these"; "Send photos"; "Mark ready" (SDD 06) |
| Settings | "Pause online orders" switch (D-07) | Turn on or off (`set_store_self_pause`, which calls `set_commerce_pause` for `store_self_pause` only) |

No substitutes and no price changes are offered anywhere (D-35, D-42). Every refusal shows
the message from this document, never a raw code. Accessibility follows the existing
commerce screens: every action reachable by screen reader, countdowns announced at a
sensible interval, colour never the only signal.

For the coder: reads come from `customer_checkout_detail`, `customer_order_detail` and list,
`owner_order_detail` and list.

## 13. Reconciliation scans added

Daily, each opening a case when it finds a row: a `reserved` checkout past its expiry by
more than 5 minutes with no open task; an active hold on a closed checkout; a `converted`
checkout with no order, or an order with no converted checkout; an order `awaiting_store`
past `acceptance_due_at`; an order with `missing_outcome_pending` past its due time; a sold
quantity that does not match the order items; an uncleared pause of a D-81 kind with a
live checkout for that store; a checkout in `awaiting_payment_result` past
`payment_grace_expires_at` by more than 5 minutes; an order `accepted` past
`preparation_expires_at` with no outcome pending; an order past `photo_send_due_at` with
photos not sent, or past `photo_check_due_at` still in `awaiting_photo_check` (both photo
scans skip orders with `photo_requirement_cleared_at` set); an order in `awaiting_store`,
`accepted` or `awaiting_photo_check` with no open timer task; an order with
`missing_outcome_pending` and no open `missing_outcome_expiry` task for its current due time;
a dead-lettered task of any §8.1 type, including `terminate_provider_order`; a verified
payment on a checkout neither converted nor refunded, including an unresolved
`conversion_failed` case (§5.10); an open missing-book report on an order with no outcome
pending; an open platform incident lasting more than 24 hours; a stock movement whose
recorded quantity or outcome does not match the stock change (§3.13, §9); a receipt whose
customer gave an email but whose `emailed_at` is null more than 24 hours after
`issued_at` (§17 item 31); a failed-conversion case past its 7-day deadline,
which the admin queue escalates to the owner without releasing holds (§5.10, D-95).

A matching open timer has the right type and current due time. An old
`preparation_expiry` is resolved before its replacement is inserted (§6.2, §8.1);
two open tasks of one entity/type are never allowed. Keep the `duplicate_active_task`
scan; there is no exemption for these types. Reconciliation never resolves any §8.1
task because the row version changed. It leaves post-close `terminate_provider_order`
and unsent `receipt_email` work open (§15).

## 15. Phase 6 rework

| Area | Action |
|---|---|
| `submit_order_request` | The old function uses a different lock order and is closed to new carts from slice 2. Its new version also refuses a cart with a live or converted pay-first checkout. When the new screens ship (slice 8), `EXECUTE` is revoked from `authenticated`. Removed when the old step is retired |
| Cart commands: `marketplace_add_cart_item`, `marketplace_set_cart_item_quantity`, `marketplace_remove_cart_item`, `marketplace_get_or_create_cart`, `marketplace_confirm_cart_replacement` | New versions refuse changes, abandonment and replacement while a checkout is live. They no longer call `evaluate_phase6_eligibility`; they call `evaluate_reservation_eligibility` in its cart mode, which skips the open-day and online-payment checks, and they no longer read `pickup_available` |
| `cart_safe_projection` | New version shows the current `selling_price_minor`, not the lower of the two prices, each book's `printed_mrp_minor`, and the store's next opening time from the schedule engine for the closure warning (§12) |
| `execute_support_intervention` | New version refuses `support_cancel_request` on a pay-first row. Its closed-state list would otherwise let support cancel a live checkout outside D-81 |
| `validate_phase6_event`, `validate_phase6_notification`, `validate_phase6_audit`, `marketplace_notifications_safe_route` | New versions also cover `checkout.*` and `order.*` events and the `store_order` entity: the customer and store are read from `store_orders`, safe-payload checks apply, and the routes gain `customer_order` and `owner_order`. Without this a notice on a paid order fails and rolls back the payment |
| `reconcile_phase6_operations` (0033) | Exempt every §8.1 type from version-based cleanup (`t.source_request_version<>r.version`). Keep the `duplicate_active_task` scan: resolve old work before replacement (§6.2, §8.1), so two open tasks of one entity/type cannot coexist. The second exemption keeps post-close `terminate_provider_order` and unsent `receipt_email` work open |
| `claim_phase6_command`, `claim_phase6_system_command` | Left as they are. All §5 and §6 timers instead use new `claim_commerce_timer_command` and `complete_commerce_timer_command` (§8.1): task-scoped, no actor and no expected version |
| `snapshot_submission_schedule` trigger | New version: on a pay-first row, a planned closure does not refuse the insert (D-07) |
| `evaluate_phase6_eligibility` | Left as it is for the old `submit_order_request`; new `evaluate_reservation_eligibility` keeps its store, subscription, entitlement, rollout and owner checks and drops `pickup_enabled` and the delivery minimum and threshold |
| `snapshot_submission_policies` | Left as it is; `snapshot_reservation_policies` is new |
| `create_bucket_transfer_holds` | Left as it is; `create_reservation_holds` is new |
| `cancel_for_store_ineligibility` | Replaced by §5.7 |
| `enforce_phase6_terminal_invariants` (the terminal guard) | New version also checks `reservation_expired` and `converted`; today's list does not name them |
| Store confirm, partial confirm, clarification, customer acceptance, their timers and triggers | Left in place and unreachable from the new screens; retired later |
| Confirmation-window calculator, emergency-pause clock | Not called by pay-first (D-04, D-55) |
| `enrich_phase6_deadline_task`, `schedule_phase6_deadline_task` | New versions know every §8.1 type, including `terminate_provider_order` and `receipt_email`, preserve original deadline `due_at` on requeue and honour `next_attempt_at` (§5.9). Reuse the same dedupe key or resolve the prior open task before inserting a replacement. Registry, `replaced_by_task_id` and helpers ship in migration 5 |
| `commerce-task-worker` | Deadline branch uses §5.0's exact parameters, original due time and no expected version; reservation expiry follows §5.3 and grace expiry follows §5.4. `next_attempt_at` controls admin requeues. `terminate_provider_order` uses SDD 02's handler or stub. `receipt_email` uses §11's sender and stays retrying without it. `complete_phase6_task` and timer completion record nothing if replacement already resolved the task |
| Registry, projections, reconciliation, observability | Rows and functions added (§10, §12, §13) |
| `stores.pickup_enabled` and its policy key | Not read: pickup is always offered (handoff §11 item 15) |
| Frontend vocabulary, labels, screens, services, hooks | Changed as in §12 |
| Static SQL tests that assert the old state list | Updated in the same slice as the change they cover |

The old Phase 6 decision step is retired only after the Phase 9 lane's photo-request rework
lands (handoff §9). Until then both sets of functions exist; only the new one is reachable.
