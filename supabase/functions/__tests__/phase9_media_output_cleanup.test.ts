import { runMediaOutputCleanup, readMediaOutputCleanupHealth } from '../_shared/imageInventory/runtime/mediaOutputCleanup';

const request = { leaseOwner: 'cleanup-worker-0001', batchSize: 1 };
const claim = { intent_id: 'intent-1', bucket_id: 'image-extraction-inputs',
  object_path: 'store/session/attempt-1.webp', lease_token: 'a'.repeat(64), attempt_count: 1 };

function harness() {
  const remove = jest.fn().mockResolvedValue({ data: [], error: null });
  const rpc = jest.fn().mockImplementation(async (name: string) => ({
    data: name === 'claim_phase9_media_output_cleanup_jobs' ? [claim] : 'deleted', error: null,
  }));
  const from = jest.fn().mockReturnValue({ remove });
  return { remove, rpc, from, client: { rpc, storage: { from } } };
}

// SDD 04 §12 MED-19: deletion authority is exclusively the durable SQL claim.
describe('durable media output cleanup', () => {
  it('exposes only bounded health counters for operational alerts', async () => {
    const h = harness();
    h.rpc.mockResolvedValue({ data: { manual_reconciliation: 2, due_count: 4,
      oldest_due_seconds: 900, object_path: 'private' }, error: null });
    expect(await readMediaOutputCleanupHealth(h.client)).toEqual({
      manualReconciliation: 2, dueCount: 4, oldestDueSeconds: 900,
    });
  });

  it('does not report unavailable health as zero backlog', async () => {
    const h = harness();
    h.rpc.mockRejectedValue(new Error('private'));
    expect(await readMediaOutputCleanupHealth(h.client)).toEqual({ outcome: 'health_unknown' });
  });
  it('deletes only the exact claimed object and acknowledges the same claim', async () => {
    const h = harness();
    await runMediaOutputCleanup(request, h.client);
    expect(h.from).toHaveBeenCalledWith(claim.bucket_id);
    expect(h.remove).toHaveBeenCalledWith([claim.object_path]);
    expect(h.rpc).toHaveBeenLastCalledWith('phase9_finish_media_output_cleanup', {
      p_intent_id: claim.intent_id, p_worker: request.leaseOwner,
      p_lease_token: claim.lease_token, p_attempt_count: 1, p_outcome: 'deleted',
    });
  });

  it.each([403, 429, 500])('persists returned Storage error %s as retryable', async (statusCode) => {
    const h = harness();
    h.remove.mockResolvedValue({ data: null, error: { statusCode, message: 'private diagnostic' } });
    const result = await runMediaOutputCleanup(request, h.client);
    expect(h.rpc).toHaveBeenLastCalledWith('phase9_finish_media_output_cleanup',
      expect.objectContaining({ p_outcome: 'retryable_error' }));
    expect(JSON.stringify(result)).not.toContain('private diagnostic');
  });

  it('persists thrown Storage failures', async () => {
    const h = harness();
    h.remove.mockRejectedValue(new Error('private transport diagnostic'));
    await runMediaOutputCleanup(request, h.client);
    expect(h.rpc).toHaveBeenLastCalledWith('phase9_finish_media_output_cleanup',
      expect.objectContaining({ p_outcome: 'retryable_error' }));
  });

  it('acknowledges an already missing object', async () => {
    const h = harness();
    h.remove.mockResolvedValue({ data: null, error: { statusCode: '404' } });
    await runMediaOutputCleanup(request, h.client);
    expect(h.rpc).toHaveBeenLastCalledWith('phase9_finish_media_output_cleanup',
      expect.objectContaining({ p_outcome: 'missing' }));
  });

  it.each(['returned', 'thrown'])('retains uncertain %s acknowledgments for SQL lease recovery', async (mode) => {
    const h = harness();
    h.rpc.mockImplementation(async (name: string) => {
      if (name === 'claim_phase9_media_output_cleanup_jobs') return { data: [claim], error: null };
      if (mode === 'thrown') throw new Error('private acknowledgment diagnostic');
      return { data: null, error: { message: 'private acknowledgment diagnostic' } };
    });
    expect(await runMediaOutputCleanup(request, h.client)).toEqual({ claimed: 1,
      results: [{ intentId: claim.intent_id, outcome: 'acknowledgment_unknown' }] });
    expect(h.remove).toHaveBeenCalledTimes(1);
  });

  it('does not delete when claiming fails', async () => {
    const h = harness();
    h.rpc.mockResolvedValue({ data: null, error: { message: 'claim failed' } });
    expect(await runMediaOutputCleanup(request, h.client)).toEqual({ claimed: 0, results: [], outcome: 'claim_unknown' });
    expect(h.remove).not.toHaveBeenCalled();
  });
});
