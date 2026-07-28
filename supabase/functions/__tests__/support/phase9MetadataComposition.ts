import { buildMetadataQueryIdentity } from '../../_shared/imageInventory/metadata';
import { MetadataProductionGateway } from '../../_shared/imageInventory/runtime/metadataProductionComposition';

const query = buildMetadataQueryIdentity({
  strategy: 'isbn',
  isbnClue: '9780306406157',
  title: 'The Fixture Book',
  authors: ['Fixture Author'],
  language: 'en',
  editionClues: [],
});

export function metadataGateway(
  overrides: Partial<MetadataProductionGateway> = {},
) {
  const calls: string[] = [];
  const base: MetadataProductionGateway = {
    resolveLocal: jest.fn(async () => (
      calls.push('local'), { outcome: 'insufficient' as const }
    )),
    readCache: jest.fn(async () => (
      calls.push('cache'), { outcome: 'miss' as const }
    )),
    completeCacheHit: jest.fn(async (_request, normalizedOutcome) => {
      calls.push('complete-cache');
      return { status: 'completed' as const, normalizedOutcome };
    }),
    decideCoalescing: jest.fn(async () => (
      calls.push('coalescing'), { mode: 'leader' as const }
    )),
    registerFollower: jest.fn(async () => {
      calls.push('follower');
      return {
        status: 'completed' as const,
        normalizedOutcome: 'coalesced_follower',
      };
    }),
    registerLookup: jest.fn(async () => (
      calls.push('lookup'), { lookupId: 'lookup-1' }
    )),
    reserveUsage: jest.fn(async () => (
      calls.push('reserve'), { reservationId: 'reservation-1' }
    )),
    registerAttempt: jest.fn(async () => (
      calls.push('attempt'), { attemptId: 'attempt-1' }
    )),
    validateEgress: jest.fn(async () => {
      calls.push('fence');
      return true;
    }),
    invokePrimary: jest.fn(async () => (calls.push('provider'), {
      outcome: 'no_acceptable_match' as const,
      candidates: [],
      selected: null,
      evidence: [],
      retryable: false,
      providerRequestId: null,
    })),
    finalizeAttempt: jest.fn(async () => { calls.push('finalize'); }),
    persistCache: jest.fn(async () => { calls.push('persist-cache'); }),
    persistSelection: jest.fn(async () => { calls.push('selection'); }),
    completeManual: jest.fn(async () => { calls.push('manual'); }),
  };
  return { calls, value: Object.assign(base, overrides) };
}

export const metadataRequest = {
  candidateId: 'candidate-1',
  storeId: 'store-1',
  jobId: 'job-1',
  claimAttempt: 1,
  claimWorker: 'metadata-worker-0001',
  claimLeaseToken: 'lease-token',
  query,
  providerPolicy: {
    enabled: true,
    adapterVersionCompatible: true,
    capabilityVersionCompatible: true,
    matchingAllowed: true,
    storageAllowed: true,
    reuseAllowed: true,
    pricingPolicyCompatible: true,
  },
};
