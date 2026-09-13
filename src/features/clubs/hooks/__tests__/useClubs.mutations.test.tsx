import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
    clubKeys,
    useAcceptClubAdminTransferRequest,
    useArchiveClub,
    useCancelClubEvent,
    useCastClubBookVote,
    useCreateClubEvent,
    useCreateClubInvitation,
    useCreateClubMemberAction,
    useDeleteClubEvent,
    useFinalizeClubBookNomination,
    useLeaveClub,
    useNominateClubBook,
    useRemoveClubDiscussionReaction,
    useRemoveClubDiscussionVote,
    useSetClubCurrentBookFromNomination,
    useSetClubCurrentBookReadingStatus,
    useSetClubDiscussionReaction,
    useSetClubDiscussionVote,
    useUnarchiveClub,
    useUpdateClubEvent,
    useUpdateClubMemberStatus,
    useUpdateClubReadingProgress,
    useUpsertClubEventRsvp,
    useUpsertClubReadingSchedule,
} from '../useClubs';
import { clubsService } from '../../services/clubsService';

jest.mock('../../services/clubsService', () => ({
    clubsService: {
        acceptClubAdminTransferRequest: jest.fn(),
        archiveClub: jest.fn(),
        cancelClubEvent: jest.fn(),
        castClubBookVote: jest.fn(),
        createClubEvent: jest.fn(),
        createClubInvitation: jest.fn(),
        createClubMemberAction: jest.fn(),
        deleteClubEvent: jest.fn(),
        finalizeClubBookNomination: jest.fn(),
        leaveClub: jest.fn(),
        nominateClubBook: jest.fn(),
        setClubCurrentBookFromNomination: jest.fn(),
        setClubCurrentBookReadingStatus: jest.fn(),
        setClubDiscussionReaction: jest.fn(),
        removeClubDiscussionReaction: jest.fn(),
        removeClubDiscussionVote: jest.fn(),
        setClubDiscussionVote: jest.fn(),
        unarchiveClub: jest.fn(),
        updateClubEvent: jest.fn(),
        updateClubReadingProgress: jest.fn(),
        updateMemberStatus: jest.fn(),
        upsertClubEventRsvp: jest.fn(),
        upsertClubReadingSchedule: jest.fn(),
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

function expectInvalidatedWithRefetchAll(invalidateQueries: jest.SpyInstance, queryKey: readonly unknown[]) {
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey, refetchType: 'all' });
}

function isInvalidated(queryClient: QueryClient, queryKey: readonly unknown[]) {
    return queryClient.getQueryState(queryKey)?.isInvalidated === true;
}

function seedEventVariants(queryClient: QueryClient, eventId: string, otherEventId: string) {
    queryClient.setQueryData(clubKeys.event(eventId), { id: eventId, scope: 'anonymous' });
    queryClient.setQueryData(clubKeys.event(eventId, 'USER-A'), { id: eventId, scope: 'USER-A' });
    queryClient.setQueryData(clubKeys.event(eventId, 'USER-B'), { id: eventId, scope: 'USER-B' });
    queryClient.setQueryData(clubKeys.event(otherEventId, 'USER-A'), { id: otherEventId, scope: 'USER-A' });
}

describe('WU-TC05 mutation cache contracts', () => {
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

    it('exposes a true event root that parents every user-specific event leaf', () => {
        const eventId = 'event-root-shape';
        expect(clubKeys.eventRoot(eventId)).toEqual(['clubs', 'event', eventId]);
        expect(clubKeys.event(eventId)).toEqual([...clubKeys.eventRoot(eventId), 'anonymous']);
        expect(clubKeys.event(eventId, 'USER-A')).toEqual([...clubKeys.eventRoot(eventId), 'USER-A']);
    });

    it('proves the legacy anonymous event leaf is NOT a parent of authenticated variants', async () => {
        const queryClient = createQueryClient();
        const eventId = 'event-legacy-proof';
        const otherEventId = 'event-legacy-proof-other';
        seedEventVariants(queryClient, eventId, otherEventId);

        await queryClient.invalidateQueries({ queryKey: clubKeys.event(eventId) });

        expect(isInvalidated(queryClient, clubKeys.event(eventId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.event(eventId, 'USER-A'))).toBe(false);
        expect(isInvalidated(queryClient, clubKeys.event(eventId, 'USER-B'))).toBe(false);
        expect(isInvalidated(queryClient, clubKeys.event(otherEventId, 'USER-A'))).toBe(false);
    });

    it('invalidates every user-specific event variant after updating an event', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const eventId = 'event-update-1';
        const otherEventId = 'event-update-other';
        seedEventVariants(queryClient, eventId, otherEventId);
        (clubsService.updateClubEvent as jest.Mock).mockResolvedValue({ id: eventId, club_id: 'club-e1' });

        const { result } = renderHook(() => useUpdateClubEvent(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                eventId,
                clubId: 'club-e1',
                input: { title: 'Updated', eventType: 'virtual', startTime: '2026-09-01T10:00:00Z' },
            });
        });

        await waitFor(() => {
            expect(isInvalidated(queryClient, clubKeys.event(eventId, 'USER-A'))).toBe(true);
        });
        expect(isInvalidated(queryClient, clubKeys.event(eventId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.event(eventId, 'USER-B'))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.event(otherEventId, 'USER-A'))).toBe(false);
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.eventRoot(eventId) });
    });

    it('invalidates every user-specific event variant after cancelling an event', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const eventId = 'event-cancel-1';
        const otherEventId = 'event-cancel-other';
        seedEventVariants(queryClient, eventId, otherEventId);
        (clubsService.cancelClubEvent as jest.Mock).mockResolvedValue({ id: eventId, club_id: 'club-e2' });

        const { result } = renderHook(() => useCancelClubEvent(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ eventId, clubId: 'club-e2', cancelledBy: 'user-admin' });
        });

        await waitFor(() => {
            expect(isInvalidated(queryClient, clubKeys.event(eventId, 'USER-A'))).toBe(true);
        });
        expect(isInvalidated(queryClient, clubKeys.event(eventId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.event(eventId, 'USER-B'))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.event(otherEventId, 'USER-A'))).toBe(false);
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.eventRoot(eventId) });
    });

    it('removes every user-specific event variant after deleting an event', async () => {
        const queryClient = createQueryClient();
        const removeQueries = jest.spyOn(queryClient, 'removeQueries');
        const eventId = 'event-delete-1';
        const otherEventId = 'event-delete-other';
        seedEventVariants(queryClient, eventId, otherEventId);
        (clubsService.deleteClubEvent as jest.Mock).mockResolvedValue(undefined);

        const { result } = renderHook(() => useDeleteClubEvent(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ eventId, clubId: 'club-e3' });
        });

        await waitFor(() => {
            expect(removeQueries).toHaveBeenCalledWith({ queryKey: clubKeys.eventRoot(eventId) });
        });
        expect(queryClient.getQueryState(clubKeys.event(eventId))).toBeUndefined();
        expect(queryClient.getQueryState(clubKeys.event(eventId, 'USER-A'))).toBeUndefined();
        expect(queryClient.getQueryState(clubKeys.event(eventId, 'USER-B'))).toBeUndefined();
        expect(queryClient.getQueryData(clubKeys.event(otherEventId, 'USER-A'))).toEqual({
            id: otherEventId,
            scope: 'USER-A',
        });
    });

    it('invalidates manage detail when finalizing a book nomination', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-finalize-1';
        queryClient.setQueryData(clubKeys.manageDetail(clubId), { id: clubId });
        queryClient.setQueryData(clubKeys.publicDetail(clubId), { id: clubId });
        queryClient.setQueryData(clubKeys.nominations(clubId, 'USER-A'), []);
        queryClient.setQueryData(clubKeys.browse({}), []);
        queryClient.setQueryData(clubKeys.currentBookStatus(clubId, 'USER-A'), null);
        (clubsService.finalizeClubBookNomination as jest.Mock).mockResolvedValue({ id: clubId });

        const { result } = renderHook(() => useFinalizeClubBookNomination(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ nominationId: 'nomination-1' });
        });

        await waitFor(() => {
            expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.manageDetail(clubId));
        });
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.nominationsRoot(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.publicDetail(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.browseRoot);
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.currentBookStatusRoot(clubId));
        expect(isInvalidated(queryClient, clubKeys.manageDetail(clubId))).toBe(true);
    });

    it('invalidates manage detail when setting the current book from a nomination', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-set-current-1';
        queryClient.setQueryData(clubKeys.manageDetail(clubId), { id: clubId });
        queryClient.setQueryData(clubKeys.publicDetail(clubId), { id: clubId });
        queryClient.setQueryData(clubKeys.nominations(clubId, 'USER-A'), []);
        queryClient.setQueryData(clubKeys.browse({}), []);
        queryClient.setQueryData(clubKeys.currentBookStatus(clubId, 'USER-A'), null);
        (clubsService.setClubCurrentBookFromNomination as jest.Mock).mockResolvedValue({ id: clubId });

        const { result } = renderHook(() => useSetClubCurrentBookFromNomination(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ nominationId: 'nomination-2' });
        });

        await waitFor(() => {
            expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.manageDetail(clubId));
        });
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.nominationsRoot(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.publicDetail(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.browseRoot);
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.currentBookStatusRoot(clubId));
        expect(isInvalidated(queryClient, clubKeys.manageDetail(clubId))).toBe(true);
    });

    it('invalidates the current-book status subtree after changing a member status', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-status-1';
        const otherClubId = 'club-status-2';
        queryClient.setQueryData(clubKeys.currentBookStatus(clubId, 'USER-A'), { active: 3 });
        queryClient.setQueryData(clubKeys.currentBookStatus(otherClubId, 'USER-A'), { active: 5 });
        queryClient.setQueryData(clubKeys.members(clubId), []);
        (clubsService.updateMemberStatus as jest.Mock).mockResolvedValue({
            club_id: clubId,
            user_id: 'USER-A',
            status: 'muted',
        });

        const { result } = renderHook(() => useUpdateClubMemberStatus(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId, userId: 'USER-A', status: 'muted' });
        });

        await waitFor(() => {
            expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.currentBookStatusRoot(clubId));
        });
        expect(isInvalidated(queryClient, clubKeys.currentBookStatus(clubId, 'USER-A'))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.currentBookStatus(otherClubId, 'USER-A'))).toBe(false);
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.members(clubId) });
    });

    it('invalidates the current-book status subtree after creating a member action', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-action-1';
        const otherClubId = 'club-action-2';
        const targetUserId = 'USER-TARGET';
        queryClient.setQueryData(clubKeys.currentBookStatus(clubId, targetUserId), { active: 4 });
        queryClient.setQueryData(clubKeys.currentBookStatus(otherClubId, targetUserId), { active: 6 });
        (clubsService.createClubMemberAction as jest.Mock).mockResolvedValue({
            club_id: clubId,
            user_id: targetUserId,
            action_type: 'muted',
        });

        const { result } = renderHook(() => useCreateClubMemberAction(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId, userId: targetUserId, actionType: 'muted', reason: 'spam' });
        });

        await waitFor(() => {
            expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.currentBookStatusRoot(clubId));
        });
        expect(isInvalidated(queryClient, clubKeys.currentBookStatus(clubId, targetUserId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.currentBookStatus(otherClubId, targetUserId))).toBe(false);
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.members(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.memberActions(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.memberActions(clubId, targetUserId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.membership(clubId, targetUserId));
    });

    it('invalidates the successor membership and status subtree when accepting an admin transfer', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-transfer-1';
        const otherClubId = 'club-transfer-2';
        const successorId = 'USER-SUCCESSOR';
        const otherUserId = 'USER-OTHER';
        queryClient.setQueryData(clubKeys.membership(clubId, successorId), { role: 'member' });
        queryClient.setQueryData(clubKeys.membership(clubId, otherUserId), { role: 'member' });
        queryClient.setQueryData(clubKeys.membership(otherClubId, successorId), { role: 'member' });
        queryClient.setQueryData(clubKeys.currentBookStatus(clubId, successorId), { active: 2 });
        queryClient.setQueryData(clubKeys.currentBookStatus(otherClubId, successorId), { active: 7 });
        (clubsService.acceptClubAdminTransferRequest as jest.Mock).mockResolvedValue({
            id: clubId,
            admin_id: successorId,
        });

        const { result } = renderHook(() => useAcceptClubAdminTransferRequest(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId, requestId: 'request-1' });
        });

        await waitFor(() => {
            expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.membership(clubId, successorId));
        });
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.currentBookStatusRoot(clubId));
        expect(isInvalidated(queryClient, clubKeys.membership(clubId, successorId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.currentBookStatus(clubId, successorId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.membership(otherClubId, successorId))).toBe(false);
        expect(isInvalidated(queryClient, clubKeys.currentBookStatus(otherClubId, successorId))).toBe(false);
        expect(isInvalidated(queryClient, clubKeys.membership(clubId, otherUserId))).toBe(false);
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.manageDetail(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.publicDetail(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.members(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.adminTransferRequests(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.browseRoot);
    });

    it('leaves seeded caches untouched when an event mutation fails', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const eventId = 'event-failure-1';
        const otherEventId = 'event-failure-other';
        seedEventVariants(queryClient, eventId, otherEventId);
        (clubsService.updateClubEvent as jest.Mock).mockRejectedValue(new Error('boom'));

        const { result } = renderHook(() => useUpdateClubEvent(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await expect(
                result.current.mutateAsync({
                    eventId,
                    clubId: 'club-e9',
                    input: { title: 'Nope', eventType: 'virtual', startTime: '2026-09-01T10:00:00Z' },
                }),
            ).rejects.toThrow('boom');
        });

        expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: clubKeys.eventRoot(eventId) });
        expect(isInvalidated(queryClient, clubKeys.event(eventId))).toBe(false);
        expect(isInvalidated(queryClient, clubKeys.event(eventId, 'USER-A'))).toBe(false);
        expect(isInvalidated(queryClient, clubKeys.event(eventId, 'USER-B'))).toBe(false);
        expect(isInvalidated(queryClient, clubKeys.event(otherEventId, 'USER-A'))).toBe(false);
    });

    it('fans out leave membership state across detail, browse, members, and status caches', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-leave-1';
        queryClient.setQueryData(clubKeys.currentBookStatus(clubId, 'USER-A'), { active: 1 });
        (clubsService.leaveClub as jest.Mock).mockResolvedValue(undefined);

        const { result } = renderHook(() => useLeaveClub(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId, userId: 'USER-A' });
        });

        await waitFor(() => {
            expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.currentBookStatusRoot(clubId));
        });
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.publicDetail(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.browseRoot);
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.members(clubId));
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.membership(clubId, 'USER-A'));
        expect(isInvalidated(queryClient, clubKeys.currentBookStatus(clubId, 'USER-A'))).toBe(true);
    });

    it('refreshes manage detail, public detail, and browse caches when archiving or unarchiving', async () => {
        const archiveClient = createQueryClient();
        const archiveInvalidations = jest.spyOn(archiveClient, 'invalidateQueries');
        (clubsService.archiveClub as jest.Mock).mockResolvedValue({ id: 'club-archive-1' });

        const archived = renderHook(() => useArchiveClub(), { wrapper: createWrapper(archiveClient) });
        await act(async () => {
            await archived.result.current.mutateAsync({ clubId: 'club-archive-1' });
        });
        await waitFor(() => {
            expectInvalidatedWithRefetchAll(archiveInvalidations, clubKeys.manageDetail('club-archive-1'));
        });
        expectInvalidatedWithRefetchAll(archiveInvalidations, clubKeys.publicDetail('club-archive-1'));
        expectInvalidatedWithRefetchAll(archiveInvalidations, clubKeys.browseRoot);
        archived.unmount();

        const unarchiveClient = createQueryClient();
        const unarchiveInvalidations = jest.spyOn(unarchiveClient, 'invalidateQueries');
        (clubsService.unarchiveClub as jest.Mock).mockResolvedValue({ id: 'club-archive-1' });

        const unarchived = renderHook(() => useUnarchiveClub(), { wrapper: createWrapper(unarchiveClient) });
        await act(async () => {
            await unarchived.result.current.mutateAsync({ clubId: 'club-archive-1' });
        });
        await waitFor(() => {
            expectInvalidatedWithRefetchAll(unarchiveInvalidations, clubKeys.manageDetail('club-archive-1'));
        });
        expectInvalidatedWithRefetchAll(unarchiveInvalidations, clubKeys.publicDetail('club-archive-1'));
        expectInvalidatedWithRefetchAll(unarchiveInvalidations, clubKeys.browseRoot);
        unarchived.unmount();
    });

    it('invalidates nominations and public detail after nominating a book', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-nominate-1';
        queryClient.setQueryData(clubKeys.nominations(clubId, 'USER-A'), []);
        (clubsService.nominateClubBook as jest.Mock).mockResolvedValue({ club_id: clubId });

        const { result } = renderHook(() => useNominateClubBook(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId, bookId: 'book-1' });
        });

        await waitFor(() => {
            expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.nominationsRoot(clubId));
        });
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.publicDetail(clubId));
        expect(isInvalidated(queryClient, clubKeys.nominations(clubId, 'USER-A'))).toBe(true);
    });

    it('isolates book votes to the nominations subtree without touching public detail', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-vote-1';
        queryClient.setQueryData(clubKeys.nominations(clubId, 'USER-A'), []);
        queryClient.setQueryData(clubKeys.publicDetail(clubId), { id: clubId });
        (clubsService.castClubBookVote as jest.Mock).mockResolvedValue({ nomination_id: 'nomination-1' });

        const { result } = renderHook(() => useCastClubBookVote(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ nominationId: 'nomination-1', clubId });
        });

        await waitFor(() => {
            expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.nominationsRoot(clubId));
        });
        expect(isInvalidated(queryClient, clubKeys.nominations(clubId, 'USER-A'))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.publicDetail(clubId))).toBe(false);
    });

    it('isolates reading-status changes to the current-book status subtree', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-reading-status-1';
        queryClient.setQueryData(clubKeys.currentBookStatus(clubId, 'USER-A'), { active: 2 });
        queryClient.setQueryData(clubKeys.manageDetail(clubId), { id: clubId });
        (clubsService.setClubCurrentBookReadingStatus as jest.Mock).mockResolvedValue({ active: 2 });

        const { result } = renderHook(() => useSetClubCurrentBookReadingStatus(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId, status: 'reading' });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.currentBookStatusRoot(clubId) });
        });
        expect(isInvalidated(queryClient, clubKeys.currentBookStatus(clubId, 'USER-A'))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.manageDetail(clubId))).toBe(false);
    });

    it('isolates schedule writes to the schedule root and progress writes to the exact leaf', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-schedule-1';
        const bookId = 'book-schedule-1';
        queryClient.setQueryData(clubKeys.readingSchedule(clubId, bookId, 'USER-A'), { chapters: 1 });
        queryClient.setQueryData(clubKeys.readingSchedule(clubId, bookId, 'USER-B'), { chapters: 2 });
        (clubsService.upsertClubReadingSchedule as jest.Mock).mockResolvedValue({ club_id: clubId });

        const schedule = renderHook(() => useUpsertClubReadingSchedule(), { wrapper: createWrapper(queryClient) });
        await act(async () => {
            await schedule.result.current.mutateAsync({
                clubId,
                bookId,
                milestones: [{ id: 'm1', label: 'Chapters 1-3', target: 'chapter-3', dueDate: null }],
            });
        });
        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.readingScheduleRoot(clubId) });
        });
        schedule.unmount();

        jest.clearAllMocks();
        (clubsService.updateClubReadingProgress as jest.Mock).mockResolvedValue({ chapters_completed: 3 });
        const progressClient = createQueryClient();
        progressClient.setQueryData(clubKeys.readingSchedule(clubId, bookId, 'USER-A'), { chapters: 1 });
        progressClient.setQueryData(clubKeys.readingSchedule(clubId, bookId, 'USER-B'), { chapters: 2 });
        const progressInvalidations = jest.spyOn(progressClient, 'invalidateQueries');
        const progress = renderHook(() => useUpdateClubReadingProgress(), { wrapper: createWrapper(progressClient) });
        await act(async () => {
            await progress.result.current.mutateAsync({
                clubId,
                bookId,
                scheduleId: 'schedule-1',
                userId: 'USER-A',
                chaptersCompleted: 3,
            });
        });
        await waitFor(() => {
            expect(progressInvalidations).toHaveBeenCalledWith({
                queryKey: clubKeys.readingSchedule(clubId, bookId, 'USER-A'),
            });
        });
        expect(isInvalidated(progressClient, clubKeys.readingSchedule(clubId, bookId, 'USER-A'))).toBe(true);
        expect(isInvalidated(progressClient, clubKeys.readingSchedule(clubId, bookId, 'USER-B'))).toBe(false);
        progress.unmount();
    });

    it('keeps RSVP targeting on the exact user-specific event leaf', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const eventId = 'event-rsvp-1';
        const clubId = 'club-rsvp-1';
        queryClient.setQueryData(clubKeys.event(eventId, 'USER-A'), { rsvp: 'maybe' });
        queryClient.setQueryData(clubKeys.event(eventId, 'USER-B'), { rsvp: 'going' });
        queryClient.setQueryData(clubKeys.events(clubId, 'USER-A'), []);
        (clubsService.upsertClubEventRsvp as jest.Mock).mockResolvedValue({ event_id: eventId });

        const { result } = renderHook(() => useUpsertClubEventRsvp(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ eventId, clubId, userId: 'USER-A', status: 'going' });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.event(eventId, 'USER-A') });
        });
        expect(isInvalidated(queryClient, clubKeys.event(eventId, 'USER-A'))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.event(eventId, 'USER-B'))).toBe(false);
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.eventsRoot(clubId) });
    });

    it('invalidates the club events list and public detail when creating an event', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-create-event-1';
        queryClient.setQueryData(clubKeys.events(clubId, 'USER-A'), []);
        (clubsService.createClubEvent as jest.Mock).mockResolvedValue({ id: 'event-new', club_id: clubId });

        const { result } = renderHook(() => useCreateClubEvent(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                clubId,
                title: 'Kickoff',
                eventType: 'in_person',
                startTime: '2026-09-20T18:00:00Z',
            });
        });

        await waitFor(() => {
            expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.eventsRoot(clubId));
        });
        expectInvalidatedWithRefetchAll(invalidateQueries, clubKeys.publicDetail(clubId));
        expect(isInvalidated(queryClient, clubKeys.events(clubId, 'USER-A'))).toBe(true);
    });

    it('invalidates the discussion root and topic caches after voting on a discussion', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (clubsService.setClubDiscussionVote as jest.Mock).mockResolvedValue({ topic_id: 'topic-vote-1' });

        const { result } = renderHook(() => useSetClubDiscussionVote(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                clubId: 'club-discussion-1',
                topicId: 'topic-vote-1',
                voteType: 'upvote',
                userId: 'USER-A',
            });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionRoot('club-discussion-1') });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopicRoot('topic-vote-1') });
        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: clubKeys.discussionTopic('topic-vote-1', 'USER-A'),
        });
    });

    it('invalidates the open thread after setting a reply vote without touching other topics or clubs', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-discussion-reply-1';
        const otherClubId = 'club-discussion-reply-other';
        const parentTopicId = 'topic-reply-parent-1';
        const otherTopicId = 'topic-reply-other-1';
        const replyId = 'reply-vote-1';
        const userId = 'USER-A';
        queryClient.setQueryData(clubKeys.discussionTopic(parentTopicId, userId), { id: parentTopicId });
        queryClient.setQueryData(clubKeys.discussionTopic(otherTopicId, userId), { id: otherTopicId });
        queryClient.setQueryData(clubKeys.discussionTopic(parentTopicId, 'USER-B'), { id: parentTopicId });
        queryClient.setQueryData(clubKeys.discussionRoot(otherClubId), []);
        (clubsService.setClubDiscussionVote as jest.Mock).mockResolvedValue({ reply_id: replyId });

        const { result } = renderHook(() => useSetClubDiscussionVote(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                clubId,
                parentTopicId,
                topicId: undefined,
                replyId,
                voteType: 'upvote',
                userId,
            });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionRoot(clubId) });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopicRoot(parentTopicId) });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopic(parentTopicId, userId) });
        expect(isInvalidated(queryClient, clubKeys.discussionTopic(parentTopicId, userId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.discussionTopic(otherTopicId, userId))).toBe(false);
        expect(isInvalidated(queryClient, clubKeys.discussionRoot(otherClubId))).toBe(false);
        // Write target keeps the exactly-one-target contract: parentTopicId is cache-only.
        expect(clubsService.setClubDiscussionVote).toHaveBeenCalledWith({ topicId: undefined, replyId, voteType: 'upvote' });
    });

    it('invalidates the open thread after removing a reply vote', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-discussion-reply-2';
        const parentTopicId = 'topic-reply-parent-2';
        const otherTopicId = 'topic-reply-other-2';
        const replyId = 'reply-vote-2';
        const userId = 'USER-A';
        queryClient.setQueryData(clubKeys.discussionTopic(parentTopicId, userId), { id: parentTopicId });
        queryClient.setQueryData(clubKeys.discussionTopic(otherTopicId, userId), { id: otherTopicId });
        (clubsService.removeClubDiscussionVote as jest.Mock).mockResolvedValue(undefined);

        const { result } = renderHook(() => useRemoveClubDiscussionVote(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                clubId,
                parentTopicId,
                topicId: undefined,
                replyId,
                userId,
            });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionRoot(clubId) });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopicRoot(parentTopicId) });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopic(parentTopicId, userId) });
        expect(isInvalidated(queryClient, clubKeys.discussionTopic(parentTopicId, userId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.discussionTopic(otherTopicId, userId))).toBe(false);
        expect(clubsService.removeClubDiscussionVote).toHaveBeenCalledWith(undefined, replyId);
    });

    it('invalidates the open thread after setting a reply reaction without touching other topics or clubs', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-discussion-reply-3';
        const otherClubId = 'club-discussion-reply-other-3';
        const parentTopicId = 'topic-reply-parent-3';
        const otherTopicId = 'topic-reply-other-3';
        const replyId = 'reply-reaction-1';
        const userId = 'USER-A';
        queryClient.setQueryData(clubKeys.discussionTopic(parentTopicId, userId), { id: parentTopicId });
        queryClient.setQueryData(clubKeys.discussionTopic(otherTopicId, userId), { id: otherTopicId });
        queryClient.setQueryData(clubKeys.discussionRoot(otherClubId), []);
        (clubsService.setClubDiscussionReaction as jest.Mock).mockResolvedValue({ reply_id: replyId });

        const { result } = renderHook(() => useSetClubDiscussionReaction(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                clubId,
                parentTopicId,
                topicId: undefined,
                replyId,
                emoji: '🔥',
                userId,
            });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionRoot(clubId) });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopicRoot(parentTopicId) });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopic(parentTopicId, userId) });
        expect(isInvalidated(queryClient, clubKeys.discussionTopic(parentTopicId, userId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.discussionTopic(otherTopicId, userId))).toBe(false);
        expect(isInvalidated(queryClient, clubKeys.discussionRoot(otherClubId))).toBe(false);
        // Write target keeps the exactly-one-target contract: parentTopicId is cache-only.
        expect(clubsService.setClubDiscussionReaction).toHaveBeenCalledWith({ topicId: undefined, replyId, emoji: '🔥' });
    });

    it('invalidates the open thread after removing a reply reaction', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-discussion-reply-4';
        const parentTopicId = 'topic-reply-parent-4';
        const otherTopicId = 'topic-reply-other-4';
        const replyId = 'reply-reaction-2';
        const userId = 'USER-A';
        queryClient.setQueryData(clubKeys.discussionTopic(parentTopicId, userId), { id: parentTopicId });
        queryClient.setQueryData(clubKeys.discussionTopic(otherTopicId, userId), { id: otherTopicId });
        (clubsService.removeClubDiscussionReaction as jest.Mock).mockResolvedValue(undefined);

        const { result } = renderHook(() => useRemoveClubDiscussionReaction(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                clubId,
                parentTopicId,
                topicId: undefined,
                replyId,
                emoji: '🔥',
                userId,
            });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionRoot(clubId) });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopicRoot(parentTopicId) });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopic(parentTopicId, userId) });
        expect(isInvalidated(queryClient, clubKeys.discussionTopic(parentTopicId, userId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.discussionTopic(otherTopicId, userId))).toBe(false);
        expect(clubsService.removeClubDiscussionReaction).toHaveBeenCalledWith('🔥', undefined, replyId);
    });

    it('keeps topic-level reaction writes on the topic target with thread invalidation', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const topicId = 'topic-reaction-1';
        (clubsService.setClubDiscussionReaction as jest.Mock).mockResolvedValue({ topic_id: topicId });

        const { result } = renderHook(() => useSetClubDiscussionReaction(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                clubId: 'club-discussion-2',
                parentTopicId: topicId,
                topicId,
                replyId: undefined,
                emoji: '👍',
                userId: 'USER-A',
            });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionRoot('club-discussion-2') });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopicRoot(topicId) });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.discussionTopic(topicId, 'USER-A') });
        expect(clubsService.setClubDiscussionReaction).toHaveBeenCalledWith({ topicId, replyId: undefined, emoji: '👍' });
    });

    it('isolates invitation creation to the club invitations cache', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        const clubId = 'club-invite-1';
        queryClient.setQueryData(clubKeys.invitations(clubId), []);
        queryClient.setQueryData(clubKeys.members(clubId), []);
        (clubsService.createClubInvitation as jest.Mock).mockResolvedValue({ club_id: clubId });

        const { result } = renderHook(() => useCreateClubInvitation(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({ clubId, inviteeUsername: 'reader-1' });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clubKeys.invitations(clubId) });
        });
        expect(isInvalidated(queryClient, clubKeys.invitations(clubId))).toBe(true);
        expect(isInvalidated(queryClient, clubKeys.members(clubId))).toBe(false);
    });
});
