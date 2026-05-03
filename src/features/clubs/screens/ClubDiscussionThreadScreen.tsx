import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
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
    useCreateClubDiscussionReply,
    useClubDiscussionTopic,
    useClubMembership,
    useClubPublicDetail,
    useMarkClubDiscussionTopicRead,
    useSetClubDiscussionReaction,
    useSetClubDiscussionVote,
} from '@/features/clubs/hooks/useClubs';
import {
    type ClubDiscussionReactionEmoji,
    type ClubDiscussionReactionSummary,
    type ClubDiscussionReplyWithDetails,
    type ClubDiscussionTopicWithDetails,
    type ClubDiscussionVoteType,
} from '@/features/clubs/services/clubsService';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import { useTheme } from '@/hooks/useTheme';

const REACTION_OPTIONS = ['👍', '👎', '❤️', '🔥', '👏', '😂', '😍', '😮', '😢', '🤔', '📚'] as ClubDiscussionReactionEmoji[];
const MAX_VISIBLE_REPLY_DEPTH = 2;

type ReplyTreeNode = ClubDiscussionReplyWithDetails & {
    children: ReplyTreeNode[];
    parent: ClubDiscussionReplyWithDetails | null;
};

type ReplyComposerState = {
    replyId: string | null;
};

type ReactionPickerState = {
    replyId: string | null;
    itemId: string;
};

type ReactionDetailState = {
    emoji: string;
    users: Array<{ userId: string; displayName: string; username: string | null }>;
};

function getAuthorLabel(authorProfile: ClubDiscussionTopicWithDetails['authorProfile'] | ClubDiscussionReplyWithDetails['authorProfile'] | null) {
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

function getReplyIndent(depth: number) {
    return Math.min(depth, MAX_VISIBLE_REPLY_DEPTH) * 18;
}

function buildReplyTree(replies: ClubDiscussionReplyWithDetails[]): ReplyTreeNode[] {
    const replyById = new Map<string, ReplyTreeNode>();
    replies.forEach((reply) => {
        replyById.set(reply.id, { ...reply, children: [], parent: null });
    });

    const roots: ReplyTreeNode[] = [];
    replies.forEach((reply) => {
        const node = replyById.get(reply.id);
        if (!node) return;
        if (reply.parent_reply_id) {
            const parent = replyById.get(reply.parent_reply_id);
            if (parent) {
                node.parent = parent;
                parent.children.push(node);
                return;
            }
        }
        roots.push(node);
    });

    return roots;
}

function getReactionUsers(summary: ClubDiscussionReactionSummary) {
    return summary.users ?? [];
}

export default function ClubDiscussionThreadScreen() {
    const { clubId, topicId } = useLocalSearchParams<{ clubId: string; topicId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading: isClubLoading } = useClubPublicDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const canViewDiscussion = membership?.status === 'active' || membership?.status === 'muted';
    const canParticipate = membership?.status === 'active';
    const { data: topic, isLoading: isTopicLoading, isError: isTopicError, error: topicError, refetch } = useClubDiscussionTopic(topicId ?? null, userId, canViewDiscussion);
    const createReplyMutation = useCreateClubDiscussionReply();
    const voteMutation = useSetClubDiscussionVote();
    const reactionMutation = useSetClubDiscussionReaction();
    const markReadMutation = useMarkClubDiscussionTopicRead();

    const [replyDraft, setReplyDraft] = useState('');
    const [replyComposerState, setReplyComposerState] = useState<ReplyComposerState | null>(null);
    const [reactionPickerState, setReactionPickerState] = useState<ReactionPickerState | null>(null);
    const [reactionDetailState, setReactionDetailState] = useState<ReactionDetailState | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const activeReplyTarget = useMemo(
        () => (replyComposerState?.replyId && topic ? topic.replies.find((reply) => reply.id === replyComposerState.replyId) ?? null : null),
        [replyComposerState, topic],
    );

    const handleCreateReply = async () => {
        const body = replyDraft.trim();
        if (!clubId || !topicId || !canParticipate) {
            setFeedback({ type: 'error', message: 'Only active club members can reply in club discussion.' });
            return;
        }
        if (!body) {
            setFeedback({ type: 'error', message: 'Write a reply before posting.' });
            return;
        }

        try {
            setFeedback(null);
            await createReplyMutation.mutateAsync({ clubId, input: { topicId, parentReplyId: replyComposerState?.replyId ?? null, body }, userId });
            setReplyDraft('');
            setReplyComposerState(null);
            setFeedback({ type: 'success', message: 'Reply posted.' });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to post this reply right now.') });
        }
    };

    const handleVote = async ({ replyId, voteType }: { replyId?: string; voteType: ClubDiscussionVoteType }) => {
        if (!clubId || !canParticipate) {
            setFeedback({ type: 'error', message: 'Only active club members can vote in discussion.' });
            return;
        }

        try {
            setFeedback(null);
            await voteMutation.mutateAsync({ clubId, topicId: replyId ? undefined : topicId, replyId, voteType, userId });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to update your discussion vote right now.') });
        }
    };

    const handleReaction = async (emoji: ClubDiscussionReactionEmoji) => {
        if (!clubId || !canParticipate || !reactionPickerState) {
            setFeedback({ type: 'error', message: 'Only active club members can react in discussion.' });
            return;
        }

        try {
            setFeedback(null);
            await reactionMutation.mutateAsync({
                clubId,
                topicId: reactionPickerState.replyId ? undefined : topicId,
                replyId: reactionPickerState.replyId,
                emoji,
                userId,
            });
            setReactionPickerState(null);
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to save this reaction right now.') });
        }
    };

    const handleMarkRead = async () => {
        if (!clubId || !topicId || !userId || !canViewDiscussion) return;
        try {
            setFeedback(null);
            await markReadMutation.mutateAsync({ clubId, topicId, userId });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to mark this topic as read right now.') });
        }
    };

    const renderReactionSummaryRow = (reactions: ClubDiscussionReactionSummary[], itemId: string) => {
        if (reactions.length === 0) return null;
        return (
            <View style={styles.reactionSummaryRow}>
                {reactions.map((summary) => (
                    <TouchableOpacity
                        key={`${itemId}-${summary.emoji}`}
                        onPress={() => setReactionDetailState({ emoji: summary.emoji, users: getReactionUsers(summary) })}
                        style={[
                            styles.reactionSummaryChip,
                            {
                                backgroundColor: summary.viewerReacted ? colors.bgSecondary : colors.bgPrimary,
                                borderColor: summary.viewerReacted ? colors.accent : colors.border,
                            },
                        ]}
                        testID={`discussion-reaction-summary-${itemId}-${summary.emoji}`}
                    >
                        <Text style={styles.reactionSummaryEmoji}>{summary.emoji}</Text>
                        <Text style={[styles.reactionSummaryCount, { color: summary.viewerReacted ? colors.accent : colors.textSecondary }]}>{summary.count}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderActionRow = ({
        itemId,
        replyId,
        upvoteCount,
        downvoteCount,
        viewerVote,
        onReply,
        disabled,
    }: {
        itemId: string;
        replyId: string | null;
        upvoteCount: number;
        downvoteCount: number;
        viewerVote: ClubDiscussionVoteType | null;
        onReply: () => void;
        disabled: boolean;
    }) => (
        <View style={styles.actionStrip}>
            <TouchableOpacity onPress={onReply} disabled={disabled} style={[styles.actionChip, { borderColor: colors.border }]} testID={replyId ? `discussion-reply-target-${itemId}` : `discussion-topic-reply-${topicId}`}>
                <Ionicons name="chatbubble-outline" size={15} color={colors.textSecondary} />
                <Text style={[styles.actionChipLabel, { color: colors.textSecondary }]}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleVote({ replyId: replyId ?? undefined, voteType: 'upvote' })} disabled={disabled} style={[styles.iconActionChip, { borderColor: viewerVote === 'upvote' ? colors.accent : colors.border, backgroundColor: viewerVote === 'upvote' ? colors.bgSecondary : colors.bgCard }]} testID={replyId ? `discussion-reply-upvote-${itemId}` : `discussion-topic-upvote-${topicId}`}>
                <Ionicons name="thumbs-up-outline" size={16} color={viewerVote === 'upvote' ? colors.accent : colors.textSecondary} />
                <Text style={[styles.iconActionCount, { color: viewerVote === 'upvote' ? colors.accent : colors.textSecondary }]}>{upvoteCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleVote({ replyId: replyId ?? undefined, voteType: 'downvote' })} disabled={disabled} style={[styles.iconActionChip, { borderColor: viewerVote === 'downvote' ? colors.accent : colors.border, backgroundColor: viewerVote === 'downvote' ? colors.bgSecondary : colors.bgCard }]} testID={replyId ? `discussion-reply-downvote-${itemId}` : `discussion-topic-downvote-${topicId}`}>
                <Ionicons name="thumbs-down-outline" size={16} color={viewerVote === 'downvote' ? colors.accent : colors.textSecondary} />
                <Text style={[styles.iconActionCount, { color: viewerVote === 'downvote' ? colors.accent : colors.textSecondary }]}>{downvoteCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReactionPickerState({ replyId, itemId })} disabled={disabled} style={[styles.iconActionChip, { borderColor: colors.border }]} testID={`discussion-reaction-picker-open-${itemId}`}>
                <Ionicons name="happy-outline" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
        </View>
    );

    const renderReplyNode = (node: ReplyTreeNode, activeReplyTargetId: string | null) => {
        const isReplyTarget = activeReplyTargetId === node.id;
        const showBranchLine = Math.min(node.depth, MAX_VISIBLE_REPLY_DEPTH) > 0;
        const interactionDisabled = reactionMutation.isPending || voteMutation.isPending || createReplyMutation.isPending;

        return (
            <View
                key={node.id}
                style={[
                    styles.replyTreeNode,
                    { marginLeft: getReplyIndent(node.depth), borderLeftColor: colors.border },
                    showBranchLine ? styles.replyTreeNodeNested : null,
                ]}
                testID={`discussion-reply-node-${node.id}`}
            >
                <View style={styles.replyBranchRow}>
                    {showBranchLine ? <View style={[styles.replyBranchMarker, { backgroundColor: colors.border }]} /> : null}
                    <View style={[styles.replyCard, { borderColor: isReplyTarget ? colors.accent : colors.border, backgroundColor: colors.bgCard }]}>
                        <Text style={[styles.replyMeta, { color: colors.textSecondary }]}>{`${getAuthorLabel(node.authorProfile)} · ${formatTimestamp(node.created_at)}`}</Text>
                        {node.parent ? <Text style={[styles.replyContext, { color: colors.textSecondary }]}>{`Replying to ${getAuthorLabel(node.parent.authorProfile)}`}</Text> : null}
                        <View style={[styles.bodyShell, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}>
                            <Text style={[styles.replyBody, { color: colors.textPrimary }]}>{getReplyBody(node)}</Text>
                        </View>
                        {canParticipate && !topic?.is_deleted && !node.is_deleted ? renderActionRow({
                            itemId: node.id,
                            replyId: node.id,
                            upvoteCount: node.upvoteCount,
                            downvoteCount: node.downvoteCount,
                            viewerVote: node.viewerVote,
                            onReply: () => setReplyComposerState({ replyId: node.id }),
                            disabled: interactionDisabled,
                        }) : null}
                        {!node.is_deleted ? renderReactionSummaryRow(node.reactions, node.id) : null}
                    </View>
                </View>
                {node.children.length > 0 ? <View style={styles.replyChildren}>{node.children.map((child) => renderReplyNode(child, activeReplyTarget?.id ?? null))}</View> : null}
            </View>
        );
    };

    if (isClubLoading || isMembershipLoading || isTopicLoading) {
        return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    }

    if (isTopicError || !topic) {
        return (
            <View style={[styles.container, styles.errorContainer, { backgroundColor: colors.bgPrimary }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Unable to load thread</Text>
                <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(topicError, 'Unable to load this discussion thread right now.')}</Text>
                <TouchableOpacity onPress={() => refetch()} style={[styles.secondaryActionButton, { borderColor: colors.accent }]} testID="discussion-retry"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Retry</Text></TouchableOpacity>
            </View>
        );
    }

    const replyTree = buildReplyTree(topic.replies);
    const interactionDisabled = reactionMutation.isPending || voteMutation.isPending || createReplyMutation.isPending;

    return (
        <>
            <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}?tab=discussion`)} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Discussion thread</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <View style={[styles.topicCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID={`discussion-topic-${topic.id}`}>
                    <View style={styles.topicHeader}>
                        <View style={styles.topicHeaderBody}>
                            <Text style={[styles.topicTitle, { color: colors.textPrimary }]}>{topic.title}</Text>
                            <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`${getAuthorLabel(topic.authorProfile)} · ${formatTimestamp(topic.created_at)}`}</Text>
                            {club?.name ? <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{club.name}</Text> : null}
                        </View>
                        {topic.hasUnread ? <View style={[styles.unreadBadge, { backgroundColor: colors.bgSecondary, borderColor: colors.accent }]}><Text style={[styles.unreadBadgeText, { color: colors.accent }]}>{`${topic.unreadReplyCount} unread`}</Text></View> : null}
                    </View>
                    {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text></View> : null}
                    <View style={[styles.bodyShell, styles.topicBodyShell, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}>
                        <Text style={[styles.topicBody, { color: colors.textPrimary }]}>{getTopicBody(topic)}</Text>
                    </View>
                    <View style={styles.topicStatsRow}>
                        <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`${topic.replyCount} replies`}</Text>
                        <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>{`${topic.voteCount} score`}</Text>
                    </View>
                    {canParticipate && !topic.is_deleted ? renderActionRow({
                        itemId: topic.id,
                        replyId: null,
                        upvoteCount: topic.upvoteCount,
                        downvoteCount: topic.downvoteCount,
                        viewerVote: topic.viewerVote,
                        onReply: () => setReplyComposerState({ replyId: null }),
                        disabled: interactionDisabled,
                    }) : null}
                    {!topic.is_deleted ? renderReactionSummaryRow(topic.reactions, topic.id) : null}
                    {topic.hasUnread ? <TouchableOpacity onPress={handleMarkRead} disabled={markReadMutation.isPending} style={[styles.markReadButton, { borderColor: colors.accent, opacity: markReadMutation.isPending ? 0.65 : 1 }]} testID={`discussion-topic-mark-read-${topic.id}`}><Text style={[styles.markReadText, { color: colors.accent }]}>Mark topic as read</Text></TouchableOpacity> : null}
                </View>

                <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Replies</Text>
                    {replyTree.length === 0 ? <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>No replies yet. Open the reply sheet to start the conversation.</Text> : <View style={styles.replyList}>{replyTree.map((node) => renderReplyNode(node, activeReplyTarget?.id ?? null))}</View>}
                </View>
            </ScrollView>

            <Modal visible={!!replyComposerState} transparent animationType="slide" onRequestClose={() => setReplyComposerState(null)}>
                <Pressable style={styles.sheetOverlay} onPress={() => setReplyComposerState(null)} testID="discussion-reply-sheet-overlay">
                    <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheetPressable}>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                            <View style={[styles.sheet, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="discussion-reply-sheet">
                                <View style={styles.sheetHandleWrap}><View style={[styles.sheetHandle, { backgroundColor: colors.border }]} /></View>
                                <View style={styles.sheetHeader}>
                                    <View style={styles.sheetHeaderBody}>
                                        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>{activeReplyTarget ? `Replying to ${getAuthorLabel(activeReplyTarget.authorProfile)}` : 'Reply to topic'}</Text>
                                        <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>{topic.title}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setReplyComposerState(null)} testID="discussion-reply-sheet-close"><Text style={[styles.sheetCancel, { color: colors.accent }]}>Cancel</Text></TouchableOpacity>
                                </View>
                                {activeReplyTarget ? <View style={[styles.sheetPreview, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]} testID={`discussion-reply-preview-${activeReplyTarget.id}`}><Text style={[styles.sheetPreviewAuthor, { color: colors.textPrimary }]}>{getAuthorLabel(activeReplyTarget.authorProfile)}</Text><Text style={[styles.sheetPreviewBody, { color: colors.textSecondary }]} numberOfLines={3}>{getReplyBody(activeReplyTarget)}</Text></View> : null}
                                <TextInput value={replyDraft} onChangeText={setReplyDraft} placeholder={activeReplyTarget ? `Reply to ${getAuthorLabel(activeReplyTarget.authorProfile)}` : 'Share your reply'} placeholderTextColor={colors.textTertiary} multiline autoFocus style={[styles.textArea, styles.sheetInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID={`discussion-reply-body-${topic.id}`} />
                                {activeReplyTarget ? <TouchableOpacity onPress={() => setReplyComposerState({ replyId: null })} testID={`discussion-reply-cancel-${activeReplyTarget.id}`}><Text style={[styles.sheetSwitchText, { color: colors.textSecondary }]}>Reply to the topic instead</Text></TouchableOpacity> : null}
                                <TouchableOpacity onPress={handleCreateReply} disabled={createReplyMutation.isPending} style={[styles.primaryActionButton, styles.sheetSubmit, { backgroundColor: colors.accent, opacity: createReplyMutation.isPending ? 0.65 : 1 }]} testID={`discussion-reply-submit-${topic.id}`}><Text style={styles.primaryActionText}>{createReplyMutation.isPending ? 'Posting...' : activeReplyTarget ? 'Reply to thread' : 'Reply to topic'}</Text></TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={!!reactionPickerState} transparent animationType="fade" onRequestClose={() => setReactionPickerState(null)}>
                <Pressable style={styles.sheetOverlay} onPress={() => setReactionPickerState(null)} testID="discussion-reaction-picker-overlay">
                    <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheetPressable}>
                        <View style={[styles.sheet, styles.reactionPickerSheet, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="discussion-reaction-picker">
                            <View style={styles.sheetHandleWrap}><View style={[styles.sheetHandle, { backgroundColor: colors.border }]} /></View>
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>React to this comment</Text>
                            <View style={styles.reactionPickerGrid}>
                                {REACTION_OPTIONS.map((emoji) => (
                                    <TouchableOpacity key={emoji} onPress={() => handleReaction(emoji)} style={[styles.reactionPickerOption, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]} testID={`discussion-reaction-option-${reactionPickerState?.itemId ?? 'none'}-${emoji}`}>
                                        <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={!!reactionDetailState} transparent animationType="fade" onRequestClose={() => setReactionDetailState(null)}>
                <Pressable style={styles.sheetOverlay} onPress={() => setReactionDetailState(null)} testID="discussion-reaction-detail-overlay">
                    <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheetPressable}>
                        <View style={[styles.sheet, styles.reactionUsersSheet, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="discussion-reaction-detail-sheet">
                            <View style={styles.sheetHandleWrap}><View style={[styles.sheetHandle, { backgroundColor: colors.border }]} /></View>
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>{`${reactionDetailState?.emoji ?? ''} Reactions`}</Text>
                            <View style={styles.reactionUsersList}>
                                {(reactionDetailState?.users ?? []).length > 0 ? reactionDetailState?.users.map((userSummary) => (
                                    <View key={`${reactionDetailState?.emoji}-${userSummary.userId}`} style={[styles.reactionUserRow, { borderColor: colors.border }]}>
                                        <Text style={[styles.reactionUserName, { color: colors.textPrimary }]}>{userSummary.displayName}</Text>
                                        <Text style={[styles.reactionUserHandle, { color: colors.textSecondary }]}>{userSummary.username ? `@${userSummary.username}` : 'Club member'}</Text>
                                    </View>
                                )) : <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>No reaction details available yet.</Text>}
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorContainer: { padding: 24, justifyContent: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' },
    headerSpacer: { width: 40 },
    sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
    sectionBody: { fontSize: 14, lineHeight: 20 },
    topicCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 14, gap: 10 },
    topicHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    topicHeaderBody: { flex: 1, gap: 4 },
    topicTitle: { fontSize: 16, fontWeight: '700' },
    topicMeta: { fontSize: 12, lineHeight: 17 },
    topicBodyShell: { marginTop: 2 },
    topicBody: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
    topicStatsRow: { flexDirection: 'row', gap: 12 },
    unreadBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    unreadBadgeText: { fontSize: 12, fontWeight: '700' },
    feedbackBanner: { marginTop: 4, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
    feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
    replyList: { gap: 10 },
    replyTreeNode: { gap: 8 },
    replyTreeNodeNested: { borderLeftWidth: 2, paddingLeft: 10 },
    replyBranchRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
    replyBranchMarker: { width: 16, height: 2, marginTop: 18, borderRadius: 999 },
    replyChildren: { gap: 8 },
    replyCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
    replyMeta: { fontSize: 12, lineHeight: 16 },
    replyContext: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
    replyBody: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
    bodyShell: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    actionStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    actionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
    actionChipLabel: { fontSize: 12, fontWeight: '700' },
    iconActionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
    iconActionCount: { fontSize: 11, fontWeight: '700' },
    reactionSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    reactionSummaryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    reactionSummaryEmoji: { fontSize: 14 },
    reactionSummaryCount: { fontSize: 11, fontWeight: '700' },
    markReadButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    markReadText: { fontSize: 12, fontWeight: '700' },
    input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, marginTop: 10 },
    textArea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, minHeight: 120, textAlignVertical: 'top', marginTop: 10 },
    primaryActionButton: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    secondaryActionButton: { marginTop: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 12 },
    secondaryActionText: { fontSize: 15, fontWeight: '800' },
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-end' },
    sheetPressable: { justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 12 },
    sheetHandleWrap: { alignItems: 'center', paddingBottom: 4 },
    sheetHandle: { width: 48, height: 5, borderRadius: 999 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
    sheetHeaderBody: { flex: 1, gap: 4 },
    sheetTitle: { fontSize: 16, fontWeight: '700' },
    sheetSubtitle: { fontSize: 13, lineHeight: 18 },
    sheetCancel: { fontSize: 13, fontWeight: '700' },
    sheetPreview: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
    sheetPreviewAuthor: { fontSize: 13, fontWeight: '700' },
    sheetPreviewBody: { fontSize: 13, lineHeight: 18 },
    sheetInput: { minHeight: 112, marginTop: 0 },
    sheetSwitchText: { fontSize: 13, fontWeight: '600' },
    sheetSubmit: { marginTop: 0 },
    reactionPickerSheet: { paddingBottom: 20 },
    reactionPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    reactionPickerOption: { width: 54, height: 54, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    reactionPickerEmoji: { fontSize: 24 },
    reactionUsersSheet: { maxHeight: '60%' },
    reactionUsersList: { gap: 8 },
    reactionUserRow: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    reactionUserName: { fontSize: 14, fontWeight: '700' },
    reactionUserHandle: { fontSize: 12, marginTop: 2 },
});
