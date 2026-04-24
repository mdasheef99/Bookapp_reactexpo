import { useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
    useCreateClubDiscussionTopic,
    useClubDiscussionTopics,
    useClubMembership,
    useClubPublicDetail,
} from '@/features/clubs/hooks/useClubs';
import { type ClubDiscussionTopicWithDetails } from '@/features/clubs/services/clubsService';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import { useTheme } from '@/hooks/useTheme';

function getAuthorLabel(authorProfile: ClubDiscussionTopicWithDetails['authorProfile'] | null) {
    return authorProfile?.display_name || authorProfile?.username || 'A club member';
}

function formatTimestamp(value: string | null) {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return date.toLocaleString();
}

function getTopicBodyPreview(topic: ClubDiscussionTopicWithDetails) {
    if (topic.is_deleted) return 'This discussion topic has been deleted.';
    return topic.body?.trim() || 'No additional context provided.';
}

export default function ClubDiscussionScreen() {
    const { clubId } = useLocalSearchParams<{ clubId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading: isClubLoading } = useClubPublicDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const canViewDiscussion = membership?.status === 'active' || membership?.status === 'muted';
    const canParticipate = membership?.status === 'active';
    const { data: topics = [], isLoading: isTopicsLoading, isError: isTopicsError, error: topicsError, refetch } = useClubDiscussionTopics(clubId ?? null, userId, canViewDiscussion);
    const createTopicMutation = useCreateClubDiscussionTopic();

    const [topicTitle, setTopicTitle] = useState('');
    const [topicBody, setTopicBody] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const handleCreateTopic = async () => {
        if (!clubId || !canParticipate) {
            setFeedback({ type: 'error', message: 'Only active club members can start a discussion topic.' });
            return;
        }

        try {
            setFeedback(null);
            await createTopicMutation.mutateAsync({ clubId, title: topicTitle, body: topicBody });
            setTopicTitle('');
            setTopicBody('');
            setFeedback({ type: 'success', message: 'Discussion topic posted.' });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to post this discussion topic right now.') });
        }
    };

    const openThread = (topicId: string) => {
        if (!clubId) return;
        router.push(`/clubs/${clubId}/discussion/${topicId}`);
    };

    if (isClubLoading || isMembershipLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Club discussion</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Topic list</Text>
                <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
                    {club?.name
                        ? `${club.name} discussion opens by thread. Start from a topic here, then open the full conversation to read and reply.`
                        : 'Discussion opens by thread. Start from a topic here, then open the full conversation to read and reply.'}
                </Text>
                {!userId ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Sign in to view this club&apos;s member-only discussion.</Text></View> : null}
                {userId && !canViewDiscussion ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Members only</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Join this club to view and participate in member discussion.</Text></View> : null}
                {canViewDiscussion && !canParticipate ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Read-only discussion access</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Muted members can browse every thread here, but only active members can create topics and reply inside them.</Text></View> : null}
                {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text></View> : null}
            </View>

            {canParticipate ? (
                <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Start a topic</Text>
                    <TextInput value={topicTitle} onChangeText={setTopicTitle} placeholder="Topic title" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="discussion-topic-title" />
                    <TextInput value={topicBody} onChangeText={setTopicBody} placeholder="Share your thought, question, or reading prompt" placeholderTextColor={colors.textTertiary} multiline style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="discussion-topic-body" />
                    <TouchableOpacity onPress={handleCreateTopic} disabled={createTopicMutation.isPending} style={[styles.primaryActionButton, { backgroundColor: colors.accent, opacity: createTopicMutation.isPending ? 0.65 : 1 }]} testID="discussion-create-topic"><Text style={styles.primaryActionText}>{createTopicMutation.isPending ? 'Posting...' : 'Post topic'}</Text></TouchableOpacity>
                </View>
            ) : null}

            {canViewDiscussion ? (
                <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent discussion</Text>
                    {isTopicsLoading ? <View style={styles.inlineLoadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Loading discussion...</Text></View> : null}
                    {isTopicsError ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Unable to load discussion</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(topicsError, 'Unable to load this club discussion right now.')}</Text><TouchableOpacity onPress={() => refetch()} style={[styles.secondaryActionButton, { borderColor: colors.accent }]} testID="discussion-retry"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Retry</Text></TouchableOpacity></View> : null}
                    {!isTopicsLoading && !isTopicsError && topics.length === 0 ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>No topics yet</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Start the first discussion topic to give the club a place to talk about the current read and future picks.</Text></View> : null}
                    {!isTopicsLoading && !isTopicsError ? topics.map((topic) => {
                        const previewReply = topic.replies[0] ?? null;
                        return (
                            <TouchableOpacity
                                key={topic.id}
                                onPress={() => openThread(topic.id)}
                                activeOpacity={0.9}
                                style={[styles.topicCard, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}
                                testID={`discussion-topic-${topic.id}`}
                            >
                                <View style={styles.topicHeader}>
                                    <View style={styles.topicHeaderBody}>
                                        <Text style={[styles.topicTitle, { color: colors.textPrimary }]}>{topic.title}</Text>
                                        <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`Started by ${getAuthorLabel(topic.authorProfile)} · ${formatTimestamp(topic.created_at)}`}</Text>
                                    </View>
                                    {topic.hasUnread ? <View style={[styles.unreadBadge, { backgroundColor: colors.bgSecondary, borderColor: colors.accent }]}><Text style={[styles.unreadBadgeText, { color: colors.accent }]}>{`${topic.unreadReplyCount} unread`}</Text></View> : null}
                                </View>

                                <View style={[styles.topicBodyShell, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                    <Text style={[styles.topicBody, { color: colors.textPrimary }]} numberOfLines={3}>{getTopicBodyPreview(topic)}</Text>
                                </View>

                                {previewReply ? (
                                    <View style={[styles.previewReplyCard, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}>
                                        <Text style={[styles.previewReplyLabel, { color: colors.textSecondary }]}>First reply</Text>
                                        <Text style={[styles.previewReplyMeta, { color: colors.textSecondary }]}>{`${getAuthorLabel(previewReply.authorProfile)} · ${formatTimestamp(previewReply.created_at)}`}</Text>
                                        <Text style={[styles.previewReplyBody, { color: colors.textPrimary }]} numberOfLines={2}>{previewReply.body?.trim() || 'No reply text provided.'}</Text>
                                    </View>
                                ) : null}

                                <View style={styles.topicFooter}>
                                    <View style={styles.topicStatsRow}>
                                        <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`${topic.replyCount} replies`}</Text>
                                        <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`${topic.voteCount} score`}</Text>
                                    </View>
                                    <View style={styles.openThreadRow}>
                                        <Text style={[styles.openThreadText, { color: colors.accent }]}>Open thread</Text>
                                        <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }) : null}
                </View>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' },
    headerSpacer: { width: 40 },
    sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
    sectionBody: { fontSize: 14, lineHeight: 20 },
    noticeCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 },
    noticeTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
    noticeBody: { fontSize: 14, lineHeight: 20 },
    input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, marginTop: 10 },
    textArea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, minHeight: 120, textAlignVertical: 'top', marginTop: 10 },
    primaryActionButton: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    secondaryActionButton: { marginTop: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 12 },
    secondaryActionText: { fontSize: 15, fontWeight: '800' },
    inlineLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    feedbackBanner: { marginTop: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
    feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
    topicCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 12, gap: 12 },
    topicHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    topicHeaderBody: { flex: 1, gap: 4 },
    topicTitle: { fontSize: 16, fontWeight: '700' },
    topicMeta: { fontSize: 12, lineHeight: 17 },
    topicBodyShell: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
    topicBody: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
    previewReplyCard: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
    previewReplyLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    previewReplyMeta: { fontSize: 12, lineHeight: 16 },
    previewReplyBody: { fontSize: 13, lineHeight: 19 },
    topicFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    topicStatsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    openThreadRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    openThreadText: { fontSize: 13, fontWeight: '700' },
    unreadBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    unreadBadgeText: { fontSize: 12, fontWeight: '700' },
});
