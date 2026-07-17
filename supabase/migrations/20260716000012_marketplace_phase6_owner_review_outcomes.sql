-- Phase 6 Unit 7B: Store Owner review and confirmation outcome commands.
BEGIN;

CREATE FUNCTION marketplace_sec.execute_owner_outcome(
  p_request_id UUID,p_expected_version INTEGER,p_outcome TEXT,p_items JSONB,
  p_reason TEXT,p_idempotency_key TEXT,p_command_id UUID
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor UUID:=auth.uid(); v_request public.store_order_requests%ROWTYPE;
  v_replay JSONB; v_next TEXT; v_event TEXT; v_notification TEXT; v_hold_type TEXT;
  v_expiry TIMESTAMPTZ; v_policy JSONB; v_seconds INTEGER; v_subtotal INTEGER:=0;
  v_tariff INTEGER:=0; v_total_items INTEGER; v_input_items INTEGER; v_positive INTEGER;
  v_reduced INTEGER; v_row RECORD; v_payload RECORD; v_response JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  v_replay:=marketplace_sec.claim_phase6_command(v_actor,p_outcome,p_request_id::TEXT,
    p_idempotency_key,jsonb_build_object('requestId',p_request_id,'expectedVersion',p_expected_version,
      'items',p_items,'reason',p_reason),p_command_id,p_expected_version);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id
    ORDER BY r.id FOR UPDATE;
  IF NOT FOUND OR NOT marketplace_sec.has_phase6_owner_capability(
    v_request.store_id,'phase6_order_commands') THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  IF v_request.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
  PERFORM 1 FROM public.store_order_request_items ri WHERE ri.order_request_id=v_request.id
    ORDER BY ri.inventory_id FOR UPDATE;
  PERFORM 1 FROM public.store_inventory i JOIN public.store_order_request_items ri
    ON ri.inventory_id=i.id WHERE ri.order_request_id=v_request.id ORDER BY i.id FOR UPDATE OF i;
  PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=v_request.id
    AND h.status='active' ORDER BY h.id FOR UPDATE;
  SELECT count(*) INTO v_total_items FROM public.store_order_request_items
    WHERE order_request_id=v_request.id;

  IF p_outcome='start_store_review' THEN
    IF v_request.status<>'submitted' THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION'; END IF;
    v_next:='store_reviewing'; v_event:='order_request.review_started';
    v_notification:='commerce.order_request.review_started.customer';
  ELSIF p_outcome IN ('confirm_full','confirm_partial') THEN
    IF v_request.status<>'store_reviewing' THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION'; END IF;
    SELECT count(*) INTO v_input_items FROM jsonb_to_recordset(COALESCE(p_items,'[]'))
      AS x(item_id UUID,quantity INTEGER,unit_price_minor INTEGER,reason_code TEXT);
    IF v_input_items<>v_total_items THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
    v_positive:=0; v_reduced:=0;
    FOR v_payload IN SELECT * FROM jsonb_to_recordset(p_items)
      AS x(item_id UUID,quantity INTEGER,unit_price_minor INTEGER,reason_code TEXT)
    LOOP
      SELECT * INTO v_row FROM public.store_order_request_items ri
        WHERE ri.id=v_payload.item_id AND ri.order_request_id=v_request.id FOR UPDATE;
      IF NOT FOUND OR v_payload.quantity IS NULL OR v_payload.unit_price_minor IS NULL
        OR v_payload.quantity<0 OR v_payload.quantity>v_row.requested_quantity OR v_payload.unit_price_minor<0
        OR v_payload.unit_price_minor>v_row.server_bound_unit_price_minor THEN
        RAISE EXCEPTION 'PRICE_BOUND_EXCEEDED';
      END IF;
      IF p_outcome='confirm_full' AND v_payload.quantity<>v_row.requested_quantity THEN
        RAISE EXCEPTION 'INVALID_COMMAND';
      END IF;
      IF v_payload.quantity=0 THEN
        PERFORM marketplace_sec.assert_unavailable_reason(v_payload.reason_code);
      ELSE v_positive:=v_positive+1; END IF;
      IF v_payload.quantity<v_row.requested_quantity THEN v_reduced:=v_reduced+1; END IF;
      UPDATE public.store_order_request_items SET confirmed_quantity=v_payload.quantity,
        confirmed_unit_price_minor=v_payload.unit_price_minor,
        confirmation_status=CASE WHEN v_payload.quantity=0 THEN 'unavailable'
          WHEN v_payload.quantity=requested_quantity THEN 'confirmed_full' ELSE 'confirmed_partial' END,
        unavailable_reason_code=CASE WHEN v_payload.quantity=0 THEN v_payload.reason_code ELSE NULL END,
        version=version+1,updated_at=transaction_timestamp() WHERE id=v_row.id;
      v_subtotal:=v_subtotal+v_payload.quantity*v_payload.unit_price_minor;
    END LOOP;
    IF v_positive=0 THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
    IF p_outcome='confirm_partial' AND v_reduced=0 THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
    IF v_request.fulfillment_method='delivery' THEN
      v_policy:=marketplace_sec.resolve_phase6_policy(
        'commerce.delivery_minimum_subtotal_minor',v_request.store_id,transaction_timestamp());
      IF v_subtotal<(v_policy->'value')::INTEGER THEN RAISE EXCEPTION 'INVALID_FULFILMENT'; END IF;
      v_policy:=marketplace_sec.resolve_phase6_policy(
        'commerce.delivery_free_threshold_minor',v_request.store_id,transaction_timestamp());
      IF v_policy IS NULL OR v_subtotal<(v_policy->'value')::INTEGER THEN
        v_policy:=marketplace_sec.resolve_phase6_policy(
          'commerce.delivery_fixed_tariff_minor',v_request.store_id,transaction_timestamp());
        v_tariff:=(v_policy->'value')::INTEGER;
      END IF;
    END IF;
    IF p_outcome='confirm_full' THEN
      v_next:='payment_ready';v_event:='order_request.confirmed';
      v_notification:='commerce.order_request.payment_ready.customer';v_hold_type:='firm';
      v_policy:=marketplace_sec.resolve_phase6_policy(
        'commerce.payment_ready_window_seconds',v_request.store_id,transaction_timestamp());
    ELSE
      v_next:='awaiting_customer_decision';v_event:='order_request.partially_confirmed';
      v_notification:='commerce.order_request.partial.customer';v_hold_type:='soft';
      v_policy:=marketplace_sec.resolve_phase6_policy(
        'commerce.acceptance_window_seconds',v_request.store_id,transaction_timestamp());
    END IF;
    v_seconds:=(v_policy->'value')::INTEGER;
    IF v_seconds IS NULL OR v_seconds<=0 THEN RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID'; END IF;
    v_expiry:=transaction_timestamp()+make_interval(secs=>v_seconds);
    PERFORM marketplace_sec.create_bucket_transfer_holds(
      v_request.id,v_hold_type,v_expiry,p_command_id);
  ELSIF p_outcome='mark_items_unavailable' THEN
    IF v_request.status<>'store_reviewing' THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION'; END IF;
    SELECT count(*) INTO v_input_items FROM jsonb_to_recordset(COALESCE(p_items,'[]'))
      AS x(item_id UUID,reason_code TEXT);
    IF v_input_items<>v_total_items THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
    FOR v_payload IN SELECT * FROM jsonb_to_recordset(p_items)
      AS x(item_id UUID,reason_code TEXT)
    LOOP
      PERFORM marketplace_sec.assert_unavailable_reason(v_payload.reason_code);
      UPDATE public.store_order_request_items SET confirmed_quantity=0,confirmed_unit_price_minor=NULL,
        confirmation_status='unavailable',unavailable_reason_code=v_payload.reason_code,
        version=version+1,updated_at=transaction_timestamp()
      WHERE id=v_payload.item_id AND order_request_id=v_request.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
    END LOOP;
    v_next:='unavailable';v_event:='order_request.unavailable';
    v_notification:='commerce.order_request.unavailable.customer';
  ELSIF p_outcome='reject_order_request' THEN
    IF v_request.status NOT IN ('submitted','store_reviewing','awaiting_clarification') THEN
      RAISE EXCEPTION 'INVALID_STATE_TRANSITION'; END IF;
    PERFORM marketplace_sec.assert_non_stock_rejection_reason(p_reason);
    PERFORM marketplace_sec.release_request_holds(v_request.id,'store_rejected',p_command_id);
    UPDATE public.store_order_request_items SET confirmed_quantity=0,confirmed_unit_price_minor=NULL,
      confirmation_status='rejected',rejection_reason_code=p_reason,version=version+1,
      updated_at=transaction_timestamp() WHERE order_request_id=v_request.id;
    v_next:='store_rejected';v_event:='order_request.rejected';
    v_notification:='commerce.order_request.rejected.customer';
  ELSE RAISE EXCEPTION 'INVALID_COMMAND'; END IF;

  PERFORM marketplace_sec.record_owner_request_transition(v_request,v_next,p_outcome,v_event,
    v_notification,p_command_id,p_idempotency_key,p_reason);
  UPDATE public.store_order_requests SET status=v_next,version=version+1,
    final_subtotal_minor=CASE WHEN v_hold_type IS NULL THEN final_subtotal_minor ELSE v_subtotal END,
    final_delivery_tariff_minor=CASE WHEN v_hold_type IS NULL THEN final_delivery_tariff_minor ELSE v_tariff END,
    final_total_minor=CASE WHEN v_hold_type IS NULL THEN final_total_minor ELSE v_subtotal+v_tariff END,
    final_fulfillment_method=CASE WHEN v_hold_type IS NULL THEN final_fulfillment_method ELSE fulfillment_method END,
    acceptance_expires_at=CASE WHEN v_hold_type='soft' THEN v_expiry ELSE NULL END,
    payment_expires_at=CASE WHEN v_hold_type='firm' THEN v_expiry ELSE NULL END,
    status_reason_code=p_reason,latest_command_id=p_command_id,
    terminal_at=CASE WHEN v_next IN ('unavailable','store_rejected') THEN transaction_timestamp() ELSE NULL END,
    updated_at=transaction_timestamp() WHERE id=v_request.id;
  IF p_outcome<>'start_store_review' THEN
    UPDATE public.event_action_tasks SET status='cancelled',resolved_at=transaction_timestamp()
      WHERE entity_id=v_request.id AND status IN ('open','in_progress');
  END IF;
  IF v_hold_type IS NOT NULL THEN
    INSERT INTO public.event_action_tasks(store_id,status,entity_type,entity_id,task_type,due_at,
      next_attempt_at,dedupe_key) VALUES(v_request.store_id,'open','store_order_request',v_request.id,
      CASE WHEN v_hold_type='firm' THEN 'payment_ready_expiry' ELSE 'customer_decision_expiry' END,
      v_expiry,v_expiry,CASE WHEN v_hold_type='firm' THEN 'payment_ready_expiry:'
        ELSE 'customer_decision_expiry:' END||v_request.id);
  END IF;
  v_response:=jsonb_build_object('data',public.marketplace_get_owner_order_request(v_request.id),
    'commandId',p_command_id,'version',v_request.version+1);
  RETURN marketplace_sec.complete_phase6_command(v_actor,p_outcome,p_request_id::TEXT,
    p_idempotency_key,v_response);
END; $$;

CREATE FUNCTION public.start_store_review(UUID,INTEGER,TEXT,UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$ SELECT marketplace_sec.execute_owner_outcome($1,$2,'start_store_review','[]',NULL,$3,$4) $$;
CREATE FUNCTION public.confirm_full(UUID,INTEGER,JSONB,TEXT,UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$ SELECT marketplace_sec.execute_owner_outcome($1,$2,'confirm_full',$3,NULL,$4,$5) $$;
CREATE FUNCTION public.confirm_partial(UUID,INTEGER,JSONB,TEXT,UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$ SELECT marketplace_sec.execute_owner_outcome($1,$2,'confirm_partial',$3,NULL,$4,$5) $$;
CREATE FUNCTION public.mark_items_unavailable(UUID,INTEGER,JSONB,TEXT,UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$ SELECT marketplace_sec.execute_owner_outcome($1,$2,'mark_items_unavailable',$3,NULL,$4,$5) $$;
CREATE FUNCTION public.reject_order_request(UUID,INTEGER,TEXT,TEXT,UUID) RETURNS JSONB
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$ SELECT marketplace_sec.execute_owner_outcome($1,$2,'reject_order_request','[]',$3,$4,$5) $$;

REVOKE ALL ON FUNCTION marketplace_sec.execute_owner_outcome(UUID,INTEGER,TEXT,JSONB,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.start_store_review(UUID,INTEGER,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.confirm_full(UUID,INTEGER,JSONB,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.confirm_partial(UUID,INTEGER,JSONB,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.mark_items_unavailable(UUID,INTEGER,JSONB,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.reject_order_request(UUID,INTEGER,TEXT,TEXT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_store_review(UUID,INTEGER,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.confirm_full(UUID,INTEGER,JSONB,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.confirm_partial(UUID,INTEGER,JSONB,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mark_items_unavailable(UUID,INTEGER,JSONB,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reject_order_request(UUID,INTEGER,TEXT,TEXT,UUID) TO authenticated,service_role;
COMMIT;
