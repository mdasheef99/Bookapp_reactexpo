# Phase 9 Master Tracker

**Planning status:** `approved_baseline`
**Implementation status:** `not_started`
**Last updated:** 2026-07-19
**Current milestone:** Work Unit 0 plan complete; review required
**Active work unit:** `0_plan_complete_needs_review`
**Last completed:** Work Unit 0 contracts/threat/migration-design plan and fresh read-only Supabase audit
**Next authorized action:** review and approve or revise the Work Unit 0 plan; do not create migration files or product code
**Implementation authority:** `planning_only`
**Migration creation/application authority:** `not_granted`
**Current gate:** explicit Work Unit 0 plan review before product implementation or migration-file creation
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## Current handoff

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. The Phase 9 planning baseline was approved by the user on 2026-07-19, and the completed Work Unit 0 plan now awaits review. No Phase 9 migration, Edge Function, bucket/policy change, provider call, or application code has been created.

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
| Work Unit 0 plan | [`complete_needs_review`](./work-units/00-contracts-threat-migration-plan.md) |

## Blocking gate before implementation

Product implementation must not start until the Work Unit 0 plan is reviewed and the implementation tracker is explicitly moved to an implementation-authorized unit. Migration creation and Supabase application are separate approvals. Before either action, the agent must re-run project verification for `ahntbtktjjmvfosgkmgn` and re-audit all affected tables, policies, functions, triggers, buckets, and live migrations.

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

## Next approved action

Review [the completed Work Unit 0 plan](./work-units/00-contracts-threat-migration-plan.md). Do not create or apply migration files and do not start product implementation until a subsequent unit is explicitly authorized.
