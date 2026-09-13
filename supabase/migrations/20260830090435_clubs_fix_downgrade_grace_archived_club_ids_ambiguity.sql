-- ============================================================
-- CLUBS REMEDIATION — WU-TC01 FORWARD BUG FIX (requires approval)
-- public.process_club_downgrade_grace_period SQLSTATE 42702 fix
-- Project: ahntbtktjjmvfosgkmgn · Branch: feat/clubs-ui-overhaul
-- ============================================================
--
-- DEFECT (proven in WU-TC01 context gate, disposable PostgreSQL 17):
--   The RETURNS TABLE clause of process_club_downgrade_grace_period
--   implicitly declares an OUT parameter named archived_club_ids.
--   In the existing-warning grace-event UPDATE, the SET RHS expression
--   "then archived_club_ids else clubs_to_archive end" collides between
--   that OUT parameter and the target table column
--   public.club_downgrade_grace_events.archived_club_ids.
--   With the default plpgsql.variable_conflict=error, EVERY non-dry-run
--   invocation that reaches the existing-warning UPDATE fails with
--   SQLSTATE 42702 (column reference "archived_club_ids" is ambiguous):
--   both the benign repeat-before-deadline refresh AND expired-deadline
--   remediation. Remediation is therefore unreachable: the book_clubs
--   archive UPDATE executes first, then the grace-event UPDATE aborts
--   the whole transaction, rolling the archive back (no partial
--   remediation persists — proven).
--
-- FIX (forward bug fix, NOT historical reconciliation):
--   Qualify the RHS reference to the target table column. Semantics are
--   unchanged: the reference reads the same row being updated (id =
--   existing_event.id), so "keep prior ids when nothing archived" is
--   preserved exactly. No other body change.
--
-- CONTRACT PRESERVATION (WU-TC01 invariants):
--   * Identity (uuid, integer, boolean), parameter names, and defaults
--     (NULL, 14, false) unchanged.
--   * RETURNS TABLE column names/order/types unchanged (generated types
--     and Edge `results` consumption depend on them).
--   * LANGUAGE plpgsql, SECURITY DEFINER, SET search_path = public,
--     volatility, and owner behavior unchanged.
--   * EXECUTE contract unchanged: PUBLIC/anon revoked, service_role
--     granted (re-stated below; CREATE OR REPLACE preserves existing
--     ACL/owner for the same identity — verified empirically).
--   * Cron job `club-downgrade-grace-period` calls the function by name
--     and picks up this replacement automatically; no cron change.
--   * Table, RLS, indexes, notification triggers untouched.
--   * Tier caps (free=0, pro=5, pro_plus=15), qualifying-club predicate
--     (admin_id + coalesce(is_archived,false)=false), archive ordering
--     (created_at DESC NULLS LAST, id DESC, OFFSET allowed_count), and
--     archive write set (is_archived, archived_at=coalesce(archived_at,
--     now()), updated_at) unchanged.
-- ============================================================

create or replace function public.process_club_downgrade_grace_period(
  p_user_id uuid default null,
  p_grace_days integer default 14,
  p_dry_run boolean default false
)
returns table (
  user_id uuid,
  membership_tier text,
  current_count integer,
  max_allowed integer,
  status text,
  grace_deadline_at timestamptz,
  archived_club_ids uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_record record;
  active_count integer;
  allowed_count integer;
  existing_event public.club_downgrade_grace_events;
  clubs_to_archive uuid[];
  next_status text;
  deadline timestamptz;
begin
  if p_grace_days < 1 or p_grace_days > 90 then
    raise exception 'p_grace_days must be between 1 and 90';
  end if;

  for profile_record in
    select up.user_id, coalesce(up.membership_tier, 'free') as membership_tier
    from public.user_profiles up
    where up.user_id is not null
      and (p_user_id is null or up.user_id = p_user_id)
  loop
    allowed_count := case profile_record.membership_tier
      when 'pro_plus' then 15
      when 'pro' then 5
      else 0
    end;

    select count(*)::integer into active_count
    from public.book_clubs bc
    where bc.admin_id = profile_record.user_id
      and coalesce(bc.is_archived, false) = false;

    select * into existing_event
    from public.club_downgrade_grace_events ev
    where ev.user_id = profile_record.user_id
      and ev.status = 'warning'
    order by ev.first_detected_at desc
    limit 1;

    if active_count <= allowed_count then
      if existing_event.id is not null and not p_dry_run then
        update public.club_downgrade_grace_events
        set status = 'compliant',
            membership_tier = profile_record.membership_tier,
            current_count = active_count,
            max_allowed = allowed_count,
            last_checked_at = now(),
            metadata = metadata || jsonb_build_object('resolved_reason', 'count_within_limit')
        where id = existing_event.id;
      end if;

      user_id := profile_record.user_id;
      membership_tier := profile_record.membership_tier;
      current_count := active_count;
      max_allowed := allowed_count;
      status := 'compliant';
      grace_deadline_at := coalesce(existing_event.grace_deadline_at, now() + make_interval(days => p_grace_days));
      archived_club_ids := '{}';
      return next;
      continue;
    end if;

    deadline := coalesce(existing_event.grace_deadline_at, now() + make_interval(days => p_grace_days));
    clubs_to_archive := '{}';
    next_status := 'warning';

    if deadline <= now() then
      select coalesce(array_agg(id), '{}') into clubs_to_archive
      from (
        select bc.id
        from public.book_clubs bc
        where bc.admin_id = profile_record.user_id
          and coalesce(bc.is_archived, false) = false
        order by bc.created_at desc nulls last, bc.id desc
        offset allowed_count
      ) excess;

      if not p_dry_run and array_length(clubs_to_archive, 1) is not null then
        update public.book_clubs
        set is_archived = true,
            archived_at = coalesce(archived_at, now()),
            updated_at = now()
        where id = any(clubs_to_archive);

        next_status := 'remediated';
      end if;
    end if;

    if existing_event.id is null then
      if not p_dry_run then
        insert into public.club_downgrade_grace_events (
          user_id, membership_tier, current_count, max_allowed, status, grace_deadline_at,
          remediated_at, archived_club_ids
        )
        values (
          profile_record.user_id, profile_record.membership_tier, active_count, allowed_count,
          next_status, deadline,
          case when next_status = 'remediated' then now() else null end,
          clubs_to_archive
        );
      end if;
    elsif not p_dry_run then
      update public.club_downgrade_grace_events
      set membership_tier = profile_record.membership_tier,
          current_count = active_count,
          max_allowed = allowed_count,
          status = next_status,
          last_checked_at = now(),
          grace_deadline_at = deadline,
          remediated_at = case when next_status = 'remediated' then now() else remediated_at end,
          -- WU-TC01 FIX: qualify the target-table column so the reference
          -- cannot resolve to the RETURNS TABLE OUT parameter (42702).
          archived_club_ids = case when array_length(clubs_to_archive, 1) is null then club_downgrade_grace_events.archived_club_ids else clubs_to_archive end
      where id = existing_event.id;
    end if;

    user_id := profile_record.user_id;
    membership_tier := profile_record.membership_tier;
    current_count := active_count;
    max_allowed := allowed_count;
    status := next_status;
    grace_deadline_at := deadline;
    archived_club_ids := clubs_to_archive;
    return next;
  end loop;
end;
$$;

revoke all on function public.process_club_downgrade_grace_period(uuid, integer, boolean) from public;
revoke all on function public.process_club_downgrade_grace_period(uuid, integer, boolean) from anon;
grant execute on function public.process_club_downgrade_grace_period(uuid, integer, boolean) to service_role;
