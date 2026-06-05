import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { type GoogleBook } from '@/features/books/services/booksService';
import {
    useClubMembers,
    useClubMemberActions,
    useClubJoinQuestions,
    useClubMembership,
    useClubBookNominations,
    useClubCurrentBookStatusOverview,
    useClubManageDetail,
    useCreateClubJoinQuestion,
    useDeleteClubJoinQuestion,
    useFinalizeClubBookNomination,
    useSetClubCurrentBookFromNomination,
    useNominateClubBook,
    useUpdateClub,
    useRemoveClubMember,
    useUpdateClubMemberRole,
    useUpdateClubMemberStatus,
    useCreateClubMemberAction,
    useUpdateClubJoinQuestion,
    useClubApplications,
    useReviewClubApplication,
    useClubInvitations,
    useCreateClubInvitation,
    useRevokeClubInvitation,
    useClubEvents,
    useCancelClubEvent,
    useDeleteClubEvent,
    useArchiveClub,
    useUnarchiveClub,
    useTransferClubAdmin,
    useClubAdminTransferRequests,
    useRequestClubAdminTransfer,
    useClubReadingSchedule,
    useUpsertClubReadingSchedule,
    useClubDiscussionReports,
    useResolveClubDiscussionReport,
    useClubComplaints,
    useResolveClubComplaint,
} from '@/features/clubs/hooks/useClubs';
import {
    ManageTabBar,
    ClubManageCurrentBookSection,
    ClubManageBookOverrideSection,
    ClubManageSettingsSection,
    ClubManageMembersSection,
    ClubManageJoinQuestionsSection,
    ClubManageApplicationsSection,
    ClubManageInvitationsSection,
    ClubManageAnalyticsSection,
    ClubManageEventsSection,
    ClubManageLifecycleSection,
    ClubManageReadingScheduleSection,
    ClubManageDiscussionReportsSection,
    ClubManagePlatformComplaintsSection,
} from './manage';
import {
    type FeedbackState,
    type SettingsDraft,
    createSettingsDraft,
    formatAccessLevel,
    formatMeetingType,
} from './manage';
import type { ClubComplaintResolutionAction, ClubManageDetails, ClubMemberWithProfile, ClubReadingScheduleMilestone } from '@/features/clubs/services/clubsService';

interface TabDef {
    key: string;
    label: string;
    adminOnly: boolean;
    visibleWhen?: (club: ClubManageDetails) => boolean;
}

const ALL_TABS: TabDef[] = [
    { key: 'current-book', label: 'Current Book', adminOnly: false },
    { key: 'schedule', label: 'Schedule', adminOnly: true },
    { key: 'analytics', label: 'Analytics', adminOnly: true },
    { key: 'events', label: 'Events', adminOnly: true },
    { key: 'reports', label: 'Reports', adminOnly: false },
    { key: 'applications', label: 'Applications', adminOnly: false, visibleWhen: (c) => c.club_type === 'approval' || c.club_type === 'author_club' },
    { key: 'invitations', label: 'Invitations', adminOnly: false, visibleWhen: (c) => c.club_type === 'invite_only' },
    { key: 'members', label: 'Members', adminOnly: true },
    { key: 'settings', label: 'Settings', adminOnly: true },
    { key: 'questions', label: 'Join Questions', adminOnly: true },
    { key: 'lifecycle', label: 'Lifecycle', adminOnly: true },
];

export default function ClubManageScreen() {
    const { clubId, tab } = useLocalSearchParams<{ clubId: string; tab?: string }>();
    const routeTab = typeof tab === 'string'
        ? tab
        : typeof window !== 'undefined' && window.location
        ? new URLSearchParams(window.location.search).get('tab')
        : null;
    const { colors } = useTheme();
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const { data: club, isLoading, isError, refetch: refetchClub } = useClubManageDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const isAdmin = !!userId && !!club && (club.admin_id === userId || membership?.role === 'admin');
    const isActiveModerator = membership?.role === 'moderator' && membership?.status === 'active';
    const canManageCurrentBook = !!userId && !!club && (isAdmin || isActiveModerator);

    const { data: members = [], isLoading: isMembersLoading, refetch: refetchMembers } = useClubMembers(clubId ?? null, isAdmin || isActiveModerator);
    const { data: memberActions = [], isLoading: isMemberActionsLoading, refetch: refetchMemberActions } = useClubMemberActions(clubId ?? null, null, isAdmin || isActiveModerator);
    const { data: questions = [], isLoading: isQuestionsLoading, refetch: refetchQuestions } = useClubJoinQuestions(clubId ?? null, isAdmin);
    const {
        data: nominations = [],
        isLoading: isNominationsLoading,
        isError: isNominationsError,
        error: nominationsError,
        refetch: refetchNominations,
    } = useClubBookNominations(clubId ?? null, userId, canManageCurrentBook);
    const shouldLoadCurrentBookStatus = isAdmin && !!club?.current_book_id;
    const {
        data: currentBookStatus,
        isLoading: isCurrentBookStatusLoading,
        isError: isCurrentBookStatusError,
        error: currentBookStatusError,
    } = useClubCurrentBookStatusOverview(clubId ?? null, userId, shouldLoadCurrentBookStatus);
    const { data: applications = [], isLoading: isApplicationsLoading, refetch: refetchApplications } = useClubApplications(clubId ?? null, 'pending', isAdmin || isActiveModerator);
    const { data: invitations = [], isLoading: isInvitationsLoading, refetch: refetchInvitations } = useClubInvitations(clubId ?? null, isAdmin || isActiveModerator);
    const { data: events = [], isLoading: isEventsLoading } = useClubEvents(clubId ?? null, userId, isAdmin || isActiveModerator);
    const { data: discussionReports = [], isLoading: isDiscussionReportsLoading, refetch: refetchDiscussionReports } = useClubDiscussionReports(clubId ?? null, 'open', isAdmin || isActiveModerator);
    const { data: platformComplaints = [], isLoading: isPlatformComplaintsLoading, refetch: refetchPlatformComplaints } = useClubComplaints(clubId ?? null, ['pending', 'reviewing'], isAdmin || isActiveModerator);
    const { data: adminTransferRequests = [], isLoading: isAdminTransferRequestsLoading, refetch: refetchAdminTransferRequests } = useClubAdminTransferRequests(clubId ?? null, isAdmin);
    const {
        data: readingSchedule,
        isLoading: isReadingScheduleLoading,
        refetch: refetchReadingSchedule,
    } = useClubReadingSchedule(clubId ?? null, club?.current_book_id ?? null, userId, isAdmin && !!club?.current_book_id);

    const createQuestion = useCreateClubJoinQuestion();
    const updateQuestion = useUpdateClubJoinQuestion();
    const deleteQuestion = useDeleteClubJoinQuestion();
    const finalizeNomination = useFinalizeClubBookNomination();
    const setCurrentBookFromNomination = useSetClubCurrentBookFromNomination();
    const nominateMutation = useNominateClubBook();
    const updateClub = useUpdateClub();
    const removeMember = useRemoveClubMember();
    const updateMemberRole = useUpdateClubMemberRole();
    const updateMemberStatus = useUpdateClubMemberStatus();
    const createMemberAction = useCreateClubMemberAction();
    const reviewApplication = useReviewClubApplication();
    const createInvitation = useCreateClubInvitation();
    const revokeInvitation = useRevokeClubInvitation();
    const cancelEvent = useCancelClubEvent();
    const deleteEvent = useDeleteClubEvent();
    const archiveClub = useArchiveClub();
    const unarchiveClub = useUnarchiveClub();
    const transferClubAdmin = useTransferClubAdmin();
    const requestClubAdminTransfer = useRequestClubAdminTransfer();
    const upsertReadingSchedule = useUpsertClubReadingSchedule();
    const resolveDiscussionReport = useResolveClubDiscussionReport();
    const resolveClubComplaint = useResolveClubComplaint();

    const [settings, setSettings] = useState<SettingsDraft | null>(null);
    const [feedback, setFeedback] = useState<FeedbackState>(null);
    const initialRouteTab = routeTab && ALL_TABS.some((item) => item.key === routeTab) ? routeTab : 'current-book';
    const [activeTab, setActiveTab] = useState(initialRouteTab);
    const [showOverride, setShowOverride] = useState(false);
    const [appliedRouteTab, setAppliedRouteTab] = useState<string | null>(null);

    useEffect(() => {
        if (club) setSettings(createSettingsDraft(club));
    }, [club]);

    const visibleTabs = useMemo(() => {
        if (!club) return [];
        return ALL_TABS.filter((tab) => {
            if (tab.adminOnly && !isAdmin) return false;
            if (tab.visibleWhen && !tab.visibleWhen(club)) return false;
            return true;
        });
    }, [club, isAdmin]);

    useEffect(() => {
        const requestedTab = routeTab;
        if (requestedTab && requestedTab !== appliedRouteTab && visibleTabs.some((item) => item.key === requestedTab)) {
            setActiveTab(requestedTab);
            setAppliedRouteTab(requestedTab);
            return;
        }
        if (requestedTab !== appliedRouteTab) {
            setAppliedRouteTab(requestedTab);
        }
        if (!visibleTabs.some((item) => item.key === activeTab) && visibleTabs[0]) {
            setActiveTab(visibleTabs[0].key);
        }
    }, [activeTab, appliedRouteTab, routeTab, visibleTabs]);

    if (isLoading || isMembershipLoading || !settings) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    if (isError || !club) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <Text style={{ color: colors.error }}>Failed to load club data.</Text>
            </View>
        );
    }

    if (!canManageCurrentBook) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <Text style={{ color: colors.error }}>You do not have permission to manage this club.</Text>
            </View>
        );
    }

    const onFeedback = (fb: FeedbackState) => setFeedback(fb);

    const handleSaveSettings = async (draft: SettingsDraft) => {
        if (!clubId || !club) return;
        try {
            onFeedback(null);
            await updateClub.mutateAsync({
                clubId,
                updates: {
                    name: draft.name,
                    description: draft.description,
                    cover_url: draft.coverUrl,
                    max_members: draft.maxMembers ? Number.parseInt(draft.maxMembers, 10) : null,
                    access_level: draft.accessLevel,
                    meeting_type: draft.meetingType,
                    ...(club.club_type !== 'author_club' ? { club_type: draft.clubType } : {}),
                },
            });
            onFeedback({ type: 'success', message: 'Basic club settings saved.' });
            await refetchClub();
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save club settings right now.' });
        }
    };

    const handleToggleRole = async (member: ClubMemberWithProfile, nextRole: 'member' | 'moderator') => {
        if (!clubId || !member.user_id) throw new Error('Missing data');
        await updateMemberRole.mutateAsync({ clubId, userId: member.user_id, role: nextRole });
        await refetchMembers();
    };

    const handleToggleMute = async (member: ClubMemberWithProfile, nextStatus: 'active' | 'muted') => {
        if (!clubId || !member.user_id) throw new Error('Missing data');
        await updateMemberStatus.mutateAsync({ clubId, userId: member.user_id, status: nextStatus });
        await refetchMembers();
    };

    const handleCreateMemberAction = async (member: ClubMemberWithProfile, actionType: 'warned' | 'muted' | 'banned', reason: string, durationHours?: number | null) => {
        if (!clubId || !member.user_id) throw new Error('Missing member context');
        await createMemberAction.mutateAsync({ clubId, userId: member.user_id, actionType, reason, durationHours });
        await Promise.all([refetchMembers(), refetchMemberActions()]);
    };

    const handleRemoveMember = async (member: ClubMemberWithProfile) => {
        if (!clubId || !member.user_id) throw new Error('Missing data');
        await removeMember.mutateAsync({ clubId, userId: member.user_id });
        await refetchMembers();
    };

    const handleCreateQuestion = async (input: { question: string; isRequired: boolean; orderIndex: number }) => {
        if (!clubId) throw new Error('Missing clubId');
        await createQuestion.mutateAsync({ clubId, input });
        await refetchQuestions();
    };

    const handleUpdateQuestion = async (questionId: string, input: { question: string; isRequired: boolean }) => {
        if (!clubId) throw new Error('Missing clubId');
        await updateQuestion.mutateAsync({ questionId, clubId, input });
        await refetchQuestions();
    };

    const handleDeleteQuestion = async (questionId: string) => {
        if (!clubId) throw new Error('Missing clubId');
        await deleteQuestion.mutateAsync({ questionId, clubId });
        await refetchQuestions();
    };

    const handleFinalize = async (nominationId: string) => {
        if (!clubId || !isAdmin) throw new Error('Not authorized');
        try {
            onFeedback(null);
            await finalizeNomination.mutateAsync({ nominationId });
            onFeedback({ type: 'success', message: 'Current book finalized successfully.' });
            await Promise.all([refetchClub(), refetchNominations()]);
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to finalize the current book right now.' });
        }
    };

    const handleSetCurrentBook = async (nominationId: string) => {
        if (!clubId || !isAdmin) throw new Error('Not authorized');
        try {
            onFeedback(null);
            await setCurrentBookFromNomination.mutateAsync({ nominationId });
            onFeedback({ type: 'success', message: 'Current book updated successfully.' });
            await Promise.all([refetchClub(), refetchNominations()]);
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to set the current book right now.' });
        }
    };

    const handleOverride = async (book: GoogleBook) => {
        if (!clubId || !isAdmin) throw new Error('Not authorized');
        const pastDate = new Date();
        pastDate.setSeconds(pastDate.getSeconds() - 5);
        const nomination = await nominateMutation.mutateAsync({
            clubId,
            googleBook: book,
            votingEndsAt: pastDate.toISOString(),
        });
        await finalizeNomination.mutateAsync({ nominationId: nomination.id });
        await Promise.all([refetchClub(), refetchNominations()]);
    };

    const handleReviewApp = async (applicationId: string, action: 'approve' | 'decline') => {
        const decision = action === 'approve' ? 'approved' : 'declined';
        await reviewApplication.mutateAsync({ applicationId, decision });
        await refetchApplications();
    };

    const handleCreateInvite = async (inviteeUsername: string) => {
        if (!clubId) throw new Error('Missing clubId');
        await createInvitation.mutateAsync({ clubId, inviteeUsername });
        await refetchInvitations();
    };

    const handleRevokeInvite = async (invitationId: string) => {
        if (!clubId) throw new Error('Missing clubId');
        await revokeInvitation.mutateAsync({ clubId, invitationId });
        await refetchInvitations();
    };

    const handleCancelEvent = async (eventId: string) => {
        if (!clubId || !userId) throw new Error('Missing data');
        await cancelEvent.mutateAsync({ eventId, clubId, cancelledBy: userId });
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!clubId) throw new Error('Missing clubId');
        await deleteEvent.mutateAsync({ eventId, clubId });
    };

    const handleArchiveClub = async () => {
        if (!clubId) throw new Error('Missing clubId');
        await archiveClub.mutateAsync({ clubId });
        await refetchClub();
    };

    const handleUnarchiveClub = async () => {
        if (!clubId) throw new Error('Missing clubId');
        await unarchiveClub.mutateAsync({ clubId });
        await refetchClub();
    };

    const handleRequestTransferAdmin = async (newAdminUserId: string) => {
        if (!clubId) throw new Error('Missing clubId');
        await requestClubAdminTransfer.mutateAsync({ clubId, newAdminUserId });
        await refetchAdminTransferRequests();
    };

    const handleSaveReadingSchedule = async (milestones: ClubReadingScheduleMilestone[]) => {
        if (!clubId || !club.current_book_id) throw new Error('Set a current book before creating a reading schedule.');
        await upsertReadingSchedule.mutateAsync({ clubId, bookId: club.current_book_id, milestones, createdBy: userId });
        await refetchReadingSchedule();
    };

    const handleResolveDiscussionReport = async (reportId: string) => {
        if (!clubId) throw new Error('Missing clubId');
        await resolveDiscussionReport.mutateAsync({ clubId, reportId });
        await refetchDiscussionReports();
    };

    const handleResolvePlatformComplaint = async (complaintId: string, resolutionAction: ClubComplaintResolutionAction) => {
        if (!clubId) throw new Error('Missing clubId');
        if (resolutionAction !== 'no_action') {
            const complaint = platformComplaints.find((item) => item.id === complaintId);
            if (!complaint?.reported_user_id) throw new Error('This complaint is missing a reported member.');
            const member = members.find((item) => item.user_id === complaint.reported_user_id);
            if (!member?.user_id) throw new Error('Reported member is not available in the current member list.');
            const reason = complaint.description?.trim() || `Platform complaint: ${complaint.reason}`;
            await createMemberAction.mutateAsync({
                clubId,
                userId: member.user_id,
                actionType: resolutionAction,
                reason,
                durationHours: resolutionAction === 'muted' ? 24 : null,
            });
        }
        await resolveClubComplaint.mutateAsync({ clubId, complaintId, status: 'resolved', resolutionAction });
        await Promise.all([refetchPlatformComplaints(), refetchMembers(), refetchMemberActions()]);
    };

    const handleCreateEvent = () => {
        router.push(`/clubs/${clubId}/events/create?returnTo=manage&manageTab=events`);
    };

    const handleEditEvent = (eventId: string) => {
        router.push(`/clubs/${clubId}/events/${eventId}/edit?returnTo=manage&manageTab=events`);
    };

    const moderatorsCount = members.filter((m) => m.role === 'moderator').length;

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}`)} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Manage Club</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.headerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{club.name}</Text>
                <Text style={[styles.headerMeta, { color: colors.textSecondary }]}>
                    {formatAccessLevel(club.access_level ?? 'all')} � {formatMeetingType(club.meeting_type ?? null)}
                </Text>
            </View>

            {feedback && (
                <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'error' ? colors.errorLight : colors.accentLight, borderColor: feedback.type === 'error' ? colors.error : colors.accent }]}>
                    <Text style={{ color: feedback.type === 'error' ? colors.error : colors.accent }}>{feedback.message}</Text>
                </View>
            )}

            <ManageTabBar tabs={visibleTabs.map((t) => ({ key: t.key, label: t.label }))} activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === 'current-book' && (
                <>
                    {!showOverride ? (
                        <ClubManageCurrentBookSection
                            club={club}
                            nominations={nominations}
                            isLoading={isNominationsLoading}
                            isError={isNominationsError}
                            error={nominationsError}
                            isAdmin={isAdmin}
                            onFinalize={handleFinalize}
                            onSetCurrentBook={handleSetCurrentBook}
                            onShowOverride={() => setShowOverride(true)}
                        />
                    ) : (
                        <ClubManageBookOverrideSection
                            clubId={clubId}
                            onOverride={handleOverride}
                            onClose={() => setShowOverride(false)}
                            onFeedback={onFeedback}
                        />
                    )}
                </>
            )}

            {activeTab === 'applications' && (
                <ClubManageApplicationsSection
                    applications={applications}
                    isLoading={isApplicationsLoading}
                    onReview={handleReviewApp}
                    onFeedback={onFeedback}
                />
            )}

            {activeTab === 'schedule' && (
                <ClubManageReadingScheduleSection
                    bookId={club.current_book_id}
                    schedule={readingSchedule}
                    isLoading={isReadingScheduleLoading}
                    isSaving={upsertReadingSchedule.isPending}
                    onSave={handleSaveReadingSchedule}
                    onFeedback={onFeedback}
                />
            )}

            {activeTab === 'invitations' && (
                <ClubManageInvitationsSection
                    invitations={invitations}
                    isLoading={isInvitationsLoading}
                    isCreating={createInvitation.isPending}
                    isRevoking={revokeInvitation.isPending}
                    onCreate={handleCreateInvite}
                    onRevoke={handleRevokeInvite}
                    onFeedback={onFeedback}
                />
            )}

            {activeTab === 'members' && (
                <ClubManageMembersSection
                    club={club}
                    members={members}
                    actions={memberActions}
                    isLoading={isMembersLoading}
                    isActionsLoading={isMemberActionsLoading}
                    onToggleRole={handleToggleRole}
                    onToggleMute={handleToggleMute}
                    onCreateAction={handleCreateMemberAction}
                    onRemove={handleRemoveMember}
                    onFeedback={onFeedback}
                />
            )}

            {activeTab === 'analytics' && (
                <ClubManageAnalyticsSection
                    club={club}
                    membersCount={members.length}
                    moderatorsCount={moderatorsCount}
                    nominations={nominations}
                    events={events}
                    currentBookStatus={currentBookStatus ?? null}
                    isCurrentBookStatusError={isCurrentBookStatusError}
                    currentBookStatusError={currentBookStatusError}
                    isLoading={isMembersLoading || isNominationsLoading || isEventsLoading || isCurrentBookStatusLoading}
                />
            )}

            {activeTab === 'events' && (
                <ClubManageEventsSection
                    events={events}
                    isLoading={isEventsLoading}
                    canCreate={isAdmin}
                    canManageEvent={() => isAdmin}
                    onCreate={handleCreateEvent}
                    onEdit={handleEditEvent}
                    onCancel={handleCancelEvent}
                    onDelete={handleDeleteEvent}
                    onFeedback={onFeedback}
                />
            )}

            {activeTab === 'reports' && (
                <>
                    <ClubManageDiscussionReportsSection
                        reports={discussionReports}
                        isLoading={isDiscussionReportsLoading}
                        isResolving={resolveDiscussionReport.isPending}
                        onResolve={handleResolveDiscussionReport}
                        onFeedback={onFeedback}
                    />
                    <ClubManagePlatformComplaintsSection
                        complaints={platformComplaints}
                        isLoading={isPlatformComplaintsLoading}
                        isResolving={resolveClubComplaint.isPending}
                        onResolve={handleResolvePlatformComplaint}
                        onFeedback={onFeedback}
                    />
                </>
            )}

            {activeTab === 'settings' && (
                <ClubManageSettingsSection
                    club={club}
                    settings={settings}
                    setSettings={setSettings}
                    isSaving={updateClub.isPending}
                    onSave={handleSaveSettings}
                    onReset={() => { setSettings(createSettingsDraft(club)); onFeedback(null); }}
                />
            )}

            {activeTab === 'questions' && (
                <ClubManageJoinQuestionsSection
                    clubId={clubId}
                    questions={questions}
                    isLoading={isQuestionsLoading}
                    onCreate={handleCreateQuestion}
                    onUpdate={handleUpdateQuestion}
                    onDelete={handleDeleteQuestion}
                    onFeedback={onFeedback}
                />
            )}

            {activeTab === 'lifecycle' && (
                <ClubManageLifecycleSection
                    club={club}
                    members={members}
                    isLoading={isMembersLoading}
                    requests={adminTransferRequests}
                    isRequestsLoading={isAdminTransferRequestsLoading}
                    isArchiving={archiveClub.isPending}
                    isUnarchiving={unarchiveClub.isPending}
                    isTransferring={requestClubAdminTransfer.isPending || transferClubAdmin.isPending}
                    onArchive={handleArchiveClub}
                    onUnarchive={handleUnarchiveClub}
                    onTransferAdmin={handleRequestTransferAdmin}
                    onFeedback={onFeedback}
                />
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 14,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' },
    headerSpacer: { width: 40 },
    headerCard: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
    },
    cardHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    headerMeta: {
        fontSize: 13,
        marginTop: 4,
    },
    feedbackBanner: {
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 14,
    },
});
