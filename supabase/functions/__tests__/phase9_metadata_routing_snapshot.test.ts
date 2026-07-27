import {
  createSelectedMetadataSnapshot,
  manualReviewOutcome,
  planMetadataRouting,
  validateMetadataProviderConfiguration,
} from '../_shared/imageInventory/contracts';
import { coherentEnglishEdition, conflictingHindiEdition } from './fixtures/phase9/metadataFixtures';

describe('Phase 9 Unit 5A routing, selection, and manual outcomes', () => {
  const primary = {
    role: 'primary' as const,
    adapterKey: 'recorded_metadata',
    adapterVersion: '1.0.0',
    capabilityVersion: 'cap-v1',
    enabled: true,
  };

  it('requires exactly one primary and leaves the secondary unselected', () => {
    expect(validateMetadataProviderConfiguration({ primary, secondary: null }))
      .toEqual({ primary, secondary: null });
    expect(() => validateMetadataProviderConfiguration({ primary: null, secondary: null }))
      .toThrow(/exactly one primary/i);
  });

  it('terminates on coherent primary success and bounds each role to one attempt', () => {
    expect(planMetadataRouting({
      configured: { primary, secondary: null },
      localOutcome: 'insufficient',
      attempts: [{ role: 'primary', adapterKey: 'recorded_metadata',
        adapterVersion: '1.0.0', normalizedOutcome: 'coherent_match' }],
    })).toEqual({ action: 'complete', nextRole: null });
    expect(() => planMetadataRouting({
      configured: { primary, secondary: null },
      localOutcome: 'insufficient',
      attempts: [
        { role: 'primary', adapterKey: 'recorded_metadata',
          adapterVersion: '1.0.0', normalizedOutcome: 'timeout' },
        { role: 'primary', adapterKey: 'recorded_metadata',
          adapterVersion: '1.0.0', normalizedOutcome: 'timeout' },
      ],
    })).toThrow(/one external attempt/i);
  });

  it('rejects secondary-first or reordered attempt histories', () => {
    expect(() => planMetadataRouting({
      configured: { primary, secondary: null },
      localOutcome: 'insufficient',
      attempts: [{ role: 'secondary', adapterKey: 'recorded_metadata',
        adapterVersion: '1.0.0', normalizedOutcome: 'timeout' }],
    })).toThrow(/primary then optional secondary/i);
  });

  it('rejects attempts outside the configured adapter identity', () => {
    expect(() => planMetadataRouting({
      configured: { primary, secondary: null },
      localOutcome: 'insufficient',
      attempts: [{ role: 'primary', adapterKey: 'other_metadata',
        adapterVersion: '1.0.0', normalizedOutcome: 'timeout' }],
    })).toThrow(/configured provider/i);
  });

  it('creates one immutable provider-neutral snapshot without field stitching', () => {
    const selected = createSelectedMetadataSnapshot({
      edition: coherentEnglishEdition,
      selectedAttemptId: coherentEnglishEdition.attempt_id,
      selectionPolicyVersion: 'selection-v1',
      matchEvidence: ['validated_isbn'],
      state: 'accepted_metadata_match',
      canonicalEditionId: null,
    });
    expect(selected.title).toBe(coherentEnglishEdition.title);
    expect(selected.authors).toEqual(coherentEnglishEdition.authors);
    expect(selected.publisher).toBe(coherentEnglishEdition.publisher);
    expect(Object.isFrozen(selected)).toBe(true);
    expect(() => createSelectedMetadataSnapshot({
      edition: { ...coherentEnglishEdition, publisher: conflictingHindiEdition.publisher },
      selectedAttemptId: 'different-attempt',
      selectionPolicyVersion: 'selection-v1',
      matchEvidence: ['conflicting_provider_result'],
      state: 'accepted_metadata_match',
      canonicalEditionId: null,
    })).toThrow(/coherent provider attempt/i);
  });

  test.each([
    'local_canonical_match',
    'accepted_metadata_match',
    'ambiguous',
    'material_conflict',
    'no_match',
    'technical_failure',
    'policy_denied',
    'cost_quota_denied',
    'manual_metadata_required',
  ] as const)('represents closed manual outcome %s with manual completion', (outcome) => {
    expect(manualReviewOutcome(outcome)).toEqual({
      outcome,
      manualCompletionAvailable: true,
      createsInventory: false,
      publishesListing: false,
      approvesAlias: false,
    });
  });
});
