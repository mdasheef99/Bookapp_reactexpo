import { supabase } from '@/lib/supabase';
import { storeViewService } from '../api/storeViewService';
import { STORE_VIEW_CONTRACT_VERSION } from '../contracts/storeViewContracts';

jest.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;
const inventoryId = '00000000-0000-4000-8000-000000000001';

describe('Unit 7C WU2 Store View service', () => {
    beforeEach(() => jest.clearAllMocks());

    it('forwards filter and opaque cursor through the Owner Edge action', async () => {
        invoke.mockResolvedValue({
            data: {
                contractVersion: STORE_VIEW_CONTRACT_VERSION,
                data: { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
            },
            error: null,
        });
        await storeViewService.page({ filter: 'needs_attention', cursor: 'opaque', pageSize: 12 });
        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', {
            body: {
                action: 'read_store_view_page', contractVersion: STORE_VIEW_CONTRACT_VERSION,
                filter: 'needs_attention', cursor: 'opaque', pageSize: 12,
            },
        });
    });

    it('uses inventoryId—not listingId—as detail identity', async () => {
        invoke.mockResolvedValue({ data: null, error: {} });
        await storeViewService.detail(inventoryId).catch(() => undefined);
        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', {
            body: {
                action: 'read_store_view_detail', contractVersion: STORE_VIEW_CONTRACT_VERSION,
                inventoryId,
            },
        });
    });

    it('R7: reads a real Response P9_NOT_FOUND body with its receiver kept', async () => {
        const body = { error: 'P9_NOT_FOUND', retryable: false, message: 'missing' };
        invoke.mockResolvedValue({
            data: null,
            error: {
                context: new Response(JSON.stringify(body), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                }),
            },
        });
        // Detaching json() from its Response throws "Illegal invocation",
        // which used to turn this into a retryable P9_INTERNAL_ERROR.
        await expect(storeViewService.detail(inventoryId)).rejects.toMatchObject({
            code: 'P9_NOT_FOUND',
            retryable: false,
        });
    });

    it.each([[401], [403]])(
        'R18: a bodyless HTTP %s function error is typed access loss',
        async (status) => {
            invoke.mockResolvedValue({ data: null, error: { context: { status } } });
            await expect(storeViewService.detail(inventoryId)).rejects.toMatchObject({
                code: 'P9_AUTH_REQUIRED',
                retryable: false,
                httpStatus: status,
            });
        },
    );
});
