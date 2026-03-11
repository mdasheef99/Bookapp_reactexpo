import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { GoogleBook } from '@/features/books/services/booksService';

interface WishlistItem {
    id: string;
    user_id: string;
    google_books_id: string;
    book_data: GoogleBook;
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
            const { data, error: fetchError } = await supabase
                .from('user_wishlist')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            setWishlist(data || []);
            setWishlistBookIds(new Set(data?.map(item => item.google_books_id) || []));
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
            const { error: insertError } = await supabase
                .from('user_wishlist')
                .insert({
                    user_id: userId,
                    google_books_id: book.id,
                    book_data: book,
                });

            if (insertError) {
                if (insertError.code === '23505') {
                    setError('Book already in wishlist');
                    return false;
                }
                throw insertError;
            }

            // Optimistic update
            setWishlistBookIds(prev => new Set([...prev, book.id]));
            await fetchWishlist(); // Refresh to get full data
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
            const { error: deleteError } = await supabase
                .from('user_wishlist')
                .delete()
                .eq('user_id', userId)
                .eq('google_books_id', googleBooksId);

            if (deleteError) throw deleteError;

            // Optimistic update
            setWishlistBookIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(googleBooksId);
                return newSet;
            });
            await fetchWishlist(); // Refresh
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
