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

Current handoff as of 2026-08-07:

- Phase 6 is `complete_e2e_deferred`; its migrations M01-M39 and provider-independent `payment_ready` boundary are applied/verified in the development project.
- Phases 7 Payment/Ledger/Settlement and 8 Pickup are deferred.
- Phase 9 Image-to-LLM Inventory has progressed beyond the historical Unit 5C
  Batch 1 handoff. WU2 is locally complete, Unit 6F remains open, and Unit 7 is
  gated. The next authorized action is a read-only vertical integration audit
  under existing Unit 4B/5A/5B authority; it authorizes no implementation,
  provider call, deployment, scheduler, database/Storage mutation, or
  inventory/publication behavior.
- The active set is [`phase-9-image-inventory/`](./phase-9-image-inventory/README.md);
  each component is implemented only at the level recorded by its tracker.
- The current runtime uses one selected language per `spine_stack` and a maximum
  of 15 books/image. The approved
  [Unit 5C Lite target](./phase-9-image-inventory/work-units/05c-lite-multilingual-search-variants-sdd.md)
  supersedes that language method with per-field auto-detection and optional
  hints while keeping original-language title and author primary. The former
  three-English-alias target is likewise superseded by an optional bounded
  proposal sidecar and store-scoped active-only reconciliation. Unit 5C-1 is
  merged; Unit 5C-2 persists validated proposals privately as proposed and
  non-searchable through live M18. Generation, activation, search/UI, and later
  Unit 5C Lite behavior remain unimplemented.
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
