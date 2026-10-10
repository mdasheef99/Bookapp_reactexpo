import type { StoredEditionRow } from '../contracts/ownerEditionPicker';
import type { MetadataManualCompletion } from './metadataProductionComposition';
import type { MetadataNormalizedOutcome } from '../metadata/providerAdapter';
import type { MetadataJobContext } from './metadataJobContext';

// Picker §§4.3/5/9: controlled transaction port implemented by M68's service-only RPCs.
// Local installation grants no provider retention permission or live application authority.
export type EditionOptionsFence = Readonly<{
  jobId: string; claimWorker: string; claimLeaseToken: string; claimAttempt: number;
  candidateId: string; storeId: string; sessionId: string;
  requestId: string; requestGeneration: number; queryIdentity: string;
}>;
export function editionOptionsFence(context: MetadataJobContext, worker: string): EditionOptionsFence {
  if (context.purpose !== 'edition_options' || context.requestGeneration === null) {
    throw new Error('P9_EDITION_CONTEXT_INVALID');
  }
  return {
    jobId:context.jobId,claimWorker:worker,claimLeaseToken:context.claimToken,claimAttempt:context.attempt,
    candidateId:context.candidateId,storeId:context.storeId,sessionId:context.sessionId,
    requestId:context.jobId,requestGeneration:context.requestGeneration,queryIdentity:context.queryIdentity,
  };
}
export type EditionOptionsCompletionInput = EditionOptionsFence & Readonly<{
  lookupId: string; attemptId: string; sourceFetchedAt: string; optionsExpiresAt: string;
  storagePermissionVerified: true; rows: readonly StoredEditionRow[];
}>;
export type EditionOptionsCompletion =
  | Readonly<{ status: 'missing' }>
  | Readonly<{ status: 'stale_rejected' }>
  | Readonly<{
    status: 'completed' | 'replayed'; requestId: string; requestGeneration: number;
    optionsVersion: number; optionsExpiresAt: string;
  }>;
export type MetadataEditionOptionsBoundary = Readonly<{
  // Reauthorize/recover only this request; receipt never contains alternatives.
  recover(fence: EditionOptionsFence): Promise<EditionOptionsCompletion>;
  // Atomically save the private set and resolve this job/lookup; never write selection/review.
  complete(input: EditionOptionsCompletionInput): Promise<EditionOptionsCompletion>;
  // Preserve automatic snapshots, candidate state and Owner details during failure/retry.
  fail(input: EditionOptionsFence & Readonly<{
    outcome: MetadataNormalizedOutcome; retryable: boolean;
  }>): Promise<MetadataManualCompletion>;
}>;
