import React from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, TextInput, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

// Warm up RN primitives so cold Babel compilation does not consume the first render timeout.
void [ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, TextInput, View];

import {
    LIBRARY_TEXT,
    LibraryTypographyProvider,
    useLibraryTypography,
} from '../LibraryTypography';
import LibraryLayout from '../../../../app/(tabs)/library/_layout';
import { BookFeedbackProvider } from '../ui/BookFeedback';
import NoteReaderScreen from '../../../../app/(tabs)/library/note';
import BookDetailScreen from '../../../../app/(tabs)/library/[bookId]';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { booksService } from '@/features/books/services/booksService';
import { userBookPagesService } from '@/features/books/services/userBookPagesService';
import { useAuthStore } from '@/features/auth/store/authStore';
import { registerNoteContext } from '@/features/books/notes/noteNavigation';

jest.mock('expo-font', () => ({ useFonts: jest.fn(() => [true]) }));

jest.mock('expo-router', () => {
    const React = require('react');
    const StackComp = ({ children }: { children?: React.ReactNode }) => {
        const route = (globalThis as any).__FU2_ROUTE__ as React.ReactNode | undefined;
        if (route !== undefined) return React.createElement(React.Fragment, null, route);
        return React.createElement(React.Fragment, null, children);
    };
    (StackComp as any).Screen = () => null;
    return {
        Stack: StackComp,
        useLocalSearchParams: () => (globalThis as any).__FU2_PARAMS__ ?? { bookId: 'book', noteId: 'note' },
        useRouter: () => ({
            push: jest.fn(),
            replace: jest.fn(),
            back: jest.fn(),
            dismiss: jest.fn(),
            canGoBack: () => true,
        }),
        useNavigation: () => ({
            dispatch: jest.fn(),
            getState: () => ({ index: 0, routes: [] }),
        }),
        router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
    };
});

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    usePreventRemove: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'fu2-context-id' }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => {
        const { useAuthStore: store } = require('@/features/auth/store/authStore');
        const session = store((state: any) => state.session);
        return { user: session?.user, session, isLoading: false };
    },
}));
jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        phase: 'daylight',
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
            shadow: '#0F172A',
        },
    }),
}));
jest.mock('@/features/books/services/userBookPagesService', () => ({
    userBookPagesService: { getPagesForBook: jest.fn(), deletePage: jest.fn() },
}));
jest.mock('@/features/books/services/booksService', () => ({
    booksService: { getBookDetails: jest.fn(), getPublicReviewsForBook: jest.fn() },
}));
jest.mock('@/features/books/services/bookReviewService', () => ({
    ...jest.requireActual('@/features/books/services/bookReviewService'),
    bookReviewService: { update: jest.fn() },
}));
jest.mock('expo-image', () => ({ Image: require('react-native').View }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('expo-blur', () => ({ BlurView: require('react-native').View }));
jest.mock('@/components/ui/AtmosphericBackground', () => ({
    AtmosphericBackground: require('react-native').View,
}));
jest.mock('@/components/library', () => {
    const { View } = require('react-native');
    return {
        StatusSelector: View,
        OwnershipSelector: View,
        ConditionPicker: View,
        RatingInput: View,
        DeleteBookModal: View,
    };
});
jest.mock('@/components/library/VaultPagesList', () => ({ VaultPagesList: () => null }));
jest.mock('@/components/notes', () => ({ NoteCard: () => null }));

const mockedUseFonts = useFonts as unknown as jest.Mock;

function makeClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });
}

describe('LIBRARY_TEXT scale (SDD-07 FU-2)', () => {
    it('exports exactly the 7 spec styles at the spec sizes', () => {
        expect(Object.keys(LIBRARY_TEXT).sort()).toEqual(
            ['body', 'bodySerif', 'caption', 'display', 'heading', 'label', 'title'].sort()
        );
        expect(LIBRARY_TEXT.display).toMatchObject({ fontSize: 32, lineHeight: 40 });
        expect(LIBRARY_TEXT.title).toMatchObject({ fontSize: 26, lineHeight: 32 });
        expect(LIBRARY_TEXT.heading).toMatchObject({ fontSize: 21, lineHeight: 27 });
        expect(LIBRARY_TEXT.bodySerif).toMatchObject({ fontSize: 18, lineHeight: 26 });
        expect(LIBRARY_TEXT.body).toMatchObject({ fontSize: 16, lineHeight: 24 });
        expect(LIBRARY_TEXT.label).toMatchObject({ fontSize: 16, lineHeight: 22 });
        expect(LIBRARY_TEXT.caption).toMatchObject({ fontSize: 14, lineHeight: 20 });
    });

    it('references the font families the provider loads', () => {
        expect(LIBRARY_TEXT.display.fontFamily).toBe('LibraryGaramondSemiBold');
        expect(LIBRARY_TEXT.title.fontFamily).toBe('LibraryGaramondSemiBold');
        expect(LIBRARY_TEXT.heading.fontFamily).toBe('LibraryGaramondMedium');
        expect(LIBRARY_TEXT.bodySerif.fontFamily).toBe('LibraryGaramondMedium');
        expect(LIBRARY_TEXT.body.fontFamily).toBe('LibraryManrope');
        expect(LIBRARY_TEXT.label.fontFamily).toBe('LibraryManropeBold');
        expect(LIBRARY_TEXT.caption.fontFamily).toBe('LibraryManrope');
    });

    it('keeps every reading style at >= 16px and caption at >= 14px', () => {
        const { caption, ...reading } = LIBRARY_TEXT;
        for (const style of Object.values(reading)) {
            expect(style.fontSize).toBeGreaterThanOrEqual(16);
        }
        expect(caption.fontSize).toBeGreaterThanOrEqual(14);
    });

    it('keeps line-height ratios in 1.2-1.5 overall and 1.35-1.5 for body styles', () => {
        const { caption, ...nonCaption } = LIBRARY_TEXT;
        void caption;
        for (const style of Object.values(nonCaption)) {
            const ratio = style.lineHeight / style.fontSize;
            expect(ratio).toBeGreaterThanOrEqual(1.2);
            expect(ratio).toBeLessThanOrEqual(1.5);
        }
        for (const style of [LIBRARY_TEXT.body, LIBRARY_TEXT.bodySerif]) {
            const ratio = style.lineHeight / style.fontSize;
            expect(ratio).toBeGreaterThanOrEqual(1.35);
            expect(ratio).toBeLessThanOrEqual(1.5);
        }
    });
});

describe('LibraryTypographyProvider', () => {
    beforeEach(() => {
        mockedUseFonts.mockReturnValue([true]);
    });

    it('supplies the loaded library fonts when fonts are ready', () => {
        let seen: ReturnType<typeof useLibraryTypography> | null = null;
        const Probe = () => {
            seen = useLibraryTypography();
            return null;
        };
        render(
            <LibraryTypographyProvider>
                <Probe />
            </LibraryTypographyProvider>
        );
        expect(seen).toEqual({
            serif: 'LibraryGaramondMedium',
            heading: 'LibraryGaramondSemiBold',
            body: 'LibraryManrope',
            label: 'LibraryManropeBold',
        });
    });

    it('still renders children while fonts load (fallback, nothing blank)', () => {
        mockedUseFonts.mockReturnValue([false]);
        let seen: ReturnType<typeof useLibraryTypography> | null = null;
        const Probe = () => {
            seen = useLibraryTypography();
            return <Text testID="fu2-fallback-child">fallback child</Text>;
        };
        render(
            <LibraryTypographyProvider>
                <Probe />
            </LibraryTypographyProvider>
        );
        expect(screen.getByTestId('fu2-fallback-child')).toBeTruthy();
        expect(seen).toBeTruthy();
    });

    it('wraps the library Stack at the layout level', () => {
        const element = LibraryLayout() as React.ReactElement<{ children?: React.ReactNode }>;
        expect(element.type).toBe(LibraryTypographyProvider);
        const child = element.props.children as React.ReactElement;
        expect(child.type).toBe(BookFeedbackProvider);
        expect((child.props as { children: React.ReactElement }).children.type).toBe(Stack);
    });
});

describe('library routes render inside the layout provider (FU-2)', () => {
    let client: QueryClient;
    let rendered: ReturnType<typeof render> | undefined;

    beforeEach(() => {
        jest.clearAllMocks();
        mockedUseFonts.mockReturnValue([true]);
        client = makeClient();
        act(() => {
            useAuthStore.setState({ session: { user: { id: 'actor' } } as any, status: 'authenticated' });
        });
        (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([]);
        (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
        (booksService.getBookDetails as jest.Mock).mockResolvedValue({
            id: 'book',
            user_id: 'actor',
            book_id: 'book',
            rating: null,
            review: 'Existing review',
            review_is_public: true,
            reading_status: 'want_to_read',
            ownership: 'borrowed',
            condition: 'good',
            available_for_lending: false,
            book: { title: 'Selected book', authors: ['Author'], cover_url: null },
        });
        jest.spyOn(manualNotesGateway, 'book').mockResolvedValue({ id: 'book', title: 'Selected book' } as any);
        jest.spyOn(manualNotesGateway, 'record').mockResolvedValue({
            id: 'note',
            user_id: 'actor',
            user_book_id: 'book',
            content: 'FU-2 reader body',
            tag: 'reflect',
            page_number: 8,
            created_at: '2026-10-10T00:00:00Z',
            updated_at: null,
            version: 1,
        } as any);
        jest.spyOn(manualNotesGateway, 'list').mockResolvedValue([]);
    });

    afterEach(() => {
        rendered?.unmount();
        rendered = undefined;
        jest.restoreAllMocks();
        act(() => {
            useAuthStore.setState({ session: null, status: 'unauthenticated' } as any);
        });
        delete (globalThis as any).__FU2_ROUTE__;
        delete (globalThis as any).__FU2_PARAMS__;
    });

    it('renders the note reader inside the provider with fonts available', async () => {
        jest.setTimeout(20000);
        (globalThis as any).__FU2_PARAMS__ = {
            bookId: 'book',
            noteId: 'note',
            contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true }),
        };
        let seen: ReturnType<typeof useLibraryTypography> | null = null;
        const Probe = () => {
            seen = useLibraryTypography();
            return null;
        };
        (globalThis as any).__FU2_ROUTE__ = (
            <>
                <Probe />
                <NoteReaderScreen />
            </>
        );
        rendered = render(
            <QueryClientProvider client={client}>
                <LibraryLayout />
            </QueryClientProvider>
        );
        await waitFor(() => expect(screen.getByText('FU-2 reader body')).toBeTruthy());
        expect(seen).toEqual({
            serif: 'LibraryGaramondMedium',
            heading: 'LibraryGaramondSemiBold',
            body: 'LibraryManrope',
            label: 'LibraryManropeBold',
        });
    });

    it('renders Book Details inside the provider with fonts available', async () => {
        jest.setTimeout(20000);
        (globalThis as any).__FU2_PARAMS__ = { bookId: 'book' };
        let seen: ReturnType<typeof useLibraryTypography> | null = null;
        const Probe = () => {
            seen = useLibraryTypography();
            return null;
        };
        (globalThis as any).__FU2_ROUTE__ = (
            <>
                <Probe />
                <BookDetailScreen />
            </>
        );
        rendered = render(
            <QueryClientProvider client={client}>
                <LibraryLayout />
            </QueryClientProvider>
        );
        await waitFor(() => expect(screen.getByText('Selected book')).toBeTruthy());
        expect(seen).toEqual({
            serif: 'LibraryGaramondMedium',
            heading: 'LibraryGaramondSemiBold',
            body: 'LibraryManrope',
            label: 'LibraryManropeBold',
        });
    });
});
