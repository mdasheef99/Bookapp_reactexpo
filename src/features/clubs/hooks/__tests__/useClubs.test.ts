import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAcceptClubInvitation, useJoinClub, useRemoveClubMember, useReviewClubApplication, useUpdateClub, clubKeys } from '../useClubs';
import { clubsService } from '../../services/clubsService';

jest.mock('../../services/clubsService', () => ({
    clubsService: {
        acceptClubInvitation: jest.fn(),
        joinClub: jest.fn(),
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
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
}

describe('useClubs cache invalidation', () => {
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
});