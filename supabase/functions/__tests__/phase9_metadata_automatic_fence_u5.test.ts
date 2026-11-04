import { buildAutomaticFence, decodeAutomaticEditionFence, loadAutomaticEditionFence,
  validateAutomaticFence } from '../_shared/imageInventory/runtime/metadataAutomaticEditionFence';
import { claim, context, fence, read, lineage, GOLDEN_LOOKUP_ID } from './support/automaticB1';

describe('U5 B1 automatic edition fence (02c §4.3)', () => {
  // Mutation caught: a transport error copying a SQL refusal message is misclassified as a certain rollback without P0001.
  it.each([undefined, null, '08006', 'P9A01'])('F2 requires P0001 for a certain refusal, received %p', async code => {
    await expect(loadAutomaticEditionFence({ rpc: async () => ({ data: null,
      error: { message: 'P9_STATE_CONFLICT', code } }) }, claim)).rejects.toMatchObject({ uncertain: true,
      message: 'P9_AUTOMATIC_RPC_UNCERTAIN' });
    await expect(loadAutomaticEditionFence({ rpc: async () => ({ data: null,
      error: { message: 'P9_STATE_CONFLICT', code: 'P0001' } }) }, claim)).rejects.toMatchObject({
      uncertain: false, message: 'P9_STATE_CONFLICT', code: 'P0001' });
  });
  // Mutation caught: defaulting automatic generation/request instead of using the authoritative M94 read.
  it('builds exactly eleven keys and preserves noninitial edition state', () => {
    const state = { ...read(), requestGeneration: 7, capturedRequestId: GOLDEN_LOOKUP_ID };
    const result = buildAutomaticFence(context(), claim.worker, state);
    expect(result).toEqual({ ...fence(), requestGeneration: 7, capturedRequestId: GOLDEN_LOOKUP_ID });
    expect(Object.keys(result)).toHaveLength(11); expect(Object.isFrozen(result)).toBe(true);
    expect(buildAutomaticFence(context(), claim.worker, read())).toEqual(fence());
  });
  // Mutation caught: accepting incomplete/unknown DTO keys or unbounded SQL values.
  it.each([null, [], {}, { ...read(), extra: true }, { ...read(), lineage: undefined },
    { ...read(), requestGeneration: -1 }, { ...read(), requestGeneration: 2147483648 },
    { ...read(), candidateVersion: 0 }, { ...read(), capturedRequestId: 'bad' }])('refuses invalid read %p', value => {
    expect(() => decodeAutomaticEditionFence(value)).toThrow('P9_AUTOMATIC_FENCE_INVALID');
    expect(decodeAutomaticEditionFence(read())).toEqual(read());
  });
  // Mutation caught: manufacturing routing evidence from partial or nonprimary lineage.
  it.each([{ ...lineage(), policyVersion: 0 }, { ...lineage(), role: 'secondary', sequence: 2 },
    { ...lineage(), purpose: 'edition_options' }, { ...lineage(), claimAttempt: 6 },
    { ...lineage(), lookupId: 'bad' }, { ...lineage(), extra: true }, { adapterKey: 'google_books' }])(
    'refuses invalid historical lineage %p', value => {
      expect(() => decodeAutomaticEditionFence({ ...read(), lineage: value })).toThrow('P9_AUTOMATIC_FENCE_INVALID');
      expect(decodeAutomaticEditionFence({ ...read(), lineage: lineage() }).lineage).toEqual(lineage());
    });
  // Mutation caught: ignoring candidate-version or persisted lookup/attempt disagreement.
  it('compares context scope and lineage instead of refreshing the fence', () => {
    expect(() => buildAutomaticFence(context(), claim.worker, { ...read(), candidateVersion: 2 }))
      .toThrow('P9_AUTOMATIC_FENCE_INVALID');
    expect(() => buildAutomaticFence({ ...context(), currentLookupId: context().jobId }, claim.worker,
      { ...read(), lineage: lineage() })).toThrow('P9_AUTOMATIC_FENCE_INVALID');
    expect(buildAutomaticFence({ ...context(), currentLookupId: GOLDEN_LOOKUP_ID,
      currentAttemptId: lineage().attemptId }, claim.worker, { ...read(), lineage: lineage() })).toEqual(fence());
  });
  // Mutation caught: forwarding extra fence keys or an invalid lease credential to SQL.
  it.each([{ ...fence(), extra: true }, { ...fence(), leaseToken: 'bad' },
    { ...fence(), claimAttempt: 0 }, { ...fence(), queryIdentity: '\u0000' },
    { ...fence(), capturedRequestId: undefined }])('refuses invalid fence %p', value => {
    expect(() => validateAutomaticFence(value)).toThrow('P9_AUTOMATIC_FENCE_INVALID');
    expect(validateAutomaticFence(fence())).toEqual(fence());
  });
  // Mutation caught: using the old context RPC or discarding a lease-fenced SQL refusal.
  it('loads only the narrow RPC and preserves its state conflict', async () => {
    const rpc = jest.fn(async () => ({ data: read(), error: null }));
    await expect(loadAutomaticEditionFence({ rpc }, claim)).resolves.toEqual(read());
    expect(rpc).toHaveBeenCalledWith('phase9_automatic_edition_fence_v1', {
      p_job_id: claim.jobId, p_worker: claim.worker, p_lease_token: claim.leaseToken, p_attempt_count: claim.attempt });
    await expect(loadAutomaticEditionFence({ rpc: async () => ({ data: null,
      error: { message: 'P9_STATE_CONFLICT', code: 'P0001' } }) }, claim)).rejects.toMatchObject({
      message: 'P9_STATE_CONFLICT', code: 'P0001', rpc: 'phase9_automatic_edition_fence_v1', uncertain: false });
  });
});
