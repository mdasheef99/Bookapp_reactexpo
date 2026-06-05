import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

function asBoolean(value: unknown) {
  return value === true || value === 'true'
}

function asGraceDays(value: unknown) {
  const parsed = Number(value ?? 14)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 90) return 14
  return parsed
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders })

  try {
    const missingEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((key) => !Deno.env.get(key))
    if (missingEnv.length > 0) {
      return new Response(JSON.stringify({ error: `Missing required env vars: ${missingEnv.join(', ')}` }), { status: 500, headers: jsonHeaders })
    }

    const cronSecret = Deno.env.get('CLUB_DOWNGRADE_CRON_SECRET')
    if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: jsonHeaders })
    }

    let body: { user_id?: string | null; grace_days?: number; dry_run?: boolean | string } = {}
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

    const { data, error } = await serviceClient.rpc('process_club_downgrade_grace_period', {
      p_user_id: body.user_id ?? null,
      p_grace_days: asGraceDays(body.grace_days),
      p_dry_run: asBoolean(body.dry_run),
    })

    if (error) {
      console.error('[handle-club-downgrade-grace-period] RPC failed:', error.message)
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders })
    }

    return new Response(JSON.stringify({ processed: data?.length ?? 0, results: data ?? [] }), { status: 200, headers: jsonHeaders })
  } catch (err) {
    console.error('[handle-club-downgrade-grace-period] Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: jsonHeaders })
  }
})
