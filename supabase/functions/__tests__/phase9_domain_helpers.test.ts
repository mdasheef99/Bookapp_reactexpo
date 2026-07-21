import {
  assertQuantityInvariant,
  authorizeInitiatingOwnerSessionMutation,
  beginSessionClose,
  canonicalBcp47,
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13,
  mayCloseSession,
  finalizeSessionClose,
  parseCommandId,
  parseCandidateState,
  parseIdempotencyKey,
  parsePrivateInventoryPrice,
  parsePublicationPrice,
  parseQuantity,
  PHASE9_CANDIDATE_STATES,
  publicationRetryPlan,
  publicationRetryIdentity,
  recommendDuplicateAction,
  resolvePublicationOutcome,
  sessionAcceptsNewInputs,
  validateIsbnPair,
} from '../_shared/imageInventory/contracts';

describe('Phase 9 deterministic domain helpers', () => {
  it('normalizes and validates ISBNs without treating an unvalidated clue as authority', () => {
    expect(isValidIsbn10('0-306-40615-2')).toBe(true);
    expect(isValidIsbn13('978-0-306-40615-7')).toBe(true);
    expect(isbn10To13('0306406152')).toBe('9780306406157');
    expect(validateIsbnPair('0306406152', null)).toEqual({ isbn10: '0306406152', isbn13: '9780306406157' });
    expect(isValidIsbn13('9780306406158')).toBe(false);
  });

  it('canonicalizes supported BCP 47-shaped tags and rejects malformed values', () => {
    expect(canonicalBcp47('hi-deva-IN')).toBe('hi-Deva-IN');
    expect(() => canonicalBcp47('not_a_language')).toThrow(/BCP 47/i);
  });

  it('allows only the initiating Owner to close an active terminal-input session', () => {
    expect(authorizeInitiatingOwnerSessionMutation({ actorId: 'owner-a', initiatingOwnerId: 'owner-a', state: 'active' })).toEqual({ allowed: true, reason: 'allowed' });
    expect(authorizeInitiatingOwnerSessionMutation({ actorId: 'owner-b', initiatingOwnerId: 'owner-a', state: 'active' }).reason).toBe('not_initiator');
    expect(mayCloseSession({ actorId: 'owner-a', initiatingOwnerId: 'owner-a', state: 'active', hasNonterminalInputs: false })).toEqual({ allowed: true, reason: 'allowed' });
    expect(mayCloseSession({ actorId: 'owner-a', initiatingOwnerId: 'owner-a', state: 'active', hasNonterminalInputs: true }).reason).toBe('processing');
  });

  it('moves active to closing to closed and rejects new inputs while closing', () => {
    const closing = beginSessionClose({ state: 'active', hasNonterminalInputs: false });
    expect(closing).toBe('closing');
    expect(sessionAcceptsNewInputs(closing)).toBe(false);
    expect(finalizeSessionClose(closing)).toBe('closed');
    expect(() => beginSessionClose({ state: 'active', hasNonterminalInputs: true })).toThrow(/remains active/i);
  });

  it('ignores private request photos when recommending duplicate action', () => {
    const baseline = {
      sameStore: true,
      exactValidatedEdition: true,
      compatibleLanguageFormatConditionPrice: true,
      copySpecificDamageOrNote: false,
      approvedPublicCopyMedia: false,
      privateRequestMedia: false,
    };
    expect(recommendDuplicateAction(baseline)).toBe('increment_quantity');
    expect(recommendDuplicateAction({ ...baseline, privateRequestMedia: true })).toBe('increment_quantity');
    expect(recommendDuplicateAction({ ...baseline, approvedPublicCopyMedia: true })).toBe('create_separate');
    expect(recommendDuplicateAction({ ...baseline, sameStore: false })).toBe('no_duplicate_warning');
  });

  it('locks publication retry to the original commit and idempotency identity', () => {
    expect(publicationRetryIdentity({ originalCommitId: 'commit-000000000001', originalIdempotencyKey: 'owner-key-00000001' }))
      .toBe('publication:commit-000000000001:owner-key-00000001');
  });

  it('preserves private inventory on publication failure and forbids retry inventory writes', () => {
    const outcome = resolvePublicationOutcome({ privateInventoryCommitted: true, publicationRequested: true, projectionSucceeded: false });
    expect(outcome).toBe('committed_publication_failed');
    expect(publicationRetryPlan({ outcome, originalCommitId: 'commit-000000000001', originalIdempotencyKey: 'owner-key-00000001' }))
      .toMatchObject({ mayWriteInventory: false, reauthorizePublication: true });
    expect(PHASE9_CANDIDATE_STATES).toContain('committed');
    expect(PHASE9_CANDIDATE_STATES).not.toContain(outcome);
    expect(parseCandidateState('committed')).toBe('committed');
    expect(() => parseCandidateState(outcome)).toThrow(/unsupported persisted candidate state/i);
  });

  it('allows zero-price private inventory but requires positive publication price', () => {
    expect(parsePrivateInventoryPrice(0)).toBe(0);
    expect(parsePrivateInventoryPrice(999)).toBe(999);
    expect(parsePublicationPrice(1)).toBe(1);
    expect(() => parsePublicationPrice(0)).toThrow(/safe integer/i);
    expect(() => parsePrivateInventoryPrice(-1)).toThrow(/safe integer/i);
    expect(() => parsePrivateInventoryPrice(Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/i);
  });

  it('preserves the Phase 6 quantity-bucket equality', () => {
    expect(() => assertQuantityInvariant({ total: 10, available: 4, reserved: 2, sold: 3, removed: 1 })).not.toThrow();
    expect(() => assertQuantityInvariant({ total: 10, available: 10, reserved: 2, sold: 0, removed: 0 })).toThrow(/total must equal/i);
    expect(() => assertQuantityInvariant({ total: Number.MAX_SAFE_INTEGER + 1, available: 0, reserved: 0, sold: 0, removed: 0 })).toThrow(/safe integers/i);
  });

  it('validates quantity, integer minor money, idempotency keys, and command UUIDs centrally', () => {
    expect(parseQuantity(1)).toBe(1);
    expect(parsePrivateInventoryPrice(999)).toBe(999);
    expect(parseIdempotencyKey('owner-key-00000001')).toBe('owner-key-00000001');
    expect(parseCommandId('00000000-0000-4000-8000-000000000001')).toBe('00000000-0000-4000-8000-000000000001');
    expect(() => parseQuantity(-1)).toThrow(/safe integer/i);
    expect(() => parsePrivateInventoryPrice(10.5)).toThrow(/safe integer/i);
    expect(() => parseIdempotencyKey('../short secret')).toThrow(/invalid format|16/i);
    expect(() => parseCommandId('not-a-command')).toThrow(/invalid format/i);
  });
});
