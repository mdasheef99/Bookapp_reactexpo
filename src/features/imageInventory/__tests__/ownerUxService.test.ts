import { supabase } from '@/lib/supabase';
import {
    OwnerUxClientError,
    ownerUxService,
} from '../api/ownerUxService';

jest.mock('@/lib/supabase', () => ({
    supabase: {
        functions: {
            invoke: jest.fn(),
        },
    },
}));

const invoke = supabase.functions.invoke as jest.Mock;

describe('Phase 9 Unit 6B Owner UX service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('invokes the assigned Edge query with no client store identity', async () => {
        invoke.mockResolvedValue({
            data: {
                contractVersion: 'phase9-owner-ux-v1',
                data: {
                    activeSession: null,
                    needsReviewCount: 0,
                    reviewScopeVersion: 1,
                },
            },
            error: null,
        });

        await expect(ownerUxService.discover()).resolves.toEqual({
            activeSession: null,
            needsReviewCount: 0,
            reviewScopeVersion: 1,
        });
        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', {
            body: {
                action: 'discover_scan_session',
                contractVersion: 'phase9-owner-ux-v1',
            },
        });
    });

    it('uses bounded page defaults and forwards opaque paging context', async () => {
        invoke.mockResolvedValue({
            data: {
                contractVersion: 'phase9-owner-ux-v1',
                data: {
                    items: [],
                    pageInfo: { nextCursor: null, hasMore: false },
                    scopeVersion: 1,
                    sessionVersion: null,
                },
            },
            error: null,
        });

        await ownerUxService.listCandidates({
            scope: 'needs_review',
            attention: 'needs_attention',
            cursor: 'opaque',
        });

        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', {
            body: {
                action: 'list_scan_candidates',
                contractVersion: 'phase9-owner-ux-v1',
                scope: 'needs_review',
                attention: 'needs_attention',
                pageSize: 20,
                cursor: 'opaque',
            },
        });
    });

    it.each([0, 51, 1.5])('rejects an invalid page size before invoking the Edge boundary: %s', async (pageSize) => {
        await expect(ownerUxService.listCandidates({
            scope: 'needs_review',
            pageSize,
        })).rejects.toMatchObject({ code: 'P9_REQUEST_INVALID' });
        expect(invoke).not.toHaveBeenCalled();
    });

    it('normalizes registered errors and hides malformed or raw failures', async () => {
        invoke.mockResolvedValueOnce({
            data: null,
            error: {
                context: {
                    json: async () => ({
                        error: 'P9_OWNER_NOT_AUTHORIZED',
                        retryable: true,
                        message: 'private SQL and account detail',
                    }),
                },
            },
        });
        await expect(ownerUxService.discover()).rejects.toMatchObject({
            code: 'P9_OWNER_NOT_AUTHORIZED',
            retryable: false,
            message: 'Owner access is required.',
        });

        invoke.mockRejectedValueOnce(new Error('private database detail'));
        const failure = await ownerUxService.discover().catch((error) => error);
        expect(failure).toBeInstanceOf(OwnerUxClientError);
        expect(failure).toMatchObject({
            code: 'P9_INTERNAL_ERROR',
            retryable: true,
            message: 'The request could not be completed.',
        });
        expect(String(failure)).not.toContain('private database detail');
    });

    it('maps an operation-inapplicable registered code to the local internal error', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: {
                context: {
                    json: async () => ({
                        error: 'P9_NOT_FOUND',
                        retryable: false,
                        message: 'private resource detail',
                    }),
                },
            },
        });

        await expect(ownerUxService.discover()).rejects.toMatchObject({
            code: 'P9_INTERNAL_ERROR',
            message: 'The request could not be completed.',
        });
    });

    it('maps the exact canonical Close command without client store identity', async () => {
        const readiness = {
            sessionId: '00000000-0000-4000-8000-000000000001',
            sessionStatus: 'closed', sessionVersion: 3, allInputsTerminal: true,
            closeSummary: {
                imagesSubmitted: 0, imagesProcessed: 0, imagesFailed: 0, imagesSkipped: 0,
                candidatesDetected: 0, candidatesReviewReady: 0, candidatesNeedsReview: 0,
                candidatesFailed: 0, falseDetections: 0, manualMissedCandidates: 0,
                committedInventoryItems: 0, quantitiesAddedToExisting: 0, privateItems: 0,
                publishedItems: 0, languageSkips: 0, candidateCapSkips: 0, qualitySkips: 0,
            },
            blockerCounts: {
                input_processing: 0, candidate_processing: 0, candidate_failed: 0,
                review_missing: 0, title_unconfirmed: 0, author_confirmation_incomplete: 0,
                language_missing: 0, metadata_choice_missing: 0, quantity_invalid: 0,
                price_invalid: 0, condition_missing: 0, damage_answer_missing: 0,
                damage_details_missing: 0, location_missing: 0, publication_intent_missing: 0,
                duplicate_intent_missing: 0, variant_source_stale: 0,
            },
            nextBlockingCandidateId: null, closeState: 'closed', closeAllowed: false,
            presentationRevision: 4,
        };
        invoke.mockResolvedValue({
            data: { contractVersion: 'phase9-owner-ux-v1', data: readiness }, error: null,
        });
        const request = {
            sessionId: readiness.sessionId,
            expectedSessionVersion: 2,
            idempotencyKey: 'close:fixed-command-0001',
            commandId: '00000000-0000-4000-8000-000000000009',
        };
        await expect(ownerUxService.closeSession(request)).resolves.toEqual(readiness);
        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', {
            body: { action: 'close_scan_session', contractVersion: 'phase9-owner-ux-v1', ...request },
        });
    });

    it('maps the exact remove-image command without client authority fields', async () => {
        const canonical = {
            sessionId: '00000000-0000-4000-8000-000000000001',
            inputId: '00000000-0000-4000-8000-000000000002',
            inputState: 'skipped',
            inputVersion: 2,
            sessionVersion: 3,
            presentationRevision: 4,
        };
        invoke.mockResolvedValue({
            data: { contractVersion: 'phase9-owner-ux-v1', data: canonical }, error: null,
        });
        const request = {
            sessionId: canonical.sessionId,
            inputId: canonical.inputId,
            expectedInputVersion: 1,
            idempotencyKey: 'remove-input:fixed-command-0001',
            commandId: '00000000-0000-4000-8000-000000000009',
        };

        await expect(ownerUxService.removeInput(request)).resolves.toEqual(canonical);
        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', {
            body: {
                action: 'remove_scan_input',
                contractVersion: 'phase9-owner-ux-v1',
                ...request,
            },
        });
    });

    it.each([
        () => ownerUxService.readSession('not-a-uuid'),
        () => ownerUxService.readCandidate(
            '00000000-0000-4000-8000-000000000001',
            'not-a-uuid',
        ),
        () => ownerUxService.readReadiness('not-a-uuid'),
        () => ownerUxService.listCandidates({
            scope: 'needs_review',
            cursor: '',
        }),
    ])('rejects malformed adapter requests before network invocation', async (request) => {
        await expect(request()).rejects.toMatchObject({ code: 'P9_REQUEST_INVALID' });
        expect(invoke).not.toHaveBeenCalled();
    });
});
