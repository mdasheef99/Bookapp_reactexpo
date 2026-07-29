import {
  classifySearchVariantSource,
  normalizeVariantComparisonText,
} from '../_shared/imageInventory/searchVariants/reconciliation';
import {
  denyAutomaticVariantActivationPolicy,
  planSearchVariantLifecycle,
} from '../_shared/imageInventory/searchVariants/activationPolicy';
import {
  reconcileCandidateSearchVariants,
} from '../_shared/imageInventory/runtime/searchVariantReconciliation';

const source = {
  field: 'observation:1:title',
  observationId: 'observation-1',
  text: 'ಮೂಕಜ್ಜಿಯ ಕನಸುಗಳು',
  language: 'kn',
  script: 'Knda',
} as const;

const confirmed = {
  ...source,
  text: 'ಮೂಕಜ್ಜಿಯ ಕನಸುಗಳು',
} as const;

const primary = {
  id: '30000000-0000-4000-8000-000000000001',
  status: 'proposed',
  targetType: 'title',
  variantType: 'primary_roman',
  variantText: 'Mookajjiya Kanasugalu',
  variantLanguage: 'kn-Latn',
  variantScript: 'Latn',
  source,
} as const;

describe('Phase 9 Unit 5C-3 deterministic source reconciliation', () => {
  it.each([
    ['  MŪKAJJiya   Kanasugalu ', 'mūkajjiya kanasugalu'],
    ['R. K. Narayan', 'r k narayan'],
    ['R K Narayan', 'r k narayan'],
    ['Title—Part', 'title part'],
    ['Ｔｉｔｌｅ', 'title'],
  ])('normalizes only narrow representation differences: %s', (input, expected) => {
    expect(normalizeVariantComparisonText(input)).toBe(expected);
  });

  it('classifies exact, whitespace, punctuation and initials-only changes as equivalent', () => {
    expect(classifySearchVariantSource(source, confirmed).outcome).toBe('equivalent');
    expect(classifySearchVariantSource(
      { ...source, text: 'R. K. Narayan' },
      { ...confirmed, text: '  r k  narayan ' },
    ).outcome).toBe('equivalent');
  });

  it.each([
    ['ಮೂಕಜ್ಜಿಯ ಕನಸುಗಳು ಭಾಗ 2', 'volume/part change'],
    ['ಮೂಕಜ್ಜಿಯ ಕನಸುಗಳು — Special Edition', 'edition contamination'],
    ['ಮೂಕಜ್ಜಿಯ ಕನಸುಗಳು: A Novel', 'subtitle contamination'],
    ['ಮೂಕಜ್ಜಿಯ ಕನಸು', 'meaningful spelling change'],
  ])('classifies material title changes independently: %s', (text) => {
    expect(classifySearchVariantSource(source, { ...confirmed, text }).outcome)
      .toBe('materially_changed');
  });

  it('distinguishes missing confirmation, wrong field/observation and language/script conflicts', () => {
    expect(classifySearchVariantSource(source, null).outcome).toBe('not_confirmed');
    expect(classifySearchVariantSource(
      source,
      { ...confirmed, field: 'observation:1:author:1' },
    ).outcome).toBe('invalid_source_reference');
    expect(classifySearchVariantSource(
      source,
      { ...confirmed, observationId: 'observation-2' },
    ).outcome).toBe('invalid_source_reference');
    expect(classifySearchVariantSource(
      source,
      { ...confirmed, language: 'hi', script: 'Deva' },
    ).outcome).toBe('conflicting');
  });
});

describe('Phase 9 Unit 5C-3 fail-closed lifecycle policy', () => {
  it('keeps an eligible primary proposed under the production deny policy', async () => {
    await expect(planSearchVariantLifecycle(
      primary,
      { outcome: 'equivalent' },
      denyAutomaticVariantActivationPolicy,
    )).resolves.toMatchObject({ action: 'retain', status: 'proposed' });
  });

  it('passes only policy-approved proposal IDs to the hardened lifecycle RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { activated_count: 1, stale_count: 0 },
      error: null,
    });
    await reconcileCandidateSearchVariants(
      { rpc },
      {
        storeId: '10000000-0000-4000-8000-000000000001',
        candidateId: '20000000-0000-4000-8000-000000000001',
        proposals: [{ proposal: primary, reconciliation: { outcome: 'equivalent' } }],
      },
      { key: 'test_allow_v1', allows: async () => true },
    );
    expect(rpc).toHaveBeenCalledWith('phase9_reconcile_search_variants', {
      p_store_id: '10000000-0000-4000-8000-000000000001',
      p_candidate_id: '20000000-0000-4000-8000-000000000001',
      p_allowed_proposal_ids: ['30000000-0000-4000-8000-000000000001'],
      p_policy_key: 'test_allow_v1',
    });
  });

  it('activates only an eligible primary when an explicit policy allows it', async () => {
    const allow = { allows: jest.fn().mockResolvedValue(true), key: 'test_allow_v1' };
    await expect(planSearchVariantLifecycle(
      primary,
      { outcome: 'equivalent' },
      allow,
    )).resolves.toMatchObject({ action: 'activate', status: 'active' });
    expect(allow.allows).toHaveBeenCalledWith(expect.objectContaining({
      proposalId: '30000000-0000-4000-8000-000000000001',
      modelKey: undefined,
    }));
  });

  it.each([
    ['roman_alternative', 'Alternate'],
    ['translation_candidate', 'Dreams of Mookajji'],
  ] as const)('keeps %s proposals inactive even under an allow policy', async (
    variantType,
    variantText,
  ) => {
    await expect(planSearchVariantLifecycle(
      { ...primary, variantType, variantText },
      { outcome: 'equivalent' },
      { key: 'test_allow_v1', allows: async () => true },
    )).resolves.toMatchObject({ action: 'retain', status: 'proposed' });
  });

  it('stales only the materially changed linked proposal and never reactivates stale rows', async () => {
    await expect(planSearchVariantLifecycle(
      primary,
      { outcome: 'materially_changed' },
      { key: 'test_allow_v1', allows: async () => true },
    )).resolves.toMatchObject({ action: 'stale', status: 'stale' });
    await expect(planSearchVariantLifecycle(
      { ...primary, status: 'stale' },
      { outcome: 'equivalent' },
      { key: 'test_allow_v1', allows: async () => true },
    )).resolves.toMatchObject({ action: 'retain', status: 'stale' });
  });

  it('stales an active proposal when its exact source confirmation is removed', async () => {
    await expect(planSearchVariantLifecycle(
      { ...primary, status: 'active' },
      { outcome: 'not_confirmed' },
      { key: 'test_allow_v1', allows: async () => true },
    )).resolves.toMatchObject({
      action: 'stale',
      status: 'stale',
      reason: 'not_confirmed',
    });
  });

  it('never activates a trivial already-Latin transformation or on confidence alone', async () => {
    const latin = {
      ...primary,
      source: { ...source, text: 'The Guide', language: 'en', script: 'Latn' },
      variantText: 'The Guide',
      confidence: 1,
    };
    await expect(planSearchVariantLifecycle(
      latin,
      { outcome: 'equivalent' },
      { key: 'test_allow_v1', allows: async () => true },
    )).resolves.toMatchObject({ action: 'retain', status: 'proposed' });
  });
});
