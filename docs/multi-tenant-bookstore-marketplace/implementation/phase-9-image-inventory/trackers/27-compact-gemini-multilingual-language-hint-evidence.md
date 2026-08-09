# Phase 9 compact Gemini multilingual and language-hint correction evidence

**Date:** 2026-08-09
**Status:** `required_diagnostics_correction_complete_awaiting_rereview`

## Authorized boundary

Gemini returns only compact visual identity fields (maximum five authors) and
optional compact multilingual search enrichment. Enrichment is non-fatal and
author ordinals map uniquely to the returned authors. Session language is a hint,
not a candidate rejection rule. Existing M18/M19 proposal persistence, M32
metadata jobs, tables, Owner review, and original-script identity remain intact.

## Completed implementation

- Removed geometry, warnings, server provenance echoes, the old sidecar envelope,
  source duplication, and oversized author arrays from Gemini output.
- Added independent compact-enrichment validation and server-side mapping into
  the existing proposal envelope. Missing, empty, or unusable enrichment cannot
  invalidate valid vision extraction.
- Changed deterministic vision policy so a titled observation whose detected
  language is not `und` becomes a candidate regardless of the session hint.
- Added local forward M34 after M33. It replaces only the applied persistence-
  function clauses enforcing selected-language rejection and the former 20-author
  database bound. Historical M12 is unchanged; M34 changes no table or data.

## Verification

- Focused contract/policy Jest: 46 target tests passed. The main Jest invocation
  also discovered the nested isolated worktree and reported the same suites twice
  as 92/92; no duplicate result is counted as additional coverage.
- Vision-worker TypeScript build passed.
- Current-tree PGlite vision/runtime plus variant persistence passed 59/59 through
  M32, M33, and local M34. It proves cross-language candidate creation, unchanged
  M32 metadata-job creation, compact proposal persistence, and the five-author cap.
- Isolated baseline PGlite passed 45/45; `git diff --check` passed there.

## Independent-review correction

The independent verdict was `APPROVED_WITH_REQUIRED_CORRECTIONS`: bounded
provider request IDs and error codes could still contain a configured privileged
value. Red-first Jest reproduced secret-bearing fields in the emitted failure
log and a secret-bearing successful response ID in attempt finalization. The
sanitizer and successful response-ID boundary now receive the worker's existing
privileged-value list and null either bounded identifier when it contains a
configured secret.

Correction verification: red runs failed 1/22 analyzer and 1/6 egress assertions;
the corrected analyzer and egress suites passed 22/22 and 6/6; the complete
five-suite focused scope passed 47/47; and vision-worker TypeScript passed.

## External state and next gate

No Supabase query/mutation, migration application, provider call, Render change,
job invocation, inventory/publication action, stage, commit, or push occurred.
M34 remains local and unapplied. Independent correction-only rereview of this
exact scope is the next action; provider-only proof, deployment, M34 application,
and attempt 5 remain separately gated.
