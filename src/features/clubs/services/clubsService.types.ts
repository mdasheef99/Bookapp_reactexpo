import type { UserProfileSummary } from '@/features/auth/services/profileService';
import type { GoogleBook } from '@/features/books/services/booksService';

export type ClubType = 'public' | 'approval' | 'invite_only' | 'author_club';
export type AccessLevel = 'all' | 'pro' | 'pro_plus';
export type MeetingType = 'online_only' | 'venue_based' | 'hybrid';
export type MemberRole = 'member' | 'moderator' | 'admin';
export type MemberStatus = 'active' | 'muted' | 'banned';
export type ClubMemberActionType = 'warned' | 'muted' | 'banned';
export type ClubJoinApplicationStatus = 'pending' | 'approved' | 'declined';
export type MembershipTier = 'free' | 'pro' | 'pro_plus';
export type MembershipLimitAction = 'create_club' | 'check_downgrade';
export type ClubEventFormat = 'virtual' | 'in_person' | 'hybrid';
export type ClubEventStatus = 'scheduled' | 'cancelled';
export type ClubEventRsvpStatus = 'going' | 'maybe' | 'not_going';
export type ClubCurrentBookReadingStatus = 'want_to_read' | 'reading' | 'completed';
export type ClubDiscussionVoteType = 'upvote' | 'downvote';
export type ClubDiscussionReactionEmoji = '👍' | '❤️' | '🔥' | '👏' | '😂';
export type ClubDiscussionReportReason = 'spam' | 'abuse' | 'off_topic' | 'spoiler' | 'other';
export type ClubComplaintReason = 'spam' | 'harassment' | 'spoilers' | 'other';
export type ClubComplaintStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';
export type ClubComplaintResolutionAction = 'warned' | 'muted' | 'banned' | 'no_action';

export interface ClubBookSummary { id: string; title: string; authors: string[] | null; cover_url: string | null; }
export interface ClubCurrentBookStatusOverview {
    current_book_id: string | null;
    member_reading_status: ClubCurrentBookReadingStatus | null;
    to_start_count: number;
    reading_count: number;
    completed_count: number;
    active_member_count: number;
}
export interface ClubPublicDetails {
    id: string;
    name: string;
    description: string | null;
    cover_url: string | null;
    club_type: ClubType;
    access_level: AccessLevel | null;
    meeting_type: MeetingType | null;
    member_count: number | null;
    max_members: number | null;
    current_book_id: string | null;
    current_book_google_books_id: string | null;
    current_book_title: string | null;
    current_book_authors: string[] | null;
    current_book_cover_url: string | null;
    current_book_retail_price: number | null;
    current_book_currency_code: string | null;
    admin_id: string | null;
    admin_profile_id: string | null;
    admin_display_name: string | null;
    admin_avatar_url: string | null;
    admin_city: string | null;
    author_id: string | null;
    author_user_id: string | null;
    author_display_name: string | null;
    author_avatar_url: string | null;
    author_city: string | null;
    created_at: string | null;
    updated_at: string | null;
}
export interface ClubManageDetails extends ClubPublicDetails {
    is_archived: boolean | null;
    archived_at: string | null;
}
export interface Club {
    id: string; name: string; description: string | null; cover_url: string | null; club_type: ClubType;
    access_level: AccessLevel | null; current_book_id: string | null; admin_id: string | null;
    member_count: number | null; max_members: number | null; is_archived: boolean | null;
    created_at: string | null; updated_at: string | null; meeting_type: MeetingType | null;
    archived_at: string | null; author_id: string | null;
}
export interface ClubWithBook extends Club { current_book: ClubBookSummary | null; }
export interface ClubWithDetails extends ClubWithBook { admin: UserProfileSummary | null; }
export interface ClubMember { id: string; club_id: string | null; user_id: string | null; role: MemberRole | null; status: MemberStatus | null; joined_at: string | null; }
export interface ClubMemberWithProfile extends ClubMember { profile: UserProfileSummary | null; }
export interface ClubMemberAction {
    id: string;
    club_id: string | null;
    user_id: string | null;
    action_type: ClubMemberActionType;
    reason: string;
    duration_hours: number | null;
    expires_at: string | null;
    performed_by: string | null;
    created_at: string | null;
}
export interface CreateClubMemberActionInput {
    clubId: string;
    userId: string;
    actionType: ClubMemberActionType;
    reason: string;
    durationHours?: number | null;
}
export interface ClubAdminTransferRequest {
    id: string;
    club_id: string;
    requested_by: string;
    proposed_admin_user_id: string;
    status: 'pending' | 'accepted' | 'cancelled' | 'expired';
    created_at: string;
    responded_at: string | null;
    expires_at: string;
}
export interface ClubJoinQuestion { id: string; club_id: string | null; question: string; is_required: boolean | null; order_index: number; }
export interface ClubJoinQuestionInput { question: string; isRequired?: boolean; orderIndex: number; }
export interface ClubJoinApplication {
    id: string; club_id: string | null; user_id: string | null; status: ClubJoinApplicationStatus | null;
    answers: Record<string, string>; reviewed_by: string | null; reviewed_at: string | null;
    decline_reason: string | null; created_at: string | null;
}
export interface ClubJoinApplicationWithProfile extends ClubJoinApplication { applicantProfile: UserProfileSummary | null; }
export interface ClubFilters {
    clubType?: ClubType;
    meetingType?: MeetingType;
    accessLevel?: AccessLevel;
    search?: string;
    limit?: number;
    offset?: number;
}
export interface CreateClubInput {
    name: string; description?: string; cover_url?: string; club_type: ClubType; access_level?: AccessLevel;
    meeting_type?: MeetingType; admin_id: string; current_book_id?: string; max_members?: number; author_id?: string;
}
export interface UpdateClubInput {
    name?: string; description?: string | null; cover_url?: string | null; current_book_id?: string | null;
    max_members?: number | null; meeting_type?: MeetingType | null; access_level?: AccessLevel | null; club_type?: ClubType;
    is_archived?: boolean; archived_at?: string | null;
}
export interface MembershipLimitResult { allowed: boolean; current_count: number; max_allowed: number; tier: MembershipTier; reason?: string | null; }
export interface JoinClubResult { status: 'joined' | 'applied'; membership?: ClubMember; application?: ClubJoinApplication; }
export type ReviewApplicationDecision = 'approved' | 'declined';
export type ClubInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export interface ClubInvitation { id: string; club_id: string; inviter_user_id: string; invitee_user_id: string; status: ClubInvitationStatus | string; note: string | null; created_at: string; responded_at: string | null; read_at?: string | null; }
export interface ClubInvitationWithProfiles extends ClubInvitation { inviterProfile: UserProfileSummary | null; inviteeProfile: UserProfileSummary | null; }
export interface ClubInvitationInboxItem extends ClubInvitationWithProfiles { club: ClubPublicDetails | null; }
export interface ClubInvitationInboxOptions { limit?: number; offset?: number; }

export interface ClubVenueSummary {
    id: string;
    name: string;
    venue_type: string | null;
    city: string | null;
    address_line1: string | null;
    address_line2: string | null;
    verification_status: string | null;
}
export interface ClubVenueLink {
    club_id: string | null;
    venue_id: string | null;
    is_primary: boolean | null;
    venue: ClubVenueSummary | null;
}
export interface ClubEventRsvp {
    event_id: string;
    user_id: string;
    status: ClubEventRsvpStatus;
    created_at: string | null;
}
export interface ClubEvent {
    id: string;
    club_id: string | null;
    title: string;
    description: string | null;
    event_type: ClubEventFormat;
    start_time: string;
    end_time: string | null;
    venue_id: string | null;
    manual_location: string | null;
    meeting_link: string | null;
    max_attendees: number | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
    status: ClubEventStatus;
    cancelled_at: string | null;
    cancelled_by: string | null;
}
export interface ClubEventWithDetails extends ClubEvent {
    venue: ClubVenueSummary | null;
    creatorProfile: UserProfileSummary | null;
    currentUserRsvp: ClubEventRsvp | null;
}
export interface ClubEventInput {
    title: string;
    description?: string | null;
    eventType: ClubEventFormat;
    startTime: string;
    endTime?: string | null;
    venueId?: string | null;
    manualLocation?: string | null;
    meetingLink?: string | null;
    maxAttendees?: number | null;
}
export interface CreateClubEventInput extends ClubEventInput { clubId: string; }
export interface UpdateClubEventInput extends ClubEventInput {}

export interface ClubReadingScheduleMilestone {
    id: string;
    label: string;
    target: string;
    dueDate: string | null;
}
export interface ClubMemberReadingProgress {
    id: string;
    schedule_id: string | null;
    user_id: string | null;
    chapters_completed: number | null;
    last_updated: string | null;
}
export interface ClubReadingSchedule {
    id: string;
    club_id: string | null;
    book_id: string | null;
    milestones: ClubReadingScheduleMilestone[];
    created_by: string | null;
    created_at: string | null;
    currentUserProgress: ClubMemberReadingProgress | null;
}
export interface UpsertClubReadingScheduleInput {
    clubId: string;
    bookId: string;
    milestones: ClubReadingScheduleMilestone[];
    createdBy?: string | null;
}

export interface ClubDiscussionTopic {
    id: string;
    club_id: string | null;
    author_user_id: string | null;
    title: string;
    body: string | null;
    is_deleted: boolean | null;
    is_edited: boolean | null;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    last_replied_at: string | null;
}
export interface ClubDiscussionReply {
    id: string;
    topic_id: string | null;
    parent_reply_id: string | null;
    author_user_id: string | null;
    body: string | null;
    is_deleted: boolean | null;
    created_at: string | null;
    deleted_at: string | null;
}
export interface ClubDiscussionVote {
    id: string;
    topic_id: string | null;
    reply_id: string | null;
    user_id: string;
    vote_type: ClubDiscussionVoteType;
    created_at: string | null;
}
export interface ClubDiscussionReaction {
    id: string;
    topic_id: string | null;
    reply_id: string | null;
    user_id: string;
    emoji: ClubDiscussionReactionEmoji | string;
    created_at: string | null;
}
export interface ClubDiscussionReactionUserSummary {
    userId: string;
    displayName: string;
    username: string | null;
}
export interface ClubDiscussionReactionSummary {
    emoji: ClubDiscussionReactionEmoji | string;
    count: number;
    viewerReacted: boolean;
    users: ClubDiscussionReactionUserSummary[];
}
export interface ClubDiscussionReport {
    id: string;
    topic_id: string | null;
    reply_id: string | null;
    reporter_user_id: string;
    reason: ClubDiscussionReportReason | string;
    details: string | null;
    status: 'open' | 'resolved';
    created_at: string | null;
    resolved_at: string | null;
    resolved_by: string | null;
}
export interface ClubDiscussionReportWithTarget extends ClubDiscussionReport {
    topic: Pick<ClubDiscussionTopic, 'id' | 'club_id' | 'title' | 'body' | 'author_user_id' | 'is_deleted'> | null;
    reply: (Pick<ClubDiscussionReply, 'id' | 'topic_id' | 'body' | 'author_user_id' | 'is_deleted'> & {
        topic?: Pick<ClubDiscussionTopic, 'id' | 'club_id' | 'title'> | null;
    }) | null;
    reporterProfile: UserProfileSummary | null;
}
export interface ClubComplaint {
    id: string;
    club_id: string | null;
    reporter_id: string | null;
    reported_user_id: string | null;
    message_id: string | null;
    reason: ClubComplaintReason | string;
    description: string | null;
    status: ClubComplaintStatus;
    resolved_by: string | null;
    resolution_action: ClubComplaintResolutionAction | null;
    resolved_at: string | null;
    created_at: string | null;
}
export interface ClubComplaintWithProfiles extends ClubComplaint {
    reporterProfile: UserProfileSummary | null;
    reportedUserProfile: UserProfileSummary | null;
    resolvedByProfile: UserProfileSummary | null;
}
export interface ResolveClubComplaintInput {
    status: ClubComplaintStatus;
    resolutionAction?: ClubComplaintResolutionAction | null;
}
export interface ClubDiscussionTopicReadState {
    topic_id: string;
    user_id: string;
    last_read_at: string | null;
    unread_reply_count: number | null;
}
export interface ClubDiscussionReplyWithDetails extends ClubDiscussionReply {
    authorProfile: UserProfileSummary | null;
    depth: number;
    voteCount: number;
    upvoteCount: number;
    downvoteCount: number;
    viewerVote: ClubDiscussionVoteType | null;
    reactions: ClubDiscussionReactionSummary[];
}
export interface ClubDiscussionTopicWithDetails extends ClubDiscussionTopic {
    authorProfile: UserProfileSummary | null;
    replies: ClubDiscussionReplyWithDetails[];
    replyCount: number;
    voteCount: number;
    upvoteCount: number;
    downvoteCount: number;
    viewerVote: ClubDiscussionVoteType | null;
    reactions: ClubDiscussionReactionSummary[];
    unreadReplyCount: number;
    hasUnread: boolean;
    recentActivityAt: string | null;
}
export interface CreateClubDiscussionTopicInput {
    clubId: string;
    title: string;
    body: string;
}
export interface CreateClubDiscussionReplyInput {
    topicId: string;
    parentReplyId?: string | null;
    body: string;
}
export interface SetClubDiscussionVoteInput {
    topicId?: string | null;
    replyId?: string | null;
    voteType: ClubDiscussionVoteType;
}
export interface SetClubDiscussionReactionInput {
    topicId?: string | null;
    replyId?: string | null;
    emoji: ClubDiscussionReactionEmoji;
}
export interface CreateClubDiscussionReportInput {
    topicId?: string | null;
    replyId?: string | null;
    reason: ClubDiscussionReportReason;
    details?: string | null;
}

export type ClubBookNominationStatus = 'active' | 'selected' | 'rejected';
export interface ClubNominationBookSummary {
    id: string;
    google_books_id: string | null;
    title: string;
    authors: string[] | null;
    cover_url: string | null;
}
export interface ClubBookVote {
    nomination_id: string;
    user_id: string;
    created_at: string | null;
}
export interface ClubBookNomination {
    id: string;
    club_id: string | null;
    book_id: string | null;
    nominated_by: string | null;
    vote_count: number | null;
    status: ClubBookNominationStatus | null;
    voting_ends_at: string | null;
    created_at: string | null;
}
export interface ClubBookNominationWithDetails extends ClubBookNomination {
    book: ClubNominationBookSummary | null;
    nominatorProfile: UserProfileSummary | null;
    currentUserVote: ClubBookVote | null;
}
export interface NominateClubBookInput {
    clubId: string;
    bookId?: string | null;
    googleBook?: GoogleBook | null;
    votingEndsAt?: string | null;
}
