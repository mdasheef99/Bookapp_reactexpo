import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { clubManageColors as colors } from './manage/managePalette';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useClubApplications, useClubJoinQuestions, useClubMembership, useClubPublicDetail, useReviewClubApplication } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import type { ClubJoinApplicationWithProfile, ReviewApplicationDecision } from '@/features/clubs/services/clubsService';

type ApplicationAnswerValue = string | { answer?: string | null; question?: string | null; questionId?: string | null };

function formatAnswerLabel(key: string, questionTextById: Map<string, string>) {
    return questionTextById.get(key) ?? key.replace(/_/g, ' ');
}

function normalizeApplicationAnswers(answers: ClubJoinApplicationWithProfile['answers'], questionTextById: Map<string, string>) {
    if (!answers) return [];

    if (Array.isArray(answers)) {
        return answers.map((entry, index) => {
            const answerEntry = (entry ?? {}) as { answer?: string | null; question?: string | null; questionId?: string | null };
            const labelKey = answerEntry.questionId || `question-${index}`;
            return {
                key: `${labelKey}-${index}`,
                label: answerEntry.question || formatAnswerLabel(labelKey, questionTextById),
                value: answerEntry.answer || 'No answer submitted.',
            };
        });
    }

    return Object.entries(answers as Record<string, ApplicationAnswerValue>).map(([key, value], index) => {
        if (typeof value === 'string') {
            return { key: `${key}-${index}`, label: formatAnswerLabel(key, questionTextById), value };
        }

        return {
            key: `${key}-${index}`,
            label: value?.question || formatAnswerLabel(value?.questionId || key, questionTextById),
            value: value?.answer || 'No answer submitted.',
        };
    });
}

export default function ClubApplicationsScreen() {
    const { clubId } = useLocalSearchParams<{ clubId: string }>();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading, isError, refetch } = useClubPublicDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const requiresApplication = club?.club_type === 'approval' || club?.club_type === 'author_club';
    const isManager = !!userId && !!club && (club.admin_id === userId || membership?.role === 'admin' || membership?.role === 'moderator');
    const { data: questions = [] } = useClubJoinQuestions(clubId ?? null, !!requiresApplication && isManager);
    const { data: applications = [], isLoading: isApplicationsLoading, isError: isApplicationsError, error: applicationsError, refetch: refetchApplications } = useClubApplications(clubId ?? null, 'pending', !!requiresApplication && isManager);
    const reviewMutation = useReviewClubApplication();
    const [declineReasons, setDeclineReasons] = useState<Record<string, string>>({});
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const questionTextById = useMemo(() => new Map(questions.map((question) => [question.id, question.question])), [questions]);

    const handleReview = async (application: ClubJoinApplicationWithProfile, decision: ReviewApplicationDecision) => {
        try {
            setFeedback(null);
            await reviewMutation.mutateAsync({ applicationId: application.id, decision, declineReason: declineReasons[application.id] });
            setFeedback({ type: 'success', message: decision === 'approved' ? 'Application approved and member added.' : 'Application declined successfully.' });
            await refetchApplications();
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to review this application right now.') });
        }
    };

    if (isLoading || isMembershipLoading) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    if (isError || !club) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, styles.noticeTitle, { color: colors.textPrimary }]}>Unable to load applications</Text><TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, styles.noticeButton, { backgroundColor: colors.accent }]} onPress={() => refetch()}><Text style={styles.primaryButtonText}>Retry</Text></TouchableOpacity></View>;
    if (!requiresApplication) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, styles.noticeTitle, { color: colors.textPrimary }]}>This club does not use applications</Text><TouchableOpacity accessibilityRole="button" style={[styles.secondaryButton, styles.noticeButton, { borderColor: colors.border }]} onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}`)}><Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Go back</Text></TouchableOpacity></View>;
    if (!isManager) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, styles.noticeTitle, { color: colors.textPrimary }]}>Moderator access required</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Only eligible moderators and admins can review join applications for this club.</Text><TouchableOpacity accessibilityRole="button" style={[styles.secondaryButton, styles.noticeButton, { borderColor: colors.border }]} onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}`)}><Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Go back</Text></TouchableOpacity></View>;
    if (isApplicationsError) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, styles.noticeTitle, { color: colors.textPrimary }]}>Unable to load applications</Text><Text style={[styles.body, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(applicationsError, 'Unable to load club applications right now.')}</Text><TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, styles.noticeButton, { backgroundColor: colors.accent }]} onPress={() => refetchApplications()}><Text style={styles.primaryButtonText}>Retry</Text></TouchableOpacity></View>;

    return (
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerRow}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to club" onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}`)} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity><View style={styles.headerContext}><Text style={styles.clubContext} numberOfLines={1}>{club.name}</Text><Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Applications</Text></View><View style={styles.headerSpacer} /></View>
            {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? colors.accentLight : colors.errorLight, borderColor: feedback.type === 'success' ? colors.accent : colors.error }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? colors.accent : colors.error }]}>{feedback.message}</Text></View> : null}
            {isApplicationsLoading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.body, { color: colors.textSecondary }]}>Loading pending applications…</Text></View> : null}
            {!isApplicationsLoading && applications.length === 0 ? <View style={[styles.heroCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.textPrimary }]}>No pending applications</Text><Text style={[styles.body, { color: colors.textSecondary }]}>You are caught up for now. New applications will appear here when readers apply.</Text></View> : null}
            {applications.map((application) => {
                const normalizedAnswers = normalizeApplicationAnswers(application.answers, questionTextById);

                return (
                    <View key={application.id} style={styles.applicationGroup}>
                    <View style={styles.card}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>{application.applicantProfile?.display_name || 'BookTalks Reader'}</Text>
                        <Text style={[styles.meta, { color: colors.textSecondary }]}>{application.applicantProfile?.city || 'Location unavailable'} • Pending review</Text>
                        </View>
                        <View style={styles.card}><Text style={styles.sectionTitle}>Application answers</Text><View style={styles.answersBlock}>{normalizedAnswers.length === 0 ? <Text style={[styles.body, { color: colors.textSecondary }]}>No written answers were submitted for this application.</Text> : normalizedAnswers.map((answer) => <View key={answer.key} style={styles.answerRow}><Text style={[styles.answerLabel, { color: colors.textPrimary }]}>{answer.label}</Text><Text style={[styles.body, { color: colors.textSecondary }]}>{answer.value}</Text></View>)}</View>
                        </View>
                        <View style={styles.card}><Text style={styles.answerLabel}>Decline reason (optional)</Text>
                        <TextInput accessibilityLabel="Optional decline reason" value={declineReasons[application.id] ?? ''} onChangeText={(value) => setDeclineReasons((current) => ({ ...current, [application.id]: value }))} placeholder="Optional decline reason" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID={`decline-reason-${application.id}`} />
                        <View style={styles.actionsRow}><TouchableOpacity accessibilityRole="button" style={[styles.secondaryButton, { borderColor: colors.error }]} onPress={() => handleReview(application, 'declined')} disabled={reviewMutation.isPending} testID={`decline-application-${application.id}`}><Text style={[styles.secondaryButtonText, { color: colors.error }]}>{reviewMutation.isPending ? 'Working…' : 'Decline'}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: reviewMutation.isPending ? 0.7 : 1 }]} onPress={() => handleReview(application, 'approved')} disabled={reviewMutation.isPending} testID={`approve-application-${application.id}`}><Text style={styles.primaryButtonText}>{reviewMutation.isPending ? 'Working…' : 'Approve'}</Text></TouchableOpacity></View>
                        </View>
                    </View>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    noticeButton: { flex: 0, alignSelf: 'center', minWidth: 120 },
    noticeTitle: { textAlign: 'center' },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerContext: { flex: 1, marginHorizontal: 12 },
    clubContext: { fontFamily: 'Inter_500Medium', fontSize: 10, lineHeight: 16, textTransform: 'uppercase', color: colors.textSecondary },
    headerTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 23, lineHeight: 29 },
    sectionTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, lineHeight: 26, marginBottom: 10, color: colors.textPrimary },
    applicationGroup: { marginBottom: 14 },
    headerSpacer: { width: 44 },
    heroCard: { paddingVertical: 10, marginBottom: 14 },
    card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: 10, padding: 14, marginBottom: 10 },
    title: { fontFamily: 'Newsreader_600SemiBold', fontSize: 24, lineHeight: 30, marginBottom: 6 },
    meta: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 0 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    answersBlock: { gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
    answerRow: { gap: 4 },
    answerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19, color: colors.textPrimary },
    input: { minHeight: 46, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 12 },
    actionsRow: { flexDirection: 'row', gap: 8 },
    primaryButton: { flex: 1, minHeight: 44, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
    primaryButtonText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 20 },
    secondaryButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
    secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 20 },
    feedbackBanner: { marginBottom: 14, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
    feedbackText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 21 },
});
