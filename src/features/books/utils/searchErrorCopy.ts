const messageText = (error: unknown): string => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
    return '';
};

export function searchErrorMessage(error: unknown): string {
    const message = messageText(error);
    if (/\b429\b/.test(message)) return 'The book catalogues are busy. Try again in a minute.';
    if (/Network request failed|Failed to fetch|NetworkError|Load failed/i.test(message)) {
        return "Couldn't reach the book catalogues. Check your connection and try again.";
    }
    return "The book catalogues didn't respond. Try again in a moment.";
}

export function addBookErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return 'This book is already in your library.';
    }
    return "Couldn't add this book. Try again.";
}

export function manualAddErrorMessage(error: unknown): string {
    return messageText(error) === 'Title is required.' ? 'Title is required.' : "Couldn't add this book. Try again.";
}

export function wishlistErrorMessage(_error: unknown): string {
    return "Couldn't update your wishlist. Try again.";
}
