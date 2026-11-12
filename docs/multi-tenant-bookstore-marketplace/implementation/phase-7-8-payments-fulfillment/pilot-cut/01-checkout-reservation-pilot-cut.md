# Pilot Cut of SDD 01: Checkout and Paid-Order Acceptance

**Created:** 2026-11-12. **Revised:** 2026-11-13 after review rounds 1 to 4 (overview §8).
**Status:** approved by the owner on 2026-11-13 (D-119); grants no authority by itself.
**Cuts:** [SDD 01](../01-checkout-reservation/01-0-overview.md) (approved 2026-11-11),
which is not changed. Rules for reading this file, the never-cut list (N-01 to N-13),
admin cases (§5), stand-in keys (§6) and the decisions it would revisit are in the
[overview](./00-pilot-cut-overview.md); admin-script rules are in the
[SDD 02 cut](./02-cashfree-payments-pilot-cut.md). Sandbox only (overview §1).

Classes: **Keep** (build as the SDD says), **Simplify** (build as the SDD says except the
stated change), **Detect** (not automated: a check opens an admin case and a person
resolves it), **Later** (not built for the pilot; gate stated).

---

## 1. Sections

| SDD 01 section | Class | Pilot rule |
|---|---|---|
| §1 Flow | Simplify | No photo step: no order carries a photo requirement until §6.5 is built. Delivery stays refused (guard 10) |
| §2 What exists | Keep | Reference only; re-check live at slice start (AGENTS.md) |
| §3.1 Checkout changes | Keep | |
| §3.2 Printed price | Keep | |
| §3.3 Holds | Keep | |
| §3.4 `store_orders` | Simplify | Leave out the photo columns (`photo_requested_at_payment`, `photo_requirement_cleared_at`, `photo_send_due_at`, `photos_sent_at`, `photo_check_due_at`, `photos_approved_at`); a later migration adds them with §6.5. Keep `store_alert_delivered_at` (nullable, unused until §8.4) |
| §3.5 `store_order_items` | Simplify | Leave out `photo_requested` and `photo_request_id` and their CHECK; added with §6.5 |
| §3.6 `commerce_pauses` | Simplify | Table and every kind kept. The three D-81 kinds (`store_fraud_suspended`, `store_payment_permission_lost`, `store_closed_by_admin`) block new reservations only. `cancels_live_reservations` keeps the SDD's values (true for the D-81 kinds), but nothing in the pilot acts on it, because §5.7 is not built; so no data change is needed when §5.7 arrives. No `PAUSE_KIND_NOT_AVAILABLE` refusal is needed. Overview §4 (D-81) |
| §3.7 Cancel reasons | Simplify | `photos_not_sent`, `photos_rejected`, `photos_not_answered` stay in the CHECK but nothing writes them |
| §3.8 Access | Simplify | Kept (N-10), with one pilot deviation: a store wrapper calls `mark_order_ready` (§6.7; overview §4) |
| §3.9 Migration groups | Simplify | Regrouped into the pilot slices (overview §7). Group 5 omits the photo notification types; the other seeds stay |
| §3.10 `order_receipts` | Keep | Email is Later (§11) |
| §3.11 Missing-book reports | Keep | |
| §3.12 `commerce_platform_incidents` | Later | Needed only once `commerce.store_alert_channel_reliable` is true; until then every missed acceptance is fault `platform` anyway. Gate: before the alert channel is declared reliable |
| §3.13 Stock movements | Keep | N-05 |
| §4 Settings | Simplify | Omit `photo_send_window_seconds` and `photo_check_window_seconds` until §6.5 |
| §5.0 Command contracts | Simplify | Contracts kept exactly for every command the pilot builds; rows for later commands (`respond_to_photos`, `send_requested_photos`, `expire_photo_send`, `expire_photo_check`, `cancel_for_store_ineligibility`, `acknowledge_store_alert`, `record_platform_incident`, `end_platform_incident`) are not built yet |
| §5.1 `create_reservation` | Keep | Guard 11 stays with SDD 07 |
| §5.2 `cancel_reservation` | Keep | |
| §5.3 `expire_reservation` | Keep | N-06 |
| §5.4 `expire_payment_grace` | Keep | N-06 |
| §5.5 `convert_paid_checkout` | Simplify | No Phase 9 photo lookup; no item is photo-requested. Receipt row kept; `receipt_email` task opened when an email was given (it stays retrying, §11). Daily store limit kept |
| §5.6 `resolve_late_payment` | Keep | Including the D-97 same-cart check and the D-98 pause check; all automatic (N-07) |
| §5.7 `cancel_for_store_ineligibility` | Later | A D-81 pause blocks new reservations only. A checkout already live ends on its own timers, usually within 25 minutes but longer when Cashfree cannot be read (D-101) or conversion failed (D-95). On time it converts and the order continues (D-21); after it closes, §5.6 refunds it under D-98. Gate: owner decision on D-81 (overview §4) |
| §5.8 Checkout transitions | Simplify | The `platform_cancelled` row is reached only by `resolve_failed_conversion`'s `refund` (no D-81 cancel). A late payment on such a checkout is refunded by §5.6 (L-04) |
| §5.9 `requeue_checkout_timer` | Simplify | Built as specified, but called only from an audited admin script (no SDD 08 screen; rules in the SDD 02 cut). Without it a dead-lettered expiry would hold books indefinitely |
| §5.10 `resolve_failed_conversion` | Simplify | Only the `refund` action, called from an audited admin script. `retry_convert` is Later. The 7-day case deadline, the hold extension and the §13 overdue scan are kept; the overdue case goes to the top of the owner's digest (overview §5). SDD 02 still commits the verified payment, opens the admin case and keeps the holds (N-07). Overview §4 (D-95) |
| §6 Paid-order rules and refusal table | Simplify | Photo rows of the refusal table are not built |
| §6.1 `accept_order` | Simplify | No photo branch: D-79 times and tasks are always set at acceptance |
| §6.2 Missing books | Simplify | No photo branch (no `awaiting_photo_check`, no requirement clearing). Refund requests go to SDD 04's request function, or its recording stand-in until SDD 04 exists |
| §6.3 `report_order_unavailable` | Simplify | Allowed from `awaiting_store` and `accepted` only |
| §6.4 `cancel_paid_order` | Simplify | Allowed from `awaiting_store` and `accepted` only |
| §6.5 Photos | Later | Gate: Phase 9's photo contract (SDD 01 §18) and the owner's decision on D-43/D-53 timing (overview §4) |
| §6.6 Timer commands | Keep | Reminder, escalation, acceptance expiry, preparation alert and expiry. `expire_unaccepted_order` always records fault `platform` while the alert channel is not reliable, as the SDD already says |
| §6.7 `mark_order_ready` | Simplify | No photo guard. Built in P6 with the store's "Mark ready" button, called through a pilot-only store wrapper with the same server-side store check as `accept_order`. Needed because the preparation timers (§6.6) are kept; without it every accepted order would expire. This departs from SDD 01 §3.8 (overview §4): SDD 06's checked command replaces the wrapper, and the two never run side by side. `ready_for_pickup` is the last pilot state; handover comes with SDD 06's pilot cut |
| §6.8 Order transitions | Simplify | Rows involving `awaiting_photo_check` are not built; the trigger refuses that state until §6.5 adds it |
| §7 Races and lock order | Simplify | Lock order kept in full (N-04). Race tests per §2 below |
| §8.1 Task types | Simplify | Omit `photo_send_expiry` and `photo_check_expiry`. `terminate_provider_order` uses its recording stub (registered in P1b) until pilot slice P5a |
| §8.2 Open-hours timers | Keep | |
| §8.3 Promised day and D-79 times | Simplify | No recalculation on photo approval |
| §8.4 Alert delivered | Later | `acknowledge_store_alert` is not built; `store_alert_delivered_at` stays null. Gate: as §3.12 |
| §9 Stock rules | Keep | N-05 |
| §10 Events and notices | Simplify | Omit `order.photos_sent` and `order.photos_approved` and their types. All others kept, including `checkout.duplicate_payment` |
| §11 Receipt | Simplify | Shown in the app. Email sender is Later (SDD 01 slice 10): the task stays retrying with `transport_not_configured`. Gate: before live payments (D-50) |
| §12 Screens | Simplify | Customer: cart, Paying, Waiting, result screens and order detail without photo actions. Store: paid orders, accept, missing books, cancel, "Mark ready" (§6.7), order detail without "Send photos", pause switch. Cart and Paying screens are merged in P2 and P3 but switched off; the Waiting and result screens come in P4b, the store screens in P6, where the new checkout is switched on (overview §7) |
| §13 Reconciliation scans | Simplify | Keep every scan except: the two photo scans (no photo orders) and the platform-incident scan (§3.12 Later). Report only, no case: the receipt-unsent scan, and the D-81 scan (a live checkout under a D-81 pause is expected in the pilot); both appear in the digest's reports part (overview §5). The failed-conversion 7-day escalation goes to the owner's digest. These scans are the "detect" in detect-and-alert (N-11); every case reaches the owner (overview §5) |
| §14 Tests | Simplify | §2 below. Run on the disposable test database, not the dev database (overview §3 item 1) |
| §15 Phase 6 rework | Simplify | Every change kept. Only the timing moves: the old `submit_order_request` stays open to new carts until the switch-over in P6, instead of closing from SDD slice 2, so the existing order path keeps working while the new checkout is switched off (overview §7) |
| §16 Worked examples | Simplify | Example 7 (photos) is Later; the others stand. Example 6's fault is `platform` |
| §17 Choices | Keep | As approved; item 7 (D-103) and item 10 apply when §6.5 is built |
| §18 Open points | Simplify | Before P2: Phase 9's stock-only listing-trigger change and lock-order migration (unchanged). The photo contract moves with §6.5. The printed-book field, alert channel and receipt sender remain live gates |
| §19 Build order | Replaced | By the pilot slices in the overview, §7 |
| §20 Handovers | Simplify | Unchanged for the parts built. SDD 08 is replaced by audited admin scripts for the pilot. Refund requests use SDD 04's function or its recording stand-in with the overview §6 keys. SDD 06 and SDD 07 call `mark_order_ready` as §20 says when they are built; SDD 06's command then replaces the pilot store wrapper |
| §21 Traceability | Keep | Decisions changed by this cut are listed in the overview, §4 |

## 2. Tests (SDD 01 §14)

All tests named below run on the disposable test database with the test time function
(overview §3 item 1). Deadline tests set the clock instead of waiting.

**Kept:**
- Reservation: R-01 to R-14, R-16, R-18 to R-21.
- Expiry and payment: E-01 to E-13, E-15 to E-22, E-24, E-27, E-28, E-31. E-14 without its
  ineligibility cases. E-30's cancellation part (task stays open without a sender).
- Late payment: L-01 to L-08. L-04's platform-cancel case uses a checkout closed by the failed-conversion `refund` script.
- Acceptance: A-01, A-02, A-04 to A-07. A-03 only its "setting off gives `platform`" case.
- Missing books: M-01 to M-07, M-09 to M-14, M-16 to M-19, M-22. M-20 and M-23 without
  their photo cases.
- Preparation and cancel: PR-01 to PR-03, PR-05 to PR-08, PR-11, PR-12. PR-09 without its
  photo part. C-01 in `awaiting_store` and `accepted`.
- Contracts: O-01 to O-04 for the commands and transitions the pilot builds; O-03 without
  its photo-send and photo-response cases.
- Security: S-01 to S-08. Stock: ST-01 to ST-04. Reconciliation: RC-01 without its `awaiting_photo_check`,
  photo-requirement and platform-incident assertions.
- Races, each in both orders: RX-01 to RX-03, RX-05 to RX-07, RX-10, RX-12, RX-13, RX-15,
  RX-17 to RX-20, RX-22, RX-25, RX-28.

**Later, with the section they test:**
- Photos (§6.5): PH-01 to PH-09, M-08, M-15, M-21, PR-04, RX-08, RX-09, RX-11, RX-21,
  RX-23, RX-24, RX-26, and the photo cases of M-20, M-23, PR-09, O-01, O-02, O-03 and
  RC-01.
- D-81 cancellation (§5.7): R-15, R-17, E-29, RX-04, RX-14, RX-16, RX-29, and E-14's
  ineligibility cases.
- Failed-conversion retry (§5.10): E-25, E-26, RX-27, A-09.
- Alert channel (§3.12, §8.4): A-03's `store` case, A-08, PR-10, RC-01's
  platform-incident case.
- Receipt sender (§11): E-23 and E-30's sender cases.

**Added by this cut:**
- PC1-01 a D-81 pause blocks a new reservation; a checkout reserved before it can still
  pay and convert on time; a payment after that checkout closed is refunded under D-98.
- PC1-02 a failed conversion keeps the payment, the admin case and the holds; the admin
  script's `refund` releases the holds, closes the checkout `platform_cancelled` with
  `conversion_failed` and requests one refund keyed by payment ID; a replay does nothing.
- PC1-03 the admin scripts for `requeue_checkout_timer` and `resolve_failed_conversion`
  pass the shared admin-script tests (SDD 02 cut, PC2-05).
- PC1-04 under a D-81 pause with a live checkout, the D-81 scan lists it in the digest's
  reports part and opens no case; a checkout past its timers still opens the usual cases.
- PC1-05 the store's "Mark ready" moves an `accepted` order of its own store to ready
  before `preparation_expires_at` and resolves the preparation timer; a customer, another
  store's member and a call after the deadline are refused. The order then stays
  `ready_for_pickup` with no further timer.
