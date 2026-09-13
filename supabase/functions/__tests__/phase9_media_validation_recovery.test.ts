import { runMediaValidationWorker } from '../_shared/imageInventory/runtime/mediaValidationWorker';
import { makeHarness } from './phase9_media_validation_test_helpers';

const request = { contractVersion: 'phase9-v1' as const, leaseOwner: 'review-worker-0001', batchSize: 1 };

// Master SDD §8; SDD 04 §6, §7, §12. This boundary must not infer
// cleanup authority or successful persistence from an ambiguous RPC result.
describe('media validation recovery boundaries', () => {
  it('uses top-level HTTP status from the real PostgREST result shape', async () => {
    const h = await makeHarness({ completionError: { message: 'Conflict' }, completionStatus: 409 });
    expect((await runMediaValidationWorker(request, h.client, h.processor)).results[0].outcome).toBe('reconciliation_required');
    expect(h.rpc).not.toHaveBeenCalledWith('phase9_fail_media_validation', expect.anything());
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('bounds thrown failure-persistence errors without leaking diagnostics', async () => {
    const h = await makeHarness({ completionError: { code: '08006' }, failureThrows: true });
    const result = await runMediaValidationWorker(request, h.client, h.processor);
    expect(result.results[0]).toEqual(expect.objectContaining({ outcome: 'reconciliation_required', reason: 'failure_persistence_unknown' }));
    expect(JSON.stringify(result)).not.toContain('private transport diagnostic');
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('verifies custom metadata through info and hashes the actual bytes', async () => {
    const h = await makeHarness({ targetConflict: true });
    expect((await runMediaValidationWorker(request, h.client, h.processor)).results[0].outcome).toBe('queued');
    expect(h.info).toHaveBeenCalledWith(h.targetPath);
    expect(h.download).toHaveBeenCalledWith(h.targetPath);
  });

  it('rejects corrupt bytes even when object metadata matches', async () => {
    const h = await makeHarness({ targetConflict: true, corruptBytes: true });
    await runMediaValidationWorker(request, h.client, h.processor);
    expect(h.rpc).not.toHaveBeenCalledWith('phase9_complete_media_validation', expect.anything());
    expect(h.rpc).toHaveBeenLastCalledWith('phase9_fail_media_validation', expect.objectContaining({ p_retryable: false }));
  });

  it('keeps a temporary info failure retryable', async () => {
    const h = await makeHarness({ targetConflict: true, infoError: { status: 503 } });
    await runMediaValidationWorker(request, h.client, h.processor);
    expect(h.rpc).toHaveBeenLastCalledWith('phase9_fail_media_validation', expect.objectContaining({ p_retryable: true }));
  });

  it.each([
    { status: 409 },
    { code: '23503', status: 409, message: 'foreign key violation' },
    { code: 'P0001', message: 'P9_MEDIA_NOT_APPROVED' },
    { code: 'P0001', message: 'P9_OWNER_NOT_AUTHORIZED' },
    { code: 'P0001', message: 'P9_IDEMPOTENCY_MISMATCH' },
  ])('does not turn an unclassified/authority conflict into changed-image failure: %j', async (completionError) => {
    const h = await makeHarness({ completionError });
    const result = await runMediaValidationWorker(request, h.client, h.processor);
    expect(result.results[0].outcome).toBe('reconciliation_required');
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalledWith('phase9_fail_media_validation', expect.anything());
  });

  it('retains duplicate output pending authoritative cleanup instead of deleting by upload ownership', async () => {
    const h = await makeHarness({ completionError: { code: '23505', message: 'duplicate key' } });
    const result = await runMediaValidationWorker(request, h.client, h.processor);
    expect(h.remove).not.toHaveBeenCalled();
    expect(result.results[0]).toEqual(expect.objectContaining({ outcome: 'reconciliation_required', cleanupRequired: true }));
    expect(h.rpc).not.toHaveBeenCalledWith('phase9_fail_media_validation', expect.anything());
  });

  it('does not label failure-RPC unavailability a stale lease', async () => {
    const h = await makeHarness({ completionError: { code: '08006' }, failureError: { code: '08006' } });
    const result = await runMediaValidationWorker(request, h.client, h.processor);
    expect(result.results[0]).toEqual(expect.objectContaining({ outcome: 'reconciliation_required', reason: 'failure_persistence_unknown' }));
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('reports an explicitly fenced failure as stale', async () => {
    const h = await makeHarness({ completionError: { code: '08006' }, failureError: { message: 'P9_STATE_CONFLICT' } });
    expect((await runMediaValidationWorker(request, h.client, h.processor)).results[0].outcome).toBe('stale_lease');
    expect(h.remove).not.toHaveBeenCalled();
  });
});
