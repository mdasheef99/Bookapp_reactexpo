-- Phase 6 Unit 2A: unpaid cart, request, item, hold, and schedule foundation.
-- Additive local migration only. Phase 7 payment/provider structures are out of scope.
BEGIN;

CREATE TABLE public.marketplace_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'submitted', 'replaced', 'abandoned')),
  currency_code CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency_code = 'INR'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX marketplace_carts_one_active_per_user
  ON public.marketplace_carts(user_id) WHERE status = 'active';
CREATE INDEX marketplace_carts_user_status_updated_idx
  ON public.marketplace_carts(user_id, status, updated_at DESC);
CREATE INDEX marketplace_carts_store_idx ON public.marketplace_carts(store_id);

CREATE TABLE public.marketplace_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.marketplace_carts(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.marketplace_book_listings(id) ON DELETE RESTRICT,
  inventory_id UUID NOT NULL REFERENCES public.store_inventory(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
  price_snapshot_minor INTEGER NOT NULL CHECK (price_snapshot_minor >= 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency_code = 'INR'),
  listing_snapshot JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cart_id, listing_id)
);

CREATE INDEX marketplace_cart_items_cart_idx ON public.marketplace_cart_items(cart_id);
CREATE INDEX marketplace_cart_items_listing_idx ON public.marketplace_cart_items(listing_id);
CREATE INDEX marketplace_cart_items_inventory_idx ON public.marketplace_cart_items(inventory_id);
CREATE INDEX marketplace_cart_items_store_idx ON public.marketplace_cart_items(store_id);

CREATE TABLE public.store_schedule_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  exception_type TEXT NOT NULL
    CHECK (exception_type IN ('holiday', 'planned_closure', 'special_hours', 'emergency_closure')),
  timezone TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  special_hours JSONB,
  reason_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'cancelled', 'completed')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX store_schedule_exceptions_store_time_idx
  ON public.store_schedule_exceptions(store_id, starts_at, ends_at);
CREATE INDEX store_schedule_exceptions_created_by_idx
  ON public.store_schedule_exceptions(created_by);

CREATE TABLE public.store_order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  cart_id UUID NOT NULL REFERENCES public.marketplace_carts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'store_reviewing', 'awaiting_clarification',
    'awaiting_customer_decision', 'paused_for_emergency_closure', 'payment_ready',
    'unavailable', 'store_rejected', 'customer_cancelled', 'platform_cancelled',
    'expired', 'payment_ready_expired'
  )),
  status_reason_code TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  fulfillment_method TEXT NOT NULL CHECK (fulfillment_method IN ('pickup', 'delivery')),
  final_fulfillment_method TEXT CHECK (final_fulfillment_method IN ('pickup', 'delivery')),
  currency_code CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency_code = 'INR'),
  requested_subtotal_minor INTEGER NOT NULL CHECK (requested_subtotal_minor >= 0),
  provisional_delivery_tariff_minor INTEGER NOT NULL CHECK (provisional_delivery_tariff_minor >= 0),
  final_subtotal_minor INTEGER CHECK (final_subtotal_minor >= 0),
  final_delivery_tariff_minor INTEGER CHECK (final_delivery_tariff_minor >= 0),
  discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  final_total_minor INTEGER CHECK (final_total_minor >= 0),
  money_calculator_version INTEGER NOT NULL CHECK (money_calculator_version >= 1),
  delivery_tariff_version INTEGER NOT NULL CHECK (delivery_tariff_version >= 1),
  confirmation_reminder_at TIMESTAMPTZ NOT NULL,
  confirmation_due_at TIMESTAMPTZ NOT NULL,
  clarification_expires_at TIMESTAMPTZ,
  acceptance_expires_at TIMESTAMPTZ,
  payment_expires_at TIMESTAMPTZ,
  paused_from_status TEXT,
  closure_exception_id UUID REFERENCES public.store_schedule_exceptions(id) ON DELETE RESTRICT,
  closure_pause_expires_at TIMESTAMPTZ,
  confirmation_open_seconds_remaining INTEGER CHECK (confirmation_open_seconds_remaining >= 0),
  decision_seconds_remaining INTEGER CHECK (decision_seconds_remaining >= 0),
  emergency_pause_count INTEGER NOT NULL DEFAULT 0 CHECK (emergency_pause_count >= 0),
  correlation_id UUID NOT NULL,
  latest_command_id UUID NOT NULL,
  customer_note TEXT CHECK (char_length(customer_note) <= 1000),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminal_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cart_id)
);

CREATE INDEX store_order_requests_user_status_updated_idx
  ON public.store_order_requests(user_id, status, updated_at DESC);
CREATE INDEX store_order_requests_store_status_updated_idx
  ON public.store_order_requests(store_id, status, updated_at DESC);
CREATE INDEX store_order_requests_confirmation_due_idx
  ON public.store_order_requests(confirmation_due_at)
  WHERE status IN ('submitted', 'store_reviewing');
CREATE INDEX store_order_requests_payment_expiry_idx
  ON public.store_order_requests(payment_expires_at) WHERE status = 'payment_ready';
CREATE INDEX store_order_requests_closure_exception_idx
  ON public.store_order_requests(closure_exception_id);

CREATE TABLE public.store_order_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_request_id UUID NOT NULL REFERENCES public.store_order_requests(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  listing_id UUID NOT NULL REFERENCES public.marketplace_book_listings(id) ON DELETE RESTRICT,
  inventory_id UUID NOT NULL REFERENCES public.store_inventory(id) ON DELETE RESTRICT,
  canonical_work_id UUID REFERENCES public.canonical_works(id) ON DELETE SET NULL,
  canonical_edition_id UUID REFERENCES public.canonical_editions(id) ON DELETE SET NULL,
  title_snapshot TEXT NOT NULL,
  authors_snapshot JSONB NOT NULL,
  isbn_10_snapshot TEXT,
  isbn_13_snapshot TEXT,
  edition_format_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  condition_snapshot TEXT NOT NULL,
  condition_notes_snapshot TEXT,
  image_url_snapshot TEXT,
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
  confirmed_quantity INTEGER CHECK (confirmed_quantity >= 0 AND confirmed_quantity <= requested_quantity),
  server_bound_unit_price_minor INTEGER NOT NULL CHECK (server_bound_unit_price_minor >= 0),
  confirmed_unit_price_minor INTEGER,
  currency_code CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency_code = 'INR'),
  confirmation_status TEXT NOT NULL DEFAULT 'requested' CHECK (confirmation_status IN (
    'requested', 'needs_clarification', 'confirmed_full', 'confirmed_partial', 'unavailable', 'rejected'
  )),
  price_drift_review_required BOOLEAN NOT NULL DEFAULT false,
  unavailable_reason_code TEXT,
  clarification_reason_code TEXT,
  rejection_reason_code TEXT,
  pickup_eligible_snapshot BOOLEAN NOT NULL,
  delivery_eligible_snapshot BOOLEAN NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (confirmed_unit_price_minor IS NULL OR (
    confirmed_unit_price_minor >= 0
    AND confirmed_unit_price_minor <= server_bound_unit_price_minor
  )),
  UNIQUE (order_request_id, listing_id)
);

CREATE INDEX store_order_request_items_request_status_idx
  ON public.store_order_request_items(order_request_id, confirmation_status);
CREATE INDEX store_order_request_items_inventory_idx
  ON public.store_order_request_items(inventory_id);
CREATE INDEX store_order_request_items_store_idx ON public.store_order_request_items(store_id);

CREATE TABLE public.inventory_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  inventory_id UUID NOT NULL REFERENCES public.store_inventory(id) ON DELETE RESTRICT,
  order_request_id UUID NOT NULL REFERENCES public.store_order_requests(id) ON DELETE RESTRICT,
  order_request_item_id UUID NOT NULL REFERENCES public.store_order_request_items(id) ON DELETE RESTRICT,
  hold_type TEXT NOT NULL CHECK (hold_type IN ('soft', 'firm')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'released', 'converted_to_sale')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  expires_at TIMESTAMPTZ NOT NULL,
  release_reason_code TEXT,
  command_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX inventory_holds_one_active_request_item
  ON public.inventory_holds(order_request_item_id) WHERE status = 'active';
CREATE INDEX inventory_holds_inventory_status_expiry_idx
  ON public.inventory_holds(inventory_id, status, expires_at);
CREATE INDEX inventory_holds_request_status_idx
  ON public.inventory_holds(order_request_id, status);
CREATE INDEX inventory_holds_store_idx ON public.inventory_holds(store_id);

-- Existing inequality remains valid for historical rows. The equality follow-up is
-- NOT VALID until the required live-data audit; it still constrains new mutations.
ALTER TABLE public.store_inventory DROP CONSTRAINT store_inventory_quantity_balance;
ALTER TABLE public.store_inventory ADD CONSTRAINT store_inventory_quantity_balance
  CHECK (quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_removed)
  NOT VALID;
REVOKE UPDATE ON public.store_inventory FROM authenticated;

COMMIT;
