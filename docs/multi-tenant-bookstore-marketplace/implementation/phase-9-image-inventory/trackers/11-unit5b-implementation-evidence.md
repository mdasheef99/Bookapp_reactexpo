# Phase 9 Unit 5B Google Books Adapter Evidence

**Date:** 2026-07-28
**Status:** `approved_for_merge`
**Branch:** `codex/phase9-unit5b-google-books-adapter`

## Scope completed

Google Books API v1 is implemented as the only initial primary metadata adapter
behind the Unit 5A provider-neutral contracts. The implementation adds:

- an official-documentation provider audit;
- manually constructed sanitized v1 response fixtures;
- deterministic ISBN-first and title/author/language request construction;
- a bounded mockable HTTP boundary with timeout/cancellation, response-byte and
  content-type enforcement, and safe normalized failures;
- tolerant item-level decoding with strict top-level bounds;
- validated ISBN pairs, Unicode/original-script preservation, plain-text
  descriptions, and allowlisted HTTPS covers;
- deterministic coherent-edition ranking without field stitching or invented
  numeric acceptance thresholds;
- server-only fixture-by-default configuration and explicit Google Books mode;
- a production composition seam that preserves local, cache, coalescing,
  lookup/reservation/attempt/fence/egress/finalization/cache/snapshot/manual order;
- policy/version fail-closed behavior and zero retention when storage/reuse is
  not authorized;
- explicit null secondary composition.

The Google Books adapter does not expose provider field names through shared
contracts, RPCs, schema, snapshots, Owner UI, canonical records, or marketplace
DTOs.

## Verification

Red-first checkpoints failed on the missing adapter and production-composition
modules. Focused green verification initially passed 3 suites / 21 tests.
Final affected Unit 5A/5B Jest passed 7 suites / 70 tests; the pre-correction
Unit 5B adapter/composition/environment verification passed 3 suites / 22 tests.
Changed-scope TypeScript passed. The repository-wide TypeScript command emitted
no diagnostic but exceeded its five-minute execution bound and is not recorded
as passed. Continuity passed with 47 Markdown files / 34 required files.
`git diff --check` and scoped credential scanning passed.

The exact candidate `b8948b0` received `CHANGES_REQUIRED` for reuse-policy
ordering, incomplete positive-cache/follower durable paths, pre-cancelled egress,
and incomplete verification evidence. Correction red tests failed 4 cases as
expected. The bounded correction adds policy-before-cache, explicit durable
cache-hit and follower completion seams, pre-cancelled zero egress, and this
exact verification record. Correction-focused Jest passed 2 suites / 21 tests.

## Matching, reuse, and storage policy-boundary correction

The later independent review identified two additional policy contradictions:
reuse denial incorrectly blocked an otherwise authorized fresh match, and
positive cache/follower reuse could bypass storage denial. Commit `8dfe810`
separates the three permissions through one explicit decision contract:

- `matching_allowed` independently controls fresh provider attempts;
- `reuse_allowed` independently controls cache reads, follower reuse, and cache
  writes;
- `storage_allowed` independently controls positive retained metadata and
  immutable provider-derived snapshots.

With matching and storage allowed but reuse denied, the composition skips cache
and follower work, preserves lookup/reservation/attempt/fence/egress ordering,
permits the immutable snapshot, and writes no reusable cache entry. Matching
denial permits otherwise compatible cache/follower reuse but guarantees zero
fresh provider calls. Storage denial rejects positive cache/follower
materialization, permits an otherwise authorized fresh match, retains no
positive cache or snapshot, and completes through the bounded manual/policy
path. Existing negative and ambiguous cache persistence and terminal-attempt
provenance remain unchanged.

The first limited re-review found one closed-outcome regression: an incomplete
manual-outcome set could classify a reused terminal provider failure as
accepted. Follow-up commit `6bc47be` makes `coherent_match` the sole positive
reusable outcome; every provider failure or unknown terminal outcome degrades
to manual. The same Terra/high reviewer verified exact pushed tip
`6bc47beeda7406f11420777ccd87657fc5d0b588` and returned
`APPROVED_FOR_MERGE`.

Red-first policy tests failed 8 of 16 cases before the main production change,
and the focused cached-`timeout` regression then failed before the follow-up.
Final correction-focused Jest passed 2 suites / 30 tests. The affected Unit
5A/5B regression set passed 7 suites / 79 tests. Changed-scope TypeScript,
`git diff --check`, and the scoped credential scan passed. The pre-cancelled
adapter still produces zero fetch calls; the local-canonical path produces zero
provider work; and no inventory, publication, alias, or canonical-authority
mutation seam was added.

## External and schema state

Read-only Supabase preflight verified project `ahntbtktjjmvfosgkmgn`,
PostgreSQL 17.6.1, M01-M08/M10-M17 once, M09 absent, the M14/M15 sensitive
SELECT-only/RPC-mutation boundary, and an empty metadata provider registry.

No migration was created. No Supabase, Storage, provider registry, credential,
Google Books, Gemini, Render, deployment, scheduling, autoscaling, inventory,
quantity, publication, alias, or marketplace mutation occurred. No live provider
call occurred.

## Residual launch gates

Google API terms do not establish blanket permanent-copy permission. Production
use therefore remains gated on legal/licensing/privacy review, a compatible
enabled provider-registry row, server credential configuration, deployment,
quota policy, and separately authorized live smoke. Unit 5C aliases remain
unstarted.

## Next gate

The exact next action is user review and merge authorization for final reviewed
code tip `6bc47beeda7406f11420777ccd87657fc5d0b588`. Production configuration,
credentials, deployment, provider calls, live smoke, and Unit 5C remain
separately gated.
