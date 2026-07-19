# Phase 9 Master Tracker

**Planning status:** `approved_baseline`
**Implementation status:** `wu0b_definition_complete_needs_review`; WU0A remains `approved_complete`; WU0B technical-design implementation is unauthorized
**Last updated:** 2026-07-19
**Current milestone:** Work Unit 0B backend/API technical-design definition completed; independent definition review pending
**Active work unit:** `0b_definition_complete_needs_review`
**Last completed:** planning-only WU0B definition with routed reading, design inventories, authorization/state/transaction matrices, red gates, acceptance criteria, non-goals, and later authorization gates
**Next authorized action:** independent review of the WU0B definition documents only
**Implementation authority:** `wu0a_approved_complete`; WU0B definition only; WU0B technical-design implementation and broader product/runtime authority not granted
**Migration creation/application authority:** `not_granted`
**Current gate:** independent review of the WU0B definition, followed by separate explicit WU0B technical-design implementation authorization if approved; migration-file creation/application remain separate later gates
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. The Phase 9 baseline, corrected Work Unit 0 plan, and independently reviewed WU0A server contract/test foundation are approved and complete. The planning-only [WU0B definition](./work-units/00b-backend-api-technical-design-plan.md) now defines the future backend/API technical-design unit but is not independently reviewed and grants no implementation authority. WU0A contains only a network-free shared server contract package, pure helpers, sanitized synthetic fixtures, and tests. No Phase 9 migration, callable Edge Function, bucket/policy change, provider call, mobile/product application code, or external mutation has been created.

Repository `AGENTS.md` → `implementation/ACTIVE.md` → DOC-13 → `SESSION-START.md` → this tracker is the durable resume chain. A future session must report this block before acting and must use the session protocol's documentation matrix at closeout.

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
| Work Unit 0B definition | [`definition_complete_needs_review`](./work-units/00b-backend-api-technical-design-plan.md) |

## Blocking gate before further implementation

WU0A is approved and complete. The WU0B definition is complete but needs independent review. WU0B technical-design implementation is not authorized, and the plan cannot be marked implemented or approved from its existence. No later product/runtime implementation may start until the implementation tracker is explicitly moved to a named authorized unit. Migration creation and Supabase application are separate approvals. Before database/migration design or either migration action, the agent must re-run project verification for `ahntbtktjjmvfosgkmgn` and re-audit all affected tables, policies, functions, triggers, buckets, and live migrations.

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

Authorize an independent review of the WU0B definition documents only. WU0B technical-design implementation, migration-file creation, and migration application remain independent later gates.
