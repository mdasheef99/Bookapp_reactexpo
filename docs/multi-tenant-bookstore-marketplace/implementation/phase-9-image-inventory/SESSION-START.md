# Phase 9 Development-Session Start and Handoff Protocol

**Status:** active continuity protocol
**Last updated:** 2026-08-11
**Applies to:** AI/human development sessions, not bookstore inventory-capture sessions

This is the deterministic resume procedure for Phase 9. A new session should recover the current state from files and verified systems, never from chat memory alone.

The one startup chain is repository `AGENTS.md` → `implementation/ACTIVE.md` → DOC-13 → this `SESSION-START.md` → Phase 9 `TRACKER.md`. `AGENTS.md` is always the first entrypoint; this file refines the Phase 9 portion of that repository-level sequence.

Current operational closure: M29-M38 are live exactly once; exact-project
history ends at `20260810130638 marketplace_phase9_metadata_retry_correction`.
The user's 2026-08-10 decision retains Remove image and replaces append-style
multi-image capture with one current image plus one replacement after explicit
pre-candidate removal. M35 is live, the three authorized legacy inputs were
logically removed, and Owner Edge v3 is deployed/readback-verified. One new
input was registered after removal and must not be removed or otherwise mutated
without a new explicit target decision.

Current routed handoff: Unit 6 is complete. Approved `main` SHA
`a138baa7d3bbc086da019bc052a5ae31d0e15882` contains the reviewed M38/runtime
correction. M38 is live once; metadata was deployed once from that SHA; and one
authenticated Owner upload automatically completed media, vision/Gemini, six
metadata jobs, and the Needs Review UI. There were zero manual runs, claims,
repairs, or operator retries; inventory/listings stayed 5/5 and the historical
dead-letter job was untouched. Duplicate replay was not tested and Unit 7 was
not started. No next work unit is authorized; Unit 7 requires a new explicit
session.

Current local correction: user-supplied 2026-08-11 physical Android evidence
proves the Expo FileSystem `UploadTask` replacement reached signed Storage
`2xx`, created exactly one object, registered input
`a1c8e286-07f2-40c5-9bbd-2fed49c5148d`, and completed media sanitation. Vision
job `20734f70-dd4c-4f68-87d5-aa837cb32b7d` then received parseable Gemini JSON
and failed permanently as `P9_VISION_SCHEMA_INVALID`; the removed/skipped input
must not be revived. The bounded local decoder correction now converts 16-100
reported observations into complete-image `too_many_books`, degrades only safe
bounded unknown human language labels to `und`, preserves original Unicode,
isolates malformed optional enrichment, and logs only closed content-free schema
diagnostics. Resilience is 21/21, existing analyzer/captured payload plus
resilience is 46/46, focused worker/extraction/multilingual/security/Unit 6
polling is 120/120, Image Inventory is 39 suites and 294/294, and repository
TypeScript plus the vision-worker build pass. Exact next action is bounded
review; deployment and one fresh post-deployment Android image proof require
separate authorization. Unit 7 remains separately gated.

Current routed handoff: Unit 6A is merged/live-verified through M29, Unit 6B is
merged at `9ef9eb3` with [tracker 20](./trackers/20-unit6b-route-query-cache-evidence.md),
and Unit 6C is merged through `092562d`. Unit 6D — Owner
candidate review and strict editing — remains implemented at `c363b60` with
[tracker 22](./trackers/22-unit6d-candidate-review-evidence.md). Unit 6E
false/missed-variant corrections are finalized at correction checkpoint
`8bceab260a953b4d832fd55f34f58db12fa009b1`; [tracker 23](./trackers/23-unit6e-review-corrections-evidence.md)
owns the exact diff-only closure, M30 application, remote readback, bounded
browser-smoke receipt, and handoff. M30 is live exactly once as
`20260801093048 marketplace_phase9_unit6e_review_corrections`; no other
migration, Supabase/Storage, deployment, provider, inventory, publication, or
commerce mutation occurred. Unit 6F browser/readback verification and local
quality gates are recorded in [tracker 24](./trackers/24-unit6f-readiness-quality-gates-evidence.md);
the representative low-end Android Unit 6F evidence remains outstanding.

WU1 and WU2 remain complete at their recorded levels. M32 is now live exactly
once as `20260808020404 marketplace_phase9_structural_metadata_integration` on
the verified development project. The controlled live proof configured one
Google Books registry row and stopped before candidate creation because the
approved local environment lacks the exact target-project service credential,
the Gemini live configuration, and the required Google Books credential. The latest local H1/H2/H3
evidence remains green: focused Jest is 97/97, structural PGlite is 14/14,
metadata foundation is 13/13, and vision/M32 PGlite is 40/40:
vision candidate creation and metadata-job creation share one PostgreSQL
transaction, the worker loads and mutates the same candidate through claim-token
fencing, provider HTTP work occurs outside database transactions, and replay-safe
terminal outcomes use the existing M15 contract. Google Books remains the only
implemented provider adapter; no automatic dispatch was added. No fresh session,
input, candidate, metadata job, provider call, or Owner readback was created in
the blocked live proof. The next authorized action is to configure the exact
target-project service credential and Google Books credential through the approved
secret mechanism, then rerun the bounded proof. Unit 6F native evidence and the
remaining runtime gates stay open.

The 2026-08-09 bounded metadata-runtime safety unit is locally implemented:
shared worker startup accepts only the exact approved Supabase HTTPS origin;
metadata has no peer worker and no longer accepts the media/vision peer hash;
media/vision peer distinctness remains mandatory; and the existing manual
invoker supports `metadata` with the same bounded body, timeout, and safe output.
Secrets remain process-only. Focused Jest is 84/84 and the metadata worker build
passes. Exactly one process-only Google Books adapter request returned HTTP 200;
the credential was accepted, the response stayed within bounds, and the decoder
produced a valid provider-neutral `no_acceptable_match` result. No privileged
worker, candidate, database mutation, provider persistence, Render/Gemini change,
or deployment occurred. The next gate is separate authorization for
`CONTROLLED_ONE_CANDIDATE_METADATA_VERTICAL_PROOF` plus safe process-only
injection of a fresh process-only Google Books key after revocation of the
chat-exposed temporary key. A 2026-08-09 recheck proved the inherited service-role
key belongs to and is accepted by the exact project; the inherited `SUPABASE_URL`
alone is foreign and must be overridden before worker startup.

## 1. Canonical status source

After entering through repository `AGENTS.md`, the active router, DOC-13, and this protocol, read [TRACKER.md](./TRACKER.md) and extract these fields:

- planning status;
- implementation status;
- current milestone;
- active work unit;
- last completed unit/evidence;
- next authorized action;
- blockers and external/migration authority.

DOC-13 must agree on the active phase. `implementation/ACTIVE.md` must route here. If either conflicts, documentation reconciliation is the only safe task until the conflict is resolved.

## 2. Mandatory startup sequence

1. Run `git branch --show-current`, `git rev-parse --show-toplevel`, and `git status --short`.
2. Read repository [`AGENTS.md`](../../../../AGENTS.md).
3. Read [`implementation/ACTIVE.md`](../ACTIVE.md).
4. Read [DOC-13](../../DOC-13-implementation-tracker.md).
5. Read this `SESSION-START.md`, then [TRACKER.md](./TRACKER.md).
6. Read [the master SDD](./00-phase-9-master-sdd.md), especially invariants, work-unit order, and continuity contract.
7. Read [the implementation tracker](./trackers/02-implementation-and-verification.md) to learn whether a work unit is authorized and what evidence already exists.
8. Use the work-unit routing table below to read only the relevant domain SDDs and supporting files.
9. Inspect current code/migrations/tests in the affected area. Planned target tables are not evidence that they exist.
10. For database/storage uncertainty, use Supabase MCP and verify the exact project before relying on results.
11. Give the user the resume brief below before editing or acting.

## 3. Required resume brief

Every new session begins with a concise statement containing:

```text
Current phase:
Planning/implementation status:
Last completed milestone:
Active work unit:
Next authorized action:
Blockers/gates:
Supabase mutation authority for this session:
Files expected to change:
```

Do not describe an action as authorized merely because it is listed as a future work unit.

## 4. Work-unit reading router

| Work unit | Required design reading | Required supporting reading |
| --- | --- | --- |
| Planning/review | Master SDD and all changed domain SDDs | decisions tracker, traceability, complexity register |
| 0 Contracts/threat/migration plan | 00 Master; 01 Data; 02 Pipeline; 04 Security | data dictionary, current-vs-target audit, traceability |
| 0A Contracts/tests (only if authorized) | 00 Master; 01 Data; 02 Pipeline; 03 Review; 04 Security; 05 Marketplace | approved WU0 plan, data dictionary, traceability, implementation tracker |
| 0B Backend/API technical design or review (only if authorized) | 00 Master; 01 Data; 02 Pipeline; 03 Review; 04 Security; 05 Marketplace; 06 Photo Request | [WU0B authority/router](./work-units/00b-backend-api-technical-design-plan.md), all seven linked `00b-technical-design/` artifacts, approved WU0 plan, both detailed trackers, data dictionary, current-vs-target audit, traceability, complexity register, WU0A package README/registers/red gates, and inspected boundary source listed by the router |
| 1 Data/metadata migration | 01 Data; 03 Review; 05 Marketplace | data dictionary, current-vs-target audit, migration ledger |
| 2 Session/job schema | 02 Pipeline; 03 Review; 04 Security | data dictionary, current-vs-target audit |
| 3 Media boundary | 04 Security; 02 Pipeline; 03 Review | data dictionary, live storage audit, DOC-1 |
| 4 Vision adapter | 02 Pipeline; 04 Security | [Unit 4 fixture vision-analysis design](./work-units/04-fixture-vision-analysis-runtime-design.md), current vision contracts, exact-project schema/grant evidence |
| 4A Deployment-runtime scaffolding | 02 Pipeline; 04 Security | [Unit 4A deployment-runtime SDD](./work-units/04a-deployment-runtime-scaffolding-sdd.md), [Unit 4A evidence](./trackers/04-deployment-runtime-scaffolding-evidence.md), Unit 3/4 evidence, current worker/Owner entrypoints and deployment configuration |
| Service deployment/live fixture verification | 02 Pipeline; 04 Security | [Unit 4A deployment-runtime SDD](./work-units/04a-deployment-runtime-scaffolding-sdd.md), [M11/M12 live-application evidence](./trackers/05-m11-m12-live-application-evidence.md), current-vs-target audit, migration ledger, current worker/Owner entrypoints, environment loaders, container/deployment validators, hosting configuration, and fresh exact-project service/function readback |
| 5 Metadata/aliases | 01 Data; 02 Pipeline; 03 Review; 04 Security; 05 Marketplace | Unit 5A/5B handoffs/evidence, [Unit 5C Lite](./work-units/05c-lite-multilingual-search-variants-sdd.md), data dictionary, current-vs-target audit, requirements traceability, complexity register, provider audit/fixtures |
| 6 Owner UX | [Unit 6 SDD](./work-units/06-owner-capture-review-recovery-ux-sdd.md); [contract matrix](./work-units/06-owner-capture-review-recovery-contract-matrix.md); 03 Review; 02 Pipeline | [tracker 18](./trackers/18-unit6-owner-ux-design-evidence.md), DOC-8, accessibility/verification matrix |
| WU1/WU2 Owner inventory read boundary/client | [WU1](./work-units/owner-inventory-read-boundary-wu1-sdd.md); [WU2](./work-units/owner-inventory-read-client-wu2-sdd.md); 00 Master; 03 Review | [tracker 25](./trackers/25-owner-inventory-read-boundary-wu1-evidence.md), [tracker 26](./trackers/26-owner-inventory-read-client-wu2-evidence.md), DOC-8 §5, current-vs-target audit, requirements traceability |
| 7 Commit/duplicates/projection | 01 Data; 03 Review; 05 Marketplace | quantity/hold invariants, current trigger audit |
| 8 Marketplace | 05 Marketplace; 01 Data | DOC-0, DOC-3, DOC-5, public/private tests |
| 9 Damage/request photos | 04 Security; 06 Photo Request; 03 Review | DOC-1, DOC-6, DOC-14, retention matrix |
| 10 Lifecycle worker | 04 Security; 02 Pipeline | retention/deletion fields and ops checks |
| 11 Pilot verification | all seven SDDs | traceability, full verification tracker, rollout gates |

## 5. Supabase/database gate

Before migration planning or any database/storage work:

1. Use Supabase MCP to verify project identity. The last read-only evidence is recorded in [database-current-vs-target.md](./supporting/database-current-vs-target.md), but it must not be assumed current.
2. Re-query affected tables, constraints, indexes, policies, grants, functions, triggers, buckets, storage policies, migrations, and advisor findings.
3. Update the current-vs-target audit when fresh evidence changes the plan.
4. Distinguish three permissions in the tracker: migration plan, migration-file creation, and live application.
5. Use the migration ledger for every created/applied migration. DDL application requires exact-project readback and separate authorization.

## 6. Documentation update matrix

| Change made or discovered | Documents that must be updated in the same session |
| --- | --- |
| Product decision or scope | owning root DOC; owning domain SDD; planning decision tracker; requirements traceability; master SDD if cross-domain |
| Architecture/workflow/state | owning root DOC; master/domain SDD; traceability; implementation tracker; DOC-14 for commerce state changes |
| Schema/field/constraint/index | 01 Data or owning SDD; data dictionary; current-vs-target audit; migration ledger; implementation verification |
| RLS/grant/function/trigger/storage | 04 Security or owning SDD; current-vs-target audit; security verification matrix; migration ledger |
| Model/provider contract | 02 Pipeline; 04 Security where relevant; fixture/schema record; implementation log |
| Owner review/inventory behavior | DOC-3/DOC-4/DOC-8 as applicable; 03 Review; traceability; tests/evidence |
| Marketplace behavior | DOC-0/DOC-3/DOC-5; 05 Marketplace; traceability; public/private verification |
| Customer photo behavior | DOC-1/DOC-6/DOC-14; 04 Security; 06 Photo Request; traceability |
| Code/test completion | implementation tracker work-unit row, verification checklist, append-only log; master tracker milestone |
| Migration created/applied | migration ledger; implementation log; current-vs-target audit; master tracker; DOC-13 if milestone/risk changed |
| New decision/deviation/blocker | decision tracker or implementation log; owning SDD; master tracker; DOC-13 when globally material |
| Work-unit transition within Phase 9 | phase tracker; implementation tracker; DOC-13; Phase 9 README when routing/handoff changes |
| Active phase transition | phase tracker; implementation tracker; DOC-13; ACTIVE.md; repository AGENTS pointer; README/handoff files |

Updating only a tracker is insufficient when behavior, security, schema, or acceptance criteria changed.

## 7. During-session rules

- Work on one authorized work unit at a time unless the approved plan explicitly groups inseparable changes.
- Start deterministic behavior with failing tests/fixtures; model output uses schemas and recorded fixtures, not exact prose assertions.
- Preserve Phase 6 quantity/hold and controlled-write boundaries.
- Keep Phase 7/8 payment, paid-order, pickup, refund, ledger, and settlement behavior out of Phase 9.
- Do not infer migrations/tables/functions from target documentation; inspect local and live evidence.
- Record deviations immediately instead of waiting for session close.
- Keep the master tracker concise; detailed evidence belongs in its routed tracker.

## 8. Mandatory closeout transaction

Before ending a session with material work:

1. Update the active work-unit status and append the implementation/planning log entry.
2. Record exact files/components/migrations affected.
3. Record tests and security checks actually run, with counts/results where available.
4. Record Supabase project verification and every external mutation, or explicitly record none.
5. Update all documents required by the matrix above.
6. Set the tracker to one exact next authorized action and identify any blocker/approval needed.
7. Run [the continuity validator](./scripts/validate-phase9-continuity.ps1) and applicable code/test commands. On Windows systems with local script execution disabled, use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/validate-phase9-continuity.ps1"` from the repository root.
8. Run `git status --short` and `git diff --check`.
9. Tell the user what remains uncommitted and whether anything was staged, committed, pushed, deployed, or applied.

Implementation log entries use this shape:

```text
Date/session:
Authorized work unit and scope:
Completed:
Files/components/migrations:
Verification actually run:
Supabase/external mutations:
Decisions/deviations/risks:
Tracker/source-doc updates:
Next authorized action and gate:
```

## 9. Drift prevention

- One status fact has one owner: DOC-13 globally, TRACKER.md locally, implementation tracker for evidence.
- README and ACTIVE.md route; they do not replace trackers.
- SDDs own intended behavior; they do not claim implementation completion.
- Current-vs-target audit distinguishes observed live state from proposed state.
- Chat summaries are not copied into docs without checking the authoritative files and live evidence.
- Old generic root kickstart files are not Phase 9 status sources.
