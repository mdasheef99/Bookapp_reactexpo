-- Phase 6 Unit 7A: bucket-transfer and Owner transition helpers.
BEGIN;

CREATE FUNCTION marketplace_sec.assert_non_stock_rejection_reason(p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=''
AS $$ BEGIN
  IF p_reason NOT IN ('cannot_fulfil_request','store_capacity',
    'fulfilment_method_unsupported','customer_request_not_serviceable',
    'policy_or_compliance_constraint','suspected_abuse','other') THEN
    RAISE EXCEPTION 'INVALID_COMMAND';
  END IF;
END; $$;

CREATE FUNCTION marketplace_sec.assert_unavailable_reason(p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=''
AS $$ BEGIN
  IF p_reason NOT IN ('out_of_stock','sold_offline','damaged','misplaced',
    'wrong_edition','wrong_condition','listing_error','store_ineligible','other') THEN
    RAISE EXCEPTION 'INVALID_COMMAND';
  END IF;
END; $$;

CREATE FUNCTION marketplace_sec.create_bucket_transfer_holds(
  p_request_id UUID,p_hold_type TEXT,p_expires_at TIMESTAMPTZ,p_command_id UUID
)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_row RECORD; v_quantity INTEGER;
BEGIN
  IF p_hold_type NOT IN ('soft','firm') OR p_expires_at<=transaction_timestamp() THEN
    RAISE EXCEPTION 'INVALID_COMMAND';
  END IF;
  FOR v_row IN SELECT ri.id AS request_item_id,ri.inventory_id,ri.store_id,
      ri.confirmed_quantity FROM public.store_order_request_items ri
    WHERE ri.order_request_id=p_request_id AND ri.confirmed_quantity>0
    ORDER BY ri.inventory_id
  LOOP
    v_quantity:=v_row.confirmed_quantity;
    IF EXISTS(SELECT 1 FROM public.inventory_holds h
      WHERE h.order_request_item_id=v_row.request_item_id AND h.status='active') THEN
      RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
    END IF;
    UPDATE public.store_inventory SET
      quantity_available=quantity_available-v_quantity,
      quantity_reserved=quantity_reserved+v_quantity,
      updated_at=transaction_timestamp()
    WHERE id=v_row.inventory_id AND store_id=v_row.store_id
      AND quantity_available>=v_quantity
      AND quantity_total=quantity_available+quantity_reserved+quantity_sold+quantity_removed;
    IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_INVENTORY'; END IF;
    INSERT INTO public.inventory_holds(store_id,inventory_id,order_request_id,
      order_request_item_id,hold_type,status,quantity,expires_at,command_id)
    VALUES(v_row.store_id,v_row.inventory_id,p_request_id,v_row.request_item_id,
      p_hold_type,'active',v_quantity,p_expires_at,p_command_id);
  END LOOP;
END; $$;

CREATE FUNCTION marketplace_sec.release_request_holds(
  p_request_id UUID,p_reason TEXT,p_command_id UUID
)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_hold public.inventory_holds%ROWTYPE;
BEGIN
  FOR v_hold IN SELECT * FROM public.inventory_holds h
    WHERE h.order_request_id=p_request_id AND h.status='active' ORDER BY h.id FOR UPDATE
  LOOP
    UPDATE public.store_inventory SET quantity_reserved=quantity_reserved-v_hold.quantity,
      quantity_available=quantity_available+v_hold.quantity,updated_at=transaction_timestamp()
    WHERE id=v_hold.inventory_id AND quantity_reserved>=v_hold.quantity
      AND quantity_total=quantity_available+quantity_reserved+quantity_sold+quantity_removed;
    IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_COMMAND_FAILED'; END IF;
    UPDATE public.inventory_holds SET status='released',version=version+1,
      release_reason_code=p_reason,released_at=transaction_timestamp()
    WHERE id=v_hold.id AND status='active';
  END LOOP;
END; $$;

CREATE FUNCTION marketplace_sec.record_owner_request_transition(
  p_request public.store_order_requests,p_next_state TEXT,p_command TEXT,
  p_event_type TEXT,p_notification_type TEXT,p_command_id UUID,
  p_idempotency_key TEXT,p_reason TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_event UUID:=gen_random_uuid(); v_actor UUID:=auth.uid();
BEGIN
  INSERT INTO public.marketplace_events(id,event_type,entity_type,entity_id,store_id,user_id,
    actor_user_id,actor_role,source,idempotency_key,command_id,correlation_id,
    privacy_classification,payload)
  VALUES(v_event,p_event_type,'store_order_request',p_request.id,p_request.store_id,
    p_request.user_id,v_actor,'owner','store_owner_app',p_idempotency_key,p_command_id,
    p_request.correlation_id,'internal',jsonb_build_object('nextState',p_next_state,
      'reasonCode',p_reason));
  INSERT INTO public.commerce_transition_log(entity_type,entity_id,previous_state,next_state,
    previous_version,next_version,actor_user_id,actor_role,command_name,command_id,
    idempotency_key,reason_code,correlation_id,event_id)
  VALUES('store_order_request',p_request.id,p_request.status,p_next_state,p_request.version,
    p_request.version+1,v_actor,'owner',p_command,p_command_id,p_idempotency_key,p_reason,
    p_request.correlation_id,v_event);
  INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
    entity_type,entity_id,event_id,deep_link,privacy_classification)
  VALUES(p_request.store_id,p_request.user_id,p_notification_type,'Order request updated',
    'Your order request status has changed.','store_order_request',p_request.id,v_event,
    '/marketplace/requests/'||p_request.id,'internal');
  INSERT INTO public.marketplace_audit_logs(store_id,actor_user_id,action,entity_type,entity_id,details)
  VALUES(p_request.store_id,v_actor,p_command,'store_order_request',p_request.id,
    jsonb_build_object('from',p_request.status,'to',p_next_state,'reasonCode',p_reason,
      'commandId',p_command_id));
  RETURN v_event;
END; $$;

REVOKE ALL ON FUNCTION marketplace_sec.assert_non_stock_rejection_reason(TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.assert_unavailable_reason(TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.create_bucket_transfer_holds(UUID,TEXT,TIMESTAMPTZ,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.release_request_holds(UUID,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.record_owner_request_transition(public.store_order_requests,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.assert_non_stock_rejection_reason(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.assert_unavailable_reason(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.create_bucket_transfer_holds(UUID,TEXT,TIMESTAMPTZ,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.release_request_holds(UUID,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.record_owner_request_transition(public.store_order_requests,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT) TO service_role;
COMMIT;
