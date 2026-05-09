import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubInviteScreen from '../ClubInviteScreen';

const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubInvitations = jest.fn();
const mockUseCreateClubInvitation = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ clubId: 'club-invite' }),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5',
      textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8', accentLight: '#818CF8',
    },
  }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'moderator-1' } }),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
  useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
  useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
  useClubInvitations: (...args: unknown[]) => mockUseClubInvitations(...args),
  useCreateClubInvitation: (...args: unknown[]) => mockUseCreateClubInvitation(...args),
}));
jest.mock('@/lib/navigation', () => ({
  navigateBackOrFallback: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseClubPublicDetail.mockReturnValue({
    data: { id: 'club-invite', name: 'Invite Circle', club_type: 'invite_only', admin_id: 'admin-1' },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockUseClubMembership.mockReturnValue({ data: { role: 'moderator', status: 'active' }, isLoading: false });
  mockUseClubInvitations.mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: jest.fn() });
  mockUseCreateClubInvitation.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
});

describe('ClubInviteScreen', () => {
  it('shows a normalized entitlement error when invitation history cannot be loaded', () => {
    mockUseClubInvitations.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Only eligible moderators or admins can send invitations'),
      refetch: jest.fn(),
    });

    const { getByText } = render(<ClubInviteScreen />);

    expect(getByText('Unable to load invitations')).toBeOnTheScreen();
    expect(getByText('Only eligible Pro/Pro+ moderators or the club admin can send invitations for this club.')).toBeOnTheScreen();
  });

  it('shows a normalized entitlement error when sending an invitation is rejected', async () => {
    const mutateAsync = jest.fn().mockRejectedValue(new Error('Only eligible moderators or admins can send invitations'));
    mockUseCreateClubInvitation.mockReturnValue({ mutateAsync, isPending: false });

    const { getByTestId, getByText } = render(<ClubInviteScreen />);

    fireEvent.changeText(getByTestId('invite-username-input'), 'readerone');
    fireEvent.press(getByTestId('send-invitation-button'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-invite', inviteeUsername: 'readerone', note: '' }));
    expect(getByText('Only eligible Pro/Pro+ moderators or the club admin can send invitations for this club.')).toBeOnTheScreen();
  });
});