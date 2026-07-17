-- Phase 6 Unit 4: server-authoritative policy and eligibility resolution.
BEGIN;

CREATE FUNCTION marketplace_sec.resolve_phase6_policy(
  p_policy_key TEXT,
  p_store_id UUID,
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'policy_id', pc.id,
    'value', pc.value,
    'value_type', pc.value_type,
    'policy_version', pc.policy_version,
    'scope_type', pc.scope_type
  )
  FROM public.marketplace_policy_config pc
  JOIN public.stores s ON s.id = p_store_id
  WHERE pc.policy_key = p_policy_key
    AND pc.is_active = true
    AND pc.effective_from <= p_at
    AND (pc.effective_to IS NULL OR pc.effective_to > p_at)
    AND CASE pc.scope_type
      WHEN 'store' THEN pc.store_id = s.id
      WHEN 'locality' THEN pc.normalized_scope_identity = s.locality_id::TEXT
        OR pc.scope_value = s.locality_id::TEXT
      WHEN 'city' THEN lower(pc.normalized_scope_identity) = lower(s.city)
        OR lower(pc.scope_value) = lower(s.city)
      WHEN 'global' THEN true
      ELSE false
    END
  ORDER BY CASE pc.scope_type
    WHEN 'store' THEN 4
    WHEN 'locality' THEN 3
    WHEN 'city' THEN 2
    WHEN 'global' THEN 1
    ELSE 0
  END DESC, pc.effective_from DESC, pc.policy_version DESC, pc.id DESC
  LIMIT 1;
$$;

CREATE FUNCTION marketplace_sec.evaluate_phase6_eligibility(
  p_store_id UUID,
  p_operation TEXT,
  p_fulfillment_method TEXT,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_subtotal_minor INTEGER DEFAULT 0,
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store public.stores%ROWTYPE;
  v_subscription_allowed BOOLEAN := false;
  v_entitled BOOLEAN := false;
  v_owner_available BOOLEAN := false;
  v_expected_items INTEGER := 0;
  v_valid_items INTEGER := 0;
  v_policy JSONB;
  v_minimum INTEGER;
  v_fixed INTEGER;
  v_free_threshold INTEGER;
  v_tariff_version INTEGER;
BEGIN
  IF p_operation = 'history_read' THEN
    RETURN jsonb_build_object('outcome', 'history_only');
  END IF;
  IF p_operation IN ('customer_cancellation', 'service_cleanup') THEN
    RETURN jsonb_build_object('outcome', 'cleanup_only');
  END IF;
  IF p_operation = 'owner_support_request' THEN
    IF marketplace_sec.has_phase6_owner_capability(
      p_store_id, 'phase6_order_commands'
    ) THEN
      RETURN jsonb_build_object('outcome', 'escalation_support');
    END IF;
    RETURN jsonb_build_object(
      'outcome', 'block_no_effects', 'error_code', 'STORE_COMMAND_NOT_ENTITLED'
    );
  END IF;

  SELECT * INTO v_store FROM public.stores s WHERE s.id = p_store_id;
  IF NOT FOUND OR NOT (
    v_store.status = 'active'
    AND v_store.verification_status = 'approved'
    AND v_store.setup_status = 'complete'
    AND v_store.selling_status = 'allowed'
  ) THEN
    RETURN jsonb_build_object(
      'outcome', 'block_no_effects', 'error_code', 'COMMERCE_ENTITY_UNAVAILABLE'
    );
  END IF;

  SELECT COALESCE((
    SELECT ss.status IN ('trialing','active','past_due','grace_period')
    FROM public.store_subscriptions ss
    WHERE ss.store_id = p_store_id
    ORDER BY ss.updated_at DESC, ss.id DESC
    LIMIT 1
  ), false) INTO v_subscription_allowed;
  IF NOT v_subscription_allowed THEN
    RETURN jsonb_build_object(
      'outcome', 'block_no_effects', 'error_code', 'STORE_COMMAND_NOT_ENTITLED'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.store_entitlements se
    WHERE se.store_id = p_store_id AND se.is_enabled = true
      AND se.feature_key = CASE WHEN p_operation = 'cart_mutation'
        THEN 'commerce_cart_enabled' ELSE 'commerce_order_requests_enabled' END
  ) INTO v_entitled;
  IF NOT v_entitled THEN
    RETURN jsonb_build_object(
      'outcome', 'block_no_effects', 'error_code', 'STORE_COMMAND_NOT_ENTITLED'
    );
  END IF;

  IF p_operation = 'owner_progression' AND NOT
    marketplace_sec.has_phase6_owner_capability(p_store_id, 'phase6_order_commands') THEN
    RETURN jsonb_build_object(
      'outcome', 'block_no_effects', 'error_code', 'STORE_COMMAND_NOT_ENTITLED'
    );
  END IF;

  IF NOT COALESCE((marketplace_sec.resolve_phase6_policy(
      'marketplace_enabled', p_store_id, p_at
    )->'value')::BOOLEAN, false)
    OR NOT COALESCE((marketplace_sec.resolve_phase6_policy(
      'cart_order_request_enabled', p_store_id, p_at
    )->'value')::BOOLEAN, false)
    OR v_store.locality_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.marketplace_localities ml
      WHERE ml.id = v_store.locality_id AND ml.is_pilot_enabled = true
    )
    OR NOT COALESCE((marketplace_sec.resolve_phase6_policy(
      'commerce.store_allowlisted', p_store_id, p_at
    )->'value')::BOOLEAN, false) THEN
    RETURN jsonb_build_object(
      'outcome', 'block_no_effects', 'error_code', 'COMMERCE_ROLLOUT_DISABLED'
    );
  END IF;

  IF p_operation IN ('submit_request', 'owner_progression') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.store_administrators sa
      WHERE sa.store_id = p_store_id AND sa.role = 'owner' AND sa.status = 'active'
        AND EXISTS (
          SELECT 1 FROM public.store_entitlements se
          WHERE se.store_id = sa.store_id AND se.is_enabled = true
            AND se.feature_key = 'commerce_order_request_owner_commands_enabled'
        )
        AND EXISTS (
          SELECT 1 FROM public.store_entitlements se
          WHERE se.store_id = sa.store_id AND se.is_enabled = true
            AND se.feature_key = 'commerce_order_request_owner_notifications_enabled'
        )
    ) INTO v_owner_available;
    IF NOT v_owner_available THEN
      RETURN jsonb_build_object(
        'outcome', 'block_no_effects', 'error_code', 'ENTITLED_OWNER_UNAVAILABLE'
      );
    END IF;
  END IF;

  IF p_fulfillment_method NOT IN ('pickup', 'delivery') OR
    (p_fulfillment_method = 'pickup' AND (
      NOT v_store.pickup_enabled OR NOT COALESCE((
        marketplace_sec.resolve_phase6_policy('pickup_enabled', p_store_id, p_at)
        ->'value')::BOOLEAN, false)
    )) OR (p_fulfillment_method = 'delivery' AND (
      NOT v_store.delivery_enabled OR NOT COALESCE((
        marketplace_sec.resolve_phase6_policy('delivery_enabled', p_store_id, p_at)
        ->'value')::BOOLEAN, false)
    )) THEN
    RETURN jsonb_build_object(
      'outcome', 'block_no_effects', 'error_code', 'INVALID_FULFILMENT'
    );
  END IF;

  SELECT count(*) INTO v_expected_items
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb))
    AS requested(listing_id UUID, inventory_id UUID, requested_quantity INTEGER);
  SELECT count(*) INTO v_valid_items
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb))
    AS requested(listing_id UUID, inventory_id UUID, requested_quantity INTEGER)
  JOIN public.marketplace_book_listings l ON l.id = requested.listing_id
  JOIN public.store_inventory i ON i.id = requested.inventory_id
    AND i.id = l.inventory_id
  WHERE l.store_id = p_store_id AND i.store_id = p_store_id
    AND l.moderation_status = 'approved'
    AND CASE WHEN p_operation = 'cart_mutation'
      THEN l.status = 'active' ELSE l.status IN ('active', 'paused') END
    AND requested.requested_quantity > 0
    AND i.quantity_available >= requested.requested_quantity
    AND CASE p_fulfillment_method
      WHEN 'pickup' THEN l.pickup_available
      WHEN 'delivery' THEN l.delivery_available
      ELSE false END;
  IF v_expected_items = 0 OR v_valid_items <> v_expected_items THEN
    RETURN jsonb_build_object(
      'outcome', 'block_no_effects', 'error_code', 'COMMERCE_ENTITY_UNAVAILABLE'
    );
  END IF;

  IF p_fulfillment_method = 'pickup' THEN
    RETURN jsonb_build_object('outcome', 'allow', 'delivery_tariff_minor', 0);
  END IF;
  v_policy := marketplace_sec.resolve_phase6_policy(
    'commerce.delivery_minimum_subtotal_minor', p_store_id, p_at
  );
  v_minimum := (v_policy->'value')::INTEGER;
  v_policy := marketplace_sec.resolve_phase6_policy(
    'commerce.delivery_fixed_tariff_minor', p_store_id, p_at
  );
  v_fixed := (v_policy->'value')::INTEGER;
  v_tariff_version := (v_policy->>'policy_version')::INTEGER;
  v_policy := marketplace_sec.resolve_phase6_policy(
    'commerce.delivery_free_threshold_minor', p_store_id, p_at
  );
  v_free_threshold := (v_policy->'value')::INTEGER;
  IF v_minimum IS NULL OR v_fixed IS NULL OR v_free_threshold IS NULL
    OR v_tariff_version IS NULL THEN
    RETURN jsonb_build_object(
      'outcome', 'block_no_effects', 'error_code', 'DELIVERY_TARIFF_UNAVAILABLE'
    );
  END IF;
  IF p_subtotal_minor < v_minimum THEN
    RETURN jsonb_build_object(
      'outcome', 'block_no_effects', 'error_code', 'INVALID_FULFILMENT'
    );
  END IF;
  RETURN jsonb_build_object(
    'outcome', 'allow',
    'delivery_tariff_minor', CASE WHEN p_subtotal_minor >= v_free_threshold
      THEN 0 ELSE v_fixed END,
    'delivery_tariff_version', v_tariff_version
  );
END;
$$;

REVOKE ALL ON FUNCTION marketplace_sec.resolve_phase6_policy(TEXT, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.evaluate_phase6_eligibility(
  UUID, TEXT, TEXT, JSONB, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.resolve_phase6_policy(TEXT, UUID, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.evaluate_phase6_eligibility(
  UUID, TEXT, TEXT, JSONB, INTEGER, TIMESTAMPTZ
) TO service_role;

COMMIT;
