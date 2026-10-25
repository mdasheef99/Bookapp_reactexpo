## 2026-10-26 - Slice 7 pass-2 design drafted; M83 proposed; documentation only

Phase 9 remains active. Slice 6 M81 is applied as live version 20261025171647 (2026-10-25 read-back PASS), with one Open Library ISBN browser proof on 2026-10-26: canonical_works 1->2, canonical_editions 1->2, linked inventory 0->1 (tracker 38). Slice 7 pass-2 is drafted in work-units/post-scan-rework/02b-slice7-lean-catalogue-writes-sdd.md; it is not approved for build. Owner authorized M82 creation and application (2026-10-26): 20261026000082_marketplace_phase9_edition_choice_survives_first_save.sql (trigger function marketplace_sec.phase9_edition_identity_change; a card's first review save no longer drops a coherent edition choice) is applied as live version 20261025220839 after Muse review (no finding) and two Haiku read-only preflights (READY); the GLM review run hung and was restarted, report pending. Read-back PASS: project ahntbtktjjmvfosgkmgn re-verified, one function, owner postgres, SECURITY DEFINER, search_path "", ACL postgres only (anon/authenticated/service_role no EXECUTE), prosrc md5 8bdf7924d9f95ced4533a9ed4e81394b length 5033 equals the local LF body, trigger definition unchanged. No data written. M82 browser re-check PASS (2026-10-26, session 78f427c3-794d-450a-b2de-452b7c4e203c): Add-a-book card titled 'Pride & Prejudice' with typed ISBN 9780141439518, Open Library edition 'Pride and Prejudice' selected, first review save (U6C01) and Add (U7AC01): owner_isbn13 kept, metadataChoice stayed edition_option, inventory 41c79cca-56c7-4fb7-8ebd-8bbc36da8fab linked to new edition 7edcb18f-b347-453e-a8cb-9212dee9c073 (psr-catalogue-isbn-v1); canonical_works 2->3, editions 2->3, linked inventory 1->2. Slice 7 M83: PROPOSED / NOT_CREATED / NOT_APPLIED.

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

Phase 9 remains active. Slice 5b (optional ISBN in "Add a book", SDD 01a §15) is implemented on `claude/phase9-psr-slice5b-add-isbn` (from the 5a tip `0f4fbd1`) by Codex gpt-6.1-sol, after a Muse review of the brief (13 findings applied) and one code-review round by Muse, GLM, Codex gpt-6-luna and Codex gpt-6.1-sol (ten confirmed findings fixed in one red-first round). Local verification: Jest `src/features/imageInventory` 971 passed / 4 skipped; Haiku's independent run 2,287 passed with one load timeout in an untouched file that passes alone; `tsc` shows only the 8 known `books/export` errors; the database suite shows only the 3 known failures once the worker build exists (five files had failed only for want of `.phase9-dist` in the new worktree; 117/117 after the build). Decisions: no Retry after a version-conflict response; a `P9_STATE_CONFLICT` on the ISBN save says "scan is closed" only after a session refetch confirms it; the Owner stays on Add a book after an ISBN add. The partial in-app check passed (Haiku, Owner signed in): the ISBN box is hidden on a closed scan and shown on an active one, a bad check digit is refused with nothing sent, the plain add navigates as before, and the ISBN add stays on the screen with the refusal message while the Edge action is undeployed (the deployed Edge answers 400). The ISBN save and search against the real server have run only against mocks until the worker and Edge are deployed. No migration, Edge, worker, database, Storage or deploy change; nothing staged, committed or pushed. Evidence: [tracker 38 §30](trackers/38-post-scan-rework-evidence.md#30-slice-5b-built-reviewed-and-verified-locally-partial-browser-check-passed-2026-10-23).

Active work unit: `post_scan_rework_slice5b_add_book_isbn`. Exact next authorized action: on the Owner's approval, commit 5b (src and docs only); after that deploy the metadata worker, then the owner-ingestion Edge function, then run the combined 5a+5b in-app check (AC5a-1, AC5a-16c, AC5b-1, AC5b-4, AC5b-6).

## 2026-10-23 - Slice 5b next; deploys and the in-app check move after 5b (docs only)

Phase 9 remains active. Owner decision (2026-10-23): build slice 5b (optional ISBN in "Add a book", SDD 01a §15) before deploying anything; after 5b, deploy the metadata worker, then the owner-ingestion Edge function, then run one in-app check for 5a and 5b together. No build with an ISBN box reaches real users before that check. The 5b branch `claude/phase9-psr-slice5b-add-isbn` is cut from the 5a tip `0f4fbd1` in its own worktree. The Owner's answers to the 5b session summary are a dated note in SDD 01a §15 (D5-4 confirmed; one pending record for all four steps; the search request built from re-read choices as in 5a; the Owner stays on Add a book after an ISBN add; leave-dialog wording; retry labels). Correction: the M78 fix and docs were committed on the 5a branch as `0f4fbd1`; nothing is pushed. `CODEBASE_MAP` needs no change for 5b. No code, database, Storage or deploy change. Evidence: [tracker 38 §29](trackers/38-post-scan-rework-evidence.md#29-slice-5b-start-branch-owner-decisions-and-docs-reconciliation-2026-10-23).

Active work unit: `post_scan_rework_slice5b_add_book_isbn`. Exact next authorized action: build slice 5b next (branch from 5a tip `0f4fbd1`); after 5b, deploy the metadata worker then the owner-ingestion Edge function, then run the in-app check for 5a and 5b together (AC5a-1, AC5a-16c, 5b checks).

## 2026-10-23 - M78 applied to the live project and verified (slice 5a)

Phase 9 remains active. A dedicated pre-apply review of M78 (Haiku and Muse; the Owner cancelled the GLM and Luna runs) found one confirmed Medium defect: the new command `public.phase9_set_candidate_isbn_v1` kept EXECUTE for `service_role`, because the live default function ACL grants it and M78 revoked only from PUBLIC and anon. Codex fixed it red-first (revoke from all four roles, then grant `authenticated`, as M70 does) and added three tests (977 prefix, `editions` in ISBN mode, a two-press race). Re-verification: PGlite M78 suite 29/29, DB suite 844 with the 3 known failures, real-Postgres runner 20/20. Muse's claim that two presses could both pass the version check was rejected: the candidate row lock comes first.

Haiku's read-only preflight was clean apart from one flag, the newer live library migration `20261022160000_library_reading_history`. It is on origin/main and touches only library tables, so it is not a conflict. The Supabase MCP `apply_migration` call was declined twice by the server with no prompt (it asks for confirmation on destructive statements and this client cannot show it), so the Owner ran the file in the Supabase SQL editor ("Success. No rows returned"). There is therefore no `schema_migrations` row for M78. Read-only readback matched SDD §5.8, and all ten function bodies hash-match the file. Evidence: [tracker 38 §28](trackers/38-post-scan-rework-evidence.md#28-m78-dedicated-review-fix-and-live-application-2026-10-23).

Owner authorized local M78 creation on 2026-10-22 and its application on 2026-10-23; M78 status: APPLIED_VERIFIED (SQL editor, no migration-history row). Database change: M78 only; no data change (every row keeps `owner_isbn13` NULL). No Storage, provider or deploy change. The M78 fix and these docs were committed on the 5a branch afterwards as `0f4fbd1`; nothing pushed.

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: on the Owner's approval, commit the M78 fix and docs on the 5a branch, then deploy the metadata worker and then the owner-ingestion Edge function, then run the in-app check (AC5a-1, AC5a-16c); then sync with origin/main and open the 5a PR.

## 2026-10-23 - Post-scan slice 5a (typed ISBN) built and reviewed; M78 file created, not applied

Phase 9 remains active. Slice 5a is implemented on branch `claude/phase9-psr-slice5a-typed-isbn` per the approved SDD 01a §1–§14. The Owner can type an ISBN in the edition sheet, and Search Books then looks up that exact edition. The slice includes migration file M78 (`20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql`), which is created and tested locally but **not applied**.

It went through two code-review rounds: GLM, MiniMax, Muse, DeepSeek, Haiku and Codex gpt-6-luna. Eleven confirmed fixes were applied. The Owner approved one SDD §8 clarification: the app rejects ISBN-13 values outside 978/979.

Local verification: real-Postgres lock tests 19/19 and the PGlite M78 suite. Jest and the independent Haiku run are in [tracker 38 §27](trackers/38-post-scan-rework-evidence.md#27-slice-5a-built-reviewed-in-two-rounds-and-verified-locally-2026-10-23). The 3 known phase9MetadataFoundation failures predate this slice.

Owner authorized local M78 creation on 2026-10-22; M78 status: CREATED_LOCAL / NOT_APPLIED. No database, Storage, provider or deploy change. Committed locally on the 5a branch; not pushed.

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: on the Owner's approval, preflight and apply M78 to `ahntbtktjjmvfosgkmgn`, deploy the metadata worker and then the owner-ingestion Edge function, then run the in-app check (AC5a-1, AC5a-16c); then sync with origin/main and open the 5a PR.

## 2026-10-22 - Post-scan slice 5 (typed ISBN) SDD approved; reorder recorded (docs only)

Phase 9 remains active. The Owner approved the slice 5 SDD (`work-units/post-scan-rework/01a-slice5-typed-isbn-sdd.md`; 5a edition-sheet ISBN with migration M78, 5b optional ISBN in "Add a book" with no migration) and decisions D5-1 to D5-6 as recommended. D5-1 pulls slice 5 forward: it is built after 4b and before Stage 2 (slices 11 and 13); SDD-0 §7.1/§7.2a and SDD-1 §7 now point to it. Two reviews (Sonnet; OpenCode DeepSeek v4.1 Flash) found 21 issues plus one author finding, all verified and applied; OpenCode Argon was unavailable at the provider. The design also fixes a found defect: the worker refuses hand-added cards, so Search Books never worked for them. No code, no migration file, no database or Storage write; read-only SQL and public Open Library GETs only. Evidence: [tracker 38 §26](trackers/38-post-scan-rework-evidence.md#26-slice-5-sdd-written-reviewed-and-approved-reorder-recorded-2026-10-22).

Active work unit: `post_scan_rework_slice5a_typed_isbn_sheet`. Exact next authorized action: review the 5a Codex brief; then, on the Owner's approval to create the M78 migration file, cut the 5a branch from origin/main and send the brief (SDD-0 §15 risky-slice process).

## 2026-10-22 - Slice 4a pre-merge review: one fix and five tests added on the 4b branch

Phase 9 remains active. The final slice 4a code (PR #27, 8c1b004) had no completed pre-merge review, so before merging it was reviewed here: OpenCode DeepSeek v4.1 Flash on product code and Muse Spark 1.3 on tests (MiniMax ended without a report). DeepSeek found one medium defect: in "Add a book" (`MissedBookScreen.tsx`), the unclear, success and conflict outcomes awaited a cache refresh before being shown; on web, TanStack Query pauses refetches while offline, so the form could stay busy with no message and a leave dialog offering only Stay. Fixed on the 4b branch (outcome published first, refresh best-effort), red-first: four tests failed before the fix and pass after. Muse's five test gaps (offline Retry, unclear again after Retry, account switch, exact Add labels, more removed names in the architecture scan) were added, and one dead re-export removed. Verification and the second review of the fix: [tracker 38 §25](trackers/38-post-scan-rework-evidence.md#25-slice-4a-pre-merge-review-and-fix-2026-10-22). 4a, this fix and 4b go to main together, which closes PR #27. No database, Storage, migration or deploy change.

Active work unit: post_scan_rework_slice4b_script_languages. Exact next authorized action: commit 4a's fix, the 4b code, tests and docs on this branch (never `.claude/` or `.env.local`), rebase onto origin/main, re-run a key suite, and push to main (Owner, 2026-10-21: review here, then push to main); then start slice 5 from the kickstart prompt.

## 2026-10-21 - Post-scan slice 4b reviewed and browser-checked; type check clean (uncommitted)

Phase 9 remains active. The uncommitted slice 4b diff on `claude/phase9-psr-slice4b-sdd-ffa027` (base 39b993a) passed the SDD-0 §15 medium review pass with no code correction. OpenCode Go was unavailable (subscription required), so on the Owner's choice the free OpenCode DeepSeek v4.1 Flash reviewed it, and on the Owner's request GPT-6 Luna (via Codex) and Haiku 5.5 also reviewed it. DeepSeek and Luna found no defect. Haiku's one medium finding (the server's `[:alpha:]` might count digits, so the app mirror could choose a script the server refuses) was disproved by a read-only live check: the project runs `en_US.UTF-8`, where digits of every script and some Devanagari signs are not `[:alpha:]`, so the app mirror is the stricter rule. Free MiniMax produced no report. Tests: PGlite script parity 25/25; `git diff --check` clean; `npx tsc --noEmit` exit 0 with zero errors once the worktree had its own `npm ci` install (the 10 earlier errors were packages missing from the shared install, so the type-check gate is closed); a Jest run under heavy machine load had 7 timeouts in five suites, and `batchReviewCard.test.tsx` then passed 58/58 alone (Codex's own full run: 831 passed, 0 failed). Browser check (Haiku, scan 8eb9b18a, Owner signed in): the card language chooser offers and finds Kannada, Telugu and Malayalam; four manual cards were added through the app, and a read-only readback shows scripts `Deva` (गोदान, hi), `Knda` (ಮಲೆಗಳಲ್ಲಿ ಮದುಮಗಳು, kn), null (mixed `ಕನ್ನಡ Book`, en; still added) and `Latn` (English). The chosen-edition and leave-guard steps could not be run in the browser (no edition list without pressing Search Books; the web scan page has no back control) and rest on their unit tests. The only database writes were those four normal app Adds of dev cards; the orchestrator ran read-only SQL only. Also found: the Unit 5C SDD §2 line "no Unit 5C generation, activation, or search-projection runtime exists" is stale (Gemini romanization, proposal persistence and active-variant search exist; activation is gated); recorded for the Unit 5C follow-up, not changed here. Evidence: [tracker 38 §24](trackers/38-post-scan-rework-evidence.md#24-slice-4b-review-browser-check-and-type-check-2026-10-21).

Active work unit: post_scan_rework_slice4b_script_languages. Exact next authorized action: on the Owner's go, commit the 4b code, tests and docs on this branch (never `.claude/` or `.env.local`), push the branch and open the 4b PR after the slice-4a PR.

## 2026-10-21 - Post-scan slice 4b implemented locally; type-check gate open

Phase 9 / Unit 6G remains active. The Owner's 2026-10-21 coding brief authorized the approved small 4b scope on `claude/phase9-psr-slice4b-sdd-ffa027` at `39b993a`: manual script recomputation after the existing metadata-choice decision, Kannada/Telugu/Malayalam in the shared language list, and deletion of the unused variant client (SDD-1 §§2/6, AC4-7/10/11). No stale-wording handling or production Add sequencing changed. The implementation remains uncommitted.

Verification: initial red Jest 34 failed / 164 passed; final feature assertions 67 suites passed / 1 skipped, 831 tests passed / 4 skipped / 0 failed; the serial run emitted a non-exit warning, recorded with cleanup diagnostics in the evidence. Current-migration PGlite parity passes 25/25. `npx tsc --noEmit` fails with 10 diagnostics in untouched Library/Clubs/e2e paths (six missing packages and two consequent implicit-any errors); this is an open type-check gate, not a clean build claim. Detailed test names, red reasons, raw diagnostics and file scope: [tracker 38 section 23](trackers/38-post-scan-rework-evidence.md#23-slice-4b-local-implementation-and-verification-2026-10-21).

Active work unit: `post_scan_rework_slice4b_script_languages`. Exact next authorized action: the orchestrating session reviews the uncommitted 4b diff under SDD-0 §15's medium review pass. TypeScript must be rerun after the dependency installation is repaired. No Supabase MCP/CLI, database, Storage, migration, provider, deployment, stage, commit, push or branch change occurred; none is authorized by this handoff.

## 2026-10-21 - Post-scan rework slice 4b SDD: script recompute and three languages; stale search wording deferred to Unit 5C (docs only)

Phase 9 remains active. On branch `claude/phase9-psr-slice4b-sdd-ffa027`, now based on slice 4a's local tip 8c1b004, the slice 4b SDD was finalized after a read-only Supabase MCP check (project ahntbtktjjmvfosgkmgn). The check showed a card save never makes a search-variant proposal stale (M29 trigger filter), no `stale` proposal exists live, and Unit 5C search variants are built but switched off. The Owner reduced 4b to S / med (2026-10-21): a script recompute that sets a script only when both the app rule and a mirror of the server rule accept it (null as today otherwise; a chosen edition keeps its script), Kannada, Telugu and Malayalam in the language list, and removal of the unused variant client. Clearing stale search wording is deferred until before any Unit 5C language is switched on (SDD-1 §6, SDD-0 §11, 05c §13). Reviews: Opus and Argon on the earlier large design, Sonnet on the small one; all verified findings applied; Argon skipped for the small one on the Owner's instruction. No code, no migration, no database or Storage write. Evidence: [tracker 38 §22](trackers/38-post-scan-rework-evidence.md#22-slice-4b-sdd-and-read-only-supabase-check-2026-10-21).

Active work unit: post_scan_rework_slice4b_script_languages. Exact next authorized action: on the Owner's go, commit these docs on this branch; recheck the brief's line numbers on this branch, then send the 4b Codex brief (`.claude/psr-slice4b/codex-brief-4b.md`, red-first) with the SDD-0 §15 medium review pass. The 4b PR follows the slice-4a PR.

## 2026-10-21 - Post-scan rework slice 4a built: remove the full correction screen and finish "Add a book" (app only)

Phase 9 remains active. On branch `claude/phase9-psr-slice4a-remove-full-correction`, cut from origin/main 1268403 (slices 1–3 merged, PRs #24–#26), slice 4a (SDD-1 §6, parts tagged 4a) removed the full-correction routes and their screens/components, the Mark false and replace-variant clients and schemas, the legacy Add variant, the full-review draft model and the dead candidates query key. "Add a book" (renamed from "Add missed book") enforces the 15-book rule on `counts.detected >= 15`, defaults the language from the session hint and has a leave guard; a card's hint now says only "This book can't be changed now." The diff is 81 files (26 deleted, 55 modified) plus one new `LanguageChooserPanel.tsx`, +1208 / −5575 lines. Browser check (2026-10-21, web, real backend, Owner signed in, new 11-book scan): "Add a book", the leave guard and the removed routes passed, and the one approved manual book was added (Detected 11 → 12); it found one 4a bug, "Back to review" stacking a second session screen, fixed red-first with `router.dismissTo` and re-checked in the browser. Final verification after the fix (quiet machine): `src/features/imageInventory` 67 suites passed / 1 skipped, 777 passed / 4 skipped, 0 failed; `app/(store-owner)` routes 9/9; tsc clean. Two open observations are recorded, not fixed. Nothing staged, committed, pushed or deployed. Evidence: [tracker 38 §21](trackers/38-post-scan-rework-evidence.md#21-slice-4a-built-remove-the-full-correction-screen-and-finish-add-a-book-2026-10-21).

Active work unit: post_scan_rework_slice4a_remove_full_correction. Exact next authorized action: on the Owner's go: commit (code, tests, docs; not `.claude/` or `.env.local`), sync the branch with origin/main 60a6b6c, Haiku re-runs the final tests, push and open the slice-4a PR. Then slice 4b code. Slice 4b's SDD and its read-only Supabase check were done in a separate session (branch `claude/phase9-psr-slice4b-sdd-ffa027`, uncommitted; recorded there in tracker 38 §22) and wait for the Owner's approval and decisions 4b-1 to 4b-5. No migration.

## 2026-10-20 - Post-scan rework slice 3 built: remove the after-Add buttons and the Inventory tab's list (app only)

Phase 9 remains active. On branch `claude/phase9-psr-slice3-inventory-tab` from 68a6cfc (slice 2's tip, PR #25), slice 3 (SDD-1 §5, AC3-1 to AC3-4) removed "View in Store View" after Add and the Inventory tab's list; the tab now shows the scan card and a link "Added books are in Store View". The old list screen, its hook and the unused read-service parts were deleted. DeepSeek coded it (Codex was at its limit); Codex reviewed it before merge and fixed two findings. Verification: tsc clean; 996 tests passed (6 load timeouts passed alone); the browser check passed. Evidence: [tracker 38 §20](trackers/38-post-scan-rework-evidence.md#20-slice-3-built-remove-the-after-add-buttons-and-the-inventory-tabs-list-2026-10-20).

Active work unit: post_scan_rework_slice3_inventory_tab. Exact next authorized action: the Owner merges PR #25, then the slice-3 PR; then slice 4 (SDD-1 §6) with Codex and the full process. No migration.

## 2026-10-20 - Post-scan rework slice 2 built: declutter the card and the edition sheet (app only)

Phase 9 remains active. On branch `claude/phase9-psr-slice2-declutter` from 1f98804 (slice 1's tip), slice 2 (SDD-1 §4, AC2-1 to AC2-10) was built red-first and reviewed by the two-round loop. The card now has one "Find or change edition" button, an edition line under the title, no metadata badges, and one `cardAddRequirementIssues` rule behind the badge, Add, Add all and the header count (price missing, ₹0, condition, quantity 1-10,000, author; the label stays "Needs attention"). AC2-10 makes `metadataChoice` manual whenever the card's title, authors, language or script differs from the chosen edition's snapshot. The edition sheet lost detected details, "Use detected details" and "Edit manually", and EditionIdentityFix was deleted; Search Books saves the card's edits first, then searches. The header explanation, footnote and chip are gone; `useUnsavedEditsLeaveGuard` shows OwnerConfirmationDialog on every platform. Nothing committed or pushed yet; the PR #24 (slice 1) merge is with the Owner. Evidence: [tracker 38 §19](trackers/38-post-scan-rework-evidence.md#19-slice-2-built-declutter-the-card-and-the-edition-sheet-card-requirements-2026-10-20).

Verification: GREEN 232/232 after round 1 (folder 845 passed / 4 skipped) and 150/150 after round 2 (folder 849 passed / 4 skipped), tsc clean each time. Haiku re-ran the tests (75 suites passed / 1 skipped, 849 passed / 4 skipped, 0 failed; one load-dependent 5 s timeout in `ownerEditionPickerMounted` that passed twice on re-run) and the approved 6-step browser check passed in full. The read-only server check showed Book 3 committed with metadataChoice manual and price 2500, and Book 5 unchanged. Pre-merge review: the orchestrator's full read and an independent DeepSeek full-slice review found three more issues (a false leave warning after Add all/Remove; the full-review screen blocking Back with no dialog on its loading/error screens; a wrong Retry target), all fixed red-first by Codex; final run tsc clean, folder 853 passed / 4 skipped, 0 failed.

Active work unit: post_scan_rework_slice2_declutter. Exact next authorized action: the Owner reviews slice 2; on the Owner's request, commit (code, tests and docs; not `.claude/` or `.env.local`), push and open the slice-2 PR. Then slice 3 ("Remove the after-Add buttons and the Inventory tab's duplicate list"). The work unit stays until the slice-2 PR merges.

## 2026-10-19 - Post-scan rework slice 1 built: Add re-saves a reset review (app only)

Phase 9 remains active. On the Owner's go-ahead, slice 1 (SDD-1 §3) was built red-first on branch `claude/phase9-psr-slice1-add-resave` from main 6a41033, with Codex `gpt-6.1-sol` (xhigh) writing the code and the orchestrating session reviewing every diff line. Add now re-saves the server's review when the server has reset readiness, whether the reset happened before Add or was caused by Add's own save. It does this at most once per command, freezes each hidden request in full for replay, and stops with "This book changed. Check it and press Add again." when the server's review differs from what the Owner saw in anything but the edition choice. The fall-through label "Review book" is now "Needs details". AC1-3 is corrected in SDD-1: a blocked card keeps "Needs attention" with its blocker text, because §3 changes no other label. No migration; server validation is unchanged. Evidence: [tracker 38 §17](trackers/38-post-scan-rework-evidence.md#17-slice-1-built-add-re-saves-a-reset-review-2026-10-19).

Verification: RED 13 failed / 105 passed in the five named suites, all on behaviour. GREEN, re-run independently: tsc clean; named suites 118/118; `src/features/imageInventory` 799 passed / 4 skipped / 0 failed. In-app check on the dev build (Owner signed in): Book 4, stuck with a reset saved review, was added with one press (one re-save). Book 7, with manual details and an edited title, was added with one press (Add's own save, the identity reset, one re-save). Book 3, whose title was edited while it kept a chosen edition, is refused by the server at the first save (P9_STATE_CONFLICT, blocker metadata_choice_missing). That is the known gap slice 2 AC2-10 closes, not a slice-1 regression. Mutations: no direct DB/Storage write, migration, Edge, Render or deployment; the in-app check added two books to the dev store's private inventory through the app; nothing committed or pushed.

Active work unit: post_scan_rework_slice1_add_resave. Update (§18): a two-model review loop found and fixed two more bugs before merge (a refused re-save could leave a card stuck; "press Add again" was shown on a disabled button). Round 2 approved; Haiku re-ran the tests: tsc clean, 803 passed, 0 failed. SDD-0 §15 now holds the refined per-slice process. Active work unit: post_scan_rework_slice2_declutter. Exact next authorized action: the Owner merges PR #24; slice 2 (SDD-1 §4) starts on the Owner's go-ahead, on a branch from slice 1's tip, with the review loop. Slice 2 starts only after the Owner has used slice 1 in the app (SDD-0 §7.2a) and gives a separate go-ahead.

## 2026-10-19 - Post-scan rework SDD set written (pass 1); 2026-10-18 handoffs reconciled

Phase 9 remains active. Reconciliation: main already records tracker 37 §71 (one Ready rule for the card badge, header count and Add all), §72 (Owner API `phase9-owner-ingestion` v17 deployed 2026-10-18; Ready counts agree in the app) and §73 (Book 4 rejection reasons traced to option snapshots taken before M77; not a code bug). Still not verified live and kept with tracker 37: Search Books on Book 4 after option expiry, and M75 exhausted-search recovery.

New work unit: on the Owner's brief (simplify the post-scan review: remove View metadata, keep Find or change edition, declutter, no separate review step, discard unfinished card details when the session ends, one source of truth once an edition is chosen) and after a discussion phase, the post-scan rework is planned as 18 slices in six SDDs: [SDD-0 overview](work-units/post-scan-rework/00-overview-sdd.md) in full (decisions PSR-D01 to PSR-D47, rules, slice map, verified facts F1–F37, supersessions, open questions) and pass-1 outlines of [SDD-1 review screen](work-units/post-scan-rework/01-review-screen-sdd.md), [SDD-2 catalogue and matching](work-units/post-scan-rework/02-catalogue-and-matching-sdd.md), [SDD-3 session lifecycle](work-units/post-scan-rework/03-session-lifecycle-sdd.md), [SDD-4 Add and publish](work-units/post-scan-rework/04-add-and-publish-sdd.md) and [SDD-5 classification](work-units/post-scan-rework/05-classification-sdd.md). Umbrella decision P9-D89. Database facts were read only through Supabase MCP on ahntbtktjjmvfosgkmgn. Branch `claude/phase9-post-scan-rework-sdd` from main 8863885. Evidence: [tracker 38](trackers/38-post-scan-rework-evidence.md).

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
Stop before rollout or further product changes. [Exact evidence and limits](../../../user/clubs/MAIN-INTEGRATION-REVIEW-20261017.md).

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
and exact next action are owned by [the integration record](../../../user/clubs/MAIN-INTEGRATION-REVIEW-20261017.md).
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

Migration ledger: Owner authorized local M76 creation and application; 20261016000076_marketplace_phase9_edition_explicit_matching.sql was CREATED_LOCAL / NOT_APPLIED at commit, with application following the preflight. M76 is APPLIED_VERIFIED as live version 20261016153615 (commit cc5e944, file SHA-256 90a6dfca30064866e8ab9ceb46d0491cdda7460bd8d74abb0d81ace62d53052f); all six function bodies match the committed file, phase9_edition_identity_compatible is unchanged, owner/ACL/volatility/search_path read back as expected. No data, job, selection, inventory or provider mutation.

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

Exact next authorized action: Owner review of this concrete proposal; implementation/source-spec amendment and any new forward migration/application remain separate decisions. No code/test edit, migration file, shared write, selection/Add, job reset, provider switch, Git publication or deployment occurred. M75 stays deferred. The previous local scroll correction remains uncommitted. [Evidence, proposal and limits](trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §29).

## 2026-10-13 - Covers and disabled choices diagnosed read-only

Phase 9 / Unit 6G remains active; the prior two-file scrolling correction stays local and uncommitted. The Owner requested an explanation of missing covers and disabled choices. This read-only investigation is complete: the Black Swan set has ten original positions, one eligible, seven ineligible and two unavailable. Of eight usable records, five have no own-edition cover reference; all three supplied image URLs load. The exact-title guard rejects the Penguin title variants without "The"; unknown language also rejects an otherwise matching row. The first five happen to contain no eligible choice.

This is a data/selection usability limitation under existing picker §§3/4.1/13.14, not an approved rule change. The UI's generic rejection message hides these distinctions. No search, selection, Save, Add, source/test edit, provider flag, database/Storage mutation, migration or deployment occurred. M75 remains deferred and uncreated/unapplied by this session.

Exact next authorized action: Owner review of these findings and direction on whether to amend matching/confirmation, rejection explanations or same-edition cover fallback. No implementation or publication of those changes is inferred. [Exact read-only evidence and limits](trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §28). Earlier live Add and local scroll proofs retain their recorded scope.

## 2026-10-13 - Metadata sheet scrolling corrected locally

Current status: `metadata_sheet_scroll_correction_local_verified`. Phase 9 / Unit 6G remains active. The Owner reported that the live scan's metadata sheet could not scroll. A bounded two-file local layout correction restores the existing picker SDD §3 / §10 EP-AC03 interaction; no requirement, acceptance ID or command contract changes.

Before the fix, the 375 × 580 browser sheet clipped a 1600px ScrollView inside a 522px cap; its inner GlassCard content wrapper did not shrink. Ordinary scrolling left scrollTop=0. The main review list scrolled normally after Escape closed the sheet. GlassCard now accepts an optional inner contentStyle, and only CandidateMetadataSheet opts into flexShrink=1 / minHeight=0. Other callers keep their defaults.

Fresh verification: four focused Jest suites / 67 tests PASS; TypeScript no-emit PASS; Expo web export PASS (2690 modules / 69 assets). The rebuilt localhost:8083 preview passed ordinary wheel scrolling: 482px scroll viewport, scrollTop0 -> 580; Show all expanded ten saved positions, and scrolling reached the visible Close metadata button at y508-560. No automatic scrollIntoView was used for this scroll proof. The scan still displays seven detected, six in review, one added.

The earlier live Open Library selection/private Add proof remains valid. This correction is local and uncommitted; the shared runtimes remain at the previously verified source. No Search Books, selection, Save, Add, provider flag, database/Storage/job mutation, migration, staging, commit, push or shared deployment occurred in this check. M75 remains uncreated/unapplied and deferred. Native-device scrolling was not run.

Exact next authorized action: Owner review of the corrected scrolling in the open localhost:8083 scan. Publication of the two-file correction requires a separate instruction. [Cause, source changes and ordinary-scroll evidence](trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §27); preceding dated entries retain their historical scope.

## 2026-10-13 - Open Library enabled; fresh-session picker and private Add verified

Current status: `open_library_live_fresh_session_picker_private_add_verified`. Phase 9 / Unit 6G remains active. The Owner's "ok" authorized Open Library activation and one controlled authenticated fresh-session test. The specified testimage.jpeg had been uploaded before, so the app's duplicate guard prompted; the test used Proceed and created independent candidates for this session. The Search Books -> selection -> private Add path passed for one book; six other detected books remain in review. M75 remains PROPOSED / NOT_CREATED / NOT_APPLIED and deferred.

Fresh exact-project preflight matched Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn, Render LIVE commit 76348f3 and Owner API ACTIVE v16/JWT enabled. One bounded registry update enabled Open Library at 2026-10-12T22:05:26.434106Z (13 October IST); only enabled/updated_at changed. Google remains enabled. Existing retention, attribution, permission and image-cache flags are preserved; no migration or deployment occurred.

The old scan 93567d47-3874-4576-b3b4-1adb044b552b was closed through the authenticated app at 2026-10-12T22:08:44.023344Z. Live readback: closed/version3, all five candidates retained, all four committed inventory rows present, unchanged candidate states/versions/links. The unfinished card is read-only session history; its exhausted job is still in_progress at 5/5. No job reset or recovery fix was performed.

Exact next authorized action: Owner review of the live proof and direction on the six remaining cards in active session 7a81bdb6-ed34-40cb-b5a9-cff85402cf48; separately decide whether to authorize the proposed M75 exhausted-lookup recovery. The new session remains active, and the existing expired 5/5 job remains untouched. Sources: picker SDD §13.14, DOC-3 §5.2.1, Unit 6G SDD §§14/23 (U6G-AC13/18/20). [Live picker and Add evidence](trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 §26); earlier headers are historical.
## 2026-10-13 - Owner API v16 verified; exhausted lookup recovery pending

Current status: open_library_owner_api_v16_verified_exhausted_lookup_recovery_pending. Phase 9 / Unit 6G remains active. Render still runs reviewed commit 76348f3; phase9-owner-ingestion is now ACTIVE version 16 with JWT verification enabled. All 35 served runtime files match the reviewed upload; three additional uploaded files were type-only dependencies, as independently checked against the Deno runtime graph.

Fresh API checks: OPTIONS 200, unauthenticated POST 401. The actual authenticated Codex browser loads the scan and reads edition state. The verified frontend export was restarted at localhost:8083, managed session 96852, after the old Metro preview had stopped; the fresh tab uses the tested static bundle and correct project.

The supplied card is blocked by an existing in_progress edition request with attempt_count=max_attempts=5 and an expired lease. Live dispatcher and claim predicates exclude it, while the choices reader reports pending; the UI therefore shows Searching books indefinitely. No job, selection, selling field or provider flag was manually repaired. Open Library stays disabled.

Proposed bounded correction: a new forward M75, leaving M65-M74 unchanged, must expose exhausted expired edition requests as failed and allow an initiating-Owner controlled retry with preserved chosen metadata, selling details and accounting/audit evidence. Exact file is proposed only: 20261013000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql; NOT_CREATED / NOT_APPLIED. Local creation and conditional shared application await the Owner's separate authorization.

Exact next action: obtain that bounded M75 authorization, then reproduce, implement and review the correction before fresh preflight/application and the controlled live edition workflow. No Render or Owner API redeployment is needed for the proposed SQL-only correction. [API deployment and live recovery finding](trackers/37-owner-edition-picker-open-library-local.md) (tracker 37 sections 23-24); earlier dated entries are historical.

## 2026-10-12 - Fresh predeployment browser checkpoint; Render held

Phase 9 / Unit 6G remains active and the M74 applied/verified status is unchanged. The requested local browser checkpoint is complete: the exact edition-picker checkout/branch/HEAD were verified, the preview and bundle came from that worktree, and the installed Playwright/Edge harness passed all nine cases (zero failed, zero skipped, exit 0). API responses and persistence in the harness were simulated. One P3 visual finding is recorded in tracker 37 §16; no product source was changed.

The live Codex in-app browser showed the supplied scan route and existing session state. No explicit Search Books, edition-selection, Save, or Add command was sent. No shared Auth, inventory, Storage, provider, migration, or deployment mutation occurred. The preview remains at http://localhost:8083 in managed command session 32257. Exact next action: independent read-only aggregate prepublication review with this browser evidence, then the final Free-plan/configuration preflight. STOP before Render deployment. Detailed evidence and screenshots: trackers/37-owner-edition-picker-open-library-local.md §16.

## 2026-10-12 - M74 applied and verified; Open Library disabled; Render held

Current status: open_library_m74_applied_verified_render_held. Phase 9 / Unit 6G remains active. The Owner explicitly requested completion of M74 preflight/application after the approved bounded correction. That application authority supersedes the earlier local-only gate for M74; publication, provider activation and Render deployment remain held.

Fresh preflight matched the reviewed file and both M73 function bodies/permissions on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn; the focused full-M74 SQL/security suite passed 20/20. M74 is APPLIED_VERIFIED as live version 20261012140853. Archived SQL SHA-256 FE0B13B7D10DA09AFFF71E031E6330F8568C5D05638F079551A7652172EF2FF3 matches the unchanged local file; both installed function bodies match the reviewed definitions.

Only the two private completion/registration functions changed. Their signatures/owners/ACLs/search paths and 17 other checked functions remain intact; provider-call columns/RLS/ACLs/policies, provider flags and observed business/job counts are unchanged. Open Library remains disabled with no unresolved OL attempt. One existing in_progress edition job has an expired lease; it was observed and preserved.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. Compatible client/worker/Owner API rollout, separately authorized provider activation and controlled shared operational acceptance remain pending. STOP before Render deployment. No commit, push, runtime deployment, provider request, Auth/inventory/Storage write or account/configuration change occurred. [Application ledger, exact readback and scope](trackers/37-owner-edition-picker-open-library-local.md) (§15). Earlier dated checkpoints are historical.

Owner authorized M74 application: 20261012000074_marketplace_phase9_open_library_author_isolation.sql; APPLIED_VERIFIED / live 20261012140853; reviewed SQL hash unchanged.

## 2026-10-12 - Author isolation corrected locally; M74 unapplied; Render held

Current status: open_library_author_corrections_local_verified_m74_pending. Phase 9 / Unit 6G remains active. The Owner authorized "Yes, fix both and create local M74". Both aggregate P2 findings were reproduced, corrected and regression-tested; GPT-6 Luna/max approved the bounded correction. This does not replace the aggregate prepublication review.

The adapter validates edition facts before allocating complete own-author sets within the four-author budget. Nonretryable author-content failures leave only dependent rows unavailable; local M74 permits truthful finalized receipts to continue and complete without weakening mandatory-stage, retryable, egress or authority guards. Google ranking/cover and Owner UI behavior are preserved.

M65-M73 remain applied and byte-preserved. M73's archived live SQL matched its reviewed hash in this session's read-only exact-project check; OL remains disabled. M74 is CREATED_LOCAL / NOT_APPLIED. No shared mutation, provider request, browser action, staging, commit, push or deployment occurred in this correction.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. M74 application needs a separate decision and fresh preflight; compatible client/worker/Owner API rollout, provider activation and authenticated operational acceptance remain gates. STOP before Render deployment. [Exact scope, commands, migration ledger and evidence](trackers/37-owner-edition-picker-open-library-local.md) (§14). Earlier dated checkpoints are historical.
Owner authorized local M74 creation: 20261012000074_marketplace_phase9_open_library_author_isolation.sql; CREATED_LOCAL / NOT_APPLIED. Shared application is outside this correction's authority.

## 2026-10-12 - Browser corrections verified; M73 applied; Render held

Phase 9 / Unit 6G remains active. Status: `open_library_browser_corrected_m73_applied_render_held`. The Owner authorized the bounded corrections and migration application, with an explicit stop before Render deployment.

The Response receiver, bulk-control lifetime and metadata-sheet opacity are corrected. Fresh gates: 25 client suites / 379 tests, eight actual-app browser fixture cases, 25 full-M73 SQL/worker cases, worker build / 14 structural checks and TypeScript PASS. Luna/max approved only the bounded source corrections; no independent test rerun or aggregate publication approval is claimed. No new Save step was introduced.

M73 is APPLIED_VERIFIED on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn as version 20261011224457; archived SQL SHA-256 matches the unchanged reviewed file. Open Library is installed disabled. Existing books/candidates/inventory/provider-call data, provider-call RLS/grants and M65-M72 bytes are preserved. Seven read-only actual-adapter OL GETs returned 200 with minimum start spacing 1005.37 ms; raw bodies and returned metadata were discarded.

Exact next authorized action: report this verified correction/application checkpoint and the remaining rollout prerequisites, then STOP before Render deployment. Compatible client/worker/Owner API publication and rollout, shared provider activation, authenticated shared workflow and operational acceptance remain pending. No Git publication, runtime deployment or provider activation occurred here. [Exact evidence, migration ledger and limits](trackers/37-owner-edition-picker-open-library-local.md) (§11). Earlier dated checkpoints are historical.

## 2026-10-11 - Native accounting and request spacing verified; browser handoff

Current status: `open_library_native_spacing_locally_verified_browser_pending`. Phase 9 / Unit 6G remains active and Tasks 1-8 retain their earlier bounded approval provenance. M65-M72 remain applied/byte-preserved; M73 remains CREATED_LOCAL / NOT_APPLIED and shared OL activation remains pending.

Native PostgreSQL through M73 passed 28 cases with 18 observed independent-connection lock overlaps and verified disposable teardown. The Owner-authorized scheduler correction holds the shared permit through fresh authority checks until HTTP dispatch; a compiled-factory fixture run spaced all 18 actual fetch invocations at least one second apart across three jobs. The 397-test backend gate passed. These local proofs do not establish deployed provider/browser behavior.

Next authorized action: use the separate predeployment browser inspection prompt in another session, then return its report here for the final Free-plan/configuration preflight. Do not start browser testing in this preparation session. Deployment remains held at the Owner's request; M73 application, shared provider activation, compatible runtime/client rollout, shared security/cleanup/recovery/disablement and publication remain gates. Available-model local correction review does not replace the requested Luna prepublication review, which remains separately pending at its usage limit.

[Detailed scope, evidence and pending gates](trackers/37-owner-edition-picker-open-library-local.md). Earlier dated checkpoints below are historical.

## 2026-10-11 - Local Open Library edition fallback; rollout gated

Current status: `open_library_fallback_local_review_complete_rollout_pending`. Phase 9 / Unit 6G remains active; Tasks 1-8 keep their prior approvals. The Owner authorized explicit-search fallback implementation and "Yes, create local M73". M65-M72 remain applied/byte-preserved; M73 is CREATED_LOCAL / NOT_APPLIED. OL is absent from the shared metadata registry.

Only explicit Owner lookup can use independently permitted Open Library factual editions; automatic Google winner/cache/ranking and representative-cover behavior remain unchanged. Owner authorized local M73 creation: 20261011000073_marketplace_phase9_open_library_edition_options.sql; shared application is separate.

Next authorized action: hand off the verified local correction and detailed independent browser prompt. GPT-6 Luna/max found no remaining bounded blocker and independently passed two focused full-M73 regressions; wider gates remain root evidence. Publication/application/activation/deployment and browser/device verification remain gated; the Owner asked for a separate browser prompt first. [Scope, migration ledger, evidence and gates](trackers/37-owner-edition-picker-open-library-local.md). Earlier dated entries are historical.

## 2026-10-11 - Provider checks complete; retention decision remains pending

Phase 9 / Unit 6G remains `feature_published_runtimes_deployed_provider_gate_pending`. The Owner explicitly authorized multiple read-only Google Books checks with the existing Render key only in memory and Open Library investigation. This supersedes the earlier pending one-request question. No provider switch, new retention permission, product edit, migration or deployment is inferred from that authorization.

The Owner's latest decision is Google first, Open Library only if required. Six configured-key Google probe invocations produced one title/author HTTP 200 and five HTTP 503 responses across ISBN, title/author and plain-title queries. The inspected failures reported backendFailed / Service temporarily unavailable. Cache-Control, Expires and Age were absent in every observed response. The successful response establishes configured-key access to this endpoint; its body was cancelled. Subsequent in-memory data checks failed before returning usable book content. This does not prove all Render configuration, the worker's network response, any cache lifetime or continued selected-snapshot rights. No key or Google book payload was recorded. These observations warrant a bounded fallback proposal, not an unapproved provider switch.

Independent read-only recheck (2026-10-11): GPT-6 Luna/max found no request-construction defect; the endpoint, search operators, encoding and ten-result parameters match official Google documentation. The six earlier configured-key receipts support intermittent provider-side failures, not a current/global outage. Two fresh root Node HTTP probes without a key returned 429/rateLimitExceeded; these cannot diagnose the configured key or the Owner's project quota. The reviewer attempt failed before HTTP at TLS. Render browser tab control remained unavailable, so no fresh keyed result or successful book-list inspection was obtained. The bounded availability fallback remains reasonable to consider; no provider switch was implemented. Detailed limits and timestamps are recorded in tracker 36.

The Owner's 24-hour retention cap and cleanup after confirmed Add are already approved. The missing production verifier is a separate server implementation/evidence gate, not a missing Owner approval or Google dashboard approval setting. Absence of inspected cache headers alone is not treated as a blanket prohibition on factual metadata use.

Production bootstrap still installs no verifyOptionsRetention callback. Unknown permission therefore denies persistence as policy_denied. Google branding permits ordinary attributed API display; Google API terms §5(e) separately constrain cached/permanent content with stated rights/law exceptions. This audit has not established permission for this approved 24-hour alternatives plus persistent selected-snapshot workflow. More requests or storage_allowed=true cannot create that evidence.

Three read-only Open Library requests returned HTTP 200: one work search, a ten-edition page, and a separate exact-ISBN edition. Its API guidelines encourage caching for human lookup and impose request limits; cover guidance favors direct covers.openlibrary.org image links. Licensing does not assert new database rights and acknowledges possible existing contribution/jurisdiction rights. No blanket CC0 license for every record or cover is claimed. The current picker is Google-specific across SQL, worker, wire links and UI; Open Library remains a proposed scope amendment, not an implemented fallback.

Fresh local verification: two existing provider safeguard suites / 92 tests passed. Source, tests, dependencies and M65-M72 are unchanged. Only twelve existing evidence/handoff documents changed; nothing was staged, committed or pushed in this investigation. No Auth, inventory, database/Storage, configuration, billing or deployment mutation occurred.

Exact next action: present the Google-first findings and obtain separate local migration/implementation authority for the documented Open Library edition fallback if the Owner chooses that correction. Retain Google as the preferred provider; do not change the automatic winner/cache path. Keep the current retention gate closed until the chosen path has acceptable evidence and reviewed compatible code. Browser/device and operational acceptance remain pending.

[Actual provider responses and decision proposal](trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - Compatible runtimes deployed; provider and operational gates pending

Current status: `feature_published_runtimes_deployed_provider_gate_pending`. Phase 9 / Unit 6G remains active; Tasks 1-8 retain their local approval boundaries. The Owner explicitly confirmed the exact two-service deployment after the earlier approval-review rejection. That rejection and earlier deployment holds below are historical; this entry owns the current handoff.

Render `phase9-metadata-worker` is LIVE at `f2d47cb1d015c8b93ded58baff35f125f99ad52c` (deployment `dep-db5b71ajnfac739scpag`). One cached deployment used the existing Free service, one instance, main, and autoDeploy off. GET /health and /ready returned HTTP 200; readiness is process-level evidence, not live provider/database proof. Executable source equals independently approved `47207b7385ee4ae37e01c48b7dba0738abb53389`; their differences are documentation only.

Supabase `phase9-owner-ingestion` is ACTIVE v15 on verified Bookconnect_reactexpo / `ahntbtktjjmvfosgkmgn`, with verify_jwt=true. Deployment followed worker commit/health verification. Prepared source had 38 files; all 35 returned runtime/configuration files match it exactly. Three type-only dependencies are absent from the deployed readback; the emitted runtime graph is complete. CORS OPTIONS passed and an unauthenticated POST was rejected with HTTP 401.

M65-M72 remain applied and byte-preserved; no migration was created or applied in this checkpoint. Read-only preservation counts remain books 45, candidates 173, inventory 21, edition states 0. The only service mutations were the two runtime deployments. Plan, instance count, automatic deployment, secrets, permissions, schedules, Auth, Storage and business data were not edited.

Provider-result retention remains disabled: production has no verified permission callback. Exact next action: investigate the configured Google Books retention permission read-only and establish acceptable evidence before any explicit edition request or result storage. Authenticated Search Books/selection, Save/resume/Add, expiry/cleanup/recovery, browser/device accessibility and controlled operational acceptance remain unverified. Deployment success does not complete those gates. No product tests were repeated for this documentation closeout; the approved source CI remains applicable. [Activation receipt](trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - Runtime activation blocked by deployment approval review

Phase 9 / Unit 6G remains locally implemented and published; current runtime activation status is feature_published_runtime_activation_approval_blocked. The Owner replied "ok please proceed it then" to the reviewed deployment sequence. Fresh readback confirmed both GitHub refs at f2d47cb1d015c8b93ded58baff35f125f99ad52c; its only differences from independently approved 47207b7 are twelve documents. Executable source and migrations are identical. The earlier successful source CI and independent review remain applicable; no product test was rerun in this checkpoint.

Immediate preflight verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY and M72 version 20261010200655, both expected functions, private service execution=true and public authenticated execution=false. Render target remains phase9-metadata-worker / srv-d9sqfdvqj5pc73dc66fg in workspace tea-d9j67irtqb8s739ritc0, one Free instance, main, autoDeploy off and the existing Dockerfile/health contract. No new migration or data mutation occurred.

One Render trigger_deploy attempt with clearCache=false was REJECTED by automatic approval review; it returned no deployment ID. Its stated reason was that the earlier instruction to stop before deployment requires exact-action confirmation despite the subsequent general proceed reply, and deployment may disrupt the live worker. Do not retry through another interface or bypass this rejection. No Render deployment began and no Owner Edge deployment was attempted. Browser inventory timed out and reset its kernel before any UI access or action.

The corrected Owner API manifest was freshly reverified: all 38 files / 182814 source bytes equal immutable 47207b7, manifest SHA-256 6baf912a93ee21adb2680a06a5ebcf7bc5d1c3d07264fd6cc4234e1fbf565aae, project/function/entrypoint/import-map exact and verify_jwt=true. Render MCP deploys the configured branch head rather than accepting a commit pin, so the proposed actual Render revision is f2d47cb with the same reviewed executable source. Runtime deployment order remains metadata worker, verified commit/health, then Owner API. Provider-result storage remains disabled without verified permission.

Exact next action: obtain the explicit confirmation required by automatic approval review for ONE existing Free Render metadata-worker deployment from main/f2d47cb, preserving cache, plan, instance count, configuration and secrets; after commit/health verification, deploy the verified Owner API to the exact development project with JWT enabled. No API deployment may precede the compatible worker. No provider request, job endpoint, inventory/Auth/Storage/billing/configuration mutation or Git publication occurred in this checkpoint. The authorization block is not a code defect or failed product test. Earlier dated deployment holds and preflight entries retain historical provenance.

[Deployment evidence](trackers/36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - M72 applied; backend activation preflight

Phase 9 / Unit 6G remains feature_published_runtime_pending. Under the Owner's current step-by-step backend authorization, M72 is APPLIED_VERIFIED on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn as live version 20261010200655. Its archived SQL equals the reviewed file and its original SHA-256 is preserved. M65-M71 source bytes and existing Phase 9 function definitions/ACLs are unchanged.

Rollout order is M72, compatible Render metadata worker, then the Owner Edge API. The old worker's claim RPC has no edition-operation filter and its decoder cannot handle edition_options contexts, so the new API must not enqueue those jobs until the new worker is healthy. No edition jobs exist at this checkpoint. Owner API remains ACTIVE v14; metadata runtime remains bb91428048ca9028c5592cbbc52c982bd6843946. The Owner's explicit stop before Render deployment remains in force.

A fresh ordinary Deno check exposed extensionless imports newly reached by the API. The bounded local correction adds seven .ts suffixes in contracts/metadata.ts and contracts/providerReuse.ts, naming the same existing targets without changing metadata, ranking, cover, authorization or retention behavior. Fresh verification passed Deno check --no-lock, two existing Jest suites / 49 tests, worker build plus 14 structural tests, and whole TypeScript. GPT-6 Luna/max independently APPROVED this bounded correction at 47207b7385ee4ae37e01c48b7dba0738abb53389 and reran the same relevant gates, including emitted CommonJS import checks. The atomic non-force push succeeded and both GitHub main/codex/edition-picker read back at that reviewed source commit. Fresh source CI run 38083807305 completed SUCCESS: full repository test, TypeScript and production web-export steps passed. Fresh CI counts were not independently recounted because log download returned HTTP 403; local 49/49 and structural 14/14 counts are separately verified.

Exact next action: obtain the Owner's final Render decision, then perform one controlled manual deployment of reviewed/published source 47207b7 to the existing Free metadata service; verify its commit and health before deploying the prepared Owner API bundle with verify_jwt=true. The explicit Render hold keeps both runtime deployments unperformed at this checkpoint. Provider-result retention remains disabled without verified permission; registry flags and cache headers are not authorization. No Edge or Render runtime deployment, provider request, inventory/Auth/Storage/configuration/billing change occurred. [Exact application, rollout, artifacts and verification evidence](trackers/36-owner-edition-picker-publication-deployment.md). Earlier dated records below are historical.

## 2026-10-11 - Edition picker published; development runtime pending

Phase 9 / Unit 6G remains active; current status is feature_published_runtime_pending. GPT-6 Luna/max APPROVED the bounded returned-stale correction and the updated aggregate pre-push feature at de97beda6e4253cdb14369bf29bb6c6ff3429a24. The Owner-authorized atomic non-force push succeeded and remote readback verified both GitHub main and codex/edition-picker at that commit. All seven local edition-picker commits and their earlier main ancestry are included; the separate Desktop Unit 6I work is excluded.

Owner authorized local M72 creation by replying "Yes, create the local M72 correction": 20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql remains CREATED_LOCAL / NOT_APPLIED with its original hash. Independent correction checks passed: 104 SQL tests (eight through M72), six Jest suites / 124 tests, whole TypeScript, worker build/14 structural checks, continuity, syntax and whitespace. Prior CHANGES_REQUIRED findings and their corrections retain their historical provenance. The earlier full merged Jest result of 337 suites / 3,293 tests with four existing pending predates M72. Fresh GitHub validation for reviewed de97bed passed: 337 suites / 3,296 tests, one skipped suite and four skipped tests, TypeScript and production web export. This is fresh CI evidence after M72, distinct from the earlier local full run.

Next checkpoint: report the backend activation preflight for the Owner's decision on shared M72 application and coordinated compatible runtimes. M72 application still requires separate Owner authorization; Render deployment remains on the explicit hold and provider-result retention stays disabled. M65–M71 remain applied/byte-preserved. The Supabase Owner API is still v14 and Render metadata runtime still bb91428. No shared database/Storage/provider/configuration/plan/deployment mutation occurred during Git publication. [Publication, review, migration ledger, warning audit and limits](trackers/36-owner-edition-picker-publication-deployment.md). Earlier dated records are historical.

## 2026-10-10 - Owner-authorized feature publication and development backend rollout

Phase 9 / Unit 6G remains active; Tasks 1-8 retain their recorded local approval and verification boundaries. The Owner explicitly authorized committing this edition-picker work, a GPT-6 Luna review at max before pushing, bounded corrections of confirmed findings followed by correction review, publication to GitHub main after approval, and compatible development backend rollout.

The separate Desktop Unit 6I checkout remains outside this publication. All nine baseline commits are already in main at 6e8848e82b47538f67962f0e34238d0017707711. The feature must integrate that current main without dropping its later work. M65-M71 source bytes remain immutable; their recorded shared application is not permission to reapply migrations.

Current work unit: local publication preflight and pre-push review. Exact next action: commit the feature snapshot, integrate current main, then perform the requested read-only subagent review and verification before publication. Runtime rollout follows approval/publication; new provider-result retention remains disabled until independently verified permission is available. No feature publication, deployment, or new shared database mutation is claimed at this checkpoint.

See the [publication and deployment record](trackers/36-owner-edition-picker-publication-deployment.md) for fresh checks, review findings, corrections, exact commits and service readback. Earlier dated handoffs retain historical provenance.

## 2026-10-10 - Local UI inspected; edition-choice read blocked by deployed backend

Current status remains edition_picker_m71_applied_runtime_pending. Phase 9 / Unit 6G and Task 8 LOCAL approval remain unchanged; M65-M71 remain applied to the development project. The existing scan UI rendered from the edition-picker worktree. Opening Change edition showed the metadata sheet, but its saved edition-choice read failed; no option rows, option covers, publication dates, or Search Books control were available.

Supabase MCP confirms phase9-owner-ingestion is active at version 14 on ahntbtktjjmvfosgkmgn. Its deployed source does not contain the edition-choice read, request, or selection action names used by the local client. This is consistent with the rendered read error and blocks browser verification of edition results and selection. [Exact browser, bundle, and function evidence](trackers/35-owner-edition-picker-local-web-preview.md).

Exact next action: Owner review of this local UI result and decision about Git publication and compatible development Edge deployment. After the compatible function is available, repeat the browser test for search, edition rows/covers/publication data, selection, Save/resume, and Add under the existing operational gates. Provider retention permission remains separate. No product source or migration was changed; nothing was staged, committed, pushed, merged, deployed, or applied in this UI check.

## 2026-10-10 - M71 applied; local browser inspection next

Current status: edition_picker_m71_applied_runtime_pending.
Phase 9 / Unit 6G baseline complete; Task 8 LOCAL approval retained.
Bounded M71 read-only correction review APPROVED in this chat.
M65-M71 are APPLIED / catalog-verified on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn; M71 live version 20261010110835.
Only the private selection delegate changed; wrapper, permissions, other Phase 9 functions and business counts are preserved.
[Preflight, application ledger and verification](trackers/02-implementation-and-verification.md).
Codex browser page reading and banner-dismissal clicking now PASS; feature UI/device checks remain unrun.
Next authorized action: inspect the local feature app's compact/full scan UI before Git publication.
Compatible Edge/worker deployment and verified provider retention permission remain pending.
This request applied M71 only. No staging, commit, push, merge, deployment, provider/Storage or business-data mutation.
Earlier dated NOT_APPLIED/review/browser-blocked entries are historical; this entry owns current status.

## 2026-10-10 - Unknown-language selection correction checkpoint

Phase 9 / Unit 6G baseline complete; Task 8 LOCAL approval retained. The Owner
supplied independent UI-correction approval and authorized the bounded backend
unknown-language eligibility correction, local regressions and ONE forward M71.
[Cause, preflight, migration ledger and correction evidence](trackers/02-implementation-and-verification.md).
M65-M70 remain APPLIED / byte-preserved. M71 is CREATED_LOCAL / NOT_APPLIED.
Owner authorized local M71 creation after read-only exact-project/schema and
filename preflight: 20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql.
This authority admits exactly that local file; it does not authorize application.
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
and a polite empty-result announcement. [Correction evidence](trackers/32-owner-edition-picker-task7-ui-evidence.md)
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
provenance. [Evidence](trackers/35-owner-edition-picker-local-web-preview.md) distinguishes delivery from browser proof.
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
[Restart evidence](trackers/35-owner-edition-picker-local-web-preview.md) records the cold-start checks and their limits.
No browser login/visual PASS, product-source edit, business-data write,
publication or deployment occurred; product tests were not rerun.
Status remains local_web_bundle_verified_browser_runtime_blocked.
Next: diagnose the recurring sandbox permission refresh failure, then inspect
the local scan UI after browser startup succeeds. Prior local approvals,
applied migrations and the preview-first deployment boundary are unchanged.

## 2026-10-09 - Authorized runtime reset; browser connection remains blocked

The Owner-authorized reset stopped six verified JavaScript runtimes and one
verified computer-use helper; the preview remains on port 8083 under PID 5636.
Fresh setup probes still fail with Windows error 32 on the helper DLL after
Codex automatically respawns that helper. Browser tool calls now report
Transport closed. No visual UI PASS or successful repair is claimed.
[Reset evidence](trackers/35-owner-edition-picker-local-web-preview.md) records exact
identities, module checks and remaining scope. Product tests were not rerun;
no source/configuration/migration/business-data/publication action occurred.
Next: reinitialize the app/browser connection and verify sandbox startup
before inspecting the scan UI. Existing local approvals and applied migrations
remain unchanged.

## 2026-10-09 - Fresh scan-route delivery; browser retry blocked

The existing preview was already healthy on port 8083 (PID 5636), so no restart was needed. The requested scan HTML and its actual Expo JavaScript bundle both returned HTTP 200. The 14,986,671-character bundle contains the edition-picker checkout marker, CandidateEditionPicker, EditionOptionList, Search Books, and the verified development project origin; zero Desktop checkout app/src paths were present.

Codex browser control failed before tab access after one supported reset/retry, with `windows sandbox failed: helper_unknown_error: setup refresh had errors`. No browser interaction, login, DOM inspection, screenshot, or visual UI acceptance is claimed. Detailed evidence and the exact runtime diagnostic are in tracker 35.

Status remains `local_web_bundle_verified_browser_runtime_blocked`; M65-M70 remain applied and unchanged. No migration, Auth, database, Storage, provider, app, Git publication, or deployment mutation occurred. Exact next authorized action: restore Codex browser control and inspect the local scan UI before Git publication/deployment.

# Phase 9 Master Tracker

Latest runtime readback: the stopped preview was restored as hidden background
process 5636; scan HTML and the complete edition-picker bundle returned HTTP
200. Codex browser initialization remains blocked, and the deployed Owner Edge
function remains v14. [Detailed recovery evidence](trackers/35-owner-edition-picker-local-web-preview.md)
records the separate server, browser-runtime and backend states.

## 2026-10-09 - Local preview before Git publication

**Status:** `local_web_bundle_verified_browser_runtime_blocked`.
Phase 9 / Unit 6G baseline complete; Task 8 independently APPROVED locally.
M65-M70 remain APPLIED / catalog-verified; no migration was reapplied.
The Owner chose local UI inspection before committing, pushing or deploying.
[Preview/runtime evidence](trackers/35-owner-edition-picker-local-web-preview.md) records the corrected
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
evidence. [Review provenance](trackers/33-owner-edition-picker-task8-local-verification.md)
preserves earlier approval provenance and the unavailable historical 152-path
audit baseline.

**Status:** `task8_independently_approved_m65_m70_applied_runtime_pending`.
The Owner authorized steps 1-3: approval documentation, live preflight and the
six unchanged migrations. All M65-M70 are now APPLIED / catalog-verified on
Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn. [Application ledger](trackers/34-owner-edition-picker-m65-m70-application.md)
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
[Task 8 evidence](trackers/33-owner-edition-picker-task8-local-verification.md) records 17 native PostgreSQL checks /
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

[Independent correction-review evidence](trackers/32-owner-edition-picker-task7-ui-evidence.md#2026-10-09---task-7-correction-review-approved) records the independently
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
bounded self-review, continuity/hash closeout and limits](trackers/32-owner-edition-picker-task7-ui-evidence.md) belong
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

[Independent review evidence](trackers/02-implementation-and-verification.md#2026-10-08---task-6-independent-review-approved) records the separately
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

Phase 9 / completed Unit 6G baseline.
Current status: task6_locally_complete_pending_review.
Owner authorized local M70 creation: exactly
20261008000070_marketplace_phase9_edition_picker_confirmation.sql;
CREATED_LOCAL / NOT_APPLIED. This records local creation authority only.

The Owner authorized completion of the
bounded backend/shared-DTO/client correction and separately authorized local
M70 creation. Task 6's required current-suggestion/no-review resume gap is closed
locally: the server reports confirmedByOwner from valid held choice authority;
full/compact drafts preserve the chosen identity and selling values. Superseded
selection receipts cannot adopt a choice, including when a reread is unavailable.

Fresh gates: 22 Jest suites / 387 tests; 20 full-stack M70 SQL cases plus 32
historical M69 cases; strict TypeScript; worker build and 14 structural cases.
[Correction evidence](trackers/02-implementation-and-verification.md#2026-10-08---task-6-confirmation-correction-local-completion) records exact scope, provenance and evidence limits.
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

[Review and verification evidence](trackers/02-implementation-and-verification.md#2026-10-08---independent-task-6-review-and-bounded-client-corrections)
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

[Task 6 evidence and limits](trackers/02-implementation-and-verification.md#2026-10-08---task-6-client-review-checkpoint-and-confirmation-gap).


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
- Exact next authorized action: review only the bounded Task 5 correction and its regression evidence. Task 6 and live application require separate authorization. Detailed proof and current hash: [implementation evidence](trackers/02-implementation-and-verification.md#2026-10-08---task-5-independent-review-correction).

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

Detailed evidence: [Task 3 corrections](trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-3-review-corrections).

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

Detailed evidence: [implementation tracker](trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-3-local-completion).

## 2026-10-07 - Edition-picker Task 2 correction review approved

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: Tasks 1 and 2 locally complete; the supplied independent correction review is APPROVED. Tasks 3–8 remain pending.
- Active work unit: Task 3 authorization checkpoint; Task 3 implementation has not started.
- Review result: all three findings resolved; no new actionable finding or product decision.
- Next action: Owner authorization for Task 3 Google result envelope, safety and eligibility; do not infer implementation authority from the reviewer verdict.
- Database authority: M65–M67 remain CREATED_LOCAL / NOT_APPLIED. This handoff update performs no new database audit or mutation.
- Git/external state: codex/edition-picker at ee3a8c7; all changes remain uncommitted and unstaged. No migration application, deployment, provider/browser request, live DB/Storage write, commit or push.

The reviewer reports 48/48 disposable database cases, six Jest suites / 368 tests and git diff --check PASS. This session records that external evidence without claiming to rerun product tests. Full feature and operational proof remain pending. Earlier dated checkpoints are historical.

Detailed review provenance and limitations: [implementation evidence](trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-correction-review-approved).

## 2026-10-07 - Edition-picker Task 2 review corrections

- Current phase: Phase 9, Image-Assisted Inventory; completed baseline Unit 6G.
- Local status: task2_locally_complete after the authorized review corrections; Task 1 remains complete and Tasks 3–8 remain pending.
- Active work unit: Task 2 review-correction checkpoint.
- Owner authority: “ok then proceed to fix them please,” followed by confirmation of all three findings before fixing.
- Completed: reusable canonical metadata validation, a unique exact text suggestion with confirmation-required evidence, ambiguity rejection, and corrected plan authority/next-action text.
- Exact next authorized action: review the corrected Task 2 diff/evidence; Task 3 Google result envelope remains the next implementation slice after Owner authorization.
- Database authority: M65/M67 revised locally; M66 unchanged; M65–M67 remain CREATED_LOCAL / NOT_APPLIED. Fresh read-only MCP confirms Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn and live M62.
- Git: codex/edition-picker at ee3a8c7; all work uncommitted. No staging, commit, push, deployment, provider/browser request or live DB/Storage mutation.

Detailed review reconciliation and fresh proof are in [the implementation evidence](trackers/02-implementation-and-verification.md#2026-10-07---edition-picker-task-2-review-corrections). Earlier checkpoints are historical; they do not supersede this handoff.

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

[Detailed evidence](trackers/02-implementation-and-verification.md). Final documentation closeout: PASS: final metadata worker build, Phase 9 continuity (87 Markdown files/62 required/195 existing requirement definitions; zero duplicate/missing traceability), git diff --check, and Task 1 closeout (five completed Task 1 steps; seven remaining tasks unchecked; 32 relative links; 34 modified + 8 untracked files = 22 docs/20 TypeScript files; zero staged; all touched source files ≤350 lines; temporary main-checkout writer removed). Earlier entries below are historical planning checkpoints.


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

Earlier scope-reduction verification: Phase 9 continuity PASS (87 Markdown files, 62 required, 195 existing requirement definitions, zero duplicate/missing traceability); SDD links and scope/ID checks PASS (13 decisions, 20 stable acceptance IDs, 19 active, EP-AC17 deferred); git diff --check PASS. Product/security tests and browser checks NOT_RUN (documentation only). Twenty modified documentation files and the new SDD remain uncommitted; no staged changes.

[Draft SDD](./work-units/owner-edition-picker-sdd.md). This branch's design does not reopen closed milestones or resolve the historical Unit 6G deviations.

Latest display-clarification verification: Phase 9 continuity and git diff --check PASS; all 10 SDD relative links resolve; 14 decision IDs and 20 acceptance IDs are unique, with 19 active and EP-AC17 deferred. All 20 current supporting overlays reference EP-D14. Product/security tests and browser checks NOT_RUN. Scope: display/selection clarification only; no implementation or external mutation.

Readiness audit: relevance order settled; original-position/result-link/eligibility envelope and response-retention evidence are explicit design responsibilities. Public unauthenticated probe returned HTTP 429, so successful configured-provider cache evidence remains a live-enablement gate. Latest documentation verification: continuity and git diff --check PASS; readiness status/contract/IDs/relative links PASS (14 decisions, 20 stable acceptance IDs, 19 active, EP-AC17 deferred, 10 relative links). No implementation or migration started. Next exact action: Owner review/approval of the finalized SDD and eight-task plan, then authorize local Task 1.

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
[Exact scope and verification](trackers/02-implementation-and-verification.md#2026-10-10---existing-inventory-baseline-main-publication).

Phase 9 / Unit 6G remains the active phase/baseline. Existing operational gates
and recorded price-intent / cover-source deviations are retained; this Git
publication is not deployment or live acceptance. No database, Storage,
provider, migration, or manual deployment action occurred. Next action: Owner
decision on committing/publishing the separate edition-picker work.


> **2026-10-01 local Unit 6G card feedback correction:** compact review cards
> now name locally explainable missing/invalid fields when a fresh candidate
> has only the generic `review_missing` blocker. The UI summary does not change
> server readiness or Add eligibility. Focused Jest passed 2 suites/61 tests;
> TypeScript passed. No connected runtime, database/Storage, migration, or
> deployment was accessed. Existing publication/source deviations and their
> operational gates remain unchanged; Owner review of the local diff is next.

> **2026-09-28 Git-publication closeout:** Unit 6G `101e4b6`, Store View
> `ce2d0c5`, and Phase 9 documentation `9ad1d6e` were pushed to
> `origin/codex/phase9-duplicate-confirmation`; remote readback matched
> `9ad1d6e481247b4edb8691262cf45500212f59b7`. Four earlier local
> documentation commits also advanced with this branch. Package files,
> `.hermes/briefs`, and the line-ending-only test remain uncommitted. The
> price-intent and cover-source deviations are still open; connected state,
> database/Storage, and deployment were not changed or verified.

> **2026-09-28 Unit 6G Git-publication handoff:** The Owner authorized commit
> and direct push of the local post-scan and separate Store View changes, with
> the price-intent and cover-source deviations explicitly deferred. Current
> local verification passed 10 affected Jest suites/158 tests, TypeScript,
> Phase 9 continuity, and `git diff --check`. No connected-state readback,
> database/Storage mutation, or deployment occurred. The latest recorded
> connected readback is still 2026-09-22. Next action after Git publication:
> Owner decision on the two deviations before deployment or connected proof.

> **2026-09-27 Unit 6G local correction and documentation handoff:** The
> bounded post-scan corrections A–C and final buffered-edit Add guard are
> implemented. Prior local reports record 6 suites/116 tests for A–C and 3
> targeted suites/77 tests for the final Add guard; these scopes overlap and
> are not additive. TypeScript passed in the prior implementation report.
> This handoff reconciles price/source labels and status snapshots; the
> continuity validator and `git diff --check` passed here. Jest and TypeScript
> were not rerun.
> Latest recorded connected readback remains 2026-09-22 (two private commits,
> three candidates in review); no connected state was checked in this local
> work. Next exact action: Owner review of the combined local diff. No database,
> Storage, deployment, staging, commit, or push occurred in this handoff.

> **2026-09-23 local bounded review-navigation correction:** P9-D88 removes
> the redundant session-header shortcut to the first candidate; each card keeps
> its own full-correction route. The focused screen regression passes 15/15,
> TypeScript passes, and the mounted Codex browser confirms the header action is
> absent while per-card correction remains visible. No server contract,
> database, inventory, deployment, or Git publication changed. Next local action:
> Owner review of the diff and open browser; publication remains separately
> authorized.

> **2026-09-22 local bounded UI correction:** P9-D87 is implemented locally
> without changing server contracts: unchanged title/author editor exits are
> no-ops, bulk-result counts wrap in a compact in-flow footer, and initial Store
> View Publish is confirmation-gated before the existing Unit 7B command. The
> affected Jest run passes **7 suites / 93 tests**; TypeScript, Phase 9
> continuity validation, and `git diff --check` pass.
> Read-only Codex-browser proof confirmed Publish-dialog Cancel leaves the item
> Private, unchanged identity exits show zero edit markers, and price/condition/
> quantity controls remain reachable. No Add/Publish confirmation, external
> mutation, migration, deployment, or Git publication occurred. The Phase 9
> representative-cover connected-proof gate is unchanged; next for this local
> work is Owner diff/browser review, then separately authorized Git publication
> or deployment.

> **Historical connected-proof snapshot (2026-09-15; superseded by the 2026-09-22 connected record in implementation log):** The Owner removed all 15 active
> candidates from the prior `LIVE-TEST-20260912-REPRO` session through the UI,
> then closed it from Session summary. The authoritative summary readback was
> 15 detected, 15 removed from scan, and 0 committed inventory items. The
> processed image itself remained because the input-removal guard uses accepted
> candidate lineage. A new session `93567d47-3874-4576-b3b4-1adb044b552b` was
> started with `Phase9 proof shelf`; its gallery image registered, uploaded,
> processed, and produced 5 candidates. The connected review readback at that checkpoint was
> 5 detected, 1 ready after one saved review of `The Birth of Tragedy` with
> test values ₹0/Good, 4 needing review, and 0 added. One private scan-image
> object was uploaded by the normal Owner flow; no Storage deletion or manual
> dispatch change was made. Next authorized action: Owner review/correction of
> the remaining four candidates, followed by separately authorized Add actions
> if desired. Traceability: Phase 9 Master SDD §6 and Extraction/Enrichment SDD
> §10. This is historical evidence, not a current connected-session assertion.

> **Historical pre-session-cleanup runtime rollout checkpoint:**
> Owner Edge v14 is active in verified development project
> `ahntbtktjjmvfosgkmgn` with JWT verification preserved. The matching
> metadata worker is live on Render deployment `dep-dak2nmjl550s73bqb7jg` at
> reviewed commit `bb91428048ca9028c5592cbbc52c982bd6843946`; `/health` and
> `/ready` returned 200. The local client reached the authenticated Owner scan
> preview with a selected gallery image, but the active session was the
> existing `LIVE-TEST-20260912-REPRO` scan containing one processed image and
> 15 candidates, so `Upload image` was disabled. No new input, duplicate
> Proceed/Cancel, Add, migration, Storage deletion, or dispatch change
> occurred. Connected no-cover proof is blocked pending a clean Owner
> session/store or explicit authorization to remove the existing image.

> **2026-09-14 final read-only review:** HEAD is
> `bb91428048ca9028c5592cbbc52c982bd6843946`; the narrowly scoped M61 observability
> assertion for representative-cover sidecar persistence failures is committed,
> and this handoff synchronization changes documentation only. The
> production path still accepts metadata when optional owner-private presentation
> persistence fails; it now emits a stable warning with lookup/attempt identity,
> a fixed error code, and no raw exception detail.
> The focused composition regression passes 29/29. One prior exact full
> `--runInBand --detectOpenHandles --silent` run had one non-reproducible
> owner-query retry assertion; its isolated rerun and the second exact full run
> passed 303 suites with one skipped and 2,479 tests with four skipped and exited
> normally. TypeScript and
> continuity validation pass. No migration SQL, M60
> duplicate behavior, public projection, database, Storage, deployment, or Git
> history changed. Matching worker/client rollout and connected proof remain
> pending explicit authorization.

> **2026-09-14 full-Jest correction closeout:** The Phase 9 rollout branch's
> reported 12-suite/17-test failure set is corrected locally. Jest now discovers
> only conventional `*.test.*`/`*.spec.*` files, excluding seven helper/fixture
> modules; the mounted-route fixture supplies the current duplicate-resolution
> hook; SQL contract readers normalize Windows CRLF; and the M13 wrapper test
> distinguishes its preserved historical wrapper set from the one superseded
> runtime caller. The separate non-exit warning was traced to TanStack Query GC
> timers retained by orphaned queries and cleared-but-undestroyed mutations;
> test teardown now destroys those instances explicitly. The reporter's exact
> command passes 5 suites/48 tests, image-inventory passes 61 suites/494 tests
> with one suite/four tests skipped, and the complete run exits normally with
> 303 suites/2,479 tests passed plus one suite/four tests skipped (304 suites,
> 2,483 tests total). TypeScript and `git diff --check` pass. The normal full
> run still emits the existing React `act(...)` warnings, the NetInfo
> dynamic-import fallback warning, and dependency warning `DEP0040`; a separate
> `--detectOpenHandles --silent` run has the same totals and exits without a
> persistent open-handle/force-exit/one-second non-exit warning. No runtime
> behavior, migration SQL, external state, database/Storage, deployment, stage,
> commit, push, or merge changed in this follow-up. The gate remains
> `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`.

> **2026-09-13 representative-cover rollout closeout:** Exact-project and artifact-hash preflight
> passed; M61 was applied once to `ahntbtktjjmvfosgkmgn` as remote version
> `20260913111342`. Readback proves the new private schema, RLS, service-only
> delegate, triggers, and zero new-data effects. Owner Edge v12 is ACTIVE with
> JWT verification and hash
> `ad75a08f3624f543f904cf2bf6833bcca132dfc1727e5868d52022365aacea14`;
> the deployed M61 contract file matches local source. The bounded local
> correction now closes review findings F-01/F-02/F-05/F-06: Google Books volume
> evidence is decoded; series-bearing records fail closed for fallback; M62
> projects provenance through standalone detail and save; and the full local
> migration/gateway path is exercised. M62 was applied once as remote version
> `20260913162154`; post-apply readback confirms the private helper ACL,
> authenticated Owner projection, and zero sidecar/inventory representative-cover
> rows. M52–M61 remain unchanged. Fresh verification passed TypeScript, worker
> build, affected Jest 310/310, structural 14/14, M55 7/7, M52–M62 integration
> 2/2, migration contract 4/4, deployment-runtime validation, and continuity
> validation. Those focused runs did not emit `act(...)`, open-handle, or
> force-exit warnings; the later full-run closeout recorded existing React
> `act(...)`, NetInfo dynamic-import, and Expo/Node `DEP0040` warnings, while
> the independent handle run exited normally. No external or Git publication
> action occurred.
> [Evidence](./supporting/unit6h-representative-cover-correction.md).
> Next authorized action: with explicit rollout authorization, deploy the
> matching tolerant Owner Edge, metadata-worker, and client runtime, then run
> connected no-cover review/Add proof.

> **2026-09-12 Unit 6H bounded correction closeout:** Exact-project source
> readback proved `phase9-owner-ingestion` v10 used the pre-`selectionId` batch
> decoder. Commit `6d05370` safely maps batch-response contract failures to
> `P9_INTERNAL_ERROR` and closes the `VirtualizedList`/mounted-query test cleanup
> defects. Seven focused suites/233 tests pass with `--detectOpenHandles` and no
> earlier warning; TypeScript and deployment-runtime validation pass. Only the
> Owner Edge function was deployed to `ahntbtktjjmvfosgkmgn`: v11 is ACTIVE,
> JWT verification remains enabled, and the deployed hash is
> `0af2f2ebde6019d5f10923141b279ae3a78a5ca0f5eeac6630b990030caddf55`.
> The same authenticated session now renders both review cards. M60, Render,
> database/Storage, dispatch, inventory, and existing data were not changed.
> Next action: complete the remaining connected Unit 6H regression matrix under
> connected-test authorization.

> **Historical pre-correction 2026-09-12 connected Unit 6H diagnostic:** The authorized development
> browser run used `6testimage.jpeg` in session
> `f7573651-d155-4dd3-b62b-8e2751db54e4`. Duplicate confirmation appeared;
> Proceed produced a fresh analysis result with one processed image, two
> candidates (`Individuals` / `P. F. Strawson` and `Thinking, Fast and Slow` /
> `Daniel Kahneman`), zero failed images, and zero committed inventory. The
> UI's batch-review fallback reproduced after manual Retry. A read-only
> authenticated check returned: `read_scan_session_v3` HTTP 200; Edge
> `read_scan_batch_review` HTTP 400 `P9_REQUEST_INVALID`; direct PostgREST
> `phase9_owner_batch_review_v1` HTTP 200 with two cards, each carrying the
> live `metadataSummary.selectionId`. The checked-in Edge response contract
> accepts that optional field. The route/RPC split proves a deployment-drift
> blocker in the Owner batch-review read path; the recorded active Edge v9
> bundle and commit `404aee0` provide the leading explanation, but exact
> deployed source/version readback is still pending. It is not a Gemini/Books
> API rejection. The secondary observability defect is
> that `OwnerBatchReviewContractError` is not recognized by the generic Edge
> error mapper and is therefore surfaced as `P9_REQUEST_INVALID`. Browser
> console inspection added no error-level evidence. No production code, test,
> migration SQL, deployment, dispatch, or M60 action changed; the live run
> created only authorized development test-session/upload/job state, deleted
> no existing data, and added no inventory. Read-only database readback
> confirmed the new input owns exactly one resolved `vision_extract` job and
> both candidates. The served Expo bundle and endpoint use the target project;
> only the parent PowerShell environment has a foreign Supabase URL/key, which
> did not drive this browser run. **Next exact action:** obtain rollout
> authorization for deployed Owner-Edge source/version readback or a matching
> `phase9-owner-ingestion` redeployment, then repeat the same Edge,
> RPC, retry, and UI proof. M60 was applied before this diagnostic under the
> preceding rollout authorization; no M60 migration action was taken here.
> The older PostgreSQL-only checkpoint below is retained as historical
> pre-connected evidence.

> **Historical local PostgreSQL verification checkpoint (superseded by the connected closeout above) (2026-09-12; supersedes the prior correction-only gate):** F-01 remains retracted; F-02 and F-03 remain corrected locally. Focused Jest passed 4 suites/181 tests, including the 3 lifecycle tests, and the in-memory PGlite fixture passed 5/5. The Owner-authorized disposable PostgreSQL 18.4 harness then ran at `127.0.0.1:55461` with data directory `C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-unit6h-verify-20260912` and PID-scoped database `bookconnect_u8b_22652`. It applied the disposable baseline and M01–M60, passed `UNIT6H_DUPLICATE_CONFIRMATION_REAL_POSTGRES_CONCURRENCY_PASS` using independent connections, and passed the existing `U8B_REAL_POSTGRES_ACCEPTANCE_PASS` regression. Teardown was verified: the database/cluster directory is absent, the port has no listener, and no matching postgres process remains. M52–M59 are unchanged; M60 remains local and was not remotely applied. No remote database/Storage or application data was touched; no deployment, dispatch change, development-data deletion, staging, commit, or push occurred. Connected Edge/Storage verification remains unrun. Prior screen act/open-handle warnings remain historical unresolved evidence and did not affect these database checks. Next: review this local PostgreSQL proof and separately authorize connected Edge/Storage verification. No product behavior or inventory duplicate policy changed.


**Planning status:** `unit6h_representative_cover_correction_approved` (historical Unit 6H planning decision)
**Implementation status:** `unit6g_post_scan_local_corrections_complete_pending_owner_review`
**Unit 6 closure scope:** automatic/functional pipeline PASS; native Unit 6F validation debt deferred `NOT_RUN`/`UNRESOLVED`, not PASS
**Last updated:** 2026-09-28
**Current milestone:** Unit 6G post-scan local corrections and Store View Publish confirmation were pushed with two known deviations deferred. A–C and the final buffered-edit Add guard are locally implemented; current local verification passed 10 affected Jest suites/158 tests, TypeScript, continuity, and diff hygiene. The latest recorded connected session readback remains 2026-09-22 (two private commits, three candidates in review). No current connected state is asserted.
**Active work unit:** `Unit 6G — Git publication complete; price-intent and cover-source deviations await Owner decision`
**Prior local-only overlay:** Unit 6H changes future duplicate inputs from terminal rejection to an Owner-confirmed warning. Local branch `codex/phase9-duplicate-confirmation` added forward M60, direct Edge/client contract changes, cleanup/dispatch protection, and tests. M60 was subsequently applied before this diagnostic under prior authorization; no migration action was taken in this diagnostic. See [Unit 6H](./work-units/06h-duplicate-input-confirmation.md).
**Environment (last recorded verification, 2026-09-14; reverify before operational use):** Development application with a shared remote Supabase development project; this is not a production deployment and has no external production app consumers. The exact project recorded then is **`Bookconnect_reactexpo`** (project ref **`ahntbtktjjmvfosgkmgn`**, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.063`, `ap-southeast-2`). No current project health was checked in this handoff. In this tracker, “live” means readback against that development project. “Legacy consumer” means a stale repository-internal screen/service path, not a deployed customer application that must remain backward-compatible.
**Auth prerequisite status:** `auth_hardening_core_wu1_wu2_locally_complete`
**Migration-status qualification:** Migration versions and “live once” wording below are historical rollout/readback records. No database or migration state was queried in this handoff; reverify before operational use.
**Prior implementation verification summary (historical test evidence):** The full-Jest correction passes the reporter's exact 5-suite/48-test reproduction, image-inventory 61 suites/494 tests with one suite/four tests skipped, and the complete 304-suite/2,483-test run with only the same skips; Jest exits normally. A separate `--detectOpenHandles --silent` run has the same totals with no persistent handle/force-exit/one-second non-exit warning. TypeScript and diff hygiene passed in that implementation work. The bounded M62/runtime correction evidence remains unchanged: affected Jest 310/310, worker build, structural metadata 14/14, M55 7/7, and full M52–M62 PGlite 2/2. The normal full run still emits existing React `act(...)` and NetInfo warnings plus Node `DEP0040`; these remain unresolved test/tooling hygiene warnings, not product-test failures.
**Next authorized action:** Obtain an Owner decision on the recorded price-intent and cover-source deviations before deployment or connected proof. Any connected proof requires fresh read-only session-state verification and separate authorization; database, Storage, and deployment mutations remain unauthorized.
**Migration note:** M29 is live once as `20260730162700 marketplace_phase9_owner_safe_contracts`; M30 is live exactly once as `20260801093048 marketplace_phase9_unit6e_review_corrections`; M31-M51 remain live at their recorded versions; **M52 remains live exactly once as `20260822025712 marketplace_phase9_unit6g_contract_persistence_foundation` and byte-immutable**. M53 is live exactly once as `20260828081324 marketplace_phase9_unit6g_field_authority_correction`; M54 as `20260829142337 marketplace_phase9_unit6g_session_lifecycle_fence`; M55 as `20260830084323 marketplace_phase9_unit6g_metadata_add_authority_correction`; M56 as `20260830175651 marketplace_phase9_metadata_throughput`; M57 as `20260908073203 marketplace_phase9_media_output_intents`; M58 as `20260908073308 marketplace_phase9_media_completion_receipts`; M59 as `20260908073425 marketplace_phase9_media_output_cleanup`; M60 as `20260912072815 marketplace_phase9_duplicate_confirmation`; M61 as `20260913111342 marketplace_phase9_representative_edition_cover`; and M62 as `20260913162154 marketplace_phase9_representative_cover_detail_projection`.
**Scope boundary:** Unit 6H review covers the duplicate warning, new-upload Proceed/Cancel semantics, exact private-object verification, completion replay, cleanup/dispatch fencing, UI confirmation lifecycle, and disposable independent-connection PostgreSQL behavior. M52–M59 behavior remains unchanged; connected rollout and live Edge/Storage proof are not established. Unit 8 remains complete.
**Implementation authority:** Unit 6H local implementation, bounded correction, disposable PostgreSQL verification, exact Edge reconciliation, and duplicate-Proceed review handoff are complete for this checkpoint. F-01 is retracted; F-02 and F-03 are corrected. The Unit 6H work unit is the detailed authority; M52–M59 remain immutable live evidence. Further data/Storage, dispatch, or job mutation requires connected-test authorization. Native Unit 6F validation remains deferred and unrelated.
**Migration creation/application authority:** Prior records document M61 and M62 application and verification; M52–M62 migration history was not re-read in this handoff. No historical migration was edited or replayed. Further schema, data, Storage, dispatch, or job mutation requires separate authorization.
**Migration-history prerequisite:** the canonical mapping and independent divergence review remain preserved as evidence in [migration-canonical-reconciliation-2026-08-21.md](./supporting/migration-canonical-reconciliation-2026-08-21.md); no ledger repair was required.
**Current gate:** Git publication completed with two recorded deviations. The latest recorded connected session readback is 2026-09-22; current session, migration, Edge, and worker state were not checked. Any new connected proof starts with a fresh read-only state check; mutations require separate authorization.

## 2026-09-12 — Unit 6H bounded correction and documentation closeout

- F-01 `[RETRACTED]` — M58's nested completion function already catches the legacy trigger constraint identity and returns the duplicate receipt; M60 translates that receipt to `confirmation_required`. The strengthened fixture proves the job resolves at attempt 1 and exact completion replay returns the same outcome, so the reported trigger/wrapper mismatch is not a defect.
- F-02 `[CORRECTED LOCALLY]` — M60 now defines two postgres-owned, empty-search-path, `SECURITY INVOKER` public delegates for the Edge-facing RPC names. `PUBLIC`, `anon`, and `authenticated` retain no execute authority; only `service_role` is granted. The private functions and tables remain private.
- F-03 `[CORRECTED LOCALLY]` — duplicate Proceed/Cancel now uses a local session/controller lifecycle fence, aborts on rerender or unmount, validates the response session, and suppresses stale invalidation. The focused lifecycle suite covers session change, unmount, and mismatched response session.
- Verification actually run after correction: focused Jest **4 suites / 181 tests passed**, including the three duplicate-resolution lifecycle tests; local Node fixture **5/5 subtests passed**; TypeScript validation passed; `git diff --check` was clean.
- Follow-up provider-boundary correction: malformed, non-string, or overlong optional Gemini `isbn_clue` values now degrade to `null` instead of invalidating the complete vision response. Title/author extraction remains available for the metadata lookup path; valid labelled ISBNs remain normalized. Gemini/analyzer Jest passed **2 suites / 48 tests**, metadata identity/gateway/Google Books adapter/worker Jest passed **4 suites / 49 tests**, TypeScript validation passed, and `git diff --check` passed.
- Warning investigation: the `VirtualizedList` `act(...)` warning reproduced in the screen suite and points to the existing React Native `FlatList` timer path; the new dialog suite did not emit it. `--detectOpenHandles` and `--forceExit` runs did not complete, so the warning is classified as likely test cleanup/timer hygiene, not a confirmed production defect, with handle identity unproven.
- Subsequent authorized PostgreSQL verification used local PostgreSQL 18.4 at `127.0.0.1:55461`, data directory `C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-unit6h-verify-20260912`, and PID-scoped database `bookconnect_u8b_22652`. The baseline and M01–M60 applied successfully. Independent `psql` connections proved one canonical completion winner, one pending duplicate loser, canonical-only uniqueness, concurrent Proceed/cleanup/replay fencing, exact replay, one new vision job, and one new-session media asset. `UNIT6H_DUPLICATE_CONFIRMATION_REAL_POSTGRES_CONCURRENCY_PASS` and the existing `U8B_REAL_POSTGRES_ACCEPTANCE_PASS` both passed.
- Teardown verification found the data directory absent, port 55461 without a listener, and zero matching postgres processes. No remote service, database, Storage, application data, dispatch, deployment, or development data was mutated.
- Follow-up gate: review the disposable PostgreSQL proof and separately authorize connected Edge/Storage verification before considering M60 rollout.

## 2026-09-12 — Optional-ISBN correction deployment

- The reviewed correction commit `428a8c17362d7a2c478c83b328ca8237b78bc79f`
  was pushed to `codex/phase9-duplicate-confirmation` and deployed only to the
  existing Render `phase9-fixture-vision` service
  (`srv-d9jbsjf41pts73cejqag`) as `dep-daih7ioae00c73egmcug`. Render reported
  `live`; `/health` and `/ready` returned 200 (`alive`/`ready`), and an
  unauthenticated `/run` returned 403 without claiming a job. The former live
  worker deployment `af90ef5` was deactivated.
- This deployment contains the provider-boundary correction only: malformed,
  non-string, or overlong optional Gemini ISBN clues degrade to `null`; title,
  author, language, and the existing metadata query identity are preserved.
  No Edge/client deployment, M60 application, migration, dispatch change,
  database/Storage mutation, or application-data mutation occurred.
- Full authenticated image → Gemini → metadata/Books API verification remains
  unrun because no approved Owner session or worker ingress token is available
  in this environment. Exact next action: use the approved Owner session to run
  one fresh connected image test and read back the candidate and metadata job;
  no additional code or migration change is currently indicated.

## 2026-09-08 — runtime deployment and connected completion proof

- Commit `ffdb1fc85af625bc98dcfc3af93d5530278144a9` was pushed to
  `origin/main`. No migration application occurred in this checkpoint; M57–M59
  remained at their verified live versions.
- Render service `phase9-media-sanitation`
  (`srv-d9jbmgf41pts73cecfl0`) deployed that exact commit as
  `dep-dafv4ogn74is73bq9lkg` and reported `live`. The Docker build completed
  `npm run build:phase9:media-worker`; operational logs emitted
  `service_started`; read-only HTTP checks returned `/health=200 {"status":"alive"}`
  and `/ready=200 {"status":"ready"}`.
- The requested `testimage.jpeg` upload created session
  `22fc2d93-4c6f-4cb1-8694-bc801d62f77f`, input
  `078013d6-2a2d-4726-b3c1-8de4f442dae7`, and job
  `e04b0d78-72c2-49ed-8516-77e2dd9d88d3`. The worker resolved it at attempt
  `1/5` with a canonical receipt `duplicate_rejected` /
  `P9_MEDIA_DUPLICATE_INPUT`; read-only lineage showed the same source hash had
  already been used by an earlier input. The session was closed through the UI;
  no candidate or inventory effect occurred.
- A unique `10testimage.jpeg` upload created session
  `6e9d05b2-1c36-4e74-ac47-949753a04898`, input
  `fe81ddca-d616-4d49-94cf-1edcba117b8b`, media job
  `be2a9a74-6963-4a78-bf02-0d70813ba310`, and vision job
  `0b13c16c-abe0-427d-886a-36f104cc034d`. Both jobs resolved at attempt `1/5`;
  the input is `ready`, 10 candidates were produced, and the linked sanitized
  asset is an `image/webp` 1600x1600 object with 135,044 bytes,
  `phase9-media-v1`, `magick-wasm-0.0.41-webp`, and
  `magick-wasm-0.0.41-strip` markers. The session was closed with zero
  committed inventory rows; its 10 candidates remain read-only history.
- Verification: focused worker/runtime Jest **6 suites / 62 tests**; related
  backend/Owner/UI Jest **5 suites / 219 tests**; worker build PASS; broad
  disposable Phase 9 database run **429/433** with all M57–M59 cases passing
  and four unrelated stale metadata-foundation/structural-artifact failures.
- External effects: authorized Git push, Render deployment, two connected test
  sessions and their uploads, and UI session closures. No live migration,
  manual queue retry, historical dead-letter mutation, inventory commit, or
  provider call occurred.

## 2026-09-08 — connected Owner close/upload proof

- Through the authenticated Owner web flow, the pre-existing active session was
  closed after the app's confirmation step. The final readback was `status=closed`;
  five committed inventory items were unchanged and six uncommitted candidates
  remained read-only session records.
- A fresh scan setup then created/reused one active test session. Chrome's file
  chooser rejected the fixture with `Not allowed` before the app received a file;
  the in-app browser accepted the repository PNG fixture (`image/png`, 22,380
  bytes) and the app visibly advanced through preview and `Registering image` to
  the live scan-session screen.
- Exact-project readback for test session
  `222ab8b1-bcd0-4145-aee1-a1abdc5b2c0b` shows one input in `failed` with
  `validation_error_code=P9_MEDIA_PROCESSING_RETRYABLE`, zero candidates, and
  zero committed inventory rows. Its
  `media_validate_sanitize` job reached `dead_letter` at attempt `5/5` with
  `last_safe_error_code=P9_MEDIA_PROCESSING_RETRYABLE` and
  `last_safe_error_category=media_validation`. The app summary shows one image
  failed and zero images processed.
- Result: upload authorization, Storage/input registration, queue insertion, and
  retry/dead-letter state are live-verified. Media worker completion is blocked
  by the deployed worker/runtime path and requires a separately authorized
  worker deployment/scheduling correction before a new connected proof. No
  manual job claim, retry, data deletion, migration, deployment, commit, push,
  or PR action was performed; the local Expo server was stopped after capture.

## 2026-09-08 — M57–M59 live application and readback

- Reverified exact project `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn` as `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.063`, region
  `ap-southeast-2`, with M56 as the live tail immediately before application.
- Applied the three separate migrations in order: M57
  `20260908073203 marketplace_phase9_media_output_intents`, M58
  `20260908073308 marketplace_phase9_media_completion_receipts`, and M59
  `20260908073425 marketplace_phase9_media_output_cleanup`.
- Post-apply readback confirms both private tables exist, are empty, have RLS
  enabled, and expose owner-only ACLs. M57's indexes, functions, and all three
  fence triggers exist. M58's four guarded functions are service-role-only and
  the four renamed legacy functions have no API-role execution. M59's cleanup
  functions are service-role-only and its dispatcher helper includes cleanup
  intent work.
- Behavioral definition markers confirm prepared intents, canonical receipts,
  exact duplicate rejection, `FOR UPDATE SKIP LOCKED`, bounded manual
  reconciliation, and dispatcher wiring. The service-role health call returned
  `due_count=0`, `oldest_due_seconds=0`, and `manual_reconciliation=0`; the
  media queue remained idle.
- Post-DDL advisors report informational no-policy notices for the two
  owner-only/RLS-enabled private tables and informational unindexed `store_id`
  foreign keys. These do not expose API access or block correctness; they are
  retained as future performance/hardening review items.
- External effects were limited to the authorized schema/function/trigger
  migrations and migration-history records. No business row, Storage object,
  job, deployment, provider call, stage, commit, push, merge, or PR changed.

## Pre-application 2026-09-08 — Unit 6G correction integrated on current origin/main

- Created an isolated worktree from verified `origin/main` commit
  `573182267ddd79e08b0abfb348b5afd9fb0dc571`. The old dirty worktree was left
  untouched. M52–M56 were present in the baseline; no migration restoration or
  duplication was performed.
- Read-only exact-project history confirms M52–M56 are live once, ending with
  M56 live version `20260830175651`. M57–M59 are absent live and remain local.
- Transferred only the bounded Unit 6G correction. Upstream runtime changes were
  integrated manually in `httpService.ts` and the current post-scan input-list
  component rather than overwriting newer `origin/main` behavior.
- Local verification: focused Jest **10 suites / 262 tests**, focused PGlite
  **21/21**, worker TypeScript PASS, and disposable real PostgreSQL M01–M59 plus
  U8B/concurrency markers PASS. The broad Phase 9 database invocation completed
  **429/433**: all M57–M59 tests passed; three failures are confined to stale
  metadata-foundation fixtures, and one structural-metadata-worker test lacked
  its prerequisite `.phase9-dist` build artifact.
- External effects: none. No migration application, deployment, Storage/job or
  business-data mutation, provider call, stage, commit, push, merge, or PR action.
- Independent review: PASS for local review with no actionable findings. The
  reviewer inspected the complete runtime/SQL/test/documentation diff but could
  not start an additional Jest run because the Windows sandbox returned
  `EPERM`; no extra test pass is claimed. Residual operational gates are M57–M59
  exact-project application/readback, matching service/client deployment,
  cleanup scheduling/alerts and recurring recheck proof, and fresh connected
  scan/public-copy replay, duplicate, and cleanup proof.

## 2026-09-08 — ordered M57–M59 application preflight (read-only)

- Exact project reverified healthy: `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn`, ref `ahntbtktjjmvfosgkmgn`, region
  `ap-southeast-2`, PostgreSQL `17.6.1.063`.
- Live migration history ends at M56 `20260830175651
  marketplace_phase9_metadata_throughput`; M57–M59 are absent. M57 tables,
  indexes, functions, and triggers plus M59 new cleanup/health functions are
  absent. M58's current completion/snapshot functions and M59's
  `has_claimable_phase9_work(text)` are present as intended replacement
  targets; all four M58 `_legacy` destination names are absent.
- The required context function, `marketplace_sec`/`extensions` schemas,
  `pgcrypto`, and `extensions.digest(bytea,text)` are present. There is no
  active or claimable media job: `cancelled=16`, `dead_letter=5`, and
  `resolved=29`.
- Base media tables have RLS enabled with service-role-only ACLs. The separate
  empty `marketplace_sec.phase9_worker_wake_dispatches` table remains an
  owner-only/RLS-disabled advisory and was not changed.
- Local M57/M58/M59 hashes, `git diff --check`, and focused correction suites
  21/21 are recorded in the current-vs-target audit. No migration, data,
  Storage, worker, deployment, or other external mutation occurred. Result:
  **preflight PASS; application remains gated on explicit owner authorization
  and must run M57, then M58, then M59 in order**.

## Historical 2026-08-30 — bounded metadata-throughput implementation (then local/unapplied)

- Read-only baseline reverified `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn`: the scheduler wakes approximately once per minute;
  the live dispatcher sends metadata `batchSize=1`; the metadata claim function
  permits at most 10 and grants a five-minute lease; one worker instance and
  one HTTP invocation run at a time; jobs were processed serially. The queue
  had zero actionable metadata jobs and one historical dead letter. Thirty-day
  evidence showed 103 metadata jobs, 102 resolved, one dead letter, and 46
  successful metadata dispatches at batch size one. Observed provider latency
  ranged approximately 0.8–6.7 seconds. The exact deployed provider timeout and
  provider quota were not available through the read-only surfaces.
- The metadata-only HTTP contract accepts a run budget from 1 through 15;
  generic worker contracts retain their existing maximum 10. The worker keeps
  at most three active jobs, initially claims only enough to fill those slots,
  and claims one replacement as each slot frees. It therefore never leases all
  15 up front. Already-claimed jobs drain before a later claim error is exposed.
- Every job retains independent Google Books egress, fencing, finalization,
  retry/dead-letter handling, and failure isolation. Result entries are stored
  in claim order despite out-of-order completion. A durable
  `retry_scheduled` completion is now reported as such; database state remains
  authoritative.
- At that checkpoint, forward M56 replaced only the private wake-dispatcher
  definition. The 2026-09-08 read-only history above supersedes its then-unapplied
  status. It sends
  `batchSize=15` for `metadata_enrich`, preserves `batchSize=1` for media,
  vision, and publication retry, preserves the 120-second timeout and existing
  one-wake-per-stage/tick fence, and does not replace a claim function or
  mutate queue rows. Applied migrations M36, M40, and M55 were not edited.
- RED evidence covered the absent M56, metadata contract bound, telemetry
  truncation, serial processing, durable retry reporting, and in-flight drain
 behavior. Green evidence currently includes focused Jest **7 suites / 72 tests**
  (including the metadata-only invoker bound), metadata worker production
  TypeScript build, M56 structural Jest **3/3** (included in the focused total),
  and dispatcher PGlite **30/30**.
- Rollout remains gated: deploy the worker first while live dispatch stays at
  one, canary the changed title/author-first request path and three-slot pool,
  and verify a Google Books timeout no greater than 10 seconds plus quota,
  latency, memory, database connections, retry/dead-letter, and duplicate-call
  signals. Only after that evidence may M56 application be separately reviewed.
  No migration, deployment, provider call, business-data/Storage mutation,
  staging, commit, push, merge, or PR action occurred in this implementation.

## 2026-08-30 — bounded post-scan Add-all state correction (local)

- Scope is limited to the mounted Unit 6G post-scan commit presentation. The
  parent now receives each card's authority-conflict state, while Add-all also
  filters in-flight candidates and candidates with a non-busy prior outcome.
  A stale `no_longer_eligible` result therefore cannot keep advertising that
  candidate in the Add-all count. Card status also reflects committed and
  non-busy Add outcomes, and `needs_attention` bulk retries are marked busy
  for their full retry lifetime.
- No backend/RPC, migration, metadata provider, session lifecycle, inventory
  data, Storage, deployment, or browser mutation was performed. Existing
  working-tree changes were preserved; nothing was staged, committed, pushed,
  or merged.
- Verification: the affected Unit 6G client regression run passed **6 suites /
  76 tests** with `--forceExit`; TypeScript `--noEmit` passed; Phase 9
  continuity passed; and `git diff --check` passed. The Jest run retains the
  pre-existing React Native `VirtualizedList` `act(...)` console warnings.
- Exact next action remains independent review/Owner review followed by the
  separate matching client deployment gate; no migration application is
  authorized by this correction.

## 2026-08-30 — bounded metadata/Add authority correction (M55 applied)

- Scope is limited to the selected metadata snapshot UUID in compact Add
  preparation; an author is required only at the final Add/commit boundary
  while empty-author review saves remain valid; durable metadata query identity
  is bibliographic whenever title or author evidence exists, with ISBN-only
  lookup retained for ISBN-only input; the Google request no longer hard-filters
  language; and batch cards advertise Add only when the full commit-eligibility
  helper passes.
- Local forward migration
  `20260830000055_marketplace_phase9_unit6g_metadata_add_authority_correction.sql`
  replaces only internal summary/blocker/batch-card function definitions. It
  performs no DML/backfill and changes no table, policy, Storage object, or
  public RPC signature; touched internal helper ACLs remain restricted and no
  public grant is added. It was applied exactly once
  through Supabase MCP as `20260830084323` directly after M54; no business-row
  DML/backfill occurred.
- Green evidence: affected-scope Jest **64 passed suites / 690 passed tests**
  with one skipped suite/four skipped tests, M54+M55 PGlite **7/7**, and
  read-only post-apply definition verification passed. TypeScript, continuity,
  and `git diff --check` are the remaining session-close gates.
- This correction does not redesign Add all, change the local canonical
  resolver's evidence model, deploy client/Edge code, or address close audit
  and older sibling RPC compatibility.

## 2026-08-30 — direct Add, strict auto-close, and partial-close semantics

- The existing per-card Add coordinator remains the sole individual submit
  path: strict Save, canonical reread, readiness/action check, and one M39
  private inventory commit. No separate card Submit or automatic inventory
  commit was introduced.
- The mounted session route now invokes the same version-fenced v3 Close only
  after authoritative state proves `committed = detected > 0`, all inputs are
  terminal, no processing/review/removed/false-detection remainder exists, no
  cards remain visible, commands are idle, and the route is online/focused.
- Manual partial Close remains Owner-controlled. The summary warns that already
  added inventory stays unchanged and remaining candidates become read-only;
  Close neither adds the remainder nor deletes successful inventory.
- The input announcement is explicitly image-scoped and candidate review copy
  explains its independent book scope. Consequently `0` image inputs needing
  attention and `15` books needing review are no longer presented as the same
  metric.
- RED-first mounted/policy/summary/count tests failed before implementation.
  Green evidence currently includes full Image Inventory Jest **59 suites / 478
  tests**, TypeScript, and focused field-preservation/lifecycle PGlite **17/17**.
- Existing M39 replay/concurrency tests prove one candidate produces one
  inventory identity under exact or overlapping retry. The strengthened Unit
  7A integration assertion pins condition, selling price, quantity, location,
  damage, publication intent, and private publication after Add.
- Read-only live preflight reverified project `ahntbtktjjmvfosgkmgn`, M54 as the
  live migration tail, Edge v9 active, and one active session with 12
  needs-review candidates and zero committed rows.
- Connected browser proof then selected detected identity for Book 1, exposed
  exactly one enabled individual Add button, and pressed it once. Canonical
  idempotency response returned inventory ID
  `332ad909-47dc-4256-963a-3878c3081337`; candidate
  `d6a18694-a004-437f-95e8-352b64f579e1` is `committed_private` and has exactly
  one inventory row. Readback preserves title/author/language, condition
  `good`, ₹175 (`17500` minor), quantity `1/1/0/0/0`, location `2`, no damage,
  sellable true, publication decision `publish`, and private/draft inventory.
  One audit and one event carry the same actor/command/candidate/inventory
  identity. Reload retained Added `1`, Need review `11`, and removed Book 1.
- The session remains `active`, `closed_at` null, committed count `1`, detected
  `12`, and uncommitted `11`, proving the new policy does not close a partial
  session. Positive strict all-committed Close is covered by mounted/policy
  tests without mutating the other eleven books.
- Close actor/source observability and lifecycle fences on manual-candidate,
  skip/false-detection, and variant decision/replacement RPCs require a forward
  migration. That migration has not been created or applied because separate
  migration authority is pending.
- Remote deployment result: Edge v9 already contains the five Unit 6G actions,
  and no changed file in this pass belongs to its deployed 30-file bundle, so a
  no-op Edge version bump was not performed. Production web export passes, but
  `app.json` has no EAS project ID/owner/updates URL and the repository has no
  Sites/other web-hosting target; therefore remote client deployment is blocked
  on release-target configuration rather than code.
- External/Git state: exactly one authorized inventory business effect plus its
  candidate/idempotency/audit/event/session-count records; no Storage,
  migration, remote deployment, staging, commit, push, merge, or PR action.

## 2026-08-30 — local Google Books and metadata-sheet quality correction

- Google Books egress now prefers normalized title plus first author whenever
  bibliographic evidence exists; validated ISBN remains only an ISBN-query
  fallback when title/author terms are absent.
- The deterministic ranker requires exact normalized title and author overlap
  before a provider volume is eligible. ISBN, compatible base language, and
  edition clues are secondary tie-break evidence and cannot override a
  title/author conflict. Whole-volume coherence and ambiguity fail-closed
  behavior remain intact.
- Safe cover decoding now considers `extraLarge`, `large`, `medium`, `small`,
  `thumbnail`, and `smallThumbnail` in descending order, retaining the first
  valid allowlisted Google Books HTTPS URL and falling through unsafe/malformed
  larger values.
- The metadata sheet now renders selected cover, subtitle, bounded plain-text
  description, categories/genre, and explicit state labels such as `Provider
  metadata selected` and `Multiple possible matches`. No cover toggle,
  scan-image fallback, rematch action, or new mutation authority was added.
- RED evidence reproduced all four old behaviors. Focused Jest then passed
  **3 suites / 74 tests**; wider metadata regression passed **10 suites / 133
  tests**; affected Unit 6G UI regression passed **6 suites / 82 tests** with
  its pre-existing VirtualizedList `act(...)` warnings and `--forceExit`;
  TypeScript `--noEmit`, `git diff --check`, and Phase 9 continuity passed.
- No provider call, Supabase/database/Storage mutation, migration, credential
  change, deployment, fresh scan/upload, inventory action, staging, commit,
  push, merge, or PR action occurred.

## 2026-08-29 — M54 session-lifecycle fence live verification

- RED evidence reproduced BE-01/BE-02: without M54, closing/closed/expired
  candidates still accepted current Save/Add/Remove calls or advertised mutation
  actions. The active-session control remained valid.
- M54 adds one shared active-and-unexpired session predicate, one Owner/session
  row-lock guard, and one read-only detail sanitizer. Completed exact replay is
  reconciled before the lifecycle fence; new effects require the locked session
  to remain active and unexpired. Save replay is sanitized when the session is
  no longer mutable; Add/Remove exact replay remains canonical.
- Local verification: focused lifecycle PGlite **4/4**, focused structural Jest
  **7/7**, sequential Unit 6G foundation + lifecycle + Unit 7A PGlite **42/42**,
  and related migration/Edge contract Jest **6 suites / 233 tests**.
- Exact-project preflight reverified `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn` healthy with M53 as the tail. Supabase MCP applied M54
  once as `20260829142337`. Function/owner/search-path/grant readback passed.
- Connected proof used an existing closed candidate under transaction-local
  Owner claims. Detail actions were `view_readiness`; batch actions were
  `view_metadata, view_readiness`; Save/Add/Remove each returned
  `P9_STATE_CONFLICT`; candidate, session count, inventory, audit, event, and
  idempotency state were unchanged.
- Read-only browser verification on the Unit 6G worktree loaded the same closed
  15-candidate session. The summary showed `Session state: closed`; candidate
  detail showed `This candidate is read-only` with `Save review` disabled, and
  `Add missed book` was disabled. No browser console errors occurred. The
  visible text fields remain present for inspection but no mutation control is
  enabled; this is a client UX residual, not a backend authorization failure.
- No Edge/client/native deployment, fresh scan/upload, Storage operation,
  provider operation, stage, push, merge, or PR action occurred. Older
  sibling correction/variant RPC lifecycle compatibility was intentionally not
  changed and remains a separate product decision.

## 2026-08-29 — local post-scan review UI and read-only browser verification

- Implemented the composition-only post-scan review surface in the recomposition
  worktree: a distinct session header/summary, lifetime-versus-active review
  counts, source-aware compact cards, compact edit sections, the existing full
  correction route, and sticky Add/commit controls. Provider-matched and
  vision-detected values now have separate visible source labels. The 15-book
  current-image cap and existing mutation/lifecycle boundaries are unchanged.
- Editable placement is recorded in the Unit 6G SDD: pre-scan owns batch label,
  location, language hint, optional condition/price, and publication intent;
  compact cards own title/authors, language, condition, price, quantity,
  location, publication, and damage; full correction retains script, metadata
  choice, confirmations, notes, and deeper correction actions. Quantity remains
  fixed at `1` before scan; no batch quantity/apply-to-all prompt was added.
- Verification: targeted image-inventory Jest **6 suites / 69 tests passed**;
  TypeScript `--noEmit` passed. The authenticated local browser rendered the
  existing closed session, opened/closed metadata, confirmed Edit/Remove/Add
  missed controls were disabled, and reported no browser console errors. No
  fresh scan or image upload was started.
- Observed residuals: the image row reported `0 need attention` while the
  candidate summary/cards reported `15 need review`; the metadata sheet still
  uses generic `Status: Matched`. These are recorded for the next UI/data-copy
  decision and were not changed in this checkpoint.
- No review save, Add, Remove, Close, provider call, Supabase/Storage/business
  data mutation, migration, deployment, staging, commit, push, merge, or PR
  action occurred.
- Exact next action: Owner review of this local UI diff and the recorded
  count/copy risks. Edge/client/native deployment and any fresh scan remain
  separately gated.

## 2026-08-29 — local pre-scan UI composition and browser verification

- Implemented a composition-only pre-scan UI checkpoint in the Unit 6G
  recomposition worktree: grouped Batch, Location, Book defaults, and
  Publication sections; A-Z/1-9 shelf-code selectors plus free-form location;
  searchable language hint; optional condition and selling-price defaults;
  quick/full/custom whole-rupee price entry; fixed quantity-one summary; and
  a sticky summary/action footer. Existing Start/capture handlers and server
  contracts are unchanged. Authority: Unit 6G SDD §§5–6 and §21,
  U6G-AC01–U6G-AC05.
- Verification: focused image-inventory Jest **3 suites / 33 tests passed**;
  `tsc --noEmit` and `git diff --check` passed. The authenticated local
  `/inventory/scan` browser check exercised selectors, manual location,
  language search, condition, custom price, publication intent, summary, and
  location-gated Start with no browser console errors.
- No scan or image upload was started. No review/close/inventory action
  occurred. Apart from the authorized local authentication flow, no Supabase
  database/Storage/business-data or provider operation, deployment, staging,
  commit, push, merge, or PR mutation occurred.
- Exact next action: Owner review of the local UI diff; live M53 review and the
  separately gated Edge/client/native deployment remain unchanged.

## 2026-08-28 — U6G-FA-001 M53 live application and browser proof

- The Owner explicitly authorized the bounded M53 application and connected
  verification after the local correction and independent review checkpoint.
- Exact-project preflight passed for `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn` (`ACTIVE_HEALTHY`, PostgreSQL `17.6.1.063`,
  `ap-southeast-2`); the live tail was M52 `20260822025712` and the required
  dependency signatures were present.
- Supabase MCP applied `marketplace_phase9_unit6g_field_authority_correction`
  exactly once. Readback records live version `20260828081324`, directly after
  M52. The migration only replaces internal projection functions and performs
  no DML, backfill, public RPC/signature, table, RLS, grant, Storage, or
  business-row change.
- Post-apply function readback passed: the field-source helper remains
  `SECURITY DEFINER` and contains review-disposition, review-version, valid-
  review, and valid-review-derived-source gates.
- The Codex in-app browser review URL rendered the scan page and 15 candidate
  cards. The former `Book review could not be loaded right now.` state and its
  retry control were absent; the page summary was `Ready: 0 · Processing: 0 ·
  Needs attention: 15 · Added: 0`. No review save, add, remove, or inventory
  action was clicked.
- Verification: narrowed M53 post-apply Jest 4/4; prior local correction
  contract/structure 53/53, PGlite 25/25, compact UI/draft 53/53, TypeScript,
  export, and continuity gates remain recorded. The M53 source is committed in
  `831649d`; this connected evidence is being committed separately.
- Exact next action: Owner review of this live proof. No Edge/client/native
  deployment or unrelated database/storage mutation is authorized.

## 2026-08-27 — U6G-FA-001 minimal selected-metadata correction

- The Owner authorized the smallest coherent correction after the bounded RED
  checkpoint: no candidate-detail/version expansion and no lifecycle or commit
  redesign.
- RED-first focused verification produced the expected 8 failures / 45 passes:
  six mirrored decoder failures and two M53 structure failures.
- M53 now projects each selected compact-summary member independently. Unsafe
  title, authors, language, or cover values become null without rewriting the
  canonical selected snapshot; the existing field-source helper then chooses
  matched, detected, default, or missing per field.
- Edge and mobile strict contracts accept only the new nullable summary members.
  Compact draft derivation treats null as absent and retains the existing
  source-governed fallback behavior.
- Verification: focused contracts/M53 structure 53/53; real PGlite projection
  25/25; compact draft/card/mounted-route assertions 53/53 (the Jest process was
  manually terminated after all passes because of its existing open handle);
  full image-inventory Jest 56 suites / 454 passed / 4 skipped; `tsc --noEmit`
  PASS; Phase 9 continuity validator PASS; `git diff --check` PASS.
- M52, M39, Unit 6 lifecycle, public RPC signatures, tables, grants, and
  business rows remain unchanged. M53 is unapplied. No Supabase/Storage,
  deployment, staging, commit, push, merge, or PR mutation occurred.
- Exact next action: independent review. Applying M53 or deploying Edge/client
  code requires separate Owner authorization.

## 2026-08-27 — U6G-FA-001 bounded correction stop

- The reviewed 17-file freeze was verified exactly before edits: base HEAD
  `d136de6`, aggregate `adb0067f...12ce`, nothing staged, and immutable M52 blob
  `49a3d9...69269`.
- Added focused SQL-projection RED cases for blank selected authors, unapproved
  cover, unsafe title, invalid language, valid selected metadata, field-level
  observed fallback, unrelated-field preservation, and no-lower-authority
  missing behavior. The real PGlite suite is 20 pass / 5 fail; every failure is
  false `matched`, while the valid control passes.
- Both real strict decoders reject all four complete malformed DTOs even when
  the affected source is changed to `detected`/`missing`: the owning rejection
  is the required all-valid `metadataSummary` object itself.
- Per the correction boundary, M53 and all production contracts/projections
  remain unchanged. No validator was weakened and no external/Git publication
  mutation occurred.
- Exact next action: obtain Owner approval for the smallest coherent contract/
  projection scope expansion; do not apply M53 or deploy.

## 2026-08-27 — bounded Unit 6G field-authority correction

- RED evidence reproduced false `custom` authority and blank identity for
  never-reviewed JSON-null review values, source/backing mismatches accepted by
  both decoders, missing local publication provenance, and malformed mounted
  payloads rendering as ordinary cards.
- Forward-only M53 replaces only
  `marketplace_sec.phase9_unit6g_field_sources`; it recognizes a saved review
  only when disposition/version/detail validity agree, preserves exact
  matched/detected/default/custom provenance, treats empty authors as missing,
  and performs no backfill or business-row write. M52 is unchanged.
- Mobile and Edge decoders now enforce source/value authority parity. The
  mounted route rejects malformed payloads into its existing recoverable
  contract-error/retry state. Unsafe-damage publication coercion is visibly
  marked as a local Custom override.
- Verification: focused Jest 6 suites/98 tests; corrected mobile contract 12/12;
  Unit 6G PGlite 19/19; full image-inventory Jest 56 suites/450 passed/4
  skipped; TypeScript and web export pass. Continuity/diff/freeze evidence is
  recorded at session close.
- External state: no Supabase/database/Storage/provider/deployment mutation;
  nothing staged, committed, pushed, merged, or deployed.
- Exact next action: independent review of this frozen bounded correction.
  Applying M53 or deploying any server/client bundle requires separate Owner
  authorization.

## 2026-08-26 — Unit 6G targeted F4 correction

- Authorized scope: targeted post-scan frozen-diff correction for the compact
  review publication-display mismatch only; no work-unit transition or
  migration/deployment scope was added.
- Correction: shared compact-review derivation now applies the existing
  unsafe/incomplete damage rule before deriving publication. When a damage
  answer is unsellable or not complete, readable, and safe, the visible card
  and the strict Add review both use `private`; safe damage retains the
  selected/default publication intent. Authority: Unit 6G matrix §3.1 and
  SDD §9.
- Regression: the mounted `BatchReviewCard` test drives Has damage, Cover,
  note entry, and unsellable copy, then asserts both visible `private` and the
  exact private review payload passed to Add.
- Verification: the new test failed before the source correction because
  `Publication: private` was absent; focused Unit 6G suites passed 40/40;
  full `src/features/imageInventory` passed 56 suites / 434 tests (4 skipped);
  TypeScript passed; web export passed; Phase 9 continuity passed; and
  `git diff --check` passed.
- External/Git state: no database, Storage, migration, provider, or deployment
  mutation occurred. Nothing was staged, committed, pushed, or merged.
- Current status and next authorized action are unchanged:
  `unit6g_d_implemented_pending_owner_6ge_authorization`; obtain separate
  Owner authorization for 6G-E Edge deployment, connected live verification,
  and native closure.

## 2026-08-24 — NEW Unit 6G-D implementation checkpoint

- NEW 6G-D (explicit private inventory-commit orchestration) implemented RED-first over retained M39/ownerUx seams: per-card Add gated by server allowedActions, Save->Add canonical sequencing, authority revalidation before each commit, exact-N frozen Add-all, maximum-3 bounded concurrency, one-command-slot arbitration across Save/Remove/Add/Add-all, partial-success reconciliation with no_longer_eligible cache reconciliation, scoped Store View/inventory invalidation.
- Dual-model review cycle: Codex gpt-5.6-sol high implemented; independent reviews by gpt-5.6-luna xhigh and ox-alpha high; correction rounds closed F01/F02/F04/F05 then NF-01; final verdict PASS with no new findings.
- Known deferred P3s: post-success sync misclassification (OX-F1), fire-and-forget rejection handling (OX-F2), module-size growth (N1), Save-response error-attribution precision (L-F03).
- No SQL/migration changes; M39 consumed unchanged; no publication; nothing pushed/deployed; 6G-E not begun.

## 2026-08-24 — Unit 6G predecessor-inheritance recomposition

- The Unit 6G design authority was recomposed on
  `codex/phase9-unit6g-recomposition` at clean baseline
  `714607fdbac827cd38ca2a145efbaf2b8b9f31ad`. The revised SDD, contract matrix,
  and [tracker 31](./trackers/31-unit6g-owner-batch-review-design-evidence.md)
  are the current single-image authority with the complete 40-row Unit 6
  predecessor ledger (`30/7/3/0/0`) and contiguous U6G-AC01..AC34; Unit 6 is the
  immutable lifecycle backbone and its over-limit behavior is unchanged.
- M52 remains live exactly once as `20260822025712` (retained 6G A/B
  foundation) and is not reopened. Historical commit `e7ed166`-style old 6G-C
  work and the frozen old 6G-D implementation are superseded evidence, not
  authority.
- NEW 6G-C is composition-only pre-commit client work and is next only after
  Owner checkpoint disposition of the recomposed authority (its independent
  final review is COMPLETE, verdict PASS_WITH_P3) plus separate explicit
  Owner authorization.
  NEW 6G-D later owns commit orchestration; 6G-E owns Edge deployment/live/
  native closure.
- Documentation-only pass: no product source, SQL/M52, database/Storage,
  deployment, provider, stage, commit, push, or merge action occurred.

## 2026-08-21 — Unit 6G Group 1 contract and persistence foundation

- Owner approval was received to continue on this existing branch/worktree and
  implement only Group 1.
- Red-first tests were added before implementation and failed for the absent
  contract modules and M52 migration; after implementation the focused contract
  suites pass 36/36, the expanded Jest regression passes 215/215, the new
  PGlite persistence suite passes 9/9, the expanded Phase 9 PGlite regression
  passes 54/54, and `npx.cmd tsc --noEmit` passes.
- Added strict versioned server/mobile contracts and Owner ingestion dispatch;
  added local migration candidate
  `20260821000052_marketplace_phase9_unit6g_contract_persistence_foundation.sql`.
  It makes condition nullable, adds bounded price/batch defaults, persists the
  irreversible `owner_removed_from_scan` disposition, adds v2-compatible/v3
  session helpers, bounded batch review/removal RPCs, event/audit registration,
  and narrow authenticated grants while preserving M39 and Unit 7C.
- The migration was not applied. No Supabase, Storage, business data, Edge,
  mobile deployment, provider, stage, commit, push, or PR mutation occurred.
- Exact next gate: independent review of the Group 1 diff and M52 candidate;
  application/deployment/Git publication and Groups 2–4 require separate
  authorization.

### Bounded independent-review correction

- Corrected only the four reported findings. The applied v2 Close definition is
  no longer replaced; nullable Unit 6G sessions fail closed through a separate
  v3 transaction marker plus session trigger.
- Removal already advanced `presentation_revision` through the existing
  candidate presentation trigger; the new regression proves exact pre/post
  advancement without adding a duplicate session update.
- Persisted field sources now compare each review value against selected,
  observed, and session-default authority independently. Start, Remove, and
  Close v3 reject null command IDs at the SQL boundary.
- Red-first evidence: the migration contract failed 2 tests and PGlite failed
  the presentation assertion, source derivation, and null-command checks before
  correction. Final focused Jest is 38/38; Unit 6G PGlite is 11/11.
- M52 remains unapplied. No database/Storage, deployment, provider, stage,
  commit, push, PR, UI, Groups 2–4, M39, or Unit 7C change occurred.
- Exact next gate: independent correction-only rereview.

## 2026-08-21 — Unit 6G SDD and contract-matrix draft

- Created the specialized Unit 6G SDD and exact pre-scan/post-scan/server/
  lifecycle matrix on isolated branch
  `codex/phase9-unit6g-owner-batch-review-commit-handoff`.
- Reconciled Units 6/7A/7C and current code/migrations. The draft requires a
  category 4 forward lifecycle change for `owner_removed_from_scan` plus the
  category 3 session price/batch-label fields; M39 and Unit 7C remain unchanged.
- Owner-review corrections now freeze `close_scan_session_v3` with bounded
  `ownerRemovedCandidates` and unchanged v2 Close; existing `manual`/null
  metadata choice for Use detected details; `matched|detected`→Detected source
  presentation; one candidate command slot with Busy skip/no queue; and strict
  bounded aggregate/observed/metadata/blocker/attention DTOs.
- Migration classification is explicit: nullable condition, resumable price/
  label, disposition lifecycle/count/audit/event/RPC/grants, and v3 Close need a
  future forward migration. INR, quantity 1, M39, `store_inventory`, Unit 7C,
  and Store View invalidation do not.
- Product source, tests, migration files, database/Storage, provider, business
  data, deployments, commits, pushes, and external services were not changed.
- Detailed evidence is [tracker 31](./trackers/31-unit6g-owner-batch-review-design-evidence.md).
- Exact next gate: Owner review and explicit approval/correction of the draft;
  6G-A red-test/contract work remains separately unauthorized.

## 2026-08-21 — Connected Unit 8 rollout and live verification

- The exact project was reverified healthy before each authorized step. A new
  dedicated `phase9_q08_cursor_secret` was created and verified without
  exposing its value.
- M49, M50, and M51 were applied individually as live versions
  `20260821060156`, `20260821060742`, and `20260821061213`; each appears once
  in the live migration ledger. No historical migration was replayed or
  repaired.
- Connected Q08/Q09/Q10 checks passed, including no-result behavior, cursor
  crypto and policy binding, Q09 continuation with zero overlap, stale/expired/
  wrong-store context degradation, Q10 public gallery ordering/max-three,
  anon/authenticated grants, private-table denial, privacy checks, and legacy
  v2 compatibility. The current dataset has no zero-stock rows, so no
  destructive stock fixture was created.
- M51 readback confirms the existing `1..3` check and unique
  `(inventory_id,public_order)` index, link and asset-lifecycle guards,
  nullable private/staging orders, and zero invalid/duplicate/NULL-eligible/
  over-three rows. `canonical_edition_exact` remains reserved/unreachable in
  text-query v1.
- Continuity validation passed. Full evidence is recorded in
  [unit8-connected-rollout-2026-08-21.md](./supporting/unit8-connected-rollout-2026-08-21.md).
- No source edit, commit, push, merge, deployment, or unrelated data mutation
  occurred in the connected validation itself; this handoff now authorizes the
  separate repository main-integration step.

## 2026-08-21 — Unit 8 main integration

- The pushed `phase9-unit8-u8b-bookstore-discovery` branch was fast-forwarded
  into `main` at `4c1d98d`, and `origin/main` was pushed successfully.
- `main` now contains the Unit 8 implementation, M49-M51 source, client/tests,
  connected-rollout evidence, migration reconciliation, and closure handoffs.
- No migration-history repair, additional live database mutation, unrelated
  deployment, or protected housekeeping-file change occurred during merge or
  push. The next action is a separate Phase 9 work-unit decision.

## 2026-08-21 — Read-only migration-history reconciliation

- Branch `phase9-unit8-u8b-bookstore-discovery` is pushed to
  `origin/phase9-unit8-u8b-bookstore-discovery` at `a47ac76`; `main` was not
  touched.
- Connected project `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`) reports 150
  migration rows; the repository has 153 migration files. 143 logical names
  are shared: 30 retain the same version and 113 have the same name with a
  different live version. This proves the local filename timestamps and live
  application-version timestamps are different ledgers; they must not be
  reconciled by replaying local files or editing applied history.
- Seven live names have no local source: three older club/notification grants
  and four post-M48 unrelated wishlist/reading-notes/library migrations.
  Seven local pre-Unit-8 files have no live name, and M49-M51 are also absent
  live. The live tail is M48 at `20260817075825`, followed by those four
  unrelated migrations.
- Read-only schema checks show the M49 upstream tables/helpers and pgcrypto/Vault
  table exist, but the Q08 cursor functions, Q08/Q09/Q10 public functions, and
  M51 asset guard do not. The dedicated `phase9_q08_cursor_secret` row is
  absent. No migration, repair, Vault write, or other external mutation was
  performed.
- The complete canonical local/live version and source-hash mapping is recorded
  in [migration-canonical-reconciliation-2026-08-21.md](./supporting/migration-canonical-reconciliation-2026-08-21.md):
  4 exact version/source matches, 93 same-logical/different-timestamp matches,
  and 46 divergent-content review flags. This is evidence only; it does not
  authorize ledger repair or migration application.

## 2026-08-21 — Final Unit 7/8 media invariant reconciliation

- Added repository-only M51. It fails closed if any already-publicly-eligible
  link has a NULL/out-of-range/duplicate order or an inventory has more than
  three eligible links. Runtime guards cover both link changes and later asset
  lifecycle transitions.
- Publicly eligible links must occupy a unique `public_order` in `1..3`.
  Pending/rejected links and private/staging assets may remain unordered.
- Q10 returns only the shared approved-public predicate, ordered by
  `public_order,id`, with `LIMIT 3`; the client enforces the same bounds.
- `canonical_edition_exact` is reserved and unreachable in text-query v1
  because v1 has no authoritative server-resolved edition-context input.
- Validation: U8B PGlite `63/63`; U8C PGlite `8/8`; Marketplace Jest
  `140/140`; M50/M51 migration contracts `6/6`; U8B and U8C disposable real
  PostgreSQL acceptance sentinels PASS; TypeScript, web export, diff check, and
  `PHASE9_CONTINUITY_CHECK=PASS`.
- Commit preparation: legacy RPC security `30b5b8b`, bookstore-first backend
  and M49-M51 `05a8b12`, and client Q08-Q10 integration `baf5e4f`.
- No live migration, history repair, Vault provisioning, deployment, commit,
  push, Storage mutation, or business-data mutation occurred.

## 2026-08-20 — U8B bounded corrective scope locally complete

- Corrected only the three confirmed review defects in M49: provider/canonical
  cover provenance comes from the authoritative inventory source, approved
  actual-copy media is the only fallback, the cursor binds to a deterministic
  fingerprint of effective relevant policy rows, and malformed decrypted cursor
  fields return `P9_CURSOR_INVALID`.
- Added focused PGlite regression cases and a disposable real-PostgreSQL
  bootstrap/acceptance path. The full U8B integration suite is `63/63` green;
  the disposable real-PostgreSQL path reports
  `U8B_REAL_POSTGRES_ACCEPTANCE_PASS`.
- M49 was exercised only in disposable local databases. No migration-history
  reconciliation, Vault provisioning, live Supabase verification, migration
  application, deployment, Storage mutation, or business-data mutation occurred.
- U8C was not started. The next exact action is independent U8B re-review, not
  connected operational work.

## 2026-08-20 — Unit 8 Marketplace SDD frozen

- Created the authoritative Unit 8 work-unit SDD at
  `work-units/08-marketplace-bookstore-first-sdd.md` using the established
  Phase 9 work-unit convention; no competing Unit 8 SDD existed.
- Froze the private-inventory → controlled publication → safe public boundary →
  Q07 → Q08 bookstore grouping/ranking/pagination → Q09/Q10 customer flow.
- Preserved `inventoryId` as private permanent Owner identity and `listingId` as
  current customer-safe offer identity. Title grouping is canonical edition,
  then validated ISBN, otherwise listing-scoped; normalized title/author and
  aliases are never identity.
- Recorded M47/M48 as a satisfied security prerequisite and the local/live
  migration-history mismatch only as a future pre-migration prerequisite.
- The 462-line cohesive SDD has all 22 contract sections. Phase 9 continuity,
  requirement/traceability/link validation, and repository `git diff --check`
  pass.
- No implementation, migration, database/Storage/business-data mutation,
  deployment, fixture, or Unit 9 work was performed. U8B requires separate
  authorization.

## 2026-08-17 — Legacy Marketplace RPC security remediation PASS

- Pre-change live inspection confirmed exact signatures, `SECURITY DEFINER`,
  empty `search_path`, `SETOF phase9_public_listing_projection` returns, and
  `inventory_id` in both legacy response shapes. The current client uses only
  the v2 JSON RPCs.
- Repository and live dependency evidence found no legacy caller: no `src`,
  worker, script, test-runtime, or SQL caller; all 12 live Edge Functions were
  read back and searched; the live `pg_proc` function-definition scan found no
  other calling function. M48 therefore restores trusted `service_role`
  compatibility intentionally, without restoring any customer role.
- M47 remains immutable at `20260817073341`; M48 is the forward correction at
  `20260817075825`. Final ACLs are `{postgres=X/postgres,service_role=X/postgres}`
  for each legacy RPC, while v2 JSON functions retain all existing customer and
  service grants.
- Explicit `SET ROLE` checks: `anon` and `authenticated` receive `42501` on
  both legacy RPCs and on direct projection-view access; `service_role` detail
  execution succeeds and shows the trusted full legacy row; v2 anon/auth search
  and detail succeed and return allowlisted JSON without `inventory_id`.
- Focused static/client Jest is 3 suites/15 tests green. Post-M48 counts are
  store inventory `10`, public projection `9`, marketplace listings `9`,
  Storage buckets `10`, and Storage policies `19`. No Unit 8 implementation,
  business-data mutation, Storage change, Edge redeploy, or unrelated grant/API
  change occurred. Next exact action: obtain separate Unit 8 SDD/freeze approval.

## 2026-08-16 — Unit 7C connected verification stopped on private-Save revision defect

- Deployed only `phase9-owner-ingestion` from exact HEAD `5cfc08ebbe8b20a94cbf6d0616d894a840bc8882`; live version 8 is ACTIVE, JWT verification is enabled, and all 25 deployed files match HEAD after line-ending normalization.
- Authenticated Store View listed five Owner rows, canary detail readback was authoritative, and a nonexistent inventory ID returned the generic non-enumerating unavailable state.
- The sole business mutation changed `Individuals` inventory `5f5a2bc9-d702-4aeb-af55-2a9df6c16478` only by setting private `internalNotes` to the canary marker. Inventory version became 2; quantity, publication intent/status, visibility, listing identity, and listing timestamp were unchanged.
- Defect: append-only public revision `b4d0624f-0f16-4ac9-8dfa-b14f2eb62e11` was inserted with `source_action=save_details` and unchanged customer-safe snapshot. With no prior revision, `phase9_append_publication_revision_v1(..., false)` compares the live snapshot with NULL and seeds revision 1 despite `v_public_changed=false`. No private field leaked and no customer projection changed, but public-history truth is false. Severity: MEDIUM; merge-blocking under SDD §§6 and 11.
- The affected flow stopped immediately. No stock/lifecycle/media/stale/replay/restoration mutation, M46, direct SQL write, repair, second deployment, push, or merge occurred.

## 2026-08-16 — Unit 7C M46 bounded correction PASS

- RED-first isolated the pre-M46 defect on a published zero-revision fixture:
  private-only Save succeeded but inserted revision 1 (`expected 0, actual 1`).
  The local correction is exactly
  `20260816000046_marketplace_phase9_unit7c_private_save_revision_correction.sql`.
  It preserves M43's transaction and calls the append-only revision helper only
  when `v_public_changed`; the private-only branch returns `NULL`.
- The three M46 integration cases pass: private-only Save keeps zero public
  revisions, the first public Save creates exactly one valid revision, and
  exact private Save replay adds no second effect. The post-M46 inventory
  suite is 18/18; the existing filter/media-history regressions are 15/15;
  static migration contracts are 20/20; focused Owner Edge/client contracts
  are 30/30; and the exact disposable M01→M46 real-PostgreSQL proof passes.
- Exact project `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn` was re-verified before the one application. M46 is
  live once as `20260816150126`. Function readback confirms the corrected
  branch, postgres owner, `SECURITY DEFINER`, empty `search_path`, authenticated
  and service execution, and anonymous denial. M39–M45 are byte-immutable.
- Connected reproof used the existing deployed Owner Edge v8; no Edge
  redeploy occurred. The actual Store View private-only Save changed only
  `internalNotes` on `Individuals`: version `2 -> 3`, quantity
  `1/1/0/0/0` unchanged, listing identity/public DTO unchanged, revisions
  `1 -> 1`, and audit/events `3 -> 4`. The original false revision remains
  preserved; no repair/reset or historical-row delete/update was performed.
- Correction boundary: stop after this reproof. Resume of stale/stock/
  publication/media/history/browser canary checks needs separate authorization.

## 2026-08-16 — Unit 7C resumed connected canary PASS

- The bounded continuation used the authenticated in-app Browser through the
  existing Owner Edge v8 and the exact development project
  `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`. No PostgreSQL business write,
  direct SQL repair, manual worker claim, second deployment, or migration
  application was used.
- The valid private-only Save advanced inventory version `3 -> 4` without a
  new public revision. A deliberate stale version `3` Save was rejected with
  the refreshed-details conflict and produced zero inventory, listing,
  audit/event, revision, or replay side effects.
- Stock `1 -> 0 -> 1` advanced versions `4 -> 5 -> 6`, projected
  `out_of_stock/unavailable` and then `active/low_stock`, and created the two
  expected `stock_adjustment` revisions. Pause and Republish advanced
  publication-intent version `2 -> 3 -> 4`; they preserved listing identity,
  created the expected `republish` revision, and left the final item
  published/active.
- Store View Manage Photos completed a real U7B-path ADD through authorization,
  upload/completion, validation, sanitized derivative approval, and link
  creation. Final media readback is one approved public `actual_copy` link and
  two relevant assets (private validated source plus public approved WebP
  derivative). The reused U7B ADD path intentionally emitted no separate Unit
  7C audit/event/revision; controlled Unit 7C media commands remain
  reorder/remove/replace.
- Final readback: inventory/listing counts `10/9`; canary inventory version `6`;
  publication intent version `4`; quantity `1/1/0/0/0`; stable listing
  `ef9752e5-e696-4246-b9f4-0c092e2a0e3e` in `active/low_stock`; revision count
  `4`; audit/event counts `9/9`; media link count `1`; allowlisted public
  snapshot key check passed; Store View history and Inventory/Store Profile
  browser routing passed.
- This canary did not alter the migration ledger or deployed Edge source. The
  exact next action is repository publication and merge to `main`; after that,
  obtain separate authorization before any further Phase 9 Unit 7C mutation.

## 2026-08-17 — Unit 7C publication and main integration

- The documentation closeout was committed as `e8a4d46` and the branch
  `codex/unit7c-wu5-store-view-cutover` was pushed to `origin`.
- GitHub connector PR creation was unavailable with `403 Resource not
  accessible by integration`; the explicitly authorized local non-fast-forward
  merge completed as `2be793e6212b1b485737c5045d701c99169490e4`.
- The merged scope contains the proven Unit 7C implementation, M46 correction,
  focused evidence, and Phase 9 handoff updates only. No Supabase migration,
  Edge deployment, secret, service, or unrelated worktree entry was changed.
- Exact next action: obtain separate authorization for the next Phase 9 work
  unit. Do not resume Unit 7C connected mutation in this handoff.

## 2026-08-14 — Unit 7C WU3 Store View management vertical

- Added strict `phase9-store-view-management-v1` Save and stock request/response
  contracts. The existing Owner router maps them separately to unchanged M43
  `phase9_update_store_inventory_details_v1` and
  `phase9_adjust_inventory_stock_v2`; caller store/listing authority, raw rows,
  quantity buckets in Save, and unknown fields are rejected.
- Added exact command identity, strict response decoding, offline refusal, no
  mutation retry, authoritative Store View/list invalidation, stale conflict
  refetch without replay, focused Edit and Adjust Stock modals, transactional
  live-failure copy, and duplicate-submit fencing. The form exposes exactly the
  thirteen M43 fields and visually marks shelf/location and internal notes as
  Owner-only.
- Store View detail renders Edit, Adjust Stock, Publish, Pause, Republish, Make
  Private, and Retry only from server capabilities. Publication actions call
  the existing Unit 7B hook/service; no lifecycle implementation was copied.
  Out of Stock remains separate from Needs Attention and stock transitions are
  rendered only after authoritative refetch.
- RED began with missing Edge/client/query/form/UI modules and absent actions.
  Final Store View/Edge coverage is 12 suites/63 tests. Unit 7C migration
  contracts are 2 suites/10 tests. Selected Unit 7B publication, WU2 read,
  routing, worker, and old Inventory regressions are 102 passed with 4
  pre-existing skips. TypeScript, Deno, Expo web export, and one fully
  intercepted browser Save -> stock `1 -> 0 -> 1` -> Pause -> Republish ->
  Make Private -> Publish -> publication-failed -> Retry flow pass.
- The browser proof validates UI/transport orchestration only; it does not
  relabel existing WU1/WU2A PostgreSQL semantics. Local Edge→DB remains
  `NOT_RUN_ENVIRONMENT`. M39–M44 are unchanged, no M45 exists, and no connected
  Supabase/Storage mutation, deployment, stage, commit, or push occurred.
  `docs/codemap/` remains user-owned, untracked, and untouched.

## 2026-08-14 — Unit 7C WU2 controlled Store View read vertical

- Added strict `phase9-store-view-read-v1` page/detail request and response
  contracts. The existing Owner ingestion router maps only
  `read_store_view_page` to M44 page-v2 and `read_store_view_detail` to M43
  detail-v1; requests contain no caller-authoritative store ID, and Edge maps
  the approved public projection to a bounded cover/availability summary.
- Added Store View service/query identity with server filter in every page key,
  opaque cursor forwarding, `inventoryId` detail identity, and no direct table
  or listing-ID management query. The hidden `/store-view` routes preserve the
  existing Inventory UI and Storefront primary tab pending WU5 cutover.
- The read-only list/detail UI renders all six filters and server lifecycle,
  attention, stock, capability, presentation, quantity, private-operation, and
  approved-media values without recreating eligibility. Publication-failed
  rows remain distinctly labeled under Needs Attention; Out of Stock remains
  distinct. No future-command buttons were added.
- RED began with four missing contract/service/route modules. Final focused
  WU2 evidence is 6 suites/31 tests; combined Owner Edge, existing Inventory
  read, and routing regression is 13 suites/274 tests. TypeScript, Deno check,
  web export, and fully intercepted Edge browser list→detail smoke pass.
  Local Edge→DB is `NOT_RUN_ENVIRONMENT` because Docker/local Supabase is not
  available; GitHub-hosted Docker would require prohibited publication/workflow
  authority, and an MCP branch would require a separately approved paid external
  mutation. Existing WU1/WU2A disposable PostgreSQL evidence is not relabeled.
- No M39–M44 edit, new migration, connected Supabase/Storage mutation,
  deployment, stage, commit, or push occurred. Read-only Supabase MCP reconfirmed
  exact project `ahntbtktjjmvfosgkmgn` healthy with M42 as the remote tail.
  `docs/codemap/`
  remains user-owned, untracked, and untouched.

## 2026-08-14 — Unit 7C WU2A Store View filter contract correction

- Added exactly one forward migration, M44, without changing M39–M43. Page v2
  accepts `all|private|live|paused|needs_attention|out_of_stock`, composes each
  item through M43's helper, filters before keyset pagination, and binds the
  versioned opaque cursor to the authenticated actor/store and selected filter.
- M43 composes `publication_failed` as its own effective state while also
  returning action-required attention; M44 includes it in the
  `needs_attention` bucket without relabeling it. Ordinary attention rows remain
  in that bucket, while out-of-stock rows do not enter it merely because they
  are unavailable. The server-composed retry capability remains unchanged.
- RED was 0/3 because the page-v2 function was absent on a valid M43 database.
  A secondary targeted RED reproduced cross-store same-filter cursor acceptance
  before actor/store binding was added.
  The affected WU2A integration is 3/3, the M44 migration suite is 5/5, and the
  M43 WU1 regression is 15/15. Exact disposable PostgreSQL M01–M44 replay passed; the existing WU1 vertical returned
  `UNIT_7C_REAL_POSTGRES_VERTICAL_PASS`; the new proof returned
  `UNIT_7C_WU2A_REAL_POSTGRES_FILTER_PASS` across page sizes 1/2/3 and two stores,
  including mixed ordinary/publication-failed `needs_attention` traversal.
- Read-only MCP reconfirmed exact project `ahntbtktjjmvfosgkmgn` healthy with
  M42 as the remote tail. No Supabase/Storage mutation, deployment, application
  work, staging, commit, or push occurred. Focused Unit 7A/7B suites were not
  rerun because M44 does not touch shared projection helpers; M43's complete
  WU1 integration and real vertical both passed unchanged.

## 2026-08-14 — Unit 7C Work Unit 1 local database contract

- Added local forward candidate M43 without editing immutable M39–M42.
- Implemented server-scoped Store View page/detail reads, exact-versioned and
  idempotent atomic Save, bounded stock adjustment v2, live zero-stock
  projection handling, and append-only safe public revisions while reusing the
  existing Unit 7B lifecycle and listing-sync path.
- RED was 0/11 expected failures for absent WU1 contracts. GREEN is Unit 7C
  integration 15/15, migration Jest 5/5, focused Unit 7A/7B regression 40/40,
  and exact final M01–M43 disposable PostgreSQL vertical proof PASS.
- Read-only MCP preflight reconfirmed `Bookconnect_reactexpo` / project ref
  `ahntbtktjjmvfosgkmgn` healthy with M42 as the remote tail. No Supabase,
  Storage, deployment, business-row, stage, commit, or push mutation occurred.
- Full media management is intentionally deferred to the next separately
  authorized work unit; WU1 only preserves existing approved public-media
  projection/history semantics.

## 2026-08-14 — Unit 7C normative SDD completion

Historical prior-handoff markers: **Implementation status:** `unit7b_main_integrated_next_scope_authorization`; **Active work unit:** `phase9_post_unit7b_handoff`.

- Created the single 293-line normative Unit 7C SDD for Owner Store View and
  post-commit inventory management.
- Frozen stable `inventoryId`, `store_inventory` authority, projection-only
  listings, controlled Save/Stock/Media/Lifecycle boundaries, server-derived
  state/capabilities, safe public revisions, UI cutover, forward database
  responsibilities, acceptance areas A–H, and the 12-step implementation order.
- Documentation verification only; no tests/code/migration file, Supabase or
  Storage mutation, deployment, live verification, stage, commit, or push.
- No design contradiction or blocker was found. Next: obtain explicit approval
  for forward database-contract/red-test implementation.

## 2026-08-14 — Unit 7B live-rollout closeout

Historical Unit 7B gate: **Next authorized action:** obtain explicit authorization for the next Phase 9 scope.

- M42 replaced the listing-sync trigger body so generated
  `marketplace_book_listings.authors_text` remains database-owned.
- The real private row `The Birth of Tragedy` completed Publish -> anonymous
  discovery with exactly one listing -> Pause/removal -> Republish with
  exactly one listing.
- A controlled transient projection failure produced one `publication_failed`
  state and one retry job; the worker resolved it. A stale-intent retry was
  fenced with `P9_STATE_CONFLICT`.
- Final connected readback preserved inventory identity and quantity, showed
  `published` state, one active listing, and zero outstanding publication
  retries.
- The pre-existing development entitlement row tagged `unit7b_dev_rollout`
  was changed from `active_listing_limit=1` to `10`. Authoritative eligibility
  now passes for the other ready rows; `Café du Livre` remains blocked by
  `price` because its price is zero.
- Commit `9f3e646` was merged into `main` at merge commit
  `53edbddc9c5417b34cb169599e8282b162e183b3`. No Unit 7C action or additional
  live migration/business-row mutation was performed.

## Historical 2026-08-14 — pre-M42 generated-column blocker

- The narrow M41 audit passed: exactly three provenance-qualified rows derive
  `ready` under the authoritative server function; no blanket promotion was
  found, and insufficient metadata remains non-ready under the focused test.
- Render service `phase9-publication-worker` / `srv-d9v6gsc9v7es73f1d6o0`
  deployed exact commit `c3c2726f4ec1455aa7f8cc2f16d206a9021d3649`.
  Deploy `dep-d9v6gss9v7es73f1d7e0` is live; health/readiness are green.
- Supabase Vault now contains the publication-worker URL and matching ingress
  token. Secret values were not written to repository files.
- The normal Owner UI selected eligible private inventory
  `461fa328-d95b-4573-965a-1eaa4be61ba1` (`The Birth of Tragedy`). Owner Edge
  v7 returned HTTP 500. PostgreSQL logs identify the exact failure:
  `cannot insert a non-DEFAULT value into column "authors_text"`.
- Live schema readback proves `marketplace_book_listings.authors_text` is
  generated from `public_authors`, while M40's listing-sync function explicitly
  inserts and updates `authors_text`. The transaction rolled back: the row
  remains draft/private, intent/version remain `1/1`, listing count is `0`, and
  retry count is `0`.
- No M42 was created, no M39/M40/M41 file was modified, no inventory repair was
  attempted, and Unit 7C/main integration were not started.

**Unit 7B independent-review status:** `FINDING_001: CLOSED`; Sol Light findings
001–006 are `CLOSED`, the bounded latest-subscription-order follow-up is
integrated, and factual evidence finding 008 is updated. The correction status
is `UNIT_7B_CORRECTIONS_PASS_READY_FOR_EXACT_SHA_RELEASE_GATE`. Real PostgreSQL
and Deno pass on corrected source. Docker container smoke remains
`NOT_RUN/BLOCKED_ENVIRONMENT` and `REQUIRED_BEFORE_LIVE`; it does not become a
PASS by deferral.
Historical continuity marker: **Next authorized action:** narrow independent review only of the four explicit-extension edits, local Deno graph proof, semantic equivalence, and focused regressions.
**Historical implementation status:** `unit7a_edge_deployment_blocked_by_source_routing_mismatch`
**Historical active work unit:** `unit7a_owner_edge_import_resolution_correction_requires_separate_authorization`
**Global tracker:** [DOC-13](../../DOC-13-implementation-tracker.md)
**Session protocol:** [SESSION-START.md](./SESSION-START.md)

## 2026-08-13 — Unit 7B runtime rollout checkpoint

- Supabase project readback remains `Bookconnect_reactexpo` / ref
  `ahntbtktjjmvfosgkmgn`, `ACTIVE_HEALTHY`.
- `phase9-owner-ingestion` was deployed from the checked-in source tree as
  Edge version **7**. The dashboard readback shows the deployment active, JWT
  verification enabled, the complete transitive local dependency tree, and
  publication actions including `set_publication_state`, `retry_publication`,
  `authorize_public_copy`, `complete_public_copy_upload`, and
  `read_publication_status`. The editor did not expose a Git SHA or deployment
  UUID; source readback matches the current branch HEAD `c3c2726f4ec1455aa7f8cc2f16d206a9021d3649`.
- No other Edge Function was changed. No database, Storage, or business-row
  mutation occurred in this checkpoint.
- Render workspace `tea-d9j67irtqb8s739ritc0` was enumerated with previews,
  KV, and Postgres checks. It contains only `phase9-metadata-worker`,
  `phase9-fixture-vision`, and `phase9-media-sanitation`; no approved
  `phase9-publication-worker` service was found. No new Render service was
  created because infrastructure creation requires explicit Owner
  authorization.
- After authorization, the supported Render creation request was rejected
  before mutation because it would transmit the Supabase `service_role` key
  and a new worker ingress token to the public Render service. No service,
  environment variable, or deploy was created.
- Publish -> Discover -> Pause -> Republish remains
  `NOT_RUN/BLOCKED_RUNTIME`. The exact next action is the explicit
  infrastructure authorization above, followed by Render deployment and
  health/readiness verification; live business testing remains separately
  gated.

### 2026-08-14 — New-session runtime handoff clarification

- No additional remote mutation occurred after the 2026-08-13 checkpoint.
  The available Render API listing still shows only the metadata, fixture-vision,
  and media-sanitation services. The browser dashboard check was at login, so a
  new session must re-establish dashboard authentication before provisioning.
- The supported Render create request was rejected before mutation because it
  would transmit the Supabase `service_role` credential and a new worker ingress
  token to a public service. No Render service, environment variable, or deploy
  exists as a result of that attempt.
- The process environment carried a foreign `SUPABASE_URL` host while the
  available service-role JWT identified ref `ahntbtktjjmvfosgkmgn`. User and
  machine environment scopes were unset, and the project `.env` remains pointed
  at `ahntbtktjjmvfosgkmgn`. New runtime commands must explicitly set the exact
  target URL and must not print the key.
- Exact next action: use the authenticated Render dashboard to provision or
  identify the approved `phase9-publication-worker`, configure its secrets
  without exposing them, deploy the checked-in worker, and capture service,
  deployment, health, readiness, and ingress-fence evidence. Stop before the
  live business test and obtain separate explicit authorization for it.

## Current Unit 7A implementation authority — 2026-08-12

The Owner has frozen a create-only commit model. Every explicit commit of an
eligible reviewed candidate creates exactly one new private inventory row from
the current server-held review; no duplicate lookup, merge, increment, manual
match, or “keep separate” branch exists in Unit 7A. The new row initializes
`total_quantity=available_quantity=q` and all other buckets to zero. Historical
Unit 6 duplicate controls are superseded for this path and must become
non-actionable/non-blocking before enablement. The normative authority is
[Unit 7A create-only inventory commit](./work-units/07a-create-only-inventory-commit-sdd.md).
The reviewed implementation and forward M39 migration are complete. M39 is
live exactly once as `20260812003419`; post-apply source/ACL/M05 and zero-
business-effect readback passed. Owner Edge version 5 is ACTIVE with JWT
verification and the `add_to_inventory` response-contract fix. The controlled
authenticated live mutation proof is PASS: one Owner UI commit plus exact
same-command replay created one private inventory row and produced zero replay
side effects. M09/global historical quantity strengthening is not a Unit 7A
prerequisite.

## Current Unit 6 closure authority — 2026-08-12

The automatic/functional Unit 6 pipeline is **PASS**: M38 automatic proof
completed media, vision/Gemini, metadata, and Owner-review handoff, with no
inventory/listing effects. The detailed native Unit 6F evidence remains
deferred `NOT_RUN`/`UNRESOLVED` debt, not PASS, for camera/gallery
physical-device parity, native recovery/reconnect, 15-card representative-device
performance, offline/reconnect, accessibility/large text, and low-end Android
resource/performance. The project owner accepts this deferred native-validation
risk and authorizes Unit 7 to begin. This current overlay supersedes older
Unit 6 sequencing statements that made the native debt a Unit 7 blocker; it
does not change Unit 6 SDD requirements or acceptance criteria, and Unit 7 has
not started in this documentation-only reconciliation.

> **Historical 2026-08-11 sequencing note (superseded):** **Next authorized action:** bounded independent review of the multilingual vision-response resilience correction; deployment requires separate authorization, followed by exactly one fresh Android image proof after deployment. Unit 7 remains unauthorized. That was the dated checkpoint; the current 2026-08-12 authority overlay above supersedes that sequencing decision.

## 2026-08-09 authorized web-proof stop

The actual Expo web application was started and the authenticated Owner path
was followed through Profile, Store Owner Console, and Inventory. Inventory
successfully loaded its read boundary and exposed `Resume scan` for an older
capture containing six processing images and one review item. Opening that
existing flow was read-only inspection; it was not used for this proof and no
image was added. Exact-project Supabase MCP baseline readback recorded four
sessions total (three active/closing), 18 inputs, 27 jobs (eight pending), 13
candidates, and zero metadata jobs, attempts, provider calls, lookups, or cache
entries. The shared queue cannot be attributed to a new image without touching
unrelated work. The process-only Google Books variable is also absent. The
proof therefore stopped before a fresh session/upload, as required by the
authorization. The browser is left at `/inventory` for handoff.

## Current handoff

Unit 7C's normative Store View/post-commit management design is frozen in
[the Unit 7C SDD](./work-units/07c-owner-store-view-post-commit-inventory-management-sdd.md).
WU1/WU2A/WU2/WU3 are locally complete; the exact next gate is separate
authorization to commit the WU3 Store View management vertical. M39–M44 remain
immutable and M43/M44 remain unapplied. Media/history, final cutover, connected
application, Supabase mutation, deployment, and live proof remain unauthorized.
The older implementation narrative below is retained as historical
evidence and does not override the current top-of-file status.

The 2026-08-07 authorized structural implementation closes that seam locally:
vision persistence and metadata-job creation share one PostgreSQL transaction;
the fenced worker context, provider-neutral runtime, immutable terminal outcome,
SAME-candidate transition, and Owner DTO are proven. M32 is not applied, no
provider was called, and the operational gates remain open.

The subsequent targeted correction pass closed the independent review findings
without changing the frozen architecture. M32 now owns canonical SQL/runtime
identity parity, strict vision-only enqueue provenance, cache-entry validation,
claim/candidate-version fences at every worker completion seam, stale physical
call rejection, and truthful degraded Owner state. Focused SQL/runtime tests are
green. Repository-wide TypeScript remains unverified because the root command
fails on existing `.ts` import-extension configuration, and bounded Owner React
Query suites timed out without assertions. Independent rereview is required
before any migration preflight or application decision. A final correction-only
implementation on 2026-08-07 added the validated-ISBN strategy invariant,
ISBN-10/13 local parity, physical-result recovery, storage-denial separation,
production coalescing lookup, malformed-result fail-closed handling, and full
M32 wrapper ACL enumeration. The final bounded correction adds authoritative
physical-finalization fencing, exact complete provider parsing, and a fenced
physical-call reconciliation RPC that preserves committed outcomes and records
unconfirmed egress as `outcome_unknown`. Focused Jest is 97/97, structural
worker/PGlite is 14/14, metadata foundation is 13/13, and vision/M32 PGlite is
40/40.

The current remediation context is development-only: there is no production rollout or external consumer compatibility requirement. The active problem is incomplete migration inside the development codebase from the Phase 4 direct-table owner console to the Phase 9 controlled owner boundary. The development Supabase project remains a real remote database, so authenticated/RLS/RPC behavior must still be verified against the exact project before any database mutation; this does not make the application a production environment.

The user explicitly re-sequenced WU1 ahead of the Unit 6F native gate. WU1
covered the [contract addendum](./work-units/owner-inventory-read-boundary-wu1-sdd.md),
red tests, exact-project preflight, and application of
`20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`. The
stable `phase9_owner_inventory(uuid)` detail RPC remains intact. The focused
static suite (10/10), local PGlite behavior/readback suite (3/3), continuity
validator, exact-project preflight, post-application readback, and anonymous
RPC denial passed. Positive Owner JWT runtime remains deferred because no
approved Owner credential was available; the native Unit 6F gate remains after
that runtime gate.

Phase 6 remains `complete_e2e_deferred`; Phases 7 and 8 remain deferred. Phase 9 M01-M08/M10-M14 are live exactly once and M09 remains absent. M13 exposes only minimum `SECURITY INVOKER` public wrappers for the authoritative private service RPCs; M14 adds service-only provider-attempt lineage and final egress validation. Owner ingestion is active with JWT verification; `phase9-media-sanitation` and `phase9-fixture-vision` are separate free-plan Render services at `96991a9`.

The [Unit 4 design](./work-units/04-fixture-vision-analysis-runtime-design.md) and [Unit 4A deployment runtime](./work-units/04a-deployment-runtime-scaffolding-sdd.md) are now live-verified through the [fixture deployment evidence](./trackers/06-fixture-pipeline-deployment-evidence.md). The deployed `one_book` path and eight fresh-process operator cases used recorded fixtures only, `batchSize: 1`, normal claim/fencing/persistence/failure paths, and produced zero inventory/listing/publication effects. Unit 5B now implements the initial Google Books adapter behind provider-neutral contracts, but it remains fixture/mock verified only: no credential, live call, deployment, or registry mutation occurred.

[Unit 5C Lite](./work-units/05c-lite-multilingual-search-variants-sdd.md)
is the approved target specification. Unit 5C-1 supplies its optional
versioned provider-neutral sidecar contract, strict field/language/script
validation, deterministic comparison/deduplication, and a safe companion
decoder. Unit 5C-2 adds private `phase9_search_variant_proposals` persistence,
token/attempt-fenced write and store-bounded read RPCs, and proposed-only,
non-searchable lifecycle defaults. M18 is live once as `20260729004216`;
M19 is live once as `20260729020008` and rejects changed accepted sidecar
replays through one immutable analysis-scoped fingerprint.
Unit 5C-3 adds the optional multilingual companion to the existing single
Gemini call while isolating strict canonical `p9-vision-v2` output from
independently validated sidecar failure. Accepted companions persist through
M18/M19 and reconcile title and each author independently against confirmed
Owner snapshots using narrow deterministic normalization, material-change
classification, default-deny activation, and trusted proposed/active/stale
transitions. M21 removes M20's temporary 5C-4 public search/materialization
effects. Unit 5C-4 then reintroduces the independently reviewed active-only,
store-scoped materialization and search boundary through immutable M22/M23.
It preserves exact source-field authority, original/ISBN/legacy search,
listing eligibility, and public display identity while retracting stale or
inactive search effect fail closed.
Unit 5C-5/5C-6 backend is independently approved and live through M24-M28:
strict Owner-only review/correction, candidate-first replacement locking,
canonical private benchmark evidence, platform review/evidence reads, and
exact approved rollout controls. No language is benchmarked or approved and
no capability is enabled.

Unit 6A is merged on `main` and live-verified through M29. Unit 6B is merged at
`9ef9eb3`, and Unit 6C is merged through `092562d`. Unit 6D remains implemented
at `c363b60`. Unit 6E false/missed-variant corrections are finalized at
`8bceab260a953b4d832fd55f34f58db12fa009b1`; M30 is live exactly once and its
remote helper/RPC definitions, read-only fixture checks, and fail-closed owner
authorization boundary are recorded in [tracker 23](./trackers/23-unit6e-review-corrections-evidence.md).
Unit 6F browser verification, live disposable Save/Close readback, and local
quality gates are recorded in [tracker 24](./trackers/24-unit6f-readiness-quality-gates-evidence.md).
The Unit 6F evidence gate remains open because representative native evidence
was not run; the debt is preserved and is not marked PASS. Unit 7 sequencing is
owner-authorized under the current closure authority above.

The provider/scale reconciliation keeps real Gemini provider-contract design as a separately gated prospective Unit 4B and keeps Unit 5 authoritatively named `Metadata/aliases`. The generic architecture supports one metadata primary and at most one disabled-until-approved secondary, horizontal correctness, and a fixed-multi-replica activation gate; it does not authorize provider calls, deployment changes, scheduling, or autoscaling. The bounded F1–F3 correction removes the deferred-secondary contradiction, makes media/vision/metadata capacity signals explicit, and disables raw provider/model payload persistence by default while retaining the independent-review gate.

The founder subsequently authorized Unit 4B and superseded only the initial primary
vision model ID to configuration-driven `gemini-3.5-flash-lite`; the earlier
`gemini-3.5-flash` handoff remains historical. Unit 4B is merged and M14 is
live-verified. The fixture adapter remains available, and no optional vision
fallback is selected or enabled.

The founder then authorized only the review corrections. Local M14 now adds
service-only vision-provider attempts and bounded register/validate/finalize/
associate/mark RPCs. Gemini registers an attempt, revalidates immediately before
private download, and revalidates again immediately before provider egress. Stable
logical spend identity is claim-retry independent, while each registered call has
a unique provider-attempt identity. Pricing evidence is a semantically validated
positive allowlist in TypeScript and SQL. M14 is live once as `20260727183546`;
no provider was configured, deployed, or called.

Auth hardening WU1/WU2 is locally complete and independently approved on `codex/auth-hardening-core`: production bypass policy is centralized and fail-closed; Zustand owns canonical session/status; one root bootstrap owns subscription/restoration; identity replacement remains blocked through cleanup failure and explicit retry; and current-device logout persists a non-secret deletion-intent guard until SDK or exact-key fallback removal succeeds. Auth no longer directly imports marketplace. Secure token persistence, Android backup, authoritative profile routing, OTP UX, native/offline testing, and remote EAS verification remain separately gated before Phase 9 mobile/private-ingestion runtime integration.

Repository `AGENTS.md` → `implementation/ACTIVE.md` → DOC-13 → `SESSION-START.md` → this tracker is the durable resume chain. A future session must report this block before acting and must use the session protocol's documentation matrix at closeout.

The exact development project was re-verified read-only at M11/M12 closeout:

| Field | Verified value |
| --- | --- |
| Project ID | `ahntbtktjjmvfosgkmgn` |
| Name | `Bookconnect_reactexpo` |
| Region | `ap-southeast-2` |
| Status | `ACTIVE_HEALTHY` |
| Postgres | 17.6.1 |
| Tenant discriminator | `store_id` (37 public-schema columns; zero `tenant_id`) |

## Tracker routing

- Product/planning decisions, source reconciliation, and live audit: [01-planning-and-decisions.md](./trackers/01-planning-and-decisions.md)
- Future implementation units, migrations, verification, rollout, and evidence: [02-implementation-and-verification.md](./trackers/02-implementation-and-verification.md)

## Planning deliverables

| Deliverable | Status |
| --- | --- |
| Root source-spec reconciliation | `complete` |
| Master SDD | `approved_baseline` |
| Data/canonical/metadata SDD | `approved_baseline` |
| Extraction/enrichment SDD | `approved_baseline` |
| Owner review/commit SDD | `approved_baseline` |
| Media/security/privacy SDD | `approved_baseline` |
| Marketplace display SDD | `approved_baseline` |
| Customer photo-request SDD | `approved_baseline` |
| Data dictionary | `approved_baseline` |
| Live database/storage current-vs-target audit | `package1_refresh_complete_read_only_2026-07-22` |
| Requirements traceability | `approved_baseline` |
| Complexity/scope register | `approved_baseline` |
| Cross-document link, acceptance-ID, and terminology validation | `complete` |
| Repository/active-phase/session routing | `complete` |
| Documentation update and closeout protocol | `complete` |
| Automated continuity validator | `complete` |
| User/design approval | `complete_2026-07-19` |
| Work Unit 0 plan | [`approved_2026-07-19`](./work-units/00-contracts-threat-migration-plan.md) |
| Work Unit 0A contracts/tests | `approved_2026-07-19` |
| Work Unit 0B technical design | [`independently_approved`](./work-units/00b-backend-api-technical-design-plan.md) |
| Work Unit 4 fixture vision-analysis runtime | [`integrated_main_e9ba2d9`](./work-units/04-fixture-vision-analysis-runtime-design.md) |
| Work Unit 4A deployment-runtime scaffolding | [`deployed_and_live_fixture_verified`](./trackers/06-fixture-pipeline-deployment-evidence.md) |
| Work Unit 4B Gemini vision adapter | [`m14_live_verified_provider_deferred`](./work-units/04b-gemini-vision-adapter-handoff.md) |
| Unit 5C Lite target SDD | [`merged_at_b44277a`](./work-units/05c-lite-multilingual-search-variants-sdd.md); Units 5C-1 through 5C-6 are merged/live at their recorded levels; M24-M28 live exactly once and no language enabled |
| Unit 6 Owner UX design authority | [`unit6e_finalized`](./work-units/06-owner-capture-review-recovery-ux-sdd.md); [contract matrix](./work-units/06-owner-capture-review-recovery-contract-matrix.md); [Unit 6A evidence](./trackers/19-unit6a-owner-safe-backend-evidence.md); [Unit 6B evidence](./trackers/20-unit6b-route-query-cache-evidence.md); [Unit 6C evidence](./trackers/21-unit6c-capture-upload-recovery-evidence.md); [Unit 6D evidence](./trackers/22-unit6d-candidate-review-evidence.md); [Unit 6E evidence](./trackers/23-unit6e-review-corrections-evidence.md); Unit 6F separately gated; split 6A-6F |
| Provider and scale architecture SDD reconciliation | `stale_marker_superseded_by_unit4b_m14_m17_unit5a_review_evidence_2026-07-28` |

## Blocking gate before further implementation

WU0A, WU0B, Package 1, Unit 4, Unit 4A, Unit 4B, Unit 5A, Unit 5B, and Unit
5C-1 through Unit 5C-6 backend have component, fixture, migration, or live
evidence at their recorded levels. Those records do not prove a production
Gemini-to-metadata-to-review integration.
M01-M08/M10-M28, the Owner ingestion boundary, and both separate fixture
workers are live-verified; M09 remains absent. Unit 5C-4 is merged at
`d092f08`; Unit 5C-5/5C-6 and Unit 6A are merged on `main`. Unit 6B is merged
at `9ef9eb3`; Unit 6C is merged through `092562d`; Unit 6D is implemented at
`c363b60`; Unit 6E is finalized with M30 live exactly once. Unit 6F requires
separate authorization. Customer display changes,
customer display changes, inventory/publication, commerce, provider fallback,
and global alias authority remain separately gated.

Before further implementation, a read-only vertical audit must identify the
exact missing production transitions, callers, worker runtime, database
boundaries, candidate-state gates, provider configuration, and Unit 6 DTO
consumption. The audit may not originate new product requirements or authorize
deployment, provider calls, migrations, external mutation, or Unit 7.

## Risk summary

| Risk | Current containment |
| --- | --- |
| Cross-tenant write/read | Server derives `store_id`; RLS is backstop; every privileged boundary needs Store A-to-Store B denial tests. |
| Multimodal prompt injection | Model receives no tools; output is untrusted and schema-validated; deterministic code owns all calls and writes. |
| Accidental publication | Mandatory owner review; first-session publication default is private; listing eligibility is server-controlled. |
| Canonical catalogue pollution | Uncertain/manual entries remain store-local with nullable canonical link. |
| Duplicate over-merge | Advisory warning only; no image comparison and no automatic merge. |
| Public/private media leakage | Separate scan, public-copy, and request-photo classes; server-mediated promotion; private request delivery. |
| Cost/retry explosion | Image hash replay protection, one whole-image fallback maximum, sequential metadata providers, policy quotas. |
| Stale inventory | Confirmation-before-payment remains; `last_verified_at` and repeated request-photo failures feed listing review. |
| Lifecycle/storage growth | Purpose-specific retention, deletion jobs, orphan detection, legal/dispute holds, deletion evidence. |
| Existing global Supabase warnings | Recorded as pre-existing; Phase 9 cannot copy broad public listing or ambient `SECURITY DEFINER` patterns. |
| Dedicated sanitizer worker | Local feasibility passed at 8/12/16 MP; provision and load-test a non-Edge worker with the recorded CPU/memory envelope before deployment. |

### Unit 6F architectural risk: Owner operation lifecycle composition

Recorded 2026-08-02 under Unit 6 SDD §§19–21, 28, and 34–35 and correction
commits `237393b`/`a0d55b5`. The feature composes domain operation hooks (semantic
idempotency and canonical mutation), `useOwnerUxOfflineGate` (identity/version
authority and offline blocking), and screen-level mounted-scope/in-flight
fencing. The correction pass depends on those boundaries for Save cancellation,
generation-aware reconnect authority, CandidateReview reconnect deduplication,
and the exact pending confirmation state.

Keep these layers composed for the current closeout; do not introduce lifecycle
consolidation in Unit 6F or Unit 7. A future consolidation must preserve the
operation key, canonical-version gate, mounted-scope generation, reconnect
coalescing, pending UI, and zero-Unit-7-effect invariants with red-first tests
and fresh browser/native evidence. This is a risk/decision gate only and does
not authorize implementation.

### Unit 6F native UUID remediation checkpoint

Recorded 2026-08-02 under Unit 6 SDD §§8–9, 13–14, 19–24, and 34–35. The
native scan startup crash caused by browser-global `crypto` was corrected with
the SDK54-compatible `expo-crypto` API; capture attempt identities are now
lazy and render-stable. Focused capture tests passed 17/17, the full
image-inventory suite passed 223/223, TypeScript and diff hygiene passed, and
no Supabase/Storage/migration/external mutation occurred. No Android device or
emulator was visible to `adb`, so the native completion gate remains open and
the next action is the representative SDK54 Android evidence in tracker 24.

### 2026-08-03 web runtime and route-warning checkpoint

The Store Owner tab warning was corrected by registering the concrete
`orders/index` route declared by the filesystem; the route regression test
passed. `npm.cmd run export:web` passed after bundling 2,245 modules. The
authenticated Codex in-app browser reached `/library`, `/dashboard`, and
`/inventory` with no browser console errors; existing style, notifications,
Sentry, and build-tool warnings remain. The live exact-project read-only ACL
check confirmed that `store_inventory` has RLS enabled but no authenticated
table SELECT/INSERT/UPDATE privilege, while owner policies and controlled
inventory RPCs remain present. Legacy Store Owner services still use direct
`store_inventory` reads/writes, and the inventory hook swallows the read error;
this boundary remediation is not included in the route fix. No Supabase,
Storage, migration, deployment, inventory, listing, or publication mutation
occurred. This historical checkpoint was superseded by the explicit WU1
re-sequencing above; the current next action is separate review/approval of the
unapplied WU1 draft, followed by representative SDK54 Android evidence. Unit 7
and live migration application remain gated.

### 2026-08-04 WU1 post-review correction checkpoint

- Authorized work unit and scope: local correction of the WU1 contract, unapplied
  SQL draft, red tests, continuity validator, and evidence documentation only.
- Completed: explicit NULL page-size rejection; safe `P9_INTERNAL_ERROR`
  normalization; `asOf` clarified as an ordering horizon rather than a full
  repeatable snapshot; WU1 addendum/evidence artifacts made continuity-gated.
- Preserved: existing quantity/publication write paths, stable detail RPC,
  routes, screens, hooks, services, dashboard, live grants/policies, and all
  external state.
- Verification: correction red run reproduced 3 failures; focused green Jest
  passed 9/9; PGlite passed 1/1; continuity passed with 65 Markdown files and
  51 required phase files; final diff hygiene passed.
- Supabase/external mutations: none; migration `20260803000031` remains local
  and unapplied, with live history ending at M30.
- Next authorized action: independent review of the corrected draft and runtime
  application-test plan; separate application approval is still required.

### 2026-08-04 WU1 application and post-application readback checkpoint

- Authorized work unit and scope: WU1 only; exact-project development
  application, readback, and non-mutating runtime checks. No client, UI,
  legacy-caller, write-path, dashboard, Storage, provider, or production change.
- Completed: migration `20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`
  applied exactly once through Supabase MCP as live version
  `20260803221216 marketplace_phase9_owner_inventory_read_boundary`.
- Verification: new eight-argument `jsonb` RPC and exact owner-page index are
  present; `STABLE SECURITY DEFINER`, postgres owner, empty `search_path`, and
  narrow ACLs read back; stable detail RPC, RLS/policies, table ACL, existing
  indexes/constraints, and projection trigger/function are unchanged.
- Runtime: anonymous REST execution was denied with HTTP 401. Positive Owner,
  cross-store, inactive-Owner, all-filter, cursor-context, live-DTO, and
  authenticated table-SELECT checks remain deferred for lack of an approved
  Owner JWT; no fixtures or users were created.
- Risk/operations: the regular index creation completed successfully. A
  pre-existing anonymous table-DML ACL remains outside WU1; RLS has no anon
  policies and WU1 did not alter that drift.
- Next authorized action and gate: obtain the approved Owner credential for the
  deferred runtime matrix, then resume representative low-end Android Unit 6F
  evidence. Unit 7 and legacy-caller cutover remain gated.

## Next action gate

Unit 5A supplies strict ISBN normalization, versioned provider-neutral
lookup/contracts, local-canonical-first planning, cache and identical-query reuse
identity, bounded routing primitives, metadata attempt/cost lineage, and immutable
selected-snapshot/manual-review persistence. M15 is live once. M16 removed six
direct mutation privileges inherited through Supabase defaults, and M17 removed
PostgreSQL 17 MAINTAIN from those three tables plus M14
`vision_provider_attempts`. Exact-project readback now proves
`service_role=r/postgres`, RLS, postgres ownership, client denial, and the 13
hardened RPC boundaries on all four tables.

Unit 5B is complete at the merged fixture/mock-verified level recorded in
[tracker 11](./trackers/11-unit5b-implementation-evidence.md). Matching, reuse,
and storage are independently enforced, and only `coherent_match` is a positive
reusable outcome. Unit 5B created or applied no migration; M09 remains absent.
Unit 5C-5/5C-6 backend is live-verified through M28 at approved tree
`66db5be740940a8c882bb7ea312817f4c33bb2db` and implementation commit
`4b667fc6674d606a8f88e2a4ee933d79bf332f53`; it is merged on `main`.
Unit 6A is merged and live-verified through M29. Unit 6B is merged at `9ef9eb3`,
Unit 6C is merged through `092562d`, and Unit 6D is implemented at `c363b60`.
Unit 6E is finalized at `8bceab260a953b4d832fd55f34f58db12fa009b1` with M30
live exactly once; evidence is in [tracker 23](./trackers/23-unit6e-review-corrections-evidence.md).
Phase 9 Unit 6F has browser/readback evidence but remains blocked on the native
gate recorded in tracker 24. WU1 is live once with readback complete, and WU2
has locally cut over the read-only Owner `/inventory` route; authenticated
runtime remains deferred. Do not start dashboard remediation, Unit 7, another
migration, or deployment without separate authority.
Keep M09 absent and do not commit inventory/listings, publish, add commerce, add
provider fallback, or create global alias authority.

### 2026-08-04 WU2 read-only Owner inventory client checkpoint

- Authorized scope: Owner `/inventory` read path only; canonical WU1 list RPC,
  strict DTO validation, exact filters/search, pagination, cache isolation,
  read-only states, tests, and continuity records.
- Completed path: `/inventory` → `InventoryFoundationScreens` →
  `OwnerInventoryReadScreen` → `useOwnerInventoryRead` →
  `phase9_owner_inventory_page_v1`. The route graph no longer reaches the
  legacy direct-table inventory service.
- Verification after correction-review closure: focused WU2 Jest 4 suites/50
  tests; related regressions 39 suites/303 tests; TypeScript passed
  with `--allowImportingTsExtensions`.
  Jest retained its known post-run open-handle warning and pre-existing
  CandidateReview `act(...)` warnings in the broad run.
- Mutations: no migration or Supabase/Storage row, Edge Function, provider,
  deployment, inventory/publication write, commit, push, or staging action.
- Gate: authenticated Owner runtime is deferred because no approved session
  was available. Dashboard remediation, stale-code deletion, Unit 6F native
  completion, and Unit 7 remain separately gated.
- Next authorized action: obtain an approved development Owner session for the
  deferred WU1/WU2 runtime matrix; then resume Unit 6F Android evidence.

### 2026-08-04 WU2 independent-review correction checkpoint

- Red-first reproduction: 3 suites failed with 8 failing assertions covering
  strict timestamp/version rejection, refresh row preservation, and truthful
  error/operation presentation.
- Corrected: offset-aware ISO timestamps and positive versions fail closed;
  refresh preserves loaded pages until a separate first-page request succeeds;
  invalid cursor still resets; invalid request, cursor, unavailable,
  internal/malformed response, refresh, and next-page recovery are distinct.
- Verification: focused 4 suites/45 tests, related 39 suites/298 tests, and
  TypeScript passed. Existing Jest lifecycle and CandidateReview `act(...)`
  warnings remain separately recorded.
- Scope: no database, Storage, deployment, dashboard, write path, Unit 7,
  staging, commit, or push action occurred. Authenticated runtime remains the
  next authorized gate; the P3 architecture-test hardening note is non-blocking.

### 2026-08-04 WU2 second correction-review checkpoint

- Review verdict: `changes_requested` for cached refresh data recommit,
  missing explicit scope-generation fence, unauthorized retry controls, and
  refresh-error/successful-empty overlap.
- Red evidence: 2 suites failed with 4 assertions; the stale identity removal
  diagnostic already passed through query cancellation but received an
  explicit independent generation fence.
- Corrected: refresh commits only explicit success from the current request
  generation/scope; cached failure preserves every loaded page; late identity,
  filter, unmount, or concurrent-refresh completion cannot write; unauthorized
  initial/partial states expose no retry; refresh errors suppress empty success.
- Verification: focused 4 suites/50 tests, related 39 suites/303 tests,
  TypeScript, continuity, and WU1/WU2/repository diff checks passed. Existing
  Jest lifecycle and CandidateReview warnings remain.
- Scope remains read-only with no database/external mutation, dashboard,
  Unit 7, staging, commit, or push. Authenticated Owner runtime remains deferred.

### 2026-08-04 WU2 focused correction-review closure

- Final finding: unauthorized initial/partial cards had no action, but the
  global header Refresh control remained reachable.
- Red/green evidence: two screen assertions failed before the correction;
  afterward the screen suite passed 15/15, focused WU2 passed 4 suites/50, and
  related regressions passed 39 suites/303.
- Correction: all screen-level refresh/retry controls are absent while the
  active error category is unauthorized; authorized states retain refresh.
- TypeScript and continuity/diff gates passed. No database, external, dashboard,
  Unit 7, staging, commit, or push action occurred.

### 2026-08-04 CAP-01/CAP-02 capture-to-Preview handoff correction

- Confirmed Preview cleanup was clearing the provider selection during a
  transient access-boundary/route lifecycle unmount; provider placement and
  media URI lifetime were sound.
- Removed only that implicit cleanup; explicit reselect, successful
  registration, cancellation, and unavailable-media recovery remain bounded.
- Real Expo Router/provider lifecycle regression passed after red-first
  reproduction; focused capture verification passed 9 suites/46 tests,
  TypeScript and diff hygiene passed, and `.pyc` count is 0.
- Browser web evidence passed with a sanitized local fixture through Preview,
  Back, reselect, Choose another image, and picker cancel. The existing
  start-session handoff created one disposable session
  (`97925897-56dd-47dc-bf33-24ae4fdf2f10`), left open because verification
  stopped at Preview; upload/register/process/save/close were not invoked.
  Native verification remains unclaimed.
- Next authorized action remains the existing WU1/WU2 authenticated runtime
  evidence, followed by representative low-end Android Unit 6F evidence.

### 2026-08-04 post-registration Preview flash correction

- The successful upload handoff now marks navigation intent and clears
  provider-held media only when Preview unmounts for the destination route,
  eliminating the queued-router unavailable-media flash. A post-invalidation
  generation/identity/authority guard preserves Back and identity cleanup.
- Red/green lifecycle, ordering, and stale-completion coverage passed; focused
  capture tests passed 9 suites/48, TypeScript and diff hygiene passed. This
  small correction has no database, upload, migration, deployment, commit,
  push, or staging mutation. Browser and native rerun for this
  post-registration timing fix remain unclaimed.

### 2026-08-05 Android 11 observation and browser follow-up

- The user reports Android 11, accessible large-text use, and a connected
  native camera. This is a user observation without a device model,
  font-scale/screen receipt, performance trace, or offline/reconnect evidence;
  it does not satisfy the representative native gate by itself.
- Browser follow-up covered the authenticated Owner read path, filters/search,
  review navigation, Resume scan, sanitized fixture upload, disposable Review
  Save, logout/re-authentication, and unavailable-session Retry with zero
  browser errors. The disposable session remained active with four images
  processing, so Close was not available on that session. Cross-store and
  inactive/non-Owner denial fixtures remain deferred.
- Large-text is recorded as a user-confirmed observation; dropdown UX is a
  later non-gating improvement. Unit 6F remains open under SDD §§24, 28, and
  34, and Unit 7 remains separately gated.
- Next authorized action: obtain the missing representative Android evidence
  required by the Unit 6 SDD, then rerun continuity/quality review before any
  Unit 6F closeout or Unit 7 authorization.

### 2026-08-05 15-card and Gemini fixture clarification

- The UI consumes decoded Owner candidate DTOs and does not call Gemini
  directly. The fifteen-candidate check is covered with deterministic
  `ownerUxTestFixtures.ts` data: fifteen ordered candidates plus an independent
  partial failure, and an over-fifteen safeguard.
- Focused verification passed **2 suites/20 tests** for
  `CandidateReviewScreens` and `CaptureProgressScreens`. This is a local
  fixture-backed UI/contract result, not live provider or native performance
  evidence.
- Unit 6F remains `USER_ACTION_REQUIRED_NATIVE_EVIDENCE`. Pending closeout is
  representative Android evidence (including the fixture-backed fifteen-card
  run, sequential-capture memory, offline/reconnect, accessibility/large text,
  performance, and CAP/post-registration reruns), followed by the deferred
  WU1/WU2 runtime cases when approved cross-store/inactive-Owner/runtime
  fixtures exist. Unit 7 remains separately gated.

### 2026-08-05 Unit 4B Gemini configuration/startup deployment addendum

- Separately authorized scope: configure the dedicated Render vision worker for
  a temporary Gemini startup check. This did not change the active WU2 work unit
  or authorize mobile Gemini access, inventory/publication behavior, a migration,
  or a new database/Storage fixture.
- Render evidence: `phase9-fixture-vision` service
  `srv-d9jbsjf41pts73cejqag` is live at commit `7eaf921efcaefccab4d0189dc26779796f164ed4`,
  deployment `dep-d9pdei9t0dsc73ddgbh0`. The deployed logs emitted
  `service_started` for `phase9-vision-analysis-worker` and Render reported the
  service live. The prior deployment attempt failed because the Gemini key was
  present while fixture mode was still the default; the configuration was
  corrected before the live deployment.
- Render environment evidence: masked `PHASE9_GEMINI_API_KEY` is present;
  `PHASE9_VISION_ANALYZER_MODE=gemini`,
  `PHASE9_GEMINI_MODEL_ID=gemini-3.5-flash-lite`, and
  `PHASE9_GEMINI_TIMEOUT_MS=30000` are present; fixture-only
  `PHASE9_VISION_FIXTURE_CASE` is absent. The key value was never read or
  recorded by the agent.
- Verification boundary: startup/live deployment passed, but no authenticated
  `/run` request or real Gemini inference was performed. A real provider call
  still requires an approved disposable job with sanitized private media and
  must record M14 attempt/usage/cost evidence. No Supabase, Storage, migration,
  inventory, listing, publication, staging, commit, or push mutation occurred.
- Next authorized action: revoke the exposed temporary key and enter a fresh key
  directly in Render; only then run the separately approved controlled provider
  call and record the result.

### 2026-08-05 Gemini processing-path investigation

- Investigation scope: read-only follow-up after a sanitized image was uploaded
  through the local Owner capture flow. No code, database, Storage, Render,
  secret, deployment, worker invocation, provider call, commit, or push change
  was made in this investigation.
- Observed path: the upload completed registration and the session showed the
  image in a processing/checking state. The Owner upload path registers the
  media job but does not call the Render worker `/run` endpoint. The deployed
  vision worker has startup evidence, but no accepted/completed invocation for
  this upload was observed, and no Gemini inference or persisted candidate names
  were verified.
- Finding: the Gemini key/configuration is not itself a trigger. The observed
  evidence stopped at queued processing, but that observation alone did not
  establish the complete cause. Subsequent repository tracing also found the
  production vision-to-metadata job handoff, runnable metadata worker, and
  enriched-candidate readback unproven. No new follow-on product work unit is
  authorized; the current next action is the read-only vertical integration
  audit under existing Unit 4B/5A/5B authority.
- Verification boundary: no provider-attempt, usage/cost, or candidate output
  may be claimed from this investigation. The existing key-rotation and
  controlled-provider-call gate remains unchanged.

### 2026-08-07 final bounded structural-metadata correction pass

- Completed only H1-H3 and E1-E3/F1. Physical finalization now revalidates the
  accepted vision lineage; provider outcomes require one exact complete,
  identity-coherent normalized edition; and failed/lost physical-finalization
  responses reconcile committed evidence or persist `outcome_unknown`.
- SQL-backed worker evidence proves known-retryable replay with one physical
  call, independently committed sibling success, invalid-ISBN bibliographic
  fallback, and zero positive retention under storage denial. E1-E3/F1 exposed
  no production defect and therefore changed tests only.
- Final current verification: focused identity/provider/gateway/composition/
  worker Jest 97/97; structural worker/PGlite 14/14; metadata foundation 13/13;
  vision/M32 40/40; metadata-worker TypeScript build passed. The continuity and
  final diff-hygiene results are recorded in tracker 02.
- All 14 public M32 worker wrappers deny PUBLIC/anon/authenticated and grant
  only `service_role`; the new reconciliation wrapper has fixed empty
  `search_path`, schema-qualified references, and server-derived lineage.
- No Supabase/Storage read or mutation, M32 application, provider call,
  deployment, scheduler, commerce effect, Unit 7 work, stage, commit, push, or
  merge occurred. M32 remains repository-only and unapplied.
- Next authorized action: independent approval rereview of the frozen bounded
  diff. Exact-project read-only preflight and M32 application remain separately
  gated.

### 2026-08-08 latest M32 narrow-correction closure

- H1 disposition is `RESOLVED_BY_PROOF`: the approved Owner review transition
  rejects a `processing` candidate and leaves its version unchanged. Physical
  work remains fenced by the authoritative claim attempt, worker, token, lease,
  candidate state, and accepted vision lineage, so M32 needs no candidate-version
  column or runtime parameter on the physical-call row.
- H2 is resolved by one shared `requiredIsoTimestamp` boundary used by vision,
  metadata edition/result, and automated-alias parsing. Direct regressions reject
  date-only, timezone-less, and malformed values and accept `Z` and explicit
  offsets.
- H3 direct regressions cover repeated identical reconciliation, registered-call
  survival across reclaim, idempotent reuse of a known finalized completion, and
  rejection of an old worker's post-reclaim overwrite without physical, logical,
  candidate, job, or snapshot mutation.
- Verification actually run: focused Jest 7 suites/97 tests; structural PGlite
  14/14; metadata foundation PGlite 13/13; vision/M32 PGlite 40/40. The
  metadata-worker TypeScript build, Phase 9 continuity validator, and repository
  diff hygiene passed.
- The oversized production gateway LOW is intentionally deferred: its stateful
  lookup, physical-call, and completion sequencing has no extraction boundary
  that avoids new callback/state indirection in this narrow pass.
- M32 remains repository-only and unapplied. No Supabase/Storage access,
  provider call, deployment, scheduler/dispatch, secondary-provider selection,
  inventory/publication effect, Unit 7 work, stage, commit, push, or merge
  occurred.

### 2026-08-08 independent narrow correction-only rereview

- A fresh context-isolated, read-only reviewer examined only the H1/H2/H3
  corrections and gateway-size disposition and returned `APPROVED`.
- The reviewer confirmed H1 is resolved by the existing authority proof, H2
  uses one strict shared timestamp boundary, H3 has direct reconciliation,
  reclaim, idempotency, and stale-worker regressions, and the gateway LOW is
  appropriately deferred for this correction pass.
- The reviewer made no edits and performed no external or Git mutation. M32
  remains repository-only and unapplied.
- Next authorized action: final approval rereview of the frozen narrow diff;
  exact-project preflight and M32 application remain separately gated.

### 2026-08-08 controlled live metadata proof — blocked before provider egress

- Authorized scope: exact-project preflight, minimum Google Books registry configuration,
  local metadata-worker readiness/auth/empty-queue smoke, and one fresh post-M32
  candidate only if the real worker/provider prerequisites were available. No
  historical candidate, manual metadata job, M33, scheduler, inventory, listing,
  publication, Unit 7, Git, or `docs/codemap/` action was authorized.
- Exact-project readback: `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` is
  `ACTIVE_HEALTHY`; M32 is live exactly once as
  `20260808020404 marketplace_phase9_structural_metadata_integration`. Six
  historical M32-eligible candidates remain untouched; metadata jobs remain zero.
- Live configuration mutation: inserted exactly one `google_books` / `metadata`
  registry row for adapter `1.0.0`, enabled/matching/storage allowed, 86,400-second
  revalidation, policy 1. Public display and image caching remain disabled.
- Blocker: the checked-out runtime has no `PHASE9_GOOGLE_BOOKS_API_KEY`, and its
  configured `SUPABASE_SERVICE_ROLE_KEY` resolves to a different Supabase host than
  the verified development project. The worker therefore could not safely connect
  to the target project in real-provider mode. No candidate, session, input, metadata
  job, lookup, attempt, physical provider call, snapshot, or Owner readback was created.
- Readback: metadata jobs/attempts/lookups/cache/snapshots/usage reservations/provider
  calls are all zero; inventory/listings are unchanged at 5/5; inventory media links,
  moderation flags, committed candidates, metadata schedulers, and Phase 9 scheduler
  rows are zero. The five existing cron jobs are unrelated club/notification/commerce
  jobs. Supabase also reports the pre-existing RLS-disabled advisor finding for
  `spatial_ref_sys`, `marketplace_event_schema_registry`, and
  `marketplace_notification_type_registry`; it was not changed.
- Verification actually run: exact-project Supabase MCP readback, provider-row
  readback, cron/function/trigger/ACL checks, metadata-worker TypeScript build PASS,
  `git diff --check` PASS, and the Phase 9 continuity validator PASS after the
  documentation and validator-status update.
- Next authorized action and gate: configure the exact target-project service
  credential and Google Books credential through the approved secret mechanism, then
  rerun the bounded proof. Do not create a candidate until that gate passes.

### 2026-08-08 Phase 0 credential inventory rerun - blocked before test data

- The source-defined real path requires `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `PHASE9_GEMINI_API_KEY`,
  `PHASE9_GEMINI_MODEL_ID`, `PHASE9_GEMINI_TIMEOUT_MS`,
  `PHASE9_GOOGLE_BOOKS_API_KEY`, `PHASE9_GOOGLE_BOOKS_TIMEOUT_MS`, and
  `PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES`. Gemini is the `google_gemini`
  adapter using configuration-driven `gemini-3.5-flash-lite`; Google Books is
  the `google_books` adapter version `1.0.0` and requires its API key in real
  mode.
- Credential inventory without secret values: the process has a Supabase URL
  and service-role value, but the URL host is
  `nxjnoqjxzkipeghhfxee.supabase.co`, not the approved
  `ahntbtktjjmvfosgkmgn.supabase.co`; all six `PHASE9_GEMINI_*`/real
  `PHASE9_GOOGLE_BOOKS_*` runtime names are absent. No approved environment
  file defines any of those Phase 9 names.
- Exact-project read-only MCP verification still identifies
  `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` as `ACTIVE_HEALTHY`, with
  M32 exactly once and one existing approved Google Books registry row. Counts
  remain metadata jobs `0`, historical M32-eligible candidates `6`, inventory
  `5`, and listings `5`.
- The mandatory Phase 0 gate therefore stopped before vision/metadata worker
  startup, upload, Gemini egress, Google Books egress, candidate creation, or
  Owner readback. No remote mutation occurred in this rerun; the existing
  registry row was reused for readback only.
- Verdict for this credential-inventory run: `LIVE_METADATA_BLOCKED_MISSING_CREDENTIALS`.
  The Supabase target/credential mismatch is an additional `BLOCKER`.
- Next authorized action: configure the exact target-project service URL/key and
  all required real Gemini/Google Books variables through the approved secret
  mechanism, verify them without printing values, then rerun the same bounded
  one-candidate proof.
### 2026-08-09 authorized stale-state cleanup and Owner web proof stop

- The user authorized a development-only cleanup of stale Phase 9 processing
  state while preserving inventory, listings, stores/users, canonical books,
  and unrelated data. Nine remaining objects in `image-extraction-inputs` were
  removed. Three active/closing sessions were closed, 17 inputs were
  terminalized, eight pending media/vision jobs were cancelled, 13 stale
  uncommitted candidates were either deleted or expired at the immutable-audit
  boundary, 20 upload capabilities were removed, and 10 scoped media rows were
  marked deleted. Immutable vision evidence, append-only variant decisions,
  and their required audit rows were retained.
- Post-cleanup readback was `0` active/closing sessions, `0` stale pending
  media/vision jobs, and Owner Inventory displayed `Review books (0)`. No
  inventory, listing/publication, store/user, canonical-book, migration,
  scheduler, Unit 7, deployment, or Git publication effect occurred.
- The real Expo web Owner flow accepted
  `C:\Users\user\Pictures\Books\testimage.jpeg` and created fresh session
  `204b9115-cf8b-4344-a771-042fdfdfd9f1`, one uploaded input, and one open
  `media_validate_sanitize` job. The proof stopped there because the invoking
  process has neither `PHASE9_MEDIA_WORKER_URL` nor
  `PHASE9_MEDIA_WORKER_INGRESS_TOKEN`; vision and metadata invoker variables
  are also absent. No unauthenticated bypass or Render configuration change was
  attempted, and Gemini/Google Books were not called.
- Exact next authorized action: supply the existing worker URLs and matching
  ingress tokens process-locally, then resume by invoking only the fresh media
  job. A Google Books key must also be supplied process-locally before the
  metadata stage; the previously authorized key is no longer available.
- Follow-up evidence: Render readback located the existing
  `phase9-media-sanitation` service at
  `https://phase9-media-sanitation.onrender.com` and confirmed its existing
  `PHASE9_MEDIA_WORKER_INGRESS_TOKEN` configuration without exposing the value.
  The token and URL were passed only to the existing invoker process. The
  bounded invocation returned HTTP 200, claimed one job, and reported `queued`.
  Database readback shows the media job `resolved` after one attempt, the input
  `queued` with media/sha256 lineage present, and one fresh `vision_extract` job
  `open`; unrelated pending media jobs remain zero.
- Vision follow-up located the existing `phase9-fixture-vision` Render service
  and used its existing ingress token process-locally without printing or
  persisting it. Exact isolation was one fresh open vision job, zero unrelated
  open vision jobs, and zero pre-existing fresh candidates. Two bounded claims
  both returned HTTP 200 / `retry_scheduled`; the job is at attempt 2 of 5 with
  safe error `P9_VISION_ANALYZER_UNAVAILABLE`. No provider-attempt or usage row
  exists, proving Gemini egress did not occur.
- Live function readback identifies the integration defect: applied
  `marketplace_sec.phase9_complete_media_validation` creates `vision_extract`
  but does not create a `phase9_usage_reservations` row, while applied
  `marketplace_sec.phase9_register_vision_provider_attempt` requires that row.
  The proof stopped rather than exhaust retries or fabricate the missing
  reservation. Owner UI displays `Image 1 · Trying again`, `Books found: 0`.
  Exact next authorized action: implement and apply the forward-only reservation
  creation correction with focused media-to-vision tests, then resume this same
  job/session. This requires separate migration authority.

### 2026-08-09 local M33 vision-reservation correction

- Authorized local scope completed: red tests preceded
  `20260809000033_marketplace_phase9_vision_reservation_correction.sql`.
  M33 adds one postgres-private reservation helper, replaces only the
  service-only media finalizer, and creates or validates the policy-1 vision
  reservation before the media job can resolve.
- The guarded data repair selects only structurally valid, unleased
  `open|retry_scheduled` vision jobs with approved linked WebP media and no
  reservation. It excludes terminal history, uses no generated job IDs, and
  preserves attempt/error lineage; the live preflight found exactly one such
  vision job, the fresh proof job at attempt `2/5`.
- Regression evidence: M33 static 3/3; M33 integration 5/5 including full-M32
  application compatibility, private-helper ACLs, M14 registration, conflict
  rollback, and terminal exclusion; combined ingestion/vision/provider/M33
  PGlite 61/61. The pre-existing M14 fixture digest was corrected from a fake
  two-MD5 construction to the harness's authoritative SHA-256.
- M33 was not applied. No Supabase/Storage/provider/worker/UI/product mutation,
  duplicate-input cleanup, stage, commit, push, deployment, scheduler, Unit 7,
  inventory, listing, or publication action occurred.
- Exact next authorized action: independently review the M33 local diff and
  evidence, then separately authorize exact-project application/readback.
  After a successful apply, cancel the duplicate open media input through the
  existing lifecycle boundary and invoke only the original fresh vision job.

### 2026-08-09 M33 required-review corrections

- The independent verdict was `APPROVED_WITH_REQUIRED_CORRECTIONS`: the repair
  admitted malformed nonterminal history on closed sessions or media owned by a
  different same-store initiator, and the shared migration harness skipped M31
  while claiming a complete M32 tail.
- Red-first regressions failed on both findings. M33 now requires an active
  session and `media_assets.uploaded_by = image_extraction_sessions.created_by`
  in both helper and repair. Tests directly exclude closed-session,
  wrong-initiator, terminal, and duplicate media-job fixtures while preserving
  attempt count, next-attempt time, and safe error history.
- `databaseHarness.mjs` now orders M31 before M32/M33. Final verification:
  M33 static 3/3, focused static 39/39, M33 integration 5/5, combined focused
  PGlite 61/61, and database foundation/catalog 17/17.
- No Supabase/Storage/provider/worker/deployment, migration application,
  duplicate-input cleanup, inventory/publication, scheduler, Unit 7, stage,
  commit, or push action occurred. M33 remains local-only and unapplied.
- Exact next authorized action: independent correction-only rereview, followed
  by separately authorized exact-project application/readback.

### 2026-08-09 compact Gemini multilingual/language-hint correction

- Gemini output is reduced to compact visual identity plus optional compact
  multilingual enrichment, with no more than five authors. BookConnect attaches
  provenance and maps usable variants to the existing M18/M19 contract.
- Enrichment is non-fatal and author ordinals are unique within the actual
  returned author list. Original-script text remains canonical; Romanization and
  optional English title translation remain separate proposals.
- Selected session language is now a hint in TypeScript and local forward M34.
  Current-tree PGlite through M32/M33/M34 passed 59/59 and proves unchanged M32
  metadata-job creation for a differently detected valid book.
- Focused target Jest 46 tests and vision-worker TypeScript passed. No provider,
  Render, job, Supabase, inventory/publication, stage, commit, or push action
  occurred. M34 remains local and unapplied.
- Exact next action: independent review of [tracker 27](./trackers/27-compact-gemini-multilingual-language-hint-evidence.md); provider-only proof, deployment, M34 application, and attempt 5 remain gated.

### 2026-08-09 compact Gemini required diagnostics correction

- The independent verdict was `APPROVED_WITH_REQUIRED_CORRECTIONS` because
  bounded provider request IDs and error codes were shape-checked but not
  compared with the worker's configured privileged values.
- Red-first evidence failed one analyzer assertion with 21 existing assertions
  green and one egress assertion with 5 existing assertions green: configured
  secrets appeared in failure-log identifiers and successful attempt persistence.
- The sanitizer now receives the existing privileged-value list and nulls a
- bounded provider request ID or error code containing a configured secret in
  both failure diagnostics and successful attempt finalization.
  Safe status, category, request ID, and error-code diagnostics remain available.
- Final verification: analyzer Jest 22/22; complete focused correction Jest
  47/47; vision-worker TypeScript build passed.
- No Supabase, provider, Render, worker/job, migration application,
  inventory/publication, stage, commit, or push action occurred. M34 remains
  local and unapplied; the preserved attempt-5 action was not invoked.
- Exact next authorized action: independent correction-only rereview of the
  compact Gemini/M34 scope and this diagnostics fix.

### 2026-08-09 corrected-production provider-proof stop

- Exact source: reviewed commit `dc19107ef9fc1252f85626614147de2562f15559`
  at local `HEAD`; branch is one commit ahead of upstream and was not pushed.
- Exact-project read-only preflight reconfirmed `Bookconnect_reactexpo` /
  `ahntbtktjjmvfosgkmgn` as `ACTIVE_HEALTHY`. M31, M32, and M33 are recorded in
  order, with M33 exactly once as `20260809023834`; M34 is absent and unapplied.
- The replacement Gemini key was merged into only the existing Render vision
  service. Render does not offer save-only behavior through the update path and
  automatically restarted once. Deploy `dep-d9s3mtqjobas73ehntdg` became live
  at the prior source SHA `83cf61ae93b263d6a31a5cda67da2be91cdb97fb`.
- The production sanitizer regenerated the existing 1600x1600 WebP byte-for-byte
  at SHA-256 `5a9c18ea392cb63bbf3c2e58a9d91482bca4e9e8f32b576063cba5a0d5c41e39`.
  The exact committed full prompt/schema/decoder request used the configured
  `gemini-3.5-flash-lite` model and failed before decode with HTTP 400,
  `INVALID_ARGUMENT`, and safe provider category `malformed_request`.
- Bounded isolation kept the same key, model, image, prompt, and request shape.
  Omitting only the optional `multilingual_search_enrichment` schema subtree
  returned HTTP 200. Replacing nullable `anyOf` nodes with documented type-array
  nullability left the full schema at HTTP 400. The concrete failing component
  is therefore the multilingual response-schema subtree/combined nesting
  complexity, not the image, core `vision` schema, prompt, model, or null form.
- Stop-rule effects: no Supabase job claim/mutation, M34 application, Git push,
  corrected deployment, attempt-5 invocation, candidate/metadata work, Owner UI
  continuation, inventory/publication, scheduler, or Unit 7 action occurred.
- Exact next authorized action: make the smallest compatibility correction to
  the multilingual provider response schema and rerun this same provider-only
  request. Do not resume M34/deploy/job execution until the full request decodes.

### 2026-08-09 flattened observation correction

- The user replaced the separate multilingual provider subtree with one flat
  observation contract: original identity plus nullable title Romanization,
  nullable English title translation, and positionally aligned nullable author
  Romanizations. BookConnect derives script/provenance/source-field identities
  and maps usable values into the unchanged M18/M19 envelope server-side.
- Red-first evidence: the two focused suites failed 10 assertions against the
  old decoder before production changes. Final focused analyzer, egress,
  variant-runtime, vision-policy, and deployment-runtime Jest is 59/59; the
  vision-worker TypeScript build passes.
- The exact provider-only rerun was not executed because the external-action
  boundary requires explicit approval to send the sanitized contents of
  `C:\Users\user\Pictures\Books\testimage.jpeg` to Google Gemini. One such
  request was approved and attempted with the flattened production
  schema/decoder/mapper. Gemini returned HTTP 400; the safe category was
  `malformed_request` with message `provider rejected the request shape` and no
  safe provider error code or request ID. The analyzer mapped this to
  `P9_VISION_ANALYZER_UNAVAILABLE` before production decode.
  No workaround was attempted. M34, Git, Render, Supabase, jobs, metadata,
  Owner UI, inventory/publication, scheduler, and Unit 7 remain untouched.
- That approved retry is exhausted. Exact next authorized action: obtain fresh
  approval only if another sanitized-image probe is needed to isolate the schema
  component; downstream execution remains blocked until HTTP 200 plus decode.

### 2026-08-09 schema-free JSON-mode correction and proof

- Red-first: the focused analyzer test failed because the production request still
  contained `responseJsonSchema`.
- Completed: removed the provider-side response schema entirely. Gemini now
  receives only JSON MIME mode, the sanitized WebP, and the compact flat prompt;
  the existing BookConnect decoder remains the authoritative validation boundary.
- Verification: exact-path focused Jest 59/59 and vision-worker TypeScript PASS.
  A broader Jest invocation also discovered the unrelated `.wt/g3` worktree and
  reported one failure from that worktree's different deployment state; the five
  authoritative root paths are green.
- Approved provider result: Gemini accepted the request and returned JSON. There
  was no HTTP 400/provider-shape rejection. Production decoding then returned
  `P9_VISION_SCHEMA_INVALID`, proving the remaining blocker is local response
  normalization, not provider request compatibility.
- No Supabase, Storage, job, Render, Git, metadata, Owner UI,
  inventory/publication, scheduler, or Unit 7 mutation occurred. The temporary
  proof script was removed.
- Next gate: one explicitly approved bounded retry that captures the returned JSON
  without secrets, followed by only the decoder normalization supported by that
  evidence. Downstream execution remains blocked until production decode passes.

### 2026-08-09 bounded JSON capture and decoder normalization

- The approved bounded capture reached Gemini and returned the simple `vision`
  object with eight observations. The exact decoder mismatches were
  `image_outcome: "success"` and one unreadable observation with
  `detected_language: null`; all other requested flat fields were present.
- Red-first analyzer Jest reproduced `P9_VISION_SCHEMA_INVALID`. Production now
  normalizes only `success` to canonical `analyzed` and null detected language to
  canonical `und`, then applies the unchanged strict decoder and M18/M19 mapper.
- Verification: exact-path focused Jest 60/60; vision-worker TypeScript PASS.
- A final real-image proof was not run: the approval boundary rejected the
  additional image transmission as separate from the capture call. No workaround
  was attempted. The temporary capture script was removed.
- No Supabase, Storage, job, Render, Git, metadata, Owner UI,
  inventory/publication, scheduler, or Unit 7 mutation occurred.
- Next gate: explicit approval for one final sanitized-image provider request;
  downstream execution remains blocked until production decode succeeds.
### 2026-08-10 — preserved real-image pipeline and Owner UI proof

- Exact project: `ahntbtktjjmvfosgkmgn`; M34 applied once as live version
  `20260809182407 marketplace_phase9_vision_language_hint_correction`.
- Vision: preserved job `8bf664bb-5afa-41f7-ad2c-d86d9b2de2e8` resolved at
  attempt 5 with `accepted_with_language_skips`; input is `ready`, result
  `eafc9bf3-5373-4ec4-bd7b-d6dfa9b3b017` contains 8 observations and produced
  7 candidates. The eighth observation was retained as an unknown-language
  non-candidate.
- Metadata: the seven resulting M32 jobs were claimed once and resolved to
  `P9_METADATA_NO_MATCH`, placing every candidate in `needs_review`. The
  previously supplied Google Books key is present and valid (HTTP 200). Root
  cause was the adapter's `projection=lite`, whose live response omits required
  `language`; `projection=full` decodes live results (8/10 for the bounded Black
  Swan check). Correction commit `e4f2b34` is pushed on
  `codex/phase9-gemini-json-deploy`; focused Jest 26/26 and metadata-worker
  TypeScript build pass.
- Owner UI: Profile -> Store Owner Console -> Inventory reports
  `2 images · 7 need attention`; `/inventory/reviews` renders all seven books;
  the Black Swan detail preserves original title, author, and `en`, exposes the
  manual-details fallback, and defaults to Save private.
- Integrity/scope: immutable terminal metadata snapshots were not bypassed,
  deleted, or overwritten. No review save, inventory/listing/publication,
  scheduler, commerce, or Unit 7 action occurred. No additional Render deploy
  followed the user's no-deploy instruction.
- Exact next authorized action: Owner manual review of these seven candidates
  only. Any automatic replay of terminal metadata evidence requires a separately
  designed and authorized recovery path; do not enter Unit 7 or publication.

### 2026-08-10 — remove uploaded image local implementation boundary

- User-authorized scope is limited to an Owner-controlled Remove image action;
  automatic dispatch, Unit 7, and publication remain out of scope.
- Red-first mobile and Edge coverage now defines a strict `remove_scan_input`
  command using session/input identity, expected input version, idempotency key,
  and command ID. The canonical response is an input transitioned to `skipped`
  with updated input/session/presentation versions.
- Implemented locally: confirmation UI, identity-fenced mutation/cache refresh,
  strict mobile/Edge request and response contracts, service adapter, and exact
  `phase9_remove_scan_input_v1` RPC routing. Focused Jest is 187/187 green and
  TypeScript passes with the repository's Deno import-path option enabled.
- In-app Browser proof on session `f1fc2f59-2cec-4666-a9ee-86ff62723ca4`
  confirmed both image cards expose Remove image and Image 2 opens the bounded
  confirmation. The confirmation was cancelled; no removal request was sent.
- No database/storage mutation, migration creation/application, Edge deployment,
  worker invocation, Git stage/commit/push, or live image removal occurred.
- Exact next authorized action: obtain explicit permission to create one forward
  migration file implementing `phase9_remove_scan_input_v1` plus database tests.
  Creating the file does not authorize applying it to Supabase.

### 2026-08-10 — one-current-image correction and safe removal M35

- User product decision: retain **Remove image**, remove append-style **Add
  another image**, and offer one replacement only after the current image is
  removed. This supersedes only the multiple-image portion of P9-D04.
- Client boundary: Preview refuses a second authorization when a current input
  exists. Progress retains Remove image only when `acceptedCandidateCount=0`,
  hides append UI, and exposes Choose replacement image only when no current
  input remains.
- Database boundary: local forward M35 adds the authenticated, server-derived,
  versioned `phase9_remove_scan_input_v1`; both upload issuance and completion
  enforce one current input. Removal rejects any candidate lineage, cancels only
  exact media/vision jobs, marks the input `skipped/P9_OWNER_REMOVED`, preserves
  historical session counts, and schedules hold-aware cleanup without deleting
  Storage objects, candidates, inventory, or listings.
- Verification: M35 structural Jest 6/6; isolated PGlite migration/behavior 3/3,
  including legacy two-capability state, replacement after removal, and atomic
  rollback when a candidate exists; capture preview 18/18; progress/remove 9/9;
  cache identity 2/2; service/Edge regressions 186/186; repository TypeScript
  PASS; Phase 9 continuity PASS with 195 definitions, zero duplicate/missing
  traceability, 68 Markdown files, 53 required files, and diff check PASS.
- Read-only in-app Browser verification on the legacy live session showed three
  existing processing image cards, each retaining Remove image, with no Add
  another image control. Image 1 opened the updated exact-input cancellation and
  cleanup confirmation; Cancel was pressed and no removal request was sent.
- External state: Supabase project and M34 tail were read-only reverified. M35
  was not applied; no Edge deploy, live removal, Storage write/delete, worker
  call, Git stage/commit/push, inventory, listing, publication, or Unit 7 action.
- Exact next authorized action: review M35 and explicitly authorize its
  exact-project application. Edge deployment and live removal remain separately
  authorized actions.

### 2026-08-10 — automatic worker wake dispatcher local review package

- Local M36, dispatcher/runtime tests, metadata deployment preparation, and
  required continuity records are implemented but unapplied.
- Red-first and full regression evidence: focused pre-correction Jest 22/22,
  dispatcher PGlite 24/24, Phase 9 Jest 693/693, Phase 9 PGlite 236/236 before
  review corrections, and all
  three worker build/entrypoint smokes passed.
- Independent verdict was `APPROVED_WITH_REQUIRED_CORRECTIONS`; all findings
  were corrected with due-stage isolation for media/vision/metadata, two-row
  single-wake proof, measured timeout justification, scaled delayed `/run`
  coverage, and accurate composed idempotency evidence. Corrected focused gates
  pass at Jest 23/23 and dispatcher PGlite 28/28; corrected full gates pass at
  Phase 9 Jest 694/694 and Phase 9 PGlite 240/240.
- Continuity passes with 195 requirement definitions, zero duplicate/missing
  mappings, 69 Markdown files, and 53 required files. Repository diff check
  passes and generated `.pyc` count is 0.
- No live/external mutation occurred. M36 is unapplied, live migration tail is
  M35, the existing claimable media job is untouched, and live Phase 9
  Cron/Vault/metadata-service state is unchanged.
- Rollout conclusion: the deployed media and vision services remain ordinary
  authenticated `/run`-compatible with the optional dispatch-ID header, but
  predate dispatch-ID receipt logging. Redeploy both before final live
  correlation proof; this is observability-only and requires no claim-RPC or
  provider behavior redesign. Metadata service creation remains separate.
- Exact next authorized action: review and explicitly authorize or reject a
  separate deployment/external-mutation unit. Application, secrets, service
  deployment/redeployment, cron activation, live worker proof, live image
  removal, duplicate replay, Unit 7, inventory/publication, stage, commit, and
  push remain prohibited.

### 2026-08-10 — metadata retry/provider-attempt correction

- Exact-project read-only verification confirmed M32-M37 live exactly once,
  with M37 as the migration tail. Applied migrations remain immutable.
- Red-first SQL-backed evidence reproduced the defect: after Google Books
  returned a retryable result, the next job claim replayed that finalized
  physical call and advanced toward dead-letter without fresh provider egress.
- Local forward M38 exposes the selected physical call's originating claim
  attempt through service-only metadata context v2. Retryable finalized evidence
  is reused only within the same claim; a later claim registers a fresh physical
  call. Terminal and non-retryable reconciliation remains replay-safe.
- Exact Google Books HTTP 503-to-200 evidence proves two fetches, physical-call
  claim attempts `[1, 2]`, `attempt_count=2`, one resolved ready snapshot, and no
  dead-letter or attempts-exhausted event. Same-claim and later second/third
  claim guards are covered separately.
- Verification: focused metadata Jest 148/148; structural metadata PGlite 14/14;
  full Phase 9 PGlite 242/242; metadata build, entrypoint smoke, deployment
  runtime validation, continuity, diff hygiene, secret/artifact hygiene, and
  generated `.pyc` checks pass. Independent correction-only verdict: `APPROVED`.
- External effects: none. M38 was not applied; no deployment, provider/job
  invocation, retry/requeue, Vault/Cron, Storage, media, vision, query-policy,
  duplicate-replay, Unit 7, inventory, listing, or product-publication state
  changed.
- Git publication: correction commit `8c55fea` was pushed to
  `origin/codex/phase9-metadata-retry-correction`; `docs/codemap/` remained
  untracked and untouched.
- Exact next authorized action: open a separately authorized operational session
  if M38 application and metadata-only redeployment are desired. Neither is
  authorized by this closeout.

### 2026-08-10 — M38 rollout and final Unit 6 proof

- Publication: `origin/main` was fast-forwarded without force or conflict from
  `211217b` to exact approved SHA `a138baa7d3bbc086da019bc052a5ae31d0e15882`.
- Database: exact project `ahntbtktjjmvfosgkmgn` was healthy; preflight found
  M32-M37 exactly once, M38 absent, the dispatcher active, zero claimable work,
  zero active metadata leases, and baseline counts of 6 sessions, 26 inputs,
  57 jobs, 25 candidates, 5 inventory rows, and 5 listings. Exact M38 was then
  applied once as `20260810130638 marketplace_phase9_metadata_retry_correction`.
  Post-apply readback proved fixed empty `search_path`, postgres ownership,
  service-role-only execution, active dispatcher, zero created/claimed jobs,
  and unchanged row counts.
- Deployment: only `phase9-metadata-worker` was deployed, exactly once, as
  Render deploy `dep-d9ssq2v10e5c73ahp18g` from the approved SHA. Health and
  readiness returned 200 and auto-deploy remained off. Media and vision were
  not redeployed.
- Final proof: after closing the prior terminal Owner session through its normal
  non-committing UI, one SHA-new 3,269,293-byte PNG was uploaded through the
  authenticated Owner UI into session `1bd67cb3-3cc4-4b0e-8b6b-11e9fff9d64a`.
  Automatic media and vision/Gemini each resolved on claim 1; six observations,
  six candidates, and six metadata jobs were created. All six metadata jobs
  resolved automatically on claim 1: five physical Google Books calls and one
  safe cache completion, with two coherent matches and three safe ambiguous
  provider outcomes. No retryable provider result occurred naturally.
- Owner result: the real session screen showed one processed image, six books,
  `Continue to book review`, and six `Needs attention` cards. No candidate was
  opened, reviewed, committed, or published.
- Non-interference: final inventory/listing counts remained 5/5; the historical
  metadata dead-letter job `206ffc83-de84-4cbf-835a-a2d3fb56eb79` retained its
  pre-session `2026-08-10T11:33:01.16159Z` terminal timestamp. Manual `/run`,
  manual claims, SQL repair/reset, operator retries, duplicate replay, media or
  vision redeploy, and Unit 7 actions were all zero.
- Closure verdict: `PASS`. Unit 6 is complete. The prior representative low-end
  Android evidence was not rerun; the user's explicit final-proof acceptance
  instruction makes this successful bounded live proof the Unit 6 closure gate.
- Exact next authorized action: none. Any Unit 7 work requires a new explicit
  authorization and a new bounded session.

### 2026-08-11 — multilingual vision-response resilience correction

- User-supplied physical evidence: native FileSystem signed upload succeeded,
  exactly one Storage object and input were created, sanitation completed, and
  vision job `20734f70-dd4c-4f68-87d5-aa837cb32b7d` failed terminally as
  `P9_VISION_SCHEMA_INVALID`. Removed input
  `a1c8e286-07f2-40c5-9bbd-2fed49c5148d` remains `skipped/P9_OWNER_REMOVED`.
- Red-first implementation: 16-100 reported observations become complete-image
  `too_many_books`; values beyond 100 fail; bounded unknown human language
  labels become `und` without modifying Unicode title/authors; optional
  enrichment remains independently rejectable; schema logs contain only a
  sanitized code-owned path and closed category.
- Strictness retained: unknown top/vision/in-cap observation keys, active core
  content, non-string languages, invalid identity, malformed ordinals, and raw
  payload overflow fail closed. No observation truncation or malformed-core
  salvage occurs.
- Verification: red suite failed 5/21 before production changes; final
  resilience 21/21; analyzer/captured payload plus resilience 46/46; focused
  worker/extraction/multilingual/security/Unit 6 polling 120/120; Image Inventory
  39 suites and 294/294; repository TypeScript with the documented import flag
  and vision-worker build pass. The unflagged TypeScript command produced only
  the repository's known TS5097 import-extension configuration errors.
- External effects in this correction session: none. No migration, database or
  Storage write, deployment, live provider call, removed-input retry, inventory,
  listing, publication, Unit 7, stage, commit, push, or PR action occurred.
- Exact next action: bounded independent review; after approval, separately
  authorize deployment, then exactly one fresh Android image proof.

### 2026-08-12 — Unit 7A create-only planning reconciliation

- Frozen behavior: each explicitly committed eligible reviewed candidate creates
  exactly one new private inventory row from the current server-held review.
- Removed from the Unit 7A contract: duplicate lookup/advice/action, target-row
  selection, merge, existing-row increment, manual match, and keep-separate.
- Quantity: the reviewed `q >= 1` initializes total/available to `q` and
  reserved/sold/removed to zero. Unit 7C owns later quantity changes; M09/global
  historical validation is not a Unit 7A prerequisite.
- Unit 6 transition: historical duplicate UI/DTO requirements are superseded
  for Unit 7A and must be non-actionable/non-blocking before enablement.
- Migration verdict: a forward create-only command migration is required; the
  existing applied M05 command is not safe to connect. No migration was created
  or applied.
- Effects and verification: documentation changes only; no Unit 7A tests were
  created or executed, and no production code, database/Storage, deployment,
  provider, inventory, listing, publication, stage, commit, push, or PR action
  occurred. Exact next gate: separately authorize the load-bearing red tests.

### 2026-08-12 — Unit 7A create-only local implementation

- Authorized work unit and scope: local Unit 7A red-first database/Edge/mobile
  implementation, forward migration-file creation, ephemeral database tests,
  verification, and required documentation. Live migration application,
  deployment, Supabase/Storage writes, Unit 7B/7C, and Git publication were
  excluded.
- Completed: new authenticated create-only command, server-held review and
  metadata authority, candidate/review/metadata revision fences, exact replay,
  changed-replay and concurrency protection, one-to-one provenance, private
  inventory-only creation, duplicate non-interference, strict Edge/mobile
  contracts, online-only non-optimistic UI action, ambiguous retry, and exact
  cache invalidation. The legacy M05 callable is retained but its execute grant
  is revoked for all API/service roles.
- Files/components/migrations: local M39
  `20260812000039_marketplace_phase9_create_only_inventory_commit.sql`, the
  Unit 7A PGlite fixture/suite, Owner ingestion contracts/runtime tests, mobile
  candidate contracts/service/query/form/screens/tests, and
  [tracker 29](./trackers/29-unit7a-create-only-commit-evidence.md). The frozen
  Unit 7A SDD was not edited.
- Verification actually run: clean red baseline 13/13 failed before M39; final
  Unit 7A PGlite 13/13 passed; Phase 9 Edge/mobile/migration regression 42
  suites and 479/479 tests passed; TypeScript with the repository's documented
  `--allowImportingTsExtensions` flag passed. Final continuity and diff/security
  hygiene are recorded in tracker 29 after closeout execution.
- Supabase/external mutations: none. Fresh read-only preflight verified
  `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` healthy with live history
  ending at M38. M39 was run only in the repository's ephemeral PGlite harness
  and remains unapplied. No Storage, queue, provider, inventory, listing,
  publication, deployment, stage, commit, push, or PR action occurred.
- Decisions/deviations/risks: no SDD conflict or behavior deviation found.
  Unit 6F native debt remains unchanged. Live ACL/function readback and an
  authenticated Owner smoke remain operational gates after any future approved
  M39 application/Edge deployment.
- Tracker/source-doc updates: ACTIVE, DOC-13, Phase 9 stable handoff, README,
  SESSION-START, master/implementation trackers, migration ledger,
  current-vs-target audit, data dictionary, traceability, and tracker 29.
- Next authorized action and gate: review the complete local Unit 7A diff. M39
  application, Edge deployment, authenticated live smoke, staging, commit, and
  push require separate explicit authorization.

### 2026-08-12 — Unit 7A controlled live proof PASS

- `phase9-owner-ingestion` version 5 is ACTIVE. The deployed bundle includes
  `add_to_inventory` in the `allowedActions` enum in
  `supabase/functions/_shared/imageInventory/contracts/ownerUxResponses.ts`,
  resolving the `OwnerUxResponseContractError`/`P9_INTERNAL_ERROR` that had
  prevented candidate detail from exposing Add to Inventory.
- At 04:41 UTC, the authenticated Owner committed candidate
  `f6266e3a-e920-4fa0-a993-c02c739f5108` (`Individuals` by P. F. Strawson) from
  session `166a20cb-c919-4e06-8e4a-1cd53e4ef393`. The resulting inventory row
  is `5f5a2bc9-d702-4aeb-af55-2a9df6c16478`, with one-to-one candidate
  provenance, `entry_method=image_extraction`, draft/private visibility and
  publication status, price `250000` minor units, and quantity buckets
  `1/1/0/0/0`. Candidate state/outcome is `committed`/`committed_private`, and
  session `committed_count=1`.
- At approximately 05:00 UTC, the exact original command was replayed through
  the deployed Edge as the authenticated Owner. The canonical response named
  inventory `5f5a2bc9-d702-4aeb-af55-2a9df6c16478`, candidate version `3`,
  inventory version `1`, and outcome `committed_private`.
- Post-replay readback found one inventory row for the candidate, session
  `committed_count=1`, one completed idempotency row, one audit log, and one
  event. The replay created zero new effects. Verdict:
  `UNIT_7A_LIVE_PROOF_PASS`; the
  `UNIT_7A_LIVE_PROOF_BLOCKED_BY_UI_AVAILABILITY` gate is cleared.
- `Thinking, Fast and Slow` in the same session remains uncommitted
  (`review_ready=false`) and is not part of this proof. Supabase reported an
  existing RLS-disabled advisory for three registry/system tables; no
  remediation was applied.
- Next authorized action: Unit 7B publication requires separate authorization.
  Unit 7C post-commit edits, manual RPC fallback, and merge to `main` remain
  separately gated; no further Unit 7A runtime action is authorized.

### 2026-08-13 — bounded Unit 7B latest-subscription correction

- Scope: correct only the shared M40 subscription eligibility predicate and add
  the stale-history regression. No other Unit 7B behavior was changed.
- Red-first: the new CORR-001 case failed when the latest subscription was
  `cancelled` and an older row was `trialing`; public detail remained visible.
- Correction: the shared predicate now selects the latest subscription by
  `updated_at DESC, id DESC` and requires its status to be allowed. The same
  primitive covers publication and public discovery.
- Verification: correction matrix **6/6**; migration assertions **4/4**;
  Owner-publication, discovery, and worker suites **20/20**; `git diff --check`
  PASS.
- External state: no Supabase access, migration application, deployment, or live
  proof occurred. The correction commit is integrated on the feature branch;
  pre-existing `docs/codemap/` remains untouched.
- Next authorized action: exact-SHA release verification; connected preflight and
  live release gates remain separately unauthorized.

### 2026-08-13 — Unit 7A quality handoff correction (M41 local gate)

- Root cause accepted: M39's authoritative candidate commit omitted
  `listing_quality_status`, so the Phase 3 default `missing_metadata` survived
  and M40 correctly rejected publication.
- M41 derives the status from the server-held row only for candidate-derived
  image-extraction inventory. Incoming quality values are ignored; incomplete
  metadata, price, condition, sellability, and damaged-copy media map to the
  existing controlled statuses rather than being blindly marked `ready`.
- The M40-origin projection trigger now observes quality changes. A published
  row downgraded from `ready` transitions to blocked/private before refresh so
  its projection retracts.
- Backfill is deterministic and provenance-bounded; legacy manual and
  metadata-import rows are excluded and no blanket `ready` update exists.
- Verification: new seam 4/4; Unit 7A 13/13; Unit 7B 12/12; migration
  assertions 7/7; `git diff --check` pass; M01-M40 byte-unchanged.
- Narrow M41 review: pass. Database/storage mutation: none at this checkpoint.
  The Owner reports M39/M40 live; connected readback remains required before
  applying M41 exactly once.

### 2026-08-13 — M41 connected application and Unit 7B resume attempt

- Exact project verified: `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`,
  `ACTIVE_HEALTHY`. Migration history showed M39 once at `20260812003419`, M40
  once at `20260813000040`, and M41 absent before application.
- M41 applied exactly once through the Supabase migration workflow and read back
  once as `20260813070104 marketplace_phase9_unit7a_quality_handoff`.
- Deterministic backfill changed exactly three candidate-derived DEV rows from
  `missing_metadata` to `ready`: `461fa328-d95b-4573-965a-1eaa4be61ba1`,
  `5844d7e2-86ee-4256-bd85-6030ff80ed6a`, and
  `5f5a2bc9-d702-4aeb-af55-2a9df6c16478`. All remained draft/private. No
  manual or metadata-import row was targeted.
- Trigger readback confirmed the Unit 7A insert derivation trigger, quality
  downgrade transition trigger, and M40-origin projection trigger including
  `listing_quality_status`.
- Runtime resume blocker: local Supabase CLI lacks an access token; the connected
  Edge deployment API first rejected an incomplete dependency bundle and then
  returned transport HTTP 403 while retrying the complete bundle. No successful
  Edge version was reported. Render workspace `tea-d9j67irtqb8s739ritc0`
  contains metadata, vision, and media services but no publication-worker
  service. No new Render service was invented and no direct-SQL live proof was
  substituted for the required runtime path.
- Live Publish -> Discover -> Pause -> Republish: `NOT_RUN/BLOCKED_RUNTIME`.

## 2026-08-15 — Unit 7C WU4 validated-finding correction (local, uncommitted)

- Scope was limited to the five independent WU4 findings F-01 through F-05.
  M39–M44 remain byte-identical; the local M45 candidate now binds bounded
  `add|replace` operation identity and the exact replacement link, orders and
  limits history before aggregation with a positive detail/payload allowlist,
  and reorders only approved/eligible media.
- Verification: TypeScript (`npx.cmd tsc --noEmit --allowImportingTsExtensions`),
  Deno (`deno check --config supabase/functions/phase9-owner-ingestion/deno.json
  supabase/functions/phase9-owner-ingestion/index.ts`), focused Jest/Edge/client/UI
  68 passed with 4 pre-existing skips, Unit 7B/Unit 7C WU1–WU3 disposable
  regressions 30/30, and the exact M45 disposable PostgreSQL media/history
  vertical 12/12. `git diff --check` passed.
- External state: no connected Supabase or Storage access, migration application,
  deployment, provider call, stage, commit, push, or PR occurred. `docs/codemap/`
  remains user-owned, untracked, and untouched. The formal WU3 tracker status is
  retained until this uncommitted WU4 candidate receives separate commit and
  application authorization.
- Exact next authorized action: stop for independent handoff; obtain separate
  authorization before staging/committing or applying M45. Browser E2E and WU5
  remain out of scope.

## 2026-08-15 — Unit 7C WU5 Owner Store View cutover (local, uncommitted; superseded by 2026-08-16 closeout)

- Scope was limited to the Owner navigation/product-flow cutover: the primary
  tabs are now Dashboard, Inventory, Store View, Orders, and Subscription;
  Storefront is a compatibility redirect to secondary Store Profile settings;
  and Inventory retains intake/review/recovery context without duplicate rich
  publication, stock, edit, or media-management controls.
- Successful Add to Inventory responses expose `Continue Reviewing` and
  `View in Store View` only after authoritative commit resolution. The latter
  uses the exact returned `inventoryId` for the existing
  `/(store-owner)/store-view/[inventoryId]` route; no `listingId` lookup or
  management route was introduced. Failure/retry behavior remains unchanged.
- Verification: focused Owner/Inventory/Store View coverage is 10 suites/53
  tests; local in-app browser checks cover primary navigation, Inventory role,
  Store View access, and the mobile-sized viewport; Expo web export passes.
  The project Playwright CLI is `NOT_RUN_ENVIRONMENT` because Node fails with
  `EPERM` while `lstat`-ing `C:\Users\user`; the in-app browser manual checks
  pass.
- Boundary: no backend/Edge/database behavior, migration bytes, connected
  Supabase/Storage state, deployment, provider call, stage, commit, or push
  changed. M39–M44 remain byte-identical; M45 remains the exact WU4 candidate;
  no M46 exists; and `docs/codemap/` remains untouched and untracked.
- Exact next authorized action: obtain separate authorization to commit the
  exact proven WU5 vertical; do not apply M43/M44/M45, mutate connected
  Supabase/Storage, deploy, push, or begin integrated Unit 7C review.

## 2026-08-16 — Unit 7C WU5 commit and M43–M45 application closeout

- Authorized scope: commit the exact proven WU5 Owner navigation/Inventory
  cutover and apply the three pending Phase 9 forward migrations to the exact
  verified development project. No push, deployment, Edge change, or business-
  row mutation was authorized or performed.
- Commit: `380f2b3` (`feat(phase9): cut over owner navigation to store view`),
  containing 22 WU5 files. Untracked `.zcode/` and `docs/codemap/` remain
  preserved and unstaged.
- Migration ledger/readback: local M43
  `20260814000043_marketplace_phase9_unit7c_inventory_management.sql` applied
  exactly once as live version `20260816122822`; local M44
  `20260814000044_marketplace_phase9_store_view_filter_contract.sql` applied
  exactly once as `20260816122901`; local M45
  `20260815000045_marketplace_phase9_unit7c_media_history.sql` applied exactly
  once as `20260816122929`. M39–M45 remain byte-immutable; no M46 exists.
- Live readback: `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` remained
  `ACTIVE_HEALTHY`; the revision table has RLS enabled and zero rows; 11 public
  Unit 7C functions and 5 security helpers exist; both media capability columns
  exist; inventory/listing counts remain `10/9`; and no Storage object changed.
- Verification actually run: focused Jest 10 suites/67 tests; disposable
  Unit 7C M43–M45 integration 30/30; Expo web export pass; continuity validator
  pass. Full TypeScript remains blocked by the unchanged WU4 E2E typing error
  in `e2e/store-view-wu4-resilience.spec.ts`. Supabase security/performance
  advisors were rerun: expected RLS-without-policy INFO notices, authenticated
  SECURITY DEFINER RPC WARN notices, media foreign-key index INFO notices, and
  the pre-existing `spatial_ref_sys` RLS ERROR remain; no remediation was
  applied in this session.
- Next exact authorized action: obtain separate authorization for integrated
  Unit 7C review and connected Edge→DB verification. Deployment, push, and
  business-row mutation remain separately gated.

## 2026-09-16 — Unit 6G bounded post-scan UI correction (local)

- Confirmed and corrected only the post-scan issues within the Unit 6G compact
  card contract: bulk-action overlap, blank title editing, missing accessible
  author controls, read-only secondary fields, incomplete damage detail
  editing, and enabled Add on invalid drafts.
- Verification: focused Jest 7 suites/81 tests PASS; TypeScript PASS; diff
  check PASS; local mobile/desktop browser verification PASS. Existing
  VirtualizedList `act(...)` and Node `DEP0040` warnings remain tooling
  warnings.
- Boundary: no Supabase/Storage/database/provider/migration/deployment or live
  scan mutation; nothing staged, committed, pushed, merged, or opened as a PR.
  The global Phase 9/Unit 6H status and connected-proof gate are unchanged.
- Next exact authorized action: independent owner review of this local diff;
  obtain separate authorization before staging/committing, deploying, or
  running connected proof.

## 2026-09-21 — Unit 6G post-scan UI polish and draft feedback (local)

- Scope remained limited to the approved compact post-scan card contract in
  Unit 6G SDD §§8–9.1, §12, and §21. The correction adds field-level draft
  validation, status/attention feedback from the current mounted draft,
  clearer inline title/author editing cues, calmer secondary action hierarchy,
  and precise invalid custom-price guidance. Cover fallback, edition
  selection, backend, migration, deployment, and connected-data behavior were
  not changed.
- Verification: focused Image Inventory Jest **7 suites / 96 tests PASS**;
  TypeScript `npx.cmd tsc --noEmit --allowImportingTsExtensions` PASS;
  `git diff --check` PASS; full Jest **304 suites PASS / 1 skipped,
  2,485 passed / 4 skipped tests (2,489 total)**. The attempted live browser
  opening was interrupted before visual acceptance; no browser-pass claim is
  made for this polish.
- Boundary: no Supabase/Storage/database/provider/migration/deployment or
  live scan mutation; the local Expo server was stopped; nothing was staged,
  committed, pushed, merged, or opened as a PR. Existing dirty worktree
  changes were preserved.
- Next exact authorized action: independent owner review of the local diff;
  obtain separate authorization before staging/committing, deploying, or
  running connected proof.


## 2026-09-21 — Price, condition, and quantity control refinement

- User-authorized scope: Unit 6G SDD §§8–9.1, §12, §21 compact-card controls.
  Extracted InlineReviewValueFields into a cohesive component. Price/condition
  use labeled 48px fields and one mutually exclusive full-width editor with
  wrapping selected-state options. Quantity uses one bounded minus/value/plus
  group; source markers and strict price serialization are preserved.
- Custom amount has a persistent bordered input, currency prefix, Apply action,
  and validation. The list preserves handled keyboard taps. Editors remain in
  normal scroll flow; the bulk footer is a sibling of the list, not an overlay.
- Verification: affected card/screen Jest 3 suites/58 tests PASS; TypeScript
  PASS; diff hygiene PASS. Additional editor-state regression recorded in the
  test suite. Browser reconnect timed out twice; current mobile/desktop visual
  acceptance remains unverified. No database/storage mutations or deployment.
- Existing user changes preserved; nothing staged, committed, or pushed.
  Next action: visual acceptance of the local controls when browser access
  resumes. Cover/metadata and edition-selection work remain deferred.
## 2026-09-22 — Compact identity editor refinement

Owner-authorized visual refinement under Unit 6G SDD §§9–9.1 and §21:
restored pencil icons beside title/author values, replaced stacked author
removal buttons with accessible 44px inline icon controls, and grouped Add
author/Done in one compact footer. Existing ordered-author limits and local
draft semantics remain unchanged. Implementation:
`InlineBatchReviewFields.tsx`; interaction coverage:
`postScanUiCorrections.test.tsx`.

Verification: focused card/correction Jest 2 suites, 44 tests PASS; TypeScript
PASS; Phase 9 continuity validator PASS (existing document-size advisories).
No database, Storage, inventory submission, migration, deployment, staging,
commit, or push. Existing unrelated edits preserved. Next action: owner
review of the revised card; native-device acceptance remains unverified.

## 2026-09-22 - Connected post-scan cycle and bulk-commit audit

- Under explicit Owner authority to add multiple development books, the
  mounted post-scan flow displayed the exact-two confirmation and committed
  both eligible candidates independently. The result was `Added 2`, with zero
  retryable, no-longer-eligible, needs-attention, pending, or busy outcomes.
- Verified readback for session
  `93567d47-3874-4576-b3b4-1adb044b552b` is two committed candidates and three
  candidates still in review. The created private inventory rows are
  `413563b1-a869-4182-8aef-4e62ce4cfebf` (`The Birth of Tragedy`, test price
  INR 0, Good, quantity 1) and `46156eae-58a7-4db7-ad5b-a4cb1eb0b98f`
  (`Thinking, Fast and Slow`, test price INR 250, Good, quantity 1).
- Final publication state is safe: both rows are draft/private and the public
  listing count for the tested item is zero. During Store View control testing,
  `Publish` executed immediately with no confirmation. The same item was
  restored immediately through `Make Private`; the immutable publish/private
  audit entries and one public revision remain as required history.
- Confirmed defects/risks: title/author `Done` can create a false Custom edit
  without a value change; private Store View ignores the valid persisted
  inventory `cover_url` because cards read only `publicState.coverUrl`; the web
  `6000ms timeout exceeded` toast originates in Expo Font/fontfaceobserver; and
  Session Summary plus Full Review each had one transient first-read failure
  that recovered through their visible Retry actions.
- No candidate or inventory row was deleted; the session remains active. No
  Storage object, provider call, migration, deployment, staging, commit, push,
  merge, or PR changed in this audit.
- Session-close verification: Phase 9 continuity validator PASS and repository
  `git diff --check` PASS; existing document-size and LF/CRLF advisories remain.

Next exact authorized action: Owner disposition of a bounded correction set
for Publish confirmation and no-op title/author edit guards. The private Store
View cover projection remains a separate, deferrable DTO/RPC decision; the
transient first-read failures and font-loading toast require separate diagnosis.



## Historical Clubs evidence imported during 2026-10-17 integration

The following records describe their original October checkpoints. The current
Clubs publication state is owned by docs/user/clubs/TRACKER.md. Earlier M62
and publication-blocked wording does not supersede the newer Phase 9 Unit 6G
Open Library records retained above. No migration is reapplied by this merge.

> **2026-10-08 local commit checkpoint:** User-authorized navigation checkpoint 4e1aa35 and primary corrections/applied-migration evidence 542b90f are committed. Remaining review documentation is checkpointed separately. Two P2 navigation findings still block publication; next action is correction, regression/browser verification and independent rereview. No push, deployment or database mutation in this commit step. Earlier test evidence was not rerun.

> **2026-10-08 aggregate Clubs review:** Full unpublished-set GPT-6 Luna max review
> found two return-context integration defects; Clubs publication is blocked until
> corrected and independently rereviewed. See [review](../../../user/clubs/AGGREGATE-PUBLICATION-REVIEW-20261008.md).
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
> [Clubs migration closeout](../../../user/clubs/PRIMARY-VENUE-MIGRATION-REVIEW.md). Next: exact local-diff review for a
> separately authorized scoped commit; do not reapply the migration.


> **2026-10-08 aggregate-review correction:** Clubs owner/archive selection gating,
> lost-response reconciliation and external-removal focus recovery are corrected
> locally. Fresh Manage/service tests 135/135, TypeScript, web export and local
> PostgreSQL policy-proposal checks 61/61 pass. Luna max scoped rereview found no
> actionable residual defect. Read-only live catalog inspection confirmed direct
> primary-write policy bypasses; forward-migration creation/application approval
> is pending. No live writes or Git publication occurred. See the
> [Clubs correction record](../../../user/clubs/TRACKER.md). Phase 9 Unit 6H and M62 runtime rollout /
> connected proof pending status remain unchanged.


> **2026-10-08 Clubs follow-up:** User-approved venue Remove confirmation and
> real QueryClient race coverage are implemented locally. Desktop/mobile keyboard
> checks passed. Club/account web focus handoff is now corrected locally;
> spoken screen-reader checks are excluded by the user. Connected primary-selection
> proof remains unverified. See [Clubs tracker](../../../user/clubs/TRACKER.md). Phase 9 M62 rollout status is unchanged.
> No new database mutation, migration, Git publication, or deployment occurred.


> **2026-10-07 bounded Clubs UI correction:** Separately authorized local
> Manage Venues lifecycle corrections preserve pending/recovery feedback and
> isolate old responses across club/account changes. No Phase 9 runtime,
> schema, migration, deployment, or M62 evidence changed; the gate remains
> `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`. Correction verification,
> residual visual/connected gaps, and the exact next action are owned by
> [the Clubs app review](../../../user/clubs/PRIMARY-VENUE-APP-REVIEW.md#bounded-ui-correction-2026-10-07).

> **2026-10-07 cross-feature Clubs UI follow-through:** The separately
> authorized Clubs Manage Venues review updated only Clubs screen code/tests
> and Clubs documentation. No Phase 9 behavior, runtime, deployment, migration,
> database/Storage state, or M62 gate changed. The focused Clubs screen suite
> passes 46/46; actual admin-screen desktop/mobile browser review remains
> outstanding because the available seeded identity is a member. Clubs detail
> and next action are owned by
> [the Clubs app review](../../../user/clubs/PRIMARY-VENUE-APP-REVIEW.md).

> **2026-10-07 cross-feature Clubs migration:** The corrected primary-venue
> migration was applied separately to `ahntbtktjjmvfosgkmgn` as
> `20261007144356 clubs_admin_primary_venue`, with matching local filename and
> post-apply catalog readback. This did not modify Phase 9 schema/runtime or M62;
> the M62 gate remains `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`. The
> shared repair set and pending July Clubs/Exchange migration remain untouched.

> **2026-10-07 scoped Clubs correction:** The user authorized correcting four
> findings in the unapplied Clubs primary-venue artifact and disposable fixture.
> PostgreSQL 17.6 passes 49/49 with verified local teardown; syntax, diff hygiene
> and continuity validation pass. No Phase 9 runtime, migration, database/Storage,
> deployment or Git publication changed. Phase 9 remains
> `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`; its authorization gate is
> unchanged. Clubs scope, concurrency limits and next action (user review of the
> corrected local artifact) are owned by
> [the Clubs review record](../../../user/clubs/PRIMARY-VENUE-MIGRATION-REVIEW.md).

## 2026-10-13 — Connected Owner edition-picker live proof

Phase 9 / Unit 6G remains active. The authenticated fresh-session path completed through explicit Open Library Search Books, Owner selection, and private Add for one card. The supplied image had been used before and the app's duplicate guard was acknowledged through Proceed; this proves the fresh-session workflow on a repeated image, not a unique-photo run. Seven books were detected, one was added, and six remain in the open session for Owner review.

Supabase readback confirms the selected 1966 Penguin Books `A Hundred Years Of Philosophy` record is committed privately/draft at ₹25, quantity 1, Good, shelf `Phase9 proof shelf`; unused alternatives were cleared while the chosen metadata snapshot was preserved. The earlier expired 5/5 edition job remains unchanged and M75 is not created/applied. Detailed evidence: [tracker 37 §26](trackers/37-owner-edition-picker-open-library-local.md).

Next exact authorized action: Owner direction on the six remaining cards and separate authorization for the proposed M75 recovery correction. No M75 creation/application, runtime deployment, or publication is authorized by this test.

## 2026-10-13 further edition-selection review; implementation held

Owner-requested read-only review completed; tracker37 §32 records current source evidence and recommendations. Prioritize discovery of eligible results beyond the first five and appropriate recovery after selection errors as small client improvements. Precise disabled reasons and supplied edition/format display remain optional/deferred; cover absence already permits selection. No product behavior/source/test/schema or shared-state change and no new functional test claim. The title SQL proposal/local worker patch remain retained and unreleased under the §31 decision. Exact next action: present the recommendations, retaining all migration/publication/deployment holds pending later Owner direction.

## 2026-10-13 supplemental Open Library download inspection

Read-only local inventory/headers and database-format advice recorded in tracker37 §41. Torrent remains downloading; all sampled .gz prefixes zero, so no actual book record/completion/integrity proof. No import/installation or product architecture adoption. Main active work unit owner_edition_picker_four_corrections_local_complete_sql_proposals_retained and next Owner review of local corrections/proposals remain unchanged; SQL/refresh/publication/rollout held, M65-M74 unchanged and M75 deferred. Next research step after Owner confirms completion: validate core files and inspect a bounded real-record sample.

## Supplemental Supabase catalogue and second-hand covers research

Tracker37 §42 records read-only actual Free capacity/relation-name checks and conceptual same-provider catalogue/import/cover recommendations. Owner means second-hand books of any age; no publication-year cutoff, no catalogue/hosting/schema/source-policy adoption. Main active work unit and next Owner review of local corrections/proposals unchanged; SQL/refresh/publication/rollout held, M65-M74 unchanged/M75 deferred. Next research task after completion is core-file validation and bounded cross-year factual/cover/capacity sample; no import or paid project created.

## 2026-10-14 supplemental catalogue size/free hosting/search research

Tracker37 §43 records compressed/duplicate source versus unknown indexed catalogue size, fresh whole-app size/installed pg_trgm and current free-host options. Advice only; no architecture/provider/schema adoption. Main active work unit and next Owner review of local corrections/proposals unchanged, SQL/refresh/publication/rollout held, M65-M74 unchanged/M75 deferred. Next research task after completion: validate core files and measure bounded factual/index size, coverage and query performance before hosting choice.

## 2026-10-14 supplemental Pro capacity and spine-photo retrieval clarification

Tracker37 §44 supersedes prior research ISBN-first wording for spine-photo input: OCR title+author is primary,ISBN supplementary. Pro disk/compute budgets are illustrative advice; no new behavior/schema/retention/hosting adoption. Main active work unit/Owner-review next action and SQL/refresh/Git/rollout holds unchanged, M65-M74 unchanged/M75 deferred. Next research task after completion: validate core files and measure bounded title/own-author retrieval, retained/index size and query performance for disk/compute choice.

## 2026-10-14 supplemental catalogue hosting/subset research

Tracker37 §45 records hosting alternatives and field/row reduction with own-author referential closure and subset coverage limits. Conceptual advice only,no criteria/schema/retention/host/integration adoption. Main active work unit/Owner-review next action and all SQL/refresh/Git/rollout holds unchanged,M65-M74 unchanged/M75 deferred. Next research task after completion: validate core files and measure bounded title/own-author factual/index size,joins/cover coverage and query performance for scope/hosting choice.

## 2026-10-14 supplemental local partial-import feasibility

Tracker37 §46 records installed PostgreSQL tools and conceptual selected-row testing. No server/database/import started,no setup readiness/benchmark claim or new filter/architecture adoption. Main work unit/Owner-review next action and all SQL/refresh/Git/rollout holds unchanged,M65-M74 unchanged/M75 deferred. Next research task after completion remains core validation and bounded factual/index sample measurement.

## 2026-10-14 supplemental local catalogue search/resource research

Tracker37 §47 records actual low available RAM/current disk headroom and unmeasured small-pilot latency target. No catalogue/import/query benchmark,new latency requirement or host/schema/source adoption. Main work unit/Owner-review next action and SQL/refresh/Git/rollout holds unchanged,M65-M74 unchanged/M75 deferred. Next research task after completion remains bounded factual/index/coverage/query-resource measurement using conservative streaming and low concurrency.

## 2026-10-14 - Supplemental local catalogue pilot in progress

Owner approved a standalone local feasibility probe. Experimental PG18.4 cluster at E:/Books/metadata-pilot is loopback/SCRAM only; source archives remain untouched, bounded extraction is running, and initial pilot tests14/14 pass. Next research action: complete bounded import and measure actual query/coverage/disk/memory results before considering a full import. No shared product/source/migration/deployment change. Main Phase9/Unit6G four-correction release work unit/Owner-review handoff and all holds remain unchanged. Detailed scope/authority/evidence: tracker37 §48; pilot is not production integration.

## 2026-10-14 - Supplemental local catalogue pilot complete; Owner review next

Approved supplemental catalogue pilot is complete on an isolated C: loopback PostgreSQL database after an E: interruption; Owner reported their own error and all four E: archive bounded rechecks succeeded. Complete editions/authors streams scanned;51,816factual editions/47,994own authors retained,17/17tests PASS after load/restart. Original seven title+author OCR queries all retrieve candidates,warm CLI medians113–271ms; database~73.09MiB,importer peak206MiB. Full-size/performance not measured; extrapolated relations/index size~64.52GiB plus staging/WAL/temp/reserve, not a guarantee. Main Phase9/Unit6G four-correction local-complete work unit and all SQL/refresh/publication/rollout holds remain unchanged,M65–M74 immutable/M75 deferred. No shared mutation/formal migration/publication/deployment. Detailed actual scope/authority/mutations/proof/limits: tracker37 §49 and C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/REPORT.md. Exact next supplemental action: Owner review of pilot proof/full-build recommendation; full import and product integration require separate direction. Loopback C: pilot remains runnable; no new production architecture adopted.

## 2026-10-14 - Raw source expansion quantified; direct streaming remains recommendation

Owner-requested read-only storage clarification complete:the four current E:archives expand to92.13GB/85.80GiB; keeping compressed+expanded files takes109.68GB/102.14GiB. E:currently111.63GiBfree with compressed files present; full expansion alone leaves25.83GiB, before an indexed database. Pilot remains51,816editions, seven photographed titles are test queries, other source rows unchanged. Recommend later separately approved direct streaming import to avoid complete raw copies; full database size/performance unmeasured. Cover file has IDs/dimensions/date; actual images are separate. No raw files extracted, database/production/shared/service/Git state changed. Main Phase9/Unit6G four-correction local-complete work unit and all holds unchanged. Detailed measurement/method/authority/proof:tracker37 §50 and C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/EXPANDED-SIZE.md. Exact next supplemental action remains Owner review of full-import scope/storage; no full import authorized/started.

## 2026-10-14 - Full-import estimate scope and catalogue identity clarified

Supplemental identifier/search/capacity clarification complete. Edition OLID is the pilot primary key; ISBN can repeat across source IDs, cover ID identifies an image, BookConnect internal canonical/inventory IDs are UUIDs verified by fresh exact-project PK/schema SELECT. Current64.52GiBestimate applies only to projected editions/authors/search/indexes; importing full works/descriptions/all four-file fields is unmeasured. Fresh Supabase org Free and DB282.92MB; Free500MBcannot fit full catalogue, cloud quota independent of E:111.63GiBfree. No full import, purchase/plan/account change, source/product/schema/DB/Storage/provider/business/Git/deployment mutation. Main Phase9/Unit6G four corrections locally complete and all holds unchanged. Detail/authority/evidence:tracker37 §51 and C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/IDENTIFIERS-SEARCH-CAPACITY.md. Exact next supplemental action remains Owner review of full-import fields/storage and separate direction.

## 2026-10-14 - Full local catalogue intent; E:filesystem warning is supplemental readiness blocker

Owner clarified own full PostgreSQL catalogue on E:and later source deletion after validation; cloud hosting is out of scope. Read-only feasibility complete:new fresh E:NTFS Warning/Full Repair Needed plus fsutil Dirty;physical USBdevice reportsHealthy,not a hardware-failure diagnosis. No repair/full import/delete started. Current111.63GiBfree/partial64.52GiBcatalogueestimate does not prove all-fields/index/temp/backupfit or full E:performance. C:sourcecopies present; working bounded pilot unchanged. Supplemental readiness warning must be addressed before long write-heavy build. Exact next supplemental action:Owner review of E:warning and local-only feasibility,then direction on whole-volume diagnostic/repair before full-plan/build. Detail/authority:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/FULL-LOCAL-CATALOGUE-FEASIBILITY.md and tracker37 §52. Main Phase9/Unit6Gfourcorrectionslocalcomplete workunit/releasehandoff and all holds unchanged;M65–M74preserved/M75deferred. No DB/source/storage/service/system/Git/deployment mutation or cloud connector call.

## 2026-10-14 - Diagnosis only authorized; local source audit running before full indexed build

Owner explicitly held filesystem repair after read-only chkdsk E:found NTFSdirectory-index errors/exit3; no repair/delete/heavyE:build. Local validation before later rented-server deployment clarified. Existing ScoopPostgreSQL18.4 used to initialize experimental E:cluster; completed51,816edition/47,994author pilot is onC:,notE:. New read-only uniqueness/join/missingness and12additionaltitle+author retrieval consistency checks PASS; sourceIDhelper5/5RED->GREEN. Full four-file C:archive quality audit running, no complete-source/full-scale search claim. Exact next supplemental authorized action:complete running read-only audit/report; full indexed build needs healthy adequatecapacityvolume, repair remains held. Evidence:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/LOCAL-READINESS.md and tracker37 §53. MainPhase9/Unit6Gworkunit/releasehandoff unchanged, SQL/refresh/Git/rollout holds preserved,M65-M74immutable/M75deferred. No shared/formalmigration/appcode/cloudconnector/Gitpublication/deployment/systemrepair/source deletion; only evidence/continuity files and read-only checks.

## 2026-10-14 - Full source audit complete; repair and full indexed build remain held

Supplemental full C: source audit complete:56827250editions/15446415authors/41666337works/14938996cover metadata rows, allgzipEOF/CRC/UTF8 and prior decoded-size readback verified; no JSON parse failures/duplicate validated IDs. Metadata flags explicit:7edition identity mismatches,5700additional projector exclusions,70missing own-author IDs/2321withoutprojectable name,446missingwork IDs,77789coverdimension flags. Every selected positive own cover ID has metadata; image HTTP availability untested. Audit4262s/126.3MiBpeakRSS, no raw expansion saved. Actual51,816edition C:pilot remains separate;12additional title+author retrieval consistency queries pass, full indexed performance/production concurrency/restore unrun. E:repair explicitly held afterread-onlyCHKDSKexit3; no full E:build/delete. Next supplemental authorized action:Owner review of source proof/full-import accounting scope; full indexed build requires healthy adequatecapacityvolume. Evidence:C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/local-catalogue-pilot-20261014/LOCAL-READINESS.md and tracker37 §54. MainPhase9/Unit6Gworkunit/releasehandoff and all SQL/refresh/Git/rollout holds unchanged,M65-M74immutable/M75deferred. No appcode/sharedschema/DB/provider/cloudconnector/formalmigration/Gitpublication/deployment/systemrepair/source deletion.

## 2026-10-15 - Supplemental full E: metadata catalogue importing; repair held

Owner now directs proceeding on E: and chose all books with main metadata; later correction says ignore C:. E: pilot restore/restart verified 51,816 editions/47,994 authors and three identical digests, 12 known title+author searches and zero-result negative control. E: filesystem warning remains; repair/deletion held. New isolated full metadata_catalogue cluster on E:/Books/metadata-full-20261015, loopback 55434, SCRAM/owner ACL and normal durability ON. Full import from E: archives is running in 200,000-row atomic batches with 15 GiB reserve. Windows Ctrl-Z COPY failure reproduced, first 200,000 committed author rows/checkpoint preserved, octal escaping corrected RED→GREEN and resumed; 11 unit tests and actual PostgreSQL import/rollback proof PASS. Full ingestion/indexed-size/search/restart completion is pending. Next supplemental action: complete/checkpoint four E: streams, index titles/authors and verify full counts/metadata/sizes/timings. Evidence C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/full-catalogue-20261015/PLAN.md, progress.json, build-resumed.log and tracker 37 §55. Main Phase 9 / Unit 6G four-corrections local-complete/retained-SQL workunit and all SQL/refresh/release/Git holds unchanged. Local E: DDL/data mutation only; no Supabase/Storage/provider/appcode/formal migration/shared mutation/Git publication/deployment; M65–M74 immutable/M75 deferred.

## 2026-10-15 - E: full catalogue import paused at repeatable read error

E: Full catalogue experiment paused at verified read error. PostgreSQL autovacuum and a read-only targeted row scan failed on authors relation base/16384/16467 block2450. Separate Windows read-only file access failed with EIO; Win32 code23 resolves to "Data error (cyclic redundancy check)". This proves that the block cannot currently be read; it does not diagnose the hardware or all of E:. Import client stopped. E: durable checkpoint: authors 15446415 rows / EOF verified; works 600000 of 41666337; editions/covers/indexes/search not started. Database cannot be reported as a validated searchable full catalogue. No filesystem repair/deletion; prior diagnosis-only repair decision remains. Next safe step: continue read-only E: diagnosis and require a separate explicit Owner direction before any filesystem repair or retrying bulk reads. Proof C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/full-catalogue-20261015/io-probe-results.json and tracker37 §56. Phase9/Unit6G implementation handoff and all existing release/migration/Git holds unchanged; no C: database/source work.

## 2026-10-02 — Library aesthetics session evidence (separate scope)

The user-authorized Library checkpoint is complete locally: shared Home appearance,
labeled Shelf/List selection, filters/count before both collections, and cabinet
material. See [Library SDD-05 §14](../../../user/library/SDD-05-library-reading-room.md)
and [Library tracker](../../../user/library/TRACKER.md) for the owning scope and
acceptance/source traceability. Focused Library Jest is **47/47, 6 suites**;
Expo web export passes; live browser review used 320/390px phone and 1280px
desktop widths. Full TypeScript still reports **36 existing errors outside
Library, zero Library errors**. Earlier workspace changes are preserved.

This note does not change Phase 9's active unit
`unit7c_resumed_connected_canary_pass_main_integrated`, M46/canary status, DOC-13,
or external-mutation authority. No database/Storage write, migration, deployment,
dependency change, stage, commit or push occurred. Library's exact next action
is review of the first checkpoint capture before selecting a subsequent polish
unit. Phase 9's next authorization gate remains the current post-canary overlay.

## 2026-10-03 — Scoped independent Library review

The separately requested Library code/visual review is recorded in [the independent review](../../../user/library/INDEPENDENT-REVIEW-20261003.md). It qualifies the earlier checkpoint with List nesting, spine contrast, existing filter-count mismatch, brush-height and web-target findings. Geometry/data/routes/persistence pass within stated evidence; native verification remains open. Review-only application/live data scope preserved. This note does not advance or reopen Phase 9: active work unit remains `unit7c_resumed_connected_canary_pass_main_integrated`, and next marketplace action remains separate authorization for the next work unit. No additional migration, deployment or connected mutation authority is introduced. Library's exact next action is review of R1–R5 and selection of a bounded correction unit; full evidence/closeout is in its tracker and the scoped verification log.

## 2026-10-03 — Scoped Library review corrections

The ongoing authorized Library implementation corrected R1–R5 locally. Owning
behavior/acceptance is [Library SDD-05 §16](../../../user/library/SDD-05-library-reading-room.md),
with exact scope/evidence/remaining gates in [the Library tracker](../../../user/library/TRACKER.md).
Fresh focused Jest **72/72, 8 suites** and Expo web export pass; full TypeScript
retains **36 unchanged errors outside Library / zero Library errors**. Browser
checks cover 320/390/430px phones, 1280px desktop, both modes/all filters,
keyboard/persistence/detail routing and the new activation chooser. An isolated
1,000-book simulated collection confirms bounded web List rendering; no real
library rows were added. Native-device verification remains NOT_RUN. Library's
exact next action is independent R1–R5 correction rereview before further polish.

Phase 9 remains `unit7c_resumed_connected_canary_pass_main_integrated` with its
existing M46/main-integrated handoff and next-work-unit authorization gate.
DOC-13/ACTIVE and external-mutation authority are unchanged. No database/Storage
write, migration, provider enrichment, dependency change, stage, commit, push,
deployment or application occurred. Existing unrelated changes are preserved.

Correction closeout: continuity validator PASS (195 definitions, zero
duplicates/missing traceability, 76 Markdown files / 55 required phase files);
document-size notices remain advisory. Repository diff check PASS, staged diff
empty. Library source/tests/docs/evidence remain uncommitted; its exact next
action remains independent correction rereview.

## 2026-10-03 — Scoped independent Library correction rereview

The separate Library rereview is recorded in
[`CORRECTIONS-REVIEW-20261003.md`](../../../user/library/CORRECTIONS-REVIEW-20261003.md)
and its current handoff in the [Library tracker](../../../user/library/TRACKER.md).
This is Library-only review work: no Phase 9 requirements, implementation,
migration, live project evidence, status, authority, or next action changed.
Phase 9 remains `unit7c_resumed_connected_canary_pass_main_integrated`; next
marketplace action remains separate authorization for the next work unit. No
database/Storage mutation, deployment, stage, commit, or push occurred.
The mandatory closeout validator still passes: 195 requirement definitions,
zero duplicates/missing traceability, and 76 Markdown files / 55 required Phase
9 files; size notices remain advisory. `git diff --check` passes, and the staged
diff is empty. This scoped note does not alter the marketplace status or
authority.

## 2026-10-03 — Scoped Library entrance-contrast correction

The ongoing Library correction addressed the rereview's one P3 opacity finding.
Owning contract and evidence are [Library SDD-05 §17](../../../user/library/SDD-05-library-reading-room.md)
and [Library tracker](../../../user/library/TRACKER.md). Translation-only entrance
keeps labels opaque; reduced motion starts stationary. Fresh Library Jest
**77/77, 8 suites**, web export and served identity pass; full TypeScript retains
**36 unchanged non-Library diagnostics**. The previously unavailable authenticated
tab is now verified at phone/desktop sizes for both modes, filters, chooser,
persistence and exact detail routing. Native-device acceptance remains NOT_RUN.

Phase 9/M46, `unit7c_resumed_connected_canary_pass_main_integrated`, DOC-13/ACTIVE
and the next-work-unit authorization gate are unchanged. No database/Storage
mutation, migration, provider enrichment, dependency change, stage/commit/push
or external deployment occurred. The existing local Library server was restarted
and left available. Library's exact next action is independent P3 correction
rereview with fresh authenticated evidence before further polish.

Scoped closeout: continuity PASS (195 definitions, zero duplicates/missing
traceability, 76 Markdown files / 55 required files), repository diff check
PASS, staged diff empty. Size notices remain advisory. Changes are local and
uncommitted; global phase/authority and Library's exact next action are unchanged.

## 2026-10-03 — Scoped Library Unit 3 web checkpoint

Library's approved Unit 3 is recorded in [SDD-05 §18](../../../user/library/SDD-05-library-reading-room.md)
and [its tracker](../../../user/library/TRACKER.md): vertical spine typography/edge
refinement plus a saved full-title/author caption on hover, keyboard focus, and
press, reusing the existing chooser and detail route. Focused Jest passes **34/34
across 3 suites**; a fresh Expo web export and authenticated browser caption/detail
checks pass. Full TypeScript still has **36 diagnostics outside Library**. Native
and standalone hover verification remain NOT_RUN. No data/schema/Storage write,
migration, dependency change, or external action occurred.

This scoped Library work does not change Phase 9/M46, its active marketplace unit,
DOC-13/ACTIVE, or migration authority. The P3 rereview was deferred by the user;
Library's exact next step is to review the current caption and choose Unit 4 or
the separate Horizontal Stacks work. Changes remain local and uncommitted.

## 2026-10-03 — Scoped Library vertical realism checkpoint

The user-approved personal Library pass is recorded in SDD-05 section 19 and the Library tracker. Two existing components and their geometry regression refine board thickness, contact shadows and rounded spine shading. Cabinet height remains 440px; book metrics and routes remain. Focused Jest: 63 tests / 3 suites PASS; fresh Expo web export PASS. Authenticated browser checks at 320/390px and desktop show grounded rows and no page horizontal overflow. Native and full TypeScript checks were NOT_RUN in this pass. Earlier workspace changes remain; this pass is uncommitted. No database/Storage mutation, migration, stage, commit, push or deployment occurred. Phase 9/M46, the active marketplace unit, DOC-13/ACTIVE and authority are unchanged. Library next action: user reviews this realism checkpoint before selecting another refinement.

## 2026-10-03 — Scoped Library Arrange design continuity

The user accepted the vertical realism source and requested local commit `60ac8dd`; exactly the two shelf components and their regression test were committed, with no push. That supersedes the earlier scoped checkpoint's uncommitted source status; existing documentation/evidence and unrelated work remain local.

The subsequent user instruction is documentation-only: preserve the simplified Arrange architecture for future horizontal sessions. [SDD-05 §20](../../../user/library/SDD-05-library-reading-room.md#20-arrange-shelf-shared-order-separate-dragging-2026-10-03) owns the planned shared Library-ID order/draft/one-step Undo/Save/Cancel layer, separate layout-specific dragging/edge scrolling, and unresolved storage/filter/membership choices. User README, Library tracker, inventory/interaction map, and Horizontal Shelf section 8 route to this design. Arrange/horizontal application implementation and all Arrange acceptance remain pending.

Current scoped Library unit: `library_arrange_shared_order_design_recorded_implementation_pending`. Exact next Library action: resolve SDD-05 §20.4 choices when implementation is authorized and require the horizontal session to read the shared-order design first. No application/dependency change, migration creation/application, live schema audit, database/Storage mutation, stage/commit/push/deploy occurred in this documentation task. App/native tests were not rerun. Phase 9/M46, its marketplace active unit, DOC-13/ACTIVE, next marketplace action, and mutation authority remain unchanged. Documentation validation/diff closeout is recorded in the Library tracker after execution.

## 2026-10-03 — Scoped Library vertical Arrange implementation

The subsequent user request authorizes Library Arrange implementation and explicitly confirms device-only saving. This supersedes the earlier design-only Library handoff; marketplace authority is unchanged. [SDD-05 §§20–21](../../../user/library/SDD-05-library-reading-room.md#20-arrange-shelf-shared-order-separate-dragging-2026-10-03) owns the shared Library-ID order/state/storage and separate vertical dragging; horizontal app presentation remains pending. Read-only Supabase MCP verified `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` and the absence of a manual-order field in the inspected Library schema. No migration or Database/Storage write occurred.

Library verification: 100 tests / 11 suites PASS; zero Library TypeScript errors with 36 unchanged errors elsewhere; fresh web export/served hash PASS; authenticated drag/Undo/Cancel/keyboard/Save/reload and isolated 80-book off-screen edge insertion PASS. Native checks remain NOT_RUN. Raw evidence, exact limits, local preference writes and restored original order are owned by the [Library tracker](../../../user/library/TRACKER.md). No new dependency, staging, commit, push, deployment or application; prior work is preserved. Current scoped Library unit is `library_vertical_arrange_web_checkpoint_ready_for_user_review`; exact next action is user review before further feature authorization, with mandatory shared-state handoff for Horizontal Stacks. Phase 9/M46, its marketplace active unit, DOC-13/ACTIVE and global mutation authority/next action remain unchanged.

## 2026-10-04 — Bounded Library Arrange review correction

The user authorized confirming and fixing only the two independent Arrange findings, then stopping. Both were reproduced by failing regressions before source edits. Vertical drop mapping now bounds the post-removal insertion to the marked tier's final slots; failed pending Save after membership cancellation now reports cancellation rather than promising a retained draft. The documented membership-cancellation policy is preserved. Two source files and two existing test files changed; owning behavior/traceability is in [SDD-05 §21.1](../../../user/library/SDD-05-library-reading-room.md#211-bounded-independent-review-corrections-2026-10-04), and complete verification/limits are in the [Library tracker](../../../user/library/TRACKER.md). Focused tests: 54/54 across 5 suites PASS. Fresh local web export and served bundle identity PASS; no new browser/native proof is claimed.

Current Library unit: `library_arrange_bounded_review_corrections_stop`; exact next action is report and stop, awaiting a new user instruction. Source/tests/docs remain uncommitted alongside preserved earlier changes. No database/Storage/preference mutation, dependency, migration, staging, commit, push, external deployment or application occurred. Phase 9/M46, DOC-13/ACTIVE, marketplace active unit and mutation authority remain unchanged; no global handoff update is needed.

## 2026-10-04 — Scoped Library shelf contact/depth visual pass

User authorized a focused plan and implementation. LibraryShelf adds noninteractive per-book footprints and stronger board top/underside light falloff within unchanged book/cabinet/row geometry. SDD-05 §22 and the Library tracker own behavior, capture and handoff. Existing Shelf/drag tests: 26/26 across two suites PASS; fresh web export PASS. Authenticated browser loaded entry-bbb219bcfc8b2d6b26db027cff288cf3.js; 440px cabinet/eight entries preserved, live selected-book boundary drags both directions and Cancel PASS. No Save/preference/database/Storage write. Full TypeScript/native/performance checks were not rerun. Current scoped unit: library_shelf_contact_depth_ready_for_user_review; next action: user review of the capture. Source/docs/capture remain uncommitted alongside preserved earlier work. No dependency, migration, stage/commit/push/external deployment/application. Marketplace Phase 9/M46, DOC-13/ACTIVE, active marketplace unit and authority remain unchanged. Documentation validation/diff closeout is recorded in the Library tracker.

## 2026-10-04 — Library local commit authorization

The user accepted and explicitly authorized committing the reviewed Arrange, corrected drop/save paths and shelf-contact/depth checkpoint. The scoped commit containing this handoff includes application/test source and Library shelf documentation/evidence; OCR/vault/notes/dependencies/services/migrations remain excluded. Prior app verification is recorded in the Library tracker; this commit transaction checks staged scope, whitespace and documentation continuity. No additional app/native validation is claimed. No push, external deployment, database/Storage/preference write or migration/application. Current Library unit: library_arrange_shelf_local_commit_checkpoint; next action: user selects the next Library unit. Marketplace Phase 9/M46, DOC-13/ACTIVE and authority remain unchanged.
