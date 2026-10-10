jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import { fireEvent, render } from '@testing-library/react-native';
import { YourClubsCard } from '../YourClubsCard';
import type { ClubPublicDetails } from '../../services/clubsService';

function makeClub(overrides: Partial<ClubPublicDetails> = {}): ClubPublicDetails {
    return {
        id: 'club-2',
        name: 'The Bangalore Readers',
        description: 'A city-wide circle reading contemporary fiction.',
        cover_url: null,
        club_type: 'public',
        access_level: 'all',
        meeting_type: 'venue_based',
        member_count: 42,
        max_members: null,
        current_book_id: 'book-1',
        current_book_google_books_id: null,
        current_book_title: 'The God of Small Things',
        current_book_authors: ['Arundhati Roy'],
        current_book_cover_url: 'https://example.test/god-of-small-things.jpg',
        current_book_retail_price: null,
        current_book_currency_code: null,
        admin_id: 'admin-1',
        admin_profile_id: 'profile-1',
        admin_display_name: 'Meera K',
        admin_avatar_url: null,
        admin_city: 'Bengaluru',
        author_id: null,
        author_user_id: null,
        author_display_name: null,
        author_avatar_url: null,
        author_city: null,
        created_at: null,
        updated_at: null,
        ...overrides,
    };
}

describe('YourClubsCard', () => {
    it('renders the club with an embedded currently-reading module and taps to detail', () => {
        const onPress = jest.fn();
        const { getByTestId, getByText } = render(<YourClubsCard club={makeClub()} onPress={onPress} />);

        expect(getByText('The Bangalore Readers')).toBeOnTheScreen();
        expect(getByText('Currently reading')).toBeOnTheScreen();
        expect(getByText('The God of Small Things')).toBeOnTheScreen();
        expect(getByText('Arundhati Roy')).toBeOnTheScreen();
        expect(getByText('42 readers · In person · All members · Bengaluru')).toBeOnTheScreen();

        fireEvent.press(getByTestId('your-club-card-club-2'));
        expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: 'club-2' }));
    });

    it('shows the no-current-book treatment without inventing a book', () => {
        const { getByText, queryByText } = render(
            <YourClubsCard club={makeClub({ current_book_title: null, current_book_authors: null, current_book_cover_url: null })} onPress={jest.fn()} />,
        );

        expect(getByText('No current book set')).toBeOnTheScreen();
        expect(queryByText('Currently reading')).toBeNull();
    });

    it('keeps verified-author context for author clubs', () => {
        const { getByText } = render(
            <YourClubsCard
                club={makeClub({
                    club_type: 'author_club',
                    author_display_name: 'Anita Desai',
                    current_book_title: null,
                    current_book_authors: null,
                    current_book_cover_url: null,
                })}
                onPress={jest.fn()}
            />,
        );

        expect(getByText('Author club · Verified author')).toBeOnTheScreen();
        expect(getByText('Hosted by verified author Anita Desai')).toBeOnTheScreen();
    });

    it('exposes no per-row management or engagement actions', () => {
        const { queryByText } = render(<YourClubsCard club={makeClub()} onPress={jest.fn()} />);

        for (const label of ['Leave', 'Manage', 'Invite', 'RSVP', 'Vote', 'Admin', 'Moderator']) {
            expect(queryByText(label)).toBeNull();
        }
    });
});
