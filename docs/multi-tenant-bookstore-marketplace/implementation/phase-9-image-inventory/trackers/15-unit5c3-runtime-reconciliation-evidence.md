# Phase 9 Unit 5C-3 Runtime and Reconciliation Evidence

**Status:** `merged_main_f09301b`
**Date:** 2026-07-29
**Authority:** Unit 5C-3 runtime generation, reconciliation, activation policy,
and lifecycle only
**Live project:** `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`)

## Git and independent review

- merged commit: `f09301b76fb14714f942a98f0ceffa5d5a0c3178`;
- independently reviewed exact tree:
  `eabe1040b4dbe89cf5163754fd719a11673a8682`;
- independent verdict: `APPROVED`.

## Completed behavior

Unit 5C-3 implements:

- optional multilingual companion generation in the existing single Gemini
  provider call;
- independent sidecar validation and strict canonical `p9-vision-v2`
  isolation;
- fail-closed companion handling: missing, malformed, oversized, unsupported,
  or provenance-mismatched companions do not invalidate valid vision output;
- accepted-companion persistence through the M18/M19 proposal and replay-fence
  boundary;
- confirmed Owner title and individual-author reconciliation, with title and
  each author handled independently;
- deterministic narrow normalization and material-change classification;
- trusted `proposed -> active`, `proposed -> stale`, and `active -> stale`
  lifecycle transitions;
- no automatic reactivation of stale proposals;
- default-deny automatic-activation policy;
- store, observation, and exact source-field isolation;
- no raw provider-response persistence.

## Deep self-review corrections

The internal Unit 5C-3 deep review identified and corrected:

- active variants surviving removal of exact field confirmation;
- JavaScript/SQL normalization inconsistency for symbols;
- incorrect zero-based author fixture indexing;
- missing explicit oversized/rejected companion fallback coverage.

## Immutable migration history

| Migration | Live version | Final record |
| --- | --- | --- |
| M18 private proposal persistence | `20260729004216` | Preserved unchanged. |
| M19 accepted-envelope replay fencing | `20260729020008` | Preserved unchanged. |
| M20 variant runtime/search | `20260729054842` | Applied once; temporarily contained combined Unit 5C-3/5C-4 behavior. It was not edited, reverted, or deleted. |
| M21 defer active variant search | `20260729060238` | Forward-corrected the live schema to Unit 5C-3-only semantics. |

M21 removed the public search RPC, alias materializer, inventory/listing target
linkage, and related trigger/search behavior introduced by M20. Final live
semantics retain Unit 5C-3 only; applied migration history remains immutable.

## Verification

- final affected Jest: 7 suites, 101/101 passed;
- database integration: 12/12 passed;
- TypeScript: passed with `--allowImportingTsExtensions`;
- `git diff --check`: passed;
- scoped secret scan: passed;
- `.pyc` check: passed;
- rollback-only lifecycle smoke: passed with zero synthetic residue;
- live proposal, proposal-set, and alias counts: zero at verification time.

No documentation closeout check re-reviewed the unchanged implementation.

## Post-merge documentation closeout

The bounded closeout updated only Phase 9 status, routing, evidence, data/audit,
traceability, scope, and continuity-control documents. It performed no
Supabase, Storage, provider, deployment, source, migration, test, runtime
configuration, inventory, listing, publication, or commerce mutation.

## Explicitly absent and deferred

Unit 5C-3 does not implement final Unit 5C-4 behavior. The following remain
absent:

- active alias materialization and customer/store Roman-query search
  consumption;
- customer display changes;
- Owner variant-review UI or approve/reject/manual-replacement actions;
- benchmark tooling, per-language rollout controls, or production language
  enablement;
- inventory/listing creation, publication changes, or commerce;
- Google Books Roman-query fallback;
- global alias authority.

## Next active task

Unit 5C-4 — active store-scoped alias materialization and search consumption.
Start it in a new session from merged `main`
`f09301b76fb14714f942a98f0ceffa5d5a0c3178`, gather targeted context only,
do not reread the full Unit 5C/Phase 9 hierarchy, and do not modify M18-M21.
Use red-first tests, perform a deep Unit 5C-4 self-review, and obtain an
independent exact-tree review before commit.
