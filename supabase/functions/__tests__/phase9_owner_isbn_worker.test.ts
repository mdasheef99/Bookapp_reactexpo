// Typed ISBN SDD §§6/12: real decoder, identity, transport and adapter; fixed JSON only.
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { getOpenLibraryJson } from '../_shared/imageInventory/metadata/openLibrary/transport';
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import { decodeMetadataJobContext } from '../_shared/imageInventory/runtime/metadataJobContext';
import { requestFromMetadataContext } from '../_shared/imageInventory/runtime/metadataProductionGateway';
import { automaticContext, explicitContext } from './fixtures/phase9/editionOptionsWorker';
import recorded from './fixtures/phase9/openLibraryIsbnResponses.json';

const isbn = '9780306406157';
const query = buildMetadataQueryIdentity({strategy:'isbn',title:'',authors:[],
  isbnClue:isbn,language:'und',editionClues:[]});
const response = (body:unknown,status=200) => new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json'},
});
const editionContext = {...explicitContext,title:'',authors:[],isbnClue:isbn,
  language:'und',inputId:null,observationId:null,queryIdentity:query.key};
function fixture(search:unknown=recorded.search,edition:unknown=recorded.edition,inputQuery=query) {
  const urls:URL[]=[],stages:unknown[]=[];
  const fetcher=jest.fn(async(address:string|URL|Request)=>{
    const url=new URL(address instanceof Request?address.url:String(address));urls.push(url);
    if(url.pathname==='/search.json')return response(search);
    if(url.pathname==='/books/OL100M.json')return response(edition);
    if(url.pathname==='/works/OL1W/editions.json')return response({entries:[edition]});
    if(url.pathname==='/authors/OL1A.json')return response(recorded.author);
    return response({},404);
  });
  const adapter=new OpenLibraryEditionOptionsAdapter({fetcher,timeoutMs:1000,maxResponseBytes:64000});
  const run=()=>adapter.lookupEditionOptions({query:inputQuery,correlationId:'lookup-isbn',attemptId:'attempt-isbn',
    signal:new AbortController().signal,httpHooks:{
      beforeRequest:async call=>{stages.push([call.sequence,call.stage]);},afterRequest:async()=>{},
    }});
  return {urls,stages,fetcher,run};
}
beforeAll(()=>{
  if(!globalThis.crypto?.randomUUID)Object.defineProperty(globalThis,'crypto',{
    configurable:true,value:require('node:crypto').webcrypto,
  });
});

describe('typed ISBN edition worker context (AC5a-11/17)',()=>{
  it.each([{title:''},{inputId:null},{observationId:null},
    {title:'',inputId:null,observationId:null}])('accepts explicit-only context relaxation %j',change=>{
    expect(decodeMetadataJobContext({...explicitContext,...change})).toMatchObject(change);
  });
  it('retains a hand-added title search with null scan lineage',()=>{
    const context=decodeMetadataJobContext({...explicitContext,inputId:null,observationId:null});
    expect(requestFromMetadataContext(context).query.strategy).toBe('bibliographic');
  });
  it.each([{title:''},{inputId:null},{observationId:null}])('keeps automatic validation strict %j',change=>{
    expect(()=>decodeMetadataJobContext({...automaticContext,...change})).toThrow('P9_METADATA_CONTEXT_INVALID');
  });
  it.each([{title:null},{title:undefined},{inputId:''},{inputId:undefined},
    {observationId:''},{observationId:123}])('still refuses malformed edition context %j',change=>{
    expect(()=>decodeMetadataJobContext({...explicitContext,...change})).toThrow('P9_METADATA_CONTEXT_INVALID');
  });
  it('rebuilds the ISBN-only identity through the edition context boundary',()=>{
    const request=requestFromMetadataContext(decodeMetadataJobContext(editionContext));
    expect(JSON.parse(request.query.key)).toEqual(['p9-metadata-lookup-v1',
      'p9-bibliographic-normalizer-v1','isbn',isbn,'',[],'und',[]]);
    expect(request.query.strategy).toBe('isbn');
  });
});

describe('exact Open Library ISBN fetch (AC5a-7/8/16c/20/21)',()=>{
  it('returns no acceptable match without HTTP when ISBN strategy has no parsed ISBN',async()=>{
    const f=fixture(recorded.search,recorded.edition,{...query,normalizedIsbn13:null});
    expect(await f.run()).toMatchObject({outcome:'no_acceptable_match',retryable:false,rows:[]});
    expect(f.fetcher).not.toHaveBeenCalled();
    expect(f.stages).toEqual([]);
  });
  it('keeps an empty title with author evidence and an ISBN in bibliographic title mode',async()=>{
    const authorQuery=buildMetadataQueryIdentity({strategy:'isbn',title:'',authors:['Fixture Author'],
      isbnClue:isbn,language:'und',editionClues:[]});
    expect(authorQuery.strategy).toBe('bibliographic');
    const f=fixture(recorded.search,recorded.edition,authorQuery);
    const result=await f.run();
    expect(f.urls.map(url=>url.pathname)).toEqual(['/search.json','/works/OL1W/editions.json','/authors/OL1A.json']);
    expect(f.urls[0].searchParams.get('fields')).toBe('key,author_key');
    expect(f.urls[0].searchParams.get('author')).toBe('fixture author');
    expect(f.stages).toEqual([[0,'search'],[1,'editions'],[2,'author:OL1A']]);
    expect(result.rows).toHaveLength(1);
  });
  it('chooses the matching second edition by normalized ISBN and returns its foreign-language cover',async()=>{
    const f=fixture(),result=await f.run();
    expect(f.urls.map(url=>url.pathname)).toEqual(['/search.json','/books/OL100M.json','/authors/OL1A.json']);
    expect(f.urls[0].searchParams.get('fields')).toBe('key,author_key,editions,editions.key,editions.isbn');
    expect(f.urls[0].searchParams.get('isbn')).toBe(isbn);
    expect(f.urls[0].searchParams.get('limit')).toBe('1');
    expect(f.urls[0].searchParams.has('title')).toBe(false);
    expect(f.stages).toEqual([[0,'search'],[1,'edition'],[2,'author:OL1A']]);
    expect(result).toMatchObject({outcome:'coherent_match',retryable:false});
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ordinal:0,eligibility:'eligible',metadata:{
      providerRecordId:'OL100M',isbn13:isbn,language:'fr',authors:['Fixture Author'],
      coverReference:'https://covers.openlibrary.org/b/id/123-M.jpg',
    }});
  });
  it.each([undefined,{docs:[]},{docs:[{key:'/books/OL101M',isbn:['9780131103627']}]},
    {docs:[{key:'https://evil.invalid/books/OL100M',isbn:[isbn]}]},
    {docs:[{key:'/books/OL100M',isbn:['9780306406158']}]}])(
    'does not fetch a work page or unmatched edition when there is no safe matching key %j',async editions=>{
      const f=fixture({docs:[{key:'/works/OL1W',editions}]}),result=await f.run();
      expect(result).toMatchObject({outcome:'no_acceptable_match',retryable:false,rows:[]});
      expect(f.urls.map(url=>url.pathname)).toEqual(['/search.json']);
    });
  it('refuses a multilingual direct edition as one unavailable ordinal without resolving authors',async()=>{
    const f=fixture(recorded.search,{...recorded.edition,
      languages:[{key:'/languages/eng'},{key:'/languages/fre'}]});
    const result=await f.run();
    expect(result).toMatchObject({outcome:'no_acceptable_match'});
    expect(result.rows).toEqual([expect.objectContaining({ordinal:0,eligibility:'unavailable',metadata:null})]);
    expect(f.urls).toHaveLength(2);
  });
});

describe('Open Library direct edition transport allowlist',()=>{
  const call={sequence:1,stage:'edition',signal:new AbortController().signal};
  it('accepts only the canonical direct book JSON endpoint and keeps redirect:error',async()=>{
    const fetcher=jest.fn(async()=>response(recorded.edition));
    await expect(getOpenLibraryJson(new URL('https://openlibrary.org/books/OL100M.json'),
      {fetcher,timeoutMs:1000,maxResponseBytes:64000},call)).resolves.toMatchObject({raw:recorded.edition});
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL),expect.objectContaining({redirect:'error'}));
  });
  it.each(['/isbn/9780306406157','/books/OL0M.json','/books/OL1W.json',
    '/books/OL100M','/books/OL100M.json/extra'])('refuses %s before egress',async path=>{
    const fetcher=jest.fn();
    await expect(getOpenLibraryJson(new URL('https://openlibrary.org'+path),
      {fetcher,timeoutMs:1000,maxResponseBytes:64000},call)).rejects.toMatchObject({outcome:'insufficient_query'});
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not follow a redirect response from an allowed endpoint',async()=>{
    const fetcher=jest.fn(async()=>new Response(null,{status:302,headers:{location:'https://evil.invalid'}}));
    await expect(getOpenLibraryJson(new URL('https://openlibrary.org/books/OL100M.json'),
      {fetcher,timeoutMs:1000,maxResponseBytes:64000},call)).rejects.toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL),expect.objectContaining({redirect:'error'}));
  });
});
