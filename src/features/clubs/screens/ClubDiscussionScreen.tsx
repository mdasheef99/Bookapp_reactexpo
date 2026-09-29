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
import { navigateBackOrFallback } from '@/lib/navigation';
import {
    useCreateClubDiscussionTopic,
    useClubDiscussionTopics,
    useClubMembership,
    useClubPublicDetail,
} from '@/features/clubs/hooks/useClubs';
import { type ClubDiscussionTopicWithDetails } from '@/features/clubs/services/clubsService';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';

const discussionColors = {
    bgPrimary: '#FAF6EE',
    bgSecondary: '#FFFEFC',
    textPrimary: '#1A1412',
    textSecondary: '#6E645F',
    textTertiary: '#8E8178',
    accent: '#8B322C',
    accentSubtle: '#F8EBE7',
    border: '#E7DCD1',
} as const;

function getAuthorLabel(authorProfile: ClubDiscussionTopicWithDetails['authorProfile'] | null) {
    return authorProfile?.display_name || authorProfile?.username || 'A club member';
}

function formatTimestamp(value: string | null) {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return date.toLocaleString(undefined, {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function getTopicBodyPreview(topic: ClubDiscussionTopicWithDetails) {
    if (topic.is_deleted) return 'This discussion topic has been deleted.';
    return topic.body?.trim() || 'No additional context provided.';
}

export default function ClubDiscussionScreen() {
    const { clubId } = useLocalSearchParams<{ clubId: string }>();
    const colors = discussionColors;
    const discussionAccent = colors.accent;
    const discussionAccentSurface = colors.accentSubtle;
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
    const [isComposerOpen, setIsComposerOpen] = useState(false);
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
                <ActivityIndicator size="large" color={discussionAccent} />
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
            <TouchableOpacity
                onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}`)}
                style={styles.backAction}
                accessibilityRole="button"
                accessibilityLabel="Back to club"
                testID="discussion-back"
            >
                <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
                <Text style={[styles.backActionText, { color: colors.textPrimary }]}>Back</Text>
            </TouchableOpacity>

            <View style={styles.identityBlock}>
                {club?.name ? <Text style={[styles.clubContext, { color: colors.textSecondary }]} numberOfLines={1}>{club.name}</Text> : null}
                <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Club discussion</Text>
            </View>

            {!userId ? (
                <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text>
                    <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Sign in to view this club&apos;s member-only discussion.</Text>
                </View>
            ) : null}
            {userId && !canViewDiscussion ? (
                <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Members only</Text>
                    <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Join this club to view and participate in member discussion.</Text>
                </View>
            ) : null}
            {canViewDiscussion && !canParticipate ? (
                <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Read-only discussion access</Text>
                    <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Muted members can browse every thread here, but only active members can create topics and reply inside them.</Text>
                </View>
            ) : null}

            {feedback ? (
                <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : '#EF4444' }]}>
                    <Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text>
                </View>
            ) : null}

            {canParticipate && isComposerOpen ? (
                <View style={[styles.composer, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <View style={styles.composerHeader}>
                        <Text style={[styles.composerTitle, { color: colors.textPrimary }]}>New topic</Text>
                        <TouchableOpacity
                            onPress={() => setIsComposerOpen(false)}
                            style={styles.hideComposerButton}
                            accessibilityRole="button"
                            testID="discussion-hide-composer"
                        >
                            <Text style={[styles.hideComposerText, { color: colors.textSecondary }]}>Hide composer</Text>
                            <Ionicons name="chevron-up" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Topic title</Text>
                    <TextInput
                        value={topicTitle}
                        onChangeText={setTopicTitle}
                        placeholder="Topic title"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Topic title"
                        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgSecondary }]}
                        testID="discussion-topic-title"
                    />
                    <Text style={[styles.inputLabel, styles.bodyInputLabel, { color: colors.textSecondary }]}>Body</Text>
                    <TextInput
                        value={topicBody}
                        onChangeText={setTopicBody}
                        placeholder="Share your thought, question, or reading prompt"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Body"
                        multiline
                        style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgSecondary }]}
                        testID="discussion-topic-body"
                    />
                    <TouchableOpacity
                        onPress={handleCreateTopic}
                        disabled={createTopicMutation.isPending}
                        accessibilityRole="button"
                        style={[styles.primaryActionButton, { backgroundColor: discussionAccent, opacity: createTopicMutation.isPending ? 0.65 : 1 }]}
                        testID="discussion-create-topic"
                    >
                        <Text style={styles.primaryActionText}>{createTopicMutation.isPending ? 'Posting...' : 'Post topic'}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {canViewDiscussion ? (
                <View style={styles.discussionSection}>
                    <View style={styles.sectionHeadingRow}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent discussion</Text>
                        {canParticipate && !isComposerOpen ? (
                            <TouchableOpacity
                                onPress={() => setIsComposerOpen(true)}
                                style={[styles.startTopicButton, { backgroundColor: discussionAccentSurface, borderColor: discussionAccentSurface }]}
                                accessibilityRole="button"
                                testID="discussion-start-topic"
                            >
                                <Ionicons name="create-outline" size={17} color={discussionAccent} />
                                <Text style={[styles.startTopicText, { color: discussionAccent }]}>Start a topic</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {isTopicsLoading ? (
                        <View style={styles.inlineLoadingRow}>
                            <ActivityIndicator size="small" color={discussionAccent} />
                            <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Loading discussion...</Text>
                        </View>
                    ) : null}
                    {isTopicsError ? (
                        <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                            <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Unable to load discussion</Text>
                            <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(topicsError, 'Unable to load this club discussion right now.')}</Text>
                            <TouchableOpacity onPress={() => refetch()} style={[styles.secondaryActionButton, { borderColor: discussionAccent }]} accessibilityRole="button" testID="discussion-retry">
                                <Text style={[styles.secondaryActionText, { color: discussionAccent }]}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                    {!isTopicsLoading && !isTopicsError && topics.length === 0 ? (
                        <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                            <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>No topics yet</Text>
                            <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Start the first discussion topic to give the club a place to talk about the current read and future picks.</Text>
                        </View>
                    ) : null}
                    {!isTopicsLoading && !isTopicsError ? topics.map((topic) => {
                        const previewReply = topic.replies[0] ?? null;
                        const topicMeta = `${getAuthorLabel(topic.authorProfile)} · ${formatTimestamp(topic.created_at)}`;
                        return (
                            <TouchableOpacity
                                key={topic.id}
                                onPress={() => openThread(topic.id)}
                                activeOpacity={0.9}
                                accessibilityRole="button"
                                accessibilityLabel={`Open discussion: ${topic.title}`}
                                style={[styles.topicRow, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                                testID={`discussion-topic-${topic.id}`}
                            >
                                <Text style={[styles.topicTitle, { color: colors.textPrimary }]}>{topic.title}</Text>
                                <View style={styles.topicMetaRow}>
                                    <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{topicMeta}</Text>
                                    {topic.hasUnread ? <Text style={[styles.unreadText, { color: discussionAccent }]}>{`${topic.unreadReplyCount} unread`}</Text> : null}
                                </View>
                                <Text style={[styles.topicBody, { color: colors.textPrimary }]} numberOfLines={3}>{getTopicBodyPreview(topic)}</Text>

                                {previewReply ? (
                                    <View style={[styles.previewReply, { backgroundColor: discussionAccentSurface, borderLeftColor: discussionAccent }]}>
                                        <Text style={[styles.previewReplyMeta, { color: colors.textSecondary }]}>{`First reply · ${getAuthorLabel(previewReply.authorProfile)} · ${formatTimestamp(previewReply.created_at)}`}</Text>
                                        <Text style={[styles.previewReplyBody, { color: colors.textPrimary }]} numberOfLines={2}>{previewReply.body?.trim() || 'No reply text provided.'}</Text>
                                    </View>
                                ) : null}

                                <View style={styles.topicFooter}>
                                    <View style={styles.topicStatsRow}>
                                        <Ionicons name="chatbubble-outline" size={15} color={colors.textSecondary} />
                                        <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`${topic.replyCount} replies · ${topic.voteCount} score`}</Text>
                                    </View>
                                    <View style={styles.openThreadRow}>
                                        <Text style={[styles.openThreadText, { color: discussionAccent }]}>Open thread</Text>
                                        <Ionicons name="chevron-forward" size={16} color={discussionAccent} />
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
    contentContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backAction: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10, marginBottom: 12 },
    backActionText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
    identityBlock: { gap: 4, marginBottom: 24 },
    clubContext: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17, letterSpacing: 0.8, textTransform: 'uppercase' },
    pageTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 28, lineHeight: 34 },
    discussionSection: { marginTop: 4 },
    sectionHeadingRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
    sectionTitle: { fontFamily: 'Inter_500Medium', fontSize: 16, lineHeight: 22 },
    startTopicButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderWidth: 1, borderRadius: 22 },
    startTopicText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
    composer: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
    composerHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
    composerTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, lineHeight: 26 },
    hideComposerButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
    hideComposerText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
    inputLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, marginBottom: 6 },
    bodyInputLabel: { marginTop: 14 },
    input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 22 },
    textArea: { minHeight: 104, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
    primaryActionButton: { minHeight: 48, marginTop: 14, borderRadius: 24, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
    primaryActionText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21 },
    noticeCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 18 },
    noticeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21, marginBottom: 5 },
    noticeBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    secondaryActionButton: { minHeight: 44, marginTop: 12, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, alignSelf: 'flex-start' },
    secondaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    inlineLoadingRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
    feedbackBanner: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
    feedbackText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
    topicRow: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, marginBottom: 12, gap: 8 },
    topicTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, lineHeight: 26 },
    topicMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
    topicMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
    unreadText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17 },
    topicBody: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, marginTop: 3 },
    previewReply: { borderLeftWidth: 2, paddingLeft: 12, paddingRight: 10, paddingVertical: 10, gap: 4, marginTop: 4 },
    previewReplyMeta: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
    previewReplyBody: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
    topicFooter: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 3 },
    topicStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    openThreadRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
    openThreadText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
});
