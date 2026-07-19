# Phase 9 Master Tracker

**Planning status:** `approved_baseline`
**Implementation status:** `wu0a_contract_test_foundation_approved`
**Last updated:** 2026-07-19
**Current milestone:** Work Unit 0A server contract/test foundation independently reviewed and approved
**Active work unit:** `0a_approved_awaiting_wu0b_authorization`
**Last completed:** corrected and approved WU0A contracts, deterministic helpers, central registers, sanitized fixtures, and contract/security tests
**Next authorized action:** none; WU0B backend/API technical design is next eligible but requires separate explicit authorization
**Implementation authority:** `wu0a_approved_complete`; WU0B and broader product/runtime authority not granted
**Migration creation/application authority:** `not_granted`
**Current gate:** explicit authorization for WU0B backend/API technical design only; migration-file creation/application remain separate gates
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. The Phase 9 baseline, corrected Work Unit 0 plan, and independently reviewed WU0A server contract/test foundation are approved and complete. WU0A contains only a network-free shared server contract package, pure helpers, sanitized synthetic fixtures, and tests. No Phase 9 migration, callable Edge Function, bucket/policy change, provider call, mobile/product application code, or external mutation has been created.

Repository `AGENTS.md`, `implementation/ACTIVE.md`, this tracker, and `SESSION-START.md` now form the durable resume chain. A future session must report this block before acting and must use the session protocol's documentation matrix at closeout.

The exact development project was re-verified before the live audit:

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
| Live database/storage current-vs-target audit | `complete_read_only` |
| Requirements traceability | `approved_baseline` |
| Complexity/scope register | `approved_baseline` |
| Cross-document link, acceptance-ID, and terminology validation | `complete` |
| Repository/active-phase/session routing | `complete` |
| Documentation update and closeout protocol | `complete` |
| Automated continuity validator | `complete` |
| User/design approval | `complete_2026-07-19` |
| Work Unit 0 plan | [`approved_2026-07-19`](./work-units/00-contracts-threat-migration-plan.md) |
| Work Unit 0A contracts/tests | `approved_2026-07-19` |

## Blocking gate before further implementation

WU0A is approved and complete. WU0B backend/API technical design is only the next eligible unit; it is not authorized. No later product/runtime implementation may start until the implementation tracker is explicitly moved to a named authorized unit. Migration creation and Supabase application are separate approvals. Before either action, the agent must re-run project verification for `ahntbtktjjmvfosgkmgn` and re-audit all affected tables, policies, functions, triggers, buckets, and live migrations.

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

Request separate authorization for WU0B backend/API technical design only. WU0B must remain design-only unless its authorization says otherwise; migration-file creation and application remain independent later gates.
