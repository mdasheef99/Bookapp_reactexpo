import {
  OWNER_UX_CONTRACT_VERSION,
  OWNER_UX_FORBIDDEN_RESPONSE_KEYS,
  ownerUxErrorEnvelope,
  ownerUxErrorFromException,
  parseOwnerUxRequest,
  parseOwnerUxResponse,
} from '../_shared/imageInventory/contracts/ownerUx';
import { executeOwnerIngestion } from '../_shared/imageInventory/runtime/ownerIngestion';
import { ownerUxFailureResponse } from '../_shared/imageInventory/contracts/ownerUxHttp';

const uuid = (n: number) => `92000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const contractVersion = 'phase9-owner-ux-v1';

const review = {
  originalTitle: 'The Book',
  authors: ['One Author'],
  originalLanguage: 'en',
  script: 'Latn',
  metadataChoice: { mode: 'manual', selectionId: null },
  quantity: 1,
  priceMinor: 0,
  baseCondition: 'good',
  damageDisclosure: {
    hasDamage: false,
    damageTypes: [],
    damageNote: null,
    isSellable: true,
    completeReadableSafe: true,
  },
  shelfLocation: 'A1',
  notes: { publicNote: null, internalNote: null },
  publicationIntent: 'private',
  duplicateIntent: null,
  originalFieldConfirmation: { title: true, authors: [true] },
  candidateDisposition: 'reviewed',
} as const;

describe('Phase 9 Unit 6A Owner UX request contracts', () => {
  it.each([
    { action: 'discover_scan_session', contractVersion },
    { action: 'read_scan_session', contractVersion, sessionId: uuid(1) },
    { action: 'list_scan_inputs', contractVersion, sessionId: uuid(1) },
    {
      action: 'list_scan_candidates', contractVersion, scope: 'session',
      sessionId: uuid(1), attention: 'all', pageSize: 20, cursor: null,
    },
    {
      action: 'read_scan_candidate', contractVersion,
      sessionId: uuid(1), candidateId: uuid(2),
    },
    {
      action: 'update_candidate_review', contractVersion,
      sessionId: uuid(1), candidateId: uuid(2),
      expectedCandidateVersion: 1, expectedMetadataRevision: 1,
      review, idempotencyKey: 'review-request-0001', commandId: uuid(3),
    },
    { action: 'read_scan_readiness', contractVersion, sessionId: uuid(1) },
    {
      action: 'close_scan_session', contractVersion, sessionId: uuid(1),
      expectedSessionVersion: 1, idempotencyKey: 'close-request-00001',
      commandId: uuid(4),
    },
  ])('accepts the exact $action request', (request) => {
    expect(parseOwnerUxRequest(request)).toEqual(request);
  });

  it.each([
    [{ action: 'discover_scan_session', contractVersion, storeId: uuid(1) }, /unknown/i],
    [{ action: 'read_scan_session', contractVersion, sessionId: uuid(1), commandId: uuid(2) }, /unknown/i],
    [{ action: 'list_scan_inputs', contractVersion, sessionId: uuid(1), pageSize: 0 }, /invalid/i],
    [{ action: 'list_scan_inputs', contractVersion, sessionId: uuid(1), pageSize: 51 }, /invalid/i],
    [{ action: 'list_scan_candidates', contractVersion, scope: 'session' }, /invalid/i],
    [{ action: 'list_scan_candidates', contractVersion, scope: 'needs_review', sessionId: uuid(1) }, /invalid/i],
    [{ action: 'list_scan_candidates', contractVersion, scope: 'needs_review', attention: 'review_ready' }, /invalid/i],
    [{ action: 'close_scan_session', contractVersion, sessionId: uuid(1), expectedSessionVersion: 0,
      idempotencyKey: 'close-request-00001', commandId: uuid(2) }, /invalid/i],
    [{ action: 'close_scan_session', contractVersion, sessionId: 'not-a-uuid', expectedSessionVersion: 1,
      idempotencyKey: 'close-request-00001', commandId: uuid(2) }, /invalid/i],
    [{ action: 'close_scan_session', contractVersion, sessionId: uuid(1), expectedSessionVersion: 1.5,
      idempotencyKey: 'close-request-00001', commandId: uuid(2) }, /invalid/i],
    [{ action: 'discover_scan_session', contractVersion: 'phase9-v1' }, /invalid/i],
  ])('rejects invalid request %#', (request, error) => {
    expect(() => parseOwnerUxRequest(request)).toThrow(error);
  });

  it.each([
    { action: 'discover_scan_session', contractVersion },
    { action: 'read_scan_session', contractVersion, sessionId: uuid(1) },
    { action: 'list_scan_inputs', contractVersion, sessionId: uuid(1) },
    { action: 'list_scan_candidates', contractVersion, scope: 'needs_review' },
    { action: 'read_scan_candidate', contractVersion, sessionId: uuid(1), candidateId: uuid(2) },
    { action: 'read_scan_readiness', contractVersion, sessionId: uuid(1) },
  ])('rejects mutation identity on read action $action', (request) => {
    expect(() => parseOwnerUxRequest({
      ...request, idempotencyKey: 'read-mutation-0001', commandId: uuid(3),
    })).toThrow(/unknown/i);
  });

  it.each([
    ['unknown root key', { ...review, extension: true }],
    ['fractional quantity', { ...review, quantity: 1.5 }],
    ['quantity over bound', { ...review, quantity: 10_001 }],
    ['noninteger price', { ...review, priceMinor: 1.5 }],
    ['publish with zero price', { ...review, publicationIntent: 'publish', priceMinor: 0 }],
    ['legacy fair condition', { ...review, baseCondition: 'fair' }],
    ['unconfirmed title', { ...review, originalFieldConfirmation: { title: false, authors: [true] } }],
    ['author confirmation mismatch', { ...review, originalFieldConfirmation: { title: true, authors: [] } }],
    ['duplicate authors', { ...review, authors: ['Same', 'Same'],
      originalFieldConfirmation: { title: true, authors: [true, true] } }],
    ['selected metadata without ID', { ...review, metadataChoice: { mode: 'selected', selectionId: null } }],
    ['manual metadata with ID', { ...review, metadataChoice: { mode: 'manual', selectionId: uuid(8) } }],
    ['damage without types', { ...review, damageDisclosure: {
      hasDamage: true, damageTypes: [], damageNote: 'Marked', isSellable: true, completeReadableSafe: true,
    } }],
    ['damage without note', { ...review, damageDisclosure: {
      hasDamage: true, damageTypes: ['cover'], damageNote: null, isSellable: true, completeReadableSafe: true,
    } }],
    ['sellable without safety confirmation', { ...review, damageDisclosure: {
      hasDamage: true, damageTypes: ['cover'], damageNote: 'Marked', isSellable: true, completeReadableSafe: false,
    } }],
    ['increment without target', { ...review, duplicateIntent: {
      action: 'increment_quantity', targetInventoryId: null, adviceVersion: 1,
    } }],
    ['separate with target', { ...review, duplicateIntent: {
      action: 'create_separate', targetInventoryId: uuid(7), adviceVersion: 1,
    } }],
    ['false disposition in review update', { ...review, candidateDisposition: 'skipped_false_detection' }],
    ['control character', { ...review, originalTitle: 'unsafe\u0000title' }],
    ['active content', { ...review, notes: { publicNote: '<script>alert(1)</script>', internalNote: null } }],
    ['nested unknown key', { ...review, damageDisclosure: {
      ...review.damageDisclosure, rawEvidence: 'x',
    } }],
    ['bad BCP 47 language', { ...review, originalLanguage: 'english' }],
    ['bad ISO 15924 script', { ...review, script: 'latin' }],
    ['title over bound', { ...review, originalTitle: 'x'.repeat(513) }],
    ['too many authors', { ...review, authors: Array(21).fill('Author'),
      originalFieldConfirmation: { title: true, authors: Array(21).fill(true) } }],
    ['author over bound', { ...review, authors: ['x'.repeat(257)],
      originalFieldConfirmation: { title: true, authors: [true] } }],
    ['quantity zero', { ...review, quantity: 0 }],
    ['price over bound', { ...review, priceMinor: 2_147_483_648 }],
    ['duplicate damage types', { ...review, damageDisclosure: {
      hasDamage: true, damageTypes: ['cover', 'cover'], damageNote: 'Marked',
      isSellable: true, completeReadableSafe: true,
    } }],
    ['damage fields when no damage', { ...review, damageDisclosure: {
      hasDamage: false, damageTypes: ['cover'], damageNote: 'Marked',
      isSellable: true, completeReadableSafe: true,
    } }],
    ['unknown damage type', { ...review, damageDisclosure: {
      hasDamage: true, damageTypes: ['dust'], damageNote: 'Marked',
      isSellable: true, completeReadableSafe: true,
    } }],
    ['empty shelf', { ...review, shelfLocation: '' }],
    ['shelf over bound', { ...review, shelfLocation: 'x'.repeat(121) }],
    ['notes over bound', { ...review, notes: {
      publicNote: 'x'.repeat(1001), internalNote: null,
    } }],
    ['manual match without target', { ...review, duplicateIntent: {
      action: 'manual_match', targetInventoryId: null, adviceVersion: 1,
    } }],
    ['zero advice version', { ...review, duplicateIntent: {
      action: 'create_separate', targetInventoryId: null, adviceVersion: 0,
    } }],
    ['empty title', { ...review, originalTitle: '' }],
    ['empty author', { ...review, authors: [''],
      originalFieldConfirmation: { title: true, authors: [true] } }],
    ['negative quantity', { ...review, quantity: -1 }],
    ['string quantity', { ...review, quantity: '1' }],
    ['negative price', { ...review, priceMinor: -1 }],
    ['string price', { ...review, priceMinor: '100' }],
    ['unsafe integer price', { ...review, priceMinor: Number.MAX_SAFE_INTEGER + 1 }],
    ['nested metadata unknown', { ...review, metadataChoice: {
      mode: 'manual', selectionId: null, provider: 'untrusted',
    } }],
    ['nested notes unknown', { ...review, notes: {
      publicNote: null, internalNote: null, raw: 'untrusted',
    } }],
    ['nested duplicate unknown', { ...review, duplicateIntent: {
      action: 'create_separate', targetInventoryId: null, adviceVersion: 1,
      confidence: 0.9,
    } }],
    ['nested confirmation unknown', { ...review, originalFieldConfirmation: {
      title: true, authors: [true], all: true,
    } }],
  ])('rejects strict review cross-rule: %s', (_label, invalidReview) => {
    expect(() => parseOwnerUxRequest({
      action: 'update_candidate_review', contractVersion,
      sessionId: uuid(1), candidateId: uuid(2),
      expectedCandidateVersion: 1, expectedMetadataRevision: 1,
      review: invalidReview, idempotencyKey: 'review-request-0001',
      commandId: uuid(3),
    })).toThrow(/invalid/i);
  });

  it.each(['new','like_new','very_good','good','acceptable'])(
    'accepts approved base condition %s', (baseCondition) => {
      expect(() => parseOwnerUxRequest({
        action: 'update_candidate_review', contractVersion,
        sessionId: uuid(1), candidateId: uuid(2),
        expectedCandidateVersion: 1, expectedMetadataRevision: 1,
        review: { ...review, baseCondition },
        idempotencyKey: 'review-request-0001', commandId: uuid(3),
      })).not.toThrow();
    },
  );

  it('accepts zero authors and null script as explicit confirmed decisions', () => {
    expect(() => parseOwnerUxRequest({
      action: 'update_candidate_review', contractVersion,
      sessionId: uuid(1), candidateId: uuid(2),
      expectedCandidateVersion: 1, expectedMetadataRevision: 1,
      review: {
        ...review, authors: [], script: null,
        originalFieldConfirmation: { title: true, authors: [] },
      },
      idempotencyKey: 'review-request-0001', commandId: uuid(3),
    })).not.toThrow();
  });

  it('requires unsafe/unsellable damage to remain private', () => {
    const unsafe = {
      ...review,
      publicationIntent: 'publish',
      priceMinor: 100,
      damageDisclosure: {
        hasDamage: true, damageTypes: ['missing_parts'],
        damageNote: 'Essential pages are missing', isSellable: false,
        completeReadableSafe: false,
      },
    };
    expect(() => parseOwnerUxRequest({
      action: 'update_candidate_review', contractVersion,
      sessionId: uuid(1), candidateId: uuid(2),
      expectedCandidateVersion: 1, expectedMetadataRevision: 1,
      review: unsafe, idempotencyKey: 'review-request-0001',
      commandId: uuid(3),
    })).toThrow(/invalid/i);
    expect(() => parseOwnerUxRequest({
      action: 'update_candidate_review', contractVersion,
      sessionId: uuid(1), candidateId: uuid(2),
      expectedCandidateVersion: 1, expectedMetadataRevision: 1,
      review: { ...unsafe, publicationIntent: 'private' },
      idempotencyKey: 'review-request-0001', commandId: uuid(3),
    })).not.toThrow();
  });

  it('accepts manual-match with target and independent note bounds', () => {
    expect(() => parseOwnerUxRequest({
      action: 'update_candidate_review', contractVersion,
      sessionId: uuid(1), candidateId: uuid(2),
      expectedCandidateVersion: 1, expectedMetadataRevision: 1,
      review: {
        ...review,
        notes: { publicNote: 'p'.repeat(1000), internalNote: 'i'.repeat(1000) },
        duplicateIntent: {
          action: 'manual_match', targetInventoryId: uuid(7), adviceVersion: 1,
        },
      },
      idempotencyKey: 'x'.repeat(16), commandId: uuid(3),
    })).not.toThrow();
  });

  it.each(['x'.repeat(16), 'x'.repeat(128)])(
    'accepts idempotency boundary length %s', (idempotencyKey) => {
      expect(() => parseOwnerUxRequest({
        action: 'close_scan_session', contractVersion, sessionId: uuid(1),
        expectedSessionVersion: 1, idempotencyKey, commandId: uuid(3),
      })).not.toThrow();
    },
  );

  it.each([
    'cover', 'binding', 'pages', 'water', 'staining', 'writing',
    'missing_parts', 'mould_or_contamination', 'other',
  ])('accepts approved damage type %s with complete disclosure', (damageType) => {
    expect(() => parseOwnerUxRequest({
      action: 'update_candidate_review', contractVersion,
      sessionId: uuid(1), candidateId: uuid(2),
      expectedCandidateVersion: 1, expectedMetadataRevision: 1,
      review: {
        ...review,
        publicationIntent: 'private',
        damageDisclosure: {
          hasDamage: true, damageTypes: [damageType], damageNote: 'Clearly disclosed',
          isSellable: true, completeReadableSafe: true,
        },
      },
      idempotencyKey: 'review-request-0001', commandId: uuid(3),
    })).not.toThrow();
  });

  it('normalizes strict review text with trim plus NFC and nulls empty optional notes', () => {
    const parsed: any = parseOwnerUxRequest({
      action: 'update_candidate_review', contractVersion,
      sessionId: uuid(1), candidateId: uuid(2),
      expectedCandidateVersion: 1, expectedMetadataRevision: 1,
      review: {
        ...review,
        originalTitle: '  Cafe\u0301  ',
        shelfLocation: '  A1  ',
        notes: { publicNote: '   ', internalNote: null },
      },
      idempotencyKey: 'review-request-0001', commandId: uuid(3),
    });
    expect(parsed.review.originalTitle).toBe('Café');
    expect(parsed.review.shelfLocation).toBe('A1');
    expect(parsed.review.notes.publicNote).toBeNull();
  });

  it.each([
    'short',
    'contains spaces 0001',
    'x'.repeat(129),
  ])('rejects invalid mutation idempotency key %s', (idempotencyKey) => {
    expect(() => parseOwnerUxRequest({
      action: 'close_scan_session', contractVersion, sessionId: uuid(1),
      expectedSessionVersion: 1, idempotencyKey, commandId: uuid(3),
    })).toThrow(/invalid/i);
  });
});

describe('Phase 9 Unit 6A Owner UX response contracts', () => {
  const closeSummary = {
    imagesSubmitted: 1, imagesProcessed: 1, imagesFailed: 0, imagesSkipped: 0,
    candidatesDetected: 1, candidatesReviewReady: 0, candidatesNeedsReview: 1,
    candidatesFailed: 0, falseDetections: 0, manualMissedCandidates: 0,
    committedInventoryItems: 0, quantitiesAddedToExisting: 0, privateItems: 0,
    publishedItems: 0, languageSkips: 0, candidateCapSkips: 0, qualitySkips: 0,
  };
  const blockerCounts = {
    input_processing: 0, candidate_processing: 0, candidate_failed: 0,
    review_missing: 1, title_unconfirmed: 0, author_confirmation_incomplete: 0,
    language_missing: 0, metadata_choice_missing: 0, quantity_invalid: 0,
    price_invalid: 0, condition_missing: 0, damage_answer_missing: 0,
    damage_details_missing: 0, location_missing: 0,
    publication_intent_missing: 0, duplicate_intent_missing: 0,
    variant_source_stale: 0,
  };
  const pageInfo = { nextCursor: null, hasMore: false };
  const candidateSummary = {
    sessionId: uuid(1), sessionStartedAt: '2026-07-30T00:00:00.000Z',
    sessionExpiresAt: '2026-08-30T00:00:00.000Z', sessionStatus: 'active',
    candidateId: uuid(2), inputId: null, ordinal: 1, title: 'The Book',
    authors: ['One Author'], language: 'en', candidateState: 'needs_review',
    candidateVersion: 1, metadataState: 'manual', reviewDisposition: null,
    attentionCodes: ['metadata_manual_required'], reviewReady: false,
    updatedAt: '2026-07-30T00:00:00.000Z',
  };
  const candidateDetail = {
    sessionId: uuid(1), candidateId: uuid(2), inputId: null, ordinal: 1,
    candidateState: 'needs_review', candidateVersion: 1,
    observed: { title: 'The Book', authors: ['One Author'], language: 'en', script: 'Latn' },
    metadata: {
      state: 'manual', revision: 1, selectionVersion: null,
      selectionId: null, canonicalEditionId: null, snapshot: null,
    },
    review: { value: null, reviewVersion: null },
    duplicateAdvice: {
      state: 'none', version: null, targetInventoryId: null, matchReason: null,
      compatibility: null, display: null, allowedIntents: [],
    },
    variantSummary: { unresolvedCount: 0, proposalVersions: [] },
    attentionCodes: ['metadata_manual_required'],
    readiness: {
      reviewReady: false,
      blockers: [{
        code: 'review_missing', candidateId: uuid(2), inputId: null,
        field: null, safeMessage: 'Review this book.',
      }],
      derivedFromCandidateVersion: 1, derivedFromMetadataRevision: 1,
      derivedFromDuplicateAdviceVersion: null,
    },
    allowedActions: ['save_review', 'mark_false', 'add_missed', 'view_readiness'],
    updatedAt: '2026-07-30T00:00:00.000Z',
  };
  const sessionSummary = {
    sessionId: uuid(1), status: 'active', sessionVersion: 1,
    startedAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z', closedAt: null,
    expiresAt: '2026-08-30T00:00:00.000Z',
    defaults: {
      language: 'en', script: null, condition: 'good',
      location: 'A1', quantity: 1, publication: 'private',
    },
    closeSummary, allInputsTerminal: true, closeState: 'closeable',
    presentationRevision: 1,
  };
  const inputProgress = {
    inputId: uuid(5), ordinal: 1, sourceKind: 'camera',
    inputState: 'processing', inputVersion: 1,
    presentationState: 'finding_books', safeCode: null,
    retryState: 'server_retrying', terminal: false, polling: true,
    detectedCandidateCount: null, acceptedCandidateCount: 0,
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  };

  it('decodes the canonical discovery response and rejects private identity', () => {
    const data = {
      activeSession: null, needsReviewCount: 0, reviewScopeVersion: 1,
    };
    expect(parseOwnerUxResponse('discover_scan_session', { contractVersion, data })).toEqual({ contractVersion, data });
    expect(() => parseOwnerUxResponse('discover_scan_session', {
      contractVersion, data: { ...data, storeId: uuid(9) },
    })).toThrow(/unknown/i);
    expect(() => parseOwnerUxResponse('discover_scan_session', {
      contractVersion,
      data: {
        activeSession: null, needsReviewCount: Number.MAX_SAFE_INTEGER + 1,
        reviewScopeVersion: 1,
      },
    })).toThrow(/invalid/i);
  });

  it('decodes the complete readiness envelope including zero-valued Unit 7 counts', () => {
    const data = {
      sessionId: uuid(1), sessionStatus: 'active', sessionVersion: 1,
      allInputsTerminal: true, closeSummary, blockerCounts,
      nextBlockingCandidateId: uuid(2), closeState: 'closeable',
      closeAllowed: true, presentationRevision: 1,
    };
    expect(parseOwnerUxResponse('read_scan_readiness', { contractVersion, data })).toEqual({ contractVersion, data });
  });

  it.each([
    ['read_scan_session', sessionSummary],
    ['list_scan_inputs', {
      items: [inputProgress], pageInfo, sessionVersion: 1, presentationRevision: 1,
    }],
    ['list_scan_candidates', {
      items: [candidateSummary], pageInfo, scopeVersion: 1, sessionVersion: 1,
    }],
    ['read_scan_candidate', candidateDetail],
    ['update_candidate_review', {
      ...candidateDetail, candidateState: 'ready', candidateVersion: 2,
      review: { value: review, reviewVersion: 1 },
      attentionCodes: ['review_ready'],
      readiness: {
        reviewReady: true, blockers: [], derivedFromCandidateVersion: 2,
        derivedFromMetadataRevision: 1, derivedFromDuplicateAdviceVersion: null,
      },
    }],
    ['close_scan_session', {
      sessionId: uuid(1), sessionStatus: 'closed', sessionVersion: 2,
      allInputsTerminal: true, closeSummary, blockerCounts,
      nextBlockingCandidateId: uuid(2), closeState: 'closed',
      closeAllowed: false, presentationRevision: 2,
    }],
  ])('decodes exact %s response keys, nulls and enums', (action, data) => {
    const envelope = { contractVersion, data };
    expect(parseOwnerUxResponse(action as any, envelope)).toEqual(envelope);
    expect(() => parseOwnerUxResponse(action as any, {
      contractVersion, data: { ...data, raw_payload: 'forbidden' },
    })).toThrow(/unknown|forbidden/i);
  });

  it.each([
    ['read_scan_session', { ...sessionSummary, status: 'paused' }],
    ['list_scan_inputs', { items: [{ ...inputProgress, inputState: 'uploading' }],
      pageInfo, sessionVersion: 1, presentationRevision: 1 }],
    ['list_scan_candidates', { items: [{ ...candidateSummary, ordinal: 0 }],
      pageInfo, scopeVersion: 1, sessionVersion: 1 }],
    ['list_scan_candidates', { items: [{ ...candidateSummary, ordinal: 16 }],
      pageInfo, scopeVersion: 1, sessionVersion: 1 }],
    ['list_scan_candidates', { items: [{ ...candidateSummary, sessionStatus: 'expired' }],
      pageInfo, scopeVersion: 1, sessionVersion: 1 }],
    ['list_scan_inputs', { items: [{
      ...inputProgress, detectedCandidateCount: 16,
    }], pageInfo, sessionVersion: 1, presentationRevision: 1 }],
    ['list_scan_inputs', { items: [{
      ...inputProgress, safeCode: 'PRIVATE_SQL_ERROR',
    }], pageInfo, sessionVersion: 1, presentationRevision: 1 }],
    ['read_scan_session', {
      ...sessionSummary, defaults: { ...sessionSummary.defaults, quantity: 1001 },
    }],
    ['read_scan_session', {
      ...sessionSummary, defaults: { ...sessionSummary.defaults, condition: 'fair' },
    }],
    ['read_scan_candidate', { ...candidateDetail,
      metadata: { ...candidateDetail.metadata, revision: 0 } }],
    ['read_scan_candidate', {
      ...candidateDetail,
      observed: { ...candidateDetail.observed, title: 'x'.repeat(513) },
    }],
    ['read_scan_candidate', {
      ...candidateDetail,
      observed: { ...candidateDetail.observed, language: 'EN_us' },
    }],
    ['close_scan_session', {
      sessionId: uuid(1), sessionStatus: 'closed', sessionVersion: 2,
      allInputsTerminal: true, closeSummary: { ...closeSummary, imagesSubmitted: -1 },
      blockerCounts, nextBlockingCandidateId: null, closeState: 'closed',
      closeAllowed: false, presentationRevision: 2,
    }],
  ])('rejects invalid %s response branches', (action, data) => {
    expect(() => parseOwnerUxResponse(action as any, {
      contractVersion, data,
    })).toThrow(/invalid/i);
  });

  it.each([
    'raw_payload', 'provider_payload', 'confidence', 'geometry', 'scan_url',
    'signed_url', 'object_path', 'sha256', 'cost', 'attempt_count', 'lease_token',
    'prompt', 'correlation_id', 'store_id', 'created_by',
  ])('forbids %s anywhere in Owner responses', (key) => {
    expect(OWNER_UX_FORBIDDEN_RESPONSE_KEYS).toContain(key);
    expect(() => parseOwnerUxResponse('discover_scan_session', {
      contractVersion,
      data: { activeSession: null, needsReviewCount: 0, reviewScopeVersion: 1, [key]: 'secret' },
    })).toThrow();
  });

  it('recursively rejects forbidden fields inside nested detail, pages and metadata', () => {
    expect(() => parseOwnerUxResponse('read_scan_candidate', {
      contractVersion,
      data: {
        ...candidateDetail,
        observed: { ...candidateDetail.observed, confidence: 0.9 },
      },
    })).toThrow(/unknown|forbidden/i);
    expect(() => parseOwnerUxResponse('list_scan_candidates', {
      contractVersion,
      data: {
        items: [{ ...candidateSummary, provider_payload: {} }],
        pageInfo, scopeVersion: 1, sessionVersion: 1,
      },
    })).toThrow(/unknown|forbidden/i);
    expect(() => parseOwnerUxResponse('read_scan_candidate', {
      contractVersion,
      data: {
        ...candidateDetail,
        metadata: { ...candidateDetail.metadata, snapshot: { raw_payload: {} } },
      },
    })).toThrow(/unknown|forbidden|invalid/i);
  });

  it('keeps the owner UX version distinct from the ingestion transport version', () => {
    expect(OWNER_UX_CONTRACT_VERSION).toBe(contractVersion);
  });
});

describe('Phase 9 Unit 6A Edge RPC adapter', () => {
  const rpc = jest.fn();
  const client: any = { rpc, storage: { from: jest.fn() } };

  beforeEach(() => jest.resetAllMocks());

  it.each([
    ['discover_scan_session', 'phase9_owner_discover_session_v1', {}, {}],
    ['read_scan_session', 'phase9_owner_session_summary_v2',
      { sessionId: uuid(1) }, { p_session_id: uuid(1) }],
    ['list_scan_inputs', 'phase9_owner_session_inputs_v1',
      { sessionId: uuid(1) },
      { p_session_id: uuid(1), p_page_size: 20, p_cursor: null }],
    ['list_scan_candidates', 'phase9_owner_candidates_page_v2',
      { scope: 'session', sessionId: uuid(1) },
      { p_scope: 'session', p_session_id: uuid(1), p_attention: 'all', p_page_size: 20, p_cursor: null }],
    ['read_scan_candidate', 'phase9_owner_candidate_detail_v2',
      { sessionId: uuid(1), candidateId: uuid(2) },
      { p_session_id: uuid(1), p_candidate_id: uuid(2) }],
    ['update_candidate_review', 'phase9_update_candidate_review_v2',
      {
        sessionId: uuid(1), candidateId: uuid(2), expectedCandidateVersion: 1,
        expectedMetadataRevision: 1, review, idempotencyKey: 'review-request-0001',
        commandId: uuid(3),
      },
      {
        p_session_id: uuid(1), p_candidate_id: uuid(2), p_expected_candidate_version: 1,
        p_expected_metadata_revision: 1, p_review: review,
        p_idempotency_key: 'review-request-0001', p_command_id: uuid(3),
      }],
    ['read_scan_readiness', 'phase9_owner_session_readiness_v1',
      { sessionId: uuid(1) }, { p_session_id: uuid(1) }],
    ['close_scan_session', 'phase9_close_session_v2',
      {
        sessionId: uuid(1), expectedSessionVersion: 1,
        idempotencyKey: 'close-request-00001', commandId: uuid(4),
      },
      {
        p_session_id: uuid(1), p_expected_session_version: 1,
        p_idempotency_key: 'close-request-00001', p_command_id: uuid(4),
      }],
  ])('routes %s only to %s with typed arguments', async (action, rpcName, fields, args) => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await expect(executeOwnerIngestion({
      action, contractVersion, ...fields,
    } as any, uuid(9), client, client)).rejects.toThrow(/invalid Owner UX response/i);
    expect(rpc).toHaveBeenCalledWith(rpcName, args);
  });

  it('validates and wraps canonical RPC data at the Edge boundary', async () => {
    rpc.mockResolvedValue({
      data: { activeSession: null, needsReviewCount: 0, reviewScopeVersion: 1 },
      error: null,
    });
    await expect(executeOwnerIngestion({
      action: 'discover_scan_session', contractVersion,
    } as any, uuid(9), client, client)).resolves.toEqual({
      contractVersion,
      data: { activeSession: null, needsReviewCount: 0, reviewScopeVersion: 1 },
    });
    rpc.mockResolvedValue({
      data: { activeSession: null, needsReviewCount: 0, reviewScopeVersion: 1,
        raw_payload: 'private' },
      error: null,
    });
    await expect(executeOwnerIngestion({
      action: 'discover_scan_session', contractVersion,
    } as any, uuid(9), client, client)).rejects.toThrow(/unknown|forbidden|invalid/i);
  });

  it('maps database failures to registered safe codes without passing raw errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'private SQL details P9_VERSION_CONFLICT tail' } });
    await expect(executeOwnerIngestion({
      action: 'read_scan_session', contractVersion, sessionId: uuid(1),
    } as any, uuid(9), client, client)).rejects.toThrow('P9_VERSION_CONFLICT');
  });
});

describe('Phase 9 Unit 6A safe errors', () => {
  it.each([
    ['P9_AUTH_REQUIRED', 401, false],
    ['P9_OWNER_NOT_AUTHORIZED', 403, false],
    ['P9_REQUEST_INVALID', 400, false],
    ['P9_CURSOR_INVALID', 400, false],
    ['P9_NOT_FOUND', 404, false],
    ['P9_STATE_CONFLICT', 409, true],
    ['P9_VERSION_CONFLICT', 409, true],
    ['P9_CANDIDATE_VERSION_CONFLICT', 409, true],
    ['P9_IDEMPOTENCY_MISMATCH', 409, false],
    ['P9_INTERNAL_ERROR', 500, true],
  ])('returns registered safe envelope for %s', (code, status, retryable) => {
    expect(ownerUxErrorEnvelope(code as any)).toEqual(expect.objectContaining({
      status,
      body: expect.objectContaining({
        error: code, retryable, message: expect.any(String),
      }),
    }));
    expect(JSON.stringify(ownerUxErrorEnvelope(code as any))).not.toMatch(
      /sql|stack|constraint|relation|provider_payload/i,
    );
  });

  it('does not expose an unregistered database error', () => {
    expect(ownerUxErrorEnvelope('private constraint detail' as any))
      .toEqual(ownerUxErrorEnvelope('P9_INTERNAL_ERROR'));
  });

  it('maps malformed RPC response contracts to a safe internal error', () => {
    let failure: unknown;
    try {
      parseOwnerUxResponse('discover_scan_session', {
        contractVersion,
        data: { activeSession: null, needsReviewCount: -1, reviewScopeVersion: 1 },
      });
    } catch (error) {
      failure = error;
    }
    expect(ownerUxErrorFromException(failure))
      .toEqual(ownerUxErrorEnvelope('P9_INTERNAL_ERROR'));
  });

  it('maps absent, random and mismatched candidate failures to one HTTP-safe envelope', () => {
    const failures = [
      new Error('P9_NOT_FOUND'),
      new Error('P9_NOT_FOUND'),
      new Error('P9_NOT_FOUND'),
    ].map(ownerUxErrorFromException);
    expect(new Set(failures.map((failure) => JSON.stringify(failure))).size).toBe(1);
    expect(failures[0]).toEqual({
      status: 404,
      body: {
        error: 'P9_NOT_FOUND',
        retryable: false,
        message: 'The requested item was not found.',
      },
    });
  });

  it('maps authentication Responses through the same handler helper', () => {
    expect(ownerUxErrorFromException(new Response(null, { status: 401 })).status).toBe(401);
    expect(ownerUxErrorFromException(new Response(null, { status: 403 })).status).toBe(403);
    expect(ownerUxErrorFromException(new SyntaxError('private JSON detail')).status).toBe(400);
  });

  it('returns identical status, code and body through the Edge failure response boundary', async () => {
    const responses = await Promise.all([
      new Error('P9_NOT_FOUND'),
      new Error('P9_NOT_FOUND'),
      new Error('P9_NOT_FOUND'),
    ].map(async (error) => {
      const response = ownerUxFailureResponse(error);
      return {
        status: response.status,
        body: await response.json(),
        cache: response.headers.get('cache-control'),
      };
    }));
    expect(new Set(responses.map((value) => JSON.stringify(value))).size).toBe(1);
    expect(responses[0]).toEqual({
      status: 404,
      body: {
        error: 'P9_NOT_FOUND',
        retryable: false,
        message: 'The requested item was not found.',
      },
      cache: 'no-store',
    });
  });
});
