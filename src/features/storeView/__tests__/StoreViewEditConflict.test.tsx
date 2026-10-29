import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor as waitForBase } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { PublicationClientError } from '@/features/imageInventory/api/publicationService';
import { usePublicationCommands } from '@/features/imageInventory/queries/publicationQueries';
import { StoreViewManagementClientError } from '../api/storeViewManagementService';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';
import { useStoreViewDetail } from '../queries/storeViewQueries';
import { storeViewKeys } from '../queries/storeViewQueries';
import { storeViewMediaKeys } from '../queries/storeViewMediaQueries';
import { storeViewHistoryKeys } from '../queries/storeViewHistoryQueries';
import { StoreViewDetailContent } from '../screens/StoreViewDetailScreen';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/features/imageInventory/queries/publicationQueries', () => ({ usePublicationCommands: jest.fn() }));
jest.mock('../queries/storeViewManagementQueries', () => ({ useStoreViewManagementCommands: jest.fn() }));
jest.mock('../queries/storeViewQueries', () => {
    const actual = jest.requireActual('../queries/storeViewQueries');
    return { ...actual, useStoreViewDetail: jest.fn() };
});
jest.mock('../queries/storeViewMediaCommands', () => ({
    useStoreViewMediaCommands: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../queries/storeViewMediaQueries', () => {
    const actual = jest.requireActual('../queries/storeViewMediaQueries');
    return {
        ...actual,
        useStoreViewMedia: () => ({ isPending: false, isError: false, data: null, refetch: jest.fn() }),
    };
});
jest.mock('../queries/storeViewHistoryQueries', () => {
    const actual = jest.requireActual('../queries/storeViewHistoryQueries');
    return {
        ...actual,
        useStoreViewHistory: () => ({ isPending: false, isError: false, data: null }),
    };
});
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb', bgCard: '#fff', bgSecondary: '#eee', border: '#ddd',
        error: '#b91c1c', success: '#15803d', textPrimary: '#111',
        textSecondary: '#555', textTertiary: '#777',
    } }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const identity = { userId: 'owner-a', storeId: 'store-a' };
const inventoryId = '00000000-0000-4000-8000-000000000001';
const refetch = jest.fn();
const managementMutate = jest.fn();
const publicationMutate = jest.fn();

function detail(overrides: Record<string, unknown> = {}) {
    return {
        identity: { inventoryId },
        presentation: {
            title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
            publicDescription: 'Public copy.', condition: 'good', publicConditionNote: 'Light wear.',
            hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
            sellingPriceMinor: 35000,
        },
        stockSummary: { quantityAvailable: 1, stockState: 'low_stock' },
        lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
        attention: { attentionState: 'none', attentionReasons: [] },
        capabilities: ['edit_details', 'adjust_stock', 'pause', 'make_private'],
        versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
        mediaSummary: { approvedCount: 1 }, publicState: null,
        privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner note' },
        stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
        historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
        ...overrides,
    } as any;
}

function setDetail(data = detail()) {
    (useStoreViewDetail as jest.Mock).mockReturnValue({
        isPending: false, isError: false, data, refetch,
    });
}

function conflictError() {
    return new StoreViewManagementClientError('P9_VERSION_CONFLICT', false, 'This book changed.');
}

function openEditor(screen: ReturnType<typeof render>) {
    fireEvent.press(screen.getByTestId('store-view-edit'));
}

/** Loaded suites run slowly; the default 1s waitFor budget flakes. */
function waitFor(expectation: () => void) {
    return waitForBase(expectation, { timeout: 8000 });
}

describe('Slice 0a §3.2 edit session keeps the owner draft', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
        setDetail();
        refetch.mockResolvedValue({ data: detail(), error: null });
        (useStoreViewManagementCommands as jest.Mock).mockReturnValue({
            mutateAsync: managementMutate, isPending: false,
        });
        (usePublicationCommands as jest.Mock).mockReturnValue({
            mutateAsync: publicationMutate, isPending: false,
        });
        managementMutate.mockResolvedValue({ outcome: 'details_updated' });
        publicationMutate.mockResolvedValue({ outcome: 'paused' });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does not wipe typed edits when the detail refreshes in the background', () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My typed title');
        setDetail(detail({ versions: { inventoryVersion: 4, publicationIntentVersion: 2 } }));
        screen.rerender(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.getByDisplayValue('My typed title')).toBeTruthy();
    });

    it('rebases an untouched price from the refresh and sends only the edited title', async () => {
        const refreshed = detail({
            presentation: { ...detail().presentation, sellingPriceMinor: 40000 },
            versions: { inventoryVersion: 4, publicationIntentVersion: 2 },
        });
        refetch.mockResolvedValue({ data: refreshed, error: null });
        managementMutate.mockRejectedValueOnce(conflictError());
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByText(/kept — check them and save again/i)).toBeTruthy());
        expect(screen.getByDisplayValue('My title')).toBeTruthy();
        expect(screen.getByDisplayValue('40000')).toBeTruthy();
        managementMutate.mockResolvedValueOnce({ outcome: 'details_updated' });
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(2));
        expect(managementMutate).toHaveBeenLastCalledWith({
            kind: 'save', inventoryId, inventoryVersion: 4, changes: { title: 'My title' },
        });
        await waitFor(() => expect(screen.getByText('Changes saved.')).toBeTruthy());
    });

    it('marks a price both sessions changed and stays disabled until resolved', async () => {
        const refreshed = detail({
            presentation: { ...detail().presentation, sellingPriceMinor: 40000 },
            versions: { inventoryVersion: 4, publicationIntentVersion: 2 },
        });
        refetch.mockResolvedValue({ data: refreshed, error: null });
        managementMutate.mockRejectedValueOnce(conflictError());
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-price-minor'), '99900');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(
            screen.getByTestId('store-view-edit-conflict-sellingPriceMinor'),
        ).toBeTruthy());
        expect(screen.getByText('Changed by someone else to 40000')).toBeTruthy();
        expect(screen.getByTestId('store-view-save-changes').props.accessibilityState.disabled).toBe(true);
        fireEvent.press(screen.getByTestId('store-view-edit-keep-mine-sellingPriceMinor'));
        expect(screen.queryByTestId('store-view-edit-conflict-sellingPriceMinor')).toBeNull();
        expect(screen.getByDisplayValue('99900')).toBeTruthy();
        managementMutate.mockResolvedValueOnce({ outcome: 'details_updated' });
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(2));
        expect(managementMutate).toHaveBeenLastCalledWith({
            kind: 'save', inventoryId, inventoryVersion: 4, changes: { sellingPriceMinor: 99900 },
        });
    });

    it('resolves a both-changed price with the remote value', async () => {
        const refreshed = detail({
            presentation: { ...detail().presentation, sellingPriceMinor: 40000 },
            versions: { inventoryVersion: 4, publicationIntentVersion: 2 },
        });
        refetch.mockResolvedValue({ data: refreshed, error: null });
        managementMutate.mockRejectedValueOnce(conflictError());
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-price-minor'), '99900');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(
            screen.getByTestId('store-view-edit-conflict-sellingPriceMinor'),
        ).toBeTruthy());
        fireEvent.press(screen.getByTestId('store-view-edit-use-theirs-sellingPriceMinor'));
        expect(screen.getByDisplayValue('40000')).toBeTruthy();
    });

    it('locks typing during recovery (C1/R5): the pre-recovery draft survives the refresh', async () => {
        let resolveRefresh!: (value: unknown) => void;
        refetch.mockImplementationOnce(
            () => new Promise((resolve) => { resolveRefresh = resolve; }),
        );
        managementMutate.mockRejectedValueOnce(conflictError());
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'First');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(1));
        // R5: inputs are non-editable while recovering, so a keystroke typed
        // now cannot apply — and the recovery must keep the pre-recovery
        // draft instead of wiping it (R4).
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'First plus more');
        const refreshed = detail({
            presentation: { ...detail().presentation, sellingPriceMinor: 40000 },
            versions: { inventoryVersion: 4, publicationIntentVersion: 2 },
        });
        resolveRefresh({ data: refreshed, error: null });
        await waitFor(() => expect(screen.getByText(/kept — check them and save again/i)).toBeTruthy());
        expect(screen.getByDisplayValue('First')).toBeTruthy();
        expect(screen.getByDisplayValue('40000')).toBeTruthy();
    });

    it('routes access loss during the recovery refresh to onAccessLost (C2)', async () => {
        managementMutate.mockRejectedValueOnce(conflictError());
        refetch.mockRejectedValueOnce(new StoreViewManagementClientError(
            'P9_OWNER_NOT_AUTHORIZED', false, 'Store View management is unavailable.', 403,
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
        expect(screen.queryByText("Couldn't load the latest version. Try again.")).toBeNull();
    });

    it('routes an identity change while open to onAccessLost (C4)', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        expect(screen.getByTestId('store-view-save-changes')).toBeTruthy();
        screen.rerender(
            <StoreViewDetailContent identity={{ userId: 'owner-b', storeId: 'store-b' }} inventoryId={inventoryId} />,
        );
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
    });

    it('retry remembers a no-changes recovery and blocks save while recovering (C7/C9)', async () => {
        managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError(
            'P9_NO_CHANGES', false, 'There are no changes to save.',
        ));
        refetch.mockRejectedValueOnce(new Error('network down'));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(
            screen.getByText("Couldn't load the latest version. Try again."),
        ).toBeTruthy());
        const refetchCalls = refetch.mock.calls.length;
        let resolveRefresh!: (value: unknown) => void;
        refetch.mockImplementationOnce(
            () => new Promise((resolve) => { resolveRefresh = resolve; }),
        );
        fireEvent.press(screen.getByTestId('store-view-edit-retry-refresh'));
        await waitFor(() => expect(refetch.mock.calls.length).toBe(refetchCalls + 1));
        // Save stays a no-op while the retry recovery is in flight (C7).
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        expect(managementMutate).toHaveBeenCalledTimes(1);
        resolveRefresh({
            data: detail({
                presentation: { ...detail().presentation, title: 'Remote title' },
                versions: { inventoryVersion: 4, publicationIntentVersion: 2 },
            }),
            error: null,
        });
        await waitFor(() => expect(screen.getByText('Nothing was saved. Try again.')).toBeTruthy());
        expect(screen.getByDisplayValue('My title')).toBeTruthy();
    });

    it('sends only one save when Save is pressed twice in the same tick (C7)', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        // Both presses inside one act: state locks haven't flushed, so only
        // the ref lock can stop the second run.
        act(() => {
            fireEvent.press(screen.getByTestId('store-view-save-changes'));
            fireEvent.press(screen.getByTestId('store-view-save-changes'));
        });
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(1));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(managementMutate).toHaveBeenCalledTimes(1);
    });

    it('marks the damage group when the remote side changed any member', async () => {
        const damaged = detail({
            presentation: {
                ...detail().presentation, hasDamage: true,
                damageTypes: ['cover'], damageNote: 'Scuffed',
            },
        });
        setDetail(damaged);
        const refreshed = detail({
            presentation: {
                ...damaged.presentation, damageTypes: ['cover', 'pages'],
            },
            versions: { inventoryVersion: 4, publicationIntentVersion: 2 },
        });
        refetch.mockResolvedValue({ data: refreshed, error: null });
        managementMutate.mockRejectedValueOnce(conflictError());
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-damage-note'), 'Scuffed badly');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByTestId('store-view-edit-conflict-damage')).toBeTruthy());
        // Each changed damage-group member shows the refreshed remote value (C10).
        expect(screen.getByText('Changed by someone else to cover, pages')).toBeTruthy();
        fireEvent.press(screen.getByTestId('store-view-edit-use-theirs-damage'));
        expect(screen.getByDisplayValue('Scuffed')).toBeTruthy();
    });

    it('rebases twice in a row and keeps the owner edits', async () => {
        const first = detail({
            presentation: { ...detail().presentation, sellingPriceMinor: 40000 },
            versions: { inventoryVersion: 4, publicationIntentVersion: 2 },
        });
        const second = detail({
            privateOperations: { shelfLocation: 'B7', internalNotes: 'Owner note' },
            versions: { inventoryVersion: 5, publicationIntentVersion: 2 },
        });
        refetch.mockResolvedValueOnce({ data: first, error: null })
            .mockResolvedValueOnce({ data: second, error: null });
        managementMutate.mockRejectedValueOnce(conflictError());
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByDisplayValue('40000')).toBeTruthy());
        managementMutate.mockRejectedValueOnce(conflictError());
        managementMutate.mockResolvedValueOnce({ outcome: 'details_updated' });
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(2));
        expect(screen.getByDisplayValue('My title')).toBeTruthy();
        await waitFor(() => expect(screen.getByDisplayValue('B7')).toBeTruthy());
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(3));
        expect(managementMutate).toHaveBeenLastCalledWith({
            kind: 'save', inventoryId, inventoryVersion: 5, changes: { title: 'My title' },
        });
    });

    it('closes with an already-saved message when the refresh matches every edit', async () => {
        const refreshed = detail({
            presentation: { ...detail().presentation, title: 'Same new title' },
            versions: { inventoryVersion: 4, publicationIntentVersion: 2 },
        });
        refetch.mockResolvedValue({ data: refreshed, error: null });
        managementMutate.mockRejectedValueOnce(conflictError());
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'Same new title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByText('These changes are already saved.')).toBeTruthy());
        expect(screen.queryByDisplayValue('Same new title')).toBeNull();
    });

    it('keeps the draft and disables save when the refresh fails temporarily', async () => {
        refetch.mockRejectedValueOnce(new Error('network down'));
        managementMutate.mockRejectedValueOnce(conflictError());
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(
            screen.getByText("Couldn't load the latest version. Try again."),
        ).toBeTruthy());
        expect(screen.getByDisplayValue('My title')).toBeTruthy();
        expect(screen.getByTestId('store-view-save-changes').props.accessibilityState.disabled).toBe(true);
        refetch.mockResolvedValueOnce({ data: detail(), error: null });
        fireEvent.press(screen.getByTestId('store-view-edit-retry-refresh'));
        await waitFor(() => expect(
            screen.queryByText("Couldn't load the latest version. Try again."),
        ).toBeNull());
        expect(screen.getByDisplayValue('My title')).toBeTruthy();
    });

    it('shows the offline message and accepts the refresh when back online', async () => {
        (onlineManager.isOnline as jest.Mock).mockReturnValue(false);
        managementMutate.mockRejectedValueOnce(conflictError());
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(
            screen.getByText("You're offline. Your edits are kept."),
        ).toBeTruthy());
        expect(screen.getByDisplayValue('My title')).toBeTruthy();
        (onlineManager.isOnline as jest.Mock).mockReturnValue(true);
        refetch.mockResolvedValueOnce({ data: detail(), error: null });
        fireEvent.press(screen.getByTestId('store-view-edit-retry-refresh'));
        await waitFor(() => expect(
            screen.queryByText("You're offline. Your edits are kept."),
        ).toBeNull());
    });

    it('closes the modal and removes cached private data on access lost', async () => {
        const client = new QueryClient();
        const bookDetail = detail();
        client.setQueryData(storeViewKeys.detail(identity, inventoryId), bookDetail);
        client.setQueryData(storeViewMediaKeys.detail(identity, inventoryId), { media: [] });
        client.setQueryData(storeViewHistoryKeys.detail(identity, inventoryId), { history: [] });
        client.setQueryData(storeViewKeys.page(identity, 'all'), { items: [] });
        managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError(
            'P9_OWNER_NOT_AUTHORIZED', false, 'Store View management is unavailable.',
        ));
        const ui: ReactElement = (
            <QueryClientProvider client={client}>
                <StoreViewDetailContent identity={identity} inventoryId={inventoryId} />
            </QueryClientProvider>
        );
        const screen = render(ui);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
        expect(client.getQueryState(storeViewKeys.detail(identity, inventoryId))).toBeUndefined();
        expect(client.getQueryState(storeViewMediaKeys.detail(identity, inventoryId))).toBeUndefined();
        expect(client.getQueryState(storeViewHistoryKeys.detail(identity, inventoryId))).toBeUndefined();
        expect(client.getQueryState(storeViewKeys.page(identity, 'all'))).toBeDefined();
        client.clear();
    });

    it('treats HTTP 403 without an app error body as access lost', async () => {
        managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError(
            'P9_INTERNAL_ERROR', true, 'The command could not be completed.', 403,
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
        expect(screen.queryByDisplayValue('My title')).toBeNull();
    });

    it('closes with already-saved when the server reports no changes that match', async () => {
        managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError(
            'P9_NO_CHANGES', false, 'There are no changes to save.',
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-internal-notes'), 'Same note');
        setDetail(detail({
            privateOperations: { shelfLocation: 'A3', internalNotes: 'Same note' },
        }));
        refetch.mockResolvedValueOnce({
            data: detail({
                privateOperations: { shelfLocation: 'A3', internalNotes: 'Same note' },
            }),
            error: null,
        });
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByText('These changes are already saved.')).toBeTruthy());
    });

    it('keeps the draft when the server reports no changes that do not match', async () => {
        managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError(
            'P9_NO_CHANGES', false, 'There are no changes to save.',
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        refetch.mockResolvedValueOnce({
            data: detail({
                presentation: { ...detail().presentation, title: 'Remote title' },
                versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
            }),
            error: null,
        });
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByText('Nothing was saved. Try again.')).toBeTruthy());
        expect(screen.getByDisplayValue('My title')).toBeTruthy();
    });
});
