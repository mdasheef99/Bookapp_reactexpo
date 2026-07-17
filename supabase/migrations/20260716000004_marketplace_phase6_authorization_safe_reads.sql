-- Phase 6 Unit 3: owner capability, deny-by-default RLS, and safe reads.
BEGIN;

CREATE FUNCTION marketplace_sec.has_phase6_owner_capability(
  p_store_id UUID,
  p_capability TEXT
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_administrators sa
    JOIN public.store_entitlements se ON se.store_id = sa.store_id
    WHERE sa.store_id = p_store_id
      AND sa.user_id = auth.uid()
      AND sa.role = 'owner'
      AND sa.status = 'active'
      AND se.feature_key = CASE p_capability
        WHEN 'phase6_order_commands'
          THEN 'commerce_order_request_owner_commands_enabled'
        WHEN 'phase6_order_notifications'
          THEN 'commerce_order_request_owner_notifications_enabled'
        ELSE NULL
      END
      AND se.is_enabled = true
  );
$$;

REVOKE ALL ON FUNCTION marketplace_sec.has_phase6_owner_capability(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION marketplace_sec.has_phase6_owner_capability(UUID, TEXT)
  TO authenticated, service_role;

ALTER TABLE public.marketplace_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_request_private_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_request_private_snapshot_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_request_seller_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_request_policy_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_request_policy_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_entity_creation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_transition_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_action_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketplace_carts FROM anon, authenticated;
REVOKE ALL ON public.marketplace_cart_items FROM anon, authenticated;
REVOKE ALL ON public.store_schedule_exceptions FROM anon, authenticated;
REVOKE ALL ON public.store_order_requests FROM anon, authenticated;
REVOKE ALL ON public.store_order_request_items FROM anon, authenticated;
REVOKE ALL ON public.inventory_holds FROM anon, authenticated;
REVOKE ALL ON public.store_order_request_private_snapshots FROM anon, authenticated;
REVOKE ALL ON public.store_order_request_private_snapshot_tombstones FROM anon, authenticated;
REVOKE ALL ON public.store_order_request_seller_snapshots FROM anon, authenticated;
REVOKE ALL ON public.store_order_request_policy_snapshots FROM anon, authenticated;
REVOKE ALL ON public.order_request_policy_acceptances FROM anon, authenticated;
REVOKE ALL ON public.commerce_entity_creation_log FROM anon, authenticated;
REVOKE ALL ON public.commerce_transition_log FROM anon, authenticated;
REVOKE ALL ON public.event_action_tasks FROM anon, authenticated;
REVOKE ALL ON public.marketplace_events FROM anon, authenticated;
REVOKE ALL ON public.marketplace_audit_logs FROM anon, authenticated;

GRANT ALL ON public.marketplace_carts TO service_role;
GRANT ALL ON public.marketplace_cart_items TO service_role;
GRANT ALL ON public.store_schedule_exceptions TO service_role;
GRANT ALL ON public.store_order_requests TO service_role;
GRANT ALL ON public.store_order_request_items TO service_role;
GRANT ALL ON public.inventory_holds TO service_role;
GRANT ALL ON public.store_order_request_private_snapshots TO service_role;
GRANT ALL ON public.store_order_request_private_snapshot_tombstones TO service_role;
GRANT ALL ON public.store_order_request_seller_snapshots TO service_role;
GRANT ALL ON public.store_order_request_policy_snapshots TO service_role;
GRANT ALL ON public.order_request_policy_acceptances TO service_role;
GRANT ALL ON public.commerce_entity_creation_log TO service_role;
GRANT ALL ON public.commerce_transition_log TO service_role;

DROP POLICY IF EXISTS "notifications select own" ON public.marketplace_notifications;
CREATE POLICY "notifications recipient select"
  ON public.marketplace_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE FUNCTION public.marketplace_list_customer_order_requests()
RETURNS TABLE (
  request_id UUID, status TEXT, store_id UUID, fulfillment_method TEXT,
  currency_code CHAR(3), requested_subtotal_minor INTEGER,
  final_total_minor INTEGER, confirmation_due_at TIMESTAMPTZ,
  acceptance_expires_at TIMESTAMPTZ, payment_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id, r.status, r.store_id, r.fulfillment_method, r.currency_code,
    r.requested_subtotal_minor, r.final_total_minor, r.confirmation_due_at,
    r.acceptance_expires_at, r.payment_expires_at, r.updated_at
  FROM public.store_order_requests r
  WHERE r.user_id = auth.uid()
  ORDER BY r.updated_at DESC;
$$;

CREATE FUNCTION public.marketplace_get_customer_order_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'request_id', r.id, 'status', r.status, 'store_id', r.store_id,
    'fulfillment_method', r.fulfillment_method, 'currency_code', r.currency_code,
    'requested_subtotal_minor', r.requested_subtotal_minor,
    'final_total_minor', r.final_total_minor,
    'confirmation_due_at', r.confirmation_due_at,
    'acceptance_expires_at', r.acceptance_expires_at,
    'payment_expires_at', r.payment_expires_at, 'updated_at', r.updated_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'item_id', i.id, 'title', i.title_snapshot,
        'authors', i.authors_snapshot, 'condition', i.condition_snapshot,
        'requested_quantity', i.requested_quantity,
        'confirmed_quantity', i.confirmed_quantity,
        'unit_price_bound_minor', i.server_bound_unit_price_minor,
        'confirmed_unit_price_minor', i.confirmed_unit_price_minor,
        'confirmation_status', i.confirmation_status
      ) ORDER BY i.created_at)
      FROM public.store_order_request_items i WHERE i.order_request_id = r.id
    ), '[]'::jsonb)
  )
  FROM public.store_order_requests r
  WHERE r.id = p_request_id AND r.user_id = auth.uid();
$$;

CREATE FUNCTION public.marketplace_list_owner_order_requests()
RETURNS TABLE (
  request_id UUID, status TEXT, store_id UUID, customer_label TEXT,
  fulfillment_method TEXT, item_count BIGINT,
  confirmation_due_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id, r.status, r.store_id, 'Customer'::TEXT, r.fulfillment_method,
    count(i.id), r.confirmation_due_at, r.updated_at
  FROM public.store_order_requests r
  LEFT JOIN public.store_order_request_items i ON i.order_request_id = r.id
  WHERE marketplace_sec.has_phase6_owner_capability(
    r.store_id, 'phase6_order_commands'
  )
  GROUP BY r.id ORDER BY r.updated_at DESC;
$$;

CREATE FUNCTION public.marketplace_get_owner_order_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'request_id', r.id, 'status', r.status, 'store_id', r.store_id,
    'customer_label', 'Customer', 'fulfillment_method', r.fulfillment_method,
    'requested_subtotal_minor', r.requested_subtotal_minor,
    'final_total_minor', r.final_total_minor,
    'confirmation_due_at', r.confirmation_due_at, 'updated_at', r.updated_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'item_id', i.id, 'title', i.title_snapshot,
        'authors', i.authors_snapshot, 'condition', i.condition_snapshot,
        'requested_quantity', i.requested_quantity,
        'confirmed_quantity', i.confirmed_quantity,
        'unit_price_bound_minor', i.server_bound_unit_price_minor,
        'confirmed_unit_price_minor', i.confirmed_unit_price_minor,
        'confirmation_status', i.confirmation_status
      ) ORDER BY i.created_at)
      FROM public.store_order_request_items i WHERE i.order_request_id = r.id
    ), '[]'::jsonb)
  )
  FROM public.store_order_requests r
  WHERE r.id = p_request_id
    AND marketplace_sec.has_phase6_owner_capability(
      r.store_id, 'phase6_order_commands'
    );
$$;

CREATE FUNCTION public.marketplace_get_support_order_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'request_id', r.id, 'status', r.status, 'store_id', r.store_id,
    'customer_user_id', r.user_id, 'version', r.version,
    'fulfillment_method', r.fulfillment_method,
    'confirmation_due_at', r.confirmation_due_at,
    'acceptance_expires_at', r.acceptance_expires_at,
    'payment_expires_at', r.payment_expires_at, 'updated_at', r.updated_at
  )
  FROM public.store_order_requests r
  WHERE r.id = p_request_id
    AND marketplace_sec.has_platform_role(ARRAY['platform_admin','support_agent']);
$$;

REVOKE ALL ON FUNCTION public.marketplace_list_customer_order_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketplace_get_customer_order_request(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketplace_list_owner_order_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketplace_get_owner_order_request(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketplace_get_support_order_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_list_customer_order_requests() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_get_customer_order_request(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_list_owner_order_requests() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_get_owner_order_request(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_get_support_order_request(UUID) TO authenticated, service_role;

COMMIT;
