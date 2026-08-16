import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { usePublicationCommands } from '@/features/imageInventory/queries/publicationQueries';
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
const createdAt = '2026-08-15T04:00:00.000+05:30';
const refetch = jest.fn().mockResolvedValue(undefined);
const managementMutate = jest.fn();
const publicationMutate = jest.fn();
const mediaMutate = jest.fn();
const mediaRefetch = jest.fn().mockResolvedValue(undefined);

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

function setDetail(data = detail()) {
    (useStoreViewDetail as jest.Mock).mockReturnValue({
        isPending: false, isError: false, data, refetch,
    });
}

describe('Unit 7C WU4 Store View media and history UI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setDetail();
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
        (useStoreViewHistory as jest.Mock).mockReturnValue({
            isPending: false, isError: false,
            data: {
                inventoryId,
                activity: [{
                    kind: 'audit', action: 'phase9.publication.publish', createdAt,
                    details: {},
                }],
                publicRevisions: [{
                    revisionNumber: 2, sourceAction: 'media_change', createdAt,
                    listingId: null, publicSnapshot: {},
                }],
            },
        });
        mediaMutate.mockResolvedValue({ outcome: 'media_reordered' });
    });

    it('gates Manage Photos on the server capability and hides it otherwise', () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.getByTestId('store-view-manage-photos')).toBeTruthy();
        screen.unmount();
        setDetail(detail({ capabilities: ['edit_details'] }));
        const hidden = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(hidden.queryByTestId('store-view-manage-photos')).toBeNull();
    });

    it('renders approved media with role/order and dispatches deterministic reorder', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-manage-photos'));
        expect(screen.getAllByText('Primary photo').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Actual copy').length).toBeGreaterThan(0);
        fireEvent.press(screen.getByTestId('store-view-media-up-1'));
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledWith({
            kind: 'reorder', inventoryId, inventoryVersion: 3,
            orderedLinkIds: [linkB, linkA],
        }));
        expect(mediaRefetch).toHaveBeenCalled();
    });

    it('dispatches version-fenced remove through the controlled command', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-manage-photos'));
        fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
        expect(screen.getByText(/Required damage evidence cannot be removed/)).toBeTruthy();
        fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledWith({
            kind: 'remove', inventoryId, inventoryVersion: 3, linkId: linkA,
        }));
    });

    it('offers Install for an approved server-held replacement and dispatches replace', async () => {
        (useStoreViewMedia as jest.Mock).mockReturnValue({
            isPending: false, isError: false,
            data: mediaData({
                media: [
                    {
                        linkId: linkB, mediaAssetId: assetId, role: 'actual_copy', publicOrder: 1,
                        approvalStatus: 'approved', approvedAt: createdAt,
                        url: '/storage/v1/object/public/inventory-photos/copy.webp',
                        width: 1200, height: 900,
                    },
                    {
                        linkId: linkA, mediaAssetId: assetId, role: 'primary_fallback', publicOrder: 2,
                        approvalStatus: 'approved', approvedAt: createdAt,
                        url: '/storage/v1/object/public/inventory-photos/primary.webp',
                        width: 1200, height: 900,
                    },
                ],
                pendingReplacements: [{
                    capabilityId: '00000000-0000-4000-8000-000000000021',
                    role: 'primary_fallback', order: 1, state: 'approved',
                    operationKind: 'replace', targetLinkId: linkA,
                    sourceMediaAssetId: assetId,
                    mediaAssetId: '00000000-0000-4000-8000-000000000022',
                    safeErrorCode: null,
                }],
            }),
            refetch: mediaRefetch,
        });
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-manage-photos'));
        fireEvent.press(screen.getByTestId('store-view-media-install-00000000-0000-4000-8000-000000000021'));
        await waitFor(() => expect(mediaMutate).toHaveBeenCalledWith({
            kind: 'replace', inventoryId, inventoryVersion: 3,
            capabilityId: '00000000-0000-4000-8000-000000000021',
            mediaAssetId: '00000000-0000-4000-8000-000000000022',
            targetLinkId: linkA,
        }));
    });

    it('surfaces picker rejection, releases busy, and keeps approved media when an upload attempt fails', async () => {
        const picker = require('expo-image-picker');
        picker.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-manage-photos'));
        const addPhoto = screen.getByTestId('store-view-media-add-photo');
        expect(addPhoto).toBeEnabled();
        fireEvent.press(addPhoto);
        await waitFor(() => expect(screen.getByTestId('store-view-media-message')).toHaveTextContent(
            'Media-library permission is required.',
        ));
        expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
        expect(mediaMutate).not.toHaveBeenCalled();
        expect(screen.queryByText('Replacement photo installed.')).toBeNull();
        expect(screen.queryByText('Approved sanitized public-copy photo linked.')).toBeNull();
        expect(screen.getByText('Add approved photo')).toBeTruthy();
        expect(screen.getAllByText('Primary photo').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Actual copy').length).toBeGreaterThan(0);
        fireEvent.press(screen.getByTestId('store-view-media-add-photo'));
        await waitFor(() => expect(picker.getMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(2));
    });

    it('renders activity and public revisions from the authoritative history read with no undo controls', () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.getByText('Public revisions')).toBeTruthy();
        expect(screen.getByText('Revision 2 · Photo change went live')).toBeTruthy();
        expect(screen.getByText('Published')).toBeTruthy();
        expect(screen.getByText(/Activity records what happened/)).toBeTruthy();
        expect(screen.queryByText(/Undo/)).toBeNull();
        expect(screen.queryByText(/Restore/)).toBeNull();
    });
});
