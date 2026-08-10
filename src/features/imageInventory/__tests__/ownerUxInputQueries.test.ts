import { QueryClient } from '@tanstack/react-query';
import {
    imageInventoryKeys,
    resetImageInventoryIdentityForTests,
} from '../queries/ownerUxQueries';
import { synchronizeRemoveInputSuccess } from '../queries/ownerUxInputQueries';
import { testUuid } from '../testing/ownerUxTestFixtures';

const identity = { userId: 'owner-a', storeId: 'store-a' };
const sessionId = testUuid(1);
const canonical = {
    sessionId,
    inputId: testUuid(2),
    inputState: 'skipped' as const,
    inputVersion: 2,
    sessionVersion: 4,
    presentationRevision: 5,
};

describe('Phase 9 remove-input cache synchronization', () => {
    let client: QueryClient;

    beforeEach(() => {
        client = new QueryClient();
        resetImageInventoryIdentityForTests(identity);
    });

    afterEach(() => client.clear());

    it('refreshes only the current Owner/store session surfaces', async () => {
        const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue();

        await expect(synchronizeRemoveInputSuccess(
            client, identity, sessionId, canonical,
        )).resolves.toBe(true);

        expect(invalidate).toHaveBeenCalledTimes(5);
        expect(invalidate.mock.calls.map(([options]) => options?.queryKey)).toEqual(expect.arrayContaining([
            imageInventoryKeys.discovery(identity),
            imageInventoryKeys.session(identity, sessionId),
            imageInventoryKeys.inputs(identity, sessionId),
            imageInventoryKeys.readiness(identity, sessionId),
            [...imageInventoryKeys.identity(identity), 'candidates'],
        ]));
    });

    it('ignores stale identity or cross-session completion', async () => {
        const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue();
        resetImageInventoryIdentityForTests({ userId: 'owner-b', storeId: 'store-b' });
        await expect(synchronizeRemoveInputSuccess(
            client, identity, sessionId, canonical,
        )).resolves.toBe(false);
        resetImageInventoryIdentityForTests(identity);
        await expect(synchronizeRemoveInputSuccess(
            client, identity, sessionId, { ...canonical, sessionId: testUuid(3) },
        )).resolves.toBe(false);
        expect(invalidate).not.toHaveBeenCalled();
    });
});
