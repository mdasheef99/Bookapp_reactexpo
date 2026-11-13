import React, { type PropsWithChildren } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { storeViewManagementService } from '../api/storeViewManagementService';
import { StoreViewEditModal } from '../components/StoreViewEditModal';
import { StoreViewStockModal } from '../components/StoreViewStockModal';
import { useStoreViewDetail, storeViewKeys } from '../queries/storeViewQueries';
import { storeViewMediaKeys } from '../queries/storeViewMediaQueries';
import { storeViewHistoryKeys } from '../queries/storeViewHistoryQueries';
import { StoreViewDetailContent } from '../screens/StoreViewDetailScreen';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-image-picker', () => ({
    getMediaLibraryPermissionsAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000099' }));
jest.mock('../api/storeViewManagementService', () => {
    const actual = jest.requireActual('../api/storeViewManagementService');
    return { ...actual, storeViewManagementService: { save: jest.fn(), adjustStock: jest.fn() } };
});
jest.mock('../api/storeViewMediaService', () => {
    const actual = jest.requireActual('../api/storeViewMediaService');
    return { ...actual, storeViewMediaService: { read: jest.fn(), remove: jest.fn(), reorder: jest.fn(), replace: jest.fn() } };
});
jest.mock('../queries/storeViewQueries', () => {
    const actual = jest.requireActual('../queries/storeViewQueries');
    return { ...actual, useStoreViewDetail: jest.fn() };
});
jest.mock('../queries/storeViewHistoryQueries', () => {
    const actual = jest.requireActual('../queries/storeViewHistoryQueries');
    return { ...actual, useStoreViewHistory: () => ({ isPending: false, isError: false, data: null }) };
});
jest.mock('@/features/imageInventory/queries/publicationQueries', () => ({
    usePublicationCommands: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    accent: '#abc', bgPrimary: '#101820', border: '#555', textPrimary: '#fff', textSecondary: '#ddd',
} }) }));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: PropsWithChildren) => <>{children}</> }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: PropsWithChildren) => <>{children}</> }));

const identity = { userId: 'owner-a', storeId: 'store-a' };
const inventoryId = '00000000-0000-4000-8000-000000000001';
function book(version = 3) {
    return {
        identity: { inventoryId },
        presentation: { title: version === 3 ? 'Book' : 'Updated title', authors: ['Author'], language: 'en',
            publicDescription: '', condition: 'good', publicConditionNote: '', hasDamage: false,
            damageTypes: [], damageNote: null, isSellable: true, sellingPriceMinor: 35000 },
        versions: { inventoryVersion: version, publicationIntentVersion: 2 },
        stockSummary: { quantityAvailable: 1, stockState: 'low_stock' },
        lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
        attention: { attentionState: 'none', attentionReasons: [] },
        capabilities: ['edit_details', 'adjust_stock', 'manage_photos', 'publish', 'pause', 'republish', 'make_private', 'retry_publication'],
        mediaSummary: { approvedCount: 1 }, publicState: null,
        privateOperations: { shelfLocation: 'A3', internalNotes: 'Private' },
        stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
        historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
    } as any;
}
function deferred<T = any>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const clients: QueryClient[] = [];
function setup(refetch = jest.fn()) {
    const client = new QueryClient({ defaultOptions: {
        queries: { retry: false, gcTime: Infinity }, mutations: { retry: false },
    } });
    clients.push(client);
    const query = { isPending: false, data: book(), error: null as unknown, refetch };
    (useStoreViewDetail as jest.Mock).mockImplementation(() => query);
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const element = () => <StoreViewDetailContent identity={identity} inventoryId={inventoryId} />;
    const screen = render(element(), { wrapper });
    return { screen, client, query, rerender: () => screen.rerender(element()) };
}
type Change = 'stock' | 'save';
const savedMessage = (kind: Change) => kind === 'stock' ? 'Stock updated.' : 'Changes saved.';
const controls = ['store-view-edit', 'store-view-adjust-stock', 'store-view-manage-photos',
    'store-view-publish', 'store-view-pause', 'store-view-republish', 'store-view-make-private', 'store-view-retry-publication'];
function expectControls(screen: ReturnType<typeof render>, disabled: boolean) {
    controls.forEach((id) => disabled
        ? expect(screen.getByTestId(id)).toBeDisabled()
        : expect(screen.getByTestId(id)).toBeEnabled());
}
async function change(screen: ReturnType<typeof render>, kind: Change) {
    if (kind === 'stock') {
        fireEvent.press(screen.getByTestId('store-view-adjust-stock'));
        fireEvent.changeText(screen.getByTestId('store-view-stock-delta'), '2');
        fireEvent.press(screen.getByTestId('store-view-apply-stock'));
    } else {
        fireEvent.press(screen.getByTestId('store-view-edit'));
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'Updated title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
    }
    // The mutation and modal must finish even while the detail read is pending (F2).
    await waitFor(() => expect(screen.queryByTestId(kind === 'stock'
        ? 'store-view-apply-stock' : 'store-view-save-changes')).toBeNull());
}
async function flush() {
    await act(async () => {
        for (let i = 0; i < 80; i += 1) await Promise.resolve();
        await jest.advanceTimersByTimeAsync(0);
    });
}
function expectRefreshing(screen: ReturnType<typeof render>, kind: Change) {
    expect(screen.getByTestId('store-view-action-feedback')).toHaveTextContent(`${savedMessage(kind)} Updating details…`);
    expectControls(screen, true);
}
function expectRefreshFailure(screen: ReturnType<typeof render>, kind: Change) {
    expectControls(screen, false);
    expect(screen.getByTestId('store-view-action-feedback').props.children).toContain(savedMessage(kind));
    expect(screen.getByTestId('store-view-action-feedback')).toHaveTextContent(/could not be loaded/);
    expect(screen.getByTestId('store-view-action-feedback')).toHaveTextContent(/next action may ask.*review/i);
}
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
    (storeViewManagementService.save as jest.Mock).mockReset().mockResolvedValue({ inventoryVersion: 4 });
    (storeViewManagementService.adjustStock as jest.Mock).mockReset().mockResolvedValue({ inventoryVersion: 4 });
});
afterEach(() => {
    cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
    jest.useRealTimers();
});
jest.setTimeout(30000);

it.each(['stock', 'save'] as const)('L1 %s closes promptly and locks actions until detail refresh succeeds', async (kind) => {
    const pending = deferred();
    const refetch = jest.fn(() => pending.promise);
    const { screen, query, rerender } = setup(refetch);
    await change(screen, kind);
    expect(refetch).toHaveBeenCalledTimes(1);
    expectRefreshing(screen, kind);
    // Disabled controls cannot open a stale editor, stock sheet, or photo manager.
    fireEvent.press(screen.getByTestId('store-view-edit'));
    fireEvent.press(screen.getByTestId('store-view-adjust-stock'));
    fireEvent.press(screen.getByTestId('store-view-manage-photos'));
    expect(screen.queryByTestId('store-view-edit-title')).toBeNull();
    expect(screen.queryByTestId('store-view-stock-delta')).toBeNull();
    expect(screen.queryByText('Loading the latest photos…')).toBeNull();
    await act(async () => {
        query.data = book(4);
        pending.resolve({ data: query.data, error: null });
    });
    rerender();
    await waitFor(() => expectControls(screen, false));
    expect(screen.getByTestId('store-view-action-feedback').props.children).toBe(savedMessage(kind));
    fireEvent.press(screen.getByTestId('store-view-edit'));
    expect(screen.getByDisplayValue('Updated title')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'Another title');
    fireEvent.press(screen.getByTestId('store-view-save-changes'));
    await waitFor(() => expect(storeViewManagementService.save).toHaveBeenLastCalledWith(expect.objectContaining({
        expectedInventoryVersion: 4, changes: { title: 'Another title' },
    })));
});

it.each([['stock', 'returned'], ['save', 'returned'], ['stock', 'thrown'], ['save', 'thrown']] as const)(
    'L1 %s re-enables actions with saved-change warning on %s refresh failure', async (kind, outcome) => {
        const pending = deferred();
        const { screen } = setup(jest.fn(() => pending.promise));
        await change(screen, kind);
        expectRefreshing(screen, kind);
        await act(async () => {
            if (outcome === 'returned') pending.resolve({ data: book(), error: new Error('temporary read failure') });
            else pending.reject(new Error('temporary read failure'));
        });
        await waitFor(() => expectRefreshFailure(screen, kind));
    },
);

it.each(['stock', 'save'] as const)('L1 %s unlocks with a saved-change warning at the 15s timeout', async (kind) => {
    const { screen } = setup(jest.fn(() => new Promise(() => undefined)));
    await change(screen, kind);
    expectRefreshing(screen, kind);
    await act(async () => { await jest.advanceTimersByTimeAsync(14_999); });
    expectRefreshing(screen, kind);
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expectRefreshFailure(screen, kind);
});

it.each(['resolve', 'reject'] as const)('L1 unmount during refresh tolerates a late %s without warnings', async (outcome) => {
    // React 19 can silently ignore setters after unmount, so also observe
    // setter calls: removing the mount guard must make this test fail.
    let unmounted = false;
    const updatesAfterUnmount = jest.fn();
    const useState = React.useState;
    jest.spyOn(React, 'useState').mockImplementation(((initial: unknown) => {
        const [value, setValue] = useState(initial);
        return [value, (next: unknown) => {
            if (unmounted) updatesAfterUnmount();
            setValue(next);
        }];
    }) as typeof React.useState);
    const pending = deferred();
    const { screen } = setup(jest.fn(() => pending.promise));
    await change(screen, 'stock');
    expectRefreshing(screen, 'stock');
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    screen.unmount();
    unmounted = true;
    await act(async () => {
        if (outcome === 'resolve') pending.resolve({ data: book(4), error: null });
        else pending.reject(new Error('late read failure'));
    });
    await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    expect(error).not.toHaveBeenCalled();
    expect(updatesAfterUnmount).not.toHaveBeenCalled();
});

it.each(['success', 'failure'] as const)('L1 an immediate save refetch %s keeps its final feedback when the editor closes', async (outcome) => {
    const { screen } = setup(jest.fn().mockResolvedValue({ data: book(4),
        error: outcome === 'failure' ? new Error('temporary read failure') : null }));
    await change(screen, 'save');
    await flush();
    expectControls(screen, false);
    if (outcome === 'failure') expectRefreshFailure(screen, 'save');
    else expect(screen.getByTestId('store-view-action-feedback').props.children).toBe('Changes saved.');
});

it.each(['resolve', 'reject'] as const)('L1 old refresh %s after timeout cannot finish a newer refresh', async (outcome) => {
    const old = deferred();
    const newer = deferred();
    const { screen } = setup(jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise));
    await change(screen, 'stock');
    expectRefreshing(screen, 'stock');
    await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    expectRefreshFailure(screen, 'stock');
    await change(screen, 'save');
    expectRefreshing(screen, 'save');
    await act(async () => {
        if (outcome === 'resolve') old.resolve({ data: book(99), error: null });
        else old.reject(new Error('old read failure'));
    });
    expectRefreshing(screen, 'save');
    await act(async () => { newer.resolve({ data: book(4), error: null }); });
    expectControls(screen, false);
    expect(screen.getByTestId('store-view-action-feedback').props.children).toBe('Changes saved.');
});

it('L1 detail access loss during refresh still uses the existing effect to clear private caches', async () => {
    const pending = deferred();
    const { screen, client, query, rerender } = setup(jest.fn(() => pending.promise));
    client.setQueryData(storeViewKeys.detail(identity, inventoryId), book());
    client.setQueryData(storeViewMediaKeys.detail(identity, inventoryId), { private: 'photos' });
    client.setQueryData(storeViewHistoryKeys.detail(identity, inventoryId), { private: 'history' });
    await change(screen, 'stock');
    expectRefreshing(screen, 'stock');
    await act(async () => {
        query.error = { code: 'P9_OWNER_NOT_AUTHORIZED', httpStatus: 403 };
        pending.resolve({ data: book(), error: query.error });
    });
    rerender();
    await flush();
    expect(screen.getByText('Store View unavailable')).toBeTruthy();
    expect(client.getQueryData(storeViewKeys.detail(identity, inventoryId))).toBeUndefined();
    expect(client.getQueryData(storeViewMediaKeys.detail(identity, inventoryId))).toBeUndefined();
    expect(client.getQueryData(storeViewHistoryKeys.detail(identity, inventoryId))).toBeUndefined();
});

it.each(['edit', 'stock'] as const)('L3 %s modal fills its sheet with the theme background', (kind) => {
    const screen = kind === 'edit'
        ? render(<StoreViewEditModal visible detail={book()} identity={identity} submitting={false} error={null}
            onDismiss={jest.fn()} onSave={jest.fn()} onRefreshBook={jest.fn()} onAccessLost={jest.fn()} onSaved={jest.fn()} />)
        : render(<StoreViewStockModal visible detail={book()} submitting={false} error={null}
            onDismiss={jest.fn()} onSave={jest.fn()} />);
    expect(screen.getByTestId(`store-view-${kind}-sheet`)).toHaveStyle({ flex: 1, backgroundColor: useTheme().colors.bgPrimary });
});
