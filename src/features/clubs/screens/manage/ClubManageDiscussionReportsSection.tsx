import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ClubDiscussionReportWithTarget } from '@/features/clubs/services/clubsService';
import type { FeedbackState } from './manageUtils';

interface Props {
    reports: ClubDiscussionReportWithTarget[];
    isLoading: boolean;
    isResolving: boolean;
    onResolve: (reportId: string) => Promise<void>;
    onFeedback: (feedback: FeedbackState) => void;
}

function getTargetLabel(report: ClubDiscussionReportWithTarget) {
    if (report.topic) return `Topic: ${report.topic.title}`;
    if (report.reply?.topic?.title) return `Reply in ${report.reply.topic.title}`;
    return report.reply ? 'Discussion reply' : 'Discussion item';
}

function getTargetBody(report: ClubDiscussionReportWithTarget) {
    return report.topic?.body ?? report.reply?.body ?? 'Reported content is unavailable or deleted.';
}

function getReporterName(report: ClubDiscussionReportWithTarget) {
    return report.reporterProfile?.display_name || report.reporterProfile?.username || 'A club member';
}

export function ClubManageDiscussionReportsSection({ reports, isLoading, isResolving, onResolve, onFeedback }: Props) {
    const { colors } = useTheme();

    const handleResolve = async (reportId: string) => {
        try {
            onFeedback(null);
            await onResolve(reportId);
            onFeedback({ type: 'success', message: 'Discussion report resolved.' });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to resolve this report right now.' });
        }
    };

    if (isLoading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="small" color={colors.accent} /></View>;
    }

    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Discussion reports</Text>
            {reports.length === 0 ? (
                <Text style={[styles.placeholder, { color: colors.textSecondary }]}>No open discussion reports.</Text>
            ) : reports.map((report) => (
                <View key={report.id} style={[styles.reportCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.reportTitle, { color: colors.textPrimary }]}>{getTargetLabel(report)}</Text>
                    <Text style={[styles.reportMeta, { color: colors.textSecondary }]}>Reported by {getReporterName(report)} · {report.reason}</Text>
                    {report.details ? <Text style={[styles.reportBody, { color: colors.textPrimary }]}>{report.details}</Text> : null}
                    <Text style={[styles.targetBody, { color: colors.textSecondary }]} numberOfLines={3}>{getTargetBody(report)}</Text>
                    <TouchableOpacity
                        onPress={() => handleResolve(report.id)}
                        disabled={isResolving}
                        style={[styles.resolveButton, { backgroundColor: colors.accent, opacity: isResolving ? 0.65 : 1 }]}
                        testID={`resolve-discussion-report-${report.id}`}
                    >
                        <Text style={styles.resolveButtonText}>{isResolving ? 'Resolving...' : 'Mark resolved'}</Text>
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { paddingVertical: 20, alignItems: 'center' },
    card: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    placeholder: { fontSize: 14, fontStyle: 'italic', paddingVertical: 6 },
    reportCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10, gap: 6 },
    reportTitle: { fontSize: 15, fontWeight: '800' },
    reportMeta: { fontSize: 12, lineHeight: 17 },
    reportBody: { fontSize: 14, lineHeight: 20 },
    targetBody: { fontSize: 13, lineHeight: 18 },
    resolveButton: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 4 },
    resolveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
