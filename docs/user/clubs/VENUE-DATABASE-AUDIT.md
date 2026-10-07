# Venue database comparison

Date: 2026-10-07. Scope: user-authorized read-only comparison. Live database
state is authoritative for what exists. Proposed changes are not approvals.

The comparison below records the pre-application baseline. See the
post-application readback overlay for the current primary-venue state.

## Method and environment

Supabase MCP get_project reconfirmed healthy Bookconnect_reactexpo,
ahntbtktjjmvfosgkmgn, PostgreSQL 17.6. Catalog queries inspected columns,
constraints/indexes, policies/RLS, relevant function definitions/ACLs,
ordinary/materialized views, user triggers, grants and effective privileges.
The live ledger has 167 migrations. Aggregate row checks found zero clubs with
multiple primary venues and zero null primary flags. No identifying business
rows were returned.

Local searches covered all migration SQL and repository SQL for club_venues,
primary saving and relationship projections. Services/hooks, Manage access
gates, event editor and the existing reconciliation record were inspected.
This is not a full migration replay/hash audit, actor authorization test, API
exploitability test or running-browser feature verification.

## Comparison and consequences

| Item | Live truth | Local comparison / consequence |
| --- | --- | --- |
| Link table | club_venues has club_id, venue_id, nullable is_primary default false, validated FKs and pair PK; RLS enabled. | Original 003 migration creates it. Reuse it; no new link table needed. |
| Primary saving | set_primary_club_venue absent. | July 20260714000001 defines it; app service/hook calls it; Manage hides the button. Live capability is missing. |
| Single-primary rule | No unique-primary index/constraint or custom link trigger; no present violations. | No equivalent local SQL enforcement found. July RPC locks the club and switches flags, but direct table writes can bypass its coordination. |
| Primary permissions | Link ALL policy checks book_clubs.admin_id, without a subscription eligibility check. | Manage is admin-only, though its gate also accepts membership role admin. July RPC uses is_active_eligible_club_manager; live helper includes eligible active moderators. Applying it unchanged would broaden venue authority relative to the admin-only feature contract. |
| Link-policy replay | SELECT accepts any membership row regardless of status; admin ALL policy also permits reading. | Local 008 policy uses legacy lead membership for writes and different names. Pre-010 field/role reconciliation does not replace it. Current admin-id link policy is not reproduced by the local SQL searched. Record this drift rather than replaying old policies on live. |
| Public club identity | club_public_details exists, security_invoker=true; anon/authenticated can SELECT. View and base read policy allow non-archived clubs of every type. | 010 and subsequent view/grant migrations support it; clubsReadService uses it. Approval/invite-only/author club identities already have public summaries. Their venue associations and events are separate access surfaces. |
| Relationship projection | No dedicated venue relationship function or ordinary/materialized view found. Custom-schema function search found no venue-named function or function referencing club_venues. | No dedicated relationship projection found in local SQL. VenueDetailScreen has only a venue-facts query and a placeholder. Public association visibility still needs a product decision. |
| Venue events | Event SELECT requires active/muted membership; event venue_id references venues directly, independently of club_venues. | A venue-filtered member query can retain current RLS without adding public event visibility. A public-events feature would require a separate contract/database change. |
| Detached saved venue | Live event FK does not depend on the club link. | Editor hydrates saved venue_id, but switches to manual mode if links are empty and renders linked choices only. Saved-venue preservation/presentation needs app handling, not a new FK. |
| Excess privileges | has_table_privilege confirms TRUNCATE for anon/authenticated on venues, club_venues and club_events. | Database-level privilege concern confirmed. No destructive query or API reachability test attempted. A separate reviewed grant cleanup is needed before calling it resolved. |

## Pre-application migration history dependency

[Reconciliation authority](../../deployment/MIGRATION-RECONCILIATION-2026-09.md)
records shared history drift and a deliberate freeze on normal production
migration deployment. It classifies July 20260714000001 as genuinely unapplied.
Current catalog and ledger agree: missing primary RPC, no venues city_key,
and no matching ledger version/name. Other local migration filenames can have
live timestamp aliases, so a filename mismatch alone is not proof of absence.

The July file also changes Exchange city handling and request_transaction.
Do not apply it wholesale for Clubs. Its disposition and correct final state
under clean replay need review before drafting a replacement. This audit does
not lift the deployment hold or reconcile the full shared ledger.

## Remaining scope after primary migration application

1. The primary-selection schema is now applied and read back. Before enabling
   the Manage UI, review the approved interaction design and authorize the
   separate app implementation; preserve the documented admin-only RPC boundary.
2. Decide public association visibility. A public-safe association projection
   needs a migration; member-authorized relationships/events can use current
   RLS and new app queries. Publishing only club_type=public associations is a
   prior proposal, not the live identity contract.
3. Review unnecessary grants separately; preserve base member read boundaries.
4. Verify authorization, concurrency, privacy and replay on disposable
   PostgreSQL before any separately authorized live application.

At the time of the initial pre-application audit, no code, migration file,
schema/policy, database data, Storage, ledger repair, commit, push, or deployment
had changed. Only audit/proposal/tracker docs changed in that audit checkpoint.

## Local artifact correction overlay (2026-10-07)

The authorized local correction changes only the unapplied primary migration,
disposable fixture and evidence documents. It preserves live policy predicates
and grants; no live catalog or row was mutated. Exact policy comparisons retain
SQL literals. A final READ COMMITTED authorization checkpoint rejects revocations
completed during link-row waits with rollback; this does not fence entitlement
through commit or repair direct-write permissions. The 49/49 disposable checks
include actual detached-event preservation and injected shutdown-failure outcomes.
Details and rollout gates remain in
[the migration review](./PRIMARY-VENUE-MIGRATION-REVIEW.md).

## Post-application readback (2026-10-07)

After explicit user authorization, the Clubs-only primary-venue migration was
applied to the verified project as `20261007144356 clubs_admin_primary_venue`.
Readback confirms the partial unique index on `club_venues(club_id)` for primary
rows, the invoker RPC with empty `search_path`, and authenticated-only EXECUTE.
The live venue-link policies retain their exact pre-application predicates;
there are still zero clubs with multiple primary rows. The migration ledger has
168 rows and ends at `20261007144356`; M62 remains at `20260913162154`.

The July migration remains unapplied and both Exchange `city_key` columns remain
absent. No event venue IDs, business rows, direct table permissions, or Storage
objects were changed. The shared history-reconciliation hold still blocks normal
production `db push` and historical replay; no repair entries were changed.
