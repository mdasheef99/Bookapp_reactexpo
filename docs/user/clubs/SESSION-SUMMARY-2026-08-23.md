# Clubs Remediation — Session Summary 2026-08-22/23

## Final issue register status (40 findings)

### ✅ RESOLVED (30)
**Backend/security (live-applied + verified):**
- CLUB-BACKEND-01 — banner Storage lockdown (club-admin-gated policies)
- CLUB-BACKEND-02 — creation-cap TOCTOU race (namespaced advisory xact lock)
- CLUB-BACKEND-03 — resolved_by server-pinned (trigger)
- CLUB-BACKEND-04 — cancelled_by server-pinned (trigger + client stop sending)
- CLUB-BACKEND-05 / PRODUCT-05 — invitation expiry (column, backfill, sync RPC gate)
- CLUB-HIER-02 — target active-membership guard in issue_club_member_action
- CLUB-HIER-03 / PRODUCT-HIER-P04 — self-moderation prohibited

**Client functional:**
- CLUB-CACHE-01 — useUpdateClub invalidates manageDetail
- CLUB-FUNC-01 — report flow wired (overflow menu + reason sheet)
- CLUB-FUNC-02 / PRODUCT-11 — un-vote toggle
- CLUB-FUNC-03 / PRODUCT-12 — un-react toggle
- CLUB-UX-02 — create-club flow simplified per PRODUCT-14 (partial; full failure UX remains open under SDD-01 polish)

**Type contracts:**
- CLUB-TYPE-03 / TYPE-03-d — DB CHECK enforcing canonical 11 emojis (+2 mojibake rows removed)

**Test debt:**
- CLUB-TEST-03 — bug-protecting useUpdateClub test corrected

**Audit closures (no action needed):**
- CLUB-BACKEND-06 — transfer_club_admin does not exist live; zero references → NO-ACTION
- CLUB-BACKEND-07 — RSVP live-vs-replay audit: zero drift → NO-ACTION
- CLUB-HIER-01 — role CHECK constraint **already existed live since ~March 2026** via untracked manual DDL (club_members_role_check). Register finding was stale. Today's club_members_role_canonical addition is a redundant duplicate (harmless; can be dropped for cleanliness).

**Product decisions settled:** PRODUCT-01..14 non-blockers retained; 7 blockers adopted per DECISIONS.md.

### ⏳ PENDING (7 items + deferred)

1. **CLUB-TYPE-01/02 + CLIENT-01** — Supabase Database type generation (scope-gated), widen TS emoji union 5→11, address 6 production `any`s. MEDIUM.
2. **CLUB-TYPE-04** — ReactionSummary.users non-enumerable semantics vs type. SMALL (needs behavioral decision).
3. **CLUB-TYPE-05** — guarded replyId! assertion cleanup. SMALL.
4. **CLUB-CACHE-02** — imperative viewer-tier fetches → React Query hooks. SMALL-MEDIUM.
5. **UI/UX debt** — UI-01..03, UX-01, DEBT-01: absorbed into SDD-01 phases. LARGE (phased).
6. **L01/TEST-01..08** — L4 executable contract suite incl. B02 race-proof test. LARGE. First entry: parallel create-at-cap race test.
7. **SDD-01 P1–P5** — UI overhaul implementation. LARGE (awaiting user Phase-1 go).

**Deliberately deferred:** PERF-01..03 (scale-gated).

## Live DB changes applied this session (all readback-verified)
1. trg_enforce_club_complaint_resolution (B03)
2. trg_pin_club_event_cancellation (B04)
3. enforce_book_club_entitlement rewrite with 'club-cap:' advisory lock (B02)
4. issue_club_member_action rewrite with HIER-02+P04 guards
5. accept_club_invitation rewrite with synchronous expiry gate (BACKEND-05)
6. club_invitations.expires_at column + default + legacy backfill
7. Storage club-banners: 7 policies dropped, 4 club-scoped created (B01)
8. club_discussion_reactions emoji canonical CHECK + 2 mojibake rows removed (TYPE-03)
9. club_members_role_canonical CHECK added (redundant with pre-existing role_check — candidate for drop)

## Git state
- clubs tree: commit 3780630 pushed to origin/feat/clubs-ui-overhaul. Uncommitted: only docs/user/clubs/SDD-01-ui-overhaul.md (pre-existing draft).
- library tree: F1 complete but UNCOMMITTED (40 files) — user's next session.

## Open user decisions
- Drop redundant club_members_role_canonical? (cosmetic)
- Commit library F1 checkpoint?

## Verification state
- Clubs Jest 18/18 suites 190/190 PASS; tsc --noEmit 0 errors (at commit time).
- All DB changes have post-apply SQL readbacks recorded in TRACKER.md ledger.
- End-to-end app-level sanity pass NOT yet completed (browser automation aborted; manual pass pending).
