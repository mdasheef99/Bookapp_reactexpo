jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { push: jest.fn() },
}));

import { fireEvent, render } from '@testing-library/react-native';
import ClubsBrowseScreen from '../index';

const mockUseBrowseClubs = jest.fn();
const mockUseMyBrowseClubs = jest.fn();

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1',
            accent: '#4F46E5', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'reader-1' } }),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useBrowseClubs: (...args: unknown[]) => mockUseBrowseClubs(...args),
    useMyBrowseClubs: (...args: unknown[]) => mockUseMyBrowseClubs(...args),
}));
jest.mock('@/features/clubs/components/ClubCard', () => ({
    ClubCard: ({ club }: { club: { name: string } }) => require('react').createElement(require('react-native').Text, null, club.name),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseBrowseClubs.mockReturnValue({ data: [{ id: 'club-1', name: 'Open Readers' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
    mockUseMyBrowseClubs.mockReturnValue({ data: [{ id: 'club-2', name: 'Quiet Members' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
});

describe('ClubsBrowseScreen', () => {
    it('defaults to all clubs and shows the current audited browse copy', () => {
        const { getByText } = render(<ClubsBrowseScreen />);

        expect(getByText('Book clubs')).toBeOnTheScreen();
        expect(getByText('Discover public club details, browse current reads, and find your next reading community.')).toBeOnTheScreen();
        expect(getByText('Open Readers')).toBeOnTheScreen();
        expect(getByText(/invite acceptance are live/i)).toBeOnTheScreen();
    });

    it('switches to my clubs and shows the membership-scoped empty state or results', () => {
        const { getByText, getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        expect(mockUseMyBrowseClubs).toHaveBeenLastCalledWith('reader-1', expect.any(Object), true);
        expect(getByText('See the clubs where you already have an active reader seat.')).toBeOnTheScreen();
        expect(getByText('Quiet Members')).toBeOnTheScreen();
    });

    it('shows scope-aware retry copy without the empty state when my clubs fails to load', () => {
        mockUseMyBrowseClubs.mockImplementation((_userId: string, _filters: unknown, enabled: boolean) => (
            enabled
                ? { data: [], isLoading: false, isError: true, refetch: jest.fn(), isRefetching: false }
                : { data: [{ id: 'club-2', name: 'Quiet Members' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false }
        ));

        const { getByTestId, getByText, queryByText } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        expect(getByText('Couldn’t load clubs')).toBeOnTheScreen();
        expect(getByText('Try refreshing to fetch your latest membership-linked club list from Supabase.')).toBeOnTheScreen();
        expect(queryByText('You have not joined any clubs yet')).toBeNull();
    });
});