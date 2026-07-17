-- Phase 6 Unit 5B: authenticated single-store cart commands.
BEGIN;

CREATE FUNCTION public.marketplace_get_active_cart()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor UUID := auth.uid(); v_cart_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT c.id INTO v_cart_id FROM public.marketplace_carts c
  WHERE c.user_id = v_actor AND c.status = 'active'
  ORDER BY c.id LIMIT 1;
  RETURN CASE WHEN v_cart_id IS NULL THEN NULL
    ELSE marketplace_sec.cart_safe_projection(v_cart_id) END;
END;
$$;

CREATE FUNCTION public.marketplace_get_or_create_cart(
  p_listing_id UUID, p_idempotency_key TEXT, p_command_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid(); v_cart public.marketplace_carts%ROWTYPE;
  v_listing public.marketplace_book_listings%ROWTYPE;
  v_inventory public.store_inventory%ROWTYPE; v_replay JSONB; v_response JSONB;
  v_expiry_seconds INTEGER; v_policy JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  v_replay := marketplace_sec.claim_phase6_command(
    v_actor, 'create_cart', 'active-cart', p_idempotency_key,
    jsonb_build_object('listingId', p_listing_id), p_command_id, NULL
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('phase6-cart:' || v_actor::TEXT, 0));
  SELECT * INTO v_cart FROM public.marketplace_carts c
  WHERE c.user_id = v_actor AND c.status = 'active'
  ORDER BY c.id FOR UPDATE;

  IF FOUND AND v_cart.expires_at <= transaction_timestamp() THEN
    PERFORM marketplace_sec.record_cart_transition(
      v_cart, 'abandoned', 'create_cart', 'marketplace_cart.abandoned',
      p_command_id, p_idempotency_key || ':abandon:' || v_cart.id::TEXT
    );
    UPDATE public.marketplace_carts
    SET status = 'abandoned', version = version + 1, updated_at = transaction_timestamp()
    WHERE id = v_cart.id;
    v_cart := NULL;
  END IF;
  IF v_cart.id IS NOT NULL THEN
    v_response := jsonb_build_object('data', marketplace_sec.cart_safe_projection(v_cart.id),
      'commandId', p_command_id, 'version', v_cart.version);
    RETURN marketplace_sec.complete_phase6_command(
      v_actor, 'create_cart', 'active-cart', p_idempotency_key, v_response
    );
  END IF;

  SELECT * INTO v_listing FROM public.marketplace_book_listings l
  WHERE l.id = p_listing_id ORDER BY l.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  SELECT * INTO v_inventory FROM public.store_inventory i
  WHERE i.id = v_listing.inventory_id ORDER BY i.id FOR UPDATE;
  IF NOT FOUND OR v_listing.store_id <> v_inventory.store_id
    OR v_listing.status <> 'active' OR v_listing.moderation_status <> 'approved'
    OR v_inventory.quantity_available < 1 THEN
    RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';
  END IF;
  v_policy := marketplace_sec.resolve_phase6_policy(
    'commerce.cart_abandonment_seconds', v_listing.store_id, transaction_timestamp()
  );
  v_expiry_seconds := (v_policy->'value')::INTEGER;
  IF v_expiry_seconds NOT BETWEEN 86400 AND 2592000 THEN
    RAISE EXCEPTION 'POLICY_CONFIGURATION_INVALID';
  END IF;
  INSERT INTO public.marketplace_carts(user_id, store_id, expires_at)
  VALUES (v_actor, v_listing.store_id,
    transaction_timestamp() + make_interval(secs => v_expiry_seconds))
  RETURNING * INTO v_cart;
  v_response := jsonb_build_object('data', marketplace_sec.cart_safe_projection(v_cart.id),
    'commandId', p_command_id, 'version', v_cart.version);
  RETURN marketplace_sec.complete_phase6_command(
    v_actor, 'create_cart', 'active-cart', p_idempotency_key, v_response
  );
END;
$$;

CREATE FUNCTION public.marketplace_add_cart_item(
  p_listing_id UUID, p_quantity INTEGER, p_expected_version INTEGER,
  p_idempotency_key TEXT, p_command_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid(); v_cart public.marketplace_carts%ROWTYPE;
  v_listing public.marketplace_book_listings%ROWTYPE;
  v_inventory public.store_inventory%ROWTYPE; v_replay JSONB; v_response JSONB;
  v_token UUID; v_item_payload JSONB; v_method TEXT;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  v_replay := marketplace_sec.claim_phase6_command(
    v_actor, 'set_cart_item_quantity', 'active-cart', p_idempotency_key,
    jsonb_build_object('listingId', p_listing_id, 'quantity', p_quantity,
      'expectedVersion', p_expected_version), p_command_id, p_expected_version
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('phase6-cart:' || v_actor::TEXT, 0));
  SELECT * INTO v_cart FROM public.marketplace_carts c
  WHERE c.user_id = v_actor AND c.status = 'active'
  ORDER BY c.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  IF v_cart.version <> p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
  SELECT * INTO v_listing FROM public.marketplace_book_listings l
  WHERE l.id = p_listing_id ORDER BY l.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  SELECT * INTO v_inventory FROM public.store_inventory i
  WHERE i.id = v_listing.inventory_id ORDER BY i.id FOR UPDATE;
  IF NOT FOUND OR v_listing.store_id <> v_inventory.store_id
    OR v_listing.status <> 'active' OR v_listing.moderation_status <> 'approved'
    OR v_inventory.quantity_available < p_quantity THEN
    RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';
  END IF;
  IF v_cart.store_id <> v_listing.store_id THEN
    v_token := gen_random_uuid();
    INSERT INTO public.marketplace_cart_replacement_tokens(
      token_hash, user_id, old_cart_id, old_cart_version, new_listing_id,
      requested_quantity, expires_at
    ) VALUES (
      encode(extensions.digest(v_token::TEXT, 'sha256'), 'hex'), v_actor,
      v_cart.id, v_cart.version, v_listing.id, p_quantity,
      transaction_timestamp() + interval '10 minutes'
    );
    v_response := jsonb_build_object('errorCode', 'CROSS_STORE_REPLACEMENT_REQUIRED',
      'replacementToken', v_token, 'oldCartVersion', v_cart.version,
      'commandId', p_command_id, 'version', v_cart.version);
    RETURN marketplace_sec.complete_phase6_command(
      v_actor, 'set_cart_item_quantity', 'active-cart', p_idempotency_key, v_response
    );
  END IF;
  v_method := CASE WHEN v_listing.pickup_available THEN 'pickup' ELSE 'delivery' END;
  v_item_payload := jsonb_build_array(jsonb_build_object(
    'listing_id', v_listing.id, 'inventory_id', v_inventory.id,
    'requested_quantity', p_quantity
  ));
  IF marketplace_sec.evaluate_phase6_eligibility(
    v_cart.store_id, 'cart_mutation', v_method, v_item_payload,
    v_listing.selling_price_minor * p_quantity, transaction_timestamp()
  )->>'outcome' <> 'allow' THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  INSERT INTO public.marketplace_cart_items(
    cart_id, listing_id, inventory_id, store_id, requested_quantity,
    price_snapshot_minor, listing_snapshot
  ) VALUES (
    v_cart.id, v_listing.id, v_inventory.id, v_listing.store_id, p_quantity,
    v_listing.selling_price_minor, jsonb_build_object(
      'title', v_listing.public_title, 'authors', v_listing.public_authors,
      'coverUrl', v_listing.public_cover_url, 'condition', v_listing.condition
    )
  ) ON CONFLICT (cart_id, listing_id) DO UPDATE
    SET requested_quantity = EXCLUDED.requested_quantity,
      price_snapshot_minor = EXCLUDED.price_snapshot_minor,
      listing_snapshot = EXCLUDED.listing_snapshot,
      version = marketplace_cart_items.version + 1,
      updated_at = transaction_timestamp();
  UPDATE public.marketplace_carts SET version = version + 1,
    updated_at = transaction_timestamp() WHERE id = v_cart.id RETURNING * INTO v_cart;
  v_response := jsonb_build_object('data', marketplace_sec.cart_safe_projection(v_cart.id),
    'commandId', p_command_id, 'version', v_cart.version);
  RETURN marketplace_sec.complete_phase6_command(
    v_actor, 'set_cart_item_quantity', 'active-cart', p_idempotency_key, v_response
  );
END;
$$;

CREATE FUNCTION public.marketplace_set_cart_item_quantity(
  p_cart_item_id UUID, p_quantity INTEGER, p_expected_version INTEGER,
  p_idempotency_key TEXT, p_command_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor UUID := auth.uid(); v_cart public.marketplace_carts%ROWTYPE;
  v_item public.marketplace_cart_items%ROWTYPE;
  v_listing public.marketplace_book_listings%ROWTYPE;
  v_inventory public.store_inventory%ROWTYPE; v_replay JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  v_replay := marketplace_sec.claim_phase6_command(v_actor, 'set_cart_item_quantity',
    p_cart_item_id::TEXT, p_idempotency_key, jsonb_build_object('quantity',p_quantity,
    'expectedVersion',p_expected_version), p_command_id, p_expected_version);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT c.* INTO v_cart FROM public.marketplace_carts c
  JOIN public.marketplace_cart_items ci ON ci.cart_id=c.id
  WHERE ci.id=p_cart_item_id AND c.user_id=v_actor AND c.status='active' FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  IF v_cart.version <> p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
  SELECT * INTO v_item FROM public.marketplace_cart_items WHERE id=p_cart_item_id FOR UPDATE;
  SELECT * INTO v_listing FROM public.marketplace_book_listings l
    WHERE l.id=v_item.listing_id ORDER BY l.id FOR UPDATE;
  SELECT * INTO v_inventory FROM public.store_inventory i WHERE i.id=v_item.inventory_id
    ORDER BY i.id FOR UPDATE;
  IF v_listing.store_id <> v_cart.store_id OR v_listing.store_id <> v_inventory.store_id
    OR v_listing.status <> 'active' OR v_listing.moderation_status <> 'approved' THEN
    RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE';
  END IF;
  IF v_inventory.quantity_available < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_INVENTORY';
  END IF;
  UPDATE public.marketplace_cart_items SET requested_quantity=p_quantity,
    price_snapshot_minor=v_listing.selling_price_minor,
    listing_snapshot=jsonb_build_object('title',v_listing.public_title,
      'authors',v_listing.public_authors,'coverUrl',v_listing.public_cover_url,
      'condition',v_listing.condition),
    version=version+1, updated_at=transaction_timestamp() WHERE id=v_item.id;
  UPDATE public.marketplace_carts SET version=version+1,updated_at=transaction_timestamp()
    WHERE id=v_cart.id RETURNING * INTO v_cart;
  RETURN marketplace_sec.complete_phase6_command(v_actor,'set_cart_item_quantity',
    p_cart_item_id::TEXT,p_idempotency_key,jsonb_build_object('data',
    marketplace_sec.cart_safe_projection(v_cart.id),'commandId',p_command_id,'version',v_cart.version));
END;
$$;

CREATE FUNCTION public.marketplace_remove_cart_item(
  p_cart_item_id UUID, p_expected_version INTEGER, p_idempotency_key TEXT, p_command_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor UUID := auth.uid(); v_cart public.marketplace_carts%ROWTYPE; v_replay JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  v_replay := marketplace_sec.claim_phase6_command(v_actor,'remove_cart_item',p_cart_item_id::TEXT,
    p_idempotency_key,jsonb_build_object('expectedVersion',p_expected_version),p_command_id,p_expected_version);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT c.* INTO v_cart FROM public.marketplace_carts c JOIN public.marketplace_cart_items ci
    ON ci.cart_id=c.id WHERE ci.id=p_cart_item_id AND c.user_id=v_actor AND c.status='active'
    FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCE_ENTITY_UNAVAILABLE'; END IF;
  IF v_cart.version <> p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
  DELETE FROM public.marketplace_cart_items WHERE id=p_cart_item_id AND cart_id=v_cart.id;
  UPDATE public.marketplace_carts SET version=version+1,updated_at=transaction_timestamp()
    WHERE id=v_cart.id RETURNING * INTO v_cart;
  RETURN marketplace_sec.complete_phase6_command(v_actor,'remove_cart_item',p_cart_item_id::TEXT,
    p_idempotency_key,jsonb_build_object('data',marketplace_sec.cart_safe_projection(v_cart.id),
    'commandId',p_command_id,'version',v_cart.version));
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_get_active_cart() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketplace_get_or_create_cart(UUID,TEXT,UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketplace_add_cart_item(UUID,INTEGER,INTEGER,TEXT,UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketplace_set_cart_item_quantity(UUID,INTEGER,INTEGER,TEXT,UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketplace_remove_cart_item(UUID,INTEGER,TEXT,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_get_active_cart() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_get_or_create_cart(UUID,TEXT,UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_add_cart_item(UUID,INTEGER,INTEGER,TEXT,UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_set_cart_item_quantity(UUID,INTEGER,INTEGER,TEXT,UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_remove_cart_item(UUID,INTEGER,TEXT,UUID) TO authenticated, service_role;

COMMIT;
