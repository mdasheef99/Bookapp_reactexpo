// 02c §§4.1/4.4/9 AC8-10, 8a-1..4: the old worker must keep decoding its exact DTO.
import { decodeMetadataJobContext } from '../_shared/imageInventory/runtime/metadataJobContext';
import { automaticContext, editionWorkerFixture, explicitContext } from './fixtures/phase9/editionOptionsWorker';
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
const contexts: Array<['automatic'|'edition_options',typeof automaticContext|typeof explicitContext]> = [
  ['automatic',automaticContext],['edition_options',explicitContext],
];

describe('AC8-10 [8a-1..4] legacy context controls',()=>{
  it.each(contexts)(
    'GREEN-control decodes unchanged %s context and exact legacy policy keys',(purpose,input)=>{
      const result=decodeMetadataJobContext(input);
      expect(result.purpose).toBe(purpose);
      expect(Object.keys(result.providerPolicies[0]).sort()).toEqual([
        'adapterKey','adapterVersion','enabled','matchingAllowed','policyVersion','reuseAllowed','storageAllowed',
      ]);
      expect(result.providerPolicies[0]).toEqual(input.providerPolicies[0]);
    });
  it.each(['automaticLookupAllowed','explicitSearchAllowed','sharedCatalogueAllowed',
    'automaticRole','explicitRole','automaticOrder','explicitOrder','acceptedAdapterVersions',
    'versionContracts','validationContract','hostPolicyVersion','approvedRequestHosts','approvedBookHosts',
    'approvedCoverHosts','optionsRetentionSeconds','displayLabel','protectionPolicy'])(
    'GREEN-control rejects accidental %s leakage into the old policy array',key=>{
      expect(()=>decodeMetadataJobContext({...automaticContext,providerPolicies:[{
        ...automaticContext.providerPolicies[0],[key]:true,
      }]})).toThrow('P9_METADATA_CONTEXT_INVALID');
    });
  it('GREEN-control rejects an unnegotiated provider-configuration root extension',()=>{
    expect(()=>decodeMetadataJobContext({...automaticContext,providerConfiguration:{version:'p9-provider-config-v1'}}))
      .toThrow('P9_METADATA_CONTEXT_INVALID');
  });
});

// 02c §§4.2/4.3/9 AC8-5/10: observe the real worker and adapter's fake fetcher.
// These legacy controls do not establish durable orphan/outcome_unknown recovery on restart.
describe('AC8-10 legacy worker GET dispatch controls',()=>{
  it('GREEN-control uncertain registration stops before GET dispatch',async()=>{
    const fixture=editionWorkerFixture(),rpc=fixture.dependencies.serviceClient.rpc;
    const client={async rpc(name:string,parameters:Record<string,any>) {
      const result=await rpc(name,parameters);
      if(name==='phase9_register_metadata_provider_call')throw new Error('fixture registration response lost after commit');
      return result;
    }};
    await runMetadataWorkerBatch(1,{...fixture.dependencies,serviceClient:client});
    expect(fixture.physicalCalls).toHaveLength(1);
    expect(fixture.physicalCalls[0].finalized).toBe(false);
    expect(fixture.stats().providerRequests).toBe(0);
  });
  it('GREEN-control unknown finalized response under the same claim does not dispatch another GET',async()=>{
    const fixture=editionWorkerFixture();
    Object.assign(fixture.current(),{currentLookupId:'lookup-job-1',currentAttemptId:'attempt-job-1',
      currentAttemptDisposition:'unresolved',currentPhysicalStatus:'finalized',currentPhysicalClaimAttempt:1,
      currentPhysicalOutcome:null,currentPhysicalRetryable:false});
    const recover=jest.spyOn(fixture.boundary,'recover');
    await fixture.run();
    expect(recover).toHaveBeenCalled();
    expect(fixture.stats().providerRequests).toBe(0);expect(fixture.physicalCalls).toHaveLength(0);
  });
  it('GREEN-control lost completion response and reclaimed replay recover without another GET',async()=>{
    const fixture=editionWorkerFixture();fixture.controls.loseCompletionResponse=true;
    expect((await fixture.run()).results).toEqual([{outcome:'edition_options_available'}]);
    expect(fixture.stats().providerRequests).toBe(1);
    const saved=JSON.stringify([...fixture.saved]),calls=JSON.stringify(fixture.physicalCalls);
    fixture.requeue();
    expect((await fixture.run()).results).toEqual([{outcome:'edition_options_available'}]);
    expect(fixture.stats().providerRequests).toBe(1);
    expect(JSON.stringify(fixture.physicalCalls)).toBe(calls);expect(JSON.stringify([...fixture.saved])).toBe(saved);
  });
});
