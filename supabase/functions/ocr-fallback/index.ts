import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { createOcrHandler } from './handler.ts';

// Cloud remains fail-closed until a separately reviewed durable quota adapter is
// provisioned. No environment flag can bypass that missing dependency.
Deno.serve(createOcrHandler({
 fetch,
 visionKey: Deno.env.get('GOOGLE_VISION_API_KEY'),
 authenticate: async (jwt, signal) => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) return null;
  try {
   const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal }) },
   });
   const { data, error } = await client.auth.getUser(jwt);
   return error ? null : data.user?.id ?? null;
  } catch { return null; }
 },
}));
