import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clubsService, type ClubCurrentBookReadingStatus, type ClubDiscussionReactionEmoji, type ClubDiscussionReportReason, type ClubDiscussionVoteType, type ClubEventRsvpStatus, type ClubFilters, type ClubJoinApplicationStatus, type ClubJoinQuestionInput, type CreateClubDiscussionReplyInput, type CreateClubDiscussionTopicInput, type CreateClubEventInput, type MemberRole, type NominateClubBookInput, type ReviewApplicationDecision, type UpdateClubEventInput, type UpdateClubInput } from '../services/clubsService';

const CLUBS_QUERY_KEY = ['clubs'] as const;
const CLUBS_BROWSE_QUERY_KEY = [...CLUBS_QUERY_KEY, 'browse'] as const;

export const clubKeys = {
    all: CLUBS_QUERY_KEY,
    browseRoot: CLUBS_BROWSE_QUERY_KEY,
    browse: (filters: ClubFilters = {}) => [...clubKeys.all, 'browse', filters] as const,
    myBrowse: (userId: string, filters: ClubFilters = {}) => [...clubKeys.browseRoot, 'mine', userId, filters] as const,
    publicDetail: (clubId: string) => [...clubKeys.all, 'public-detail', clubId] as const,
    membership: (clubId: string, userId: string) => [...clubKeys.all, 'membership', clubId, userId] as const,
    myInvitation: (clubId: string, userId: string) => [...clubKeys.all, 'my-invitation', clubId, userId] as const,
    members: (clubId: string) => [...clubKeys.all, 'members', clubId] as const,
    eventVenues: (clubId: string) => [...clubKeys.all, 'event-venues', clubId] as const,
    eventsRoot: (clubId: string) => [...clubKeys.all, 'events', clubId] as const,
    events: (clubId: string, userId?: string | null) => [...clubKeys.all, 'events', clubId, userId ?? 'anonymous'] as const,
    event: (eventId: string, userId?: string | null) => [...clubKeys.all, 'event', eventId, userId ?? 'anonymous'] as const,
    discussionRoot: (clubId: string) => [...clubKeys.all, 'discussion', clubId] as const,
    discussionTopics: (clubId: string, userId?: string | null) => [...clubKeys.discussionRoot(clubId), 'topics', userId ?? 'anonymous'] as const,
    discussionTopicRoot: (topicId: string) => [...clubKeys.all, 'discussion-topic', topicId] as const,
    discussionTopic: (topicId: string, userId?: string | null) => [...clubKeys.discussionTopicRoot(topicId), userId ?? 'anonymous'] as const,
    nominationsRoot: (clubId: string) => [...clubKeys.all, 'nominations', clubId] as const,
    nominations: (clubId: string, userId?: string | null) => [...clubKeys.all, 'nominations', clubId, userId ?? 'anonymous'] as const,
    joinQuestions: (clubId: string) => [...clubKeys.all, 'join-questions', clubId] as const,
    application: (clubId: string, userId: string) => [...clubKeys.all, 'application', clubId, userId] as const,
    applications: (clubId: string, status: ClubJoinApplicationStatus) => [...clubKeys.all, 'applications', clubId, status] as const,
    invitations: (clubId: string) => [...clubKeys.all, 'invitations', clubId] as const,
    currentBookStatusRoot: (clubId: string) => [...clubKeys.all, 'current-book-status', clubId] as const,
    currentBookStatus: (clubId: string, userId?: string | null) => [...clubKeys.currentBookStatusRoot(clubId), userId ?? 'anonymous'] as const,
};

export function useBrowseClubs(filters: ClubFilters = {}) {
    return useQuery({
        queryKey: clubKeys.browse(filters),
        queryFn: () => clubsService.getPublicClubs(filters),
        staleTime: 30_000,
        retry: false,
    });
}

export function useMyBrowseClubs(userId: string | null, filters: ClubFilters = {}, enabled = true) {
    return useQuery({
        queryKey: clubKeys.myBrowse(userId ?? '', filters),
        queryFn: () => clubsService.getMyPublicClubs(userId!, filters),
        enabled: !!userId && enabled,
        staleTime: 30_000,
        retry: false,
    });
}

export function useClubPublicDetail(clubId: string | null) {
    return useQuery({
        queryKey: clubKeys.publicDetail(clubId ?? ''),
        queryFn: () => clubsService.getPublicClubById(clubId!),
        enabled: !!clubId,
        staleTime: 30_000,
    });
}

export function useClubMembership(clubId: string | null, userId: string | null) {
    return useQuery({
        queryKey: clubKeys.membership(clubId ?? '', userId ?? ''),
        queryFn: () => clubsService.getMyMembership(clubId!, userId!),
        enabled: !!clubId && !!userId,
        staleTime: 15_000,
    });
}

export function useClubMembers(clubId: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.members(clubId ?? ''),
        queryFn: () => clubsService.getClubMembers(clubId!),
        enabled: !!clubId && enabled,
        staleTime: 15_000,
    });
}

export function useClubEventVenues(clubId: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.eventVenues(clubId ?? ''),
        queryFn: () => clubsService.getClubEventVenues(clubId!),
        enabled: !!clubId && enabled,
        staleTime: 30_000,
    });
}

export function useClubEvents(clubId: string | null, userId?: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.events(clubId ?? '', userId),
        queryFn: () => clubsService.getClubEvents(clubId!, userId),
        enabled: !!clubId && enabled,
        staleTime: 10_000,
    });
}

export function useClubEvent(eventId: string | null, userId?: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.event(eventId ?? '', userId),
        queryFn: () => clubsService.getClubEventById(eventId!, userId),
        enabled: !!eventId && enabled,
        staleTime: 10_000,
    });
}

export function useClubBookNominations(clubId: string | null, userId?: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.nominations(clubId ?? '', userId),
        queryFn: () => clubsService.getClubBookNominations(clubId!, userId),
        enabled: !!clubId && enabled,
        staleTime: 10_000,
    });
}

export function useClubDiscussionTopics(clubId: string | null, userId?: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.discussionTopics(clubId ?? '', userId),
        queryFn: () => clubsService.getClubDiscussionTopics(clubId!, userId),
        enabled: !!clubId && enabled,
        staleTime: 10_000,
        retry: false,
    });
}

export function useClubDiscussionTopic(topicId: string | null, userId?: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.discussionTopic(topicId ?? '', userId),
        queryFn: () => clubsService.getClubDiscussionTopic(topicId!, userId),
        enabled: !!topicId && enabled,
        staleTime: 5_000,
        retry: false,
    });
}

export function useClubJoinQuestions(clubId: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.joinQuestions(clubId ?? ''),
        queryFn: () => clubsService.getJoinQuestions(clubId!),
        enabled: !!clubId && enabled,
        staleTime: 30_000,
    });
}

export function useMyClubApplication(clubId: string | null, userId: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.application(clubId ?? '', userId ?? ''),
        queryFn: () => clubsService.getMyJoinApplication(clubId!, userId!),
        enabled: !!clubId && !!userId && enabled,
        staleTime: 15_000,
    });
}

export function useClubApplications(clubId: string | null, status: ClubJoinApplicationStatus = 'pending', enabled = true) {
    return useQuery({
        queryKey: clubKeys.applications(clubId ?? '', status),
        queryFn: () => clubsService.getClubApplications(clubId!, status),
        enabled: !!clubId && enabled,
        staleTime: 10_000,
    });
}

export function useClubInvitations(clubId: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.invitations(clubId ?? ''),
        queryFn: () => clubsService.getClubInvitations(clubId!),
        enabled: !!clubId && enabled,
        staleTime: 10_000,
    });
}

export function useClubCurrentBookStatusOverview(clubId: string | null, userId?: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.currentBookStatus(clubId ?? '', userId),
        queryFn: () => clubsService.getClubCurrentBookStatusOverview(clubId!),
        enabled: !!clubId && enabled,
        staleTime: 10_000,
        retry: false,
    });
}

export function useMyClubInvitation(clubId: string | null, userId: string | null, enabled = true) {
    return useQuery({
        queryKey: clubKeys.myInvitation(clubId ?? '', userId ?? ''),
        queryFn: () => clubsService.getMyPendingInvitation(clubId!, userId!),
        enabled: !!clubId && !!userId && enabled,
        staleTime: 10_000,
    });
}

export function useJoinClub() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, userId, answers }: { clubId: string; userId: string; answers?: Record<string, string> }) =>
            clubsService.joinClub(clubId, userId, answers),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.publicDetail(variables.clubId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.browseRoot, refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.membership(variables.clubId, variables.userId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.members(variables.clubId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.application(variables.clubId, variables.userId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.currentBookStatusRoot(variables.clubId), refetchType: 'all' }),
            ]);
        },
    });
}

export function useReviewClubApplication() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ applicationId, decision, declineReason }: { applicationId: string; decision: ReviewApplicationDecision; declineReason?: string | null }) =>
            clubsService.reviewJoinApplication(applicationId, decision, declineReason),
        onSuccess: async (result) => {
            if (!result.club_id) return;

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.publicDetail(result.club_id), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.browseRoot, refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.members(result.club_id), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.applications(result.club_id, 'pending'), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.currentBookStatusRoot(result.club_id), refetchType: 'all' }),
                result.user_id ? queryClient.invalidateQueries({ queryKey: clubKeys.application(result.club_id, result.user_id), refetchType: 'all' }) : Promise.resolve(),
            ]);
        },
    });
}

export function useNominateClubBook() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: NominateClubBookInput) => clubsService.nominateClubBook(input),
        onSuccess: async (result) => {
            if (!result.club_id) return;

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.nominationsRoot(result.club_id), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.publicDetail(result.club_id), refetchType: 'all' }),
            ]);
        },
    });
}

export function useCreateClubEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateClubEventInput) => clubsService.createClubEvent(input),
        onSuccess: async (result) => {
            if (!result.club_id) return;
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.eventsRoot(result.club_id), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.publicDetail(result.club_id), refetchType: 'all' }),
            ]);
        },
    });
}

export function useCreateClubDiscussionTopic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateClubDiscussionTopicInput) => clubsService.createClubDiscussionTopic(input),
        onSuccess: async (result) => {
            if (!result.club_id) return;
            await queryClient.invalidateQueries({ queryKey: clubKeys.discussionRoot(result.club_id) });
        },
    });
}

export function useCreateClubDiscussionReply() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, input, userId }: { clubId: string; input: CreateClubDiscussionReplyInput; userId?: string | null }) =>
            clubsService.createClubDiscussionReply(input),
        onSuccess: async (result, variables) => {
            const topicId = result.topic_id ?? variables.input.topicId;
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.discussionRoot(variables.clubId) }),
                queryClient.invalidateQueries({ queryKey: clubKeys.discussionTopicRoot(topicId) }),
                variables.userId ? queryClient.invalidateQueries({ queryKey: clubKeys.discussionTopic(topicId, variables.userId) }) : Promise.resolve(),
            ]);
        },
    });
}

export function useSetClubDiscussionVote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, topicId, replyId, voteType, userId }: { clubId: string; topicId?: string | null; replyId?: string | null; voteType: ClubDiscussionVoteType; userId?: string | null }) =>
            clubsService.setClubDiscussionVote({ topicId, replyId, voteType }),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.discussionRoot(variables.clubId) }),
                variables.topicId ? queryClient.invalidateQueries({ queryKey: clubKeys.discussionTopicRoot(variables.topicId) }) : Promise.resolve(),
                variables.topicId && variables.userId ? queryClient.invalidateQueries({ queryKey: clubKeys.discussionTopic(variables.topicId, variables.userId) }) : Promise.resolve(),
            ]);
        },
    });
}

export function useSetClubDiscussionReaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, topicId, replyId, emoji, userId }: { clubId: string; topicId?: string | null; replyId?: string | null; emoji: ClubDiscussionReactionEmoji; userId?: string | null }) =>
            clubsService.setClubDiscussionReaction({ topicId, replyId, emoji }),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.discussionRoot(variables.clubId) }),
                variables.topicId ? queryClient.invalidateQueries({ queryKey: clubKeys.discussionTopicRoot(variables.topicId) }) : Promise.resolve(),
                variables.topicId && variables.userId ? queryClient.invalidateQueries({ queryKey: clubKeys.discussionTopic(variables.topicId, variables.userId) }) : Promise.resolve(),
            ]);
        },
    });
}

export function useReportClubDiscussionContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, topicId, replyId, reason, details, userId }: { clubId: string; topicId?: string | null; replyId?: string | null; reason: ClubDiscussionReportReason; details?: string | null; userId?: string | null }) =>
            clubsService.reportClubDiscussionContent({ topicId, replyId, reason, details }),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.discussionRoot(variables.clubId) }),
                variables.topicId ? queryClient.invalidateQueries({ queryKey: clubKeys.discussionTopicRoot(variables.topicId) }) : Promise.resolve(),
                variables.topicId && variables.userId ? queryClient.invalidateQueries({ queryKey: clubKeys.discussionTopic(variables.topicId, variables.userId) }) : Promise.resolve(),
            ]);
        },
    });
}

export function useMarkClubDiscussionTopicRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, topicId, userId }: { clubId: string; topicId: string; userId?: string | null }) => clubsService.markClubDiscussionTopicRead(topicId, userId),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.discussionRoot(variables.clubId) }),
                queryClient.invalidateQueries({ queryKey: clubKeys.discussionTopicRoot(variables.topicId) }),
                variables.userId ? queryClient.invalidateQueries({ queryKey: clubKeys.discussionTopic(variables.topicId, variables.userId) }) : Promise.resolve(),
            ]);
        },
    });
}

export function useUpdateClubEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ eventId, clubId, input }: { eventId: string; clubId: string; input: UpdateClubEventInput }) =>
            clubsService.updateClubEvent(eventId, input),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.eventsRoot(variables.clubId) }),
                queryClient.invalidateQueries({ queryKey: clubKeys.event(variables.eventId) }),
            ]);
        },
    });
}

export function useCancelClubEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ eventId, clubId, cancelledBy }: { eventId: string; clubId: string; cancelledBy: string }) =>
            clubsService.cancelClubEvent(eventId, cancelledBy),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.eventsRoot(variables.clubId) }),
                queryClient.invalidateQueries({ queryKey: clubKeys.event(variables.eventId) }),
            ]);
        },
    });
}

export function useDeleteClubEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ eventId }: { eventId: string; clubId: string }) => clubsService.deleteClubEvent(eventId),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.eventsRoot(variables.clubId) }),
                queryClient.removeQueries({ queryKey: clubKeys.event(variables.eventId) }),
            ]);
        },
    });
}

export function useUpsertClubEventRsvp() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ eventId, clubId, userId, status }: { eventId: string; clubId: string; userId: string; status: ClubEventRsvpStatus }) =>
            clubsService.upsertClubEventRsvp(eventId, userId, status),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.eventsRoot(variables.clubId) }),
                queryClient.invalidateQueries({ queryKey: clubKeys.event(variables.eventId, variables.userId) }),
            ]);
        },
    });
}

export function useCastClubBookVote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ nominationId }: { nominationId: string; clubId: string }) => clubsService.castClubBookVote(nominationId),
        onSuccess: async (_result, variables) => {
            await queryClient.invalidateQueries({ queryKey: clubKeys.nominationsRoot(variables.clubId), refetchType: 'all' });
        },
    });
}

export function useRemoveClubBookVote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ nominationId }: { nominationId: string; clubId: string }) => clubsService.removeClubBookVote(nominationId),
        onSuccess: async (_result, variables) => {
            await queryClient.invalidateQueries({ queryKey: clubKeys.nominationsRoot(variables.clubId), refetchType: 'all' });
        },
    });
}

export function useFinalizeClubBookNomination() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ nominationId }: { nominationId: string }) => clubsService.finalizeClubBookNomination(nominationId),
        onSuccess: async (result) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.nominationsRoot(result.id), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.publicDetail(result.id), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.browseRoot, refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.currentBookStatusRoot(result.id), refetchType: 'all' }),
            ]);
        },
    });
}

export function useSetClubCurrentBookReadingStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, status }: { clubId: string; status: ClubCurrentBookReadingStatus }) =>
            clubsService.setClubCurrentBookReadingStatus(clubId, status),
        onSuccess: async (_result, variables) => {
            await queryClient.invalidateQueries({ queryKey: clubKeys.currentBookStatusRoot(variables.clubId) });
        },
    });
}

export function useUpdateClub() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, updates }: { clubId: string; updates: UpdateClubInput }) => clubsService.updateClub(clubId, updates),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.publicDetail(variables.clubId) }),
                queryClient.invalidateQueries({ queryKey: clubKeys.browseRoot }),
            ]);
        },
    });
}

export function useUpdateClubMemberRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, userId, role }: { clubId: string; userId: string; role: Exclude<MemberRole, 'admin'> }) =>
            clubsService.updateMemberRole(clubId, userId, role),
        onSuccess: async (result) => {
            if (!result.club_id) return;
            await queryClient.invalidateQueries({ queryKey: clubKeys.members(result.club_id) });
        },
    });
}

export function useRemoveClubMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, userId }: { clubId: string; userId: string }) => clubsService.removeMember(clubId, userId),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.publicDetail(variables.clubId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.browseRoot, refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.members(variables.clubId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.membership(variables.clubId, variables.userId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.currentBookStatusRoot(variables.clubId), refetchType: 'all' }),
            ]);
        },
    });
}

export function useCreateClubJoinQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, input }: { clubId: string; input: ClubJoinQuestionInput }) => clubsService.createJoinQuestion(clubId, input),
        onSuccess: async (result) => {
            if (result.club_id) await queryClient.invalidateQueries({ queryKey: clubKeys.joinQuestions(result.club_id) });
        },
    });
}

export function useUpdateClubJoinQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ questionId, clubId, input }: { questionId: string; clubId: string; input: Partial<ClubJoinQuestionInput> }) => clubsService.updateJoinQuestion(questionId, input),
        onSuccess: async (_result, variables) => {
            await queryClient.invalidateQueries({ queryKey: clubKeys.joinQuestions(variables.clubId) });
        },
    });
}

export function useDeleteClubJoinQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ questionId }: { questionId: string; clubId: string }) => clubsService.deleteJoinQuestion(questionId),
        onSuccess: async (_result, variables) => {
            await queryClient.invalidateQueries({ queryKey: clubKeys.joinQuestions(variables.clubId) });
        },
    });
}

export function useCreateClubInvitation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clubId, inviteeUsername, note }: { clubId: string; inviteeUsername: string; note?: string | null }) =>
            clubsService.createClubInvitation(clubId, inviteeUsername, note),
        onSuccess: async (result) => {
            await queryClient.invalidateQueries({ queryKey: clubKeys.invitations(result.club_id) });
        },
    });
}

export function useAcceptClubInvitation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ invitationId }: { invitationId: string; clubId: string; userId: string }) =>
            clubsService.acceptClubInvitation(invitationId),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: clubKeys.publicDetail(variables.clubId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.browseRoot, refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.membership(variables.clubId, variables.userId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.members(variables.clubId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.invitations(variables.clubId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.myInvitation(variables.clubId, variables.userId), refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: clubKeys.currentBookStatusRoot(variables.clubId), refetchType: 'all' }),
            ]);
        },
    });
}