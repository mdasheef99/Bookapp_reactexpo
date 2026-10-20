import { OWNER_INVENTORY_CONTRACT_VERSION } from '../api/ownerInventoryReadService';
import { ownerInventoryReadKeys } from '../queries/ownerInventoryReadQueries';

const identity = { userId: 'owner-a', storeId: 'store-a' } as const;

describe('ownerInventoryReadKeys', () => {
    it('scopes the owner inventory cache to the identity and contract version', () => {
        expect(ownerInventoryReadKeys.all).toContain('ownerRead');
        expect(ownerInventoryReadKeys.all).toContain(OWNER_INVENTORY_CONTRACT_VERSION);
        expect(ownerInventoryReadKeys.list(identity)).toEqual(expect.arrayContaining([
            identity.userId,
            identity.storeId,
            'ownerRead',
            OWNER_INVENTORY_CONTRACT_VERSION,
        ]));
    });

    it('normalizes equivalent filter inputs to one cache key', () => {
        const spaced = ownerInventoryReadKeys.list(identity, {
            query: '  BookShop ',
            condition: 'good',
        });
        const normalized = ownerInventoryReadKeys.list(identity, {
            query: 'bookshop',
            condition: 'good',
        });

        expect(spaced).toEqual(normalized);
        expect(spaced).toContain('bookshop');
    });

    it('keeps identities and filters in separate cache entries', () => {
        expect(ownerInventoryReadKeys.list(identity))
            .not.toEqual(ownerInventoryReadKeys.list({ userId: 'owner-b', storeId: 'store-a' }));
        expect(ownerInventoryReadKeys.list(identity, { condition: 'good' }))
            .not.toEqual(ownerInventoryReadKeys.list(identity, { condition: 'acceptable' }));
    });
});
