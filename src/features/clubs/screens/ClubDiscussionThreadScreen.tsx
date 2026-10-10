import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { navigateBackOrFallback } from '@/lib/navigation';
import {
    useCreateClubDiscussionReply,
    useClubDiscussionTopic,
    useClubMembership,
    useClubPublicDetail,
    useMarkClubDiscussionTopicRead,
    useRemoveClubDiscussionReaction,
    useRemoveClubDiscussionVote,
    useReportClubDiscussionContent,
    useSetClubDiscussionReaction,
    useSetClubDiscussionVote,
} from '@/features/clubs/hooks/useClubs';
import {
    type ClubDiscussionReactionEmoji,
    type ClubDiscussionReactionSummary,
    type ClubDiscussionReplyWithDetails,
    type ClubDiscussionTopicWithDetails,
    type ClubDiscussionReportReason,
    type ClubDiscussionVoteType,
} from '@/features/clubs/services/clubsService';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import { DiscussionReplyComposer } from '@/features/clubs/components/DiscussionReplyComposer';

const discussionColors = {
    bgPrimary: '#FAF6EE',
    bgCard: '#FFFEFC',
    bgSecondary: '#F8EBE7',
    border: '#E7DCD1',
    accent: '#8B322C',
    textPrimary: '#1A1412',
    textSecondary: '#6E645F',
    textTertiary: '#6E645F',
    feedbackSuccess: '#EDF5EC',
    feedbackSuccessBorder: '#CADCC8',
    feedbackSuccessText: '#38533A',
} as const;

// TYPE-03: mirrors the DB CHECK club_discussion_reactions_emoji_canonical (11 values)
const REACTION_OPTIONS: ClubDiscussionReactionEmoji[] = ['👍', '👎', '❤️', '🔥', '👏', '😂', '😍', '😮', '😢', '🤔', '📚'];
const MAX_VISIBLE_REPLY_DEPTH = 2;

// Keep interaction glyphs close to the comment text scale. Compact surfaces
// sit inside 44px targets so visual refinement does not reduce touch access.
const threadType = { body: 14, bodyLine: 21, action: 12, actionLine: 18, icon: 16 } as const;

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
    anchor: { x: number; y: number; width: number; height: number };
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
    return formatDistanceToNow(date, { addSuffix: true });
}

function getInitials(name: string) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
    return (words[0] ?? 'BC').slice(0, 2).toUpperCase();
}

function AuthorAvatar({ avatarUrl, name, size = 36 }: { avatarUrl?: string | null; name: string; size?: number }) {
    return (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
            {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={`${name} profile photo`} />
            ) : (
                <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
            )}
        </View>
    );
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
    return Math.min(depth, MAX_VISIBLE_REPLY_DEPTH) * 14;
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

// Preserve the conversation order while applying indentation only once per row.
function flattenReplyTree(root: ReplyTreeNode): ReplyTreeNode[] {
    return [root, ...root.children.flatMap(flattenReplyTree)];
}

export default function ClubDiscussionThreadScreen() {
    const viewport = useWindowDimensions();
    const { clubId, topicId } = useLocalSearchParams<{ clubId: string; topicId: string }>();
    const colors = discussionColors;
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading: isClubLoading } = useClubPublicDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const canViewDiscussion = membership?.status === 'active' || membership?.status === 'muted';
    const canParticipate = membership?.status === 'active';
    const { data: topic, isLoading: isTopicLoading, isError: isTopicError, error: topicError, refetch } = useClubDiscussionTopic(topicId ?? null, userId, canViewDiscussion);
    const createReplyMutation = useCreateClubDiscussionReply();
    const voteMutation = useSetClubDiscussionVote();
    const removeVoteMutation = useRemoveClubDiscussionVote();
    const reactionMutation = useSetClubDiscussionReaction();
    const removeReactionMutation = useRemoveClubDiscussionReaction();
    const markReadMutation = useMarkClubDiscussionTopicRead();

    const [replyDraft, setReplyDraft] = useState('');
    const [replyComposerState, setReplyComposerState] = useState<ReplyComposerState | null>(null);
    const [replyError, setReplyError] = useState<string | null>(null);
    const [replyPosting, setReplyPosting] = useState(false);
    const replyPostingRef = useRef(false);
    const scrollRef = useRef<ScrollView>(null);
    const composerRef = useRef<View>(null);
    const replyInputRef = useRef<TextInput>(null);
    const composerScrolledRef = useRef(false);
    const mountedRef = useRef(true);
    const votePostingRef = useRef(false);
    const composerScope = `${clubId}:${topicId}:${userId}`;
    const scopeRef = useRef({ key: composerScope });
    const previousScopeRef = useRef(composerScope);
    if (scopeRef.current.key !== composerScope) scopeRef.current = { key: composerScope };
    const [reactionPickerState, setReactionPickerState] = useState<ReactionPickerState | null>(null);
    const reactionButtonRefs = useRef(new Map<string, { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void; focus?: () => void }>());
    const reactionPickerRequest = useRef(0);
    const firstReactionRef = useRef<{ focus?: () => void } | null>(null);
    const closeReactionPicker = () => {
        reactionPickerRequest.current += 1;
        const button = reactionPickerState ? reactionButtonRefs.current.get(reactionPickerState.itemId) : null;
        setReactionPickerState(null);
        button?.focus?.();
    };
    const openReactionPicker = (replyId: string | null, itemId: string) => {
        Keyboard.dismiss();
        const request = ++reactionPickerRequest.current;
        const scope = scopeRef.current;
        reactionButtonRefs.current.get(itemId)?.measureInWindow((x, y, width, height) => {
            if (!mountedRef.current || request !== reactionPickerRequest.current || scope !== scopeRef.current) return;
            setReactionPickerState({ replyId, itemId, anchor: { x, y, width, height } });
        });
    };
    const pickerWidth = Math.min(272, Math.max(44, viewport.width - 24));
    const pickerColumns = Math.max(1, Math.floor((pickerWidth - 26 + 4) / 48));
    const pickerRows = Math.ceil(REACTION_OPTIONS.length / pickerColumns);
    const pickerHeight = Math.min(52 + pickerRows * 44 + (pickerRows - 1) * 4, Math.max(44, viewport.height - 24));
    const pickerAnchor = reactionPickerState?.anchor;
    const pickerLeft = Math.max(12, Math.min(viewport.width - pickerWidth - 12, (pickerAnchor?.x ?? 12) + (pickerAnchor?.width ?? 0) / 2 - pickerWidth / 2));
    const pickerBelow = (pickerAnchor?.y ?? 12) + (pickerAnchor?.height ?? 0) + 8;
    const pickerTop = Math.max(12, Math.min(viewport.height - pickerHeight - 12,
        pickerBelow + pickerHeight <= viewport.height - 12 ? pickerBelow : (pickerAnchor?.y ?? 12) - pickerHeight - 8));

    useEffect(() => {
        reactionPickerRequest.current += 1;
        setReactionPickerState(null);
    }, [viewport.width, viewport.height, composerScope]);

    useEffect(() => {
        if (!reactionPickerState || Platform.OS !== 'web') return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeReactionPicker();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [reactionPickerState]);
    const [reactionDetailState, setReactionDetailState] = useState<ReactionDetailState | null>(null);
    // SDD decision PRODUCT-10: overflow (⋯) menu is the report entry point.
    const [reportMenuState, setReportMenuState] = useState<{ replyId: string | null; itemId: string } | null>(null);
    const reportMutation = useReportClubDiscussionContent();
    const REPORT_REASONS: { reason: ClubDiscussionReportReason; label: string }[] = [
        { reason: 'spam', label: 'Spam' },
        { reason: 'abuse', label: 'Abuse or harassment' },
        { reason: 'off_topic', label: 'Off topic' },
        { reason: 'spoiler', label: 'Spoiler' },
        { reason: 'other', label: 'Other' },
    ];

    const handleReport = async (reason: ClubDiscussionReportReason) => {
        if (!clubId || !reportMenuState || !canViewDiscussion) return;
        try {
            setFeedback(null);
            await reportMutation.mutateAsync({
                clubId,
                topicId: reportMenuState.replyId ? undefined : topicId,
                replyId: reportMenuState.replyId,
                reason,
                userId,
            });
            setFeedback({ type: 'success', message: 'Report submitted. A moderator will review it.' });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to submit this report right now.') });
        } finally {
            setReportMenuState(null);
        }
    };
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const activeReplyTarget = useMemo(
        () => (replyComposerState?.replyId && topic ? topic.replies.find((reply) => reply.id === replyComposerState.replyId) ?? null : null),
        [replyComposerState, topic],
    );

    const isPostingReply = replyPosting || createReplyMutation.isPending;
    const targetUnavailable = !!replyComposerState && (!canParticipate || !!topic?.is_deleted || (!!replyComposerState.replyId && (!activeReplyTarget || !!activeReplyTarget.is_deleted)));
    const targetError = targetUnavailable
        ? !canParticipate ? 'Only active club members can reply in club discussion.'
            : topic?.is_deleted ? 'This topic is no longer available for replies.'
                : 'This reply is no longer available. Your draft is still here.'
        : null;

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (previousScopeRef.current === composerScope) return;
        previousScopeRef.current = composerScope;
        setReplyDraft('');
        setReplyComposerState(null);
        setReplyError(null);
        setReplyPosting(false);
        replyPostingRef.current = false;
    }, [composerScope]);

    const openReplyComposer = (replyId: string | null) => {
        if (replyPostingRef.current || createReplyMutation.isPending) return;
        composerScrolledRef.current = false;
        setReplyError(null);
        setReplyComposerState({ replyId });
    };

    const closeReplyComposer = () => {
        if (replyPostingRef.current || createReplyMutation.isPending) return;
        Keyboard.dismiss();
        setReplyComposerState(null);
    };

    useEffect(() => {
        if (!replyComposerState || reactionPickerState || reactionDetailState || reportMenuState) return;
        if (Platform.OS === 'web') {
            const handleEscape = (event: KeyboardEvent) => {
                if (event.key !== 'Escape' || replyPostingRef.current || createReplyMutation.isPending) return;
                event.preventDefault();
                Keyboard.dismiss();
                setReplyComposerState(null);
            };
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!replyPostingRef.current && !createReplyMutation.isPending) {
                Keyboard.dismiss();
                setReplyComposerState(null);
            }
            return true;
        });
        return () => subscription.remove();
    }, [replyComposerState, reactionPickerState, reactionDetailState, reportMenuState, createReplyMutation.isPending]);

    const revealReplyComposer = () => {
        if (composerScrolledRef.current || targetUnavailable) return;
        composerScrolledRef.current = true;
        requestAnimationFrame(() => {
            if (!mountedRef.current || !composerRef.current) return;
            replyInputRef.current?.focus();
            const scrollContent = scrollRef.current?.getInnerViewNode();
            if (scrollContent) composerRef.current.measureLayout(scrollContent, (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true }), () => {});
        });
    };

    const handleCreateReply = async () => {
        if (replyPostingRef.current || createReplyMutation.isPending || !replyComposerState) return;
        const body = replyDraft.trim();
        if (!clubId || !topicId || !canParticipate) {
            setReplyError('Only active club members can reply in club discussion.');
            return;
        }
        if (targetUnavailable) { setReplyError(targetError); return; }
        if (!body) {
            setReplyError('Write a reply before posting.');
            return;
        }
        const requestScope = scopeRef.current;
        const parentReplyId = replyComposerState.replyId;
        replyPostingRef.current = true;
        setReplyPosting(true);
        try {
            setFeedback(null);
            setReplyError(null);
            await createReplyMutation.mutateAsync({ clubId, input: { topicId, parentReplyId, body }, userId });
            if (!mountedRef.current || scopeRef.current !== requestScope) return;
            Keyboard.dismiss();
            setReplyDraft('');
            setReplyComposerState(null);
            setFeedback({ type: 'success', message: 'Reply posted.' });
        } catch (error) {
            if (mountedRef.current && scopeRef.current === requestScope) setReplyError(getClubsEntitlementErrorMessage(error, 'Unable to post this reply right now.'));
        } finally {
            if (mountedRef.current && scopeRef.current === requestScope) {
                replyPostingRef.current = false;
                setReplyPosting(false);
            }
        }
    };

    const renderReplyComposer = () => {
        if (!replyComposerState || !topic) return null;
        const preview = replyComposerState.replyId ? activeReplyTarget ? getReplyBody(activeReplyTarget) : 'The original reply is no longer available.' : getTopicBody(topic);
        return <DiscussionReplyComposer
            topicId={topic.id} targetId={replyComposerState.replyId}
            targetLabel={replyComposerState.replyId ? activeReplyTarget ? `Replying to ${getAuthorLabel(activeReplyTarget.authorProfile)}` : 'Reply unavailable' : 'Replying to the topic'}
            preview={preview} value={replyDraft} posting={isPostingReply} unavailable={targetUnavailable}
            error={targetError ?? replyError} colors={colors} containerRef={composerRef} inputRef={replyInputRef}
            onLayout={revealReplyComposer} onChange={setReplyDraft} onCancel={closeReplyComposer}
            onSwitchToTopic={() => openReplyComposer(null)} onSubmit={handleCreateReply}
            onQuote={() => {
                if (replyPostingRef.current || targetUnavailable) return;
                setReplyDraft((draft) => `${draft ? `${draft}\n\n` : ''}“${preview}”\n\n`);
                replyInputRef.current?.focus();
            }}
        />;
    };

    const handleVote = async ({ replyId, voteType }: { replyId?: string; voteType: ClubDiscussionVoteType }) => {
        if (!clubId || !canParticipate) {
            setFeedback({ type: 'error', message: 'Only active club members can vote in discussion.' });
            return;
        }

        try {
            setFeedback(null);
            await voteMutation.mutateAsync({ clubId, parentTopicId: topicId, topicId: replyId ? undefined : topicId, replyId, voteType, userId });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to update your discussion vote right now.') });
        }
    };

    // SDD decision PRODUCT-11: tapping the active vote toggles it off (un-vote).
    const handleVoteToggle = async ({ replyId, voteType, viewerVote }: { replyId?: string; voteType: ClubDiscussionVoteType; viewerVote: ClubDiscussionVoteType | null }) => {
        if (!clubId || !canParticipate) {
            setFeedback({ type: 'error', message: 'Only active club members can vote in discussion.' });
            return;
        }
        if (votePostingRef.current) return;
        votePostingRef.current = true;
        try {
        if (viewerVote === voteType) {
            try {
                setFeedback(null);
                await removeVoteMutation.mutateAsync({ clubId, parentTopicId: topicId, topicId: replyId ? undefined : topicId, replyId, userId });
            } catch (error) {
                setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to remove your discussion vote right now.') });
            }
            return;
        }
        await handleVote({ replyId, voteType });
        } finally {
            votePostingRef.current = false;
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
                parentTopicId: topicId,
                topicId: reactionPickerState.replyId ? undefined : topicId,
                replyId: reactionPickerState.replyId,
                emoji,
                userId,
            });
            closeReactionPicker();
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to save this reaction right now.') });
        }
    };

    // SDD decision PRODUCT-12: tapping the viewer's own active reaction removes it (un-react).
    const handleReactionToggle = async (summary: ClubDiscussionReactionSummary, replyId?: string | null) => {
        if (!clubId || !canParticipate || !summary.viewerReacted) {
            setReactionDetailState({ emoji: summary.emoji, users: getReactionUsers(summary) });
            return;
        }
        const isKnownEmoji = REACTION_OPTIONS.includes(summary.emoji as ClubDiscussionReactionEmoji);
        try {
            setFeedback(null);
            await removeReactionMutation.mutateAsync({
                clubId,
                parentTopicId: topicId,
                topicId: replyId ? undefined : topicId,
                replyId: replyId ?? null,
                emoji: isKnownEmoji ? (summary.emoji as ClubDiscussionReactionEmoji) : summary.emoji,
                userId,
            });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to remove this reaction right now.') });
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

    const renderReactionSummaryRow = (reactions: ClubDiscussionReactionSummary[], itemId: string, replyId: string | null = null) => {
        if (reactions.length === 0) return null;
        return (
            <View style={styles.reactionSummaryRow}>
                {reactions.map((summary) => (
                    <TouchableOpacity
                        key={`${itemId}-${summary.emoji}`}
                        onPress={() => handleReactionToggle(summary, replyId)}
                        accessibilityRole="button"
                        accessibilityLabel={`${summary.emoji}, ${summary.count} reactions. ${summary.viewerReacted && canParticipate ? 'Remove your reaction' : 'See who reacted'}`}
                        accessibilityState={{ selected: summary.viewerReacted }}
                        style={[
                            styles.reactionSummaryChip,
                            {
                                backgroundColor: 'transparent',
                            },
                        ]}
                        testID={`discussion-reaction-summary-${itemId}-${summary.emoji}`}
                    >
                        <View style={[styles.reactionSummarySurface, { backgroundColor: summary.viewerReacted ? colors.bgSecondary : colors.bgPrimary, borderColor: summary.viewerReacted ? colors.accent : colors.border }]}>
                            <Text style={styles.reactionSummaryEmoji}>{summary.emoji}</Text>
                            <Text style={[styles.reactionSummaryCount, { color: summary.viewerReacted ? colors.accent : colors.textSecondary }]}>{summary.count}</Text>
                        </View>
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
        score,
        viewerVote,
        onReply,
        disabled,
        reactions,
    }: {
        itemId: string;
        replyId: string | null;
        upvoteCount: number;
        downvoteCount: number;
        score?: number;
        viewerVote: ClubDiscussionVoteType | null;
        onReply: () => void;
        disabled: boolean;
        reactions?: ClubDiscussionReactionSummary[];
    }) => (
        <View style={styles.actionStrip}>
            <TouchableOpacity onPress={onReply} disabled={disabled} style={[styles.actionChip, replyId ? styles.replyActionQuiet : styles.replyActionPrimary, { backgroundColor: replyId ? colors.bgCard : colors.accent, borderColor: replyId ? colors.border : colors.accent }]} testID={replyId ? `discussion-reply-target-${itemId}` : `discussion-topic-reply-${topicId}`} accessibilityRole="button">
                <Ionicons name="chatbubble-outline" size={threadType.icon} color={replyId ? colors.textSecondary : '#FFFFFF'} />
                <Text style={[styles.actionChipLabel, { color: replyId ? colors.textSecondary : '#FFFFFF' }]}>Reply</Text>
            </TouchableOpacity>
            <View style={styles.voteGroup}>
                <TouchableOpacity onPress={() => handleVoteToggle({ replyId: replyId ?? undefined, voteType: 'upvote', viewerVote })} disabled={disabled} style={styles.voteButton} testID={replyId ? `discussion-reply-upvote-${itemId}` : `discussion-topic-upvote-${topicId}`} accessibilityRole="button" accessibilityLabel={`Upvote ${replyId ? 'reply' : 'topic'}, ${upvoteCount} upvotes`} accessibilityState={{ selected: viewerVote === 'upvote', disabled }}>
                    <View style={[styles.voteSurface, { backgroundColor: viewerVote === 'upvote' ? colors.bgSecondary : 'transparent' }]}>
                        <Ionicons name="arrow-up" size={threadType.icon} color={viewerVote === 'upvote' ? colors.accent : colors.textSecondary} />
                        {score === undefined ? <Text style={[styles.iconActionCount, { color: viewerVote === 'upvote' ? colors.accent : colors.textSecondary }]}>{upvoteCount}</Text> : null}
                    </View>
                </TouchableOpacity>
                {score !== undefined ? <Text style={[styles.topicScore, { color: colors.textPrimary }]} accessibilityLabel={`${score} votes`}>{score}</Text> : null}
                <TouchableOpacity onPress={() => handleVoteToggle({ replyId: replyId ?? undefined, voteType: 'downvote', viewerVote })} disabled={disabled} style={styles.voteButton} testID={replyId ? `discussion-reply-downvote-${itemId}` : `discussion-topic-downvote-${topicId}`} accessibilityRole="button" accessibilityLabel={`Downvote ${replyId ? 'reply' : 'topic'}, ${downvoteCount} downvotes`} accessibilityState={{ selected: viewerVote === 'downvote', disabled }}>
                    <View style={[styles.voteSurface, { backgroundColor: viewerVote === 'downvote' ? colors.bgSecondary : 'transparent' }]}>
                        <Ionicons name="arrow-down" size={threadType.icon} color={viewerVote === 'downvote' ? colors.accent : colors.textSecondary} />
                        {score === undefined ? <Text style={[styles.iconActionCount, { color: viewerVote === 'downvote' ? colors.accent : colors.textSecondary }]}>{downvoteCount}</Text> : null}
                    </View>
                </TouchableOpacity>
            </View>
            <TouchableOpacity ref={button => { if (button) reactionButtonRefs.current.set(itemId, button); else reactionButtonRefs.current.delete(itemId); }} onPress={() => openReactionPicker(replyId, itemId)} disabled={disabled} style={[styles.iconActionChip, { borderColor: colors.border }]} testID={`discussion-reaction-picker-open-${itemId}`} accessibilityRole="button" accessibilityLabel="Add reaction" accessibilityState={{ expanded: reactionPickerState?.itemId === itemId, disabled }}>
                <Ionicons name="happy-outline" size={threadType.icon} color={colors.textSecondary} />
            </TouchableOpacity>
            {canViewDiscussion && replyId ? (
                <TouchableOpacity onPress={() => setReportMenuState({ replyId, itemId })} disabled={disabled} style={[styles.iconActionChip, { borderColor: colors.border }]} testID={replyId ? `discussion-reply-report-open-${itemId}` : `discussion-topic-report-open-${topicId}`} accessibilityRole="button" accessibilityLabel="Report this content">
                    <Ionicons name="ellipsis-horizontal" size={threadType.icon} color={colors.textSecondary} />
                </TouchableOpacity>
            ) : null}
            {reactions ? renderReactionSummaryRow(reactions, itemId, replyId) : null}
        </View>
    );

    const renderReplyNode = (node: ReplyTreeNode, activeReplyTargetId: string | null) => {
        const isReplyTarget = activeReplyTargetId === node.id;
        const showBranchLine = Math.min(node.depth, MAX_VISIBLE_REPLY_DEPTH) > 0;
        const interactionDisabled = reactionMutation.isPending || voteMutation.isPending || removeVoteMutation.isPending || isPostingReply;

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
                    <View style={[styles.replyCard, isReplyTarget ? { borderLeftColor: colors.accent, borderLeftWidth: 2, paddingLeft: 10 } : null]}>
                        <View style={styles.replyIdentity}>
                            <AuthorAvatar avatarUrl={node.authorProfile?.avatar_url} name={getAuthorLabel(node.authorProfile)} size={30} />
                            <View style={styles.replyIdentityBody}>
                                <Text style={[styles.replyMeta, { color: colors.textPrimary }]}>
                                    <Text style={styles.replyAuthor}>{getAuthorLabel(node.authorProfile)}</Text>
                                    <Text style={{ color: colors.textTertiary }}>{` · ${formatTimestamp(node.created_at)}`}</Text>
                                </Text>
                                {node.parent ? <Text style={[styles.replyContext, { color: colors.textSecondary }]}>{`Replying to ${getAuthorLabel(node.parent.authorProfile)}`}</Text> : null}
                            </View>
                        </View>
                        <Text style={[styles.replyBody, { color: colors.textPrimary }]}>{getReplyBody(node)}</Text>
                        {canParticipate && !topic?.is_deleted && !node.is_deleted ? renderActionRow({
                            itemId: node.id,
                            replyId: node.id,
                            upvoteCount: node.upvoteCount,
                            downvoteCount: node.downvoteCount,
                            viewerVote: node.viewerVote,
                            onReply: () => openReplyComposer(node.id),
                            disabled: interactionDisabled,
                            reactions: node.reactions,
                        }) : null}
                        {!node.is_deleted && !(canParticipate && !topic?.is_deleted) ? renderReactionSummaryRow(node.reactions, node.id, node.id) : null}
                        {isReplyTarget ? renderReplyComposer() : null}
                    </View>
                </View>
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
    const interactionDisabled = reactionMutation.isPending || voteMutation.isPending || removeVoteMutation.isPending || isPostingReply;

    return (
        <>
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}/discussion`)} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Back to discussion">
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.clubContext, { color: colors.textSecondary }]} numberOfLines={1} testID="discussion-club-context">{(club?.name || 'Club discussion').toUpperCase()}</Text>
                </View>

                <View style={[styles.topicCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID={`discussion-topic-${topic.id}`}>
                    <View style={styles.topicTitleRow}>
                        <Text style={[styles.topicTitle, { color: colors.textPrimary }]}>{topic.title}</Text>
                        {canViewDiscussion ? (
                            <TouchableOpacity onPress={() => setReportMenuState({ replyId: null, itemId: topic.id })} style={[styles.topicOverflowButton, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Thread options" testID={`discussion-topic-report-open-${topic.id}`}>
                                <Ionicons name="ellipsis-horizontal" size={threadType.icon} color={colors.textSecondary} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    <View style={styles.topicAuthorRow}>
                        <AuthorAvatar avatarUrl={topic.authorProfile?.avatar_url} name={getAuthorLabel(topic.authorProfile)} size={30} />
                        <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>
                            <Text style={styles.topicAuthor}>{getAuthorLabel(topic.authorProfile)}</Text>
                            <Text style={{ color: colors.textTertiary }}>{` · ${formatTimestamp(topic.created_at)}`}</Text>
                        </Text>
                    </View>
                    <Text style={[styles.topicBody, { color: colors.textPrimary }]}>{getTopicBody(topic)}</Text>
                    {!topic.is_deleted && !canParticipate ? renderReactionSummaryRow(topic.reactions, topic.id) : null}
                    {canParticipate && !topic.is_deleted ? renderActionRow({
                        itemId: topic.id,
                        replyId: null,
                        upvoteCount: topic.upvoteCount,
                        downvoteCount: topic.downvoteCount,
                        score: topic.voteCount,
                        viewerVote: topic.viewerVote,
                        onReply: () => openReplyComposer(null),
                        disabled: interactionDisabled,
                        reactions: topic.reactions,
                    }) : null}
                    {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? colors.feedbackSuccess : colors.bgSecondary, borderColor: feedback.type === 'success' ? colors.feedbackSuccessBorder : colors.border }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? colors.feedbackSuccessText : colors.accent }]}>{feedback.message}</Text></View> : null}
                    {replyComposerState && (!replyComposerState.replyId || !activeReplyTarget) ? renderReplyComposer() : null}
                </View>

                <View style={styles.repliesSection}>
                    <View style={styles.repliesHeadingRow} testID="discussion-replies-header">
                        <View style={styles.repliesTitleGroup}>
                            <Text style={[styles.repliesTitle, { color: colors.textPrimary }]}>Replies</Text>
                            <Text style={[styles.repliesCount, { color: colors.textTertiary }]} testID="discussion-replies-count">{topic.replyCount}</Text>
                        </View>
                        <View style={styles.repliesHeadingActions}>
                            {topic.hasUnread ? <View style={[styles.unreadBadge, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.unreadBadgeText, { color: colors.accent }]}>{`${topic.unreadReplyCount} unread`}</Text></View> : null}
                            {topic.hasUnread ? <TouchableOpacity onPress={handleMarkRead} disabled={markReadMutation.isPending} style={[styles.markReadButton, { opacity: markReadMutation.isPending ? 0.65 : 1 }]} testID={`discussion-topic-mark-read-${topic.id}`} accessibilityRole="button"><Text style={[styles.markReadText, { color: colors.accent }]}>{markReadMutation.isPending ? 'Marking…' : 'Mark topic as read'}</Text></TouchableOpacity> : null}
                        </View>
                    </View>
                    {replyTree.length === 0 ? <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>No replies yet. Start the conversation with a reply.</Text> : <View style={styles.replyList}>{replyTree.map((node) => (
                        <View key={node.id} style={[styles.conversationBranch, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            {flattenReplyTree(node).map((reply) => renderReplyNode(reply, replyComposerState?.replyId ?? null))}
                        </View>
                    ))}</View>}
                </View>
            </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={!!reactionPickerState} transparent animationType="fade" onShow={() => firstReactionRef.current?.focus?.()} onRequestClose={closeReactionPicker}>
                <Pressable style={styles.reactionPopoverOverlay} onPress={closeReactionPicker} testID="discussion-reaction-picker-overlay">
                    <Pressable onPress={(event) => event.stopPropagation()} style={[styles.reactionPopover, { width: pickerWidth, maxHeight: pickerHeight, left: pickerLeft, top: pickerTop, backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="discussion-reaction-picker" accessibilityViewIsModal>
                        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.reactionPopoverContent}>
                            <Text style={[styles.reactionPopoverTitle, { color: colors.textSecondary }]}>{reactionPickerState?.replyId ? 'React to this reply' : 'React to this topic'}</Text>
                            <View style={styles.reactionPickerGrid}>
                                {REACTION_OPTIONS.map((emoji, index) => (
                                    <TouchableOpacity ref={index === 0 ? button => { firstReactionRef.current = button; } : undefined} key={emoji} onPress={() => handleReaction(emoji)} disabled={reactionMutation.isPending} accessibilityRole="button" accessibilityLabel={`React with ${emoji}`} accessibilityState={{ disabled: reactionMutation.isPending }} style={[styles.reactionPickerOption, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]} testID={`discussion-reaction-option-${reactionPickerState?.itemId ?? 'none'}-${emoji}`}>
                                        <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={!!reportMenuState} transparent animationType="fade" onRequestClose={() => setReportMenuState(null)}>
                <Pressable style={styles.sheetOverlay} onPress={() => setReportMenuState(null)} testID="discussion-report-menu-overlay">
                    <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheetPressable}>
                        <View style={[styles.sheet, styles.reactionPickerSheet, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="discussion-report-menu">
                            <View style={styles.sheetHandleWrap}><View style={[styles.sheetHandle, { backgroundColor: colors.border }]} /></View>
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Report this content</Text>
                            {REPORT_REASONS.map(({ reason, label }) => (
                                <TouchableOpacity
                                    key={reason}
                                    onPress={() => handleReport(reason)}
                                    disabled={reportMutation.isPending}
                                    style={[styles.reportReasonOption, { borderColor: colors.border, opacity: reportMutation.isPending ? 0.6 : 1 }]}
                                    testID={`discussion-report-reason-${reason}`}
                                >
                                    <Text style={[styles.reportReasonLabel, { color: colors.textPrimary }]}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity onPress={() => setReportMenuState(null)} testID="discussion-report-cancel">
                                <Text style={[styles.sheetCancel, { color: colors.accent }]}>Cancel</Text>
                            </TouchableOpacity>
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
    contentContainer: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorContainer: { padding: 24, justifyContent: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    clubContext: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16, letterSpacing: 0.8 },
    sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22 },
    sectionBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    topicCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8, gap: 4 },
    topicTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topicOverflowButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    topicAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#F8EBE7' },
    avatarInitials: { color: '#8B322C', fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 15 },
    topicMeta: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
    topicAuthor: { fontFamily: 'Inter_600SemiBold', color: '#1A1412' },
    topicTitle: { flex: 1, fontFamily: 'Newsreader_600SemiBold', fontSize: 24, lineHeight: 30, letterSpacing: -0.25 },
    topicBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    unreadBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
    unreadBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 15 },
    feedbackBanner: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
    feedbackText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
    repliesSection: { paddingBottom: 8 },
    repliesHeadingRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 6, flexWrap: 'wrap' },
    repliesTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    repliesTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, lineHeight: 28 },
    repliesCount: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
    repliesHeadingActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' },
    markReadButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
    markReadText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16 },
    replyList: { gap: 8 },
    conversationBranch: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
    replyTreeNode: { gap: 0 },
    replyTreeNodeNested: { borderLeftWidth: 1, paddingLeft: 6 },
    replyBranchRow: { flexDirection: 'row', alignItems: 'stretch', gap: 4 },
    replyBranchMarker: { width: 8, height: 1, marginTop: 20, borderRadius: 999 },
    replyCard: { flex: 1, minWidth: 0, paddingVertical: 8, gap: 4 },
    replyIdentity: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    replyIdentityBody: { flex: 1, gap: 2 },
    replyMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
    replyAuthor: { fontFamily: 'Inter_600SemiBold', color: '#1A1412' },
    replyContext: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
    replyBody: { fontFamily: 'Inter_400Regular', fontSize: threadType.body, lineHeight: threadType.bodyLine },
    actionStrip: { flexDirection: 'row', alignItems: 'center', gap: 2, flexWrap: 'wrap', marginTop: 0 },
    actionChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12 },
    replyActionPrimary: { minWidth: 88 },
    replyActionQuiet: { minWidth: 64, borderWidth: 0, paddingHorizontal: 4 },
    actionChipLabel: { fontFamily: 'Inter_500Medium', fontSize: threadType.action, lineHeight: threadType.actionLine },
    voteGroup: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, paddingHorizontal: 0 },
    voteButton: { minWidth: 44, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 5 },
    voteSurface: { minWidth: 30, minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 4 },
    topicScore: { minWidth: 18, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: threadType.action, lineHeight: threadType.actionLine },
    iconActionChip: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 0, borderRadius: 999, paddingHorizontal: 9 },
    iconActionCount: { fontFamily: 'Inter_500Medium', fontSize: threadType.action, lineHeight: threadType.actionLine },
    reactionSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    reactionSummaryChip: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    reactionSummarySurface: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    reactionSummaryEmoji: { fontSize: 12, lineHeight: 16 },
    reactionSummaryCount: { fontFamily: 'Inter_500Medium', fontSize: threadType.action, lineHeight: threadType.actionLine },
    reportReasonOption: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8 },
    reportReasonLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
    secondaryActionButton: { minHeight: 44, marginTop: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 12 },
    secondaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(26, 20, 18, 0.38)', justifyContent: 'flex-end' },
    sheetPressable: { justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 12 },
    sheetHandleWrap: { alignItems: 'center', paddingBottom: 4 },
    sheetHandle: { width: 48, height: 5, borderRadius: 999 },
    sheetTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 21, lineHeight: 27 },
    sheetCancel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 20 },
    reactionPickerSheet: { paddingBottom: 20 },
    reactionPopoverOverlay: { flex: 1, backgroundColor: 'rgba(26, 20, 18, 0.08)' },
    reactionPopover: { position: 'absolute', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
    reactionPopoverContent: { padding: 12, gap: 8 },
    reactionPopoverTitle: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
    reactionPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    reactionPickerOption: { width: 44, height: 44, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    reactionPickerEmoji: { fontSize: 18, lineHeight: 24 },
    reactionUsersSheet: { maxHeight: '60%' },
    reactionUsersList: { gap: 8 },
    reactionUserRow: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    reactionUserName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    reactionUserHandle: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
});
