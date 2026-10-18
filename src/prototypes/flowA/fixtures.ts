import type { ImageSourcePropType } from 'react-native';
import type { ManualNote } from '@/features/books/notes/manualNoteContract';
import type { UserBookPage } from '@/features/books/services/userBookPagesService';

export type ReadingStatus = 'want_to_read' | 'reading' | 'completed';
export type OpenRow = 'review' | 'saved' | 'info' | 'ownership' | 'remove';
export const OPEN_ROWS: readonly OpenRow[] = ['review', 'saved', 'info', 'ownership', 'remove'];
export const PRESETS = [
    'populated', 'no-cover', 'zero-notes', 'many-notes', 'long-title', 'saved-absent',
    'review-absent', 'want-to-read', 'finished', 'lent-out', 'uncategorised-note',
    'notes-loading', 'notes-error', 'loading', 'error', 'not-found', 'offline', 'refresh-failed',
] as const;
export type Preset = typeof PRESETS[number];
export interface PrototypeBook {
    title: string;
    authors: string[];
    cover: ImageSourcePropType | null;
    reading_status: ReadingStatus;
    review: string | null;
    rating: number | null;
    review_is_public: boolean;
    ownership: 'owned' | 'lent_out';
    condition?: string;
    page_count: number;
    publisher: string;
    published_year: string;
    isbn_13: string | null;
    description: string;
}
export interface PrototypeFixture {
    book: PrototypeBook;
    notes: ManualNote[];
    savedPages: UserBookPage[];
}

const stamp = '2026-10-14T12:00:00Z';
const notes: ManualNote[] = [
    { id: 'walden-quote', user_id: 'fixture-reader', user_book_id: 'fixture-walden',
        content: 'I went to the woods because I wished to live deliberately.', tag: 'quote', page_number: 42, created_at: stamp, updated_at: null },
    { id: 'walden-thought', user_id: 'fixture-reader', user_book_id: 'fixture-walden',
        content: 'I notice more when I slow down and read a few pages at a time.', tag: 'reflect', page_number: null, created_at: '2026-10-12T12:00:00Z', updated_at: null },
    { id: 'walden-question', user_id: 'fixture-reader', user_book_id: 'fixture-walden',
        content: 'Which things make my days feel full, and which just keep me busy?', tag: 'question', page_number: 31, created_at: '2026-10-09T12:00:00Z', updated_at: null },
];
const walden: PrototypeBook = {
    title: 'Walden', authors: ['Henry David Thoreau'], cover: require('./fixtures/cover-walden.png'),
    reading_status: 'reading', review: 'A book I want to return to slowly. The small observations stay with me after I put it down.',
    rating: 4, review_is_public: false, ownership: 'owned', condition: 'Good',
    page_count: 357, publisher: 'Ticknor and Fields', published_year: '1854', isbn_13: null,
    description: 'Reflections on simple living, self-reliance, and the natural world, drawn from time beside Walden Pond in Massachusetts.',
};
const savedPages: UserBookPage[] = [{
    id: 'walden-page', user_id: 'fixture-reader', user_book_id: 'fixture-walden', page_number: 42,
    content_excerpt: 'I went to the woods because I wished to live deliberately.',
    full_text: 'I went to the woods because I wished to live deliberately.', word_count: 13,
    created_at: stamp, updated_at: stamp,
}];
const populated: PrototypeFixture = { book: walden, notes, savedPages };

export const FIXTURES: Record<Preset, PrototypeFixture> = {
    populated,
    'no-cover': { ...populated, book: { ...walden, cover: null } },
    'zero-notes': { ...populated, notes: [] },
    'many-notes': { ...populated, notes: [...notes, ...Array.from({ length: 9 }, (_, index) => ({
        ...notes[1], id: `walden-earlier-${index}`, created_at: `2026-10-0${9 - index}T08:00:00Z`,
        content: `I am keeping this earlier observation about the pond, passage ${index + 1}, for a slower reread.`,
    }))] },
    'long-title': { ...populated, book: { ...walden,
        title: 'The Life and Opinions of Tristram Shandy, Gentleman', authors: ['Laurence Sterne'],
        cover: null,
        publisher: 'Ann Ward', published_year: '1759–1767', page_count: 560,
        description: 'A playful, digressive novel about the telling of a life, published in nine volumes.',
    }, notes: [
        { ...notes[1], id: 'shandy-thought', user_book_id: 'fixture-shandy', content: 'The detours feel like part of the point. I want to notice where the story returns.' },
        { ...notes[2], id: 'shandy-question', user_book_id: 'fixture-shandy', content: 'How much of a life fits into a straight line?' },
    ], savedPages: [] },
    'saved-absent': { ...populated, savedPages: [] },
    'review-absent': { ...populated, book: { ...walden, review: null, rating: null } },
    'want-to-read': { ...populated, book: { ...walden, reading_status: 'want_to_read' } },
    finished: { ...populated, book: { ...walden, reading_status: 'completed' } },
    'lent-out': { ...populated, book: { ...walden, ownership: 'lent_out' } },
    'uncategorised-note': { ...populated, notes: [{ ...notes[0], tag: null, page_number: null }, ...notes.slice(1)] },
    'notes-loading': populated, 'notes-error': populated, loading: populated,
    error: populated, 'not-found': populated, offline: populated, 'refresh-failed': populated,
};
