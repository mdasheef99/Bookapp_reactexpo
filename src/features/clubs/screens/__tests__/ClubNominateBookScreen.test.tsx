import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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
        expect(StyleSheet.flatten(getByTestId('club-nomination-selected-section').props.style).borderColor).toBe('#8B322C');
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

    it('shows short-query feedback without retaining a stale no-match message', async () => {
        (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({ items: [], totalItems: 0, hasMore: false, fromCache: false });

        const { getByLabelText, getByTestId, getByText, queryByText } = render(<ClubNominateBookScreen />);
        fireEvent.changeText(getByLabelText('Search books'), 'Parable');

        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledWith('Parable', 0, 10));
        await waitFor(() => expect(getByText('No matches found')).toBeOnTheScreen());

        fireEvent.changeText(getByLabelText('Search books'), 'ab');
        fireEvent.press(getByTestId('club-nomination-search'));

        expect(getByText('Enter at least 3 characters to search Google Books.')).toBeOnTheScreen();
        expect(queryByText('No matches found')).toBeNull();
        expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(1);
    });

    it('hides previous results after short-query validation', async () => {
        const { getByLabelText, getByTestId, getByText, queryByTestId } = render(<ClubNominateBookScreen />);
        fireEvent.changeText(getByLabelText('Search books'), 'Parable');

        await waitFor(() => expect(getByTestId('club-nomination-result-google-book-1')).toBeOnTheScreen());

        fireEvent.changeText(getByLabelText('Search books'), 'ab');
        fireEvent.press(getByTestId('club-nomination-search'));

        expect(getByText('Enter at least 3 characters to search Google Books.')).toBeOnTheScreen();
        expect(queryByTestId('club-nomination-result-google-book-1')).toBeNull();
        expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(1);
    });

    it('keeps search results available after manual-title validation', async () => {
        const { getByLabelText, getByRole, getByTestId, getByText } = render(<ClubNominateBookScreen />);
        fireEvent.changeText(getByLabelText('Search books'), 'Parable');
        await waitFor(() => expect(getByTestId('club-nomination-result-google-book-1')).toBeOnTheScreen());
        fireEvent.press(getByRole('button', { name: 'Nominate manually' }));
        expect(getByText('Enter a book title before submitting a manual nomination.')).toBeOnTheScreen();
        fireEvent.press(getByTestId('club-nomination-result-google-book-1'));
        expect(getByTestId('club-nomination-selected-section')).toBeOnTheScreen();
    });

    it('keeps other results selectable after a nomination fails', async () => {
        const mutateAsync = jest.fn().mockRejectedValue(new Error('Unable to nominate this book right now.'));
        mockUseNominateClubBook.mockReturnValue({ mutateAsync, isPending: false });
        (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({
            items: [
                { id: 'google-book-1', volumeInfo: { title: 'First book' } },
                { id: 'google-book-2', volumeInfo: { title: 'Second book' } },
            ], totalItems: 2, hasMore: false, fromCache: false,
        });
        const { getByLabelText, getByTestId, getByText } = render(<ClubNominateBookScreen />);
        fireEvent.changeText(getByLabelText('Search books'), 'Parable');
        await waitFor(() => expect(getByTestId('club-nomination-result-google-book-1')).toBeOnTheScreen());
        fireEvent.press(getByTestId('club-nomination-result-google-book-1'));
        fireEvent.press(getByTestId('club-submit-nomination'));
        await waitFor(() => expect(getByText('Unable to nominate this book right now.')).toBeOnTheScreen());
        fireEvent.press(getByTestId('club-nomination-result-google-book-2'));
        expect(getByTestId('club-nomination-result-google-book-2').props.accessibilityState.selected).toBe(true);
        expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('exposes selection state and preserves the voting period when search is cleared', async () => {
        const { getByLabelText, getByRole, getByTestId, queryByTestId } = render(<ClubNominateBookScreen />);
        fireEvent.changeText(getByLabelText('Search books'), 'Parable');

        await waitFor(() => expect(getByTestId('club-nomination-result-google-book-1')).toBeOnTheScreen());
        expect(getByRole('button', { name: 'Clear search' })).toBeOnTheScreen();

        fireEvent.press(getByTestId('club-nomination-result-google-book-1'));
        expect(getByTestId('club-nomination-selected-section')).toBeOnTheScreen();
        expect(getByTestId('club-nomination-result-google-book-1').props.accessibilityState.selected).toBe(true);
        expect(getByTestId('club-nomination-voting-period').props.accessibilityRole).toBe('radiogroup');
        expect(getByTestId('club-nomination-voting-period').props.accessibilityLabel).toBe('Voting period');
        expect(getByTestId('club-nomination-voting-days-7').props.accessibilityState.checked).toBe(true);

        fireEvent.press(getByTestId('club-nomination-voting-days-14'));
        expect(getByTestId('club-nomination-voting-days-14').props.accessibilityState.checked).toBe(true);
        expect(getByTestId('club-nomination-voting-days-7').props.accessibilityState.checked).toBe(false);

        fireEvent.press(getByRole('button', { name: 'Clear search' }));
        expect(queryByTestId('club-nomination-result-google-book-1')).toBeNull();
        expect(queryByTestId('club-nomination-selected-section')).toBeNull();

        fireEvent.changeText(getByLabelText('Search books'), 'Parable');
        await waitFor(() => expect(getByTestId('club-nomination-result-google-book-1')).toBeOnTheScreen());
        fireEvent.press(getByTestId('club-nomination-result-google-book-1'));
        expect(getByTestId('club-nomination-voting-days-14').props.accessibilityState.checked).toBe(true);
    });

    it('requires a title before the manual nomination mutation', () => {
        const mutateAsync = jest.fn();
        mockUseNominateClubBook.mockReturnValue({ mutateAsync, isPending: false });
        const { getByRole, getByText } = render(<ClubNominateBookScreen />);

        fireEvent.press(getByRole('button', { name: 'Nominate manually' }));

        expect(getByText('Enter a book title before submitting a manual nomination.')).toBeOnTheScreen();
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('shows the active-membership gate when the reader cannot nominate', () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'muted' }, isLoading: false });

        const { getByText, queryByTestId } = render(<ClubNominateBookScreen />);

        expect(getByText('Active membership required')).toBeOnTheScreen();
        expect(queryByTestId('club-nomination-search')).toBeNull();
    });
});
