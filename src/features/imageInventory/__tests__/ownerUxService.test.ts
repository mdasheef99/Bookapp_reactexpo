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
