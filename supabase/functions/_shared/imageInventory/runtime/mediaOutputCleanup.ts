import { RpcResult } from './mediaValidationErrors';

type CleanupClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
  storage: { from(bucket: string): {
    remove(paths: string[]): Promise<{ data: unknown; error: unknown }>;
  } };
};
type Claim = { intent_id: string; bucket_id: string; object_path: string;
  lease_token: string; attempt_count: number };

export async function readMediaOutputCleanupHealth(client: Pick<CleanupClient, 'rpc'>) {
  try {
    const { data, error } = await client.rpc('phase9_media_output_cleanup_health', {});
    const values = [data?.manual_reconciliation, data?.due_count, data?.oldest_due_seconds];
    if (error || values.some(value => typeof value !== 'number' || !Number.isFinite(value)
      || value < 0 || value > Number.MAX_SAFE_INTEGER)) throw new Error('health_unknown');
    return { manualReconciliation: values[0], dueCount: values[1], oldestDueSeconds: values[2] };
  } catch {
    return { outcome: 'health_unknown' };
  }
}

function missing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as Record<string, unknown>;
  return Number(value.statusCode ?? value.status) === 404;
}

/** SDD 04 §12 MED-19: SQL owns deletion fences and permanent tombstone sweeps.
 * Never infer authority from a local upload flag or a Storage listing. */
export async function runMediaOutputCleanup(
  request: { leaseOwner: string; batchSize: number }, client: CleanupClient,
) {
  let claims: Claim[];
  try {
    const result = await client.rpc('claim_phase9_media_output_cleanup_jobs', {
      p_batch_size: request.batchSize, p_worker: request.leaseOwner,
    });
    if (result.error || !Array.isArray(result.data)) throw new Error('claim_unknown');
    claims = result.data;
  } catch {
    return { claimed: 0, results: [], outcome: 'claim_unknown' };
  }
  const results: { intentId: string; outcome: string }[] = [];
  for (const claim of claims) {
    let outcome = 'retryable_error';
    try {
      const removed = await client.storage.from(claim.bucket_id).remove([claim.object_path]);
      outcome = !removed.error ? 'deleted' : missing(removed.error) ? 'missing' : 'retryable_error';
    } catch { /* Persist thrown transport errors through the same bounded path. */ }
    try {
      const recorded = await client.rpc('phase9_finish_media_output_cleanup', {
        p_intent_id: claim.intent_id, p_worker: request.leaseOwner,
        p_lease_token: claim.lease_token, p_attempt_count: claim.attempt_count, p_outcome: outcome,
      });
      if (recorded.error) throw new Error('acknowledgment_unknown');
      results.push({ intentId: claim.intent_id, outcome });
    } catch {
      // Keep the SQL claim intact; its expiry permits a safe repeat delete.
      results.push({ intentId: claim.intent_id, outcome: 'acknowledgment_unknown' });
    }
  }
  return { claimed: claims.length, results };
}
