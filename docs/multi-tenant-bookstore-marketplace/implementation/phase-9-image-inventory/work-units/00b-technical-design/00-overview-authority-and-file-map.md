# WU0B Technical Design: Authority, Architecture, and File Map

**Status:** `independently_approved`
**Scope:** documentation-only backend/API technical design
**Runtime/database authority:** none

## 1. Authority and traceability

This artifact set implements the approved [WU0B definition](../00b-backend-api-technical-design-plan.md) without creating runtime behavior. WU0A remains authoritative for versioned contracts, strict validation, deterministic policies, error and grant registers, provider reuse, marketplace cursor semantics, and red gates. The Phase 9 master and domain SDDs remain the behavior authority; these artifacts assign that behavior to future boundaries.

Every future boundary derives `store_id` from authenticated membership and the target entity. Client-supplied store identity is routing input at most. RLS is a backstop, direct client writes to authoritative tables are forbidden, external calls never occur inside database transactions, and Phase 7/8 payment, paid-order, ledger, settlement, refund, and pickup behavior is excluded.

## 2. Source areas inspected

Read-only inspection covered:

- WU0A `supabase/functions/_shared/imageInventory/` contracts, registers, red gates, and deterministic domain policies;
- `_shared/marketplaceAuth.ts` and `_shared/serviceRoleAuthorization.ts` authentication patterns;
- `store-application` and `store-profile` controlled authenticated Edge Function patterns;
- `commerce-scheduler` and `commerce-task-worker` service authentication, lease, claim, idempotency, and retry patterns;
- Phase 3 inventory/listing, Phase 5 discovery, and Phase 6 request/task migrations and tests;
- consumer discovery schemas/services and Phase 6 command-identity conventions.

Inspection is evidence of repository conventions, not reuse authority. Live schema facts remain `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

## 3. Artifact inventory

| Artifact | Owns |
| --- | --- |
| This file | Authority, component map, exact proposed later-file allowlist, non-goals, gates |
| [Command/query/DTO catalogue](./01-command-query-and-dto-catalogue.md) | C01-C30, Q01-Q11, DTOs, boundaries, traceability, errors, HTTP, rate and abuse classes |
| [Authorization, tenancy, privacy](./02-authorization-tenancy-and-privacy.md) | Actors, server-derived scope, denials, grants, telemetry and forbidden fields |
| [State, transactions, idempotency](./03-state-transactions-idempotency-and-publication.md) | State machines, atomicity, concurrency, commit/publication and post-commit edits |
| [Jobs, providers, media](./04-jobs-providers-and-media-boundaries.md) | Job/lease contracts, adapter boundaries, cost, recovery, media capabilities and lifecycle |
| [Marketplace and request photos](./05-marketplace-and-request-photo-design.md) | Internal matching, store grouping/cursors/counts, storefront, Phase 6 photo seam |
| [Red tests and handoff](./06-red-tests-acceptance-and-handoff.md) | Test mapping, acceptance, unresolved audit questions and exact next gate |

## 4. Internal component boundary map

| Component | May do | Must not do |
| --- | --- | --- |
| Edge router | Method/content checks, correlation ID, strict DTO parse, invoke one service | SQL, authorization decisions, workflow transitions |
| Authenticated actor-dispatch boundary | For C12 only, accept Owner or service JWT, reject mixed/unknown authority, derive the caller-specific scope/claim and invoke one shared projection-retry service | Duplicate dispatch across Owner/worker boundaries; trust supplied caller/store; mutate inventory/quantity |
| Actor resolver | Validate JWT; resolve user, membership, target ownership and final `store_id` | Trust supplied `store_id`; expose service credentials |
| Capability resolver | Issue/verify short-lived purpose/entity/store/actor capabilities after final auth | Persist tokens; accept cross-purpose media |
| Orchestration service | Sequence policies, transactions, jobs and truthful outcomes | Hold DB transaction over provider/storage calls |
| Domain policy | Pure state, quantity, duplicate, eligibility, fallback and validation decisions | Network, SQL, actor lookup |
| Repository/transaction adapter | Execute one named atomic operation and expected-version predicate | Authenticate actors; choose policy |
| Job claimant | Claim bounded work with lease/attempt limits and `SKIP LOCKED` semantics | Use client bearer; claim outside allowed kind/store/purpose |
| Provider adapter | Translate strict versioned envelopes and normalize untrusted output | Set authority/state/retry/path/commands |
| Media service | Validate, sanitize, purpose-link, promote approved derivatives, delete idempotently | Reclassify scan/request media as public |
| Projection writer | Publish/retract safe listing projection after eligibility authorization | Create/increment inventory; leak private fields |
| Event/audit writer | Append bounded IDs, action, versions, outcome and codes | Store raw media/provider/model/customer content |
| Telemetry adapter | Emit allowlisted counters/durations/outcomes | Emit tokens, paths, payloads, PII or unrestricted text |

## 5. Exact proposed later implementation file allowlist

These paths are proposals, not authority. Migration names and database-facing files require the later live audit and exact migration-design approval.

| Later unit | Exact proposed files |
| --- | --- |
| Contract expansion | `supabase/functions/_shared/imageInventory/contracts/api.ts`<br>`supabase/functions/_shared/imageInventory/contracts/commands.ts`<br>`supabase/functions/_shared/imageInventory/contracts/queries.ts`<br>`supabase/functions/_shared/imageInventory/contracts/jobs.ts`<br>`supabase/functions/_shared/imageInventory/contracts/media.ts`<br>`supabase/functions/_shared/imageInventory/contracts/events.ts`<br>`supabase/functions/__tests__/phase9_api_contracts.test.ts`<br>`supabase/functions/__tests__/phase9_privacy_contracts.test.ts` |
| Owner command boundary | `supabase/functions/image-inventory-owner/index.ts`; `supabase/functions/__tests__/phase9_owner_boundary.test.ts` |
| Public query boundary | `supabase/functions/image-inventory-marketplace/index.ts`; `supabase/functions/__tests__/phase9_marketplace_boundary.test.ts` |
| Request-photo boundary | `supabase/functions/image-inventory-request-photos/index.ts`; `supabase/functions/__tests__/phase9_request_photo_boundary.test.ts` |
| Worker boundary | `supabase/functions/image-inventory-worker/index.ts`; `supabase/functions/__tests__/phase9_worker_auth.test.ts` |
| C12 shared publication-retry boundary | `supabase/functions/image-inventory-publication-retry/index.ts`; `supabase/functions/__tests__/phase9_publication_retry_boundary.test.ts`; the Owner and worker boundaries do not implement C12 |
| Domain/services | `supabase/functions/_shared/imageInventory/domain/states.ts`<br>`supabase/functions/_shared/imageInventory/domain/idempotency.ts`<br>`supabase/functions/_shared/imageInventory/domain/authorization.ts`<br>`supabase/functions/_shared/imageInventory/domain/publication.ts`<br>`supabase/functions/_shared/imageInventory/domain/jobs.ts`<br>`supabase/functions/_shared/imageInventory/domain/media.ts`<br>`supabase/functions/_shared/imageInventory/domain/marketplace.ts` |
| Repository adapters | `supabase/functions/_shared/imageInventory/repositories/sessions.ts`<br>`supabase/functions/_shared/imageInventory/repositories/candidates.ts`<br>`supabase/functions/_shared/imageInventory/repositories/inventory.ts`<br>`supabase/functions/_shared/imageInventory/repositories/media.ts`<br>`supabase/functions/_shared/imageInventory/repositories/jobs.ts`<br>`supabase/functions/_shared/imageInventory/repositories/marketplace.ts`<br>`supabase/functions/_shared/imageInventory/repositories/requestPhotos.ts` |
| Provider adapters | `supabase/functions/_shared/imageInventory/adapters/vision.ts`<br>`supabase/functions/_shared/imageInventory/adapters/metadata.ts`<br>`supabase/functions/_shared/imageInventory/adapters/aliases.ts`; fixture-backed tests only until live-provider authority |
| Migration groups P9-M01..M08 | `supabase/migrations/20260720000001_marketplace_phase9_registries_metadata.sql`<br>`supabase/migrations/20260720000002_marketplace_phase9_extraction_jobs.sql`<br>`supabase/migrations/20260720000003_marketplace_phase9_media_registry.sql`<br>`supabase/migrations/20260720000004_marketplace_phase9_condition_damage.sql`<br>`supabase/migrations/20260720000005_marketplace_phase9_inventory_commands.sql`<br>`supabase/migrations/20260720000006_marketplace_phase9_storage_boundaries.sql`<br>`supabase/migrations/20260720000007_marketplace_phase9_marketplace_query.sql`<br>`supabase/migrations/20260720000008_marketplace_phase9_request_photos.sql`; contents and filename suitability are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN` |
| Migration tests | `supabase/migrations/__tests__/marketplacePhase9RegistriesMetadata.test.ts`; `marketplacePhase9ExtractionJobs.test.ts`; `marketplacePhase9MediaSecurity.test.ts`; `marketplacePhase9InventoryCommands.test.ts`; `marketplacePhase9MarketplaceQuery.test.ts`; `marketplacePhase9RequestPhotos.test.ts` |

No directory wildcard is authority. Any future change must name its exact subset in the authorizing tracker entry.

## 6. Non-goals and later gates

This unit creates no SQL, endpoint, repository, worker, adapter, fixture, test, provider call, storage policy, UI, dependency, generated type, deployment, or Supabase query/mutation. Concrete table/function/bucket names, grants, indexes, live compatibility facts, migration timestamps, advisor deltas, and query plans are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

Ordered later gates are: independent WU0B review; fresh exact-project read-only Supabase audit; exact database/migration design; migration-file creation; isolated migration testing; separate live-application authorization and exact-project readback. Fixture-backed runtime slices require another explicit authorization.
