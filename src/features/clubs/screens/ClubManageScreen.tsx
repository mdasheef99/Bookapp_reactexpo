import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
    useClubMembers,
    useClubJoinQuestions,
    useClubMembership,
    useClubPublicDetail,
    useCreateClubJoinQuestion,
    useDeleteClubJoinQuestion,
    useUpdateClub,
    useRemoveClubMember,
    useUpdateClubMemberRole,
    useUpdateClubJoinQuestion,
} from '@/features/clubs/hooks/useClubs';
import { canHoldPrivilegedClubRole, getAccessLevelLabel, getClubsEntitlementErrorMessage, getMembershipTierLabel, getModeratorEligibilityMessage, membershipTierSatisfiesAccessLevel } from '@/features/clubs/services/clubsEntitlement';
import type { AccessLevel, ClubMemberWithProfile, ClubPublicDetails, ClubType, MeetingType } from '@/features/clubs/services/clubsService';

type FeedbackState = { type: 'success' | 'error'; message: string } | null;
type SettingsDraft = {
    name: string;
    description: string;
    coverUrl: string;
    maxMembers: string;
    clubType: ClubType;
    accessLevel: AccessLevel;
    meetingType: MeetingType | null;
};

const CLUB_TYPE_OPTIONS: Array<{ value: Exclude<ClubType, 'author_club'>; label: string; helper: string }> = [
    { value: 'public', label: 'Public', helper: 'Anyone can join instantly.' },
    { value: 'approval', label: 'Approval', helper: 'Readers apply and admins review.' },
    { value: 'invite_only', label: 'Invite only', helper: 'Readers need an invitation to join.' },
];
const ACCESS_LEVEL_OPTIONS: Array<{ value: AccessLevel; label: string }> = [
    { value: 'all', label: 'All members' },
    { value: 'pro', label: 'Pro members' },
    { value: 'pro_plus', label: 'Pro+ members' },
];
const MEETING_TYPE_OPTIONS: Array<{ value: MeetingType | null; label: string }> = [
    { value: null, label: 'Not set' },
    { value: 'online_only', label: 'Online only' },
    { value: 'venue_based', label: 'Venue based' },
    { value: 'hybrid', label: 'Hybrid' },
];

function createSettingsDraft(club: ClubPublicDetails): SettingsDraft {
    return {
        name: club.name,
        description: club.description ?? '',
        coverUrl: club.cover_url ?? '',
        maxMembers: club.max_members ? String(club.max_members) : '',
        clubType: club.club_type,
        accessLevel: club.access_level ?? 'all',
        meetingType: club.meeting_type ?? null,
    };
}

function normalizeMaxMembers(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : trimmed;
}

function formatClubType(value: ClubType) {
    if (value === 'invite_only') return 'Invite only';
    if (value === 'author_club') return 'Author club';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAccessLevel(value: AccessLevel | null) {
    if (value === 'pro_plus') return 'Pro+';
    if (value === 'pro') return 'Pro';
    return 'All members';
}

function formatMeetingType(value: MeetingType | null) {
    if (value === 'online_only') return 'Online only';
    if (value === 'venue_based') return 'Venue based';
    if (value === 'hybrid') return 'Hybrid';
    return 'Not set';
}

function isHttpUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function getSettingsValidationMessage(settings: SettingsDraft, club: ClubPublicDetails) {
    if (!settings.name.trim()) return 'Club name is required.';

    const coverUrl = settings.coverUrl.trim();
    if (coverUrl && !isHttpUrl(coverUrl)) return 'Cover image URL must start with http:// or https://, or be left blank.';

    const normalizedMaxMembers = normalizeMaxMembers(settings.maxMembers);
    if (normalizedMaxMembers && !/^([1-9][0-9]*)$/.test(normalizedMaxMembers)) {
        return 'Member cap must be a whole number greater than zero, or left blank.';
    }

    if (normalizedMaxMembers && club.member_count && Number.parseInt(normalizedMaxMembers, 10) < club.member_count) {
        return `Member cap cannot be below the current member count of ${club.member_count}.`;
    }

    return null;
}

function isSettingsDirty(settings: SettingsDraft, club: ClubPublicDetails) {
    return settings.name.trim() !== club.name
        || settings.description.trim() !== (club.description ?? '')
        || settings.coverUrl.trim() !== (club.cover_url ?? '')
        || normalizeMaxMembers(settings.maxMembers) !== (club.max_members ? String(club.max_members) : '')
        || settings.accessLevel !== (club.access_level ?? 'all')
        || settings.meetingType !== (club.meeting_type ?? null)
        || (club.club_type !== 'author_club' && settings.clubType !== club.club_type);
}

function formatStatus(status: ClubMemberWithProfile['status']) {
    if (status === 'muted') return 'Muted member';
    if (status === 'banned') return 'Banned member';
    return 'Active member';
}

export default function ClubManageScreen() {
    const { clubId } = useLocalSearchParams<{ clubId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading, isError, refetch } = useClubPublicDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const isAdmin = !!userId && !!club && (club.admin_id === userId || membership?.role === 'admin');
    const { data: members = [], isLoading: isMembersLoading, refetch: refetchMembers } = useClubMembers(clubId ?? null, isAdmin);
    const { data: questions = [], isLoading: isQuestionsLoading, refetch: refetchQuestions } = useClubJoinQuestions(clubId ?? null, isAdmin);
    const createQuestion = useCreateClubJoinQuestion();
    const updateQuestion = useUpdateClubJoinQuestion();
    const deleteQuestion = useDeleteClubJoinQuestion();
    const updateClub = useUpdateClub();
    const removeMember = useRemoveClubMember();
    const updateMemberRole = useUpdateClubMemberRole();

    const [settings, setSettings] = useState<SettingsDraft | null>(null);
    const [draftQuestion, setDraftQuestion] = useState('');
    const [draftRequired, setDraftRequired] = useState(true);
    const [edits, setEdits] = useState<Record<string, { question: string; isRequired: boolean }>>({});
    const [feedback, setFeedback] = useState<FeedbackState>(null);
    const [activeModeratorUserId, setActiveModeratorUserId] = useState<string | null>(null);
    const [activeRemovalUserId, setActiveRemovalUserId] = useState<string | null>(null);

    useEffect(() => {
        if (club) setSettings(createSettingsDraft(club));
    }, [club]);

    const nextOrderIndex = useMemo(() => questions.reduce((max, question) => Math.max(max, question.order_index), -1) + 1, [questions]);
    const hasSettingsChanges = !!club && !!settings && isSettingsDirty(settings, club);
    const manageableMembers = useMemo(() => members.filter((member) => member.user_id !== club?.admin_id), [members, club?.admin_id]);
    const settingsValidationMessage = club && settings ? getSettingsValidationMessage(settings, club) : null;

    const getEditState = (questionId: string, fallbackQuestion: string, fallbackRequired: boolean) => edits[questionId] ?? { question: fallbackQuestion, isRequired: fallbackRequired };

    const handleSaveSettings = async () => {
        if (!clubId || !club || !settings) return;
        if (settingsValidationMessage) {
            setFeedback({ type: 'error', message: settingsValidationMessage });
            return;
        }

        const normalizedMaxMembers = normalizeMaxMembers(settings.maxMembers);

        try {
            setFeedback(null);
            await updateClub.mutateAsync({
                clubId,
                updates: {
                    name: settings.name,
                    description: settings.description,
                    cover_url: settings.coverUrl,
                    max_members: normalizedMaxMembers ? Number.parseInt(normalizedMaxMembers, 10) : null,
                    access_level: settings.accessLevel,
                    meeting_type: settings.meetingType,
                    ...(club.club_type !== 'author_club' ? { club_type: settings.clubType } : {}),
                },
            });
            setFeedback({ type: 'success', message: 'Basic club settings saved.' });
            await refetch();
        } catch (error) {
            setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save club settings right now.' });
        }
    };

    const handleResetSettings = () => {
        if (!club) return;
        setSettings(createSettingsDraft(club));
        setFeedback(null);
    };

    const handleModeratorToggle = async (member: ClubMemberWithProfile) => {
        if (!clubId || !member.user_id || member.role === 'admin') return;
        if (member.status !== 'active' && member.status !== 'muted') {
            setFeedback({ type: 'error', message: 'Only active or muted members can be assigned as moderators in this version.' });
            return;
        }

        const nextRole = member.role === 'moderator' ? 'member' : 'moderator';
        const memberName = member.profile?.display_name || 'This member';

        if (nextRole === 'moderator') {
            const membershipTier = member.profile?.membership_tier ?? 'free';
            const isEligibleModerator = canHoldPrivilegedClubRole(membershipTier)
                && membershipTierSatisfiesAccessLevel(membershipTier, club.access_level ?? 'all');

            if (!isEligibleModerator) {
                setFeedback({ type: 'error', message: getModeratorEligibilityMessage(club.access_level ?? 'all', membershipTier) });
                return;
            }
        }

        try {
            setFeedback(null);
            setActiveModeratorUserId(member.user_id);
            await updateMemberRole.mutateAsync({ clubId, userId: member.user_id, role: nextRole });
            setFeedback({ type: 'success', message: nextRole === 'moderator' ? `${memberName} is now a moderator.` : `${memberName} is now a standard member.` });
            await refetchMembers();
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to update moderator status right now.') });
        } finally {
            setActiveModeratorUserId(null);
        }
    };

    const handleRemoveMember = async (member: ClubMemberWithProfile) => {
        if (!clubId || !member.user_id || member.role === 'admin') return;

        const memberName = member.profile?.display_name || 'This member';

        try {
            setFeedback(null);
            setActiveRemovalUserId(member.user_id);
            await removeMember.mutateAsync({ clubId, userId: member.user_id });
            setFeedback({ type: 'success', message: `${memberName} was removed from the club.` });
            await refetchMembers();
        } catch (error) {
            setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to remove this member right now.' });
        } finally {
            setActiveRemovalUserId(null);
        }
    };

    const confirmRemoveMember = (member: ClubMemberWithProfile) => {
        const memberName = member.profile?.display_name || 'this member';
        Alert.alert(
            'Remove member',
            `Remove ${memberName} from this club? They will lose club access immediately.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => { void handleRemoveMember(member); } },
            ],
        );
    };

    const handleCreate = async () => {
        if (!clubId || !draftQuestion.trim()) return;
        try {
            setFeedback(null);
            await createQuestion.mutateAsync({ clubId, input: { question: draftQuestion, isRequired: draftRequired, orderIndex: nextOrderIndex } });
            setDraftQuestion('');
            setDraftRequired(true);
            setFeedback({ type: 'success', message: 'Join question added.' });
            await refetchQuestions();
        } catch (error) {
            setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to add this question right now.' });
        }
    };

    const handleUpdate = async (questionId: string, question: string, isRequired: boolean) => {
        if (!clubId || !question.trim()) return;
        try {
            setFeedback(null);
            await updateQuestion.mutateAsync({ questionId, clubId, input: { question, isRequired } });
            setFeedback({ type: 'success', message: 'Join question updated.' });
            await refetchQuestions();
        } catch (error) {
            setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to update this question right now.' });
        }
    };

    const handleDelete = async (questionId: string) => {
        if (!clubId) return;
        try {
            setFeedback(null);
            await deleteQuestion.mutateAsync({ questionId, clubId });
            setFeedback({ type: 'success', message: 'Join question removed.' });
            await refetchQuestions();
        } catch (error) {
            setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to remove this question right now.' });
        }
    };

    if (isLoading || isMembershipLoading || !settings) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    if (isError || !club) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Unable to load club settings</Text><TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => refetch()}><Text style={styles.primaryButtonText}>Retry</Text></TouchableOpacity></View>;
    if (!isAdmin) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Admin access required</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Only club admins can manage basic settings and join questions.</Text><TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => router.back()}><Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Go back</Text></TouchableOpacity></View>;

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerRow}><TouchableOpacity onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity><Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Manage club</Text><View style={styles.headerSpacer} /></View>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.textPrimary }]}>{club.name}</Text><Text style={[styles.body, { color: colors.textSecondary }]}>This Manage Club slice now covers deeper basic settings, member-role management, remove-member workflows, and join-question management. Archive controls are not part of the current roadmap.</Text></View>
            {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text></View> : null}
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Basic settings</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>Edit the club profile fields the live backend supports today. Cover photo is still a URL field in this first pass.</Text>
                <View style={[styles.summaryCard, { borderColor: colors.border, backgroundColor: colors.bgPrimary }]}>
                    <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>Current saved state</Text>
                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}><Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Join mode</Text><Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatClubType(club.club_type)}</Text></View>
                        <View style={styles.summaryItem}><Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Access</Text><Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatAccessLevel(club.access_level)}</Text></View>
                        <View style={styles.summaryItem}><Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Meeting format</Text><Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatMeetingType(club.meeting_type)}</Text></View>
                        <View style={styles.summaryItem}><Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Members</Text><Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{club.max_members ? `${club.member_count ?? 0} / ${club.max_members}` : `${club.member_count ?? 0} / No cap`}</Text></View>
                    </View>
                    <Text style={[styles.summaryFootnote, { color: colors.textSecondary }]}>{club.cover_url ? 'A cover image is currently set.' : 'No cover image is currently saved.'}</Text>
                </View>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Club name</Text>
                <TextInput value={settings.name} onChangeText={(value) => setSettings((current) => current ? { ...current, name: value } : current)} placeholder="Club name" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="settings-name-input" />
                <Text style={[styles.label, { color: colors.textPrimary }]}>Description</Text>
                <TextInput value={settings.description} onChangeText={(value) => setSettings((current) => current ? { ...current, description: value } : current)} placeholder="Describe the club" placeholderTextColor={colors.textTertiary} multiline style={[styles.input, styles.textArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="settings-description-input" />
                <Text style={[styles.label, { color: colors.textPrimary }]}>Cover image URL</Text>
                <TextInput value={settings.coverUrl} onChangeText={(value) => setSettings((current) => current ? { ...current, coverUrl: value } : current)} placeholder="https://example.com/cover.jpg" autoCapitalize="none" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="settings-cover-url-input" />
                <Text style={[styles.meta, { color: colors.textSecondary }]}>Leave blank to remove the current cover image. Only http/https URLs are accepted.</Text>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Member cap</Text>
                <TextInput value={settings.maxMembers} onChangeText={(value) => setSettings((current) => current ? { ...current, maxMembers: value } : current)} placeholder="Leave blank for no limit" keyboardType="number-pad" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="settings-max-members-input" />
                <Text style={[styles.meta, { color: colors.textSecondary }]}>Leave this blank to remove the cap. Only whole numbers greater than zero are allowed, and the cap cannot go below the current member count.</Text>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Privacy & join mode</Text>
                {club.club_type === 'author_club' ? (
                    <Text style={[styles.body, { color: colors.textSecondary }]}>Author clubs keep their club type locked here. You can still update access level and meeting format below.</Text>
                ) : (
                    <View style={styles.optionGroup}>
                        {CLUB_TYPE_OPTIONS.map((option) => {
                            const selected = settings.clubType === option.value;
                            return <TouchableOpacity key={option.value} style={[styles.optionChip, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.bgSecondary : colors.bgPrimary }]} onPress={() => setSettings((current) => current ? { ...current, clubType: option.value } : current)} testID={`club-type-option-${option.value}`}><Text style={[styles.optionTitle, { color: selected ? colors.accent : colors.textPrimary }]}>{option.label}</Text><Text style={[styles.optionHelper, { color: colors.textSecondary }]}>{option.helper}</Text></TouchableOpacity>;
                        })}
                    </View>
                )}
                <Text style={[styles.label, { color: colors.textPrimary }]}>Required membership tier</Text>
                <View style={styles.inlineOptions}>
                    {ACCESS_LEVEL_OPTIONS.map((option) => {
                        const selected = settings.accessLevel === option.value;
                        return <TouchableOpacity key={option.value} style={[styles.inlineChip, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.bgSecondary : colors.bgPrimary }]} onPress={() => setSettings((current) => current ? { ...current, accessLevel: option.value } : current)} testID={`access-level-option-${option.value}`}><Text style={[styles.inlineChipText, { color: selected ? colors.accent : colors.textPrimary }]}>{option.label}</Text></TouchableOpacity>;
                    })}
                </View>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Meeting format</Text>
                <View style={styles.inlineOptions}>
                    {MEETING_TYPE_OPTIONS.map((option) => {
                        const selected = settings.meetingType === option.value;
                        const optionKey = option.value ?? 'none';
                        return <TouchableOpacity key={optionKey} style={[styles.inlineChip, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.bgSecondary : colors.bgPrimary }]} onPress={() => setSettings((current) => current ? { ...current, meetingType: option.value } : current)} testID={`meeting-type-option-${optionKey}`}><Text style={[styles.inlineChipText, { color: selected ? colors.accent : colors.textPrimary }]}>{option.label}</Text></TouchableOpacity>;
                    })}
                </View>
                {settingsValidationMessage && hasSettingsChanges ? <Text style={[styles.validationText, { color: '#B91C1C' }]} testID="settings-validation-message">{settingsValidationMessage}</Text> : null}
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border, opacity: !hasSettingsChanges || updateClub.isPending ? 0.65 : 1 }]} onPress={handleResetSettings} disabled={!hasSettingsChanges || updateClub.isPending} testID="reset-settings-button"><Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>{updateClub.isPending ? 'Working…' : 'Reset changes'}</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: !hasSettingsChanges || !!settingsValidationMessage || updateClub.isPending ? 0.65 : 1 }]} onPress={handleSaveSettings} disabled={!hasSettingsChanges || !!settingsValidationMessage || updateClub.isPending} testID="save-settings-button"><Text style={styles.primaryButtonText}>{updateClub.isPending ? 'Saving…' : 'Save settings'}</Text></TouchableOpacity>
                </View>
            </View>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Members & roles</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>Manage member roles and remove non-admin members from the current club member list. Admin ownership stays fixed to the primary club owner.</Text>
                {isMembersLoading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.body, { color: colors.textSecondary }]}>Loading club members…</Text></View> : null}
                {!isMembersLoading && manageableMembers.length === 0 ? <Text style={[styles.body, { color: colors.textSecondary }]}>No eligible members are available yet. As readers join, you can manage roles and removals from this list.</Text> : null}
                {!isMembersLoading && manageableMembers.map((member) => {
                    const memberName = member.profile?.display_name || 'BookTalks Reader';
                    const canToggleRole = member.status === 'active' || member.status === 'muted';
                    const nextActionLabel = member.role === 'moderator' ? 'Remove moderator' : 'Assign moderator';
                    const isRoleWorking = activeModeratorUserId === member.user_id && updateMemberRole.isPending;
                    const isRemovalWorking = activeRemovalUserId === member.user_id && removeMember.isPending;
                    const isAnyActionWorking = isRoleWorking || isRemovalWorking;
                    const membershipTier = member.profile?.membership_tier ?? null;
                    const canAssignModerator = member.role === 'moderator' || membershipTier === null || (canHoldPrivilegedClubRole(membershipTier) && membershipTierSatisfiesAccessLevel(membershipTier, club.access_level ?? 'all'));
                    const moderatorDisabledReason = member.role === 'moderator'
                        ? null
                        : membershipTier === null
                            ? null
                            : !canHoldPrivilegedClubRole(membershipTier)
                                ? 'Requires Pro or Pro+ membership.'
                                : `Requires an eligible ${getAccessLevelLabel(club.access_level ?? 'all')} subscription for this club.`;

                    return <View key={member.id} style={[styles.memberRow, { borderColor: colors.border, backgroundColor: colors.bgPrimary }]}><View style={styles.memberBody}><Text style={[styles.memberName, { color: colors.textPrimary }]}>{memberName}</Text><Text style={[styles.memberMeta, { color: colors.textSecondary }]}>{member.role === 'moderator' ? 'Moderator' : 'Member'} · {formatStatus(member.status)}</Text>{membershipTier ? <Text style={[styles.memberMeta, { color: colors.textSecondary }]}>{`Current tier: ${getMembershipTierLabel(membershipTier)}`}</Text> : null}{member.profile?.username ? <Text style={[styles.memberMeta, { color: colors.textTertiary }]}>{`@${member.profile.username}`}</Text> : null}</View><View style={styles.memberActions}><TouchableOpacity style={[styles.memberActionButton, { borderColor: member.role === 'moderator' ? '#EF4444' : colors.accent, backgroundColor: colors.bgSecondary, opacity: !canToggleRole || isAnyActionWorking || !canAssignModerator ? 0.55 : 1 }]} onPress={() => handleModeratorToggle(member)} disabled={!canToggleRole || isAnyActionWorking || !canAssignModerator} testID={`toggle-moderator-${member.user_id}`}><Text style={[styles.memberActionText, { color: member.role === 'moderator' ? '#B91C1C' : colors.accent }]}>{isRoleWorking ? 'Working…' : nextActionLabel}</Text></TouchableOpacity>{moderatorDisabledReason ? <Text style={[styles.memberHelperText, { color: colors.textSecondary }]} testID={`moderator-restriction-${member.user_id}`}>{moderatorDisabledReason}</Text> : null}<TouchableOpacity style={[styles.memberActionButton, styles.dangerActionButton, { borderColor: '#EF4444', backgroundColor: colors.bgSecondary, opacity: isAnyActionWorking ? 0.55 : 1 }]} onPress={() => confirmRemoveMember(member)} disabled={isAnyActionWorking} testID={`remove-member-${member.user_id}`}><Text style={[styles.memberActionText, { color: '#B91C1C' }]}>{isRemovalWorking ? 'Removing…' : 'Remove member'}</Text></TouchableOpacity></View></View>;
                })}
            </View>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Add join question</Text>
                <TextInput value={draftQuestion} onChangeText={setDraftQuestion} placeholder="What should applicants tell you?" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="new-question-input" />
                <TouchableOpacity style={[styles.toggleButton, { borderColor: draftRequired ? colors.accent : colors.border, backgroundColor: colors.bgSecondary }]} onPress={() => setDraftRequired((value) => !value)} testID="toggle-new-required"><Text style={[styles.toggleText, { color: draftRequired ? colors.accent : colors.textSecondary }]}>{draftRequired ? 'Required answer' : 'Optional answer'}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, styles.fullWidthButton, { backgroundColor: colors.accent, opacity: createQuestion.isPending ? 0.7 : 1 }]} onPress={handleCreate} disabled={createQuestion.isPending} testID="create-question-button"><Text style={styles.primaryButtonText}>{createQuestion.isPending ? 'Saving…' : 'Add question'}</Text></TouchableOpacity>
            </View>
            {isQuestionsLoading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.body, { color: colors.textSecondary }]}>Loading join questions…</Text></View> : null}
            {questions.map((question) => {
                const edit = getEditState(question.id, question.question, question.is_required ?? true);
                return <View key={question.id} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.meta, { color: colors.textSecondary }]}>Question #{question.order_index + 1}</Text><TextInput value={edit.question} onChangeText={(value) => setEdits((current) => ({ ...current, [question.id]: { ...edit, question: value } }))} placeholder="Join question" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID={`edit-question-${question.id}`} /><TouchableOpacity style={[styles.toggleButton, { borderColor: edit.isRequired ? colors.accent : colors.border, backgroundColor: colors.bgSecondary }]} onPress={() => setEdits((current) => ({ ...current, [question.id]: { ...edit, isRequired: !edit.isRequired } }))} testID={`toggle-required-${question.id}`}><Text style={[styles.toggleText, { color: edit.isRequired ? colors.accent : colors.textSecondary }]}>{edit.isRequired ? 'Required answer' : 'Optional answer'}</Text></TouchableOpacity><View style={styles.actionsRow}><TouchableOpacity style={[styles.secondaryButton, { borderColor: '#EF4444' }]} onPress={() => handleDelete(question.id)} disabled={deleteQuestion.isPending} testID={`delete-question-${question.id}`}><Text style={[styles.secondaryButtonText, { color: '#B91C1C' }]}>{deleteQuestion.isPending ? 'Working…' : 'Delete'}</Text></TouchableOpacity><TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: updateQuestion.isPending ? 0.7 : 1 }]} onPress={() => handleUpdate(question.id, edit.question, edit.isRequired)} disabled={updateQuestion.isPending} testID={`save-question-${question.id}`}><Text style={styles.primaryButtonText}>{updateQuestion.isPending ? 'Saving…' : 'Save changes'}</Text></TouchableOpacity></View></View>;
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' },
    headerSpacer: { width: 40 },
    card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 },
    title: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
    label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
    meta: { fontSize: 13, fontWeight: '500', marginBottom: 10 },
    body: { fontSize: 14, lineHeight: 20 },
    input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, marginBottom: 12 },
    textArea: { minHeight: 92, textAlignVertical: 'top' },
    optionGroup: { gap: 10, marginBottom: 12 },
    optionChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
    optionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    optionHelper: { fontSize: 12, lineHeight: 16 },
    summaryCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12, marginBottom: 14 },
    summaryTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    summaryItem: { minWidth: '45%', flexGrow: 1, gap: 4 },
    summaryLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    summaryValue: { fontSize: 14, fontWeight: '700' },
    summaryFootnote: { fontSize: 13, lineHeight: 18, marginTop: 12 },
    inlineOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
    inlineChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
    inlineChipText: { fontSize: 13, fontWeight: '700' },
    toggleButton: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
    toggleText: { fontSize: 14, fontWeight: '700' },
    validationText: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 12 },
    memberRow: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12, flexDirection: 'row', gap: 12, alignItems: 'center' },
    memberBody: { flex: 1, gap: 4 },
    memberName: { fontSize: 15, fontWeight: '700' },
    memberMeta: { fontSize: 13, lineHeight: 18 },
    memberActions: { gap: 8 },
    memberActionButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minWidth: 132, alignItems: 'center' },
    dangerActionButton: { minWidth: 132 },
    memberActionText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
    memberHelperText: { maxWidth: 164, fontSize: 12, lineHeight: 16 },
    actionsRow: { flexDirection: 'row', gap: 12 },
    fullWidthButton: { flex: 0 },
    primaryButton: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    secondaryButton: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    secondaryButtonText: { fontSize: 15, fontWeight: '800' },
    feedbackBanner: { marginBottom: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
    feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});