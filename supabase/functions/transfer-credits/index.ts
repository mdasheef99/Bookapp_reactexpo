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
    let body: {
      from_user_id?: string
      to_user_id?: string
      amount?: number
      reason?: string
      admin_id?: string
    }
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { from_user_id, to_user_id, amount, reason, admin_id } = body

    if (!from_user_id || !to_user_id || !amount || !reason || !admin_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: from_user_id, to_user_id, amount, reason, admin_id',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (
      !uuidRegex.test(from_user_id) ||
      !uuidRegex.test(to_user_id) ||
      !uuidRegex.test(admin_id)
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid UUID format for from_user_id, to_user_id, or admin_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'amount must be a positive integer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (from_user_id === to_user_id) {
      return new Response(
        JSON.stringify({ error: 'from_user_id and to_user_id must be different' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Admin authentication: caller must match admin_id and be authenticated ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // admin_id must match the authenticated caller (prevents spoofed admin_id in audit log)
    if (user.id !== admin_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin_id must match authenticated user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Call the SECURITY DEFINER DB function via service role ---
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    console.log(
      `[transfer-credits] admin=${admin_id} transferring ${amount} credit(s) ` +
      `from=${from_user_id} to=${to_user_id} reason="${reason}"`
    )

    const { data, error } = await serviceClient.rpc('transfer_credits', {
      p_from_user_id: from_user_id,
      p_to_user_id: to_user_id,
      p_amount: amount,
      p_reason: reason,
      p_admin_id: admin_id,
    })

    if (error) {
      console.error('[transfer-credits] RPC error:', error.message)
      const isNotFound = error.message.includes('not found')
      const isInsufficient = error.message.includes('Insufficient credits')
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: isNotFound ? 404 : isInsufficient ? 422 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`[transfer-credits] Transfer completed successfully:`, JSON.stringify(data))
    return new Response(
      JSON.stringify({ success: true, ...data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[transfer-credits] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

