# BookConnect Agent Continuity Contract

This file is the repository entrypoint for every new AI development or review session. Chat history and compacted conversation summaries are helpful context, but they are never the project source of truth.

## Mandatory session start

Before proposing, editing, migrating, or implementing:

1. Resolve the repository/worktree root, current branch, and `git status --short`. Preserve unrelated user changes.
2. Read [the marketplace active-phase router](./docs/multi-tenant-bookstore-marketplace/implementation/ACTIVE.md).
3. Read [DOC-13](./docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md) for global status, blockers, and the authoritative active phase.
4. Follow the ordered reading list in the active-phase router and its session-start document.
5. Inspect the relevant current code and migrations before assuming the documented target is already implemented.
6. State the current phase, completed milestone, active work unit, next authorized action, blockers, and database-mutation authority back to the user before acting.

If `ACTIVE.md`, DOC-13, and the active phase tracker disagree, stop implementation. Reconcile the documentation from evidence or ask the user when the conflict changes scope or authority.

## Authority hierarchy

For marketplace product behavior:

1. The user's current explicit decision.
2. Root marketplace source specifications (`DOC-0` through `DOC-16`).
3. The active phase master SDD.
4. The owning domain SDD.
5. Supporting data dictionaries, traceability, and audit documents.

For implementation status:

1. DOC-13 is the global status authority.
2. `implementation/ACTIVE.md` is the routing authority.
3. The active phase `TRACKER.md` is the local current-state/next-action authority.
4. Detailed phase trackers contain decision and implementation evidence.

Trackers may record status and evidence; they must not silently originate product behavior.

## Current marketplace session entry

Use [Phase 9 SESSION-START](./docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/SESSION-START.md). If DOC-13 later names another active phase, update `implementation/ACTIVE.md` and this pointer in the same documentation change.

## Authorization boundaries

- Planning approval does not authorize product implementation.
- Implementation approval does not automatically authorize migration creation.
- Migration-file creation does not authorize applying a migration to Supabase.
- A read-only database audit does not authorize database/storage writes.
- Never introduce behavior from deferred phases into the active phase.
- Do not stage, commit, push, deploy, or mutate external services unless the user requested that action or it is an explicit approved step in the current task.

## Database and Supabase rule

For any database, RLS, function, trigger, storage, bucket, migration, or tenant uncertainty:

1. Use Supabase MCP rather than memory or local migrations alone.
2. Re-verify the exact project before creating a migration plan and again before any application.
3. Treat server-derived `store_id` as authoritative for the marketplace unless a fresh verified schema and approved source-spec change say otherwise.
4. Record read-only evidence in the active current-vs-target audit or implementation log.
5. Record every future migration in the active migration ledger with local filename, live version, project verification, effects, and verification result.

## Documentation update contract

Every material change must update the files named by the active phase session-start update matrix. At minimum:

- update the local phase tracker for any work performed;
- update DOC-13 when phase/milestone/status/risk/blocker/next action changes;
- update the owning SDD and traceability when behavior or acceptance changes;
- update the data dictionary/current-vs-target audit for schema/storage decisions;
- update the implementation verification tracker with code, tests, migrations, rollout, or operational evidence;
- update `ACTIVE.md`, DOC-13, the phase tracker, and this file's current pointer together when the active phase changes.

Do not mark work complete from code existence alone. Required tests, security checks, migration readback, deviations, and handoff evidence must be recorded.

## Documentation size and structure

Documentation line count is a maintainability signal, not an acceptance
criterion. Correctness, completeness, cohesion, traceability, navigability, and
implementation usefulness take precedence over line count. Crossing 350 or 400
lines must not fail validation or cause content pruning. At approximately
400-500 lines, assess and record whether the document remains cohesive. Above
approximately 500 lines, validators may advise considering a semantic split,
but a cohesive file may remain longer when splitting would fragment authority.

Create supporting documents only around a stable semantic responsibility that
can be reviewed independently and is expected to grow; never create equal-sized
“parts” solely to satisfy a line target. Do not remove required behavior,
security or trust rules, accessibility requirements, recovery behavior, edge
cases, evidence, or acceptance criteria to shorten a document. Never change or
split an already-applied migration for line-count reasons.

## Mandatory session close

Before ending a session that changed files or external state:

1. Re-read the active tracker and record the exact completed scope.
2. Record verification actually run; never imply an unrun test passed.
3. Record database/storage mutations or explicitly state none.
4. Record new decisions, deviations, blockers, and residual risk in their owning documents.
5. Set one exact next authorized action and active work unit; do not leave vague “continue implementation” text.
6. Update DOC-13 if the global handoff changed.
7. Run the active phase documentation validator and relevant code/security tests.
8. Report uncommitted changes and whether anything was staged, committed, pushed, deployed, or applied.

## Superseded kickstart material

The root `DEVELOPMENT_SESSION_KICKSTART.md`, `KICKSTART_README.md`, `KICKSTART_EXTENDED_GUIDE.md`, and `SESSION_CHECKLIST.md` describe an older generic BookTalks workflow. They may be historical reference, but they are not status or sequencing authority for the marketplace. Follow this file, `implementation/ACTIVE.md`, DOC-13, and the active phase session protocol.
