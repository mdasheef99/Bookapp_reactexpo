# Implementation Phase Trackers

This folder tracks implementation progress for the multi-tenant bookstore marketplace.

These files are not source specifications. Source behavior lives in `DOC-0` through `DOC-16`. These phase trackers record what has been implemented, verified, blocked, deferred, or changed.

## New Agent Procedure

If you are a new agent, do this before changing files:

1. Read [`../README.md`](../README.md) for the suite overview and stable guardrails.
2. Read [`../DOC-13-implementation-tracker.md`](../DOC-13-implementation-tracker.md) for the current phase, blockers, latest handoff, and next recommended task.
3. Read the active phase tracker in this folder.
4. Read [`../DOC-12-build-strategy-and-implementation-sequence.md`](../DOC-12-build-strategy-and-implementation-sequence.md) for phase order, risk gates, and coding-agent rules.
5. Read the source docs referenced by the active phase tracker.

Current handoff as of 2026-06-24:

- Phase 1 foundation schema/security migrations are applied to the live Supabase project and refreshed through Supabase MCP.
- Phase 2 Store Onboarding and Verification is the active planning target.
- Store Owner routes, onboarding screens, and platform review UI have not been implemented yet.
- The live private seller document bucket is `seller-verification-docs`.
- The next expected work is review of a Phase 2 implementation plan before feature coding.
- Do not build inventory, orders, payments, delivery, or image-to-LLM workflows until their later phase trackers are active.

## Before Coding

Read:

1. [`../README.md`](../README.md)
2. [`../DOC-13-implementation-tracker.md`](../DOC-13-implementation-tracker.md)
3. the active phase tracker in this folder
4. [`../DOC-12-build-strategy-and-implementation-sequence.md`](../DOC-12-build-strategy-and-implementation-sequence.md)
5. the source docs referenced by the active phase tracker

Before schema, RLS, storage, or migration work, use Supabase MCP to verify live database state.

Before choosing app files or architecture, inspect the current codebase rather than relying only on the docs.

## After Coding

Update:

1. the active phase tracker
2. `../DOC-13-implementation-tracker.md` if phase status, blockers, risks, latest milestone, next task, or handoff changed
3. the relevant source spec only if product or architecture behavior changed

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
