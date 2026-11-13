# DOC-13: Implementation Tracker

Phase 9 current state: see [implementation/ACTIVE.md](./implementation/ACTIVE.md).

Historical Phase 9 handoffs: [archive](./implementation/history/DOC-13-phase9-history-to-2026-10-29.md).

## 1. Tracking Rules
This file is the master status board. It should stay concise.
Detailed implementation notes belong in the relevant phase tracker under [`implementation/`](./implementation/).
Every new session must start from repository `AGENTS.md`, [`implementation/ACTIVE.md`](./implementation/ACTIVE.md), this tracker, and the active phase session-start/tracker. Chat history and old root kickstart documents are not status authority.
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
Every material session must rewrite the active work unit and one exact next authorized action in `implementation/ACTIVE.md`, record verification/external mutations in its detailed log, and run the active continuity validator. When the active phase changes, update DOC-13, `implementation/ACTIVE.md`, both README handoffs, the outgoing/incoming phase trackers, and the current pointer in repository `AGENTS.md` together.

If implementation changes product or architecture behavior, update the relevant source spec and record the reason in this tracker.
---
## 2. Current Status


| Field | Value |
| --- | --- |
| Current phase | Phase 9: Image-to-LLM Inventory |
| Current work and next authorized action | See [ACTIVE.md](./implementation/ACTIVE.md). |

---

## 3. Phase Summary

| Phase | Status | Tracker | Notes |
|---|---|---|---|
| Phase 0: Codebase and DB Audit | `needs_review` | [PHASE-0](./implementation/PHASE-0-codebase-db-audit.md) | Audit complete; review before Phase 1. |
| Phase 1: Foundation Schema and Security | `needs_review` | [PHASE-1](./implementation/PHASE-1-foundation-schema-security.md) | Foundation migrations applied and post-deployment audit passed. Follow-up index fix applied. Ready for Phase 2 planning. |
| Phase 2: Store Onboarding and Verification | `needs_review` | [PHASE-2](./implementation/PHASE-2-store-onboarding-verification.md) | Phase 2A implemented locally and hardening migration applied live; Phase 2B service/UI/metadata slice is implemented, deployed, and authenticated-smoke-verified; Phase 2C review/setup entitlement slice is implemented and deployed. Authenticated platform-review smoke remains. |
| Phase 3: Inventory, Canonical Books, and Listings | `in_progress` | [PHASE-3](./implementation/PHASE-3-inventory-canonical-listings.md) | Manual inventory/projection slice implemented, tested, exported, and live-applied; trigger projection and anonymous/authenticated public-read smoke passed and cleaned up. Remaining phase status should be reconciled separately against its tracker. |
| Phase 4: Store Owner Console | `locally_complete` | [PHASE-4](./implementation/PHASE-4-store-owner-console.md) | Dashboard, inventory console, storefront/profile settings, subscription/quota view, compliance blockers, route tabs, tests, TypeScript, and web export complete locally. Security hardening and `store-profile` are deployed; positive authenticated owner-write smoke remains credential-gated. |
| Phase 5: Consumer Discovery | `complete` | [PHASE-5](./implementation/PHASE-5-consumer-discovery.md) | Implementation, live projection-based RLS correction, anonymous/authenticated discovery, canonical offer comparison, disabled-locality exclusion, private-access denials, constrained demand RPC, regression tests, TypeScript, and zero-residue cleanup all pass. Accepted 2026-07-15. |
| Phase 6: Order Request and Confirmation | `complete_e2e_deferred` | [PHASE-6 tracker](./implementation/PHASE-6-order-request-confirmation.md) · [verification/traceability](./implementation/PHASE-6-verification-and-traceability.md) · [corrected monolithic SDD](./implementation/PHASE-6-order-request-confirmation-SDD.md) · [immutable v0.1 archive](./implementation/archive/PHASE-6-order-request-confirmation-SDD-v0.1-original-monolith.md) | M01-M39 and persisted behavior through `payment_ready` are verified in development. Scheduler v5/worker v3 and cron job 5 are active. Comprehensive browser E2E and real timed commerce-command E2E are explicitly deferred, not silently passed. |
| Phase 7: Payment, Ledger, and Settlement | `deferred` | [PHASE-7](./implementation/PHASE-7-payment-ledger-settlement.md) | Deferred 2026-07-18; resume only through separate authorization and DOC-15/payment/legal/accounting gates. **Resumed 2026-11-13** as a second lane beside Phase 9 (D-126): documentation pass, stage 0, then the sandbox pilot slices P0 to P7 under D-33; live money stays gated by BC-43. See the [handoff](./implementation/PHASE-7-8-HANDOFF.md) and [ACTIVE.md](./implementation/ACTIVE.md#phase-78-lane). |
| Phase 8: Pickup Fulfillment | `deferred` | [PHASE-8](./implementation/PHASE-8-pickup-fulfillment.md) | Deferred with Phase 7 because it requires verified paid-order creation. **Resumed 2026-11-13** with Phase 7 in the same lane (D-126); see the [handoff](./implementation/PHASE-7-8-HANDOFF.md). |
| Phase 9: Image-to-LLM Inventory | `in_progress` | [current state](./implementation/ACTIVE.md) · [master tracker](./implementation/phase-9-image-inventory/TRACKER.md) | Phase 9 current state: see implementation/ACTIVE.md. |
| Phase 10: Third-Party Delivery | `not_started` | [PHASE-10](./implementation/PHASE-10-third-party-delivery.md) | Pilot: local same-day bike-delivery adapter (D-24); courier scope deferred. Pilot subset brought forward into the Phase 7/8 lane 2026-11-13; see the [handoff](./implementation/PHASE-7-8-HANDOFF.md). |
| Phase 11: Notifications and Realtime | `not_started` | [PHASE-11](./implementation/PHASE-11-notifications-realtime.md) | Events, push/in-app, selected realtime. |
| Phase 12: Demand, Bookclubs, and Places | `not_started` | [PHASE-12](./implementation/PHASE-12-demand-bookclubs-places.md) | Growth layer after commerce loop. |

---

## 4. Global Blockers

- Phase 9 slice 8 package 8a M89..M93 applied 2026-11-02 to dev project `ahntbtktjjmvfosgkmgn` under the Owner's standing permission (live versions M89 `20261101224556`, M90 `20261101224911`, M91 `20261101225107`, M92 `20261101230500` note-only row, M93 `20261101230501` note-only row); ledger ends at `20261101230501`; legacy-explicit-path live smoke passed the same day; `db push` frozen. Later gates are in ACTIVE.md. [Apply evidence](./implementation/phase-9-image-inventory/trackers/39-package8a5-contract-review.md#2026-11-02--ordered-apply-of-m89m93-ledger-note-rows-and-post-apply-verification); current action and authority remain in ACTIVE.md.
- Phase 9 slice 8 is complete on dev (2026-11-09). The 8c fix round (D1-D6; `56b676b` M99, `c64c2fb` worker, `0b00441` app + amended M99) is pushed (`main` `2584f98`), M99 applied (live `20261107192440`), worker deployed (`dep-dbob845g1s2s73en12fg`), re-tested, stuck holds released, drain checks 01/02/05 passed and reviewed clean; the Open Library pilot switch stays Owner-timed. M95-M98 stay applied. Current action, authority, live state, blockers and risks are in ACTIVE.md. Evidence: [tracker 41](./implementation/phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#2026-11-09-fix-round-review-muse-and-slice-8-closeout).
- Phase 9 slice 8 package 8c code is built and committed locally on 2026-11-05 (`26c73bf` M95 null-safe routing and stuck-pending read model; `2ce9615` M96 exhausted metadata job sweep and operator switch scripts); pushed (`e36e6e9`) and M95/M96 applied to the dev project 2026-11-05 (live `20261104213313`, `20261104213343`); the 8c follow-up from the flow-stage review (`65167b4` M97 sweep recovery, `dacffae` M98 pause deferral and Retry-After bound, `4b29935` worker contact User-Agent) is pushed (`9faee42`) and M97/M98 applied to the dev project 2026-11-05 (live `20261105161532`, `20261105161642`), worker not yet redeployed; the Open Library switch runs later at the pilot. Evidence: [tracker 41](./implementation/phase-9-image-inventory/trackers/41-package8c-switch-evidence.md); current action and authority remain in ACTIVE.md.
- Phase 9 slice 8 package 8b is built (`db5434f..02a0f34`), pushed to `main` (`6e0df90`) and deployed to Render (`dep-dblielugekts738gov3g`) on 2026-11-04; the 8b live smoke passed. Migration M94 was applied to the dev project on 2026-11-04 (live version `20261104121322`, Owner-approved, readback verified), satisfying the release order before the deploy. Evidence: [tracker 40](./implementation/phase-9-image-inventory/trackers/40-package8b-worker-evidence.md); current action and authority remain in ACTIVE.md.
- Payment provider not selected.
- Delivery provider not selected.
- Legal/accounting review pending before production payments.
- India marketplace compliance review pending before production payments.
- DOC-14 commerce state-machine review pending before feature coding beyond Phase 0/Phase 1 foundation.
- DOC-15 finance/tax/settlement review pending before payment work.
- DOC-16 Bangalore pilot/unit-economics review pending before pilot launch planning.
- Existing Supabase security advisor issues must be remediated separately or explicitly isolated before marketplace production launch.
- Phase 4 review remediation is deployed; positive authenticated profile/setup smoke remains pending an approved disposable Store Owner credential.
- Phase 9 representative low-end Android Unit 6F validation remains deferred `NOT_RUN`/`UNRESOLVED` debt, not PASS; [owning evidence](./implementation/phase-9-image-inventory/trackers/24-unit6f-readiness-quality-gates-evidence.md). Current Phase 9 risks and gates are listed in [ACTIVE.md](./implementation/ACTIVE.md).

---

## 5. Global Decisions Made During Implementation

- 2026-11-13: Phases 7 and 8 resume as a second active lane beside Phase 9, with the Phase 10 pilot subset brought forward (handoff §3 approvals of 2026-11-07, recorded today under D-33; D-119 to D-126 in the [Phase 7/8 decision register](./implementation/PHASE-7-8-decision-register.md)). Build scope is the sandbox [pilot cut](./implementation/phase-7-8-payments-fulfillment/pilot-cut/00-pilot-cut-overview.md); production and live money stay gated by BC-43. Phase 9 stays the active phase for its own lane.
- 2026-07-18: Phase 6 is complete with comprehensive browser E2E explicitly deferred. Phases 7 and 8 are deferred by product decision, and Phase 9 planning is authorized next. This sequencing decision changes roadmap order only; DOC-14 payment/paid-order/pickup transition guards remain authoritative and no Phase 7/8 behavior may be folded into Phase 9.

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

- 2026-07-18 sequencing deviation: DOC-12 originally placed Phase 7 payment and Phase 8 pickup before Phase 9 image inventory. Product direction defers Phases 7/8 and advances Phase 9 after the completed Phase 6 inventory/hold boundary. DOC-12 and the Phase 7/8/9 trackers were updated; DOC-14 requires no behavioral change.

When adding a deviation, include:

- date
- phase
- source spec affected
- original plan
- implemented behavior
- reason
- whether source spec was updated

---

## 7. Recorded Completed Milestones (historical)

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
- Phase 4 security/workflow review remediation deployed (2026-07-15): controlled profile/setup boundary, approved-store setup workflow, inventory publish/filter/save corrections, trigger-helper EXECUTE hardening, and regression coverage. Function/JWT/grant/401 verification passed; positive owner-write smoke is credential-gated.
- Phase 5 discovery accepted (2026-07-15): projection-based public RLS correction deployed as `20260715174111`; anonymous/authenticated discovery, canonical offer comparison, private-boundary denials, constrained demand capture, locality disablement, and zero-residue cleanup passed.
- Phase 6 corrected monolith approved for local implementation (2026-07-16): the temporary split was intentionally deleted and superseded; the exact v0.1 monolith is archived immutably and the v0.2 monolith carries direct submitted request semantics, separate cart evidence, cross-table invariants, safe projections, entitled-owner gate, no substitutions, support-task versioning, exact scheduler, corrected SLA examples, append-only smoke evidence, lazy abandonment, named shutdown cancellation, and canonical notification fallback. No production or live changes occurred during documentation correction.
- Phase 6 Units 1-10 checkpoint and Units 11-12 source pass (2026-07-16): no P0/P1 contradiction was found; migrations 24-28 add canonical event/audit/inbox enforcement plus transport-independent notification delivery, bounded task claims/leases/retries/dead letters/manual replay, named reminder/expiry commands, and service-only scheduler/worker dispatch. Focused tests pass 182/182 and migration/security contracts 126/126; PostgreSQL execution and cron activation remain gated, and no Phase 7 behavior was added.
- Phase 6 Units 13-14 UI pass (2026-07-16): customer cart/request and Store Owner Orders routes, typed services/hooks, safe versioned projections, explicit replacement, clarification/decision/cancellation, review/outcome/support actions, deep-link refetch, and complete logout/cache cleanup are locally implemented. Focused Units 1-14 tests pass 250/250, migration/security contracts 134/134, TypeScript and production web export pass; migrations 1-30 remain local/unapplied and the PostgreSQL gate remains pending.
- Phase 6 Unit 15 and Unit 16 source gate (2026-07-16): forward migrations 31-33 add service-only reconciliation cases, deterministic stale-task cleanup, PII-safe structured observations, and operational metrics. Red-first Unit 15 passes 24/24; the complete source gate passes 274/274 and migration/security/reconciliation contracts 158/158. TypeScript, web export, Phase 5/notification compatibility, privacy/boundary scans, and diff hygiene pass. The [verification/traceability record](./implementation/PHASE-6-verification-and-traceability.md) gives the source-complete/database-pending matrix and rollout/rollback plan. No local Docker/PostgreSQL daemon exists, so Phase 6 is not locally database-verified.
- Unit 15 final static review caught and fixed invalid transition/task column references before handoff; regression contracts now assert derived request/cart store scope and valid lease-only cleanup columns.
- Phase 6 source/database checkpoint (2026-07-17): development Supabase has M01-M39, including forward-only corrective M34-M39; persisted command/authorization verification reaches `payment_ready`. Initial browser auth/navigation/Marketplace/cart-empty smoke passed with no console errors and controlled development fixtures remain. Scheduler v5/worker v2 and cron job 5 are active; comprehensive browser customer/Owner E2E, responsive/accessibility review, and real timed commerce-command checks remain deferred.
- Phase 6 completion/readback (2026-07-18): Supabase MCP reconfirmed M01-M39, authoritative-table RLS, active scheduler v5/worker v3, successful cron job 5 runs, and zero existing inventory quantity-balance violations. Comprehensive browser E2E remains explicitly deferred. Phases 7/8 are deferred and Phase 9 planning is authorized.
- Phase 9 Unit 7B live closeout (2026-08-14): M42 is live exactly once after
  the generated-author projection defect was confirmed. Owner Edge v7 and the
  publication worker are live/ready; Publish -> Discover -> Pause -> Republish,
  transient retry, stale-intent fencing, and final connected readback passed.
  The development active-listing entitlement is now 10; main integration is
  complete at `53edbddc9c5417b34cb169599e8282b162e183b3`.
- Phase 9 Unit 7C WU1 local completion (2026-08-14): M43 and bounded database
  evidence pass locally, including real PostgreSQL replay/readback. M43 remains
  unapplied; media, client/UI, deployment, and connected proof remain gated.
- Expert review findings incorporated: platform support/disputes are core ops, founding-store trial model added, Bangalore locality pilot added, seller-of-record decision added, post-payment unavailable flow clarified, minors/school users marked out of pilot scope.
- DOC-14 Commerce State Machines created.
- DOC-15 Finance, Tax, and Settlement Operating Model created.
- DOC-16 Pilot and Unit Economics created.

---

## 8. Next Recommended Task

See [ACTIVE.md](./implementation/ACTIVE.md) for the one exact next authorized action and mutation authority.

### 2026-08-05 Unit 4B Gemini configuration/startup evidence

The user authorized a temporary server-only Gemini configuration check. Render
service `phase9-fixture-vision` was deployed from remote `main` commit
`7eaf921efcaefccab4d0189dc26779796f164ed4` as deployment
`dep-d9pdei9t0dsc73ddgbh0`. The final deployment emitted
`service_started` for the vision worker and reached Render `live` status. The
masked `PHASE9_GEMINI_API_KEY` is present alongside Gemini mode,
`gemini-3.5-flash-lite`, and 30-second timeout; the fixture-only variable was
removed. A first env-inconsistent attempt failed at startup and was corrected.

This receipt proves deployment/startup configuration only. No authenticated
`/run`, real Gemini inference, M14 usage/cost receipt, Supabase/Storage/migration
mutation, or product effect occurred. The key value was never read or recorded
by the agent. The next exact action is to revoke the exposed temporary key,
enter a fresh key directly in Render, and separately approve one sanitized-media
provider-call smoke.

### 2026-08-08 controlled Phase 9 metadata proof preflight

The user-authorized live proof verified `Bookconnect_reactexpo`
(`ahntbtktjjmvfosgkmgn`) as `ACTIVE_HEALTHY` and confirmed M32 live exactly once
as `20260808020404 marketplace_phase9_structural_metadata_integration`. Exactly
one minimum `google_books` / `metadata` registry row was configured with adapter
`1.0.0`, enabled/matching/storage allowed, 86,400-second revalidation, and policy
1; public display and image caching remain disabled. The proof stopped before
creating a fresh candidate because `PHASE9_GOOGLE_BOOKS_API_KEY` is missing and
the available local service credential resolves to a different Supabase host.
Metadata jobs, attempts, lookups, cache entries, snapshots, usage reservations,
and physical provider calls remain zero; inventory/listing counts remain 5/5;
metadata and Phase 9 scheduler counts remain zero. No migration was applied by
this session, no provider egress occurred, and Unit 7 remains gated. The exact
next action is to configure both credentials through the approved secret
mechanism and rerun the bounded one-candidate proof.

### 2026-08-08 Phase 0 credential inventory rerun

The mandatory credential gate was re-run before any fresh test data. Source
inspection confirmed Gemini requires `PHASE9_GEMINI_API_KEY`,
`PHASE9_GEMINI_MODEL_ID`, and `PHASE9_GEMINI_TIMEOUT_MS`; Google Books requires
`PHASE9_GOOGLE_BOOKS_API_KEY`, `PHASE9_GOOGLE_BOOKS_TIMEOUT_MS`, and
`PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES`. None are readable by the current
process or defined in the checked-in env files. The process Supabase URL/service
credential target `nxjnoqjxzkipeghhfxee.supabase.co`, not the approved
`ahntbtktjjmvfosgkmgn` project, so it was not used against the target. Exact
project/read-only registry/count verification passed; no worker, upload,
Gemini/Google Books request, candidate, or remote mutation occurred. The exact
next action is to configure the target service URL/key and all source-defined
real-provider variables through the approved secret mechanism, verify without
printing values, and rerun the same bounded proof. Verdict:
`LIVE_METADATA_BLOCKED_MISSING_CREDENTIALS`.
### 2026-08-09 Phase 9 stale-state cleanup and fresh web-upload gate

The authorized development cleanup completed with `0` active/closing Phase 9
sessions and `0` stale pending media/vision jobs. Inventory, listings,
stores/users, canonical data, unrelated data, migrations, deployment, scheduler,
Unit 7, and Git publication were untouched. Immutable audit evidence was
retained. The actual Expo web Owner flow then uploaded the supplied multi-book
image successfully and created one fresh media job. Processing stopped before
media sanitation because the current invoker process lacks the media worker URL
and ingress token; no Gemini or Google Books call occurred. The exact next gate
is process-local authenticated worker invocation configuration, followed by the
fresh media job only.

The existing Render media URL and masked ingress-token configuration were then
located under explicit follow-up authority. They were supplied process-locally
to the existing invoker without printing or persisting the token. The fresh
media job resolved after one attempt and created one open fresh vision job; no
unrelated media job was processed. The next gate is the existing authenticated
vision-worker invocation for this same fresh input.

The same fresh vision job was then invoked twice through the existing Render
vision service. Both claims safely scheduled retry with
`P9_VISION_ANALYZER_UNAVAILABLE`; Gemini was not called and no provider attempt,
usage reservation, candidate, or M32 metadata job exists. Live function
readback proves the media completion function creates the vision job without
the usage reservation required by vision provider registration. The bounded
proof is stopped at this genuine integration failure. The next gate is a
separately authorized forward migration/code correction and focused regression
evidence; the current task did not authorize that change.

The user subsequently authorized systematic local implementation. Forward-only
M33 is now created locally and unapplied. It atomically creates and validates
the required vision reservation before media completion, fails closed and rolls
back on conflicting lineage, and repairs only valid unleased
`open|retry_scheduled` jobs while excluding terminal history. Focused static
tests pass, M33 applies after the full local M32 tail, and combined
ingestion/vision/provider/M33 PGlite passes 61/61. The current fresh job remains
unchanged at attempt `2/5`; the later duplicate open media input remains
untouched. Exact next gate: independent M33 review, followed by separately
authorized exact-project application/readback. No live migration, worker,
provider, Storage, inventory, publication, scheduler, Unit 7, stage, commit,
push, or deployment action occurred.

The independent review returned `APPROVED_WITH_REQUIRED_CORRECTIONS`. The local
correction pass now requires an active session and initiating-Owner media
binding in both the private helper and one-time repair, with direct regressions
for closed-session and wrong-initiator nonterminal history. The shared PGlite
migration sequence now includes M31 before M32, so its full-tail claim is
literal. Red tests failed on both findings before implementation; final M33
static is 3/3, focused static is 39/39, M33 integration is 5/5, combined PGlite
is 61/61, and database foundation/catalog is 17/17. M33 remains unapplied and
the next gate is independent correction-only rereview.
### 2026-08-10 Phase 9 real-image proof completed through Owner review

M34 is live once on verified project `ahntbtktjjmvfosgkmgn`. The preserved
sanitized input completed vision at attempt 5 with
`accepted_with_language_skips`: 8 visible observations, 7 candidates, and one
bounded unknown-language skip. The seven resulting M32 metadata jobs were
claimed once by the local dedicated metadata worker and resolved into the
Owner-safe manual-review path. Google Books authentication was rechecked using
the previously supplied process-only credential and returned HTTP 200; the
false no-match cause was `projection=lite`, which omits required `language`.
Commit `e4f2b34` changes the request to `projection=full`; focused adapter Jest
is 26/26, the metadata-worker build passes, and a live bounded response decoded
8 editions instead of 0. The existing terminal snapshots were not rewritten.
Owner UI proof passed through Profile -> Store Owner Console -> Inventory: the
hub shows 7 needing attention, all seven books render in the review queue, and
candidate detail preserves title/author/language with private review selected.
No review was saved, no inventory/listing/publication mutation occurred, and
Unit 7 remains gated.

### 2026-08-10 Phase 9 single-image safe removal live

The Owner decision now permits one current image per Start/Close session and
retains explicit Remove image before candidate lineage; only successful removal
enables one replacement. Mobile append UI and direct second-upload authorization
are blocked. Local M35 adds the authenticated logical-remove RPC, exact-job
cancellation, hold-aware cleanup scheduling, current-input read filtering, and
server-side issuance/registration guards. Structural Jest is 6/6 and isolated
M01-M35 PGlite behavior is 3/3, including legacy two-capability handling and
atomic rejection with preserved candidate/inventory/listing state. M35 was
applied once as `20260809223135` to verified project `ahntbtktjjmvfosgkmgn`.
The three explicitly targeted legacy inputs were logically removed, all three
exact jobs were cancelled, and zero candidates/inventory/listings changed.
Owner Edge `phase9-owner-ingestion` v3 was separately authorized, deployed,
and read back with all four overlay files matching exactly and JWT verification
enabled. The three private staging objects remain for lifecycle cleanup. One
new input was registered after removal and remains untouched pending a new
explicit decision. No Git stage/commit/push occurred.

## Historical Clubs evidence imported during 2026-10-17 integration

The following records describe their original October checkpoints. The current
Clubs publication state is owned by docs/user/clubs/TRACKER.md. Earlier M62
and publication-blocked wording does not supersede the newer Phase 9 Unit 6G
Open Library records retained above. No migration is reapplied by this merge.

> **2026-10-08 local commit checkpoint:** User-authorized navigation checkpoint 4e1aa35 and primary corrections/applied-migration evidence 542b90f are committed. Remaining review documentation is checkpointed separately. Two P2 navigation findings still block publication; next action is correction, regression/browser verification and independent rereview. No push, deployment or database mutation in this commit step. Earlier test evidence was not rerun.

> **2026-10-08 aggregate Clubs review:** Full unpublished-set GPT-6 Luna max review
> found two return-context integration defects; Clubs publication is blocked until
> corrected and independently rereviewed. See [review](../user/clubs/AGGREGATE-PUBLICATION-REVIEW-20261008.md).
> Phase 9 Unit 6H/M62 rollout status unchanged. No commit/push/deployment/live write.


> **2026-10-08 Clubs migration closeout:** User-authorized forward migration
> `20261008091939 clubs_primary_venue_write_authorization` is applied once through
> Supabase MCP to verified Bookconnect_reactexpo (ahntbtktjjmvfosgkmgn). Exact
> policy/RLS/name preflight and 61/61 local artifact checks passed. Live readback
> confirms five intended policies, unchanged functions/grants/indexes and unchanged
> venue-link/event-location data. Local filename matches live version and content
> hash is unchanged. Ledger now 169 entries; historical repair/db push freeze and
> Phase 9 Unit 6H/M62 rollout pending status are unchanged. No business DML,
> Storage write, runtime deployment, staging, commit or push. Current evidence:
> [Clubs migration closeout](../user/clubs/PRIMARY-VENUE-MIGRATION-REVIEW.md). Next: exact local-diff review for a
> separately authorized scoped commit; do not reapply the migration.


> **2026-10-08 aggregate-review correction:** Clubs owner/archive selection gating,
> lost-response reconciliation and external-removal focus recovery are corrected
> locally. Fresh Manage/service tests 135/135, TypeScript, web export and local
> PostgreSQL policy-proposal checks 61/61 pass. Luna max scoped rereview found no
> actionable residual defect. Read-only live catalog inspection confirmed direct
> primary-write policy bypasses; forward-migration creation/application approval
> is pending. No live writes or Git publication occurred. See the
> [Clubs correction record](../user/clubs/TRACKER.md). Phase 9 Unit 6H and M62 runtime rollout /
> connected proof pending status remain unchanged.


> **2026-10-08 Clubs follow-up:** User-approved venue Remove confirmation and
> real QueryClient race coverage are implemented locally. Desktop/mobile keyboard
> checks passed. Club/account web focus handoff is now corrected locally;
> spoken screen-reader checks are excluded by the user. Connected primary-selection
> proof remains unverified. See [Clubs tracker](../user/clubs/TRACKER.md). Phase 9 M62 rollout status is unchanged.
> No new database mutation, migration, Git publication, or deployment occurred.


> **2026-10-07 bounded cross-feature Clubs UI correction:** The user authorized
> local corrections to Manage Venues pending/recovery feedback and club/account
> response isolation. Scope and verification are owned by
> [the Clubs app review](../user/clubs/PRIMARY-VENUE-APP-REVIEW.md#bounded-ui-correction-2026-10-07).
> No Phase 9 runtime, schema, live data, migration, deployment, or M62 gate
> changed. Desktop/390×844 admin-page visual review and connected selection
> proof remain unrun; shared history and direct-permission boundaries remain.

> **2026-10-07 cross-feature Clubs migration:** Under explicit user
> authorization, the Clubs-only primary-venue migration was applied to
> `ahntbtktjjmvfosgkmgn` as `20261007144356 clubs_admin_primary_venue`; the local
> source filename matches the live version. M62 remains at `20260913162154` and
> Phase 9's `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING` gate is unchanged.
> The shared historical repair set and the pending July Clubs/Exchange migration
> remain untouched; normal production `db push` remains frozen. No Phase 9
> runtime or business rows changed.

## 2026-10-14 - Supplemental local catalogue feasibility probe

Owner authorized a standalone local feasibility pilot from the copied/validated Open Library archives. The new experimental cluster is isolated on E:, with no shared Supabase/Storage/product/schema/migration/rollout mutation. Main Phase9/Unit6G status remains four picker corrections locally complete with SQL proposals retained and publication held. Global release handoff is unchanged; supplemental research next action is completion and measurement of the bounded local pilot, then Owner review of a full-import recommendation. See Phase9 tracker37 §48 for exact scope, actual local mutations and current proof.

## 2026-10-14 - Supplemental catalogue proof completed; release handoff unchanged

Approved supplemental catalogue pilot is complete on an isolated C: loopback PostgreSQL database after an E: interruption; Owner reported their own error and all four E: archive bounded rechecks succeeded. Complete editions/authors streams scanned;51,816factual editions/47,994own authors retained,17/17tests PASS after load/restart. Original seven title+author OCR queries all retrieve candidates,warm CLI medians113–271ms; database~73.09MiB,importer peak206MiB. Full-size/performance not measured; extrapolated relations/index size~64.52GiB plus staging/WAL/temp/reserve, not a guarantee. Main Phase9/Unit6G four-correction local-complete work unit and all SQL/refresh/publication/rollout holds remain unchanged,M65–M74 immutable/M75 deferred. No shared mutation/formal migration/publication/deployment. Detailed actual scope/authority/mutations/proof/limits: tracker37 §49 and C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/REPORT.md. Exact next supplemental action: Owner review of pilot proof/full-build recommendation; full import and product integration require separate direction. Loopback C: pilot remains runnable; no new production architecture adopted.

## 2026-10-14 - Supplemental source-size clarification; release handoff unchanged

Owner-requested read-only storage clarification complete:the four current E:archives expand to92.13GB/85.80GiB; keeping compressed+expanded files takes109.68GB/102.14GiB. E:currently111.63GiBfree with compressed files present; full expansion alone leaves25.83GiB, before an indexed database. Pilot remains51,816editions, seven photographed titles are test queries, other source rows unchanged. Recommend later separately approved direct streaming import to avoid complete raw copies; full database size/performance unmeasured. Cover file has IDs/dimensions/date; actual images are separate. No raw files extracted, database/production/shared/service/Git state changed. Main Phase9/Unit6G four-correction local-complete work unit and all holds unchanged. Detailed measurement/method/authority/proof:tracker37 §50 and C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/EXPANDED-SIZE.md. Exact next supplemental action remains Owner review of full-import scope/storage; no full import authorized/started.

## 2026-10-14 - Supplemental identity/cloud capacity clarification; release handoff unchanged

Supplemental identifier/search/capacity clarification complete. Edition OLID is the pilot primary key; ISBN can repeat across source IDs, cover ID identifies an image, BookConnect internal canonical/inventory IDs are UUIDs verified by fresh exact-project PK/schema SELECT. Current64.52GiBestimate applies only to projected editions/authors/search/indexes; importing full works/descriptions/all four-file fields is unmeasured. Fresh Supabase org Free and DB282.92MB; Free500MBcannot fit full catalogue, cloud quota independent of E:111.63GiBfree. No full import, purchase/plan/account change, source/product/schema/DB/Storage/provider/business/Git/deployment mutation. Main Phase9/Unit6G four corrections locally complete and all holds unchanged. Detail/authority/evidence:tracker37 §51 and C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/IDENTIFIERS-SEARCH-CAPACITY.md. Exact next supplemental action remains Owner review of full-import fields/storage and separate direction.

## 2026-10-14 - Local catalogue scope clarified; filesystem readiness warning recorded

Owner clarified own full PostgreSQL catalogue on E:and later source deletion after validation; cloud hosting is out of scope. Read-only feasibility complete:new fresh E:NTFS Warning/Full Repair Needed plus fsutil Dirty;physical USBdevice reportsHealthy,not a hardware-failure diagnosis. No repair/full import/delete started. Current111.63GiBfree/partial64.52GiBcatalogueestimate does not prove all-fields/index/temp/backupfit or full E:performance. C:sourcecopies present; working bounded pilot unchanged. Supplemental readiness warning must be addressed before long write-heavy build. Exact next supplemental action:Owner review of E:warning and local-only feasibility,then direction on whole-volume diagnostic/repair before full-plan/build. Detail/authority:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/FULL-LOCAL-CATALOGUE-FEASIBILITY.md and tracker37 §52. Main Phase9/Unit6Gfourcorrectionslocalcomplete workunit/releasehandoff and all holds unchanged;M65–M74preserved/M75deferred. No DB/source/storage/service/system/Git/deployment mutation or cloud connector call.

## 2026-10-14 - Supplemental local validation; filesystem repair declined for now

Owner explicitly held filesystem repair after read-only chkdsk E:found NTFSdirectory-index errors/exit3; no repair/delete/heavyE:build. Local validation before later rented-server deployment clarified. Existing ScoopPostgreSQL18.4 used to initialize experimental E:cluster; completed51,816edition/47,994author pilot is onC:,notE:. New read-only uniqueness/join/missingness and12additionaltitle+author retrieval consistency checks PASS; sourceIDhelper5/5RED->GREEN. Full four-file C:archive quality audit running, no complete-source/full-scale search claim. Exact next supplemental authorized action:complete running read-only audit/report; full indexed build needs healthy adequatecapacityvolume, repair remains held. Evidence:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/LOCAL-READINESS.md and tracker37 §53. MainPhase9/Unit6Gworkunit/releasehandoff unchanged, SQL/refresh/Git/rollout holds preserved,M65-M74immutable/M75deferred. No shared/formalmigration/appcode/cloudconnector/Gitpublication/deployment/systemrepair/source deletion; only evidence/continuity files and read-only checks.

## 2026-10-14 - Supplemental original-source validation complete; release handoff unchanged

Supplemental full C: source audit complete:56827250editions/15446415authors/41666337works/14938996cover metadata rows, allgzipEOF/CRC/UTF8 and prior decoded-size readback verified; no JSON parse failures/duplicate validated IDs. Metadata flags explicit:7edition identity mismatches,5700additional projector exclusions,70missing own-author IDs/2321withoutprojectable name,446missingwork IDs,77789coverdimension flags. Every selected positive own cover ID has metadata; image HTTP availability untested. Audit4262s/126.3MiBpeakRSS, no raw expansion saved. Actual51,816edition C:pilot remains separate;12additional title+author retrieval consistency queries pass, full indexed performance/production concurrency/restore unrun. E:repair explicitly held afterread-onlyCHKDSKexit3; no full E:build/delete. Next supplemental authorized action:Owner review of source proof/full-import accounting scope; full indexed build requires healthy adequatecapacityvolume. Evidence:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/LOCAL-READINESS.md and tracker37 §54. MainPhase9/Unit6Gworkunit/releasehandoff and all SQL/refresh/Git/rollout holds unchanged,M65-M74immutable/M75deferred. No appcode/sharedschema/DB/provider/cloudconnector/formalmigration/Gitpublication/deployment/systemrepair/source deletion.

## 2026-10-15 - Full E: catalogue experiment authorized; marketplace release handoff unchanged

Owner now directs proceeding on E: and chose all books with main metadata; later correction says ignore C:. E: pilot restore/restart verified 51,816 editions/47,994 authors and three identical digests, 12 known title+author searches and zero-result negative control. E: filesystem warning remains; repair/deletion held. New isolated full metadata_catalogue cluster on E:/Books/metadata-full-20261015, loopback 55434, SCRAM/owner ACL and normal durability ON. Full import from E: archives is running in 200,000-row atomic batches with 15 GiB reserve. Windows Ctrl-Z COPY failure reproduced, first 200,000 committed author rows/checkpoint preserved, octal escaping corrected RED→GREEN and resumed; 11 unit tests and actual PostgreSQL import/rollback proof PASS. Full ingestion/indexed-size/search/restart completion is pending. Next supplemental action: complete/checkpoint four E: streams, index titles/authors and verify full counts/metadata/sizes/timings. Evidence C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/full-catalogue-20261015/PLAN.md, progress.json, build-resumed.log and tracker 37 §55. Main Phase 9 / Unit 6G four-corrections local-complete/retained-SQL workunit and all SQL/refresh/release/Git holds unchanged. Local E: DDL/data mutation only; no Supabase/Storage/provider/appcode/formal migration/shared mutation/Git publication/deployment; M65–M74 immutable/M75 deferred.

## 2026-10-15 - Supplemental E: catalogue checkpoint paused for read-only I/O diagnosis

E: Full catalogue experiment paused at verified read error. PostgreSQL autovacuum and a read-only targeted row scan failed on authors relation base/16384/16467 block2450. Separate Windows read-only file access failed with EIO; Win32 code23 resolves to "Data error (cyclic redundancy check)". This proves that the block cannot currently be read; it does not diagnose the hardware or all of E:. Import client stopped. E: durable checkpoint: authors 15446415 rows / EOF verified; works 600000 of 41666337; editions/covers/indexes/search not started. Database cannot be reported as a validated searchable full catalogue. No filesystem repair/deletion; prior diagnosis-only repair decision remains. Next safe step: continue read-only E: diagnosis and require a separate explicit Owner direction before any filesystem repair or retrying bulk reads. Proof C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/full-catalogue-20261015/io-probe-results.json and tracker37 §56. Phase9/Unit6G implementation handoff and all existing release/migration/Git holds unchanged; no C: database/source work.

