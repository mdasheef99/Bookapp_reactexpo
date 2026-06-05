# PHASE-4: Store Owner Console

**Status:** `not_started`
**Last updated:** 2026-05-22
**Phase goal:** Build the minimal operating console for approved bookstores.

---

## Required Reading

- [DOC-8: Store Owner Console](../DOC-8-store-owner-console.md)
- [DOC-1: Identity, Security, and Compliance](../DOC-1-identity-security-compliance.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](../DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-3: Canonical Books, Metadata, and Inventory](../DOC-3-canonical-books-metadata-inventory.md)

---

## Scope

- Store Owner access gate.
- Store Owner Console entry from Profile for existing signed-in users.
- Dashboard.
- Inventory list/edit/publish/unpublish.
- Store profile, hours, policies, pickup/delivery settings.
- Subscription/quota visibility.
- Compliance and policy blocker explanations.
- Basic store statement summary area if ledger exists later.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Store Owner access gate | `not_started` | Store context from verified ownership. |
| Store Owner surface switch entry | `not_started` | Profile section entry routes to gate; Login entry is covered by Phase 2 onboarding. |
| Console navigation | `not_started` | Separate from consumer marketplace surface. |
| Dashboard cards | `not_started` | Pending tasks, inventory health, quota/status. |
| Inventory management UI | `not_started` | Uses Phase 3 services. |
| Store profile/settings UI | `not_started` | Hours, policies, pickup/delivery settings. |
| Subscription/quota UI | `not_started` | Own plan only, no platform-wide admin. |
| Compliance blocker UI | `not_started` | Missing payout/tax/verification/policy status. |
| Tests | `not_started` | Tenant access and private data boundaries. |

---

## Verification Log

No verification run yet.

---

## Acceptance Criteria

- [ ] Store Owner can access console only through verified store context.
- [ ] Existing signed-in users can open Store Owner Console / onboarding from Profile.
- [ ] Store Owner cannot access other stores.
- [ ] Dashboard shows operational tasks, inventory health, subscription, and quota status.
- [ ] Store Owner can manage own inventory/listings and store profile.
- [ ] Store Owner can see own plan/limits but not platform-wide subscription management.
- [ ] Store statement/compliance data is store-scoped.
- [ ] `DOC-13` is updated.

---

## Blockers

- Phase 1 and Phase 3 must provide secure data boundaries.

---

## Decisions Made During Implementation

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Do not add manager delegation or advanced marketing modules in this phase.
