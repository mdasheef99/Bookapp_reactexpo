import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubEventEditorScreen from '../ClubEventEditorScreen';
import { profileService } from '@/features/auth/services/profileService';

const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubEvent = jest.fn();
const mockUseClubEventVenues = jest.fn();
const mockUseCreateClubEvent = jest.fn();
const mockUseUpdateClubEvent = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { back: (...args: unknown[]) => mockRouterBack(...args), replace: (...args: unknown[]) => mockRouterReplace(...args) },
    useLocalSearchParams: () => ({ clubId: 'club-1' }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: { bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8' } }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'reader-1' } }) }));
jest.mock('@/features/auth/services/profileService', () => ({ profileService: { getProfileSummary: jest.fn() } }));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
    useClubEvent: (...args: unknown[]) => mockUseClubEvent(...args),
    useClubEventVenues: (...args: unknown[]) => mockUseClubEventVenues(...args),
    useCreateClubEvent: (...args: unknown[]) => mockUseCreateClubEvent(...args),
    useUpdateClubEvent: (...args: unknown[]) => mockUseUpdateClubEvent(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseClubPublicDetail.mockReturnValue({ data: { id: 'club-1', name: 'Author Circle', admin_id: 'admin-1', access_level: 'pro_plus' }, isLoading: false });
    mockUseClubMembership.mockReturnValue({ data: { role: 'moderator', status: 'active' }, isLoading: false });
    mockUseClubEvent.mockReturnValue({ data: null, isLoading: false });
    mockUseClubEventVenues.mockReturnValue({ data: [], isLoading: false });
    mockUseCreateClubEvent.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'event-1' }), isPending: false });
    mockUseUpdateClubEvent.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (profileService.getProfileSummary as jest.Mock).mockResolvedValue({ membership_tier: 'pro_plus' });
});

describe('ClubEventEditorScreen', () => {
    it('creates a hybrid event using the manual meetup location fallback when there are no linked venues', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'event-1' });
        mockUseCreateClubEvent.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId } = render(<ClubEventEditorScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.changeText(getByTestId('club-event-title'), 'Hybrid planning night');
        fireEvent.changeText(getByTestId('club-event-start-date'), '2026-03-24');
        fireEvent.changeText(getByTestId('club-event-start-time'), '18:30');
        fireEvent.press(getByTestId('club-event-type-hybrid'));
        fireEvent.changeText(getByTestId('club-event-manual-location'), 'Café upstairs');
        fireEvent.changeText(getByTestId('club-event-meeting-link'), 'https://meet.example.com/hybrid-night');
        fireEvent.changeText(getByTestId('club-event-description'), 'Bring your notes');
        fireEvent.press(getByTestId('club-event-submit'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
            clubId: 'club-1',
            title: 'Hybrid planning night',
            eventType: 'hybrid',
            manualLocation: 'Café upstairs',
            meetingLink: 'https://meet.example.com/hybrid-night',
        })));
        expect(mockRouterReplace).toHaveBeenCalledWith('/clubs/club-1/events');
    });

    it('shows the manager access gate when the member cannot create events', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        (profileService.getProfileSummary as jest.Mock).mockResolvedValueOnce({ membership_tier: 'free' });

        const { getByText, queryByTestId } = render(<ClubEventEditorScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));
        expect(getByText('Manager access required')).toBeOnTheScreen();
        expect(queryByTestId('club-event-submit')).toBeNull();
    });
});