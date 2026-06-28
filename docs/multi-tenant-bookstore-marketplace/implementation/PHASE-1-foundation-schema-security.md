# PHASE-1: Foundation Schema and Security

**Status:** `needs_review`
**Last updated:** 2026-06-24
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
| Marketplace migration plan | `complete` | [Phase 1 plan](./PHASE-1-foundation-schema-security-plan.md) was converted into split live migrations. |
| `stores` and `store_administrators` | `complete` | Separate from existing P2P domain and present in live Supabase. |
| Store status/verification fields | `complete` | Live constraints include `draft`, `pending_verification`, `approved_pending_setup`, `active`, `selling_restricted`, `suspended`, `closed`, and `rejected`. |
| Policy configuration foundation | `complete` | `marketplace_policy_config` and `marketplace_localities` are present. |
| Audit/event foundation | `complete` | `marketplace_events`, `marketplace_notifications`, `marketplace_audit_logs`, and `commerce_idempotency_keys` are present. |
| Platform role/admin primitive | `complete` | `platform_user_roles` and `platform_admin_actions` are present. |
| Support/refund/reconciliation queue primitive | `complete` | Support, refund, finance reconciliation, settlement, moderation, and delivery ops queue primitives are present. |
| Storage buckets/policies | `complete` | `seller-verification-docs` is private; marketplace storage policies use first-folder store isolation. |
| RLS policies | `complete` | Phase 1 marketplace foundation tables have RLS enabled. |
| RLS/security tests | `needs_review` | Post-deployment audit and Supabase MCP refresh confirmed foundation state; Phase 2 privileged functions still need cross-tenant denial tests. |

---

## Verification Log

- 2026-05-22: Created reviewable [Phase 1 foundation schema/security implementation plan](./PHASE-1-foundation-schema-security-plan.md).
- 2026-06-19: Phase 1 foundation migrations applied to live Supabase project and post-deployment audit recorded in DOC-13.
- 2026-06-24: Supabase MCP refresh confirmed Phase 1 migrations, RLS-enabled marketplace foundation tables, `seller-verification-docs` bucket, storage path isolation, and store/onboarding status constraints.

---

## Acceptance Criteria

- [x] Marketplace foundation tables are separate from P2P tables.
- [x] Store tenant boundary is enforced by RLS.
- [x] Consumers cannot read private store data through marketplace foundation projections.
- [x] Store applicant cannot sell before approval because public projection requires `active`, `approved`, complete setup, and allowed selling status.
- [x] Platform roles and admin primitives are separate from Store Owner roles.
- [x] Append-only event/audit foundation exists for later commerce transitions.
- [x] Storage policies avoid broad marketplace bucket listing and cross-store leaks.
- [x] Security/RLS checks are documented in DOC-13 and refreshed through Supabase MCP.
- [x] `DOC-13` is updated.

---

## Blockers

- Existing Supabase advisor issues must be remediated separately or explicitly isolated before marketplace production launch.

---

## Decisions Made During Implementation

- Phase 1 remained foundation-only: no Store Owner UI, consumer marketplace UI, inventory screens, payment, or delivery integration.
- The private seller document bucket is `seller-verification-docs`.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Phase 1 foundation is applied and audited. Phase 2 may proceed after a reviewed implementation plan. Do not build inventory, payments, delivery, or image-to-LLM workflows from this tracker.
