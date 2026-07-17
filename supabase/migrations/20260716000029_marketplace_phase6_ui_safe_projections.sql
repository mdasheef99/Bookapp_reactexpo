-- Phase 6 Unit 13: customer UI-safe, versioned commerce projections.
BEGIN;

CREATE OR REPLACE FUNCTION marketplace_sec.cart_safe_projection(p_cart_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'cartId', c.id, 'storeId', c.store_id, 'storeName', p.display_name,
    'status', c.status, 'currencyCode', c.currency_code, 'version', c.version,
    'expiresAt', c.expires_at, 'updatedAt', c.updated_at,
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'itemId', ci.id, 'listingId', ci.listing_id,
      'quantity', ci.requested_quantity,
      'priceSnapshotMinor', ci.price_snapshot_minor,
      'currentPriceMinor', LEAST(ci.price_snapshot_minor, l.selling_price_minor),
      'itemSubtotalMinor', ci.requested_quantity * LEAST(ci.price_snapshot_minor, l.selling_price_minor),
      'currencyCode', ci.currency_code, 'listing', ci.listing_snapshot,
      'version', ci.version
    ) ORDER BY ci.created_at)
    FROM public.marketplace_cart_items ci
    JOIN public.marketplace_book_listings l ON l.id = ci.listing_id
    WHERE ci.cart_id = c.id), '[]'::jsonb)
  )
  FROM public.marketplace_carts c
  LEFT JOIN public.public_store_profiles p ON p.store_id = c.store_id
  WHERE c.id = p_cart_id;
$$;

DROP FUNCTION public.marketplace_list_customer_order_requests();
CREATE FUNCTION public.marketplace_list_customer_order_requests()
RETURNS TABLE (
  request_id UUID, status TEXT, store_id UUID, store_name TEXT,
  fulfillment_method TEXT, currency_code CHAR(3), requested_subtotal_minor INTEGER,
  provisional_delivery_tariff_minor INTEGER, final_subtotal_minor INTEGER,
  final_delivery_tariff_minor INTEGER, final_total_minor INTEGER, version INTEGER,
  confirmation_due_at TIMESTAMPTZ, acceptance_expires_at TIMESTAMPTZ,
  payment_ready_at TIMESTAMPTZ, payment_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id, r.status, r.store_id, p.display_name, r.fulfillment_method,
    r.currency_code, r.requested_subtotal_minor, r.provisional_delivery_tariff_minor,
    r.final_subtotal_minor, r.final_delivery_tariff_minor, r.final_total_minor,
    r.version, r.confirmation_due_at, r.acceptance_expires_at,
    r.payment_ready_at, r.payment_expires_at, r.updated_at
  FROM public.store_order_requests r
  LEFT JOIN public.public_store_profiles p ON p.store_id = r.store_id
  WHERE r.user_id = auth.uid()
  ORDER BY r.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_get_customer_order_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'request_id', r.id, 'status', r.status, 'status_reason_code', r.status_reason_code,
    'store_id', r.store_id, 'store_name', p.display_name,
    'fulfillment_method', r.fulfillment_method,
    'final_fulfillment_method', r.final_fulfillment_method,
    'currency_code', r.currency_code, 'version', r.version,
    'requested_subtotal_minor', r.requested_subtotal_minor,
    'provisional_delivery_tariff_minor', r.provisional_delivery_tariff_minor,
    'final_subtotal_minor', r.final_subtotal_minor,
    'final_delivery_tariff_minor', r.final_delivery_tariff_minor,
    'final_total_minor', r.final_total_minor,
    'confirmation_due_at', r.confirmation_due_at,
    'clarification_expires_at', r.clarification_expires_at,
    'acceptance_expires_at', r.acceptance_expires_at,
    'payment_ready_at', r.payment_ready_at,
    'payment_expires_at', r.payment_expires_at,
    'closure_pause_expires_at', r.closure_pause_expires_at,
    'delivery_minimum_minor', COALESCE((
      SELECT (ps.resolved_value #>> '{}')::INTEGER
      FROM public.store_order_request_policy_snapshots ps
      WHERE ps.order_request_id = r.id
        AND ps.policy_key = 'commerce.delivery_minimum_subtotal_minor'
      ORDER BY ps.resolved_at DESC LIMIT 1
    ), 0),
    'updated_at', r.updated_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'item_id', i.id, 'title', i.title_snapshot,
        'authors', i.authors_snapshot, 'condition', i.condition_snapshot,
        'image_url', i.image_url_snapshot,
        'requested_quantity', i.requested_quantity,
        'confirmed_quantity', i.confirmed_quantity,
        'unit_price_bound_minor', i.server_bound_unit_price_minor,
        'confirmed_unit_price_minor', i.confirmed_unit_price_minor,
        'confirmation_status', i.confirmation_status,
        'unavailable_reason_code', i.unavailable_reason_code,
        'pickup_eligible', i.pickup_eligible_snapshot,
        'delivery_eligible', i.delivery_eligible_snapshot
      ) ORDER BY i.created_at)
      FROM public.store_order_request_items i WHERE i.order_request_id = r.id
    ), '[]'::jsonb)
  )
  FROM public.store_order_requests r
  LEFT JOIN public.public_store_profiles p ON p.store_id = r.store_id
  WHERE r.id = p_request_id AND r.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.marketplace_list_customer_order_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketplace_get_customer_order_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_list_customer_order_requests() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_get_customer_order_request(UUID) TO authenticated, service_role;

COMMIT;
