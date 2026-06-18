import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260606142000_complete_clubs_notifications_and_reminders.sql',
);

describe('complete Clubs notification and reminder migration', () => {
    it('routes wishlist, club events, reading schedules, downgrade grace, and reminder notifications', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toContain('route_wishlist_listing_match_notification');
        expect(sql).toContain('route_club_event_notification');
        expect(sql).toContain('route_book_nomination_notification');
        expect(sql).toContain('route_reading_schedule_notification');
        expect(sql).toContain('route_club_downgrade_grace_notification');
        expect(sql).toContain('send_due_club_reminder_notifications');
        expect(sql).toContain('notification-push-dispatch');
        expect(sql).toContain('wishlist.listing_matched');
        expect(sql).toContain('club.voting_ending_soon');
        expect(sql).toContain('club.invitation_reminder');
        expect(sql).toContain('club.event_reminder');
        expect(sql).toContain('club.reading_milestone_due');
        expect(sql).toContain('membership.downgrade_grace_deadline_near');
    });
});
