# FA-P1 prototype keyboard and screen-reader semantics check (2026-10-18)

Target: `/library/dev-flow-a?s=populated&phase=daylight` (and `&open=remove`), Expo web dev server from the fu1a worktree on port 8084, 390x844 viewport, Edge (Playwright config `playwright.capture.config.ts`).
Spec: `keyboard.pw.ts` (same folder). Raw results: `keyboard-results.json` (same folder).
Harness: fake-auth route interception copied from `capture.pw.ts`. Blocked (aborted) data writes: 0. Non-GET requests were the fake auth `POST /auth/v1/otp` and `/auth/v1/verify`, both answered with fixtures, not data writes.

Limitation: accessible names and roles are computed from the DOM (aria-label, then text), not from an actual screen reader or the browser accessibility tree. Checked-state and expanded-state findings are based on the attributes present in the DOM.

## Summary

| Check | Verdict | Key evidence |
|---|---|---|
| K1 Tab order | PASS | Back to Library -> radio "Reading" -> button "Add note" (3 stops) |
| K2 Radio group | FAIL | Roving tabindex and arrow focus work, but no radio exposes `aria-checked` (null on all three) |
| K3 Focus visible | PASS | Browser focus ring (`outline: auto 1px rgb(16,16,16)`) on all three; blurred state has no outline |
| K4 Rows after primary | FAIL | Rows have no `aria-expanded` before or after Enter on "My review" |
| K5 Remove dialog | PASS | Focus opens on Cancel; Tab stays in dialog; Escape closes and returns focus to trigger |
| K6 Accessible names | PASS | 12 controls, 0 empty names |
| K7 Headings / landmarks | FAIL | No h1-h6, no role=heading, no main/nav/header landmarks |
| K8 200% approximation | FAIL | Zoom 2 at 390px: 9px horizontal overflow; segmented control labels clipped |

## K1 Tab order (populated, daylight)

Tab from page start, stopped at "Add note":

1. button "Back to Library"
2. radio "Reading" (tabindex=0; "Want to read" and "Finished" are tabindex=-1)
3. button "Add note" (fa-primary)

Count: 3 stops before the primary. The global tab bar was not reached before "Add note". Its position relative to the page content was not traced beyond that, so it is reported as not determined.

## K2 Radio group arrow keys

| Step | Focused | Radio tabindex (Want / Reading / Finished) | aria-checked |
|---|---|---|---|
| Start (focus on Reading) | Reading | -1 / 0 / -1 | null on all three |
| ArrowRight | Finished | -1 / -1 / 0 | null on all three |
| ArrowLeft | Reading | -1 / 0 / -1 | null on all three |

- Roving tabindex: PASS (exactly one radio has tabindex=0 at each step).
- Arrow-key focus movement: PASS.
- Checked state: FAIL. The DOM radios have `role="radio"` and `aria-label` but no `aria-checked`, so a screen reader cannot announce which status is selected. The selected style (Reading) is visual only (background rgb(255,253,248) and border rgb(148,134,105) vs rgb(238,229,214) for the others, from `radioDom` in the JSON).
- Not verified: whether ArrowRight/ArrowLeft changes the visual selection. Styles were not captured after the arrow presses.

## K3 Focus visible (populated, daylight)

| Control | Blurred outline | Focused outline | Screenshot |
|---|---|---|---|
| Back to Library | none 3px | auto 1px rgb(16,16,16) | `kb-k3-focus-back.png` |
| Reading radio | none 3px | auto 1px rgb(16,16,16) | `kb-k3-focus-radio.png` (ring visible around "Reading") |
| Add note | none 3px | auto 1px rgb(16,16,16) | `kb-k3-focus-addnote.png` |

Verdict: PASS. A visible browser focus ring is present on all three. Contrast ratio of the ring was not measured.

## K4 Rows after the primary

After "Add note", Tab produced:

1. button "All notes"
2. button "My review, A book I want to return to slowly. The small observations stay with me after I put it down."
3. button "Saved pages, 1 page"
4. button "Book information"
5. button "Ownership & condition, Owned · Good"
6. button "Community reviews, None yet"

Enter on "My review": aria-expanded before = null, after = null.

Verdict: FAIL. The rows are buttons, but the expanded state is not exposed. The visual expansion after Enter was not checked in the evidence.

## K5 Remove dialog (`&open=remove`)

- Focus on open: button "Cancel" (RemoveDialog focuses Cancel on show).
- Tab x6 cycle: Remove, Cancel, Remove, Cancel, Remove, Cancel. Focus stays inside the dialog.
- Page behind: `fa-page` has `aria-hidden="true"`. `inert` is not set. `aria-modal="true"` and `role="dialog"` are on the dialog. Screenshot: `kb-k5-remove-open.png`.
- Escape: closes the dialog. Focus returns to button "Remove from library" (the trigger).

Verdict: PASS. Note that background is protected with aria-hidden only, not inert.

## K6 Accessible names

12 controls with role button, radio or link (tab bar excluded): 0 empty names. The full list is in the JSON under `K6.items`.

Verdict: PASS.

## K7 Headings and landmarks

- Headings (h1-h6 or role=heading): none. The title "Walden" and the section label "Your notes" are plain text containers.
- Landmarks (main, nav, header, banner, contentinfo, region): none.

Verdict: FAIL. Screen-reader users have no heading structure to navigate by.

## K8 200% text approximation (390x844)

- Step a: `document.documentElement.style.fontSize = '200%'`. Screenshot `kb-k8-font200-390.png`. Overflow: none at the document level. The check is not meaningful, because this layout uses px sizes that do not scale with the root font size. Clipped-list entries were mostly the tab bar route labels (for example "marketplace/cart", clientWidth 33) and the intentionally truncated "My review" preview.
- Step b: additionally `documentElement.style.zoom = '2'`. Screenshot `kb-k8-font200-zoom2-390.png`. `docScrollWidth` is 399 vs innerWidth 390, so there is a 9px horizontal overflow. The segmented status control clips its labels ("Want", "Read", "Finis" are cut at the edges in the screenshot). Tab bar labels are truncated (clientWidth 12).

Verdict: FAIL at the zoom approximation (horizontal overflow and clipped status labels). The font-size-only step did not change the layout. This is a rough approximation at 2x zoom, not a true 200% text-size test.

## Screenshots

- `kb-k3-focus-back.png`, `kb-k3-focus-radio.png`, `kb-k3-focus-addnote.png`
- `kb-k5-remove-open.png`
- `kb-k8-font200-390.png`, `kb-k8-font200-zoom2-390.png`

## Notes on the run

- The spec was run with the library's `@playwright/test` CLI from the fu1a working directory. Running the fu1a copy failed because the spec resolves `@playwright/test` from the library folder (two Playwright versions clash).
- The first run hung at K3 because the radio was located by `aria-checked="true"`, which does not exist on this prototype. The spec was patched to locate the radio by its accessible name "Reading", then re-run successfully.
- Test output folder `test-output/` and `results.json` in the evidence folder were written by Playwright.
