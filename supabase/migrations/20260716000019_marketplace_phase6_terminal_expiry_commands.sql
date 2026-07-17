-- Phase 6 Unit 9C: named rollout cancellation and typed due-time expiry commands.
BEGIN;

CREATE FUNCTION public.cancel_for_rollout_shutdown(
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
  v_actor,'platform_admin','support_console',p_command_id,p_idempotency_key,p_reason);
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

CREATE FUNCTION marketplace_sec.execute_phase6_expiry(
 p_request_id UUID,p_expected_version INTEGER,p_expiry_kind TEXT,
 p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_replay JSONB;v_next TEXT;
 v_reason TEXT;v_event_type TEXT;v_customer_notification TEXT;v_store_notification TEXT;
 v_task_type TEXT;v_response JSONB;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_expected_version IS NULL OR p_command_id IS NULL OR
  p_expiry_kind NOT IN('expire_customer_decision','expire_payment_ready') THEN
  RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_system_command(p_expiry_kind,p_request_id,
  p_idempotency_key,jsonb_build_object('requestId',p_request_id,
   'expectedVersion',p_expected_version),p_command_id,p_expected_version);
 IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF p_expiry_kind='expire_customer_decision' THEN
  IF v_request.status<>'awaiting_customer_decision' OR v_request.acceptance_expires_at IS NULL OR
   transaction_timestamp()<v_request.acceptance_expires_at THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
  v_next:='expired';v_reason:='customer_decision_window_elapsed';
  v_event_type:='order_request.expired';v_task_type:='customer_decision_expiry';
  v_customer_notification:='commerce.order_request.expired.customer';
  v_store_notification:='commerce.order_request.expired.store';
 ELSE
  IF v_request.status<>'payment_ready' OR v_request.payment_expires_at IS NULL OR
   transaction_timestamp()<v_request.payment_expires_at THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
  v_next:='payment_ready_expired';v_reason:='payment_ready_window_elapsed';
  v_event_type:='order_request.payment_ready_expired';v_task_type:='payment_ready_expiry';
  v_customer_notification:='commerce.order_request.payment_ready_expired.customer';
  v_store_notification:='commerce.order_request.payment_ready_expired.store';
 END IF;
 PERFORM 1 FROM public.store_order_request_items ri WHERE ri.order_request_id=v_request.id
  ORDER BY ri.inventory_id FOR UPDATE;
 PERFORM 1 FROM public.store_inventory i JOIN public.store_order_request_items ri
  ON ri.inventory_id=i.id WHERE ri.order_request_id=v_request.id ORDER BY i.id FOR UPDATE OF i;
 PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
  AND h.status='active' ORDER BY h.id FOR UPDATE;
 PERFORM 1 FROM public.event_action_tasks t WHERE t.entity_type='store_order_request'
  AND t.entity_id=v_request.id AND t.status IN('open','in_progress') ORDER BY t.id FOR UPDATE;
 PERFORM marketplace_sec.release_request_holds(v_request.id,v_reason,p_command_id);
 PERFORM marketplace_sec.record_phase6_request_transition(v_request,v_next,p_expiry_kind,
  v_event_type,v_customer_notification,v_store_notification,NULL,'system','task_worker',
  p_command_id,p_idempotency_key,v_reason);
 UPDATE public.store_order_requests SET status=v_next,status_reason_code=v_reason,
  version=version+1,acceptance_expires_at=NULL,payment_expires_at=NULL,
  terminal_at=transaction_timestamp(),latest_command_id=p_command_id,
  updated_at=transaction_timestamp() WHERE id=v_request.id;
 UPDATE public.event_action_tasks SET status='resolved',resolved_at=transaction_timestamp()
  WHERE entity_type='store_order_request' AND entity_id=v_request.id AND task_type=v_task_type
   AND status IN('open','in_progress');
 UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
  WHERE entity_type='store_order_request' AND entity_id=v_request.id AND task_type<>v_task_type
   AND status IN('open','in_progress');
 PERFORM marketplace_sec.assert_no_active_request_holds(v_request.id);
 v_response:=jsonb_build_object('requestId',v_request.id,'status',v_next,
  'version',v_request.version+1,'commandId',p_command_id);
 RETURN marketplace_sec.complete_phase6_system_command(p_expiry_kind,p_request_id,
  p_idempotency_key,v_response);
END;$$;

CREATE FUNCTION public.expire_customer_decision(UUID,INTEGER,TEXT,UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT marketplace_sec.execute_phase6_expiry($1,$2,'expire_customer_decision',$3,$4)$$;
CREATE FUNCTION public.expire_payment_ready(UUID,INTEGER,TEXT,UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $$SELECT marketplace_sec.execute_phase6_expiry($1,$2,'expire_payment_ready',$3,$4)$$;

REVOKE ALL ON FUNCTION public.cancel_for_rollout_shutdown(UUID,INTEGER,TEXT,TEXT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_for_rollout_shutdown(UUID,INTEGER,TEXT,TEXT,UUID) TO authenticated,service_role;
REVOKE ALL ON FUNCTION marketplace_sec.execute_phase6_expiry(UUID,INTEGER,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.execute_phase6_expiry(UUID,INTEGER,TEXT,TEXT,UUID) TO service_role;
REVOKE ALL ON FUNCTION public.expire_customer_decision(UUID,INTEGER,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.expire_payment_ready(UUID,INTEGER,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_customer_decision(UUID,INTEGER,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_payment_ready(UUID,INTEGER,TEXT,UUID) TO service_role;
COMMIT;
