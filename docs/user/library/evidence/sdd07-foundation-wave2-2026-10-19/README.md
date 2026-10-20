# SDD-07 foundation Wave 2 — FU-1b notes, FU-1c Book Details (2026-10-19)

**Status:** BUILT and REVIEWED. **Not committed, awaiting the owner's approval.** Nothing staged, committed or pushed.
**Where:** worktree `Bookconnect4_wave2`, branch `sdd07/wave2`, base `6644689` (Wave 1 tip on `sdd07/fu1a-fu3`).
**Plan:** [SDD-07-FOUNDATION-PLAN.md](../../SDD-07-FOUNDATION-PLAN.md) §3 (unit specs) and §8 (build status).

## What was built

Both units move colours only, onto `useLibraryAppearance` tokens. No layout, copy or behaviour changes except the Cancel button border noted below.

| Unit | Scope | Built by |
|---|---|---|
| FU-1c | Book Details (`[bookId].tsx`) and its controls and dialogs | Codex `gpt-6.1-sol` |
| FU-1b | Notes list, note reader and composer | Built in a separate worktree (`wave2n`) and applied to `sdd07/wave2` as a patch |

**Protected logic unchanged:** in `[bookId].tsx`, `handleSaveReview`, `reviewDraft`, the queries, the mutations and navigation are unchanged. This was confirmed by both reviews and by the lead's own diff check.

## Design decisions

These were made by the lead under the owner's design delegation, and are **to be shown to the owner**:

| Part | Before | After |
|---|---|---|
| `ConditionPicker` selected state | Green/red hues that failed contrast | Chip tokens (`chipSelected*`) |
| `RatingInput` filled star | Gold | `accent` |
| Control borders | Mixed | `controlBorder` |
| No-cover block | White / remote placeholder | `coverPlaceholder` |
| Dialogs | Mixed | `bgRaised` |
| Note quote stripe | — | Unchanged (D07-04) |

## Independent review (read-only)

**Gemini 4 Argon: "YES WITH FIXES".**

| Id | Finding |
|---|---|
| F1 | Test gaps: crop step, drag handle, "Keep editing" |
| F2 | The source guard missed 3 note routes |
| F3 | `DeleteBookModal` Cancel at 1.01:1 in midnight |
| F4 | 3 duplicate 463 KB fixtures |
| F5 | A stale mock |

**Codex `gpt-6.1-sol` xhigh: "YES WITH FIXES".**

| Id | Finding |
|---|---|
| R1 | The web `Switch` keeps its default teal thumb: 2.18:1 against the midnight accent track |
| R2 | The crop outline uses `accent`: 1.68:1 against the white page |
| R3 | The no-cover case loads a remote `via.placeholder.com` image, which hides `coverPlaceholder` |

**All 8 were verified by the lead and fixed by Codex:**
- Switch thumb is `textOnAccent` (web `activeThumbColor`; native `thumbColor` when on).
- Crop outline is `controlBorder`.
- The no-cover image source is `undefined`, so `coverPlaceholder` shows.
- `DeleteBookModal` Cancel gets a 1px `controlBorder` border, with padding 14 → 13 so the height is unchanged. **This is the one visible change outside colour.**
- One shared `book-details.json` fixture replaces the 3 duplicates.
- Tests extended for crop, handle, "Keep editing" and the 3 note routes; the stale mock cleaned.

## Verification (run by the lead)

| Check | Result |
|---|---|
| Jest `--runInBand`, library + notes scope | 27 suites / 520 tests pass |
| `npm run lint:library` | 32 problems (3 errors, 29 warnings) — same as the baseline |
| `tsc --noEmit` (whole repo) | 36 errors, the same count on the base branch. All are pre-existing, in marketplace `supabase/functions` and one e2e spec. |
| Codex's broader Jest run | 695 / 697. The 2 shelf failures reproduce on the pre-edit sources. |

**Correction on `tsc`:** earlier "tsc 0 errors" results in these docs came from the narrower `tsc -p tsconfig.library-notes.json` check. They are scoped results, not whole-repo results.

## Web capture (Haiku, Playwright)

[`web-capture/`](./web-capture/README.md):
- Setup: placeholder-only `.env`, with all https requests intercepted.
- Results: **32 passed**, 0 non-GET requests, 0 page errors.
- **The captures predate the R1–R3 and F3 fixes**, so they don't show the Switch thumb, crop outline, no-cover source or Cancel border changes.
- Gaps (covered by Jest instead):
  - rating stars were not found on web;
  - the composer crop step is not reachable on web.

## Database and storage

No mutations. The placeholder `.env` was deleted from `Bookconnect4_wave2`.

## Residual and follow-up

- `via.placeholder.com` is still used as a remote fallback:
  - in `LibraryBookList.tsx` (Library, a later unit);
  - in exchange and clubs files (out of scope).
- `@axe-core/playwright` (FU-5d) is still not installed.

## Next

1. The owner decides whether to commit Wave 2 on `sdd07/wave2` (no push).
2. TB-1 stays parked (the "Marketplace" label decision and commit approval).
