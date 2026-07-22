# Phase 9 Master Tracker

**Planning status:** `approved_baseline`
**Implementation status:** `package1_m01_m08_m10_live_verified`; WU0A remains `approved_complete`; WU0B remains independently approved/documentation-only
**Last updated:** 2026-07-22
**Current milestone:** Package 1 M01-M08 plus forward security correction M10 live-verified
**Active work unit:** `package1_m01_m08_m10_live_verified`
**Last completed:** reviewed M10 correction, ordered live application, exact grant/privacy readback, and advisor disposition
**Next authorized action:** none; await separate authorization for M09 or a later auth/runtime work unit
**Implementation authority:** `package1_database_checkpoint_verified`; product/runtime authority not granted
**Migration creation/application authority:** `m01_m08_m10_live_verified`; M09 application not granted
**Current gate:** M09 quantity validation and auth/runtime remain separately gated
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. Package 1 M01-M08 and forward correction M10 are live exactly once on the verified development project. M10 restores `anon` execution to exactly the three discovery RPCs, makes the internal projection invoker-safe, and removes direct role access. Request-photo/internal/private boundaries passed readback, and the Phase 9 `security_definer_view` advisor error is gone. M09 was not created or applied. No Edge Function, provider, mobile/product runtime, or auth code changed.

Auth hardening is deferred to a fresh session and separate branch. It must precede Phase 9 mobile/private-ingestion runtime integration and cover auth state ownership, one root-owned subscription, centralized transitions/logout, secure token persistence, production-safe development bypasses, and removal of auth-to-marketplace dependency. No auth code changed in this database-application work unit.

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

WU0A, WU0B, and the Package 1 design remain approved. M01-M08 are live and immutable; forward correction M10 is live-verified. M06 Storage, M07 projection/discovery, M08 request-photo, and M10 grant/view boundaries pass readback. M09, auth hardening, and product/runtime implementation remain gated.

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

No next work unit is authorized. Do not rewrite M01-M08/M10 or create/apply M09, auth, or runtime changes without new authorization.
