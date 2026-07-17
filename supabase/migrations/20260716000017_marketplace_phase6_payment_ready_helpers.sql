-- Phase 6 Unit 9A: payment-ready, hold, evidence, and system-command helpers.
BEGIN;

ALTER TABLE public.store_order_requests
 ADD COLUMN accepted_proposal_version INTEGER CHECK(accepted_proposal_version>=1),
 ADD COLUMN payment_ready_at TIMESTAMPTZ,
 ADD COLUMN payment_ready_policy_snapshot_id UUID
  REFERENCES public.store_order_request_policy_snapshots(id) ON DELETE RESTRICT;

CREATE FUNCTION marketplace_sec.claim_phase6_system_command(
 p_command TEXT,p_request_id UUID,p_idempotency_key TEXT,p_payload JSONB,
 p_command_id UUID,p_expected_version INTEGER
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_scope TEXT:='system:'||p_command||':'||p_request_id;v_hash TEXT;
 v_existing public.commerce_idempotency_keys%ROWTYPE;
BEGIN
 IF p_command IS NULL OR p_request_id IS NULL OR p_command_id IS NULL OR
  p_expected_version IS NULL OR p_idempotency_key IS NULL OR length(p_idempotency_key)<8 THEN
  RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 v_hash:=encode(extensions.digest(p_payload::TEXT,'sha256'),'hex');
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(v_scope||':'||p_idempotency_key,0));
 SELECT * INTO v_existing FROM public.commerce_idempotency_keys k
  WHERE k.scope=v_scope AND k.key=p_idempotency_key FOR UPDATE;
 IF FOUND AND v_existing.expires_at<=transaction_timestamp() THEN
  DELETE FROM public.commerce_idempotency_keys WHERE id=v_existing.id;v_existing:=NULL;
 ELSIF FOUND THEN
  IF v_existing.request_hash<>v_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED';END IF;
  IF v_existing.status='in_progress' THEN RAISE EXCEPTION 'COMMAND_IN_PROGRESS';END IF;
  IF v_existing.status='completed' THEN
   RETURN v_existing.response_snapshot||jsonb_build_object('idempotencyReplay',true);END IF;
 END IF;
 INSERT INTO public.commerce_idempotency_keys(scope,key,request_hash,status,expires_at,
  command_name,logical_entity_id,command_id,expected_version,correlation_id)
 VALUES(v_scope,p_idempotency_key,v_hash,'in_progress',transaction_timestamp()+interval '7 days',
  p_command,p_request_id,p_command_id,p_expected_version,p_command_id);
 RETURN NULL;
END;$$;

CREATE FUNCTION marketplace_sec.complete_phase6_system_command(
 p_command TEXT,p_request_id UUID,p_idempotency_key TEXT,p_response JSONB
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_scope TEXT:='system:'||p_command||':'||p_request_id;
BEGIN
 UPDATE public.commerce_idempotency_keys SET status='completed',response_snapshot=p_response
  WHERE scope=v_scope AND key=p_idempotency_key AND status='in_progress';
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMAND_IN_PROGRESS';END IF;
 RETURN p_response||jsonb_build_object('idempotencyReplay',false);
END;$$;

CREATE FUNCTION marketplace_sec.phase6_snapshot_tariff(
 p_request_id UUID,p_fulfillment_method TEXT,p_subtotal_minor INTEGER
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_minimum INTEGER;v_fixed INTEGER;v_free INTEGER;v_version INTEGER;
BEGIN
 IF p_subtotal_minor IS NULL OR p_subtotal_minor<0 OR
  p_fulfillment_method NOT IN('pickup','delivery') THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 IF p_fulfillment_method='pickup' THEN
  RETURN jsonb_build_object('tariffMinor',0,'tariffVersion',1,'minimumMinor',0);END IF;
 SELECT (s.resolved_value)::INTEGER,s.source_policy_version INTO v_minimum,v_version
  FROM public.store_order_request_policy_snapshots s WHERE s.order_request_id=p_request_id
   AND s.policy_key='commerce.delivery_minimum_subtotal_minor';
 SELECT (s.resolved_value)::INTEGER,GREATEST(v_version,s.source_policy_version) INTO v_fixed,v_version
  FROM public.store_order_request_policy_snapshots s WHERE s.order_request_id=p_request_id
   AND s.policy_key='commerce.delivery_fixed_tariff_minor';
 SELECT (s.resolved_value)::INTEGER,GREATEST(v_version,s.source_policy_version) INTO v_free,v_version
  FROM public.store_order_request_policy_snapshots s WHERE s.order_request_id=p_request_id
   AND s.policy_key='commerce.delivery_free_threshold_minor';
 IF v_minimum IS NULL OR v_fixed IS NULL OR v_free IS NULL OR v_version IS NULL OR
  v_minimum<0 OR v_fixed<0 OR v_free<v_minimum THEN
  RAISE EXCEPTION 'DELIVERY_TARIFF_UNAVAILABLE';END IF;
 RETURN jsonb_build_object('tariffMinor',CASE WHEN p_subtotal_minor>=v_free THEN 0 ELSE v_fixed END,
  'tariffVersion',v_version,'minimumMinor',v_minimum);
END;$$;

CREATE FUNCTION marketplace_sec.assert_payment_ready_eligibility(
 p_request_id UUID,p_final_method TEXT
)
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.store_order_requests%ROWTYPE;v_expected INTEGER;v_valid INTEGER;
BEGIN
 SELECT * INTO v_request FROM public.store_order_requests r WHERE r.id=p_request_id;
 IF NOT FOUND OR p_final_method NOT IN('pickup','delivery') OR NOT EXISTS(
  SELECT 1 FROM public.stores s WHERE s.id=v_request.store_id AND s.status='active'
   AND s.verification_status='approved' AND s.setup_status='complete'
   AND s.selling_status='allowed' AND s.locality_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.marketplace_localities ml WHERE ml.id=s.locality_id
    AND ml.is_pilot_enabled=true)
   AND CASE p_final_method WHEN 'pickup' THEN s.pickup_enabled ELSE s.delivery_enabled END) THEN
  RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
 IF NOT COALESCE((SELECT ss.status IN('trialing','active','past_due','grace_period')
  FROM public.store_subscriptions ss WHERE ss.store_id=v_request.store_id
  ORDER BY ss.updated_at DESC,ss.id DESC LIMIT 1),false) OR NOT EXISTS(
   SELECT 1 FROM public.store_entitlements se WHERE se.store_id=v_request.store_id
    AND se.feature_key='commerce_order_requests_enabled' AND se.is_enabled=true) OR NOT EXISTS(
   SELECT 1 FROM public.store_administrators sa WHERE sa.store_id=v_request.store_id
    AND sa.role='owner' AND sa.status='active' AND EXISTS(SELECT 1 FROM public.store_entitlements se
     WHERE se.store_id=sa.store_id AND se.feature_key=
      'commerce_order_request_owner_commands_enabled' AND se.is_enabled=true)
    AND EXISTS(SELECT 1 FROM public.store_entitlements se WHERE se.store_id=sa.store_id
     AND se.feature_key='commerce_order_request_owner_notifications_enabled' AND se.is_enabled=true)) THEN
  RAISE EXCEPTION 'STORE_COMMAND_NOT_ENTITLED';END IF;
 IF NOT COALESCE((marketplace_sec.resolve_phase6_policy('marketplace_enabled',v_request.store_id,
  transaction_timestamp())->'value')::BOOLEAN,false) OR NOT COALESCE((
  marketplace_sec.resolve_phase6_policy('cart_order_request_enabled',v_request.store_id,
  transaction_timestamp())->'value')::BOOLEAN,false) OR NOT COALESCE((
  marketplace_sec.resolve_phase6_policy('commerce.store_allowlisted',v_request.store_id,
  transaction_timestamp())->'value')::BOOLEAN,false) OR NOT COALESCE((
  marketplace_sec.resolve_phase6_policy(CASE p_final_method WHEN 'pickup' THEN 'pickup_enabled'
   ELSE 'delivery_enabled' END,v_request.store_id,transaction_timestamp())->'value')::BOOLEAN,false)
  THEN RAISE EXCEPTION 'COMMERCE_ROLLOUT_DISABLED';END IF;
 SELECT count(*) INTO v_expected FROM public.store_order_request_items ri
  WHERE ri.order_request_id=v_request.id AND ri.confirmed_quantity>0;
 SELECT count(*) INTO v_valid FROM public.store_order_request_items ri
  JOIN public.marketplace_book_listings l ON l.id=ri.listing_id AND l.inventory_id=ri.inventory_id
  WHERE ri.order_request_id=v_request.id AND ri.confirmed_quantity>0
   AND l.store_id=v_request.store_id AND l.status IN('active','paused')
   AND l.moderation_status='approved' AND CASE p_final_method
    WHEN 'pickup' THEN ri.pickup_eligible_snapshot AND l.pickup_available
    ELSE ri.delivery_eligible_snapshot AND l.delivery_available END
   AND EXISTS(SELECT 1 FROM public.inventory_holds h WHERE h.order_request_item_id=ri.id
    AND h.status='active' AND h.quantity=ri.confirmed_quantity
    AND h.expires_at>transaction_timestamp());
 IF v_expected=0 OR v_valid<>v_expected THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';END IF;
END;$$;

CREATE FUNCTION marketplace_sec.promote_request_soft_holds(
 p_request_id UUID,p_expires_at TIMESTAMPTZ
)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_expected INTEGER;v_valid INTEGER;
BEGIN
 IF p_expires_at IS NULL OR p_expires_at<=transaction_timestamp() THEN
  RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 PERFORM 1 FROM public.inventory_holds h WHERE h.order_request_id=p_request_id
  AND h.status='active' ORDER BY h.id FOR UPDATE;
 SELECT count(*) INTO v_expected FROM public.store_order_request_items ri
  WHERE ri.order_request_id=p_request_id AND ri.confirmed_quantity>0;
 SELECT count(*) INTO v_valid FROM public.store_order_request_items ri
  JOIN public.inventory_holds h ON h.order_request_item_id=ri.id
  WHERE ri.order_request_id=p_request_id AND ri.confirmed_quantity>0
   AND h.hold_type='soft' AND h.status='active' AND h.quantity=ri.confirmed_quantity
   AND h.expires_at>transaction_timestamp();
 IF v_expected=0 OR v_valid<>v_expected OR v_valid<>(SELECT count(*)
  FROM public.inventory_holds h WHERE h.order_request_id=p_request_id AND h.status='active')
  OR EXISTS(SELECT 1 FROM public.inventory_holds h
  WHERE h.order_request_id=p_request_id AND h.status='active' AND h.hold_type<>'soft') THEN
  RAISE EXCEPTION 'HOLD_EXPIRED';END IF;
 UPDATE public.inventory_holds SET hold_type='firm',expires_at=p_expires_at,version=version+1
  WHERE order_request_id=p_request_id AND hold_type='soft' AND status='active';
END;$$;

CREATE FUNCTION marketplace_sec.assert_payment_ready_holds(p_request_id UUID)
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_order_request_items ri WHERE ri.order_request_id=p_request_id
  AND ri.confirmed_quantity>0) OR EXISTS(SELECT 1 FROM public.store_order_request_items ri
  LEFT JOIN public.inventory_holds h ON h.order_request_item_id=ri.id AND h.status='active'
  WHERE ri.order_request_id=p_request_id AND ri.confirmed_quantity>0 AND
   (h.id IS NULL OR h.hold_type<>'firm' OR h.quantity<>ri.confirmed_quantity OR
    h.expires_at<=transaction_timestamp())) OR EXISTS(SELECT 1 FROM public.inventory_holds h
   JOIN public.store_order_request_items ri ON ri.id=h.order_request_item_id
   WHERE h.order_request_id=p_request_id AND h.status='active' AND
    (h.hold_type<>'firm' OR ri.confirmed_quantity IS NULL OR ri.confirmed_quantity<=0 OR
     h.quantity<>ri.confirmed_quantity)) THEN
  RAISE EXCEPTION 'COMMERCE_COMMAND_FAILED';END IF;
END;$$;

CREATE FUNCTION marketplace_sec.enforce_payment_ready_invariants()
RETURNS TRIGGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF OLD.status='payment_ready' AND (NEW.final_subtotal_minor IS DISTINCT FROM OLD.final_subtotal_minor
  OR NEW.final_delivery_tariff_minor IS DISTINCT FROM OLD.final_delivery_tariff_minor
  OR NEW.final_total_minor IS DISTINCT FROM OLD.final_total_minor
  OR NEW.final_fulfillment_method IS DISTINCT FROM OLD.final_fulfillment_method
  OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
  OR NEW.payment_ready_policy_snapshot_id IS DISTINCT FROM OLD.payment_ready_policy_snapshot_id) THEN
  RAISE EXCEPTION 'COMMERCE_COMMAND_FAILED';END IF;
 IF NEW.status='payment_ready' AND OLD.status IS DISTINCT FROM 'payment_ready' THEN
  IF NEW.currency_code<>'INR' OR NEW.final_subtotal_minor IS NULL OR
   NEW.final_subtotal_minor<=0 OR NEW.final_delivery_tariff_minor IS NULL OR
   NEW.final_total_minor<>NEW.final_subtotal_minor+NEW.final_delivery_tariff_minor OR
   NEW.final_fulfillment_method NOT IN('pickup','delivery') OR NEW.payment_expires_at IS NULL OR
   NEW.payment_expires_at<=transaction_timestamp() OR EXISTS(SELECT 1
    FROM public.order_request_clarifications c WHERE c.order_request_id=NEW.id AND c.status='open') THEN
   RAISE EXCEPTION 'COMMERCE_COMMAND_FAILED';END IF;
  PERFORM marketplace_sec.assert_payment_ready_holds(NEW.id);
  NEW.payment_ready_at:=COALESCE(NEW.payment_ready_at,transaction_timestamp());
  SELECT s.id INTO NEW.payment_ready_policy_snapshot_id
   FROM public.store_order_request_policy_snapshots s WHERE s.order_request_id=NEW.id
    AND s.policy_key='commerce.delivery_fixed_tariff_minor';
  IF NEW.payment_ready_policy_snapshot_id IS NULL THEN
   RAISE EXCEPTION 'COMMERCE_COMMAND_FAILED';END IF;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER store_order_requests_payment_ready_guard
 BEFORE UPDATE ON public.store_order_requests FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.enforce_payment_ready_invariants();

CREATE FUNCTION marketplace_sec.assert_no_active_request_holds(p_request_id UUID)
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.inventory_holds h WHERE h.order_request_id=p_request_id
  AND h.status='active') THEN RAISE EXCEPTION 'COMMERCE_COMMAND_FAILED';END IF;
END;$$;

CREATE FUNCTION marketplace_sec.enforce_phase6_terminal_invariants()
RETURNS TRIGGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF NEW.status IN('unavailable','store_rejected','customer_cancelled','platform_cancelled',
  'expired','payment_ready_expired') AND OLD.status IS DISTINCT FROM NEW.status THEN
  PERFORM marketplace_sec.assert_no_active_request_holds(NEW.id);
  UPDATE public.order_request_clarifications SET status='cancelled',version=version+1
   WHERE order_request_id=NEW.id AND status='open';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER store_order_requests_terminal_guard
 AFTER UPDATE ON public.store_order_requests FOR EACH ROW
 EXECUTE FUNCTION marketplace_sec.enforce_phase6_terminal_invariants();

CREATE FUNCTION marketplace_sec.record_phase6_request_transition(
 p_request public.store_order_requests,p_next_state TEXT,p_command TEXT,p_event_type TEXT,
 p_customer_notification TEXT,p_store_notification TEXT,p_actor UUID,p_actor_role TEXT,
 p_source TEXT,p_command_id UUID,p_idempotency_key TEXT,p_reason TEXT
)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_event UUID:=gen_random_uuid();
BEGIN
 INSERT INTO public.marketplace_events(id,event_type,entity_type,entity_id,store_id,user_id,
  actor_user_id,actor_role,source,idempotency_key,command_id,correlation_id,
  privacy_classification,payload) VALUES(v_event,p_event_type,'store_order_request',p_request.id,
  p_request.store_id,p_request.user_id,p_actor,p_actor_role,p_source,p_idempotency_key,p_command_id,
  p_request.correlation_id,'internal',jsonb_build_object('nextState',p_next_state,'reasonCode',p_reason));
 INSERT INTO public.commerce_transition_log(entity_type,entity_id,previous_state,next_state,
  previous_version,next_version,actor_user_id,actor_role,command_name,command_id,idempotency_key,
  reason_code,correlation_id,event_id) VALUES('store_order_request',p_request.id,p_request.status,
  p_next_state,p_request.version,p_request.version+1,p_actor,p_actor_role,p_command,p_command_id,
  p_idempotency_key,p_reason,p_request.correlation_id,v_event);
 INSERT INTO public.marketplace_audit_logs(store_id,actor_user_id,action,entity_type,entity_id,details)
 VALUES(p_request.store_id,p_actor,p_command,'store_order_request',p_request.id,
  jsonb_build_object('from',p_request.status,'to',p_next_state,'reasonCode',p_reason,
   'commandId',p_command_id));
 IF p_customer_notification IS NOT NULL THEN
  INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
   entity_type,entity_id,event_id,deep_link,privacy_classification)
  VALUES(p_request.store_id,p_request.user_id,p_customer_notification,'Order request updated',
   'Your order request status has changed.','store_order_request',p_request.id,v_event,
   '/marketplace/requests/'||p_request.id,'internal');
 END IF;
 IF p_store_notification IS NOT NULL THEN
  INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
   entity_type,entity_id,event_id,deep_link,privacy_classification)
  SELECT p_request.store_id,sa.user_id,p_store_notification,'Order request updated',
   'An order request status has changed.','store_order_request',p_request.id,v_event,
   '/owner/requests/'||p_request.id,'internal' FROM public.store_administrators sa
  WHERE sa.store_id=p_request.store_id AND sa.role='owner' AND sa.status='active'
   AND EXISTS(SELECT 1 FROM public.store_entitlements se WHERE se.store_id=sa.store_id
    AND se.feature_key='commerce_order_request_owner_notifications_enabled' AND se.is_enabled=true);
 END IF;
 RETURN v_event;
END;$$;

REVOKE ALL ON FUNCTION marketplace_sec.claim_phase6_system_command(TEXT,UUID,TEXT,JSONB,UUID,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.complete_phase6_system_command(TEXT,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.phase6_snapshot_tariff(UUID,TEXT,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.assert_payment_ready_eligibility(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.promote_request_soft_holds(UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.assert_payment_ready_holds(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.enforce_payment_ready_invariants() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.assert_no_active_request_holds(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.enforce_phase6_terminal_invariants() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.record_phase6_request_transition(public.store_order_requests,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.claim_phase6_system_command(TEXT,UUID,TEXT,JSONB,UUID,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.complete_phase6_system_command(TEXT,UUID,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase6_snapshot_tariff(UUID,TEXT,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.assert_payment_ready_eligibility(UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.promote_request_soft_holds(UUID,TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.assert_payment_ready_holds(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.enforce_payment_ready_invariants() TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.assert_no_active_request_holds(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.enforce_phase6_terminal_invariants() TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.record_phase6_request_transition(public.store_order_requests,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT,UUID,TEXT,TEXT) TO service_role;
COMMIT;
