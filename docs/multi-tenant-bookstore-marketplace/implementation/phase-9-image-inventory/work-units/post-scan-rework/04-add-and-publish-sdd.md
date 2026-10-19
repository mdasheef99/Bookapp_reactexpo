# Post-Scan Rework — SDD-4 Add and Publish (slices 13–14)

**Status:** `pass_1_outline_approved` (2026-10-19). Owner approved the SDD set with the §14 defaults on 2026-10-19. Pass 2 is written immediately
before slice 13 starts, with a fresh design review (this is the riskiest
area).
**Overview and decisions:** [SDD-0](./00-overview-sdd.md)

## Context

Today Add is three client calls — save the review, reread, add — and two
triggers can clear `review_ready` in between, which is how cards got stuck
(SDD-0 F2, F3, F25). Every Add ends private; the session's publication choice
is recorded and ignored (F6, F7). This area makes Add one server action with a
durable receipt and then lets it publish according to the pre-scan choice.

Decisions served: PSR-D02, D03, D04, D15, D44, D47. Rules: PSR-R01 (one row),
R02 (publication never undoes Add), R06 (old and new apps both work), R07 (no
weakened validation).

**Verified for this area (2026-10-19):**
- The current Add replays by idempotency key (operation `U7AC01` in
  `phase9_idempotency_keys`: actor, operation, key, fingerprint, canonical
  response, status, expiry) (F2).
- `image_extraction_candidates.committed_inventory_id` is unique and a
  committed card fails eligibility, so a second row for the same card is
  already blocked; `store_inventory.created_from_candidate_id` has no unique
  index (F8).
- `image_extraction_sessions.default_publication` exists with values
  `private|publish`, default `private` (F7), so the choice itself needs no new
  column; only a marker for sessions started on the new pre-scan may (SDD-0
  §14 Q12).
- `phase9_set_publication_state_v2` (M40 L719–814) publishes synchronously:
  it checks `phase9_publication_ineligibility` (raising
  `P9_PUBLICATION_INELIGIBLE:<reason>` or `P9_MEDIA_NOT_APPROVED`), sets
  `publication_pending` then `published` once the listing-sync trigger has
  created the listing, and on a transient failure sets `publication_failed`
  and enqueues a `publication_retry` job.
- `listing_quality_status` is set by trigger on insert for image-extraction
  rows (M41).

**Design input:** design study 2 (Muse Spark 1.3 xhigh, 2026-10-19),
summarized in SDD-0 §10.

---

## Slice 13 — Single Add with receipt

**Goal:** one press of Add saves the card and creates exactly one inventory
row, however often it is retried (D03, R01).

**Scope:**
- A new server function (old save and Add functions stay unchanged so older
  apps keep working, R06) that, in one transaction, under the session → card
  lock order:
  1. returns the stored receipt if this command was already completed;
  2. if the card is already committed, returns that card's original receipt
     (any caller, any device). This check runs before the active-session
     fence, so the retry of an Add that closed its own session still gets its
     receipt;
  3. validates the review sent by the app and stores it — the hidden review
     step (D02, R07). The new contract has its own versioned review shape:
     today's key set is closed (`phase9_owner_ux_valid_review`, M29
     L825–831), so later card fields (ISBN, category, labels) extend the new
     shape while the old shape stays accepted on the old path. Requirements
     for Add include a price above ₹0, a condition and a quantity of at
     least 1 (D47; today's rule allows ₹0 for a private Add, F38); they are
     separate from publication eligibility (slice 14);
  4. links the catalogue edition (slice 6 helper);
  5. inserts the inventory row exactly as the current Add does, quantity from
     the card (D44);
  6. closes the card and session counters, audit and event as today;
  7. applies the slice 11 close-if-complete helper;
  8. stores and returns the receipt: inventory ID, card version, catalogue IDs,
     outcome, and (from slice 14) the publish outcome.
- **Receipt storage:** the original receipt (inventory ID, card version,
  catalogue IDs, publish outcome at Add time) is stored once, immutably, with
  the committed card — not rebuilt from the inventory row, whose publication
  state can change later — and is independent of idempotency-key expiry.
  Replies carry the original receipt and, separately, the current
  publication state. Keys still use `phase9_idempotency_keys` with a new
  operation code.
- **Reconcile after restart:** a retry must reuse the same key **and** the
  same command ID **and** the same expected versions, because the fingerprint
  covers all of them (SDD-0 F44). The app keeps all three until it sees the
  receipt. If any is lost, it reads the card first: committed → show the
  receipt; not committed → start a new command with a new key.
- **Readiness at the source:** pass 2 lists every definition of the three
  triggers (SDD-0 F3: metadata revision M29; lookup revision M29, replaced in
  M67; identity change first in M67 L287–319, replaced in M69) and keeps the
  M67 behaviour that clears edition options and returns the choice to manual
  on a real identity change. Narrow the three triggers (F3) so they reset
  `review_ready` only on a real change of the card's identity, not on worker
  touches or on a save that already contains the new identity. Server
  validation stays the gate. This retires slice 1's client re-save.
- App: the coordinator calls the single action; statuses Ready / Needs details
  / Adding / Added (D04); "Add all ready" calls it once per card, each
  independent (SDD-0 §14 Q8).
- Optional backstop: a partial unique index on
  `store_inventory(created_from_candidate_id)` for image-extraction rows —
  pass 2 checks existing data first.
**Not in scope:** publication (slice 14); category and labels (slices 15–16).

**Depends on:** slices 1 and 6 (and 11's helper if built first, which it is by
order).
**Migration:** one (new function, trigger narrowing, optional backstop index,
grants). The Owner API gets a new action and contract version alongside the
old ones.
**Code pointers:** `commit/inventoryCommitCoordinator.ts`,
`commit/inventoryCommitPolicy.ts`, `commit/useInventoryCommitCoordinator.ts`,
`commit/inventoryCommitBatchExecution.ts`, `api/ownerUxService.ts`,
`runtime/ownerUxRpcRoutes.ts`, contracts in app and Edge,
`phase9_add_candidate_to_inventory_v1` (M69), `phase9_update_candidate_review_v2`
(M62), triggers in M29 and M69.

**Recovery cases (each needs a test):**

| Situation | Correct result |
|---|---|
| Double tap | Second call returns the first receipt. |
| Response lost, app retries with same key | Same receipt; one row. |
| App closed during Add, reopened | Card reconciles to Added with the receipt. |
| Two devices add the same card | One row; the second gets the committed receipt. |
| Add races Remove | One wins under the card lock; the loser gets a clear conflict. |
| Worker updates the card during Add | Waits for the lock; afterwards the card is committed and the worker's write cannot reset it. |
| Edition cleared between edit and Add | Conflict; the card refreshes and shows Needs details. |
| Session expired or closed, card not committed | Conflict; no row. |
| Card committed by an Add that then closed the session | The original receipt. |
| Key kept but command ID lost | The app reads the card: committed → receipt; otherwise a new key and command. Never a raw mismatch error. |

**Acceptance checks:**
- AC13-1: Given a ready card, when Add is pressed once, then exactly one row
  exists, the card shows Added, and the receipt holds the inventory ID (D03,
  D04).
- AC13-2: Given each recovery case above, then the stated result holds (R01).
- AC13-3: Given a worker write that does not change the card's identity, then
  `review_ready` is not reset (F3 fixed).
- AC13-4: Given a real identity change, then readiness is re-evaluated and an
  invalid review is still rejected (R07).
- AC13-5: Given an old app version, then its save → reread → Add path still
  works (R06).
- AC13-6: Given a card's quantity of 3, then the row has total and available
  3 (D44).
- AC13-9: Given a review with a ₹0 price, no condition or quantity 0 sent
  directly to the new Add, then the server refuses it and creates no row;
  the old Add keeps today's rule for older apps (D47, R06).
- AC13-7: Given an edition worker lookup write that does not change the
  card's identity, then `review_ready` stays true (F3 third trigger).
- AC13-8: Given a book published at Add and later paused in Store View, when
  the Add is replayed, then the reply carries the original receipt (live) and
  the current state (paused) separately.

**Tests first:** Database — every recovery case including concurrency and
replay; trigger narrowing; old path unchanged. Jest — coordinator with the
single action, restart reconcile, ambiguous retry. Server — Owner API action
and contract.
**Size / risk:** L / **high**. If pass 2 finds it does not fit one session,
split into 13a (server function, receipt, triggers) and 13b (app switch-over).

---

## Slice 14 — Pre-scan publish choice acted on by Add

**Goal:** with **Publish now** (default), an added book goes live when it can;
otherwise it stays private with a reason (D15, R02).

**Scope:**
- Pre-scan shows "After adding: **Publish now** / Keep private", default
  Publish now, replacing "Prepare to publish". The new pre-scan sends the
  choice explicitly into `default_publication` (`publish` / `private`) and
  marks the session as started on the new pre-scan (SDD-0 §14 Q12). The
  column default stays `private` (F7).
- **Consent for older sessions:** Add publishes only for marked sessions. A
  session started by an older app — including one where the Owner chose the
  old "Prepare to publish", which meant "record intent, do not publish" —
  stays private when added, even through the new single Add.
- **Price, condition and quantity** are checked before Add (D47), so
  publication never fails for them.
- After the insert, the single Add reads the session's choice and marker
  (never a client flag) and, for `publish`, runs the existing publication logic (the body of
  `phase9_set_publication_state_v2`'s publish branch, factored into an internal
  helper) inside a protected sub-block:
  - eligible → published; receipt `publish: live`;
  - ineligible (quality, sellability, damage media, store gates:
    subscription, listing limit, moderation) → row stays
    `draft/private`; receipt `publish: private` with the reason code; Store
    View shows it under Needs attention with the same reason;
  - transient → `publication_failed` plus the existing retry job; receipt
    says it will retry.
  Nothing in the sub-block can roll back the Add.
- Keep private → no attempt; receipt `publish: private (owner choice)`.
- The pre-scan choice is the Owner's confirmation for this publish (P9-D87
  still applies to Store View's own Publish button).
- Card shows "Added · Live" or "Added · Private – {reason in plain words}"
  (D04).
**Not in scope:** Store View changes beyond showing the reason it already
derives.

**Depends on:** slice 13.
**Migration:** one (session marker, internal publication helper, single Add
update). No backfill of old sessions.
**Amends:** P9-D85, Unit 6G §18/AC17, MAS-05, Unit 7A/7B wording (SDD-0 §9).

**Acceptance checks:**
- AC14-1: Given Publish now and a priced, conditioned book, when added, then it
  is live in the marketplace and the card says Added · Live (D15).
- AC14-2: Given Publish now and a card with no price or a ₹0 price, then Add
  is not offered, the card shows Needs details "Enter a price" and nothing is
  created; once a price is entered and the book added, it publishes (D15,
  D47).
- AC14-3: Given the store's listing limit is reached, then the row stays
  private with that reason (D15).
- AC14-4: Given a transient listing failure, then the row exists, shows
  publication failed, and the retry job is queued (R02, MAS-11).
- AC14-5: Given Keep private, then no publish attempt is made (D15).
- AC14-6: Given an app sends a publish flag different from the session's
  choice, then the session's choice wins (D15).
- AC14-7: Given a tie-picked edition, then it is published like any other
  (D15).
- AC14-8: Given a session started by an older app with `default_publication =
  publish`, when its card is added through the single Add, then the row stays
  private with reason "owner choice" and no publish attempt is made (D15, R06).
- AC14-9: Given the publication step raises an unexpected error, then the
  inventory row and the Add receipt still exist and the row is private with a
  reason (R02).
- AC14-11: Given an older app starting a session with the old
  `phase9_start_session_v2` call, then it succeeds and the session is
  unmarked (R06, Q12).
- AC14-12: Given a session resumed or a start-session call replayed, then the
  marker is unchanged (Q12).
- AC14-10: Accessibility: the pre-scan choice is a labelled control and the
  card's publish outcome is read by screen readers (R14).

**Tests first:** Database — each outcome, ineligibility reasons, transient
path, unexpected error inside the publication sub-block, unmarked (older)
session, client flag ignored, replay returns the same publish outcome. Jest —
pre-scan control and default, card publish outcome text.
**Size / risk:** M / med.

---

## Traceability (pass 1)

| Decision | Slice | Acceptance checks |
|---|---|---|
| PSR-D02 | 13 | AC13-3, AC13-4, AC13-7 |
| PSR-D03 | 13 | AC13-1, AC13-2, AC13-8 |
| PSR-D04 | 13, 14 | AC13-1, AC14-1, AC14-2 |
| PSR-D15 | 14 | AC14-1 to AC14-8, AC14-11, AC14-12 |
| PSR-D44 | 13 | AC13-6 |
| PSR-D47 | 13 | AC13-9 |
