import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StoreViewListContent } from '../screens/StoreViewListScreen';
import { useStoreViewPage } from '../queries/storeViewQueries';
import { useStoreViewSummary } from '../queries/storeViewSummaryQueries';
import { createStoreViewSummarySession } from '../state/storeViewFilterPreference';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../queries/storeViewQueries', () => ({ useStoreViewPage: jest.fn() }));
jest.mock('../queries/storeViewSummaryQueries', () => ({ useStoreViewSummary: jest.fn() }));
jest.mock('../screens/StoreViewAccessBoundary', () => ({ StoreViewAccessBoundary: 'Boundary' }));
jest.mock('../components/StoreViewCard', () => ({ StoreViewCard: 'Card' }));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: any) => children }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: any) => children }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));

const identity = { userId: 'summary-races-owner', storeId: 'store-a' };
const key = `storeView_summaryOpen:v1:${identity.userId}:${identity.storeId}`;
const storageRead = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
const data = {
    counts: { all: 6, private: 1, live: 1, paused: 1, needsAttention: 1, outOfStock: 1 },
    availableStockValueMinor: '17500',
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(storageRead);
    await AsyncStorage.clear();
    (useStoreViewPage as jest.Mock).mockReturnValue({ items: [], isPending: false, isError: false, refetch: jest.fn() });
    (useStoreViewSummary as jest.Mock).mockReturnValue({ data, isPending: false, isError: false, refetch: jest.fn() });
});

it('keeps the latest toggle when a startup read resolves after two taps', async () => {
    const pending = deferred<string | null>();
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(k => k === key ? pending.promise : storageRead(k));
    const screen = render(<StoreViewListContent identity={identity} />);
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith(key));
    fireEvent.press(screen.getByTestId('store-view-summary-button'));
    fireEvent.press(screen.getByTestId('store-view-summary-button'));
    await act(async () => { pending.resolve('true'); });
    expect(screen.queryByTestId('store-view-summary-panel')).toBeNull();
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(key, 'false'));
    (AsyncStorage.getItem as jest.Mock).mockImplementation(storageRead);
    expect(await createStoreViewSummarySession(identity).read()).toBe(false);
});

it.each(['store', 'account'])('ignores a summary read that resolves after a %s switch', async kind => {
    const pending = deferred<string | null>();
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(k => k === key ? pending.promise : storageRead(k));
    const screen = render(<StoreViewListContent identity={identity} />);
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith(key));
    const next = kind === 'store'
        ? { ...identity, storeId: 'store-b' }
        : { ...identity, userId: 'summary-races-other-owner' };
    screen.rerender(<StoreViewListContent identity={next} />);
    await act(async () => { pending.resolve('true'); });
    expect(screen.queryByTestId('store-view-summary-panel')).toBeNull();
    expect(screen.getByTestId('store-view-summary-button').props.accessibilityState).toEqual({ expanded: false });
});

it('keeps the summary toggle usable when reading and writing the preference fail', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(k => k === key
        ? Promise.reject(new Error('local read failed')) : storageRead(k));
    const screen = render(<StoreViewListContent identity={identity} />);
    await act(async () => { await Promise.resolve(); });
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('local write failed'));
    fireEvent.press(screen.getByTestId('store-view-summary-button'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('store-view-summary-panel')).toBeTruthy();
    fireEvent.press(screen.getByTestId('store-view-summary-button'));
    expect(screen.queryByTestId('store-view-summary-panel')).toBeNull();
});
