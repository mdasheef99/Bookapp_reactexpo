// Picker §13.14: actual monotonic GET starts, production factory and shared default limiter.
// Fixture HTTP only: no provider, credentials, shared database, deployment or browser access.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createMetadataProductionDependencies} from '../../../.phase9-dist/workers/phase9-metadata-worker/bootstrap.js';
import {buildMetadataQueryIdentity} from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/queryIdentity.js';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('compiled production OL factory spaces eighteen actual GETs from three concurrent jobs',async()=>{
 const starts=[],finalized=[];
 const fetcher=async address=>{
  const url=new URL(String(address));assert.equal(url.origin,'https://openlibrary.org');
  starts.push({at:performance.now(),path:url.pathname});
  const raw=url.pathname==='/search.json'?{docs:[{key:'/works/OL1W'}]}
   :url.pathname.endsWith('/editions.json')?{entries:[{key:'/books/OL100M',title:'The Fixture Book',
     authors:[1,2,3,4].map(id=>({key:'/authors/OL'+id+'A'})),languages:[{key:'/languages/eng'}],isbn_13:['9780306406157']}]}
   :{key:url.pathname.replace(/\.json$/u,''),name:url.pathname.includes('OL1A')?'Fixture Author':'Fixture Contributor'};
  return new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});
 };
 const dependencies=createMetadataProductionDependencies({providerMode:'real',apiKey:'fixture-unused',
  timeoutMs:2000,maxResponseBytes:64000},fetcher);
 assert.ok(dependencies.editionFallback);
 const query=buildMetadataQueryIdentity({strategy:'bibliographic',title:'The Fixture Book',
  authors:['Fixture Author'],isbnClue:'9780306406157',language:'en',editionClues:[]});
 const results=await Promise.all([1100,20,0].map((delay,job)=>dependencies.editionFallback.lookupEditionOptions({
  query,correlationId:'fixture-lookup-'+job,attemptId:'fixture-attempt-'+job,signal:new AbortController().signal,
  httpHooks:{beforeRequest:async call=>{if(call.sequence===0)await sleep(delay);},
   afterRequest:async call=>finalized.push({...call,job})},
 })));
 assert.equal(starts.length,18);assert.equal(finalized.length,18);
 assert.ok(finalized.every(call=>call.egressStarted && call.physicalStatus==='finalized'));
 for(const result of results){assert.equal(result.rows.length,1);assert.equal(result.rows[0].eligibility,'eligible');}
 const gaps=starts.slice(1).map((entry,index)=>entry.at-starts[index].at);
 assert.ok(gaps.every(gap=>gap>=1000),'every actual start must be at least one second after the preceding start');
 console.log('OL_REQUEST_SPACING '+JSON.stringify({jobs:3,gets:18,minGapMs:Math.min(...gaps),
  maxGapMs:Math.max(...gaps),intervalMs:1000,googleGets:0}));
});
