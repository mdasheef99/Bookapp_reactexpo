import AsyncStorage from '@react-native-async-storage/async-storage';

const pendingKey = 'storeView_lastFilter:v1:pendingCleanup';
const oldKey = 'storeView_lastFilter:v1:restart-owner:store-a';
const storageRead = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;

// Reload only preference memory; the device's AsyncStorage must survive the restart.
function restartPreferences(): typeof import('../state/storeViewFilterPreference') {
    let preferences!: typeof import('../state/storeViewFilterPreference');
    jest.isolateModules(() => {
        jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: AsyncStorage }));
        preferences = require('../state/storeViewFilterPreference');
    });
    return preferences;
}

beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(storageRead);
    await AsyncStorage.clear();
});
afterEach(() => { jest.useRealTimers(); });

it('retries a failed cleanup after restart when another user signs out', async () => {
    const first = restartPreferences();
    await AsyncStorage.setItem(oldKey, 'paused');
    const keepKey = 'storeView_lastFilter:v1:unrelated-owner:store-a';
    await AsyncStorage.setItem(keepKey, 'live');
    jest.spyOn(AsyncStorage, 'multiRemove').mockRejectedValueOnce(new Error('remove failed'));
    await expect(first.clearStoreViewFilterPreferences('restart-owner')).rejects.toThrow('remove failed');
    expect(JSON.parse((await AsyncStorage.getItem(pendingKey))!)).toEqual(['restart-owner']);
    const restarted = restartPreferences();
    await restarted.clearStoreViewFilterPreferences('another-owner');
    expect(await AsyncStorage.getItem(oldKey)).toBeNull();
    expect(await AsyncStorage.getItem(keepKey)).toBe('live');
    expect(JSON.parse((await AsyncStorage.getItem(pendingKey))!)).toEqual([]);
});

it('persists a timed-out cleanup before waiting and retries it after restart', async () => {
    jest.useFakeTimers();
    const first = restartPreferences();
    await AsyncStorage.setItem(oldKey, 'paused');
    const original = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation((key) => key === oldKey ? new Promise(() => {}) : original(key));
    void first.createStoreViewFilterSession({ userId: 'restart-owner', storeId: 'store-a' }).read();
    await jest.advanceTimersByTimeAsync(0);
    let failure: unknown;
    const cleanup = first.clearStoreViewFilterPreferences('restart-owner').catch((error) => { failure = error; });
    await jest.advanceTimersByTimeAsync(3000);
    expect(failure).toBeInstanceOf(Error);
    await cleanup;
    (AsyncStorage.getItem as jest.Mock).mockImplementation(original);
    await restartPreferences().clearStoreViewFilterPreferences('another-owner');
    expect(await AsyncStorage.getItem(oldKey)).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem(pendingKey))!)).toEqual([]);
});

it.each(['getItem', 'setItem', 'getAllKeys', 'multiRemove'] as const)('bounds a stalled cleanup %s call and clears its timer', async (method) => {
    jest.useFakeTimers();
    const preferences = restartPreferences();
    await AsyncStorage.setItem(oldKey, 'paused');
    const original = (AsyncStorage[method] as jest.Mock).getMockImplementation()!;
    jest.spyOn(AsyncStorage, method).mockImplementationOnce(() => new Promise<never>(() => {}));
    let failure: unknown;
    const cleanup = preferences.clearStoreViewFilterPreferences('restart-owner').catch((error) => { failure = error; });
    await jest.advanceTimersByTimeAsync(3000);
    expect(failure).toBeInstanceOf(Error);
    await cleanup;
    expect(jest.getTimerCount()).toBe(0);
    (AsyncStorage[method] as jest.Mock).mockImplementation(original);
});
