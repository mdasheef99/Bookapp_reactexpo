import React from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
            for (const name of ['My review', 'Book options', 'Community reviews', 'Book information']) {
                fireEvent.press(ui.getByRole('button', { name }));
            }
            await waitFor(() => expect(ui.getByTestId('library-review-input').props.value).toBe('Existing review'));
            const expanded = normalize(ui.toJSON());
            fireEvent.press(ui.getByRole('button', { name: 'Remove from Library' }));
            const removal = normalize(ui.toJSON());
            const baseline = serialize({ collapsed, expanded, removal });
            // Git may check the fixture out with CRLF on Windows; compare content, not line endings.
            expect(baseline).toBe(fs.readFileSync(path.join(fixtureDir, fixtureName), 'utf8').replace(/\r\n/g, '\n'));
        } finally {
            ui.unmount();
            ui.client.clear();
        }
    }, 30000);

    it.each(['web', 'ios', 'android'] as const)('uses a contrasting active lending thumb on %s', async platform => {
        const colors = getLibraryAppearance(phase);
        const previousOS = Platform.OS;
        Platform.OS = platform;
        const ui = renderScreen(true);
        try {
            await ui.findByText('Beloved');
            fireEvent.press(ui.getByRole('button', { name: 'Book options' }));
            const props = ui.UNSAFE_getByType(Switch).props;
            expect(props.value).toBe(true);
            expect(platform === 'web' ? props.activeThumbColor : props.thumbColor).toBe(colors.textOnAccent);
            expect(platform === 'web' ? props.thumbColor : props.activeThumbColor).toBeUndefined();
            expect(contrast(colors.textOnAccent, colors.accent)).toBeGreaterThanOrEqual(3);
        } finally {
            ui.unmount();
            ui.client.clear();
            Platform.OS = previousOS;
        }
    });

    it('maps screen, selected/unselected controls, stars and destructive surfaces to this phase', async () => {
        const colors = getLibraryAppearance(phase);
        const ui = renderScreen();
        try {
            await ui.findByText('Beloved');
            const cover = ui.UNSAFE_getByType('Image' as any);
            expect(cover.props.source).toBeUndefined();
            expect(StyleSheet.flatten(cover.props.style).backgroundColor).toBe(colors.coverPlaceholder);
            expect(StyleSheet.flatten(ui.getByTestId('library-book-back-button').props.style)).toMatchObject({
                backgroundColor: colors.bgCard, shadowColor: colors.shadow,
            });
            expect(StyleSheet.flatten(ui.getByText('Add note').props.style).color).toBe(colors.textOnAccent);
            expect(StyleSheet.flatten(ui.getByText('0').props.style).color).toBe(colors.textOnAccent);
            for (const [label, selected] of [['Want to Read', false], ['Reading', true], ['Completed', false]] as const) {
                expect(backgroundStyle(ui.getByText(label))).toMatchObject({
                    backgroundColor: selected ? colors.chipSelectedBackground : colors.bgCard,
                    borderColor: selected ? colors.chipSelectedBackground : colors.controlBorder,
                    shadowColor: colors.shadow,
                });
                expect(StyleSheet.flatten(ui.getByText(label).props.style)).toMatchObject({
                    color: selected ? colors.chipSelectedText : colors.textSecondary,
                    fontWeight: selected ? '700' : '500',
                });
                const icon = ui.UNSAFE_getAllByType('Ionicons' as any).find(node => node.props.name ===
                    ({ 'Want to Read': 'bookmark-outline', Reading: 'book-outline', Completed: 'checkmark-circle-outline' }[label]));
                expect(icon?.props.color).toBe(selected ? colors.chipSelectedText : colors.textSecondary);
            }
            fireEvent.press(ui.getByRole('button', { name: 'My review' }));
            fireEvent.press(ui.getByRole('button', { name: 'Book options' }));
            expect(StyleSheet.flatten(ui.getByTestId('library-review-input').props.style).borderColor).toBe(colors.controlBorder);
            expect(ui.UNSAFE_getByType(Switch).props.trackColor).toEqual({ false: colors.controlBorder, true: colors.accent });
            expect(ui.UNSAFE_getByType(Switch).props.thumbColor).toBeUndefined();
            for (const [label, selected] of [['Owned', true], ['Lent Out', false], ['Borrowed', false], ['Wishlist', false]] as const) {
                expect(backgroundStyle(ui.getByText(label))).toMatchObject({
                    backgroundColor: selected ? colors.chipSelectedBackground : colors.bgSecondary,
                    borderColor: selected ? colors.chipSelectedBackground : colors.controlBorder,
                });
                expect(StyleSheet.flatten(ui.getByText(label).props.style)).toMatchObject({
                    color: selected ? colors.chipSelectedText : colors.textSecondary,
                    fontWeight: selected ? '600' : '400',
                });
            }
            const icons = ui.UNSAFE_getAllByType('Ionicons' as any);
            const filled = icons.filter(node => node.props.name === 'star');
            const outline = icons.filter(node => node.props.name === 'star-outline');
            expect(filled).toHaveLength(2);
            expect(outline).toHaveLength(3);
            filled.forEach(node => expect(node.props.color).toBe(colors.accent));
            outline.forEach(node => expect(node.props.color).toBe(colors.textTertiary));
            expect(backgroundStyle(ui.getByText('A saved excerpt.'))).toMatchObject({ backgroundColor: colors.bgSecondary, borderColor: colors.divider });
            expect(StyleSheet.flatten(ui.getByText('Delete').props.style).color).toBe(colors.error);
            expect(StyleSheet.flatten(ui.getByText('Remove from Library').props.style).color).toBe(colors.error);
            fireEvent.press(ui.getByRole('button', { name: 'Remove from Library' }));
            expect(backgroundStyle(ui.getByText('Remove from Library?'))).toMatchObject({ backgroundColor: colors.bgRaised, shadowColor: colors.shadow });
            expect(backgroundStyle(ui.getByText('Remove')).backgroundColor).toBe(colors.error);
            expect(StyleSheet.flatten(ui.getByText('Remove').props.style).color).toBe(colors.onErrorSurface);
            expect(backgroundStyle(ui.getByText('Cancel'))).toMatchObject({
                borderWidth: 1, borderColor: colors.controlBorder, paddingVertical: 13,
            });
            expect(contrast(colors.controlBorder, colors.bgRaised)).toBeGreaterThanOrEqual(3);
            const trash = ui.UNSAFE_getAllByType('Ionicons' as any).filter(node => node.props.name === 'trash-outline');
            expect(trash).toHaveLength(2);
            trash.forEach(node => expect(node.props.color).toBe(colors.error));
            expect(backgroundStyle(trash.find(node => node.props.size === 40))).toMatchObject({ backgroundColor: colors.errorSurface });
            const surfaces = ui.UNSAFE_getAllByType(View).map(node => StyleSheet.flatten(node.props.style));
            expect(surfaces.some(style => style?.backgroundColor === colors.overlay)).toBe(true);
            expect(surfaces.filter(style => style?.height === 1).map(style => style.backgroundColor)).toEqual([colors.divider, colors.divider]);
        } finally {
            ui.unmount();
            ui.client.clear();
        }
    });

    it('uses the same selected tokens for all five conditions while preserving labels and weight', () => {
        const levels = [
            ['new', 'New'], ['like_new', 'Like New'], ['good', 'Good'], ['acceptable', 'Fair'], ['poor', 'Poor'],
        ] as const;
        const colors = getLibraryAppearance(phase);
        const ui = render(<ConditionPicker condition="new" onChange={jest.fn()} />);
        try {
            for (const [condition] of levels) {
                ui.rerender(<ConditionPicker condition={condition} onChange={jest.fn()} />);
                for (const [value, label] of levels) {
                    const selected = condition === value;
                    expect(backgroundStyle(ui.getByText(label))).toMatchObject({
                        backgroundColor: selected ? colors.chipSelectedBackground : colors.bgSecondary,
                        borderColor: selected ? colors.chipSelectedBackground : colors.controlBorder,
                    });
                    expect(StyleSheet.flatten(ui.getByText(label).props.style)).toMatchObject({
                        color: selected ? colors.chipSelectedText : colors.textSecondary,
                        fontWeight: selected ? '700' : '400',
                    });
                }
            }
        } finally { ui.unmount(); }
    });
});
