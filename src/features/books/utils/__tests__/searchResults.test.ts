import { sortSearchResults } from '../searchResults';
import type { GoogleBook } from '@/features/books/services/booksService';

const book = (title: string, publishedDate?: string): GoogleBook => ({
    id: title,
    volumeInfo: { title, publishedDate },
    saleInfo: { saleability: 'NOT_FOR_SALE' },
});

describe('sortSearchResults', () => {
    it('orders newest first by date value across provider display formats', () => {
        const books = [
            book('1981 title', 'Sep 08, 1981'),
            book('1989 title', 'May 1989'),
            book('2020 title', '2020-10-01'),
            book('2013 title', '29/03/2013'),
        ];

        expect(sortSearchResults(books, 'newest').map(({ volumeInfo }) => volumeInfo.title)).toEqual([
            '2020 title',
            '2013 title',
            '1989 title',
            '1981 title',
        ]);
    });

    it('places missing or unreadable dates last and preserves relevance order', () => {
        const books = [book('Unknown', 'not supplied'), book('Dated', '2002'), book('Missing')];

        expect(sortSearchResults(books, 'newest').map(({ volumeInfo }) => volumeInfo.title)).toEqual([
            'Dated',
            'Unknown',
            'Missing',
        ]);
        expect(sortSearchResults(books, 'relevance')).toBe(books);
    });
});
