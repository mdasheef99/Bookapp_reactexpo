import { supabase } from '@/lib/supabase';
import { PublicationClientError, publicationService } from '../api/publicationService';

jest.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;
const inventoryId = '00000000-0000-4000-8000-000000000001';
const capabilityId = '00000000-0000-4000-8000-000000000021';
const mediaAssetId = '00000000-0000-4000-8000-000000000031';

describe('publicationService HTTP status (R8)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('bodyless 403 on readStatus rejects P9_RESPONSE_INVALID with httpStatus 403', async () => {
        invoke.mockResolvedValue({ data: null, error: { context: new Response('', { status: 403 }) } });
        const failure = await publicationService.readStatus(inventoryId).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(PublicationClientError);
        expect(failure).toMatchObject({
            code: 'P9_RESPONSE_INVALID', retryable: false,
            message: 'Publication response was invalid.', httpStatus: 403,
        });
    });

    it('bodyless 401 on readStatus rejects P9_RESPONSE_INVALID with httpStatus 401', async () => {
        invoke.mockResolvedValue({ data: null, error: { context: new Response('', { status: 401 }) } });
        const failure = await publicationService.readStatus(inventoryId).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(PublicationClientError);
        expect(failure).toMatchObject({
            code: 'P9_RESPONSE_INVALID', retryable: false,
            message: 'Publication response was invalid.', httpStatus: 401,
        });
    });

    it('bodyless 403 on media link rejects P9_RESPONSE_INVALID with httpStatus 403', async () => {
        invoke.mockResolvedValue({ data: null, error: { context: new Response('', { status: 403 }) } });
        const failure = await publicationService.submitPublicCopyMedia({
            inventoryId, capabilityId, mediaAssetId, role: 'actual_copy', publicOrder: 1,
            idempotencyKey: 'publication-command-0001', commandId: '00000000-0000-4000-8000-000000000002',
        }).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(PublicationClientError);
        expect(failure).toMatchObject({
            code: 'P9_RESPONSE_INVALID', retryable: false,
            message: 'Publication response was invalid.', httpStatus: 403,
        });
    });

    it('bodyless 401 on completion read rejects P9_RESPONSE_INVALID with httpStatus 401', async () => {
        invoke.mockResolvedValue({ data: null, error: { context: new Response('', { status: 401 }) } });
        const failure = await publicationService.readPublicCopyStatus(mediaAssetId).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(PublicationClientError);
        expect(failure).toMatchObject({
            code: 'P9_RESPONSE_INVALID', retryable: false,
            message: 'Publication response was invalid.', httpStatus: 401,
        });
    });

    it('envelope P9_OWNER_NOT_AUTHORIZED keeps its code and carries httpStatus 403', async () => {
        const body = { error: 'P9_OWNER_NOT_AUTHORIZED', retryable: false, message: 'forbidden' };
        invoke.mockResolvedValue({
            data: null,
            error: {
                context: new Response(JSON.stringify(body), {
                    status: 403, headers: { 'Content-Type': 'application/json' },
                }),
            },
        });
        const failure = await publicationService.readStatus(inventoryId).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(PublicationClientError);
        expect(failure).toMatchObject({
            code: 'P9_OWNER_NOT_AUTHORIZED', retryable: false,
            message: 'forbidden', httpStatus: 403,
        });
    });
});
