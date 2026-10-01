import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { navigateBackOrFallback } from '@/lib/navigation';
import ClubDiscussionThreadScreen from '../ClubDiscussionThreadScreen';

const mockRouterBack = jest.fn();
const mockUseAuth = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubDiscussionTopic = jest.fn();
const mockUseCreateClubDiscussionReply = jest.fn();
const mockUseSetClubDiscussionVote = jest.fn();
const mockUseRemoveClubDiscussionVote = jest.fn();
const mockUseSetClubDiscussionReaction = jest.fn();
const mockUseRemoveClubDiscussionReaction = jest.fn();
const mockUseReportClubDiscussionContent = jest.fn();
const mockUseMarkClubDiscussionTopicRead = jest.fn();
let mockReactionAnchor = { x: 12, y: 100, width: 44, height: 44 };

function prepareReactionAnchor(button: ReturnType<ReturnType<typeof render>['getByTestId']>) {
    let node: typeof button | null = button;
    while (node) {
        if (node.instance && typeof node.instance.measureInWindow === 'function') {
            jest.spyOn(node.instance, 'measureInWindow').mockImplementation((...args: unknown[]) => {
                const callback = args[0] as (x: number, y: number, width: number, height: number) => void;
                callback(mockReactionAnchor.x, mockReactionAnchor.y, mockReactionAnchor.width, mockReactionAnchor.height);
            });
            return;
        }
        node = node.parent;
    }
    throw new Error('No measurable reaction button found');
}
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
    useRemoveClubDiscussionVote: (...args: unknown[]) => mockUseRemoveClubDiscussionVote(...args),
    useSetClubDiscussionReaction: (...args: unknown[]) => mockUseSetClubDiscussionReaction(...args),
    useRemoveClubDiscussionReaction: (...args: unknown[]) => mockUseRemoveClubDiscussionReaction(...args),
    useReportClubDiscussionContent: (...args: unknown[]) => mockUseReportClubDiscussionContent(...args),
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
    mockUseRemoveClubDiscussionVote.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
    mockUseSetClubDiscussionReaction.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
    mockUseRemoveClubDiscussionReaction.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
    mockUseReportClubDiscussionContent.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
    mockUseMarkClubDiscussionTopicRead.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
});

describe('ClubDiscussionThreadScreen', () => {
    it('uses the approved conversation-first hierarchy for the topic and replies', () => {
        const { getByTestId, queryByText, getByText } = render(<ClubDiscussionThreadScreen />);

        expect(getByTestId('discussion-club-context')).toHaveTextContent('AUTHOR CIRCLE');
        expect(getByText('Chapter 4 reactions')).toBeOnTheScreen();
        expect(queryByText('Discussion thread')).toBeNull();
        expect(getByTestId('discussion-replies-header')).toBeOnTheScreen();
        expect(getByTestId('discussion-replies-header')).toHaveTextContent(/Replies/);
        expect(getByTestId('discussion-replies-count')).toHaveTextContent('2');
        expect(within(getByTestId('discussion-replies-header')).getByTestId('discussion-topic-mark-read-topic-1')).toBeOnTheScreen();
        expect(getByTestId('discussion-topic-reply-topic-1')).toBeOnTheScreen();
        expect(getByTestId('discussion-topic-report-open-topic-1')).toBeOnTheScreen();
    });

    it('lets an active member reply to a thread, vote, react through the picker, and mark the topic as read', async () => {
        const createReply = jest.fn().mockResolvedValue({ topic_id: 'topic-1' });
        const setVote = jest.fn().mockResolvedValue({});
        const setReaction = jest.fn().mockResolvedValue({});
        const markRead = jest.fn().mockResolvedValue({});
        mockUseCreateClubDiscussionReply.mockReturnValue({ mutateAsync: createReply, isPending: false });
        mockUseSetClubDiscussionVote.mockReturnValue({ mutateAsync: setVote, isPending: false });
        mockUseSetClubDiscussionReaction.mockReturnValue({ mutateAsync: setReaction, isPending: false });
        mockUseMarkClubDiscussionTopicRead.mockReturnValue({ mutateAsync: markRead, isPending: false });

        const { getByTestId, getAllByText, getByText } = render(<ClubDiscussionThreadScreen />);

        fireEvent.press(getByTestId('discussion-reply-target-reply-1'));
        expect(within(getByTestId('discussion-reply-node-reply-1')).getByTestId('discussion-inline-composer')).toBeOnTheScreen();
        expect(getAllByText('Replying to Reader Two').length).toBeGreaterThan(0);
        fireEvent.changeText(getByTestId('discussion-reply-body-topic-1'), 'I loved how tense it felt.');
        fireEvent.press(getByTestId('discussion-reply-submit-topic-1'));
        await waitFor(() => expect(createReply).toHaveBeenCalledWith({ clubId: 'club-1', input: { topicId: 'topic-1', parentReplyId: 'reply-1', body: 'I loved how tense it felt.' }, userId: 'reader-1' }));

        fireEvent.press(getByTestId('discussion-topic-upvote-topic-1'));
        await waitFor(() => expect(setVote).toHaveBeenCalledWith({ clubId: 'club-1', parentTopicId: 'topic-1', topicId: 'topic-1', replyId: undefined, voteType: 'upvote', userId: 'reader-1' }));

        prepareReactionAnchor(getByTestId('discussion-reaction-picker-open-topic-1'));
        fireEvent.press(getByTestId('discussion-reaction-picker-open-topic-1'));
        fireEvent.press(getByTestId('discussion-reaction-option-topic-1-👍'));
        await waitFor(() => expect(setReaction).toHaveBeenCalledWith({ clubId: 'club-1', parentTopicId: 'topic-1', topicId: 'topic-1', replyId: null, emoji: '👍', userId: 'reader-1' }));

        fireEvent.press(getByTestId('discussion-topic-mark-read-topic-1'));
        await waitFor(() => expect(markRead).toHaveBeenCalledWith({ clubId: 'club-1', topicId: 'topic-1', userId: 'reader-1' }));
    }, 10000);

    it('keeps the compact editor stable while growing, clearing, and reporting smaller web measurements', () => {
        const { getByTestId } = render(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByTestId('discussion-reply-target-reply-1'));
        const input = getByTestId('discussion-reply-body-topic-1');
        expect(input).toHaveStyle({ height: 64 });
        fireEvent.changeText(input, 'A long draft');
        fireEvent(input, 'contentSizeChange', { nativeEvent: { contentSize: { height: 220, width: 250 } } });
        expect(input).toHaveStyle({ height: 180 });
        fireEvent(input, 'contentSizeChange', { nativeEvent: { contentSize: { height: 178, width: 250 } } });
        expect(input).toHaveStyle({ height: 180 });
        fireEvent.changeText(input, '');
        fireEvent(input, 'contentSizeChange', { nativeEvent: { contentSize: { height: 178, width: 250 } } });
        expect(input).toHaveStyle({ height: 64 });
        expect(getByTestId('discussion-reply-submit-topic-1')).toBeDisabled();
    });

    it('anchors the picker within the left edge and dismisses it from outside', () => {
        mockReactionAnchor = { x: 0, y: 100, width: 44, height: 44 };
        const { getByTestId, queryByTestId } = render(<ClubDiscussionThreadScreen />);
        prepareReactionAnchor(getByTestId('discussion-reaction-picker-open-reply-1'));
        fireEvent.press(getByTestId('discussion-reaction-picker-open-reply-1'));
        expect(getByTestId('discussion-reaction-picker')).toHaveStyle({ position: 'absolute', left: 12, top: 152 });
        expect(getByTestId('discussion-reaction-option-reply-1-🔥')).toBeOnTheScreen();
        fireEvent.press(getByTestId('discussion-reaction-picker-overlay'));
        expect(queryByTestId('discussion-reaction-picker')).toBeNull();
    });

    it('keeps the popover within the right and bottom viewport edges', () => {
        mockReactionAnchor = { x: 10000, y: 10000, width: 44, height: 44 };
        const { getByTestId } = render(<ClubDiscussionThreadScreen />);
        prepareReactionAnchor(getByTestId('discussion-reaction-picker-open-reply-1'));
        fireEvent.press(getByTestId('discussion-reaction-picker-open-reply-1'));
        const style = StyleSheet.flatten(getByTestId('discussion-reaction-picker').props.style);
        const viewport = Dimensions.get('window');
        expect(style.left).toBeGreaterThanOrEqual(12);
        expect(style.top).toBeGreaterThanOrEqual(12);
        expect(style.left + style.width).toBeLessThanOrEqual(viewport.width - 12);
        expect(style.top + style.maxHeight).toBeLessThanOrEqual(viewport.height - 12);
    });

    it('shows reaction users in the detail sheet', () => {
        const { getByTestId, getAllByText, getByText } = render(<ClubDiscussionThreadScreen />);

        fireEvent.press(getByTestId('discussion-reaction-summary-reply-1-🔥'));

        expect(getByTestId('discussion-reaction-detail-sheet')).toBeOnTheScreen();
        expect(getAllByText('Reader Two').length).toBeGreaterThan(0);
        expect(getByText('@readertwo')).toBeOnTheScreen();
    });

    it('renders nested replies as a threaded branch with replying-to context', () => {
        const { getByTestId, getByText } = render(<ClubDiscussionThreadScreen />);

        expect(getByTestId('discussion-reply-node-reply-1')).toBeOnTheScreen();
        expect(getByTestId('discussion-reply-node-reply-2')).toBeOnTheScreen();
        expect(getByText('Replying to Reader Two')).toBeOnTheScreen();
        expect(getByText('Same, especially the last page.')).toBeOnTheScreen();
    });

    it('targets the reply (not the route topic) when un-reacting to a reply reaction', async () => {
        const removeReaction = jest.fn().mockResolvedValue({});
        mockUseRemoveClubDiscussionReaction.mockReturnValue({ mutateAsync: removeReaction, isPending: false });
        mockUseClubDiscussionTopic.mockReturnValue({
            data: {
                ...baseTopic,
                replies: baseTopic.replies.map((reply) => reply.id === 'reply-1'
                    ? { ...reply, reactions: [{ emoji: '🔥', count: 2, viewerReacted: true, users: [{ userId: 'reader-1', displayName: 'Reader One', username: 'readerone' }] }] }
                    : reply),
            },
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });

        const { getByTestId } = render(<ClubDiscussionThreadScreen />);

        fireEvent.press(getByTestId('discussion-reaction-summary-reply-1-🔥'));

        await waitFor(() => expect(removeReaction).toHaveBeenCalledWith({
            clubId: 'club-1',
            parentTopicId: 'topic-1',
            topicId: undefined,
            replyId: 'reply-1',
            emoji: '🔥',
            userId: 'reader-1',
        }));
        expect(removeReaction).not.toHaveBeenCalledWith(expect.objectContaining({ topicId: 'topic-1' }));
    });

    it('still targets the route topic when un-reacting to a topic reaction', async () => {
        const removeReaction = jest.fn().mockResolvedValue({});
        mockUseRemoveClubDiscussionReaction.mockReturnValue({ mutateAsync: removeReaction, isPending: false });
        mockUseClubDiscussionTopic.mockReturnValue({
            data: {
                ...baseTopic,
                reactions: [{ emoji: '👍', count: 2, viewerReacted: true, users: [{ userId: 'reader-1', displayName: 'Reader One', username: 'readerone' }] }],
            },
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });

        const { getByTestId } = render(<ClubDiscussionThreadScreen />);

        fireEvent.press(getByTestId('discussion-reaction-summary-topic-1-👍'));

        await waitFor(() => expect(removeReaction).toHaveBeenCalledWith({
            clubId: 'club-1',
            parentTopicId: 'topic-1',
            topicId: 'topic-1',
            replyId: null,
            emoji: '👍',
            userId: 'reader-1',
        }));
    });

    it('opens the editor within the selected nested reply and keeps the draft through cancel and reply target changes', () => {
        const { getByTestId, queryByTestId } = render(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByTestId('discussion-reply-target-reply-2'));
        expect(within(getByTestId('discussion-reply-node-reply-2')).getByTestId('discussion-inline-composer')).toBeOnTheScreen();
        expect(queryByTestId('discussion-reply-sheet')).toBeNull();
        fireEvent.changeText(getByTestId('discussion-reply-body-topic-1'), 'An unfinished thought');
        fireEvent.press(getByTestId('discussion-reply-close'));
        expect(queryByTestId('discussion-inline-composer')).toBeNull();
        fireEvent.press(getByTestId('discussion-reply-target-reply-2'));
        expect(getByTestId('discussion-reply-body-topic-1').props.value).toBe('An unfinished thought');
        fireEvent.press(getByTestId('discussion-reply-cancel-reply-2'));
        expect(within(getByTestId('discussion-topic-topic-1')).getByTestId('discussion-inline-composer')).toBeOnTheScreen();
        expect(getByTestId('discussion-reply-body-topic-1').props.value).toBe('An unfinished thought');
    });

    it('keeps a failed reply and its target available for retry', async () => {
        const createReply = jest.fn().mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce({ topic_id: 'topic-1' });
        mockUseCreateClubDiscussionReply.mockReturnValue({ mutateAsync: createReply, isPending: false });
        const { getByTestId, queryByTestId } = render(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByTestId('discussion-reply-target-reply-2'));
        fireEvent.changeText(getByTestId('discussion-reply-body-topic-1'), '  A nested response  ');
        await act(async () => { fireEvent.press(getByTestId('discussion-reply-submit-topic-1')); });
        await waitFor(() => expect(within(getByTestId('discussion-inline-composer')).getByText('Connection interrupted')).toBeOnTheScreen());
        expect(getByTestId('discussion-reply-body-topic-1').props.value).toBe('  A nested response  ');
        await waitFor(() => expect(getByTestId('discussion-reply-submit-topic-1')).not.toBeDisabled());
        await act(async () => { fireEvent.press(getByTestId('discussion-reply-submit-topic-1')); });
        await waitFor(() => expect(queryByTestId('discussion-inline-composer')).toBeNull());
        expect(createReply).toHaveBeenLastCalledWith({ clubId: 'club-1', input: { topicId: 'topic-1', parentReplyId: 'reply-2', body: 'A nested response' }, userId: 'reader-1' });
    }, 15000);

    it('prevents duplicate submissions and target changes while a request is unresolved', async () => {
        let finish!: (value: { topic_id: string }) => void;
        const createReply = jest.fn(() => new Promise<{ topic_id: string }>((resolve) => { finish = resolve; }));
        mockUseCreateClubDiscussionReply.mockReturnValue({ mutateAsync: createReply, isPending: false });
        const { getByTestId } = render(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByTestId('discussion-reply-target-reply-2'));
        fireEvent.changeText(getByTestId('discussion-reply-body-topic-1'), 'Keep this target');
        fireEvent.press(getByTestId('discussion-reply-submit-topic-1'));
        fireEvent.press(getByTestId('discussion-reply-submit-topic-1'));
        fireEvent.press(getByTestId('discussion-reply-close'));
        fireEvent.press(getByTestId('discussion-reply-cancel-reply-2'));
        expect(createReply).toHaveBeenCalledTimes(1);
        expect(within(getByTestId('discussion-reply-node-reply-2')).getByTestId('discussion-inline-composer')).toBeOnTheScreen();
        expect(getByTestId('discussion-reply-body-topic-1').props.editable).toBe(false);
        await act(async () => { finish({ topic_id: 'topic-1' }); });
    });

    it('posts a topic reply with a null parent and rejects whitespace without a write', async () => {
        const createReply = jest.fn().mockResolvedValue({ topic_id: 'topic-1' });
        mockUseCreateClubDiscussionReply.mockReturnValue({ mutateAsync: createReply, isPending: false });
        const { getByTestId } = render(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByTestId('discussion-topic-reply-topic-1'));
        fireEvent.changeText(getByTestId('discussion-reply-body-topic-1'), '   ');
        fireEvent.press(getByTestId('discussion-reply-submit-topic-1'));
        expect(createReply).not.toHaveBeenCalled();
        fireEvent.changeText(getByTestId('discussion-reply-body-topic-1'), 'A topic response');
        fireEvent.press(getByTestId('discussion-reply-submit-topic-1'));
        await waitFor(() => expect(createReply).toHaveBeenCalledWith({ clubId: 'club-1', input: { topicId: 'topic-1', parentReplyId: null, body: 'A topic response' }, userId: 'reader-1' }));
    });

    it('inserts a plain-text quote without posting or changing the reply target', () => {
        const { getByTestId } = render(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByTestId('discussion-reply-target-reply-1'));
        fireEvent.press(getByTestId('discussion-reply-quote'));
        expect(getByTestId('discussion-reply-body-topic-1').props.value).toContain('“I loved how tense it felt.”');
        expect(mockUseCreateClubDiscussionReply().mutateAsync).not.toHaveBeenCalled();
    });

    it('never silently retargets a draft when its reply disappears', () => {
        const createReply = jest.fn();
        mockUseCreateClubDiscussionReply.mockReturnValue({ mutateAsync: createReply, isPending: false });
        const { getByTestId, rerender } = render(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByTestId('discussion-reply-target-reply-2'));
        fireEvent.changeText(getByTestId('discussion-reply-body-topic-1'), 'Preserve me');
        mockUseClubDiscussionTopic.mockReturnValue({ data: { ...baseTopic, replies: [baseTopic.replies[0]] }, isLoading: false, isError: false, refetch: jest.fn() });
        rerender(<ClubDiscussionThreadScreen />);
        expect(getByTestId('discussion-reply-body-topic-1').props.value).toBe('Preserve me');
        fireEvent.press(getByTestId('discussion-reply-submit-topic-1'));
        expect(createReply).not.toHaveBeenCalled();
        expect(getByTestId('discussion-inline-composer')).toHaveTextContent(/no longer available/);
    });

    it('caps visual indentation globally while keeping deep parent attribution', () => {
        const deepReplies = [baseTopic.replies[0], ...Array.from({ length: 6 }, (_, index) => ({ ...baseTopic.replies[1], id: `deep-${index}`, parent_reply_id: index ? `deep-${index - 1}` : 'reply-1', depth: index + 1 }))];
        mockUseClubDiscussionTopic.mockReturnValue({ data: { ...baseTopic, replies: deepReplies }, isLoading: false, isError: false, refetch: jest.fn() });
        const { getByTestId } = render(<ClubDiscussionThreadScreen />);
        expect(getByTestId('discussion-reply-node-deep-5')).toHaveStyle({ marginLeft: 28 });
        expect(within(getByTestId('discussion-reply-node-deep-4')).queryByTestId('discussion-reply-node-deep-5')).toBeNull();
        fireEvent.press(getByTestId('discussion-reply-target-deep-5'));
        expect(within(getByTestId('discussion-reply-node-deep-5')).getByTestId('discussion-inline-composer')).toBeOnTheScreen();
    });

    it('preserves muted-member and deleted-content participation gates', () => {
        mockUseClubMembership.mockReturnValue({ data: { status: 'muted' }, isLoading: false });
        const { queryByTestId, rerender } = render(<ClubDiscussionThreadScreen />);
        expect(queryByTestId('discussion-topic-reply-topic-1')).toBeNull();
        expect(queryByTestId('discussion-reply-target-reply-1')).toBeNull();
        expect(queryByTestId('discussion-topic-mark-read-topic-1')).toBeOnTheScreen();
        mockUseClubMembership.mockReturnValue({ data: { status: 'active' }, isLoading: false });
        mockUseClubDiscussionTopic.mockReturnValue({ data: { ...baseTopic, is_deleted: true }, isLoading: false, isError: false, refetch: jest.fn() });
        rerender(<ClubDiscussionThreadScreen />);
        expect(queryByTestId('discussion-topic-reply-topic-1')).toBeNull();
        expect(queryByTestId('discussion-reply-target-reply-1')).toBeNull();
    });

    it('returns to the existing discussion route', () => {
        const { getByLabelText } = render(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByLabelText('Back to discussion'));
        expect(navigateBackOrFallback).toHaveBeenCalledWith(expect.anything(), '/clubs/club-1/discussion');
    });

    it('does not let an old account request clear a new draft, even after switching back', async () => {
        let finish!: (value: { topic_id: string }) => void;
        const createReply = jest.fn(() => new Promise<{ topic_id: string }>((resolve) => { finish = resolve; }));
        mockUseCreateClubDiscussionReply.mockReturnValue({ mutateAsync: createReply, isPending: false });
        const { getByTestId, rerender } = render(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByTestId('discussion-reply-target-reply-1'));
        fireEvent.changeText(getByTestId('discussion-reply-body-topic-1'), 'Old account reply');
        fireEvent.press(getByTestId('discussion-reply-submit-topic-1'));
        mockUseAuth.mockReturnValue({ user: { id: 'reader-2' } });
        rerender(<ClubDiscussionThreadScreen />);
        mockUseAuth.mockReturnValue({ user: { id: 'reader-1' } });
        rerender(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByTestId('discussion-topic-reply-topic-1'));
        fireEvent.changeText(getByTestId('discussion-reply-body-topic-1'), 'New draft');
        await act(async () => { finish({ topic_id: 'topic-1' }); });
        expect(getByTestId('discussion-reply-body-topic-1').props.value).toBe('New draft');
        expect(within(getByTestId('discussion-topic-topic-1')).getByTestId('discussion-inline-composer')).toBeOnTheScreen();
        expect(createReply).toHaveBeenCalledTimes(1);
    });

    it('announces vote counts and selection and retains the active-vote removal contract', async () => {
        const removeVote = jest.fn().mockResolvedValue({});
        mockUseRemoveClubDiscussionVote.mockReturnValue({ mutateAsync: removeVote, isPending: false });
        mockUseClubDiscussionTopic.mockReturnValue({ data: { ...baseTopic, replies: [{ ...baseTopic.replies[0], viewerVote: 'upvote' }] }, isLoading: false, isError: false, refetch: jest.fn() });
        const { getByTestId } = render(<ClubDiscussionThreadScreen />);
        expect(getByTestId('discussion-reply-upvote-reply-1').props.accessibilityLabel).toBe('Upvote reply, 2 upvotes');
        expect(getByTestId('discussion-reply-upvote-reply-1').props.accessibilityState.selected).toBe(true);
        await act(async () => { fireEvent.press(getByTestId('discussion-reply-upvote-reply-1')); });
        expect(removeVote).toHaveBeenCalledWith({ clubId: 'club-1', parentTopicId: 'topic-1', topicId: undefined, replyId: 'reply-1', userId: 'reader-1' });
    });

    it('preserves topic and reply report target contracts', async () => {
        const report = jest.fn().mockResolvedValue({});
        mockUseReportClubDiscussionContent.mockReturnValue({ mutateAsync: report, isPending: false });
        const { getByTestId } = render(<ClubDiscussionThreadScreen />);
        fireEvent.press(getByTestId('discussion-topic-report-open-topic-1'));
        await act(async () => { fireEvent.press(getByTestId('discussion-report-reason-spoiler')); });
        expect(report).toHaveBeenLastCalledWith({ clubId: 'club-1', topicId: 'topic-1', replyId: null, reason: 'spoiler', userId: 'reader-1' });
        fireEvent.press(getByTestId('discussion-reply-report-open-reply-2'));
        await act(async () => { fireEvent.press(getByTestId('discussion-report-reason-abuse')); });
        expect(report).toHaveBeenLastCalledWith({ clubId: 'club-1', topicId: undefined, replyId: 'reply-2', reason: 'abuse', userId: 'reader-1' });
    });
});
