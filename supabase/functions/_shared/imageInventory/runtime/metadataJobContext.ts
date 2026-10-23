type RpcResult = Readonly<{ data: unknown; error: unknown }>;
export type MetadataRpcClient = Readonly<{
  rpc(name: string, parameters: Readonly<Record<string, unknown>>): Promise<RpcResult>;
}>;

type ProviderPolicy = Readonly<{
  adapterKey: string;
  adapterVersion: string;
  enabled: boolean;
  matchingAllowed: boolean;
  storageAllowed: boolean;
  reuseAllowed: boolean;
  policyVersion: number;
}>;

export type MetadataJobContext = Readonly<{
  contractVersion: 'p9-metadata-job-context-v2';
  jobId: string;
  attempt: number;
  claimToken: string;
  candidateId: string;
  candidateState: 'processing' | 'ready' | 'needs_review' | 'possible_duplicate';
  purpose: 'automatic' | 'edition_options';
  requestGeneration: number | null;
  optionsVersion: number | null;
  optionsAvailable: boolean;
  optionsExpiresAt: string | null;
  candidateVersion: number;
  storeId: string;
  sessionId: string;
  inputId: string | null;
  observationId: string | null;
  title: string;
  authors: readonly string[];
  isbnClue: string | null;
  publisherClue: string | null;
  language: string;
  script: string | null;
  queryIdentity: string;
  localCanonicalEditionId: string | null;
  reusableLookupId: string | null;
  reusableOutcome: string | null;
  currentLookupId: string | null;
  currentLookupAdapterKey?: string | null;
  currentLookupAdapterVersion?: string | null;
  currentAttemptAdapterKey?: string | null;
  currentOutcome: string | null;
  currentAttemptId: string | null;
  currentAttemptOutcome: string | null;
  currentAttemptDisposition: 'unresolved' | 'accepted' | 'rejected' | 'stale' | 'failed' | null;
  currentAttemptCandidate: Record<string, unknown> | null;
  currentAttemptProviderRequestId: string | null;
  currentPhysicalStatus: 'registered' | 'finalized' | 'outcome_unknown' | 'stale_rejected' | null;
  currentPhysicalClaimAttempt: number | null;
  currentPhysicalOutcome: string | null;
  currentPhysicalLogicalOutcome: string | null;
  currentPhysicalProviderRequestId: string | null;
  currentPhysicalRetryable: boolean | null;
  currentPhysicalCandidate: Record<string, unknown> | null;
  currentPhysicalEvidence: readonly string[] | null;
  providerPolicies: readonly ProviderPolicy[];
}>;

const contextKeys = new Set([
  'contractVersion','jobId','attempt','claimToken','claimExpiresAt','candidateId',
  'candidateState','candidateVersion','storeId','sessionId','inputId','observationId',
  'title','authors','isbnClue','publisherClue','language','script','queryIdentity',
  'metadataContractVersion','lookupContractVersion','normalizerVersion',
  'routingPolicyVersion','selectionPolicyVersion','localCanonicalEditionId',
  'reusableLookupId','reusableOutcome','currentLookupId','currentOutcome',
  'currentAttemptId','currentAttemptOutcome','providerPolicies',
  'currentLookupAdapterKey','currentLookupAdapterVersion','currentAttemptAdapterKey',
  'currentAttemptDisposition','currentAttemptCandidate','currentAttemptProviderRequestId',
  'currentPhysicalStatus','currentPhysicalClaimAttempt','currentPhysicalOutcome','currentPhysicalProviderRequestId',
  'currentPhysicalLogicalOutcome',
  'currentPhysicalRetryable','currentPhysicalCandidate','currentPhysicalEvidence',
  'purpose','requestGeneration','optionsVersion','optionsAvailable','optionsExpiresAt',
]);
const policyKeys = new Set([
  'adapterKey','adapterVersion','enabled','matchingAllowed','storageAllowed',
  'reuseAllowed','policyVersion',
]);

export const metadataObject = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('P9_METADATA_CONTEXT_INVALID');
  }
  return value as Record<string, unknown>;
};
export const metadataText = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error('P9_METADATA_CONTEXT_INVALID');
  return value;
};
const nullableText = (value: unknown): string | null => value === null ? null : metadataText(value);
const hasOnly = (row: Record<string, unknown>, keys: ReadonlySet<string>) =>
  Object.keys(row).every((key) => keys.has(key));

export function decodeMetadataJobContext(value: unknown): MetadataJobContext {
  const row = metadataObject(value);
  if (!hasOnly(row, contextKeys)) throw new Error('P9_METADATA_CONTEXT_INVALID');
  const purpose = row.purpose ?? 'automatic';
  if (!['automatic','edition_options'].includes(purpose as string)
    || (purpose === 'automatic' && row.candidateState !== 'processing')
    || (purpose === 'edition_options' && (!['ready','needs_review','possible_duplicate'].includes(row.candidateState as string)
      || !Number.isSafeInteger(row.requestGeneration) || Number(row.requestGeneration) < 0
      || !Number.isSafeInteger(row.optionsVersion) || Number(row.optionsVersion) < 0
      || typeof row.optionsAvailable !== 'boolean'
      || (row.optionsExpiresAt !== null && (typeof row.optionsExpiresAt !== 'string'
        || !Number.isFinite(Date.parse(row.optionsExpiresAt))))))) throw new Error('P9_METADATA_CONTEXT_INVALID');
  const policies = Array.isArray(row.providerPolicies) ? row.providerPolicies.map((item) => {
    const policy = metadataObject(item);
    if (!hasOnly(policy, policyKeys) || typeof policy.enabled !== 'boolean'
      || typeof policy.matchingAllowed !== 'boolean' || typeof policy.storageAllowed !== 'boolean'
      || typeof policy.reuseAllowed !== 'boolean' || !Number.isInteger(policy.policyVersion)) {
      throw new Error('P9_METADATA_CONTEXT_INVALID');
    }
    return Object.freeze({
      adapterKey: metadataText(policy.adapterKey), adapterVersion: metadataText(policy.adapterVersion),
      enabled: policy.enabled, matchingAllowed: policy.matchingAllowed,
      storageAllowed: policy.storageAllowed, reuseAllowed: policy.reuseAllowed,
      policyVersion: policy.policyVersion as number,
    });
  }) : [];
  if (row.contractVersion !== 'p9-metadata-job-context-v2'
    || !Number.isInteger(row.attempt)
    || !Number.isInteger(row.candidateVersion) || !Array.isArray(row.authors)
    || row.authors.some((author) => typeof author !== 'string')
    || ![null, 'unresolved', 'accepted', 'rejected', 'stale', 'failed']
      .includes(row.currentAttemptDisposition as string | null)
    || ![undefined, null, 'registered', 'finalized', 'outcome_unknown', 'stale_rejected']
      .includes(row.currentPhysicalStatus as string | null | undefined)
    || (row.currentPhysicalClaimAttempt !== null
      && (!Number.isInteger(row.currentPhysicalClaimAttempt)
        || Number(row.currentPhysicalClaimAttempt) < 1
        || Number(row.currentPhysicalClaimAttempt) > 5))
    || (row.currentPhysicalStatus !== null && row.currentPhysicalClaimAttempt === null)
    || ![undefined, null, true, false].includes(row.currentPhysicalRetryable as boolean | null | undefined)
    || (row.currentPhysicalEvidence != null && (!Array.isArray(row.currentPhysicalEvidence)
      || row.currentPhysicalEvidence.some((item) => typeof item !== 'string')))) {
    throw new Error('P9_METADATA_CONTEXT_INVALID');
  }
  return Object.freeze({
    contractVersion: row.contractVersion, jobId: metadataText(row.jobId),
    attempt: row.attempt as number, claimToken: metadataText(row.claimToken),
    candidateId: metadataText(row.candidateId), candidateState: row.candidateState as MetadataJobContext['candidateState'],
    purpose: purpose as MetadataJobContext['purpose'],
    requestGeneration: purpose === 'edition_options' ? row.requestGeneration as number : null,
    optionsVersion: purpose === 'edition_options' ? row.optionsVersion as number : null,
    optionsAvailable: purpose === 'edition_options' && row.optionsAvailable === true,
    optionsExpiresAt: purpose === 'edition_options' ? nullableText(row.optionsExpiresAt) : null,
    candidateVersion: row.candidateVersion as number, storeId: metadataText(row.storeId),
    sessionId: metadataText(row.sessionId),
    inputId: purpose === 'edition_options' ? nullableText(row.inputId) : metadataText(row.inputId),
    observationId: purpose === 'edition_options' ? nullableText(row.observationId) : metadataText(row.observationId),
    title: purpose === 'edition_options' && row.title === '' ? '' : metadataText(row.title),
    authors: Object.freeze([...row.authors] as string[]), isbnClue: nullableText(row.isbnClue),
    publisherClue: nullableText(row.publisherClue), language: metadataText(row.language),
    script: nullableText(row.script), queryIdentity: metadataText(row.queryIdentity),
    localCanonicalEditionId: nullableText(row.localCanonicalEditionId),
    reusableLookupId: nullableText(row.reusableLookupId), reusableOutcome: nullableText(row.reusableOutcome),
    currentLookupId: nullableText(row.currentLookupId), currentOutcome: nullableText(row.currentOutcome),
    currentLookupAdapterKey: nullableText(row.currentLookupAdapterKey ?? null),
    currentLookupAdapterVersion: nullableText(row.currentLookupAdapterVersion ?? null),
    currentAttemptAdapterKey: nullableText(row.currentAttemptAdapterKey ?? null),
    currentAttemptId: nullableText(row.currentAttemptId),
    currentAttemptOutcome: nullableText(row.currentAttemptOutcome),
    currentAttemptDisposition: row.currentAttemptDisposition === null ? null
      : metadataText(row.currentAttemptDisposition) as MetadataJobContext['currentAttemptDisposition'],
    currentAttemptCandidate: row.currentAttemptCandidate === null ? null
      : metadataObject(row.currentAttemptCandidate),
    currentAttemptProviderRequestId: nullableText(row.currentAttemptProviderRequestId),
    currentPhysicalStatus: (row.currentPhysicalStatus ?? null) as MetadataJobContext['currentPhysicalStatus'],
    currentPhysicalClaimAttempt: row.currentPhysicalClaimAttempt as number | null,
    currentPhysicalOutcome: nullableText(row.currentPhysicalOutcome ?? null),
    currentPhysicalLogicalOutcome: nullableText(row.currentPhysicalLogicalOutcome ?? null),
    currentPhysicalProviderRequestId: nullableText(row.currentPhysicalProviderRequestId ?? null),
    currentPhysicalRetryable: (row.currentPhysicalRetryable ?? null) as boolean | null,
    currentPhysicalCandidate: row.currentPhysicalCandidate == null ? null
      : metadataObject(row.currentPhysicalCandidate),
    currentPhysicalEvidence: row.currentPhysicalEvidence == null ? null
      : Object.freeze([...(row.currentPhysicalEvidence as string[])]),
    providerPolicies: Object.freeze(policies),
  });
}

export async function loadMetadataJobContext(
  client: MetadataRpcClient,
  claim: Readonly<{ jobId: string; worker: string; leaseToken: string; attempt: number }>,
): Promise<MetadataJobContext> {
  const result = await client.rpc('phase9_metadata_job_context', {
    p_job_id: claim.jobId, p_worker: claim.worker,
    p_lease_token: claim.leaseToken, p_attempt_count: claim.attempt,
  });
  if (result.error !== null) throw new Error('P9_METADATA_RPC_FAILED:phase9_metadata_job_context');
  try {
    const context = decodeMetadataJobContext(result.data);
    if (context.jobId !== claim.jobId || context.claimToken !== claim.leaseToken || context.attempt !== claim.attempt) {
      throw new Error('P9_METADATA_CONTEXT_INVALID');
    }
    return context;
  } catch (error) {
    if (result.data !== null && typeof result.data === 'object'
      && 'purpose' in result.data && result.data.purpose === 'edition_options') {
      throw new Error('P9_EDITION_CONTEXT_INVALID');
    }
    throw error;
  }
}
