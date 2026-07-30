import type { StoreOwnerGateState } from '@/features/stores/types';
import { resolveImageInventoryAccess } from '../identity/imageInventoryIdentity';

describe('Phase 9 Unit 6B Owner identity boundary', () => {
    it('propagates authenticated user and server-resolved active store identity', () => {
        expect(resolveImageInventoryAccess(
            'user-1',
            { state: 'active_owner', storeId: 'store-1', storeName: 'Local Books' },
            false,
        )).toEqual({
            status: 'ready',
            identity: { userId: 'user-1', storeId: 'store-1' },
            storeName: 'Local Books',
        });
    });

    it.each<StoreOwnerGateState>([
        { state: 'unauthenticated' },
        { state: 'consumer_only' },
        { state: 'approved_pending_setup', storeId: 'store-1', storeName: 'Local Books' },
        { state: 'selling_restricted', storeId: 'store-1', storeName: 'Local Books' },
        { state: 'suspended', storeId: 'store-1', storeName: 'Local Books' },
    ])('fails closed for ineligible or revoked state $state', (gate) => {
        expect(resolveImageInventoryAccess('user-1', gate, false)).toEqual({
            status: 'unauthorized',
            identity: null,
        });
    });

    it('keeps child routes unavailable while auth or the Owner gate is loading', () => {
        expect(resolveImageInventoryAccess(null, undefined, true)).toEqual({
            status: 'loading',
            identity: null,
        });
    });
});
