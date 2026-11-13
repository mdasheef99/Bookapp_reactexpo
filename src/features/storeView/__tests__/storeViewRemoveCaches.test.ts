import { QueryClient } from '@tanstack/react-query';
import { storeViewKeys } from '../queries/storeViewQueries';
import { storeViewSummaryKeys } from '../queries/storeViewSummaryQueries';
import { storeViewMediaKeys } from '../queries/storeViewMediaQueries';
import { storeViewHistoryKeys } from '../queries/storeViewHistoryQueries';
import { removeStoreViewCachesForIdentity } from '../queries/storeViewInvalidation';

const identityA = { userId: 'owner-a', storeId: 'store-a' };
const identityB = { userId: 'owner-b', storeId: 'store-b' };
const inventoryA = '00000000-0000-4000-8000-000000000001';
const inventoryB = '00000000-0000-4000-8000-000000000009';

describe('removeStoreViewCachesForIdentity', () => {
    it('removes every Store View cache for the identity while keeping other identities', () => {
        const client = new QueryClient();
        client.setQueryData(storeViewKeys.page(identityA, 'all'), { page: 'a' });
        client.setQueryData(storeViewKeys.detail(identityA, inventoryA), { detail: 'a' });
        client.setQueryData(storeViewSummaryKeys.summary(identityA), { summary: 'a' });
        client.setQueryData(storeViewMediaKeys.detail(identityA, inventoryA), { media: 'a' });
        client.setQueryData(storeViewHistoryKeys.detail(identityA, inventoryA), { history: 'a' });
        client.setQueryData(storeViewKeys.detail(identityB, inventoryB), { detail: 'b' });

        removeStoreViewCachesForIdentity(client, identityA);

        expect(client.getQueryData(storeViewKeys.page(identityA, 'all'))).toBeUndefined();
        expect(client.getQueryData(storeViewKeys.detail(identityA, inventoryA))).toBeUndefined();
        expect(client.getQueryData(storeViewSummaryKeys.summary(identityA))).toBeUndefined();
        expect(client.getQueryData(storeViewMediaKeys.detail(identityA, inventoryA))).toBeUndefined();
        expect(client.getQueryData(storeViewHistoryKeys.detail(identityA, inventoryA))).toBeUndefined();
        expect(client.getQueryData(storeViewKeys.detail(identityB, inventoryB))).toEqual({ detail: 'b' });
        client.clear();
    });

    it('skips removal when there is no query client', () => {
        expect(() => removeStoreViewCachesForIdentity(null, identityA)).not.toThrow();
        expect(() => removeStoreViewCachesForIdentity(undefined, identityA)).not.toThrow();
    });
});
