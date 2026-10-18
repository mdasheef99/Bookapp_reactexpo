# Flow A — Book Details design directions (2026-10-18)

**Status:** **owner chose A1 Shelf card with A2's unboxed serif note passages, and amended DP-01 (2026-10-18; SDD-07 D07-09, D07-10).** Owner's words: "Go with A1 Shelf card, using A2's unboxed serif note passages, and amend DP-01 to count controls only down to the primary action. Build it as the Expo web prototype." Next unit: [FA-P1 Book Details prototype](../../SDD-07-FLOW-A-PROTOTYPE.md). Nothing is built. `fixture-cover-walden.png` is a plain generated cover (no third-party art) for that prototype's fixtures.
**Authority:** owner's words, relayed by the orchestrating session: "Approve the foundation plan and the 3 developer tools. Also start Flow A now: generate 2–3 Book Details directions in a new Stitch project (generation approved), following SDD-07's rules and the decisions, and show me the screenshots to choose from."
**Rules applied:** [SDD-07](../../SDD-07-book-section-ui-overhaul.md) DP-01–DP-07 (§3) and D07-01–D07-08 (§9).
**Stitch project:** "BookConnect Library — Flow A Book Details", `13565935267482128443`. This is a new project; Option B and every other project were not touched.
**Design system:** `assets/5325051572968562907` — the Library `LibraryAppearance` daylight and midnight paper/ink values, EB Garamond headings and Manrope body. Option B's Literary Parlor palette is not used.
**What changed in the repo:** docs/evidence files only. No app code, installs, database or storage writes, or commits.

**Start here:** [`COMPARE-fold-390x844.png`](./COMPARE-fold-390x844.png). It shows the first 390×844 viewport of each direction in daylight and midnight. The red line is the fold.

## 1. The directions (revised versions)

| | A1 Shelf card | A2 Frontispiece | A3 Reading journal |
|---|---|---|---|
| **Idea in one sentence** | A balanced page: cover beside the title, all three statuses visible as one segmented control, and the two latest notes as quiet cards. | Like the frontispiece of a printed book: a large centred cover and title, then the latest note set as an unboxed serif passage. | The reader's own journal for the book: a compact header, and the latest three notes fill the fold as one tappable region. |
| Status control | Segmented "Want to read / Reading / Finished" (1 radio group), plus "Started 2 Oct" | "Reading ▾" pill (dropdown), plus "Started 2 Oct" | Full-width "Reading · Started 2 Oct ▾" button |
| Notes above the fold | 2 static cards | 1 passage | 3 previews in one control that opens all notes |
| Cover | 112×168 flat cover | 168×252 flat cover | 48×72; shown here as the **muted no-cover placeholder** "AQ" |
| Options / export slot (SDD-08) | Header "⋯" | Header "⋯" | "Book options" row below the fold (no header "⋯") |
| Dates / reread slot (SDD-09) | Caption under status | Caption under pill | Inside the status button text |
| All-notes entry (SDD-10) | "All 3 notes" row | "All 3 notes" row | Notes region itself |
| Review (D07-02) | Collapsed one-line row | Collapsed one-line row | Collapsed one-line row |
| Saved Pages (D07-03) | Present → collapsed row "1 page" | Present → collapsed row "1 page" | Empty → hidden |
| Lending (D07-08) | None | None | None |
| Daylight (Stitch) | `a644908106b9404c8fc47d31fbeb9d8f` | `6a7044da64f3402d9bf56af2e240b04c` | `b3835f9e9f3e4339b6e0ef2ec04ad194` |
| Midnight | `dd682d4380fc49a4aab6e64b5c1c65a5` (Stitch) | **Local recolour** of the daylight export (see §4) | `9e07246bbdc5401189b3c2c816f3465f` (Stitch) |

Files for each revised screen, where `<name>` is `A1r-daylight`, `A1r-midnight`, `A2r-daylight`, `A2r-midnight-LOCAL-RECOLOUR`, `A3r-daylight` or `A3r-midnight`:

| File | What it is |
|---|---|
| `<name>-390-fold.png` | The first 390×844 viewport, at 2× scale |
| `<name>-390-full.png` | The whole page at 390 wide, at 2× scale |
| `<name>.html` | Stitch HTML export |
| `<name>.png` | Stitch's own 2560-wide canvas screenshot |

The local recolour has no Stitch `.png`.

## 2. DP scores (revised versions, both phases)

| Rule | A1 Shelf card | A2 Frontispiece | A3 Reading journal |
|---|---|---|---|
| **DP-01** ≤4 focusable controls above the fold (Back counts; a radio group = 1) | **FAIL as rendered: 6.** Back, ⋯, status group, Add note are the intended 4. The "All 3 notes" row (y=736) and "My review" row (y=792) also fall inside the fold. | **FAIL as rendered: 5.** The intended 4 plus "All 3 notes" (y=792, 52px into the fold). Closest to passing. | **FAIL as rendered: 8.** The intended 4 (Back, status, notes region, Add note), plus all four rows, because the page is only 979px tall. |
| **DP-02** type | PASS — only 3 metadata captions at 14px; everything else ≥16px; sentence case | PASS — 2 metadata captions at 14px; an 11px "▾" glyph only | PASS — 3 metadata captions at 14px |
| **DP-03** one primary | PASS — "Add note" is the only filled button | PASS | PASS |
| **DP-04** calm, honest | PASS — no stars, ratings, review counts, badges or lending; "3 notes" is plain text (scan of rendered text found none) | PASS | PASS |
| **DP-05** states | PARTIAL — populated state only; Saved Pages "present" case shown | PARTIAL — as A1 | PARTIAL — populated with no cover and Saved Pages empty/hidden; no error, not-found, offline or loading states (those are for the Expo prototype, D07-07) |
| **DP-06** accessibility | PARTIAL — all text pairs pass (lowest 5.32:1). Status segments are 42px tall, under the 48px minimum, in both phases. "Remove from library" is 24px tall in daylight (48 in midnight). | PARTIAL — all text pairs pass, and all targets are ≥48px. The status pill border is the hairline: 1.37:1 in daylight and 1.57:1 in midnight (needs `controlBorder`, ≥3:1). | PARTIAL — all text pairs pass. The status border is `#8a7b66` at 3.82:1 in daylight and `#a3927a` at 5.49:1 in midnight. "Remove from library" is 40px tall in daylight (48 in midnight). |
| **DP-07** continuity | PASS — Library palette and fonts; cover-led like the shelf (two stray near-token inks, `#221b14` and `#6a5e52`) | PASS — exact Library tokens; strongest echo of the shelf's covers | PARTIAL — Library palette and fonts, but the small thumbnail breaks the shelf → large-cover continuity |

**What was measured:** each export was rendered in Edge (Playwright) at 390×844 with [`measure-390.cjs`](./measure-390.cjs); results are in `measure-390-results.json`. Contrast was computed with the WCAG formula on the hex values in each export. A "focusable control" means `button`, `a[href]`, `[role=button]` and the like, with each radio group counted once.

**Not measured:**
- Line height.
- 200% text.
- Screen-reader order.
- The real app's tab bar. Book Details sits under `app/(tabs)/library/`, so the visible area on a phone is shorter than 844px. That would hide the lower rows, but the tab bar's height was not measured.

**Not dropped:** none of the three was dropped, though none passes DP-01 as rendered. The failures share one cause, explained in §3. Each direction already had its one fix-and-regenerate:

| | Round-1 count | Revised count | Other round-1 problems fixed |
|---|---|---|---|
| A1 | 7 | 6 | 12–15px text, a wrapped status label, all-caps labels, quote marks on a Thought note, a photo-style cover |
| A2 | 6 | 5 | 15px text, the photo cover |
| A3 | 9 | 8 | — |

## 3. DP-01 and short pages (decided 2026-10-18: option 2, D07-10)

The design of each direction puts exactly 4 controls in the reader's area. The extra controls inside the fold are the collapsed rows below "Add note", such as All notes, My review and Book information. They rise into the fold whenever a book has little content, so this is about **page length, not layout**. Stitch also ignored instructions to keep those rows below y=860.

Two ways to resolve it:

1. **Keep DP-01 as written.** The build must start the secondary rows below the viewport, for example by giving the reader's area a minimum height of one viewport. A book with few notes then shows blank space above the rows.
2. **Amend DP-01 (recommended).** Count controls only down to and including the primary action. Collapsed secondary rows that come after the primary action may appear in the fold on short pages, if they are visually secondary (plain rows, no fills, no counts in containers). This keeps the rule's intent, reader content first and one clear action, without padding the page.

Either way, the Expo web prototype (D07-07) is where DP-01 is finally checked.

## 4. Limits and deviations

- **A2 midnight is a local recolour, not a Stitch generation.** Stitch's A2 midnight edit timed out once, and a retry reported success but returned no screen id or export. Stitch's `list_screens` returns `{}` for this project, so the result could not be recovered.
  - [`A2r-midnight-LOCAL-RECOLOUR.html`](./A2r-midnight-LOCAL-RECOLOUR.html) is the A2 daylight export with its CSS colour variables swapped to the Library midnight tokens.
  - It has the same layout and contents. It is labelled in its `<title>` and in a header comment.
- **Golden phase not produced.** The generation budget was spent.
- **Stitch canvas:** Stitch renders each design on a 2560-wide desktop canvas, with the phone column centred. The `-390-*.png` captures are the phone-width evidence.
- **Sample content:** the sample book "A Quiet Practice" by "Mira Vale", its cover art and the note text are design sample content. They are not app fixtures.

### Generation count

12 Stitch generation calls in total (the target was about 12):

| Call | Count | Result |
|---|---|---|
| `generate_screen_from_text` | 3 | A1, A2, A3 round 1. These also produced 2 cover images. |
| `edit_screens` succeeded with export | 5 | A1r, A3r, A1 midnight, A2r (retry), A3 midnight (retry) |
| `edit_screens` lost | 4 | A2r, A3 midnight and A2 midnight timed out; one A2 midnight retry returned no id. These may exist in the Stitch project as unrecoverable screens. |

That gives 11 retrieved screens: 8 designs and 3 cover images. No screen was deleted.

## 5. Round-1 files (superseded, kept as history)

| Files | Stitch screen id | Notes |
|---|---|---|
| `A1-daylight.png/.html` | `43ceff5717904ce8853d7c4480c6bd01` | Cover image `15405afa667b4952bb97aff84db5cc9f` |
| `A2-daylight.png/.html` | `3a03a522394b4ac6972dd549210b641c` | Cover image `d3df71479c6f4cb497a2eebf2b93db96` |
| `A3-daylight.png/.html` | `73c9bd970c104c1a95a5a399785e8a30` | — |

The flat cover used in A1r and A2r is image screen `e96fdc78904243b1ad6862aeb8e0e815`.

## 6. Recommendation (accepted 2026-10-18 as D07-09)

**A1 Shelf card, with A2's unboxed serif note passages in place of the boxed cards.**

Why A1:
- All three statuses are visible and one tap away, so the screen works without explanation. A2 and A3 hide the statuses in a dropdown.
- It keeps the cover-led look that comes from the shelf (DP-07).
- It shows two notes above the fold.

A2's passage style removes the card borders, the main "boxy" weakness A1 has.

Fixes to carry into the Expo prototype:
- Make the status segments 48px tall.
- Give "Remove from library" a 48px target.
- Use exact token inks.
- Use the muted placeholder (A3's treatment) when a book has no cover.

The alternative worth considering is A3, if the owner wants notes to dominate. It is the most "journal" of the three, but it gives up the cover and has the hardest DP-01 problem.
