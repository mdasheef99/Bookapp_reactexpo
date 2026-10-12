// Owner picker SDD §§4.1/5/8/9 and approved Open Library fallback amendment.
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import {OpenLibraryEditionOptionsAdapter} from '../_shared/imageInventory/metadata/openLibrary/adapter';
import {getOpenLibraryJson,createOpenLibraryRateLimiter} from '../_shared/imageInventory/metadata/openLibrary/transport';
const query = (extra = {}) => buildMetadataQueryIdentity({
  strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
  isbnClue: '9780306406157', language: 'en', editionClues: [], ...extra,
});
const edition = (extra = {}) => ({
  key: '/books/OL100M', title: 'The Fixture Book', authors: [{ key: '/authors/OL1A' }],
  languages: [{ key: '/languages/eng' }], isbn_10: ['0306406152'], isbn_13: ['9780306406157'],
  publish_date: '2024-03', publishers: ['Fixture Press'], covers: [123, -1], ...extra,
});
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});
function subject(entries = [edition()], overrides: Record<string, unknown> = {}) {
  expect(OpenLibraryEditionOptionsAdapter).toEqual(expect.any(Function));
  const requests: URL[] = [];
  const fetcher = jest.fn(async (address: string | URL | Request) => {
    const url = new URL(address instanceof Request ? address.url : String(address)); requests.push(url);
    if (url.pathname === '/search.json') return response({ docs: [
      { key: '/works/OL1W', title: 'The Fixture Book', author_name: ['WRONG WORK AUTHOR'] },
    ] });
    if (url.pathname === '/works/OL1W/editions.json') return response({ entries });
    if (url.pathname === '/authors/OL1A.json') return response({ key: '/authors/OL1A', name: 'Fixture Author' });
    return response({}, 404);
  });
  return { requests, fetcher, adapter: new OpenLibraryEditionOptionsAdapter({
    fetcher, timeoutMs: 1000, maxResponseBytes: 64_000,
    ...overrides,
  }) };
}
function input(identity = query()) {
  return { query: identity, correlationId: 'lookup-1', attemptId: 'attempt-1',
    signal: new AbortController().signal };
}
beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});
describe('Open Library explicit edition options', () => {
  it('reads bounded edition records and their own authors, cover and publication fields', async () => {
    const { adapter, requests } = subject();
    const result = await adapter.lookupEditionOptions(input());
    expect(requests.map(url => url.pathname)).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
    expect(requests[0].searchParams.get('limit')).toBe('1');
    expect(requests[1].searchParams.get('limit')).toBe('10');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ ordinal: 0, eligibility: 'eligible',
      googleBooksUrl: 'https://openlibrary.org/books/OL100M',
      metadata: { adapterKey: 'open_library', providerRecordId: 'OL100M', title: 'The Fixture Book',
        authors: ['Fixture Author'], publishedDate: '2024-03', publisher: 'Fixture Press',
        language: 'en', isbn13: '9780306406157', coverReference: 'https://covers.openlibrary.org/b/id/123-M.jpg',
        description: null, matchRationale: 'exact_validated_isbn' } });
    expect(result.retentionEvidence!.storagePermissionVerified).toBe(true);
    expect(Date.parse(result.retentionEvidence!.permittedDeadlineAt!) - Date.parse(result.fetchedAt!)).toBe(86_400_000);
  });
  it('keeps ten original positions and fetches a shared edition author once', async () => {
    const { adapter, requests } = subject(Array.from({ length: 10 }, (_, index) => edition({
      key: '/books/OL' + (100 + index) + 'M', publish_date: String(2000 + index),
    })));
    const result = await adapter.lookupEditionOptions(input());
    expect(result.rows.map((row: any) => row.ordinal)).toEqual([0,1,2,3,4,5,6,7,8,9]);
    expect(new Set(result.rows.map((row: any) => row.optionId)).size).toBe(10);
    expect(requests.filter(url => url.pathname.startsWith('/authors/'))).toHaveLength(1);
    expect(result.rows.every((row: any) => row.metadata.matchRationale !== 'exact_validated_isbn')).toBe(true);
  });
  it('retains unavailable positions and never borrows work-level authors or another cover', async () => {
    const { adapter } = subject([edition({ authors: [] }), edition({ key: '/books/OL101M', covers: [-1] })]);
    const result = await adapter.lookupEditionOptions(input());
    expect(result.rows[0]).toMatchObject({ ordinal: 0, eligibility: 'unavailable', metadata: null, googleBooksUrl: null });
    expect(result.rows[1].metadata!.authors).toEqual(['Fixture Author']);
    expect(result.rows[1].metadata!.coverReference).toBeNull();
  });
  it('does not chase a provider-supplied work URL or arbitrary author path', async () => {
    const { adapter, requests } = subject([edition({ authors: [{ key: 'https://evil.invalid/secret' }] })]);
    const result = await adapter.lookupEditionOptions(input());
    expect(result.rows[0].eligibility).toBe('unavailable');
    expect(requests.some(url => url.hostname !== 'openlibrary.org')).toBe(false);
  });
  it('suppresses strong ISBN certainty when another safe row conflicts with identity', async () => {
    const { adapter } = subject([edition(), edition({ key: '/books/OL101M', title: 'Other Book' })]);
    const result = await adapter.lookupEditionOptions(input());
    expect(result.rows[0].metadata!.matchRationale).toBe('confirmation_required_conflicting_isbn_records');
    expect(result.rows[1].eligibility).toBe('ineligible');
  });
  it('accepts an exact ISBN with unknown observed language, while requiring supplied title/author compatibility', async () => {
    const { adapter } = subject();
    const result = await adapter.lookupEditionOptions(input(query({ language: 'und' })));
    expect(result.rows[0].eligibility).toBe('eligible');
  });
  it('rejects conflicting or malformed identifiers rather than silently choosing one', async () => {
    const { adapter } = subject([edition({ isbn_13: ['9999999999999'] })]);
    const result = await adapter.lookupEditionOptions(input());
    expect(result.rows[0].eligibility).toBe('unavailable');
  });
  it('does not invent missing date, publisher, language or covers', async () => {
    const { adapter } = subject([edition({ publish_date: undefined, publishers: [], languages: [], covers: [] })]);
    const result = await adapter.lookupEditionOptions(input());
    expect(result.rows[0].metadata).toMatchObject({ publishedDate: null, publisher: null, language: 'und', coverReference: null });
  });
  it('aborts before any transport call when cancelled', async () => {
    const { adapter, fetcher } = subject(); const controller = new AbortController(); controller.abort();
    const result = await adapter.lookupEditionOptions({ ...input(), signal: controller.signal });
    expect(result.outcome).toBe('cancelled'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('classifies a 503 as retryable and returns no selectable rows', async () => {
    const { adapter } = subject([], { fetcher: async () => response({}, 503) });
    const result = await adapter.lookupEditionOptions(input());
    expect(result).toMatchObject({ outcome: 'provider_unavailable', retryable: true, rows: [], retentionEvidence: null });
  });
  it('denies provider retention when explicit policy evidence is disabled', async () => {
    const { adapter } = subject([edition()], { retentionAllowed: false });
    const result = await adapter.lookupEditionOptions(input());
    expect(result.retentionEvidence).toBeNull();
  });
});

it('reconciles cancellation after registration without sending an HTTP request',async()=>{
 const controller=new AbortController(),fetcher=jest.fn();
 const after=jest.fn(async()=>{});
 await expect(getOpenLibraryJson(new URL('https://openlibrary.org/search.json'),{
  fetcher,timeoutMs:1000,maxResponseBytes:64000,
 },{sequence:0,stage:'search',signal:controller.signal},{
  beforeRequest:async()=>{controller.abort();},afterRequest:after,
 })).rejects.toMatchObject({outcome:'cancelled'});
 expect(fetcher).not.toHaveBeenCalled();
 expect(after).toHaveBeenCalledWith(expect.objectContaining({egressStarted:false,physicalStatus:'stale_rejected'}));
});

it('keeps independently complete editions when another edition author record is missing',async()=>{
 const {adapter,requests}=subject([
  edition({authors:[{key:'/authors/OL2A'}]}),edition({key:'/books/OL101M'}),
 ]);
 const result=await adapter.lookupEditionOptions(input());
 expect(requests.map(url=>url.pathname)).toEqual([
  '/search.json','/works/OL1W/editions.json','/authors/OL2A.json','/authors/OL1A.json',
 ]);
 expect(result.rows).toHaveLength(2);
 expect(result.rows[0]).toMatchObject({ordinal:0,eligibility:'unavailable',metadata:null});
 expect(result.rows[1]).toMatchObject({ordinal:1,eligibility:'eligible',metadata:{authors:['Fixture Author']}});
});

it.each(['title','language','unknown-language-isbn','own-author-budget'] as const)(
 'reserves author GETs for matching editions after earlier %s mismatches without reordering positions',
 async mismatch=>{
  const clues=query({isbnClue:mismatch==='unknown-language-isbn'?'9780306406157':null,
   language:mismatch==='unknown-language-isbn'?'und':'en'});
  const incompatible=mismatch==='title'?{title:'Other Fixture Book'}
   :mismatch==='language'?{languages:[{key:'/languages/fre'}]}
   :mismatch==='unknown-language-isbn'?{isbn_10:undefined,isbn_13:['9780131103627']}:{};
  const entries=[
   ...Array.from({length:7},(_,ordinal)=>edition({key:'/books/OL'+(200+ordinal)+'M',
    ...incompatible,authors:mismatch==='own-author-budget'?[{key:'/authors/OL1A'},{key:'/authors/OL2A'},{key:'/authors/OL3A'},{key:'/authors/OL4A'},{key:'/authors/OL6A'}]:[{key:'/authors/OL1A'},{key:'/authors/OL'+(2+ordinal%3)+'A'}]})),
   edition({key:'/books/OL207M',authors:[{key:'/authors/OL1A'},{key:'/authors/OL5A'}]}),
   edition({key:'/books/OL208M',authors:[{key:'/authors/OL5A'},{key:'/authors/OL1A'}]}),
   edition({key:'/books/OL209M',title:'Other Fixture Book',authors:[{key:'/authors/OL6A'}]}),
  ];
  const requests:URL[]=[];
  const fetcher=async(address:string|URL|Request)=>{
   const url=new URL(address instanceof Request?address.url:String(address));requests.push(url);
   if(url.pathname==='/search.json')return response({docs:[{key:'/works/OL1W'}]});
   if(url.pathname==='/works/OL1W/editions.json')return response({entries});
   const key=url.pathname.replace(/\.json$/u,'');
   return response({key,name:key==='/authors/OL1A'?'Fixture Author':
    key==='/authors/OL5A'?'Fixture Illustrator':'Other Fixture Author'});
  };
  const {adapter}=subject(entries,{fetcher});
  const result=await adapter.lookupEditionOptions(input(clues));
  expect(result.rows.filter(row=>row.eligibility==='eligible').map(row=>row.ordinal)).toEqual([7,8]);
  expect(result.rows[7].metadata).toMatchObject({providerRecordId:'OL207M',
   authors:['Fixture Author','Fixture Illustrator'],language:'en'});
  expect(result.rows[8].metadata!.authors).toEqual(['Fixture Illustrator','Fixture Author']);
  expect(result.rows.map(row=>row.ordinal)).toEqual([0,1,2,3,4,5,6,7,8,9]);
  expect(new Set(result.rows.map(row=>row.optionId)).size).toBe(10);
  if (mismatch==='own-author-budget') {
   expect(requests.map(url=>url.pathname)).toEqual(['/search.json','/works/OL1W/editions.json',
    '/authors/OL1A.json','/authors/OL5A.json','/authors/OL6A.json']);
  } else expect(requests).toHaveLength(6);
  expect(requests.filter(url=>url.pathname==='/authors/OL5A.json')).toHaveLength(1);
  expect(requests.every(url=>url.origin==='https://openlibrary.org')).toBe(true);
 });

it('does not treat repeated own-author references beyond four entries as five distinct author GETs',async()=>{
 const repeated=[{key:'/authors/OL1A'},{key:'/authors/OL1A'},{key:'/authors/OL1A'},{key:'/authors/OL1A'},{key:'/authors/OL5A'}];
 const entries=[2,3,4].map(id=>edition({title:'Other Fixture Book',authors:[{key:'/authors/OL1A'},{key:'/authors/OL'+id+'A'}]}));
 entries.push(edition({key:'/books/OL105M',authors:repeated}));
 const requests:URL[]=[];
 const fetcher=async(address:string|URL|Request)=>{
  const url=new URL(address instanceof Request?address.url:String(address));requests.push(url);
  if(url.pathname==='/search.json')return response({docs:[{key:'/works/OL1W'}]});
  if(url.pathname==='/works/OL1W/editions.json')return response({entries});
  const key=url.pathname.replace(/\.json$/u,'');
  return response({key,name:key==='/authors/OL1A'?'Fixture Author':
   key==='/authors/OL5A'?'Fixture Illustrator':'Other Fixture Author'});
 };
 const {adapter}=subject(entries,{fetcher});
 const result=await adapter.lookupEditionOptions(input(query({isbnClue:null})));
 expect(result.rows[3]).toMatchObject({ordinal:3,eligibility:'eligible',metadata:{
  authors:['Fixture Author','Fixture Author','Fixture Author','Fixture Author','Fixture Illustrator']}});
 expect(requests).toHaveLength(6);
 expect(requests.filter(url=>url.pathname==='/authors/OL5A.json')).toHaveLength(1);
});

it('spaces actual GET starts across three jobs despite different fresh-fence delays',async()=>{
 jest.useFakeTimers();jest.setSystemTime(0);
 try {
  const starts:number[]=[];
  const waitForRequest=createOpenLibraryRateLimiter();
  const pending=[1100,0,0].map(async fenceDelay=>getOpenLibraryJson(
   new URL('https://openlibrary.org/search.json'),{
    waitForRequest,timeoutMs:1000,maxResponseBytes:64000,
    fetcher:async()=>{starts.push(Date.now());return response({docs:[]});},
   },{sequence:0,stage:'search',signal:new AbortController().signal},{
    beforeRequest:async()=>{if(fenceDelay)await new Promise<void>(resolve=>setTimeout(resolve,fenceDelay));},
    afterRequest:async()=>{},
   }));
  await jest.advanceTimersByTimeAsync(3500);
  await Promise.all(pending);
  expect(starts).toHaveLength(3);
  expect(starts.slice(1).every((start,index)=>start-starts[index]>=1000)).toBe(true);
 } finally {jest.useRealTimers();}
});

it('cancels a queued permit promptly without unlocking past the active fresh-fence holder',async()=>{
 jest.useFakeTimers();jest.setSystemTime(0);
 try {
  const wait=createOpenLibraryRateLimiter(),first=await wait(new AbortController().signal);
  const controller=new AbortController(),cancelled=wait(controller.signal);
  const rejected=expect(cancelled).rejects.toMatchObject({outcome:'cancelled'});
  let acquired=false;
  const next=wait(new AbortController().signal).then(release=>{acquired=true;return release;});
  controller.abort();await rejected;
  await jest.advanceTimersByTimeAsync(5000);expect(acquired).toBe(false);
  first(true);await jest.advanceTimersByTimeAsync(999);expect(acquired).toBe(false);
  await jest.advanceTimersByTimeAsync(1);(await next)(true);expect(acquired).toBe(true);
 } finally {jest.useRealTimers();}
});
it('releases an unsent request slot when the fresh authority hook rejects',async()=>{
 const waitForRequest=createOpenLibraryRateLimiter(),fetcher=jest.fn(async()=>response({docs:[]}));
 const configuration={waitForRequest,fetcher,timeoutMs:1000,maxResponseBytes:64000};
 await expect(getOpenLibraryJson(new URL('https://openlibrary.org/search.json'),configuration,
  {sequence:0,stage:'search',signal:new AbortController().signal},{
   beforeRequest:async()=>{throw new Error('fixture stale authority');},afterRequest:async()=>{},
  })).rejects.toThrow('fixture stale authority');
 expect(fetcher).not.toHaveBeenCalled();
 await getOpenLibraryJson(new URL('https://openlibrary.org/search.json'),configuration,
  {sequence:0,stage:'search',signal:new AbortController().signal});
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it('reconciles post-registration cancellation and releases its unsent permit for another job',async()=>{
 const waitForRequest=createOpenLibraryRateLimiter(),fetcher=jest.fn(async()=>response({docs:[]}));
 const configuration={waitForRequest,fetcher,timeoutMs:1000,maxResponseBytes:64000};
 const controller=new AbortController(),afterRequest=jest.fn(async()=>{});
 await expect(getOpenLibraryJson(new URL('https://openlibrary.org/search.json'),configuration,
  {sequence:0,stage:'search',signal:controller.signal},{
   beforeRequest:async()=>controller.abort(),afterRequest,
  })).rejects.toMatchObject({outcome:'cancelled'});
 expect(fetcher).not.toHaveBeenCalled();
 expect(afterRequest).toHaveBeenCalledWith(expect.objectContaining({egressStarted:false,physicalStatus:'stale_rejected'}));
 await getOpenLibraryJson(new URL('https://openlibrary.org/search.json'),configuration,
  {sequence:0,stage:'search',signal:new AbortController().signal});
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it('releases at HTTP start so an unfinished response does not block the next permitted job',async()=>{
 jest.useFakeTimers();jest.setSystemTime(0);
 try {
  const waitForRequest=createOpenLibraryRateLimiter(),starts:number[]=[];
  let finishFirst!:(response:Response)=>void;
  const firstResponse=new Promise<Response>(resolve=>{finishFirst=resolve;});
  const configuration={waitForRequest,timeoutMs:10000,maxResponseBytes:64000,
   fetcher:jest.fn(async()=>{starts.push(Date.now());return starts.length===1?firstResponse:response({docs:[]});})};
  const first=getOpenLibraryJson(new URL('https://openlibrary.org/search.json'),configuration,
   {sequence:0,stage:'search',signal:new AbortController().signal});
  const second=getOpenLibraryJson(new URL('https://openlibrary.org/search.json'),configuration,
   {sequence:0,stage:'search',signal:new AbortController().signal});
  await jest.advanceTimersByTimeAsync(1000);await second;
  expect(starts).toEqual([0,1000]);finishFirst(response({docs:[]}));await first;
 } finally {jest.useRealTimers();}
});
