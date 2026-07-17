import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const expoPushUrl = 'https://exp.host/--/api/v2/push/send'

type NotificationDelivery = {
  id: string
  recipient_user_id: string
  title: string
  body: string
  deep_link: string | null
  category: string
}

type PushToken = {
  user_id: string
  token: string
}

function asLimit(value: unknown) {
  const parsed = Number(value ?? 50)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return 50
  return parsed
}

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

    const cronSecret = Deno.env.get('SEND_NOTIFICATION_CRON_SECRET')
    if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    let body: { limit?: number } = {}
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

    const { data: deliveries, error: deliveryError } = await serviceClient
      .from('notification_deliveries')
      .select('id, recipient_user_id, title, body, deep_link, category')
      .eq('channel', 'push')
      .eq('status', 'pending')
      .is('marketplace_notification_id', null)
      .order('created_at', { ascending: true })
      .limit(asLimit(body.limit))

    if (deliveryError) {
      console.error('[send-notification] Failed to fetch deliveries:', deliveryError.message)
      return jsonResponse({ error: deliveryError.message }, 400)
    }

    const pendingDeliveries = (deliveries ?? []) as NotificationDelivery[]
    if (pendingDeliveries.length === 0) {
      return jsonResponse({ processed: 0, sent: 0, failed: 0 })
    }

    const deliveryIds = pendingDeliveries.map((delivery) => delivery.id)
    const { error: queueError } = await serviceClient
      .from('notification_deliveries')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .in('id', deliveryIds)

    if (queueError) {
      console.error('[send-notification] Failed to queue deliveries:', queueError.message)
      return jsonResponse({ error: queueError.message }, 400)
    }

    const recipientIds = [...new Set(pendingDeliveries.map((delivery) => delivery.recipient_user_id))]
    const { data: tokens, error: tokenError } = await serviceClient
      .from('user_push_tokens')
      .select('user_id, token')
      .in('user_id', recipientIds)
      .is('revoked_at', null)
      .eq('provider', 'expo')

    if (tokenError) {
      console.error('[send-notification] Failed to fetch push tokens:', tokenError.message)
      return jsonResponse({ error: tokenError.message }, 400)
    }

    const tokensByUserId = new Map<string, string[]>()
    for (const token of (tokens ?? []) as PushToken[]) {
      const userTokens = tokensByUserId.get(token.user_id) ?? []
      userTokens.push(token.token)
      tokensByUserId.set(token.user_id, userTokens)
    }

    let sent = 0
    let failed = 0

    for (const delivery of pendingDeliveries) {
      const recipientTokens = tokensByUserId.get(delivery.recipient_user_id) ?? []
      if (recipientTokens.length === 0) {
        failed += 1
        await serviceClient
          .from('notification_deliveries')
          .update({
            status: 'failed',
            error_code: 'missing_push_token',
            error_message: 'No active Expo push token found for recipient.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.id)
        continue
      }

      try {
        const response = await fetch(expoPushUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recipientTokens.map((token) => ({
            to: token,
            title: delivery.title,
            body: delivery.body,
            data: {
              delivery_id: delivery.id,
              category: delivery.category,
              deep_link: delivery.deep_link,
            },
          }))),
        })

        const result = await response.json().catch(() => ({}))
        const results = Array.isArray(result?.data) ? result.data : [result?.data]
        const hasProviderError = results.some((item) => item?.status === 'error')

        if (!response.ok || hasProviderError) {
          const details =
            results.find((item) => item?.status === 'error')?.details?.error ??
            result?.errors?.[0]?.message ??
            'expo_push_error'
          failed += 1
          await serviceClient
            .from('notification_deliveries')
            .update({
              status: 'failed',
              error_code: String(details),
              error_message: JSON.stringify(result).slice(0, 500),
              updated_at: new Date().toISOString(),
            })
            .eq('id', delivery.id)
          continue
        }

        sent += 1
        await serviceClient
          .from('notification_deliveries')
          .update({
            status: 'sent',
            provider_message_id: results.find((item) => item?.id)?.id ?? null,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.id)
      } catch (err) {
        failed += 1
        const message = err instanceof Error ? err.message : 'Unexpected push delivery failure.'
        await serviceClient
          .from('notification_deliveries')
          .update({
            status: 'failed',
            error_code: 'network_error',
            error_message: message.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.id)
      }
    }

    return jsonResponse({ processed: pendingDeliveries.length, sent, failed })
  } catch (err) {
    console.error('[send-notification] Unexpected error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
