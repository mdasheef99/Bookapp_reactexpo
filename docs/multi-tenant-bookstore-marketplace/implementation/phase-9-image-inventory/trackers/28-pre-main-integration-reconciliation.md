# Phase 9 Unit 6 Pre-Main Integration Reconciliation

**Status:** `isolated_candidate_assembled_final_verification_review_pending`
**Date:** 2026-08-10
**Target:** one reviewed `main` SHA containing the current Phase 9 ingestion path

## 1. Authority and live-state receipt

- Repository starting branch/HEAD: `codex/phase9-integration-recovery` /
  `51c51f4a53377bddb7b0a8681bc568ef98b7d8ea`.
- Freshly fetched `origin/main`:
  `388d8bf07cabbe08a89af9dbd26910cb899627d9`.
- Exact Supabase project: `ahntbtktjjmvfosgkmgn`, `ACTIVE_HEALTHY`.
- Live Phase 9 migration tail: M35 at
  `20260809223135 marketplace_phase9_single_image_removal`; M36 is absent.
- Render readback: media is live at `96991a9`, vision is live at `388d8bf`,
  both services use branch `main` with auto deploy off, and no metadata service
  exists.
- This reconciliation authorizes Git packaging, normal integration, and normal
  push only after all gates pass. It authorizes no Supabase, Vault, Cron,
  Render, worker/provider, Storage, live-image, duplicate-replay, Unit 7,
  inventory, listing, or publication mutation.

## 2. CURRENT_REQUIRED committed history

These proven revisions are required in the final candidate. The integration
must preserve their bounded changes or an exact reviewed equivalent.

| Revision | Scope | Protection |
| --- | --- | --- |
| `bdb85b6`, `237393b`, `a0d55b5` | Unit 6F readiness, offline, privacy, authority, and review corrections | Unit 6 Jest/architecture/accessibility suites |
| `22464bf` | WU1 Owner inventory read boundary and M31 | WU1 static/PGlite/security tests |
| `b564fbd`, `3597095` | SDK54/native prerequisite and Unit 6F evidence | auth/storage/capture navigation Jest and TypeScript |
| `7be633b` | WU2 read-only Owner inventory client | Owner inventory service/query/screen tests |
| `e4f2b34` | Google Books `projection=full` | `phase9_google_books_adapter.test.ts` |
| `51c51f4` | M36 automatic worker wake dispatcher and dispatch receipt support | dispatcher static/PGlite/runtime/deployment tests |

The current `origin/main` Gemini lineage (`83cf61a`, `05ea886`, `388d8bf`) is
the authoritative compact JSON implementation. The divergent `dc19107` and
`df63801` revisions are not added separately.

## 3. CURRENT_REQUIRED working-tree manifest

Every path below is required either for executable current behavior, its
security/contract tests, or the mandatory continuity record. Tracked/untracked
state is relative to `51c51f4` before this reconciliation's bounded edits.

### 3.1 M32 structural metadata and runnable metadata worker

| Paths | State/origin | Why required and tests |
| --- | --- | --- |
| `supabase/migrations/20260807000032_marketplace_phase9_structural_metadata_integration.sql`; `supabase/tests/phase9/phase9StructuralMetadataWorker.integration.test.mjs`; `supabase/tests/phase9/phase9MetadataFoundation.integration.test.mjs`; `supabase/tests/phase9/phase9VisionRuntime.integration.test.mjs` | untracked migration/new integration; tracked test updates; M32 | Live M32 source, atomic candidate-to-metadata fan-out, context/fencing/retry/manual outcomes, and 1/15-candidate coverage |
| `supabase/functions/_shared/imageInventory/metadata/providerAdapter.ts`; `runtime/metadataJobContext.ts`; `runtime/metadataProductionGateway.ts`; `runtime/metadataGatewayContext.ts`; `runtime/metadataProductionComposition.ts` | new/modified; M32 metadata runtime | Provider-neutral fail-closed validation, exact query/context fencing, replay recovery, terminal-before-cache behavior; protected by provider/gateway/composition Jest and structural PGlite |
| `supabase/functions/_shared/imageInventory/contracts/aliases.ts`; `contracts/metadata.ts`; `contracts/vision.ts`; `domain/validation.ts`; `metadata/googleBooks/adapter.ts`; `metadata/googleBooks/decoder.ts`; `metadata/googleBooks/request.ts`; `metadata/queryIdentity.ts` | tracked modifications; M32/metadata corrections | Offset-aware timestamps, strict normalized edition parsing, valid-ISBN strategy, provider capability/host policy, `projection=full`; protected by metadata alias/ISBN/Google Books/provider tests |
| `workers/phase9-metadata-worker/index.ts`; `server.ts`; `bootstrap.ts`; `Dockerfile`; `README.md`; `tsconfig.json` | five untracked plus modified bootstrap; metadata deployment preparation | Complete authenticated bounded `/run` service, exact-project startup, Google Books composition, container/build entrypoint; protected by metadata-worker/environment/deployment tests and entrypoint/container smoke |
| `supabase/functions/__tests__/phase9_metadata_provider_adapter.test.ts`; `phase9_metadata_production_gateway.test.ts`; `phase9_metadata_worker.test.ts`; `phase9_metadata_environment.test.ts`; `phase9_metadata_isbn_identity.test.ts`; `phase9_metadata_production_composition.test.ts`; `phase9_google_books_adapter.test.ts`; `support/phase9MetadataComposition.ts` | three untracked plus tracked updates; M32 | Current provider, worker, gateway, environment, identity, replay, and persistence contracts |
| `supabase/functions/__tests__/phase9_metadata_alias_contracts.test.ts`; `supabase/functions/_shared/imageInventory/contracts/ingestion.ts`; `supabase/migrations/__tests__/marketplacePhase9ServiceRpcWrappers.test.ts`; `supabase/tests/phase9/phase9VisionProviderAttempts.integration.test.mjs` | tracked updates; M32/M33 support | Shared contract and migration-harness correctness, including true SHA-256 fixture lineage |

### 3.2 M33 vision reservation correction

| Paths | State/origin | Why required and tests |
| --- | --- | --- |
| `supabase/migrations/20260809000033_marketplace_phase9_vision_reservation_correction.sql`; `supabase/migrations/__tests__/marketplacePhase9VisionReservationCorrection.test.ts`; `supabase/tests/phase9/phase9VisionReservationCorrection.integration.test.mjs` | untracked; M33 | Exact live forward source for reservation-before-cost, guarded repair, and malformed-history exclusion |

### 3.3 M35 one-current-image and safe removal

| Paths | State/origin | Why required and tests |
| --- | --- | --- |
| `supabase/migrations/20260810000035_marketplace_phase9_single_image_removal.sql`; `supabase/migrations/__tests__/marketplacePhase9SingleImageRemoval.test.ts`; `supabase/tests/phase9/phase9SingleImageRemoval.integration.test.mjs` | untracked; M35 | Exact live forward source, logical removal, exact-job cancellation, replacement and lineage guards |
| `src/features/imageInventory/api/ownerUxService.ts`; `contracts/ownerUxContracts.ts`; `contracts/ownerUxRequestContracts.ts`; `queries/ownerUxInputQueries.ts`; `screens/CaptureProgressScreens.tsx`; `screens/CaptureScreens.tsx` | one untracked query plus tracked updates; Unit 6/M35 | Remove-image command, identity-fenced cache refresh, no append, guarded replacement, exact version/idempotency |
| `src/features/imageInventory/__tests__/CaptureProgressScreens.test.tsx`; `CaptureScreens.test.tsx`; `ownerUxContracts.test.ts`; `ownerUxService.test.ts`; `ownerUxInputQueries.test.ts` | one untracked test plus tracked updates; Unit 6/M35 | Current one-image, removal, replacement, contract, service, and identity assertions |
| `supabase/functions/_shared/imageInventory/contracts/ownerUxRequests.ts`; `contracts/ownerUxResponses.ts`; `runtime/ownerIngestion.ts`; `supabase/functions/__tests__/phase9_owner_ux_contracts.test.ts`; `phase9_ingestion_runtime_contracts.test.ts` | tracked updates; Owner Edge v3/M35 | Exact deployed Owner request/response/RPC overlay and strict transport tests |

### 3.4 Shared worker deployment/runtime corrections

| Paths | State/origin | Why required and tests |
| --- | --- | --- |
| `workers/phase9-runtime/environment.ts`; `scripts/invoke-phase9-worker.js`; `package.json` | tracked updates; metadata safety/deployment | Exact-project fail-closed startup for all privileged workers, metadata-specific no-peer rule, bounded metadata invocation, build/start commands |
| `supabase/functions/__tests__/phase9_deployment_runtime_scaffolding.test.ts`; `supabase/functions/__tests__/phase9_metadata_production_composition.test.ts` | tracked updates | Exact project, metadata invoker, redaction, runtime and replay protection |

### 3.5 Current normative and continuity records

All tracked modifications under the following exact paths are
CURRENT_REQUIRED because they reconcile current behavior/live evidence or are
required by the Phase 9 update matrix:

`DOC-13-implementation-tracker.md`; `DOC-3-canonical-books-metadata-inventory.md`;
`DOC-4-image-to-llm-inventory-workflow.md`; `DOC-8-store-owner-console.md`;
`implementation/ACTIVE.md`; `implementation/PHASE-9-image-to-llm-inventory.md`;
`implementation/README.md`; Phase 9 `00-phase-9-master-sdd.md`;
`02-extraction-enrichment-pipeline-sdd.md`; `04-media-security-privacy-sdd.md`;
`README.md`; `SESSION-START.md`; `TRACKER.md`;
`scripts/validate-phase9-continuity.ps1`; `supporting/complexity-and-scope-register.md`;
`supporting/data-dictionary.md`; `supporting/database-current-vs-target.md`;
`supporting/requirements-traceability.md`; `trackers/01-planning-and-decisions.md`;
`trackers/02-implementation-and-verification.md`;
`trackers/11-unit5b-implementation-evidence.md`;
`trackers/27-compact-gemini-multilingual-language-hint-evidence.md`;
`work-units/04a-deployment-runtime-scaffolding-sdd.md`;
`work-units/04b-gemini-vision-adapter-handoff.md`;
`work-units/06-owner-capture-review-recovery-contract-matrix.md`;
`work-units/06-owner-capture-review-recovery-ux-sdd.md`; and this tracker.

Protection: continuity validator, documentation drift searches, exact live-state
readback, `git diff --check`, and independent complete-delta review.

## 4. Exclusions and drift classification

| Classification | Change/occurrence | Treatment |
| --- | --- | --- |
| `CURRENT_LATER` | none in the dirty tree | no inclusion |
| `HISTORICAL_VALID` | applied M18/M19 `search_variant_proposals_v1` persistence/tests; prior selected-language fixture evidence; historical multi-image sessions/reports; recorded `projection=lite` failure evidence | preserve; do not rewrite or treat as current provider shape |
| `STALE_SUPERSEDED` | divergent commits `dc19107` and `df63801`; old provider nested sidecar/current-language wording in current normative docs | use current `origin/main` Gemini lineage; correct only current normative wording |
| `UNRELATED` | `.wt/` nested worktree; generated `docs/codemap/`; commit `2f32231` Store Owner Orders route; the Phase 4 file hunk inside mixed commit `0c705d4` | exclude and preserve locally |
| `UNKNOWN` | none after Git/history/live-state inspection | no blocker |

Current tests retaining 20-author Owner/canonical bounds are not stale provider
tests: the Gemini provider boundary is separately capped at five. Geometry and
warning assertions that verify server-added null/closed canonical fields remain
current. Negative assertions proving no provider response schema or nested
multilingual subtree remain current.

## 5. Bounded package ledger

| Commit | Scope | Verification before commit |
| --- | --- | --- |
| `ce5f787` | structural metadata/M32 worker, shared deployment runtime, and test isolation | focused metadata Jest 10 suites/150 tests; structural metadata PGlite 14/14; metadata TypeScript; diff/secret checks |
| `3e16973` | exact M33 local migration source and regression evidence | structural Jest 3/3; M33/provider-attempt PGlite 15/15; diff/secret checks |
| `b76cf05` | exact M35 local migration source and Unit 6 one-image/removal behavior | changed-scope Jest 8 suites/216 tests; M01-M35 PGlite 3/3; repository TypeScript with `--allowImportingTsExtensions`; diff/secret checks |

The plain root TypeScript command without `--allowImportingTsExtensions` failed
only on the repository's expected Deno `.ts` import paths. The canonical
recorded command with that option passed. Two timed-out bundled Jest commands
were not counted as evidence; their exact orphaned Node processes were stopped,
and the changed suites passed in the bounded diagnostic run above.

## 6. Remaining candidate gate

The complete local gate is green:

- Phase 9 function/runtime plus migration-structure Jest: 54 suites, 694/694;
- complete image-inventory client Jest: 39 suites, 287/287; the run retained
  known candidate-review `act(...)` warnings but had no test failure;
- full Phase 9 PGlite migration/runtime replay: 240/240 through local M36;
- media, vision, and metadata worker builds plus authenticated entrypoint smoke:
  PASS;
- deployment-runtime validator and canonical repository TypeScript: PASS;
- continuity: 195 definitions, zero duplicate/missing traceability, 107 semantic
  negative probes, 70 Markdown files, and 53 required files: PASS;
- repository diff, tracked-artifact, and `.pyc` hygiene: PASS; `.pyc` count 0;
- branch-delta secret scan: no blocking finding. Two invalid-length test tokens
  and one documented angle-bracket placeholder were explicitly allowlisted;
- container smoke: unavailable because Docker is not installed; not claimed.

## 7. Isolated candidate assembly receipt

- Fresh base: `origin/main` `388d8bf07cabbe08a89af9dbd26910cb899627d9`.
- Proven Google Books correction: cherry-picked as `6b31025`, with exact
  `projection=full` source and regression assertion.
- Merge checkpoint: `8e327d7`; exact `51c51f4` dispatcher and `5add881`
  package ancestry are present.
- Conflict resolution: both Gemini source conflicts use the `origin/main`
  compact-normalization implementation. `databaseHarness.mjs` retains M34 and
  adds M35/M36 in order.
- Explicit tree exclusions: Store Owner Orders `_layout` source/test and the
  Phase 4 file from mixed commit `0c705d4` are byte-equivalent to `origin/main`;
  superseded Gemini source is likewise byte-equivalent to `origin/main`.
- History disclosure: exact `51c51f4` ancestry necessarily carries ancestor
  commits `2f32231`, `dc19107`, and `df63801`. Their unrelated/superseded tree
  effects are neutralized in `8e327d7`; they are retained only as transparent
  historical ancestry because preserving exact dispatcher commit identity and
  excluding those ancestors are mutually impossible in Git.
- Generated `.wt/` and `docs/codemap/` content is absent from the candidate.

Rerun the required gates on this isolated tree, obtain an independent
`APPROVED` verdict on the complete candidate, freshly recheck `origin/main`,
then push only the exact verified candidate normally to `origin/main`.
