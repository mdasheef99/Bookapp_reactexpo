jest.mock('@/features/marketplace/commerce/services/commerceSession', () => ({ clearCommerceSession: jest.fn(async () => {}) }));
jest.mock('@/features/imageInventory/queries/ownerUxQueries', () => ({ clearImageInventoryIdentityState: jest.fn(async () => {}) }));
jest.mock('@/lib/sentry', () => ({ captureAppException: jest.fn() }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureAppException } from '@/lib/sentry';
import { useAuthStore } from '@/features/auth/store/authStore';
import { applySessionTransition, resetSessionCoordinatorForTests } from '../sessionCoordinator';

function freshCoordinator(userId: string) {
    let isolated!: typeof import('../sessionCoordinator') & typeof import('@/features/storeView/state/storeViewFilterPreference') & {
        store: typeof useAuthStore; report: typeof captureAppException;
    };
    jest.isolateModules(() => {
        jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: AsyncStorage }));
        isolated = {
            ...require('../sessionCoordinator'),
            ...require('@/features/storeView/state/storeViewFilterPreference'),
            store: require('@/features/auth/store/authStore').useAuthStore,
            report: require('@/lib/sentry').captureAppException,
        };
    });
    isolated.resetSessionCoordinatorForTests(userId);
    return isolated;
}

const key = 'storeView_lastFilter:v1:cleanup-owner:store-a';
const storageRead = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
const storageWrite = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(storageRead);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(storageWrite);
    await AsyncStorage.clear();
    await AsyncStorage.setItem(key, 'paused');
    resetSessionCoordinatorForTests('cleanup-owner');
});
afterEach(() => { jest.useRealTimers(); });
it('removes the previous user preference on logout', async () => {
    await applySessionTransition('SIGNED_OUT', null);
    expect(await AsyncStorage.getItem(key)).toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
});
it('removes the previous user preference on account switch', async () => {
    await applySessionTransition('SIGNED_IN', { user: { id: 'new-owner' }, access_token: 'token' } as never);
    expect(await AsyncStorage.getItem(key)).toBeNull();
    expect(useAuthStore.getState().session?.user.id).toBe('new-owner');
});
it.each(['SIGNED_OUT', 'SIGNED_IN'])('reports cleanup failure without blocking %s and retries on the next cleanup', async (event) => {
    jest.spyOn(AsyncStorage, 'multiRemove').mockRejectedValueOnce(new Error('storage failed'));
    const session = event === 'SIGNED_IN' ? { user: { id: 'new-owner' }, access_token: 'token' } as never : null;
    await expect(applySessionTransition(event, session)).resolves.toBeUndefined();
    expect(captureAppException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({
        area: 'auth', action: 'user_session_cleanup_failed',
        tags: { feature: 'auth', coordinator: 'application-session' },
    }));
    expect(useAuthStore.getState().status).toBe(session ? 'authenticated' : 'unauthenticated');
    resetSessionCoordinatorForTests('new-owner');
    await applySessionTransition('SIGNED_OUT', null);
    expect(await AsyncStorage.getItem(key)).toBeNull();
});

describe('stalled Store View preferences', () => {
    it.each([
        ['SIGNED_OUT', 'getItem'], ['SIGNED_IN', 'getItem'],
        ['SIGNED_OUT', 'setItem'], ['SIGNED_IN', 'setItem'],
    ] as const)('finishes %s within 3 seconds when a preference %s never settles', async (event, method) => {
        jest.useFakeTimers();
        const userId = `stalled-${event}-${method}`;
        const { createStoreViewFilterSession, applySessionTransition, store, report } = freshCoordinator(userId);
        const preferenceKey = `storeView_lastFilter:v1:${userId}:store-a`;
        await AsyncStorage.setItem(preferenceKey, 'paused');
        const old = createStoreViewFilterSession({ userId, storeId: 'store-a' });
        const original = (AsyncStorage[method] as jest.Mock).getMockImplementation()!;
        jest.spyOn(AsyncStorage, method).mockImplementation((storageKey: string, ...args: any[]) =>
            storageKey === preferenceKey ? new Promise<never>(() => {}) : (original as any)(storageKey, ...args));
        void (method === 'getItem' ? old.read() : old.write('live'));
        await jest.advanceTimersByTimeAsync(0);
        // This queued write must remain fenced even if the stalled call finishes later.
        void old.write('private');
        const session = event === 'SIGNED_IN' ? { user: { id: 'next-owner' }, access_token: 'token' } as never : null;
        let finished = false;
        const transition = applySessionTransition(event, session).then(() => { finished = true; });
        await jest.advanceTimersByTimeAsync(2999);
        expect(finished).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        expect(finished).toBe(true);
        await transition;
        expect(store.getState().status).toBe(session ? 'authenticated' : 'unauthenticated');
        expect(report).toHaveBeenCalledTimes(1);
        expect(report).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({
            action: 'user_session_cleanup_failed',
        }));
        expect(JSON.parse((await AsyncStorage.getItem('storeView_lastFilter:v1:pendingCleanup'))!)).toContain(userId);
        expect(jest.getTimerCount()).toBe(0);
    });

    it.each(['getItem', 'setItem'] as const)('retries after a timed-out %s and fences late old writes', async (method) => {
        jest.useFakeTimers();
        const userId = `late-${method}`;
        const { createStoreViewFilterSession, applySessionTransition, clearStoreViewFilterPreferences, report } = freshCoordinator(userId);
        const preferenceKey = `storeView_lastFilter:v1:${userId}:store-a`;
        await AsyncStorage.setItem(preferenceKey, 'paused');
        const old = createStoreViewFilterSession({ userId, storeId: 'store-a' });
        let release!: () => void;
        const stalled = new Promise<void>((resolve) => { release = resolve; });
        const original = (AsyncStorage[method] as jest.Mock).getMockImplementation()!;
        jest.spyOn(AsyncStorage, method).mockImplementationOnce(async (...args: any[]) => {
            await stalled;
            return (original as any)(...args);
        });
        const operation = method === 'getItem' ? old.read() : old.write('live');
        await jest.advanceTimersByTimeAsync(0);
        const queued = old.write('private');
        let finished = false;
        const transition = applySessionTransition('SIGNED_OUT', null).then(() => { finished = true; });
        await jest.advanceTimersByTimeAsync(3000);
        expect(finished).toBe(true);
        await transition;
        expect(report).toHaveBeenCalledTimes(1);
        release();
        await Promise.all([operation, queued]);
        // A setItem already in storage at timeout must retract its late write.
        if (method === 'setItem') expect(await AsyncStorage.getItem(preferenceKey)).toBeNull();
        await clearStoreViewFilterPreferences('retry-owner');
        expect(await AsyncStorage.getItem(preferenceKey)).toBeNull();
        await old.write('live');
        expect(await AsyncStorage.getItem(preferenceKey)).toBeNull();
        expect(JSON.parse((await AsyncStorage.getItem('storeView_lastFilter:v1:pendingCleanup'))!)).not.toContain(userId);
        expect(jest.getTimerCount()).toBe(0);
    });
});
