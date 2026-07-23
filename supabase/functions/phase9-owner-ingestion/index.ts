import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuthenticatedUser } from '../_shared/marketplaceAuth.ts';
import { parseOwnerIngestionRequest } from '../_shared/imageInventory/contracts/ingestion.ts';
import { executeOwnerIngestion } from '../_shared/imageInventory/runtime/ownerIngestion.ts';

const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'cache-control': 'no-store', pragma: 'no-cache' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!url || !anonKey || !serviceKey) return response({ error: 'configuration_missing' }, 500);
    const actor = await requireAuthenticatedUser(request, url, anonKey);
    const authorization = request.headers.get('authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
    const body = parseOwnerIngestionRequest(await request.json());
    return response(await executeOwnerIngestion(body, actor.id, userClient as any, serviceClient as any));
  } catch (error) {
    const code = error instanceof Error && /^P9_[A-Z_]+$/u.test(error.message) ? error.message : 'P9_REQUEST_INVALID';
    const status = code === 'P9_OWNER_NOT_AUTHORIZED' ? 403 : code === 'P9_INTERNAL_ERROR' ? 500 : 400;
    return response({ error: code }, status);
  }
});
