# Phase 9 Unit 5C-1 Variant Contract Evidence

**Status:** implementation complete; exact-tip independent review gate
**Date:** 2026-07-29
**Authority:** Unit 5C-1 contract, fixture, validation, and documentation only

## Implemented boundary

- versioned provider-neutral `search_variant_proposals_v1`;
- observation-qualified title and author source fields;
- source/variant BCP 47 language and bounded ISO 15924 scripts;
- one primary Roman form, up to two Roman alternatives, and one separately
  typed English translation candidate per source field;
- model, prompt, schema, provider, generation-source, and analysis provenance;
- strict byte, key, array, text, source-association, and provenance validation;
- deterministic search comparison separated from linguistic proposals;
- already-Latin/source-identical suppression and field-local deduplication;
- safe `missing|accepted|rejected` companion handoff that never invalidates a
  valid ordinary vision result.

Malformed items reject the complete optional sidecar, matching the existing
strict no-item-salvage vision convention. No raw provider response is retained.

## Preserved compatibility and exclusions

`p9-vision-v2`, `SpineImageAnalyzer`, Gemini response schema/prompt/generation,
the vision worker/persistence path, `p9-alias-v1`, and M01
`book_search_aliases` are unchanged. Existing Unit 4/4B fixtures require no
sidecar and remain valid.

No migration, Supabase/Storage action, alias row, lifecycle, activation,
benchmark storage, search indexing, Owner UI, inventory, listing, publication,
Roman-query metadata fallback, provider call, credential, configuration,
deployment, price-on-request, or commerce behavior is included.

## Verification

- Red baseline: new suite failed 25/25 before production exports existed.
- Source-association refinement: 18/28 failed before observation-qualified
  production support.
- Unit 5C-1 green: 1 suite, 28/28 tests.
- Focused regressions: 5 suites, 84/84 tests covering Unit 5C-1, unchanged
  vision contracts, Gemini analyzer, alias contracts, and metadata identity.
- Root TypeScript: initial command reached the pre-existing `.ts` import/config
  mismatch in `contracts/ingestion.ts`; rerun with
  `--allowImportingTsExtensions` passed.

Exact commands and final hygiene/continuity evidence are reported in the
implementation tracker and final handoff. Independent exact-tip review must
return `APPROVED` before merge authorization.
