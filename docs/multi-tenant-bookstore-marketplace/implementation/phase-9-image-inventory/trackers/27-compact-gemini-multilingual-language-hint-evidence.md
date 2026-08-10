# Phase 9 compact Gemini multilingual and language-hint correction evidence

**Date:** 2026-08-09
**Status:** `schema_free_json_mode_decoder_normalization_local_complete_final_proof_approval_required`

## Authorized boundary

Gemini returns only compact visual identity fields (maximum five authors), with
Romanization and optional English translation fields directly on each
observation. The server infers source script and maps these fields into the
unchanged M18/M19 proposal envelope. Session language is a hint, not a candidate
rejection rule. Existing M18/M19 proposal persistence, M32 metadata jobs,
tables, Owner review, and original-script identity remain intact.

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

## Provider-only execution evidence

- Reviewed commit `dc19107ef9fc1252f85626614147de2562f15559` is local
  `HEAD`, one commit ahead of upstream, and remains unpushed.
- Exact-project read-only preflight verified M31/M32/M33 in order and M34 absent.
  M33 is live once as `20260809023834`; no database or Storage mutation occurred.
- The replacement key was installed only on the existing Render vision service.
  The environment update automatically caused one restart; prior source SHA
  `83cf61ae93b263d6a31a5cda67da2be91cdb97fb` returned to `live`.
- Production sanitation reproduced the existing 1600x1600 WebP with the exact
  recorded SHA-256. The full committed request used the production prompt,
  `responseJsonSchema`, decoder/mapper, configured model, and language hint, but
  Gemini returned HTTP 400 `INVALID_ARGUMENT` / `malformed_request` before decode.
- With all other request inputs held constant, the core `vision` schema returned
  HTTP 200 when only `multilingual_search_enrichment` was omitted. Converting
  nullable `anyOf` nodes to type arrays did not make the full schema valid. This
  isolates the rejected component to the optional multilingual schema subtree or
  its combined nesting complexity.

## External state and next gate

M34 remains unapplied. No job claim/mutation, push, corrected deployment,
attempt-5 invocation, candidate/metadata action, Owner UI continuation,
inventory/publication, scheduler, or Unit 7 action occurred. The next action is
the smallest compatibility correction limited to the multilingual provider
schema, followed by the same exact provider-only request. All downstream steps
remain blocked until that full request returns HTTP 200 and decodes.

## Flattened observation correction

The provider schema now contains only `vision`. Romanization and optional English
translation sit directly on each observation; `author_romanizations` is capped at
five and aligns one-to-one with `author_guesses`. The decoder strips these fields
from canonical `p9-vision-v2`, infers source script from original Unicode text,
and builds the unchanged server-owned M18/M19 proposal envelope. Malformed
enrichment remains non-fatal to valid vision.

Red-first focused Jest failed 10 assertions against the old decoder. Final focused
Jest is 59/59 across analyzer, egress, variant runtime, vision policy, and
deployment runtime; the vision-worker TypeScript build passes. The explicitly
approved retry used the flattened production schema/decoder/mapper and sanitized
test image, then returned HTTP 400 with safe category `malformed_request` and
message `provider rejected the request shape`; no HTTP-200 production decode was
obtained. The analyzer mapped it to `P9_VISION_ANALYZER_UNAVAILABLE`. No
downstream or external mutation occurred.

## Schema-free JSON-mode correction

The provider-side `responseJsonSchema` was removed completely. The Gemini request
now uses JSON MIME mode plus the flat prompt, while the production BookConnect
decoder remains the strict contract boundary. Red-first analyzer evidence failed
until the schema was removed; final exact-path focused Jest is 59/59 and the
vision-worker build passes.

The approved sanitized-image retry reached Gemini and returned JSON, so the HTTP
400 request-shape blocker is resolved. Production decoding rejected the returned
JSON as `P9_VISION_SCHEMA_INVALID`. The remaining action is to capture that bounded
JSON on a separately approved retry and normalize only the evidenced mismatch.
No database, Storage, job, Render, Git, or downstream action occurred.

## Bounded capture and exact decoder fix

The approved capture returned eight flat observations. The only canonical
mismatches were provider `image_outcome: "success"` and one null
`detected_language`. A red analyzer test reproduced the failure; the decoder now
normalizes only those values to `analyzed` and `und`. Exact-path focused Jest is
60/60 and the vision-worker build passes. The final proof transmission was
separately rejected by the approval boundary, so no additional image request was
made and the temporary script was removed.
