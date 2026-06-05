-- Club downgrade grace-period tracking and conservative remediation.
-- This never mutates Supabase Auth users; it only records grace status and archives
-- excess active clubs after the configured grace window.

create table if not exists public.club_downgrade_grace_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_tier text not null check (membership_tier in ('free', 'pro', 'pro_plus')),
  current_count integer not null check (current_count >= 0),
  max_allowed integer not null check (max_allowed >= 0),
  status text not null default 'warning' check (status in ('warning', 'remediated', 'compliant')),
  first_detected_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  grace_deadline_at timestamptz not null,
  remediated_at timestamptz,
  archived_club_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists club_downgrade_grace_events_user_status_idx
  on public.club_downgrade_grace_events(user_id, status, grace_deadline_at desc);

alter table public.club_downgrade_grace_events enable row level security;

drop policy if exists "Users can view their club downgrade grace events" on public.club_downgrade_grace_events;
create policy "Users can view their club downgrade grace events"
on public.club_downgrade_grace_events
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Service role can manage club downgrade grace events" on public.club_downgrade_grace_events;
create policy "Service role can manage club downgrade grace events"
on public.club_downgrade_grace_events
for all
to service_role
using (true)
with check (true);

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
          archived_club_ids = case when array_length(clubs_to_archive, 1) is null then archived_club_ids else clubs_to_archive end
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

do $$
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception when others then
    raise notice 'pg_cron extension was not enabled automatically: %', sqlerrm;
  end;

  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'club-downgrade-grace-period') then
      perform cron.unschedule('club-downgrade-grace-period');
    end if;

    perform cron.schedule(
      'club-downgrade-grace-period',
      '0 2 * * *',
      $cron$select count(*) from public.process_club_downgrade_grace_period(null, 14, false);$cron$
    );
  end if;
end;
$$;
