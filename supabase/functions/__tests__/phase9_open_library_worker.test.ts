// Explicit-only OL route and multi-GET execution; recorded HTTP and mocked RPC fixtures.
import {OpenLibraryEditionOptionsAdapter} from '../_shared/imageInventory/metadata/openLibrary';
import {GoogleBooksAdapter} from '../_shared/imageInventory/metadata/googleBooks';
import {runMetadataWorkerBatch} from '../../../workers/phase9-metadata-worker';
import {editionWorkerFixture} from './fixtures/phase9/editionOptionsWorker';

function setup(verifiedGoogle=true) {
 const fixture=editionWorkerFixture();
 fixture.current().providerPolicies=[...(fixture.current().providerPolicies as unknown[]),{
  adapterKey:'open_library',adapterVersion:'1.0.0',enabled:true,matchingAllowed:true,
  storageAllowed:true,reuseAllowed:true,policyVersion:1,
 }];
 const urls:URL[]=[];
 const adapter=new OpenLibraryEditionOptionsAdapter({
  timeoutMs:1000,maxResponseBytes:64000,fetcher:async address=>{
   const url=new URL(String(address));urls.push(url);
   const raw=url.pathname==='/search.json'?{docs:[{key:'/works/OL1W'}]}
    :url.pathname.endsWith('/editions.json')?{entries:[{key:'/books/OL100M',title:'The Fixture Book',
     authors:[{key:'/authors/OL1A'}],languages:[{key:'/languages/eng'}],isbn_13:['9780306406157'],
     covers:[123]}]}:{key:'/authors/OL1A',name:'Fixture Author'};
   return new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});
  },
 });
 let receipts=0;
 const rpc=async(name:string,p:Record<string,unknown>)=>{
  if(name==='phase9_register_edition_options_provider_call_v1'){
   fixture.calls.push({name,parameters:p});receipts++;
   return {data:{provider_call_id:'ol-'+receipts,status:'registered'},error:null};
  }
  if((name==='phase9_finalize_metadata_provider_call' || name==='phase9_finalize_edition_options_provider_call_v1') && String(p.p_provider_call_id).startsWith('ol-')){
   fixture.calls.push({name,parameters:p});return {data:{status:'finalized'},error:null};
  }
  if(name==='phase9_finish_edition_primary_for_fallback_v1'){
   fixture.calls.push({name,parameters:p});return {data:{status:'completed'},error:null};
  }
  return fixture.dependencies.serviceClient.rpc(name,p);
 };
 const unverified=new GoogleBooksAdapter({mode:'real',apiKey:'fixture',timeoutMs:1000,maxResponseBytes:64000,
  fetcher:async()=>{throw new Error('Unverified Google must not be called');}});
 const dependencies={...fixture.dependencies,serviceClient:{rpc},editionFallback:adapter,
  primary:verifiedGoogle?fixture.adapter:unverified};
 return {fixture,dependencies,urls,run:()=>runMetadataWorkerBatch(1,dependencies)};
}
it('routes directly to independently permitted OL when Google retention is unconfigured',async()=>{
 const f=setup(false);expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
 expect(f.urls.map(url=>url.pathname)).toEqual(['/search.json','/works/OL1W/editions.json','/authors/OL1A.json']);
 expect(f.fixture.stats().providerRequests).toBe(0);
 expect(f.fixture.calls.filter(call=>call.name==='phase9_register_edition_options_provider_call_v1')
  .map(call=>[call.parameters.p_call_sequence,call.parameters.p_call_stage])).toEqual([[0,'search'],[1,'editions'],[2,'author:OL1A']]);
 expect(f.fixture.saved.get('candidate-1')?.rows[0].metadata?.adapterKey).toBe('open_library');
});
it('keeps verified Google results preferred and makes no OL GET',async()=>{
 const f=setup();expect((await f.run()).results[0].outcome).toBe('edition_options_available');
 expect(f.fixture.stats().providerRequests).toBe(1);expect(f.urls).toEqual([]);
});
it('falls back after a permitted Google 503 with a real secondary attempt',async()=>{
 const f=setup();f.fixture.controls.status=503;
 expect((await f.run()).results[0].outcome).toBe('edition_options_available');
 expect(f.fixture.calls.some(call=>call.name==='phase9_finish_edition_primary_for_fallback_v1'
  && call.parameters.p_outcome==='provider_unavailable')).toBe(true);
 expect(f.fixture.calls.some(call=>call.name==='phase9_register_structural_metadata_attempt'
  && call.parameters.p_provider_role==='secondary' && call.parameters.p_adapter_key==='open_library')).toBe(true);
 expect(f.urls).toHaveLength(3);
});
it('does not fall through Google policy denial or use disabled OL',async()=>{
 const denied=setup();denied.fixture.controls.permission=false;
 expect((await denied.run()).results[0].outcome).toBe('manual_metadata_required');expect(denied.urls).toEqual([]);
 const disabled=setup(false);(disabled.fixture.current().providerPolicies as Array<Record<string,unknown>>)[1].enabled=false;
 expect((await disabled.run()).results[0].outcome).toBe('manual_metadata_required');expect(disabled.urls).toEqual([]);
});
it('an automatic card uses its existing Google local match, with no OL request',async()=>{
 const f=setup(false);f.fixture.current().purpose='automatic';f.fixture.current().candidateState='processing';
 f.fixture.current().localCanonicalEditionId='local-winner';
 expect((await f.run()).results[0].outcome).toBe('local_canonical_match');expect(f.urls).toEqual([]);
});
it('stops further OL GETs when a new generation supersedes the card between requests',async()=>{
 const f=setup(false);let reads=0;
 f.fixture.controls.beforeContextRead=()=>{reads++;if(reads===4)f.fixture.current().requestGeneration=1;};
 await f.run();expect(f.urls.length).toBeLessThanOrEqual(1);expect(f.fixture.saved.size).toBe(0);
});
