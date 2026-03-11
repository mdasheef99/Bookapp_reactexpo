import { supabase } from '@/lib/supabase';

const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';

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
}

const getHighResCoverUrl = (url?: string): string | null => {
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

            return {
                items,
                totalItems,
                hasMore: startIndex + items.length < totalItems,
            };
        } catch (error) {
            console.error('Error searching Google Books:', error);
            return { items: [], totalItems: 0, hasMore: false };
        }
    },

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
                const title = book.volumeInfo.title;
                if (title && !seen.has(title.toLowerCase())) {
                    seen.add(title.toLowerCase());
                    suggestions.push(title);
                }

                const author = book.volumeInfo.authors?.[0];
                if (author && !seen.has(author.toLowerCase())) {
                    seen.add(author.toLowerCase());
                    suggestions.push(author);
                }
            });

            return suggestions.slice(0, 8);
        } catch (error) {
            console.error('Error getting suggestions:', error);
            return [];
        }
    },

    async addToLibrary(userId: string, googleBook: GoogleBook, status: string = 'want_to_read', ownership: string = 'owned') {
        const { data: bookData, error: bookError } = await supabase
            .from('books')
            .upsert({
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
            }, { onConflict: 'google_books_id' })
            .select()
            .single();

        if (bookError) throw bookError;

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
                throw new Error('This book is already in your library.');
            }
            throw userBookError;
        }

        return bookData;
    },

    async getUserLibrary(userId: string) {
        const { data, error } = await supabase
            .from('user_books')
            .select(`
                *,
                book:books(*)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
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

    async updateOwnership(userBookId: string, ownership: 'owned' | 'borrowed' | 'lent_out' | 'wishlist') {
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

    async addRating(userBookId: string, rating: number, review?: string, isPublic: boolean = true) {
        const { error } = await supabase
            .from('user_books')
            .update({
                rating,
                review,
                review_is_public: isPublic
            })
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
