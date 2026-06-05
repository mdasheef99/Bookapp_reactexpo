# PHASE-1: Foundation Schema and Security

**Status:** `needs_review`
**Last updated:** 2026-05-22
**Phase goal:** Create the separate bookstore marketplace foundation with strict tenant security.

---

## Required Reading

- [DOC-0: Product Architecture](../DOC-0-product-architecture.md)
- [DOC-1: Identity, Security, and Compliance](../DOC-1-identity-security-compliance.md)
- [DOC-9: Platform Operations and Admin](../DOC-9-platform-ops-admin.md)
- [DOC-10: Notifications, Events, and Realtime](../DOC-10-notifications-events-realtime.md)
- [DOC-12: Build Strategy and Implementation Sequence](../DOC-12-build-strategy-and-implementation-sequence.md)
- [PHASE-0](./PHASE-0-codebase-db-audit.md)
- [Phase 1 Foundation Schema and Security Implementation Plan](./PHASE-1-foundation-schema-security-plan.md)

---

## Scope

- Create separate marketplace schema/tables and migrations.
- Add store identity, store administrators, status fields, policy config, audit/event foundation, and storage policies.
- Add minimal platform role gates, admin action log, support/refund/reconciliation queue primitives.
- Add RLS tests and security checks.
- Avoid reusing P2P `listings`/`transactions`.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Marketplace migration plan | `needs_review` | [Phase 1 plan](./PHASE-1-foundation-schema-security-plan.md) created; review before migration. |
| `stores` and `store_administrators` | `not_started` | Separate from existing P2P domain. |
| Store status/verification fields | `not_started` | Align with DOC-1 and DOC-2. |
| Policy configuration foundation | `not_started` | SLA/payment/delivery/commission/limit values. |
| Audit/event foundation | `not_started` | Append-only event/audit shape. |
| Platform role/admin primitive | `not_started` | Separate platform roles from Store Owner roles. |
| Support/refund/reconciliation queue primitive | `not_started` | Minimal operational queue foundation only. |
| Storage buckets/policies | `not_started` | Seller docs private; public assets no broad listing. |
| RLS policies | `not_started` | Store scoped, consumer public projections only. |
| RLS/security tests | `not_started` | Cross-store access denial is required. |

---

## Verification Log

- 2026-05-22: Created reviewable [Phase 1 foundation schema/security implementation plan](./PHASE-1-foundation-schema-security-plan.md).
- No migrations, schema changes, RLS policies, storage buckets, or app code have been created yet.

---

## Acceptance Criteria

- [ ] Marketplace foundation tables are separate from P2P tables.
- [ ] Store tenant boundary is enforced by RLS.
- [ ] Consumers cannot read private store data.
- [ ] Store applicant cannot sell before approval.
- [ ] Platform roles and admin primitives are separate from Store Owner roles.
- [ ] Append-only event/audit foundation exists for later commerce transitions.
- [ ] Storage policies avoid broad listing and cross-store leaks.
- [ ] Security/RLS tests are documented and passing.
- [ ] `DOC-13` is updated.

---

## Blockers

- Phase 0 findings and Phase 1 plan must be reviewed before migrations.
- Existing Supabase advisor issues must be remediated separately or explicitly isolated before marketplace production launch.

---

## Decisions Made During Implementation

- Phase 1 will start with a reviewed migration/security plan before any database changes.
- Phase 1 remains foundation-only: no Store Owner UI, consumer marketplace UI, inventory screens, payment, or delivery integration.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Review the [Phase 1 plan](./PHASE-1-foundation-schema-security-plan.md). If accepted, convert it into migrations and RLS/security tests in small steps. Do not build Store Owner UI until foundation schema/RLS is implemented and reviewed.
