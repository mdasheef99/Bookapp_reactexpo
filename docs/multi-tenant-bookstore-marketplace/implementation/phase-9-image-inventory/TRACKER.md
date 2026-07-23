# Phase 9 Master Tracker

**Planning status:** `approved_baseline`
**Implementation status:** ingestion-runtime foundation `independently_reviewed_uncommitted`; Package 1 M01-M08/M10 remains live-verified; auth WU1/WU2 remains locally complete
**Last updated:** 2026-07-23
**Current milestone:** corrected ingestion-runtime candidate independently reviewed with no remaining merge blocker
**Active work unit:** `ingestion_runtime_foundation_independently_reviewed_uncommitted`
**Auth prerequisite status:** `auth_hardening_core_wu1_wu2_locally_complete`
**Last completed:** read-only independent review of the current unstaged candidate; one stale M06 storage-table contradiction corrected and re-reviewed
**Next authorized action:** await separate user authorization to stage and commit the independently reviewed candidate; no live application/deployment
**Implementation authority:** bounded ingestion-runtime foundation only; no OCR/model/candidate/UI/inventory/publication scope
**Migration creation/application authority:** local forward M11 created; live application not authorized; M09 remains absent
**Current gate:** separate commit authorization, dedicated-worker deployment sizing, and separately authorized M11/application deployment; all remain local-only
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. Package 1 M01-M08/M10 remain live exactly once. The bounded ingestion foundation now exists only as an uncommitted local candidate: forward M11, Owner Edge upload/completion endpoint, canonical content-hashed completion replay, service-only immutable source snapshots, opaque token-and-attempt worker leases, a dedicated service-authenticated claimed worker, strict privacy contracts, the real pinned ImageMagick WASM sanitizer, and PGlite/fixture tests. Nothing was applied, deployed, staged, committed, pushed, or merged; M09 remains absent.

The approved correction caps uploads at 10 MiB and decoded images at 16,000,000 pixels without server resizing, rejects animated/multi-frame PNG/WebP, and moves sanitation out of Supabase Edge. ImageMagick's 64 MP internal `area` allowance is only working/cache headroom and cannot bypass the 16 MP checks. On Node 22.13/Windows x64, three pinned-WASM iterations each at 8/12/16 MP took median 11.77/11.40/14.27 seconds; ending RSS was 169/191/225 MB (peak RSS unavailable), and all WebP dimensions, metadata-removal, and hash-stability checks passed. This is dedicated-worker sizing evidence only, not deployed-runtime proof.

Auth hardening WU1/WU2 is locally complete and independently approved on `codex/auth-hardening-core`: production bypass policy is centralized and fail-closed; Zustand owns canonical session/status; one root bootstrap owns subscription/restoration; identity replacement remains blocked through cleanup failure and explicit retry; and current-device logout persists a non-secret deletion-intent guard until SDK or exact-key fallback removal succeeds. Auth no longer directly imports marketplace. Secure token persistence, Android backup, authoritative profile routing, OTP UX, native/offline testing, and remote EAS verification remain separately gated before Phase 9 mobile/private-ingestion runtime integration.

Repository `AGENTS.md` → `implementation/ACTIVE.md` → DOC-13 → `SESSION-START.md` → this tracker is the durable resume chain. A future session must report this block before acting and must use the session protocol's documentation matrix at closeout.

The exact development project was re-verified read-only on 2026-07-22 before the Package 1 audit:

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

## Blocking gate before further implementation

WU0A, WU0B, and the Package 1 design remain approved. M01-M08 are live and immutable; forward correction M10 is live-verified. M06 Storage, M07 projection/discovery, M08 request-photo, and M10 grant/view boundaries pass readback. Core auth WU1/WU2 is locally complete; M09, remaining auth/security work, and product/runtime implementation remain gated.

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

Only a separately authorized stage-and-commit action is next. Do not apply M11, deploy the Owner Edge function or dedicated worker, rewrite M01-M08/M10, create/apply M09, or begin another work unit.
