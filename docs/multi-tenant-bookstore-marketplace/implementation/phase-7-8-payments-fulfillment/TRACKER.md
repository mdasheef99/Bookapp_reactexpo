# Phase 7/8 Tracker

**Lane:** Phase 7/8 (payments and fulfillment), second active lane beside Phase 9 (D-126).
**Current state:** [ACTIVE.md, Phase 7/8 lane](../ACTIVE.md#phase-78-lane).
**Plan:** [handoff](../PHASE-7-8-HANDOFF.md) · [decision register](../PHASE-7-8-decision-register.md) ·
[pilot cut](./pilot-cut/00-pilot-cut-overview.md) · [build process](./BUILD-PROCESS.md)

This file holds dated evidence for the lane. It records status and evidence only; it never
originates product behaviour (AGENTS.md).

## Log

### 2026-11-13: day 1

- The owner approved the register proposals of 2026-11-13 ("Approve all 11"), recorded as
  D-116 to D-126.
- The pilot cut was checked against Cashfree's original replies (R1 to R5), the fact record
  and the sandbox tests; fixes applied and checked by Codex Sol (pilot overview §8).
- Planning branch `docs/phase7-8-planning` fast-forwarded into `main` at `f4d208e` with the
  owner's yes.
- Day 1 recorded (handoff §10 step 4): DOC-13 rows for Phases 7, 8 and 10 and a §5 entry;
  Phase 7, 8 and 10 tracker status lines; ACTIVE.md "Phase 7/8 lane" section; AGENTS.md
  lane pointer and D-33 sentence; this tracker created.
- The owner directed recording day 1 now. `phase9/slice8-providers` carries an unmerged
  rewrite of ACTIVE.md and a DOC-13 edit; when it merges, the lane section and the DOC-13
  rows must be carried over.
- Database, storage, Edge Function and Cashfree changes: none.
- Next: slice P0.

### 2026-11-13: Cashfree replies R6 and R7

- The owner pasted two Cashfree replies to the sixth mail. Stored word for word as R6 and
  R7 in the [original replies](../PHASE-7-8-cashfree-replies-original.md); thread file rows
  13 to 15 added; the sixth mail file notes it was sent (text as sent not pasted).
- Facts CF-91 to CF-95 added to the [fact record](../PHASE-7-8-cashfree-replies.md) with a
  "what these answers change" table; the [open questions](../PHASE-7-8-cashfree-questions-pending.md)
  have a new R6/R7 table.
- Checked against SDD 02 §7.2 and §11.6 and the pilot cut (N-06, N-08, §11.6): no change
  needed. CF-A35 is now answered "not possible by API", so the live-money block is lasting.
- Open for the owner: D-115's 24-hour pending-refund alert versus Cashfree's 5–7 working
  days (CF-93); to be checked on sandbox before any change.
- Database, storage, Edge Function and Cashfree changes: none.

### 2026-11-13: Cashfree docs search for the open questions

- Haiku searched the public docs for CF-A12, A16, A17, A18, A28, A29, A30, A31, A34 and
  A36; Opus checked the three new findings on the pages. Recorded as CF-96 (Get Order reads
  only the current and previous financial years), CF-97 (Easy Split charge on order amount,
  per the billing page) and CF-98 (Get On Demand Balance). CF-A27 closed by procedure
  (CF-95). Nothing new for A16, A17, A18, A28, A34; A29 still missing the two endpoints.
- CF-96 needs no pilot change: a `not_found` from the daily poll already changes no state
  and opens one admin case (pilot cut §11.2).
- The owner obtained the schema-only dump with local `pg_dump` 17.12 (P0 brief §1); the
  file is outside the repo.
- Database, storage, Edge Function and Cashfree changes: none.

## Migration ledger

Every migration of this lane, before it is applied to the dev project.

| Local filename | Live version | Project ref verified | Effects | Readback result |
|---|---|---|---|---|
| (none yet) | | | | |
