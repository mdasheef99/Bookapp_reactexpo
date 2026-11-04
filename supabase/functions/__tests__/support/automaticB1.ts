// 02c §§4.3/5.1/9: existing golden identities and contracts, fixture-only values.
import { automaticContext } from '../fixtures/phase9/editionOptionsWorker';
import { JOB_ID, CANDIDATE_ID, STORE_ID, SESSION_ID, SNAPSHOT_ID } from './automaticWorker';
import { GOLDEN_LOOKUP_ID, GOLDEN_ATTEMPT_ID, GOLDEN_CLOCK, GOOGLE_AUTOMATIC_V1 }
  from '../fixtures/phase9/providerReplacementGoldens';
import { decodeMetadataJobContext } from '../../_shared/imageInventory/runtime/metadataJobContext';
import { createGoogleBooksDescriptor } from '../../_shared/imageInventory/metadata/googleBooks/descriptor';
import { GOOGLE_BOOKS_PROVIDER_VALIDATION } from '../../_shared/imageInventory/metadata/googleBooks/validation';
export { GOLDEN_LOOKUP_ID, GOLDEN_ATTEMPT_ID, GOLDEN_CLOCK, GOOGLE_AUTOMATIC_V1, SNAPSHOT_ID };
export const context = () => decodeMetadataJobContext({ ...automaticContext,
  jobId: JOB_ID, candidateId: CANDIDATE_ID, storeId: STORE_ID, sessionId: SESSION_ID });
export const claim = { jobId: JOB_ID, worker: 'metadata-worker-fixture-0001',
  leaseToken: automaticContext.claimToken, attempt: automaticContext.attempt };
export const fence = () => ({ jobId: JOB_ID, worker: claim.worker, leaseToken: claim.leaseToken,
  claimAttempt: claim.attempt, candidateId: CANDIDATE_ID, storeId: STORE_ID, sessionId: SESSION_ID,
  candidateVersion: automaticContext.candidateVersion, queryIdentity: automaticContext.queryIdentity,
  requestGeneration: 0, capturedRequestId: null });
export const read = () => ({ candidateVersion: automaticContext.candidateVersion,
  requestGeneration: 0, capturedRequestId: null, lineage: null });
export const lineage = () => ({ adapterKey: 'google_books', adapterVersion: '1.0.0',
  purpose: 'automatic', role: 'primary', sequence: 1, lookupId: GOLDEN_LOOKUP_ID,
  attemptId: GOLDEN_ATTEMPT_ID, claimAttempt: claim.attempt, policyVersion: 1 });
export const packet = () => ({ version: 'p9-metadata-result-v2', purpose: 'automatic',
  outcome: GOOGLE_AUTOMATIC_V1, rows: null, catalogueCompanions: null, retention: null });
export function validation() {
  const descriptor = createGoogleBooksDescriptor({ adapter: null });
  return { purpose: 'automatic' as const, descriptor,
    installed: new Map([['google_books@1.0.0', descriptor]]),
    providerValidation: GOOGLE_BOOKS_PROVIDER_VALIDATION,
    lookupId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
    now: GOLDEN_CLOCK, retentionEvidence: null };
}
export const command = () => ({ fence: fence(), lookupId: GOLDEN_LOOKUP_ID,
  attemptId: GOLDEN_ATTEMPT_ID, result: packet(), selectedOptionId: null, source: 'external' });
export const receipt = () => ({ version: 'p9-auto-completion-v1', status: 'completed',
  lookupId: GOLDEN_LOOKUP_ID, snapshotId: SNAPSHOT_ID, outcome: 'accepted_metadata_match',
  selectedOptionId: null, prefill: { status: 'skipped', reason: 'not_installed' } });
