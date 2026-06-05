import { profileService } from '@/features/auth/services/profileService';
import { supabase } from '@/lib/supabase';
import { getClubsEntitlementErrorMessage } from './clubsEntitlement';
import { normalizeOptionalText } from './clubsService.shared';
import type {
    ClubDiscussionReaction,
    ClubDiscussionReactionSummary,
    ClubDiscussionReactionUserSummary,
    ClubDiscussionReply,
    ClubDiscussionReplyWithDetails,
    ClubDiscussionReport,
    ClubDiscussionReportWithTarget,
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
const CLUB_DISCUSSION_REPORT_SELECT = 'id, topic_id, reply_id, reporter_user_id, reason, details, status, created_at, resolved_at, resolved_by';
const CLUB_DISCUSSION_REPORT_QUEUE_SELECT = `
    id,
    topic_id,
    reply_id,
    reporter_user_id,
    reason,
    details,
    status,
    created_at,
    resolved_at,
    resolved_by,
    topic:club_discussion_topics!topic_id(id, club_id, title, body, author_user_id, is_deleted),
    reply:club_discussion_replies!reply_id(
        id,
        topic_id,
        body,
        author_user_id,
        is_deleted,
        topic:club_discussion_topics!topic_id(id, club_id, title)
    )
`;

function requireNonEmptyText(value: string, fieldLabel: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new Error(`${fieldLabel} is required.`);
    return trimmed;
}

function getVoteSnapshot(votes: ClubDiscussionVote[], userId?: string | null) {
    const upvoteCount = votes.filter((vote) => vote.vote_type === 'upvote').length;
    const downvoteCount = votes.filter((vote) => vote.vote_type === 'downvote').length;
    return {
        voteCount: upvoteCount - downvoteCount,
        upvoteCount,
        downvoteCount,
        viewerVote: userId ? votes.find((vote) => vote.user_id === userId)?.vote_type ?? null : null,
    };
}

function getReactionSummary(
    reactions: ClubDiscussionReaction[],
    profileMap: Map<string, Awaited<ReturnType<typeof profileService.getProfileSummaries>>[number]>,
    userId?: string | null,
): ClubDiscussionReactionSummary[] {
    const counts = new Map<string, { count: number; viewerReacted: boolean; users: ClubDiscussionReactionUserSummary[] }>();
    reactions.forEach((reaction) => {
        const current = counts.get(reaction.emoji) ?? { count: 0, viewerReacted: false, users: [] };
        const profile = profileMap.get(reaction.user_id);
        const displayName = profile?.display_name || profile?.username || 'A club member';
        const nextUsers = current.users.some((user) => user.userId === reaction.user_id)
            ? current.users
            : [...current.users, { userId: reaction.user_id, displayName, username: profile?.username ?? null }];
        counts.set(reaction.emoji, {
            count: current.count + 1,
            viewerReacted: current.viewerReacted || reaction.user_id === userId,
            users: nextUsers,
        });
    });
    return Array.from(counts.entries()).map(([emoji, value]) => {
        const summary = {
            emoji,
            count: value.count,
            viewerReacted: value.viewerReacted,
        } as ClubDiscussionReactionSummary;
        Object.defineProperty(summary, 'users', {
            value: value.users,
            enumerable: false,
            writable: false,
        });
        return summary;
    });
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
        ...reactions.map((reaction) => reaction.user_id),
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
                const replyVoteSnapshot = getVoteSnapshot(replyVotes, userId);
                return {
                    ...reply,
                    authorProfile: reply.author_user_id ? profileMap.get(reply.author_user_id) ?? null : null,
                    depth: replyDepths.get(reply.id) ?? 0,
                    voteCount: reply.is_deleted ? 0 : replyVoteSnapshot.voteCount,
                    upvoteCount: reply.is_deleted ? 0 : replyVoteSnapshot.upvoteCount,
                    downvoteCount: reply.is_deleted ? 0 : replyVoteSnapshot.downvoteCount,
                    viewerVote: reply.is_deleted ? null : replyVoteSnapshot.viewerVote,
                    reactions: reply.is_deleted ? [] : getReactionSummary(replyReactions, profileMap, userId),
                };
            });
            const recentActivityAt = topic.last_replied_at ?? mappedReplies[mappedReplies.length - 1]?.created_at ?? topic.updated_at ?? topic.created_at;
            const topicVoteSnapshot = getVoteSnapshot(topicVotes, userId);
            return {
                ...topic,
                authorProfile: topic.author_user_id ? profileMap.get(topic.author_user_id) ?? null : null,
                replies: mappedReplies,
                replyCount: mappedReplies.length,
                voteCount: topic.is_deleted ? 0 : topicVoteSnapshot.voteCount,
                upvoteCount: topic.is_deleted ? 0 : topicVoteSnapshot.upvoteCount,
                downvoteCount: topic.is_deleted ? 0 : topicVoteSnapshot.downvoteCount,
                viewerVote: topic.is_deleted ? null : topicVoteSnapshot.viewerVote,
                reactions: topic.is_deleted ? [] : getReactionSummary(topicReactions, profileMap, userId),
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
    const repliesResult = await supabase
        .from('club_discussion_replies')
        .select(CLUB_DISCUSSION_REPLY_SELECT)
        .in('topic_id', topicIds)
        .order('created_at', { ascending: true });

    if (repliesResult.error) throw repliesResult.error;

    const replyRows = (repliesResult.data ?? []) as ClubDiscussionReply[];
    const replyIds = replyRows.map((reply) => reply.id);
    const topicOrReplyFilter = replyIds.length > 0
        ? `topic_id.in.(${topicIds.join(',')}),reply_id.in.(${replyIds.join(',')})`
        : `topic_id.in.(${topicIds.join(',')})`;

    const [votesResult, reactionsResult, readsResult] = await Promise.all([
        supabase.from('club_discussion_votes').select(CLUB_DISCUSSION_VOTE_SELECT).or(topicOrReplyFilter),
        supabase.from('club_discussion_reactions').select(CLUB_DISCUSSION_REACTION_SELECT).or(topicOrReplyFilter),
        userId
            ? supabase.from('club_discussion_topic_reads').select(CLUB_DISCUSSION_READ_SELECT).eq('user_id', userId).in('topic_id', topicIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (votesResult.error) throw votesResult.error;
    if (reactionsResult.error) throw reactionsResult.error;
    if (readsResult.error) throw readsResult.error;

    return mapDiscussionTopics({
        topics: topicRows,
        replies: replyRows,
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

    const repliesResult = await supabase
        .from('club_discussion_replies')
        .select(CLUB_DISCUSSION_REPLY_SELECT)
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true });

    if (repliesResult.error) throw repliesResult.error;

    const replyRows = (repliesResult.data ?? []) as ClubDiscussionReply[];
    const replyIds = replyRows.map((reply) => reply.id);
    const topicOrReplyFilter = replyIds.length > 0
        ? `topic_id.in.(${topicId}),reply_id.in.(${replyIds.join(',')})`
        : `topic_id.in.(${topicId})`;

    const [votesResult, reactionsResult, readsResult] = await Promise.all([
        supabase.from('club_discussion_votes').select(CLUB_DISCUSSION_VOTE_SELECT).or(topicOrReplyFilter),
        supabase.from('club_discussion_reactions').select(CLUB_DISCUSSION_REACTION_SELECT).or(topicOrReplyFilter),
        userId
            ? supabase.from('club_discussion_topic_reads').select(CLUB_DISCUSSION_READ_SELECT).eq('user_id', userId).eq('topic_id', topicId)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (votesResult.error) throw votesResult.error;
    if (reactionsResult.error) throw reactionsResult.error;
    if (readsResult.error) throw readsResult.error;

    const [mappedTopic] = await mapDiscussionTopics({
        topics: [topic as ClubDiscussionTopic],
        replies: replyRows,
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
        .select(CLUB_DISCUSSION_TOPIC_SELECT)
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
        .select(CLUB_DISCUSSION_REPLY_SELECT)
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
        .select(CLUB_DISCUSSION_VOTE_SELECT)
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
        .select(CLUB_DISCUSSION_REACTION_SELECT)
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
        .select(CLUB_DISCUSSION_REPORT_SELECT)
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to report this discussion content right now.'));
    return data as ClubDiscussionReport;
}

export async function markClubDiscussionTopicRead(topicId: string, userId?: string | null): Promise<ClubDiscussionTopicReadState> {
    const viewerUserId = userId ?? await getCurrentUserId();
    const { data, error } = await supabase
        .from('club_discussion_topic_reads')
        .upsert({ topic_id: topicId, user_id: viewerUserId, last_read_at: new Date().toISOString(), unread_reply_count: 0 }, { onConflict: 'topic_id,user_id' })
        .select(CLUB_DISCUSSION_READ_SELECT)
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to update the unread state for this topic right now.'));
    return data as ClubDiscussionTopicReadState;
}

export async function getClubDiscussionReports(clubId: string, status: 'open' | 'resolved' = 'open'): Promise<ClubDiscussionReportWithTarget[]> {
    const { data, error } = await supabase
        .from('club_discussion_reports')
        .select(CLUB_DISCUSSION_REPORT_QUEUE_SELECT)
        .eq('status', status)
        .order('created_at', { ascending: false });

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to load discussion reports right now.'));

    const rows = ((data ?? []) as unknown as ClubDiscussionReportWithTarget[])
        .filter((report) => {
            const targetClubId = report.topic?.club_id ?? report.reply?.topic?.club_id ?? null;
            return targetClubId === clubId;
        });
    const reporterIds = rows.map((report) => report.reporter_user_id).filter(Boolean);
    const profiles = reporterIds.length > 0 ? await profileService.getProfileSummaries(reporterIds) : [];
    const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));

    return rows.map((report) => ({
        ...report,
        reporterProfile: profileByUserId.get(report.reporter_user_id) ?? null,
    }));
}

export async function resolveClubDiscussionReport(reportId: string): Promise<ClubDiscussionReport> {
    const { data, error } = await supabase
        .from('club_discussion_reports')
        .update({ status: 'resolved' })
        .eq('id', reportId)
        .select(CLUB_DISCUSSION_REPORT_SELECT)
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to resolve this discussion report right now.'));
    return data as ClubDiscussionReport;
}
