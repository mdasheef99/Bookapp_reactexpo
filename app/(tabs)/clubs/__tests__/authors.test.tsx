jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

import { fireEvent, render } from '@testing-library/react-native';
import ClubAuthorsRoute from '../authors';

const mockUseBrowseClubs = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1',
            accent: '#4F46E5', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8',
        },
    }),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useBrowseClubs: (...args: unknown[]) => mockUseBrowseClubs(...args),
}));
jest.mock('@/features/clubs/components/ClubCard', () => ({
    ClubCard: ({ club, onPress }: { club: { id: string; name: string }; onPress: (club: { id: string; name: string }) => void }) => {
        const React = require('react');
        const { TouchableOpacity, Text } = require('react-native');
        return React.createElement(TouchableOpacity, { onPress: () => onPress(club), testID: `author-club-${club.id}` }, React.createElement(Text, null, club.name));
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockRouterPush.mockReset();
    mockUseBrowseClubs.mockReturnValue({
        data: [{ id: 'author-club-1', name: 'Asha Dev Salon', club_type: 'author_club', author_display_name: 'Asha Dev' }],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        isRefetching: false,
    });
});

describe('ClubAuthorsRoute', () => {
    it('loads only author clubs and routes cards to club detail', () => {
        const { getByText, getByTestId } = render(<ClubAuthorsRoute />);

        expect(mockUseBrowseClubs).toHaveBeenCalledWith({
            clubType: 'author_club',
            limit: 50,
            offset: 0,
        });
        expect(getByText('Author clubs')).toBeOnTheScreen();
        expect(getByText('Verified author communities, AMA sessions, and signed-edition reads.')).toBeOnTheScreen();
        expect(getByText('Asha Dev Salon')).toBeOnTheScreen();

        fireEvent.press(getByTestId('author-club-author-club-1'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/author-club-1');
    });
});
