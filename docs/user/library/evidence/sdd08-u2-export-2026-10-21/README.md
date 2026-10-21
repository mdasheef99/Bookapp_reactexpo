# SDD-08 U2 export web verification (2026-10-21)

Target: sdd08/export worktree `C:\Users\LEGION\Desktop\Bookconnect4_sdd08`. Expo web on port 8086 (`npx expo start --web --port 8086 --clear`, CI=1), placeholder `.env` (deleted afterwards). Edge via Playwright, 390x844 unless stated. No app or test source was edited. No state-changing git command was run. Supabase traffic was intercepted and answered by fixtures; no request reached a real project.

Files: `sdd08-u2.pw.ts` (checks), `playwright.sdd08u2.config.ts`, `sdd08-u2-results.json` (verdicts and measured values), `requests.json` (every request URL, method and Range header), `library.csv`, `notes.md`, screenshots `shot-01` to `shot-09`, `git-status-before.txt` and `git-status-after.txt`.

Harness source: `sdd08-u2.pw.ts` was adapted from `tb2-tab-bar.pw.ts`. That folder exists only in the `Bookconnect4_tabbar` worktree (committed in 7a079cf), not in this worktree, so it was read from there.

## Results

| ID | Check | PASS/FAIL | Measured value |
|---|---|---|---|
| E1-button | "Export library as CSV" visible beside "Add a book" | FAIL | Visible, but at 390 it wraps onto its own row: Add a book y=65 (x 248 to 366), Export y=126 (x 24 to 157). |
| E1-filename | Download name matches bookconnect-library-YYYY-MM-DD.csv | PASS | bookconnect-library-2026-10-21.csv |
| E1-csv | BOM, CRLF only, header, formula cell quoted with apostrophe, Devanagari intact | PASS | BOM bytes EF BB BF; no bare LF; header starts `Title,Authors,ISBN-13,`; formula cell `"'=Formula, ""Quoted"" Title"`; Devanagari present |
| E1-caption | "Saved to your downloads." visible | PASS | visible |
| E2-dialog-shape | Dialog role, radiogroups Format and Scope, privacy line, Export and Cancel | PASS | radiogroups Format, Scope; privacy line 1; Export 1; Cancel 1 |
| E2-choose | Markdown file and This book selected | PASS | checked: Markdown file, This book |
| E2-filename | bookconnect-notes-…-YYYY-MM-DD.md | PASS | bookconnect-notes-formula-quoted-title-2026-10-21.md |
| E2-quote | Quote lines start with "> " | PASS | `> First line of the quote`, `> Second line of the quote` |
| E2-caption | "Saved to your downloads." appears | PASS | visible |
| E3-ready | Ready text and primary Print | PASS | "Your PDF is ready. Choose Print, then Save as PDF." visible; Print visible; 1 hidden iframe before Print |
| E3-print | One print call, dialog closed, no error caption | PASS | print calls 1; dialog closed; error captions 0 |
| E3-afterprint | Hidden iframe after afterprint | PASS (recorded) | Iframe was already removed when Print was clicked (0 after Print). Dispatching afterprint then found no iframe. |
| E4 | Cancel removes the iframe | PASS | iframes before Cancel 1; after Cancel 0; dialog closed |
| E5-localhost | Offline on localhost: buttons disabled, caption | FAIL (hook exemption) | Export still enabled on localhost even with navigator.onLine=false. `useNetworkStatus` treats localhost previews as always online (`isLocalPreview`). Not an export bug, but this origin cannot test offline. |
| E5-app-localhost | Same check on http://app.localhost:8086 | PASS | Notes button disabled (aria-disabled=true) and caption visible (2 nodes); library button disabled and caption visible |
| E6-library-320 | Library at 320: scrollWidth = viewport, header controls inside | PASS | scrollWidth 320 = innerWidth 320; no overflowing controls |
| E6-notes-320 | Notes at 320 | PASS | scrollWidth 320; no overflowing controls |
| E6-library-zoom2 | Library at zoom 2 on 390 | PASS | scrollWidth 390; no overflowing controls |
| E6-notes-zoom2 | Notes at zoom 2 on 390 | PASS | scrollWidth 390; no overflowing controls |
| E7-tab | Tab reaches radios, Export and Cancel | PASS | Forward from initial focus (Cancel): Markdown radio > This book radio > Export > Cancel. Initial focus is on Cancel (set by the dialog). |
| E7-escape | Escape closes the dialog when not busy | PASS | dialog closed |
| E8-writes | No non-GET to reading_notes or user_books | PASS | 0 such requests; no non-GET reached the fixture |
| E8-hosts | Every request to placeholder or localhost | FAIL (harness fixture) | Hosts: localhost, app.localhost, placeholder.supabase.co, covers.fixture.test. The only outside host is covers.fixture.test, the harness cover-image fixture (11 GETs). It is fulfilled in the browser and never leaves the machine. |

Console errors during the recorded runs: none.

## FAILs and why

- **E1-button:** an app layout result at 390 (the header wraps the export button onto its own row). It is visible and works, but it is not beside "Add a book" at this width.
- **E5-localhost:** a harness and hook limitation. `useNetworkStatus` exempts localhost. The offline result comes from the non-local origin `app.localhost`, which passes.
- **E8-hosts:** a harness limitation. The fixture cover host `covers.fixture.test` was kept from the old harness. Every request to it was fulfilled locally.

## Harness notes (disclosed)

1. Port 8086. Edge (`msedge.exe`) as the browser. Placeholder `.env` (deleted).
2. Fixtures: `user_books` returns two rows on the first page (Range start 0 or no offset) and `[]` after. The `id=eq.` single read returns the matching book. `reading_notes` returns two notes for the first book (a 2-line quote on page 12, and a reflect note). Every other route is as in the tb2 harness. Requests were recorded to `requests.json`.
3. E5 flow: notes are opened online first, then offline is set on that page and back navigation returns to the library. An earlier attempt that navigated to the notes page while offline hung Playwright and was replaced. Its verdicts were removed from the results file.
4. Several full runs stalled after the first tests, and the runs were stopped. Each remaining group was re-run alone. Verdicts from the successful runs were kept and merged into `sdd08-u2-results.json`.
5. The first full run failed before any check because the config's Windows path lost its backslashes. The config was fixed to forward slashes. No verdicts came from that run.
6. Non-GET Supabase requests are aborted by the harness and recorded. None occurred.
7. Paging: the export loaders send `offset=0&limit=500` query parameters (no Range header). The harness honours both forms, and the first page returns the rows.

## Cleanup

- The Expo server on port 8086 was stopped (port closed).
- `.env` was deleted.
- No app or test source was edited. No state-changing git command was run.
- `git-status-before.txt` and `git-status-after.txt`: the only new entries are in this evidence folder. One exception: `.spec/U2-FIX2-REVIEW-LUNA.md` appeared in the worktree during the run. This run did not create it.

## Not verified

- Real Supabase data (fixtures only).
- The native print dialog (stubbed by design).
- Screen reader behaviour (axe not run).
