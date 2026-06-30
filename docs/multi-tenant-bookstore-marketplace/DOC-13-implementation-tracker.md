# DOC-13: Implementation Tracker

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Live implementation tracker
**Depends On:** DOC-12 and all phase trackers in `implementation/`
**Purpose:** Track live implementation progress, blockers, deviations, and handoff state without turning source specifications into status logs.

---

## 1. Tracking Rules

This file is the master status board. It should stay concise.

Detailed implementation notes belong in the relevant phase tracker under [`implementation/`](./implementation/).

Every coding session must update tracking before ending if it changes any of the following:

- phase status
- current milestone
- blockers
- risk level
- completed migrations/services/screens/tests
- RLS/security verification
- source-spec deviations
- next recommended task
- handoff notes

If implementation changes product or architecture behavior, update the relevant source spec and record the reason in this tracker.

---

## 2. Current Status

> 2026-06-30 refresh: Phase 1 foundation remains applied in live Supabase. Phase 2A Store Owner gate/auth/security hardening is implemented locally and its write-boundary hardening migration is applied live. Phase 2B has controlled store application/document writes through the `store-application` Edge Function, app service wrappers, onboarding UI, metadata persistence, pilot locality validation, sanitized DB errors, and private document upload tests. Phase 2C platform review/setup entitlements is implemented locally and deployed: review metadata migration is live, `store-review` is deployed with JWT verification enabled, and Store Owner setup/status screens exist. Phase 2B authenticated live smoke passed; Phase 2C unauthenticated live smoke returned `401`; authenticated platform-review smoke is pending platform-operator test credentials. Phase 3 manual inventory/canonical/listing projection migration is applied live through Supabase MCP and schema/RLS verified. A 2026-06-29 Supabase MCP smoke confirmed the inventory trigger projects a publishable row into `marketplace_book_listings`, then cleaned up the disposable smoke inventory/listing and restored the store fixture. Anonymous public-read smoke is still blocked by the public listing RLS policy calling `marketplace_sec` helper functions that `anon` cannot execute. Phase 4 Store Owner Console is locally complete: dashboard, owner inventory management, storefront/profile settings, subscription/quota visibility, compliance blockers, route tabs, and focused tests are implemented with TypeScript and web export passing.

| Field | Value |
|---|---|
| Current phase | Phase 5: Consumer Discovery - **ready to plan after Phase 4 local completion; Phase 3 anonymous public-read RLS remediation remains a backend blocker for public marketplace reads** |
| Overall status | `in_progress` |
| Last updated | 2026-06-30 |
| Latest handoff | Phase 2A implemented: live migration `20260627181341 marketplace_phase2_onboarding_hardening` removed broad owner update policies from privileged onboarding tables; app-side Store Owner gate, route group skeleton, Login/OTP/setup intent preservation, and Profile entry are in place. Phase 2B adds `store-application` Edge Function actions for start/resume, save draft, submit, and document metadata recording; app service wrappers; Store Owner onboarding UI; private `seller-verification-docs` upload tests; metadata migration `20260628000001_marketplace_phase2b_application_metadata.sql` applied live as `20260628090815 marketplace_phase2b_application_metadata`; actor-scoped owner lookup; pilot locality validation; and sanitized DB errors. Edge Function `store-application` deployed live as version 1 (`476d1f47-6ab6-40e6-865e-e3f0820c3749`) with `verify_jwt=true`; authenticated live smoke passed with test user `test@example.com`, including start/resume, save draft, submit, blocked-locality denial, private document metadata, metadata verification, and cross-tenant denial. Phase 2C adds platform-role review auth, `store-review` approve/reject/request_more_info/suspend/restrict actions, founding-trial entitlement assignment, and Store Owner status/setup checklist screens. Live migration `20260628102752 marketplace_phase2c_review_metadata` is applied and SQL-verified with review columns present. Edge Function `store-review` deployed live as version 1 (`f2dc3f22-f613-444b-a65d-4ece279f8228`) with `verify_jwt=true`; unauthenticated POST smoke returned `401`; SQL verification confirmed private `seller-verification-docs` and no broad owner update policies in the queried review tables. Authenticated platform-review smoke is pending platform-operator test credentials and was explicitly accepted as pending for Phase 3 start. Phase 3 manual inventory/projection slice adds migration `20260628000003_marketplace_phase3_inventory_canonical_listings.sql`, `storeInventoryService`, `StoreInventoryScreen`, `/(store-owner)/inventory`, focused tests for canonical/inventory/listing RLS contracts plus public/private data boundaries, validated owner publish/pause/edit service methods, condition-aware manual entry, read-time public RLS store-gate checks, and grouped public book results by canonical edition/ISBN. Live migration applied through Supabase MCP as `20260628181842 marketplace_phase3_inventory_canonical_listings` on project `ahntbtktjjmvfosgkmgn`; remote checks confirmed all six Phase 3 tables have RLS enabled and the listing projection trigger is enabled. A 2026-06-29 smoke reused store `68b0c1c9-7f70-4388-bd87-298df3a2ded4`, temporarily moved it to active/approved/setup-complete/selling-allowed, inserted inventory `74690587-c532-4f2c-928f-436bed5602cd`, verified projected listing `9badc801-29ae-4dad-97a8-9e2f7b008026`, then deleted the inventory/listing rows and restored the store to pending verification/incomplete/not allowed. Anonymous `anon` public-read smoke failed with `permission denied for function is_store_admin`; local remediation migration `20260629000001_marketplace_phase3_public_listing_anon_helper_grants.sql` is prepared and tested but not live-applied because the approval reviewer rejected broadening anonymous execute on private SECURITY DEFINER helpers without explicit approval. Phase 4 Store Owner Console is locally complete with route tabs for dashboard/inventory/storefront/subscription, `storeDashboardService`, `storeProfileService`, `storeSubscriptionService`, editable storefront/profile settings, subscription/quota visibility, compliance blocker display, richer inventory controls, and strengthened focused tests. Verification on 2026-06-30: `npm.cmd test -- --runInBand "src/features/stores"` passed 13 suites/110 tests; Store Owner route tests passed 6 suites/7 tests via `--runTestsByPath`; `npx.cmd tsc --noEmit --pretty false` passed; `npm.cmd run export:web` passed after filesystem approval for Expo/Node access. |
| Current risk level | Medium — foundation is applied and audited. Remaining risks are payment provider, delivery provider, and legal/accounting reviews required before Phase 7 payment work. |
| Next recommended task | Resolve the Phase 3 anonymous public listing RLS issue, then plan Phase 5 consumer discovery on top of `marketplace_book_listings`. Either explicitly approve the prepared helper-grant migration or implement a narrower policy split that avoids `anon` calling owner/operator helpers. Phase 2C authenticated platform-review smoke remains pending until an explicitly approved platform-role test user is provided. |

---

## 3. Phase Summary

| Phase | Status | Tracker | Notes |
|---|---|---|---|
| Phase 0: Codebase and DB Audit | `needs_review` | [PHASE-0](./implementation/PHASE-0-codebase-db-audit.md) | Audit complete; review before Phase 1. |
| Phase 1: Foundation Schema and Security | `needs_review` | [PHASE-1](./implementation/PHASE-1-foundation-schema-security.md) | Foundation migrations applied and post-deployment audit passed. Follow-up index fix applied. Ready for Phase 2 planning. |
| Phase 2: Store Onboarding and Verification | `needs_review` | [PHASE-2](./implementation/PHASE-2-store-onboarding-verification.md) | Phase 2A implemented locally and hardening migration applied live; Phase 2B service/UI/metadata slice is implemented, deployed, and authenticated-smoke-verified; Phase 2C review/setup entitlement slice is implemented and deployed. Authenticated platform-review smoke remains. |
| Phase 3: Inventory, Canonical Books, and Listings | `in_progress` | [PHASE-3](./implementation/PHASE-3-inventory-canonical-listings.md) | Manual inventory/projection slice implemented, tested, exported, and live-applied; trigger projection smoke passed and cleaned up; anonymous public-read RLS remediation remains. |
| Phase 4: Store Owner Console | `locally_complete` | [PHASE-4](./implementation/PHASE-4-store-owner-console.md) | Dashboard, inventory console, storefront/profile settings, subscription/quota view, compliance blockers, route tabs, tests, TypeScript, and web export complete locally. No live Supabase/RLS smoke was run for Phase 4. |
| Phase 5: Consumer Discovery | `not_started` | [PHASE-5](./implementation/PHASE-5-consumer-discovery.md) | Marketplace search and public listing surface. |
| Phase 6: Order Request and Confirmation | `not_started` | [PHASE-6](./implementation/PHASE-6-order-request-confirmation.md) | Unpaid request before payment. |
| Phase 7: Payment, Ledger, and Settlement | `not_started` | [PHASE-7](./implementation/PHASE-7-payment-ledger-settlement.md) | Requires legal/accounting/payment review before production. |
| Phase 8: Pickup Fulfillment | `not_started` | [PHASE-8](./implementation/PHASE-8-pickup-fulfillment.md) | Pickup before third-party delivery. |
| Phase 9: Image-to-LLM Inventory | `not_started` | [PHASE-9](./implementation/PHASE-9-image-to-llm-inventory.md) | Depends on stable inventory/listing model. |
| Phase 10: Third-Party Delivery | `not_started` | [PHASE-10](./implementation/PHASE-10-third-party-delivery.md) | Provider adapter for Shiprocket/Shipmozo/NimbusPost-style aggregators. |
| Phase 11: Notifications and Realtime | `not_started` | [PHASE-11](./implementation/PHASE-11-notifications-realtime.md) | Events, push/in-app, selected realtime. |
| Phase 12: Demand, Bookclubs, and Places | `not_started` | [PHASE-12](./implementation/PHASE-12-demand-bookclubs-places.md) | Growth layer after commerce loop. |

---

## 4. Global Blockers

- Payment provider not selected.
- Delivery provider not selected.
- Legal/accounting review pending before production payments.
- India marketplace compliance review pending before production payments.
- DOC-14 commerce state-machine review pending before feature coding beyond Phase 0/Phase 1 foundation.
- DOC-15 finance/tax/settlement review pending before payment work.
- DOC-16 Bangalore pilot/unit-economics review pending before pilot launch planning.
- Existing Supabase security advisor issues must be remediated separately or explicitly isolated before marketplace production launch.

---

## 5. Global Decisions Made During Implementation

- 2026-06-19: Architecture Remediation Plan executed (v0.2 sweep).
  - Money fields standardized to integer `_minor` (paise) across DOC-2, DOC-3, DOC-4, DOC-5, DOC-6, DOC-7, DOC-8, DOC-9, DOC-15, README, and PHASE-1 plan.
  - Canonical table names applied: `finance_ledger_entries`, `settlement_batches`, `seller_payout_accounts`, `marketplace_audit_logs`, `marketplace_localities`, `commerce_idempotency_keys`, `marketplace_notifications`.
  - DOC-4 and DOC-15 bumped to v0.2.
  - Commerce state machines refined with `awaiting_clarification`, `awaiting_customer_decision`, and two-tier soft/firm inventory holds.
  - `marketplace_localities` promoted to Phase 1; `stores.locality` converted to `locality_id` FK.
  - `commerce_idempotency_keys` promoted to Phase 1.
  - `settlement_batches` reserved TCS/GST tax fields (`tcs_deduction_minor`, `gst_on_commission_minor`, `tax_adjustments_minor`, `tax_treatment_version`).
  - `marketplace_notifications` projection added; raw `marketplace_events` client SELECT removed.
  - Security helper standardized on `marketplace_sec.is_store_admin(store_id)`; SEC-16 added to acceptance criteria.
  - DPDP section updated to name LLM vendor as data processor with image egress/residency rules.

- 2026-06-19: v0.2 sweep consistency gap-fill (DOC-12, DOC-16).
  - Post-push audit identified three remediation plan targets that were marked `[x]` but not yet edited: DOC-12 §7 (SM-02: `acceptance_window` policy), DOC-12 §12 (SEC-01: cross-tenant denial test requirement / SEC-16), and DOC-16 §2 + §5 (P1-02: `marketplace_localities.is_pilot_enabled` enforcement).
  - DOC-10 (SEC-02 target) confirmed to not exist as a standalone file; the `marketplace_events` raw-read removal was correctly applied to DOC-1 §7 and DOC-14 §13 instead. No action needed.
  - All three live edits applied; remediation plan task list now accurately reflects actual document coverage.

- 2026-06-19: Phase 1 foundation migrations applied to live Supabase project.
  - Four split migrations applied in order via Supabase MCP: schema (A), helpers (B), RLS (C), storage (D).
  - Post-deployment audit run across all 5 high-risk areas: financial column types, security helper definitions, trigger projection sync, CHECK constraints, and storage path isolation.
  - **Audit finding (SEC-04):** `marketplace_notifications` was missing FK indexes on `user_id` and `store_id` — columns evaluated in the `notifications select own` RLS USING clause. Fixed immediately via follow-up migration `marketplace_notifications_fk_indexes`.
  - All other checks passed: 27 tables present, all monetary columns `INTEGER`, all state machine CHECK constraints match v0.2 spec, all `marketplace_sec` functions are SECURITY DEFINER with blank `search_path`, trigger live-tested with full projection/retraction/locality-name cycle, all storage policies use `foldername[1]` path isolation with `store_administrators` join, `marketplace_events` has no client SELECT policy.

---

## 6. Source Spec Deviations

None yet.

When adding a deviation, include:

- date
- phase
- source spec affected
- original plan
- implemented behavior
- reason
- whether source spec was updated

---

## 7. Latest Completed Milestones

Implementation milestones completed:

- Phase 0 audit completed and recorded in [PHASE-0](./implementation/PHASE-0-codebase-db-audit.md).
- Phase 1 foundation schema/security implementation plan created: [PHASE-1 plan](./implementation/PHASE-1-foundation-schema-security-plan.md).
- Current app routes/auth/Profile integration points audited for future Store Owner entry.
- Current P2P exchange boundary audited; P2P `listings`, `transactions`, credit tables, and transaction RPCs are confirmed as forbidden reuse for bookstore commerce.
- Live Supabase schema, RLS/policies, storage buckets, Edge Functions, realtime publication state, and advisor findings audited.
- Confirmed no marketplace/store/seller/inventory/order/payment/ledger/settlement/shipment schema exists yet.
- Phase 1 foundation migrations (split A–D + follow-up index fix) applied to live Supabase project and verified by comprehensive post-deployment audit (2026-06-19). All v0.2 standards confirmed in live DB.

Documentation milestones completed:

- Source specs `DOC-0` through `DOC-16` created.
- v0.2 architecture remediation sweep completed: `ARCHITECTURE-REMEDIATION-PLAN.md` tasks applied across DOC-1, DOC-2, DOC-4, DOC-6, DOC-12, DOC-14, DOC-15, DOC-16, README, and PHASE-1 plan; foundation migration aligned with remediation plan. Post-sweep consistency audit confirmed DOC-12 (SM-02 §7, SEC-01 §12) and DOC-16 (P1-02 §2/§5) gap-filled.
- India marketplace, payment, delivery, compliance, and operations guardrails added.
- Tracking scaffolds created.
- Store Owner entry rule implemented and documented: Login / first-run auth for new users, Profile section for existing signed-in users, both routed through the Store Owner gate.
- Phase 2B store application slice implemented, deployed, and authenticated-smoke-verified: controlled Edge Function actions, app service wrappers, onboarding UI, application metadata persistence, pilot locality validation, sanitized DB errors, private verification document upload tests, and cross-tenant denial.
- Phase 2C platform review/setup entitlement slice implemented and deployed: `store-review` Edge Function, `platform_user_roles` auth helper, review metadata migration, founding-trial subscription/entitlement assignment on approval, and Store Owner status/setup checklist screens. Approval moves stores to `approved_pending_setup`, sets verification approved, and keeps setup incomplete plus selling not allowed.
- Phase 4 Store Owner Console locally completed: dashboard, inventory management, storefront/profile settings, subscription/quota visibility, compliance blockers, Store Owner tab routes, and focused service/screen/route tests. Local verification passed `src/features/stores` Jest, Store Owner route Jest, TypeScript, and web export.
- Expert review findings incorporated: platform support/disputes are core ops, founding-store trial model added, Bangalore locality pilot added, seller-of-record decision added, post-payment unavailable flow clarified, minors/school users marked out of pilot scope.
- DOC-14 Commerce State Machines created.
- DOC-15 Finance, Tax, and Settlement Operating Model created.
- DOC-16 Pilot and Unit Economics created.

---

## 8. Next Recommended Task

**Resolve Phase 3 public-read remediation, then start Phase 5 consumer discovery planning.**

The Phase 1 foundation is applied, audited, and fully v0.2 compliant. The following tables are live and ready for feature implementation:

- `stores`, `store_administrators`, `store_status_history` — store creation and admin assignment
- `store_verification_requests`, `store_verification_documents` — verification submission and review
- `seller_payout_accounts` — payout account metadata collection
- `seller-verification-docs` bucket - document upload with path-scoped store isolation
- `marketplace_sec.is_store_admin()` — canonical RLS helper for all store-scoped policies

Next work:
1. Resolve Phase 3 public listing anonymous-read RLS: either explicitly approve live application of `20260629000001_marketplace_phase3_public_listing_anon_helper_grants.sql` or implement a narrower policy split that avoids `anon` calling owner/operator helper functions.
2. Rerun Phase 3 smoke end to end: approved/setup-complete/selling-allowed disposable store, one inventory row, trigger projection, anonymous public read, then cleanup.
3. Plan Phase 5 consumer discovery against public projections only: `marketplace_book_listings` and public store/profile fields, never raw `store_inventory` or P2P `listings`.
4. Run authenticated `store-review` live smoke with a platform-role test user (`platform_admin` or `store_reviewer`) when explicitly approved credentials are available.
5. Review or clean up Phase 2B/2C live smoke fixture rows if desired before production pilot.
6. Keep payment-gated selling, orders, fulfillment, delivery, and Phase 7 commerce out of Phase 5 scope.
