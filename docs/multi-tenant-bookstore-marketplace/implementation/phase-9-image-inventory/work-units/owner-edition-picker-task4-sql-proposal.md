# Task 4 controlled SQL boundary proposal

## 2026-10-08 - Timestamp correction after Owner-requested self-review

The Owner authorized the remaining normalized-timestamp fix. Section 3 step 6 now requires complete ISO calendar timestamp syntax, valid clock ranges and timezone, independently of PostgreSQL cast permissiveness. No public signature, schema, permission, selection or scheduling change was added. New direct-RPC cases reject era/ordinal dates and leap seconds on both row kinds, and retain valid UTC/offset values.

Local proof: 264 Jest, 87 completion/worker SQL, 14 structural, strict graph/bootstrap types and worker build PASS. M68's current hash and preserved M65-M67 hashes are recorded in the [implementation ledger](../trackers/02-implementation-and-verification.md#2026-10-08---task-4-timestamp-self-review-correction). Owner-requested self-review is complete; independent correction approval is not claimed. M65-M68 remain NOT_APPLIED; Task 5 and live rollout need separate Owner authorization. Earlier checkpoint evidence is historical.


**Date:** 2026-10-08 (Task 4 corrections; original authorization 2026-10-07)
**Status:** AUTHORISED / CORRECTED_LOCAL / NOT_APPLIED; Owner-requested self-review complete
**Scope:** edition-picker Task 4 only; picker SDD §§4.1-4.3/5/8-9, DOC-4 §§8/12-13 and Master MAS-02/03/12/17.
**Authority:** Owner "sure lease proceed" separately authorized the one forward local migration and disposable SQL tests. M68 and its concrete typed port are implemented/verified locally. No live application, DB/Storage/provider, browser/deployed worker, deployment or Git publication is authorized. The transaction plan records the reviewed contract; actual verification/readback is in the implementation evidence.

## 1. Verified gap and safe current behavior

Fresh read-only Supabase MCP verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, ACTIVE_HEALTHY, PostgreSQL 17.6.1.063, ap-southeast-2. Fresh correction readback: latest Phase 9 is M62 / 20260913162154, while latest overall is unrelated clubs_admin_primary_venue / 20261007144356. No picker migrations/private state/completion RPC are live. M65-M67 remain local and NOT_APPLIED; their bytes were preserved in Task 4.

M65 supplies the private row/schema and expiry-aware choices reader. M66 supplies request/select commands and slim receipts. M67 supplies explicit candidate/context admission, lookup-scoped uniqueness and identity/revision fences. None provides controlled options completion/recovery/failure. The public M38 context wrapper still upgrades M67's internal v1 response to v2 and adds currentPhysicalClaimAttempt; replacing that wrapper is unnecessary.

Live definitions and local forward artifacts show remaining automatic assumptions:
- phase9_register_structural_metadata_lookup compares against the observed automatic query identity.
- phase9_register_metadata_provider_call and phase9_finalize_metadata_provider_call include processing-state assumptions.
- phase9_fail_metadata_job requires processing state, inserts an automatic selected-metadata snapshot and changes the candidate. That behavior cannot complete/fail an explicit lookup on an unfinished reviewed card.
- Existing provider-call finalization/reconciliation must still protect claim/physical identity and record bounded spend evidence when results cannot be accepted.

The concrete metadataEditionOptionsRpc.ts port calls the three service-only M68 operations and is installed in local bootstrap. Production still has no retention verifier; it cannot retain options or infer permission from policy flags/headers. Corrected Task 4 passes 264 Jest, 14 structural DB and 87 completion/worker SQL cases, strict graph/bootstrap types and worker build. The earlier 48 existing picker SQL cases were not rerun for this narrow timestamp correction. This is local implementation proof; live application/enablement remain gated.

## 2. Authorized forward local migration

After exact-project/tail and worktree reservation preflight, M68 was created as 20261007000068_marketplace_phase9_edition_picker_worker_completion.sql. M65-M67 hashes are unchanged; no applied SQL was edited. Main-checkout Unit 6I/M63-M64 remain separate.

Use existing relations and indexes; M68 correction adds one nullable bounded private failure_receipt to the existing per-card state for exact failure replay. Add three service-only controlled operations, with postgres-owned, empty-search_path privileged helpers and explicit deny-by-default grants. These names/signatures are implemented locally in M68 and used by the concrete port:

| Public operation | Parameters | Result |
| --- | --- | --- |
| phase9_recover_candidate_edition_options_v1 | Existing claim quartet: job UUID, worker text, lease-token text, attempt integer; candidate/store/session UUIDs; request UUID; request generation integer; query identity text | missing or stale_rejected; otherwise replayed + requestId/requestGeneration/optionsVersion/optionsExpiresAt. No rows. |
| phase9_complete_candidate_edition_options_v1 | Same fence; lookup/attempt UUIDs; original fetched timestamptz; permitted deadline timestamptz; verified-retention boolean; bounded normalized rows JSONB | completed/replayed/stale_rejected with the same slim receipt. |
| phase9_fail_candidate_edition_options_v1 | Same fence; bounded normalized failure kind; retryable boolean | Existing retry_scheduled/resolved/dead_letter or exact replay job status; stale authority is rejected. No metadata payload. |

The concrete SQL port parameters map exactly to EditionOptionsFence/EditionOptionsCompletionInput in metadataEditionOptionsBoundary.ts. Client-supplied tenant/metadata/selling fields cannot enter these service-only operations.

## 3. Completion transaction, in order

1. Check service role, non-null bounded arguments, worker/token syntax and attempt 1..5. Resolve the authoritative store/candidate/session from the claimed job, not from the supplied UUIDs alone.
2. Lock the job, then its candidate, then that card's phase9_candidate_edition_state in the same established order. Validate current lease owner/hash/deadline, attempt, candidate job membership, p9-owner-edition-options-v1 purpose, initiating Owner's active capability, mutable/resumable session and eligible uncommitted/nonremoved/nonexpired card.
3. Require state.request_id = job.id = supplied request; exact request_generation and query_identity; recompute current explicit query identity through the existing M65/M67 helper. A selling edit or newer Owner selection must not invalidate this unchanged query generation or be overwritten. Candidate version alone is not the explicit bibliographic fence.
4. Prove lookup/attempt/store/card/job links, current claim lineage and finalized physical-call evidence for that logical attempt. Reject stale/reclaimed/cancelled authority. Preserve billing/finalization history independently of option acceptance.
5. Require verified server retention evidence and currently allowed provider policy. An internal boolean is not independent permission; production must not retain options until a real verifier exists. Reject missing/invalid/exhausted deadlines and future fetch times. Cap expiry to the earlier permitted deadline or original fetch + 24 hours; never extend it on replay/read.
6. Validate the exact normalized row allowlist with M65's safe-shape helpers and M68's stricter normalized validator on every non-null eligible/ineligible metadata row: array <=10; original ordinals 0..9; unique opaque option UUIDs; same-record safe links/cover; valid normalized metadata or unavailable/null placeholder; adapter, correlation/attempt and original-fetch provenance. Preserve order, repeated provider IDs, eligibility and certainty evidence. Require pinned p9-contract-v1/p9-metadata-v1, TypeScript UTF-16 field/array limits (matchRationale 512, normalizerVersion 64), complete ISO calendar fetchedAt with valid clock ranges and timezone and valid/coherent ISBN field shapes/checksums. Treat und as an absent language clue only for otherwise compatible exact validated ISBN; preserve supplied title/author/known-language checks. Never copy an automatic/cache/other-card payload.
7. Exact replay with a still-fresh matching source returns the saved receipt without increasing options_version, rewriting rows, changing selection or issuing provider calls. Conflicting replay fails. Expired or post-commit results never become ready or return alternatives from an idempotency receipt.
8. For a new valid completion, update only options_version (+1 once), options, source_lookup_id/source_attempt_id/source_fetched_at/options_expires_at and operational timestamp. Empty results are valid saved sets with a future deadline and positive options_version.
9. Complete the explicit logical attempt/lookup under existing normalized outcomes/constraints, with no alternative payload in attempts/cache/receipts/logs, then resolve the claimed job and release its lease. Do not touch automatic snapshots, selected_option_snapshot, selection IDs, owner_review_snapshot, selling values, candidate state, metadata/review versions or inventory.
10. Return ready only after the transaction commits. A lost response is recoverable through the expiry-aware reader/exact replay; failed persistence is never reported available.

## 4. Recovery and failure transactions

Recovery reuses the same authority/query/source checks and proves the stored set's permitted deadline is still valid. It returns a slim receipt including fresh empty sets, never option rows. Alternatives are retrieved only by the existing expiry-aware Owner choices reader. If a provider response was finalized but no set was saved, expose a retryable failure; do not claim those lost rows are recoverable from billing evidence or copy them into a historical audit payload.

Failure must branch by operation purpose before the legacy automatic path. Reuse bounded attempt/retry limits and existing backoff. A current retryable 429/network/provider failure schedules the same logical operation's next claim. A later physical retry gets a separate provider-call identity/evidence; ten returned rows still count as one response/request. Same-claim replay of finalized physical evidence cannot authorize another call.

The same failure transaction stores a nullable private failure_receipt object <=1024 bytes in the existing per-card state. Its exact generated fields are requestId, requestGeneration, queryHash, worker, leaseTokenHash, claimAttempt, failureKind and retryable. It contains hashes rather than query text/plaintext token, no provider metadata and no job status. On replay, existing job status remains authoritative; current actor/store/session/card/request/generation/query and current job attempt must still agree. Exact worker/hashed-token claim evidence admits replay after lease release, including retry_scheduled and failures without a provider lookup. Changed failure arguments reject P9_IDEMPOTENCY_MISMATCH; reclaimed claims reject P9_STATE_CONFLICT. This evidence cannot authorize successful completion/recovery or new provider egress.

P9_EDITION_ROWS_INVALID is propagated as a safe bounded code through the concrete completion RPC. After trying committed-receipt recovery, the worker classifies it as nonretryable schema_invalid; other RPC details remain opaque and transient persistence/transport failures retain their retry path.
A terminal explicit failure marks its job/lookup/attempt and stores only the private replay receipt described above. It preserves current selection, selling details, automatic snapshot and any still-valid options. Exact completed-job replay must not regress a saved successful set. Stale identity/generation/Owner/session/lease/removal/Add checks reject transition, while existing physical-call reconciliation preserves auditable actual spend. No job status mirror, new counter, attempt-history deletion or sequence inflation is introduced.

## 5. Existing SQL functions needing purpose-aware branches

Preserve the automatic branch byte-for-byte where possible and prove its regressions with the existing structural harness.

| Existing helper | Required explicit branch |
| --- | --- |
| phase9_register_structural_metadata_lookup | Validate M65 explicit query identity and request/generation; forbid automatic local/cache/coalescing satisfaction or a cross-card leader for this purpose. |
| phase9_register_structural_metadata_attempt | Ensure the existing lookup-scoped uniqueness and query/generation authority apply to the explicit request; preserve automatic/legacy histories and provider-attempt identity uniqueness. |
| phase9_reserve_metadata_usage | Retain provider/store/global policy/usage fences for the claimed explicit operation and its current policy version. |
| phase9_register_metadata_provider_call | Admit only a valid explicit claim on ready/needs_review/possible_duplicate; preserve physical identity, reservation, attempt and quota linkage. |
| phase9_finalize_metadata_provider_call / phase9_reconcile_metadata_provider_call | Remove the processing-only acceptance assumption for explicit jobs, enforce request/generation and current authority, reject stale result acceptance and preserve spend reconciliation. Explicit normalized_candidate/match_evidence contain no alternative payload. |
| phase9_fail_metadata_job | Delegate an explicit operation to the controlled explicit failure implementation or reject it; never run its automatic snapshot/candidate mutation path. |

The M38 public v2 wrapper stays intact. No automatic alternatives capture, cross-card copying, Add/lifecycle cleanup, manual edition edit, UI, new provider, migration application or rollout is included.

## 6. Local verification plan and outcome

The following cases were exercised through database RED/GREEN before local closeout:
- End-to-end enqueue -> context -> usage/logical attempt -> physical registration -> completion -> choices read, including ten ordered/duplicate/unavailable/ineligible records and retained certainty.
- Atomic options/job completion; failure before commit; response loss/replay; fresh empty reuse; slim receipts; original deadline/24-hour cap.
- Automatic -> explicit -> expiry -> separately requested fresh explicit operation, preserving history and operation-scoped uniqueness.
- 429/same-claim replay/later claim retry with separate actual physical requests and quota lineage.
- Initiating Owner/store/session/card, permission, request/generation/query, removal/Add, cancellation and stale lease/attempt denials before egress and acceptance.
- Newer selection and selling/version changes survive completion; automatic winner/cache/coalescing never write/copy options.
- Grants/RLS/direct-write denial and full automatic structural/provider regressions.

Recorded fixtures/disposable databases pass 34 completion/security + 7 worker-to-SQL + 36 correction cases (77 total), 14 automatic structural regressions and 48 existing picker cases. The RPC suite passes 18; the affected Jest command passes 264. The final typed recovery test rerun passes 14. Strict graph/bootstrap types and worker build pass. Real races remain Task 8. The concrete port is installed; production retention remains denied without a verifier. Task 4 stops at correction review; Task 5 is unstarted. [Evidence](../trackers/02-implementation-and-verification.md#2026-10-08---edition-picker-task-4-review-corrections) records RED/GREEN/readback and the two CHANGES_REQUIRED verdicts; local fixes await independent correction approval.

## 7. Owner authority and migration ledger

Owner "sure lease proceed" authorized the single forward local migration and disposable SQL tests in this edition-picker worktree. That work is locally verified. Next action: independently review the corrected Task 4 diff/evidence. No live application, DB/Storage/provider/browser/deployed-worker action, deployment or Git publication is authorized.

| Artifact | Local filename | Live version | Project verification | Effect / verification |
| --- | --- | --- | --- | --- |
| Task 4 forward completion/failure/egress | 20261007000068_marketplace_phase9_edition_picker_worker_completion.sql | NOT_APPLIED | Read-only MCP: ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo / ACTIVE_HEALTHY, Phase 9 M62, overall 20261007144356 | CORRECTED_LOCAL; bounded private failure receipt, normalized validation and exact replay; 77 completion/worker + 14 structural + 48 existing picker cases PASS; ownership/search_path/ACL readback PASS. |
| Existing M65-M67 | Existing filenames unchanged | NOT_APPLIED | Same read-only evidence | Task 4 preserves bytes; prior Task 2 local SQL proof is reused, not rerun as new completion proof. |
