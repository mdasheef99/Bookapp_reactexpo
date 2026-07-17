import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Task = {
  id: string; entity_id: string; task_type: string; source_request_version: number;
};
const COMMANDS: Record<string, string> = {
  confirmation_reminder: 'send_confirmation_reminder',
  confirmation_expiry: 'expire_confirmation',
  clarification_expiry: 'expire_clarification',
  customer_decision_expiry: 'expire_customer_decision',
  payment_ready_expiry: 'expire_payment_ready',
  emergency_pause_expiry: 'expire_emergency_closure_pause',
  store_ineligibility_review: 'cancel_for_store_ineligibility',
};
const response = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } },
);
const expoPushUrl = 'https://exp.host/--/api/v2/push/send';

serve(async (request) => {
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey || request.headers.get('authorization') !== `Bearer ${serviceKey}`) {
    return response({ error: 'forbidden' }, 403);
  }
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) return response({ error: 'configuration_missing' }, 500);
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  const body = await request.json() as { schedulerRunId: string; leaseOwner: string; tasks: Task[] };
  if (!Array.isArray(body.tasks) || body.tasks.length > 50) return response({ error: 'invalid_batch' }, 400);

  const execute = async (task: Task) => {
    const commandIdentity = { idempotencyKey: `phase6-task:${task.id}`, commandId: task.id };
    let outcome = 'resolved'; let retryable = false; let errorCategory: string | null = null;
    try {
      if (task.task_type === 'notification_delivery') {
        const claimed = await client.rpc('claim_phase6_notification_delivery', {
          p_delivery_id: task.entity_id, p_lease_owner: body.leaseOwner,
        });
        if (claimed.error) throw claimed.error;
        const delivery = claimed.data as {
          recipient_user_id: string; channel: string; title: string; body: string;
          deep_link: string | null;
        };
        let deliverySucceeded = false; let deliveryRetryable = false;
        let deliveryError: string | null = null; let providerReference: string | null = null;
        if (delivery.channel !== 'push') {
          deliveryError = 'transport_not_configured';
        } else {
          const tokens = await client.from('user_push_tokens').select('token')
            .eq('user_id', delivery.recipient_user_id).eq('provider', 'expo').is('revoked_at', null);
          if (tokens.error) {
            deliveryError = 'token_lookup_failed'; deliveryRetryable = true;
          } else if (!tokens.data?.length) {
            deliveryError = 'missing_push_token';
          } else {
            try {
              const push = await fetch(expoPushUrl, {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify(tokens.data.map(({ token }) => ({
                  to: token, title: delivery.title, body: delivery.body,
                  data: { notificationId: task.entity_id, route: delivery.deep_link },
                }))),
              });
              const provider = await push.json().catch(() => ({}));
              deliverySucceeded = push.ok;
              deliveryRetryable = !push.ok && push.status >= 500;
              deliveryError = push.ok ? null : 'push_provider_rejected';
              providerReference = Array.isArray(provider?.data) ? provider.data[0]?.id ?? null : null;
            } catch {
              deliveryError = 'push_network_failure'; deliveryRetryable = true;
            }
          }
        }
        await client.rpc('record_phase6_delivery_result', {
          p_delivery_id: task.entity_id, p_lease_owner: body.leaseOwner,
          p_succeeded: deliverySucceeded, p_retryable: deliveryRetryable,
          p_error_category: deliveryError, p_provider_reference: providerReference,
        });
        if (!deliverySucceeded) {
          const deliveryFailure = new Error(deliveryError ?? 'transport_failure') as Error & { retryable?: boolean };
          deliveryFailure.retryable = deliveryRetryable;
          throw deliveryFailure;
        }
      } else {
        const command = COMMANDS[task.task_type];
        if (!command) throw new Error('unsupported_task_type');
        const result = await client.rpc(command, {
          p_request_id: task.entity_id,
              p_expected_version: task.source_request_version,
              p_idempotency_key: commandIdentity.idempotencyKey,
              p_command_id: commandIdentity.commandId,
        });
        if (result.error) throw result.error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/STALE_VERSION|INVALID_STATE_TRANSITION|COMMERCE_ENTITY_UNAVAILABLE/.test(message)) {
        outcome = 'resolved_noop';
      } else {
        outcome = 'failed'; retryable = typeof error === 'object' && error !== null && 'retryable' in error
          ? Boolean((error as { retryable?: boolean }).retryable)
          : !/unsupported_task_type|AUTHENTICATION_REQUIRED/.test(message);
        errorCategory = retryable ? 'retryable_execution' : 'permanent_execution';
      }
    }
    await client.rpc('complete_phase6_task', {
      p_task_id: task.id, p_lease_owner: body.leaseOwner, p_outcome: outcome,
      p_retryable: retryable, p_error_category: errorCategory,
      p_correlation_id: body.schedulerRunId,
    });
    return { taskId: task.id, outcome };
  };

  const results: Array<{ taskId: string; outcome: string }> = [];
  for (let offset = 0; offset < body.tasks.length; offset += 10) {
    results.push(...await Promise.all(body.tasks.slice(offset, offset + 10).map(execute)));
  }
  return response({ schedulerRunId: body.schedulerRunId, results });
});
