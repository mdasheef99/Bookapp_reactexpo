/**
 * WU-TC06 — Clubs discussion service contract tests (D1–D12).
 *
 * Mock boundary: Supabase client + profile service only. The service module
 * under test is never mocked. No live Supabase, no RLS/trigger reproduction.
 *
 * Primary set/remove reaction replacement coverage lives in
 * clubsDiscussionReactionRpc.test.ts; D7/D8 here assert only the shared
 * adapter contract (in_* keys) plus missing negative/error coverage.
 */
jest.mock('@/lib/supabase');
jest.mock('@/features/auth/services/profileService', () => ({
    profileService: { getProfileSummaries: jest.fn().mockResolvedValue([]) },
}));

import {
    createClubDiscussionReply,
    createClubDiscussionTopic,
    getClubDiscussionReports,
    getClubDiscussionTopic,
    getClubDiscussionTopics,
    markClubDiscussionTopicRead,
    removeClubDiscussionReaction,
    removeClubDiscussionVote,
    reportClubDiscussionContent,
    resolveClubDiscussionReport,
    setClubDiscussionReaction,
    setClubDiscussionVote,
} from '../clubsDiscussionService';
import { profileService } from '@/features/auth/services/profileService';
import { supabase } from '@/lib/supabase';

const mockedFrom = supabase.from as unknown as jest.Mock;
const mockedRpc = supabase.rpc as unknown as jest.Mock;
const mockedGetUser = supabase.auth.getUser as unknown as jest.Mock;
const mockedGetProfileSummaries = profileService.getProfileSummaries as unknown as jest.Mock;

const CHAIN_METHODS = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'in',
    'is',
    'order',
    'limit',
    'range',
    'single',
    'maybeSingle',
    'match',
    'or',
    'filter',
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChainBuilder = Record<string, jest.Mock> & { then: (resolve: (value: any) => void) => void };

function makeBuilder(response: { data: unknown; error: unknown }): ChainBuilder {
    const builder: Record<string, unknown> = {};
    CHAIN_METHODS.forEach((method) => {
        builder[method] = jest.fn(() => builder);
    });
    builder.then = (resolve: (value: unknown) => void) => resolve(response);
    return builder as unknown as ChainBuilder;
}

const TOPIC_ROW = {
    id: 'topic-1',
    club_id: 'club-1',
    author_user_id: 'user-1',
    title: 'Thread title',
    body: 'Thread body',
    is_deleted: false,
    is_edited: false,
    created_at: '2026-03-11T08:00:00.000Z',
    updated_at: '2026-03-11T08:00:00.000Z',
    deleted_at: null,
    last_replied_at: '2026-03-11T09:00:00.000Z',
};

const REPLY_ROW = {
    id: 'reply-1',
    topic_id: 'topic-1',
    parent_reply_id: null,
    author_user_id: 'user-2',
    body: 'Reply body',
    is_deleted: false,
    created_at: '2026-03-11T09:00:00.000Z',
    deleted_at: null,
};

beforeEach(() => {
    jest.clearAllMocks();
    mockedGetProfileSummaries.mockResolvedValue([]);
    mockedGetUser.mockResolvedValue({
        data: { user: { id: 'actor-1', email: 'actor@test.example' } },
        error: null,
    });
});

describe('D1 — getClubDiscussionTopics', () => {
    function fanOutBuilders() {
        return {
            topics: makeBuilder({ data: [TOPIC_ROW], error: null }),
            replies: makeBuilder({ data: [REPLY_ROW], error: null }),
            votes: makeBuilder({ data: [], error: null }),
            reactions: makeBuilder({ data: [], error: null }),
            reads: makeBuilder({ data: [], error: null }),
        };
    }

    it('queries club_discussion_topics scoped to the club with last_replied_at desc + created_at desc', async () => {
        const builders = fanOutBuilders();
        mockedFrom
            .mockReturnValueOnce(builders.topics)
            .mockReturnValueOnce(builders.replies)
            .mockReturnValueOnce(builders.votes)
            .mockReturnValueOnce(builders.reactions)
            .mockReturnValueOnce(builders.reads);

        await getClubDiscussionTopics('club-1', 'viewer-1');

        expect(mockedFrom).toHaveBeenNthCalledWith(1, 'club_discussion_topics');
        expect(builders.topics.eq).toHaveBeenCalledWith('club_id', 'club-1');
        expect(builders.topics.order).toHaveBeenCalledWith('last_replied_at', { ascending: false });
        expect(builders.topics.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('short-circuits fan-out queries when no topics exist', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: [], error: null }));

        await expect(getClubDiscussionTopics('club-1', 'viewer-1')).resolves.toEqual([]);
        expect(mockedFrom).toHaveBeenCalledTimes(1);
        expect(mockedGetProfileSummaries).not.toHaveBeenCalled();
    });

    it('targets replies at the listed topic ids and reads at the explicit viewer', async () => {
        const builders = fanOutBuilders();
        mockedFrom
            .mockReturnValueOnce(builders.topics)
            .mockReturnValueOnce(builders.replies)
            .mockReturnValueOnce(builders.votes)
            .mockReturnValueOnce(builders.reactions)
            .mockReturnValueOnce(builders.reads);

        await getClubDiscussionTopics('club-1', 'viewer-1');

        expect(mockedFrom).toHaveBeenNthCalledWith(2, 'club_discussion_replies');
        expect(builders.replies.in).toHaveBeenCalledWith('topic_id', ['topic-1']);
        expect(builders.reads.eq).toHaveBeenCalledWith('user_id', 'viewer-1');
        expect(builders.reads.in).toHaveBeenCalledWith('topic_id', ['topic-1']);
    });

    it('does not silently swallow fan-out errors', async () => {
        const builders = fanOutBuilders();
        const votesError = { message: 'votes exploded' };
        builders.votes = makeBuilder({ data: null, error: votesError });
        mockedFrom
            .mockReturnValueOnce(builders.topics)
            .mockReturnValueOnce(builders.replies)
            .mockReturnValueOnce(builders.votes)
            .mockReturnValueOnce(builders.reactions)
            .mockReturnValueOnce(builders.reads);

        await expect(getClubDiscussionTopics('club-1', 'viewer-1')).rejects.toBe(votesError);
    });

    it('surfaces the topics-query error', async () => {
        const topicsError = { message: 'topics exploded' };
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: topicsError }));

        await expect(getClubDiscussionTopics('club-1')).rejects.toBe(topicsError);
    });
});

describe('D2 — getClubDiscussionTopic', () => {
    function singleTopicBuilders() {
        return {
            topic: makeBuilder({ data: TOPIC_ROW, error: null }),
            replies: makeBuilder({ data: [REPLY_ROW], error: null }),
            votes: makeBuilder({ data: [], error: null }),
            reactions: makeBuilder({ data: [], error: null }),
            reads: makeBuilder({ data: [], error: null }),
        };
    }

    it('looks up the topic by exact id with .single() and scopes replies/votes to it', async () => {
        const builders = singleTopicBuilders();
        mockedFrom
            .mockReturnValueOnce(builders.topic)
            .mockReturnValueOnce(builders.replies)
            .mockReturnValueOnce(builders.votes)
            .mockReturnValueOnce(builders.reactions)
            .mockReturnValueOnce(builders.reads);

        const result = await getClubDiscussionTopic('topic-1', 'viewer-1');

        expect(mockedFrom).toHaveBeenNthCalledWith(1, 'club_discussion_topics');
        expect(builders.topic.eq).toHaveBeenCalledWith('id', 'topic-1');
        expect(builders.topic.single).toHaveBeenCalled();
        expect(builders.replies.eq).toHaveBeenCalledWith('topic_id', 'topic-1');
        const voteOrFilter = builders.votes.or.mock.calls[0][0] as string;
        expect(voteOrFilter).toContain('topic-1');
        expect(voteOrFilter).toContain('reply-1');
        const reactionOrFilter = builders.reactions.or.mock.calls[0][0] as string;
        expect(reactionOrFilter).toContain('topic-1');
        expect(reactionOrFilter).toContain('reply-1');
        expect(result.id).toBe('topic-1');
    });

    it('reads viewer state with the correct topic/user pair', async () => {
        const builders = singleTopicBuilders();
        mockedFrom
            .mockReturnValueOnce(builders.topic)
            .mockReturnValueOnce(builders.replies)
            .mockReturnValueOnce(builders.votes)
            .mockReturnValueOnce(builders.reactions)
            .mockReturnValueOnce(builders.reads);

        await getClubDiscussionTopic('topic-1', 'viewer-9');

        expect(builders.reads.eq).toHaveBeenCalledWith('user_id', 'viewer-9');
        expect(builders.reads.eq).toHaveBeenCalledWith('topic_id', 'topic-1');
    });

    it('surfaces a missing/errored topic as an error', async () => {
        const topicError = { message: 'topic missing' };
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: topicError }));

        await expect(getClubDiscussionTopic('topic-404')).rejects.toBe(topicError);
    });
});

describe('D3 — createClubDiscussionTopic', () => {
    it('inserts with the service-derived author, trimmed fields, and a generated timestamp', async () => {
        const builder = makeBuilder({ data: TOPIC_ROW, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        const result = await createClubDiscussionTopic({
            clubId: 'club-1',
            title: '  Thread title  ',
            body: '  Thread body  ',
        });

        expect(mockedFrom).toHaveBeenCalledWith('club_discussion_topics');
        expect(builder.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                club_id: 'club-1',
                author_user_id: 'actor-1',
                title: 'Thread title',
                body: 'Thread body',
            }),
        );
        const payload = builder.insert.mock.calls[0][0] as Record<string, unknown>;
        expect(typeof payload.last_replied_at).toBe('string');
        expect(builder.single).toHaveBeenCalled();
        expect(result).toEqual(TOPIC_ROW);
    });

    it('rejects blank title/body before any write', async () => {
        await expect(
            createClubDiscussionTopic({ clubId: 'club-1', title: '   ', body: 'body' }),
        ).rejects.toThrow('Topic title is required.');
        await expect(
            createClubDiscussionTopic({ clubId: 'club-1', title: 'title', body: '   ' }),
        ).rejects.toThrow('Topic body is required.');
        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('wraps write errors', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' } }));

        await expect(
            createClubDiscussionTopic({ clubId: 'club-1', title: 't', body: 'b' }),
        ).rejects.toThrow('Unable to create this discussion topic right now.');
    });
});

describe('D4 — createClubDiscussionReply', () => {
    it('inserts with topic, explicit parent, service-derived author, and trimmed body', async () => {
        const builder = makeBuilder({ data: REPLY_ROW, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        const result = await createClubDiscussionReply({
            topicId: 'topic-1',
            parentReplyId: 'reply-0',
            body: '  Reply body  ',
        });

        expect(mockedFrom).toHaveBeenCalledWith('club_discussion_replies');
        expect(builder.insert).toHaveBeenCalledWith({
            topic_id: 'topic-1',
            parent_reply_id: 'reply-0',
            author_user_id: 'actor-1',
            body: 'Reply body',
        });
        expect(builder.single).toHaveBeenCalled();
        expect(result).toEqual(REPLY_ROW);
    });

    it('sends a null parent when none is supplied', async () => {
        const builder = makeBuilder({ data: REPLY_ROW, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        await createClubDiscussionReply({ topicId: 'topic-1', body: 'Reply body' });

        expect(builder.insert).toHaveBeenCalledWith(
            expect.objectContaining({ parent_reply_id: null }),
        );
    });

    it('rejects blank bodies before any write', async () => {
        await expect(
            createClubDiscussionReply({ topicId: 'topic-1', body: '   ' }),
        ).rejects.toThrow('Reply body is required.');
        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('wraps write errors', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' } }));

        await expect(
            createClubDiscussionReply({ topicId: 'topic-1', body: 'hi' }),
        ).rejects.toThrow('Unable to post this reply right now.');
    });
});

describe('D5 — setClubDiscussionVote', () => {
    const voteRow = {
        id: 'vote-1',
        topic_id: 'topic-1',
        reply_id: null,
        user_id: 'actor-1',
        vote_type: 'upvote',
        created_at: null,
    };

    it('topic variant upserts with onConflict topic_id,user_id', async () => {
        const builder = makeBuilder({ data: voteRow, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        const result = await setClubDiscussionVote({ topicId: 'topic-1', voteType: 'upvote' });

        expect(mockedFrom).toHaveBeenCalledWith('club_discussion_votes');
        expect(builder.upsert).toHaveBeenCalledWith(
            { topic_id: 'topic-1', reply_id: null, user_id: 'actor-1', vote_type: 'upvote' },
            { onConflict: 'topic_id,user_id' },
        );
        expect(builder.single).toHaveBeenCalled();
        expect(result).toEqual(voteRow);
    });

    it('reply variant upserts with onConflict reply_id,user_id', async () => {
        const replyVoteRow = { ...voteRow, topic_id: null, reply_id: 'reply-1' };
        const builder = makeBuilder({ data: replyVoteRow, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        await setClubDiscussionVote({ replyId: 'reply-1', voteType: 'downvote' });

        expect(builder.upsert).toHaveBeenCalledWith(
            { topic_id: null, reply_id: 'reply-1', user_id: 'actor-1', vote_type: 'downvote' },
            { onConflict: 'reply_id,user_id' },
        );
    });

    it('rejects a missing target before any write', async () => {
        await expect(setClubDiscussionVote({ voteType: 'upvote' })).rejects.toThrow(
            'A discussion topic or reply target is required.',
        );
        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('wraps write errors', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' } }));

        await expect(
            setClubDiscussionVote({ topicId: 'topic-1', voteType: 'upvote' }),
        ).rejects.toThrow('Unable to update your discussion vote right now.');
    });
});

describe('D6 — removeClubDiscussionVote', () => {
    it('topic delete is scoped by user_id + topic_id only', async () => {
        const builder = makeBuilder({ data: null, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        await removeClubDiscussionVote('topic-1', null);

        expect(mockedFrom).toHaveBeenCalledWith('club_discussion_votes');
        expect(builder.delete).toHaveBeenCalled();
        expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor-1');
        expect(builder.eq).toHaveBeenCalledWith('topic_id', 'topic-1');
        const columns = (builder.eq.mock.calls as Array<[string, unknown]>).map(([column]) => column);
        expect(columns).not.toContain('reply_id');
    });

    it('reply delete is scoped by user_id + reply_id only', async () => {
        const builder = makeBuilder({ data: null, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        await removeClubDiscussionVote(null, 'reply-1');

        expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor-1');
        expect(builder.eq).toHaveBeenCalledWith('reply_id', 'reply-1');
        const columns = (builder.eq.mock.calls as Array<[string, unknown]>).map(([column]) => column);
        expect(columns).not.toContain('topic_id');
    });

    it('wraps delete errors', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' } }));

        await expect(removeClubDiscussionVote('topic-1', null)).rejects.toThrow(
            'Unable to remove your discussion vote right now.',
        );
    });
});

describe('D7 — setClubDiscussionReaction (shared adapter contract)', () => {
    const reactionRow = {
        id: 'reaction-1',
        topic_id: 'topic-1',
        reply_id: null,
        user_id: 'actor-1',
        emoji: '❤️',
        created_at: '2026-04-07T12:00:00Z',
    };

    it('topic variant uses in_* keys with no p_* and no user_id', async () => {
        mockedRpc.mockResolvedValueOnce({ data: [reactionRow], error: null });

        await setClubDiscussionReaction({ topicId: 'topic-1', replyId: null, emoji: '❤️' });

        expect(mockedRpc).toHaveBeenCalledWith('set_club_discussion_reaction', {
            in_topic_id: 'topic-1',
            in_reply_id: null,
            in_emoji: '❤️',
        });
        const payload = mockedRpc.mock.calls[0][1] as Record<string, unknown>;
        expect(payload).not.toHaveProperty('p_topic_id');
        expect(payload).not.toHaveProperty('p_reply_id');
        expect(payload).not.toHaveProperty('p_emoji');
        expect(payload).not.toHaveProperty('user_id');
    });

    it('reply variant uses in_* keys with no p_* and no user_id', async () => {
        mockedRpc.mockResolvedValueOnce({
            data: [{ ...reactionRow, topic_id: null, reply_id: 'reply-1' }],
            error: null,
        });

        await setClubDiscussionReaction({ topicId: null, replyId: 'reply-1', emoji: '🔥' });

        expect(mockedRpc).toHaveBeenCalledWith('set_club_discussion_reaction', {
            in_topic_id: null,
            in_reply_id: 'reply-1',
            in_emoji: '🔥',
        });
    });
});

describe('D8 — removeClubDiscussionReaction (negative coverage)', () => {
    it('reply variant filters reply_id instead of topic_id', async () => {
        const builder = makeBuilder({ data: null, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        await removeClubDiscussionReaction('🔥', null, 'reply-9');

        const columns = (builder.eq.mock.calls as Array<[string, unknown]>).map(([column]) => column);
        expect(columns).toContain('reply_id');
        expect(columns).not.toContain('topic_id');
    });

    it('wraps delete errors', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' } }));

        await expect(removeClubDiscussionReaction('❤️', 'topic-1', null)).rejects.toThrow(
            'Unable to remove this discussion reaction right now.',
        );
    });

    it('rejects a missing target before any delete', async () => {
        await expect(removeClubDiscussionReaction('❤️', null, null)).rejects.toThrow(
            'A discussion topic or reply target is required.',
        );
        expect(mockedFrom).not.toHaveBeenCalled();
    });
});

describe('D9 — reportClubDiscussionContent', () => {
    const reportRow = {
        id: 'report-1',
        topic_id: 'topic-1',
        reply_id: null,
        reporter_user_id: 'actor-1',
        reason: 'spam',
        details: null,
        status: 'open',
        created_at: '2026-03-12T00:00:00.000Z',
        resolved_at: null,
        resolved_by: null,
    };

    it('topic variant maps topic/reporter/reason with normalized details', async () => {
        const builder = makeBuilder({ data: reportRow, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        const result = await reportClubDiscussionContent({
            topicId: 'topic-1',
            reason: 'spam',
            details: '  repeated links  ',
        });

        expect(mockedFrom).toHaveBeenCalledWith('club_discussion_reports');
        expect(builder.insert).toHaveBeenCalledWith({
            topic_id: 'topic-1',
            reply_id: null,
            reporter_user_id: 'actor-1',
            reason: 'spam',
            details: 'repeated links',
        });
        expect(builder.single).toHaveBeenCalled();
        expect(result).toEqual(reportRow);
    });

    it('reply variant maps reply target and normalizes whitespace-only details to null', async () => {
        const builder = makeBuilder({
            data: { ...reportRow, topic_id: null, reply_id: 'reply-1' },
            error: null,
        });
        mockedFrom.mockReturnValueOnce(builder);

        await reportClubDiscussionContent({ replyId: 'reply-1', reason: 'abuse', details: '   ' });

        expect(builder.insert).toHaveBeenCalledWith(
            expect.objectContaining({ topic_id: null, reply_id: 'reply-1', details: null }),
        );
    });

    it('rejects a missing target before any write', async () => {
        await expect(reportClubDiscussionContent({ reason: 'spam' })).rejects.toThrow(
            'A discussion topic or reply target is required.',
        );
        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('wraps write errors', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' } }));

        await expect(
            reportClubDiscussionContent({ topicId: 'topic-1', reason: 'spam' }),
        ).rejects.toThrow('Unable to report this discussion content right now.');
    });
});

describe('D10 — markClubDiscussionTopicRead', () => {
    const readRow = {
        topic_id: 'topic-1',
        user_id: 'viewer-7',
        last_read_at: '2026-03-12T00:00:00.000Z',
        unread_reply_count: 0,
    };

    it('explicit userId is used directly without an auth lookup', async () => {
        const builder = makeBuilder({ data: readRow, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        const result = await markClubDiscussionTopicRead('topic-1', 'viewer-7');

        expect(mockedGetUser).not.toHaveBeenCalled();
        expect(builder.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                topic_id: 'topic-1',
                user_id: 'viewer-7',
                unread_reply_count: 0,
            }),
            { onConflict: 'topic_id,user_id' },
        );
        const payload = builder.upsert.mock.calls[0][0] as Record<string, unknown>;
        expect(typeof payload.last_read_at).toBe('string');
        expect(result).toEqual(readRow);
    });

    it('falls back to the current authenticated user', async () => {
        const builder = makeBuilder({
            data: { ...readRow, user_id: 'actor-1' },
            error: null,
        });
        mockedFrom.mockReturnValueOnce(builder);

        await markClubDiscussionTopicRead('topic-1');

        expect(mockedGetUser).toHaveBeenCalled();
        expect(builder.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ topic_id: 'topic-1', user_id: 'actor-1' }),
            { onConflict: 'topic_id,user_id' },
        );
    });

    it('wraps write errors', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' } }));

        await expect(markClubDiscussionTopicRead('topic-1', 'viewer-7')).rejects.toThrow(
            'Unable to update the unread state for this topic right now.',
        );
    });
});

describe('D11 — getClubDiscussionReports', () => {
    function reportRows() {
        return [
            {
                id: 'report-topic',
                topic_id: 'topic-1',
                reply_id: null,
                reporter_user_id: 'reporter-1',
                reason: 'spam',
                details: null,
                status: 'open',
                created_at: '2026-03-12T02:00:00.000Z',
                resolved_at: null,
                resolved_by: null,
                topic: { id: 'topic-1', club_id: 'club-1', title: 'T', body: null, author_user_id: 'u', is_deleted: false },
                reply: null,
            },
            {
                id: 'report-reply',
                topic_id: null,
                reply_id: 'reply-1',
                reporter_user_id: 'reporter-2',
                reason: 'abuse',
                details: null,
                status: 'open',
                created_at: '2026-03-12T01:00:00.000Z',
                resolved_at: null,
                resolved_by: null,
                topic: null,
                reply: {
                    id: 'reply-1',
                    topic_id: 'topic-2',
                    body: 'B',
                    author_user_id: 'u',
                    is_deleted: false,
                    topic: { id: 'topic-2', club_id: 'club-1', title: 'T2' },
                },
            },
            {
                id: 'report-other-club',
                topic_id: 'topic-9',
                reply_id: null,
                reporter_user_id: 'reporter-3',
                reason: 'spam',
                details: null,
                status: 'open',
                created_at: '2026-03-12T03:00:00.000Z',
                resolved_at: null,
                resolved_by: null,
                topic: { id: 'topic-9', club_id: 'club-OTHER', title: 'X', body: null, author_user_id: 'u', is_deleted: false },
                reply: null,
            },
        ];
    }

    it('defaults to open status with created_at desc and keeps only this club’s reports', async () => {
        const builder = makeBuilder({ data: reportRows(), error: null });
        mockedFrom.mockReturnValueOnce(builder);
        mockedGetProfileSummaries.mockResolvedValueOnce([
            { user_id: 'reporter-1', username: 'r1', display_name: 'R1', avatar_url: null },
            { user_id: 'reporter-2', username: 'r2', display_name: 'R2', avatar_url: null },
        ]);

        const results = await getClubDiscussionReports('club-1');

        expect(mockedFrom).toHaveBeenCalledWith('club_discussion_reports');
        expect(builder.eq).toHaveBeenCalledWith('status', 'open');
        expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(results.map((report) => report.id).sort()).toEqual(['report-reply', 'report-topic']);
        expect(results.find((report) => report.id === 'report-topic')?.reporterProfile).toEqual(
            expect.objectContaining({ user_id: 'reporter-1' }),
        );
    });

    it('supports an explicit resolved status filter', async () => {
        const builder = makeBuilder({ data: [], error: null });
        mockedFrom.mockReturnValueOnce(builder);

        await getClubDiscussionReports('club-1', 'resolved');

        expect(builder.eq).toHaveBeenCalledWith('status', 'resolved');
    });

    it('wraps read errors', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' } }));

        await expect(getClubDiscussionReports('club-1')).rejects.toThrow(
            'Unable to load discussion reports right now.',
        );
    });
});

describe('D12 — resolveClubDiscussionReport', () => {
    const resolvedRow = {
        id: 'report-1',
        topic_id: 'topic-1',
        reply_id: null,
        reporter_user_id: 'reporter-1',
        reason: 'spam',
        details: null,
        status: 'resolved',
        created_at: '2026-03-12T00:00:00.000Z',
        resolved_at: null,
        resolved_by: null,
    };

    it('updates exactly the report id to resolved without client-owned resolution metadata', async () => {
        const builder = makeBuilder({ data: resolvedRow, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        const result = await resolveClubDiscussionReport('report-1');

        expect(mockedFrom).toHaveBeenCalledWith('club_discussion_reports');
        expect(builder.update).toHaveBeenCalledWith({ status: 'resolved' });
        const payload = builder.update.mock.calls[0][0] as Record<string, unknown>;
        expect(payload).not.toHaveProperty('resolved_at');
        expect(payload).not.toHaveProperty('resolved_by');
        expect(builder.eq).toHaveBeenCalledWith('id', 'report-1');
        expect(builder.single).toHaveBeenCalled();
        expect(result).toEqual(resolvedRow);
    });

    it('wraps write errors', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' } }));

        await expect(resolveClubDiscussionReport('report-1')).rejects.toThrow(
            'Unable to resolve this discussion report right now.',
        );
    });
});
