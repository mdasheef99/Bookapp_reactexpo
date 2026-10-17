# Clubs venue completion proposal

## Current routing — 2026-10-10 documentation refresh

The recorded primary-venue migrations `20261007144356` and `20261008091939`
were applied under their earlier explicit authorizations. Their readbacks and
test counts below remain dated evidence; they were not rerun here. Earlier
pre-application approval/next-action wording is historical and must not cause
either artifact to be replayed.

Current layout, navigation disposition, unapproved design drafts and remaining
verification/authorization gaps are owned by the
[current Clubs handoff](./TRACKER.md#current-handoff--2026-10-10-documentation-refresh).
This documentation refresh authorizes no source, permission, data or rollout change.

## 2026-10-08 primary-venue authorization migration applied

The user explicitly approved creation and Supabase MCP application, then renewed
approval after the first MCP call was cancelled. Readback after that cancellation
showed no correction ledger row and the original two policies; no retry was made
until renewed approval. Supabase MCP reverified ACTIVE_HEALTHY
Bookconnect_reactexpo, ahntbtktjjmvfosgkmgn (PostgreSQL 17.6.1.063), before applying.
Both Clubs and sibling Library trackers were checked; no active Library DDL was
recorded. Exact policy/RLS read-only preflight passed and name collision was zero.

Applied once through MCP as `20261008091939 clubs_primary_venue_write_authorization`.
Local file: `supabase/migrations/20261008091939_clubs_primary_venue_write_authorization.sql`.
CLI 2.116.0 generated initial local version 20261008090403; only the filename was
aligned to the returned live version. SHA-256 remains
`73FC0C028256B30710E6A11CD1E5E25376C975C0D4408C4DE1C10B964A3A47BD`.
The earlier applied 20261007144356 migration remains byte-for-byte unchanged
(SHA-256 CEB05DD30F00699933A6BC0BA55F729C529B830C9A675BE4F128186AC859B74C).
Exact artifact fixture: 61/61 PASS on disposable PostgreSQL 17.6; owned process,
port and temp-directory teardown verified. Independent GPT-6 Luna max artifact
review found no actionable issue; it was static and did not rerun the fixture.

Post-apply catalog readback confirms RLS enabled, five expected policies, old
owner ALL policy absent, eligibility/archive checks on primary INSERT and both
UPDATE predicates, owner SELECT/ordinary Add/Remove and member SELECT retained.
RPC/helper definitions and ACLs, table grants, unique indexes and zero noninternal
triggers are unchanged. No duplicate-primary club exists. Before/after link data
count/digest match (1 / 09cafd2e2ad21b6cfd6032490294d615); event ID/location
count/digest match (4 / 510a4c68c9088e55c07aea9bba54d3f4). Ledger is now 169 rows.
No business-data DML, Storage mutation, runtime deployment or Git publication.

Security advisors were run: existing project-wide notices remain; no club_venues
or primary-RPC notice was returned. The existing eligibility helper has the
SECURITY DEFINER execute advisory; its definition/ACL are unchanged and not
remediated here. Advisor output is not a clean whole-project security verdict.
Eligible direct writes remain allowed without RPC advisory-lock coordination;
existing TRUNCATE grants remain a separate audit. Connected primary-selection
submission after this migration is not claimed. Phase 9 Unit 6H/M62 runtime
rollout and connected proof pending state is unchanged; normal db push/history
repair remains frozen.

Active work unit: Clubs aggregate-review closeout/handoff. Exact next action:
review the exact combined local diff and select scoped commit contents before
any user-authorized commit; preserve mixed tracker edits and unrelated screenshot.
Do not reapply this migration. No staging, commit or push occurred.


Date: 2026-10-07. Status: the corrected Clubs-only primary-selection migration
is applied to the verified development database, and the local Manage Club >
Venues UI follow-through is implemented. The user authorized independent review
of the three-state Stitch proposal and local implementation for this page only.
The 2026-10-08 desktop/390×844 page and confirmation checks supersede the earlier
admin-screen browser limitation. Connected primary-selection proof remains
unverified. The originally proposed direct-write remedy was subsequently
approved and applied as `20261008091939`; its 2026-10-08 closeout is recorded
above. That application does not authorize another permission change.

The live-application closeout is recorded in
[PRIMARY-VENUE-MIGRATION-REVIEW.md](./PRIMARY-VENUE-MIGRATION-REVIEW.md). The
shared ledger reconciliation remains deferred; this targeted application did
not authorize normal `db push`, historical replay, or the pending July file.

The [pre-application live-versus-local audit](./VENUE-DATABASE-AUDIT.md)
documented the missing primary RPC/enforcement, the old RPC's broader moderator
permission, and the recorded migration-deployment hold. Public club identity already covers
every non-archived club type; the narrower public association rule below is a
proposal, not the live privacy contract. Member-authorized venue event reads
do not require a new visibility schema.

## Outcome and proposed behavior

1. Club administrators can add/remove linked approved venues and choose one
   linked venue as the club's primary venue. Preserve the admin-only contract
   in the venue feature specification and current Manage UI; the old local RPC's
   broader eligible-manager check must not silently expand that authority.
2. A club may have no primary venue, or one primary venue. Changing it supplies
   the default for a new event only after the creator chooses linked-venue mode.
   Saved events and explicit selections/drafts retain their chosen location.
3. Unlinking removes a venue from future club choices. Existing events retain
   their stored venue. Removing the primary clears that preference without
   automatically promoting another venue. Editing an event whose venue is no
   longer linked must still show/preserve its saved venue until the user changes it.
4. Venue details show safe summaries of public, non-archived associated clubs.
   Approval/invite-only associations are not exposed to nonmembers. Upcoming
   events are limited to the viewer's existing member authorization; public
   event visibility is not introduced by this proposal.
5. Keep the established ivory/white/burgundy palette, Newsreader/Inter typography,
   compact hierarchy, accessible controls, and existing navigation.

## Historical pre-application evidence and scope — 2026-10-07

- Manage > Venues currently shows Add, Remove and Primary labels, with primary
  selection unavailable. The service already calls `set_primary_club_venue`.
- VenueDetailScreen has no relationship query and renders a placeholder.
- ClubEventEditorScreen initializes saved `venue_id`, but its linked-venues
  effect switches to manual mode when there are no links. Its choices render
  only linked venues. Detached saved venues need explicit recovery handling.
- Pre-application read-only audit on 2026-10-07 verified healthy Bookconnect_reactexpo,
  project ahntbtktjjmvfosgkmgn. The primary RPC is absent; the existing boolean
  has no per-club primary uniqueness rule. There are currently zero clubs with
  multiple primary rows and zero null primary flags. These counts are audit
  evidence, not permission to change rows.
- Existing club-link writes check `book_clubs.admin_id`; related club-link reads
  are member-scoped and event reads require active/muted membership. Reconcile
  this with the eligible admin contract before proposing server authorization.
- The earlier catalog audit reported TRUNCATE privileges for anon/authenticated
  on venues, club_venues and club_events. Assess effective privileges and callers
  in a separate scoped grant review; no API exploitability is established.
- The unapplied local July migration also changes Exchange city handling and
  request_transaction. Do not apply it wholesale for this Clubs task. Resolve
  its place in migration replay/reconciliation before drafting a replacement.
- The Clubs and sibling Library trackers were read before this plan. Preserve
  Library/Exchange/Marketplace behavior; Phase 9 Unit 6H remains at
  M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING.

## Ordered delivery and verification

1. The user approved preparation of the primary-selection artifact. The bounded
   database review and test record is in
   [PRIMARY-VENUE-MIGRATION-REVIEW.md](./PRIMARY-VENUE-MIGRATION-REVIEW.md).
   Public relationship visibility and excess grants remain outside this scope.
2. Three Stitch artboards for Manage Club > Venues (normal, saving, error) were
   prepared from the current screen. The user authorized independent review in
   place of Astra critique for this page. All three existing artboards were
   reviewed; no blocking visual issue was found, and no canvas content changed.
   Earlier inspection checked the normal and saving frames at 390×844 and the
   error content in the accessibility tree.
3. The migration is exercised in a disposable local PostgreSQL fixture; 49/49
   checks pass. It tests missing/mixed policy families, current and historical
   policy drift, eligibility, concurrency, rollback, historical primary-RPC
   replacement, and preservation of existing event venues. The first reviewer
   completed an earlier artifact review. GPT-6 Luna max reasoning found two
   additional preflight gaps, now fixed and covered; its final review found no
   remaining artifact blocker and did not rerun tests. A later independent review
   found four more issues; the authorized correction adds literal-drift, row-wait
   revocation, actual detached-event preservation and shutdown-failure regressions.
   See the review record for the final READ COMMITTED checkpoint and its limits;
   eligibility is not fenced through transaction commit.
4. Astra critique was not requested: the user explicitly authorized an
   independent self-critique for this page. The pre-existing unsent Venue Picker
   prompt and both Stitch drafts remain untouched.
5. The user subsequently authorized one targeted migration application.
   Supabase MCP applied only the Clubs migration as
   `20261007144356 clubs_admin_primary_venue`; the local filename was aligned to
   that version. Post-apply schema/permission readback is recorded in the review
   and audit. The shared-ledger hold remains for normal `db push`, replay, and
   history repair. Relationship lists, grant remediation, and detached-event
   recovery remain separate.
6. The page-local UI now calls the existing admin-gated primary-selection path,
   preserves pending feedback until refreshed linked-venue data confirms the
   target, and offers inline recovery after selection or confirmation failure.
   Focused tests, TypeScript, web export, and independent review are complete;
   see [PRIMARY-VENUE-APP-REVIEW.md](./PRIMARY-VENUE-APP-REVIEW.md). Runtime
   desktop and 390×844 page/Cancel/Escape checks were completed on 2026-10-08.
   Connected primary-selection writes and external-removal browser reproduction
   remain unverified; automated regressions cover the latter locally.
   Confirm any live write only with separately authorized development fixtures.
7. Record verification and residual gaps; commit/publish only when authorized.

## Historical authority and next action — before the policy correction apply

The subsequent user-authorized bounded UI correction resolves three lifecycle
findings: pending feedback survives early cache updates; missing/unreadable
target rows retain recovery with reselection/Add guidance; and club/account
changes isolate query observers and fence old responses. The final confirmation
requires matching club/venue identity, primary state, and renderable venue
details. The correction does not cancel an already-submitted RPC. Evidence and
remaining visual/connected limits are owned by
[the app correction record](./PRIMARY-VENUE-APP-REVIEW.md#bounded-ui-correction-2026-10-07).

Authorized completed scope: local migration/test preparation and correction,
one targeted primary-venue migration application and readback, and the
page-scoped Stitch self-review and local Manage Club > Venues implementation.
No relationship listing, detached-event recovery, business row, Storage,
permission, or historical ledger-repair change occurred. The exact next action
is owner approval to create the forward policy migration described in
[the verified proposal](./PRIMARY-VENUE-AUTHORIZATION-PROPOSAL.md). Live application,
Git publication, and any other page remain separately gated. The existing
unsent design prompt and Stitch drafts remain preserved.

## Remove decision (2026-10-08)

The user approved a confirmation dialog before unlinking a venue. This is a
local UI change using the existing unlink mutation. Cancel submits nothing;
primary removal explains that the club has no primary unless another is selected. Current evidence
and exact next action are in [the Clubs tracker](./TRACKER.md). No schema or
permission change is required for this confirmation.
