# Phase 9 Database and Storage: Current vs Target

**Audit date:** 2026-08-21 final Unit 8 connected rollout readback
**Audit mode:** exact-project preflight, individually authorized forward migration application, connected acceptance, and post-rollout schema/data/trigger inspection
**Verified project:** `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`)
**2026-08-21 connected result:** the live project has one publicly eligible
inventory-media link, with zero eligible NULL, out-of-range, duplicate, or
over-three cases. M49, M50, and M51 are each live exactly once; the dedicated
Q08 Vault secret resolves without disclosure; Q08/Q09/Q10, grants/privacy,
legacy compatibility, cursor behavior, and continuity all pass. `public_order`
remains nullable, with the existing `1..3` check and
`(inventory_id,public_order)` uniqueness. M51 guards link approval and asset
lifecycle transitions without changing nullable private/unapproved state.

The durable connected evidence is [unit8-connected-rollout-2026-08-21.md](./unit8-connected-rollout-2026-08-21.md).

## Migration-history reconciliation — read-only 2026-08-21

The connected project reports 150 rows in `supabase_migrations.schema_migrations`;
the repository contains 153 migration files. Comparing logical migration names
found 143 shared names: 30 have identical version IDs and 113 have different
version IDs. The shared-name/version drift is systematic: local files use planned
timestamps (for example M47 `20260817000047` and M48 `20260817000048`), while the
connected project records their application timestamps (`20260817073341` and
`20260817075825`).

The live-only names are `harden_clubs_maintenance_rpc_execute_grants`,
`schedule_expired_club_member_actions_cleanup`,
`add_invitation_reminder_notifications`, and the four post-M48 unrelated
`marketplace_wishlist_notify_unify`, `reading_notes_fk_and_cleanup`,
`library_user_book_pages_vault`, and `library_word_limit_hardening`. The local-only
pre-Unit-8 names are `017_user_credit_balances_lockdown`,
`018_listings_city_visibility_policy`, `019_book_public_reviews_contract`,
`016_set_current_book_from_nomination`, `transfer_club_admin_rpc`,
`add_exchange_pickup_venue`, and `harden_club_primary_and_exchange_city`.
M49, M50, and M51 are intentionally pending local-only files.

The safe plan was to create an evidence-backed name/version/hash mapping and
classify every live-only and local-only migration before any action. That mapping
was independently reviewed before the bounded M49-M51 rollout. A normal
migration push, replay of the 113 shared files, or edit to `schema_migrations`
was not used. The complete 153-row local/150-row live mapping is recorded in
[migration-canonical-reconciliation-2026-08-21.md](./migration-canonical-reconciliation-2026-08-21.md).
Its normalized source comparison classifies 4 exact version/source matches,
93 same-logical/different-timestamp matches, and 46 divergent-content review
flags. No historical repair or unrelated migration was performed.
**Mutation status:** M01-M08/M10-M51 are live at their separately recorded checkpoints; M09 is absent. M39-M46 remain byte-immutable, M47 is live exactly once as `20260817073341`, M48 is live exactly once as `20260817075825`, M49 is live exactly once as `20260821060156`, M50 is live exactly once as `20260821060742`, and M51 is live exactly once as `20260821061213`. The Unit 8 rollout changed only the approved Q08/Q09/Q10/Vault/media-guard scope; no historical migration IDs, unrelated tables, Storage objects, business rows, Edge deployment, or unrelated service/function changed. The development `active_listing_limit` entitlement is 10 from source `unit7b_dev_rollout`. The Unit 7B implementation/documentation commit `9f3e646` is integrated into `main` at merge commit `53edbddc9c5417b34cb169599e8282b162e183b3`.

**Application ledger:** The exact project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`, `ACTIVE_HEALTHY`) and live M48 tail were re-verified before each Unit 8 step. Local M49 `20260818000049_marketplace_phase9_bookstore_first_discovery.sql` applied once as `20260821060156`; local M50 `20260820000050_marketplace_phase9_storefront_detail.sql` applied once as `20260821060742`; and local M51 `20260821000051_marketplace_phase9_public_media_order_invariant.sql` applied once as `20260821061213` through the explicit Supabase migration path. Vault metadata, function/trigger/constraint/index readback, Q08/Q09/Q10 connected acceptance, final ACLs, and explicit anon/authenticated role probes pass; no historical repair, Storage object, business-row, or unrelated service/function changed.

**Unit 7C WU1 applied state:** exact-project readback reconfirmed generated/default
listing-field ownership, the Unit 7C sync/projection functions, RLS, function
ownership/search paths/grants, and M45 as the live tail. M43 implements atomic
details Save, stock v2 and live zero-stock projection, Store View page/detail
RPCs, append-only safe public revisions, and audit/event integration. The exact
M01–M43 disposable PostgreSQL proof and live M43 readback pass. M39–M45 remain
immutable. Owner media read/reorder/remove/replace is now schema-live through
M45. M46 corrects only the private-Save/public-revision boundary; the bounded
connected private-only Save reproof passed through existing Owner Edge v8.

**Unit 7C WU2A applied state:** M44 adds only authenticated Store View page v2.
It reuses M43's item composition, filters the `needs_attention` bucket by
`attentionState = action_required` and the other named state buckets by
canonical `effectiveState` before keyset pagination, and rejects
actor/store/filter cursor mismatches. Exact M01–M44 replay,
the WU1 vertical, and the six-filter/two-tenant real PostgreSQL proof pass.
M44 readback confirms one `phase9_store_view_page_v2(integer,text,text)` function;
M39–M45 are byte-immutable.

## Legacy Marketplace RPC security correction (M47/M48)

The live pre-change objects were exactly
`public.phase9_storefront_catalogue(uuid,integer,jsonb)` and
`public.phase9_listing_detail(uuid)`. Both were postgres-owned `SECURITY DEFINER`
functions with `search_path=""`, returned `SETOF phase9_public_listing_projection`,
and exposed private `inventory_id` in the row shape. The current repository
Marketplace client uses only `phase9_public_listing_search_v2(text,uuid,integer)`
and `phase9_public_listing_detail_v2(uuid)`.

Repository search, all 12 live Edge Function readbacks, and the live SQL
function-definition scan found no caller of either legacy RPC. M47 first
revoked all non-owner execution. Because applied migrations are immutable, M48
is the minimal forward correction: it reasserts `REVOKE EXECUTE` from
`PUBLIC, anon, authenticated` and restores only `service_role` `EXECUTE`.
Final ACLs are `{postgres=X/postgres,service_role=X/postgres}` for both legacy
functions. Explicit customer-role calls and direct projection-view reads fail
with `42501`; trusted service-role detail execution succeeds; v2 anon and
authenticated search/detail calls remain allowed and return the allowlisted
JSON shape without `inventory_id`.

Post-M48 read-only counts are `store_inventory=10`,
`marketplace_book_listings=9`, `phase9_public_listing_projection=9`, Storage
buckets `10`, and Storage policies `19`.

## U8B repository-only acceptance evidence (2026-08-20)

M49, `20260818000049_marketplace_phase9_bookstore_first_discovery.sql`, is a
repository migration and is **not live**. A fresh disposable PostgreSQL cluster
replayed the local prerequisite chain through M49, used a test-only Vault
compatibility bootstrap and test data, and passed the Q08 grouping, policy-bound
cursor, malformed-cursor, cover-provenance, DTO-privacy, role/grant, and
search-path assertions with `U8B_REAL_POSTGRES_ACCEPTANCE_PASS`. The bootstrap
and cluster were temporary test artifacts and were removed by the runner.

This does not update the verified Supabase state above: the live tail remains
M48, no migration-history reconciliation was performed, no Q08 Vault secret was
provisioned, and no live function, grant, table, Storage object, business row,
or deployment changed. M49 application remains separately authorized.

**Unit 7B live delta:** M40 adds the dual-version controlled publication
commands, intent-keyed retry claim/token fencing, v2 Owner inventory page,
closed-session-summary freeze, safe public DTO/RPC boundary, one-primary-
fallback and sanitized-public-media enforcement, authoritative listing-sync
trigger reconciliation, bounded audit/event ownership, and publication wake
dispatch. M42 corrects the generated-author projection mismatch without
changing M39/M40/M41. The connected proof selected `The Birth of Tragedy` and
passed Publish -> anonymous discovery (one listing) -> Pause/removal ->
Republish (one listing), controlled transient retry, stale-intent fencing, and
final connected readback. Exact project and migration history read back healthy.

**Unit 7A local delta:** M39 adds an authenticated create-only command that
derives Owner/store authority, reads the current saved review and selected
metadata under candidate/review/metadata revision fences, creates one private
inventory row, and writes candidate/session, audit, event, and idempotency
effects atomically. Exact replay is stable; changed replay and same-candidate
contention cannot create a second row. Duplicate advice/legacy intent is
non-blocking. The unsafe M05 signature is retained for history but execute is
revoked from all API/service roles. This paragraph describes local target
evidence only, not live schema state.

**Current live delta:** M38 adds the approved private fixed-search-path metadata
context v2 helper and replaces only the existing service-only public wrapper.
Readback proves postgres ownership, empty `search_path`, and postgres/service-role
execute only. The response exposes `currentPhysicalClaimAttempt`; M32-M37 remain
unchanged. Applying M38 created or claimed no job and left the dispatcher active.

**Unit 6 closure readback:** pre-proof counts were 6 sessions, 26 inputs, 57
jobs, 25 candidates, 19 metadata attempts, 19 provider calls, 20 lookups, one
cache entry, 5 inventory rows, and 5 listings. One SHA-new Owner upload produced
one media job, one vision job, six candidates, and six metadata jobs. Final
counts were 7 sessions, 27 inputs, 65 jobs, 31 candidates, 24 metadata attempts,
24 provider calls, 26 lookups, 3 cache entries, and unchanged inventory/listings
at 5/5. All proof jobs are terminal and claimable count is zero. Historical
metadata dead-letter job `206ffc83-de84-4cbf-835a-a2d3fb56eb79` retains its
pre-session `2026-08-10T11:33:01.16159Z` terminal timestamp.

**2026-08-09 runtime target guard:** Fresh read-only control-plane verification
reconfirmed `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` as healthy and M32
exactly once. The shared worker loader now rejects every Supabase origin except
`https://ahntbtktjjmvfosgkmgn.supabase.co` before client composition. A sanitized
2026-08-09 JWT inspection showed the inherited service-role key claims the exact
project and is unexpired; one authenticated `GET ...?select=id&limit=1` against
the approved host returned HTTP 200. Only the inherited process URL is foreign.
The read returned an empty JSON array and made no database or Storage mutation;
no privileged worker was started.

## 2026-08-10 M35 live removal readback

- Exact project: `ahntbtktjjmvfosgkmgn` / `Bookconnect_reactexpo` remained
  `ACTIVE_HEALTHY`; M35 exists exactly once as live version `20260809223135`.
- The three authorized inputs are owner-removed and excluded from current-input
  reads; their versions are `4/2/2`, their exact three jobs are cancelled, and
  they have no candidates.
- Store inventory/listing counts remain zero. Their three private staging
  objects remain for the scheduled lifecycle path rather than immediate delete.
- A fourth input, `ef965790-1695-429b-82b7-2c386bc0ae27`, was registered after
  removal and remains untouched; it is the sole current input at readback.
- Owner Edge `phase9-owner-ingestion` v3 is active with JWT verification and an
  exact readback match for only the four Remove-image overlay files.

## 2026-08-09 authorized Expo web-proof baseline

The real authenticated web path reached Profile → Store Owner Console →
Inventory. The Owner-safe inventory read loaded an older active capture with
six processing images and one review item; it was inspected but not reused.
Read-only exact-project counts were sessions `4` total / `3` active-or-closing,
inputs `18`, jobs `27` / `8` pending, candidates `13`, and zero metadata jobs,
metadata attempts, M32 provider calls, metadata lookups, or metadata cache
entries. Because the worker queue is shared and not attributable to a fresh
image, the authorized proof stopped before session creation/upload. No
database, Storage, or provider mutation occurred.

The separately authorized credential-only smoke made exactly one Google Books
HTTP request through the compiled BookConnect adapter and no Supabase client or
RPC. It returned HTTP 200 and a valid provider-neutral `no_acceptable_match`
result. Database/provider-attempt/snapshot mutation counts attributable to this
smoke are zero.

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

## 2026-08-14 live Unit 7B readback

- Supabase project `ahntbtktjjmvfosgkmgn` read back `ACTIVE_HEALTHY`; migration
  history contains M39 (`20260812003419`), M40 (`20260813000040`), M41
  (`20260813070104`), and M42 (`20260814013536`) exactly once.
- M42 replaces `public.sync_marketplace_listing_from_inventory()` and omits
  generated `marketplace_book_listings.authors_text` from both the insert and
  conflict-update assignment paths. It does not rewrite M40 or alter the
  generated-column definition.
- The real Unit 7B proof completed Publish -> anonymous discovery with exactly
  one listing -> Pause/removal -> Republish with exactly one listing. A forced
  transient projection failure produced one retry job and was resolved by the
  worker; a stale-intent retry was rejected with `P9_STATE_CONFLICT`.
- Final connected readback for the selected row showed `published` state, one
  active listing, unchanged quantity/identity, and zero outstanding publication
  retries.
- The existing `active_listing_limit` entitlement is enabled, sourced from
  `unit7b_dev_rollout`, and now has `limit_value=10`. The authoritative
  ineligibility function returns `NULL` for the other ready rows and `price` for
  `Café du Livre` because its price is zero.

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
| Unit 7C public revision history | M43 live adds postgres-owned, RLS-enabled `phase9_publication_revisions`; M46 gates insertion on customer-visible Save changes. Direct client/service mutation remains denied, the false historical revision is preserved, and the connected private-only Save reproof left revision count unchanged. | Preserve activity/audit separation and append-only enforcement through the remaining separately authorized public-change canary cases. |
| Unit 7C Owner command/read boundary | Live M46 now contains the frozen Store View aggregate, controlled exact-versioned Save/stock/page/detail RPCs, authenticated filtered page v2, bounded media/history functions, the corrected private-Save revision gate, and the corresponding grants. | WU1/WU2A database contracts, WU2 reads, WU3 strict Save/stock, WU4 media/history, WU5 cutover, and the bounded M46 correction are committed/applied and verified; broader connected canary checks remain separately gated. |
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
| Quantity equality | `quantity_total = available + reserved + sold + removed` exists `NOT VALID`; existing rows were previously audited as non-violating. PostgreSQL still enforces the CHECK for new/updated rows while historical validation remains pending. | Unit 7A create-only commit must insert `total=available=q` and reserved/sold/removed zero. This per-new-row guarantee does not require or authorize M09; global historical validation still requires fresh preflight and separate review/application authority. |
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
3. Live M39 implements the Unit 7A controlled server command to create exactly one private inventory row per eligible reviewed candidate, initialize its quantity buckets from server-held review state, and write provenance/audit/event/idempotency atomically. It performs no duplicate choice or public projection; publication remains Unit 7B-owned. The M39 application and readback are recorded in the current live handoff above.
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

## 2026-08-07 local M32 current-versus-target note

Live development state remains M30 plus WU1; M32 is repository-only and was not
applied. The local target adds same-transaction candidate/job fan-out, a
service-only fenced metadata context, usage/failure/provider-call RPCs, one
private SELECT-only physical-call lineage table, and a forward replacement of
the Owner metadata-state helper so degraded snapshots are not misreported as
selected. Exact-project schema/ACL/function preflight and application remain
separately gated. No database, Storage, provider, deployment, inventory, listing,
or publication mutation occurred in this implementation session.

The correction pass keeps the same local target and adds no unrelated schema.
Within still-unapplied M32 it tightens vision-only trigger provenance; canonical
query normalization; M15 cache-entry reuse; service-only ACLs; exact
job/candidate/store/vision/lookup/attempt/snapshot lineage; candidate-version
TOCTOU fences; and monotonic stale physical-call reconciliation. Local PGlite
compiled and exercised M32. Remote migration history and exact-project ACL/RLS
state were not queried in this pass, so they remain preflight gates.

The Luna correction pass further records normalized logical outcomes for exact
response-loss recovery and durably attaches an identical pending job to the
single atomically reserved in-flight leader before any follower can reserve
usage or call the provider. Exact validated ISBN matches now precede title/
author/language equivalence. These remain unapplied local M32 targets.

The final bounded correction retains the same unapplied target. M32 now also
revalidates accepted vision authority at physical finalization and exposes a
fixed-search-path, service-only reconciliation wrapper. It preserves an
already-finalized physical outcome after response loss or records an active
unconfirmed call as `outcome_unknown`; exhaustive local ACL proof covers all 14
public worker wrappers. The runtime provider boundary now validates the exact
complete normalized edition and coherent selected-candidate identity before
any persistence. No live schema or external state was read or changed.

## 2026-08-08 controlled live metadata proof preflight

Exact-project MCP readback verified `Bookconnect_reactexpo` /
`ahntbtktjjmvfosgkmgn`, PostgreSQL 17.6, and M32 exactly once as
`20260808020404 marketplace_phase9_structural_metadata_integration`. The live
provider registry now contains exactly one row: `google_books`, `metadata`,
adapter `1.0.0`, enabled/matching/storage allowed, 86,400-second revalidation,
policy 1, with public display and image caching disabled. The worker/provider
proof stopped before candidate creation because the checked-out environment has
no Google Books credential and its available process URL points to a different
Supabase host. The service-role key was not evaluated in that preflight and was
subsequently proved valid for the exact project on 2026-08-09. Metadata jobs,
attempts, lookups, cache entries,
snapshots, usage reservations, and physical provider calls remain zero. The six
historical M32-eligible candidates were not modified; inventory/listings remain
5/5 and metadata/Phase 9 scheduler counts remain zero. The existing five cron
jobs are unrelated club/notification/commerce jobs. No applied migration was
edited or applied by this session.

## 2026-08-08 Phase 0 credential inventory rerun

The source-defined real worker path was inspected without starting either
worker. Gemini requires `PHASE9_GEMINI_API_KEY`,
`PHASE9_GEMINI_MODEL_ID`, and `PHASE9_GEMINI_TIMEOUT_MS`; Google Books requires
`PHASE9_GOOGLE_BOOKS_API_KEY`, `PHASE9_GOOGLE_BOOKS_TIMEOUT_MS`, and
`PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES`. None of those names are readable by
the current process or defined in the checked-in `.env` files. The process
`SUPABASE_URL` host is `nxjnoqjxzkipeghhfxee.supabase.co`, not the verified
development host `ahntbtktjjmvfosgkmgn.supabase.co`; its service credential was
not used against the target.

Read-only MCP verification confirmed the target project is
`Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`, `ACTIVE_HEALTHY`, with M32
exactly once and one existing Google Books registry row. Metadata jobs remain
zero; six historical M32-eligible candidates remain untouched; inventory and
listing counts remain `5/5`. No mutation occurred in this rerun.
### 2026-08-09 development cleanup and fresh-proof state

- Authorized stale processing cleanup closed three active/closing sessions,
  terminalized 17 inputs and eight pending media/vision jobs, removed transient
  uncommitted candidates/capabilities where lifecycle and FK rules allowed, and
  expired the remaining closed-fixture candidates whose append-only variant
  decisions prevent deletion. Immutable evidence and required audit lineage
  remain intact.
- Resulting pre-upload baseline: active/closing sessions `0`, stale pending
  media/vision jobs `0`, unexpired stale review candidates `0`.
- Fresh Expo web upload state: session
  `204b9115-cf8b-4344-a771-042fdfdfd9f1`, one uploaded input, one open
  `media_validate_sanitize` job, zero fresh candidates. Processing is paused at
  the missing authenticated worker-invocation configuration gate.
- Follow-up readback after authenticated media invocation: the media job is
  `resolved` with attempt count `1`; the input is `queued` with a linked media
  asset and SHA-256; one fresh `vision_extract` job is `open`; unrelated pending
  media jobs are `0`. The next external mutation remains the separately bounded
  authenticated vision-worker claim for this fresh input only.
- Fresh vision proof exposes a live current-vs-target defect. The applied media
  completion function creates a vision job without the `vision` usage
  reservation required by applied provider-attempt registration. The fresh job
  therefore reached `retry_scheduled` twice with
  `P9_VISION_ANALYZER_UNAVAILABLE`, attempt `2/5`, while provider attempts,
  usage rows, analysis results, candidates, and M32 metadata jobs remain zero.
  A forward-only correction is required before this same proof can reach Gemini.

### 2026-08-09 local M33 target delta

M33 is created locally and remains unapplied. It adds no table, column, index,
trigger, bucket, or policy. One new `postgres`-private
`marketplace_sec.phase9_ensure_vision_usage_reservation(uuid)` helper locks and
validates the complete job/input/active-session/initiating-Owner/sanitized-media relationship, inserts
the existing policy-1 vision reservation under the existing unique constraint,
then re-reads and rejects conflicting lineage. The service-only media completion
function now calls the helper before resolving its media job, so job creation,
reservation creation, and media completion share one transaction.

The migration's repair query excludes terminal jobs and selects only valid,
unleased `open|retry_scheduled` vision work with linked validated private WebP
media and no reservation. Exact-project read-only preflight found one eligible
row: the original fresh proof job at attempt `2/5`. Eleven historical terminal
jobs remain intentionally outside the repair. A later duplicate upload has an
open media job and is not selected because it has no vision job. No live state
was mutated in the M33 implementation session.

Independent-review corrections now make the helper and repair require
`session.status='active'` and `media.uploaded_by=session.created_by`. The local
migration harness also applies M31 before M32/M33. These corrections remain
local and caused no live database or Storage mutation.

### 2026-08-09 local M34 target delta

M34 is local and unapplied. It replaces only the selected-session-language
rejection and the former 20-author validation inside
`marketplace_sec.phase9_persist_vision_analysis`: selected language becomes a
hint, `und` remains non-candidate evidence, and provider authors are capped at
five. It does not change tables, columns, indexes, triggers, data, M18/M19, or
M32 metadata jobs. Current-tree PGlite passed 59/59 through M32/M33/M34. No live
database query or mutation occurred in this coding session.
### 2026-08-10 live readback — M34 and preserved proof

- Project `ahntbtktjjmvfosgkmgn` contains M34 once as live version
  `20260809182407 marketplace_phase9_vision_language_hint_correction`.
- Preserved vision lineage is terminal and coherent: one resolved attempt-5
  job, one ready input, one result, 8 observations, and 7 candidates.
- The seven trigger-created M32 metadata jobs are resolved at attempt 1 with
  seven lookups, seven finalized physical-call records, seven rejected logical
  attempts, and seven immutable selected snapshots with manual outcome
  `no_match`; all seven candidates are `needs_review`.
- No inventory, listing, publication, or Unit 7 row was created or changed by
  this proof. Terminal snapshot history was not deleted or rewritten after the
  adapter request defect was corrected in code.

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
