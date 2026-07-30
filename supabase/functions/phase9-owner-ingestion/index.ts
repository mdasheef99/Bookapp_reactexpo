import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuthenticatedUser } from '../_shared/marketplaceAuth.ts';
import { parseOwnerIngestionRequest } from '../_shared/imageInventory/contracts/ingestion.ts';
import {
  OWNER_UX_HTTP_HEADERS,
  ownerUxFailureResponse,
  ownerUxJsonResponse,
} from '../_shared/imageInventory/contracts/ownerUxHttp.ts';
import { executeOwnerIngestion } from '../_shared/imageInventory/runtime/ownerIngestion.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: OWNER_UX_HTTP_HEADERS });
  if (request.method !== 'POST') return ownerUxJsonResponse({ error: 'method_not_allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!url || !anonKey || !serviceKey) {
      return ownerUxFailureResponse(new Error('P9_INTERNAL_ERROR'));
    }
    const actor = await requireAuthenticatedUser(request, url, anonKey);
    const authorization = request.headers.get('authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
    const body = parseOwnerIngestionRequest(await request.json());
    return ownerUxJsonResponse(
      await executeOwnerIngestion(body, actor.id, userClient as any, serviceClient as any),
    );
  } catch (error) {
    return ownerUxFailureResponse(error);
  }
});
