# Phase 9 Development-Session Start and Handoff Protocol

Current state and the exact next authorized action: see [ACTIVE.md](../ACTIVE.md).
Historical dated handoffs: [archive](../history/phase9-SESSION-START-history-to-2026-10-29.md).

## 1. Canonical status source

After repository `AGENTS.md`, read [ACTIVE.md](../ACTIVE.md) for the active phase,
completed milestone, active work unit, one exact next authorized action, mutation
authority, recorded live state, blockers and residual risks.

DOC-13 owns cross-phase/global status. [TRACKER.md](./TRACKER.md) and numbered
trackers own local decision and implementation evidence. Read only evidence
needed for the authorized task; archives are historical and are not startup reading.
The Owner-approved 2026-10-30 consolidation supersedes older status-routing
wording; product requirements and authorization boundaries are unchanged.
If sources disagree, reconcile from the newest evidence before implementation;
ask the Owner when the conflict changes scope or authority.

## 2. Mandatory startup sequence

1. Run `git branch --show-current`, `git rev-parse --show-toplevel`, and `git status --short`.
2. Read repository [`AGENTS.md`](../../../../AGENTS.md).
3. Read [`implementation/ACTIVE.md`](../ACTIVE.md).
4. Read [DOC-13](../../DOC-13-implementation-tracker.md).
5. Read this protocol; use [TRACKER.md](./TRACKER.md) only to locate relevant evidence.
6. Read [the master SDD](./00-phase-9-master-sdd.md), especially invariants, work-unit order, and continuity contract.
7. When implementation is authorized, read the relevant entry in [the implementation tracker](./trackers/02-implementation-and-verification.md).
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
| 6G Owner defaults/batch review/commit handoff | [Unit 6G SDD](./work-units/06g-owner-scan-defaults-batch-review-commit-handoff-sdd.md); [Unit 6G matrix](./work-units/06g-owner-scan-defaults-batch-review-contract-matrix.md); Unit 6; Unit 7A; Unit 7C; 00 Master; 02 Pipeline; 03 Review | P9-D81–P9-D85; DOC-3/4/8; [tracker 31](./trackers/31-unit6g-owner-batch-review-design-evidence.md); data dictionary; current-vs-target audit; traceability; complexity register; current capture/review/commit/Store View code and M02/M29/M35/M39/M43 |
| WU1/WU2 Owner inventory read boundary/client | [WU1](./work-units/owner-inventory-read-boundary-wu1-sdd.md); [WU2](./work-units/owner-inventory-read-client-wu2-sdd.md); 00 Master; 03 Review | [tracker 25](./trackers/25-owner-inventory-read-boundary-wu1-evidence.md), [tracker 26](./trackers/26-owner-inventory-read-client-wu2-evidence.md), DOC-8 §5, current-vs-target audit, requirements traceability |
| 7A Create-only private inventory commit | [Unit 7A SDD](./work-units/07a-create-only-inventory-commit-sdd.md); 00 Master; 01 Data; 03 Review | Unit 6 SDD/contract transition, DOC-3/4/8, quantity/hold invariants, current-vs-target audit, traceability |
| 7B Publication/projection | 03 Review; 05 Marketplace | private/public projection and current trigger audit; separately authorized after 7A |
| 7C Owner Store View/post-commit management | [Unit 7C SDD](./work-units/07c-owner-store-view-post-commit-inventory-management-sdd.md); [Unit 7B SDD](./work-units/07b-publication-sdd.md); 00 Master; 01 Data; 03 Review; 04 Security; 05 Marketplace | DOC-3/4/5/8; Unit 7A; current trigger/RPC/media code and migrations; current-vs-target audit; traceability; implementation tracker |
| 8 Marketplace | [Unit 8 bookstore-first SDD](./work-units/08-marketplace-bookstore-first-sdd.md); 05 Marketplace; 01 Data | DOC-0, DOC-3, DOC-5, Unit 5C, Units 7A/7B/7C, WU0B Q07-Q10, public/private tests |
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
| Work-unit transition within Phase 9 | rewrite ACTIVE.md current state; phase/implementation tracker evidence; DOC-13 only for global phase/milestone/risk/blocker changes; README only when routing changes |
| Active phase transition | phase tracker; implementation tracker; DOC-13; ACTIVE.md; repository AGENTS pointer; README/handoff files |

Updating only a tracker is insufficient when behavior, security, schema, or acceptance criteria changed.
Keep each dated record in its owning evidence log; link to it instead of copying status paragraphs into DOC-13, SESSION-START, TRACKER and ACTIVE.

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
6. Rewrite ACTIVE.md with the current milestone, work unit, one exact next authorized action, live-state references, mutation authority, blockers and residual risks. Preserve dated evidence in its owning log; do not append the same handoff to four files.
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

- One status fact has one owner: DOC-13 globally, ACTIVE.md for the current work unit/action/gates, and the owning tracker for dated evidence.
- SESSION-START owns protocol; README routes; archives preserve history. Read evidence when needed and keep current state in ACTIVE.md.
- SDDs own intended behavior; they do not claim implementation completion.
- Current-vs-target audit distinguishes observed live state from proposed state.
- Chat summaries are not copied into docs without checking the authoritative files and live evidence.
- Old generic root kickstart files are not Phase 9 status sources.
