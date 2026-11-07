import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { usePublicationCommands } from '@/features/imageInventory/queries/publicationQueries';
import { StoreViewManagementClientError } from '../api/storeViewManagementService';
import { filterStoreViewActivity } from '../components/StoreViewHistorySection';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';
import { useStoreViewDetail } from '../queries/storeViewQueries';
import { useStoreViewMediaCommands } from '../queries/storeViewMediaCommands';
import { useStoreViewMedia } from '../queries/storeViewMediaQueries';
import { useStoreViewHistory } from '../queries/storeViewHistoryQueries';
import { StoreViewDetailContent } from '../screens/StoreViewDetailScreen';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-image-picker', () => ({
    getMediaLibraryPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@/features/imageInventory/queries/publicationQueries', () => ({ usePublicationCommands: jest.fn() }));
jest.mock('../queries/storeViewManagementQueries', () => ({ useStoreViewManagementCommands: jest.fn() }));
jest.mock('../queries/storeViewQueries', () => ({ useStoreViewDetail: jest.fn() }));
jest.mock('../queries/storeViewMediaCommands', () => ({ useStoreViewMediaCommands: jest.fn() }));
jest.mock('../queries/storeViewMediaQueries', () => ({ useStoreViewMedia: jest.fn() }));
jest.mock('../queries/storeViewHistoryQueries', () => ({ useStoreViewHistory: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb', bgCard: '#fff', bgSecondary: '#eee', border: '#ddd',
        error: '#b91c1c', success: '#15803d', textPrimary: '#111',
        textSecondary: '#555', textTertiary: '#777', bgPrimary: '#fafafa',
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
const linkA = '00000000-0000-4000-8000-000000000011';
const linkB = '00000000-0000-4000-8000-000000000012';
const assetId = '00000000-0000-4000-8000-000000000013';
const capabilityA = '00000000-0000-4000-8000-000000000021';
const commandA = '11111111-1111-4111-8111-111111111111';
const commandB = '22222222-2222-4222-8222-222222222222';
const createdAt = '2026-08-15T04:00:00.000+05:30';
const refetch = jest.fn().mockResolvedValue({ data: null, error: null });
const mediaRefetch = jest.fn().mockResolvedValue({ data: null, error: null });
const managementMutate = jest.fn();
const publicationMutate = jest.fn();
const mediaMutate = jest.fn();

function detail(overrides: Record<string, unknown> = {}) {
    return {
        identity: { inventoryId },
        presentation: {
            title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
            publicDescription: 'Public copy.', condition: 'good', publicConditionNote: null,
            hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
            sellingPriceMinor: 35000,
        },
        stockSummary: { quantityAvailable: 1, stockState: 'low_stock' },
        lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
        attention: { attentionState: 'none', attentionReasons: [] },
        capabilities: ['edit_details', 'adjust_stock', 'manage_photos', 'pause', 'make_private'],
        versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
        mediaSummary: { approvedCount: 2 }, publicState: null,
        privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner note' },
        stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
        historySummary: { publicRevisionCount: 2, latestPublicRevision: null },
        ...overrides,
    } as any;
}

function mediaData(overrides: Record<string, unknown> = {}) {
    return {
        inventoryId,
        media: [
            {
                linkId: linkA, mediaAssetId: assetId, role: 'primary_fallback', publicOrder: 1,
                approvalStatus: 'approved', approvedAt: createdAt,
                url: '/storage/v1/object/public/inventory-photos/primary.webp',
                width: 1200, height: 900,
            },
            {
                linkId: linkB, mediaAssetId: assetId, role: 'actual_copy', publicOrder: 2,
                approvalStatus: 'approved', approvedAt: createdAt,
                url: '/storage/v1/object/public/inventory-photos/copy.webp',
                width: 1200, height: 900,
            },
        ],
        pendingReplacements: [],
        ...overrides,
    } as any;
}

function pendingEntry(overrides: Record<string, unknown> = {}) {
    return {
        capabilityId: capabilityA, role: 'actual_copy', order: 3, state: 'processing',
        operationKind: 'add', targetLinkId: null,
        sourceMediaAssetId: assetId, mediaAssetId: null, safeErrorCode: null,
        ...overrides,
    };
}

function auditEntry(action: string, commandId?: string) {
    return {
        kind: 'audit', action, createdAt,
        details: commandId ? { commandId } : {},
    } as any;
}

function eventEntry(eventType: string, commandId?: string) {
    return {
        kind: 'event', eventType, source: 'worker', severity: 'info', createdAt,
        payload: commandId ? { commandId } : {},
    } as any;
}

function retryEntry() {
    return {
        kind: 'publication_retry', status: 'open', attemptCount: 0, maxAttempts: 5,
        safeErrorCode: null, createdAt, updatedAt: createdAt, completedAt: null,
    } as any;
}

function setHistory(activity: unknown[]) {
    (useStoreViewHistory as jest.Mock).mockReturnValue({
        isPending: false, isError: false,
        data: {
            inventoryId, activity,
            publicRevisions: [{
                revisionNumber: 2, sourceAction: 'media_change', createdAt,
                listingId: null, publicSnapshot: {},
            }],
        },
    });
}

describe('Store View polish: activity dedup', () => {
    it('drops an event whose commandId matches an audit, keeps the rest in order', () => {
        const activity = [
            auditEntry('phase9.inventory.media_reordered', commandA),
            eventEntry('inventory.media.reordered', commandA),
            eventEntry('inventory.publication.failed', commandB),
            eventEntry('inventory.stock.adjusted'),
            retryEntry(),
        ];
        const filtered = filterStoreViewActivity(activity as any);
        expect(filtered).toHaveLength(4);
        expect(filtered[0]).toEqual(activity[0]);
        expect(filtered[1]).toEqual(activity[2]);
        expect(filtered[2]).toEqual(activity[3]);
        expect(filtered[3]).toEqual(activity[4]);
    });

    it('renders one Photos reordered line for an audit+event pair', () => {
        (useStoreViewDetail as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: detail(), refetch,
        });
        (useStoreViewManagementCommands as jest.Mock).mockReturnValue({
            mutateAsync: managementMutate, isPending: false,
        });
        (usePublicationCommands as jest.Mock).mockReturnValue({
            mutateAsync: publicationMutate, isPending: false,
        });
        (useStoreViewMediaCommands as jest.Mock).mockReturnValue({
            mutateAsync: mediaMutate, isPending: false,
        });
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: mediaData(), refetch: mediaRefetch,
        });
        setHistory([
            auditEntry('phase9.inventory.media_reordered', commandA),
            eventEntry('inventory.media.reordered', commandA),
        ]);
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.getAllByText('Photos reordered')).toHaveLength(1);
        expect(screen.getAllByTestId('store-view-activity-entry')).toHaveLength(1);
    });
});

describe('Store View polish: photo modal pending reorder block', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
        (useStoreViewDetail as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: detail(), refetch,
        });
        refetch.mockResolvedValue({ data: detail(), error: null });
        mediaRefetch.mockResolvedValue({ data: mediaData(), error: null });
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: mediaData(), refetch: mediaRefetch,
        });
        (useStoreViewManagementCommands as jest.Mock).mockReturnValue({
            mutateAsync: managementMutate, isPending: false,
        });
        (usePublicationCommands as jest.Mock).mockReturnValue({
            mutateAsync: publicationMutate, isPending: false,
        });
        (useStoreViewMediaCommands as jest.Mock).mockReturnValue({
            mutateAsync: mediaMutate, isPending: false,
        });
        setHistory([]);
        managementMutate.mockResolvedValue({ outcome: 'details_updated' });
        mediaMutate.mockResolvedValue({ outcome: 'media_reordered' });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('disables reorder and shows the blocked message while a photo is processing', async () => {
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false,
            data: mediaData({ pendingReplacements: [pendingEntry({ state: 'processing' })] }),
            refetch: mediaRefetch,
        });
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-manage-photos'));
        await waitFor(() => expect(screen.getByTestId('store-view-media-reorder-blocked')).toBeTruthy());
        expect(screen.getByTestId('store-view-media-reorder-blocked')).toHaveTextContent(
            'Finish the pending photo before changing the order.',
        );
        expect(screen.getByTestId('store-view-media-up-1')).toBeDisabled();
        expect(screen.getByTestId('store-view-media-down-0')).toBeDisabled();
        expect(screen.getByTestId('store-view-media-remove-0')).toBeEnabled();
    });

    it('does not block reorder when the only pending entry failed', async () => {
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false,
            data: mediaData({ pendingReplacements: [pendingEntry({ state: 'failed' })] }),
            refetch: mediaRefetch,
        });
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-manage-photos'));
        await waitFor(() => expect(screen.getByTestId('store-view-media-up-1')).toBeEnabled());
        expect(screen.queryByTestId('store-view-media-reorder-blocked')).toBeNull();
    });

    it('shows the target photo position for a replace pending entry', async () => {
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false,
            data: mediaData({
                pendingReplacements: [pendingEntry({
                    state: 'processing', operationKind: 'replace',
                    targetLinkId: linkB, order: 3,
                })],
            }),
            refetch: mediaRefetch,
        });
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-manage-photos'));
        // The target (linkB) sits at publicOrder 2 while pending.order is 3:
        // the pending row must show Position 2, never Position 3.
        await waitFor(() => expect(screen.getAllByText(/Position 2/)).toHaveLength(2));
        expect(screen.queryByText(/Position 3/)).toBeNull();
    });
});

describe('Store View polish: accessibility labels', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
        (useStoreViewDetail as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: detail(), refetch,
        });
        refetch.mockResolvedValue({ data: detail(), error: null });
        mediaRefetch.mockResolvedValue({ data: mediaData(), error: null });
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: mediaData(), refetch: mediaRefetch,
        });
        (useStoreViewManagementCommands as jest.Mock).mockReturnValue({
            mutateAsync: managementMutate, isPending: false,
        });
        (usePublicationCommands as jest.Mock).mockReturnValue({
            mutateAsync: publicationMutate, isPending: false,
        });
        (useStoreViewMediaCommands as jest.Mock).mockReturnValue({
            mutateAsync: mediaMutate, isPending: false,
        });
        setHistory([]);
        managementMutate.mockResolvedValue({ outcome: 'details_updated' });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('exposes photo move and edit switch labels', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-manage-photos'));
        await waitFor(() => expect(screen.getByLabelText('Move Actual copy photo 2 up')).toBeTruthy());
        expect(screen.getByLabelText('Remove Primary photo photo 1')).toBeTruthy();
        fireEvent.press(screen.getByTestId('close-store-view-manage-photos'));
        fireEvent.press(screen.getByTestId('store-view-edit'));
        expect(screen.getByLabelText('Has damage')).toBeTruthy();
        expect(screen.getByLabelText('Sellable')).toBeTruthy();
        expect(screen.getByLabelText('Cancel')).toBeTruthy();
    });
});

describe('Store View polish: stock invariant from the server', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
        (useStoreViewDetail as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: detail(), refetch,
        });
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: null, refetch: mediaRefetch,
        });
        (useStoreViewManagementCommands as jest.Mock).mockReturnValue({
            mutateAsync: managementMutate, isPending: false,
        });
        (usePublicationCommands as jest.Mock).mockReturnValue({
            mutateAsync: publicationMutate, isPending: false,
        });
        (useStoreViewMediaCommands as jest.Mock).mockReturnValue({
            mutateAsync: mediaMutate, isPending: false,
        });
        setHistory([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('sends a negative change to the server and shows the refreshed message on invariant failure', async () => {
        managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError(
            'P9_QUANTITY_INVARIANT_FAILED', false, 'That stock adjustment is not allowed.',
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-adjust-stock'));
        fireEvent.changeText(screen.getByTestId('store-view-stock-delta'), '-5');
        fireEvent.press(screen.getByTestId('store-view-apply-stock'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledWith({
            kind: 'stock', inventoryId, inventoryVersion: 3, delta: -5,
        }));
        await waitFor(() => expect(screen.getByText(
            'This change would make available stock negative. Latest stock was refreshed; review and try again.',
        )).toBeTruthy());
        expect(refetch).toHaveBeenCalled();
    });
});

describe('Store View polish: edit modal Cancel during save', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
        (useStoreViewDetail as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: detail(), refetch,
        });
        refetch.mockResolvedValue({ data: detail(), error: null });
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false, data: null, refetch: mediaRefetch,
        });
        (useStoreViewManagementCommands as jest.Mock).mockReturnValue({
            mutateAsync: managementMutate, isPending: false,
        });
        (usePublicationCommands as jest.Mock).mockReturnValue({
            mutateAsync: publicationMutate, isPending: false,
        });
        (useStoreViewMediaCommands as jest.Mock).mockReturnValue({
            mutateAsync: mediaMutate, isPending: false,
        });
        setHistory([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('disables Cancel while a save is in flight', async () => {
        managementMutate.mockReturnValueOnce(new Promise(() => undefined));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-edit'));
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'Updated title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByLabelText('Cancel')).toBeDisabled());
    });
});
