import React from 'react';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import BookDetailScreen from '../[bookId]';
import { booksService } from '@/features/books/services/booksService';
import { notesService } from '@/features/books/services/notesService';

let mockUserBook: any;

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({ bookId: 'user-book-1' }),
    useRouter: () => ({ back: jest.fn() }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5',
            textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8', shadow: '#0F172A',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'reader-1' } }),
}));
jest.mock('@/features/books/services/booksService', () => ({
    booksService: {
        getBookDetails: jest.fn(),
        getPublicReviewsForBook: jest.fn(),
        addRating: jest.fn(),
        updateReadingStatus: jest.fn(),
        updateOwnership: jest.fn(),
        updateCondition: jest.fn(),
        toggleLendingAvailability: jest.fn(),
        removeFromLibrary: jest.fn(),
    },
}));
jest.mock('@/features/books/services/notesService', () => ({
    notesService: {
        getNotesForBook: jest.fn(),
        createNote: jest.fn(),
        updateNote: jest.fn(),
        deleteNote: jest.fn(),
    },
    NOTE_TAG_CONFIG: {},
}));
jest.mock('@/components/library', () => ({
    StatusSelector: () => null,
    OwnershipSelector: () => null,
    ConditionPicker: () => null,
    RatingInput: () => null,
    DeleteBookModal: () => null,
}));
jest.mock('@/components/notes', () => ({
    NoteCard: () => null,
    NoteEditor: () => null,
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
                <BookDetailScreen />
            </QueryClientProvider>
        ),
    };
};

describe('BookDetailScreen review persistence', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUserBook = {
            id: 'user-book-1',
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
        (booksService.addRating as jest.Mock).mockImplementation(async (_id, rating, review, isPublic) => {
            mockUserBook = {
                ...mockUserBook,
                rating: rating ?? mockUserBook.rating,
                review,
                review_is_public: isPublic ?? mockUserBook.review_is_public,
            };
        });
        (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
        (notesService.getNotesForBook as jest.Mock).mockResolvedValue([]);
        jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('uses local review state for privacy toggles and review saves without forcing rating 0', async () => {
        const { getByTestId, getByText, unmount, queryClient } = renderScreen();

        await waitFor(() => expect(getByTestId('library-review-input').props.value).toBe('Existing review'));

        fireEvent.changeText(getByTestId('library-review-input'), 'Updated review copy');
        fireEvent.press(getByTestId('library-review-privacy-toggle'));

        expect(getByText('Private Note')).toBeOnTheScreen();

        await waitFor(() => expect(booksService.addRating).toHaveBeenCalledWith(
            'user-book-1',
            undefined,
            'Updated review copy',
            false
        ));

        fireEvent(getByTestId('library-review-input'), 'blur');

        await waitFor(() => expect(booksService.addRating).toHaveBeenLastCalledWith(
            'user-book-1',
            undefined,
            'Updated review copy',
            false
        ));
        await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Success', 'Review saved!'));

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

        const { getByText, queryByText, queryClient, unmount } = renderScreen();

        await waitFor(() => expect(booksService.getPublicReviewsForBook).toHaveBeenCalledWith('book-1'));

        expect(getByText('Community Reviews')).toBeOnTheScreen();
        expect(getByText('Reader Two')).toBeOnTheScreen();
        expect(getByText('@reader-two')).toBeOnTheScreen();
        expect(getByText('A beautifully written review from another reader.')).toBeOnTheScreen();
        expect(queryByText('No public reviews yet.')).not.toBeOnTheScreen();

        unmount();
        queryClient.clear();
    });
});