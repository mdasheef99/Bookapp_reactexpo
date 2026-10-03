import { useState, useMemo } from 'react';
import { Alert, ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { clubManageColors as colors } from './managePalette';
import { type ClubMemberAction, type ClubMemberActionType, type ClubMemberWithProfile, type ClubPublicDetails } from '@/features/clubs/services/clubsService';
import {
    canHoldPrivilegedClubRole,
    getModeratorEligibilityMessage,
    membershipTierSatisfiesAccessLevel,
} from '@/features/clubs/services/clubsEntitlement';
import type { FeedbackState } from './manageUtils';
import { formatStatus } from './manageUtils';

interface Props {
    club: ClubPublicDetails;
    members: ClubMemberWithProfile[];
    actions: ClubMemberAction[];
    isLoading: boolean;
    isActionsLoading: boolean;
    onToggleRole: (member: ClubMemberWithProfile, nextRole: 'member' | 'moderator') => Promise<void>;
    onToggleMute: (member: ClubMemberWithProfile, nextStatus: 'active' | 'muted') => Promise<void>;
    onCreateAction: (member: ClubMemberWithProfile, actionType: ClubMemberActionType, reason: string, durationHours?: number | null) => Promise<void>;
    onRemove: (member: ClubMemberWithProfile) => Promise<void>;
    onFeedback: (feedback: FeedbackState) => void;
}

export function ClubManageMembersSection({ club, members, actions, isLoading, isActionsLoading, onToggleRole, onToggleMute, onCreateAction, onRemove, onFeedback }: Props) {
    const [expandedUserId, setExpandedUserId] = useState<string | null | undefined>(undefined);
    const [activeUserId, setActiveUserId] = useState<string | null>(null);
    const [actionDraft, setActionDraft] = useState<{ userId: string; actionType: ClubMemberActionType; reason: string; durationHours: string } | null>(null);
    const manageableMembers = useMemo(
        () => members.filter((member) => member.user_id !== null && member.user_id !== club.admin_id),
        [members, club.admin_id],
    );

    const handleToggle = async (member: ClubMemberWithProfile) => {
        if (!member.user_id || member.role === 'admin') return;
        if (member.status !== 'active' && member.status !== 'muted') {
            onFeedback({ type: 'error', message: 'Only active or muted members can be assigned as moderators in this version.' });
            return;
        }

        const nextRole = member.role === 'moderator' ? 'member' : 'moderator';
        const memberName = member.profile?.display_name || 'This member';

        if (nextRole === 'moderator') {
            const membershipTier = member.profile?.membership_tier ?? 'free';
            const isEligible = canHoldPrivilegedClubRole(membershipTier)
                && membershipTierSatisfiesAccessLevel(membershipTier, club.access_level ?? 'all');
            if (!isEligible) {
                onFeedback({ type: 'error', message: getModeratorEligibilityMessage(club.access_level ?? 'all', membershipTier) });
                return;
            }
        }

        try {
            onFeedback(null);
            setActiveUserId(member.user_id);
            await onToggleRole(member, nextRole);
            onFeedback({ type: 'success', message: nextRole === 'moderator' ? `${memberName} is now a moderator.` : `${memberName} is now a standard member.` });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to update moderator status right now.' });
        } finally {
            setActiveUserId(null);
        }
    };

    const confirmRemove = (member: ClubMemberWithProfile) => {
        const name = member.profile?.display_name || 'this member';
        Alert.alert(
            'Remove member',
            `Remove ${name} from this club? They will lose club access immediately.`,
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => handleRemove(member) }],
        );
    };

    const handleMuteToggle = async (member: ClubMemberWithProfile) => {
        if (!member.user_id || member.role === 'admin') return;
        if (member.status !== 'active' && member.status !== 'muted') {
            onFeedback({ type: 'error', message: 'Only active or muted members can be muted or unmuted.' });
            return;
        }
        const nextStatus = member.status === 'muted' ? 'active' : 'muted';
        const memberName = member.profile?.display_name || 'This member';
        try {
            onFeedback(null);
            setActiveUserId(member.user_id);
            await onToggleMute(member, nextStatus);
            onFeedback({ type: 'success', message: nextStatus === 'muted' ? `${memberName} has been muted.` : `${memberName} is now unmuted.` });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to update mute status right now.' });
        } finally {
            setActiveUserId(null);
        }
    };

    const handleRemove = async (member: ClubMemberWithProfile) => {
        if (!member.user_id || member.role === 'admin') return;
        const memberName = member.profile?.display_name || 'This member';
        try {
            onFeedback(null);
            setActiveUserId(member.user_id);
            await onRemove(member);
            onFeedback({ type: 'success', message: `${memberName} was removed from the club.` });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to remove this member right now.' });
        } finally {
            setActiveUserId(null);
        }
    };

    const openActionDraft = (member: ClubMemberWithProfile, actionType: ClubMemberActionType) => {
        if (!member.user_id || member.role === 'admin') return;
        setActionDraft({ userId: member.user_id, actionType, reason: '', durationHours: actionType === 'muted' ? '24' : '' });
    };

    const handleSubmitAction = async (member: ClubMemberWithProfile) => {
        if (!actionDraft || !member.user_id || member.role === 'admin') return;
        const reason = actionDraft.reason.trim();
        if (!reason) {
            onFeedback({ type: 'error', message: 'Add a reason before applying a moderation action.' });
            return;
        }
        const durationHours = actionDraft.durationHours.trim() ? Number(actionDraft.durationHours.trim()) : null;
        if (durationHours !== null && (!Number.isInteger(durationHours) || durationHours < 1)) {
            onFeedback({ type: 'error', message: 'Duration must be a whole number of hours.' });
            return;
        }
        const memberName = member.profile?.display_name || 'This member';
        try {
            onFeedback(null);
            setActiveUserId(member.user_id);
            await onCreateAction(member, actionDraft.actionType, reason, durationHours);
            setActionDraft(null);
            onFeedback({ type: 'success', message: `${memberName} moderation action saved.` });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save this moderation action right now.' });
        } finally {
            setActiveUserId(null);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
            </View>
        );
    }

    return (
        <View>
            <View style={styles.card}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Members &amp; roles</Text>
                {manageableMembers.length === 0 ? (
                    <Text style={[styles.placeholder, { color: colors.textSecondary }]}>No eligible members to manage.</Text>
                ) : (
                    manageableMembers.map((member) => {
                        const canAssignModerator = member.status === 'active' || member.status === 'muted';
                        const memberActionDraft = actionDraft?.userId === member.user_id ? actionDraft : null;
                        const recentActions = actions.filter((action) => action.user_id === member.user_id).slice(0, 3);
                        const expanded = (expandedUserId === undefined ? manageableMembers[0]?.user_id : expandedUserId) === member.user_id;
                        const isAdminMember = member.role === 'admin';
                        return (
                            <View key={member.user_id} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                                <View style={styles.memberInfo}>
                                    <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                                        {member.profile?.display_name || 'Unknown'}
                                    </Text>
                                    <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                                        {member.role === 'moderator' ? 'Moderator' : member.role === 'admin' ? 'Admin' : 'Member'} · {formatStatus(member.status)}
                                    </Text>
                                </View>
                                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Manage ${member.profile?.display_name || 'Unknown'}`} accessibilityState={{ expanded }} testID={`manage-member-${member.user_id}`} style={styles.manageButton} onPress={() => setExpandedUserId(expanded ? null : member.user_id)}>
                                    <Text style={styles.manageText}>Manage {expanded ? '−' : '+'}</Text>
                                </TouchableOpacity>
                                {expanded ? <View style={styles.memberDetails}>
                                <Text style={styles.groupLabel}>Role &amp; status</Text>
                                <View style={styles.memberActions}>
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        testID={`toggle-moderator-${member.user_id}`}
                                        onPress={() => handleToggle(member)}
                                        disabled={activeUserId === member.user_id || !canAssignModerator || isAdminMember}
                                        style={[
                                            styles.roleBadge,
                                            { backgroundColor: member.role === 'moderator' ? colors.accent : colors.bgCard, opacity: activeUserId === member.user_id || !canAssignModerator || isAdminMember ? 0.5 : 1 },
                                        ]}
                                    >
                                        <Text style={[styles.actionText, { color: member.role === 'moderator' ? '#FFFFFF' : colors.textPrimary }]}>
                                            Change role to {member.role === 'moderator' ? 'Member' : 'Moderator'}
                                        </Text>
                                    </TouchableOpacity>
                                    {isAdminMember ? (
                                        <Text style={[styles.roleNote, { color: colors.textTertiary }]}>Club admins cannot be managed here.</Text>
                                    ) : !canAssignModerator && (
                                        <Text style={[styles.roleNote, { color: colors.textTertiary }]} testID={`moderator-restriction-${member.user_id}`}>
                                            Only active or muted members can be assigned as moderators.
                                        </Text>
                                    )}
                                    {member.status === 'muted' || memberActionDraft?.actionType !== 'muted' ? <TouchableOpacity
                                        accessibilityRole="button"
                                        testID={`mute-member-${member.user_id}`}
                                        onPress={() => handleMuteToggle(member)}
                                        disabled={activeUserId === member.user_id || isAdminMember}
                                        style={[styles.roleBadge, { opacity: activeUserId === member.user_id || isAdminMember ? 0.5 : 1 }]}
                                    >
                                        <Text style={[styles.actionText, { color: member.status === 'muted' ? colors.accent : colors.textSecondary }]}>
                                            {member.status === 'muted' ? 'Unmute' : 'Mute'}
                                        </Text>
                                    </TouchableOpacity> : null}
                                    </View>
                                    <Text style={styles.groupLabel}>Moderation</Text>
                                    <View style={styles.moderationRow}>
                                        {(['warned', 'muted', 'banned'] as ClubMemberActionType[]).map((actionType) => (
                                            <TouchableOpacity
                                        accessibilityRole="button"
                                                key={actionType}
                                                testID={`member-action-${actionType}-${member.user_id}`}
                                                onPress={() => openActionDraft(member, actionType)}
                                                disabled={activeUserId === member.user_id || isAdminMember}
                                                style={[styles.roleBadge, { opacity: activeUserId === member.user_id || isAdminMember ? 0.5 : 1 }, memberActionDraft?.actionType === actionType && styles.selectedAction]}
                                            >
                                                <Text style={[styles.actionText, { color: actionType === 'banned' ? colors.error : colors.textSecondary }]}>
                                                    {actionType === 'warned' ? 'Warn' : actionType === 'muted' ? 'Timed mute' : 'Ban'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                {memberActionDraft && !isAdminMember ? (
                                    <View style={styles.actionDraft}>
                                        <Text style={styles.draftTitle}>{memberActionDraft.actionType === 'muted' ? 'Timed mute' : memberActionDraft.actionType === 'warned' ? 'Warn member' : 'Ban member'}</Text>
                                        <Text style={styles.fieldLabel}>Reason</Text>
                                        <TextInput
                                            accessibilityLabel="Reason"
                                            value={memberActionDraft.reason}
                                            onChangeText={(reason) => setActionDraft({ ...memberActionDraft, reason })}
                                            placeholder="Reason"
                                            placeholderTextColor={colors.textTertiary}
                                            style={[styles.actionInput, { borderColor: colors.border, color: colors.textPrimary }]}
                                            testID={`member-action-reason-${member.user_id}`}
                                        />
                                        {memberActionDraft.actionType === 'muted' ? (
                                            <>
                                            <Text style={styles.fieldLabel}>Duration (hours)</Text>
                                            <TextInput
                                                accessibilityLabel="Duration in hours"
                                                value={memberActionDraft.durationHours}
                                                onChangeText={(durationHours) => setActionDraft({ ...memberActionDraft, durationHours })}
                                                placeholder="Hours"
                                                placeholderTextColor={colors.textTertiary}
                                                keyboardType="number-pad"
                                                style={[styles.actionInput, { borderColor: colors.border, color: colors.textPrimary }]}
                                                testID={`member-action-duration-${member.user_id}`}
                                            />
                                            <Text style={styles.helper}>Whole hours, minimum 1</Text>
                                            </>
                                        ) : null}
                                        <View style={styles.draftButtons}>
                                            <TouchableOpacity accessibilityRole="button" style={styles.roleBadge} onPress={() => setActionDraft(null)} testID={`member-action-cancel-${member.user_id}`}>
                                                <Text style={styles.actionText}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity accessibilityRole="button" style={[styles.roleBadge, { backgroundColor: colors.accent }]} onPress={() => handleSubmitAction(member)} testID={`member-action-submit-${member.user_id}`}>
                                                <Text style={[styles.actionText, { color: '#FFFFFF' }]}>{memberActionDraft.actionType === 'muted' ? 'Apply timed mute' : 'Apply'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : null}
                                    <Text style={styles.groupLabel}>Remove member</Text>
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        testID={`remove-member-${member.user_id}`}
                                        onPress={() => confirmRemove(member)}
                                        disabled={activeUserId === member.user_id || isAdminMember}
                                        style={[styles.removeButton, { opacity: activeUserId === member.user_id || isAdminMember ? 0.5 : 1 }]}
                                    >
                                        <Text style={[styles.actionText, { color: colors.error }]}>Remove from club…</Text>
                                    </TouchableOpacity>
                                {!isActionsLoading && recentActions.length > 0 ? <Text style={styles.groupLabel}>Recent moderation</Text> : null}
                                {isActionsLoading ? null : recentActions.map((action) => (
                                    <Text key={action.id} style={[styles.actionHistory, { color: colors.textTertiary }]}>
                                        {action.action_type} · {action.reason}{action.expires_at ? ` · until ${new Date(action.expires_at).toLocaleString()}` : ''}
                                    </Text>
                                ))}
                                </View> : null}
                            </View>
                        );
                    })
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { paddingVertical: 20, alignItems: 'center' },
    card: { width: '100%', maxWidth: 760, alignSelf: 'center', marginBottom: 14 },
    sectionTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 23, lineHeight: 29, marginBottom: 12 },
    placeholder: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, padding: 14 },
    memberRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.bgCard, gap: 8 },
    memberInfo: { flex: 1, minWidth: 0 },
    memberName: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, lineHeight: 26 },
    memberRole: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, marginTop: 4 },
    manageButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 6, backgroundColor: colors.accentLight },
    manageText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.accent },
    memberDetails: { width: '100%', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 },
    groupLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textSecondary, marginTop: 12, marginBottom: 6 },
    memberActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    moderationRow: { flexDirection: 'row', gap: 8 },
    roleBadge: { flex: 1, minWidth: 64, minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgPrimary, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.textPrimary },
    selectedAction: { backgroundColor: colors.accentLight, borderColor: colors.accent },
    removeButton: { minHeight: 44, borderWidth: 1, borderColor: colors.error, borderRadius: 6, justifyContent: 'center', alignItems: 'center', padding: 8 },
    actionDraft: { gap: 8, marginTop: 12, padding: 12, backgroundColor: colors.bgPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
    draftTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, color: colors.textPrimary },
    fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.textPrimary },
    helper: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, color: colors.textSecondary },
    actionInput: { minHeight: 44, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, backgroundColor: colors.bgCard },
    draftButtons: { flexDirection: 'row', gap: 8 },
    actionHistory: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4, padding: 8, backgroundColor: colors.bgPrimary, borderRadius: 4 },
    roleNote: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, width: '100%' },
});
