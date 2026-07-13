const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SUPABASE_URL = 'https://ahntbtktjjmvfosgkmgn.supabase.co';

function requiredEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function optionalEnv(name) {
  return process.env[name] || null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function invokeStoreApplication(supabase, body) {
  const { data, error } = await supabase.functions.invoke('store-application', { body });
  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }
  return data;
}

function draftPayload(localityId) {
  return {
    ownerFullName: 'Phase 2B Smoke Tester',
    ownerEmail: process.env.PHASE2B_TEST_USER_EMAIL,
    supportContactChannel: 'email',
    displayName: `Smoke Test Books ${Date.now()}`,
    legalName: 'Smoke Test Books',
    legalSellerName: 'Smoke Test Books',
    storeType: 'independent_bookstore',
    description: 'Phase 2B live smoke test application',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    localityId,
    publicAddressMode: 'locality_only',
    sellerAgreementVersion: 'seller-agreement-v2026-06-27',
    sellerAgreementAccepted: true,
    prohibitedItemsPolicyAccepted: true,
    supportPolicyAccepted: true,
    panStatus: 'not_collected',
    gstin: null,
    applicantNotes: 'Created by smoke:phase2b:store-application',
  };
}

async function verifySubmittedRequest(supabase, storeId, requestId) {
  const { data, error } = await supabase
    .from('store_verification_requests')
    .select('id, store_id, status, application_metadata')
    .eq('id', requestId)
    .eq('store_id', storeId)
    .maybeSingle();

  if (error) throw error;
  assert(data, 'Submitted verification request was not readable by the test user');
  assert(data.status === 'submitted', `Expected submitted request, got ${data.status}`);
  assert(data.application_metadata?.ownerFullName === 'Phase 2B Smoke Tester', 'application_metadata.ownerFullName was not persisted');
}

async function expectCrossTenantDenied(supabase, crossTenantStoreId, requestId, payload) {
  if (!crossTenantStoreId) {
    console.log('SKIP cross-tenant denial: PHASE2B_CROSS_TENANT_STORE_ID is not set');
    return;
  }

  const { error } = await supabase.functions.invoke('store-application', {
    body: {
      type: 'save_draft',
      storeId: crossTenantStoreId,
      requestId,
      payload,
    },
  });

  assert(error, 'Expected cross-tenant save_draft to be denied');
  console.log('PASS cross-tenant denial returned an error');
}

async function expectPilotLocalityDenied(supabase, storeId, requestId, payload, blockedLocalityId) {
  if (!blockedLocalityId) {
    console.log('SKIP pilot locality denial: PHASE2B_BLOCKED_LOCALITY_ID is not set');
    return;
  }

  const { error } = await supabase.functions.invoke('store-application', {
    body: {
      type: 'save_draft',
      storeId,
      requestId,
      payload: { ...payload, localityId: blockedLocalityId },
    },
  });

  assert(error, 'Expected blocked locality save_draft to be denied');
  console.log('PASS pilot locality denial returned an error');
}

async function main() {
  const supabaseUrl = requiredEnv('EXPO_PUBLIC_SUPABASE_URL', DEFAULT_SUPABASE_URL);
  const anonKey = requiredEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const email = requiredEnv('PHASE2B_TEST_USER_EMAIL');
  const password = requiredEnv('PHASE2B_TEST_USER_PASSWORD');
  const pilotLocalityId = optionalEnv('PHASE2B_PILOT_LOCALITY_ID');
  const blockedLocalityId = optionalEnv('PHASE2B_BLOCKED_LOCALITY_ID');
  const crossTenantStoreId = optionalEnv('PHASE2B_CROSS_TENANT_STORE_ID');

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  assert(authData.session?.access_token, 'No access token returned for test user');
  console.log('PASS signed in test user');

  const started = await invokeStoreApplication(supabase, { type: 'start_or_resume' });
  assert(started?.storeId, 'start_or_resume did not return storeId');
  assert(started?.requestId, 'start_or_resume did not return requestId');
  console.log(`PASS start_or_resume storeId=${started.storeId} requestId=${started.requestId}`);

  const payload = draftPayload(pilotLocalityId);
  await invokeStoreApplication(supabase, {
    type: 'save_draft',
    storeId: started.storeId,
    requestId: started.requestId,
    payload,
  });
  console.log('PASS save_draft');

  await expectPilotLocalityDenied(supabase, started.storeId, started.requestId, payload, blockedLocalityId);
  await expectCrossTenantDenied(supabase, crossTenantStoreId, started.requestId, payload);

  await invokeStoreApplication(supabase, {
    type: 'record_document',
    payload: {
      storeId: started.storeId,
      requestId: started.requestId,
      documentType: 'storefront_photo',
      storagePath: `${started.storeId}/${started.requestId}/storefront_photo/smoke-placeholder.txt`,
      maskedLabel: 'smoke-placeholder.txt',
    },
  });
  console.log('PASS record_document metadata');

  await invokeStoreApplication(supabase, {
    type: 'submit',
    storeId: started.storeId,
    requestId: started.requestId,
    payload,
  });
  console.log('PASS submit');

  await verifySubmittedRequest(supabase, started.storeId, started.requestId);
  console.log('PASS submitted request metadata verified');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
