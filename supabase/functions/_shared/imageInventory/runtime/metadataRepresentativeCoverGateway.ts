import type { MetadataRepresentativeCover } from '../metadata/representativeCover';
import type { MetadataGatewayConfiguration } from './metadataGatewayContext';
import { metadataGatewayRpc } from './metadataGatewayContext';
import type { MetadataRpcClient } from './metadataJobContext';

export async function persistMetadataRepresentativeCover(
  client: MetadataRpcClient,
  configuration: MetadataGatewayConfiguration,
  input: Readonly<{
    lookupId: string;
    attemptId: string;
    representativeCover: MetadataRepresentativeCover;
  }>,
): Promise<void> {
  const cover = input.representativeCover;
  await metadataGatewayRpc(client, 'phase9_store_metadata_representative_cover_v1', {
    p_attempt_id: input.attemptId,p_lookup_id: input.lookupId,
    p_job_id: configuration.context.jobId,p_worker: configuration.worker,
    p_lease_token: configuration.context.claimToken,
    p_attempt_count: configuration.context.attempt,
    p_candidate_id: configuration.context.candidateId,
    p_candidate_version: configuration.context.candidateVersion,
    p_cover_reference: cover.coverReference,
    p_source_provider_record_id: cover.sourceProviderRecordId,
    p_source_relation: cover.sourceRelation,
    p_selection_policy_version: cover.selectionPolicyVersion,
    p_match_evidence: cover.matchEvidence,
  });
}
