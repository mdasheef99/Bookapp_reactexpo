import { runMediaValidationWorker } from '../_shared/imageInventory/runtime/mediaValidationWorker';
import { makeHarness } from './phase9_media_validation_test_helpers';

const request = { contractVersion: 'phase9-v1' as const, leaseOwner: 'prepare-worker-0001', batchSize: 1 };

describe('durable media output preparation (SDD 04 §12)', () => {
  it('prepares both paths before any Storage upload', async () => {
    const h = await makeHarness();
    const original = h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation(async (name: string, args: unknown) => name === 'phase9_prepare_media_validation_outputs'
      ? { data: { ...h.context, output_intent_version: 1 }, error: null } : original(name, args));
    await runMediaValidationWorker(request, h.client, h.processor);
    const prepare = h.rpc.mock.calls.findIndex(([name]) => name === 'phase9_prepare_media_validation_outputs');
    expect(prepare).toBeGreaterThanOrEqual(0);
    expect(h.rpc.mock.invocationCallOrder[prepare]).toBeLessThan(h.upload.mock.invocationCallOrder[0]);
  });

  it('fails closed before upload when the intent contract is unavailable', async () => {
    const h = await makeHarness();
    h.context.output_intent_version = 0;
    await runMediaValidationWorker(request, h.client, h.processor);
    expect(h.upload).not.toHaveBeenCalled();
  });

  it('returns canonical duplicate rejection without a second failure mutation', async () => {
    const h = await makeHarness({ completionData: { state: 'duplicate_rejected',
      safe_error_code: 'P9_MEDIA_DUPLICATE_INPUT', input_id: 'input' } });
    const original = h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation(async (name: string, args: unknown) => name === 'phase9_prepare_media_validation_outputs'
      ? { data: { ...h.context, output_intent_version: 1 }, error: null } : original(name, args));
    expect((await runMediaValidationWorker(request, h.client, h.processor)).results[0].outcome).toBe('duplicate_rejected');
    expect(h.rpc).not.toHaveBeenCalledWith('phase9_fail_media_validation', expect.anything());
  });

  it('does not mislabel an unrelated uniqueness violation as a duplicate image', async () => {
    const h = await makeHarness({ completionError: { code: '23505', message: 'another constraint' } });
    expect((await runMediaValidationWorker(request, h.client, h.processor)).results[0].outcome)
      .toBe('reconciliation_required');
    expect(h.rpc).not.toHaveBeenCalledWith('phase9_fail_media_validation', expect.anything());
  });
});
