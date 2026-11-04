// FIX2 L1, 02c §§4.3/5.1/9: read original evidence; never elect or create lineage.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetadataJobContext } from '../../supabase/functions/_shared/imageInventory/runtime/metadataJobContext';
import { metadataObject } from '../../supabase/functions/_shared/imageInventory/runtime/metadataJobContext';
import type { Lineage } from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';

export async function legacyAutomaticRetry(client: Pick<SupabaseClient, 'from'>,
  context: MetadataJobContext): Promise<Lineage | null> {
  if (context.currentLookupId === null || context.currentAttemptId === null
    || context.currentAttemptDisposition !== 'unresolved' || context.currentPhysicalStatus !== 'finalized'
    || context.currentPhysicalRetryable !== true) return null;
  const { data, error } = await client.from('metadata_enrichment_attempts').select(
    'id,lookup_id,candidate_id,store_id,adapter_key,adapter_version,query_identity,provider_role,attempt_sequence,disposition,'
    + 'lookup:phase9_metadata_lookups!lookup_id(id,job_id,candidate_id,store_id,query_identity,execution_mode,'
    + 'adapter_key,adapter_version,reuse_policy_version,leader_lookup_id,completed_at),'
    + 'calls:phase9_metadata_provider_calls!logical_attempt_id(job_id,candidate_id,store_id,logical_attempt_id,'
    + 'claim_attempt_number,status,retryable,normalized_outcome,logical_outcome,edition_call_sequence,edition_call_stage)',
  ).eq('id', context.currentAttemptId).maybeSingle();
  if (error) throw new Error('P9_LEGACY_RETRY_READ_UNCERTAIN');
  if (data === null) return null;
  const a = metadataObject(data), l = metadataObject(a.lookup), calls = a.calls;
  if (!Array.isArray(calls) || calls.length !== 1) return null;
  const pc = metadataObject(calls[0]), transient = ['provider_unavailable', 'timeout', 'network_failure', 'rate_limited'];
  const version = Number(l.reuse_policy_version);
  if (a.id !== context.currentAttemptId || a.lookup_id !== context.currentLookupId || l.id !== a.lookup_id
    || a.candidate_id !== context.candidateId || l.candidate_id !== context.candidateId || pc.candidate_id !== context.candidateId
    || a.store_id !== context.storeId || l.store_id !== context.storeId || pc.store_id !== context.storeId
    || l.job_id !== context.jobId || pc.job_id !== context.jobId || pc.logical_attempt_id !== a.id
    || a.query_identity !== context.queryIdentity || l.query_identity !== context.queryIdentity
    || l.execution_mode !== 'external' || l.leader_lookup_id !== null || l.completed_at !== null
    || a.provider_role !== 'primary' || Number(a.attempt_sequence) !== 1 || a.disposition !== 'unresolved'
    || typeof a.adapter_key !== 'string' || !a.adapter_key || typeof a.adapter_version !== 'string' || !a.adapter_version
    || a.adapter_key !== l.adapter_key || a.adapter_version !== l.adapter_version
    || pc.status !== 'finalized' || pc.retryable !== true
    || typeof pc.normalized_outcome !== 'string' || !transient.includes(pc.normalized_outcome)
    || pc.logical_outcome !== pc.normalized_outcome || pc.normalized_outcome !== context.currentPhysicalOutcome
    || pc.edition_call_sequence !== null || pc.edition_call_stage !== null
    || typeof pc.claim_attempt_number !== 'number'
    || pc.claim_attempt_number !== context.currentPhysicalClaimAttempt || pc.claim_attempt_number >= context.attempt
    || !Number.isSafeInteger(pc.claim_attempt_number) || pc.claim_attempt_number < 1
    || typeof l.reuse_policy_version !== 'string' || !/^[1-9][0-9]*$/u.test(l.reuse_policy_version)
    || !Number.isSafeInteger(version) || version < 1) return null;
  return { adapterKey: a.adapter_key, adapterVersion: a.adapter_version, purpose: 'automatic', role: 'primary',
    sequence: 1, lookupId: context.currentLookupId, attemptId: context.currentAttemptId,
    claimAttempt: pc.claim_attempt_number, policyVersion: version };
}
