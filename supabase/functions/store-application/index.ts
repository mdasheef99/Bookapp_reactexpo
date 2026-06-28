import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuthenticatedUser, requireStoreAdmin, sanitizeSupabaseError } from '../_shared/marketplaceAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const STORE_APPLICATION_FUNCTION = 'store-application';
const PRIVILEGED_STORE_FIELDS = [
  'status',
  'verification_status',
  'setup_status',
  'selling_status',
  'approved_at',
  'suspended_at',
  'reviewed_by',
  'reviewed_at',
];

type StoreApplicationDraftInput = {
  ownerFullName: string;
  ownerEmail?: string | null;
  supportContactChannel: 'phone' | 'email' | 'whatsapp';
  displayName: string;
  legalName?: string | null;
  legalSellerName: string;
  storeType: string;
  description?: string | null;
  city: string;
  state: string;
  pincode: string;
  localityId?: string | null;
  publicAddressMode: 'hidden' | 'locality_only' | 'full';
  sellerAgreementVersion: string;
  sellerAgreementAccepted: boolean;
  prohibitedItemsPolicyAccepted: boolean;
  supportPolicyAccepted: boolean;
  panStatus: 'not_collected' | 'provided' | 'not_applicable';
  gstin?: string | null;
  applicantNotes?: string | null;
};

type StoreApplicationAction =
  | { type: 'start_or_resume' }
  | { type: 'save_draft'; storeId: string; requestId: string; payload: StoreApplicationDraftInput }
  | { type: 'submit'; storeId: string; requestId: string; payload: StoreApplicationDraftInput }
  | { type: 'record_document'; payload: { storeId: string; requestId: string; documentType: string; storagePath: string; maskedLabel?: string } };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requestPatch(payload: StoreApplicationDraftInput) {
  return {
    applicant_notes: payload.applicantNotes ?? null,
    application_metadata: {
      ownerFullName: payload.ownerFullName.trim(),
      ownerEmail: payload.ownerEmail?.trim() || null,
      supportContactChannel: payload.supportContactChannel,
      panStatus: payload.panStatus,
      gstin: payload.gstin?.trim() || null,
      storeType: payload.storeType,
    },
    updated_at: new Date().toISOString(),
  };
}

function mapStoreType(value: string) {
  if (value === 'independent_bookstore') return 'independent';
  if (value === 'second_hand_bookstore') return 'second_hand';
  if (value === 'publisher_store') return 'publisher';
  if (value === 'library_store') return 'library';
  return value;
}

function assertNoPrivilegedFields(payload: Record<string, unknown>) {
  const blocked = PRIVILEGED_STORE_FIELDS.filter((field) => field in payload);
  if (blocked.length > 0) {
    throw new Response(`Privileged fields are not accepted: ${blocked.join(', ')}`, { status: 400 });
  }
}

function validateDraft(payload: StoreApplicationDraftInput, requirePolicies: boolean) {
  const required = ['ownerFullName', 'displayName', 'legalSellerName', 'city', 'state', 'pincode', 'sellerAgreementVersion'] as const;
  const missing = required.filter((field) => !String(payload[field] ?? '').trim());
  if (missing.length > 0) throw new Response(`Missing required fields: ${missing.join(', ')}`, { status: 400 });

  if (requirePolicies && (!payload.sellerAgreementAccepted || !payload.prohibitedItemsPolicyAccepted || !payload.supportPolicyAccepted)) {
    throw new Response('Seller agreement, prohibited-items policy, and support policy must be accepted', { status: 400 });
  }
}

function storePatch(payload: StoreApplicationDraftInput, submitting: boolean) {
  const nowPatch = submitting ? {
    status: 'pending_verification',
    verification_status: 'pending',
    seller_agreement_accepted_at: new Date().toISOString(),
    prohibited_items_policy_accepted_at: new Date().toISOString(),
    support_policy_accepted_at: new Date().toISOString(),
  } : {};

  return {
    display_name: payload.displayName.trim(),
    legal_name: payload.legalName?.trim() || null,
    legal_seller_name: payload.legalSellerName.trim(),
    store_type: mapStoreType(payload.storeType),
    description: payload.description?.trim() || null,
    city: payload.city.trim(),
    state: payload.state.trim(),
    pincode: payload.pincode.trim(),
    locality_id: payload.localityId || null,
    public_address_mode: payload.publicAddressMode,
    seller_agreement_version: payload.sellerAgreementVersion,
    updated_at: new Date().toISOString(),
    ...nowPatch,
  };
}

async function latestRequest(serviceClient: any, storeId: string) {
  const { data, error } = await serviceClient
    .from('store_verification_requests')
    .select('id, status')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw sanitizeSupabaseError('latest verification request lookup failed');
  return data;
}

async function validateLocality(serviceClient: any, localityId?: string | null) {
  if (!localityId) return;

  const { data, error } = await serviceClient
    .from('marketplace_localities')
    .select('id')
    .eq('id', localityId)
    .eq('is_pilot_enabled', true)
    .maybeSingle();

  if (error) throw sanitizeSupabaseError('locality lookup failed');
  if (!data) throw new Response('Selected locality is not available for the pilot', { status: 400 });
}

async function logEvent(serviceClient: any, eventType: string, storeId: string, actorId: string, entityId?: string) {
  await serviceClient.from('marketplace_events').insert({
    event_type: eventType,
    entity_type: 'store',
    entity_id: entityId ?? storeId,
    store_id: storeId,
    actor_user_id: actorId,
    actor_role: 'store_owner',
    source: 'edge_function',
    payload: { function: STORE_APPLICATION_FUNCTION },
  });
  await serviceClient.from('marketplace_audit_logs').insert({
    store_id: storeId,
    actor_user_id: actorId,
    action: eventType,
    entity_type: 'store',
    entity_id: entityId ?? storeId,
    details: { function: STORE_APPLICATION_FUNCTION },
  });
}

async function startOrResume(serviceClient: any, actorId: string) {
  const { data: existing, error: existingError } = await serviceClient
    .from('store_administrators')
    .select('store_id, stores(id, display_name, status, setup_status)')
    .eq('user_id', actorId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (existingError) throw sanitizeSupabaseError('existing owner lookup failed');
  if (existing?.store_id) {
    const request = await latestRequest(serviceClient, existing.store_id);
    return { storeId: existing.store_id, requestId: request?.id ?? null };
  }

  const { data: store, error: storeError } = await serviceClient
    .from('stores')
    .insert({
      display_name: 'Draft bookstore',
      status: 'draft',
      verification_status: 'unverified',
      setup_status: 'incomplete',
      selling_status: 'not_allowed',
    })
    .select('id')
    .single();
  if (storeError) throw sanitizeSupabaseError('draft store creation failed');

  const storeId = store.id;
  const { error: adminError } = await serviceClient.from('store_administrators').insert({
    store_id: storeId,
    user_id: actorId,
    role: 'owner',
    status: 'active',
    assigned_by: actorId,
  });
  if (adminError) throw sanitizeSupabaseError('store administrator creation failed');

  const { data: request, error: requestError } = await serviceClient
    .from('store_verification_requests')
    .insert({ store_id: storeId, status: 'draft', application_metadata: {} })
    .select('id')
    .single();
  if (requestError) throw sanitizeSupabaseError('verification request creation failed');

  await logEvent(serviceClient, 'store_application_started', storeId, actorId, request.id);
  return { storeId, requestId: request.id };
}

async function saveDraft(serviceClient: any, actorId: string, storeId: string, requestId: string, payload: StoreApplicationDraftInput) {
  assertNoPrivilegedFields(payload as Record<string, unknown>);
  validateDraft(payload, false);
  await requireStoreAdmin(serviceClient, actorId, storeId);
  await validateLocality(serviceClient, payload.localityId);

  const { error: storeError } = await serviceClient.from('stores').update(storePatch(payload, false)).eq('id', storeId);
  if (storeError) throw sanitizeSupabaseError('store draft update failed');

  const { error: requestError } = await serviceClient
    .from('store_verification_requests')
    .update(requestPatch(payload))
    .eq('id', requestId)
    .eq('store_id', storeId);
  if (requestError) throw sanitizeSupabaseError('verification draft update failed');

  await logEvent(serviceClient, 'store_application_saved', storeId, actorId, requestId);
}

async function submit(serviceClient: any, actorId: string, storeId: string, requestId: string, payload: StoreApplicationDraftInput) {
  assertNoPrivilegedFields(payload as Record<string, unknown>);
  validateDraft(payload, true);
  await requireStoreAdmin(serviceClient, actorId, storeId);
  await validateLocality(serviceClient, payload.localityId);

  const { error: storeError } = await serviceClient.from('stores').update(storePatch(payload, true)).eq('id', storeId);
  if (storeError) throw sanitizeSupabaseError('store submit update failed');

  const { error: requestError } = await serviceClient
    .from('store_verification_requests')
    .update({
      ...requestPatch(payload),
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('store_id', storeId);
  if (requestError) throw sanitizeSupabaseError('verification submit update failed');

  await logEvent(serviceClient, 'store_application_submitted', storeId, actorId, requestId);
}

async function recordDocument(serviceClient: any, actorId: string, input: StoreApplicationAction & { type: 'record_document' }) {
  const { storeId, requestId, documentType, storagePath, maskedLabel } = input.payload;
  await requireStoreAdmin(serviceClient, actorId, storeId);
  if (!storagePath.startsWith(`${storeId}/`)) {
    throw new Response('Document path must be scoped to the caller store', { status: 400 });
  }

  const { error } = await serviceClient.from('store_verification_documents').insert({
    store_id: storeId,
    request_id: requestId,
    document_type: documentType,
    storage_path: storagePath,
    masked_label: maskedLabel ?? null,
    uploaded_by: actorId,
  });
  if (error) throw sanitizeSupabaseError('verification document insert failed');

  await logEvent(serviceClient, 'store_verification_document_recorded', storeId, actorId, requestId);
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
    const action = await req.json() as StoreApplicationAction;

    if (action.type === 'start_or_resume') {
      return jsonResponse(await startOrResume(serviceClient, actor.id));
    }
    if (action.type === 'save_draft') {
      await saveDraft(serviceClient, actor.id, action.storeId, action.requestId, action.payload);
      return jsonResponse({ ok: true });
    }
    if (action.type === 'submit') {
      await submit(serviceClient, actor.id, action.storeId, action.requestId, action.payload);
      return jsonResponse({ ok: true });
    }
    if (action.type === 'record_document') {
      await recordDocument(serviceClient, actor.id, action);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(`[${STORE_APPLICATION_FUNCTION}] Unexpected error`, error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
