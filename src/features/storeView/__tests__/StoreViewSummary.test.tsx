import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { StoreViewListContent } from '../screens/StoreViewListScreen';
import { useStoreViewPage } from '../queries/storeViewQueries';
import { useStoreViewSummary } from '../queries/storeViewSummaryQueries';
import { StoreViewSummaryPanel, STORE_VIEW_SUMMARY_TILES, formatStockValueMinor } from '../components/StoreViewSummaryPanel';
import { createStoreViewSummarySession } from '../state/storeViewFilterPreference';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../queries/storeViewQueries', () => ({ useStoreViewPage: jest.fn() }));
jest.mock('../queries/storeViewSummaryQueries', () => ({ useStoreViewSummary: jest.fn() }));
jest.mock('../screens/StoreViewAccessBoundary', () => ({ StoreViewAccessBoundary: 'Boundary' }));
jest.mock('../components/StoreViewCard', () => ({ StoreViewCard: 'Card' }));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: any) => children }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: any) => children }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
const identity = { userId: 'summary-owner', storeId: 'store-a' };
const data = { counts: { all: 10, private: 6, live: 1, paused: 1, needsAttention: 1, outOfStock: 1 }, availableStockValueMinor: '48235000' };
const refetchPage = jest.fn();
const refetchSummary = jest.fn();
const storageRead = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
beforeEach(async () => {
  jest.restoreAllMocks(); jest.clearAllMocks(); await AsyncStorage.clear();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(storageRead);
  (useStoreViewPage as jest.Mock).mockReturnValue({ items: [], refetch: refetchPage, isPending: false, isError: false });
  (useStoreViewSummary as jest.Mock).mockReturnValue({ data, refetch: refetchSummary, isPending: false, isError: false });
});
it.each([['0', '₹0.00'], ['17500', '₹175.00'], ['48235000', '₹4,82,350.00'], ['9007199254740993', '₹9,00,71,99,25,47,409.93'], ['13835058042397261827', '₹1,38,35,05,80,42,39,72,618.27']])('formats %s without losing a paise', (input, expected) => {
  expect(formatStockValueMinor(input)).toBe(expected);
});
it('toggles and remembers open and closed per identity', async () => {
  const screen = render(<StoreViewListContent identity={identity} />);
  expect(screen.queryByTestId('store-view-summary-panel')).toBeNull();
  fireEvent.press(screen.getByTestId('store-view-summary-button'));
  expect(screen.getByTestId('store-view-summary-button').props.accessibilityState).toEqual({ expanded: true });
  expect(screen.getByText('Hide summary')).toBeTruthy();
  expect(screen.getByTestId('store-view-summary-value')).toHaveTextContent('₹4,82,350.00');
  await waitFor(async () => expect(await createStoreViewSummarySession(identity).read()).toBe(true));
  screen.unmount();
  const next = render(<StoreViewListContent identity={identity} />);
  await waitFor(() => expect(next.getByTestId('store-view-summary-panel')).toBeTruthy());
  fireEvent.press(next.getByTestId('store-view-summary-button'));
  await waitFor(async () => expect(await createStoreViewSummarySession(identity).read()).toBe(false));
  next.rerender(<StoreViewListContent identity={{ ...identity, storeId: 'store-b' }} />);
  expect(next.queryByTestId('store-view-summary-panel')).toBeNull();
});
it('tile and chip taps set and persist the same filter and guard a late startup read', async () => {
  let resolve!: (value: string) => void;
  const original = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
  jest.spyOn(AsyncStorage, 'getItem').mockImplementation(key => key.startsWith('storeView_lastFilter:') ? new Promise(done => { resolve = done; }) : original(key));
  const screen = render(<StoreViewListContent identity={identity} />);
  await waitFor(() => expect(resolve).toBeDefined());
  fireEvent.press(screen.getByTestId('store-view-summary-button'));
  expect(screen.getByLabelText('Private, 6 books, filter')).toBeTruthy();
  fireEvent.press(screen.getByTestId('store-view-summary-tile-private'));
  await act(async () => { resolve('live'); });
  expect(screen.getByTestId('store-view-filter-private')).toBeSelected();
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith('storeView_lastFilter:v1:summary-owner:store-a', 'private'));
  fireEvent.press(screen.getByTestId('store-view-filter-paused'));
  expect(screen.getByTestId('store-view-filter-paused')).toBeSelected();
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith('storeView_lastFilter:v1:summary-owner:store-a', 'paused'));
});
it('renders an added config entry without a panel code change', () => {
  const tiles = [...STORE_VIEW_SUMMARY_TILES, { id: 'fake', label: 'Fake', select: () => 42, filter: 'all' as const }];
  const onSelect = jest.fn();
  const screen = render(<StoreViewSummaryPanel data={data} pending={false} error={false} onRetry={refetchSummary} onSelect={onSelect} tiles={tiles} />);
  fireEvent.press(screen.getByLabelText('Fake, 42 books, filter'));
  expect(onSelect).toHaveBeenCalledWith('all');
});
it('shows the offline state with Retry while the first summary load is paused', () => {
  (useStoreViewSummary as jest.Mock).mockReturnValue({ isPending: true, fetchStatus: 'paused', refetch: refetchSummary });
  const screen = render(<StoreViewListContent identity={identity} />);
  fireEvent.press(screen.getByTestId('store-view-summary-button'));
  expect(screen.getByText('You are offline. Summary will load when you are back online.')).toBeTruthy();
  fireEvent.press(screen.getByTestId('store-view-summary-retry'));
  expect(refetchSummary).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByTestId('store-view-filter-paused'));
  expect(screen.getByTestId('store-view-filter-paused')).toBeSelected();
});
it('renders the offline panel state directly when paused without data', () => {
  const onRetry = jest.fn();
  const screen = render(<StoreViewSummaryPanel pending paused error={false} onRetry={onRetry} onSelect={jest.fn()} />);
  expect(screen.getByText('You are offline. Summary will load when you are back online.')).toBeTruthy();
  fireEvent.press(screen.getByTestId('store-view-summary-retry'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
it('keeps the list usable during summary loading/error, supports Retry and zeros', () => {
  (useStoreViewSummary as jest.Mock).mockReturnValue({ isPending: true, refetch: refetchSummary });
  const screen = render(<StoreViewListContent identity={identity} />);
  fireEvent.press(screen.getByTestId('store-view-summary-button'));
  expect(screen.getByText('Loading summary…')).toBeTruthy();
  (useStoreViewSummary as jest.Mock).mockReturnValue({ isError: true, data, refetch: refetchSummary });
  screen.rerender(<StoreViewListContent identity={identity} />);
  expect(screen.queryByTestId('store-view-summary-value')).toBeNull();
  fireEvent.press(screen.getByTestId('store-view-summary-retry'));
  expect(refetchSummary).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByTestId('store-view-filter-paused'));
  expect(screen.getByTestId('store-view-filter-paused')).toBeSelected();
  (useStoreViewSummary as jest.Mock).mockReturnValue({ data: { counts: Object.fromEntries(Object.keys(data.counts).map(k => [k, 0])), availableStockValueMinor: '0' }, refetch: refetchSummary });
  screen.rerender(<StoreViewListContent identity={identity} />);
  expect(screen.getByTestId('store-view-summary-value')).toHaveTextContent('₹0.00');
  fireEvent(screen.UNSAFE_getByType(FlatList), 'refresh');
  expect(refetchSummary).toHaveBeenCalledTimes(2);
  expect(refetchPage).toHaveBeenCalledTimes(1);
});
it('refreshes the summary and the list on refocus, but not on mount', () => {
  render(<StoreViewListContent identity={identity} />);
  const focus = (useFocusEffect as jest.Mock).mock.calls[0][0];
  act(() => { focus(); });
  expect(refetchSummary).not.toHaveBeenCalled();
  expect(refetchPage).not.toHaveBeenCalled();
  act(() => { focus(); });
  expect(refetchSummary).toHaveBeenCalledTimes(1);
  expect(refetchPage).toHaveBeenCalledTimes(1);
});
it('ignores a late stored toggle after a tap and after an identity switch', async () => {
  let finish!: (value: string) => void;
  (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => Promise.resolve(null))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const screen = render(<StoreViewListContent identity={identity} />);
  await waitFor(() => expect(finish).toBeDefined());
  fireEvent.press(screen.getByTestId('store-view-summary-button'));
  fireEvent.press(screen.getByTestId('store-view-summary-button'));
  await act(async () => finish('true'));
  expect(screen.queryByTestId('store-view-summary-panel')).toBeNull();
  await waitFor(async () => expect(await createStoreViewSummarySession(identity).read()).toBe(false));
  let late!: (value: string) => void;
  (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => Promise.resolve(null))
    .mockImplementationOnce(() => new Promise(resolve => { late = resolve; }));
  screen.rerender(<StoreViewListContent identity={{ ...identity, storeId: 'late-store' }} />);
  await waitFor(() => expect(late).toBeDefined());
  screen.rerender(<StoreViewListContent identity={{ ...identity, userId: 'next-owner' }} />);
  await act(async () => late('true'));
  expect(screen.queryByTestId('store-view-summary-panel')).toBeNull();
});
