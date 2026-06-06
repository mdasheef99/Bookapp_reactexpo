BEGIN;

CREATE OR REPLACE FUNCTION public.create_notification_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_idempotency_key text,
  p_severity text DEFAULT 'info',
  p_requires_action boolean DEFAULT false,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.notification_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  event_record public.notification_events;
BEGIN
  INSERT INTO public.notification_events (
    event_type,
    entity_type,
    entity_id,
    actor_user_id,
    source,
    severity,
    requires_action,
    payload,
    idempotency_key
  )
  VALUES (
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_actor_user_id,
    p_source,
    p_severity,
    p_requires_action,
    COALESCE(p_payload, '{}'::jsonb),
    p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO event_record;

  IF event_record.id IS NULL THEN
    SELECT *
    INTO event_record
    FROM public.notification_events
    WHERE idempotency_key = p_idempotency_key;
  END IF;

  RETURN event_record;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_notification_delivery(
  p_event_id uuid,
  p_recipient_user_id uuid,
  p_category text,
  p_channels text[],
  p_title text,
  p_body text,
  p_deep_link text DEFAULT NULL,
  p_preference_key text DEFAULT NULL,
  p_mandatory boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  channel_value text;
  inserted_count integer := 0;
  preference_enabled boolean;
BEGIN
  IF p_recipient_user_id IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH channel_value IN ARRAY p_channels LOOP
    IF channel_value NOT IN ('in_app', 'push') THEN
      CONTINUE;
    END IF;

    SELECT enabled
    INTO preference_enabled
    FROM public.notification_preferences
    WHERE user_id = p_recipient_user_id
      AND preference_key = COALESCE(p_preference_key, p_category)
      AND channel = channel_value;

    IF NOT p_mandatory AND COALESCE(preference_enabled, true) IS NOT TRUE THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notification_deliveries (
      event_id,
      recipient_user_id,
      category,
      channel,
      title,
      body,
      deep_link,
      status
    )
    VALUES (
      p_event_id,
      p_recipient_user_id,
      p_category,
      channel_value,
      p_title,
      p_body,
      p_deep_link,
      'pending'
    )
    ON CONFLICT (event_id, recipient_user_id, channel) DO NOTHING;

    IF FOUND THEN
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  RETURN inserted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.route_transaction_event_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  txn public.transactions;
  event_record public.notification_events;
  recipient_user_id uuid;
  title text;
  body text;
  category text := 'transaction';
  mandatory boolean := true;
BEGIN
  SELECT *
  INTO txn
  FROM public.transactions
  WHERE id = NEW.transaction_id;

  IF txn.id IS NULL THEN
    RETURN NEW;
  END IF;

  CASE NEW.event_type
    WHEN 'requested' THEN
      recipient_user_id := txn.lender_id;
      title := 'New exchange request';
      body := 'A reader requested one of your books.';
    WHEN 'approved' THEN
      recipient_user_id := txn.borrower_id;
      title := 'Exchange approved';
      body := 'Your book exchange was approved.';
    WHEN 'declined' THEN
      recipient_user_id := txn.borrower_id;
      title := 'Exchange declined';
      body := 'Your book exchange request was declined.';
    WHEN 'dispute_opened' THEN
      recipient_user_id := CASE
        WHEN NEW.actor_id = txn.borrower_id THEN txn.lender_id
        ELSE txn.borrower_id
      END;
      title := 'Exchange dispute opened';
      body := 'A dispute was opened for one of your exchanges.';
      category := 'safety';
    WHEN 'dispute_resolved' THEN
      recipient_user_id := CASE
        WHEN NEW.actor_id = txn.borrower_id THEN txn.lender_id
        ELSE txn.borrower_id
      END;
      title := 'Exchange dispute resolved';
      body := 'A dispute update is available for one of your exchanges.';
      category := 'safety';
    ELSE
      RETURN NEW;
  END CASE;

  event_record := public.create_notification_event(
    'exchange.transaction_' || NEW.event_type,
    'transaction',
    txn.id,
    NEW.actor_id,
    'transaction_events',
    'transaction_event:' || NEW.id::text,
    CASE WHEN category = 'safety' THEN 'warning' ELSE 'info' END,
    category = 'safety',
    jsonb_build_object(
      'transaction_id', txn.id,
      'transaction_event_id', NEW.id,
      'status', txn.status
    )
  );

  PERFORM public.enqueue_notification_delivery(
    event_record.id,
    recipient_user_id,
    category,
    ARRAY['in_app', 'push'],
    title,
    body,
    '/(tabs)/exchange/transaction/' || txn.id::text,
    category,
    mandatory
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS route_transaction_event_notification
  ON public.transaction_events;

CREATE TRIGGER route_transaction_event_notification
AFTER INSERT ON public.transaction_events
FOR EACH ROW
EXECUTE FUNCTION public.route_transaction_event_notification();

CREATE OR REPLACE FUNCTION public.route_transaction_status_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  event_record public.notification_events;
  recipient_user_id uuid;
  title text;
  body text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'cancelled' THEN
      recipient_user_id := CASE
        WHEN auth.uid() = NEW.borrower_id THEN NEW.lender_id
        ELSE NEW.borrower_id
      END;
      title := 'Exchange cancelled';
      body := 'One of your book exchanges was cancelled.';
    WHEN 'payment_pending' THEN
      recipient_user_id := NEW.borrower_id;
      title := 'Payment pending';
      body := 'Your exchange is ready for the payment step.';
    WHEN 'ready_to_ship' THEN
      recipient_user_id := NEW.lender_id;
      title := 'Ready to ship';
      body := 'An approved exchange is ready to be shipped.';
    WHEN 'shipped' THEN
      recipient_user_id := NEW.borrower_id;
      title := 'Book shipped';
      body := 'Your exchange book has been marked as shipped.';
    WHEN 'delivered' THEN
      recipient_user_id := NEW.lender_id;
      title := 'Delivery confirmed';
      body := 'The borrower confirmed delivery for your exchange.';
    WHEN 'completed' THEN
      recipient_user_id := NEW.lender_id;
      title := 'Exchange completed';
      body := 'Your exchange was completed and credits were updated.';
    ELSE
      RETURN NEW;
  END CASE;

  event_record := public.create_notification_event(
    'exchange.status_' || NEW.status,
    'transaction',
    NEW.id,
    auth.uid(),
    'transactions',
    'transaction_status:' || NEW.id::text || ':' || NEW.status,
    'info',
    false,
    jsonb_build_object(
      'transaction_id', NEW.id,
      'old_status', OLD.status,
      'new_status', NEW.status
    )
  );

  PERFORM public.enqueue_notification_delivery(
    event_record.id,
    recipient_user_id,
    'transaction',
    ARRAY['in_app', 'push'],
    title,
    body,
    '/(tabs)/exchange/transaction/' || NEW.id::text,
    'transaction',
    true
  );

  IF NEW.status IN ('delivered', 'completed') THEN
    PERFORM public.enqueue_notification_delivery(
      event_record.id,
      CASE WHEN recipient_user_id = NEW.borrower_id THEN NEW.lender_id ELSE NEW.borrower_id END,
      'transaction',
      ARRAY['in_app'],
      title,
      body,
      '/(tabs)/exchange/transaction/' || NEW.id::text,
      'transaction',
      true
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS route_transaction_status_notification
  ON public.transactions;

CREATE TRIGGER route_transaction_status_notification
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.route_transaction_status_notification();

CREATE OR REPLACE FUNCTION public.route_club_invitation_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  event_record public.notification_events;
  event_type text;
  recipient_user_id uuid;
  title text;
  body text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    event_type := 'club.invitation_created';
    recipient_user_id := NEW.invitee_user_id;
    title := 'New club invitation';
    body := 'You were invited to join a book club.';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'accepted' THEN
        event_type := 'club.invitation_accepted';
        recipient_user_id := NEW.inviter_user_id;
        title := 'Club invitation accepted';
        body := 'A reader accepted your club invitation.';
      WHEN 'revoked' THEN
        event_type := 'club.invitation_revoked';
        recipient_user_id := NEW.invitee_user_id;
        title := 'Club invitation revoked';
        body := 'A club invitation is no longer active.';
      WHEN 'expired' THEN
        event_type := 'club.invitation_expired';
        recipient_user_id := NEW.invitee_user_id;
        title := 'Club invitation expired';
        body := 'A club invitation expired.';
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  event_record := public.create_notification_event(
    event_type,
    'club_invitation',
    NEW.id,
    NEW.inviter_user_id,
    'club_invitations',
    'club_invitation:' || NEW.id::text || ':' || event_type,
    'info',
    event_type = 'club.invitation_created',
    jsonb_build_object(
      'club_id', NEW.club_id,
      'invitation_id', NEW.id,
      'status', NEW.status
    )
  );

  PERFORM public.enqueue_notification_delivery(
    event_record.id,
    recipient_user_id,
    'clubs',
    ARRAY['in_app', 'push'],
    title,
    body,
    CASE
      WHEN event_type = 'club.invitation_created' THEN '/(tabs)/clubs/invitations'
      ELSE '/(tabs)/clubs/' || NEW.club_id::text
    END,
    'clubs',
    false
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS route_club_invitation_notification
  ON public.club_invitations;

CREATE TRIGGER route_club_invitation_notification
AFTER INSERT OR UPDATE OF status ON public.club_invitations
FOR EACH ROW
EXECUTE FUNCTION public.route_club_invitation_notification();

REVOKE ALL ON FUNCTION public.create_notification_event(text, text, uuid, uuid, text, text, text, boolean, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_notification_delivery(uuid, uuid, text, text[], text, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_transaction_event_notification()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_transaction_status_notification()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_club_invitation_notification()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_notification_event(text, text, uuid, uuid, text, text, text, boolean, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_notification_delivery(uuid, uuid, text, text[], text, text, text, text, boolean)
  TO service_role;

COMMIT;
