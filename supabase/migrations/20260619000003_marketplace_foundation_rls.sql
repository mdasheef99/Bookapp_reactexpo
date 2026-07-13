-- Phase 1C: Multi-Tenant Bookstore Marketplace Foundation - RLS
-- Enables Row Level Security on all foundation tables and creates
-- the RLS policies. Depends on Part B (helper functions).
-- Governance decisions (Phase 1 review questions) recorded in DOC-13.

BEGIN;
-- =====================================================================
-- ENABLE ROW LEVEL SECURITY ON EVERY NEW TABLE
-- =====================================================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_risk_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_policy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_action_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_reconciliation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_ops_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS POLICIES
-- One permissive policy per (role, action) to avoid multiple_permissive
-- advisor findings. Owner reads OR platform reads are combined with OR.
-- =====================================================================

-- public_store_profiles: safe public read only; writes via definer trigger.
CREATE POLICY "public profiles readable" ON public.public_store_profiles
  FOR SELECT TO anon, authenticated USING (true);

-- stores
CREATE POLICY "stores select" ON public.stores
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(id) OR marketplace_sec.is_platform_operator());
CREATE POLICY "stores insert" ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "stores update" ON public.stores
  FOR UPDATE TO authenticated
  USING (marketplace_sec.is_store_admin(id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (marketplace_sec.is_store_admin(id)
              OR marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "stores delete" ON public.stores
  FOR DELETE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

-- store_administrators (self-read avoids recursion; platform-managed writes)
CREATE POLICY "store_admins select" ON public.store_administrators
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "store_admins insert" ON public.store_administrators
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "store_admins update" ON public.store_administrators
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "store_admins delete" ON public.store_administrators
  FOR DELETE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

-- store_status_history (append-only)
CREATE POLICY "status_history select" ON public.store_status_history
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.is_platform_operator());
CREATE POLICY "status_history insert" ON public.store_status_history
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.is_platform_operator());

-- store_verification_requests
CREATE POLICY "verif_req select" ON public.store_verification_requests
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));
CREATE POLICY "verif_req insert" ON public.store_verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.is_store_admin(store_id)
              OR marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));
CREATE POLICY "verif_req update" ON public.store_verification_requests
  FOR UPDATE TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']))
  WITH CHECK (marketplace_sec.is_store_admin(store_id)
              OR marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));

-- store_verification_documents (owner uploads metadata; review platform-only)
CREATE POLICY "verif_doc select" ON public.store_verification_documents
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));
CREATE POLICY "verif_doc insert" ON public.store_verification_documents
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.is_store_admin(store_id)
              OR marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));
CREATE POLICY "verif_doc update" ON public.store_verification_documents
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));

-- seller_payout_accounts (owner sees masked status; writes finance-only)
CREATE POLICY "payout select" ON public.seller_payout_accounts
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));
CREATE POLICY "payout insert" ON public.seller_payout_accounts
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));
CREATE POLICY "payout update" ON public.seller_payout_accounts
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));

-- store_risk_reviews (platform reviewers only; no owner access)
CREATE POLICY "risk all" ON public.store_risk_reviews
  FOR ALL TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer']));

-- store_subscription_plans (active plans readable; admin-managed)
CREATE POLICY "plans select" ON public.store_subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = true OR marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "plans insert" ON public.store_subscription_plans
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "plans update" ON public.store_subscription_plans
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "plans delete" ON public.store_subscription_plans
  FOR DELETE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

-- store_subscriptions
CREATE POLICY "subs select" ON public.store_subscriptions
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));
CREATE POLICY "subs insert" ON public.store_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));
CREATE POLICY "subs update" ON public.store_subscriptions
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));

-- store_entitlements
CREATE POLICY "entitlements select" ON public.store_entitlements
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "entitlements insert" ON public.store_entitlements
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "entitlements update" ON public.store_entitlements
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

-- store_usage_counters
CREATE POLICY "usage select" ON public.store_usage_counters
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "usage insert" ON public.store_usage_counters
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "usage update" ON public.store_usage_counters
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

-- marketplace_policy_config (platform config roles only)
CREATE POLICY "policy_config all" ON public.marketplace_policy_config
  FOR ALL TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));

-- platform_user_roles (self-read avoids recursion; admin-managed)
CREATE POLICY "platform_roles select" ON public.platform_user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "platform_roles insert" ON public.platform_user_roles
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "platform_roles update" ON public.platform_user_roles
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "platform_roles delete" ON public.platform_user_roles
  FOR DELETE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

-- platform_admin_actions (append-only; operators log own actions)
CREATE POLICY "admin_actions select" ON public.platform_admin_actions
  FOR SELECT TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']));
CREATE POLICY "admin_actions insert" ON public.platform_admin_actions
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.is_platform_operator() AND actor_user_id = auth.uid());

-- marketplace_events: server-side writes only; no client SELECT. Clients read marketplace_notifications.
-- (select policy intentionally omitted)

-- marketplace_notifications: column-safe projection for clients.
CREATE POLICY "notifications select own" ON public.marketplace_notifications
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid())
         OR (store_id IS NOT NULL AND marketplace_sec.is_store_admin(store_id))
         OR marketplace_sec.is_platform_operator());

-- marketplace_localities: public read; platform admin manages.
CREATE POLICY "localities select" ON public.marketplace_localities
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "localities manage" ON public.marketplace_localities
  FOR ALL TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

-- commerce_idempotency_keys: service-role only; RLS denies by default.

-- marketplace_audit_logs (platform admin read only; server-side writes)
CREATE POLICY "audit select" ON public.marketplace_audit_logs
  FOR SELECT TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin']));

-- event_action_tasks (platform operators)
CREATE POLICY "event_tasks all" ON public.event_action_tasks
  FOR ALL TO authenticated
  USING (marketplace_sec.is_platform_operator())
  WITH CHECK (marketplace_sec.is_platform_operator());

-- support_cases
CREATE POLICY "support select" ON public.support_cases
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin','support_agent']));
CREATE POLICY "support insert" ON public.support_cases
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','support_agent']));
CREATE POLICY "support update" ON public.support_cases
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','support_agent']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','support_agent']));

-- refund_cases
CREATE POLICY "refund select" ON public.refund_cases
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));
CREATE POLICY "refund insert" ON public.refund_cases
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));
CREATE POLICY "refund update" ON public.refund_cases
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));

-- finance_reconciliation_cases (finance/admin only)
CREATE POLICY "recon all" ON public.finance_reconciliation_cases
  FOR ALL TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));

-- settlement_batches
CREATE POLICY "settlement select" ON public.settlement_batches
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));
CREATE POLICY "settlement insert" ON public.settlement_batches
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));
CREATE POLICY "settlement update" ON public.settlement_batches
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','finance_ops']));

-- moderation_cases (moderator/admin only)
CREATE POLICY "moderation all" ON public.moderation_cases
  FOR ALL TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','moderator']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','moderator']));

-- delivery_ops_cases
CREATE POLICY "delivery select" ON public.delivery_ops_cases
  FOR SELECT TO authenticated
  USING (marketplace_sec.is_store_admin(store_id)
         OR marketplace_sec.has_platform_role(ARRAY['platform_admin','delivery_ops']));
CREATE POLICY "delivery insert" ON public.delivery_ops_cases
  FOR INSERT TO authenticated
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','delivery_ops']));
CREATE POLICY "delivery update" ON public.delivery_ops_cases
  FOR UPDATE TO authenticated
  USING (marketplace_sec.has_platform_role(ARRAY['platform_admin','delivery_ops']))
  WITH CHECK (marketplace_sec.has_platform_role(ARRAY['platform_admin','delivery_ops']));

COMMIT;
