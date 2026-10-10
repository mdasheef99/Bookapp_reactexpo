import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { clubKeys, useRemoveClubDiscussionVote, useSetClubDiscussionVote } from '../useClubs';
import { clubsService, type ClubDiscussionTopicWithDetails } from '../../services/clubsService';

jest.mock('../../services/clubsService', () => ({ clubsService: { setClubDiscussionVote: jest.fn(), removeClubDiscussionVote: jest.fn() } }));

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
    const key = clubKeys.discussionTopic('topic', 'user');
    client.setQueryData(key, { id: 'topic', viewerVote: null, upvoteCount: 2, downvoteCount: 1, voteCount: 1,
        replies: [{ id: 'reply', viewerVote: 'downvote', upvoteCount: 3, downvoteCount: 2, voteCount: 1 }] });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    return { client, key, wrapper, read: () => client.getQueryData<ClubDiscussionTopicWithDetails>(key)! };
}

describe('discussion vote optimistic feedback', () => {
    beforeEach(() => jest.clearAllMocks());

    it('updates a topic before the server completes without touching another account cache', async () => {
        const { client, key, wrapper, read } = setup();
        const otherKey = clubKeys.discussionTopic('topic', 'other');
        client.setQueryData(otherKey, read());
        let complete!: (value: unknown) => void;
        (clubsService.setClubDiscussionVote as jest.Mock).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
        const { result } = renderHook(() => useSetClubDiscussionVote(), { wrapper });
        act(() => result.current.mutate({ clubId: 'club', topicId: 'topic', userId: 'user', voteType: 'upvote' }));
        await waitFor(() => expect(read()).toMatchObject({ viewerVote: 'upvote', upvoteCount: 3, downvoteCount: 1, voteCount: 2 }));
        expect(client.getQueryData(otherKey)).toMatchObject({ viewerVote: null, voteCount: 1 });
        expect(result.current.isPending).toBe(true);
        await act(async () => complete({}));
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(client.getQueryState(key)?.isInvalidated).toBe(true);
        client.clear();
    });

    it('switches a reply vote immediately and rolls back only vote fields on failure', async () => {
        const { client, key, wrapper, read } = setup();
        let fail!: (reason: Error) => void;
        (clubsService.setClubDiscussionVote as jest.Mock).mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
        const { result } = renderHook(() => useSetClubDiscussionVote(), { wrapper });
        act(() => result.current.mutate({ clubId: 'club', parentTopicId: 'topic', replyId: 'reply', userId: 'user', voteType: 'upvote' }));
        await waitFor(() => expect(read().replies[0]).toMatchObject({ viewerVote: 'upvote', upvoteCount: 4, downvoteCount: 1, voteCount: 3 }));
        client.setQueryData(key, { ...read(), title: 'Updated elsewhere' });
        await act(async () => fail(new Error('Save failed')));
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(read().replies[0]).toMatchObject({ viewerVote: 'downvote', upvoteCount: 3, downvoteCount: 2, voteCount: 1 });
        expect(read().title).toBe('Updated elsewhere');
        client.clear();
    });

    it('removes a reply vote before the server completes', async () => {
        const { client, wrapper, read } = setup();
        let complete!: () => void;
        (clubsService.removeClubDiscussionVote as jest.Mock).mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
        const { result } = renderHook(() => useRemoveClubDiscussionVote(), { wrapper });
        act(() => result.current.mutate({ clubId: 'club', parentTopicId: 'topic', replyId: 'reply', userId: 'user' }));
        await waitFor(() => expect(read().replies[0]).toMatchObject({ viewerVote: null, upvoteCount: 3, downvoteCount: 1, voteCount: 2 }));
        expect(clubsService.removeClubDiscussionVote).toHaveBeenCalledWith(undefined, 'reply');
        await act(async () => complete());
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        client.clear();
    });
});
