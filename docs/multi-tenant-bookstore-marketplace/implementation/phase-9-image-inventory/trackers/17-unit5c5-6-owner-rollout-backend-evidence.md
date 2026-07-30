# Phase 9 Unit 5C-5/5C-6 Backend Evidence

**Status:** `backend_complete_live_verified_ready_for_merge`
**Date:** 2026-07-30
**Authority:** exceptional Owner variant decisions plus benchmark and
per-language rollout-control backend only
**Live project:** `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`)

## Candidate scope

Unit 5C-5 adds a private Owner review projection and hardened store-scoped
commands for approve, reject, and distinct Owner-origin replacement. Decisions
use exact lifecycle versions, transaction-scoped idempotency locking, immutable
audit evidence, stable keyset pagination, one-based author positions, and the
existing active Store Owner boundary. Owner corrections preserve the source
proposal and model/prompt/schema provenance, never invoke a provider, and
materialize or retract only through the Unit 5C-4 boundary.

Unit 5C-6 adds a versioned sanitized benchmark-manifest parser, deterministic
offline/replay runner, canonical dataset hashing, per-language/script/field/
scenario metrics, immutable manifest/execution/review evidence, platform-only
review and rollout commands, safe platform read contracts, independent vision/
Romanization/automatic-activation flags, and fail-closed exact-tuple matching.
No migration or test enables a production language.

M27 replaces the Unit 5C-3 reconciliation seam so a caller-supplied proposal
allowlist is never activation authority. New automatic activation requires the
single exact current approved language/script, model/version, prompt, sidecar
schema, dataset/version, policy, and execution evidence chain.
The final reviewed sequence is M24-M28. Trigger version fencing lives in M24;
candidate-first/proposal-second replacement locking lives in M25; benchmark
evidence and legal review state live in M26; M27 remains the Unit 5C-3
exact-policy bridge; and M28 exposes platform-only evidence reads. M29 is
absent and was never applied.

## Candidate migrations

| Migration | Purpose | Live status |
| --- | --- | --- |
| M24 `20260729000024_marketplace_phase9_owner_variant_decisions.sql` | Owner read, approve/reject, versioning, immutable decision audit | `20260730022442` |
| M25 `20260729000025_marketplace_phase9_owner_variant_corrections.sql` | distinct Owner-origin corrected variants and replacement audit | `20260730022524` |
| M26 `20260729000026_marketplace_phase9_variant_benchmark_rollout.sql` | canonical manifests, executions, reviews, capabilities, audit, exact evidence RPC | `20260730022559` |
| M27 `20260729000027_marketplace_phase9_exact_rollout_activation.sql` | fail-closed Unit 5C-3 exact-evidence enforcement | `20260730022636` |
| M28 `20260729000028_marketplace_phase9_variant_benchmark_evidence_read.sql` | platform-only benchmark evidence reconstruction | `20260730022713` |

M18-M23 remain immutable and exactly once. M09 and M29 remain absent. The
authorized project is `ACTIVE_HEALTHY` on PostgreSQL 17.6.1 and its ledger now
ends at M28.

## Final exact-tree and verification evidence

- Approved tree:
  `66db5be740940a8c882bb7ea312817f4c33bb2db`.
- Review A, Unit 5C-5 Owner lifecycle: `APPROVED`.
- Review B, bounded Unit 5C-6 unchanged-domain confirmation: `APPROVED`.
- Implementation commit:
  `4b667fc6674d606a8f88e2a4ee933d79bf332f53`; its commit tree equals the
  approved tree.
- Migration SHA-256:
  M24 `06dac972d80320e858c6df6db5bc9cb571aed65d861432047a5ef7f51078eee2`;
  M25 `9976e4b0fd136b2f88835b0a092f4c561e544716a0d6663f05e1f8c869bcc233`;
  M26 `5a3c5348fe40b373380eb89542e1540de2e5924ca8c998184d04c34f02897536`;
  M27 `cbe6484812cd04838dacc6340e1f2138695722439b1a89e468882e5b4d1930c5`;
  M28 `4537fa4669ed65a156b3413be2caba15a30d784dc6a4e1397c5f38732702eeb4`.
- Migration readable line counts: M24 319, M25 152, M26 461, M27 351,
  M28 173.
- Complete Unit 5C-1 through 5C-6 Jest: 12 suites, 140/140 passed.
- Complete affected PGlite through M28: 4 suites, 53/53 passed, zero skipped,
  todo, or restricted tests.
- Scoped TypeScript, continuity 195 requirements/zero duplicates/zero missing
  traceability, diff checks, staged-secret check, generated-artifact check, and
  zero-`.pyc` check passed.
- Live RLS, ACL, fixed `search_path`, strict Owner-only authority,
  manager/staff/cross-store denial, platform evidence-read authorization,
  per-capability approval, anonymous/private-evidence denial, and no unintended
  PostgreSQL 17 `MAINTAIN` grant passed.
- A real two-connection PostgreSQL interleaving forced candidate refresh ahead
  of Owner replacement. Replacement waited, re-read current evidence, used
  `Changed title`, produced one decision, then became stale after a later
  refresh; the source was rejected, no proposal remained active, no alias link
  duplicated, no replacement was lost, and no deadlock occurred.
- Benchmark record/review/evidence reconstruction, canonical manifest/result
  hash equality, rollout enablement, revocation, and fail-closed re-enable
  denial passed inside rollback-only smoke.
- All synthetic identifiers were removed; explicit counts across session,
  media, input, job, analysis, observation, candidate, proposal-set, proposal,
  decision, and alias-link scopes were zero.
- Actual benchmarked languages: none. Actual approved languages: none. Actual
  enabled capabilities: none. The live rollout remains fail closed.

- Red-first Jest initially failed because the new Owner, benchmark, and rollout
  modules did not exist.
- Canonical runner Jest: 1 suite, 8 tests passed after the expected red run
  failed 7/8 against the retired contract.
- Combined affected Unit 5C-2 through 5C-6 variant and structural Jest:
  10 suites, 90 tests passed.
- Complete affected PGlite variant integration after the eligibility correction:
  35/35 passed.
- Scoped TypeScript:
  `npx.cmd tsc --noEmit --allowImportingTsExtensions` passed.
- No Storage, provider, deployment, inventory, listing, publication, commerce,
  credential, benchmark approval, language approval, or production rollout
  mutation occurred. The only live mutations were the reviewed M24-M28
  applications and isolated synthetic smoke data that was removed completely.

## Adversarial self-review

Unit 5C-5 review found and corrected concurrent exact-replay behavior with a
transaction-scoped advisory idempotency fence. It also verified stale-version
denial, changed replay denial, source-field independence, correction provenance,
private-table ACLs, and Unit 5C-4-only materialization/retraction.

Unit 5C-6 review found and corrected changed manifest/execution replay comparison
and added the missing safe platform rollout-state projection. Exact policy is
checked again inside PostgreSQL; missing, revoked, superseded, mismatched, or
partial evidence denies activation.

The first exact tree `52d30d55be9777a62c397f9e4368d0d04dea48b4`
received `CHANGES_REQUIRED`. Regression-first correction addressed all six
findings: Owner-origin lifecycle compatibility; immutable review ordering;
rollout concurrency/idempotency/audit provenance; complete benchmark/review
replay comparison; direct platform RPC coverage; and valid requirement IDs.
The old tree was not migrated.

The second exact tree `918ef92d748a02459015b7a7a96517f0d4595e94`
also received `CHANGES_REQUIRED`. Regression-first correction addressed all six
findings: candidate-driven staling now increments the lifecycle version;
benchmark-review and rollout replay bind the authenticated platform actor; the
runner and persistence boundary share the 100-sample eligibility threshold;
Owner denial reasons use the exact effective evidence predicates; new rollout
coverage moved out of the pre-existing oversized persistence test into cohesive
bounded modules; and the release gate includes every migration through M29.
That tree was not migrated. Its valid M28/M29 behavior is preserved in
normalized M24/M26; the rejected tree and correction-file layout are retired.

The third exact tree `3a244004365c4c4038d03226718a25cb14be2793`
received `CHANGES_REQUIRED`. The three findings were: incompatible runner and
persistence benchmark shapes with caller-trusted eligibility/counts; illegal
review transitions and ineffective `prior_review_id` linkage; and mechanically
compressed M26 SQL. The tree was unstaged and retired. Regression-first
correction now uses one canonical result object and explicit adapter, derives
and reconciles item/group/aggregate counts and eligibility inside PostgreSQL,
requires execution-scoped legal review chains and prior-approval linkage, and
uses only the latest effective legal state for rollout authority. M26 is
reviewable in a readable cohesive migration. That tree was not migrated.

One final bounded semantic correction separates structural review eligibility
from platform quality approval. M26 and the canonical runner now treat at
least 100 complete valid samples as reviewable even when additional failed,
invalid, or explicitly governed excluded cases are truthfully recorded and
the total population reconciles. The manifest marks exclusions as governed;
the result preserves that marker, and SQL rejects unauthorized exclusions,
missing/duplicate identities, omitted counts, or inconsistent totals.
Structural eligibility grants no rollout authority: only an explicit latest
legal platform approval does, while rejection remains fail closed. No universal
zero-failure or accuracy threshold was introduced.

`SELF_REVIEW_APPROVED` for Unit 5C-5.

`SELF_REVIEW_APPROVED` for Unit 5C-6.

## Release gate

The backend gate is complete. The exact implementation tree was independently
approved, applied, live-verified without residue, and committed without tree
drift. Merge remains a separate user authorization.

## Exclusions and next action

No Owner/customer/platform-admin visual UI, customer secondary display, live
Gemini benchmark, credential, production language approval, inventory/listing
creation, publication, commerce, Google Books Roman-query fallback, global
alias authority, or Phase 7/8 behavior is included.

Immediate next action: obtain merge authorization for this branch; do not merge
automatically. The next eligible Phase 9 implementation unit is Unit 6 Owner
UX, but Owner and platform-admin visual UI remains deferred and requires
separate authorization.
