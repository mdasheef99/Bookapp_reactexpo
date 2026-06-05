# PHASE-2: Store Onboarding and Verification

**Status:** `not_started`
**Last updated:** 2026-05-22
**Phase goal:** Let a bookstore apply, be reviewed, accepted, restricted, or rejected safely.

---

## Required Reading

- [DOC-1: Identity, Security, and Compliance](../DOC-1-identity-security-compliance.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](../DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-9: Platform Operations and Admin](../DOC-9-platform-ops-admin.md)
- [DOC-12: Build Strategy and Implementation Sequence](../DOC-12-build-strategy-and-implementation-sequence.md)

---

## Scope

- Seller application flow.
- Store Owner onboarding entry from Login / first-run auth and Profile.
- Verification document upload.
- Platform review states.
- Seller agreement and prohibited-items acceptance.
- Tax/payout readiness fields.
- Basic entitlement/subscription status.
- Store setup checklist.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Seller application data model | `not_started` | Includes legal seller, GSTIN/PAN readiness, payout status. |
| Store Owner onboarding entry points | `not_started` | Login / first-run auth for new users; Profile entry for existing signed-in users. |
| Seller application UI/API | `not_started` | Save, resume, submit. |
| Verification document upload | `not_started` | Private bucket only. |
| Seller agreement acceptance | `not_started` | Versioned acceptance. |
| Prohibited/counterfeit/pirated-book policy acceptance | `not_started` | Required before selling. |
| Platform review controls | `not_started` | Approve, reject, request info, suspend, restrict. |
| Entitlement/trial assignment | `not_started` | Basic plan/limits only. |
| Store setup checklist | `not_started` | Profile, hours, policies, payout, subscription. |
| Tests | `not_started` | Application access and document privacy. |

---

## Verification Log

No verification run yet.

---

## Acceptance Criteria

- [ ] Store cannot publish listings before approval.
- [ ] New users can discover and start Store Owner onboarding from Login / first-run auth.
- [ ] Existing signed-in users can discover and start/resume Store Owner onboarding from Profile.
- [ ] Store cannot receive order requests before required setup is complete.
- [ ] Seller documents are private and inaccessible through public URLs.
- [ ] Platform can approve, reject, suspend, restrict, or request more information.
- [ ] Seller agreement and prohibited-items acceptance are versioned.
- [ ] Existing paid orders remain resolvable if store later becomes restricted.
- [ ] `DOC-13` is updated.

---

## Blockers

- Phase 1 must be complete.

---

## Decisions Made During Implementation

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Do not implement payment-gated selling until verification and entitlement checks are stable.
