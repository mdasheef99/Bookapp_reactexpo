import type { ProviderCapabilityDeclaration } from '../contracts';
import type { NormalizedProviderOutcome } from '../routing';
export {OpenLibraryEditionOptionsAdapter} from './adapter';
// 02c §5.1: independent OL declarations (the Google capability spread is
// gone). v1 values are byte-identical to the previous spread result; v2
// declares the 2.0.0 capability.
const OPEN_LIBRARY_NORMALIZED_OUTCOMES = Object.freeze([
  'coherent_match', 'no_acceptable_match', 'ambiguous_match', 'material_conflict',
  'malformed_response', 'timeout', 'rate_limited', 'provider_unavailable',
  'invalid_query', 'authentication_configuration_failure',
] satisfies NormalizedProviderOutcome[]);
export const OPEN_LIBRARY_CAPABILITY:ProviderCapabilityDeclaration=Object.freeze({
  role:'primary',adapterKey:'open_library',adapterVersion:'1.0.0',
  capabilityVersion:'open-library-capability-v1',enabled:true,maxAttempts:1,
  supportedStrategies:Object.freeze(['isbn', 'bibliographic'] as const),
  supportsIsbn10:true,supportsIsbn13:true,supportedLanguages:Object.freeze(['*']),
  normalizedOutcomes:OPEN_LIBRARY_NORMALIZED_OUTCOMES,
  returnsCoherentEditions:true,reusePolicyVersion:'open-library-facts-v1',
});
export const OPEN_LIBRARY_CAPABILITY_V2:ProviderCapabilityDeclaration=Object.freeze({
  role:'primary',adapterKey:'open_library',adapterVersion:'2.0.0',
  capabilityVersion:'open-library-capability-v2',enabled:true,maxAttempts:1,
  supportedStrategies:Object.freeze(['isbn', 'bibliographic'] as const),
  supportsIsbn10:true,supportsIsbn13:true,supportedLanguages:Object.freeze(['*']),
  normalizedOutcomes:OPEN_LIBRARY_NORMALIZED_OUTCOMES,
  returnsCoherentEditions:true,reusePolicyVersion:'open-library-facts-v1',
});
