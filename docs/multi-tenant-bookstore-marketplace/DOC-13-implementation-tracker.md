## 2026-10-29 - Slice 7b-2 pushed, deployed and live-smoked; whole-slice Terra review; test-infra fixes

Phase 9 remains active. Slice 7b started in its own worktree `.claude/worktrees/p9-7b` (a short folder name because the longer name exceeded the Windows path limit on a tracked evidence file), branch `claude/phase9-psr-slice7b-lean-catalogue-writes`, cut from commit `6e4924d` (the 7a branch `claude/phase9-psr-slice7a-lean-catalogue-identity`). Owner instruction 2026-10-28: "after the docs update, please push to main 7a and also 7b 1" (earlier: "ok commit and push to main please"). Commit `d27e766` `feat(phase9): slice 7b-1 private catalogue companions and completion v2 (M84)` (37 files: M84 migration, worker package 6, tests, docs); the review scratch folders `psr7b-review/` and `psr7b-final-review/` and `.claude/` were NOT committed. The 7a branch `claude/phase9-psr-slice7a-lean-catalogue-identity` (tip `3352eec`, which adds the commit `fix(phase9): stop a successful Add showing the draft-conflict prompt` on top of `6e4924d`) was merged into the 7b branch: merge commit `e5ee35f`. One documentation conflict in tracker 38 (both sides had added a section 37) was resolved by keeping the 7a sections 37 and 38 and renumbering the 7b-1 section to 39. Then `origin/main` (`e7097d5`, nine Library/SDD-11 commits) was merged: merge commit `06706d6`, no conflicts; no file was changed on both sides (88 files changed on main, 85 on ours, none in common). Pushed `HEAD:main` to `origin` (`https://github.com/mdasheef99/Bookapp_reactexpo.git`): `e7097d5..06706d6`, a fast-forward, so main now contains slice 7a (M83 code and client fixes through `3352eec`) and slice 7b-1. The 7a branch itself was not changed or deleted; the 7a worktree had only untracked scratch folders. The 7a stanza below is not rewritten here.

Owner 2026-10-27 ("go, split 7b"): 7b is split by semantic responsibility into **7b-1 = M84** (private companions, completion v2, durable receipts, searched counts, the five carried M83 trace fixes of 02b section 13.3, and an expression index for the normalized title/author probes on canonical_works) and **7b-2 = M85 + M86 + M87** (the shared edition-list cache, with its own review and its own apply approval per migration). 7b-2 requires 7b-1 applied and verified. Local file `supabase/migrations/20261027000084_marketplace_phase9_catalogue_companions_completion.sql` (M84, 1789 lines, 131354 bytes) is APPLIED to the dev database as live version `20261028125102` (live name `marketplace_phase9_catalogue_companions_completion`; the local and live version strings differ, as for M83 whose live version is `20261026223715`); M84 now occupies 84 locally. Owner decision 2026-10-28 ("make it 3"): 7b-2 is built as THREE migrations, not one: **M85** (cache schema and guards, idle: tagged-union columns, the two lookup CHECKs admitting `cache_hit`, `phase9_catalogue_valid_cache_v1`, receipt guard, M68/M73 exceptions, legacy reader/writer discrimination), **M86** (scope and publication: `phase9_catalogue_query_scope_v1`, `phase9_catalogue_store_cache_v1`, completion publication step), **M87** (reuse: `phase9_catalogue_reuse_cache_core_v1` and its public service wrapper). This is already recorded in 02b section 12 (paragraph "Owner amendment 2026-10-28: 7b-2 is built as three migrations"); package 9 becomes 9a (M85), 9b (M86), 9c (M87), then row 10 (worker cache-reuse path) and row 11 (closeout). Each migration is created only on its own Owner approval and applied only on its own separate Owner approval. M85, M86 and M87 were created locally (uncommitted) 2026-10-28 by Codex Sol on the Owner instruction 2026-10-28 (chat) to create all three files now, review them in parallel, DO NOT APPLY (kept here as history): `supabase/migrations/20261028000085_marketplace_phase9_catalogue_cache_schema.sql` (M85, cache schema and guards, idle, 464 lines), `20261028000086_marketplace_phase9_catalogue_cache_scope_publication.sql` (M86, scope helper, store_cache, completion publication step forward-replacing the M84 completion v2 body, 414 lines), `20261028000087_marketplace_phase9_catalogue_cache_reuse.sql` (M87, reuse core and public service wrapper, 267 lines). At creation time NOT applied to any database; nothing deployed or pushed (kept here as history). Numbers 84 and 85 were verified free on 2026-10-27 (at the time the latest live migration was 20261026223715 (M83); no local or remote-tracking ref numbered 84 or higher). Each of M85, M86, M87 was applied 2026-10-29 only on its own separate Owner approval after a fresh project verification and a preflight: M85 APPLIED as live version `20261028222022` (live name `marketplace_phase9_catalogue_cache_schema`), M86 APPLIED as live version `20261028222200` (live name `marketplace_phase9_catalogue_cache_scope_publication`), M87 APPLIED as live version `20261028222318` (live name `marketplace_phase9_catalogue_cache_reuse`). Local files keep the `20261028000085/86/87` prefixes; live versions differ (as for M84).

The SDD amendment was approved by the Owner on 2026-10-27: 02b (status and migration rows, section 10 order and deploy dependency, new AC7-29 to AC7-34 in section 11, section 12 package table now rows 4-11 with a 7b-1/7b-2 split of the acceptance subset and the 7b-2 object list, new section 13.4, Owner decisions 10-14 in section 14, two conflict-register rows), SDD-0 section 7.1 (7b-1 and 7b-2 rows; slice 8 now depends on 7b-2) and SDD-2 Slice 7 (status paragraph and AC pointer). New acceptance: AC7-29 Select/Add lineage parity (Owner confirmed full parity with the lineage predicate in M83 lines 943-953 is the intended reading), AC7-30 registry lock on no-hint Select admission (the confirmed trace item), AC7-31 saved-ID Add provider-work conflict, AC7-32 cover rules only for provider-sourced metadata, AC7-33 Select does not require a work tuple that Add could create, AC7-34 the probe index (ISBN probes already have unique indexes and get none). The lookup-effects table's cache columns stay in M84 as nullable columns written only by M85 (Owner decision 2026-10-27).

Read-only preflight (2026-10-27, Supabase MCP, project ahntbtktjjmvfosgkmgn, https://ahntbtktjjmvfosgkmgn.supabase.co, PostgreSQL 17.6; SELECT/catalog/list_migrations only, nothing written) is recorded in supporting/database-current-vs-target.md under "2026-10-27 slice 7b read-only preflight". Headlines: no 7b object exists live (no completion v2, reuse, companion or cache function); function fingerprints recorded for every function 7b-1/7b-2 will replace; no index exists on the normalized title/author expressions; live lookups 244 all completed; cache entries 33, all store_private Google Books rows, none public; works 5, editions 5, sources 2, provider IDs 2, edition stats 2 rows, choice effects 5 (3 counted, 2 pending), blocklist 0. Not collected: deployed worker versions beyond the lookup version columns, scan-origin observation provenance, physical-call and reservation tables (7b-2 start), any provider licence investigation.

M84 apply preflight (2026-10-28, Claude Haiku, read-only, CLEAN, via the Supabase MCP on the Owner's explicit request to do the preflight and later apply the migrations): project URL matched `https://ahntbtktjjmvfosgkmgn.supabase.co`; latest live migration was `20261026223715` (M83); no live version at or above the M84 version and no live name containing `catalogue_companions`; the two new tables, the probe index and the seven new functions were absent; all ten replaced functions existed with identity arguments matching the file (owner `postgres`, `search_path=""`); no non-idle sessions and no ungranted locks; roles anon, authenticated, postgres and service_role present. Not covered by the preflight: return types of replaced functions and the existence of the two index helper functions (a mismatch there would have failed the apply and rolled it back as a unit).

M84 applied (2026-10-28) to Supabase project `ahntbtktjjmvfosgkmgn` (`https://ahntbtktjjmvfosgkmgn.supabase.co`) on the Owner's explicit request, with the Supabase MCP `apply_migration` in one call by a Claude Sonnet subagent that copied the SQL from the file. Result: `{"success":true}`. Live version `20261028125102`, live name `marketplace_phase9_catalogue_companions_completion`. Read-back (read-only `execute_sql`): the stored migration text in `supabase_migrations.schema_migrations` has length 131354 and md5 `253b224c9e7270590751aa435a43ef9f`, equal to the md5 of the local file (the transcription was faithful; SHA-256 of the local file: not recorded). New tables `marketplace_sec.phase9_catalogue_companions` and `marketplace_sec.phase9_catalogue_lookup_effects`: owner postgres, row level security enabled, not forced, no policies, ACL only postgres. New functions in `marketplace_sec`: `phase9_catalogue_valid_companion_v1`, `phase9_catalogue_companion_for_choice_v1`, `phase9_catalogue_count_search_v1`, `phase9_catalogue_lock_owner_scope_v1`, `phase9_catalogue_plan_keys_v1` (all postgres-only ACL, `search_path=""`) and `phase9_complete_candidate_edition_options_v2` (ACL postgres and service_role only); `public.phase9_complete_candidate_edition_options_v2` (ACL postgres and service_role only, exactly one overload in each schema); `public.phase9_add_candidate_to_inventory_v1` keeps EXECUTE for `authenticated`. Index `canonical_works_normalized_probe_idx` on `public.canonical_works` is valid and ready. Compatibility note (02b section 10, already recorded): completion v1 delegates to v2, so workers deployed before this change keep working against the new database.

Why not the Supabase CLI: it is installed (v2.20.12) and logged in, but `supabase db push --linked --dry-run` refused because the remote migration history contains versions with no local file (earlier migrations were applied through the connector with their own timestamps); repairing that history would rewrite the migration table, so it was not done. The link command created `supabase/.temp` in the worktree, which was removed afterwards (it is gitignored). No other database write.

M85/M86/M87 apply preflight (2026-10-29, Claude Haiku, READ-ONLY, CLEAN, via the Supabase MCP on the Owner's explicit instruction in chat ("get Haiku to do a preflight and apply it"; scope chosen by the Owner: all three, in order, stop at first failure)): project URL `https://ahntbtktjjmvfosgkmgn.supabase.co` matched; latest live migration was `20261028125102` (M84); no live name containing `catalogue_cache`; PostgreSQL 17.6; new columns/functions absent; replaced functions present with the expected signatures; `cache_entries` 33 rows; `phase9_metadata_lookups` 246 rows; `phase9_catalogue_lookup_effects` 0 rows; no foreign locks or active sessions; one stale in-progress `metadata_enrich` job (17 days old, expired lease, untouched); provider registry: google_books enabled/matching/storage true public_display false; open_library enabled/matching/storage/public_display true. Local files md5: M85 `9316432e5c278b2a85764ee73ec3e1b5` (464 lines, 31659 bytes); M86 `88ef822b3b95d9fa1c371c19d7fbe0a4` (414 lines, 33087 bytes); M87 `b168eb12206cc1d5e720adcd1b2657c9` (267 lines, 23181 bytes); M84 md5 unchanged.

M85/M86/M87 applied (2026-10-29) to Supabase project `ahntbtktjjmvfosgkmgn` on the Owner's explicit instruction, with the Supabase MCP `apply_migration`, one call per migration, by a Claude Sonnet subagent that copied the SQL from the files after an md5 check; each returned `{"success":true}` on the first try, no retry, no edit: M85 live version `20261028222022` (live name `marketplace_phase9_catalogue_cache_schema`); M86 live version `20261028222200` (live name `marketplace_phase9_catalogue_cache_scope_publication`); M87 live version `20261028222318` (live name `marketplace_phase9_catalogue_cache_reuse`). Why not the Supabase CLI: the same reason already recorded for M84 (remote history contains versions with no local file).

M88 applied (2026-10-29) to Supabase project `ahntbtktjjmvfosgkmgn` (`https://ahntbtktjjmvfosgkmgn.supabase.co`) on the Owner's explicit approval ("Yes, apply M88"), with the Supabase MCP `apply_migration` (name `marketplace_phase9_catalogue_cache_hardening`) from local file `supabase/migrations/20261029000088_marketplace_phase9_catalogue_cache_hardening.sql` (145 lines, sha256 `d7ad24a0abc25e05b84255b6a1acb47602f414103a6d66dd91aa891ca03d4d9f`, unchanged). Result `{"success":true}`. Pre-apply re-verification: `list_migrations` ended at M87 (`20261028222318`); `pg_stat_activity` 0 other active sessions, 0 waiting locks (open item 9 lock-duration re-check: single `CREATE OR REPLACE FUNCTION`, no table touched, DB idle). Live version `20261029151325` (list_migrations read-back shows it last). Read-back of `marketplace_sec.phase9_catalogue_store_cache_v1(uuid,jsonb)`: prosecdef true, owner postgres, proacl `{postgres=X/postgres}` (same as before apply), proconfig `search_path=""`; live definition contains the routing_policy_version guard, the provider_role guard and the post-lock deadline re-check; EXECUTE denied to anon, authenticated, service_role; 0 other active sessions afterwards. Effects: replaces only that one function; no table/data change. NOT done at the time (separate Owner approvals were still needed): commit/push to `main`, the single Render `phase9-metadata-worker` deploy, live worker smoke and browser checks; no Storage change; docs validator not run (blocked locally). Done 2026-10-29, tracker 38 section 49: commit `3fdc0c4` pushed to `origin/main`, deploy `dep-dbhmr07b9u1s73f8qjpg` live about 16:02 UTC (`/health` 200), live smoke passed for Open Library lookup + same-store reuse.

Read-back by the apply agent (read-only): after M85, the four new cache columns exist (4 rows), `phase9_catalogue_valid_cache_v1(jsonb)` and `phase9_catalogue_cache_receipt_guard()` exist, 0 cache rows with a payload_kind other than selected_snapshot_v1, `store_cache_v1` not yet present; after M86, `query_scope_v1(uuid,uuid)` and `store_cache_v1(uuid,jsonb)` exist, the reuse core not yet; after M87, the reuse core and the public wrapper `public.phase9_reuse_candidate_edition_cache_v1` exist and 0 rows have payload_kind `edition_options_v1` (nothing publishes yet). Latest five live migrations: M88, M87, M86, M85, M84. DB-level verification by Haiku: result to be recorded in tracker 38 section 43; M88 read-back in tracker 38 section 48.

Routing (02b section 12 and 14 decision 13, overridden by the Owner on 2026-10-28): Codex gpt-6.1-sol (xhigh) wrote M84 (package 5), package 6 (worker TypeScript) and all fix rounds except round A, at the Owner's instruction of 2026-10-28 that Sol writes 7b packages; this deviates from 02b decision 13 (which named Terra) and the Owner's instruction takes precedence. Package 7 (this closeout) by OpenCode Muse; test runs by Claude Haiku. Read-only reviews by Codex Sol, Codex Luna, OpenCode Muse, DeepSeek and GLM as recorded below; Haiku runs tests and browser checks (the Owner signs in); Muse writes docs from a factual brief; the orchestrator writes SDD amendments.

Deploy dependency (decision 14, amended by the Owner on 2026-10-28): the Render metadata worker deploys only from `main`. Slice 7a is now on `main` (merged and pushed as recorded above); the worker has since been deployed (`dep-dbhmr07b9u1s73f8qjpg`, live about 16:02 UTC 2026-10-29) after slice 7b-2 reached `main` as `3fdc0c4`; Render `phase9-metadata-worker` has auto-deploy off, so the deploy was an explicit Owner-approved `trigger_deploy`; no Expo/app release was made. The 2026-10-29 live smoke covered Open Library lookup + reuse (tracker 38 section 49). The Owner asked why two worker deploys and said to complete 7b-2 and deploy both at once; the amendment is recorded in 02b section 10 by an earlier run and is not repeated here. Order now: M84 applied (done) -> database-level verification of 7b-1 (done, tracker 38 section 40) -> M85 (package 9a) then M86 (package 9b) then M87 (package 9c), each created and applied only on its own separate Owner approval (done 2026-10-29, tracker 38 section 43) -> M88 APPLIED 2026-10-29 as live `20261029151325` on Owner approval "Yes, apply M88" (tracker 38 section 48) -> commit `3fdc0c4` pushed to `origin/main` -> ONE worker deploy `dep-dbhmr07b9u1s73f8qjpg` live about 16:02 UTC, `/health` 200 -> live smoke passed for Open Library lookup + reuse (tracker 38 section 49). Database-side checks (the five carried fixes, Select/Add chosen and added counts, the probe index) need no worker deploy.

Validator: the Phase 9 continuity validator PASSES in this worktree (PHASE9_CONTINUITY_CHECK=PASS, 108 Markdown files, 62 required files) after copying two untracked evidence files that earlier docs link to (`.claude/psr-slice6/db-evidence.md` and `.claude/psr-slice7a/preflight-1.md`) from the 7a worktree into this one at the same paths (they stay untracked). `git diff --check` was clean for the SDD amendment.

Package 4 (02b section 12 row 4: red-first tests only) is complete (2026-10-27, kept here as history in one paragraph): no production SQL, migration file or docs-of-behavior change; red-first test files added or changed in the p9-7b worktree (CarriedFixes, Companion, Completion, Searched and Accounting suites, `leanCatalogueCompletionFixture.mjs`, `leanCatalogueFixture.mjs` with the additive `m84` option and `requireM84`, native concurrency cases for AC7-30, AC7-31, AC7-18 and AC7-22, the additive two-clone native runner path, the M84 GUARD describe, and the edge companion/transport/recovery tests with the catalogueWrite fixture); first version by Codex Terra (cut off once by the usage limit, finished in resumes), fix rounds by Codex Sol at the Owner's request; reviews Muse PASS, Sol FINDINGS (1 High, 8 Medium, 1 Low) and Luna FINDINGS (8 Medium), all confirmed findings fixed; reds were feature assertions (107 PGlite, 33 Jest, 9 native) with green baselines.

M84 (package 5, 02b section 12 row 5) was created locally at `supabase/migrations/20261027000084_marketplace_phase9_catalogue_companions_completion.sql` (1789 lines, 131354 bytes) and is APPLIED to the dev database as live version `20261028125102` (2026-10-28; read-back above). Contents: private tables `phase9_catalogue_companions` and `phase9_catalogue_lookup_effects` (nullable cache columns reserved for M85), the companion validator, completion v2 (service-only; v1 delegates to v2), the M73 recovery replacement, the M15 local-completion hook replacement, the forward replacement of the M32 private structural-local wrapper, Select/Add companion handling, searched counts, the five carried M83 fixes (AC7-29 to AC7-33) and the probe index `canonical_works_normalized_probe_idx` (AC7-34). Package 6 (02b section 12 row 6, worker TypeScript under `supabase/functions/_shared/imageInventory/`): new `contracts/catalogueWrite.ts` and `metadata/openLibrary/catalogueWrite.ts`; changed `metadata/contracts.ts`, `metadata/openLibrary/adapter.ts`, `runtime/metadataEditionOptions.ts`, `runtime/metadataEditionOptionsBoundary.ts` and `runtime/metadataEditionOptionsRpc.ts`; new edge tests `phase9_catalogue_write_fetched_at.test.ts` (19 cases) and `phase9_catalogue_write_recovery_outage.test.ts` (8 cases).

Fix rounds: A (Muse): Select companion fix and completion v2 session-lock order. B (Sol): P1 native test inspect fix, local-hook setup fix, and the P2 deadlock fix (the forward-replaced M32 wrapper takes the session lock first; the M15 hook takes the session lock first and inserts the lookup before `choice_target`). C (Sol): `marketplace_sec.phase9_catalogue_lock_owner_scope_v1(uuid)` taken after state locks in Select, Add and the M15 hook (the owner review-scope cross-session cycle found by DeepSeek); worker timestamps compared as bigint microseconds via `fetchedAtMicros` (Luna). D (Sol): Terra T1 (recovery outage mitigated), T2 (stranded job fixed, narrowed to earlier-claim evidence) and T3 (second microsecond instance on the legacy path). E (Sol): the native Round C test setup corrected (closed session 1 and active session 2 of one owner and store; the `image_extraction_sessions_one_active_initiator` index in `20260722000002_marketplace_phase9_extraction_persistence.sql:30` forbids two active sessions) and a validated `-OnlyGroup` parameter added to `run-phase9-bookstore-first-postgres.ps1`. F (Sol): final-review finding R1 — Select now refuses a companion/source work disagreement exactly as the resolver does (two parity tests added; CarriedFixes 28 -> 30).

Reviews (read-only except where noted): the M84 SQL was reviewed by Muse, Sol and Luna (see their out-*.md files); DeepSeek `opencode-go/deepseek-v4.1-flash` `VERDICT: FINDINGS` (review-scope cycle); GLM `opencode-go/glm-5.3-flash` `VERDICT: PASS`; package 6: Muse `VERDICT: PASS`, Luna `VERDICT: FINDINGS` (1 Medium, microsecond timestamps), Terra (Codex) `VERDICT: FINDINGS` (T1, T2, T3); the final whole-slice review by Sol (read-only, xhigh) found no blocker and one should-fix (R1), fixed in round F. Every confirmed finding was fixed; Muse's package 6 PASS did not catch Terra's three findings.

Verification actually run (final): PGlite — 12 existing Lean files 273/273, CatalogueLink 79/79, Companion 25/25, Completion 39/39, Searched 11/11, CarriedFixes 30/30 (after round F; 28/28 in the earlier full run), Accounting 29/29; Jest — catalogue-write companion 13/13, transport 8/8, recovery 6/6, GUARD `marketplacePhase9LeanCatalogue.test.ts` 49/49 (round F: Sol's own run, 486 PGlite + 49 GUARD, 0 failures; the full Haiku run before round F showed the same suites green with CarriedFixes 28). Worker round D: Sol's own run, full `supabase/functions` suite 1,386/1,386 and `tsc` clean (not repeated by Haiku). Native Postgres (Haiku, full run before round F): edition-picker, open-library, bookstore-first, catalogue-link, lean-catalogue-identity, lean-catalogue-completion (10 pass / 17 skipped) and lean-catalogue-local-hook (3 pass / 0 fail, no deadlock) PASS; edition-first-save FAIL 0/11 for an environment reason only (`Cannot find package 'pg'` in this worktree; unrelated to M84; those 11 tests were not executed here). After round F only the native completion group was re-run: lean-catalogue-completion PASS again (10 pass / 0 fail / 17 skipped, teardown clean, runner exit 0).

Not yet verified after the apply: the M84 database-level verification of AC7-8 and AC7-28 effective role privileges and RLS operations through real roles and AC7-34 planner use is done (tracker 38 section 40; Q1-Q5 PASS with the one wrong expectation noted there); still not verified are AC7-13 and AC7-17 real response-loss/outage/rollback behavior, a live smoke of completion v2 and Add through the worker, and every M85/M86/M87 item beyond what the live smoke proved (M85/M86/M87 APPLIED (live 20261028222022 / 20261028222200 / 20261028222318, 2026-10-29); verified by apply-agent read-back, tracker 38 section 43; Open Library lookup + same-store reuse additionally proven by the 2026-10-29 live smoke, tracker 38 section 49). Not run after the merges: no test suite was re-run on the merged tree (the suites were run on the 7b-1 tree before the merge; PGlite, Jest and native results are already recorded). No PR was opened.

Environment notes: `pg` is missing in the p9-7b worktree (no `node_modules`); `core.autocrlf=true` causes the CRLF-sensitive edition-first-save T8 case to fail; Jest media tests need a temporary copy of `magick.wasm` from the main checkout `node_modules/@imagemagick/magick-wasm/dist/magick.wasm` (removed afterwards); the continuity validator is blocked by PowerShell execution policy on this machine; Codex sandboxes cannot run the native runner (initdb), so Haiku or the orchestrator runs it.

Deviations recorded: (1) the M32 private structural-local wrapper is replaced in M84 although 02b's function list does not include it (Owner approved the coordinated patch); (2) Sol authored M84 and the fix rounds instead of Terra (above). Spec-silent choices recorded: helper names `companion_for_choice_v1`, `count_search_v1`, `plan_keys_v1`, `phase9_catalogue_lock_owner_scope_v1`; error codes `P9_EDITION_ROWS_INVALID`, `P9_STATE_CONFLICT`, `P9_IDEMPOTENCY_MISMATCH`, `P9_CATALOGUE_COMPANIONS_INVALID`; the completion digest uses `jsonb::text` so companion-array order affects the digest; probe index name `canonical_works_normalized_probe_idx`; worker exports `CATALOGUE_WRITE_VERSION`, `CatalogueWriteCompanion`, `parseCatalogueWriteCompanion`, `parseCatalogueCompanions`, `serializeCatalogueCompanions`, `isCatalogueScalar`, `fetchedAtMicros`, `EditionOptionsCompletionUncertainError`.

Residual risks: (R-a) Terra T1 — the recovery attempt budget is not database-owned; an attempt-neutral deferral is not specified by 02b and needs a later SQL/RPC claim policy; mitigated in the worker only. (R-b) completion v2 takes the registry SHARE lock before new private receipt/companion INSERTs. (R-c) Add flushes edition stats before work stats in the pending case. (R-d) the M32 wrapper replacement (deviation). (R-e) the items listed under "Not verified".

M84 database-level verification (2026-10-28, Claude Haiku, read-only except calls with NULL arguments under test roles, rolled back or temp-table only; project URL `https://ahntbtktjjmvfosgkmgn.supabase.co` confirmed): Q1 both new tables RLS enabled, not forced, 0 policies, ACL `{postgres=arwdDxtm/postgres}` PASS. Q2 declared privileges: anon and authenticated all false; service_role false for both tables and `marketplace_sec.phase9_catalogue_valid_companion_v1`, TRUE for `marketplace_sec.phase9_complete_candidate_edition_options_v2` (the brief's expectation "false" was wrong; M84 grants EXECUTE on the private v2 to service_role at migration L1533, exactly as the private v1 has `{postgres=X/postgres,service_role=X/postgres}`; not a defect); public v2 executable only by service_role; `public.phase9_add_candidate_to_inventory_v1` executable only by authenticated. Q3 effective operations via SET LOCAL ROLE: anon and authenticated got SQLSTATE 42501 on all four operations (select companions, delete effects, call valid_companion, call public v2); service_role got 42501 on select companions, delete effects and valid_companion, and `P0001 P9_OWNER_NOT_AUTHORIZED` (not a permission error) calling the public v2 with NULL arguments. Q4 probe index valid and ready; EXPLAIN with `enable_seqscan=off` and also without it uses `Index Scan using canonical_works_normalized_probe_idx`. Q5 v1 with 16 arguments in `public` and `marketplace_sec`, v2 with 17 arguments once per schema, and the delegation chain is public v1 -> private v1 (body mentions v2) and public v2 -> private v2 (public v2 body mentions v2). This covers AC7-8 and AC7-28 effective privileges/RLS for M84's objects and AC7-34 planner use on the live dev database. Still not verified: real response-loss/outage/rollback (AC7-13, AC7-17), live completion v2 and Add through the worker, and the Haiku DB-level verification of M85/M86/M87 (APPLIED 2026-10-29, live 20261028222022 / 20261028222200 / 20261028222318; apply-agent read-back in tracker 38 section 43; DB-level result to be recorded in tracker 38 section 43). Full table in tracker 38 section 40.

Package 8 (02b section 12 row 8, red-first cache tests) is complete locally (2026-10-28): authored by Codex gpt-6.1-sol (xhigh) per the Owner's routing; brief `psr7b-review/brief-sol-pkg8.md`, report `psr7b-review/out-sol-pkg8.md`; counts independently re-run by Claude Haiku with no mismatch. Edited `supabase/tests/phase9/leanCatalogueFixture.mjs` (additive `m85` option and `requireM85`, plus cache helpers) and native `supabase/tests/phase9/phase9LeanCatalogueConcurrency.postgres.mjs` (five appended tests: one baseline fixture control and four AC7-18/22 cache race cases); new `phase9LeanCatalogueCacheSchema.integration.test.mjs` (38 tests: 3 pass / 35 fail), `phase9LeanCatalogueCacheReuse.integration.test.mjs` (20: 3 pass / 17 fail), `phase9LeanCatalogueCachePublication.integration.test.mjs` (13: 3 pass / 10 fail), `supabase/migrations/__tests__/marketplacePhase9CacheReuse.test.ts` (17: 5 pass / 12 fail), `supabase/functions/__tests__/phase9_catalogue_cache_scope.test.ts` (7: 6 pass / 1 fail), `phase9_catalogue_cache_reuse.test.ts` (5: 1 pass / 4 fail) and fixture `supabase/functions/__tests__/fixtures/phase9/catalogueCache.ts`. Combined new Jest 12 pass / 17 fail (29); combined new PGlite 9 pass / 62 fail; total over PGlite and Jest (native excluded) 79 feature failures (62 + 17) and 21 passing controls (9 + 12); every new PGlite failure is an assertion failure, none skipped. Existing suites unchanged and green: 19 existing PGlite files (Lean files plus CatalogueLink) 486 pass / 0 fail; GUARD `marketplacePhase9LeanCatalogue.test.ts` 49 pass; catalogue-write edge suites 54 pass. Five first-run corrections disclosed by Sol (the literal "first run fails on a feature assertion" condition was not fully met on the first run): C1 two failing controls (missing role reset, incorrect refusal expectation); C3 assumed explicit Open Library reserved monetary cost was nonzero (it is zero; a separate accounting control now proves nonzero spend); first TTL test used a title differing from its scan evidence; C6 incorrect fixture metadata contract literal. The five new native tests were NOT run (not runnable in Sol's sandbox); expected on M84: baseline control PASS and the four cache-race tests FAIL at "AC7-18 M85 publication must bind the completed scan lookup to its shared cache entry"; a green run needs an M85-equipped disposable clone and the runner currently installs only M83/M84 (not edited). Open items/spec gaps for the Owner are recorded in tracker 38 section 40 and 02b section 13.6.

Package 8 fix round finished first (2026-10-28, Codex Sol; base committed locally as `92c58c1`, fix-round files uncommitted, not pushed): tests restructured to M85/M86/M87 levels (fixture takes `m85`/`m86`/`m87` options; new suites for Privacy, Legacy and Admission plus `leanCatalogueCacheFixture.mjs`; guard and runner changes). Reviews of the migrations (read-only): round 1 Terra (xhigh) FINDINGS and Muse FINDINGS - Terra High 1 (M85 dropped the M73 external-lineage predicate `adapter_key IN('google_books','open_library')`, verified and fixed), Terra High 2 (M86 completion raised when a Google primary lookup was completed by an Open Library secondary attempt because the writer compared the attempt adapter with the lookup adapter, verified and fixed: completion proceeds as in M84 and publication is skipped for a secondary attempt), Terra Medium 3 (M87 hidden-edition check ran before the locks, confirmed and fixed with a recheck under the resolver locks and atomic rollback to `miss`); Muse missed both Highs; seven claimed test defects were adjudicated by both reviewers as test bugs and fixed (including the Reuse AC7-11/16 undefined helper and the AC7-21b missing role reset fixed by Muse). Dropped as Owner-level open items: AC7-21(b) synthetic-provider admission (the unchanged M73 validators accept only `google_books`/`open_library`; Terra again flagged it unmet) and the provider-facts-only duplicate case (02b 8.1 defines no distinct producer). Round 2: Terra FINDINGS (hidden coverage for ineligible/conflict-skipped rows; A1/A2 correct, A3 incomplete) and DeepSeek FINDINGS (ISBN-10 compared raw in the hidden filters while the resolver uses normalized values, verified and fixed). Fix round 2 normalized both ISBN comparisons in publication and reuse and added a final hidden recheck for every retained row (publication filters, reuse returns `miss`). Verification (Haiku independent run after fix round 2, PGlite/Jest only; native NOT run): CacheSchema 35, CacheLegacy 2, CachePublication 25, CacheReuse 30, CachePrivacy 10, CacheAdmission 2, all pass (104 tests); cache GUARD file passes (21, inferred from totals); worker edge cache tests 5 fail as expected (they need the package 10 reuse RPC call); existing baselines unchanged: 486 PGlite, LeanCatalogue GUARD 49, five catalogue-write edge files 54; M84 md5 `253b224c9e7270590751aa435a43ef9f` unchanged. Native cache tests have not been run (they need an M85-M87 clone). Spec gaps awaiting the Owner: (a) 02b fixes no TypeScript module/signature for the worker scope derivation; (b) the dependency-rule wording above (orchestrator reading, PENDING Owner confirmation: a later migration may forward-replace an earlier migration's function body and call earlier objects; no migration references an object created by a later one). Docs validator: not run (blocked locally by PowerShell execution policy).

State: 7a (M83 code and client fixes through `3352eec`) and 7b-1 (commit `d27e766`, merges `e5ee35f` and `06706d6`, pushed `HEAD:main` `e7097d5..06706d6`) remain on `main` as recorded above; M84 remains APPLIED as live version `20261028125102`; slice 7b-2 is LIVE: commit `3fdc0c4` ("feat(phase9): slice 7b-2 lean catalogue cache writes, reuse and M88 hardening", 47 files, +3637/-451) committed and pushed to `origin/main` on Owner instruction ("commit and push to main directly"), and Render `phase9-metadata-worker` (`srv-d9sqfdvqj5pc73dc66fg`, branch `main`, Docker, autoDeploy off) deployed on Owner instruction ("Deploy now") via the Render MCP `trigger_deploy` as deploy `dep-dbhmr07b9u1s73f8qjpg`, live about 16:02 UTC with `/health` 200 (tracker 38 section 49). All package 8 files (including the fix-round files, verified by Haiku PGlite/Jest as above; native PASS 2026-10-29, tracker 38 section 44) and all package 10 files (per tracker 38 section 45) went live in that commit; the native PostgreSQL concurrency group `lean-catalogue-cache` PASS 2026-10-29 on the Owner instruction "Why don't you run it?" (`NATIVE_GROUP lean-catalogue-cache PASS`, 37 tests, 10 pass, 0 fail, 27 skipped by design, exit 0; log `psr7b-review/native-cache-run2.log`; test-only fix in `psr7b-review/out-sol-native-fix.md` edited only `supabase/tests/phase9/phase9LeanCatalogueConcurrency.postgres.mjs`); package 10 (worker cache-reuse path, 02b section 12 row 10) implemented 2026-10-29 by Codex Sol (xhigh) on the Owner instruction "Record, then pkg 10", committed in `3fdc0c4` and deployed with the worker, and reviewed read-only (Terra FINDINGS: one Medium, recorded as Owner OPEN ITEM 10; DeepSeek PASS); the worker calls `public.phase9_reuse_candidate_edition_cache_v1` (M87) with the fence values and a nine-key `p_cache_versions` object after `phase9_recover_candidate_edition_options_v1` and before any provider lookup, reservation or registration, continues on a strict `{status:'miss'}` only, completes a hit with zero reservations/GETs/registrations, and recovers any unknown/malformed response or RPC error to `manual_metadata_required` with no provider egress; files changed per tracker 38 section 45 (six runtime files, two fixtures with one explicit reuse miss response each, new hostile suite of 30 tests; briefs `brief-sol-pkg10`, `brief-sol-pkg10-legacy`, `brief-sol-pkg10-tests`, `brief-sol-pkg10-final` and reports `out-sol-pkg10`, `out-sol-pkg10-legacy`, `out-sol-pkg10-tests`, `out-sol-pkg10-final` in `psr7b-review/`); Sol's own run 18 Jest suites 282 pass 0 fail with scoped metadata-worker `tsc --noEmit` clean; hostile first run 27 pass / 3 fail then green after one production abort-check line plus two characterisation rewrites; legacy Node fixture-only fix with Haiku clean-snapshot rerun per section 45; package 11 (independent integration/native/security closeout review, 02b section 12 row 11) done 2026-10-29 (tracker 38 section 46); the fourteen OPEN ITEMS (nine of tracker 38 section 42 plus 10, 11, 12, 13 and new 14; item 7 resolved by the Sol-chosen names pending Owner confirmation) recorded in tracker 38 sections 45-46; M85 APPLIED as live `20261028222022`, M86 APPLIED as live `20261028222200`, M87 APPLIED as live `20261028222318` (2026-10-29; read-back in tracker 38 section 43). Rollback is a new forward migration (additive changes; the worker does not use the cache yet). M88 APPLIED 2026-10-29 (`supabase/migrations/20261029000088_marketplace_phase9_catalogue_cache_hardening.sql`, 145 lines, sha256 `d7ad24a0abc25e05b84255b6a1acb47602f414103a6d66dd91aa891ca03d4d9f`, unchanged) as live version `20261029151325` (`marketplace_phase9_catalogue_cache_hardening`); replaces only `marketplace_sec.phase9_catalogue_store_cache_v1(uuid,jsonb)`; no table/data change; see tracker 38 section 48.

Active work unit: 7b-2 live and smoked 2026-10-29 (commit `3fdc0c4` on `main`, M85-M88 applied, worker deployed as `dep-dbhmr07b9u1s73f8qjpg`, Open Library lookup + reuse live-smoked, Terra whole-slice review, two test-infra fixes by Sol). The closeout docs plus the three test-infra files (`package.json`, `run-phase9-bookstore-first-postgres.ps1`, `phase9NativeGroupRunner.test.ps1`) were committed and pushed to `origin/main` as `0d240ef` on Owner instruction ("Commit and push"); no worker change, so no Render redeploy was needed for them.

Package 11 (02b section 12 row 11, 2026-10-29, Owner instruction "Start package 11"): three independent READ-ONLY reviewers of the whole 7b-2 vertical (M85-M87 as applied, package 10 worker path, tests), brief `psr7b-review/brief-review-closeout.md`, outputs `psr7b-review/out-terra-closeout.md` (Codex Terra, xhigh), `psr7b-review/out-deepseek-closeout.md` (OpenCode DeepSeek) and `psr7b-review/out-muse-closeout.md` (OpenCode Muse); Claude Haiku ran the wide regression baselines (read-only). No file, database, git or deploy state changed by any of them. ROLLOUT/ROLLBACK VERDICT: SAFE (all three; static assessment, not a live rollback proof): the old worker never reads or writes `edition_options_v1` (kind filters in M85/M87), its v1 completion carries NULL companions so M86 publication is skipped, M84 replay bytes unchanged; v2-capable old-worker Open Library-primary completions may publish unread, expiry-bounded entries (so "cache idle" holds for reads, not strictly for writes); new-worker failure modes are recovery-only, never provider egress; rollback = redeploy the previous worker, the DB stays additive and entries stay unused; the in-flight/selected-option rollback matrix was NOT demonstrated (static assessment only); the Open Library lookup + reuse live smoke passed on the deployed worker (tracker 38 section 49). AC traceability: the cache ACs (AC7-3, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 21, 22, 23, 24, 26, 27) were mapped by all three; Muse and DeepSeek rated nearly all PROVEN; Terra rated several WEAK (7-3, 7-6, 7-7, 7-10, 7-11, 7-13, 7-23, 7-24, 7-26) and 7-17, 7-21 UNPROVEN; unanimous: AC7-21(b) UNPROVEN (known Owner open item 1); AC7-17 (old/new worker, in-flight and rollback-after-cache-selection matrix) is WEAK/UNPROVEN in tests and was deferred to the post-deploy smoke; the smoke proved lookup + reuse, not the rollback matrix. FINDINGS (orchestrator-verified against the applied SQL text; M86 was APPLIED and immutable, so the SQL fix went into NEW migration M88, created locally and applied 2026-10-29 as live `20261029151325`; see tracker 38 sections 47-48): Terra 1 (Medium): `marketplace_sec.phase9_catalogue_store_cache_v1` (M86) compares the outcome attempt's adapter key, adapter version, normalizer, capability and schema versions with the lookup but NOT `routing_policy_version`; an attempt registered with a different routing version could publish under the lookup's key (low realistic exposure: the worker derives both from one configuration); hardening: skip publication (return NULL, like the other mismatches) on routing-version mismatch, with a regression test. Muse 1 (Low): the publication guard in `phase9_complete_candidate_edition_options_v2` (M86) is `IF a.adapter_key=l.adapter_key`, not role-based; verified equivalent in practice because M73 only admits a secondary attempt for a `google_books` lookup with adapter `open_library`; hardening: also guard on `a.provider_role='primary'`. Terra 2 (Medium): a Google-primary request reuses once with the Google tuple and on the Open Library fallback never reuses an already published Open Library entry, so it makes extra provider calls (spend, not privacy or correctness); extends open item 3; recorded as OPEN ITEM 14. DeepSeek 1-4 (Low, test gaps, no production defect): (1) a fresh primary v1/NULL-companion completion by an old worker on the M85-M87 database is not asserted; (2) PUBLIC privileges of the new functions/tables are not asserted in the PGlite suites (the live read-only check by Haiku on 2026-10-29 showed no PUBLIC/anon/authenticated execute); (3) "live incumbent wins with a different digest" is unproven (native cases use identical digests); (4) the AC7-10 denial matrix for `storage_allowed=false` and `matching_allowed=false` on the cache path is not exercised. Races not covered by name: reuse overlapping a registry disable or policy_version bump (publication variant proven), `invalidated_at` racing reuse, concurrent double reuse or reuse versus external completion on one job (fence serialization), the residual hide window (open item 6). Terra noted `service_role` has EXECUTE on both the private definer entry `marketplace_sec.phase9_reuse_candidate_edition_cache_v1` and the public invoker wrapper (the core and publication helpers deny it); matches the SDD arrangement and the live ACL read-back. Haiku wide regression (2026-10-29): 18-file existing PGlite set 486 pass / 0 fail; LeanCatalogue GUARD 49/49; CacheReuse GUARD 21/21; scoped metadata-worker `tsc --noEmit` rc 0; outside the named baselines, other migration Jest GUARD files 41 suites / 238 tests (236 pass, 2 FAIL in `marketplacePhase9EditionChoiceFirstSave.test.ts`, M82, CRLF on this Windows checkout, 7b changed neither file, environmental/pre-existing) and phase9 edge Jest 69 suites / 1351 tests (1347 pass, 4 FAIL in `phase9_media_processor.test.ts`, ENOENT `node_modules/@imagemagick/magick-wasm/dist/magick.wasm`, no node_modules in this worktree, environmental); neither is caused by 7b-2. Open items now: the nine of tracker 38 section 42, 10 (reuse-error claims burn the attempt budget), 11 (lost-fence reuse returns a plain miss), 12 (22 legacy Node failures on HEAD of unknown cause), 13 (spec-silent TypeScript names), 14 (Open Library fallback cannot reuse an existing entry). M88 APPLIED 2026-10-29 as live `20261029151325` (`marketplace_phase9_catalogue_cache_hardening`; Owner approval "Yes, apply M88"; project re-verified, lock-duration re-check with 0 other sessions and 0 waiting locks, read-back PASS); slice 7b-2 committed as `3fdc0c4` and pushed to `origin/main`, worker deployed as `dep-dbhmr07b9u1s73f8qjpg` (live about 16:02 UTC, `/health` 200), live smoke passed for Open Library lookup + same-store reuse (details in tracker 38 section 49); test hardening done 2026-10-29 by Sol, committed and pushed as `0d240ef` (the explicit `-OnlyGroup lean-catalogue-cache` run now throws `Lean-catalogue cache acceptance missing migrations: ...`, naming the missing M numbers, before any database command and records the group as failed instead of silently passing on a missing M85-M88 chain — a full run with no `-OnlyGroup` still skips; `test:phase9:db` now also globs `supabase/tests/phase9/*.guard.test.mjs`; `phase9NativeGroupRunner.test.ps1` +17/-6 with four missing-chain failures and the full-run skip asserted); docs validator not run (blocked locally).

Exact next authorized action (one exact): the closeout docs and the three test-infrastructure files are pushed as `0d240ef` (a follow-up to `3fdc0c4`; no worker change, no Render redeploy needed); the Owner chooses the next work unit (slice 8; its scope is not recorded here and must be read from the post-scan-rework SDDs before starting).

Database/storage mutation authority: none in this docs step. 7a and 7b-1 remain on `main` as recorded above (commit `d27e766`, merges `e5ee35f` and `06706d6`, pushed `HEAD:main` `e7097d5..06706d6`); slice 7b-2 committed and pushed directly to `origin/main` as `3fdc0c4` on Owner instruction ("commit and push to main directly"); the review scratch folders `psr7b-review/` and `psr7b-final-review/` and `.claude/` were NOT committed. The smoke's rows (lookups, provider calls, cache row, effects, canonical work/edition) were created by the app/worker itself through the owner flow in the dev project; agents wrote nothing directly. The closeout docs update and the three Sol test-infra files were committed and pushed to `origin/main` as `0d240ef` on Owner instruction ("Commit and push"); no Storage change; docs validator not run (blocked locally). The worker IS deployed (`dep-dbhmr07b9u1s73f8qjpg`, live about 16:02 UTC, `/health` 200); no Expo/app release was made.

## 2026-10-27 - Slice 7a M83 applied, verified and committed; review fix round

Phase 9 remains active. Worktree phase9-psr-slice5b-add-isbn, branch claude/phase9-psr-slice7a-lean-catalogue-identity (from 87db21c).

M83 `supabase/migrations/20261026000083_marketplace_phase9_lean_catalogue_identity.sql` applied 2026-10-27 to project ahntbtktjjmvfosgkmgn as live version 20261026223715. Read-back PASS (18 functions match local bodies; ACLs/RLS as designed). Browser check PASS (tracker 38). Details: 02b §13.3, supporting/database-current-vs-target.md, trackers/02.

Commit 621b6d1 "feat(phase9): slice 7a lean catalogue identity (M83)" made on the Owner's instruction, plus the 7a review fix-round commit and the 7a closeout (Add draft-conflict) fix commit, both made on the Owner's instruction (hashes not recorded in the docs). Branch claude/phase9-psr-slice7a-lean-catalogue-identity is committed and pushed on the Owner's instruction.

Fix round done (2026-10-27): Codex gpt-6.1-sol xhigh implemented, Codex gpt-6.1-terra xhigh read-only reviewed, orchestrator verified. A `no_longer_eligible` Add refusal is stored with the authority actually checked at the failing stage, including the post-save authority when the same Add saved first. It is cleared only when a newer authority for that candidate appears in the query cache (for example after the Owner taps "Confirm current suggestion"), so Add re-enables without a page reload and unsaved price/condition edits are kept; `succeeded`, `still_pending` and `failed_retryable` outcomes are unchanged. The "confirm the suggestion" guidance shows only for a save-stage `P9_STATE_CONFLICT` when the card's current, scoped edition choices show an automatic current suggestion not confirmed by the Owner ("Check the latest details. If this is the suggested edition, open Find or change edition and tap Confirm current suggestion."); other refusals keep the generic text, and the claim-stage text no longer says to reload ("This book changed after your edits. Check the latest details and press Add again."). Tests: Review3 supplied-companion case relabelled as 7a refusal; Review5 no-hint case gained a positive control (the target resolves with a provider record, then NULL without it; an always-NULL helper fails); new hook and mounted BatchReviewCard tests for refusal to confirm to Add re-enabled with edits preserved and sent (service responses mocked), post-save refusal retention, and conditional guidance with and without evidence. Terra round 1 on the first Sol diff: 3 Medium findings (refusal cleared by its own save, guidance lost although choices were available, recovery test not mounted); all fixed in Sol round 2. Terra found the claim-stage dead end not reachable through the batch card path. Verification run by the orchestrator (2026-10-27): Jest 4 suites (postScanUiCorrections, useInventoryCommitCoordinator, batchReviewCard, inventoryCommitCoordinator) 163/163 passed; PGlite Review3 + Review5 22/22 passed; Phase 9 continuity validator PASS. Sol reports red-first failures before each fix and TypeScript 8 errors in files outside this change (pre-existing, not touched). Not browser-verified.

M83 trace verdicts (Codex gpt-6.1-terra max, read-only): 1 confirmed, 4 latent, 0 rejected; all five carried to 7b. (1) No-hint Select counts an option whose normalizer version differs from the lookup/attempt; Add rejects the lineage — LATENT. (2) Admission is read without FOR SHARE in `phase9_catalogue_choice_target_v1`; an operator/service-role provider policy change concurrent with an Owner Select can let chosen count after revocation — CONFIRMED. (3) Saved-ID Add ignores an existing conflicting provider-work tuple when title/authors match — LATENT. (4) Select checks the canonical display cover against the scoped provider's cover rules — LATENT. (5) Select requires an existing provider-work tuple that Add could create — LATENT. Owner decision 2026-10-27: carry all five to 7b (fix red-first before or with 7b); no separate M84 now. M84 is not authorized.

Active work unit: post_scan_rework_slice7a_closeout. Exact next authorized action: Owner decides on merging the 7a branch into main (needed before 7b worker deploys/browser checks); separately, investigate the phase9-owner-ingestion CORS/503 errors seen from localhost. 7b runs in its own session/worktree (.claude/worktrees/p9-7b, branch claude/phase9-psr-slice7b-lean-catalogue-writes), carrying the five M83 trace items.

Database/storage mutation authority: none. The fix round made no database or storage mutation; this documentation update made no database or storage change.

7a closeout fix done and browser-checked (2026-10-27): the Add draft-conflict fix (Codex gpt-6.1-sol xhigh, three rounds; Codex gpt-6.1-terra xhigh read-only reviews ending in PASS) and its browser check PASS (BOOK 3 "Bleak House" added with no draft-conflict prompt; server truth read back). No database/storage mutation by agents; dev data via the app (one Add). Detail: trackers/02 and tracker 38 §38.

## 2026-10-26 - Slice 7 design approved; slice 7a build started; M83 proposed

Phase 9 remains active. **Owner 2026-10-26:** 02b is approved as the Slice 7 design; 7a build and local migration creation are authorized ("Yes, create it", steps up to review). The 7a/7b split is recorded in SDD-0 §7.1 and SDD-2 Slice 7; 02b §12 owns objects/packages/acceptance. 7b is not authorized and starts only after 7a is applied and verified. Selected worktree phase9-psr-slice5b-add-isbn stays on claude/phase9-psr-slice7a-lean-catalogue-identity, created from 87db21c (R12, own branch per slice). Commit 87db21c ("feat(phase9): slice 6 catalogue link (M81), M82 edition-choice fix, slice 7 design") is committed locally on claude/phase9-psr-slice6-catalogue-link, not pushed; earlier handoffs predate it.

Orchestrator read-only verification supplied for 2026-10-26: project https://ahntbtktjjmvfosgkmgn.supabase.co; latest live migrations M81 20261025171647 and M82 20261025220839, nothing later; no local or remote branch contains migration 83 or higher. 7a = M83, proposed local supabase/migrations/20261026000083_marketplace_phase9_lean_catalogue_identity.sql: **PROPOSED / NOT_CREATED / NOT_APPLIED**. 7b has one migration, number undecided. Owner 2026-10-26: private versioned marketplace_sec.phase9_catalogue_isbn_blocklist created empty, postgres operator writes only under separate authority, no client/service_role write grant; phase9_catalogue_isbn_v1 changes IMMUTABLE→STABLE to read it, affecting future identity checks only, never existing links/rows/snapshots (02b §§4.6/5/14). Provider validator ships facts-only in 7a; every nonnull p_completion returns valid=false. 7b replaces the same signature for accounting; phase9_catalogue_valid_companion_v1 moves to 7b. Source-write decision recorded (Owner 2026-10-26, decision 6 closed): no live/repo writer and zero source rows; 7a revokes INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN from PUBLIC/anon/authenticated/service_role, service_role keeps SELECT only, and the sole metadata sources platform write ALL policy becomes metadata sources platform read, SELECT-only for authenticated USING marketplace_sec.is_platform_operator(). Operator reads are unchanged; non-operator authenticated/anon see no rows. Postgres-owned shared core writes; operator SQL corrections require separate authority. Searched stays 0 in 7a. M82 GLM review closed: not obtained: free GLM hung three times; covered by Muse (no finding), two Haiku preflights (READY) and the browser re-check PASS.

Owner 2026-10-26 reviewer routing for 7a overrides SDD-0 §15's agent list only: code Codex gpt-6.1-sol xhigh; read-only reviews OpenCode Muse (opencode-go/muse-spark-1.3-contributor), free GLM (opencode/glm-5.3-flash-free, with timeout), DeepSeek (opencode/deepseek-v4.1-flash-free), Codex Luna (gpt-6-luna, read-only) and Codex Sol read-only; Haiku runs preflights/tests. SDD-0 §15 is unchanged.

Active work unit: post_scan_rework_slice7a_build. Exact next authorized action: 7a package 1 red-first tests (02b §12). The supplied 2026-10-26 read-only preflight and source-write decision are recorded; local M83 creation (authorized, after red proof and a fresh read-only preflight), green and read-only reviews follow; application, browser check and commit each need separate Owner approval. Database/storage mutation authority: none (read-only MCP only). This documentation follow-up used no network/database access, changed no SQL/code/tests/scripts and ran no tests; no database or storage mutation. Nothing staged, committed, pushed, deployed or applied; nothing pushed.

## 2026-10-26 - Slice 7 pass-2 design drafted; M83 proposed; documentation only

Phase 9 remains active. Slice 6 M81 is applied as live version 20261025171647 (2026-10-25 read-back PASS), with one Open Library ISBN browser proof on 2026-10-26: canonical_works 1->2, canonical_editions 1->2, linked inventory 0->1 (tracker 38). Slice 7 pass-2 is drafted in work-units/post-scan-rework/02b-slice7-lean-catalogue-writes-sdd.md; it is not approved for build. Owner authorized M82 creation and application (2026-10-26): 20261026000082_marketplace_phase9_edition_choice_survives_first_save.sql (trigger function marketplace_sec.phase9_edition_identity_change; a card's first review save no longer drops a coherent edition choice) is applied as live version 20261025220839 after Muse review (no finding) and two Haiku read-only preflights (READY); the GLM review run hung and was restarted, report pending. Read-back PASS: project ahntbtktjjmvfosgkmgn re-verified, one function, owner postgres, SECURITY DEFINER, search_path "", ACL postgres only (anon/authenticated/service_role no EXECUTE), prosrc md5 8bdf7924d9f95ced4533a9ed4e81394b length 5033 equals the local LF body, trigger definition unchanged. No data written. M82 browser re-check PASS (2026-10-26, session 78f427c3-794d-450a-b2de-452b7c4e203c): Add-a-book card titled 'Pride & Prejudice' with typed ISBN 9780141439518, Open Library edition 'Pride and Prejudice' selected, first review save (U6C01) and Add (U7AC01): owner_isbn13 kept, metadataChoice stayed edition_option, inventory 41c79cca-56c7-4fb7-8ebd-8bbc36da8fab linked to new edition 7edcb18f-b347-453e-a8cb-9212dee9c073 (psr-catalogue-isbn-v1); canonical_works 2->3, editions 2->3, linked inventory 1->2. Slice 7a M83: Owner authorized M83 creation and application (2026-10-27): 20261026000083_marketplace_phase9_lean_catalogue_identity.sql is applied as live version 20261026223715 through Supabase MCP apply_migration (project ahntbtktjjmvfosgkmgn re-verified; local SHA-256 6538d7c79b8e2352e70374b96c5f8db1a1152fe9bb9ab86ade94eadd14b00616). Read-back PASS: 18 functions, md5(prosrc) equal to the local LF bodies, owner postgres, search_path "", EXECUTE postgres only except phase9_add_candidate_to_inventory_v1 (authenticated); 5 new tables owner postgres with RLS on; book_metadata_sources has only "metadata sources platform read" and no write grant to anon/authenticated/service_role; open_library shared_source_note set; works 3, editions 3, sources 0, linked inventory 2, new tables empty. Browser check PASS 2026-10-27 (tracker 38: new edition, reuse, manual unlinked, scanned Open Library card linked; Google automatic card blocked by the pre-existing M69 ISBN-confirmation rule, not M83). Full docs closeout pending.

Active work unit: post_scan_rework_slice7_detailed_design. Exact next authorized action: Owner design approval of 02b (Owner answered OQ1-OQ8 on 2026-10-26, recorded in 02b section 14; read-only reviews by Muse, Codex Sol and Luna done and all 12 findings fixed by Codex Sol in two rounds and verified; free GLM timed out three times and gave no report). After approval: a new session for slice 7a (identity/model/Add/security) starts by recording the 7a/7b split map in SDD-0/SDD-2 and deciding migration numbers before any build brief; 7b starts only after 7a is applied and verified. Blocklist built with zero entries; the Owner adds entries later. Database/storage mutation authority: none in this documentation task. No product code, tests, SQL, config, validator script, network or database access; no tests run; no staging, commit, push, branch change or deployment. Existing unrelated changes are preserved. M81's current-table write revoke including MAINTAIN remains; no reset or historical backfill is authorized.

## 2026-10-26 - Slice 6 M81 browser proof PASS; edition-reset trigger finding; not committed

Phase 9 remains active. Slice 5 closed at 0de13ed on main (2026-10-24); M78-M80 migration-history repair is complete (tracker 38 section 33 A). The provider-neutral SDD amendment is committed locally as d09e8fd on claude/phase9-psr-slice6-catalogue-link, cherry-picked from facf1c7; it is not uncommitted at HEAD 0de13ed. Nothing was pushed.

The slice 6 pass-2 design is work-units/post-scan-rework/02a-slice6-catalogue-link-sdd.md, revision 3 plus section 6.1: approved by the Owner as the slice 6 design on 2026-10-25 (design approval only, not build authority). Codex wrote revision 1; at the Owner's instruction the orchestrator then applied the decisions below and trimmed it from 1,151 to about 980 lines, removing only the reset plan and superseded wording (pre-trim copy: .claude/psr-slice6/02a-baseline-pre-trim.md, untracked).

Owner decisions 2026-10-25: (1) No catalogue reset in slice 6. The revision-1 reset proposal was dropped; 02a section 9.1 is a short note (one pre-existing Hobbit work and edition of unknown provenance, referenced by three Phase 9 rows through NO ACTION foreign keys, treated as a no-update incumbent). Q15 stays "a reset needs its own design and approval". (2) Add succeeds when a saved catalogue target no longer exists (no link, or a link through admitted Open Library identity find/create): 02a section 3.1, AC6-20 to AC6-23. (3) The D37 blocklist is deferred to slice 7 (OQ2). (4) OQ1 (work-key rule), OQ3 (a saved ID links only while its row exists; a NULL-work incumbent gets no link), OQ4 (never update incumbents; stamps fetchedAt and psr-catalogue-isbn-v1) and OQ7 (unexpected database errors fail that Add) take the recommended defaults. (5) OQ6: M81 revokes INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER on canonical_works and canonical_editions from anon and authenticated, conditional on a writer audit. The audit (02a section 9.2: repository search plus read-only live pg_proc, trigger and policy queries) found no writer using any client role, so the stop-and-ask condition did not trigger; AC6-24 added. Numbering kept: OQ5 dropped, the former OQ8 is OQ7.

Review: OpenCode Argon (opencode-go/gemini-4-argon, read-only, run at the Owner's request) returned approve with fixes. Its seven findings were checked against the repository and applied by the orchestrator (revision 3): test-schema fidelity of the Phase 9 test baseline (phase6_baseline.sql has no UUID defaults, timestamps, SET NULL actions, named ISBN constraints, RLS or grants) with the helper supplying UUIDs itself; comparing existing display-cased work keys after normalization; a hydration source rule that decouples link IDs from field copy; the full-payload source for current_suggestion choices; the selected-mode fallback gate re-proving the saved-choice conditions; clearer step 3 and step 5 wording; and stale references. AC6-25 to AC6-28 were added. One Argon sub-claim, the selected-mode lookup query identity, is stated as a point to confirm at implementation, not as verified.

Consistency review: OpenCode Muse (slices 7 and 13, SDD-4) and free GLM (slices 8, 9, 10), both read-only, found no contradiction between slice 6 and the later slices (verdict: consistent with wording fixes). The one substantive gap, that SDD-2 slice 8 names neither the slice 6 helper (which holds the open_library allow-list, the Open Library cover shape and the adapter-key checks) nor which of 8a/8b replaces the allow-list, is recorded as 02a section 6.1; the other wording fixes for SDD-0, SDD-2 slice 7 and SDD-4 slice 13 are queued in 02a section 13 and not applied. Owner approval of the design: 2026-10-25, in chat, design only.

Owner authorized local M81 creation on 2026-10-25 (file creation only; applying it to Supabase was not authorized at that time - retained here as history). The Owner later separately approved application on 2026-10-25: "re-verify project ahntbtktjjmvfosgkmgn read-only, apply M81 in one transaction, then run the 02a section 11 read-back and record it." M81 applied; M81 status: APPLIED_LIVE (live version 20261025171647). Green-state runs (2026-10-25, M81 present, not applied): Codex (gpt-6.1-sol) wrote supabase/migrations/20261025000081_marketplace_phase9_catalogue_link_at_add.sql (517 lines) from a Muse-reviewed brief on the Owner's authorization to create the file locally. Base for the Add body: M69 (no replacement in M70-M80), LF-normalized body length 8972, md5 f38185ddd742cd0fbb249db1a903738e; six intended Add edits only. STATUS: PROPOSED, NOT APPLIED to Supabase; Supabase untouched; nothing staged, committed or pushed. First green-state run: GUARD 26/26 (incl. Unit6gFoundation), five existing regression suites 13/32/36/32/20 all pass, three architecture guards 17/17, but DB suite 31/78: 46 failures `column reference "a" is ambiguous` (helper PL/pgSQL record variable `a` clashed with the column alias `author(a)`; fixed by the orchestrator renaming the alias to `au` in 8 places, Owner-authorized) and 1 failure with P9_STATE_CONFLICT (AC6-6 OL, see below). After the rename: DB 76/78. The two remaining failures were wrong test assumptions, NOT M81 defects (verified: both fail identically on a scratch copy of the M69 stack without M81 by Haiku, and by an independent Muse code trace): (a) AC6-16 "expired" expired the candidate row's expires_at, but the existing Add never reads candidate.expires_at (only the session expiry fence, M54, is enforced); the test now expires the session and expects P9_STATE_CONFLICT; (b) AC6-6 OL: the identity change resets review_ready through the M69 trigger, so the test now performs a second unchanged save before Add. Both are test-only edits, Owner-authorized in chat. Green state at that point: DB 78/78; GUARD marketplacePhase9CatalogueLink 14/14; native-PostgreSQL runner (disposable local cluster 127.0.0.1:5450, torn down, no leftovers; never the shared Supabase project) exit 0: catalogue-link concurrency 25/25, picker native 20/20, Open Library native 12/12, U8B SQL acceptance pass. (Earlier native run with the alias bug: 4/25.) Reports: .claude/psr-slice6/out-green-run1.md, out-green-run3.md, out-native-green1.md, out-native-green2.md, out-m69-two-fails.md.

Fix rounds and final verification (2026-10-25, M81 still local and not applied). Fix 2 (Codex Sol Medium finding, accepted by Owner): a validated provider payload with very long, incompressible authors can exceed the btree index entry limit (about 2704 bytes, SQLSTATE 54000 program_limit_exceeded, message 'index row size N exceeds btree version 4 maximum 2704 for index ...'); the helper now treats that one predictable condition as a catalogue skip (rolls back helper writes, returns NULL/NULL, Add succeeds unlinked), gated on message text starting 'index row size' AND the index name being one of the four catalogue key indexes (canonical_works_title_normalized_primary_authors_key, canonical_editions_isbn_10_unique, canonical_editions_isbn_13_unique, idx_canonical_editions_title_authors); every other error still propagates. Test AC6-29 (maximum-size authors) added; a mutation check proved it is not vacuous (with the gate removed it fails with 'index row size 5256 exceeds btree version 4 maximum 2704 for index canonical_works_title_normalized_primary_authors_key'). Fix 3 (Owner decision; the read-only preflight found anon/authenticated still hold the PG17+ MAINTAIN privilege on both canonical tables, which permits LOCK TABLE ACCESS EXCLUSIVE, VACUUM, ANALYZE, REINDEX, CLUSTER): the canonical-table revoke is now REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.canonical_works and public.canonical_editions FROM anon,authenticated (SELECT kept; PUBLIC/postgres/service_role never named); PGlite 0.5.4 is PostgreSQL 18.3 and the native runner is PostgreSQL 18.4, so both support it. Final local verification (after fix2 and fix3): DB suite 79/79; GUARD 26/26 (14 slice-6); five existing regression suites 13/32/36/32/20; architecture guards 17/17; MaintainAcl 2/2; SensitiveTableAcl 2/2; native PostgreSQL runner (disposable local cluster 127.0.0.1:5450, torn down, no leftovers, never the shared Supabase project) exit 0: catalogue-link concurrency 25/25, edition picker 20/20, Open Library 12/12, U8B SQL acceptance pass.

Reviews, all read-only, no High finding. Muse (helper, Part A) reported two Lows, both refuted by the orchestrator: a surviving saved edition whose title/authors/ISBN disagree already returns NULL/NULL (only a vanished edition or work falls through to Open Library find/create), and row locks taken inside a rolled-back subtransaction are released, so the 'releases its locks' comment is correct. Free GLM (Add body diff vs M69 and ACL tail, B-glm2 report) confirmed exactly the six intended edits with no High/Medium and three Lows: no helper row-count assertion (defence in depth, not adopted), canonical-revocation default-privileges backstop note (recorded for slice 7), manual-mode Adds pay the helper's scoped reads (design-conformant). Codex Sol Part A reported two Mediums: the oversized-key failure (fixed as fix 2 above) and a legacy-key race where a rare interleaving skips a link but never makes a wrong link or fails an Add (recorded as a known limitation for slice 7); Sol Part B reported no new finding. Luna Part A reported no finding; Luna Part B reported no High, Medium or Low finding. Known limitations for slice 7: (1) legacy raw-case canonical works can lead to a duplicate work and, in a rare race, a skipped link - no data change; (2) the canonical revoke covers the current tables only, re-apply it if those tables are ever recreated (no ALTER DEFAULT PRIVILEGES backstop by design, 02a section 11 step 4); (3) helper result has no row-count assertion (not adopted); (4) manual-mode Adds pay the helper's scoped reads (design-conformant).

Read-only live preflight (2026-10-25, Supabase MCP, project ahntbtktjjmvfosgkmgn verified; SELECT/catalog/advisor reads only, no write). Live migrations 79 and 80 applied, nothing named 81; live Add function md5 f38185ddd742cd0fbb249db1a903738e length 8972 (matches the M69 base); helper absent; both canonical tables, constraints and indexes present with the expected names; one canonical work and one edition live. Findings: (R1) the single live work 'The Hobbit' has primary_authors in raw case (['J.R.R. Tolkien']), so a different Hobbit edition could create a duplicate work because the helper compares normalized keys - Owner accepted this as a known limitation for slice 7 (no data change now); (R2) MAINTAIN still granted to anon/authenticated - fixed in fix 3 above.

Application and read-back (2026-10-25, M81 applied). The Owner separately approved application ("re-verify project ahntbtktjjmvfosgkmgn read-only, apply M81 in one transaction, then run the 02a section 11 read-back and record it."); Owner-approved apply_migration `marketplace_phase9_catalogue_link_at_add` applied the local M81 file as written in one transaction; live version 20261025171647 (local filename 20261025000081_... maps to this live version; timestamp equality never assumed). Database mutations: M81 applied (DDL only: new private helper, Add replacement, canonical-table write revocation incl. MAINTAIN); no data written, no Add/helper executed, no Edge Function, worker or app deployment. Read-back PASS: helper marketplace_sec.phase9_catalogue_link_for_add_v1 and Add public.phase9_add_candidate_to_inventory_v1 are owner postgres, SECURITY DEFINER, VOLATILE, search_path "", prosrc md5 69bd9b40c54a119a61e2782f19c55afb / 9fe42381cf406d81018417dfc541217a matching the local LF bodies, EXECUTE as designed (helper postgres only; Add authenticated plus postgres), no PUBLIC ACL entries, exactly one function of each name; canonical tables anon+authenticated SELECT-only, policies/constraints/triggers unchanged; counts identical (canonical_works 1, canonical_editions 1, store_inventory 32, linked 0). Not yet done / not authorized: browser check including the many-edition ISBN case (needs separate authorization); commit/push (needs the Owner's instruction); the queued wording edits to SDD-0/SDD-2/SDD-4 (listed in 02a section 13); slice 7 items (legacy raw-case works, blocklist, race limitation); the optional schema performance audit. Nothing else is authorized.

SDD-0/SDD-2 wording required by these decisions (blocklist to slice 7, AC7-8 scope, slice 6 migration line, OQ3 clarification) is listed in 02a section 13 and not yet made. Phase 9 M81 is APPLIED_LIVE as live version 20261025171647 (M81 applied); the optional pending-card correction formerly called M81 is M-next, unassigned. No new columns, stats, provider-ID list, source rows or backfill of the 32 existing inventory rows. DOC-3 is unchanged.

Browser proof PASS (2026-10-26, Owner-authorized dev browser test on dev project ahntbtktjjmvfosgkmgn; M81 live version 20261025171647; M81 applied; the 2026-10-25 read-back is PASS and unchanged, no DDL since). New scan session f5c2a7e9-fe79-4c57-818c-7336ada3cbcf, shelf M81-BROWSER. "Add a book": title "Crime and Punishment (Penguin Classics)", author "Fiódor Dostoievski", ISBN 9780140449136 (title chosen to equal the edition title, see the trigger finding below). Open Library ISBN lookup returned accepted_metadata_match; the edition was NOT auto-selected; opening "Find or change edition" showed the saved ISBN result and the Owner pressed "Select edition"; the card showed the Open Library cover and "Penguin Classics · 2003 · 9780140449136". Price 250 (preset chip) and condition Good set, Add pressed once; the session closed automatically ("All detected books were added"). Counts before Add: canonical_works 1, canonical_editions 1, store_inventory 37, linked (canonical_edition_id not null) 0; after: 2, 2, 38, 1. New inventory row 4ee1f236-deca-469d-85e8-faf936744b4c: title "Crime and Punishment (Penguin Classics)", canonical_work_id f511bca1-3372-4293-a92e-55b2eeb2bc19, canonical_edition_id 9557e93f-1397-4a00-9b33-9099ebde7516, isbn_13 9780140449136, publication_status private, visibility_status draft, metadata_snapshot_version edition-selection-v1:170121df-2a3e-4756-b886-c1fdfbc423ab:metadata-r3. New canonical_editions row 9557e93f-1397-4a00-9b33-9099ebde7516: isbn_10 0140449132, isbn_13 9780140449136, cover_url https://covers.openlibrary.org/b/id/9411862-M.jpg, metadata_verified_at set, metadata_selection_version 'psr-catalogue-isbn-v1'; its work title_normalized "crime and punishment (penguin classics)", primary_authors ["fiódor dostoievski"]. Inventory ids equal the canonical ids. The original Hobbit work/edition rows are unchanged (verified false, selection version null). Not run in the browser: reuse (same ISBN twice) and the manual-card case (covered by the 79 DB tests and 25 native tests); the many-edition ISBN case not run.

FINDING 1 (pre-existing, slice-5 picker/M78 area, not M81): the edition choice is silently dropped for ISBN-searched cards. Trigger marketplace_sec.phase9_edition_identity_change (on image_extraction_candidates updates) exempts "the controlled Select edition result" only when an unchanged-row comparison including NEW.state and NEW.review_disposition passes; a card's first review save always changes them (needs_review to ready, null to reviewed), so the exemption fails, and when the card has a typed owner_isbn13 and the review title/authors differ from the scanned card's, the trigger sets owner_isbn13 to NULL, clears the edition state (options, selection) and resets metadataChoice to manual. Evidence: phase9_idempotency_keys receipts for cards 1, 2 and 7 of scan session cde4c240-7c63-41de-a16a-511d5bed1ea1 show EP_ISBN_V1 to EP_LOOKUP_V1 to EP_SELECT_V1 then two U6C01 review saves both returning metadataChoice manual, then U7AC01; owner_isbn13 is NULL on those cards afterwards (it was 9780140449136 on card 7 before Add); card 5 (no typed ISBN) kept its edition option. The app's slice-1 re-save then re-saves the already-manual review, so Add succeeds but the edition (and the M81 link) is lost. The trigger source and receipts were read; the mechanism was NOT reproduced in an isolated test. Workaround used for the proof: a card whose title equals the edition title (the trigger's title-differs condition is then false). The earlier failed browser Adds from that session (Adds of ISBN-searched cards 1, 2 and 7 came out manual and unlinked; card 5, a Google suggestion with no typed ISBN, kept its edition but is unlinked by design) are explained by this finding. Leftover inventory ids from it: e529ab3f-36cf-483f-af94-8af9f9e52e47 (card 5), 7644c8af-6bbe-4da5-b74b-e269c2a22908 (card 1), 7fc05506-ef5c-411f-b963-a6053c090d9c (card 3, Haiku mistake), c9a7628b-4080-454c-9b00-8be84b61e409 (card 2), 4085cd91-954b-4087-8578-63ed6f502a63 (card 7); all private drafts. Session cde4c240-7c63-41de-a16a-511d5bed1ea1 was closed by the Orchestrator via the app (9 uncommitted books kept as read-only records; Book 10 removed from scan; earlier closed session 60a99c91-3949-43fe-8d2b-c085de88489d). Fix proposal (NOT created, NOT authorized; creation and application each need the Owner's separate approval): new migration M82 replacing the trigger function so the exemption compares only observed title/authors/language, ISBN clue, publisher clue and owner_isbn13, not state/review_disposition; plus DB tests for first-save-after-ISBN-select.

FINDING 2 (expected state of slices 1-6, not M81 defects): covers and edition lists. Automatic scan lookup uses Google Books only (Open Library is not yet part of the automatic match: slice 8; saved first-lookup results for the sheet: slice 9; neither built). Of 15 scanned books Google matched 3 (cards 5, 12, 13); only card 5's match had a cover; the other 12 were no_match (7), ambiguous (4), material_conflict (1), so those cards show the "No cover" placeholder (SDD-0 D22/D29). The edition sheet shows no alternatives until the Owner presses "Search Books" or searches by ISBN (Picker section 13.2: only explicit Search Books acquires alternatives); card 6's 7 saved results were all ineligible (identity_conflict_selection_disabled, Select edition disabled). Covers do display once an edition is chosen (Open Library cover 9411862 shown in the sheet and on the card). Product decisions on pulling slices 8/9 forward are the Owner's; recorded as findings only.

Database mutations this session: no DDL, no migration, no manual SQL writes. Dev test data was written through the app by the Owner-authorized browser test (candidates, inventory rows, edition-state rows, idempotency receipts, two scan sessions, one canonical work and one canonical edition created by the M81 helper inside the Add function). Nothing staged, committed, pushed or deployed.

Active work unit: post-scan rework slice 6 (catalogue link at Add), M81 applied live and read back (uncommitted). Exact next authorized action: Owner decides (a) whether to plan/create the trigger-fix migration (M82; creation and application each need separate approval), (b) whether to pull the covers/edition-list behaviour (slices 8/9) forward, (c) commit/push (needs the Owner's instruction), (d) the queued SDD-0/2/4 wording edits. Nothing else is authorized. Previous actions (done): Codex wrote the M81 file locally with the green-state test-only fixes above from Owner-authorized briefs (Muse reviewed the briefs read-only); the Owner then separately approved application, and M81 was applied in one transaction and read back (2026-10-25); the Owner-authorized browser proof PASS ran with the trigger finding recorded (2026-10-26). Not done: trigger-fix migration M82 (creation and application each need separate approval), commit/push, SDD-0/2/4 edits, slice 7 items (legacy raw-case works, blocklist, race limitation), slices 8/9 covers/edition-list work, optional schema performance audit.

Verification and mutations: Phase 9 continuity validator and git diff --check results for this documentation change are reported at close; suite evidence is in tracker 38's application paragraph below. Database mutations: M81 applied by Owner-approved apply_migration on 2026-10-25 (DDL only: new private helper, Add replacement, canonical-table write revocation incl. MAINTAIN); no data written by the apply step (the 2026-10-26 Owner-authorized browser test wrote dev data through the app as recorded above; no manual SQL). Database access in this documentation step: none (record only; no database calls); no Edge Function, worker or app deployment was needed or done. Nothing staged, committed or pushed.

## 2026-10-23 - Slices 5a + 5b merged and deployed; M79 and M80 fix stuck "pending" cards (live); follow-up branch awaits commit approval

Phase 9 remains active. PR #28 (slices 5a + 5b) was merged to `main` as `e615893` on the Owner's approval (merged by the Owner in the GitHub UI; the auto-mode classifier blocked `gh pr merge`). The Render metadata worker was deployed from `main` (deploy `dep-dbdmmh6q1p3s739505eg`, commit `e615893`, Live) by a Haiku subagent in the browser pane on the Owner's explicit request, and the Edge function `phase9-owner-ingestion` was deployed with `supabase functions deploy ... --use-api` (version 18, ACTIVE, verify_jwt true, OPTIONS 200, unauthenticated POST 401, `set_candidate_isbn` present). The combined browser check found a defect: after a finished ISBN search the card metadata state read `pending` (the outcome `accepted_metadata_match` was not mapped), so the card said "Finding edition..." and the edition sheet stayed locked; cards from "Add a book" never get an automatic metadata job, so they read `pending` forever and the sheet was locked. Fixes: **M79** (finished ISBN match with no chosen edition reads `ambiguous`) and **M80** (replaces M79's body: the match must be the edition state's current source lookup and the newest lookup, with no open/in-progress/retry job; a manually added card with no lookup and no running job reads `ambiguous`). Both were applied to `ahntbtktjjmvfosgkmgn` on the Owner's explicit instruction ("you try applying it", then "review it ... and apply it") with `execute_sql` (no migration-history row; same as M78) after a read-only preflight, and read back (SECURITY DEFINER, STABLE, empty search_path, ACL `postgres=X/postgres` unchanged, new body present). Reviews: M79 by Argon and Codex sol (approve with fixes, both applied in M80); M80 by Argon and free GLM (approve with fixes: job-guard and newest-lookup fixes applied; GLM's status-list point checked against the live CHECK constraint). Tests: `supabase/tests/phase9/phase9OwnerIsbnEditionLookup.integration.test.mjs` 36/36. Live browser results: The Hobbit (typed ISBN in Add a book, then Select edition) reached "Mariner Books - 1966 - 9780547928227"; The Origin of Species waits for an edition choice; Haiku plain add opened a usable sheet and a typed-ISBN search returned The Origin Of Species (Signet Classics) with Select edition enabled. A test-only race in `ownerEditionPickerIsbnSheet.test.tsx` that failed CI was fixed before the merge (the three `bookDetailsPalette` date-format failures also fail on `main` and are not part of this work).

Owner authorized M79 and M80 creation and application on 2026-10-23: `20261023000079_marketplace_phase9_isbn_match_metadata_state.sql` and `20261023000080_marketplace_phase9_manual_card_and_current_match_state.sql`, both APPLIED_VERIFIED. Database mutation: M79 and M80 (function body only; no table, column, grant or data change). Residual: the review list renders about 6 cards at first and loads the rest on scroll (not a defect); console CORS/403/500/503 noise and the free-tier worker wake delay (about 40-60 s per search) are unexplained or by design; lost-response wording and request timeouts on the Add screen remain Owner decisions; a scanned card whose automatic job died before any lookup stays `pending`; commit safety of `ambiguous` rests on the M69 saved-choice gate (read statically, not run).

Active work unit: `post_scan_rework_slice5b_add_book_isbn` (closing). Whole-slice review (Muse, free GLM, Codex Luna; 12 reports, tracker 38 §33) found no tenant, privilege or injection defect; ten confirmed fixes (F1-F10: card label, 5b retry and closed-scan messages, ISBN echo check, ISBN result messages, input length, adapter null-ISBN guard, pending-receipt cache) were implemented by Codex sol with red-first tests (Jest 1,058 passed / 0 failed, tsc only the 8 known `books/export` errors). Open Owner decisions: M81 for scanned cards whose automatic job died before any lookup; many-edition ISBN where Open Library omits the edition from the embedded list; migration-history repair for M78-M80. Slice 5 closed: committed as `0de13ed` and pushed to `main` on the Owner's instruction (2026-10-24); the worker was not redeployed (the F8 adapter guard is in `main` only). Exact next authorized action: start the next slice, post-scan rework slice 6 (catalogue link fix, SDD-0 slice table), by reading its SDD and stating its plan; no implementation, migration or deploy before the Owner approves it. Carried into that slice by the Owner: run the live many-edition ISBN check (tracker 38 section 33, follow-up B) as part of its browser check; the migration-history repair (follow-up A) was done on 2026-10-24 (three `schema_migrations` rows inserted).

## 2026-10-23 - Whole-feature review of slices 5a + 5b; four code fixes applied; deploy path needs a push to main

Phase 9 remains active. A whole-feature review of 5a + 5b ran in four pieces (database, Edge and worker, app, cross-component/deploy) with Codex gpt-6.1-sol, Codex gpt-6-luna (first attempt only, cut off by the Codex usage limit), Muse Spark 1.3 and GLM 5.3 Flash free. Database and Edge/worker pieces: no defects. App and cross-component pieces: four Mediums and one High, all checked in code, plus docs gaps. Fixed locally (uncommitted): (1) the 5a edition sheet no longer waits on cache refetches before sending the search or surfacing a refusal (an offline paused refetch locked the sheet); (2) the one search after an ISBN set is built only from a re-read that still carries the same ISBN and non-regressed versions, in 5a and 5b (a second device could redirect the search); (3) 5b says "The ISBN search didn't start" instead of "wasn't saved" when the re-read fails after a confirmed save; (4) 5b refreshes the lists after a refused save. Items 1 and 2 were written by the orchestrator (Codex hit its limit; the Owner allowed it), items 3 and 4 by Muse, all red-first. Local verification: Jest `src/features/imageInventory` 982 passed, 4 skipped (71 of 72 suites, one suite skipped); `tsc --noEmit` shows only the 8 known `src/features/books/export` errors; `git diff --check` clean. The fix delta was re-reviewed by Muse (approve with fixes: one Medium rejected after checking, the rest Low or checks) and free GLM (approve); Codex sol could not run (usage limit until 9:07 PM) and was replaced by Muse on the Owner's word. Open Owner decisions: lost-response wording ("wasn't saved" when the reply was lost), request timeouts on the Add screen. New finding for the plan: the Render worker deploys the head of `main` only (auto-deploy off, no commit pin), and `origin/main` contains neither 5a nor 5b, so the worker deploy requires an explicitly authorized push and merge first. SDD 01a status, rollback-after-release and the deploy checklist were corrected (§10). Database change: none. Storage, provider and deploy change: none. Nothing committed, staged, pushed or deployed.

Active work unit: `post_scan_rework_slice5b_add_book_isbn`. Exact next authorized action: Owner decisions on (a) an independent re-review of the fix delta, (b) the lost-response wording and timeouts, (c) committing 5a+5b fixes (src and docs only) and (d) the push and merge to `main` that the worker deploy needs; then deploy the worker, verify its commit, deploy the Edge function, then run the combined 5a+5b in-app check (AC5a-1, AC5a-16c, AC5b-1, AC5b-4, AC5b-6).

## 2026-10-23 - Slice 5b built, reviewed, verified locally; partial browser check passed

Phase 9 remains active. Slice 5b (optional ISBN in "Add a book", SDD 01a §15) is implemented on `claude/phase9-psr-slice5b-add-isbn` (from the 5a tip `0f4fbd1`) by Codex gpt-6.1-sol, after a Muse review of the brief (13 findings applied) and one code-review round by Muse, GLM, Codex gpt-6-luna and Codex gpt-6.1-sol (ten confirmed findings fixed in one red-first round). Local verification: Jest `src/features/imageInventory` 971 passed / 4 skipped; Haiku's independent run 2,287 passed with one load timeout in an untouched file that passes alone; `tsc` shows only the 8 known `books/export` errors; the database suite shows only the 3 known failures once the worker build exists (five files had failed only for want of `.phase9-dist` in the new worktree; 117/117 after the build). Decisions: no Retry after a version-conflict response; a `P9_STATE_CONFLICT` on the ISBN save says "scan is closed" only after a session refetch confirms it; the Owner stays on Add a book after an ISBN add. The partial in-app check passed (Haiku, Owner signed in): the ISBN box is hidden on a closed scan and shown on an active one, a bad check digit is refused with nothing sent, the plain add navigates as before, and the ISBN add stays on the screen with the refusal message while the Edge action is undeployed (the deployed Edge answers 400). The ISBN save and search against the real server have run only against mocks until the worker and Edge are deployed. No migration, Edge, worker, database, Storage or deploy change; nothing staged, committed or pushed. Evidence: [tracker 38 §30](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#30-slice-5b-built-reviewed-and-verified-locally-partial-browser-check-passed-2026-10-23).

Active work unit: `post_scan_rework_slice5b_add_book_isbn`. Exact next authorized action: on the Owner's approval, commit 5b (src and docs only); after that deploy the metadata worker, then the owner-ingestion Edge function, then run the combined 5a+5b in-app check (AC5a-1, AC5a-16c, AC5b-1, AC5b-4, AC5b-6).

## 2026-10-23 - Slice 5b next; deploys and the in-app check move after 5b (docs only)

Phase 9 remains active. Owner decision (2026-10-23): build slice 5b (optional ISBN in "Add a book", SDD 01a §15) before deploying anything; after 5b, deploy the metadata worker, then the owner-ingestion Edge function, then run one in-app check for 5a and 5b together. No build with an ISBN box reaches real users before that check. The 5b branch `claude/phase9-psr-slice5b-add-isbn` is cut from the 5a tip `0f4fbd1` in its own worktree. The Owner's answers to the 5b session summary are a dated note in SDD 01a §15 (D5-4 confirmed; one pending record for all four steps; the search request built from re-read choices as in 5a; the Owner stays on Add a book after an ISBN add; leave-dialog wording; retry labels). Correction: the M78 fix and docs were committed on the 5a branch as `0f4fbd1`; nothing is pushed. `CODEBASE_MAP` needs no change for 5b. No code, database, Storage or deploy change. Evidence: [tracker 38 §29](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#29-slice-5b-start-branch-owner-decisions-and-docs-reconciliation-2026-10-23).

Active work unit: `post_scan_rework_slice5b_add_book_isbn`. Exact next authorized action: build slice 5b next (branch from 5a tip `0f4fbd1`); after 5b, deploy the metadata worker then the owner-ingestion Edge function, then run the in-app check for 5a and 5b together (AC5a-1, AC5a-16c, 5b checks).

## 2026-10-23 - M78 applied to the live project and verified (slice 5a)

Phase 9 remains active. A dedicated pre-apply review of M78 (Haiku and Muse; the Owner cancelled the GLM and Luna runs) found one confirmed Medium defect: the new command `public.phase9_set_candidate_isbn_v1` kept EXECUTE for `service_role`, because the live default function ACL grants it and M78 revoked only from PUBLIC and anon. Codex fixed it red-first (revoke from all four roles, then grant `authenticated`, as M70 does) and added three tests (977 prefix, `editions` in ISBN mode, a two-press race). Re-verification: PGlite M78 suite 29/29, DB suite 844 with the 3 known failures, real-Postgres runner 20/20. Muse's claim that two presses could both pass the version check was rejected: the candidate row lock comes first.

Haiku's read-only preflight was clean apart from one flag, the newer live library migration `20261022160000_library_reading_history`. It is on origin/main and touches only library tables, so it is not a conflict. The Supabase MCP `apply_migration` call was declined twice by the server with no prompt (it asks for confirmation on destructive statements and this client cannot show it), so the Owner ran the file in the Supabase SQL editor ("Success. No rows returned"). There is therefore no `schema_migrations` row for M78. Read-only readback matched SDD §5.8, and all ten function bodies hash-match the file. Evidence: [tracker 38 §28](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#28-m78-dedicated-review-fix-and-live-application-2026-10-23).

Owner authorized local M78 creation on 2026-10-22 and its application on 2026-10-23; M78 status: APPLIED_VERIFIED (SQL editor, no migration-history row). Database change: M78 only; no data change (every row keeps `owner_isbn13` NULL). No Storage, provider or deploy change. The M78 fix and these docs were committed on the 5a branch afterwards as `0f4fbd1`; nothing pushed.

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: on the Owner's approval, commit the M78 fix and docs on the 5a branch, then deploy the metadata worker and then the owner-ingestion Edge function, then run the in-app check (AC5a-1, AC5a-16c); then sync with origin/main and open the 5a PR.

## 2026-10-23 - Post-scan slice 5a (typed ISBN) built and reviewed; M78 file created, not applied

Phase 9 remains active. Slice 5a is implemented on branch `claude/phase9-psr-slice5a-typed-isbn` per the approved SDD 01a §1–§14. The Owner can type an ISBN in the edition sheet, and Search Books then looks up that exact edition. The slice includes migration file M78 (`20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql`), which is created and tested locally but **not applied**.

It went through two code-review rounds: GLM, MiniMax, Muse, DeepSeek, Haiku and Codex gpt-6-luna. Eleven confirmed fixes were applied. The Owner approved one SDD §8 clarification: the app rejects ISBN-13 values outside 978/979.

Local verification: real-Postgres lock tests 19/19 and the PGlite M78 suite. Jest and the independent Haiku run are in [tracker 38 §27](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#27-slice-5a-built-reviewed-in-two-rounds-and-verified-locally-2026-10-23). The 3 known phase9MetadataFoundation failures predate this slice.

Owner authorized local M78 creation on 2026-10-22; M78 status: CREATED_LOCAL / NOT_APPLIED. No database, Storage, provider or deploy change. Committed locally on the 5a branch; not pushed.

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: on the Owner's approval, preflight and apply M78 to `ahntbtktjjmvfosgkmgn`, deploy the metadata worker and then the owner-ingestion Edge function, then run the in-app check (AC5a-1, AC5a-16c); then sync with origin/main and open the 5a PR.

## 2026-10-22 - Post-scan slice 5 (typed ISBN) SDD approved; reorder recorded (docs only)

Phase 9 remains active. The Owner approved the slice 5 SDD (`work-units/post-scan-rework/01a-slice5-typed-isbn-sdd.md`; 5a edition-sheet ISBN with migration M78, 5b optional ISBN in "Add a book" with no migration) and decisions D5-1 to D5-6 as recommended. D5-1 pulls slice 5 forward: it is built after 4b and before Stage 2 (slices 11 and 13); SDD-0 §7.1/§7.2a and SDD-1 §7 now point to it. Two reviews (Sonnet; OpenCode DeepSeek v4.1 Flash) found 21 issues plus one author finding, all verified and applied; OpenCode Argon was unavailable at the provider. The design also fixes a found defect: the worker refuses hand-added cards, so Search Books never worked for them. No code, no migration file, no database or Storage write; read-only SQL and public Open Library GETs only. Evidence: [tracker 38 §26](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#26-slice-5-sdd-written-reviewed-and-approved-reorder-recorded-2026-10-22).

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: review the 5a Codex brief; then, on the Owner's approval to create the M78 migration file, cut the 5a branch from origin/main and send the brief (SDD-0 §15 risky-slice process).

## 2026-10-22 - Slice 4a pre-merge review: one fix and five tests added on the 4b branch

Phase 9 remains active. The final slice 4a code (PR #27, 8c1b004) had no completed pre-merge review, so before merging it was reviewed here: OpenCode DeepSeek v4.1 Flash on product code and Muse Spark 1.3 on tests (MiniMax ended without a report). DeepSeek found one medium defect: in "Add a book" (`MissedBookScreen.tsx`), the unclear, success and conflict outcomes awaited a cache refresh before being shown; on web, TanStack Query pauses refetches while offline, so the form could stay busy with no message and a leave dialog offering only Stay. Fixed on the 4b branch (outcome published first, refresh best-effort), red-first: four tests failed before the fix and pass after. Muse's five test gaps (offline Retry, unclear again after Retry, account switch, exact Add labels, more removed names in the architecture scan) were added, and one dead re-export removed. Verification and the second review of the fix: [tracker 38 §25](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#25-slice-4a-pre-merge-review-and-fix-2026-10-22). 4a, this fix and 4b go to main together, which closes PR #27. No database, Storage, migration or deploy change.

Active work unit: post_scan_rework_slice4b_script_languages. Exact next authorized action: commit 4a's fix, the 4b code, tests and docs on this branch (never `.claude/` or `.env.local`), rebase onto origin/main, re-run a key suite, and push to main (Owner, 2026-10-21: review here, then push to main); then start slice 5 from the kickstart prompt.

## 2026-10-21 - Post-scan slice 4b reviewed and browser-checked; type check clean (uncommitted)

Phase 9 remains active. The uncommitted slice 4b diff on `claude/phase9-psr-slice4b-sdd-ffa027` (base 39b993a) passed the SDD-0 §15 medium review pass with no code correction. OpenCode Go was unavailable (subscription required), so on the Owner's choice the free OpenCode DeepSeek v4.1 Flash reviewed it, and on the Owner's request GPT-6 Luna (via Codex) and Haiku 5.5 also reviewed it. DeepSeek and Luna found no defect. Haiku's one medium finding (the server's `[:alpha:]` might count digits, so the app mirror could choose a script the server refuses) was disproved by a read-only live check: the project runs `en_US.UTF-8`, where digits of every script and some Devanagari signs are not `[:alpha:]`, so the app mirror is the stricter rule. Free MiniMax produced no report. Tests: PGlite script parity 25/25; `git diff --check` clean; `npx tsc --noEmit` exit 0 with zero errors once the worktree had its own `npm ci` install (the 10 earlier errors were packages missing from the shared install, so the type-check gate is closed); a Jest run under heavy machine load had 7 timeouts in five suites, and `batchReviewCard.test.tsx` then passed 58/58 alone (Codex's own full run: 831 passed, 0 failed). Browser check (Haiku, scan 8eb9b18a, Owner signed in): the card language chooser offers and finds Kannada, Telugu and Malayalam; four manual cards were added through the app, and a read-only readback shows scripts `Deva` (गोदान, hi), `Knda` (ಮಲೆಗಳಲ್ಲಿ ಮದುಮಗಳು, kn), null (mixed `ಕನ್ನಡ Book`, en; still added) and `Latn` (English). The chosen-edition and leave-guard steps could not be run in the browser (no edition list without pressing Search Books; the web scan page has no back control) and rest on their unit tests. The only database writes were those four normal app Adds of dev cards; the orchestrator ran read-only SQL only. Also found: the Unit 5C SDD §2 line "no Unit 5C generation, activation, or search-projection runtime exists" is stale (Gemini romanization, proposal persistence and active-variant search exist; activation is gated); recorded for the Unit 5C follow-up, not changed here. Evidence: [tracker 38 §24](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#24-slice-4b-review-browser-check-and-type-check-2026-10-21).

Active work unit: post_scan_rework_slice4b_script_languages. Exact next authorized action: on the Owner's go, commit the 4b code, tests and docs on this branch (never `.claude/` or `.env.local`), push the branch and open the 4b PR after the slice-4a PR.

## 2026-10-21 - Post-scan slice 4b implemented locally; type-check gate open

Phase 9 / Unit 6G remains active. The Owner's 2026-10-21 coding brief authorized the approved small 4b scope on `claude/phase9-psr-slice4b-sdd-ffa027` at `39b993a`: manual script recomputation after the existing metadata-choice decision, Kannada/Telugu/Malayalam in the shared language list, and deletion of the unused variant client (SDD-1 §§2/6, AC4-7/10/11). No stale-wording handling or production Add sequencing changed. The implementation remains uncommitted.

Verification: initial red Jest 34 failed / 164 passed; final feature assertions 67 suites passed / 1 skipped, 831 tests passed / 4 skipped / 0 failed; the serial run emitted a non-exit warning, recorded with cleanup diagnostics in the evidence. Current-migration PGlite parity passes 25/25. `npx tsc --noEmit` fails with 10 diagnostics in untouched Library/Clubs/e2e paths (six missing packages and two consequent implicit-any errors); this is an open type-check gate, not a clean build claim. Detailed test names, red reasons, raw diagnostics and file scope: [tracker 38 section 23](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#23-slice-4b-local-implementation-and-verification-2026-10-21).

Active work unit: `post_scan_rework_slice4b_script_languages`. Exact next authorized action: the orchestrating session reviews the uncommitted 4b diff under SDD-0 §15's medium review pass. TypeScript must be rerun after the dependency installation is repaired. No Supabase MCP/CLI, database, Storage, migration, provider, deployment, stage, commit, push or branch change occurred; none is authorized by this handoff.

## 2026-10-21 - Post-scan rework slice 4b SDD: script recompute and three languages; stale search wording deferred to Unit 5C (docs only)

Phase 9 remains active. On branch `claude/phase9-psr-slice4b-sdd-ffa027`, now based on slice 4a's local tip 8c1b004, the slice 4b SDD was finalized after a read-only Supabase MCP check (project ahntbtktjjmvfosgkmgn). The check showed a card save never makes a search-variant proposal stale (M29 trigger filter), no `stale` proposal exists live, and Unit 5C search variants are built but switched off. The Owner reduced 4b to S / med (2026-10-21): a script recompute that sets a script only when both the app rule and a mirror of the server rule accept it (null as today otherwise; a chosen edition keeps its script), Kannada, Telugu and Malayalam in the language list, and removal of the unused variant client. Clearing stale search wording is deferred until before any Unit 5C language is switched on (SDD-1 §6, SDD-0 §11, 05c §13). Reviews: Opus and Argon on the earlier large design, Sonnet on the small one; all verified findings applied; Argon skipped for the small one on the Owner's instruction. No code, no migration, no database or Storage write. Evidence: [tracker 38 §22](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#22-slice-4b-sdd-and-read-only-supabase-check-2026-10-21).

Active work unit: post_scan_rework_slice4b_script_languages. Exact next authorized action: on the Owner's go, commit these docs on this branch; recheck the brief's line numbers on this branch, then send the 4b Codex brief (`.claude/psr-slice4b/codex-brief-4b.md`, red-first) with the SDD-0 §15 medium review pass. The 4b PR follows the slice-4a PR.

## 2026-10-21 - Post-scan rework slice 4a built: remove the full correction screen and finish "Add a book" (app only)

Phase 9 remains active. On branch `claude/phase9-psr-slice4a-remove-full-correction`, cut from origin/main 1268403 (slices 1–3 merged, PRs #24–#26), slice 4a (SDD-1 §6, parts tagged 4a) removed the full-correction routes and their screens/components, the Mark false and replace-variant clients and schemas, the legacy Add variant, the full-review draft model and the dead candidates query key. "Add a book" (renamed from "Add missed book") enforces the 15-book rule on `counts.detected >= 15`, defaults the language from the session hint and has a leave guard; a card's hint now says only "This book can't be changed now." The diff is 81 files (26 deleted, 55 modified) plus one new `LanguageChooserPanel.tsx`, +1208 / −5575 lines. Browser check (2026-10-21, web, real backend, Owner signed in, new 11-book scan): "Add a book", the leave guard and the removed routes passed, and the one approved manual book was added (Detected 11 → 12); it found one 4a bug, "Back to review" stacking a second session screen, fixed red-first with `router.dismissTo` and re-checked in the browser. Final verification after the fix (quiet machine): `src/features/imageInventory` 67 suites passed / 1 skipped, 777 passed / 4 skipped, 0 failed; `app/(store-owner)` routes 9/9; tsc clean. Two open observations are recorded, not fixed. Nothing staged, committed, pushed or deployed. Evidence: [tracker 38 §21](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#21-slice-4a-built-remove-the-full-correction-screen-and-finish-add-a-book-2026-10-21).

Active work unit: post_scan_rework_slice4a_remove_full_correction. Exact next authorized action: on the Owner's go: commit (code, tests, docs; not `.claude/` or `.env.local`), sync the branch with origin/main 60a6b6c, Haiku re-runs the final tests, push and open the slice-4a PR. Then slice 4b code. Slice 4b's SDD and its read-only Supabase check were done in a separate session (branch `claude/phase9-psr-slice4b-sdd-ffa027`, uncommitted; recorded there in tracker 38 §22) and wait for the Owner's approval and decisions 4b-1 to 4b-5. No migration.

## 2026-10-20 - Post-scan rework slice 3 built: remove the after-Add buttons and the Inventory tab's list (app only)

Phase 9 remains active. On branch `claude/phase9-psr-slice3-inventory-tab` from 68a6cfc (slice 2's tip, PR #25), slice 3 (SDD-1 §5, AC3-1 to AC3-4) removed "View in Store View" after Add and the Inventory tab's list; the tab now shows the scan card and a link "Added books are in Store View". The old list screen, its hook and the unused read-service parts were deleted. DeepSeek coded it (Codex was at its limit); Codex reviewed it before merge and fixed two findings. Verification: tsc clean; 996 tests passed (6 load timeouts passed alone); the browser check passed. Evidence: [tracker 38 §20](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#20-slice-3-built-remove-the-after-add-buttons-and-the-inventory-tabs-list-2026-10-20).

Active work unit: post_scan_rework_slice3_inventory_tab. Exact next authorized action: the Owner merges PR #25, then the slice-3 PR; then slice 4 (SDD-1 §6) with Codex and the full process. No migration.

## 2026-10-20 - Post-scan rework slice 2 built: declutter the card and the edition sheet (app only)

Phase 9 remains active. On branch `claude/phase9-psr-slice2-declutter` from 1f98804 (slice 1's tip), slice 2 (SDD-1 §4, AC2-1 to AC2-10) was built red-first and reviewed by the two-round loop. The card now has one "Find or change edition" button, an edition line under the title, no metadata badges, and one `cardAddRequirementIssues` rule behind the badge, Add, Add all and the header count (price missing, ₹0, condition, quantity 1-10,000, author; the label stays "Needs attention"). AC2-10 makes `metadataChoice` manual whenever the card's title, authors, language or script differs from the chosen edition's snapshot. The edition sheet lost detected details, "Use detected details" and "Edit manually", and EditionIdentityFix was deleted; Search Books saves the card's edits first, then searches. The header explanation, footnote and chip are gone; `useUnsavedEditsLeaveGuard` shows OwnerConfirmationDialog on every platform. Nothing committed or pushed yet; the PR #24 (slice 1) merge is with the Owner. Evidence: [tracker 38 §19](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#19-slice-2-built-declutter-the-card-and-the-edition-sheet-card-requirements-2026-10-20).

Verification: GREEN 232/232 after round 1 (folder 845 passed / 4 skipped) and 150/150 after round 2 (folder 849 passed / 4 skipped), tsc clean each time. Haiku re-ran the tests (75 suites passed / 1 skipped, 849 passed / 4 skipped, 0 failed; one load-dependent 5 s timeout in `ownerEditionPickerMounted` that passed twice on re-run) and the approved 6-step browser check passed in full. The read-only server check showed Book 3 committed with metadataChoice manual and price 2500, and Book 5 unchanged. Pre-merge review: the orchestrator's full read and an independent DeepSeek full-slice review found three more issues (a false leave warning after Add all/Remove; the full-review screen blocking Back with no dialog on its loading/error screens; a wrong Retry target), all fixed red-first by Codex; final run tsc clean, folder 853 passed / 4 skipped, 0 failed.

Active work unit: post_scan_rework_slice2_declutter. Exact next authorized action: the Owner reviews slice 2; on the Owner's request, commit (code, tests and docs; not `.claude/` or `.env.local`), push and open the slice-2 PR. Then slice 3 ("Remove the after-Add buttons and the Inventory tab's duplicate list"). The work unit stays until the slice-2 PR merges.

## 2026-10-19 - Post-scan rework slice 1 built: Add re-saves a reset review (app only)

Phase 9 remains active. On the Owner's go-ahead, slice 1 (SDD-1 §3) was built red-first on branch `claude/phase9-psr-slice1-add-resave` from main 6a41033, with Codex `gpt-6.1-sol` (xhigh) writing the code and the orchestrating session reviewing every diff line. Add now re-saves the server's review when the server has reset readiness, whether the reset happened before Add or was caused by Add's own save. It does this at most once per command, freezes each hidden request in full for replay, and stops with "This book changed. Check it and press Add again." when the server's review differs from what the Owner saw in anything but the edition choice. The fall-through label "Review book" is now "Needs details". AC1-3 is corrected in SDD-1: a blocked card keeps "Needs attention" with its blocker text, because §3 changes no other label. No migration; server validation is unchanged. Evidence: [tracker 38 §17](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#17-slice-1-built-add-re-saves-a-reset-review-2026-10-19).

Verification: RED 13 failed / 105 passed in the five named suites, all on behaviour. GREEN, re-run independently: tsc clean; named suites 118/118; `src/features/imageInventory` 799 passed / 4 skipped / 0 failed. In-app check on the dev build (Owner signed in): Book 4, stuck with a reset saved review, was added with one press (one re-save). Book 7, with manual details and an edited title, was added with one press (Add's own save, the identity reset, one re-save). Book 3, whose title was edited while it kept a chosen edition, is refused by the server at the first save (P9_STATE_CONFLICT, blocker metadata_choice_missing). That is the known gap slice 2 AC2-10 closes, not a slice-1 regression. Mutations: no direct DB/Storage write, migration, Edge, Render or deployment; the in-app check added two books to the dev store's private inventory through the app; nothing committed or pushed.

Active work unit: post_scan_rework_slice1_add_resave. Update (§18): a two-model review loop found and fixed two more bugs before merge (a refused re-save could leave a card stuck; "press Add again" was shown on a disabled button). Round 2 approved; Haiku re-ran the tests: tsc clean, 803 passed, 0 failed. SDD-0 §15 now holds the refined per-slice process. Active work unit: post_scan_rework_slice2_declutter. Exact next authorized action: the Owner merges PR #24; slice 2 (SDD-1 §4) starts on the Owner's go-ahead, on a branch from slice 1's tip, with the review loop. Slice 2 starts only after the Owner has used slice 1 in the app (SDD-0 §7.2a) and gives a separate go-ahead.

## 2026-10-19 - Post-scan rework SDD set written (pass 1); 2026-10-18 handoffs reconciled

Phase 9 remains active. Reconciliation: main already records tracker 37 §71 (one Ready rule for the card badge, header count and Add all), §72 (Owner API `phase9-owner-ingestion` v17 deployed 2026-10-18; Ready counts agree in the app) and §73 (Book 4 rejection reasons traced to option snapshots taken before M77; not a code bug). Still not verified live and kept with tracker 37: Search Books on Book 4 after option expiry, and M75 exhausted-search recovery.

New work unit: on the Owner's brief (simplify the post-scan review: remove View metadata, keep Find or change edition, declutter, no separate review step, discard unfinished card details when the session ends, one source of truth once an edition is chosen) and after a discussion phase, the post-scan rework is planned as 18 slices in six SDDs: [SDD-0 overview](implementation/phase-9-image-inventory/work-units/post-scan-rework/00-overview-sdd.md) in full (decisions PSR-D01 to PSR-D47, rules, slice map, verified facts F1–F37, supersessions, open questions) and pass-1 outlines of [SDD-1 review screen](implementation/phase-9-image-inventory/work-units/post-scan-rework/01-review-screen-sdd.md), [SDD-2 catalogue and matching](implementation/phase-9-image-inventory/work-units/post-scan-rework/02-catalogue-and-matching-sdd.md), [SDD-3 session lifecycle](implementation/phase-9-image-inventory/work-units/post-scan-rework/03-session-lifecycle-sdd.md), [SDD-4 Add and publish](implementation/phase-9-image-inventory/work-units/post-scan-rework/04-add-and-publish-sdd.md) and [SDD-5 classification](implementation/phase-9-image-inventory/work-units/post-scan-rework/05-classification-sdd.md). Umbrella decision P9-D89. Database facts were read only through Supabase MCP on ahntbtktjjmvfosgkmgn. Branch `claude/phase9-post-scan-rework-sdd` from main 8863885. Evidence: [tracker 38](implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md).

Mutations: none (no DB/Storage, Edge, Render, migration, commit or push). Documentation only; no product code changed.

Independent read-only pass-1 review (OpenCode Go Muse Spark 1.3, xhigh): approve with fixes, 18 facts confirmed, none wrong; all 13 findings resolved in the SDDs (tracker 38 §10). On the Owner's request a round-2 review followed (Codex gpt-6.1-sol xhigh: rework; OpenCode Go Space Bunny max: approve with fixes); every claim was re-checked in code, one was stale, the rest were applied (tracker 38 §11). Owner decisions 2026-10-19: price above ₹0, condition and quantity are required before Add while the pre-scan default price may be ₹0 (new PSR-D47; PSR-D15 amended); category Auto-detect means Gemini decides (PSR-D42 amended; no catalogue or genre tier). The Owner approved the SDD set with the §14 defaults on 2026-10-19. SDD-1 pass 2 was then written and reviewed (Space Bunny max: approve with fixes; Codex gpt-6.1-sol xhigh: rework). All verified findings are applied (tracker 38 §13–§14). The Owner approved SDD-1 pass 2 and the slice 5 owner_isbn13 direction (superseding Q2) on 2026-10-19 (tracker 38 §15). Active work unit: post_scan_rework_slice1_add_resave. Exact next authorized action: the Owner's go-ahead to build slice 1 (SDD-1 §3), red-first, on a new branch from main; slice 1 has no migration. Approval of the SDDs does not authorize code; after approval, SDD-1 pass 2 with its code map, then slice 1 red-first. Every migration still needs separate create, apply and deploy approvals.

## 2026-10-17 - Live edition-picker acceptance on the Encyclopedia card; Supabase recovered

Phase 9 / Unit 6G remains active. The Supabase project (NANO) was overloaded and blocked Owner sign-in (OTP 504). On Owner instruction it was restarted, cron history older than 7 days was purged (255,828 rows), daily cleanup job 7 was added and dev job 5 was slowed to every 5 minutes (tracker 37 §69). The Confessions card cannot be retried (its session is closed), so live acceptance used the Encyclopedia card (candidate a5da3bc6, active session 7a81bdb6): one new edition job resolved on attempt 1 with 4 eligible options (previously 0), matched only through the M77 rules; nothing committed (tracker 37 §70). An edition (Unwin Hyman 1989) was selected under the Owner account at 14:17:45Z; the agent did not click Select edition.

Active work unit: owner_edition_live_acceptance_recorded. Exact next authorized action: the Owner decides whether to keep the Encyclopedia selection. Still held: Owner API Edge Function deployment (reasons header, still v16). Not verified live: M75 exhausted-search recovery (no exhausted job in an active session). Open observations: review header Ready count disagrees with the card badge and the Add-all-ready footer; the owner dashboard's direct `store_inventory` REST read returns 403.

## 2026-10-17 - PR #16 merged to main; Render metadata worker deployed

Phase 9 / Unit 6G remains active. The Owner merged PR #16 (codex/edition-picker) into main as merge commit f376c26 (2026-10-17T12:48:03Z; tree equal to reviewed bcd06de, which merged main's Clubs integration with docs-only conflicts resolved as a union). On the Owner's instruction the Render metadata worker (srv-d9sqfdvqj5pc73dc66fg, free plan, branch main, auto-deploy off) was deployed from main: deploy dep-db9mtcijnfac73ct2op0, commit f376c26, live at 2026-10-17T12:50:09Z; /health 200; service_started logged, no errors. Previous live commit 76348f3 is the rollback target (redeploy only; no database change needed, since live M75/M76/M77 accept both workers). The new matching rules (DOC-3 §5.2.1 rules 1-9) and work-level Open Library authors are now active for explicit Owner Search Books. No database write, Owner API deployment or client publication occurred.

Active work unit: owner_edition_worker_deployed_live_acceptance_pending. Exact next authorized action: the Owner's live Search Books on the stuck Confessions card (candidate f387251c), then read-only verification that its exhausted job 4ffe137d is dead_letter, exactly one new edition job exists and results follow the new rules. Owner API Edge Function deployment (reasons header, still v16) remains a separate decision. Tracker 37 §68 owns evidence.

## 2026-10-17 - Matching variants (M77) and exhausted-search recovery (M75) applied; deploys held

Phase 9 / Unit 6G remains active. Owner authorized M75 and M77 creation and application ("create review and preflight and then apply"), all four matching variants, "mark failed, allow retry" for stuck searches, and asked to be consulted before any deployment. Worker: hyphens/dashes and apostrophes join words and listed punctuation separates them (all languages); en/en "ae" reads "e"; middle names may be initials; Open Library editions with no authors of their own use their work's authors (DOC-3 §5.2.1 rules 6-9; picker §§4.1/4.3/13.14 amendments). M77 (20261017000077_marketplace_phase9_edition_matching_variants.sql) adds the title/author variants to SQL as a superset of the worker. M75 (20261017000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql) makes a spent, unclaimable edition search read as failed; the Owner's next Search Books closes it and starts one new request. One independent read-only review found no blocker; its lock-order finding was fixed before application.

Verification: worker suites 234 passed; full Jest 3,548 passed / 0 failed / 4 skipped; tsc clean; M77 SQL suite 48/48 (10 expected RED without M77); M75 SQL suite 11/11 (5 expected RED without M75); random parity check of 4,000 pairs, worker and SQL agree on every decision; full phase9 DB suite 761/764, with the 3 failures in phase9MetadataFoundation also failing on the clean committed code (pre-existing, unrelated). Live: M75 = 20261017083027, M77 = 20261017083206 (commit 850121e); server statement SHA-256 equals each file; all seven function bodies and ACLs match the expected local hashes. The stuck Confessions card now reads failed; its job (4ffe137d, 5/5) is unchanged until the Owner presses Search Books. No data written by Claude; no Render, Owner API or client deployment; nothing pushed.

Active work unit: owner_edition_matching_variants_and_recovery_applied. Exact next authorized action: Owner decides on deploying the Render metadata worker (the new matching rules and work-level authors take effect only after it) and the Owner API Edge Function (reasons header), and on pushing codex/edition-picker. Tracker 37 §67 owns evidence and the ledger.

## 2026-10-17 - Clubs publication CI passed

[GitHub run 39017350125](https://github.com/mdasheef99/Bookapp_reactexpo/actions/runs/39017350125)
passed repository tests, TypeScript and production web export at published
09dcd32. Its executable tree equals reviewed merge 8882efc. The first CI failure
recorded below did not recur; retain it as a possible test-timing concern,
without claiming a root cause or product correction. This receipt changes
documentation only. Original dirty Clubs checkout remains preserved; no
DB/Storage, permissions, migration application, deployment or business mutation.
Exact next action: report publication and remaining browser/role/native gaps;
stop before rollout or further product work. Phase 9 rollout hold is unchanged.

## 2026-10-17 - Reviewed Clubs integration published to main

Remote main readback matched `8882efc865e626eab290745de6a827240ad273a2` after
a normal fast-forward push. Existing Clubs commits, navigation corrections and
documentation are published, with newer main history preserved. Independent
GPT-6 Luna/max rereview and final local tests/build/fixture/continuity gates
passed. The merge CI failed one unchanged marketplace edition-picker timing test;
all Clubs tests passed. Its isolated local rerun passed 19/19; a remote rerun was
denied by GitHub connector permissions. Remote validation remains unresolved.
 Original dirty Clubs checkout remains unchanged.
No database/Storage, permissions, migration application, deployment or business
mutation occurred. Phase 9 remains Unit 6G with its existing rollout hold.
Exact next action: report the publication and unresolved remote-validation
gate; investigate the unchanged marketplace test before claiming CI clearance.
Stop before rollout or further product changes. [Exact evidence and limits](../user/clubs/MAIN-INTEGRATION-REVIEW-20261017.md).

## 2026-10-17 — Clubs/main integration and publication review

The user authorized combining the existing Clubs commits and navigation
corrections/tests with fresh main, reviewing here and pushing main after the
exact candidate is verified. The isolated integration retains main's current
Phase 9 Unit 6G Open Library publication/CI/Render-hold records. Older imported
Clubs M62 handoffs are historical and do not roll back that authority.

This is a Clubs Git integration only. No Phase 9 product code, migration bytes,
provider activation, database/Storage, permissions or deployment is changed.
The two already-applied Clubs SQL artifacts are published as existing history;
they must not be reapplied. Fresh exact-project catalog reads confirm their
ledger records and the expected five venue policies. Connected business
submissions and whole-project security clearance are not claimed.

Completed scope, verification actually run, independent review, residual gaps
and exact next action are owned by [the integration record](../user/clubs/MAIN-INTEGRATION-REVIEW-20261017.md).
At preparation, the next authorized action is complete candidate verification
and review, then a normal fast-forward main push if clear.

## 2026-10-17 - Review of the edition-picker work (76348f3..c0c485b) and bounded fixes

Phase 9 / Unit 6G remains active. Owner-authorized review with freedom to fix anything except new migrations (tracker 37 §66). Live M76 readback: all six functions match the migration file byte for byte (prosrc md5), owner-only grants and empty search_path; schema_migrations shows only 20261016153615 since 2026-10-15; no M77. Four read-only review agents (two Sonnet, two Haiku) covered matching parity, client data flow, the sheet UI checklist and docs facts; every finding was checked before action. Fixed: the identity save now rejects a save response older than the known card instead of silently adopting cached state; after an identity save the card waits for its own refreshed read instead of re-adopting the older card authority (Add stays locked meanwhile); two status messages gained polite live regions; tests added. Full Jest 3,514 passed / 0 failed / 4 skipped; tsc clean. Look-only browser check passed after the Owner signed in (tracker 37 §66); no writes.

No migration and no Supabase schema, Render, Owner API or client deployment. No database or storage writes (read-only queries only). M77 remains PROPOSED / NOT_CREATED / NOT_APPLIED. Dated entries below this one are history.

Active work unit: owner_edition_picker_review_fixes. Exact next authorized action: Owner decides whether to push c0c485b and 6d7f5be, then the follow-ups recorded in tracker 37 §65-66 (stuck-job migration, matching-rule amendments with SQL first, Render metadata-worker deployment).

## 2026-10-17 - Edition sheet display fixes; stuck-job, Encyclopedia and held-worker findings

Phase 9 / Unit 6G remains active. Owner-approved client changes (picker §13.2/EP-D03 amendment): when none of the first five results is selectable and a later one is, the sheet shows all results at once in original order; Select edition is a filled button and the chosen row is clearly marked; the identity-fix success message no longer repeats "Searching books…". Owner-approved read-only investigations, tracker 37 §65: (1) the Confessions edition-search job crashed on all five attempts before registering a lookup and stays in_progress forever because claims skip attempt_count >= max_attempts and nothing closes expired leases at the limit, so the card cannot search again; (2) the Concise Encyclopedia's Open Library edition records carry no author list (authors exist only on the work), and the worker by rule uses only edition-level authors, so every row is unavailable; the titles also use the "Encyclopaedia" spelling; (3) re-evaluating live stored rows with the held worker gains only the unknown-language False Dawn row; "Anti-Fragile" (hyphen), "Nassim N Taleb" (middle initial) and translated titles stay ineligible.

No migration and no Supabase schema, Render, Owner API or client deployment. No database or storage writes in this entry. M77 remains PROPOSED / NOT_CREATED / NOT_APPLIED.

Active work unit: owner_edition_display_and_investigations. Exact next authorized action: Owner decision on which follow-ups to authorize: a migration to close or recover jobs stuck at the attempt limit, matching-rule amendments (hyphenated titles, middle initials, British spellings, work-level Open Library authors; each needs SQL first), and the Render metadata-worker deployment.

## 2026-10-17 - Edition-sheet title/author fix saves, then searches (client only)

Phase 9 / Unit 6G remains active. Owner-approved picker §3/EP-D07 amendment: the batch card's edition sheet always offers "Wrong title or author? Fix it". The Owner corrects the title/authors and "Save and search again" first saves the card's full review through the existing update_candidate_review action (the same review Add would save, metadata choice manual, all card edits included), then requests one explicit search for the saved identity. When an edition is chosen the sheet warns that saving clears it; the existing phase9_edition_identity_change trigger performs the reset. This closes the gap where card-only identity edits stayed an unsaved draft, so a search still used the scanned text (for example "Nasrim Nicholas Taleb"). The full-correction screen is unchanged. Also recorded: the metadata-sheet loading flash fix (tracker 37 §61) and an Owner-authorized live check confirming that Search Books and Select edition work against the live database (tracker 37 §62).

No migration and no Supabase schema, Render, Owner API or client deployment. Live data writes, Owner-authorized: one edition search and one edition selection on the False Dawn card only. M77 remains PROPOSED / NOT_CREATED / NOT_APPLIED.

Active work unit: owner_edition_identity_fix_save_then_search. Exact next authorized action: Owner review of the identity fix, then the Owner's choice between investigating the stuck Confessions edition-search job (tracker 37 §62) and the Render metadata-worker deployment. Tracker 37 §§62-63 own the evidence.

## 2026-10-16 - Review corrections committed; worker stricter than live M76; Render held

Phase 9 / Unit 6G remains active. Three independent read-only Haiku reviews of the M76 work were verified in this session. The Owner authorized fixing the worker rules, Open Library ordering, app prompt and SDD wording, with no new migration and no deployment. Worker: accent folding applies only to marks on Latin letters a-z; the single-word surname rule excludes joined initials and comma-form provider names; Open Library author lookups serve known-language identities before unknown-language ones. App: the "Edit title/author" prompt no longer appears when every result is only unavailable or over an Owner-confirmed choice, and its explanation is announced politely. DOC-3 §5.2.1 and picker §4.1/EP-D07/§3/§13.2 wording updated.

Live M76 (20261016153615) is unchanged and is now a deliberate superset of the worker for three edges, so every worker-eligible row still passes completion. A parity migration (M77) is PROPOSED / NOT_CREATED / NOT_APPLIED. No Supabase, Render, Owner API or client deployment occurred.

Active work unit: owner_edition_explicit_matching_review_corrections. Exact next authorized action: Owner review of the corrected branch, then separate decisions on M77 creation and the Render metadata-worker deployment. Tracker 37 §59 owns the findings, dispositions and verification.

## 2026-10-16 - Explicit edition matching committed; M76 applied and verified; Render held

Phase 9 / Unit 6G remains active. The Owner authorized the full plan through migration application and explicitly stopped before the Render metadata-worker deployment and app publication. Approved scope: DOC-3 §5.2.1 / picker §4.1 amendment for explicit Owner edition options only (Latin accent folding, en/en "&" = "and", author full stops and joined initials, single-word surname only with identical title keys, unknown result language after a complete known-language text match); one shared worker helper; forward M76 combining that predicate with the retained opt-in rejection-reason projection; client "Edit title/author" prompt when a fresh set has nothing selectable, a disabled-sheet reason, and the "Find or change edition" trigger label. The earlier 2026-10-13 title, scroll and four-correction local work is included.

Verification: shared 22-case table; Jest 3,491 passed / 0 failed (4 pre-existing skips); new M76 SQL suite 32/32 with M76 and 7 expected RED cases on M65-M74 alone; existing edition/Open Library SQL suites 288/288; structural worker 14/14; root TypeScript and metadata-worker build PASS. Live read-only preflight (ahntbtktjjmvfosgkmgn, PostgreSQL 17.6): latest migration M74 20261012140853; replaced bodies match local M68/M70 md5; new helper names absent; accent folding verified; 0 fresh option sets; one open edition job (the known exhausted closed-scan job).

M76 is APPLIED_VERIFIED as live version 20261016153615 (commit cc5e944, file SHA-256 90a6dfca30064866e8ab9ceb46d0491cdda7460bd8d74abb0d81ace62d53052f); all six function bodies match the committed file, phase9_edition_identity_compatible is unchanged, owner/ACL/volatility/search_path read back as expected. No data, job, selection, inventory or provider mutation.

Active work unit: owner_edition_explicit_matching_m76_applied. Exact next authorized action: Owner decision on the Render metadata-worker deployment of codex/edition-picker (M76 is already live, so the worker may follow). Owner API redeployment for reasons, client publication, M75 and the live Search Books acceptance remain held. Tracker 37 §57 owns scope, evidence and ledger.

## 2026-10-13 - Four picker corrections locally complete; SQL proposals retained

Phase 9 / Unit 6G remains active. All four approved corrections are locally implemented and independently APPROVED: selectable-result discovery/counts, error-specific selection recovery, compatible enum-only disabled reasons, and genuinely supplied edition/format display. Earlier title/scroll patches are preserved. Local verification: 491 Jest tests in 19 suites, 77 disposable SQL cases, root TypeScript and worker compilation PASS; fresh web export and actual read-only browser presentation/scroll proof PASS. This is bounded local completion, not shared release acceptance.

Active work unit: owner_edition_picker_four_corrections_local_complete_sql_proposals_retained. Exact next authorized action: Owner review of the local picker at localhost:8083 and the retained proposals. Detailed reasons still require compatible API/SQL publication; the actual browser verifies legacy fallback. Title and diagnostic SQL remain external PROPOSED / NOT_CREATED / NOT_APPLIED; title migration creation was declined. Current-scan refresh, staging/commit/push, deployment and shared writes remain held. M65-M74 are unchanged; M75 remains deferred. Tracker37 §34 owns exact scope/proof/risks; earlier dated checkpoints are historical.

## 2026-10-13 - Four picker feedback corrections locally authorized

Phase 9 / Unit 6G remains active. Prior title/scroll corrections remain local; the SQL title proposal stays retained and uncreated/unapplied. The Owner explicitly authorized plan-first implementation and clarified all four corrections: selectable-result discovery, selection-error recovery, disabled-choice reasons and supplied edition/format display.

Active work unit: owner_edition_picker_four_corrections_local_authorized. Exact next authorized action: execute the reviewed client-corrections plan red-first, verify current code/API/SQL proposal compatibility and report local proof. Diagnostic SQL remains an external proposal; no migration file, shared mutation, data refresh, staging/commit/push or deployment is authorized. Tracker37 §33 owns context, source boundaries and evidence; all earlier checkpoints are historical.

## 2026-10-13 - Bounded title correction local; SQL proposal retained

Phase 9 / Unit 6G remains active. The Owner approved the reduced explicit-selection scope and asked to collect related changes before another worker release. Local worker code now accepts an exact title or one leading English The difference, with the existing author/language/identifier and own-record guards. Extra rejection messages, cover fallbacks and new OCR functionality are deferred. The earlier local scroll correction is preserved.

Verification: 8 focused/related Jest suites / 199 tests PASS; 19 SQL proposal cases in a disposable full-M74 database PASS; the existing current M74 SQL/compiled-worker gate passed 32 cases; metadata-worker build and root TypeScript PASS. These are local proofs, not new shared/browser acceptance. No formal migration file or shared mutation was made. M75 remains NOT_CREATED / NOT_APPLIED and deferred.

Fresh service/project reads confirm Render metadata worker LIVE at 76348f3, autoDeploy=no, one Free instance; Owner API ACTIVE v16/JWT enabled; exact Supabase project ahntbtktjjmvfosgkmgn. Runtime dependency inspection finds none of the three changed matching files in the Owner API. Release needs the worker and a forward SQL predicate correction; no Owner API deployment is required. A separately approved post-worker refresh is scoped to the current Owner scan, with one currently affected temporary list. Chosen snapshots/selling/inventory/jobs/accounting are preserved; no eligibility relabel or job reset is proposed.

Active work unit: bounded_title_worker_local_sql_proposal_retained. Exact next authorized action: retain the tested SQL proposal and unreleased local worker patch for a later explicit Owner direction; no further migration or rollout work is authorized. The Owner declined local forward-migration and repository SQL regression creation by choosing "Keep the SQL as a proposal". Application, the scoped data operation, Git publication and deployment remain held. See tracker 37 §§30-31 for proof, limits and the retained proposal.

## 2026-10-13 - Extended matching/cover audit; bounded correction proposed

Phase 9 / Unit 6G remains active. The Owner requested a solution and challenged the investigation's completeness. The read-only audit now includes live SQL comparison/URL guards, client/Owner API parsers, all seven automatic snapshots, the original photo, and eleven bounded public API GETs. It confirms the Penguin title-variant rejection and genuine missing own-cover mappings in two sampled records. Matching needs a coordinated worker/SQL correction; no blanket cover-recovery promise is justified.

Proposed next scope: bounded explicit Owner title-variant selection, controlled refresh of affected saved options, clear rejection/discovery UI, and correction of OCR identity through the existing review path. Keep known conflicts blocked and preserve automatic Google behavior, chosen snapshots, selling data, provider order/limits and retention. Existing post-commit Manage Photos handles Owner-supplied imagery when catalogue images are unavailable. Cover URI fallback is optional later work, with multiple validation boundaries; it is not required to unlock the Penguin rows with existing cover IDs.

Exact next authorized action: Owner review of this concrete proposal; implementation/source-spec amendment and any new forward migration/application remain separate decisions. No code/test edit, migration file, shared write, selection/Add, job reset, provider switch, Git publication or deployment occurred. M75 stays deferred. The previous local scroll correction remains uncommitted. [Evidence, proposal and limits](implementation/phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §29).

## 2026-10-13 - Covers and disabled choices diagnosed read-only

Phase 9 / Unit 6G remains active; the prior two-file scrolling correction stays local and uncommitted. The Owner requested an explanation of missing covers and disabled choices. This read-only investigation is complete: the Black Swan set has ten original positions, one eligible, seven ineligible and two unavailable. Of eight usable records, five have no own-edition cover reference; all three supplied image URLs load. The exact-title guard rejects the Penguin title variants without "The"; unknown language also rejects an otherwise matching row. The first five happen to contain no eligible choice.

This is a data/selection usability limitation under existing picker §§3/4.1/13.14, not an approved rule change. The UI's generic rejection message hides these distinctions. No search, selection, Save, Add, source/test edit, provider flag, database/Storage mutation, migration or deployment occurred. M75 remains deferred and uncreated/unapplied by this session.

Exact next authorized action: Owner review of these findings and direction on whether to amend matching/confirmation, rejection explanations or same-edition cover fallback. No implementation or publication of those changes is inferred. [Exact read-only evidence and limits](implementation/phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §28). Earlier live Add and local scroll proofs retain their recorded scope.

## 2026-10-13 - Metadata sheet scrolling corrected locally

Current status: `metadata_sheet_scroll_correction_local_verified`. Phase 9 / Unit 6G remains active. The Owner reported that the live scan's metadata sheet could not scroll. A bounded two-file local layout correction restores the existing picker SDD §3 / §10 EP-AC03 interaction; no requirement, acceptance ID or command contract changes.

Before the fix, the 375 × 580 browser sheet clipped a 1600px ScrollView inside a 522px cap; its inner GlassCard content wrapper did not shrink. Ordinary scrolling left scrollTop=0. The main review list scrolled normally after Escape closed the sheet. GlassCard now accepts an optional inner contentStyle, and only CandidateMetadataSheet opts into flexShrink=1 / minHeight=0. Other callers keep their defaults.

Fresh verification: four focused Jest suites / 67 tests PASS; TypeScript no-emit PASS; Expo web export PASS (2690 modules / 69 assets). The rebuilt localhost:8083 preview passed ordinary wheel scrolling: 482px scroll viewport, scrollTop0 -> 580; Show all expanded ten saved positions, and scrolling reached the visible Close metadata button at y508-560. No automatic scrollIntoView was used for this scroll proof. The scan still displays seven detected, six in review, one added.

The earlier live Open Library selection/private Add proof remains valid. This correction is local and uncommitted; the shared runtimes remain at the previously verified source. No Search Books, selection, Save, Add, provider flag, database/Storage/job mutation, migration, staging, commit, push or shared deployment occurred in this check. M75 remains uncreated/unapplied and deferred. Native-device scrolling was not run.

Exact next authorized action: Owner review of the corrected scrolling in the open localhost:8083 scan. Publication of the two-file correction requires a separate instruction. [Cause, source changes and ordinary-scroll evidence](implementation/phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §27); preceding dated entries retain their historical scope.

## 2026-10-13 - Open Library enabled; fresh-session picker and private Add verified

Current status: `open_library_live_fresh_session_picker_private_add_verified`. Phase 9 / Unit 6G remains active. The Owner's "ok" authorized Open Library activation and one controlled authenticated fresh-session test. The specified testimage.jpeg had been uploaded before, so the app's duplicate guard prompted; the test used Proceed and created independent candidates for this session. The Search Books -> selection -> private Add path passed for one book; six other detected books remain in review. M75 remains PROPOSED / NOT_CREATED / NOT_APPLIED and deferred.

Fresh exact-project preflight matched Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, Render LIVE commit 76348f3 and Owner API ACTIVE v16/JWT enabled. One bounded registry update enabled Open Library at 2026-10-12T22:05:26.434106Z (13 October IST); only enabled/updated_at changed. Google remains enabled. Existing retention, attribution, permission and image-cache flags are preserved; no migration or deployment occurred.

The old scan 93567d47-3874-4576-b3b4-1adb044b552b was closed through the authenticated app at 2026-10-12T22:08:44.023344Z. Live readback: closed/version3, all five candidates retained, all four committed inventory rows present, unchanged candidate states/versions/links. The unfinished card is read-only session history; its exhausted job is still in_progress at 5/5. No job reset or recovery fix was performed.

Exact next authorized action: Owner review of the live proof and direction on the six remaining cards in active session 7a81bdb6-ed34-40cb-b5a9-cff85402cf48; separately decide whether to authorize the proposed M75 exhausted-lookup recovery. The new session remains active, and the existing expired 5/5 job remains untouched. Sources: picker SDD §13.14, DOC-3 §5.2.1, Unit 6G SDD §§14/23 (U6G-AC13/18/20). [Live picker and Add evidence](implementation/phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §26); earlier headers are historical.
## 2026-10-13 - Owner API v16 verified; exhausted lookup recovery pending

Current status: open_library_owner_api_v16_verified_exhausted_lookup_recovery_pending. Phase 9 / Unit 6G remains active. Render still runs reviewed commit 76348f3; phase9-owner-ingestion is now ACTIVE version 16 with JWT verification enabled. All 35 served runtime files match the reviewed upload; three additional uploaded files were type-only dependencies, as independently checked against the Deno runtime graph.

Fresh API checks: OPTIONS 200, unauthenticated POST 401. The actual authenticated Codex browser loads the scan and reads edition state. The verified frontend export was restarted at localhost:8083, managed session 96852, after the old Metro preview had stopped; the fresh tab uses the tested static bundle and correct project.

The supplied card is blocked by an existing in_progress edition request with attempt_count=max_attempts=5 and an expired lease. Live dispatcher and claim predicates exclude it, while the choices reader reports pending; the UI therefore shows Searching books indefinitely. No job, selection, selling field or provider flag was manually repaired. Open Library stays disabled.

Proposed bounded correction: a new forward M75, leaving M65-M74 unchanged, must expose exhausted expired edition requests as failed and allow an initiating-Owner controlled retry with preserved chosen metadata, selling details and accounting/audit evidence. Exact file is proposed only: 20261013000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql; NOT_CREATED / NOT_APPLIED. Local creation and conditional shared application await the Owner's separate authorization.

Exact next action: obtain that bounded M75 authorization, then reproduce, implement and review the correction before fresh preflight/application and the controlled live edition workflow. No Render or Owner API redeployment is needed for the proposed SQL-only correction. [API deployment and live recovery finding](implementation/phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 sections 23-24); earlier dated entries are historical.

## 2026-10-12 - Fresh predeployment browser checkpoint; Render held

Phase 9 / Unit 6G remains active and the M74 applied/verified status is unchanged. The requested local browser checkpoint is complete: the exact edition-picker checkout/branch/HEAD were verified, the preview and bundle came from that worktree, and the installed Playwright/Edge harness passed all nine cases (zero failed, zero skipped, exit 0). API responses and persistence in the harness were simulated. One P3 visual finding is recorded in tracker 37 §16; no product source was changed.

The live Codex in-app browser showed the supplied scan route and existing session state. No explicit Search Books, edition-selection, Save, or Add command was sent. No shared Auth, inventory, Storage, provider, migration, or deployment mutation occurred. The preview remains at http://localhost:8083 in managed command session 32257. Exact next action: independent read-only aggregate prepublication review with this browser evidence, then the final Free-plan/configuration preflight. STOP before Render deployment. Detailed evidence and screenshots: trackers/37-owner-edition-picker-open-library-local.md §16.

## 2026-10-12 - M74 applied and verified; Open Library disabled; Render held

Current status: open_library_m74_applied_verified_render_held. Phase 9 / Unit 6G remains active. The Owner explicitly requested completion of M74 preflight/application after the approved bounded correction. That application authority supersedes the earlier local-only gate for M74; publication, provider activation and Render deployment remain held.

Fresh preflight matched the reviewed file and both M73 function bodies/permissions on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn; the focused full-M74 SQL/security suite passed 20/20. M74 is APPLIED_VERIFIED as live version 20261012140853. Archived SQL SHA-256 FE0B13B7D10DA09AFFF71E031E6330F8568C5D05638F079551A7652172EF2FF3 matches the unchanged local file; both installed function bodies match the reviewed definitions.

Only the two private completion/registration functions changed. Their signatures/owners/ACLs/search paths and 17 other checked functions remain intact; provider-call columns/RLS/ACLs/policies, provider flags and observed business/job counts are unchanged. Open Library remains disabled with no unresolved OL attempt. One existing in_progress edition job has an expired lease; it was observed and preserved.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. Compatible client/worker/Owner API rollout, separately authorized provider activation and controlled shared operational acceptance remain pending. STOP before Render deployment. No commit, push, runtime deployment, provider request, Auth/inventory/Storage write or account/configuration change occurred. [Application ledger, exact readback and scope](implementation/phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (§15). Earlier dated checkpoints are historical.

## 2026-10-12 - Author isolation corrected locally; M74 unapplied; Render held

Current status: open_library_author_corrections_local_verified_m74_pending. Phase 9 / Unit 6G remains active. The Owner authorized "Yes, fix both and create local M74". Both aggregate P2 findings were reproduced, corrected and regression-tested; GPT-6 Luna/max approved the bounded correction. This does not replace the aggregate prepublication review.

The adapter validates edition facts before allocating complete own-author sets within the four-author budget. Nonretryable author-content failures leave only dependent rows unavailable; local M74 permits truthful finalized receipts to continue and complete without weakening mandatory-stage, retryable, egress or authority guards. Google ranking/cover and Owner UI behavior are preserved.

M65-M73 remain applied and byte-preserved. M73's archived live SQL matched its reviewed hash in this session's read-only exact-project check; OL remains disabled. M74 is CREATED_LOCAL / NOT_APPLIED. No shared mutation, provider request, browser action, staging, commit, push or deployment occurred in this correction.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. M74 application needs a separate decision and fresh preflight; compatible client/worker/Owner API rollout, provider activation and authenticated operational acceptance remain gates. STOP before Render deployment. [Exact scope, commands, migration ledger and evidence](implementation/phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (§14). Earlier dated checkpoints are historical.

## 2026-10-12 - Browser corrections verified; M73 applied; Render held

Phase 9 / Unit 6G remains active. Status: `open_library_browser_corrected_m73_applied_render_held`. The Owner authorized the bounded corrections and migration application, with an explicit stop before Render deployment.

The Response receiver, bulk-control lifetime and metadata-sheet opacity are corrected. Fresh gates: 25 client suites / 379 tests, eight actual-app browser fixture cases, 25 full-M73 SQL/worker cases, worker build / 14 structural checks and TypeScript PASS. Luna/max approved only the bounded source corrections; no independent test rerun or aggregate publication approval is claimed. No new Save step was introduced.

M73 is APPLIED_VERIFIED on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn as version 20261011224457; archived SQL SHA-256 matches the unchanged reviewed file. Open Library is installed disabled. Existing books/candidates/inventory/provider-call data, provider-call RLS/grants and M65-M72 bytes are preserved. Seven read-only actual-adapter OL GETs returned 200 with minimum start spacing 1005.37 ms; raw bodies and returned metadata were discarded.

Exact next authorized action: report this verified correction/application checkpoint and the remaining rollout prerequisites, then STOP before Render deployment. Compatible client/worker/Owner API publication and rollout, shared provider activation, authenticated shared workflow and operational acceptance remain pending. No Git publication, runtime deployment or provider activation occurred here. [Exact evidence, migration ledger and limits](implementation/phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (§11). Earlier dated checkpoints are historical.

## 2026-10-11 - Native accounting and request spacing verified; browser handoff

Current status: `open_library_native_spacing_locally_verified_browser_pending`. Phase 9 / Unit 6G remains active and Tasks 1-8 retain their earlier bounded approval provenance. M65-M72 remain applied/byte-preserved; M73 remains CREATED_LOCAL / NOT_APPLIED and shared OL activation remains pending.

Native PostgreSQL through M73 passed 28 cases with 18 observed independent-connection lock overlaps and verified disposable teardown. The Owner-authorized scheduler correction holds the shared permit through fresh authority checks until HTTP dispatch; a compiled-factory fixture run spaced all 18 actual fetch invocations at least one second apart across three jobs. The 397-test backend gate passed. These local proofs do not establish deployed provider/browser behavior.

Next authorized action: use the separate predeployment browser inspection prompt in another session, then return its report here for the final Free-plan/configuration preflight. Do not start browser testing in this preparation session. Deployment remains held at the Owner's request; M73 application, shared provider activation, compatible runtime/client rollout, shared security/cleanup/recovery/disablement and publication remain gates. Available-model local correction review does not replace the requested Luna prepublication review, which remains separately pending at its usage limit.

[Detailed scope, evidence and pending gates](implementation/phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md). Earlier dated checkpoints below are historical.

## 2026-10-11 - Local Open Library edition fallback; rollout gated

Current status: `open_library_fallback_local_review_complete_rollout_pending`. Phase 9 / Unit 6G remains active; Tasks 1-8 keep their prior approvals. The Owner authorized explicit-search fallback implementation and "Yes, create local M73". M65-M72 remain applied/byte-preserved; M73 is CREATED_LOCAL / NOT_APPLIED. OL is absent from the shared metadata registry.

Only explicit Owner lookup can use independently permitted Open Library factual editions; automatic Google winner/cache/ranking and representative-cover behavior remain unchanged.

Next authorized action: hand off the verified local correction and detailed independent browser prompt. GPT-6 Luna/max found no remaining bounded blocker and independently passed two focused full-M73 regressions; wider gates remain root evidence. Publication/application/activation/deployment and browser/device verification remain gated; the Owner asked for a separate browser prompt first. [Scope, migration ledger, evidence and gates](implementation/phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md). Earlier dated entries are historical.

## 2026-10-11 - Provider checks complete; retention decision remains pending

Phase 9 / Unit 6G remains `feature_published_runtimes_deployed_provider_gate_pending`. The Owner explicitly authorized multiple read-only Google Books checks with the existing Render key only in memory and Open Library investigation. This supersedes the earlier pending one-request question. No provider switch, new retention permission, product edit, migration or deployment is inferred from that authorization.

The Owner's latest decision is Google first, Open Library only if required. Six configured-key Google probe invocations produced one title/author HTTP 200 and five HTTP 503 responses across ISBN, title/author and plain-title queries. The inspected failures reported backendFailed / Service temporarily unavailable. Cache-Control, Expires and Age were absent in every observed response. The successful response establishes configured-key access to this endpoint; its body was cancelled. Subsequent in-memory data checks failed before returning usable book content. This does not prove all Render configuration, the worker's network response, any cache lifetime or continued selected-snapshot rights. No key or Google book payload was recorded. These observations warrant a bounded fallback proposal, not an unapproved provider switch.

Independent read-only recheck (2026-10-11): GPT-6 Luna/max found no request-construction defect; the endpoint, search operators, encoding and ten-result parameters match official Google documentation. The six earlier configured-key receipts support intermittent provider-side failures, not a current/global outage. Two fresh root Node HTTP probes without a key returned 429/rateLimitExceeded; these cannot diagnose the configured key or the Owner's project quota. The reviewer attempt failed before HTTP at TLS. Render browser tab control remained unavailable, so no fresh keyed result or successful book-list inspection was obtained. The bounded availability fallback remains reasonable to consider; no provider switch was implemented. Detailed limits and timestamps are recorded in tracker 36.

The Owner's 24-hour retention cap and cleanup after confirmed Add are already approved. The missing production verifier is a separate server implementation/evidence gate, not a missing Owner approval or Google dashboard approval setting. Absence of inspected cache headers alone is not treated as a blanket prohibition on factual metadata use.

Production bootstrap still installs no verifyOptionsRetention callback. Unknown permission therefore denies persistence as policy_denied. Google branding permits ordinary attributed API display; Google API terms §5(e) separately constrain cached/permanent content with stated rights/law exceptions. This audit has not established permission for this approved 24-hour alternatives plus persistent selected-snapshot workflow. More requests or storage_allowed=true cannot create that evidence.

Three read-only Open Library requests returned HTTP 200: one work search, a ten-edition page, and a separate exact-ISBN edition. Its API guidelines encourage caching for human lookup and impose request limits; cover guidance favors direct covers.openlibrary.org image links. Licensing does not assert new database rights and acknowledges possible existing contribution/jurisdiction rights. No blanket CC0 license for every record or cover is claimed. The current picker is Google-specific across SQL, worker, wire links and UI; Open Library remains a proposed scope amendment, not an implemented fallback.

Fresh local verification: two existing provider safeguard suites / 92 tests passed. Source, tests, dependencies and M65-M72 are unchanged. Only twelve existing evidence/handoff documents changed; nothing was staged, committed or pushed in this investigation. No Auth, inventory, database/Storage, configuration, billing or deployment mutation occurred.

Exact next action: present the Google-first findings and obtain separate local migration/implementation authority for the documented Open Library edition fallback if the Owner chooses that correction. Retain Google as the preferred provider; do not change the automatic winner/cache path. Keep the current retention gate closed until the chosen path has acceptable evidence and reviewed compatible code. Browser/device and operational acceptance remain pending.

[Actual provider responses and decision proposal](implementation/phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - Compatible runtimes deployed; provider and operational gates pending

Current status: `feature_published_runtimes_deployed_provider_gate_pending`. Phase 9 / Unit 6G remains active; Tasks 1-8 retain their local approval boundaries. The Owner explicitly confirmed the exact two-service deployment after the earlier approval-review rejection. That rejection and earlier deployment holds below are historical; this entry owns the current handoff.

Render `phase9-metadata-worker` is LIVE at `f2d47cb1d015c8b93ded58baff35f125f99ad52c` (deployment `dep-db5b71ajnfac739scpag`). One cached deployment used the existing Free service, one instance, main, and autoDeploy off. GET /health and /ready returned HTTP 200; readiness is process-level evidence, not live provider/database proof. Executable source equals independently approved `47207b7385ee4ae37e01c48b7dba0738abb53389`; their differences are documentation only.

Supabase `phase9-owner-ingestion` is ACTIVE v15 on verified Bookconnect_reactexpo / `ahntbtktjjmvfosgkmgn`, with verify_jwt=true. Deployment followed worker commit/health verification. Prepared source had 38 files; all 35 returned runtime/configuration files match it exactly. Three type-only dependencies are absent from the deployed readback; the emitted runtime graph is complete. CORS OPTIONS passed and an unauthenticated POST was rejected with HTTP 401.

M65-M72 remain applied and byte-preserved; no migration was created or applied in this checkpoint. Read-only preservation counts remain books 45, candidates 173, inventory 21, edition states 0. The only service mutations were the two runtime deployments. Plan, instance count, automatic deployment, secrets, permissions, schedules, Auth, Storage and business data were not edited.

Provider-result retention remains disabled: production has no verified permission callback. Exact next action: investigate the configured Google Books retention permission read-only and establish acceptable evidence before any explicit edition request or result storage. Authenticated Search Books/selection, Save/resume/Add, expiry/cleanup/recovery, browser/device accessibility and controlled operational acceptance remain unverified. Deployment success does not complete those gates. No product tests were repeated for this documentation closeout; the approved source CI remains applicable. [Activation receipt](implementation/phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - Runtime activation blocked by deployment approval review

Phase 9 / Unit 6G remains locally implemented and published; current runtime activation status is feature_published_runtime_activation_approval_blocked. The Owner replied "ok please proceed it then" to the reviewed deployment sequence. Fresh readback confirmed both GitHub refs at f2d47cb1d015c8b93ded58baff35f125f99ad52c; its only differences from independently approved 47207b7 are twelve documents. Executable source and migrations are identical. The earlier successful source CI and independent review remain applicable; no product test was rerun in this checkpoint.

Immediate preflight verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY and M72 version 20261010200655, both expected functions, private service execution=true and public authenticated execution=false. Render target remains phase9-metadata-worker / srv-d9sqfdvqj5pc73dc66fg in workspace tea-d9j67irtqb8s739ritc0, one Free instance, main, autoDeploy off and the existing Dockerfile/health contract. No new migration or data mutation occurred.

One Render trigger_deploy attempt with clearCache=false was REJECTED by automatic approval review; it returned no deployment ID. Its stated reason was that the earlier instruction to stop before deployment requires exact-action confirmation despite the subsequent general proceed reply, and deployment may disrupt the live worker. Do not retry through another interface or bypass this rejection. No Render deployment began and no Owner Edge deployment was attempted. Browser inventory timed out and reset its kernel before any UI access or action.

The corrected Owner API manifest was freshly reverified: all 38 files / 182814 source bytes equal immutable 47207b7, manifest SHA-256 6baf912a93ee21adb2680a06a5ebcf7bc5d1c3d07264fd6cc4234e1fbf565aae, project/function/entrypoint/import-map exact and verify_jwt=true. Render MCP deploys the configured branch head rather than accepting a commit pin, so the proposed actual Render revision is f2d47cb with the same reviewed executable source. Runtime deployment order remains metadata worker, verified commit/health, then Owner API. Provider-result storage remains disabled without verified permission.

Exact next action: obtain the explicit confirmation required by automatic approval review for ONE existing Free Render metadata-worker deployment from main/f2d47cb, preserving cache, plan, instance count, configuration and secrets; after commit/health verification, deploy the verified Owner API to the exact development project with JWT enabled. No API deployment may precede the compatible worker. No provider request, job endpoint, inventory/Auth/Storage/billing/configuration mutation or Git publication occurred in this checkpoint. The authorization block is not a code defect or failed product test. Earlier dated deployment holds and preflight entries retain historical provenance.

[Deployment evidence](implementation/phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - M72 applied; backend activation preflight

Phase 9 / Unit 6G remains feature_published_runtime_pending. Under the Owner's current step-by-step backend authorization, M72 is APPLIED_VERIFIED on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn as live version 20261010200655. Its archived SQL equals the reviewed file and its original SHA-256 is preserved. M65-M71 source bytes and existing Phase 9 function definitions/ACLs are unchanged.

Rollout order is M72, compatible Render metadata worker, then the Owner Edge API. The old worker's claim RPC has no edition-operation filter and its decoder cannot handle edition_options contexts, so the new API must not enqueue those jobs until the new worker is healthy. No edition jobs exist at this checkpoint. Owner API remains ACTIVE v14; metadata runtime remains bb91428048ca9028c5592cbbc52c982bd6843946. The Owner's explicit stop before Render deployment remains in force.

A fresh ordinary Deno check exposed extensionless imports newly reached by the API. The bounded local correction adds seven .ts suffixes in contracts/metadata.ts and contracts/providerReuse.ts, naming the same existing targets without changing metadata, ranking, cover, authorization or retention behavior. Fresh verification passed Deno check --no-lock, two existing Jest suites / 49 tests, worker build plus 14 structural tests, and whole TypeScript. GPT-6 Luna/max independently APPROVED this bounded correction at 47207b7385ee4ae37e01c48b7dba0738abb53389 and reran the same relevant gates, including emitted CommonJS import checks. The atomic non-force push succeeded and both GitHub main/codex/edition-picker read back at that reviewed source commit. Fresh source CI run 38083807305 completed SUCCESS: full repository test, TypeScript and production web-export steps passed. Fresh CI counts were not independently recounted because log download returned HTTP 403; local 49/49 and structural 14/14 counts are separately verified.

Exact next action: obtain the Owner's final Render decision, then perform one controlled manual deployment of reviewed/published source 47207b7 to the existing Free metadata service; verify its commit and health before deploying the prepared Owner API bundle with verify_jwt=true. The explicit Render hold keeps both runtime deployments unperformed at this checkpoint. Provider-result retention remains disabled without verified permission; registry flags and cache headers are not authorization. No Edge or Render runtime deployment, provider request, inventory/Auth/Storage/configuration/billing change occurred. [Exact application, rollout, artifacts and verification evidence](implementation/phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md). Earlier dated records below are historical.

## 2026-10-11 - Edition picker published; development runtime pending

Phase 9 / Unit 6G remains active; current status is feature_published_runtime_pending. GPT-6 Luna/max APPROVED the bounded returned-stale correction and the updated aggregate pre-push feature at de97beda6e4253cdb14369bf29bb6c6ff3429a24. The Owner-authorized atomic non-force push succeeded and remote readback verified both GitHub main and codex/edition-picker at that commit. All seven local edition-picker commits and their earlier main ancestry are included; the separate Desktop Unit 6I work is excluded.

Owner authorized local M72 creation by replying "Yes, create the local M72 correction": 20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql remains CREATED_LOCAL / NOT_APPLIED with its original hash. Independent correction checks passed: 104 SQL tests (eight through M72), six Jest suites / 124 tests, whole TypeScript, worker build/14 structural checks, continuity, syntax and whitespace. Prior CHANGES_REQUIRED findings and their corrections retain their historical provenance. The earlier full merged Jest result of 337 suites / 3,293 tests with four existing pending predates M72. Fresh GitHub validation for reviewed de97bed passed: 337 suites / 3,296 tests, one skipped suite and four skipped tests, TypeScript and production web export. This is fresh CI evidence after M72, distinct from the earlier local full run.

Next checkpoint: report the backend activation preflight for the Owner's decision on shared M72 application and coordinated compatible runtimes. M72 application still requires separate Owner authorization; Render deployment remains on the explicit hold and provider-result retention stays disabled. M65–M71 remain applied/byte-preserved. The Supabase Owner API is still v14 and Render metadata runtime still bb91428. No shared database/Storage/provider/configuration/plan/deployment mutation occurred during Git publication. [Publication, review, migration ledger, warning audit and limits](implementation/phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md). Earlier dated records are historical.

## 2026-10-10 - Owner-authorized feature publication and development backend rollout

Phase 9 / Unit 6G remains active; Tasks 1-8 retain their recorded local approval and verification boundaries. The Owner explicitly authorized committing this edition-picker work, a GPT-6 Luna review at max before pushing, bounded corrections of confirmed findings followed by correction review, publication to GitHub main after approval, and compatible development backend rollout.

The separate Desktop Unit 6I checkout remains outside this publication. All nine baseline commits are already in main at 6e8848e82b47538f67962f0e34238d0017707711. The feature must integrate that current main without dropping its later work. M65-M71 source bytes remain immutable; their recorded shared application is not permission to reapply migrations.

Current work unit: local publication preflight and pre-push review. Exact next action: commit the feature snapshot, integrate current main, then perform the requested read-only subagent review and verification before publication. Runtime rollout follows approval/publication; new provider-result retention remains disabled until independently verified permission is available. No feature publication, deployment, or new shared database mutation is claimed at this checkpoint.

See the [publication and deployment record](implementation/phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md) for fresh checks, review findings, corrections, exact commits and service readback. Earlier dated handoffs retain historical provenance.

## 2026-10-10 - Phase 9 local UI check exposes development runtime gap

Phase 9 / Unit 6G remains active and edition_picker_m71_applied_runtime_pending. The Owner's pre-publication browser check rendered the edition-picker frontend from the correct worktree. Opening Change edition showed the metadata sheet, but its saved edition-choice reader failed. Supabase MCP verified the development phase9-owner-ingestion function is ACTIVE version 14 and its deployed source lacks the edition-picker actions used by the local client. The UI therefore did not render edition rows, covers, publication dates, or Search Books, and selection remains unverified. Full browser/bundle/function evidence is in the [Phase 9 local preview record](implementation/phase-9-image-inventory/trackers/35-owner-edition-picker-local-web-preview.md).

Exact next action: Owner decision on Git publication and compatible development Edge deployment, then repeat browser feature verification. No Git publication, deployment, provider request, or business-data mutation occurred in this check; M65-M71 remain applied as previously verified.

## 2026-10-10 - M71 applied; local browser inspection next

Current status: edition_picker_m71_applied_runtime_pending.
Phase 9 / Unit 6G baseline complete; Task 8 LOCAL approval retained.
Bounded M71 read-only correction review APPROVED in this chat.
M65-M71 are APPLIED / catalog-verified on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn; M71 live version 20261010110835.
Only the private selection delegate changed; wrapper, permissions, other Phase 9 functions and business counts are preserved.
[Preflight, application ledger and verification](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md).
Codex browser page reading and banner-dismissal clicking now PASS; feature UI/device checks remain unrun.
Next authorized action: inspect the local feature app's compact/full scan UI before Git publication.
Compatible Edge/worker deployment and verified provider retention permission remain pending.
This request applied M71 only. No staging, commit, push, merge, deployment, provider/Storage or business-data mutation.
Earlier dated NOT_APPLIED/review/browser-blocked entries are historical; this entry owns current status.

## 2026-10-10 - Unknown-language selection correction checkpoint

Phase 9 / Unit 6G baseline complete; Task 8 LOCAL approval retained. The Owner
supplied independent UI-correction approval and authorized the bounded backend
unknown-language eligibility correction, local regressions and ONE forward M71.
[Cause, preflight, migration ledger and correction evidence](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md).
M65-M70 remain APPLIED / byte-preserved. M71 is CREATED_LOCAL / NOT_APPLIED.
Active work unit: selection-eligibility correction checkpoint. Exact next action:
read-only correction review after local verification, before separate application.
UI/cover/ranking/retention and selling-field preservation remain unchanged.
Runtime deployment, provider permission, browser/device and rollout gates remain
pending. No live writes, provider/browser action, configuration/deployment or Git
publication occurred. Earlier dated handoffs below retain historical provenance.

## 2026-10-10 - Bounded UI review corrections

Phase 9 / Unit 6G baseline complete; prior Task 8 local approval retained.
The Owner authorized only three bounded UI corrections and mounted regressions:
pending Close/back through reconciliation, current-version detected details,
and a polite empty-result announcement. [Correction evidence](implementation/phase-9-image-inventory/trackers/32-owner-edition-picker-task7-ui-evidence.md)
records exact scope, RED/GREEN, tests and limits. Cover/ranking and backend contracts
remain unchanged; the unknown-language selection mismatch is a separate backend item.
Active work unit: bounded UI correction review checkpoint. Next authorized action:
independent read-only review of these corrections. Browser/runtime/provider gates
remain pending; no independent correction approval or operational readiness claimed.
No database/Storage/provider/browser/build/server/migration/deployment or Git
publication action occurred. Earlier dated status/evidence below is historical.

## 2026-10-09 - Tracked preview restored; browser comparison pending

Fresh checks found the previous preview stopped; its exit cause is unknown.
The existing feature checkout now serves home, scan and bundle with HTTP 200
under PID 14844 / tracked terminal session 88962, with verified source
provenance. [Evidence](implementation/phase-9-image-inventory/trackers/35-owner-edition-picker-local-web-preview.md) distinguishes delivery from browser proof.
The Owner reports a login page opening; this chat's browser connection still
times out before page access. Another Codex setup working does not establish
this environment's cause. Next: compare that setup and actual browser-control
capability, then inspect the existing preview through a working connection.
No product-source edit, business-data write or publication/deployment occurred.
Local approvals and applied migrations remain unchanged; product tests were
not rerun. Status remains local_web_bundle_verified_browser_runtime_blocked.

## 2026-10-09 - Restart verification; browser sandbox failure persists

The Owner's full app restart was checked. Browser initialization still fails,
and fresh sandbox logs report Windows error 32 on the Codex runtime executable.
The stopped preview was restored under PID 7016; scan HTML and the complete
edition-picker bundle returned HTTP 200 with correct source provenance.
[Restart evidence](implementation/phase-9-image-inventory/trackers/35-owner-edition-picker-local-web-preview.md) records the cold-start checks and their limits.
No browser login/visual PASS, product-source edit, business-data write,
publication or deployment occurred; product tests were not rerun.
Status remains local_web_bundle_verified_browser_runtime_blocked.
Next: diagnose the recurring sandbox permission refresh failure, then inspect
the local scan UI after browser startup succeeds. Prior local approvals,
applied migrations and the preview-first deployment boundary are unchanged.

# DOC-13: Implementation Tracker

## 2026-10-09 - Local preview before Git publication

**Status:** `local_web_bundle_verified_browser_runtime_blocked`.
Phase 9 / Unit 6G baseline complete; Task 8 independently APPROVED locally.
M65-M70 remain APPLIED / catalog-verified; no migration was reapplied.
The Owner chose local UI inspection before committing, pushing or deploying.
[Preview/runtime evidence](implementation/phase-9-image-inventory/trackers/35-owner-edition-picker-local-web-preview.md) records the corrected
worktree-only application bundle (HTTP 200), successful test Auth checks,
and the Codex browser startup failure. No browser interaction PASS is claimed.
Compatible deployed Edge/worker code and provider retention permission remain
pending. Only authorized Auth request/verification calls changed external state;
no inventory, Storage, provider, deployment or Git-publication mutation occurred.

Exact next authorized action: restore Codex browser control and inspect the
local scan UI with the supplied test login before Git publication/deployment.
Earlier dated entries preserve their historical scope and approval provenance.

## 2026-10-09 - Task 8 independent approval and M65-M70 applied

Phase 9 / completed Unit 6G baseline. Task 8's bounded LOCAL checkpoint is
independently APPROVED; all eight tasks have local implementation/verification
evidence. [Review provenance](implementation/phase-9-image-inventory/trackers/33-owner-edition-picker-task8-local-verification.md)
preserves earlier approval provenance and the unavailable historical 152-path
audit baseline.

**Status:** `task8_independently_approved_m65_m70_applied_runtime_pending`.
The Owner authorized steps 1-3: approval documentation, live preflight and the
six unchanged migrations. All M65-M70 are now APPLIED / catalog-verified on
Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn. [Application ledger](implementation/phase-9-image-inventory/trackers/34-owner-edition-picker-m65-m70-application.md)
records six live versions, exact source/archive hashes, function/ACL/RLS/index/
trigger readback, unchanged business counts, recovery and advisor deltas.

No Edge/worker/client deployment, registry/configuration change, provider call,
browser test, data deletion, staging, commit or push occurred. New alternatives
retention remains disabled/unverified; existing automatic provider flags remain
unchanged. Runtime/provider/browser/operational rollout gates stay pending.

Exact next action: Owner review/authorization for compatible development
Edge/worker/client rollout and provider-gated browser verification (step 4).
Earlier dated entries below retain their historical NOT_APPLIED status and
review provenance; this latest entry owns current application status.

## 2026-10-09 - Task 8 local verification review checkpoint

Phase 9 / completed Unit 6G baseline; Tasks 1-7 locally implemented.
Task 6 and Task 7's bounded corrections retain independent APPROVED provenance.
**Status:** `task8_locally_verified_pending_independent_review`.
**Active work unit:** Task 8 LOCAL verification review checkpoint.
The Owner supplied the previously pending local authorization.
[Task 8 evidence](implementation/phase-9-image-inventory/trackers/33-owner-edition-picker-task8-local-verification.md) records 17 native PostgreSQL checks /
11 lock overlaps, exact Task 7 23 suites / 349 tests, provider/worker/contract
13 suites / 365 tests, 187 scoped SQL cases, build / 14 structural cases,
strict types, teardown and the 19-ACTIVE-ID evidence matrix.
Mocked UI requests, fixture SQL and real native locks are labelled separately.

**Exact next authorized action:** independent read-only review of Task 8's
local test, harness and verification-documentation diff. No Task 8 independent
approval or full operational completion is claimed. Remaining browser/device,
configured-provider permission, live migration/runtime, security/cleanup and
lookup/UI disablement/rollback/rollout gates are separately authorized.
M65-M70 remain unchanged / CREATED_LOCAL / NOT_APPLIED to the shared service;
production retention stays disabled. Only disposable local database/cluster
mutations occurred. No shared database/Storage/provider/deployed-worker mutation,
staging, commit, push or deployment occurred. No product requirement changed.
Earlier dated entries below retain their historical scope and review provenance.

## 2026-10-09 - Task 7 correction review approved

Phase 9 / completed Unit 6G baseline; Task 6 independently APPROVED.
**Status:** task7_corrections_independently_approved_task8_authorization_pending.
The Owner supplied an independent read-only APPROVED verdict for the bounded
Task 7 corrections: matched-details preserves edition_option/selection reference;
detected-details resets replacement identity confirmations while preserving
selling values and ordinary metadata-only manual switching.

[Independent correction-review evidence](implementation/phase-9-image-inventory/trackers/32-owner-edition-picker-task7-ui-evidence.md#2026-10-09---task-7-correction-review-approved) records the independently
rerun 23 suites / 349 tests, strict TypeScript, continuity and diff checks.
Save assertions capture outgoing mocked-service requests, not successful server
persistence. Browser/device/provider and independent-connection PostgreSQL
proof remain Task 8 gates.

Exact next action: separate Owner authorization for Task 8 local integrated
acceptance proof and independent-connection PostgreSQL checks. Task 8 is
unstarted. Live migration/runtime/browser/provider enablement and Git
publication remain separately authorized. M65-M70 remain byte-preserved /
NOT_APPLIED; production retention is disabled. This session changes handoff
documentation only; product tests are not rerun. No database/Storage/provider
mutation, staging, commit, push, deployment or application occurred.
Earlier dated entries below retain their historical scope and evidence.

## 2026-10-09 - Task 7 bounded review corrections

Phase 9 / completed Unit 6G baseline; Task 6 independently APPROVED.
The independent Task 7 review returned CHANGES_REQUIRED (two P2 findings);
the Owner explicitly authorized these bounded local corrections.
**Status:** task7_corrections_locally_verified_pending_review.
The full-review matched-details control preserves an existing edition_option
choice; detected-details replacement resets title/author confirmations to the
replacement identity, while metadata-only manual switching preserves them.
Existing picker §§6-7 / EP-AC19, Review SDD §5 and Master MAS-18 own the fixes;
no requirement, server authority, schema or acceptance criterion is added.
Fresh recorded Task 7 Jest gate: 23 suites / 349 tests PASS, exit 0.
Exact next authorized action: independent read-only review of the two bounded
corrections and their regression evidence. Correction approval is not claimed.
Task 8 remains unstarted. M65-M70 remain byte-preserved / NOT_APPLIED; production
provider retention stays disabled. No database/Storage/provider mutation,
staging, commit, push, deployment or migration application occurred.
Earlier dated entries below retain their historical evidence.


## 2026-10-09 - Task 7 local UI completion; independent review pending

Phase 9 / completed Unit 6G baseline; Task 6 independently APPROVED.
**Status:** `task7_locally_implemented_verified_pending_independent_review`.
**Active work unit:** Task 7 local UI review checkpoint.
The explicit Owner request authorized this implementation in the existing
edition-picker worktree. The real compact card and older/full correction route
now open the existing sheet, preserve current choice/one cover and selling edits,
render original Google Books positions, and use the Task 6 server selection and
existing Save/Add slot. Fresh resume and Add all use the confirmed held choice;
no selling review or server readiness is manufactured by selection/read.

Fresh local code gates: 23 Jest suites / 345 tests PASS, exit 0; TypeScript
`--noEmit --allowImportingTsExtensions` PASS, exit 0. [Exact scope, RED/GREEN,
bounded self-review, continuity/hash closeout and limits](implementation/phase-9-image-inventory/trackers/32-owner-edition-picker-task7-ui-evidence.md) belong
to Task 7; no independent approval or browser/live/full-feature acceptance is
claimed. Existing DOC-3 §§5.2/6, DOC-4 §§9-11, DOC-8 §5, picker §§3/6-7/13.2,
EP-D02/03/04/07/14 and Unit 6G §§11-14 own the implementation. No new requirement,
server contract, backend/worker behavior or schema is introduced.

**Exact next authorized action:** independent read-only Task 7 review of this
local modified/untracked checkpoint and mounted flow. Task 8 is unstarted.
M65-M70 remain CREATED_LOCAL / NOT_APPLIED and byte-preserved; production provider
retention remains disabled. Database/Storage/provider/browser mutation authority:
none. Nothing was staged, committed, pushed, deployed or applied. Earlier dated
entries below are historical.

## 2026-10-08 - Task 7 explicit local authorization

Phase 9 / completed Unit 6G baseline; Task 6 independently APPROVED.
Current status: `task7_authorized_in_progress`. The Owner's explicit Task 7
request supersedes the earlier authorization-pending handoff. Active work unit
and next authorized action: implement metadata-sheet display and interaction
in the existing mounted scan/review flow, under picker SDD §§3/13.2 and
EP-D02/03/04/07/14, with relevant local tests and continuity updates.
M65-M70 checkpoint hashes match; all remain CREATED_LOCAL / NOT_APPLIED.
No backend, worker, server-contract or SQL edits, migration creation/application,
live database/Storage/provider/browser action, deployment or Git publication
are authorized. Task 8 remains pending. Stop after local verification and
bounded self-review, pending independent read-only Task 7 review.
Earlier dated handoffs below are historical.

## 2026-10-08 - Task 6 independent review approved

Phase 9 / completed Unit 6G baseline. Current status:
`task6_independently_approved_task7_authorization_pending`.
The Owner supplied an independent read-only APPROVED review of the final
local Task 6 checkpoint, including M70, strict DTOs, selection replay,
full/compact resume, script preservation and single/bulk Add recovery.

[Independent review evidence](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-6-independent-review-approved) records the separately
rerun 387 Jest tests, 20 M70 plus 32 historical M69 SQL cases, strict
TypeScript, worker build/14 structural checks, continuity and hash checks.
This handoff session changes documentation only; product tests are not rerun.
M65-M70 remain CREATED_LOCAL / NOT_APPLIED; production retention is disabled.

Exact next action: separate Owner authorization for Task 7, Metadata-sheet
display and interaction. Tasks 7-8 remain pending. This review does not
authorize new implementation, live application, deployment or Git publication.
No database/Storage/provider mutation, staging, commit, push or deployment
occurred. Earlier dated entries below are historical.

## 2026-10-08 - Task 6 confirmation correction local completion

Phase 9 / completed Unit 6G baseline. Current status:
`task6_locally_complete_pending_review`. The Owner authorized completion of the
bounded backend/shared-DTO/client correction and separately authorized local
M70 creation. Task 6's required current-suggestion/no-review resume gap is closed
locally: the server reports confirmedByOwner from valid held choice authority;
full/compact drafts preserve the chosen identity and selling values. Superseded
selection receipts cannot adopt a choice, including when a reread is unavailable.

Fresh gates: 22 Jest suites / 387 tests; 20 full-stack M70 SQL cases plus 32
historical M69 cases; strict TypeScript; worker build and 14 structural cases.
[Correction evidence](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-6-confirmation-correction-local-completion) records exact scope, provenance and evidence limits.
M65-M69 are unchanged; M65-M70 remain CREATED_LOCAL / NOT_APPLIED.
Production retention remains disabled. No live database/Storage/provider mutation,
staging, commit, push or deployment occurred. Independent approval is not claimed.
Exact next authorized action: review the completed Task 6 correction and local
M70 checkpoint. Tasks 7-8 remain pending separate Owner authorization.
Earlier dated entries below are historical; this entry owns the current handoff.

## 2026-10-08 - Independent Task 6 review and bounded corrections

Phase 9 / completed Unit 6G baseline; status remains
`task6_client_checkpoint_contract_gap`. Independent review confirmed and
locally corrected two P2 client defects: coherent null/different-script resume
and release of the uncertainty guard after authoritative single/bulk Add replay
rejection. Existing DOC-3 §5.2, DOC-4 §11, DOC-8 §5, picker §§6-7 /
EP-AC11/19 and Unit 6G §§11-14 own these corrections; no requirement is added.

[Review and verification evidence](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---independent-task-6-review-and-bounded-client-corrections)
records RED/GREEN and final gate readback. The original checkpoint required
changes; correction acceptance is local only. Overall Task 6 remains INCOMPLETE
because current_suggestion/no-review fresh resume lacks a server confirmation
discriminator. Exact next action: Owner review of the corrected checkpoint and
separate authorization of the bounded server/strict-DTO correction. No migration
creation/edit/application, external mutation, Task 7 UI, Task 8 live/race work
or Git publication occurred. M65-M69 hashes match and remain NOT_APPLIED.
Earlier entries below are historical.


## 2026-10-08 - Task 6 client review checkpoint and confirmation gap

Phase 9 / completed Unit 6G baseline. Current status:
task6_client_checkpoint_contract_gap. Task 6 local client implementation is at
the review checkpoint; **Task 6 is incomplete** because a controlled
current_suggestion saved before the first selling review cannot be distinguished
from an automatic suggestion by the existing read DTO.

The Owner's supplied APPROVED bounded Task 5 correction **self-review** is
accepted handoff evidence; it is not independent approval. Its supplied 32/32
SQL cases, four boundary/security probes and diff check are separate from this
session's client checks. Branch/HEAD and all M65-M69 hashes match that checkpoint.

Authority remains local Task 6 code, tests and documentation only. M65-M69 remain
NOT_APPLIED and byte-preserved. No migration creation/edit/application, live
database/Storage/provider action, environment change, deployment, staging,
commit or push occurred. Tasks 7-8 remain pending separate Owner authorization.

Exact next authorized action: review the Task 6 client diff and the narrow
confirmation-discriminant correction proposal. A backend/strict-DTO correction
requires separate Owner authorization under the current request; do not start
Task 7 or claim full feature acceptance. Earlier checkpoints below are historical.

[Task 6 evidence and limits](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-6-client-review-checkpoint-and-confirmation-gap).


## 2026-10-08 - Task 6 explicit local authorization

Phase 9 / Unit 6G remains the current phase / completed baseline. Current status:
task6_authorized_in_progress. Active work unit / exact next authorized action:
implement Task 6 client services, versions, selling drafts and shared Save/Add
integration under picker SDD §§3/6-7 and Unit 6G §§11-14; stop at its review
checkpoint. Tasks 7-8 remain pending separate Owner authorization.

The Owner supplied an APPROVED bounded Task 5 correction **self-review** and
accepted it for this handoff; no independent correction approval is claimed.
Supplied verification: 32/32 Task 5 SQL cases, four boundary/security probes and
git diff --check; no actionable findings or changed files. Jest, TypeScript and
worker gates were not rerun by that review. This session verified branch
codex/edition-picker, HEAD ee3a8c79429ca401d468861f2861721082ba955e and M65-M69
against the recorded checkpoint; M69 is
008F9EBB8CDF3288053B10FFCF2A50DB36D96807A0B42787D89339EAE79E0CDE.
The old 23CFDE75 hash is historical. All five remain NOT_APPLIED.

Authority covers local Task 6 code/tests/documentation only. No migration
creation/edit/application, live DB/Storage/provider action, environment change,
deployment, staging, commit or push. Fresh-resume confirmation of a controlled
current_suggestion saved before its first selling review is indistinguishable
in existing DTOs; demonstrate and record that narrow gap without changing
backend contracts. Real connection races remain Task 8.
Earlier checkpoints below are historical.

## 2026-10-08 - Task 5 independent-review correction

- Current phase / completed baseline: Phase 9 / Unit 6G. Current status: task5_correction_locally_verified_pending_review. Active work unit: Task 5 correction-review checkpoint.
- The independent Task 5 review returned CHANGES_REQUIRED (one P2). The Owner authorized the bounded correction. Revised local M69 now projects the valid durable choice before the first review save; missing review still blocks Add. No independent correction approval is claimed.
- Fresh proof: two clean behavioral RED failures; corrected Task 5 32/32 SQL cases and final nearest commit/cover/lifecycle gate 54/54 PASS. New helper security readback passes. Earlier 194 SQL / 406 Jest / TypeScript / worker-build/14 structural evidence belongs to the preceding review, not a fresh correction rerun.
- M69 remains CREATED_LOCAL / NOT_APPLIED; M65-M68 and other historical SQL are byte-preserved. No live DB/Storage/provider action, migration application, environment change, deployment or Git publication. Client/UI and real independent-connection races remain deferred; Tasks 6-8 are unstarted.
- Exact next authorized action: review only the bounded Task 5 correction and its regression evidence. Task 6 and live application require separate authorization. Detailed proof and current hash: [implementation evidence](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-5-independent-review-correction).

Earlier checkpoints below are historical.

## 2026-10-08 - Edition-picker Task 5 local completion

- Current phase / completed baseline: Phase 9 / Unit 6G. Current status: task5_locally_verified_pending_review. Active work unit: Task 5 exact-selection Add and lifecycle cleanup review checkpoint.
- Owner authority: the pasted Task 5 request authorizes Task 5 local backend implementation, tests, documentation and one forward local migration after project/schema/filename preflight. Local M69 is CREATED_LOCAL / NOT_APPLIED. No migration application, deployment or Git publication is authorized.
- Completed: existing versioned Add materializes the saved server selection, preserves selling fields and creates one private row per candidate; effective-choice cover gating, atomic per-card clearing, lost-response replay, readiness/detail/compact projection and bounded cleanup through the existing minute dispatcher.
- Fresh local proof: 194/194 disposable SQL cases (30 new Task 5 + 164 existing compatibility/security cases), seven affected Jest suites / 406 tests, strict affected server/test graph TypeScript, metadata worker build and 14/14 structural cases PASS. Final documentation/diff gate evidence is recorded in the implementation tracker.
- Review provenance: Task 2 corrections retain independent approval; Task 3 retains Owner-accepted self-review; Task 4 retains Owner-requested corrected self-review, with no independent correction approval claimed. Task 5 awaits review. Tasks 6-8 remain unstarted and require separate Owner authorization.
- Database / external state: fresh read-only MCP verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY, live Phase 9 M62 / 20260913162154 and unrelated overall tail clubs_admin_primary_venue / 20261007144356. Picker state/completion are absent live. M65-M68 and all historical SQL bytes are preserved; M65-M69 remain NOT_APPLIED.
- Limitations: SQL sequencing uses disposable PGlite; independent-connection races remain Task 8. Compatible client/UI and controlled enablement remain later tasks. Production still has no independent retention verifier. No live provider/browser/deployed-worker test, database/Storage write, environment change, staging, commit, push or deployment occurred.
- Exact next authorized action: Owner review of the Task 5 diff and recorded local verification evidence. Task 6 implementation needs separate authorization.

Earlier dated checkpoints below are historical.

## 2026-10-08 - Task 4 timestamp correction and self-review

Phase 9 / Unit 6G; status task4_locally_verified_self_review_complete. Owner-requested self-review found a remaining timestamp-validation P2; the Owner then authorized "fix it". M68 now rejects PostgreSQL-only era/ordinal dates and leap-second timestamps on all non-null option rows, while normalized ISO UTC and offset timestamps remain supported.

Fresh local proof: 10 timestamp cases (six rejection regressions, four valid controls); 87 completion/security/worker SQL cases; 264 Jest tests; 14 structural cases; strict graph/bootstrap TypeScript and worker build PASS. SQL proof uses disposable PGlite; real multi-connection races and live retention remain later gates.

Only M68 and its existing correction integration suite changed as production/test files. M65-M67 are byte-preserved; M65-M68 remain NOT_APPLIED. Self-review is complete; independent correction approval is not claimed. Tasks 5-8 remain unstarted. Exact next action: Owner authorization for Task 5, Exact-selection Add and lifecycle cleanup. No live service mutation, migration application, deployment or Git publication.

Earlier checkpoints below are historical.


## 2026-10-08 - Edition-picker Task 4 review corrections

- Current phase / completed baseline: Phase 9 / Unit 6G. Status: task4_locally_verified_pending_review. Active work unit: corrected Task 4 worker/SQL completion checkpoint; Tasks 5-8 remain unstarted.
- Two independent reviews returned CHANGES_REQUIRED, with three unique P2 findings (the language mismatch is shared). All three were reproduced and corrected locally; correction review is still pending. Task 3 remains Owner-accepted self-review, not independently APPROVED; Task 2's correction approval is preserved.
- Corrections: unknown query language permits an otherwise compatible exact validated ISBN; SQL contract rejection reaches the worker as nonretryable schema_invalid after committed-receipt recovery; failure transitions replay from bounded private claim evidence; every non-null option is checked against normalized metadata bounds, versions, timestamp and coherent ISBN identifiers before eligibility.
- M68 adds one nullable private failure_receipt to the existing per-card state. It contains claim/request evidence, hashes and bounded failure arguments, with no metadata, plaintext lease token or authoritative job status. Public signatures, selected metadata and selling authority are unchanged.
- Fresh local proof: 11 Jest suites / 264 tests; 77 completion/security/worker SQL cases (34 existing completion + 7 worker-to-SQL + 36 correction cases); 14 structural SQL cases; 48 existing picker SQL cases; worker build and strict graph/bootstrap TypeScript PASS. Deterministic RED preceded production corrections. No independent-connection race proof is claimed.
- Migration / external authority: the existing authorization covers local Task 4 corrections to M68 and disposable verification. M65-M67 bytes are unchanged; M65-M68 remain NOT_APPLIED. Production still has no retention verifier. No live DB/Storage/provider/browser/deployed-worker mutation, deployment or Git publication occurred.
- Fresh read-only MCP verifies Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY. Latest Phase 9 migration remains M62 / 20260913162154; the overall tail now includes unrelated clubs_admin_primary_venue / 20261007144356. No edition-picker migrations, private state or completion RPC are live.
- Exact next authorized action: independently review the corrected Task 4 diff and regression evidence. Task 5 requires separate Owner authorization after this checkpoint; migration application and rollout remain separately gated.
- Git: codex/edition-picker at ee3a8c79429ca401d468861f2861721082ba955e, exclusive edition-picker-research worktree; 82 changed paths (45 modified / 37 untracked), zero staged. The new path is the legitimate correction integration suite; pre-existing unrelated changes are preserved.

Earlier dated checkpoints describe their historical scope and are superseded for the current handoff.
## 2026-10-07 - Edition-picker Task 4 local completion

- Current phase / completed baseline: Phase 9 / Unit 6G. Current status: task4_locally_verified_pending_review. Task 4 local implementation and required verification are complete; Tasks 5-8 remain unstarted.
- Owner authority: "sure lease proceed" authorized one forward local migration and disposable SQL tests after the reviewed proposal. Task 3 remains Owner-accepted self-review, not independently APPROVED; Task 2's correction approval is preserved.
- Completed: M68 controlled options completion/recovery/failure, purpose-aware egress and physical accounting, private atomic persistence, slim receipts and response-loss recovery. Production installs its typed RPC boundary and still has no retention verifier.
- Fresh proof: 11 scoped Jest suites / 259 tests; strict Task 4 graph and bootstrap types; required metadata build + 14 structural DB cases; 34 completion/security DB cases + 6 worker-to-SQL cases, all PASS.
- Migration / external authority: local M68 is CREATED_LOCAL / NOT_APPLIED; M65-M67 hashes are unchanged / NOT_APPLIED. Supabase MCP verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, ACTIVE_HEALTHY, live tail M62 / 20260913162154. No live DB/Storage/provider/browser/deployed-worker action, deployment, staging, commit or push.
- Active work unit / exact next authorized action: review the Task 4 diff and recorded verification at its checkpoint. The requested independent reviewer returned no verdict because its account usage limit was reached; independent approval is pending. Do not begin Task 5 or apply migrations.
- Git: exclusive edition-picker-research worktree, codex/edition-picker at ee3a8c79429ca401d468861f2861721082ba955e; 81 changed paths (45 modified / 36 untracked), zero staged. Existing unrelated changes are preserved.

Earlier checkpoint entries remain historical. Real independent-connection races, live retention permission, Add/cleanup, client/UI and rollout remain later proof; no full-feature acceptance is claimed.

## 2026-10-07 - Edition-picker Task 4 runtime checkpoint

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Status: task4_runtime_locally_verified_sql_authority_pending. Task 4 is INCOMPLETE: the authorized runtime/tests are verified, but the controlled SQL completion/failure/egress boundary is absent. Tasks 5-8 remain unstarted.
- Owner decision: accepted Task 3 focused self-review and authorized Task 4 without another independent correction review. Task 3 is not independently APPROVED; Task 2's independent correction approval and the historical Task 3 CHANGES_REQUIRED/correction evidence are preserved.
- Active work unit: Task 4 controlled SQL boundary authorization checkpoint.
- Exact next action: Owner review of the concrete Task 4 SQL proposal and separate authorization for one forward local migration file/disposable SQL tests in this worktree; then finish Task 4 only. No migration filename is reserved.
- Completed local scope: v2 automatic/edition_options decoding, explicit winner/cache bypass, Task 3 options invocation, private typed completion/recovery/failure port, result validation, generation/claim/egress fencing, physical accounting, cancellation/retry/replay and fifteen-job/three-active immediate refill. Production installs no completion port or retention verifier and never reports options ready through the legacy automatic path.
- Fresh verification: 9 scoped Jest suites / 237 tests PASS (56 new Task 4 cases); strict Task 4 test/production graph PASS; required structural metadata build + 14 disposable database cases PASS. The existing Node DEP0040 warning remains. Continuity/diff/hashes are recorded in the implementation tracker after final closeout validation.
- SQL/external/Git authority: no migration creation/edit/application, live DB/Storage/provider, browser/deployed worker, deployment, staging, commit or push. M65-M67 remain unchanged / CREATED_LOCAL / NOT_APPLIED.
- Git checkpoint: codex/edition-picker at ee3a8c79429ca401d468861f2861721082ba955e; 73 changed paths (43 modified / 30 untracked), zero staged. Existing unrelated changes are preserved.

Earlier dated entries are historical. Runtime fixtures model the missing SQL port; they do not prove actual durable explicit completion, real races, live retention permission, Add/cleanup, client/UI or rollout.


## 2026-10-07 - Edition-picker Task 4 authorization

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Owner decision: accepts Task 3's focused self-review and authorizes Task 4 without another independent correction review. Task 3 is not independently APPROVED; the historical CHANGES_REQUIRED verdict and local corrections remain recorded.
- Current status: task4_authorized_in_progress; Tasks 1-3 locally implemented; Task 2 correction review independently APPROVED. Tasks 5-8 remain pending.
- Active work unit / next authorized action: Task 4 only, on-demand edition lookup worker execution and controlled completion, under picker SDD §§4.1-4.3/5/9 and the existing execution plan.
- Authority: local Task 4 code/tests/documentation and recorded-fixture/disposable tests only. No migration-file creation/edit, application, live database/Storage mutation, live provider call, deployed worker, browser test, deployment, staging, commit or push.
- Gate found during inspection: M65-M67 contain no controlled options-completion boundary. The public M38 wrapper correctly restores v2 and physical-claim fields over M67; legacy failure/finalization paths still assume automatic processing. Finish independent authorized runtime/test work and present a concrete forward SQL proposal for separate local-file authority. Do not claim durable completion.
- Git: codex/edition-picker at ee3a8c79429ca401d468861f2861721082ba955e; 60 initial changed paths, zero staged. Preserve existing changes. M65-M67 remain CREATED_LOCAL / NOT_APPLIED and unchanged.
- Evidence reuse: the Owner reports unchanged-worktree focused self-review and 136/136 provider/options/automatic tests; prior strict types/build/continuity/diff evidence is historical until rerun here.

Earlier dated entries are historical. Production installs no retention verifier; verified permission and a valid deadline remain mandatory before any retention.

## 2026-10-07 - Edition-picker Task 3 review corrections

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: task3_corrections_locally_verified_pending_review. Tasks 1–2 remain locally complete; Task 2's independent correction review remains APPROVED. The supplied Task 3 review is CHANGES_REQUIRED; both P1 findings were confirmed and fixed locally, with independent correction review still pending.
- Active work unit: Task 3 correction-review checkpoint, within the existing provider code/test/documentation scope.
- Completed corrections: safely decoded observed-ISBN conflicts are counted before eligibility filtering; Expires-only freshness applies Date/Age. No new product requirement or later-task implementation.
- Fresh checks: 15 new regression cases reproduced 9 failures and 6 passing controls before production edits. The final four-suite command passed 136/136; strict types and metadata worker build passed.
- Exact next authorized action: independent correction-only review of the Task 3 diff/evidence. Tasks 4–8 remain pending; Task 4 worker execution/completion awaits separate Owner authorization.
- Database authority: no new audit, migration creation/edit/application or database/Storage mutation. M65–M67 remain unchanged, CREATED_LOCAL / NOT_APPLIED.
- Git/external state: codex/edition-picker at ee3a8c7; all work remains uncommitted and unstaged. No live provider/browser request, worker execution, deployment, environment change, commit or push.

Production still installs no retention verifier. Header evidence only bounds independently verified permission; live retention and later integration/rollout proof remain gated. Earlier dated entries are historical.

Detailed evidence: [Task 3 corrections](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-3-review-corrections).

## 2026-10-07 - Edition-picker Task 3 local completion

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: task3_locally_complete; Tasks 1–3 are locally complete. Task 2's independent correction review remains APPROVED; Task 3 awaits its own checkpoint review. Tasks 4–8 are pending.
- Active work unit: Task 3 review checkpoint, Google result envelope, safety and eligibility.
- Owner authority: the pasted request explicitly authorized Task 3 local code, tests and documentation, superseding the prior awaiting-authorization handoff.
- Completed: one bounded relevance response; original positions/duplicate IDs; safe own-result metadata/links; disabled incompatible rows; unavailable placeholders; ISBN versus confirmation-required evidence; original-fetch retention cap and fail-closed provider evidence.
- Exact next authorized action: review the Task 3 diff and evidence. Task 4 on-demand worker execution/completion is the next implementation slice, awaiting separate Owner authorization.
- Database authority: none in Task 3. M65–M67 remain CREATED_LOCAL / NOT_APPLIED and their bytes are unchanged; no new audit or migration creation/edit/application occurred.
- Git/external state: codex/edition-picker at ee3a8c7; changes remain uncommitted and unstaged. No deployment, live provider/browser request, database/Storage write, environment change, staging, commit or push.

Fresh Task 3 checks: required adapter/options Jest 2 suites / 98 tests PASS; affected provider-outcome Jest 23/23 PASS; strict Task 3 test/production graph type check PASS; metadata worker build PASS. Live provider permission remains an enablement gate: production bootstrap installs no retention verifier, and headers/fixtures/registry/client flags cannot grant permission. Worker completion, Add/cleanup, client/UI, real races and rollout remain later tasks. Earlier dated checkpoints are historical; their reviewer-reported results were not rerun as Task 3 evidence.

Detailed evidence: [implementation tracker](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-3-local-completion).

## 2026-10-07 - Edition-picker Task 2 correction review approved

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: Tasks 1 and 2 locally complete; the supplied independent correction review is APPROVED. Tasks 3–8 remain pending.
- Active work unit: Task 3 authorization checkpoint; Task 3 implementation has not started.
- Review result: all three findings resolved; no new actionable finding or product decision.
- Next action: Owner authorization for Task 3 Google result envelope, safety and eligibility; do not infer implementation authority from the reviewer verdict.
- Database authority: M65–M67 remain CREATED_LOCAL / NOT_APPLIED. This handoff update performs no new database audit or mutation.
- Git/external state: codex/edition-picker at ee3a8c7; all changes remain uncommitted and unstaged. No migration application, deployment, provider/browser request, live DB/Storage write, commit or push.

The reviewer reports 48/48 disposable database cases, six Jest suites / 368 tests and git diff --check PASS. This session records that external evidence without claiming to rerun product tests. Full feature and operational proof remain pending. Earlier dated checkpoints are historical.

Detailed review provenance and limitations: [implementation evidence](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-correction-review-approved).

## 2026-10-07 - Edition-picker Task 2 review corrections

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: task2_locally_complete after the authorized review corrections; Task 1 remains complete and Tasks 3–8 remain pending.
- Active work unit: Task 2 review-correction checkpoint.
- Owner authority: “ok then proceed to fix them please,” followed by confirmation of all three findings before fixing.
- Completed: reusable canonical metadata validation, a unique exact text suggestion with confirmation-required evidence, ambiguity rejection, and corrected plan authority/next-action text.
- Exact next authorized action: review the corrected Task 2 diff/evidence; Task 3 Google result envelope remains the next implementation slice after Owner authorization.
- Database authority: M65/M67 revised locally; M66 unchanged; M65–M67 remain CREATED_LOCAL / NOT_APPLIED. Fresh read-only MCP confirms Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn and live M62.
- Git: codex/edition-picker at ee3a8c7; all work uncommitted. No staging, commit, push, deployment, provider/browser request or live DB/Storage mutation.

Detailed review reconciliation and fresh proof are in [the implementation evidence](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-review-corrections). Earlier checkpoints are historical; they do not supersede this handoff.

## 2026-10-07 - Edition-picker Task 2 local completion

- Current phase: Phase 9, Image-Assisted Inventory.
- Last completed baseline: Unit 6G; edition-picker Tasks 1 and 2 locally complete.
- Current status: task2_locally_complete; six implementation tasks remain.
- Active work unit: Task 2 checkpoint review.
- Owner authority: “Proceed with the next task” authorized Task 2; “ok proceed” approved local M65–M67 creation and disposable tests.
- Completed: strict authenticated gateway, private state and read/search/select commands, ownership/version/expiry guards, independent chosen snapshot, local ISBN ambiguity correction, lookup-scoped history, and explicit-purpose context/revision fencing.
- Exact next authorized action: review Task 2 diff/evidence. Task 3 Google result envelope is the next implementation slice and awaits Owner authorization.
- Database authority: local M65–M67 created/tested only; NOT_APPLIED. Live migration tail remains M62. No live database/Storage writes or deployment.
- Git: codex/edition-picker at ee3a8c7; all changes uncommitted; nothing staged, committed, or pushed. Main Unit 6I and its M63/M64 remain separate.

Fresh verification: 34 disposable-database tests PASS; affected Owner Jest 4 suites / 303 PASS; strict Owner graph type check PASS. Real multi-connection races, live provider/retention, worker completion, exact-selection Add/cleanup, client/UI/browser and rollout proof remain pending. No full-feature acceptance claim. Earlier dated checkpoints below are historical.


## 2026-10-07 - Edition-picker Task 2 gateway/preflight checkpoint

- Current phase: Phase 9, Image-Assisted Inventory.
- Last completed baseline: Unit 6G; edition-picker Task 1 locally complete.
- Current status: task2_partial_gateway_complete; database implementation pending migration-file authority.
- Active work unit: Task 2 per-card state and controlled Owner commands.
- Owner authority: latest “Proceed with the next task” authorizes Task 2 code/tests and read-only preflight. Tasks 3–8 remain unapproved.
- Completed: strict authenticated read/search/select gateway, bounded errors/response identity/source checks, HTTP routing, and exact-project database preflight.
- Next action: obtain the Owner's answer to the pending local M65–M67 creation question; then implement/test Task 2 database state and commands in this same isolated worktree.
- Database/storage mutation, migration application, deployment and Git publication authority: none. Migration-file creation is a separate AGENTS gate; no files created.

Verification: affected Owner Jest 4 suites / 303 tests PASS; strict Owner server graph type check PASS. Gateway RED was 37 failures/1 pass before implementation. Database integration, real PostgreSQL races, provider/browser/live tests NOT_RUN. Task 2 is not complete and no full feature acceptance is claimed. All changes remain uncommitted; nothing staged/committed/pushed/applied/deployed. Earlier dated entries below are historical checkpoints.

## 2026-10-07 - Edition-picker Task 1 contract checkpoint

- Current phase: Phase 9, Image-Assisted Inventory.
- Last completed baseline: Unit 6G; edition-picker Task 1 is locally complete.
- Planning/implementation status: task1_locally_complete; Tasks 2–8 are pending.
- Active work unit: Task 1 contract checkpoint review.
- Owner authority: the 2026-10-07 instruction explicitly authorized this first task; it supersedes the earlier planning-only handoff for this scope.
- Next authorized action: review the Task 1 diff and evidence before authorizing Task 2 (per-card state/preflight).
- Database/migration/deployment/Git-publication authority: none; creation/application of migrations remains separate.

Affected Jest PASS: eight suites / 368 tests. App TypeScript --noEmit PASS; strict Owner-ingestion graph --noEmit PASS. Metadata worker build PASS; final build/continuity closeout recorded below. Initial 111-test run had 20 expected new-contract failures; projection, admission and draft regressions were separately observed RED before fixes. Whole-repository Jest, live provider, database, browser and operational/security scans NOT_RUN.

Scope: Task 1 only: strict server/client read/request/select DTOs, bounded ordered option rows, own-cover/book-link validation, private-to-public metadata projection, synthetic Google/retention examples, edition_option review compatibility and draft ID serialization. Existing selected/manual behavior remains covered. No lookup handler, options storage, migration, database/Storage write, UI, dependency install, provider request, staging/commit/push or deployment.

[Detailed evidence](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md). Final documentation closeout: PASS: final metadata worker build, Phase 9 continuity (87 Markdown files/62 required/195 existing requirement definitions; zero duplicate/missing traceability), git diff --check, and Task 1 closeout (five completed Task 1 steps; seven remaining tasks unchecked; 32 relative links; 34 modified + 8 untracked files = 22 docs/20 TypeScript files; zero staged; all touched source files ≤350 lines; temporary main-checkout writer removed). Earlier entries below are historical planning checkpoints.


## 2026-10-06 - Owner edition picker branch handoff

Latest Owner display clarification EP-D14: each edition option in the metadata sheet shows its own cover image from its safe URL, title, all authors, and publication date; publisher, ISBN, and language are secondary details. Selection saves the coherent chosen metadata independently and follows the usual inventory Add flow, leaving one chosen cover on the scan card. This supersedes earlier text-only option rows. Owner chose relevance order with returned order preserved and Google attribution/book links. Picker §13.2 now defines Search Books wording and bounded unavailable/ineligible rows; EP-D11/13 scope cuts remain in force.

Readiness result: technical corrections and relevance-order display are consolidated; the written SDD awaits Owner approval. Provider retention evidence and migration preflight remain later gates. Documentation verification is recorded in the implementation tracker.

Latest Owner scope reduction: alternatives are acquired/saved only on explicit request (EP-D13); automatic alternatives capture and shared copying are removed. New manual edition-number editing before/after Add is deferred (EP-D11). Nineteen active planned acceptance checks remain; EP-AC17 is reserved. Provider display §13.2 is resolved; written-SDD approval remains pending. No product or migration implementation has started.

This section is the current handoff for codex/edition-picker only, based on
ee3a8c79429ca401d468861f2861721082ba955e. Older handoff paragraphs below are
historical baseline evidence for this branch; the main checkout's separate
Unit 6I work is not included.

- Current phase: Phase 9, Image-Assisted Inventory.
- Planning status: design_ready_pending_owner_approval.
- Last completed milestone: Unit 6G baseline; the SDD is drafted and its two
  independent reviews reconciled; latest Owner scope cuts are consolidated. All revisions are documentation only.
- Active work unit: Owner edition picker implementation-plan drafting.
- Implementation status: not started.
- Next authorized action: Owner review/approval of the finalized SDD and eight-task plan,
  then authorize local implementation starting with Task 1.
- Gates: written-SDD approval; implementation, migration creation/application, provider rollout,
  deployment, and data deletion require separate authority.
- Supabase mutation authority: none. Exact development project readback was
  read-only; no database/Storage writes occurred.
- No staging, commit, push, or deployment occurred.

[Draft SDD](./implementation/phase-9-image-inventory/work-units/owner-edition-picker-sdd.md). Documentation verification is recorded in the Phase 9 implementation tracker.

Readiness handoff: current scope/display is consolidated; configured-provider retention evidence and full database preflight remain separate from local recorded-fixture work. No new feature scope was inferred and no product implementation started.

2026-10-07 planning handoff: the Owner requested task decomposition. The draft execution plan contains eight tasks: contracts, controlled per-card state, Google envelope, explicit worker, exact-selection Add/cleanup, client state, metadata-sheet UI, and integrated proof. Plan drafting is authorized; product code, migration files/application, and rollout remain unstarted/unapproved. Next coding task after approval: Task 1. Latest plan-document verification: PASS: eight sequential tasks and all nineteen active acceptance owners; fourteen unique decisions/twenty stable acceptance IDs (EP-AC17 deferred); twelve relative SDD/plan links resolve; Phase 9 continuity PASS (87 Markdown files, 62 required, 195 existing requirement definitions, zero duplicate/missing traceability); git diff --check PASS; scope twenty modified Markdown documents plus untracked SDD/plan, zero staged files. Product/security/browser tests NOT_RUN (documentation only).
## 2026-10-10 - Existing inventory baseline published to GitHub main

The Owner authorized integration of the nine existing commits through `ee3a8c7`
into GitHub `main`. The verified merge `618433fc948e5d86d72d3b49d21079bd536f2d77`
was pushed normally and read back at `refs/heads/main`; its first parent is
`2f2f383b14b5818b62682ae5bdd7fa295550ba5b` and second parent is
`ee3a8c79429ca401d468861f2861721082ba955e`. All nine commit identities and the
newer main history are preserved. This publishes the earlier Unit 6G / Store
View baseline; the edition-picker implementation remains separate and uncommitted.
The Desktop Unit 6I work remains excluded and unchanged.

Merged verification passed 318 Jest suites / 2829 tests, with the existing
one skipped suite / four skipped tests, full no-emit TypeScript, Phase 9
continuity (195 definitions; zero duplicate or missing traces), and whitespace
checks. One stale architecture allowlist was corrected under Unit 6G SDD
sections 8/12/14; no additional production behavior was introduced.
[Exact scope and verification](implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-10---existing-inventory-baseline-main-publication).

Phase 9 / Unit 6G remains the active phase/baseline. Existing operational gates
and recorded price-intent / cover-source deviations are retained; this Git
publication is not deployment or live acceptance. No database, Storage,
provider, migration, or manual deployment action occurred. Next action: Owner
decision on committing/publishing the separate edition-picker work.


> **2026-09-28 Git-publication closeout:** The Owner-authorized local work was
> committed as `101e4b6` (Unit 6G code/tests), `ce2d0c5` (Store View
> confirmation), and `9ad1d6e` (Phase 9 specifications/handoff). All three
> were pushed to `origin/codex/phase9-duplicate-confirmation`; read-only remote
> verification returned `9ad1d6e481247b4edb8691262cf45500212f59b7`.
> The push also carried four earlier local documentation commits already on
> this branch. Package files, `.hermes/briefs`, and the line-ending-only test
> remained uncommitted. The two implementation deviations below remain open;
> no deployment or database/Storage mutation occurred.

> **2026-09-28 Phase 9 Git-publication handoff:** The Owner authorized commit
> and direct push of the reviewed local post-scan and Store View work, while
> deferring the two recorded review gaps. Current local verification passed
> 10 affected Jest suites / 158 tests, TypeScript, Phase 9 continuity, and
> `git diff --check`. The price contract still rejects ₹0 with `publish` intent
> before private Add in mobile, Edge, and SQL; the cover thumbnail still lacks
> the SDD's Detected source badge. These are known implementation deviations,
> not completed corrections. No connected-state readback, database/Storage
> mutation, or deployment was performed. The 2026-09-22 connected readback
> remains the latest recorded evidence, not a current-state claim. Next exact
> action after Git publication: Owner decision on these two deviations before
> any deployment or connected proof.

> **2026-09-27 Phase 9 / Unit 6G handoff:** Bounded post-scan corrections A–C
> and the buffered-edit Add guard are locally implemented. Prior local
> implementation reports record 6 suites/116 tests for A–C, then 3 targeted
> suites/77 tests for the final Add guard; those scopes overlap and are not
> additive. TypeScript passed in the prior implementation report. This
> documentation pass reconciles the price contract, source labels, and status
> snapshots; the continuity validator and `git diff --check` passed here, while
> Jest and TypeScript were not rerun. The latest *recorded* connected session
> readback is 2026-09-22
> (two private commits and three candidates in review), not a current-state
> assertion. No connected service was queried or mutated in this local work.
> Next: Owner review of the combined local diff; database, Storage, deployment,
> and Git publication remain separately authorized.

> **2026-09-23 bounded post-scan navigation correction:** The Owner-authorized
> client-only removal of the redundant “Open first book in full review” header
> shortcut is implemented locally. Full correction remains available from each
> candidate card. The red-first focused regression passes **15/15**, TypeScript
> passes, and the open Codex browser confirms the new layout. No database,
> inventory, deployment, staging, commit, push, merge, or PR action occurred.
> Next: Owner review of the local diff and browser; Git publication requires
> separate authorization.

> **2026-09-22 bounded post-scan and initial-Publish correction:** The Owner-
> authorized client-only correction is locally complete. Unchanged normalized
> title/author closes no longer create false Custom state; bulk results now use
> a compact wrapping count hierarchy with whole plural labels; and initial Store
> View Publish now opens an explicit confirmation before the unchanged Unit 7B
> command. The red-first focused run reproduced all three defects; the final
> affected run passes **7 suites / 93 tests**, TypeScript passes, and the Phase
> 9 continuity validator plus `git diff --check` pass with only existing
> size/line-ending advisories. Read-only
> Codex-browser verification confirmed confirmation + Cancel with the item still
> Private, zero false edit markers after unchanged title/author exits, and fully
> reachable compact price/condition/quantity controls. No Add or Publish confirm
> was submitted; no database, Storage, provider, migration, deployment, stage,
> commit, push, merge, or PR occurred. Private-cover projection, edition
> selection, font timeout, and transient Summary/Full Review diagnosis remain
> deferred. Exact next action: Owner review of the local diff and open browser;
> Git publication/deployment requires separate authorization.

> **2026-09-22 connected post-scan bulk-commit audit:** Under explicit Owner
> authority, the development session
> `93567d47-3874-4576-b3b4-1adb044b552b` completed its exact-two bulk Add:
> two candidates are `committed_private`, two private inventory rows exist, and
> three candidates remain in active review. Store View readback preserved the
> entered values. During control testing, `Publish` executed immediately with
> no confirmation; the same tested row was immediately returned to private.
> Final public-listing count is zero, while the immutable public revision and
> publish/private audit history remain. Additional confirmed risks are false
> Custom state after unchanged title/author `Done`, a private Store View cover
> projection gap despite a valid persisted `cover_url`, Expo Font's 6000 ms web
> timeout toast, and transient Summary/Full Review first reads that recovered
> through Retry. No deletion, Storage/provider/migration/deployment, stage,
> commit, push, merge, or PR occurred. Exact next action: Owner disposition of
> bounded Publish-confirmation and no-op-edit corrections; private-cover
> projection and transient-read/font diagnostics remain separately scoped.

> **Historical 2026-09-15 connected-proof snapshot (superseded by the 2026-09-22 connected audit above):** The prior active Owner session
> `LIVE-TEST-20260912-REPRO` was cleaned up through the authenticated UI: all 15
> active candidates were removed from review and the session was closed. Its
> summary recorded 15 detected, 15 removed from scan, and 0 committed
> inventory items. The processed input image remained because accepted candidate
> lineage still blocks input removal. A new session
> `93567d47-3874-4576-b3b4-1adb044b552b` was created, its gallery image was
> registered/uploaded and processed, and 5 candidates were produced. The
> connected review readback at that checkpoint showed 5 detected, 1 ready after one saved review of
> `The Birth of Tragedy` using test values ₹0/Good, 4 still needing review, and
> 0 added to inventory. One private scan-image object was uploaded by the normal
> Owner flow; no Storage deletion occurred. No migration or manual dispatch
> mutation occurred. At that checkpoint, the next action was Owner
> review/correction of the remaining four candidates, followed by separately
> authorized Add actions if desired. This records evidence against Phase 9 Master SDD §6 and
> Extraction/Enrichment SDD §10.
> It is a historical snapshot and does not assert current connected-session state.

> **Historical pre-session-cleanup runtime rollout / proof blocker:** The verified
> development project `ahntbtktjjmvfosgkmgn` has `phase9-owner-ingestion` v14
> active with JWT verification preserved. Render metadata-worker deployment
> `dep-dak2nmjl550s73bqb7jg` is live on reviewed commit
> `bb91428048ca9028c5592cbbc52c982bd6843946`; `/health` and `/ready` both
> returned 200. The local client reached the authenticated Owner scan flow and
> a selected gallery image, but the resolved session was the existing
> `LIVE-TEST-20260912-REPRO` scan with one processed image and 15 candidates,
> so `Upload image` was disabled. No new input, Proceed/Cancel, Add, migration,
> Storage deletion, or dispatch change was performed. The remaining connected
> no-cover proof requires an approved clean Owner session/store or explicit
> authorization to remove the existing image.

> **2026-09-14 M61 warning-privacy correction:** The bounded representative-cover
> persistence warning now logs only `lookupId`, `attemptId`, and the fixed
> `P9_REPRESENTATIVE_COVER_PERSISTENCE_FAILED` code; raw exception text is not
> emitted. The exact focused composition regression passes 1 suite/29 tests,
> and the complete `--runInBand --detectOpenHandles --silent` run passes 303
> suites with one skipped and 2,479 tests with four skipped, exiting normally.
> TypeScript and the Phase 9 continuity validator pass. No metadata
> terminalization, selection, retry, public projection, duplicate behavior,
> migration SQL, external state, deployment, or Git publication changed.

> **2026-09-14 Phase 9 full-Jest correction:** The reported 12 failed suites and
> 17 failed tests are corrected locally without changing production behavior or
> migration SQL. Seven helper/fixture modules are no longer collected as tests;
> the mounted-route and migration contract fixtures now match current runtime
> composition and cross-platform SQL text; and TanStack query/mutation test
> teardown explicitly destroys retained GC timers. The exact reproduction is
> 5 suites/48 tests PASS. The complete `npm.cmd test -- --runInBand` run is 303
> passed suites plus one skipped and 2,479 passed tests plus four skipped (304
> suites/2,483 tests total), exits normally, and the separate
> `--detectOpenHandles --silent` run has the same totals with no persistent
> open-handle/force-exit/one-second non-exit warning. The normal full run still
> emits React `act(...)` warnings in existing UI timer/query/state-update paths,
> the NetInfo dynamic-import fallback warning, and dependency warning `DEP0040`.
> TypeScript and diff hygiene pass. No production source, migration SQL,
> external service, database/Storage, deployment, stage, commit, push, or merge
> changed in this follow-up. Phase 9 remains at
> `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`.

> **2026-09-13 representative-cover rollout closeout:** Exact-project preflight
> reconfirmed `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` healthy, then the
> hash-verified M61 artifact was applied once as remote version
> `20260913111342`. Schema/security readback passed with zero representative-
> cover sidecar rows and zero inventory rows carrying the new field. Owner Edge
> v12 is ACTIVE with JWT verification and hash
> `ad75a08f3624f543f904cf2bf6833bcca132dfc1727e5868d52022365aacea14`;
> its M61 response contract matches the local source. The bounded local follow-up
> decodes Google Books volume evidence, suppresses representative fallback when
> either edition carries unresolved series evidence, and adds forward-only M62
> so standalone Owner detail and review-save responses carry the same private
> provenance as batch review. M62 was then applied once as remote version
> `20260913162154`; its SHA-256 is
> `E8CAAC179363D1E709F071BBF81436B7ED4B24968E0979ADA7A402C8C435066F`.
> Its response fields are rollout-tolerant while present
> values remain strict, allowing Owner Edge to deploy before M62 without a
> contract outage. Fresh TypeScript and worker build pass; affected Jest is
> 8 suites/310 tests, structural metadata 14/14, M55 control 7/7, and full
> M52–M62 representative-cover integration 2/2. The focused runs did not emit
> `act(...)`, open-handle, or force-exit warnings; the later full-run closeout
> recorded existing React `act(...)`, NetInfo dynamic-import, and Expo/Node
> `DEP0040` warnings, while the independent handle run exited normally.
> Metadata-worker/client rollout and the connected no-cover scan/Add remain
> unrun.
> Post-apply readback confirms the private helper ACL and zero sidecar/inventory
> representative-cover rows. No Git publication occurred.
> [Evidence](./implementation/phase-9-image-inventory/supporting/unit6h-representative-cover-correction.md).
> Next action requires authorization to deploy the matching tolerant Owner Edge,
> metadata-worker, and client runtime, then run connected proof.

> **2026-09-12 Unit 6H bounded correction closeout:** Exact readback from
> `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`) proved active Owner Edge v10
> had the older batch decoder and omitted optional
> `metadataSummary.selectionId`. The reviewed correction is commit `6d05370`:
> batch-response contract failures now map safely to retryable
> `P9_INTERNAL_ERROR`, and the React Native list timer plus mounted-query test
> lifecycle are awaited/torn down deterministically. Seven focused suites/233
> tests pass with `--detectOpenHandles` and no prior `act(...)`/non-exit warning;
> TypeScript and executable deployment-runtime validation pass. Only
> `phase9-owner-ingestion` was deployed to the exact development project; v11 is
> ACTIVE with JWT verification and hash
> `0af2f2ebde6019d5f10923141b279ae3a78a5ca0f5eeac6630b990030caddf55`.
> The previously blocked authenticated session now renders both review cards
> through Edge. No Render, migration/M60, database/Storage, dispatch, inventory,
> or data-deletion action occurred. Next: complete the remaining connected Unit
> 6H regression matrix under connected-test authorization.

> **Historical pre-correction Unit 6H diagnostic checkpoint (2026-09-12):** The
> authorized development test confirmed duplicate warning → Proceed → fresh
> analysis for session `f7573651-d155-4dd3-b62b-8e2751db54e4`: one image was
> processed, two candidates were produced, and committed inventory remained
> zero. Authenticated `read_scan_session_v3` returned 200, the Owner Edge
> `read_scan_batch_review` route returned 400 `P9_REQUEST_INVALID`, and the
> same authenticated PostgREST RPC returned 200 with two cards containing
> `metadataSummary.selectionId`. The blocker is therefore deployed
> `phase9-owner-ingestion` contract/version drift against the live RPC result,
> not Gemini or Books API. Retry reproduced the fallback. The checked-in
> response contract accepts `selectionId`. The route/RPC split proves functional
> contract/version drift; the documented active Edge v9 bundle is the leading
> explanation, but exact deployed source/version readback remains pending.
> Database readback confirmed new input `331cf214-f2c6-4733-ac05-f4a37000050d`
> is `ready`, points to the older canonical input only through
> `duplicate_of_input_id`, has exactly one resolved `vision_extract` job keyed
> to the new input, and owns both returned candidates; no inventory row was
> added. `.env.local`, the served Expo bundle, and the read-only Supabase
> endpoint resolve to project ref `ahntbtktjjmvfosgkmgn`; only the parent
> PowerShell environment carried a foreign Supabase URL/key, so that
> process-only mismatch did not cause this browser result. Next action:
> authorized Edge source/version readback or matching redeployment, then repeat
> connected proof. No code, tests, migration SQL, deployment, dispatch, or M60
> action was performed in this diagnostic; only authorized development test
> state was created, with no deletion or inventory commit. M60 was applied
> before this diagnostic under the preceding rollout authorization; no M60
> migration action was taken here. The following PostgreSQL-only checkpoint is
> retained as historical pre-connected evidence; its local-only rollout wording
> is not current.

> **Historical local PostgreSQL verification checkpoint (superseded by the connected closeout above) (2026-09-12; supersedes the prior correction-only gate):** F-01 remains retracted; F-02 and F-03 remain corrected locally. Focused Jest passed 4 suites/181 tests, including the 3 lifecycle tests, and the in-memory PGlite fixture passed 5/5. The Owner-authorized disposable PostgreSQL 18.4 harness then ran at `127.0.0.1:55461` with data directory `C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-unit6h-verify-20260912` and PID-scoped database `bookconnect_u8b_22652`. It applied the disposable baseline and M01–M60, passed `UNIT6H_DUPLICATE_CONFIRMATION_REAL_POSTGRES_CONCURRENCY_PASS` using independent connections, and passed the existing `U8B_REAL_POSTGRES_ACCEPTANCE_PASS` regression. Teardown was verified: the database/cluster directory is absent, the port has no listener, and no matching postgres process remains. M52–M59 are unchanged; M60 remains local and was not remotely applied. No remote database/Storage or application data was touched; no deployment, dispatch change, development-data deletion, staging, commit, or push occurred. Connected Edge/Storage verification remains unrun. Prior screen act/open-handle warnings remain historical unresolved evidence and did not affect these database checks. Next: review this local PostgreSQL proof and separately authorize connected Edge/Storage verification. No product behavior or inventory duplicate policy changed.


**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.3
**Date:** 2026-09-12
**Status:** Live implementation tracker
**Depends On:** DOC-12 and all phase trackers in `implementation/`
**Purpose:** Track live implementation progress, blockers, deviations, and handoff state without turning source specifications into status logs.

---

> **Historical local Unit 6H overlay (recorded before deployment):** On branch `codex/phase9-duplicate-confirmation`, the bounded local correction pass was complete. F-01 was retracted after verifying M58's nested conflict handling; F-02 and F-03 were corrected locally. Forward M60 and coordinated Edge/worker/app changes implement duplicate warning → Cancel or Proceed while preserving new-upload provenance and the normal review/Add pipeline. See the current closeout above and the [Unit 6H work unit](./implementation/phase-9-image-inventory/work-units/06h-duplicate-input-confirmation.md).

> **2026-09-12 Unit 6H local PostgreSQL checkpoint:** Correction-focused Jest passed 4 suites/181 tests, the PGlite fixture passed 5/5, and TypeScript passed. The Owner-authorized disposable PostgreSQL 18.4 harness applied the test baseline and M01–M60, then passed `UNIT6H_DUPLICATE_CONFIRMATION_REAL_POSTGRES_CONCURRENCY_PASS` and the existing `U8B_REAL_POSTGRES_ACCEPTANCE_PASS`. Teardown was verified: its directory is absent, port 55461 has no listener, and no matching postgres process remains. The earlier `VirtualizedList` screen-test warning remains historical; it did not affect this run. M60 is local-only and no deployment, remote database/Storage or application-data mutation, live dispatch, or development-data deletion occurred. Connected Edge/Storage verification requires separate owner authorization.

> **2026-09-12 provider-boundary correction:** The live vision failure was isolated before Books API lookup: a malformed optional Gemini `isbn_clue` caused whole-response schema rejection. The local decoder now degrades malformed/non-string/overlong optional ISBN clues to `null` while preserving title/author/language extraction and the existing metadata query identity. Gemini/analyzer Jest passed 2 suites/48 tests; metadata identity/gateway/Google Books adapter/worker Jest passed 4 suites/49 tests; TypeScript and `git diff --check` passed. No connected retry, deployment, migration, dispatch change, remote database/Storage mutation, or application-data mutation occurred after this correction. The next authorized action is deploy the reviewed correction and rerun the connected vision → metadata path, if rollout authorization remains in force.

> **2026-09-12 provider-boundary deployment:** The reviewed commit `428a8c17362d7a2c478c83b328ca8237b78bc79f` was pushed to `codex/phase9-duplicate-confirmation` and deployed only to the existing Render `phase9-fixture-vision` service (`srv-d9jbsjf41pts73cejqag`) as `dep-daih7ioae00c73egmcug`. Render reported `live`; `/health` and `/ready` returned 200 and unauthenticated `/run` returned 403 without claiming a job. The full authenticated image → Gemini → metadata/Books API test remains unrun because no approved Owner session or worker ingress token is available in this environment. Exact next action: use the approved Owner session for one fresh connected image test and read back the candidate/metadata job. No Edge/client deployment, M60 application, migration, dispatch, database/Storage, or application-data mutation occurred in this correction deployment.

## 1. Tracking Rules
This file is the master status board. It should stay concise.
Detailed implementation notes belong in the relevant phase tracker under [`implementation/`](./implementation/).
Every new session must start from repository `AGENTS.md`, [`implementation/ACTIVE.md`](./implementation/ACTIVE.md), this tracker, and the active phase session-start/tracker. Chat history and old root kickstart documents are not status authority.
Every coding session must update tracking before ending if it changes any of the following:
- phase status
- current milestone
- blockers
- risk level
- completed migrations/services/screens/tests
- RLS/security verification
- source-spec deviations
- next recommended task
- handoff notes
Every material session must also leave one exact active work unit and next authorized action in the active phase tracker, record verification/external mutations in its detailed log, and run the active continuity validator. When the active phase changes, update DOC-13, `implementation/ACTIVE.md`, both README handoffs, the outgoing/incoming phase trackers, and the current pointer in repository `AGENTS.md` together.

> **2026-09-08 Unit 6G runtime closeout:** Commit
> `ffdb1fc85af625bc98dcfc3af93d5530278144a9` is pushed to `origin/main`.
> Render service `phase9-media-sanitation`
> (`srv-d9jbmgf41pts73cecfl0`) deployed that exact commit as
> `dep-dafv4ogn74is73bq9lkg` and is live; `/health` and `/ready` returned 200.
> The requested `testimage.jpeg` completed the duplicate-input guard at attempt
> 1 with a canonical `duplicate_rejected` receipt. A unique `10testimage.jpeg`
> completed media and vision at attempt 1, produced 10 candidates and a linked
> sanitized 1600x1600 WebP, and was closed with zero committed inventory rows.
> Focused worker/runtime Jest is 6 suites/62 tests; related backend/Owner/UI
> Jest is 5 suites/219 tests; the worker build passes. The broad database run is
> 429/433 with all M57–M59 cases passing and four unrelated stale
> metadata-foundation/structural-artifact failures. No migration was applied in
> this closeout and no historical dead-letter job was retried or mutated.

> **2026-09-08 Unit 6G M57–M59 live application/readback:** After exact-project
> reverification and the passing preflight, M57, M58, and M59 were applied
> separately and in order to `Bookconnect_reactexpo` /
> `ahntbtktjjmvfosgkmgn` as live versions `20260908073203`, `20260908073308`,
> and `20260908073425`. Table/RLS/ACL, index, function/grant, legacy-function
> revocation, fence-trigger, dispatcher, empty-state, definition-marker, and
> service-role cleanup-health readbacks pass; the media queue remains idle.
> Post-DDL advisor findings for the new private tables are informational only:
> RLS enabled with no direct policies and unindexed `store_id` foreign keys.
> No business row, Storage object, job, deployment, provider call, stage,
> commit, push, merge, or PR changed. Next: Owner review of the live proof;
> runtime deployment, scheduling, connected business-data tests, commit, and
> push require separate authorization.

> **2026-09-08 connected Owner close/upload proof:** The authenticated Owner
> closed the pre-existing active scan through the app; readback showed
> `status=closed`, five committed inventory items preserved, and six uncommitted
> candidates retained as read-only records. A fresh connected scan accepted the
> repository PNG fixture through the in-app browser and advanced through preview
> and `Registering image` into a live session. Exact-project readback shows one
> valid `image/png` input in `failed` with
> `P9_MEDIA_PROCESSING_RETRYABLE`, zero candidates, and zero committed
> inventory rows. Its media-validation job retried five times and is now
> `dead_letter` with `P9_MEDIA_PROCESSING_RETRYABLE` / `media_validation`; the
> UI reports one image failed. Chrome's chooser-only `Not allowed` result is an
> environment permission issue; the app upload path itself registered the PNG.
> No manual queue mutation, migration, deployment, commit, push, or PR action
> occurred. The blocker is the matching deployed media worker/runtime path;
> separate authorization is required before deployment/scheduling correction and
> a new connected proof.

> **Pre-application 2026-09-08 Unit 6G media-completion correction integration:** The bounded
> correction is integrated locally on
> `codex/phase9-unit6g-media-correction-integrated`, based on verified
> `origin/main` `573182267ddd79e08b0abfb348b5afd9fb0dc571`. M52–M56 were already
> tracked by that baseline and read-only exact-project history confirms each is
> live once, ending with M56 `20260830175651`. New M57–M59 remain local and
> unapplied; they add durable output intents, canonical completion receipts,
> exact duplicate-sanitized-hash terminal rejection, and fenced service-only
> cleanup/recovery. Focused Jest 262/262, focused PGlite 21/21, worker
> TypeScript, and disposable real-PostgreSQL concurrency/U8B gates pass. The
> broad Phase 9 database invocation is 429/433; every M57–M59 case passes, while
> three stale metadata-foundation fixtures and one missing prerequisite
> `.phase9-dist` metadata-worker build artifact account for the four failures.
> Independent review found no actionable issues and returned PASS for local
> review. The ordered exact-project application preflight passed; Owner review
> and explicit authorization for any local commit or ordered M57–M59 application
> are next. No live
> migration, deployment, Storage/job or
> business-data mutation, provider call, stage, commit, push, merge, or PR
> action occurred.

> **Pre-application live read-only check 2026-09-08:** The exact project remains healthy and its
> migration tail is M56 `20260830175651`; all M57–M59 objects are absent, as
> expected. A separate Supabase advisory flags disabled RLS on the empty
> `marketplace_sec.phase9_worker_wake_dispatches` table. Read-only ACL evidence
> shows owner-only `postgres` privileges with no `anon`, `authenticated`, or
> `service_role` SELECT/write grants. No remediation was applied; this is a
> separate hardening decision.

> **Ordered M57–M59 application preflight 2026-09-08:** The exact project was
> reverified healthy at PostgreSQL `17.6.1.063` in `ap-southeast-2`; live history
> still ends at M56. M57 tables/indexes/functions/triggers and M59 new cleanup
> functions are absent. M58's current completion/snapshot functions and M59's
> dispatcher helper are present as intended replacement targets, all four M58
> `_legacy` destination names are absent, required schemas/`pgcrypto`/digest
> and the context function are present, and the media queue has no active work
> (`cancelled=16`, `dead_letter=5`, `resolved=29`). Local focused correction
> tests pass 21/21 and no mutation occurred. Result: **preflight PASS;
> application remains gated on explicit owner authorization and must run M57,
> M58, then M59 in order**. The separate disabled-RLS advisory was not changed.

> **2026-08-30 bounded metadata-throughput implementation:** The local worker
> now accepts a metadata-only 15-job run budget, keeps no more than three jobs
> active, claims only enough to fill open slots, and returns outcomes in claim
> order while preserving per-book provider calls, leases, retries, dead letters,
> fencing, and failure isolation. Durable `retry_scheduled` state is propagated
> into the diagnostic response; the database remains authoritative. New forward
> M56 changes only the private dispatcher payload for `metadata_enrich` to 15;
> media, vision, and publication retry remain one, and the cron frequency,
> timeout, claim-RPC maximum, and applied migrations remain unchanged. Focused
> Jest passed **7 suites / 72 tests** (including the metadata-only invoker
> bound), the metadata worker production TypeScript build passed, and
> dispatcher PGlite passed **30/30**. M56 is unapplied; no
> deployment, provider call, database/Storage/business mutation, staging,
> commit, push, merge, or PR action occurred. Next: review, then separately
> authorize worker-first deployment/canary; M56 application remains a later
> separate gate.

> **2026-08-30 Unit 6G direct-Add/closeout implementation in progress:** The
> Owner-authorized local client pass now keeps the existing per-book strict
> Save → canonical reread → M39 Add, automatically invokes the unchanged v3
> Close only after server counts prove every detected candidate was explicitly
> committed, and warns that a manual partial Close preserves added inventory
> while freezing uncommitted candidates as read-only history. Image-level
> `need attention` and book-level `need review` are now separately labelled.
> Retry/field-preservation regressions cover canonical inventory identity,
> duplicate prevention, condition, price, quantity, location, damage, and
> publication intent. Full Image Inventory Jest passes **59 suites / 478 tests**
> and focused PGlite passes **17/17**; TypeScript, production web export,
> continuity, and diff hygiene pass. The connected active-session proof exposed
> exactly one enabled per-book Add, committed Book 1 once, persisted inventory
> ID `332ad909-47dc-4256-963a-3878c3081337`, and read back exactly one canonical
> private row. Condition `good`, ₹175, quantity `1`, location `2`, no damage,
> and publication intent `publish` survived; the session remained active at
> 1/12 committed after reload. Close actor/source
> audit and lifecycle fences for manual-candidate, skip/false-detection, and
> variant RPCs require a separately authorized forward migration; none has
> been created or applied in this pass. The sole external business mutation was
> that explicitly authorized inventory row plus its canonical candidate,
> idempotency, audit, event, and session-count effects. No Storage mutation,
> migration, remote client/Edge deployment, staging, commit, push, merge, or PR
> action occurred. The repository has no configured EAS project ID/owner or web
> hosting target, so no remote client deployment can yet be claimed.

> **2026-08-30 Unit 6G metadata-quality correction:** The three
> Owner-authorized local tasks are implemented on
> `codex/phase9-unit6g-recomposition`. Google Books requests now prefer
> normalized title plus first author; candidate acceptance requires exact
> normalized title and author overlap, while validated ISBN, compatible
> language, and edition clues are secondary tie-break evidence. The cover
> decoder checks all bounded Google Books image sizes from largest to smallest
> and retains the first allowlisted safe URL, continuing past unsafe larger
> values. The on-demand metadata sheet now renders selected cover, subtitle,
> bounded plain-text description, categories/genre, and explicit state wording.
> No cover toggle, scan-image fallback, rematch action, migration, provider
> call, Supabase/Storage/business-data mutation, credential change, deployment,
> staging, commit, push, merge, or PR action occurred. Focused Jest passed
> **3 suites / 74 tests**, wider metadata regression passed **10 suites / 133
> tests**, affected Unit 6G UI regression passed **6 suites / 82 tests**, and
> TypeScript/diff/continuity checks passed. Exact next action: Owner review and
> separate deployment authority.

> **2026-08-30 Unit 6G bounded metadata/Add-authority correction:** The
> correction-only pass added safe selected-metadata snapshot identity to the
> compact Add draft, kept empty-author review saves valid while requiring an
> author only at the final Add/commit boundary, made title/author evidence
> select bibliographic durable query identity when present, removed the hard
> Google language filter, restored exact-ISBN fallback for ISBN-only queries,
> and restricted batch-card Add advertisement to the full commit-eligibility
> helper. Forward migration
> `20260830000055_marketplace_phase9_unit6g_metadata_add_authority_correction.sql`
> was applied exactly once through Supabase MCP to
> `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` as live version
> `20260830084323 marketplace_phase9_unit6g_metadata_add_authority_correction`,
> directly after M54. It changes only internal function definitions and
> performs no DML/backfill or table/policy/Storage/public RPC signature
> change; touched internal helper ACLs remain restricted and no public grant is
> added. Affected-scope Jest passed **64 suites / 690 tests** (one suite and
> four tests skipped), M54+M55 PGlite passed **7/7**, and read-only definition
> readback passed. Exact next action: deploy or validate the matching client/
> Edge bundle; Add-all redesign, close audit, older sibling RPC compatibility,
> and fresh live browser proof remain out of scope.

> **2026-08-29 Unit 6G M54 lifecycle fence live verification:** The
> Owner-authorized forward migration was applied exactly once to
> `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` as live version
> `20260829142337 marketplace_phase9_unit6g_session_lifecycle_fence`, directly
> after M53. The current final Save/Add/Remove RPCs now lock and require an
> active, unexpired Owner-initiated session; closed/closing/expired detail and
> batch reads advertise only read-only actions. A connected proof against an
> existing closed candidate returned `P9_STATE_CONFLICT` for all three commands
> and verified zero candidate/session-count/inventory/audit/event/idempotency
> effects. M54 changes function definitions only; no business rows, Storage,
> public signatures, tables, RLS policies, or Edge/client deployment changed.
> Older sibling manual/false-detection/variant RPC compatibility was not changed
> and requires a separate Owner decision. Exact next action: Owner review of the
> M54 proof and explicit disposition of that legacy boundary.

> **2026-08-28 U6G-FA-001 live verification:** The explicitly authorized M53
> field-authority correction was applied exactly once to
> `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` as live version
> `20260828081324`, directly after M52 `20260822025712`. Post-apply function
> readback passed, and the Codex browser review page rendered 15 candidate cards
> without the previous review-load error. The migration changed internal
> function definitions only; no business rows, Storage objects, public RPC
> signatures, tables, RLS policies, or grants were changed. Exact next action:
> Owner review of the live proof. Edge/client/native deployment remains
> separately gated.
>
> **2026-08-29 Unit 6G local pre/post-scan UI checkpoint:** The composition-only
> Owner experience is implemented in the `codex/phase9-unit6g-recomposition`
> worktree and is committed on the local branch but remains undeployed. Pre-scan now groups batch,
> location, book-default, and publication controls; post-scan now has the
> consolidated review summary, source-distinct card presentation, compact edit
> sections, full-correction reachability, and sticky commit controls. The
> editable field placement follows the Unit 6G SDD: pre-scan owns batch label,
> location, language hint, optional condition/price, and publication intent;
> compact cards own title/authors, language, condition, price, quantity,
> location, publication, and damage; full correction retains script, metadata
> choice, confirmations, notes, and deeper correction actions. Quantity remains
> fixed at `1` before scan; no batch quantity/apply-to-all prompt was introduced.
> Provider-matched and vision-detected sources are now visibly distinct.
> Targeted Jest completed **6 suites / 69 tests passed** and TypeScript passed.
> The read-only browser check loaded the existing closed session, opened and
> closed metadata, and confirmed Edit/Remove/Add-missed controls were disabled;
> no browser console errors occurred. It also reproduced the known image-level
> `0 need attention` versus candidate-level `15 need review` count mismatch and
> the metadata sheet's generic `Status: Matched` copy; neither was changed in
> this checkpoint. No scan start, image upload, review save, Add/Remove/Close,
> provider call, Supabase/Storage/business-data mutation, deployment, staging,
> push, merge, or PR action occurred. Exact next action: Owner review of
> this local UI diff and the recorded count/copy risks; Edge/client/native
> deployment and any fresh scan remain separately gated.
>
> **2026-08-27 U6G-FA-001 correction complete locally:** The Owner-authorized
> minimal correction projects each unusable selected compact-summary member as
> null and retains the existing per-field source fallback. Mirrored strict
> contracts and compact draft derivation are aligned. Focused contract/structure
> Jest is 53/53, PGlite is 25/25, compact UI/draft assertions are 53/53, and
> TypeScript passes. M53 remains unapplied; M52/M39 and Unit 6 lifecycle remain
> unchanged. Exact next action: independent review. Application/deployment
> requires separate authorization.
>
> **Historical 2026-08-27 U6G-FA-001 correction stop:** The frozen M53 package's sole
> independent-review finding was reproduced through the real PGlite batch
> projection: malformed selected authors, cover, title, and language still
> receive `matched`. Source-only fallback is insufficient because the unchanged
> strict Edge and mobile decoders reject the complete DTO at `metadataSummary`
> before source/backing coherence can make it valid. Per the bounded correction
> instruction, production changes stopped. M53 remains byte-unchanged and
> unapplied; M52/M39 and Unit 6 lifecycle remain unchanged. Exact next action:
> Owner disposition of a scope expansion covering the selected-metadata DTO
> representation/projection boundary and both mirrored strict contracts.

> **2026-08-24 Unit 6G predecessor-inheritance recomposition:** The Unit 6G
> design authority was recomposed on `codex/phase9-unit6g-recomposition`. The
> revised SDD, contract matrix, and tracker 31 now carry the complete 40-row
> Unit 6 predecessor ledger (`INHERITED_UNCHANGED=30`, `SUPERSEDED_BY_6G=7`,
> `DEFERRED_WITH_EXPLICIT_OWNER=3`, `0/0`) with U6G-AC01..AC34; Unit 6 remains
> the immutable lifecycle backbone. M52 stays live exactly once as
> `20260822025712` (retained 6G A/B foundation) and is not reopened. Historical
> commit `e7ed166`-style old 6G-C work and the frozen old 6G-D implementation
> are superseded evidence, not authority. NEW 6G-C (composition-only pre-commit
> client work) follows only after Owner checkpoint disposition of the
> recomposed authority (its independent final review is COMPLETE, verdict
> PASS_WITH_P3) plus separate explicit Owner authorization; NEW 6G-D later owns commit orchestration and 6G-E owns
> Edge deployment/live/native closure. Documentation-only: no product source,
> SQL/M52, database/Storage, deployment, stage, commit, or push action.

> **2026-08-21 Unit 6G Group 1 implementation:** The Owner approved continuing
> on the existing `codex/phase9-unit6g-owner-batch-review-commit-handoff`
> branch/worktree and authorized only Group 1 contract/persistence foundation.
> Strict server/mobile contracts, Owner ingestion dispatch, and the forward
> M52 migration candidate are implemented locally. Red-first contract,
> migration-structure, and PGlite persistence tests are green, with the
> existing M39/Owner UX/Unit 7A regressions preserved. M52 is not applied;
> no database/Storage/business-data, deployment, provider, stage, commit,
> push, or PR mutation occurred. Groups 2–4 (UI, card composition, Add/Add-all
> orchestration, and Store View/cache work) remain out of scope. Exact next
> action: independent review of the Group 1 diff and M52 candidate; application,
> deployment, and Git publication remain separately unauthorized.

> **2026-08-21 Unit 6G Group 1 bounded review correction:** The four review
> findings were corrected without expanding scope. M52 no longer replaces the
> applied v2 Close function; a separate transaction-marked trigger rejects v2
> Close for nullable Unit 6G sessions. Removal presentation authority is
> regression-proven through the existing automatic revision trigger, field
> sources are derived per field, and all three new command RPCs reject null
> command IDs. Red tests failed first; focused Jest is 38/38 and Unit 6G PGlite
> is 11/11. M52 remains unapplied, Groups 2–4 remain untouched, and no external
> or Git-publication action occurred. Exact next action: correction-only rereview.

> **2026-08-21 Unit 6G Group 1 independent-verification correction pass:** Three
> independent audits confirmed the foundation and surfaced four bounded defects,
> all corrected inside the still-unapplied M52 and its tests: the v3 close
> summary now overrides `candidatesNeedsReview` so a removed candidate is counted
> exactly once; all three command RPCs explicitly reject null idempotency keys
> and null expected versions (closing a PL/pgSQL NULL fail-open reachable by
> direct authenticated RPC); session-level counters widened beyond 15 because
> legacy multi-image sessions exceed 15, with card/item bounds kept at 15 plus a
> server-side LIMIT 15; M52 forward-replaces `phase9_owner_candidates_page_v2`
> so the legacy session scope excludes removed candidates instead of failing old
> clients' strict decode. SDD §7/§16/§17 and the contract matrix were aligned,
> including six recorded decisions (page filter, service_role withholding,
> rollout constraint). Verification run: focused Jest 42/42, expanded regression
> 212/212, Unit 6G PGlite 13/13, TypeScript clean. M52 remains unapplied; no
> database/Storage, deployment, or Git-publication action occurred. Exact next
> action: independent correction-only rereview of the corrected M52.

> **2026-08-21 Unit 6G Group 1 rereview iteration two:** Two completed external
> correction-only rereviews returned FAIL on the same two findings, and the
> correction pass's own PS 5.1 documentation rewrite had introduced encoding
> damage. The Owner approved a second bounded iteration: Start explicitly
> rejects null `p_language_hint`/`p_location`/`p_publication` with
> `P9_REQUEST_INVALID` (required v2 start inputs; the NOT NULL columns already
> failed closed but with non-canonical codes); session-level counters replaced
> the interim 0..999 cap with non-negative JSON-safe integers: every realistic
> SQL count decodes exactly and any value above 2^53-1 fails closed at the
> decoder rather than losing precision; database counts are never clamped. The
> matrix and DOC-13 BOM
> plus 43 double-encoded matrix characters were repaired in place with no file
> discarded. Structural, PGlite (G1-13), and both contract test files were
> extended to pin the new behavior. Gate results for this iteration are
> recorded in the Phase 9 implementation tracker. M52 remains unapplied; no
> database/Storage, deployment, or Git-publication action occurred. Exact next
> action: external correction-only rereview of iteration two, then one local
> commit on explicit Owner authorization.

> **2026-08-22 Unit 6G-B M52 application and connected proof:** The read-only
> exact-project preflight returned PASS (live tail M51, all nine dependency
> functions signature-matched, zero object/name collisions, ACL snapshots
> captured, 12 sessions/62 candidates fully compatible, no registry conflict).
> On explicit Owner authorization M52 was applied exactly once via Supabase
> MCP as live version `20260822025712`, directly after M51. Readback verified
> nullable condition, both new bounded session columns with CHECKs, the
> extended disposition CHECK, five new authenticated-only RPCs, preserved
> `phase9_owner_candidates_page_v2` ownership/grants through CREATE OR
> REPLACE, both fence triggers, and the registry row. Connected proofs with
> transaction-local Owner impersonation: nullable-condition session
> `33c3f6fb…` created through Start v2; legacy v2 Close failed closed with
> `P9_STATE_CONFLICT`; candidate `50de2017…` removed irreversibly with zero
> inventory effect and one audit + one event; page-v2 excluded the removed
> candidate; Close v3 returned `ownerRemovedCandidates=1` with
> `candidatesNeedsReview=0` (no double-counting live). Post-application gates:
> Jest 10 suites 254/254, PGlite 13/13, TypeScript clean, continuity validator
> PASS. Evidence commit `6313067` records the proof in tracker 02. No push,
> merge, Edge/mobile deploy, M39, Unit 7C, or Groups 2–4 work occurred. Exact
> next action: Owner authorization of 6G-C.

> **2026-08-21 Unit 8 repository closure ready:** The final bounded Unit 7/8
> reconciliation is complete locally. Repository-only M51 fails closed on
> existing publicly eligible NULL/out-of-range/duplicate orders or cardinality
> above three, and guards both link and asset-lifecycle eligibility transitions.
> Q10 and the strict client contract are bounded to ordered public slots `1..3`.
> `canonical_edition_exact` is reserved/unreachable in text-query v1. M49-M51
> remain unapplied; no migration-history repair, Vault provisioning, deployment,
> commit, push, Storage mutation, or business-data mutation occurred.

> **2026-08-21 read-only release gate:** The feature branch is pushed at
> `a47ac76`, with `main` untouched. Connected migration history has 150 rows
> versus 153 local files; 113 shared logical names have different version IDs,
> seven live names have no local source, and M49-M51 are absent live. This is a
> timestamp/name-ledger mismatch, not permission to replay or repair history.
> The exact next action is approval of a canonical mapping/dependency plan;
> Vault, migration application, live verification, and main integration remain
> blocked pending that plan. The complete normalized source-hash mapping is
> recorded in [migration-canonical-reconciliation-2026-08-21.md](./implementation/phase-9-image-inventory/supporting/migration-canonical-reconciliation-2026-08-21.md):
> 4 exact version/source matches, 93 same-logical/different-timestamp matches,
> and 46 divergent-content review flags.

> **2026-08-21 connected Unit 8 live closure:** The approved forward-only
> rollout completed against `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`.
> Vault secret `phase9_q08_cursor_secret` was provisioned without disclosure;
> M49, M50, and M51 were applied individually and read back exactly once as
> `20260821060156`, `20260821060742`, and `20260821061213`. Connected Q08/Q09/
> Q10 acceptance, cursor/policy binding, anon/authenticated grants, privacy,
> legacy compatibility, and the public-media order invariant all pass. The
> complete evidence is [unit8-connected-rollout-2026-08-21.md](./implementation/phase-9-image-inventory/supporting/unit8-connected-rollout-2026-08-21.md).
> No historical migration repair, unrelated migration, Storage/business-data
> fixture mutation, or unrelated deployment occurred. Unit 8 is now
> `UNIT8_LIVE_ROLLOUT_PASS`; the feature branch was subsequently fast-forwarded
> into `main` at release commit `4c1d98d` and pushed. The next Phase 9 scope is
> a separate decision.

> **2026-08-21 Unit 8 main integration:** `main` now contains the complete
> Unit 8 implementation, migrations, tests, connected-rollout evidence, and
> closure handoffs. The integration was a fast-forward from the pushed
> `phase9-unit8-u8b-bookstore-discovery` branch; no migration history repair,
> live database change, unrelated deployment, or protected housekeeping-file
> change was made during integration.

> **2026-08-20 U8B bounded corrective scope locally complete:** Under the
> explicit user authorization for the smallest corrective scope, M49 now
> contains only the provenance-qualified cover fallback, effective relevant
> policy-fingerprint cursor binding, and bounded malformed-cursor correction.
> The updated U8B integration suite is `63/63` green, and the disposable
> real-PostgreSQL acceptance path passes with
> `U8B_REAL_POSTGRES_ACCEPTANCE_PASS`. M49 was exercised only in fresh local
> disposable databases and remains unapplied to Supabase. No migration-history
> reconciliation, Vault provisioning, live Supabase verification, deployment,
> Storage/business-data mutation, or U8C work occurred. Next exact action:
> independent U8B re-review/closure; operational prerequisites remain separately
> authorized.

> **2026-08-20 Unit 8 Marketplace SDD frozen:** The authoritative specialized
> Unit 8 design now lives at
> `implementation/phase-9-image-inventory/work-units/08-marketplace-bookstore-first-sdd.md`.
> It freezes the post-5C/7A/7B/7C customer flow: safe publication → Q07 internal
> matching → Q08 bookstore grouping before ranking/pagination → Q09 complete
> public title-group storefront → Q10 current eligible detail/gallery. It keeps
> `inventoryId` private/Owner-only, uses `listingId` as current customer offer
> identity, and forbids title/author or alias-based identity merging. M47/M48 is
> recorded as a satisfied customer-boundary prerequisite. The known local/live
> migration-history mismatch remains parked and must be reconciled before any
> future Unit 8 migration is applied. This was documentation-only: no Unit 8
> source/test/migration work, DB/Storage/business-data mutation, fixture,
> deployment, or external operation occurred. U8B is a proposed next work unit
> and requires separate authorization.

> **2026-08-17 legacy Marketplace RPC security remediation PASS:** The exact
> development project `Bookconnect_reactexpo` /
> `ahntbtktjjmvfosgkmgn` was re-verified healthy. M47 was applied once as live
> version `20260817073341` through Supabase MCP. It revoked all non-owner
> execution on `phase9_storefront_catalogue(uuid,integer,jsonb)` and
> `phase9_listing_detail(uuid)`, removing the verified `inventory_id` exposure
> without rewriting either function or changing business data. Explicit
> `anon`, `authenticated`, and `service_role` calls now fail with `42501`;
> safe v2 JSON search/detail calls remain allowed and unchanged. Focused
> migration/client Jest is 2 suites/13 tests green. No Unit 8 implementation,
> Storage change, Edge redeploy, or unrelated grant/API change occurred. Next
> exact action: obtain separate authorization for the Unit 8 SDD/freeze.

> **2026-08-17 M48 trusted-role compatibility correction PASS:** Because M47
> was already applied and immutable, the exact forward migration
> `20260817000048_marketplace_phase9_legacy_rpc_service_role_compatibility.sql`
> was applied once as live version `20260817075825`. It uses precise
> `REVOKE EXECUTE` from `PUBLIC`, `anon`, and `authenticated`, then restores
> only `service_role` `EXECUTE`. Repository search, all 12 live Edge Function
> readbacks, and the live SQL function-definition dependency scan found no
> current legacy-RPC caller; retaining the trusted grant is therefore an
> intentional compatibility allowance, not a customer path. Explicit role
> tests show both customer roles receive `42501`, direct projection-view reads
> remain denied, trusted service-role detail execution succeeds, and v2 JSON
> search/detail remain callable without `inventory_id`. Focused static/client
> Jest is 3 suites/15 tests green. No Unit 8 implementation, business-data or
> Storage mutation, Edge redeploy, or unrelated grant/API change occurred. Next
> exact action: obtain separate authorization for the Unit 8 SDD/freeze.

> **2026-08-17 Unit 7C resumed connected-canary and publication handoff:** The
> bounded continuation completed through authenticated in-app Browser → existing
> Owner Edge v8 → DB against `Bookconnect_reactexpo` /
> `ahntbtktjjmvfosgkmgn`. Private-only Save advanced inventory version `3 -> 4`
> without a new public revision; a deliberate stale Save returned the refreshed-
> details conflict with zero side effects; stock `1 -> 0 -> 1`, Pause → Republish,
> approved media ADD through the existing U7B path, history/privacy, and browser
> routing all passed. Final readback is inventory version `6`, publication intent
> version `4`, quantity `1/1/0/0/0`, stable active/low-stock listing, four public
> revisions, nine audit/events, and one approved public media link. No migration,
> Edge redeploy, direct SQL business write, repair/reset, or manual worker claim
> occurred. The proven correction is committed as `f4a9e858396474dcd08123eb976a47b019ef26f8`;
> publication and merge are complete at merge commit
> `2be793e6212b1b485737c5045d701c99169490e4`; the next exact action is separate
> authorization for the next Phase 9 work unit.

> **2026-08-16 Unit 7C connected-verification blocker (corrected):** Exact HEAD
> `5cfc08ebbe8b20a94cbf6d0616d894a840bc8882` was deployed only to
> `phase9-owner-ingestion`, once, as ACTIVE version 8 with JWT verification.
> Authenticated Store View reads and non-enumeration passed. The first and only
> canary mutation changed private `internalNotes` and inventory version but
> incorrectly seeded append-only public revision 1 for a pre-existing published
> item with no revision baseline. No private data leaked and the customer
> listing did not change. M46 was then applied once as live migration
> `20260816150126`, with no Edge redeploy, repair, reset, or historical-row
> modification. A fresh authenticated private-only Save advanced version
> `2 -> 3`, changed only `internalNotes`, left the listing/public DTO and
> revision count unchanged (`1 -> 1`), and added one audit/event pair. Status is
> `unit7c_m46_correction_pass_connected_save_reproof_complete`.

> 2026-08-09 Phase 9 schema-free Gemini JSON correction is locally complete.
> Gemini now receives JSON MIME mode and the flat `vision` prompt with no provider
> response schema; BookConnect retains strict local validation and unchanged
> M18/M19 mapping. Red-first proved the old request still carried the schema;
> final exact-path focused Jest is 59/59 and vision-worker TypeScript passes.
> The approved bounded capture returned eight observations and proved the exact
> local mismatches: provider `image_outcome: success` and one null
> `detected_language`. Red-first reproduced the failure; BookConnect now
> normalizes those aliases to canonical `analyzed` and `und`; later main-line
> live-payload evidence also maps known language names to BCP 47 tags, strips
> safe ISBN labels, and reconciles analyzed visible-book count to accepted
> observation count. Exact-path
> focused Jest is 60/60 and the vision-worker build passes. The separate final
> proof transmission was blocked by the approval boundary and remains pending
> explicit approval. M34, Git, Render,
> Supabase/jobs, metadata, Owner UI, inventory/publication, scheduler, and Unit 7
> remain untouched by this correction.

> 2026-08-09 Phase 9 corrected-production provider proof stopped before M34.
> Reviewed local `HEAD` is unpushed commit `dc19107`. The replacement Gemini key
> was installed only on the existing Render vision service and automatically
> caused one restart at prior source SHA `83cf61a`. The exact full committed
> request used the matching sanitized WebP and configured model but returned
> HTTP 400 `INVALID_ARGUMENT`. With image, prompt, model, and request otherwise
> unchanged, the core `vision` schema returned HTTP 200 when only the optional
> multilingual subtree was omitted; changing nullable encoding did not fix the
> full schema. M33 is live once as `20260809023834`; M34 remains unapplied. No
> job, database/Storage mutation, push, corrected deployment, metadata, Owner UI
> continuation, inventory/publication, scheduler, or Unit 7 action occurred.
> Next: smallest multilingual provider-schema compatibility correction, then
> rerun the exact provider-only request before any downstream execution.

> 2026-08-09 Phase 9 bounded local correction: Gemini now returns only compact
> visual identity plus optional compact multilingual enrichment, capped at five
> authors. Enrichment is non-fatal, original-script identity stays canonical,
> and selected session language is a hint in TypeScript and local forward M34.
> The independent review's required diagnostics correction now prevents bounded
> provider request IDs or error codes from carrying configured privileged values.
> Red-first evidence failed 1/22 analyzer and 1/6 egress assertions; corrected
> analyzer/egress Jest is 22/22 and 6/6, and the complete focused scope is 47/47.
> Vision-worker TypeScript and current-tree PGlite
> 59/59 through M32/M33/M34 passed. M34 is unapplied; no provider, Render, job,
> Supabase, inventory/publication, stage, commit, or push mutation occurred.
If implementation changes product or architecture behavior, update the relevant source spec and record the reason in this tracker.
---
## 2. Current Status

> **Current 2026-09-28 Phase 9 / Unit 6G handoff:** The Owner authorized Git
> publication of the locally verified post-scan and Store View changes with
> the price-intent and cover-source deviations recorded above. This does not
> establish a new connected runtime or database result. Latest recorded
> connected session readback: 2026-09-22, two candidates privately committed
> and three still in review. Migration history for M60–M62 is recorded as
> applied once in prior rollout records; this session performed no fresh
> database readback. Next exact action after Git publication is an Owner
> decision on the two deviations before deployment or connected proof.

> **Historical 2026-08-16 Unit 7C WU5 commit and M43–M45 application checkpoint:**
> The proven WU5 Owner Store View cutover is committed locally as `380f2b3` on
> `codex/unit7c-wu5-store-view-cutover`. The exact development project
> `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` remained `ACTIVE_HEALTHY`;
> M43, M44, and M45 were applied exactly once as live versions
> `20260816122822`, `20260816122901`, and `20260816122929`. Readback found the
> RLS-enabled publication-revision table with zero rows, 11 public Unit 7C
> functions, 5 security helpers, both media capability columns, and unchanged
> inventory/listing counts `10/9`. No deployment, push, Edge change, Storage
> mutation, or business-row mutation occurred. Fresh focused Jest is 10 suites/
> 67 tests, disposable Unit 7C integration is 30/30, Expo export and continuity
> validation pass. Integrated Unit 7C review and connected Edge→DB verification
> remain separately gated. Advisor readback retains expected RLS/no-policy and
> authenticated SECURITY DEFINER notices, media FK index notices, and the
> pre-existing `spatial_ref_sys` RLS error; no remediation was applied.

> **2026-08-12 Unit 7A live proof completion checkpoint (04:41–~05:00 UTC):**
> `phase9-owner-ingestion` is ACTIVE as version 5. The deployed bundle contains
> the `add_to_inventory` member in the `allowedActions` enum in
> `supabase/functions/_shared/imageInventory/contracts/ownerUxResponses.ts`.
> This resolved the `OwnerUxResponseContractError`/`P9_INTERNAL_ERROR` on
> candidate detail and exposed Add to Inventory.
>
> At 04:41 UTC, the authenticated Owner clicked Add to Inventory for candidate
> `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals` by P. F. Strawson) in
> session `166a20cb-c919-4e06-8e4a-1cd53e4ef393`. The first live commit created
> store_inventory row `5f5a2bc9-d702-4aeb-af55-2a9df6c16478` with
> `created_from_candidate_id=f6266e3a-e920-4fa0-a993-c02c739f5108`,
> `entry_method=image_extraction`, `visibility_status=draft`,
> `publication_status=private`, `selling_price_minor=250000`, and quantities
> `total/available/reserved/sold/removed=1/1/0/0/0`. Candidate readback is
> `state=committed`, `committed_inventory_id=5f5a2bc9-d702-4aeb-af55-2a9df6c16478`,
> `outcome=committed_private`; session `committed_count=1`.
>
> At approximately 05:00 UTC, the exact original command was replayed through
> the deployed Edge as the authenticated Owner with
> `idempotencyKey='commit:1779df52-2f35-413d-81f5-8c71769e176b'`,
> `commandId='9a1182db-6e96-4c24-b484-dad57 909818'`,
> `expectedCandidateVersion=2`, `expectedReviewVersion=1`, and
> `expectedMetadataRevision=4`. The response was the canonical recorded result:
> `inventoryId=5f5a2bc9-d702-4aeb-af55-2a9df6c16478`, `candidateVersion=3`,
> `inventoryVersion=1`, `outcome=committed_private`. Post-replay readback found
> one inventory row for the candidate, session `committed_count=1`, one completed
> idempotency row, one audit log, and one event: zero new effects.
>
> New verdict: `UNIT_7A_LIVE_PROOF` is **PASS** and
> `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY` is cleared. The controlled
> proof is complete: one Owner UI commit plus exact replay, both verified with
> zero side effects on replay. Unit 7B publication, Unit 7C post-commit edits,
> manual RPC fallback, and merge to `main` remain separately gated. The same
> session's `Thinking, Fast and Slow` candidate remains uncommitted
> (`review_ready=false`) and is not part of this proof. Supabase also reported
> an existing RLS-disabled advisory for three registry/system tables; no
> remediation was applied.

> **2026-08-12 current authority reconciliation — Unit 6 / Unit 7 sequencing:**
> The automatic/functional Unit 6 pipeline is **PASS**: M38 automatic proof
> completed media, vision/Gemini, metadata, and Owner-review handoff, with no
> inventory/listing side effects. Native Unit 6F validation remains deferred
> `NOT_RUN`/`UNRESOLVED` debt, not PASS, for camera/gallery physical-device
> parity, native recovery/reconnect, 15-card representative-device
> performance, offline/reconnect, accessibility/large text, and low-end
> Android resource/performance. The project owner accepts this deferred native
> validation risk and authorizes Unit 7 to begin. This changes sequencing only;
> it does not alter Unit 6 requirements or acceptance criteria. The detailed
> Unit 6F evidence and AC36/AC39 mapping remain preserved in tracker 24.

> **2026-08-12 Unit 7A create-only planning checkpoint:** the Owner froze the
> controlled commit as create-only. Every eligible reviewed candidate commit
> creates exactly one new private inventory row from the current server-held
> saved review, with `total=available=q` and reserved/sold/removed all zero.
> Duplicate lookup, merge, increment, manual match, and “keep separate” are not
> Unit 7A behaviors; historical Unit 6 duplicate controls are superseded for
> this path and must be non-actionable/non-blocking before enablement.
> Publication is Unit 7B. The design is ready for separately authorized red
> tests and requires a forward migration; no test, runtime, migration file,
> database, external-service, or Git action occurred in this planning session.

> **2026-08-12 Unit 7A local implementation checkpoint:** the frozen create-only
> contract is implemented locally on
> `codex/phase9-unit7a-create-only-inventory` from exact `origin/main`
> `f2ccc6a20f065ec000fd3a3ac89ba4f014b52cb4`. Forward M39 adds the
> authenticated current-revision-fenced create command and revokes the unsafe
> M05 callable without deleting legacy history. Edge/mobile now expose only the
> strict online, non-optimistic add action; duplicate controls are non-actionable.
> Red-first dedicated PGlite is 13/13, Phase 9 Edge/mobile/migration regression
> is 42 suites and 479/479, and TypeScript passes with the documented import
> flag. Fresh read-only Supabase preflight verified the exact healthy project
> and M38 live tail; M39 remains unapplied. No database/Storage, deployment,
> provider, inventory/listing/publication, stage, commit, push, or PR mutation
> occurred. The next authorized action is complete local-diff review; live
> application/deployment, authenticated smoke, and Git publication require
> separate explicit authorization. [Detailed evidence](./implementation/phase-9-image-inventory/trackers/29-unit7a-create-only-commit-evidence.md).

> **2026-08-12 Unit 7A M39 application checkpoint:** exact-project schema,
> security, migration-history, and existing-data preflight passed on
> `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`; genuine PostgreSQL 17
> independent-connection exact-replay and competing-command contention passed.
> Reviewed M39 was applied once with no retry and is live as
> `20260812003419 marketplace_phase9_create_only_inventory_commit`. Immediate
> readback matched the reviewed function body and authenticated-only ACL, kept
> internal helpers restricted, and confirmed M05 has no application-role
> execution. Pre/post counts were identical: inventory/listings `5/5`, no
> inventory/public-media links, unchanged candidate/session state, and zero
> Unit 7A idempotency/audit/event effects. Edge/runtime deployment and the
> controlled live Add-to-Inventory/exact-replay proof remain `NOT_RUN`.

> **2026-08-12 Unit 7A Owner Edge deployment blocker:** the M39 evidence commit
> was pushed normally to the feature branch. Dependency tracing selected only
> `phase9-owner-ingestion`, and its focused Edge/runtime/security suites passed
> 182/182. The one authorized deployment attempt failed during bundling before
> activation: `domain/validation.ts` imports `../contracts/registers` without a
> `.ts` extension. No retry, source repair, database mutation, or unrelated Edge
> deployment occurred. Owner Edge version 3 remains ACTIVE with JWT verification;
> pre/post inventory, listing, candidate, session, idempotency, audit, event,
> media, and publication state is identical. Live Unit 7A proof remains blocked.

> **2026-08-12 Unit 7A corrected Edge deployment and controlled-proof stop:**
> the corrected `phase9-owner-ingestion` bundle is active as version 4 with
> deployment ID `f8aec89f-ae2a-431a-8a97-5775a2405b90`; the deployment attempt
> budget is exhausted at `1/1`. Exact-project read-only preflight and readback
> confirmed M39 exactly once, the authenticated-only Unit 7A RPC ACL, M05
> revocation, and the unchanged zero-effect baseline. The authenticated Codex
> Browser Owner path selected existing eligible reviewed candidate
> `d61d2193-4674-49d1-ae09-aed120dfe261` with reviewed quantity `q=1`, but its
> candidate-detail route failed twice and never exposed Add to Inventory. No
> RPC fallback, commit, replay, or business mutation occurred; final readback
> remains inventory/listings `5/5`, candidates `18 ready/36 needs_review/1
> failed`, committed total `0`, Unit 7A idempotency/audit/event `0/0/0`, and
> inventory-media links `0`. Exact verdict:
> `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY`. Next: restore the functioning
> authenticated Owner candidate-detail/Add-to-Inventory path, then resume only
> the authorized one commit followed by exact same-command replay. Unit 7B/7C
> and manual RPC remain out of scope.

> **2026-08-12 latest Owner review-save result:** after the new one-image scan,
> the user authorized saving candidate
> `5b8a7220-d460-40fc-ad5c-330c84d69903` with an invented private price of
> `250000` paise. The save path succeeded: the candidate is `ready`,
> `reviewed`, `review_ready=true`, quantity `1`, and has no committed
> inventory ID. Opening its next-step detail failed on the initial load and
> exact retry, so Add to Inventory was never exposed. Read-only readback shows
> inventory `5`, session committed total `0`, Unit 7A idempotency/audit/event
> `0/0/0`, and all five existing inventory rows still private. The latest
> gate remains `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY`.

> **2026-08-12 fresh-image observation:** the user-started session
> `166a20cb-c919-4e06-8e4a-1cd53e4ef393` accepted one image, then media
> validation moved to a retryable failure. Final read-only readback shows the
> input `skipped` with `quality_reason=P9_OWNER_REMOVED`, its job cancelled at
> attempt `2/5`, and zero candidates/commits. This observation did not change
> the Unit 7A proof verdict; the removed input must not be revived without a
> new explicit target decision.

> **2026-08-12 fresh-processing continuation:** the same session later
> accepted a second image and completed successfully with two candidates:
> `Individuals` / `P. F. Strawson` and `Thinking, Fast and Slow` / `Daniel
> Kahneman`. Both are `state=ready` but `review_ready=false`. The first review
> screen loads matched metadata and remains private, but price and Owner
> confirmations are still required; no new review or inventory write was made.

> **2026-08-12 latest fresh review action:** candidate
> `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals`) was saved privately
> with quantity `1` and price `250000` paise. Server readback confirms
> `ready`/`reviewed`/`review_ready=true`, but its next-step detail failed twice
> and never exposed Add to Inventory. Inventory remains `5`; Unit 7A
> idempotency/audit/event remains `0/0/0`; no inventory commit occurred.

> Historical pre-correction status marker preserved for continuity:
> `unit7a_edge_deployment_blocked_by_source_routing_mismatch`.
> Historical phase-table status marker: | Phase 9: Image-to-LLM Inventory | `unit7a_edge_deployment_blocked_by_source_routing_mismatch` |

> 2026-08-11 Phase 9 multilingual vision-response resilience correction:
> user-supplied physical Android evidence closes the native FileSystem transport
> proof through signed Storage `2xx`, exactly one object, input registration, and
> sanitation. The downstream Gemini job then failed deterministically as
> `P9_VISION_SCHEMA_INVALID`; the input was later removed and remains untouched.
> Red-first local correction now converts bounded 16-100 count/array evidence to
> complete-image `too_many_books`, preserves Unicode while bounded unknown human
> language labels degrade to `und`, isolates optional enrichment, and emits only
> closed content-free schema diagnostics. Resilience passes 21/21; existing
> analyzer/captured payload plus resilience 46/46; focused worker/extraction/
> multilingual/security/Unit 6 polling 120/120; Image Inventory 294/294;
> repository TypeScript and the vision-worker build pass. No migration, remote
> mutation, deployment, provider call, Git publication, removed-input retry, or
> Unit 7 action occurred. Next: bounded review, then separately authorized
> deployment and one fresh post-deployment Android image proof.
>
> 2026-08-11 Phase 9 native transport replacement: the bounded local correction
> now explicitly preserves the proven browser Blob/FormData XHR path and routes
> Android/iOS through Expo FileSystem `UploadTask` with URI-backed
> `BINARY_CONTENT`, signed `PUT`, exact file-size and MIME/header validation,
> native byte progress, cancellation, and bounded secret-safe HTTP diagnostics.
> Red-first transport coverage is 6/6; focused capture/upload is 37/37; the full
> Image Inventory scope is 39 suites and 294/294; repository TypeScript passes.
> At that local checkpoint no fresh Android proof or external mutation had
> occurred. The later physical proof recorded above passed Storage `2xx` and
> registration, superseding that transport gate. The separate deployed
> `P9_SINGLE_IMAGE_LIMIT` mapping drift remains unchanged and no Edge deployment
> is authorized.
>
> 2026-08-11 Phase 9 mobile upload correction: read-only evidence isolated the
> failed Android path to the signed Storage PUT after successful capability and
> signed-URL issuance and before object creation/registration. The narrow local
> fix sends raw `ArrayBuffer` bytes with explicit MIME/cache headers instead of
> React Native `Blob`/`FormData`, preserving progress, cancellation, size,
> registration, and retry behavior. Red-first transport coverage, focused
> capture/upload tests (26/26), all Image Inventory tests (290/290 reported
> passing), and repository TypeScript pass. No post-fix native upload or other
> external mutation occurred; native runtime proof remains separately gated.
>
> 2026-08-11 authorized native follow-up: Expo Go raw-byte PUTs reached Storage
> but returned HTTP 400; no object or input was created. A later development
> reload caused reauthorization while the prior capability remained live. The
> database raised `P9_SINGLE_IMAGE_LIMIT`, but deployed Edge version 3 mapped it
> to generic HTTP 500. Further correction or deployment is not authorized.
> 2026-08-10 Phase 9 Unit 6 closure: `origin/main` is published at exact
> approved SHA `a138baa7d3bbc086da019bc052a5ae31d0e15882`; M38 is live once as
> `20260810130638 marketplace_phase9_metadata_retry_correction`; and only the
> metadata worker was redeployed, exactly once, from that SHA. One authenticated
> Owner upload automatically completed media, vision/Gemini, six metadata jobs,
> and the Needs Review UI. There were zero manual runs/claims/repairs/operator
> retries, inventory/listings stayed 5/5, and the historical failed metadata job
> was untouched. Duplicate replay was not tested and Unit 7 was not started.
> Unit 6 closure verdict is `PASS`; no next work unit is authorized.
> 2026-08-10 Phase 9 metadata retry/provider-attempt correction is locally
> implemented red-first on a fresh `origin/main` branch. Exact-project read-only
> evidence confirms M32-M37 live exactly once. Forward-only M38 adds metadata
> context v2 with the selected physical call's claim-attempt number; later claims
> no longer replay an older retryable provider result, while same-claim and
> terminal-result reconciliation remain spend-safe. Focused metadata Jest is
> 148/148 and full Phase 9 PGlite is 242/242; metadata build, entrypoint smoke,
> and deployment-runtime validation pass. The exact Google Books HTTP 503-to-200
> regression proves two fetches and two physical calls across claim attempts 1
> and 2, successful ready-state resolution, and no dead-letter/exhaustion. The
> independent correction-only verdict is `APPROVED`. M38 is local/unapplied. No database,
> deployment, provider, job, media/vision, query-policy, Unit 7, inventory,
> listing, or publication mutation is authorized in this correction session.
> Correction commit `8c55fea` is published on
> `codex/phase9-metadata-retry-correction`; this Git-only effect did not mutate
> Supabase, Render, providers, jobs, Storage, inventory, listings, or publication.

> 2026-08-10 Phase 9 Unit 6 pre-main reconciliation has assembled an isolated
> candidate from fresh `origin/main` `388d8bf`. Merge checkpoint `8e327d7`
> contains the complete packaged M32/M33/M35/Unit 6/runtime source, exact M36
> dispatcher ancestry, and the proven Google Books `projection=full` correction.
> Unrelated Store Owner Orders and Phase 4 content plus superseded Gemini tree
> content were restored to authoritative `origin/main` versions before commit.
> The prior complete candidate gate remains green; immutable-M35/local-M37
> corrections pass focused Jest 5 suites/189 and Phase 9 DB continuity 241/241.
> Independent final correction-only re-review remains, and `origin/main` push
> requires a new explicit user instruction. M36/M37 application and all
> Supabase, Vault, Cron, Render, worker/provider, Storage, live-image,
> duplicate-replay, Unit 7, inventory, listing, and publication mutations remain
> prohibited.

> 2026-08-09 Phase 9 metadata-runtime safety checkpoint: M32 remains live exactly
> once on verified healthy project `ahntbtktjjmvfosgkmgn`. Shared worker startup
> now fails closed on any non-approved Supabase origin; metadata no longer accepts
> the media/vision peer fingerprint; and the bounded manual invoker supports
> `metadata`. Focused changed-scope Jest is 84/84 and the metadata-worker build
> passes. Exactly one process-only Google Books adapter request returned HTTP 200;
> the credential was accepted and bounds/decoder/provider-neutral normalization
> passed with `no_acceptable_match`. No candidate, privileged worker,
> database/provider persistence, Gemini/Render change, deployment, scheduler,
> inventory/publication, Unit 7, or Git mutation occurred. The one-candidate proof
> still requires separate authorization and a fresh process-only Google Books key after revocation of
> the chat-exposed temporary key. A sanitized JWT inspection and authenticated
> read on 2026-08-09 proved that the inherited service-role key belongs to and
> is accepted by the exact project; only the inherited `SUPABASE_URL` is foreign
> and must be overridden for the worker process.

> 2026-08-09 authorized Expo web proof: the legitimate Profile → Store Owner
> Console → Inventory path loaded under the authenticated Owner session. The
> screen resumed an older capture with 6 processing images and 1 review item;
> exact-project read-only baseline was 4 sessions, 3 active/closing, 18 inputs,
> 27 jobs, 8 pending jobs, 13 candidates, and zero metadata jobs/attempts/
> provider calls/lookups/cache entries. Because the shared worker queue could
> not be isolated to a fresh image, and no Google Books credential was present
> in the process, the proof stopped before session creation or upload. No
> database, Storage, Gemini, Google Books, worker, or provider mutation occurred.

> 2026-06-30 refresh: Phase 1 foundation remains applied in live Supabase. Phase 2A Store Owner gate/auth/security hardening is implemented locally and its write-boundary hardening migration is applied live. Phase 2B has controlled store application/document writes through the `store-application` Edge Function, app service wrappers, onboarding UI, metadata persistence, pilot locality validation, sanitized DB errors, and private document upload tests. Phase 2C platform review/setup entitlements is implemented locally and deployed: review metadata migration is live, `store-review` is deployed with JWT verification enabled, and Store Owner setup/status screens exist. Phase 2B authenticated live smoke passed; Phase 2C unauthenticated live smoke returned `401`; authenticated platform-review smoke is pending platform-operator test credentials. Phase 3 manual inventory/canonical/listing projection migration is applied live through Supabase MCP and schema/RLS verified. A 2026-06-29 Supabase MCP smoke confirmed the inventory trigger projects a publishable row into `marketplace_book_listings`, then cleaned up the disposable smoke inventory/listing and restored the store fixture. Anonymous public-read smoke is still blocked by the public listing RLS policy calling `marketplace_sec` helper functions that `anon` cannot execute. Phase 4 Store Owner Console is locally complete: dashboard, owner inventory management, storefront/profile settings, subscription/quota visibility, compliance blockers, route tabs, and focused tests are implemented with TypeScript and web export passing.

> 2026-07-15 review refresh: Git is synchronized by content with the recently merged `origin/main`. Supabase MCP and `.env` both identify project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`). Phase 4 remediation adds the controlled `store-profile` function, approved-store setup completion, stricter checklist readiness, inventory workflow fixes, and migration `20260715000001_marketplace_phase4_security_hardening.sql`. Store tests pass 13 suites/118 tests; TypeScript and production web export pass. The migration is live as `20260715115929 marketplace_phase4_security_hardening`; grants verify `anon=false`, `authenticated=false`, `service_role=true`. `store-profile` version 1 is ACTIVE with `verify_jwt=true`; unauthenticated live smoke returned `401`. Positive authenticated owner-write smoke awaits an approved disposable credential.

> 2026-07-15 Phase 5 review refresh: Consumer discovery is locally complete after red-test remediation. Public-only services now include runtime validation, safe filter construction, explicit paging/retry, store-name discovery, and book availability detail. Migrations `20260715155047 marketplace_phase3_public_listing_policy_split` and `20260715155103 marketplace_phase5_discovery_hardening` are live and read-only verification confirms the anonymous/authenticated policy split, pilot-locality eligibility, private inventory/analytics boundary, constrained boolean demand RPC, rate limiting, and 90-day retention. Relevant Jest 8 suites/54 tests, TypeScript, production web export, and `git diff --check` pass. No fixture or RPC smoke write was performed; positive discovery smoke remains fixture-gated.

> 2026-07-15 Phase 5 acceptance refresh: The authorized positive smoke exposed private-`stores` RLS evaluation returning zero public rows. Red-first migration `20260715000003_marketplace_phase5_public_policy_projection_fix.sql` now evaluates public eligibility through `public_store_profiles` plus the pilot locality and is live as `20260715174111 marketplace_phase5_public_policy_projection_fix`. Anonymous/authenticated title, author, ISBN, store, profile, book-detail, canonical grouping, offer comparison, private-boundary, demand-RPC, disabled-locality, and cleanup checks all pass. Targeted Jest passed 8 suites/52 tests and TypeScript passed. Phase 5 is complete and accepted; Phase 6 was not started.

> 2026-07-16 Phase 6 monolith correction: the exact v0.1 pasted monolith is preserved in the implementation archive and the corrected v0.2 monolith is the sole normative Phase 6 SDD. The intentionally deleted three-document split must not be restored. The corrected design includes direct request creation plus separate cart transition evidence, entitled-Owner availability before submission, cross-table enforcement, safe projections, no substitutions, independent support-task versioning, exact pg_cron/Edge worker architecture, deterministic tariff, fixed ISO-date SLA examples, append-only smoke evidence, lazy abandonment, named shutdown cancellation, and canonical commerce inbox behavior. Local implementation is authorized only after the Stage 4 documentation validation verdict; remote/live changes remain separately gated.

> 2026-07-17 Phase 6 checkpoint refresh: Phase 5 remains complete. Phase 6 Units 1-15 are source-complete, migrations M01-M39 were applied to the development Supabase project, and persisted command/authorization behavior was verified through provider-independent `payment_ready`. M34-M39 are forward-only corrective migrations added after the initial M01-M33 apply. The prior complete repository checkpoint passed 908/908 tests, TypeScript, and production web export. Initial browser authentication/navigation/Marketplace/cart-empty smoke passed without console errors and controlled `phase6_browser_*` development fixtures remain available. The development scheduler rollout is active: scheduler v5 uses custom-secret authentication, worker v2 keeps strict service-role authorization, and scheduler dispatch explicitly forwards its server-side service-role bearer token. Cron job 5 runs each minute; the first scheduled empty-queue run and tagged synthetic dispatch/retry/dead-letter paths passed, with focused regression 4/4. Comprehensive customer/Store Owner browser E2E, browser-created persisted-effect verification, full responsive/accessibility review, and real timed commerce-command verification remain deferred. This is not a production-readiness declaration; Phase 7 is not started.

> 2026-07-18 Phase 6 completion and roadmap decision: Supabase MCP readback reconfirmed the healthy `Bookconnect_reactexpo` development project, all M01-M39 Phase 6 migrations, RLS on authoritative Phase 6 tables, active scheduler v5/worker v3, and successful one-minute cron job 5 executions. Existing inventory has zero quantity-balance violations; the equality constraint remains `NOT VALID` and must be validated by a forward migration before production. Phase 6 is recorded as complete with comprehensive browser E2E, responsive/accessibility review, browser-created persisted-effect review, and real timed commerce-command E2E deliberately deferred. Phases 7 and 8 are deferred by product decision. Phase 9 planning is now the active milestone and must remain independent of payment, paid-order, pickup, ledger, refund, and settlement behavior.

> 2026-07-19 Phase 9 planning refresh: the complete Phase 9 planning set was drafted under `implementation/phase-9-image-inventory/` with a master SDD, six domain SDDs, data dictionary, live database/storage current-vs-target audit, requirements traceability, complexity register, and three-level local tracker split. Supabase was re-verified read-only as project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`); `store_id` is canonical (37 public-schema columns, zero `tenant_id`). Phase 9 begins with camera/gallery same-language spine stacks capped at 15, provider/model adapters, mandatory owner review, advisory duplicates without image comparison, multilingual search aliases, separate damage/media, bookstore-first discovery, and mandatory customer-requested current-copy photos. Repository `AGENTS.md`, `implementation/ACTIVE.md`, Phase 9 `SESSION-START.md`, tracker markers, update matrix, and a read-only continuity validator now provide deterministic new-session resume/closeout. The user approved this planning baseline on 2026-07-19 and authorized the Work Unit 0 plan only. No Phase 9 migration, code, function, bucket/policy, or data mutation occurred.

> 2026-07-19 Phase 9 Work Unit 0 checkpoint: the [contracts/threat/migration-design plan](./implementation/phase-9-image-inventory/work-units/00-contracts-threat-migration-plan.md) is complete and pending user review. It defines versioned internal adapter contracts, recorded fixtures, deterministic and cross-tenant security tests, a six-step expand/backfill/validate/switch migration sequence, forward-correction rules, and explicit pre-migration gates. A fresh exact-project read-only Supabase audit confirmed the baseline facts and pre-existing security backlog. No product code, migration file, provider call, bucket/policy, or Supabase/storage mutation occurred.

> 2026-07-19 Phase 9 WU0 approval refresh: the user accepted the `approved_with_required_corrections` review and authorized documentation correction/commit only. The approved WU0 now separates automated alias proposals from bounded official/verified aliases; excludes private request photos from duplicate identity; locks initiator-only pilot session authority and terminal-input Close; preserves private inventory on publication failure; requires central validation/error/provider/query/grant registers; strengthens privilege/security gates; clarifies the `NOT VALID` quantity gate; and uses eight logical migration groups. WU0A contract/test implementation, migration-file creation/application, provider calls, storage changes, and product code remain unauthorized.

> 2026-07-19 Phase 9 WU0A checkpoint: the user explicitly authorized the bounded server contract/test foundation. Versioned vision, metadata, alias, and marketplace contracts; strict fail-closed parsers; ISBN/BCP 47/fallback/session/duplicate/quantity/publication helpers; central validation/error/provider-reuse/grant/query registers; sanitized synthetic fixtures; and future red implementation gates now exist under the shared server boundary. Focused Jest passed 4 suites/24 tests, all Edge Function test files passed 9 suites/36 tests, and strict standalone TypeScript passed. No migration, callable endpoint, database/storage/provider/network operation, mobile/product write, deployment, or Supabase mutation occurred. WU0A is complete; no later unit is authorized.

> 2026-07-19 Phase 9 WU0A independent approval: an authorized independent review classified every working-tree file and found correctable contract/test gaps, with no unrelated or sensitive change. Corrections centralized limits, required configured HTTPS cover hosts, completed server-owned adapter envelopes and session/publication semantics, strengthened grant/query/privacy registers, and expanded adversarial/no-match/alias fixtures. Final focused Jest passed 4 suites/41 tests, all Edge Function tests passed 9 suites/53 tests, and strict standalone TypeScript passed. WU0A is approved complete. Migration creation/application, callable endpoints, providers, storage, UI/product writes, and external mutations remain unauthorized. WU0B backend/API technical design is next eligible but requires separate authorization.

> 2026-07-19 Phase 9 WU0B definition checkpoint: a planning-only WU0B document now defines the future command/query/DTO inventories, actor and authorization matrix, state/transaction/idempotency boundaries, worker/provider/marketplace/privacy design requirements, red-test mapping, acceptance/non-goal criteria, exact later file-allowlist requirement, and separately ordered review/audit/migration gates. The repository startup chain is normalized as `AGENTS.md` → `ACTIVE.md` → DOC-13 → Phase 9 `SESSION-START.md` → Phase 9 `TRACKER.md`. The definition is not independently reviewed and grants no WU0B implementation authority. No runtime, test, migration, Supabase/Storage, provider, dependency, GitHub, or other external mutation occurred.

> 2026-07-20 Phase 9 WU0B definition-review correction: the independent review returned `approved_with_required_corrections`. The documentation-only correction now routes ACTIVE.md to WU0B, separates scan/public-copy/request-photo upload authority, adds post-commit inventory command coverage, makes listing matching service-internal and public pagination store-grouped, separates implementation completion from independent approval, and hardens the continuity validator against stale ordering and contradictory authority text. Independent re-review remains required. WU0B implementation, runtime endpoints, migrations, Supabase/Storage, providers, UI, and external mutations remain unauthorized.

> 2026-07-20 Phase 9 WU0B definition independent approval: the complete corrected documentation/validator diff was re-reviewed. A missing intermediate definition-approved marker was added so approval cannot be confused with implementation authority. Final verdict is `approved`. The next eligible action is separate authorization for bounded WU0B technical-design implementation only; runtime endpoints, migrations, Supabase/Storage, providers, UI, and Phase 7/8 behavior remain unauthorized.

> 2026-07-20 Phase 9 WU0B technical-design completion: the authorized documentation-only implementation now provides seven bounded artifacts covering 26 commands, 11 queries, DTO/error/rate contracts, authorization/tenancy/privacy, state/transaction/idempotency/publication, jobs/providers/media/lifecycle, marketplace/request-photo seams, red tests, audit questions, and exact proposed later file paths. The authority document routes the artifact set and the validator enforces completeness, size and gate integrity. WU0B is `implementation_complete_needs_review`, not independently approved. No Supabase query/mutation, migration, runtime/test/config/dependency/generated change, provider call, Storage/UI change, deployment, push or merge occurred during this work unit.

> 2026-07-20 Phase 9 WU0B semantic-review correction: an independent review returned `rejected_needs_redesign` on four bounded design gaps. Author corrections now require Owner quantity/price/terms confirmation and an atomic soft hold before request-photo acceptance; use Master SDD §6 as the sole persisted session/input/candidate vocabulary; assign primary boundaries, SDD/WU0A traces, red tests and future units to C01–C30/Q01–Q11; and give every red test exact source ownership and implementation responsibility. WU0B remains `implementation_complete_needs_review` pending a fresh focused reviewer. No Supabase audit or later gate has started.

> 2026-07-20 Phase 9 WU0B focused re-review correction: the focused verdict was `approved_with_required_corrections` because three persisted-state claims still conflicted with their owning SDDs and the validator checked only positive markers. The bounded correction now uses request-photo `none`; records `skipped_false_detection` as a review disposition without inventing a candidate state; maps hold status to `active|released|converted_to_sale` while expiry releases a hold; and makes all three contradictory forms validator failures. WU0B remains `implementation_complete_needs_review` pending a new context-isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B final-review correction: the next isolated verdict was `approved_with_required_corrections` on two narrow ambiguities. C12 and Q11 now select one `AE` authenticated actor-dispatch boundary that rejects mixed/unknown credentials and selects closed Owner/worker or customer/Owner authorization and projection branches. The validator now scans every WU0B artifact for closed state claims and semantic variants rather than three literal phrases; photo, candidate-disposition and hold-expiry wording-variant negative probes pass. WU0B remains `implementation_complete_needs_review` pending a final context-isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B implementation-ownership/semantic-closure correction: a further isolated review showed C12 lacked one exact future boundary file and the validator missed workflow/lifecycle/terminal/persisted-as/transition/arrow wording. C12 is now owned only by the proposed `image-inventory-publication-retry` endpoint, with Owner and worker entrypoints forbidden from duplicating it; Q11 remains request-photo-boundary-owned. Closed state parsing and eleven negative probes cover the reported variants while preserving valid photo expiry versus hold release. WU0B remains `implementation_complete_needs_review` pending another isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B direct-claim closure correction: repeated isolated fuzz review confirmed C12/Q11 ownership but expanded the semantic surface to direct/hyphenated persisted claims, direct state/status/workflow/lifecycle assignments including `=`/`:`, generic terminal, becomes/advances/transitions, `from ... to|into|arrow ...`, possessive declarations, and label/parenthesized arrows. A normalized domain-aware parser now validates a generated 105-case five-domain/twenty-one-form matrix plus two special disposition/photo probes, alongside two C12 ownership/duplication probes. WU0B remains `implementation_complete_needs_review` pending another isolated review. No Supabase audit or later gate has started.

> 2026-07-22 Phase 9 WU0B final independent approval: the final context-isolated review returned exact verdict `approved`. The existing continuity evidence passes 107 semantic cases plus two C12 ownership/duplication probes, and the bounded set remains documentation/validator-only. WU0B is `independently_approved`. The next action is a consolidated Risk-Based Phase 9 SDD analysis in a new session; Supabase audit, migrations, runtime implementation and merge to `main` remain unauthorized.

> 2026-07-22 Phase 9 bounded contract correction: the authorized correction aligned canonical alias vocabulary and lifecycle-only supersession, separated zero-price private save from positive-price publication, removed `committed_publication_failed` from persisted state vocabularies, completed exact C01–C30/Q01–Q11 stable-error mappings and metadata, excluded interactive support takeover/cross-store private access, and added the missing contract/design verification rows while preserving later runtime/release gates. Focused WU0A Jest passed 4 suites/45 tests; TypeScript, continuity/link/size checks, 107 semantic cases, two C12 probes, and `git diff --check` passed. A fresh correction-only review returned exact verdict `approved`. No Supabase access, migration, provider/storage action, runtime implementation, or deployment occurred.

> 2026-07-22 Phase 9 Package 1 audit checkpoint: user-authorized exact-project read-only Supabase audit verified project `ahntbtktjjmvfosgkmgn`, live history through Phase 6 M39, canonical `store_id` tenancy, catalogue/inventory/listing/quantity/condition/provider compatibility, RLS/grants/functions/triggers, Storage, reusable Phase 6 infrastructure, and advisor findings. Two bounded artifacts now record current evidence, the gap matrix, exact proposed schema/RLS/function/index/storage changes, eight migration groups, failing security tests, and genuine blockers. No migration/runtime file was created and no database, Storage, provider, deployment, or external mutation occurred. Package 1 is `audit_complete_needs_review`; migration tests, file creation, and live application remain separately gated.

> 2026-07-22 Phase 9 Package 1 review correction: the six required findings are corrected documentation-only. The design now gives an executable legacy-condition compatibility sequence; persisted purpose/path/entity-bound single-use capabilities for C02/C03, C15/C16 and C20/C21; named-only private access with separate worker/service grants; unique cost reservations on `(store_id, job_id, cost_kind, policy_version)`; exact deferred-FK addition groups; and eight additive Phase 9 groups plus separately reviewed/authorized M09 quantity validation with preflight. Package 1 is `corrections_complete_needs_review`; no Supabase re-query/mutation or migration/runtime file occurred.

> 2026-07-22 Phase 9 Package 1 independent approval: the correction-only reviewer returned exact verdict `approved` and verified all six findings, the 107 existing semantic negative cases, both C12 probes, and unchanged WU0A/WU0B validation strength. Package 1 is `independently_approved`. Failing tests, migration-file creation, M09/live application and runtime remain separately unauthorized. No reviewer edit or Supabase query/mutation occurred.

> 2026-07-22 Phase 9 Package 1 M01-M08 implementation checkpoint: the initial contract suite failed 17/17 with the files absent; M01-M08 now pass 12/12 focused static contracts, 19/19 isolated database/security checks, 26 migration suites/206 tests, and 9 Edge Function suites/57 tests. TypeScript, continuity, and whitespace checks pass. A focused independent database/security review and correction-only follow-ups returned exact verdict `approved`. M09 was not created or validated. No migration was applied to connected Supabase and no Storage, function deployment, provider, UI, or runtime mutation occurred. Status is `package1_m01_m08_independently_approved_not_applied`.

> 2026-07-22 Phase 9 Package 1 live application: repository preparation fast-forwarded and pushed `main` at `69edd90`, then created `phase9-db-live-application`. Exact-project preflight on `ahntbtktjjmvfosgkmgn` was clean. M01-M05 applied and were readback-verified. M06 failed atomically with PostgreSQL `42501 must be owner of table objects` because `storage.objects` is owned by `supabase_storage_admin`; it has no history row and left no bucket/policy residue. M07-M08 were not attempted. M09 was not created/applied. Auth hardening/runtime work was untouched and is deferred to a separate session/branch before private-ingestion mobile integration.

> 2026-07-22 Phase 9 Package 1 live continuation: live readback proved `storage.objects` RLS was already enabled. Correction commit `e07efa1` removed only the redundant owner-only RLS statement from unapplied M06, added policy-preservation contracts, passed focused/full validation, and received independent correction-only approval. M06-M08 then applied once as `20260722095443`, `20260722095545`, and `20260722095729`. Verification stopped because M08's broad public-function grant loop revoked anonymous execution from the three M07 discovery RPCs. M01-M08 remain live and immutable; a separately reviewed forward grant correction is required. M09, auth, providers, mobile, and runtime remain untouched.

> 2026-07-22 Phase 9 Package 1 live verification accepted: red-first forward migration M10 restored `anon` execution to exactly the three public discovery RPCs, made the 24-field projection `security_invoker=true`, and removed all direct client/service view grants without exposing underlying tables. Focused contracts passed 3/3, isolated database/security 20/20, migration regressions 27 suites/209 tests, Edge/security 9 suites/57 tests, TypeScript, continuity, and whitespace checks; independent correction-only review was `approved`. Commit `31253ad` was pushed before M10 applied once as `20260722125256 marketplace_phase9_public_boundary_security_correction`. Live readback proves zero other anonymous Phase 9 RPCs, authenticated-only request-photo RPCs, service-only helpers, zero private client table grants, and removal of the Phase 9 `security_definer_view` advisor error. M09 remains absent and the quantity CHECK remains `NOT VALID`; auth/providers/mobile/runtime remain untouched.

> 2026-07-22 auth hardening checkpoint: approved Work Units 1 and 2 are locally complete and the correction-only final review returned `APPROVED` on `codex/auth-hardening-core`. Production bypass requires development runtime, development app environment, and explicit opt-in; preview/production opt-in is rejected. Zustand owns canonical session/status and one root bootstrap owns guarded restoration. Current-device logout now persists a non-secret deletion-intent marker, retries only the exact Supabase token key after SDK failure, and blocks restart restoration until removal succeeds. Identity replacement remains hidden through cleanup failure and an explicit root retry. Focused verification passed 11 suites/84 tests, isolated TypeScript, and diff hygiene; the reviewer independently passed 7 suites/52 tests. Secure persistence, Android backup, authoritative profile completion, OTP UX, native/offline verification, remote EAS verification, M09, and Phase 9 runtime remain separately gated. No database, Supabase, Storage, migration, deployment, or external mutation occurred.

> 2026-07-23 Phase 9 ingestion-runtime dedicated-worker closeout: the accepted database checkpoint remains `package1_m01_m08_m10_live_verified`. Local M11 and runtime now enforce initiating-Owner/server-path intake, immutable canonical completion replay, content-hashed service-only source snapshots, opaque token-and-attempt lease fencing, retry-safe partial completion, 10 MiB/16 MP and multi-frame rejection, private sanitized linking, and exactly one vision job. ImageMagick WASM sanitation remains outside Edge in a dedicated service-authenticated claimed worker; its 64 MP internal working allowance does not change the 16 MP source ceiling. Focused Jest passed 9 suites/74 tests, Phase 9 PGlite passed 26/26, and both TypeScript checks passed. Three local 8/12/16 MP runs each passed WebP correctness, metadata removal, and stable hashes; median times were 11.77/11.40/14.27 s and ending RSS 169/191/225 MB. A read-only independent review of the current unstaged candidate found one stale M06 Storage-documentation contradiction; after correction, re-review found no remaining merge blocker. This is sizing evidence only. Nothing was applied, deployed, staged, committed, pushed, or merged.

> 2026-07-26 Phase 9 Unit 4 SDD-readiness checkpoint: the ingestion foundation is now accepted as committed on `main` at `0a8e57a`; M11 remains unapplied and both ingestion services remain undeployed. Exact-project read-only Supabase verification reconfirmed M01-M08/M10 as the live tail, worker-ID-fenced generic jobs, private extraction-table grants, no M11/vision RPCs, incomplete immutable candidate provenance, and no deployed ingestion/vision function. The focused Unit 4 design finalizes `p9-vision-v2`, deterministic count/language/repeated-position rules, token/attempt state transitions, one authoritative evidence/candidate/completion transaction, exact replay after response loss, minimum forward M12, stable errors, privacy allowlists, and 31 red-first cases. No code, test, migration file, provider call, Supabase/Storage mutation, deployment, stage, commit, or push occurred.

> 2026-07-26 Phase 9 Unit 4 local implementation checkpoint: the accepted design is implemented with strict `p9-vision-v2`, deterministic `FixtureSpineImageAnalyzer`, platform-owned count/language/repeated-position policy, a dedicated service-authenticated worker, and forward-only local M12 `20260726000012_marketplace_phase9_vision_analysis_runtime.sql`. M12 adds immutable image/observation evidence, candidate provenance/publisher clues, vision-specific attempt/token-fenced claim/context/persist/fail RPCs, exact completion replay, service-only grants, and no inventory/publication/metadata effect. Verification passed 16 Phase 9 Jest suites/108 tests, Phase 9 PGlite 39/39, repository TypeScript, and strict vision-worker TypeScript. M11/M12 remain unapplied, all services remain undeployed, and no provider, Supabase/Storage, stage, commit, push, or merge action occurred.

> 2026-07-26 Phase 9 Unit 4 first-review correction checkpoint: the independent review returned `CHANGES_REQUIRED`. Corrections now require exact authoritative current-claim validation before any job mutation, use existing `resolved` for stale-safe job-only reconciliation of invalid/missing input/session/media relationships, clear leases, and persist/return only bounded safe results. M12 now owns canonical UTF-8 byte counting, SHA-256, and recursive result validation; worker transport uses exact typed safe-code mapping. Verification passed 16 Phase 9 Jest suites/116 tests, Phase 9 PGlite 52/52, repository TypeScript, strict vision-worker TypeScript, continuity, and diff hygiene. Correction-only independent re-review is next. M11/M12 remain unapplied, services undeployed, and no provider, Supabase/Storage, stage, commit, push, or merge action occurred.

> 2026-07-26 Phase 9 Unit 4 final correction checkpoint: the last bounded review identified database retryability ownership, catch-all RPC behavior, absolute/UNC path validation, and executable boundary coverage. PostgreSQL now derives retryability from a closed safe-code catalogue; rejected RPC promises and unknown permanent domain failures have separate bounded classifications; TypeScript/SQL reject path-shaped evidence without rejecting slash prose; and PGlite covers every authoritative RPC plus exact 262,143/262,145-byte canonical boundaries. Final verification passed 16 Phase 9 Jest suites/132 tests, Phase 9 PGlite 57/57, repository TypeScript, strict vision-worker TypeScript, continuity, and diff hygiene. Final Git integration of this exact candidate is authorized; M11/M12 remain unapplied, all services remain undeployed, and no provider, metadata, inventory/publication, Supabase, or Storage operation occurred.

> 2026-07-26 Phase 9 deployment-runtime scaffolding checkpoint: Unit 4 is integrated on `main` at `e9ba2d9`. Local Work Unit 4A adds provider-neutral executable Node services for sanitation and fixture vision, strict positive-allowlist environment loading, distinct-secret fingerprint checks, non-mutating health/readiness, one-request concurrency, bounded bodies, graceful shutdown, safe structured logging, dynamically request-bound allowlisted fixtures, a sanitized manual invoker, deterministic builds/containers, deployment validation, and JWT-enabled local Owner Edge configuration. Explicit Phase 9 Jest passed 17 suites/150 tests, PGlite passed 57/57, repository TypeScript, both strict worker builds, and the deployment validator passed. M11/M12 remain unapplied, all services remain undeployed, fixture evidence is retained by policy, and no Supabase/Storage, secret, provider, staging, commit, push, or merge operation occurred. Independent review is next.

> 2026-07-26 Phase 9 M11/M12 live-application checkpoint: exact project `ahntbtktjjmvfosgkmgn` was healthy and the clean repository baseline was `cc98901`. M11 applied once as `20260726182238`; M12 applied once after it as `20260726182539`. Live readback verified the ingestion columns/constraints/indexes, immutable analysis tables and triggers, candidate lineage, reconciliation constraints, and service-only hardened RPCs. Inventory/listings/events stayed 5/5/14, quantity violations stayed zero, both private buckets stayed unchanged with zero objects, and no service, secret, or provider was deployed/configured/called. M12's first truncated MCP transport submission failed atomically with no history row or partial object before the unchanged SQL was resubmitted losslessly. Security advisors ended at 174 (`INFO 48/WARN 125/ERROR 1`), with the only M12 delta being two expected service-only RLS/no-policy INFO notices.

> 2026-07-27 Phase 9 M11/M12 closeout checkpoint: the eight-file documentation-only ledger/live-state/handoff/evidence update was committed and fast-forwarded to `main` as `4abeef89ecebdb7a74a8ece3a1bdc0d5cfe6c8c5`; local and remote refs matched and the worktree was clean. Final read-only Supabase confirmation found the exact project healthy, M11/M12 still present exactly once at their recorded versions, and no Phase 9 ingestion/vision Edge Function. No deployment, secret configuration, Storage-object operation, provider call, or further Supabase mutation occurred.

> 2026-07-27 Phase 9 fixture-pipeline deployment checkpoint: the JWT-verified Owner Edge Function and separate free-plan `phase9-media-sanitation` / `phase9-fixture-vision` Render services are live. M13 is live once as `20260727025046` with 13 minimum postgres-owned, empty-`search_path` `SECURITY INVOKER` wrappers; existing `service_role` grants proved sufficient and the private schema remains unexposed. Both Render services are live at `96991a99a8e24146db709653ebc287b8c2404430`, auto deploy is off, and health/readiness/auth/log-privacy checks pass. Deployed `one_book` plus eight fresh-process fixture cases passed normal claim/fencing/persistence/failure paths with `batchSize: 1`; commerce stayed 5 inventory/5 listings/5 published. No real provider, metadata, UI, inventory, publication, scheduling, autoscaling, or Library work occurred. [Detailed evidence](./implementation/phase-9-image-inventory/trackers/06-fixture-pipeline-deployment-evidence.md).

> 2026-07-27 Phase 9 provider/scale SDD reconciliation: the documentation-only reconciliation now defines replaceable provider-neutral metadata contracts, exactly one primary and zero or one secondary, bounded sequential fallback, coherent single-source selection, cache/query/attempt/cost/capability/quality lineage, manual degradation, horizontally safe workers, graceful shutdown, capacity admission, fairness, independent stage scaling, and a fixed-multi-replica gate before autoscaling. Real Gemini design is a separately gated prospective Unit 4B; Unit 5 remains Metadata/aliases. Status is `needs_independent_review`. No runtime, migration, provider, Supabase/Storage, Render, deployment, scheduling, or autoscaling mutation occurred.

> 2026-07-27 Phase 9 provider/scale F1–F3 correction: the bounded documentation correction preserves the required provider-neutral primary/optional-secondary seam while deferring secondary selection and activation, distinguishes media/vision/metadata capacity signals, disables raw provider/model payload persistence by default with separately approved diagnostic capture deleted within seven days, and excludes credentials from mobile, Git, documentation, build arguments, logs, telemetry, errors, and model context. Status remains `needs_independent_review`; no runtime, migration, provider, database, Storage, deployment, scheduling, or autoscaling mutation occurred.

> 2026-07-27 Phase 9 Unit 4B checkpoint: the founder authorized the local Gemini
> adapter and narrowly superseded the initial primary vision model ID from
> `gemini-3.5-flash` to configuration-driven `gemini-3.5-flash-lite`; the earlier
> decision remains historical. The adapter is locally implemented behind
> `SpineImageAnalyzer` with strict schema normalization, bounded usage/cost
> evidence, safe error classes, and server-only credential boundaries. No live
> provider call, credential configuration, migration, database/Storage mutation,
> deployment, scheduling, autoscaling, metadata, UI, inventory, or publication
> change occurred. One independent Unit 4B review is next.

> 2026-07-27 Phase 9 Unit 4B persistence correction: the two confirmed review
> blockers are corrected locally. Forward-only M14 adds dedicated service-only
> provider-attempt lineage and bounded register/finalize/associate/mark RPCs;
> Gemini now receives a private media handle only after atomic final claim and
> complete store/session/input/media validation. Focused mocked/PGlite evidence
> covers durable usage/injected cost, duplicates, accepted/stale/unknown outcomes,
> and zero download/provider calls after rejection. M14 was not applied and no
> provider, credential, Storage, deployment, metadata, UI, or commerce mutation
> occurred. One correction-only independent review is next.
>
> 2026-07-27 Phase 9 Unit 4B final correction: the egress fence now performs
> complete claim/media validation immediately before private download and again
> immediately before Gemini invocation. Logical spend identity is stable across
> claim retries and separate from unique provider-attempt identity. TypeScript and
> M14 apply the same bounded semantic pricing allowlist, and the Phase 9 migration
> test names the exact ordered M01-M08/M10-M14 set. M14 remains unapplied; no live
> provider, credential, database, Storage, deployment, or product mutation occurred.
>
> 2026-07-28 Phase 9 M14 application: exact-project preflight confirmed M14 absent,
> M01-M08/M10-M13 each once, M09 absent, and every dependent relation, constraint,
> function, grant, and RLS assumption. M14 then applied once as
> `20260727183546 marketplace_phase9_vision_provider_attempts`. Live readback proves
> the empty 34-column provider-attempt table, approved constraints/indexes, exact
> private/public RPC signatures, RLS, and zero anon/authenticated authority; M12/M13
> fixture seams remain intact and Phase 9 PGlite passed 67/67. No Storage, Edge
> Function, credential, Gemini, Render, autoscaling, metadata, or product mutation
> occurred. Gemini deployment and live verification remain deferred.
>
> 2026-07-28 Phase 9 M15 application and security stop: correction commit
> `1168655` was fast-forwarded to `main`; the complete checked-in 60,915-byte
> M15 payload (SHA-256 `21c298e77e1008f2fd0fd50b33ede9ec1f74479779cf53679f5bb638dc69d9f4`,
> Git blob `573c11dbe073c31b2729874a011e11413e6969d1`) was submitted once to
> project `ahntbtktjjmvfosgkmgn` and applied as
> `20260727222159 marketplace_phase9_metadata_foundation`. Schema, constraints,
> indexes, immutable trigger, RPC signatures, fixed search paths, client denials,
> fencing, lineage, cost, and no-inventory/publication checks passed. Closeout
> stopped because Supabase default privileges left
> `service_role=arwdDxtm/postgres` on all three new metadata tables despite M15's
> intended read-only grant. M15 remains live once and M09 absent; a separately
> authorized forward-only grant correction is required before Unit 5B.
>
> 2026-07-28 Phase 9 M16 local correction checkpoint: forward-only
> `20260728000016_marketplace_phase9_sensitive_table_acl_correction.sql` is
> created, locally effective-privilege verified, and independently approved.
> It covers `vision_provider_attempts` plus the three M15 tables because all four
> are RPC-only mutation boundaries. M16 is not live; M15 remains live exactly
> once, M09 remains absent, and Unit 5B remains gated on merge plus separately
> authorized exact-project application/readback. [Evidence](./implementation/phase-9-image-inventory/trackers/09-m16-acl-correction-evidence.md).
>
> 2026-07-28 Phase 9 M16 application stop: approved commit `f59d8ed` was
> fast-forwarded to `main`, and exact M16 applied once as
> `20260727231217 marketplace_phase9_sensitive_table_acl_correction`.
> INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER are now denied to
> `service_role` on all four RPC-only tables; SELECT, RLS, ownership, 13 RPC
> grants/search paths, and client denial pass. PostgreSQL 17.6 raw ACL readback
> exposed inherited MAINTAIN (`service_role=rm/postgres`) on all four tables.
> Unit 5B remains gated on separately authorized forward M17 correction/review/
> application. M09 remains absent; no data, Storage, provider, or product change occurred.
>
> 2026-07-28 Phase 9 M17 closeout: correction commit `cbd98c7` was
> fast-forwarded to `main`, and exact M17 applied once as
> `20260727233457 marketplace_phase9_maintain_acl_correction`. PostgreSQL 17.6
> readback proves `service_role=r/postgres` on the M14 provider-attempt table
> and all three M15 metadata tables: SELECT only, including no MAINTAIN.
> RLS/postgres ownership, client denial, and all 13 hardened RPC
> grants/signatures/fixed search paths remain intact. Unit 5A is live-verified;
> Units 5B/5C remain not started and separately authorized. [Evidence](./implementation/phase-9-image-inventory/trackers/10-m17-acl-correction-evidence.md).

> 2026-07-28 Phase 9 Unit 5B candidate: the Google Books API v1 primary
> metadata adapter, bounded server-only transport, coherent-edition
> normalization/ranking, and Unit 5A-ordered production composition are locally
> implemented with sanitized schema-derived fixtures. The official provider
> audit records storage/reuse as registry- and legal-review-gated. No migration,
> credential, live Google Books call, provider-registry/Supabase/Storage
> mutation, deployment, inventory, publication, or alias effect occurred. The
> exact pushed candidate requires independent review; Unit 5C remains unstarted.

> 2026-07-29 Phase 9 Unit 5C Lite documentation candidate: the founder approved
> the target specification and confirmed positive-price publication remains
> unchanged; price-on-request is excluded. Governing documents now separate the
> implemented selected-language/strict-`p9-vision-v2`/live-M01 state from the
> auto-detect, per-field language/script, original-first, optional-sidecar,
> independently reconciled, store-scoped active-only target. Implementation is
> not started. The exact documentation tip awaits independent review; no code,
> migration, Supabase/Storage, provider, deployment, UI, index, inventory,
> publication, or commerce mutation occurred.

> 2026-07-29 Phase 9 Unit 5C Lite documentation approval: independent review of
> candidate `d73a9b1` required one bounded correction because three stable
> handoffs still presented selected-language/three-English-alias wording without
> the current-runtime/superseded-target distinction. Corrected tip `3d19ce5`
> passed the full continuity/alignment suite and independent re-review returned
> `APPROVED` with no findings. The candidate is ready for push/merge. Unit 5C
> implementation, migrations, UI, provider calls, indexing, inventory,
> publication, and commerce remain unauthorized.

> 2026-07-29 Phase 9 Unit 5C-1 implementation candidate: the approved Unit 5C
> Lite documentation is merged on `main` at `b44277aa5f3965c7f02295c4ac855abc467413e1`.
> The provider-neutral optional sidecar contract, observation-qualified
> title/author source association, BCP 47/ISO 15924 validation, deterministic
> comparison/deduplication, and sanitized fixture-gated companion decoder are
> locally complete. Active Gemini generation, strict `p9-vision-v2`, worker
> persistence, M01 aliases, migration/schema, provider calls, UI, index,
> inventory, publication, deployment, and commerce remain unchanged. Exact-tip
> independent review is required before user merge authorization.

> 2026-07-29 Phase 9 Unit 5C-2 persistence candidate: Unit 5C-1 is merged to
> `main` at `8aadf178aa2b14293a7c0168f3b41e90ebf61d52`. M18 adds a separate
> private store/analysis/candidate/observation/field-scoped proposal table and
> token/attempt-fenced service read/write RPCs while preserving the existing M01
> `book_search_aliases` representation. The exact reviewed migration is live
> once on development project `ahntbtktjjmvfosgkmgn` as
> `20260729004216 marketplace_phase9_search_variant_proposals`. PostgreSQL 17.6
> readback and a rollback-only synthetic smoke prove proposed/non-searchable
> persistence, duplicate-free replay, mismatched-claim zero effects,
> title/individual-author separation, store-bounded reads, client denial,
> service SELECT-only/RPC mutation, no MAINTAIN, unchanged aliases, and zero
> smoke residue. Gemini generation, activation, search exposure, Owner UI,
> inventory/listing creation, publication, deployment, and commerce remain
> unchanged. The first staged-tree review found an accepted-envelope replay
> defect. The authorized forward M19 fingerprint fence is live once as
> `20260729020008`; changed accepted replay now rolls back without appending.
> The corrected exact tree was independently approved with no findings and
> fast-forward merged to `main` at
> `b3980349d9d446fbf1820ef869f6664953d9a599`. Unit 5C Batch 1 remains
> separately gated and unauthorized.

> 2026-07-29 Phase 9 Unit 5C-3 closeout: optional multilingual companion
> generation now shares the existing single Gemini call while canonical
> `p9-vision-v2` remains independently strict. Accepted sidecars persist through
> M18/M19 and reconcile confirmed Owner title and individual-author fields with
> narrow deterministic normalization, default-deny activation, and trusted
> proposed/active/stale lifecycle transitions. M20 is live as `20260729054842`;
> it temporarily contained combined Unit 5C-3/5C-4 behavior. Immutable forward
> M21 is live as `20260729060238` and removed the public search RPC, alias
> materializer, inventory/listing linkage, and related trigger/search effects.
> The final Unit 5C-3-only tree `eabe1040b4dbe89cf5163754fd719a11673a8682`
> received independent verdict `APPROVED` and merged to `main` at
> `f09301b76fb14714f942a98f0ceffa5d5a0c3178`. Unit 5C-4 active store-scoped
> alias materialization and search consumption is the next active task in a new
> session; display/UI/actions, benchmarks, rollout, inventory/publication,
> commerce, provider fallback, and global alias authority remain deferred.

> 2026-07-29 Phase 9 Unit 5C-4 closeout: active Unit 5C-3 proposals now
> materialize only within exact store/source-field and eligible existing-target
> authority, with independent title/one-based-author linkage, idempotent
> materialization/retraction, and fail-closed Roman title/author search that
> preserves original, ISBN, canonical, and legacy approved-alias behavior.
> Exact tree `db8ea75ed2904e8c381eec814f96804198d16b1e` received verdict
> `APPROVED` and fast-forward merged at
> `d092f081d95b8c551bfcadcfd58fe8c98c77dfb2`. M22 is live as
> `20260729075459`; immutable M23 is live as `20260729082153` and
> forward-corrects legacy approved-alias ranking plus stricter source
> reconciliation. PGlite 35/35, Jest 53/53, scoped TypeScript, continuity,
> secret/pyc checks, and zero-residue rollback smoke passed. No display schema,
> Owner decision authority/UI, benchmark/rollout, inventory/publication,
> commerce, provider fallback, or global alias authority was added. The next
> active batch combines Unit 5C-5/5C-6 backend work after this closeout merges.

> 2026-07-26 Phase 9 Unit 4A review-correction checkpoint: the independent review returned `CHANGES_REQUIRED` for unsafe Docker context, pre-authentication slot starvation/read deadlines, nondeterministic shutdown evidence, source-string-only deployment claims, and identity-only fixture tests. All five corrections plus bounded invoker responses are locally focused-green. A deny-by-default Docker context, pre-admission constant-time authentication, fixed body deadline, deterministic shutdown test, real compiled-entrypoint smoke, per-fixture semantic matrix, synthetic-only container script, and minimal-permission pull-request workflow now exist. The mandatory GitHub Actions image build/start gate is next; no live credential, image push, deployment, migration, provider, Supabase, or Storage operation is authorized.

> 2026-07-30 Phase 9 Unit 5C-5/5C-6 backend closeout: exact tree
> `66db5be740940a8c882bb7ea312817f4c33bb2db` received independent Review A
> `APPROVED` and Review B `APPROVED`. Exact M24-M28 applied once to
> `ahntbtktjjmvfosgkmgn` as `20260730022442`, `20260730022524`,
> `20260730022559`, `20260730022636`, and `20260730022713`; M18-M23 remained
> unchanged and M29 remained absent.
> Live strict-role, RLS/ACL/search-path/no-MAINTAIN, benchmark evidence,
> revocation, exact rollout, and real two-connection replacement concurrency
> checks passed with zero synthetic residue. Final local verification passed
> Jest 140/140, PGlite 53/53, scoped TypeScript, and continuity 195/0/0.
> Implementation commit `4b667fc6674d606a8f88e2a4ee933d79bf332f53`
> preserves the approved tree. No language is benchmarked or approved, no
> capability is enabled, visual UI remains deferred, and no
> inventory/publication/commerce behavior was added.

> 2026-07-30 Phase 9 Unit 6 design-authority closeout: Unit 5C-5/5C-6 is
> merged on `main`; M24-M28 remain immutable and were applied live exactly
> once. No language is benchmarked, approved, or enabled; no capability is enabled. The Unit 6 Owner
> Capture, Review, and Recovery UX SDD and contract matrix are
> `approved_design_authority` after independent backend/security and
> product/UX/recovery/accessibility reviews both returned zero final findings.
> The design fixes eight exact Owner-safe contracts, strict review fields,
> deterministic presentation mapping, initiator-only queue/session ownership,
> 40 mapped acceptance criteria, and independent 6A-6F merge boundaries. Unit
> 6 implementation has not started. The next authorized work is Phase 9 Unit
> 6A — Owner-safe backend contract foundation only; Unit 7 remains separately
> gated. No runtime migration, deployment, Supabase, Storage, provider, or
> other external mutation occurred in the design session.

> 2026-07-30 Phase 9 Unit 6A live verification: M29 is live exactly once as
> `20260730162700 marketplace_phase9_owner_safe_contracts`. Authenticated
> Owner RPC smoke passed 21/21 bounded receipts through ordinary user sessions:
> initiating Owner reads/mutations, four actor denials, non-enumeration,
> DTO/private-table privacy, review version/replay fences, readiness, Close,
> and Unit 7 noninterference. Post-smoke readback proves zero mutable workflow,
> inventory, listing, public-projection, commerce, or Unit 7 residue.
> `retained_immutable_synthetic_audit_evidence` consists only of two immutable
> marketplace events and the minimum inert store/Auth anchors under explicit
> authorization; the store is closed/non-selling with no public profile or
> membership, and the user is banned. No append-only protection was changed.
> No deployment, Unit 6B, or Unit 7 work occurred.

> 2026-07-30 Phase 9 Unit 6B local completion: Unit 6A is merged on `main` and
> live-verified through M29. Unit 6B adds the nested guarded Inventory route
> tree, exact five-read Owner UX adapters, strict portable response/request
> contracts, identity-complete React Query keys/defaults, and serialized
> cancel-before-remove private-cache cleanup. Feature commit `9ef9eb3` is
> locally verified; [tracker 20](./implementation/phase-9-image-inventory/trackers/20-unit6b-route-query-cache-evidence.md)
> owns the detailed receipt. No migration, Supabase/Storage mutation,
> deployment, provider call, or other external mutation occurred.

> 2026-07-31 Phase 9 Unit 6C merge completion: Unit 6B is merged at `9ef9eb3`.
> Unit 6C implementation commit `b87469d` adds Owner Start/Resume discovery,
> explicit camera/gallery setup, preview, cancellable signed transport,
> byte-versus-registration retry, progress polling, route/session recovery,
> terminal handoff, and repeatable identity cleanup. The final affected command
> passed 9 suites/56 tests, TypeScript passed, and the authorized diff-only
> closure returned `CLOSED`. Bounded Expo web compiled 2,216 modules and proved
> authorization-first route privacy with zero errors; the supplied account had
> no Active Store Owner membership, so Owner-only/native/upload states remain
> deterministic-test evidence. No migration, Supabase/Storage mutation, live
> upload, deployment, provider call, inventory/publication, or commerce change
> occurred. [Tracker 21](./implementation/phase-9-image-inventory/trackers/21-unit6c-capture-upload-recovery-evidence.md)
> owns the detailed receipt. The fast-forward merge is on `main` through
> evidence commit `092562d`.

> 2026-07-31 Phase 9 Unit 6D merge completion: Unit 6D implementation commit
> `c363b60` adds the Owner candidate list and strict candidate editing flow,
> fail-closed refresh authority, explicit condition/damage/sellability handling,
> conflict recovery, dirty-navigation protection, and identity-scoped query
> cleanup. Focused verification passed 11 suites/98 tests, the corrected
> candidate suite passed 14/14, compatible TypeScript and diff checks passed,
> and the final narrow sensitive-slice closure returned `CLOSED`. The bounded
> browser receipt proved authorization-first privacy with zero console errors;
> authenticated mutation states remain deterministic-test evidence because the
> supplied account had no Active Store Owner membership. No migration,
> Supabase/Storage mutation, deployment, provider call, inventory/publication,
> commerce, or other external mutation occurred. [Tracker 22](./implementation/phase-9-image-inventory/trackers/22-unit6d-candidate-review-evidence.md)
> owns the detailed receipt.

> 2026-08-01 Phase 9 Unit 6E finalization: the previously closed diff-only
> correction checkpoint `8bceab260a953b4d832fd55f34f58db12fa009b1` was frozen
> at tree `8a70bbb3b102ecda22f2904f20952852849567f1` with no later or uncommitted
> contamination. The checked-in M30 correction was applied exactly once after
> exact-project M29 preflight; Supabase readback records
> `20260801093048 marketplace_phase9_unit6e_review_corrections` with no later
> migration. Focused verification passed 12 suites/95 tests, remote-backed
> integration passed 3/3, compatible TypeScript passed, and continuity passed
> with 195 definitions and zero duplicate/missing traceability. The bounded
> authenticated browser reached `/library`, `/profile`, `/status`, and
> `/inventory`; the supplied account remained under Store Owner application
> review, so private scan data was withheld and no Owner mutation was attempted.
> No Storage, provider, deployment, inventory, publication, or commerce mutation
> occurred. [Tracker 23](./implementation/phase-9-image-inventory/trackers/23-unit6e-review-corrections-evidence.md)
> owns the detailed receipt; Unit 6F now requires separate authorization.

> 2026-08-02 Phase 9 Unit 6F browser/readback closeout: the feature branch
> `codex/phase9-unit6f-readiness-quality-gates` was verified at final correction
> head `a0d55b5e50d4dc3990851643d10bc05a54c54514`. Authenticated Expo web
> verification covered canonical Review Save persistence, stale-scope fencing,
> confirmation safeguards, exact `Confirming…`, one Close, closed-session
> persistence, narrow reflow, and zero inventory/listing/publication effects.
> Focused deterministic verification passed 22 suites/155 tests, auth/owner
> verification passed 15 suites/114 tests, app auth/Owner route tests passed
> 5 suites/11 tests, TypeScript passed, and continuity passed. The mandatory
> representative low-end Android evidence required by Unit 6 SDD §§24, 28, and
> 34 and U6-AC36/U6-AC39 was not run; Unit 6F remains incomplete and unmerged.
> [Tracker 24](./implementation/phase-9-image-inventory/trackers/24-unit6f-readiness-quality-gates-evidence.md)
> owns the detailed receipt and `USER_ACTION_REQUIRED_NATIVE_EVIDENCE` verdict.

> 2026-08-02 Phase 9 Unit 6F native UUID remediation checkpoint: the bounded
> scan-startup correction added SDK54-compatible `expo-crypto`, removed the
> browser-global crypto dependency, and made capture attempt identities lazy
> and render-stable. Focused capture verification passed 2 suites/17 tests,
> the full image-inventory suite passed 33 suites/223 tests, TypeScript passed,
> and no Supabase/Storage/migration/external mutation occurred. No Android
> device or emulator was available to `adb`, so the mandatory native gate
> remains outstanding; `store_inventory` investigation was intentionally not
> started. Tracker 24 owns the detailed evidence.

> 2026-08-03 local web runtime and route-warning checkpoint: the concrete
> Store Owner Orders route was corrected from `orders` to `orders/index`, with
> a regression assertion. Production web export passed after bundling 2,245
> modules. The Codex in-app browser authenticated with the supplied development
> OTP and rendered `/library`, `/dashboard`, and `/inventory` without browser
> errors; only existing framework, notifications, Sentry, and style warnings
> were observed. A fresh exact-project read-only check confirmed
> `store_inventory` RLS is enabled, authenticated table SELECT/INSERT/UPDATE
> are denied, the owner policies remain present, and the controlled inventory
> RPCs are executable by authenticated clients. The legacy store dashboard and
> inventory services still call `.from('store_inventory')`; the inventory hook
> currently swallows that read error. No database, migration, Storage,
> deployment, inventory, listing, or publication mutation occurred. The
> native Unit 6F evidence gate remains outstanding.

> 2026-08-03 WU1 owner-inventory read-boundary re-sequencing: the user
> explicitly authorized WU1 ahead of the Unit 6F native gate, limited to the
> contract addendum, red tests, local/static validation, and an unapplied
> forward migration draft. The exact development project
> `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`) was re-verified read-only;
> live migration history still ends at M30. The stable
> `phase9_owner_inventory(uuid)` detail RPC remains intact. Focused contract
> tests passed 6/6 after the intentional pre-draft red run, and local PGlite
> draft parse/readback passed 1/1. No SQL was applied and no client/UI/service,
> dashboard, inventory, listing, publication, Storage, deployment, or external
> mutation occurred. [WU1 evidence](./implementation/phase-9-image-inventory/trackers/25-owner-inventory-read-boundary-wu1-evidence.md)
> owns the detailed receipt; separate SQL/security approval is required before
> applying the draft, after which the Unit 6F native gate resumes.

> 2026-08-04 WU1 correction checkpoint: the review findings were handled within
> the existing local-only boundary. Explicit NULL page sizes now fail closed;
> unexpected SQL failures map to `P9_INTERNAL_ERROR`; `asOf` is documented as an
> ordering horizon rather than a repeatable database snapshot; and the
> continuity validator requires the WU1 addendum/evidence artifacts and boundary
> markers. The correction-focused Jest suite is 9/9 green after an intentional
> 3-test red run; corrected PGlite passed 1/1, continuity passed with 65
> Markdown files/51 required phase files, and `git diff --check` passed. The
> draft remains unapplied, live migration history remains
> at M30, and no client/UI/service, write-path, database, Storage, deployment,
> inventory, listing, publication, or external mutation occurred. Independent
> review and separate application approval remain required.

> 2026-08-04 WU1 correction closure: the cursor helper call is now outside the
> narrow cast-error handler, so unexpected helper failures reach
> `P9_INTERNAL_ERROR` while malformed timestamp/UUID values remain
> `P9_CURSOR_INVALID`. Local behavior coverage now passes equal-timestamp
> keyset pagination, filters, empty results, invalid page-size/cursor,
> Owner/anonymous scope, and unexpected-helper normalization. Focused WU1
> Jest is 10/10, local PGlite is 3/3, and continuity reports separate
> `WU1_DIFF_CHECK=PASS`, `REPOSITORY_DIFF_CHECK=PASS`, and
> `PHASE9_CONTINUITY_CHECK=PASS`. No Supabase mutation occurred; WU1 remains
> unapplied and independent review plus separate application approval remain
> required.

> 2026-08-04 WU1 exact-project application and readback: the user-authorized
> development-only migration `20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`
> was applied exactly once through Supabase MCP to
> `ahntbtktjjmvfosgkmgn` and is recorded live as
> `20260803221216 marketplace_phase9_owner_inventory_read_boundary`.
> Preflight matched `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`, and the M30
> tail; the new RPC/index were absent before application. Post-readback proves
> the exact eight-argument `jsonb` RPC, `STABLE SECURITY DEFINER`, postgres
> owner, empty `search_path`, narrow execute ACLs, exact descending index,
> unchanged detail RPC, and unchanged `store_inventory` RLS/policies/table
> ACL/trigger boundaries. Anonymous REST execution returned HTTP 401. No rows,
> users, fixtures, listings, publications, Storage objects, providers,
> deployments, or client/dashboard/write-path behavior changed. Positive Owner
> JWT runtime cases remain deferred because no approved Owner credential or
> active Owner browser session was available; Unit 6F native evidence remains
> outstanding and Unit 7 remains separately gated.
>
> 2026-08-04 WU2 read-only Owner inventory client integration: the active
> Store Owner `/inventory` route now calls
> `phase9_owner_inventory_page_v1` through a strict exact-shape DTO decoder,
> identity/store/contract/filter-isolated infinite-query cache, opaque cursor
> pagination, exact WU1 filters, and distinct read error/partial-page states.
> The reachable route graph no longer imports the legacy direct-table inventory
> service. After correction-review closure, focused WU2 tests pass 4 suites/50
> tests and the related regression set passes 39 suites/303 tests;
> strict offset timestamps/positive versions, non-destructive failed refresh,
> explicit current-generation refresh fencing, no unauthorized retry, and
> truthful category/operation/empty states are covered. TypeScript passes with
> `--allowImportingTsExtensions`. No migration, database/storage row, Edge
> Function, deployment, dashboard, write path, or Unit 7 behavior changed.
> Authenticated Owner runtime remains deferred pending an approved session.
> A final focused correction removed the global header Refresh control from
> unauthorized initial and partial states; screen 15/15, focused 4 suites/50,
> and related 39 suites/303 remain green without external mutation.

> 2026-08-05 Android 11 observation and browser follow-up: the user reports
> accessible large-text use and a connected native camera. No device model,
> font-scale/screen receipt, performance trace, or offline/reconnect evidence
> was supplied, so this is not promoted to the mandatory Unit 6F native gate.
> Browser follow-up covered authenticated Owner read/filter/search/review/Resume,
> sanitized fixture upload, disposable Review Save, logout/re-authentication,
> and unavailable-session Retry with zero browser errors. The disposable session
> remained active with four images processing, so Close was unavailable on that
> session; cross-store and inactive-Owner fixtures remain deferred. Unit 6F
> remains incomplete under SDD §§24, 28, and 34; Unit 7 remains gated.

> 2026-08-05 15-card/Gemini clarification: code tracing confirms that the
> image-inventory UI consumes decoded Owner candidate DTOs and does not invoke
> Gemini directly. Deterministic `ownerUxTestFixtures.ts` data covers fifteen
> ordered candidates, an independent partial failure, and the over-fifteen
> safeguard; the focused suites pass 2 suites/20 tests. This closes the local
> fixture-backed UI/contract check only. Live Gemini/provider verification,
> native fifteen-card responsiveness/memory, the remaining representative
> Android Unit 6F evidence, and the deferred WU1/WU2 runtime cases remain
> pending; Unit 7 remains gated.

| Field | Value |
|---|---|
| Current phase | Phase 9: Image-to-LLM Inventory — **Unit 6G post-scan corrections and Store View confirmation were pushed with two known deviations; no current connected state is asserted** |
| Overall status | `unit6g_post_scan_git_published_with_deviations` |
| Last updated | 2026-09-28 |
| Latest handoff | On `codex/phase9-duplicate-confirmation`, local post-scan corrections A–C, the buffered-edit Add guard, and Store View Publish confirmation are implemented. Current affected Jest passed 10 suites/158 tests; TypeScript, continuity, and diff hygiene passed. No current live app, database, Storage, Edge, or worker state was checked. The latest recorded connected-session readback remains 2026-09-22: two private commits and three candidates in review. |
| Current risk level | ₹0 with `publish` intent remains rejected before private Add in mobile, Edge, and SQL; the cover lacks the Detected source badge promised by Unit 6G. The Owner elected Git publication with these deviations unresolved. Local tests do not establish deployment or connected behavior. |
| Next recommended task | Obtain an Owner decision on the price-intent and cover-source deviations before deployment or connected proof. Connected proof, migration work, database/Storage mutation, and deployment require separate authorization. |

### 2026-08-16 Unit 7C resumed connected canary PASS

- The bounded continuation used the authenticated in-app Browser through the
  existing Owner Edge v8 and the exact development project
  `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`. It covered private-only
  Save, deliberate stale Save rejection, stock `1 -> 0 -> 1`, Pause → Republish,
  approved media ADD, history/privacy, and Store View/Inventory/Store Profile
  routing.
- Final readback: canary inventory version `6`; publication intent version `4`;
  published/active/low-stock; quantity `1/1/0/0/0`; stable listing identity;
  four revisions; audit/events `9/9`; one approved public media link; and two
  relevant media assets. Public snapshots remained allowlisted without private
  notes, raw storage paths, upload tokens, or provider payloads.
- Media ADD deliberately reused the existing U7B authorization/upload/link path,
  so it emitted no separate Unit 7C audit/event/revision. No migration, Edge
  redeploy, direct SQL business write, repair/reset, or manual worker claim
  occurred. Publication and merge to `main` are complete at merge commit
  `2be793e6212b1b485737c5045d701c99169490e4`; no further Unit 7C connected
  mutation is authorized without separate approval.

### 2026-08-17 Unit 7C publication and main integration

- Documentation closeout commit `e8a4d46` was pushed on
  `codex/unit7c-wu5-store-view-cutover`; the branch was merged into `main` as
  `2be793e6212b1b485737c5045d701c99169490e4`.
- GitHub PR creation was blocked by the connector's `403 Resource not
  accessible by integration`; the authorized local merge path completed.
- No Supabase migration, Edge deployment, secret, service, or unrelated
  worktree entry changed. The next gate is separate authorization for the next
  Phase 9 work unit.

### 2026-08-16 Unit 7C M46 bounded correction PASS

- The confirmed defect was the unconditional M43 Save call to the append-only
  publication-revision helper. When no prior revision existed, the helper's
  NULL-baseline comparison treated a private-only Save as a first public
  revision even though `v_public_changed=false`.
- M46 is the single forward-only migration
  `20260816000046_marketplace_phase9_unit7c_private_save_revision_correction.sql`.
  It preserves the M43 transaction, idempotency, audit/event, projection, and
  security boundaries and calls the revision helper only when
  `v_public_changed`; private-only Save returns no revision.
- RED-first isolated proof reproduced the pre-M46 defect (`expected 0,
  actual 1`). Post-correction disposable inventory management is 18/18; the
  M01→M46 real-PostgreSQL proof is PASS; existing filter/media-history
  regressions are 15/15; static migration contracts are 20/20; focused
  Owner Edge/client contracts are 30/30.
- Exact project `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` was
  re-verified before application. M46 applied once as live version
  `20260816150126`. Function readback confirms postgres owner,
  `SECURITY DEFINER`, empty `search_path`, authenticated/service execution,
  anonymous denial, and the corrected `IF v_public_changed ... ELSE NULL`
  branch. M39–M45 remain byte-immutable.
- Authenticated Store View reproof through deployed Owner Edge v8 saved only
  `internalNotes` on `Individuals`: version `2 -> 3`, listing identity and
  public DTO unchanged, quantity `1/1/0/0/0` unchanged, revision count `1 -> 1`,
  and audit/event counts `3 -> 4`. The historical false revision was not
  deleted or modified. Edge redeploy count is zero.
- Exact next action: obtain separate authorization before resuming the
  remaining connected canary matrix. This correction stops here.

### 2026-08-14 Unit 7C WU3 local completion

- Added strict separate Save and stock Edge/client commands over unchanged M43,
  exact command identity, no mutation retry, authoritative cache refresh, stale
  refetch without replay, and bounded edit/stock Store View interactions.
- Store View lifecycle controls are server-capability-driven and reuse existing
  Unit 7B publication/retry services/hooks for Publish, Pause, Republish, Make
  Private, and Retry; no second lifecycle path was introduced.
- Store View/Edge is 63/63; Unit 7C migration contracts are 10/10; selected Unit
  7B/WU2/routing/worker/legacy Inventory regressions are 102 passed with 4
  pre-existing skips. TypeScript, Deno, Expo web export, and the fully
  intercepted management browser flow pass.
- Local Edge→DB remains `NOT_RUN_ENVIRONMENT`; the browser proof is not database
  mutation evidence. No migration, connected Supabase/Storage mutation,
  deployment, stage, commit, or push occurred. `docs/codemap/` remains untouched.

### 2026-08-14 Unit 7C WU2 local completion

- Added the controlled Store View page/detail read vertical from unchanged
  M43/M44 through the existing Owner Edge router, strict client decoding/query
  identity, hidden routes, and read-only list/detail UI. Publication-failed rows
  remain distinct under Needs Attention and routing uses `inventoryId` only.
- Focused WU2 is 31/31; combined Owner/routing regression is 274/274;
  TypeScript, Deno check, Expo web export, and intercepted Edge browser smoke
  pass. Local Edge→DB is accurately `NOT_RUN_ENVIRONMENT`.
- No migration, connected Supabase/Storage mutation, deployment, stage, commit,
  or push occurred. Read-only Supabase MCP reconfirmed the exact healthy project
  and M42 remote tail; `docs/codemap/` remains untouched.

### 2026-08-14 Unit 7C WU2A local completion

- Corrected only local M44: Store View page v2 keeps `private|live|paused|out_of_stock`
  on `effectiveState`, uses `attentionState = action_required` for
  `needs_attention`, and binds opaque cursor context to actor, store, and filter.
  Publication-failed rows remain a distinct returned state with their
  server-composed retry capability.
- Affected evidence is WU2A integration 3/3, M44 migration Jest 5/5, M43 WU1
  regression 15/15, exact M01–M44 replay, unchanged WU1 real vertical, and
  `UNIT_7C_WU2A_REAL_POSTGRES_FILTER_PASS` across all filters and two stores.
- Exact-project read-only verification still shows M42 as the remote tail. No
  connected mutation, deployment, application work, stage, commit, or push occurred.

### 2026-08-14 Unit 7C Work Unit 1 local completion

- Added local-only forward candidate M43 for Store View reads, atomic Save,
  stock v2, safe public revisions, and Unit 7B lifecycle/projection reuse.
- Expected RED was 0/11. Final evidence is Unit 7C integration 15/15,
  migration Jest 5/5, focused Unit 7A/7B regression 40/40, and exact final
  M01–M43 disposable PostgreSQL vertical/readback PASS.
- Read-only exact-project preflight reconfirmed `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn` healthy with M42 as the remote tail. No connected
  migration, database/Storage/business-row mutation, deployment, stage,
  commit, or push occurred.
- Media management is deferred to the next separately authorized work unit.

### 2026-08-14 Unit 7C normative SDD completion

- Froze the Owner Store View/post-commit management contract in one 293-line
  SDD, including stable inventory identity, atomic Save, separate stock/media,
  Unit 7B lifecycle reuse, safe revisions, IA cutover, and acceptance A–H.
- Documentation only: no production code/test, migration file, Supabase/Storage
  mutation, deployment, live verification, stage, commit, or push.
- No contradiction/blocker found. The next gate is explicit authorization for
  Unit 7C forward database-contract/red-test implementation.

### 2026-08-14 Unit 7B live-rollout closeout

- M42 is live exactly once as `20260814013536
  marketplace_phase9_generated_authors_projection`; migration history was
  re-read on the exact healthy target `ahntbtktjjmvfosgkmgn`.
- The real private row `The Birth of Tragedy` completed Publish -> anonymous
  discovery with exactly one listing -> Pause/removal -> Republish with
  exactly one listing. A controlled transient projection fault produced one
  retry job, the worker resolved it, and a stale-intent retry was fenced with
  `P9_STATE_CONFLICT`.
- Final connected readback preserved inventory identity and quantity, showed
  `published` inventory/publication state, one active listing for the selected
  row, and zero outstanding publication retries.
- The temporary live development entitlement `active_listing_limit` was
  explicitly tagged `unit7b_dev_rollout`; its existing value was changed from
  `1` to `10`. Authoritative eligibility now passes for the other ready rows;
  `Café du Livre` remains blocked by `price` because its price is zero.
- Commit `9f3e646` was merged into `main` at merge commit
  `53edbddc9c5417b34cb169599e8282b162e183b3`. No Unit 7C action or additional
  live migration/business-row mutation was performed as part of the merge.

---

## 3. Phase Summary

| Phase | Status | Tracker | Notes |
|---|---|---|---|
| Phase 0: Codebase and DB Audit | `needs_review` | [PHASE-0](./implementation/PHASE-0-codebase-db-audit.md) | Audit complete; review before Phase 1. |
| Phase 1: Foundation Schema and Security | `needs_review` | [PHASE-1](./implementation/PHASE-1-foundation-schema-security.md) | Foundation migrations applied and post-deployment audit passed. Follow-up index fix applied. Ready for Phase 2 planning. |
| Phase 2: Store Onboarding and Verification | `needs_review` | [PHASE-2](./implementation/PHASE-2-store-onboarding-verification.md) | Phase 2A implemented locally and hardening migration applied live; Phase 2B service/UI/metadata slice is implemented, deployed, and authenticated-smoke-verified; Phase 2C review/setup entitlement slice is implemented and deployed. Authenticated platform-review smoke remains. |
| Phase 3: Inventory, Canonical Books, and Listings | `in_progress` | [PHASE-3](./implementation/PHASE-3-inventory-canonical-listings.md) | Manual inventory/projection slice implemented, tested, exported, and live-applied; trigger projection and anonymous/authenticated public-read smoke passed and cleaned up. Remaining phase status should be reconciled separately against its tracker. |
| Phase 4: Store Owner Console | `locally_complete` | [PHASE-4](./implementation/PHASE-4-store-owner-console.md) | Dashboard, inventory console, storefront/profile settings, subscription/quota view, compliance blockers, route tabs, tests, TypeScript, and web export complete locally. Security hardening and `store-profile` are deployed; positive authenticated owner-write smoke remains credential-gated. |
| Phase 5: Consumer Discovery | `complete` | [PHASE-5](./implementation/PHASE-5-consumer-discovery.md) | Implementation, live projection-based RLS correction, anonymous/authenticated discovery, canonical offer comparison, disabled-locality exclusion, private-access denials, constrained demand RPC, regression tests, TypeScript, and zero-residue cleanup all pass. Accepted 2026-07-15. |
| Phase 6: Order Request and Confirmation | `complete_e2e_deferred` | [PHASE-6 tracker](./implementation/PHASE-6-order-request-confirmation.md) · [verification/traceability](./implementation/PHASE-6-verification-and-traceability.md) · [corrected monolithic SDD](./implementation/PHASE-6-order-request-confirmation-SDD.md) · [immutable v0.1 archive](./implementation/archive/PHASE-6-order-request-confirmation-SDD-v0.1-original-monolith.md) | M01-M39 and persisted behavior through `payment_ready` are verified in development. Scheduler v5/worker v3 and cron job 5 are active. Comprehensive browser E2E and real timed commerce-command E2E are explicitly deferred, not silently passed. |
| Phase 7: Payment, Ledger, and Settlement | `deferred` | [PHASE-7](./implementation/PHASE-7-payment-ledger-settlement.md) | Deferred 2026-07-18; resume only through separate authorization and DOC-15/payment/legal/accounting gates. |
| Phase 8: Pickup Fulfillment | `deferred` | [PHASE-8](./implementation/PHASE-8-pickup-fulfillment.md) | Deferred with Phase 7 because it requires verified paid-order creation. |
| Phase 9: Image-to-LLM Inventory | `unit6g_post_scan_local_corrections_complete_pending_owner_review` | [master tracker](./implementation/phase-9-image-inventory/TRACKER.md) · [Unit 6G SDD](./implementation/phase-9-image-inventory/work-units/06g-owner-scan-defaults-batch-review-commit-handoff-sdd.md) · [implementation tracker](./implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md) | Unit 6G post-scan corrections and documentation reconciliation are locally ready for Owner review. Prior rollout records list M60–M62 applied once; no current connected readback was made in this handoff. The latest recorded session readback is 2026-09-22; database/Storage/runtime verification remains a separately authorized action. |
| Phase 10: Third-Party Delivery | `not_started` | [PHASE-10](./implementation/PHASE-10-third-party-delivery.md) | Provider adapter for Shiprocket/Shipmozo/NimbusPost-style aggregators. |
| Phase 11: Notifications and Realtime | `not_started` | [PHASE-11](./implementation/PHASE-11-notifications-realtime.md) | Events, push/in-app, selected realtime. |
| Phase 12: Demand, Bookclubs, and Places | `not_started` | [PHASE-12](./implementation/PHASE-12-demand-bookclubs-places.md) | Growth layer after commerce loop. |

---

## 4. Global Blockers

- Payment provider not selected.
- Delivery provider not selected.
- Legal/accounting review pending before production payments.
- India marketplace compliance review pending before production payments.
- DOC-14 commerce state-machine review pending before feature coding beyond Phase 0/Phase 1 foundation.
- DOC-15 finance/tax/settlement review pending before payment work.
- DOC-16 Bangalore pilot/unit-economics review pending before pilot launch planning.
- Existing Supabase security advisor issues must be remediated separately or explicitly isolated before marketplace production launch.
- Phase 4 review remediation is deployed; positive authenticated profile/setup smoke remains pending an approved disposable Store Owner credential.
- Phase 9 Unit 6 automatic/functional pipeline is complete/PASS; native Unit 6F
  validation remains deferred `NOT_RUN`/`UNRESOLVED` debt and is not marked
  PASS. Unit 7B live rollout is PASS and integrated into `main` at merge commit
  `53edbddc9c5417b34cb169599e8282b162e183b3`; Unit 7C WU1/WU2A/WU2/WU3 are
  locally complete, while connected M43/M44 application, media/history, final
  cutover, deployment, and commit/push remain separately gated.

---

## 5. Global Decisions Made During Implementation

- 2026-07-18: Phase 6 is complete with comprehensive browser E2E explicitly deferred. Phases 7 and 8 are deferred by product decision, and Phase 9 planning is authorized next. This sequencing decision changes roadmap order only; DOC-14 payment/paid-order/pickup transition guards remain authoritative and no Phase 7/8 behavior may be folded into Phase 9.

- 2026-06-19: Architecture Remediation Plan executed (v0.2 sweep).
  - Money fields standardized to integer `_minor` (paise) across DOC-2, DOC-3, DOC-4, DOC-5, DOC-6, DOC-7, DOC-8, DOC-9, DOC-15, README, and PHASE-1 plan.
  - Canonical table names applied: `finance_ledger_entries`, `settlement_batches`, `seller_payout_accounts`, `marketplace_audit_logs`, `marketplace_localities`, `commerce_idempotency_keys`, `marketplace_notifications`.
  - DOC-4 and DOC-15 bumped to v0.2.
  - Commerce state machines refined with `awaiting_clarification`, `awaiting_customer_decision`, and two-tier soft/firm inventory holds.
  - `marketplace_localities` promoted to Phase 1; `stores.locality` converted to `locality_id` FK.
  - `commerce_idempotency_keys` promoted to Phase 1.
  - `settlement_batches` reserved TCS/GST tax fields (`tcs_deduction_minor`, `gst_on_commission_minor`, `tax_adjustments_minor`, `tax_treatment_version`).
  - `marketplace_notifications` projection added; raw `marketplace_events` client SELECT removed.
  - Security helper standardized on `marketplace_sec.is_store_admin(store_id)`; SEC-16 added to acceptance criteria.
  - DPDP section updated to name LLM vendor as data processor with image egress/residency rules.

- 2026-06-19: v0.2 sweep consistency gap-fill (DOC-12, DOC-16).
  - Post-push audit identified three remediation plan targets that were marked `[x]` but not yet edited: DOC-12 §7 (SM-02: `acceptance_window` policy), DOC-12 §12 (SEC-01: cross-tenant denial test requirement / SEC-16), and DOC-16 §2 + §5 (P1-02: `marketplace_localities.is_pilot_enabled` enforcement).
  - DOC-10 (SEC-02 target) confirmed to not exist as a standalone file; the `marketplace_events` raw-read removal was correctly applied to DOC-1 §7 and DOC-14 §13 instead. No action needed.
  - All three live edits applied; remediation plan task list now accurately reflects actual document coverage.

- 2026-06-19: Phase 1 foundation migrations applied to live Supabase project.
  - Four split migrations applied in order via Supabase MCP: schema (A), helpers (B), RLS (C), storage (D).
  - Post-deployment audit run across all 5 high-risk areas: financial column types, security helper definitions, trigger projection sync, CHECK constraints, and storage path isolation.
  - **Audit finding (SEC-04):** `marketplace_notifications` was missing FK indexes on `user_id` and `store_id` — columns evaluated in the `notifications select own` RLS USING clause. Fixed immediately via follow-up migration `marketplace_notifications_fk_indexes`.
  - All other checks passed: 27 tables present, all monetary columns `INTEGER`, all state machine CHECK constraints match v0.2 spec, all `marketplace_sec` functions are SECURITY DEFINER with blank `search_path`, trigger live-tested with full projection/retraction/locality-name cycle, all storage policies use `foldername[1]` path isolation with `store_administrators` join, `marketplace_events` has no client SELECT policy.

---

## 6. Source Spec Deviations

- 2026-07-18 sequencing deviation: DOC-12 originally placed Phase 7 payment and Phase 8 pickup before Phase 9 image inventory. Product direction defers Phases 7/8 and advances Phase 9 after the completed Phase 6 inventory/hold boundary. DOC-12 and the Phase 7/8/9 trackers were updated; DOC-14 requires no behavioral change.

When adding a deviation, include:

- date
- phase
- source spec affected
- original plan
- implemented behavior
- reason
- whether source spec was updated

---

## 7. Latest Completed Milestones

Implementation milestones completed:

- Phase 0 audit completed and recorded in [PHASE-0](./implementation/PHASE-0-codebase-db-audit.md).
- Phase 1 foundation schema/security implementation plan created: [PHASE-1 plan](./implementation/PHASE-1-foundation-schema-security-plan.md).
- Current app routes/auth/Profile integration points audited for future Store Owner entry.
- Current P2P exchange boundary audited; P2P `listings`, `transactions`, credit tables, and transaction RPCs are confirmed as forbidden reuse for bookstore commerce.
- Live Supabase schema, RLS/policies, storage buckets, Edge Functions, realtime publication state, and advisor findings audited.
- Confirmed no marketplace/store/seller/inventory/order/payment/ledger/settlement/shipment schema exists yet.
- Phase 1 foundation migrations (split A–D + follow-up index fix) applied to live Supabase project and verified by comprehensive post-deployment audit (2026-06-19). All v0.2 standards confirmed in live DB.

Documentation milestones completed:

- Source specs `DOC-0` through `DOC-16` created.
- v0.2 architecture remediation sweep completed: `ARCHITECTURE-REMEDIATION-PLAN.md` tasks applied across DOC-1, DOC-2, DOC-4, DOC-6, DOC-12, DOC-14, DOC-15, DOC-16, README, and PHASE-1 plan; foundation migration aligned with remediation plan. Post-sweep consistency audit confirmed DOC-12 (SM-02 §7, SEC-01 §12) and DOC-16 (P1-02 §2/§5) gap-filled.
- India marketplace, payment, delivery, compliance, and operations guardrails added.
- Tracking scaffolds created.
- Store Owner entry rule implemented and documented: Login / first-run auth for new users, Profile section for existing signed-in users, both routed through the Store Owner gate.
- Phase 2B store application slice implemented, deployed, and authenticated-smoke-verified: controlled Edge Function actions, app service wrappers, onboarding UI, application metadata persistence, pilot locality validation, sanitized DB errors, private verification document upload tests, and cross-tenant denial.
- Phase 2C platform review/setup entitlement slice implemented and deployed: `store-review` Edge Function, `platform_user_roles` auth helper, review metadata migration, founding-trial subscription/entitlement assignment on approval, and Store Owner status/setup checklist screens. Approval moves stores to `approved_pending_setup`, sets verification approved, and keeps setup incomplete plus selling not allowed.
- Phase 4 Store Owner Console locally completed: dashboard, inventory management, storefront/profile settings, subscription/quota visibility, compliance blockers, Store Owner tab routes, and focused service/screen/route tests. Local verification passed `src/features/stores` Jest, Store Owner route Jest, TypeScript, and web export.
- Phase 4 security/workflow review remediation deployed (2026-07-15): controlled profile/setup boundary, approved-store setup workflow, inventory publish/filter/save corrections, trigger-helper EXECUTE hardening, and regression coverage. Function/JWT/grant/401 verification passed; positive owner-write smoke is credential-gated.
- Phase 5 discovery accepted (2026-07-15): projection-based public RLS correction deployed as `20260715174111`; anonymous/authenticated discovery, canonical offer comparison, private-boundary denials, constrained demand capture, locality disablement, and zero-residue cleanup passed.
- Phase 6 corrected monolith approved for local implementation (2026-07-16): the temporary split was intentionally deleted and superseded; the exact v0.1 monolith is archived immutably and the v0.2 monolith carries direct submitted request semantics, separate cart evidence, cross-table invariants, safe projections, entitled-owner gate, no substitutions, support-task versioning, exact scheduler, corrected SLA examples, append-only smoke evidence, lazy abandonment, named shutdown cancellation, and canonical notification fallback. No production or live changes occurred during documentation correction.
- Phase 6 Units 1-10 checkpoint and Units 11-12 source pass (2026-07-16): no P0/P1 contradiction was found; migrations 24-28 add canonical event/audit/inbox enforcement plus transport-independent notification delivery, bounded task claims/leases/retries/dead letters/manual replay, named reminder/expiry commands, and service-only scheduler/worker dispatch. Focused tests pass 182/182 and migration/security contracts 126/126; PostgreSQL execution and cron activation remain gated, and no Phase 7 behavior was added.
- Phase 6 Units 13-14 UI pass (2026-07-16): customer cart/request and Store Owner Orders routes, typed services/hooks, safe versioned projections, explicit replacement, clarification/decision/cancellation, review/outcome/support actions, deep-link refetch, and complete logout/cache cleanup are locally implemented. Focused Units 1-14 tests pass 250/250, migration/security contracts 134/134, TypeScript and production web export pass; migrations 1-30 remain local/unapplied and the PostgreSQL gate remains pending.
- Phase 6 Unit 15 and Unit 16 source gate (2026-07-16): forward migrations 31-33 add service-only reconciliation cases, deterministic stale-task cleanup, PII-safe structured observations, and operational metrics. Red-first Unit 15 passes 24/24; the complete source gate passes 274/274 and migration/security/reconciliation contracts 158/158. TypeScript, web export, Phase 5/notification compatibility, privacy/boundary scans, and diff hygiene pass. The [verification/traceability record](./implementation/PHASE-6-verification-and-traceability.md) gives the source-complete/database-pending matrix and rollout/rollback plan. No local Docker/PostgreSQL daemon exists, so Phase 6 is not locally database-verified.
- Unit 15 final static review caught and fixed invalid transition/task column references before handoff; regression contracts now assert derived request/cart store scope and valid lease-only cleanup columns.
- Phase 6 source/database checkpoint (2026-07-17): development Supabase has M01-M39, including forward-only corrective M34-M39; persisted command/authorization verification reaches `payment_ready`. Initial browser auth/navigation/Marketplace/cart-empty smoke passed with no console errors and controlled development fixtures remain. Scheduler v5/worker v2 and cron job 5 are active; comprehensive browser customer/Owner E2E, responsive/accessibility review, and real timed commerce-command checks remain deferred.
- Phase 6 completion/readback (2026-07-18): Supabase MCP reconfirmed M01-M39, authoritative-table RLS, active scheduler v5/worker v3, successful cron job 5 runs, and zero existing inventory quantity-balance violations. Comprehensive browser E2E remains explicitly deferred. Phases 7/8 are deferred and Phase 9 planning is authorized.
- Phase 9 Unit 7B live closeout (2026-08-14): M42 is live exactly once after
  the generated-author projection defect was confirmed. Owner Edge v7 and the
  publication worker are live/ready; Publish -> Discover -> Pause -> Republish,
  transient retry, stale-intent fencing, and final connected readback passed.
  The development active-listing entitlement is now 10; main integration is
  complete at `53edbddc9c5417b34cb169599e8282b162e183b3`.
- Phase 9 Unit 7C WU1 local completion (2026-08-14): M43 and bounded database
  evidence pass locally, including real PostgreSQL replay/readback. M43 remains
  unapplied; media, client/UI, deployment, and connected proof remain gated.
- Expert review findings incorporated: platform support/disputes are core ops, founding-store trial model added, Bangalore locality pilot added, seller-of-record decision added, post-payment unavailable flow clarified, minors/school users marked out of pilot scope.
- DOC-14 Commerce State Machines created.
- DOC-15 Finance, Tax, and Settlement Operating Model created.
- DOC-16 Pilot and Unit Economics created.

---

## 8. Next Recommended Task

**2026-08-21 handoff (historical checkpoint; superseded by the current handoff in the status table above):** Phase 9 Unit 8 is live-verified on the exact
development project. Q07-Q10, M49-M51, Vault-backed cursor crypto, client
integration, strict media cardinality, connected privacy/security acceptance,
and legacy compatibility are green. `inventoryId` remains private Owner
identity; customer paths use safe public identities and allowlisted DTOs only.

Unit 8 is integrated into `main` at `4c1d98d`. Historical migration IDs
remain preserved; no schema-migrations repair or unrelated deployment is part
of Unit 8. Select the next Phase 9 work unit separately. Payments, Phases 7/8,
M09, and deferred Unit 6F native evidence remain separately gated.

The older Phase 6 recommendation below is retained as historical continuity
and is superseded by these dated handoff records.

**Phase 6 remains complete with comprehensive browser E2E deferred; Phases 7 and 8 remain deferred; the bounded Phase 9 fixture pipeline is deployed and live-verified.**

The Phase 1 foundation is applied, audited, and fully v0.2 compliant. The following tables are live and ready for feature implementation:

- `stores`, `store_administrators`, `store_status_history` — store creation and admin assignment
- `store_verification_requests`, `store_verification_documents` — verification submission and review
- `seller_payout_accounts` — payout account metadata collection
- `seller-verification-docs` bucket - document upload with path-scoped store isolation
- `marketplace_sec.is_store_admin()` — canonical RLS helper for all store-scoped policies

Next work:
1. Run a read-only vertical integration audit of upload, media, Gemini/vision,
   metadata enrichment, candidate readiness, and Unit 6 consumption under the
   existing Unit 4B/5A/5B authority.
2. Produce an exact code/schema/live-state gap matrix and review it before any
   implementation, migration, deployment, provider call, scheduler, or external
   mutation.
3. WU1/WU2 authenticated runtime evidence and representative low-end Android
   Unit 6F evidence remain open as separately tracked validation debt. The
   project owner accepts the deferred native-validation risk and authorizes
   Unit 7 to begin; do not represent the native debt as PASS or alter the Unit
   6 requirements/acceptance criteria. Dashboard remediation,
   inventory/publication writes, and commerce behavior remain separately gated.
4. Keep M09, customer display, Owner/customer/platform-admin visual UI,
   production-language approval without qualifying evidence, autoscaling,
   inventory commit, publication, commerce, Google Books Roman-query fallback,
   global alias authority, Library, and Phases 7/8 separately gated.
5. Re-verify the exact project, migrations, schema, Storage, services, and
   advisors before every later mutation; record any migration in the Phase 9
   ledger with exact effects and readback.

---

### 2026-08-05 Unit 4B Gemini configuration/startup evidence

The user authorized a temporary server-only Gemini configuration check. Render
service `phase9-fixture-vision` was deployed from remote `main` commit
`7eaf921efcaefccab4d0189dc26779796f164ed4` as deployment
`dep-d9pdei9t0dsc73ddgbh0`. The final deployment emitted
`service_started` for the vision worker and reached Render `live` status. The
masked `PHASE9_GEMINI_API_KEY` is present alongside Gemini mode,
`gemini-3.5-flash-lite`, and 30-second timeout; the fixture-only variable was
removed. A first env-inconsistent attempt failed at startup and was corrected.

This receipt proves deployment/startup configuration only. No authenticated
`/run`, real Gemini inference, M14 usage/cost receipt, Supabase/Storage/migration
mutation, or product effect occurred. The key value was never read or recorded
by the agent. The next exact action is to revoke the exposed temporary key,
enter a fresh key directly in Render, and separately approve one sanitized-media
provider-call smoke.

### 2026-08-08 controlled Phase 9 metadata proof preflight

The user-authorized live proof verified `Bookconnect_reactexpo`
(`ahntbtktjjmvfosgkmgn`) as `ACTIVE_HEALTHY` and confirmed M32 live exactly once
as `20260808020404 marketplace_phase9_structural_metadata_integration`. Exactly
one minimum `google_books` / `metadata` registry row was configured with adapter
`1.0.0`, enabled/matching/storage allowed, 86,400-second revalidation, and policy
1; public display and image caching remain disabled. The proof stopped before
creating a fresh candidate because `PHASE9_GOOGLE_BOOKS_API_KEY` is missing and
the available local service credential resolves to a different Supabase host.
Metadata jobs, attempts, lookups, cache entries, snapshots, usage reservations,
and physical provider calls remain zero; inventory/listing counts remain 5/5;
metadata and Phase 9 scheduler counts remain zero. No migration was applied by
this session, no provider egress occurred, and Unit 7 remains gated. The exact
next action is to configure both credentials through the approved secret
mechanism and rerun the bounded one-candidate proof.

### 2026-08-08 Phase 0 credential inventory rerun

The mandatory credential gate was re-run before any fresh test data. Source
inspection confirmed Gemini requires `PHASE9_GEMINI_API_KEY`,
`PHASE9_GEMINI_MODEL_ID`, and `PHASE9_GEMINI_TIMEOUT_MS`; Google Books requires
`PHASE9_GOOGLE_BOOKS_API_KEY`, `PHASE9_GOOGLE_BOOKS_TIMEOUT_MS`, and
`PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES`. None are readable by the current
process or defined in the checked-in env files. The process Supabase URL/service
credential target `nxjnoqjxzkipeghhfxee.supabase.co`, not the approved
`ahntbtktjjmvfosgkmgn` project, so it was not used against the target. Exact
project/read-only registry/count verification passed; no worker, upload,
Gemini/Google Books request, candidate, or remote mutation occurred. The exact
next action is to configure the target service URL/key and all source-defined
real-provider variables through the approved secret mechanism, verify without
printing values, and rerun the same bounded proof. Verdict:
`LIVE_METADATA_BLOCKED_MISSING_CREDENTIALS`.
### 2026-08-09 Phase 9 stale-state cleanup and fresh web-upload gate

The authorized development cleanup completed with `0` active/closing Phase 9
sessions and `0` stale pending media/vision jobs. Inventory, listings,
stores/users, canonical data, unrelated data, migrations, deployment, scheduler,
Unit 7, and Git publication were untouched. Immutable audit evidence was
retained. The actual Expo web Owner flow then uploaded the supplied multi-book
image successfully and created one fresh media job. Processing stopped before
media sanitation because the current invoker process lacks the media worker URL
and ingress token; no Gemini or Google Books call occurred. The exact next gate
is process-local authenticated worker invocation configuration, followed by the
fresh media job only.

The existing Render media URL and masked ingress-token configuration were then
located under explicit follow-up authority. They were supplied process-locally
to the existing invoker without printing or persisting the token. The fresh
media job resolved after one attempt and created one open fresh vision job; no
unrelated media job was processed. The next gate is the existing authenticated
vision-worker invocation for this same fresh input.

The same fresh vision job was then invoked twice through the existing Render
vision service. Both claims safely scheduled retry with
`P9_VISION_ANALYZER_UNAVAILABLE`; Gemini was not called and no provider attempt,
usage reservation, candidate, or M32 metadata job exists. Live function
readback proves the media completion function creates the vision job without
the usage reservation required by vision provider registration. The bounded
proof is stopped at this genuine integration failure. The next gate is a
separately authorized forward migration/code correction and focused regression
evidence; the current task did not authorize that change.

The user subsequently authorized systematic local implementation. Forward-only
M33 is now created locally and unapplied. It atomically creates and validates
the required vision reservation before media completion, fails closed and rolls
back on conflicting lineage, and repairs only valid unleased
`open|retry_scheduled` jobs while excluding terminal history. Focused static
tests pass, M33 applies after the full local M32 tail, and combined
ingestion/vision/provider/M33 PGlite passes 61/61. The current fresh job remains
unchanged at attempt `2/5`; the later duplicate open media input remains
untouched. Exact next gate: independent M33 review, followed by separately
authorized exact-project application/readback. No live migration, worker,
provider, Storage, inventory, publication, scheduler, Unit 7, stage, commit,
push, or deployment action occurred.

The independent review returned `APPROVED_WITH_REQUIRED_CORRECTIONS`. The local
correction pass now requires an active session and initiating-Owner media
binding in both the private helper and one-time repair, with direct regressions
for closed-session and wrong-initiator nonterminal history. The shared PGlite
migration sequence now includes M31 before M32, so its full-tail claim is
literal. Red tests failed on both findings before implementation; final M33
static is 3/3, focused static is 39/39, M33 integration is 5/5, combined PGlite
is 61/61, and database foundation/catalog is 17/17. M33 remains unapplied and
the next gate is independent correction-only rereview.
### 2026-08-10 Phase 9 real-image proof completed through Owner review

M34 is live once on verified project `ahntbtktjjmvfosgkmgn`. The preserved
sanitized input completed vision at attempt 5 with
`accepted_with_language_skips`: 8 visible observations, 7 candidates, and one
bounded unknown-language skip. The seven resulting M32 metadata jobs were
claimed once by the local dedicated metadata worker and resolved into the
Owner-safe manual-review path. Google Books authentication was rechecked using
the previously supplied process-only credential and returned HTTP 200; the
false no-match cause was `projection=lite`, which omits required `language`.
Commit `e4f2b34` changes the request to `projection=full`; focused adapter Jest
is 26/26, the metadata-worker build passes, and a live bounded response decoded
8 editions instead of 0. The existing terminal snapshots were not rewritten.
Owner UI proof passed through Profile -> Store Owner Console -> Inventory: the
hub shows 7 needing attention, all seven books render in the review queue, and
candidate detail preserves title/author/language with private review selected.
No review was saved, no inventory/listing/publication mutation occurred, and
Unit 7 remains gated.

### 2026-08-10 Phase 9 single-image safe removal live

The Owner decision now permits one current image per Start/Close session and
retains explicit Remove image before candidate lineage; only successful removal
enables one replacement. Mobile append UI and direct second-upload authorization
are blocked. Local M35 adds the authenticated logical-remove RPC, exact-job
cancellation, hold-aware cleanup scheduling, current-input read filtering, and
server-side issuance/registration guards. Structural Jest is 6/6 and isolated
M01-M35 PGlite behavior is 3/3, including legacy two-capability handling and
atomic rejection with preserved candidate/inventory/listing state. M35 was
applied once as `20260809223135` to verified project `ahntbtktjjmvfosgkmgn`.
The three explicitly targeted legacy inputs were logically removed, all three
exact jobs were cancelled, and zero candidates/inventory/listings changed.
Owner Edge `phase9-owner-ingestion` v3 was separately authorized, deployed,
and read back with all four overlay files matching exactly and JWT verification
enabled. The three private staging objects remain for lifecycle cleanup. One
new input was registered after removal and remains untouched pending a new
explicit decision. No Git stage/commit/push occurred.

## Historical Clubs evidence imported during 2026-10-17 integration

The following records describe their original October checkpoints. The current
Clubs publication state is owned by docs/user/clubs/TRACKER.md. Earlier M62
and publication-blocked wording does not supersede the newer Phase 9 Unit 6G
Open Library records retained above. No migration is reapplied by this merge.

> **2026-10-08 local commit checkpoint:** User-authorized navigation checkpoint 4e1aa35 and primary corrections/applied-migration evidence 542b90f are committed. Remaining review documentation is checkpointed separately. Two P2 navigation findings still block publication; next action is correction, regression/browser verification and independent rereview. No push, deployment or database mutation in this commit step. Earlier test evidence was not rerun.

> **2026-10-08 aggregate Clubs review:** Full unpublished-set GPT-6 Luna max review
> found two return-context integration defects; Clubs publication is blocked until
> corrected and independently rereviewed. See [review](../user/clubs/AGGREGATE-PUBLICATION-REVIEW-20261008.md).
> Phase 9 Unit 6H/M62 rollout status unchanged. No commit/push/deployment/live write.


> **2026-10-08 Clubs migration closeout:** User-authorized forward migration
> `20261008091939 clubs_primary_venue_write_authorization` is applied once through
> Supabase MCP to verified Bookconnect_reactexpo (ahntbtktjjmvfosgkmgn). Exact
> policy/RLS/name preflight and 61/61 local artifact checks passed. Live readback
> confirms five intended policies, unchanged functions/grants/indexes and unchanged
> venue-link/event-location data. Local filename matches live version and content
> hash is unchanged. Ledger now 169 entries; historical repair/db push freeze and
> Phase 9 Unit 6H/M62 rollout pending status are unchanged. No business DML,
> Storage write, runtime deployment, staging, commit or push. Current evidence:
> [Clubs migration closeout](../user/clubs/PRIMARY-VENUE-MIGRATION-REVIEW.md). Next: exact local-diff review for a
> separately authorized scoped commit; do not reapply the migration.


> **2026-10-08 aggregate-review correction:** Clubs owner/archive selection gating,
> lost-response reconciliation and external-removal focus recovery are corrected
> locally. Fresh Manage/service tests 135/135, TypeScript, web export and local
> PostgreSQL policy-proposal checks 61/61 pass. Luna max scoped rereview found no
> actionable residual defect. Read-only live catalog inspection confirmed direct
> primary-write policy bypasses; forward-migration creation/application approval
> is pending. No live writes or Git publication occurred. See the
> [Clubs correction record](../user/clubs/TRACKER.md). Phase 9 Unit 6H and M62 runtime rollout /
> connected proof pending status remain unchanged.


> **2026-10-08 Clubs follow-up:** User-approved venue Remove confirmation and
> real QueryClient race coverage are implemented locally. Desktop/mobile keyboard
> checks passed. Club/account web focus handoff is now corrected locally;
> spoken screen-reader checks are excluded by the user. Connected primary-selection
> proof remains unverified. See [Clubs tracker](../user/clubs/TRACKER.md). Phase 9 M62 rollout status is unchanged.
> No new database mutation, migration, Git publication, or deployment occurred.


> **2026-10-07 bounded cross-feature Clubs UI correction:** The user authorized
> local corrections to Manage Venues pending/recovery feedback and club/account
> response isolation. Scope and verification are owned by
> [the Clubs app review](../user/clubs/PRIMARY-VENUE-APP-REVIEW.md#bounded-ui-correction-2026-10-07).
> No Phase 9 runtime, schema, live data, migration, deployment, or M62 gate
> changed. Desktop/390×844 admin-page visual review and connected selection
> proof remain unrun; shared history and direct-permission boundaries remain.

> **2026-10-07 cross-feature Clubs migration:** Under explicit user
> authorization, the Clubs-only primary-venue migration was applied to
> `ahntbtktjjmvfosgkmgn` as `20261007144356 clubs_admin_primary_venue`; the local
> source filename matches the live version. M62 remains at `20260913162154` and
> Phase 9's `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING` gate is unchanged.
> The shared historical repair set and the pending July Clubs/Exchange migration
> remain untouched; normal production `db push` remains frozen. No Phase 9
> runtime or business rows changed.

## 2026-10-14 - Supplemental local catalogue feasibility probe

Owner authorized a standalone local feasibility pilot from the copied/validated Open Library archives. The new experimental cluster is isolated on E:, with no shared Supabase/Storage/product/schema/migration/rollout mutation. Main Phase9/Unit6G status remains four picker corrections locally complete with SQL proposals retained and publication held. Global release handoff is unchanged; supplemental research next action is completion and measurement of the bounded local pilot, then Owner review of a full-import recommendation. See Phase9 tracker37 §48 for exact scope, actual local mutations and current proof.

## 2026-10-14 - Supplemental catalogue proof completed; release handoff unchanged

Approved supplemental catalogue pilot is complete on an isolated C: loopback PostgreSQL database after an E: interruption; Owner reported their own error and all four E: archive bounded rechecks succeeded. Complete editions/authors streams scanned;51,816factual editions/47,994own authors retained,17/17tests PASS after load/restart. Original seven title+author OCR queries all retrieve candidates,warm CLI medians113–271ms; database~73.09MiB,importer peak206MiB. Full-size/performance not measured; extrapolated relations/index size~64.52GiB plus staging/WAL/temp/reserve, not a guarantee. Main Phase9/Unit6G four-correction local-complete work unit and all SQL/refresh/publication/rollout holds remain unchanged,M65–M74 immutable/M75 deferred. No shared mutation/formal migration/publication/deployment. Detailed actual scope/authority/mutations/proof/limits: tracker37 §49 and C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/REPORT.md. Exact next supplemental action: Owner review of pilot proof/full-build recommendation; full import and product integration require separate direction. Loopback C: pilot remains runnable; no new production architecture adopted.

## 2026-10-14 - Supplemental source-size clarification; release handoff unchanged

Owner-requested read-only storage clarification complete:the four current E:archives expand to92.13GB/85.80GiB; keeping compressed+expanded files takes109.68GB/102.14GiB. E:currently111.63GiBfree with compressed files present; full expansion alone leaves25.83GiB, before an indexed database. Pilot remains51,816editions, seven photographed titles are test queries, other source rows unchanged. Recommend later separately approved direct streaming import to avoid complete raw copies; full database size/performance unmeasured. Cover file has IDs/dimensions/date; actual images are separate. No raw files extracted, database/production/shared/service/Git state changed. Main Phase9/Unit6G four-correction local-complete work unit and all holds unchanged. Detailed measurement/method/authority/proof:tracker37 §50 and C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/EXPANDED-SIZE.md. Exact next supplemental action remains Owner review of full-import scope/storage; no full import authorized/started.

## 2026-10-14 - Supplemental identity/cloud capacity clarification; release handoff unchanged

Supplemental identifier/search/capacity clarification complete. Edition OLID is the pilot primary key; ISBN can repeat across source IDs, cover ID identifies an image, BookConnect internal canonical/inventory IDs are UUIDs verified by fresh exact-project PK/schema SELECT. Current64.52GiBestimate applies only to projected editions/authors/search/indexes; importing full works/descriptions/all four-file fields is unmeasured. Fresh Supabase org Free and DB282.92MB; Free500MBcannot fit full catalogue, cloud quota independent of E:111.63GiBfree. No full import, purchase/plan/account change, source/product/schema/DB/Storage/provider/business/Git/deployment mutation. Main Phase9/Unit6G four corrections locally complete and all holds unchanged. Detail/authority/evidence:tracker37 §51 and C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/IDENTIFIERS-SEARCH-CAPACITY.md. Exact next supplemental action remains Owner review of full-import fields/storage and separate direction.

## 2026-10-14 - Local catalogue scope clarified; filesystem readiness warning recorded

Owner clarified own full PostgreSQL catalogue on E:and later source deletion after validation; cloud hosting is out of scope. Read-only feasibility complete:new fresh E:NTFS Warning/Full Repair Needed plus fsutil Dirty;physical USBdevice reportsHealthy,not a hardware-failure diagnosis. No repair/full import/delete started. Current111.63GiBfree/partial64.52GiBcatalogueestimate does not prove all-fields/index/temp/backupfit or full E:performance. C:sourcecopies present; working bounded pilot unchanged. Supplemental readiness warning must be addressed before long write-heavy build. Exact next supplemental action:Owner review of E:warning and local-only feasibility,then direction on whole-volume diagnostic/repair before full-plan/build. Detail/authority:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/FULL-LOCAL-CATALOGUE-FEASIBILITY.md and tracker37 §52. Main Phase9/Unit6Gfourcorrectionslocalcomplete workunit/releasehandoff and all holds unchanged;M65–M74preserved/M75deferred. No DB/source/storage/service/system/Git/deployment mutation or cloud connector call.

## 2026-10-14 - Supplemental local validation; filesystem repair declined for now

Owner explicitly held filesystem repair after read-only chkdsk E:found NTFSdirectory-index errors/exit3; no repair/delete/heavyE:build. Local validation before later rented-server deployment clarified. Existing ScoopPostgreSQL18.4 used to initialize experimental E:cluster; completed51,816edition/47,994author pilot is onC:,notE:. New read-only uniqueness/join/missingness and12additionaltitle+author retrieval consistency checks PASS; sourceIDhelper5/5RED->GREEN. Full four-file C:archive quality audit running, no complete-source/full-scale search claim. Exact next supplemental authorized action:complete running read-only audit/report; full indexed build needs healthy adequatecapacityvolume, repair remains held. Evidence:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/LOCAL-READINESS.md and tracker37 §53. MainPhase9/Unit6Gworkunit/releasehandoff unchanged, SQL/refresh/Git/rollout holds preserved,M65-M74immutable/M75deferred. No shared/formalmigration/appcode/cloudconnector/Gitpublication/deployment/systemrepair/source deletion; only evidence/continuity files and read-only checks.

## 2026-10-14 - Supplemental original-source validation complete; release handoff unchanged

Supplemental full C: source audit complete:56827250editions/15446415authors/41666337works/14938996cover metadata rows, allgzipEOF/CRC/UTF8 and prior decoded-size readback verified; no JSON parse failures/duplicate validated IDs. Metadata flags explicit:7edition identity mismatches,5700additional projector exclusions,70missing own-author IDs/2321withoutprojectable name,446missingwork IDs,77789coverdimension flags. Every selected positive own cover ID has metadata; image HTTP availability untested. Audit4262s/126.3MiBpeakRSS, no raw expansion saved. Actual51,816edition C:pilot remains separate;12additional title+author retrieval consistency queries pass, full indexed performance/production concurrency/restore unrun. E:repair explicitly held afterread-onlyCHKDSKexit3; no full E:build/delete. Next supplemental authorized action:Owner review of source proof/full-import accounting scope; full indexed build requires healthy adequatecapacityvolume. Evidence:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/LOCAL-READINESS.md and tracker37 §54. MainPhase9/Unit6Gworkunit/releasehandoff and all SQL/refresh/Git/rollout holds unchanged,M65-M74immutable/M75deferred. No appcode/sharedschema/DB/provider/cloudconnector/formalmigration/Gitpublication/deployment/systemrepair/source deletion.

## 2026-10-15 - Full E: catalogue experiment authorized; marketplace release handoff unchanged

Owner now directs proceeding on E: and chose all books with main metadata; later correction says ignore C:. E: pilot restore/restart verified 51,816 editions/47,994 authors and three identical digests, 12 known title+author searches and zero-result negative control. E: filesystem warning remains; repair/deletion held. New isolated full metadata_catalogue cluster on E:/Books/metadata-full-20261015, loopback 55434, SCRAM/owner ACL and normal durability ON. Full import from E: archives is running in 200,000-row atomic batches with 15 GiB reserve. Windows Ctrl-Z COPY failure reproduced, first 200,000 committed author rows/checkpoint preserved, octal escaping corrected RED→GREEN and resumed; 11 unit tests and actual PostgreSQL import/rollback proof PASS. Full ingestion/indexed-size/search/restart completion is pending. Next supplemental action: complete/checkpoint four E: streams, index titles/authors and verify full counts/metadata/sizes/timings. Evidence C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/full-catalogue-20261015/PLAN.md, progress.json, build-resumed.log and tracker 37 §55. Main Phase 9 / Unit 6G four-corrections local-complete/retained-SQL workunit and all SQL/refresh/release/Git holds unchanged. Local E: DDL/data mutation only; no Supabase/Storage/provider/appcode/formal migration/shared mutation/Git publication/deployment; M65–M74 immutable/M75 deferred.

## 2026-10-15 - Supplemental E: catalogue checkpoint paused for read-only I/O diagnosis

E: Full catalogue experiment paused at verified read error. PostgreSQL autovacuum and a read-only targeted row scan failed on authors relation base/16384/16467 block2450. Separate Windows read-only file access failed with EIO; Win32 code23 resolves to "Data error (cyclic redundancy check)". This proves that the block cannot currently be read; it does not diagnose the hardware or all of E:. Import client stopped. E: durable checkpoint: authors 15446415 rows / EOF verified; works 600000 of 41666337; editions/covers/indexes/search not started. Database cannot be reported as a validated searchable full catalogue. No filesystem repair/deletion; prior diagnosis-only repair decision remains. Next safe step: continue read-only E: diagnosis and require a separate explicit Owner direction before any filesystem repair or retrying bulk reads. Proof C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/full-catalogue-20261015/io-probe-results.json and tracker37 §56. Phase9/Unit6G implementation handoff and all existing release/migration/Git holds unchanged; no C: database/source work.

