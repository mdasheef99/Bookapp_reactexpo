/**
 * CLUB-WU-F04 — L3 service contract tests for reaction replacement persistence.
 *
 * PRODUCT-12: one reaction per actor per discussion target; A→B replaces;
 * SET is idempotent replacement (never toggles off).
 *
 * These tests freeze the client-side write-path contract:
 *  - SET goes through the set_club_discussion_reaction RPC (no direct table upsert);
 *  - actor identity is server-derived (no user_id argument);
 *  - no client-side delete-old choreography exists;
 *  - canonical returned rows map to the domain shape;
 *  - REMOVE retains the emoji compare-and-delete filter.
 */
jest.mock('@/lib/supabase');
jest.mock('@/features/auth/services/profileService', () => ({
    profileService: { getProfileSummaries: jest.fn().mockResolvedValue([]) },
}));

import { setClubDiscussionReaction, removeClubDiscussionReaction } from '../clubsDiscussionService';
import { supabase } from '@/lib/supabase';

const mockedSupabase = supabase as unknown as { rpc: jest.Mock };

function rpcResult(rows: Record<string, unknown>[], error: unknown = null) {
    return { data: rows, error };
}

const CANONICAL_ROW = {
    id: 'reaction-1',
    topic_id: 'topic-1',
    reply_id: null,
    user_id: 'user-1',
    emoji: '❤️',
    created_at: '2026-04-07T12:00:00Z',
};

describe('CLUB-WU-F04 — setClubDiscussionReaction (replacement RPC)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedSupabase.rpc = jest.fn();
    });

    it('topic target: calls set_club_discussion_reaction with exactly-one topic args and no user_id', async () => {
        mockedSupabase.rpc.mockResolvedValueOnce(rpcResult([CANONICAL_ROW]));

        await setClubDiscussionReaction({ topicId: 'topic-1', replyId: null, emoji: '❤️' });

        expect(mockedSupabase.rpc).toHaveBeenCalledTimes(1);
        expect(mockedSupabase.rpc).toHaveBeenCalledWith('set_club_discussion_reaction', {
            p_topic_id: 'topic-1',
            p_reply_id: null,
            p_emoji: '❤️',
        });
        const argKeys = Object.keys((mockedSupabase.rpc as jest.Mock).mock.calls[0][1]);
        expect(argKeys).not.toContain('p_user_id');
        expect(argKeys).not.toContain('user_id');
        // No direct table write path may be used anymore.
        expect(supabase.from).not.toHaveBeenCalledWith('club_discussion_reactions');
    });

    it('reply target: symmetric RPC args', async () => {
        mockedSupabase.rpc.mockResolvedValueOnce(rpcResult([{ ...CANONICAL_ROW, topic_id: null, reply_id: 'reply-1', emoji: '😂' }]));

        await setClubDiscussionReaction({ topicId: null, replyId: 'reply-1', emoji: '😂' });

        expect(mockedSupabase.rpc).toHaveBeenCalledWith('set_club_discussion_reaction', {
            p_topic_id: null,
            p_reply_id: 'reply-1',
            p_emoji: '😂',
        });
    });

    it('maps the canonical returned row to the domain shape', async () => {
        mockedSupabase.rpc.mockResolvedValueOnce(rpcResult([CANONICAL_ROW]));

        const result = await setClubDiscussionReaction({ topicId: 'topic-1', replyId: null, emoji: '❤️' });

        expect(result).toEqual({
            id: 'reaction-1',
            topic_id: 'topic-1',
            reply_id: null,
            user_id: 'user-1',
            emoji: '❤️',
            created_at: '2026-04-07T12:00:00Z',
        });
    });

    it('propagates server errors through established error behavior', async () => {
        mockedSupabase.rpc.mockResolvedValueOnce(rpcResult([], { message: 'RLS violation' }));

        await expect(
            setClubDiscussionReaction({ topicId: 'topic-1', replyId: null, emoji: '❤️' }),
        ).rejects.toThrow('Unable to save this discussion reaction right now.');
    });

    it('rejects empty payload when no row returns', async () => {
        mockedSupabase.rpc.mockResolvedValueOnce(rpcResult([]));

        await expect(
            setClubDiscussionReaction({ topicId: 'topic-1', replyId: null, emoji: '👍' }),
        ).rejects.toThrow();
    });

    it('rejects missing target before any RPC call', async () => {
        await expect(
            setClubDiscussionReaction({ topicId: null, replyId: null, emoji: '👍' }),
        ).rejects.toThrow('A discussion topic or reply target is required.');
        expect(mockedSupabase.rpc).not.toHaveBeenCalled();
    });
});

describe('CLUB-WU-F04 — removeClubDiscussionReaction (compare-and-delete preserved)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const chain = {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
        } as unknown as Record<string, jest.Mock>;
        (supabase.from as jest.Mock).mockReturnValue(chain as never);
    });

    it('retains the emoji predicate plus actor and target filters (stale-device protection)', async () => {
        await removeClubDiscussionReaction('❤️', 'topic-1', undefined);

        expect(supabase.from).toHaveBeenCalledWith('club_discussion_reactions');
        const fromChain = (supabase.from as jest.Mock).mock.results[0].value;
        const eqCalls = fromChain.eq.mock.calls.map((c: unknown[]) => c[0]);
        // actor + emoji + exactly one target column must all be filtered.
        expect(eqCalls).toContain('user_id');
        expect(eqCalls).toContain('emoji');
        expect(eqCalls).toContain('topic_id');
        expect(eqCalls).not.toContain('reply_id');
    });

    it('reply variant filters reply_id instead of topic_id', async () => {
        await removeClubDiscussionReaction('🔥', null, 'reply-9');

        const fromChain = (supabase.from as jest.Mock).mock.results[0].value;
        const eqCalls = fromChain.eq.mock.calls.map((c: unknown[]) => c[0]);
        expect(eqCalls).toContain('reply_id');
        expect(eqCalls).not.toContain('topic_id');
    });
});
