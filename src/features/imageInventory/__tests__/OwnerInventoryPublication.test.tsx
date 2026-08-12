import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PublicationClientError } from '../api/publicationService';
import { useOwnerInventoryRead } from '../queries/ownerInventoryReadQueries';
import { usePublicationCommands } from '../queries/publicationQueries';
import { OwnerInventoryReadScreen } from '../screens/OwnerInventoryReadScreen';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../queries/ownerInventoryReadQueries', () => ({ useOwnerInventoryRead: jest.fn() }));
jest.mock('../queries/publicationQueries', () => ({ usePublicationCommands: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    accent: '#2563eb', border: '#d1d5db', textPrimary: '#111827', textSecondary: '#4b5563',
} }) }));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const identity = { userId: 'owner-a', storeId: 'store-a' } as const;
const inventoryId = '10000000-0000-4000-8000-000000000001';
const mutateAsync = jest.fn();

function row(overrides: Record<string, unknown> = {}) {
    return {
        id: inventoryId, title: 'Publication book', authors: ['Author'], isbn10: null,
        isbn13: null, condition: 'good', quantityAvailable: 2, sellingPriceMinor: 500,
        visibilityStatus: 'draft', listingQualityStatus: 'ready', publicNotes: null,
        shelfLocation: null, entryMethod: 'manual', createdAt: '2026-08-12T10:00:00.000Z',
        updatedAt: '2026-08-12T10:00:00.000Z', version: 4,
        publicationStatus: 'private', publicationIntentVersion: 2,
        publicationRetryable: false, publicationFailureReason: null, publicListingStatus: null,
        ...overrides,
    };
}

function readState(item = row()) {
    return {
        items: [item], data: { pages: [] }, error: null, isPending: false,
        isSuccess: true, isError: false, isFetchingNextPage: false,
        isNextPageError: false, isRefreshError: false, hasMore: false,
        loadNextPage: jest.fn(), refresh: jest.fn(), resetPagination: jest.fn(),
    };
}

describe('Unit 7B Owner inventory publication UI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useOwnerInventoryRead as jest.Mock).mockReturnValue(readState());
        (usePublicationCommands as jest.Mock).mockReturnValue({ mutateAsync });
        mutateAsync.mockResolvedValue({ outcome: 'published' });
    });

    it('runs publish, pause, private, and transient retry as non-optimistic row commands', async () => {
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);
        fireEvent.press(screen.getByTestId(`publish-${inventoryId}`));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
            inventoryId, inventoryVersion: 4, publicationIntentVersion: 2, intent: 'publish',
        }));
        screen.unmount();

        (useOwnerInventoryRead as jest.Mock).mockReturnValue(readState(row({
            visibilityStatus: 'published', publicationStatus: 'published',
            publicationIntentVersion: 3, publicListingStatus: 'active',
        })));
        const published = render(<OwnerInventoryReadScreen identity={identity} />);
        fireEvent.press(published.getByTestId(`pause-${inventoryId}`));
        fireEvent.press(published.getByTestId(`private-${inventoryId}`));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ intent: 'pause' })));
        expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ intent: 'private' }));
        published.unmount();

        (useOwnerInventoryRead as jest.Mock).mockReturnValue(readState(row({
            publicationStatus: 'publication_failed', publicationRetryable: true,
            publicationFailureReason: 'projection_temporarily_unavailable',
        })));
        const failed = render(<OwnerInventoryReadScreen identity={identity} />);
        expect(failed.getByTestId(`publication-failed-${inventoryId}`)).toBeTruthy();
        expect(failed.getByTestId(`private-${inventoryId}`)).toBeTruthy();
        fireEvent.press(failed.getByTestId(`private-${inventoryId}`));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
            inventoryId, inventoryVersion: 4, publicationIntentVersion: 2, intent: 'private',
        }));
        fireEvent.press(failed.getByTestId(`retry-publication-${inventoryId}`));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ intent: 'retry' })));
        expect(failed.queryByTestId(`publish-${inventoryId}`)).toBeNull();
    });

    it('shows corrective deterministic failure copy and no transient retry action', async () => {
        mutateAsync.mockRejectedValueOnce(new PublicationClientError(
            'P9_MEDIA_NOT_APPROVED', false, 'Approved damage photos are required.',
        ));
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);
        fireEvent.press(screen.getByTestId(`publish-${inventoryId}`));
        await waitFor(() => expect(screen.getByText('Add approved damage photos before publishing.')).toBeTruthy());
        expect(screen.queryByTestId(`retry-publication-${inventoryId}`)).toBeNull();
    });

    it('supports all publication filters and exposes bounded public-media management', () => {
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);
        for (const status of ['private', 'published', 'paused', 'publication_failed']) {
            fireEvent.press(screen.getByTestId(`publication-filter-${status}`));
            expect(useOwnerInventoryRead).toHaveBeenLastCalledWith(identity, expect.objectContaining({
                publicationStatus: status,
            }));
        }
        fireEvent.press(screen.getByTestId(`manage-public-media-${inventoryId}`));
        expect(screen.getByText('Public-copy photos')).toBeTruthy();
        expect(screen.getByText(/Damage evidence must use the damage role/u)).toBeTruthy();
    });
});
