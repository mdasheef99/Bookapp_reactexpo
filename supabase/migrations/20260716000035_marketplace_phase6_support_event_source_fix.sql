-- Phase 6 persisted-gate corrective: use the canonical platform_ops event
-- source from the marketplace event envelope. Forward-only replacements.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.record_support_transition(
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
  p_request.user_id,v_actor,'platform_support','platform_ops',p_idempotency_key,
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

CREATE OR REPLACE FUNCTION marketplace_sec.record_support_same_state_event(
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
  p_request.store_id,p_request.user_id,v_actor,'platform_support','platform_ops',
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

CREATE OR REPLACE FUNCTION public.cancel_for_rollout_shutdown(
 p_request_id UUID,p_expected_version INTEGER,p_reason TEXT,
 p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor UUID:=auth.uid();v_request public.store_order_requests%ROWTYPE;
 v_replay JSONB;v_response JSONB;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF NOT marketplace_sec.has_platform_role(ARRAY['platform_admin']) THEN
  RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF p_expected_version IS NULL OR p_command_id IS NULL OR p_reason IS NULL OR
  p_reason<>'feature_disabled' THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_command(v_actor,'cancel_for_rollout_shutdown',
  p_request_id::TEXT,p_idempotency_key,jsonb_build_object('requestId',p_request_id,
   'expectedVersion',p_expected_version,'reasonCode',p_reason),p_command_id,p_expected_version);
 IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status NOT IN('submitted','store_reviewing','awaiting_clarification',
  'awaiting_customer_decision','paused_for_emergency_closure','payment_ready') THEN
  RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 PERFORM 1 FROM public.store_order_request_items ri WHERE ri.order_request_id=v_request.id
  ORDER BY ri.inventory_id FOR UPDATE;
 PERFORM 1 FROM public.store_inventory i JOIN public.store_order_request_items ri
  ON ri.inventory_id=i.id WHERE ri.order_request_id=v_request.id ORDER BY i.id FOR UPDATE OF i;
 PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
  AND h.status='active' ORDER BY h.id FOR UPDATE;
 PERFORM 1 FROM public.event_action_tasks t WHERE t.entity_type='store_order_request'
  AND t.entity_id=v_request.id AND t.status IN('open','in_progress') ORDER BY t.id FOR UPDATE;
 PERFORM marketplace_sec.release_request_holds(v_request.id,p_reason,p_command_id);
 PERFORM marketplace_sec.record_phase6_request_transition(v_request,'platform_cancelled',
  'cancel_for_rollout_shutdown','order_request.cancelled',
  'commerce.order_request.cancelled.customer','commerce.order_request.cancelled.store',
  v_actor,'platform_admin','platform_ops',p_command_id,p_idempotency_key,p_reason);
 UPDATE public.store_order_requests SET status='platform_cancelled',status_reason_code=p_reason,
  version=version+1,acceptance_expires_at=NULL,payment_expires_at=NULL,
  terminal_at=transaction_timestamp(),latest_command_id=p_command_id,
  updated_at=transaction_timestamp() WHERE id=v_request.id;
 UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
  WHERE entity_type='store_order_request' AND entity_id=v_request.id
   AND status IN('open','in_progress');
 PERFORM marketplace_sec.assert_no_active_request_holds(v_request.id);
 v_response:=jsonb_build_object('requestId',v_request.id,'status','platform_cancelled',
  'version',v_request.version+1,'commandId',p_command_id);
 RETURN marketplace_sec.complete_phase6_command(v_actor,'cancel_for_rollout_shutdown',
  p_request_id::TEXT,p_idempotency_key,v_response);
END;$$;

REVOKE ALL ON FUNCTION marketplace_sec.record_support_transition(
 public.store_order_requests,TEXT,TEXT,TEXT,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.record_support_same_state_event(
 public.store_order_requests,TEXT,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_for_rollout_shutdown(UUID,INTEGER,TEXT,TEXT,UUID)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_for_rollout_shutdown(UUID,INTEGER,TEXT,TEXT,UUID)
 TO authenticated,service_role;

COMMIT;
