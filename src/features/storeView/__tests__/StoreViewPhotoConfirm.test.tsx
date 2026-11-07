import { act, fireEvent, render, waitFor as waitForBase } from '@testing-library/react-native';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { confirmPhotoBook, PhotoConfirmError } from '../state/storeViewPhotoConfirmation';
import { usePublicationCommands } from '@/features/imageInventory/queries/publicationQueries';
import { publicationService } from '@/features/imageInventory/api/publicationService';
import { StoreViewMediaClientError } from '../api/storeViewMediaService';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';
import { useStoreViewMediaCommands } from '../queries/storeViewMediaCommands';
import { useStoreViewDetail } from '../queries/storeViewQueries';
import { useStoreViewMedia } from '../queries/storeViewMediaQueries';
import { StoreViewDetailContent } from '../screens/StoreViewDetailScreen';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/features/imageInventory/api/publicationService', () => {
    const actual = jest.requireActual('@/features/imageInventory/api/publicationService') as {
        publicationService: Record<string, unknown>;
    };
    return {
        ...actual,
        publicationService: { ...actual.publicationService, submitPublicCopyMedia: jest.fn() },
    };
});
jest.mock('@/features/imageInventory/queries/publicationQueries', () => ({ usePublicationCommands: jest.fn() }));
jest.mock('../queries/storeViewManagementQueries', () => ({ useStoreViewManagementCommands: jest.fn() }));
jest.mock('../queries/storeViewQueries', () => {
    const actual = jest.requireActual('../queries/storeViewQueries');
    return { ...actual, useStoreViewDetail: jest.fn() };
});
jest.mock('../queries/storeViewMediaCommands', () => ({ useStoreViewMediaCommands: jest.fn() }));
jest.mock('../queries/storeViewMediaQueries', () => {
    const actual = jest.requireActual('../queries/storeViewMediaQueries');
    return {
        ...actual,
        useStoreViewMedia: jest.fn(),
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

function waitFor(expectation: () => void) {
    return waitForBase(expectation, { timeout: 8000 });
}

// Tests chain several 8s waits; the 5s Jest default cut them off under load.
jest.setTimeout(30000);

const identity = { userId: 'owner-a', storeId: 'store-a' };
const inventoryId = '00000000-0000-4000-8000-000000000001';
const linkA = '00000000-0000-4000-8000-000000000011';
const linkB = '00000000-0000-4000-8000-000000000012';
const capabilityA = '00000000-0000-4000-8000-000000000021';
const assetA = '00000000-0000-4000-8000-000000000031';

const detailRefetch = jest.fn();
const mediaRefetch = jest.fn();
const managementMutate = jest.fn();
const mediaMutate = jest.fn();

function book(version: number) {
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
        capabilities: ['edit_details', 'manage_photos'],
        versions: { inventoryVersion: version, publicationIntentVersion: 2 },
        mediaSummary: { approvedCount: 2 }, publicState: null,
        privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner note' },
        stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
        historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
    } as any;
}

function photo(linkId: string, order: number, url = 'https://example.com/photo.jpg') {
    return {
        linkId,
        mediaAssetId: '00000000-0000-4000-8000-000000000041',
        role: 'actual_copy', publicOrder: order, approvalStatus: 'approved',
        approvedAt: '2026-01-01T00:00:00.000Z', url, width: 100, height: 100,
    };
}

function mediaData(pending: unknown[] = []) {
    return {
        inventoryId,
        media: [photo(linkA, 1), photo(linkB, 2)],
        pendingReplacements: pending,
    };
}

function openPhotos(screen: ReturnType<typeof render>) {
    fireEvent.press(screen.getByTestId('store-view-manage-photos'));
}

function removeEnabled(screen: ReturnType<typeof render>, index: number): boolean {
    return screen.getByTestId(`store-view-media-remove-${index}`).props.accessibilityState?.disabled !== true;
}

describe('Slice 0a §3.3 photo modal confirmed state', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
        (useStoreViewDetail as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: book(3), refetch: detailRefetch,
        });
        detailRefetch.mockResolvedValue({ data: book(3), error: null });
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: mediaData(), refetch: mediaRefetch,
        });
        mediaRefetch.mockResolvedValue({ data: mediaData(), error: null });
        (useStoreViewManagementCommands as jest.Mock).mockReturnValue({
            mutateAsync: managementMutate, isPending: false,
        });
        (useStoreViewMediaCommands as jest.Mock).mockReturnValue({
            mutateAsync: mediaMutate, isPending: false,
        });
        (usePublicationCommands as jest.Mock).mockReturnValue({
            mutateAsync: jest.fn().mockResolvedValue({}), isPending: false,
        });
        mediaMutate.mockResolvedValue({
            inventoryVersion: 4, publicationIntentVersion: 2,
            publicRevisionNumber: null, removedMediaAssetId: assetA, outcome: 'media_removed',
        });
        (publicationService.submitPublicCopyMedia as jest.Mock).mockResolvedValue({
            mediaLinkId: linkB,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('sends the second remove with the version from the first result', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
        fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledTimes(1));
        expect(mediaMutate).toHaveBeenLastCalledWith({
            kind: 'remove', inventoryId, inventoryVersion: 3, linkId: linkA,
        });
        await waitFor(() => expect(removeEnabled(screen, 1)).toBe(true));
        mediaMutate.mockResolvedValueOnce({
            inventoryVersion: 5, publicationIntentVersion: 2,
            publicRevisionNumber: null, removedMediaAssetId: assetA, outcome: 'media_removed',
        });
        fireEvent.press(screen.getByTestId('store-view-media-remove-1'));
        fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledTimes(2));
        expect(mediaMutate).toHaveBeenLastCalledWith({
            kind: 'remove', inventoryId, inventoryVersion: 4, linkId: linkB,
        });
    });

    it('waits for a fresh confirm after an add before removing', async () => {
        const pending = [{
            capabilityId: capabilityA, role: 'damage', order: 3, state: 'approved',
            operationKind: 'add', targetLinkId: null,
            sourceMediaAssetId: assetA, mediaAssetId: assetA, safeErrorCode: null,
        }];
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: mediaData(pending), refetch: mediaRefetch,
        });
        detailRefetch.mockResolvedValue({ data: book(3), error: null });
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        // The re-confirm after the add reads the next detail refetch.
        detailRefetch.mockResolvedValueOnce({ data: book(5), error: null });
        fireEvent.press(screen.getByTestId(`store-view-media-install-${capabilityA}`));
        await waitFor(() => expect(publicationService.submitPublicCopyMedia).toHaveBeenCalled());
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
        fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledTimes(1));
        // The add carries no version, so the modal confirmed again and the
        // remove sends the refreshed version.
        expect(mediaMutate).toHaveBeenLastCalledWith({
            kind: 'remove', inventoryId, inventoryVersion: 5, linkId: linkA,
        });
    });

    it('disables the buttons after a conflict until the confirm succeeds', async () => {
        mediaMutate.mockRejectedValueOnce(new StoreViewMediaClientError(
            'P9_VERSION_CONFLICT', false, 'This book changed.',
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        detailRefetch.mockResolvedValue({ data: book(4), error: null });
        mediaMutate.mockResolvedValueOnce({
            inventoryVersion: 5, publicationIntentVersion: 2,
            publicRevisionNumber: null, removedMediaAssetId: assetA, outcome: 'media_removed',
        });
        fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
        fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
        fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledTimes(2));
        expect(mediaMutate).toHaveBeenLastCalledWith({
            kind: 'remove', inventoryId, inventoryVersion: 4, linkId: linkA,
        });
    });

    it('keeps the buttons disabled when the refresh fails, including after reopen', async () => {
        detailRefetch.mockRejectedValueOnce(new Error('network down'));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(screen.getByTestId('store-view-media-refresh-error')).toBeTruthy());
        // R3: nothing is confirmed, so no photo rows (and no actions) are shown.
        expect(screen.queryByTestId('store-view-media-remove-0')).toBeNull();
        fireEvent.press(screen.getByTestId('close-store-view-manage-photos'));
        detailRefetch.mockRejectedValueOnce(new Error('still down'));
        openPhotos(screen);
        await waitFor(() => expect(screen.getByTestId('store-view-media-refresh-error')).toBeTruthy());
        expect(screen.queryByTestId('store-view-media-remove-0')).toBeNull();
    });

    it('shows the refreshed image before remove is possible after reopen', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        fireEvent.press(screen.getByTestId('close-store-view-manage-photos'));
        const updated = mediaData();
        updated.media[0] = photo(linkA, 1, 'https://example.com/photo-new.jpg');
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: updated, refetch: mediaRefetch,
        });
        mediaRefetch.mockResolvedValue({ data: updated, error: null });
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        expect(mediaRefetch).toHaveBeenCalled();
        const images = screen.getAllByLabelText('Actual copy photo 1');
        expect(images.some((image) => image.props.source?.uri === 'https://example.com/photo-new.jpg')).toBe(true);
    });

    it('shows the offline message on open and recovers with retry', async () => {
        (onlineManager.isOnline as jest.Mock).mockReturnValue(false);
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(screen.getByText("You're offline. The photo buttons are disabled.")).toBeTruthy());
        // R3: nothing is confirmed, so no photo rows (and no actions) are shown.
        expect(screen.queryByTestId('store-view-media-remove-0')).toBeNull();
        (onlineManager.isOnline as jest.Mock).mockReturnValue(true);
        fireEvent.press(screen.getByTestId('store-view-media-retry'));
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
    });

    it('closes the modal and removes cached private data on access lost', async () => {
        mediaMutate.mockRejectedValueOnce(new StoreViewMediaClientError(
            'P9_OWNER_NOT_AUTHORIZED', false, 'Manage Photos is unavailable.',
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
        fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
    });

    it('re-confirms on every opening: refetch counts grow and remove sends the new version (C13b)', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        const detailCalls = detailRefetch.mock.calls.length;
        const mediaCalls = mediaRefetch.mock.calls.length;
        expect(detailCalls).toBeGreaterThan(0);
        fireEvent.press(screen.getByTestId('close-store-view-manage-photos'));
        detailRefetch.mockResolvedValue({ data: book(7), error: null });
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        expect(detailRefetch.mock.calls.length).toBeGreaterThan(detailCalls);
        expect(mediaRefetch.mock.calls.length).toBeGreaterThan(mediaCalls);
        fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
        fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledTimes(1));
        expect(mediaMutate).toHaveBeenLastCalledWith({
            kind: 'remove', inventoryId, inventoryVersion: 7, linkId: linkA,
        });
    });

    it('ignores a slow first-opening confirm that lands after reopen (C5)', async () => {
        let resolveFirst!: (value: unknown) => void;
        detailRefetch.mockImplementationOnce(
            () => new Promise((resolve) => { resolveFirst = resolve; }),
        );
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(detailRefetch).toHaveBeenCalledTimes(1));
        // R3: while confirming, no photo rows (and no actions) are shown.
        expect(screen.getByTestId('store-view-media-loading')).toBeTruthy();
        expect(screen.queryByTestId('store-view-media-remove-0')).toBeNull();
        fireEvent.press(screen.getByTestId('close-store-view-manage-photos'));
        detailRefetch.mockResolvedValue({ data: book(9), error: null });
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        resolveFirst({ data: book(3), error: null });
        await waitFor(() => expect(mediaMutate).not.toHaveBeenCalled());
        fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
        fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledTimes(1));
        expect(mediaMutate).toHaveBeenLastCalledWith({
            kind: 'remove', inventoryId, inventoryVersion: 9, linkId: linkA,
        });
    });

    it('routes access loss during the confirm refresh to onAccessLost (C2)', async () => {
        detailRefetch.mockRejectedValueOnce(new StoreViewMediaClientError(
            'P9_OWNER_NOT_AUTHORIZED', false, 'Manage Photos is unavailable.', 403,
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
        expect(screen.queryByTestId('store-view-media-retry')).toBeNull();
    });

    it('routes an identity change while open to onAccessLost (C4)', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        screen.rerender(
            <StoreViewDetailContent identity={{ userId: 'owner-b', storeId: 'store-b' }} inventoryId={inventoryId} />,
        );
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
    });

    it('routes a PublicationClientError add failure to onAccessLost (C3)', async () => {
        const { PublicationClientError } = jest.requireMock(
            '@/features/imageInventory/api/publicationService',
        ) as { PublicationClientError: new (code: string, retryable: boolean, message: string) => Error };
        const pending = [{
            capabilityId: capabilityA, role: 'damage', order: 3, state: 'approved',
            operationKind: 'add', targetLinkId: null,
            sourceMediaAssetId: assetA, mediaAssetId: assetA, safeErrorCode: null,
        }];
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: mediaData(pending), refetch: mediaRefetch,
        });
        (publicationService.submitPublicCopyMedia as jest.Mock).mockRejectedValueOnce(
            new PublicationClientError('P9_OWNER_NOT_AUTHORIZED', false, 'Manage Photos is unavailable.'),
        );
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        fireEvent.press(screen.getByTestId(`store-view-media-install-${capabilityA}`));
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
    });

    it('routes a bodyless 403 PublicationClientError add failure to onAccessLost (R8)', async () => {
        const { PublicationClientError } = jest.requireMock(
            '@/features/imageInventory/api/publicationService',
        ) as { PublicationClientError: new (code: string, retryable: boolean, message: string, httpStatus?: number | null) => Error };
        const pending = [{
            capabilityId: capabilityA, role: 'damage', order: 3, state: 'approved',
            operationKind: 'add', targetLinkId: null,
            sourceMediaAssetId: assetA, mediaAssetId: assetA, safeErrorCode: null,
        }];
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: mediaData(pending), refetch: mediaRefetch,
        });
        (publicationService.submitPublicCopyMedia as jest.Mock).mockRejectedValueOnce(
            new PublicationClientError('P9_RESPONSE_INVALID', false, 'Publication response was invalid.', 403),
        );
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        fireEvent.press(screen.getByTestId(`store-view-media-install-${capabilityA}`));
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
    });

    it('shows a message when an install fails and re-confirms without rejecting (C6)', async () => {
        const pending = [{
            capabilityId: capabilityA, role: 'damage', order: 3, state: 'approved',
            operationKind: 'add', targetLinkId: null,
            sourceMediaAssetId: assetA, mediaAssetId: assetA, safeErrorCode: null,
        }];
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: mediaData(pending), refetch: mediaRefetch,
        });
        (publicationService.submitPublicCopyMedia as jest.Mock).mockRejectedValueOnce(new Error('upload exploded'));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        fireEvent.press(screen.getByTestId(`store-view-media-install-${capabilityA}`));
        await waitFor(() => expect(screen.getByText('upload exploded')).toBeTruthy());
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
    });

    it('shows no success message when the follow-up media refetch fails (C8)', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        mediaRefetch.mockResolvedValueOnce({ error: new Error('media down'), data: null });
        fireEvent.press(screen.getByTestId('store-view-media-down-0'));
        await waitFor(() => expect(screen.getByTestId('store-view-media-retry')).toBeTruthy());
        expect(screen.queryByText('Photo order updated.')).toBeNull();
    });

    it('sends only one command when a photo button is pressed twice in the same tick (C7)', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        // Both presses inside one act: state locks haven't flushed, so only
        // the ref lock can stop the second run.
        act(() => {
            fireEvent.press(screen.getByTestId('store-view-media-down-0'));
            fireEvent.press(screen.getByTestId('store-view-media-down-0'));
        });
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledTimes(1));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(mediaMutate).toHaveBeenCalledTimes(1);
    });

    it('invalidates identity-scoped families after a photo add with a real QueryClient (C13a)', async () => {
        const { storeViewKeys } = jest.requireActual('../queries/storeViewQueries') as typeof import('../queries/storeViewQueries');
        const { storeViewHistoryKeys } = jest.requireActual('../queries/storeViewHistoryQueries') as typeof import('../queries/storeViewHistoryQueries');
        const { storeViewMediaKeys } = jest.requireActual('../queries/storeViewMediaQueries') as typeof import('../queries/storeViewMediaQueries');
        const { ownerInventoryReadKeys } = jest.requireActual(
            '@/features/imageInventory/queries/ownerInventoryReadQueries',
        ) as typeof import('@/features/imageInventory/queries/ownerInventoryReadQueries');
        const { useQuery } = jest.requireActual('@tanstack/react-query') as typeof import('@tanstack/react-query');
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 60_000 } },
        });
        const fetches = new Map<string, jest.Mock>();
        const seedKeys = [
            storeViewKeys.page(identity, 'all'),
            storeViewKeys.detail(identity, inventoryId),
            storeViewMediaKeys.detail(identity, inventoryId),
            storeViewHistoryKeys.detail(identity, inventoryId),
            ownerInventoryReadKeys.list(identity, {}),
        ];
        for (const key of seedKeys) fetches.set(JSON.stringify(key), jest.fn(async () => ({ ok: true })));
        function Seeds() {
            for (const key of seedKeys) {
                // eslint-disable-next-line react-hooks/rules-of-hooks
                useQuery({ queryKey: key, queryFn: fetches.get(JSON.stringify(key))! });
            }
            return null;
        }
        const pending = [{
            capabilityId: capabilityA, role: 'damage', order: 3, state: 'approved',
            operationKind: 'add', targetLinkId: null,
            sourceMediaAssetId: assetA, mediaAssetId: assetA, safeErrorCode: null,
        }];
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: mediaData(pending), refetch: mediaRefetch,
        });
        detailRefetch.mockResolvedValue({ data: book(5), error: null });
        const screen = render(
            <QueryClientProvider client={client}>
                <Seeds />
                <StoreViewDetailContent identity={identity} inventoryId={inventoryId} />
            </QueryClientProvider>,
        );
        for (const key of seedKeys) {
            await waitFor(() => expect(fetches.get(JSON.stringify(key))!.mock.calls.length).toBeGreaterThan(0));
        }
        const before = seedKeys.map((key) => fetches.get(JSON.stringify(key))!.mock.calls.length);
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        fireEvent.press(screen.getByTestId(`store-view-media-install-${capabilityA}`));
        await waitFor(() => expect(publicationService.submitPublicCopyMedia).toHaveBeenCalled());
        for (const [index, key] of seedKeys.entries()) {
            await waitFor(
                () => expect(fetches.get(JSON.stringify(key))!.mock.calls.length).toBeGreaterThan(before[index]),
            );
        }
        client.clear();
    });
});

describe('confirmPhotoBook late version and timers (C11/C14)', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('accepts a late detail version after a timed-out confirm via onLateVersion', async () => {
        jest.useFakeTimers();
        let resolveDetail!: (version: number) => void;
        const refreshDetail = jest.fn(() => new Promise<number>((resolve) => { resolveDetail = resolve; }));
        const refreshMedia = jest.fn(async () => undefined);
        const onLateVersion = jest.fn();
        const pending = confirmPhotoBook({
            isOnline: true, refreshDetail, refreshMedia, timeoutMs: 1000, onLateVersion,
        });
        const rejection = expect(pending).rejects.toBeInstanceOf(PhotoConfirmError);
        await jest.advanceTimersByTimeAsync(1000);
        await rejection;
        resolveDetail(7);
        for (let index = 0; index < 10; index += 1) {
            // eslint-disable-next-line no-await-in-loop
            await Promise.resolve();
        }
        expect(onLateVersion).toHaveBeenCalledWith(7);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('carries the detail failure code through the timed-out path', async () => {
        const pending = confirmPhotoBook({
            isOnline: true,
            refreshDetail: async () => {
                throw new PhotoConfirmError(false, 'book refresh failed', 'P9_NOT_FOUND', 404);
            },
            refreshMedia: async () => undefined,
            timeoutMs: 1000,
        });
        await expect(pending).rejects.toMatchObject({ code: 'P9_NOT_FOUND', httpStatus: 404 });
    });

    it('clears the timer once the confirm settles', async () => {
        jest.useFakeTimers();
        try {
            const version = await confirmPhotoBook({
                isOnline: true, refreshDetail: async () => 5, refreshMedia: async () => undefined,
            });
            expect(version).toBe(5);
            expect(jest.getTimerCount()).toBe(0);
        } finally {
            jest.useRealTimers();
        }
    });
});
