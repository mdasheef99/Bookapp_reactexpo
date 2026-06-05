import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ClubComplaintResolutionAction, ClubComplaintWithProfiles } from '@/features/clubs/services/clubsService';
import type { FeedbackState } from './manageUtils';

interface Props {
    complaints: ClubComplaintWithProfiles[];
    isLoading: boolean;
    isResolving: boolean;
    onResolve: (complaintId: string, resolutionAction: ClubComplaintResolutionAction) => Promise<void>;
    onFeedback: (feedback: FeedbackState) => void;
}

function getProfileName(profile: ClubComplaintWithProfiles['reporterProfile'], fallback: string) {
    return profile?.display_name || profile?.username || fallback;
}

function getResolutionFeedback(resolutionAction: ClubComplaintResolutionAction) {
    return resolutionAction === 'no_action' ? 'Platform complaint resolved.' : 'Platform complaint action saved.';
}

export function ClubManagePlatformComplaintsSection({ complaints, isLoading, isResolving, onResolve, onFeedback }: Props) {
    const { colors } = useTheme();

    const handleResolve = async (complaintId: string, resolutionAction: ClubComplaintResolutionAction) => {
        try {
            onFeedback(null);
            await onResolve(complaintId, resolutionAction);
            onFeedback({ type: 'success', message: getResolutionFeedback(resolutionAction) });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to resolve this platform complaint right now.' });
        }
    };

    if (isLoading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="small" color={colors.accent} /></View>;
    }

    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Platform complaints</Text>
            <Text style={[styles.guidanceText, { color: colors.textSecondary }]}>Resolution actions create moderation records; durable resolution notes need the app-wide audit/RPC contract before they are saved.</Text>
            {complaints.length === 0 ? (
                <Text style={[styles.placeholder, { color: colors.textSecondary }]}>No open platform complaints.</Text>
            ) : complaints.map((complaint) => {
                const reporterName = getProfileName(complaint.reporterProfile, 'A club member');
                const reportedName = getProfileName(complaint.reportedUserProfile, 'Reported member');
                return (
                    <View key={complaint.id} style={[styles.complaintCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                        <Text style={[styles.complaintTitle, { color: colors.textPrimary }]}>{reportedName}</Text>
                        <Text style={[styles.complaintMeta, { color: colors.textSecondary }]}>Reported by {reporterName} - {complaint.reason}</Text>
                        <Text style={[styles.complaintBody, { color: colors.textPrimary }]}>{complaint.description || 'No description provided.'}</Text>
                        <View style={styles.actionRow}>
                            {(['warned', 'muted', 'banned'] as ClubComplaintResolutionAction[]).map((resolutionAction) => (
                                <TouchableOpacity
                                    key={resolutionAction}
                                    onPress={() => handleResolve(complaint.id, resolutionAction)}
                                    disabled={isResolving}
                                    style={[
                                        styles.secondaryButton,
                                        { borderColor: resolutionAction === 'banned' ? colors.error : colors.border, opacity: isResolving ? 0.65 : 1 },
                                    ]}
                                    testID={`resolve-complaint-${resolutionAction}-${complaint.id}`}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: resolutionAction === 'banned' ? colors.error : colors.textPrimary }]}>
                                        {resolutionAction === 'warned' ? 'Warn' : resolutionAction === 'muted' ? 'Timed mute' : 'Ban'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity
                            onPress={() => handleResolve(complaint.id, 'no_action')}
                            disabled={isResolving}
                            style={[styles.resolveButton, { backgroundColor: colors.accent, opacity: isResolving ? 0.65 : 1 }]}
                            testID={`resolve-complaint-no-action-${complaint.id}`}
                        >
                            <Text style={styles.resolveButtonText}>{isResolving ? 'Resolving...' : 'No action'}</Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { paddingVertical: 20, alignItems: 'center' },
    card: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    guidanceText: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
    placeholder: { fontSize: 14, fontStyle: 'italic', paddingVertical: 6 },
    complaintCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10, gap: 6 },
    complaintTitle: { fontSize: 15, fontWeight: '800' },
    complaintMeta: { fontSize: 12, lineHeight: 17 },
    complaintBody: { fontSize: 14, lineHeight: 20 },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    secondaryButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    secondaryButtonText: { fontSize: 12, fontWeight: '800' },
    resolveButton: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 4 },
    resolveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
