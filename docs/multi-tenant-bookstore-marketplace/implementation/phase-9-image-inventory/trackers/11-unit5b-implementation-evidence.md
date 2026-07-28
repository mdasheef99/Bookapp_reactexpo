# Phase 9 Unit 5B Google Books Adapter Evidence

**Date:** 2026-07-28
**Status:** `candidate_awaiting_independent_review`
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
Final affected verification and hygiene are recorded in the candidate closeout.

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

Create and push the exact candidate commit, obtain one fresh independent review
of the committed baseline-to-tip diff, and stop for merge authorization if
approved.
