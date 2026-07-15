import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuthenticatedUser, requireStoreAdmin, sanitizeSupabaseError } from '../_shared/marketplaceAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const FUNCTION_NAME = 'store-profile';
const RETURN_POLICIES = [
  'no_returns',
  'no_returns_except_wrong_item',
  'returns_within_3_days',
  'returns_within_7_days',
];
const PROFILE_FIELDS = [
  'displayName',
  'description',
  'logoUrl',
  'coverUrl',
  'operatingHours',
  'pickupEnabled',
  'deliveryEnabled',
  'minimumDeliveryOrderValueMinor',
  'returnPolicyType',
] as const;
const PROFILE_SELECT = [
  'id', 'display_name', 'description', 'logo_url', 'cover_url', 'operating_hours',
  'pickup_enabled', 'delivery_enabled', 'minimum_delivery_order_value_minor',
  'return_policy_type', 'payout_account_status',
].join(', ');

type ProfilePayload = Partial<Record<typeof PROFILE_FIELDS[number], unknown>>;
type StoreProfileAction =
  | { type: 'update_profile'; storeId: string; payload: ProfilePayload }
  | { type: 'complete_setup'; storeId: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function textOrNull(value: unknown) {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Response('Profile text fields must be strings', { status: 400 });
  return value.trim() || null;
}

function validateOperatingHours(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Response('Operating hours must be an object', { status: 400 });
  }
  const hours = value as Record<string, unknown>;
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (typeof hours.temporary_closure !== 'boolean' || days.some((day) => !(day in hours))) {
    throw new Response('Operating hours must include all days and temporary closure', { status: 400 });
  }
  for (const day of days) {
    const entry = hours[day] as { open?: unknown; close?: unknown; closed?: unknown };
    if (!entry || typeof entry !== 'object' || typeof entry.closed !== 'boolean') {
      throw new Response(`Invalid operating hours for ${day}`, { status: 400 });
    }
    if (entry.closed) {
      if (entry.open !== null || entry.close !== null) throw new Response(`Closed ${day} must use null times`, { status: 400 });
      continue;
    }
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (typeof entry.open !== 'string' || typeof entry.close !== 'string' || !time.test(entry.open) || !time.test(entry.close) || entry.open >= entry.close) {
      throw new Response(`Invalid open hours for ${day}`, { status: 400 });
    }
  }
}

function profilePatch(payload: ProfilePayload) {
  const unknown = Object.keys(payload).filter((key) => !PROFILE_FIELDS.includes(key as typeof PROFILE_FIELDS[number]));
  if (unknown.length > 0) throw new Response(`Unsupported profile fields: ${unknown.join(', ')}`, { status: 400 });
  if (Object.keys(payload).length === 0) throw new Response('No profile fields provided', { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('displayName' in payload) {
    const name = textOrNull(payload.displayName);
    if (!name) throw new Response('Display name is required', { status: 400 });
    patch.display_name = name;
  }
  if ('description' in payload) patch.description = textOrNull(payload.description);
  if ('logoUrl' in payload) patch.logo_url = textOrNull(payload.logoUrl);
  if ('coverUrl' in payload) patch.cover_url = textOrNull(payload.coverUrl);
  if ('operatingHours' in payload) {
    validateOperatingHours(payload.operatingHours);
    patch.operating_hours = payload.operatingHours;
  }
  if ('pickupEnabled' in payload) {
    if (typeof payload.pickupEnabled !== 'boolean') throw new Response('Pickup setting must be boolean', { status: 400 });
    patch.pickup_enabled = payload.pickupEnabled;
  }
  if ('deliveryEnabled' in payload) {
    if (typeof payload.deliveryEnabled !== 'boolean') throw new Response('Delivery setting must be boolean', { status: 400 });
    patch.delivery_enabled = payload.deliveryEnabled;
  }
  if ('minimumDeliveryOrderValueMinor' in payload) {
    const amount = payload.minimumDeliveryOrderValueMinor;
    if (amount !== null && (!Number.isInteger(amount) || Number(amount) < 0)) {
      throw new Response('Minimum delivery order must be a non-negative integer', { status: 400 });
    }
    patch.minimum_delivery_order_value_minor = amount;
  }
  if ('returnPolicyType' in payload) {
    if (typeof payload.returnPolicyType !== 'string' || !RETURN_POLICIES.includes(payload.returnPolicyType)) {
      throw new Response('Invalid return policy', { status: 400 });
    }
    patch.return_policy_type = payload.returnPolicyType;
  }
  return patch;
}

async function logOwnerAction(serviceClient: any, actorId: string, storeId: string, action: string) {
  const details = { function: FUNCTION_NAME };
  const writes = [
    serviceClient.from('marketplace_events').insert({
      event_type: action, entity_type: 'store', entity_id: storeId, store_id: storeId,
      actor_user_id: actorId, actor_role: 'store_owner', source: 'edge_function', payload: details,
    }),
    serviceClient.from('marketplace_audit_logs').insert({
      store_id: storeId, actor_user_id: actorId, action, entity_type: 'store', entity_id: storeId, details,
    }),
  ];
  const results = await Promise.all(writes);
  if (results.some((result) => result.error)) throw sanitizeSupabaseError('profile audit write failed');
}

async function updateProfile(serviceClient: any, actorId: string, storeId: string, payload: ProfilePayload) {
  await requireStoreAdmin(serviceClient, actorId, storeId);
  const { data: store, error: storeError } = await serviceClient.from('stores').select('status').eq('id', storeId).single();
  if (storeError) throw sanitizeSupabaseError('profile store lookup failed');
  if (!['approved_pending_setup', 'active'].includes(store.status)) {
    throw new Response('Store profile cannot be edited in its current state', { status: 403 });
  }

  const { data, error } = await serviceClient
    .from('stores').update(profilePatch(payload)).eq('id', storeId)
    .in('status', ['approved_pending_setup', 'active']).select(PROFILE_SELECT).maybeSingle();
  if (error) throw sanitizeSupabaseError('store profile update failed');
  if (!data) throw new Response('Store profile state changed; refresh and retry', { status: 409 });
  await logOwnerAction(serviceClient, actorId, storeId, 'store_profile_updated');
  return data;
}

async function completeSetup(serviceClient: any, actorId: string, storeId: string) {
  await requireStoreAdmin(serviceClient, actorId, storeId);
  const { data: store, error } = await serviceClient.from('stores').select([
    'status', 'verification_status', 'display_name', 'operating_hours', 'pickup_enabled', 'delivery_enabled',
    'return_policy_type', 'payout_account_status', 'seller_agreement_accepted_at',
    'prohibited_items_policy_accepted_at', 'support_policy_accepted_at',
  ].join(', ')).eq('id', storeId).single();
  if (error) throw sanitizeSupabaseError('setup store lookup failed');
  if (store.status !== 'approved_pending_setup' || store.verification_status !== 'approved') {
    throw new Response('Store is not eligible to complete setup', { status: 409 });
  }
  const { data: subscription, error: subscriptionError } = await serviceClient.from('store_subscriptions')
    .select('status').eq('store_id', storeId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (subscriptionError) throw sanitizeSupabaseError('setup subscription lookup failed');

  const missing = [];
  if (!store.display_name?.trim()) missing.push('profile');
  if (!store.operating_hours || Object.keys(store.operating_hours).length === 0) missing.push('hours');
  if (!store.pickup_enabled && !store.delivery_enabled) missing.push('fulfillment');
  if (!store.return_policy_type || store.return_policy_type === 'no_returns') missing.push('return_policy');
  if (!['ready', 'verified'].includes(store.payout_account_status)) missing.push('payout');
  if (!store.seller_agreement_accepted_at || !store.prohibited_items_policy_accepted_at || !store.support_policy_accepted_at) missing.push('agreements');
  if (!subscription || !['trialing', 'active', 'grace_period'].includes(subscription.status)) missing.push('subscription');
  if (missing.length > 0) throw new Response(`Setup is incomplete: ${missing.join(', ')}`, { status: 409 });

  const { data: completedStore, error: updateError } = await serviceClient.from('stores').update({
    status: 'active', setup_status: 'complete', selling_status: 'allowed', updated_at: new Date().toISOString(),
  }).eq('id', storeId).eq('status', 'approved_pending_setup').select('id').maybeSingle();
  if (updateError) throw sanitizeSupabaseError('setup completion update failed');
  if (!completedStore) throw new Response('Store setup state changed; refresh and retry', { status: 409 });
  const { error: historyError } = await serviceClient.from('store_status_history').insert({
    store_id: storeId, from_status: 'approved_pending_setup', to_status: 'active',
    reason: 'Store Owner completed required setup', changed_by: actorId,
  });
  if (historyError) throw sanitizeSupabaseError('setup status history write failed');
  await logOwnerAction(serviceClient, actorId, storeId, 'store_setup_completed');
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
    const action = await req.json() as StoreProfileAction;
    if (action.type === 'update_profile') {
      return jsonResponse({ profile: await updateProfile(serviceClient, actor.id, action.storeId, action.payload) });
    }
    if (action.type === 'complete_setup') {
      await completeSetup(serviceClient, actor.id, action.storeId);
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(`[${FUNCTION_NAME}] Unexpected error`, error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
