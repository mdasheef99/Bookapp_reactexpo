import type { MetadataRpcClient } from './metadataJobContext';
import { metadataObject } from './metadataJobContext';
import { metadataGatewayRpc } from './metadataGatewayContext';
import type { EditionOptionsCompletion, EditionOptionsFence, MetadataEditionOptionsBoundary }
  from './metadataEditionOptionsBoundary';
import type { MetadataManualCompletion } from './metadataProductionComposition';

// Picker §§5/8-9: service-only SQL operations; no alternative payload appears in a receipt.
function parameters(fence: EditionOptionsFence) {
  return {
    p_job_id: fence.jobId, p_worker: fence.claimWorker, p_lease_token: fence.claimLeaseToken,
    p_attempt_count: fence.claimAttempt, p_candidate_id: fence.candidateId, p_store_id: fence.storeId,
    p_session_id: fence.sessionId, p_request_id: fence.requestId,
    p_request_generation: fence.requestGeneration, p_query_identity: fence.queryIdentity,
  };
}
function completion(value: unknown, fence: EditionOptionsFence): EditionOptionsCompletion {
  const row=metadataObject(value);
  const invalid=() => { throw new Error('P9_EDITION_COMPLETION_INVALID'); };
  if (row.status==='missing' || row.status==='stale_rejected') {
    if (Object.keys(row).length!==1) return invalid();
    return { status: row.status };
  }
  if (Object.keys(row).some(k=>!['status','requestId','requestGeneration','optionsVersion','optionsExpiresAt'].includes(k))
    || (row.status!=='completed' && row.status!=='replayed') || row.requestId!==fence.requestId
    || row.requestGeneration!==fence.requestGeneration || !Number.isSafeInteger(row.optionsVersion)
    || (row.optionsVersion as number)<1 || typeof row.optionsExpiresAt!=='string'
    || !Number.isFinite(Date.parse(row.optionsExpiresAt))) return invalid();
  return { status:row.status, requestId:fence.requestId, requestGeneration:fence.requestGeneration,
    optionsVersion:row.optionsVersion as number, optionsExpiresAt:row.optionsExpiresAt };
}
function failure(value: unknown): MetadataManualCompletion {
  const row=metadataObject(value);
  if (Object.keys(row).some(k=>!['status','job_status','manual_outcome'].includes(k))) {
    throw new Error('P9_EDITION_COMPLETION_INVALID');
  }
  if (row.status==='retry_scheduled' || row.status==='resolved' || row.status==='dead_letter') return {status:row.status};
  if (row.status==='replayed' && (row.job_status==='resolved' || row.job_status==='dead_letter'
    || row.job_status==='retry_scheduled')) return {status:'replayed',jobStatus:row.job_status};
  throw new Error('P9_EDITION_COMPLETION_INVALID');
}
// Only this bounded contract failure changes retry classification; raw RPC details remain private.
async function completeRpc(client: MetadataRpcClient, input: Record<string, unknown>) {
  const name = 'phase9_complete_candidate_edition_options_v1';
  const result = await client.rpc(name, input);
  if (result.error !== null) {
    const error = result.error;
    const message = typeof error === 'object' && error !== null && 'message' in error ? error.message : null;
    throw new Error(message === 'P9_EDITION_ROWS_INVALID' ? message : `P9_METADATA_RPC_FAILED:${name}`);
  }
  return result.data;
}
export function createMetadataEditionOptionsBoundary(client: MetadataRpcClient): MetadataEditionOptionsBoundary {
  return Object.freeze<MetadataEditionOptionsBoundary>({
    async recover(fence) {
      return completion(await metadataGatewayRpc(client,'phase9_recover_candidate_edition_options_v1',parameters(fence)),fence);
    },
    async complete(input) {
      return completion(await completeRpc(client,{
        ...parameters(input), p_lookup_id:input.lookupId,p_attempt_id:input.attemptId,
        p_source_fetched_at:input.sourceFetchedAt,p_options_expires_at:input.optionsExpiresAt,
        p_storage_permission_verified:input.storagePermissionVerified,p_rows:input.rows,
      }),input);
    },
    async fail(input) {
      return failure(await metadataGatewayRpc(client,'phase9_fail_candidate_edition_options_v1',{
        ...parameters(input),p_failure_kind:input.outcome,p_retryable:input.retryable,
      }));
    },
  });
}
