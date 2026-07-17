-- Phase 6 Unit 2B: immutable commercial/private snapshots and evidence.
BEGIN;

CREATE TABLE public.store_order_request_private_snapshots (
  order_request_id UUID PRIMARY KEY REFERENCES public.store_order_requests(id) ON DELETE RESTRICT,
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  contact_snapshot JSONB,
  delivery_address_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX store_order_request_private_customer_idx
  ON public.store_order_request_private_snapshots(customer_user_id);

CREATE TABLE public.store_order_request_private_snapshot_tombstones (
  order_request_id UUID PRIMARY KEY REFERENCES public.store_order_requests(id) ON DELETE RESTRICT,
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  deletion_reason_code TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.store_order_request_seller_snapshots (
  order_request_id UUID PRIMARY KEY REFERENCES public.store_order_requests(id) ON DELETE RESTRICT,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  seller_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.store_order_request_policy_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_request_id UUID NOT NULL REFERENCES public.store_order_requests(id) ON DELETE RESTRICT,
  policy_key TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('boolean', 'integer', 'money_minor', 'string', 'json')),
  resolved_value JSONB NOT NULL,
  source_policy_id UUID REFERENCES public.marketplace_policy_config(id) ON DELETE RESTRICT,
  source_policy_version INTEGER NOT NULL CHECK (source_policy_version >= 1),
  source_scope_type TEXT NOT NULL CHECK (source_scope_type IN ('global', 'city', 'locality', 'store')),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_request_id, policy_key)
);

CREATE INDEX store_order_request_policy_source_idx
  ON public.store_order_request_policy_snapshots(source_policy_id);

CREATE TABLE public.order_request_policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_request_id UUID NOT NULL REFERENCES public.store_order_requests(id) ON DELETE RESTRICT,
  customer_actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  policy_identifier TEXT NOT NULL,
  accepted_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  interface_source TEXT NOT NULL,
  command_id UUID NOT NULL,
  correlation_id UUID NOT NULL,
  policy_snapshot_id UUID NOT NULL
    REFERENCES public.store_order_request_policy_snapshots(id) ON DELETE RESTRICT,
  UNIQUE (order_request_id, policy_identifier, accepted_version)
);

CREATE INDEX order_request_policy_acceptances_actor_idx
  ON public.order_request_policy_acceptances(customer_actor_id);
CREATE INDEX order_request_policy_acceptances_snapshot_idx
  ON public.order_request_policy_acceptances(policy_snapshot_id);

CREATE TABLE public.commerce_entity_creation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  initial_state TEXT NOT NULL,
  initial_version INTEGER NOT NULL CHECK (initial_version >= 1),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  command_name TEXT NOT NULL,
  command_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  correlation_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.marketplace_events(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id),
  UNIQUE (command_id),
  UNIQUE (event_id)
);

CREATE INDEX commerce_entity_creation_actor_idx
  ON public.commerce_entity_creation_log(actor_user_id);

CREATE TABLE public.commerce_transition_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  previous_state TEXT NOT NULL,
  next_state TEXT NOT NULL,
  previous_version INTEGER NOT NULL CHECK (previous_version >= 1),
  next_version INTEGER NOT NULL CHECK (next_version > previous_version),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  command_name TEXT NOT NULL,
  command_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  reason_code TEXT,
  correlation_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.marketplace_events(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, command_id),
  UNIQUE (event_id)
);

CREATE INDEX commerce_transition_entity_time_idx
  ON public.commerce_transition_log(entity_type, entity_id, created_at);
CREATE INDEX commerce_transition_actor_idx ON public.commerce_transition_log(actor_user_id);

-- Snapshot and evidence tables are command/service managed. Unit 3 adds safe reads.
REVOKE ALL ON public.store_order_request_private_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.store_order_request_private_snapshot_tombstones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.store_order_request_seller_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.store_order_request_policy_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.order_request_policy_acceptances FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commerce_entity_creation_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commerce_transition_log FROM PUBLIC, anon, authenticated;

COMMIT;
