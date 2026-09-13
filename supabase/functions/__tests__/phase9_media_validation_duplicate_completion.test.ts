import { runMediaValidationWorker } from '../_shared/imageInventory/runtime/mediaValidationWorker';
import { claim, CompletionError, makeHarness } from './phase9_media_validation_test_helpers';

const duplicateError: CompletionError = {
  code: '23505',
  status: 409,
  message: 'duplicate key value violates unique constraint image_extraction_inputs_store_id_sha256_orchestration_version_key',
};

describe('Phase 9 duplicate sanitized-hash completion boundary', () => {
  it('fails closed for an existing ready duplicate artifact and preserves the new input boundary', async () => {
    const harness = await makeHarness({ completionError: duplicateError });
    const result = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'media-worker-0001', batchSize: 1,
    }, harness.client, harness.processor);

    expect(result.results[0].outcome).toBe('reconciliation_required');
    expect(harness.rpc).not.toHaveBeenCalledWith('phase9_fail_media_validation', expect.anything());
    expect(harness.rpc.mock.calls.filter(([name]) => name === 'phase9_complete_media_validation')).toHaveLength(1);
  });

  it('handles independent mocked winner/loser responses without deleting either object', async () => {
    const winner = await makeHarness({ completionData: { input_id: 'winner-input', state: 'queued' } });
    const loser = await makeHarness({ completionData: { input_id: 'loser-input', state: 'duplicate_rejected', safe_error_code: 'P9_MEDIA_DUPLICATE_INPUT' } });
    const [winnerResult, loserResult] = await Promise.all([
      runMediaValidationWorker({ contractVersion: 'phase9-v1', leaseOwner: 'media-worker-win1', batchSize: 1 }, winner.client, winner.processor),
      runMediaValidationWorker({ contractVersion: 'phase9-v1', leaseOwner: 'media-worker-los1', batchSize: 1 }, loser.client, loser.processor),
    ]);

    expect(winnerResult.results[0].outcome).toBe('queued');
    expect(loserResult.results[0].outcome).toBe('duplicate_rejected');
    expect(winner.remove).not.toHaveBeenCalled();
    expect(loser.remove).not.toHaveBeenCalled();
    expect(loser.rpc).not.toHaveBeenCalledWith('phase9_fail_media_validation', expect.anything());
  });

  it('does not treat the same sanitized hash in another store as a duplicate completion', async () => {
    const storeA = await makeHarness({ targetStore: 'store-a' });
    const storeB = await makeHarness({ targetStore: 'store-b' });
    const [resultA, resultB] = await Promise.all([
      runMediaValidationWorker({ contractVersion: 'phase9-v1', leaseOwner: 'media-worker-a001', batchSize: 1 }, storeA.client, storeA.processor),
      runMediaValidationWorker({ contractVersion: 'phase9-v1', leaseOwner: 'media-worker-b001', batchSize: 1 }, storeB.client, storeB.processor),
    ]);

    expect(resultA.results[0].outcome).toBe('queued');
    expect(resultB.results[0].outcome).toBe('queued');
    expect(storeA.remove).not.toHaveBeenCalled();
    expect(storeB.remove).not.toHaveBeenCalled();
  });

  it.each(['missing', 'incompatible', 'unauthorized'] as const)('fails closed when a conflicting target is %s', async (targetState) => {
    const harness = await makeHarness({ targetConflict: true, targetState });
    const result = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'media-worker-0002', batchSize: 1,
    }, harness.client, harness.processor);

    expect(result.results[0].outcome).toBe('resolved');
    expect(harness.rpc).not.toHaveBeenCalledWith('phase9_complete_media_validation', expect.anything());
    expect(harness.rpc).toHaveBeenLastCalledWith('phase9_fail_media_validation', expect.objectContaining({
      p_retryable: false,
      p_safe_error_code: 'P9_MEDIA_OBJECT_CHANGED',
    }));
    expect(harness.remove).not.toHaveBeenCalled();
  });

  it('reuses a byte-identical target for exact attempt replay but rejects changed replay', async () => {
    const exact = await makeHarness({ targetConflict: true, targetState: 'compatible' });
    const exactResult = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'media-worker-repl1', batchSize: 1,
    }, exact.client, exact.processor);
    expect(exactResult.results[0].outcome).toBe('queued');
    expect(exact.remove).not.toHaveBeenCalled();

    const changed = await makeHarness({ targetConflict: true, targetState: 'incompatible' });
    const changedResult = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'media-worker-repl2', batchSize: 1,
    }, changed.client, changed.processor);
    expect(changedResult.results[0].outcome).toBe('resolved');
    expect(changed.rpc).toHaveBeenLastCalledWith('phase9_fail_media_validation', expect.objectContaining({ p_retryable: false }));
  });

  it('keeps a transient completion database failure retryable and retains the uploaded output', async () => {
    const harness = await makeHarness({
      completionError: { code: '08006', status: 503, message: 'database unavailable' },
    });
    const result = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'media-worker-0003', batchSize: 1,
    }, harness.client, harness.processor);

    expect(result.results[0].outcome).toBe('resolved');
    expect(harness.remove).not.toHaveBeenCalled();
    expect(harness.rpc).toHaveBeenLastCalledWith('phase9_fail_media_validation', expect.objectContaining({
      p_retryable: true,
      p_safe_error_code: 'P9_MEDIA_PROCESSING_RETRYABLE',
    }));
  });

  it('retains output and requests reconciliation for an explicit changed replay', async () => {
    const harness = await makeHarness({
      completionError: { status: 409, message: 'P9_IDEMPOTENCY_MISMATCH' },
    });
    const result = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'media-worker-repl3', batchSize: 1,
    }, harness.client, harness.processor);

    expect(result.results[0].outcome).toBe('reconciliation_required');
    expect(harness.remove).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalledWith('phase9_fail_media_validation', expect.anything());
  });

  it('requests reconciliation for HTTP 409 without diagnostics', async () => {
    const harness = await makeHarness({ completionError: { status: 409 } });
    const result = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'media-worker-4091', batchSize: 1,
    }, harness.client, harness.processor);

    expect(result.results[0].outcome).toBe('reconciliation_required');
    expect(harness.remove).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalledWith('phase9_fail_media_validation', expect.anything());
  });

  it('does not retry or mutate on a stale completion lease conflict', async () => {
    const harness = await makeHarness({
      completionError: { status: 409, message: 'P9_STATE_CONFLICT' },
    });
    const result = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'media-worker-stale1', batchSize: 1,
    }, harness.client, harness.processor);

    expect(result.results[0].outcome).toBe('stale_lease');
    expect(harness.remove).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalledWith('phase9_fail_media_validation', expect.anything());
  });

  it('never forwards the database constraint, private path, or tenant detail as worker evidence', async () => {
    const harness = await makeHarness({
      completionError: {
        ...duplicateError,
        details: 'private store-b path and session details',
      },
    });
    const result = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'media-worker-safe1', batchSize: 1,
    }, harness.client, harness.processor);
    const failureCall = harness.rpc.mock.calls.find(([name]) => name === 'phase9_fail_media_validation');

    expect(result.results[0]).toEqual({ jobId: claim.id, outcome: 'reconciliation_required', cleanupRequired: true, reason: 'completion_conflict' });
    expect(failureCall).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('orchestration_version_key');
    expect(JSON.stringify(result)).not.toContain('store-b');
  });

  it('retains the duplicate output for fenced lifecycle cleanup and never enables upsert', async () => {
    const harness = await makeHarness({ completionError: duplicateError });
    await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'media-worker-safe2', batchSize: 1,
    }, harness.client, harness.processor);

    expect(harness.remove).not.toHaveBeenCalled();
    expect(harness.remove).not.toHaveBeenCalled();
    expect(harness.upload).toHaveBeenCalledWith(harness.targetPath, expect.any(Uint8Array), expect.objectContaining({ upsert: false }));
    expect(harness.upload).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ upsert: true }));
  });
});
