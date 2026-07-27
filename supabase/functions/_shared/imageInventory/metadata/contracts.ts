import { MetadataEdition } from '../contracts/metadata';
import { MetadataProviderRole, NormalizedProviderOutcome } from './routing';
import { MetadataQueryIdentity, MetadataLookupStrategy } from './queryIdentity';
import { ManualReviewOutcome, SelectedMetadataSnapshot } from './snapshot';

export const METADATA_FOUNDATION_CONTRACT_VERSION = 'p9-metadata-foundation-v1' as const;
export const METADATA_ROUTING_POLICY_VERSION = 'p9-metadata-routing-v1' as const;

export type NormalizedMetadataLookupRequest = Readonly<{
  contractVersion: typeof METADATA_FOUNDATION_CONTRACT_VERSION;
  candidateId: string;
  strategy: MetadataLookupStrategy;
  query: MetadataQueryIdentity;
}>;

export type NormalizedEditionCandidate = MetadataEdition;

export type NormalizedMetadataProviderOutcome = Readonly<{
  contractVersion: typeof METADATA_FOUNDATION_CONTRACT_VERSION;
  outcome: NormalizedProviderOutcome;
  candidates: readonly NormalizedEditionCandidate[];
}>;

export type MetadataAttemptContext = Readonly<{
  lookupId: string;
  candidateId: string;
  storeId: string;
  queryKey: string;
  providerRole: MetadataProviderRole;
  attemptSequence: 1 | 2;
  adapterKey: string;
  adapterVersion: string;
  capabilityVersion: string;
  routingPolicyVersion: string;
  predecessorOutcome: NormalizedProviderOutcome | 'local_insufficient';
  usageReservationId: string | null;
}>;

export type ProviderCapabilityDeclaration = Readonly<{
  role: MetadataProviderRole;
  adapterKey: string;
  adapterVersion: string;
  capabilityVersion: string;
  enabled: boolean;
  maxAttempts: 1;
  supportedStrategies: readonly MetadataLookupStrategy[];
  supportsIsbn10: boolean;
  supportsIsbn13: boolean;
  supportedLanguages: readonly string[];
  normalizedOutcomes: readonly NormalizedProviderOutcome[];
  returnsCoherentEditions: true;
  reusePolicyVersion: string;
}>;

export type MetadataSelection = Readonly<{
  snapshot: SelectedMetadataSnapshot | null;
  outcome: ManualReviewOutcome;
}>;

export type MetadataReuseLineage = Readonly<{
  leaderLookupId: string | null;
  sourceAttemptId: string | null;
  createsProviderCharge: boolean;
}>;
