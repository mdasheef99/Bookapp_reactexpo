import {randomUUID} from 'node:crypto';
import {loadMetadataJobContext,metadataObject as object,metadataText as text} from './metadataJobContext';
import type {MetadataRpcClient} from './metadataJobContext';
import {metadataClaimParameters,metadataGatewayRpc,metadataLookupParameters} from './metadataGatewayContext';
import type {MetadataGatewayConfiguration} from './metadataGatewayContext';
import type {MetadataProductionRequest} from './metadataProductionComposition';
import {OpenLibraryFailure} from '../metadata/openLibrary/transport';
import type {EditionHttpHooks} from '../metadata/openLibrary/transport';
import {OPEN_LIBRARY_CAPABILITY} from '../metadata/openLibrary';

// Picker §9: every fan-out GET is registered and freshly fenced; HTTP receipts contain no alternatives.
export function createEditionProviderCalls(client:MetadataRpcClient,configuration:MetadataGatewayConfiguration) {
  const claim=metadataClaimParameters({
    jobId:configuration.context.jobId,claimWorker:configuration.worker,
    claimLeaseToken:configuration.context.claimToken,claimAttempt:configuration.context.attempt,
  } as MetadataProductionRequest);
  async function fresh() {
    const context=await loadMetadataJobContext(client,{
      jobId:configuration.context.jobId,worker:configuration.worker,
      leaseToken:configuration.context.claimToken,attempt:configuration.context.attempt,
    });
    const original=configuration.context;
    const policy=context.providerPolicies.find(row=>row.adapterKey==='open_library' && row.adapterVersion==='1.0.0');
    if (context.purpose!=='edition_options' || context.jobId!==original.jobId
      || context.candidateId!==original.candidateId || context.storeId!==original.storeId
      || context.sessionId!==original.sessionId || context.queryIdentity!==original.queryIdentity
      || context.requestGeneration!==original.requestGeneration || context.attempt!==original.attempt
      || context.claimToken!==original.claimToken) {
      throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
    }
    if (!policy?.enabled || !policy.matchingAllowed || !policy.storageAllowed) throw new OpenLibraryFailure('provider_disabled');
  }
  async function finalize(callId:string,outcome:string,retryable:boolean,status:string,egressStarted:boolean) {
    const parameters={...claim,p_provider_call_id:callId,p_status:status,p_outcome:outcome,
      p_retryable:retryable,p_egress_started:egressStarted};
    let result;
    try {result=await metadataGatewayRpc(client,'phase9_finalize_edition_options_provider_call_v1',parameters);}
    catch { // Exact replay recovers a committed receipt; it never repeats HTTP.
      result=await metadataGatewayRpc(client,'phase9_finalize_edition_options_provider_call_v1',parameters);
    }
    if (object(result).status==='stale_rejected' && egressStarted) throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
  }
  return {
    createHooks(lookupId:string,attemptId:string):EditionHttpHooks {
      const calls=new Map<number,string>();
      return {
        async beforeRequest(call) {
          await fresh();
          if (call.signal.aborted) throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
          const parameters={...claim,p_attempt_id:attemptId,p_physical_call_identity:randomUUID(),
            p_call_sequence:call.sequence,p_call_stage:call.stage};
          let result;
          try {
            result=object(await metadataGatewayRpc(client,'phase9_register_edition_options_provider_call_v1',parameters));
          } catch(error) {
            // Registration may have committed. Replay exactly once; HTTP never begins on this uncertain path.
            const recovered=object(await metadataGatewayRpc(client,'phase9_register_edition_options_provider_call_v1',parameters));
            if (recovered.status==='registered') await finalize(text(recovered.provider_call_id),'cancelled',false,'stale_rejected',false);
            throw error;
          }
          if (result.status!=='registered') throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
          const id=text(result.provider_call_id);
          calls.set(call.sequence,id);
          try {await fresh();}
          catch(error) {
            await finalize(id,'cancelled',false,'stale_rejected',false);
            throw error;
          }
        },
        async afterRequest(call) {
          const id=calls.get(call.sequence);
          if (!id) throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
          await finalize(id,call.outcome,call.retryable,call.physicalStatus,call.egressStarted);
        },
      };
    },
    async registerFallback(request:MetadataProductionRequest,lookupId:string,reservationId:string,
      primaryAttemptId:string,outcome:string) {
      await fresh();
      await metadataGatewayRpc(client,'phase9_finish_edition_primary_for_fallback_v1',{
        ...claim,p_attempt_id:primaryAttemptId,p_outcome:outcome,
      });
      const secondary={...configuration,adapterKey:'open_library',adapterVersion:OPEN_LIBRARY_CAPABILITY.adapterVersion,
        capabilityVersion:OPEN_LIBRARY_CAPABILITY.capabilityVersion};
      const parameters=metadataLookupParameters(request,secondary,null);
      const result=object(await metadataGatewayRpc(client,'phase9_register_structural_metadata_attempt',{
        ...claim,p_lookup_id:lookupId,p_candidate_id:request.candidateId,
        p_candidate_version:configuration.context.candidateVersion,p_provider_attempt_identity:randomUUID(),
        p_provider_cache_identity:parameters.p_provider_cache_identity,p_provider_role:'secondary',p_attempt_sequence:2,
        p_adapter_key:'open_library',p_adapter_version:parameters.p_adapter_version,
        p_capability_version:parameters.p_capability_version,p_schema_version:parameters.p_schema_version,
        p_normalizer_version:parameters.p_normalizer_version,p_routing_policy_version:parameters.p_routing_policy_version,
        p_predecessor_outcome:outcome,p_usage_reservation_id:reservationId,
      }));
      return {attemptId:text(result.attempt_id)};
    },
  };
}
