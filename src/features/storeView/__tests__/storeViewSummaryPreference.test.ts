import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStoreViewSummarySession, createStoreViewFilterSession, clearStoreViewFilterPreferences } from '../state/storeViewFilterPreference';
import { applySessionTransition, resetSessionCoordinatorForTests } from '@/application/auth/sessionCoordinator';
import { resetAuthStoreForTests, useAuthStore } from '@/features/auth/store/authStore';
import { captureAppException } from '@/lib/sentry';

jest.mock('@/features/marketplace/commerce/services/commerceSession', () => ({ clearCommerceSession: jest.fn(async () => {}) }));
jest.mock('@/features/imageInventory/queries/ownerUxQueries', () => ({ clearImageInventoryIdentityState: jest.fn(async () => {}) }));
jest.mock('@/lib/sentry', () => ({ captureAppException: jest.fn() }));
const identity = { userId: 'summary-cleanup', storeId: 'a' };
const key = `storeView_summaryOpen:v1:${identity.userId}:a`;
const read = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
const write = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
beforeEach(async () => {
    jest.restoreAllMocks(); jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(read);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(write);
    await AsyncStorage.clear(); resetAuthStoreForTests(); resetSessionCoordinatorForTests(identity.userId);
});
afterEach(() => jest.useRealTimers());

it.each(['logout', 'account switch'])('the real coordinator clears both preferences on %s', async kind => {
    const old = createStoreViewSummarySession(identity);
    await old.write(true);
    await createStoreViewSummarySession({ ...identity, storeId: 'b' }).write(true);
    await createStoreViewFilterSession(identity).write('paused');
    const other = createStoreViewSummarySession({ ...identity, userId: 'other' });
    await other.write(true);
    const session = kind === 'logout' ? null : { user: { id: 'new-owner' }, access_token: 'token' } as never;
    await applySessionTransition(kind === 'logout' ? 'SIGNED_OUT' : 'SIGNED_IN', session);
    await old.write(true);
    expect(await AsyncStorage.getItem(key)).toBeNull();
    expect(await AsyncStorage.getItem(`storeView_summaryOpen:v1:${identity.userId}:b`)).toBeNull();
    expect(await createStoreViewFilterSession(identity).read()).toBe('all');
    expect(await other.read()).toBe(true);
});
it.each(['bad', '1', '', 'null'])('corrupt value %j falls back to closed', async value => {
    await AsyncStorage.setItem(key, value);
    expect(await createStoreViewSummarySession(identity).read()).toBe(false);
});
it('waits for summary writes during cleanup, fences stale handles and removes late writes', async () => {
    let finish!: () => void;
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(async (k, v) => { await new Promise<void>(resolve => { finish = resolve; }); return write(k, v); });
    const session = createStoreViewSummarySession(identity);
    const pending = session.write(true);
    for (let i = 0; i < 10 && !finish; i++) await Promise.resolve();
    const cleanup = clearStoreViewFilterPreferences(identity.userId);
    await session.write(false);
    finish(); await Promise.all([pending, cleanup]);
    expect(await AsyncStorage.getItem(key)).toBeNull();
    await session.write(true);
    expect(await AsyncStorage.getItem(key)).toBeNull();
});
it('a stuck summary write bounds actual auth cleanup at 3 seconds, reports and retracts the late write', async () => {
    jest.useFakeTimers();
    let finish!: () => void;
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(async (k, v) => { await new Promise<void>(resolve => { finish = resolve; }); return write(k, v); });
    const pending = createStoreViewSummarySession(identity).write(true);
    await jest.advanceTimersByTimeAsync(0);
    const transition = applySessionTransition('SIGNED_OUT', null);
    await jest.advanceTimersByTimeAsync(2999);
    expect(captureAppException).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await transition;
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(captureAppException).toHaveBeenCalledTimes(1);
    finish(); await pending;
    expect(await AsyncStorage.getItem(key)).toBeNull();
    await clearStoreViewFilterPreferences('next-owner');
    expect(jest.getTimerCount()).toBe(0);
});
