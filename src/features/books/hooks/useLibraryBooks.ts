import { useQuery } from '@tanstack/react-query';
import { booksService } from '@/features/books/services/booksService';
import { LibraryBookEntry } from '@/features/books/utils/libraryShelf';

const LIBRARY_QUERY_TIMEOUT_MS = 8000;

function withLibraryTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Library request timed out. Pull to refresh or try again.'));
        }, LIBRARY_QUERY_TIMEOUT_MS);

        promise
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timeoutId));
    });
}

export function useLibraryBooks(userId?: string) {
    return useQuery<LibraryBookEntry[]>({
        queryKey: ['library', userId],
        queryFn: () => withLibraryTimeout(booksService.getUserLibrary(userId!) as Promise<LibraryBookEntry[]>),
        enabled: !!userId,
        retry: false,
    });
}
