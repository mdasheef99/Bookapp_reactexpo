import { ProviderCapabilityDeclaration } from '../contracts';
import { NormalizedProviderOutcome } from '../routing';

export const GOOGLE_BOOKS_CAPABILITY: ProviderCapabilityDeclaration = Object.freeze({
  role: 'primary',
  adapterKey: 'google_books',
  adapterVersion: '1.0.0',
  capabilityVersion: 'google-books-capability-v1',
  enabled: true,
  maxAttempts: 1,
  supportedStrategies: Object.freeze(['isbn', 'bibliographic'] as const),
  supportsIsbn10: true,
  supportsIsbn13: true,
  supportedLanguages: Object.freeze(['*']),
  normalizedOutcomes: Object.freeze([
    'coherent_match', 'no_acceptable_match', 'ambiguous_match', 'material_conflict',
    'malformed_response', 'timeout', 'rate_limited', 'provider_unavailable',
    'invalid_query', 'authentication_configuration_failure',
  ] satisfies NormalizedProviderOutcome[]),
  returnsCoherentEditions: true,
  reusePolicyVersion: 'google-books-reuse-v1',
});

export * from './adapter';
export * from './decoder';
export * from './ranking';
export * from './request';
