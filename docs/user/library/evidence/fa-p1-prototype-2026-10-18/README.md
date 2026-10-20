# FA-P1 prototype screen capture (2026-10-18): 57 of 57 captured

> **Flow A FINALIZED 2026-10-18** (SDD-07 §10, D07-11–D07-15). This file is the round 1 capture. Later rounds:
> - [round 2](./round2/README.md): 60 of 60;
> - [round 3](./round3/README.md): including the overflow attribution;
> - [`reviews/`](./reviews/): Codex round 2, space-bunny round 4, Gemini Argon final, and the essence checklist.

**Result: 57 pass, 0 fail (Playwright).** Every capture produced a full-page PNG, a first-viewport `-fold.png` and a `.txt` body dump. Every fold screenshot was reviewed by eye. The flags below are visual findings, not capture failures.

**Harness non-GET writes: 0** (`write-audit.json`, `totalWrites: 0`). The 114 non-GET requests recorded are all fake-auth POSTs (`auth/v1/otp` and `auth/v1/verify`, 57 each); the harness answered them with fixtures and nothing reached a real backend.

## How it was run

1. Baseline: `git -C C:\Users\LEGION\Desktop\Bookconnect4_fu1a status --short` (captured before the run; see the end of this file).
2. Environment: the owner copied the library's local `.env` into fu1a (git-ignored; values not recorded here). It sets `EXPO_PUBLIC_DEV_SKIP_AUTH`, so the login step may be skipped. The harness handles both: it fills the fake-OTP login only if the phone field appears, otherwise it waits for `/library`.
3. Dev server: `npx expo start --web --port 8084` from `C:\Users\LEGION\Desktop\Bookconnect4_fu1a`. Bundle served from `/node_modules/expo-router/entry.bundle` (HTTP 200).
4. Single probe first (`-g "FA populated-daylight$"`): passed in 17 s. Then the full suite.
5. Full run: `node node_modules/@playwright/test/cli.js test --config docs/user/library/evidence/fa-p1-prototype-2026-10-18/playwright.capture.config.ts --reporter=line`, run from the library worktree. Result: `57 passed (6.1m)`.
6. Dev server on port 8084 stopped after the run (port confirmed closed). The Playwright run exited on its own.

Fixtures: every https request is intercepted. Supabase auth is faked, the `user_books` GET returns an empty list (the prototype reads its own fixtures), and the Google Books and Open Library calls return empty results. Non-GET Supabase writes are aborted and counted. Localhost dev-server traffic is not intercepted.

## Pass / fail per capture

Capture = 390x844 unless noted. Each row is a `-fold.png` plus full-page `.png` plus `.txt`.

| Capture | Result | Focusable up to `fa-primary` | Flags |
|---|---|---|---|
| populated-daylight | PASS | 5 | F1, F2 |
| populated-golden | PASS | 5 | F1, F2 |
| populated-midnight | PASS | 5 | F1, F3 |
| no-cover-daylight | PASS | 5 | F1, F2 |
| no-cover-golden | PASS | 5 | F1, F2 |
| no-cover-midnight | PASS | 5 | F1, F3 |
| zero-notes-daylight / golden / midnight | PASS | 5 | F1 (F2 or F3) |
| many-notes-daylight / golden / midnight | PASS | 5 | F1 (F2 or F3) |
| long-title-daylight / golden / midnight | PASS | 5 | F1 (F2 or F3) |
| saved-absent-daylight / golden / midnight | PASS | 5 | F1 (F2 or F3) |
| review-absent-daylight / golden / midnight | PASS | 5 | F1 (F2 or F3) |
| want-to-read-daylight / golden / midnight | PASS | 5 | F1 (F2 or F3) |
| finished-daylight / golden / midnight | PASS | 5 | F1 (F2 or F3) |
| lent-out-daylight / golden / midnight | PASS | 5 | F1, F2/F3, F7 |
| uncategorised-note-daylight / golden / midnight | PASS | 5 | F1 (F2 or F3) |
| notes-loading-daylight / golden / midnight | PASS | 5 | F1 (F2 or F3) |
| notes-error-daylight / golden / midnight | PASS | 6 | F1 (F2 or F3) |
| loading-daylight / golden / midnight | PASS | 0 (no primary, expected) | F1 (F2 or F3) |
| error-daylight / golden / midnight | PASS | 2 | F1 (F2 or F3) |
| not-found-daylight / golden / midnight | PASS | 2 | F1 (F2 or F3) |
| offline-daylight / golden / midnight | PASS | 5 | F1 (F2 or F3) |
| populated-daylight-open-review | PASS | 5 | F1, F2 |
| populated-daylight-open-saved | PASS | 5 | F1, F2 |
| populated-daylight-open-remove | PASS | 2 | F1, F2, F4 |
| populated-daylight-slots1 | PASS | 5 | F1, F2, F5 |
| populated-daylight-w320 (320x844) | PASS | 5 | F1, F2, F6 |
| populated-daylight-w1280 (1280x800) | PASS | 5 | F1, F2, F8 |

Flags F2/F3 mean daylight/golden (F2) or midnight (F3) backgrounds. Count per capture: 57 captures, 57 passes.

## Flags (visual, by eye)

- **F1 (every capture): bottom tab bar is broken.** Tab icons render as fallback "▼" glyphs, not icons. Labels are truncated at 390 wide ("My Li", "Exch", "Mark", "Profile", "mark"). The bar is white in midnight. Paths: `*-fold.png`, e.g. `populated-daylight-fold.png`, `populated-midnight-fold.png`. Same finding as the earlier audit (cross-cutting 1).
- **F2 (daylight/golden): golden looks the same as daylight.** Both show the same cream background, so the golden phase is not visibly distinct. Paths: `populated-golden-fold.png` vs `populated-daylight-fold.png`.
- **F3 (midnight): dark, readable, no white placeholder.** The no-cover placeholder is a dark block with a "W" monogram, so the white-placeholder finding from the earlier audit is not reproduced here. Recorded as a pass for that item (`no-cover-midnight-fold.png`).
- **F4 (populated-daylight-open-remove): two `fa-primary` nodes.** The destructive "Remove from library?" dialog is open with a red "Remove" button, and the page's dark "Add note" primary is still in the DOM behind the scrim (count 2). Worth checking that only one primary is focusable while the dialog is open. Path: `populated-daylight-open-remove-fold.png`.
- **F5 (populated-daylight-slots1): prototype slot labels overlay the page.** "SDD-08" (top right, next to Library) and "SDD-09 · Reading dates / reread" (under the segmented control) are dashed placeholder boxes. Intentional for the slots view, but they are visible on the fold. Path: `populated-daylight-slots1-fold.png`.
- **F6 (populated-daylight-w320): crowded at 320 wide.** Segmented control labels wrap ("Want to / read"), and the tab bar is badly truncated ("Ma", "Pro", "ma"). Path: `populated-daylight-w320-fold.png`.
- **F7 (lent-out): no visible lent-out state above the fold.** `lent-out-*-fold.png` looks the same as populated. The lent indicator, if any, is below the fold, so it is not verified here. Paths: `lent-out-daylight-fold.png`, `lent-out-golden-fold.png`, `lent-out-midnight-fold.png`.
- **F8 (populated-daylight-w1280): tab bar labels are cut at desktop width too.** "marketplace..." is truncated and the icons are still fallback glyphs. Path: `populated-daylight-w1280-fold.png`.

Items checked and OK (no flag): loading skeletons (no primary button, `loading-*-fold.png`); error and not-found states ("Couldn't load this book." with Try again; "This book isn't in your library." with Back to Library); notes error and loading states; offline banner ("You're offline. Showing your last saved copy.", `offline-*-fold.png`); zero-notes "No notes yet."; uncategorised note has no category label (expected).

## Writes

- Harness non-GET writes: **0** (`write-audit.json`, `totalWrites: 0`, `totalNonGetRequestsAllHosts: 114` = 57 otp + 57 verify fake-auth POSTs).
- Harness read-only fixture: one `GET /rest/v1/user_books` per capture, answered empty (recorded in `capture-index.json`, `unhandledReads`).

## fu1a git status

Before (captured at the start of the run):
```
 M src/components/library/LibraryAppearance.ts
 M src/components/library/__tests__/LibraryAppearance.test.ts
?? .spec-out/
?? .spec/
?? app/(tabs)/library/dev-flow-a.tsx
?? src/prototypes/
```

After (captured after the run and the dev server stop): identical to "before". The job edited no app, config or package files. The `.env` file copied into fu1a is git-ignored and does not appear in status.
