import React from 'react';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import BookDetailScreen from '../[bookId]';
import { BookFeedbackProvider } from '@/components/library/ui/BookFeedback';
import { booksService } from '@/features/books/services/booksService';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { bookReviewService } from '@/features/books/services/bookReviewService';
import { useAuthStore } from '@/features/auth/store/authStore';

let mockUserBook: any;
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({ bookId: 'user-book-1' }),
    useRouter: () => ({
        back: mockBack,
        push: jest.fn(),
        replace: mockReplace,
        canGoBack: mockCanGoBack,
    }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        phase: 'daylight',
    }),
}));
// Review writes are bound to the authenticated store actor, so useAuth reads the same session.
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => {
    const { useAuthStore: store } = require('@/features/auth/store/authStore');
    const session = store((state: any) => state.session);
    return { user: session?.user, session };
} }));
jest.mock('@/features/books/services/booksService', () => ({
    booksService: {
        getBookDetails: jest.fn(),
        getPublicReviewsForBook: jest.fn(),
        updateReadingStatus: jest.fn(),
        updateOwnership: jest.fn(),
        updateCondition: jest.fn(),
        toggleLendingAvailability: jest.fn(),
        removeFromLibrary: jest.fn(),
    },
}));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteOperations: jest.fn() }));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({ manualNotesGateway: { list: jest.fn() } }));
jest.mock('@/components/library', () => ({
    StatusSelector: () => null,
    OwnershipSelector: () => null,
    ConditionPicker: () => null,
    RatingInput: () => null,
    DeleteBookModal: () => null,
}));
jest.mock('@/components/library/VaultPagesList', () => ({ VaultPagesList: () => null }));
jest.mock('@/components/notes', () => ({
    NoteCard: () => null,
}));
jest.mock('@/components/ui/AtmosphericBackground', () => ({
    AtmosphericBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const renderScreen = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });

    return {
        queryClient,
        ...render(
            <QueryClientProvider client={queryClient}>
                <BookFeedbackProvider><BookDetailScreen /></BookFeedbackProvider>
            </QueryClientProvider>
        ),
    };
};

describe('BookDetailScreen review persistence', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCanGoBack.mockReturnValue(true);
        useAuthStore.setState({ session: { user: { id: 'reader-1' }, access_token: 'token-reader-1' } as any, status: 'authenticated' });
        mockUserBook = {
            id: 'user-book-1',
            user_id: 'reader-1',
            book_id: 'book-1',
            rating: null,
            review: 'Existing review',
            review_is_public: true,
            reading_status: 'want_to_read',
            ownership: 'borrowed',
            condition: 'good',
            available_for_lending: false,
            book: {
                title: 'Beloved',
                authors: ['Toni Morrison'],
                cover_url: null,
                page_count: 320,
                publisher: 'Knopf',
                isbn_13: '9781400033416',
            },
        };
        (booksService.getBookDetails as jest.Mock).mockImplementation(async () => mockUserBook);
        (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
        (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
        jest.spyOn(bookReviewService, 'update').mockImplementation(async (_actor, entryId, patch) => {
            mockUserBook = { ...mockUserBook, ...patch };
            const { rating, review, review_is_public } = mockUserBook;
            return { id: entryId, user_id: 'reader-1', rating, review, review_is_public };
        });
        jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.restoreAllMocks();
        useAuthStore.setState({ session: null, status: 'unauthenticated' });
    });

    it('saves privacy and review text as single-field writes without forcing a rating', async () => {
        const { getByRole, getByTestId, findByTestId, findByText, unmount, queryClient } = renderScreen();

        await findByText('Beloved');
        fireEvent.press(getByRole('button', { name: 'My review' }));
        await findByTestId('library-review-input');
        await waitFor(() => expect(getByTestId('library-review-input').props.value).toBe('Existing review'));

        fireEvent.changeText(getByTestId('library-review-input'), 'Updated review copy');
        fireEvent.press(getByTestId('library-review-privacy-toggle'));
        fireEvent(getByTestId('library-review-input'), 'blur');

        expect(await findByText('Review saved!')).toBeOnTheScreen();
        expect(Alert.alert).not.toHaveBeenCalled();
        const patches = (bookReviewService.update as jest.Mock).mock.calls.map(([, entryId, patch]) => [entryId, patch]);
        expect(patches).toEqual([
            ['user-book-1', { review_is_public: false }],
            ['user-book-1', { review: 'Updated review copy' }],
        ]);
        expect(patches.some(([, patch]) => 'rating' in patch)).toBe(false);
        expect(await findByText('Private Review')).toBeOnTheScreen();

        unmount();
        queryClient.clear();
    });

    it('renders community reviews from the public review query without mixing in the local review editor', async () => {
        (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValueOnce([{
            user_book_id: 'community-1',
            book_id: 'book-1',
            rating: 5,
            review: 'A beautifully written review from another reader.',
            created_at: '2026-03-12T09:00:00Z',
            author: {
                user_id: 'reader-2',
                display_name: 'Reader Two',
                username: 'reader-two',
                avatar_url: null,
            },
        }]);

        const { getByRole, findByText, getByText, queryByText, queryByTestId, queryClient, unmount } = renderScreen();

        await waitFor(() => expect(booksService.getPublicReviewsForBook).toHaveBeenCalledWith('book-1'));
        await findByText('Beloved');
        fireEvent.press(getByRole('button', { name: 'Community reviews' }));

        expect(await findByText('Reader Two')).toBeOnTheScreen();
        expect(getByText('@reader-two')).toBeOnTheScreen();
        expect(getByText('A beautifully written review from another reader.')).toBeOnTheScreen();
        expect(queryByText('No public reviews yet.')).not.toBeOnTheScreen();
        expect(queryByText('Existing review')).not.toBeOnTheScreen();
        expect(queryByTestId('library-review-input')).toBeNull();

        unmount();
        queryClient.clear();
    });

    it('falls back to the library tab when back history is unavailable', async () => {
        mockCanGoBack.mockReturnValue(false);

        const { getByTestId, queryClient, unmount } = renderScreen();

        await waitFor(() => expect(getByTestId('library-book-back-button')).toBeOnTheScreen());

        fireEvent.press(getByTestId('library-book-back-button'));

        expect(mockBack).not.toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/library');

        unmount();
        queryClient.clear();
    });
});
