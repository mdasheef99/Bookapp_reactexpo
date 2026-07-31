import { supabase } from '@/lib/supabase';
import { OwnerUxClientError, ownerUxService } from '../api/ownerUxService';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;
const review = {
    originalTitle: 'ಕನ್ನಡ ಪುಸ್ತಕ',
    authors: ['ಲೇಖಕ ಒಬ್ಬರು'],
    originalLanguage: 'kn',
    script: 'Knda',
    metadataChoice: { mode: 'manual' as const, selectionId: null },
    quantity: 1,
    priceMinor: 0,
    baseCondition: 'good' as const,
    damageDisclosure: {
        hasDamage: false,
        damageTypes: [],
        damageNote: null,
        isSellable: true,
        completeReadableSafe: true,
    },
    shelfLocation: 'Shelf A1',
    notes: { publicNote: null, internalNote: null },
    publicationIntent: 'private' as const,
    duplicateIntent: null,
    originalFieldConfirmation: { title: true, authors: [true] },
    candidateDisposition: 'reviewed' as const,
};

describe('Phase 9 Unit 6D review mutation adapter', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sends the canonical versioned command and decodes returned detail', async () => {
        const canonical = candidateDetailFixture({
            candidateState: 'ready',
            candidateVersion: 5,
            review: { value: review, reviewVersion: 1 },
            readiness: {
                reviewReady: true,
                blockers: [],
                derivedFromCandidateVersion: 5,
                derivedFromMetadataRevision: 7,
                derivedFromDuplicateAdviceVersion: null,
            },
            attentionCodes: ['review_ready'],
        });
        invoke.mockResolvedValue({
            data: { contractVersion: 'phase9-owner-ux-v1', data: canonical },
            error: null,
        });

        const request = {
            sessionId: testUuid(1),
            candidateId: testUuid(2),
            expectedCandidateVersion: 4,
            expectedMetadataRevision: 7,
            review,
            idempotencyKey: 'review:fixed-command-0001',
            commandId: testUuid(9),
        };
        await expect(ownerUxService.updateCandidateReview(request)).resolves.toEqual(canonical);
        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', {
            body: {
                action: 'update_candidate_review',
                contractVersion: 'phase9-owner-ux-v1',
                ...request,
            },
        });
    });

    it('keeps stale and idempotency errors operation-scoped and safe', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: {
                context: {
                    json: async () => ({
                        error: 'P9_CANDIDATE_VERSION_CONFLICT',
                        retryable: false,
                        message: 'private database detail',
                    }),
                },
            },
        });

        const failure = await ownerUxService.updateCandidateReview({
            sessionId: testUuid(1),
            candidateId: testUuid(2),
            expectedCandidateVersion: 4,
            expectedMetadataRevision: 7,
            review,
            idempotencyKey: 'review:fixed-command-0001',
            commandId: testUuid(9),
        }).catch((error) => error);

        expect(failure).toBeInstanceOf(OwnerUxClientError);
        expect(failure).toMatchObject({
            code: 'P9_CANDIDATE_VERSION_CONFLICT',
            message: 'The candidate changed. Refresh and try again.',
        });
        expect(String(failure)).not.toContain('private database detail');
    });

    it('rejects unknown fields and changed request shapes before transport', async () => {
        await expect(ownerUxService.updateCandidateReview({
            sessionId: testUuid(1),
            candidateId: testUuid(2),
            expectedCandidateVersion: 4,
            expectedMetadataRevision: 7,
            review: { ...review, rawPayload: 'forbidden' } as typeof review,
            idempotencyKey: 'review:fixed-command-0001',
            commandId: testUuid(9),
        })).rejects.toMatchObject({ code: 'P9_REQUEST_INVALID' });
        expect(invoke).not.toHaveBeenCalled();
    });
});
