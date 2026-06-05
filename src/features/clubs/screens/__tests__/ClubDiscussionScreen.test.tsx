import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubDiscussionScreen from '../ClubDiscussionScreen';

const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockUseAuth = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubDiscussionTopics = jest.fn();
const mockUseCreateClubDiscussionTopic = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: {
        back: (...args: unknown[]) => mockRouterBack(...args),
        push: (...args: unknown[]) => mockRouterPush(...args),
    },
    useLocalSearchParams: () => ({ clubId: 'club-1' }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
    useClubDiscussionTopics: (...args: unknown[]) => mockUseClubDiscussionTopics(...args),
    useCreateClubDiscussionTopic: (...args: unknown[]) => mockUseCreateClubDiscussionTopic(...args),
}));
jest.mock('@/lib/navigation', () => ({
    navigateBackOrFallback: jest.fn(),
}));

const baseTopic = {
    id: 'topic-1',
    club_id: 'club-1',
    author_user_id: 'member-1',
    title: 'Chapter 4 reactions',
    body: 'What did everyone think about the ending?',
    is_deleted: false,
    is_edited: false,
    created_at: '2026-03-11T08:00:00.000Z',
    updated_at: '2026-03-11T08:00:00.000Z',
    deleted_at: null,
    last_replied_at: '2026-03-11T09:00:00.000Z',
    authorProfile: { id: 'profile-1', user_id: 'member-1', display_name: 'Reader One', username: 'readerone', avatar_url: null, trust_score: 4.6, city: 'Bengaluru' },
    replies: [{
        id: 'reply-1',
        topic_id: 'topic-1',
        parent_reply_id: null,
        author_user_id: 'member-2',
        body: 'I loved how tense it felt.',
        is_deleted: false,
        created_at: '2026-03-11T09:00:00.000Z',
        deleted_at: null,
        authorProfile: { id: 'profile-2', user_id: 'member-2', display_name: 'Reader Two', username: 'readertwo', avatar_url: null, trust_score: 4.1, city: 'Mumbai' },
        depth: 0,
        voteCount: 1,
        upvoteCount: 2,
        downvoteCount: 1,
        viewerVote: null,
        reactions: [],
    }],
    replyCount: 1,
    voteCount: 3,
    upvoteCount: 4,
    downvoteCount: 1,
    viewerVote: null,
    reactions: [],
    unreadReplyCount: 1,
    hasUnread: true,
    recentActivityAt: '2026-03-11T09:00:00.000Z',
};

beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'reader-1' } });
    mockUseClubPublicDetail.mockReturnValue({ data: { id: 'club-1', name: 'Author Circle' }, isLoading: false });
    mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
    mockUseClubDiscussionTopics.mockReturnValue({ data: [baseTopic], isLoading: false, isError: false, error: null, refetch: jest.fn() });
    mockUseCreateClubDiscussionTopic.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ club_id: 'club-1' }), isPending: false });
});

describe('ClubDiscussionScreen', () => {
    it('creates topics and opens a thread from the lighter topic list', async () => {
        const createTopic = jest.fn().mockResolvedValue({ club_id: 'club-1' });
        mockUseCreateClubDiscussionTopic.mockReturnValue({ mutateAsync: createTopic, isPending: false });

        const { getByTestId, getByText, queryByTestId } = render(<ClubDiscussionScreen />);

        expect(getByText('Topic list')).toBeOnTheScreen();
        expect(getByText('First reply')).toBeOnTheScreen();
        expect(queryByTestId('discussion-reply-node-reply-1')).toBeNull();

        fireEvent.changeText(getByTestId('discussion-topic-title'), 'Theme check-in');
        fireEvent.changeText(getByTestId('discussion-topic-body'), 'What themes stood out the most this week?');
        fireEvent.press(getByTestId('discussion-create-topic'));

        await waitFor(() => expect(createTopic).toHaveBeenCalledWith({ clubId: 'club-1', title: 'Theme check-in', body: 'What themes stood out the most this week?' }));

        fireEvent.press(getByTestId('discussion-topic-topic-1'));
        expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/discussion/topic-1');
    });

    it('shows read-only discussion access for muted members', () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'muted' }, isLoading: false });

        const { getByText, queryByTestId } = render(<ClubDiscussionScreen />);

        expect(getByText('Read-only discussion access')).toBeOnTheScreen();
        expect(queryByTestId('discussion-create-topic')).toBeNull();
    });

    it('shows a members-only gate when the signed-in user is not a club member', () => {
        mockUseClubMembership.mockReturnValue({ data: null, isLoading: false });

        const { getByText, queryByText } = render(<ClubDiscussionScreen />);

        expect(getByText('Members only')).toBeOnTheScreen();
        expect(queryByText('Recent discussion')).toBeNull();
    });

    it('shows a sign-in gate when the viewer is not authenticated', () => {
        mockUseAuth.mockReturnValue({ user: null });
        mockUseClubMembership.mockReturnValue({ data: null, isLoading: false });

        const { getByText, queryByText } = render(<ClubDiscussionScreen />);

        expect(getByText('Sign in required')).toBeOnTheScreen();
        expect(queryByText('Recent discussion')).toBeNull();
    });
});
