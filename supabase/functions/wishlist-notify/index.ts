import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const missingEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((key) => !Deno.env.get(key))
    if (missingEnv.length > 0) {
      return jsonResponse({ error: `Missing required env vars: ${missingEnv.join(', ')}` }, 500)
    }

    const cronSecret = Deno.env.get('WISHLIST_NOTIFY_CRON_SECRET')
    if (!cronSecret) {
      return jsonResponse({ error: 'Wishlist notify cron secret is not configured.' }, 500)
    }
    if (req.headers.get('x-cron-secret') !== cronSecret) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    let body: { listingId?: string | null } = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    )

    const { data, error } = await serviceClient.rpc('notify_wishlist_matches', {
      p_listing_id: body.listingId ?? null,
    })

    if (error) {
      console.error('[wishlist-notify] Failed to notify wishlist matches:', error.message)
      return jsonResponse({ error: error.message }, 400)
    }

    const result = Array.isArray(data) ? data[0] : data
    return jsonResponse({
      processedListings: result?.processed_listings ?? 0,
      createdDeliveries: result?.created_deliveries ?? 0,
    })
  } catch (err) {
    console.error('[wishlist-notify] Unexpected error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
