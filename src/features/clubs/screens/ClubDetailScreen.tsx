import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { profileService } from '@/features/auth/services/profileService';
import { navigateBackOrFallback } from '@/lib/navigation';
import { colors, radii, touchTarget, typography } from '@/features/clubs/theme';
import { useAcceptClubAdminTransferRequest, useAcceptClubInvitation, useCastClubBookVote, useClubAdminTransferRequests, useClubBookNominations, useClubCurrentBookStatusOverview, useClubJoinQuestions, useClubMembers, useClubMembership, useClubPublicDetail, useJoinClub, useLeaveClub, useMyClubApplication, useMyClubInvitation, useRemoveClubBookVote, useSetClubCurrentBookReadingStatus } from '@/features/clubs/hooks/useClubs';
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

function getNominationCoverUrl(nomination: ClubBookNominationWithDetails): string | null {
    const imageUrl = nomination.book?.cover_url;
    if (!imageUrl) return null;
    return imageUrl.replace(/^http:\/\//i, 'https://');
}

function hasNominationVotingClosed(votingEndsAt: string | null) {
    if (!votingEndsAt) return false;
    const votingEndTime = Date.parse(votingEndsAt);
    if (Number.isNaN(votingEndTime)) return false;
    return votingEndTime <= Date.now();
}

function getCurrentBookCoverUrl(coverUrl: string | null | undefined): string | null {
    if (!coverUrl) return null;
    return coverUrl.replace(/^http:\/\//i, 'https://');
}

export default function ClubDetailScreen() {
    const { clubId, tab } = useLocalSearchParams<{ clubId: string; tab?: string }>();
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
    const { data: adminTransferRequests = [], refetch: refetchAdminTransferRequests } = useClubAdminTransferRequests(clubId ?? null, !!userId);
    const { data: members = [], isLoading: isMembersLoading } = useClubMembers(clubId ?? null, isMember);
    const { data: nominations = [], isLoading: isNominationsLoading, isError: isNominationsError, error: nominationsError, refetch: refetchNominations } = useClubBookNominations(clubId ?? null, userId, isMember);
    const shouldLoadCurrentBookStatus = isMember && !!club?.current_book_id;
    const { data: currentBookStatus, isLoading: isCurrentBookStatusLoading, isError: isCurrentBookStatusError, error: currentBookStatusError, refetch: refetchCurrentBookStatus } = useClubCurrentBookStatusOverview(clubId ?? null, userId, shouldLoadCurrentBookStatus);
    const castVoteMutation = useCastClubBookVote();
    const removeVoteMutation = useRemoveClubBookVote();
    const setCurrentBookStatusMutation = useSetClubCurrentBookReadingStatus();
    const leaveClubMutation = useLeaveClub();
    const acceptAdminTransferMutation = useAcceptClubAdminTransferRequest();
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [bookFeedback, setBookFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [currentBookFeedback, setCurrentBookFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [viewerMembershipTier, setViewerMembershipTier] = useState<MembershipTier | null>(null);
    const [activeTop, setActiveTop] = useState<'home' | 'books'>(() => (
        tab === 'current-book' || tab === 'nominations' ? 'books' : 'home'
    ));
    const [readersExpanded, setReadersExpanded] = useState(false);
    const pendingAdminTransferRequest = useMemo(
        () => adminTransferRequests.find((request) => request.status === 'pending' && request.proposed_admin_user_id === userId) ?? null,
        [adminTransferRequests, userId],
    );

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
        if (tab === 'current-book' || tab === 'nominations') {
            setActiveTop('books');
        } else if (tab === 'about' || tab === 'events' || tab === 'discussion' || tab === undefined) {
            setActiveTop('home');
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
        return <View style={[styles.loadingContainer]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    }
    if (isError || !club) {
        return (
            <View style={[styles.loadingContainer, { paddingHorizontal: 24 }]}>
                <Text style={styles.errorTitle}>Unable to load this club</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading club"><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity>
                <TouchableOpacity style={styles.goBackButton} onPress={() => navigateBackOrFallback(router, '/(tabs)/clubs')} accessibilityRole="button" accessibilityLabel="Go back to Clubs"><Text style={styles.goBackButtonText}>Go back</Text></TouchableOpacity>
            </View>
        );
    }

    const hostName = club.admin_display_name || 'BookTalks Reader';
    const communityCity = club.author_city || club.admin_city || null;
    const memberCount = club.member_count ?? 0;
    const canJoinDirectly = club.club_type === 'public';
    const requiresApplication = club.club_type === 'approval' || club.club_type === 'author_club';
    const isJoinFlowLoading = isMembershipLoading || (shouldLoadApplicationData && (isQuestionsLoading || isApplicationLoading)) || isInvitationLoading;
    const meetsClubAccessRequirement = viewerMembershipTier ? membershipTierSatisfiesAccessLevel(viewerMembershipTier, club.access_level ?? 'all') : null;
    const blocksDirectJoin = !isMember && !!userId && canJoinDirectly && meetsClubAccessRequirement === false;
    const blocksInvitationAcceptance = !isMember && !!userId && !!myInvitation && meetsClubAccessRequirement === false;
    const canManageBookActions = membership?.status === 'active';
    const canOpenManageClub = isAdmin || (membership?.role === 'moderator' && membership?.status === 'active');
    const currentBookTitle = club.current_book_title || null;
    const currentBookAuthors = club.current_book_authors?.join(', ') || null;
    const hasRealBookCover = !!club.current_book_cover_url;
    const currentBookCover = hasRealBookCover ? getCurrentBookCoverUrl(club.current_book_cover_url) : null;

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

    const handleAcceptAdminTransfer = async () => {
        if (!clubId || !pendingAdminTransferRequest) return;
        try {
            setActionFeedback(null);
            await acceptAdminTransferMutation.mutateAsync({ clubId, requestId: pendingAdminTransferRequest.id });
            await Promise.all([refetch(), refetchAdminTransferRequests()]);
            setActionFeedback({ type: 'success', message: 'You are now the club admin.' });
        } catch (error) {
            setActionFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to accept admin transfer right now.') });
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
        if (!clubId || !userId) return;
        try {
            setActionFeedback(null);
            await leaveClubMutation.mutateAsync({ clubId, userId });
            router.push('/clubs');
        } catch (error) {
            setActionFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to leave this club right now.') });
        }
    };

    const renderMembershipSection = () => {
        const isBanned = membership?.status === 'banned';
        const hasPendingApplication = !isMember && !isBanned && myApplication?.status === 'pending';
        const hasDeclinedApplication = !isMember && !isBanned && myApplication?.status === 'declined';
        const hasInvitation = !isMember && !isBanned && club.club_type === 'invite_only' && !!myInvitation;
        const showInviteRequired = !isMember && !isBanned && club.club_type === 'invite_only' && !myInvitation;
        const showJoinQuestions = !isMember && !isBanned && requiresApplication && !myApplication;
        const showDirectJoin = !isMember && !isBanned && !myApplication && !!userId && (canJoinDirectly || requiresApplication);
        const showTierWarning = !isMember && !isBanned && !!userId && meetsClubAccessRequirement === false;

        return (
            <View style={styles.membershipBlock} testID="club-membership-section">
                <Text style={typography.kicker}>Membership</Text>
                {isJoinFlowLoading ? (
                    <View style={styles.inlineLoadingRow}>
                        <ActivityIndicator size="small" color={colors.accent} />
                        <Text style={styles.mutedBody}>Preparing the right join flow…</Text>
                    </View>
                ) : null}
                {!userId ? (
                    <View style={styles.membershipRow}>
                        <View style={styles.membershipTextBlock}>
                            <Text style={styles.membershipTitle}>Sign in required</Text>
                            <Text style={styles.mutedBody}>You need an authenticated session before you can join or apply.</Text>
                        </View>
                    </View>
                ) : null}
                {isBanned ? (
                    <View style={styles.membershipRow}>
                        <View style={styles.membershipTextBlock}>
                            <Text style={styles.membershipTitle}>Membership restricted</Text>
                            <Text style={styles.mutedBody}>This account is currently banned from the club and cannot join or apply.</Text>
                        </View>
                    </View>
                ) : null}
                {showTierWarning ? (
                    <View style={styles.tierWarning} testID="club-entitlement-warning">
                        <Text style={styles.membershipTitle}>Membership tier required</Text>
                        <Text style={styles.mutedBody}>
                            {canJoinDirectly || myInvitation
                                ? getClubAccessRequirementMessage(club.access_level ?? 'all', viewerMembershipTier, canJoinDirectly ? 'join this club' : 'accept this invitation')
                                : `This club currently requires ${ACCESS_LEVEL_LABELS[club.access_level ?? 'all']}. If your application is approved, membership cannot become active until your subscription tier meets that requirement.`}
                        </Text>
                    </View>
                ) : null}
                {hasPendingApplication ? (
                    <View style={styles.membershipStack}>
                        <Text style={styles.membershipTitle}>Application pending</Text>
                        <Text style={styles.mutedBody}>Your application is waiting for moderator review. You do not need to submit it again.</Text>
                    </View>
                ) : null}
                {hasDeclinedApplication ? (
                    <View style={styles.membershipStack}>
                        <Text style={styles.membershipTitle}>Application declined</Text>
                        <Text style={styles.mutedBody}>{myApplication?.decline_reason || 'Your previous application was declined. Reapply is not available in this version yet.'}</Text>
                    </View>
                ) : null}
                {hasInvitation ? (
                    <View style={styles.membershipStack}>
                        <Text style={styles.membershipTitle}>Invitation ready</Text>
                        <Text style={styles.mutedBody}>You have a pending invitation from {myInvitation?.inviterProfile?.display_name || 'a club manager'}. Accepting it adds you to the club immediately through the live invite workflow.</Text>
                        {myInvitation?.note ? <Text style={styles.mutedBody}>{`Note: ${myInvitation.note}`}</Text> : null}
                        <TouchableOpacity
                            onPress={handleAcceptInvitation}
                            disabled={acceptInvitationMutation.isPending || blocksInvitationAcceptance}
                            style={[styles.primaryButton, { opacity: acceptInvitationMutation.isPending || blocksInvitationAcceptance ? 0.65 : 1 }]}
                            testID="club-accept-invitation"
                            accessibilityRole="button"
                            accessibilityLabel="Accept invitation"
                        >
                            <Text style={styles.primaryButtonText}>{acceptInvitationMutation.isPending ? 'Accepting…' : 'Accept invitation'}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
                {showInviteRequired ? (
                    <View style={styles.membershipStack}>
                        <Text style={styles.membershipTitle}>Invite required</Text>
                        <Text style={styles.mutedBody}>Invite-only clubs require a moderator or admin invitation. If you have already been invited, sign in with the invited account to accept it here.</Text>
                    </View>
                ) : null}
                {showJoinQuestions ? (
                    <View style={styles.joinQuestionsBlock}>
                        <Text style={styles.membershipTitle}>Join questions</Text>
                        <Text style={styles.mutedBody}>Answer the questions below to apply for moderator review.</Text>
                        {joinQuestions.length === 0 ? (
                            <Text style={styles.mutedBody}>This club does not currently require written answers, so your application can be sent immediately.</Text>
                        ) : null}
                        {joinQuestions.map((question) => {
                            const hasError = requiredQuestionErrors.includes(question.id);
                            return (
                                <View key={question.id} style={styles.questionBlock}>
                                    <Text style={styles.questionLabel}>{question.question}{question.is_required ? ' *' : ''}</Text>
                                    <TextInput
                                        value={answers[question.id] ?? ''}
                                        onChangeText={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                                        placeholder={getQuestionPlaceholder(question)}
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        style={[styles.answerInput, { borderColor: hasError ? colors.danger : colors.border }]}
                                        testID={`join-question-${question.id}`}
                                        accessibilityLabel={question.question}
                                    />
                                </View>
                            );
                        })}
                    </View>
                ) : null}
                {showDirectJoin ? (
                    <TouchableOpacity
                        onPress={handleJoinAction}
                        disabled={joinMutation.isPending || blocksDirectJoin}
                        style={[styles.primaryButton, { opacity: joinMutation.isPending || blocksDirectJoin ? 0.65 : 1 }]}
                        testID="club-primary-action"
                        accessibilityRole="button"
                        accessibilityLabel={canJoinDirectly ? 'Join this club' : 'Apply to join'}
                    >
                        <Text style={styles.primaryButtonText}>{joinMutation.isPending ? 'Working…' : canJoinDirectly ? 'Join this club' : 'Apply to join'}</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        );
    };

    const renderMemberActions = () => {
        if (!isMember) return null;
        const isMuted = membership?.status === 'muted';

        return (
            <View style={styles.memberActions} testID="club-member-actions">
                <View style={styles.membershipRow}>
                    <Text style={styles.membershipTitle}>{isMuted ? 'Muted member' : 'Member'}</Text>
                    <TouchableOpacity
                        onPress={handleLeaveClub}
                        disabled={leaveClubMutation.isPending}
                        style={styles.leaveQuietButton}
                        testID="club-leave"
                        accessibilityRole="button"
                        accessibilityLabel="Leave club"
                    >
                        <Text style={styles.leaveQuietText}>{leaveClubMutation.isPending ? 'Leaving…' : 'Leave club'}</Text>
                    </TouchableOpacity>
                </View>
                {isMuted ? <Text style={styles.mutedBody}>You currently have read-only access. You can read the conversation and review progress, but you cannot post, vote, or RSVP.</Text> : null}
            </View>
        );
    };

    const renderCurrentReadTeaser = () => (
        <View style={styles.currentReadBlock}>
            <Text style={typography.kicker}>Currently reading</Text>
            {!club.current_book_id && !currentBookTitle ? (
                <Text style={styles.noCurrentBook} testID="club-no-current-book">No current book selected yet</Text>
            ) : (
                <View style={styles.currentReadRow}>
                    {currentBookCover ? (
                        <Image source={{ uri: currentBookCover }} style={styles.currentReadCover} contentFit="cover" transition={200} />
                    ) : (
                        <View style={[styles.currentReadCover, styles.currentReadCoverFallback]}>
                            <Ionicons name="book-outline" size={28} color={colors.textMuted} />
                        </View>
                    )}
                    <View style={styles.currentReadBody}>
                        <Text style={styles.currentReadTitle} numberOfLines={3}>{currentBookTitle || 'Untitled current read'}</Text>
                        {currentBookAuthors ? <Text style={styles.currentReadAuthors} numberOfLines={2}>{currentBookAuthors}</Text> : null}
                    </View>
                </View>
            )}
            <TouchableOpacity
                onPress={() => setActiveTop('books')}
                style={styles.openBooksLink}
                testID="club-open-books"
                accessibilityRole="button"
                accessibilityLabel="Open in Books"
            >
                <Text style={styles.openBooksLinkText}>Open in Books →</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLedgerRows = () => {
        const readersLabel = club.max_members
            ? `${memberCount} of ${club.max_members} readers`
            : `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`;
        return (
            <View style={styles.ledgerBlock}>
                <TouchableOpacity
                    style={[styles.destinationButton, styles.discussButton]}
                    onPress={() => router.push(`/clubs/${club.id}/discussion`)}
                    testID="club-home-discuss-entry"
                    accessibilityRole="button"
                    accessibilityLabel="Discuss, open club discussion"
                    activeOpacity={0.9}
                >
                    <Ionicons name="chatbubble-outline" size={18} color={colors.accent} testID="club-home-discuss-icon" />
                    <Text style={styles.destinationButtonTitle}>Discuss</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.accent} />
                </TouchableOpacity>
                {isMember ? (
                    <View>
                        <TouchableOpacity
                            style={styles.ledgerRow}
                            onPress={() => setReadersExpanded((current) => !current)}
                            testID="club-home-readers-entry"
                    accessibilityRole="button"
                    accessibilityLabel={readersExpanded ? 'Readers, Hide member list' : `Readers, ${readersLabel}`}
                            accessibilityState={{ expanded: readersExpanded }}
                        >
                            <View style={styles.ledgerText}>
                                <Text style={styles.ledgerTitle}>Readers</Text>
                                <Text style={styles.ledgerSubtitle}>{readersLabel}</Text>
                            </View>
                            <Ionicons name={readersExpanded ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                        {readersExpanded ? (
                            <View style={styles.readersInline} testID="club-member-list">
                                {isMembersLoading ? (
                                    <View style={styles.inlineLoadingRow}>
                                        <ActivityIndicator size="small" color={colors.accent} />
                                        <Text style={styles.mutedBody}>Loading members…</Text>
                                    </View>
                                ) : members.length === 0 ? (
                                    <Text style={styles.mutedBody}>No active member cards are available yet.</Text>
                                ) : (
                                    <ClubMemberList members={members} colors={{
                                        bgPrimary: colors.bg,
                                        bgCard: colors.surface,
                                        bgSecondary: colors.surfaceSubtle,
                                        border: colors.border,
                                        accent: colors.accent,
                                        textPrimary: colors.textPrimary,
                                        textSecondary: colors.textSecondary,
                                        textTertiary: colors.textMuted,
                                        accentLight: colors.accent,
                                    } as never} />
                                )}
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <View style={styles.ledgerRow} testID="club-home-readers-entry" accessibilityLabel={`Readers, ${readersLabel}, Member list is private`}>
                        <View style={styles.ledgerText}>
                            <Text style={styles.ledgerTitle}>Readers</Text>
                            <Text style={styles.ledgerSubtitle}>{readersLabel}</Text>
                            <Text style={styles.ledgerSubtitle}>Member list is private</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </View>
                )}
                <TouchableOpacity
                    style={[styles.destinationButton, styles.eventsButton]}
                    onPress={() => router.push(`/clubs/${club.id}/events`)}
                    testID="club-home-events-entry"
                    accessibilityRole="button"
                    accessibilityLabel="Events, open club events"
                    activeOpacity={0.9}
                >
                    <Ionicons name="calendar-outline" size={18} color={colors.textMuted} testID="club-home-events-icon" />
                    <Text style={styles.destinationButtonTitle}>Events</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
            </View>
        );
    };

    const renderClubTools = () => {
        if (!isManager && !canOpenManageClub) return null;
        const showApplications = requiresApplication && isManager;
        const showInvite = club.club_type === 'invite_only' && isManager;
        if (!showApplications && !showInvite && !canOpenManageClub) return null;
        return (
            <View style={styles.toolsBlock} testID="club-tools">
                <Text style={typography.kicker}>Club tools</Text>
                {showApplications ? (
                    <View style={styles.toolRow}>
                        <View style={styles.toolText}>
                            <Text style={styles.toolTitle}>Review applications</Text>
                            <Text style={styles.mutedBody}>Review pending join applications for this club with the live moderator workflow.</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.toolButton}
                            onPress={() => router.push(`/clubs/${club.id}/applications`)}
                            testID="club-review-applications"
                            accessibilityRole="button"
                            accessibilityLabel="Review applications"
                        >
                            <Text style={styles.toolButtonText}>Review</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
                {showInvite ? (
                    <View style={styles.toolRow}>
                        <View style={styles.toolText}>
                            <Text style={styles.toolTitle}>Invitation tools</Text>
                            <Text style={styles.mutedBody}>Username-based invitation creation, invitation history, revocation, and read tracking are wired to the live invite backend.</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.toolButton}
                            onPress={() => router.push(`/clubs/${club.id}/invite`)}
                            testID="club-invite-readers"
                            accessibilityRole="button"
                            accessibilityLabel="Invite readers"
                        >
                            <Text style={styles.toolButtonText}>Invite readers</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
                {canOpenManageClub ? (
                    <View style={styles.toolRow}>
                        <View style={styles.toolText}>
                            <Text style={styles.toolTitle}>Club management</Text>
                            <Text style={styles.mutedBody}>
                                {isAdmin
                                    ? 'Open Manage Club for current-book management, plus the existing basic settings, member-role management, remove-member workflows, and join-question management.'
                                    : 'Open Manage Club to review nominations and finalize the current book after voting closes. The broader settings, member-role management, remove-member workflows, and join-question management stay admin-only.'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.toolButton}
                            onPress={() => router.push(`/clubs/${club.id}/manage`)}
                            testID="club-manage"
                            accessibilityRole="button"
                            accessibilityLabel="Manage club"
                        >
                            <Text style={styles.toolButtonText}>Manage club</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>
        );
    };

    const renderCurrentBookDetail = () => (
        <View style={styles.booksSection} testID="club-books-current">
            <Text style={typography.sectionHeading}>Current read</Text>
            <Text style={styles.booksPrimary}>{currentBookTitle || 'No current book selected yet'}</Text>
            <Text style={styles.mutedBody}>{currentBookAuthors || 'Once a book is selected it will appear here for all visitors.'}</Text>
            {isMember && club.current_book_id ? (
                <>
                    {isCurrentBookStatusLoading ? <View style={styles.inlineLoadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={styles.mutedBody}>Loading current-book progress…</Text></View> : null}
                    {isCurrentBookStatusError ? (
                        <View style={styles.compatNotice}>
                            <Text style={styles.membershipTitle}>Unable to load current-book progress</Text>
                            <Text style={styles.mutedBody}>{getClubsEntitlementErrorMessage(currentBookStatusError, 'Unable to load current-book progress right now.')}</Text>
                            <TouchableOpacity style={styles.toolButton} onPress={() => refetchCurrentBookStatus()} testID="club-current-book-status-retry">
                                <Text style={styles.toolButtonText}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                    {!isCurrentBookStatusLoading && !isCurrentBookStatusError && currentBookStatus ? (
                        <>
                            <View style={styles.currentBookStatsGrid}>
                                <View style={styles.currentBookStatCard}><Text style={styles.statLabel}>Active members</Text><Text style={styles.statValue}>{currentBookStatus.active_member_count}</Text></View>
                                <View style={styles.currentBookStatCard}><Text style={styles.statLabel}>To start</Text><Text style={styles.statValue}>{currentBookStatus.to_start_count}</Text></View>
                                <View style={styles.currentBookStatCard}><Text style={styles.statLabel}>Reading</Text><Text style={styles.statValue}>{currentBookStatus.reading_count}</Text></View>
                                <View style={styles.currentBookStatCard}><Text style={styles.statLabel}>Completed</Text><Text style={styles.statValue}>{currentBookStatus.completed_count}</Text></View>
                            </View>
                            <View style={styles.compatNotice}>
                                <Text style={styles.membershipTitle}>Your club reading status</Text>
                                <Text style={styles.mutedBody}>{`Current status: ${CURRENT_BOOK_STATUS_LABELS[currentBookStatus.member_reading_status ?? 'want_to_read']}`}</Text>
                                {canManageBookActions ? (
                                    <View style={styles.currentBookActionsRow}>
                                        {(['want_to_read', 'reading', 'completed'] as ClubCurrentBookReadingStatus[]).map((status) => {
                                            const isSelected = (currentBookStatus.member_reading_status ?? 'want_to_read') === status;
                                            const isDisabled = setCurrentBookStatusMutation.isPending;
                                            return (
                                                <TouchableOpacity
                                                    key={status}
                                                    onPress={() => handleCurrentBookStatusChange(status)}
                                                    disabled={isDisabled}
                                                    style={[styles.statusPill, isSelected && styles.statusPillSelected, { opacity: isDisabled ? 0.7 : 1 }]}
                                                    testID={`club-current-book-status-${status}`}
                                                >
                                                    <Text style={[styles.statusPillText, isSelected && styles.statusPillTextSelected]}>{CURRENT_BOOK_STATUS_LABELS[status]}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : <Text style={styles.mutedBody}>Only active club members can update the current-book reading status. Muted members can still view club progress.</Text>}
                            </View>
                            {currentBookFeedback ? <View style={[styles.feedbackBanner, currentBookFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}><Text style={[styles.feedbackText, currentBookFeedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText]}>{currentBookFeedback.message}</Text></View> : null}
                            <TouchableOpacity
                                onPress={() => router.push(`/clubs/${club.id}/reading`)}
                                style={[styles.toolButton, { alignSelf: 'flex-start', marginTop: 12 }]}
                                testID="club-view-reading-progress"
                            >
                                <Text style={styles.toolButtonText}>View full reading progress</Text>
                            </TouchableOpacity>
                        </>
                    ) : null}
                </>
            ) : null}
        </View>
    );

    const renderNominationsDetail = () => {
        const sortedNominations = [...nominations].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
        return (
            <View style={styles.booksSection} testID="club-books-nominations">
                <Text style={typography.sectionHeading}>Book nominations & voting</Text>
                <Text style={styles.mutedBody}>Active club members can nominate books and vote on the next read. The book with the most votes when voting closes becomes the next current read.</Text>
                {canManageBookActions ? <TouchableOpacity onPress={() => router.push(`/clubs/${club.id}/nominate`)} style={[styles.toolButton, { alignSelf: 'flex-start' }]} testID="club-nominate-book"><Text style={styles.toolButtonText}>Nominate a book</Text></TouchableOpacity> : null}
                {!canManageBookActions && isMember && membership?.status === 'muted' ? (
                    <View style={styles.compatNotice}><Text style={styles.membershipTitle}>Read-only</Text><Text style={styles.mutedBody}>Muted members can view nominations but cannot vote or nominate new books.</Text></View>
                ) : null}
                {!canManageBookActions && !isMember ? (
                    <View style={styles.compatNotice}><Text style={styles.membershipTitle}>Join to participate</Text><Text style={styles.mutedBody}>Only active club members can nominate books and vote. Join the club to take part.</Text></View>
                ) : null}
                {isNominationsLoading ? <View style={styles.inlineLoadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={styles.mutedBody}>Loading nominations…</Text></View> : null}
                {isNominationsError ? (
                    <View style={styles.compatNotice}>
                        <Text style={styles.membershipTitle}>Unable to load nominations</Text>
                        <Text style={styles.mutedBody}>{getClubsEntitlementErrorMessage(nominationsError, 'Unable to load book nominations right now.')}</Text>
                        <TouchableOpacity style={styles.toolButton} onPress={() => refetchNominations()} testID="club-book-retry"><Text style={styles.toolButtonText}>Retry</Text></TouchableOpacity>
                    </View>
                ) : null}
                {!isNominationsLoading && !isNominationsError && sortedNominations.length === 0 ? (
                    <View style={styles.compatNotice}><Text style={styles.membershipTitle}>No nominations yet</Text><Text style={styles.mutedBody}>Be the first to suggest a book for this club!</Text></View>
                ) : null}
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
                    const nominationCoverUrl = getNominationCoverUrl(nomination);
                    return (
                        <View key={nomination.id} style={styles.nominationCard}>
                            <View style={styles.nominationHeaderRow}>
                                {nominationCoverUrl ? (
                                    <Image source={{ uri: nominationCoverUrl }} style={styles.nominationCover} contentFit="cover" transition={200} />
                                ) : (
                                    <View style={[styles.nominationCover, styles.nominationCoverFallback]}>
                                        <Ionicons name="book-outline" size={24} color={colors.textMuted} />
                                    </View>
                                )}
                                <View style={styles.nominationBody}>
                                    <Text style={styles.nominationTitle}>{nomination.book?.title || 'Untitled nomination'}</Text>
                                    <Text style={styles.mutedBody}>{nomination.book?.authors?.join(', ') || 'Author information unavailable'}</Text>
                                    <View style={styles.nominationStatsRow}>
                                        <View style={styles.voteBadge}><Text style={styles.voteBadgeText}>{nomination.vote_count ?? 0} votes</Text></View>
                                        <Text style={styles.nominationMeta}>{nomination.voting_ends_at ? `Closes: ${new Date(nomination.voting_ends_at).toLocaleDateString()}` : 'No closing date set'}</Text>
                                    </View>
                                    <Text style={styles.nominationMeta}>{`Nominated by ${nomination.nominatorProfile?.display_name || nomination.nominatorProfile?.username || 'a club member'}`}</Text>
                                    {nomination.currentUserVote ? <Text style={styles.ownVoteFlag}>Your vote is on this nomination.</Text> : null}
                                </View>
                            </View>
                            <View style={styles.nominationActionsRow}>
                                <TouchableOpacity onPress={() => handleVoteToggle(nomination)} disabled={voteButtonDisabled} style={[styles.toolButton, { flex: 1, opacity: voteButtonDisabled ? 0.55 : 1 }]} testID={`club-book-vote-${nomination.id}`}><Text style={styles.toolButtonText}>{voteButtonLabel}</Text></TouchableOpacity>
                            </View>
                        </View>
                    );
                }) : null}
                {bookFeedback ? <View style={[styles.feedbackBanner, bookFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}><Text style={[styles.feedbackText, bookFeedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText]}>{bookFeedback.message}</Text></View> : null}
            </View>
        );
    };

    const renderBooksCompat = () => (
        <View style={styles.booksCompatBlock} testID="club-books-compat">
            <TouchableOpacity
                onPress={() => setActiveTop('home')}
                style={styles.backToHomeLink}
                testID="club-books-back-home"
                accessibilityRole="button"
                accessibilityLabel="Back to Home"
            >
                <Text style={styles.backToHomeText}>← Back to Home</Text>
            </TouchableOpacity>
            {renderCurrentBookDetail()}
            {renderNominationsDetail()}
        </View>
    );

    const clubTypeLabel = CLUB_TYPE_LABELS[club.club_type].replace(/ club$/i, '');
    const clubMetadataLine = [
        clubTypeLabel,
        ACCESS_LEVEL_LABELS[club.access_level ?? 'all'],
        club.meeting_type ? MEETING_TYPE_LABELS[club.meeting_type] : 'Flexible format',
        communityCity,
    ].filter(Boolean).join(' · ');

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.topBar}>
                <TouchableOpacity
                    onPress={() => navigateBackOrFallback(router, '/(tabs)/clubs')}
                    style={styles.backButton}
                    testID="club-home-back"
                    accessibilityRole="button"
                    accessibilityLabel="Back to Clubs"
                >
                    <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                    <Text style={styles.backButtonText}>Clubs</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.identityBlock}>
                <Text style={styles.clubName}>{club.name}</Text>
                {club.description ? <Text style={styles.clubDescription}>{club.description}</Text> : null}
                <Text style={styles.identityMeta}>{clubMetadataLine}</Text>
                <Text style={styles.hostedBy}>
                    <Text style={styles.hostedByPrefix}>Hosted by </Text>
                    <Text style={styles.hostedByName}>{hostName}</Text>
                </Text>
                {club.author_display_name ? (
                    <Text style={styles.identityMeta}>
                        {club.club_type === 'author_club' ? 'Verified author' : 'Featured author'} · {club.author_display_name}
                    </Text>
                ) : null}
            </View>

            {!isMember ? renderMembershipSection() : null}

            {actionFeedback ? (
                <View accessibilityRole="alert" style={[styles.feedbackBanner, actionFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
                    <Text style={[styles.feedbackText, actionFeedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText]}>{actionFeedback.message}</Text>
                </View>
            ) : null}

            {activeTop === 'home' ? (
                <>
                    {renderCurrentReadTeaser()}
                    {renderLedgerRows()}
                </>
            ) : renderBooksCompat()}

            {pendingAdminTransferRequest ? (
                <View style={styles.transferBlock} testID="club-admin-transfer-offer">
                    <Text style={styles.membershipTitle}>Admin transfer request</Text>
                    <Text style={styles.mutedBody}>The current admin has asked you to take over this club. Accepting will make you the club admin and move the previous admin back to member status.</Text>
                    <TouchableOpacity
                        style={[styles.primaryButton, { opacity: acceptAdminTransferMutation.isPending ? 0.65 : 1 }]}
                        onPress={handleAcceptAdminTransfer}
                        disabled={acceptAdminTransferMutation.isPending}
                        testID="club-accept-admin-transfer"
                    >
                        <Text style={styles.primaryButtonText}>{acceptAdminTransferMutation.isPending ? 'Accepting...' : 'Accept admin role'}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {renderClubTools()}

            {renderMemberActions()}

            {showLeaveConfirm && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard} testID="leave-confirm-modal">
                        <Text style={styles.modalTitle}>Leave club</Text>
                        <Text style={styles.modalBody}>
                            Are you sure you want to leave this club? You will lose access to member-only content.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                onPress={() => setShowLeaveConfirm(false)}
                                style={[styles.modalButton, styles.modalButtonSecondary]}
                                testID="leave-confirm-cancel"
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={executeLeave}
                                disabled={leaveClubMutation.isPending}
                                style={[styles.modalButton, styles.modalButtonDanger, { opacity: leaveClubMutation.isPending ? 0.65 : 1 }]}
                                testID="leave-confirm-leave"
                            >
                                <Text style={styles.modalDangerText}>
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
    container: { flex: 1, backgroundColor: colors.bg },
    contentContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
    loadingContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', gap: 12 },
    errorTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, lineHeight: 26, color: colors.textPrimary, textAlign: 'center' },
    retryButton: { marginTop: 12, minHeight: touchTarget, justifyContent: 'center', borderRadius: radii.medium, backgroundColor: colors.accent, paddingHorizontal: 20 },
    retryButtonText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 15, textAlign: 'center' },
    goBackButton: { marginTop: 10, minHeight: touchTarget, justifyContent: 'center', borderRadius: radii.medium, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 20 },
    goBackButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary, textAlign: 'center' },
    topBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginBottom: 16 },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: touchTarget, minWidth: touchTarget, paddingRight: 8 },
    backButtonText: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, color: colors.textPrimary },
    identityBlock: { gap: 6, marginBottom: 20 },
    clubName: { fontFamily: 'Newsreader_700Bold', fontSize: 28, lineHeight: 34, color: colors.textPrimary },
    clubDescription: { fontFamily: 'Newsreader_400Regular', fontSize: 17, lineHeight: 25, color: colors.textSecondary },
    identityMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: colors.textMuted },
    hostedBy: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 2 },
    hostedByPrefix: { color: colors.textMuted },
    hostedByName: { color: colors.accent, fontFamily: 'Inter_600SemiBold' },
    membershipBlock: { gap: 10, paddingVertical: 4, marginBottom: 20 },
    memberActions: { gap: 8, marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
    membershipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: touchTarget },
    membershipTextBlock: { flex: 1, gap: 4 },
    membershipStack: { gap: 8, marginTop: 4 },
    membershipTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21, color: colors.textPrimary },
    mutedBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    tierWarning: { gap: 6, marginTop: 4 },
    leaveQuietButton: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: 8 },
    leaveQuietText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: colors.textMuted, textDecorationLine: 'underline' },
    joinQuestionsBlock: { gap: 8, marginTop: 6 },
    questionBlock: { marginTop: 8, gap: 8 },
    questionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.textPrimary },
    answerInput: { borderWidth: 1, borderRadius: radii.medium, paddingHorizontal: 12, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21, color: colors.textPrimary, backgroundColor: colors.surface, minHeight: 88, textAlignVertical: 'top' },
    primaryButton: { marginTop: 12, minHeight: 48, borderRadius: radii.medium, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
    primaryButtonText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21 },
    feedbackBanner: { marginTop: 12, borderWidth: 1, borderRadius: radii.medium, paddingHorizontal: 12, paddingVertical: 10 },
    feedbackSuccess: { backgroundColor: '#EAF7EE', borderColor: '#1E7A3C' },
    feedbackError: { backgroundColor: '#FDECEC', borderColor: '#BA1A1A' },
    feedbackText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
    feedbackSuccessText: { color: '#1E5C2E' },
    feedbackErrorText: { color: '#7A1C1C' },
    currentReadBlock: { gap: 12, marginBottom: 16, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radii.large, backgroundColor: colors.surface },
    noCurrentBook: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, color: colors.textSecondary, paddingVertical: 8 },
    currentReadRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 4 },
    currentReadCover: { width: 64, height: 96, borderRadius: radii.medium, backgroundColor: colors.surfaceSubtle },
    currentReadCoverFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    currentReadBody: { flex: 1, gap: 4 },
    currentReadTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, lineHeight: 26, color: colors.textPrimary },
    currentReadAuthors: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: colors.textMuted },
    openBooksLink: { marginTop: 6, minHeight: touchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
    openBooksLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.accent },
    ledgerBlock: { marginTop: 12, marginBottom: 8, gap: 10 },
    destinationButton: { width: '100%', minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderRadius: radii.large },
    discussButton: { backgroundColor: '#FAEDE9', borderColor: 'rgba(122, 28, 40, 0.25)' },
    eventsButton: { backgroundColor: '#FFF8F6', borderColor: 'rgba(122, 28, 40, 0.15)' },
    destinationButtonTitle: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 23, color: colors.textPrimary },
    ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider },
    ledgerText: { flex: 1, gap: 2 },
    ledgerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21, color: colors.textPrimary },
    ledgerSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: colors.textMuted },
    readersInline: { paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 },
    inlineLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    toolsBlock: { gap: 12, marginTop: 20, marginBottom: 8 },
    toolRow: { gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider },
    toolText: { gap: 4 },
    toolTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21, color: colors.textPrimary },
    toolButton: { marginTop: 8, alignSelf: 'flex-start', minHeight: touchTarget, justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: radii.medium, paddingHorizontal: 16, backgroundColor: colors.surface },
    toolButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.accent },
    transferBlock: { gap: 8, marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider },
    booksCompatBlock: { gap: 16, marginBottom: 8 },
    backToHomeLink: { minHeight: touchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
    backToHomeText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.accent },
    booksSection: { gap: 8, paddingTop: 8 },
    booksPrimary: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, lineHeight: 26, color: colors.textPrimary },
    compatNotice: { gap: 6, marginTop: 12, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, backgroundColor: colors.surface },
    currentBookStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    currentBookStatCard: { minWidth: 120, flexGrow: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
    statLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textMuted },
    statValue: { fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 26, color: colors.textPrimary },
    currentBookActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    statusPill: { borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surface, minHeight: touchTarget, justifyContent: 'center' },
    statusPillSelected: { backgroundColor: colors.accent },
    statusPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.accent },
    statusPillTextSelected: { color: '#FFFFFF' },
    nominationCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, backgroundColor: colors.surface, padding: 14, marginTop: 12, gap: 10 },
    nominationHeaderRow: { flexDirection: 'row', gap: 12 },
    nominationCover: { width: 64, height: 96, borderRadius: radii.medium, backgroundColor: colors.surfaceSubtle },
    nominationCoverFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    nominationBody: { flex: 1, gap: 4 },
    nominationTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21, color: colors.textPrimary },
    nominationMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: colors.textMuted },
    nominationStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8 },
    voteBadge: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.surfaceSubtle },
    voteBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16, color: colors.accent },
    ownVoteFlag: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: colors.accent },
    nominationActionsRow: { flexDirection: 'row', gap: 10 },
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17,20,24,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 1000 },
    modalCard: { width: '100%', maxWidth: 400, borderRadius: radii.large, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 24, gap: 16 },
    modalTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, lineHeight: 26, color: colors.textPrimary },
    modalBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: colors.textSecondary },
    modalActions: { flexDirection: 'row', gap: 12 },
    modalButton: { flex: 1, borderRadius: radii.medium, paddingVertical: 14, alignItems: 'center', minHeight: touchTarget, justifyContent: 'center' },
    modalButtonSecondary: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
    modalButtonDanger: { backgroundColor: colors.danger },
    modalCancelText: { color: colors.textSecondary, fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 20 },
    modalDangerText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 20 },
});
