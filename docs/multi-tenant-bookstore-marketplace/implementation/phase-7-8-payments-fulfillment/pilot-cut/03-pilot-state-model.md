# Pilot State Model

**Created:** 2026-11-13. **Status:** approved by the owner on 2026-11-13. Grants no authority.
**What this is:** the master view for the pilot only: what the pilot builds, its states,
timers, settings and fault rules, and which document owns each. It adds no rule. Every row
is taken from [SDD 01](../01-checkout-reservation/01-0-overview.md),
[SDD 02](../02-cashfree-payments/02-0-overview.md) and the pilot cut
([overview](./00-pilot-cut-overview.md), [SDD 01 cut](./01-checkout-reservation-pilot-cut.md),
[SDD 02 cut](./02-cashfree-payments-pilot-cut.md)), and cites where. If this file and its
source disagree, the source wins and this file is corrected.

**Why a separate file:** the master [SDD 00](../00-master-state-model-sdd.md) covers all
of Phases 7 and 8, was never approved, and predates SDD 01 and SDD 02. It is left as it is
for the later lanes; for the pilot, this file replaces it. A checklist comparison of SDD 00
against the SDDs (Haiku, 2026-11-13) supplied the items below.

---

## 1. What the pilot builds

| Table | New or changed | Owner | Pilot |
|---|---|---|---|
| `store_order_requests` (the checkout) | Changed | SDD 01 §3.1 | Keep |
| `store_order_request_items` | One new column | SDD 01 §3.2 | Keep |
| `inventory_holds` | No column change | SDD 01 §3.3 | Keep |
| `store_orders` (the paid order) | New | SDD 01 §3.4 | Without the photo columns |
| `store_order_items` | New | SDD 01 §3.5 | Without the photo columns |
| `commerce_pauses` | New | SDD 01 §3.6 | Keep; D-81 kinds block new reservations only |
| `order_receipts` | New | SDD 01 §3.10 | Keep; email Later |
| `order_missing_reports`, `order_missing_report_items` | New | SDD 01 §3.11 | Keep |
| `order_item_stock_movements` | New | SDD 01 §3.13 | Keep |
| `commerce_platform_incidents` | New | SDD 01 §3.12 | Later |
| `payments` | New | SDD 02 §4.1 | Keep; poll never cleared |
| `payment_attempts` | New | SDD 02 §4.2 | Keep, every column |
| Webhook events and private bodies | New | SDD 02 §4.3 | Keep |
| Webhook rejection counters | New | SDD 02 §4.3a | Later |
| `provider_checks` | New | SDD 02 §4.4 | Keep |
| `cashfree_api_budget` | New | SDD 02 §4 | Keep |
| `commerce_admin_cases` | New | Pilot overview §5 | Pilot only |
| Ledger and refund recording stand-ins | New | Pilot overview §6 | Pilot only, until SDD 03 and SDD 04 |
| `event_action_tasks`, `marketplace_policy_config`, carts | Existing | Phase 6 | Used; task types and settings added |

## 2. Checkout states (`store_order_requests.status`, pay-first rows)

Source: SDD 01 §5.8. Pilot change: SDD 01 cut §5.7, §5.8.

| From | To | By | Pilot |
|---|---|---|---|
| (cart) | `reserved` | `create_reservation` | Keep |
| `reserved` | `converted` | `convert_paid_checkout` | Keep |
| `reserved` | `awaiting_payment_result` | `expire_reservation` | Keep |
| `reserved` | `reservation_expired` | `expire_reservation` | Keep |
| `reserved`, `awaiting_payment_result` | `customer_cancelled` | `cancel_reservation` | Keep |
| `reserved`, `awaiting_payment_result` | `platform_cancelled` | `resolve_failed_conversion`'s `refund` | Keep; the D-81 path (`cancel_for_store_ineligibility`) is Later |
| `awaiting_payment_result` | `converted` | `convert_paid_checkout` | Keep |
| `awaiting_payment_result` | `reservation_expired` | `expire_payment_grace` | Keep |
| `reservation_expired` | `converted` | `resolve_late_payment` | Keep |

No other transition exists; a trigger refuses any other change on a pay-first row.

## 3. Order states (`store_orders.status`)

Source: SDD 01 §6.8. Pilot change: SDD 01 cut §6.3, §6.4, §6.7, §6.8; overview §4.

| From | To | By | Pilot |
|---|---|---|---|
| (payment) | `awaiting_store` | `convert_paid_checkout`, `resolve_late_payment` | Keep |
| `awaiting_store` | `accepted` | `accept_order`; `report_missing_books` | Keep |
| `awaiting_store` | `cancelled` | `expire_unaccepted_order`; `report_order_unavailable`; `cancel_paid_order` | Keep |
| `accepted` | `ready_for_pickup` | `mark_order_ready` | Pilot store wrapper (overview §4); `ready_for_pickup` is the last pilot state |
| `accepted` | `ready_to_ship` | `mark_order_ready` | Not reached: delivery is refused in the pilot (guard 10) |
| `accepted` | `cancelled` | `record_missing_outcome` (cancelled all); `report_order_unavailable`; `cancel_paid_order`; `expire_unprepared_order` | Keep (`expire_photo_send` Later) |
| Any row with `awaiting_photo_check` | | Photo commands | Later; the trigger refuses that state |

Final states in the pilot: `cancelled`, and `ready_for_pickup` until SDD 06 adds pickup.

## 4. Payment states (`payments.status`)

Source: SDD 02 §4.1.1, kept in full in the pilot.

| State | Next |
|---|---|
| `initiating` | `created`; `pending`, `paid`, `paid_late`; `start_failed` (definitive refusal only); `closed_unpaid` |
| `start_failed` | `initiating` (new round); `closed_unpaid` |
| `created` | `pending`, `paid`, `paid_late`, `closed_unpaid` |
| `pending` | `created`, `paid`, `paid_late`, `closed_unpaid` |
| `paid` | Final |
| `paid_late` | Final |
| `closed_unpaid` | `paid_late` if a success still arrives; otherwise stays, still polled |

Attempt-level outcomes (`success`, `amount_mismatch`, `duplicate_success`, `reversed`,
`success_unresolved`, `kept_by_cashfree`) live on `payment_attempts`, not on the payment
(SDD 02 §9.3, §13).

## 5. Timers

Sources: SDD 01 §8.1, §8.2, §8.3; SDD 02 §11.2, §13.2. Pilot change: SDD 01 cut §8.1; SDD 02
cut §11.1, §11.2.

| Timer (task type) | Starts | Length | Pilot |
|---|---|---|---|
| `reservation_expiry` | Reservation | 10 minutes (Q36) | Keep |
| `payment_grace_expiry` | Reservation end | 15 minutes (D-102) | Keep |
| `terminate_provider_order` | Cancel or close | Retries | Stub until P5a |
| `receipt_email` | Payment | Retries | Stays retrying (`transport_not_configured`) |
| `acceptance_reminder` | Verified payment | 30 open minutes (BC-12) | Keep |
| `acceptance_escalation` | Verified payment | 45 open minutes (BC-12, BC-13) | Keep |
| `acceptance_expiry` | Verified payment | 24 hours (D-04) | Keep; fault always `platform` while the alert channel is unreliable |
| `missing_outcome_expiry` | Missing-book report | 24 hours (D-83) | Keep |
| `preparation_alert`, `preparation_expiry` | Acceptance | D-79 times, 1 business day grace | Keep |
| `photo_send_expiry`, `photo_check_expiry` | Photo request | 24 hours each (D-43, D-53) | Later |
| Payment poll | Payment start | Every minute while live; every 5 minutes for 2 hours after close; hourly for 7 days; then daily with no end | Pilot schedule (overview §3 item 3) |
| Duplicate watch | Duplicate found | 3 business days, then "Ask Cashfree"; refund after 5 business days without answer (D-78, D-110) | Keep |
| Failed-conversion case | Conversion failure | 7 days (D-95) | Keep |
| Long-unconfirmed closed payment | Close | 24 hours (CF-65) | Keep |

## 6. Settings

Sources: SDD 01 §4, SDD 02 §5. Pilot change: SDD 01 cut §4, SDD 02 cut §5. All other
values are as the SDDs give them.

| Key | Value | Pilot |
|---|---|---|
| `commerce.reservation_window_seconds` | 600 | Keep |
| `commerce.payment_grace_seconds` | 900 | Keep |
| `commerce.max_order_book_total_minor` | 500000 | Keep |
| `commerce.min_checkout_total_minor` | 100 | Keep |
| `commerce.reservation_attempts_per_hour` | 6 | Keep |
| `commerce.customer_max_live_checkouts` | 2 | Keep |
| `commerce.customer_daily_paid_order_limit` | off | Keep |
| `commerce.paid_order_acceptance_seconds` | 86400 | Keep |
| `commerce.acceptance_reminder_open_seconds` | 1800 | Keep |
| `commerce.acceptance_escalation_open_seconds` | 2700 | Keep |
| `commerce.same_day_cutoff_seconds_before_close` | 7200 | Keep |
| `commerce.missing_outcome_window_seconds` | 86400 | Keep |
| `commerce.preparation_grace_business_days` | 1 | Keep |
| `commerce.schedule_horizon_days` | 62 | Keep |
| `commerce.store_daily_paid_order_limit` | 20 | Keep |
| `commerce.store_alert_channel_reliable` | false | Keep |
| `commerce.provider_check_max_age_seconds` | 60 | Keep |
| `commerce.photo_send_window_seconds`, `commerce.photo_check_window_seconds` | 86400 | Later |
| `commerce.provider_order_expiry_seconds` | 960 | Keep |
| `commerce.payment_poll_live_seconds` | **60** (SDD: 20) | Pilot value |
| `commerce.payment_poll_batch_max` | **25** | Pilot only |
| `commerce.payment_poll_after_close_seconds`, `_after_close_hours`, `_slow_seconds`, `_hourly_days` | 300, 2, 3600, 7 | Keep |
| `commerce.payment_poll_daily_days` | not used | Daily polling has no end |
| `commerce.payment_start_recovery_seconds` | 30 | Keep |
| `commerce.closed_payment_alert_hours` | 24 | Keep |
| `commerce.webhook_max_age_seconds` | 86400 | Keep (D-114) |
| `commerce.customer_payment_check_per_minute` | 10 | Keep |
| `commerce.payment_pay_presses_per_checkout` | 5 | Keep (D-106) |
| `commerce.duplicate_reversal_wait_business_days` | 3 | Keep |
| `commerce.duplicate_refund_no_answer_business_days` | 5 | Keep |
| `commerce.cashfree_reads_per_minute` | 25 | Keep |
| `commerce.india_bank_holidays` | admin list | Keep |
| `commerce.webhook_body_retention_days` | 180 | Later, with body deletion |
| `commerce.webhook_rejections_alert_per_minute` | 60 | Later, with rejection counters |

Per-customer limits: at most 2 live checkouts and 6 reservations an hour (SDD 01), and at
most 5 "Pay" presses per checkout (SDD 02). These do not cap the Cashfree attempts still
pending: an attempt can stay pending after its checkout closes (CF-65, CF-76). Store and platform money limits (unsettled ₹25,000, monthly loss cap ₹10,000)
belong to SDD 05 and SDD 03 and are not part of this pilot cut.

## 7. Faults

Source: SDD 01 §6.2, §6.3, §6.6. Pilot change: SDD 01 cut §6.6, §8.4; overview §4 (D-02,
D-04).

| Event | Fault | Pilot |
|---|---|---|
| Store does not accept within 24 hours | `platform` while `commerce.store_alert_channel_reliable` is false; `store` once it is true and the alert was delivered | Always `platform` (the alert channel stays unreliable in the pilot) |
| Store reports the order unavailable | `store` (reason `store_unavailable`) | Keep |
| Customer cancels after a missing-book report | `store` (reason `customer_cancelled_after_missing`) | Keep |
| Store does not prepare by the D-79 deadline | `store` (reason `not_prepared`) | Keep |
| Photo deadlines (`photos_not_sent`, `photos_rejected`, `photos_not_answered`) | `store` | Later |

Every cancellation records its reason code (SDD 01 §3.7).

## 8. Customer data shared outside BookConnect

| Data | Goes to | Why | Source |
|---|---|---|---|
| Phone number | The store | Pickup contact | SDD 01 |
| Phone number, and the customer's user ID without dashes | Cashfree | Cashfree requires a customer ID and phone to create a payment order | SDD 02 §7.2 (`createOrder`); owner confirmation pending (summary page) |
| Address | Nobody in the pilot | Delivery is refused in the pilot | SDD 01 guard 10 |

SDD 00 §14 lists only the store and the delivery provider; Cashfree is added here for the
pilot, pending the owner's confirmation. No email, address or name is sent to Cashfree;
`createOrder` sends only the customer ID and phone (SDD 02 §7.2).

## 9. Which document owns what

| Topic | Owner |
|---|---|
| Business rules | [Decision register](../../PHASE-7-8-decision-register.md) |
| Checkout, holds, paid order, store acceptance, stock, timers | SDD 01, narrowed by the SDD 01 cut |
| Payment start, verification, webhooks, poll, duplicates, rate limits | SDD 02, narrowed by the SDD 02 cut |
| Never-cut rules, admin cases, stand-in keys, slices, pilot decisions | Pilot overview |
| Build process, models, gates | [Build process](../BUILD-PROCESS.md) |
| Ledger, refunds sent, store money, pickup, delivery, admin console | SDD 03 to SDD 08, not in this pilot cut |
| Product specifications (DOC-0 to DOC-16) | Root; being brought in line with the register in the documentation pass (handoff §9) |
