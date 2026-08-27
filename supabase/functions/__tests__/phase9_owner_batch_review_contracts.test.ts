import {
  OWNER_BATCH_REVIEW_CONTRACT_VERSION,
  decodeOwnerBatchReviewResponse,
  parseOwnerBatchReviewRequest,
} from '../_shared/imageInventory/contracts/ownerBatchReview';
import { executeOwnerBatchReview } from '../_shared/imageInventory/runtime/ownerBatchReviewIngestion';
import { parseOwnerIngestionRequest } from '../_shared/imageInventory/contracts/ingestion';

const uuid = (n: number) => `92000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const contractVersion = OWNER_BATCH_REVIEW_CONTRACT_VERSION;
const timestamp = '2026-08-21T10:00:00.000Z';

const closeSummary = {
  imagesSubmitted: 1, imagesProcessed: 1, imagesFailed: 0, imagesSkipped: 0,
  candidatesDetected: 1, candidatesReviewReady: 0, candidatesNeedsReview: 0,
  candidatesFailed: 0, falseDetections: 0, ownerRemovedCandidates: 1,
  manualMissedCandidates: 0, committedInventoryItems: 0,
  quantitiesAddedToExisting: 0, privateItems: 0, publishedItems: 0,
  languageSkips: 0, candidateCapSkips: 0, qualitySkips: 0,
};
const blockerCounts = Object.fromEntries([
  'input_processing', 'candidate_processing', 'candidate_failed', 'review_missing',
  'title_unconfirmed', 'author_confirmation_incomplete', 'language_missing',
  'metadata_choice_missing', 'quantity_invalid', 'price_invalid', 'condition_missing',
  'damage_answer_missing', 'damage_details_missing', 'location_missing',
  'publication_intent_missing', 'duplicate_intent_missing', 'variant_source_stale',
].map((code) => [code, 0]));
const defaults = {
  languageHint: 'en', condition: null, location: 'Shelf A', priceMinor: null,
  quantity: 1, publication: 'private', script: null,
};

function authorityCard(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: uuid(2), candidateId: uuid(3), inputId: null, ordinal: 1,
    candidateState: 'needs_review', candidateVersion: 1, metadataState: 'pending',
    metadataRevision: 1, reviewVersion: null, reviewDisposition: null,
    observed: {
      title: 'Observed title', authors: ['Observed author'],
      language: 'en', script: 'Latn',
    },
    metadataSummary: null, review: null,
    fieldSources: {
      cover: 'missing', title: 'detected', authors: 'detected', language: 'detected',
      condition: 'missing', price: 'missing', quantity: 'default', location: 'default',
      publication: 'default', damage: 'default',
    },
    attentionCodes: [], blockers: [], reviewReady: false,
    allowedActions: ['save_review', 'view_metadata'], updatedAt: timestamp,
    ...overrides,
  };
}

function authorityPayload(value: ReturnType<typeof authorityCard>) {
  return {
    contractVersion,
    data: {
      sessionId: uuid(2), status: 'active', sessionVersion: 1,
      presentationRevision: 1, defaults, batchLabel: null,
      counts: {
        detected: 1, processing: 0, needsAttention: 1,
        reviewReadySaved: 0, committed: 0, ownerRemoved: 0, falseDetections: 0,
      },
      items: [value], updatedAt: timestamp,
    },
  };
}

function reviewValue(overrides: Record<string, unknown> = {}) {
  return {
    originalTitle: 'Owner title', authors: ['Observed author'],
    originalLanguage: 'en', script: 'Latn',
    metadataChoice: { mode: 'manual', selectionId: null },
    quantity: 1, priceMinor: 100, baseCondition: 'good',
    damageDisclosure: {
      hasDamage: false, damageTypes: [], damageNote: null,
      isSellable: true, completeReadableSafe: true,
    },
    shelfLocation: 'Shelf A', notes: { publicNote: null, internalNote: null },
    publicationIntent: 'private', duplicateIntent: null,
    originalFieldConfirmation: { title: true, authors: [true] },
    candidateDisposition: 'reviewed', ...overrides,
  };
}

describe('Phase 9 Unit 6G Group 1 request contracts', () => {
  it.each([
    {
      action: 'start_scan_session_v2', contractVersion, languageHint: 'en',
      condition: null, location: 'Shelf A', priceMinor: null,
      publication: 'private', batchLabel: null,
      idempotencyKey: 'unit6g-start-00001', commandId: uuid(1),
    },
    { action: 'read_scan_session_v3', contractVersion, sessionId: uuid(2) },
    { action: 'read_scan_batch_review', contractVersion, sessionId: uuid(2) },
    {
      action: 'remove_candidate_from_scan', contractVersion,
      sessionId: uuid(2), candidateId: uuid(3), expectedCandidateVersion: 1,
      idempotencyKey: 'unit6g-remove-0001', commandId: uuid(4),
    },
    {
      action: 'close_scan_session_v3', contractVersion, sessionId: uuid(2),
      expectedSessionVersion: 1, idempotencyKey: 'unit6g-close-00001',
      commandId: uuid(5),
    },
  ])('accepts exact $action', (request) => {
    expect(parseOwnerBatchReviewRequest(request)).toEqual(request);
  });

  it.each([
    ['store authority', { storeId: uuid(9) }],
    ['quantity authority', { quantity: 2 }],
    ['currency authority', { currency: 'INR' }],
    ['script authority', { script: 'Latn' }],
    ['rupee authority', { priceRupees: 25 }],
  ])('rejects unknown start %s', (_label, extra) => {
    expect(() => parseOwnerBatchReviewRequest({
      action: 'start_scan_session_v2', contractVersion, languageHint: 'en',
      condition: null, location: 'Shelf A', priceMinor: null,
      publication: 'private', batchLabel: null,
      idempotencyKey: 'unit6g-start-00001', commandId: uuid(1), ...extra,
    })).toThrow(/unknown/i);
  });

  it.each([
    ['empty location', { location: '' }],
    ['invalid condition', { condition: 'poor' }],
    ['unsafe price', { priceMinor: Number.MAX_SAFE_INTEGER + 1 }],
    ['oversize label', { batchLabel: 'x'.repeat(81) }],
    ['short key', { idempotencyKey: 'short' }],
  ])('rejects %s', (_label, override) => {
    expect(() => parseOwnerBatchReviewRequest({
      action: 'start_scan_session_v2', contractVersion, languageHint: 'en',
      condition: null, location: 'Shelf A', priceMinor: null,
      publication: 'private', batchLabel: null,
      idempotencyKey: 'unit6g-start-00001', commandId: uuid(1), ...override,
    })).toThrow(/invalid/i);
  });
});

describe('Phase 9 Unit 6G Group 1 strict responses', () => {
  it('decodes nullable defaults and resumable batch label', () => {
    expect(decodeOwnerBatchReviewResponse('start_scan_session_v2', {
      contractVersion, data: { sessionId: uuid(2), sessionVersion: 1, defaults, batchLabel: 'August intake' },
    })).toEqual({ sessionId: uuid(2), sessionVersion: 1, defaults, batchLabel: 'August intake' });
  });

  it('decodes bounded owner removal and v3 close readiness', () => {
    const data = {
      sessionId: uuid(2), sessionStatus: 'closed', sessionVersion: 2,
      allInputsTerminal: true, closeSummary, blockerCounts,
      nextBlockingCandidateId: null, closeState: 'closed', closeAllowed: false,
      presentationRevision: 2,
    };
    expect(decodeOwnerBatchReviewResponse('close_scan_session_v3', {
      contractVersion, data,
    })).toEqual(data);
  });

  it('rejects unbounded counts, unknown keys and privacy-sensitive nested data', () => {
    const base = {
      contractVersion, data: {
        sessionId: uuid(2), status: 'active', sessionVersion: 1,
        presentationRevision: 1, defaults, batchLabel: null,
        counts: { detected: 0, processing: 0, needsAttention: 0, reviewReadySaved: 0, committed: 0, ownerRemoved: 0, falseDetections: 0 },
        items: [], updatedAt: timestamp,
      },
    };
    expect(() => decodeOwnerBatchReviewResponse('read_scan_batch_review', {
      ...base, data: { ...base.data, counts: { ...base.data.counts, detected: 9007199254740993 } },
    })).toThrow();
    expect(() => decodeOwnerBatchReviewResponse('read_scan_batch_review', {
      ...base,
      data: {
        ...base.data,
        counts: { ...base.data.counts, detected: 40 },
      },
    })).not.toThrow();
    expect(() => decodeOwnerBatchReviewResponse('read_scan_batch_review', {
      ...base,
      data: {
        ...base.data,
        counts: { ...base.data.counts, detected: 1000 },
      },
    })).not.toThrow();
    expect(() => decodeOwnerBatchReviewResponse('read_scan_batch_review', {
      ...base, data: { ...base.data, extra: true },
    })).toThrow();
    expect(() => decodeOwnerBatchReviewResponse('read_scan_batch_review', {
      ...base, data: { ...base.data, providerPayload: { raw: true } },
    })).toThrow();
  });

  it('rejects duplicate actions, unsafe covers and inconsistent blockers', () => {
    const card = {
      sessionId: uuid(2), candidateId: uuid(3), inputId: null, ordinal: 1,
      candidateState: 'ready', candidateVersion: 1, metadataState: 'selected',
      metadataRevision: 1, reviewVersion: null, reviewDisposition: null,
      observed: { title: 'Book', authors: [], language: 'en', script: null },
      metadataSummary: { title: 'Book', authors: ['Author'], language: 'en', coverReference: 'https://evil.example/cover.jpg' },
      review: null,
      fieldSources: { cover: 'matched', title: 'matched', authors: 'matched', language: 'matched', condition: 'missing', price: 'missing', quantity: 'default', location: 'default', publication: 'default', damage: 'default' },
      attentionCodes: ['review_ready'], blockers: [], reviewReady: false,
      allowedActions: ['save_review', 'save_review'], updatedAt: timestamp,
    };
    const data = {
      sessionId: uuid(2), status: 'active', sessionVersion: 1,
      presentationRevision: 1, defaults, batchLabel: null,
      counts: { detected: 1, processing: 0, needsAttention: 1, reviewReadySaved: 0, committed: 0, ownerRemoved: 0, falseDetections: 0 },
      items: [card], updatedAt: timestamp,
    };
    expect(() => decodeOwnerBatchReviewResponse('read_scan_batch_review', { contractVersion, data })).toThrow();
  });

  it.each([
    ['blank selected authors', { authors: [''] }, { authors: 'detected' }],
    ['unapproved selected cover', {
      coverReference: 'https://evil.example/cover.jpg',
    }, { cover: 'missing' }],
    ['unsafe selected title', {
      title: 'https://evil.example/active-title',
    }, { title: 'detected' }],
    ['invalid selected language', { language: 'english' }, { language: 'detected' }],
  ])('accepts a complete DTO when an unusable selected field is projected as null: %s', (
    label, metadataOverride, sourceOverride,
  ) => {
    const base = authorityCard();
    const field = label.includes('authors') ? 'authors'
      : label.includes('cover') ? 'coverReference'
        : label.includes('title') ? 'title' : 'language';
    const selected = authorityCard({
      metadataState: 'selected',
      metadataSummary: {
        title: 'Selected title', authors: ['Selected Author'], language: 'en',
        coverReference: 'https://books.google.com/cover.jpg', ...metadataOverride,
        [field]: null,
      },
      fieldSources: {
        ...base.fieldSources, cover: 'matched', title: 'matched',
        authors: 'matched', language: 'matched', ...sourceOverride,
      },
    });
    expect(() => decodeOwnerBatchReviewResponse(
      'read_scan_batch_review', authorityPayload(selected),
    )).not.toThrow();
  });

  it.each([
    ['custom without review', authorityCard({
      fieldSources: { ...authorityCard().fieldSources, title: 'custom' },
    })],
    ['matched without metadata', authorityCard({
      fieldSources: { ...authorityCard().fieldSources, title: 'matched' },
    })],
    ['default without condition default', authorityCard({
      fieldSources: { ...authorityCard().fieldSources, condition: 'default' },
    })],
  ])('rejects semantic source/backing mismatch: %s', (_label, value) => {
    expect(() => decodeOwnerBatchReviewResponse(
      'read_scan_batch_review', authorityPayload(value),
    )).toThrow();
  });

  it('accepts coherent review-null detected and selected metadata authority', () => {
    expect(() => decodeOwnerBatchReviewResponse(
      'read_scan_batch_review', authorityPayload(authorityCard()),
    )).not.toThrow();
    const selected = authorityCard({
      metadataState: 'selected',
      metadataSummary: {
        title: 'Matched title', authors: ['Matched author'],
        language: 'fr', coverReference: null,
      },
      fieldSources: {
        ...authorityCard().fieldSources,
        title: 'matched', authors: 'matched', language: 'matched',
      },
    });
    expect(() => decodeOwnerBatchReviewResponse(
      'read_scan_batch_review', authorityPayload(selected),
    )).not.toThrow();
  });

  it('rejects reviewed custom labels when the value is inherited', () => {
    const value = authorityCard({
      review: reviewValue({ originalTitle: 'Observed title' }),
      reviewVersion: 1, reviewDisposition: 'reviewed',
      fieldSources: {
        ...authorityCard().fieldSources,
        title: 'custom', condition: 'custom', price: 'custom',
      },
    });
    expect(() => decodeOwnerBatchReviewResponse(
      'read_scan_batch_review', authorityPayload(value),
    )).toThrow();
    expect(() => decodeOwnerBatchReviewResponse(
      'read_scan_batch_review', authorityPayload({
        ...value,
        fieldSources: { ...value.fieldSources, title: 'detected' },
      }),
    )).not.toThrow();
  });
});

describe('Phase 9 Unit 6G Group 1 Edge RPC routing', () => {
  it('routes the new contract through the shared ingestion parser', () => {
    const request = {
      action: 'read_scan_batch_review', contractVersion, sessionId: uuid(2),
    } as const;
    expect(parseOwnerIngestionRequest(request)).toEqual(request);
  });

  it.each([
    ['read_scan_session_v3', 'phase9_owner_session_summary_v3'],
    ['read_scan_batch_review', 'phase9_owner_batch_review_v1'],
    ['remove_candidate_from_scan', 'phase9_owner_remove_candidate_v1'],
    ['close_scan_session_v3', 'phase9_close_session_v3'],
  ])('routes %s only to %s', async (action, rpcName) => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const request: any = action === 'remove_candidate_from_scan' ? {
      action, contractVersion, sessionId: uuid(2), candidateId: uuid(3),
      expectedCandidateVersion: 1, idempotencyKey: 'unit6g-remove-0001', commandId: uuid(4),
    } : action === 'close_scan_session_v3' ? {
      action, contractVersion, sessionId: uuid(2), expectedSessionVersion: 1,
      idempotencyKey: 'unit6g-close-00001', commandId: uuid(4),
    } : { action, contractVersion, sessionId: uuid(2) };
    const client = { rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push([name, args]); return { data: {}, error: null };
    } };
    await expect(executeOwnerBatchReview(request, client, (result) => result.data))
      .rejects.toThrow();
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(rpcName);
  });
});
