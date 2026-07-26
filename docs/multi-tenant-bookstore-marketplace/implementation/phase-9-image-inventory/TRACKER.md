# Phase 9 Master Tracker

**Planning status:** `deployment_runtime_scaffolding_sdd_implemented`
**Implementation status:** `deployment_runtime_scaffolding_integrated`; M11/M12 unapplied and all ingestion/vision services undeployed; Package 1 M01-M08/M10 live-verified
**Last updated:** 2026-07-26
**Current milestone:** Unit 4A local and synthetic cloud container gates passed; deployment-runtime scaffolding integrated
**Active work unit:** `deployment_runtime_scaffolding_integrated`
**Auth prerequisite status:** `auth_hardening_core_wu1_wu2_locally_complete`
**Last completed:** provider-neutral sanitation/fixture-vision service hosts, strict environment loading, dynamic fixtures, manual invoker, deterministic builds/containers, Owner function configuration, deployment validation, tests, and evidence
**Next authorized action:** none within Unit 4A; await separate authorization for a named live preflight, migration application, deployment, or later work unit
**Implementation authority:** Unit 4A correction and Git integration are complete; live application, deployment, secret configuration, and later units remain unauthorized
**Migration creation/application authority:** local M11/M12 exist and are unapplied; M09 remains absent; no live application is authorized
**Current gate:** Unit 4A local and synthetic GitHub Actions image build/start verification passed; M11/M12 application, deployment, live secrets, real providers, metadata, UI, inventory, publication, and later work remain prohibited
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. Package 1 M01-M08/M10 remain live exactly once. The bounded ingestion foundation—forward M11, Owner Edge intake, immutable source snapshots, token/attempt media leases, dedicated sanitizer worker, and tests—is committed on `main` at `0a8e57a`; M11 remains unapplied and both services remain undeployed. M09 remains absent.

The [Unit 4 design](./work-units/04-fixture-vision-analysis-runtime-design.md) and M12 are integrated on `main` at `e9ba2d9`. [Unit 4A](./work-units/04a-deployment-runtime-scaffolding-sdd.md) adds provider-neutral sanitation/fixture-vision HTTP services, strict environment and secret-separation checks, allowlisted request-bound fixtures, bounded observability, deterministic builds/containers, a sanitized manual invoker, and JWT-enabled local Owner Edge configuration. Final verification passed 14 Phase 9 Jest suites/131 tests, PGlite 57/57, repository TypeScript, both strict worker builds, the executable deployment validator, and the synthetic GitHub Actions container smoke. No migration was applied, service deployed, secret configured, provider called, or Supabase/Storage state mutated in Unit 4A.

Auth hardening WU1/WU2 is locally complete and independently approved on `codex/auth-hardening-core`: production bypass policy is centralized and fail-closed; Zustand owns canonical session/status; one root bootstrap owns subscription/restoration; identity replacement remains blocked through cleanup failure and explicit retry; and current-device logout persists a non-secret deletion-intent guard until SDK or exact-key fallback removal succeeds. Auth no longer directly imports marketplace. Secure token persistence, Android backup, authoritative profile routing, OTP UX, native/offline testing, and remote EAS verification remain separately gated before Phase 9 mobile/private-ingestion runtime integration.

Repository `AGENTS.md` → `implementation/ACTIVE.md` → DOC-13 → `SESSION-START.md` → this tracker is the durable resume chain. A future session must report this block before acting and must use the session protocol's documentation matrix at closeout.

The exact development project was re-verified read-only on 2026-07-26 for the Unit 4 audit:

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
| Work Unit 4A deployment-runtime scaffolding | [`integrated_local_and_cloud_verified`](./work-units/04a-deployment-runtime-scaffolding-sdd.md) |

## Blocking gate before further implementation

WU0A, WU0B, Package 1, and Unit 4 are ready at their recorded levels. M01-M08/M10 are live and immutable. M11/M12 are committed but unapplied and services remain undeployed. Core auth WU1/WU2 is locally complete. All five Unit 4A review corrections, the complete local gate, and the synthetic GitHub Actions container gate are verified; Unit 4A is integrated. M09, migration application, deployment, secret configuration, and later work remain separately gated.

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

Unit 4A is complete and integrated. Await separate authorization for a named live preflight, migration application, deployment, or later work unit. Do not apply M11/M12, deploy services, configure live secrets, call real vision/metadata providers, build UI, mutate inventory/publication, create/apply M09, or begin another unit.
