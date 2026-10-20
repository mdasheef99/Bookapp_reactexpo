# SDD-07 Stitch scorecard — 2026-10-18

**Status:** read-only review, supporting [SDD-07](./SDD-07-book-section-ui-overhaul.md). No Stitch screen was generated, edited or deleted.
**Rules scored:** DP-01 to DP-07 as defined in SDD-07 §3 (revised 2026-10-18 after independent review: DP-01 now allows at most 4 focusable controls above the fold; B01 and B04 rescored).
**Scores:** PASS / PARTIAL / FAIL / n/a (rule not applicable to a static design) / NM (not measured).

## 1. Method and limits

- Read-only Stitch MCP calls only: `list_projects` (324k-character result, parsed with a script), `list_screens` for four projects.
- Option B and Personal Library screen HTML was downloaded into the session scratchpad (outside the repo) and parsed with a script: visible text, Tailwind/inline font sizes, `<button>` count, font families and colour tokens.
- **Text-size counts are approximate.** They count size classes in the HTML. On some screens this includes annotation chrome (state pickers, fake status bars), not just the phone design. **FAIL\*** marks a DP-02 failure driven partly by that annotation chrome (B11, B12, B16).
- **Contrast was not measured** (DP-06 = NM). Target sizes were not measured.
- Screenshots were not reviewed at full resolution; Stitch thumbnails are 125–236 px wide. Judgements come from the authored text and markup.
- **Passage Capture prototype HTML returned HTTP 401** (needs Google auth). That project is scored from screen titles and the repo's 2026-10-07 handoff (`design-review-20261007/DESIGN-HANDOFF.md`) only.

## 2. Projects in scope

| Project | Id | Screens | Relevance |
|---|---|---|---|
| BookConnect Option B Collection Prototype | `12974171775283639004` | 69 instances; **17 visible** (index + B01–B16), 52 hidden (old versions, "Generating Screen…" stubs, P01, B17) | Main reference for flows A–C |
| Personal Library (My Books) Screen | `5173959960698731625` | 6 (My Books, Book Details/Lending, Search, plus clubs, loans, onboarding) | 3 relevant; 2025 P2P-lending concept |
| BookConnect: Editorial Reader UI | `10290856317477200365` | 4 listed (Manage Members, Club Hub, Clubs Browse, Discussion Thread) | **Not relevant** — all clubs screens despite the name |
| BookConnect Passage Capture Prototype | `3746960756569246722` | 19 | Superseded by Option B (standalone passages out of scope); HTML not readable |

## 3. Option B (B01–B16) scores

Fonts on every Option B screen: EB Garamond + Manrope (+ Material Symbols). Palette: the "Literary Parlor" Material-style token set (sage primary, amber secondary, `#fff8f4` surface), **light only**.

| Screen | DP-01 content first | DP-02 type | DP-03 one primary | DP-04 calm/honest data | DP-05 states | DP-06 a11y | DP-07 continuity |
|---|---|---|---|---|---|---|---|
| B01 Book Details | FAIL — cover/title lead, but 5 focusable controls above the fold (Back, bookmark, status menu, Add note, Notes) vs the DP-01 limit of 4 | PARTIAL — 4/23 sizes <16px (min 14) | FAIL — Add note, Edit review, Read reviews, Remove from library compete | **FAIL** — fabricated "4.6 ★ (128 reviews)" + Community reviews block; "Lending status: Not lent" (lending removed) | PARTIAL — populated only | NM | PARTIAL — fonts match; third palette, light only |
| B02 Notes collection | PASS | PASS — 0 <16px | PASS — Add note | PASS | PASS — includes "No notes in this category" | NM | PARTIAL |
| B03 Empty Notes | PASS | PASS | PASS | PASS | PASS — designed empty state | NM | PARTIAL |
| B04 Choose category & input | PASS | **FAIL** — 22/38 <16px (min 12) | PASS — Write/Scan equal is the DP-03 exception for the choose step | PASS | PASS | NM | PARTIAL |
| B05 Manual editor | PASS | PARTIAL — 1/15 <16px | PASS — Save note | PASS | PARTIAL — no saving/saved state | NM | PARTIAL |
| B06 Scan a page | PASS | PASS | PARTIAL — Choose photo and Capture page both prominent | PASS | PASS — camera-fail fallback text | NM | PARTIAL |
| B07 Review recognized text | PASS | **FAIL** — 14/25 <16px (min 11), all-caps labels | PASS — Save note | PARTIAL — "Optical capture" with sparkle icon reads as AI branding | PASS — "Nothing saved yet" | NM | PARTIAL |
| B08 Read note | PASS | PARTIAL — 6/17 <16px (min 12) | PASS — Edit; Copy secondary | PASS | PASS — copy toast | NM | PARTIAL |
| B09 Edit note | PASS | PASS — 0 <16px | PASS — Save changes | PASS | PARTIAL — no saving/saved state | NM | PARTIAL |
| B10 Notes load error | PASS | PARTIAL — 2/6 | PASS — Retry | PARTIAL — stray "Reading Room Edition" and "Mira Vale (sample)" text | PASS | NM | PARTIAL |
| B11 Save failure | PASS | FAIL\* — 13/24 (min 11; partly annotation chrome) | PASS — Retry save | PASS | PASS — definite failure, not-confirmed, over-500-words, invalid page | NM | PARTIAL |
| B12 Unsaved exit (decision pending) | n/a | FAIL\* — 20/26 (mostly annotation) | PASS | PASS | PASS | NM | PARTIAL |
| B13 No text recognized | PASS | PARTIAL — 2/26 | PASS — Try again | PASS | PASS — first and replacement scan | NM | PARTIAL |
| B14 Confirm incomplete text | PASS | PARTIAL — 1/9 (15px) | PASS | PASS | PASS | NM | PARTIAL |
| B15 Crop page | PASS | PARTIAL — 6/14 (min 12) | PASS — Recognize text | PASS | PASS | NM | PARTIAL |
| B16 OCR processing error | PASS | FAIL\* — 21/50 (min 11; includes annotation) | PASS | PASS | PASS — first and replacement scan | NM | PARTIAL |
| Index | n/a | 11/17 <16px (reference doc; not judged) | n/a | PASS — marks everything as proposals | n/a | Index asks for 48×48 targets and selection not by colour alone | n/a |

**Set-level DP-05 gap:** no loading state for any screen, no offline state, no "saved" confirmation state, and no Book Details error/not-found state.
**Set-level DP-07 gap:** Option B uses a third colour set. It is not the Library `LibraryAppearance` paper/ink set, nor the notes `useNoteColors` greens, and it has no golden or midnight variant.

## 4. Prior findings — confirmed or updated

| Prior finding | Now (2026-10-18) |
|---|---|
| Fabricated "4.6 ★ (128 reviews)" on B01 | **Confirmed.** Also: a Community reviews block and a "Lending status: Not lent" row (lending is removed from the roadmap). |
| Category-editing contradictions (B04 copy, B05 Change, B07 chips vs index) | **Updated: mostly resolved, one mismatch left.** The index now says categories are editable on B05/B07/B09, and B04 says "can be edited before saving". Remaining: the index calls B05 "inline editable category pills", but B05 shows a "Change" button + sheet; B07 uses inline chips and B09 uses Change + sheet. Two patterns for one job. |
| 500-word limit on B11 vs index "no limits" | **Updated: resolved.** No "no limits" text remains in the index. B11 shows "Over 500 words / Remove 37 words to save", which matches the real DB-enforced 500-word limit. |
| Saved passages on B01 though standalone passages were out of scope | **Updated.** B01 shows a "Saved pages" section with one excerpt and a delete control. The current app does show existing Saved Pages (read/delete), so this is truthful. Creating passages is not shown. The index says "Notes and categories are strictly distinct from saved passages." The open question moves to SDD-10's Saved Pages decision. It still adds clutter to B01 (DP-01). |
| "Optical capture" AI-ish wording on B07 | **Confirmed** (with an `auto_awesome` sparkle icon). |
| Index lists 14 screens but B15/B16 exist | **Updated: resolved.** The index now says "16 design screens (B01–B16) + 1 index" and registers B15/B16. |
| Many text sizes below 16px | **Confirmed.** Worst: B04, B07, B11, B12, B16 (see §3). |

New: B10 has stray "Reading Room Edition" / "(sample)" labels. B12 is still marked DECISION PENDING. A hidden B17 "Passage validation — 4,000 char" screen exists but is out of scope.

## 5. Other projects

| Screen | DP-01 | DP-02 | DP-03 | DP-04 | DP-05 | DP-06 | DP-07 | Note |
|---|---|---|---|---|---|---|---|---|
| Personal Library — My Books | PARTIAL | FAIL — 16/27 <16px | PASS | FAIL — "Available to Lend" on cards (lending removed) | FAIL — populated only | NM | FAIL — Manrope only, no shelf materials | 2025 concept |
| Personal Library — Book Details/Lending | FAIL — borrow/owner/location first | FAIL — 23/33 | PARTIAL — Request to Borrow | **FAIL** — "4.8 … from 2,145 reviews" with a star histogram; P2P lending | FAIL | NM | FAIL | Not usable |
| Personal Library — Discover/Search | FAIL — location filters first | FAIL — 26/52 | FAIL — many | FAIL — marketplace/local stores (removed) | FAIL | NM | FAIL | Not usable |
| Editorial Reader UI (4 clubs screens) | — | — | — | — | — | — | — | Not relevant to the book section |
| Passage Capture (19 screens) | — | — | — | — | — | — | — | Superseded; not scored (HTML 401) |

Passage Capture screens worth keeping as **references only**: "NR07 320px Large Text / Reduced Motion" (DP-06 layout reference), "04 Prepare photo" and "Capture source sheet" (flow C), "06 Saved passage detail" (SDD-08 passage-card reference). The NR01–NR06 swipe-review screens are an optional note-review idea. Before reuse they need a DP-04 check (no streaks or progress pressure).

## 6. Summary for SDD-07

- **Reuse:** Option B's flow structure and state coverage (B02–B16). Its state/recovery wording is careful and honest.
- **Fix before reuse:** B01 (fabricated rating, lending row, competing actions, density), sub-16px text on B04/B07/B11/B16, "Optical capture" wording, B10 stray labels, the B05/B07/B09 category pattern, and the missing loading/offline/saved states.
- **Re-skin:** Option B's palette must be replaced by the merged SDD-07 token set in all three time phases.
- **Discard:** Personal Library project (lending/marketplace concept, fabricated ratings) and Editorial Reader (clubs).
