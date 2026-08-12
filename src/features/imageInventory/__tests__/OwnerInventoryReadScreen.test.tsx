import { fireEvent, render } from '@testing-library/react-native';
import { OwnerInventoryReadError } from '../api/ownerInventoryReadService';
import { useOwnerInventoryRead } from '../queries/ownerInventoryReadQueries';
import { OwnerInventoryReadScreen } from '../screens/OwnerInventoryReadScreen';
import { usePublicationCommands } from '../queries/publicationQueries';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../queries/ownerInventoryReadQueries', () => ({
    useOwnerInventoryRead: jest.fn(),
}));
jest.mock('../queries/publicationQueries', () => ({ usePublicationCommands: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#2563eb',
            bgCard: '#ffffff',
            border: '#d1d5db',
            error: '#b91c1c',
            textPrimary: '#111827',
            textSecondary: '#4b5563',
            textTertiary: '#9ca3af',
        },
    }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const identity = { userId: 'owner-a', storeId: 'store-a' } as const;
const readHook = useOwnerInventoryRead as jest.Mock;
const loadNextPage = jest.fn();
const refresh = jest.fn();
const resetPagination = jest.fn();

const row = {
    id: '10000000-0000-4000-8000-000000000001',
    storeId: '20000000-0000-4000-8000-000000000001',
    title: 'The Bookshop',
    authors: ['Penelope Fitzgerald'],
    isbn10: null,
    isbn13: '9780006543541',
    condition: 'good',
    quantityAvailable: 2,
    sellingPriceMinor: 35000,
    visibilityStatus: 'draft',
    listingQualityStatus: 'ready',
    publicNotes: null,
    shelfLocation: 'A3',
    entryMethod: 'manual',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-03T10:00:00.000Z',
    version: 1,
    publicationStatus: 'private',
    publicationIntentVersion: 1,
    publicationRetryable: false,
    publicationFailureReason: null,
    publicListingStatus: null,
};

function hookState(overrides: Record<string, unknown> = {}) {
    return {
        items: [],
        data: { pages: [] },
        error: null,
        isPending: false,
        isLoading: false,
        isSuccess: true,
        isError: false,
        isFetching: false,
        isFetchingNextPage: false,
        isNextPageError: false,
        isRefreshError: false,
        hasMore: false,
        nextCursor: null,
        loadNextPage,
        refresh,
        resetPagination,
        ...overrides,
    };
}

describe('OwnerInventoryReadScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        readHook.mockReturnValue(hookState());
        (usePublicationCommands as jest.Mock).mockReturnValue({ mutateAsync: jest.fn() });
    });

    it('distinguishes loading from a successful empty inventory', () => {
        readHook.mockReturnValueOnce(hookState({
            data: undefined,
            isPending: true,
            isLoading: true,
            isSuccess: false,
        }));
        const loading = render(<OwnerInventoryReadScreen identity={identity} />);
        expect(loading.getByText('Loading inventory…')).toBeTruthy();
        expect(loading.queryByText('No inventory items found')).toBeNull();
        loading.unmount();

        readHook.mockReturnValueOnce(hookState());
        const empty = render(<OwnerInventoryReadScreen identity={identity} />);
        expect(empty.getByText('No inventory items found')).toBeTruthy();
    });

    it.each([
        ['unauthorized', 'Inventory access unavailable'],
        ['unavailable', 'Inventory temporarily unavailable'],
        ['invalid_request', 'Inventory filters are invalid'],
        ['invalid_cursor', 'Inventory page expired'],
        ['internal', 'Inventory could not be loaded'],
    ] as const)('renders %s as an explicit non-empty state', (category, message) => {
        readHook.mockReturnValue(hookState({
            data: undefined,
            isSuccess: false,
            isError: true,
            error: new OwnerInventoryReadError({
                category,
                code: category === 'invalid_cursor'
                    ? 'P9_CURSOR_INVALID'
                    : category === 'invalid_request'
                        ? 'P9_REQUEST_INVALID'
                    : category === 'unauthorized'
                        ? 'P9_OWNER_NOT_AUTHORIZED'
                        : category === 'unavailable'
                            ? 'P9_UNAVAILABLE'
                            : 'P9_INTERNAL_ERROR',
                retryable: category === 'unavailable',
            }),
        }));

        const screen = render(<OwnerInventoryReadScreen identity={identity} />);
        expect(screen.getByText(message)).toBeTruthy();
        expect(screen.queryByText('No inventory items found')).toBeNull();
    });

    it('renders controlled publication and public-media controls without legacy edit writes', () => {
        readHook.mockReturnValue(hookState({ items: [row] }));
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);

        expect(screen.getByText('The Bookshop')).toBeTruthy();
        expect(screen.getByTestId('filter-condition-very_good')).toBeTruthy();
        expect(screen.getByTestId('filter-source-metadata_import')).toBeTruthy();
        expect(screen.queryByText('Manual book entry')).toBeNull();
        expect(screen.queryByTestId('save-inventory-draft')).toBeNull();
        expect(screen.queryByTestId('check-duplicates')).toBeNull();
        expect(screen.getByTestId(`publish-${row.id}`)).toBeTruthy();
        expect(screen.queryByTestId(`pause-${row.id}`)).toBeNull();
        expect(screen.getByTestId(`manage-public-media-${row.id}`)).toBeTruthy();
        expect(screen.queryByTestId(`edit-modal-${row.id}`)).toBeNull();
        expect(screen.queryByTestId(`save-edit-${row.id}`)).toBeNull();
        expect(screen.queryByTestId('bulk-publish')).toBeNull();
        expect(screen.queryByTestId('bulk-pause')).toBeNull();
    });

    it('does not offer retry when Owner access is unauthorized', () => {
        readHook.mockReturnValue(hookState({
            data: undefined,
            isSuccess: false,
            isError: true,
            error: new OwnerInventoryReadError({
                category: 'unauthorized',
                code: 'P9_OWNER_NOT_AUTHORIZED',
                retryable: false,
            }),
        }));
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);

        expect(screen.getByText('Inventory access unavailable')).toBeTruthy();
        expect(screen.queryByTestId('owner-inventory-retry')).toBeNull();
        expect(screen.queryByTestId('owner-inventory-refresh')).toBeNull();
        expect(screen.queryByText('Try again')).toBeNull();
    });

    it('passes search and supported filters into a fresh query identity', () => {
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);

        fireEvent.changeText(screen.getByTestId('owner-inventory-search'), 'Bookshop');
        fireEvent.press(screen.getByTestId('filter-condition-acceptable'));

        expect(readHook).toHaveBeenLastCalledWith(identity, expect.objectContaining({
            query: 'Bookshop',
            condition: 'acceptable',
        }));
    });

    it('preserves loaded rows and exposes recoverable next-page controls', () => {
        readHook.mockReturnValue(hookState({
            items: [row],
            isError: true,
            isNextPageError: true,
            error: new OwnerInventoryReadError({
                category: 'invalid_cursor',
                code: 'P9_CURSOR_INVALID',
                retryable: false,
            }),
        }));
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);

        expect(screen.getByText('The Bookshop')).toBeTruthy();
        expect(screen.getByText('More inventory could not be loaded')).toBeTruthy();
        fireEvent.press(screen.getByTestId('owner-inventory-reset-pagination'));
        expect(resetPagination).toHaveBeenCalled();
    });

    it('retries an unavailable next page without clearing loaded rows', () => {
        readHook.mockReturnValue(hookState({
            items: [row],
            isError: true,
            isNextPageError: true,
            error: new OwnerInventoryReadError({
                category: 'unavailable',
                code: 'P9_UNAVAILABLE',
                retryable: true,
            }),
        }));
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);

        fireEvent.press(screen.getByTestId('owner-inventory-retry-next'));
        expect(loadNextPage).toHaveBeenCalled();
        expect(screen.getByText('The Bookshop')).toBeTruthy();
    });

    it('labels a refresh failure separately and keeps loaded rows visible', () => {
        readHook.mockReturnValue(hookState({
            items: [row],
            isError: true,
            isRefreshError: true,
            error: new OwnerInventoryReadError({
                category: 'internal',
                code: 'P9_RESPONSE_INVALID',
                retryable: false,
            }),
        }));
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);

        expect(screen.getByText('The Bookshop')).toBeTruthy();
        expect(screen.getByText('Inventory refresh failed')).toBeTruthy();
        expect(screen.getByText('The inventory response was invalid. Previously loaded items remain visible.')).toBeTruthy();
        fireEvent.press(screen.getByTestId('owner-inventory-retry-refresh'));
        expect(refresh).toHaveBeenCalled();
    });

    it('does not render successful empty inventory during a failed refresh', () => {
        readHook.mockReturnValue(hookState({
            items: [],
            isSuccess: true,
            isError: true,
            isRefreshError: true,
            error: new OwnerInventoryReadError({
                category: 'unavailable',
                code: 'P9_UNAVAILABLE',
                retryable: true,
            }),
        }));
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);

        expect(screen.getByText('Inventory temporarily unavailable')).toBeTruthy();
        expect(screen.queryByText('No inventory items found')).toBeNull();
    });

    it('keeps partial unauthorized rows but offers no next-page action', () => {
        readHook.mockReturnValue(hookState({
            items: [row],
            isError: true,
            isNextPageError: true,
            error: new OwnerInventoryReadError({
                category: 'unauthorized',
                code: 'P9_OWNER_NOT_AUTHORIZED',
                retryable: false,
            }),
        }));
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);

        expect(screen.getByText('The Bookshop')).toBeTruthy();
        expect(screen.getByText('Inventory access changed')).toBeTruthy();
        expect(screen.queryByTestId('owner-inventory-retry-next')).toBeNull();
        expect(screen.queryByTestId('owner-inventory-refresh')).toBeNull();
        expect(loadNextPage).not.toHaveBeenCalled();
    });

    it('loads the next page and refreshes without exposing mutation handlers', () => {
        readHook.mockReturnValue(hookState({ items: [row], hasMore: true, nextCursor: 'opaque' }));
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);

        fireEvent.press(screen.getByTestId('owner-inventory-load-more'));
        fireEvent.press(screen.getByTestId('owner-inventory-refresh'));
        expect(loadNextPage).toHaveBeenCalled();
        expect(refresh).toHaveBeenCalled();
    });
});
