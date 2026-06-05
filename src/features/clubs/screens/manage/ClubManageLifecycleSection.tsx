import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ClubAdminTransferRequest, ClubManageDetails, ClubMemberWithProfile } from '@/features/clubs/services/clubsService';
import { canHoldPrivilegedClubRole, getModeratorEligibilityMessage, membershipTierSatisfiesAccessLevel } from '@/features/clubs/services/clubsEntitlement';
import type { FeedbackState } from './manageUtils';

interface Props {
    club: ClubManageDetails;
    members: ClubMemberWithProfile[];
    requests: ClubAdminTransferRequest[];
    isLoading: boolean;
    isRequestsLoading: boolean;
    isArchiving: boolean;
    isUnarchiving: boolean;
    isTransferring: boolean;
    onArchive: () => Promise<void>;
    onUnarchive: () => Promise<void>;
    onTransferAdmin: (newAdminUserId: string) => Promise<void>;
    onFeedback: (feedback: FeedbackState) => void;
}

export function ClubManageLifecycleSection({
    club,
    members,
    requests,
    isLoading,
    isRequestsLoading,
    isArchiving,
    isUnarchiving,
    isTransferring,
    onArchive,
    onUnarchive,
    onTransferAdmin,
    onFeedback,
}: Props) {
    const { colors } = useTheme();
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const isArchived = club.is_archived === true;
    const isBusy = isArchiving || isUnarchiving || isTransferring;

    const transferCandidates = useMemo(() => members.filter((member) => {
        if (!member.user_id || member.user_id === club.admin_id) return false;
        if (member.status !== 'active' && member.status !== 'muted') return false;
        const membershipTier = member.profile?.membership_tier ?? 'free';
        return canHoldPrivilegedClubRole(membershipTier) && membershipTierSatisfiesAccessLevel(membershipTier, club.access_level ?? 'all');
    }), [club.access_level, club.admin_id, members]);

    const ineligibleCandidates = useMemo(() => members.filter((member) => {
        if (!member.user_id || member.user_id === club.admin_id) return false;
        if (member.status !== 'active' && member.status !== 'muted') return false;
        return !transferCandidates.some((candidate) => candidate.user_id === member.user_id);
    }), [club.admin_id, members, transferCandidates]);

    const confirmArchive = () => {
        Alert.alert('Archive club?', 'Archived clubs are hidden from public browse and can be restored from your archived clubs list.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Archive', style: 'destructive', onPress: async () => {
                try {
                    onFeedback(null);
                    await onArchive();
                    onFeedback({ type: 'success', message: 'Club archived. You can restore it from Archived clubs.' });
                } catch (error) {
                    onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to archive this club right now.' });
                }
            } },
        ]);
    };

    const confirmUnarchive = () => {
        Alert.alert('Restore club?', 'This will make the club visible anywhere active clubs are shown again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restore', onPress: async () => {
                try {
                    onFeedback(null);
                    await onUnarchive();
                    onFeedback({ type: 'success', message: 'Club restored.' });
                } catch (error) {
                    onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to restore this club right now.' });
                }
            } },
        ]);
    };

    const pendingRequestByUserId = useMemo(() => {
        const entries = requests
            .filter((request) => request.status === 'pending')
            .map((request) => [request.proposed_admin_user_id, request] as const);
        return new Map(entries);
    }, [requests]);
    const pendingTransferRequests = useMemo(() => requests.filter((request) => request.status === 'pending'), [requests]);

    const downgradeReadinessMessage = transferCandidates.length > 0 && pendingTransferRequests.length > 0
        ? 'Ready for admin handoff: an eligible successor has a pending request.'
        : transferCandidates.length > 0
        ? 'Needs successor request: eligible successors exist, but no pending transfer request is open.'
        : 'Needs successor coverage: no eligible Pro or Pro+ successor is available yet.';
    const successorCoverageMessage = `${transferCandidates.length} eligible ${transferCandidates.length === 1 ? 'successor' : 'successors'} · ${pendingTransferRequests.length} pending transfer ${pendingTransferRequests.length === 1 ? 'request' : 'requests'}`;
    const archiveRetentionStateMessage = isArchived
        ? club.archived_at
            ? `Archived: restorable since ${new Date(club.archived_at).toLocaleString()} until a retention rule is rolled out.`
            : 'Archived: restorable until a retention rule is rolled out.'
        : 'Active: no archive retention countdown is running for this club.';

    const confirmTransfer = (member: ClubMemberWithProfile) => {
        const userId = member.user_id;
        if (!userId) return;
        const memberName = member.profile?.display_name || member.profile?.username || 'this member';
        Alert.alert('Request admin transfer?', `Ask ${memberName} to take over ${club.name}? The transfer completes only after they accept from the club detail page.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send request', onPress: async () => {
                try {
                    onFeedback(null);
                    setSelectedUserId(userId);
                    await onTransferAdmin(userId);
                    onFeedback({ type: 'success', message: `Admin transfer request sent to ${memberName}.` });
                } catch (error) {
                    onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to request club admin transfer right now.' });
                } finally {
                    setSelectedUserId(null);
                }
            } },
        ]);
    };

    if (isLoading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="small" color={colors.accent} /></View>;
    }

    return (
        <View>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Lifecycle policy</Text>
                <View style={[styles.policyGrid, { borderColor: colors.border }]}>
                    <View style={styles.policyItem}>
                        <Text style={[styles.guidanceTitle, { color: colors.textPrimary }]}>Downgrade readiness</Text>
                        <Text style={[styles.guidanceBody, { color: colors.textSecondary }]}>{downgradeReadinessMessage}</Text>
                    </View>
                    <View style={styles.policyItem}>
                        <Text style={[styles.guidanceTitle, { color: colors.textPrimary }]}>Successor coverage</Text>
                        <Text style={[styles.guidanceBody, { color: colors.textSecondary }]}>{successorCoverageMessage}</Text>
                    </View>
                    <View style={styles.policyItem}>
                        <Text style={[styles.guidanceTitle, { color: colors.textPrimary }]}>Archive retention state</Text>
                        <Text style={[styles.guidanceBody, { color: colors.textSecondary }]}>{archiveRetentionStateMessage}</Text>
                    </View>
                </View>
                <View style={[styles.warningBox, { borderColor: colors.error, backgroundColor: colors.bgSecondary }]}>
                    <Text style={[styles.guidanceTitle, { color: colors.textPrimary }]}>Admin warning</Text>
                    <Text style={[styles.guidanceBody, { color: colors.textSecondary }]}>This screen does not automatically demote admins, transfer ownership, archive excess clubs, or delete archived clubs. Use explicit requests until product policy confirms automation.</Text>
                </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Archive status</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    {isArchived ? 'This club is archived and hidden from public discovery.' : 'This club is active and visible according to its access rules.'}
                </Text>
                <View style={[styles.guidanceBox, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.guidanceTitle, { color: colors.textPrimary }]}>Archive retention</Text>
                    <Text style={[styles.guidanceBody, { color: colors.textSecondary }]}>Archived clubs stay restorable for admins while retention rules are active.</Text>
                    <Text style={[styles.guidanceBody, { color: colors.textSecondary }]}>Deletion rules are policy-controlled; archived clubs stay restorable until a retention rule is rolled out.</Text>
                </View>
                {club.archived_at ? <Text style={[styles.meta, { color: colors.textTertiary }]}>Archived {new Date(club.archived_at).toLocaleString()}</Text> : null}
                <TouchableOpacity
                    testID={isArchived ? 'manage-unarchive-club' : 'manage-archive-club'}
                    onPress={isArchived ? confirmUnarchive : confirmArchive}
                    disabled={isBusy}
                    style={[styles.primaryButton, { backgroundColor: isArchived ? colors.accent : colors.error, opacity: isBusy ? 0.6 : 1 }]}
                >
                    <Text style={styles.primaryButtonText}>{isArchived ? 'Restore club' : 'Archive club'}</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Admin succession</Text>
                <View style={[styles.guidanceBox, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.guidanceTitle, { color: colors.textPrimary }]}>Downgrade succession</Text>
                    <Text style={[styles.guidanceBody, { color: colors.textSecondary }]}>Select a Pro or Pro+ successor before downgrading the current admin so the club stays active.</Text>
                    <Text style={[styles.guidanceBody, { color: colors.textSecondary }]}>Automatic successor selection is not enabled yet. Request a successor before downgrade.</Text>
                </View>
                {transferCandidates.length === 0 ? (
                    <Text style={[styles.body, { color: colors.textSecondary }]}>No eligible Pro or Pro+ successor is available yet.</Text>
                ) : (
                    transferCandidates.map((member) => {
                        const isSelected = selectedUserId === member.user_id;
                        const pendingRequest = member.user_id ? pendingRequestByUserId.get(member.user_id) : null;
                        return (
                            <View key={member.user_id} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                                <View style={styles.memberInfo}>
                                    <Text style={[styles.memberName, { color: colors.textPrimary }]}>{member.profile?.display_name || member.profile?.username || 'BookTalks Reader'}</Text>
                                    <Text style={[styles.meta, { color: colors.textSecondary }]}>{member.profile?.membership_tier === 'pro_plus' ? 'Pro+' : 'Pro'} successor eligible</Text>
                                    {pendingRequest ? <Text style={[styles.meta, { color: colors.accent }]}>Pending request sent {new Date(pendingRequest.created_at).toLocaleString()}</Text> : null}
                                </View>
                                <TouchableOpacity
                                    testID={`transfer-admin-${member.user_id}`}
                                    onPress={() => confirmTransfer(member)}
                                    disabled={isBusy || !!pendingRequest}
                                    style={[styles.secondaryButton, { borderColor: colors.accent, opacity: isBusy || pendingRequest ? 0.6 : 1 }]}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>{pendingRequest ? 'Pending' : isSelected ? 'Sending...' : 'Request'}</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })
                )}
                {isRequestsLoading ? <Text style={[styles.meta, { color: colors.textTertiary }]}>Loading pending transfer requests...</Text> : null}
                {ineligibleCandidates.map((member) => {
                    const membershipTier = member.profile?.membership_tier ?? 'free';
                    return (
                        <Text key={member.user_id} style={[styles.ineligibleText, { color: colors.textTertiary }]}>
                            {(member.profile?.display_name || member.profile?.username || 'A member')}: {getModeratorEligibilityMessage(club.access_level ?? 'all', membershipTier)}
                        </Text>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { paddingVertical: 20, alignItems: 'center' },
    card: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    body: { fontSize: 14, lineHeight: 20 },
    meta: { fontSize: 12, marginTop: 4 },
    primaryButton: { marginTop: 14, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    guidanceBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 4 },
    guidanceTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
    guidanceBody: { fontSize: 13, lineHeight: 18 },
    policyGrid: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginTop: 4 },
    policyItem: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    warningBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 12 },
    memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, paddingVertical: 10, gap: 10 },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 15, fontWeight: '700' },
    secondaryButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    secondaryButtonText: { fontSize: 13, fontWeight: '800' },
    ineligibleText: { fontSize: 12, lineHeight: 18, marginTop: 8 },
});
