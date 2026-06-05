import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubDiscussionThreadScreen from '../ClubDiscussionThreadScreen';

const mockRouterBack = jest.fn();
const mockUseAuth = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubDiscussionTopic = jest.fn();
const mockUseCreateClubDiscussionReply = jest.fn();
const mockUseSetClubDiscussionVote = jest.fn();
const mockUseSetClubDiscussionReaction = jest.fn();
const mockUseMarkClubDiscussionTopicRead = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { back: (...args: unknown[]) => mockRouterBack(...args) },
    useLocalSearchParams: () => ({ clubId: 'club-1', topicId: 'topic-1' }),
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
    useClubDiscussionTopic: (...args: unknown[]) => mockUseClubDiscussionTopic(...args),
    useCreateClubDiscussionReply: (...args: unknown[]) => mockUseCreateClubDiscussionReply(...args),
    useSetClubDiscussionVote: (...args: unknown[]) => mockUseSetClubDiscussionVote(...args),
    useSetClubDiscussionReaction: (...args: unknown[]) => mockUseSetClubDiscussionReaction(...args),
    useMarkClubDiscussionTopicRead: (...args: unknown[]) => mockUseMarkClubDiscussionTopicRead(...args),
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
        reactions: [{ emoji: '🔥', count: 2, viewerReacted: false, users: [{ userId: 'reader-2', displayName: 'Reader Two', username: 'readertwo' }] }],
    }, {
        id: 'reply-2',
        topic_id: 'topic-1',
        parent_reply_id: 'reply-1',
        author_user_id: 'member-1',
        body: 'Same, especially the last page.',
        is_deleted: false,
        created_at: '2026-03-11T09:10:00.000Z',
        deleted_at: null,
        authorProfile: { id: 'profile-1', user_id: 'member-1', display_name: 'Reader One', username: 'readerone', avatar_url: null, trust_score: 4.6, city: 'Bengaluru' },
        depth: 1,
        voteCount: 0,
        upvoteCount: 0,
        downvoteCount: 0,
        viewerVote: null,
        reactions: [],
    }],
    replyCount: 2,
    voteCount: 3,
    upvoteCount: 4,
    downvoteCount: 1,
    viewerVote: null,
    reactions: [{ emoji: '👍', count: 2, viewerReacted: false, users: [{ userId: 'reader-3', displayName: 'Reader Three', username: 'readerthree' }] }],
    unreadReplyCount: 1,
    hasUnread: true,
    recentActivityAt: '2026-03-11T09:00:00.000Z',
};

beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'reader-1' } });
    mockUseClubPublicDetail.mockReturnValue({ data: { id: 'club-1', name: 'Author Circle' }, isLoading: false });
    mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
    mockUseClubDiscussionTopic.mockReturnValue({ data: baseTopic, isLoading: false, isError: false, error: null, refetch: jest.fn() });
    mockUseCreateClubDiscussionReply.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ topic_id: 'topic-1' }), isPending: false });
    mockUseSetClubDiscussionVote.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
    mockUseSetClubDiscussionReaction.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
    mockUseMarkClubDiscussionTopicRead.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
});

describe('ClubDiscussionThreadScreen', () => {
    it('lets an active member reply to a thread, vote, react through the picker, and mark the topic as read', async () => {
        const createReply = jest.fn().mockResolvedValue({ topic_id: 'topic-1' });
        const setVote = jest.fn().mockResolvedValue({});
        const setReaction = jest.fn().mockResolvedValue({});
        const markRead = jest.fn().mockResolvedValue({});
        mockUseCreateClubDiscussionReply.mockReturnValue({ mutateAsync: createReply, isPending: false });
        mockUseSetClubDiscussionVote.mockReturnValue({ mutateAsync: setVote, isPending: false });
        mockUseSetClubDiscussionReaction.mockReturnValue({ mutateAsync: setReaction, isPending: false });
        mockUseMarkClubDiscussionTopicRead.mockReturnValue({ mutateAsync: markRead, isPending: false });

        const { getByTestId, getAllByText } = render(<ClubDiscussionThreadScreen />);

        fireEvent.press(getByTestId('discussion-reply-target-reply-1'));
        expect(getByTestId('discussion-reply-sheet')).toBeOnTheScreen();
        expect(getAllByText('Replying to Reader Two').length).toBeGreaterThan(0);
        fireEvent.changeText(getByTestId('discussion-reply-body-topic-1'), 'I loved how tense it felt.');
        fireEvent.press(getByTestId('discussion-reply-submit-topic-1'));
        await waitFor(() => expect(createReply).toHaveBeenCalledWith({ clubId: 'club-1', input: { topicId: 'topic-1', parentReplyId: 'reply-1', body: 'I loved how tense it felt.' }, userId: 'reader-1' }));

        fireEvent.press(getByTestId('discussion-topic-upvote-topic-1'));
        await waitFor(() => expect(setVote).toHaveBeenCalledWith({ clubId: 'club-1', topicId: 'topic-1', replyId: undefined, voteType: 'upvote', userId: 'reader-1' }));

        fireEvent.press(getByTestId('discussion-reaction-picker-open-topic-1'));
        fireEvent.press(getByTestId('discussion-reaction-option-topic-1-👍'));
        await waitFor(() => expect(setReaction).toHaveBeenCalledWith({ clubId: 'club-1', topicId: 'topic-1', replyId: null, emoji: '👍', userId: 'reader-1' }));

        fireEvent.press(getByTestId('discussion-topic-mark-read-topic-1'));
        await waitFor(() => expect(markRead).toHaveBeenCalledWith({ clubId: 'club-1', topicId: 'topic-1', userId: 'reader-1' }));
    }, 10000);

    it('shows reaction users in the detail sheet', () => {
        const { getByTestId, getByText } = render(<ClubDiscussionThreadScreen />);

        fireEvent.press(getByTestId('discussion-reaction-summary-reply-1-🔥'));

        expect(getByTestId('discussion-reaction-detail-sheet')).toBeOnTheScreen();
        expect(getByText('Reader Two')).toBeOnTheScreen();
        expect(getByText('@readertwo')).toBeOnTheScreen();
    });

    it('renders nested replies as a threaded branch with replying-to context', () => {
        const { getByTestId, getByText } = render(<ClubDiscussionThreadScreen />);

        expect(getByTestId('discussion-reply-node-reply-1')).toBeOnTheScreen();
        expect(getByTestId('discussion-reply-node-reply-2')).toBeOnTheScreen();
        expect(getByText('Replying to Reader Two')).toBeOnTheScreen();
        expect(getByText('Same, especially the last page.')).toBeOnTheScreen();
    });
});
