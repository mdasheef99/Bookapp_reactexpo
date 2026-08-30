import type { MetadataManualCompletion } from './metadataProductionComposition';
import {
  metadataObject as object, metadataText as text, MetadataRpcClient,
} from './metadataJobContext';
import {
  MetadataGatewayConfiguration, metadataGatewayRpc,
} from './metadataGatewayContext';

function decodeManualCompletion(value: unknown): MetadataManualCompletion {
  const data = object(value);
  const status = text(data.status);
  if (status === 'retry_scheduled' || status === 'resolved' || status === 'dead_letter') {
    return { status };
  }
  if (status === 'replayed') {
    const jobStatus = text(data.job_status);
    if (jobStatus === 'open' || jobStatus === 'retry_scheduled'
      || jobStatus === 'in_progress' || jobStatus === 'resolved'
      || jobStatus === 'dead_letter') {
      return { status, jobStatus };
    }
  }
  throw new Error('P9_METADATA_COMPLETION_INVALID');
}

export async function completeMetadataJobManually(
  client: MetadataRpcClient,
  configuration: MetadataGatewayConfiguration,
  input: Readonly<{ outcome: string; retryable: boolean }>,
): Promise<MetadataManualCompletion> {
  return decodeManualCompletion(await metadataGatewayRpc(
    client,
    'phase9_fail_metadata_job',
    {
      p_job_id: configuration.context.jobId,p_worker: configuration.worker,
      p_lease_token: configuration.context.claimToken,
      p_attempt_count: configuration.context.attempt,
      p_candidate_id: configuration.context.candidateId,
      p_candidate_version: configuration.context.candidateVersion,
      p_query_identity: configuration.context.queryIdentity,
      p_failure_kind: input.outcome,p_retryable: input.retryable,
    },
  ));
}
