import { supabase } from '@/lib/supabase';
import { storeViewHistoryService } from '../api/storeViewHistoryService';

jest.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;
const inventoryId = '00000000-0000-4000-8000-000000000001';

function invokeError(body: unknown) {
    invoke.mockResolvedValue({
        data: null,
        error: { context: { json: async () => body } },
    });
}

describe('Store View history service retryable flag', () => {
    beforeEach(() => jest.clearAllMocks());

    it('keeps the server retryable flag on a temporary failure', async () => {
        invokeError({ error: 'P9_INTERNAL_ERROR', retryable: true });
        await expect(storeViewHistoryService(inventoryId)).rejects.toMatchObject({
            code: 'P9_INTERNAL_ERROR',
            retryable: true,
        });
    });

    it('reports non-retryable for a permanent failure', async () => {
        invokeError({ error: 'P9_REQUEST_INVALID', retryable: false });
        await expect(storeViewHistoryService(inventoryId)).rejects.toMatchObject({
            code: 'P9_REQUEST_INVALID',
            retryable: false,
        });
    });
});
