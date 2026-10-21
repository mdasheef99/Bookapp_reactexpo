# Post-Scan Rework — SDD-0 Overview and Decision Register

**Status:** `approved` (written and reviewed 2026-10-19; Owner approved the
SDD set with the §14 defaults on 2026-10-19; approval of the documents does not
authorize code, migrations or deployment, which each slice requests separately)
**Branch:** `claude/phase9-post-scan-rework-sdd` from `main` `8863885`
**Phase:** Phase 9 (image inventory). Part 1 of this rework stays inside Phase 9.
**Authority:** the Owner's decisions of 2026-10-17 to 2026-10-19, recorded
below as `PSR-D*`. They rank above the Phase 9 master SDD and the domain SDDs
(AGENTS.md authority hierarchy, item 1). Where an existing rule disagrees, §9
names it and the slice that amends it.
**Evidence tracker:** [tracker 38](../../trackers/38-post-scan-rework-evidence.md)

This document is the single place a new session needs to understand *what* the
rework changes and *why*. The five area SDDs (§7) say *how*, one slice at a
time. A session with no memory of the planning conversation must be able to
build the next slice correctly from this folder plus the code. If something
here disagrees with the code or the live database, stop and re-verify; do not
guess.

## Contents

1. Purpose and boundaries
2. How to use these documents
3. Glossary
4. Decision register (`PSR-D01`–`PSR-D47`)
5. Rejected options (do not reopen without the Owner)
6. Cross-slice rules (`PSR-R01`–`PSR-R14`)
7. Slice map, build order and guardrails
8. Verified facts (as of 2026-10-19)
9. Existing rules this rework supersedes or amends
10. Review and design-study summary
11. Out of scope, deferred and parked
12. Pre-launch checks (not blockers for building)
13. Slice 17 — end-to-end check
14. Open questions carried into pass 2
15. Process rules for every slice

---

## 1. Purpose and boundaries

The post-scan review cycle grew complicated: two buttons open the same sheet,
a hidden "saved review" step can leave a card stuck on "Review book", a full
correction screen duplicates the card, and "Prepare to publish" is recorded but
never acted on. The rework makes the cycle short and dependable:

- every scanned book ends **Added** (to inventory) or **Removed**;
- the Owner presses **Add** once; the server saves, adds and (by default)
  publishes in one step, and a retry can never create a second row;
- the book's edition is found automatically more often, from a shared
  catalogue first and Open Library second;
- each added book carries a category (public) and optional labels (private).

**Part 1 ends at the moment a book is added to inventory.** Anything that
happens afterwards in Store View (editing category or labels, filters, bulk
edit, pricing, offers, shop sales) is out of scope (§11), except that Add may
publish the new row (PSR-D15).

Part 2 (barcode mode, "Sold in shop", provider benchmark) gets its own SDD
after Part 1 is complete. Slice 18 (physical deletion of removed books) is a
separate later unit.

## 2. How to use these documents

| File | Contents | Written |
|---|---|---|
| `00-overview-sdd.md` (this file) | Decisions, rules, slice map, facts, supersessions | Full (pass 1) |
| [`01-review-screen-sdd.md`](./01-review-screen-sdd.md) | Slices 1–5 | Outline (pass 1) |
| [`02-catalogue-and-matching-sdd.md`](./02-catalogue-and-matching-sdd.md) | Slices 6–9 | Outline (pass 1) |
| [`03-session-lifecycle-sdd.md`](./03-session-lifecycle-sdd.md) | Slices 10–12, 18 | Outline (pass 1) |
| [`04-add-and-publish-sdd.md`](./04-add-and-publish-sdd.md) | Slices 13–14 | Outline (pass 1) |
| [`05-classification-sdd.md`](./05-classification-sdd.md) | Slices 15–16 | Outline (pass 1) |

**Two passes.** Pass 1 (now) fixes every decision, every slice's goal, scope,
dependencies, acceptance checks and size. Pass 2 adds the build detail for one
area — files and functions touched, step-by-step behaviour, failure cases,
named red-first tests — immediately before that area is built, because
earlier slices change the code later slices touch. A slice must not start
until its area SDD has passed pass 2 and the Owner has approved it.

**Starting a session on this rework:** follow AGENTS.md → `ACTIVE.md` → DOC-13
→ Phase 9 `SESSION-START.md` → `TRACKER.md`, which names the current slice.
Then read this file, then the area SDD for that slice, then tracker 38.

**Where older references live:** P9-Dxx decisions are in
[`trackers/01-planning-and-decisions.md`](../../trackers/01-planning-and-decisions.md);
MAS-xx rules are in the [Phase 9 master SDD](../../00-phase-9-master-sdd.md);
Unit 6G is [`06g-…-handoff-sdd.md`](../06g-owner-scan-defaults-batch-review-commit-handoff-sdd.md);
Unit 6H (duplicate photo) is [`06h-duplicate-input-confirmation.md`](../06h-duplicate-input-confirmation.md);
DOC-3, DOC-4 and DOC-8 are the root specifications in
[`docs/multi-tenant-bookstore-marketplace/`](../../../../).

## 3. Glossary

| Term | Meaning |
|---|---|
| **Card** | One scanned book in the post-scan review list. Stored as a row in `image_extraction_candidates`. |
| **Card status** | What the Owner sees: **Ready**, **Needs details**, **Adding**, **Added**. These are display labels computed by the app, *not* new persisted values; persisted candidate states keep their existing names. |
| **Added** | The card's book has an inventory row. Shown with its publish result: "Live", or "Private – {reason}". |
| **Removed** | The Owner removed the card (existing `owner_removed_from_scan` review disposition). It disappears at once and can never be restored. |
| **Session** | One scan: one shelf photo (today the server allows one photo per session — §8 F11) and its cards. |
| **Pre-scan** | The setup form before the photo: shelf location, default price, default condition, language hint, publish choice, category, labels. |
| **Edition** | One printing of a book: ISBN, publisher, year, cover. The card shows the chosen edition on one line. |
| **Clear match** | Exactly one edition passes the matching rules. |
| **Tie** | Several editions pass equally; the server picks the best one by the tie order (PSR-D28). Also called a tie pick. |
| **Catalogue** | BookConnect's own shared book records: `canonical_works`, `canonical_editions`, `book_metadata_sources`, plus a stats table. Holds no store identity. |
| **Receipt** | The durable result of one Add (inventory id, publish outcome). Asking again with the same command returns the same receipt. |
| **Publish outcome** | `live`, or `private` with a reason (owner chose Keep private, or a blocker such as missing price). |
| **Category** | One public kind-of-book value per inventory row, from a fixed list of 10 (PSR-D41). |
| **Label** | A private, store-defined name. A book can have several. "Normal" means no label. |
| **Query identity** | The normalized lookup key of a card (title, authors, language, ISBN strategy), built in `metadata/queryIdentity.ts`. When it changes, saved edition options are cleared and readiness resets (§8 F3). |
| **Edition options** | The saved list of editions shown in the sheet for a card, with an options version. They expire after 24 hours (`20261007000065…sql` L97–119); a new search refetches them. |
| **Provider registry** | `phase9_provider_registry`: one row per metadata provider with its enabled switch; the worker reads it to decide which providers run. |
| **Rule (normalizer) version** | The version of the worker's matching and normalizing rules recorded with lookup results, so results made under older rules can be recognised (tracker 37 §73). |
| **Idempotency key / operation code** | A client-supplied key stored in `phase9_idempotency_keys` with an operation code (today's Add is `U7AC01`); repeating the same key and request returns the stored response instead of acting twice. |
| **Needs details** | The card label when it cannot be added now: it has blockers or attention items (`cardReadyNow` is false in `components/batchReviewStatus.ts`). |
| **Hidden catalogue record** | A catalogue edition flagged as bad (PSR-D37); the catalogue step never offers it. |
| **Slice** | One small, separately built, tested and merged change. At most one migration. |
| **Red-first** | Tests for a slice are written and shown failing before the code is written. |

## 4. Decision register

Every decision has a stable ID. Slices, acceptance checks and tests cite these
IDs. "Date" is when the Owner settled it. Wording in quotes is the Owner's.
`P9-D89` in the Phase 9 decision tracker records this whole register as one
umbrella decision.

### A. Review cycle

| ID | Decision | Why | Date |
|---|---|---|---|
| PSR-D01 | Every scanned book ends one of two ways: **Added** or **Removed**. | The Owner wants one simple end state per book. | 10-17 |
| PSR-D02 | The server keeps its review step (`phase9_update_candidate_review_v2`, `review_ready`, review versions), but the Owner never sees it: no "Review book", "Save review" or saved-review state in the UI. | Owner: "keeping the review feature and just not showing it". Server validation stays intact. | 10-17 |
| PSR-D03 | **Add is one server action:** save the card → create the inventory row → attempt publication (PSR-D15). A failed or blocked publication never undoes the Add. A durable receipt makes double taps, lost responses and app restarts return the original result; a second inventory row is impossible. | Removes the stuck-card class of bugs and the three-call client choreography. Recovery cases are listed in SDD-4. | 10-18 |
| PSR-D04 | Card statuses are **Ready / Needs details / Adding / Added**. An Added card shows its publish outcome separately ("Live" or "Private – price missing"). An Added card never returns to Needs details. | One readable status per card; publication is a separate fact. | 10-17, 10-18 |
| PSR-D05 | One edition button, **"Find or change edition"**. "View metadata" is removed. The sheet loses "Detected details", "Use detected details", "Edit manually" and its second title/author form. Its search uses the card's own title and author. | The two buttons opened the same sheet; one form for title/author avoids two sources of truth. | 10-17 |
| PSR-D06 | The edition sheet gets a **"Type ISBN"** box for an exact lookup. | Helps when a spine is damaged, foreign-language or misread. About a day of work, so it is in Part 1. | 10-18 |
| PSR-D07 | The card shows the chosen edition on one line (publisher · year · ISBN, or "No edition chosen"). Changing the title or author visibly clears the edition and the saved edition list. | The Owner can see what will be added; a list found for the old title is no longer valid. | 10-17, 10-18 |
| PSR-D08 | The card has a small **category picker**. Auto-detect fills it; if Auto-detect cannot decide it shows **Other**; the Owner may change it before Add. | Category is mandatory and Store View editing is deferred, so a wrong guess must be fixable before Add. | 10-18 |
| PSR-D09 | Declutter the card and header (fewer badges and chips, no explanation paragraph). Add a **"Leave without saving?"** guard on the review screen. Unfinished card edits are discarded when the session ends. | Original brief. | 10-17 |
| PSR-D10 | After an edition is chosen, the card is the one source of truth: the choice fills the card's fields and the card shows what Add will save. | Original brief ("one source of truth on the card"). | 10-17 |

### B. Removed and simplified

| ID | Decision | Why | Date |
|---|---|---|---|
| PSR-D11 | Remove **full correction** entirely: the "Open full correction" button and screen, Mark false, search-wording review, notes, script field, "Review next blocker" and the "Review books" queue. Mark false is replaced by Remove. Notes stay editable in Store View after Add. | It duplicated the card and was the main source of clutter. | 10-17 |
| PSR-D12 | After Add, remove "View in Store View" and "Continue Reviewing". Remove the Inventory tab's duplicate inventory list. An added book appears **only in Store View**. | "once added to the inventory … it should directly go to store view and nowhere else." | 10-17 |
| PSR-D13 | Keep **"Add a book"** (today "Add missed book", route `/inventory/scan/{id}/missed`, RPC `phase9_add_manual_candidate`) and simplify it: type an ISBN, or a title and author; it becomes a normal card. | Removing full correction removed the other manual entry path; Gemini can miss a spine. | 10-18 |

### C. Pre-scan

| ID | Decision | Why | Date |
|---|---|---|---|
| PSR-D14 | Pre-scan keeps shelf location (required), default price, default condition and language hint. No slice changes them. | Already built and used. | 10-17 |
| PSR-D15 | Pre-scan gets **"After adding: Publish now / Keep private"**, default **Publish now**, for every book including tie picks. It replaces "Prepare to publish" and this time it is acted on. With Publish now, Add attempts publication; any blocker (listing limit, subscription, quality, moderation) leaves the book Private with a Needs-attention reason. The pre-scan choice counts as the Owner's confirmation of the first publish. The choice is stored on the session and read by the server, never trusted per call from the client. | Prepare to publish did nothing (5 books with that intent stayed private). Owner: "publish should be default here"; tie picks: "We just need to publish it … all of these are secondhand books." | 10-18; amended 10-19 (price and condition are checked before Add, PSR-D47) |
| PSR-D16 | Category is **mandatory** at pre-scan: one of the 10 categories, or **Auto-detect**. | Every listing needs a category for browsing. | 10-18 |
| PSR-D47 | Before Add, every card must have a **price above ₹0**, a **condition** and a **quantity of at least 1**; otherwise it shows **Needs details** and Add is not offered. The pre-scan default price may be blank or ₹0 (cards then ask for a price). The new Add contract enforces this on the server; the old contract keeps today's rule for older apps (R06). | Owner 10-19: "make price, condition and quantity as mandatory values that needs to be inserted before adding to inventory. And pre-scan, price can be zero, but in post-scan UI cards, price can't be zero." Today's rules already require condition and quantity and a price, but allow ₹0 for a private Add (§8 F38). | 10-19 |
| PSR-D17 | **Labels** are just names. Each store has its own list; a book can have several; labels are **private** (never shown to buyers). Labels chosen at pre-scan apply to every book in that scan. The old batch label is simply a label typed at pre-scan. No starter set, no colours, no visible limits (only a hidden technical cap). A book with no label counts as **"Normal"**. | Owner: "labels should be private … for internal purposes"; "for normal books, we have to keep a normal label"; then asked for a simpler structure. | 10-18 |

### D. Removal, sessions and limits

| ID | Decision | Why | Date |
|---|---|---|---|
| PSR-D18 | **Remove** on each card, plus **"Remove all remaining"** in the bottom bar: confirm dialog; each card removed separately; a report lists any that failed, with retry. | No way existed to discard a scan as a whole. | 10-17 |
| PSR-D19 | A removed book is **gone for the Owner instantly and can never be restored** ("removed means removed"). Physical deletion of its data is a later, separate unit (slice 18). Until then the data stays in the database, invisible to the Owner. | Hard delete touches 9 referencing tables, two of them immutable (§8 F9); moving it to a retryable background job keeps Part 1 safe ("D-lite"). | 10-18 |
| PSR-D20 | Removals write a **content-free audit entry**: actor, time, session, candidate IDs and outcome; never book text. | "Audit log is important." It must not keep the data being deleted. | 10-18 |
| PSR-D21 | **The server closes the session automatically** when every card is Added or Removed (including through Remove all), even if the app is closed. There is no "Finish scan" button. It never closes while a card is Adding. Only one open session per Owner and store (already enforced). | Today auto-close runs only in the app and assumes nothing was removed. | 10-17, 10-18 |
| PSR-D22 | A book without a cover shows a **placeholder** with its title and author. The scan photo is never used as a cover. | Shelf photos show many spines and may show people; "use the least complicated one". | 10-18 |
| PSR-D23 | **Daily limit:** at most **500 books per store per day** (exact number decided later; configurable per store), reset at **midnight India time (IST)**. Every detected book counts, including books later removed. Uploading the same photo again does not count twice. The existing 15-books-per-photo limit stays. The check and the increment happen in one server step. | Caps Gemini and provider cost; Owner: "500 at most initially". | 10-18 |
| PSR-D24 | Scan photos are not kept as references or covers; they are deleted by the physical-deletion unit (slice 18) once no remaining card needs them. | "we can just delete the photo." | 10-18 |

### E. Matching and lookup

| ID | Decision | Why | Date |
|---|---|---|---|
| PSR-D25 | **Lookup order:** our catalogue → **Open Library** (identified with a User-Agent and contact email, as its guidance asks) → nothing. **Google Books is switched off** at first; its switch is kept. | Google's rate limits are "really, really bad"; Google's terms forbid permanent copies (§8 F15), and Owner: "start with open library … keep the architecture shiftable". | 10-18 |
| PSR-D26 | The automatic match uses the **relaxed rules** already used by explicit Owner search (DOC-3 §5.2.1 rules 1–9). | Strict automatic matching left most books unmatched (§8 F13). | 10-17 |
| PSR-D27 | An **ISBN clue** read by Gemini triggers a direct ISBN lookup. A **publisher clue** is compared with each edition's real publisher as a tie-breaker. | Gemini already extracts both (§8 F14); the publisher clue is currently never compared with a publisher. | 10-18 |
| PSR-D28 | **Clear match:** auto-select it with its cover. **Tie:** pick the best, in this order: same language → publisher matches the clue → times chosen → has a cover → has an ISBN → provider's order. **No match:** nothing is picked. | Owner: tie picks are fine for second-hand books, "but having a cover for the book matters". | 10-18 |
| PSR-D29 | **Covers:** Open Library cover (by cover ID), otherwise the placeholder. The Google cover fallback is cut. | A Google cover on an Open Library edition may show another edition. | 10-18 |
| PSR-D30 | The first lookup's results (up to 10) are **saved for the edition sheet**, matching-language editions first and others under "Other languages". Opening the sheet shows them with no new request. **"Search again"** reruns the search with the card's current title and author. There is no "next page". | "why waste it? we will store them and first get them displayed". Typed ISBN covers exact editions. | 10-18 |
| PSR-D31 | **Protection:** requests are spaced out and retried with backoff; a per-store search cap; an on/off switch per provider; when every provider is down the card gets no edition and one automatic retry, and the Owner can still search by hand. | Rate limits; Open Library etiquette. | 10-18 |
| PSR-D32 | Providers sit behind a **swappable interface**, so another provider (paid or not) can be added later without changing storage, review or inventory. | Owner wants to test other APIs later. Matches MAS-13. | 10-18 |

### F. Lean shared catalogue

| ID | Decision | Why | Date |
|---|---|---|---|
| PSR-D33 | Build a **lean catalogue on the existing tables** (`canonical_works`, `canonical_editions`, `book_metadata_sources`) and share the search cache across stores through its existing `public_bibliographic` mode. The Owner approved changing the source specs for this ("you can change this"). | Popular books are scanned again and again; each repeat should need no API call. | 10-18 |
| PSR-D34 | **Every Add finds or creates the catalogue edition** (and work) for the chosen edition and links `store_inventory.canonical_edition_id` / `canonical_work_id`. | Today picker choices are added with no link (§8 F5), so counts and reuse cannot work. | 10-18 |
| PSR-D35 | The catalogue holds **Open Library records only** (never Google). Stored IDs: our own IDs, ISBN-13 and ISBN-10, Open Library work, edition, author and cover IDs, OCLC and LCCN when present. Identity: **ISBN-13**, else the Open Library edition ID. Our own IDs are what inventory points to; provider IDs are cross-references. | Google's terms; provider independence. | 10-18 |
| PSR-D36 | **Counts** live in a small separate stats table with **no store identity**: times searched (work), times chosen and times added (edition). Counts only order results and break ties; they never mean "verified". | Avoids locking a shared row on every Add; "times chosen" is a popularity signal, not truth. | 10-18 |
| PSR-D37 | Record quality: a **hidden flag** for bad records; **one source-and-retention note per record**; an ISBN **check-digit test and a small blocklist** of placeholder or reused ISBNs; the **normalizer (rule) version** stored with each key. | One bad ISBN would otherwise merge unrelated books for every store. | 10-18 |
| PSR-D38 | The **real scanned titles** (called the 84-title set in planning; the saved file [`data/benchmark-spine-readings-2026-10-18.json`](./data/benchmark-spine-readings-2026-10-18.json) holds 85 unique spine readings, misreadings included) become a fixed benchmark that measures **wrong-edition picks**, not just the match rate. Relaxed automatic matching and tie picks are switched on only after it passes. | A higher match rate is worthless if it picks wrong editions. | 10-18 |
| PSR-D39 | **What is written when:** Open Library editions that pass the relaxed title-and-author match are saved to the catalogue when the lookup completes, so the next store finds them without a call. Times chosen counts at selection; times added counts at Add. | Owner agreed (10-18) to "every edition that passes the relaxed title + author match"; design study 1 prefers writing only at Add — the trade-off is carried into SDD-2 pass 2 (§14 Q3). | 10-18 |
| PSR-D40 | Owner edits (title fixes, notes, price, shelf, condition, damage, category, labels) **never** reach shared rows; they stay on the store's private inventory row. | One store's typo must not spoil the catalogue for everyone; tenant isolation. | 10-18 |

### G. Category and genres

| ID | Decision | Why | Date |
|---|---|---|---|
| PSR-D41 | Category list: General – Fiction · General – Non-fiction · Educational / Academic · Children's · Comics & graphic novels · Antique · Religious & spiritual · Magazines & periodicals · Regional-language · Other. Antique stays a category (buyers can browse it). | Owner-chosen list; "ok then let it be in category". | 10-18 |
| PSR-D42 | **Auto-detect** means **Gemini decides**: when the pre-scan category is Auto-detect, Gemini returns a category for each book as part of the same photo analysis (no extra call); the server checks it against the list, and an invalid or missing value gives **Other**. Gemini is told the priority order for a book that fits several: Antique → Magazines & periodicals → Comics & graphic novels → Children's → Educational / Academic → Religious & spiritual → Regional-language → General – Fiction / Non-fiction → Other. Gemini is asked for a category only when Auto-detect is selected. | Owner 10-19: "Either owner can select it in the pre-scan the category, or he can select the option as auto-select. Later, then the Gemini will return the parameter of category based on its analysis." The earlier catalogue and provider-genre tiers were dropped (§5). | 10-18; amended 10-19 |
| PSR-D43 | Category is stored on the **inventory row and the public listing**. **All provider genres** are stored on the inventory row as a private reference. Existing inventory rows get "Other"; existing inventory is otherwise ignored (development data). | "we need to store the genres for reference, however many there are." | 10-18 |

### H. Copies

| ID | Decision | Why | Date |
|---|---|---|---|
| PSR-D44 | **Each card becomes its own inventory row.** The Owner sets the quantity on the card. No merging and no duplicate prompt at Add. | "Every book gets a different row, and if there are multiple quantities … the owner itself updates the quantities." | 10-18 |

### I. Delivery

| ID | Decision | Why | Date |
|---|---|---|---|
| PSR-D45 | Build in **18 small slices** grouped into **6 SDDs**; at most one migration per slice; one branch and PR per slice; red-first tests in the existing layers; SDDs written in two passes. | Large units carried too much risk. | 10-18 |
| PSR-D46 | Part 1 stays in **Phase 9** (scope change recorded in DOC-13). Part 2 (barcode, shop sales, provider benchmark) is a follow-on package with its own SDD. | Keeps one active phase. | 10-18 |

## 5. Rejected options (do not reopen without the Owner)

| Option | Why it was rejected |
|---|---|
| Full catalogue engine (per-field provenance, change-log table, `pg_trgm` fuzzy search) | Large cost, little gain now. Can be added later on the same tables. |
| Google as a backup provider / Google data in the catalogue | Rate limits; Google APIs ToS §5(e)(1) forbids permanent copies. Switch kept for later. |
| Google cover as a fallback on Open Library editions | May show a different edition's cover. |
| "Search again" fetching a next page | Typed ISBN covers exact needs; extra state for little gain. |
| Hard delete inside Remove | 9 referencing tables, 2 immutable; moved to slice 18. |
| Undo / restore of a removed book | "removed means removed". |
| A "Finish scan" button | Server auto-close does the job. |
| Catalogue category tier for Auto-detect (the category most stores chose for the work) | Counting stores' choices conflicts with PSR-D40; Owner 10-19: Gemini decides. |
| Provider genres as an Auto-detect tier | Owner 10-19: Gemini decides. Genres are still stored privately for reference (PSR-D43). |
| Scan photo as cover, or kept as a private reference | Shows many spines and possibly people; "least complicated". |
| Tie picks kept private | Owner: publish them like every other book. |
| Merging copies into one row / duplicate pop-up at Add / ISBN duplicate hint | Chosen editions are often stand-ins, so ISBN duplicates would mislead; the Owner sets quantity. |
| Public "Edition details may differ" note | Dropped by the Owner. |
| Labels with colours, starter sets, visible limits or a "Show to buyers" switch | Simplified at the Owner's request; labels are private. |
| Antique as a label | Buyers could not browse it. |
| Barcode offline queue | The hardest part of barcode mode; shops are online. |
| Store View bulk edit and CSV in this rework | Post-inventory work, deferred. |
| Splitting lookups evenly between Google and Open Library | Lower Open Library quality; Google now off anyway. |
| Large work units instead of slices | Higher risk; harder to revert. |

## 6. Cross-slice rules

These hold after every slice. A slice that cannot keep one stops and reports.

| ID | Rule |
|---|---|
| PSR-R01 | One Add creates at most one inventory row per card, under any retry, double tap, lost response, restart or second device. |
| PSR-R02 | A failed or blocked publication never removes, hides or undoes an Add. |
| PSR-R03 | A removed card never comes back in any Owner view, count or action, and late worker results for it are ignored. |
| PSR-R04 | No store's private data (price, notes, shelf, condition, damage, labels, Owner title edits, which store owns which copy) reaches shared catalogue rows, the shared cache or the stats table. Server-derived `store_id` stays authoritative (MAS-03). |
| PSR-R05 | No Google-sourced data enters the catalogue. Google stays off unless the Owner turns it on. |
| PSR-R06 | Old and new app versions both work while a slice rolls out; every migration is forward-only and compatible with the running app and worker. Applied migrations are never edited. |
| PSR-R07 | Server validation is never weakened to make the UI simpler; hidden steps stay validated. |
| PSR-R08 | Persisted candidate states and session statuses keep their existing names (candidate: processing, ready, needs_review, possible_duplicate, failed, commit_in_progress, committed; session: active, closing, closed, expired). Card statuses (PSR-D04) are display labels. |
| PSR-R09 | Provider output and model output are untrusted until validated (MAS-02); Open Library etiquette (spacing, identifying User-Agent) is kept. |
| PSR-R10 | Manual paths keep working when providers, Gemini or quotas fail (MAS-10, MAS-16): the Owner can always Add with a typed title and author. |
| PSR-R11 | Nothing from §11 (deferred) is built inside a slice. |
| PSR-R12 | Each slice has at most one migration, its own branch and PR, red-first tests, and recorded evidence before the next slice starts. |
| PSR-R13 | Owner-facing text is plain language; error states say what to do next. |
| PSR-R14 | Accessibility is kept: every new control has a label, statuses are announced, and nothing relies on colour alone. |

## 7. Slice map, build order and guardrails

### 7.1 Slices

"Migration" means a new forward migration file. Every migration needs three
separate Owner approvals: create the file, apply it, and (where code ships)
deploy.

| # | Slice | SDD | Depends on | Migration | Where | Size / risk | Decisions |
|---|---|---|---|---|---|---|---|
| 1 | Quick fix for the stuck "Review book": Add re-saves when the review was reset (before Add, or by Add's own save) | 1 | — | None | App | M / med (SDD-1 pass 2) | D02, D03 (interim), D04 |
| 2 | Declutter: one edition button, simplified sheet, edition line, cleaner card and header, "Leave without saving?" | 1 | 1 | None | App | M / low | D05, D07, D09, D10, D47 |
| 3 | Remove the after-Add buttons and the Inventory tab's duplicate list | 1 | 2 | None | App | S / low | D04, D12 |
| 4 | Remove full correction; keep and simplify "Add a book" (title and author) | 1 | 2 | None (Q9 deferred to Unit 5C; Q1 needs none) | App | 4a M / med (deletions, "Add a book", summary); 4b S / med (script recompute, three languages, removal of the unused variant client; Owner, 2026-10-21) | D11, D13 |
| 5 | Typed ISBN in the edition sheet and in "Add a book" | 1 | 2, 4 | One per part (no Owner ISBN path exists, F29; §14 Q2) | App + Owner API + database + worker | L / high (split expected: 5a sheet ISBN lookup, 5b ISBN in "Add a book") | D06, D13 |
| 6 | Catalogue link fix: every Add finds or creates the catalogue edition and links it | 2 | — | One | Database | M / med | D34, D35, D40 |
| 7 | Lean catalogue writes from Open Library, stats table, shared cache | 2 | 6 | One | Database + worker | L / med | D33, D35–D37, D39, D40 |
| 8 | Open Library first in the automatic match, ISBN and publisher clues, Google off, protection | 2 | 7 | Maybe (registry and SQL predicates) | Worker + database | L / med (F34: Open Library has no automatic adapter yet; pass 2 may split) | D22, D25, D27, D28 (clue), D29, D31, D32 |
| 9 | Relaxed automatic match and tie pick, saved results for the sheet; switched on only after the benchmark passes | 2 | 8 | Maybe | Worker + database | M / med | D26, D28, D30, D38 |
| 10 | Remove all remaining; no restore; content-free audit | 3 | — | None expected (removal audit is already ID-only, F33) | App (+ database tests) | S–M / low–med | D18, D19, D20 |
| 11 | Server auto-close when every card is Added or Removed | 3 | 10 | One | Database (+ app) | L / high (lock graph, F39) | D01, D09, D21 |
| 12 | Daily limit (≤500 books per store per day, IST) | 3 | — | One | Database + Owner API + app | M / med–high | D23 |
| 13 | Single Add with receipt (replaces slice 1's quick fix) | 4 | 6, 1, 11 | One | Database + Owner API + app | L / **high** | D02, D03, D04, D44, D47 |
| 14 | Pre-scan publish choice acted on by Add | 4 | 13 | One | Database + app | M / med | D15 |
| 15 | Category: pre-scan choice, Auto-detect, card picker, genres stored | 5 | 13, 8 | One per part (split into 15a storage/picker and 15b Gemini Auto-detect expected) | Database + worker + app | L / med | D08, D16, D41–D43 |
| 16 | Labels (private, pre-scan) | 5 | 13 | One | Database + app | M / low–med | D17 |
| 17 | End-to-end check of the whole cycle | 0 | 1–16 | None | Tests + in-app | M / — | all |
| 18 | Physical deletion of removed cards and scan photos (later, own approval) | 3 | 10, 11 | One | Database + worker | L / high | D19, D24 |

### 7.2 Build order

SDD-1 (1 → 2 → 3 → 4 → 5) → SDD-2 (6 → 7 → 8 → 9) → SDD-3 (10 → 11 → 12) →
SDD-4 (13 → 14) → SDD-5 (15 → 16) → slice 17 → slice 18 later → Part 2.

- Slices 1–5 are app-first, low-risk, visible wins; slice 1 removes the
  stuck card immediately.
- Slices 6–9 build the catalogue before category reuse needs it; matching
  changes are switched on only after the benchmark (PSR-D38).
- Slices 10–12 are independent of matching.
- Slice 13 is the riskiest database change and is isolated; slice 1's quick
  fix covers the stuck-card problem until it lands.
- Slices 15–16 need slice 13's Add to carry category and labels.

### 7.2a Core first, then reassess (Owner, 2026-10-19)

The Owner chose to build the core of the brief first:

1. **Stage 1:** slices 1 → 2 → 3 → 4. These change only the app. The Owner
   uses each slice in the app before the next one starts.
2. **Stage 2:** slices 11 and 13. These are the two server changes the brief
   needs: closing a session discards unfinished cards, and Add becomes a
   single server-checked action.
3. **Stage 3:** stop and reassess. The Owner decides whether to build the
   remaining slices, in what order, or whether to drop some. They are:
   - 5: typed ISBN;
   - 6–9: catalogue and matching;
   - 10: Remove all;
   - 12: limits;
   - 14: publish at Add;
   - 15–16: categories and labels;
   - 17–18.

Those slices stay designed, but none is approved for building yet. Slice 11's
and 13's own dependencies are checked again in their pass 2. Anything they
need from a deferred slice is either pulled forward as a minimal part or
brought back to the Owner.

### 7.3 Guardrails

1. **Each slice fits one session.** If pass 2 finds more than one migration,
   too many areas, or more than one session of work, the slice is split
   before building starts and this map is updated.
2. **Each slice works by itself.** No "finished in the next slice".
3. **No slice starts** until the previous one is green, recorded in tracker 38
   and the phase tracker, and approved by the Owner.
4. **Slice template** (used by every area SDD in pass 2): Goal · Scope / not
   in scope · Depends on · Code it touches (verified) · Migration (none, or
   name, effect, readback, rollback) · Behaviour · Failure and recovery ·
   Acceptance checks (Given / When / Then, each citing decision IDs) · Tests
   written first, by layer · Done means · Size and risk.
5. **Traceability:** each area SDD keeps a table decision → slice → acceptance
   check → test. A row without a test means the slice is not done.
6. **Done means:** red-first tests recorded failing, then green; `tsc`; the
   relevant Jest, server and database suites; the Phase 9 validator;
   `git diff --check`; an in-app click-through where the slice changes the
   app; tracker 38, the phase tracker and DOC-13 updated; migration ledger
   updated where a migration exists.

## 8. Verified facts (as of 2026-10-19)

"Code" = read in the repository at `main` `8863885`. "Live" = read-only SQL
on project `ahntbtktjjmvfosgkmgn` through Supabase MCP. "Reviewed" = confirmed
independently by two reviewers and spot-checked. Re-verify before relying on
any fact in a migration plan (AGENTS.md database rule).

| # | Fact | Source |
|---|---|---|
| F1 | Live migrations: 184 rows, latest version `20261017083830` (library); Phase 9 latest is M77 `20261017083206`. | Live, 10-19 |
| F2 | Today Add is up to three client calls: save review (`phase9_update_candidate_review_v2`; only when the policy's `needsSave` says so, `inventoryCommitPolicy.ts` L37), reread, then `phase9_add_candidate_to_inventory_v1` (latest body M69 `20261008000069`), orchestrated by `src/features/imageInventory/commit/inventoryCommitCoordinator.ts`. Add already replays by idempotency key (operation `U7AC01` in `phase9_idempotency_keys`). | Code |
| F3 | Three triggers clear `review_ready`: `phase9_owner_ux_metadata_revision` (M29 `20260730000029` L103–121; on snapshot or duplicate-advice change) and `phase9_edition_identity_change` (M69 L307–340; on a query-identity change it also clears edition options and resets the saved choice to manual); and `phase9_owner_ux_lookup_revision` (M29 L123–135, replaced in M67 `20261007000067` L276–286; on any insert, update or delete in `phase9_metadata_lookups` other than an Owner edition-options job it bumps `metadata_revision` and clears `review_ready` — the worker-touch reset). `candidateCanStartCommit` (`inventoryCommitPolicy.ts`) needs `reviewReady`, so a reset leaves the card on "Review book". | Code |
| F4 | `cardReadyNow` in `batchReviewStatus.ts` is the single client readiness rule (main commit `0a9e5c7`). | Code |
| F5 | In M69 L142–154 the catalogue link is copied only when the selection source is `current_suggestion`; an edition picked from the sheet commits with `canonical_edition_id` NULL. No production code inserts into `canonical_works` or `canonical_editions`. | Code, reviewed |
| F6 | Every Add inserts `visibility_status='draft'`, `publication_status='private'`, outcome `committed_private`; `publicationIntent` is recorded in `publication_decision` and never acted on. | Code |
| F7 | `image_extraction_sessions.default_publication` exists (`text`, default `'private'`, check `private|publish`), as do `default_quantity`, `default_condition`, `default_location`, `default_price_minor`, `batch_label`. | Live |
| F8 | `image_extraction_candidates.committed_inventory_id` is UNIQUE; `store_inventory` has no unique index on `created_from_candidate_id`. | Live |
| F9 | Nine foreign keys reference `image_extraction_candidates`; only `phase9_candidate_edition_state` cascades. Others include `store_inventory`, `phase9_selected_metadata_snapshots` (immutable), `phase9_metadata_lookups`, `phase9_metadata_provider_calls`, `metadata_enrichment_attempts`, `phase9_search_variant_proposals`, `phase9_metadata_coalescing_waiters` and `marketplace_sec.phase9_metadata_representative_covers`. | Live |
| F10 | Removal today: `phase9_owner_remove_candidate_v1` sets `review_disposition='owner_removed_from_scan'`, writes an audit entry and an event; edition state is cleared by trigger. There is no restore path. | Code |
| F11 | **A scan session accepts one photo.** `phase9_issue_scan_upload` and `phase9_register_scan_upload_completion` raise `P9_SINGLE_IMAGE_LIMIT` when the session already has a non-removed input (M35). Older sessions (before M35) have up to 10 inputs. Candidates: `candidate_index` 1–15 (CHECK), unique per `(input_id, candidate_index)`. | Live, code |
| F12 | `phase9_add_manual_candidate` numbers a manual card as the session's highest index + 1 and raises `P9_LIMIT_EXCEEDED` above 15, so "Add a book" fails when the photo already produced 15 cards. | Live |
| F13 | Automatic matching today: local lookup → strict Google ranking (exact normalized title plus all authors; a tie means ambiguous). The relaxed rules (`explicitEditionTitle.ts`, M76/M77) apply only to explicit Owner search. Historical outcomes: 47 accepted, 51 ambiguous, 80 no match, 1 local match. | Code, live (10-17) |
| F14 | Gemini already extracts `observed_publisher_clue` (94 of 180 candidates) and `observed_isbn_clue` (4 of 180). The publisher clue reaches `editionClues` but is compared with edition statement, series, volume and format, not publisher. | Live, code |
| F15 | Google APIs ToS §5(e)(1) forbids building databases or permanent copies of API content and caching beyond the cache header; the Books API terms forbid charging users a fee without Google's permission. Keyless requests returned HTTP 429; the cache header value is still unread (the key is a server secret). | Web (10-18), recorded advice, not legal opinion |
| F16 | Open Library asks for about 1 request per second (3 per second with an identifying User-Agent and email), says the API is not for high-traffic commercial use, and points bulk users to monthly dumps. Its licensing page does not state CC0. The worker already spaces requests about 1 s and sends User-Agent `BookConnect edition lookup` (no contact email yet), but the limiter is per worker process. | Web (10-18), code |
| F17 | Catalogue tables: `canonical_works` (1 row; unique `title_normalized, primary_authors`), `canonical_editions` (1 row; unique `isbn_13`, unique `isbn_10`; has `categories[]`, `description`, `cover_url`), `book_metadata_sources` (0 rows; unique `provider, provider_book_id`; `expires_at`, `raw_delete_after`). Works and editions are readable by `anon` and `authenticated`. | Live, code |
| F18 | `phase9_metadata_cache_entries`: every row is `store_private`; the schema already supports `public_bibliographic` rows with `store_id` NULL. | Live |
| F19 | `store_inventory` has `canonical_work_id`, `canonical_edition_id`, `created_from_candidate_id`, `entry_method`, `publication_status`, `visibility_status`, `listing_quality_status`, `printed_mrp_minor`, quantity total/available/reserved/sold/removed; no category, genre or label columns. 23 rows. `marketplace_book_listings` has no category column. | Live |
| F20 | `phase9_selected_metadata_snapshots.coherent_edition` keeps title, subtitle, authors, publisher, publishedDate, language, script, isbn10, isbn13, pageCount, **categories**, description, editionStatement, volume, format, series, coverReference, providerRecordId plus version and confidence fields. Inventory keeps none of categories, subtitle, page count or series. | Live, code |
| F21 | Store View: publication states private, publication_pending, published, publication_failed; effective states private, live, paused, needs_attention, publication_failed, out_of_stock; attention reasons include missing_price, missing_condition, damage_evidence_required, not_sellable, moderation_blocked, store_policy_blocked, subscription_restricted, entitlement_blocked, active_listing_limit_reached, publication_failed. `phase9_store_view_page_v1` has no filter; `phase9_store_view_page_v2` (M44) filters only all/private/live/paused/needs_attention/out_of_stock — no category or label filter exists. Store View asks "Publish this book?" before every Publish. | Code |
| F22 | `phase9_adjust_inventory_stock_v2` changes total and available only; it never records a sale. | Code |
| F23 | `store_usage_counters` (store, counter key, period start/end, value) exists from the marketplace foundation and is empty; `phase9_usage_reservations` holds per-job cost reservations. No per-store daily book limit exists. | Live |
| F24 | The Owner API is Edge Function `phase9-owner-ingestion` v17 (JWT on); the Render metadata worker runs `main` `f376c26`. | Tracker 37 §72, 10-17 |
| F25 | The stuck "Review book" card: a saved review with `review_ready=false`, no card edits and no blockers. `needsSave` is false, so `candidateCanStartCommit` requires `reviewReady`, Add is disabled, the attention list is empty and `reviewStatusLabel` falls through to "Review book" (`batchReviewStatus.ts` L41). A test pins this (`postScanUiCorrections.test.tsx` ~L546). Today only the full-correction Save clears it for a card with no edits. The server needs-review predicate also counts `ready` cards without `review_ready`, so the hub's "Review books (N)" can disagree with the cards. | Code map, spot-checked |
| F26 | Blocker `variant_source_stale` (a `phase9_search_variant_proposals` row with status `stale`) is not card-resolvable (`draftResolvableBlockerCodes`); only the full correction's search-wording sheet clears it. Live rows today: 1 proposed, 1 rejected, 0 stale. Re-checked 2026-10-21 (tracker 38 §22): the card's `_v2` save refuses while the blocker is there, and it never makes a proposal stale (since M29 the refresh trigger skips snapshots with `value`); clearing it is deferred to Unit 5C (SDD-1 §6; Owner, 2026-10-21). | Code, live |
| F27 | "Mark false" (`phase9_skip_candidate`) and "Add missed book" (`phase9_add_manual_candidate`) are direct client RPCs, not Owner API actions. The batch card's allowed actions do not include `mark_false` or `add_missed`; the candidate detail does. The "Add missed book" button is disabled at 15 cards. | Batch-card grant `20260913000061…sql` L251–258 (`view_metadata`, `remove_from_scan`, `view_readiness`, `save_review`, `add_to_inventory`); detail grant `20260913000062…sql` L55–60 (`mark_false`, `add_missed`). The app contract's union type (`ownerBatchReviewContracts.ts` L111–114) lists `add_missed`, but the server never grants it on a batch card. |
| F28 | After a batch-card Add the app shows only "View in Store View"; "Continue Reviewing" appears only on the full-correction screen's Add. | `AddCandidateToInventoryAction.tsx`: the batch card passes `card` (`BatchReviewCard.tsx` L310) and gets the coordinated variant (L42–62, Store View button only); the full-correction screen (`CandidateReviewScreens.tsx` L329) gets the legacy variant (L95–204, both buttons); dispatch at L235–238. |
| F29 | No Owner path sets an ISBN. The edition-search command carries no query text; the query identity comes from the card (`observed_isbn_clue` is written only from vision output), and Open Library / Google search by ISBN only when the card has no title or author. | Code map |
| F30 | Session expiry is evaluated by comparing `expires_at` (no code writes `expired` or `closing`). `phase9_close_session_v3` checks only that inputs are finished, not cards. Client auto-close (`sessionAutoClosePolicy.ts`) requires `committed === detected` and zero removed or false detections. | Code map |
| F31 | No SQL enforces a per-store quota; `P9_QUOTA_EXCEEDED` exists only in contract vocabulary and client mapping. | Code map |
| F32 | Input removal sets `media_assets.delete_after` (≤24 h), but no job physically deletes `media_assets` rows when it passes; output cleanup (`claim_phase9_media_output_cleanup_jobs`) skips objects still referenced. `image_analysis_results` and `image_analysis_observations` are immutable (BEFORE UPDATE OR DELETE triggers). | Code map |
| F33 | `phase9_owner_remove_candidate_v1` (latest M54 L279–345) writes audit and event entries containing only IDs, dispositions, versions and command IDs — no book text. A trigger blocks any change away from `owner_removed_from_scan`. | Code |
| F34 | **The automatic lookup is Google-only.** The worker builds only a Google primary (`workers/phase9-metadata-worker/bootstrap.ts`); the Open Library adapter's automatic `lookup()` throws and Open Library serves only explicit Owner search, where it is the primary because Google option retention is not configured. Ranking (`googleBooks/ranking.ts`) is the only automatic ranker and needs at least one author, so title-only cards never auto-match. Live registry: `google_books` 1.0.0 and `open_library` 1.0.0 both enabled with matching and storage allowed, revalidation 86400 s. | Code map, live |
| F35 | The cache writer always writes `store_private` entries (24 h); no runtime code writes `public_bibliographic`, though the readers accept it. A negative or ambiguous cache hit completes as manual with no provider call. | Code map |
| F36 | Open Library explicit search asks `search.json` for the top work only (`limit=1`), then up to 10 editions, with at most 6 GETs per lookup; an edition with no authors inherits the work's authors. | Code map |
| F37 | A reviewer flagged a possible query-identity mismatch for cards with both an ISBN clue and a title (SQL strategy `isbn` vs worker `bibliographic`). Not observed live: of 4 such jobs, 1 accepted, 2 no match, 1 material conflict, none failed on identity. Pass 2 of slice 8 adds a test before relying on ISBN clues. | Code map, live |
| F38 | Price and condition are required before any Add, whatever the publication choice: the review blockers raise `price_invalid` for a missing or negative price and also for ₹0 when the card's `publicationIntent` is `publish`, and `condition_missing` for no condition (`phase9_owner_ux_review_blockers`, M55 `20260830000055` L108–109; the shape check repeats the ₹0 rule, M29 L845–848). So under today's gate "missing price or condition" stops Add itself; only ₹0 is a price case that could reach publication. | Code |
| F39 | Lock order is not purely session → candidate. Owner Add and Remove lock the session, then the candidate (M69 L127–129). But every candidate write fires the session-scope trigger, which then updates the session row (M29 L40–50), and the edition worker locks the candidate first (M67 L38–42). `phase9_add_manual_candidate` takes no session lock before inserting (M5 L137–143). | Code |
| F40 | The Open Library normalizer always returns `categories: []` (`metadata/openLibrary/normalizer.ts` L130); only the Google decoder fills categories (`googleBooks/decoder.ts` L162). With Google off, no provider genres exist until Open Library subjects are normalized. | Code |
| F41 | The card's script is carried from the saved review or the observed value and is not recomputed when the title or language changes (`review/compactReviewDraft.ts` L168–171, `compactReviewScript`); validation checks title text against language and script (`contracts/ownerUxValidation.ts` L94–104), so a cross-script title fix needs the script to follow. | Code |
| F42 | Edition-option cleanup checks each option list against its own source's registry row (`phase9_edition_source_policy`, M73 `20261011000073` L154–164), which accepts only `google_books` and `open_library`. Switching Google off clears only Google-sourced lists; a catalogue-sourced list would be cleared at once unless the policy learns that source. | Code |
| F43 | The edition worker's search context uses the Owner's confirmed title and authors when they are confirmed (M67 L77–82), so query keys can carry Owner-typed text. | Code |
| F44 | `phase9_replay` raises `P9_IDEMPOTENCY_MISMATCH` when the same key arrives with a different fingerprint (M5 L25–35); today's Add fingerprint includes the command ID and all three expected versions (M69 L121–123). | Code |
| F45 | `phase9_close_session_v3` raises `P9_STATE_CONFLICT` for a session that is no longer active unless the same key replays (M52 L441–445). | Code |
| F46 | The catalogue work key is `UNIQUE (title_normalized, primary_authors)` with `primary_authors TEXT[]` (M3 `20260628000003` L9–13): author order or case differences make two works. | Code |

## 9. Existing rules this rework supersedes or amends

The decision register already binds; each rule below is rewritten in its own
document by the named slice, so the documents never describe behaviour that
is not built. Until then, readers follow this table.

| Existing rule | Change | Amended by slice |
|---|---|---|
| P9-D85 "publication intent does not auto-publish", "batch label does not enter inventory" | Add attempts publication by the session choice (PSR-D15); the batch label becomes a label on inventory (PSR-D17). | 14, 16 |
| Unit 6G SDD §18 / AC17 (`06g-…-handoff-sdd.md`) — publish intent is provenance only | Same as above. | 14 |
| MAS-05 "creates exactly one new private inventory row" | One new row, created private; Add may then publish it in the same action. | 14 |
| Unit 7A (`07a-…-sdd.md`) "ends draft/private" and Unit 7B (`07b-publication-sdd.md`) "only when the Owner requests" | The pre-scan Publish now choice is the Owner's request; Add runs the Unit 7B publication path after commit; failure leaves private with a reason. | 14 |
| P9-D87 Store View confirms before Publish (today before every Publish, F21) | Still applies in Store View; the pre-scan choice is the confirmation for Add-time publication. | 14 |
| P9-D81 and today's review rule: ₹0 allowed for a private Add | Cards need a price above ₹0 before Add (PSR-D47); the pre-scan default may still be blank or ₹0. | 2 (app), 13 (server) |
| P9-D88 and Unit 6G full correction | Full correction removed. | 4 |
| DOC-3 §5.1 (fuzzy title+author = suggest only) and §5.2 (picker choice "does not promote canonical truth") | Relaxed automatic match and tie picks auto-select an edition shown on the card; Add is the Owner's confirmation; Add links (and may create) the catalogue edition. Exact ISBN-13 / Open Library ID identity is the only automatic merge key. | 6, 9 |
| DOC-3 §17 deferred "automated canonical merge without review" | Allowed only on exact ISBN-13 or Open Library edition ID; fuzzy merges remain deferred. | 6, 7 |
| DOC-3 INV-18 (removal keeps scan evidence) | Unchanged in Part 1; physical deletion amends it in slice 18. | 18 |
| P9-D84 (Remove has no Undo or Restore) | Kept; Remove all added. | 10 |
| P9-D86 representative Google cover | Inactive while Google is off; Google cover fallback cut. | 8 |
| `sessionAutoClosePolicy.ts` (client auto-close when nothing removed) | Server auto-close. | 11 |
| Default `default_publication = 'private'` | The pre-scan shows Publish now as its default (PSR-D15). The column default stays `private`; the new pre-scan sends the choice explicitly and marks the session, and Add publishes only for marked sessions, so sessions started by older apps (including the old "Prepare to publish") never auto-publish (§14 Q12). | 14 |

## 10. Review and design-study summary

- **Round 1 and round 2 reviews (10-18)** by Codex `gpt-6.1-sol` (xhigh) and
  OpenCode Go Muse Spark 1.3 found the plan coherent. Both confirmed the
  catalogue-link gap (F5), asked for a receipt on the single Add, moved
  auto-close to the server, put counts in a separate table, and pointed out
  that the publisher and ISBN clues already exist. They recommended Google off,
  cutting the Google cover fallback and "next page", a card category picker,
  counting removed books in the daily limit, and moving physical deletion to
  its own unit. All were accepted by the Owner (§4).
- **Design study 1 (slices 6–7, Muse Spark 1.3 xhigh, 10-19):** find-or-create
  inside the Add function, before the inventory insert; ISBN-13 first (ISBN-10
  converted, conflicting pair → no link), then Open Library edition ID; only
  Open Library-sourced choices may create shared rows; `ON CONFLICT DO NOTHING`
  + re-select for concurrent stores; stats in separate tables; shared cache
  through the existing `public_bibliographic` scope. It flagged: ISBN-13 is a
  lossy identity (accepted), `times_searched` is ill-defined for no-match or
  multi-work searches, the worker's 1 req/s limiter is per instance, and it
  prefers catalogue writes at Add rather than at lookup (see §14 Q3).
- **Design study 2 (slices 13–14, Muse Spark 1.3 xhigh, 10-19):** a new
  function alongside the old ones (old app keeps working); receipts reuse
  `phase9_idempotency_keys` with a new operation code; a committed card returns
  its receipt to any later caller; publication runs after the insert inside a
  sub-block that can never roll back the Add; the publish mode is read from the
  session; the readiness triggers are narrowed so they reset only on a real
  identity change. It listed the specs to amend (§9). Its proposal of a new
  session column for the choice is unnecessary: `default_publication` already
  exists (F7). A smaller marker for sessions started on the new pre-scan is
  still needed (pass-1 review P1, §14 Q12).
- **Pass-1 review of this SDD set (10-19, Muse Spark 1.3 xhigh, read-only):**
  verdict approve with fixes; 18 facts confirmed against migrations and code,
  none found wrong. Fixed in this pass: older-app sessions must never
  auto-publish (§9, SDD-4 AC14-8, Q12); per-work category counts belong to
  slice 15b, not slice 7 (SDD-5 AC15-9) (later dropped by the Owner, Q14); PSR-D01 and PSR-D22 gained
  acceptance checks; AC12-1 has one outcome (Q11); accessibility checks for
  every slice that adds UI; evidence added to F27 and F28; glossary terms
  for fresh sessions. Left to pass 2 as recorded notes: trigger call sites for
  slice 13, lock-order citation and `expired`/`closing` writers for slice 11,
  `Asia/Kolkata` day function for slice 12. Kept as expected splits rather
  than new slice numbers: 13a/13b and 15a/15b.
- **Round-2 review of this SDD set (10-19):** Codex `gpt-6.1-sol` (xhigh,
  verdict rework) and OpenCode Go Space Bunny (max, verdict approve with
  fixes), both read-only. Every claim was re-checked in the code before
  adoption (tracker 38 §11); one claim was stale (Google-off option
  cleanup was already made per-source in M73, F42). Adopted: three readiness
  triggers, not two (F3); the price and condition gate (F38, Q13); the lock
  graph (F39); no Open Library genres yet (F40); script follows the title
  (F41); provenance-based shared cache (F43); retry invariant for the single
  Add (F44); old-app close after auto-close (F45); work key normalization
  (F46); immutable Add receipts; store-wide daily-limit reservation (Q11);
  unfinished cards at manual close or expiry count as Removed; D40 versus
  D42 (Q14); exact ISBN retrieval and ISBN-only "Add a book"; language rule
  for tie picks. Two Owner decisions resulted, both taken 10-19: Q13
  (PSR-D47) and Q14 (PSR-D42 amended: Gemini decides).

Full study outputs are working notes (not repository authority); their
verified conclusions are carried into SDD-2 and SDD-4.

## 11. Out of scope, deferred and parked

**Deferred (post-inventory; discuss later):**
- Store View: category and label editing, category and label filters (needs a
  new page query — F21), bulk edit (price including % of MRP, category, labels,
  publish state, shelf) and CSV export. **Owner asked to be reminded to discuss
  bulk edit and CSV thoroughly.**
- Pricing tools and offers or discounts (rules targeting category, labels and
  condition; never changing the stored price; touch cart, orders, GST — DOC-6,
  DOC-15).
- "Notify me when available" (belongs in the notifications docs, DOC-10).
- Legal pages and seller details (to be discussed).
- Re-enabling Google, with retention rules.
- Regional-language books, by finishing Unit 5C (`05c-lite-multilingual-search-variants-sdd.md`)
  (Owner, 2026-10-21): a real regional-shelf scan test, then the per-language
  benchmark; clearing stale search wording on the card (SDD-1 §6, deferred
  from slice 4b) **before any language is switched on**; how the Owner
  approves search wording now that 4a removes the only screen for it (5C §13
  item 6 against D11); Tulu, Konkani and other languages without a
  script-rule entry; partial-word and typo-tolerant search (search matches
  whole words only today). Much of 5C already exists in code (re-checked
  2026-10-21, 5C §2). Fuzzy, language-filtered search in the store view and
  the marketplace is planned with the marketplace search work (Owner,
  2026-10-21; 5C §10). Candidate for the Stage 3 reassessment (§7.2a).

**Part 2 (own SDD after Part 1):**
- Barcode mode: online only; EAN-13 978/979 with check digit; read cooldown;
  duplicate pop-up "Add 1 to quantity (that card) / Discard"; "Type ISBN"
  fallback; non-book codes rejected; 977 (magazines) → photo mode; category from
  catalogue or genres, then a text-only Gemini call; a new non-photo input type;
  needs more than one book per session (F11).
- "Sold in shop": its own sale transition (available −1, sold +1); reserved
  copies cannot be sold; find by title, barcode or photo.
- Provider benchmark (ISBNdb, Hardcover) on real titles, saving each result as
  it arrives.

**Parked:** Owner-shared covers; "other stores have this book"; review queue;
paid feeds (ONIX, Nielsen); Open Library dump import; spine cropping; QR copy
tags; health screen and admin hide tool beyond the hidden flag; change log.

## 12. Pre-launch checks (not blockers for building)

1. **Google fee clause:** if BookConnect charges stores, get Google's
   permission or a lawyer's view before launch.
2. **Google data already stored** in inventory snapshots and picker state
   (existing exposure, separate from the catalogue): clear it or settle the
   terms before real stores go live.
3. **Open Library commercial use:** if volume grows, move to the monthly dumps
   as its guidance asks.
4. **Catalogue restore:** test one restore of the shared catalogue from backup.

## 13. Slice 17 — end-to-end check

**Goal:** prove the whole Part 1 cycle on the development project after slices
1–16.

**Acceptance checks:**
- AC17-1: Given a fresh session with pre-scan Publish now, a category and a
  label, when the Owner photographs a shelf and adds every card, then each card
  shows Added with its publish outcome, each book is in Store View only, the
  session closes by itself, and Live books carry category (public) and labels
  (private) (D01, D04, D12, D15, D16, D17, D21).
- AC17-2: Given a mix of clear matches, ties and no matches, when the scan
  finishes, then clear matches and ties show an edition with an Open Library
  cover or placeholder, and no Google call is made (D25, D28, D29, R05).
- AC17-3: Given one card removed and the rest added, then the session closes,
  the removed card never reappears, and the audit entry holds no book text
  (D19, D20, D21).
- AC17-4: Given a lost response during Add, when the Owner retries or reopens
  the app, then the card shows the original result and Store View has one row
  (D03, R01).
- AC17-5: Given a book already in the catalogue from another store, when it is
  scanned, then no provider call is made and its counts increase (D33, D36).

**Tests:** one Playwright web run (`npm run test:e2e:web`) covering AC17-1,
plus the in-app click-through and read-only SQL readback for AC17-2 to AC17-5.

## 14. Open questions carried into pass 2

| # | Question | Recommended default | Area |
|---|---|---|---|
| Q1 | "Add a book" when the photo already has 15 cards (F12). | Keep the 15 cap (a photo with more books is rejected anyway, MAS-01) and show "This scan already has 15 books — scan the rest separately". No migration. | SDD-1 slice 4 |
| Q2 | How does a typed ISBN reach the lookup? Today the request has no query text and ISBN search runs only when the card has no title or author (F29). | One migration: the edition-request RPC accepts an optional validated ISBN-13 for that request only (a request-scoped ISBN query kind), never overwriting the card's observed fields; the worker searches by ISBN when it is present. Confirm in pass 2. | SDD-1 slice 5  **SDD-1 pass 2 (2026-10-19) proposes a departure:** the ISBN is stored on the card (`owner_isbn13`), because four places check the query identity (SDD-1 §7); The Owner confirmed this departure on 2026-10-19; Q2 is superseded by it. |
| Q3 | Catalogue write timing: at lookup completion (PSR-D39) or only at Add (design study 1). | Keep PSR-D39 (write at lookup for editions passing the relaxed match), with the hidden flag and times-chosen ordering limiting noise; measure growth. Raise with the Owner only if pass 2 finds a technical blocker. | SDD-2 slice 7 |
| Q4 | Meaning of "times searched" when a search finds no work or several works. | Count once per completed lookup on the chosen or auto-selected work only. | SDD-2 slice 7 |
| Q5 | Open Library pacing across several worker instances. | Keep one worker instance, or share the throttle through the database, before enabling Open Library-first broadly. | SDD-2 slice 8 |
| Q6 | Daily limit storage: reuse `store_usage_counters` or a Phase 9 counter table. | Decide in pass 2 after reading its RLS and grants; one atomic check-and-increment either way. | SDD-3 slice 12 |
| Q7 | Default for the category pre-scan field. | Auto-detect. Slice 15 is outlined on this default; Owner approval of the SDD set confirms it. | SDD-5 slice 15 |
| Q8 | "Add all ready" footer (INV-19) under the single Add. | Keep it; it calls the single Add once per ready card, each independently. | SDD-4 slice 13 |
| Q9 | Cards blocked by `variant_source_stale` (F26) once full correction is gone. | **Resolved 2026-10-21 (Owner): deferred.** No card can reach the blocker today (tracker 38 §22); clearing it on the card is built before any Unit 5C language is switched on (SDD-1 §6, §11 below). The earlier idea (a card save resolves stale proposals) was not adopted. | SDD-1 slice 4 |
| Q10 | The hub's "Review books (N)" count and the server needs-review predicate (F25) once the review step is hidden. | Slice 3 removes the "Review books" entry; the predicate is left alone until slice 13 makes `review_ready` follow the card. | SDD-1 slices 3–4 |
| Q11 | Daily limit admission when several photos are in flight. | **Reserve at upload:** each upload reserves 15 books against the store's day (atomic, store-wide, so several Owners or staff cannot over-admit); vision completion converts the reservation to the real count and releases the rest; failed, rejected or removed photos release their reservation; a photo is refused when fewer than 15 remain only if the store prefers exactness — otherwise allow it and cap the real count. Counting only at completion cannot bound overshoot when several uploads are admitted before any completes (round-2 review). Pass 2 confirms. | SDD-3 slice 12 |
| Q12 | How a session is marked as started on the new pre-scan, so Add may publish it (§9). | A value written only by the new session-start contract, atomically when the new session row is inserted — never on resume or replay. Absent or default means **unmarked** (no auto-publish). The old `phase9_start_session_v2` signature stays callable. Pass 2 picks the smallest safe form (a new column or contract marker). | SDD-4 slice 14 |
| Q13 | ₹0 price under Publish now. | **Decided 10-19 (PSR-D47):** price above ₹0, condition and quantity are required before Add; the pre-scan default may be ₹0, and cards then show Needs details until a price is entered. Price and condition are never publication blockers. | SDD-1 slice 2, SDD-4 slices 13–14 |
| Q14 | Catalogue category tier versus PSR-D40. | **Decided 10-19 (PSR-D42 amended):** Auto-detect is Gemini only; no category counts are kept. | SDD-5 slice 15 |

## 15. Process rules for every slice

- **Authority:** an approved SDD authorizes nothing by itself. The Owner
  approves building each slice; each migration needs separate approvals to
  create, to apply and to deploy. Commit, push and PR only when the Owner asks;
  merge only Owner-approved PRs, with merge commits.
- **Database:** verify facts with Supabase MCP (read-only) before any
  migration plan and again before application; record each migration in the
  migration ledger with filename, live version, project check, effects and
  readback.
- **Tests:** red-first in the existing layers — Jest app tests (`npm test`),
  server/worker tests (`supabase/functions/__tests__`), Phase 9 database tests
  (`npm run test:phase9:db` and the Postgres harness scripts), Playwright web
  (`npm run test:e2e:web`). Known flake: `ClubManageScreen.test.tsx`.
- **In-app checks:** the development app may be clicked through freely; never
  enter credentials (the Owner signs in).
- **Closeout:** tracker 38 entry in the SESSION-START §8 log shape; phase
  tracker and DOC-13 updated; `CODEBASE_MAP/` updated if the slice changed what
  it describes; validator and `git diff --check` run; uncommitted changes
  reported.
- **Agents:** read-only code maps by Haiku subagents; design studies and
  reviews by OpenCode Go at the highest setting: DeepSeek v4.1 Flash (most
  precise) and MiniMax 3.1 Flash (formerly "Space Bunny"; most thorough);
  Codex `gpt-6.1-sol` (xhigh) as a second opinion when a review falls short.
  Agent output is input, never authority; the SDDs are written and verified by
  the orchestrating session.
- **SDD reviews (Owner, 2026-10-21):** every SDD change is reviewed read-only by
  Sonnet and OpenCode Go `gemini-4-argon-contributor`; a complex SDD (state
  machine, idempotency or multi-request flows) by Opus instead of Sonnet, with
  Argon still. Large review diffs are split between reviewers. Each finding is
  verified in the code before the orchestrating session writes the final text.
- **Who writes code (Owner, 2026-10-19):** Codex `gpt-6.1-sol` (xhigh) writes
  all product code and tests, from a strict brief that names:
  - the SDD section and the files;
  - the red-first order;
  - what it must not touch: migrations, other slices, and unrelated changes.

  Codex stops and reports if the design conflicts with the code. The
  orchestrating session does not write product code. It writes the briefs,
  reads every diff, checks claims in the code, and reviews.
- **Briefs (Owner, 2026-10-19; adopted 2026-10-20):** before any brief is sent
  (coding, review, test or browser), the orchestrating session checks it
  against known traps: replaying a refused request, react-native-web
  `Alert.alert` being a no-op, stale versions after a refetch, dead code
  (D2-5), accessibility (D2-6), a working next step for every new message,
  tests that prove behaviour without faked parts, and correct files and line
  references. For risky slices, one OpenCode model also reviews the brief.
  In slice 2 both real bugs came from gaps in the brief.
- **Pre-merge review (Owner, 2026-10-20):** the Owner does not review PRs, so
  before the PR an OpenCode model (DeepSeek v4.1 Flash, max, read-only, no
  shell commands) reviews the whole slice diff against `main` as the PR
  reviewer, and the orchestrating session reads the whole diff against the
  SDD. Confirmed findings get one bounded red-first fix round.
- **Credits (Owner, 2026-10-20):** delegate by cost without lowering quality.
  The orchestrating session may run test commands itself as background jobs
  that print only the summary and failures (cheaper than a subagent; the
  output comes straight from Jest).
- **Test runs:** delegated to a Haiku subagent, or to OpenCode Go, with a
  strict prompt: run exactly the listed commands, report raw pass/fail counts
  and failures verbatim, and change nothing. The orchestrating session checks
  the raw output itself before recording a result.
- **Browser checks (Owner, 2026-10-19):** in-app and browser checks are test
  runs, so a Haiku subagent runs them from a strict script: the exact card,
  the clicks and typing, and what to report verbatim. If a step cannot be done
  as written, Haiku stops and reports; it never improvises. The orchestrating
  session starts the dev server and confirms the result from server state,
  read only. It never signs in; the Owner does.
- **Slice order (Owner, 2026-10-19, after slice 1):**
  1. Codex implements red-first.
  2. The orchestrating session reviews the diff, with a written trace for
     each new outcome: what the server does, what the screen shows, and what
     the Owner can do next.
  3. The review loop runs when the slice is risky; the medium review pass
     runs when the slice is medium (both below).
  4. Haiku runs the tests.
  5. Haiku runs the browser check.
  6. Documentation, validator and `git diff --check`.
  7. Commit, push and PR, only when the Owner asks.
- **Review loop, for risky slices:** a slice is risky when it touches save,
  Add, retry or idempotency logic, server contracts, tenant or security rules,
  or SQL. The orchestrating session decides this at slice start and says why.
  UI-only or deletion slices with strong tests skip the loop, unless the
  orchestrating session or the Owner classes them as medium (next bullet).
  1. Two read-only reviews run in parallel (starts staggered ~45 s): OpenCode
     Go DeepSeek v4.1 Flash and MiniMax 3.1 Flash, both at max.
  2. The orchestrating session verifies every finding in the code and rejects,
     with a reason, any that are wrong.
  3. Codex `gpt-6.1-sol` (xhigh) makes bounded corrections for the confirmed
     findings only, red-first.
  4. Round 2 reviews only the correction diff. Confirmed findings get one last
     bounded correction, by an OpenCode session the orchestrating session
     chooses.
  5. Stop. There is no third round; anything still open goes to the Owner.

  Findings, verdicts and corrections are recorded in the slice's tracker
  entry.
- **Medium review pass (Owner, 2026-10-20; first used for slice 4a):** for a
  slice that is not risky but changes behaviour beyond plain deletion. It
  replaces the loop above; it is one pass with no round 2.
  1. OpenCode Go DeepSeek v4.1 Flash (max) and MiniMax 3.1 Flash (max), the
     second started ~45 s after the first, both read-only with no shell,
     review the slice diff.
  2. The orchestrating session verifies every finding in the code and
     rejects, with a reason, any that are wrong.
  3. Codex `gpt-6.1-sol` (xhigh) makes one bounded red-first correction for
     the confirmed findings only.
  4. Then the pre-merge review (above) runs on the whole slice, after the
     tests and before documentation; its confirmed findings get its own one
     bounded fix round. Anything still open after that goes to the Owner.

  Findings, verdicts and corrections are recorded in the slice's tracker
  entry.
- **Planning the browser check:** at slice start, the orchestrating session:
  - picks the test cards and confirms their server state, read only;
  - writes Haiku's script and shows it to the Owner before code is written.

  If the scan session no longer has suitable cards, it asks the Owner for a
  new scan.
- **Owner decisions:** any change to an SDD's wording, an acceptance check,
  the planned browser check, or a shared resource such as a dev-server port
  goes to the Owner first, with a recommendation. The orchestrating session
  does not decide these itself.
- **Documentation updates (Owner, 2026-10-19; amended 2026-10-20):**
  1. The orchestrating session writes a short fact sheet: what was done,
     evidence, mutations and the next action.
  2. OpenCode Go DeepSeek v4.1 Flash (max), with no shell, drafts from that
     fact sheet only:
     - the tracker entry, in the SESSION-START log shape;
     - the ACTIVE, DOC-13, SESSION-START and TRACKER handoffs.
  3. OpenCode Go MiniMax 3.1 Flash (max), read-only, reviews that docs diff
     against the fact sheet and the evidence.
  4. The orchestrating session runs the validator and `git diff --check`,
     and reviews the diff.

  SDD wording and decisions stay with the orchestrating session.
