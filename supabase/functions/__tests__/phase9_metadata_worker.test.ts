import { handlePhase9MetadataWorker }
  from '../../../workers/phase9-metadata-worker';

const workerId = 'metadata-worker-000001';
const workerAuthToken = 'metadata-worker-ingress-A7z.49_xYp-001';
const context = {
  contractVersion: 'p9-metadata-job-context-v1',jobId: 'job-1',attempt: 1,
  claimToken: 'a'.repeat(64),claimExpiresAt: '2026-08-07T00:05:00Z',
  candidateId: 'candidate-1',candidateState: 'processing',candidateVersion: 1,
  storeId: 'store-1',sessionId: 'session-1',inputId: 'input-1',
  observationId: 'observation-1',title: 'Fixture Book',authors: ['Fixture Author'],
  isbnClue: null,publisherClue: null,language: 'en',script: null,
  queryIdentity: '{"fixture":true}',metadataContractVersion: 'p9-metadata-foundation-v1',
  lookupContractVersion: 'p9-metadata-lookup-v1',normalizerVersion: 'p9-bibliographic-normalizer-v1',
  routingPolicyVersion: 'p9-metadata-routing-v1',selectionPolicyVersion: 'p9-metadata-selection-v1',
  localCanonicalEditionId: null,reusableLookupId: null,reusableOutcome: null,
  currentLookupId: null,currentOutcome: null,currentAttemptId: null,currentAttemptOutcome: null,
  currentAttemptDisposition: null,currentAttemptCandidate: null,currentAttemptProviderRequestId: null,
  providerPolicies: [],
};

const request = (authorization?: string, batchSize = 1) => new Request('http://worker/run', {
  method: 'POST',headers: authorization ? { authorization } : {},
  body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize }),
});

describe('Phase 9 runnable metadata worker', () => {
  it('rejects unauthenticated manual invocation before claiming', async () => {
    const rpc = jest.fn();
    const response = await handlePhase9MetadataWorker(request(), {
      workerId,workerAuthToken,serviceClient: { rpc },primary: null,primaryCapability: null,
    });
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('runs a bounded empty manual batch without automatic dispatch', async () => {
    const rpc = jest.fn(async () => ({ data: [], error: null }));
    const response = await handlePhase9MetadataWorker(
      request(`Bearer ${workerAuthToken}`),
      { workerId,workerAuthToken,serviceClient: { rpc },primary: null,primaryCapability: null },
    );
    await expect(response.json()).resolves.toEqual({ claimed: 0, results: [] });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('fails closed to the approved policy outcome when no provider is configured', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({ data: [{ id: 'job-1', attempt_count: 1, lease_token: 'a'.repeat(64) }], error: null })
      .mockResolvedValueOnce({ data: { ...context, providerPolicies: [{
        adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
        matchingAllowed: true, storageAllowed: true, reuseAllowed: true,
        policyVersion: 1,
      }] }, error: null })
      .mockResolvedValueOnce({ data: { status: 'resolved', manual_outcome: 'policy_denied' }, error: null });
    const response = await handlePhase9MetadataWorker(
      request(`Bearer ${workerAuthToken}`),
      { workerId,workerAuthToken,serviceClient: { rpc },primary: null,primaryCapability: null },
    );
    await expect(response.json()).resolves.toEqual({
      claimed: 1,results: [{ outcome: 'manual_metadata_required' }],
    });
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_metadata_job', expect.objectContaining({
      p_job_id: 'job-1',p_failure_kind: 'provider_disabled',p_retryable: false,
    }));
  });

  it('isolates a malformed claimed job and still terminalizes its sibling', async () => {
    const second = { ...context,jobId: 'job-2',candidateId: 'candidate-2' };
    const rpc = jest.fn(async (name: string, parameters: any) => {
      if (name === 'claim_phase9_metadata_jobs') return { data: [
        { id: 'job-1', attempt_count: 1, lease_token: 'a'.repeat(64) },
        { id: 'job-2', attempt_count: 1, lease_token: 'b'.repeat(64) },
      ], error: null };
      if (name === 'phase9_metadata_job_context') return parameters.p_job_id === 'job-1'
        ? { data: {}, error: null }
        : { data: { ...second,claimToken: 'b'.repeat(64) }, error: null };
      if (name === 'phase9_fail_metadata_job') return {
        data: { status: 'resolved', manual_outcome: 'policy_denied' },error: null,
      };
      throw new Error(`unexpected ${name}`);
    });
    const response = await handlePhase9MetadataWorker(
      request(`Bearer ${workerAuthToken}`, 2),
      { workerId,workerAuthToken,serviceClient: { rpc },primary: null,primaryCapability: null },
    );
    await expect(response.json()).resolves.toEqual({
      claimed: 2,results: [
        { outcome: 'manual_metadata_required' },
        { outcome: 'manual_metadata_required' },
      ],
    });
    expect(rpc.mock.calls.filter(([name]) => name === 'phase9_fail_metadata_job'))
      .toEqual(expect.arrayContaining([
        expect.arrayContaining(['phase9_fail_metadata_job', expect.objectContaining({ p_job_id: 'job-1' })]),
        expect.arrayContaining(['phase9_fail_metadata_job', expect.objectContaining({ p_job_id: 'job-2' })]),
      ]));
  });

  it('continues to a sibling when the first failure RPC rejects', async () => {
    const second = { ...context,jobId: 'job-2',candidateId: 'candidate-2',claimToken: 'b'.repeat(64) };
    const rpc = jest.fn(async (name: string, parameters: any) => {
      if (name === 'claim_phase9_metadata_jobs') return { data: [
        { id: 'job-1', attempt_count: 1, lease_token: 'a'.repeat(64) },
        { id: 'job-2', attempt_count: 1, lease_token: 'b'.repeat(64) },
      ], error: null };
      if (name === 'phase9_metadata_job_context') return parameters.p_job_id === 'job-1'
        ? { data: {}, error: null } : { data: second, error: null };
      if (name === 'phase9_fail_metadata_job' && parameters.p_job_id === 'job-1') {
        throw new Error('completion transport rejected');
      }
      return { data: { status: 'resolved' },error: null };
    });
    const response = await handlePhase9MetadataWorker(request(`Bearer ${workerAuthToken}`, 2), {
      workerId,workerAuthToken,serviceClient: { rpc },primary: null,primaryCapability: null,
    });
    const body = await response.json();
    expect(body.claimed).toBe(2);
    expect(rpc).toHaveBeenCalledWith('phase9_fail_metadata_job',
      expect.objectContaining({ p_job_id: 'job-2' }));
  });

  it('fences an unexpected post-context exception through the retry lifecycle', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({ data: [{ id: 'job-1', attempt_count: 1, lease_token: 'a'.repeat(64) }], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: { status: 'retry_scheduled', manual_outcome: null }, error: null });
    const primary = {
      lookup: jest.fn(async () => { throw new Error('controlled adapter failure'); }),
    } as any;
    const capability = {
      adapterKey: 'google_books', adapterVersion: '1.0.0',
      capabilityVersion: 'cap-v1', enabled: true,
    } as any;
    const response = await handlePhase9MetadataWorker(
      request(`Bearer ${workerAuthToken}`),
      { workerId,workerAuthToken,serviceClient: { rpc },primary,primaryCapability: capability },
    );
    await expect(response.json()).resolves.toEqual({
      claimed: 1,results: [{ outcome: 'retry_scheduled' }],
    });
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_metadata_job', expect.objectContaining({
      p_job_id: 'job-1',p_failure_kind: 'provider_unavailable',p_retryable: true,
    }));
  });
});
