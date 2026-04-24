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

beforeEach(() => { jest.clearAllMocks(); });

describe('clubsService', () => {
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
        expect(result[0].replies[0].reactions).toEqual([{ emoji: '🔥', count: 1, viewerReacted: true }]);
    });

    it('reads public club browse results from club_public_details', async () => {
        const publicBuilder = mockQuery({ data: [{ id: 'club-1', name: 'Open Readers', club_type: 'public', current_book_title: 'Dune' }], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(publicBuilder);

        const result = await clubsService.getPublicClubs({ clubType: 'public', meetingType: 'hybrid', accessLevel: 'pro', search: 'Dune' });

        expect(supabase.from).toHaveBeenCalledWith('club_public_details');
        expect(publicBuilder.eq).toHaveBeenCalledWith('club_type', 'public');
        expect(publicBuilder.eq).toHaveBeenCalledWith('meeting_type', 'hybrid');
        expect(publicBuilder.eq).toHaveBeenCalledWith('access_level', 'pro');
        expect(publicBuilder.or).toHaveBeenCalledWith('name.ilike.%Dune%,current_book_title.ilike.%Dune%,admin_display_name.ilike.%Dune%,author_display_name.ilike.%Dune%');
        expect(result[0].name).toBe('Open Readers');
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
        expect(detailBuilder.eq).toHaveBeenCalledWith('id', 'club-7');
        expect(result.id).toBe('club-7');
    });

    it('checks membership limits through the edge function', async () => {
        (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({ data: { allowed: true, current_count: 1, max_allowed: 5, tier: 'pro' }, error: null });
        const result = await clubsService.checkMembershipLimits('user-1');
        expect(supabase.functions.invoke).toHaveBeenCalledWith('check-membership-limits', { body: { user_id: 'user-1', action: 'create_club' } });
        expect(result.allowed).toBe(true);
        expect(result.tier).toBe('pro');
    });

    it('creates a club after limit check and inserts the admin membership', async () => {
        (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({ data: { allowed: true, current_count: 0, max_allowed: 5, tier: 'pro' }, error: null });
        const insertClubBuilder = mockQuery({ data: { id: 'club-1' }, error: null });
        const insertMemberBuilder = mockQuery({ data: null, error: null });
        const detailBuilder = mockQuery({
            data: {
                id: 'club-1', name: 'Founders Club', description: null, cover_url: null, club_type: 'public', access_level: 'all', current_book_id: null,
                admin_id: 'user-1', member_count: 1, max_members: null, is_archived: false, created_at: null, updated_at: null, meeting_type: null,
                archived_at: null, author_id: null, current_book: null,
            },
            error: null,
        });
        (supabase.from as jest.Mock)
            .mockReturnValueOnce(insertClubBuilder)
            .mockReturnValueOnce(insertMemberBuilder)
            .mockReturnValueOnce(detailBuilder);
        (profileService.getProfileSummary as jest.Mock).mockResolvedValueOnce(null);

        const result = await clubsService.createClub({ name: ' Founders Club ', club_type: 'public', admin_id: 'user-1' });

        expect(insertClubBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Founders Club', admin_id: 'user-1' }));
        expect(insertMemberBuilder.insert).toHaveBeenCalledWith({ club_id: 'club-1', user_id: 'user-1', role: 'admin', status: 'active' });
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
        expect(applicationsBuilder.eq).toHaveBeenNthCalledWith(1, 'club_id', 'club-10');
        expect(applicationsBuilder.eq).toHaveBeenNthCalledWith(2, 'status', 'pending');
        expect(profileService.getProfileSummaries).toHaveBeenCalledWith(['user-10']);
        expect(result[0].applicantProfile?.display_name).toBe('Applicant Reader');
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

        expect(questionBuilder.insert).toHaveBeenCalledWith({ club_id: 'club-11', question: 'What do you hope to discuss?', is_required: true, order_index: 2 });
        expect(result.id).toBe('question-11');
    });

    it('updates a join question for admin management', async () => {
        const questionBuilder = mockQuery({ data: { id: 'question-12', club_id: 'club-12', question: 'Updated question', is_required: false, order_index: 1 }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(questionBuilder);

        const result = await clubsService.updateJoinQuestion('question-12', { question: 'Updated question', isRequired: false });

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
        expect(invitationBuilder.eq).toHaveBeenNthCalledWith(1, 'club_id', 'club-16');
        expect(invitationBuilder.eq).toHaveBeenNthCalledWith(2, 'invitee_user_id', 'user-invitee');
        expect(invitationBuilder.eq).toHaveBeenNthCalledWith(3, 'status', 'pending');
        expect(result?.inviterProfile?.display_name).toBe('Admin Reader');
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

    it('maps member profile summaries onto club members', async () => {
        const membersBuilder = mockQuery({ data: [{ id: 'member-1', club_id: 'club-1', user_id: 'user-1', role: 'member', status: 'active', joined_at: null }], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(membersBuilder);
        (profileService.getProfileSummaries as jest.Mock).mockResolvedValueOnce([{ id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', avatar_url: null, trust_score: 4.8, city: 'Bangalore' }]);
        const result = await clubsService.getClubMembers('club-1');
        expect(supabase.from).toHaveBeenCalledWith('club_members');
        expect(profileService.getProfileSummaries).toHaveBeenCalledWith(['user-1']);
        expect(result[0].profile?.display_name).toBe('Reader One');
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
