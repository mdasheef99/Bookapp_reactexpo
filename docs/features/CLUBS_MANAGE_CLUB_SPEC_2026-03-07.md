# Clubs Manage Club Scope — 2026-03-07

## Role of this document

This document defines the **Manage Club** scope for BookTalks Mobile using the current audited/remediated Clubs baseline from `2026-03-07`.

> **Historical snapshot note (2026-05-25):** This file remains the Manage Club scope baseline from the March remediation. For current implementation status, including Create Club, invite revoke/read-state, reading progress, and venue picker updates, use `docs/features/CLUBS_IMPLEMENTATION_INVENTORY.md` and `docs/audits/CLUBS_PENDING_INVENTORY_2026-04-24.md`.

Use this together with:
- `docs/features/CLUBS_SPEC_2026-03-06_234839.md` for canonical Clubs intent and roadmap.
- `docs/features/CLUBS_IMPLEMENTATION_STATUS_2026-03-07.md` for current repo reality.
- `docs/features/CLUBS_LIVE_BACKEND_CONTRACT_2026-03-07.md` for verified live backend support and gaps.

## Current baseline

- The current `app/(tabs)/clubs/[clubId]/manage.tsx` screen is still primarily organized around **join-question management**.
- A deeper basic settings slice now exists on that screen, including member-cap editing.
- Admin-only member-role management and remove-member workflows now exist on the current member list in that screen.
- Full club management is still **partial**.
- The clearest broader full-management areas already implied by the audited state are:
  - deeper settings refinement
- Invitation lifecycle backend support has since landed live:
  - `revoke_club_invitation`
  - `mark_invitation_read`
  - `club_invitations.read_at`

## 2026-03-08 status framing

### Implemented baseline

- the current Manage Club baseline remains a narrow admin surface composed of:
  - join-question management
  - the first basic settings slice
  - admin-only member-role toggles and remove-member actions
  - separate application-review and invite-manager routes

### Validated in this session

- the authenticated Clubs baseline needed to reach Manage Club work now uses a single-number real-session dev login
- the current real-session baseline was strong enough to re-validate public join, approval apply, and member-list gating around the seeded Clubs data

### Partially implemented or not yet re-verified in this session

- the `manage` route itself was not re-walked end to end in this session, so treat the current settings/member-role/remove-member surface as implemented from the audited baseline rather than newly validated here
- invite acceptance remains implementation-backed but not re-verified in this session because the dev login user had no fresh pending invite

### Out of scope / unsupported

- invitation revoke and invitation read-state/inbox flows
- full club-admin dashboard claims beyond the current narrow routes
- archive/delete/ownership-transfer claims

## What “Manage Club” means in this doc

Manage Club means **managing one specific club as a moderator/admin**, not broader Clubs discovery, member participation, or store/platform operations.

### Canonical role framing for current mobile

- Keep the current audited/spec role model: `member | moderator | admin`.
- Treat pending application as a **membership state**, not a durable management role.
- Do **not** replace `admin` with `lead` in the current mobile docs unless the canonical role model is intentionally changed later.
- Treat store/platform managers as **external operational scopes**, not the core Manage Club role model.

### Practical hierarchy reference for current mobile

- `admin` = highest club-scoped role in the current mobile baseline.
- `moderator` = delegated helper role below admin; useful as a reference concept, but still only **partially implemented** as a clean independent management experience.
- `member` = standard participant role, not a management role.
- pending applicant / non-member = membership states outside the club-management role ladder.

## Current mobile management surfaces

Current club-management functionality is split across multiple routes:
- `app/(tabs)/clubs/[clubId]/applications.tsx` — application review
- `app/(tabs)/clubs/[clubId]/invite.tsx` — manager invitation creation/history
- `app/(tabs)/clubs/[clubId]/manage.tsx` — the current tabbed management surface for current-book workflows, lightweight analytics, events administration, settings, members, and join-question management

The current **Manage Club** button/entry should therefore be understood as **a real but still intentionally bounded club-admin surface**, not a complete club-governance dashboard.

## Accepted Manage Club scope for the current application

### Implemented now

These items fit the **current mobile management reality** and should be treated as the active Manage Club baseline:

- join-question CRUD
- current settings slice:
  - metadata editing
  - privacy / access rule editing
  - cover photo URL field
  - member-cap editing
  - meeting format editing
  - current saved-state summary, reset affordance, and member-cap / cover-URL validation
- admin-only member-role management from the current member list:
  - assign moderator
  - remove moderator
  - mute / unmute member
  - remove member
- application review for pending join requests
- review of join-question answers during application decisions
- manager invitation creation/listing by username
- current-book management:
  - view current book from Manage Club
  - finalize a closed nomination as current book
  - set an active nomination as current book
  - manual current-book override via nomination-backed shortcut flow
- admin event administration from Manage Club:
  - create event
  - edit event
  - cancel event
  - delete cancelled/past event
- lightweight analytics:
  - member / moderator counts
  - active nominations count
  - upcoming / past event counts
  - current-book summary

These items are **implemented**, but only the surrounding authenticated Clubs baseline (login + join/apply/member gating) was freshly validated in this session.

### Future Manage Club scope

These items fit the **intended near-term roadmap** for fuller club management, but they are **not yet implemented** in the current client:

- deeper settings refinement beyond the current basic slice
- moderator event-management parity with the live backend capability model
- richer analytics / reporting beyond the current summary cards

## Broader Clubs scope, but not Manage Club

These areas belong in the overall Clubs product, but they should not define the Manage Club area itself:

- club discovery / browse
- public club detail presentation
- user join / apply / pending / cancel flows
- member chat / discussion participation
- member event viewing / RSVP consumption
- current-book display
- nominations and voting as reader engagement
- member-list viewing as a member experience
- permissions / access control as a cross-cutting Clubs model

## Not adopted into the current mobile baseline

These items were proposed in the source material, but they do **not** suit the current audited/spec baseline closely enough to carry forward as accepted mobile Manage Club scope:

- replacing canonical `admin` ownership terminology with `Club Lead`
- treating store-level managers as part of the normal club-scoped mobile role model
- treating platform-admin workflows as part of the normal mobile Clubs scope
- treating leadership transfer as a standard current Manage Club feature
- treating advanced analytics/reporting as part of the accepted current or near-term mobile Manage Club roadmap
- treating archive club as part of the accepted current or near-term mobile Manage Club roadmap

## Blocked or dependent on backend or product decisions

These items should stay explicitly marked as blocked or dependent, not merged into supported scope:

- invitation revoke workflow -- backend support is live; keep manual lifecycle validation explicit
- invitation read-state / inbox workflow -- backend support is live; invitee inbox UX remains pending
- granular moderator permission UI — needs explicit product-policy cleanup before implementation
- current-book workflow rules — still need product clarification if nominations remain the source of truth
- moderator event-management parity — backend support now exists, but the current manage UI still restricts the events tab/actions to admins
- delete lifecycle actions — need explicit governance and safety UX decisions
- advanced event analytics / reminders — need broader product-scope decisions before implementation

## Source feature-group disposition

| Item | Current disposition |
|---|---|
| Roles | Keep `member / moderator / admin` only; reject `Club Lead` replacement and external ops roles for the current mobile baseline. |
| A. Club discovery / browse | Broader Clubs scope, not Manage Club. |
| B. Club detail | Broader Clubs scope; may expose management entry points. |
| C. Joining / applications / invitations | Split: user join/apply belongs elsewhere; manager application review and invite tooling are current Manage Club; revoke/read-state remain blocked. |
| D. Discussions / chat | Broader Clubs scope; later moderation tooling is management-adjacent but not core Manage Club. |
| E. Events / meetings | Split: member viewing belongs elsewhere; admin event administration is now part of current Manage Club, while moderator parity and richer event tooling remain future work. |
| F. Current book management | Split: current-book display belongs elsewhere; admin current-book management is now part of current Manage Club, while the long-term product rules remain unsettled. |
| G. Nominations | Broader Clubs scope; only nomination-based current-book rules affect management planning. |
| H. Member management | Split: join-request review and remove-member now fit current Manage Club; leadership transfer is not adopted into the current baseline. |
| I. Moderator management | Partially implemented now via admin-only member-list role toggles; granular permissions remain blocked/future. |
| J. Club settings | Partially implemented now and still the clearest next expansion area. |
| K. Analytics / reporting | Lightweight summary analytics are now implemented in Manage Club; richer reporting remains outside the accepted near-term scope. |
| L. Moderation / content controls | Later management-adjacent scope, not current core Manage Club. |
| M. Ownership / transfer / archive / delete | Not adopted into the current mobile Manage Club roadmap: archive and delete need separate lifecycle/governance decisions, and transfer is not part of the current v1 owner model. |
| N. Permissions / access control | Broader Clubs foundation, not a user-facing Manage Club feature area. |

## Recommended expansion path

### Stage 1 — current narrow management baseline

- applications review
- invitation creation/history
- moderator assignment
- mute / unmute member
- remove-member workflows
- current basic settings slice
- join-question management
- current-book management
- admin event administration
- lightweight analytics

### Stage 2 — club-admin essentials

- refine and extend the current basic settings slice
- deepen metadata and cover management beyond the initial fields
- align moderator event-management UX with the live backend capability model
- define richer analytics/reporting and reminder needs

### Stage 3 — broader management and governance

- moderator assignment/removal
- delegated moderator permissions
- moderation dashboard / report queues

## Single most justified next product/documentation step

Treat the current `manage` route and button copy as **a bounded tabbed management surface** with current-book, events, settings, membership, invitations/applications, and join-question workflows, while continuing the next full-management expansion around:

- deeper settings refinement
- moderator permission/event-management alignment
- invitation revoke/read-state support

That is the cleanest remaining Manage Club path from the current audited implementation.
