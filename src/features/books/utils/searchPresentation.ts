import type { SearchFilters } from '@/features/books/services/booksService';

export function countActiveFilters(filters: SearchFilters): number {
    return [
        filters.genre && filters.genre !== 'all',
        filters.language && filters.language !== 'all',
        filters.priceType && filters.priceType !== 'all',
    ].filter(Boolean).length;
}

export function searchProviderNotice(unsupported: Array<keyof SearchFilters>): string {
    return unsupported.includes('priceType')
        ? 'Showing results from Open Library. It does not provide book pricing, so the Free/Paid filter was not applied.'
        : unsupported.length > 0
            ? `Showing Open Library results. It cannot apply the ${unsupported.join(' and ')} filter${unsupported.length === 1 ? '' : 's'}.`
            : 'Showing results from Open Library while Google Books is unavailable.';
}

export function searchResultsCountLabel(args: {
    resultsLength: number;
    totalItems: number;
    totalItemsExact: boolean;
    fallbackFiltersNotApplied: boolean;
}): string {
    if (args.fallbackFiltersNotApplied) {
        return `${args.resultsLength} shown`;
    }
    const displayedResultCount = args.totalItems > 0 ? args.totalItems : args.resultsLength;
    return `${args.totalItemsExact ? '' : 'About '}${displayedResultCount.toLocaleString()} ${displayedResultCount === 1 ? 'result' : 'results'}`;
}

export const getSearchSignature = (searchQuery: string, filters: SearchFilters) =>
    JSON.stringify([searchQuery.trim(), filters]);
