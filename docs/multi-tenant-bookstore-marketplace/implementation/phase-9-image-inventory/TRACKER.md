# Phase 9 Master Tracker

**Planning status:** `approved_baseline`
**Implementation status:** `package1_independently_approved`; WU0A remains `approved_complete`; WU0B remains independently approved/documentation-only
**Last updated:** 2026-07-22
**Current milestone:** Package 1 corrected audit/database design independently approved
**Active work unit:** `package1_independently_approved`
**Last completed:** Correction-only independent review returned exact verdict `approved`; all six findings and validator preservation verified
**Next authorized action:** await separate authorization for failing migration/security tests or migration-file creation; M09/live application remains independently gated
**Implementation authority:** `wu0a_approved_complete`; WU0B documentation-only design complete; product/runtime authority not granted
**Migration creation/application authority:** `not_granted`
**Current gate:** Package 1 approved checkpoint; migration tests, migration-file creation, live application, and runtime remain separately gated
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. The Phase 9 baseline, corrected Work Unit 0 plan, WU0A server contract/test foundation, and WU0B definition are approved. The documentation-only [WU0B technical design](./work-units/00b-backend-api-technical-design-plan.md) routes seven completed artifacts and is independently approved. Package 1 then performed the authorized read-only Supabase audit and recorded its [evidence](./work-units/01-package1-live-audit.md) and [proposed database design](./work-units/01-package1-database-design.md). The six required review corrections are now incorporated. No Phase 9 migration, callable Edge Function, bucket/policy change, provider call, mobile/product application code, database/storage mutation, or other runtime change occurred.

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

WU0A is approved and complete. WU0B documentation-only technical design and the bounded six-area contract correction are independently approved with exact verdict `approved`. Package 1's fresh exact-project read-only audit and corrected database design are independently approved with exact verdict `approved`. C12 remains one dedicated future endpoint used by both caller paths, and Q11 remains request-photo-owned. Failing database/security tests, migration-file creation, live application, and product/runtime implementation remain separately gated.

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

Await separate authorization for failing test creation or migration-file creation. M09 quantity validation and all live application remain independently gated.
