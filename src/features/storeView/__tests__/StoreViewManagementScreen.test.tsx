import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PublicationClientError } from '@/features/imageInventory/api/publicationService';
import { usePublicationCommands } from '@/features/imageInventory/queries/publicationQueries';
import { StoreViewManagementClientError } from '../api/storeViewManagementService';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';
import { useStoreViewDetail } from '../queries/storeViewQueries';
import { StoreViewDetailContent } from '../screens/StoreViewDetailScreen';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/features/imageInventory/queries/publicationQueries', () => ({ usePublicationCommands: jest.fn() }));
jest.mock('../queries/storeViewManagementQueries', () => ({ useStoreViewManagementCommands: jest.fn() }));
jest.mock('../queries/storeViewQueries', () => ({ useStoreViewDetail: jest.fn() }));
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
const refetch = jest.fn().mockResolvedValue(undefined);
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

describe('Unit 7C WU3 Store View management UI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setDetail();
        (useStoreViewManagementCommands as jest.Mock).mockReturnValue({
            mutateAsync: managementMutate, isPending: false,
        });
        (usePublicationCommands as jest.Mock).mockReturnValue({
            mutateAsync: publicationMutate, isPending: false,
        });
        managementMutate.mockResolvedValue({ outcome: 'details_updated' });
        publicationMutate.mockResolvedValue({ outcome: 'paused' });
    });

    it('initializes the focused edit flow, marks Owner-only fields, and sends only changes', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-edit'));
        expect(screen.getByDisplayValue('The Bookshop')).toBeTruthy();
        expect(screen.getAllByText('Shelf / location · Owner only').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Internal notes · Owner only').length).toBeGreaterThan(0);
        fireEvent.changeText(screen.getByTestId('store-view-edit-internal-notes'), 'Updated owner note');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledWith({
            kind: 'save', inventoryId, inventoryVersion: 3,
            changes: { internalNotes: 'Updated owner note' },
        }));
        expect(refetch).toHaveBeenCalled();
        expect(screen.queryByText('Updating live listing')).toBeNull();
        expect(screen.queryByText('Publish Changes')).toBeNull();
    });

    it('preserves the edit form and states transactional truth after a live validation failure', async () => {
        managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError(
            'P9_PUBLICATION_INELIGIBLE', false, 'Invalid live edit.',
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-edit'));
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'Unsaved title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByText("Changes weren't saved. Your live listing is unchanged.")).toBeTruthy());
        expect(screen.getByDisplayValue('Unsaved title')).toBeTruthy();
    });

    it('supports a private item edit and preserves locally invalid input without dispatch', () => {
        setDetail(detail({
            lifecycle: { publicationState: 'private', effectiveState: 'private', visibilityStatus: 'draft' },
            capabilities: ['edit_details'],
        }));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-edit'));
        fireEvent.changeText(screen.getByTestId('store-view-edit-price-minor'), '-1');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        expect(screen.getByText(/whole non-negative price in paise/i)).toBeTruthy();
        expect(screen.getByDisplayValue('-1')).toBeTruthy();
        expect(managementMutate).not.toHaveBeenCalled();
    });

    it('surfaces stale Save, refetches, and does not silently replay', async () => {
        managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError(
            'P9_VERSION_CONFLICT', true, 'This book changed.',
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-edit'));
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'Retry me');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByText(/book changed/i)).toBeTruthy());
        expect(refetch).toHaveBeenCalledTimes(1);
        expect(managementMutate).toHaveBeenCalledTimes(1);
    });

    it('keeps stock separate, shows bucket context, and disables duplicate dispatch', async () => {
        let resolve!: (value: unknown) => void;
        managementMutate.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-adjust-stock'));
        expect(screen.getByText('Reserved 0 · Sold 0 · Removed 0')).toBeTruthy();
        fireEvent.changeText(screen.getByTestId('store-view-stock-delta'), '-1');
        fireEvent.press(screen.getByTestId('store-view-apply-stock'));
        fireEvent.press(screen.getByTestId('store-view-apply-stock'));
        expect(managementMutate).toHaveBeenCalledTimes(1);
        expect(managementMutate).toHaveBeenCalledWith({
            kind: 'stock', inventoryId, inventoryVersion: 3, delta: -1,
        });
        resolve({ outcome: 'stock_adjusted' });
        await waitFor(() => expect(refetch).toHaveBeenCalled());
    });

    it('surfaces a stale stock conflict and requires an explicit second action', async () => {
        managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError(
            'P9_VERSION_CONFLICT', true, 'This book changed.',
        ));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-adjust-stock'));
        fireEvent.changeText(screen.getByTestId('store-view-stock-delta'), '1');
        fireEvent.press(screen.getByTestId('store-view-apply-stock'));
        await waitFor(() => expect(screen.getByText(/latest stock was refreshed/i)).toBeTruthy());
        expect(refetch).toHaveBeenCalledTimes(1);
        expect(managementMutate).toHaveBeenCalledTimes(1);
    });

    it('renders stock transitions only from refreshed server detail', () => {
        setDetail(detail({
            stockSummary: { quantityAvailable: 0, stockState: 'out_of_stock' },
            lifecycle: { publicationState: 'published', effectiveState: 'out_of_stock', visibilityStatus: 'out_of_stock' },
            stock: { quantityTotal: 0, quantityAvailable: 0, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
        }));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.getByText('Out of Stock')).toBeTruthy();
        expect(screen.queryByText('Needs Attention')).toBeNull();
        setDetail(detail());
        screen.rerender(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.getByText('Live')).toBeTruthy();
    });

    it('reuses Unit 7B commands and shows lifecycle actions only from capabilities', async () => {
        setDetail(detail({ capabilities: ['publish', 'retry_publication'] }));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.getByTestId('store-view-publish')).toBeTruthy();
        expect(screen.getByTestId('store-view-retry-publication')).toBeTruthy();
        expect(screen.queryByTestId('store-view-pause')).toBeNull();
        expect(screen.queryByTestId('store-view-make-private')).toBeNull();
        fireEvent.press(screen.getByTestId('store-view-publish'));
        await waitFor(() => expect(publicationMutate).toHaveBeenCalledWith({
            inventoryId, inventoryVersion: 3, publicationIntentVersion: 2, intent: 'publish',
        }));
        expect(refetch).toHaveBeenCalled();
    });

    it.each([
        ['pause', 'store-view-pause', 'pause'],
        ['republish', 'store-view-republish', 'publish'],
        ['make_private', 'store-view-make-private', 'private'],
        ['retry_publication', 'store-view-retry-publication', 'retry'],
    ] as const)('maps %s capability into the existing Unit 7B command', async (capability, testID, intent) => {
        setDetail(detail({ capabilities: [capability] }));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId(testID));
        await waitFor(() => expect(publicationMutate).toHaveBeenCalledWith({
            inventoryId, inventoryVersion: 3, publicationIntentVersion: 2, intent,
        }));
    });

    it('keeps Retry hidden when absent and refetches stale publication state', async () => {
        publicationMutate.mockRejectedValueOnce(new PublicationClientError(
            'P9_VERSION_CONFLICT', true, 'Stale publication command.',
        ));
        setDetail(detail({ capabilities: ['pause'] }));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.queryByTestId('store-view-retry-publication')).toBeNull();
        fireEvent.press(screen.getByTestId('store-view-pause'));
        await waitFor(() => expect(screen.getByText(/book changed/i)).toBeTruthy());
        expect(refetch).toHaveBeenCalledTimes(1);
        expect(publicationMutate).toHaveBeenCalledTimes(1);
    });
});
