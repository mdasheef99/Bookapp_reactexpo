# DOC-13: Implementation Tracker

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.3
**Date:** 2026-07-27
**Status:** Live implementation tracker
**Depends On:** DOC-12 and all phase trackers in `implementation/`
**Purpose:** Track live implementation progress, blockers, deviations, and handoff state without turning source specifications into status logs.

---

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

Every material session must also leave one exact active work unit and next authorized action in the active phase tracker, record verification/external mutations in its detailed log, and run the active continuity validator. When the active phase changes, update DOC-13, `implementation/ACTIVE.md`, both README handoffs, the outgoing/incoming phase trackers, and the current pointer in repository `AGENTS.md` together.

If implementation changes product or architecture behavior, update the relevant source spec and record the reason in this tracker.

---

## 2. Current Status

> 2026-06-30 refresh: Phase 1 foundation remains applied in live Supabase. Phase 2A Store Owner gate/auth/security hardening is implemented locally and its write-boundary hardening migration is applied live. Phase 2B has controlled store application/document writes through the `store-application` Edge Function, app service wrappers, onboarding UI, metadata persistence, pilot locality validation, sanitized DB errors, and private document upload tests. Phase 2C platform review/setup entitlements is implemented locally and deployed: review metadata migration is live, `store-review` is deployed with JWT verification enabled, and Store Owner setup/status screens exist. Phase 2B authenticated live smoke passed; Phase 2C unauthenticated live smoke returned `401`; authenticated platform-review smoke is pending platform-operator test credentials. Phase 3 manual inventory/canonical/listing projection migration is applied live through Supabase MCP and schema/RLS verified. A 2026-06-29 Supabase MCP smoke confirmed the inventory trigger projects a publishable row into `marketplace_book_listings`, then cleaned up the disposable smoke inventory/listing and restored the store fixture. Anonymous public-read smoke is still blocked by the public listing RLS policy calling `marketplace_sec` helper functions that `anon` cannot execute. Phase 4 Store Owner Console is locally complete: dashboard, owner inventory management, storefront/profile settings, subscription/quota visibility, compliance blockers, route tabs, and focused tests are implemented with TypeScript and web export passing.

> 2026-07-15 review refresh: Git is synchronized by content with the recently merged `origin/main`. Supabase MCP and `.env` both identify project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`). Phase 4 remediation adds the controlled `store-profile` function, approved-store setup completion, stricter checklist readiness, inventory workflow fixes, and migration `20260715000001_marketplace_phase4_security_hardening.sql`. Store tests pass 13 suites/118 tests; TypeScript and production web export pass. The migration is live as `20260715115929 marketplace_phase4_security_hardening`; grants verify `anon=false`, `authenticated=false`, `service_role=true`. `store-profile` version 1 is ACTIVE with `verify_jwt=true`; unauthenticated live smoke returned `401`. Positive authenticated owner-write smoke awaits an approved disposable credential.

> 2026-07-15 Phase 5 review refresh: Consumer discovery is locally complete after red-test remediation. Public-only services now include runtime validation, safe filter construction, explicit paging/retry, store-name discovery, and book availability detail. Migrations `20260715155047 marketplace_phase3_public_listing_policy_split` and `20260715155103 marketplace_phase5_discovery_hardening` are live and read-only verification confirms the anonymous/authenticated policy split, pilot-locality eligibility, private inventory/analytics boundary, constrained boolean demand RPC, rate limiting, and 90-day retention. Relevant Jest 8 suites/54 tests, TypeScript, production web export, and `git diff --check` pass. No fixture or RPC smoke write was performed; positive discovery smoke remains fixture-gated.

> 2026-07-15 Phase 5 acceptance refresh: The authorized positive smoke exposed private-`stores` RLS evaluation returning zero public rows. Red-first migration `20260715000003_marketplace_phase5_public_policy_projection_fix.sql` now evaluates public eligibility through `public_store_profiles` plus the pilot locality and is live as `20260715174111 marketplace_phase5_public_policy_projection_fix`. Anonymous/authenticated title, author, ISBN, store, profile, book-detail, canonical grouping, offer comparison, private-boundary, demand-RPC, disabled-locality, and cleanup checks all pass. Targeted Jest passed 8 suites/52 tests and TypeScript passed. Phase 5 is complete and accepted; Phase 6 was not started.

> 2026-07-16 Phase 6 monolith correction: the exact v0.1 pasted monolith is preserved in the implementation archive and the corrected v0.2 monolith is the sole normative Phase 6 SDD. The intentionally deleted three-document split must not be restored. The corrected design includes direct request creation plus separate cart transition evidence, entitled-Owner availability before submission, cross-table enforcement, safe projections, no substitutions, independent support-task versioning, exact pg_cron/Edge worker architecture, deterministic tariff, fixed ISO-date SLA examples, append-only smoke evidence, lazy abandonment, named shutdown cancellation, and canonical commerce inbox behavior. Local implementation is authorized only after the Stage 4 documentation validation verdict; remote/live changes remain separately gated.

> 2026-07-17 Phase 6 checkpoint refresh: Phase 5 remains complete. Phase 6 Units 1-15 are source-complete, migrations M01-M39 were applied to the development Supabase project, and persisted command/authorization behavior was verified through provider-independent `payment_ready`. M34-M39 are forward-only corrective migrations added after the initial M01-M33 apply. The prior complete repository checkpoint passed 908/908 tests, TypeScript, and production web export. Initial browser authentication/navigation/Marketplace/cart-empty smoke passed without console errors and controlled `phase6_browser_*` development fixtures remain available. The development scheduler rollout is active: scheduler v5 uses custom-secret authentication, worker v2 keeps strict service-role authorization, and scheduler dispatch explicitly forwards its server-side service-role bearer token. Cron job 5 runs each minute; the first scheduled empty-queue run and tagged synthetic dispatch/retry/dead-letter paths passed, with focused regression 4/4. Comprehensive customer/Store Owner browser E2E, browser-created persisted-effect verification, full responsive/accessibility review, and real timed commerce-command verification remain deferred. This is not a production-readiness declaration; Phase 7 is not started.

> 2026-07-18 Phase 6 completion and roadmap decision: Supabase MCP readback reconfirmed the healthy `Bookconnect_reactexpo` development project, all M01-M39 Phase 6 migrations, RLS on authoritative Phase 6 tables, active scheduler v5/worker v3, and successful one-minute cron job 5 executions. Existing inventory has zero quantity-balance violations; the equality constraint remains `NOT VALID` and must be validated by a forward migration before production. Phase 6 is recorded as complete with comprehensive browser E2E, responsive/accessibility review, browser-created persisted-effect review, and real timed commerce-command E2E deliberately deferred. Phases 7 and 8 are deferred by product decision. Phase 9 planning is now the active milestone and must remain independent of payment, paid-order, pickup, ledger, refund, and settlement behavior.

> 2026-07-19 Phase 9 planning refresh: the complete Phase 9 planning set was drafted under `implementation/phase-9-image-inventory/` with a master SDD, six domain SDDs, data dictionary, live database/storage current-vs-target audit, requirements traceability, complexity register, and three-level local tracker split. Supabase was re-verified read-only as project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`); `store_id` is canonical (37 public-schema columns, zero `tenant_id`). Phase 9 begins with camera/gallery same-language spine stacks capped at 15, provider/model adapters, mandatory owner review, advisory duplicates without image comparison, multilingual search aliases, separate damage/media, bookstore-first discovery, and mandatory customer-requested current-copy photos. Repository `AGENTS.md`, `implementation/ACTIVE.md`, Phase 9 `SESSION-START.md`, tracker markers, update matrix, and a read-only continuity validator now provide deterministic new-session resume/closeout. The user approved this planning baseline on 2026-07-19 and authorized the Work Unit 0 plan only. No Phase 9 migration, code, function, bucket/policy, or data mutation occurred.

> 2026-07-19 Phase 9 Work Unit 0 checkpoint: the [contracts/threat/migration-design plan](./implementation/phase-9-image-inventory/work-units/00-contracts-threat-migration-plan.md) is complete and pending user review. It defines versioned internal adapter contracts, recorded fixtures, deterministic and cross-tenant security tests, a six-step expand/backfill/validate/switch migration sequence, forward-correction rules, and explicit pre-migration gates. A fresh exact-project read-only Supabase audit confirmed the baseline facts and pre-existing security backlog. No product code, migration file, provider call, bucket/policy, or Supabase/storage mutation occurred.

> 2026-07-19 Phase 9 WU0 approval refresh: the user accepted the `approved_with_required_corrections` review and authorized documentation correction/commit only. The approved WU0 now separates automated alias proposals from bounded official/verified aliases; excludes private request photos from duplicate identity; locks initiator-only pilot session authority and terminal-input Close; preserves private inventory on publication failure; requires central validation/error/provider/query/grant registers; strengthens privilege/security gates; clarifies the `NOT VALID` quantity gate; and uses eight logical migration groups. WU0A contract/test implementation, migration-file creation/application, provider calls, storage changes, and product code remain unauthorized.

> 2026-07-19 Phase 9 WU0A checkpoint: the user explicitly authorized the bounded server contract/test foundation. Versioned vision, metadata, alias, and marketplace contracts; strict fail-closed parsers; ISBN/BCP 47/fallback/session/duplicate/quantity/publication helpers; central validation/error/provider-reuse/grant/query registers; sanitized synthetic fixtures; and future red implementation gates now exist under the shared server boundary. Focused Jest passed 4 suites/24 tests, all Edge Function test files passed 9 suites/36 tests, and strict standalone TypeScript passed. No migration, callable endpoint, database/storage/provider/network operation, mobile/product write, deployment, or Supabase mutation occurred. WU0A is complete; no later unit is authorized.

> 2026-07-19 Phase 9 WU0A independent approval: an authorized independent review classified every working-tree file and found correctable contract/test gaps, with no unrelated or sensitive change. Corrections centralized limits, required configured HTTPS cover hosts, completed server-owned adapter envelopes and session/publication semantics, strengthened grant/query/privacy registers, and expanded adversarial/no-match/alias fixtures. Final focused Jest passed 4 suites/41 tests, all Edge Function tests passed 9 suites/53 tests, and strict standalone TypeScript passed. WU0A is approved complete. Migration creation/application, callable endpoints, providers, storage, UI/product writes, and external mutations remain unauthorized. WU0B backend/API technical design is next eligible but requires separate authorization.

> 2026-07-19 Phase 9 WU0B definition checkpoint: a planning-only WU0B document now defines the future command/query/DTO inventories, actor and authorization matrix, state/transaction/idempotency boundaries, worker/provider/marketplace/privacy design requirements, red-test mapping, acceptance/non-goal criteria, exact later file-allowlist requirement, and separately ordered review/audit/migration gates. The repository startup chain is normalized as `AGENTS.md` → `ACTIVE.md` → DOC-13 → Phase 9 `SESSION-START.md` → Phase 9 `TRACKER.md`. The definition is not independently reviewed and grants no WU0B implementation authority. No runtime, test, migration, Supabase/Storage, provider, dependency, GitHub, or other external mutation occurred.

> 2026-07-20 Phase 9 WU0B definition-review correction: the independent review returned `approved_with_required_corrections`. The documentation-only correction now routes ACTIVE.md to WU0B, separates scan/public-copy/request-photo upload authority, adds post-commit inventory command coverage, makes listing matching service-internal and public pagination store-grouped, separates implementation completion from independent approval, and hardens the continuity validator against stale ordering and contradictory authority text. Independent re-review remains required. WU0B implementation, runtime endpoints, migrations, Supabase/Storage, providers, UI, and external mutations remain unauthorized.

> 2026-07-20 Phase 9 WU0B definition independent approval: the complete corrected documentation/validator diff was re-reviewed. A missing intermediate definition-approved marker was added so approval cannot be confused with implementation authority. Final verdict is `approved`. The next eligible action is separate authorization for bounded WU0B technical-design implementation only; runtime endpoints, migrations, Supabase/Storage, providers, UI, and Phase 7/8 behavior remain unauthorized.

> 2026-07-20 Phase 9 WU0B technical-design completion: the authorized documentation-only implementation now provides seven bounded artifacts covering 26 commands, 11 queries, DTO/error/rate contracts, authorization/tenancy/privacy, state/transaction/idempotency/publication, jobs/providers/media/lifecycle, marketplace/request-photo seams, red tests, audit questions, and exact proposed later file paths. The authority document routes the artifact set and the validator enforces completeness, size and gate integrity. WU0B is `implementation_complete_needs_review`, not independently approved. No Supabase query/mutation, migration, runtime/test/config/dependency/generated change, provider call, Storage/UI change, deployment, push or merge occurred during this work unit.

> 2026-07-20 Phase 9 WU0B semantic-review correction: an independent review returned `rejected_needs_redesign` on four bounded design gaps. Author corrections now require Owner quantity/price/terms confirmation and an atomic soft hold before request-photo acceptance; use Master SDD §6 as the sole persisted session/input/candidate vocabulary; assign primary boundaries, SDD/WU0A traces, red tests and future units to C01–C30/Q01–Q11; and give every red test exact source ownership and implementation responsibility. WU0B remains `implementation_complete_needs_review` pending a fresh focused reviewer. No Supabase audit or later gate has started.

> 2026-07-20 Phase 9 WU0B focused re-review correction: the focused verdict was `approved_with_required_corrections` because three persisted-state claims still conflicted with their owning SDDs and the validator checked only positive markers. The bounded correction now uses request-photo `none`; records `skipped_false_detection` as a review disposition without inventing a candidate state; maps hold status to `active|released|converted_to_sale` while expiry releases a hold; and makes all three contradictory forms validator failures. WU0B remains `implementation_complete_needs_review` pending a new context-isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B final-review correction: the next isolated verdict was `approved_with_required_corrections` on two narrow ambiguities. C12 and Q11 now select one `AE` authenticated actor-dispatch boundary that rejects mixed/unknown credentials and selects closed Owner/worker or customer/Owner authorization and projection branches. The validator now scans every WU0B artifact for closed state claims and semantic variants rather than three literal phrases; photo, candidate-disposition and hold-expiry wording-variant negative probes pass. WU0B remains `implementation_complete_needs_review` pending a final context-isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B implementation-ownership/semantic-closure correction: a further isolated review showed C12 lacked one exact future boundary file and the validator missed workflow/lifecycle/terminal/persisted-as/transition/arrow wording. C12 is now owned only by the proposed `image-inventory-publication-retry` endpoint, with Owner and worker entrypoints forbidden from duplicating it; Q11 remains request-photo-boundary-owned. Closed state parsing and eleven negative probes cover the reported variants while preserving valid photo expiry versus hold release. WU0B remains `implementation_complete_needs_review` pending another isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B direct-claim closure correction: repeated isolated fuzz review confirmed C12/Q11 ownership but expanded the semantic surface to direct/hyphenated persisted claims, direct state/status/workflow/lifecycle assignments including `=`/`:`, generic terminal, becomes/advances/transitions, `from ... to|into|arrow ...`, possessive declarations, and label/parenthesized arrows. A normalized domain-aware parser now validates a generated 105-case five-domain/twenty-one-form matrix plus two special disposition/photo probes, alongside two C12 ownership/duplication probes. WU0B remains `implementation_complete_needs_review` pending another isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B final independent approval: the final context-isolated review returned exact verdict `approved`. The existing continuity evidence passes 107 semantic cases plus two C12 ownership/duplication probes, and the bounded set remains documentation/validator-only. WU0B is `independently_approved`. The next action is a consolidated Risk-Based Phase 9 SDD analysis in a new session; Supabase audit, migrations, runtime implementation and merge to `main` remain unauthorized.

> 2026-07-22 Phase 9 bounded contract correction: the authorized correction aligned canonical alias vocabulary and lifecycle-only supersession, separated zero-price private save from positive-price publication, removed `committed_publication_failed` from persisted state vocabularies, completed exact C01–C30/Q01–Q11 stable-error mappings and metadata, excluded interactive support takeover/cross-store private access, and added the missing contract/design verification rows while preserving later runtime/release gates. Focused WU0A Jest passed 4 suites/45 tests; TypeScript, continuity/link/size checks, 107 semantic cases, two C12 probes, and `git diff --check` passed. A fresh correction-only review returned exact verdict `approved`. No Supabase access, migration, provider/storage action, runtime implementation, or deployment occurred.

> 2026-07-22 Phase 9 Package 1 audit checkpoint: user-authorized exact-project read-only Supabase audit verified project `ahntbtktjjmvfosgkmgn`, live history through Phase 6 M39, canonical `store_id` tenancy, catalogue/inventory/listing/quantity/condition/provider compatibility, RLS/grants/functions/triggers, Storage, reusable Phase 6 infrastructure, and advisor findings. Two bounded artifacts now record current evidence, the gap matrix, exact proposed schema/RLS/function/index/storage changes, eight migration groups, failing security tests, and genuine blockers. No migration/runtime file was created and no database, Storage, provider, deployment, or external mutation occurred. Package 1 is `audit_complete_needs_review`; migration tests, file creation, and live application remain separately gated.

> 2026-07-22 Phase 9 Package 1 review correction: the six required findings are corrected documentation-only. The design now gives an executable legacy-condition compatibility sequence; persisted purpose/path/entity-bound single-use capabilities for C02/C03, C15/C16 and C20/C21; named-only private access with separate worker/service grants; unique cost reservations on `(store_id, job_id, cost_kind, policy_version)`; exact deferred-FK addition groups; and eight additive Phase 9 groups plus separately reviewed/authorized M09 quantity validation with preflight. Package 1 is `corrections_complete_needs_review`; no Supabase re-query/mutation or migration/runtime file occurred.

> 2026-07-22 Phase 9 Package 1 independent approval: the correction-only reviewer returned exact verdict `approved` and verified all six findings, the 107 existing semantic negative cases, both C12 probes, and unchanged WU0A/WU0B validation strength. Package 1 is `independently_approved`. Failing tests, migration-file creation, M09/live application and runtime remain separately unauthorized. No reviewer edit or Supabase query/mutation occurred.

> 2026-07-22 Phase 9 Package 1 M01-M08 implementation checkpoint: the initial contract suite failed 17/17 with the files absent; M01-M08 now pass 12/12 focused static contracts, 19/19 isolated database/security checks, 26 migration suites/206 tests, and 9 Edge Function suites/57 tests. TypeScript, continuity, and whitespace checks pass. A focused independent database/security review and correction-only follow-ups returned exact verdict `approved`. M09 was not created or validated. No migration was applied to connected Supabase and no Storage, function deployment, provider, UI, or runtime mutation occurred. Status is `package1_m01_m08_independently_approved_not_applied`.

> 2026-07-22 Phase 9 Package 1 live application: repository preparation fast-forwarded and pushed `main` at `69edd90`, then created `phase9-db-live-application`. Exact-project preflight on `ahntbtktjjmvfosgkmgn` was clean. M01-M05 applied and were readback-verified. M06 failed atomically with PostgreSQL `42501 must be owner of table objects` because `storage.objects` is owned by `supabase_storage_admin`; it has no history row and left no bucket/policy residue. M07-M08 were not attempted. M09 was not created/applied. Auth hardening/runtime work was untouched and is deferred to a separate session/branch before private-ingestion mobile integration.

> 2026-07-22 Phase 9 Package 1 live continuation: live readback proved `storage.objects` RLS was already enabled. Correction commit `e07efa1` removed only the redundant owner-only RLS statement from unapplied M06, added policy-preservation contracts, passed focused/full validation, and received independent correction-only approval. M06-M08 then applied once as `20260722095443`, `20260722095545`, and `20260722095729`. Verification stopped because M08's broad public-function grant loop revoked anonymous execution from the three M07 discovery RPCs. M01-M08 remain live and immutable; a separately reviewed forward grant correction is required. M09, auth, providers, mobile, and runtime remain untouched.

> 2026-07-22 Phase 9 Package 1 live verification accepted: red-first forward migration M10 restored `anon` execution to exactly the three public discovery RPCs, made the 24-field projection `security_invoker=true`, and removed all direct client/service view grants without exposing underlying tables. Focused contracts passed 3/3, isolated database/security 20/20, migration regressions 27 suites/209 tests, Edge/security 9 suites/57 tests, TypeScript, continuity, and whitespace checks; independent correction-only review was `approved`. Commit `31253ad` was pushed before M10 applied once as `20260722125256 marketplace_phase9_public_boundary_security_correction`. Live readback proves zero other anonymous Phase 9 RPCs, authenticated-only request-photo RPCs, service-only helpers, zero private client table grants, and removal of the Phase 9 `security_definer_view` advisor error. M09 remains absent and the quantity CHECK remains `NOT VALID`; auth/providers/mobile/runtime remain untouched.

> 2026-07-22 auth hardening checkpoint: approved Work Units 1 and 2 are locally complete and the correction-only final review returned `APPROVED` on `codex/auth-hardening-core`. Production bypass requires development runtime, development app environment, and explicit opt-in; preview/production opt-in is rejected. Zustand owns canonical session/status and one root bootstrap owns guarded restoration. Current-device logout now persists a non-secret deletion-intent marker, retries only the exact Supabase token key after SDK failure, and blocks restart restoration until removal succeeds. Identity replacement remains hidden through cleanup failure and an explicit root retry. Focused verification passed 11 suites/84 tests, isolated TypeScript, and diff hygiene; the reviewer independently passed 7 suites/52 tests. Secure persistence, Android backup, authoritative profile completion, OTP UX, native/offline verification, remote EAS verification, M09, and Phase 9 runtime remain separately gated. No database, Supabase, Storage, migration, deployment, or external mutation occurred.

> 2026-07-23 Phase 9 ingestion-runtime dedicated-worker closeout: the accepted database checkpoint remains `package1_m01_m08_m10_live_verified`. Local M11 and runtime now enforce initiating-Owner/server-path intake, immutable canonical completion replay, content-hashed service-only source snapshots, opaque token-and-attempt lease fencing, retry-safe partial completion, 10 MiB/16 MP and multi-frame rejection, private sanitized linking, and exactly one vision job. ImageMagick WASM sanitation remains outside Edge in a dedicated service-authenticated claimed worker; its 64 MP internal working allowance does not change the 16 MP source ceiling. Focused Jest passed 9 suites/74 tests, Phase 9 PGlite passed 26/26, and both TypeScript checks passed. Three local 8/12/16 MP runs each passed WebP correctness, metadata removal, and stable hashes; median times were 11.77/11.40/14.27 s and ending RSS 169/191/225 MB. A read-only independent review of the current unstaged candidate found one stale M06 Storage-documentation contradiction; after correction, re-review found no remaining merge blocker. This is sizing evidence only. Nothing was applied, deployed, staged, committed, pushed, or merged.

> 2026-07-26 Phase 9 Unit 4 SDD-readiness checkpoint: the ingestion foundation is now accepted as committed on `main` at `0a8e57a`; M11 remains unapplied and both ingestion services remain undeployed. Exact-project read-only Supabase verification reconfirmed M01-M08/M10 as the live tail, worker-ID-fenced generic jobs, private extraction-table grants, no M11/vision RPCs, incomplete immutable candidate provenance, and no deployed ingestion/vision function. The focused Unit 4 design finalizes `p9-vision-v2`, deterministic count/language/repeated-position rules, token/attempt state transitions, one authoritative evidence/candidate/completion transaction, exact replay after response loss, minimum forward M12, stable errors, privacy allowlists, and 31 red-first cases. No code, test, migration file, provider call, Supabase/Storage mutation, deployment, stage, commit, or push occurred.

> 2026-07-26 Phase 9 Unit 4 local implementation checkpoint: the accepted design is implemented with strict `p9-vision-v2`, deterministic `FixtureSpineImageAnalyzer`, platform-owned count/language/repeated-position policy, a dedicated service-authenticated worker, and forward-only local M12 `20260726000012_marketplace_phase9_vision_analysis_runtime.sql`. M12 adds immutable image/observation evidence, candidate provenance/publisher clues, vision-specific attempt/token-fenced claim/context/persist/fail RPCs, exact completion replay, service-only grants, and no inventory/publication/metadata effect. Verification passed 16 Phase 9 Jest suites/108 tests, Phase 9 PGlite 39/39, repository TypeScript, and strict vision-worker TypeScript. M11/M12 remain unapplied, all services remain undeployed, and no provider, Supabase/Storage, stage, commit, push, or merge action occurred.

> 2026-07-26 Phase 9 Unit 4 first-review correction checkpoint: the independent review returned `CHANGES_REQUIRED`. Corrections now require exact authoritative current-claim validation before any job mutation, use existing `resolved` for stale-safe job-only reconciliation of invalid/missing input/session/media relationships, clear leases, and persist/return only bounded safe results. M12 now owns canonical UTF-8 byte counting, SHA-256, and recursive result validation; worker transport uses exact typed safe-code mapping. Verification passed 16 Phase 9 Jest suites/116 tests, Phase 9 PGlite 52/52, repository TypeScript, strict vision-worker TypeScript, continuity, and diff hygiene. Correction-only independent re-review is next. M11/M12 remain unapplied, services undeployed, and no provider, Supabase/Storage, stage, commit, push, or merge action occurred.

> 2026-07-26 Phase 9 Unit 4 final correction checkpoint: the last bounded review identified database retryability ownership, catch-all RPC behavior, absolute/UNC path validation, and executable boundary coverage. PostgreSQL now derives retryability from a closed safe-code catalogue; rejected RPC promises and unknown permanent domain failures have separate bounded classifications; TypeScript/SQL reject path-shaped evidence without rejecting slash prose; and PGlite covers every authoritative RPC plus exact 262,143/262,145-byte canonical boundaries. Final verification passed 16 Phase 9 Jest suites/132 tests, Phase 9 PGlite 57/57, repository TypeScript, strict vision-worker TypeScript, continuity, and diff hygiene. Final Git integration of this exact candidate is authorized; M11/M12 remain unapplied, all services remain undeployed, and no provider, metadata, inventory/publication, Supabase, or Storage operation occurred.

> 2026-07-26 Phase 9 deployment-runtime scaffolding checkpoint: Unit 4 is integrated on `main` at `e9ba2d9`. Local Work Unit 4A adds provider-neutral executable Node services for sanitation and fixture vision, strict positive-allowlist environment loading, distinct-secret fingerprint checks, non-mutating health/readiness, one-request concurrency, bounded bodies, graceful shutdown, safe structured logging, dynamically request-bound allowlisted fixtures, a sanitized manual invoker, deterministic builds/containers, deployment validation, and JWT-enabled local Owner Edge configuration. Explicit Phase 9 Jest passed 17 suites/150 tests, PGlite passed 57/57, repository TypeScript, both strict worker builds, and the deployment validator passed. M11/M12 remain unapplied, all services remain undeployed, fixture evidence is retained by policy, and no Supabase/Storage, secret, provider, staging, commit, push, or merge operation occurred. Independent review is next.

> 2026-07-26 Phase 9 M11/M12 live-application checkpoint: exact project `ahntbtktjjmvfosgkmgn` was healthy and the clean repository baseline was `cc98901`. M11 applied once as `20260726182238`; M12 applied once after it as `20260726182539`. Live readback verified the ingestion columns/constraints/indexes, immutable analysis tables and triggers, candidate lineage, reconciliation constraints, and service-only hardened RPCs. Inventory/listings/events stayed 5/5/14, quantity violations stayed zero, both private buckets stayed unchanged with zero objects, and no service, secret, or provider was deployed/configured/called. M12's first truncated MCP transport submission failed atomically with no history row or partial object before the unchanged SQL was resubmitted losslessly. Security advisors ended at 174 (`INFO 48/WARN 125/ERROR 1`), with the only M12 delta being two expected service-only RLS/no-policy INFO notices.

> 2026-07-27 Phase 9 M11/M12 closeout checkpoint: the eight-file documentation-only ledger/live-state/handoff/evidence update was committed and fast-forwarded to `main` as `4abeef89ecebdb7a74a8ece3a1bdc0d5cfe6c8c5`; local and remote refs matched and the worktree was clean. Final read-only Supabase confirmation found the exact project healthy, M11/M12 still present exactly once at their recorded versions, and no Phase 9 ingestion/vision Edge Function. No deployment, secret configuration, Storage-object operation, provider call, or further Supabase mutation occurred.

> 2026-07-27 Phase 9 fixture-pipeline deployment checkpoint: the JWT-verified Owner Edge Function and separate free-plan `phase9-media-sanitation` / `phase9-fixture-vision` Render services are live. M13 is live once as `20260727025046` with 13 minimum postgres-owned, empty-`search_path` `SECURITY INVOKER` wrappers; existing `service_role` grants proved sufficient and the private schema remains unexposed. Both Render services are live at `96991a99a8e24146db709653ebc287b8c2404430`, auto deploy is off, and health/readiness/auth/log-privacy checks pass. Deployed `one_book` plus eight fresh-process fixture cases passed normal claim/fencing/persistence/failure paths with `batchSize: 1`; commerce stayed 5 inventory/5 listings/5 published. No real provider, metadata, UI, inventory, publication, scheduling, autoscaling, or Library work occurred. [Detailed evidence](./implementation/phase-9-image-inventory/trackers/06-fixture-pipeline-deployment-evidence.md).

> 2026-07-27 Phase 9 provider/scale SDD reconciliation: the documentation-only reconciliation now defines replaceable provider-neutral metadata contracts, exactly one primary and zero or one secondary, bounded sequential fallback, coherent single-source selection, cache/query/attempt/cost/capability/quality lineage, manual degradation, horizontally safe workers, graceful shutdown, capacity admission, fairness, independent stage scaling, and a fixed-multi-replica gate before autoscaling. Real Gemini design is a separately gated prospective Unit 4B; Unit 5 remains Metadata/aliases. Status is `needs_independent_review`. No runtime, migration, provider, Supabase/Storage, Render, deployment, scheduling, or autoscaling mutation occurred.

> 2026-07-27 Phase 9 provider/scale F1–F3 correction: the bounded documentation correction preserves the required provider-neutral primary/optional-secondary seam while deferring secondary selection and activation, distinguishes media/vision/metadata capacity signals, disables raw provider/model payload persistence by default with separately approved diagnostic capture deleted within seven days, and excludes credentials from mobile, Git, documentation, build arguments, logs, telemetry, errors, and model context. Status remains `needs_independent_review`; no runtime, migration, provider, database, Storage, deployment, scheduling, or autoscaling mutation occurred.

> 2026-07-27 Phase 9 Unit 4B checkpoint: the founder authorized the local Gemini
> adapter and narrowly superseded the initial primary vision model ID from
> `gemini-3.5-flash` to configuration-driven `gemini-3.5-flash-lite`; the earlier
> decision remains historical. The adapter is locally implemented behind
> `SpineImageAnalyzer` with strict schema normalization, bounded usage/cost
> evidence, safe error classes, and server-only credential boundaries. No live
> provider call, credential configuration, migration, database/Storage mutation,
> deployment, scheduling, autoscaling, metadata, UI, inventory, or publication
> change occurred. One independent Unit 4B review is next.

> 2026-07-27 Phase 9 Unit 4B persistence correction: the two confirmed review
> blockers are corrected locally. Forward-only M14 adds dedicated service-only
> provider-attempt lineage and bounded register/finalize/associate/mark RPCs;
> Gemini now receives a private media handle only after atomic final claim and
> complete store/session/input/media validation. Focused mocked/PGlite evidence
> covers durable usage/injected cost, duplicates, accepted/stale/unknown outcomes,
> and zero download/provider calls after rejection. M14 was not applied and no
> provider, credential, Storage, deployment, metadata, UI, or commerce mutation
> occurred. One correction-only independent review is next.
>
> 2026-07-27 Phase 9 Unit 4B final correction: the egress fence now performs
> complete claim/media validation immediately before private download and again
> immediately before Gemini invocation. Logical spend identity is stable across
> claim retries and separate from unique provider-attempt identity. TypeScript and
> M14 apply the same bounded semantic pricing allowlist, and the Phase 9 migration
> test names the exact ordered M01-M08/M10-M14 set. M14 remains unapplied; no live
> provider, credential, database, Storage, deployment, or product mutation occurred.

> 2026-07-26 Phase 9 Unit 4A review-correction checkpoint: the independent review returned `CHANGES_REQUIRED` for unsafe Docker context, pre-authentication slot starvation/read deadlines, nondeterministic shutdown evidence, source-string-only deployment claims, and identity-only fixture tests. All five corrections plus bounded invoker responses are locally focused-green. A deny-by-default Docker context, pre-admission constant-time authentication, fixed body deadline, deterministic shutdown test, real compiled-entrypoint smoke, per-fixture semantic matrix, synthetic-only container script, and minimal-permission pull-request workflow now exist. The mandatory GitHub Actions image build/start gate is next; no live credential, image push, deployment, migration, provider, Supabase, or Storage operation is authorized.

| Field | Value |
|---|---|
| Current phase | Phase 9: Image-to-LLM Inventory - **Unit 4B persistence correction locally complete; independent review pending** |
| Overall status | `in_progress` |
| Last updated | 2026-07-27 |
| Latest handoff | Unit 4B correction and local unapplied M14 are ready for correction-only review; fixture pipeline remains live-verified at `96991a9`. |
| Current risk level | M14 is local/unapplied and Unit 4B has mocked evidence only; live provider configuration/calls and product integration remain separately gated. |
| Next recommended task | One correction-only independent review of Unit 4B; Unit 5 Metadata/aliases and M14 application remain separately gated. |

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
| Phase 7: Payment, Ledger, and Settlement | `deferred` | [PHASE-7](./implementation/PHASE-7-payment-ledger-settlement.md) | Deferred 2026-07-18; resume only through separate authorization and DOC-15/payment/legal/accounting gates. |
| Phase 8: Pickup Fulfillment | `deferred` | [PHASE-8](./implementation/PHASE-8-pickup-fulfillment.md) | Deferred with Phase 7 because it requires verified paid-order creation. |
| Phase 9: Image-to-LLM Inventory | `unit4b_persistence_correction_needs_independent_review` | [Unit 4B handoff](./implementation/phase-9-image-inventory/work-units/04b-gemini-vision-adapter-handoff.md) · [deployment evidence](./implementation/phase-9-image-inventory/trackers/06-fixture-pipeline-deployment-evidence.md) | Gemini correction and M14 local-only; M01-M08/M10-M13 remain live; no Unit 4B external mutation. |
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
- Phase 4 review remediation is deployed; positive authenticated profile/setup smoke remains pending an approved disposable Store Owner credential.

---

## 5. Global Decisions Made During Implementation

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
- Phase 4 security/workflow review remediation deployed (2026-07-15): controlled profile/setup boundary, approved-store setup workflow, inventory publish/filter/save corrections, trigger-helper EXECUTE hardening, and regression coverage. Function/JWT/grant/401 verification passed; positive owner-write smoke is credential-gated.
- Phase 5 discovery accepted (2026-07-15): projection-based public RLS correction deployed as `20260715174111`; anonymous/authenticated discovery, canonical offer comparison, private-boundary denials, constrained demand capture, locality disablement, and zero-residue cleanup passed.
- Phase 6 corrected monolith approved for local implementation (2026-07-16): the temporary split was intentionally deleted and superseded; the exact v0.1 monolith is archived immutably and the v0.2 monolith carries direct submitted request semantics, separate cart evidence, cross-table invariants, safe projections, entitled-owner gate, no substitutions, support-task versioning, exact scheduler, corrected SLA examples, append-only smoke evidence, lazy abandonment, named shutdown cancellation, and canonical notification fallback. No production or live changes occurred during documentation correction.
- Phase 6 Units 1-10 checkpoint and Units 11-12 source pass (2026-07-16): no P0/P1 contradiction was found; migrations 24-28 add canonical event/audit/inbox enforcement plus transport-independent notification delivery, bounded task claims/leases/retries/dead letters/manual replay, named reminder/expiry commands, and service-only scheduler/worker dispatch. Focused tests pass 182/182 and migration/security contracts 126/126; PostgreSQL execution and cron activation remain gated, and no Phase 7 behavior was added.
- Phase 6 Units 13-14 UI pass (2026-07-16): customer cart/request and Store Owner Orders routes, typed services/hooks, safe versioned projections, explicit replacement, clarification/decision/cancellation, review/outcome/support actions, deep-link refetch, and complete logout/cache cleanup are locally implemented. Focused Units 1-14 tests pass 250/250, migration/security contracts 134/134, TypeScript and production web export pass; migrations 1-30 remain local/unapplied and the PostgreSQL gate remains pending.
- Phase 6 Unit 15 and Unit 16 source gate (2026-07-16): forward migrations 31-33 add service-only reconciliation cases, deterministic stale-task cleanup, PII-safe structured observations, and operational metrics. Red-first Unit 15 passes 24/24; the complete source gate passes 274/274 and migration/security/reconciliation contracts 158/158. TypeScript, web export, Phase 5/notification compatibility, privacy/boundary scans, and diff hygiene pass. The [verification/traceability record](./implementation/PHASE-6-verification-and-traceability.md) gives the source-complete/database-pending matrix and rollout/rollback plan. No local Docker/PostgreSQL daemon exists, so Phase 6 is not locally database-verified.
- Unit 15 final static review caught and fixed invalid transition/task column references before handoff; regression contracts now assert derived request/cart store scope and valid lease-only cleanup columns.
- Phase 6 source/database checkpoint (2026-07-17): development Supabase has M01-M39, including forward-only corrective M34-M39; persisted command/authorization verification reaches `payment_ready`. Initial browser auth/navigation/Marketplace/cart-empty smoke passed with no console errors and controlled development fixtures remain. Scheduler v5/worker v2 and cron job 5 are active; comprehensive browser customer/Owner E2E, responsive/accessibility review, and real timed commerce-command checks remain deferred.
- Phase 6 completion/readback (2026-07-18): Supabase MCP reconfirmed M01-M39, authoritative-table RLS, active scheduler v5/worker v3, successful cron job 5 runs, and zero existing inventory quantity-balance violations. Comprehensive browser E2E remains explicitly deferred. Phases 7/8 are deferred and Phase 9 planning is authorized.
- Expert review findings incorporated: platform support/disputes are core ops, founding-store trial model added, Bangalore locality pilot added, seller-of-record decision added, post-payment unavailable flow clarified, minors/school users marked out of pilot scope.
- DOC-14 Commerce State Machines created.
- DOC-15 Finance, Tax, and Settlement Operating Model created.
- DOC-16 Pilot and Unit Economics created.

---

## 8. Next Recommended Task

**Phase 6 remains complete with comprehensive browser E2E deferred; Phases 7 and 8 remain deferred; the bounded Phase 9 fixture pipeline is deployed and live-verified.**

The Phase 1 foundation is applied, audited, and fully v0.2 compliant. The following tables are live and ready for feature implementation:

- `stores`, `store_administrators`, `store_status_history` — store creation and admin assignment
- `store_verification_requests`, `store_verification_documents` — verification submission and review
- `seller_payout_accounts` — payout account metadata collection
- `seller-verification-docs` bucket - document upload with path-scoped store isolation
- `marketplace_sec.is_store_admin()` — canonical RLS helper for all store-scoped policies

Next work:
1. Await a separately authorized Phase 9 work unit; none follows automatically from deployment.
2. Historical handoff (vision portion superseded 2026-07-27): treat Gemini 3.5 Flash (`gemini-3.5-flash`) and Google Books API as future handoff decisions only. The generic architecture supports an optional secondary metadata provider, but its selection, enablement, credentials, calls, and implementation remain deferred.
   The current initial primary vision model ID is configuration-driven
   `gemini-3.5-flash-lite`; its local adapter awaits independent review, while
   provider configuration/calls and all metadata-provider implementation remain
   deferred.
3. Keep M09, scheduling/autoscaling, metadata enrichment, mobile UI, inventory commit, publication, Library, and Phases 7/8 separately gated.
4. Re-verify the exact project, migrations, schema, Storage, services, and advisors before any later mutation.
