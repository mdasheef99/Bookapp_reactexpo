# SDD 01, part 1: Data model and settings

**Part of SDD 01.** Section numbers are those of the whole SDD, so a reference such as
"SDD 01 §5.3" means §5.3 in whichever part holds it. The map is in the
[overview](./01-0-overview.md). The full single-file copy
[01-checkout-reservation-sdd.md](../01-checkout-reservation-sdd.md) is kept for reference
only; build from these parts.

---

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
  ('commerce.checkout.duplicate_payment.customer', 'customer'),
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
| `commerce.min_checkout_total_minor` | 100 | D-107; also enforced by SDD 02 `payments.amount_minor` CHECK |
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
