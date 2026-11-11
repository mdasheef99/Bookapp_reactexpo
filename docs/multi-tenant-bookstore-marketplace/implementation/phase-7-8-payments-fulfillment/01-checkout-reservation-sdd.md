# SDD 01: Reserve-First Checkout and Paid-Order Acceptance

> **Reference copy only (2026-11-11).** This single file was split by topic into the six
> parts in [01-checkout-reservation/](./01-checkout-reservation/01-0-overview.md), with the
> same section numbers. Build from and edit the parts; this copy is kept in step with
> them for reference and may be renamed later. Any edit must be made in both.

**Status:** full draft, 2026-11-11, owner decisions on §17 applied (D-95 to D-103), plus the late-payment table, closure warning, printed price and RX-29 from the owner's outside review, corrected against the Phase 6 code and traced to the
register. First paired review done; the third review's findings and the final check's four
findings are applied. Not approved. No code
or migration may be written from it until the owner approves it.
**Authority:** none yet. Business rules come from the
[decision register](../PHASE-7-8-decision-register.md); this document must not add any.
Where it had to choose something the register does not decide, the choice is listed in
§17 for the owner.
**Owns:** the change from "store confirms, then customer pays" to "reserve, pay, then store
accepts" (BC-08, P-5 step 1); the paid order from payment until it is ready; the Phase 6
rework; the record of pauses.
**Related:** [master](./00-master-state-model-sdd.md) · [payments](./02-cashfree-payments-sdd.md) ·
[refunds](./04-refunds-returns-recovery-sdd.md) · [pickup](./06-pickup-sdd.md) ·
[Phase 6 impact check](../PHASE-7-8-phase6-impact-check.md)

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

## 3. Data model

All changes are new migrations. Applied migrations are never edited. Money is whole paise
in `INTEGER` columns ending `_minor`, as in Phase 6.

### 3.1 `store_order_requests` (the checkout): changes

| Change | Detail |
|---|---|
| Status CHECK | Drop and re-add with the 12 old values plus `reserved`, `awaiting_payment_result`, `converted`, `reservation_expired`. `customer_cancelled` and `platform_cancelled` already exist and are reused. Old values stay legal so old functions still compile; no new row uses them |
| Default status | Remove the default `submitted`; `create_reservation` always sets `reserved` |
| `UNIQUE (cart_id)` | Drop. Add two partial unique indexes: `store_order_requests_one_live_per_cart` on `(cart_id)` where status is `reserved` or `awaiting_payment_result`, and `store_order_requests_one_order_per_cart_version` on `(cart_id, cart_version_at_reservation)` where status is `converted`. A cart can be reserved again after an expiry or cancel, and the same cart contents can never produce two orders. A cart changed after an expiry can still be reserved even if the old checkout later converts (§5.6). A third, `store_order_requests_one_legacy_per_cart` on `(cart_id)` where `money_calculator_version <> 2`, keeps the old one-request-per-cart rule for confirm-first rows |
| `confirmation_reminder_at`, `confirmation_due_at` | `DROP NOT NULL`. Left empty by pay-first |
| `provisional_delivery_tariff_minor`, `delivery_tariff_version`, `money_calculator_version` | Stay NOT NULL. Pay-first writes the delivery charge (0 for pickup), `1`, and `2` (the pay-first calculator) |
| New `reservation_expires_at TIMESTAMPTZ` | Set at reservation; required when status is `reserved` (CHECK) |
| New `cart_version_at_reservation INTEGER` | The cart's version when reserved; a late conversion uses it (§5.5) |
| New `payment_grace_expires_at TIMESTAMPTZ` | Set when the row enters `awaiting_payment_result` |
| New `delivery_quote_id UUID` | Nullable; no foreign key until SDD 07 creates `delivery_quotes` |
| New `closed_reason_code TEXT` | Why a checkout closed: `timer`, `payment_failed`, `customer`, `store_fraud_suspended`, `store_payment_permission_lost`, `store_closed_by_admin`, `conversion_failed` (admin refund of a failed conversion, D-95, §5.10) |
| `final_subtotal_minor`, `final_delivery_tariff_minor`, `final_total_minor` | Reused. Written once at reservation and never changed; this is the amount SDD 02 asks Cashfree to collect |
| New CHECK `store_order_requests_reserved_amounts` | When `money_calculator_version = 2`: `final_total_minor = final_subtotal_minor + final_delivery_tariff_minor`, `fee_minor = 0`, `discount_minor = 0`. The store sets prices and discounts in its inventory screens (BC-04; master §12); checkout reads the current `selling_price_minor`, already after discount, and stores no checkout-level discount. The book's printed price is kept per item (§3.2, §3.5), so the price and its saving are both recorded (BC-05) |
| New index | `(reservation_expires_at)` where status is `reserved` |

A row is a pay-first row when `money_calculator_version = 2`.

### 3.2 `store_order_request_items`: one new column

New nullable `printed_mrp_minor INTEGER`, CHECK `IS NULL OR >= 0`: the book's printed
price (MRP) from `store_inventory.printed_mrp_minor`, read with the selling price at
reservation. It is shown only; it never changes the amount charged. Null when the store
recorded no printed price.

Pay-first writes `requested_quantity`, `server_bound_unit_price_minor` and
`printed_mrp_minor`, and leaves
`confirmed_quantity`, `confirmed_unit_price_minor` empty. `confirmation_status` stays at
its default `requested` and is not read.

### 3.3 `inventory_holds`: no column change

Pay-first holds are `hold_type = 'firm'`. `expires_at` is the reservation end, and is moved
to the grace end if the checkout enters `awaiting_payment_result`. A hold is a record; the
server timer, not `expires_at`, releases it. A failed paid conversion keeps the holds active
and extends `expires_at` as §5.10 says.

### 3.4 New `store_orders` (the paid order)

| Column | Type | Rule |
|---|---|---|
| `id` | UUID PK | |
| `order_number` | TEXT UNIQUE NOT NULL | Shown to people. `BC-` plus a sequence number, for example `BC-100042` |
| `order_request_id` | UUID NOT NULL UNIQUE, FK `store_order_requests` | One order per checkout |
| `payment_id` | UUID NOT NULL UNIQUE | The verified payment (SDD 02). FK added by SDD 02's migration |
| `store_id` | UUID NOT NULL, FK `stores` | Copied from the checkout, never from the app |
| `user_id` | UUID NOT NULL, FK `auth.users` | The customer |
| `status` | TEXT NOT NULL | CHECK: the 12 values in master §6 |
| `cancel_reason_code` | TEXT | Required when `cancelled` (CHECK). Values in §3.7 |
| `fault_cause` | TEXT | `store`, `customer`, `delivery_provider`, `platform`, `unclear`, `no_fault` (master §9). Required when `cancelled` |
| `fulfillment_method` | TEXT NOT NULL | `pickup` or `delivery` |
| `currency_code` | CHAR(3) NOT NULL | `INR` |
| `book_total_minor` | INTEGER NOT NULL | CHECK `>= 0`. Sum of the items as paid |
| `delivery_charge_minor` | INTEGER NOT NULL | CHECK `>= 0`. 0 for pickup |
| `total_paid_minor` | INTEGER NOT NULL | CHECK `>= 0` and `= book_total_minor + delivery_charge_minor` |
| `paid_at` | TIMESTAMPTZ NOT NULL | Time the payment was verified |
| `acceptance_due_at` | TIMESTAMPTZ NOT NULL | `paid_at` + 24 hours (D-04) |
| `acceptance_reminder_at`, `acceptance_escalation_at` | TIMESTAMPTZ, nullable | Set at payment by §8.2; null when that task is not opened |
| `accepted_at`, `accepted_by` | TIMESTAMPTZ, UUID | |
| `acknowledged_via` | TEXT | `accept` or `missing_report` (D-94) |
| `promised_ready_by` | TIMESTAMPTZ NOT NULL | End of the day shown to the customer (BC-14, D-34; §8.3) |
| `preparation_alert_at`, `preparation_expires_at` | TIMESTAMPTZ | Set at acceptance, or on photo approval when photos were requested (§8.3; D-79) |
| `photo_requested_at_payment` | BOOLEAN NOT NULL DEFAULT false | D-43 |
| `photo_requirement_cleared_at` | TIMESTAMPTZ | Set when every photo-requested book has been removed (§6.2); the photo step then no longer applies |
| `photo_send_due_at`, `photos_sent_at`, `photo_check_due_at`, `photos_approved_at` | TIMESTAMPTZ | D-43, D-53 |
| `missing_outcome_pending` | BOOLEAN NOT NULL DEFAULT false | D-94, D-83 |
| `missing_reported_at`, `missing_outcome_due_at` | TIMESTAMPTZ | |
| `store_alert_delivered_at` | TIMESTAMPTZ | The "alert delivered" fact for D-04 (§8.4) |
| `seller_snapshot`, `policy_snapshot_id` | JSONB NOT NULL, UUID | Copied from the checkout's snapshots |
| `store_timezone_snapshot` | TEXT NOT NULL | Copied from the checkout, to show times in the store's zone |
| `version` | INTEGER NOT NULL DEFAULT 1 | Goes up by one on every change |
| `correlation_id`, `latest_command_id` | UUID NOT NULL | As in Phase 6 |
| `ready_at`, `completed_at`, `cancelled_at`, `created_at`, `updated_at` | TIMESTAMPTZ | |

Indexes: `(store_id, status, updated_at DESC)`; `(user_id, updated_at DESC)`;
`(acceptance_due_at)` where status is `awaiting_store`.

The customer's phone and address stay in the checkout's private snapshot table and are read
through it. They are not copied into `store_orders`.

### 3.5 New `store_order_items`

| Column | Type | Rule |
|---|---|---|
| `id` | UUID PK | |
| `order_id` | UUID NOT NULL, FK `store_orders` | |
| `order_request_item_id` | UUID NOT NULL UNIQUE, FK | |
| `store_id`, `listing_id`, `inventory_id` | UUID NOT NULL | Copied |
| `title_snapshot`, `authors_snapshot`, `condition_snapshot`, `image_url_snapshot`, ISBN snapshots | as in the request item | Copied |
| `quantity` | INTEGER NOT NULL, `> 0` | Copies paid for |
| `removed_quantity` | INTEGER NOT NULL DEFAULT 0 | CHECK `BETWEEN 0 AND quantity`. Copies reported missing (§6.2) |
| `photo_requested` | BOOLEAN NOT NULL DEFAULT false | A photo request was open for this item at payment (§5.5) |
| `photo_request_id` | UUID, nullable | Phase 9's request ID, kept on conversion for each requested item. CHECK: present exactly when `photo_requested` is true (§18) |
| `unit_price_minor` | INTEGER NOT NULL | CHECK `>= 0`. The price paid |
| `printed_mrp_minor` | INTEGER, nullable | CHECK `IS NULL OR >= 0`. Copied from the checkout item (§3.2). Shown on the order and receipt with the saving when it is above `unit_price_minor`, for example "MRP ₹500, you paid ₹400"; never used in any amount (BC-05) |
| `status` | TEXT NOT NULL DEFAULT `active` | `active`, or `removed_unavailable` once `removed_quantity = quantity` |
| `removed_at`, `removed_reason_code` | TIMESTAMPTZ, TEXT | |
| `stock_outcome` | TEXT | Set when the copies still on the item end without the customer keeping them: `returned_to_sale`, `written_off`, `awaiting_relist` (§9). Missing copies are recorded per report (§3.11) |

### 3.6 New `commerce_pauses`

One row per pause. The reservation check reads only this table.

| Column | Type | Rule |
|---|---|---|
| `id` | UUID PK | |
| `scope` | TEXT NOT NULL | `store` or `platform` |
| `store_id` | UUID | Required when scope is `store`; empty for `platform` (CHECK) |
| `kind` | TEXT NOT NULL | See below |
| `blocks_new_orders` | BOOLEAN NOT NULL | Fixed by kind |
| `cancels_live_reservations` | BOOLEAN NOT NULL | True only for the D-81 kinds |
| `reason_code`, `note` | TEXT NOT NULL, TEXT | |
| `set_by`, `set_by_role`, `set_at` | UUID, TEXT NOT NULL, TIMESTAMPTZ NOT NULL | `system` when a rule set it |
| `cleared_by`, `cleared_at`, `clear_reason` | UUID, TIMESTAMPTZ, TEXT | |

Two partial unique indexes on uncleared rows: `(store_id, kind)` for store pauses, and
`(kind)` for platform pauses, because an empty `store_id` would not count as a duplicate.

| Kind | Set by | Cleared by | Blocks new orders | Cancels live reservations | Decision |
|---|---|---|---|---|---|
| `store_self_pause` | Store owner | Store owner | Yes | No | D-07 |
| `store_limit_daily_orders` | System (§5.5) | Admin | Yes | No | D-20, D-66 |
| `store_limit_unsettled` | System (SDD 05) | Admin | Yes | No | D-20, D-66 |
| `store_faults` | System (SDD 04) | Admin | Yes | No | D-21 |
| `store_debt_overdue` | System (SDD 04) | Admin | Yes | No | D-21 |
| `store_fraud_suspended` | Admin | Admin | Yes | Yes | D-21, D-81 |
| `store_payment_permission_lost` | System (SDD 05) or admin | System or admin | Yes | Yes | BC-41, D-59, D-81 |
| `store_closed_by_admin` | Admin | Admin | Yes | Yes | D-81 |
| `store_payout_block` | System or admin (SDD 05) | Owner (admin) | No | No | D-63 |
| `platform_loss_cap` | System (SDD 03) | Owner (admin) | Yes | No | D-08, D-68 |
| `platform_global` | Owner (admin) | Owner (admin) | Yes | No | D-55 |

Each owning SDD sets and clears its kinds through `marketplace_sec.set_commerce_pause` and
`clear_commerce_pause`, which this SDD provides. A kind that cancels live reservations
calls `cancel_for_store_ineligibility` for every live checkout of that store in the same
transaction (§5.7). Until §5.7 is built, `set_commerce_pause` refuses
`store_fraud_suspended`, `store_payment_permission_lost` and `store_closed_by_admin` with
`PAUSE_KIND_NOT_AVAILABLE` ("This pause is not available yet."); nothing is written.

### 3.7 `cancel_reason_code` values (master §6)

`store_not_accepted` (D-04), `store_unavailable` (Q55), `customer_cancelled_after_missing`
(D-61), `customer_cancelled` (Q45, D-67), `photos_not_sent`, `photos_rejected`,
`photos_not_answered` (D-43, D-53), `not_prepared` (D-79), `pickup_missed` (Q72),
`pickup_refused` (D-44), `no_rider_customer_cancelled` (D-77), `parcel_lost` (BC-35). The
last four are written by SDD 06 and SDD 07.

### 3.8 Access

- No client role can insert, update or delete any table in this section. Every write goes
  through the functions in §5 and §6, which are `SECURITY DEFINER` with an empty
  `search_path`, as in Phase 6.
- Reads go through projection functions (§12), not table grants: a customer sees only rows
  where `user_id` is the caller; a store owner only rows of a store where
  `has_phase6_owner_capability` passes; neither sees the other's private fields. A row the
  caller may not see raises `COMMERCE_ENTITY_UNAVAILABLE`, the same as a row that does not
  exist.
- `store_id` is always taken from the cart or the order row on the server (master §14).

Who may call what. `EXECUTE` is revoked from `PUBLIC` on every function, then granted only as
below.

| Functions | Granted to | Checked inside |
|---|---|---|
| `create_reservation`, `cancel_reservation`, `cancel_paid_order`, `respond_to_photos`, customer projections | `authenticated` | The caller is the row's `user_id` |
| `accept_order`, `report_missing_books`, `record_missing_outcome`, `report_order_unavailable`, `send_requested_photos`, `acknowledge_store_alert`, owner projections | `authenticated` | `has_phase6_owner_capability(store, 'phase6_order_commands')`, with the store read from the row |
| `set_store_self_pause` | `authenticated` | The same owner check. It can set or clear only `store_self_pause` |
| Every timer command in §5 and §6 | `service_role` | Called only by the worker |
| `convert_paid_checkout`, `resolve_late_payment`, `mark_order_ready`, `restock_order_item` | `service_role` and other `marketplace_sec` functions | Not callable by a client; `mark_order_ready` is reached through SDD 06's and SDD 07's own checked commands |
| `set_commerce_pause`, `clear_commerce_pause` | `service_role` and other `marketplace_sec` functions | Admin use goes through SDD 08's checked commands |
| `requeue_checkout_timer`, `resolve_failed_conversion`, `record_platform_incident`, `end_platform_incident` | `service_role` only | Admin-only through SDD 08's checked commands |
| `claim_commerce_timer_command`, `complete_commerce_timer_command`, `complete_phase6_task` | `service_role` and other `marketplace_sec` functions | Only for the worker's registered timer and its server-read entity (§5.0, §8.1); an already resolved task records nothing |
| `evaluate_reservation_eligibility`, `snapshot_reservation_policies`, `create_reservation_holds`, `convert_request_holds`, `cancel_for_store_ineligibility` | `service_role` and other `marketplace_sec` functions | Internal helpers; not callable by a client |

The §5.0 table fixes command schemas, parameters and answers. The new
`replaced_by_task_id` column and notification registry have no client write grant.
`receipt_email` is worker-only; it reads the saved email through a private server read,
never a notice payload. Phase 9's photo checks and references use the same order access
checks; raw media tables are not granted to clients.

### 3.9 Migrations and their owning slices

1. Checkout schema: §3.1 and §3.2 changes, the new `snapshot_submission_schedule` and
   `enforce_phase6_terminal_invariants`, and the checkout status-change trigger (§5.8).
2. Paid-order schema: §3.4, §3.5, §3.10 to §3.13, the order-number sequence, and the
   order status-change trigger (§6.8).
3. Pauses: §3.6, `set_commerce_pause`, `clear_commerce_pause`, `set_store_self_pause`.
   Include the temporary `PAUSE_KIND_NOT_AVAILABLE` refusal.
4. Settings: all keys in §4, and the entitlement `commerce_online_payment_enabled`.
5. Framework: registry rows for every §10 event and notice and every §8.1 task type,
   including `terminate_provider_order` and its stub, and `receipt_email`; add nullable
   `event_action_tasks.replaced_by_task_id UUID`, FK to `event_action_tasks(id)` (§5.9);
   the event, notice and audit validators
   and deep-link route check (§15); `claim_commerce_timer_command`,
   `complete_commerce_timer_command`; the already-resolved guard in `complete_phase6_task`;
   new `enrich_phase6_deadline_task` and
   `schedule_phase6_deadline_task`; the two reconciliation exemptions in §15;
   atomic task replacement, the already-resolved completion guard and the
   missing-email-transport retry deferral (§8.1);
   `record_platform_incident` and `end_platform_incident` (§3.12).
6. Hold helpers: `create_reservation_holds`, `convert_request_holds`,
   `restock_order_item(p_order_item_id, p_quantity, p_outcome, p_movement_key)` (§9).
   The Phase 6 hold helpers stay as they are.
7. Reservation commands: `evaluate_reservation_eligibility`,
   `snapshot_reservation_policies`, `create_reservation`, `cancel_reservation`,
   `expire_reservation`, `expire_payment_grace`, `convert_paid_checkout`,
   `resolve_late_payment`, `requeue_checkout_timer`, `resolve_failed_conversion`,
   and the new `cancel_for_store_ineligibility`. Include the guards on old commands (§15).
   Use the exact contracts in §5.0. Slice 3 builds both failed-conversion actions,
   `retry_convert` and `refund` (D-95, §5.10).
   Install these in slices 2, 3 and 6 as §19 assigns them; enable the three cancelling
   pause kinds only with §5.7 in slice 6.
8. Paid-order commands and timers: `accept_order`, `report_missing_books`,
   `record_missing_outcome`, `expire_missing_outcome`, `report_order_unavailable`,
   `cancel_paid_order`, `send_requested_photos`, `respond_to_photos`,
   `expire_photo_send`, `expire_photo_check`, `send_acceptance_reminder`,
   `escalate_acceptance`, `expire_unaccepted_order`, `alert_unprepared_order`,
   `expire_unprepared_order`, `mark_order_ready`, `acknowledge_store_alert`, and the
   deadline calculations in §8.2 and §8.3. Install in slices 4, 5 and 7 as §19 assigns them.
9. Projections: `customer_checkout_detail`, `customer_order_detail` and list,
   `owner_order_detail` and list (§12).
10. Reconciliation scans for the new states and records (§13), including unsent receipts
    after 24 hours and overdue failed-conversion cases.

Group 5 inserts every notification type listed below into
`marketplace_notification_type_registry(notification_type, audience)`, following 0024's
seed pattern. The suffix sets the single audience; event names stay as in §10.

```sql
INSERT INTO public.marketplace_notification_type_registry(notification_type, audience)
VALUES
  ('commerce.checkout.expired.customer', 'customer'),
  ('commerce.checkout.payment_not_received.customer', 'customer'),
  ('commerce.checkout.platform_cancelled.customer', 'customer'),
  ('commerce.order.placed.customer', 'customer'),
  ('commerce.order.placed.store', 'store'),
  ('commerce.order.acceptance_reminder.store', 'store'),
  ('commerce.order.acceptance_escalated.store', 'store'),
  ('commerce.order.accepted.customer', 'customer'),
  ('commerce.order.missing_reported.customer', 'customer'),
  ('commerce.order.missing_outcome_recorded.customer', 'customer'),
  ('commerce.order.missing_outcome_recorded.store', 'store'),
  ('commerce.order.photos_sent.customer', 'customer'),
  ('commerce.order.photos_approved.store', 'store'),
  ('commerce.order.cancelled.customer', 'customer'),
  ('commerce.order.cancelled.store', 'store'),
  ('commerce.order.late_payment_converted.customer', 'customer'),
  ('commerce.order.late_payment_converted.store', 'store'),
  ('commerce.checkout.late_payment_refunded.customer', 'customer'),
  ('commerce.order.preparation_alert.store', 'store');
```

The grants and revocations in §3.8 ship with each function. These numbers identify migration
groups. Where a group spans slices, each slice uses a separate new migration file in §19's
build order. The status triggers exist before commands write the new states; later slices
add the commands, not a period without transition checks.

### 3.10 New `order_receipts`

| Column | Type | Rule |
|---|---|---|
| `id` | UUID PK | |
| `order_id` | UUID NOT NULL UNIQUE, FK `store_orders` | One receipt per order |
| `receipt_number` | TEXT UNIQUE NOT NULL | |
| `book_total_minor`, `delivery_charge_minor`, `total_paid_minor` | INTEGER NOT NULL | CHECK each `>= 0`. Copied from the order |
| `issuer_snapshot` | JSONB NOT NULL | Who is named (§11) |
| `issued_at` | TIMESTAMPTZ NOT NULL | |
| `emailed_at` | TIMESTAMPTZ | When email was given and sent |

### 3.11 New `order_missing_reports` and `order_missing_report_items`

One row per missing-book report, so each report's refund covers only its own copies, however
many reports an order has (§6.2).

| Table | Column | Rule |
|---|---|---|
| `order_missing_reports` | `id` UUID PK; `order_id` UUID NOT NULL | FK `order_id` → `store_orders(id)`. The report's ID is also its refund key with SDD 04 |
| | `reported_at`, `due_at` | TIMESTAMPTZ NOT NULL |
| | `outcome` | TEXT, nullable; CHECK in (`keeps_rest`, `cancelled_all`) |
| | `outcome_at` | TIMESTAMPTZ, nullable |
| | `outcome_by` | TEXT, nullable; CHECK in (`store`, `system`, `customer`) |
| | Outcome CHECK | `outcome`, `outcome_at`, `outcome_by` are all null together or all set together |
| `order_missing_report_items` | `report_id`, `order_item_id` | UUID, composite PK; FKs to `order_missing_reports(id)` and `store_order_items(id)` |
| | `quantity` | INTEGER NOT NULL, `> 0`. Copies missing in this report |

A partial unique index on `(order_id)` where `outcome IS NULL` allows one open report per
order.

### 3.12 New `commerce_platform_incidents`

A record that BookConnect's own alerts were failing for a period, so a store is not blamed
for it (D-04).

| Column | Type | Rule |
|---|---|---|
| `id` | UUID PK | |
| `kind` | TEXT NOT NULL | `notification_failure`, `worker_failure`, `app_outage` |
| `started_at` | TIMESTAMPTZ NOT NULL | |
| `ended_at` | TIMESTAMPTZ | Empty while it continues |
| `recorded_by`, `note` | UUID, TEXT NOT NULL | Written by an admin through SDD 08; no automatic worker path in the pilot |

"A platform failure is recorded" (§6.6) means a row whose period overlaps the order's
`paid_at` to `acceptance_due_at`. An open incident continues through the current time.

`record_platform_incident` creates the row and returns its ID in §5.0's JSON answer.
`end_platform_incident` sets its end. Their exact typed parameters and replay answers
are in §5.0. Both are admin-only through
SDD 08 and service role only, and both are audited. `p_kind` must be one of the three values
above; the end cannot precede the start. The pilot records incidents by hand (§17 item 27).

### 3.13 New `order_item_stock_movements`

| Column | Type | Rule |
|---|---|---|
| `id` | UUID PK | |
| `order_item_id` | UUID NOT NULL | FK `store_order_items(id)` |
| `quantity` | INTEGER NOT NULL | `> 0`; the copies moved |
| `outcome` | TEXT NOT NULL | CHECK in (`returned_to_sale`, `written_off`, `awaiting_relist`) (§9) |
| `movement_key` | TEXT NOT NULL UNIQUE | Replay key (§9) |
| `created_at` | TIMESTAMPTZ NOT NULL | |

The movement and the stock change commit together. A replay of a recorded movement does
nothing; it never moves the quantity again (§9).

## 4. Settings (`marketplace_policy_config`)

| Key | Default | Decision |
|---|---|---|
| `commerce.reservation_window_seconds` | 600 | Q36 |
| `commerce.payment_grace_seconds` | 900 | 15 minutes (D-102) |
| `commerce.max_order_book_total_minor` | 500000 | D-56, D-65 |
| `commerce.reservation_attempts_per_hour` | 6 | Handoff §7; number approved (§17 item 3) |
| `commerce.customer_max_live_checkouts` | 2 | Handoff §7; number approved (§17 item 3) |
| `commerce.customer_daily_paid_order_limit` | `null` (off) | D-56; checked only when set |
| `commerce.paid_order_acceptance_seconds` | 86400 | D-04 |
| `commerce.acceptance_reminder_open_seconds` | 1800 | BC-12 |
| `commerce.acceptance_escalation_open_seconds` | 2700 | BC-12, BC-13 |
| `commerce.same_day_cutoff_seconds_before_close` | 7200 | BC-14, D-34 |
| `commerce.photo_send_window_seconds` | 86400 | D-43 |
| `commerce.photo_check_window_seconds` | 86400 | D-43, D-53 |
| `commerce.missing_outcome_window_seconds` | 86400 | D-83 |
| `commerce.preparation_grace_business_days` | 1 | D-79 |
| `commerce.schedule_horizon_days` | 62 | Schedule engine default in migration 0020; reservation refusal approved (D-100) |
| `commerce.store_daily_paid_order_limit` | 20 | D-20, D-66 |
| `commerce.store_alert_channel_reliable` | false | D-02, handoff §11 item 5 |
| `commerce.provider_check_max_age_seconds` | 60 | My number (§17) |

The old `payment_ready_window_seconds` and `acceptance_window_seconds` keys are not used.
The payment-result grace uses `commerce.payment_grace_seconds`; its 15 minutes are
approved (D-102). Grace is anchored to `reservation_expires_at` (§5.3),
including when the worker runs late. All deadline checks use `clock_timestamp()` read
after the locks (§5.0, §6, §7). Receipt email adds no setting: D-50 requires it when an
email was given; the 24-hour unsent scan is §17 item 31 (approved).

## 5. Checkout commands

Every command returns JSONB and is replay-safe. Customer commands use
`claim_phase6_command` with their actor, key and command ID. Every timer command in §5 and
§6 uses `claim_commerce_timer_command` and `complete_commerce_timer_command` (§8.1), with
the task ID as its command ID and no actor or expected version. §5.0 gives every exact
contract. Guards run in the order listed; the first that fails raises its code and nothing is written. The message
column is what the customer or store sees.

### 5.0 Command contracts

This table is the call contract for §5 and §6 and the shared commands exported in §20.
All answers are JSONB. `UUID`, `INTEGER`, `BOOLEAN`, `TEXT` and `TIMESTAMPTZ` in an answer
describe JSON values; timestamps are ISO 8601 strings. `TIMESTAMPTZ_OR_NULL` means a timestamp string or JSON null. Parameters have no implicit defaults. Nullable inputs are passed explicitly:
delivery address and quote for pickup, termination time when not needed, and a photo
rejection reason on approval. The saved contact may contain the optional email (D-50);
it never comes from a notice payload.
`p_items` is an array of `{"order_item_id":UUID,"quantity":INTEGER}`;
`p_shown_prices` is an array of `{"cart_item_id":UUID,"unit_price_minor":INTEGER}`.
Photo `p_decision` is `approve` or `reject`; missing-book outcomes are in §6.2.
SQL refusals use the section's code and message and roll back all effects.

Versioned customer and store commands use `claim_phase6_command` with the authenticated
actor. SDD 08 supplies its checked admin actor to the admin command claim; a client-supplied
actor is never trusted. Internal commands use the caller's checked command identity. A
command that writes the same event type for several rows derives one child command ID and
event key per row (§5.7).
An idempotency replay returns the stored answer before re-checking a changed version.
A no-op records no event, notice, refund or new task. An already resolved worker task
also records no completion or new command answer (§8.1).

For every time comparison under locks, read `clock_timestamp()` after all required locks
are taken. Never use `now()`, `transaction_timestamp()` or a time saved before a lock wait.
This includes provider-read freshness, action deadlines, timer due checks and recovery
windows. A timer acts only at or after its due time, with the matching status and due column.

| Command | Schema | Exact parameters | Idempotency inputs | JSON answer | No-op answer |
|---|---|---|---|---|---|
| `create_reservation` | `public` | `(p_cart_id UUID, p_expected_version INTEGER, p_fulfillment_method TEXT, p_contact_snapshot JSONB, p_delivery_address_snapshot JSONB, p_delivery_quote_id UUID, p_customer_note TEXT, p_shown_prices JSONB, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; cart and all business parameters hashed. | `{"outcome":"reserved","request_id":UUID,"version":INTEGER,"reservation_expires_at":TIMESTAMPTZ,"final_subtotal_minor":INTEGER,"final_delivery_tariff_minor":INTEGER,"final_total_minor":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `cancel_reservation` | `public` | `(p_request_id UUID, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; checkout hashed. | `{"outcome":"cancelled","request_id":UUID,"status":"customer_cancelled","version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `expire_reservation` | `public` | `(p_request_id UUID, p_task_due_at TIMESTAMPTZ, p_provider_checked_at TIMESTAMPTZ, p_provider_terminated_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":TEXT,"request_id":UUID,"status":TEXT,"version":INTEGER,"payment_grace_expires_at":TIMESTAMPTZ_OR_NULL}` | `{"outcome":"noop"}`; replay returns stored answer. |
| `expire_payment_grace` | `public` | `(p_request_id UUID, p_task_due_at TIMESTAMPTZ, p_provider_checked_at TIMESTAMPTZ, p_provider_terminated_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":TEXT,"request_id":UUID,"status":TEXT,"version":INTEGER,"payment_grace_expires_at":TIMESTAMPTZ_OR_NULL}` | `{"outcome":"noop"}`; replay returns stored answer. |
| `convert_paid_checkout` | `marketplace_sec` | `(p_request_id UUID, p_payment_id UUID, p_paid_at TIMESTAMPTZ, p_command_id UUID)` | Verified payment ID, checkout ID and command ID; unique order/payment and refund key. | `{"outcome":"converted","order_id":UUID}` or `{"outcome":"conversion_failed","reason":TEXT}` | Existing order/refund answer; no second effect. |
| `resolve_late_payment` | `marketplace_sec` | `(p_request_id UUID, p_payment_id UUID, p_paid_at TIMESTAMPTZ, p_command_id UUID)` | Verified payment ID, checkout ID and command ID; unique order/payment and refund key. | `{"outcome":"converted","order_id":UUID}` or `{"outcome":"refund_requested","payment_id":UUID}` | Existing order/refund answer; no second effect. |
| `cancel_for_store_ineligibility` | `marketplace_sec` | `(p_store_id UUID, p_reason_code TEXT, p_command_id UUID)` | Pause command ID; server-read store checkouts; state guards. | `{"outcome":"applied","request_ids":UUID[]}` | `{"outcome":"noop"}` when no unpaid live checkout remains. |
| `requeue_checkout_timer` | `marketplace_sec` | `(p_task_id UUID, p_reason TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Checked admin, key, command ID; source task and reason hashed; source replacement pointer. | `{"outcome":"requeued","task_id":UUID,"replacement_task_id":UUID}` | Same answer with the recorded replacement ID; no new task. |
| `resolve_failed_conversion` | `marketplace_sec` | `(p_request_id UUID, p_action TEXT, p_reason TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Checked admin, key, command ID; checkout, action and reason hashed; payment read on server. | `{"outcome":"converted","order_id":UUID}`; `{"outcome":"conversion_failed","reason":TEXT}`; `{"outcome":"refund_requested","payment_id":UUID}` | Stored answer on replay; `{"outcome":"noop"}` if the case was already resolved. |
| `accept_order` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `report_missing_books` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_items JSONB, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `record_missing_outcome` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_outcome TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `report_order_unavailable` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `cancel_paid_order` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `send_requested_photos` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `respond_to_photos` | `public` | `(p_order_id UUID, p_expected_version INTEGER, p_decision TEXT, p_reject_reason TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Caller, key, command ID; entity, version and action inputs hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `expire_missing_outcome` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `expire_photo_send` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `expire_photo_check` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `send_acceptance_reminder` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `escalate_acceptance` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `expire_unaccepted_order` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `alert_unprepared_order` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `expire_unprepared_order` | `public` | `(p_order_id UUID, p_task_due_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Timer (§8.1): task ID is command ID; stable entity/due request and key. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | `{"outcome":"noop"}` for a stale, resolved or not-yet-due task; replay returns stored answer. |
| `mark_order_ready` | `marketplace_sec` | `(p_order_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID)` | Checked SDD 06/07 caller, key, command ID; order and version hashed. | `{"outcome":"applied","order_id":UUID,"status":TEXT,"version":INTEGER}` | Stored answer on replay; other invalid actions raise their guard. |
| `acknowledge_store_alert` | `public` | `(p_order_id UUID, p_idempotency_key TEXT, p_command_id UUID)` | Owner, key, command ID; order hashed. | `{"outcome":"acknowledged","order_id":UUID,"store_alert_delivered_at":TIMESTAMPTZ}` | Existing fact in the same answer shape; no second write. |
| `restock_order_item` | `marketplace_sec` | `(p_order_item_id UUID, p_quantity INTEGER, p_outcome TEXT, p_movement_key TEXT)` | Unique movement key; quantity and outcome match the recorded movement. | `{"outcome":"moved","movement_id":UUID}` | `{"outcome":"noop","movement_id":UUID}` on a recorded movement. |
| `set_commerce_pause` | `marketplace_sec` | `(p_scope TEXT, p_store_id UUID, p_kind TEXT, p_reason_code TEXT, p_note TEXT, p_command_id UUID)` | Command ID and the uncleared scope/store/kind unique key. | `{"outcome":"set","pause_id":UUID}` | Existing pause ID in the same answer shape. |
| `clear_commerce_pause` | `marketplace_sec` | `(p_pause_id UUID, p_reason TEXT, p_command_id UUID)` | Command ID and pause ID; checked caller from the owning path. | `{"outcome":"cleared","pause_id":UUID}` | `{"outcome":"noop","pause_id":UUID}` when already cleared. |
| `set_store_self_pause` | `public` | `(p_store_id UUID, p_paused BOOLEAN, p_reason TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Owner, key, command ID; store, switch and reason hashed. | `{"outcome":"applied","store_id":UUID,"paused":BOOLEAN}` | Same switch answer when already in that state. |
| `record_platform_incident` | `marketplace_sec` | `(p_kind TEXT, p_started_at TIMESTAMPTZ, p_note TEXT, p_idempotency_key TEXT, p_command_id UUID)` | Checked admin, key, command ID; kind, start and note hashed. | `{"outcome":"recorded","incident_id":UUID}` | Stored answer on replay; no second incident. |
| `end_platform_incident` | `marketplace_sec` | `(p_incident_id UUID, p_ended_at TIMESTAMPTZ, p_idempotency_key TEXT, p_command_id UUID)` | Checked admin, key, command ID; incident and end hashed. | `{"outcome":"ended","incident_id":UUID}` | Stored answer on replay; `{"outcome":"noop","incident_id":UUID}` when already ended. |

### 5.1 `create_reservation` (customer)

`public.create_reservation(p_cart_id UUID, p_expected_version INTEGER, p_fulfillment_method
TEXT, p_contact_snapshot JSONB, p_delivery_address_snapshot JSONB, p_delivery_quote_id
UUID, p_customer_note TEXT, p_shown_prices JSONB, p_idempotency_key TEXT, p_command_id
UUID)`. `p_shown_prices` lists each cart item's ID and the price the screen showed; it is only
compared, never charged. This command replaces `submit_order_request`, which is closed to new
carts as §15 says.

| # | Guard | Code | Message |
|---|---|---|---|
| 1 | Caller is signed in | `AUTHENTICATION_REQUIRED` | Please sign in. |
| 2 | Cart belongs to the caller, is `active`, not expired, version matches | `COMMERCE_ENTITY_UNAVAILABLE` / `STALE_VERSION` | Your cart has changed. Please review it. |
| 3 | Cart has at least one item and every item is from the cart's store (Q33) | `COMMERCE_ENTITY_UNAVAILABLE` | Your cart has changed. Please review it. |
| 4 | No live checkout exists for this cart | `RESERVATION_ALREADY_OPEN` | You already have a payment in progress for this cart. |
| 5 | Under the customer transaction advisory lock (§7): caller is under the attempts-per-hour and live-checkout caps; check paid orders today (India date) only if `commerce.customer_daily_paid_order_limit` is set (default off, D-56) | `RESERVATION_LIMIT_REACHED` | Too many attempts. Please try again later. |
| 6 | No uncleared platform pause with `blocks_new_orders` | `PLATFORM_PAUSED` | Online orders are paused for now. Please try again later. |
| 7 | Store passes `evaluate_reservation_eligibility` (§15): active, verified, set up, allowed to sell; subscription allowed; rollout flags and allowlist on; an entitled active owner exists; the schedule engine finds an open day within `commerce.schedule_horizon_days` (§4); and it has the online-payment permission (new entitlement `commerce_online_payment_enabled`, set by SDD 05) | `STORE_NOT_ACCEPTING_ORDERS` | This store is not taking online orders right now. |
| 8 | No uncleared store pause with `blocks_new_orders` | `STORE_NOT_ACCEPTING_ORDERS` | This store is not taking online orders right now. |
| 9 | Contact snapshot has a valid Indian mobile number (D-50) | `PHONE_REQUIRED` | Please add your phone number. |
| 10 | Method is `pickup`, or `delivery` once SDD 07 is live | `DELIVERY_NOT_AVAILABLE_YET` | Delivery is not available yet. Please choose pickup. |
| 11 | Delivery only, once SDD 07 is live: pincode served and a quote valid under SDD 07's rules (D-18, BC-22). Until then guard 10 refuses delivery first | `DELIVERY_NOT_SERVICEABLE` / `DELIVERY_QUOTE_UNAVAILABLE` | We cannot deliver to this address. / We could not get a delivery price. You can choose pickup. |
| 12 | Every listing is `active`, moderation `approved`, and from the cart's store | `ITEM_NOT_AVAILABLE` | One of your books is no longer available. |
| 13 | Book total is at most the cap (D-56) | `ORDER_TOTAL_ABOVE_LIMIT` | Orders are limited to ₹5,000 of books for now. |
| 14 | Stock: every item has `quantity_available >= requested_quantity` (checked by taking the hold) | `INSUFFICIENT_INVENTORY` | Someone else just reserved this book. |

A closed store may still take orders, including during a planned closure (D-07), so
opening hours are not a guard. Pickup is always offered (handoff §11 item 15), so
`stores.pickup_enabled`, its policy key and `listing.pickup_available` are not read.

The printed-book rule (D-49) governs what may be listed, so it is enforced when a book is
listed, by the Phase 9 lane (§18). Checkout does not re-check it, and no reliable field
exists today to check it with (§2). It must be in place before live payments.

Locks are taken in the §7 order before the guards that depend on them: guards 2 to 4 under
the cart lock, guard 5 under the customer advisory lock taken first, guards 7 and 8
under the store lock (`FOR SHARE`), guards 12 to 14 under stock rows in ID order, then
listings. The full order is customer advisory lock, payment, cart, store, checkout, order,
stock rows in ID order, listings (§7). Effects, in the same transaction:

- Price per item is the listing's current `selling_price_minor` read under the lock. The
  cart's snapshot price is not used (BC-05, D-11). If any price differs from
  `p_shown_prices`, the command raises `PRICE_CHANGED` ("A price has changed. Please review
  your cart.") and the app refreshes the cart, which now shows the current listing price
  (§15), so the next attempt sends the new price. This replaces Phase 6's lower-of-two rule,
  because the customer must see the exact amount before paying (§17).
- Insert the checkout as `reserved` with `reservation_expires_at = clock_timestamp() + window` read after the locks,
  `final_subtotal_minor`, `final_delivery_tariff_minor` (0 for pickup),
  `final_total_minor`, `money_calculator_version = 2`, `cart_version_at_reservation`.
- Insert the items, the private contact and address snapshot and the seller snapshot, as
  Phase 6 does, and the policy snapshots through a new `snapshot_reservation_policies` with
  the §4 keys. The old function requires delivery-tariff keys that D-36 retires.
- Take one `firm` hold per item (`create_reservation_holds`, §9), expiring at the
  reservation end.
- Leave the cart `active`. While a live checkout exists, every cart-editing command refuses
  with `RESERVATION_ALREADY_OPEN` (§15 lists the cart functions to change).
- Write the event `checkout.reserved`, the creation log and the audit log.
- Open the task `reservation_expiry`, due at `reservation_expires_at`, with
  `source_request_version` set to the checkout's version.
- No notice to the store: it hears about an order only when it is paid.

Answer: checkout ID, version, `reservation_expires_at`, the amounts. The app then calls
SDD 02's "create payment" with the checkout ID.

### 5.2 `cancel_reservation` (customer)

Allowed in `reserved` and `awaiting_payment_result`, only for the checkout's own customer
(otherwise `COMMERCE_ENTITY_UNAVAILABLE`). Takes the required §7 locks, including
payment before checkout, then releases the
holds (`reason = 'customer_cancelled'`), sets `customer_cancelled` with
`closed_reason_code = 'customer'`, resolves the open timers, writes `checkout.cancelled`,
and asks SDD 02 to terminate the Cashfree order by opening the task
`terminate_provider_order` (SDD 02 owns it). If the payment row already shows a verified
success, the command raises `ORDER_ALREADY_PAID` ("Your payment went through. Your order is
placed.") and changes nothing.

### 5.3 `expire_reservation` (timer)

The worker takes these steps, none of them inside a database lock (SDD 02 §7):

1. It asks Cashfree for the order's payments and records the answer.
2. If that shows a success not yet verified, it runs SDD 02's verification and acts on its
   outcome:
   - `paid` (converted, or a failed conversion under §5.10): it stops; the holds stay.
   - `amount_mismatch` (D-29): SDD 02 has refunded that money and terminates the order. It
     is not a payment for this checkout, so the worker continues with step 3, counting that
     attempt as finished.
3. If no attempt is pending, it terminates the Cashfree order (CF-32) and records the
   answer. `TERMINATION_REQUESTED` counts as terminated. If the answer is that a payment
   already succeeded, it runs verification and acts on its outcome as in step 2. When every
   success on the order is a recorded `amount_mismatch`, that refusal also counts as
   terminated, with the time of the answer passed as `p_provider_terminated_at`. Any
   success that still arrives later on that Cashfree order is a duplicate, which Cashfree
   reverses (CF-30): SDD 02 follows its duplicate rule (D-29, D-78), with no order and no
   immediate refund from us; it never reaches §5.6. The worker then
   reads the payments again.
4. It calls `public.expire_reservation(p_request_id, p_task_due_at, p_provider_checked_at,
   p_provider_terminated_at, p_idempotency_key, p_command_id)`.

| Under the checkout lock | Result |
|---|---|
| Checkout is no longer `reserved`, or `p_task_due_at` is not its `reservation_expires_at` | Does nothing |
| A verified success exists | Does nothing; the customer has paid and the holds stay, including while §5.10 resolves a failed conversion |
| Post-lock `clock_timestamp()` is before `reservation_expires_at` | Does nothing; not due yet |
| `p_provider_checked_at` missing or older than the setting (§4), using post-lock `clock_timestamp()` | Raises `PROVIDER_CHECK_STALE`; the task retries; holds stay |
| An attempt is still processing | `awaiting_payment_result`; `payment_grace_expires_at = reservation_expires_at + commerce.payment_grace_seconds`; holds extended to it; task `payment_grace_expiry` opened; event `checkout.payment_pending`, no notice (BC-10) |
| Nothing pending, and `p_provider_terminated_at` missing | Raises `PROVIDER_CHECK_STALE`; the task retries; holds stay |
| Nothing pending, order terminated | Holds released (`reason = 'reservation_expired'`); `reservation_expired`, `closed_reason_code = 'timer'`; emit `checkout.expired` only with no attempt ("You were not charged"); otherwise emit `checkout.payment_not_received` with its §10 wording. A success that arrives later is a late payment (§5.6) |

A "verified success" in these tables is a payment SDD 02 verified for the exact amount. An
attempt recorded as `amount_mismatch` is not one: for the guards it counts as a finished
attempt with no payment, so the checkout closes on its timer as D-29 requires. Its
customer sees `checkout.payment_not_received`, never "You were not charged".

If that grace end is already past when `expire_reservation` runs, it still enters
`awaiting_payment_result`. The new task keeps the past grace end as `due_at` and runs
at once; the worker does not grant another grace.

If Cashfree cannot be read or terminated, the task keeps retrying and the books stay held.
After the task's retries are used up it is dead-lettered and an admin case is opened; the
holds are still not released by guesswork. The way out is §5.9. The customer can also cancel
at any time, which releases the books (§5.2).

### 5.4 `expire_payment_grace` (timer)

Grace is entered only once: only `expire_reservation` enters `awaiting_payment_result`,
and only from `reserved`. This command never extends or restarts the grace.

At grace end the worker takes these steps outside database locks:

1. Read Cashfree's payments and record the answer.
2. If there is a success not yet verified, run SDD 02's verification and act on its outcome
   as §5.3 step 2 says: stop on `paid`; continue to step 3 on `amount_mismatch`.
3. Otherwise terminate the Cashfree order (CF-32), whether an attempt is still processing
   or not. If the answer says a payment already succeeded, verify and act as in step 2.
   `TERMINATION_REQUESTED` counts as terminated, and so does the refusal described in §5.3
   step 3 when every success is a recorded `amount_mismatch`. Then read the payments again.
4. Call `public.expire_payment_grace(p_request_id, p_task_due_at, p_provider_checked_at,
   p_provider_terminated_at, p_idempotency_key, p_command_id)`.

| Under the checkout lock | Result |
|---|---|
| No longer `awaiting_payment_result`, or `p_task_due_at` differs from `payment_grace_expires_at` | Does nothing |
| A verified success exists | Does nothing; the customer has paid and the holds stay, including while §5.10 resolves a failed conversion |
| Post-lock `clock_timestamp()` is before `payment_grace_expires_at` | Does nothing; not due yet |
| Provider read missing or older than `commerce.provider_check_max_age_seconds`, using post-lock `clock_timestamp()` | `PROVIDER_CHECK_STALE`; task retries; holds stay |
| Termination failed or `p_provider_terminated_at` is missing | `PROVIDER_CHECK_STALE`; task retries; holds stay |
| Fresh read has no success and order is terminated, including an attempt still processing | Release holds; set `reservation_expired`, `closed_reason_code = 'payment_failed'`; emit `checkout.payment_not_received` (§10) |

If termination fails, raise `PROVIDER_CHECK_STALE`; do not release the holds. The payment
stays on SDD 02's poll after this checkout closes. A later success is a late payment (§5.6).
The customer sees "We have not received your payment. If you were charged, it will be
refunded automatically." Never tell this customer they were not charged.

### 5.5 `convert_paid_checkout` (called by SDD 02's verification, in its transaction)

`marketplace_sec.convert_paid_checkout(p_request_id UUID, p_payment_id UUID, p_paid_at
TIMESTAMPTZ, p_command_id UUID)`. Not callable by any client role.

Guards: the checkout is `reserved` or `awaiting_payment_result`; the payment's verified
amount equals `final_total_minor` (SDD 02 has already checked; re-checked here); every item
has an active hold. A failed guard should be impossible. If one fails, the command **does not
raise**: it writes nothing and returns §5.0's `{"outcome":"conversion_failed","reason":TEXT}` answer. An
exception would roll back SDD 02's whole transaction, including the record that the payment
was verified. SDD 02 then commits the payment as verified and opens an admin case in that
same transaction, extends the holds as §5.10 says, and leaves the checkout in its current
live state. `resolve_failed_conversion` can retry within the D-04 window (§5.10).
If a retry cannot succeed, the admin refunds the payment in full (D-95); a case still open
after 7 days is escalated to the owner, and the §13 scan also finds it. Both expiry commands do nothing once a verified
success exists. The customer has paid, so the books stay held while this is resolved.

Locks, in the §7 order: customer advisory lock, payment, cart, store (`FOR UPDATE`,
for the daily limit), checkout, order if present, stock rows in ID order, then listings.
Effects:

- Holds become sales (`convert_request_holds`, §9).
- Checkout becomes `converted`. The cart becomes `submitted` only if it is still `active` at
  `cart_version_at_reservation`. A cart the customer changed after an expiry is left alone;
  the order is built from the checkout's items, not the cart.
- Insert `store_orders` (`awaiting_store`) and `store_order_items`, with `acceptance_due_at`,
  `promised_ready_by` (§8.3) and the snapshots.
- Read once whether a photo request was open for each item at this moment, through the
  function the Phase 9 lane provides; keep its request ID as `photo_request_id` and
  set `photo_requested` on those items,
  `photo_requested_at_payment` if there are any, and then
  `photo_send_due_at = paid_at + 24 hours` (D-43). Until that function exists the value is
  always false (§18).
- Create the receipt (§11). If the saved contact has an email, open `receipt_email`
  in this transaction, keyed by type and order ID (§8.1).
- Open `acceptance_expiry`; open `acceptance_reminder` and `acceptance_escalation` only
  when §8.2 gives an allowed due time and sets their columns. Open `photo_send_expiry`
  when photos were requested.
- Notices: "Order placed" to the customer; "New paid order" to the store's owners, which is
  also the store alert (§8.4).
- Daily limit (D-20, D-66): count this store's orders with `paid_at` on the current India
  date. If the count has reached the limit, set the pause `store_limit_daily_orders`. The
  unsettled-amount limit is set by SDD 05 in the same way.
- Events `checkout.converted` and `order.placed`.

### 5.6 `resolve_late_payment` (called by SDD 02's verification)

For a verified success on a checkout that is already closed. A success on a Cashfree
order that already has an `amount_mismatch` attempt never comes here: SDD 02 treats it as
a duplicate that Cashfree reverses (CF-30, D-78).

Every kind of payment that arrives late or twice, and where it is handled:

| Case | What happens | Where |
|---|---|---|
| First success on a checkout still `reserved` or `awaiting_payment_result` | Converted as a normal payment | §5.5 |
| First success after the checkout closed, including after a termination request (CF-65) | This section's table: an order if the books are free and nothing below applies, otherwise a full refund | §5.6 |
| A second success on a Cashfree order that already has a verified payment | Duplicate; Cashfree reverses it; no order and no immediate refund from us | SDD 02 (D-78, CF-30) |
| A success after a wrong-amount attempt on the same Cashfree order | Same as a duplicate | SDD 02 (D-78, CF-30), §5.3 |
| A success for the wrong amount | Refunded in full; never an order; the reservation runs out | SDD 02 (D-29), §5.3 |
| A success Cashfree has already reversed | Recorded by reconciliation; no order and no refund from us | SDD 02, SDD 03 |
| A success on a checkout the customer or the platform cancelled | Full refund, no order | This section (D-85) |
| A success that cannot be converted | Admin retry or refund | §5.10 (D-95) |

| Checkout state | Result |
|---|---|
| `customer_cancelled` or `platform_cancelled` | Full automatic refund, no order (D-85). Refund category 5 in SDD 04 |
| `reservation_expired`, and a D-81 pause is active for the store | Full automatic refund (D-98) |
| `reservation_expired`, and another checkout of the same cart at the same `cart_version_at_reservation` is live or converted | Full automatic refund: the customer is already buying exactly these books (D-97). A checkout of the cart at a different version does not count; the cart changed, so these are different orders |
| `reservation_expired`, every item still has enough stock | All items are taken again and sold in one step; then the same effects as §5.5. `converted` (D-06, D-84) |
| `reservation_expired`, any item short | Full automatic refund (Q38, D-84); nothing is taken |

- All or nothing, using the full §7 order: customer advisory lock, payment, cart, store,
  checkout, order if present, stock rows in ID order, then listings (D-84). The cart lock
  precedes the stock locks, so two late payments and a new reservation on one cart cannot pass this check
  together.
- Only stock is checked. Limits, the 3-fault pause, the loss cap, the global pause and the
  store's own switch do not block it (handoff §11 item 4).
- Stock moves straight from available to sold; a hold row is written as
  `converted_to_sale` for the record. No active hold is created, so the terminal guard is
  not involved.
- The customer is told in the app which happened and, for a refund, why, the amount and
  "2–3 working days" (§10, D-48).
- The refund is requested from SDD 04 with the payment ID as its key, so a repeat does
  nothing.

### 5.7 `cancel_for_store_ineligibility` (system, D-81)

Called only by `set_commerce_pause` for a kind that cancels live reservations, which has
taken any required earlier §7 locks, then the store lock (`FOR UPDATE`) before checkout,
stock and listings. A reservation cannot slip past it. For each
unpaid checkout of the store in `reserved` or `awaiting_payment_result`: holds released,
`platform_cancelled` with the matching `closed_reason_code`, tasks `reservation_expiry` and
`payment_grace_expiry` resolved, task `terminate_provider_order` opened,
event `checkout.platform_cancelled`, notice to the customer ("This store cannot take your order right now. You have not been
charged; if you were, it will be refunded automatically."). A payment that still succeeds
is refunded by §5.6. Paid orders are not touched by this command; they continue (D-21).
A checkout with a verified success awaiting failed-conversion recovery stays under §5.10;
it is not an unpaid reservation to cancel.

One pause can cancel many checkouts in one transaction, and both an event's command ID
(per event type) and its idempotency key must be unique. So each cancelled checkout gets
its own identity, derived from the pause command:

- child command ID `marketplace_sec.derived_command_uuid(p_command_id,
  'store-ineligible-cancel:' || request_id)`, used for that checkout's event, task and
  notice;
- event idempotency key `checkout.platform_cancelled:` plus the same `request_id`;
- the pause command ID is kept in each event's payload as `pause_command_id`, so the
  cancellations can be traced to the pause.

A replay of the same pause derives the same identities and changes nothing.

The existing Phase 6 function of the same name is replaced by a new version in a new
migration.

### 5.8 Checkout transitions

| From | To | By |
|---|---|---|
| (cart) | `reserved` | `create_reservation` |
| `reserved` | `converted` | `convert_paid_checkout` |
| `reserved` | `awaiting_payment_result` | `expire_reservation` |
| `reserved` | `reservation_expired` | `expire_reservation` |
| `reserved`, `awaiting_payment_result` | `customer_cancelled` | `cancel_reservation` |
| `reserved`, `awaiting_payment_result` | `platform_cancelled` | `cancel_for_store_ineligibility`; also `resolve_failed_conversion`'s `refund`, with `conversion_failed` (D-95, §5.10) |
| `awaiting_payment_result` | `converted` | `convert_paid_checkout` |
| `awaiting_payment_result` | `reservation_expired` | `expire_payment_grace` |
| `reservation_expired` | `converted` | `resolve_late_payment` |

No other transition exists. A trigger refuses any other change of status on a pay-first
row.

### 5.9 `requeue_checkout_timer` (admin, through SDD 08)

`marketplace_sec.requeue_checkout_timer(p_task_id UUID, p_reason TEXT,
p_idempotency_key TEXT, p_command_id UUID)`; JSON answer as in §5.0.

The way out of a dead-lettered expiry when Cashfree could not be read. Read the source
task's checkout on the server; take the §7 locks, then lock the source task. For a new
replacement, require that the source is dead-lettered, is `reservation_expiry` or
`payment_grace_expiry`, and belongs to a checkout still in `reserved` or
`awaiting_payment_result`. Otherwise raise `INVALID_COMMAND` and write nothing.

Open a new task of the same type and record its ID on the source in
`replaced_by_task_id`, in the same transaction. The source is dead-lettered, so it is
not open and cannot conflict with the open-task unique index. If another task of that
type is already `open`, `in_progress` or `retry_scheduled` for the checkout, resolve it
as `resolved_noop` before inserting the replacement (§8.1).
Its `due_at`, passed as `p_task_due_at`, stays the checkout's original
`reservation_expires_at` or `payment_grace_expires_at`; `next_attempt_at` is the
post-lock `clock_timestamp()`, so it runs now. The dedupe key is type, checkout ID,
original due time and admin `p_command_id`, never the requeue time.

A replay returns the recorded replacement ID, even if that replacement has since run.
Two concurrent calls lock the same source: the second returns the first replacement
instead of creating another. The replacement follows §5.3 or §5.4, including a fresh
Cashfree read, so an admin can retry but cannot release books without one. Audited.

### 5.10 `resolve_failed_conversion` (admin, through SDD 08; D-95)

`marketplace_sec.resolve_failed_conversion(p_request_id UUID, p_action TEXT, p_reason TEXT,
p_idempotency_key TEXT, p_command_id UUID)` is service role only and admin-only through
SDD 08. It acts on an unresolved `conversion_failed` case. It reads the verified payment
itself for `p_payment_id` and `p_paid_at`; the admin does not supply either. Take the §7
locks: customer advisory lock, payment, cart, store, checkout, order if present, stock
rows in ID order, then listings. Read `clock_timestamp()` after those locks.

| `p_action` | Result |
|---|---|
| `retry_convert` | Allowed only before the saved `paid_at + 24 hours` (D-04). Call `convert_paid_checkout` again with that payment and original `paid_at`. The order keeps `acceptance_due_at = paid_at + 24 hours`. Success closes the case and records the recovery action and order ID; another failure leaves the case open and holds active |
| `refund` | Release the holds; set `platform_cancelled`, `closed_reason_code = 'conversion_failed'`; resolve checkout tasks; request the whole payment from SDD 04 category 5, keyed by payment ID as in §5.6; close the case |
| Retry at or after `paid_at + 24 hours` | `INVALID_COMMAND`: "The 24-hour window to retry has passed. Escalate this case to the owner." Nothing changes |
| Anything else | `INVALID_COMMAND`; nothing changes |

After the D-04 window only `refund` can resolve the case, because the store could no
longer accept a new order. The admin may also refund inside the window when a retry
cannot succeed. Nothing refunds automatically: until an admin acts, the case stays open
with holds active (D-95).

An order created by `retry_convert` that expires unaccepted is fault `platform`,
regardless of alert delivery: failed conversion is a system failure under D-04. This
applies D-04 and adds no rule; §6.6 reads the recorded recovery action.

When SDD 02 records the failure, it also sets the admin case deadline to 7 days later
and extends active holds' `expires_at` to at least that deadline, in the same
transaction (D-95). If the deadline passes with the case open, the admin queue
escalates it to the owner. Nothing releases the holds by itself.
`expire_reservation` and `expire_payment_grace` do nothing on a verified success.

The action and reason are audited. A replay after conversion or an approved refund
does nothing. A retry racing SDD 02's verification of the same payment uses the same
payment lock and one-order constraints; only one conversion commits (§7).
The payment ID refund key also prevents a later §5.6 replay from refunding again.
The matching source changes (register D-95, master §5, SDD 04 category 5) are recorded in §20.

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
