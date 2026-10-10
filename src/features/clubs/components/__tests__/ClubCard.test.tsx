jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));

import { fireEvent, render } from '@testing-library/react-native';
import { ClubCard } from '../ClubCard';
import type { ClubPublicDetails } from '../../services/clubsService';

const club = {
    id: 'club-1',
    name: 'Midnight Classics & Curiosities',
    description: 'A quiet literary salon for classic fiction.',
    cover_url: null,
    club_type: 'invite_only',
    access_level: 'all',
    meeting_type: 'venue_based',
    member_count: 12,
    current_book_title: 'Frankenstein (1818 Text)',
    current_book_authors: ['Mary Shelley'],
    current_book_cover_url: null,
    admin_display_name: 'Julian Hayes',
    admin_avatar_url: null,
    admin_city: 'Oxford',
} as ClubPublicDetails;

describe('ClubCard', () => {
    it('keeps the approved card metadata readable and opens details from the card', () => {
        const onPress = jest.fn();
        const { getByText, getByRole } = render(<ClubCard club={club} onPress={onPress} />);

        expect(getByText('Invite only')).toBeOnTheScreen();
        expect(getByText('In-person venue')).toBeOnTheScreen();
        expect(getByText('12 members')).toBeOnTheScreen();
        expect(getByText('Frankenstein (1818 Text)')).toBeOnTheScreen();

        fireEvent.press(getByRole('button', { name: 'Open Midnight Classics & Curiosities' }));

        expect(onPress).toHaveBeenCalledWith(club);
    });
});
