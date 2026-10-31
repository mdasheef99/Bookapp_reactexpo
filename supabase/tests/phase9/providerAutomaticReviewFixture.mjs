// 02c §§3.1/3.2/4.2/4.3/9: real disposable SQL, recorded provider evidence only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { facts, resetActor, setActor, synthetic, value } from './providerReplacementFixture.mjs';
import { claimJob, seedAutomaticLineage, seedCard } from './editionPickerFixture.mjs';
import { rpc, token, worker } from './editionOptionsCompletionFixture.mjs';

export async function installSingleProvider(db) {
  await resetActor(db);
  await db.exec(fs.readFileSync(new URL('./fixtures/provider-replacement-synthetic-install.sql',import.meta.url),'utf8'));
  // Provider-owned protocol declaration; no generic workflow is replaced.
  await db.exec(`CREATE OR REPLACE FUNCTION marketplace_sec.phase9_test_synthetic_stage_valid_v1(
    p_key text,p_version text,p_sequence integer,p_stage text)
    RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
    SELECT coalesce(p_key='synthetic_catalogue' AND p_version='1.0.0'
      AND p_sequence IS NULL AND p_stage IS NULL,false) $$;
    REVOKE ALL ON FUNCTION marketplace_sec.phase9_test_synthetic_stage_valid_v1(text,text,integer,text)
      FROM PUBLIC,anon,authenticated,service_role;
    UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,automatic_role=NULL,automatic_order=NULL;`);
  const contract={validationContract:synthetic.validationContract,hostPolicyVersion:synthetic.hostPolicyVersion,
    capabilityVersion:synthetic.capabilityVersion,normalizerVersion:synthetic.normalizerVersion,
    payloadSchemaVersion:synthetic.payloadSchemaVersion,lookupSchemaVersion:synthetic.lookupSchemaVersion};
  await db.query(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,
    matching_allowed,storage_allowed,public_display_allowed,attribution_required,shared_source_note,
    revalidation_seconds,automatic_lookup_allowed,automatic_role,automatic_order,shared_catalogue_allowed,
    accepted_adapter_versions,version_contracts,validation_contract,host_policy_version,
    approved_request_hosts,approved_book_hosts,approved_cover_hosts,options_retention_seconds)
    VALUES($1,'metadata','1.0.0',true,true,true,true,true,'Test-only synthetic rights',3600,true,'primary',1,true,
      ARRAY['1.0.0'],$2,$3,$4,ARRAY['catalogue.example.test'],ARRAY['catalogue.example.test'],
      ARRAY['catalogue.example.test'],3600)`,
  [synthetic.adapterKey,{'1.0.0':contract},synthetic.validationContract,synthetic.hostPolicyVersion]);
}

export async function olAutomaticRoute(db) {
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,automatic_role=NULL,automatic_order=NULL;
    UPDATE public.phase9_provider_registry SET adapter_version='2.0.0',automatic_lookup_allowed=true,
      automatic_role='primary',automatic_order=1,accepted_adapter_versions=ARRAY['1.0.0','2.0.0'],
      version_contracts=version_contracts||jsonb_build_object('2.0.0',
        marketplace_sec.phase9_provider_validation_contract_v1('open_library','2.0.0')),
      validation_contract='open-library-v2' WHERE adapter_key='open_library';`);
}

export async function beginAutomatic(db,{key='google_books',version='1.0.0',claim=1,card=null}={}) {
  const f=card??await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
  await value(db,await claimJob(db,f,jobId));
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_jobs SET attempt_count=$1 WHERE id=$2',[claim,jobId]);
  await setActor(db,f.ownerId,'service_role');
  const context=await rpc(db,'phase9_metadata_job_context',[jobId,worker,token,claim]);
  Object.assign(f,{jobId,context,attempt:claim});
  await resetActor(db);
  const contract=await value(db,'SELECT marketplace_sec.phase9_provider_validation_contract_v1($1,$2)',[key,version]);
  await setActor(db,f.ownerId,'service_role');
  const base=[jobId,worker,token,claim],cacheKey='review-auto:'+jobId;
  const lookup=await rpc(db,'phase9_register_structural_metadata_lookup',[...base,f.candidateId,context.candidateVersion,
    context.queryIdentity,cacheKey,key,version,contract.capabilityVersion,contract.lookupSchemaVersion,'isbn',
    'p9-metadata-lookup-v1',contract.normalizerVersion,'p9-metadata-routing-v1','store_private','1',
    'p9-metadata-cache-v1','metadata-v1',null]);
  const usage=await rpc(db,'phase9_reserve_metadata_usage',[...base,lookup.lookup_id,key,version,1]);
  const attempt=await rpc(db,'phase9_register_structural_metadata_attempt',[lookup.lookup_id,...base,f.candidateId,
    context.candidateVersion,randomUUID(),cacheKey,'primary',1,key,version,contract.capabilityVersion,
    contract.lookupSchemaVersion,contract.normalizerVersion,'p9-metadata-routing-v1','local_insufficient',usage.reservation_id]);
  Object.assign(f,{lookupId:lookup.lookup_id,attemptId:attempt.attempt_id,cacheKey,contract});
  const m=facts({title:context.title,authors:context.authors,adapterKey:key,adapterVersion:version,
    providerRecordId:key==='open_library'?'OL100M':key==='synthetic_catalogue'?'ED-42':'same-record',
    coverReference:null,correlationId:f.lookupId,attemptId:f.attemptId,fetchedAt:new Date().toISOString(),
    matchRationale:'exact_validated_isbn',confidence:1});
  return {f,command:{fence:{jobId,worker,leaseToken:token,claimAttempt:claim,candidateId:f.candidateId,
    storeId:f.storeId,sessionId:f.sessionId,candidateVersion:context.candidateVersion,queryIdentity:context.queryIdentity,
    capturedRequestId:null,requestGeneration:0},lookupId:f.lookupId,attemptId:f.attemptId,selectedOptionId:null,
    source:'external',result:{version:'p9-metadata-result-v2',purpose:'automatic',outcome:{outcome:'coherent_match',
      candidates:[m],selected:m,evidence:['validated_isbn'],retryable:false,secondaryEligible:false,
      providerRequestId:'review-request',representativeCover:null},rows:null,catalogueCompanions:null,retention:null}}};
}

export async function singleReceipt(db,{f,command},{retryable=command.result.outcome.retryable}={}) {
  await setActor(db,f.ownerId,'service_role');
  const o=command.result.outcome;
  const call=await rpc(db,'phase9_register_metadata_provider_call',[f.attemptId,f.jobId,worker,token,f.attempt,randomUUID()]);
  f.callId=call.provider_call_id;
  await rpc(db,'phase9_finalize_metadata_provider_call',[f.callId,f.jobId,worker,token,f.attempt,
    'finalized',o.outcome,o.outcome,o.providerRequestId,retryable,o.selected,o.evidence]);
}

export function failureResult(command) {
  Object.assign(command.result.outcome,{outcome:'timeout',candidates:[],selected:null,evidence:[],
    retryable:true,secondaryEligible:true});
}

export async function retainedOlResult(db,{f,command},count=1) {
  const m=command.result.outcome.selected;
  const rows=Array.from({length:count},(_,ordinal)=>({optionId:randomUUID(),ordinal,eligibility:'eligible',
    googleBooksUrl:'https://openlibrary.org/books/OL'+(100+ordinal)+'M',
    metadata:{...m,providerRecordId:'OL'+(100+ordinal)+'M'}}));
  command.result.rows=rows;
  command.result.catalogueCompanions=rows.map(r=>({version:'psr-catalogue-write-v1',optionId:r.optionId,
    adapterKey:'open_library',adapterVersion:'2.0.0',normalizerVersion:m.normalizerVersion,
    lookupId:f.lookupId,attemptId:f.attemptId,providerRecordId:r.metadata.providerRecordId,
    workExternalId:'OL1W',fetchedAt:m.fetchedAt,oclc:null,lccn:null}));
  command.result.retention={sourceFetchedAt:m.fetchedAt,permittedDeadlineAt:new Date(Date.parse(m.fetchedAt)+3600000).toISOString(),
    policyVersion:1,storagePermissionVerified:true,retentionContract:'open-library-options-v1'};
  command.result.outcome.candidates=rows.map(r=>r.metadata);
  command.result.outcome.selected=count===1?rows[0].metadata:null;
  command.result.outcome.outcome=count===1?'coherent_match':'ambiguous_match';
  command.result.outcome.evidence=count===1?['validated_isbn']:[];
  command.result.outcome.secondaryEligible=count!==1;
  command.selectedOptionId=count===1?rows[0].optionId:null;
  for(const [sequence,stage]of [[0,'search'],[1,'edition']]) {
    const call=await rpc(db,'phase9_register_edition_options_provider_call_v1',
      [f.attemptId,f.jobId,worker,token,f.attempt,randomUUID(),sequence,stage]);
    await rpc(db,'phase9_finalize_edition_options_provider_call_v1',
      [call.provider_call_id,f.jobId,worker,token,f.attempt,'finalized','no_acceptable_match',false,true]);
  }
  assert.equal(command.result.rows.length,count);
}

export async function receivingCard(db,f) {
  await resetActor(db);
  const candidateId=randomUUID();
  await db.query(`INSERT INTO public.image_extraction_candidates SELECT
    (jsonb_populate_record(NULL::public.image_extraction_candidates,to_jsonb(c)||$1::jsonb)).*
    FROM public.image_extraction_candidates c WHERE id=$2`,
  [{id:candidateId,candidate_index:2,analysis_observation_id:null,analysis_schema_version:null,input_id:null,vision_job_id:null,
    selected_metadata_snapshot_id:null,canonical_edition_id:null,metadata_attempt_id:null,state:'needs_review'},f.candidateId]);
  return {...f,candidateId};
}
