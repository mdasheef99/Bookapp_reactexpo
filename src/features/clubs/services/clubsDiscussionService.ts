import { profileService } from '@/features/auth/services/profileService';
import { supabase } from '@/lib/supabase';
import { getClubsEntitlementErrorMessage } from './clubsEntitlement';
import { normalizeOptionalText } from './clubsService.shared';
import type {
    ClubDiscussionReaction,
    ClubDiscussionReactionSummary,
    ClubDiscussionReply,
    ClubDiscussionReplyWithDetails,
    ClubDiscussionReport,
    ClubDiscussionTopic,
    ClubDiscussionTopicReadState,
    ClubDiscussionTopicWithDetails,
    ClubDiscussionVote,
    ClubDiscussionVoteType,
    CreateClubDiscussionReplyInput,
    CreateClubDiscussionReportInput,
    CreateClubDiscussionTopicInput,
    SetClubDiscussionReactionInput,
    SetClubDiscussionVoteInput,
} from './clubsService.types';

const CLUB_DISCUSSION_TOPIC_SELECT = 'id, club_id, author_user_id, title, body, is_deleted, is_edited, created_at, updated_at, deleted_at, last_replied_at';
const CLUB_DISCUSSION_REPLY_SELECT = 'id, topic_id, parent_reply_id, author_user_id, body, is_deleted, created_at, deleted_at';
const CLUB_DISCUSSION_VOTE_SELECT = 'id, topic_id, reply_id, user_id, vote_type, created_at';
const CLUB_DISCUSSION_REACTION_SELECT = 'id, topic_id, reply_id, user_id, emoji, created_at';
const CLUB_DISCUSSION_READ_SELECT = 'topic_id, user_id, last_read_at, unread_reply_count';

function requireNonEmptyText(value: string, fieldLabel: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new Error(`${fieldLabel} is required.`);
    return trimmed;
}

function getVoteSnapshot(votes: ClubDiscussionVote[], userId?: string | null) {
    return {
        voteCount: votes.reduce((sum, vote) => sum + (vote.vote_type === 'upvote' ? 1 : -1), 0),
        viewerVote: userId ? votes.find((vote) => vote.user_id === userId)?.vote_type ?? null : null,
    };
}

function getReactionSummary(reactions: ClubDiscussionReaction[], userId?: string | null): ClubDiscussionReactionSummary[] {
    const counts = new Map<string, { count: number; viewerReacted: boolean }>();
    reactions.forEach((reaction) => {
        const current = counts.get(reaction.emoji) ?? { count: 0, viewerReacted: false };
        counts.set(reaction.emoji, { count: current.count + 1, viewerReacted: current.viewerReacted || reaction.user_id === userId });
    });
    return Array.from(counts.entries()).map(([emoji, value]) => ({ emoji, count: value.count, viewerReacted: value.viewerReacted }));
}

function getReplyDepths(replies: ClubDiscussionReply[]) {
    const replyMap = new Map(replies.map((reply) => [reply.id, reply]));
    const depthCache = new Map<string, number>();
    const resolveDepth = (reply: ClubDiscussionReply): number => {
        if (!reply.parent_reply_id) return 0;
        if (depthCache.has(reply.id)) return depthCache.get(reply.id) ?? 0;
        const parent = replyMap.get(reply.parent_reply_id);
        if (!parent) return 0;
        const depth = Math.min(resolveDepth(parent) + 1, 4);
        depthCache.set(reply.id, depth);
        return depth;
    };
    replies.forEach((reply) => {
        if (!depthCache.has(reply.id)) depthCache.set(reply.id, resolveDepth(reply));
    });
    return depthCache;
}

async function getCurrentUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user?.id) throw new Error('You must be signed in to use club discussion.');
    return data.user.id;
}

async function mapDiscussionTopics(input: {
    topics: ClubDiscussionTopic[];
    replies: ClubDiscussionReply[];
    votes: ClubDiscussionVote[];
    reactions: ClubDiscussionReaction[];
    reads: ClubDiscussionTopicReadState[];
    userId?: string | null;
}) {
    const { topics, replies, votes, reactions, reads, userId } = input;
    const authorIds = Array.from(new Set([
        ...topics.map((topic) => topic.author_user_id),
        ...replies.map((reply) => reply.author_user_id),
    ].filter((value): value is string => Boolean(value))));
    const profiles = authorIds.length > 0 ? await profileService.getProfileSummaries(authorIds) : [];
    const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
    const repliesByTopic = new Map<string, ClubDiscussionReply[]>();

    replies.forEach((reply) => {
        if (!reply.topic_id) return;
        const current = repliesByTopic.get(reply.topic_id) ?? [];
        current.push(reply);
        repliesByTopic.set(reply.topic_id, current);
    });

    return [...topics]
        .map((topic) => {
            const topicReplies = [...(repliesByTopic.get(topic.id) ?? [])].sort((left, right) => {
                const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
                const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
                return leftTime - rightTime;
            });
            const replyDepths = getReplyDepths(topicReplies);
            const topicVotes = votes.filter((vote) => vote.topic_id === topic.id);
            const topicReactions = reactions.filter((reaction) => reaction.topic_id === topic.id);
            const readState = reads.find((read) => read.topic_id === topic.id && (!userId || read.user_id === userId));
            const mappedReplies: ClubDiscussionReplyWithDetails[] = topicReplies.map((reply) => {
                const replyVotes = votes.filter((vote) => vote.reply_id === reply.id);
                const replyReactions = reactions.filter((reaction) => reaction.reply_id === reply.id);
                return {
                    ...reply,
                    authorProfile: reply.author_user_id ? profileMap.get(reply.author_user_id) ?? null : null,
                    depth: replyDepths.get(reply.id) ?? 0,
                    voteCount: reply.is_deleted ? 0 : getVoteSnapshot(replyVotes, userId).voteCount,
                    viewerVote: reply.is_deleted ? null : getVoteSnapshot(replyVotes, userId).viewerVote,
                    reactions: reply.is_deleted ? [] : getReactionSummary(replyReactions, userId),
                };
            });
            const recentActivityAt = topic.last_replied_at ?? mappedReplies[mappedReplies.length - 1]?.created_at ?? topic.updated_at ?? topic.created_at;
            return {
                ...topic,
                authorProfile: topic.author_user_id ? profileMap.get(topic.author_user_id) ?? null : null,
                replies: mappedReplies,
                replyCount: mappedReplies.length,
                voteCount: topic.is_deleted ? 0 : getVoteSnapshot(topicVotes, userId).voteCount,
                viewerVote: topic.is_deleted ? null : getVoteSnapshot(topicVotes, userId).viewerVote,
                reactions: topic.is_deleted ? [] : getReactionSummary(topicReactions, userId),
                unreadReplyCount: readState?.unread_reply_count ?? 0,
                hasUnread: (readState?.unread_reply_count ?? 0) > 0,
                recentActivityAt,
            } satisfies ClubDiscussionTopicWithDetails;
        })
        .sort((left, right) => {
            const rightTime = right.recentActivityAt ? Date.parse(right.recentActivityAt) : 0;
            const leftTime = left.recentActivityAt ? Date.parse(left.recentActivityAt) : 0;
            return rightTime - leftTime;
        });
}

export async function getClubDiscussionTopics(clubId: string, userId?: string | null): Promise<ClubDiscussionTopicWithDetails[]> {
    const { data: topics, error: topicsError } = await supabase
        .from('club_discussion_topics')
        .select(CLUB_DISCUSSION_TOPIC_SELECT)
        .eq('club_id', clubId)
        .order('last_replied_at', { ascending: false })
        .order('created_at', { ascending: false });

    if (topicsError) throw topicsError;
    const topicRows = (topics ?? []) as ClubDiscussionTopic[];
    if (topicRows.length === 0) return [];

    const topicIds = topicRows.map((topic) => topic.id);
    const [repliesResult, votesResult, reactionsResult, readsResult] = await Promise.all([
        supabase.from('club_discussion_replies').select(CLUB_DISCUSSION_REPLY_SELECT).in('topic_id', topicIds).order('created_at', { ascending: true }),
        supabase.from('club_discussion_votes').select(CLUB_DISCUSSION_VOTE_SELECT).in('topic_id', topicIds),
        supabase.from('club_discussion_reactions').select(CLUB_DISCUSSION_REACTION_SELECT).in('topic_id', topicIds),
        userId
            ? supabase.from('club_discussion_topic_reads').select(CLUB_DISCUSSION_READ_SELECT).eq('user_id', userId).in('topic_id', topicIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (repliesResult.error) throw repliesResult.error;
    if (votesResult.error) throw votesResult.error;
    if (reactionsResult.error) throw reactionsResult.error;
    if (readsResult.error) throw readsResult.error;

    return mapDiscussionTopics({
        topics: topicRows,
        replies: (repliesResult.data ?? []) as ClubDiscussionReply[],
        votes: (votesResult.data ?? []) as ClubDiscussionVote[],
        reactions: (reactionsResult.data ?? []) as ClubDiscussionReaction[],
        reads: (readsResult.data ?? []) as ClubDiscussionTopicReadState[],
        userId,
    });
}

export async function getClubDiscussionTopic(topicId: string, userId?: string | null): Promise<ClubDiscussionTopicWithDetails> {
    const { data: topic, error: topicError } = await supabase
        .from('club_discussion_topics')
        .select(CLUB_DISCUSSION_TOPIC_SELECT)
        .eq('id', topicId)
        .single();

    if (topicError) throw topicError;

    const [repliesResult, votesResult, reactionsResult, readsResult] = await Promise.all([
        supabase.from('club_discussion_replies').select(CLUB_DISCUSSION_REPLY_SELECT).eq('topic_id', topicId).order('created_at', { ascending: true }),
        supabase.from('club_discussion_votes').select(CLUB_DISCUSSION_VOTE_SELECT).or(`topic_id.eq.${topicId},reply_id.in.(select id from club_discussion_replies where topic_id = '${topicId}')`),
        supabase.from('club_discussion_reactions').select(CLUB_DISCUSSION_REACTION_SELECT).or(`topic_id.eq.${topicId},reply_id.in.(select id from club_discussion_replies where topic_id = '${topicId}')`),
        userId
            ? supabase.from('club_discussion_topic_reads').select(CLUB_DISCUSSION_READ_SELECT).eq('user_id', userId).eq('topic_id', topicId)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (repliesResult.error) throw repliesResult.error;
    if (votesResult.error) throw votesResult.error;
    if (reactionsResult.error) throw reactionsResult.error;
    if (readsResult.error) throw readsResult.error;

    const [mappedTopic] = await mapDiscussionTopics({
        topics: [topic as ClubDiscussionTopic],
        replies: (repliesResult.data ?? []) as ClubDiscussionReply[],
        votes: (votesResult.data ?? []) as ClubDiscussionVote[],
        reactions: (reactionsResult.data ?? []) as ClubDiscussionReaction[],
        reads: (readsResult.data ?? []) as ClubDiscussionTopicReadState[],
        userId,
    });

    return mappedTopic;
}

export async function createClubDiscussionTopic(input: CreateClubDiscussionTopicInput): Promise<ClubDiscussionTopic> {
    const authorUserId = await getCurrentUserId();
    const title = requireNonEmptyText(input.title, 'Topic title');
    const body = requireNonEmptyText(input.body, 'Topic body');
    const timestamp = new Date().toISOString();
    const { data, error } = await supabase
        .from('club_discussion_topics')
        .insert({ club_id: input.clubId, author_user_id: authorUserId, title, body, last_replied_at: timestamp })
        .select('*')
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to create this discussion topic right now.'));
    return data as ClubDiscussionTopic;
}

export async function createClubDiscussionReply(input: CreateClubDiscussionReplyInput): Promise<ClubDiscussionReply> {
    const authorUserId = await getCurrentUserId();
    const body = requireNonEmptyText(input.body, 'Reply body');
    const { data, error } = await supabase
        .from('club_discussion_replies')
        .insert({ topic_id: input.topicId, parent_reply_id: input.parentReplyId ?? null, author_user_id: authorUserId, body })
        .select('*')
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to post this reply right now.'));
    return data as ClubDiscussionReply;
}

export async function setClubDiscussionVote(input: SetClubDiscussionVoteInput): Promise<ClubDiscussionVote> {
    const userId = await getCurrentUserId();
    if (!input.topicId && !input.replyId) throw new Error('A discussion topic or reply target is required.');
    const { data, error } = await supabase
        .from('club_discussion_votes')
        .upsert({ topic_id: input.topicId ?? null, reply_id: input.replyId ?? null, user_id: userId, vote_type: input.voteType }, { onConflict: input.topicId ? 'topic_id,user_id' : 'reply_id,user_id' })
        .select('*')
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to update your discussion vote right now.'));
    return data as ClubDiscussionVote;
}

export async function removeClubDiscussionVote(topicId?: string | null, replyId?: string | null): Promise<void> {
    const userId = await getCurrentUserId();
    if (!topicId && !replyId) throw new Error('A discussion topic or reply target is required.');
    let query = supabase.from('club_discussion_votes').delete().eq('user_id', userId);
    query = topicId ? query.eq('topic_id', topicId) : query.eq('reply_id', replyId!);
    const { error } = await query;
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to remove your discussion vote right now.'));
}

export async function setClubDiscussionReaction(input: SetClubDiscussionReactionInput): Promise<ClubDiscussionReaction> {
    const userId = await getCurrentUserId();
    if (!input.topicId && !input.replyId) throw new Error('A discussion topic or reply target is required.');
    const { data, error } = await supabase
        .from('club_discussion_reactions')
        .upsert({ topic_id: input.topicId ?? null, reply_id: input.replyId ?? null, user_id: userId, emoji: input.emoji }, { onConflict: input.topicId ? 'topic_id,user_id,emoji' : 'reply_id,user_id,emoji' })
        .select('*')
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to save this discussion reaction right now.'));
    return data as ClubDiscussionReaction;
}

export async function removeClubDiscussionReaction(emoji: string, topicId?: string | null, replyId?: string | null): Promise<void> {
    const userId = await getCurrentUserId();
    if (!topicId && !replyId) throw new Error('A discussion topic or reply target is required.');
    let query = supabase.from('club_discussion_reactions').delete().eq('user_id', userId).eq('emoji', emoji);
    query = topicId ? query.eq('topic_id', topicId) : query.eq('reply_id', replyId!);
    const { error } = await query;
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to remove this discussion reaction right now.'));
}

export async function reportClubDiscussionContent(input: CreateClubDiscussionReportInput): Promise<ClubDiscussionReport> {
    const reporterUserId = await getCurrentUserId();
    if (!input.topicId && !input.replyId) throw new Error('A discussion topic or reply target is required.');
    const { data, error } = await supabase
        .from('club_discussion_reports')
        .insert({ topic_id: input.topicId ?? null, reply_id: input.replyId ?? null, reporter_user_id: reporterUserId, reason: input.reason, details: normalizeOptionalText(input.details) })
        .select('*')
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to report this discussion content right now.'));
    return data as ClubDiscussionReport;
}

export async function markClubDiscussionTopicRead(topicId: string, userId?: string | null): Promise<ClubDiscussionTopicReadState> {
    const viewerUserId = userId ?? await getCurrentUserId();
    const { data, error } = await supabase
        .from('club_discussion_topic_reads')
        .upsert({ topic_id: topicId, user_id: viewerUserId, last_read_at: new Date().toISOString(), unread_reply_count: 0 }, { onConflict: 'topic_id,user_id' })
        .select('*')
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to update the unread state for this topic right now.'));
    return data as ClubDiscussionTopicReadState;
}