# Phase 9 Development-Session Start and Handoff Protocol

**Status:** active continuity protocol
**Last updated:** 2026-07-19
**Applies to:** AI/human development sessions, not bookstore inventory-capture sessions

This is the deterministic resume procedure for Phase 9. A new session should recover the current state from files and verified systems, never from chat memory alone.

## 1. Canonical status source

Read [TRACKER.md](./TRACKER.md) first and extract these fields:

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
2. Read [DOC-13](../../DOC-13-implementation-tracker.md), [ACTIVE.md](../ACTIVE.md), and [TRACKER.md](./TRACKER.md).
3. Read [the master SDD](./00-phase-9-master-sdd.md), especially invariants, work-unit order, and continuity contract.
4. Read [the implementation tracker](./trackers/02-implementation-and-verification.md) to learn whether a work unit is authorized and what evidence already exists.
5. Use the work-unit routing table below to read only the relevant domain SDDs and supporting files.
6. Inspect current code/migrations/tests in the affected area. Planned target tables are not evidence that they exist.
7. For database/storage uncertainty, use Supabase MCP and verify the exact project before relying on results.
8. Give the user the resume brief below before editing or acting.

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
| 1 Data/metadata migration | 01 Data; 03 Review; 05 Marketplace | data dictionary, current-vs-target audit, migration ledger |
| 2 Session/job schema | 02 Pipeline; 03 Review; 04 Security | data dictionary, current-vs-target audit |
| 3 Media boundary | 04 Security; 02 Pipeline; 03 Review | data dictionary, live storage audit, DOC-1 |
| 4 Vision adapter | 02 Pipeline; 04 Security | fixture/schema requirements, complexity register |
| 5 Metadata/aliases | 01 Data; 02 Pipeline; 05 Marketplace | data dictionary, provider audit/fixtures |
| 6 Owner UX | 03 Review; 02 Pipeline | DOC-8, accessibility/verification matrix |
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
| Phase/work-unit transition | phase tracker; implementation tracker; DOC-13; ACTIVE.md; README/handoff files when phase changes |

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
