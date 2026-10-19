# Post-Scan Rework — SDD-5 Classification (slices 15–16)

**Status:** `pass_1_outline_approved` (2026-10-19). Owner approved the SDD set with the §14 defaults on 2026-10-19. Pass 2 is written immediately
before slice 15 starts.
**Overview and decisions:** [SDD-0](./00-overview-sdd.md)

## Context

Inventory and public listings have no category, genre or label (SDD-0 F19).
Provider genres reach the immutable snapshot and are lost at Add (F20). The
batch label is stored on the session only (F7). This area adds one public
category per book, keeps all provider genres privately, and adds private
store labels — all set before or during the scan and carried by the single
Add (slice 13).

Decisions served: PSR-D08, D16, D17, D41, D42, D43. Rules: PSR-R04 (labels
and store data stay private), R06 (compatible rollout), R09 (model output
untrusted), R11 (no Store View editing or filters — deferred).

---

## Slice 15 — Category

**Goal:** every added book has a category buyers can browse, chosen at
pre-scan or detected automatically and fixable on the card (D08, D16).

**Scope:**
- Fixed list of 10 values (D41), stored as stable codes with display names.
- Pre-scan: mandatory category choice — one of the 10 or **Auto-detect**
  (default Auto-detect, SDD-0 §14 Q7). Stored on the session.
- Card: a small category picker showing the current value; the Owner may
  change it before Add (D08). The value is part of the card's review and is
  validated by the server.
- **Auto-detect = Gemini decides (D42, amended 10-19).** With Auto-detect,
  the vision prompt asks Gemini for one category per book from the list,
  with the D42 priority order for books that fit several, in the same photo
  analysis (no extra call). The server checks it against the list; invalid
  or missing gives **Other**. A wrong or missing category can never
  invalidate an otherwise valid scan (MAS-19, R09). With a fixed pre-scan
  category, Gemini is not asked and every card gets that category.
- No catalogue or genre tier and no category counts (SDD-0 §5, PSR-D40).
- Stored: `store_inventory` category (required for new image-extraction rows)
  and all provider genres (private text array; the catalogue already has
  `canonical_editions.categories TEXT[]`, reused rather than re-added); `marketplace_book_listings`
  category, projected by the listing-sync trigger (D43). Existing inventory
  rows get Other (D43).
**Not in scope:** Store View category editing and filters (deferred, SDD-0
§11); buyer browse UI beyond the listing column.

**Depends on:** slice 13 (Add carries the value) and slice 8 (Open Library
subjects as the provider genres stored for reference, D43).
**Migration:** one. Pass 2 is expected to split this into **15a** (columns,
listing projection, pre-scan choice, card picker, Add carries it, Other as the
only automatic value) and **15b** (Gemini Auto-detect: prompt, decoder and
storing the value on the card), each with one migration, because a single slice
would touch inventory, listings, sessions, the worker prompt and the app.
**Code pointers:** `scanSetup/scanSetupForm.ts`, `components/ScanSetupForm.tsx`,
`phase9_start_session_v2` (M52), card editors (`components/CompactReviewEditors.tsx`),
`review/compactReviewDraft.ts`, review validation SQL, `sync_marketplace_listing_from_inventory`
(latest M45), vision prompt and schema (`analysis/geminiVisionSchema.ts`,
`analysis/geminiResponseDecoder.ts`), vision completion SQL (M12 and later).

**Acceptance checks:**
- AC15-1: Given pre-scan category Children's, then every card shows Children's
  and every added book has it on inventory and its listing (D16, D43).
- AC15-2: Given a fixed pre-scan category, then Gemini is not asked for a
  category (D42).
- AC15-3: Given Auto-detect, then each card shows Gemini's category when it
  is on the list; an invalid or missing value gives Other and the scan still
  succeeds (D42, R09).
- AC15-4: Given Auto-detect, then the vision prompt lists the 10 categories
  in the D42 priority order and asks for exactly one per book; given a
  response with an unknown value, then the decoder stores Other (D41, D42).
- AC15-5: Given the Owner changes the card's category before Add, then the
  inventory row has the Owner's choice (D08).
- AC15-6: Given an edition with provider genres, then all of them are stored
  privately on the inventory row and never appear on the listing (D43, R04).
- AC15-7: Given the migration, then existing inventory rows read Other (D43).
- AC15-8: Given an older app without the category field, then Add still works
  and stores Other (R06).
- AC15-10: Accessibility: the pre-scan category control and the card picker
  are labelled and announce the current value (R14).

**Tests first:** Database — columns, constraint, listing projection, review
validation, default for old rows, old-app path. Server — vision prompt carries the
list and order, Gemini category decoding (optional, invalid → Other). Jest — pre-scan control,
card picker.
**Size / risk:** L / med (split expected).

---

## Slice 16 — Labels

**Goal:** the Owner can tag a scan's books with private labels (D17).

**Scope:**
- Per-store label list: a label is a name (trimmed, case-insensitive unique
  per store, length limit); a hidden technical cap on count. No colours, no
  starter set.
- Pre-scan: pick existing labels or type new ones (the old batch label field
  becomes this); chosen labels apply to every book added from that scan.
- Add attaches the session's labels to the new inventory row.
- "Normal" means no label; nothing is stored for it.
- Labels are never projected to listings or any buyer-facing read; only the
  store's Owner can read or write them (RLS by server-derived store).
- Existing `batch_label` stays on old sessions; new sessions use labels.
**Not in scope:** Store View label editing, filters and bulk edit (deferred);
labels per card.

**Depends on:** slice 13 (and 15 by order).
**Migration:** one (label table, inventory-label link table, session label
link or array, RLS, Add update).
**Code pointers:** `scanSetup/scanSetupForm.ts` (`normalizeBatchLabel`),
`components/ScanSetupForm.tsx`, `phase9_start_session_v2`, single Add (slice
13), Store View reads (to confirm labels never leak).

**Acceptance checks:**
- AC16-1: Given labels "Donation" and "Clearance" at pre-scan, then every book
  added from that scan carries both (D17).
- AC16-2: Given a typed label that already exists with different case, then
  the existing label is reused (D17).
- AC16-3: Given any buyer-facing read (listing, search, store page), then no
  label is visible (D17, R04).
- AC16-4: Given another store's Owner, then they cannot read or attach this
  store's labels (R04).
- AC16-5: Given no labels chosen, then the book has none and counts as Normal
  (D17).
- AC16-6: Accessibility: the label picker and typed-label entry are labelled
  and selected labels are announced (R14).

**Tests first:** Database — label uniqueness, RLS across stores, Add attaches
labels, listing projection excludes labels. Jest — pre-scan label picker.
**Size / risk:** M / low–med.

---

## Traceability (pass 1)

| Decision | Slice | Acceptance checks |
|---|---|---|
| PSR-D08 | 15 | AC15-5 |
| PSR-D16 | 15 | AC15-1 |
| PSR-D17 | 16 | AC16-1 to AC16-5 |
| PSR-D41 | 15 | AC15-1, AC15-4 |
| PSR-D42 | 15 | AC15-2 to AC15-4 |
| PSR-D43 | 15 | AC15-1, AC15-6, AC15-7 |
