import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCreateClubDiscussionReply, useCreateClubDiscussionTopic, useClubDiscussionTopics, useClubMembership, useClubPublicDetail, useMarkClubDiscussionTopicRead, useSetClubDiscussionReaction, useSetClubDiscussionVote } from '@/features/clubs/hooks/useClubs';
import { type ClubDiscussionReactionEmoji, type ClubDiscussionReplyWithDetails, type ClubDiscussionTopicWithDetails, type ClubDiscussionVoteType } from '@/features/clubs/services/clubsService';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import { useTheme } from '@/hooks/useTheme';

const REACTION_OPTIONS: ClubDiscussionReactionEmoji[] = ['👍', '❤️', '🔥', '👏', '😂'];

function getAuthorLabel(authorProfile: ClubDiscussionTopicWithDetails['authorProfile'] | ClubDiscussionReplyWithDetails['authorProfile']) {
    return authorProfile?.display_name || authorProfile?.username || 'A club member';
}

function formatTimestamp(value: string | null) {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return date.toLocaleString();
}

function getTopicBody(topic: ClubDiscussionTopicWithDetails) {
    if (topic.is_deleted) return 'This discussion topic has been deleted.';
    return topic.body?.trim() || 'No additional context provided.';
}

function getReplyBody(reply: ClubDiscussionReplyWithDetails) {
    if (reply.is_deleted) return 'This reply has been deleted.';
    return reply.body?.trim() || 'No reply text provided.';
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
    const createReplyMutation = useCreateClubDiscussionReply();
    const voteMutation = useSetClubDiscussionVote();
    const reactionMutation = useSetClubDiscussionReaction();
    const markReadMutation = useMarkClubDiscussionTopicRead();

    const [topicTitle, setTopicTitle] = useState('');
    const [topicBody, setTopicBody] = useState('');
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
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

    const handleCreateReply = async (topicId: string) => {
        const body = replyDrafts[topicId]?.trim() ?? '';
        if (!clubId || !canParticipate) {
            setFeedback({ type: 'error', message: 'Only active club members can reply in club discussion.' });
            return;
        }
        if (!body) {
            setFeedback({ type: 'error', message: 'Write a reply before posting.' });
            return;
        }

        try {
            setFeedback(null);
            await createReplyMutation.mutateAsync({ clubId, input: { topicId, body }, userId });
            setReplyDrafts((current) => ({ ...current, [topicId]: '' }));
            setFeedback({ type: 'success', message: 'Reply posted.' });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to post this reply right now.') });
        }
    };

    const handleVote = async (topicId: string, voteType: ClubDiscussionVoteType) => {
        if (!clubId || !canParticipate) {
            setFeedback({ type: 'error', message: 'Only active club members can vote in discussion.' });
            return;
        }

        try {
            setFeedback(null);
            await voteMutation.mutateAsync({ clubId, topicId, voteType, userId });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to update your discussion vote right now.') });
        }
    };

    const handleReaction = async (topicId: string, emoji: ClubDiscussionReactionEmoji) => {
        if (!clubId || !canParticipate) {
            setFeedback({ type: 'error', message: 'Only active club members can react in discussion.' });
            return;
        }

        try {
            setFeedback(null);
            await reactionMutation.mutateAsync({ clubId, topicId, emoji, userId });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to save this reaction right now.') });
        }
    };

    const handleMarkRead = async (topicId: string) => {
        if (!clubId || !userId || !canViewDiscussion) return;

        try {
            setFeedback(null);
            await markReadMutation.mutateAsync({ clubId, topicId, userId });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to mark this topic as read right now.') });
        }
    };

    if (isClubLoading || isMembershipLoading) {
        return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Club discussion</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Member-only discussion</Text>
                <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{club?.name ? `${club.name} discussion stays inside the club. Active members can post, reply, vote, and react, while muted members can still read along and manage unread activity.` : 'Club discussion stays inside the club. Active members can post, reply, vote, and react, while muted members can still read along and manage unread activity.'}</Text>
                {!userId ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Sign in to view this club’s member-only discussion.</Text></View> : null}
                {userId && !canViewDiscussion ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Members only</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Join this club to view and participate in member discussion.</Text></View> : null}
                {canViewDiscussion && !canParticipate ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Read-only discussion access</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Muted members can keep up with the discussion, but only active members can post, reply, vote, and react.</Text></View> : null}
                {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text></View> : null}
            </View>

            {canParticipate ? <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Start a topic</Text>
                <TextInput value={topicTitle} onChangeText={setTopicTitle} placeholder="Topic title" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="discussion-topic-title" />
                <TextInput value={topicBody} onChangeText={setTopicBody} placeholder="Share your thought, question, or reading prompt" placeholderTextColor={colors.textTertiary} multiline style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="discussion-topic-body" />
                <TouchableOpacity onPress={handleCreateTopic} disabled={createTopicMutation.isPending} style={[styles.primaryActionButton, { backgroundColor: colors.accent, opacity: createTopicMutation.isPending ? 0.65 : 1 }]} testID="discussion-create-topic"><Text style={styles.primaryActionText}>{createTopicMutation.isPending ? 'Posting…' : 'Post topic'}</Text></TouchableOpacity>
            </View> : null}

            {canViewDiscussion ? <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent discussion</Text>
                {isTopicsLoading ? <View style={styles.inlineLoadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Loading discussion…</Text></View> : null}
                {isTopicsError ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Unable to load discussion</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(topicsError, 'Unable to load this club discussion right now.')}</Text><TouchableOpacity onPress={() => refetch()} style={[styles.secondaryActionButton, { borderColor: colors.accent }]} testID="discussion-retry"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Retry</Text></TouchableOpacity></View> : null}
                {!isTopicsLoading && !isTopicsError && topics.length === 0 ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>No topics yet</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Start the first discussion topic to give the club a place to talk about the current read and future picks.</Text></View> : null}
                {!isTopicsLoading && !isTopicsError ? topics.map((topic) => <View key={topic.id} style={[styles.topicCard, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]} testID={`discussion-topic-${topic.id}`}>
                    <View style={styles.topicHeader}>
                        <View style={styles.topicHeaderBody}>
                            <Text style={[styles.topicTitle, { color: colors.textPrimary }]}>{topic.title}</Text>
                            <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`Started by ${getAuthorLabel(topic.authorProfile)} · ${formatTimestamp(topic.created_at)}`}</Text>
                            <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`Recent activity · ${formatTimestamp(topic.recentActivityAt ?? topic.last_replied_at ?? topic.updated_at)}`}</Text>
                        </View>
                        {topic.hasUnread ? <View style={[styles.unreadBadge, { backgroundColor: colors.bgSecondary, borderColor: colors.accent }]}><Text style={[styles.unreadBadgeText, { color: colors.accent }]}>{`${topic.unreadReplyCount} unread`}</Text></View> : null}
                    </View>
                    <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{getTopicBody(topic)}</Text>
                    <View style={styles.statRow}>
                        <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`${topic.replyCount} replies`}</Text>
                        {!topic.is_deleted ? <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`${topic.voteCount} votes`}</Text> : null}
                        {!topic.is_deleted ? <Text style={[styles.topicMeta, { color: topic.viewerVote ? colors.accent : colors.textSecondary }]}>{topic.viewerVote ? `Your vote: ${topic.viewerVote}` : 'No vote yet'}</Text> : null}
                    </View>
                    {!topic.is_deleted ? <View style={styles.actionRow}>
                        <TouchableOpacity onPress={() => handleVote(topic.id, 'upvote')} disabled={!canParticipate || voteMutation.isPending} style={[styles.secondaryActionButton, { flex: 1, marginTop: 0, borderColor: colors.accent, opacity: !canParticipate || voteMutation.isPending ? 0.65 : 1 }]} testID={`discussion-topic-upvote-${topic.id}`}><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Upvote</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleVote(topic.id, 'downvote')} disabled={!canParticipate || voteMutation.isPending} style={[styles.secondaryActionButton, { flex: 1, marginTop: 0, borderColor: colors.border, opacity: !canParticipate || voteMutation.isPending ? 0.65 : 1 }]} testID={`discussion-topic-downvote-${topic.id}`}><Text style={[styles.secondaryActionText, { color: colors.textPrimary }]}>Downvote</Text></TouchableOpacity>
                    </View> : null}
                    {!topic.is_deleted ? <View style={styles.reactionRow}>
                        {REACTION_OPTIONS.map((emoji) => {
                            const summary = topic.reactions.find((reaction) => reaction.emoji === emoji);
                            const label = summary ? `${emoji} ${summary.count}` : emoji;
                            return <TouchableOpacity key={`${topic.id}-${emoji}`} onPress={() => handleReaction(topic.id, emoji)} disabled={!canParticipate || reactionMutation.isPending} style={[styles.reactionButton, { backgroundColor: summary?.viewerReacted ? colors.bgSecondary : colors.bgCard, borderColor: summary?.viewerReacted ? colors.accent : colors.border, opacity: !canParticipate || reactionMutation.isPending ? 0.65 : 1 }]} testID={`discussion-topic-reaction-${topic.id}-${emoji}`}><Text style={[styles.reactionButtonText, { color: summary?.viewerReacted ? colors.accent : colors.textPrimary }]}>{label}</Text></TouchableOpacity>;
                        })}
                    </View> : null}
                    {topic.hasUnread ? <TouchableOpacity onPress={() => handleMarkRead(topic.id)} disabled={markReadMutation.isPending} style={[styles.secondaryActionButton, { borderColor: colors.accent, opacity: markReadMutation.isPending ? 0.65 : 1 }]} testID={`discussion-topic-mark-read-${topic.id}`}><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Mark topic as read</Text></TouchableOpacity> : null}
                    <View style={styles.replyList}>
                        {topic.replies.map((reply) => <View key={reply.id} style={[styles.replyCard, { marginLeft: Math.min(reply.depth, 2) * 12, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                            <Text style={[styles.replyMeta, { color: colors.textSecondary }]}>{`${getAuthorLabel(reply.authorProfile)} · ${formatTimestamp(reply.created_at)}`}</Text>
                            <Text style={[styles.replyBody, { color: colors.textPrimary }]}>{getReplyBody(reply)}</Text>
                        </View>)}
                    </View>
                    {canParticipate && !topic.is_deleted ? <View style={styles.replyComposer}>
                        <TextInput value={replyDrafts[topic.id] ?? ''} onChangeText={(value) => setReplyDrafts((current) => ({ ...current, [topic.id]: value }))} placeholder="Write a reply" placeholderTextColor={colors.textTertiary} multiline style={[styles.textArea, { minHeight: 96, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} testID={`discussion-reply-body-${topic.id}`} />
                        <TouchableOpacity onPress={() => handleCreateReply(topic.id)} disabled={createReplyMutation.isPending} style={[styles.secondaryActionButton, { borderColor: colors.accent, opacity: createReplyMutation.isPending ? 0.65 : 1 }]} testID={`discussion-reply-submit-${topic.id}`}><Text style={[styles.secondaryActionText, { color: colors.accent }]}>{createReplyMutation.isPending ? 'Posting…' : 'Reply to topic'}</Text></TouchableOpacity>
                    </View> : null}
                </View>) : null}
            </View> : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 }, contentContainer: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }, headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' }, headerSpacer: { width: 40 },
    sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 }, sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 }, sectionBody: { fontSize: 14, lineHeight: 20 },
    noticeCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 }, noticeTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 }, noticeBody: { fontSize: 14, lineHeight: 20 },
    input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, marginTop: 10 }, textArea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, minHeight: 120, textAlignVertical: 'top', marginTop: 10 },
    primaryActionButton: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    secondaryActionButton: { marginTop: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 12 }, secondaryActionText: { fontSize: 15, fontWeight: '800' },
    inlineLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }, feedbackBanner: { marginTop: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
    topicCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12, gap: 10 }, topicHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, topicHeaderBody: { flex: 1, gap: 4 }, topicTitle: { fontSize: 16, fontWeight: '700' }, topicMeta: { fontSize: 13, lineHeight: 18 },
    unreadBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, unreadBadgeText: { fontSize: 12, fontWeight: '700' }, statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, actionRow: { flexDirection: 'row', gap: 10 }, reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    reactionButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, reactionButtonText: { fontSize: 13, fontWeight: '700' }, replyList: { gap: 8 }, replyCard: { borderWidth: 1, borderRadius: 14, padding: 12 }, replyMeta: { fontSize: 12, lineHeight: 16 }, replyBody: { fontSize: 14, lineHeight: 20 }, replyComposer: { marginTop: 4 },
});