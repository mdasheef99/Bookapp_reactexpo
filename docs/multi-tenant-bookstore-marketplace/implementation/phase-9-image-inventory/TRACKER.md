# Phase 9 Master Tracker

**Planning status:** `provider_scale_sdd_reconciliation_needs_independent_review`
**Implementation status:** `unit4b_persistence_correction_needs_independent_review`; fixture pipeline remains live-verified and the Gemini correction is local-only
**Last updated:** 2026-07-27
**Current milestone:** Unit 4B provider-attempt/egress correction locally implemented; one correction-only review pending
**Active work unit:** `unit4b_persistence_correction_needs_independent_review`
**Auth prerequisite status:** `auth_hardening_core_wu1_wu2_locally_complete`
**Last completed:** Unit 4B local M14 provider-attempt and final-egress correction on `codex/phase9-unit4b-gemini-adapter`; detailed handoff is [04b](./work-units/04b-gemini-vision-adapter-handoff.md)
**Next authorized action:** one correction-only independent review of Unit 4B
**Implementation authority:** Unit 4B implementation is complete locally; live provider calls/configuration, metadata enrichment, scheduling/autoscaling, UI, inventory commit, publication, Library, and later units remain unauthorized
**Migration creation/application authority:** M01-M08/M10-M13 are live-verified; local M14 is created but not applied; M09 remains absent; no migration application is authorized
**Current gate:** review Unit 4B only; do not configure/call Gemini or Google Books, select/enable a secondary/fallback, design/implement Unit 5, schedule/autoscale, deploy, or begin another unit
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. Phase 9 M01-M08/M10-M13 are live exactly once and M09 remains absent. M13 exposes only minimum `SECURITY INVOKER` public wrappers for the authoritative private service RPCs. Owner ingestion is active with JWT verification; `phase9-media-sanitation` and `phase9-fixture-vision` are separate free-plan Render services at `96991a9`.

The [Unit 4 design](./work-units/04-fixture-vision-analysis-runtime-design.md) and [Unit 4A deployment runtime](./work-units/04a-deployment-runtime-scaffolding-sdd.md) are now live-verified through the [fixture deployment evidence](./trackers/06-fixture-pipeline-deployment-evidence.md). The deployed `one_book` path and eight fresh-process operator cases used recorded fixtures only, `batchSize: 1`, normal claim/fencing/persistence/failure paths, and produced zero inventory/listing/publication effects. Future decisions are Gemini 3.5 Flash (`gemini-3.5-flash`) and initial Google Books API metadata, but neither is implemented, configured, or called.

The provider/scale reconciliation keeps real Gemini provider-contract design as a separately gated prospective Unit 4B and keeps Unit 5 authoritatively named `Metadata/aliases`. The generic architecture supports one metadata primary and at most one disabled-until-approved secondary, horizontal correctness, and a fixed-multi-replica activation gate; it does not authorize provider calls, deployment changes, scheduling, or autoscaling. The bounded F1–F3 correction removes the deferred-secondary contradiction, makes media/vision/metadata capacity signals explicit, and disables raw provider/model payload persistence by default while retaining the independent-review gate.

The founder subsequently authorized Unit 4B and superseded only the initial primary
vision model ID to configuration-driven `gemini-3.5-flash-lite`; the earlier
`gemini-3.5-flash` handoff remains historical. Unit 4B is local-only and awaits one
independent review. The fixture adapter remains available, and no optional vision
fallback is selected or enabled.

The founder then authorized only the review corrections. Local M14 now adds
service-only vision-provider attempts and bounded register/validate/finalize/
associate/mark RPCs. Gemini registers an attempt, revalidates immediately before
private download, and revalidates again immediately before provider egress. Stable
logical spend identity is claim-retry independent, while each registered call has
a unique provider-attempt identity. Pricing evidence is a semantically validated
positive allowlist in TypeScript and SQL. M14 is not live, no provider was called,
and one correction-only independent review is next.

Auth hardening WU1/WU2 is locally complete and independently approved on `codex/auth-hardening-core`: production bypass policy is centralized and fail-closed; Zustand owns canonical session/status; one root bootstrap owns subscription/restoration; identity replacement remains blocked through cleanup failure and explicit retry; and current-device logout persists a non-secret deletion-intent guard until SDK or exact-key fallback removal succeeds. Auth no longer directly imports marketplace. Secure token persistence, Android backup, authoritative profile routing, OTP UX, native/offline testing, and remote EAS verification remain separately gated before Phase 9 mobile/private-ingestion runtime integration.

Repository `AGENTS.md` → `implementation/ACTIVE.md` → DOC-13 → `SESSION-START.md` → this tracker is the durable resume chain. A future session must report this block before acting and must use the session protocol's documentation matrix at closeout.

The exact development project was re-verified read-only at M11/M12 closeout:

| Field | Verified value |
| --- | --- |
| Project ID | `ahntbtktjjmvfosgkmgn` |
| Name | `Bookconnect_reactexpo` |
| Region | `ap-southeast-2` |
| Status | `ACTIVE_HEALTHY` |
| Postgres | 17.6.1 |
| Tenant discriminator | `store_id` (37 public-schema columns; zero `tenant_id`) |

## Tracker routing

- Product/planning decisions, source reconciliation, and live audit: [01-planning-and-decisions.md](./trackers/01-planning-and-decisions.md)
- Future implementation units, migrations, verification, rollout, and evidence: [02-implementation-and-verification.md](./trackers/02-implementation-and-verification.md)

## Planning deliverables

| Deliverable | Status |
| --- | --- |
| Root source-spec reconciliation | `complete` |
| Master SDD | `approved_baseline` |
| Data/canonical/metadata SDD | `approved_baseline` |
| Extraction/enrichment SDD | `approved_baseline` |
| Owner review/commit SDD | `approved_baseline` |
| Media/security/privacy SDD | `approved_baseline` |
| Marketplace display SDD | `approved_baseline` |
| Customer photo-request SDD | `approved_baseline` |
| Data dictionary | `approved_baseline` |
| Live database/storage current-vs-target audit | `package1_refresh_complete_read_only_2026-07-22` |
| Requirements traceability | `approved_baseline` |
| Complexity/scope register | `approved_baseline` |
| Cross-document link, acceptance-ID, and terminology validation | `complete` |
| Repository/active-phase/session routing | `complete` |
| Documentation update and closeout protocol | `complete` |
| Automated continuity validator | `complete` |
| User/design approval | `complete_2026-07-19` |
| Work Unit 0 plan | [`approved_2026-07-19`](./work-units/00-contracts-threat-migration-plan.md) |
| Work Unit 0A contracts/tests | `approved_2026-07-19` |
| Work Unit 0B technical design | [`independently_approved`](./work-units/00b-backend-api-technical-design-plan.md) |
| Work Unit 4 fixture vision-analysis runtime | [`integrated_main_e9ba2d9`](./work-units/04-fixture-vision-analysis-runtime-design.md) |
| Work Unit 4A deployment-runtime scaffolding | [`deployed_and_live_fixture_verified`](./trackers/06-fixture-pipeline-deployment-evidence.md) |
| Work Unit 4B Gemini vision adapter | [`implemented_locally_needs_independent_review`](./work-units/04b-gemini-vision-adapter-handoff.md) |
| Provider and scale architecture SDD reconciliation | `needs_independent_review_2026-07-27` |

## Blocking gate before further implementation

WU0A, WU0B, Package 1, Unit 4, and Unit 4A are complete at their recorded
levels. Unit 4B is locally implemented and awaits independent review.
M01-M08/M10-M13, the Owner boundary, and both separate fixture workers are
live-verified. Core auth WU1/WU2 is locally complete. M09 and every product/provider
work unit after Unit 4B remain separately gated.

## Risk summary

| Risk | Current containment |
| --- | --- |
| Cross-tenant write/read | Server derives `store_id`; RLS is backstop; every privileged boundary needs Store A-to-Store B denial tests. |
| Multimodal prompt injection | Model receives no tools; output is untrusted and schema-validated; deterministic code owns all calls and writes. |
| Accidental publication | Mandatory owner review; first-session publication default is private; listing eligibility is server-controlled. |
| Canonical catalogue pollution | Uncertain/manual entries remain store-local with nullable canonical link. |
| Duplicate over-merge | Advisory warning only; no image comparison and no automatic merge. |
| Public/private media leakage | Separate scan, public-copy, and request-photo classes; server-mediated promotion; private request delivery. |
| Cost/retry explosion | Image hash replay protection, one whole-image fallback maximum, sequential metadata providers, policy quotas. |
| Stale inventory | Confirmation-before-payment remains; `last_verified_at` and repeated request-photo failures feed listing review. |
| Lifecycle/storage growth | Purpose-specific retention, deletion jobs, orphan detection, legal/dispute holds, deletion evidence. |
| Existing global Supabase warnings | Recorded as pre-existing; Phase 9 cannot copy broad public listing or ambient `SECURITY DEFINER` patterns. |
| Dedicated sanitizer worker | Local feasibility passed at 8/12/16 MP; provision and load-test a non-Edge worker with the recorded CPU/memory envelope before deployment. |

## Next action gate

The exact next action is one independent review of Unit 4B. Unit 5
Metadata/aliases remains separately gated. Do not configure or call providers,
select/enable a secondary/fallback, schedule/autoscale workers, change deployment,
enrich metadata, change mobile UI, commit inventory, publish listings, implement
Library behavior, or create/apply M09.
