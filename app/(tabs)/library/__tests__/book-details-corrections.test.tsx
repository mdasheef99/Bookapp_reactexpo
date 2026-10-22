import React from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BookDetailScreen from '../[bookId]';
import ReviewScreen from '../review';
import { BookFeedbackProvider } from '@/components/library/ui/BookFeedback';
import { booksService } from '@/features/books/services/booksService';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { useAuthStore } from '@/features/auth/store/authStore';
import { bookReviewService, currentReviewActor } from '@/features/books/services/bookReviewService';

void [View, Text, TextInput, TouchableOpacity];
let mockBook: any;
let mockEntryId = 'entry';
let mockHttp: jest.Mock;
let client: QueryClient;
let requests: Array<{ patch: Record<string, unknown>; headers: Headers; signal?: AbortSignal }>;
let gates: ReturnType<typeof deferred>[];
let returnedRow: unknown;
const mockBack = jest.fn(); const mockPush = jest.fn(); const mockReplace = jest.fn();
const mockFeedback = { notify: jest.fn(), confirm: jest.fn() };
jest.mock('@/components/library/ui/BookFeedback', () => ({
    ...jest.requireActual('@/components/library/ui/BookFeedback'),
    useBookFeedback: () => mockFeedback,
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ bookId: mockEntryId }), useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, dismiss: jest.fn(), canGoBack: () => true }), useNavigation: () => ({ dispatch: jest.fn(), canGoBack: () => true, getState: () => undefined, isFocused: () => true }) }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => {
    const { useAuthStore: store } = require('@/features/auth/store/authStore');
    const session = store((state: any) => state.session);
    return { user: session?.user, session };
} }));
jest.mock('@/lib/supabase', () => {
    const { createClient } = jest.requireActual('@supabase/supabase-js');
    return { supabase: createClient('https://fixture.supabase.co', 'synthetic-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (...args: any[]) => mockHttp(...args) },
    }) };
});
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteOperations: jest.fn() }));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({ manualNotesGateway: { list: jest.fn() } }));
jest.mock('@/features/books/services/booksService', () => ({ booksService: {
    getBookDetails: jest.fn(), getPublicReviewsForBook: jest.fn(),
    updateReadingStatus: jest.fn(), updateOwnership: jest.fn(), updateCondition: jest.fn(), toggleLendingAvailability: jest.fn(), removeFromLibrary: jest.fn(),
} }));
jest.mock('@/components/library', () => {
    const { Text, Pressable } = require('react-native');
    const control = (name: string, value: string) => ({ onChange }: any) => <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={() => onChange(value)}><Text>{name}</Text></Pressable>;
    return { StatusSelector: control('Reading status', 'completed'), OwnershipSelector: control('Ownership', 'borrowed'), ConditionPicker: control('Condition', 'good'),
        RatingInput: ({ onChange, disabled }: any) => <Pressable accessibilityRole="button" accessibilityLabel="Rate book" disabled={disabled} onPress={() => onChange(4)}><Text>Rating</Text></Pressable>,
        DeleteBookModal: ({ visible, onConfirm }: any) => visible ? <Pressable accessibilityRole="button" accessibilityLabel="Confirm removal" onPress={onConfirm}><Text>Confirm</Text></Pressable> : null };
});
jest.mock('@/components/notes', () => { const { Text } = require('react-native'); return { NoteCard: ({ note }: any) => <Text>{note.content}</Text> }; });
jest.mock('@/components/library/VaultPagesList', () => {
    const { Text } = require('react-native');
    return {
        VaultPagesList: () => <Text>Retained saved excerpt</Text>,
        useVaultPages: () => ({ data: [{ id: 'page-1', page_number: 12, content_excerpt: 'Retained saved excerpt' }], isLoading: false, isError: false }),
    };
});
jest.mock('@/components/ui/AtmosphericBackground', () => ({ AtmosphericBackground: ({ children }: any) => children }));

function deferred() {
    let resolve!: () => void; let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function actor(id: string | null, token = 'token-' + id) {
    useAuthStore.setState({ session: id ? { user: { id }, access_token: token } as any : null, status: id ? 'authenticated' : 'unauthenticated' });
}
async function screen() {
    const ui = render(<QueryClientProvider client={client}><BookFeedbackProvider><BookDetailScreen /></BookFeedbackProvider></QueryClientProvider>);
    await ui.findByText('Fixture book');
    return ui;
}
// Review text guarantees moved to the review page (SDD-07 §14.3); this helper
// renders that page with the same mutation key so hook/service guarantees hold.
async function reviewScreen() {
    const ui = render(<QueryClientProvider client={client}><BookFeedbackProvider><ReviewScreen /></BookFeedbackProvider></QueryClientProvider>);
    await ui.findByTestId('library-review-header');
    await ui.findByTestId('library-review-text');
    return ui;
}
async function saveReview(ui: Awaited<ReturnType<typeof reviewScreen>>) {
    const before = requests.length;
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests.length).toBeGreaterThan(before));
    await settled();
}
function rateFour(ui: Awaited<ReturnType<typeof reviewScreen>>) {
    fireEvent.press(within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '4 stars' }));
}
async function pressSave(ui: Awaited<ReturnType<typeof reviewScreen>>, count: number) {
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(count));
}
function setVisibility(ui: Awaited<ReturnType<typeof reviewScreen>>, value: boolean) {
    fireEvent(ui.getByTestId('library-review-visibility', { includeHiddenElements: true }), 'valueChange', value);
}
async function settled() {
    await waitFor(() => expect(client.isMutating()).toBe(0));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}
beforeEach(() => {
    mockFeedback.notify.mockReset(); mockFeedback.confirm.mockReset();
    jest.clearAllMocks(); mockEntryId = 'entry'; requests = []; gates = []; returnedRow = undefined;
    actor('reader');
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
    mockBook = { id: 'entry', user_id: 'reader', book_id: 'catalogue', review: 'Confirmed review', review_is_public: true, rating: 2,
        ownership: 'owned', reading_status: 'reading', condition: 'good', available_for_lending: false,
        book: { id: 'catalogue', title: 'Fixture book', authors: ['Author'], publisher: 'Press', page_count: 320, isbn_13: '123' } };
    mockHttp = jest.fn(async (_url, init) => {
        const patch = JSON.parse(init.body); const headers = new Headers(init.headers);
        const originalRow = mockBook;
        requests.push({ patch, headers, signal: init.signal });
        const gate = gates.shift();
        try { if (gate) await gate.promise; }
        catch (error: any) { return new Response(JSON.stringify({ message: error.message, code: '42501' }), { status: 403, headers: { 'Content-Type': 'application/json' } }); }
        const updated = { ...(mockBook.id === originalRow.id ? mockBook : originalRow), ...patch };
        if (returnedRow === undefined && mockBook.id === originalRow.id) mockBook = updated;
        const row = returnedRow === undefined ? { id: updated.id, user_id: updated.user_id, rating: updated.rating, review: updated.review, review_is_public: updated.review_is_public } : returnedRow;
        return new Response(JSON.stringify(row), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    (booksService.getBookDetails as jest.Mock).mockImplementation(async () => mockBook);
    (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([{ id: 'note', content: 'Saved note preview' }]);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { cleanup(); client.clear(); actor(null); jest.restoreAllMocks(); });

it.each(['text', 'rating', 'privacy'])('sends only the %s field selected by the action', async field => {
    if (field === 'rating') {
        const ui = await reviewScreen();
        rateFour(ui);
        await saveReview(ui);
        expect(requests.map(request => request.patch)).toEqual([{ rating: 4 }]);
        return;
    }
    const ui = await reviewScreen();
    if (field === 'text') fireEvent.changeText(ui.getByTestId('library-review-text'), 'Edited text');
    else {
        setVisibility(ui, false);
        expect(ui.getByTestId('library-review-visibility', { includeHiddenElements: true }).props.value).toBe(false);
        expect(ui.getByText('Only you can read this review.')).toBeOnTheScreen();
    }
    await saveReview(ui);
    const expected = field === 'text' ? { review: 'Edited text' } : { review_is_public: false };
    expect(requests.map(request => request.patch)).toEqual([expected]);
});

it('sends text then visibility as two single-field saves in order', async () => {
    const first = deferred(); const second = deferred(); gates.push(first, second); const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'Saved text');
    await pressSave(ui, 1);
    await act(async () => first.resolve()); await settled();
    setVisibility(ui, false);
    expect(ui.getByTestId('library-review-visibility', { includeHiddenElements: true }).props.value).toBe(false);
    expect(ui.getByText('Only you can read this review.')).toBeOnTheScreen();
    const save = ui.getByTestId('library-review-save');
    expect(save.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(save);
    await waitFor(() => expect(requests).toHaveLength(2));
    await act(async () => second.resolve()); await settled();
    expect(requests.map(request => request.patch)).toEqual([{ review: 'Saved text' }, { review_is_public: false }]);
    expect(mockBook).toMatchObject({ review: 'Saved text', review_is_public: false });
    expect(mockFeedback.notify).toHaveBeenCalledWith({ kind: 'success', message: 'Review saved' });
    expect(Alert.alert).not.toHaveBeenCalled();
});

it('keeps confirmed Public feedback while a visibility change is pending or rejected', async () => {
    const gate = deferred(); gates.push(gate); const ui = await reviewScreen();
    setVisibility(ui, false);
    expect(ui.getByTestId('library-review-visibility', { includeHiddenElements: true }).props.value).toBe(false);
    expect(ui.getByText('Only you can read this review.')).toBeOnTheScreen();
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(ui.getByTestId('library-review-text').props.value).toBe('Confirmed review');
    await act(async () => gate.reject(new Error('Visibility rejected'))); await settled();
    expect(ui.getByTestId('library-review-visibility', { includeHiddenElements: true }).props.value).toBe(false);
    expect(ui.getByText('Only you can read this review.')).toBeOnTheScreen();
    expect(mockFeedback.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error', message: expect.stringContaining('Visibility rejected') }));
});

it.each([true, false])('preserves confirmed privacy across a later text write; first success=%s', async success => {
    const gate = deferred(); gates.push(gate);
    const ui = await reviewScreen();
    setVisibility(ui, false);
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => { if (success) gate.resolve(); else gate.reject(new Error('Visibility rejected')); });
    await settled();
    expect(mockBook.review_is_public).toBe(success ? false : true);
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'Later text');
    await saveReview(ui);
    if (success) {
        expect(requests[requests.length - 1].patch).toEqual({ review: 'Later text' });
        expect(mockBook).toMatchObject({ review: 'Later text', review_is_public: false });
    } else {
        // The failed visibility change is still dirty, so Save writes text
        // first and then retries the visibility change: two single-field saves.
        expect(requests.slice(-2).map(request => request.patch)).toEqual([
            { review: 'Later text' },
            { review_is_public: false },
        ]);
        expect(mockBook).toMatchObject({ review: 'Later text', review_is_public: false });
    }
});

it.each(['visibility', 'rating'])('retains rejected text visibly without retrying it during a later %s action', async field => {
    const gate = deferred(); gates.push(gate); const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'Rejected draft');
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => gate.reject(new Error('Text rejected'))); await settled();
    // The failed text stays in the field and is not retried by the next save.
    expect(ui.getByTestId('library-review-text').props.value).toBe('Rejected draft');
    if (field === 'visibility') {
        fireEvent.changeText(ui.getByTestId('library-review-text'), 'Confirmed review');
        setVisibility(ui, false);
        await pressSave(ui, 2);
        await settled();
        expect(requests[1].patch).toEqual({ review_is_public: false });
        expect(mockBook.review).toBe('Confirmed review');
    } else {
        ui.unmount();
        const details = await reviewScreen();
        rateFour(details);
        await saveReview(details);
        expect(requests[1].patch).toEqual({ rating: 4 });
        expect(mockBook.review).toBe('Confirmed review');
    }
});

it('locks the editor while saving so a late confirmation cannot overwrite newer typing', async () => {
    const gate = deferred(); gates.push(gate); const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'Submitted text');
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    // Explicit Save serializes edits: the field and Save stay locked while the
    // save is in flight, so newer typing cannot race a late confirmation.
    expect(ui.getByTestId('library-review-text').props.editable).toBe(false);
    expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true);
    await act(async () => gate.resolve()); await settled();
    expect(client.getQueryData<any>(['book', 'reader', 'entry']).review).toBe('Submitted text');
    expect(ui.getByTestId('library-review-text').props.value).toBe('Submitted text');
    expect(ui.getByTestId('library-review-text').props.editable).toBe(true);
    expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true);
});

it('shows saving feedback on the review page while a visibility save is pending', async () => {
    const gate = deferred(); gates.push(gate); const ui = await reviewScreen();
    setVisibility(ui, false);
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(ui.getByText(/Saving review changes/)).toBeOnTheScreen();
    await act(async () => gate.resolve()); await settled();
    await waitFor(() => expect(ui.queryByText(/Saving review changes/)).toBeNull());
    expect(requests.map(request => request.patch)).toEqual([{ review_is_public: false }]);
});

it('sends sequential text saves in order across reopening', async () => {
    const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'First text');
    await saveReview(ui);
    expect(requests.map(request => request.patch)).toEqual([{ review: 'First text' }]);
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'Latest text');
    await saveReview(ui);
    expect(requests.map(request => request.patch)).toEqual([{ review: 'First text' }, { review: 'Latest text' }]);
    expect(mockBook).toMatchObject({ review: 'Latest text' });
});

it.each(['switch', 'logout', 'leave-and-return'])('fences queued dispatch and late confirmation after %s', async transition => {
    const gate = deferred(); gates.push(gate); const initial = await reviewScreen();
    fireEvent.changeText(initial.getByTestId('library-review-text'), 'Actor A private text');
    fireEvent.press(initial.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1)); initial.unmount();
    act(() => { actor(transition === 'logout' ? null : 'other-reader'); if (transition === 'leave-and-return') actor('reader'); });
    await act(async () => gate.resolve()); await settled();
    expect(requests).toHaveLength(1);
    expect(client.getQueryData<any>(['book', 'reader', 'entry'])).toMatchObject({ review: 'Confirmed review', review_is_public: true });
    expect(mockFeedback.notify).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled();
});

it('pins the dispatch token and aborts the request on identity loss', async () => {
    const gate = deferred(); gates.push(gate); const ui = await reviewScreen();
    setVisibility(ui, false);
    fireEvent.press(ui.getByTestId('library-review-save')); await waitFor(() => expect(requests).toHaveLength(1)); ui.unmount();
    actor('other-reader');
    expect(requests[0].headers.get('Authorization')).toBe('Bearer token-reader');
    expect(requests[0].signal?.aborted).toBe(true);
    await act(async () => gate.resolve()); await settled();
});

it.each([null, { id: 'foreign', user_id: 'reader', rating: 2, review: 'Wrong row', review_is_public: false },
    { id: 'entry', user_id: 'foreign', rating: 2, review: 'Wrong owner', review_is_public: false }])('does not confirm an absent or wrong affected row: %j', async row => {
    returnedRow = row; const ui = await reviewScreen();
    setVisibility(ui, false);
    fireEvent.press(ui.getByTestId('library-review-save')); await settled();
    expect(mockFeedback.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error', message: expect.any(String) }));
    expect(ui.getByTestId('library-review-visibility', { includeHiddenElements: true }).props.value).toBe(false);
    expect(ui.getByText('Only you can read this review.')).toBeOnTheScreen();
    expect(client.getQueryData<any>(['book', 'reader', 'entry']).review_is_public).toBe(true);
});

it('keeps same-actor token refresh valid while pinning each request credential', async () => {
    const gate = deferred(); gates.push(gate); const ui = await reviewScreen();
    setVisibility(ui, false);
    fireEvent.press(ui.getByTestId('library-review-save')); await waitFor(() => expect(requests).toHaveLength(1));
    act(() => actor('reader', 'refreshed-token'));
    expect(requests[0].signal?.aborted).toBe(false);
    await act(async () => gate.resolve()); await settled();
    expect(ui.getByTestId('library-review-visibility', { includeHiddenElements: true }).props.value).toBe(false);
    expect(ui.getByText('Only you can read this review.')).toBeOnTheScreen();
    setVisibility(ui, true);
    fireEvent.press(ui.getByTestId('library-review-save')); await settled();
    expect(requests[1].headers.get('Authorization')).toBe('Bearer refreshed-token');
    expect(ui.getByTestId('library-review-visibility', { includeHiddenElements: true }).props.value).toBe(true);
    expect(ui.getByText('Anyone can read this review.')).toBeOnTheScreen();
});

it('rechecks identity after cancellation before adopting a returned row', async () => {
    const cancellation = deferred();
    const cancel = jest.spyOn(client, 'cancelQueries').mockImplementationOnce(() => cancellation.promise);
    const ui = await reviewScreen();
    setVisibility(ui, false);
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(cancel).toHaveBeenCalled()); ui.unmount();
    actor('other-reader');
    await act(async () => cancellation.resolve()); await settled();
    expect(client.getQueryData<any>(['book', 'reader', 'entry']).review_is_public).toBe(true);
    expect(mockFeedback.notify).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled();
});

it('isolates another book from pending text and busy state', async () => {
    const gate = deferred(); gates.push(gate); const original = await reviewScreen();
    fireEvent.changeText(original.getByTestId('library-review-text'), 'Other book pending text');
    fireEvent.press(original.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1)); original.unmount();
    mockEntryId = 'other-entry'; mockBook = { ...mockBook, id: mockEntryId, book_id: 'other-catalogue', review: 'This book review' };
    const other = await reviewScreen();
    expect(other.getByTestId('library-review-text').props.value).toBe('This book review');
    expect(other.queryByText(/Saving review changes/)).toBeNull();
    setVisibility(other, false);
    fireEvent.press(other.getByTestId('library-review-save'));
    await waitFor(() => expect(other.getByTestId('library-review-visibility', { includeHiddenElements: true }).props.value).toBe(false));
    expect(requests[1].patch).toEqual({ review_is_public: false });
    await act(async () => gate.resolve()); await settled();
    expect(client.getQueryData<any>(['book', 'reader', 'other-entry'])).toMatchObject({ review: 'This book review', review_is_public: false });
});

it.each([{}, { rating: 9 }, { review: 'Unrelated', review_is_public: false }, { user_id: 'foreign' }])('rejects invalid field patches before dispatch: %j', async patch => {
    await expect(bookReviewService.update(currentReviewActor('reader')!, 'entry', patch as any)).rejects.toThrow('Invalid review change');
    expect(requests).toHaveLength(0);
});

it('keeps rating and visibility as separate single-field saves', async () => {
    const details = await reviewScreen();
    rateFour(details);
    await saveReview(details);
    expect(requests).toHaveLength(1);
    expect(requests[0].patch).toEqual({ rating: 4 });
    expect(mockBook).toMatchObject({ rating: 4, review_is_public: true });
    details.unmount();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
    const reopened = await reviewScreen();
    setVisibility(reopened, false);
    await saveReview(reopened);
    expect(requests.map(request => request.patch)).toEqual([{ rating: 4 }, { review_is_public: false }]);
    expect(mockBook).toMatchObject({ rating: 4, review_is_public: false });
});

it('retains named B01 destinations, management actions, and accessible Back', async () => {
    mockBook = { ...mockBook, condition: 'new' };
    const ui = await screen(); const buttons = ui.getAllByRole('button');
    // SDD-07 §14.2b: the rating block (with the Edit button) sits directly under
    // the cover, before the status selector and the Add note primary.
    expect(buttons.indexOf(ui.getByRole('button', { name: 'Edit your rating and review' }))).toBeLessThan(buttons.indexOf(ui.getByRole('button', { name: 'Add note' })));
    expect(ui.getByText('Saved note preview')).toBeOnTheScreen();
    fireEvent.press(ui.getByTestId('book-row-saved')); expect(ui.getByText('Retained saved excerpt')).toBeOnTheScreen();
    fireEvent.press(ui.getByTestId('book-row-ownership')); fireEvent.press(ui.getByRole('button', { name: 'Ownership' })); fireEvent.press(ui.getByRole('button', { name: 'Condition' }));
    await waitFor(() => expect(booksService.updateOwnership).toHaveBeenCalledWith('entry', 'borrowed'));
    await waitFor(() => expect(booksService.updateCondition).toHaveBeenCalledWith('entry', 'good'));
    fireEvent.press(ui.getByTestId('book-row-info')); expect(ui.getByText('ISBN-13 · 123')).toBeOnTheScreen();
    expect(within(ui.getByTestId('book-row-community')).getByText('None yet')).toBeOnTheScreen();
    const back = ui.getByRole('button', { name: 'Back to Library' }); const style = StyleSheet.flatten(back.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48); expect(style.minWidth).toBeGreaterThanOrEqual(48); fireEvent.press(back); expect(mockReplace).toHaveBeenCalledWith('/(tabs)/library');
    fireEvent.press(ui.getByRole('button', { name: 'Remove from library' })); expect(booksService.removeFromLibrary).not.toHaveBeenCalled(); fireEvent.press(ui.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() => expect(booksService.removeFromLibrary).toHaveBeenCalledWith('entry'));
});

it('reconciliation: saved editor keeps its text and offers Save again after a later server change', async () => {
    const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'Saved B');
    await saveReview(ui);
    expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true);
    mockBook = { ...mockBook, review: 'Later server C' };
    await act(async () => { await client.invalidateQueries({ queryKey: ['book', 'reader', 'entry'], exact: true }); });
    await waitFor(() => expect(client.getQueryData<any>(['book', 'reader', 'entry']).review).toBe('Later server C'));
    // Local editing state is never overwritten by a late server update; the
    // difference re-enables Save instead of silently swapping the text.
    await waitFor(() => expect(ui.getByTestId('library-review-text').props.value).toBe('Saved B'));
    await waitFor(() => expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false));
});

it('reconciliation: sequential text saves retain the newest typing', async () => {
    const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'B');
    await saveReview(ui);
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'Newer C');
    expect(ui.getByTestId('library-review-text').props.value).toBe('Newer C');
    expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
    await saveReview(ui);
    expect(requests.map(r => r.patch)).toEqual([{ review: 'B' }, { review: 'Newer C' }]);
});

it('reconciliation: failed text retries only on another Save press', async () => {
    const one = deferred(); gates.push(one); const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'Retry B');
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => one.reject(new Error('Rejected'))); await settled();
    expect(ui.getByTestId('library-review-text').props.value).toBe('Retry B');
    expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(ui.getByTestId('library-review-save')); await settled();
    expect(requests.map(r => r.patch)).toEqual([{review:'Retry B'}, {review:'Retry B'}]);
    await waitFor(() => expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true));
});

it.each(['rating', 'visibility'])('reconciliation: a later Save writes only dirty fields as single-field saves after a rejected %s', async field => {
    if (field === 'visibility') mockBook.review_is_public = false;
    const one = deferred(); gates.push(one);
    if (field === 'rating') {
        const details = await reviewScreen();
        rateFour(details);
        fireEvent.press(details.getByTestId('library-review-save'));
        await waitFor(() => expect(requests).toHaveLength(1));
        await act(async () => one.reject(new Error('Rejected'))); await settled();
        expect(mockBook.rating).toBe(2);
        details.unmount();
        client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
        const ui = await reviewScreen();
        fireEvent.changeText(ui.getByTestId('library-review-text'), 'Only text');
        await saveReview(ui);
        expect(requests[requests.length - 1].patch).toEqual({review:'Only text'});
        expect(mockBook.rating).toBe(2);
        expect(mockBook.review).toBe('Only text');
        return;
    }
    const ui = await reviewScreen();
    setVisibility(ui, true);
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => one.reject(new Error('Rejected'))); await settled();
    // Save writes every dirty field: the new text plus the still-dirty
    // visibility flip, each as its own single-field save.
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'Only text');
    await saveReview(ui);
    expect(requests.slice(-2).map(request => request.patch)).toEqual([{review:'Only text'}, {review_is_public: true}]);
    expect(mockBook).toMatchObject({ review: 'Only text', review_is_public: true });
});

it.each([[], {}, {id:'entry',user_id:'reader',rating:'2',review:'x',review_is_public:true},
    {id:'entry',user_id:'reader',rating:2,review:99,review_is_public:true},
    {id:'entry',user_id:'reader',rating:2,review:'x',review_is_public:'false'}])('reconciliation: rejects malformed response %j', async row => {
    returnedRow = row; await expect(bookReviewService.update(currentReviewActor('reader')!, 'entry', {rating:4})).rejects.toBeDefined();
});

it('reconciliation: accepts nullable retained fields and verifies generated HTTP', async () => {
    returnedRow = {id:'entry',user_id:'reader',rating:null,review:null,review_is_public:null};
    const row = await bookReviewService.update(currentReviewActor('reader')!, 'entry', {review:''});
    expect(row).toEqual(returnedRow);
    const [url, init] = mockHttp.mock.calls[0]; const parsed = new URL(url);
    expect(parsed.searchParams.get('id')).toBe('eq.entry'); expect(parsed.searchParams.get('user_id')).toBe('eq.reader');
    expect(parsed.searchParams.get('select')).toBe('id,user_id,rating,review,review_is_public');
    expect(init.method).toBe('PATCH'); expect(JSON.parse(init.body)).toEqual({review:''});
    expect(requests[0].headers.get('Prefer')).toContain('return=representation');
    expect(requests[0].headers.get('Accept')).toBe('application/vnd.pgrst.object+json');
    expect(requests[0].headers.get('Authorization')).toBe('Bearer token-reader');
});

it('reconciliation: transport errors do not confirm', async () => {
    mockHttp.mockRejectedValueOnce(new Error('network lost'));
    await expect(bookReviewService.update(currentReviewActor('reader')!, 'entry', {rating:4})).rejects.toBeDefined();
});

it('reconciliation: two mounted review pages keep independent drafts', async () => {
    const one = deferred(); gates.push(one);
    const both = render(<QueryClientProvider client={client}><BookFeedbackProvider><View testID="first"><ReviewScreen /></View><View testID="second"><ReviewScreen /></View></BookFeedbackProvider></QueryClientProvider>);
    const first = within(both.getByTestId('first')); const second = within(both.getByTestId('second'));
    await first.findByTestId('library-review-header'); await second.findByTestId('library-review-header');
    await first.findByTestId('library-review-text'); await second.findByTestId('library-review-text');
    fireEvent.changeText(second.getByTestId('library-review-text'), 'Local unsaved C');
    fireEvent.changeText(first.getByTestId('library-review-text'), 'Submitted B');
    fireEvent.press(first.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => one.resolve()); await settled();
    expect(second.getByTestId('library-review-text').props.value).toBe('Local unsaved C');
    expect(second.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
});

it('reconciliation: new generation saves with the new session token after the old request settles', async () => {
    const one = deferred(); gates.push(one); const first = await reviewScreen();
    rateFour(first); fireEvent.press(first.getByTestId('library-review-save')); await waitFor(() => expect(requests).toHaveLength(1)); first.unmount();
    await act(async () => one.resolve()); await settled();
    act(() => {actor(null); actor('reader', 'new-session-token');});
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
    const second = await reviewScreen();
    setVisibility(second, false);
    fireEvent.press(second.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].headers.get('Authorization')).toBe('Bearer new-session-token');
    await waitFor(() => expect(second.getByTestId('library-review-visibility', { includeHiddenElements: true }).props.value).toBe(false));
    await settled();
});

it('reconciliation: pending save completes into the cache while the reopened page shows confirmed text', async () => {
    client = new QueryClient({ defaultOptions: { queries: {retry:false}, mutations:{retry:false,gcTime:1} } });
    const one = deferred(); gates.push(one); const first = await reviewScreen();
    fireEvent.changeText(first.getByTestId('library-review-text'), 'Pending B');
    fireEvent.press(first.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1)); first.unmount();
    await act(async () => {await new Promise(resolve => setTimeout(resolve,20));});
    const second = await reviewScreen();
    expect(second.getByTestId('library-review-text').props.value).toBe('Confirmed review');
    await act(async () => one.resolve()); await settled();
    expect(client.getQueryData<any>(['book', 'reader', 'entry']).review).toBe('Pending B');
});

it('reconciliation: untouched Save cannot send when nothing changed', async () => {
    const ui = await reviewScreen();
    expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(ui.getByTestId('library-review-save')); await settled();
    expect(requests).toHaveLength(0);
    expect(mockFeedback.notify).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled();
});

it('reconciliation: mounted editor resets to the other session text after switch', async () => {
    const one = deferred(); gates.push(one); const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'),'Actor A secret pending');
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    mockBook = {...mockBook, user_id: 'other-reader', review:'Current session confirmed'};
    act(() => { actor('other-reader', 'new-token'); });
    await waitFor(() => expect(ui.getByTestId('library-review-text').props.value).toBe('Current session confirmed'));
    expect(ui.queryByText(/Saving review changes/)).toBeNull();
    await act(async () => one.resolve()); await settled();
    expect(client.getQueryData<any>(['book', 'reader', 'entry'])?.review).toBe('Confirmed review');
});

it('reconciliation: returning to the same session drops the stale draft', async () => {
    const one = deferred(); gates.push(one); const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'),'Actor A secret pending');
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    act(() => { actor('other-reader', 'temp-token'); });
    await waitFor(() => expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true));
    act(() => { actor('reader', 'new-token'); });
    // The stale draft is gone; the field no longer holds the old session text.
    await waitFor(() => expect(ui.getByTestId('library-review-text').props.value).not.toBe('Actor A secret pending'));
    expect(ui.queryByText(/Saving review changes/)).toBeNull();
    await act(async () => one.resolve()); await settled();
});



it('reconciliation: same mounted review page isolates a changed book identity', async () => {
    const one = deferred(); gates.push(one); const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'),'Old book pending');
    fireEvent.press(ui.getByTestId('library-review-save'));
    await waitFor(() => expect(requests).toHaveLength(1));
    mockEntryId='other-entry'; mockBook={...mockBook,id:mockEntryId,book_id:'other-catalogue',review:'Other book confirmed'};
    ui.rerender(<QueryClientProvider client={client}><BookFeedbackProvider><ReviewScreen /></BookFeedbackProvider></QueryClientProvider>);
    await waitFor(() => expect(ui.getByTestId('library-review-text').props.value).toBe('Other book confirmed'));
    await act(async () => one.resolve()); await settled();
});

it('reconciliation: server updates never overwrite a dirty review draft', async () => {
    const ui = await reviewScreen();
    fireEvent.changeText(ui.getByTestId('library-review-text'), 'Saved B');
    await saveReview(ui);
    mockBook = { ...mockBook, review: 'Later server D' };
    await act(async () => { await client.invalidateQueries({ queryKey: ['book', 'reader', 'entry'], exact: true }); });
    await waitFor(() => expect(client.getQueryData<any>(['book', 'reader', 'entry']).review).toBe('Later server D'));
    // The saved page keeps its confirmed text; the new server value surfaces
    // as a dirty difference with Save re-enabled instead of a silent swap.
    await waitFor(() => expect(ui.getByTestId('library-review-text').props.value).toBe('Saved B'));
    await waitFor(() => expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false));
});
