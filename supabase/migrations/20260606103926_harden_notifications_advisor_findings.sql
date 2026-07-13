BEGIN;

DROP POLICY IF EXISTS "Users can insert their own push token"
  ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can view their own push token"
  ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can update their own push token"
  ON public.user_push_tokens;

GRANT UPDATE ON public.notification_deliveries TO authenticated;

DROP POLICY IF EXISTS "Users can update their notification deliveries"
  ON public.notification_deliveries;

CREATE POLICY "Users can update their notification deliveries"
ON public.notification_deliveries
FOR UPDATE
TO authenticated
USING (recipient_user_id = auth.uid())
WITH CHECK (recipient_user_id = auth.uid());

ALTER FUNCTION public.mark_notification_read(uuid) SECURITY INVOKER;
ALTER FUNCTION public.mark_all_notifications_read() SECURITY INVOKER;
ALTER FUNCTION public.archive_notification(uuid) SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_notification(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_notification(uuid) TO authenticated, service_role;

COMMIT;
