import { useState, useEffect, useCallback } from 'react';
import { booksService, GoogleBook } from '@/features/books/services/booksService';

interface WishlistItem {
    id: string;
    user_id: string;
    ownership: 'wishlist';
    book?: {
        google_books_id?: string;
        [key: string]: unknown;
    } | null;
    created_at: string;
}

export const useWishlist = (userId?: string) => {
    const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
    const [wishlistBookIds, setWishlistBookIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch wishlist from Supabase
    const fetchWishlist = useCallback(async () => {
        if (!userId) return;

        setLoading(true);
        setError(null);

        try {
            const library = await booksService.getUserLibrary(userId);
            const wishlistData = (library || []).filter((item: any) => item.ownership === 'wishlist') as WishlistItem[];

            setWishlist(wishlistData);
            setWishlistBookIds(new Set(
                wishlistData
                    .map(item => item.book?.google_books_id)
                    .filter((googleBooksId): googleBooksId is string => Boolean(googleBooksId))
            ));
        } catch (err: any) {
            setError(err.message || 'Failed to fetch wishlist');
            console.error('Wishlist fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    // Load wishlist on mount
    useEffect(() => {
        fetchWishlist();
    }, [fetchWishlist]);

    // Add book to wishlist
    const addToWishlist = useCallback(async (book: GoogleBook) => {
        if (!userId) {
            setError('User not authenticated');
            return false;
        }

        try {
            setError(null);

            const existingUserBook = await booksService.getUserBookByGoogleBookId(userId, book.id);

            if (existingUserBook) {
                setError(existingUserBook.ownership === 'wishlist'
                    ? 'Book already in wishlist'
                    : 'Book already in your library');
                return false;
            }

            await booksService.addToLibrary(userId, book, 'want_to_read', 'wishlist');
            await fetchWishlist();
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to add to wishlist');
            console.error('Add to wishlist error:', err);
            return false;
        }
    }, [userId, fetchWishlist]);

    // Remove book from wishlist
    const removeFromWishlist = useCallback(async (googleBooksId: string) => {
        if (!userId) {
            setError('User not authenticated');
            return false;
        }

        try {
            setError(null);

            const existingUserBook = await booksService.getUserBookByGoogleBookId(userId, googleBooksId);

            if (!existingUserBook || existingUserBook.ownership !== 'wishlist') {
                await fetchWishlist();
                return true;
            }

            await booksService.removeFromLibrary(existingUserBook.id);
            await fetchWishlist();
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to remove from wishlist');
            console.error('Remove from wishlist error:', err);
            return false;
        }
    }, [userId, fetchWishlist]);

    // Toggle wishlist status
    const toggleWishlist = useCallback(async (book: GoogleBook) => {
        const isInWishlist = wishlistBookIds.has(book.id);

        if (isInWishlist) {
            return await removeFromWishlist(book.id);
        } else {
            return await addToWishlist(book);
        }
    }, [wishlistBookIds, addToWishlist, removeFromWishlist]);

    // Check if book is in wishlist
    const isInWishlist = useCallback((googleBooksId: string) => {
        return wishlistBookIds.has(googleBooksId);
    }, [wishlistBookIds]);

    return {
        wishlist,
        wishlistBookIds,
        loading,
        error,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        refreshWishlist: fetchWishlist,
    };
};
