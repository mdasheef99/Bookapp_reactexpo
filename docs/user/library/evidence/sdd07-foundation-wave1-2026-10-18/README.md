# SDD-07 foundation Wave 1 — FU-5a, FU-6a/b/c, FU-2 (2026-10-18)

**Status:** built and verified by the orchestrating session. **Uncommitted, awaiting the owner's commit approval.**
**Authority:** the owner said "ok proceed please" (2026-10-18) to committing the Flow A work and then starting Wave 1.
**Where:** worktree `Bookconnect4_fu1a`, branch `sdd07/fu1a-fu3`. Wave 1 sits on top of two commits:
- `db715d3` — FU-1a semantic colour tokens and FU-3 spacing/radius;
- `17ad84f` — the FA-P1 prototype.

**Plan:** [SDD-07-FOUNDATION-PLAN.md](../../SDD-07-FOUNDATION-PLAN.md) §3 (unit specs) and §8 (build status).

## FU-5a — ESLint install and scoped flat config (done by the orchestrator)

**Dev dependencies** — exactly the §4 list:
- `eslint` `~9.39.5` (resolved 9.39.5);
- `eslint-config-expo` `~10.0.0`.

**Lockfile:** 218 packages added, 0 removed. Three transitive bumps:

| Package | From | To |
|---|---|---|
| `es-object-atoms` | 1.1.1 | 1.1.2 |
| `hasown` | 2.0.2 | 2.0.4 |
| `is-core-module` | 2.16.1 | 2.17.0 |

**Config:** a new `eslint.config.js`.
- Flat config that extends `eslint-config-expo/flat`.
- `files` limited to `app/(tabs)/library`, `src/components/library`, `src/components/notes` and `src/features/books/notes`.
- Test files are ignored.

**Script:** `npm run lint:library` runs in about 18 s (the plan's limit is 60 s).

**Baseline:** [`fu5a/lint-baseline-before-fu6.txt`](./fu5a/lint-baseline-before-fu6.txt).

| When | Problems | Errors | Warnings |
|---|---|---|---|
| Before FU-6 | 38 | 3 | 35 |
| After FU-6 + FU-2 | 32 | 3 | 29 |

The 35 warnings before FU-6 were 17 `react-hooks/exhaustive-deps`, 12 `no-unused-vars`, 5 `no-require-imports`, and 1 `array-type`. The 3 errors were all `react/no-unescaped-entities`. One of the `no-require-imports` warnings is the FA-P1 route's intentional `__DEV__` require.

Per the spec, this unit made no code fixes.

**Not yet installed:** `@axe-core/playwright` (FU-5d).

## FU-6a/b/c — legacy cleanup (built by Codex `gpt-6.1-sol`, xhigh)

The receipt and grep logs are in [`fu6-cleanup/`](./fu6-cleanup/README.md), copied from `Bookconnect4_fu1a/.spec-out/fu6-cleanup/`. The receipt's relative links work inside that folder.

Also in that folder:
- [`codex-receipt.md`](./fu6-cleanup/codex-receipt.md) — Codex's summary. Its absolute link points at the fu1a original.
- [`codex-proposed-tracker-entry.diff`](./fu6-cleanup/codex-proposed-tracker-entry.diff) — the tracker paragraph Codex wrote in the fu1a copy. The orchestrator moved it out of fu1a; it is used as source text for this worktree's tracker.

**FU-6a:**
- Deleted `NoteEditor.tsx`, `NotesList.tsx`, `TagSelector.tsx` and `NoteEditor.ocr.test.tsx`, plus their barrel exports.
- Before deleting, moved two OCR helper cases into the `ocrService` tests: single-word overflow, and the safe provider-error message.

**FU-6b:** removed 5 `notesService` methods and their 13 method-only tests. Kept `ReadingNote`, `NoteTag`/`NoteCategory` and `NOTE_TAG_CONFIG`.

**FU-6c:** removed 3 `notesCount` invalidations, after proving that no query produces that key.

**Kept on purpose, now with no caller** (SDD-10 decides their fate):
- `userBookPagesService.upsertPage` and `capToVaultLimits`;
- `ocrService.recognizePageViaCloud`.

**Residual:** `e2e/library-vault-smoke.spec.ts:164` has a stale comment that mentions `NoteEditor`.

## FU-2 — type scale and fonts at layout level (built by Muse Spark 1.3, xhigh)

**Type scale:** `LIBRARY_TEXT` in `src/components/library/LibraryTypography.tsx`.

| Style | Font | Size / line height |
|---|---|---|
| `display` | Garamond SemiBold | 32/40 (was 32/38 before the review fix) |
| `title` | Garamond SemiBold | 26/32 |
| `heading` | Garamond Medium | 21/27 |
| `bodySerif` | Garamond Medium | 18/26 |
| `body` | Manrope | 16/24 |
| `label` | Manrope Bold | 16/22 |
| `caption` | Manrope | 14/20 |

**Provider:** `LibraryTypographyProvider` moved to `app/(tabs)/library/_layout.tsx`. The existing fallback is kept, and children always render. The per-screen providers were removed from `index.tsx` and `search.tsx`.

**Tests:** a new `LibraryTypography.test.tsx` with 9 tests, including renders of the note reader and Book Details inside the layout provider.

**Review fix:** `display` was first 32/38 (ratio 1.19, under the 1.2 floor) and is now 32/40, with no test exception. The render tests mount through the real `LibraryLayout`. See *Independent review* below.

**Owner approval still needed:** the type scale (plan §7, item 4).

## Verification (run by the orchestrating session)

**Jest** — `app/(tabs)/library`, `src/components/library`, `src/components/notes`, `src/features/books` and `src/prototypes`:

| Point | Suites | Tests | Result |
|---|---|---|---|
| Before Wave 1 | 44 | 815 | all pass |
| After FU-6 (Codex receipt) | 43 | 792 | all pass |
| After FU-6 + FU-2 | 44 | 801 | all pass |

**TypeScript:** `tsc -p tsconfig.library-notes.json` has 0 errors before and after.

**Not done:**
- Web capture of home and search after the provider move. It needs the app `.env` in fu1a, which was removed; this waits for the owner's OK.
- Axe (FU-5d not installed).

**Database/storage mutations:** none. Nothing staged, committed or pushed for Wave 1.

## Independent review (read-only)

Wave 1 was reviewed independently and read-only by Codex `gpt-6.1-sol` xhigh and Gemini 4 Argon. Both said "Safe to commit: YES WITH FIXES", and the repo fingerprint was unchanged.

Both found the same two FU-2 test issues, fixed by Muse Spark 1.3:
1. `display` line height is now **32/40** (it was 32/38 = 1.19, under the 1.2 floor). The line-height test has no per-style exceptions.
2. The note reader and Book Details render tests now mount through the real `LibraryLayout` (a Stack mock renders the route) instead of supplying the provider themselves. The `act()` warnings are gone.

Re-verified by the orchestrator: Jest 44 suites / 801 tests pass, 0 `act` warnings, scoped tsc 0 errors.

Other findings:
- **Codex:** the FU-5a baseline was not recorded. That is covered by this record. Lint stays at 32 problems (3 errors, 29 warnings) and exits 1 by design.
- **Codex:** 2 native-view animation test failures appear only with the Jest disk cache disabled. They reproduce on HEAD, so they are pre-existing.
- **Argon:** standalone home and search unit renders now use fallback fonts, since the per-screen providers were removed. This was not acted on.

Reviews: [`reviews/w1-review-codex.md`](./reviews/w1-review-codex.md) and [`reviews/w1-review-argon.md`](./reviews/w1-review-argon.md) (terminal colour codes stripped).

## Next

1. The owner approves the FU-2 type scale.
2. The owner approves committing Wave 1 on `sdd07/fu1a-fu3`.
3. Web capture of home and search.
4. The tab-bar unit (D07-01).
