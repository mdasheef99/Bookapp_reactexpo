import { supabase } from '@/lib/supabase';
import {
    getCachedSearchResults,
    setCachedSearchResults,
} from './booksSearchCache';

const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_SEARCH_API_URL = 'https://openlibrary.org/search.json';

export interface GoogleBook {
    id: string;
    volumeInfo: {
        title: string;
        subtitle?: string;
        authors?: string[];
        description?: string;
        imageLinks?: {
            thumbnail?: string;
            smallThumbnail?: string;
        };
        pageCount?: number;
        categories?: string[];
        industryIdentifiers?: { type: string; identifier: string }[];
        publisher?: string;
        publishedDate?: string;
        averageRating?: number;
        ratingsCount?: number;
        language?: string;
        previewLink?: string;
        infoLink?: string;
    };
    saleInfo?: {
        saleability: string;
        retailPrice?: {
            amount: number;
            currencyCode: string;
        };
        buyLink?: string;
    };
}

export interface SearchFilters {
    genre?: string;
    language?: string;
    priceType?: 'all' | 'free' | 'paid';
}

export interface PaginatedResult {
    items: GoogleBook[];
    totalItems: number;
    hasMore: boolean;
    nextStartIndex?: number;
    providerUsed?: 'google' | 'openLibrary';
    fallbackUsed?: boolean;
    totalItemsExact?: boolean;
    unsupportedFilters?: Array<keyof SearchFilters>;
}

export interface ManualBookInput {
    title: string;
    author?: string;
}

export interface PublicBookReview {
    user_book_id: string;
    book_id: string;
    rating: number | null;
    review: string;
    created_at: string | null;
    author: {
        user_id: string;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
    };
}

type LibraryOwnership = 'owned' | 'borrowed' | 'lent_out' | 'wishlist';

type UserLibraryQueryOptions = {
    excludeOwnership?: LibraryOwnership[];
};

type PublicBookReviewRow = {
    user_book_id: string;
    book_id: string;
    rating: number | null;
    review: string;
    created_at: string | null;
    author_user_id: string;
    author_display_name: string | null;
    author_username: string | null;
    author_avatar_url: string | null;
};

type OpenLibrarySearchDoc = {
    key?: string;
    title?: string;
    author_name?: string[];
    first_publish_year?: number;
    isbn?: string[];
    cover_i?: number;
    edition_key?: string[];
    subject?: string[];
    language?: string[];
    editions?: {
        docs?: OpenLibraryEditionDoc[];
    };
};

type OpenLibraryEditionDoc = {
    key?: string;
    title?: string;
    subtitle?: string;
    language?: string[];
    isbn_10?: string[];
    isbn_13?: string[];
    isbn?: string[];
    cover_i?: number;
    publish_date?: string[];
    publisher?: string[];
    number_of_pages?: number;
};

type OpenLibrarySearchResponse = {
    start?: number;
    numFound?: number;
    num_found?: number;
    numFoundExact?: boolean;
    num_found_exact?: boolean;
    docs?: OpenLibrarySearchDoc[];
};

const OPEN_LIBRARY_LANGUAGE_CODES: Record<string, string> = {
    en: 'eng',
    hi: 'hin',
    es: 'spa',
    fr: 'fre',
    de: 'ger',
};

export const getHighResCoverUrl = (url?: string): string | null => {
    if (!url) return null;
    let secureUrl = url.replace(/^http:\/\//i, 'https://');
    secureUrl = secureUrl.replace('&zoom=1', '&zoom=0');
    return secureUrl;
};

// Build query string with filters
const buildSearchQuery = (query: string, filters?: SearchFilters): string => {
    let searchQuery = query;

    if (filters?.genre && filters.genre !== 'all') {
        searchQuery += `+subject:${encodeURIComponent(filters.genre)}`;
    }

    return searchQuery;
};

const getIsbnIdentifiers = (isbns?: string[]) => {
    const cleanIsbns = (isbns || [])
        .map((isbn) => isbn.replace(/[-\s]/g, ''))
        .filter(Boolean);
    const isbn13 = cleanIsbns.find((isbn) => isbn.length === 13);
    const isbn10 = cleanIsbns.find((isbn) => isbn.length === 10);

    return [
        isbn10 ? { type: 'ISBN_10', identifier: isbn10 } : null,
        isbn13 ? { type: 'ISBN_13', identifier: isbn13 } : null,
    ].filter(Boolean) as { type: string; identifier: string }[];
};

const getOpenLibraryCoverUrl = (doc: OpenLibrarySearchDoc, edition?: OpenLibraryEditionDoc): string | undefined => {
    const coverId = edition ? edition.cover_i : doc.cover_i;
    if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;

    const cleanIsbns = edition
        ? [...(edition.isbn_13 ?? []), ...(edition.isbn_10 ?? []), ...(edition.isbn ?? [])]
        : (doc.isbn ?? []);
    const cleanCandidates = cleanIsbns
        .map((isbn) => isbn.replace(/[-\s]/g, ''))
        .filter(Boolean);
    const isbn = cleanCandidates.find((value) => value.length === 13)
        || cleanCandidates.find((value) => value.length === 10);

    return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : undefined;
};

const getOpenLibraryInfoLink = (key?: string): string | undefined => {
    if (!key) return undefined;
    return `https://openlibrary.org${key.startsWith('/') ? key : `/${key}`}`;
};

const mapOpenLibraryDocToGoogleBook = (doc: OpenLibrarySearchDoc, requiredLanguage?: string): GoogleBook | null => {
    if (!doc.title) return null;

    const editions = doc.editions?.docs ?? [];
    const selectedEdition = requiredLanguage
        ? editions.find((edition) => edition.language?.includes(requiredLanguage))
        : editions[0];
    const workMatchesRequiredLanguage = Boolean(
        requiredLanguage && doc.language?.includes(requiredLanguage),
    );
    // If the provider omits nested editions, retain a work only when its own
    // language confirms the filter. Never borrow an arbitrary edition key or
    // work-aggregated ISBN/cover/date as if it described the requested edition.
    if (requiredLanguage && !selectedEdition && !workMatchesRequiredLanguage) return null;
    const workLevelLanguageFallback = Boolean(requiredLanguage && !selectedEdition);

    const providerId = selectedEdition?.key
        || (!requiredLanguage ? doc.edition_key?.[0] : undefined)
        || doc.key
        || doc.title;
    const coverUrl = workLevelLanguageFallback ? undefined : getOpenLibraryCoverUrl(doc, selectedEdition);
    const industryIdentifiers = getIsbnIdentifiers([
        ...(selectedEdition?.isbn_13 ?? []),
        ...(selectedEdition?.isbn_10 ?? []),
        ...(selectedEdition?.isbn ?? []),
        ...(!selectedEdition && !requiredLanguage ? (doc.isbn ?? []) : []),
    ]);
    const publishedDate = selectedEdition
        ? selectedEdition.publish_date?.[0]
        : (!requiredLanguage && doc.first_publish_year ? String(doc.first_publish_year) : undefined);
    const displayedLanguage = selectedEdition?.language?.find((language) => language === requiredLanguage)
        || selectedEdition?.language?.[0]
        || doc.language?.find((language) => language === requiredLanguage)
        || doc.language?.[0];

    return {
        id: `open-library:${providerId.replace(/^\/(?:books|works)\//, '').replace(/^\//, '')}`,
        volumeInfo: {
            title: selectedEdition?.title || doc.title,
            subtitle: selectedEdition?.subtitle,
            authors: doc.author_name,
            imageLinks: coverUrl ? { thumbnail: coverUrl, smallThumbnail: coverUrl } : undefined,
            categories: doc.subject?.slice(0, 3),
            publishedDate,
            publisher: selectedEdition?.publisher?.[0],
            pageCount: selectedEdition?.number_of_pages,
            industryIdentifiers: industryIdentifiers.length > 0 ? industryIdentifiers : undefined,
            language: displayedLanguage,
            previewLink: getOpenLibraryInfoLink(selectedEdition?.key || doc.key),
            infoLink: getOpenLibraryInfoLink(selectedEdition?.key || doc.key),
        },
        saleInfo: {
            saleability: 'NOT_FOR_SALE',
        },
    };
};

const searchOpenLibraryBooks = async (
    query: string,
    startIndex: number,
    maxResults: number,
    filters?: SearchFilters,
): Promise<PaginatedResult> => {
    const searchTerms = [query.trim()];
    if (filters?.genre && filters.genre !== 'all') {
        const genre = filters.genre.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        searchTerms.push(`subject:"${genre}"`);
    }

    const language = filters?.language && filters.language !== 'all'
        ? OPEN_LIBRARY_LANGUAGE_CODES[filters.language]
        : undefined;
    const unsupportedFilters: Array<keyof SearchFilters> = [];
    if (filters?.language && filters.language !== 'all' && !language) {
        unsupportedFilters.push('language');
    }
    if (filters?.priceType && filters.priceType !== 'all') {
        unsupportedFilters.push('priceType');
    }
    if (language) searchTerms.push(`language:${language}`);

    const params = new URLSearchParams({
        q: searchTerms.join(' '),
        offset: String(startIndex),
        limit: String(maxResults),
        fields: [
            'key',
            'title',
            'author_name',
            'first_publish_year',
            'isbn',
            'cover_i',
            'edition_key',
            'subject',
            'language',
            'editions',
            'editions.key',
            'editions.title',
            'editions.subtitle',
            'editions.language',
            'editions.isbn_10',
            'editions.isbn_13',
            'editions.isbn',
            'editions.cover_i',
            'editions.publish_date',
            'editions.publisher',
            'editions.number_of_pages',
        ].join(','),
    });
    const response = await fetch(`${OPEN_LIBRARY_SEARCH_API_URL}?${params.toString()}`);

    if (!response?.ok) {
        throw new Error(`Open Library API error: ${response?.status ?? 'unknown'}`);
    }

    const data: OpenLibrarySearchResponse = await response.json();
    const providerDocs = data.docs || [];
    const items = providerDocs
        .map((doc) => mapOpenLibraryDocToGoogleBook(doc, language))
        .filter(Boolean) as GoogleBook[];
    const totalItems = data.numFound ?? data.num_found ?? items.length;
    const exactCount = data.numFoundExact ?? data.num_found_exact ?? false;
    const nextStartIndex = startIndex + providerDocs.length;

    return {
        items,
        totalItems,
        hasMore: providerDocs.length > 0 && nextStartIndex < totalItems,
        nextStartIndex,
        providerUsed: 'openLibrary',
        totalItemsExact: exactCount,
        unsupportedFilters,
    };
};

const collectSearchSuggestion = (suggestions: string[], seen: Set<string>, value?: string) => {
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    suggestions.push(value);
};

const getOpenLibrarySearchSuggestions = async (partialQuery: string): Promise<string[]> => {
    const params = new URLSearchParams({
        q: partialQuery,
        limit: '5',
        fields: 'title,author_name',
    });
    const response = await fetch(`${OPEN_LIBRARY_SEARCH_API_URL}?${params.toString()}`);

    if (!response?.ok) {
        throw new Error(`Open Library suggestions error: ${response?.status ?? 'unknown'}`);
    }

    const data: OpenLibrarySearchResponse = await response.json();
    const suggestions: string[] = [];
    const seen = new Set<string>();

    (data.docs || []).forEach((doc) => {
        collectSearchSuggestion(suggestions, seen, doc.title);
        collectSearchSuggestion(suggestions, seen, doc.author_name?.[0]);
    });

    return suggestions.slice(0, 8);
};

const normalizeManualBookInput = (input: ManualBookInput) => {
    const title = input.title.trim();
    const author = input.author?.trim();

    return {
        title,
        authors: author ? [author] : null,
    };
};

const mapPublicBookReview = (row: PublicBookReviewRow): PublicBookReview => ({
    user_book_id: row.user_book_id,
    book_id: row.book_id,
    rating: row.rating,
    review: row.review,
    created_at: row.created_at,
    author: {
        user_id: row.author_user_id,
        display_name: row.author_display_name,
        username: row.author_username,
        avatar_url: row.author_avatar_url,
    },
});

const buildBookRecordPayload = (googleBook: GoogleBook) => ({
    google_books_id: googleBook.id,
    title: googleBook.volumeInfo.title,
    subtitle: googleBook.volumeInfo.subtitle,
    authors: googleBook.volumeInfo.authors,
    cover_url: getHighResCoverUrl(googleBook.volumeInfo.imageLinks?.thumbnail),
    description: googleBook.volumeInfo.description,
    page_count: googleBook.volumeInfo.pageCount,
    categories: googleBook.volumeInfo.categories,
    publisher: googleBook.volumeInfo.publisher,
    published_date: googleBook.volumeInfo.publishedDate,
    average_rating: googleBook.volumeInfo.averageRating,
    ratings_count: googleBook.volumeInfo.ratingsCount,
    language: googleBook.volumeInfo.language,
    preview_link: googleBook.volumeInfo.previewLink,
    info_link: googleBook.volumeInfo.infoLink,
    retail_price: googleBook.saleInfo?.retailPrice?.amount,
    currency_code: googleBook.saleInfo?.retailPrice?.currencyCode,
    buy_link: googleBook.saleInfo?.buyLink,
    isbn_10: googleBook.volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier,
    isbn_13: googleBook.volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier,
});

const getStoredBookByGoogleBookId = async (googleBooksId: string) => {
    const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('google_books_id', googleBooksId)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const storeBookRecord = async (googleBook: GoogleBook) => {
    const existingBook = await getStoredBookByGoogleBookId(googleBook.id);
    if (existingBook) return existingBook;

    const { data: bookData, error: bookError } = await supabase
        .from('books')
        .insert(buildBookRecordPayload(googleBook))
        .select()
        .single();

    if (bookError) {
        if (bookError.code === '23505') {
            const duplicateBook = await getStoredBookByGoogleBookId(googleBook.id);
            if (duplicateBook) return duplicateBook;
        }
        throw bookError;
    }

    return bookData;
};

const getUserBookByBookId = async (userId: string, bookId: string) => {
    const { data, error } = await supabase
        .from('user_books')
        .select(`
            *,
            book:books(*)
        `)
        .eq('user_id', userId)
        .eq('book_id', bookId)
        .maybeSingle();

    if (error) throw error;
    return data;
};

/**
 * Search Google Books with an in-memory LRU cache (20 entries, 60s TTL).
 * On a fresh cache hit, results are returned immediately without a network call.
 * On a 429 rate-limit error, stale cached results (< 5 min) are returned as a
 * fallback with `fromCache: true` so the UI can show a "cached results" banner.
 * Pass the first page's provider for continuation pages to keep its cursor;
 * only an unpinned first-page request may choose the Open Library fallback.
 */
export async function searchGoogleBooksCached(
    query: string,
    startIndex: number = 0,
    maxResults: number = 20,
    filters?: SearchFilters,
    provider?: 'google' | 'openLibrary',
): Promise<PaginatedResult & { fromCache: boolean }> {
    const trimmed = query.trim();

    // Continuations keep the first page's provider and its offset semantics.
    if (provider === 'openLibrary') {
        return {
            ...await searchOpenLibraryBooks(trimmed, startIndex, maxResults, filters),
            fromCache: false,
            fallbackUsed: true,
        };
    }

    // Check cache first - key includes filters + pagination to avoid wrong results
    const cached = getCachedSearchResults(trimmed, filters as Record<string, unknown>, startIndex, maxResults);
    if (cached && !cached.isStale) {
        return {
            ...cached.page,
            fromCache: true,
            providerUsed: cached.page.providerUsed ?? 'google',
            fallbackUsed: false,
        };
    }

    try {
        const searchQuery = buildSearchQuery(query, filters);
        let url = `${GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(searchQuery)}&startIndex=${startIndex}&maxResults=${maxResults}`;

        if (filters?.language && filters.language !== 'all') {
            url += `&langRestrict=${filters.language}`;
        }

        if (filters?.priceType === 'free') {
            url += '&filter=free-ebooks';
        } else if (filters?.priceType === 'paid') {
            url += '&filter=paid-ebooks';
        }

        const response = await fetch(url);

        if (response.status === 429) {
            const error = Object.assign(new Error('Google Books API rate limit exceeded (429)'), { status: 429 });
            throw error;
        }
        if (!response.ok) {
            throw new Error(`Google Books API error: ${response.status}`);
        }

        const data = await response.json();
        const items = data.items || [];
        const totalItems = data.totalItems || 0;
        const hasMore = startIndex + items.length < totalItems;
        const nextStartIndex = startIndex + items.length;

        // Cache successful Google results - keyed by filters + pagination
        setCachedSearchResults(trimmed, {
            items,
            totalItems,
            hasMore,
            nextStartIndex,
            totalItemsExact: true,
            providerUsed: 'google',
        }, filters as Record<string, unknown>, startIndex, maxResults);

        return {
            items,
            totalItems,
            hasMore,
            nextStartIndex,
            fromCache: false,
            providerUsed: 'google',
            fallbackUsed: false,
        };
    } catch (error) {
        // On 429, try stale cache fallback
        if (cached?.isStale) {
            const e = error as any;
            if (e?.status === 429 || String(e?.message).includes('429')) {
                return {
                    ...cached.page,
                    fromCache: true,
                    providerUsed: 'google',
                    fallbackUsed: false,
                };
            }
        }

        if (provider === 'google') throw error;

        try {
            const openLibraryResult = await searchOpenLibraryBooks(trimmed, startIndex, maxResults, filters);
            return {
                ...openLibraryResult,
                fromCache: false,
                fallbackUsed: true,
            };
        } catch {
            throw error;
        }
    }
}

export const booksService = {
    // Paginated search with filters
    async searchGoogleBooks(
        query: string,
        startIndex: number = 0,
        maxResults: number = 20,
        filters?: SearchFilters
    ): Promise<PaginatedResult> {
        try {
            const searchQuery = buildSearchQuery(query, filters);
            let url = `${GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(searchQuery)}&startIndex=${startIndex}&maxResults=${maxResults}`;

            // Add language filter
            if (filters?.language && filters.language !== 'all') {
                url += `&langRestrict=${filters.language}`;
            }

            // Add price filter
            if (filters?.priceType === 'free') {
                url += '&filter=free-ebooks';
            } else if (filters?.priceType === 'paid') {
                url += '&filter=paid-ebooks';
            }

            const response = await fetch(url);
            const data = await response.json();

            const items = data.items || [];
            const totalItems = data.totalItems || 0;
            const nextStartIndex = startIndex + items.length;

            return {
                items,
                totalItems,
                hasMore: startIndex + items.length < totalItems,
                nextStartIndex,
            };
        } catch (error) {
            console.error('Error searching Google Books:', error);
            return { items: [], totalItems: 0, hasMore: false };
        }
    },

    searchGoogleBooksCached,

    // Get suggestions for autocomplete
    async getSearchSuggestions(partialQuery: string): Promise<string[]> {
        if (!partialQuery || partialQuery.length < 2) return [];

        try {
            const response = await fetch(
                `${GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(partialQuery)}&maxResults=5`
            );
            const data = await response.json();

            // Extract unique titles/authors as suggestions
            const suggestions: string[] = [];
            const seen = new Set<string>();

            (data.items || []).forEach((book: GoogleBook) => {
                collectSearchSuggestion(suggestions, seen, book.volumeInfo.title);
                collectSearchSuggestion(suggestions, seen, book.volumeInfo.authors?.[0]);
            });

            return suggestions.slice(0, 8);
        } catch (error) {
            try {
                return await getOpenLibrarySearchSuggestions(partialQuery);
            } catch {
                console.error('Error getting suggestions:', error);
            }

            return [];
        }
    },

    async addToLibrary(userId: string, googleBook: GoogleBook, status: string = 'want_to_read', ownership: LibraryOwnership = 'owned') {
        const bookData = await storeBookRecord(googleBook);
        const existingUserBook = await getUserBookByBookId(userId, bookData.id);

        if (existingUserBook) {
            if (existingUserBook.ownership === 'wishlist' && ownership !== 'wishlist') {
                await booksService.updateOwnership(existingUserBook.id, ownership);
                return bookData;
            }

            throw new Error(
                existingUserBook.ownership === 'wishlist'
                    ? 'This book is already in your wishlist.'
                    : 'This book is already in your library.'
            );
        }

        const { error: userBookError } = await supabase
            .from('user_books')
            .insert({
                user_id: userId,
                book_id: bookData.id,
                reading_status: status,
                ownership: ownership,
                condition: 'new',
                available_for_lending: false,
            });

        if (userBookError) {
            if (userBookError.code === '23505') {
                const duplicateUserBook = await getUserBookByBookId(userId, bookData.id);

                if (duplicateUserBook?.ownership === 'wishlist' && ownership !== 'wishlist') {
                    await booksService.updateOwnership(duplicateUserBook.id, ownership);
                    return bookData;
                }

                throw new Error(
                    duplicateUserBook?.ownership === 'wishlist'
                        ? 'This book is already in your wishlist.'
                        : 'This book is already in your library.'
                );
            }
            throw userBookError;
        }

        return bookData;
    },

    async addManualBookToLibrary(
        userId: string,
        input: ManualBookInput,
        status: string = 'want_to_read',
        ownership: LibraryOwnership = 'owned'
    ) {
        const normalizedInput = normalizeManualBookInput(input);

        if (!normalizedInput.title) {
            throw new Error('Title is required.');
        }

        const { data: bookData, error: bookError } = await supabase
            .from('books')
            .insert({
                title: normalizedInput.title,
                authors: normalizedInput.authors,
            })
            .select()
            .single();

        if (bookError) throw bookError;

        const { error: userBookError } = await supabase
            .from('user_books')
            .insert({
                user_id: userId,
                book_id: bookData.id,
                reading_status: status,
                ownership,
                condition: 'new',
                available_for_lending: false,
            });

        if (userBookError) throw userBookError;

        return bookData;
    },

    async getUserLibrary(userId: string, options?: UserLibraryQueryOptions) {
        let query = supabase
            .from('user_books')
            .select(`
                *,
                book:books(*)
            `)
            .eq('user_id', userId);

        options?.excludeOwnership?.forEach((excludedOwnership) => {
            query = query.neq('ownership', excludedOwnership);
        });

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getUserBookByGoogleBookId(userId: string, googleBooksId: string) {
        const { data: storedBook, error: storedBookError } = await supabase
            .from('books')
            .select('id')
            .eq('google_books_id', googleBooksId)
            .maybeSingle();

        if (storedBookError) throw storedBookError;
        if (!storedBook) return null;

        return getUserBookByBookId(userId, storedBook.id);
    },

    async getBookDetails(userBookId: string) {
        const { data, error } = await supabase
            .from('user_books')
            .select(`
                *,
                book:books(*)
            `)
            .eq('id', userBookId)
            .single();

        if (error) throw error;
        return data;
    },

    async getPublicReviewsForBook(bookId: string): Promise<PublicBookReview[]> {
        const { data, error } = await supabase.rpc('get_public_book_reviews', {
            p_book_id: bookId,
        });

        if (error) throw error;
        return ((data ?? []) as PublicBookReviewRow[]).map(mapPublicBookReview);
    },

    async updateReadingStatus(userBookId: string, status: 'want_to_read' | 'reading' | 'completed') {
        const updates: any = { reading_status: status };
        if (status === 'completed') {
            updates.completed_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('user_books')
            .update(updates)
            .eq('id', userBookId);

        if (error) throw error;
    },

    async updateOwnership(userBookId: string, ownership: LibraryOwnership) {
        const { error } = await supabase
            .from('user_books')
            .update({ ownership })
            .eq('id', userBookId);

        if (error) throw error;
    },

    async updateCondition(userBookId: string, condition: 'new' | 'like_new' | 'good' | 'acceptable' | 'poor') {
        const { error } = await supabase
            .from('user_books')
            .update({ condition })
            .eq('id', userBookId);

        if (error) throw error;
    },

    async toggleLendingAvailability(userBookId: string, available: boolean) {
        const { error } = await supabase
            .from('user_books')
            .update({ available_for_lending: available })
            .eq('id', userBookId);

        if (error) throw error;
    },

    async removeFromLibrary(userBookId: string) {
        const { error } = await supabase
            .from('user_books')
            .delete()
            .eq('id', userBookId);

        if (error) throw error;
    }
};
