import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- Parse and validate input ---
    let body: { transaction_id?: string; actor_id?: string }
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { transaction_id, actor_id } = body

    if (!transaction_id || !actor_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: transaction_id, actor_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(transaction_id) || !uuidRegex.test(actor_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid UUID format for transaction_id or actor_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Authenticate caller via JWT ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the JWT and get the authenticated user
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await anonClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // actor_id must match the authenticated user (prevents spoofing)
    if (user.id !== actor_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: actor_id must match authenticated user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Call the SECURITY DEFINER DB function via service role ---
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    console.log(`[complete-transaction] actor=${actor_id} completing transaction=${transaction_id}`)

    const { data, error } = await serviceClient.rpc('complete_transaction', {
      p_transaction_id: transaction_id,
      p_actor_id: actor_id,
    })

    if (error) {
      console.error('[complete-transaction] RPC error:', error.message)
      // Map known DB exceptions to HTTP status codes
      const isNotFound = error.message.includes('not found')
      const isForbidden = error.message.includes('not a participant')
      const isConflict = error.message.includes('Cannot complete transaction in status')
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: isNotFound ? 404 : isForbidden ? 403 : isConflict ? 409 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`[complete-transaction] Transaction ${transaction_id} completed successfully`)
    return new Response(
      JSON.stringify({ success: true, transaction: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[complete-transaction] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

