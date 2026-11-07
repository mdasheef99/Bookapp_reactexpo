# Store View v2 — Tracker

Current state and next action for the Store View v2 lane (branch
`feature/store-view-v2`). Newest entries at the top of the log.

## Current state

- **Scope:** draft feature list only (groups A–F, 33 items). Not final; the
  user finalises it in the SDD.
- **SDD:** [SDD.md](./SDD.md) draft v4, 2026-10-29: third Terra review (9
  findings, all checked in code first) fixed — Slice 0b reorder server fix,
  cache removal on access loss and HTTP 401/403, photo list confirmed with
  the version, offline handling, normalized equality, damage photos from the
  photo list, filter startup vs tap, publication refresh exception.
  Earlier: draft v3, 2026-10-29: Terra re-review of v2
  (13 findings, all checked in code before correcting) fixed in v3: photo
  modal waits for a confirmed version, edit rebase keeps a fixed edited set,
  access-loss hides private data, `numeric` stock total, summary key under
  `'storeView'`, exact grants and wire schema, per-case damage buttons,
  filter-storage races, lane-doc decision plus shared migration ledger.
  Earlier: draft v2, 2026-10-29 (scope, rules, Slice 0,
  Slice 1), revised after a read-only Terra (max) review: fixed photo-version
  and edit-conflict designs, added photo-add refresh, failed-refresh handling,
  filter cleanup, strict rupee input, dashboard definitions/security, approval
  gates, and a PGlite check that adding a damage photo clears the warning.
  Awaiting the user's approval.
- **Code (updated 2026-11-07):** Slices 0a, 0b, 1a, 1b, the
  remove-after-replace fix and the polish pass are merged into `feature/store-view-v2` (nothing
  pushed). Live database: migrations `store_view_slice0b_media_fixes`,
  `store_view_slice1b_summary` and `store_view_remove_after_replace` applied;
  Edge `phase9-owner-ingestion` is v19. See the log below for each.
- **Issues found on 2026-10-29 and their fixes:** the invalidation-key, media/
  history invalidation, draft-wipe and stale-photo-version problems were fixed in
  Slice 0a (tests in `storeViewInvalidation`, `StoreViewEditConflict`,
  `StoreViewPhotoConfirm`). The photo reorder failure on the live database
  (M45 blanks positions, M51's guard rejects) was fixed by Slice 0b, applied
  2026-11-02 and checked live.
- **Decision still to record (SDD §4.2):** the "Add damage details" button on
  the `damage_evidence_required` reason is shown unconditionally and there is no
  "Add damage photo" button, because adding a photo does not clear the warning
  (see 2026-10-29 live check). SDD §4.2 still describes per-case photo buttons.
- **Impact map (2026-10-29 investigation, Muse + GLM, key claims checked):**
  - Store View only: bug fixes, rupee entry (reuse `rupeesToPriceMinor` from
    `imageInventory/scanSetup/scanSetupForm`), dashboard from existing data,
    device-saved filters, one-tap fixes that call existing commands.
  - Shared Edge Function + new RPC: search/sort, server dashboard counts, bulk.
  - Shared with customer marketplace and Phase 6 commerce: sale price,
    campaigns, Deals shelf/banner. Price flows `store_inventory` → trigger →
    `marketplace_book_listings`; orders bind `LEAST(listing price, cart
    snapshot)`, so a sale price added to a cart survives the sale ending.
  - The Phase 9 discovery SDD defers a "promotion/discount presentation engine";
    sale/campaign work needs the user's explicit scope decision in the SDD.
  - Legacy Phase 3/4 bulk publish/pause exists in
    `src/features/stores/components/InventoryBulkActions.tsx`; not Store View,
    not to be reused without review.

## Next action

Polish pass and pre-merge review fixes merged and verified (2026-11-07). The
branch is ready for the user's decision on merging to `main` (and pushing). Slice 2 SDD §5 waits for the user's §5.6 decisions. Also open: (1) the user decides on one more
Edge deploy to fix a regex line in `validation.ts` (see 2026-11-03 entry);
(2) the user tells the Phase 9 lane about the changed media functions
(reorder, guard, reader, submit_v2), the dropped FK and the Edge v19;
(3) the §4.2 damage-button decision.

## Log

### 2026-11-07 — Pre-merge review of the whole branch, and fixes

- **Review (read-only):** server side by Muse (space-bunny-free failed twice
  with a provider error) — "ready to merge"; app side by Muse — 6 findings.
  Each checked in code:
  - Fixed (merged `656a01e`): publication and stock failures now route access
    loss; access loss clears every Store View cache for the identity from either
    screen (list pages, details, summary, media, history); history errors keep
    the server's `retryable` flag. Also fixed by me: conflict buttons read field
    names, not internal keys, to screen readers.
  - Not fixed: photo *add* sends no inventory version (existing Phase 9 submit
    function takes none; an add does not conflict with a details save);
    filter-preference session started during sign-out cleanup stays fenced for
    that one mount (narrow); authors text with a comma inside one name (by
    design, comma-separated).
  - Server note, not fixed: Edge `unwrap` masks `P9_PUBLIC_MEDIA_ORDER_REQUIRED`
    as `P9_INTERNAL_ERROR`. Pre-existing since M51, only on internal faults;
    fixing needs a shared Edge deploy (user's call).
- **Process slip, recorded:** the polish pass was committed before the re-run
  of my two follow-up edits; the run after merge passed. From now on tests pass
  before any commit.
- **Verified by Haiku:** tsc pass; Store View Jest 32/32 suites, 360/360 tests.
  Fail-first: all 7 new/changed tests fail on the old code.
- **Review of the fix commit `63e2399` (Muse, read-only):** one LOW finding —
  history keeps a body `retryable: true` even for an access-loss code. Not
  changed: the server always sends `retryable: false` for those codes
  (`ownerUxErrors.ts` 17–21); worst case one wasted retry. DeepSeek was tried
  first and hung with no output for 77 minutes; stopped.
- DB changes: none.

### 2026-11-07 — Polish pass, Slice 1a browser checks, Slice 2 SDD draft

- **Polish (Muse built, merged `754b5f0`):** empty-language message says a
  language is needed to save; Activity hides the event row that duplicates an
  audit row (same `commandId`); photo reorder blocked while an upload is pending
  (not for a failed one); a pending replacement shows the target's current
  position; accessibility roles/labels on photo, edit, detail and stock controls;
  stock modal no longer blocks on possibly stale stock — server
  `P9_QUANTITY_INVARIANT_FAILED` (M43 line 420) shows a message and refetches;
  edit Cancel disabled while saving. Cancel stays enabled during a recovery
  refresh on purpose (R12: a hung refresh must not trap the Owner) — I changed
  Muse's version, which also blocked it during recovery and broke R12.
- **Verified by Haiku:** tsc pass; Store View Jest 29/29 suites, 354/354 in band
  and in parallel; imageInventory + Store View 1355 pass, 4 skipped. Fail-first:
  10 new/changed tests fail on the old code (the "failed upload doesn't block"
  test passes on old code by design).
- **Jest open handles:** Round2 now clears its QueryClients; `--detectOpenHandles`
  in band is clean. The parallel-only "worker failed to exit" warning still
  appears after `StoreViewLiveFixes` (92 s suite, already clears its clients);
  harmless, not chased further.
- **Slice 1a live browser checks (Haiku, user signed in once):** Needs Attention
  filter, "Mark as sellable" and "Add damage details" open the right sheet,
  rupee price label, Private filter remembered after reload — all PASS. Not
  checkable: logout filter cleanup (needs a sign-out), Retry / View plan buttons
  (no data produces those reasons). Dev data on two books set and restored
  (both back at version 1).
- **Old worktrees removed** (seven; diffs backed up in the session scratchpad).
- **SDD:** §4.4 count-name wording fixed; §5 Slice 2 (search, sort, more
  filters) drafted — not approved, decisions in §5.6.
- DB changes: none. Nothing applied or deployed.

### 2026-11-04 — Receipt-path (M57–59) coverage for remove-after-replace

- The remove-after-replace PGlite suite now also runs with migrations 57–59
  loaded: `PHASE9_REMOVEFIX_RECEIPTS=1 node --test supabase/tests/phase9/phase9StoreViewRemoveAfterReplace.integration.test.mjs`.
  Shared helper `completePublicCopyDerivative` (unit7bFixture.mjs) now calls
  `phase9_prepare_media_validation_outputs` when it exists (required from M57).
- Verified by Haiku: suite 11/11 in both modes; MediaCorrection, Slice0b,
  Summary and MediaDuplicateCompletion suites 76/76. Only those four suites were
  rerun after the helper change; the other suites that import unit7bFixture do
  not load M57, so the new branch is not taken there.
- DB changes: none. Nothing applied live.

### 2026-11-04 — Whole-branch review and three small fixes

- Read-only reviews of `main...feature/store-view-v2` (65 files) by Muse 1.3 in
  three runs (database/permissions, app behaviour, tests/docs). space-bunny failed
  with a server error three times and DeepSeek stalled, so Muse covered both.
  Main checkout fingerprint unchanged. Every finding was checked in code (and on
  live data where it applied) before it counted.
- Database/permissions: no issues found.
- Fixed on branch `sv2/reviewfix` (commit `b8df39a`, merged `0b66114`; worktree
  `Bookconnect_storeview2-reviewfix`): (2) the list screen ignored 401/403 on
  background refreshes when cached items existed — it now clears the list caches
  and shows "Store View unavailable" like the detail screen; (3) the Slice 1a "no
  photo read" test could pass vacuously — now asserts the hook was called.
- **Wrong review finding, reverted (`b3f5545`):** (1) "a book with no language
  cannot save a title-only edit — the server would accept it". Muse's claim and
  my check covered only the request schema. The browser check showed the save RPC
  validates the whole proposed row and rejects a missing language
  (`20260816000046…:105`, `P9_REQUEST_INVALID`, shown as "Review the entered
  changes and try again."). The client language check is back on every save, with
  a comment, and the test now asserts a no-language book is asked for a language.
  Open UX point (not changed): a book with no language shows the generic language
  message; the owner must enter a language before any edit saves.
- Rejected after checking: NULL `operation_kind` hole in the submit guard (column
  is NOT NULL default `'add'` with a CHECK); history service dropping 401/403
  (it already throws access-lost).
- Verified (Haiku): tsc 0 errors; Jest `src/features/storeView` 28 suites / 346
  tests pass; auth filter cleanup 10 and publicationServiceHttpStatus 5 pass;
  `git diff --check` clean; ESLint ignores these files (no coverage). On the old
  source the 3 new tests fail (null-language edited set, two access-lost cases)
  and pass again after restore. Browser check (Haiku, draft item with language
  set to NULL in dev data, then restored to `en`): title-only save failed with
  the server error above, which led to the revert. After the revert: tsc 0,
  Jest `src/features/storeView` 28 suites / 346 tests. The list access-lost fix
  (2) is unit-tested only, not browser-checked.
- Still open from the review (not fixed): E2E gaps (list refresh after edit, two photo changes, conflict flow, remembered
  filter; summary smoke test is an unexecuted checklist); stock modal checks
  against possibly stale stock; accessibility labels on photo/edit buttons and
  switches; damage-details button decision for SDD §4.2.
- DB changes: none. Edge: none.

### 2026-11-03 — Slice 1b applied and deployed; slices merged

- User said yes ("get it done") to: 1b migration, Edge deploy, commits and
  merge, and the remove-after-replace fix.
- **Migration** `store_view_slice1b_summary` applied to `ahntbtktjjmvfosgkmgn`
  (live version is the tool's timestamp). Read back: STABLE, security definer,
  empty search_path, owner postgres, ACL `{postgres, authenticated}`, anon and
  service_role cannot execute; body md5 `30f612cd…`. As the store owner on the
  live store (43 items) it returned 43/37/4/0/2/0 and `982010` in 118 ms; a
  non-owner got `P9_OWNER_NOT_AUTHORIZED`.
- **Edge** `phase9-owner-ingestion` deployed as version 19 (36 files). Before
  deploying, the live v18 bundle was compared with the repo: identical to the
  main checkout, so no Phase 9 change was overwritten; the 1b branch added only
  the two edited files plus `contracts/storeViewSummary.ts`. v18 is saved as the
  rollback copy in the session scratchpad (`edge-live-v18-rollback.json`).
  **Known difference:** the upload was retyped by a subagent and
  `functions/_shared/imageInventory/domain/validation.ts` line `CONTROL_OR_BIDI`
  now holds three ranges as literal invisible bidi characters instead of
  `‪`-style escapes (same characters matched, same behaviour, different
  source). A corrected redeploy was blocked by the permission classifier; waiting
  for the user. All other 35 files match the repo byte for byte.
- **Browser check (Haiku, signed-in pane):** Summary panel numbers all match the
  database (43/37/4/0/2/0, ₹9,820.10); Live tile filters to the 4 live items;
  open/closed state is remembered across reloads (second, careful run; the first
  run's inconsistency was not reproduced). Minor: the first Store View render
  once showed "could not be loaded" after a Metro reconnect; not reproduced.
- **Merge:** `sv2/slice1b` (includes 1a) fast-forwarded, then `sv2/slice0b`
  merged (`f5a5d3c`). Slice commits `745ec44` (0b) and `b2f599b` (1b). Nothing
  pushed. CODEBASE_MAP edits and `docs/store-view-v2/` still uncommitted.
- **Remove-after-replace fix** (branch `sv2/removefix`, worktree
  `Bookconnect_storeview2-removefix`, uncommitted): cause confirmed on live — a
  replace keeps the link row, and the consumed replace capability's
  `target_media_link_id` FK blocks the later DELETE. Fix (Sol): migration
  `20261103100000_store_view_remove_after_replace.sql` drops that FK and makes
  the owner reader hide pending replacements whose target link is gone.
  Terra's read-only review (4 findings, each checked in code) led to: a guard in
  `phase9_submit_public_copy_media_v2` rejecting replace capabilities on the add
  path (body identical to live `5cc1b044…` plus one line), `SET LOCAL
  lock_timeout='5s'`, and an app change so the photos modal drops a pending
  replace upload when its link is removed. Not changed (noted): the
  sanitization-after-removal test drives the older M40 validation path, not the
  later output-intent/receipt path. Muse made the corrections; Haiku (tests
  only) final: new suite 11/11 normal and 11/11 baseline (baseline asserts the
  old 23503), Slice 0b suite 49/49 (earlier run), Jest migrations 65/65 suites
  and 416 tests, app Jest src/features/storeView 28 suites and 339 tests, tsc
  clean, no trailing whitespace. Committed on `sv2/removefix` (`f65b72d`).
  Codex models (Sol, Terra, Luna) dropped by the user on 2026-11-03; opencode
  models only from here.
- **Remove-after-replace migration APPLIED live (2026-11-03, user said yes).**
  Applied as `store_view_remove_after_replace` (BEGIN/COMMIT left out; the
  5 s lock timeout kept). Before: reader `63813d56…` (Slice 0b), submit
  `5cc1b044…` (= repo M40), FK present, CHECK present, 0 replace capabilities
  live; ACLs saved in the worktree `.brief/removefix-rollback-2026-11-03.txt`.
  After (read back): reader `1aba916c…`, submit `e493e782…` (both as computed
  from the file), remove `44c022a2…` and replace `ccf1cb63…` unchanged, owners
  postgres, ACLs unchanged, FK gone, CHECK kept. Live test in a rolled-back
  transaction: a replace capability pointing at the draft item's link, remove
  succeeded (which the old FK blocks), link gone, capability history kept, the
  reader hid it, and `phase9_submit_public_copy_media_v2` with that capability
  raised `P9_MEDIA_NOT_APPROVED`. Afterwards the item was unchanged (version 2,
  one link at order 1, no new audit rows). Not exercised: the app screen for
  this flow. Merged into `feature/store-view-v2` (`56778ce`), nothing pushed.
  Phase 9 lane still to be told: reader, submit_v2 and the dropped FK, plus the
  earlier three media functions and the Edge v19.
- DB changes: the 1b function above. Edge: v19.

### 2026-11-02 — Slice 0b migration APPLIED to shared project `ahntbtktjjmvfosgkmgn`

- User said yes. Project re-verified ACTIVE_HEALTHY. Live bodies matched the
  2026-10-30 snapshot (`live-defs.sql` in the slice0b worktree `.brief/`) before
  applying; ACLs saved to `.brief/live-acls-2026-11-02.txt`.
- Applied with `apply_migration` as `store_view_slice0b_media_fixes` (live
  version is the tool's timestamp, not the repo file's `20261030120000`). The
  file's BEGIN/COMMIT were left out so the tool's own transaction covers it;
  function bodies and three `ALTER ... OWNER TO postgres` are the same.
- Read back (md5 of prosrc): guard `0596bbab…` → `584f1d47…`; reorder
  `ac080aad…` → `5cc468e6…`; owner reader `13550c28…` → `63813d56…`; remove
  `44c022a2…` unchanged. All owner postgres, security definer, empty
  search_path, ACLs unchanged. The reader is still STABLE.
- Live reorder check (2026-11-03, rolled back, no data kept): no live item has
  two photos, so inside one transaction that always rolled back I added a
  second link to the published item `5f5a2bc9…`, ran the reorder as its owner
  (`[new, old]`), and read the result: outcome `media_reordered`, orders 1 and 2
  in the requested sequence, version 6→7, flag back to `off`. Afterwards the
  item was unchanged (version 6, 1 link, 0 reorder audit rows). Rollback:
  re-apply `.brief/live-defs.sql`.
- Live browser check (2026-11-03, kept): I added a second photo link (SQL) to the
  draft item "Confessions of a Philosopher" `8e5958e7…` (store `2a12639f…`),
  then a Haiku subagent in the browser pane (signed in by the user) opened
  Manage Photos and moved photo 2 up once. The screen said "Photo order
  updated." and the order survived a full reload. I read the database: the two
  links swapped to orders 1 and 2, version 1→2, one `media_reordered` audit row
  and one event with the same command id. Haiku saw two "Photos reordered"
  lines in the Activity list for that one tap; the DB has one audit row and one
  event, so the list may show both sources. Not investigated. Cleaned up the
  same day: the added link `9c8fab7a…` deleted, the original photo set back to
  order 1; the item stays at version 2 with one reorder audit row and event.
- Phase 9 lane still to be told: these three functions changed.
- Open follow-ups (not in this slice): add → replace → remove FK on
  `phase9_upload_capabilities.target_media_link_id`; app should disable reorder
  while an upload is pending; show the pending replacement's position after
  reorder; M40:1231 ADD missing `operation_kind` check; audit-lookup index.
- DB changes: the three functions above only. Edge function: not deployed.

### 2026-10-29 — Live write check on "Bleak House" (user approved data changes)

- Haiku's Save click was refused twice by the auto-mode classifier; with the
  user's go-ahead Claude ran the writes in the browser pane itself.
- Passed: edit save (shelf D2→D2-test), two saves in a row (shelf back + price
  17600), price back to 17500; stock +1 then −1; photo add ×2 (upload →
  "Safety processing…" → Check status → linked, ~60–80s each); reorder failed
  as expected ("The command could not be completed.", order unchanged, modal
  usable); remove twice in a row (no version conflict). DB read back: 0 links.
- Final state restored: shelf D2, ₹175.00, Total 1 / Available 1, 0 photos.
  History now has 4 stock and 6 details entries, plus 2 photo add/remove pairs.
- Observed, not yet checked in code:
  1. After "Changes saved." / "Stock updated." the old values show for ~5–10s
     until the detail refetch lands (side effect of F2's `void refetch()`).
  2. After removing photos, their approved uploads come back as "Add photo …
     Approved and ready to add" (persists after reopening, so server-driven).
  3. Adjust Stock modal: title and Cancel text are nearly invisible.
  4. A dev overlay "removeChild … ExponentImagePicker.web.js" appeared; likely
     caused by the test's simulated file pick, not by the app.
- Checked in code (Claude), same day:
  1. Real, minor (Store View): `StoreViewDetailScreen.tsx:156,202` show success
     then `void refetch()`; the screen keeps the old values and old
     `inventoryVersion` until it lands. A second action in that window gets a
     version conflict (handled, but confusing). The save/stock results already
     return the new `inventoryVersion`.
  2. Real (server, shared Phase 9): `phase9_owner_media_records_v1`
     (M45 `…000045…media_history.sql:261-289`) lists every consumed upload
     capability whose approved asset has no link. Removing a photo deletes the
     link, so the old upload returns as "ready to add" with no expiry. Fix
     needs a migration (gated); fits with Slice 0b.
  3. Real, pre-existing: `StoreViewStockModal.tsx:31` and
     `StoreViewEditModal.tsx:421` give the sheet no background, so on the dark
     theme the light text sits on a white sheet. The photo modal sets
     `colors.bgPrimary` (`StoreViewManagePhotosModal.tsx:644`).

### 2026-10-29 — Live read-only check in the browser (Haiku)

- App run on web (`localhost:8083`, local `.env.local` copied from the sdd10
  checkout, local `.claude/launch.json`; both kept out of git). The user signed in.
- Haiku check (ran, read-only, nothing saved): list (20 items, Load more,
  filter chips), detail of one item, Edit modal (typed text survived 10s with
  no reset; Cancel kept the original), Photos modal (loading → empty state,
  closed with Done), back to list. All passed.
- Claude checked the 4 console 403s: they are `GET rest/v1/store_inventory`
  from `storeDashboardService.ts:48` (Store dashboard screen, not Store View);
  the owner can't read that table directly. Pre-existing, outside this lane.
  Store View's own Edge Function calls all returned 200 (1.5–3.5s each).
- Not tested live: save, stock, photo add/remove/reorder (these write to the
  shared live database). DB changes: none.

### 2026-10-29 — Flaky Store View tests fixed (committed `2f6a7ba`, not pushed)

- Cause: four test files wait up to 8s per `waitFor`, but Jest's default
  per-test limit is 5s, so a slow cold-start test was cut off under load.
  Added `jest.setTimeout(30000)` to `StoreViewPhotoConfirm`,
  `StoreViewEditConflict`, `StoreViewRound2` and `StoreViewRound3` tests.
- Haiku check (ran): two load rounds of two concurrent `jest
  src/features/storeView` runs, all 4 copies 199/199 passed; serial scope
  1346 passed / 0 failed; `tsc` 0. (Before the Round3 fix, one loaded copy
  failed there with the same 5s cut-off.)

### 2026-10-29 — Slice 0a committed on feature/store-view-v2

- With the user's yes, applied the worktree change (28 files, matched
  byte-for-byte ignoring line endings) and committed `d732309` on
  `feature/store-view-v2`. Not pushed. CODEBASE_MAP edits and these docs
  are still uncommitted.
- Haiku check on the branch (ran): `tsc` 0; Jest run 1 had 1 failure (the
  test above, 5s timeout; Haiku had an extra Jest run going at the time),
  run 2 1346 passed / 0 failed; PGlite 3/3. Same test flaked once in round 1.

### 2026-10-29 — Slice 0a final review round 3 and fixes

- Reviews: Terra (xhigh, whole implementation), Muse (xhigh), GLM 5.3 (max).
  DeepSeek returned nothing; deferred. Consolidated into F1–F8
  (`.slice0a-brief/findings3.md`); Claude checked all eight in code. Main
  themes: stale in-flight photo read reused on Retry (F1), command success
  waiting on unbounded invalidation refetches (F2), opening-generation
  checks missing in photo commands/uploads and edit save (F3, F5).
- Sol (gpt-6.1-sol xhigh) fixed F1–F8, plus a follow-up Claude found in
  review (save/stock success no longer waits on the detail refetch). New
  tests in `StoreViewRound3.test.tsx`; each was break-checked by Sol.
- Haiku check (ran): scope OK; no leftover break/debug files; main
  untouched; `tsc` 0; Jest 107 suites / 1346 passed / 0 failed, twice;
  Round3 file 24/24; PGlite 3/3. `--detectOpenHandles`: 199 passed, 6 Timeout
  handles from `StoreViewRound2.test.tsx` (TanStack GC timers; test cleanup).
- DB changes: none.

### 2026-10-29 — Slice 0a review round 2, fixes and R8

- Reviews: Terra (max) and Luna (xhigh) after the limit reset. Consolidated
  into R1–R21 (`.slice0a-brief/findings2.md`). Muse confirmed them; Claude
  checked R1 and R7 in code and overruled Muse's dismissal of R2 and R16.
  R1, R5, R7, R8, R15 were pre-existing bugs.
- Muse fixed R1–R7 and R9–R21 with tests (new `StoreViewRound2.test.tsx`,
  `storeViewAccessLostBoundaries.test.ts`); it broke each fix on purpose and
  saw its test fail, except R19 (regression test) and the modal-level R1 test.
- R8 (user approved editing shared `imageInventory/publicationService.ts`):
  `PublicationClientError` now carries `httpStatus`; codes/messages
  unchanged for Phase 9 callers; the photo modal uses it. Done by Muse
  because Sol hit the Codex usage limit. Claude reviewed the diff.
- Haiku check (ran): scope OK; no leftover break/debug files; main untouched;
  `tsc` 0; Jest 106 suites / 1322 passed / 0 failed, twice; R8 tests 5/5 fail
  on the old `publicationService.ts` and the file was restored byte-exact;
  PGlite 3/3. `--detectOpenHandles`: 175 passed, 6 pending 15s timers from
  stalled-request tests in `StoreViewRound2.test.tsx` (test cleanup only;
  the app helpers clear their timers in `finally`).
- DB changes: none.

### 2026-10-29 — Slice 0a review round 1 and fixes

- Reviews: Muse and DeepSeek finished. Terra and Luna stopped on the Codex
  usage limit with no output. Consolidated into 14 findings (C1–C14) in
  `.slice0a-brief/findings.md` in the worktree.
- Muse confirmed 13 of them read-only (C9 partly). Claude spot-checked
  C1, C2, C3, C7 and C12 in the code: C12 is not a bug, because the payload
  builder `storeViewEditForm.ts:31` also drops empty authors; only its
  comment was fixed.
- Muse fixed C1–C11, C13 and C14 with tests.
- Haiku check (ran): main untouched; scope OK; `tsc` 0; Jest 1154 passed /
  0 failed, twice; PGlite 3/3. One flaky timeout ("sends the second remove
  …") showed only under `--detectOpenHandles`; passes alone twice. Jest still
  prints "worker failed to exit gracefully".
- Not done: fail-first check of the round-1 fix tests against the pre-fix
  code (Muse says it checked C1 and C7). Terra/Luna review still owed.

### 2026-10-29 — Slice 0a built by Muse (not yet reviewed)

- Muse 1.3 (max) built §3.1–3.4 in worktree
  `Bookconnect_storeview2-slice0a`, branch `sv2/slice0a-muse` (local, not
  committed). 21 files, all under `src/features/storeView/` plus one PGlite test.
- Haiku check (ran): main checkout untouched; scope OK; `tsc` exit 0; Jest
  90 suites / 1135 passed / 0 failed (the baseline `ownerEditionPickerIsbnSheet`
  failure passed, twice alone, so it was flaky); PGlite diagnostic 3/3.
  Fail-first: photo-confirm 7/7 and edit-conflict 13/13 fail on the old code;
  the 3 tests of the new modules can't load on the old code (new modules), so
  their behaviour wasn't checked against it.
- **§3.4 result (PGlite M41–M46, checked against migrations through M51):**
  (a) adding a damage photo does **not** clear `damage_evidence_required`,
  because the media path never recomputes `listing_quality_status`; no later
  migration does either. (b) saving a note and (c) saving types do clear it.
  So the planned "Add damage photo" fix button (§4.2) would not clear the
  warning. Needs a decision before Slice 1a.
- Database changes: none.

### 2026-10-29

- Cloned the repo into this folder; created branch `feature/store-view-v2`
  from `origin/main` (not pushed).
- Expanded the Store View section of `CODEBASE_MAP/` (04, plus small fixes in
  02, 03, 06, 09 and README). Uncommitted.
- Set up this tracker and a local, uncommitted `CLAUDE.local.md` with the
  lane's session start and working rules.
- Verification run: none (docs only). Database changes: none.
- Read-only Supabase queries on `ahntbtktjjmvfosgkmgn` (project verified):
  migration list for M45/M51, function definitions for the reorder RPC and
  media-link guard, triggers and constraints on `inventory_media_links`.
  No writes.
