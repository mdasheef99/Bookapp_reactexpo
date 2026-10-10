import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubInviteScreen from '../ClubInviteScreen';
import { navigateBackOrFallback } from '@/lib/navigation';

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
  it('shows the club, username form and separate history workflow', () => {
    const { getByText, getByTestId, queryByText } = render(<ClubInviteScreen />);

    expect(getByText('Invite Circle')).toBeOnTheScreen();
    expect(getByTestId('invite-username-input')).toBeOnTheScreen();
    expect(getByTestId('invite-note-input')).toBeOnTheScreen();
    expect(getByText('Invitation history')).toBeOnTheScreen();
    expect(getByText('Pending invitations can be revoked from Manage Club.')).toBeOnTheScreen();
    expect(queryByText('Revoke')).toBeNull();
  });

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
    expect(getByTestId('invite-username-input').props.value).toBe('readerone');
  });

  it('preserves the username and optional note payload, clears both after success and refreshes history', async () => {
    const mutateAsync = jest.fn().mockResolvedValue({ id: 'invite-created' });
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockUseCreateClubInvitation.mockReturnValue({ mutateAsync, isPending: false });
    mockUseClubInvitations.mockReturnValue({ data: [], isLoading: false, isError: false, refetch });
    const { getByTestId, getByText } = render(<ClubInviteScreen />);

    fireEvent.changeText(getByTestId('invite-username-input'), ' readerone ');
    fireEvent.changeText(getByTestId('invite-note-input'), 'Welcome to the circle.');
    fireEvent.press(getByTestId('send-invitation-button'));

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-invite', inviteeUsername: ' readerone ', note: 'Welcome to the circle.' });
    expect(getByTestId('invite-username-input').props.value).toBe('');
    expect(getByTestId('invite-note-input').props.value).toBe('');
    expect(getByText('Invitation sent.')).toBeOnTheScreen();
  });

  it('does not send a blank username and keeps the optional note single line', () => {
    const mutateAsync = jest.fn();
    mockUseCreateClubInvitation.mockReturnValue({ mutateAsync, isPending: false });
    const { getByTestId } = render(<ClubInviteScreen />);
    fireEvent.changeText(getByTestId('invite-username-input'), '   ');
    fireEvent.changeText(getByTestId('invite-note-input'), 'A note without a recipient.');
    fireEvent.press(getByTestId('send-invitation-button'));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(getByTestId('invite-note-input').props.multiline).not.toBe(true);
    expect(getByTestId('invite-note-input').props.maxLength).toBeUndefined();
  });

  it('retains both draft fields when an invitation fails', async () => {
    mockUseCreateClubInvitation.mockReturnValue({ mutateAsync: jest.fn().mockRejectedValue(new Error('Reader not found.')), isPending: false });
    const { getByTestId, getByText } = render(<ClubInviteScreen />);
    fireEvent.changeText(getByTestId('invite-username-input'), 'missingreader');
    fireEvent.changeText(getByTestId('invite-note-input'), 'Please join us.');
    fireEvent.press(getByTestId('send-invitation-button'));

    await waitFor(() => expect(getByText('Reader not found.')).toBeOnTheScreen());
    expect(getByTestId('invite-username-input').props.value).toBe('missingreader');
    expect(getByTestId('invite-note-input').props.value).toBe('Please join us.');
  });

  it('disables Send invitation while the existing mutation is pending', () => {
    const mutateAsync = jest.fn();
    mockUseCreateClubInvitation.mockReturnValue({ mutateAsync, isPending: true });
    const { getByTestId, getByText } = render(<ClubInviteScreen />);
    expect(getByTestId('send-invitation-button')).toBeDisabled();
    expect(getByText('Sending…')).toBeOnTheScreen();
    fireEvent.press(getByTestId('send-invitation-button'));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('retains the moderator boundary and disables history fetching for ordinary members', () => {
    mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
    const { getByText, queryByTestId } = render(<ClubInviteScreen />);
    expect(getByText('Moderator access required')).toBeOnTheScreen();
    expect(queryByTestId('send-invitation-button')).toBeNull();
    expect(mockUseClubInvitations).toHaveBeenLastCalledWith('club-invite', false);
  });

  it('retains the invite-only club boundary', () => {
    mockUseClubPublicDetail.mockReturnValue({ data: { id: 'club-invite', name: 'Public Circle', club_type: 'public', admin_id: 'admin-1' }, isLoading: false, isError: false, refetch: jest.fn() });
    const { getByText, queryByTestId } = render(<ClubInviteScreen />);
    expect(getByText('This club does not use invitations')).toBeOnTheScreen();
    expect(queryByTestId('send-invitation-button')).toBeNull();
    expect(mockUseClubInvitations).toHaveBeenLastCalledWith('club-invite', false);
  });

  it('retains reader identity, status and note in invitation history', () => {
    mockUseClubInvitations.mockReturnValue({ data: [{ id: 'invite-history', invitee_user_id: 'reader-1', inviteeProfile: { display_name: 'Reader One', username: 'readerone' }, status: 'expired', note: 'Join our next read.' }], isLoading: false, isError: false, refetch: jest.fn() });
    const { getByText, queryByText } = render(<ClubInviteScreen />);
    expect(getByText('Reader One')).toBeOnTheScreen();
    expect(getByText('@readerone')).toBeOnTheScreen();
    expect(getByText('expired')).toBeOnTheScreen();
    expect(getByText('Join our next read.')).toBeOnTheScreen();
    expect(queryByText('Revoke')).toBeNull();
  });

  it('retries invitation history through its existing refetch function', () => {
    const refetch = jest.fn();
    mockUseClubInvitations.mockReturnValue({ data: [], isLoading: false, isError: true, error: new Error('Unavailable.'), refetch });
    const { getByText } = render(<ClubInviteScreen />);
    fireEvent.press(getByText('Retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('returns through the existing club navigation fallback', () => {
    const { getByTestId } = render(<ClubInviteScreen />);
    fireEvent.press(getByTestId('invite-readers-back'));
    expect(navigateBackOrFallback).toHaveBeenCalledWith(expect.anything(), '/clubs/club-invite');
  });
});
