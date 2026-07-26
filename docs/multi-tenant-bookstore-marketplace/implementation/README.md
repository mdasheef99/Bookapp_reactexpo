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

Current handoff as of 2026-07-27:

- Phase 6 is `complete_e2e_deferred`; its migrations M01-M39 and provider-independent `payment_ready` boundary are applied/verified in the development project.
- Phases 7 Payment/Ledger/Settlement and 8 Pickup are deferred.
- Phase 9 Image-to-LLM Inventory has M01-M08/M10/M11/M12 live-verified on `ahntbtktjjmvfosgkmgn`; M09 remains absent.
- The active set is [`phase-9-image-inventory/`](./phase-9-image-inventory/README.md). Unit 4A deployment scaffolding is integrated and locally/cloud verified, but Owner ingestion, sanitation-worker, and fixture vision-worker services remain undeployed.
- Phase 9 is same-language `spine_stack` first (maximum 15), not `single_cover` first, and remains independent of deferred Phase 7/8 behavior.
- No service secrets or real multimodal/metadata provider credentials are configured. Ordered service deployment and live fixture-path verification are the next separately authorized work unit.
- Supabase was re-verified read-only at M11/M12 closeout as `ahntbtktjjmvfosgkmgn` / `Bookconnect_reactexpo`; re-verify again before any further migration or deployment action.

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
