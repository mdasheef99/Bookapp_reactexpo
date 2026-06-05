# PHASE-11: Notifications and Realtime

**Status:** `not_started`
**Last updated:** 2026-05-22
**Phase goal:** Add reliable event-driven notifications and selected realtime updates.

---

## Required Reading

- [DOC-10: Notifications, Events, and Realtime](../DOC-10-notifications-events-realtime.md)
- [DOC-1: Identity, Security, and Compliance](../DOC-1-identity-security-compliance.md)
- [DOC-9: Platform Operations and Admin](../DOC-9-platform-ops-admin.md)

---

## Scope

- Expansion of marketplace events that already started in Phase 1.
- Notification deliveries.
- Push/in-app notifications.
- Notification preferences.
- Selected Supabase realtime subscriptions.
- Event action tasks for ops queues.
- Webhook-derived event processing.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Event table/model | `not_started` | Append-only, idempotent. |
| Notification delivery model | `not_started` | Push/in-app first. |
| Store Owner notifications | `not_started` | Requests, deadlines, paid orders, delivery exceptions. |
| Customer notifications | `not_started` | Confirmation, payment, pickup, delivery, refunds. |
| Platform ops action tasks | `not_started` | Payment/delivery/refund/grievance cases. |
| Realtime publication setup | `not_started` | Selected tables only, RLS verified. |
| Deep link auth checks | `not_started` | Role/tenant checks. |
| Tests | `not_started` | PII-safe notifications and realtime recovery. |

---

## Verification Log

No verification run yet.

---

## Acceptance Criteria

- [ ] Key marketplace transitions create append-only events.
- [ ] Phase 11 does not introduce event foundation for the first time; it expands the existing foundation.
- [ ] Store owners receive alerts for requests and deadlines.
- [ ] Customers receive status updates for confirmation, payment, pickup, delivery, and refunds.
- [ ] Realtime is enabled only for selected tables with verified RLS.
- [ ] Active screens recover by refetching canonical state.
- [ ] Notification text avoids customer PII and payment details.
- [ ] NDR/RTO/reconciliation/grievance events create platform-actionable tasks.
- [ ] `DOC-13` is updated.

---

## Blockers

- Event foundations from earlier phases must exist.

---

## Decisions Made During Implementation

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Realtime is for freshness only. Database state and server transitions remain authoritative.
