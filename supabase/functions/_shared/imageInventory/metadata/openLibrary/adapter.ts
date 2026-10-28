import type { MetadataProviderAdapter, MetadataProviderOutcome } from '../providerAdapter';
import type { EditionOptionsProviderResult } from '../contracts';
import type { OptionsRetentionEvidence } from '../../contracts/ownerEditionPicker';
import { boundOptionsRetentionEvidence, resolveOptionsDeadline } from '../googleBooks/editionOptions';
import { OPEN_LIBRARY_HOST_POLICY, normalizeOpenLibraryRows, object, hasSafeOpenLibraryFacts, openLibraryIdentityPriority,
  openLibraryRowAuthorKeys } from './normalizer';
import { getOpenLibraryJson, OpenLibraryFailure } from './transport';
import type { OpenLibraryConfiguration, EditionHttpHooks } from './transport';
import { normalizeOpenLibraryCompanions } from './catalogueWrite';
import { normalizeIsbnClue } from '../../domain/isbn';

// Picker §§4/8/13.2: basic bibliographic facts only; no raw payload/prose/image retention.
export class OpenLibraryEditionOptionsAdapter implements MetadataProviderAdapter {
  readonly normalizedEditionHostPolicy=OPEN_LIBRARY_HOST_POLICY;
  readonly optionsRetentionConfigured=true;
  constructor(private readonly configuration:OpenLibraryConfiguration) {}
  async lookup():Promise<MetadataProviderOutcome> {
    throw new Error('P9_OPEN_LIBRARY_AUTOMATIC_LOOKUP_FORBIDDEN');
  }
  async lookupEditionOptions(input:Parameters<MetadataProviderAdapter['lookup']>[0] & {
    httpHooks?:EditionHttpHooks;
  }):Promise<EditionOptionsProviderResult> {
    const failed=(outcome:EditionOptionsProviderResult['outcome'],retryable=false):EditionOptionsProviderResult=>
      ({outcome,retryable,rows:[],fetchedAt:null,retentionEvidence:null,providerRequestId:null});
    if (input.signal.aborted) return failed('cancelled');
    if (this.configuration.retentionAllowed === false) return failed('policy_denied');
    const fetchedAt=new Date().toISOString();
    let retention:OptionsRetentionEvidence={storagePermissionVerified:true,
      permittedDeadlineAt:new Date(Date.parse(fetchedAt)+86_400_000).toISOString()};
    let sequence=0;
    const get=async (url:URL,stage:string) => {
      if (sequence>=6) throw new OpenLibraryFailure('schema_invalid');
      const envelope=await getOpenLibraryJson(url,this.configuration,
        {sequence:sequence++,stage,signal:input.signal},input.httpHooks);
      const bounded=boundOptionsRetentionEvidence(fetchedAt,retention,envelope.headers);
      retention=bounded; return object(envelope.raw);
    };
    try {
      const isbnMode=input.query.strategy === 'isbn';
      if (isbnMode && !input.query.normalizedIsbn13) return failed('no_acceptable_match');
      const search=new URL('https://openlibrary.org/search.json');
      search.searchParams.set('limit','1');search.searchParams.set('fields',isbnMode
        ? 'key,author_key,editions,editions.key,editions.isbn' : 'key,author_key');
      if (input.query.normalizedTitle) search.searchParams.set('title',input.query.normalizedTitle);
      if (input.query.normalizedAuthors.length) search.searchParams.set('author',input.query.normalizedAuthors.join(' '));
      if (!input.query.normalizedTitle && input.query.normalizedIsbn13) search.searchParams.set('isbn',input.query.normalizedIsbn13);
      const found=await get(search,'search');
      if (!found || !Array.isArray(found.docs) || found.docs.length>1) throw new OpenLibraryFailure('malformed_response');
      const key=object(found.docs[0])?.key;
      if (found.docs.length===0) return {outcome:'no_acceptable_match',retryable:false,rows:[],fetchedAt,
        retentionEvidence:retention,providerRequestId:null};
      if (typeof key !== 'string' || !/^\/works\/OL[1-9][0-9]*W$/u.test(key)) throw new OpenLibraryFailure('malformed_response');
      // The work's author references, used only by editions that list no authors of their own.
      const workKeys=object(found.docs[0])?.author_key;
      const workAuthors=Array.isArray(workKeys) && workKeys.length<=20
        && workKeys.every(value=>typeof value==='string' && /^OL[1-9][0-9]*A$/u.test(value))
        ? workKeys.map(value=>'/authors/'+value) : [];
      let page:Record<string,unknown> | null;
      if (isbnMode) {
        const matches=object(object(found.docs[0])?.editions)?.docs;
        const matching=Array.isArray(matches) ? matches.find(value=>{
          const entry=object(value);
          return typeof entry?.key === 'string' && /^\/books\/OL[1-9][0-9]*M$/u.test(entry.key)
            && Array.isArray(entry.isbn) && entry.isbn.some(value=>typeof value === 'string'
              && normalizeIsbnClue(value).isbn13 === input.query.normalizedIsbn13);
        }) : null;
        if (!matching) return {outcome:'no_acceptable_match',retryable:false,rows:[],fetchedAt,
          retentionEvidence:retention,providerRequestId:null};
        page={entries:[await get(new URL('https://openlibrary.org'+matching.key+'.json'),'edition')]};
      } else {
        const editions=new URL('https://openlibrary.org'+key+'/editions.json');
        editions.searchParams.set('limit','10');
        page=await get(editions,'editions');
      }
      if (!page || !Array.isArray(page.entries) || page.entries.length>10) throw new OpenLibraryFailure('malformed_response');
      const authors=new Map<string,string>();
      const keys=new Set<string>();
      // Resolve plausible identities first; the returned/displayed positions stay untouched.
      const safe = page.entries.filter(entry => hasSafeOpenLibraryFacts(entry,workAuthors));
      // Known-language identities first, then unknown-language ones, each in page order.
      const priority = (entry: unknown) => openLibraryIdentityPriority(entry,input.query,workAuthors);
      const preferred = [...safe.filter(entry => priority(entry) === 0), ...safe.filter(entry => priority(entry) === 1)];
      for (const entry of [...preferred,...safe]) {
        const references=openLibraryRowAuthorKeys(entry,workAuthors);
        if (!references) continue;
        const needed=new Set(references);
        // Admit the whole row only when all unresolved names fit; never spend a slot on a partial row.
        if ([...needed].filter(key=>!keys.has(key)).length>4-keys.size) continue;
        for (const key of needed) keys.add(key);
      }
      // Four unique author GETs at most. Rows needing unresolved authors remain unavailable.
      for (const key of keys) {
        try {
          const author=await get(new URL('https://openlibrary.org'+key+'.json'),'author:'+key.slice(9));
          if (author?.key===key && typeof author.name==='string' && author.name.length<=256 && author.name.trim()) {
            authors.set(key,author.name);
          }
        } catch(error) {
          // Known nonretryable author-content failures affect dependent rows; transport/config/fence failures still stop.
          if (!(error instanceof OpenLibraryFailure) || error.retryable || !['no_acceptable_match','malformed_response','unsupported_content_type','response_too_large'].includes(error.outcome)) throw error;
        }
      }
      const rows=normalizeOpenLibraryRows(page.entries,authors,{
        correlationId:input.correlationId,attemptId:input.attemptId,fetchedAt,
      },input.query,workAuthors);
      const eligible=rows.filter(row=>row.eligibility==='eligible');
      const strong=eligible.some(row=>row.metadata?.matchRationale==='exact_validated_isbn');
      return {outcome:strong?'coherent_match':eligible.length?'ambiguous_match':'no_acceptable_match',
        rows,catalogueCompanions:normalizeOpenLibraryCompanions(page.entries,rows,key),fetchedAt,
        retentionEvidence:resolveOptionsDeadline(fetchedAt,retention)?retention:null,
        retryable:false,providerRequestId:null};
    } catch(error) {
      if (!(error instanceof OpenLibraryFailure)) throw error; // Persistence/fence failures belong to the worker.
      return failed(error.outcome,error.retryable);
    }
  }
}
