-- Phase 6 Unit 9B: customer acceptance and cancellation commands.
BEGIN;

CREATE FUNCTION public.accept_confirmed_changes(
 p_request_id UUID,p_expected_version INTEGER,p_fulfillment_selection TEXT,
 p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor UUID:=auth.uid();v_request public.store_order_requests%ROWTYPE;
 v_replay JSONB;v_subtotal INTEGER;v_tariff INTEGER;v_minimum INTEGER;v_seconds INTEGER;
 v_final_method TEXT;v_tariff_data JSONB;v_policy JSONB;v_expiry TIMESTAMPTZ;
 v_event UUID;v_response JSONB;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_expected_version IS NULL OR p_command_id IS NULL OR
  (p_fulfillment_selection IS NOT NULL AND p_fulfillment_selection NOT IN('pickup','delivery')) THEN
  RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_command(v_actor,'accept_confirmed_changes',
  p_request_id::TEXT,p_idempotency_key,jsonb_build_object('requestId',p_request_id,
   'expectedVersion',p_expected_version,'fulfillmentSelection',p_fulfillment_selection),
  p_command_id,p_expected_version);IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND OR v_request.user_id<>v_actor THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF v_request.status<>'awaiting_customer_decision' THEN
  RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 IF v_request.acceptance_expires_at IS NULL OR
  transaction_timestamp()>=v_request.acceptance_expires_at THEN RAISE EXCEPTION 'REQUEST_WINDOW_EXPIRED';END IF;
 IF EXISTS(SELECT 1 FROM public.order_request_clarifications c
  WHERE c.order_request_id=v_request.id AND c.status='open') THEN
  RAISE EXCEPTION 'INVALID_STATE_TRANSITION';END IF;
 PERFORM 1 FROM public.store_order_request_items ri WHERE ri.order_request_id=v_request.id
  ORDER BY ri.inventory_id FOR UPDATE;
 PERFORM 1 FROM public.store_inventory i JOIN public.store_order_request_items ri
  ON ri.inventory_id=i.id WHERE ri.order_request_id=v_request.id ORDER BY i.id FOR UPDATE OF i;
 PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
  AND h.status='active' ORDER BY h.id FOR UPDATE;
 PERFORM 1 FROM public.event_action_tasks t WHERE t.entity_type='store_order_request'
  AND t.entity_id=v_request.id AND t.status IN('open','in_progress') ORDER BY t.id FOR UPDATE;
 SELECT COALESCE(sum(confirmed_quantity*confirmed_unit_price_minor),0) INTO v_subtotal
  FROM public.store_order_request_items WHERE order_request_id=v_request.id
   AND confirmed_quantity>0 AND confirmed_unit_price_minor IS NOT NULL;
 IF v_subtotal<=0 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_final_method:=COALESCE(p_fulfillment_selection,v_request.fulfillment_method);
 IF v_request.fulfillment_method='pickup' AND v_final_method<>'pickup' THEN
  RAISE EXCEPTION 'INVALID_FULFILMENT';END IF;
 IF v_request.fulfillment_method='delivery' THEN
  v_tariff_data:=marketplace_sec.phase6_snapshot_tariff(v_request.id,'delivery',v_subtotal);
  v_minimum:=(v_tariff_data->>'minimumMinor')::INTEGER;
  IF v_subtotal<v_minimum THEN
   IF p_fulfillment_selection IS NULL OR p_fulfillment_selection<>'pickup' THEN
    RAISE EXCEPTION 'INVALID_FULFILMENT';END IF;
   v_final_method:='pickup';
  END IF;
 END IF;
 PERFORM marketplace_sec.assert_payment_ready_eligibility(v_request.id,v_final_method);
 v_tariff_data:=marketplace_sec.phase6_snapshot_tariff(v_request.id,v_final_method,v_subtotal);
 v_tariff:=(v_tariff_data->>'tariffMinor')::INTEGER;
 IF v_request.final_subtotal_minor IS DISTINCT FROM v_subtotal OR
  (v_final_method=v_request.fulfillment_method AND
   v_request.final_delivery_tariff_minor IS DISTINCT FROM v_tariff) THEN
  RAISE EXCEPTION 'STALE_VERSION';END IF;
 v_policy:=marketplace_sec.resolve_phase6_policy('commerce.payment_ready_window_seconds',
  v_request.store_id,transaction_timestamp());v_seconds:=(v_policy->'value')::INTEGER;
 IF v_seconds IS NULL OR v_seconds NOT BETWEEN 300 AND 86400 THEN
  RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';END IF;
 v_expiry:=transaction_timestamp()+make_interval(secs=>v_seconds);
 PERFORM marketplace_sec.promote_request_soft_holds(v_request.id,v_expiry);
 PERFORM marketplace_sec.assert_payment_ready_holds(v_request.id);
 v_event:=marketplace_sec.record_phase6_request_transition(v_request,'payment_ready',
  'accept_confirmed_changes','order_request.changes_accepted',
  'commerce.order_request.payment_ready.customer','commerce.order_request.changes_accepted.store',
  v_actor,'customer','consumer_app',p_command_id,p_idempotency_key,NULL);
 UPDATE public.store_order_requests SET status='payment_ready',version=version+1,
  accepted_proposal_version=v_request.version,final_subtotal_minor=v_subtotal,
  final_delivery_tariff_minor=v_tariff,final_total_minor=v_subtotal+v_tariff,
  final_fulfillment_method=v_final_method,delivery_tariff_version=
   (v_tariff_data->>'tariffVersion')::INTEGER,acceptance_expires_at=NULL,
  payment_ready_at=transaction_timestamp(),payment_expires_at=v_expiry,
  status_reason_code=NULL,latest_command_id=p_command_id,updated_at=transaction_timestamp()
  WHERE id=v_request.id;
 UPDATE public.event_action_tasks SET status='resolved',resolved_at=transaction_timestamp()
  WHERE entity_type='store_order_request' AND entity_id=v_request.id
   AND task_type='customer_decision_expiry' AND status IN('open','in_progress');
 UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
  WHERE entity_type='store_order_request' AND entity_id=v_request.id
   AND task_type<>'customer_decision_expiry' AND status IN('open','in_progress');
 INSERT INTO public.event_action_tasks(event_id,store_id,status,entity_type,entity_id,task_type,
  due_at,next_attempt_at,dedupe_key) VALUES(v_event,v_request.store_id,'open','store_order_request',
  v_request.id,'payment_ready_expiry',v_expiry,v_expiry,'payment_ready_expiry:'||v_request.id);
 v_response:=jsonb_build_object('data',public.marketplace_get_customer_order_request(v_request.id),
  'commandId',p_command_id,'version',v_request.version+1);
 RETURN marketplace_sec.complete_phase6_command(v_actor,'accept_confirmed_changes',
  p_request_id::TEXT,p_idempotency_key,v_response);
END;$$;

CREATE FUNCTION public.cancel_order_request(
 p_request_id UUID,p_expected_version INTEGER,p_reason TEXT,
 p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor UUID:=auth.uid();v_request public.store_order_requests%ROWTYPE;
 v_replay JSONB;v_response JSONB;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;
 IF p_expected_version IS NULL OR p_command_id IS NULL OR p_reason IS NULL OR
  p_reason NOT IN('customer_requested','other') THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_replay:=marketplace_sec.claim_phase6_command(v_actor,'cancel_order_request',p_request_id::TEXT,
  p_idempotency_key,jsonb_build_object('requestId',p_request_id,'expectedVersion',p_expected_version,
   'reasonCode',p_reason),p_command_id,p_expected_version);
 IF v_replay IS NOT NULL THEN RETURN v_replay;END IF;
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
  ORDER BY r.id FOR UPDATE;
 IF NOT FOUND OR v_request.user_id<>v_actor THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
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
 PERFORM marketplace_sec.record_phase6_request_transition(v_request,'customer_cancelled',
  'cancel_order_request','order_request.cancelled','commerce.order_request.cancelled.customer',
  'commerce.order_request.cancelled.store',v_actor,'customer','consumer_app',p_command_id,
  p_idempotency_key,p_reason);
 UPDATE public.store_order_requests SET status='customer_cancelled',status_reason_code=p_reason,
  version=version+1,acceptance_expires_at=NULL,payment_expires_at=NULL,
  terminal_at=transaction_timestamp(),latest_command_id=p_command_id,
  updated_at=transaction_timestamp() WHERE id=v_request.id;
 UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
  WHERE entity_type='store_order_request' AND entity_id=v_request.id
   AND status IN('open','in_progress');
 PERFORM marketplace_sec.assert_no_active_request_holds(v_request.id);
 v_response:=jsonb_build_object('data',public.marketplace_get_customer_order_request(v_request.id),
  'commandId',p_command_id,'version',v_request.version+1);
 RETURN marketplace_sec.complete_phase6_command(v_actor,'cancel_order_request',p_request_id::TEXT,
  p_idempotency_key,v_response);
END;$$;

REVOKE ALL ON FUNCTION public.accept_confirmed_changes(UUID,INTEGER,TEXT,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cancel_order_request(UUID,INTEGER,TEXT,TEXT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_confirmed_changes(UUID,INTEGER,TEXT,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cancel_order_request(UUID,INTEGER,TEXT,TEXT,UUID) TO authenticated,service_role;
COMMIT;
