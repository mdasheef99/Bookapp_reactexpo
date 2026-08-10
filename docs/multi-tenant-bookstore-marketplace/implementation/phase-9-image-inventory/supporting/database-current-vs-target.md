# Phase 9 Database and Storage: Current vs Target

**Audit date:** 2026-08-04 WU1 exact-project application and post-application readback
**Audit mode:** exact-project migration, schema/security readback, ACL/RLS/trigger comparison, and bounded anonymous denial smoke
**Verified project:** `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`)
**Mutation status:** M01-M08/M10-M30 live exactly once; M09 absent; WU1 is live exactly once as `20260803221216 marketplace_phase9_owner_inventory_read_boundary`; no rows, users, fixtures, listings, publications, Storage objects, providers, deployments, or product-data mutation occurred

**Unit 5C-3 live reconciliation:** The existing Gemini provider call may return
an optional multilingual companion, but strict canonical `p9-vision-v2`
validation remains independent. Accepted companions persist through M18/M19
and reconcile confirmed Owner title and individual authors with store,
observation, and source-field isolation, narrow deterministic normalization,
material-change classification, default-deny activation, and trusted
proposed/active/stale transitions. M21 removes M20's temporary public search,
alias materialization, target linkage, and trigger/search effects. Unit 5C-4
then applied M22 as `20260729075459` and M23 as `20260729082153`; final live
semantics materialize/search only current active, exact-store/source/eligible-
target variants and preserve legacy approved-alias ranking. Rollback-only smoke
left no synthetic proposal, alias, link, inventory, or listing residue. Owner
decision authority/UI, customer display changes, benchmark/rollout records,
inventory/listing creation, publication, and commerce remain absent.

**Provider/scale SDD reconciliation evidence:** the 2026-07-27 bounded read-only provider audit reconfirmed the exact healthy project and migration tail with M09 absent. Live counts were five extraction candidates, one canonical edition, and zero provider-registry rows, metadata attempts, metadata sources, aliases, or usage reservations. The existing metadata-attempt table already records candidate, adapter, attempt sequence, normalized clues, status, provider record, match strength, latency, cache status, versions, reuse policy, payload lifecycle, and timestamps; it does not explicitly represent role, provider-independent query identity, capability/routing-policy version, predecessor outcome, coalescing lineage, or cost-reservation linkage. These are proposed Unit 5 design targets only. No database or Storage mutation occurred.

**Deployment refresh:** M13 is live once as `20260727025046`. Its 13
postgres-owned, empty-`search_path` public wrappers are `SECURITY INVOKER`,
fully qualified, static single-call delegations with execute only for
`service_role`; no definer wrapper was necessary. The private schema remains
unavailable through PostgREST. Owner ingestion and separate free-plan Render
media/fixture-vision services are live; all nine recorded fixture cases passed
through the normal claim/fencing/persistence/failure lifecycle. Detailed
non-secret evidence and retained synthetic deviations are in
[tracker 06](../trackers/06-fixture-pipeline-deployment-evidence.md).

**Unit 4 vision-analysis refresh:** M11/M12 applied sequentially on 2026-07-26 as `20260726182238` and `20260726182539`. Live jobs now have token/attempt fencing and vision reconciliation fields; immutable result/observation tables, candidate lineage, exact uniqueness, immutable triggers, and four service-only vision RPCs are live. Client table/RPC access remains denied. The Edge Function list still contains neither Owner ingestion nor vision analysis, and no data/Storage object changed.

**Unit 4B live M14:** exact-project MCP preflight reconfirmed project
`ahntbtktjjmvfosgkmgn` healthy, M14 absent, M01-M08/M10-M13 exactly once, M09
absent, and every dependent relation/column/constraint/function/grant/RLS
assumption. M14 applied once as `20260727183546`. Readback proves the empty
34-column `vision_provider_attempts` relation, all approved constraints and five
indexes, exact postgres-owned empty-search-path private/public RPC signatures,
RLS, service-role RPC execution, and zero anon/authenticated table or function
authority. M12/M13 fixture seams and retained evidence remain intact. Security
advisors add only the expected service-only RLS/no-policy INFO
([reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy));
performance advisors report three unindexed-FK and two unused-empty-index INFOs
([FK reference](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys),
[unused-index reference](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)).
No new security WARN/ERROR is attributable to M14.

**Unit 5A live delta:** M15 is live once as
`20260727222159 marketplace_phase9_metadata_foundation`. Live readback confirms
`phase9_metadata_lookups`, `phase9_metadata_cache_entries`, and
`phase9_selected_metadata_snapshots`; all planned attempt-lineage and candidate
snapshot-link columns; approved checks, foreign keys, unique identities, indexes,
and immutable trigger; eleven private helpers and eight invoker wrappers with fixed
search paths; zero anon/authenticated table or RPC authority; and the approved
claim/local/coalescing/routing/cost/storage/coherence/no-product-effect definitions.
Security verification did not close: project default privileges produced
`service_role=arwdDxtm/postgres` on each new table. M15 revoked client roles but did
not first revoke `service_role`, so its later `GRANT SELECT` did not narrow the
inherited ACL. A forward-only grant correction is required before Unit 5B.

**M16 local target:** read-only MCP inspection confirmed the same effective
`service_role` SELECT plus INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on
M14 `vision_provider_attempts`; all four tables have RLS and no anon/authenticated
authority. M16 explicitly revokes those six service mutation privileges per
table, restores SELECT, and repeats client denial without changing default
privileges, functions, data, constraints, or behavior. Local PostgreSQL
before/after inspection proves SELECT-only service access after M16, and all 13
M14/M15 public RPCs remain service-executable, client-denied, and fixed-search-path.
M16 is live once. It removes the six enumerated privileges, but PostgreSQL 17.6
readback reports `service_role=rm/postgres` and effective MAINTAIN=true on all
four tables. Client MAINTAIN remains false. A forward M17 must revoke MAINTAIN
before the intended SELECT-only target is documented as live or Unit 5B begins.

**M17 live closeout:** M17 is live once as
`20260727233457 marketplace_phase9_maintain_acl_correction`. Exact PostgreSQL
17.6 readback reports `{postgres=arwdDxtm/postgres,service_role=r/postgres}` on
the same four tables. `service_role` has SELECT and no
INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN; client roles have no
table authority. RLS, postgres ownership, all 13 service-only RPC signatures,
fixed search paths, and client EXECUTE denial remain unchanged. Each corrected
table remains empty. The target SELECT-only/RPC-mutation boundary is now live.

**M18 live closeout:** exact-project preflight confirmed M01-M08/M10-M17 once,
M09/M18 absent, the reviewed local SHA-256
`6f51fc74afa81890f6281047464dbbac3ad9aa70ffcb1b39294aaaa6907914f5`,
and every prerequisite object/signature. M18 is live once as
`20260729004216 marketplace_phase9_search_variant_proposals`. PostgreSQL 17.6
readback proves the complete relation/check/FK/index/timestamp shape, RLS,
postgres ownership, service SELECT-only/no-MAINTAIN table ACL, client denial,
fixed-empty-search-path private definer functions and public invoker wrappers.

**M19 replay-fence closeout:** the first independent staged-tree review found
that a different valid envelope could append after accepted M12 replay. The
single authorized forward correction preserved M18, required the verified
zero-proposal baseline, and added one private analysis-scoped immutable
fingerprint. M19 is live once as
`20260729020008 marketplace_phase9_search_variant_replay_fence`. PostgreSQL
17.6 readback proves postgres ownership, RLS/no policies, service SELECT-only,
no client access or `MAINTAIN`, fixed empty search paths, and no service access
to the renamed M18 helper. Rollback-only smoke proved exact replay and changed
replay rejection with zero residue; M01 aliases remain unchanged.
A rollback-only synthetic smoke proved accepted proposed-only persistence,
duplicate-free replay, mismatched-claim zero effects, title/author-position
separation, store-bounded reads, unchanged aliases, and zero residue.

**M20/M21 Unit 5C-3 closeout:** M20 is immutable applied history as
`20260729054842 marketplace_phase9_variant_runtime_search`. It temporarily
combined Unit 5C-3 reconciliation/lifecycle with Unit 5C-4 public search,
alias materialization, inventory/listing target linkage, and related
trigger/search behavior. It was not edited, reverted, or deleted. M21 is live
as `20260729060238 marketplace_phase9_defer_active_variant_search` and
forward-removes those Unit 5C-4 effects. Final live semantics retain Unit
5C-3 only. Rollback-only lifecycle smoke passed with zero synthetic residue;
proposal, proposal-set, and alias counts were zero at verification time.

**M22/M23 Unit 5C-4 closeout:** M22 is immutable applied history as
`20260729075459 marketplace_phase9_active_variant_search` and introduces the
active-only store-scoped title/individual-author materialization, target
linkage, retraction, and fail-closed search boundary. Independent review found
two bounded defects. M22 was not edited or reversed. M23 is immutable and live
as `20260729082153 marketplace_phase9_active_variant_search_correction`; it
forward-corrects legacy approved-alias rank preservation and stricter exact
source-field/source-text reconciliation. Final schema semantics are M22 plus
M23. Live rollback-only smoke passed with zero synthetic residue.

**M24-M28 live audit:** on 2026-07-30 exact tree
`66db5be740940a8c882bb7ea312817f4c33bb2db` received dual independent
`APPROVED`, then its exact M24-M28 bytes were applied to project
`ahntbtktjjmvfosgkmgn` as versions `20260730022442`, `20260730022524`,
`20260730022559`, `20260730022636`, and `20260730022713`. PostgreSQL 17.6.1
readback verified RLS, ACLs, fixed search paths, strict Owner/platform
authorization, no unintended `MAINTAIN`, and M18-M23 unchanged. M29 is absent.
Real two-connection replacement concurrency, benchmark/evidence/rollout
smokes, and cleanup passed with zero synthetic residue. There are no retained
benchmark manifests, approved languages, rollout rows, or enabled capabilities.

**Ingestion foundation checkpoint:** project `ahntbtktjjmvfosgkmgn` remains healthy; both private 10 MiB JPEG/PNG/WebP buckets remain unchanged. Live M11 revokes authenticated execution of path-taking legacy intake RPCs and adds declared source/content identity, persisted canonical completion, capability linkage, immutable private source snapshots, opaque claim-token and attempt fencing, 16 MP enforcement, and service-only issue/register/claim/context/revalidate/snapshot-bind/complete/fail functions. No runtime is deployed.

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
| Image extraction tables | M02/M11/M12/M13/M14 are live: token-fenced jobs, private immutable evidence, candidate and provider-attempt lineage, service-only invoker wrappers, and final egress validation exist. Fixture runtime remains deployed and live-verified. | Gemini configuration/deployment/live-provider verification remains separately authorized. |
| Variant/alias storage | M18-M28 live: Owner decisions/corrections, candidate-first replacement locking, canonical benchmark/rollout evidence, platform evidence reads, exact-evidence activation, trigger-version fencing, and truthful Owner policy reasons. | No language/capability is enabled; customer display, visual UI, inventory/publication/commerce, Google Books fallback, and global alias authority remain separate. |
| Media registry | M03/M11 are live and provide typed `media_assets` plus private/public/request link structures; legacy inventory `photos text[]` remains for compatibility. M11 adds no public promotion and links only validated private scan media. | Preserve typed purpose/privacy/hash/retention boundaries and defer legacy-field retirement/public promotion to separately authorized work. |
| Upload capabilities | M11 is live: authenticated execution of legacy path-taking RPCs is revoked and server-generated exact paths plus declared/observed object identity are present. | Preserve the service-only boundary during deployment. |
| Cost reservation | Live `phase9_usage_reservations` remains unique on `(store_id, job_id, cost_kind, policy_version)`; live M14 links each vision call to its reservation and reconciles summed finalized cost without hard-coded prices. | Populate only through a separately deployed/configured provider runtime. |
| Metadata attempt lineage | Live `metadata_enrichment_attempts` has adapter/sequence/query/status/cache/version/payload lifecycle fields and zero rows. | Proposed: role, provider-independent query identity, capability/routing-policy version, triggering outcome, coalescing and spend-reconciliation lineage. Do not claim these fields are live. |
| Provider registry | Live `phase9_provider_registry` exists and was empty at the read-only audit. | Keep credentials out; later design may reference capability, role/order, breaker, cache namespace, rate/concurrency, kill-switch, and promotion policy through configuration/versioned policy. |
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

Observed relevant core tables have RLS. A fresh exact-project read-only check on
2026-08-03 found that `public.store_inventory` has no `SELECT`, `INSERT`, or
`UPDATE` table privilege for `authenticated` (`anon` also has no `SELECT`),
while `service_role` retains the required private-table access. The existing
authenticated owner policies remain present, but policies cannot make a direct
PostgREST table call pass when the role has no table privilege. The
`phase9_owner_inventory` and named inventory-edit/quantity RPCs are the
available authenticated controlled boundary. Public listing rows are
trigger-maintained and public-readable through safe eligibility policies.
`book_metadata_sources` is platform-operator writable.

Proposed boundary:

1. Mobile clients use named Q01-Q06/Q11 RPCs or dedicated positive-allowlist views for owner-safe projections and named commands for upload authorization; they receive no direct private base-table SELECT grant.
2. Mobile clients do not directly insert committed inventory from model output, mutate canonical rows, select raw provider/model payloads, or promote media.
3. A controlled server command performs candidate commit, duplicate choice, quantity-bucket changes, audit/event creation, and eligible public projection atomically per candidate where possible.
4. Service-role functions/Edge Functions derive actor/store, use fixed schemas/search paths, expose minimum commands, and have explicit grants plus cross-tenant denial tests; worker/service access is separately enumerated from authenticated access.
5. Model/provider workers have a narrow job capability, not a user bearer token and not general database authority.

### WU1 owner-inventory read-boundary application (2026-08-04)

The development-only remediation addendum
[`owner-inventory-read-boundary-wu1-sdd.md`](../work-units/owner-inventory-read-boundary-wu1-sdd.md)
records the reviewed target for the missing Owner list boundary. The stable
`public.phase9_owner_inventory(uuid)` detail RPC remains unchanged. The
applied migration `20260803221216 marketplace_phase9_owner_inventory_read_boundary`
(local file `20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`)
adds only the separate `phase9_owner_inventory_page_v1` RPC, one
evidence-backed `(store_id, updated_at DESC, id DESC)` index, fixed
`search_path`, `postgres` ownership, and narrow execute grants. It added no
table privileges, policies, or trigger changes. Exact-project post-application
readback confirms the stable detail RPC, `store_inventory` RLS/policies/table
ACL, existing indexes/constraints, and projection trigger/function are
unchanged. Anonymous REST execution is denied; positive Owner JWT runtime is
deferred because no approved Owner credential was available.

The 2026-08-04 correction pass added fail-closed NULL page-size validation plus
safe unexpected-error normalization. Its `asOf`
cursor value is documented as an ordering horizon rather than a repeatable
database snapshot because existing quantity/publication writes do not uniformly
advance `updated_at`; those write paths remain outside WU1.

Live M12 implements `claim_phase9_vision_jobs`, `phase9_vision_job_context`, `phase9_persist_vision_analysis`, and `phase9_fail_vision_job`. M13 exposes only the minimum public invoker wrappers required by PostgREST while leaving the authoritative functions in `marketplace_sec`. Each function is service-only, pins `search_path`, rejects NULL security/transition arguments, proves row existence, and validates job kind, attempt, owner, token hash, expiry, and complete store/session/input/media relationships. Invalid relationships use the approved exact-claim job-only reconciliation result and never mutate unverified related rows. One persistence transaction recursively validates the canonical positive allowlist, computes the UTF-8 normalized-`jsonb` hash, inserts immutable image/observation evidence and accepted candidates, and then performs terminal input/job updates. It cannot call metadata, inventory, listing, publication, or Storage operations.

## Storage delta

| Bucket/boundary | Observed | Target |
| --- | --- | --- |
| `image-extraction-inputs` | Live M06/M11: private, 10 MB, JPEG/PNG/WebP; direct authenticated-owner mutation policy removed; tagged fixture verification retained 23 private snapshot/sanitized objects. | Delete only through a separately authorized lifecycle policy; do not treat retained evidence as disposable. |
| `inventory-photos` | Public, 5 MB, JPEG/PNG/WebP; owner can write directly under shared store path policy. | Use only for approved sanitized public derivatives. Remove direct unsanitized promotion; no broad listing policy. |
| `order-dispute-evidence` | Private, 10 MB, images/PDF; owner and broad platform roles can read by store path. | Keep for disputes. Do not use as the sole request-photo store because customer/item access and lifecycle differ. |
| `listing-photos` | Public legacy bucket, user-ID path ownership, broad public SELECT/list policy. Advisor flags enumeration. | Exclude from Phase 9. Remediate/migrate separately before relying on it. |
| `marketplace-media-staging` | Live M06/M11: private, 10 MB, JPEG/PNG/WebP; no direct authenticated-client object policy; exact capability-bound paths; tagged fixture verification retained 10 objects. | Cleanup remains a separately authorized lifecycle unit. |
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

## 2026-08-05 operational deployment note

The temporary Unit 4B Gemini test changed Render environment/deployment state
only. The exact Supabase project, migrations, schema, RLS/grants, Storage
objects, and current-vs-target database state were not mutated or re-read as part
of this deployment. A future provider-call smoke must re-verify the exact project
and use an approved sanitized-media job before any M14 evidence is claimed.

### 2026-08-10 local M36 worker-wake target delta

Fresh read-only evidence verified exact project `ahntbtktjjmvfosgkmgn`, live
migration tail `20260809223135 marketplace_phase9_single_image_removal`, one
claimable `media_validate_sanitize` job, and no Phase 9 cron job or named Phase
9 Vault secret. `pg_cron` 1.6.4, `pg_net` 0.19.5, and `supabase_vault` 0.3.1
are installed. Media and vision services are live at their recorded SHAs; no
metadata Render service exists.

Local M36 remains unapplied. It adds one postgres-private read-only
claimability helper, one postgres-private dispatcher, one seven-day-bounded
private dispatch-observation relation, and one named minute cron that is
inactive when the migration transaction commits. The helper exactly mirrors
the three current claim predicates and the dispatcher changes no job row. Six
fixed Vault names supply only worker origins and ingress tokens; neither values
nor HTTP bodies/errors are persisted in the M36 observation relation or Phase 9
application logs; pg_net's private request queue transiently carries the
Authorization header as required for delivery. Local tests cover all claimability states
and all three due-stage dispatch paths. No database, Vault, Cron, Render,
Storage, worker, provider, inventory, listing, or publication mutation occurred.
