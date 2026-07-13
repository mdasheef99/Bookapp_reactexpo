import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuthenticatedUser, requirePlatformRole, sanitizeSupabaseError } from '../_shared/marketplaceAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const REVIEW_ROLES = ['platform_admin', 'store_reviewer'];
const STORE_REVIEW_FUNCTION = 'store-review';

type StoreReviewDecision = 'approve' | 'reject' | 'request_more_info' | 'suspend' | 'restrict';

interface StoreReviewActionInput {
  storeId: string;
  verificationRequestId?: string;
  decision: StoreReviewDecision;
  reason: string;
  requiredFollowUp?: Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function assertMutation(promise: Promise<{ error: unknown }>, context: string) {
  const { error } = await promise;
  if (error) throw sanitizeSupabaseError(context);
}

function requireReason(action: StoreReviewActionInput, decisions: StoreReviewDecision[]) {
  if (decisions.includes(action.decision) && !action.reason?.trim()) {
    throw new Response('A review reason is required for this decision', { status: 400 });
  }
}

async function latestRequest(serviceClient: any, action: StoreReviewActionInput) {
  if (action.verificationRequestId) {
    const { data, error } = await serviceClient
      .from('store_verification_requests')
      .select('id, status')
      .eq('id', action.verificationRequestId)
      .eq('store_id', action.storeId)
      .maybeSingle();
    if (error) throw sanitizeSupabaseError('verification request lookup failed');
    return data;
  }

  const { data, error } = await serviceClient
    .from('store_verification_requests')
    .select('id, status')
    .eq('store_id', action.storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw sanitizeSupabaseError('latest verification request lookup failed');
  return data;
}

async function currentStoreStatus(serviceClient: any, storeId: string) {
  const { data, error } = await serviceClient
    .from('stores')
    .select('status')
    .eq('id', storeId)
    .maybeSingle();
  if (error) throw sanitizeSupabaseError('store status lookup failed');
  if (!data) throw new Response('Store not found', { status: 404 });
  return data.status as string;
}

async function createFoundingTrialEntitlements(serviceClient: any, storeId: string) {
  const { data: existingSubscription, error: subscriptionLookupError } = await serviceClient
    .from('store_subscriptions')
    .select('id')
    .eq('store_id', storeId)
    .in('status', ['trialing', 'active', 'grace_period'])
    .limit(1)
    .maybeSingle();
  if (subscriptionLookupError) throw sanitizeSupabaseError('subscription lookup failed');

  if (!existingSubscription) {
    const { data: plan, error: planError } = await serviceClient
      .from('store_subscription_plans')
      .select('id')
      .eq('code', 'starter')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (planError) throw sanitizeSupabaseError('subscription plan lookup failed');

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setMonth(trialEnd.getMonth() + 3);
    const { error } = await serviceClient.from('store_subscriptions').insert({
      store_id: storeId,
      plan_id: plan?.id ?? null,
      status: 'trialing',
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
    });
    if (error) throw sanitizeSupabaseError('trial subscription insert failed');
  }

  const entitlements = [
    { store_id: storeId, feature_key: 'inventory_item_limit', limit_value: 100, is_enabled: true, source: 'founding_trial' },
    { store_id: storeId, feature_key: 'monthly_image_extraction_limit', limit_value: 25, is_enabled: true, source: 'founding_trial' },
    { store_id: storeId, feature_key: 'active_listing_limit', limit_value: 100, is_enabled: true, source: 'founding_trial' },
    { store_id: storeId, feature_key: 'analytics_enabled', limit_value: null, is_enabled: false, source: 'founding_trial' },
  ];
  const { error } = await serviceClient
    .from('store_entitlements')
    .upsert(entitlements, { onConflict: 'store_id,feature_key' });
  if (error) throw sanitizeSupabaseError('entitlement upsert failed');
}

async function logReview(serviceClient: any, action: StoreReviewActionInput, actorId: string, actorRole: string, fromStatus: string) {
  const eventType = `store_review_${action.decision}`;
  const targetEntityId = action.verificationRequestId ?? action.storeId;
  await assertMutation(serviceClient.from('store_status_history').insert({
    store_id: action.storeId,
    from_status: fromStatus,
    to_status: statusForDecision(action.decision),
    reason: action.reason?.trim() || null,
    changed_by: actorId,
  }), 'store status history insert failed');
  await assertMutation(serviceClient.from('platform_admin_actions').insert({
    actor_user_id: actorId,
    action_type: eventType,
    store_id: action.storeId,
    target_entity_type: 'store_verification_request',
    target_entity_id: targetEntityId,
    details: { function: STORE_REVIEW_FUNCTION, reason: action.reason ?? null, requiredFollowUp: action.requiredFollowUp ?? null },
  }), 'platform admin action insert failed');
  await assertMutation(serviceClient.from('marketplace_events').insert({
    event_type: eventType,
    entity_type: 'store_verification_request',
    entity_id: targetEntityId,
    store_id: action.storeId,
    actor_user_id: actorId,
    actor_role: actorRole,
    source: 'edge_function',
    payload: { function: STORE_REVIEW_FUNCTION, decision: action.decision },
  }), 'marketplace event insert failed');
  await assertMutation(serviceClient.from('marketplace_audit_logs').insert({
    store_id: action.storeId,
    actor_user_id: actorId,
    action: eventType,
    entity_type: 'store_verification_request',
    entity_id: targetEntityId,
    details: { function: STORE_REVIEW_FUNCTION, decision: action.decision, reason: action.reason ?? null },
  }), 'marketplace audit log insert failed');
}

function statusForDecision(decision: StoreReviewDecision) {
  if (decision === 'approve') return 'approved_pending_setup';
  if (decision === 'reject') return 'rejected';
  if (decision === 'suspend') return 'suspended';
  if (decision === 'restrict') return 'selling_restricted';
  return 'pending_verification';
}

async function applyDecision(serviceClient: any, action: StoreReviewActionInput, actorId: string, actorRole: string) {
  const fromStatus = await currentStoreStatus(serviceClient, action.storeId);
  const request = await latestRequest(serviceClient, action);
  if (!request && action.decision !== 'suspend' && action.decision !== 'restrict') {
    throw new Response('Verification request not found', { status: 404 });
  }
  action.verificationRequestId = request?.id ?? action.verificationRequestId;

  if (action.decision === 'approve') {
    const now = new Date().toISOString();
    await assertMutation(serviceClient.from('store_verification_requests').update({
      status: 'approved',
      reviewed_by: actorId,
      reviewed_at: now,
      review_notes: action.reason?.trim() || null,
      rejection_reason: null,
      required_follow_up: {},
    }).eq('id', action.verificationRequestId).eq('store_id', action.storeId), 'approval request update failed');
    await assertMutation(serviceClient.from('stores').update({
      status: 'approved_pending_setup',
      verification_status: 'approved',
      setup_status: 'incomplete',
      selling_status: 'not_allowed',
      approved_at: now,
      restriction_reason: null,
      updated_at: now,
    }).eq('id', action.storeId), 'approval store update failed');
    await createFoundingTrialEntitlements(serviceClient, action.storeId);
  }

  if (action.decision === 'reject') {
    const now = new Date().toISOString();
    await assertMutation(serviceClient.from('store_verification_requests').update({
      status: 'rejected',
      reviewed_by: actorId,
      reviewed_at: now,
      rejection_reason: action.reason.trim(),
      review_notes: action.reason.trim(),
    }).eq('id', action.verificationRequestId).eq('store_id', action.storeId), 'rejection request update failed');
    await assertMutation(serviceClient.from('stores').update({
      status: 'rejected',
      verification_status: 'rejected',
      selling_status: 'not_allowed',
      updated_at: now,
    }).eq('id', action.storeId), 'rejection store update failed');
  }

  if (action.decision === 'request_more_info') {
    await assertMutation(serviceClient.from('store_verification_requests').update({
      status: 'needs_more_info',
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
      review_notes: action.reason?.trim() || null,
      required_follow_up: action.requiredFollowUp ?? {},
    }).eq('id', action.verificationRequestId).eq('store_id', action.storeId), 'more info request update failed');
    await assertMutation(
      serviceClient.from('stores').update({ status: 'pending_verification', updated_at: new Date().toISOString() }).eq('id', action.storeId),
      'more info store update failed',
    );
  }

  if (action.decision === 'suspend') {
    await assertMutation(serviceClient.from('stores').update({
      status: 'suspended',
      selling_status: 'restricted',
      suspension_reason: action.reason.trim(),
      suspended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', action.storeId), 'suspension store update failed');
  }

  if (action.decision === 'restrict') {
    await assertMutation(serviceClient.from('stores').update({
      status: 'selling_restricted',
      selling_status: 'restricted',
      restriction_reason: action.reason.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', action.storeId), 'restriction store update failed');
  }

  await logReview(serviceClient, action, actorId, actorRole, fromStatus);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'Missing Supabase environment' }, 500);

    const actor = await requireAuthenticatedUser(req, supabaseUrl, anonKey);
    const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const actorRole = await requirePlatformRole(serviceClient, actor.id, REVIEW_ROLES);
    const action = await req.json() as StoreReviewActionInput;

    requireReason(action, ['reject', 'suspend', 'restrict']);
    await applyDecision(serviceClient, action, actor.id, actorRole);
    return jsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(`[${STORE_REVIEW_FUNCTION}] Unexpected error`, error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
