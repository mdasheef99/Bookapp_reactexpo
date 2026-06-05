import { useState, useMemo } from 'react';
import { Alert, ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
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
    const { colors } = useTheme();
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
        if (!actionDraft || !member.user_id) return;
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
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Members &amp; roles</Text>
                {manageableMembers.length === 0 ? (
                    <Text style={[styles.placeholder, { color: colors.textSecondary }]}>No eligible members to manage.</Text>
                ) : (
                    manageableMembers.map((member) => {
                        const canAssignModerator = member.status === 'active' || member.status === 'muted';
                        const memberActionDraft = actionDraft?.userId === member.user_id ? actionDraft : null;
                        const recentActions = actions.filter((action) => action.user_id === member.user_id).slice(0, 3);
                        return (
                            <View key={member.user_id} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                                <View style={styles.memberInfo}>
                                    <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                                        {member.profile?.display_name || 'Unknown'}
                                    </Text>
                                    <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                                        {formatStatus(member.status)}
                                    </Text>
                                </View>
                                <View style={styles.memberActions}>
                                    <TouchableOpacity
                                        testID={`toggle-moderator-${member.user_id}`}
                                        onPress={() => handleToggle(member)}
                                        disabled={activeUserId === member.user_id || !canAssignModerator}
                                        style={[
                                            styles.roleBadge,
                                            { backgroundColor: member.role === 'moderator' ? colors.accent : colors.bgCard, opacity: activeUserId === member.user_id || !canAssignModerator ? 0.5 : 1 },
                                        ]}
                                    >
                                        <Text style={{ color: member.role === 'moderator' ? '#FFFFFF' : colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                                            {member.role === 'moderator' ? 'Moderator' : 'Member'}
                                        </Text>
                                    </TouchableOpacity>
                                    {!canAssignModerator && (
                                        <Text style={[styles.roleNote, { color: colors.textTertiary }]} testID={`moderator-restriction-${member.user_id}`}>
                                            Only active or muted members can be assigned as moderators.
                                        </Text>
                                    )}
                                    <TouchableOpacity
                                        testID={`mute-member-${member.user_id}`}
                                        onPress={() => handleMuteToggle(member)}
                                        disabled={activeUserId === member.user_id}
                                        style={{ opacity: activeUserId === member.user_id ? 0.5 : 1 }}
                                    >
                                        <Text style={{ color: member.status === 'muted' ? colors.accent : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                                            {member.status === 'muted' ? 'Unmute' : 'Mute'}
                                        </Text>
                                    </TouchableOpacity>
                                    <View style={styles.moderationRow}>
                                        {(['warned', 'muted', 'banned'] as ClubMemberActionType[]).map((actionType) => (
                                            <TouchableOpacity
                                                key={actionType}
                                                testID={`member-action-${actionType}-${member.user_id}`}
                                                onPress={() => openActionDraft(member, actionType)}
                                                disabled={activeUserId === member.user_id}
                                                style={{ opacity: activeUserId === member.user_id ? 0.5 : 1 }}
                                            >
                                                <Text style={{ color: actionType === 'banned' ? colors.error : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                                                    {actionType === 'warned' ? 'Warn' : actionType === 'muted' ? 'Timed mute' : 'Ban'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <TouchableOpacity
                                        testID={`remove-member-${member.user_id}`}
                                        onPress={() => confirmRemove(member)}
                                        disabled={activeUserId === member.user_id}
                                        style={{ opacity: activeUserId === member.user_id ? 0.5 : 1 }}
                                    >
                                        <Text style={{ color: colors.error, fontSize: 13 }}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                                {memberActionDraft ? (
                                    <View style={styles.actionDraft}>
                                        <TextInput
                                            value={memberActionDraft.reason}
                                            onChangeText={(reason) => setActionDraft({ ...memberActionDraft, reason })}
                                            placeholder="Reason"
                                            placeholderTextColor={colors.textTertiary}
                                            style={[styles.actionInput, { borderColor: colors.border, color: colors.textPrimary }]}
                                            testID={`member-action-reason-${member.user_id}`}
                                        />
                                        {memberActionDraft.actionType === 'muted' ? (
                                            <TextInput
                                                value={memberActionDraft.durationHours}
                                                onChangeText={(durationHours) => setActionDraft({ ...memberActionDraft, durationHours })}
                                                placeholder="Hours"
                                                placeholderTextColor={colors.textTertiary}
                                                keyboardType="number-pad"
                                                style={[styles.actionInput, { borderColor: colors.border, color: colors.textPrimary }]}
                                                testID={`member-action-duration-${member.user_id}`}
                                            />
                                        ) : null}
                                        <View style={styles.draftButtons}>
                                            <TouchableOpacity onPress={() => setActionDraft(null)} testID={`member-action-cancel-${member.user_id}`}>
                                                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleSubmitAction(member)} testID={`member-action-submit-${member.user_id}`}>
                                                <Text style={{ color: colors.accent, fontWeight: '800' }}>Apply</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : null}
                                {isActionsLoading ? null : recentActions.map((action) => (
                                    <Text key={action.id} style={[styles.actionHistory, { color: colors.textTertiary }]}>
                                        {action.action_type} · {action.reason}{action.expires_at ? ` · until ${new Date(action.expires_at).toLocaleString()}` : ''}
                                    </Text>
                                ))}
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
    card: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    placeholder: {
        fontSize: 14,
        fontStyle: 'italic',
        paddingVertical: 6,
    },
    memberRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    memberInfo: {
        flex: 1,
        paddingRight: 10,
    },
    memberName: {
        fontSize: 15,
        fontWeight: '600',
    },
    memberRole: {
        fontSize: 12,
        marginTop: 2,
    },
    memberActions: {
        alignItems: 'flex-end',
        gap: 6,
    },
    moderationRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
    },
    actionDraft: {
        width: '100%',
        gap: 8,
        marginTop: 10,
    },
    actionInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 9,
        fontSize: 13,
    },
    draftButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
    },
    actionHistory: {
        width: '100%',
        fontSize: 11,
        lineHeight: 16,
        marginTop: 4,
    },
    roleBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    roleNote: {
        fontSize: 11,
        textAlign: 'right',
        maxWidth: 200,
    },
});
