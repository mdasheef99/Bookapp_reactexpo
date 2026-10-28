import { GoogleBooksAdapter } from '../../../_shared/imageInventory/metadata/googleBooks/adapter';
import { OpenLibraryEditionOptionsAdapter } from '../../../_shared/imageInventory/metadata/openLibrary/adapter';
import { createMetadataEditionOptionsBoundary } from '../../../_shared/imageInventory/runtime/metadataEditionOptionsRpc';
import { runMetadataWorkerBatch } from '../../../../../workers/phase9-metadata-worker';
import { editionWorkerFixture } from './editionOptionsWorker';

// 02b §3.1 and AC7-2f: recorded, bounded provider facts; no network.
const edition = (number: number, extra: Record<string, unknown> = {}) => ({
  key: `/books/OL${number}M`, title: 'The Fixture Book',
  authors: [{ key: '/authors/OL1A' }], languages: [{ key: '/languages/eng' }],
  publishers: ['Fixture Press'], publish_date: '2024', covers: [123],
  oclc_numbers: [String(1234 + number - 100).padStart(6, '0')],
  lccn: [`n ${79021164 + number - 100}`], ...extra,
});

export const catalogueWriteRecording = {
  search: { docs: [{ key: '/works/OL1W', title: 'The Fixture Book' }] },
  editions: { entries: [
    edition(100), edition(101), edition(102), edition(103),
    edition(104, { title: 'Le Livre', languages: [{ key: '/languages/fre' }] }),
    edition(105, { authors: [] }),
  ] },
  author: { key: '/authors/OL1A', name: 'Fixture Author' },
  isbnSearch: { docs: [{ key:'/works/OL1W', editions:{ docs:[
    { key:'/books/OL100M', isbn:['9780306406157'] },
  ] } }] },
  isbnEdition: edition(100, { isbn_13:['9780306406157'], works:[{ key:'/works/OL1W' }] }),
};

export const malformedCatalogueFields = [
  { label: 'multiple OCLC values', field: 'oclc_numbers', value: ['001234', '1234'], result: 'oclc' },
  { label: 'numeric OCLC', field: 'oclc_numbers', value: [1234], result: 'oclc' },
  { label: 'oversized OCLC array', field: 'oclc_numbers', value: Array(17).fill('123'), result: 'oclc' },
  { label: 'oversized OCLC scalar', field: 'oclc_numbers', value: ['1'.repeat(65)], result: 'oclc' },
  { label: 'OCLC control character', field: 'oclc_numbers', value: ['12\u000034'], result: 'oclc' },
  { label: 'active-content LCCN', field: 'lccn', value: ['<script>'], result: 'lccn' },
  { label: 'multiple LCCN values', field: 'lccn', value: ['n 79021164', 'N 79021164'], result: 'lccn' },
  { label: 'invalid LCCN punctuation', field: 'lccn', value: ['n/79021164'], result: 'lccn' },
];

export function catalogueWriteWorkerFixture(loseResponse = false, corrupt?: (companion:any) => void) {
  const fixture = editionWorkerFixture(), urls:string[] = [], completions:Array<{name:string;parameters:any}> = [];
  const recoveries:string[] = [];
  const recoveryControls = { failRecoveryAfterCommit:false, rejectCompletionBeforeReceipt:false };
  fixture.current().providerPolicies = [...fixture.current().providerPolicies as unknown[], {
    adapterKey:'open_library',adapterVersion:'1.0.0',enabled:true,matchingAllowed:true,
    storageAllowed:true,reuseAllowed:true,policyVersion:1,
  }];
  const adapter = new OpenLibraryEditionOptionsAdapter({ timeoutMs:1000,maxResponseBytes:64000,
    fetcher:async address => {
      const pathname = new URL(String(address)).pathname; urls.push(pathname);
      const body = pathname === '/search.json' ? catalogueWriteRecording.search
        : pathname === '/works/OL1W/editions.json' ? catalogueWriteRecording.editions
        : pathname === '/authors/OL1A.json' ? catalogueWriteRecording.author : null;
      return new Response(JSON.stringify(body), { status:body ? 200 : 404,
        headers:{'content-type':'application/json'} });
    } });
  if (corrupt) {
    const lookup = adapter.lookupEditionOptions.bind(adapter);
    // Preserve the real HTTP/normalizer result and alter only the worker's
    // incoming companion, just as a faulty or forged adapter could.
    adapter.lookupEditionOptions = async input => {
      const result = await lookup(input), row = result.rows[0], m = row.metadata!;
      const companion = { version:'psr-catalogue-write-v1',optionId:row.optionId,adapterKey:m.adapterKey,
        adapterVersion:m.adapterVersion,normalizerVersion:m.normalizerVersion,lookupId:m.correlationId,
        attemptId:m.attemptId,providerRecordId:m.providerRecordId,workExternalId:'OL1W',
        fetchedAt:m.fetchedAt,oclc:'001234',lccn:'n 79021164' };
      corrupt(companion);
      return {...result,catalogueCompanions:[companion]};
    };
  }
  const primary = new GoogleBooksAdapter({mode:'real',apiKey:'fixture',timeoutMs:1000,maxResponseBytes:64000,
    fetcher:async () => { throw new Error('unconfigured Google transport must not be called'); }});
  let receipt:Record<string,unknown> | null = null, call = 0;
  const rpc = async (name:string, parameters:Record<string,any>) => {
    if (name === 'phase9_register_structural_metadata_lookup')
      return {data:{lookup_id:'00000000-0000-4000-8000-000000000101'},error:null};
    if (name === 'phase9_register_structural_metadata_attempt')
      return {data:{attempt_id:'00000000-0000-4000-8000-000000000102'},error:null};
    if (name === 'phase9_register_edition_options_provider_call_v1') {
      fixture.calls.push({name,parameters}); call += 1;
      return {data:{provider_call_id:'ol-' + call,status:'registered'},error:null};
    }
    if (name === 'phase9_finalize_edition_options_provider_call_v1'
      || (name === 'phase9_finalize_metadata_provider_call' && String(parameters.p_provider_call_id).startsWith('ol-'))) {
      fixture.calls.push({name,parameters}); return {data:{status:'finalized'},error:null};
    }
    if (name === 'phase9_recover_candidate_edition_options_v1') {
      recoveries.push(name);
      if (receipt && recoveryControls.failRecoveryAfterCommit)
        return {data:null,error:{message:'fixture recovery temporarily unavailable'}};
      if (receipt && receipt.requestGeneration !== parameters.p_request_generation)
        return {data:{status:'stale_rejected'},error:null};
      return {data:receipt ? {...receipt,status:'replayed'} : {status:'missing'},error:null};
    }
    if (name === 'phase9_fail_candidate_edition_options_v1') return {data:{status:'resolved'},error:null};
    if (/^phase9_complete_candidate_edition_options_v[12]$/.test(name)) {
      completions.push({name,parameters});
      if (recoveryControls.rejectCompletionBeforeReceipt)
        return {data:null,error:{message:'fixture completion temporarily unavailable'}};
      receipt = {status:'completed',requestId:parameters.p_request_id,requestGeneration:parameters.p_request_generation,
        optionsVersion:1,optionsExpiresAt:parameters.p_options_expires_at};
      if (loseResponse) { loseResponse = false; return {data:null,error:{message:'fixture response lost after commit'}}; }
      return {data:receipt,error:null};
    }
    return fixture.dependencies.serviceClient.rpc(name,parameters);
  };
  const dependencies = {...fixture.dependencies,serviceClient:{rpc},primary,editionFallback:adapter,
    editionOptionsBoundary:createMetadataEditionOptionsBoundary({rpc})};
  return { fixture,urls,completions,recoveries,recoveryControls,committedReceipt:() => receipt,
    run:() => runMetadataWorkerBatch(1,dependencies) };
}

