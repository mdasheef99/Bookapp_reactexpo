BEGIN;

-- Enterprise notification foundation.
-- Creates durable in-app notifications, push delivery ledger, preferences, and
-- reconciles the live user_push_tokens table into source-controlled migrations.

CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  requires_action boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('in_app', 'push')),
  title text NOT NULL,
  body text NOT NULL,
  deep_link text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'read', 'archived', 'suppressed')),
  provider_message_id text,
  error_code text,
  error_message text,
  sent_at timestamptz,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, recipient_user_id, channel)
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('in_app', 'push')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, preference_key, channel)
);

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'unknown',
  device_id text,
  provider text NOT NULL DEFAULT 'expo',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'unknown';

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS device_id text;

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'expo';

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE public.user_push_tokens
SET id = COALESCE(id, gen_random_uuid());

ALTER TABLE public.user_push_tokens
  ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_tokens_pkey'
      AND conrelid = 'public.user_push_tokens'::regclass
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (user_id)'
  ) THEN
    ALTER TABLE public.user_push_tokens
      DROP CONSTRAINT user_push_tokens_pkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_tokens_pkey'
      AND conrelid = 'public.user_push_tokens'::regclass
  ) THEN
    ALTER TABLE public.user_push_tokens
      ADD CONSTRAINT user_push_tokens_pkey PRIMARY KEY (id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_tokens_token_key'
      AND conrelid = 'public.user_push_tokens'::regclass
  ) THEN
    ALTER TABLE public.user_push_tokens
      ADD CONSTRAINT user_push_tokens_token_key UNIQUE (token);
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_tokens_platform_check'
      AND conrelid = 'public.user_push_tokens'::regclass
      AND pg_get_constraintdef(oid) NOT LIKE '%unknown%'
  ) THEN
    ALTER TABLE public.user_push_tokens
      DROP CONSTRAINT user_push_tokens_platform_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_tokens_platform_check'
      AND conrelid = 'public.user_push_tokens'::regclass
  ) THEN
    ALTER TABLE public.user_push_tokens
      ADD CONSTRAINT user_push_tokens_platform_check
      CHECK (platform IN ('ios', 'android', 'web', 'unknown'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_tokens_provider_check'
      AND conrelid = 'public.user_push_tokens'::regclass
  ) THEN
    ALTER TABLE public.user_push_tokens
      ADD CONSTRAINT user_push_tokens_provider_check
      CHECK (provider IN ('expo', 'fcm', 'apns'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS notification_events_type_created_idx
  ON public.notification_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_events_entity_idx
  ON public.notification_events(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS notification_events_actor_created_idx
  ON public.notification_events(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_deliveries_recipient_created_idx
  ON public.notification_deliveries(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_deliveries_recipient_unread_idx
  ON public.notification_deliveries(recipient_user_id, read_at, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS notification_deliveries_status_channel_idx
  ON public.notification_deliveries(status, channel, created_at);

CREATE INDEX IF NOT EXISTS notification_preferences_user_key_idx
  ON public.notification_preferences(user_id, preference_key);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_active_idx
  ON public.user_push_tokens(user_id, revoked_at);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notification_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.notification_deliveries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.notification_preferences FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_push_tokens FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.notification_events TO authenticated;
GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_push_tokens TO authenticated;

GRANT ALL ON public.notification_events TO service_role;
GRANT ALL ON public.notification_deliveries TO service_role;
GRANT ALL ON public.notification_preferences TO service_role;
GRANT ALL ON public.user_push_tokens TO service_role;

DROP POLICY IF EXISTS "Users can view events backing their deliveries"
  ON public.notification_events;

CREATE POLICY "Users can view events backing their deliveries"
ON public.notification_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.notification_deliveries nd
    WHERE nd.event_id = notification_events.id
      AND nd.recipient_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view their notification deliveries"
  ON public.notification_deliveries;

CREATE POLICY "Users can view their notification deliveries"
ON public.notification_deliveries
FOR SELECT
TO authenticated
USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their notification preferences"
  ON public.notification_preferences;

CREATE POLICY "Users can manage their notification preferences"
ON public.notification_preferences
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their push tokens"
  ON public.user_push_tokens;

CREATE POLICY "Users can view their push tokens"
ON public.user_push_tokens
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can register their push tokens"
  ON public.user_push_tokens;

CREATE POLICY "Users can register their push tokens"
ON public.user_push_tokens
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their push tokens"
  ON public.user_push_tokens;

CREATE POLICY "Users can update their push tokens"
ON public.user_push_tokens
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_delivery_id uuid)
RETURNS public.notification_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  updated_delivery public.notification_deliveries;
BEGIN
  UPDATE public.notification_deliveries
  SET read_at = COALESCE(read_at, now()),
      status = CASE
        WHEN status IN ('pending', 'queued', 'sent', 'delivered') THEN 'read'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_delivery_id
    AND recipient_user_id = auth.uid()
  RETURNING * INTO updated_delivery;

  IF updated_delivery.id IS NULL THEN
    RAISE EXCEPTION 'Notification not found or not accessible';
  END IF;

  RETURN updated_delivery;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.notification_deliveries
  SET read_at = COALESCE(read_at, now()),
      status = CASE
        WHEN status IN ('pending', 'queued', 'sent', 'delivered') THEN 'read'
        ELSE status
      END,
      updated_at = now()
  WHERE recipient_user_id = auth.uid()
    AND read_at IS NULL
    AND archived_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.archive_notification(p_delivery_id uuid)
RETURNS public.notification_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  updated_delivery public.notification_deliveries;
BEGIN
  UPDATE public.notification_deliveries
  SET archived_at = COALESCE(archived_at, now()),
      status = 'archived',
      updated_at = now()
  WHERE id = p_delivery_id
    AND recipient_user_id = auth.uid()
  RETURNING * INTO updated_delivery;

  IF updated_delivery.id IS NULL THEN
    RAISE EXCEPTION 'Notification not found or not accessible';
  END IF;

  RETURN updated_delivery;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_notification(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_notification(uuid) TO authenticated, service_role;

COMMIT;
