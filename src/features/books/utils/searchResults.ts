import type { GoogleBook } from '@/features/books/services/booksService';
import type { SortOption } from '@/lib/constants';

const parsePublishedDate = (publishedDate?: string): number | null => {
    const value = publishedDate?.trim();
    if (!value) return null;

    // Handle ISO and year/month precision without depending on local timezone.
    const isoParts = value.match(/^(\d{4})(?:[-/](\d{1,2})(?:[-/](\d{1,2}))?)?$/);
    if (isoParts) {
        const year = Number(isoParts[1]);
        const month = Number(isoParts[2] ?? 1);
        const day = Number(isoParts[3] ?? 1);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return Date.UTC(year, month - 1, day);
    }

    // Open Library can return day/month/year strings; Date.parse is runtime-locale
    // dependent for those, so recognize the unambiguous day-first form explicitly.
    const dayFirstParts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dayFirstParts && Number(dayFirstParts[1]) > 12) {
        const day = Number(dayFirstParts[1]);
        const month = Number(dayFirstParts[2]);
        const year = Number(dayFirstParts[3]);
        if (month < 1 || month > 12 || day > 31) return null;
        return Date.UTC(year, month - 1, day);
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;

    // Keep an unknown but year-bearing provider date sortable at year precision.
    const year = value.match(/\b(?:1[0-9]{3}|2[0-9]{3})\b/);
    return year ? Date.UTC(Number(year[0]), 0, 1) : null;
};

export const sortSearchResults = (results: GoogleBook[], sortBy: SortOption): GoogleBook[] => {
    if (sortBy === 'relevance') return results;

    return [...results].sort((a, b) => {
        switch (sortBy) {
            case 'rating':
                return (b.volumeInfo.averageRating || 0) - (a.volumeInfo.averageRating || 0);
            case 'newest': {
                const aDate = parsePublishedDate(a.volumeInfo.publishedDate);
                const bDate = parsePublishedDate(b.volumeInfo.publishedDate);
                if (aDate === null) return bDate === null ? 0 : 1;
                if (bDate === null) return -1;
                return bDate - aDate;
            }
            case 'title':
                return a.volumeInfo.title.localeCompare(b.volumeInfo.title);
            default:
                return 0;
        }
    });
};
