# SDD-07 FU-2 web capture check (2026-10-18)

Read-only QA capture of the library screens on the Expo web dev server from the fu1a worktree (`C:\Users\LEGION\Desktop\Bookconnect4_fu1a`), port 8084, 390x844 viewport, Edge via Playwright. Themes forced by hour: daylight 12, golden 18, midnight 22.

## How it was run

- Server: `CI=1 npx expo start --web --port 8084` from fu1a, background. Ready on first poll. Stopped afterwards; port 8084 closed.
- Harness: copy of `library-screen-audit-2026-10-18/capture.pw.ts` in this folder (`fu2-capture.pw.ts`). Changes to the copy: baseURL 8084, absolute path to the cover fixture, and appended FU-2 tests (search per theme, font report, early home, console capture). The original audit folder is not modified.
- Fixtures: every https request intercepted. Supabase GET reads from fixtures; non-GET writes aborted and recorded. Fake OTP login as in the audit. Google Books and Open Library faked.
- Run: 55 tests passed (the `--grep` filter did not narrow the run, so the full harness file ran). Then 1 extra probe (home heading font).
- Outputs: `write-audit.json`, `fu2-console-and-fonts.json`, `results.json`.

## Results

| Check | Verdict | Evidence |
|---|---|---|
| C1 no page errors / console errors / "error" text | PASS | pageErrors 0 on every FU2, G02 and E01 test. Console entries are warnings only (shadow* deprecation, expo-notifications web listener, Sentry DSN missing). No "error" text in any FU2, G02 or E01 .txt. B04.txt contains "Google Books API error: 500" from the deliberate provider-error fixture, already flagged in the audit; not part of the requested set. |
| C2 fonts on home and search | PASS (with caveat) | Loaded on home and search: LibraryGaramondSemiBold, LibraryManrope, LibraryManropeBold. LibraryGaramondMedium is unloaded on all screens (not used on these screens). Search heading "Find books" computes to LibraryGaramondSemiBold. Home book titles compute to LibraryGaramondSemiBold, authors to LibraryManrope. Caveat: home has no h1/h2 role element. The "My Library" probe matched the bottom tab-bar label, which is system-ui, not a page heading. |
| C3 compare home with audit G02 | PASS | All 9 new G02 captures (home, details, composer x3 themes) are byte-identical (MD5) to the audit G02 captures. No visible difference, same layout, fonts and theme. |
| C4 no blank while loading | PASS | `FU2-C4-home-early.png`: spinner on the cream background with the tab bar visible. Not blank. Caveat: taken after the login redirect with user_books held 4 s, not at domcontentloaded of a cold URL. |
| C5 non-GET writes other than fake auth | PASS | `write-audit.json`: totalWrites 0. Auth POSTs are fixture login only. |

Flagged screenshots: none new. The audit flags still apply to the identical captures (for example the white no-cover placeholder in details, and the bottom tab labels truncated at 390 px). Not re-judged here.

Key screenshots (fold and full-page variants are in this folder):
- `G02-daylight-home.png`, `G02-golden-home.png`, `G02-midnight-home.png`
- `FU2-S-empty-daylight-fold.png`, `FU2-S-query-golden-fold.png`, `FU2-S-query-midnight.png`
- `FU2-C4-home-early.png`
- Book Details: `G02-daylight-details.png`. Note reader: `E01.png`.

## Git status, fu1a

Before and after `git status --short` are identical:
```
?? .spec-out/
?? .spec/
```

## Cleanup

- Expo server on 8084 stopped. `curl http://localhost:8084` returns connection refused. No Playwright or Edge processes left from this run.
- fu1a `.env` left in place for the orchestrator to delete. No fu1a file was edited, no installs, no database access, no `.env` contents printed.
- Playwright `test-output/` removed from this folder.
