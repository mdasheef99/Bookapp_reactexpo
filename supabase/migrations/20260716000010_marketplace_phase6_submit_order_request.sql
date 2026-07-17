-- Phase 6 Unit 6B: atomic unpaid order-request submission.
BEGIN;

CREATE FUNCTION public.submit_order_request(
  p_cart_id UUID, p_expected_version INTEGER, p_fulfillment_method TEXT,
  p_customer_note TEXT, p_contact_snapshot JSONB, p_delivery_address_snapshot JSONB,
  p_idempotency_key TEXT, p_command_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid(); v_cart public.marketplace_carts%ROWTYPE;
  v_request_id UUID := gen_random_uuid(); v_request_command UUID;
  v_cart_command UUID; v_request_event UUID := gen_random_uuid();
  v_cart_event UUID := gen_random_uuid(); v_replay JSONB; v_response JSONB;
  v_items JSONB; v_subtotal INTEGER; v_eligibility JSONB; v_owner_count INTEGER;
  v_cart_item_count INTEGER; v_valid_item_count INTEGER;
  v_tolerance INTEGER; v_window JSONB; v_now TIMESTAMPTZ := transaction_timestamp();
  v_store public.stores%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_fulfillment_method NOT IN ('pickup','delivery') THEN RAISE EXCEPTION 'INVALID_FULFILMENT'; END IF;
  IF p_customer_note IS NOT NULL AND char_length(p_customer_note)>1000 THEN
    RAISE EXCEPTION 'INVALID_COMMAND';
  END IF;
  v_replay := marketplace_sec.claim_phase6_command(
    v_actor,'submit_order_request',p_cart_id::TEXT,p_idempotency_key,
    jsonb_build_object('cartId',p_cart_id,'expectedVersion',p_expected_version,
      'fulfillmentMethod',p_fulfillment_method,'customerNote',p_customer_note,
      'contact',p_contact_snapshot,'address',p_delivery_address_snapshot),
    p_command_id,p_expected_version
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('phase6-cart:'||v_actor::TEXT,0));
  SELECT * INTO v_cart FROM public.marketplace_carts c
  WHERE c.id=p_cart_id AND c.user_id=v_actor AND c.status='active'
  ORDER BY c.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  IF v_cart.version<>p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
  IF v_cart.expires_at<=v_now THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;

  PERFORM 1 FROM public.marketplace_cart_items ci WHERE ci.cart_id=v_cart.id
    ORDER BY ci.listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  PERFORM 1 FROM public.marketplace_book_listings l
    JOIN public.marketplace_cart_items ci ON ci.listing_id=l.id
    WHERE ci.cart_id=v_cart.id ORDER BY l.id FOR UPDATE OF l;
  PERFORM 1 FROM public.store_inventory i
    JOIN public.marketplace_cart_items ci ON ci.inventory_id=i.id
    WHERE ci.cart_id=v_cart.id ORDER BY i.id FOR UPDATE OF i;

  SELECT count(*) INTO v_cart_item_count FROM public.marketplace_cart_items
    WHERE cart_id=v_cart.id;
  SELECT jsonb_agg(jsonb_build_object('listing_id',l.id,'inventory_id',i.id,
      'requested_quantity',ci.requested_quantity) ORDER BY l.id),
    sum(ci.requested_quantity*LEAST(l.selling_price_minor,ci.price_snapshot_minor))::INTEGER,
    count(*)::INTEGER
  INTO v_items,v_subtotal,v_valid_item_count
  FROM public.marketplace_cart_items ci
  JOIN public.marketplace_book_listings l ON l.id=ci.listing_id
  JOIN public.store_inventory i ON i.id=ci.inventory_id
  WHERE ci.cart_id=v_cart.id AND ci.store_id=v_cart.store_id
    AND l.store_id=v_cart.store_id AND i.store_id=v_cart.store_id;
  IF v_items IS NULL OR v_valid_item_count<>v_cart_item_count THEN
    RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';
  END IF;
  v_eligibility := marketplace_sec.evaluate_phase6_eligibility(
    v_cart.store_id,'submit_request',p_fulfillment_method,v_items,v_subtotal,v_now
  );
  IF v_eligibility->>'outcome'<>'allow' THEN
    RAISE EXCEPTION '%',COALESCE(v_eligibility->>'error_code','COMMERCE_ENTITY_UNAVAILABLE');
  END IF;
  SELECT count(DISTINCT sa.user_id) INTO v_owner_count
  FROM public.store_administrators sa
  WHERE sa.store_id=v_cart.store_id AND sa.role='owner' AND sa.status='active'
    AND EXISTS(SELECT 1 FROM public.store_entitlements se WHERE se.store_id=sa.store_id
      AND se.feature_key='commerce_order_request_owner_commands_enabled' AND se.is_enabled=true)
    AND EXISTS(SELECT 1 FROM public.store_entitlements se WHERE se.store_id=sa.store_id
      AND se.feature_key='commerce_order_request_owner_notifications_enabled' AND se.is_enabled=true);
  IF v_owner_count=0 THEN RAISE EXCEPTION 'ENTITLED_OWNER_UNAVAILABLE'; END IF;

  v_tolerance := (marketplace_sec.resolve_phase6_policy(
    'commerce.price_drift_tolerance_minor',v_cart.store_id,v_now)->'value')::INTEGER;
  IF v_tolerance IS NULL OR v_tolerance<0 THEN RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID'; END IF;
  v_window := marketplace_sec.submission_confirmation_window(v_cart.store_id,v_now);
  SELECT * INTO v_store FROM public.stores WHERE id=v_cart.store_id;
  v_request_command:=marketplace_sec.derived_command_uuid(p_command_id,'order-request-create');
  v_cart_command:=marketplace_sec.derived_command_uuid(p_command_id,'cart-submit');

  INSERT INTO public.store_order_requests(
    id,user_id,store_id,cart_id,status,fulfillment_method,currency_code,
    requested_subtotal_minor,provisional_delivery_tariff_minor,
    money_calculator_version,delivery_tariff_version,confirmation_reminder_at,
    confirmation_due_at,correlation_id,latest_command_id,customer_note
  ) VALUES(
    v_request_id,v_actor,v_cart.store_id,v_cart.id,'submitted',p_fulfillment_method,
    'INR',v_subtotal,COALESCE((v_eligibility->>'deliveryTariffMinor')::INTEGER,
      (v_eligibility->>'delivery_tariff_minor')::INTEGER,0),1,
    COALESCE((v_eligibility->>'deliveryTariffVersion')::INTEGER,
      (v_eligibility->>'delivery_tariff_version')::INTEGER,1),
    (v_window->>'reminderAt')::TIMESTAMPTZ,(v_window->>'dueAt')::TIMESTAMPTZ,
    p_command_id,v_request_command,p_customer_note
  );
  INSERT INTO public.store_order_request_items(
    order_request_id,store_id,listing_id,inventory_id,canonical_work_id,
    canonical_edition_id,title_snapshot,authors_snapshot,isbn_10_snapshot,
    isbn_13_snapshot,condition_snapshot,condition_notes_snapshot,image_url_snapshot,
    requested_quantity,server_bound_unit_price_minor,currency_code,
    price_drift_review_required,pickup_eligible_snapshot,delivery_eligible_snapshot
  ) SELECT v_request_id,v_cart.store_id,l.id,i.id,l.canonical_work_id,l.canonical_edition_id,
    l.public_title,to_jsonb(l.public_authors),l.isbn_10,l.isbn_13,l.condition,
    l.public_condition_notes,l.public_cover_url,ci.requested_quantity,
    LEAST(l.selling_price_minor,ci.price_snapshot_minor),'INR',
    l.selling_price_minor-ci.price_snapshot_minor>v_tolerance,
    l.pickup_available,l.delivery_available
  FROM public.marketplace_cart_items ci
  JOIN public.marketplace_book_listings l ON l.id=ci.listing_id
  JOIN public.store_inventory i ON i.id=ci.inventory_id WHERE ci.cart_id=v_cart.id;
  INSERT INTO public.store_order_request_private_snapshots(
    order_request_id,customer_user_id,contact_snapshot,delivery_address_snapshot
  ) VALUES(v_request_id,v_actor,p_contact_snapshot,
    CASE WHEN p_fulfillment_method='delivery' THEN p_delivery_address_snapshot ELSE NULL END);
  INSERT INTO public.store_order_request_seller_snapshots(order_request_id,seller_snapshot)
  VALUES(v_request_id,jsonb_build_object('storeId',v_store.id,'displayName',v_store.display_name,
    'legalSellerName',v_store.legal_seller_name,'returnPolicyType',v_store.return_policy_type));
  PERFORM marketplace_sec.snapshot_submission_policies(v_request_id,v_cart.store_id,v_now);

  INSERT INTO public.marketplace_events(id,event_type,entity_type,entity_id,store_id,user_id,
    actor_user_id,actor_role,source,idempotency_key,command_id,correlation_id,
    privacy_classification,payload)
  VALUES(v_request_event,'order_request.submitted','store_order_request',v_request_id,
    v_cart.store_id,v_actor,v_actor,'customer','consumer_app',p_idempotency_key||':request',
    v_request_command,p_command_id,'internal',jsonb_build_object('status','submitted'));
  INSERT INTO public.commerce_entity_creation_log(entity_type,entity_id,initial_state,
    initial_version,actor_user_id,actor_role,command_name,command_id,idempotency_key,
    correlation_id,event_id)
  VALUES('store_order_request',v_request_id,'submitted',1,v_actor,'customer',
    'submit_order_request',v_request_command,p_idempotency_key||':request',p_command_id,v_request_event);
  INSERT INTO public.marketplace_events(id,event_type,entity_type,entity_id,store_id,user_id,
    actor_user_id,actor_role,source,idempotency_key,command_id,correlation_id,
    privacy_classification,payload)
  VALUES(v_cart_event,'marketplace_cart.submitted','marketplace_cart',v_cart.id,v_cart.store_id,
    v_actor,v_actor,'customer','consumer_app',p_idempotency_key||':cart',v_cart_command,
    p_command_id,'internal',jsonb_build_object('nextState','submitted'));
  INSERT INTO public.commerce_transition_log(entity_type,entity_id,previous_state,next_state,
    previous_version,next_version,actor_user_id,actor_role,command_name,command_id,
    idempotency_key,correlation_id,event_id)
  VALUES('marketplace_cart',v_cart.id,'active','submitted',v_cart.version,v_cart.version+1,
    v_actor,'customer','submit_order_request',v_cart_command,p_idempotency_key||':cart',
    p_command_id,v_cart_event);
  UPDATE public.marketplace_carts SET status='submitted',version=version+1,updated_at=v_now
    WHERE id=v_cart.id;

  INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
    entity_type,entity_id,event_id,deep_link,privacy_classification)
  VALUES(v_cart.store_id,v_actor,'commerce.order_request.submitted.customer','Request sent',
    'The store will confirm availability.','store_order_request',v_request_id,v_request_event,
    '/marketplace/requests/'||v_request_id,'internal');
  INSERT INTO public.marketplace_notifications(store_id,user_id,notification_type,title,body,
    entity_type,entity_id,event_id,deep_link,privacy_classification)
  SELECT v_cart.store_id,sa.user_id,'commerce.order_request.submitted.store','New order request',
    'Review availability before the deadline.','store_order_request',v_request_id,v_request_event,
    '/owner/requests/'||v_request_id,'internal'
  FROM public.store_administrators sa WHERE sa.store_id=v_cart.store_id
    AND sa.role='owner' AND sa.status='active';
  INSERT INTO public.event_action_tasks(event_id,store_id,status,entity_type,entity_id,task_type,
    due_at,next_attempt_at,dedupe_key)
  VALUES(v_request_event,v_cart.store_id,'open','store_order_request',v_request_id,
    'confirmation_reminder',(v_window->>'reminderAt')::TIMESTAMPTZ,
    (v_window->>'reminderAt')::TIMESTAMPTZ,'confirmation_reminder:'||v_request_id),
   (v_request_event,v_cart.store_id,'open','store_order_request',v_request_id,
    'confirmation_expiry',(v_window->>'dueAt')::TIMESTAMPTZ,
    (v_window->>'dueAt')::TIMESTAMPTZ,'confirmation_expiry:'||v_request_id);
  v_response:=jsonb_build_object('data',public.marketplace_get_customer_order_request(v_request_id),
    'commandId',p_command_id,'version',1);
  RETURN marketplace_sec.complete_phase6_command(v_actor,'submit_order_request',p_cart_id::TEXT,
    p_idempotency_key,v_response);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_order_request(UUID,INTEGER,TEXT,TEXT,JSONB,JSONB,TEXT,UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_order_request(UUID,INTEGER,TEXT,TEXT,JSONB,JSONB,TEXT,UUID)
  TO authenticated, service_role;

COMMIT;
