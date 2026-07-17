-- Phase 6 persisted-gate corrective: keep support tasks compatible with the
-- Unit 12 request-provenance constraint. Forward-only replacement of M15.
BEGIN;

CREATE OR REPLACE FUNCTION public.request_platform_support(p_request_id UUID,p_expected_version INTEGER,
 p_category TEXT,p_description TEXT,p_idempotency_key TEXT,p_command_id UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor UUID:=auth.uid();v_request public.store_order_requests%ROWTYPE;
 v_text TEXT;v_replay JSONB;v_event UUID:=gen_random_uuid();v_task public.event_action_tasks%ROWTYPE;
 v_response JSONB;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_expected_version IS NULL OR p_command_id IS NULL OR p_category IS NULL OR
  p_category NOT IN('inventory_exception','price_correction_review','customer_contact_issue',
  'fulfilment_exception','closure_exception','policy_exception','technical_error',
  'suspected_abuse','other')
  OR char_length(p_description)>2000 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_text:=marketplace_sec.sanitize_private_text(p_description);
 IF v_text IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_command(v_actor,'request_platform_support',
  p_request_id::TEXT,p_idempotency_key,jsonb_build_object('requestId',p_request_id,
  'expectedVersion',p_expected_version,'category',p_category,
  'descriptionHash',encode(extensions.digest(v_text,'sha256'),'hex')),
  p_command_id,p_expected_version);IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND OR NOT marketplace_sec.has_phase6_owner_capability(v_request.store_id,
  'phase6_order_commands') THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status IN('unavailable','store_rejected','customer_cancelled','platform_cancelled',
  'expired','payment_ready_expired') THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 INSERT INTO public.order_request_support_notes(order_request_id,store_id,opened_by,category,
  private_description,command_id)VALUES(v_request.id,v_request.store_id,v_actor,p_category,
  v_text,p_command_id);
 INSERT INTO public.marketplace_events(id,event_type,entity_type,entity_id,store_id,user_id,
  actor_user_id,actor_role,source,idempotency_key,command_id,correlation_id,
  privacy_classification,payload)VALUES(v_event,'order_request.support_requested',
  'store_order_request',v_request.id,v_request.store_id,v_request.user_id,v_actor,'owner',
  'store_owner_app',p_idempotency_key,p_command_id,v_request.correlation_id,'internal',
  jsonb_build_object('category',p_category));
 SELECT * INTO v_task FROM public.event_action_tasks t WHERE t.dedupe_key='support:'||v_request.id
  AND t.status IN('open','in_progress') FOR UPDATE;
 IF FOUND THEN
  UPDATE public.event_action_tasks SET support_version=support_version+1,event_id=v_event,
   source_request_version=v_request.version
   WHERE id=v_task.id RETURNING * INTO v_task;
 ELSE
  INSERT INTO public.event_action_tasks(event_id,store_id,assigned_role,status,entity_type,
   entity_id,task_type,next_attempt_at,dedupe_key,support_version,source_request_version)
  VALUES(v_event,v_request.store_id,'support_agent','open','store_order_request',v_request.id,
   'platform_support_request',transaction_timestamp(),'support:'||v_request.id,1,v_request.version)
  RETURNING * INTO v_task;
 END IF;
 INSERT INTO public.marketplace_audit_logs(store_id,actor_user_id,action,entity_type,entity_id,details)
 VALUES(v_request.store_id,v_actor,'request_platform_support','store_order_request',v_request.id,
  jsonb_build_object('category',p_category,'commandId',p_command_id,
   'supportVersion',v_task.support_version));
 INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
  entity_type,entity_id,event_id,deep_link,privacy_classification)
 VALUES(v_request.store_id,v_actor,'commerce.order_request.support_requested.store',
  'Support requested','Your support request has been recorded.','store_order_request',
  v_request.id,v_event,'/owner/requests/'||v_request.id,'internal');
 v_response:=jsonb_build_object('data',public.marketplace_get_owner_order_request(v_request.id),
  'supportVersion',v_task.support_version,'commandId',p_command_id,'version',v_request.version);
 RETURN marketplace_sec.complete_phase6_command(v_actor,'request_platform_support',
  p_request_id::TEXT,p_idempotency_key,v_response);
END;$$;

REVOKE ALL ON FUNCTION public.request_platform_support(UUID,INTEGER,TEXT,TEXT,TEXT,UUID)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_platform_support(UUID,INTEGER,TEXT,TEXT,TEXT,UUID)
 TO authenticated,service_role;

COMMIT;
