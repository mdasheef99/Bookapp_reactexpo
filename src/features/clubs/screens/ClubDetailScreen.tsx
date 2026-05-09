import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { router, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { profileService } from '@/features/auth/services/profileService';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useAcceptClubInvitation, useCastClubBookVote, useClubBookNominations, useClubCurrentBookStatusOverview, useClubJoinQuestions, useClubMembers, useClubMembership, useClubPublicDetail, useJoinClub, useLeaveClub, useMyClubApplication, useMyClubInvitation, useRemoveClubBookVote, useSetClubCurrentBookReadingStatus } from '@/features/clubs/hooks/useClubs';
import { ClubMemberList } from '@/features/clubs/components/ClubMemberList';
import { getClubAccessRequirementMessage, getClubsEntitlementErrorMessage, membershipTierSatisfiesAccessLevel } from '@/features/clubs/services/clubsEntitlement';
import type { AccessLevel, ClubBookNominationWithDetails, ClubCurrentBookReadingStatus, ClubJoinQuestion, ClubType, MeetingType, MembershipTier } from '@/features/clubs/services/clubsService';

const CLUB_TYPE_LABELS: Record<ClubType, string> = {
    public: 'Public club',
    approval: 'Approval club',
    invite_only: 'Invite-only club',
    author_club: 'Author club',
};

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
    all: 'All members',
    pro: 'Pro members',
    pro_plus: 'Pro+ members',
};

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
    online_only: 'Online only',
    venue_based: 'Venue based',
    hybrid: 'Hybrid',
};

const CURRENT_BOOK_STATUS_LABELS: Record<ClubCurrentBookReadingStatus, string> = {
    want_to_read: 'To start',
    reading: 'Reading',
    completed: 'Completed',
};

function getQuestionPlaceholder(question: ClubJoinQuestion) {
    return question.is_required ? 'Required answer' : 'Optional answer';
}

function getNominationCoverUrl(nomination: ClubBookNominationWithDetails) {
    const imageUrl = nomination.book?.cover_url;
    if (!imageUrl) return 'https://via.placeholder.com/96x144?text=Book';
    return imageUrl.replace(/^http:\/\//i, 'https://');
}

function formatNominationStatus(status: ClubBookNominationWithDetails['status']) {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function hasNominationVotingClosed(votingEndsAt: string | null) {
    if (!votingEndsAt) return false;
    const votingEndTime = Date.parse(votingEndsAt);
    if (Number.isNaN(votingEndTime)) return false;
    return votingEndTime <= Date.now();
}

export default function ClubDetailScreen() {
    const { clubId, tab } = useLocalSearchParams<{ clubId: string; tab?: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading, isError, refetch } = useClubPublicDetail(clubId ?? null);
    const joinMutation = useJoinClub();
    const acceptInvitationMutation = useAcceptClubInvitation();
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const isMember = membership?.status === 'active' || membership?.status === 'muted';
    const shouldLoadApplicationData = club?.club_type === 'approval' || club?.club_type === 'author_club';
    const shouldLoadInvitationData = club?.club_type === 'invite_only' && !!userId && !isMember;
    const isManager = !!userId && (club?.admin_id === userId || membership?.role === 'admin' || membership?.role === 'moderator');
    const isAdmin = !!userId && (club?.admin_id === userId || membership?.role === 'admin');
    const { data: joinQuestions = [], isLoading: isQuestionsLoading } = useClubJoinQuestions(clubId ?? null, shouldLoadApplicationData);
    const { data: myApplication, isLoading: isApplicationLoading } = useMyClubApplication(clubId ?? null, userId, shouldLoadApplicationData);
    const { data: myInvitation, isLoading: isInvitationLoading } = useMyClubInvitation(clubId ?? null, userId, shouldLoadInvitationData);
    const { data: members = [], isLoading: isMembersLoading } = useClubMembers(clubId ?? null, isMember);
    const { data: nominations = [], isLoading: isNominationsLoading, isError: isNominationsError, error: nominationsError, refetch: refetchNominations } = useClubBookNominations(clubId ?? null, userId, isMember);
    const shouldLoadCurrentBookStatus = isMember && !!club?.current_book_id;
    const { data: currentBookStatus, isLoading: isCurrentBookStatusLoading, isError: isCurrentBookStatusError, error: currentBookStatusError, refetch: refetchCurrentBookStatus } = useClubCurrentBookStatusOverview(clubId ?? null, userId, shouldLoadCurrentBookStatus);
    const castVoteMutation = useCastClubBookVote();
    const removeVoteMutation = useRemoveClubBookVote();
    const setCurrentBookStatusMutation = useSetClubCurrentBookReadingStatus();
    const leaveClubMutation = useLeaveClub();
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [bookFeedback, setBookFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [currentBookFeedback, setCurrentBookFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [viewerMembershipTier, setViewerMembershipTier] = useState<MembershipTier | null>(null);
    const [activeTab, setActiveTab] = useState<'about' | 'current-book' | 'nominations' | 'events' | 'discussion'>(() => {
        if (tab === 'current-book' || tab === 'nominations' || tab === 'events' || tab === 'discussion') {
            return tab;
        }
        return 'about';
    });

    const tabs = [
        { key: 'about' as const, label: 'About' },
        { key: 'current-book' as const, label: 'Current Book' },
        { key: 'nominations' as const, label: 'Nominations' },
        { key: 'events' as const, label: 'Events' },
        { key: 'discussion' as const, label: 'Discussion' },
    ];

    useEffect(() => {
        let isMounted = true;

        if (!userId) {
            setViewerMembershipTier(null);
            return () => {
                isMounted = false;
            };
        }

        void profileService.getProfileSummary(userId)
            .then((profile) => {
                if (isMounted) setViewerMembershipTier(profile?.membership_tier ?? 'free');
            })
            .catch(() => {
                if (isMounted) setViewerMembershipTier(null);
            });

        return () => {
            isMounted = false;
        };
    }, [userId]);

    useEffect(() => {
        if (tab === 'about' || tab === 'current-book' || tab === 'nominations' || tab === 'events' || tab === 'discussion') {
            setActiveTab(tab);
        }
    }, [tab]);

    useEffect(() => {
        if (!myApplication?.answers) return;
        setAnswers((current) => (Object.keys(current).length > 0 ? current : myApplication.answers));
    }, [myApplication]);

    const requiredQuestionErrors = useMemo(() => {
        return joinQuestions.filter((question) => question.is_required).filter((question) => !answers[question.id]?.trim()).map((question) => question.id);
    }, [answers, joinQuestions]);

    if (isLoading) {
        return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    }
    if (isError || !club) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}>
                <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Unable to load this club</Text>
                <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.accent }]} onPress={() => refetch()}><Text style={styles.backButtonText}>Retry</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => navigateBackOrFallback(router, '/(tabs)/clubs')}><Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Go back</Text></TouchableOpacity>
            </View>
        );
    }

    const coverUrl = club.cover_url || club.current_book_cover_url || 'https://via.placeholder.com/160x240?text=Club';
    const hostName = club.author_display_name || club.admin_display_name || 'BookTalks Reader';
    const canJoinDirectly = club.club_type === 'public';
    const requiresApplication = club.club_type === 'approval' || club.club_type === 'author_club';
    const isJoinFlowLoading = isMembershipLoading || (shouldLoadApplicationData && (isQuestionsLoading || isApplicationLoading)) || isInvitationLoading;
    const meetsClubAccessRequirement = viewerMembershipTier ? membershipTierSatisfiesAccessLevel(viewerMembershipTier, club.access_level ?? 'all') : null;
    const blocksDirectJoin = !isMember && !!userId && canJoinDirectly && meetsClubAccessRequirement === false;
    const blocksInvitationAcceptance = !isMember && !!userId && !!myInvitation && meetsClubAccessRequirement === false;
    const canManageBookActions = membership?.status === 'active';
    const canOpenManageClub = isAdmin || (membership?.role === 'moderator' && membership?.status === 'active');

    const handleCurrentBookStatusChange = async (status: ClubCurrentBookReadingStatus) => {
        if (!clubId || !club.current_book_id || !canManageBookActions) {
            return setCurrentBookFeedback({ type: 'error', message: 'Only active club members can update current-book reading status.' });
        }

        try {
            setCurrentBookFeedback(null);
            await setCurrentBookStatusMutation.mutateAsync({ clubId, status });
            setCurrentBookFeedback({ type: 'success', message: `Your current-book status is now ${CURRENT_BOOK_STATUS_LABELS[status]}.` });
        } catch (error) {
            setCurrentBookFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to update your current-book status right now.') });
        }
    };

    const handleVoteToggle = async (nomination: ClubBookNominationWithDetails) => {
        if (!clubId || !userId) {
            return setBookFeedback({ type: 'error', message: 'You must be signed in as an active club member to vote.' });
        }

        try {
            setBookFeedback(null);
            if (nomination.currentUserVote) {
                await removeVoteMutation.mutateAsync({ nominationId: nomination.id, clubId });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setBookFeedback({ type: 'success', message: 'Your vote was removed.' });
            } else {
                await castVoteMutation.mutateAsync({ nominationId: nomination.id, clubId });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setBookFeedback({ type: 'success', message: 'Your vote was recorded.' });
            }
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setBookFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to update your vote right now.') });
        }
    };

    const handleJoinAction = async () => {
        if (!clubId || !userId) return setActionFeedback({ type: 'error', message: 'You must be signed in to join or apply.' });
        if (requiresApplication && requiredQuestionErrors.length > 0) return setActionFeedback({ type: 'error', message: 'Please answer all required join questions before applying.' });
        if (blocksDirectJoin) {
            return setActionFeedback({ type: 'error', message: getClubAccessRequirementMessage(club.access_level ?? 'all', viewerMembershipTier, 'join this club') });
        }

        try {
            setActionFeedback(null);
            const result = await joinMutation.mutateAsync({ clubId, userId, answers });
            setActionFeedback({ type: 'success', message: result.status === 'joined' ? 'You are now an active member of this club.' : 'Your application has been submitted for review.' });
        } catch (error) {
            setActionFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to complete this club action right now.') });
        }
    };

    const handleAcceptInvitation = async () => {
        if (!clubId || !userId || !myInvitation) return setActionFeedback({ type: 'error', message: 'No pending invitation is available to accept for this account.' });
        if (blocksInvitationAcceptance) {
            return setActionFeedback({ type: 'error', message: getClubAccessRequirementMessage(club.access_level ?? 'all', viewerMembershipTier, 'accept this invitation') });
        }

        try {
            setActionFeedback(null);
            await acceptInvitationMutation.mutateAsync({ invitationId: myInvitation.id, clubId, userId });
            setActionFeedback({ type: 'success', message: 'Invitation accepted. You are now an active member of this club.' });
        } catch (error) {
            setActionFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to accept this invitation right now.') });
        }
    };

    const handleLeaveClub = () => {
        if (!clubId || !userId) return;
        setShowLeaveConfirm(true);
    };

    const executeLeave = async () => {
        setShowLeaveConfirm(false);
        try {
            setActionFeedback(null);
            await leaveClubMutation.mutateAsync({ clubId, userId });
            router.push('/clubs');
        } catch (error) {
            setActionFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to leave this club right now.') });
        }
    };

    const renderAboutTab = () => (
        <>
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Club details</Text>
                <View style={styles.detailGrid}>
                    <View style={styles.detailItem}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Access requirement</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{ACCESS_LEVEL_LABELS[club.access_level ?? 'all']}</Text></View>
                    <View style={styles.detailItem}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Meeting format</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{club.meeting_type ? MEETING_TYPE_LABELS[club.meeting_type] : 'Flexible format'}</Text></View>
                    <View style={styles.detailItem}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Club admin</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{club.admin_display_name || 'BookTalks Reader'}</Text></View>
                    <View style={styles.detailItem}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Member capacity</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{club.max_members ? `${club.max_members} readers` : 'Open capacity'}</Text></View>
                    {club.author_display_name ? <View style={styles.detailItem}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Featured author</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{club.author_display_name}</Text></View> : null}
                    {(club.admin_city || club.author_city) ? <View style={styles.detailItem}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Community city</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{club.author_city || club.admin_city}</Text></View> : null}
                </View>
            </View>
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Join this club</Text>
                <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>Public clubs support direct joins here, approval and author clubs support applications, and invite-only clubs require invitations that invited readers can accept here.</Text>
                {!userId ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>You need an authenticated session before you can join or apply.</Text></View> : null}
                {isJoinFlowLoading ? <View style={styles.inlineLoadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Preparing the right join flow…</Text></View> : null}
                {membership?.status === 'banned' ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Membership restricted</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>This account is currently banned from the club and cannot join or apply.</Text></View> : null}
                {isMember ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>{membership?.status === 'muted' ? 'You are a muted member' : 'You are already a member'}</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Member-only spaces like discussion, club events, nominations, and the private member list are available here now.</Text></View> : null}
                {isMember ? <TouchableOpacity onPress={handleLeaveClub} disabled={leaveClubMutation.isPending} style={[styles.dangerButton, { borderColor: colors.error, opacity: leaveClubMutation.isPending ? 0.65 : 1 }]} testID="club-leave"><Text style={[styles.dangerButtonText, { color: colors.error }]}>{leaveClubMutation.isPending ? 'Leaving…' : 'Leave club'}</Text></TouchableOpacity> : null}
                {!isMember && userId && meetsClubAccessRequirement === false ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]} testID="club-entitlement-warning"><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Membership tier required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{canJoinDirectly || myInvitation ? getClubAccessRequirementMessage(club.access_level ?? 'all', viewerMembershipTier, canJoinDirectly ? 'join this club' : 'accept this invitation') : `This club currently requires ${ACCESS_LEVEL_LABELS[club.access_level ?? 'all']}. If your application is approved, membership cannot become active until your subscription tier meets that requirement.`}</Text></View> : null}
                {!isMember && myApplication?.status === 'pending' ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Application pending</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Your application is waiting for moderator review. You do not need to submit it again.</Text></View> : null}
                {!isMember && myApplication?.status === 'declined' ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Application declined</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{myApplication.decline_reason || 'Your previous application was declined. Reapply is not available in this version yet.'}</Text></View> : null}
                {!isMember && club.club_type === 'invite_only' && myInvitation ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Invitation ready</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>You have a pending invitation from {myInvitation.inviterProfile?.display_name || 'a club manager'}. Accepting it adds you to the club immediately through the live invite workflow.</Text>{myInvitation.note ? <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{`Note: ${myInvitation.note}`}</Text> : null}</View> : null}
                {!isMember && club.club_type === 'invite_only' && !myInvitation ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Invite required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Invite-only clubs require a moderator or admin invitation. If you have already been invited, sign in with the invited account to accept it here. Revoke and read-state flows still depend on backend support.</Text></View> : null}
                {!isMember && requiresApplication && !myApplication ? <View style={styles.joinSection}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Join questions</Text><Text style={[styles.sectionBody, { color: colors.textSecondary }]}>Answer the questions below to apply for moderator review.</Text>{joinQuestions.length === 0 ? <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>This club does not currently require written answers, so your application can be sent immediately.</Text> : null}{joinQuestions.map((question) => { const hasError = requiredQuestionErrors.includes(question.id); return <View key={question.id} style={styles.questionBlock}><Text style={[styles.questionLabel, { color: colors.textPrimary }]}>{question.question}{question.is_required ? ' *' : ''}</Text><TextInput value={answers[question.id] ?? ''} onChangeText={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} placeholder={getQuestionPlaceholder(question)} placeholderTextColor={colors.textTertiary} multiline style={[styles.answerInput, { color: colors.textPrimary, borderColor: hasError ? '#DC2626' : colors.border, backgroundColor: colors.bgPrimary }]} testID={`join-question-${question.id}`} /></View>; })}</View> : null}
                {!isMember && !myApplication && userId && (canJoinDirectly || requiresApplication) ? <TouchableOpacity onPress={handleJoinAction} disabled={joinMutation.isPending || blocksDirectJoin} style={[styles.primaryActionButton, { backgroundColor: colors.accent, opacity: joinMutation.isPending || blocksDirectJoin ? 0.65 : 1 }]} testID="club-primary-action"><Text style={styles.primaryActionText}>{joinMutation.isPending ? 'Working…' : canJoinDirectly ? 'Join this club' : 'Apply to join'}</Text></TouchableOpacity> : null}
                {!isMember && club.club_type === 'invite_only' && userId && myInvitation ? <TouchableOpacity onPress={handleAcceptInvitation} disabled={acceptInvitationMutation.isPending || blocksInvitationAcceptance} style={[styles.primaryActionButton, { backgroundColor: colors.accent, opacity: acceptInvitationMutation.isPending || blocksInvitationAcceptance ? 0.65 : 1 }]} testID="club-accept-invitation"><Text style={styles.primaryActionText}>{acceptInvitationMutation.isPending ? 'Accepting…' : 'Accept invitation'}</Text></TouchableOpacity> : null}
                {actionFeedback ? <View style={[styles.feedbackBanner, { backgroundColor: actionFeedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: actionFeedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: actionFeedback.type === 'success' ? '#166534' : '#991B1B' }]}>{actionFeedback.message}</Text></View> : null}
            </View>
            {requiresApplication && isManager ? <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Moderator tools</Text><Text style={[styles.sectionBody, { color: colors.textSecondary }]}>Review pending join applications for this club with the live moderator workflow.</Text><TouchableOpacity style={[styles.secondaryActionButton, { borderColor: colors.accent }]} onPress={() => router.push(`/clubs/${club.id}/applications`)} testID="club-review-applications"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Review applications</Text></TouchableOpacity></View> : null}
            {club.club_type === 'invite_only' && isManager ? <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Invitation tools</Text><Text style={[styles.sectionBody, { color: colors.textSecondary }]}>Username-based invitation creation and invitation history are live here. Revocation and read tracking still depend on backend workflows that are not exposed live yet.</Text><TouchableOpacity style={[styles.secondaryActionButton, { borderColor: colors.accent }]} onPress={() => router.push(`/clubs/${club.id}/invite`)} testID="club-invite-readers"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Invite readers</Text></TouchableOpacity></View> : null}
            {canOpenManageClub ? <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Club management</Text><Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{isAdmin ? 'Open Manage Club for current-book management, plus the existing basic settings, member-role management, remove-member workflows, and join-question management.' : 'Open Manage Club to review nominations and finalize the current book after voting closes. The broader settings, member-role management, remove-member workflows, and join-question management stay admin-only.'}</Text><TouchableOpacity style={[styles.secondaryActionButton, { borderColor: colors.accent }]} onPress={() => router.push(`/clubs/${club.id}/manage`)} testID="club-manage"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Manage club</Text></TouchableOpacity></View> : null}
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Members</Text>
                {!isMember ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Member list is private</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>The current Clubs spec allows all visitors to see public club details, but member names only become visible after you join.</Text></View> : isMembersLoading ? <View style={styles.inlineLoadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Loading members…</Text></View> : members.length === 0 ? <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>No active member cards are available yet.</Text> : <ClubMemberList members={members} colors={colors} />}
            </View>
        </>
    );

    const renderCurrentBookTab = () => (
        <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Current read</Text>
            <Text style={[styles.sectionPrimary, { color: colors.textPrimary }]}>{club.current_book_title || 'No current book selected yet'}</Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{club.current_book_authors?.join(', ') || 'Once a book is selected it will appear here for all visitors.'}</Text>
            {isMember && club.current_book_id ? (
                <>
                    {isCurrentBookStatusLoading ? <View style={styles.inlineLoadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Loading current-book progress…</Text></View> : null}
                    {isCurrentBookStatusError ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Unable to load current-book progress</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(currentBookStatusError, 'Unable to load current-book progress right now.')}</Text><TouchableOpacity style={[styles.secondaryActionButton, { borderColor: colors.accent }]} onPress={() => refetchCurrentBookStatus()} testID="club-current-book-status-retry"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Retry</Text></TouchableOpacity></View> : null}
                    {!isCurrentBookStatusLoading && !isCurrentBookStatusError && currentBookStatus ? (
                        <>
                            <View style={styles.currentBookStatsGrid}>
                                <View style={[styles.currentBookStatCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.currentBookStatLabel, { color: colors.textSecondary }]}>Active members</Text><Text style={[styles.currentBookStatValue, { color: colors.textPrimary }]}>{currentBookStatus.active_member_count}</Text></View>
                                <View style={[styles.currentBookStatCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.currentBookStatLabel, { color: colors.textSecondary }]}>To start</Text><Text style={[styles.currentBookStatValue, { color: colors.textPrimary }]}>{currentBookStatus.to_start_count}</Text></View>
                                <View style={[styles.currentBookStatCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.currentBookStatLabel, { color: colors.textSecondary }]}>Reading</Text><Text style={[styles.currentBookStatValue, { color: colors.textPrimary }]}>{currentBookStatus.reading_count}</Text></View>
                                <View style={[styles.currentBookStatCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.currentBookStatLabel, { color: colors.textSecondary }]}>Completed</Text><Text style={[styles.currentBookStatValue, { color: colors.textPrimary }]}>{currentBookStatus.completed_count}</Text></View>
                            </View>
                            <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                                <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Your club reading status</Text>
                                <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{`Current status: ${CURRENT_BOOK_STATUS_LABELS[currentBookStatus.member_reading_status ?? 'want_to_read']}`}</Text>
                                {canManageBookActions ? <View style={styles.currentBookActionsRow}>{(['want_to_read', 'reading', 'completed'] as ClubCurrentBookReadingStatus[]).map((status) => {
                                    const isSelected = (currentBookStatus.member_reading_status ?? 'want_to_read') === status;
                                    const isDisabled = setCurrentBookStatusMutation.isPending;
                                    return <TouchableOpacity key={status} onPress={() => handleCurrentBookStatusChange(status)} disabled={isDisabled} style={[styles.currentBookStatusButton, { backgroundColor: isSelected ? colors.accent : colors.bgCard, borderColor: colors.accent, opacity: isDisabled ? 0.7 : 1 }]} testID={`club-current-book-status-${status}`}><Text style={[styles.currentBookStatusButtonText, { color: isSelected ? '#FFFFFF' : colors.accent }]}>{CURRENT_BOOK_STATUS_LABELS[status]}</Text></TouchableOpacity>;
                                })}</View> : <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Only active club members can update the current-book reading status. Muted members can still view club progress.</Text>}
                            </View>
                            {currentBookFeedback ? <View style={[styles.feedbackBanner, { backgroundColor: currentBookFeedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: currentBookFeedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: currentBookFeedback.type === 'success' ? '#166534' : '#991B1B' }]}>{currentBookFeedback.message}</Text></View> : null}
                            {isMember && club.current_book_id ? (
                                <TouchableOpacity
                                    onPress={() => router.push(`/clubs/${club.id}/reading`)}
                                    style={[styles.secondaryActionButton, { borderColor: colors.accent, marginTop: 12 }]}
                                    testID="club-view-reading-progress"
                                >
                                    <Text style={[styles.secondaryActionText, { color: colors.accent }]}>View full reading progress</Text>
                                </TouchableOpacity>
                            ) : null}
                        </>
                    ) : null}
                </>
            ) : null}
        </View>
    );

    const renderNominationsTab = () => {
        const sortedNominations = [...nominations].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
        return (
            <View style={styles.tabContent}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Book nominations & voting</Text>
                <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>Active club members can nominate books and vote on the next read. The book with the most votes when voting closes becomes the next current read.</Text>
                {canManageBookActions ? <TouchableOpacity onPress={() => router.push(`/clubs/${club.id}/nominate`)} style={[styles.secondaryActionButton, { borderColor: colors.accent }]} testID="club-nominate-book"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Nominate a book</Text></TouchableOpacity> : null}
                {!canManageBookActions && isMember && membership?.status === 'muted' ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Read-only</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Muted members can view nominations but cannot vote or nominate new books.</Text></View> : null}
                {!canManageBookActions && !isMember ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Join to participate</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Only active club members can nominate books and vote. Join the club to take part.</Text></View> : null}
                {isNominationsLoading ? <View style={styles.inlineLoadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Loading nominations…</Text></View> : null}
                {isNominationsError ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Unable to load nominations</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(nominationsError, 'Unable to load book nominations right now.')}</Text><TouchableOpacity style={[styles.secondaryActionButton, { borderColor: colors.accent }]} onPress={() => refetchNominations()} testID="club-book-retry"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Retry</Text></TouchableOpacity></View> : null}
                {!isNominationsLoading && !isNominationsError && sortedNominations.length === 0 ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>No nominations yet</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Be the first to suggest a book for this club!</Text></View> : null}
                {!isNominationsLoading && !isNominationsError ? sortedNominations.map((nomination) => {
                    const isVotingClosed = hasNominationVotingClosed(nomination.voting_ends_at);
                    const isVotingOpen = nomination.status === 'active' && !isVotingClosed;
                    let voteButtonLabel: string;
                    let voteButtonDisabled: boolean;
                    if (!canManageBookActions) {
                        if (!isMember) { voteButtonLabel = 'Join to vote'; voteButtonDisabled = true; }
                        else if (membership?.status === 'muted') { voteButtonLabel = 'Muted members cannot vote'; voteButtonDisabled = true; }
                        else { voteButtonLabel = 'Not eligible'; voteButtonDisabled = true; }
                    } else if (!isVotingOpen) {
                        voteButtonLabel = 'Voting has closed';
                        voteButtonDisabled = true;
                    } else {
                        voteButtonLabel = nomination.currentUserVote ? 'Remove my vote' : 'Vote for this book';
                        voteButtonDisabled = castVoteMutation.isPending || removeVoteMutation.isPending;
                    }
                    return <View key={nomination.id} style={[styles.nominationCard, { borderColor: colors.border, backgroundColor: colors.bgPrimary }]}>
                        <View style={styles.nominationHeaderRow}>
                            <Image source={{ uri: getNominationCoverUrl(nomination) }} style={styles.nominationCover} contentFit="cover" transition={200} />
                            <View style={styles.nominationBody}>
                                <Text style={[styles.nominationTitle, { color: colors.textPrimary }]}>{nomination.book?.title || 'Untitled nomination'}</Text>
                                <Text style={[styles.nominationMeta, { color: colors.textSecondary }]}>{nomination.book?.authors?.join(', ') || 'Author information unavailable'}</Text>
                                <View style={styles.nominationStatsRow}>
                                    <View style={[styles.voteBadge, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.voteBadgeText, { color: colors.accent }]}>{nomination.vote_count ?? 0} votes</Text></View>
                                    <Text style={[styles.nominationMeta, { color: colors.textSecondary }]}>{nomination.voting_ends_at ? `Closes: ${new Date(nomination.voting_ends_at).toLocaleDateString()}` : 'No closing date set'}</Text>
                                </View>
                                <Text style={[styles.nominationMeta, { color: colors.textSecondary }]}>{`Nominated by ${nomination.nominatorProfile?.display_name || nomination.nominatorProfile?.username || 'a club member'}`}</Text>
                                {nomination.currentUserVote ? <Text style={[styles.nominationMeta, { color: colors.accent }]}>Your vote is on this nomination.</Text> : null}
                            </View>
                        </View>
                        <View style={styles.nominationActionsRow}>
                            <TouchableOpacity onPress={() => handleVoteToggle(nomination)} disabled={voteButtonDisabled} style={[styles.secondaryActionButton, { flex: 1, marginTop: 0, borderColor: colors.accent, opacity: voteButtonDisabled ? 0.55 : 1 }]} testID={`club-book-vote-${nomination.id}`}><Text style={[styles.secondaryActionText, { color: colors.accent }]}>{voteButtonLabel}</Text></TouchableOpacity>
                        </View>
                    </View>;
                }) : null}
                {bookFeedback ? <View style={[styles.feedbackBanner, { backgroundColor: bookFeedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: bookFeedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: bookFeedback.type === 'success' ? '#166534' : '#991B1B' }]}>{bookFeedback.message}</Text></View> : null}
            </View>
        );
    };

    const renderEventsTab = () => (
        <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Club events</Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>Member-only club events are available here. Active members can RSVP, while muted members can still review the schedule. Eligible managers can create and manage their club events.</Text>
            {isMember ? <TouchableOpacity onPress={() => router.push(`/clubs/${club.id}/events`)} style={[styles.secondaryActionButton, { borderColor: colors.accent }]} testID="club-view-events"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>View club events</Text></TouchableOpacity> : <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Members only</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Join this club to see upcoming events and RSVP.</Text></View>}
        </View>
    );

    const renderDiscussionTab = () => (
        <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Club discussion</Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>Member-only discussion is now live here. Active members can start topics and reply, while muted members can still read the conversation and keep up with unread activity.</Text>
            {isMember ? <TouchableOpacity onPress={() => router.push(`/clubs/${club.id}/discussion`)} style={[styles.secondaryActionButton, { borderColor: colors.accent }]} testID="club-view-discussion"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Open club discussion</Text></TouchableOpacity> : <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Members only</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Join this club to participate in discussions.</Text></View>}
        </View>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, '/(tabs)/clubs')} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{club.name}</Text>
                <View style={styles.headerSpacer} />
            </View>
            <View style={[styles.heroCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" transition={200} />
                <View style={styles.heroBody}>
                    <Text style={[styles.clubName, { color: colors.textPrimary }]}>{club.name}</Text>
                    <Text style={[styles.clubMeta, { color: colors.textSecondary }]}>Hosted by {hostName}</Text>
                    <Text style={[styles.clubDescription, { color: colors.textSecondary }]}>{club.description || 'Public club details, discussion entry points, and membership actions are live here. Join to take part in member-only discussion, events, and current-book decisions.'}</Text>
                    <View style={styles.badgesRow}>
                        <View style={[styles.badge, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.badgeText, { color: colors.accent }]}>{CLUB_TYPE_LABELS[club.club_type]}</Text></View>
                        <View style={[styles.badge, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.badgeText, { color: colors.textPrimary }]} testID="club-detail-access">{ACCESS_LEVEL_LABELS[club.access_level ?? 'all']}</Text></View>
                        <View style={[styles.badge, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.badgeText, { color: colors.textPrimary }]} testID="club-detail-meeting">{club.meeting_type ? MEETING_TYPE_LABELS[club.meeting_type] : 'Flexible format'}</Text></View>
                        <View style={[styles.badge, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.badgeText, { color: colors.textPrimary }]}>{club.member_count ?? 0} members</Text></View>
                    </View>
                </View>
            </View>
            <View style={styles.tabBar}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            style={[styles.tabButton, isActive && { backgroundColor: colors.accent }]}
                            testID={`tab-${tab.key}`}
                        >
                            <Text style={[styles.tabText, { color: isActive ? '#FFFFFF' : colors.textSecondary }]}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            {activeTab === 'about' && renderAboutTab()}
            {activeTab === 'current-book' && renderCurrentBookTab()}
            {activeTab === 'nominations' && renderNominationsTab()}
            {activeTab === 'events' && renderEventsTab()}
            {activeTab === 'discussion' && renderDiscussionTab()}

            {/* Leave Club Confirmation Modal */}
            {showLeaveConfirm && (
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="leave-confirm-modal">
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Leave club</Text>
                        <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                            Are you sure you want to leave this club? You will lose access to member-only content.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                onPress={() => setShowLeaveConfirm(false)}
                                style={[styles.modalButton, styles.modalButtonSecondary, { borderColor: colors.border }]}
                                testID="leave-confirm-cancel"
                            >
                                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={executeLeave}
                                disabled={leaveClubMutation.isPending}
                                style={[styles.modalButton, styles.modalButtonDanger, { backgroundColor: colors.error, opacity: leaveClubMutation.isPending ? 0.65 : 1 }]}
                                testID="leave-confirm-leave"
                            >
                                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                                    {leaveClubMutation.isPending ? 'Leaving…' : 'Leave Club'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 }, contentContainer: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }, headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' }, headerSpacer: { width: 40 },
    heroCard: { flexDirection: 'row', gap: 14, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 16 }, cover: { width: 108, height: 160, borderRadius: 14, backgroundColor: '#E2E8F0' }, heroBody: { flex: 1 }, clubName: { fontSize: 22, fontWeight: '800', marginBottom: 6 }, clubMeta: { fontSize: 14, fontWeight: '500', marginBottom: 10 }, clubDescription: { fontSize: 14, lineHeight: 21, marginBottom: 12 }, badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }, badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 }, sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 }, sectionPrimary: { fontSize: 17, fontWeight: '700', marginBottom: 4 }, sectionBody: { fontSize: 14, lineHeight: 20 }, detailGrid: { gap: 12 }, detailItem: { gap: 4 }, detailLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }, detailValue: { fontSize: 15, fontWeight: '600', lineHeight: 21 }, noticeCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 }, noticeTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 }, noticeBody: { fontSize: 14, lineHeight: 20 }, inlineLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }, currentBookStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }, currentBookStatCard: { minWidth: 120, flexGrow: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 4 }, currentBookStatLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }, currentBookStatValue: { fontSize: 20, fontWeight: '800' }, currentBookActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }, currentBookStatusButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }, currentBookStatusButtonText: { fontSize: 14, fontWeight: '800' }, joinSection: { marginTop: 14 }, questionBlock: { marginTop: 12 }, questionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 }, answerInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, minHeight: 88, textAlignVertical: 'top' }, nominationCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12, gap: 10 }, nominationHeaderRow: { flexDirection: 'row', gap: 12 }, nominationCover: { width: 72, height: 108, borderRadius: 12, backgroundColor: '#E2E8F0' }, nominationBody: { flex: 1, gap: 4 }, nominationTitle: { fontSize: 15, fontWeight: '700' }, nominationMeta: { fontSize: 13, lineHeight: 18 }, nominationActionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    tabBar: { flexDirection: 'row', gap: 8, marginBottom: 14 }, tabButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: 'transparent' }, tabText: { fontSize: 13, fontWeight: '700' }, tabContent: { paddingBottom: 24 },
    dangerButton: { marginTop: 16, borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, dangerButtonText: { fontSize: 15, fontWeight: '800' },
    nominationStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }, voteBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }, voteBadgeText: { fontSize: 12, fontWeight: '700' },
    primaryActionButton: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, secondaryActionButton: { marginTop: 16, borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, secondaryActionText: { fontSize: 15, fontWeight: '800' }, feedbackBanner: { marginTop: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 }, errorTitle: { fontSize: 18, fontWeight: '700' }, backButton: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }, backButtonText: { color: '#FFFFFF', fontWeight: '700' }, secondaryButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }, secondaryButtonText: { fontWeight: '700' },
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 1000 },
    modalCard: { width: '100%', maxWidth: 400, borderRadius: 18, borderWidth: 1, padding: 24, gap: 16 },
    modalTitle: { fontSize: 20, fontWeight: '800' },
    modalBody: { fontSize: 14, lineHeight: 21 },
    modalActions: { flexDirection: 'row', gap: 12 },
    modalButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    modalButtonSecondary: { borderWidth: 1.5 },
    modalButtonDanger: {},
});