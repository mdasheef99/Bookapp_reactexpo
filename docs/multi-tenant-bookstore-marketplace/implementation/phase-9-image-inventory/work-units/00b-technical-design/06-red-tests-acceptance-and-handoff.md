# WU0B Red Tests, Acceptance, Audit Questions, and Handoff

**Status:** `implementation_complete_needs_review`
**Independent review:** not yet performed

## 1. Red-test mapping

These tests are future failing evidence before their production unit. WU0B creates no test files.

| Gate / WU0A red gate | Operations | Proposed future test | Required red reason / acceptance |
| --- | --- | --- | --- |
| TENANT / `P9-RED-TENANT-01` | all C/Q private operations | `phase9_owner_boundary.test.ts`, `phase9_request_photo_boundary.test.ts`, migration security tests | Store A/B, two-Owner initiator, Customer A/B, forged store/entity and pooled/reused-connection access currently have no authorized boundary |
| UPLOAD / `P9-RED-UPLOAD-01` | C02,C03,C15,C16,C20,C21 | `phase9_media_security.test.ts` | expired/replayed/wrong-purpose/entity/sequence capability and unsanitized media fail closed |
| VISION / `P9-RED-VISION-01` | vision job | `phase9_vision_contract.test.ts` | max one whole-image fallback, valid no-books no fallback, no CI provider call |
| METADATA / `P9-RED-METADATA-01` | metadata/alias jobs | `phase9_metadata_contract.test.ts` | local-first coherent edition selection, no field stitching, aliases search-only |
| STATE | C01,C04-C07,C13-C19 | `phase9_state_commands.test.ts` | nonterminal Close remains active, closed rejects input, stale versions and opposite terminal decisions conflict |
| IDEMPOTENCY | all C operations/jobs | `phase9_idempotency.test.ts` | same key/fingerprint canonical replay; mismatched fingerprint conflicts; no duplicate cost/state/write |
| COMMIT / `P9-RED-COMMIT-01` | C08-C10,C23 | `marketplacePhase9InventoryCommands.test.ts` | one candidate commit, locked duplicate recompute, quantity equality and active-hold race |
| PUBLICATION / `P9-RED-COMMIT-01` | C11,C12,C25,C26 | `phase9_publication.test.ts` | private commit survives failure; retry cannot create/increment; pause retracts only projection |
| DTO/PRIVACY | every external DTO/event/log | `phase9_privacy_contracts.test.ts` | unknown/forbidden recursive keys, token/path/raw/PII leakage rejected |
| DATABASE PRIVILEGE / `P9-RED-TENANT-01` | future tables/functions | migration security tests | direct authoritative writes, ambient EXECUTE, `search_path` poisoning and grant/RLS mismatch denied |
| MARKET / `P9-RED-MARKET-01` | Q07-Q10 | `phase9_marketplace_boundary.test.ts`, `marketplacePhase9MarketplaceQuery.test.ts` | Q07 not client callable; store groups paginated once; cursor context/tie/count/privacy semantics |
| PHOTO / `P9-RED-PHOTO-01` | C14-C19,Q11 | `phase9_request_photo_boundary.test.ts`, `marketplacePhase9RequestPhotos.test.ts` | private media, actor isolation, no duplicate influence, existing Phase 6 guard use |
| WORKER | all job kinds | `phase9_worker_auth.test.ts`, `phase9_jobs.test.ts` | user/unclaimed service denied; double claim/stale finish/lease expiry/crash recovery deterministic |
| LIFECYCLE / `P9-RED-LIFECYCLE-01` | retention/orphan jobs | `phase9_lifecycle.test.ts` | hold/relink beats deletion; missing-object replay succeeds; non-content evidence remains |
| SCOPE | whole unit | continuity validator | any runtime/test/migration/config/dependency/generated/Supabase change causes failure |

## 2. Operation coverage

The catalogue contains 26 commands (C01–C26) and 11 queries (Q01–Q11). Every command identifies actor/trust boundary, strict request DTO, server-derived authority, preconditions, transaction, expected version, idempotency, surviving effect, stable error/HTTP mapping, events, telemetry/forbidden data, rate class and red references. Every query identifies actor/boundary, authority, projection, ordering/cursor/version/cache, failure effects, errors, rate and red references. Common envelope rules are normative and must not be bypassed by a transport-specific shortcut.

## 3. Acceptance checklist

- [x] Seven cohesive artifacts exist and remain within 350 lines.
- [x] C01–C26 and Q01–Q11 are complete and use closed DTO/error/rate catalogues.
- [x] Actor, initiating-Owner, same/cross-store, customer and worker authority are explicit.
- [x] Server-derived `store_id`, RLS/grant backstops, capability purposes and denial evidence are explicit.
- [x] External projections, events and telemetry use positive allowlists with forbidden-field enforcement.
- [x] State, transaction, version, idempotency, quantity and failure-surviving-effect semantics are explicit.
- [x] Private commit and non-mutating publication retry are separate.
- [x] Job claim/lease/retry/cost/crash/lifecycle and provider/media interfaces are explicit.
- [x] Q07 internal matching and Q08 store-grouped pagination/cursor/count semantics are separate.
- [x] Customer request-photo flow uses only the existing Phase 6 pre-payment seam and excludes Phase 7/8.
- [x] Exact proposed future file paths are named without wildcard authority.
- [x] Database-dependent facts are marked `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.
- [x] No runtime, test, migration, provider, storage, UI, dependency, generated or Supabase change is part of WU0B.

## 4. Independent-review gate

This artifact set may hold only `implementation_complete_needs_review`. It becomes `independently_approved` only after a separate review checks all artifacts against the approved WU0B definition, WU0A registers, Phase 9 SDD acceptance criteria and inspected repository boundaries; records an explicit verdict; and verifies every required correction. Completion and independent approval cannot be one transition.

The independent reviewer must specifically challenge: command/query completeness; server-derived authority; same-store initiator rules; error catalogue extensions; surviving-effect truthfulness; quantity/hold races; publication retry non-mutation; worker lease/cost replay; media purpose crossing; public grouping/cursor counts; Phase 6 photo seam; proposed later file allowlists; and all database-audit markers.

## 5. Questions deferred to the fresh live audit

All are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`:

1. Exact project identity/health and live migration versions after this documentation unit.
2. Current inventory/listing/request/task columns, types, constraints, indexes, row counts and condition/provider values.
3. Quantity equality constraint validation state and any violating/adjudication rows.
4. Current RLS policies and direct grants for affected tables/functions through actual API/pool roles.
5. Function definitions, volatility/security mode, pinned search paths, EXECUTE grants and trigger dependencies.
6. Listing projection trigger/function fields, unique inventory identity and compatibility sequencing.
7. Current Phase 6 request-item/hold/recalculation command names, versions, locks and allowed pre-payment transitions.
8. Current job claim/lease/task schema and whether reuse or isolation is safer for Phase 9.
9. Storage buckets, object policies, legacy public listing exposure, purpose separation and existing object counts.
10. Advisor findings before/after scope classification, including pre-existing notices.
11. Query/index plans for initiator resume, duplicate advice, jobs, aliases, store grouping/cursor ranking, publication retry and lifecycle cleanup.
12. Exact migration filenames/order after evidence; proposed names in artifact 00 are not creation authority.

## 6. Unresolved non-database configuration gates

Concrete providers/models, vendor terms, supported-language rollout, prompt/model versions, quotas, timeouts, capability TTL, byte/pixel limits, circuit thresholds, retention/legal policy and pilot accuracy thresholds remain later configuration/legal/operations decisions. Locked bounds remain: 15 candidates, one vision fallback, 1–3 request/public-copy photos and WU0A validation limits.

## 7. Handoff

Outcome: `wu0b_implementation_complete_needs_independent_review`.

No database, migration, runtime or external authority follows from these artifacts. The only next action is: **Authorize an independent review of the completed WU0B technical-design artifacts only.**
