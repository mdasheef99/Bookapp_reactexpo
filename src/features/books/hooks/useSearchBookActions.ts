import { useCallback, useState } from 'react';
import { Linking, Share } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { booksService, GoogleBook } from '@/features/books/services/booksService';
import { useBookFeedback } from '@/components/library/ui';
import { addBookErrorMessage, wishlistErrorMessage } from '@/features/books/utils/searchErrorCopy';

export function useSearchBookActions(args: {
    userId: string | undefined;
    libraryBookIds: Set<string>;
    wishlistBookIds: Set<string>;
    toggleWishlist: (book: GoogleBook) => Promise<boolean>;
    refreshWishlist: () => Promise<void>;
}): {
    addingId: string | null;
    wishlistTogglingId: string | null;
    handleAddBook: (book: GoogleBook) => Promise<void>;
    handlePreview: (previewLink?: string) => Promise<void>;
    handleShare: (book: GoogleBook) => Promise<void>;
    handleWishlistToggle: (book: GoogleBook) => Promise<void>;
} {
    const { userId, libraryBookIds, wishlistBookIds, toggleWishlist, refreshWishlist } = args;
    const { notify } = useBookFeedback();
    const queryClient = useQueryClient();
    const [addingId, setAddingId] = useState<string | null>(null);
    const [wishlistTogglingId, setWishlistTogglingId] = useState<string | null>(null);

    const handleAddBook = useCallback(async (book: GoogleBook) => {
        if (!userId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setAddingId(book.id);
        try {
            await booksService.addToLibrary(userId, book);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['library'] }),
                refreshWishlist(),
            ]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            notify({ kind: 'success', message: `"${book.volumeInfo.title}" is now in your library` });
        } catch (error) {
            if (__DEV__) console.warn('Add book failed', error);
            const message = addBookErrorMessage(error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            notify({ kind: 'error', message });
        } finally {
            setAddingId(null);
        }
    }, [userId, queryClient, refreshWishlist, notify]);

    const handlePreview = useCallback(async (previewLink?: string) => {
        if (!previewLink) {
            notify({ kind: 'info', message: 'Preview is not available for this book.' });
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Linking.openURL(previewLink);
        } catch (err) {
            notify({ kind: 'error', message: "Couldn't open the preview." });
        }
    }, [notify]);

    const handleShare = useCallback(async (book: GoogleBook) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Share.share({
                message: `Check out "${book.volumeInfo.title}" by ${book.volumeInfo.authors?.[0] || 'Unknown Author'}!\n\n${book.volumeInfo.infoLink || ''}`,
                title: book.volumeInfo.title,
            });
        } catch (err) { }
    }, []);

    const handleWishlistToggle = useCallback(async (book: GoogleBook) => {
        if (!userId) return;

        if (libraryBookIds.has(book.id) && !wishlistBookIds.has(book.id)) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            notify({ kind: 'info', message: 'This book is already in your library.' });
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setWishlistTogglingId(book.id);

        try {
            const success = await toggleWishlist(book);

            if (!success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                notify({ kind: 'error', message: wishlistErrorMessage(false) });
                return;
            }

            await queryClient.invalidateQueries({ queryKey: ['library'] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            if (__DEV__) console.warn('Wishlist update failed', error);
            const message = wishlistErrorMessage(error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            notify({ kind: 'error', message });
        } finally {
            setWishlistTogglingId(null);
        }
    }, [userId, libraryBookIds, wishlistBookIds, toggleWishlist, queryClient, notify]);

    return { addingId, wishlistTogglingId, handleAddBook, handlePreview, handleShare, handleWishlistToggle };
}
