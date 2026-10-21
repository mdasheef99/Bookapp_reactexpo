import {
    countActiveFilters,
    getSearchSignature,
    searchProviderNotice,
    searchResultsCountLabel,
} from '../searchPresentation';

describe('countActiveFilters', () => {
    it('returns 0 when no filters are set', () => {
        expect(countActiveFilters({})).toBe(0);
    });

    it("ignores 'all' values", () => {
        expect(countActiveFilters({ genre: 'all', language: 'all', priceType: 'all' })).toBe(0);
    });

    it('counts a single active filter', () => {
        expect(countActiveFilters({ genre: 'fiction' })).toBe(1);
    });

    it('counts two active filters', () => {
        expect(countActiveFilters({ genre: 'fiction', language: 'en' })).toBe(2);
    });

    it('counts three active filters', () => {
        expect(countActiveFilters({ genre: 'fiction', language: 'en', priceType: 'free' })).toBe(3);
    });
});

describe('searchProviderNotice', () => {
    it('explains the default fallback when nothing is unsupported', () => {
        expect(searchProviderNotice([])).toBe('Showing results from Open Library while Google Books is unavailable.');
    });

    it('explains pricing is unavailable for priceType', () => {
        expect(searchProviderNotice(['priceType'])).toBe(
            'Showing results from Open Library. It does not provide book pricing, so the Free/Paid filter was not applied.',
        );
    });

    it('names a single unsupported filter', () => {
        expect(searchProviderNotice(['language'])).toBe(
            'Showing Open Library results. It cannot apply the language filter.',
        );
    });

    it('names two unsupported filters with plural', () => {
        expect(searchProviderNotice(['genre', 'language'])).toBe(
            'Showing Open Library results. It cannot apply the genre and language filters.',
        );
    });
});

describe('searchResultsCountLabel', () => {
    it('uses the total when exact', () => {
        expect(
            searchResultsCountLabel({ resultsLength: 20, totalItems: 48254, totalItemsExact: true, fallbackFiltersNotApplied: false }),
        ).toBe('48,254 results');
    });

    it('prefixes About when the total is approximate', () => {
        expect(
            searchResultsCountLabel({ resultsLength: 20, totalItems: 48254, totalItemsExact: false, fallbackFiltersNotApplied: false }),
        ).toBe('About 48,254 results');
    });

    it('uses the singular result', () => {
        expect(
            searchResultsCountLabel({ resultsLength: 1, totalItems: 1, totalItemsExact: true, fallbackFiltersNotApplied: false }),
        ).toBe('1 result');
    });

    it('falls back to the page length when there is no total', () => {
        expect(
            searchResultsCountLabel({ resultsLength: 0, totalItems: 0, totalItemsExact: true, fallbackFiltersNotApplied: false }),
        ).toBe('0 results');
    });

    it('shows the page count when fallback filters were not applied', () => {
        expect(
            searchResultsCountLabel({ resultsLength: 1, totalItems: 48254, totalItemsExact: true, fallbackFiltersNotApplied: true }),
        ).toBe('1 shown');
    });
});

describe('getSearchSignature', () => {
    it('trims the query and includes filters', () => {
        expect(getSearchSignature('  Dune  ', {})).toBe(JSON.stringify(['Dune', {}]));
        expect(getSearchSignature('Dune', { genre: 'fiction' })).toBe(JSON.stringify(['Dune', { genre: 'fiction' }]));
    });
});
