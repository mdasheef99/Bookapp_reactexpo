# Package 8a-5 implementation plan

**Initial plan retained as history.** Its checked items did not establish readiness. The Owner-authorized reassessment and exact correction proof are in [tracker 39](../../trackers/39-package8a5-contract-review.md). Whole-round capacity is now Owner-approved; final native/correction review gates remain explicit.

**Goal:** Create one local forward migration for queue/protection; do not apply it.
**Spec:** 02c §§4.3–4.4, 7, 9; 02c-1 §2; OD-2026-10-31-4/6.
**Architecture:** Retain the existing Postgres job queue, old claim entry and
physical-call identities. Add service-only v2 fair claims, a private automatic
round ledger and paused-admission deferral. Single-instance pacing/breaker
enforcement belongs to the 8b worker, as approved; no shared permit service.
**Operating values:** Read the existing validated registry protection policy.
Leave it NULL in this migration; test-only policy values are not rollout values.

## Files and interfaces

- M93 `20261101000093_marketplace_phase9_provider_queue_protection.sql`:
  private `phase9_store_admission`, `phase9_automatic_provider_runs`,
  `phase9_job_admission_wait` and ticket sequence.
- New service entries: `phase9_claim_metadata_jobs_v2(integer,text)`,
  `phase9_defer_metadata_admission_v1(jsonb,bigint)`,
  `phase9_begin_automatic_provider_run_v1(jsonb,text,text)`,
  `phase9_finish_automatic_provider_run_v1(jsonb,text,text)`.
  Begin/finish consume the existing AutoFence. Defer also accepts the existing
  explicit fence with requestId instead of capturedRequestId/candidateVersion.
- Physical INSERT guard: only a run explicitly opened through the new entry
  opts an automatic job into round fencing. Configured capacity applies at new
  physical grants, never replays. Existing NULL-policy/legacy paths stay intact.
- Tests: `phase9ProviderQueue.integration.test.mjs`, using the existing
  disposable prefix harness. Register M93 under 8a-5 after RED evidence.
- Update owning evidence, ledger/dictionary, ACTIVE, migration-set guard and map.

## Execution and verification

- [x] Prove missing queue/run/deferral entries RED on prefix 8a-4.
- [x] Implement private ACL/RLS and fair claims: one due head per store, ticket
  order, admission-row then job SKIP LOCKED, five claims, unchanged tuple.
- [x] Implement session-first scope/lease fencing and paused-epoch deferral;
  any lookup/reservation/call returns drain_required; no-spend deferral excludes
  that epoch and restores the unused claim so repeated pauses cannot exhaust it.
- [x] Implement one round-0 plus one round-1 allowance, source-derived physical
  failure evidence, new claim/token only, immutable call accounting, unknown
  result recovery only, registry-driven capacity window with durable due time.
- [x] Verify ACLs, forged/stale fences, fairness, repeated retry, unknown send,
  capacity/pause no-spend behavior, legacy controls and golden preservation.
- [x] Run native independent-connection fairness/locking checks and the provider
  prefix suite; report unrun worker/operational gates explicitly.
- [x] Run continuity and migration-set negative checks, record evidence and stop.

## Review focus

Null/unknown JSON must refuse; supplied store IDs never grant authority; paused
jobs with orphan obligations must drain; same-claim/reclaimed unknown sends must
not acquire a new round; locked/backlogged stores must not monopolize claims.
No worker, provider activation, prefill, shared DB write, commit or push is part
of this file-creation task. Existing migrations and golden baselines stay intact.
