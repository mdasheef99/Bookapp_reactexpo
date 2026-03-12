import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAcceptClubInvitation, useCreateClubDiscussionReply, useCreateClubDiscussionTopic, useJoinClub, useMarkClubDiscussionTopicRead, useRemoveClubMember, useReviewClubApplication, useUpdateClub, clubKeys } from '../useClubs';
import { clubsService } from '../../services/clubsService';

jest.mock('../../services/clubsService', () => ({
    clubsService: {
        acceptClubInvitation: jest.fn(),
        createClubDiscussionReply: jest.fn(),
        createClubDiscussionTopic: jest.fn(),
        joinClub: jest.fn(),
        markClubDiscussionTopicRead: jest.fn(),
        removeMember: jest.fn(),
        reviewJoinApplication: jest.fn(),
        updateClub: jest.fn(),
    },
}));

function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });
}

describe('useClubs cache invalidation', () => {
    beforeAll(() => {
        notifyManager.setNotifyFunction((callback) => {
            act(callback);
        });
    });

    afterAll(() => {
        notifyManager.setNotifyFunction((callback) => {
            callback();
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('invalidates every browse query root after joining or applying to a club', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (clubsService.joinClub as jest.Mock).mockResolvedValue({ status: 'joined' });

        const { result } = renderHook(() => useJoinClub(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId: 'club-1', userId: 'user-1' });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.browseRoot });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.publicDetail('club-1') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.membership('club-1', 'user-1') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.members('club-1') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.application('club-1', 'user-1') });
    });

    it('invalidates browse queries after moderator review updates member counts', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (clubsService.reviewJoinApplication as jest.Mock).mockResolvedValue({
            id: 'application-1',
            club_id: 'club-2',
            user_id: 'user-2',
            status: 'approved',
        });

        const { result } = renderHook(() => useReviewClubApplication(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ applicationId: 'application-1', decision: 'approved' });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.browseRoot });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.publicDetail('club-2') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.members('club-2') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.applications('club-2', 'pending') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.application('club-2', 'user-2') });
    });

    it('invalidates invitation and membership state after accepting an invite', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (clubsService.acceptClubInvitation as jest.Mock).mockResolvedValue({
            id: 'member-3',
            club_id: 'club-3',
            user_id: 'user-3',
            role: 'member',
            status: 'active',
        });

        const { result } = renderHook(() => useAcceptClubInvitation(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ invitationId: 'invite-3', clubId: 'club-3', userId: 'user-3' });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.browseRoot });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.publicDetail('club-3') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.membership('club-3', 'user-3') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.members('club-3') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.invitations('club-3') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.myInvitation('club-3', 'user-3') });
    });

    it('invalidates public detail and browse queries after updating club settings', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (clubsService.updateClub as jest.Mock).mockResolvedValue({
            id: 'club-4',
            name: 'Updated Club',
        });

        const { result } = renderHook(() => useUpdateClub(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                clubId: 'club-4',
                updates: { name: 'Updated Club', access_level: 'pro' },
            });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.publicDetail('club-4') });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.browseRoot });
    });

    it('invalidates browse, detail, members, and membership after removing a club member', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (clubsService.removeMember as jest.Mock).mockResolvedValue(undefined);

        const { result } = renderHook(() => useRemoveClubMember(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId: 'club-5', userId: 'user-5' });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.publicDetail('club-5') });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.browseRoot });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.members('club-5') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.membership('club-5', 'user-5') });
    });

    it('invalidates the discussion root after creating a new discussion topic', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (clubsService.createClubDiscussionTopic as jest.Mock).mockResolvedValue({ club_id: 'club-6' });

        const { result } = renderHook(() => useCreateClubDiscussionTopic(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId: 'club-6', title: 'Theme check-in', body: 'What did this week reveal?' });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionRoot('club-6') });
        });
    });

    it('invalidates discussion list and topic detail queries after posting a reply', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (clubsService.createClubDiscussionReply as jest.Mock).mockResolvedValue({ topic_id: 'topic-7' });

        const { result } = renderHook(() => useCreateClubDiscussionReply(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId: 'club-7', input: { topicId: 'topic-7', body: 'Count me in.' }, userId: 'user-7' });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionRoot('club-7') });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopicRoot('topic-7') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopic('topic-7', 'user-7') });
    });

    it('invalidates unread state queries after marking a discussion topic as read', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (clubsService.markClubDiscussionTopicRead as jest.Mock).mockResolvedValue(undefined);

        const { result } = renderHook(() => useMarkClubDiscussionTopicRead(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId: 'club-8', topicId: 'topic-8', userId: 'user-8' });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionRoot('club-8') });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopicRoot('topic-8') });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopic('topic-8', 'user-8') });
    });
});