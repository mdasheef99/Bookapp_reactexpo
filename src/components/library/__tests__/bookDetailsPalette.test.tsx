import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as fs from 'fs';
import * as path from 'path';
import BookDetailScreen from '../../../../app/(tabs)/library/[bookId]';
import { useAuthStore } from '@/features/auth/store/authStore';
import { noteKeys } from '@/features/books/notes/manualNoteContract';
import { getLibraryAppearance } from '../LibraryAppearance';
import { ConditionPicker } from '../ConditionPicker';
import type { ThemePhase } from '@/hooks/useTheme';

// This test compares colours against a render fixture, so the feedback layer is a passthrough here
// (its own behaviour is tested in ui/__tests__/BookFeedback.test.tsx).
jest.mock('../ui/BookFeedback', () => ({
    BookFeedbackProvider: ({ children }: { children: React.ReactNode }) => children,
    BookFeedbackSlot: () => null,
    useBookFeedback: () => ({ notify: jest.fn(), confirm: jest.fn() }),
}));

let mockPhase: ThemePhase = 'daylight';
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({ bookId: 'user-book-1' }),
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({
    phase: mockPhase,
    colors: jest.requireActual('../LibraryAppearance').getLibraryAppearance(mockPhase),
}) }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => {
    const { useAuthStore: store } = require('@/features/auth/store/authStore');
    return { user: store((state: any) => state.session?.user) };
} }));
jest.mock('@/features/books/services/booksService', () => ({ booksService: {
    getBookDetails: jest.fn(), getPublicReviewsForBook: jest.fn(),
    updateReadingStatus: jest.fn(), updateOwnership: jest.fn(), updateCondition: jest.fn(),
    toggleLendingAvailability: jest.fn(), removeFromLibrary: jest.fn(),
} }));
jest.mock('@/features/books/services/userBookPagesService', () => ({ userBookPagesService: {
    getPagesForBook: jest.fn(), deletePage: jest.fn(),
} }));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteOperations: jest.fn() }));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({ manualNotesGateway: { list: jest.fn() } }));
// Keep the existing screen harness, but exercise the six FU-1c children rather than
// stubbing their render output. Import directly to avoid unrelated barrel exports.
jest.mock('@/components/library', () => ({
    ...jest.requireActual('../StatusSelector'),
    ...jest.requireActual('../OwnershipSelector'),
    ...jest.requireActual('../ConditionPicker'),
    ...jest.requireActual('../RatingInput'),
    ...jest.requireActual('../DeleteBookModal'),
}));
jest.mock('@/components/notes', () => ({ NoteCard: () => null }));
jest.mock('@/components/ui/AtmosphericBackground', () => ({
    AtmosphericBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/features/books/history/useBookReadingHistory', () => ({
    useBookReadingHistory: () => ({
        reads: { data: [], isPending: false, isError: false, refetch: jest.fn() },
        editDates: { mutateAsync: jest.fn(), isPending: false, variables: undefined },
        removeRead: { mutateAsync: jest.fn(), isPending: false, variables: undefined },
        startReread: { mutateAsync: jest.fn(), isPending: false },
        reopenRead: { mutateAsync: jest.fn(), isPending: false, variables: undefined },
    }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@react-native-community/datetimepicker', () => () => null);

const PHASES = ['daylight', 'golden', 'midnight'] as const;
const fixtureDir = path.join(__dirname, '__fixtures__');
const fixtureName = 'book-details.json';
const serialize = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

const luminance = (hex: string) => [1, 3, 5]
    .map(start => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (first: string, second: string) => {
    const values = [luminance(first), luminance(second)];
    return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};

const SOURCES = [
    'app/(tabs)/library/[bookId].tsx',
    'src/components/library/bookDetails/RatingReviewSummary.tsx',
    ...['StatusSelector', 'OwnershipSelector', 'ConditionPicker', 'RatingInput', 'DeleteBookModal', 'VaultPagesList']
        .map(name => `src/components/library/${name}.tsx`),
];
it.each(SOURCES)('%s uses library tokens without raw hex/rgb colours or useTheme()', file => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../..', file), 'utf8');
    expect(source).not.toMatch(/\buseTheme\s*\(/);
    expect(source).not.toMatch(/#[\da-f]{3,8}\b|\brgba?\s*\(/i);
});

function backgroundStyle(node: any): any {
    for (let current = node; current; current = current.parent) {
        const style = StyleSheet.flatten(current.props.style);
        if (style?.backgroundColor) return style;
    }
    throw new Error('Expected an ancestor with a background colour');
}

// Retain every host node, non-colour prop, text and testID. Functions cannot be
// represented in JSON; retain their source so handler changes also change the proof.
// Flatten first, then sort keys so moving a colour from StyleSheet to inline style
// cannot hide a change to layout, typography, spacing or any other style value.
function normalize(value: any, key = ''): any {
    if (typeof value === 'function') return value.toString();
    if (value === null || value === undefined) return value;
    if (/color$/i.test(key) && typeof value === 'string') return '<colour>';
    if (typeof value === 'string' && /^(#[\da-f]{3,8}|rgba?\(.+\)|hsla?\(.+\)|transparent)$/i.test(value)) return '<colour>';
    if (Array.isArray(value)) return value.map(item => normalize(item, key));
    if (typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(name => [name,
        normalize(name === 'style' ? StyleSheet.flatten(value[name]) : value[name], name),
    ]));
}

function renderScreen(availableForLending = false) {
    const client = new QueryClient({ defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
    } });
    client.setQueryData(['book', 'reader-1', 'user-book-1'], {
        id: 'user-book-1', user_id: 'reader-1', book_id: 'book-1', rating: 2,
        review: 'Existing review', review_is_public: true, reading_status: 'reading',
        ownership: 'owned', condition: 'good', available_for_lending: availableForLending,
        book: { title: 'Beloved', authors: ['Toni Morrison'], cover_url: null,
            page_count: 320, publisher: 'Knopf', isbn_13: '9781400033416' },
    });
    client.setQueryData(['book-public-reviews', 'book-1'], [{
        user_book_id: 'community-1', book_id: 'book-1', rating: 4,
        review: 'Another reader’s review.', created_at: '2026-03-12T09:00:00Z',
        author: { user_id: 'reader-2', display_name: 'Reader Two', username: 'reader-two' },
    }]);
    client.setQueryData(noteKeys.collection('reader-1', 'user-book-1'), []);
    client.setQueryData(['vault-pages', 'user-book-1'], [{
        id: 'page-1', page_number: 12, word_count: 8,
        updated_at: '2026-03-12T09:00:00Z', content_excerpt: 'A saved excerpt.',
    }]);
    return { client, ...render(<QueryClientProvider client={client}><BookDetailScreen /></QueryClientProvider>) };
}

beforeEach(() => {
    useAuthStore.setState({ session: { user: { id: 'reader-1' }, access_token: 'token-reader-1' } as any, status: 'authenticated' });
});
afterEach(() => {
    useAuthStore.setState({ session: null, status: 'unauthenticated' });
});

describe.each(PHASES)('Book Details palette: %s', phase => {
    beforeEach(() => { mockPhase = phase; });

    it('matches the shared render fixture after replacing colours', async () => {
        const ui = renderScreen();
        try {
            await ui.findByText('Beloved');
            const collapsed = normalize(ui.toJSON());
            // The top rating block (SDD-07 §14.2b) replaces the old review row:
            // stars stay visible with no inline editor; text editing lives on
            // the review page. Only the expandable rows are pressed here.
            for (const id of ['saved', 'info', 'ownership', 'community']) {
                fireEvent.press(ui.getByTestId(`book-row-${id}`));
            }
            await waitFor(() => expect(ui.getByTestId('book-rating-review')).toBeTruthy());
            expect(ui.queryByTestId('book-row-review')).toBeNull();
            expect(ui.queryByTestId('library-review-input')).toBeNull();
            const expanded = normalize(ui.toJSON());
            fireEvent.press(ui.getByRole('button', { name: 'Remove from library' }));
            const removal = normalize(ui.toJSON());
            const baseline = serialize({ collapsed, expanded, removal });
            // Git may check the fixture out with CRLF on Windows; compare content, not line endings.
            expect(baseline).toBe(fs.readFileSync(path.join(fixtureDir, fixtureName), 'utf8').replace(/\r\n/g, '\n'));
        } finally {
            ui.unmount();
            ui.client.clear();
        }
    }, 30000);

    it('maps screen, selected/unselected controls, stars and destructive surfaces to this phase', async () => {
        const colors = getLibraryAppearance(phase);
        const ui = renderScreen();
        try {
            await ui.findByText('Beloved');
            const placeholder = ui.getByTestId('book-cover-placeholder', { includeHiddenElements: true });
            expect(StyleSheet.flatten(placeholder.props.style).backgroundColor).toBe(colors.coverPlaceholder);
            expect(ui.UNSAFE_queryAllByType('Image' as any)).toHaveLength(0);
            expect(StyleSheet.flatten(ui.getByTestId('library-book-back-button').props.style)).toMatchObject({
                minHeight: 48, minWidth: 48,
            });
            expect(StyleSheet.flatten(ui.getByText('Add note').props.style).color).toBe(colors.textOnAccent);
            for (const [label, selected] of [['Want to read', false], ['Reading', true], ['Finished', false]] as const) {
                expect(backgroundStyle(ui.getByText(label))).toMatchObject({
                    backgroundColor: selected ? colors.bgCard : colors.bgSecondary,
                    borderColor: selected ? colors.controlBorder : colors.bgSecondary,
                });
                expect(StyleSheet.flatten(ui.getByText(label).props.style)).toMatchObject({
                    color: selected ? colors.textPrimary : colors.textSecondary,
                });
            }
            expect(ui.queryByText('Completed')).toBeNull();
            expect(within(ui.getByLabelText('Reading status')).UNSAFE_queryAllByType('Ionicons' as any)).toHaveLength(0);
            fireEvent.press(ui.getByTestId('book-row-saved'));
            fireEvent.press(ui.getByTestId('book-row-ownership'));
            // No lower review row (SDD-07 §14.2b); the top block shows stars, the
            // Edit button and the serif quote that opens the review page.
            expect(ui.queryByTestId('book-row-review')).toBeNull();
            expect(ui.getByTestId('book-rating-review')).toBeTruthy();
            expect(ui.getByTestId('book-rating-display').props.accessibilityLabel).toBe('Your rating: 2 of 5');
            expect(ui.getByRole('button', { name: 'Edit your rating and review' })).toBeTruthy();
            expect(ui.getByTestId('library-review-quote')).toBeTruthy();
            expect(ui.getByText('Existing review')).toBeOnTheScreen();
            for (const [label, selected] of [['Owned', true], ['Lent out', false], ['Borrowed', false], ['Wishlist', false]] as const) {
                expect(backgroundStyle(ui.getByText(label))).toMatchObject({
                    backgroundColor: selected ? colors.bgCard : colors.bgSecondary,
                    borderColor: selected ? colors.controlBorder : colors.bgSecondary,
                });
                expect(StyleSheet.flatten(ui.getByText(label).props.style)).toMatchObject({
                    color: selected ? colors.textPrimary : colors.textSecondary,
                });
                expect(StyleSheet.flatten(ui.getByText(label).props.style).fontWeight ?? '400').toBe(selected ? '700' : '400');
            }
            const icons = ui.UNSAFE_getAllByType('Ionicons' as any);
            const filled = icons.filter(node => node.props.name === 'star');
            const outline = icons.filter(node => node.props.name === 'star-outline');
            expect(filled).toHaveLength(2);
            expect(outline).toHaveLength(3);
            filled.forEach(node => expect(node.props.color).toBe(colors.textPrimary));
            outline.forEach(node => expect(node.props.color).toBe(colors.textSecondary));
            expect(StyleSheet.flatten(ui.getByText('Page 12').props.style).color).toBe(colors.textSecondary);
            expect(StyleSheet.flatten(ui.getByText('A saved excerpt.').props.style).color).toBe(colors.textPrimary);
            expect(StyleSheet.flatten(ui.getByText('Delete page 12').props.style).color).toBe(colors.accent);
            expect(StyleSheet.flatten(ui.getByText('Remove from library').props.style).color).toBe(colors.accent);
            fireEvent.press(ui.getByRole('button', { name: 'Remove from library' }));
            expect(backgroundStyle(ui.getByText('Remove “Beloved” from your library?'))).toMatchObject({ backgroundColor: colors.bgRaised });
            expect(backgroundStyle(ui.getByText('Remove book')).backgroundColor).toBe(colors.error);
            expect(StyleSheet.flatten(ui.getByText('Remove book').props.style).color).toBe(colors.onErrorSurface);
            expect(backgroundStyle(ui.getByText('Cancel'))).toMatchObject({
                backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.controlBorder,
            });
            expect(contrast(colors.controlBorder, colors.bgRaised)).toBeGreaterThanOrEqual(3);
            const surfaces = ui.UNSAFE_getAllByType(View).map(node => StyleSheet.flatten(node.props.style));
            expect(surfaces.some(style => style?.backgroundColor === colors.overlay)).toBe(true);
        } finally {
            ui.unmount();
            ui.client.clear();
        }
    });

    it('uses the same selected tokens for all five conditions while preserving labels and weight', () => {
        const levels = [
            ['new', 'New'], ['like_new', 'Like new'], ['good', 'Good'], ['acceptable', 'Fair'], ['poor', 'Poor'],
        ] as const;
        const colors = getLibraryAppearance(phase);
        const ui = render(<ConditionPicker condition="new" onChange={jest.fn()} />);
        try {
            for (const [condition] of levels) {
                ui.rerender(<ConditionPicker condition={condition} onChange={jest.fn()} />);
                for (const [value, label] of levels) {
                    const selected = condition === value;
                    expect(backgroundStyle(ui.getByText(label))).toMatchObject({
                        backgroundColor: selected ? colors.bgCard : colors.bgSecondary,
                        borderColor: selected ? colors.controlBorder : colors.bgSecondary,
                    });
                    expect(StyleSheet.flatten(ui.getByText(label).props.style)).toMatchObject({
                        color: selected ? colors.textPrimary : colors.textSecondary,
                    });
                    expect(StyleSheet.flatten(ui.getByText(label).props.style).fontWeight ?? '400').toBe(selected ? '700' : '400');
                }
            }
        } finally { ui.unmount(); }
    });
});
