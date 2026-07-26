# Phase 9 Database and Storage: Current vs Target

**Audit date:** 2026-07-26
**Audit mode:** read-only Supabase MCP verification; no mutation
**Verified project:** `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`)
**Mutation status:** M01-M08/M10 live-verified; local forward M11/M12 exist but were not applied; no live data/Storage/function mutation

**Unit 4 vision-analysis refresh:** exact-project read-only verification on 2026-07-26 reconfirmed M01-M08/M10 as the complete live Phase 9 migration tail, so M11/M12 remain unapplied. Live jobs have `open|in_progress|retry_scheduled|resolved|resolved_noop|cancelled|dead_letter`, attempts `0..5`, worker/expiry leases, and only service-executable generic `claim_phase9_jobs`/`fail_phase9_job`; they have no attempt-token field or vision-specific RPCs. Live candidates retain `(input_id,candidate_index)` uniqueness and no publisher/job/schema/immutable-analysis lineage. The verified table grants remain absent for `anon`/`authenticated` and present for `service_role`. The Edge Function list contains neither Owner ingestion nor vision analysis. Local forward M12 now implements the approved delta after M11, including correction-review fencing, database-owned hashing/validation, and job-only relationship reconciliation; no external mutation occurred.

**Ingestion foundation checkpoint:** fresh read-only project verification on 2026-07-23 reconfirmed project `ahntbtktjjmvfosgkmgn`, both private 10 MiB JPEG/PNG/WebP buckets, and the existing M01-M08/M10 relations/RPCs. Local M11 revokes authenticated execution of path-taking legacy intake RPCs; adds declared source/content identity, persisted canonical completion, capability linkage, immutable private source snapshots, opaque claim-token and attempt fencing, 16 MP enforcement, and service-only issue/register/claim/context/revalidate/snapshot-bind/complete/fail functions. It is un-applied and awaiting independent review; no runtime is deployed.

**WU0 refresh:** a second read-only check on 2026-07-19 reconfirmed project identity, 37 `store_id`/zero `tenant_id` public columns, the five core catalogue/inventory tables, absence of proposed Phase 9 tables/buckets, five `good` inventory rows, zero observed quantity-balance violations, the explicit listing projection trigger, and the current migration tail. No drift changed the proposed design.

**Package 1 refresh:** a fresh read-only audit on 2026-07-22 reconfirmed the exact healthy project, live history through Phase 6 M39, 37 `store_id`/zero `tenant_id` columns, one canonical work/edition, zero metadata-source rows, five `good` inventory/listing rows, zero quantity violations, and the still-`NOT VALID` balance CHECK. It additionally captured exact columns/constraints/indexes, role grants, RLS policies, relevant function/trigger privileges, eight Storage buckets/object policies, proposed-name collision checks, and 121 security/314 performance advisor notices. The complete evidence and exact proposed grouping are in [Package 1 live audit](../work-units/01-package1-live-audit.md) and [database design](../work-units/01-package1-database-design.md). No Supabase or Storage mutation occurred.

**Package 1 correction:** the six required review corrections are documentation-only: executable condition compatibility ordering; persisted single-use upload authority; named-only private query/command access; exact cost-reservation uniqueness; first-possible deferred FKs; and eight additive groups plus separately authorized M09 quantity validation. No second live query was required because no corrected exact-current-state claim changed.

**Local implementation checkpoint:** M01-M08 now implement the approved additive target in repository SQL. An executable snapshot of the Phase 9-relevant Phase 6 surface migrated cleanly and the isolated security/behavior suite passed 19/19. During correction, a strictly read-only exact-project schema readback reconciled live column names (`display_name`, `setup_status`, `selling_status`, `source_book_id`, `selling_price_minor`, `visibility_status`, `public_title`, `public_authors`, `user_id`, `actor_user_id`, and the Phase 6 hold version/release/command columns) with the fixture and SQL. No connected Supabase or Storage mutation occurred. The existing quantity-balance constraint remains intentionally `NOT VALID` pending a separately reviewed M09.

**Live application checkpoint:** M01-M05 applied once. Live readback then proved `storage.objects` RLS was already enabled and owned by `supabase_storage_admin`; reviewed correction `e07efa1` removed only the redundant owner-only M06 RLS statement. Fresh preflight passed and M06-M08 applied once as `20260722095443`, `20260722095545`, and `20260722095729`. M06 Storage and M08 request-photo/privacy readbacks passed, while M08's broad function loop revoked M07's three anonymous discovery grants. Red-first forward correction M10 was independently approved, committed/pushed as `31253ad`, and applied once as `20260722125256 marketplace_phase9_public_boundary_security_correction`. Live readback proves exactly those three RPCs are anonymous, the eight request-photo RPCs remain authenticated-only, eight internal helpers remain service-only, private-table client grants are zero, the 24-field projection has `security_barrier=true` and `security_invoker=true`, and direct view access is absent. The Phase 9 `security_definer_view` error is resolved. Advisors are now security 174 (`INFO 46/WARN 127/ERROR 1`) and performance 350 (`INFO 199/WARN 151`); the three new WARNs intentionally describe the approved anonymous SECURITY DEFINER query boundaries, while the remaining ERROR is the legacy `public.spatial_ref_sys` RLS finding. M09 remains absent and the quantity CHECK remains `NOT VALID` with zero violations.

## Evidence classification

- **Observed** means read from the verified live database, storage catalogue, advisor output, migration list, or inspected repository source.
- **Inferred** means a consequence of the observed design.
- **Proposed** means the target for a later reviewed migration/implementation.

## Project and tenancy

| Area | Observed current state | Proposed target |
| --- | --- | --- |
| Project identity | `ahntbtktjjmvfosgkmgn`, `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`, `ap-southeast-2`, Postgres 17.6.1. | Re-verify this identity immediately before every Phase 9 migration action. |
| Tenant key | 37 `store_id` columns and zero `tenant_id` columns in `public`. | Use `store_id` for every store-owned Phase 9 table and path. |
| Owner authority | Store relationship is represented by `store_administrators`; existing RLS uses `marketplace_sec.is_store_admin(store_id)`. | Server resolves the final store from auth/membership. A client `store_id` is only a target hint and never authority. |

## Core data model delta

| Object | Observed current state | Proposed target/change |
| --- | --- | --- |
| `canonical_works` | Has normalized/primary title, authors, optional language. Unique on `(title_normalized, primary_authors)`. Public-readable under RLS. | Audit language-aware collision behavior. Do not use aliases as identity. Avoid automatic global work creation from uncertain entries. |
| `canonical_editions` | Has ISBNs, title/subtitle, authors, publisher/date/language/cover/pages/categories. ISBN-10 and ISBN-13 each unique. | Add description, edition statement, volume, format/binding, and metadata verification/provenance fields or an equivalent normalized projection. Preserve separate translated/language editions. |
| `book_metadata_sources` | Stores provider/raw/normalized/confidence. Provider CHECK hard-codes `google_books`, `open_library`, `isbn_provider`, `manual`; unique `(provider, provider_book_id)`. | Replace provider enum-like CHECK with provider registry/adapter key validation; add request/result status, match rationale, schema/adapter version, expiry/cache metadata, and payload retention. |
| `store_inventory` | 33 fields; lacks language, description, edition, volume, format, structured damage, typed media, freshness, acquisition type/method/MRP. Canonical edition may be null. | Add store-owned metadata snapshot fields, damage/freshness/acquisition fields, commit provenance/version, and typed links. Keep canonical link nullable. |
| `marketplace_book_listings` | One projection per `inventory_id`; lacks language, description, aliases, structured damage/media/freshness. | Extend safe projection with public metadata/damage/media/search fields. Preserve one projection per inventory row; visual grouping occurs in query/UI, not DB merging. |
| Projection trigger | Explicitly copies current inventory fields; revoked from anon/authenticated and executable by service role. | Extend or replace with a controlled projection writer covering new public fields and eligibility. Projection failure must be observable; no silent inventory/public divergence. |
| Image extraction tables | M02 is live through M10: extraction sessions/inputs/candidates/jobs and metadata attempts exist with private grants/RLS. Generic claim/fail is service-only but worker-ID-fenced. Candidate evidence lacks publisher/job/schema/immutable-analysis lineage. Local M11/M12 are unapplied. | After separate application authorization, M11 provides token fencing and M12 adds private immutable analysis result/observation evidence, candidate lineage, and vision-specific token/attempt RPCs. Fixture runtime remains local-only/undeployed. |
| Alias storage | No multilingual alias table or listing alias projection exists. | Add provenance-bearing aliases targeted to either a canonical edition or unmatched store inventory with an XOR target constraint. Only approved/eligible aliases enter public search. |
| Media registry | M03 is live and provides typed `media_assets` plus private/public/request link structures; legacy inventory `photos text[]` remains for compatibility. Local M11 adds no public promotion and links only validated private scan media. | Preserve typed purpose/privacy/hash/retention boundaries and defer legacy-field retirement/public promotion to separately authorized work. |
| Upload capabilities | M02/M05 capability rows exist live, but the legacy authenticated RPC accepts the final path. | Local M11 removes authenticated path authority and adds server-generated exact paths plus declared/observed object identity. Not applied. |
| Cost reservation | No Phase 9 reservation relation exists. | Enforce unique `(store_id, job_id, cost_kind, policy_version)` reservations. |
| Customer request photos | No request-specific photo table/gate exists. | Add orthogonal item photo request and media link structures; integrate with existing request versions/commands and `awaiting_customer_decision`. |

## Constraints and live data

| Area | Observed | Migration implication |
| --- | --- | --- |
| Conditions | `new`, `like_new`, `good`, `fair`, `damaged`. | Install a temporary union CHECK and update legacy validators/triggers before mapping `fair -> acceptable`; adjudicate `damaged` into a base condition plus separate damage data; then validate an exact five-value final CHECK. |
| Current rows | Five inventory rows and five public projections; all are `good`. | Today no live `fair`/`damaged` adjudication is needed, but the migration must still be safe if data changes before application. Re-query immediately before migration. |
| Quantity equality | `quantity_total = available + reserved + sold + removed` exists `NOT VALID`; existing rows were previously audited as non-violating. PostgreSQL still enforces the CHECK for new/updated rows while historical validation remains pending. | All commits/increments use the controlled bucket-transfer boundary. Keep validation out of M01-M08; M09 requires a fresh violation preflight, separate review/application authorization, validation, and `convalidated=true` readback. |
| Provider values | Provider CHECK embeds concrete vendors. | Migrate without losing provenance; adapter keys become data/config, not schema releases. |
| Listing cardinality | Unique `marketplace_book_listings.inventory_id`. | Keep row identity separate; aggregate offers and stores at read time. |
| Canonical uniqueness | Unique ISBNs; unique work title/authors without language. | Normalize/check ISBNs before write. Audit work uniqueness before adding language-aware semantics; do not loosen blindly. |

## RLS, grants, and write boundaries

Observed relevant core tables have RLS. Store inventory currently allows authenticated owner INSERT/UPDATE under `is_store_admin`; public listing rows are trigger-maintained and public-readable through safe eligibility policies. `book_metadata_sources` is platform-operator writable.

Proposed boundary:

1. Mobile clients use named Q01-Q06/Q11 RPCs or dedicated positive-allowlist views for owner-safe projections and named commands for upload authorization; they receive no direct private base-table SELECT grant.
2. Mobile clients do not directly insert committed inventory from model output, mutate canonical rows, select raw provider/model payloads, or promote media.
3. A controlled server command performs candidate commit, duplicate choice, quantity-bucket changes, audit/event creation, and eligible public projection atomically per candidate where possible.
4. Service-role functions/Edge Functions derive actor/store, use fixed schemas/search paths, expose minimum commands, and have explicit grants plus cross-tenant denial tests; worker/service access is separately enumerated from authenticated access.
5. Model/provider workers have a narrow job capability, not a user bearer token and not general database authority.

For Unit 4, local M12 implements `claim_phase9_vision_jobs`, `phase9_vision_job_context`, `phase9_persist_vision_analysis`, and `phase9_fail_vision_job`. Each function is service-only, pins `search_path`, rejects NULL security/transition arguments, proves row existence, and validates job kind, attempt, owner, token hash, expiry, and complete store/session/input/media relationships. Invalid relationships use the approved exact-claim job-only reconciliation result and never mutate unverified related rows. One persistence transaction recursively validates the canonical positive allowlist, computes the UTF-8 normalized-`jsonb` hash, inserts immutable image/observation evidence and accepted candidates, and then performs terminal input/job updates. It cannot call metadata, inventory, listing, publication, or Storage operations.

## Storage delta

| Bucket/boundary | Observed | Target |
| --- | --- | --- |
| `image-extraction-inputs` | Live M06: private, 10 MB, JPEG/PNG/WebP; direct authenticated-owner mutation policy removed and object writes are service-mediated. | Local unapplied M11 retains it as the private, service-only immutable-snapshot and sanitized-output boundary; validate/re-encode/strip metadata before future model egress and delete by lifecycle policy. |
| `inventory-photos` | Public, 5 MB, JPEG/PNG/WebP; owner can write directly under shared store path policy. | Use only for approved sanitized public derivatives. Remove direct unsanitized promotion; no broad listing policy. |
| `order-dispute-evidence` | Private, 10 MB, images/PDF; owner and broad platform roles can read by store path. | Keep for disputes. Do not use as the sole request-photo store because customer/item access and lifecycle differ. |
| `listing-photos` | Public legacy bucket, user-ID path ownership, broad public SELECT/list policy. Advisor flags enumeration. | Exclude from Phase 9. Remediate/migrate separately before relying on it. |
| `marketplace-media-staging` | Live M06: private, 10 MB, JPEG/PNG/WebP; no direct authenticated-client object policy. | Local unapplied M11 uses this live bucket for exact server-generated, capability-bound one-time uploads and failed-staging cleanup; runtime remains undeployed. |
| `order-request-photos` | Live M06: private, 5 MB, JPEG/PNG/WebP; server-mediated object writes. M08 added the request-photo command seam. | Retain as the separate request-item/customer/store-scoped boundary; customer-request-photo runtime remains outside this ingestion slice. |

## Security advisor context

The refreshed 2026-07-19 security advisor snapshot contains 121 notices: 31 RLS-enabled/no-policy, 7 mutable function search paths, 1 public table without RLS, 1 public extension, 3 public bucket listing warnings, 4 anonymous and 73 authenticated executable `SECURITY DEFINER` warnings, and leaked-password protection disabled. The error-level RLS notice names `public.spatial_ref_sys`. Table inspection also reports no RLS on `marketplace_event_schema_registry` and `marketplace_notification_type_registry`; those registry/service-only intentions require explicit grant/exposure review, not an assumed blanket remediation.

These are not all Phase 9 findings; some no-policy tables are deliberately server-only and some RPCs are intentionally callable commands. They are nevertheless a launch review backlog. Phase 9 must:

- create no new table with unexplained/no-policy RLS;
- create no broadly executable helper or trigger function;
- document every callable command's intended role, internal auth, grants, and denial tests;
- create no public bucket listing policy;
- treat leaked-password protection and unrelated legacy findings as global launch/security work, not hide them inside Phase 9 completion.

Advisor remediation references:

- [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [RLS disabled in public](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)
- [Public bucket allows listing](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing)
- [Authenticated executable SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Migration design order (not yet authorized)

1. Re-verify project, live rows, migrations, policies, functions, triggers, indexes, buckets, and advisors.
2. Add new types/tables/columns in backward-compatible form without changing public behavior.
3. Add indexes, constraints `NOT VALID` where appropriate, RLS, explicit grant matrices, and controlled commands; revoke ambient table/function privileges.
4. Backfill deterministic fields and create an adjudication queue for non-deterministic rows.
5. Switch application writers/readers behind feature flags.
6. Extend safe public projection and search.
7. Validate data/constraints after evidence passes.
8. Deprecate legacy photo arrays/direct paths only after all readers migrate.
9. Use forward correction for any live issue; do not rewrite applied history.
