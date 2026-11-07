// Explicit-only OL route and multi-GET execution; recorded HTTP and mocked RPC fixtures.
import {OpenLibraryEditionOptionsAdapter} from '../_shared/imageInventory/metadata/openLibrary';
import {GoogleBooksAdapter} from '../_shared/imageInventory/metadata/googleBooks';
import {runMetadataWorkerBatch} from '../../../workers/phase9-metadata-worker';
import {editionWorkerFixture, CANDIDATE_ID, UUID_CANDIDATE_ID, createdFixtures} from './fixtures/phase9/editionOptionsWorker';
import {installedProviderDescriptors, providerConfigurationRow, providerConfigurationSnapshot}
 from './fixtures/phase9/providerConfiguration';
import {buildMetadataQueryIdentity} from '../_shared/imageInventory/metadata/queryIdentity';
import recordedIsbn from './fixtures/phase9/openLibraryIsbnResponses.json';
import { runDescriptorWorker, installedManifest, observedInstalledManifest } from './support/providerModules';
import { OL_V1_EXPLICIT_V1, GOLDEN_CLOCK, GOLDEN_LOOKUP_ID, GOLDEN_ATTEMPT_ID } from './fixtures/phase9/providerReplacementGoldens';
import { decodeMetadataJobContext } from '../_shared/imageInventory/runtime/metadataJobContext';
import { editionOptionsFence } from '../_shared/imageInventory/runtime/metadataEditionOptionsBoundary';
import { TEST_ONLY_PROTECTION_POLICY } from './support/providerProtection';

afterEach(() => {
  for (const fixture of createdFixtures.splice(0)) {
    expect(fixture.admissions.unknownBindingCount()).toBe(0);
  }
});


function setup(verifiedGoogle=true,isbnMode=false) {
 const fixture=editionWorkerFixture();
 if(isbnMode)Object.assign(fixture.current(),{title:'',authors:[],language:'und',
  isbnClue:'9780306406157',inputId:null,observationId:null,
  queryIdentity:buildMetadataQueryIdentity({strategy:'isbn',title:'',authors:[],
   isbnClue:'9780306406157',language:'und',editionClues:[]}).key});
 fixture.current().providerPolicies=[...(fixture.current().providerPolicies as unknown[]),{
  adapterKey:'open_library',adapterVersion:'1.0.0',enabled:true,matchingAllowed:true,
  storageAllowed:true,reuseAllowed:true,policyVersion:1,
 }];
 const urls:URL[]=[];
 const adapter=new OpenLibraryEditionOptionsAdapter({
  timeoutMs:1000,maxResponseBytes:64000,fetcher:async address=>{
   const url=new URL(String(address));urls.push(url);
   if(isbnMode)return new Response(JSON.stringify(url.pathname==='/search.json'?recordedIsbn.search
    :url.pathname==='/books/OL100M.json'?recordedIsbn.edition:recordedIsbn.author),
    {headers:{'content-type':'application/json'}});
   const raw=url.pathname==='/search.json'?{docs:[{key:'/works/OL1W'}]}
    :url.pathname.endsWith('/editions.json')?{entries:[{key:'/books/OL100M',title:'The Fixture Book',
     authors:[{key:'/authors/OL1A'}],languages:[{key:'/languages/eng'}],isbn_13:['9780306406157'],
     covers:[123]}]}:{key:'/authors/OL1A',name:'Fixture Author'};
   return new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});
  },
 });
 let receipts=0;
 const olCallIds=new Set<string>();
 const rpc=async(name:string,p:Record<string,unknown>)=>{
  if(name==='phase9_register_edition_options_provider_call_v1'){
   fixture.calls.push({name,parameters:p});receipts++;
   const providerCallId=`00000000-0000-4000-8000-${String(receipts).padStart(12,'0')}`;
   olCallIds.add(providerCallId);
   return {data:{provider_call_id:providerCallId,status:'registered',grant_epoch:1},error:null};
  }
  if((name==='phase9_finalize_metadata_provider_call' || name==='phase9_finalize_edition_options_provider_call_v1')
   && olCallIds.has(String(p.p_provider_call_id))){
   fixture.calls.push({name,parameters:p});
   return {data:{status:String(p.p_status ?? 'finalized'),provider_call_id:p.p_provider_call_id},error:null};
  }
  if(name==='phase9_finish_edition_primary_for_fallback_v1'){
   fixture.calls.push({name,parameters:p});return {data:{status:'completed'},error:null};
  }
  return fixture.dependencies.serviceClient.rpc(name,p);
 };
 const unverified=new GoogleBooksAdapter({mode:'real',apiKey:'fixture',timeoutMs:1000,maxResponseBytes:64000,
  fetcher:async()=>{throw new Error('Unverified Google must not be called');}});
 const dependencies={...fixture.dependencies,serviceClient:{rpc:fixture.admissions.wrap(rpc)},editionFallback:adapter,
  primary:verifiedGoogle?fixture.adapter:unverified};
 return {fixture,dependencies,urls,run:()=>runMetadataWorkerBatch(1,dependencies)};
}
const postSwitch = () => providerConfigurationSnapshot([
 providerConfigurationRow('google_books','1.0.0',{
  enabled:false,matchingAllowed:false,storageAllowed:false,
  automaticLookupAllowed:false,automaticRole:null,automaticOrder:null,
  explicitSearchAllowed:false,explicitRole:null,explicitOrder:null,
 }),
 providerConfigurationRow('open_library','2.0.0',{
  automaticLookupAllowed:false,automaticRole:null,automaticOrder:null,
  explicitSearchAllowed:true,explicitRole:'primary',explicitOrder:1,
  protectionPolicy:TEST_ONLY_PROTECTION_POLICY,
 }),
]);
const switchDependencies = (f:ReturnType<typeof setup>) => {
 const baseRpc=f.dependencies.serviceClient.rpc;
 return {...f.dependencies,serviceClient:{rpc:f.fixture.admissions.wrap(async(name:string,p:Record<string,unknown>)=>
  name==='phase9_provider_configuration_v1'?{data:postSwitch(),error:null}:baseRpc(name,p))}};
};
// One observation point for every installed-descriptor GET, whichever HTTP
// transport the worker chooses; zero-egress resumes must show an empty log.
const observe = (manifest=installedManifest()) => {
 const gets:Array<{url?:URL;stage?:string;sequence?:number}>=[]; 
 return { gets, installed: observedInstalledManifest(manifest, call=>gets.push(call)) };
};
it('dispatches a fresh explicit request through the real installed v2 descriptor with Google off',async()=>{
 const f=setup(false);f.fixture.useUuidLineage();
 f.fixture.current().providerPolicies=[...(f.fixture.current().providerPolicies as unknown[]),{
  adapterKey:'open_library',adapterVersion:'2.0.0',enabled:true,matchingAllowed:true,
  storageAllowed:true,reuseAllowed:true,policyVersion:1,
 }];
 // The real transport is observable whichever HTTP injection 8b chooses.
 const fetched=jest.spyOn(globalThis,'fetch').mockImplementation(async address=>{
  const url=new URL(String(address)); f.urls.push(url);
  const raw=url.pathname==='/search.json'?{docs:[{key:'/works/OL1W'}]}
   :url.pathname.endsWith('/editions.json')?{entries:[{key:'/books/OL100M',title:'The Fixture Book',
    authors:[{key:'/authors/OL1A'}],languages:[{key:'/languages/eng'}],isbn_13:['9780306406157'],covers:[123]}]}
   :{key:'/authors/OL1A',name:'Fixture Author'};
  return new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});
 });
 try{
  const transport=observe();
  const result=await runDescriptorWorker(switchDependencies(f),transport.installed);
  expect(result.results).toEqual([{outcome:'edition_options_available'}]);
  expect(f.fixture.saved.get(UUID_CANDIDATE_ID)?.rows[0].metadata).toMatchObject({
   adapterKey:'open_library',adapterVersion:'2.0.0',
  });
  expect(f.urls.map(url=>url.hostname)).toEqual(['openlibrary.org','openlibrary.org','openlibrary.org']);
  expect(f.fixture.stats().providerRequests).toBe(0);
  expect(transport.gets.map(call=>call.stage)).toEqual(['search','editions','author:OL1A']);
 }finally{fetched.mockRestore();}
});

it.each(['1.0.0','2.0.0'])('recovers complete saved %s explicit lineage after v2 activation without a new attempt or GET',async version=>{
 jest.useFakeTimers();jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
 try{
  const f=setup(false);f.fixture.useUuidLineage();
  if(version==='2.0.0')f.fixture.current().providerPolicies=[
   ...(f.fixture.current().providerPolicies as Array<Record<string,unknown>>).filter(row=>row.adapterKey!=='open_library'),
   {adapterKey:'open_library',adapterVersion:'2.0.0',enabled:true,matchingAllowed:true,
    storageAllowed:true,reuseAllowed:true,policyVersion:1},
  ];
  Object.assign(f.fixture.current(),{
   currentLookupId:GOLDEN_LOOKUP_ID,currentLookupAdapterKey:'open_library',currentLookupAdapterVersion:version,
   currentAttemptId:GOLDEN_ATTEMPT_ID,currentAttemptAdapterKey:'open_library',
   currentAttemptDisposition:'rejected',currentAttemptOutcome:'coherent_match',
   currentAttemptCandidate:null,currentAttemptProviderRequestId:null,
   currentPhysicalStatus:'finalized',currentPhysicalClaimAttempt:1,
   currentPhysicalOutcome:'coherent_match',currentPhysicalLogicalOutcome:'coherent_match',
   currentPhysicalRetryable:false,currentPhysicalCandidate:null,currentPhysicalEvidence:[],
   currentPhysicalProviderRequestId:null,
  });
  const rows=OL_V1_EXPLICIT_V1.rows.map(row=>({...row,metadata:{...row.metadata,adapterVersion:version}}));
  const companions=OL_V1_EXPLICIT_V1.catalogueCompanions.map(row=>({...row,adapterVersion:version}));
  const saved={...editionOptionsFence(decodeMetadataJobContext(f.fixture.current()),f.dependencies.workerId),
   lookupId:GOLDEN_LOOKUP_ID,attemptId:GOLDEN_ATTEMPT_ID,
   sourceFetchedAt:OL_V1_EXPLICIT_V1.fetchedAt,optionsExpiresAt:OL_V1_EXPLICIT_V1.retentionEvidence.permittedDeadlineAt,
   storagePermissionVerified:true as const,rows,catalogueCompanions:companions};
  f.fixture.saved.set(UUID_CANDIDATE_ID,saved as never);
  const before=JSON.stringify(saved);
  const recover=jest.spyOn(f.fixture.boundary,'recover');
  const transport=observe();
  const result=await runDescriptorWorker(switchDependencies(f),transport.installed);
  expect(result.results).toEqual([{outcome:'edition_options_available'}]);
  expect(recover).toHaveBeenCalledWith(expect.objectContaining({requestId:f.fixture.current().jobId,requestGeneration:0}));
  expect(JSON.stringify(f.fixture.saved.get(UUID_CANDIDATE_ID))).toBe(before);
  expect(f.urls).toEqual([]);expect(f.fixture.stats().providerRequests).toBe(0);
  expect(transport.gets).toEqual([]);
  expect(f.fixture.calls.map(call=>call.name)).not.toContain('phase9_register_structural_metadata_attempt');
 }finally{jest.useRealTimers();}
});

it('recovers an unknown-send v1 lineage under a new claim without refetching or creating a v2 attempt',async()=>{
 const f=setup(false);f.fixture.useUuidLineage();
 Object.assign(f.fixture.current(),{
  attempt:2,claimToken:'b'.repeat(64),
  currentLookupId:GOLDEN_LOOKUP_ID,currentLookupAdapterKey:'open_library',currentLookupAdapterVersion:'1.0.0',
  currentAttemptId:GOLDEN_ATTEMPT_ID,currentAttemptAdapterKey:'open_library',
  currentAttemptDisposition:'unresolved',currentAttemptOutcome:null,currentAttemptCandidate:null,
  currentAttemptProviderRequestId:null,currentPhysicalStatus:'outcome_unknown',currentPhysicalClaimAttempt:1,
  currentPhysicalOutcome:'network_failure',currentPhysicalLogicalOutcome:'network_failure',
  currentPhysicalRetryable:true,currentPhysicalCandidate:null,currentPhysicalEvidence:[],currentPhysicalProviderRequestId:null,
 });
 const transport=observe();
 await runDescriptorWorker(switchDependencies(f),transport.installed);
 expect(f.urls).toEqual([]);expect(f.fixture.stats().providerRequests).toBe(0);
 expect(transport.gets).toEqual([]);
 expect(f.fixture.calls.map(call=>call.name)).not.toContain('phase9_register_structural_metadata_attempt');
 expect(f.fixture.saved.size).toBe(0);
});

it('refuses explicit search in the real worker when the registry gives Google no explicit role and OL is disabled',async()=>{
 const f=setup(false);f.fixture.useUuidLineage();
 const rpc=async(name:string,parameters:Record<string,unknown>)=>{
  if(name==='phase9_provider_configuration_v1'){
   return {data:providerConfigurationSnapshot([
    providerConfigurationRow('google_books','1.0.0',{
     explicitSearchAllowed:false,explicitRole:null,explicitOrder:null,
    }),
    providerConfigurationRow('open_library','1.0.0',{
     enabled:false,matchingAllowed:false,storageAllowed:false,explicitSearchAllowed:false,
     explicitRole:null,explicitOrder:null,
    }),
   ]),error:null};
  }
  return f.dependencies.serviceClient.rpc(name,parameters);
 };
 const transport=observe();
 const result=await runDescriptorWorker({...f.dependencies,serviceClient:{rpc}},transport.installed);
 expect(result.results).toEqual([{outcome:'manual_metadata_required'}]);
 expect(f.urls).toEqual([]);
 expect(transport.gets).toEqual([]);
});
it('routes directly to independently permitted OL when Google retention is unconfigured',async()=>{
 const f=setup(false);expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
 expect(f.urls.map(url=>url.pathname)).toEqual(['/search.json','/works/OL1W/editions.json','/authors/OL1A.json']);
 expect(f.fixture.stats().providerRequests).toBe(0);
 expect(f.fixture.calls.filter(call=>call.name==='phase9_register_edition_options_provider_call_v1')
  .map(call=>[call.parameters.p_call_sequence,call.parameters.p_call_stage])).toEqual([[0,'search'],[1,'editions'],[2,'author:OL1A']]);
 expect(f.fixture.saved.get(CANDIDATE_ID)?.rows[0].metadata?.adapterKey).toBe('open_library');
});
it('runs a hand-added ISBN card through worker fencing and direct-edition HTTP stages (slice 5 §6)',async()=>{
 const f=setup(false,true);
 expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
 expect(f.urls.map(url=>url.pathname)).toEqual(['/search.json','/books/OL100M.json','/authors/OL1A.json']);
 expect(f.fixture.calls.filter(call=>call.name==='phase9_register_edition_options_provider_call_v1')
  .map(call=>[call.parameters.p_call_sequence,call.parameters.p_call_stage]))
  .toEqual([[0,'search'],[1,'edition'],[2,'author:OL1A']]);
 expect(f.fixture.saved.get(CANDIDATE_ID)?.rows[0]).toMatchObject({ordinal:0,
  eligibility:'eligible',metadata:{isbn13:'9780306406157',language:'fr'}});
});
it('runs a hand-added title card through existing worker context and author stages (slice 5 AC5a-17)',async()=>{
 const f=setup(false);Object.assign(f.fixture.current(),{inputId:null,observationId:null});
 expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
 expect(f.urls.map(url=>url.pathname)).toEqual(['/search.json','/works/OL1W/editions.json','/authors/OL1A.json']);
});
it('fetches the exact edition for a scanned card with only an ISBN clue (slice 5 AC5a-20)',async()=>{
 const f=setup(false,true);Object.assign(f.fixture.current(),{inputId:'input-1',observationId:'observation-1'});
 expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
 expect(f.urls[1].pathname).toBe('/books/OL100M.json');
 expect(f.fixture.saved.get(CANDIDATE_ID)?.rows).toHaveLength(1);
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
it('an automatic card uses its existing Google local match, with no descriptor GET',async()=>{
 const f=setup(false);f.fixture.current().purpose='automatic';f.fixture.current().candidateState='processing';
 f.fixture.current().localCanonicalEditionId='local-winner';
 const transport=observe();
 const result=await runDescriptorWorker(f.dependencies,transport.installed);
 expect(result.results[0].outcome).toBe('local_canonical_match');
 expect(f.urls).toEqual([]);expect(transport.gets).toEqual([]);
});
it('stops further OL GETs when a new generation supersedes the card between requests',async()=>{
 const f=setup(false);let reads=0;
 f.fixture.controls.beforeContextRead=()=>{reads++;if(reads===4)f.fixture.current().requestGeneration=1;};
 await f.run();expect(f.urls.length).toBeLessThanOrEqual(1);expect(f.fixture.saved.size).toBe(0);
});
