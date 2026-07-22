# Phase 9 Master Tracker

**Planning status:** `approved_baseline`
**Implementation status:** `package1_m01_m08_m10_live_verified`; auth hardening WU1/WU2 `locally_complete`; WU0A remains `approved_complete`; WU0B remains independently approved/documentation-only
**Last updated:** 2026-07-22
**Current milestone:** Package 1 M01-M08 plus forward security correction M10 live-verified
**Active work unit:** `package1_m01_m08_m10_live_verified`
**Auth prerequisite status:** `auth_hardening_core_wu1_wu2_locally_complete`
**Last completed:** production bypass hardening plus canonical auth state, root bootstrap, identity-transition cleanup, and current-device logout correctness
**Next authorized action:** none; await separate authorization for M09 or a later auth/runtime work unit
**Implementation authority:** `auth_hardening_core_wu1_wu2_locally_complete`; Phase 9 product/runtime authority not granted
**Migration creation/application authority:** `m01_m08_m10_live_verified`; M09 application not granted
**Current gate:** M09, secure auth persistence, profile routing, OTP UX, Android backup, and Phase 9 runtime remain separately gated
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. Package 1 M01-M08 and forward correction M10 are live exactly once on the verified development project. M10 restores `anon` execution to exactly the three discovery RPCs, makes the internal projection invoker-safe, and removes direct role access. Request-photo/internal/private boundaries passed readback, and the Phase 9 `security_definer_view` advisor error is gone. M09 was not created or applied. No Edge Function, provider, mobile/product runtime, or auth code changed.

Auth hardening WU1/WU2 is locally complete on `codex/auth-hardening-core`: production bypass policy is centralized and fail-closed; Zustand owns canonical session/status; one root bootstrap owns subscription/restoration; an application coordinator serializes identity cleanup; and current-device logout has a single-key SDK fallback. Auth no longer directly imports marketplace. Secure token persistence, Android backup, authoritative profile routing, OTP UX, native/offline testing, and remote EAS verification remain separately gated before Phase 9 mobile/private-ingestion runtime integration.

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

## Next action gate

No next work unit is authorized. Do not rewrite M01-M08/M10 or create/apply M09, remaining auth/security work, or runtime changes without new authorization.
