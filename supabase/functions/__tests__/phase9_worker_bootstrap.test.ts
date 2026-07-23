import { handlePhase9MediaValidationWorker } from '../../../workers/phase9-media-validation-worker';
import {
  assertDedicatedWorkerConfiguration,
  createPhase9MediaValidationService,
} from '../../../workers/phase9-media-validation-worker/bootstrap';

const rpc = jest.fn();
const client: any = { rpc };

beforeEach(() => jest.resetAllMocks());

describe('Phase 9 dedicated worker authentication and bootstrap', () => {
  it('denies missing worker-specific authentication before claiming', async () => {
    const response = await handlePhase9MediaValidationWorker(new Request('http://worker/run', {
      method: 'POST', body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
    }), { workerId: 'worker-0000000001', workerAuthToken: 'dedicated-secret', serviceClient: client, mediaProcessor: {} as any });
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('accepts a strong distinct worker secret and authenticates before an empty claim', async () => {
    const workerAuthToken = 'valid-worker-ingress-secret-A7z.49_xYp-001';
    expect(() => assertDedicatedWorkerConfiguration({
      supabaseUrl: 'https://example.supabase.co',
      supabaseServiceRoleKey: 'service-role-secret-that-is-long-enough-0001',
      workerId: 'worker-0000000001',
      workerAuthToken,
      magickWasmPath: 'configured.wasm',
    })).not.toThrow();
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const response = await handlePhase9MediaValidationWorker(new Request('http://worker/run', {
      method: 'POST',
      headers: { authorization: `Bearer ${workerAuthToken}` },
      body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
    }), { workerId: 'worker-0000000001', workerAuthToken, serviceClient: client, mediaProcessor: {} as any });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ claimed: 0, results: [] });
    expect(rpc).toHaveBeenCalledWith('claim_phase9_media_validation_jobs', {
      p_batch_size: 1, p_worker: 'worker-0000000001',
    });
  });

  it('rejects missing, weak, or privileged-secret-equivalent ingress secrets', async () => {
    const base = {
      supabaseUrl: 'https://example.supabase.co',
      supabaseServiceRoleKey: 'service-role-secret-that-is-long-enough-0001',
      workerId: 'worker-0000000001',
      magickWasmPath: 'never-read.wasm',
    };
    expect(() => assertDedicatedWorkerConfiguration({ ...base, workerAuthToken: '' }))
      .toThrow('P9_WORKER_CONFIGURATION_INVALID');
    await expect(createPhase9MediaValidationService({ ...base, workerAuthToken: 'too-short' }))
      .rejects.toThrow('P9_WORKER_CONFIGURATION_INVALID');
    await expect(createPhase9MediaValidationService({
      ...base, workerAuthToken: base.supabaseServiceRoleKey,
    })).rejects.toThrow('P9_WORKER_CONFIGURATION_INVALID');
    await expect(createPhase9MediaValidationService({
      ...base,
      workerAuthToken: 'worker-ingress-secret-that-is-long-enough-01',
      privilegedSecrets: ['worker-ingress-secret-that-is-long-enough-01'],
    })).rejects.toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });
});
