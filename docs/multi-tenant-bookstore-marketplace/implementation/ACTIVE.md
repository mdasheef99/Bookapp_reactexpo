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

Phase 9 remains active. Slice 5b (optional ISBN in "Add a book", SDD 01a §15) is implemented on `claude/phase9-psr-slice5b-add-isbn` (from the 5a tip `0f4fbd1`) by Codex gpt-6.1-sol, after a Muse review of the brief (13 findings applied) and one code-review round by Muse, GLM, Codex gpt-6-luna and Codex gpt-6.1-sol (ten confirmed findings fixed in one red-first round). Local verification: Jest `src/features/imageInventory` 971 passed / 4 skipped; Haiku's independent run 2,287 passed with one load timeout in an untouched file that passes alone; `tsc` shows only the 8 known `books/export` errors; the database suite shows only the 3 known failures once the worker build exists (five files had failed only for want of `.phase9-dist` in the new worktree; 117/117 after the build). Decisions: no Retry after a version-conflict response; a `P9_STATE_CONFLICT` on the ISBN save says "scan is closed" only after a session refetch confirms it; the Owner stays on Add a book after an ISBN add. The partial in-app check passed (Haiku, Owner signed in): the ISBN box is hidden on a closed scan and shown on an active one, a bad check digit is refused with nothing sent, the plain add navigates as before, and the ISBN add stays on the screen with the refusal message while the Edge action is undeployed (the deployed Edge answers 400). The ISBN save and search against the real server have run only against mocks until the worker and Edge are deployed. No migration, Edge, worker, database, Storage or deploy change; nothing staged, committed or pushed. Evidence: [tracker 38 §30](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#30-slice-5b-built-reviewed-and-verified-locally-partial-browser-check-passed-2026-10-23).

Active work unit: `post_scan_rework_slice5b_add_book_isbn`. Exact next authorized action: on the Owner's approval, commit 5b (src and docs only); after that deploy the metadata worker, then the owner-ingestion Edge function, then run the combined 5a+5b in-app check (AC5a-1, AC5a-16c, AC5b-1, AC5b-4, AC5b-6).

## 2026-10-23 - Slice 5b next; deploys and the in-app check move after 5b (docs only)

Phase 9 remains active. Owner decision (2026-10-23): build slice 5b (optional ISBN in "Add a book", SDD 01a §15) before deploying anything; after 5b, deploy the metadata worker, then the owner-ingestion Edge function, then run one in-app check for 5a and 5b together. No build with an ISBN box reaches real users before that check. The 5b branch `claude/phase9-psr-slice5b-add-isbn` is cut from the 5a tip `0f4fbd1` in its own worktree. The Owner's answers to the 5b session summary are a dated note in SDD 01a §15 (D5-4 confirmed; one pending record for all four steps; the search request built from re-read choices as in 5a; the Owner stays on Add a book after an ISBN add; leave-dialog wording; retry labels). Correction: the M78 fix and docs were committed on the 5a branch as `0f4fbd1`; nothing is pushed. `CODEBASE_MAP` needs no change for 5b. No code, database, Storage or deploy change. Evidence: [tracker 38 §29](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#29-slice-5b-start-branch-owner-decisions-and-docs-reconciliation-2026-10-23).

Active work unit: `post_scan_rework_slice5b_add_book_isbn`. Exact next authorized action: build slice 5b next (branch from 5a tip `0f4fbd1`); after 5b, deploy the metadata worker then the owner-ingestion Edge function, then run the in-app check for 5a and 5b together (AC5a-1, AC5a-16c, 5b checks).

## 2026-10-23 - M78 applied to the live project and verified (slice 5a)

Phase 9 remains active. A dedicated pre-apply review of M78 (Haiku and Muse; the Owner cancelled the GLM and Luna runs) found one confirmed Medium defect: the new command `public.phase9_set_candidate_isbn_v1` kept EXECUTE for `service_role`, because the live default function ACL grants it and M78 revoked only from PUBLIC and anon. Codex fixed it red-first (revoke from all four roles, then grant `authenticated`, as M70 does) and added three tests (977 prefix, `editions` in ISBN mode, a two-press race). Re-verification: PGlite M78 suite 29/29, DB suite 844 with the 3 known failures, real-Postgres runner 20/20. Muse's claim that two presses could both pass the version check was rejected: the candidate row lock comes first.

Haiku's read-only preflight was clean apart from one flag, the newer live library migration `20261022160000_library_reading_history`. It is on origin/main and touches only library tables, so it is not a conflict. The Supabase MCP `apply_migration` call was declined twice by the server with no prompt (it asks for confirmation on destructive statements and this client cannot show it), so the Owner ran the file in the Supabase SQL editor ("Success. No rows returned"). There is therefore no `schema_migrations` row for M78. Read-only readback matched SDD §5.8, and all ten function bodies hash-match the file. Evidence: [tracker 38 §28](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#28-m78-dedicated-review-fix-and-live-application-2026-10-23).

Owner authorized local M78 creation on 2026-10-22 and its application on 2026-10-23; M78 status: APPLIED_VERIFIED (SQL editor, no migration-history row). Database change: M78 only; no data change (every row keeps `owner_isbn13` NULL). No Storage, provider or deploy change. The M78 fix and these docs were committed on the 5a branch afterwards as `0f4fbd1`; nothing pushed.

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: on the Owner's approval, commit the M78 fix and docs on the 5a branch, then deploy the metadata worker and then the owner-ingestion Edge function, then run the in-app check (AC5a-1, AC5a-16c); then sync with origin/main and open the 5a PR.

## 2026-10-23 - Post-scan slice 5a (typed ISBN) built and reviewed; M78 file created, not applied

Phase 9 remains active. Slice 5a is implemented on branch `claude/phase9-psr-slice5a-typed-isbn` per the approved SDD 01a §1–§14. The Owner can type an ISBN in the edition sheet, and Search Books then looks up that exact edition. The slice includes migration file M78 (`20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql`), which is created and tested locally but **not applied**.

It went through two code-review rounds: GLM, MiniMax, Muse, DeepSeek, Haiku and Codex gpt-6-luna. Eleven confirmed fixes were applied. The Owner approved one SDD §8 clarification: the app rejects ISBN-13 values outside 978/979.

Local verification: real-Postgres lock tests 19/19 and the PGlite M78 suite. Jest and the independent Haiku run are in [tracker 38 §27](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#27-slice-5a-built-reviewed-in-two-rounds-and-verified-locally-2026-10-23). The 3 known phase9MetadataFoundation failures predate this slice.

Owner authorized local M78 creation on 2026-10-22; M78 status: CREATED_LOCAL / NOT_APPLIED. No database, Storage, provider or deploy change. Committed locally on the 5a branch; not pushed.

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: on the Owner's approval, preflight and apply M78 to `ahntbtktjjmvfosgkmgn`, deploy the metadata worker and then the owner-ingestion Edge function, then run the in-app check (AC5a-1, AC5a-16c); then sync with origin/main and open the 5a PR.

## 2026-10-22 - Post-scan slice 5 (typed ISBN) SDD approved; reorder recorded (docs only)

Phase 9 remains active. The Owner approved the slice 5 SDD (`work-units/post-scan-rework/01a-slice5-typed-isbn-sdd.md`; 5a edition-sheet ISBN with migration M78, 5b optional ISBN in "Add a book" with no migration) and decisions D5-1 to D5-6 as recommended. D5-1 pulls slice 5 forward: it is built after 4b and before Stage 2 (slices 11 and 13); SDD-0 §7.1/§7.2a and SDD-1 §7 now point to it. Two reviews (Sonnet; OpenCode DeepSeek v4.1 Flash) found 21 issues plus one author finding, all verified and applied; OpenCode Argon was unavailable at the provider. The design also fixes a found defect: the worker refuses hand-added cards, so Search Books never worked for them. No code, no migration file, no database or Storage write; read-only SQL and public Open Library GETs only. Evidence: [tracker 38 §26](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#26-slice-5-sdd-written-reviewed-and-approved-reorder-recorded-2026-10-22).

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: review the 5a Codex brief; then, on the Owner's approval to create the M78 migration file, cut the 5a branch from origin/main and send the brief (SDD-0 §15 risky-slice process).

## 2026-10-22 - Slice 4a pre-merge review: one fix and five tests added on the 4b branch

Phase 9 remains active. The final slice 4a code (PR #27, 8c1b004) had no completed pre-merge review, so before merging it was reviewed here: OpenCode DeepSeek v4.1 Flash on product code and Muse Spark 1.3 on tests (MiniMax ended without a report). DeepSeek found one medium defect: in "Add a book" (`MissedBookScreen.tsx`), the unclear, success and conflict outcomes awaited a cache refresh before being shown; on web, TanStack Query pauses refetches while offline, so the form could stay busy with no message and a leave dialog offering only Stay. Fixed on the 4b branch (outcome published first, refresh best-effort), red-first: four tests failed before the fix and pass after. Muse's five test gaps (offline Retry, unclear again after Retry, account switch, exact Add labels, more removed names in the architecture scan) were added, and one dead re-export removed. Verification and the second review of the fix: [tracker 38 §25](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#25-slice-4a-pre-merge-review-and-fix-2026-10-22). 4a, this fix and 4b go to main together, which closes PR #27. No database, Storage, migration or deploy change.

Active work unit: post_scan_rework_slice4b_script_languages. Exact next authorized action: commit 4a's fix, the 4b code, tests and docs on this branch (never `.claude/` or `.env.local`), rebase onto origin/main, re-run a key suite, and push to main (Owner, 2026-10-21: review here, then push to main); then start slice 5 from the kickstart prompt.

## 2026-10-21 - Post-scan slice 4b reviewed and browser-checked; type check clean (uncommitted)

Phase 9 remains active. The uncommitted slice 4b diff on `claude/phase9-psr-slice4b-sdd-ffa027` (base 39b993a) passed the SDD-0 §15 medium review pass with no code correction. OpenCode Go was unavailable (subscription required), so on the Owner's choice the free OpenCode DeepSeek v4.1 Flash reviewed it, and on the Owner's request GPT-6 Luna (via Codex) and Haiku 5.5 also reviewed it. DeepSeek and Luna found no defect. Haiku's one medium finding (the server's `[:alpha:]` might count digits, so the app mirror could choose a script the server refuses) was disproved by a read-only live check: the project runs `en_US.UTF-8`, where digits of every script and some Devanagari signs are not `[:alpha:]`, so the app mirror is the stricter rule. Free MiniMax produced no report. Tests: PGlite script parity 25/25; `git diff --check` clean; `npx tsc --noEmit` exit 0 with zero errors once the worktree had its own `npm ci` install (the 10 earlier errors were packages missing from the shared install, so the type-check gate is closed); a Jest run under heavy machine load had 7 timeouts in five suites, and `batchReviewCard.test.tsx` then passed 58/58 alone (Codex's own full run: 831 passed, 0 failed). Browser check (Haiku, scan 8eb9b18a, Owner signed in): the card language chooser offers and finds Kannada, Telugu and Malayalam; four manual cards were added through the app, and a read-only readback shows scripts `Deva` (गोदान, hi), `Knda` (ಮಲೆಗಳಲ್ಲಿ ಮದುಮಗಳು, kn), null (mixed `ಕನ್ನಡ Book`, en; still added) and `Latn` (English). The chosen-edition and leave-guard steps could not be run in the browser (no edition list without pressing Search Books; the web scan page has no back control) and rest on their unit tests. The only database writes were those four normal app Adds of dev cards; the orchestrator ran read-only SQL only. Also found: the Unit 5C SDD §2 line "no Unit 5C generation, activation, or search-projection runtime exists" is stale (Gemini romanization, proposal persistence and active-variant search exist; activation is gated); recorded for the Unit 5C follow-up, not changed here. Evidence: [tracker 38 §24](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#24-slice-4b-review-browser-check-and-type-check-2026-10-21).

Active work unit: post_scan_rework_slice4b_script_languages. Exact next authorized action: on the Owner's go, commit the 4b code, tests and docs on this branch (never `.claude/` or `.env.local`), push the branch and open the 4b PR after the slice-4a PR.

## 2026-10-21 - Post-scan slice 4b implemented locally; type-check gate open

Phase 9 / Unit 6G remains active. The Owner's 2026-10-21 coding brief authorized the approved small 4b scope on `claude/phase9-psr-slice4b-sdd-ffa027` at `39b993a`: manual script recomputation after the existing metadata-choice decision, Kannada/Telugu/Malayalam in the shared language list, and deletion of the unused variant client (SDD-1 §§2/6, AC4-7/10/11). No stale-wording handling or production Add sequencing changed. The implementation remains uncommitted.

Verification: initial red Jest 34 failed / 164 passed; final feature assertions 67 suites passed / 1 skipped, 831 tests passed / 4 skipped / 0 failed; the serial run emitted a non-exit warning, recorded with cleanup diagnostics in the evidence. Current-migration PGlite parity passes 25/25. `npx tsc --noEmit` fails with 10 diagnostics in untouched Library/Clubs/e2e paths (six missing packages and two consequent implicit-any errors); this is an open type-check gate, not a clean build claim. Detailed test names, red reasons, raw diagnostics and file scope: [tracker 38 section 23](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#23-slice-4b-local-implementation-and-verification-2026-10-21).

Active work unit: `post_scan_rework_slice4b_script_languages`. Exact next authorized action: the orchestrating session reviews the uncommitted 4b diff under SDD-0 §15's medium review pass. TypeScript must be rerun after the dependency installation is repaired. No Supabase MCP/CLI, database, Storage, migration, provider, deployment, stage, commit, push or branch change occurred; none is authorized by this handoff.

## 2026-10-21 - Post-scan rework slice 4b SDD: script recompute and three languages; stale search wording deferred to Unit 5C (docs only)

Phase 9 remains active. On branch `claude/phase9-psr-slice4b-sdd-ffa027`, now based on slice 4a's local tip 8c1b004, the slice 4b SDD was finalized after a read-only Supabase MCP check (project ahntbtktjjmvfosgkmgn). The check showed a card save never makes a search-variant proposal stale (M29 trigger filter), no `stale` proposal exists live, and Unit 5C search variants are built but switched off. The Owner reduced 4b to S / med (2026-10-21): a script recompute that sets a script only when both the app rule and a mirror of the server rule accept it (null as today otherwise; a chosen edition keeps its script), Kannada, Telugu and Malayalam in the language list, and removal of the unused variant client. Clearing stale search wording is deferred until before any Unit 5C language is switched on (SDD-1 §6, SDD-0 §11, 05c §13). Reviews: Opus and Argon on the earlier large design, Sonnet on the small one; all verified findings applied; Argon skipped for the small one on the Owner's instruction. No code, no migration, no database or Storage write. Evidence: [tracker 38 §22](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#22-slice-4b-sdd-and-read-only-supabase-check-2026-10-21).

Active work unit: post_scan_rework_slice4b_script_languages. Exact next authorized action: on the Owner's go, commit these docs on this branch; recheck the brief's line numbers on this branch, then send the 4b Codex brief (`.claude/psr-slice4b/codex-brief-4b.md`, red-first) with the SDD-0 §15 medium review pass. The 4b PR follows the slice-4a PR.

## 2026-10-21 - Post-scan rework slice 4a built: remove the full correction screen and finish "Add a book" (app only)

Phase 9 remains active. On branch `claude/phase9-psr-slice4a-remove-full-correction`, cut from origin/main 1268403 (slices 1–3 merged, PRs #24–#26), slice 4a (SDD-1 §6, parts tagged 4a) removed the full-correction routes and their screens/components, the Mark false and replace-variant clients and schemas, the legacy Add variant, the full-review draft model and the dead candidates query key. "Add a book" (renamed from "Add missed book") enforces the 15-book rule on `counts.detected >= 15`, defaults the language from the session hint and has a leave guard; a card's hint now says only "This book can't be changed now." The diff is 81 files (26 deleted, 55 modified) plus one new `LanguageChooserPanel.tsx`, +1208 / −5575 lines. Browser check (2026-10-21, web, real backend, Owner signed in, new 11-book scan): "Add a book", the leave guard and the removed routes passed, and the one approved manual book was added (Detected 11 → 12); it found one 4a bug, "Back to review" stacking a second session screen, fixed red-first with `router.dismissTo` and re-checked in the browser. Final verification after the fix (quiet machine): `src/features/imageInventory` 67 suites passed / 1 skipped, 777 passed / 4 skipped, 0 failed; `app/(store-owner)` routes 9/9; tsc clean. Two open observations are recorded, not fixed. Nothing staged, committed, pushed or deployed. Evidence: [tracker 38 §21](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#21-slice-4a-built-remove-the-full-correction-screen-and-finish-add-a-book-2026-10-21).

Active work unit: post_scan_rework_slice4a_remove_full_correction. Exact next authorized action: on the Owner's go: commit (code, tests, docs; not `.claude/` or `.env.local`), sync the branch with origin/main 60a6b6c, Haiku re-runs the final tests, push and open the slice-4a PR. Then slice 4b code. Slice 4b's SDD and its read-only Supabase check were done in a separate session (branch `claude/phase9-psr-slice4b-sdd-ffa027`, uncommitted; recorded there in tracker 38 §22) and wait for the Owner's approval and decisions 4b-1 to 4b-5. No migration.

## 2026-10-20 - Post-scan rework slice 3 built: remove the after-Add buttons and the Inventory tab's list (app only)

Phase 9 remains active. On branch `claude/phase9-psr-slice3-inventory-tab` from 68a6cfc (slice 2's tip, PR #25), slice 3 (SDD-1 §5, AC3-1 to AC3-4) removed "View in Store View" after Add and the Inventory tab's list; the tab now shows the scan card and a link "Added books are in Store View". The old list screen, its hook and the unused read-service parts were deleted. DeepSeek coded it (Codex was at its limit); Codex reviewed it before merge and fixed two findings. Verification: tsc clean; 996 tests passed (6 load timeouts passed alone); the browser check passed. Evidence: [tracker 38 §20](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#20-slice-3-built-remove-the-after-add-buttons-and-the-inventory-tabs-list-2026-10-20).

Active work unit: post_scan_rework_slice3_inventory_tab. Exact next authorized action: the Owner merges PR #25, then the slice-3 PR; then slice 4 (SDD-1 §6) with Codex and the full process. No migration.

## 2026-10-20 - Post-scan rework slice 2 built: declutter the card and the edition sheet (app only)

Phase 9 remains active. On branch `claude/phase9-psr-slice2-declutter` from 1f98804 (slice 1's tip), slice 2 (SDD-1 §4, AC2-1 to AC2-10) was built red-first and reviewed by the two-round loop. The card now has one "Find or change edition" button, an edition line under the title, no metadata badges, and one `cardAddRequirementIssues` rule behind the badge, Add, Add all and the header count (price missing, ₹0, condition, quantity 1-10,000, author; the label stays "Needs attention"). AC2-10 makes `metadataChoice` manual whenever the card's title, authors, language or script differs from the chosen edition's snapshot. The edition sheet lost detected details, "Use detected details" and "Edit manually", and EditionIdentityFix was deleted; Search Books saves the card's edits first, then searches. The header explanation, footnote and chip are gone; `useUnsavedEditsLeaveGuard` shows OwnerConfirmationDialog on every platform. Nothing committed or pushed yet; the PR #24 (slice 1) merge is with the Owner. Evidence: [tracker 38 §19](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#19-slice-2-built-declutter-the-card-and-the-edition-sheet-card-requirements-2026-10-20).

Verification: GREEN 232/232 after round 1 (folder 845 passed / 4 skipped) and 150/150 after round 2 (folder 849 passed / 4 skipped), tsc clean each time. Haiku re-ran the tests (75 suites passed / 1 skipped, 849 passed / 4 skipped, 0 failed; one load-dependent 5 s timeout in `ownerEditionPickerMounted` that passed twice on re-run) and the approved 6-step browser check passed in full. The read-only server check showed Book 3 committed with metadataChoice manual and price 2500, and Book 5 unchanged. Pre-merge review: the orchestrator's full read and an independent DeepSeek full-slice review found three more issues (a false leave warning after Add all/Remove; the full-review screen blocking Back with no dialog on its loading/error screens; a wrong Retry target), all fixed red-first by Codex; final run tsc clean, folder 853 passed / 4 skipped, 0 failed.

Active work unit: post_scan_rework_slice2_declutter. Exact next authorized action: the Owner reviews slice 2; on the Owner's request, commit (code, tests and docs; not `.claude/` or `.env.local`), push and open the slice-2 PR. Then slice 3 ("Remove the after-Add buttons and the Inventory tab's duplicate list"). The work unit stays until the slice-2 PR merges.

## 2026-10-19 - Post-scan rework slice 1 built: Add re-saves a reset review (app only)

Phase 9 remains active. On the Owner's go-ahead, slice 1 (SDD-1 §3) was built red-first on branch `claude/phase9-psr-slice1-add-resave` from main 6a41033, with Codex `gpt-6.1-sol` (xhigh) writing the code and the orchestrating session reviewing every diff line. Add now re-saves the server's review when the server has reset readiness, whether the reset happened before Add or was caused by Add's own save. It does this at most once per command, freezes each hidden request in full for replay, and stops with "This book changed. Check it and press Add again." when the server's review differs from what the Owner saw in anything but the edition choice. The fall-through label "Review book" is now "Needs details". AC1-3 is corrected in SDD-1: a blocked card keeps "Needs attention" with its blocker text, because §3 changes no other label. No migration; server validation is unchanged. Evidence: [tracker 38 §17](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#17-slice-1-built-add-re-saves-a-reset-review-2026-10-19).

Verification: RED 13 failed / 105 passed in the five named suites, all on behaviour. GREEN, re-run independently: tsc clean; named suites 118/118; `src/features/imageInventory` 799 passed / 4 skipped / 0 failed. In-app check on the dev build (Owner signed in): Book 4, stuck with a reset saved review, was added with one press (one re-save). Book 7, with manual details and an edited title, was added with one press (Add's own save, the identity reset, one re-save). Book 3, whose title was edited while it kept a chosen edition, is refused by the server at the first save (P9_STATE_CONFLICT, blocker metadata_choice_missing). That is the known gap slice 2 AC2-10 closes, not a slice-1 regression. Mutations: no direct DB/Storage write, migration, Edge, Render or deployment; the in-app check added two books to the dev store's private inventory through the app; nothing committed or pushed.

Active work unit: post_scan_rework_slice1_add_resave. Update (§18): a two-model review loop found and fixed two more bugs before merge (a refused re-save could leave a card stuck; "press Add again" was shown on a disabled button). Round 2 approved; Haiku re-ran the tests: tsc clean, 803 passed, 0 failed. SDD-0 §15 now holds the refined per-slice process. Active work unit: post_scan_rework_slice2_declutter. Exact next authorized action: the Owner merges PR #24; slice 2 (SDD-1 §4) starts on the Owner's go-ahead, on a branch from slice 1's tip, with the review loop. Slice 2 starts only after the Owner has used slice 1 in the app (SDD-0 §7.2a) and gives a separate go-ahead.

## 2026-10-19 - Post-scan rework SDD set written (pass 1); 2026-10-18 handoffs reconciled

Phase 9 remains active. Reconciliation: main already records tracker 37 §71 (one Ready rule for the card badge, header count and Add all), §72 (Owner API `phase9-owner-ingestion` v17 deployed 2026-10-18; Ready counts agree in the app) and §73 (Book 4 rejection reasons traced to option snapshots taken before M77; not a code bug). Still not verified live and kept with tracker 37: Search Books on Book 4 after option expiry, and M75 exhausted-search recovery.

New work unit: on the Owner's brief (simplify the post-scan review: remove View metadata, keep Find or change edition, declutter, no separate review step, discard unfinished card details when the session ends, one source of truth once an edition is chosen) and after a discussion phase, the post-scan rework is planned as 18 slices in six SDDs: [SDD-0 overview](phase-9-image-inventory/work-units/post-scan-rework/00-overview-sdd.md) in full (decisions PSR-D01 to PSR-D47, rules, slice map, verified facts F1–F37, supersessions, open questions) and pass-1 outlines of [SDD-1 review screen](phase-9-image-inventory/work-units/post-scan-rework/01-review-screen-sdd.md), [SDD-2 catalogue and matching](phase-9-image-inventory/work-units/post-scan-rework/02-catalogue-and-matching-sdd.md), [SDD-3 session lifecycle](phase-9-image-inventory/work-units/post-scan-rework/03-session-lifecycle-sdd.md), [SDD-4 Add and publish](phase-9-image-inventory/work-units/post-scan-rework/04-add-and-publish-sdd.md) and [SDD-5 classification](phase-9-image-inventory/work-units/post-scan-rework/05-classification-sdd.md). Umbrella decision P9-D89. Database facts were read only through Supabase MCP on ahntbtktjjmvfosgkmgn. Branch `claude/phase9-post-scan-rework-sdd` from main 8863885. Evidence: [tracker 38](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md).

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

Exact next authorized action: Owner review of this concrete proposal; implementation/source-spec amendment and any new forward migration/application remain separate decisions. No code/test edit, migration file, shared write, selection/Add, job reset, provider switch, Git publication or deployment occurred. M75 stays deferred. The previous local scroll correction remains uncommitted. [Evidence, proposal and limits](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §29).

## 2026-10-13 - Covers and disabled choices diagnosed read-only

Phase 9 / Unit 6G remains active; the prior two-file scrolling correction stays local and uncommitted. The Owner requested an explanation of missing covers and disabled choices. This read-only investigation is complete: the Black Swan set has ten original positions, one eligible, seven ineligible and two unavailable. Of eight usable records, five have no own-edition cover reference; all three supplied image URLs load. The exact-title guard rejects the Penguin title variants without "The"; unknown language also rejects an otherwise matching row. The first five happen to contain no eligible choice.

This is a data/selection usability limitation under existing picker §§3/4.1/13.14, not an approved rule change. The UI's generic rejection message hides these distinctions. No search, selection, Save, Add, source/test edit, provider flag, database/Storage mutation, migration or deployment occurred. M75 remains deferred and uncreated/unapplied by this session.

Exact next authorized action: Owner review of these findings and direction on whether to amend matching/confirmation, rejection explanations or same-edition cover fallback. No implementation or publication of those changes is inferred. [Exact read-only evidence and limits](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §28). Earlier live Add and local scroll proofs retain their recorded scope.

## 2026-10-13 - Metadata sheet scrolling corrected locally

Current status: `metadata_sheet_scroll_correction_local_verified`. Phase 9 / Unit 6G remains active. The Owner reported that the live scan's metadata sheet could not scroll. A bounded two-file local layout correction restores the existing picker SDD §3 / §10 EP-AC03 interaction; no requirement, acceptance ID or command contract changes.

Before the fix, the 375 × 580 browser sheet clipped a 1600px ScrollView inside a 522px cap; its inner GlassCard content wrapper did not shrink. Ordinary scrolling left scrollTop=0. The main review list scrolled normally after Escape closed the sheet. GlassCard now accepts an optional inner contentStyle, and only CandidateMetadataSheet opts into flexShrink=1 / minHeight=0. Other callers keep their defaults.

Fresh verification: four focused Jest suites / 67 tests PASS; TypeScript no-emit PASS; Expo web export PASS (2690 modules / 69 assets). The rebuilt localhost:8083 preview passed ordinary wheel scrolling: 482px scroll viewport, scrollTop0 -> 580; Show all expanded ten saved positions, and scrolling reached the visible Close metadata button at y508-560. No automatic scrollIntoView was used for this scroll proof. The scan still displays seven detected, six in review, one added.

The earlier live Open Library selection/private Add proof remains valid. This correction is local and uncommitted; the shared runtimes remain at the previously verified source. No Search Books, selection, Save, Add, provider flag, database/Storage/job mutation, migration, staging, commit, push or shared deployment occurred in this check. M75 remains uncreated/unapplied and deferred. Native-device scrolling was not run.

Exact next authorized action: Owner review of the corrected scrolling in the open localhost:8083 scan. Publication of the two-file correction requires a separate instruction. [Cause, source changes and ordinary-scroll evidence](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §27); preceding dated entries retain their historical scope.

## 2026-10-13 - Open Library enabled; fresh-session picker and private Add verified

Current status: `open_library_live_fresh_session_picker_private_add_verified`. Phase 9 / Unit 6G remains active. The Owner's "ok" authorized Open Library activation and one controlled authenticated fresh-session test. The specified testimage.jpeg had been uploaded before, so the app's duplicate guard prompted; the test used Proceed and created independent candidates for this session. The Search Books -> selection -> private Add path passed for one book; six other detected books remain in review. M75 remains PROPOSED / NOT_CREATED / NOT_APPLIED and deferred.

Fresh exact-project preflight matched Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, Render LIVE commit 76348f3 and Owner API ACTIVE v16/JWT enabled. One bounded registry update enabled Open Library at 2026-10-12T22:05:26.434106Z (13 October IST); only enabled/updated_at changed. Google remains enabled. Existing retention, attribution, permission and image-cache flags are preserved; no migration or deployment occurred.

The old scan 93567d47-3874-4576-b3b4-1adb044b552b was closed through the authenticated app at 2026-10-12T22:08:44.023344Z. Live readback: closed/version3, all five candidates retained, all four committed inventory rows present, unchanged candidate states/versions/links. The unfinished card is read-only session history; its exhausted job is still in_progress at 5/5. No job reset or recovery fix was performed.

Exact next authorized action: Owner review of the live proof and direction on the six remaining cards in active session 7a81bdb6-ed34-40cb-b5a9-cff85402cf48; separately decide whether to authorize the proposed M75 exhausted-lookup recovery. The new session remains active, and the existing expired 5/5 job remains untouched. Sources: picker SDD §13.14, DOC-3 §5.2.1, Unit 6G SDD §§14/23 (U6G-AC13/18/20). [Live picker and Add evidence](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §26); earlier headers are historical.
## 2026-10-13 - Owner API v16 verified; exhausted lookup recovery pending

Current status: open_library_owner_api_v16_verified_exhausted_lookup_recovery_pending. Phase 9 / Unit 6G remains active. Render still runs reviewed commit 76348f3; phase9-owner-ingestion is now ACTIVE version 16 with JWT verification enabled. All 35 served runtime files match the reviewed upload; three additional uploaded files were type-only dependencies, as independently checked against the Deno runtime graph.

Fresh API checks: OPTIONS 200, unauthenticated POST 401. The actual authenticated Codex browser loads the scan and reads edition state. The verified frontend export was restarted at localhost:8083, managed session 96852, after the old Metro preview had stopped; the fresh tab uses the tested static bundle and correct project.

The supplied card is blocked by an existing in_progress edition request with attempt_count=max_attempts=5 and an expired lease. Live dispatcher and claim predicates exclude it, while the choices reader reports pending; the UI therefore shows Searching books indefinitely. No job, selection, selling field or provider flag was manually repaired. Open Library stays disabled.

Proposed bounded correction: a new forward M75, leaving M65-M74 unchanged, must expose exhausted expired edition requests as failed and allow an initiating-Owner controlled retry with preserved chosen metadata, selling details and accounting/audit evidence. Exact file is proposed only: 20261013000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql; NOT_CREATED / NOT_APPLIED. Local creation and conditional shared application await the Owner's separate authorization.

Exact next action: obtain that bounded M75 authorization, then reproduce, implement and review the correction before fresh preflight/application and the controlled live edition workflow. No Render or Owner API redeployment is needed for the proposed SQL-only correction. [API deployment and live recovery finding](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 sections 23-24); earlier dated entries are historical.

## 2026-10-12 - Fresh predeployment browser checkpoint; Render held

Phase 9 / Unit 6G remains active and the M74 applied/verified status is unchanged. The requested local browser checkpoint is complete: the exact edition-picker checkout/branch/HEAD were verified, the preview and bundle came from that worktree, and the installed Playwright/Edge harness passed all nine cases (zero failed, zero skipped, exit 0). API responses and persistence in the harness were simulated. One P3 visual finding is recorded in tracker 37 §16; no product source was changed.

The live Codex in-app browser showed the supplied scan route and existing session state. No explicit Search Books, edition-selection, Save, or Add command was sent. No shared Auth, inventory, Storage, provider, migration, or deployment mutation occurred. The preview remains at http://localhost:8083 in managed command session 32257. Exact next action: independent read-only aggregate prepublication review with this browser evidence, then the final Free-plan/configuration preflight. STOP before Render deployment. Detailed evidence and screenshots: trackers/37-owner-edition-picker-open-library-local.md §16.

## 2026-10-12 - M74 applied and verified; Open Library disabled; Render held

Current status: open_library_m74_applied_verified_render_held. Phase 9 / Unit 6G remains active. The Owner explicitly requested completion of M74 preflight/application after the approved bounded correction. That application authority supersedes the earlier local-only gate for M74; publication, provider activation and Render deployment remain held.

Fresh preflight matched the reviewed file and both M73 function bodies/permissions on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn; the focused full-M74 SQL/security suite passed 20/20. M74 is APPLIED_VERIFIED as live version 20261012140853. Archived SQL SHA-256 FE0B13B7D10DA09AFFF71E031E6330F8568C5D05638F079551A7652172EF2FF3 matches the unchanged local file; both installed function bodies match the reviewed definitions.

Only the two private completion/registration functions changed. Their signatures/owners/ACLs/search paths and 17 other checked functions remain intact; provider-call columns/RLS/ACLs/policies, provider flags and observed business/job counts are unchanged. Open Library remains disabled with no unresolved OL attempt. One existing in_progress edition job has an expired lease; it was observed and preserved.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. Compatible client/worker/Owner API rollout, separately authorized provider activation and controlled shared operational acceptance remain pending. STOP before Render deployment. No commit, push, runtime deployment, provider request, Auth/inventory/Storage write or account/configuration change occurred. [Application ledger, exact readback and scope](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (§15). Earlier dated checkpoints are historical.

## 2026-10-12 - Author isolation corrected locally; M74 unapplied; Render held

Current status: open_library_author_corrections_local_verified_m74_pending. Phase 9 / Unit 6G remains active. The Owner authorized "Yes, fix both and create local M74". Both aggregate P2 findings were reproduced, corrected and regression-tested; GPT-6 Luna/max approved the bounded correction. This does not replace the aggregate prepublication review.

The adapter validates edition facts before allocating complete own-author sets within the four-author budget. Nonretryable author-content failures leave only dependent rows unavailable; local M74 permits truthful finalized receipts to continue and complete without weakening mandatory-stage, retryable, egress or authority guards. Google ranking/cover and Owner UI behavior are preserved.

M65-M73 remain applied and byte-preserved. M73's archived live SQL matched its reviewed hash in this session's read-only exact-project check; OL remains disabled. M74 is CREATED_LOCAL / NOT_APPLIED. No shared mutation, provider request, browser action, staging, commit, push or deployment occurred in this correction.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. M74 application needs a separate decision and fresh preflight; compatible client/worker/Owner API rollout, provider activation and authenticated operational acceptance remain gates. STOP before Render deployment. [Exact scope, commands, migration ledger and evidence](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (§14). Earlier dated checkpoints are historical.

## 2026-10-12 - Browser corrections verified; M73 applied; Render held

Phase 9 / Unit 6G remains active. Status: `open_library_browser_corrected_m73_applied_render_held`. The Owner authorized the bounded corrections and migration application, with an explicit stop before Render deployment.

The Response receiver, bulk-control lifetime and metadata-sheet opacity are corrected. Fresh gates: 25 client suites / 379 tests, eight actual-app browser fixture cases, 25 full-M73 SQL/worker cases, worker build / 14 structural checks and TypeScript PASS. Luna/max approved only the bounded source corrections; no independent test rerun or aggregate publication approval is claimed. No new Save step was introduced.

M73 is APPLIED_VERIFIED on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn as version 20261011224457; archived SQL SHA-256 matches the unchanged reviewed file. Open Library is installed disabled. Existing books/candidates/inventory/provider-call data, provider-call RLS/grants and M65-M72 bytes are preserved. Seven read-only actual-adapter OL GETs returned 200 with minimum start spacing 1005.37 ms; raw bodies and returned metadata were discarded.

Exact next authorized action: report this verified correction/application checkpoint and the remaining rollout prerequisites, then STOP before Render deployment. Compatible client/worker/Owner API publication and rollout, shared provider activation, authenticated shared workflow and operational acceptance remain pending. No Git publication, runtime deployment or provider activation occurred here. [Exact evidence, migration ledger and limits](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md) (§11). Earlier dated checkpoints are historical.

## 2026-10-11 - Native accounting and request spacing verified; browser handoff

Current status: `open_library_native_spacing_locally_verified_browser_pending`. Phase 9 / Unit 6G remains active and Tasks 1-8 retain their earlier bounded approval provenance. M65-M72 remain applied/byte-preserved; M73 remains CREATED_LOCAL / NOT_APPLIED and shared OL activation remains pending.

Native PostgreSQL through M73 passed 28 cases with 18 observed independent-connection lock overlaps and verified disposable teardown. The Owner-authorized scheduler correction holds the shared permit through fresh authority checks until HTTP dispatch; a compiled-factory fixture run spaced all 18 actual fetch invocations at least one second apart across three jobs. The 397-test backend gate passed. These local proofs do not establish deployed provider/browser behavior.

Next authorized action: use the separate predeployment browser inspection prompt in another session, then return its report here for the final Free-plan/configuration preflight. Do not start browser testing in this preparation session. Deployment remains held at the Owner's request; M73 application, shared provider activation, compatible runtime/client rollout, shared security/cleanup/recovery/disablement and publication remain gates. Available-model local correction review does not replace the requested Luna prepublication review, which remains separately pending at its usage limit.

[Detailed scope, evidence and pending gates](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md). Earlier dated checkpoints below are historical.

## 2026-10-11 - Local Open Library edition fallback; rollout gated

Current status: `open_library_fallback_local_review_complete_rollout_pending`. Phase 9 / Unit 6G remains active; Tasks 1-8 keep their prior approvals. The Owner authorized explicit-search fallback implementation and "Yes, create local M73". M65-M72 remain applied/byte-preserved; M73 is CREATED_LOCAL / NOT_APPLIED. OL is absent from the shared metadata registry.

Only explicit Owner lookup can use independently permitted Open Library factual editions; automatic Google winner/cache/ranking and representative-cover behavior remain unchanged.

Next authorized action: hand off the verified local correction and detailed independent browser prompt. GPT-6 Luna/max found no remaining bounded blocker and independently passed two focused full-M73 regressions; wider gates remain root evidence. Publication/application/activation/deployment and browser/device verification remain gated; the Owner asked for a separate browser prompt first. [Scope, migration ledger, evidence and gates](phase-9-image-inventory/trackers/37-owner-edition-picker-open-library-local.md). Earlier dated entries are historical.

## 2026-10-11 - Provider checks complete; retention decision remains pending

Phase 9 / Unit 6G remains `feature_published_runtimes_deployed_provider_gate_pending`. The Owner explicitly authorized multiple read-only Google Books checks with the existing Render key only in memory and Open Library investigation. This supersedes the earlier pending one-request question. No provider switch, new retention permission, product edit, migration or deployment is inferred from that authorization.

The Owner's latest decision is Google first, Open Library only if required. Six configured-key Google probe invocations produced one title/author HTTP 200 and five HTTP 503 responses across ISBN, title/author and plain-title queries. The inspected failures reported backendFailed / Service temporarily unavailable. Cache-Control, Expires and Age were absent in every observed response. The successful response establishes configured-key access to this endpoint; its body was cancelled. Subsequent in-memory data checks failed before returning usable book content. This does not prove all Render configuration, the worker's network response, any cache lifetime or continued selected-snapshot rights. No key or Google book payload was recorded. These observations warrant a bounded fallback proposal, not an unapproved provider switch.

Independent read-only recheck (2026-10-11): GPT-6 Luna/max found no request-construction defect; the endpoint, search operators, encoding and ten-result parameters match official Google documentation. The six earlier configured-key receipts support intermittent provider-side failures, not a current/global outage. Two fresh root Node HTTP probes without a key returned 429/rateLimitExceeded; these cannot diagnose the configured key or the Owner's project quota. The reviewer attempt failed before HTTP at TLS. Render browser tab control remained unavailable, so no fresh keyed result or successful book-list inspection was obtained. The bounded availability fallback remains reasonable to consider; no provider switch was implemented. Detailed limits and timestamps are recorded in tracker 36.

The Owner's 24-hour retention cap and cleanup after confirmed Add are already approved. The missing production verifier is a separate server implementation/evidence gate, not a missing Owner approval or Google dashboard approval setting. Absence of inspected cache headers alone is not treated as a blanket prohibition on factual metadata use.

Production bootstrap still installs no verifyOptionsRetention callback. Unknown permission therefore denies persistence as policy_denied. Google branding permits ordinary attributed API display; Google API terms §5(e) separately constrain cached/permanent content with stated rights/law exceptions. This audit has not established permission for this approved 24-hour alternatives plus persistent selected-snapshot workflow. More requests or storage_allowed=true cannot create that evidence.

Three read-only Open Library requests returned HTTP 200: one work search, a ten-edition page, and a separate exact-ISBN edition. Its API guidelines encourage caching for human lookup and impose request limits; cover guidance favors direct covers.openlibrary.org image links. Licensing does not assert new database rights and acknowledges possible existing contribution/jurisdiction rights. No blanket CC0 license for every record or cover is claimed. The current picker is Google-specific across SQL, worker, wire links and UI; Open Library remains a proposed scope amendment, not an implemented fallback.

Fresh local verification: two existing provider safeguard suites / 92 tests passed. Source, tests, dependencies and M65-M72 are unchanged. Only twelve existing evidence/handoff documents changed; nothing was staged, committed or pushed in this investigation. No Auth, inventory, database/Storage, configuration, billing or deployment mutation occurred.

Exact next action: present the Google-first findings and obtain separate local migration/implementation authority for the documented Open Library edition fallback if the Owner chooses that correction. Retain Google as the preferred provider; do not change the automatic winner/cache path. Keep the current retention gate closed until the chosen path has acceptable evidence and reviewed compatible code. Browser/device and operational acceptance remain pending.

[Actual provider responses and decision proposal](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - Compatible runtimes deployed; provider and operational gates pending

Current status: `feature_published_runtimes_deployed_provider_gate_pending`. Phase 9 / Unit 6G remains active; Tasks 1-8 retain their local approval boundaries. The Owner explicitly confirmed the exact two-service deployment after the earlier approval-review rejection. That rejection and earlier deployment holds below are historical; this entry owns the current handoff.

Render `phase9-metadata-worker` is LIVE at `f2d47cb1d015c8b93ded58baff35f125f99ad52c` (deployment `dep-db5b71ajnfac739scpag`). One cached deployment used the existing Free service, one instance, main, and autoDeploy off. GET /health and /ready returned HTTP 200; readiness is process-level evidence, not live provider/database proof. Executable source equals independently approved `47207b7385ee4ae37e01c48b7dba0738abb53389`; their differences are documentation only.

Supabase `phase9-owner-ingestion` is ACTIVE v15 on verified Bookconnect_reactexpo / `ahntbtktjjmvfosgkmgn`, with verify_jwt=true. Deployment followed worker commit/health verification. Prepared source had 38 files; all 35 returned runtime/configuration files match it exactly. Three type-only dependencies are absent from the deployed readback; the emitted runtime graph is complete. CORS OPTIONS passed and an unauthenticated POST was rejected with HTTP 401.

M65-M72 remain applied and byte-preserved; no migration was created or applied in this checkpoint. Read-only preservation counts remain books 45, candidates 173, inventory 21, edition states 0. The only service mutations were the two runtime deployments. Plan, instance count, automatic deployment, secrets, permissions, schedules, Auth, Storage and business data were not edited.

Provider-result retention remains disabled: production has no verified permission callback. Exact next action: investigate the configured Google Books retention permission read-only and establish acceptable evidence before any explicit edition request or result storage. Authenticated Search Books/selection, Save/resume/Add, expiry/cleanup/recovery, browser/device accessibility and controlled operational acceptance remain unverified. Deployment success does not complete those gates. No product tests were repeated for this documentation closeout; the approved source CI remains applicable. [Activation receipt](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - Runtime activation blocked by deployment approval review

Phase 9 / Unit 6G remains locally implemented and published; current runtime activation status is feature_published_runtime_activation_approval_blocked. The Owner replied "ok please proceed it then" to the reviewed deployment sequence. Fresh readback confirmed both GitHub refs at f2d47cb1d015c8b93ded58baff35f125f99ad52c; its only differences from independently approved 47207b7 are twelve documents. Executable source and migrations are identical. The earlier successful source CI and independent review remain applicable; no product test was rerun in this checkpoint.

Immediate preflight verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY and M72 version 20261010200655, both expected functions, private service execution=true and public authenticated execution=false. Render target remains phase9-metadata-worker / srv-d9sqfdvqj5pc73dc66fg in workspace tea-d9j67irtqb8s739ritc0, one Free instance, main, autoDeploy off and the existing Dockerfile/health contract. No new migration or data mutation occurred.

One Render trigger_deploy attempt with clearCache=false was REJECTED by automatic approval review; it returned no deployment ID. Its stated reason was that the earlier instruction to stop before deployment requires exact-action confirmation despite the subsequent general proceed reply, and deployment may disrupt the live worker. Do not retry through another interface or bypass this rejection. No Render deployment began and no Owner Edge deployment was attempted. Browser inventory timed out and reset its kernel before any UI access or action.

The corrected Owner API manifest was freshly reverified: all 38 files / 182814 source bytes equal immutable 47207b7, manifest SHA-256 6baf912a93ee21adb2680a06a5ebcf7bc5d1c3d07264fd6cc4234e1fbf565aae, project/function/entrypoint/import-map exact and verify_jwt=true. Render MCP deploys the configured branch head rather than accepting a commit pin, so the proposed actual Render revision is f2d47cb with the same reviewed executable source. Runtime deployment order remains metadata worker, verified commit/health, then Owner API. Provider-result storage remains disabled without verified permission.

Exact next action: obtain the explicit confirmation required by automatic approval review for ONE existing Free Render metadata-worker deployment from main/f2d47cb, preserving cache, plan, instance count, configuration and secrets; after commit/health verification, deploy the verified Owner API to the exact development project with JWT enabled. No API deployment may precede the compatible worker. No provider request, job endpoint, inventory/Auth/Storage/billing/configuration mutation or Git publication occurred in this checkpoint. The authorization block is not a code defect or failed product test. Earlier dated deployment holds and preflight entries retain historical provenance.

[Deployment evidence](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - M72 applied; backend activation preflight

Phase 9 / Unit 6G remains feature_published_runtime_pending. Under the Owner's current step-by-step backend authorization, M72 is APPLIED_VERIFIED on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn as live version 20261010200655. Its archived SQL equals the reviewed file and its original SHA-256 is preserved. M65-M71 source bytes and existing Phase 9 function definitions/ACLs are unchanged.

Rollout order is M72, compatible Render metadata worker, then the Owner Edge API. The old worker's claim RPC has no edition-operation filter and its decoder cannot handle edition_options contexts, so the new API must not enqueue those jobs until the new worker is healthy. No edition jobs exist at this checkpoint. Owner API remains ACTIVE v14; metadata runtime remains bb91428048ca9028c5592cbbc52c982bd6843946. The Owner's explicit stop before Render deployment remains in force.

A fresh ordinary Deno check exposed extensionless imports newly reached by the API. The bounded local correction adds seven .ts suffixes in contracts/metadata.ts and contracts/providerReuse.ts, naming the same existing targets without changing metadata, ranking, cover, authorization or retention behavior. Fresh verification passed Deno check --no-lock, two existing Jest suites / 49 tests, worker build plus 14 structural tests, and whole TypeScript. GPT-6 Luna/max independently APPROVED this bounded correction at 47207b7385ee4ae37e01c48b7dba0738abb53389 and reran the same relevant gates, including emitted CommonJS import checks. The atomic non-force push succeeded and both GitHub main/codex/edition-picker read back at that reviewed source commit. Fresh source CI run 38083807305 completed SUCCESS: full repository test, TypeScript and production web-export steps passed. Fresh CI counts were not independently recounted because log download returned HTTP 403; local 49/49 and structural 14/14 counts are separately verified.

Exact next action: obtain the Owner's final Render decision, then perform one controlled manual deployment of reviewed/published source 47207b7 to the existing Free metadata service; verify its commit and health before deploying the prepared Owner API bundle with verify_jwt=true. The explicit Render hold keeps both runtime deployments unperformed at this checkpoint. Provider-result retention remains disabled without verified permission; registry flags and cache headers are not authorization. No Edge or Render runtime deployment, provider request, inventory/Auth/Storage/configuration/billing change occurred. [Exact application, rollout, artifacts and verification evidence](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md). Earlier dated records below are historical.

## 2026-10-11 - Edition picker published; development runtime pending

Phase 9 / Unit 6G remains active; current status is feature_published_runtime_pending. GPT-6 Luna/max APPROVED the bounded returned-stale correction and the updated aggregate pre-push feature at de97beda6e4253cdb14369bf29bb6c6ff3429a24. The Owner-authorized atomic non-force push succeeded and remote readback verified both GitHub main and codex/edition-picker at that commit. All seven local edition-picker commits and their earlier main ancestry are included; the separate Desktop Unit 6I work is excluded.

Owner authorized local M72 creation by replying "Yes, create the local M72 correction": 20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql remains CREATED_LOCAL / NOT_APPLIED with its original hash. Independent correction checks passed: 104 SQL tests (eight through M72), six Jest suites / 124 tests, whole TypeScript, worker build/14 structural checks, continuity, syntax and whitespace. Prior CHANGES_REQUIRED findings and their corrections retain their historical provenance. The earlier full merged Jest result of 337 suites / 3,293 tests with four existing pending predates M72. Fresh GitHub validation for reviewed de97bed passed: 337 suites / 3,296 tests, one skipped suite and four skipped tests, TypeScript and production web export. This is fresh CI evidence after M72, distinct from the earlier local full run.

Next checkpoint: report the backend activation preflight for the Owner's decision on shared M72 application and coordinated compatible runtimes. M72 application still requires separate Owner authorization; Render deployment remains on the explicit hold and provider-result retention stays disabled. M65–M71 remain applied/byte-preserved. The Supabase Owner API is still v14 and Render metadata runtime still bb91428. No shared database/Storage/provider/configuration/plan/deployment mutation occurred during Git publication. [Publication, review, migration ledger, warning audit and limits](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md). Earlier dated records are historical.

## 2026-10-10 - Owner-authorized feature publication and development backend rollout

Phase 9 / Unit 6G remains active; Tasks 1-8 retain their recorded local approval and verification boundaries. The Owner explicitly authorized committing this edition-picker work, a GPT-6 Luna review at max before pushing, bounded corrections of confirmed findings followed by correction review, publication to GitHub main after approval, and compatible development backend rollout.

The separate Desktop Unit 6I checkout remains outside this publication. All nine baseline commits are already in main at 6e8848e82b47538f67962f0e34238d0017707711. The feature must integrate that current main without dropping its later work. M65-M71 source bytes remain immutable; their recorded shared application is not permission to reapply migrations.

Current work unit: local publication preflight and pre-push review. Exact next action: commit the feature snapshot, integrate current main, then perform the requested read-only subagent review and verification before publication. Runtime rollout follows approval/publication; new provider-result retention remains disabled until independently verified permission is available. No feature publication, deployment, or new shared database mutation is claimed at this checkpoint.

See the [publication and deployment record](phase-9-image-inventory/trackers/36-owner-edition-picker-publication-deployment.md) for fresh checks, review findings, corrections, exact commits and service readback. Earlier dated handoffs retain historical provenance.

## 2026-10-10 - Local UI inspected; backend compatibility blocks edition results

Current status remains edition_picker_m71_applied_runtime_pending. Phase 9 / Unit 6G is active; M65-M71 remain applied and verified on ahntbtktjjmvfosgkmgn. The local scan UI renders from the edition-picker worktree. Change edition opens the metadata sheet, but saved edition choices are unavailable because the deployed phase9-owner-ingestion function is version 14 and lacks the local edition-picker actions. No option rows or Search Books control rendered. [Browser and backend evidence](phase-9-image-inventory/trackers/35-owner-edition-picker-local-web-preview.md).

Exact next action: Owner review of the UI result and decision about Git publication and compatible development Edge deployment. Then repeat the edition search, result display, selection, Save/resume, and Add browser checks under existing provider and rollout gates. No publication or deployment occurred during this check.

## 2026-10-10 - M71 applied; local browser inspection next

Current status: edition_picker_m71_applied_runtime_pending.
Phase 9 / Unit 6G baseline complete; Task 8 LOCAL approval retained.
Bounded M71 read-only correction review APPROVED in this chat.
M65-M71 are APPLIED / catalog-verified on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn; M71 live version 20261010110835.
Only the private selection delegate changed; wrapper, permissions, other Phase 9 functions and business counts are preserved.
[Preflight, application ledger and verification](phase-9-image-inventory/trackers/02-implementation-and-verification.md).
Codex browser page reading and banner-dismissal clicking now PASS; feature UI/device checks remain unrun.
Next authorized action: inspect the local feature app's compact/full scan UI before Git publication.
Compatible Edge/worker deployment and verified provider retention permission remain pending.
This request applied M71 only. No staging, commit, push, merge, deployment, provider/Storage or business-data mutation.
Earlier dated NOT_APPLIED/review/browser-blocked entries are historical; this entry owns current status.

## 2026-10-10 - Unknown-language selection correction checkpoint

Phase 9 / Unit 6G baseline complete; Task 8 LOCAL approval retained. The Owner
supplied independent UI-correction approval and authorized the bounded backend
unknown-language eligibility correction, local regressions and ONE forward M71.
[Cause, preflight, migration ledger and correction evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md).
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
and a polite empty-result announcement. [Correction evidence](phase-9-image-inventory/trackers/32-owner-edition-picker-task7-ui-evidence.md)
records exact scope, RED/GREEN, tests and limits. Cover/ranking and backend contracts
remain unchanged; the unknown-language selection mismatch is a separate backend item.
Active work unit: bounded UI correction review checkpoint. Next authorized action:
independent read-only review of these corrections. Browser/runtime/provider gates
remain pending; no independent correction approval or operational readiness claimed.
No database/Storage/provider/browser/build/server/migration/deployment or Git
publication action occurred. Earlier dated status/evidence below is historical.

# Active Marketplace Phase Router

## 2026-10-09 - Local preview before Git publication

**Status:** `local_web_bundle_verified_browser_runtime_blocked`.
Phase 9 / Unit 6G baseline complete; Task 8 independently APPROVED locally.
M65-M70 remain APPLIED / catalog-verified; no migration was reapplied.
The Owner chose local UI inspection before committing, pushing or deploying.
[Preview/runtime evidence](phase-9-image-inventory/trackers/35-owner-edition-picker-local-web-preview.md) records the corrected
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
evidence. [Review provenance](phase-9-image-inventory/trackers/33-owner-edition-picker-task8-local-verification.md)
preserves earlier approval provenance and the unavailable historical 152-path
audit baseline.

**Status:** `task8_independently_approved_m65_m70_applied_runtime_pending`.
The Owner authorized steps 1-3: approval documentation, live preflight and the
six unchanged migrations. All M65-M70 are now APPLIED / catalog-verified on
Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn. [Application ledger](phase-9-image-inventory/trackers/34-owner-edition-picker-m65-m70-application.md)
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
[Task 8 evidence](phase-9-image-inventory/trackers/33-owner-edition-picker-task8-local-verification.md) records 17 native PostgreSQL checks /
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

[Independent correction-review evidence](phase-9-image-inventory/trackers/32-owner-edition-picker-task7-ui-evidence.md#2026-10-09---task-7-correction-review-approved) records the independently
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
bounded self-review, continuity/hash closeout and limits](phase-9-image-inventory/trackers/32-owner-edition-picker-task7-ui-evidence.md) belong
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

[Independent review evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-6-independent-review-approved) records the separately
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
[Correction evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-6-confirmation-correction-local-completion) records exact scope, provenance and evidence limits.
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

[Review and verification evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---independent-task-6-review-and-bounded-client-corrections)
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

[Task 6 evidence and limits](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-6-client-review-checkpoint-and-confirmation-gap).


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
- Exact next authorized action: review only the bounded Task 5 correction and its regression evidence. Task 6 and live application require separate authorization. Detailed proof and current hash: [implementation evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-08---task-5-independent-review-correction).

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

Detailed evidence: [Task 3 corrections](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-3-review-corrections).

## 2026-10-07 - Edition-picker Task 3 review checkpoint

Phase 9 remains active; Unit 6G is the completed baseline. Tasks 1–3 are locally complete after the Owner's explicit Task 3 request. Task 2's correction review remains APPROVED; Task 3 has not received independent approval. Read [DOC-13](../DOC-13-implementation-tracker.md), [SESSION-START](phase-9-image-inventory/SESSION-START.md), [TRACKER](phase-9-image-inventory/TRACKER.md), the picker SDD/plan and [Task 3 evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-3-local-completion).

Next authorized action: review Task 3's local diff/evidence. Task 4 worker execution/completion is the next pending implementation slice and awaits separate Owner authorization. M65–M67 remain local and NOT_APPLIED, with no Task 3 SQL change. All work remains unstaged/uncommitted on codex/edition-picker at ee3a8c7. No external mutation or Git publication occurred. Live provider retention verification, worker/Add/client/UI integration and rollout remain gated. Earlier dated entries are historical.

## 2026-10-07 - Edition-picker Task 2 correction review approved

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: Tasks 1 and 2 locally complete; the supplied independent correction review is APPROVED. Tasks 3–8 remain pending.
- Active work unit: Task 3 authorization checkpoint; Task 3 implementation has not started.
- Review result: all three findings resolved; no new actionable finding or product decision.
- Next action: Owner authorization for Task 3 Google result envelope, safety and eligibility; do not infer implementation authority from the reviewer verdict.
- Database authority: M65–M67 remain CREATED_LOCAL / NOT_APPLIED. This handoff update performs no new database audit or mutation.
- Git/external state: codex/edition-picker at ee3a8c7; all changes remain uncommitted and unstaged. No migration application, deployment, provider/browser request, live DB/Storage write, commit or push.

The reviewer reports 48/48 disposable database cases, six Jest suites / 368 tests and git diff --check PASS. This session records that external evidence without claiming to rerun product tests. Full feature and operational proof remain pending. Earlier dated checkpoints are historical.

Detailed review provenance and limitations: [implementation evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-correction-review-approved).

## 2026-10-07 - Edition-picker Task 2 review corrections

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: task2_locally_complete after the authorized review corrections; Task 1 remains complete and Tasks 3–8 remain pending.
- Active work unit: Task 2 review-correction checkpoint.
- Owner authority: “ok then proceed to fix them please,” followed by confirmation of all three findings before fixing.
- Completed: reusable canonical metadata validation, a unique exact text suggestion with confirmation-required evidence, ambiguity rejection, and corrected plan authority/next-action text.
- Exact next authorized action: review the corrected Task 2 diff/evidence; Task 3 Google result envelope remains the next implementation slice after Owner authorization.
- Database authority: M65/M67 revised locally; M66 unchanged; M65–M67 remain CREATED_LOCAL / NOT_APPLIED. Fresh read-only MCP confirms Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn and live M62.
- Git: codex/edition-picker at ee3a8c7; all work uncommitted. No staging, commit, push, deployment, provider/browser request or live DB/Storage mutation.

Detailed review reconciliation and fresh proof are in [the implementation evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-review-corrections). Earlier checkpoints are historical; they do not supersede this handoff.

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

[Detailed evidence](phase-9-image-inventory/trackers/02-implementation-and-verification.md). Final documentation closeout: PASS: final metadata worker build, Phase 9 continuity (87 Markdown files/62 required/195 existing requirement definitions; zero duplicate/missing traceability), git diff --check, and Task 1 closeout (five completed Task 1 steps; seven remaining tasks unchecked; 32 relative links; 34 modified + 8 untracked files = 22 docs/20 TypeScript files; zero staged; all touched source files ≤350 lines; temporary main-checkout writer removed). Earlier entries below are historical planning checkpoints.


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

Read the [edition-picker SDD](./phase-9-image-inventory/work-units/owner-edition-picker-sdd.md), then the normal Phase 9 SESSION-START protocol.

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
[Exact scope and verification](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-10---existing-inventory-baseline-main-publication).

Phase 9 / Unit 6G remains the active phase/baseline. Existing operational gates
and recorded price-intent / cover-source deviations are retained; this Git
publication is not deployment or live acceptance. No database, Storage,
provider, migration, or manual deployment action occurred. Next action: Owner
decision on committing/publishing the separate edition-picker work.


> **2026-09-28 Git-publication closeout:** Unit 6G code/tests `101e4b6`,
> Store View confirmation `ce2d0c5`, and Phase 9 documentation `9ad1d6e`
> were pushed to `origin/codex/phase9-duplicate-confirmation` and remote HEAD
> was read back as `9ad1d6e481247b4edb8691262cf45500212f59b7`.
> Package files, `.hermes/briefs`, and the line-ending-only test remain local.
> The next action is an Owner decision on the two recorded deviations before
> any deployment or connected proof; no database/Storage authority was added.

> **2026-09-28 Phase 9 / Unit 6G publication handoff:** The Owner authorized
> commit and direct push of the local post-scan and separate Store View work.
> Affected local Jest passed 10 suites/158 tests; TypeScript, Phase 9
> continuity, and `git diff --check` passed. The ₹0 plus `publish`-intent
> validation and missing cover Detected badge remain documented deviations;
> no correction or connected-state claim is implied. The latest recorded
> connected readback is still 2026-09-22. Next action after Git publication:
> Owner decision on those deviations before deployment or connected proof.
> Database, Storage, and deployment mutation remain unauthorized.

> **2026-09-27 Phase 9 / Unit 6G handoff:** The current local focus is owner
> review of the bounded post-scan corrections and this documentation
> reconciliation. Prior implementation reports record A–C in 6 suites/116
> tests and the final buffered-Add guard in 3 targeted suites/77 tests; these
> scopes overlap and are not additive. TypeScript and Phase 9 continuity
> validation were reported passing. The latest recorded connected-session
> readback remains the 2026-09-22 entry in DOC-13 (two private commits, three
> candidates in review); this local work made no connected-state claim. Price
> policy follows DOC-4 §9, Unit 7A §13, and Unit 7B §2; the source badge follows
> DOC-8. The continuity validator and `git diff --check` passed during this
> documentation handoff; TypeScript and Jest were not rerun. Exact next action:
> Owner review of the combined local code/document diff. No database, Storage,
> deployment, staging, commit, or push is authorized by this handoff.

> **Historical connected-proof snapshot (2026-09-15; superseded by the later 2026-09-22 record):** The previously active
> `LIVE-TEST-20260912-REPRO` session was cleaned up through the Owner UI: all 15
> active candidates were removed, the summary confirmed 15 removed and 0
> committed, and the session was closed. The processed image remained because
> accepted candidate lineage still blocks input removal. A fresh session
> `93567d47-3874-4576-b3b4-1adb044b552b` was started with
> `Phase9 proof shelf`; its gallery image registered, uploaded, processed, and
> produced 5 candidates. At that checkpoint the connected review readback showed 5 detected,
> 1 ready after one saved review (`The Birth of Tragedy`, test values ₹0/Good),
> 4 still needing review, and 0 added to inventory. One private scan-image
> object was uploaded by the normal Owner flow; no Storage deletion occurred.
> No migration or manual dispatch mutation was made. At that checkpoint the
> session remained active; its next action was Owner review/correction of the
> remaining four candidates, followed by separately authorized Add actions if
> desired. The later 2026-09-22 record reported two private commits and three
> candidates remaining. Neither snapshot asserts current live state.
> Traceability: Phase 9 Master SDD §6; Extraction/Enrichment SDD §10.

> **Historical pre-session-cleanup runtime rollout / connected-proof checkpoint:** The
> verified development project `Bookconnect_reactexpo`
> (`ahntbtktjjmvfosgkmgn`) had the checked-in `phase9-owner-ingestion`
> bundle active as Edge v14; JWT verification was preserved. The matching
> metadata worker is live on Render deployment `dep-dak2nmjl550s73bqb7jg` at
> reviewed code commit `bb91428048ca9028c5592cbbc52c982bd6843946`, and its
> `/health` and `/ready` endpoints returned 200. The client runtime was run
> locally from the same reviewed code against the verified project. The
> connected Owner UI reached scan preview, but at that checkpoint its active session was the
> existing `LIVE-TEST-20260912-REPRO` session with one processed image and 15
> candidates; the selected gallery image therefore showed `Upload image`
> disabled. No new input registration, duplicate Proceed/Cancel, inventory
> Add, migration, Storage deletion, or dispatch change occurred in this
> attempt. Connected no-cover proof is blocked until an approved clean Owner
> session/store is available or the existing image is explicitly authorized
> for removal. [Render deployment API](https://api-docs.render.com/reference/create-deploy)
> was used only to select the reviewed commit.

> **2026-09-13 representative-cover rollout closeout:** After exact-project
> reverification, M61 SHA-256
> `A2A8F9191E29C9813DEBC4E35EA8170F00538288079FFA2E7014621A4D90D463`
> was applied once to development project `Bookconnect_reactexpo`
> (`ahntbtktjjmvfosgkmgn`) as remote version `20260913111342`. Readback proves
> the private sidecar, JSONB inventory field, RLS, service-only delegate, and
> immutability/copy triggers; `anon`/`authenticated` cannot execute the write
> delegate, and both new-data counts remain zero. Owner Edge v12 is ACTIVE with
> JWT verification, hash
> `ad75a08f3624f543f904cf2bf6833bcca132dfc1727e5868d52022365aacea14`,
> and exact local M61 contract-source readback. The bounded local follow-up now
> decodes Google Books volume evidence, fails closed on unresolved series
> evidence, and adds M62 to project representative-cover provenance through
> standalone Owner detail and review-save responses. M62 was then applied once
> as remote version `20260913162154`. Readback confirms the postgres-owned
> private helper, authenticated-only detail/save entrypoints, M62 delegation,
> and zero sidecar/inventory representative rows. The new response member is
> rollout-tolerant while present values remain strict. Earlier rollout
> verification passed TypeScript, worker build, focused affected Jest 310/310,
> structural 14/14,
> M55 7/7, M52–M62 integration 2/2, migration contract 4/4,
> deployment-runtime validation, and the continuity validator. The current
> bounded local follow-up also passes its focused composition regression (29/29)
> and adds only sanitized M61 sidecar-persistence failure logging with a fixed
> error code plus lookup/attempt IDs; raw exception detail is not logged. It does not
> alter terminalization, selection, retry, public projection, or duplicate
> behavior. The current focused run reproduced the existing VirtualizedList
> `act(...)` warning; the later
> full-run closeout recorded existing React `act(...)`, NetInfo dynamic-import,
> and `DEP0040` warnings, while the independent handle run exited normally. No
> worker/client deployment, connected no-cover proof, dispatch change, or Git
> publication occurred in this step. [Evidence](./phase-9-image-inventory/supporting/unit6h-representative-cover-correction.md).
> Next: deploy the matching tolerant Owner Edge/worker/client runtime under
> explicit rollout authorization, then run the connected no-cover review/Add/
> public-projection proof.

> **2026-09-12 bounded correction closeout:** Exact-project CLI preflight for
> `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`) found active
> `phase9-owner-ingestion` v10. Source readback proved v10 carried the older
> batch decoder without optional `metadataSummary.selectionId`. Commit
> `6d05370` adds safe `P9_INTERNAL_ERROR` mapping for batch-response contract
> failures and deterministic cleanup for the two warning suites. Local
> verification passed 7 suites/233 tests with `--detectOpenHandles`, with no
> `act(...)` or non-exit warning; TypeScript and deployment-runtime validation
> passed. The matching Owner Edge bundle was deployed only to the verified
> development project as active v11 (`ezbr_sha256=0af2f2ebde6019d5f10923141b279ae3a78a5ca0f5eeac6630b990030caddf55`,
> JWT verification enabled). The same authenticated session now renders both
> candidate review cards through Edge; no reprocessing or inventory write was
> required. Render, M60, database/Storage, dispatch, and existing development
> data were unchanged. The foreign Supabase values exist only in this parent
> process, not User/Machine environment; all connected commands used the exact
> project ref explicitly. Next action: finish the remaining connected regression
> matrix under connected-test authorization.

> **Historical pre-correction Unit 6H diagnostic checkpoint (2026-09-12):** The
> authorized development proof reached duplicate confirmation and Proceed,
> produced two candidates from the new upload, and added no inventory. The
> authenticated Edge session-summary read returned 200, but the batch-review
> Edge action returned HTTP 400 `P9_REQUEST_INVALID`; the same authenticated
> PostgREST RPC returned 200 with two cards containing `selectionId`. This
> proves a deployed `phase9-owner-ingestion` response-contract/version drift
> after the live metadata projection, not a Gemini or Books API failure. The
> exact deployed source/version is still a readback item; the active Edge v9
> record is the leading explanation, not yet source-level proof. Read-only
> database evidence shows the new input owns exactly one resolved vision job
> and both candidates. `.env.local`, the served Expo bundle, and the endpoint
> use the target project; only the parent PowerShell environment has a stale
> foreign Supabase URL/key, which did not drive this browser bundle. Retry
> reproduces the UI fallback. The next action is an authorized readback or
> matching Edge redeployment, followed by the same connected proof. This
> diagnostic changed no code, tests, migrations, deployment, dispatch, or M60
> state; it created only the authorized development test session/upload/job
> state and deleted no data. M60 was applied before this diagnostic under the
> preceding rollout authorization; no M60 migration action was taken here. The
> following PostgreSQL-only checkpoint is retained as historical pre-connected
> evidence; its local-only rollout wording is not current.

> **Historical local PostgreSQL verification checkpoint (superseded by the connected closeout above) (2026-09-12; supersedes the prior correction-only gate):** F-01 remains retracted; F-02 and F-03 remain corrected locally. Focused Jest passed 4 suites/181 tests, including the 3 lifecycle tests, and the in-memory PGlite fixture passed 5/5. The Owner-authorized disposable PostgreSQL 18.4 harness then ran at `127.0.0.1:55461` with data directory `C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-unit6h-verify-20260912` and PID-scoped database `bookconnect_u8b_22652`. It applied the disposable baseline and M01–M60, passed `UNIT6H_DUPLICATE_CONFIRMATION_REAL_POSTGRES_CONCURRENCY_PASS` using independent connections, and passed the existing `U8B_REAL_POSTGRES_ACCEPTANCE_PASS` regression. Teardown was verified: the database/cluster directory is absent, the port has no listener, and no matching postgres process remains. M52–M59 are unchanged; M60 remains local and was not remotely applied. No remote database/Storage or application data was touched; no deployment, dispatch change, development-data deletion, staging, commit, or push occurred. Connected Edge/Storage verification remains unrun. Prior screen act/open-handle warnings remain historical unresolved evidence and did not affect these database checks. Next: review this local PostgreSQL proof and separately authorize connected Edge/Storage verification. No product behavior or inventory duplicate policy changed.


**Last updated:** 2026-09-28
**Routing status:** authoritative

This file answers only “where does a new development session start?” DOC-13 owns global status; the active phase tracker owns the detailed current milestone and next authorized action.

## Active route

- **Unit 6H development overlay:** Unit 6H duplicate confirmation has completed its bounded correction and disposable independent-connection PostgreSQL verification on `codex/phase9-duplicate-confirmation`; the code correction is `bb91428048ca9028c5592cbbc52c982bd6843946` from baseline `8340647`, with documentation synchronized in the follow-up commit. F-01 was retracted; F-02 and F-03 are corrected. M60 is live once as `20260912072815`; M61 is live once as `20260913111342`; M62 is live once as `20260913162154`. The matching Owner Edge v14 and metadata worker are live, while the local client reached the existing active `LIVE-TEST-20260912-REPRO` scan and could not register a new image because one processed image and 15 candidates already exist. The connected no-cover proof is therefore blocked by the required explicit authorization to remove that existing image or use a clean Owner session/store. [Unit 6H authority and deployment procedure](./phase-9-image-inventory/work-units/06h-duplicate-input-confirmation.md).

## 2026-09-12 Unit 6H review closeout

- Correction checks passed: focused Jest passed **4 suites / 181 tests**, including the three duplicate-resolution lifecycle tests; the local duplicate-confirmation fixture passed **5/5** scenarios; TypeScript validation passed.
- F-01 is retracted: M58 already catches the legacy constraint identity and M60 translates the resulting receipt. F-02 is corrected with service-role-only public delegates to the private functions. F-03 is corrected with local session/controller lifecycle fencing and response-session validation. The disposable PostgreSQL run passed both the independent-connection Unit 6H concurrency marker and the existing U8B regression marker. Connected Edge/Storage verification remains the next rollout gate.
- The focused screen suite still logs the React Native `VirtualizedList` `act(...)` warning. Isolation tied it to the existing `CaptureProgressScreens.test.tsx` FlatList timer path; that suite exited normally. The non-exiting process isolates to the older `unit6gMountedRouteIntegration.test.tsx`: 4/4 assertions pass, `--detectOpenHandles` names no handle, and `--forceExit` is required. Unit 6H dialog/lifecycle and non-UI contract groups exit normally.
- M60 was applied before this connected diagnostic under prior authorization; no M60 migration action occurred during this review. No deployment, remote database/Storage mutation, live dispatch, or development-data deletion occurred during this diagnostic.
- Owner Edge source/version readback, matching v11 deployment, and authenticated batch-review proof now pass. Follow-up is the remaining connected Unit 6H regression matrix.

- **Phase:** Phase 9 — Image-Assisted Inventory
- **Historical Unit 6G correction:** The duplicate-sanitized-hash media-completion
  correction is committed and pushed at
  `ffdb1fc85af625bc98dcfc3af93d5530278144a9` on `origin/main` from the
  integrated branch `codex/phase9-unit6g-media-correction-integrated`.
  M52–M56 were already tracked by that baseline; M57–M59 were applied
  separately and in order as live versions `20260908073203`, `20260908073308`,
  and `20260908073425`, with exact-project readback passing. Render service
  `phase9-media-sanitation` is live from that commit as deployment
  `dep-dafv4ogn74is73bq9lkg`; `/health` and `/ready` both returned 200. The
  requested duplicate-input proof and a unique positive sanitization/vision
  proof both passed at attempt 1. Owner review of the runtime closeout is the
  exact next action; do not revive the historical dead-lettered job.
- **Latest runtime state:** M43-M48 remain live at their recorded versions; Unit 8 is live exactly once as M49 `20260821060156`, M50 `20260821060742`, and M51 `20260821061213`; Unit 6G-B is live exactly once as **M52 `20260822025712 marketplace_phase9_unit6g_contract_persistence_foundation`**; U6G-FA-001 is live exactly once as **M53 `20260828081324 marketplace_phase9_unit6g_field_authority_correction`**; the Owner-authorized lifecycle fence is live exactly once as **M54 `20260829142337 marketplace_phase9_unit6g_session_lifecycle_fence`**; and bounded metadata/Add-authority correction M55 is live exactly once as **`20260830084323 marketplace_phase9_unit6g_metadata_add_authority_correction`**. M54 makes the final Save/Add/Remove RPCs require an active, unexpired, Owner-initiated session while preserving exact completed replay, and reduces closed/closing/expired detail and batch projections to read-only actions. M55 makes bibliographic evidence primary for durable metadata identity, removes the hard Google language filter, retains exact-ISBN fallback for ISBN-only input, keeps empty-author review saves valid while requiring an author for final Add, and gates batch-card Add on full eligibility. Connected proof on an existing closed candidate returned `P9_STATE_CONFLICT` for all three commands with zero durable effects. M54/M55 change function definitions only; they change no business rows, Storage, public signatures, tables, or RLS policies. Edge v9 is the active `phase9-owner-ingestion` version with JWT verification enabled; the matching local client bundle remains undeployed.
- **Stable handoff:** [PHASE-9-image-to-LLM-inventory.md](./PHASE-9-image-to-llm-inventory.md)
- **Session entrypoint:** [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
- **Local current-state authority:** [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
- **Current work-unit plan:** Unit 8 remains live-verified and integrated into pushed `main` at `4c1d98d`. Unit 6G Group 1/B (contracts, runtime dispatch, M52) remains implemented and M52 is live exactly once as `20260822025712`. On 2026-08-24 the Unit 6G design authority was **recomposed**: the revised [Unit 6G SDD](./phase-9-image-inventory/work-units/06g-owner-scan-defaults-batch-review-commit-handoff-sdd.md), [contract matrix](./phase-9-image-inventory/work-units/06g-owner-scan-defaults-batch-review-contract-matrix.md), and [tracker 31](./phase-9-image-inventory/trackers/31-unit6g-owner-batch-review-design-evidence.md) are the current authority; Unit 6 is the immutable lifecycle backbone. Historical commit `e7ed166`-style old 6G-C and frozen old 6G-D work is superseded evidence, not implementation authority. **Unit 6G-C and NEW 6G-D implementations are COMPLETE and locally checkpointed** (independent reviews COMPLETE; 6G-D final verdict PASS; known deferred P3s: OX-F1/F2 sync-edge notes, N1 module-size, L-F03 attribution precision). M54/M55 are live-verified for the final Save/Add/Remove, detail/batch lifecycle, metadata identity, and Add-authority boundaries. The media-completion correction is now runtime-verified through the deployed worker and connected proofs; the exact next action is Owner review of this closeout. **6G-E Edge/client/native deployment remains separately gated**; no client deployment occurred.
- **Historical bounded metadata-throughput preflight:** Local implementation was completed for a metadata-only 15-job run budget with at most three incrementally claimed active jobs and one independent provider request per book. Later read-only migration history confirms M56 is live once as `20260830175651`; the current gate is the Unit 6G media-completion correction above.
- **2026-08-14 Unit 7B closeout:** The real private row `The Birth of Tragedy` completed Publish → anonymous discovery (exactly one listing) → Pause (removed from discovery) → Republish (exactly one listing). The controlled transient fault produced one `publication_failed`/retry job; the worker resolved it, and the stale-intent retry was fenced with `P9_STATE_CONFLICT`. Final connected readback preserved quantity/identity and showed one active listing with zero outstanding publication retries. The development `active_listing_limit` entitlement was then raised from the temporary `unit7b_dev_rollout` value `1` to `10`; authoritative eligibility now passes for the other ready rows, while `Café du Livre` remains blocked by its zero price.
- **2026-08-14 Unit 7B main integration:** Commit `9f3e646` was merged into `main` at merge commit `53edbddc9c5417b34cb169599e8282b162e183b3`. No additional migration, live business-row mutation, or Unit 7C action was performed as part of the merge.
- **Historical 2026-08-12 pre-correction checkpoint:** The sole authorized `phase9-owner-ingestion` deployment attempt failed before activation because the bundler could not resolve `../contracts/registers` without `.ts`; at that checkpoint version 3 remains ACTIVE and controlled live Add-to-Inventory/exact replay was blocked. The corrected version 4 deployment and current UI-availability gate are recorded above.
- **Latest 2026-08-12 controlled-proof update:** Edge version 5 resolved the `OwnerUxResponseContractError`/`P9_INTERNAL_ERROR` that had hidden Add to Inventory. At 04:41 UTC the authenticated Owner committed `Individuals` from candidate `f6266e3a-e920-4fa0-a993-c02c739f5108`; at approximately 05:00 UTC the exact original command replay returned the canonical recorded result for inventory `5f5a2bc9-d702-4aeb-af55-2a9df6c16478`. Readback verified one inventory row, `committed_count=1`, one completed idempotency row, one audit log, and one event, with zero new replay effects. `UNIT_7A_LIVE_PROOF` is PASS and the UI-availability gate is CLEARED. `Thinking, Fast and Slow` remains uncommitted (`review_ready=false`) and is outside the proof.
- **Latest 2026-08-12 fresh-image observation:** user-started session `166a20cb-c919-4e06-8e4a-1cd53e4ef393` accepted one image, but media validation retried and the input is now server-readback `skipped` with `P9_OWNER_REMOVED`; its job is cancelled at attempt `2/5` and the session has zero candidates. The input must not be revived without a new explicit target decision.
- **Latest fresh-processing continuation:** the same user-started session later accepted a second image and completed successfully. It produced two candidates, `Individuals` and `Thinking, Fast and Slow`; both are server-readback `state=ready` with `review_ready=false`. The first review screen loads matched metadata but requires a price and Owner confirmations, so no new review or inventory write has been made.
- **Latest fresh review action:** candidate `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals`) was saved privately with quantity `1` and price `250000` paise; server readback is `ready`/`reviewed`/`review_ready=true`. Its next-step detail failed twice, so Add to Inventory was unavailable; inventory remains `5` and Unit 7A commit counters remain zero.
- **2026-08-09 controlled web-proof stop:** the real Expo web path reached Profile → Store Owner Console → Inventory under the authenticated Owner session. Inventory exposed an older active capture with 6 processing images and 1 review item; exact-project read-only baseline was 4 sessions total, 3 active/closing, 18 inputs, 27 jobs, 8 pending jobs, 13 candidates, and zero metadata jobs/attempts/provider calls/lookups/cache entries. The shared queue could not be isolated to a new image, and the process had no Google Books credential, so no fresh session or upload was started. The browser is left on `/inventory`.
- **2026-08-09 M33 live correction:** exact-project migration history now records M33 once as `20260809023834 marketplace_phase9_vision_reservation_correction`; the preserved vision job is `retry_scheduled` at attempt `4/5` with its sanitized 1600x1600 WebP lineage intact.
- **2026-08-09 schema-free Gemini JSON correction:** Gemini now receives JSON MIME mode and the user's flat `vision` prompt with no provider response schema; BookConnect keeps strict local validation and server-owned M18/M19 mapping. The live payload evidence supports a narrow compatibility layer: `success` becomes `analyzed`, null language becomes `und`, known language names become BCP 47 tags, safe ISBN labels are stripped, and an analyzed visible-book count is reconciled to the accepted observation count. Five exact-path Jest suites and the later main-line diagnostic protect these mappings. M34, jobs, metadata, Owner UI continuation, inventory, and publication remain separately controlled.
- **2026-08-10 single-image correction:** `unit6c_single_image_safe_remove` remains the completed live operational checkpoint, not the active work unit. Remove image remains; append-style Add another image is removed. M35 is live once as `20260809223135`, the three explicitly targeted legacy inputs were logically removed with their exact jobs cancelled, and Owner Edge `phase9-owner-ingestion` v3 is active with an exact four-file readback match. No candidates, inventory, listings, or physical Storage objects were deleted. One new input was registered after the removals and is observation-only pending a new explicit decision.
- **Global status authority:** [DOC-13](../DOC-13-implementation-tracker.md)

## Required reading order

1. [DOC-13 current status](../DOC-13-implementation-tracker.md)
2. [Phase 9 SESSION-START](./phase-9-image-inventory/SESSION-START.md)
3. [Phase 9 master tracker](./phase-9-image-inventory/TRACKER.md)
4. [Phase 9 master SDD](./phase-9-image-inventory/00-phase-9-master-sdd.md)
5. The domain SDD and supporting documents routed by SESSION-START for the active work unit
6. [Implementation and verification tracker](./phase-9-image-inventory/trackers/02-implementation-and-verification.md) when implementation is authorized

## Route-change transaction

When the active phase changes, update these together in one reviewable change:

1. DOC-13 current status, phase table, handoff, and next action;
2. this router;
3. the outgoing phase tracker with a final closeout/next-phase link;
4. the incoming phase tracker/session-start file;
5. marketplace and implementation README current-handoff sections;
6. the current marketplace pointer in repository `AGENTS.md`.

Do not point this file to an unapproved phase merely because work is proposed. A route change requires an explicit product/roadmap decision recorded in DOC-13.
