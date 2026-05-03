import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubReadingProgressScreen from '../ClubReadingProgressScreen';

const mockUseAuth = jest.fn();
const mockUseTheme = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubCurrentBookStatusOverview = jest.fn();
const mockUseSetClubCurrentBookReadingStatus = jest.fn();

jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: (...args: unknown[]) => mockUseTheme(...args),
}));
jest.mock('expo-router', () => ({
    useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubCurrentBookStatusOverview: (...args: unknown[]) => mockUseClubCurrentBookStatusOverview(...args),
    useSetClubCurrentBookReadingStatus: (...args: unknown[]) => mockUseSetClubCurrentBookReadingStatus(...args),
}));

const colors = {
    bgPrimary: '#FFFFFF',
    bgCard: '#F8F8F8',
    bgSecondary: '#F0F0F0',
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    textTertiary: '#999999',
    accent: '#007AFF',
    accentLight: '#E5F1FF',
    border: '#E5E5E5',
    error: '#EF4444',
};

describe('ClubReadingProgressScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ user: { id: 'reader-1' } });
        mockUseTheme.mockReturnValue({ colors });
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1' });
        mockUseClubPublicDetail.mockReturnValue({
            data: {
                id: 'club-1',
                name: 'Test Club',
                current_book_id: 'book-1',
                current_book_title: 'Parable of the Sower',
                current_book_authors: ['Octavia Butler'],
                current_book_cover_url: 'https://example.com/cover.jpg',
            },
            isLoading: false,
            isError: false,
            error: null,
        });
        mockUseClubCurrentBookStatusOverview.mockReturnValue({
            data: {
                current_book_id: 'book-1',
                member_reading_status: 'want_to_read',
                to_start_count: 3,
                reading_count: 2,
                completed_count: 1,
                active_member_count: 6,
            },
            isLoading: false,
            isError: false,
            error: null,
        });
        mockUseSetClubCurrentBookReadingStatus.mockReturnValue({ mutateAsync: jest.fn(), isPending: false, isError: false, error: null });
    });

    it('renders the current book and aggregated stats', async () => {
        const { getByText } = render(<ClubReadingProgressScreen />);

        await waitFor(() => expect(getByText('Parable of the Sower')).toBeOnTheScreen());
        expect(getByText('Octavia Butler')).toBeOnTheScreen();
        expect(getByText('6')).toBeOnTheScreen();
        expect(getByText('3')).toBeOnTheScreen();
        expect(getByText('2')).toBeOnTheScreen();
        expect(getByText('1')).toBeOnTheScreen();
    });

    it('shows no-current-book state when club has no current book', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: {
                id: 'club-1',
                name: 'Test Club',
                current_book_id: null,
                current_book_title: null,
                current_book_authors: null,
                current_book_cover_url: null,
            },
            isLoading: false,
            isError: false,
            error: null,
        });
        mockUseClubCurrentBookStatusOverview.mockReturnValue({ data: null, isLoading: false, isError: false, error: null });

        const { getByText, queryByText } = render(<ClubReadingProgressScreen />);

        await waitFor(() => expect(getByText('No current book')).toBeOnTheScreen());
        expect(queryByText('Parable of the Sower')).toBeNull();
    });

    it('lets the member change their reading status', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined);
        mockUseSetClubCurrentBookReadingStatus.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null });

        const { getByTestId } = render(<ClubReadingProgressScreen />);

        await waitFor(() => expect(getByTestId('reading-status-reading')).toBeOnTheScreen());

        fireEvent.press(getByTestId('reading-status-reading'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', status: 'reading' }));
    });

    it('shows a loading state while club is loading', () => {
        mockUseClubPublicDetail.mockReturnValue({ data: null, isLoading: true, isError: false, error: null });
        mockUseClubCurrentBookStatusOverview.mockReturnValue({ data: null, isLoading: true, isError: false, error: null });

        const { getByTestId } = render(<ClubReadingProgressScreen />);
        expect(getByTestId('loading-indicator')).toBeOnTheScreen();
    });
});
