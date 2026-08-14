# Unit 7B §19 Red-Test Traceability

**Authority:** [Unit 7B SDD §19](./07b-publication-sdd.md#19-load-bearing-red-test-contract)
**Authoritative count:** 20 numbered red tests

This table is the implementation gate for Unit 7B. A numbered SDD red test is
not complete until every listed case exists at the stated layer and passes.
Cross-layer invariants intentionally have more than one case.

| §19 | Invariant | Test file / exact test case |
| --- | --- | --- |
| 1 | Eligibility authority | `supabase/tests/phase9/phase9Unit7bPublication.integration.test.mjs` — `U7B-RT01 locked inventory is the sole projection authority and request fields cannot substitute public content` |
| 2 | Positive-price/sellability gate | `supabase/tests/phase9/phase9Unit7bPublication.integration.test.mjs` — `U7B-RT02 price quantity and sellability failures are deterministic and create no listing or retry` |
| 3 | Damage-evidence gate | `supabase/tests/phase9/phase9Unit7bPublication.integration.test.mjs` — `U7B-RT03 damaged inventory requires one to three approved sanitized damage-role links and actual-copy alone is rejected` |
| 4 | Tenancy/non-enumeration | `supabase/tests/phase9/phase9Unit7bPublication.integration.test.mjs` — `U7B-RT04 unauthorized inactive and cross-store commands are non-enumerating and leave no durable effect`; `supabase/functions/__tests__/phase9_owner_publication.test.ts` — `U7B-RT04 Edge forwards ordinary Owner auth and never accepts caller store authority` |
| 5 | Dual-version fence under lock | `supabase/tests/phase9/phase9Unit7bPublication.integration.test.mjs` — `U7B-RT05 stale inventory and publication intent versions fail before projection`; `supabase/tests/phase9/phase9_unit7b_concurrency.ps1` — `U7B-RT05 dual-version race` |
| 6 | One-projection cardinality | `supabase/tests/phase9/phase9Unit7bPublication.integration.test.mjs` — `U7B-RT06 publish and republish retain exactly one listing per inventory` |
| 7 | Exact replay | `supabase/tests/phase9/phase9Unit7bPublication.integration.test.mjs` — `U7B-RT07 response-loss replay returns the canonical result with zero second effect`; `supabase/tests/phase9/phase9_unit7b_concurrency.ps1` — `U7B-RT07 exact replay race` |
| 8 | Changed replay / idempotency mismatch | `supabase/tests/phase9/phase9Unit7bPublication.integration.test.mjs` — `U7B-RT08 changed command identity version or intent returns P9_IDEMPOTENCY_MISMATCH with zero effect` |
| 9 | Retry non-mutation | `supabase/tests/phase9/phase9Unit7bPublicationRetry.integration.test.mjs` — `U7B-RT09 Owner and worker retry cannot create increment or change inventory quantity and cannot duplicate listings` |
| 10 | Transient-only retry | `supabase/tests/phase9/phase9Unit7bPublicationRetry.integration.test.mjs` — `U7B-RT10 deterministic rejection creates no retry while recognized transient projection failure creates exactly one intent-keyed retry` |
| 11 | Retraction/evidence preservation | `supabase/tests/phase9/phase9Unit7bPublicationRetry.integration.test.mjs` — `U7B-RT11 pause retains a paused unavailable listing private retracts safely and both disappear from discovery` |
| 12 | Pause-versus-leased-retry race | `supabase/tests/phase9/phase9_unit7b_concurrency.ps1` — `U7B-RT12 leased retry cannot republish after Owner pause advances intent` |
| 13 | Public-boundary privacy | `supabase/tests/phase9/phase9Unit7bPublicationRetry.integration.test.mjs` — `U7B-RT13 public discovery DTO excludes exact quantity location cost notes private media and risk internals`; `src/features/marketplace/services/__tests__/consumerDiscoveryService.test.ts` — `U7B-RT13 client decoder accepts only the frozen safe publication DTO` |
| 14 | Unmatched/manual publication | `supabase/tests/phase9/phase9Unit7bPublicationRetry.integration.test.mjs` — `U7B-RT14 reviewed unmatched inventory publishes without canonical mutation` |
| 15 | Retry-worker lifecycle | `supabase/functions/__tests__/phase9_publication_worker.test.ts` — `U7B-RT15 worker claims only publication_retry with a token-fenced lease and current intent`; `supabase/functions/__tests__/phase9_publication_worker.test.ts` — `U7B-RT15 worker classifies retry backoff exhaustion dead-letter and stale-intent cancellation`; `supabase/tests/phase9/phase9Unit7bPublicationRetry.integration.test.mjs` — database lease/reclaim/backoff/dead-letter and committed-transient cases; `supabase/tests/phase9/phase9Unit7bPublicationWorker.integration.test.mjs` — actual production worker rescheduling and lease release |
| 16 | Legacy write-path denial | `supabase/tests/phase9/phase9Unit7bPublicationRetry.integration.test.mjs` — `U7B-RT16 authenticated direct publication-field updates are denied`; `src/features/stores/services/__tests__/storeInventoryService.test.ts` — `U7B-RT16 legacy store service delegates publication and pause to the controlled Unit 7B boundary` |
| 17 | Public-media contract | `supabase/tests/phase9/phase9Unit7bPublicationMedia.integration.test.mjs` — `U7B-RT17 public copy travels through authorization registration sanitation promotion linking refresh and revocation`; `supabase/functions/__tests__/phase9_owner_publication.test.ts`, `phase9_ingestion_edge_runtime.test.ts`, and `src/features/imageInventory/__tests__/PublicCopyMediaManager.test.tsx` cover the actual Edge/worker/mobile flow; the migration test covers constraints and triggers |
| 18 | Closed-session-summary freeze | `supabase/tests/phase9/phase9Unit7bPublicationMedia.integration.test.mjs` — `U7B-RT18 later publication pause and retry do not change the closed ingestion summary`; `src/features/imageInventory/__tests__/ClosedSessionSummary.test.tsx` — immutable ingestion outcomes |
| 19 | Controlled Owner read boundary v2 | `supabase/tests/phase9/phase9Unit7bPublicationMedia.integration.test.mjs` — `U7B-RT19 Owner inventory v2 exposes bounded publication fields and all four status filters while v1 is unchanged`; `src/features/imageInventory/__tests__/publicationContractIntegration.test.tsx` — real decoder/query/control integration |
| 20 | Audit/event ownership | `supabase/tests/phase9/phase9Unit7bPublicationMedia.integration.test.mjs` — `U7B-RT20 one successful state command emits one audit and one event while replay and projection trigger emit zero duplicates` |

## Additional contract-layer gates

These cases enforce the transport and UI requirements supporting the numbered
red tests; they do not replace any row above.

- `supabase/functions/__tests__/phase9_owner_publication.test.ts` — strict
  action allowlist, unknown-field rejection, authentication forwarding, and
  deterministic 4xx versus transient HTTP 202 mapping.
- `src/features/imageInventory/__tests__/publicationContractIntegration.test.tsx`
  — realistic published/private response, transient `publication_failed`
  response with Retry, and deterministic correction response without Retry,
  each through the real client decoder and query/model.
- `src/features/imageInventory/__tests__/OwnerInventoryPublication.test.tsx` —
  publish, pause, private, retry, public-media management, status filters,
  online-only/no-optimistic commands, and canonical query invalidation.
- `supabase/migrations/__tests__/marketplacePhase9Publication.test.ts` — one
  forward-only migration, single projection writer, grants, v2 read boundary,
  retry fencing, dispatcher allowlist, and unchanged applied migrations.

## 2026-08-13 Sol Light material subcases

- `phase9Unit7bCorrectionMatrix.integration.test.mjs` proves shared rollout and
  post-publication fail-closed behavior, moderation preservation/restoration,
  ISBN/server-group discovery, complete targeted media retraction, and exact
  successful worker replay after lease clearance. Its CORR-001 latest-row case
  also proves that a newer cancelled subscription overrides older allowed
  subscription history for both discovery and republish.
- `unit7bCrossLayerDatabaseHarness.mjs` and
  `publicationContractIntegration.test.tsx` pass disposable M40 RPC results
  through production Owner Edge runtime/error mapping, captured transport, the
  real client decoder/query invalidation, and rendered controls. The response
  DTO is not manufactured by the test.
- `phase9_unit7b_concurrency.ps1` proves store-row serialized active-listing
  admission in addition to RT05, RT07, RT12, and Owner reauthorization.
- Established Phase 9 database regressions continue to prove approved active
  variants only and M07 stable store-group cursor boundaries; corrected M40
  calls that active-variant authority and groups before limiting.
