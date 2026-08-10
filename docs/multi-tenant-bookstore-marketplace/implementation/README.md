# Implementation Phase Trackers

This folder tracks implementation progress for the multi-tenant bookstore marketplace.

These files are not source specifications. Source behavior lives in `DOC-0` through `DOC-16`. These phase trackers record what has been implemented, verified, blocked, deferred, or changed.

## New Agent Procedure

If you are a new agent, do this before changing files:

1. Read repository [`AGENTS.md`](../../../AGENTS.md).
2. Read [`ACTIVE.md`](./ACTIVE.md); it is the only active-phase routing file.
3. Read [`../DOC-13-implementation-tracker.md`](../DOC-13-implementation-tracker.md) for global status and confirm it agrees with the router.
4. Follow the active phase session-start file and master tracker.
5. Read [`../README.md`](../README.md) and [`../DOC-12-build-strategy-and-implementation-sequence.md`](../DOC-12-build-strategy-and-implementation-sequence.md) for stable guardrails and phase gates.
6. Read the source/domain documents routed for the active work unit and inspect current code/live evidence before acting.

Current handoff as of 2026-08-10:

- Phase 6 is `complete_e2e_deferred`; its migrations M01-M39 and provider-independent `payment_ready` boundary are applied/verified in the development project.
- Phases 7 Payment/Ledger/Settlement and 8 Pickup are deferred.
- Phase 9 Image-to-LLM Inventory is in the Git-only Unit 6 pre-main
  reconciliation recorded by tracker 28. M01-M35 are live at their recorded
  levels, M36 is reviewed local code and remains unapplied, and the complete
  current ingestion source is being packaged and verified for controlled
  publication to `main`. Supabase, Vault, Cron, Render, worker/provider,
  Storage, live-image, duplicate-replay, Unit 7, inventory, listing, and
  publication mutations are not authorized.
- The active set is [`phase-9-image-inventory/`](./phase-9-image-inventory/README.md);
  each component is implemented only at the level recorded by its tracker.
- The current runtime treats the selected session language only as a
  non-authoritative hint, records per-observation detected language, and keeps
  the 15-books/image maximum. The compact Gemini contract preserves
  original-language title and author as primary and permits bounded optional
  Romanization/English-title enrichment. The former three-English-alias and
  giant nested-sidecar targets are superseded. Validated enrichment maps into
  the existing M18/M19 private proposal envelope; activation remains
  field-specific, store-scoped, and reconciliation-controlled.
- Owner review, the future Unit 5B Roman-query extension, inventory,
  publication, and commerce remain separate. Public publication still requires
  a positive selling price; price-on-request is excluded from Unit 5C Lite.
- Phase 9 remains independent of deferred Phase 7/8 behavior. Re-verify the
  exact Supabase project before any future migration or deployment action.

## Before Coding

Read:

1. [`../../../AGENTS.md`](../../../AGENTS.md)
2. [`ACTIVE.md`](./ACTIVE.md)
3. [`../DOC-13-implementation-tracker.md`](../DOC-13-implementation-tracker.md)
4. the active phase session-start file and tracker
5. [`../README.md`](../README.md)
6. [`../DOC-12-build-strategy-and-implementation-sequence.md`](../DOC-12-build-strategy-and-implementation-sequence.md)
7. the source/domain docs routed for the active work unit

Before schema, RLS, storage, or migration work, use Supabase MCP to verify live database state.

Before choosing app files or architecture, inspect the current codebase rather than relying only on the docs.

## After Coding

Update:

1. the active phase tracker
2. `../DOC-13-implementation-tracker.md` if phase status, blockers, risks, latest milestone, next task, or handoff changed
3. the active implementation/verification log with tests, migrations, external effects, and exact next action
4. every source/SDD/data/security/traceability document required by the active session-start update matrix
5. `ACTIVE.md`, both README handoffs, DOC-13, and repository `AGENTS.md` together if the active phase changed

Do not mark a phase `complete` unless acceptance criteria, verification evidence, deviations, and handoff notes are recorded.

Status values:

| Status | Meaning |
|---|---|
| `not_started` | No implementation work started. |
| `in_progress` | Work is actively underway. |
| `blocked` | Work cannot continue without a decision, dependency, or fix. |
| `needs_review` | Work is ready for review but not accepted. |
| `complete` | Acceptance criteria, tests, and handoff are documented. |
| `deferred` | Intentionally postponed. |

Task markers:

```text
[ ] not started
[/] in progress
[!] blocked
[x] complete
[-] deferred
```
