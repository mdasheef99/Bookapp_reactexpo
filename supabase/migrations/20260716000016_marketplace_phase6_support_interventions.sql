-- Phase 6 Unit 8D: narrow, audited platform-support interventions.
BEGIN;

CREATE FUNCTION marketplace_sec.record_support_transition(
  p_request public.store_order_requests,p_next_state TEXT,p_command TEXT,
  p_event_type TEXT,p_command_id UUID,p_idempotency_key TEXT,p_reason TEXT
)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_event UUID:=gen_random_uuid();v_actor UUID:=auth.uid();
BEGIN
 INSERT INTO public.marketplace_events(id,event_type,entity_type,entity_id,store_id,user_id,
  actor_user_id,actor_role,source,idempotency_key,command_id,correlation_id,
  privacy_classification,payload)
 VALUES(v_event,p_event_type,'store_order_request',p_request.id,p_request.store_id,
  p_request.user_id,v_actor,'platform_support','support_console',p_idempotency_key,
  p_command_id,p_request.correlation_id,'internal',jsonb_build_object(
   'nextState',p_next_state,'reasonCode',p_reason));
 INSERT INTO public.commerce_transition_log(entity_type,entity_id,previous_state,next_state,
  previous_version,next_version,actor_user_id,actor_role,command_name,command_id,
  idempotency_key,reason_code,correlation_id,event_id)
 VALUES('store_order_request',p_request.id,p_request.status,p_next_state,p_request.version,
  p_request.version+1,v_actor,'platform_support',p_command,p_command_id,p_idempotency_key,
  p_reason,p_request.correlation_id,v_event);
 INSERT INTO public.marketplace_audit_logs(store_id,actor_user_id,action,entity_type,entity_id,details)
 VALUES(p_request.store_id,v_actor,p_command,'store_order_request',p_request.id,
  jsonb_build_object('from',p_request.status,'to',p_next_state,'reasonCode',p_reason,
   'commandId',p_command_id));
 INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
  entity_type,entity_id,event_id,deep_link,privacy_classification)
 VALUES(p_request.store_id,p_request.user_id,
  CASE WHEN p_event_type='order_request.emergency_closure_resumed'
   THEN 'commerce.order_request.closure_resumed.customer'
   ELSE 'commerce.order_request.support_intervened.customer' END,
  'Order request updated','Platform support updated your order request.',
  'store_order_request',p_request.id,v_event,'/marketplace/requests/'||p_request.id,'internal');
 INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
  entity_type,entity_id,event_id,deep_link,privacy_classification)
 SELECT p_request.store_id,sa.user_id,
  CASE WHEN p_event_type='order_request.emergency_closure_resumed'
   THEN 'commerce.order_request.closure_resumed.store'
   ELSE 'commerce.order_request.support_intervened.store' END,
  'Order request updated','Platform support updated an order request.',
  'store_order_request',p_request.id,v_event,'/owner/requests/'||p_request.id,'internal'
 FROM public.store_administrators sa WHERE sa.store_id=p_request.store_id
  AND sa.role='owner' AND sa.status='active'
  AND EXISTS(SELECT 1 FROM public.store_entitlements se
   WHERE se.store_id=sa.store_id
    AND se.feature_key='commerce_order_request_owner_notifications_enabled'
    AND se.is_enabled=true);
 RETURN v_event;
END;$$;

CREATE FUNCTION marketplace_sec.record_support_same_state_event(
 p_request public.store_order_requests,p_command TEXT,p_command_id UUID,
 p_idempotency_key TEXT,p_reason TEXT
)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_event UUID:=gen_random_uuid();v_actor UUID:=auth.uid();
BEGIN
 INSERT INTO public.marketplace_events(id,event_type,entity_type,entity_id,store_id,user_id,
  actor_user_id,actor_role,source,idempotency_key,command_id,correlation_id,
  privacy_classification,payload)
 VALUES(v_event,'order_request.support_intervened','store_order_request',p_request.id,
  p_request.store_id,p_request.user_id,v_actor,'platform_support','support_console',
  p_idempotency_key,p_command_id,p_request.correlation_id,'internal',
  jsonb_build_object('command',p_command,'reasonCode',p_reason));
 INSERT INTO public.marketplace_audit_logs(store_id,actor_user_id,action,entity_type,entity_id,details)
 VALUES(p_request.store_id,v_actor,p_command,'store_order_request',p_request.id,
  jsonb_build_object('state',p_request.status,'reasonCode',p_reason,'commandId',p_command_id));
 INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
  entity_type,entity_id,event_id,deep_link,privacy_classification)
 VALUES(p_request.store_id,p_request.user_id,'commerce.order_request.support_intervened.customer',
  'Order request deadline updated','Platform support updated an order request deadline.',
  'store_order_request',p_request.id,v_event,'/marketplace/requests/'||p_request.id,'internal');
 RETURN v_event;
END;$$;

CREATE FUNCTION marketplace_sec.execute_support_intervention(
 p_request_id UUID,p_expected_version INTEGER,p_command TEXT,p_reason TEXT,
 p_extension_seconds INTEGER,p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor UUID:=auth.uid();v_request public.store_order_requests%ROWTYPE;
 v_replay JSONB;v_event UUID;v_next TEXT;v_due TIMESTAMPTZ;v_response JSONB;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_expected_version IS NULL OR p_command_id IS NULL OR p_reason IS NULL OR
  p_command NOT IN('support_cancel_request','support_extend_confirmation_deadline',
  'support_extend_customer_decision_deadline','support_resume_emergency_pause') THEN
  RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_command(v_actor,p_command,p_request_id::TEXT,
  p_idempotency_key,jsonb_build_object('requestId',p_request_id,
   'expectedVersion',p_expected_version,'reasonCode',p_reason,
   'extensionSeconds',p_extension_seconds),p_command_id,p_expected_version);
 IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF p_command IN('support_extend_customer_decision_deadline','support_resume_emergency_pause') THEN
  IF NOT marketplace_sec.has_platform_role(ARRAY['platform_admin']) THEN
   RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 ELSE
  IF NOT marketplace_sec.has_platform_role(ARRAY['platform_admin','support_agent']) OR
   (NOT marketplace_sec.has_platform_role(ARRAY['platform_admin']) AND
    NOT marketplace_sec.has_assigned_support_case(v_request.id,v_actor)) THEN
   RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 END IF;

 IF p_command='support_cancel_request' THEN
  IF v_request.status IN('unavailable','store_rejected','customer_cancelled','platform_cancelled',
   'expired','payment_ready_expired') OR p_reason IS NULL OR p_reason NOT IN('support_override',
   'customer_contact_issue','technical_error','suspected_abuse') THEN
   RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
  PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
   ORDER BY h.id FOR UPDATE;
  PERFORM marketplace_sec.release_request_holds(v_request.id,p_reason,p_command_id);
  v_event:=marketplace_sec.record_support_transition(v_request,'platform_cancelled',p_command,
   'order_request.support_intervened',p_command_id,p_idempotency_key,p_reason);
  UPDATE public.store_order_requests SET status='platform_cancelled',status_reason_code=p_reason,
   version=version+1,terminal_at=transaction_timestamp(),latest_command_id=p_command_id,
   updated_at=transaction_timestamp() WHERE id=v_request.id;
  UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
   WHERE entity_type='store_order_request' AND entity_id=v_request.id
    AND status IN('open','in_progress') AND task_type<>'platform_support_request';
  UPDATE public.event_action_tasks SET status='resolved',resolved_at=transaction_timestamp()
   WHERE entity_type='store_order_request' AND entity_id=v_request.id
    AND status IN('open','in_progress') AND task_type='platform_support_request';

 ELSIF p_command='support_extend_confirmation_deadline' THEN
  IF v_request.status NOT IN('submitted','store_reviewing') OR
   p_reason NOT IN('technical_error','closure_exception','policy_exception') OR
   p_extension_seconds IS NULL OR p_extension_seconds NOT BETWEEN 300 AND 21600 OR EXISTS(
    SELECT 1 FROM public.marketplace_audit_logs a WHERE a.entity_id=v_request.id
     AND a.action='support_extend_confirmation_deadline') THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
  v_event:=marketplace_sec.record_support_same_state_event(v_request,p_command,p_command_id,
   p_idempotency_key,p_reason);
  v_due:=v_request.confirmation_due_at+make_interval(secs=>p_extension_seconds);
  UPDATE public.store_order_requests SET confirmation_due_at=confirmation_due_at+
   make_interval(secs=>p_extension_seconds),version=version+1,latest_command_id=p_command_id,
   updated_at=transaction_timestamp() WHERE id=v_request.id;
  UPDATE public.event_action_tasks SET event_id=v_event,due_at=v_due,next_attempt_at=v_due,
   status='open',resolved_at=NULL WHERE entity_type='store_order_request'
   AND entity_id=v_request.id AND task_type='confirmation_expiry';
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_COMMAND_FAILED';END IF;

 ELSIF p_command='support_extend_customer_decision_deadline' THEN
  IF v_request.status<>'awaiting_customer_decision' OR
   p_reason NOT IN('technical_error','customer_contact_issue') OR
   p_extension_seconds IS NULL OR p_extension_seconds NOT BETWEEN 300 AND 21600 OR NOT EXISTS(
    SELECT 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
     AND h.hold_type='soft' AND h.status='active' AND h.expires_at>transaction_timestamp()) OR
   EXISTS(SELECT 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
     AND h.hold_type='soft' AND h.status='active' AND h.expires_at<=transaction_timestamp()) THEN
   RAISE EXCEPTION 'INVALID_COMMAND';END IF;
  PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
   AND h.status='active' ORDER BY h.id FOR UPDATE;
  v_event:=marketplace_sec.record_support_same_state_event(v_request,p_command,p_command_id,
   p_idempotency_key,p_reason);
  v_due:=v_request.acceptance_expires_at+make_interval(secs=>p_extension_seconds);
  UPDATE public.store_order_requests SET acceptance_expires_at=v_due,
   decision_seconds_remaining=COALESCE(decision_seconds_remaining,0)+p_extension_seconds,
   version=version+1,latest_command_id=p_command_id,updated_at=transaction_timestamp()
   WHERE id=v_request.id;
  UPDATE public.inventory_holds SET expires_at=v_due WHERE order_request_id=v_request.id
   AND hold_type='soft' AND status='active';
  UPDATE public.event_action_tasks SET event_id=v_event,due_at=v_due,next_attempt_at=v_due,
   status='open',resolved_at=NULL WHERE entity_type='store_order_request'
   AND entity_id=v_request.id AND task_type='customer_decision_expiry';
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_COMMAND_FAILED';END IF;

 ELSE
  IF v_request.status<>'paused_for_emergency_closure' OR
   v_request.paused_from_status NOT IN('submitted','store_reviewing','awaiting_clarification',
    'awaiting_customer_decision') OR p_reason NOT IN('closure_exception','support_override') THEN
   RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
  IF v_request.paused_from_status='awaiting_customer_decision' THEN
   PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
    AND h.hold_type='soft' AND h.status='active' AND h.expires_at>transaction_timestamp()
    ORDER BY h.id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
  END IF;
  v_next:=v_request.paused_from_status;
  v_event:=marketplace_sec.record_support_transition(v_request,v_next,p_command,
   'order_request.emergency_closure_resumed',p_command_id,p_idempotency_key,p_reason);
  UPDATE public.store_order_requests SET status=v_next,status_reason_code=NULL,
   confirmation_due_at=CASE WHEN v_next IN('submitted','store_reviewing') THEN
    transaction_timestamp()+make_interval(secs=>COALESCE(confirmation_open_seconds_remaining,0))
    ELSE confirmation_due_at END,
   acceptance_expires_at=CASE WHEN v_next='awaiting_customer_decision' THEN
    transaction_timestamp()+make_interval(secs=>COALESCE(decision_seconds_remaining,0))
    ELSE acceptance_expires_at END,
   paused_from_status=NULL,closure_exception_id=NULL,closure_pause_expires_at=NULL,
   version=version+1,latest_command_id=p_command_id,updated_at=transaction_timestamp()
   WHERE id=v_request.id;
  UPDATE public.event_action_tasks SET status='resolved',resolved_at=transaction_timestamp()
   WHERE entity_type='store_order_request' AND entity_id=v_request.id
    AND task_type='emergency_pause_expiry' AND status IN('open','in_progress');
 END IF;
 v_response:=jsonb_build_object('requestId',v_request.id,'status',COALESCE(v_next,
  CASE WHEN p_command='support_cancel_request' THEN 'platform_cancelled' ELSE v_request.status END),
  'version',v_request.version+1,'commandId',p_command_id);
 RETURN marketplace_sec.complete_phase6_command(v_actor,p_command,p_request_id::TEXT,
  p_idempotency_key,v_response);
END;$$;

CREATE FUNCTION public.support_cancel_request(p_request_id UUID,p_expected_version INTEGER,
 p_reason TEXT,p_idempotency_key TEXT,p_command_id UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT marketplace_sec.execute_support_intervention($1,$2,'support_cancel_request',$3,NULL,$4,$5)$$;
CREATE FUNCTION public.support_extend_confirmation_deadline(p_request_id UUID,p_expected_version INTEGER,
 p_reason TEXT,p_extension_seconds INTEGER,p_idempotency_key TEXT,p_command_id UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT marketplace_sec.execute_support_intervention($1,$2,'support_extend_confirmation_deadline',$3,$4,$5,$6)$$;
CREATE FUNCTION public.support_extend_customer_decision_deadline(p_request_id UUID,p_expected_version INTEGER,
 p_reason TEXT,p_extension_seconds INTEGER,p_idempotency_key TEXT,p_command_id UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT marketplace_sec.execute_support_intervention($1,$2,'support_extend_customer_decision_deadline',$3,$4,$5,$6)$$;
CREATE FUNCTION public.support_resume_emergency_pause(p_request_id UUID,p_expected_version INTEGER,
 p_reason TEXT,p_idempotency_key TEXT,p_command_id UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT marketplace_sec.execute_support_intervention($1,$2,'support_resume_emergency_pause',$3,NULL,$4,$5)$$;

REVOKE ALL ON FUNCTION marketplace_sec.record_support_transition(public.store_order_requests,TEXT,TEXT,TEXT,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.record_support_same_state_event(public.store_order_requests,TEXT,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.execute_support_intervention(UUID,INTEGER,TEXT,TEXT,INTEGER,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.record_support_transition(public.store_order_requests,TEXT,TEXT,TEXT,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.record_support_same_state_event(public.store_order_requests,TEXT,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.execute_support_intervention(UUID,INTEGER,TEXT,TEXT,INTEGER,TEXT,UUID) TO service_role;
REVOKE ALL ON FUNCTION public.support_cancel_request(UUID,INTEGER,TEXT,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.support_extend_confirmation_deadline(UUID,INTEGER,TEXT,INTEGER,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.support_extend_customer_decision_deadline(UUID,INTEGER,TEXT,INTEGER,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.support_resume_emergency_pause(UUID,INTEGER,TEXT,TEXT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_cancel_request(UUID,INTEGER,TEXT,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.support_extend_confirmation_deadline(UUID,INTEGER,TEXT,INTEGER,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.support_extend_customer_decision_deadline(UUID,INTEGER,TEXT,INTEGER,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.support_resume_emergency_pause(UUID,INTEGER,TEXT,TEXT,UUID) TO authenticated,service_role;
COMMIT;
