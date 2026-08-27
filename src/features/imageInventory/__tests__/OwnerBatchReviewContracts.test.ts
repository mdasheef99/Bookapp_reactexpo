import {
    decodeOwnerBatchReviewResponse,
    OWNER_BATCH_REVIEW_CONTRACT_VERSION,
    parseOwnerBatchReviewRequest,
} from '../contracts/ownerBatchReviewContracts';

const uuid = '92000000-0000-4000-8000-000000000001';
const timestamp = '2026-08-21T10:00:00.000Z';
const defaults = {
    languageHint: 'en', condition: null, location: 'Shelf A', priceMinor: null,
    quantity: 1, publication: 'private', script: null,
} as const;

function batchCard(overrides: Record<string, unknown> = {}) {
    return {
        sessionId: uuid, candidateId: '92000000-0000-4000-8000-000000000002',
        inputId: null, ordinal: 1, candidateState: 'needs_review',
        candidateVersion: 1, metadataState: 'pending', metadataRevision: 1,
        reviewVersion: null, reviewDisposition: null,
        observed: {
            title: 'Observed title', authors: ['Observed author'],
            language: 'en', script: 'Latn',
        },
        metadataSummary: null, review: null,
        fieldSources: {
            cover: 'missing', title: 'detected', authors: 'detected',
            language: 'detected', condition: 'missing', price: 'missing',
            quantity: 'default', location: 'default', publication: 'default',
            damage: 'default',
        },
        attentionCodes: [], blockers: [], reviewReady: false,
        allowedActions: ['save_review', 'view_metadata'], updatedAt: timestamp,
        ...overrides,
    };
}

function batchPayload(card: unknown, rootDefaults = defaults) {
    return {
        contractVersion: OWNER_BATCH_REVIEW_CONTRACT_VERSION,
        data: {
            sessionId: uuid, status: 'active', sessionVersion: 1,
            presentationRevision: 1, defaults: rootDefaults, batchLabel: null,
            counts: {
                detected: 1, processing: 0, needsAttention: 1,
                reviewReadySaved: 0, committed: 0, ownerRemoved: 0,
                falseDetections: 0,
            },
            items: [card], updatedAt: timestamp,
        },
    };
}

function savedReview(overrides: Record<string, unknown> = {}) {
    return {
        originalTitle: 'Owner title', authors: ['Observed author'],
        originalLanguage: 'en', script: 'Latn',
        metadataChoice: { mode: 'manual', selectionId: null },
        quantity: 1, priceMinor: 100, baseCondition: 'good',
        damageDisclosure: {
            hasDamage: false, damageTypes: [], damageNote: null,
            isSellable: true, completeReadableSafe: true,
        },
        shelfLocation: 'Shelf A',
        notes: { publicNote: null, internalNote: null },
        publicationIntent: 'private', duplicateIntent: null,
        originalFieldConfirmation: { title: true, authors: [true] },
        candidateDisposition: 'reviewed', ...overrides,
    };
}

describe('Unit 6G Group 1 mobile DTO foundation', () => {
    it('accepts only the exact server-derived Start authority', () => {
        const request = {
            action: 'start_scan_session_v2',
            contractVersion: OWNER_BATCH_REVIEW_CONTRACT_VERSION,
            languageHint: 'en', condition: null, location: 'Shelf A',
            priceMinor: null, publication: 'private', batchLabel: null,
            idempotencyKey: 'unit6g-start-00001', commandId: uuid,
        } as const;
        expect(parseOwnerBatchReviewRequest(request)).toEqual(request);
        expect(() => parseOwnerBatchReviewRequest({ ...request, quantity: 2 })).toThrow();
        expect(() => parseOwnerBatchReviewRequest({ ...request, storeId: uuid })).toThrow();
    });

    it('decodes strict nullable session defaults and bounded batch aggregate', () => {
        const data = {
            sessionId: uuid, status: 'active', sessionVersion: 1,
            presentationRevision: 1, defaults, batchLabel: 'August intake',
            counts: {
                detected: 0, processing: 0, needsAttention: 0,
                reviewReadySaved: 0, committed: 0, ownerRemoved: 0,
                falseDetections: 0,
            },
            items: [], updatedAt: timestamp,
        };
        expect(decodeOwnerBatchReviewResponse('read_scan_batch_review', {
            contractVersion: OWNER_BATCH_REVIEW_CONTRACT_VERSION, data,
        })).toEqual(data);
    });

    it('decodes legacy multi-image session counters above the 15-card cap', () => {
        for (const detected of [40, 1000]) {
            const data = {
                sessionId: uuid, status: 'active', sessionVersion: 1,
                presentationRevision: 1, defaults, batchLabel: null,
                counts: {
                    detected, processing: 0, needsAttention: 12,
                    reviewReadySaved: 8, committed: 22, ownerRemoved: 3,
                    falseDetections: 5,
                },
                items: [], updatedAt: timestamp,
            };
            expect(decodeOwnerBatchReviewResponse('read_scan_batch_review', {
                contractVersion: OWNER_BATCH_REVIEW_CONTRACT_VERSION, data,
            })).toEqual(data);
        }
    });

    it.each([
        { extra: true },
        { providerPayload: { raw: true } },
        { counts: { detected: 9007199254740993 } },
    ])('fails closed for unknown, private, or unbounded data', (override) => {
        const counts = {
            detected: 0, processing: 0, needsAttention: 0,
            reviewReadySaved: 0, committed: 0, ownerRemoved: 0,
            falseDetections: 0,
            ...(override.counts ?? {}),
        };
        expect(() => decodeOwnerBatchReviewResponse('read_scan_batch_review', {
            contractVersion: OWNER_BATCH_REVIEW_CONTRACT_VERSION,
            data: {
                sessionId: uuid, status: 'active', sessionVersion: 1,
                presentationRevision: 1, defaults, batchLabel: null,
                counts, items: [], updatedAt: timestamp, ...override,
            },
        })).toThrow();
    });

    it.each([
        ['custom without saved review', batchCard({
            fieldSources: { ...batchCard().fieldSources, title: 'custom' },
        }), defaults],
        ['matched without selected metadata', batchCard({
            fieldSources: { ...batchCard().fieldSources, title: 'matched' },
        }), defaults],
        ['detected without usable observed title', batchCard({
            observed: { ...batchCard().observed, title: '' },
        }), defaults],
        ['default without an applicable condition default', batchCard({
            fieldSources: { ...batchCard().fieldSources, condition: 'default' },
        }), defaults],
    ])('rejects incoherent field authority: %s', (_label, value, rootDefaults) => {
        expect(() => decodeOwnerBatchReviewResponse(
            'read_scan_batch_review', batchPayload(value, rootDefaults),
        )).toThrow();
    });

    it('accepts coherent never-reviewed detected and matched field authority', () => {
        expect(() => decodeOwnerBatchReviewResponse(
            'read_scan_batch_review', batchPayload(batchCard()),
        )).not.toThrow();
        const selected = batchCard({
            metadataState: 'selected',
            metadataSummary: {
                title: 'Matched title', authors: ['Matched author'],
                language: 'fr', coverReference: null,
            },
            fieldSources: {
                ...batchCard().fieldSources,
                title: 'matched', authors: 'matched', language: 'matched',
            },
        });
        expect(() => decodeOwnerBatchReviewResponse(
            'read_scan_batch_review', batchPayload(selected),
        )).not.toThrow();
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
        const base = batchCard();
        const field = label.includes('authors') ? 'authors'
            : label.includes('cover') ? 'coverReference'
                : label.includes('title') ? 'title' : 'language';
        const selected = batchCard({
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
            'read_scan_batch_review', batchPayload(selected),
        )).not.toThrow();
    });

    it('preserves reviewed custom, detected, and default source semantics', () => {
        const reviewed = batchCard({
            review: savedReview(), reviewVersion: 1, reviewDisposition: 'reviewed',
            fieldSources: {
                ...batchCard().fieldSources,
                title: 'custom', authors: 'detected', language: 'detected',
                condition: 'custom', price: 'custom', location: 'default',
                publication: 'default',
            },
        });
        expect(() => decodeOwnerBatchReviewResponse(
            'read_scan_batch_review', batchPayload(reviewed),
        )).not.toThrow();
        expect(() => decodeOwnerBatchReviewResponse(
            'read_scan_batch_review', batchPayload({
                ...reviewed,
                review: savedReview({ originalTitle: 'Observed title' }),
                fieldSources: { ...reviewed.fieldSources, title: 'custom' },
            }),
        )).toThrow();
        expect(() => decodeOwnerBatchReviewResponse(
            'read_scan_batch_review', batchPayload({
                ...reviewed,
                review: savedReview({ originalTitle: 'Observed title' }),
                fieldSources: { ...reviewed.fieldSources, title: 'detected' },
            }),
        )).not.toThrow();
    });
});
