-- Phase 6 Unit 11B: safe commerce inbox reads and transport-attempt evidence.
BEGIN;

ALTER TABLE public.notification_deliveries DROP CONSTRAINT notification_deliveries_channel_check;
ALTER TABLE public.notification_deliveries ADD CONSTRAINT notification_deliveries_channel_check
 CHECK((marketplace_notification_id IS NULL AND channel IN ('in_app','push')) OR
  (marketplace_notification_id IS NOT NULL AND channel IN ('push','email'))) NOT VALID;
ALTER TABLE public.notification_deliveries DROP CONSTRAINT notification_deliveries_status_check;
ALTER TABLE public.notification_deliveries ADD CONSTRAINT notification_deliveries_status_check
 CHECK((marketplace_notification_id IS NULL AND status IN
  ('pending','queued','sent','delivered','failed','read','archived','suppressed')) OR
  (marketplace_notification_id IS NOT NULL AND status IN
  ('pending','in_progress','sent','failed','dead_letter'))) NOT VALID;
-- Commerce transport status IN ('pending','in_progress','sent','failed','dead_letter').
ALTER TABLE public.notification_deliveries
 ADD COLUMN last_error_category TEXT,
 ADD COLUMN provider_message_reference TEXT;

CREATE FUNCTION public.marketplace_list_commerce_notifications()
RETURNS TABLE(id UUID,notification_type TEXT,title TEXT,body TEXT,entity_type TEXT,
 entity_id UUID,deep_link_route TEXT,deep_link_data JSONB,is_read BOOLEAN,read_at TIMESTAMPTZ,
 privacy_classification TEXT,created_at TIMESTAMPTZ,source TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT n.id,n.notification_type,n.title,n.body,n.entity_type,n.entity_id,
 n.deep_link_route,n.deep_link_data,n.is_read,n.read_at,n.privacy_classification,n.created_at,
 'commerce'::TEXT FROM public.marketplace_notifications n
 WHERE n.user_id=auth.uid() AND n.notification_type LIKE 'commerce.%'
 ORDER BY n.created_at DESC $$;

CREATE FUNCTION public.marketplace_mark_commerce_notification_read(p_notification_id UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_row public.marketplace_notifications%ROWTYPE;
BEGIN
 UPDATE public.marketplace_notifications SET is_read=true,read_at=COALESCE(read_at,transaction_timestamp())
 WHERE id=p_notification_id AND user_id=auth.uid() AND notification_type LIKE 'commerce.%'
 RETURNING * INTO v_row;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 RETURN jsonb_build_object('id',v_row.id,'read_at',v_row.read_at,'source','commerce');
END;$$;

CREATE FUNCTION marketplace_sec.enqueue_phase6_notification_delivery(
 p_notification_id UUID,p_channel TEXT
)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_notification public.marketplace_notifications%ROWTYPE;v_id UUID;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_channel NOT IN('push','email') THEN
  RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 SELECT * INTO v_notification FROM public.marketplace_notifications
  WHERE id=p_notification_id AND notification_type LIKE 'commerce.%' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 INSERT INTO public.notification_deliveries(marketplace_notification_id,recipient_user_id,
  category,channel,title,body,deep_link,status,next_attempt_at)
 VALUES(v_notification.id,v_notification.user_id,v_notification.notification_type,p_channel,
  v_notification.title,COALESCE(v_notification.body,''),v_notification.deep_link,'pending',transaction_timestamp())
 ON CONFLICT (marketplace_notification_id,recipient_user_id,channel)
  WHERE marketplace_notification_id IS NOT NULL DO UPDATE SET updated_at=EXCLUDED.updated_at
 RETURNING id INTO v_id;
 INSERT INTO public.event_action_tasks(event_id,status,entity_type,entity_id,task_type,due_at,
  next_attempt_at,dedupe_key) VALUES(v_notification.event_id,'open','notification_delivery',v_id,
  'notification_delivery',transaction_timestamp(),transaction_timestamp(),
  'notification_delivery:'||v_id) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
 RETURN v_id;
END;$$;

CREATE FUNCTION marketplace_sec.record_phase6_delivery_result(
 p_delivery_id UUID,p_lease_owner UUID,p_succeeded BOOLEAN,p_retryable BOOLEAN,
 p_error_category TEXT,p_provider_reference TEXT
)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_delivery public.notification_deliveries%ROWTYPE;v_delay INTERVAL;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 SELECT * INTO v_delivery FROM public.notification_deliveries WHERE id=p_delivery_id
  AND marketplace_notification_id IS NOT NULL AND lease_owner=p_lease_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF p_succeeded THEN
  UPDATE public.notification_deliveries SET status='sent',sent_at=transaction_timestamp(),
   provider_message_reference=p_provider_reference,provider_message_id=p_provider_reference,
   lease_owner=NULL,lease_expires_at=NULL,locked_at=NULL,locked_by=NULL,updated_at=transaction_timestamp()
  WHERE id=v_delivery.id;
  RETURN 'sent';
 END IF;
 IF NOT p_retryable OR v_delivery.attempt_count>=v_delivery.max_attempts THEN
  UPDATE public.notification_deliveries SET status='dead_letter',dead_lettered_at=transaction_timestamp(),
   last_error_category=p_error_category,last_error_code=p_error_category,
   lease_owner=NULL,lease_expires_at=NULL,locked_at=NULL,locked_by=NULL,updated_at=transaction_timestamp()
  WHERE id=v_delivery.id;
  RETURN 'dead_letter';
 END IF;
 v_delay:=CASE v_delivery.attempt_count WHEN 1 THEN interval '30 seconds'
  WHEN 2 THEN interval '2 minutes' WHEN 3 THEN interval '10 minutes'
  WHEN 4 THEN interval '30 minutes' ELSE interval '2 hours' END;
 UPDATE public.notification_deliveries SET status='failed',next_attempt_at=transaction_timestamp()+v_delay,
  last_error_category=p_error_category,last_error_code=p_error_category,
  lease_owner=NULL,lease_expires_at=NULL,locked_at=NULL,locked_by=NULL,updated_at=transaction_timestamp()
 WHERE id=v_delivery.id;
 RETURN 'failed';
END;$$;

DROP POLICY IF EXISTS "notification deliveries select own" ON public.notification_deliveries;
CREATE POLICY "notification deliveries legacy select own" ON public.notification_deliveries
 FOR SELECT TO authenticated USING(recipient_user_id=auth.uid() AND marketplace_notification_id IS NULL);
REVOKE INSERT,UPDATE,DELETE ON public.marketplace_notifications FROM authenticated;
REVOKE ALL ON public.notification_deliveries FROM anon;
REVOKE ALL ON FUNCTION public.marketplace_list_commerce_notifications() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.marketplace_mark_commerce_notification_read(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION marketplace_sec.enqueue_phase6_notification_delivery(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.record_phase6_delivery_result(UUID,UUID,BOOLEAN,BOOLEAN,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_list_commerce_notifications() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_mark_commerce_notification_read(UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.enqueue_phase6_notification_delivery(UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.record_phase6_delivery_result(UUID,UUID,BOOLEAN,BOOLEAN,TEXT,TEXT) TO service_role;
COMMIT;
