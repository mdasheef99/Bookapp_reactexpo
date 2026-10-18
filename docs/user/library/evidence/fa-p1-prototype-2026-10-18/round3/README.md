# FA-P1 Book Details prototype, round 3 visual recheck (2026-10-18)

Target: Expo web dev server from `C:\Users\LEGION\Desktop\Bookconnect4_fu1a` on port 8084, route `/library/dev-flow-a` with `?s=<preset>&phase=<phase>`. Fake auth and fixture transport as in round 2 (all Supabase writes aborted; no real backend).
Zoom 200% is emulated with CSS `zoom: 2` on `<html>`, the same method as round 2 K8.

Scripts in this folder (copies; round 2 files were not edited):
- `r3-checks.pw.ts`: R1, R2, R5 zoom captures and R3 width captures. Its fixture helpers are the head of round 2 `capture.pw.ts`; the round 2 capture list was replaced.
- `r3-zoom-status.pw.ts`: supplementary zoom 200% captures of the status control and title (the 390x844 viewport at zoom 2 does not show the status control).
- `keyboard.pw.ts`, `playwright.capture.config.ts`: unchanged round 2 copies. Run at 390x844.

## Results

| Check | Scope | Verdict | Evidence |
|---|---|---|---|
| R1 K8 | Populated, daylight, 390x844, zoom 200% | **FAIL** (overflow) | scrollWidth 399 > 390. Title "Walden" and "Want to read", "Reading", "Finished" intact by eye, no mid-word breaks. `kb-k8-zoom2-390.png`, `r-zoom2-390-daylight-populated-status.png`, `r-zoom2-390-daylight-populated-title.png` |
| R2 long title | Tristram Shandy preset, daylight, zoom 200% | **FAIL** (overflow) | scrollWidth 399. Title wraps on word boundaries only; status labels intact. `r2-long-title-zoom2-390.png`, `r-zoom2-390-daylight-long-title-status.png`, `r-zoom2-390-daylight-long-title-title.png` |
| R3 w320 | Populated, daylight, zoom 100% | PASS | scrollWidth 320 = width. No mid-word breaks. Status: vertical list (3 rows). Title beside cover. `w320-fold.png` |
| R3 w360 | same | PASS | scrollWidth 360 = width. Status: vertical list (3 rows). Title beside cover. `w360-fold.png` |
| R3 w390 | same | PASS | scrollWidth 390 = width. Status: vertical list (3 rows). Title beside cover. `w390-fold.png` |
| R3 w430 | same | PASS | scrollWidth 430 = width. Status: one horizontal segmented row. Title beside cover. `w430-fold.png` |
| R4 K1-K7, K9 | 390x844, populated (K9 offline) | PASS (8 of 8) | `keyboard-results.json`, `keyboard-run.log` |
| R4 K8 (not in R4 scope) | Same as R1 | FAIL | Same as R1 |
| R5 midnight | Populated, 390, zoom 200% | **FAIL** (overflow) | scrollWidth 399. Labels and title intact by eye. `r5-midnight-zoom2-390.png`, `r-zoom2-390-midnight-populated-status.png` |
| R5 golden | Populated, 390, zoom 200% | **FAIL** (overflow) | scrollWidth 399. Labels and title intact by eye. `r5-golden-zoom2-390.png`, `r-zoom2-390-golden-populated-status.png` |

Overall: horizontal overflow of 9px (399 vs 390) remains at 200% zoom in all three phases, unchanged from round 2 K8. The mid-word breaks reported in round 2 ("Walde/n", "Finis/hed", "Read/ing") were not seen in round 3 by eye in any zoom capture. The overflow source was not identified (no source edits allowed in this round).

## Flags (by eye)

- Zoom 200%: the status control is below the 844px fold in the viewport capture. Its labels were checked in the supplementary `r-zoom2-*-status.png` captures.
- Global bottom tab bar: labels truncated at all widths ("Fxc", "Ma", "Clubs"). Known and tracked separately, not part of these verdicts.
- w320: the status control is a vertical list and the tab bar truncates. Crowded but no overlap and no mid-word breaks.
- w430: the "Your review" row truncates its preview text with an ellipsis (expected, not a mid-word break).

## Keyboard detail (R4)

K1 PASS (Back to Library, radio "Reading" aria-checked=true, Add note). K2 PASS (arrow keys move and check). K3 PASS (focus ring on Back, radio, Add note). K4 PASS (All notes link; Your review expands). K5 PASS (dialog focus, Escape restores focus). K6 PASS (no empty names). K7 PASS (h1 "Walden", h2 "Your notes"). K9 PASS (offline: radios and Add note disabled; "Changes need a connection.").

## Git status, fu1a

Before (`fu1a-git-status-before.txt`) and after (`fu1a-git-status-after.txt`) are identical:
```
 M src/components/library/LibraryAppearance.ts
 M src/components/library/__tests__/LibraryAppearance.test.ts
?? .spec-out/
?? .spec/
?? app/(tabs)/library/dev-flow-a.tsx
?? src/prototypes/
```
No app, source, config, package or .env file was edited. No git commands other than status. No installs. No database access.

## Writes and audit

Harness non-GET writes: none recorded in the round 3 runs (all Supabase non-GET requests were aborted by the transport layer; the fake-auth POSTs were answered by fixtures).

## Cleanup

- Dev server: the Expo web process (listener PID 3160 and its six child node processes) was stopped after the runs. Port 8084 is closed (connection refused).
- Playwright: no Playwright or browser processes remain.
- Round 2 folder and earlier files were not modified.


## Addendum — overflow attribution and finalization (recorded 2026-10-18)

- **Overflow source found.** `overflow/overflow-results.json`:

  | Case | Before hiding the tab bar | After hiding the tab bar |
  |---|---|---|
  | 200% zoom, 390 px | Page `scrollWidth` 399 | `scrollWidth` 390 |
  | 100% zoom, 320 px | `scrollWidth` 320 | `scrollWidth` 320 |

  The 9 px overflow is the **global tab bar**. It is assigned to the tab-bar unit (SDD-07 D07-15, D07-01).
- **Hidden measuring text.** The status control has a width-measuring text (`fa-status-measure-*`) that sits outside the column. It does not widen the page.
- **Verdicts.** R1, R2 and R5's "FAIL (overflow)" verdicts above are therefore tab-bar failures, not Flow A failures.
- **Round 4.** The round 4 changes (SDD-07 §10.4) were verified by Jest only and **not re-captured in a browser**.
- **Status.** The Flow A design is **FINALIZED** under the owner's delegation; see SDD-07 §10. Reviews are in [`../reviews/`](../reviews/).
