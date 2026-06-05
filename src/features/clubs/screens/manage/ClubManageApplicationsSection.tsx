import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ClubJoinApplicationWithProfile } from '@/features/clubs/services/clubsService';
import type { FeedbackState } from './manageUtils';

type ApplicationAnswerValue = string | { answer?: string | null; question?: string | null; questionId?: string | null };

interface Props {
    applications: ClubJoinApplicationWithProfile[];
    isLoading: boolean;
    onReview: (applicationId: string, action: 'approve' | 'decline') => Promise<void>;
    onFeedback: (feedback: FeedbackState) => void;
}

function normalizeApplicationAnswers(answers: unknown) {
    if (!answers) return [];

    if (Array.isArray(answers)) {
        return answers.map((entry, index) => {
            const answerEntry = (entry ?? {}) as { answer?: string | null; question?: string | null; questionId?: string | null };
            return {
                key: `${answerEntry.questionId || answerEntry.question || 'question'}-${index}`,
                question: answerEntry.question || `Question ${index + 1}`,
                answer: answerEntry.answer || 'No answer submitted.',
            };
        });
    }

    return Object.entries(answers as Record<string, ApplicationAnswerValue>).map(([key, value], index) => {
        if (typeof value === 'string') {
            return { key: `${key}-${index}`, question: key.replace(/_/g, ' '), answer: value };
        }

        return {
            key: `${key}-${index}`,
            question: value?.question || value?.questionId || key.replace(/_/g, ' '),
            answer: value?.answer || 'No answer submitted.',
        };
    });
}

export function ClubManageApplicationsSection({ applications, isLoading, onReview, onFeedback }: Props) {
    const { colors } = useTheme();
    const [activeId, setActiveId] = useState<string | null>(null);

    const handleReview = async (application: ClubJoinApplicationWithProfile, action: 'approve' | 'decline') => {
        const applicantName = application.applicantProfile?.display_name || 'this applicant';
        const actionLabel = action === 'approve' ? 'Approve' : 'Decline';

        Alert.alert(
            `${actionLabel} application`,
            `${actionLabel} ${applicantName}'s application to join this club?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: actionLabel,
                    style: action === 'approve' ? 'default' : 'destructive',
                    onPress: async () => {
                        try {
                            onFeedback(null);
                            setActiveId(application.id);
                            await onReview(application.id, action);
                            onFeedback({ type: 'success', message: `Application ${action === 'approve' ? 'approved' : 'declined'}.` });
                        } catch (error) {
                            onFeedback({ type: 'error', message: error instanceof Error ? error.message : `Unable to ${action} application right now.` });
                        } finally {
                            setActiveId(null);
                        }
                    },
                },
            ],
        );
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
            </View>
        );
    }

    if (applications.length === 0) {
        return (
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Applications</Text>
                <Text style={[styles.placeholder, { color: colors.textSecondary }]}>No pending applications.</Text>
            </View>
        );
    }

    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Applications</Text>
            {applications.map((app) => (
                <View key={app.id} style={[styles.appRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.appInfo}>
                        <Text style={[styles.appName, { color: colors.textPrimary }]}>
                            {app.applicantProfile?.display_name || 'Unknown'}
                        </Text>
                        <Text style={[styles.appMeta, { color: colors.textSecondary }]}>
                            Applied {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'recently'}
                        </Text>
                        {normalizeApplicationAnswers(app.answers).length > 0 && (
                            <View style={styles.answersBlock}>
                                {normalizeApplicationAnswers(app.answers).map((ans) => (
                                    <View key={ans.key} style={styles.answerItem}>
                                        <Text style={[styles.answerQuestion, { color: colors.textSecondary }]}>{ans.question}</Text>
                                        <Text style={[styles.answerText, { color: colors.textPrimary }]}>{ans.answer}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                    <View style={styles.appActions}>
                        <TouchableOpacity
                            onPress={() => handleReview(app, 'approve')}
                            disabled={activeId === app.id}
                            style={[styles.actionButton, { backgroundColor: colors.accent, opacity: activeId === app.id ? 0.5 : 1 }]}>
                            <Text style={styles.actionButtonText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleReview(app, 'decline')}
                            disabled={activeId === app.id}
                            style={[styles.actionButton, { backgroundColor: colors.errorLight, opacity: activeId === app.id ? 0.5 : 1 }]}>
                            <Text style={[styles.actionButtonText, { color: colors.error }]}>Decline</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
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
    appRow: {
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    appInfo: {
        marginBottom: 8,
    },
    appName: {
        fontSize: 15,
        fontWeight: '600',
    },
    appMeta: {
        fontSize: 12,
        marginTop: 2,
    },
    answersBlock: {
        marginTop: 8,
        gap: 8,
    },
    answerItem: {},
    answerQuestion: {
        fontSize: 12,
        fontWeight: '600',
    },
    answerText: {
        fontSize: 13,
        marginTop: 2,
    },
    appActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 13,
    },
});
