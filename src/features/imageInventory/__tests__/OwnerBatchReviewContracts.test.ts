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
});
