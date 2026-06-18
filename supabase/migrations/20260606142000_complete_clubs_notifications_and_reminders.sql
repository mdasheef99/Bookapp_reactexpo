BEGIN;

CREATE OR REPLACE FUNCTION public.notification_active_club_members(p_club_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT cm.user_id
  FROM public.club_members cm
  WHERE cm.club_id = p_club_id
    AND cm.status IN ('active', 'muted');
$function$;

CREATE OR REPLACE FUNCTION public.route_wishlist_listing_match_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  listing_book public.books%ROWTYPE;
  event_record public.notification_events;
  wishlist_record record;
BEGIN
  IF NEW.status <> 'active' OR NEW.book_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.book_id IS NOT DISTINCT FROM NEW.book_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO listing_book
  FROM public.books
  WHERE id = NEW.book_id;

  IF listing_book.id IS NULL OR listing_book.google_books_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR wishlist_record IN
    SELECT uw.id, uw.user_id
    FROM public.user_wishlist uw
    WHERE uw.google_books_id = listing_book.google_books_id
      AND uw.user_id IS DISTINCT FROM NEW.owner_id
  LOOP
    event_record := public.create_notification_event(
      'wishlist.listing_matched',
      'listing',
      NEW.id,
      NEW.owner_id,
      'listings',
      'wishlist_listing:' || NEW.id::text || ':' || wishlist_record.user_id::text,
      'info',
      false,
      jsonb_build_object(
        'listing_id', NEW.id,
        'book_id', listing_book.id,
        'google_books_id', listing_book.google_books_id,
        'wishlist_id', wishlist_record.id,
        'title', listing_book.title
      )
    );

    PERFORM public.enqueue_notification_delivery(
      event_record.id,
      wishlist_record.user_id,
      'wishlist',
      ARRAY['in_app', 'push'],
      'Wishlist book available',
      'A book from your wishlist is now listed.',
      '/(tabs)/exchange/' || NEW.id::text,
      'wishlist',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS route_wishlist_listing_match_notification
  ON public.listings;

CREATE TRIGGER route_wishlist_listing_match_notification
AFTER INSERT OR UPDATE OF status, book_id ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.route_wishlist_listing_match_notification();

CREATE OR REPLACE FUNCTION public.route_club_event_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  event_record public.notification_events;
  event_type text;
  title text;
  body text;
  recipient record;
  recipient_query text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'scheduled' THEN
    event_type := 'club.event_created';
    title := 'New club event';
    body := 'A club event was added.';
    recipient_query := 'members';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    event_type := 'club.event_cancelled';
    title := 'Club event cancelled';
    body := 'A club event was cancelled.';
    recipient_query := 'members_and_rsvps';
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'scheduled'
        AND (
          OLD.title IS DISTINCT FROM NEW.title OR
          OLD.description IS DISTINCT FROM NEW.description OR
          OLD.event_type IS DISTINCT FROM NEW.event_type OR
          OLD.start_time IS DISTINCT FROM NEW.start_time OR
          OLD.end_time IS DISTINCT FROM NEW.end_time OR
          OLD.venue_id IS DISTINCT FROM NEW.venue_id OR
          OLD.manual_location IS DISTINCT FROM NEW.manual_location OR
          OLD.meeting_link IS DISTINCT FROM NEW.meeting_link
        ) THEN
    event_type := 'club.event_updated';
    title := 'Club event updated';
    body := 'A club event has updated details.';
    recipient_query := 'members_and_rsvps';
  ELSE
    RETURN NEW;
  END IF;

  event_record := public.create_notification_event(
    event_type,
    'club_event',
    NEW.id,
    COALESCE(NEW.cancelled_by, NEW.created_by),
    'club_events',
    'club_event:' || NEW.id::text || ':' || event_type || ':' || COALESCE(NEW.updated_at, NEW.created_at, now())::text,
    CASE WHEN event_type = 'club.event_cancelled' THEN 'warning' ELSE 'info' END,
    event_type = 'club.event_cancelled',
    jsonb_build_object('club_id', NEW.club_id, 'event_id', NEW.id, 'start_time', NEW.start_time)
  );

  FOR recipient IN
    SELECT DISTINCT member_user_id AS user_id
    FROM (
      SELECT acm.user_id AS member_user_id
      FROM public.notification_active_club_members(NEW.club_id) acm
      WHERE acm.user_id IS DISTINCT FROM NEW.created_by
      UNION
      SELECT er.user_id
      FROM public.event_rsvps er
      WHERE er.event_id = NEW.id
        AND er.status IN ('going', 'maybe')
        AND recipient_query = 'members_and_rsvps'
    ) recipients
  LOOP
    PERFORM public.enqueue_notification_delivery(
      event_record.id,
      recipient.user_id,
      'events',
      ARRAY['in_app', 'push'],
      title,
      body,
      '/(tabs)/clubs/' || NEW.club_id::text || '/events',
      'events',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS route_club_event_notification
  ON public.club_events;

CREATE TRIGGER route_club_event_notification
AFTER INSERT OR UPDATE OF title, description, event_type, start_time, end_time, venue_id, manual_location, meeting_link, status
ON public.club_events
FOR EACH ROW
EXECUTE FUNCTION public.route_club_event_notification();

CREATE OR REPLACE FUNCTION public.route_book_nomination_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  event_record public.notification_events;
  nominated_book public.books%ROWTYPE;
  recipient record;
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO nominated_book
  FROM public.books
  WHERE id = NEW.book_id;

  event_record := public.create_notification_event(
    'club.book_nominated',
    'book_nomination',
    NEW.id,
    NEW.nominated_by,
    'book_nominations',
    'book_nomination:' || NEW.id::text || ':created',
    'info',
    false,
    jsonb_build_object(
      'club_id', NEW.club_id,
      'nomination_id', NEW.id,
      'book_id', NEW.book_id,
      'title', nominated_book.title,
      'voting_ends_at', NEW.voting_ends_at
    )
  );

  FOR recipient IN
    SELECT acm.user_id
    FROM public.notification_active_club_members(NEW.club_id) acm
    WHERE acm.user_id IS DISTINCT FROM NEW.nominated_by
  LOOP
    PERFORM public.enqueue_notification_delivery(
      event_record.id,
      recipient.user_id,
      'clubs',
      ARRAY['in_app', 'push'],
      'New club book nomination',
      'A new book was nominated for your club.',
      '/(tabs)/clubs/' || NEW.club_id::text || '/nominate',
      'clubs',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS route_book_nomination_notification
  ON public.book_nominations;

CREATE TRIGGER route_book_nomination_notification
AFTER INSERT ON public.book_nominations
FOR EACH ROW
EXECUTE FUNCTION public.route_book_nomination_notification();

CREATE OR REPLACE FUNCTION public.route_reading_schedule_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  event_record public.notification_events;
  event_type text;
  recipient record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_type := 'club.reading_schedule_created';
  ELSIF TG_OP = 'UPDATE' AND OLD.milestones IS DISTINCT FROM NEW.milestones THEN
    event_type := 'club.reading_schedule_updated';
  ELSE
    RETURN NEW;
  END IF;

  event_record := public.create_notification_event(
    event_type,
    'reading_schedule',
    NEW.id,
    NEW.created_by,
    'reading_schedules',
    'reading_schedule:' || NEW.id::text || ':' || event_type || ':' || COALESCE(NEW.created_at, now())::text,
    'info',
    false,
    jsonb_build_object('club_id', NEW.club_id, 'book_id', NEW.book_id, 'schedule_id', NEW.id)
  );

  FOR recipient IN
    SELECT acm.user_id
    FROM public.notification_active_club_members(NEW.club_id) acm
    WHERE acm.user_id IS DISTINCT FROM NEW.created_by
  LOOP
    PERFORM public.enqueue_notification_delivery(
      event_record.id,
      recipient.user_id,
      'reminders',
      ARRAY['in_app', 'push'],
      CASE WHEN event_type = 'club.reading_schedule_created' THEN 'Reading schedule added' ELSE 'Reading schedule updated' END,
      'Your club reading schedule has new milestone details.',
      '/(tabs)/clubs/' || NEW.club_id::text || '/reading',
      'reminders',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS route_reading_schedule_notification
  ON public.reading_schedules;

CREATE TRIGGER route_reading_schedule_notification
AFTER INSERT OR UPDATE OF milestones ON public.reading_schedules
FOR EACH ROW
EXECUTE FUNCTION public.route_reading_schedule_notification();

CREATE OR REPLACE FUNCTION public.route_club_downgrade_grace_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  event_record public.notification_events;
  event_type text;
  title text;
  body text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'warning' THEN
    event_type := 'membership.downgrade_grace_started';
    title := 'Club limit grace period started';
    body := 'Choose which clubs to keep before your downgrade grace period ends.';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'remediated' THEN
    event_type := 'membership.downgrade_grace_remediated';
    title := 'Club limit remediation complete';
    body := 'Some clubs were archived to match your current membership limit.';
  ELSE
    RETURN NEW;
  END IF;

  event_record := public.create_notification_event(
    event_type,
    'club_downgrade_grace_event',
    NEW.id,
    NULL,
    'club_downgrade_grace_events',
    'club_downgrade:' || NEW.id::text || ':' || event_type,
    CASE WHEN NEW.status = 'remediated' THEN 'warning' ELSE 'info' END,
    true,
    jsonb_build_object(
      'membership_tier', NEW.membership_tier,
      'current_count', NEW.current_count,
      'max_allowed', NEW.max_allowed,
      'grace_deadline_at', NEW.grace_deadline_at,
      'archived_club_ids', NEW.archived_club_ids
    )
  );

  PERFORM public.enqueue_notification_delivery(
    event_record.id,
    NEW.user_id,
    'account',
    ARRAY['in_app', 'push'],
    title,
    body,
    '/(tabs)/profile/settings',
    'account',
    true
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS route_club_downgrade_grace_notification
  ON public.club_downgrade_grace_events;

CREATE TRIGGER route_club_downgrade_grace_notification
AFTER INSERT OR UPDATE OF status ON public.club_downgrade_grace_events
FOR EACH ROW
EXECUTE FUNCTION public.route_club_downgrade_grace_notification();

CREATE OR REPLACE FUNCTION public.send_due_club_reminder_notifications()
RETURNS TABLE(created_events integer, created_deliveries integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  nomination_record record;
  event_record public.notification_events;
  recipient record;
  milestone_record record;
  schedule_record public.reading_schedules%ROWTYPE;
  event_row public.club_events%ROWTYPE;
  delivery_count integer;
BEGIN
  created_events := 0;
  created_deliveries := 0;

  FOR recipient IN
    SELECT ci.*
    FROM public.club_invitations ci
    WHERE ci.status = 'pending'
      AND ci.read_at IS NULL
      AND ci.created_at <= now() - interval '24 hours'
  LOOP
    event_record := public.create_notification_event(
      'club.invitation_reminder',
      'club_invitation',
      recipient.id,
      recipient.inviter_user_id,
      'club_reminder_cron',
      'club_invitation_reminder:' || recipient.id::text || ':' || current_date::text,
      'info',
      true,
      jsonb_build_object('club_id', recipient.club_id, 'invitation_id', recipient.id)
    );
    created_events := created_events + 1;

    delivery_count := public.enqueue_notification_delivery(
      event_record.id,
      recipient.invitee_user_id,
      'reminders',
      ARRAY['in_app', 'push'],
      'Club invitation waiting',
      'You have an unread club invitation.',
      '/(tabs)/clubs/invitations',
      'reminders',
      false
    );
    created_deliveries := created_deliveries + delivery_count;
  END LOOP;

  FOR nomination_record IN
    SELECT bn.*
    FROM public.book_nominations bn
    WHERE bn.status = 'active'
      AND bn.voting_ends_at IS NOT NULL
      AND bn.voting_ends_at > now()
      AND bn.voting_ends_at <= now() + interval '24 hours'
  LOOP
    event_record := public.create_notification_event(
      'club.voting_ending_soon',
      'book_nomination',
      nomination_record.id,
      NULL,
      'club_reminder_cron',
      'club_voting_ending:' || nomination_record.id::text || ':' || nomination_record.voting_ends_at::date::text,
      'info',
      false,
      jsonb_build_object('club_id', nomination_record.club_id, 'nomination_id', nomination_record.id, 'voting_ends_at', nomination_record.voting_ends_at)
    );
    created_events := created_events + 1;

    FOR recipient IN
      SELECT acm.user_id
      FROM public.notification_active_club_members(nomination_record.club_id) acm
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.book_votes bv
        WHERE bv.nomination_id = nomination_record.id
          AND bv.user_id = acm.user_id
      )
    LOOP
      delivery_count := public.enqueue_notification_delivery(
        event_record.id,
        recipient.user_id,
        'reminders',
        ARRAY['in_app', 'push'],
        'Club voting closes soon',
        'Vote on your club nomination before it closes.',
        '/(tabs)/clubs/' || nomination_record.club_id::text || '/nominate',
        'reminders',
        false
      );
      created_deliveries := created_deliveries + delivery_count;
    END LOOP;
  END LOOP;

  FOR event_row IN
    SELECT ce.*
    FROM public.club_events ce
    WHERE ce.status = 'scheduled'
      AND ce.start_time > now()
      AND ce.start_time <= now() + interval '24 hours'
  LOOP
    event_record := public.create_notification_event(
      'club.event_reminder',
      'club_event',
      event_row.id,
      NULL,
      'club_reminder_cron',
      'club_event_reminder:' || event_row.id::text || ':' || event_row.start_time::date::text,
      'info',
      false,
      jsonb_build_object('club_id', event_row.club_id, 'event_id', event_row.id, 'start_time', event_row.start_time)
    );
    created_events := created_events + 1;

    FOR recipient IN
      SELECT er.user_id
      FROM public.event_rsvps er
      WHERE er.event_id = event_row.id
        AND er.status IN ('going', 'maybe')
    LOOP
      delivery_count := public.enqueue_notification_delivery(
        event_record.id,
        recipient.user_id,
        'reminders',
        ARRAY['in_app', 'push'],
        'Club event coming up',
        'You have a club event in the next 24 hours.',
        '/(tabs)/clubs/' || event_row.club_id::text || '/events',
        'reminders',
        false
      );
      created_deliveries := created_deliveries + delivery_count;
    END LOOP;
  END LOOP;

  FOR schedule_record IN
    SELECT rs.*
    FROM public.reading_schedules rs
  LOOP
    FOR milestone_record IN
      SELECT milestone
      FROM jsonb_array_elements(schedule_record.milestones) milestone
      WHERE (milestone->>'dueDate') IS NOT NULL
        AND (milestone->>'dueDate')::date >= current_date
        AND (milestone->>'dueDate')::date <= current_date + 1
    LOOP
      event_record := public.create_notification_event(
        'club.reading_milestone_due',
        'reading_schedule',
        schedule_record.id,
        NULL,
        'club_reminder_cron',
        'reading_milestone_due:' || schedule_record.id::text || ':' || (milestone_record.milestone->>'label') || ':' || (milestone_record.milestone->>'dueDate'),
        'info',
        false,
        jsonb_build_object(
          'club_id', schedule_record.club_id,
          'book_id', schedule_record.book_id,
          'schedule_id', schedule_record.id,
          'milestone', milestone_record.milestone
        )
      );
      created_events := created_events + 1;

      FOR recipient IN
        SELECT acm.user_id
        FROM public.notification_active_club_members(schedule_record.club_id) acm
      LOOP
        delivery_count := public.enqueue_notification_delivery(
          event_record.id,
          recipient.user_id,
          'reminders',
          ARRAY['in_app', 'push'],
          'Reading milestone due',
          'A club reading milestone is due soon.',
          '/(tabs)/clubs/' || schedule_record.club_id::text || '/reading',
          'reminders',
          false
        );
        created_deliveries := created_deliveries + delivery_count;
      END LOOP;
    END LOOP;
  END LOOP;

  FOR recipient IN
    SELECT ev.*
    FROM public.club_downgrade_grace_events ev
    WHERE ev.status = 'warning'
      AND ev.grace_deadline_at > now()
      AND ev.grace_deadline_at <= now() + interval '72 hours'
  LOOP
    event_record := public.create_notification_event(
      'membership.downgrade_grace_deadline_near',
      'club_downgrade_grace_event',
      recipient.id,
      NULL,
      'club_reminder_cron',
      'club_downgrade_deadline:' || recipient.id::text || ':' || recipient.grace_deadline_at::date::text,
      'warning',
      true,
      jsonb_build_object('grace_deadline_at', recipient.grace_deadline_at, 'current_count', recipient.current_count, 'max_allowed', recipient.max_allowed)
    );
    created_events := created_events + 1;

    delivery_count := public.enqueue_notification_delivery(
      event_record.id,
      recipient.user_id,
      'account',
      ARRAY['in_app', 'push'],
      'Club downgrade deadline approaching',
      'Choose clubs to keep before automatic archiving runs.',
      '/(tabs)/profile/settings',
      'account',
      true
    );
    created_deliveries := created_deliveries + delivery_count;
  END LOOP;

  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dispatch_pending_push_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  function_url text := current_setting('app.settings.send_notification_url', true);
  bearer_token text := current_setting('app.settings.send_notification_bearer', true);
  cron_secret text := current_setting('app.settings.send_notification_cron_secret', true);
  request_id bigint;
BEGIN
  IF function_url IS NULL OR function_url = '' OR bearer_token IS NULL OR bearer_token = '' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'send-notification dispatch settings are not configured');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'pg_net schema is not available');
  END IF;

  SELECT net.http_post(
    url := function_url,
    headers := jsonb_strip_nulls(jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || bearer_token,
      'x-cron-secret', NULLIF(cron_secret, '')
    )),
    body := jsonb_build_object('limit', 100)
  )
  INTO request_id;

  RETURN jsonb_build_object('skipped', false, 'request_id', request_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.notification_active_club_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_wishlist_listing_match_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_club_event_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_book_nomination_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_reading_schedule_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_club_downgrade_grace_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_due_club_reminder_notifications() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dispatch_pending_push_notifications() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.send_due_club_reminder_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_pending_push_notifications() TO service_role;

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_net extension was not enabled automatically: %', SQLERRM;
  END;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'club-notification-reminders') THEN
      PERFORM cron.unschedule('club-notification-reminders');
    END IF;

    PERFORM cron.schedule(
      'club-notification-reminders',
      '0 * * * *',
      $cron$SELECT * FROM public.send_due_club_reminder_notifications();$cron$
    );

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-push-dispatch') THEN
      PERFORM cron.unschedule('notification-push-dispatch');
    END IF;

    PERFORM cron.schedule(
      'notification-push-dispatch',
      '*/5 * * * *',
      $cron$SELECT public.dispatch_pending_push_notifications();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron schema is not available; notification reminder and push dispatch jobs were not scheduled.';
  END IF;
END;
$$;

COMMIT;
