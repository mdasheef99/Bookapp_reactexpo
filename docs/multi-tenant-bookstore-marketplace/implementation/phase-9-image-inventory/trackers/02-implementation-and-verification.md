# Phase 9 Implementation and Verification Tracker
**Status:** `unit5c3_runtime_reconciliation_merged_unit5c4_active`
**Last updated:** 2026-07-29
**Use:** only after the Phase 9 planning set is approved
**Active work unit:** `unit5c4_active_alias_materialization_and_search`. Unit 5C-3 is independently approved/merged at `f09301b`; M21 leaves final live Unit 5C-3-only semantics. Customer display, Owner UI/actions, benchmarks, rollout/production enablement, inventory/listing creation, publication, commerce, provider fallback, and global alias authority remain unauthorized. WU0B history preserves `definition_independently_approved_awaiting_implementation_authorization`, `implementation_authorized`, and review.
## Work units
| Unit | Scope | Status | Required gate |
| --- | --- | --- | --- |
| 0 | [Contract fixtures, threat tests, migration plan, rollback/forward-correction plan](../work-units/00-contracts-threat-migration-plan.md) | `approved` | Corrections incorporated; no implementation/migration authorization |
| 0A | Server contracts, deterministic helpers, validation/error/provider/query/grant registers, fixtures, and red contract/security tests | `approved_complete` | independently reviewed 2026-07-19; no SQL/live writes; focused 4 suites/41 tests and all function 9 suites/53 tests pass |
| 0B | [Backend/API technical design](../work-units/00b-backend-api-technical-design-plan.md): seven routed artifacts covering command/query/DTO/actor/boundary inventories, state/transaction/idempotency/worker/telemetry matrices, exact later file allowlists, and red-test mapping | `independently_approved` | original and bounded correction verdicts `approved` 2026-07-22; consolidated Risk-Based Phase 9 SDD analysis next; no Supabase query, migration, endpoint, provider/storage/UI/runtime change or external mutation |
| 1 | [Package 1 live audit](../work-units/01-package1-live-audit.md) and [database design](../work-units/01-package1-database-design.md): metadata, aliases, condition/damage, pipeline/media/request-photo persistence, RLS/grants/functions/indexes/storage, and migration grouping | `m01_m08_m10_live_verified` | M01-M08 plus forward M10 live once; exact discovery/request/internal/private boundaries and advisor correction pass |
| 2 | Extraction session/input/candidate/enrichment/job tables, RLS, indexes, retention fields | `m02_live_verified` | M02 live through M10; Unit 4 needs forward evidence/lease delta |
| 3 | Private media staging, server upload authorization, validation/re-encode/promotion boundary | `deployed_and_live_verified` | M11 live as `20260726182238`; Owner Edge and separate media service verified |
| 4 | [Fixture vision-analysis runtime](../work-units/04-fixture-vision-analysis-runtime-design.md): `p9-vision-v2`, analyzer, job orchestration, immutable evidence/candidates | `fixture_deployed_and_live_verified` | M12 live as `20260726182539`; all nine fixture cases verified; no real provider |
| 4A | [Deployment-runtime scaffolding](../work-units/04a-deployment-runtime-scaffolding-sdd.md): executable sanitation/fixture-vision hosts, strict environment, builds/containers, invocation and validation | [`deployed_and_live_fixture_verified`](./06-fixture-pipeline-deployment-evidence.md) | separate free Render services live at `96991a9`; M13 invoker boundary live |
| 4B | [Gemini vision adapter](../work-units/04b-gemini-vision-adapter-handoff.md) for configured `gemini-3.5-flash-lite`; optional whole-image fallback remains unselected/disabled | `m14_live_verified_provider_deferred` | M14 live once; no live call, credential configuration, Gemini deployment, Storage mutation, or fallback selection |
| 5A | [Metadata foundation](../work-units/05a-metadata-foundation-handoff.md): provider-neutral local-first routing/cache/coalescing, ISBN validation, coherent selection, and attempt/cost lineage | `m17_live_acl_verified` | M17 live once; four sensitive tables are service SELECT-only with RPC-only mutation |
| 5B/5C | Google Books primary adapter / [Unit 5C Lite multilingual variants](../work-units/05c-lite-multilingual-search-variants-sdd.md) | [`5B merged_fixture_verified_provider_deferred`](./11-unit5b-implementation-evidence.md) / [`5C-3 merged_main_f09301b`](./15-unit5c3-runtime-reconciliation-evidence.md) | 5C-1/2/3 merged; M18-M21 live once; 5C-4 alias materialization/search is active; UI/display/rollout remain deferred |
| 6 | Owner session/defaults/capture/review UI with accessibility and recovery | `not_started` | Units 2–5 verified |
| 7 | Controlled per-candidate commit, advisory duplicates, idempotency, projection changes | `not_started` | quantity/hold concurrency tests |
| 8 | Marketplace bookstore-first search, multilingual aliases, counts, full store catalogue | `not_started` | public/private projection tests |
| 9 | Damaged-book public media and mandatory customer photo-request extension | `not_started` | DOC-6/14 seam tests; no payment implementation |
| 10 | Lifecycle worker, deletion evidence, orphan cleanup, alerts, retention holds | `not_started` | lifecycle failure/replay tests |
| 11 | Pilot fixtures, security/regression/E2E/accessibility/cost verification and handoff | `not_started` | all prior units complete |
## Migration ledger
Exact-project preflight passed on `ahntbtktjjmvfosgkmgn`. M01-M08/M10 applied in order after the reviewed M06 owner-safe correction. M09 remains the separate live-data preflight and constraint-validation gate.
| Local filename | Live version/name | Project verified | Applied by | Rollback/forward fix | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `20260722000001_marketplace_phase9_catalogue_metadata_expand.sql` | `20260722090236 marketplace_phase9_catalogue_metadata_expand` | MCP exact project 2026-07-22 | authorized live application | additive/forward correction | history/schema/RLS/grants/data readback | `live_verified` |
| `20260722000002_marketplace_phase9_extraction_persistence.sql` | `20260722090256 marketplace_phase9_extraction_persistence` | MCP exact project 2026-07-22 | authorized live application | additive/forward-disable providers | tables/FKs/jobs/capabilities/RLS readback | `live_verified` |
| `20260722000003_marketplace_phase9_media_registry.sql` | `20260722090321 marketplace_phase9_media_registry` | MCP exact project 2026-07-22 | authorized live application | additive/forward correction | media tables/FKs/privacy/RLS readback | `live_verified` |
| `20260722000004_marketplace_phase9_condition_damage_transition.sql` | `20260722090341 marketplace_phase9_condition_damage_transition` | MCP exact project 2026-07-22 | authorized live application | compatibility/backfill/final check | five inventory/five listing rows remain `good`; final checks live | `live_verified` |
| `20260722000005_marketplace_phase9_controlled_inventory_commands.sql` | `20260722090407 marketplace_phase9_controlled_inventory_commands` | MCP exact project 2026-07-22 | authorized live application | revoke/forward-disable boundary | 24 named public RPCs; zero anon execute; internal authenticated execute zero | `live_verified` |
| `20260722000006_marketplace_phase9_storage_boundaries.sql` | `20260722095443 marketplace_phase9_storage_boundaries` | MCP exact project 2026-07-22 | authorized live continuation | reviewed owner-safe correction before first successful apply | four bucket boundaries; zero direct Phase 9 client policies; unrelated branches preserved | `live_verified` |
| `20260722000007_marketplace_phase9_public_projection_search.sql` | `20260722095545 marketplace_phase9_public_projection_search` | MCP exact project 2026-07-22 | authorized live continuation | safe projection plus forward M10 | 24 allowlisted/zero private columns; three indexes; pinned/named functions; grants/view corrected by M10 | `live_verified_with_m10` |
| `20260722000008_marketplace_phase9_request_photo_seam.sql` | `20260722095729 marketplace_phase9_request_photo_seam` | MCP exact project 2026-07-22 | authorized live continuation | forward M10 repairs only grant regression | tables/FK/trigger/RLS/worker/hold/expiry verified; request grants preserved by M10 | `live_verified_with_m10` |
| `20260722000010_marketplace_phase9_public_boundary_security_correction.sql` | `20260722125256 marketplace_phase9_public_boundary_security_correction` | MCP exact project 2026-07-22 | authorized bounded live correction | forward-only; M01-M08 immutable | exact three anon RPCs; invoker-safe 24-field view; zero direct view/private access; advisor error gone | `live_verified` |
| `20260723000011_marketplace_phase9_ingestion_runtime_foundation.sql` | `20260726182238 marketplace_phase9_ingestion_runtime_foundation` | MCP exact project 2026-07-26 | authorized M11/M12 live application | forward-only; revoked legacy authenticated path RPCs | 20 columns, 11 constraints, unique capability index, 12 hardened service-only functions, unchanged 5/5/14 inventory/listing/event counts and zero Storage objects; security 172 after M11 | `live_verified` |
| `20260726000012_marketplace_phase9_vision_analysis_runtime.sql` | `20260726182539 marketplace_phase9_vision_analysis_runtime` | MCP exact project 2026-07-26 | authorized M11/M12 live application | forward-only after M11; initial truncated transport submission failed atomically and was absent before lossless retry | RLS/private immutable tables, eight lineage/reconciliation columns, exact uniqueness/constraints/triggers/index, four hardened service-only RPCs, unchanged data/Storage; security 174 with only two expected INFO notices | `live_verified` |
| `20260727000013_marketplace_phase9_service_rpc_wrappers.sql` | `20260727025046 marketplace_phase9_service_rpc_wrappers` | MCP exact project 2026-07-27 | authorized M13 boundary correction | forward-only; private functions/schema unchanged | 13 postgres-owned, empty-search-path `SECURITY INVOKER` wrappers; service-role only; anon/auth denied; private schema still `PGRST106` | `live_verified` |
| `20260727000014_marketplace_phase9_vision_provider_attempts.sql` | `20260727183546 marketplace_phase9_vision_provider_attempts` | MCP exact project 2026-07-28 | authorized M14-only application | forward-only additive; no Storage/provider/deployment effect | dedicated empty 34-column attempt table, approved constraints/five indexes, retry-stable spend identity, semantic pricing allowlist, exact service-only RPC signatures, zero client grants; PGlite 67/67 and fixture regression 23/23 | `live_verified` |
| `20260728000015_marketplace_phase9_metadata_foundation.sql` | `20260727222159 marketplace_phase9_metadata_foundation` | MCP exact project 2026-07-28 | authorized exact-file M15 application | forward-only additive after M14; grant correction required; never reuse M09 | complete 60,915-byte checked-in file applied once; schema/RPC/client-denial/invariant checks pass; live default privileges left direct service-role DML on all three new tables; focused 7/7, metadata PGlite 10/10, full Phase 9 PGlite 77/77 | [`live_security_correction_required`](./08-m15-application-evidence.md) |
| `20260728000016_marketplace_phase9_sensitive_table_acl_correction.sql` | `20260727231217 marketplace_phase9_sensitive_table_acl_correction` | MCP exact project 2026-07-28 | authorized M16 application | forward-only four-table ACL correction; M17 needed for PG17 MAINTAIN; never reuse M09 | six named privileges denied, SELECT/RPC/RLS/client boundaries pass; raw ACL `service_role=rm/postgres` exposes MAINTAIN; post-apply focused 5/5 | [`live_pg17_maintain_correction_required`](./09-m16-acl-correction-evidence.md) |
| `20260728000017_marketplace_phase9_maintain_acl_correction.sql` | `20260727233457 marketplace_phase9_maintain_acl_correction` | MCP exact project 2026-07-28 | authorized M17 application | forward-only exact four-table ACL correction; never reuse M09 | PG17.6 raw ACL `service_role=r/postgres`; SELECT only, clients denied, RLS/owner and 13 RPCs unchanged; focused 25/25 | [`live_verified`](./10-m17-acl-correction-evidence.md) |
| `20260729000018_marketplace_phase9_search_variant_proposals.sql` | `20260729004216 marketplace_phase9_search_variant_proposals` | MCP exact project 2026-07-29 | authorized Unit 5C-2 M18 application | forward-only private companion table/RPC boundary; M01 aliases unchanged; never reuse M09 | PG17.6 table/check/FK/index/timestamp/RLS/ACL/function readback; service SELECT-only and no MAINTAIN; rollback-only accepted/replay/mismatch/scope smoke; zero residue; focused Jest 142/142 and PGlite 73/73 before final rerun | [`merged_main_b398034`](./14-unit5c2-variant-persistence-evidence.md) |
| `20260729000019_marketplace_phase9_search_variant_replay_fence.sql` | `20260729020008 marketplace_phase9_search_variant_replay_fence` | MCP exact project 2026-07-29 | one authorized bounded Unit 5C-2 correction | forward-only immutable accepted-envelope fingerprint; M18 unchanged; renamed M18 helper private to replacement definer | red reproduced changed-replay append; green structural 12/12 and PGlite 9/9; PG17.6 RLS/ACL/search-path/no-MAINTAIN readback; rollback-only exact/changed replay smoke; zero residue | [`merged_main_b398034`](./14-unit5c2-variant-persistence-evidence.md) |
| `20260729000020_marketplace_phase9_variant_runtime_search.sql` | `20260729054842 marketplace_phase9_variant_runtime_search` | MCP exact project 2026-07-29 | authorized Unit 5C-3 migration application before scope narrowing | immutable applied migration; temporarily combined Unit 5C-3 reconciliation/lifecycle with Unit 5C-4 materialization/search; corrected forward by M21, never edited/reverted/deleted | database integration and lifecycle verification completed; final live interpretation requires M21 | [`merged_main_f09301b`](./15-unit5c3-runtime-reconciliation-evidence.md) |
| `20260729000021_marketplace_phase9_defer_active_variant_search.sql` | `20260729060238 marketplace_phase9_defer_active_variant_search` | MCP exact project 2026-07-29 | authorized Unit 5C-3 scope correction | forward-only removal of public search RPC, alias materializer, target linkage, and trigger/search effects; preserves M18-M20 history | final affected Jest 7 suites/101; DB 12/12; TypeScript with allow-importing-TS-extensions; rollback-only lifecycle smoke, zero residue, live proposal/proposal-set/alias counts zero | [`merged_main_f09301b`](./15-unit5c3-runtime-reconciliation-evidence.md) |
Rules:
- Re-verify the project before planning and applying; use `apply_migration`, never raw DDL or generated fixture IDs.
- Use forward corrections; record every schema, grant, Storage, data, and verification effect.
## Required verification matrix
### Database and tenancy
- [ ] Every store-owned Phase 9 row has `store_id`.
- [ ] Store A cannot read, write, sign, promote, commit, or delete Store B data/media.
- [ ] Client-supplied `store_id` never establishes authority.
- [ ] Only the initiating Owner mutates/resumes a pilot session; Phase 9 has no support takeover or cross-store private-data scope, and recovery is Owner retry, claimed-worker recovery, or reconciliation.
- [ ] Canonical tables cannot be mutated by Store Owner commands.
- [ ] RLS/grants and function `search_path`/EXECUTE are verified live.
- [ ] Grant matrix proves API-exposed tables have RLS and raw attempts/jobs/usage/cost/lifecycle structures plus private helpers are not directly callable by client roles.
- [ ] Authenticated clients cannot directly SELECT private Phase 9 base tables; named Q/RPC or positive-allowlist views are the only read surfaces, and worker/service grants are tested separately.
- [ ] Upload capabilities are persisted, server-derived, actor/purpose/entity/path bound, expiring, revocable/failable and atomically single-use for C02/C03, C15/C16 and C20/C21.
- [ ] Cost reservations enforce exactly one `(store_id, job_id, cost_kind, policy_version)` row under retries and concurrent inserts.
- [ ] Inventory equality and active-hold semantics survive increment/new-row/partial failure races.
- [ ] Duplicate check and commit are concurrency-safe and idempotent.
### AI/provider contracts
- [ ] Prompt-injection text embedded in an image cannot cause tools, URLs, queries, or writes.
- [ ] Model output is rejected unless it satisfies the versioned schema and limits.
- [ ] Central validation matrix and API error catalogue generate/trace every contract limit and safe error behavior.
- [ ] A valid empty/no-book result does not trigger expensive retry loops.
- [ ] Primary failure triggers at most one allowed vision fallback.
- [ ] Metadata provider fallback is sequential and field conflicts are visible in provenance.
- [ ] Provider-independent fixtures prove configured primary/optional-secondary bounded routing, closed fallback policy, capabilities, query/cache/attempt/cost lineage, single accepted completion, duplicate-spend reconciliation, and manual degradation.
- [ ] Provider storage/display/cache/attribution/expiry permissions are enforced independently of provenance.
- [ ] ISBN checksums/conversion, title/author normalization, and alias rules have deterministic fixtures.
- [ ] CI uses recorded model/provider fixtures; no exact natural-language output assertion.
### Media and privacy
- [ ] MIME header, signature, decode, dimensions, byte/pixel limits, random path, re-encode, and EXIF/GPS stripping pass.
- [ ] Scan images and request photos cannot be retrieved through a public URL.
- [ ] Only approved sanitized derivatives become public inventory media.
- [ ] Signed request-photo URLs are short-lived and authorized against the final request item/customer/store.
- [ ] Deletion jobs are idempotent, observable, legal/dispute-hold aware, and leave tombstone evidence without retaining the image.
- [ ] Raw images/payloads never enter application logs, Sentry, analytics, notifications, or audit metadata.
### Owner UX and accessibility
- [ ] Start/Close-only session behavior works across foreground/background/logout/network loss.
- [ ] Camera/gallery enforce the 15-spine cap; current selected-language behavior
  stays regression-covered and target optional-hint/per-field behavior receives
  separate tests before activation.
- [ ] Minimal review fields, defaults, add-missed/remove-false, duplicate warning, condition explanations, and preview are keyboard/screen-reader accessible.
- [ ] A failed candidate does not block successful candidate commits.
- [ ] Projection failure leaves candidate `committed`, publication `publication_failed`, and returns command/API outcome `committed_publication_failed`; idempotent retry cannot repeat inventory effects.
- [ ] Session summary accurately reports committed/private/published/needs-review/failed/skipped counts.
### Marketplace and customer photos
- [ ] Search returns each eligible matching bookstore once and all eligible stores across pagination.
- [ ] Versioned store-group cursor/ranking contract survives ties, context changes, multiple offers, and page boundaries.
- [ ] Storefront shows the complete active public catalogue and distinct title count.
- [ ] Original-script and approved alias searches return the same eligible listing without changing displayed identity.
- [ ] Exact inventory quantity, shelf, cost, raw payload, private notes, and request photos never appear publicly.
- [ ] Requested photo item cannot reach `payment_ready` without provided and accepted current-copy photos.
- [ ] Request-photo evidence never affects duplicate identity, quantity compatibility, or row separation.
- [ ] Store inability to provide requested photos marks the item unfulfilled/unavailable and releases eligible holds.

### Operational readiness
- [ ] Metrics cover extraction quality, owner corrections, fallback, latency, cost, quota, cleanup backlog, and repeated request-photo failures.
- [ ] Alerts cover stuck jobs, cleanup failures, unexpected fallback/cost spikes, and cross-tenant denials.
- [ ] Model/provider/prompt/schema versions support rollback and incident correlation.
- [ ] Feature flag, store allowlist, locality gate, and kill switch are verified.
- [ ] No Phase 7/8 payment, paid-order, pickup, refund, ledger, or settlement behavior is introduced; fixed multi-replica tests cover claims/fencing, shutdown, provider retries, spend reconciliation, connection safety, fairness, stage-specific scaling, queue observability, and throughput before autoscaling can be enabled.
## Append-only implementation log

### 2026-07-27 — provider and scale SDD reconciliation
- Documentation-only reconciliation updated source/SDD requirements, target/evidence support, routing, and review gates; historical WU0/Unit 4/4A and the migration ledger remain unchanged, with no Supabase/external mutation.
- Real Gemini design is prospective Unit 4B, Unit 5 remains Metadata/aliases, advanced routing/autoscaling is deferred, and the next action is independent documentation review only; closeout verification is recorded in the branch handoff.
### 2026-07-26 — M11/M12 live application and verification
- Exact application, rollback, readback, advisor, mutation, and authorization evidence is recorded in [05-m11-m12-live-application-evidence.md](./05-m11-m12-live-application-evidence.md). 2026-07-27 follow-up: `main`/`origin/main` closed at `4abeef89ecebdb7a74a8ece3a1bdc0d5cfe6c8c5`; routed documentation reconciliation and continuity/diff-hygiene checks passed, with no deployment, secret, Storage object, provider, or operational-data mutation afterward.
### 2026-07-23 — ingestion-runtime foundation corrected for dedicated-worker review

- Scope/evidence: local M11 plus Owner Edge intake, dedicated worker entrypoint/shared contracts/real pinned sanitizer implement only Owner intake through one vision-job queue; excluded scope and M09 are absent. The correction pass persists immutable completion responses and source hashes, creates service-only immutable source snapshots, fences every worker transition with opaque claim token plus attempt, retries Storage transport failures, recovers ambiguous post-upload completion failures without duplicate media/vision effects, enforces strong distinct ingress secrets, normalizes privacy-key denial, rejects multi-frame PNG/WebP, and keeps the 64 MP ImageMagick working allowance subordinate to the 16 MP source ceiling. Final commands: focused Jest 9 suites/74 tests; `npm run test:phase9:db` 26/26; repository and dedicated-worker TypeScript passed. A read-only review of the current unstaged candidate confirmed the security/runtime guarantees, found three stale M06 Storage rows, and after their correction found no remaining merge blocker with recommendation `READY_FOR_INDEPENDENT_REVIEW`.
- Benchmark/closeout: Node 22.13/Windows x64, three iterations each at 8/12/16 MP had median 11,767/11,397/14,269 ms and ending RSS 169/191/225 MB; all produced correct metadata-free WebP with stable hashes. WASM/package are 14,593,449/15,435,239 bytes. This is dedicated-worker sizing evidence only; representative-camera deployment load testing remains required. Final continuity passed 33 Markdown files/27 required files and `git diff --check` passed. No migration was applied, no service deployed, no Supabase/Storage data mutated, and nothing was staged, committed, pushed, or merged. Await separate user authorization to stage and commit; M11 application and deployment remain separately unauthorized.

### 2026-07-22 — Owner-safe M06 continuation and M10 live acceptance

- Evidence/correction/application: `storage.objects` ownership/RLS and all 19 policy branches matched; reviewed M06 correction `e07efa1` removed only the redundant owner-only statement before M06-M08 applied. M08 then revoked the three M07 anonymous discovery grants. M10 red contracts failed 3/3 absent, then passed 3/3; isolated database/security passed 20/20, migrations 27 suites/209 tests, Edge/security 9 suites/57 tests, TypeScript, continuity, and whitespace. Independent verdict was `approved`; commit `31253ad` was pushed before M10 applied as `20260722125256`.
- Live acceptance/gates: M01-M08/M10 are recorded once. Exactly the three discovery RPCs allow anon; no other Phase 9 RPC does; eight request-photo RPCs remain authenticated-only; eight internal helpers remain service-only; private client table grants are zero. The 24-field projection is barrier/invoker-safe with no direct role access, and `security_definer_view` findings are zero. Security advisors are 174 (`INFO 46/WARN 127/ERROR 1`) versus 172 before M10; the three intentional public query RPC WARNs replace the resolved view ERROR, while the remaining ERROR is legacy `public.spatial_ref_sys` RLS. Performance remains 350 (`INFO 199/WARN 151`). M09 is absent, quantity CHECK is `NOT VALID` with zero violations, and auth/providers/mobile/Edge/runtime were untouched.

### 2026-07-22 — Package 1 live application stopped at M06

- Authorized scope: merge approved `69edd90` to `main`; create `phase9-db-live-application`; exact-project preflight; apply only M01-M08 in order; verify and record; no M09/auth/runtime work
- Repository: clean fast-forward `main` from `a398adb` to `69edd90`, pushed; live-application branch created from updated `main`
- Preflight: project `ahntbtktjjmvfosgkmgn` was `ACTIVE_HEALTHY`; history ended at Phase 6 M39; no M01-M08 collisions; referenced schema/functions/extensions and Storage branches matched; five inventory/five listings were `good`; damaged/invalid/quantity violations were zero; quantity equality remained `NOT VALID`
- Applied: M01-M05 succeeded and are recorded once in order as versions `20260722090236`, `20260722090256`, `20260722090321`, `20260722090341`, and `20260722090407`
- Blocker: M06 failed with PostgreSQL `42501 must be owner of table objects` because `storage.objects` is owned by `supabase_storage_admin`; the approved migration includes `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`
- Stop/rollback evidence: M06 has no migration-history row; its transaction rolled back; both new buckets are absent and all four mixed legacy Storage policies retain their preflight branches; M07-M08 were not attempted
- Partial verification: M01-M03 tables/FKs and private RLS/grants are live; M04 final condition checks are live; M05 has 24 named public Phase 9 RPCs with zero anonymous execution and zero authenticated execution on internal helpers; quantity violations remain zero and the equality CHECK remains unvalidated
- Repository validation after the stop: isolated Phase 9 database tests 19/19; migration regressions 26 suites/206 tests; focused Edge Function/security suites 9 suites/57 tests; `npx tsc --noEmit` passed; Phase 9 continuity and `git diff --check` passed
- Advisor comparison: security `121 -> 158` and performance `314 -> 343`; no new ERROR and no new performance WARN. Added Phase 9 notices are 13 intentional service-only RLS/no-policy INFO entries, 24 named authenticated `SECURITY DEFINER` RPC WARN entries, and FK/unused-index INFO entries. Legacy findings remain separately classified.
- Required response: do not edit applied history or silently alter M06. A separately reviewed owner-safe M06 forward/application response is required before M06 retry or M07-M08 application.
- Auth deferral: no auth code changed. A new session and separate branch must complete auth state ownership, one root-owned subscription, centralized transitions/logout, secure token persistence, production-safe development bypasses, and removal of auth-to-marketplace dependency before Phase 9 mobile/private-ingestion runtime integration.
- M09/runtime: M09 was neither created nor applied; providers, Edge/runtime endpoints, mobile UI, and auth implementation were untouched

### 2026-07-22 — Package 1 M01-M08 local implementation

- Authorized scope: red-first migration harness, approved M01-M08, isolated/local execution, focused review, commit/push; no connected-project mutation and no M09/runtime work
- Red evidence: initial focused migration contract run failed 17/17 because all eight approved files were absent
- Green evidence: static migration contracts 12/12; isolated Phase 6-to-M01-M08 execution and database/security behavior 19/19; all migration regressions 26 suites/206 tests; actual Edge Function suites 9/9 and 57/57 tests
- Other validation: `npx tsc --noEmit`, Phase 9 continuity (32 Markdown files/27 required phase files), and `git diff --check` pass
- Harness: `supabase/tests/phase9/phase6_baseline.sql`, `databaseHarness.mjs`, `phase9Database.integration.test.mjs`, and `phase9RequestExpiry.integration.test.mjs` using embedded PGlite; the fixture is an executable Phase 9-relevant snapshot, while the repository ledger check preserves the complete ordered Phase 6 M01-M39 chain
- Coverage: ordered schema/FKs, aliases/providers, capabilities, private grants/named boundaries, cross-store/initiator denial, claim/lease/retry/dead-letter, concurrent cost uniqueness, commit/publication separation, condition/damage, quantity buckets with the existing NOT VALID constraint untouched, media/Storage, store grouping, and request-photo persistence
- Exact-project verification: strictly read-only schema/status evidence reconciled live Phase 6 column and hold-contract names with the fixture and M01-M08 after review exposed a fidelity risk
- Supabase/external mutations: none; the connected project was queried read-only and was not mutated
- Legacy advisor evidence: RLS remains disabled on `public.spatial_ref_sys`, `public.marketplace_event_schema_registry`, and `public.marketplace_notification_type_registry`; this pre-existing backlog is not a Phase 9 M01-M08 blocker and was not remediated here
- Independent review: initial focused verdict required corrections; correction-only follow-ups ended with exact verdict `approved`. No reviewer edits or Supabase access occurred.
- Review corrections: atomic C03; exact Owner and private/worker boundaries; race-safe command fingerprints; claimed store/entity/intent-bound C12/C27/C29; reviewed-only commit; single-media validation; truthful pending/provided progression; soft-hold refresh/accept/expiry; policy-preserving Storage changes; stable cursors; and alias store consistency
- Remaining gate: exact-project M01-M08 live preflight/application requires separate authorization and fresh readback; M09 remains a distinct, separately reviewed live-data gate

### 2026-07-22 — Package 1 six-finding correction

- Date/session: 2026-07-22 Package 1 review correction
- Authorized work unit and scope: correct only the six required audit/design findings and related status/validator expectations; no new Supabase query unless needed, migration/runtime file, or external mutation
- Completed: executable condition compatibility/backfill/final-CHECK order; persisted single-use upload capability relation and C01-C07/C20-C21 boundary coverage; named-only private reads and separate worker/service grants; exact cost-reservation uniqueness; first-possible deferred-FK additions; eight additive groups plus separately reviewed M09 quantity-validation gate
- Files/components/migrations: Package 1 documentation, required current-vs-target/status records, and continuity validator only; no migration or runtime file
- Verification actually run: continuity validator and `git diff --check` at correction closeout; no second live audit required
- Supabase/external mutations: none
- Decisions/deviations/risks: no settled SDD decision reopened; `damage` remains separate data; existing advisor backlog remains non-blocking unless a Phase 9 change copies/worsens it
- Next authorized action and gate: one correction-only review limited to these six findings; red tests, migration creation, M09/live application and runtime remain separately gated
- Independent review verdict: exact `approved`; all six findings fully covered; validator preservation verified; reviewer made no edits and performed no Supabase query/mutation
- Next authorized action and gate after approval: await separate authorization for failing tests or migration-file creation; M09/live application and runtime remain independently gated

### 2026-07-22 — Package 1 read-only database/storage audit

- Date/session: 2026-07-22 Package 1 database foundation audit
- Authorized work unit and scope: exact-project read-only Supabase audit and proposed database/migration design only; no migration creation/application or runtime/storage mutation
- Completed: current-state evidence, current-to-target matrix, exact proposed schema/RLS/function/index/storage changes, eight-group safe order, failing migration/RLS/security plan, and blocker classification
- Files/components/migrations: two Package 1 documentation artifacts plus required current-vs-target/continuity/tracker updates; no migration or runtime file
- Verification actually run: Supabase project/table/catalog/policy/grant/function/trigger/storage/migration/advisor queries; continuity validator, link/size/diff checks at closeout
- Supabase/external mutations: none; all SQL was SELECT/catalog readback and all Supabase MCP operations were read-only
- Decisions/deviations/risks: no settled SDD decision reopened; dedicated Phase 9 job table proposed while reusing Phase 6 claim mechanics; quantity validation stays a separate forward gate
- Tracker/source-doc updates: Package 1 audit/design, database-current-vs-target, master/implementation trackers, ACTIVE.md, DOC-13
- Next authorized action and gate: review Package 1 design and separately authorize failing tests or migration-file creation; live application remains independently gated

### 2026-07-19 — Work Unit 0 planning checkpoint

- Date/session: 2026-07-19 Work Unit 0 planning
- Authorized work unit and scope: WU0 planning only; documentation commit authorized; no product code or migration creation/application
- Completed: approved baseline committed as `f9f6890`; versioned contracts, fixture matrix, threat tests, migration sequence, forward-correction rules, and pre-migration gates planned
- Files/components/migrations: documentation only; no migration file, app/function code, bucket, policy, or live data change
- Verification actually run: fresh exact-project read-only Supabase audit; continuity validator PASS (22 Markdown files, 17 required phase files); local links/350-line limit PASS; `git diff --check` PASS
- Supabase/external mutations: none
- Decisions/deviations/risks: no new product behavior; pre-existing RLS/public-bucket/privileged-function/password findings remain separate review gates
- Tracker/source-doc updates: WU0 plan, Phase 9 tracker, implementation tracker, handoff/router references, DOC-13, audit refresh, validator
- Next authorized action and gate: user review of WU0 plan; implementation, migration-file creation, and migration application remain unauthorized

### 2026-07-19 — Work Unit 0 correction and approval checkpoint

- Date/session: 2026-07-19 WU0 required-corrections incorporation
- Authorized work unit and scope: authoritative documentation corrections and commit only
- Completed: alias, validation/error, publication failure, request-photo duplicate, session ownership/Close, privilege, quantity, marketplace query, provider reuse, security-test, and migration-sequence corrections
- Files/components/migrations: documentation only; no migration, contract code, endpoint, app, bucket, policy, provider, or live data change
- Verification actually run: continuity validator PASS (22 Markdown files, 17 required phase files); local links/350-line limit PASS; 134 Phase 9 acceptance IDs unique; `git diff --check` PASS; no product/function/migration/app file changed
- Supabase/external mutations: none
- Decisions/deviations/risks: terminal-input Close retained; quantity validation stays a separately reviewed production gate; WU0 approved without authorizing WU0A
- Tracker/source-doc updates: root source specs, all affected Phase 9 SDDs/supporting records, trackers, handoffs, and validator
- Next authorized action and gate: none; await explicit authorization for named WU0A contract/test scope, with migrations still separately gated

### 2026-07-19 — Work Unit 0A contract/test foundation

- Date/session: 2026-07-19 WU0A implementation
- Authorized work unit and scope: server-owned versioned contracts, pure deterministic helpers, central validation/error/provider-reuse/marketplace-query/grant registers, sanitized fixtures, and contract/security tests only; explicitly no migrations, Supabase/storage/provider/product-write/live-application changes
- Completed: strict vision/metadata/alias parsers; contract/version limits; ISBN, BCP 47, fallback, initiator-only session/Close, duplicate advice, quantity, publication-idempotency, marketplace cursor, provider-reuse, error, grant-design, and future red-gate foundations
- Files/components/migrations: `supabase/functions/_shared/imageInventory/`, four `phase9_*.test.ts` suites, and synthetic fixtures under `supabase/functions/__tests__/fixtures/phase9/`; no migration file
- Verification actually run: focused Jest 4 suites/24 tests passed after one red-first HTTPS-cover correction; all nine Edge Function test files passed 9 suites/36 tests; strict standalone TypeScript check passed; continuity validator and final diff checks recorded at session close. An intermediate directory-targeted Jest command incorrectly collected three fixture modules as empty suites; the explicit `*.test.ts` run passed.
- Supabase/external mutations: none; no Supabase read was necessary because WU0A contains no database/storage decision or operation; no network/provider call
- Decisions/deviations/risks: future production gates remain explicitly `red` in a typed register while the WU0A package itself stays green; cover URI-shaped values require HTTPS and no URL credentials; concrete provider-host allowlisting remains adapter configuration in its later unit
- Tracker/source-doc updates: Phase 9 master tracker, master SDD implementation marker, README, implementation tracker, and DOC-13
- Next authorized action and gate: none; await WU0A review and explicit authorization for one named later unit; migration creation and application remain separately unauthorized

### 2026-07-19 — Work Unit 0A independent review and approval

- Date/session: 2026-07-19 independent WU0A review/correction/approval
- Authorized work unit and scope: independently inspect, narrowly correct, verify, stage, and commit WU0A only; no SQL, endpoint, provider, product UI/write, deployment, push, merge, or Supabase/storage mutation
- Completed: classified every changed file; corrected central-limit consumption, provider-host allowlisting, server-built vision request/default language, common envelopes, retained alias provenance, active-content validation, terminal Close transitions, publication retry non-write contract, grant controls, marketplace grouping/query semantics, DTO/telemetry exclusions, and adversarial/no-match fixtures/tests
- Files/components/migrations: WU0A shared server contracts/domain helpers, four Phase 9 test suites, synthetic fixtures, package README, authoritative Phase 9 trackers/status docs, and continuity validator; no migration file
- Verification actually run: focused Jest 4 suites/41 tests passed; all nine Edge Function suites/53 tests passed; strict standalone TypeScript passed; secret/capability/network scan found only synthetic negative fixtures, denial assertions, and historical documentation terms; continuity/link/Markdown validator and final Git checks recorded after status update/commit
- Supabase/external mutations: none; project authority remains documented as `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`); no provider/network/storage call or deployment
- Decisions/deviations/risks: review outcome `approved_with_required_corrections`, corrected to final `approved`; configured provider hosts remain per-adapter policy data; future runtime/database gates remain typed red and unimplemented
- Tracker/source-doc updates: master tracker, implementation tracker, Master SDD implementation marker, Phase 9 README, package README, DOC-13, and continuity validator
- Next authorized action and gate: none; WU0B backend/API technical design is next eligible but requires separate explicit authorization; migration creation/application remain unauthorized

### 2026-07-19 — Work Unit 0B definition correction

- Date/session: 2026-07-19 planning-only WU0B definition correction
- Authorized work unit and scope: create the dedicated WU0B planning document and update only the named continuity/status documents; no runtime/test/migration/external work
- Completed: normalized the repository-to-Phase-9 startup chain; routed WU0 → WU0A → WU0B → Unit 1; defined command/query, actor/auth, transport/service/repository, DTO/privacy, state/transaction/idempotency, worker/provider, marketplace, telemetry/rate-limit, red-test, acceptance, non-goal, file-allowlist, and later-gate requirements
- Files/components/migrations: documentation allowlist only; no migration, endpoint, function, app, fixture, dependency, generated file, bucket, policy, provider, or live data change
- Verification actually run: continuity validator PASS (23 Markdown files, 18 required phase files); `git diff --check`, Markdown links, Phase 9 document size, WU0B routing, single-next-action, eight-file allowlist, and prohibited-path checks passed
- Supabase/external mutations: none; no live database fact was uncertain for this planning-only correction
- Decisions/deviations/risks: no product behavior changed; WU0A remains authoritative; WU0B plan existence is not implementation or approval
- Tracker/source-doc updates: WU0B definition, SESSION-START, master/detailed trackers, Phase 9 README, DOC-13, and the planning-approval checklist clarification
- Next authorized action and gate: independent review of the committed WU0B definition and updated continuity validator only; WU0B implementation and migration creation/application remain unauthorized

### 2026-07-20 — Work Unit 0B independent-review corrections

- Date/session: 2026-07-20 documentation-only correction after independent WU0B definition review
- Authorized work unit and scope: correct the five reported documentation/validator findings only; no runtime/test/migration/external implementation
- Completed: routed ACTIVE.md to WU0B; added separate scan, request-photo, and public-copy capability commands plus controlled post-commit edit commands; made marketplace listing matching service-internal and public pagination store-grouped; separated `implementation_complete_needs_review` from `independently_approved`; anchored current markers and added contradiction/order/gate/coverage checks to the validator
- Files/components/migrations: Phase 9 documentation and continuity validator only; no endpoint, repository, worker, adapter, migration, function, bucket/policy, provider, UI, dependency, fixture, generated file, or live data change
- Verification actually run: continuity validator PASS (23 Markdown files, 18 required phase files); five in-memory negative mutation probes PASS; Markdown links, 350-line limit, WU0 → WU0A → WU0B → Unit 1 routing, single-next-action, six-file correction allowlist, prohibited paths, and `git diff --check` PASS
- Supabase/external mutations: none; no live database fact was needed for this documentation-only correction
- Decisions/deviations/risks: no product behavior changed; corrections make existing SDD requirements and authorization gates explicit; independent re-review remains required
- Tracker/source-doc updates: ACTIVE.md, WU0B definition, continuity validator, master tracker, implementation tracker, and DOC-13
- Next authorized action and gate: independent re-review of the corrected WU0B definition and continuity validator only; WU0B implementation and migration creation/application remain unauthorized

### 2026-07-20 — Work Unit 0B corrected-definition independent approval

- Date/session: 2026-07-20 independent re-review of corrected WU0B definition and continuity validator
- Authorized work unit and scope: read-only re-review, then record the verdict and commit/push only if no findings remained; no runtime, migration, Supabase/Storage, provider, or UI work
- Completed: reviewed the complete correction diff; added the missing definition-approved/intermediate authorization marker; final verdict `approved`
- Files/components/migrations: documentation and continuity validator only; no runtime component, migration, endpoint, bucket/policy, dependency, fixture, generated file, or external mutation
- Verification actually run: continuity validator PASS (`MARKDOWN_FILES_CHECKED=23`, `REQUIRED_PHASE_FILES=18`); five in-memory negative probes PASS; `git diff --check`, eight-file allowlist, prohibited runtime/migration paths, WU0→WU0A→WU0B→Unit 1 order, and single-next-action checks PASS
- Supabase/provider/storage/runtime mutations: none; the user separately authorized the documentation commit and Git push, which are reported at handoff after success
- Decisions/deviations/risks: corrected WU0B definition is approved; WU0B technical-design implementation remains unauthorized and must receive a separate explicit authorization
- Tracker/source-doc updates: WU0B definition, Phase 9 README/master/planning/implementation trackers, DOC-13, ACTIVE.md routing, and continuity validator
- Next authorized action and gate: request separate authorization for bounded WU0B technical-design implementation only; migration creation/application remain unauthorized

### 2026-07-20 — Work Unit 0B documentation-only technical-design completion

- Date/session: 2026-07-20 bounded WU0B artifact implementation
- Authorized work unit and scope: seven cohesive technical-design artifacts, authority/router alignment, status/continuity updates and validator hardening only
- Completed: C01–C26 and Q01–Q11 catalogue; DTO/error/rate design; actor/tenant/privacy/grant matrices; state/transaction/idempotency/publication design; job/provider/media/lifecycle design; marketplace/request-photo design; red tests, audit questions, future exact proposed file map and handoff
- Files/components/migrations: seven new Markdown artifacts plus authorized WU0B router, Phase 9 README/session/master/implementation trackers, DOC-13 and continuity validator; no component, test, migration or generated file
- Verification actually run: continuity validator PASS (`MARKDOWN_FILES_CHECKED=30`, `REQUIRED_PHASE_FILES=25`); five in-memory missing-route/command/category, premature-approval and later-authority negative probes PASS; 14-file authorized allowlist, Markdown links, ≤350-line artifact/router limits, C01–C26/Q01–Q11 coverage, exactly one next action, audit markers, no placeholders, prohibited-path absence and `git diff --check` PASS
- Supabase/external mutations: no Supabase query or mutation, provider call, Storage change, deployment, push or merge during this work unit
- Decisions/deviations/risks: detailed artifacts resolve the approved single-document size conflict; database-dependent facts remain `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`; prior authorized main merge/push occurred before this work unit
- Tracker/source-doc updates: WU0B authority/router, seven-artifact set, SESSION-START, Phase 9 README/TRACKER, this implementation tracker, DOC-13 and validator
- Next authorized action and gate: authorize an independent review of the completed WU0B technical-design artifacts only; Supabase audit, database/migration design, migration creation/testing/application and runtime remain unauthorized

### 2026-07-20 — Work Unit 0B semantic-review corrections

- Date/session: 2026-07-20 bounded response to independent verdict `rejected_needs_redesign`
- Authorized work unit and scope: correct only request-photo confirmation/soft holds, persisted-state vocabulary, per-operation boundary/traceability, and red-test acceptance/unit ownership
- Original findings: customer acceptance incorrectly followed media provision without Owner quantity/price confirmation and soft hold; input/candidate states diverged from Master SDD §6; operations lacked exact primary boundaries and SDD/WU0A traces; red tests lacked acceptance IDs and future units
- Completed: added C27 media-validation, C28 Owner-confirmation, C29 hold-expiry and internal C30 soft-hold operations; acceptance now requires a current proposal and active hold; mapped exact Master/photo/Phase 6 persisted states and transitions; assigned C01–C30/Q01–Q11 boundaries/traces/units; expanded every red row with setup, denial/effect, observability, layer and owner; hardened semantic validator checks
- Files/components/migrations: WU0B router/artifacts, Phase 9 TRACKER, this tracker, DOC-13 and continuity validator only; no runtime/test/migration/config/generated file
- Verification actually run: pre-review continuity validator PASS (`MARKDOWN_FILES_CHECKED=30`, `REQUIRED_PHASE_FILES=25`); C01–C30/Q01–Q11 boundary/trace coverage and 50 owned red rows pass; six in-memory Owner-confirmation, hold-order, command-boundary, query-trace, red-owner and persisted-state negative probes pass; 12-file documentation/validator scope, links, size limits, prohibited paths and `git diff --check` pass; focused reviewer verdict pending
- Supabase/external mutations: none; Stage 2 remains blocked until focused reviewer approval
- Decisions/deviations/risks: exact live RPC/schema compatibility remains `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`; no SDD change was required because the governing sources were consistent
- Next authorized action and gate: focused independent review of the four corrected findings only; do not start Supabase audit unless verdict is `approved`

### 2026-07-20 — Work Unit 0B focused-review state-vocabulary corrections

- Date/session: 2026-07-20 bounded response to focused verdict `approved_with_required_corrections`
- Authorized work unit and scope: correct the three remaining persisted-state vocabulary conflicts and direct-contradiction validator coverage only
- Completed: request-photo initial state is `none`; `skipped_false_detection` is a review disposition while the candidate retains a Master §6 state; Phase 6 hold statuses are `active`, `released`, and `converted_to_sale`, with expiry modeled as release; the validator rejects all three former contradictory forms and requires the exact hold marker
- Files/components/migrations: existing WU0B documentation/validator correction set only; no runtime/test/migration/config/generated file
- Verification actually run: continuity validator PASS (`MARKDOWN_FILES_CHECKED=30`, `REQUIRED_PHASE_FILES=25`); three new in-memory contradiction probes PASS; `git diff --check` and the 12-file documentation/validator scope pass
- Supabase/external mutations: none; Stage 2 remains blocked until the new context-isolated reviewer returns exactly `approved`
- Decisions/deviations/risks: no SDD change was required; the owning SDDs already fixed the correct values
- Next authorized action and gate: new context-isolated review of the corrected WU0B design; do not start Supabase audit unless verdict is exactly `approved`

### 2026-07-22 — Work Unit 0B actor-dispatch and semantic-validator corrections

- Date/session: 2026-07-22 bounded response to isolated verdict `approved_with_required_corrections`
- Authorized work unit and scope: resolve only C12/Q11 multi-actor primary-boundary ambiguity and artifact-wide semantic state-contradiction coverage
- Completed: added primary boundary `AE` for a shared authenticated dispatcher with closed caller-specific authorization/projection branches; C12 separates same-store Owner from claimed worker authority and results; Q11 separates customer from owning-store Owner projections; validator requires exactly one primary boundary, checks both branch contracts, scans all seven artifacts against closed state vocabularies and rejects semantic contradiction variants
- Files/components/migrations: existing 12-file WU0B documentation/validator correction set only; no runtime/test/migration/config/generated file
- Verification actually run: semantic negative probes for `unrequested`, candidate terminal `skipped_false_detection`, and expired hold status PASS; C12/Q11 shared-boundary probes PASS; continuity validator PASS (`MARKDOWN_FILES_CHECKED=30`, `REQUIRED_PHASE_FILES=25`); `git diff --check`, exact 12-file allowlist, prohibited-path scan and ≤350-line artifact/validator limits PASS (validator 349 lines)
- Supabase/external mutations: none; Stage 2 remains blocked until the final context-isolated reviewer returns exactly `approved`
- Decisions/deviations/risks: shared AE dispatch preserves one operation identity while making caller authorization explicit; no SDD or WU0A behavior changed
- Next authorized action and gate: final context-isolated review of the complete corrected WU0B diff; do not commit, push or start Supabase unless verdict is exactly `approved`

### 2026-07-22 — Work Unit 0B exact C12 ownership and semantic-closure corrections

- Date/session: 2026-07-22 bounded response to the next isolated verdict `approved_with_required_corrections`
- Authorized work unit and scope: name one exact shared C12 implementation boundary and reject lifecycle/workflow/terminal/persisted-as/transition/arrow state contradictions
- Completed: proposed `supabase/functions/image-inventory-publication-retry/index.ts` is the sole C12 boundary, both valid callers route to one projection-only service, Owner/worker endpoints may not duplicate C12, Q11 stays request-photo-owned; state validation now parses the reviewer’s broader semantic forms across all seven artifacts
- Files/components/migrations: existing 12-file WU0B documentation/validator correction set only; no runtime/test/migration/config/generated file
- Verification actually run: generated 105-case state matrix across five domains/twenty-one claim forms plus two special state/disposition probes and two C12 ownership/duplication probes PASS; continuity validator PASS (`MARKDOWN_FILES_CHECKED=30`, `REQUIRED_PHASE_FILES=25`); validator remains ≤350 lines and `git diff --check` passes
- Supabase/external mutations: none; Stage 2 remains blocked until another context-isolated reviewer returns exactly `approved`
- Decisions/deviations/risks: dedicated C12 endpoint removes implementation ownership ambiguity without splitting the approved operation ID; valid request-photo `expired` remains distinct from released hold status
- Next authorized action and gate: another context-isolated review of the complete corrected WU0B diff; do not commit, push or start Supabase unless verdict is exactly `approved`

### 2026-07-22 — Work Unit 0B final independent approval
- Date/session: 2026-07-22 final context-isolated review and documentation-only approval closeout
- Authorized work unit and scope: record the existing exact verdict `approved`, update the required 13-file handoff set, validate once, commit and push
- Completed: WU0B transitioned separately from implementation-complete to independently-approved
- Files/components/migrations: WU0B documentation, Phase 9 status/handoff documents and continuity validator only; no runtime/test/migration/config/dependency/generated file
- Verification actually run: final continuity validator and `git diff --check`; commit/push evidence reported after success
- Supabase/external mutations: none; no database, Storage, provider, deployment or live application action occurred
- Decisions/deviations/risks: exact live database facts remain `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`; independent approval grants no migration or runtime authority
- Tracker/source-doc updates: WU0B router/artifacts, Phase 9 README/TRACKER, this implementation tracker, DOC-13 and continuity validator
- Next authorized action and gate: consolidated Risk-Based Phase 9 SDD analysis in a new session; Supabase audit, migration and runtime remain unauthorized
### 2026-07-22 — WU0A/WU0B bounded contract correction
- Date/session: 2026-07-22 bounded SDD/contract correction and fresh correction-only review
- Authorized work unit and scope: reconcile alias vocabulary, price boundaries, publication outcome versus persisted state, complete stable-error mappings, exclude interactive support intervention, and add the nine named contract/design verification cases only
- Completed: canonical alias kinds/sources/statuses now round-trip with `common_spelling` and lifecycle-only supersession; private zero price and positive publication gates are separate; candidate/publication/API outcome vocabularies are closed; every C01–C30/Q01–Q11 error maps to registered metadata-complete `P9_*` codes; support takeover/cross-store private access is excluded; later runtime/release test ownership remains deferred
- Files/components/migrations: Phase 9 SDD/supporting/WU0/WU0B/tracker documents plus existing WU0A shared contract/domain files, fixtures, and tests; no migration, callable endpoint, product/mobile runtime, dependency, generated file, or Supabase artifact
- Verification actually run: focused WU0A Jest PASS 4 suites/45 tests; `npx.cmd tsc --noEmit` PASS; continuity validator PASS with 107 semantic cases, two C12 probes, 30 Markdown/link files, 25 required files, size checks, and embedded `git diff --check`; final standalone `git diff --check` PASS; fresh correction-only reviewer verdict `approved`
- Supabase/external mutations: no Supabase access/query/mutation, migration creation/application, Storage/provider call, deployment, or runtime action; Git commit/push evidence is reported after success
- Decisions/deviations/risks: P9-D39/P9-D40 corrected and P9-D44–P9-D46 added; no live-schema claim was made; interactive support tooling requires future separate design and authorization
- Tracker/source-doc updates: Master/Data/Extraction/Review/Media SDDs, data dictionary, traceability, WU0/WU0B artifacts, planning and implementation trackers, Phase 9 README/TRACKER, and DOC-13
- Next authorized action and gate: consolidated Risk-Based Phase 9 SDD analysis in a new session; Supabase audit, database/migration design, migration creation/testing/application, and runtime remain unauthorized
### 2026-07-27/28 — Unit 4B provider-attempt persistence correction and M14 application
- Authorized scope/completion/evidence: correction-only M14 plus claim-aware Gemini closes durable provider-attempt/reservation/usage/injected-pricing/cost/duplicate-spend lineage and performs full claim/media validation immediately before download and again before Gemini egress. Red failures proved the TOCTOU, claim-dependent spend hash, permissive pricing, and stale migration-set expectation. Stable logical spend identity excludes claim attempt while unique provider-attempt, claim, worker, and lease lineage remain separate; TypeScript and SQL share a bounded semantic pricing allowlist. On 2026-07-28 exact-project preflight confirmed M14 absent, M01-M08/M10-M13 once, M09 absent, and all dependencies; unchanged M14 applied as live version `20260727183546`. Readback proved the empty service-only relation, approved constraints/indexes/signatures/grants/RLS, intact M12/M13 fixture seams, PGlite 67/67, and fixture regression 23/23. No Storage/provider/credential/deployment/product mutation occurred. Gemini deployment/live verification, M09, Unit 5, and broader scope remain unauthorized.
### 2026-07-28 — Unit 5B merge documentation closeout
- Documentation-only closeout followed the independently approved Unit 5B merge `47f23a89a4df9ae8ece85842eb3020c3f17636bc`; only status/routing/handoff/evidence/validator documents changed. Continuity/Markdown links passed (`47`/`34`), traceability was `183` definitions with zero duplicates/missing, and no source/test/migration/credential/provider/deployment/Supabase/Storage/product mutation occurred. Google Books remained fixture/mock-only, M09 absent, and Unit 5C required separate authorization.
### 2026-07-29 — Unit 5C-2 store-scoped variant persistence foundation
- M18 is live once as `20260729004216`; M19 is live once as `20260729020008` and fences changed accepted envelopes. Schema/ACL/RPC plus proposed-only/exact-replay/changed-replay/mismatch/store-scope/rollback-cleanup smoke passed. Final corrected focused Jest passed 15/15, six-suite PGlite passed 74/74, scoped TypeScript passed, and continuity passed 195 definitions/zero duplicates/zero missing; full TypeScript timed out. The exact tree was independently approved, committed/pushed as `b3980349d9d446fbf1820ef869f6664953d9a599`, and fast-forward merged to `main`; M18/M19 are the only Unit 5C-2 database mutations and aliases/product data remain unchanged. Full evidence and the Batch 1 authorization gate are in [tracker 14](./14-unit5c2-variant-persistence-evidence.md).
### 2026-07-29 — Unit 5C-3 runtime generation, reconciliation, and lifecycle
- Optional same-call Gemini companion generation, independent fail-closed validation, M18/M19 persistence, confirmed-title/individual-author reconciliation, narrow normalization, material-change classification, default-deny activation, and trusted proposed/active/stale transitions are merged at `f09301b76fb14714f942a98f0ceffa5d5a0c3178`. Deep self-review corrected exact-confirmation removal, JavaScript/SQL symbol normalization, zero-based author indexing, and oversized/rejected fallback coverage. M20 (`20260729054842`) remains immutable applied history; M21 (`20260729060238`) forward-removed its temporary Unit 5C-4 search/materialization effects. Final affected Jest passed 7 suites/101 tests, database integration 12/12, TypeScript with `--allowImportingTsExtensions`, diff/secret/pyc checks, and rollback-only lifecycle smoke with zero residue; live proposal/proposal-set/alias counts were zero. Exact tree `eabe1040b4dbe89cf5163754fd719a11673a8682` received independent verdict `APPROVED`. Full evidence and Unit 5C-4 routing are in [tracker 15](./15-unit5c3-runtime-reconciliation-evidence.md).
