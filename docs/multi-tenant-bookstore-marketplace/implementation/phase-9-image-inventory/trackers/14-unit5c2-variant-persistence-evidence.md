# Phase 9 Unit 5C-2 Variant Persistence Evidence

**Status:** `merged_main_b398034`
**Date:** 2026-07-29
**Authority:** Unit 5C-2 store-scoped proposal persistence and lifecycle
foundation only
**Live project:** `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`)

## Completed scope

Unit 5C-2 adds a private persistence boundary for the already-approved
`search_variant_proposals_v1` sidecar:

- new additive table `public.phase9_search_variant_proposals`;
- exact store, analysis, job, candidate, observation, field, author-position,
  language/script, variant-type, and provenance linkage;
- deterministic proposal identities and duplicate-safe exact replay;
- one immutable analysis-scoped accepted-envelope fingerprint that rejects
  changed accepted replays without appending rows;
- initial `proposed` and `search_eligible=false` persistence only;
- service-only token/attempt-fenced write and bounded store-scoped read RPCs;
- public `SECURITY INVOKER` wrappers over private fixed-search-path functions;
- provider-neutral runtime envelope mapping and persistence gateway.

The live M01 `book_search_aliases` table is deliberately unchanged. M18 does
not activate proposals, project them into aliases/search, invoke a provider,
create inventory/listings, or change publication or commerce behavior.

## Migration and preflight

Local migration:
`supabase/migrations/20260729000018_marketplace_phase9_search_variant_proposals.sql`

Reviewed local SHA-256:
`6f51fc74afa81890f6281047464dbbac3ad9aa70ffcb1b39294aaaa6907914f5`

Before application, Supabase MCP confirmed:

- project `ahntbtktjjmvfosgkmgn`, PostgreSQL 17.6, `ACTIVE_HEALTHY`;
- M01-M08 and M10-M17 present exactly once;
- M09 absent;
- M18 absent;
- every M18 prerequisite table/helper/RPC present with the expected signature;
- `book_search_aliases` present with zero rows and no incompatible schema drift.

The exact reviewed M18 was applied through Supabase MCP as:

`20260729004216 marketplace_phase9_search_variant_proposals`

Migration history then showed M18 exactly once. The migration is forward-only
and remains applied.

### Bounded M19 correction

The first independent review of staged tree
`473609bd23b5259f93ed8b07684b73b77cd75068` returned
`CHANGES_REQUIRED`. Its P1 finding showed that an accepted M12 result could be
replayed with a different individually valid proposal envelope, allowing M18
to append a second set and bypass durable per-field limits. Two P2 findings
identified stale review-order and runtime-status wording.

The user authorized one bounded correction. Red-first verification reproduced
the defect: the changed accepted replay did not reject under M18. Forward-only
M19 preserves M18 and adds:

- `public.phase9_search_variant_proposal_sets`, one immutable fingerprint per
  accepted analysis;
- a replacement fixed-search-path definer that wraps the renamed M18 helper;
- rollback-on-conflict semantics for any changed accepted envelope;
- removal of direct `service_role` EXECUTE from the renamed M18 helper.

Local M19:
`supabase/migrations/20260729000019_marketplace_phase9_search_variant_replay_fence.sql`

Reviewed local SHA-256:
`860729d49c94cafd8aec6f92484b6f828425cf7995e4781d3813448b53f6106d`

Preflight reconfirmed the exact healthy PostgreSQL 17.6 project, M18 once,
M19 absent, zero proposal rows, expected RPCs/ownership/RLS, and no conflicting
drift. M19 was applied through Supabase MCP as:

`20260729020008 marketplace_phase9_search_variant_replay_fence`

M19 is live exactly once and no migration was removed or reversed.

## Live schema and security readback

Readback proves:

- the proposal table is owned by `postgres`, has RLS enabled, and has no
  client policy;
- all required columns, defaults, lifecycle/private-foundation checks, foreign
  keys, unique proposal identity, and three bounded lookup indexes exist;
- private read/write functions are `SECURITY DEFINER`, postgres-owned, and use
  `search_path=""`;
- public wrappers are postgres-owned `SECURITY INVOKER` functions with the same
  fixed empty search path;
- only `service_role` has EXECUTE on the intended read/write functions;
- `anon`, `authenticated`, and `PUBLIC` have no table or function authority;
- `service_role` has table SELECT only, with no
  INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN;
- direct service-role mutation is denied and proposal mutation remains RPC-only;
- the fingerprint table is postgres-owned, RLS-enabled with no policies, and
  service SELECT-only with no mutation or PostgreSQL 17 `MAINTAIN`;
- the replacement definer and public wrappers retain `search_path=""`;
- the renamed M18 helper is postgres-owned but not executable by
  `service_role`, `anon`, or `authenticated`;
- `book_search_aliases` retained its columns, constraints, indexes, RLS,
  ownership, zero rows, and existing behavior.

The pre-existing unrelated advisor warnings remain outside this work unit and
were not modified.

## Bounded live smoke

The authorized synthetic smoke used one isolated store/session/input/media/job,
one direct synthetic active claim, one Hindi title, and two equal-text author
positions. It verified:

- a valid active claim returned `accepted` and persisted three proposals;
- all three rows were `proposed` and non-searchable;
- exact replay returned the same durable proposal IDs and created no duplicate;
- a mismatched lease token raised `P9_STATE_CONFLICT` and created zero analysis
  or proposal rows;
- title and the two individual author positions remained distinct;
- the bounded store/candidate/status read returned exactly three rows;
- `book_search_aliases` remained unchanged.

Vision analysis evidence is append-only, so the smoke ran inside an explicit
transaction and ended with `ROLLBACK`. This removed only the synthetic smoke
records while preserving the separately applied M18 migration. Post-smoke
readback found no synthetic residue.

The M19 correction smoke used four title proposals. First persistence returned
`accepted` with four rows; exact replay remained `accepted` with four rows; a
different valid four-proposal envelope raised
`P9_SEARCH_VARIANT_REPLAY_CONFLICT`. Readback inside the transaction showed
four proposed/non-searchable rows, one fingerprint row, and one distinct
fingerprint. The transaction rolled back and post-smoke readback found zero
synthetic session/media/input/job/result/proposal/fingerprint rows and zero
aliases.

## Local verification

Red-first evidence:

- the initial focused Jest slice failed because M18 and its runtime mapping did
  not yet exist;
- production code and migration were added only after those failures.

Completed verification:

- focused Jest: 12 suites, 142/142 tests passed;
- focused Phase 9 PGlite: 73/73 tests passed;
- changed-scope TypeScript for `searchVariantPersistence.ts`: passed;
- migration contract includes a rollback-only PostgreSQL 17 verifier;
- live PostgreSQL 17.6 schema, ACL, RPC, replay, mismatch, scope, and cleanup
  verification: passed through Supabase MCP.
- M19 red/green: changed accepted replay failed before M19, then focused
  structural Jest passed 12/12 and focused PGlite passed 9/9;
- M19 live PostgreSQL 17.6 ledger, fingerprint/RLS/ACL/search-path, exact
  replay, changed-replay rollback, proposed-only, alias, and cleanup checks:
  passed through Supabase MCP.
- final corrected focused Jest: 3 suites, 15/15 tests passed;
- final corrected six-suite Phase 9 PGlite: 74/74 tests passed;
- final corrected scoped TypeScript: passed;
- final Phase 9 continuity: 195 definitions, zero duplicates/missing,
  51 Markdown files, and 38 required files passed.

The repository-wide TypeScript command timed out without diagnostics and is not
recorded as passing. Diff hygiene, secret scan, and independent review of the
exact staged candidate remain release gates.

## Boundaries and next gate

Still absent and unauthorized:

- Gemini variant generation or any new provider call;
- automatic activation, lifecycle transition commands, or stale propagation;
- search/index projection or public exposure;
- Owner UI;
- inventory/listing creation or publication/commerce changes;
- deployment or provider configuration.

## Independent approval and merge

The corrected exact staged tree
`f96fe3d1713a5a65ee4b858980b4d6528ac9991c` received independent verdict
`APPROVED` with no actionable findings. It was committed as
`b3980349d9d446fbf1820ef869f6664953d9a599`, pushed to
`codex/phase9-unit5c2-variant-persistence`, and then fast-forward merged to
local `main` after confirming remote `main` remained its exact parent
`8aadf178aa2b14293a7c0168f3b41e90ebf61d52`.

Next authorized action: stop and await explicit authorization for Unit 5C
Batch 1. The single authorized bounded correction pass has been used; no
generation, activation, search exposure, UI, or other later Unit 5C work is
authorized by this merge.
