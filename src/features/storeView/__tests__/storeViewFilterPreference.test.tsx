import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StoreViewListContent } from '../screens/StoreViewListScreen';
import { useStoreViewPage } from '../queries/storeViewQueries';
import { clearStoreViewFilterPreferences, createStoreViewFilterSession } from '../state/storeViewFilterPreference';

jest.mock('../queries/storeViewQueries', () => ({ useStoreViewPage: jest.fn() }));
jest.mock('../screens/StoreViewAccessBoundary', () => ({ StoreViewAccessBoundary: 'Boundary' }));
jest.mock('../components/StoreViewCard', () => ({ StoreViewCard: 'Card' }));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: any) => children }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: any) => children }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
jest.setTimeout(30000);

const identity = { userId: 'filter-owner', storeId: 'store-a' };
const key = (user = identity.userId, store = identity.storeId) => `storeView_lastFilter:v1:${user}:${store}`;
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
}
beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (useStoreViewPage as jest.Mock).mockReturnValue({ items: [], isPending: false, isError: false });
});
const selected = (screen: ReturnType<typeof render>, filter: string) => expect(screen.getByTestId(`store-view-filter-${filter}`)).toBeSelected();

it('remembers Paused on remount, isolates stores and accounts', async () => {
    const first = render(<StoreViewListContent identity={identity} />);
    fireEvent.press(first.getByTestId('store-view-filter-paused'));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(key(), 'paused'));
    first.unmount();
    const second = render(<StoreViewListContent identity={identity} />);
    await waitFor(() => selected(second, 'paused'));
    second.rerender(<StoreViewListContent identity={{ ...identity, storeId: 'other-store' }} />);
    await waitFor(() => selected(second, 'all'));
    second.rerender(<StoreViewListContent identity={{ ...identity, userId: 'other-owner' }} />);
    await waitFor(() => selected(second, 'all'));
});
it.each(['broken', '"paused"', '', 'null'])('uses All for corrupt stored %j', async (value) => {
    await AsyncStorage.setItem(key(), value);
    const screen = render(<StoreViewListContent identity={identity} />);
    await act(async () => { await Promise.resolve(); });
    selected(screen, 'all');
});
it('ignores a late startup read after a tap and serializes that tap behind the read', async () => {
    const pending = deferred<string | null>();
    jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => pending.promise);
    const screen = render(<StoreViewListContent identity={identity} />);
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
    fireEvent.press(screen.getByTestId('store-view-filter-paused'));
    await act(async () => { pending.resolve('live'); });
    selected(screen, 'paused');
    await waitFor(async () => expect(await AsyncStorage.getItem(key())).toBe('paused'));
});
it.each(['store', 'user'])('ignores a stored read resolving after a %s switch', async (kind) => {
    const pending = deferred<string | null>();
    jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => pending.promise);
    const screen = render(<StoreViewListContent identity={identity} />);
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
    const next = kind === 'store' ? { ...identity, storeId: 'store-b' } : { ...identity, userId: 'owner-b' };
    screen.rerender(<StoreViewListContent identity={next} />);
    await act(async () => { pending.resolve('live'); });
    selected(screen, 'all');
});
it('storage read and write failures never block selecting a filter', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('write failed'));
    const screen = render(<StoreViewListContent identity={identity} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.press(screen.getByTestId('store-view-filter-paused'));
    await act(async () => { await Promise.resolve(); });
    selected(screen, 'paused');
});
it('cleanup waits for in-flight writes, removes all previous-user stores, and fences old sessions', async () => {
    const session = createStoreViewFilterSession(identity);
    const pending = deferred<void>();
    const original = AsyncStorage.setItem;
    jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(async (k, v) => {
        await pending.promise;
        return original(k, v);
    });
    const write = session.write('paused');
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(key(), 'paused'));
    await original(key(identity.userId, 'store-b'), 'live');
    await original(key('other-owner'), 'live');
    const cleanup = clearStoreViewFilterPreferences(identity.userId);
    await session.write('private');
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
    pending.resolve();
    await Promise.all([write, cleanup]);
    expect(await AsyncStorage.getItem(key())).toBeNull();
    expect(await AsyncStorage.getItem(key(identity.userId, 'store-b'))).toBeNull();
    expect(await AsyncStorage.getItem(key('other-owner'))).toBe('live');
    await session.write('live');
    expect(await AsyncStorage.getItem(key())).toBeNull();
    const signedBackIn = createStoreViewFilterSession(identity);
    await signedBackIn.write('private');
    expect(await signedBackIn.read()).toBe('private');
});
it('serializes rapid writes per key in selection order', async () => {
    const session = createStoreViewFilterSession(identity);
    const pending = deferred<void>();
    const original = AsyncStorage.setItem;
    jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(async (k, v) => { await pending.promise; return original(k, v); });
    const one = session.write('paused');
    const two = session.write('live');
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(key(), 'paused'));
    pending.resolve();
    await Promise.all([one, two]);
    expect(await session.read()).toBe('live');
});
it('retries failed user cleanup at the next cleanup even for a different user', async () => {
    await AsyncStorage.setItem(key(), 'paused');
    jest.spyOn(AsyncStorage, 'multiRemove').mockRejectedValueOnce(new Error('remove failed'));
    await expect(clearStoreViewFilterPreferences(identity.userId)).rejects.toThrow('remove failed');
    await clearStoreViewFilterPreferences('another-owner');
    expect(await AsyncStorage.getItem(key())).toBeNull();
});
