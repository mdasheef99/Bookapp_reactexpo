# DOC-10: Notifications, Events, and Realtime

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Planning draft
**Depends On:** DOC-1, DOC-2, DOC-6, DOC-7, DOC-8, DOC-9
**Owns:** Marketplace event model, notification triggers, push/in-app delivery, realtime subscriptions, provider webhooks, idempotency, and audit-safe event handling.

---

## 1. Purpose

This document defines how important marketplace events move through the system.

The marketplace has time-sensitive actions: stores must confirm availability, customers must pay before holds expire, delivery providers send shipment updates, and platform operations must react to exceptions. These flows need a reliable event and notification layer.

Realtime updates are useful for active screens, but they are not the source of truth. Database state and server-side events remain authoritative.

Implementation sequencing note: the append-only event foundation must be introduced with the marketplace foundation, before full notification/realtime UI. Critical notifications for store confirmation deadlines, payment windows, payment success/failure, refunds, and support/action queues must be built in the phases that introduce those flows. Phase 11 expands notification/realtime coverage; it must not be the first time events exist.

---

## 2. Live DB Context

The Supabase MCP audit found no public tables currently registered in the realtime publication.

That means marketplace realtime should be introduced intentionally:

- choose exact tables/events to publish
- verify RLS before enabling realtime
- avoid broadcasting private payloads
- keep push notifications and server event processing independent of realtime subscriptions

Realtime should not be enabled broadly across marketplace tables.

---

## 3. Event Principles

- Every important state transition should produce an event.
- Events should be append-only.
- Events should be idempotent.
- Notifications should be derived from events, not scattered across screens.
- Provider webhooks should create normalized internal events.
- Client apps should be able to miss realtime events and recover by refetching state.
- Sensitive payloads should be referenced by ID, not copied into notification text.

---

## 4. Event Envelope

Recommended event shape:

```text
marketplace_events
  id
  event_type
  schema_version
  entity_type
  entity_id
  store_id nullable
  user_id nullable
  actor_user_id nullable
  source
  command_id
  idempotency_key
  correlation_id
  causation_event_id nullable
  privacy_classification
  payload private
  created_at
```

`payload` is private. Public or client-visible notification text should be generated separately with minimum necessary data. Event producers must validate `(event_type, schema_version)` against a server registry. Correlation and causation IDs link commands, reminders, expiries, support work, and notification projections without copying PII. Privacy classification is explicit (`public`, `internal`, `confidential`, or `restricted`).

---

## 5. Critical Event Types

### 5.1 Store Events

| Event | Trigger |
|---|---|
| `store.application_submitted` | Store onboarding submitted. |
| `store.application_approved` | Platform approves store. |
| `store.application_rejected` | Platform rejects application. |
| `store.suspended` | Platform suspends store. |
| `store.selling_restricted` | Platform restricts selling while preserving existing fulfillment. |
| `store.subscription_status_changed` | Billing/entitlement state changes. |
| `store.extraction_quota_low` | Image extraction quota nearing limit. |
| `store.extraction_quota_exhausted` | Image extraction quota exhausted. |
| `store.compliance_action_required` | Store must resolve payout, tax, verification, or policy issue. |

### 5.2 Inventory Events

| Event | Trigger |
|---|---|
| `inventory.item_created` | Inventory item created. |
| `inventory.item_updated` | Inventory item changed. |
| `inventory.listing_published` | Listing becomes public. |
| `inventory.listing_unpublished` | Listing removed from public discovery. |
| `inventory.quantity_zero` | Listing quantity reaches zero. |
| `inventory.duplicate_detected` | Duplicate resolution needed. |

### 5.3 Order Events

| Event | Trigger |
|---|---|
| `marketplace_cart.submitted` | Cart separately transitions `active -> submitted` in the request-submission transaction. |
| `marketplace_cart.replaced` | Customer confirms cross-store cart replacement. |
| `order_request.submitted` | Customer submits unpaid request. |
| `order_request.confirmation_due_soon` | Store confirmation window nearing expiry. |
| `order_request.review_started` | Store Owner starts reviewing the request. |
| `order_request.clarification_requested` | Store requests bounded customer clarification. |
| `order_request.clarification_provided` | Customer supplies clarification and review resumes. |
| `order_request.confirmed` | Store confirms all items and the unchanged request enters provider-independent `payment_ready`. |
| `order_request.partially_confirmed` | Store confirms some items. |
| `order_request.changes_accepted` | Customer explicitly accepts a partial/materially changed result and the request enters `payment_ready`. |
| `order_request.unavailable` | Requested stock/items cannot be fulfilled. |
| `order_request.rejected` | Store rejects the full request for a bounded non-stock reason. |
| `order_request.support_requested` | Store Owner requests platform help without changing commerce status. |
| `order_request.cancelled` | Customer or authorized platform action closes an unpaid request. |
| `order_request.emergency_closure_paused` | A bounded emergency closure pauses an eligible pre-payment state. |
| `order_request.emergency_closure_resumed` | A paused request safely resumes its prior state/timers. |
| `order_request.store_ineligible` | Suspension/prohibition/selling ineligibility blocks progression. |
| `order_request.support_intervened` | An authorized support command changes request behavior/state. |
| `order_request.expired` | Store missed confirmation window. |
| `order_request.payment_ready_expired` | Customer missed the provider-independent payment-ready window. |
| `order.paid` | Payment succeeds and paid order is created. |
| `order.post_payment_issue_reported` | Store reports confirmed paid item cannot be fulfilled. |
| `order.cancelled` | Paid order cancelled. |
| `order.refunded` | Full refund completed. |
| `order.partially_refunded` | Partial refund completed. |
| `payment.reconciliation_required` | Payment provider, order, or ledger state mismatch detected. |
| `payment.chargeback_opened` | Gateway/customer dispute opened. |
| `settlement.batch_created` | Store settlement batch generated. |
| `settlement.payout_failed` | Store payout failed. |
| `settlement.payout_completed` | Store payout completed. |

### 5.4 Fulfillment Events

| Event | Trigger |
|---|---|
| `fulfillment.packed` | Store marks order packed. |
| `fulfillment.ready_for_pickup` | Pickup order ready. |
| `fulfillment.pickup_completed` | Pickup code verified. |
| `delivery.quote_created` | Final delivery quote created. |
| `delivery.shipment_booked` | Provider accepts shipment. |
| `delivery.picked_up` | Courier picks up package. |
| `delivery.out_for_delivery` | Package out for delivery. |
| `delivery.delivered` | Provider confirms delivery. |
| `delivery.failed` | Delivery failed. |
| `delivery.ndr_opened` | Non-delivery report requires action. |
| `delivery.reattempt_scheduled` | Delivery reattempt scheduled. |
| `delivery.rto_initiated` | Return-to-origin started. |
| `delivery.returned_to_store` | Package returned to bookstore. |
| `delivery.pickup_failed` | Provider pickup from store failed. |
| `delivery.weight_dispute_opened` | Provider weight/billing discrepancy opened. |
| `delivery.exception` | Lost/damaged/returned/provider issue. |

### 5.5 Compliance and Support Events

| Event | Trigger |
|---|---|
| `support.grievance_opened` | Customer/store grievance submitted. |
| `support.grievance_resolved` | Platform resolves grievance. |
| `dispute.opened` | Order, refund, condition, or delivery dispute opened. |
| `dispute.resolved` | Platform resolves dispute. |
| `moderation.case_opened` | Listing/store moderation case opened. |
| `moderation.action_taken` | Listing/store hidden, restored, or suspended. |

---

## 6. Notification Channels

| Channel | Use |
|---|---|
| Push notification | Time-sensitive mobile alerts. |
| In-app notification center | Durable user-visible status history. |
| Email | Receipts, support, verification, settlement summaries. |
| SMS/WhatsApp | Optional later for high-priority fulfillment or delivery. |

MVP should include push and in-app notifications. Email can be used for receipts/support where already available.

Marketing notifications must be opt-in and separate from transactional notifications.

---

## 7. Store Owner Notifications

Store owners should receive:

- new order request
- request nearing confirmation deadline
- request expired
- full request rejected for a non-stock reason
- owner support request acknowledged
- customer paid after confirmation
- pickup order ready-to-pack
- delivery order ready-to-pack
- delivery provider exception
- subscription issue
- image extraction quota warning
- store application status changes
- compliance action required
- settlement payout failed or completed
- NDR/RTO action required if store input is needed

High-priority store notifications should deep link into the relevant console screen after auth/access checks.

---

## 8. Customer Notifications

Customers should receive:

- order request submitted
- store confirmed full availability
- store confirmed partial availability
- store marked unavailable
- store rejected the request for a bounded non-stock reason
- request expired
- payment ready
- payment-ready reminder before expiry
- payment successful
- order ready for pickup
- delivery booked
- delivery out for delivery
- delivered
- refund/dispute updates
- NDR action required
- delivery reattempt scheduled
- return-to-origin update when customer impact exists
- unavailable book alert matched

Customer notification text must avoid leaking unnecessary store-internal details.

---

## 9. Platform Ops Notifications

Platform operators should receive queues or alerts for:

- seller application submitted
- delivery exception
- NDR/RTO/failed pickup/weight dispute case
- payment webhook mismatch
- payment reconciliation mismatch
- chargeback opened
- refund/dispute case opened
- store repeatedly missing confirmation windows
- settlement payout failure
- store compliance action overdue
- grievance opened
- moderation report
- suspected abuse

Operator alerts may be dashboard queues rather than push notifications.

---

## 10. Realtime Usage

Realtime is for active UI freshness.

Candidate realtime subscriptions:

| Audience | Realtime Data |
|---|---|
| Store Owner console | New order requests, request updates, paid orders, delivery exceptions. |
| Customer order screen | Request status, payment window, fulfillment/delivery status. |
| Platform ops dashboard | New review tasks, disputes, delivery exceptions. |

Rules:

- enable realtime only on tables with correct RLS
- use row-level filters where possible
- do not include raw provider payloads
- do not include payment, settlement, grievance, or moderation private payloads
- do not rely on realtime for push notifications
- refetch canonical state after receiving an event
- unsubscribe on logout or store context switch

---

## 11. Provider Webhooks

Payment and delivery webhooks must be handled server-side.

Webhook requirements:

- verify signature or provider authenticity
- enforce idempotency
- store raw payload privately
- normalize provider status
- update authoritative state through server-side transition functions
- emit internal marketplace event
- trigger notifications from internal event, not directly from provider webhook
- create reconciliation case when webhook amount/status cannot be matched safely

Webhook handlers must be safe to retry.

---

## 12. Notification Preferences

Users should be able to configure non-critical notifications.

Store owner preferences:

- new requests
- confirmation reminders
- paid order alerts
- delivery exceptions
- quota and subscription alerts
- marketing/product updates

Customer preferences:

- order updates
- delivery updates
- book availability alerts
- marketing/product updates

Transactional order and safety notifications should remain enabled as required for service operation.

---

## 13. Data Model

```text
marketplace_events
  id
  event_type
  schema_version
  entity_type
  entity_id
  store_id nullable
  user_id nullable
  actor_user_id nullable
  source
  command_id
  idempotency_key
  correlation_id
  causation_event_id nullable
  privacy_classification
  severity
  requires_action
  payload private
  created_at

marketplace_notifications
  id
  event_id
  store_id nullable
  user_id recipient
  notification_type
  title
  body nullable
  entity_type
  entity_id
  deep_link nullable
  privacy_classification
  read_at nullable
  created_at

notification_deliveries
  id
  event_id nullable legacy source
  marketplace_notification_id nullable commerce source
  recipient_user_id
  channel
  title
  body
  deep_link nullable
  status
  provider_message_id nullable
  sent_at nullable
  read_at nullable
  attempt_count
  max_attempts
  next_attempt_at nullable
  locked_at nullable
  locked_by nullable
  dead_lettered_at nullable
  created_at

notification_preferences
  id
  user_id
  preference_key
  channel
  enabled
  created_at
  updated_at

webhook_events
  id
  provider
  webhook_type
  provider_event_id
  idempotency_key
  status
  raw_payload private
  processed_at nullable
  created_at

event_action_tasks
  id
  event_id
  assigned_role
  assigned_user_id nullable
  status
  due_at nullable
  attempt_count
  max_attempts
  next_attempt_at nullable
  locked_at nullable
  locked_by nullable
  last_error_code nullable
  dead_lettered_at nullable
  resolved_at nullable
  created_at
```

---

## 14. Security and Privacy

- Notification bodies must not contain full addresses, phone numbers, or payment details.
- Push deep links must pass through auth and role gates.
- Store owner notification deep links must verify store access.
- Customer order notification deep links must verify customer ownership.
- Raw webhook payloads are private.
- Provider secrets and webhook verification keys are server-only.
- Realtime tables must have RLS and narrow publications.
- Logout must clear local notification state that may expose private store/customer data.
- `marketplace_notifications` is the canonical PII-safe commerce inbox projection. Commerce `notification_deliveries` rows represent transport attempts and must not form a competing in-app commerce inbox.
- Store notification fan-out resolves every distinct active recipient with the relevant capability, owner-only in the Phase 6 MVP, and deduplicates by event, recipient, and notification type.
- Settlement, payment reconciliation, grievance, moderation, and private delivery exception payloads must be available only to authorized platform roles.

---

## 15. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| EVT-01 | Key marketplace state transitions create append-only events. |
| EVT-02 | Store owners receive push/in-app alerts for new requests and confirmation deadlines. |
| EVT-03 | Customers receive status updates for confirmation, payment, pickup, delivery, and refunds. |
| EVT-04 | Payment and delivery webhooks are verified, idempotent, and server-side. |
| EVT-05 | Active order screens recover correctly by refetching after realtime events. |
| EVT-06 | Realtime is enabled only for selected tables with verified RLS. |
| EVT-07 | Notification deep links pass through auth and tenant checks. |
| EVT-08 | Notification text avoids customer PII and payment details. |
| EVT-09 | NDR, RTO, failed pickup, weight dispute, settlement, grievance, and reconciliation events produce platform-actionable tasks. |
| EVT-10 | Event foundation exists before payment implementation; payment and refund flows do not depend on screen-level side effects for notifications or audit. |
| EVT-11 | Marketplace events carry schema version, command, correlation, causation, and privacy classification. |
| EVT-12 | `order_request.rejected` and `order_request.support_requested` remain distinct from stock unavailability and commerce transitions respectively. |
| EVT-13 | Store notification fan-out is capability-scoped and deduplicated, and every deep link reauthorizes its target entity. |

---

## 16. Related Documents

- [DOC-1: Identity, Security, and Compliance](./DOC-1-identity-security-compliance.md)
- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
- [DOC-8: Store Owner Console](./DOC-8-store-owner-console.md)
- [DOC-9: Platform Operations and Admin](./DOC-9-platform-ops-admin.md)
- [DOC-11: Demand Signals, Bookclubs, and Places](./DOC-11-demand-signals-bookclubs-places.md)
- [DOC-14: Commerce State Machines](./DOC-14-commerce-state-machines.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
