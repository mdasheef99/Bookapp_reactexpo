# FA-P1 prototype round 2 capture and keyboard check (2026-10-18)

Target: Expo web dev server from `C:\Users\LEGION\Desktop\Bookconnect4_fu1a` on port 8084, route `/library/dev-flow-a`, 390x844 unless noted.
Scripts (copies, this folder): `capture.pw.ts` (adds the `refresh-failed` preset), `keyboard.pw.ts` (K1-K9 rewritten as PASS/FAIL checks), `playwright.capture.config.ts`.
Originals in the parent folder were not edited.

## Capture: 60 of 60 passed (0 fail)

- Presets: 18 (the 17 from round 1 plus `refresh-failed`) x 3 phases = 54, plus 6 extra views (open-review, open-saved, open-remove, slots1, w320, w1280) = 60.
- Each capture produced `-fold.png`, full-page `.png` and `.txt`. All 60 fold screenshots were reviewed by eye (see flags).
- Page errors: 0. Console errors: 0. Error text in body: 0.
- Harness non-GET writes: **0** (`write-audit.json`, `totalWrites: 0`).
- Non-GET requests recorded: 120 = 60 `POST /auth/v1/otp` + 60 `POST /auth/v1/verify`, all fake-auth answered by fixtures. Nothing reached a real backend.
- Harness read-only fixture: `GET /rest/v1/user_books` answered empty on each capture.

## Keyboard and semantics: 8 PASS, 1 FAIL

| Check | Verdict | Evidence |
|---|---|---|
| K1 Tab order | PASS | Back to Library -> radio "Reading" (aria-checked=true) -> button "Add note". Three stops. |
| K2 Radio arrows | PASS | All three radios have aria-checked true/false, one true. ArrowRight moves focus to "Finished" and sets it checked; ArrowLeft returns to "Reading". |
| K3 Focus visible | PASS | Keyboard focus on Back, radio and Add note shows `outline: solid 2px rgb(122,92,51)`. Screenshots: `kb-k3-focus-back.png`, `kb-k3-focus-radio.png`, `kb-k3-focus-addnote.png`. Contrast ratio not measured. |
| K4 Rows after primary | PASS | "All notes" is role link with no aria-expanded. "Your review" aria-expanded false -> true after Enter. No "Community reviews" stop (none yet, not focusable). |
| K5 Remove dialog | PASS | Focus opens on Cancel. Six Tabs stay inside the dialog. aria-describedby text contains "will be deleted". Page has aria-hidden=true and inert. Escape closes and focus returns to "Remove from library". Screenshot: `kb-k5-remove-open.png`. |
| K6 Accessible names | PASS | Content controls: 0 empty names. Tab bar excluded (tracked separately). |
| K7 Headings | PASS | h1 (aria-level 1) "Walden"; h2 "Your notes". No landmarks (main/nav/header) present; not part of K7 verdict. |
| K8 Zoom 2 at 390 | **FAIL** | docScrollWidth 399 vs innerWidth 390 (9px horizontal overflow). Visual: title breaks mid-word ("Walde/n") and status labels break mid-word ("Finis/hed", "Read/ing"). Screenshot: `kb-k8-zoom2-390.png`. |
| K9 Offline | PASS | All three status radios and Add note disabled. "Changes need a connection." present. Screenshot: `kb-k9-offline.png`. |

Raw data: `keyboard-results.json`. Method note: K8 uses CSS `zoom: 2` as an approximation, as in round 1. The clipped-label check read only the radio element boxes and missed the mid-word breaks, so the K8 verdict rests on the overflow number and the screenshot.

Changes from round 1: K2 and K4 now pass (aria-checked and aria-expanded are exposed). K5 Cancel is now focused on open, and the dialog is labelled. The row is now named "Your review" (round 1 said "My review"). K8 still fails.

## FLAGS (visual, every fold screenshot reviewed)

- **K8 zoom 2 at 390 (`kb-k8-zoom2-390.png`)**: horizontal overflow of 9px and mid-word breaks in the title and the status segmented control. Blocking for K8.
- **w320 (`round2/populated-daylight-w320-fold.png`)**: status control stacks into three rows ("Want to / read"), tab bar truncated. Overlap-free but crowded.
- **Slots view (`populated-daylight-slots1-fold.png`)**: the "SDD-08" placeholder wraps onto two lines ("SDD- / 08") at the top right, and the "SDD-09 · Reading dates / reread" placeholder sits under the segmented control. Intentional slot labels, but they overlap the layout.
- **Remove dialog (`populated-daylight-open-remove-fold.png`)**: the dialog has one filled red "Remove book". The page's "Add note" primary is still visible behind the scrim, dimmed, so it is outside the dialog. Not a bright second filled button, but flagged for review as in round 1 (F4).
- **Golden looks the same as daylight** (`populated-golden-fold.png` vs `populated-daylight-fold.png`). Carried over from round 1 (F2).
- **Lent-out (`lent-out-*-fold.png`)**: no lent indicator visible above the fold in any phase. Carried over (F7). Not verified below the fold.
- **Zero-notes fold (`zero-notes-*-fold.png`)**: "No community reviews." is cut at the fold edge. This is the fold crop, not a layout defect. Not verified in the full-page PNG.
- **Global bottom tab bar** (all captures): fallback glyphs and truncated labels, white strip in some midnight captures. Known and tracked separately; ignored for this report.

Checked and OK (no flag):
- No blank pages, no error overlays, no clipped body text in the 60 folds other than the flags above.
- Midnight: no white placeholder; no-cover shows a dark block with a "W" monogram (`no-cover-midnight-fold.png`).
- `refresh-failed` (3 phases): "Couldn't refresh. Try again" inline above saved content; no filled banner; notes stay visible.
- Offline (3 phases): "Offline · Showing saved content." text line, disabled radios and Add note, "Changes need a connection." present, no filled banner.
- Loading skeletons, error, not-found, notes-error and notes-loading states as in round 1.

## Writes

- Harness non-GET writes: **0**.
- Keyboard run: `writesBlocked` empty in `keyboard-results.json`; non-GET requests were only the fake-auth POSTs.
- No app, config, package or .env files were edited. No git commands other than status. No database access.

## fu1a git status

Before:
```
 M src/components/library/LibraryAppearance.ts
 M src/components/library/__tests__/LibraryAppearance.test.ts
?? .spec-out/
?? .spec/
?? app/(tabs)/library/dev-flow-a.tsx
?? src/prototypes/
```

After (captured after the dev server stop): identical to before.

## Dev server

Started with `npx expo start --web --port 8084` in the background, responded HTTP 200, stopped after the runs. Port 8084 confirmed closed (connection refused). The Playwright runs exited on their own.
