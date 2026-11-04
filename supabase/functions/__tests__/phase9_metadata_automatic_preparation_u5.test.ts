import { buildAutomaticLookupSpec, decodeAutomaticPreparation, prepareAutomaticMetadata }
  from '../_shared/imageInventory/runtime/metadataAutomaticPreparation';
import { metadataLookupParameters, requestFromMetadataContext }
  from '../_shared/imageInventory/runtime/metadataGatewayContext';
import { editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';
import { context, fence, GOLDEN_LOOKUP_ID, GOLDEN_CLOCK } from './support/automaticB1';

const spec = () => {
  const fixture = editionWorkerFixture();
  const configuration = { worker: fixture.dependencies.workerId, context: context(), primary: fixture.adapter,
    adapterKey: 'google_books', adapterVersion: '1.0.0', capabilityVersion: 'google-books-capability-v1',
    schemaVersion: 'p9-metadata-foundation-v1', lookupContractVersion: 'p9-metadata-lookup-v1',
    normalizerVersion: 'p9-bibliographic-normalizer-v1', routingPolicyVersion: 'p9-metadata-routing-v1',
    selectionPolicyVersion: 'p9-metadata-selection-v1', snapshotVersion: 'p9-selected-metadata-v1',
    cachePolicyVersion: 'p9-metadata-cache-v1', cacheNamespace: 'metadata-v1',
    pricingPolicyVersion: 'metadata-zero-cost-v1', revalidationSeconds: 86400, selectedPolicyVersion: 7 };
  return { configuration, request: { ...requestFromMetadataContext(context()), claimWorker: configuration.worker } };
};
const leader = () => ({ admission: { status: 'started', round: 0 },
  coalescing: { mode: 'leader', lookupId: GOLDEN_LOOKUP_ID } });
describe('U5 B1 automatic preparation (02c §§4.3/5.1)', () => {
  // Mutation caught: accepting a queued same-claim replay even though M93's queue transition clears its lease.
  it('F3 rejects queued replay and accepts finalized, unknown and running controls', () => {
    expect(() => decodeAutomaticPreparation({ admission: { status: 'replayed', round: 0, runStatus: 'queued' }, coalescing: null }))
      .toThrow('P9_AUTOMATIC_PREPARATION_INVALID');
    for (const runStatus of ['finalized', 'unknown', 'running']) {
      const value = { admission: { status: 'replayed', round: 0, runStatus }, coalescing: null };
      expect(decodeAutomaticPreparation(value)).toEqual(value);
    }
  });
  // Mutation caught: leaking claim/tenant parameters or changing historical cache policy in the thirteen-string spec.
  it('maps exactly the existing lookup identity fields without scope', () => {
    const { request, configuration } = spec();
    const existing = metadataLookupParameters(request, configuration, null);
    const result = buildAutomaticLookupSpec(request, configuration);
    expect(Object.keys(result)).toHaveLength(13);
    for (const [key, value] of Object.entries(result)) {
      expect(typeof value).toBe('string'); expect(value).toBe(existing[('p_' + key) as keyof typeof existing]);
    }
    expect(result.reuse_policy_version).toBe('7'); expect(result).not.toHaveProperty('job_id');
    expect(Object.isFrozen(result)).toBe(true);
  });
  // Mutation caught: treating a known SQL refusal/replay/follower as leader permission.
  it.each([leader(), { admission: { status: 'started', round: 1 }, coalescing: null },
    { admission: { status: 'replayed', round: 0, runStatus: 'running' }, coalescing: null },
    ...['recovery_only', 'configuration_required', 'drain_required'].map(status => ({ admission: { status }, coalescing: null })),
    { admission: { status: 'capacity_wait', dueAt: GOLDEN_CLOCK }, coalescing: null },
    ...['follower', 'follower_pending'].map(mode => ({ admission: null, coalescing: { mode, leaderLookupId: GOLDEN_LOOKUP_ID } }))])(
    'decodes the complete joint outcome %p', value => { expect(decodeAutomaticPreparation(value)).toEqual(value); });
  // Mutation caught: accepting impossible admission/election pairings, unknown statuses or malformed SQL fields.
  it.each([{}, { ...leader(), extra: true }, { admission: null, coalescing: null },
    { admission: null, coalescing: leader().coalescing },
    { admission: { status: 'started', round: 2 }, coalescing: null },
    { admission: { status: 'started', round: 1 }, coalescing: leader().coalescing },
    { admission: { status: 'recovery_only' }, coalescing: leader().coalescing },
    { admission: { status: 'started', round: 0 }, coalescing: { mode: 'follower', leaderLookupId: GOLDEN_LOOKUP_ID } },
    { admission: { status: 'replayed', round: 0, runStatus: 'invented' }, coalescing: null },
    { admission: { status: 'capacity_wait', dueAt: 'bad' }, coalescing: null },
    { admission: { status: 'reserved', slots: 1 }, coalescing: null }])('refuses impossible result %p', value => {
    expect(() => decodeAutomaticPreparation(value)).toThrow('P9_AUTOMATIC_PREPARATION_INVALID');
    expect(decodeAutomaticPreparation(leader())).toEqual(leader());
  });
  // Mutation caught: double-prefixing spec keys, omitting recheck, or hiding SQL error identity.
  it('calls the exact prepare signature and keeps refusals distinct from uncertainty', async () => {
    const { request, configuration } = spec(), lookup = buildAutomaticLookupSpec(request, configuration);
    const rpc = jest.fn(async () => ({ data: leader(), error: null }));
    await expect(prepareAutomaticMetadata({ rpc }, fence(), lookup, false)).resolves.toEqual(leader());
    expect(rpc).toHaveBeenCalledWith('phase9_prepare_automatic_metadata_v1', { f: fence(), p_lookup: lookup, p_recheck: false });
    await expect(prepareAutomaticMetadata({ rpc: async () => ({ data: null, error: { message: 'P9_REQUEST_INVALID', code: 'P0001' } }) },
      fence(), lookup, true)).rejects.toMatchObject({ message: 'P9_REQUEST_INVALID', uncertain: false, code: 'P0001' });
    await expect(prepareAutomaticMetadata({ rpc: async () => { throw new Error('secret transport detail'); } }, fence(), lookup, false))
      .rejects.toMatchObject({ message: 'P9_AUTOMATIC_RPC_UNCERTAIN', uncertain: true });
    await expect(prepareAutomaticMetadata({ rpc: async () => ({ data: {}, error: null }) }, fence(), lookup, false))
      .rejects.toMatchObject({ message: 'P9_AUTOMATIC_RPC_UNCERTAIN', uncertain: true });
    await expect(prepareAutomaticMetadata({ rpc }, fence(), { ...lookup, store_id: 'forged' }, false))
      .rejects.toThrow('P9_AUTOMATIC_PREPARATION_INVALID'); expect(rpc).toHaveBeenCalledTimes(1);
  });
});
