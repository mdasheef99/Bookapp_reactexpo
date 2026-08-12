# Unit 7A Create-Only Inventory Commit Evidence

**Status:** `unit7a_live_proof_blocked_by_ui_availability`
**Date:** 2026-08-12
**Branch:** `codex/phase9-unit7a-create-only-inventory`
**Base:** `origin/main` at `f2ccc6a20f065ec000fd3a3ac89ba4f014b52cb4`
**Authority:** Unit 7A local implementation, load-bearing red tests, forward
migration-file creation, local/ephemeral database execution, Edge/mobile
integration, exact-project migration application, corrected Owner Edge
deployment, one authenticated Owner UI commit followed by exact replay when
available, verification, and documentation closeout. Manual RPC, additional
deployment, Unit 7B publication, and Unit 7C inventory editing are excluded.

## Implemented scope

- Added forward migration
  `20260812000039_marketplace_phase9_create_only_inventory_commit.sql` after
  verifying the repository and live development history end at M38.
- Added authenticated-only
  `public.phase9_add_candidate_to_inventory_v1(...)`. The command derives the
  Owner/store relationship on the server, locks the candidate, revalidates the
  current candidate/review/metadata revisions, and consumes only the current
  saved review plus selected server metadata.
- Each successful first execution creates exactly one private inventory row,
  sets `total_quantity=available_quantity=q` and the other quantity buckets to
  zero, preserves reciprocal candidate/inventory provenance, advances the
  session committed count, and writes bounded audit, event, and idempotency
  evidence in one transaction.
- Exact replay returns the original canonical response. Changed replay and
  same-candidate contention fail closed without a second inventory row.
- Replaced the unsafe callable boundary rather than deleting legacy history:
  execute on the old M05 `phase9_commit_candidate(...)` signature is revoked
  from `PUBLIC`, `anon`, `authenticated`, and `service_role`. Duplicate advice
  and historical duplicate intent no longer block or redirect Unit 7A.
- Added the strict Edge/mobile `add_candidate_to_inventory` request and
  response contracts, RPC routing, online-only/non-optimistic mutation,
  ambiguous-outcome exact retry, version-conflict refresh, identity/route
  fences, and exact candidate/queue/discovery/readiness/Owner-inventory cache
  invalidation.
- Removed actionable duplicate choices from the review UI and review-write
  payload while retaining legacy stored history as non-authoritative data.

## Red-first and verification evidence

- Before M39 was applied to the local PGlite harness, all 13 Unit 7A cases
  failed: U7A-01 through U7A-12 lacked the new command and U7A-13 proved the
  legacy duplicate boundary remained unsafe.
- After implementation, the dedicated PGlite suite passed **13/13**. It covers
  saved-review authority, exact quantity initialization, authorization and
  non-enumeration, revision fences, create-only cardinality, exact/changed
  replay, same-candidate concurrency, rollback on audit failure, canonical
  immutability, private-media isolation, reciprocal provenance, and duplicate
  non-interference.
- Phase 9 Edge/mobile and migration contract regression passed **42 suites,
  479/479 tests**.
- Repository TypeScript passed with the repository's documented Deno import
  flag: `npx.cmd tsc --noEmit --allowImportingTsExtensions`. The unflagged
  command reported only the existing TS5097 `.ts` import configuration errors.
- The final touched UI/query rerun passed **2 suites, 26/26 tests**. It retained
  the existing React `act(...)` diagnostics and required `--forceExit` for the
  known idle Jest handle; neither produced a failed assertion.
- Phase 9 continuity passed with **195** requirement definitions, zero
  duplicates, zero missing traceability mappings, regression probes PASS, 72
  Markdown files checked, 55 required phase files, and repository diff check
  PASS. Document-size notices were advisory only under the repository policy.
- The complete 36-path Unit 7A changed-file set and diff were inspected. The
  introduced-content scan found no credentials, tokens, private media paths,
  fixture secrets, or generated artifacts; no unrelated Unit 7B/7C behavior
  was present. `git diff --check` passed. The pre-existing untracked
  `docs/codemap/` directory was neither inspected nor modified and is excluded
  from the Unit 7A diff.

## Database and external-state record

Fresh read-only Supabase preflight verified `Bookconnect_reactexpo`, project
ref `ahntbtktjjmvfosgkmgn`, `ACTIVE_HEALTHY`, and live history through
`20260810130638 marketplace_phase9_metadata_retry_correction`. The relevant
live `store_inventory` columns and the unsafe M05 callable were read back before
the forward file was designed. M39 was exercised only through the repository's
ephemeral PGlite harness. It is **not applied** to Supabase. No database,
Storage, queue, provider, inventory, listing, publication, deployment, or other
external mutation occurred.

## Independent review finding correction — 2026-08-12

The independent verdict `UNIT_7A_INDEPENDENT_REVIEW_FAIL` identified one
blocking selected-canonical materialization defect and two evidence gaps. The
correction did not reopen design or change the frozen SDD.

- Repository migration history confirms M01 added nullable text columns named
  `description`, `edition_statement`, `volume`, and `format` to both
  `public.canonical_editions` and `public.store_inventory`. The selected
  canonical-edition branch in M39 now assigns each inventory value from the
  same-named column on the locked/current selected `canonical_editions` row.
  The manual and unmatched coherent-snapshot branches are unchanged.
- Red regression receipt: after seeding all four canonical-edition values but
  before correcting M39, U7A-01 failed exactly on inventory `description`
  (`NULL` instead of the selected canonical value); the other 12 Unit 7A cases
  passed. After the four assignments, the dedicated suite passed 13/13.
- Strengthened U7A-01 asserts exact selected canonical description, edition
  statement, volume, and format on the new private inventory row; retains
  saved-review title/author/price/condition/location authority; proves the
  command signature contains only control/fencing inputs; and compares the
  complete selected canonical-edition row before/after commit for immutability.
- Explicit cross-store proof creates Owner/store A and a separate Owner/store B
  session/candidate. Owner A receives the same non-enumerating
  `P9_OWNER_NOT_AUTHORIZED` result for store B's real session and an unknown
  session. Store B receives no inventory row, candidate mutation, committed
  count, audit/event, or durable idempotency artifact.
- The existing harness creates one in-memory `PGlite` client and exposes no
  independent connection/pool facility to the same database. U7A-08 therefore
  remains a structural overlapping-submission test rather than a row-lock
  contention claim. It now proves one inventory row, one committed-count
  increment, one audit/event effect, the canonical result on exact replay, and
  rejection of the distinct competing command.

**Concurrency evidence status:**
`LOCAL_STRUCTURAL_PROOF_PASS_REAL_POSTGRES_CONTENTION_DEFERRED_TO_PREFLIGHT`.
Genuine separate-connection PostgreSQL same-candidate contention is a required
controlled preflight before M39 approval/application; it is not inferred from
PGlite.

Security regression remains green: authorization precedes idempotency,
completed authorized replay is stable, the candidate uses `FOR UPDATE` followed
by reauthorization and all three revision fences, create-only cardinality and
`(q,q,0,0,0)` remain intact, forced audit failure rolls back every effect,
provenance is reciprocal, canonical rows are immutable, output is private-only,
duplicate history cannot redirect the command, the function is
`SECURITY DEFINER` with fixed `search_path`, only `authenticated` can execute
the new public command, and authenticated execution of unsafe M05 remains
revoked.

Focused verification after correction:

- Unit 7A PGlite: 13/13 passed.
- Relevant Edge/mobile/readiness and migration-schema Jest: 7 suites,
  222/222 tests passed. Existing React `act(...)` diagnostics and the known idle
  Jest handle remained non-failing.
- Phase 9 continuity and `git diff --check`: PASS after this evidence update.
- Complete correction diff, introduced-sensitive-content scan, generated-file
  scan, frozen-SDD check, and final worktree status: PASS; only M39, the Unit 7A
  fixture/test, and this existing evidence file changed for the correction.

## Controlled M39 preflight and application — 2026-08-12

- Exact-project identity, migration history, live schema, quantity/provenance
  data, function/ACL, helper, RLS, and trigger preconditions passed on
  `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` with M38 as the prior head.
- A disposable PostgreSQL 17 cluster loaded the Phase 9 chain through reviewed
  M39. Two genuinely independent `psql` connections overlapped in both the
  same-command replay race and distinct-command candidate-lock race. Exact
  replay returned one canonical inventory ID and one business effect; distinct
  commands produced one winner and one non-mutating version-conflict loser.
- Reviewed M39 was applied once, without retry, and is live exactly once as
  `20260812003419 marketplace_phase9_create_only_inventory_commit`.
- Immediate live readback matched the reviewed Unit 7A function body by exact
  SHA-256, confirmed postgres ownership, `SECURITY DEFINER`, fixed empty
  `search_path`, and authenticated-only execution. `PUBLIC`, `anon`, and
  `service_role` cannot execute the new command. M05 remains present but only
  postgres can execute it; internal helper exposure did not broaden.
- Migration application created no business effect. Inventory/listing counts
  remained `5/5`; all five inventory rows remained private; inventory/public-
  media links remained zero; candidate states and session committed counts were
  unchanged; Unit 7A idempotency/audit/event counts remained zero; canonical
  rows, operational job count, policies, triggers, quantity constraints, and
  `UNIQUE(committed_inventory_id)` remained unchanged.
- Edge/runtime deployment: `NOT_RUN` at this checkpoint. Controlled live Add to
  Inventory and exact replay proof: `NOT_RUN`.

## Controlled Owner Edge deployment attempt — 2026-08-12

- Scope trace selected only `phase9-owner-ingestion`: request decoding flows
  through `executeOwnerIngestion` to `phase9_add_candidate_to_inventory_v1`.
  Media, vision/Gemini, metadata, publication, and Unit 7B/7C runtimes were not
  deployed.
- Runtime remained byte-equivalent to reviewed implementation SHA `e2437f18`.
  The strict decoder exposes command/control fields only, forwards the ordinary
  authenticated context, and leaves authorization/business state to M39.
  Focused Owner UX, ingestion runtime, and security tests passed 182/182.
- Read-only baseline was inventory/listings `5/5`, publication `{private:5}`,
  media links/public media `0/0`, candidates `{ready:18,needs_review:36,failed:1}`,
  session committed total `0`, and Unit 7A idempotency/audit/event `0/0/0`.
- The only authorized deployment attempt failed during bundling before
  activation. The Supabase bundler could not resolve `../contracts/registers`
  imported without `.ts` by `_shared/imageInventory/domain/validation.ts`.
  Deployment count was 1/1; no retry, code change, or improvised repair occurred.
- Post-attempt readback confirms `phase9-owner-ingestion` id
  `f8aec89f-ae2a-431a-8a97-5775a2405b90`, version 3, remains ACTIVE with
  `verify_jwt=true`. All baseline counts are unchanged. M39 remains live once;
  no database, Storage, candidate, inventory, publication, or media mutation
  occurred. Controlled live Add to Inventory/exact replay remains `NOT_RUN`.

## Residual gates and next action

## Resolution-only Edge bundle correction — 2026-08-12

- The reviewed Edge Function remains the existing
  `supabase/functions/phase9-owner-ingestion/index.ts`; no function, route,
  decoder, RPC call, or runtime behavior was created or redesigned.
- Reachable-graph tracing found four extensionless relative imports. Each was
  changed only to name the same-cased existing `.ts` target explicitly:
  `validation.ts` → `registers.ts` and `privacy.ts`; `registers.ts` →
  `versions.ts`; and `searchVariantScripts.ts` → `validation.ts`.
- Local Supabase Functions serve was attempted but could not start because the
  Windows Docker engine was absent. The strongest available local graph proof,
  `npx.cmd --yes deno@2.5.6 check --config
  supabase/functions/phase9-owner-ingestion/deno.json
  supabase/functions/phase9-owner-ingestion/index.ts`, passed with zero
  unresolved imports. GitHub Actions has no established
  `phase9-owner-ingestion` Edge bundle job; the existing Phase 9 workflow is a
  separate worker-container smoke and is not claimed as Edge bundle evidence.
- Focused Owner Edge/mobile Unit 7A regression passed 7 suites and 223/223
  tests. Repository TypeScript passed with `--allowImportingTsExtensions`.
  Existing React `act(...)` diagnostics and the known idle Jest handle remained
  non-failing; the lingering process was stopped only after the complete PASS
  summary.
- Semantic diff proof: M39, the frozen Unit 7A SDD, Edge entrypoint, strict
  request/response decoders, `executeOwnerIngestion` routing, RPC target,
  authorization, duplicate supersession, and publication boundary are
  unchanged. Classification: `RESOLUTION_ONLY`.
- Redeployment remains `NOT_RUN`; deployed Owner Edge version 3 remains ACTIVE.
  No Supabase data/Storage mutation or live Add-to-Inventory proof occurred.

- Unit 7A implementation and M39 are complete; runtime deployment and live
  mutation proof remain operational gates.
- Unit 7B publication and Unit 7C post-commit editing remain excluded.
- Unit 6F native validation debt remains `NOT_RUN`/`UNRESOLVED` and unchanged.

**Next authorized action:** narrow independent review limited to the four
import-resolution edits, local Deno/import-graph proof, semantic equivalence,
and focused regressions. Redeployment and Add to Inventory remain unauthorized.

## Controlled live Unit 7A proof - 2026-08-12

- User authorization covered exactly one real authenticated Owner UI commit
  followed by exact same-key/same-command replay. No manual RPC fallback,
  duplicate/changed-command test, Unit 7B/7C action, or code/migration change
  was authorized or performed.
- Read-only preflight confirmed the exact project, M39 exactly once,
  `phase9-owner-ingestion` version 4 ACTIVE with deployment ID
  `f8aec89f-ae2a-431a-8a97-5775a2405b90`, attempt count `1/1`, authenticated
  execute allowed for the Unit 7A RPC, and M05 execution denied to API roles.
- Existing eligible candidate selected through the real authenticated Owner
  UI: `d61d2193-4674-49d1-ae09-aed120dfe261`, session
  `0a5cfd15-b460-4022-a02a-cb42f8f3ff64`, state `ready`, disposition `reviewed`,
  `review_ready=true`, candidate version `2`, review version `1`, metadata
  revision `4`, reviewed quantity `q=1`, and no committed inventory ID.
- The Owner UI candidate-detail route failed twice after selection. The
  Add-to-Inventory action was never exposed, so neither the first commit nor
  the exact replay was run. No business state changed.
- Final read-only readback: inventory/listings `5/5`; candidates
  `18 ready/36 needs_review/1 failed`; committed total `0`; Unit 7A
  idempotency/audit/event counts `0/0/0`; inventory-media links `0`; all five
  publication rows remained private. The chosen candidate remained `ready`
  with no committed inventory ID.
- Exact verdict: `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY`.
- Next authorized action: restore the authenticated Owner candidate-detail/Add-
  to-Inventory UI path, then resume only the one commit followed by exact
  same-command replay. Manual RPC and another deployment are not authorized.

## Latest controlled-proof update - 2026-08-12

- The user authorized a private review save for new candidate
  `5b8a7220-d460-40fc-ad5c-330c84d69903` with invented price `250000` paise;
  the review used quantity `1`, Good condition, no damage, sellable copy, and
  private publication intent.
- The UI initially reported an unclear save result and offered “Retry same
  save.” The exact retry was performed without changing the values. Read-only
  server verification confirms the save succeeded: candidate state `ready`,
  disposition `reviewed`, `review_ready=true`, review version `1`, metadata
  revision `4`, and no committed inventory ID.
- The scan summary then exposed “Ready for next step,” but candidate detail
  failed on the initial load and exact retry. Add to Inventory was never
  exposed, so the Unit 7A inventory commit and exact replay were not run.
- Final read-only state: inventory `5`, marketplace listings `5`, committed
  total `0`, Unit 7A idempotency/audit/event `0/0/0`, inventory-media links
  `0`, and five private inventory rows. Exact verdict:
  `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY`.

## Fresh image upload observation - 2026-08-12

- User-started session `166a20cb-c919-4e06-8e4a-1cd53e4ef393` accepted one
  image, but media validation retried once and the final exact-project
  readback showed input state `skipped` with `P9_OWNER_REMOVED`.
- The corresponding `media_validate_sanitize` job is `cancelled` at attempt
  `2/5`; the session has zero candidates and zero commits. No Unit 7A commit or
  replay was issued. The removed input must not be revived without a new
  explicit target decision.

## Fresh image completed - 2026-08-12

- The same session later accepted a second image and completed successfully,
  producing two candidates: `Individuals` by P. F. Strawson and `Thinking,
  Fast and Slow` by Daniel Kahneman.
- Exact-project readback shows both candidates `state=ready`,
  `review_ready=false`, and no committed inventory ID; session counts are two
  inputs, two candidates, and zero commits.
- The first review screen loads matched metadata (language `en`, published
  `1990`, format `book`, `255` pages), but price and Owner confirmations are
  still required. No new review or inventory write was made.

## Latest fresh review save - 2026-08-12

- Candidate `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals`) was saved
  privately through the Owner UI with quantity `1` and price `250000` paise.
- Exact-project readback confirms `state=ready`, `reviewed`,
  `review_ready=true`, review version `1`, and no committed inventory ID.
- Its “Ready for next step” candidate-detail route failed on initial load and
  exact retry. Add to Inventory was never exposed. Final inventory remains
  `5`, committed total `0`, Unit 7A idempotency/audit/event `0/0/0`, and no
  Unit 7A commit or replay was issued.

## Unit 7A controlled live proof PASS - 2026-08-12

- `phase9-owner-ingestion` version `5` is ACTIVE. Its deployed bundle adds
  `add_to_inventory` to the `allowedActions` enum in
  `ownerUxResponses.ts`, resolving the `OwnerUxResponseContractError` /
  `P9_INTERNAL_ERROR` that had hidden Add to Inventory.
- First live Owner UI commit at 04:41 UTC used candidate
  `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals`, P. F. Strawson) in
  session `166a20cb-c919-4e06-8e4a-1cd53e4ef393`. It created
  `store_inventory` row `5f5a2bc9-d702-4aeb-af55-2a9df6c16478` with
  `created_from_candidate_id` set to the candidate, `entry_method=
  image_extraction`, `visibility_status=draft`, `publication_status=private`,
  `selling_price_minor=250000`, and quantities
  `total/available/reserved/sold/removed=1/1/0/0/0`. Candidate readback is
  `committed`/`committed_private`; session `committed_count=1`.
- Exact replay at approximately 05:00 UTC used
  `idempotencyKey=commit:1779df52-2f35-413d-81f5-8c71769e176b`,
  `commandId=9a1182db-6e96-4c24-b484-dad57e909818`, and expected versions
  `candidate/review/metadata=2/1/4`. The canonical response returned
  `inventoryId=5f5a2bc9-d702-4aeb-af55-2a9df6c16478` (prefix
  `5f5a2bc9`), `candidateVersion=3`, `inventoryVersion=1`, and
  `outcome=committed_private`. Post-replay readback found one inventory row,
  `committed_count=1`, one completed idempotency row, one audit, and one event:
  zero new effects.
- Verdict: `UNIT_7A_LIVE_PROOF_PASS`; the UI-availability gate is cleared.
  `Thinking, Fast and Slow` remains uncommitted (`review_ready=false`). An
  existing RLS-disabled advisory for three registry/system tables was noted;
  no remediation was applied.
- Next gate: Unit 7B publication, separately gated.

## Latest fresh review save - 2026-08-12

- Candidate `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals`) was saved
  privately through the Owner UI with quantity `1` and price `250000` paise.
- Exact-project readback confirms `state=ready`, `reviewed`,
  `review_ready=true`, review version `1`, and no committed inventory ID.
- Its “Ready for next step” candidate-detail route failed on initial load and
  exact retry. Add to Inventory was never exposed. Final inventory remains
  `5`, committed total `0`, Unit 7A idempotency/audit/event `0/0/0`, and no
  Unit 7A commit or replay was issued.
