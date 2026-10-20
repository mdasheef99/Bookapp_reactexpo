import { OWNER_INVENTORY_CONTRACT_VERSION } from '../api/ownerInventoryReadService';

describe('ownerInventoryReadService', () => {
    it('keeps the contract version shared by the remaining owner inventory cache keys', () => {
        expect(OWNER_INVENTORY_CONTRACT_VERSION).toBe('phase9-owner-inventory-v2');
    });
});
