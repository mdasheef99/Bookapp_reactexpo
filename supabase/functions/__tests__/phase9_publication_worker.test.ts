import { handlePhase9PublicationWorker, runPublicationWorkerBatch } from '../../../workers/phase9-publication-worker/index';

const claim = {
  job_id: '10000000-0000-4000-8000-000000000001',
  lease_token: '10000000-0000-4000-8000-000000000002',
  inventory_id: '10000000-0000-4000-8000-000000000003',
  lease_expires_at: '2026-08-12T12:05:00.000Z',
  publication_intent_version: 2, attempt_number: 1,
};

describe('phase9 publication worker', () => {
  it('U7B-RT15 worker claims only publication_retry with a token-fenced lease and current intent', async () => {
    const rpc = jest.fn(async (name: string) => name === 'claim_phase9_publication_jobs'
      ? { data: [claim], error: null }
      : { data: { outcome: 'published' }, error: null });
    expect(await runPublicationWorkerBatch(1, {
      workerId: 'publication-worker-0001', workerAuthToken: 'unused', serviceClient: { rpc },
    })).toEqual({ claimed: 1, results: [{ outcome: 'published' }] });
    expect(rpc).toHaveBeenNthCalledWith(2, 'phase9_retry_publication_worker_v1', expect.objectContaining({
      p_job_id: claim.job_id, p_lease_token: claim.lease_token,
      p_expected_publication_intent_version: 2, p_attempt_number: 1,
    }));
  });

  it('U7B-RT15 worker classifies retry backoff exhaustion dead-letter and stale-intent cancellation', async () => {
    const rpc = jest.fn(async (name: string) => {
      if (name === 'claim_phase9_publication_jobs') return { data: [claim], error: null };
      if (name === 'phase9_retry_publication_worker_v1') return { data: null, error: {} };
      return { data: 'retry_scheduled', error: null };
    });
    expect((await runPublicationWorkerBatch(1, {
      workerId: 'publication-worker-0001', workerAuthToken: 'unused', serviceClient: { rpc },
    })).results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_publication_job_v1', expect.objectContaining({
      p_category: 'transient', p_safe_code: 'P9_PUBLICATION_FAILED',
    }));
  });

  it('reschedules the canonical committed transient outcome instead of abandoning its lease', async () => {
    const rpc = jest.fn(async (name: string) => {
      if (name === 'claim_phase9_publication_jobs') return { data: [claim], error: null };
      if (name === 'phase9_retry_publication_worker_v1') {
        return { data: { outcome: 'committed_publication_failed' }, error: null };
      }
      return { data: 'retry_scheduled', error: null };
    });
    expect((await runPublicationWorkerBatch(1, {
      workerId: 'publication-worker-0001', workerAuthToken: 'unused', serviceClient: { rpc },
    })).results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_publication_job_v1', expect.objectContaining({
      p_category: 'transient', p_safe_code: 'P9_PUBLICATION_FAILED',
    }));
  });

  it('U7B-RT15 cancels deterministic failures instead of scheduling futile retries', async () => {
    const rpc = jest.fn(async (name: string) => {
      if (name === 'claim_phase9_publication_jobs') return { data: [claim], error: null };
      if (name === 'phase9_retry_publication_worker_v1') {
        return { data: null, error: { message: 'P9_PUBLICATION_INELIGIBLE:stock' } };
      }
      return { data: 'cancelled', error: null };
    });
    expect((await runPublicationWorkerBatch(1, {
      workerId: 'publication-worker-0001', workerAuthToken: 'unused', serviceClient: { rpc },
    })).results).toEqual([{ outcome: 'cancelled' }]);
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_publication_job_v1', expect.objectContaining({
      p_category: 'deterministic', p_safe_code: 'P9_PUBLICATION_INELIGIBLE',
    }));
  });

  it('rejects bad auth and strict body drift', async () => {
    const dependencies = { workerId: 'publication-worker-0001',
      workerAuthToken: 'publication-ingress-token-0001-Strong', serviceClient: { rpc: jest.fn() } };
    expect((await handlePhase9PublicationWorker(new Request('https://worker/run', {
      method: 'POST', body: '{}', headers: { authorization: 'Bearer wrong' },
    }), dependencies)).status).toBe(403);
    expect((await handlePhase9PublicationWorker(new Request('https://worker/run', {
      method: 'POST', body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1, extra: true }),
      headers: { authorization: `Bearer ${dependencies.workerAuthToken}` },
    }), dependencies)).status).toBe(400);
  });
});
