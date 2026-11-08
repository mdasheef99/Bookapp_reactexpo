// Unit 2 (8c) Defect 3: an unresolved registration submission keeps the claim
// uncertain even when a later different submission succeeds.
import { decodeMetadataJobContext } from '../_shared/imageInventory/runtime/metadataJobContext';
import type { MetadataJobContext } from '../_shared/imageInventory/runtime/metadataJobContext';
import { createEditionProviderCalls } from '../_shared/imageInventory/runtime/metadataEditionProviderCalls';
import type { MetadataGatewayConfiguration } from '../_shared/imageInventory/runtime/metadataGatewayContext';
import { explicitContext, UUID_LINEAGE } from './fixtures/phase9/editionOptionsWorker';

const rawContext = { ...explicitContext, ...UUID_LINEAGE, providerPolicies: [{
  adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true, matchingAllowed: true,
  storageAllowed: true, reuseAllowed: true, policyVersion: 1,
}] };
const context: MetadataJobContext = decodeMetadataJobContext(rawContext);
const configuration = {
  worker: 'metadata-worker-unit-0001', context, primary: null,
  adapterKey: 'open_library', adapterVersion: '1.0.0', capabilityVersion: 'cap-v1',
  schemaVersion: 'p9-metadata-foundation-v1', lookupContractVersion: 'p9-metadata-lookup-v1',
  normalizerVersion: 'p9-bibliographic-normalizer-v1', routingPolicyVersion: 'p9-metadata-routing-v1',
  selectionPolicyVersion: 'p9-metadata-selection-v1', snapshotVersion: 'p9-selected-metadata-v1',
  cachePolicyVersion: 'p9-metadata-cache-v1', cacheNamespace: 'metadata-v1',
  pricingPolicyVersion: 'metadata-zero-cost-v1', revalidationSeconds: 86400,
} as unknown as MetadataGatewayConfiguration;

function calls(mode: 'resolved-replay' | 'unresolved-then-success') {
  let registrations = 0;
  const client = {
    async rpc(name: string, p: Record<string, unknown>) {
      if (name === 'phase9_metadata_job_context') return { data: rawContext, error: null };
      if (name === 'phase9_finalize_edition_options_provider_call_v1') {
        return { data: { status: p.p_status, provider_call_id: p.p_provider_call_id }, error: null };
      }
      if (name === 'phase9_register_edition_options_provider_call_v1') {
        registrations += 1;
        if (mode === 'resolved-replay') {
          if (registrations === 1) throw new Error('lost registration response');
          return { data: { status: 'registered', provider_call_id: 'call-1' }, error: null };
        }
        if (registrations <= 2) throw new Error('unresolved registration ' + registrations);
        return { data: { status: 'registered', provider_call_id: 'call-2' }, error: null };
      }
      throw new Error('unexpected RPC ' + name);
    },
  };
  return createEditionProviderCalls(client as never, configuration);
}

const hookCall = { sequence: 0, stage: 'search', signal: new AbortController().signal };

describe('8c registration uncertainty is claim-local and sticky', () => {
  it('resolves a submission when its exact replay registers and proves unsent', async () => {
    const providerCalls = calls('resolved-replay');
    const hooks = providerCalls.createPortHooks('lookup-1', 'attempt-1');
    await expect(hooks.beforeRequest(hookCall)).rejects.toThrow('lost registration response');
    expect(providerCalls.onlyProvenUnsent()).toBe(true);
  });

  it('keeps an unresolved submission after a different later submission succeeds', async () => {
    const providerCalls = calls('unresolved-then-success');
    const hooks = providerCalls.createPortHooks('lookup-1', 'attempt-1');
    await expect(hooks.beforeRequest(hookCall)).rejects.toThrow('unresolved registration');
    const registered = await hooks.beforeRequest({ ...hookCall, sequence: 1 });
    await hooks.afterRequest(registered.callId, { outcome: 'cancelled', retryable: false,
      physicalStatus: 'stale_rejected', egressStarted: false });
    expect(providerCalls.onlyProvenUnsent()).toBe(false);
  });
});
