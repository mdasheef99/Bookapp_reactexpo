import { OWNER_BATCH_REVIEW_CONTRACT_VERSION } from '../contracts/ownerBatchReviewContracts';
import { ownerBatchReviewService } from '../api/ownerBatchReviewService';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

const sessionId = '00000000-0000-4000-8000-000000000010';
const commandId = '00000000-0000-4000-8000-000000000002';
const idempotencyKey = 'remove-candidate:00000000-0000-4000-8000-000000000003';

function envelope(data: unknown) {
    return { data: { contractVersion: OWNER_BATCH_REVIEW_CONTRACT_VERSION, data } };
}

const CLOSE_SUMMARY_KEYS = [
    'imagesSubmitted', 'imagesProcessed', 'imagesFailed', 'imagesSkipped',
    'candidatesDetected', 'candidatesReviewReady', 'candidatesNeedsReview',
    'candidatesFailed', 'falseDetections', 'ownerRemovedCandidates',
    'manualMissedCandidates', 'committedInventoryItems',
    'quantitiesAddedToExisting', 'privateItems', 'publishedItems',
    'languageSkips', 'candidateCapSkips', 'qualitySkips',
] as const;

function zeroCloseSummary(overrides: Record<string, number> = {}) {
    return Object.fromEntries(CLOSE_SUMMARY_KEYS.map((key) => [key, overrides[key] ?? 0]));
}

const BLOCKER_CODES = [
    'input_processing', 'candidate_processing', 'candidate_failed',
    'review_missing', 'title_unconfirmed', 'author_confirmation_incomplete',
    'language_missing', 'metadata_choice_missing', 'quantity_invalid',
    'price_invalid', 'condition_missing', 'damage_answer_missing',
    'damage_details_missing', 'location_missing', 'publication_intent_missing',
    'duplicate_intent_missing', 'variant_source_stale',
] as const;

function zeroBlockerCounts() {
    return Object.fromEntries(BLOCKER_CODES.map((code) => [code, 0]));
}

beforeEach(() => {
    mockInvoke.mockReset().mockResolvedValue(envelope({}));
});

describe('Phase 9 NEW 6G-C retained contract service routing', () => {
    it('routes Start through the retained Start v2 action and contract version', async () => {
        mockInvoke.mockResolvedValue(envelope({
            sessionId,
            sessionVersion: 1,
            defaults: {
                languageHint: 'en', condition: null, location: 'Front shelf',
                priceMinor: null, quantity: 1, publication: 'private', script: null,
            },
            batchLabel: null,
        }));
        const result = await ownerBatchReviewService.startSessionV2({
            languageHint: 'en', condition: null, location: 'Front shelf',
            priceMinor: null, publication: 'private', batchLabel: null,
            idempotencyKey: 'start-scan-session-v2:00000000-0000-4000-8000-000000000001',
            commandId,
        });
        const [action, invocation] = mockInvoke.mock.calls[0];
        expect(action).toBe('phase9-owner-ingestion');
        expect(invocation.body.action).toBe('start_scan_session_v2');
        expect(invocation.body.contractVersion).toBe(OWNER_BATCH_REVIEW_CONTRACT_VERSION);
        expect(Object.keys(invocation.body)).not.toContain('quantity');
        expect(Object.keys(invocation.body)).not.toContain('script');
        expect(result.sessionId).toBe(sessionId);
        expect(result.defaults.quantity).toBe(1);
    });

    it('reads the session through v3 only', async () => {
        mockInvoke.mockResolvedValue(envelope({
            sessionId, status: 'active', sessionVersion: 2,
            startedAt: '2026-08-24T00:00:00.000Z', updatedAt: '2026-08-24T00:00:00.000Z',
            closedAt: null, expiresAt: '2026-08-25T00:00:00.000Z',
            defaults: {
                languageHint: 'en', condition: null, location: 'Front shelf',
                priceMinor: null, quantity: 1, publication: 'private', script: null,
            },
            batchLabel: null,
            closeSummary: zeroCloseSummary(), allInputsTerminal: false,
            closeState: 'not_closeable', presentationRevision: 1,
        }));
        await ownerBatchReviewService.readSessionV3(sessionId);
        expect(mockInvoke.mock.calls[0][1].body.action).toBe('read_scan_session_v3');
        expect(mockInvoke.mock.calls[0][1].body.contractVersion)
            .toBe(OWNER_BATCH_REVIEW_CONTRACT_VERSION);
    });

    it('never routes the new runtime through legacy nullable-v2 surfaces', () => {
        const routedActions = [
            ownerBatchReviewService.startSessionV2,
            ownerBatchReviewService.readSessionV3,
            ownerBatchReviewService.readBatchReview,
            ownerBatchReviewService.removeCandidateFromScan,
            ownerBatchReviewService.closeSessionV3,
        ];
        expect(routedActions).toHaveLength(5);
        expect(OWNER_BATCH_REVIEW_CONTRACT_VERSION).toBe('phase9-owner-batch-review-v1');
        expect('readSession' in ownerBatchReviewService).toBe(false);
        expect('closeSession' in ownerBatchReviewService).toBe(false);
        expect('readReadiness' in ownerBatchReviewService).toBe(false);
    });

    it('sends the exact remove request fields and decodes the canonical removal state', async () => {
        mockInvoke.mockResolvedValue(envelope({
            sessionId,
            candidateId: '00000000-0000-4000-8000-000000000020',
            candidateVersion: 4,
            sessionVersion: 5,
            presentationRevision: 6,
            reviewDisposition: 'owner_removed_from_scan',
            removedAt: '2026-08-24T01:00:00.000Z',
        }));
        const result = await ownerBatchReviewService.removeCandidateFromScan({
            sessionId,
            candidateId: '00000000-0000-4000-8000-000000000020',
            expectedCandidateVersion: 3,
            idempotencyKey,
            commandId,
        });
        expect(mockInvoke.mock.calls[0][1].body).toEqual({
            action: 'remove_candidate_from_scan',
            contractVersion: OWNER_BATCH_REVIEW_CONTRACT_VERSION,
            sessionId,
            candidateId: '00000000-0000-4000-8000-000000000020',
            expectedCandidateVersion: 3,
            idempotencyKey,
            commandId,
        });
        expect(result.reviewDisposition).toBe('owner_removed_from_scan');
    });

    it('closes through close_scan_session_v3 and returns the readiness shape with ownerRemovedCandidates', async () => {
        mockInvoke.mockResolvedValue(envelope({
            sessionId, sessionStatus: 'closed', sessionVersion: 7,
            allInputsTerminal: true,
            closeSummary: zeroCloseSummary({ ownerRemovedCandidates: 2 }),
            blockerCounts: zeroBlockerCounts(),
            nextBlockingCandidateId: null, closeState: 'closed',
            closeAllowed: false, presentationRevision: 8,
        }));
        const result = await ownerBatchReviewService.closeSessionV3({
            sessionId, expectedSessionVersion: 6,
            idempotencyKey: 'close-session:00000000-0000-4000-8000-000000000004',
            commandId,
        });
        expect(mockInvoke.mock.calls[0][1].body.action).toBe('close_scan_session_v3');
        expect(result.closeSummary.ownerRemovedCandidates).toBe(2);
    });

    it('maps safe server error codes to bounded client errors', async () => {
        mockInvoke.mockResolvedValue({
            data: undefined,
            error: {
                context: { json: () => ({ error: 'P9_CANDIDATE_VERSION_CONFLICT', retryable: true, message: 'changed' }) },
            },
        });
        await expect(ownerBatchReviewService.removeCandidateFromScan({
            sessionId,
            candidateId: '00000000-0000-4000-8000-000000000020',
            expectedCandidateVersion: 3,
            idempotencyKey,
            commandId,
        })).rejects.toMatchObject({ code: 'P9_CANDIDATE_VERSION_CONFLICT', retryable: true });
    });

    it('fails closed when a response carries forbidden private keys', async () => {
        mockInvoke.mockResolvedValue(envelope({
            sessionId, status: 'active', sessionVersion: 1,
            startedAt: '2026-08-24T00:00:00.000Z', updatedAt: '2026-08-24T00:00:00.000Z',
            closedAt: null, expiresAt: '2026-08-25T00:00:00.000Z',
            defaults: {
                languageHint: 'en', condition: null, location: 'Front shelf',
                priceMinor: null, quantity: 1, publication: 'private', script: null,
            },
            batchLabel: null,
            closeSummary: zeroCloseSummary(), allInputsTerminal: false,
            closeState: 'not_closeable', presentationRevision: 1,
            store_id: 'leak',
        }));
        await expect(ownerBatchReviewService.readSessionV3(sessionId))
            .rejects.toBeTruthy();
    });
});
