import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubNominateBookScreen from '../ClubNominateBookScreen';
import { booksService } from '@/features/books/services/booksService';

const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseNominateClubBook = jest.fn();

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: { Medium: 'Medium', Light: 'Light' },
    NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('expo-router', () => ({
    router: { back: (...args: unknown[]) => mockRouterBack(...args), replace: (...args: unknown[]) => mockRouterReplace(...args) },
    useLocalSearchParams: () => ({ clubId: 'club-1' }),
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
jest.mock('@/hooks/useDebounce', () => ({
    useDebounce: (value: string) => value,
}));
jest.mock('@/features/books/services/booksService', () => ({
    booksService: { searchGoogleBooksCached: jest.fn() },
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
    useNominateClubBook: (...args: unknown[]) => mockUseNominateClubBook(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseClubPublicDetail.mockReturnValue({ data: { id: 'club-1', name: 'Author Circle' }, isLoading: false });
    mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
    mockUseNominateClubBook.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'nomination-1' }), isPending: false });
    (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({
        items: [{ id: 'google-book-1', volumeInfo: { title: 'Parable of the Sower', authors: ['Octavia Butler'], imageLinks: { thumbnail: 'https://books.example/parable-thumb.jpg' }, publishedDate: '1993' } }],
        totalItems: 1,
        hasMore: false,
        fromCache: false,
    });
});

describe('ClubNominateBookScreen', () => {
    it('searches Google Books, lets the member select a result, and submits the nomination', async () => {
        jest.useFakeTimers();
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'nomination-1' });
        mockUseNominateClubBook.mockReturnValue({ mutateAsync, isPending: false });
        (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({
            items: [{ id: 'google-book-1', volumeInfo: { title: 'Parable of the Sower', authors: ['Octavia Butler'], imageLinks: { thumbnail: 'https://example.com/cover.jpg' } } }],
            totalItems: 1,
            hasMore: false,
            fromCache: false,
        });

        const { getByLabelText, getByTestId, getByText } = render(<ClubNominateBookScreen />);

        fireEvent.changeText(getByLabelText('Search books'), 'Parable');

        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledWith('Parable', 0, 10));
        expect(getByText('Parable of the Sower')).toBeOnTheScreen();

        fireEvent.press(getByTestId('club-nomination-result-google-book-1'));
        fireEvent.press(getByTestId('club-submit-nomination'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
            clubId: 'club-1',
            googleBook: expect.objectContaining({ id: 'google-book-1' }),
        })));

        jest.advanceTimersByTime(1500);
        expect(mockRouterReplace).toHaveBeenCalledWith('/clubs/club-1?tab=nominations');
        jest.useRealTimers();
    });

    it('only searches once after a single query input change', async () => {
        (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({ items: [], totalItems: 0, hasMore: false, fromCache: false });

        const { getByLabelText } = render(<ClubNominateBookScreen />);
        fireEvent.changeText(getByLabelText('Search books'), 'Parable');

        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledWith('Parable', 0, 10));
        expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(1);
    });

    it('shows cached results banner when search returns from cache', async () => {
        (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({
            items: [{ id: 'google-book-1', volumeInfo: { title: 'Parable of the Sower', authors: ['Octavia Butler'], imageLinks: { thumbnail: 'https://example.com/cover.jpg' } } }],
            totalItems: 1,
            hasMore: false,
            fromCache: true,
        });

        const { getByLabelText, getByText } = render(<ClubNominateBookScreen />);
        fireEvent.changeText(getByLabelText('Search books'), 'Parable');

        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledWith('Parable', 0, 10));
        await waitFor(() => expect(getByText('Showing cached results')).toBeOnTheScreen());
    });

    it('shows the active-membership gate when the reader cannot nominate', () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'muted' }, isLoading: false });

        const { getByText, queryByTestId } = render(<ClubNominateBookScreen />);

        expect(getByText('Active membership required')).toBeOnTheScreen();
        expect(queryByTestId('club-nomination-search')).toBeNull();
    });
});