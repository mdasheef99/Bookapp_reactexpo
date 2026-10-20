import { addBookErrorMessage, manualAddErrorMessage, searchErrorMessage, wishlistErrorMessage } from '../searchErrorCopy';

describe('catalogue error copy', () => {
    it.each([
        [new Error('Google Books API error: 500'), "The book catalogues didn't respond. Try again in a moment."],
        [new Error('Google Books API error: 429'), 'The book catalogues are busy. Try again in a minute.'],
        ['HTTP 429 Too many requests', 'The book catalogues are busy. Try again in a minute.'],
        [new TypeError('Failed to fetch'), "Couldn't reach the book catalogues. Check your connection and try again."],
        [new TypeError('Cannot read properties of undefined'), "The book catalogues didn't respond. Try again in a moment."],
        [new Error('Failed to fetch'), "Couldn't reach the book catalogues. Check your connection and try again."],
        [new Error('Network request failed'), "Couldn't reach the book catalogues. Check your connection and try again."],
        [new Error('NetworkError when attempting to fetch resource'), "Couldn't reach the book catalogues. Check your connection and try again."],
        ['load failed', "Couldn't reach the book catalogues. Check your connection and try again."],
        [undefined, "The book catalogues didn't respond. Try again in a moment."],
        [{ message: 'private provider response' }, "The book catalogues didn't respond. Try again in a moment."],
    ])('maps search failure %p without exposing provider text', (error, expected) => {
        expect(searchErrorMessage(error)).toBe(expected);
    });

    it.each([
        [{ code: '23505', message: 'private constraint' }, 'This book is already in your library.'],
        [new Error('private add failure'), "Couldn't add this book. Try again."],
        [null, "Couldn't add this book. Try again."],
    ])('maps add failure %p', (error, expected) => {
        expect(addBookErrorMessage(error)).toBe(expected);
    });

    it.each([
        [new Error('Title is required.'), 'Title is required.'],
        ['Title is required.', 'Title is required.'],
        [new Error('private manual failure'), "Couldn't add this book. Try again."],
        [{ code: '23505' }, "Couldn't add this book. Try again."],
    ])('maps manual failure %p', (error, expected) => {
        expect(manualAddErrorMessage(error)).toBe(expected);
    });

    it.each([new Error('private wishlist failure'), undefined, false])('maps wishlist failure %p', error => {
        expect(wishlistErrorMessage(error)).toBe("Couldn't update your wishlist. Try again.");
    });
});
