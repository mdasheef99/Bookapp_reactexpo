-- Phase 6 Unit 10C: typed clarification-timeout command.
BEGIN;
CREATE FUNCTION public.expire_clarification(
 p_request_id UUID,p_expected_version INTEGER,p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_replay JSONB;v_response JSONB;
 v_reason TEXT:='clarification_window_elapsed';
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_expected_version IS NULL OR p_command_id IS NULL THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_system_command('expire_clarification',p_request_id,
  p_idempotency_key,jsonb_build_object('requestId',p_request_id,
   'expectedVersion',p_expected_version),p_command_id,p_expected_version);
 IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status<>'awaiting_clarification' OR v_request.clarification_expires_at IS NULL OR
  transaction_timestamp()<v_request.clarification_expires_at THEN
  RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 PERFORM 1 FROM public.store_order_request_items ri WHERE ri.order_request_id=v_request.id
  ORDER BY ri.inventory_id FOR UPDATE;
 PERFORM 1 FROM public.store_inventory i JOIN public.store_order_request_items ri
  ON ri.inventory_id=i.id WHERE ri.order_request_id=v_request.id ORDER BY i.id FOR UPDATE OF i;
 PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
  AND h.status='active' ORDER BY h.id FOR UPDATE;
 PERFORM 1 FROM public.event_action_tasks t WHERE t.entity_type='store_order_request'
  AND t.entity_id=v_request.id AND t.status IN('open','in_progress') ORDER BY t.id FOR UPDATE;
 PERFORM marketplace_sec.release_request_holds(v_request.id,v_reason,p_command_id);
 PERFORM marketplace_sec.record_phase6_request_transition(v_request,'expired',
  'expire_clarification','order_request.expired','commerce.order_request.expired.customer',
  'commerce.order_request.expired.store',NULL,'system','task_worker',p_command_id,
  p_idempotency_key,v_reason);
 UPDATE public.order_request_clarifications SET status='expired',version=version+1
  WHERE order_request_id=v_request.id AND status='open';
 UPDATE public.store_order_requests SET status='expired',status_reason_code=v_reason,
  version=version+1,clarification_expires_at=NULL,terminal_at=transaction_timestamp(),
  latest_command_id=p_command_id,updated_at=transaction_timestamp() WHERE id=v_request.id;
 UPDATE public.event_action_tasks SET status='resolved',resolved_at=transaction_timestamp()
  WHERE entity_type='store_order_request' AND entity_id=v_request.id
   AND task_type='clarification_expiry' AND status IN('open','in_progress');
 UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
  WHERE entity_type='store_order_request' AND entity_id=v_request.id
   AND task_type<>'clarification_expiry' AND status IN('open','in_progress');
 PERFORM marketplace_sec.assert_no_active_request_holds(v_request.id);
 v_response:=jsonb_build_object('requestId',v_request.id,'status','expired',
  'version',v_request.version+1,'commandId',p_command_id);
 RETURN marketplace_sec.complete_phase6_system_command('expire_clarification',p_request_id,
  p_idempotency_key,v_response);
END;$$;
REVOKE ALL ON FUNCTION public.expire_clarification(UUID,INTEGER,TEXT,UUID)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_clarification(UUID,INTEGER,TEXT,UUID) TO service_role;
COMMIT;
