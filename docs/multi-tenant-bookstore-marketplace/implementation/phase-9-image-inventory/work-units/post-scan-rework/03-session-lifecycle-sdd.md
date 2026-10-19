# Post-Scan Rework — SDD-3 Session Lifecycle (slices 10–12, 18)

**Status:** `pass_1_outline_approved` (2026-10-19). Owner approved the SDD set with the §14 defaults on 2026-10-19. Pass 2 is written immediately
before slice 10 starts; slice 18 gets its own pass 2 when the Owner approves
starting it.
**Overview and decisions:** [SDD-0](./00-overview-sdd.md)

## Context

A scan session today holds one photo and at most 15 cards (SDD-0 F11).
Removal marks a card `owner_removed_from_scan`, writes an ID-only audit entry
and event, and cannot be undone (F10, F33 below). There is no bulk removal,
closing is manual or done by the app only when nothing was removed (F30), and
no per-store daily limit exists (F31). This area adds "Remove all remaining",
moves auto-close to the server, adds the daily limit, and later physically
deletes removed data.

Decisions served: PSR-D01, D18, D19, D20, D21, D23, D24. Rules: PSR-R03 (removed
never returns), R06 (compatible rollout), R08 (state names unchanged), R10
(manual paths keep working; MAS-10 says quota failure never disables manual
entry).

**Verified for this area (2026-10-19):**
- F33: `phase9_owner_remove_candidate_v1` (latest M54 `20260829000054`
  L279–345) writes audit action `phase9.candidate.owner_removed_from_scan`
  and an event, both with IDs, dispositions and versions only — no book text.
  A trigger (`phase9_unit6g_removal_fence`, M52) blocks any change away from
  `owner_removed_from_scan`. Allowed source states include `processing`.
- The unique index `image_extraction_sessions_one_active_initiator` allows one
  active or closing session per store and Owner.
- `phase9_close_session_v3` (M52 L425–460) closes when every input is
  finished; it does not look at cards. A nullable-close fence rejects other
  close paths for sessions with a null default condition.

---

## Slice 10 — Remove all remaining; no restore

**Goal:** the Owner can discard the rest of a scan in one action (D18).

**Scope:** a **Remove all remaining** action in the bottom bar; a confirm
dialog stating the count and that it cannot be undone; the app removes each
remaining card separately through the existing removal command (sequentially,
each with its own idempotency key); a report lists any that failed with a
retry; removed cards disappear at once (D19). Cards currently Adding are not
removed (they finish first). Verify that late worker results for a removed
card are ignored (R03) — the existing edition-state clearing and fences are
expected to cover this; pass 2 proves it with a test.
**Not in scope:** physical deletion (slice 18); auto-close (slice 11).

**Depends on:** none (built after SDD-2 by order).
**Migration:** none expected — the single removal command and its ID-only
audit already satisfy D19 and D20 (F33). A migration is needed only if pass 2
finds a gap (for example, a worker write that is not fenced).
**Code pointers:** `review/scanCandidateRemoval.ts`,
`queries/ownerBatchReviewQueries.ts` (`useRemoveOwnerInventoryCandidate`),
`api/ownerBatchReviewService.ts`, `runtime/ownerBatchReviewIngestion.ts`,
`screens/CaptureProgressScreens.tsx`, `components/OwnerConfirmationDialog`.

**Acceptance checks:**
- AC10-1: Given 6 remaining cards, when the Owner confirms Remove all, then
  all 6 disappear and each has one ID-only audit entry (D18, D19, D20).
- AC10-2: Given 2 of 6 removals fail, then 4 disappear and the report names
  the other 2 with Retry; retrying removes them without duplicate audit
  entries (D18).
- AC10-3: Given a card that is Adding, then Remove all skips it and says so
  (R01).
- AC10-4: Given a removed card, when its metadata job finishes later, then the
  card stays removed and no Owner view or count shows it (R03).
- AC10-5: Given the confirm dialog, when the Owner cancels, then nothing is
  removed.
- AC10-6: Accessibility: the confirm dialog and the failure report are
  announced, and Retry has a label (R14).

**Tests first:** Jest — Remove all control, sequential execution, report and
retry. Database — late worker write against a removed card
(`phase9Unit6gFoundation` / metadata suites).
**Size / risk:** S–M / low–med.

---

## Slice 11 — Server auto-close

**Goal:** a scan closes by itself when every card is Added or Removed, even if
the app is closed (D21).

**Scope:** inside the same transaction that adds or removes a card, the server
closes the session when: every input is finished, at least one card exists,
and every card is committed or removed (none `commit_in_progress`). Remove all
therefore ends the session when its last removal lands. The app's
`useCompletedScanAutoClose` and its policy are retired; the readiness summary
stops offering manual Close for this case. Unfinished card edits held in the
app are discarded when the session closes (D09).
**Other endings:** a session can still end by manual Close (older apps) or
by expiry with cards neither added nor removed. Those cards count as
**Removed**: never shown, never added, deleted by slice 18 (D01, D09). No
new persisted state is introduced (R08); pass 2 decides whether this is a
read rule or the existing removal disposition written with a system actor.
**Lock graph (F39):** pass 2 maps every writer that touches a session and
its candidates — Owner Add/Remove (session → candidate), the session-scope
trigger (candidate write → session update), the edition worker
(candidate first), manual card creation (no session lock today) — and the
close helper must not add a reversed path. Manual card creation takes the
session lock first so a new card cannot appear while the session closes.
**Pass-2 points:** a photo that produced no cards (no books, quality or
language rejection) — keep the current manual path (remove the photo and
retake, or close) rather than auto-closing; expiry stays a comparison on
`expires_at` (F30). The close must use the v3 contract marker so the nullable
close fence accepts it.

**Pass-2 notes:** the lock order session → candidate is already used by the
current Add (`20261008000069…sql` L127–129); grep every writer of `expired`
and `closing` before the migration (F30 was not proven exhaustive).

**Depends on:** slice 10.
**Migration:** one (Add and Remove call a shared close-if-complete helper
under the session lock; no candidate-row trigger, which would take session
after candidate; manual creation gains the session lock; legacy close v3
returns the closed-session readback when the session is already closed).
**Code pointers:** `phase9_close_session_v3`, `phase9_owner_remove_candidate_v1`,
`phase9_add_candidate_to_inventory_v1`, `close/sessionAutoClosePolicy.ts`,
`close/useCompletedScanAutoClose.ts`, `screens/ReadinessSummaryScreen.tsx`.

**Acceptance checks:**
- AC11-1: Given 3 cards, when 2 are added and 1 removed, then the session is
  closed right after the last action, with no app involvement (D21).
- AC11-2: Given Remove all removes the last cards, then the session closes
  (D21).
- AC11-3: Given one card is Adding, then the session stays open until that Add
  finishes (D21, R01).
- AC11-4: Given the session closed automatically, then the Owner can start a
  new scan immediately (one-open-session rule).
- AC11-5: Given the server already closed the session, when an older app's
  own auto-close calls close v3 with a new key, then it receives the closed
  session's readback and shows no error (R06, F45).
- AC11-6: Given any session closed automatically, then every card in it is
  Added or Removed; none is left in another state (D01).
- AC11-7: Given an older app's manual Close with two unfinished cards, then
  those cards count as Removed and no Owner view or count shows them (D01).
- AC11-8: Given a session that expires with unfinished cards, then they
  count as Removed (D01, D09).
- AC11-9: Given an Add, a Remove, a manual card creation and an edition
  worker write racing on one session, then no deadlock goes unhandled, the
  session closes at most once and no card is created in a closed session
  (F39).

**Tests first:** Database — close on last add, on last removal, not while
Adding, concurrency between two last actions (one close only), the AC11-9
race in real PostgreSQL sessions, legacy close after auto-close, manual close
and expiry with unfinished cards. Jest — client
auto-close removed; closed-session screen.
**Size / risk:** L / high. Main risk: lock order (F39) and double close
under concurrency. Slice 13 must keep the same helper when it replaces the Add.

---

## Slice 12 — Daily limit

**Goal:** a store can scan at most its daily allowance of books (D23).

**Scope:**
- Allowance per store, default **500 books per day**, configurable per store;
  the day resets at **midnight IST** (`Asia/Kolkata`).
- **What counts:** every card created from a photo (detected books), including
  cards later removed. Manual "Add a book" cards do not count and are never
  blocked (MAS-10). The same photo uploaded again (duplicate input, Unit 6H)
  does not count twice.
- **When:** each upload reserves 15 books against the store's day (atomic and
  store-wide, so several Owners or staff cannot over-admit); vision
  completion turns the reservation into the real count, once per vision
  result (a replayed completion cannot count twice); failed, rejected or
  removed photos release their reservation. An upload is refused with a clear
  message when the allowance is used up (SDD-0 §14 Q11). Pre-scan shows "N of 500 left today". A photo started with some
  allowance left may finish even if it takes the count slightly over (at most
  14 books) is replaced by the reservation above; pass 2 confirms (SDD-0 §14
  Q11). The day a book counts on is the day its upload was admitted, using
  `Asia/Kolkata` (no daylight saving).
- 15 books per photo stays (MAS-01).
**Not in scope:** subscription plans and paid tiers (future).

**Depends on:** none.
**Migration:** one (counter storage — reuse `store_usage_counters` or a Phase 9
table, SDD-0 §14 Q6 — plus the check in the upload-issue function and the
increment in vision completion).
**Code pointers:** `phase9_issue_scan_upload` and
`phase9_register_scan_upload_completion` (M35), vision completion (M12 and
later corrections), `api/captureService.ts` (`P9_QUOTA_EXCEEDED` mapping
exists, F31), scan setup screen.

**Acceptance checks:**
- AC12-1: Given 480 books counted and nothing in flight, when a photo is
  uploaded, then 15 are reserved; when it yields 10 books, the count is 490
  and 5 are released. Given 490 counted and 15 reserved by another upload,
  then a new upload is refused with "Daily limit reached — resets at
  midnight" (D23, Q11).
- AC12-2: Given 485 counted and two staff uploading at the same moment, then
  exactly one upload is admitted and the other is refused (D23).
- AC12-3: Given books later removed, then the count does not go down (D23).
- AC12-4: Given the vision completion for one photo runs twice, then its
  books are counted once; given the Owner confirms re-uploading the same photo
  (Unit 6H), then the pass-2 rule for confirmed re-uploads applies and is
  tested (D23).
- AC12-5: Given the limit is reached, then "Add a book" still works (MAS-10).
- AC12-6: Given 23:59 and 00:01 IST, then the counts belong to different days.
- AC12-7: Accessibility: the remaining-count text and the refusal message are
  read by screen readers (R14).

**Tests first:** Database — atomic check and increment, concurrency,
re-upload, IST boundary. Jest — pre-scan remaining count, refusal message.
**Size / risk:** M / med.

---

## Slice 18 — Physical deletion (later; own approval)

**Goal:** removed cards and their data, and scan photos no card needs, are
actually deleted (D19, D24).

**Scope (outline):** a nightly, retryable cleanup job that, for closed
sessions, deletes removed cards and every row that references them across the
nine referencing tables (F9), the spine text kept in immutable analysis rows
(F32), and scan photos (`media_assets` and storage objects) once no remaining
card needs them; it must never touch committed cards or inventory. Immutable
tables need a narrowly scoped, audited deletion path. Audit entries stay
content-free.
**Amends:** DOC-3 INV-18 and the media retention rules (04 media SDD).
**Depends on:** slices 10 and 11.
**Migration:** one (possibly split during its own pass 2).
**Acceptance (outline):** deleted data is unrecoverable from the app and API;
a failed run retries the next night without partial corruption; committed
inventory and its provenance are untouched; storage objects match database
rows afterwards.
**Size / risk:** L / high.

---

## Traceability (pass 1)

| Decision | Slice | Acceptance checks |
|---|---|---|
| PSR-D01 | 11 | AC11-6 to AC11-8 |
| PSR-D18 | 10 | AC10-1, AC10-2, AC10-5 |
| PSR-D19 | 10, 18 | AC10-1, AC10-4 |
| PSR-D20 | 10 | AC10-1 |
| PSR-D21 | 11 | AC11-1 to AC11-5, AC11-9 |
| PSR-D23 | 12 | AC12-1 to AC12-6 |
| PSR-D24 | 18 | slice 18 outline |
