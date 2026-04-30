import { useState, useMemo } from 'react';
import { Alert, ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { type ClubMemberWithProfile, type ClubPublicDetails } from '@/features/clubs/services/clubsService';
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
    isLoading: boolean;
    onToggleRole: (member: ClubMemberWithProfile, nextRole: 'member' | 'moderator') => Promise<void>;
    onRemove: (member: ClubMemberWithProfile) => Promise<void>;
    onFeedback: (feedback: FeedbackState) => void;
}

export function ClubManageMembersSection({ club, members, isLoading, onToggleRole, onRemove, onFeedback }: Props) {
    const { colors } = useTheme();
    const [activeUserId, setActiveUserId] = useState<string | null>(null);
    const manageableMembers = useMemo(
        () => members.filter((member) => member.user_id !== club.admin_id),
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
                                        testID={`remove-member-${member.user_id}`}
                                        onPress={() => confirmRemove(member)}
                                        disabled={activeUserId === member.user_id}
                                        style={{ opacity: activeUserId === member.user_id ? 0.5 : 1 }}
                                    >
                                        <Text style={{ color: colors.error, fontSize: 13 }}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
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
