import { finalizeMetadataProductionAttempt } from '../_shared/imageInventory/runtime/metadataAttemptFinalization';
import type { MetadataGatewayConfiguration } from '../_shared/imageInventory/runtime/metadataGatewayContext';
import { context, GOLDEN_LOOKUP_ID, GOLDEN_ATTEMPT_ID, GOOGLE_AUTOMATIC_V1 } from './support/automaticB1';
const configuration = { context: context(), worker: 'metadata-worker-fixture-0001',
  pricingPolicyVersion: 'metadata-zero-cost-v1' } as MetadataGatewayConfiguration;
const callId = context().jobId;
const input = { lookupId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
  normalizedOutcome: 'coherent_match' as const, disposition: 'accepted' as const,
  providerRequestId: null, normalizedCandidate: GOOGLE_AUTOMATIC_V1.selected, retryable: false,
  evidence: GOOGLE_AUTOMATIC_V1.evidence };
describe('U5 B1 automatic transaction physical finalization (02c §4.3)', () => {
  const staleInput = { ...input, disposition: 'stale_rejected' as const,
    normalizedOutcome: 'policy_denied' as const, normalizedCandidate: null, evidence: [] };
  const staleReceipt = { provider_call_id: callId, status: 'stale_rejected', normalized_outcome: 'policy_denied',
    logical_outcome: 'policy_denied', provider_request_id: null, retryable: false,
    normalized_candidate: null, match_evidence: [] };
  // Mutation caught: automatic stale finalization rethrows lost/malformed responses instead of proving the original durable receipt.
  it.each([{ data: null, error: { message: 'lost response' } }, { data: {}, error: null }])(
    'F1 reconciles uncertain stale finalization %p and preserves legacy refusal', async first => {
      const rpc = jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ data: staleReceipt, error: null });
      await expect(finalizeMetadataProductionAttempt({ rpc }, configuration, callId, staleInput, 'automatic_transaction'))
        .resolves.toBeUndefined();
      expect(rpc.mock.calls.map(([name]) => name)).toEqual([
        'phase9_finalize_metadata_provider_call', 'phase9_reconcile_metadata_provider_call']);
      expect(rpc.mock.calls[1][1]).toEqual({ p_provider_call_id: callId, p_job_id: configuration.context.jobId,
        p_worker: configuration.worker, p_lease_token: configuration.context.claimToken, p_attempt_count: configuration.context.attempt });
      const legacy = jest.fn().mockResolvedValueOnce({ data: null, error: { message: 'lost response' } });
      await expect(finalizeMetadataProductionAttempt({ rpc: legacy }, configuration, callId, staleInput)).rejects.toThrow();
      expect(legacy).toHaveBeenCalledTimes(1);
    });
  // Mutation caught: adopting an unknown, crossed, or payload-mismatched durable receipt as proof of the requested stale finalization.
  it.each([{ ...staleReceipt, status: 'registered' }, { ...staleReceipt, status: 'outcome_unknown' },
    { ...staleReceipt, status: 'finalized' }, { ...staleReceipt, provider_call_id: GOLDEN_LOOKUP_ID },
    { ...staleReceipt, normalized_outcome: 'provider_unavailable' }, { ...staleReceipt, match_evidence: ['changed'] }])(
    'F1 rejects nonexact stale reconciliation %p', async durable => {
      const rpc = jest.fn().mockResolvedValueOnce({ data: null, error: { message: 'lost response' } })
        .mockResolvedValueOnce({ data: durable, error: null });
      await expect(finalizeMetadataProductionAttempt({ rpc }, configuration, callId, staleInput, 'automatic_transaction'))
        .rejects.toThrow();
      expect(rpc.mock.calls.map(([name]) => name)).toEqual([
        'phase9_finalize_metadata_provider_call', 'phase9_reconcile_metadata_provider_call']);
      const control = jest.fn().mockResolvedValueOnce({ data: null, error: { message: 'lost response' } })
        .mockResolvedValueOnce({ data: staleReceipt, error: null });
      await expect(finalizeMetadataProductionAttempt({ rpc: control }, configuration, callId, staleInput, 'automatic_transaction'))
        .resolves.toBeUndefined();
    });
  // Mutation caught: logically finalizing the attempt before the atomic automatic transaction.
  it('defers logical completion only in explicit automatic_transaction mode', async () => {
    const rpc = jest.fn(async () => ({ data: { provider_call_id: callId, status: 'finalized' }, error: null }));
    await finalizeMetadataProductionAttempt({ rpc }, configuration, callId, input, 'automatic_transaction');
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['phase9_finalize_metadata_provider_call']);
    rpc.mockClear(); await finalizeMetadataProductionAttempt({ rpc }, configuration, callId, input);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'phase9_finalize_metadata_provider_call', 'phase9_finalize_structural_metadata_attempt']);
  });
  // Mutation caught: silently accepting a crossed or stale physical receipt in the new mode.
  it.each([{ provider_call_id: GOLDEN_LOOKUP_ID, status: 'finalized' },
    { provider_call_id: callId, status: 'registered' }, { provider_call_id: callId, status: 'stale_rejected' }])(
    'refuses invalid physical receipt %p', async data => {
      const rpc = jest.fn(async () => ({ data, error: null }));
      await expect(finalizeMetadataProductionAttempt({ rpc }, configuration, callId, input, 'automatic_transaction')).rejects.toThrow();
      expect(rpc.mock.calls.every(([name]) => name !== 'phase9_finalize_structural_metadata_attempt')).toBe(true);
      await expect(finalizeMetadataProductionAttempt({ rpc: async () => ({ data: { provider_call_id: callId, status: 'finalized' }, error: null }) },
        configuration, callId, input, 'automatic_transaction')).resolves.toBeUndefined();
    });
  // Mutation caught: reporting successful physical-only finalization with no call or the wrong purpose.
  it('requires a real call and automatic purpose while leaving explicit default behavior intact', async () => {
    const rpc = jest.fn(async () => ({ data: {}, error: null }));
    await expect(finalizeMetadataProductionAttempt({ rpc }, configuration, undefined, input, 'automatic_transaction')).rejects.toThrow();
    const explicit = { ...configuration, context: { ...context(), purpose: 'edition_options' as const } };
    await expect(finalizeMetadataProductionAttempt({ rpc }, explicit, callId, input, 'automatic_transaction')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    await expect(finalizeMetadataProductionAttempt({ rpc }, explicit, undefined, input)).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });
  // Mutation caught: allowing an invalid call identity into the physical-only SQL boundary.
  it('refuses an invalid call identity before SQL and accepts its valid control', async () => {
    const rpc = jest.fn(async () => ({ data: { provider_call_id: 'bad', status: 'finalized' }, error: null }));
    await expect(finalizeMetadataProductionAttempt({ rpc }, configuration, 'bad', input, 'automatic_transaction')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    await expect(finalizeMetadataProductionAttempt({ rpc: async () => ({ data: { provider_call_id: callId, status: 'finalized' }, error: null }) },
      configuration, callId, input, 'automatic_transaction')).resolves.toBeUndefined();
  });
  // Mutation caught: skipping exact durable payload comparison after a lost physical finalization response.
  it('reconciles physical response loss without logical completion and rejects changed durable bytes', async () => {
    const durable = { provider_call_id: callId, status: 'finalized', normalized_outcome: input.normalizedOutcome,
      logical_outcome: input.normalizedOutcome, provider_request_id: null, retryable: false,
      normalized_candidate: input.normalizedCandidate, match_evidence: input.evidence };
    const rpc = jest.fn().mockResolvedValueOnce({ data: null, error: { message: 'lost response' } })
      .mockResolvedValueOnce({ data: durable, error: null });
    await expect(finalizeMetadataProductionAttempt({ rpc }, configuration, callId, input, 'automatic_transaction')).resolves.toBeUndefined();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'phase9_finalize_metadata_provider_call', 'phase9_reconcile_metadata_provider_call']);
    const crossed = jest.fn().mockResolvedValueOnce({ data: null, error: { message: 'lost response' } })
      .mockResolvedValueOnce({ data: { ...durable, normalized_candidate: null }, error: null });
    await expect(finalizeMetadataProductionAttempt({ rpc: crossed }, configuration, callId, input, 'automatic_transaction'))
      .rejects.toThrow('P9_METADATA_PHYSICAL_RECONCILIATION_CONFLICT');
    expect(crossed.mock.calls.map(([name]) => name)).not.toContain('phase9_finalize_structural_metadata_attempt');
  });
});
