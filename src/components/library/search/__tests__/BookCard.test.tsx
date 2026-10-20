import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BookCard } from '../BookCard';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Medium: 'Medium' } }));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        bgCard: '#fff', border: '#ccc', accent: '#123', shadow: '#000', bgSecondary: '#eee',
        textPrimary: '#111', textSecondary: '#444', textTertiary: '#666',
    } }),
}));
jest.mock('../RatingStars', () => ({ RatingStars: () => null }));
jest.mock('../PriceBadge', () => ({ PriceBadge: () => null }));
jest.mock('../GenreTag', () => ({ GenreTag: () => null }));
jest.mock('../InLibraryBadge', () => ({ InLibraryBadge: () => null }));

describe('BookCard result action accessibility', () => {
    it('names the title-specific add, wishlist, preview, and share buttons', () => {
        const screen = render(
            <BookCard
                book={{ id: 'book-1', volumeInfo: { title: 'A Test Book', previewLink: 'https://example.test/book' } }}
                index={0}
                isInLibrary={false}
                isAdding={false}
                isInWishlist={false}
                isTogglingWishlist={false}
                onAdd={jest.fn()}
                onWishlistToggle={jest.fn()}
                onPreview={jest.fn()}
                onShare={jest.fn()}
            />,
        );

        for (const label of [
            'Add A Test Book to library',
            'Add A Test Book to wishlist',
            'Preview A Test Book',
            'Share A Test Book',
        ]) {
            expect(screen.getByLabelText(label).props.accessibilityRole).toBe('button');
        }

        fireEvent.press(screen.getByLabelText('Add A Test Book to wishlist'));
    });

    it('reveals only provider-returned record details on demand', () => {
        const screen = render(
            <BookCard
                book={{
                    id: 'edition-record-1',
                    volumeInfo: {
                        title: 'A Test Book',
                        publisher: 'Example Press',
                        publishedDate: '2024-03-01',
                        pageCount: 320,
                        language: 'en',
                        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780000000001' }],
                    },
                }}
                index={0}
                isInLibrary={false}
                isAdding={false}
                isInWishlist={false}
                isTogglingWishlist={false}
                onAdd={jest.fn()}
                onWishlistToggle={jest.fn()}
                onPreview={jest.fn()}
                onShare={jest.fn()}
            />,
        );

        const detailsToggle = screen.getByLabelText('Show record details for A Test Book');
        expect(detailsToggle.props.accessibilityState.expanded).toBe(false);
        expect(screen.queryByText('Example Press')).toBeNull();

        fireEvent.press(detailsToggle);

        expect(screen.getByLabelText('Hide record details for A Test Book').props.accessibilityState.expanded).toBe(true);
        expect(screen.getByText('Example Press')).toBeOnTheScreen();
        expect(screen.getByText('9780000000001')).toBeOnTheScreen();
        expect(screen.getByText(/other editions may appear as separate results/i)).toBeOnTheScreen();
    });
});
