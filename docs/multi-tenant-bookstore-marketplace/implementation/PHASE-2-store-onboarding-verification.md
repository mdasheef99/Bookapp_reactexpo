# PHASE-2: Store Onboarding and Verification

**Status:** `needs_review`
**Last updated:** 2026-06-28
**Phase goal:** Let a bookstore apply, be reviewed, accepted, restricted, or rejected safely.

---

## Required Reading

- [DOC-1: Identity, Security, and Compliance](../DOC-1-identity-security-compliance.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](../DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-9: Platform Operations and Admin](../DOC-9-platform-ops-admin.md)
- [DOC-12: Build Strategy and Implementation Sequence](../DOC-12-build-strategy-and-implementation-sequence.md)
- [Phase 2 implementation plan index](./PHASE-2-store-onboarding-verification-plan.md)
- [Phase 2A: Store Owner Gate, Auth, and Security](./PHASE-2A-store-owner-gate-auth-security-plan.md)
- [Phase 2B: Store Application and Verification Documents](./PHASE-2B-store-application-documents-plan.md)
- [Phase 2C: Platform Review, Setup, and Entitlements](./PHASE-2C-platform-review-setup-entitlements-plan.md)

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
| Seller application data model | `complete` | Local migration `20260628000001_marketplace_phase2b_application_metadata.sql` adds verification request metadata for owner contact, GST/PAN readiness, support preference, and original application choices. Applied live as `20260628090815 marketplace_phase2b_application_metadata`. Phase 2C adds local migration `20260628000002_marketplace_phase2c_review_metadata.sql` for review reasons/follow-up metadata; applied live as `20260628102752 marketplace_phase2c_review_metadata`. |
| Store Owner onboarding entry points | `complete` | Phase 2A added Login Store Owner intent, OTP/setup intent preservation, Profile entry, and Store Owner route gate. |
| Seller application UI/API | `complete` | Phase 2B slice adds service-role Edge Function actions for start/resume, save draft, and submit, plus app service wrappers and onboarding screen. Pre-deploy hardening fixes start/resume contract, server-owned start flow, pilot locality validation, actor-scoped owner lookup, metadata persistence, and sanitized DB errors. Edge Function `store-application` deployed live as version 1 with JWT verification enabled; authenticated smoke passed. |
| Verification document upload | `complete` | Phase 2B slice uploads storefront evidence to private `seller-verification-docs` paths and records metadata through the Edge Function. Edge Function deployed; authenticated document metadata smoke passed. |
| Seller agreement acceptance | `complete` | Onboarding submit requires versioned seller agreement acceptance before calling the submit action. |
| Prohibited/counterfeit/pirated-book policy acceptance | `complete` | Onboarding submit requires prohibited-items and support-policy acknowledgement before calling the submit action. |
| Platform review controls | `complete` | `store-review` Edge Function supports approve, reject, request more info, suspend, and restrict. It derives actor identity from Supabase Auth and requires server-side `platform_user_roles` (`platform_admin` or `store_reviewer`). Deployed live as version 1 with `verify_jwt=true`. |
| Entitlement/trial assignment | `complete` | Approval creates a founding trial subscription when absent and upserts starter entitlement rows. Approval keeps `stores.setup_status = incomplete` and `stores.selling_status = not_allowed`. |
| Store setup checklist | `complete` | Store Owner status/setup screens show review state, blocked states, checklist items, payout/subscription status, and clear non-sellable setup messaging. No inventory, orders, fulfillment, payments, or delivery were added. |
| Tests | `complete` | Phase 2A/2B focused regression tests pass. Phase 2C adds static Edge Function security tests, migration metadata tests, setup checklist screen tests, TypeScript, and web export verification. Live unauthenticated `store-review` smoke returned `401`; authenticated platform-review smoke remains pending because platform-operator test credentials were not provided. |

---

## Verification Log

- 2026-06-24: Supabase MCP refresh confirmed Phase 1 foundation tables, RLS, status constraints, and private `seller-verification-docs` bucket are live. Phase 2 app/API implementation has not started.
- 2026-06-27: Phase 2 implementation plan created and split into 2A, 2B, and 2C. It identifies an implementation-critical write-boundary issue: current Phase 1 owner update policies must be hardened before exposing onboarding writes, because RLS cannot restrict privileged columns such as store status through generic PostgREST updates.
- 2026-06-27: Phase 2A implementation started. Supabase MCP confirmed project `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`) and applied live migration `20260627181341 marketplace_phase2_onboarding_hardening`, replacing broad owner update policies on `stores`, `store_verification_requests`, and `store_verification_documents` with platform/reviewer update policies. Store Owner gate service/hook/routes and Login/OTP/setup/Profile entry routing were added. Advisor still reports unrelated existing issues including `public.spatial_ref_sys` RLS disabled; not remediated in Phase 2A.
- 2026-06-28: Phase 2B local implementation started. Added `store-application` Edge Function with Supabase Auth-derived caller identity, service-role server writes, owner/admin membership checks, privileged field rejection, versioned policy acceptance, and private `seller-verification-docs` metadata recording. Added app service wrappers and a Store Owner onboarding screen. Focused Jest verification passed for Edge Function static security, client service wrappers, onboarding policy gates, and private document upload. The Edge Function has not been deployed or live-tested.
- 2026-06-28: Phase 2B pre-deploy hardening applied locally. Added local metadata migration `20260628000001_marketplace_phase2b_application_metadata.sql`; fixed `startOrResumeApplication` to return `{ storeId, requestId }`; changed the gate start button to invoke `start_or_resume` before onboarding; scoped existing-owner lookup to the authenticated actor; added pilot locality validation; persisted owner/support/PAN/GST metadata on `store_verification_requests.application_metadata`; and replaced raw Supabase error response leaks with sanitized errors. Focused Phase 2B Jest suite and TypeScript pass.
- 2026-06-28: Supabase MCP applied live migration `20260628090815 marketplace_phase2b_application_metadata`, adding `store_verification_requests.application_metadata JSONB NOT NULL DEFAULT '{}'::jsonb`. Supabase MCP deployed Edge Function `store-application` version 1 (`476d1f47-6ab6-40e6-865e-e3f0820c3749`) with `verify_jwt=true`; deployed package includes `index.ts` and `_shared/marketplaceAuth.ts`. Unauthenticated live POST smoke returned `401`. Authenticated start/save/submit/document/cross-tenant smoke was initially pending until test credentials were provided later in the session.
- 2026-06-28: Added repeatable authenticated smoke harness `npm run smoke:phase2b:store-application`. Required env: `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `PHASE2B_TEST_USER_EMAIL`, `PHASE2B_TEST_USER_PASSWORD`; optional env: `EXPO_PUBLIC_SUPABASE_URL` (defaults to production project), `PHASE2B_PILOT_LOCALITY_ID`, `PHASE2B_BLOCKED_LOCALITY_ID`, and `PHASE2B_CROSS_TENANT_STORE_ID`. The script signs in as the test user and exercises start/resume, save draft, optional locality denial, optional cross-tenant denial, document metadata recording, submit, and submitted metadata verification without service-role credentials.
- 2026-06-28: Authenticated live smoke completed with test user `test@example.com`. The smoke passed sign-in, start/resume, save draft with pilot locality, blocked-locality denial, cross-tenant denial, document metadata recording, submit, submitted metadata verification, and event/audit presence. Live smoke records created: store `68b0c1c9-7f70-4388-bd87-298df3a2ded4`, request `2621ed8e-5f52-46df-a13c-ebf262408ffa`, pilot locality `a97802ee-8722-42a5-8de6-581fa88ee304`, blocked locality `c8619c5e-c25f-4d5b-b86a-9e0a980ed6b5`, and cross-tenant fixture store `e1e53028-dd58-4f2e-a6f4-9b47068a2397`.
- 2026-06-28: Phase 2C implemented locally and deployed. Added `requirePlatformRole` in `supabase/functions/_shared/marketplaceAuth.ts`; added `store-review` Edge Function for approve/reject/request_more_info/suspend/restrict; added review metadata migration `20260628000002_marketplace_phase2c_review_metadata.sql`; added Store Owner review status and setup checklist screens. Supabase MCP applied live migration `20260628102752 marketplace_phase2c_review_metadata` and deployed Edge Function `store-review` version 1 (`f2dc3f22-f613-444b-a65d-4ece279f8228`) with `verify_jwt=true`. Unauthenticated live POST smoke returned `401`.
- 2026-06-28: Phase 2C verification passed locally: `npm test -- --runInBand src/features/stores "app/(store-owner)" ... supabase/functions/__tests__/store_review_function.test.ts ... marketplacePhase2CReviewMetadata.test.ts` ran 9 suites / 33 tests; auth/profile route tests run by absolute path passed 5 suites / 16 tests; `npx.cmd tsc --noEmit` passed; `npm.cmd run export:web` passed with existing Browserslist/Tailwind at-rule warnings. Supabase SQL verification confirmed marketplace migrations through `20260628102752 marketplace_phase2c_review_metadata`, no broad owner update policies in the queried review tables, private `seller-verification-docs`, and live Phase 2C review columns. Authenticated platform-review smoke was not run because platform-operator test credentials were not provided.

---

## Acceptance Criteria

- [x] Store cannot publish listings before approval.
- [x] New users can discover and start Store Owner onboarding from Login / first-run auth.
- [x] Existing signed-in users can discover and start/resume Store Owner onboarding from Profile.
- [x] Store cannot receive order requests before required setup is complete.
- [x] Seller documents are private and inaccessible through public URLs.
- [x] Platform can approve, reject, suspend, restrict, or request more information.
- [x] Seller agreement and prohibited-items acceptance are versioned.
- [-] Existing paid orders remain resolvable if store later becomes restricted. Deferred until order/payment phases because Phase 2 does not introduce paid orders; Phase 2C restrict/suspend only changes store selling status and does not add order mutation paths.
- [x] `DOC-13` is updated.

---

## Blockers

- Live smoke fixture cleanup/review remains optional before a production pilot: smoke store/request/locality/document/audit rows were intentionally left for traceability.
- Existing Supabase advisor issues, including `public.spatial_ref_sys` RLS disabled, remain separate production-readiness risks and should not be auto-remediated inside Phase 2 onboarding.

---

## Decisions Made During Implementation

- 2026-06-27: Phase 2 implementation must start with RLS/write-boundary hardening for `stores`, `store_verification_requests`, and `store_verification_documents`. Owner application writes should go through whitelisted Edge Function actions; platform review writes should require `platform_user_roles`.
- 2026-06-28: Phase 2B owner application writes remain routed through Edge Function/service paths only; the app does not write privileged store or verification status fields directly.
- 2026-06-28: Application-only owner contact, support preference, PAN/GST readiness, and original UI store type are persisted as verification request metadata rather than privileged store authority fields.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Phase 2A, 2B, and 2C are implemented locally, with Phase 2A/2B/2C migrations applied live and `store-application` plus `store-review` deployed live with JWT verification enabled. Phase 2B authenticated live smoke passed for start/resume, save draft, submit, blocked-locality denial, private document metadata, and cross-tenant denial. Phase 2C local verification passed and unauthenticated live `store-review` smoke returned `401`; authenticated platform-review smoke is still pending because platform-operator test credentials were not provided. Do not implement payment-gated selling, inventory/listings, orders, fulfillment, or delivery until the next phase plan explicitly starts that work.

---

## Next Session Prompt

Use this prompt to finish Phase 2C runtime verification:

```text
We are continuing work on BookConnect Expo at:

C:\Users\user\Documents\augment-projects\Bookconnect_expo

Goal: finish Phase 2C runtime verification only, then prepare Phase 3 handoff.

Before implementing anything, read:

1. CODEBASE_INTELLIGENCE/README.md
2. CODEBASE_INTELLIGENCE/02-auth-session-map.md
3. CODEBASE_INTELLIGENCE/03-supabase-backend-map.md
4. CODEBASE_INTELLIGENCE/05-marketplace-phase-2-readiness.md
5. docs/multi-tenant-bookstore-marketplace/README.md
6. docs/multi-tenant-bookstore-marketplace/DOC-1-identity-security-compliance.md
7. docs/multi-tenant-bookstore-marketplace/DOC-2-store-onboarding-verification-subscriptions.md
8. docs/multi-tenant-bookstore-marketplace/DOC-12-build-strategy-and-implementation-sequence.md
9. docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md
10. docs/multi-tenant-bookstore-marketplace/implementation/PHASE-2-store-onboarding-verification.md
11. docs/multi-tenant-bookstore-marketplace/implementation/PHASE-2-store-onboarding-verification-plan.md
12. docs/multi-tenant-bookstore-marketplace/implementation/PHASE-2A-store-owner-gate-auth-security-plan.md
13. docs/multi-tenant-bookstore-marketplace/implementation/PHASE-2B-store-application-documents-plan.md
11. docs/multi-tenant-bookstore-marketplace/implementation/PHASE-2C-platform-review-setup-entitlements-plan.md

Use Supabase MCP and verify the connected project before any live action:

- Project name: Bookconnect_reactexpo
- Project ref/id: ahntbtktjjmvfosgkmgn
- Region: ap-southeast-2
- DB host: db.ahntbtktjjmvfosgkmgn.supabase.co

Known live state:

- Phase 1 marketplace foundation is applied.
- Phase 2A hardening migration is applied live as `20260627181341 marketplace_phase2_onboarding_hardening`.
- Phase 2B metadata migration is applied live as `20260628090815 marketplace_phase2b_application_metadata`.
- Phase 2C review metadata migration is applied live as `20260628102752 marketplace_phase2c_review_metadata`.
- Edge Function `store-application` is deployed live as version 1 with `verify_jwt=true`.
- Edge Function `store-review` is deployed live as version 1 (`f2dc3f22-f613-444b-a65d-4ece279f8228`) with `verify_jwt=true`.
- Phase 2B authenticated live smoke passed with test user `test@example.com`.
- Phase 2C unauthenticated live smoke returned `401`.
- Phase 2C authenticated platform-review smoke has not run because platform-operator test credentials were not provided.
- Smoke fixtures intentionally left for traceability:
  - store `68b0c1c9-7f70-4388-bd87-298df3a2ded4`
  - request `2621ed8e-5f52-46df-a13c-ebf262408ffa`
  - pilot locality `a97802ee-8722-42a5-8de6-581fa88ee304`
  - blocked locality `c8619c5e-c25f-4d5b-b86a-9e0a980ed6b5`
  - cross-tenant fixture store `e1e53028-dd58-4f2e-a6f4-9b47068a2397`
- Private seller document bucket is `seller-verification-docs`.
- Marketplace tables exist with RLS enabled.
- Supabase advisor previously reported `public.spatial_ref_sys` has RLS disabled; do not fix this inside Phase 2C unless explicitly approved.

Scope:

- Run authenticated `store-review` smoke with a `platform_admin` or `store_reviewer` test user.
- Verify approve/reject/request_more_info/suspend/restrict against disposable fixtures.
- Confirm approval keeps `setup_status = incomplete` and `selling_status = not_allowed`.
- Confirm review actions create `platform_admin_actions`, `store_status_history`, `marketplace_events`, and `marketplace_audit_logs`.
- Do not implement Phase 3 inventory/listings.
- Do not implement payments, orders, fulfillment, delivery, or Phase 7 commerce.
- Do not reuse P2P listings, transactions, borrower/lender states, or credit assumptions for bookstore commerce.

After changes:

- Update Phase 2 tracker and DOC-13 with smoke results.
- Move to Phase 3 planning only if authenticated Phase 2C smoke is accepted.
- Run any affected focused tests and `npx.cmd tsc --noEmit` if code changes.
- Check `.pyc` count remains 0.
```
