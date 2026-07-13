-- Phase 1A: Multi-Tenant Bookstore Marketplace Foundation - Schema
-- Creates 25 marketplace domain tables + public_store_profiles projection
-- and FK indexes. Distinct from P2P listings/transactions.
-- The private marketplace_sec helper schema is created in Part B.
-- Governance decisions (Phase 1 review questions) recorded in DOC-13.
BEGIN;
-- =====================================================================
-- 1. STORE TENANT CORE
-- =====================================================================
-- Controlled localities must exist before stores reference them.
CREATE TABLE public.marketplace_localities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_pilot_enabled BOOLEAN NOT NULL DEFAULT false,
  geo GEOGRAPHY(POLYGON),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  legal_name TEXT,
  legal_seller_name TEXT,
  store_type TEXT NOT NULL DEFAULT 'independent',
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  locality_id UUID REFERENCES public.marketplace_localities(id) ON DELETE SET NULL,
  public_address_mode TEXT NOT NULL DEFAULT 'hidden'
    CHECK (public_address_mode IN ('hidden', 'locality_only', 'full')),
  location GEOGRAPHY(POINT),
  operating_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  pickup_enabled BOOLEAN NOT NULL DEFAULT false,
  delivery_enabled BOOLEAN NOT NULL DEFAULT false,
  minimum_delivery_order_value_minor INTEGER,
  return_policy_type TEXT NOT NULL DEFAULT 'no_returns',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_verification', 'approved_pending_setup', 'active',
    'selling_restricted', 'suspended', 'closed', 'rejected'
  )),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'approved', 'rejected')),
  setup_status TEXT NOT NULL DEFAULT 'incomplete'
    CHECK (setup_status IN ('incomplete', 'complete')),
  selling_status TEXT NOT NULL DEFAULT 'not_allowed'
    CHECK (selling_status IN ('not_allowed', 'allowed', 'restricted')),
  suspension_reason TEXT,
  seller_agreement_version TEXT,
  seller_agreement_accepted_at TIMESTAMPTZ,
  prohibited_items_policy_accepted_at TIMESTAMPTZ,
  support_policy_accepted_at TIMESTAMPTZ,
  payout_account_status TEXT NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE TABLE public.store_administrators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'staff')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'pending')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  UNIQUE (store_id, user_id)
);

CREATE TABLE public.store_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public, column-safe projection of active stores (dedicated table, kept in
-- sync by a SECURITY DEFINER trigger). Avoids exposing private store columns
-- and avoids a SECURITY DEFINER view advisor finding.
CREATE TABLE public.public_store_profiles (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  city TEXT,
  state TEXT,
  locality_id UUID REFERENCES public.marketplace_localities(id) ON DELETE SET NULL,
  locality_name TEXT,
  location GEOGRAPHY(POINT),
  operating_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  pickup_enabled BOOLEAN NOT NULL DEFAULT false,
  delivery_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. VERIFICATION, DOCUMENTS, PAYOUT READINESS
-- =====================================================================
CREATE TABLE public.store_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'needs_more_info', 'approved', 'rejected', 'cancelled'
  )),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  applicant_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.store_verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.store_verification_requests(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'under_review', 'accepted', 'rejected')),
  masked_label TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.seller_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'submitted', 'verified', 'needs_review', 'rejected', 'disabled'
  )),
  -- Phase 1 stores masked metadata only; full account details are deferred to
  -- provider tokenization in a later phase (see DOC-13 decision #4).
  beneficiary_name TEXT,
  account_last4 TEXT,
  provider TEXT,
  provider_account_ref TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.store_risk_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL DEFAULT 'unknown'
    CHECK (risk_level IN ('unknown', 'low', 'medium', 'high')),
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 3. SUBSCRIPTION, ENTITLEMENT, USAGE, POLICY CONFIG
-- =====================================================================
CREATE TABLE public.store_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.store_subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN (
    'trialing', 'active', 'past_due', 'grace_period', 'restricted', 'cancelled'
  )),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.store_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  limit_value INTEGER,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'plan',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, feature_key)
);

CREATE TABLE public.store_usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  counter_key TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  used_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, counter_key, period_start)
);

CREATE TABLE public.marketplace_policy_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'global'
    CHECK (scope_type IN ('global', 'city', 'locality', 'store')),
  scope_value TEXT,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 4. PLATFORM ROLES AND ADMIN AUDIT
-- =====================================================================
CREATE TABLE public.platform_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'platform_admin', 'store_reviewer', 'support_agent',
    'finance_ops', 'moderator', 'delivery_ops'
  )),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.platform_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  target_entity_type TEXT,
  target_entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 5. EVENT AND AUDIT FOUNDATION
-- =====================================================================
CREATE TABLE public.marketplace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  source TEXT NOT NULL DEFAULT 'system_job' CHECK (source IN (
    'consumer_app', 'store_owner_app', 'platform_ops',
    'system_job', 'payment_provider', 'delivery_provider', 'edge_function'
  )),
  idempotency_key TEXT UNIQUE,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  requires_action BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.marketplace_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cross-scope idempotency table; RLS denies client access by default.
CREATE TABLE public.commerce_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (scope, key)
);

-- Column-safe notification projection; clients read this, never raw marketplace_events.
CREATE TABLE public.marketplace_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.event_action_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.marketplace_events(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  assigned_role TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 6. MINIMAL OPS QUEUES (shells for later phases)
-- =====================================================================
CREATE TABLE public.support_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  case_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'waiting_on_store', 'waiting_on_customer',
    'waiting_on_provider', 'resolved', 'closed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_role TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  private_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE public.refund_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  case_type TEXT NOT NULL DEFAULT 'refund',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'waiting_on_store', 'waiting_on_customer',
    'waiting_on_provider', 'resolved', 'closed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_role TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  private_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE public.finance_reconciliation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  case_type TEXT NOT NULL DEFAULT 'reconciliation',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'waiting_on_store', 'waiting_on_customer',
    'waiting_on_provider', 'resolved', 'closed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_role TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  private_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE public.settlement_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'waiting_on_provider', 'resolved', 'closed', 'cancelled'
  )),
  period_start DATE,
  period_end DATE,
  gross_amount_minor INTEGER NOT NULL DEFAULT 0,
  net_amount_minor INTEGER NOT NULL DEFAULT 0,
  tcs_deduction_minor INTEGER,
  gst_on_commission_minor INTEGER,
  tax_adjustments_minor INTEGER,
  tax_treatment_version TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.moderation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  case_type TEXT NOT NULL DEFAULT 'moderation',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'waiting_on_store', 'resolved', 'closed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_role TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  private_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE public.delivery_ops_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  case_type TEXT NOT NULL DEFAULT 'delivery_exception',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'waiting_on_store', 'waiting_on_provider',
    'resolved', 'closed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_role TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  private_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- =====================================================================
-- FOREIGN KEY + LOOKUP INDEXES
-- (FK columns already covered by the leading column of a UNIQUE index are
--  intentionally omitted to avoid duplicate-index advisor findings.)
-- =====================================================================
CREATE INDEX idx_store_admins_user ON public.store_administrators(user_id);
CREATE INDEX idx_store_admins_assigned_by ON public.store_administrators(assigned_by);
CREATE INDEX idx_store_admins_revoked_by ON public.store_administrators(revoked_by);
CREATE INDEX idx_store_status_hist_store ON public.store_status_history(store_id);
CREATE INDEX idx_store_status_hist_changed_by ON public.store_status_history(changed_by);
CREATE INDEX idx_verif_req_store ON public.store_verification_requests(store_id);
CREATE INDEX idx_verif_req_reviewed_by ON public.store_verification_requests(reviewed_by);
CREATE INDEX idx_verif_doc_store ON public.store_verification_documents(store_id);
CREATE INDEX idx_verif_doc_request ON public.store_verification_documents(request_id);
CREATE INDEX idx_verif_doc_uploaded_by ON public.store_verification_documents(uploaded_by);
CREATE INDEX idx_verif_doc_reviewed_by ON public.store_verification_documents(reviewed_by);
CREATE INDEX idx_payout_store ON public.seller_payout_accounts(store_id);
CREATE INDEX idx_risk_store ON public.store_risk_reviews(store_id);
CREATE INDEX idx_risk_reviewed_by ON public.store_risk_reviews(reviewed_by);
CREATE INDEX idx_subs_store ON public.store_subscriptions(store_id);
CREATE INDEX idx_subs_plan ON public.store_subscriptions(plan_id);
CREATE INDEX idx_policy_store ON public.marketplace_policy_config(store_id);
CREATE INDEX idx_platform_roles_granted_by ON public.platform_user_roles(granted_by);
CREATE INDEX idx_admin_actions_actor ON public.platform_admin_actions(actor_user_id);
CREATE INDEX idx_admin_actions_store ON public.platform_admin_actions(store_id);
CREATE INDEX idx_events_store ON public.marketplace_events(store_id);
CREATE INDEX idx_events_user ON public.marketplace_events(user_id);
CREATE INDEX idx_events_actor ON public.marketplace_events(actor_user_id);
CREATE INDEX idx_audit_store ON public.marketplace_audit_logs(store_id);
CREATE INDEX idx_audit_actor ON public.marketplace_audit_logs(actor_user_id);
CREATE INDEX idx_event_tasks_event ON public.event_action_tasks(event_id);
CREATE INDEX idx_event_tasks_store ON public.event_action_tasks(store_id);
CREATE INDEX idx_event_tasks_assigned ON public.event_action_tasks(assigned_to);
CREATE INDEX idx_support_store ON public.support_cases(store_id);
CREATE INDEX idx_support_assigned ON public.support_cases(assigned_to);
CREATE INDEX idx_support_opened_by ON public.support_cases(opened_by);
CREATE INDEX idx_refund_store ON public.refund_cases(store_id);
CREATE INDEX idx_refund_assigned ON public.refund_cases(assigned_to);
CREATE INDEX idx_refund_opened_by ON public.refund_cases(opened_by);
CREATE INDEX idx_recon_store ON public.finance_reconciliation_cases(store_id);
CREATE INDEX idx_recon_assigned ON public.finance_reconciliation_cases(assigned_to);
CREATE INDEX idx_recon_opened_by ON public.finance_reconciliation_cases(opened_by);
CREATE INDEX idx_settlement_store ON public.settlement_batches(store_id);
CREATE INDEX idx_moderation_store ON public.moderation_cases(store_id);
CREATE INDEX idx_moderation_assigned ON public.moderation_cases(assigned_to);
CREATE INDEX idx_moderation_opened_by ON public.moderation_cases(opened_by);
CREATE INDEX idx_delivery_store ON public.delivery_ops_cases(store_id);
CREATE INDEX idx_delivery_assigned ON public.delivery_ops_cases(assigned_to);
CREATE INDEX idx_delivery_opened_by ON public.delivery_ops_cases(opened_by);
CREATE INDEX idx_stores_status ON public.stores(status);
CREATE INDEX idx_stores_locality ON public.stores(locality_id);
CREATE INDEX idx_stores_location_gist ON public.stores USING gist(location);
CREATE INDEX idx_public_profiles_locality ON public.public_store_profiles(locality_id);
CREATE INDEX idx_public_profiles_location_gist
  ON public.public_store_profiles USING gist(location);
CREATE INDEX idx_localities_slug ON public.marketplace_localities(slug);
CREATE INDEX idx_localities_city ON public.marketplace_localities(city);
COMMIT;
