# Package 8b worker evidence (slice 8, local commits; M94 not applied)

## Scope and authority

- Phase 9 slice 8, package 8b (automatic worker and provider-replacement execution), built as local commits `db5434f..02a0f34` on branch `phase9/slice8-providers`. Nothing is pushed, deployed or applied.
- Owner authority covers the 8b build and local commits only. Applying M94, pushing, deploying the 8b worker, live smoke and the check/recover of job `4ffe137d` each need separate Owner approval (see Next authorized actions).
- This record was written by a documentation-only pass on 2026-11-04. That pass ran no code, git, Supabase, Storage, Render or network action. Verification figures below are copied from commit messages and from the orchestrator's B2 re-run as reported; the documentation pass did not re-run them.

## Unit list

| Commit | Unit | Summary (from commit message) |
|---|---|---|
| `d8477b5` | Package 4 | Provider-replacement tests first; tests, fixtures and test support only. |
| `8e47515` | U1 | Provider descriptor and strict result v2. |
| `fb97eea` | U2 | Registry parser and installed-descriptor route. |
| `3c326ab` | Package 4 fix 6 | Fix from the Luna review. |
| `2c3df38` | U3 | Provider-neutral boot and environment. |
| `72357e5` | U3 README | Correction to the U3 README note on Open Library transport limits. |
| `6a6290e` | U3 | Open Library policy bound only from an edition-eligible row. |
| `9fd60d2` | U4 | Open Library 2.0.0 adapter and publisher signal. |
| `a52f2be` | U6 | Provider HTTP port, protection and explicit execution. |
| `8d93685` | U5 step A | M94 migration file plus tests (NOT applied). |
| `620160b` | U5 step B1 | Automatic fence, preparation and completion boundaries. |
| `02a0f34` | U5 step B2 | Automatic worker execution wiring, plus review fix round 1. |

Totals for `db5434f..02a0f34`: 85 files, +16964/-684 (from `git diff --numstat`). The per-unit file counts are not recorded.

## Per-unit summary (from commit messages)

- **d8477b5, package 4.** Tests, fixtures and test support for provider replacement, written before the implementation. Trusted invocation context via the `providerModules` seam, M91-valid stage sequences, UUID lineage on 8b paths, command-derived M92/M93 receipts, a shared descriptor GET observer, and frozen runbook golden fields. A narrow legacy-composition availability gate was added. The commit records 58 intended reds owned by U2-U6, with controls 221/221 green.
- **8e47515, U1.** Installed provider descriptors, a `p9-metadata-result-v2` validator bound to trusted invocation context, a provider-owned validation port, and the Google automatic and explicit wrappers. An early explicit-only Open Library v1 descriptor was added; its parity is unproven and is owned by U4/U6. Wrapper suite 19/19.
- **fb97eea, U2.** Strict parser for `phase9_provider_configuration_v1` (bounds cited to M01/M89 SQL), a resolver bound to exact key@version and contract tuple, and a routed worker path used only when an installed manifest is supplied. Jobs with persisted lookup, attempt or physical evidence get receipt-first recovery and never route fresh.
- **3c326ab, package 4 fix 6.** Breaker cases use distinct M91-valid claim identities; legacy-export availability gate removed with pre-8b controls re-expressed through the worker seam; three `it.todo` entries for mocked shapes the worker cannot produce; provider retry runs only on reachable M93 states.
- **2c3df38, U3.** `PHASE9_METADATA_PROVIDER_MODE` = `fixture | real | google_books`. `real` can boot keyless (Open Library only, no Google egress). The legacy `google_books` alias keeps its meaning and requires the complete Google set. No new environment variable names. Installed descriptor manifest keyed from descriptor versions; all-or-none Google guard; Open Library-only operational defaults.
- **72357e5, U3 README.** README correction on the Open Library transport limits.
- **6a6290e, U3.** `bindVerifiedRegistryPolicy` now also requires matching, storage, explicit-search and explicit-role eligibility and a version-contract tuple matching the installed OL v1 descriptor. Behaviour-neutral hardening: the resolver already refused such rows.
- **9fd60d2, U4.** Shared Open Library fetch and normalize engine, the v1 adapter (golden-equivalent), and a port-only Open Library 2.0.0 descriptor that egresses only through `input.http`. SDD 5.2 publisher signal as a tie-break only. `open_library@2.0.0` is installed unbound in both manifests; the 8b registry never elects it.
- **a52f2be, U6.** `ProviderHttpPort` (fenced registration and finalization per GET), registry-derived provider protection (paced start permits and a breaker with half-open probe), the Open Library v1 bridge, and descriptor-driven explicit edition-options execution with a secondary route. Automatic execution stays with U5.
- **8d93685, U5 step A.** M94 (local file only, not applied): a lease-fenced automatic edition fence reader and an atomic automatic metadata preparation RPC (admission plus M32-compatible coalescing election). M15, M32, M67 and M93 unchanged.
- **620160b, U5 step B1.** Strict decoders and RPC boundaries for the M94 fence read and atomic preparation; the M93 automatic completion and recovery boundary; invocation-scoped Google HTTP observation with Retry-After capture; and an opt-in physical-only `automatic_transaction` finalization mode. Not yet wired into the worker.
- **02a0f34, U5 step B2.** Wires the worker's automatic purpose through the M94 fence, M94 prepare, M93 begin/finish/recheck and M92 atomic completion. Google stays the automatic primary; Open Library v2 fan-out runs only with a protection policy. The fix list is in the B2 review section below.

## M94 prerequisite migration

- Local file `supabase/migrations/20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql`, 231 lines, sha256 `a0b7de6288107a405852feda3cc392b718e988b7b557c1fd6b5a69d3153690e2`.
- Adds `phase9_automatic_edition_fence_v1` (the fence reader) and `phase9_prepare_automatic_metadata_v1` (admission plus coalescing election in one call).
- Status: local file, NOT applied to any Supabase project. No live version. Ledger row: [database-current-vs-target, 2026-11-04 M94 section](../supporting/database-current-vs-target.md#2026-11-04-slice-8-package-8b-built-locally-m94-local-file-not-applied).
- Commit-recorded verification (`8d93685`): static 6/6, PGlite 58/58, native provider-replacement 291/0 plus M94 concurrency 4/4.
- **Release order.** M94 must be applied BEFORE the 8b worker is deployed. The B2 worker calls the M94 fence for every automatic claim and has no fallback. Without M94 it fails closed (`stale_claim`, no provider egress), and automatic processing stops.
- Applying M94 needs separate Owner approval and exact-project verification of `ahntbtktjjmvfosgkmgn` before and after, per the repository database rule.

## B2 review and fix round (2026-11-04)

Reviews of `02a0f34` before the fix round:

- Luna (gpt-6-luna, max) stopped on the Codex usage limit and returned no findings.
- Muse (muse-spark-1.3): 1 Medium-Low, 2 Low.
- Paid DeepSeek (deepseek-v4.1-flash, max): 2 High, 1 Medium/High, 2 Medium, 1 Low/Medium deployment note, 2 Low.
- Haiku (xhigh): 1 new High and 1 Medium harness item, plus overlaps with the findings above.

Fix round 1 was run by the same DeepSeek session, for every confirmed item. Fix list (from the `02a0f34` commit message):

- start permit before breaker check on the single-call path;
- proven-unsent known outcomes and post-begin refusals terminalize;
- fan-out winner without retained list degrades to `policy_denied`;
- NULL-policy unknown send keeps the legacy retryable completion;
- fan-out invoke failures always reach finish;
- evidence without M94 lineage terminalizes instead of looping;
- stricter test harness lineage, plus cache, recovery and F8 coverage.

Mapping of each reviewer finding to a fix item: not recorded.

## Verification

Orchestrator re-run after the fix round (as reported; not re-run by the 2026-11-04 documentation pass):

- `tsc` for `workers/phase9-metadata-worker`: clean.
- Phase 9 Jest: 1835 passed, 0 failed, 3 todo.
- PGlite: `phase9AutomaticWorker` 18/18; `phase9AutomaticPreparation` 27/27; `phase9AutomaticEditionFence` 31/31.
- `phase9AutomaticPreparationConcurrency.postgres.mjs` needs the native Postgres runner. It was NOT re-run for B2, because B2 changed no SQL. Its last recorded result is the M94 commit's 4/4.
- One scaffolding Jest test, "worker HTTP service rejects a second processing request...", failed once under full-suite load and passed in isolation. Reviewers judged it a 20 ms timing race unrelated to B2. It passed in the three later full Phase 9 Jest runs (two by the fix session, one by the orchestrator).

Commit-recorded results for earlier 8b units (historical; later units changed the red set):

- `620160b`: tsc clean; Phase 9 Jest 14 failed / 1793 passed, failing identities identical to the `a52f2be` baseline.
- `a52f2be`: 14 known U5-owned failures unchanged; tsc clean.
- `9fd60d2`: 23 known U5/U6 reds unchanged; worker tsc clean.
- `3c326ab`: Phase 9 1798 pass / 52 fail / 3 todo (49 owned by U3-U6, 3 CRLF-exempt); controls 221/221; tsc 0.
- `2c3df38`: Phase 9 1809 pass / 52 fail / 3 todo (49 owned by U4-U6, 3 CRLF-exempt); controls 221/221; tsc 0.
- `fb97eea`: Phase 9 1798 pass / 52 fail (49 owned by U3-U6, 3 CRLF-exempt); controls 221/221; tsc 0.
- `8e47515`: wrapper suite 19/19.

Not run: native Postgres suites and any live readback. Continuity validator: M94 is now in the authorized local forward-file list, and the real script passes (`PHASE9_CONTINUITY_CHECK=PASS`).

## Final whole-8b review and fix round 2 (2026-11-04)

**Reviews** (read-only, over `db5434f..02a0f34`):
- Luna (gpt-6-luna, max): two whole-range passes.
- Paid DeepSeek and Muse 1.3: ten targeted units (R1–R8 from Sol's unit plan, plus T1 retry/lineage and T2 egress).

**Confirmed and fixed** in fix round 2. Sol confirmed each finding first, then fixed it in one session plus an addendum; no SQL changed.
- **L1:** a NULL-policy retryable 503 was terminalized on its next claim. It now gets one bounded legacy resume, taken only from the original finalized, retryable, transient single-call receipt (logical attempt `unresolved`).
- **L2:** a lineage created under a protection policy could run unprotected after the policy was set to NULL (probe: 5 GETs). It now terminalizes before egress. Two DeepSeek variants of the same cause are covered.
- **D1:** a sent half-open probe stayed in flight when finalization threw. It is now settled before finalization.
- **D2 and D3:** a 429 tripped or reopened the breaker. Both now use one shared `isBreakerFailure`.
- **D4:** the breaker is re-checked after the legacy limiter wait.
- **D5 and D6:** a revoked historical version, or a known state conflict with a valid lease, looped `stale_claim` until the job was stranded at 5/5. It now terminalizes via `phase9_fail_metadata_job`; a lost lease stays fenced.
- **D7:** the cache-hit gate now uses `isPositiveOutcome`.
- **Docs:** README correction (Open Library 2.0.0 is installed as an unbound manifest entry).

**Rejected:**
- the claim that the single Google path does not register a physical call (`validateEgress` does);
- the inherent fence-to-send race.

**Clean units:** R2, R3, R5, R7 (M94 SQL seams) and R8 (test integrity).

**Verification** (orchestrator rerun after the fixes):
- `tsc` 0; build 0;
- Phase 9 Jest: 96 suites, 1840 pass, 0 fail, 3 todo;
- PGlite: Worker, Preparation and EditionFence 85/85.

A final paid-DeepSeek sweep of the fix diff confirmed no new egress path, an at-most-once legacy resume, and no weakened tests. It found two fail-safe Lows, recorded as residuals 8 and 9.

## Mutation record

- Supabase, Storage, deployment and Render: none in package 8b.
- Git: local commits only, from `db5434f` up to and including the fix round 2 commit; nothing pushed.
- `db push`: frozen.
- M94: local file, not applied.

## Residual risks and follow-ups

1. Terminal fallbacks use the legacy `phase9_fail_metadata_job`. The job becomes terminal, but an M93 run row can stay `running` or `unknown`. A future SQL neutral-terminal path would be cleaner.
2. A breaker refusal on a run that already holds a lookup is terminal `policy_denied`, because M93 schedule and defer reject that state. The job is sacrificed, not retried.
3. Uncertain prepare, finish and complete states return manual without a terminal write, so they may need operator recovery.
4. Evidence without M94 lineage now terminalizes as `policy_denied`. HEAD first tried `resumeFinalizedAttempt` (legacy finalized-attempt resume). Only legacy jobs that are mid-flight at deploy time are affected. Severity: Low.
5. The installed-automatic catch-all maps every escaping error to `stale_claim`. That is safe, since there is no generic retry, but it hides programming errors.
6. Carried from 8a and still open: stuck job `4ffe137d-5ff5-4ef6-9a24-27a2911c027c`; WHOLE-1; native AC8-6; operating numbers unconfigured; registry `protection_policy` NULL until 8c. See [ACTIVE.md open items](../../ACTIVE.md#open-items-blockers-and-residual-risks).
7. If both the finalize and the reconcile transport fail after a send, the job is terminalized `policy_denied`, while the call can stay `outcome_unknown` and the run `running`. There is no extra egress. Low.
8. If finalization throws after a port half-open probe receives a 429 or 2xx, the breaker is settled as failed, adding one extra cooldown. This applies only with a protection policy, and there is no egress. Low.
9. A NULL-policy legacy resume whose original adapter version is still accepted but is no longer the live version is terminalized `policy_denied` instead of retried. There is no egress. Low.
10. Residual 4 above is superseded for retryable NULL-policy receipts by the L1 bounded resume.

## Next authorized actions

Each needs its own Owner approval. Nothing here is authorized by this record.

1. Apply M94 to dev project `ahntbtktjjmvfosgkmgn`, after exact-project verification.
2. Check or recover stuck job `4ffe137d-5ff5-4ef6-9a24-27a2911c027c`.
3. Push and deploy the 8b worker, only after step 1.
4. Live smoke with the 8b worker.
5. Then 8c: protection policy, WHOLE-1 null-safe flag, and drain.

## Facts not recorded

- Per-unit file counts and per-finding reviewer IDs: not recorded.
- The operating-number values (pacing, circuit thresholds): not recorded; they are unconfigured (OQ8-3).
- Whether the 8b worker has been deployed to any environment: not deployed, per the commit messages.
