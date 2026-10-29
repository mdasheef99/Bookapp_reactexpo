import { supabase } from '@/lib/supabase';
import { storeViewMediaService } from '../api/storeViewMediaService';
import { storeViewManagementService } from '../api/storeViewManagementService';
import { storeViewHistoryService } from '../api/storeViewHistoryService';

jest.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;
const inventoryId = '00000000-0000-4000-8000-000000000001';
const commandId = '00000000-0000-4000-8000-000000000002';
const linkId = '00000000-0000-4000-8000-000000000003';

/**
 * R18: each of the four services (detail/page, media, management, history),
 * given a bodyless 401 and 403 function error, produces the typed
 * access-lost error. Both the bare `{ context: { status } }` shape and a
 * real bodyless `Response` are covered.
 */
describe('R18 service-boundary access loss on bodyless 401/403', () => {
    beforeEach(() => jest.clearAllMocks());

    it.each([[401], [403]])('media read maps bodyless HTTP %s to access loss', async (status) => {
        invoke.mockResolvedValue({ data: null, error: { context: { status } } });
        await expect(storeViewMediaService.read(inventoryId)).rejects.toMatchObject({
            code: 'P9_AUTH_REQUIRED',
            retryable: false,
            httpStatus: status,
        });
    });

    it.each([[401], [403]])('media command maps bodyless HTTP %s to access loss', async (status) => {
        invoke.mockResolvedValue({ data: null, error: { context: { status } } });
        await expect(storeViewMediaService.remove({
            inventoryId,
            expectedInventoryVersion: 3,
            linkId,
            idempotencyKey: 'store-view-media:remove:attempt-1',
            commandId,
        })).rejects.toMatchObject({
            code: 'P9_AUTH_REQUIRED',
            retryable: false,
            httpStatus: status,
        });
    });

    it.each([[401], [403]])('management save maps bodyless HTTP %s to access loss', async (status) => {
        invoke.mockResolvedValue({ data: null, error: { context: { status } } });
        await expect(storeViewManagementService.save({
            inventoryId,
            expectedInventoryVersion: 3,
            changes: { title: 'New title' },
            idempotencyKey: 'store-view-save:attempt-1',
            commandId,
        })).rejects.toMatchObject({
            code: 'P9_AUTH_REQUIRED',
            retryable: false,
            httpStatus: status,
        });
    });

    it.each([[401], [403]])('history maps bodyless HTTP %s to access loss', async (status) => {
        invoke.mockResolvedValue({ data: null, error: { context: { status } } });
        await expect(storeViewHistoryService(inventoryId)).rejects.toMatchObject({
            code: 'P9_AUTH_REQUIRED',
            retryable: false,
            httpStatus: status,
        });
    });

    it.each([[401], [403]])(
        'media read maps a real bodyless Response HTTP %s to access loss',
        async (status) => {
            invoke.mockResolvedValue({
                data: null,
                error: { context: new Response(null, { status }) },
            });
            await expect(storeViewMediaService.read(inventoryId)).rejects.toMatchObject({
                code: 'P9_AUTH_REQUIRED',
                retryable: false,
                httpStatus: status,
            });
        },
    );

    it.each([[401], [403]])(
        'history maps a real bodyless Response HTTP %s to access loss',
        async (status) => {
            invoke.mockResolvedValue({
                data: null,
                error: { context: new Response(null, { status }) },
            });
            await expect(storeViewHistoryService(inventoryId)).rejects.toMatchObject({
                code: 'P9_AUTH_REQUIRED',
                retryable: false,
                httpStatus: status,
            });
        },
    );
});
