# SDD-07 Wave 2 web capture: results (2026-10-19)

Scope: Book Details recoloured onto library tokens, plus notes list, note reader and composer. Viewport 390x844. Phases: daylight, golden, midnight.

Run: `npx playwright test -c w2-playwright.config.ts --grep "W2 |C01 |C03 " --timeout=90000 --workers=1 --reporter=list` against Expo web on port 8084 (wave2 worktree). Result: 32 passed (5.5 min), 0 non-GET writes.

## Results

| Check | Result | Evidence |
|---|---|---|
| C1 page errors | PASS: 0 page errors in all 32 tests | w2-console-log.json |
| C1 console errors | PASS (with note): only `Failed to load resource: net::ERR_FAILED`, which are harness-aborted requests. No other console errors. | w2-console-log.json |
| C1 "error" text | PASS (visual): no error banner in any captured screen. Not searched in DOM. | screenshots |
| C2 notes screens not green | PASS: primary "Add note" is dark brown rgb(62,50,37) daylight, rgb(73,54,39) golden, rgb(223,196,150) midnight. Page background not sampled; visually cream/dark, not green. | w2-colour-samples.json, w2-daylight-notes-list.png |
| C3 golden differs from daylight on notes | PASS: Add note rgb(73,54,39) vs rgb(62,50,37); Delete note / Scan text chip rgb(255,249,237) vs rgb(255,253,248) | w2-colour-samples.json |
| C4 Book Details no-cover block not white | PASS (visual): placeholder cover is beige in all phases. Exact computed colour not sampled. | w2-daylight-details-nocover.png, w2-golden-details-nocover.png, w2-midnight-details-nocover.png |
| C5 selected chip readable | PASS (visual): selected Owned / Good chips filled with a gold tint and dark text in midnight. Chip colours not recorded per phase in the DOM sample. | w2-midnight-details-review-controls.png |
| C5 filled rating stars | INCONCLUSIVE: no star elements were found by the DOM sampler, and no star is visible in the captured region. Not verified. | w2-*-details-review-controls.png |
| C6 layout vs 2026-10-18 audit C01/C03 | PASS (visual): layout matches audit C01 (populated) and C03 (no cover); only colours differ. | C01.png, w2-daylight-details-populated.png |
| C7 non-GET requests | PASS: 0 non-GET writes recorded (WRITE AUDIT line in pw log) | pw-w2 log, w2-notes.json |
| Composer crop step | NOT REACHED in all 3 phases: no "Continue preparing photo" control on web. | w2-notes.json |
| Composer discard dialog | PASS: reached in all 3 phases | w2-*-composer-discard-dialog.png |
| Remove dialog | PASS: reached in all 3 phases | w2-*-details-remove-dialog.png |

## Screenshots

For each phase (daylight, golden, midnight), the following are in this folder with the names `w2-<phase>-<screen>.png` (each has a `-fold` variant):

- details-populated, details-nocover, details-review-controls, details-remove-dialog
- notes-list, note-reader
- composer-choose, composer-category-picker, composer-write, composer-discard-dialog, composer-crop (crop screen content not reached; see above)

Files: `w2-colour-samples.json`, `w2-console-log.json`, `w2-notes.json`, `write-audit.json`.

## Open items

- C5 rating stars not verified.
- Composer crop step not reachable on web.
- The composer-crop PNGs were saved after the Scan intake, but the crop step itself was not reached, so they are not crop-step evidence. Not visually inspected.
