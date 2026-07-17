-- Phase 6 Unit 5A: private command/idempotency helpers and replacement tokens.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.marketplace_cart_replacement_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_cart_id UUID NOT NULL REFERENCES public.marketplace_carts(id) ON DELETE CASCADE,
  old_cart_version INTEGER NOT NULL CHECK (old_cart_version >= 1),
  new_listing_id UUID NOT NULL REFERENCES public.marketplace_book_listings(id) ON DELETE CASCADE,
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX marketplace_cart_replacement_tokens_lookup_idx
  ON public.marketplace_cart_replacement_tokens(user_id, old_cart_id, expires_at);
ALTER TABLE public.marketplace_cart_replacement_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_cart_replacement_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.marketplace_cart_replacement_tokens TO service_role;

CREATE FUNCTION marketplace_sec.claim_phase6_command(
  p_actor UUID,
  p_command TEXT,
  p_logical_entity TEXT,
  p_idempotency_key TEXT,
  p_payload JSONB,
  p_command_id UUID,
  p_expected_version INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scope TEXT := p_actor::TEXT || ':' || p_command || ':' || p_logical_entity;
  v_hash TEXT := encode(extensions.digest(p_payload::TEXT, 'sha256'), 'hex');
  v_existing public.commerce_idempotency_keys%ROWTYPE;
BEGIN
  IF p_actor IS NULL OR p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'INVALID_COMMAND';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_scope || ':' || p_idempotency_key, 0)
  );
  SELECT * INTO v_existing
  FROM public.commerce_idempotency_keys k
  WHERE k.scope = v_scope AND k.key = p_idempotency_key
  FOR UPDATE;

  IF FOUND AND v_existing.expires_at <= transaction_timestamp() THEN
    DELETE FROM public.commerce_idempotency_keys WHERE id = v_existing.id;
    v_existing := NULL;
  ELSIF FOUND THEN
    IF v_existing.request_hash <> v_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED';
    END IF;
    IF v_existing.status = 'in_progress' THEN
      RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
    END IF;
    IF v_existing.status = 'completed' THEN
      RETURN v_existing.response_snapshot || jsonb_build_object('idempotencyReplay', true);
    END IF;
  END IF;

  INSERT INTO public.commerce_idempotency_keys (
    scope, key, request_hash, status, expires_at, actor_user_id,
    command_name, logical_entity_id, command_id, expected_version, correlation_id
  ) VALUES (
    v_scope, p_idempotency_key, v_hash, 'in_progress',
    transaction_timestamp() + interval '7 days', p_actor, p_command,
    CASE WHEN p_logical_entity ~ '^[0-9a-f-]{36}$'
      THEN p_logical_entity::UUID ELSE NULL END,
    p_command_id, p_expected_version, p_command_id
  );
  RETURN NULL;
END;
$$;

CREATE FUNCTION marketplace_sec.complete_phase6_command(
  p_actor UUID, p_command TEXT, p_logical_entity TEXT,
  p_idempotency_key TEXT, p_response JSONB
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scope TEXT := p_actor::TEXT || ':' || p_command || ':' || p_logical_entity;
BEGIN
  UPDATE public.commerce_idempotency_keys
  SET status = 'completed', response_snapshot = p_response
  WHERE scope = v_scope AND key = p_idempotency_key AND status = 'in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMAND_IN_PROGRESS'; END IF;
  RETURN p_response || jsonb_build_object('idempotencyReplay', false);
END;
$$;

CREATE FUNCTION marketplace_sec.cart_safe_projection(p_cart_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'cartId', c.id, 'storeId', c.store_id, 'status', c.status,
    'currencyCode', c.currency_code, 'version', c.version,
    'expiresAt', c.expires_at, 'updatedAt', c.updated_at,
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'itemId', ci.id, 'listingId', ci.listing_id,
      'quantity', ci.requested_quantity, 'priceSnapshotMinor', ci.price_snapshot_minor,
      'currencyCode', ci.currency_code, 'listing', ci.listing_snapshot,
      'version', ci.version
    ) ORDER BY ci.created_at) FROM public.marketplace_cart_items ci
      WHERE ci.cart_id = c.id), '[]'::jsonb)
  ) FROM public.marketplace_carts c WHERE c.id = p_cart_id;
$$;

CREATE FUNCTION marketplace_sec.record_cart_transition(
  p_cart public.marketplace_carts, p_next_state TEXT, p_command TEXT,
  p_event_type TEXT, p_command_id UUID, p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_event_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.marketplace_events (
    id, event_type, entity_type, entity_id, store_id, user_id, actor_user_id,
    actor_role, source, idempotency_key, command_id, correlation_id,
    privacy_classification, payload
  ) VALUES (
    v_event_id, p_event_type, 'marketplace_cart', p_cart.id, p_cart.store_id,
    p_cart.user_id, p_cart.user_id, 'customer', 'consumer_app',
    p_idempotency_key, p_command_id, p_command_id, 'internal',
    jsonb_build_object('cartId', p_cart.id, 'nextState', p_next_state)
  );
  INSERT INTO public.commerce_transition_log (
    entity_type, entity_id, previous_state, next_state, previous_version,
    next_version, actor_user_id, actor_role, command_name, command_id,
    idempotency_key, correlation_id, event_id
  ) VALUES (
    'marketplace_cart', p_cart.id, p_cart.status, p_next_state, p_cart.version,
    p_cart.version + 1, p_cart.user_id, 'customer', p_command, p_command_id,
    p_idempotency_key, p_command_id, v_event_id
  );
  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION marketplace_sec.claim_phase6_command(UUID,TEXT,TEXT,TEXT,JSONB,UUID,INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.complete_phase6_command(UUID,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.cart_safe_projection(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marketplace_sec.record_cart_transition(public.marketplace_carts,TEXT,TEXT,TEXT,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.claim_phase6_command(UUID,TEXT,TEXT,TEXT,JSONB,UUID,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.complete_phase6_command(UUID,TEXT,TEXT,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.cart_safe_projection(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_sec.record_cart_transition(public.marketplace_carts,TEXT,TEXT,TEXT,UUID,TEXT) TO service_role;

COMMIT;
