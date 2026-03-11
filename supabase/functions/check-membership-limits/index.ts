import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const MAX_CLUBS_BY_TIER = { free: 0, pro: 5, pro_plus: 15 } as const
type MembershipTier = keyof typeof MAX_CLUBS_BY_TIER
type MembershipLimitAction = 'create_club' | 'check_downgrade'

function isMembershipTier(value: string | null | undefined): value is MembershipTier {
  return value === 'free' || value === 'pro' || value === 'pro_plus'
}

function isAction(value: string | null | undefined): value is MembershipLimitAction {
  return value === 'create_club' || value === 'check_downgrade'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const missingEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter((key) => !Deno.env.get(key))
    if (missingEnv.length > 0) {
      return new Response(JSON.stringify({ error: `Missing required env vars: ${missingEnv.join(', ')}` }), { status: 500, headers: jsonHeaders })
    }

    let body: { user_id?: string; action?: MembershipLimitAction }
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: jsonHeaders })
    }

    const { user_id, action = 'create_club' } = body
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!user_id || !uuidRegex.test(user_id)) {
      return new Response(JSON.stringify({ error: 'Valid user_id is required' }), { status: 400, headers: jsonHeaders })
    }
    if (!isAction(action)) {
      return new Response(JSON.stringify({ error: 'action must be create_club or check_downgrade' }), { status: 400, headers: jsonHeaders })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: jsonHeaders })
    }

    const anonClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await anonClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid or expired token' }), { status: 401, headers: jsonHeaders })
    }
    if (user.id !== user_id) {
      return new Response(JSON.stringify({ error: 'Forbidden: user_id must match authenticated user' }), { status: 403, headers: jsonHeaders })
    }

    const serviceClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })
    const { data: profile, error: profileError } = await serviceClient.from('user_profiles').select('membership_tier').eq('user_id', user_id).maybeSingle()
    if (profileError) {
      console.error('[check-membership-limits] Failed to fetch membership tier:', profileError.message)
      return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: jsonHeaders })
    }

    const tier: MembershipTier = isMembershipTier(profile?.membership_tier) ? profile.membership_tier : 'free'
    const { count, error: countError } = await serviceClient.from('book_clubs').select('*', { count: 'exact', head: true }).eq('admin_id', user_id).or('is_archived.is.false,is_archived.is.null')
    if (countError) {
      console.error('[check-membership-limits] Failed to count active clubs:', countError.message)
      return new Response(JSON.stringify({ error: countError.message }), { status: 400, headers: jsonHeaders })
    }

    const currentCount = count ?? 0
    const maxAllowed = MAX_CLUBS_BY_TIER[tier]
    const allowed = action === 'check_downgrade' ? currentCount <= maxAllowed : currentCount < maxAllowed
    const reason = allowed ? null : action === 'check_downgrade'
      ? `Membership tier ${tier} allows ${maxAllowed} active club(s), but user currently has ${currentCount}.`
      : maxAllowed === 0
        ? 'Free members cannot create clubs. Upgrade to Pro to create a club.'
        : `Membership tier ${tier} already reached its ${maxAllowed}-club limit.`

    return new Response(JSON.stringify({ allowed, current_count: currentCount, max_allowed: maxAllowed, tier, reason }), { status: 200, headers: jsonHeaders })
  } catch (err) {
    console.error('[check-membership-limits] Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: jsonHeaders })
  }
})