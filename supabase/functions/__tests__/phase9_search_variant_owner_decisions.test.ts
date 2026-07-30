import {
  buildOwnerVariantDecisionCommand,
  parseOwnerVariantReviewPage,
} from '../_shared/imageInventory/searchVariants/ownerDecisions';

describe('Phase 9 Unit 5C-5 Owner decision contracts', () => {
  it('builds an exact-version, idempotent field-specific approve command', () => {
    expect(buildOwnerVariantDecisionCommand({
      storeId: '72000000-0000-0000-0000-000000000051',
      proposalId: '79000000-0000-0000-0000-000000000051',
      expectedVersion: 3,
      action: 'approve',
      reason: 'owner_confirmed',
      note: 'Checked against the spine.',
      idempotencyKey: 'owner-approve-00000051',
    })).toEqual({
      p_store_id: '72000000-0000-0000-0000-000000000051',
      p_proposal_id: '79000000-0000-0000-0000-000000000051',
      p_expected_version: 3,
      p_action: 'approve',
      p_reason: 'owner_confirmed',
      p_note: 'Checked against the spine.',
      p_idempotency_key: 'owner-approve-00000051',
    });
  });

  it('rejects mutation-shaped or unbounded decision inputs', () => {
    expect(() => buildOwnerVariantDecisionCommand({
      storeId: '72000000-0000-0000-0000-000000000051',
      proposalId: '79000000-0000-0000-0000-000000000051',
      expectedVersion: 0,
      action: 'approve',
      reason: 'owner_confirmed',
      note: null,
      idempotencyKey: 'short',
    })).toThrow('expected_version');
  });

  it('parses only the UI-safe review projection and one-based authors', () => {
    const page = parseOwnerVariantReviewPage([{
      proposal_id: '79000000-0000-0000-0000-000000000051',
      concurrency_version: 2,
      target_type: 'author',
      author_position: 1,
      confirmed_source_text: 'ಲೇಖಕ',
      proposed_text: 'Lekhak',
      variant_type: 'primary_roman',
      source_language: 'kn',
      source_script: 'Knda',
      variant_language: 'kn-Latn',
      variant_script: 'Latn',
      lifecycle_status: 'proposed',
      generation_source: 'vision_model',
      provider_key: 'google_gemini',
      model_key: 'gemini-3.5-flash-lite',
      model_version: 'gemini-3.5-flash-lite',
      prompt_version: 'gemini-spine-v1',
      schema_version: 'search_variant_proposals_v1',
      automatic_activation_denial_reason: 'rollout_not_approved',
      stale_conflict_reason: null,
      created_at: '2026-07-29T10:00:00.000Z',
      allowed_actions: ['approve', 'reject', 'replace', 'leave_unresolved'],
    }]);
    expect(page[0]).toMatchObject({
      targetType: 'author',
      authorPosition: 1,
      allowedActions: ['approve', 'reject', 'replace', 'leave_unresolved'],
    });
    expect(JSON.stringify(page)).not.toContain('raw_provider');
  });
});
