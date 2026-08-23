jest.mock('@/lib/supabase');
jest.mock('@/features/auth/services/profileService', () => ({
    profileService: {
        getProfileSummary: jest.fn(),
        getProfileSummaries: jest.fn(),
    },
}));

import { clubsService } from '../clubsService';
import { supabase } from '@/lib/supabase';
import { profileService } from '@/features/auth/services/profileService';

function mockQuery(response: Record<string, any>) {
    const builder: any = {};
    const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'ilike', 'order', 'range', 'single', 'maybeSingle', 'or'];
    methods.forEach((method) => { builder[method] = jest.fn(() => builder); });
    builder.then = jest.fn((resolve: any) => resolve(response));
    return builder;
}

function expectExplicitSelect(builder: any, expectedColumn: string) {
    const selectArg = builder.select.mock.calls[0]?.[0];
    expect(selectArg).toEqual(expect.stringContaining(expectedColumn));
    expect(selectArg).not.toContain('*');
}

beforeEach(() => { jest.clearAllMocks(); });

describe('clubsService', () => {
    it('links an approved venue to a club', async () => {
        const insertBuilder = mockQuery({ data: { club_id: 'club-1', venue_id: 'venue-1', is_primary: false }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(insertBuilder);

        const result = await clubsService.addClubVenueLink('club-1', 'venue-1');

        expect(supabase.from).toHaveBeenCalledWith('club_venues');
        expect(insertBuilder.insert).toHaveBeenCalledWith({ club_id: 'club-1', venue_id: 'venue-1', is_primary: false });
        expect(result.venue_id).toBe('venue-1');
    });

    it('removes a venue link from a club', async () => {
        const deleteBuilder = mockQuery({ data: null, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(deleteBuilder);

        await clubsService.removeClubVenueLink('club-1', 'venue-1');

        expect(supabase.from).toHaveBeenCalledWith('club_venues');
        expect(deleteBuilder.delete).toHaveBeenCalled();
        expect(deleteBuilder.eq).toHaveBeenCalledWith('club_id', 'club-1');
        expect(deleteBuilder.eq).toHaveBeenCalledWith('venue_id', 'venue-1');
    });

    it('marks one linked venue as primary for a club', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: { club_id: 'club-1', venue_id: 'venue-1', is_primary: true },
            error: null,
        });

        const result = await clubsService.setPrimaryClubVenue('club-1', 'venue-1');

        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        expect(supabase.rpc).toHaveBeenCalledWith('set_primary_club_venue', {
            p_club_id: 'club-1',
            p_venue_id: 'venue-1',
        });
        expect(result.is_primary).toBe(true);
    });

    it('includes reply-level votes and reactions when reading discussion topics', async () => {
        const topicsBuilder = mockQuery({
            data: [{
                id: 'topic-1',
                club_id: 'club-1',
                author_user_id: 'user-1',
                title: 'Thread title',
                body: 'Thread body',
                is_deleted: false,
                is_edited: false,
                created_at: '2026-03-11T08:00:00.000Z',
                updated_at: '2026-03-11T08:00:00.000Z',
                deleted_at: null,
                last_replied_at: '2026-03-11T09:00:00.000Z',
            }],
            error: null,
        });
        const repliesBuilder = mockQuery({
            data: [{
                id: 'reply-1',
                topic_id: 'topic-1',
                parent_reply_id: null,
                author_user_id: 'user-2',
                body: 'Reply body',
                is_deleted: false,
                created_at: '2026-03-11T09:00:00.000Z',
                deleted_at: null,
            }],
            error: null,
        });
        const votesBuilder = mockQuery({
            data: [
                { id: 'vote-topic', topic_id: 'topic-1', reply_id: null, user_id: 'user-3', vote_type: 'upvote', created_at: null },
                { id: 'vote-reply', topic_id: null, reply_id: 'reply-1', user_id: 'viewer-1', vote_type: 'upvote', created_at: null },
            ],
            error: null,
        });
        const reactionsBuilder = mockQuery({
            data: [
                { id: 'reaction-topic', topic_id: 'topic-1', reply_id: null, user_id: 'user-3', emoji: '👍', created_at: null },
                { id: 'reaction-reply', topic_id: null, reply_id: 'reply-1', user_id: 'viewer-1', emoji: '🔥', created_at: null },
            ],
            error: null,
        });
        const readsBuilder = mockQuery({
            data: [{ topic_id: 'topic-1', user_id: 'viewer-1', last_read_at: null, unread_reply_count: 2 }],
            error: null,
        });
        (supabase.from as jest.Mock)
            .mockReturnValueOnce(topicsBuilder)
            .mockReturnValueOnce(repliesBuilder)
            .mockReturnValueOnce(votesBuilder)
            .mockReturnValueOnce(reactionsBuilder)
            .mockReturnValueOnce(readsBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([
            { id: 'profile-1', user_id: 'user-1', display_name: 'Thread Starter', username: 'starter', avatar_url: null, trust_score: 4.5, city: 'Bengaluru' },
            { id: 'profile-2', user_id: 'user-2', display_name: 'Reply Author', username: 'replier', avatar_url: null, trust_score: 4.1, city: 'Mumbai' },
        ]);

        const result = await clubsService.getClubDiscussionTopics('club-1', 'viewer-1');

        expect(votesBuilder.or).toHaveBeenCalledWith('topic_id.in.(topic-1),reply_id.in.(reply-1)');
        expect(reactionsBuilder.or).toHaveBeenCalledWith('topic_id.in.(topic-1),reply_id.in.(reply-1)');
        expect(result[0].voteCount).toBe(1);
        expect(result[0].replies[0].voteCount).toBe(1);
        expect(result[0].replies[0].viewerVote).toBe('upvote');
        expect(result[0].replies[0].reactions).toEqual([{ emoji: '🔥', count: 1, viewerReacted: true, users: [{ userId: 'viewer-1', displayName: 'A club member', username: null }] }]);
    });

    it('reads public club browse results from club_public_details', async () => {
        const publicBuilder = mockQuery({ data: [{ id: 'club-1', name: 'Open Readers', club_type: 'public', current_book_title: 'Dune' }], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(publicBuilder);

        const result = await clubsService.getPublicClubs({ clubType: 'public', meetingType: 'hybrid', accessLevel: 'pro', search: 'Dune' });

        expect(supabase.from).toHaveBeenCalledWith('club_public_details');
        expectExplicitSelect(publicBuilder, 'current_book_title');
        expect(publicBuilder.eq).toHaveBeenCalledWith('club_type', 'public');
        expect(publicBuilder.eq).toHaveBeenCalledWith('meeting_type', 'hybrid');
        expect(publicBuilder.eq).toHaveBeenCalledWith('access_level', 'pro');
        expect(publicBuilder.or).toHaveBeenCalledWith('name.ilike.%Dune%,current_book_title.ilike.%Dune%,admin_display_name.ilike.%Dune%,author_display_name.ilike.%Dune%');
        expect(result[0].name).toBe('Open Readers');
    });

    it('sanitizes public club search terms before building the PostgREST or filter', async () => {
        const publicBuilder = mockQuery({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(publicBuilder);

        await clubsService.getPublicClubs({ search: ' Dune),name.ilike.%% ' });

        expect(publicBuilder.or).toHaveBeenCalledWith('name.ilike.%Dune name ilike%,current_book_title.ilike.%Dune name ilike%,admin_display_name.ilike.%Dune name ilike%,author_display_name.ilike.%Dune name ilike%');
    });

    it('reads club events with venue details, creator profiles, and the current user RSVP', async () => {
        const eventsBuilder = mockQuery({
            data: [{
                id: 'event-1', club_id: 'club-1', title: 'March meetup', description: 'Discuss chapter five', event_type: 'hybrid',
                start_time: '2026-03-20T12:00:00.000Z', end_time: null, venue_id: 'venue-1', manual_location: null,
                meeting_link: 'https://meet.example.com/club-room', max_attendees: null, created_by: 'manager-1',
                created_at: '2026-03-10T00:00:00.000Z', updated_at: '2026-03-10T00:00:00.000Z', status: 'scheduled',
                cancelled_at: null, cancelled_by: null,
                venue: { id: 'venue-1', name: 'Library Hall', city: 'Bengaluru', address_line1: 'Main St', address_line2: null, verification_status: 'approved' },
                rsvps: [{ event_id: 'event-1', user_id: 'reader-1', status: 'going', created_at: '2026-03-10T01:00:00.000Z' }],
            }],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(eventsBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([
            { id: 'profile-1', user_id: 'manager-1', display_name: 'Curator Cam', username: 'curatorcam', avatar_url: null, trust_score: 4.8, city: 'Bengaluru' },
        ]);

        const result = await clubsService.getClubEvents('club-1', 'reader-1');

        expect(supabase.from).toHaveBeenCalledWith('club_events');
        expect(eventsBuilder.eq).toHaveBeenCalledWith('club_id', 'club-1');
        expect(result[0].venue?.name).toBe('Library Hall');
        expect(result[0].creatorProfile?.display_name).toBe('Curator Cam');
        expect(result[0].currentUserRsvp?.status).toBe('going');
    });

    it('creates a hybrid club event with a manual meetup location when no linked venue is used', async () => {
        const insertBuilder = mockQuery({
            data: {
                id: 'event-2', club_id: 'club-1', title: 'Hybrid planning night', description: 'Bring your notes', event_type: 'hybrid',
                start_time: '2026-03-24T13:00:00.000Z', end_time: null, venue_id: null, manual_location: 'Café upstairs',
                meeting_link: 'https://meet.example.com/hybrid-night', max_attendees: null, created_by: 'test-user-id',
                created_at: '2026-03-10T00:00:00.000Z', updated_at: '2026-03-10T00:00:00.000Z', status: 'scheduled', cancelled_at: null, cancelled_by: null,
            },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(insertBuilder);

        const result = await clubsService.createClubEvent({
            clubId: 'club-1',
            title: ' Hybrid planning night ',
            description: ' Bring your notes ',
            eventType: 'hybrid',
            startTime: '2026-03-24T13:00:00.000Z',
            manualLocation: ' Café upstairs ',
            meetingLink: 'https://meet.example.com/hybrid-night',
        });

        expect(supabase.from).toHaveBeenCalledWith('club_events');
        expectExplicitSelect(insertBuilder, 'cancelled_by');
        expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
            club_id: 'club-1',
            created_by: 'test-user-id',
            title: 'Hybrid planning night',
            manual_location: 'Café upstairs',
            venue_id: null,
            event_type: 'hybrid',
        }));
        expect(result.manual_location).toBe('Café upstairs');
    });

    it('reads my clubs browse results from membership plus club_public_details', async () => {
        const membershipsBuilder = mockQuery({ data: [{ club_id: 'club-2' }, { club_id: 'club-3' }], error: null });
        const publicBuilder = mockQuery({ data: [{ id: 'club-2', name: 'My Readers', club_type: 'approval', current_book_title: 'Kindred' }], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(membershipsBuilder).mockReturnValueOnce(publicBuilder);

        const result = await clubsService.getMyPublicClubs('user-1', { clubType: 'approval', meetingType: 'hybrid', accessLevel: 'pro', search: 'Kindred' });

        expect(supabase.from).toHaveBeenNthCalledWith(1, 'club_members');
        expect(membershipsBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(membershipsBuilder.in).toHaveBeenCalledWith('status', ['active', 'muted']);
        expect(supabase.from).toHaveBeenNthCalledWith(2, 'club_public_details');
        expectExplicitSelect(publicBuilder, 'current_book_title');
        expect(publicBuilder.in).toHaveBeenCalledWith('id', ['club-2', 'club-3']);
        expect(publicBuilder.eq).toHaveBeenCalledWith('club_type', 'approval');
        expect(publicBuilder.eq).toHaveBeenCalledWith('meeting_type', 'hybrid');
        expect(publicBuilder.eq).toHaveBeenCalledWith('access_level', 'pro');
        expect(publicBuilder.or).toHaveBeenCalledWith('name.ilike.%Kindred%,current_book_title.ilike.%Kindred%,admin_display_name.ilike.%Kindred%,author_display_name.ilike.%Kindred%');
        expect(result[0].name).toBe('My Readers');
    });

    it('returns an empty my clubs browse list when the user has no active memberships', async () => {
        const membershipsBuilder = mockQuery({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(membershipsBuilder);

        const result = await clubsService.getMyPublicClubs('user-2');

        expect(supabase.from).toHaveBeenCalledWith('club_members');
        expect(result).toEqual([]);
    });

    it('reads a single public club detail row from club_public_details', async () => {
        const detailBuilder = mockQuery({ data: { id: 'club-7', name: 'Author Circle', club_type: 'author_club' }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(detailBuilder);

        const result = await clubsService.getPublicClubById('club-7');

        expect(supabase.from).toHaveBeenCalledWith('club_public_details');
        expectExplicitSelect(detailBuilder, 'admin_display_name');
        expect(detailBuilder.eq).toHaveBeenCalledWith('id', 'club-7');
        expect(result.id).toBe('club-7');
    });

    it('normalizes nested current book rows when reading legacy club rows', async () => {
        const clubsBuilder = mockQuery({
            data: [{
                id: 'club-book-row',
                name: 'Book Row Club',
                description: null,
                cover_url: null,
                club_type: 'public',
                access_level: 'all',
                current_book_id: 'book-1',
                admin_id: 'user-1',
                member_count: 1,
                max_members: null,
                is_archived: false,
                created_at: null,
                updated_at: null,
                meeting_type: null,
                archived_at: null,
                author_id: null,
                current_book: [{ id: 'book-1', title: 'Dune', authors: ['Frank Herbert'], cover_url: null }],
            }],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(clubsBuilder);

        const result = await clubsService.getClubs();

        expect(result[0].current_book?.title).toBe('Dune');
    });

    it('checks membership limits through the edge function', async () => {
        (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({ data: { allowed: true, current_count: 1, max_allowed: 5, tier: 'pro' }, error: null });
        const result = await clubsService.checkMembershipLimits('user-1');
        expect(supabase.functions.invoke).toHaveBeenCalledWith('check-membership-limits', { body: { user_id: 'user-1', action: 'create_club' } });
        expect(result.allowed).toBe(true);
        expect(result.tier).toBe('pro');
    });

    it('creates a club through the transactional rpc after limit check', async () => {
        (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({ data: { allowed: true, current_count: 0, max_allowed: 5, tier: 'pro' }, error: null });
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: { id: 'club-1' }, error: null });
        const detailBuilder = mockQuery({
            data: {
                id: 'club-1', name: 'Founders Club', description: null, cover_url: null, club_type: 'public', access_level: 'all', current_book_id: null,
                admin_id: 'user-1', member_count: 1, max_members: null, is_archived: false, created_at: null, updated_at: null, meeting_type: null,
                archived_at: null, author_id: null, current_book: null,
            },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(detailBuilder);
        (profileService.getProfileSummary as jest.Mock).mockResolvedValueOnce(null);

        const result = await clubsService.createClub({ name: ' Founders Club ', club_type: 'public', admin_id: 'user-1' });

        expect(supabase.rpc).toHaveBeenCalledWith('create_club', {
            p_name: 'Founders Club',
            p_description: null,
            p_cover_url: null,
            p_club_type: 'public',
            p_access_level: 'all',
            p_meeting_type: null,
            p_admin_id: 'user-1',
            p_current_book_id: null,
            p_max_members: null,
            p_author_id: null,
        });
        expect(supabase.from).toHaveBeenCalledTimes(1);
        expectExplicitSelect(detailBuilder, 'current_book:books');
        expect(detailBuilder.eq).toHaveBeenCalledWith('id', 'club-1');
        expect(result.id).toBe('club-1');
    });

    it('updates club settings for the first manage-club settings slice', async () => {
        const updateBuilder = mockQuery({
            data: {
                id: 'club-1',
                name: 'Updated Founders Club',
                description: 'New details',
                cover_url: 'https://images.example.com/club.png',
                club_type: 'approval',
                access_level: 'pro',
                current_book_id: null,
                admin_id: 'user-1',
                member_count: 12,
                max_members: null,
                is_archived: false,
                created_at: null,
                updated_at: '2026-03-07T00:00:00.000Z',
                meeting_type: 'hybrid',
                archived_at: null,
                author_id: null,
            },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(updateBuilder);

        const result = await clubsService.updateClub('club-1', {
            name: ' Updated Founders Club ',
            description: '  New details  ',
            cover_url: ' https://images.example.com/club.png ',
            club_type: 'approval',
            access_level: 'pro',
            meeting_type: 'hybrid',
        });

        expect(supabase.from).toHaveBeenCalledWith('book_clubs');
        expectExplicitSelect(updateBuilder, 'archived_at');
        expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Updated Founders Club',
            description: 'New details',
            cover_url: 'https://images.example.com/club.png',
            club_type: 'approval',
            access_level: 'pro',
            meeting_type: 'hybrid',
        }));
        expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'club-1');
        expect(result.club_type).toBe('approval');
    });

    it('updates a club member role for moderator assignment', async () => {
        const clubBuilder = mockQuery({ data: { id: 'club-1', access_level: 'all' }, error: null });
        const memberBuilder = mockQuery({ data: { id: 'member-2', club_id: 'club-1', user_id: 'user-2', role: 'moderator', status: 'active', joined_at: null }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(clubBuilder).mockReturnValueOnce(memberBuilder);
        (profileService.getProfileSummary as jest.Mock).mockResolvedValueOnce({ membership_tier: 'pro' });

        const result = await clubsService.updateMemberRole('club-1', 'user-2', 'moderator');

        expect(supabase.from).toHaveBeenNthCalledWith(1, 'book_clubs');
        expect(supabase.from).toHaveBeenNthCalledWith(2, 'club_members');
        expect(memberBuilder.update).toHaveBeenCalledWith({ role: 'moderator' });
        expect(memberBuilder.eq).toHaveBeenNthCalledWith(1, 'club_id', 'club-1');
        expect(memberBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-2');
        expect(result.role).toBe('moderator');
    });

    it('records a club member action through the moderation rpc', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: {
                id: 'action-1',
                club_id: 'club-1',
                user_id: 'user-2',
                action_type: 'warned',
                reason: 'Repeated spoilers',
                duration_hours: null,
                expires_at: null,
                performed_by: 'admin-1',
                created_at: '2026-05-29T00:00:00Z',
            },
            error: null,
        });

        const result = await clubsService.createClubMemberAction({
            clubId: 'club-1',
            userId: 'user-2',
            actionType: 'warned',
            reason: ' Repeated spoilers ',
        });

        expect(supabase.rpc).toHaveBeenCalledWith('issue_club_member_action', {
            p_club_id: 'club-1',
            p_user_id: 'user-2',
            p_action_type: 'warned',
            p_reason: 'Repeated spoilers',
            p_duration_hours: null,
        });
        expect(result.action_type).toBe('warned');
    });

    it('reads platform complaints for manager review with reporter and reported profiles', async () => {
        const complaintsBuilder = mockQuery({
            data: [{
                id: 'complaint-1',
                club_id: 'club-1',
                reporter_id: 'reader-1',
                reported_user_id: 'reader-2',
                message_id: 'message-1',
                reason: 'harassment',
                description: 'Personal attack in chat.',
                status: 'pending',
                resolved_by: null,
                resolution_action: null,
                resolved_at: null,
                created_at: '2026-05-30T00:00:00Z',
            }],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(complaintsBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([
            { id: 'profile-reporter', user_id: 'reader-1', display_name: 'Reporter One', username: 'reporterone', avatar_url: null, trust_score: 4.8, city: 'Bangalore' },
            { id: 'profile-reported', user_id: 'reader-2', display_name: 'Reported Two', username: 'reportedtwo', avatar_url: null, trust_score: 3.2, city: 'Mumbai' },
        ]);

        const result = await clubsService.getClubComplaints('club-1');

        expect(supabase.from).toHaveBeenCalledWith('club_complaints');
        expectExplicitSelect(complaintsBuilder, 'resolution_action');
        expect(complaintsBuilder.eq).toHaveBeenCalledWith('club_id', 'club-1');
        expect(complaintsBuilder.in).toHaveBeenCalledWith('status', ['pending', 'reviewing']);
        expect(result[0].reporterProfile?.display_name).toBe('Reporter One');
        expect(result[0].reportedUserProfile?.display_name).toBe('Reported Two');
    });

    it('resolves platform complaints with status and resolution action', async () => {
        const updateBuilder = mockQuery({
            data: {
                id: 'complaint-1',
                club_id: 'club-1',
                reporter_id: 'reader-1',
                reported_user_id: 'reader-2',
                message_id: 'message-1',
                reason: 'harassment',
                description: 'Personal attack in chat.',
                status: 'resolved',
                resolved_by: null,
                resolution_action: 'no_action',
                resolved_at: '2026-05-30T01:00:00Z',
                created_at: '2026-05-30T00:00:00Z',
            },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(updateBuilder);

        const result = await clubsService.resolveClubComplaint('complaint-1', { status: 'resolved', resolutionAction: 'no_action' });

        expect(supabase.from).toHaveBeenCalledWith('club_complaints');
        expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
            status: 'resolved',
            resolution_action: 'no_action',
        }));
        expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'complaint-1');
        expectExplicitSelect(updateBuilder, 'resolution_action');
        expect(result.status).toBe('resolved');
    });

    it('requests and accepts admin transfer through acceptance-flow rpcs', async () => {
        (supabase.rpc as jest.Mock)
            .mockResolvedValueOnce({
                data: {
                    id: 'request-1',
                    club_id: 'club-1',
                    requested_by: 'admin-1',
                    proposed_admin_user_id: 'user-2',
                    status: 'pending',
                    created_at: '2026-05-29T00:00:00Z',
                    responded_at: null,
                    expires_at: '2026-06-05T00:00:00Z',
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    id: 'club-1',
                    name: 'Founders Club',
                    description: null,
                    cover_url: null,
                    club_type: 'public',
                    access_level: 'all',
                    current_book_id: null,
                    admin_id: 'user-2',
                    member_count: 2,
                    max_members: null,
                    is_archived: false,
                    created_at: null,
                    updated_at: null,
                    meeting_type: null,
                    archived_at: null,
                    author_id: null,
                },
                error: null,
            });

        const request = await clubsService.requestClubAdminTransfer('club-1', 'user-2');
        const club = await clubsService.acceptClubAdminTransferRequest('request-1');

        expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'request_club_admin_transfer', {
            p_club_id: 'club-1',
            p_new_admin_user_id: 'user-2',
        });
        expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'accept_club_admin_transfer_request', {
            p_request_id: 'request-1',
        });
        expect(request.status).toBe('pending');
        expect(club.admin_id).toBe('user-2');
    });

    it('blocks assigning moderator to a free-tier user before the update mutation runs', async () => {
        const clubBuilder = mockQuery({ data: { id: 'club-1', access_level: 'all' }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(clubBuilder);
        (profileService.getProfileSummary as jest.Mock).mockResolvedValueOnce({ membership_tier: 'free' });

        await expect(clubsService.updateMemberRole('club-1', 'user-2', 'moderator')).rejects.toThrow(/only pro or pro\+ users can become club moderators/i);
    });

    it('joins public clubs by inserting an active member row', async () => {
        const clubLookupBuilder = mockQuery({ data: { id: 'club-1', club_type: 'public', access_level: 'all' }, error: null });
        const memberInsertBuilder = mockQuery({ data: null, error: null });
        const membershipLookupBuilder = mockQuery({ data: { id: 'member-1', club_id: 'club-1', user_id: 'user-1', role: 'member', status: 'active', joined_at: null }, error: null });
        (supabase.from as jest.Mock)
            .mockReturnValueOnce(clubLookupBuilder)
            .mockReturnValueOnce(memberInsertBuilder)
            .mockReturnValueOnce(membershipLookupBuilder);
        (profileService.getProfileSummary as jest.Mock).mockResolvedValueOnce({ membership_tier: 'free' });

        const result = await clubsService.joinClub('club-1', 'user-1');

        expect(result.status).toBe('joined');
        expect(memberInsertBuilder.insert).toHaveBeenCalledWith({ club_id: 'club-1', user_id: 'user-1', role: 'member', status: 'active' });
        expect(membershipLookupBuilder.eq).toHaveBeenNthCalledWith(1, 'club_id', 'club-1');
        expect(membershipLookupBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
        expect(result.membership?.id).toBe('member-1');
    });

    it('blocks direct joins when the user tier does not satisfy the club access level', async () => {
        const clubLookupBuilder = mockQuery({ data: { id: 'club-1', club_type: 'public', access_level: 'pro' }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(clubLookupBuilder);
        (profileService.getProfileSummary as jest.Mock).mockResolvedValueOnce({ membership_tier: 'free' });

        await expect(clubsService.joinClub('club-1', 'user-1')).rejects.toThrow(/this club requires pro members/i);
    });

    it('applies to approval clubs with pending answers payload', async () => {
        const clubLookupBuilder = mockQuery({ data: { id: 'club-2', club_type: 'approval' }, error: null });
        const applicationBuilder = mockQuery({ data: { id: 'application-1', club_id: 'club-2', user_id: 'user-2', status: 'pending', answers: { why: 'Because books' }, reviewed_by: null, reviewed_at: null, decline_reason: null, created_at: null }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(clubLookupBuilder).mockReturnValueOnce(applicationBuilder);
        const result = await clubsService.joinClub('club-2', 'user-2', { why: 'Because books' });
        expect(result.status).toBe('applied');
        expectExplicitSelect(applicationBuilder, 'decline_reason');
        expect(applicationBuilder.insert).toHaveBeenCalledWith({ club_id: 'club-2', user_id: 'user-2', status: 'pending', answers: { why: 'Because books' } });
    });

    it('applies to author clubs through the same application flow', async () => {
        const clubLookupBuilder = mockQuery({ data: { id: 'club-3', club_type: 'author_club' }, error: null });
        const applicationBuilder = mockQuery({ data: { id: 'application-2', club_id: 'club-3', user_id: 'user-3', status: 'pending', answers: { q1: 'I love AMA sessions' }, reviewed_by: null, reviewed_at: null, decline_reason: null, created_at: null }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(clubLookupBuilder).mockReturnValueOnce(applicationBuilder);
        const result = await clubsService.joinClub('club-3', 'user-3', { q1: 'I love AMA sessions' });
        expect(result.status).toBe('applied');
        expect(applicationBuilder.insert).toHaveBeenCalledWith({ club_id: 'club-3', user_id: 'user-3', status: 'pending', answers: { q1: 'I love AMA sessions' } });
    });

    it('returns an existing pending application when a duplicate application insert races', async () => {
        const clubLookupBuilder = mockQuery({ data: { id: 'club-4', club_type: 'approval' }, error: null });
        const duplicateInsertBuilder = mockQuery({ data: null, error: { code: '23505' } });
        const existingApplicationBuilder = mockQuery({ data: { id: 'application-4', club_id: 'club-4', user_id: 'user-4', status: 'pending', answers: {}, reviewed_by: null, reviewed_at: null, decline_reason: null, created_at: null }, error: null });
        (supabase.from as jest.Mock)
            .mockReturnValueOnce(clubLookupBuilder)
            .mockReturnValueOnce(duplicateInsertBuilder)
            .mockReturnValueOnce(existingApplicationBuilder);

        const result = await clubsService.joinClub('club-4', 'user-4');

        expect(result.status).toBe('applied');
        expect(result.application?.id).toBe('application-4');
    });

    it('reads the current user application for a club', async () => {
        const applicationBuilder = mockQuery({ data: { id: 'application-9', club_id: 'club-9', user_id: 'user-9', status: 'pending', answers: {}, reviewed_by: null, reviewed_at: null, decline_reason: null, created_at: null }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(applicationBuilder);

        const result = await clubsService.getMyJoinApplication('club-9', 'user-9');

        expect(supabase.from).toHaveBeenCalledWith('club_join_applications');
        expectExplicitSelect(applicationBuilder, 'answers');
        expect(applicationBuilder.eq).toHaveBeenNthCalledWith(1, 'club_id', 'club-9');
        expect(applicationBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-9');
        expect(result?.status).toBe('pending');
    });

    it('maps applicant profile summaries onto club applications', async () => {
        const applicationsBuilder = mockQuery({ data: [{ id: 'application-10', club_id: 'club-10', user_id: 'user-10', status: 'pending', answers: { why: 'Book friends' }, reviewed_by: null, reviewed_at: null, decline_reason: null, created_at: null }], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(applicationsBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([{ id: 'profile-10', user_id: 'user-10', display_name: 'Applicant Reader', avatar_url: null, trust_score: 4.5, city: 'Ibadan', membership_tier: 'pro' }]);

        const result = await clubsService.getClubApplications('club-10');

        expect(supabase.from).toHaveBeenCalledWith('club_join_applications');
        expectExplicitSelect(applicationsBuilder, 'reviewed_at');
        expect(applicationsBuilder.eq).toHaveBeenNthCalledWith(1, 'club_id', 'club-10');
        expect(applicationsBuilder.eq).toHaveBeenNthCalledWith(2, 'status', 'pending');
        expect(profileService.getProfileSummaries).toHaveBeenCalledWith(['user-10']);
        expect(result[0].applicantProfile?.display_name).toBe('Applicant Reader');
    });

    it('deduplicates applicant profile summary lookups for repeated application user ids', async () => {
        const applicationsBuilder = mockQuery({
            data: [
                { id: 'application-10a', club_id: 'club-10', user_id: 'user-10', status: 'pending', answers: {}, reviewed_by: null, reviewed_at: null, decline_reason: null, created_at: null },
                { id: 'application-10b', club_id: 'club-10', user_id: 'user-10', status: 'pending', answers: {}, reviewed_by: null, reviewed_at: null, decline_reason: null, created_at: null },
            ],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(applicationsBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([{ id: 'profile-10', user_id: 'user-10', display_name: 'Applicant Reader', avatar_url: null, trust_score: 4.5, city: 'Ibadan', membership_tier: 'pro' }]);

        await clubsService.getClubApplications('club-10');

        expect(profileService.getProfileSummaries).toHaveBeenCalledWith(['user-10']);
    });

    it('reviews a join application through the live rpc contract', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: { id: 'application-11', club_id: 'club-11', user_id: 'user-11', status: 'approved', answers: {}, reviewed_by: 'moderator-1', reviewed_at: '2026-03-06T00:00:00Z', decline_reason: null, created_at: null }, error: null });

        const result = await clubsService.reviewJoinApplication('application-11', 'approved');

        expect(supabase.rpc).toHaveBeenCalledWith('review_club_join_application', {
            p_application_id: 'application-11',
            p_decision: 'approved',
            p_decline_reason: null,
        });
        expect(result.status).toBe('approved');
    });

    it('creates a join question for admin management', async () => {
        const questionBuilder = mockQuery({ data: { id: 'question-11', club_id: 'club-11', question: 'What do you hope to discuss?', is_required: true, order_index: 2 }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(questionBuilder);

        const result = await clubsService.createJoinQuestion('club-11', { question: 'What do you hope to discuss?', isRequired: true, orderIndex: 2 });

        expectExplicitSelect(questionBuilder, 'order_index');
        expect(questionBuilder.insert).toHaveBeenCalledWith({ club_id: 'club-11', question: 'What do you hope to discuss?', is_required: true, order_index: 2 });
        expect(result.id).toBe('question-11');
    });

    it('updates a join question for admin management', async () => {
        const questionBuilder = mockQuery({ data: { id: 'question-12', club_id: 'club-12', question: 'Updated question', is_required: false, order_index: 1 }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(questionBuilder);

        const result = await clubsService.updateJoinQuestion('question-12', { question: 'Updated question', isRequired: false });

        expectExplicitSelect(questionBuilder, 'order_index');
        expect(questionBuilder.update).toHaveBeenCalledWith({ question: 'Updated question', is_required: false });
        expect(questionBuilder.eq).toHaveBeenCalledWith('id', 'question-12');
        expect(result.question).toBe('Updated question');
    });

    it('deletes a join question for admin management', async () => {
        const questionBuilder = mockQuery({ data: null, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(questionBuilder);

        await clubsService.deleteJoinQuestion('question-13');

        expect(questionBuilder.delete).toHaveBeenCalled();
        expect(questionBuilder.eq).toHaveBeenCalledWith('id', 'question-13');
    });

    it('removes a club member by deleting their membership row', async () => {
        const memberBuilder = mockQuery({ data: null, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(memberBuilder);

        await clubsService.removeMember('club-1', 'user-9');

        expect(supabase.from).toHaveBeenCalledWith('club_members');
        expect(memberBuilder.delete).toHaveBeenCalled();
        expect(memberBuilder.eq).toHaveBeenNthCalledWith(1, 'club_id', 'club-1');
        expect(memberBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-9');
    });

    it('maps invitation profiles for invite-only management', async () => {
        const invitationBuilder = mockQuery({ data: [{ id: 'invite-1', club_id: 'club-14', inviter_user_id: 'user-admin', invitee_user_id: 'user-invitee', status: 'pending', note: 'Join us!', created_at: '2026-03-06T00:00:00Z', responded_at: null }], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(invitationBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([
            { id: 'profile-admin', user_id: 'user-admin', display_name: 'Admin Reader', username: 'adminreader', avatar_url: null, trust_score: 4.8, city: 'Lagos' },
            { id: 'profile-invitee', user_id: 'user-invitee', display_name: 'Invited Reader', username: 'invitedreader', avatar_url: null, trust_score: 4.7, city: 'Abuja' },
        ]);

        const result = await clubsService.getClubInvitations('club-14');

        expect(supabase.from).toHaveBeenCalledWith('club_invitations');
        expectExplicitSelect(invitationBuilder, 'read_at');
        expect(invitationBuilder.eq).toHaveBeenCalledWith('club_id', 'club-14');
        expect(result[0].inviteeProfile?.username).toBe('invitedreader');
    });

    it('reads the current users pending invitation for invite-only acceptance', async () => {
        const invitationBuilder = mockQuery({ data: { id: 'invite-accept', club_id: 'club-16', inviter_user_id: 'user-admin', invitee_user_id: 'user-invitee', status: 'pending', note: 'Welcome in', created_at: '2026-03-06T00:00:00Z', responded_at: null }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(invitationBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([
            { id: 'profile-admin', user_id: 'user-admin', display_name: 'Admin Reader', username: 'adminreader', avatar_url: null, trust_score: 4.8, city: 'Lagos' },
            { id: 'profile-invitee', user_id: 'user-invitee', display_name: 'Invited Reader', username: 'invitedreader', avatar_url: null, trust_score: 4.7, city: 'Abuja' },
        ]);

        const result = await clubsService.getMyPendingInvitation('club-16', 'user-invitee');

        expect(supabase.from).toHaveBeenCalledWith('club_invitations');
        expectExplicitSelect(invitationBuilder, 'read_at');
        expect(invitationBuilder.eq).toHaveBeenNthCalledWith(1, 'club_id', 'club-16');
        expect(invitationBuilder.eq).toHaveBeenNthCalledWith(2, 'invitee_user_id', 'user-invitee');
        expect(invitationBuilder.eq).toHaveBeenNthCalledWith(3, 'status', 'pending');
        expect(result?.inviterProfile?.display_name).toBe('Admin Reader');
    });

    it('reads the current users invitation inbox across pending and historical statuses with club details', async () => {
        const invitationBuilder = mockQuery({
            data: [
                {
                    id: 'invite-inbox',
                    club_id: 'club-invite-only',
                    inviter_user_id: 'user-admin',
                    invitee_user_id: 'user-invitee',
                    status: 'pending',
                    note: 'Join our next read',
                    created_at: '2026-05-23T00:00:00Z',
                    responded_at: null,
                    read_at: null,
                },
                {
                    id: 'invite-accepted',
                    club_id: 'club-accepted',
                    inviter_user_id: 'user-admin',
                    invitee_user_id: 'user-invitee',
                    status: 'accepted',
                    note: null,
                    created_at: '2026-05-20T00:00:00Z',
                    responded_at: '2026-05-21T00:00:00Z',
                    read_at: '2026-05-20T01:00:00Z',
                },
            ],
            error: null,
        });
        const clubBuilder = mockQuery({
            data: [
                {
                    id: 'club-invite-only',
                    name: 'Quiet Sci-Fi Circle',
                    club_type: 'invite_only',
                    current_book_title: 'Dune',
                    admin_display_name: 'Admin Reader',
                },
                {
                    id: 'club-accepted',
                    name: 'Accepted Classics',
                    club_type: 'invite_only',
                    current_book_title: 'Beloved',
                    admin_display_name: 'Admin Reader',
                },
            ],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(invitationBuilder).mockReturnValueOnce(clubBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([
            { id: 'profile-admin', user_id: 'user-admin', display_name: 'Admin Reader', username: 'adminreader', avatar_url: null, trust_score: 4.8, city: 'Lagos' },
            { id: 'profile-invitee', user_id: 'user-invitee', display_name: 'Invited Reader', username: 'invitedreader', avatar_url: null, trust_score: 4.7, city: 'Abuja' },
        ]);

        const result = await clubsService.getMyPendingInvitations('user-invitee');

        expect(supabase.from).toHaveBeenNthCalledWith(1, 'club_invitations');
        expectExplicitSelect(invitationBuilder, 'read_at');
        expect(invitationBuilder.eq).toHaveBeenNthCalledWith(1, 'invitee_user_id', 'user-invitee');
        expect(invitationBuilder.in).toHaveBeenCalledWith('status', ['pending', 'accepted', 'expired', 'revoked']);
        expect(supabase.from).toHaveBeenNthCalledWith(2, 'club_public_details');
        expectExplicitSelect(clubBuilder, 'current_book_title');
        expect(clubBuilder.in).toHaveBeenCalledWith('id', ['club-invite-only', 'club-accepted']);
        expect(result[0].club?.name).toBe('Quiet Sci-Fi Circle');
        expect(result[0].inviterProfile?.display_name).toBe('Admin Reader');
        expect(result[0].read_at).toBeNull();
        expect(result[1].club?.name).toBe('Accepted Classics');
        expect(result[1].status).toBe('accepted');
    });

    it('creates an invite-only club invitation through the live rpc contract', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: { id: 'invite-2', club_id: 'club-15', inviter_user_id: 'user-admin', invitee_user_id: 'user-target', status: 'pending', note: 'We would love to have you', created_at: '2026-03-06T00:00:00Z', responded_at: null }, error: null });

        const result = await clubsService.createClubInvitation('club-15', 'targetreader', 'We would love to have you');

        expect(supabase.rpc).toHaveBeenCalledWith('create_club_invitation', {
            p_club_id: 'club-15',
            p_invitee_username: 'targetreader',
            p_note: 'We would love to have you',
        });
        expect(result.status).toBe('pending');
    });

    it('accepts an invitation through the live rpc contract', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: { id: 'member-accept', club_id: 'club-16', user_id: 'user-invitee', role: 'member', status: 'active', joined_at: '2026-03-06T00:00:00Z' }, error: null });

        const result = await clubsService.acceptClubInvitation('invite-accept');

        expect(supabase.rpc).toHaveBeenCalledWith('accept_club_invitation', {
            p_invitation_id: 'invite-accept',
        });
        expect(result.status).toBe('active');
    });

    it('revokes a pending invitation through the live rpc contract', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: { id: 'invite-revoke', club_id: 'club-16', inviter_user_id: 'user-admin', invitee_user_id: 'user-invitee', status: 'revoked', note: null, created_at: '2026-03-06T00:00:00Z', responded_at: '2026-05-23T00:00:00Z', read_at: null },
            error: null,
        });

        const result = await clubsService.revokeClubInvitation('invite-revoke');

        expect(supabase.rpc).toHaveBeenCalledWith('revoke_club_invitation', {
            p_invitation_id: 'invite-revoke',
        });
        expect(result.status).toBe('revoked');
    });

    it('marks an invitation read through the live rpc contract', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: { id: 'invite-read', club_id: 'club-16', inviter_user_id: 'user-admin', invitee_user_id: 'user-invitee', status: 'pending', note: null, created_at: '2026-03-06T00:00:00Z', responded_at: null, read_at: '2026-05-23T00:00:00Z' },
            error: null,
        });

        const result = await clubsService.markInvitationRead('invite-read');

        expect(supabase.rpc).toHaveBeenCalledWith('mark_invitation_read', {
            p_invitation_id: 'invite-read',
        });
        expect(result.read_at).toBe('2026-05-23T00:00:00Z');
    });

    it('maps member profile summaries onto club members', async () => {
        const membersBuilder = mockQuery({ data: [{ id: 'member-1', club_id: 'club-1', user_id: 'user-1', role: 'member', status: 'active', joined_at: null }], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(membersBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([{ id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', avatar_url: null, trust_score: 4.8, city: 'Bangalore' }]);
        const result = await clubsService.getClubMembers('club-1');
        expect(supabase.from).toHaveBeenCalledWith('club_members');
        expect(profileService.getProfileSummaries).toHaveBeenCalledWith(['user-1']);
        expect(result[0].profile?.display_name).toBe('Reader One');
    });

    it('deduplicates member profile summary lookups for repeated member user ids', async () => {
        const membersBuilder = mockQuery({
            data: [
                { id: 'member-1', club_id: 'club-1', user_id: 'user-1', role: 'member', status: 'active', joined_at: null },
                { id: 'member-2', club_id: 'club-1', user_id: 'user-1', role: 'moderator', status: 'muted', joined_at: null },
            ],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(membersBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([{ id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', avatar_url: null, trust_score: 4.8, city: 'Bangalore' }]);

        await clubsService.getClubMembers('club-1');

        expect(profileService.getProfileSummaries).toHaveBeenCalledWith(['user-1']);
    });

    it('maps club book nominations with book details, nominator profiles, and current user vote state', async () => {
        const nominationsBuilder = mockQuery({
            data: [{
                id: 'nomination-1',
                club_id: 'club-books',
                book_id: 'book-1',
                nominated_by: 'user-nominator',
                vote_count: 3,
                status: 'active',
                voting_ends_at: null,
                created_at: '2026-03-09T00:00:00Z',
                book: { id: 'book-1', google_books_id: 'google-book-1', title: 'Kindred', authors: ['Octavia Butler'], cover_url: 'https://books.example/kindred.jpg' },
                votes: [
                    { nomination_id: 'nomination-1', user_id: 'user-voter', created_at: '2026-03-09T01:00:00Z' },
                    { nomination_id: 'nomination-1', user_id: 'user-other', created_at: '2026-03-09T02:00:00Z' },
                ],
            }],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(nominationsBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([
            { id: 'profile-nominator', user_id: 'user-nominator', display_name: 'Nominator Reader', username: 'nominatorreader', avatar_url: null, trust_score: 4.6, city: 'Lagos' },
        ]);

        const result = await clubsService.getClubBookNominations('club-books', 'user-voter');

        expect(supabase.from).toHaveBeenCalledWith('book_nominations');
        expect(nominationsBuilder.eq).toHaveBeenCalledWith('club_id', 'club-books');
        expect(result[0].book?.title).toBe('Kindred');
        expect(result[0].nominatorProfile?.display_name).toBe('Nominator Reader');
        expect(result[0].currentUserVote?.user_id).toBe('user-voter');
    });

    it('nominates a club book through the nomination rpc using a Google Books result', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: { id: 'nomination-2', club_id: 'club-books', book_id: 'book-2', nominated_by: 'user-1', vote_count: 0, status: 'active', voting_ends_at: null, created_at: null },
            error: null,
        });

        const result = await clubsService.nominateClubBook({
            clubId: 'club-books',
            googleBook: {
                id: 'google-book-2',
                volumeInfo: {
                    title: 'Parable of the Sower',
                    authors: ['Octavia Butler'],
                    imageLinks: { thumbnail: 'https://books.example/parable-thumb.jpg' },
                },
            } as any,
        });

        expect(supabase.rpc).toHaveBeenCalledWith('nominate_club_book', expect.objectContaining({
            p_club_id: 'club-books',
            p_google_books_id: 'google-book-2',
            p_title: 'Parable of the Sower',
            p_authors: ['Octavia Butler'],
            p_cover_url: 'https://books.example/parable-thumb.jpg',
        }));
        expect(result.id).toBe('nomination-2');
    });

    it('casts and removes a club book vote through the live rpc contract', async () => {
        (supabase.rpc as jest.Mock)
            .mockResolvedValueOnce({ data: { nomination_id: 'nomination-3', user_id: 'user-voter', created_at: '2026-03-09T03:00:00Z' }, error: null })
            .mockResolvedValueOnce({ data: null, error: null });

        const vote = await clubsService.castClubBookVote('nomination-3');
        await clubsService.removeClubBookVote('nomination-3');

        expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'cast_club_book_vote', { p_nomination_id: 'nomination-3' });
        expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'remove_club_book_vote', { p_nomination_id: 'nomination-3' });
        expect(vote.user_id).toBe('user-voter');
    });

    it('finalizes a club book nomination into the clubs current book via rpc', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: {
                id: 'club-books',
                name: 'Spec Readers',
                description: null,
                cover_url: null,
                club_type: 'approval',
                access_level: 'all',
                current_book_id: 'book-9',
                admin_id: 'user-admin',
                member_count: 9,
                max_members: null,
                is_archived: false,
                created_at: null,
                updated_at: '2026-03-09T04:00:00Z',
                meeting_type: 'hybrid',
                archived_at: null,
                author_id: null,
            },
            error: null,
        });

        const result = await clubsService.finalizeClubBookNomination('nomination-9');

        expect(supabase.rpc).toHaveBeenCalledWith('finalize_club_book_nomination', { p_nomination_id: 'nomination-9' });
        expect(result.current_book_id).toBe('book-9');
    });
});
