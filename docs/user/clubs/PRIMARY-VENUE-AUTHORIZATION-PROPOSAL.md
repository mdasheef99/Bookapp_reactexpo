# Primary venue direct-write correction proposal

Date: 2026-10-08. Status: owner-authorized correction APPLIED through MCP as
20261008091939 clubs_primary_venue_write_authorization. The local filename matches
the live version; see the tracker application record for preflight/hash/readback.
The SQL below is the reviewed source of that applied artifact. Do not reapply it.

## Confirmed pre-application live evidence

Supabase MCP reconfirmed `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`) as
ACTIVE_HEALTHY on PostgreSQL 17.6. Read-only catalog inspection found exactly
two club_venues policies: member SELECT and owner-based ALL. `authenticated`
and `anon` have UPDATE grants; no noninternal trigger exists on the table.
The owner-based ALL policy can authorize an ineligible or archived owner to
update primary flags directly, even though the RPC refuses that selection.
The anon grant alone does not establish API exploitability: owner authorization
still requires a matching auth.uid(). No live business write was attempted.

The current RPC and can_user_hold_club_role definitions were read back. The
admin helper checks ownership, Pro/Pro+ tier, and club access level. It does
not require an active membership row; the earlier review's active-role wording
was inaccurate. The RPC additionally refuses archived clubs.

## Proposed correction and compatibility

Replace the permissive ALL policy with operation-specific policies. Preserve
owner reads, ordinary Add (`is_primary=false`) and Remove. Require the RPC's
ownership/entitlement/archive conditions on every UPDATE and on INSERTs that
set `is_primary=true`; protecting UPDATE alone leaves an INSERT bypass.
Keep member SELECT, RPC invoker mode/ACLs, grants, event rows, foreign keys and
the unique index unchanged. Local caller search found primary selection as the
only club_venues UPDATE path; Add uses INSERT false and Remove uses DELETE.

The proposed checks apply at normal statement snapshots. They do not promise
eligibility fencing through transaction commit or serialize direct writes with
the RPC's advisory lock. The unique index still protects at most one primary.
Superuser/service bypass and unrelated TRUNCATE/grant remediation remain outside
this correction. A primary remains optional, including after unlinking.

Policy shape drift must abort preparation/application for a fresh audit.
Before creating a forward migration, read both Clubs and sibling Library
trackers and reverify this exact project's catalog. Before live application,
reverify the catalog and obtain separate approval. Preserve the applied
20261007144356 migration byte-for-byte; do not replay or edit it.

## Reviewable SQL proposal

The disposable PostgreSQL fixture can execute this block with
`--verify-authorization-proposal`. This block records the applied correction,
not permission to replay it against Supabase.

```sql
BEGIN;
LOCK TABLE public.club_venues IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'public.club_venues'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Venue-link row security is disabled; re-audit before proceeding' USING ERRCODE = '55000';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policy
      WHERE polrelid = 'public.club_venues'::regclass) <> 2
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_policy
       WHERE polrelid = 'public.club_venues'::regclass
         AND polname = 'Admins can manage club venues' AND polcmd = '*'
         AND polpermissive AND polroles = ARRAY[0::oid]
         AND polwithcheck IS NULL
         AND pg_catalog.pg_get_expr(polqual, polrelid) =
           E'(EXISTS ( SELECT 1\n   FROM book_clubs\n  WHERE ((book_clubs.id = club_venues.club_id) AND (book_clubs.admin_id = auth.uid()))))'
     ) OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_policy
       WHERE polrelid = 'public.club_venues'::regclass
         AND polname = 'Members can view club venues' AND polcmd = 'r'
         AND polpermissive AND polroles = ARRAY[0::oid]
         AND polwithcheck IS NULL
         AND pg_catalog.pg_get_expr(polqual, polrelid) =
           E'(EXISTS ( SELECT 1\n   FROM club_members\n  WHERE ((club_members.club_id = club_venues.club_id) AND (club_members.user_id = auth.uid()))))'
     ) THEN
    RAISE EXCEPTION 'Venue-link policy drift; re-audit before proceeding' USING ERRCODE = '55000';
  END IF;
END;
$preflight$;
DROP POLICY "Admins can manage club venues" ON public.club_venues;
CREATE POLICY "Owners can read club venues" ON public.club_venues
  FOR SELECT TO public USING (
    EXISTS (SELECT 1 FROM public.book_clubs bc
      WHERE bc.id = club_venues.club_id AND bc.admin_id = auth.uid())
  );
CREATE POLICY "Owners can add club venues" ON public.club_venues
  FOR INSERT TO public WITH CHECK (
    EXISTS (SELECT 1 FROM public.book_clubs bc
      WHERE bc.id = club_venues.club_id AND bc.admin_id = auth.uid()
        AND (NOT coalesce(club_venues.is_primary, false) OR (
          NOT coalesce(bc.is_archived, false)
          AND public.can_user_hold_club_role(auth.uid(), bc.id, 'admin')
        )))
  );
CREATE POLICY "Owners can remove club venues" ON public.club_venues
  FOR DELETE TO public USING (
    EXISTS (SELECT 1 FROM public.book_clubs bc
      WHERE bc.id = club_venues.club_id AND bc.admin_id = auth.uid())
  );
CREATE POLICY "Eligible owners can update club venues" ON public.club_venues
  FOR UPDATE TO public USING (
    EXISTS (SELECT 1 FROM public.book_clubs bc
      WHERE bc.id = club_venues.club_id AND bc.admin_id = auth.uid()
        AND NOT coalesce(bc.is_archived, false)
        AND public.can_user_hold_club_role(auth.uid(), bc.id, 'admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.book_clubs bc
      WHERE bc.id = club_venues.club_id AND bc.admin_id = auth.uid()
        AND NOT coalesce(bc.is_archived, false)
        AND public.can_user_hold_club_role(auth.uid(), bc.id, 'admin'))
  );
COMMIT;
```

## Verification and next action

The disposable PostgreSQL 17.6 fixture passes 61/61 with this proposal, including
the original 49 checks, a local bypass reproduction, policy and disabled-RLS drift rejection, direct
UPDATE/primary INSERT denials for downgraded/access-mismatched/archived owners,
ordinary Add/Remove preservation, owner reads without membership, eligible RPC
and uniqueness behavior, reassignment WITH CHECK, and member/moderator denials.
Owned process exit, port closure and generated-temp-data removal were verified.
Independent review is recorded in the Clubs tracker and app review after
completion. The exact artifact passed 61/61 before MCP application; post-apply
readback confirms the five intended policies and unchanged existing data.
Next action: aggregate local-diff review for a separately authorized commit.
No migration replay is authorized.
