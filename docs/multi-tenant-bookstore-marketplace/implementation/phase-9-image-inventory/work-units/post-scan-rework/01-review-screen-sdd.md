# Post-Scan Rework — SDD-1 Review Screen (slices 1–5)

**Status:** `pass_2_approved` (2026-10-19). The Owner approved pass 2 and the slice 5 `owner_isbn13` direction on 2026-10-19.
- The Owner approved pass 1, together with the SDD set, on 2026-10-19.
- Pass 2 adds build detail for slices 1–4, from a fresh read-only code map.
  Two independent read-only reviews were run and their findings applied
  (§10; tracker 38 §14).
- Slice 5 is still a design direction. It is designed again, with its
  migrations, when 5a starts (§7).
- Approving this document does not authorize code. Each slice still needs the
  Owner's go-ahead. Slice 5 also needs separate approvals to create its
  migrations, to apply them and to deploy.

**Overview and decisions:** [SDD-0](./00-overview-sdd.md)

**Slice 5 direction confirmed by the Owner (2026-10-19).** Slice 5 departs
from the SDD-0 §14 Q2 default (an ISBN on a single request) and stores the
typed ISBN on the card (§7, "Why not request-scoped"). Slice 5 still gets its
own full design pass at 5a start.

## Contents

1. Context and code baseline
2. Cross-slice design rules for this area
3. Slice 1 — Add re-saves a reset review
4. Slice 2 — Declutter the card and the edition sheet; card requirements
5. Slice 3 — Remove after-Add buttons and the Inventory tab's list
6. Slice 4 — Remove full correction; simplify "Add a book"
7. Slice 5 — Typed ISBN (design direction; 5a sheet, 5b "Add a book")
8. Rollout and compatibility
9. Traceability
10. Pass-2 evidence and reviews

Decisions served: PSR-D02, D03 (interim), D04, D05, D06, D07, D09, D10, D11,
D12, D13 and D47. The rules that matter most here are:
- PSR-R06: older apps keep working.
- PSR-R07: validation is never weakened.
- PSR-R08: card statuses are display labels.
- PSR-R10: manual paths keep working.
- PSR-R14: accessibility.

---

## 1. Context and code baseline

The post-scan review screen (`screens/CaptureProgressScreens.tsx`,
`SessionProgress`) lists one `BatchReviewCard` per scanned book.
- **Paths** are under `src/features/imageInventory/` unless they start with
  `app/`, `supabase/`, `workers/` or `e2e/`. `shared/` means
  `supabase/functions/_shared/imageInventory/`.
- **"Mnn"** is the migration with sequence number `0000nn`.
- **Line numbers** are from the worktree at `8863885` (code map of
  2026-10-19, §10). They are checked again when each slice starts.

How Add works today:
- **Who calls what.** Add is `CoordinatedAddCandidateAction`
  (`components/AddCandidateToInventoryAction.tsx` L42–93), which calls the
  coordinator (`commit/inventoryCommitCoordinator.ts`).
- **When it saves.** The coordinator saves the review only when `needsSave` is
  true (`commit/inventoryCommitPolicy.ts` L25–40). It then always rereads the
  candidate (coordinator L285–299).
- **Eligibility.** The reread must pass two checks:
  - `canonicalEligible` (policy L70–76);
  - `canonicalMatchesControlledChoice` (policy L134–147), which compares
    the **frozen draft** with the saved review.

  Only then does it add, with the versions from that reread (L300–313).
- **Unchanged drafts.** When the draft equals `card.review`, there is no save,
  and `candidateCanStartCommit` (L42–50) needs `card.reviewReady` and
  `add_to_inventory`.

Two server facts shape slice 1:
- **A reset that already happened.** The identity trigger can reset a saved
  review: `review_ready=false`, with the choice set to manual (M69 L325–336).
  A card in that state cannot be added. `reviewStatusLabel`
  (`components/batchReviewStatus.ts` L25–42) then falls through to **"Review
  book"** (SDD-0 F3, F25).
- **A reset caused by Add's own save.** The edition query identity includes
  the confirmed review title and authors (M65 L137–145). So a save that
  changes the title or authors changes the identity, and the same trigger
  resets readiness during that save's own UPDATE (M69 L325–336). Today
  "edit the title, then Add" therefore ends as "no longer eligible" after
  the save.

Other parts of today's screen:
- **Edition sheet.**
  - "Find or change edition" (`BatchReviewCard.tsx` L325–326) and "View
    metadata" (L327–330) both open `CandidateMetadataSheet`.
  - The sheet has "Detected details", "Use detected details" and "Edit
    manually" (`CandidateMetadataSheet.tsx` L96–105).
  - The picker inside it mounts a second title and author form,
    `EditionIdentityFix` (`CandidateEditionPicker.tsx` L102–104).
- **Inline edits keep the chosen edition.**
  - An inline title or author edit sends only that field
    (`InlineBatchReviewFields.tsx` L75, L90), and the draft keeps its
    `metadataChoice` (`review/compactReviewDraft.ts` L165–170).
  - The server accepts an `edition_option` choice only when the review's
    title, authors, language and script equal the chosen edition's
    (`phase9_edition_saved_choice_valid`, M69 L11–38, branch L18–26).
- **Full correction.** "Open full correction" (`BatchReviewCard.tsx`
  L331–335) routes to the candidate screen.
- **No leave guard.** The batch screen has none, and card edits live only in
  React state (`CaptureProgressScreens.tsx` L71–75; `BatchReviewCard.tsx`
  L65).
- **Inventory tab.** It renders `OwnerInventoryReadScreen`. The scan card
  (`components/inventory-hub-recovery-card.tsx`) sits in the screen's header
  slot.

Server functions do not change in slices 1–4.

## 2. Cross-slice design rules for this area

- **D2-1, one readiness rule.** Two functions, and the helpers they call,
  decide the badge, the header's Ready count, Add and "Add all ready books"
  (SDD-0 F4):
  - `cardReadyNow` (`components/batchReviewStatus.ts` L17–23);
  - `candidateCanStartCommit`.

  No screen decides readiness itself.
- **D2-2, every hidden request is frozen in full.** A hidden step is the
  slice 1 re-save or the slice 4 stale-wording rejection.
  - The first time the coordinator builds the request, it freezes the whole
    request: payload, expected versions, idempotency key and command ID.
  - A retry replays exactly that request. It never rebuilds the request from
    a newer read.
  - This matters because the save fingerprint includes the expected versions
    and the review (M62 L89–94). A rebuilt request under the old key would be
    refused, or would be treated as a new command.
- **D2-3, the Owner confirms what they saw.** A hidden save may differ from
  the card the Owner saw only in the changes this SDD names:
  - the edition choice turned to manual (slice 1);
  - the script recomputed (slice 4).

  Any other difference stops Add. The card is then refreshed with "This book
  changed. Check it and press Add again."
- **D2-4, no new persisted states.** Card statuses stay display labels
  (PSR-R08).
- **D2-5, removed code is deleted, not hidden.**
  - When a control is removed, its component, route, registrations, query
    hook and tests are deleted in the same slice.
  - Server functions stay for older apps (PSR-R06).
  - Each slice that deletes files also updates `CODEBASE_MAP/` and the file
    lists in `scripts/validate-phase9-continuity.ps1` (for example L1057–1065
    for the inventory read files).
- **D2-6, accessibility.** Every new or changed control has an accessibility
  label. Status changes are announced with
  `accessibilityLiveRegion="polite"`, as the card already does (PSR-R14).

---

## 3. Slice 1 — Add re-saves a reset review

**Goal:** pressing Add once adds a card whose saved review the server reset,
whether the reset happened before Add or was caused by Add's own save
(PSR-D02; D03 as an interim fix).

| | |
|---|---|
| **Decisions** | D02, D03 (interim), D04 |
| **Migration** | None |
| **Size / risk** | M / med. Pass 1 said S / low; the reset caused by Add's own save and the frozen-request replay make it larger. |
| **Not in scope** | The server triggers (slice 13 fixes them at the source); the single Add action; any label other than the replacement for "Review book" |

### Design

1. **Admission** (`commit/inventoryCommitPolicy.ts`).
   - `candidateCommitPreparation` gains a result, `resave: 'review_reset'`.
     It is set when all of the following hold:
     - the card has a saved review;
     - the draft equals that review;
     - `card.reviewReady` is false;
     - `card.blockers` is empty.

     `card.blockers` is the server's own blocker list
     (`contracts/ownerBatchReviewContracts.ts` L110). A stale list is safe,
     because the save re-validates it (M62 L125–126).
   - For such a card, `candidateCanStartCommit` needs `save_review` instead of
     `reviewReady` and `add_to_inventory`.
   - The bulk check calls the same function (`candidateCanStartBulkCommit`,
     L57–68), so "Add all ready books" includes the card.
2. **A reset that already happened.** For `resave: 'review_reset'`,
   `executeClaimed` (L268–333) works in this order:
   1. It calls `readCandidate`.
   2. It compares `detail.review.value` with the card's `card.review`, the
      review the Owner saw.
   3. If the two differ in anything other than `metadataChoice` turning from
      an edition to `{mode:'manual', selectionId:null}`, it stops (D2-3).
   4. Otherwise it **replaces `command.draft` with `detail.review.value`**,
      then freezes and sends the save request (D2-2).

   Replacing the draft matters. `canonicalMatchesControlledChoice` compares
   the frozen draft with the saved review (policy L134–147). If the draft
   kept the old edition choice, the reset card would fail that check after
   the save.
3. **A reset caused by Add's own save.** After any save, the coordinator
   rereads the candidate. One more save is needed when all of these hold:
   - `reviewReady` is false;
   - there are no blockers;
   - `metadataRevision` went up;
   - the reread review equals the review just saved, except that the choice
     is now manual.

   In that case the coordinator:
   1. replaces `command.draft` with the reread review;
   2. sends one more frozen save, with its own idempotency key and command ID,
      both minted when the command is frozen;
   3. rereads again and adds.

   With an unchanged identity, the second save cannot reset readiness again.
4. **At most one re-save per command, whichever case applies.**
   - If the reread after the re-save still shows `reviewReady=false`, the
     attempt ends as `no_longer_eligible` (L290), and the card is
     synchronized.
   - A save with blockers raises `P9_STATE_CONFLICT` (M62 L125–126), which
     `classifyFailure` maps to `no_longer_eligible` (policy L97–113).
5. **Replay.**
   - An unclear save, such as a lost response, is retried by replaying the
     frozen request (D2-2). Its stage is `save`, so `classifyFailure` marks it
     retryable, not an unclear commit.
   - An unclear Add still replays only the commit request (L138–177).
   - `draftMatchesCommand` (L81–95) compares the refreshed draft with
     `command.draft`. After step 2 or 3 that is the server's review, so a
     retry after a successful re-save matches. It does not create a second
     command.
6. **Label.** The fall-through "Review book" in `reviewStatusLabel` (L41)
   becomes **"Needs details"**. After this slice, only cards the server will
   not let the Owner save reach that label.

### Acceptance checks and tests (write each test first and see it fail)

| Check | Test (file → name) |
|---|---|
| AC1-1: Given a card with a saved review, `review_ready=false`, no edits and no blockers, when Add is pressed, then the app rereads the card, saves the server's review, adds the book, and the card shows Added (D02, D03). | `__tests__/inventoryCommitCoordinator.test.ts` → "re-saves the server's stored review for a reset card, then adds" |
| AC1-2: Given the same card, then its label is Ready, Add is enabled, and "Add all ready books" counts it (D04). | `__tests__/postScanUiCorrections.test.tsx` → rewrite the L547 test as "shows Ready for a reset saved review that Add will re-save"; `inventoryCommitCoordinator.test.ts` → update `savedNoop` at L133–134 (it now needs `save_review`); `__tests__/BatchInventoryCommitControls.test.tsx` → "includes a reset saved review in Add all" |
| AC1-3: Given a card with real blockers, then Add stays disabled, no re-save is forced, and the card keeps today's Needs attention label with the blocker text (R07). *Corrected 2026-10-19 at slice 1 start: blockers become attention items (`BatchReviewCard.tsx` L208–216), so `reviewStatusLabel` returns Needs attention (L38) before the fall-through; this slice changes no label but "Review book" (tracker 38 §17).* | `inventoryCommitCoordinator.test.ts` → "does not force a re-save when blockers exist" |
| AC1-4: Given the re-save fails with a version conflict, then the card shows the existing "no longer eligible" message, no commit request is sent, and no inventory row is created (R01). | `inventoryCommitCoordinator.test.ts` → "stops before commit when the forced re-save conflicts" |
| AC1-5: Given the card's cached review names an edition that the server has since reset to manual, when Add is pressed, then the saved review is the server's, with a manual choice, and the eligibility check passes with that review (F3, R07). | `inventoryCommitCoordinator.test.ts` → "forced re-save uses the reread review and passes the controlled-choice check" |
| AC1-6: Given the reread after a re-save still shows `reviewReady=false`, then the attempt ends as `no_longer_eligible` after exactly one re-save. | `inventoryCommitCoordinator.test.ts` → "forces at most one re-save per command" |
| AC1-7: Given an Owner edit of the title, when Add is pressed and the save itself resets readiness, then one more save runs, and the book is added with a single press (D02). | `inventoryCommitCoordinator.test.ts` → "re-saves once when the command's own save reset readiness" (the fake server returns `review_ready=false`, a manual choice and a bumped revision) |
| AC1-8: Given a re-save whose response is lost, when Add is retried, then the identical frozen request is replayed (same key, versions and review), and the book is added once (D2-2). | `inventoryCommitCoordinator.test.ts` → "replays the frozen re-save request after a lost response"; keep the exact-save replay regression at L415–425 |
| AC1-9: Given the server's review differs from the card in a field other than the edition choice (for example, the price was changed on another device), then Add stops, and the card refreshes with "This book changed. Check it and press Add again." (D2-3). | `inventoryCommitCoordinator.test.ts` → "stops when the reread review differs from what the Owner saw" |

**Done means:**
- the tests above pass;
- the full image-inventory Jest folder and `tsc` pass;
- the old "Review book" assertion is rewritten, not deleted;
- one in-app check on the dev build: edit a card's title, press Add once, and
  the book is added.
  *Note (slice 1, 2026-10-19):* this holds for a card with manual details.
  On a card that keeps a chosen edition (`edition_option`), the first save is
  refused before any write (blocker `metadata_choice_missing`, then
  `P9_STATE_CONFLICT`), because §1's identity rule applies. Slice 2 AC2-10
  closes that case (tracker 38 §17).

---

## 4. Slice 2 — Declutter the card and the edition sheet; card requirements

**Goal:** a card has one edition button, an edition line, and required
price, condition, quantity and author. Leaving the screen with unsaved edits
asks first (PSR-D05, D07, D09, D10, D47).

| | |
|---|---|
| **Migration** | None |
| **Size / risk** | M / low–med. Full correction still mounts the sheet until slice 4. |
| **Depends on** | Slice 1, which handles the reset caused by Add's own save |
| **Not in scope** | Typed ISBN (slice 5); the category picker (slice 15); server changes |

### Card (`components/BatchReviewCard.tsx` and its helpers)

**Removed:**
- the "View metadata" button (L327–330);
- the title and author source chips (`SourceBadge`,
  `InlineBatchReviewFields.tsx` L236–237; `BatchReviewFieldSummary.tsx`
  L4–35);
- the metadata status text (L256–259).

**Kept:**
- the cover, "BOOK N", and the title and authors with their inline editors;
- the status pill and "Edited · saved when added";
- the price, condition and quantity fields, and the additional-details
  toggle;
- the attention box;
- Add, **Find or change edition** and Remove.

**Edition line (D07).** A new component, `EditionLine`, sits under the title.
It reads `choices.selection.snapshot`, which `EditionChoicesReader` already
loads (`ownerUxCandidateSchemas.ts` L63–82).

| Card state | Edition line shows |
|---|---|
| An edition is chosen | "publisher · year · ISBN-13", leaving out missing parts. The year is the first stand-alone four-digit number in `publishedDate` ("April 1, 1999" gives 1999), and is left out when there is none (Owner, 2026-10-19, at slice 2 planning; live data showed dates like "April 1, 1999"). ISBN-10 is used when there is no ISBN-13. |
| An edition is chosen but none of those parts exist | "Edition chosen" |
| The lookup is pending | "Finding edition…" |
| No edition is chosen | "No edition chosen" |
| The draft's identity differs from the chosen edition | "No edition chosen — title or author changed" |

**An identity edit clears the chosen edition (D07, R07).**
- In `validateCompactReview`, the draft's `metadataChoice` becomes `{ mode:
  'manual', selectionId: null }` whenever the draft's title, authors,
  language or effective script differs from the chosen edition's snapshot.
- These are the four fields the server compares (M69 L22–26).
- When the save then resets readiness, slice 1's second save handles it
  (AC1-7).

**The edition choice defaults to manual.** Today a card with no chosen
edition has no `metadataChoice` until the Owner presses "Edit manually"
(`compactReviewDraft.ts` L165–170).
- After this slice, the choice defaults to manual when no edition is chosen
  and the lookup is not pending. The server accepts `manual` (M55 L106).
- While the lookup is pending, the only attention item is "Finding the
  edition…". `issueMessage` (L144) uses this text for the pending state, so
  only one message appears.
- Otherwise, the `metadataChoice` message becomes "Choose an edition or keep
  the card's details."

**Card requirements (D47).** One helper, `cardAddRequirementIssues(review)`
in `review/compactReviewDraft.ts`, returns these issues:

| Problem | Message |
|---|---|
| No price | "Set a whole-rupee selling price." |
| A ₹0 price | "Enter a price above ₹0." |
| No condition | "Choose a condition." |
| A quantity below 1 | "Set a quantity from 1 to 10,000." |
| No author | "Add an author." |

- The author check is not new. The server already refuses to commit a
  review without authors (M55 L139–141), and the app now shows that on the
  card.
- `validateCompactReview` and `candidateCommitPreparation` both use the
  helper, so the badge, Add, Add all and the header count agree (D2-1).
- Today a ₹0 price is allowed when publication is private
  (`ownerUxReviewSchema.ts` L46, L101–102). The server keeps that rule until
  slice 13 (SDD-4 AC13-9). This slice only narrows what the app sends (R07).
- The pre-scan form still accepts a blank or ₹0 default.

### Edition sheet

**`CandidateMetadataSheet.tsx`:**
- remove the "Detected details" block, "Use detected details" and "Edit
  manually" (L96–105);
- rename the heading to "Find or change edition".

**`CandidateEditionPicker.tsx`:**
- remove the `identityFix` mount (L102–104);
- change the no-match text to "No result matches this book's title and
  author. Fix them on the card, then search again.";
- "Edit title/author" (L98–101) goes in slice 4.

Delete `EditionIdentityFix.tsx` and `ownerEditionIdentityFix.test.tsx`.

**Old results hide when the identity changes (D07).**
- Today the picker shows Search Books only when the options are not fresh
  (L87–91), and it lists fresh options (L95–96).
- When the card's draft identity differs from the saved identity, the
  picker hides the old options and the old selection, and shows Search
  Books, even while those options are still fresh.

**Search uses the card's title and author (D05, D10).**

| Card state | What Search Books does |
|---|---|
| Unsaved title, author or language edits, and the card is complete | Runs the existing `saveIdentityAndSearch` (`queries/ownerEditionPickerQueries.ts` L121–153) with the card's compact review |
| Unsaved edits, but the card is incomplete | Shows "Complete the card's details to search with the new title" and offers "Search with saved title" |
| No edits | Runs today's `lookupMutation` |

- The save-then-search already claims the card's command slot
  (`'identity-search'` through `useOwnerCardCommand.ts` L40–42), so it cannot
  run alongside an Add.
- Its save request is frozen once, following D2-2, instead of using a new
  key on every submit (L126).

### Header and leave guard

**`components/post-scan-review-summary.tsx`:**
- remove the explanation paragraph (L107–109), the footnote (L120–122) and
  the "One image · Up to 15 books" chip;
- keep the stage pill, the five counts and the batch-label chip (that chip
  goes in slice 16).

**Leave guard (D09).**
- Generalize `review/useCandidateLeaveGuard.ts` into
  `useUnsavedEditsLeaveGuard(dirty, busy, copy)`.
- `SessionProgress` passes:
  - `dirty`: some card has local edits;
  - `busy`: some Add is in flight.
- The dialog reads "Leave without saving?" / "Your card edits are not saved
  and will be discarded.", with the buttons "Stay" and "Leave and discard".

### Acceptance checks and tests (write each test first and see it fail)

| Check | Test |
|---|---|
| AC2-1: Given any card, then it has exactly one edition button, "Find or change edition", which opens the sheet (D05). | `__tests__/batchReviewCard.test.tsx` → "shows one edition button and no View metadata" (rewrites the cases at L602–640; the selected-snapshot cases at L642–670 stay) |
| AC2-2: Given the sheet, then it has no detected-details block, no "Use detected details", no "Edit manually" and no second title/author form (D05). | `__tests__/ownerEditionPickerSheetStates.test.tsx` → "sheet offers only edition search and choices"; delete `ownerEditionIdentityFix.test.tsx` |
| AC2-3: Given the title was changed and the card is complete, when Search Books is pressed, then the review is saved with the new title and the search uses it (D05, D10). | `__tests__/ownerEditionPickerMounted.test.tsx` → "Search Books saves the card's new title, then searches" |
| AC2-3b: Given the title was changed but the card is incomplete, then the sheet explains why, and offers "Search with saved title". | same file → "incomplete card searches only with the saved title" |
| AC2-4: Given a chosen edition, then the card shows "publisher · year · ISBN-13". Given the title is then changed, then the card shows "No edition chosen — title or author changed", and the sheet hides the old results (D07). | `batchReviewCard.test.tsx` → "edition line shows the chosen edition and clears on a title change"; `ownerEditionPickerSheetStates.test.tsx` → "hides fresh old results after an identity edit" |
| AC2-5: Given unsaved card edits, when the Owner leaves, then "Leave without saving?" appears. "Leave and discard" leaves; "Stay" stays (D09). | `__tests__/CaptureProgressScreens.test.tsx` → "guards unsaved card edits on leave" |
| AC2-6: Accessibility. Screen readers can read the edition line, the status pill and the new sheet text, and every new control has a label (R14). | `batchReviewCard.test.tsx` → "edition line is announced"; `ownerEditionPickerSheetStates.test.tsx` → "search controls are labelled" |
| AC2-7: Given a pre-scan default price of ₹0, then every card shows Needs attention with "Enter a price above ₹0.", and Add is not offered. *(Corrected 2026-10-19 by the Owner at slice 2 start: requirement issues are attention items, and `reviewStatusLabel` L38 shows Needs attention, as in AC1-3; Needs details stays the fall-through label.)* The same holds for a missing condition, a quantity below 1 or no author (D47). | `__tests__/compactReviewDraft.test.ts` → "requires price above zero, condition, quantity and an author for Add"; `postScanUiCorrections.test.tsx` → "zero price card is not Ready"; update `unit6gMountedRouteComposition.test.tsx` L800–803 |
| AC2-8: Given no chosen edition after the lookup ends, then the choice is manual and the card can be Ready. While the lookup is pending, the card is not Ready and shows only "Finding the edition…" (D07). | `compactReviewDraft.test.ts` → "defaults to manual details only after the lookup ends" |
| AC2-9: Given the summary header, then the explanation, the footnote and the "One image" chip are gone, and the five counts remain (D09). | `__tests__/post-scan-review-summary.test.tsx` → "header shows stage and counts only" |
| AC2-10: Given a chosen edition, when the Owner changes the title, the authors, the language or the effective script, then the draft's choice is manual. The server never receives an `edition_option` choice whose identity differs from the edition's (D07, R07). | `compactReviewDraft.test.ts` → "an identity edit, including script, turns the edition choice to manual" |

**Fixture order.** Slice 1 rewrites `postScanUiCorrections.test.tsx` L547.
Slice 2 then sets that fixture's price above ₹0, so each slice's test fails
for its own reason.

**Done means:**
- the tests above pass;
- `tsc` and the image-inventory Jest folder pass;
- an in-app check on the dev build (web) covers the edition line, the
  title-edit rule and the leave guard.

---

## 5. Slice 3 — Remove after-Add buttons and the Inventory tab's list

**Goal:** an added book lives only in Store View (PSR-D12).

| | |
|---|---|
| **Decisions** | D04, D12 |
| **Migration** | None |
| **Size / risk** | S / low |

### Design

**After Add.**
- A successful `CoordinatedAddCandidateAction` (L57–66) shows only "Added to
  Inventory" (testID `add-to-inventory-success-<id>`).
- Remove "View in Store View".

**Inventory tab.** `InventoryHubFoundationScreen`
(`screens/InventoryFoundationScreens.tsx` L95–102) renders the scan card on
its own.
- The card keeps "Start scan" / "Resume scan".
- It drops "Review books (N)" (`inventory-hub-recovery-card.tsx` L38–45).
- It adds the line "Added books are in Store View", with a link
  (`storeViewRoutes.root()`).

**Delete:**
- `screens/OwnerInventoryReadScreen.tsx`;
- `components/InventoryRecoveryCard.tsx`;
- `components/OwnerInventoryPresentation.tsx`;
- `useOwnerInventoryRead` and `accumulateOwnerInventoryPages`;
- the parts of `api/ownerInventoryReadService.ts` that nothing calls any
  more. `tsc` and lint prove this.

**Keep:**
- `ownerInventoryReadKeys`, which `publicationQueries.ts` L35 and
  `storeViewManagementQueries.ts` L47 use;
- `OWNER_INVENTORY_CONTRACT_VERSION`, which `ownerInventoryCommitQueries.ts`
  L62 uses;
- the server RPC `phase9_owner_inventory_page_v2`, for older apps.

### Acceptance checks and tests (write each test first and see it fail)

| Check | Test |
|---|---|
| AC3-1: Given a card is added, then it shows "Added to Inventory" and no navigation button (D04, D12). | `__tests__/batchReviewCard.test.tsx` → "added card shows Added to Inventory without Store View navigation"; update the coordinated cases in `AddCandidateToInventoryAction.test.tsx` |
| AC3-2: Given the Inventory tab, then it shows the scan card and the Store View line, and no list, search or load more (D12). | `app/(store-owner)/__tests__/inventory.test.tsx` → rewrite "renders the guarded nested Inventory hub"; new `__tests__/inventoryHubCard.test.tsx` → "hub shows scan entry and Store View line only" |
| AC3-3: Given an open session, then the tab offers Resume scan; otherwise it offers Start scan (R10). | `inventoryHubCard.test.tsx` → "offers Resume for an open session and Start otherwise" |
| AC3-4: Given Store View, then every added book is still listed (D12). | existing Store View suites pass unchanged |

**Tests to delete or rewrite:**
- Delete:
  - `OwnerInventoryReadScreen.test.tsx`;
  - `OwnerInventoryPublication.test.tsx`, which imports the deleted list
    (L2–3, L10). Its publication coverage is kept by the Store View suites.
- Rewrite to cover only what remains:
  - `ownerInventoryReadQueries.test.tsx`: keys only;
  - `ownerInventoryReadService.test.ts`;
  - `ownerInventoryReadArchitecture.test.ts`.
- `e2e/store-owner-wu5-cutover.spec.ts`:
  - in test 1, remove only the inventory-list assertions (L143–146), and keep
    the tab-bar loop (L138–140) and the Store View assertions (L148–149);
  - delete test 2 (L152–164), which presses `view-in-store-view`. Add is
    covered by the batch-card tests.

**Done means:**
- the tests above pass;
- `tsc`, lint and the image-inventory Jest folder pass;
- `CODEBASE_MAP/` and the validator's file list are updated (D2-5).

---

## 6. Slice 4 — Remove full correction; simplify "Add a book"

**Goal:** the card is the only place to review a book, and a book Gemini
missed can still be added (PSR-D11, D13).

| | |
|---|---|
| **Migration** | None. Existing functions clear the stale-wording blocker. |
| **Size / risk** | M / med |
| **Not in scope** | Remove all (slice 10); closing by the server (slice 11) |

### Routes and screens removed

**Routes:**
- `app/(store-owner)/inventory/scan/[sessionId]/candidate/[candidateId].tsx`,
  with its registration in `scan/[sessionId]/_layout.tsx` L7;
- `app/(store-owner)/inventory/reviews.tsx`, with its registration in
  `app/(store-owner)/inventory/_layout.tsx`;
- the `candidate()` and `reviews()` helpers in
  `navigation/inventoryRoutes.ts`.

**Screens and components:**
- `screens/CandidateReviewRouteScreen.tsx`;
- `screens/CandidateReviewScreens.tsx`;
- `screens/CandidateListScreen.tsx`;
- `InventoryCandidateFoundationScreen`;
- `components/CandidateCorrectionActions.tsx`;
- `components/VariantDecisionSheet.tsx`;
- `components/ReviewFormFields.tsx`;
- `components/ReviewInventoryFields.tsx`;
- `CandidateEvidencePanels`;
- `CandidateReviewEditionSheet.tsx`;
- `CandidateConflictPanels`;
- `CandidateReviewState`.

**Also removed:**
- the legacy Add variant (`AddCandidateToInventoryAction.tsx` L95–233);
- the picker's `onEditIdentity`;
- the unused functions in `InventoryFoundationScreens.tsx` (L104–113,
  L119–131, L137–152, L166–183);
- `components/CompactReviewEditors.tsx`;
- the Mark false client (`ownerCorrectionService.ts` L151–164) and its query
  hook.

The server functions stay (R06).

**Card.**
- Remove "Open full correction" (L331–335).
- The hint shown when a card can't be edited (L305–307) becomes "This book
  can't be changed now."

**Every link into a removed screen changes:**

| Link | Change |
|---|---|
| `CandidateListScreen.tsx` L84–87 | Deleted with the screen |
| `CaptureProgressScreens.tsx` L285–288 | Deleted with the button |
| `ReadinessSummaryScreen.tsx` L259–267 and L277 | "Review next blocker" becomes "Back to review", which goes to the session screen |
| `MissedBookScreen.tsx` L138 | See "Add a book" below |
| `AddCandidateToInventoryAction.tsx` L163, `inventoryRoutes.reviews()` | Deleted with the legacy variant |

### Readiness summary stays until slice 11

The summary route is the only place to close a session by hand
(`ReadinessSummaryScreen.tsx` L292–303). The app's automatic close needs zero
removed cards (`close/sessionAutoClosePolicy.ts` L33–38).
- So the summary stays, minus "Review next blocker".
- Removing it now would leave sessions with a removed card open. Each Owner
  can have only one open session, so that would block their next scan.

### Stale search wording (Q9, the approved default): no migration

`variant_source_stale` blocks Add while a search-variant proposal is `stale`
(M55 L119–121). A save that changes the title or authors can itself make
`proposed` or `active` proposals stale: the candidate trigger
`phase9_candidate_variant_refresh` (M24) does this.

**Admission.**
- `batchReviewStatus.ts` adds `addResolvableBlockerCodes =
  ['variant_source_stale']`.
- If every blocker on a card is in that set, `cardAttentionItems` hides those
  blockers, and `cardReadyNow` and `candidateCanStartCommit` treat the card as
  Ready, provided `save_review` is allowed.

**Sequence at Add** (each request frozen following D2-2):
1. Read the proposals through `resolveExpectedVariants`
   (`ownerCorrectionService.ts` L166–203).
2. Reject each `stale` one with `phase9_owner_decide_search_variant(store,
   proposal, expected_version, 'reject', 'card_wording_confirmed', null,
   key)`. The function accepts `stale` rows (M24 decisions, L204–293; guard
   at L274).
3. Save the review (slice 1 rules).
4. Reread. If the save made more proposals stale, reject those once (steps 1
   and 2 again), then reread.
5. Add, if the card is eligible. Otherwise stop with the existing "no longer
   eligible" message.

**Limits.**
- There are at most two rounds of rejection per command.
- A failed rejection stops the command before any save or Add that depends
  on it.

**Safety.**
- Server validation does not change (R07): the blocker stays, and Add
  clears its cause through a decision the Owner is authorized to make.
- Each rejection writes the existing decision row.
- Rejection only marks a proposal `rejected`. It does not touch
  `phase9_owner_replace_search_variant`.

### Notes and script

**Notes** are no longer edited during a scan. They start empty, and the Owner
edits them in Store View (D11).

**Script is no longer an Owner field, and it is recomputed (SDD-0 F41).**
- A null script is **not** used. Both validators skip the script check for a
  null script (`ownerUxReviewSchema.ts` L105–111; M29 L789), so a null
  script would switch off the title/language check (R07).
- Instead, when the card's title or language changes, `validateCompactReview`
  recomputes the script with the app's copy of the server rule
  (`isLanguageScriptCoherent`, `contracts/ownerUxValidation.ts` L93):
  1. It tries the language's expected script, then `Latn`, then the observed
     script, and picks the first that is coherent with the title.
  2. If none is coherent, it keeps the current script. The card then shows
     "Choose a valid language." and is not Ready.
- This recompute is the second named exception in D2-3.
- The Add commit does not read the script (M39; M69 L99–234).

### "Add a book" (was "Add missed book")

**Entry** (`PostScanInventoryActions.tsx` L19–21).
- The label becomes "Add a book".
- At 15 visible cards the button is disabled, with "This scan already has 15
  books — scan the rest separately." (Q1).
- The form maps the server's `P9_LIMIT_EXCEEDED` to the same text, because
  the server's count includes removed cards (M5 L143–144;
  `ownerCorrectionService.ts` L38).

**Form** (`MissedBookScreen.tsx`, `missedBookForm.ts`):
- title (required) and authors (optional);
- language, defaulting to the pre-scan hint (today `'en'`, L21);
- an "Add book" button;
- the existing leave guard and fingerprint stay.

**After success:**
- `router.replace` to the session screen, instead of `router.push` to the
  candidate route (L138);
- the batch query is invalidated, so the new card shows up.

### Acceptance checks and tests (write each test first and see it fail)

| Check | Test |
|---|---|
| AC4-1: Given any card or screen, then no route or button leads to full correction, the review queue, Mark false or search-wording review (D11). | `__tests__/inventoryRouteRegistration.test.ts` → rewrite as "registers no candidate or reviews route" (it asserts today that both exist); `inventoryNavigation.test.ts` → "has no candidate or reviews helper"; `unit6fArchitecture.test.ts` → "no source references removed routes" |
| AC4-2: Given fewer than 15 cards, when the Owner adds a book by title and author, then the app returns to the review list, and a normal card appears that can be added (D13, R10). | `__tests__/OwnerCorrectionScreens.test.tsx` → rewrite the L156 test as "adds a book and returns to the review list" |
| AC4-3: Given 15 visible cards, or a `P9_LIMIT_EXCEEDED` answer, then "Add a book" shows the scan-full text (Q1). | `CaptureProgressScreens.test.tsx` → "explains the 15-book limit"; `OwnerCorrectionScreens.test.tsx` → "maps the limit error to the scan-full text" |
| AC4-4: Given a card blocked only by `variant_source_stale`, when Add is pressed, then each stale proposal is rejected, the review is saved, and the book is added. If a rejection fails, nothing is saved or added (D11, R07). | `inventoryCommitCoordinator.test.ts` → "rejects stale search wording before saving" and "stops when a stale rejection fails"; SQL `phase9VariantOwnerDecisions.integration.test.mjs` → "owner reject clears variant_source_stale" (a regression test for the existing function) |
| AC4-4b: Given an identity edit on a card with an active variant, when Add is pressed, then the variant the save made stale is rejected in the second round, and the book is added. | `inventoryCommitCoordinator.test.ts` → "rejects variants made stale by the Add save"; SQL `phase9VariantLifecyclePolicy.integration.test.mjs` → "identity save stales active variant" (a regression test) |
| AC4-5: Given a book added from a card, then its notes are empty, and they can be edited in Store View (D11). | existing Store View notes tests; `compactReviewDraft.test.ts` → "compact review sends empty notes" |
| AC4-6: Accessibility. "Add a book", its limit text and its fields have labels and are announced (R14). | `OwnerCorrectionScreens.test.tsx` → "add-a-book controls are labelled" |
| AC4-7: Given a card observed as Latin script, when the title is changed to Devanagari with language Hindi, then the script becomes `Deva`, and the card is added. Given a title that fits neither script, then the card shows "Choose a valid language." The server still rejects an explicit script that does not fit the title (F41, R07). | `compactReviewDraft.test.ts` → "recomputes script from title and language"; SQL `phase9OwnerUxContracts.integration.test.mjs` → "mismatched explicit script rejected" (a regression test) |
| AC4-8: Given the readiness summary, then Close still works, and "Back to review" replaces "Review next blocker". | `ReadinessSummaryScreen.test.tsx` → rewrite the L196 case |

**Tests to delete or change:**
- Delete:
  - `CandidateReviewScreens.test.tsx`;
  - `VariantDecisionSheet.test.tsx`;
  - `ownerEditionPickerFullReview.test.tsx`.
- Remove these cases:
  - the Mark false cases in `OwnerCorrectionScreens.test.tsx` (L109–154);
  - the Mark false cases in `ownerCorrectionService.test.ts` (L169–222) and
    in `ownerCorrectionWorkflow.test.ts`;
  - the legacy cases in `AddCandidateToInventoryAction.test.tsx` (L88–120);
  - the candidate-route case and its mock in `inventoryDynamicRoutes.test.tsx`
    (L9–15, L34–41);
  - the removed-route assertions in `unit6gMountedRouteIntegration.test.tsx`
    L282 and `unit6gMountedRouteComposition.test.tsx` L564–570.
- Change:
  - `ownerEditionPickerMounted.test.tsx`: move the touch-target case
    (L179–186), which renders `CandidateReviewEditionSheet`, to
    `ownerEditionPickerSheetStates.test.tsx`;
  - `ownerCorrectionArchitecture.test.ts`: remove the deleted files from
    `productionFiles` (L4–17), and rewrite the L51 case;
  - `unit6gMountedRouteComposition.test.tsx` L779: fix the assertion, which
    can never fail as written.

**Done means:**
- the tests above pass;
- `tsc`, lint and the image-inventory Jest folder pass;
- a repository search finds no import of a deleted file;
- `CODEBASE_MAP/` and the validator's file lists are updated (D2-5).

---

## 7. Slice 5 — Typed ISBN (design direction; 5a sheet, 5b "Add a book")

**Goal:** the Owner can type the ISBN printed on the book to get its exact
edition, both in the sheet and in "Add a book" (PSR-D06, D13).

| | |
|---|---|
| **Size / risk** | L / high |
| **Split** | 5a and 5b, each with one migration and its own review |
| **Status** | Design direction only |

The pass-2 reviews found several contracts that this direction must still
satisfy (listed below). When 5a starts, slice 5 gets its own full design
pass with SQL. That pass is reviewed before any migration is written.

### Why not request-scoped (departure from SDD-0 §14 Q2)

The edition request has no query input; its contract is strict
(`contracts/ownerEditionPicker.ts` L26–29). Its query identity is computed
from the candidate (M65 L124–146), and four places check that identity:
1. the request (M75 L94–99);
2. the worker (`shared/runtime/metadataGatewayContext.ts` L98–111);
3. the completion fence (M68 L81–83);
4. option cleanup (M73 L154–164).

An ISBN carried on one request only would fail all four checks.

**Direction:** store the typed ISBN on the candidate as **`owner_isbn13`**
(nullable). It sits beside the observed fields and never overwrites them.
While it is set, the candidate's query identity is ISBN-only.

### Requirements the 5a/5b design must meet

**Tenant and locks.** `phase9_set_candidate_isbn_v1`:
- checks the owner;
- derives `store_id` on the server;
- requires `candidate.store_id = session.store_id`, like its siblings (M62
  L105; M5 L140);
- locks the session, then the candidate;
- validates the checksum;
- is safe to replay;
- clears the ISBN when given null.

**Identity trigger.** The trigger registration (`UPDATE OF` list, M67
L317–319) and the controlled-selection shortcut (M69 L314–320) both include
`owner_isbn13`.
- Choosing an edition writes the edition's title and authors into the
  review (M73 L218–229). That write must not clear the ISBN.
- Only an Owner edit of the title or authors clears it.
- Tests: set, clear, first search, choosing over a wrong saved title, a
  later Owner edit, and replay.

**Language eligibility.** An exact ISBN alone does not make an option
eligible when its language conflicts with the card's known language (M65
L162–163; M76 L88–92; `shared/metadata/explicitEditionTitle.ts` L95–100).
- The design defines one ISBN-only language rule for both SQL and the
  worker, for example the existing `und` exact-ISBN exception.
- Test: a correct foreign-language ISBN on an English-scanned card.

**Open Library fetch.** A direct ISBN fetch must fit the existing stage and
accounting contracts:
- provider stages (M73 L510–515);
- completion stages (M74 L95–106, L142–143);
- per-call accounting (`shared/runtime/metadataEditionProviderCalls.ts`
  L47–63).

The allowlist (`openLibrary/transport.ts` L18–19) gains `/isbn/…`,
`/books/OL…M.json` and the work record. Every redirect is checked by hand
before it is followed; today the code uses `redirect:'error'` (L42). Every
GET is fenced, spaced, accounted for and counted within the budget. An
empty-query guard is added, as in `googleBooks/request.ts` L23.

**5b with an ISBN only.** An empty `observed_title` would break both the
app's and Edge's response decoders (`contracts/ownerBatchReviewContracts.ts`
L82–87; `contracts/ownerUxCandidateSchemas.ts` L168–171;
`shared/contracts/ownerBatchReviewResponses.ts` L43–44). Older apps reading
the same session would break too.
- 5b must keep every existing reader valid.
- Options: look up the edition before creating the card, so it has a real
  title, or add a projection that is safe for older apps.
- Add stays blocked until the card has a title (M29 L832–833).

**Compatibility.**
- The six-argument `phase9_add_manual_candidate` and edition requests made
  without an ISBN keep working (R06).
- Deploy order is server first: database, then Edge and worker, then the
  app.

**Tests.** Extend the existing
`supabase/functions/__tests__/phase9_metadata_isbn_identity.test.ts` so the
worker and SQL identities are proven equal.

### Acceptance checks (refined at 5a start)

- AC5-1: Given a valid ISBN, when the Owner searches, then the exact edition
  is listed with its cover, and choosing it fills the card (D06, D10).
- AC5-2: Given a bad check digit, then the app says so before any request is
  sent, and the server also rejects it (R07, R09).
- AC5-3: Given no result, then the sheet says so, and the card keeps its
  title and author (R10).
- AC5-4: Given an ISBN-10, then it is converted to ISBN-13.
- AC5-5: Given only an ISBN in "Add a book", then a card is created that
  every reader accepts, and its lookup runs by ISBN (D13, R06).
- AC5-6: Accessibility. The ISBN box has a label, and its error is announced
  (R14).
- AC5-7: Given a correct ISBN on a card whose scanned title is wrong, then
  the exact edition is eligible, subject to the language rule above (D06).
- AC5-8: Given an edition outside the first ten editions of its work, then
  it is still found by ISBN (D06).
- AC5-9: Given an older app, then the six-argument function and requests
  without an ISBN still work (R06).
- AC5-10: Given an owner ISBN, when the Owner edits the title and saves, then
  the ISBN and the edition are cleared. Choosing an edition does not clear
  the ISBN (D07).
- AC5-11: Given an ISBN-only query, then the worker and SQL identities are
  equal, and cleanup keeps the options.

---

## 8. Rollout and compatibility

- **Slices 1–4 change only the app.**
  - Older app builds keep working against the unchanged server.
  - Full correction stays reachable in those builds, because its server
    functions remain.
- **Slice 5 goes server first:** migration, then Edge and worker, then the
  app. Each step has its own approval (AGENTS.md).
- **Order.** The slices merge in the order 1 → 2 → 3 → 4 → 5a → 5b, one
  branch and one PR each (PSR-R12).

## 9. Traceability

| Decision | Slice | Acceptance checks |
|---|---|---|
| PSR-D02 | 1, 4 | AC1-1, AC1-5, AC1-7, AC4-4 |
| PSR-D03 (interim) | 1 | AC1-1, AC1-4, AC1-6 |
| PSR-D04 | 1, 3 | AC1-2, AC3-1 |
| PSR-D05 | 2 | AC2-1, AC2-2, AC2-3 |
| PSR-D06 | 5 | AC5-1 to AC5-4, AC5-7, AC5-8 |
| PSR-D07 | 2, 5 | AC2-4, AC2-8, AC2-10, AC5-10 |
| PSR-D09 | 2 | AC2-5, AC2-9 |
| PSR-D10 | 2, 5 | AC2-3, AC5-1 |
| PSR-D11 | 4 | AC4-1, AC4-4, AC4-4b, AC4-5 |
| PSR-D12 | 3 | AC3-1 to AC3-4 |
| PSR-D13 | 4, 5 | AC4-2, AC4-3, AC5-5, AC5-9 |
| PSR-D47 | 2 (app); 13 (server, SDD-4) | AC2-7; AC13-9 |
| PSR-R06 | 3, 4, 5 | AC5-5, AC5-9 |
| PSR-R07 | 1, 2, 4 | AC1-3, AC1-5, AC1-9, AC2-10, AC4-4, AC4-7 |
| PSR-R14 | 2, 4, 5 | AC2-6, AC4-6, AC5-6 |

## 10. Pass-2 evidence and reviews

**Code map.** Three read-only Haiku code maps (2026-10-19) covered slices
1–2, 3–4 and 5. The author then checked each claim that drives the design
in the code (tracker 38 §13).

**Reviews.** Two independent read-only reviews followed (tracker 38 §14):
- OpenCode Go Space Bunny (max): `approve_with_fixes`;
- Codex `gpt-6.1-sol` (xhigh): `rework`.

Every finding was checked in the code before it was adopted. Changes from
the first pass-2 draft:

| Slice | Change |
|---|---|
| 1 | The frozen draft is replaced by the server review. The reset caused by Add's own save is handled. Whole requests are frozen for replay. Any unseen change stops Add. |
| 2 | Script is part of the identity rule. "No author" is part of the card rule. Old results hide after an identity edit. Only one message shows while the lookup is pending. |
| 4 | The script is recomputed, not cleared; a null script would switch off a server check. Stale wording is rejected in up to two rounds. The test and route deletion lists are complete. |
| 5 | Reduced to a design direction with explicit requirements. |

One finding was not adopted, because the code already covers it: the
claimed race between save-then-search and Add. That path already claims the
card's command slot.
