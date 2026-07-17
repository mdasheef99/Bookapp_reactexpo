-- Phase 6 Unit 5C: confirmed cross-store cart replacement.
BEGIN;

CREATE FUNCTION public.marketplace_confirm_cart_replacement(
  p_replacement_token TEXT,
  p_expected_version INTEGER,
  p_idempotency_key TEXT,
  p_command_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid(); v_token public.marketplace_cart_replacement_tokens%ROWTYPE;
  v_old_cart public.marketplace_carts%ROWTYPE; v_new_cart public.marketplace_carts%ROWTYPE;
  v_listing public.marketplace_book_listings%ROWTYPE;
  v_inventory public.store_inventory%ROWTYPE; v_replay JSONB; v_response JSONB;
  v_token_hash TEXT; v_event_id UUID; v_policy JSONB; v_expiry_seconds INTEGER;
  v_method TEXT; v_eligibility JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  v_token_hash := encode(extensions.digest(p_replacement_token, 'sha256'), 'hex');
  v_replay := marketplace_sec.claim_phase6_command(
    v_actor, 'replace_cart_store', v_token_hash, p_idempotency_key,
    jsonb_build_object('replacementTokenHash', v_token_hash,
      'expectedVersion', p_expected_version), p_command_id, p_expected_version
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('phase6-cart:' || v_actor::TEXT, 0));
  SELECT * INTO v_token FROM public.marketplace_cart_replacement_tokens t
  WHERE t.token_hash = v_token_hash AND t.user_id = v_actor
    AND t.expires_at > transaction_timestamp() AND used_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  SELECT * INTO v_old_cart FROM public.marketplace_carts c
  WHERE c.id = v_token.old_cart_id AND c.user_id = v_actor AND c.status = 'active'
  ORDER BY c.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  IF v_old_cart.version <> p_expected_version
    OR v_token.old_cart_version <> p_expected_version THEN
    RAISE EXCEPTION 'STALE_VERSION';
  END IF;
  SELECT * INTO v_listing FROM public.marketplace_book_listings l
  WHERE l.id = v_token.new_listing_id ORDER BY l.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  SELECT * INTO v_inventory FROM public.store_inventory i
  WHERE i.id = v_listing.inventory_id ORDER BY i.id FOR UPDATE;
  IF NOT FOUND OR v_listing.store_id <> v_inventory.store_id
    OR v_listing.store_id = v_old_cart.store_id
    OR v_listing.status <> 'active' OR v_listing.moderation_status <> 'approved'
    OR v_inventory.quantity_available < v_token.requested_quantity THEN
    RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';
  END IF;
  v_method := CASE WHEN v_listing.pickup_available THEN 'pickup' ELSE 'delivery' END;
  v_eligibility := marketplace_sec.evaluate_phase6_eligibility(
    v_listing.store_id, 'cart_mutation', v_method,
    jsonb_build_array(jsonb_build_object('listing_id',v_listing.id,
      'inventory_id',v_inventory.id,'requested_quantity',v_token.requested_quantity)),
    v_listing.selling_price_minor * v_token.requested_quantity,
    transaction_timestamp()
  );
  IF v_eligibility->>'outcome' <> 'allow' THEN
    RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';
  END IF;
  v_policy := marketplace_sec.resolve_phase6_policy(
    'commerce.cart_abandonment_seconds', v_listing.store_id, transaction_timestamp()
  );
  v_expiry_seconds := (v_policy->'value')::INTEGER;
  IF v_expiry_seconds NOT BETWEEN 86400 AND 2592000 THEN
    RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';
  END IF;

  v_event_id := marketplace_sec.record_cart_transition(
    v_old_cart, 'replaced', 'replace_cart_store', 'marketplace_cart.replaced',
    p_command_id, p_idempotency_key || ':replace:' || v_old_cart.id::TEXT
  );
  UPDATE public.marketplace_carts
  SET status = 'replaced', version = version + 1, updated_at = transaction_timestamp()
  WHERE id = v_old_cart.id;
  INSERT INTO public.marketplace_carts(user_id,store_id,expires_at)
  VALUES(v_actor,v_listing.store_id,
    transaction_timestamp()+make_interval(secs=>v_expiry_seconds))
  RETURNING * INTO v_new_cart;
  INSERT INTO public.marketplace_cart_items(
    cart_id,listing_id,inventory_id,store_id,requested_quantity,
    price_snapshot_minor,listing_snapshot
  ) VALUES(
    v_new_cart.id,v_listing.id,v_inventory.id,v_listing.store_id,
    v_token.requested_quantity,v_listing.selling_price_minor,
    jsonb_build_object('title',v_listing.public_title,'authors',v_listing.public_authors,
      'coverUrl',v_listing.public_cover_url,'condition',v_listing.condition)
  );
  UPDATE public.marketplace_cart_replacement_tokens
  SET used_at = transaction_timestamp() WHERE id = v_token.id;
  INSERT INTO public.marketplace_notifications(
    store_id,user_id,notification_type,title,body,entity_type,entity_id,
    event_id,deep_link,privacy_classification
  ) VALUES(
    v_listing.store_id,v_actor,'commerce.marketplace_cart.replaced.customer',
    'Cart updated','Your active cart now contains items from the selected store.',
    'marketplace_cart',v_new_cart.id,v_event_id,'/marketplace/cart','internal'
  );
  v_response := jsonb_build_object('data',marketplace_sec.cart_safe_projection(v_new_cart.id),
    'replacedCartId',v_old_cart.id,'commandId',p_command_id,'version',v_new_cart.version);
  RETURN marketplace_sec.complete_phase6_command(
    v_actor,'replace_cart_store',v_token_hash,p_idempotency_key,v_response
  );
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_confirm_cart_replacement(TEXT,INTEGER,TEXT,UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_confirm_cart_replacement(TEXT,INTEGER,TEXT,UUID)
  TO authenticated, service_role;

COMMIT;
