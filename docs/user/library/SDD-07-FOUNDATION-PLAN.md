# SDD-07 Foundation Plan (F-1 to F-6)

**Status:** APPROVED 2026-10-18 (with the §4 dev tools). Build progress is in §8. Originally a PLAN for owner approval, 2026-10-18. Docs only. Approving this plan authorizes nothing by itself. Each unit still needs:
- the owner's go-ahead to build it;
- for FU-1a, owner approval of the token **values** (swatches with contrast numbers);
- for FU-5a/FU-5d, owner confirmation of the **exact dependency list** in §4 before installing.

No migrations anywhere in this plan.
**Parent:** [SDD-07](./SDD-07-book-section-ui-overhaul.md) §5 (foundation) and §9 (decisions D07-01–08).
**Worktree:** `Bookconnect4_library`, branch `codex/library-cover-shelf`. Library paths only; never stage clubs or marketplace files.

## 1. How units are run

Every unit follows the owner's implementation protocol:
1. The same unit spec (one row block in §3) goes to the candidate models (Codex gpt-6.1-sol xhigh, Muse Spark 1.3 xhigh, space-bunny-free max) as a no-edit probe. Each restates goal, files, approach, risks and done criteria.
2. The best scorer builds the unit in **its own git worktree**. External models never touch Supabase, migrations or git publication.
3. Opus reviews the diff, runs the unit's tests plus the regression set (§5), and records evidence in the Library tracker.
4. The next dependent unit starts only after the previous one is accepted.

Each unit spec below is self-contained: goal, depends-on, exact files, steps, tests, done criteria (tied to DP-01–07), risks and explicit out-of-scope. A builder needs only this file, SDD-07 §3–§5 and the repo.

**Global rules for every unit:**
- No change to data access, queries, mutations, save/blur logic, navigation or route params unless the unit says so.
- No visual redesign: flows A–D do that. Foundation units change *where values come from*, not *what screens look like*, except where a unit says otherwise (FU-1b/1c palette consequence, FU-4c feedback).
- No new runtime dependencies. Dev dependencies only in FU-5a/FU-5d, from the §4 list.
- Keep the existing Jest suites green. Never weaken an assertion to make a test pass; report it instead.

## 2. Unit list and order

| Unit | Item | Title | Depends on | Can run in parallel with |
|---|---|---|---|---|
| FU-1a | F-1 | Book-section token module + contrast tests | — | FU-5a, FU-6a, FU-6b, FU-6c, FU-5d |
| FU-2 | F-2 | Type scale + fonts for all six routes | — | FU-1a, FU-3, FU-5a, FU-6* |
| FU-3 | F-3 | Spacing and radius scale | — | FU-1a, FU-2, FU-5a, FU-6* |
| FU-1b | F-1 | Notes screens onto library tokens | FU-1a | FU-1c, FU-6c |
| FU-1c | F-1 | Book Details + its child components onto library tokens | FU-1a | FU-1b, FU-6* |
| FU-4a | F-4 | Shared buttons and screen header | FU-1a, FU-2, FU-3 | FU-5a |
| FU-4b | F-4 | Shared state components | FU-4a | FU-4c |
| FU-4c | F-4 | Cross-platform feedback + confirm (fixes W01) | FU-4a | FU-4b |
| FU-5a | F-5 | ESLint install + scoped flat config | owner confirms §4 | FU-1a, FU-2, FU-3, FU-6* |
| FU-5b | F-5 | Local lint rules: raw values, accessible names, fabricated data | FU-5a, FU-1a, FU-2, FU-3 | FU-5c |
| FU-5c | F-5 | DP-03 primary-button count test helper | FU-4a | FU-5b |
| FU-5d | F-5 | axe scan on web over fixture states | owner confirms §4 | almost all; touches `e2e/` only |
| FU-6a | F-6 | Delete legacy NoteEditor / NotesList / TagSelector | — | all except FU-1b if `index.ts` conflicts (see risk) |
| FU-6b | F-6 | Trim unused `notesService` methods | — | all |
| FU-6c | F-6 | Remove `notesCount` invalidations | — | all except FU-1b only if the same builder edits `useManualNotes.ts` |

Suggested waves: **Wave 1** FU-1a, FU-2, FU-3, FU-6a, FU-6b, FU-6c (and FU-5a once §4 is confirmed). **Wave 2** FU-1b, FU-1c, FU-5d. **Wave 3** FU-4a. **Wave 4** FU-4b, FU-4c, FU-5b, FU-5c.

Parallel units run in separate worktrees and must not touch the same files. The file lists below are disjoint for the parallel pairs above, except where a risk says otherwise.

## 3. Unit specs

### FU-1a — Book-section token module + contrast tests

- **Goal:** one source of semantic colour tokens for the whole book section, per phase (daylight, golden, midnight), each pair contrast-tested. Extends the existing library palette instead of adding a fourth one.
- **Files:**
  - `src/components/library/LibraryAppearance.ts` (extend)
  - `src/components/library/__tests__/LibraryAppearance.test.ts` (extend)
- **Token shape (names fixed by this plan; values proposed by the builder and approved by the owner):**

| Group | Tokens |
|---|---|
| Surfaces | `bgPrimary`, `bgSecondary`, `bgCard`, `bgRaised` (dialogs/sheets), `overlay` (scrim) |
| Text | `textPrimary`, `textSecondary`, `textTertiary`, `textOnAccent` (= existing `onAccent`), `textDisabled` |
| Accent | `accent`, `accentPressed`, `focusRing` |
| Lines | `divider` (decorative; today's `border` at 1.37–1.80:1), `controlBorder` (≥ 3:1 against `bgPrimary` and `bgCard`; the only boundary of inputs and secondary buttons) |
| Status | `error`, `onErrorSurface`, `errorSurface`, `success`, `successSurface`, `info`, `infoSurface` |
| Chips | `tagBackground`, `tagText`, `chipSelectedBackground`, `chipSelectedText` |
| Placeholders | `coverPlaceholder`, `coverPlaceholderInk` (fixes audit #3: muted, never white in dark phases) |
| Materials (literal, allow-listed, not themed) | cloth, wood, brass — unchanged, stay in their existing files |

- **Steps:**
  1. Keep the existing tokens and their values. Add the new roles.
  2. Proposed values for new roles are derived from the existing phase palette (same hue family). The builder outputs a swatch table: token, daylight / golden / midnight hex, and the contrast ratio against its pair. The owner approves the values before FU-1b/1c start.
  3. Export a typed `BookSectionColors` type. Keep `getLibraryAppearance(phase)` and `useLibraryAppearance()` signatures.
- **Tests:** replace the hand-listed pairs with a **declared pair registry** (`BOOK_TOKEN_PAIRS`: token, background, role `text | largeText | uiBoundary | decorative`). The test computes every registered pair in all three phases: text ≥ 4.5:1, largeText and uiBoundary (`controlBorder`, `focusRing`, `accent` as a fill) ≥ 3:1; decorative pairs are exempt but must be declared. A second test fails if any token is not in the registry. Add a test that every phase defines every token (no missing keys), and that golden is not identical to daylight.
- **Done:** all pairs pass in all phases (DP-06); one token type exists for the section (DP-07 prerequisite); owner approved the swatch table.
- **Risks:** values that pass contrast can still look wrong; that is why the owner approves the swatches. Changing existing values would alter the finished shelf/home, so existing values stay unless the owner asks.
- **Out of scope:** using the tokens anywhere else (FU-1b/1c).

### FU-1b — Notes screens onto library tokens

- **Goal:** notes list, reader, composer and crop use the library tokens instead of `useNoteColors`' hard-coded greens.
- **Depends on:** FU-1a values approved.
- **Files:**
  - `src/components/notes/ManualNoteUi.tsx` (`useNoteColors`)
  - `src/components/notes/NoteCard.tsx`
  - `src/components/notes/NoteCrop.tsx`
  - `app/(tabs)/library/notes.tsx`, `note.tsx`, `note-compose.tsx` (only if they read colour keys that change name)
- **Steps:**
  1. Re-implement `useNoteColors()` as a thin mapping onto `useLibraryAppearance()` so call sites keep working. Remove every hex literal from `ManualNoteUi.tsx` and `NoteCard.tsx`.
  2. Golden gets the golden tokens. Today it falls back to daylight.
  3. Then replace the `useNoteColors` call sites with `useLibraryAppearance` directly and delete `useNoteColors`. If the diff grows past ~150 lines, leave this to a follow-up.
- **Visible consequence (owner aware):** notes screens change from green to the library paper/ink palette. This is the DP-07 merge, not a redesign; layout is untouched.
- **Tests:** existing `src/components/notes/__tests__/*` (ManualNoteFlow, ManualNoteJourney, NoteCaptureJourney, NoteCrop, CategoryPicker.web-semantics) and `app/(tabs)/library/__tests__/*` stay green. Add one test: `useNoteColors` (or its replacement) returns the library tokens for each phase. Add one test that `ManualNoteUi.tsx`, `NoteCard.tsx` and `NoteCrop.tsx` contain no hex literals.
- **Done:** zero hex literals in the listed files; notes screens render with library tokens in all three phases (fixture capture via the audit harness, 3 phases); DP-06 contrast holds by construction (FU-1a); DP-07.
- **Risks:** tests that assert specific colours; update them to token references, never delete the assertion. `NoteDialog` and the `CategoryPicker` selected state must keep a non-colour selected cue (border/check).
- **Out of scope:** typography, spacing, layout, the D07-04 chips change (flow B).

### FU-1c — Book Details + child components onto library tokens

- **Goal:** Book Details stops using the app-wide base theme (audit #1) and uses library tokens.
- **Depends on:** FU-1a values approved.
- **Files:**
  - `app/(tabs)/library/[bookId].tsx` (`useTheme()` at lines 55 and 70; 8 hex literals; style colour props only)
  - Child components: `src/components/library/StatusSelector.tsx`, `OwnershipSelector.tsx`, `ConditionPicker.tsx`, `RatingInput.tsx`, `DeleteBookModal.tsx`, `VaultPagesList.tsx`
- **Steps:**
  1. Replace `useTheme().colors` with `useLibraryAppearance()` and map keys.
  2. Replace the hex literals with tokens. The no-cover placeholder uses `coverPlaceholder` (fixes the white block).
  3. Wrap Book Details in the library typography provider (or rely on FU-2's layout-level provider) so titles use EB Garamond.
- **Tests:** `app/(tabs)/library/__tests__/[bookId].test.tsx` and `book-details-corrections.test.tsx` stay green, including the review blur-save and IR01 regressions. Add one test that the listed files contain no `useTheme(` call and no hex literal.
- **Done:** Book Details matches home's identity in all three phases (fixture capture C01/C03/G02 rerun); no white placeholder; DP-07; DP-02 colour part.
- **Risks (high):** `[bookId].tsx` is 852 lines and holds the review blur-save race fixes (IR01, RR01/RR02). **Only style colour values may change.** Any diff touching `handleSaveReview`, `reviewDraft`, mutations or query keys is rejected in review. Before editing the child components, the probe must grep for consumers outside the library; if any exist, map tokens there without changing their look, or stop and report.
- **Out of scope:** fold layout, review collapse (D07-02), Saved Pages visibility (D07-03), Alert replacement (FU-4c).

### FU-2 — Type scale + fonts for all six routes

- **Goal:** named text styles. Body ≥ 16px. The library fonts are loaded for every library route, not only home and search.
- **Files:**
  - `src/components/library/LibraryTypography.tsx` (add `LIBRARY_TEXT` styles)
  - `app/(tabs)/library/_layout.tsx` (wrap the Stack in `LibraryTypographyProvider`)
  - `app/(tabs)/library/index.tsx`, `search.tsx` (remove now-redundant per-screen providers only if behaviour is identical)
  - tests
- **Scale (proposed; owner may adjust in review):**

| Style | Font | Size / line height |
|---|---|---|
| `display` | Garamond SemiBold | 32/40 (was 32/38; changed 2026-10-18 after the Wave 1 review so the 1.2 line-height floor holds) |
| `title` | Garamond SemiBold | 26/32 |
| `heading` | Garamond Medium | 21/27 |
| `bodySerif` (note bodies) | Garamond Medium | 18/26 |
| `body` | Manrope Regular | 16/24 |
| `label` | Manrope Bold | 16/22 |
| `caption` | Manrope Regular | 14/20 — metadata only, never reading text |

  Each style references font family names from the existing provider. Sizes scale with the OS font setting (`allowFontScaling` stays on).
- **Tests:** a unit test asserts every style except `caption` has `fontSize ≥ 16`, line-height ratio 1.2–1.5 (body styles 1.35–1.5, per Butterick ~120–145% and WCAG 1.4.12), and that `caption` ≥ 14. A render test asserts that `note.tsx` and `[bookId].tsx` render inside the provider (fonts available) when mounted through the layout.
- **Done:** styles exported; provider at layout level; DP-02 type part (measured by tests).
- **Risks:** moving the provider to the layout changes font-loading timing on home and search. Keep the existing loading fallback and verify both screens still render in Jest and a web capture. Do not apply the styles to screens yet (flows do).
- **Out of scope:** changing any screen's text styles.

### FU-3 — Spacing and radius scale

- **Goal:** one spacing and radius scale.
- **Files:** `src/components/library/LibraryAppearance.ts` (`LIBRARY_SPACING`, `LIBRARY_RADIUS`) + test.
- **Steps:** extend `LIBRARY_SPACING` to `{ xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 }` while keeping the existing keys `small`/`medium`/`large` as aliases for current users. Extend `LIBRARY_RADIUS` with `chip` and `dialog`. Export a `MIN_TARGET = 48` constant (DP-06).
- **Tests:** the scale is monotonic; aliases equal their new names; `MIN_TARGET` is 48.
- **Done:** constants exported and tested (DP-02 spacing part).
- **Risks:** conflicts with FU-1a (same file). Run FU-3 in the same worktree as FU-1a or after it; if run in parallel, the reviewer merges the two small hunks.
- **Out of scope:** applying spacing to screens.

### FU-4a — Shared buttons and screen header

- **Goal:** one button component with variants and one screen header with a named Back, so DP-03 can be tested and flows reuse them.
- **Depends on:** FU-1a, FU-2, FU-3.
- **Files:**
  - New `src/components/library/ui/BookButton.tsx`, `src/components/library/ui/BookScreenHeader.tsx`, `src/components/library/ui/index.ts`
  - `src/components/notes/ManualNoteUi.tsx` (`NoteButton`, `NoteScreen` header become thin wrappers over the new components)
  - tests
- **Reconcile first:** `src/components/ui/Button.tsx` already exists app-wide. Do not edit it (shared with other features); `BookButton` is book-section only and may wrap it only if its API fits.
- **Spec:** `BookButton` variants `primary | secondary | text | destructive`; in a dialog, the confirm is the state's one primary and a destructive confirm uses `destructive`; min height/width `MIN_TARGET`; `accessibilityRole="button"`, label required; disabled state not by colour alone; `testID` suffix `-primary` etc. exposed via a `data-variant`-like prop (`variant` readable in tests). `BookScreenHeader` has a Back button whose label names the destination ("Back to Library") plus a title and optional book title.
- **Tests:** render tests for each variant (role, label, target size, disabled). `NoteButton` wrapper tests prove existing notes tests still pass unchanged.
- **Done:** components exported and used by `ManualNoteUi`; DP-03 hook available; DP-06 targets.
- **Risks:** `ManualNoteUi` is used by every notes screen. Keep the visual output of `NoteButton` identical apart from tokens.
- **Out of scope:** migrating Book Details/home/search buttons (flows).

### FU-4b — Shared state components

- **Goal:** designed states every flow can reuse (DP-05).
- **Files:** new `src/components/library/ui/BookStates.tsx` (+ export), tests. Reuse `src/components/ui/OfflineBanner.tsx` if it fits; otherwise wrap it.
- **Spec:**
  - `BookLoading` (skeleton variants `list`, `details`, `note`; spinner only as fallback)
  - `BookEmpty` (title, message, optional single action)
  - `BookError` (message + Retry; distinct copy for `server`, `offline` and `notFound` — audit #2: "Book not found" must only mean not found)
  - `BookOffline`
  - Each has an accessible role/live-region announcement.
- **Tests:** render each state and variant; assert copy differs for server/offline/notFound; assert Retry calls back.
- **Done:** components exist and are tested; DP-05.
- **Out of scope:** wiring the states into screens (flows A–D).

### FU-4c — Cross-platform feedback and confirm (fixes W01)

- **Goal:** visible save/error feedback and confirmation on web as well as native. On react-native-web `Alert.alert` is a no-op today, so on web "Review saved!" never shows and Alert-based confirmations (delete saved page, delete note via `NoteCard`) never appear.
- **Files:**
  - New `src/components/library/ui/BookFeedback.tsx` (`BookFeedbackProvider`, `useBookFeedback()` → `notify({ kind: 'success' | 'error' | 'info', message })` and `confirm(spec) → Promise<boolean>` built on the existing `NoteDialog`)
  - `app/(tabs)/library/_layout.tsx` (mount provider)
  - Call sites: `app/(tabs)/library/[bookId].tsx` (lines ~209, 213, 240), `src/components/library/VaultPagesList.tsx` (26, 30), `src/components/notes/NoteCard.tsx` (22, 30)
  - Search: `app/(tabs)/library/search.tsx` has 10 `Alert.alert` calls. Migrate them in a second commit of this unit, or split into FU-4c2 if the diff is large.
- **Spec:** feedback is inline/toast, auto-dismisses success after ~4 s, keeps errors until dismissed, announces via `AccessibilityInfo.announceForAccessibility`, and never steals focus from a text field. Confirm uses a modal with Keep/Confirm and the destructive variant.
- **Tests:** web-platform Jest test (or the existing web-semantics pattern) proving review save success shows visible text; a confirm test proving delete-page waits for confirmation and cancels cleanly; existing `[bookId]` review tests stay green (the success message is still emitted exactly once per confirmed save — RR01/RR02).
- **Done:** zero `Alert.alert` in the listed book-section files; W01 closed on web (fixture capture of review save success); DP-05.
- **Risks (high):** the review-saved message is tied to the RR01/RR02 "exactly once" fix in the mutation's `onSuccess`. Only the display call changes, not when it fires. Destructive confirms change from a native Alert to a modal, so check Android hardware Back closes it as Keep.
- **Out of scope:** `NoteEditor.tsx` (deleted in FU-6a); other app areas.

### FU-5a — ESLint install + scoped flat config

- **Goal:** working lint for the book section only (the wider app is not linted yet).
- **Depends on:** owner confirms §4.
- **Files:** `package.json` / `package-lock.json` (dev deps from §4 only), new `eslint.config.js`, a new script `"lint:library"`.
- **Steps:**
  1. Install the exact versions in §4. Use `npx expo install eslint-config-expo` so the SDK-54 pin is respected.
  2. Flat config extends `eslint-config-expo/flat`; `files` limited to `app/(tabs)/library/**`, `src/components/library/**`, `src/components/notes/**`, `src/features/books/notes/**`.
  3. Record the baseline output.
- **Tests:** `npm run lint:library` runs. Baseline warnings/errors are recorded in the tracker; no code fixes in this unit except config.
- **Done:** lint runs in < 60 s; baseline recorded.
- **Risks:** `eslint-config-expo` may flag many existing issues; record them and do not fix them here. Lockfile churn: the reviewer checks that only the §4 packages and their transitive deps were added.

### FU-5b — Local lint rules

- **Goal:** automated DP-02, DP-04 and DP-06 checks with no third-party a11y plugin (see §4 for why).
- **Depends on:** FU-5a; FU-1a/FU-2/FU-3 (tokens exist to point people to).
- **Files:** new `eslint-rules/book-section/` (local plugin: `no-raw-style-values.js`, `require-accessible-name.js`, `no-fabricated-ratings.js`), its tests (ESLint `RuleTester` under Jest), `eslint.config.js`.
- **Rules:**
  - `no-raw-style-values`: hex/rgb colours, numeric `fontSize`/`lineHeight`, and numeric padding/margin/gap outside the token modules. **Allow-list:** `LibraryAppearance.ts`, `LibraryTypography.tsx`, `bookClothTexture.ts`, `cabinetWoodTexture.ts`, `BookSpine.tsx`, `LibraryShelf.tsx`, `LibraryHorizontalShelf.tsx`, `HorizontalBookVolume.tsx` (physical shelf materials and geometry). Numeric `0`, `1` (hairline), percentages and `StyleSheet.hairlineWidth` are allowed.
  - `require-accessible-name`: `Pressable`, `TouchableOpacity`, `TextInput` and `BookButton` need `accessibilityLabel` (or `label`), or a direct `Text` child.
  - `no-fabricated-ratings`: string/JSX literals matching star characters with numbers, `\(\d+ reviews?\)`, or `\d(\.\d)? ?/ ?5`. Provider data from variables (e.g. Search `volumeInfo.averageRating`) is not flagged.
- **Ratchet:** the rules are `error` for files in a `STRICT_FILES` list (empty at first; each flow adds its migrated files) and `warn` elsewhere. A Jest test runs ESLint programmatically and fails if the warning count in book-section files rises above the recorded baseline.
- **Done:** rules tested with valid/invalid cases; ratchet test green at baseline; DP-02/04/06 automated.
- **Risks:** false positives on geometry numbers in the shelf. That is why the allow-list exists; additions to it need reviewer sign-off.

### FU-5c — DP-03 primary-button count helper

- **Goal:** a test helper flows use to assert "exactly one primary action".
- **Depends on:** FU-4a.
- **Files:** new `src/test-utils/bookSection.ts` (`expectSinglePrimary(screen, { allow?: 2 })`), its test.
- **Spec:** counts rendered `BookButton` elements with `variant="primary"`. The composer `choose` step uses `allow: 2` (Write/Scan equal by decision).
- **Done:** helper tested; DP-03 checkable.

### FU-5d — axe scan on web

- **Goal:** an automated WCAG scan of each book-section state on web.
- **Depends on:** owner confirms §4.
- **Files:**
  - `package.json`/lockfile (`@axe-core/playwright`)
  - New `e2e/fixtures/libraryFixture.ts`: the transport-fixture harness, extracted from `docs/user/library/evidence/library-screen-audit-2026-10-18/capture.pw.ts`, so tests no longer live in evidence.
  - New `e2e/library-a11y.spec.ts`
  - New `e2e/library-a11y.baseline.json`
- **Spec:** for each state (home list/empty/error, Book Details populated/no-cover, notes list, reader, composer choose/write), run `AxeBuilder` with tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`. Exclude the global tab bar selector (D07-01 owns it). Compare violations to the baseline: new violations fail; fixed ones must be removed from the baseline.
- **Run target:** the existing Playwright config serves the web export on 8084 via `_serve.js`; or a scoped config against the 8083 dev server, like the audit.
- **Done:** spec runs green against the baseline; baseline recorded (DP-06).
- **Risks:** react-native-web output may produce noisy rules (e.g. landmark rules). Record and justify any disabled rule in the spec.

### FU-6a — Delete legacy note components

- **Goal:** remove unused legacy UI.
- **Files:**
  - Delete `src/components/notes/NoteEditor.tsx`, `NotesList.tsx`, `TagSelector.tsx`, `src/components/notes/__tests__/NoteEditor.ocr.test.tsx`
  - Edit `src/components/notes/index.ts`
  - Check `src/components/notes/__tests__/ManualNoteJourney.test.tsx:297`: it only asserts that NoteEditor text is absent, so keep it.
- **Before deleting:** grep the repo (app, src, e2e, flows) for each name and for any re-export. Confirm that what `NoteEditor.ocr.test.tsx` covers in `ocrService`/`ocrWordCap` is also covered by those modules' own tests. If not, move the needed cases there first.
- **Known consequence:** two service paths lose their only caller and are **kept**, and are listed in the unit receipt:
  - `userBookPagesService.upsertPage` (with its `capToVaultLimits` use): the only Saved Pages write path; SDD-10 decides.
  - `ocrService.recognizePageViaCloud`: the cloud fallback; `ocr-fallback` is not deployed.
  `ocrService.recognizePageText` stays in use (`src/features/books/notes/captureAdapter.ts:87`). Also check `expo-image-manipulator` and `ocrService` imports still have live users after deletion (do not remove dependencies).
- **Tests:** full Library/notes Jest set green; `tsc -p tsconfig.library-notes.json --noEmit` green.
- **Done:** files gone; no import errors; coverage of OCR helpers preserved.
- **Risks:** `index.ts` is also touched by FU-1b only if FU-1b changes exports. Sequence or merge carefully.

### FU-6b — Trim unused `notesService` methods

- **Files:** `src/features/books/services/notesService.ts`, `src/features/books/services/__tests__/notesService.test.ts`.
- **Steps:** remove `getNotesForBook`, `getNotesCount`, `createNote`, `updateNote` and `deleteNote` (no app consumers; the manual-notes gateway in `src/features/books/notes/` is the live path). Keep `ReadingNote`, `NoteTag`/`NoteCategory` types and `NOTE_TAG_CONFIG` (used by `NoteCard`). Remove the matching tests. If the `notesService` object becomes empty, remove it.
- **Before deleting:** grep for `notesService.` across app/src/e2e and for dynamic access.
- **Done:** no dead methods; tests green; tsc green.

### FU-6c — Remove `notesCount` invalidations

- **Files:** `src/features/books/notes/useManualNotes.ts` (the 3 `invalidateQueries({ queryKey: ['notesCount', …] })` calls), plus its tests if any assert them.
- **Before:** grep confirms no `useQuery` produces `['notesCount', …]`. Book Details computes its count from `notes.length` (`[bookId].tsx:170`).
- **Done:** calls removed; save/delete cache tests still green.

## 4. Dev dependencies for F-5 (exact list for owner confirmation)

Checked against the npm registry on 2026-10-18 (read-only `npm view`). The repo is on Expo SDK 54 (`expo ~54.0.36`), React Native 0.81.5, TypeScript ~5.9.2 and `@playwright/test ^1.59.1`.

| Package | Version | Why this version |
|---|---|---|
| `eslint` | `~9.39.5` | Last ESLint 9 line (9.39.5, 2026-07-10). SDK 54's flat config (`eslint-config-expo` 10) is built for ESLint 9. ESLint 10.x (latest 10.13.0) is newer than the SDK-54 tooling. |
| `eslint-config-expo` | `~10.0.0` | The version Expo SDK 54 pins (`expo/bundledNativeModules.json` line 15). Peer `eslint >=8.10`. Brings `eslint-plugin-react`, `react-hooks`, `import`, `expo` and `@typescript-eslint` as its own dependencies. The latest tag (58.0.4) belongs to a newer SDK. |
| `@axe-core/playwright` | `4.13.0` | Released 2026-08-11, depends on `axe-core ~4.13.0`, peer `playwright-core >=1.0.0` (repo has 1.59.1). 4.14.0 was published 2026-10-15, three days ago, so it is not recommended yet. |

**Not included, and why:**
- `eslint-plugin-react-native-a11y` 3.5.1: its peer range is `eslint ^3 … ^8`, so it conflicts with ESLint 9. Installing it would need `--legacy-peer-deps` or ESLint 8.57.1, which is end-of-life. The accessible-name check is a small local rule instead (FU-5b).
- `eslint-plugin-jsx-a11y` 6.10.2: written for DOM JSX (`<button>`, `<img>`), not React Native components.
- `prettier`: not requested.

## 5. Regression set for every unit

- `npx jest --runInBand app/(tabs)/library src/components/library src/components/notes src/features/books` (or the 31-suite release set named in the 2026-10-18 release acceptance).
- `npx tsc -p tsconfig.library-notes.json --noEmit`.
- After FU-1b/1c/2/4c: rerun the fixture capture (`docs/user/library/evidence/library-screen-audit-2026-10-18/playwright.capture.config.ts`, or its `e2e/` successor from FU-5d) for the three phases. Compare against the 2026-10-18 audit screenshots.
- No unit may change `supabase/`, `.env*`, `app.config.js`/`app.json`, or any non-library route.

## 6. Risks summary

| Risk | Unit | Mitigation |
|---|---|---|
| Breaking Book Details review save races (IR01/RR01/RR02) | FU-1c, FU-4c | Style-only diff rule; existing regression tests must pass unchanged; Opus rejects logic diffs |
| Notes turn from green to paper/ink | FU-1b | Owner approves swatches first; this is the DP-07 merge |
| Font-loading timing changes | FU-2 | Provider at layout with the existing fallback; capture home/search after |
| Web confirm dialogs replacing no-op Alerts change behaviour | FU-4c | Explicit tests; Android Back = Keep |
| Deleting legacy files drops OCR helper coverage | FU-6a | Move needed cases before deleting |
| `upsertPage` left without a caller | FU-6a | Kept on purpose; SDD-10 decides |
| Lint/axe noise | FU-5a/5b/5d | Baseline + ratchet; allow-list changes need review |
| Parallel units touching one file | FU-1a/FU-3, FU-1b/FU-6a | Same worktree or sequence; reviewer merges |

## 7. Owner approvals needed next

1. This plan (unit list, order, parallel waves).
2. The §4 dependency list (exact versions) — before FU-5a/FU-5d.
3. FU-1a token values (swatch table with contrast ratios) — before FU-1b/FU-1c.
4. The FU-2 type scale (sizes in the table) — at FU-2 review.


## 8. Build status

Builds run in worktree `Bookconnect4_fu1a`, branch `sdd07/fu1a-fu3`, orchestrated from the other session. External builders never commit; commits need the owner's approval.

| Unit | Status (2026-10-18) | Built by | Evidence |
|---|---|---|---|
| FU-1a | **Committed** `db715d3`. Swatch values approved. One later deviation: daylight `controlBorder` `#948669` → `#8a7c60` (SDD-07 D07-12). | Orchestrated | SDD-07 §10 |
| FU-3 | **Committed** `db715d3` (with FU-1a) | Orchestrated | — |
| FA-P1 (Flow A prototype) | **Committed** `17ad84f`; design FINALIZED (SDD-07 §10) | Orchestrated | [FA-P1 evidence](./evidence/fa-p1-prototype-2026-10-18/README.md) |
| FU-5a | **DONE — committed `a36b8e5`** (not pushed). `eslint` ~9.39.5 and `eslint-config-expo` ~10.0.0. Lockfile +218, 0 removed, 3 transitive bumps. Scoped flat config; `lint:library` runs in ~18 s. Baseline 38 problems (3 errors, 35 warnings), 32 after FU-6 + FU-2; no code fixes. | Orchestrator | [Wave 1](./evidence/sdd07-foundation-wave1-2026-10-18/README.md) |
| FU-6a | **DONE — committed `640ef30`** (with FU-6b/c; not pushed). Legacy NoteEditor/NotesList/TagSelector and their test deleted, after moving 2 OCR helper cases | Codex `gpt-6.1-sol` xhigh | [fu6-cleanup](./evidence/sdd07-foundation-wave1-2026-10-18/fu6-cleanup/README.md) |
| FU-6b | **DONE — committed `640ef30`.** 5 `notesService` methods and 13 method-only tests removed | Codex | same |
| FU-6c | **DONE — committed `640ef30`.** 3 `notesCount` invalidations removed, after proving there is no producer | Codex | same |
| FU-2 | **DONE — committed `6644689`** (not pushed). The owner approved the type scale with display 32/40. `LIBRARY_TEXT` as the §3 table, except `display` is **32/40** (changed from 32/38 after review so the 1.2 floor holds, with no test exceptions); provider at layout level; 9 new tests that render screens through the real `LibraryLayout`. **Type scale awaits owner approval** (§7 item 4). | Muse Spark 1.3 xhigh | [Wave 1](./evidence/sdd07-foundation-wave1-2026-10-18/README.md) |
| FU-1b | **DONE — committed `97d9ac3` + `eba9054` on `sdd07/wave2`** (2026-10-19, not pushed). Notes list, reader and composer moved onto library tokens (colour only). Built in `wave2n`, applied as a patch to `sdd07/wave2`. | Orchestrated | [Wave 2](./evidence/sdd07-foundation-wave2-2026-10-19/README.md) |
| FU-1c | **DONE — committed `97d9ac3` + `eba9054` on `sdd07/wave2`** (2026-10-19, not pushed). Book Details moved onto library tokens (colour only); protected logic in `[bookId].tsx` unchanged. | Codex `gpt-6.1-sol` | [Wave 2](./evidence/sdd07-foundation-wave2-2026-10-19/README.md) |
| FU-4a | **DONE — committed `43931c6` on `sdd07/fu4a`** (2026-10-19, not pushed), worktree `Bookconnect4_fu4a`, branch `sdd07/fu4a` off `sdd07/wave2` (`eba9054`). `BookButton` (variants primary / secondary / text / destructive; `variant` and `label` required; 48 target) and `BookScreenHeader` (named Back) under `src/components/library/ui/`; `NoteButton` and the `NoteScreen` header are now thin wrappers; 4 unused `ui` style keys removed. No visible change. Jest 40 / 706 → 43 / 743, all passing; scoped `tsc` 0; whole-repo `tsc` 36; lint 32 (all equal to baseline). One Codex review: R1, R2 (both minor), fixed. See the FU-4a entry in [TRACKER](./TRACKER.md). | Codex `gpt-6.1-sol` xhigh (lean process) | [TRACKER](./TRACKER.md) |
| FU-4b | **DONE — committed `36b801b`** (2026-10-19) on `sdd07/fu4b` (worktree `Bookconnect4_fu4b`, off `sdd07/fu4a`; not pushed). `BookLoading` (static skeletons `list`/`details`/`note`, spinner fallback), `BookEmpty`, `BookError` (server/offline/notFound copy), `BookOffline` in `src/components/library/ui/BookStates.tsx`. Not wired into screens. Jest 43 / 743 → 44 / 817 all passing; scoped `tsc` 0; whole-repo `tsc` 36; lint 32 (= baseline). One Codex review: R1 fixed. See the FU-4b entry in [TRACKER](./TRACKER.md). | Codex `gpt-6.1-sol` xhigh (lean process) | [TRACKER](./TRACKER.md) |
| FU-4c | **DONE — committed `bc543b8`** (2026-10-19), worktree `Bookconnect4_fu4c`, branch `sdd07/fu4c` off `sdd07/fu4a`, not pushed. `BookFeedbackProvider` / `useBookFeedback` (`notify`, `confirm`) / `BookFeedbackSlot` in `src/components/library/ui/BookFeedback.tsx`, mounted in the library layout. `Alert.alert` in the listed files: 17 → 0 (`[bookId]` 3, `VaultPagesList` 2, `NoteCard` 2, `search` 10). Jest 43 / 743 → 44 / 778 all passing; scoped `tsc` 0; whole-repo `tsc` 36; lint 32 (all equal to baseline). Two reviews (Codex, space-bunny). See the FU-4c entry in [TRACKER](./TRACKER.md). | Codex `gpt-6.1-sol` xhigh (lean process) | [TRACKER](./TRACKER.md) |
| FU-5b | **DONE — committed `205c6b2`** (2026-10-19) on `sdd07/fu5bc` (worktree `Bookconnect4_fu5bc`, off `sdd07/wave3`), fast-forwarded into `sdd07/wave3`; not pushed. Local rules `no-raw-style-values`, `require-accessible-name`, `no-fabricated-ratings` under `eslint-rules/book-section/`, wired as `warn` (`error` only for `STRICT_FILES`, empty), nine-file allow-list, Jest ratchet. `lint:library` baseline 32 + 429 + 4 + 0 = 465; the 32 are unchanged; ratchet baseline 429 / 4 / 0. 175 new tests. | Codex `gpt-6.1-sol` xhigh (lean process) | [TRACKER](./TRACKER.md) |
| FU-5c | **DONE — committed `205c6b2`** (2026-10-19) on `sdd07/fu5bc`, fast-forwarded into `sdd07/wave3`; not pushed. `src/test-utils/bookSection.ts` (`expectSinglePrimary`, `countPrimaryButtons`), 13 tests. A destructive-confirm dialog is not counted as primary (plan counts `variant="primary"` only). Library Jest 45 / 852 (= baseline), scoped `tsc` 0, whole-repo `tsc` 36. Reviewed by Muse Spark (Codex out of credits): no findings. | opencode Muse Spark 1.3 xhigh | [TRACKER](./TRACKER.md) |
| FU-5d | **DONE — committed `48250cc`** (2026-10-19) on `sdd07/fu5bc`, fast-forwarded into `sdd07/wave3`, with the owner-approved `@axe-core/playwright` 4.13.0 install (not pushed). `e2e/fixtures/libraryFixture.ts`, `e2e/library-a11y.spec.ts` (9 states x 3 phases), `e2e/library-a11y.baseline.json`, `playwright.library-a11y.config.ts`, script `e2e:library-a11y`. Recorded: only `image-alt` x1 on the home list in each phase; tab bar excluded. 27/27 green against the baseline. Reviewed by Muse Spark: no findings. | opencode Muse Spark 1.3 xhigh | [TRACKER](./TRACKER.md) |

**Wave 1 verification** (orchestrator):
- Jest (library, notes, books, prototypes): 44 suites / 815 tests before → 44 suites / 801 tests after, all pass. FU-6 alone ended at 43 / 792, and FU-2 added 1 suite and 9 tests.
- `tsc -p tsconfig.library-notes.json`: 0 errors before and after.
- **Web capture after FU-2** (Haiku; [evidence](./evidence/sdd07-foundation-wave1-2026-10-18/fu2-web-capture/README.md)). The app `.env` was copied into fu1a for this one run with the owner's OK, then deleted; the orchestrator verified the deletion.
  - C1 no page errors: PASS.
  - C2 library fonts loaded and used on home and search: PASS. `LibraryGaramondMedium` is not loaded there because those screens don't use it.
  - C3 the 9 G02 captures are byte-identical to the 2026-10-18 audit: PASS. The orchestrator spot-checked 2 MD5s.
  - C4 the loading state is not blank: PASS. It was taken after the login redirect with data held 4 s, not on a cold load.
  - C5 writes: 0, PASS.

**Independent review:** Codex `gpt-6.1-sol` xhigh and Gemini 4 Argon, read-only, both "Safe to commit: YES WITH FIXES". The two FU-2 test fixes were applied and re-verified: 44 / 801 pass, 0 `act` warnings, tsc 0 errors. [Reviews](./evidence/sdd07-foundation-wave1-2026-10-18/reviews/).
**Kept without caller** (SDD-10 decides): `userBookPagesService.upsertPage` with `capToVaultLimits`; `ocrService.recognizePageViaCloud`.
**Residual:** a stale comment mentioning NoteEditor at `e2e/library-vault-smoke.spec.ts:164`.
**Wave 1 DONE 2026-10-18.** Owner's words: "I approve the FU-2 type scale with display 32/40. Commit Wave 1 (FU-5a, FU-6a/b/c, FU-2) on sdd07/fu1a-fu3, don't push. You may copy the library .env into fu1a again for one home/search web capture, then delete it." Commits on `sdd07/fu1a-fu3`, **not pushed**: `a36b8e5` FU-5a, `640ef30` FU-6a/b/c, `6644689` FU-2 (after `db715d3` tokens and `17ad84f` prototype).

**Wave 2 (FU-1b, FU-1c) BUILT, REVIEWED and COMMITTED 2026-10-19** (`97d9ac3` + `eba9054` on `sdd07/wave2`, not pushed). Worktree `Bookconnect4_wave2`, branch `sdd07/wave2`, base `6644689`. Full record: [Wave 2 README](./evidence/sdd07-foundation-wave2-2026-10-19/README.md).
- **Design decisions** (lead, under the owner's design delegation; to be shown to the owner): `ConditionPicker` failing green/red → chip tokens; `RatingInput` gold → `accent`; control borders → `controlBorder`; no-cover → `coverPlaceholder`; dialogs → `bgRaised`; note quote stripe unchanged (D07-04).
- **Reviews:** Gemini Argon and Codex `gpt-6.1-sol` xhigh, both "YES WITH FIXES" (Argon F1–F5, Codex R1–R3). All 8 verified by the lead and fixed by Codex. The one visible non-colour change: `DeleteBookModal` Cancel gets a 1px `controlBorder` border, padding 14 → 13, height unchanged.
- **Verification (lead):** Jest library + notes 27 suites / 520 tests pass; `lint:library` 32 problems = baseline; whole-repo `tsc --noEmit` 36 errors, same count on the base branch, all pre-existing outside the library. Codex's broader run: 695/697, the 2 shelf failures reproduce on pre-edit sources.
- **Correction:** the earlier "tsc 0 errors" results in this plan came from `tsc -p tsconfig.library-notes.json`. They are scoped results, not whole-repo results.
- **Web capture** (Haiku): 32 passed, 0 non-GET requests, 0 page errors. The captures predate the R1–R3/F3 fixes. Rating stars and the crop step are covered by Jest only.
- **Mutations:** none. The placeholder `.env` was deleted from `Bookconnect4_wave2`.

**Flow B handoff (2026-10-20):** built, reviewed, verified — awaiting owner commit approval. Design finalized under the owner's delegation to the lead (SDD-07 D07-18); B-1 notes list, B-2 reader and B-3 composer choose/write, including both fix rounds, are recorded in SDD-07 §11 and the current [TRACKER](./TRACKER.md) entry. The reader's inherited cached-data/refetch-error predicate remains deferred outside Flow B; browser tests were skipped by owner decision and no device/browser screen-reader run is claimed. Database/storage mutations: none.

**Active work unit:** `sdd07_flow_d_design`.

**Next exact action (2026-10-21, after the Flow D follow-ups):** the owner decides whether to open a fresh tab-bar unit from `main` (icons, theme colours, contrast, 200% zoom; `main` already has the five tabs — SDD-07 §13.7) or pick another library unit. The cover alt fix and the `search.tsx` split are merged to `main`. See the TRACKER top entry.

**Earlier next action (2026-10-21, after Flow D, done):** the owner picks the next library unit: the Book Details cover alt fix (`BookCover.tsx`), the `search.tsx` presentation split, or TB-1 re-scoped against `main`. Flow D is built, verified and merged to `main` (SDD-07 §13, D07-20, D07-21). See the TRACKER top entry.

**Earlier next action (2026-10-21, Flow D, done — merged to `main`):** the lead finalizes the Flow D design (`.spec/FLOWD-DESIGN.md` in `Bookconnect4_flowd`, branch `sdd07/flow-d`, base `main` `60a6b6c`) under the owner's delegation and shows the owner a summary; then the Codex build. Commit and push only on owner approval. See the TRACKER top entry.

**Earlier next action (2026-10-20, Flow C, done — merged to `main` at `60a6b6c`):** the owner approves the Flow C commit: uncommitted code and docs on `sdd07/flow-c` in `Bookconnect4_flowc`, base `main` `0a083f1` (SDD-07 §12, D07-19). Push/merge to `main` only on separate approval, after `git fetch`. Then Flow D — Remaining, or TB-1 re-scoped against `main`'s marketplace layout. `.spec/` and `.env` stay outside the commit.

**Earlier next action (2026-10-20, Flow B, done — merged to `main`):** the owner approves the Flow B commit: uncommitted code on `sdd07/flow-b` in `Bookconnect4_flowa`, base `c92a88e`, and matching docs on `codex/library-cover-shelf` in `Bookconnect4_library`. After that, **Flow C — Capture** (`note-compose` intake/crop/review/no-text/failure), following SDD-07 §6 order. `.spec/` and `.env` stay outside the commit; push requires separate approval.

**Earlier Flow A next action (2026-10-20, superseded):** the owner approves (or not) committing the real Flow A build on `sdd07/flow-a` (worktree `Bookconnect4_flowa`, off `sdd07/wave3` `f568288`, which is pushed as `origin/sdd07/wave3`). The commit includes deleting `src/prototypes/flowA/**` and `app/(tabs)/library/dev-flow-a.tsx`, and never `.spec/` or `.env`. Push only on separate approval. Build record: SDD-07 §10.8 and the 2026-10-20 TRACKER entry. Of the Flow A fix list in item 3 below, the following are done: the accessible-name gaps on Book Details (review box, rating), roles/state on condition, ownership and rating, and the same-value status skip. Still open at that checkpoint: axe `image-alt` on the home list, 44 px targets in search, manual entry and pickers, the manual-entry scrim and tokens, the `LibraryPillNav` and `ManualNoteUi` name hits, and the exchange-listing delete copy (D07-14 residual). The proposed choice of Flow B or parked TB-1 is superseded by the Flow B handoff above.

**Earlier next action (2026-10-19, superseded):**
1. Foundation FU-1a … FU-6c are all committed. `sdd07/wave3` (worktree `Bookconnect4_wave3`) was fast-forwarded to `48250cc` on 2026-10-19 (FU-4a/4b/4c + FU-5b/5c/5d; not pushed). Lead verification on the merged tree: Jest library set + `eslint-rules` + `src/test-utils` 51 suites / 1040 tests pass; scoped `tsc` 0; `lint:library` 465 (3 errors, 462 warnings) = 32 baseline + 429 + 4 + 0; whole-repo `tsc` 36 (= baseline) after the owner-approved `npm ci` in wave3 (it was 39 before, all 3 from `@axe-core/playwright` missing from `node_modules`).
2. Whole-foundation review done 2026-10-19 (Muse + Codex; no SDD-07 regression). Four confirmed fixes committed as `f568288` on `sdd07/wave3` (Jest 52 / 1045, `tsc` 0 / 36, lint 465, axe 27/27; not pushed). Next: the owner decides on a backup push; then the Flow A build from `sdd07/wave3` (`f568288`).
3. Flow A fix list from the review and the Android check: axe `image-alt` on the home list; the 4 accessible-name gaps; roles/state on condition, ownership and rating buttons; 44 px targets in search, manual entry and pickers; manual-entry scrim and tokens; skip a status update when the value is unchanged.
4. TB-1 stays parked until the "Marketplace" label decision and commit approval.

FU-5d's `@axe-core/playwright` 4.13.0 install was approved by the owner on 2026-10-19 and is done.
