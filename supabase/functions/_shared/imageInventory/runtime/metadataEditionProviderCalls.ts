import {randomUUID} from 'node:crypto';
import {loadMetadataJobContext,metadataObject as object,metadataText as text} from './metadataJobContext';
import type {MetadataRpcClient} from './metadataJobContext';
import {metadataClaimParameters,metadataGatewayRpc,metadataLookupParameters} from './metadataGatewayContext';
import type {MetadataGatewayConfiguration} from './metadataGatewayContext';
import type {MetadataProductionRequest} from './metadataProductionComposition';
import {OpenLibraryFailure} from '../metadata/openLibrary/transport';
import type {EditionHttpHooks} from '../metadata/openLibrary/transport';
import {OPEN_LIBRARY_CAPABILITY} from '../metadata/openLibrary';
import {markProviderHttpUnregistered} from '../metadata/providerHttp';

// Picker §9: every fan-out GET is registered and freshly fenced; HTTP receipts contain no alternatives.
//
// U6: the registration/fresh-claim/finalization RPCs below are shared by the
// legacy void hooks (createHooks) and the port-shaped hooks (createPortHooks).
// createPortHooks exposes the granted callId and maps the SQL finalization to
// a receipt (S0), and always returns grantEpoch: null (C-U6-1: the SQL
// registration never returns an epoch; server-side fencing stays
// authoritative, so none is synthesized or required).
export function createEditionProviderCalls(client:MetadataRpcClient,configuration:MetadataGatewayConfiguration) {
  const claim=metadataClaimParameters({
    jobId:configuration.context.jobId,claimWorker:configuration.worker,
    claimLeaseToken:configuration.context.claimToken,claimAttempt:configuration.context.attempt,
  } as MetadataProductionRequest);
  async function fresh(binding?: Readonly<{ adapterKey: string; adapterVersion: string }>) {
    const context=await loadMetadataJobContext(client,{
      jobId:configuration.context.jobId,worker:configuration.worker,
      leaseToken:configuration.context.claimToken,attempt:configuration.context.attempt,
    });
    const original=configuration.context;
    // U6: routed calls check the elected descriptor's key/version; legacy
    // callers without a binding keep the exact historical check. U6 fix1
    // (F6): fallback calls pass the SECONDARY binding so registration and
    // fresh hooks use secondary identity.
    const bound = binding ?? configuration.explicitDescriptor?.descriptor;
    if (bound !== undefined) {
      const row=context.providerPolicies.find(item=>item.adapterKey===bound.adapterKey
        && item.adapterVersion===bound.adapterVersion);
      if (context.purpose!=='edition_options' || context.jobId!==original.jobId
        || context.candidateId!==original.candidateId || context.storeId!==original.storeId
        || context.sessionId!==original.sessionId || context.queryIdentity!==original.queryIdentity
        || context.requestGeneration!==original.requestGeneration || context.attempt!==original.attempt
        || context.claimToken!==original.claimToken) {
        throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
      }
      if (!row?.enabled || !row.matchingAllowed || !row.storageAllowed) throw new OpenLibraryFailure('provider_disabled');
      return;
    }
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
  // S0: maps the SQL finalization `{provider_call_id, status}` (M92:1189-1192
  // -> M68:439-451; no SQL receiptId field exists or is required) to the
  // port's `{receiptId}`, validating identity. Today's callers discard it.
  async function finalizeWithReceipt(callId:string,outcome:string,retryable:boolean,
    status:string,egressStarted:boolean): Promise<{receiptId:string}> {
    const parameters={...claim,p_provider_call_id:callId,p_status:status,p_outcome:outcome,
      p_retryable:retryable,p_egress_started:egressStarted};
    let result;
    try {result=await metadataGatewayRpc(client,'phase9_finalize_edition_options_provider_call_v1',parameters);}
    catch { // Exact replay recovers a committed receipt; it never repeats HTTP.
      result=await metadataGatewayRpc(client,'phase9_finalize_edition_options_provider_call_v1',parameters);
    }
    const receipt=object(result);
    if (receipt.status==='stale_rejected' && egressStarted) throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
    // Identity: the durable row must be the call just settled; a crossed
    // receipt is a wiring bug, never silently adopted.
    // U6 fix1 (F10): the returned status must equal the requested physical
    // status. SQL echoes the request (M68) except `stale_rejected` when the
    // claim went inactive — the only documented exemption. Anything else
    // (e.g. `registered`) is malformed and refused, never a receipt.
    if (text(receipt.provider_call_id) !== callId
      || (receipt.status !== status && receipt.status !== 'stale_rejected')) {
      throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
    }
    return {receiptId:callId};
  }
  async function register(
    attemptId:string,sequence:number,stage:string,signal:AbortSignal,
    binding?: Readonly<{ adapterKey: string; adapterVersion: string }>,
  ): Promise<string> {
    // U6 fix2 (G9): these two refusals provably precede any registration RPC,
    // so they carry explicit proof that no SQL call row exists. Registration
    // uncertainty, replay, non-registered responses and the post-registration
    // fresh check below are NOT marked (their reservations stay held).
    try { await fresh(binding); } catch (error) {
      throw markProviderHttpUnregistered(error);
    }
    if (signal.aborted) {
      throw markProviderHttpUnregistered(new Error('P9_METADATA_STALE_PHYSICAL_CALL'));
    }
    const parameters={...claim,p_attempt_id:attemptId,p_physical_call_identity:randomUUID(),
      p_call_sequence:sequence,p_call_stage:stage};
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
    try {await fresh(binding);}
    catch(error) {
      await finalize(id,'cancelled',false,'stale_rejected',false);
      throw error;
    }
    return id;
  }
  return {
    createHooks(lookupId:string,attemptId:string):EditionHttpHooks {
      const calls=new Map<number,string>();
      return {
        async beforeRequest(call) {
          const id=await register(attemptId,call.sequence,call.stage,call.signal);
          calls.set(call.sequence,id);
        },
        async afterRequest(call) {
          const id=calls.get(call.sequence);
          if (!id) throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
          await finalize(id,call.outcome,call.retryable,call.physicalStatus,call.egressStarted);
        },
      };
    },
    // U6 port-shaped hooks for descriptor-driven calls. Registration,
    // fencing and finalization are the same RPCs as createHooks; only the
    // shape differs (granted identity out, receipt back).
    createPortHooks(lookupId:string,attemptId:string,
      binding?: Readonly<{ adapterKey: string; adapterVersion: string }>,
    ): {
      beforeRequest: (call:Readonly<{sequence:number;stage:string;signal:AbortSignal}>)=>Promise<{callId:string;grantEpoch:null}>;
      afterRequest: (callId:string,settled:Readonly<{outcome:string;retryable:boolean;physicalStatus:'finalized'|'outcome_unknown'|'stale_rejected';egressStarted:boolean}>)=>Promise<{receiptId:string}>;
    } {
      const finalizedIds=new Set<string>();
      return {
        async beforeRequest(call) {
          const id=await register(attemptId,call.sequence,call.stage,call.signal,binding);
          // C-U6-1: the SQL registration carries no epoch; production always
          // reports null (fixtures may still return grant_epoch:1 — ignored).
          return {callId:id,grantEpoch:null};
        },
        async afterRequest(callId,settled) {
          if (finalizedIds.has(callId)) throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
          finalizedIds.add(callId);
          return finalizeWithReceipt(callId,settled.outcome,settled.retryable,
            settled.physicalStatus,settled.egressStarted);
        },
      };
    },
    async registerFallback(request:MetadataProductionRequest,lookupId:string,reservationId:string,
      primaryAttemptId:string,outcome:string) {
      await fresh();
      await metadataGatewayRpc(client,'phase9_finish_edition_primary_for_fallback_v1',{
        ...claim,p_attempt_id:primaryAttemptId,p_outcome:outcome,
      });
      // U6: routed calls use the elected secondary route versions; legacy
      // callers without a binding keep the exact historical versions.
      const fallbackRoute=configuration.explicitDescriptor?.fallbackRoute;
      // U6 fix2 (G6): a routed secondary registers its OWN lookup schema and
      // normalizer (the structural-attempt RPC has no lookup-contract
      // argument, so lookupContractVersion stays the primary configuration's
      // value and is never passed). payloadSchemaVersion is never substituted
      // for the lookup schema. Legacy callers keep the historical versions.
      const secondary=fallbackRoute === undefined || fallbackRoute === null
        ? {...configuration,adapterKey:'open_library',adapterVersion:OPEN_LIBRARY_CAPABILITY.adapterVersion,
          capabilityVersion:OPEN_LIBRARY_CAPABILITY.capabilityVersion}
        : {...configuration,adapterKey:fallbackRoute.adapterKey,
          adapterVersion:fallbackRoute.adapterVersion,capabilityVersion:fallbackRoute.capabilityVersion,
          schemaVersion:fallbackRoute.lookupSchemaVersion,
          normalizerVersion:fallbackRoute.normalizerVersion};
      const parameters=metadataLookupParameters(request,secondary,null);
      const result=object(await metadataGatewayRpc(client,'phase9_register_structural_metadata_attempt',{
        ...claim,p_lookup_id:lookupId,p_candidate_id:request.candidateId,
        p_candidate_version:configuration.context.candidateVersion,p_provider_attempt_identity:randomUUID(),
        p_provider_cache_identity:parameters.p_provider_cache_identity,p_provider_role:'secondary',p_attempt_sequence:2,
        p_adapter_key:fallbackRoute?.adapterKey ?? 'open_library',p_adapter_version:parameters.p_adapter_version,
        p_capability_version:parameters.p_capability_version,p_schema_version:parameters.p_schema_version,
        p_normalizer_version:parameters.p_normalizer_version,p_routing_policy_version:parameters.p_routing_policy_version,
        p_predecessor_outcome:outcome,p_usage_reservation_id:reservationId,
      }));
      return {attemptId:text(result.attempt_id)};
    },
  };
}
