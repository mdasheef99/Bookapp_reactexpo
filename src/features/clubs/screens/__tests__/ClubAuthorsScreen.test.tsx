jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: {
        push: (...args: unknown[]) => mockRouterPush(...args),
        replace: (...args: unknown[]) => mockRouterReplace(...args),
    },
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ClubAuthorsScreen } from '../ClubAuthorsScreen';

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockUseBrowseClubs = jest.fn();

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            accentLight: '#EEF2FF',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
            error: '#EF4444',
        },
    }),
}));

jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useBrowseClubs: (...args: unknown[]) => mockUseBrowseClubs(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseBrowseClubs.mockReturnValue({
        data: [
            {
                id: 'club-author-1', name: 'Author Salon', description: 'Verified author community.',
                cover_url: null, club_type: 'author_club', access_level: 'all', meeting_type: 'online_only',
                member_count: 12, max_members: null, current_book_id: null, current_book_google_books_id: null,
                current_book_title: null, current_book_authors: null, current_book_cover_url: null,
                current_book_retail_price: null, current_book_currency_code: null, admin_id: null,
                admin_profile_id: null, admin_display_name: null, admin_avatar_url: null, admin_city: null,
                author_id: 'author-1', author_user_id: 'author-user-1', author_display_name: 'Asha Dev',
                author_avatar_url: null, author_city: 'Bangalore', created_at: null, updated_at: null,
            },
        ],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        isRefetching: false,
    });
});

describe('ClubAuthorsScreen', () => {
    it('renders author clubs with verified author context', async () => {
        const { getByText } = render(<ClubAuthorsScreen />);

        await waitFor(() => expect(getByText('Author clubs')).toBeOnTheScreen());
        expect(getByText('Author Salon')).toBeOnTheScreen();
        expect(getByText('Author-led club')).toBeOnTheScreen();
        expect(getByText('Verified author community.')).toBeOnTheScreen();
    });

    it('returns to Clubs when the back button is pressed', async () => {
        const { getByRole, getByText } = render(<ClubAuthorsScreen />);

        await waitFor(() => expect(getByText('Author clubs')).toBeOnTheScreen());

        fireEvent.press(getByRole('button', { name: 'Back to Clubs' }));

        expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/clubs');
    });

    it('opens club detail when an author club is tapped', async () => {
        const { getByTestId, getByText } = render(<ClubAuthorsScreen />);

        await waitFor(() => expect(getByText('Author Salon')).toBeOnTheScreen());

        fireEvent.press(getByTestId('club-card-club-author-1'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/club-author-1');
    });
});
