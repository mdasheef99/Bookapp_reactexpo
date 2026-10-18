# SDD-07 Flow A — unit FA-P1: Book Details prototype

**Status:** **FINALIZED 2026-10-18.** Built as the FA-P1 prototype in worktree `Bookconnect4_fu1a` (branch `sdd07/fu1a-fu3`, uncommitted), then reviewed and changed over rounds 2–4. The design was finalized under the owner's delegation (SDD-07 D07-11–D07-15).

**Changes from this spec** (§10 of SDD-07 is authoritative where the two differ):
- the Remove copy (D07-14);
- the offline line and disabled actions;
- the refresh-failed state;
- measured-width layout;
- the ownership/review row behaviour;
- local-time note dates;
- saved-page presentation;
- the daylight `controlBorder` value (D07-12).

This file stays as the unit's original build spec.
**Date:** 2026-10-18
**Parent:** [SDD-07](./SDD-07-book-section-ui-overhaul.md):
- §3 rules DP-01–DP-07 (DP-01 as amended by D07-10);
- §7 reserved slots;
- §9 decisions D07-02, D07-03, D07-08, D07-09 and D07-10.

**Authority:** owner's words (2026-10-18, relayed by the orchestrating session): "Go with A1 Shelf card, using A2's unboxed serif note passages, and amend DP-01 to count controls only down to the primary action. Build it as the Expo web prototype."
**Design source:** [Flow A directions](./evidence/flow-a-directions-2026-10-18/README.md):

| File | Use |
|---|---|
| `A1r-daylight-390-full.png`, `A1r-midnight-390-full.png` | Layout |
| `A2r-daylight-390-full.png` | Note passage style |
| `A3r-daylight-390-fold.png` | No-cover placeholder |

**Builder:** an external model in its own worktree. Orchestration, review, commits and git publication stay with the orchestrating session.

This file is self-contained: a builder needs only this file, SDD-07 §3, the files it names and the repo.

## 1. Goal

A web-viewable Expo screen that shows the chosen Book Details design using **only fixture data**, in every state and all three time phases. The owner judges it against DP-01–DP-07 before the real Flow A build starts.

It is a design artefact that runs on the real tokens, fonts and components. It is not the real screen:
- no Supabase;
- no queries or mutations;
- no React Query;
- no navigation side effects;
- no AsyncStorage writes.

## 2. Preconditions

| Needs | Status 2026-10-18 | If missing |
|---|---|---|
| FU-1a book-section tokens (`BookSectionColors`, `getLibraryAppearance`, `useLibraryAppearance`, plus `LIBRARY_SPACING`, `LIBRARY_RADIUS` and `MIN_TARGET` from FU-3) in `src/components/library/LibraryAppearance.ts` | Being built on local branch `sdd07/fu1a-fu3` (worktree `Bookconnect4_fu1a`). Values are PROPOSED until the owner approves the swatches. | Do not start. Branch the FA-P1 worktree from `sdd07/fu1a-fu3` once FU-1a is committed there. Read tokens **by name only**, so approved value changes flow through. |
| FU-2 `LIBRARY_TEXT` type styles in `src/components/library/LibraryTypography.tsx` | Not built | Use a local mirror of the FU-2 scale in `prototypeTokens.ts` (§7). Replace it with `LIBRARY_TEXT` when FU-2 lands. |
| FU-4a `BookButton` | Not built | Use the local `PrimaryButton` and `TextButton` in the prototype folder. Do not create shared components. |
| Library fonts | Exist: `LibraryTypographyProvider` / `useLibraryTypography()` (EB Garamond 500/600, Manrope 400/700) | — |

**Do not edit** `LibraryAppearance.ts`. If a needed token or a needed foreground/background pair is missing from FU-1a's `BOOK_TOKEN_PAIRS` registry, stop and report it. Adding tokens and pairs is FU-1a's job.

## 3. Where it lives and how it stays out of production

**Route:** `app/(tabs)/library/dev-flow-a.tsx`.
- It is a screen in the library Stack, inside the tabs. The real tab bar and the normal sign-in apply, so the fold is judged with the real chrome.
- It adds **no tab**: tabs come only from the direct children of `app/(tabs)`.
- The static segment `dev-flow-a` wins over the dynamic `[bookId]`.
- `app/(tabs)/library/_layout.tsx` does not need to change, because expo-router registers the file itself.

**Release guard.** The whole route file is shown below. The `__DEV__` check is evaluated at build time:

```tsx
import { Redirect } from 'expo-router';

// FA-P1 prototype: dev builds only. In release bundles __DEV__ is false, so the require below is dead code and is stripped.
const Prototype: React.ComponentType | null = __DEV__
    ? require('@/prototypes/flowA/BookDetailsPrototypeRoute').default
    : null;

export default function DevFlowAPrototype() {
    if (!__DEV__ || !Prototype) return <Redirect href="/(tabs)/library" />;
    return <Prototype />;
}
```

**Isolation:**
- All prototype code lives in `src/prototypes/flowA/`.
- No production module may import from `src/prototypes/`; a test enforces this (§8).
- Nothing in the app links to the route. It is opened by URL only.

**Release proof (done criterion):**
1. Put a unique marker string `FA_P1_PROTOTYPE_MARKER` in `BookDetailsPrototypeRoute.tsx`.
2. Run a release web export (`npx expo export --platform web`) and confirm the marker is absent from every `dist/**/*.js` file.
3. Confirm the route itself redirects in a release build.

### How to open it

1. Start the library dev server on port 8083. This is the `library-web` entry in `.claude/launch.json`:

    ```bash
    npx expo start --web --port 8083
    ```

    A builder worktree that runs at the same time uses the next free library port (8084+) so it doesn't collide with this worktree.
2. Sign in as usual. The root layout redirects signed-out users to login. The prototype uses no account data. Never type real credentials into automation.
3. Open the switcher at `http://localhost:8083/library/dev-flow-a`.
4. Open a single state at, for example, `http://localhost:8083/library/dev-flow-a?s=populated&phase=midnight`.

For automated captures, reuse the fake-auth transport-fixture harness from [the screen audit](./evidence/library-screen-audit-2026-10-18/), `capture.pw.ts`. It aborts every non-GET request, so nothing can write.

## 4. URL parameters, presets and the switcher

URL parameters are the only source of state. This keeps captures deterministic.

**Screen mode:** `?s=<preset>&phase=<daylight|golden|midnight>&open=<row>&slots=1`.
- `phase` overrides the time phase (default: the current phase from `useTheme()`). Implement it as `getLibraryAppearance(phaseParam ?? phase)`, not by changing the hook.
- `open` sets which section starts expanded: `review | saved | info | ownership | community | remove`. `remove` opens the confirm dialog.
- `slots=1` shows the reserved-slot annotations (§5.8). They are off by default.
- In screen mode, render **only** the prototype screen, with no switcher controls, so focus counting is exact.

**Switcher mode** (no `s` parameter): a plain scrolling list of links to every preset × phase. It also lists the `open=` and `slots=1` variants for `populated`. It has no other UI.

| Preset `s=` | Fixture |
|---|---|
| `populated` | Walden with cover, status Reading, 3 notes (Quote with page, Thought, Question), review present, 1 saved page, ownership Owned, condition Good |
| `no-cover` | `populated` without a cover → muted placeholder |
| `zero-notes` | `populated` with 0 notes |
| `many-notes` | `populated` with 12 notes (latest 2 shown) |
| `long-title` | *The Life and Opinions of Tristram Shandy, Gentleman*, Laurence Sterne, with cover, 2 notes |
| `saved-absent` | `populated` with 0 saved pages → Saved pages row hidden |
| `review-absent` | `populated` with no review text |
| `want-to-read`, `finished` | `populated` with that status |
| `lent-out` | `populated` with ownership `lent_out` → shown as "Lent out" |
| `uncategorised-note` | Latest note has `tag: null`, no page |
| `notes-loading` | Book loaded; notes area shows the static "Loading notes…" text |
| `notes-error` | Book loaded; notes area shows "Couldn't load your notes." with a "Try again" text button |
| `loading` | Whole-screen static skeleton |
| `error` | Whole-screen load error |
| `not-found` | Book not in the library |
| `offline` | `populated` content with a quiet offline banner |

## 5. Screen specification (populated, top to bottom)

These shared rules apply throughout:

| Area | Rule |
|---|---|
| Colours | Tokens from `useLibraryAppearance()` / `getLibraryAppearance(phase)` only |
| Spacing and radius | `LIBRARY_SPACING` and `LIBRARY_RADIUS` only |
| Targets | Every control has a minimum height and width of `MIN_TARGET` (48) |
| Type styles | FU-2 names: `title`, `heading`, `bodySerif`, `body`, `label`, `caption` |
| Font scaling | Stays on. No fixed heights on text containers (minimum heights only) |
| Width | Content column: horizontal padding `md` (16); max width 600, centred on wide screens (as home does at 1280) |
| Motion | None, except optional row expand. If animated, guard it with `AccessibilityInfo.isReduceMotionEnabled` |
| Background | Page `bgPrimary` |

### 5.1 Header

- **Back** text button, "‹ Library": accessible name "Back to Library", 48 tall, `label` style, `textPrimary`. In the prototype it is a no-op that calls `console.info('[FA-P1] would go back')`.
- **Header right:** a 48×48 empty space reserved for the SDD-08 ⋯ options/export menu. It is **not built** (SDD-07 §7: reserved slots are placement only). With `slots=1`, show an annotation there (§5.8).

### 5.2 Cover row

- **Cover:** 112×168, radius `COVER_RADIUS` (4, from `prototypeTokens.ts`), with a soft shadow in the `shadow` token at low opacity.
  - Populated: fixture image `src/prototypes/flowA/fixtures/cover-walden.png`. Copy it from [`fixture-cover-walden.png`](./evidence/flow-a-directions-2026-10-18/fixture-cover-walden.png), a plain generated cover.
  - The image is decorative (`accessible={false}`); the title beside it carries the name.
- **No cover:** a `coverPlaceholder` block of the same size with the title's initials (first letters of the first two significant words, e.g. "W" for Walden, "LO" for The Life and Opinions…) in `heading` style, `coverPlaceholderInk`. It is decorative. **Never white** in any phase.
- **Beside the cover:** title in `title` style, `textPrimary`, wrapping fully (no `numberOfLines`, no truncation at any text size); author in `body`, `textSecondary`.
- At widths under 340 px, or when the title needs more than 4 lines, the title block moves below the cover (stacked), not truncated.

### 5.3 Status

- A full-width segmented control with three segments, each at least `MIN_TARGET` tall:

    | Label | Value |
    |---|---|
    | "Want to read" | `want_to_read` |
    | "Reading" | `reading` |
    | "Finished" | `completed` |

  These sentence-case labels are the chosen design's. Today's `StatusSelector` says "Want to Read" / "Completed"; the owner reviews this copy at the prototype review.
- **Semantics:** the container has `accessibilityRole="radiogroup"` with the name "Reading status". Each segment has `accessibilityRole="radio"` and `accessibilityState={{ checked }}`.
- **Web keyboard:** roving focus, so the group is **one tab stop**. Only the checked radio has `tabIndex 0`; ←/→ move and select. This is what lets DP-01 count the group as 1.
- **Track:** `bgSecondary`.
- **Selected segment:** `bgCard` fill, 1 px `controlBorder`, `label` style in `textPrimary`. The border and weight change are the non-colour cue.
- **Unselected segments:** `body` style in `textSecondary`. No accent fill, so it never competes with the primary (DP-03).
- Labels never truncate. Under 360 px they may wrap to two lines, and the segment grows taller.
- Selecting changes local state only.
- **No date caption.** A1's "Started 2 Oct" needs reading-event data that does not exist yet. That space is the SDD-09 reserved slot (§5.8).

### 5.4 Your notes (A2 passages)

A `divider` hairline (decorative) separates status from notes.

**Header row:** "Your notes" in `heading`, `textPrimary`. On the right, plain-text "3 notes" / "1 note" in `body`, `textSecondary`. The count is never in a filled or rounded container (DP-04), and is hidden when there are 0 notes.

**Passages:** the **latest 2** notes, newest first. They are **static text, not pressable** (DP-01). There are no boxes or borders; passages are separated by `LIBRARY_SPACING.lg`.

| Part | Rule |
|---|---|
| Caption line (`caption`, `textTertiary`) | `{category} · p. {page} · {date}`. Omit the page when null. Category text comes from `categoryLabel()` in `src/features/books/notes/manualNoteContract.ts` (Quote, Thought, Takeaway, Action, Question). For `tag: null`, omit the category instead of printing "No category". Date is "14 Oct", from a fixed formatter with no `Date.now()`. |
| Body, `quote` category | `bodySerif` in typographic quotes “ ” |
| Body, every other category | `body`, no quotes |
| Body length | At most 4 lines, then an ellipsis (preview only) |

**Empty and partial states:**
- 0 notes: a single line "No notes yet." in `body`, `textSecondary`. No illustration, no nag.
- `notes-loading`: "Loading notes…" text, with no spinner.
- `notes-error`: "Couldn't load your notes." plus a "Try again" `TextButton`. This is the one extra control above the primary in that state, so the count is 4.

### 5.5 Primary action

**Add note:** a `PrimaryButton`, full width, `MIN_TARGET` tall, `accent` fill, `label` style in `textOnAccent`, radius `LIBRARY_RADIUS.control`. It is a no-op that calls `console.info`.

It is the **only** primary-styled element in every state that shows the page (DP-03). Tag it `testID="fa-primary"`.

**DP-01 (amended):** focusable controls from the top down to and including this button are ≤ 4.

| State | Controls |
|---|---|
| Populated | 3: Back, status group, Add note |
| When SDD-08 builds the ⋯ menu | 4 |
| `notes-error` | 4 |

### 5.6 Collapsed rows (after the primary)

- Start `LIBRARY_SPACING.xl` below the primary.
- **Plain rows:**
  - Minimum height `ROW_MIN_HEIGHT` (56).
  - `divider` hairlines between rows.
  - No fills and no counts in containers. This is the D07-10 condition for rows to enter the fold.
  - Label in `body`, `textPrimary`; an optional one-line secondary text in `body`, `textSecondary`; a chevron icon (`ICON_SIZE`, `textSecondary`) that turns down when expanded.
- **Semantics:** each row has `accessibilityRole="button"`, `accessibilityState={{ expanded }}`, and an accessible name made of the label plus the secondary text.
- Expanded content is **read-only presentation**. Editing UI belongs to the real build.

| # | Row | Secondary text | Expanded content | Visibility |
|---|---|---|---|---|
| 1 | All notes | — | None: a no-op that logs "would open notes list" | Hidden at 0 notes |
| 2 | My review | First line of the review, one line, ellipsised; "Not written yet" in `textTertiary` when absent | The user's own rating **rendered from the fixture number** (stars plus the accessible text "Your rating: 4 of 5"; no literal star strings in source); the full review in `body`; visibility as text, "Private" or "Public" | Always; collapsed by default (D07-02) |
| 3 | Saved pages | "1 page" / "n pages" | Each saved page as "p. {n}" plus its first line, read-only (no delete) | **Hidden when 0, collapsed when present** (D07-03) |
| 4 | Book information | — | Page count, publisher, published year, ISBN-13, then the description in `body` | Always |
| 5 | Ownership & condition | e.g. "Owned · Good", "Lent out" | Ownership and condition as read-only text. **No lending switch** (D07-08) | Always |
| 6 | Community reviews | "None yet" | "No public reviews yet." | Always. **Proposal for owner review:** A1 left community reviews out, and SDD-07 §6 left keep/move/collapse open. The prototype shows them collapsed, with only the honest empty state, because DP-04 bans sample people in fixtures. The real build renders real reviews from data. |

**Remove from library** follows the rows: a `TextButton` in `textSecondary`, at least 48×48 target, centred.
- Red is not used; DP-04 reserves `error` for real errors.
- It opens the confirm dialog (state `open=remove`).

### 5.7 Remove confirm dialog (`open=remove`)

- Modal over an `overlay` scrim, on a `bgRaised` surface with radius `LIBRARY_RADIUS.dialog`.
- Title "Remove from library?" (`heading`). Body: "Your notes for this book stay saved." Check this against today's `DeleteBookModal` copy and behaviour, and use today's wording if it differs; do not invent a promise.
- Buttons:
  - "Cancel" `TextButton`.
  - "Remove", a destructive confirm. Per DP-03 it is the state's one primary: `testID="fa-primary"`, using the `error` fill with `onErrorSurface` text, **only if** that pair is registered in FU-1a. Otherwise use the `accent` fill and report.
- The page behind is hidden from assistive tech (`aria-modal` on web, `importantForAccessibility="no-hide-descendants"` on native). Focus moves into the dialog and returns to the button on close.
- Both buttons are no-ops apart from closing.

### 5.8 Reserved-slot annotations (`slots=1` only)

| Slot | Location | Owner of the slot |
|---|---|---|
| SDD-08 options/export | 48×48 dashed outline at header right | Export menu |
| SDD-09 reading dates / reread | Dashed band under the status control | Reading history |

Annotations:
- use a `divider` dashed border and a `caption` label;
- are non-focusable and hidden from assistive tech (`accessible={false}`, `importantForAccessibility="no-hide-descendants"`, `aria-hidden` on web);
- are excluded from every count.

### 5.9 Whole-screen states

| State | Shows | Controls |
|---|---|---|
| `loading` | Header Back; a static skeleton (cover block in `coverPlaceholder`, two title bars and a status bar in `bgSecondary`). Accessible "Loading book" (`accessibilityLiveRegion="polite"` / `role="status"` on web). No spinner-only screen, no shimmer. | Back |
| `error` | "Couldn't load this book." (`heading`) and "Check your connection and try again." (`body`) | Back; primary "Try again" |
| `not-found` | "This book isn't in your library." (`heading`) and "It may have been removed." (`body`) | Back; primary "Back to Library" |
| `offline` | The populated page with a non-interactive info line under the header: "You're offline. Showing your last saved copy." (`body`, `info` on `infoSurface`). No dismiss button. It promises nothing about saving; that is Flow B's concern. | As populated |

## 6. Fixtures

File: `src/prototypes/flowA/fixtures.ts`. Content is typed, deterministic and honest.

**Books:** real public-domain works only.
- *Walden* (Henry David Thoreau, 1854).
- *The Life and Opinions of Tristram Shandy, Gentleman* (Laurence Sterne).
- Use plausible public metadata; leave ISBN null if unsure.

**Notes:** written as the user's own notes. Quote notes may quote these public-domain texts.

**Types:**
- Notes use the real `ManualNote` type (`import type` from `manualNoteContract.ts`).
- Other shapes use `import type` from their modules where possible, or local types with the same field names. Type-only imports from service modules are allowed; value imports are not.

**Banned in fixtures:**
- reviewer names or other sample people;
- literal rating or review-count strings;
- lending text;
- `Date.now()` or `new Date()` without an argument.

## 7. Files

**May create:**
- `app/(tabs)/library/dev-flow-a.tsx` (the route guard in §3, verbatim apart from formatting)
- `src/prototypes/flowA/BookDetailsPrototypeRoute.tsx` (reads params and picks switcher or screen mode; holds the marker)
- `src/prototypes/flowA/PrototypeSwitcher.tsx`
- `src/prototypes/flowA/BookDetailsPrototype.tsx`
- `src/prototypes/flowA/components/` — `Header`, `CoverBlock`, `StatusSegments`, `NotePassages`, `DetailRow`, `PrimaryButton`, `TextButton`, `RemoveDialog`, `ScreenStates`, `ReservedSlot`, `OfflineNotice`
- `src/prototypes/flowA/fixtures.ts`
- `src/prototypes/flowA/fixtures/cover-walden.png`
- `src/prototypes/flowA/prototypeTokens.ts` — the **only** file with numeric design literals:
  - `COVER_SIZE` 112×168, `COVER_RADIUS` 4, `ICON_SIZE` 20, `ROW_MIN_HEIGHT` 56;
  - the FU-2 type-scale mirror until `LIBRARY_TEXT` exists:

    | Style | Size / line height |
    |---|---|
    | `title` | 26/32 |
    | `heading` | 21/27 |
    | `bodySerif` | 18/26 |
    | `body` | 16/24 |
    | `label` | 16/22 |
    | `caption` | 14/20 |

  - `PROTOTYPE_PAIRS`, the foreground/background token pairs used.
- `src/prototypes/flowA/__tests__/*.test.tsx`
- Capture evidence: `docs/user/library/evidence/fa-p1-prototype-<date>/` (capture script, config, PNGs, README)

**Must not modify:**
- `app/(tabs)/library/[bookId].tsx`, `_layout.tsx` or any other route;
- `src/components/**`, including `LibraryAppearance.ts` and `LibraryTypography.tsx`;
- services, hooks, stores;
- `package.json` / lockfile;
- jest or tsconfig;
- `app/(tabs)/_layout.tsx`, `app/_layout.tsx`.

If any of these seems necessary, stop and report.

## 8. Tests the builder adds (Jest, `jest-expo` + `@testing-library/react-native`)

1. **Render matrix:** every preset × 3 phases renders without errors and shows its key text. Use assertions, not snapshots.
2. **DP-03:** exactly one `fa-primary` per state. In `open=remove`, the only *accessible* primary is the dialog's confirm.
3. **DP-01 (amended):** walk the accessible elements in document order and count focusable ones up to and including `fa-primary`, counting the radiogroup once. The count must be ≤ 4 in every page state. Every element after the primary that is a row must be a `DetailRow` with no background fill.
4. **Radio group:** exactly one radio is focusable (`tabIndex 0` on web); arrow keys change the selection. Simulate this with `fireEvent` on the handlers.
5. **D07-02 / D07-03:** the review is collapsed by default; the Saved pages row is absent when the fixture has 0 saved pages and present (collapsed) otherwise; All notes is absent at 0 notes.
6. **DP-04:**
   - no `★`, `rating`/`reviews (`, "lend" or "Available for Lending" literals in `src/prototypes/flowA/**` (read the files);
   - the notes count is a `Text` whose ancestors up to the header have no `backgroundColor`;
   - the stars in My review render from the fixture number.
7. **DP-02:** no hex or `rgb(a)` literals anywhere in `src/prototypes/flowA/**`, and no numeric `fontSize`/`lineHeight`/`margin*`/`padding*`/`gap` outside `prototypeTokens.ts` (read the files). `caption` is used only on metadata (`testID`s ending `-meta`).
8. **DP-06:**
   - every pressable has a role, an accessible name and a minimum height ≥ `MIN_TARGET`;
   - every pair in `PROTOTYPE_PAIRS` exists in FU-1a's `BOOK_TOKEN_PAIRS`;
   - the no-cover placeholder is not `#fff`/white in any phase (compare to the `coverPlaceholder` token);
   - the dialog hides the page behind it from assistive tech.
9. **Phase override:** `phase=midnight` gives a root background of `getLibraryAppearance('midnight').bgPrimary`; the same holds for golden.
10. **Isolation and release guard:**
    - no file outside `src/prototypes/` and `app/(tabs)/library/dev-flow-a.tsx` contains `prototypes/` in an import (scan `app/` and `src/`);
    - no prototype file value-imports `supabase`, `@tanstack/react-query`, `/services/`, `/gateway`, `useAuth`, `AsyncStorage` or `router.push`/`replace` (`import type` is allowed);
    - with `__DEV__` mocked false, the route renders `<Redirect>`.

**Also run:**
- `npx jest "app/(tabs)/library" src/components/library src/components/notes src/prototypes`: all pass, with existing suites unchanged.
- `npx tsc --noEmit`: no new diagnostics. Compare against the recorded 36 outside Library.

**Web evidence** (Playwright on the fake-auth harness; nothing is written):
- each preset × 3 phases at 390×844, plus `populated` at 320×844 and 1280×800;
- an axe scan per capture if `@axe-core/playwright` has been installed by FU-5a/5d (approved tool list). If it isn't installed yet, record that it was not run;
- the release-bundle marker check from §3.

## 9. Done criteria (tied to DP-01–DP-07)

| Rule | Done when |
|---|---|
| DP-01 (amended) | Jest count ≤ 4 down to the primary in every page state. The 390×844 captures show cover, title, status and the latest notes before the primary; rows after it are plain. |
| DP-02 | Tests 7 and 1 pass. All text ≥ 16 except `caption` metadata. Fonts are EB Garamond and Manrope in the captures. |
| DP-03 | Test 2 passes. |
| DP-04 | Test 6 passes. No sample people, ratings, badges or lending anywhere. |
| DP-05 | Every row of §4 exists, renders and is captured in all three phases. |
| DP-06 | Tests 4 and 8 pass, plus axe (or a recorded reason it didn't run). Captures at 320 px show no truncated status labels or titles. |
| DP-07 | Tokens and fonts only, from the library set. The owner compares the captures with the shelf in all three phases. |
| Isolation | Test 10 passes; the release marker is absent; `[bookId].tsx` is unchanged (`git diff --stat` shows only the files in §7). |

After that, the **owner reviews** the prototype and its capture README. The review also settles:
- the status labels ("Finished" vs "Completed");
- the Community reviews row;
- D07-08's lending-switch removal for the real build.

## 10. Out of scope

- Any real data wiring: queries, mutations, review save/blur logic (the IR01/RR01/RR02 fixes in `[bookId].tsx`), note navigation, the remove mutation, offline detection. These belong to the later **Flow A build**, which ports the approved prototype onto `[bookId].tsx`.
- Building the SDD-08 options/export menu or the SDD-09 dates/reread display; their slots are annotations only.
- Shared components (`BookButton`, state components; FU-4a/4b).
- Notes, composer, capture, home or search screens.
- Native device acceptance. This prototype is web-first; native rendering is checked in the real build.
- Any database, storage, migration or Supabase access. Any install. Any git publication by the builder.

## 11. Risks

| Risk | Mitigation |
|---|---|
| FU-1a token values change after owner swatch approval | Read tokens by name only; rerun the captures after approval |
| A missing token or registered pair | Stop and report; do not add tokens here |
| RN-web radio semantics: each `Pressable` is a tab stop by default | Explicit roving `tabIndex` (test 4) |
| `__DEV__` stripping not happening | Release marker check is a done criterion |
| The route sits behind sign-in | Use the fake-auth harness for captures; humans sign in normally |
| Font loading flash, since FU-2 is not at layout level yet | Wrap the prototype in `LibraryTypographyProvider` until FU-2 lands |
| The prototype drifts into a second Book Details | It is deleted, or kept only as a design fixture, when the Flow A build lands. The orchestrating session decides at that time. |
