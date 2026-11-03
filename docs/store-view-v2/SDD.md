# Store View v2 — SDD

**Status:** draft v4 (revised after three Terra reviews, 2026-10-29). Not
approved.
**Covers:** scope, lane rules, Slice 0 (bug fixes) and Slice 1 (Store
View-only features). Later slices (search/sort, bulk, sale price, campaigns,
Deals shelf) are not designed here.

Current state and next action live in [TRACKER.md](./TRACKER.md). How Store
View works today is in `CODEBASE_MAP/04-features.md` § Store View.

---

## 1. Scope

Feature numbers are from the user's draft list (groups A–F).

| # | Feature | Status |
| --- | --- | --- |
| — | Fix existing Store View bugs | **In — Slice 0a** (client) and **0b** (photo reorder server fix, §3.6) |
| 15 | Prices entered in rupees | **In — Slice 1a** |
| 6 | Fix buttons for attention reasons | **In — Slice 1a** (buttons only; the existing *Needs attention* filter is the queue). The damage-photo button depends on check 3.4. |
| 2 | More filters and saved views | **Partly in — Slice 1a**: the list remembers the last filter used. New filters and named saved views need server work and come later. |
| 5 | Summary dashboard | **In — Slice 1b** (new read-only server function; see §4.4) |
| 1, 3, 4, 7–13, 16, 18–22, 25, 27, 29–32 | Everything else in groups A–F not listed elsewhere | **Not decided** — later SDD versions |
| 14, 17, 23, 24, 26, 28, 33 | Offline undo, suggested pricing, order-level offers, coupons, wishlist alerts, staff roles, per-channel visibility | **Deferred** (draft list's own recommendation) |

Out of scope for this version: pricing rules (no sale price, discount or
campaign), the customer marketplace screens, Phase 6 commerce, publication
rules, and the Image inventory scan/review flow. Slice 1a changes only the
**unit the owner types** a price in; saving a price keeps today's behaviour,
including the existing update of a live listing's price.

---

## 2. Rules for the whole lane

### Approval gates (from AGENTS.md)
Each of these needs its own explicit yes from the user:
1. Approving this SDD (or a slice of it).
2. Starting implementation of a slice.
3. Creating a migration file.
4. Applying a migration to the shared Supabase project (exact project
   `ahntbtktjjmvfosgkmgn` re-verified with Supabase MCP before planning and
   again before applying; result read back).
5. Deploying the `phase9-owner-ingestion` Edge Function (and telling the Phase
   9 lane first).
6. Commit, push, PR, merge.

All lane work lands on `feature/store-view-v2` in this checkout
(`Bookconnect_storeview2`). An implementer model works in a temporary
worktree branched from `feature/store-view-v2`; its diff comes back to this
checkout only after review. No other checkout is edited.

### Money
- Prices are stored and sent as **integer paise** (`sellingPriceMinor`). The
  app converts only for display and entry; it never sends a computed final
  price.
- Any future pricing feature needs written money rules (discount stacking,
  rounding, maximum discount, GST/commission base, what a cart keeps when a
  sale ends) in this SDD before any pricing code.

### Where we may change things

| Area | Rule |
| --- | --- |
| `src/features/storeView/`, `app/(store-owner)/store-view/` | Change freely within the approved slice. |
| `phase9-owner-ingestion` Edge Function, `_shared/imageInventory/` | Shared with Phase 9. Additive changes only (new actions/contracts), each named in the slice spec. |
| `src/features/imageInventory/` | Shared. Reuse; don't change unless named in the slice spec. |
| `src/application/auth/sessionCoordinator.ts` | Shared. Changed only where named (§4.3). |
| Migrations / shared Supabase project | Gates 3–4 above; PGlite tests first. |
| Customer marketplace, Phase 6 commerce | Not touched in Slices 0–1. |

### Testing
- Every **changed behaviour** gets a test that fails on the current code and
  passes after; record the failing run. Cases the old code already handles
  (e.g. rejecting negative prices) stay as regression tests and are not
  expected to fail first. Tests that assert old behaviour (paise label, old
  invalidation keys) are updated, and the update is named in the PR.
- Tests check behaviour (e.g. the cached query is really refreshed), not only
  that a function was called with some argument.
- Commands: `npx tsc --noEmit`; `npx jest src/features/storeView
  src/features/imageInventory src/application/auth`; ESLint on changed files
  where the repo config covers them (it is currently scoped to the book
  section, `eslint.config.js`). Record a baseline before the slice.
- Migrations: PGlite tests (`supabase/tests/phase9/databaseHarness.mjs`)
  before any apply.
- App checks: Haiku subagent runs a written checklist in the browser and
  returns pass/fail with screenshots.

### Process per slice
Spec approved → implementation approved → Sol implements in a temporary
worktree off `feature/store-view-v2` → review (Terra, Luna, Muse, DeepSeek) → corrections → tests + Haiku checks →
Claude verifies → docs updated → full PR review here → merge only with the
user's yes.

### Documents this lane updates
**User decision (2026-10-29):** this lane keeps its own documents and does not
follow the Phase 9 per-session update matrix. Per slice: this SDD (behaviour
and acceptance), `TRACKER.md` (work done, verification actually run, DB
changes or "none", next action), and `CODEBASE_MAP/` files the change makes
wrong. Shared docs (`implementation/ACTIVE.md`, DOC-13, Phase 9 trackers) get
one small update at merge time.

Exception — the database is shared, so a migration **applied** to the shared
project is recorded the same day in both `TRACKER.md` and the Phase 9
migration ledger
(`phase-9-image-inventory/supporting/database-current-vs-target.md`): local
file, live version, project check, effects, readback.

---

## 3. Slice 0 — Fix existing bugs

Two parts:
- **Slice 0a — client fixes (§3.1–3.4).** No database or server change.
  Files: `src/features/storeView/` and its tests, plus one new read-only
  diagnostic test in `supabase/tests/phase9/` for §3.4 (using the existing
  `unit7cFixture.mjs`, which loads M41–M46).
- **Slice 0b — photo reorder server fix (§3.6).** One corrective migration;
  gates 3 and 4 apply.

### 3.1 Save, stock and photo changes don't refresh cached data

**What's wrong.** Stored query keys include the owner's identity:
`[...imageInventoryKeys.identity(identity), 'storeView', version, ...]`
(`storeViewQueries.ts:19-32`; media, history and owner-read keys follow the
same pattern). After **save, stock and photo** commands, the refresh calls use
`storeViewKeys.all`, `storeViewMediaKeys.all`, `storeViewHistoryKeys.all` and
`ownerInventoryReadKeys.all` — `[...root, '<family>', version]`, no identity —
which match nothing (`storeViewManagementQueries.ts:46-47`,
`storeViewMediaCommands.ts:62-64`). The detail screen and photo modal hide
this by calling `refetch()` by hand; the list stays stale.

Publish/pause/retry are **not** affected: `publicationQueries.ts:36` also
refreshes `imageInventoryKeys.all`, which matches everything.

Photo **add** (and installing a pending upload) skips the command hook
entirely: `StoreViewManagePhotosModal.tsx:138-146` calls
`publicationService.submitPublicCopyMedia` directly and only refetches photos.

**Fix.** Refresh with identity-scoped prefixes, the pattern the Image
inventory commit path already uses (`inventoryCommitCache.test.ts:41-44`):
`[...imageInventoryKeys.identity(identity), 'storeView' | 'storeViewMedia' |
'storeViewHistory' | 'ownerRead']`. Do not change the shared
`ownerInventoryReadKeys` object. Keep the existing conflict-path `refetch()`
calls (success invalidation doesn't cover errors).

| After a successful… | Refresh |
| --- | --- |
| Save details, adjust stock | Store View page + detail, history, owner-read |
| Photo reorder / remove / replace | Store View page + detail, media, history, owner-read |
| Photo add, including a pending upload installed later | Same as above (add an explicit refresh after `submitPublicCopyMedia`) |

**Tests.** With a real `QueryClient`, seed queries under the real stored keys
for every filter and each family, run each command, and assert those queries
are refreshed (fails today). Queries for **another identity** and
`'unresolved'` placeholder keys must not be refreshed. A guard test checks
every key Store View refreshes is a prefix of at least one key produced by
the Store View and owner-read key factories. Note: an active query refetches
immediately, so assert the refetch happened rather than that it stays
invalidated. Replace the old-key assertions in
`storeViewManagementQueries.test.tsx:68-69`.

### 3.2 Edit form loses typed changes, or could overwrite someone else's

**What's wrong.** `StoreViewEditModal.tsx:69-74` rebuilds the draft whenever
`detail` changes, wiping what the owner typed (today on conflict; after 3.1,
on any refresh). Separately, `buildStoreViewChanges`
(`storeViewEditForm.ts:75-106`) compares **every** draft field with the
latest detail, so keeping a stale draft would resend untouched fields and
undo another person's change.

**User decision (2026-10-29): keep the owner's typed edits.** Built safely as
follows.

**Fix.**
- When the modal opens, take a **baseline**: a copy of the book and its
  `inventoryVersion`. The draft starts from the baseline and isn't touched by
  background refreshes.
- The modal keeps an **edited set**: a field joins it when the owner changes
  it and leaves only if the owner puts it back to the baseline value. The
  damage fields (`hasDamage`, `damageTypes`, `damageNote`) are one group: if
  any is edited, the group is edited and all three are sent. Save sends only
  the edited set, with the baseline version.
- Because save uses the baseline version, any change since opening that
  advances `inventoryVersion` (edits, stock adjustments, photo
  reorder/remove/replace, publication changes) produces `P9_VERSION_CONFLICT`.
  Some changes don't advance it (e.g. photo add, stock holds from orders);
  those don't conflict and don't touch the editable fields. On conflict,
  refresh the book, then rebase:
  - **Fields not in the edited set** take the refreshed values (so an
    untouched old price is replaced by the other person's new price, and is
    still not sent).
  - **Edited fields the other person didn't change:** keep the owner's values.
  - **Edited fields the other person also changed** (for the damage group:
    any member changed remotely): mark each, showing "Changed by someone else
    to X". Save stays disabled until the owner picks keep mine / use theirs
    for each.
  - **If every edited field already equals the refreshed value:** show
    "These changes are already saved" and close.
  - "Equals" always compares **server-normalized** values, i.e. the same
    normalization the save RPC applies before its no-op check (e.g. title
    `btrim`, `20260816000046:42-43`). The implementer lists every field's
    normalization from that RPC in the PR, and the form's comparison uses
    exactly that list.
  - The baseline and version become the refreshed ones; the edited set is
    unchanged. Repeated conflicts repeat the same steps.
  - Message: "This book changed while you were editing. Your edits are kept —
    check them and save again."
- **A refresh counts as successful only if the refetch result has no error**
  (TanStack `refetch()` doesn't throw by default; check its result).
- **Offline or stuck refresh:** when the device is offline, TanStack pauses
  the fetch instead of failing it. If `onlineManager` reports offline, or a
  refresh hasn't finished within 15 seconds, treat it as a temporary failure
  (next bullet) with the text "You're offline. Your edits are kept." A
  refresh that completes later is still accepted.
- **Temporary refresh failure** (offline, timeout, network, retryable server
  error): keep the modal open with the draft, show "Couldn't load the latest
  version. Try again." (or the offline text) with Retry and Close, and keep
  Save disabled until a refresh succeeds. The detail screen shows its error
  page only when it has no cached book (`StoreViewDetailScreen.tsx:69`
  currently replaces the screen on any error).
- **Access lost:** `P9_AUTH_REQUIRED`, `P9_OWNER_NOT_AUTHORIZED`,
  `P9_NOT_FOUND`, **or an HTTP 401/403 from the function even without the app
  error body** (today `storeViewService.ts:74-75` turns any unrecognized error
  body into retryable `P9_INTERNAL_ERROR`; read the HTTP status first), or
  the signed-in user/store changes. Then: close the modal, discard the draft,
  and **remove** (not just hide) this book's cached detail, media and history
  queries, since they hold owner-only shelf location and internal notes; show
  the error page. A later temporary failure therefore has no private data to
  show.
- **`P9_NO_CHANGES` from the server:** refresh the book. If the edited fields
  already equal the refreshed values → "These changes are already saved",
  close. Otherwise → "Nothing was saved. Try again." with the draft kept.

**Tests** (fail today unless noted). Background refresh doesn't change the
draft. Owner edits title while price changes elsewhere → conflict → untouched
price shows the new value → save sends only title. Both changed price → field
marked, save blocked until resolved. Owner edits damage note while someone
edits damage types → group marked. Two conflicts in a row. Edits already
current → "already saved", including whitespace-only differences (`"Book "`
vs `"Book"`). Temporary refresh failure → draft kept, Save disabled. Offline
during conflict recovery → offline message, draft kept, refresh accepted when
back online. Access lost → modal closed, cached detail/media/history removed;
then a temporary failure → no private data shown. HTTP 401/403 without the
app error body → treated as access lost. `P9_NO_CHANGES` both outcomes.

### 3.3 Photo modal uses an outdated version

**What's wrong.** The modal takes `inventoryVersion` from the detail screen
(`StoreViewDetailScreen.tsx:255`) and uses it for every reorder, remove and
replace (`StoreViewManagePhotosModal.tsx:84,100,115`). Each change bumps the
version, but the photo commands don't refresh the detail (§3.1), so the second
change fails. The media **read** response has no version
(`storeViewMediaContracts.ts:41-45`); reorder/remove/replace results do
(`:47-52`); the add result (`submitPublicCopyMedia`) returns only
`mediaLinkId` (`publicationService.ts:51-54`).

Also, the photo list can be stale: the media query reuses cached records for
up to 15 seconds (`storeViewMediaQueries.ts:39`), and replace keeps a link's
ID while swapping its image (`20260815000045:504-506`), so an owner could
remove a photo they haven't seen.

**Fix.** The modal keeps a **confirmed state** = a version plus a photo list
read after it. The photo buttons (reorder, remove, replace, add) are enabled
only while it's set. To **confirm**: refetch the book detail, then refetch
the photo list; both must succeed; the version comes from the detail.
- **On open:** confirm. Until done, buttons are disabled with "Loading the
  latest photos…".
- **After reorder/remove/replace succeed:** take the version from the command
  result and refetch the photo list (must succeed before re-enabling).
- **After an add** (immediate, or a pending upload installed later), **after
  `P9_VERSION_CONFLICT`, or after any failed command:** clear and confirm
  again.
- **If confirming fails or stalls** (offline / 15 seconds, as in §3.2):
  buttons stay disabled with "Couldn't refresh this book. Try again." and a
  retry button. Closing and reopening starts again from "On open", so a stale
  version or photo list is never reused.
- **Access lost** (as defined in §3.2): close the modal and remove cached
  data the same way.
No contract change.

**Tests** (fail today). Two removes in one visit → the second sends the
version from the first result. Add then remove → remove waits for confirm
and sends the refreshed version. Pending upload installed, then remove →
same. Conflict → buttons disabled until confirmed. Detail or photo refetch
fails → buttons stay disabled, including after close and reopen. Photo
replaced in another session → reopen shows the new image before remove is
possible. Offline on open → offline message, buttons disabled. (Reorder
follows the same rules but can only be tested end to end after §3.6.)

### 3.4 Check: does adding a damage photo clear the warning?

`damage_evidence_required` comes from the stored
`store_inventory.listing_quality_status = 'needs_photo'`
(`20260814000043:468-469`). The quality function (`20260813000041:17-27`)
returns `needs_photo` for a damaged book when **any** of these is missing:
damage note, damage types, or 1–3 approved damage photos. From the migration
files, the media-change trigger (`20260815000045:130`) doesn't appear to
recompute the stored status, and save rejects unchanged fields as
`P9_NO_CHANGES`. If so, adding a photo won't clear the warning.

Slice 0 adds a **PGlite test** (`unit7cFixture.mjs`) for three damaged books:
(a) note and types present, no photo → add an approved damage photo through
the same RPC the app's add path uses → read the reason back; (b) photo
present, no note → save a note → read back; (c) photo present, no types →
save types → read back. Diagnostic only; no migration in Slice 0. The results
decide §4.2's buttons for this reason.

### 3.6 Photo reorder is broken on the live database (Slice 0b)

**What's wrong.** `phase9_reorder_store_view_media_v1` (M45,
`20260815000045:349-356`) first sets every eligible photo's `public_order`
to NULL, then writes positions 1..n. M51
(`20260821000051:56-77`) later replaced `validate_inventory_media_link()` —
called by the `BEFORE INSERT OR UPDATE` trigger on `inventory_media_links` —
to reject an eligible public photo with a NULL or out-of-range position
(`P9_PUBLIC_MEDIA_ORDER_REQUIRED`). No later migration changes the reorder
function. So every reorder with eligible photos fails.

**Live check (2026-10-29, read-only, project `ahntbtktjjmvfosgkmgn`):** M45
applied as `20260816122929`, M51 as `20260821061213`; the live guard contains
`P9_PUBLIC_MEDIA_ORDER_REQUIRED`; the live reorder still sets
`public_order=NULL`; the trigger is enabled. Table rules: `UNIQUE
(inventory_id, public_order)` not deferrable, `CHECK (public_order BETWEEN 1
AND 3)`. Terra reproduced the failure in an in-memory PGlite run with M51
loaded. Not yet reproduced against the live database (no writes were made).

**Fix (one new migration, gates 3 and 4).** Replace
`phase9_reorder_store_view_media_v1` with the same signature, checks,
version bump, revision, audit, event and idempotency behaviour, changing only
how positions are rewritten so no eligible row is ever NULL or out of range.
Recommended approach: reuse the existing transaction-local flag pattern
(`phase9.media_atomic_swap`, `20260815000045:504-507`) with a new
`phase9.media_reorder` flag that lets the guard accept a temporary NULL
**only** inside the reorder function, and assert at the end of the function
that every eligible photo has a distinct position 1..n. The implementer may
propose an alternative that keeps the guard unchanged; either way the guard's
behaviour outside the reorder function must not change.

**Tests (PGlite, extending `unit7cFixture.mjs` to load through M51).**
Reorder 2 and 3 photos → succeeds, positions correct, version bumped,
revision/audit written (fails today with `P9_PUBLIC_MEDIA_ORDER_REQUIRED`).
A direct UPDATE setting an eligible photo's position to NULL outside reorder
→ still rejected. Same-order request → `P9_NO_CHANGES`. Store A can't reorder
store B's photos.

**Before applying:** re-verify the project, list live migrations, and record
the migration in `TRACKER.md` and the Phase 9 ledger (§2). Tell the Phase 9
lane: this changes a Phase 9 function and, if the guard changes, a Phase 9
trigger function.

### 3.6b Removed photos come back as "ready to add" (Slice 0b)

**What's wrong (found in the live test 2026-10-29).** The photo list's
pending section comes from `phase9_owner_media_records_v1` (M45,
`20260815000045:261-289`). It lists every upload capability for the item
that is `consumed` (no expiry check) whose approved public copy has no row in
`inventory_media_links`. Removing a photo deletes its link row and leaves the
public-copy asset `approved`, so the old upload reappears as "Add photo …
Approved and ready to add", every time the modal opens, with no end.

**Live check (read-only):** after two adds and two removes on one item, 0 link
rows; both public-copy assets still `lifecycle_status='approved'`,
`deleted_at` null; both capabilities `consumed`.

**Fix (in the Slice 0b migration, gates 3 and 4).** A removed photo must not
come back as pending. Recommended: the remove path marks the removed public
copy (a lifecycle status or flag that already exists for this purpose, if any;
otherwise the smallest addition), and the pending query excludes it.
The implementer checks first: what retention/cleanup already does with an
unlinked public copy (its object stays in the public `inventory-photos`
bucket), whether "Add approved photo" on a re-shown entry would succeed today,
and whether the replace path has the same problem for the replaced photo.
Report these before choosing the approach.

**Tests (PGlite).** Add → remove → media read has no pending entry for it.
Add (not yet linked) → still listed as pending/approved. Replace → the old
photo does not appear as pending. Store isolation unchanged.

### 3.7 Slice 0 acceptance
- [ ] Every changed-behaviour test failed before and passes after (recorded).
- [ ] Baseline and final `tsc` and Jest runs recorded; no new failures.
- [ ] 3.4 PGlite result recorded in `TRACKER.md`.
- [ ] 0b: PGlite tests pass through M51; gates 3 and 4 approved; project
      re-verified; applied, read back and recorded; a live reorder by a test
      owner succeeds.
- [ ] Haiku checklist: edit a price → list shows the new price without pull to
      refresh; two photo changes in one visit succeed (reorder only after 0b);
      add a photo → list,
      detail and photo count update and history is re-read (adding a photo
      doesn't create a history entry today; that's not changed here); edit
      title while another session edits price → only
      title saved; conflicting edits on the same field must be confirmed.
- [ ] Note for the Phase 9 lane (not fixed here): `publicationQueries.ts:35`
      refreshes `ownerInventoryReadKeys.all`, which matches nothing (harmless
      today because line 36 covers it).

---

## 4. Slice 1 — Store View-only features

### 4.1 Prices in rupees (Slice 1a)

**Today.** The edit form takes paise ("Selling price in paise",
`StoreViewEditModal.tsx:96`; `storeViewEditForm.ts:61-64`). Typing 250 lists a
book at ₹2.50.

**Change.** The field takes **whole rupees**, labelled "Selling price (₹)".
Conversion uses `rupeesToPriceMinor` from
`imageInventory/scanSetup/scanSetupForm.ts` (exported; whole rupees, max
₹21,474,836). The contract still sends `sellingPriceMinor` in paise.

**Rules.**
- The field shows the current price in rupees (`25000` → `250`; `25050` →
  `250.50`).
- If the owner doesn't touch the field, the original paise value is kept
  exactly and the field isn't sent (works with §3.2's edited-fields rule).
  This includes values above ₹21,474,836 (up to 2,147,483,647 paise) and
  values with paise.
- An edited value must match `^(0|[1-9][0-9]*)$` (digits only) **before**
  conversion, then pass `rupeesToPriceMinor`. So `250.0`, `1e2`, `-5`, `250.5`
  and spaces-only are rejected.
- 0 stays allowed (the server flags `missing_price`).
- Error: "Enter the price in whole rupees, for example 250."

**Tests.** Fail first: label says ₹; `250` → sends 25000; `1e2` and `250.0`
rejected. Regression: negative and decimal rejected; 0 allowed; ₹21,474,836
accepted and ₹21,474,837 rejected; untouched `25050` and `2147483647` not sent
when another field is edited.

### 4.2 Fix buttons for attention reasons (Slice 1a)

**Today.** The detail screen lists reasons as text
(`StoreViewDetailScreen.tsx:82-84`); the list card shows a "Needs attention"
badge.

**Change.** Each reason becomes a row with a plain explanation and, where the
owner can act, one button. **Buttons that change the book** show only if the
server returned the matching capability. **Navigation-only** buttons ("View
plan") aren't capability-gated; the destination does its own checks.

| Reason | Button → action | Gate |
| --- | --- | --- |
| `missing_price` | "Set price" → edit form, price field focused after the modal opens | `edit_details` |
| `missing_condition` | "Set condition" → edit form | `edit_details` |
| `missing_metadata` | "Add details" → edit form | `edit_details` |
| `not_sellable` | "Mark as sellable" → edit form | `edit_details` |
| `damage_evidence_required` | Depends on what's missing. Note and types come from the detail (`damageNote`, `damageTypes`). Damage photos come from a **successful** photo-list read: records with `role: 'damage'` (`storeViewMediaContracts.ts:10-20`); the detail's `approvedCount` counts all roles, so it isn't used. No damage photo → "Add damage photo" → photo modal, role preset to **damage** (if all 3 positions are taken, explain one must be removed first). No note or no types → "Add damage details" → edit form. If the photo-list read fails, show the explanation only, with a retry. **Each button ships only if check 3.4 shows that path clears the warning**; otherwise explanation only, and a server fix is proposed separately (its own gates). | `manage_photos` / `edit_details` |
| `publication_failed` | "Retry" → existing retry | `retry_publication` |
| `subscription_restricted`, `entitlement_blocked`, `active_listing_limit_reached` | "View plan" → `/(store-owner)/subscription` | none (navigation) |
| `moderation_blocked`, `store_policy_blocked` | Explanation only | — |

Explanations are short and plain, e.g. "Customers can't see this book until
it has a price."

**Tests.** Each of the 11 reasons renders its text; mutation buttons appear
only with their capability; each button opens the right action; price focus
after open. Damage: mixed roles (actual-copy photos but no damage photo →
"Add damage photo"); all 3 positions taken → explanation; photo-list read
fails → explanation and retry. End to end (Haiku, plus PGlite in §3.4): tap
"Add damage photo" → upload approved → detail re-read → reason gone.

### 4.3 Remember the last filter (Slice 1a)

**Change.** The list opens on the filter the owner last used on this device,
instead of always "All".

**Rules.**
- AsyncStorage key `storeView_lastFilter:v1:<userId>:<storeId>`; value is one
  of the six filter names. Unknown or corrupt values → "All". Storage errors
  never block the screen.
- **Cleanup (per `CODEBASE_MAP/02-auth-session.md`):** add a step to
  `cleanPreviousUserState` (`sessionCoordinator.ts`) that removes the previous
  user's `storeView_lastFilter:v1:<userId>:*` keys on logout and account
  switch. So the preference does **not** survive logout.
- **Races:** reads and writes go through one small module that serializes
  them per key. Cleanup waits for in-flight writes to finish, then removes the
  keys. A read whose result arrives after the user or store changed is
  ignored. A write requested after cleanup started for that user is skipped.
- **Startup read vs a tap:** the list starts on "All" and applies the stored
  filter only if the owner hasn't tapped a filter yet; once they tap, a late
  stored value is ignored.
- **Cleanup failure** is best effort: it's reported (Sentry) and retried at
  the next cleanup; it doesn't block switching, because the value is a
  non-sensitive filter name and the key is scoped to user and store, so no
  other account ever reads it.
- Update `CODEBASE_MAP/02-auth-session.md` with the new key.

**Tests.** Select "Paused", remount → "Paused". Other store → "All". Corrupt
value → "All". Logout removes the key. A write in flight during logout
finishes before removal, and a write requested after logout is skipped. A
read that resolves after a store switch is ignored. Cleanup failure is
reported and doesn't block logout.

### 4.4 Summary dashboard (Slice 1b)

**Why a server function.** The list returns 20 books per page with no totals.
The app could load every page and count, but that's slow for big stores and
fetches every book's private data just to count. One read-only server
function returns the numbers in one call.

**What it shows** (top of the Store View list):
- Counts that **exactly match** the filter chips: all, private, live, paused,
  needs attention, out of stock — using the same conditions as
  `phase9_store_view_page_v2` (`20260814000044`: needs attention uses
  `attentionState`; the others use `effectiveState`). Tapping a count selects
  that filter. "All" includes every book. The state of each book comes from
  one precedence order (`20260814000043:490-495`: publication failed → needs
  attention → out of stock → live → paused → private), so a book with an
  attention reason counts under Needs attention, not Live. Publication
  failures appear under Needs attention.
- "Value of available stock": sum over **all** the store's books of
  `selling_price_minor × quantity_available`. Both are `INTEGER`; the total
  can exceed `bigint` and JavaScript's safe integer range, so it's summed as
  `numeric`, sent as a decimal string of paise, and formatted to rupees with
  string/`BigInt` arithmetic — never converted to `Number`.

**Server change** (gates 3–5):
- Migration `phase9_store_view_summary_v1()`: `STABLE`, read-only; same
  owner check, server-derived store, `SECURITY` mode and `search_path` setting
  as `phase9_store_view_page_v2`. `REVOKE ALL ... FROM PUBLIC, anon,
  authenticated, service_role`, then `GRANT EXECUTE ... TO authenticated`
  (same as `20260814000044:88-91`).
- Edge Function: new action `read_store_view_summary`, contract version
  `phase9-store-view-summary-v1`, registered in the action allowlist
  (`ingestion.ts:90`) and dispatched like the page read
  (`ownerIngestion.ts:110`).
  - Request: `{ action, contractVersion }`, no other fields (strict).
  - Response: `{ contractVersion, data: { counts: { all, private, live,
    paused, needsAttention, outOfStock }, availableStockValueMinor } }` —
    counts are non-negative integers; `availableStockValueMinor` is a string
    matching `^(0|[1-9][0-9]*)$`. Strict; unknown fields rejected.
  - Errors: the same safe error envelope and codes as the page read
    (`storeViewService.ts:19-24`).
- App: client decoder with the same strict schema. Query key
  `[...identity, 'storeView', 'summary', 'phase9-store-view-summary-v1']`, so
  the existing commit refresh (`ownerInventoryCommitQueries.ts:62-63`) and the
  §3.1 Store View prefix also refresh it. Publication changes refresh it
  through the shared publication hook, which refreshes `imageInventoryKeys.all`
  (`publicationQueries.ts:36`) — that marks **every** cached identity's
  summary stale, not just the current one. That's acceptable (only refetches;
  no data crosses accounts) and the shared hook is not changed in this lane.
  Changes made in another session or by workers show on screen focus or pull
  to refresh.

**Tests.**
- PGlite: for a seeded store with books in every state, each count equals the
  number of rows the page RPC returns for that filter across **all** pages;
  three books at maximum price and quantity give the exact total (above
  `bigint`); empty store → zeros; store A can't see store B; anonymous,
  non-owner and `service_role` calls rejected; grants read back as specified.
- Edge/contract: unknown request/response fields rejected; error envelope.

**Decisions added 2026-10-30 (owner approved the mockup).**
- **A "Summary" button** in the Store View header shows/hides a panel above
  the filter chips (button reads "Hide summary" while open). The panel holds
  the six counts (tap = same handler as a chip tap, so the remembered filter
  and the startup-read guard behave the same) and "Stock value (asking
  price)" with the note "All books, including private and paused". Open/closed
  is remembered per account and store like the filter, and cleared on logout
  and account switch by the same cleanup.
- **Built to change.** The UI renders the panel from one config list (id,
  label, how to read the number from the response, and the filter it selects);
  adding or removing a tile is one entry. The SQL computes every count with
  one `COUNT(*) FILTER (...)` line each over a single pass, so a new count is
  one added line plus one contract field. The response keeps `counts` keyed by
  filter id so new filters extend it without reshaping.
- **Cost.** Counts are computed in one pass by a narrow aggregate that must
  give the same answer as the page RPC's classification (proved by the
  page-by-page equality test above). No search scope in 1b. Measure on a large
  seeded store before adding any cache.
- **Deploy.** The Edge Function action is additive on the shared
  `phase9-owner-ingestion`; deploy only from an integrated baseline, tell the
  Phase 9 lane first, and only with the user's separate yes. The migration is
  a separate file from Slice 0b and is also applied only with its own yes.
- **Refresh.** The summary refreshes on screen focus and pull-to-refresh as
  well as after commits.
- **Money display.** A string-based rupee formatter (BigInt) for the total; the
  existing number-based `formatPrice` is not used for it.
- App: loading, error and zero states; tapping a count sets the filter; the
  summary refetches after commit, save, stock, photo and publication changes;
  after commit, save, stock and photo changes another identity's summary is
  not refreshed (publication is the documented exception); a total above
  JavaScript's safe integer range displays exactly.

**Mockup first:** the user sees the dashboard layout before 1b starts.

### 4.5 Slice 1 acceptance
- [ ] Every changed-behaviour test failed before and passes after (recorded).
- [ ] 1a has no server or database change.
- [ ] 1b: migration passed PGlite tests before any apply; each gate approved;
      project re-verified; readback recorded in `TRACKER.md`.
- [ ] Haiku checklist: enter ₹250 → card shows ₹250; each fix button opens the
      right screen; filter remembered after reload and cleared after logout;
      dashboard counts match the filter results.
- [ ] `CODEBASE_MAP/04-features.md` § Store View and `02-auth-session.md`
      updated.
