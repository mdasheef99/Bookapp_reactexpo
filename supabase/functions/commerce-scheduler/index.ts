import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_BATCH_SIZE = 50;
const MAXIMUM_FANOUT = 4;
const WORKER_TIMEOUT_MS = 240_000;

const response = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } },
);

serve(async (request) => {
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  const schedulerSecret = Deno.env.get('COMMERCE_SCHEDULER_SECRET');
  const authorization = request.headers.get('authorization');
  if (!schedulerSecret || authorization !== `Bearer ${schedulerSecret}`) {
    return response({ error: 'forbidden' }, 403);
  }
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return response({ error: 'configuration_missing' }, 500);
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  const schedulerRunId = crypto.randomUUID();
  const { data: acquired, error: leaseError } = await client.rpc('acquire_phase6_scheduler_lease', {
    p_run_id: schedulerRunId,
  });
  if (leaseError) return response({ error: 'lease_failed', schedulerRunId }, 500);
  if (!acquired) return response({ schedulerRunId, status: 'overlap_skipped' });
  const { data: tasks, error: claimError } = await client.rpc('claim_phase6_tasks', {
    p_lease_owner: schedulerRunId,
    p_batch_size: DEFAULT_BATCH_SIZE,
  });
  if (claimError) {
    await client.rpc('finish_phase6_scheduler_run', {
      p_run_id: schedulerRunId, p_status: 'failed', p_claimed: 0,
      p_workers: 0, p_error: 'claim_failed',
    });
    return response({ error: 'claim_failed', schedulerRunId }, 500);
  }
  const claimed = tasks ?? [];
  const groups = Array.from({ length: Math.min(MAXIMUM_FANOUT, Math.ceil(claimed.length / 13)) },
    (_, index) => claimed.slice(index * 13, (index + 1) * 13));
  const dispatched = await Promise.all(groups.map((batch) => Promise.race([
    client.functions.invoke('commerce-task-worker', {
      body: { schedulerRunId, leaseOwner: schedulerRunId, tasks: batch },
      headers: { Authorization: `Bearer ${serviceKey}` },
    }),
    new Promise<{ error: Error }>((resolve) => setTimeout(
      () => resolve({ error: new Error('worker_timeout') }), WORKER_TIMEOUT_MS,
    )),
  ])));
  const dispatchFailed = dispatched.some((result) => Boolean(result.error));
  await client.rpc('finish_phase6_scheduler_run', {
    p_run_id: schedulerRunId, p_status: dispatchFailed ? 'failed' : 'succeeded',
    p_claimed: claimed.length, p_workers: groups.length,
    p_error: dispatchFailed ? 'worker_dispatch_failed' : null,
  });
  return response({ schedulerRunId, claimed: claimed.length, workers: groups.length },
    dispatchFailed ? 500 : 200);
});
