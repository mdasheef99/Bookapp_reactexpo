-- Phase 6 Unit 14: Store Owner UI-safe, versioned commerce projections.
BEGIN;

DROP FUNCTION public.marketplace_list_owner_order_requests();
CREATE FUNCTION public.marketplace_list_owner_order_requests()
RETURNS TABLE (
  request_id UUID, status TEXT, store_id UUID, customer_label TEXT,
  fulfillment_method TEXT, item_count BIGINT, version INTEGER,
  confirmation_due_at TIMESTAMPTZ, acceptance_expires_at TIMESTAMPTZ,
  payment_expires_at TIMESTAMPTZ, closure_pause_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id, r.status, r.store_id, 'Customer'::TEXT, r.fulfillment_method,
    count(i.id), r.version, r.confirmation_due_at, r.acceptance_expires_at,
    r.payment_expires_at, r.closure_pause_expires_at, r.updated_at
  FROM public.store_order_requests r
  LEFT JOIN public.store_order_request_items i ON i.order_request_id = r.id
  WHERE marketplace_sec.has_phase6_owner_capability(r.store_id, 'phase6_order_commands')
  GROUP BY r.id ORDER BY r.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_get_owner_order_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'request_id', r.id, 'status', r.status, 'status_reason_code', r.status_reason_code,
    'store_id', r.store_id, 'customer_label', 'Customer',
    'fulfillment_method', r.fulfillment_method,
    'final_fulfillment_method', r.final_fulfillment_method,
    'currency_code', r.currency_code, 'version', r.version,
    'requested_subtotal_minor', r.requested_subtotal_minor,
    'final_subtotal_minor', r.final_subtotal_minor,
    'final_delivery_tariff_minor', r.final_delivery_tariff_minor,
    'final_total_minor', r.final_total_minor,
    'confirmation_due_at', r.confirmation_due_at,
    'acceptance_expires_at', r.acceptance_expires_at,
    'payment_expires_at', r.payment_expires_at,
    'closure_pause_expires_at', r.closure_pause_expires_at,
    'updated_at', r.updated_at,
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'item_id', i.id, 'title', i.title_snapshot, 'authors', i.authors_snapshot,
      'condition', i.condition_snapshot, 'condition_notes', i.condition_notes_snapshot,
      'requested_quantity', i.requested_quantity,
      'confirmed_quantity', i.confirmed_quantity,
      'unit_price_bound_minor', i.server_bound_unit_price_minor,
      'confirmed_unit_price_minor', i.confirmed_unit_price_minor,
      'confirmation_status', i.confirmation_status,
      'quantity_available', inv.quantity_available,
      'pickup_eligible', i.pickup_eligible_snapshot,
      'delivery_eligible', i.delivery_eligible_snapshot
    ) ORDER BY i.created_at)
    FROM public.store_order_request_items i
    JOIN public.store_inventory inv ON inv.id = i.inventory_id
    WHERE i.order_request_id = r.id), '[]'::jsonb)
  )
  FROM public.store_order_requests r
  WHERE r.id = p_request_id
    AND marketplace_sec.has_phase6_owner_capability(r.store_id, 'phase6_order_commands');
$$;

REVOKE ALL ON FUNCTION public.marketplace_list_owner_order_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketplace_get_owner_order_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_list_owner_order_requests() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_get_owner_order_request(UUID) TO authenticated, service_role;

COMMIT;
