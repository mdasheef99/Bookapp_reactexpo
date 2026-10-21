// Post-scan SDD-1 §§2/6 (4a), AC4-2/3/6/9. Real screen, access, queries and guard.
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { setAuthState, resetAuthStoreForTests } from '@/features/auth/store/authStore';
import { storeOwnerService } from '@/features/stores/services/storeOwnerService';
import { storeOwnerKeys } from '@/features/stores/hooks/useStoreOwnerGate';
import { InventoryMissedBookScreen } from '../screens/MissedBookScreen';
import { OwnerCorrectionClientError, ownerCorrectionService } from '../api/ownerCorrectionService';
import { ownerBatchReviewService, type OwnerSessionSummaryV3 } from '../api/ownerBatchReviewService';
import { ownerUxService } from '../api/ownerUxService';
import { imageInventoryKeys, resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { ownerBatchReviewKeys } from '../queries/ownerBatchReviewQueries';
import * as ownerCorrectionQueries from '../queries/ownerCorrectionQueries';
import { candidateDetailFixture, sessionSummaryFixture, testUuid } from '../testing/ownerUxTestFixtures';
import { blockerCodes } from '../contracts/ownerUxCommonSchemas';
import { deferred } from '../testing/editionPickerClientFixtures';

// Load Jest's lazy native component mocks during suite setup, before timed async renders.
void [ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View];

const identity = { userId: testUuid(90), storeId: testUuid(8) };
const otherStoreId = testUuid(91);
const sessionId = testUuid(1);
const candidateId = testUuid(30);
const fullText = 'This scan already has 15 books — scan the rest separately.';
type LeaveEvent = { preventDefault: () => void; data: { action: { type: string } } };
let mockBeforeRemove: ((event: LeaveEvent) => void) | undefined;
const mockNavigation = {
    addListener: jest.fn((_name: string, listener: (event: LeaveEvent) => void) => {
        mockBeforeRemove = listener;
        return () => { if (mockBeforeRemove === listener) mockBeforeRemove = undefined; };
    }),
    dispatch: jest.fn(),
};
const mockReplacePreventDefault = jest.fn();
const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(() => mockBeforeRemove?.({
        preventDefault: mockReplacePreventDefault, data: { action: { type: 'REPLACE' } },
    })),
};
let mockOffline = false;
let client: QueryClient;
let session: OwnerSessionSummaryV3;

jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useNavigation: () => mockNavigation }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));
jest.mock('@/features/stores/services/storeOwnerService', () => ({ storeOwnerService: { getGateState: jest.fn() } }));
jest.mock('@/lib/supabase');

beforeEach(() => {
    jest.clearAllMocks();
    let uuidSequence = 70;
    jest.spyOn(Crypto, 'randomUUID').mockImplementation(() => testUuid(uuidSequence++));
    mockBeforeRemove = undefined;
    mockOffline = false;
    client = new QueryClient({ defaultOptions: {
        queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity },
    } });
    resetImageInventoryIdentityForTests(identity);
    setAuthState({ status: 'authenticated', initializationError: null, session: {
        access_token: 'test', refresh_token: 'test', expires_in: 3600, token_type: 'bearer',
        user: { id: identity.userId, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-20T00:00:00Z' },
    } });
    (storeOwnerService.getGateState as jest.Mock).mockResolvedValue({
        state: 'active_owner', storeId: identity.storeId, storeName: 'Test store',
    });
    const base = sessionSummaryFixture();
    session = { ...base, batchLabel: null, defaults: {
        languageHint: 'en', condition: null, location: base.defaults.location,
        priceMinor: null, quantity: 1, publication: base.defaults.publication, script: base.defaults.script,
    } };
    jest.spyOn(ownerBatchReviewService, 'readSessionV3').mockImplementation(async () => session);
    jest.spyOn(ownerCorrectionService, 'addManualCandidate').mockResolvedValue({
        candidateId, authenticatedUserId: identity.userId,
    });
    jest.spyOn(ownerUxService, 'readCandidate').mockResolvedValue(candidateDetailFixture({ candidateId }));
});
afterEach(async () => {
    cleanup();
    await client.cancelQueries();
    client.getMutationCache().getAll().forEach((mutation) => mutation.destroy());
    client.clear();
    resetAuthStoreForTests();
    resetImageInventoryIdentityForTests();
    jest.restoreAllMocks();
});
async function mount() {
    const screen = render(<QueryClientProvider client={client}>
        <InventoryMissedBookScreen sessionId={sessionId} />
    </QueryClientProvider>);
    await waitFor(() => expect(screen.getByTestId('missed-title')).toBeTruthy());
    return screen;
}
// Accept the old submit copy here so unrelated copy cannot hide a navigation/error/guard failure.
function submit(screen: Awaited<ReturnType<typeof mount>>) {
    fireEvent.press(screen.getByRole('button', { name: /^Add (?:book|candidate)$/u }));
}
async function addBook(screen: Awaited<ReturnType<typeof mount>>) {
    fireEvent.changeText(screen.getByTestId('missed-title'), ' A book ');
    fireEvent.changeText(screen.getByTestId('missed-author-0'), ' An author ');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Add (?:book|candidate)$/u })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(client.getQueryData(imageInventoryKeys.candidate(identity, sessionId, candidateId))).toBeTruthy());
}
function leave() {
    const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
    expect(mockBeforeRemove).toBeDefined();
    act(() => mockBeforeRemove!(event));
    return event;
}
function openLanguages(screen: Awaited<ReturnType<typeof mount>>) {
    if (!screen.queryByLabelText('Search languages')) {
        fireEvent.press(screen.getByRole('button', { name: 'Choose language' }));
    }
}

it('adds a book and returns to the review list', async () => {
    const screen = await mount();
    await addBook(screen);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(store-owner)/inventory/scan/' + sessionId));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1);
    expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledWith(expect.objectContaining({
        sessionId, title: 'A book', authors: ['An author'], language: 'en',
    }), identity);
    expect(ownerUxService.readCandidate).toHaveBeenCalledWith(sessionId, candidateId);
});
it('invalidates the session batch query after adding a book', async () => {
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const screen = await mount();
    await addBook(screen);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({
        queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId),
    }));
});
it('maps the limit error to the scan-full text', async () => {
    jest.mocked(ownerCorrectionService.addManualCandidate).mockRejectedValue(new OwnerCorrectionClientError('P9_LIMIT_EXCEEDED'));
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Add (?:book|candidate)$/u })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(screen.getByText(fullText)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Add book' })).toBeDisabled();
    expect(screen.getByText(fullText).props).toMatchObject({ selectable: true, accessibilityLiveRegion: 'polite' });
    expect(screen.getByLabelText(fullText)).toBeTruthy();
    expect(screen.queryByText(/Retry/iu)).toBeNull();
});
it('add-a-book controls are labelled', async () => {
    const screen = await mount();
    expect(screen.getByRole('header', { name: 'Add a book' })).toBeTruthy();
    expect(screen.getByLabelText('Title required')).toBeTruthy();
    expect(screen.getByLabelText('Author 1')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Add another author' }));
    expect(screen.getByLabelText('Author 2')).toBeTruthy();
    openLanguages(screen);
    expect(screen.getByLabelText('Search languages')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add book' })).toBeDisabled();
    expect(screen.queryByLabelText('BCP-47 language required')).toBeNull();
});
it('describes adding one book to this scan', async () => {
    const screen = await mount();
    expect(screen.getByText('Adds one book to this scan for you to check.')).toBeTruthy();
});
it('heads the form Add a book', async () => {
    const screen = await mount();
    expect(screen.getByRole('header', { name: 'Add a book' })).toBeTruthy();
});
it('explains when the scan cannot accept another book', async () => {
    session = { ...session, status: 'expired' };
    const screen = render(<QueryClientProvider client={client}>
        <InventoryMissedBookScreen sessionId={sessionId} />
    </QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('This scan cannot accept another book.')).toBeTruthy());
    expect(screen.queryByTestId('missed-title')).toBeNull();
});
it('language hint does not make the form dirty', async () => {
    session = { ...session, defaults: { ...session.defaults, languageHint: 'fr-CA' } };
    const screen = await mount();
    // An unlisted but valid tag is visible and is the pristine baseline.
    expect(screen.getByText('fr-CA')).toBeTruthy();
    expect(leave().preventDefault).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
});
it('keeps the chosen language when the session hint refetches', async () => {
    const screen = await mount();
    openLanguages(screen);
    fireEvent.changeText(screen.getByLabelText('Search languages'), 'Hindi');
    fireEvent.press(screen.getByRole('button', { name: 'Hindi' }));
    session = { ...session, defaults: { ...session.defaults, languageHint: 'fr' } };
    await act(async () => { await client.invalidateQueries({ queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId) }); });
    await addBook(screen);
    expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledWith(expect.objectContaining({ language: 'hi' }), identity);
});
it('keeps the chosen language through a failed session refetch and recovery', async () => {
    const screen = await mount();
    openLanguages(screen);
    fireEvent.changeText(screen.getByLabelText('Search languages'), 'Hindi');
    fireEvent.press(screen.getByRole('button', { name: 'Hindi' }));
    jest.mocked(ownerBatchReviewService.readSessionV3).mockRejectedValue(new Error('offline read'));
    await act(async () => { await client.invalidateQueries({ queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId) }); });
    await waitFor(() => expect(screen.getByText('This scan cannot accept another book.')).toBeTruthy());
    session = { ...session, defaults: { ...session.defaults, languageHint: 'fr' } };
    jest.mocked(ownerBatchReviewService.readSessionV3).mockImplementation(async () => session);
    await act(async () => { await client.invalidateQueries({ queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId) }); });
    await waitFor(() => expect(screen.getByTestId('missed-title')).toBeTruthy());
    expect(screen.getByLabelText('Current language: Hindi')).toHaveTextContent('Hindi');
    expect(leave().preventDefault).toHaveBeenCalled();
});
it('defaults the language to the session hint', async () => {
    session = { ...session, defaults: { ...session.defaults, languageHint: 'hi' } };
    const screen = await mount();
    await addBook(screen);
    expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledWith(expect.objectContaining({ language: 'hi' }), identity);
});
it('selects a language with the shared searchable chooser', async () => {
    const screen = await mount();
    openLanguages(screen);
    fireEvent.changeText(screen.getByLabelText('Search languages'), 'Hindi');
    fireEvent.press(screen.getByRole('button', { name: 'Hindi' }));
    await addBook(screen);
    expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledWith(expect.objectContaining({ language: 'hi' }), identity);
});
it('asks before leaving with unsaved text', async () => {
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Unsubmitted book');
    expect(leave().preventDefault).toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Leave without adding?' })).toBeTruthy();
    expect(screen.getByText("This book's details exist only on this screen.")).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    expect(screen.queryByText('Leave without adding?')).toBeNull();
    expect(screen.getByTestId('missed-title').props.value).toBe('Unsubmitted book');
    leave();
    fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
    expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
});
it('offers only Stay while adding the book', async () => {
    const pending = deferred<Awaited<ReturnType<typeof ownerCorrectionService.addManualCandidate>>>();
    jest.mocked(ownerCorrectionService.addManualCandidate).mockReturnValue(pending.promise);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Add (?:book|candidate)$/u })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1));
    expect(leave().preventDefault).toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Adding this book' })).toBeTruthy();
    expect(screen.getByText('Wait until the book is added before leaving.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
});
it('does not ask after a successful add', async () => {
    const screen = await mount();
    await addBook(screen);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(mockReplacePreventDefault).not.toHaveBeenCalled();
    expect(leave().preventDefault).not.toHaveBeenCalled();
    expect(screen.queryByText('Leave without adding?')).toBeNull();
});
it('does not offer leave while the post-add read is still running', async () => {
    const read = deferred<Awaited<ReturnType<typeof ownerUxService.readCandidate>>>();
    jest.mocked(ownerUxService.readCandidate).mockReturnValue(read.promise);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Add (?:book|candidate)$/u })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(ownerUxService.readCandidate).toHaveBeenCalledTimes(1));
    expect(leave().preventDefault).toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Adding this book' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Stay' })).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => { read.resolve(candidateDetailFixture({ candidateId })); });
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(mockReplacePreventDefault).not.toHaveBeenCalled();
});
it('does not offer leave while the post-add cache sync is still running', async () => {
    const readiness: Awaited<ReturnType<typeof ownerUxService.readReadiness>> = {
        sessionId, sessionStatus: 'active', sessionVersion: 1, allInputsTerminal: false,
        closeSummary: sessionSummaryFixture().closeSummary,
        blockerCounts: Object.fromEntries(blockerCodes.map((code) => [code, 0])) as Record<typeof blockerCodes[number], number>,
        nextBlockingCandidateId: null, closeState: 'not_closeable', closeAllowed: false, presentationRevision: 1,
    };
    const sync = deferred<typeof readiness>();
    const read = jest.spyOn(ownerUxService, 'readReadiness').mockReturnValue(sync.promise);
    const key = imageInventoryKeys.readiness(identity, sessionId);
    client.setQueryData(key, readiness);
    const observer = new QueryObserver(client, {
        queryKey: key, queryFn: () => ownerUxService.readReadiness(sessionId), staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
        const screen = await mount();
        await addBook(screen);
        await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
        expect(leave().preventDefault).toHaveBeenCalled();
        expect(screen.getByRole('alertdialog', { name: 'Adding this book' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
        expect(mockRouter.replace).not.toHaveBeenCalled();
        await act(async () => { sync.resolve(readiness); });
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
        expect(mockReplacePreventDefault).not.toHaveBeenCalled();
    } finally { unsubscribe(); }
});
it('keeps the add disabled offline', async () => {
    mockOffline = true;
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    expect(screen.getByRole('button', { name: /^Add (?:book|candidate)$/u })).toBeDisabled();
    submit(screen);
    expect(ownerCorrectionService.addManualCandidate).not.toHaveBeenCalled();
});
it('retry replays the same key and command ID', async () => {
    const retry = deferred<Awaited<ReturnType<typeof ownerCorrectionService.addManualCandidate>>>();
    jest.mocked(ownerCorrectionService.addManualCandidate)
        .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_INTERNAL_ERROR'))
        .mockReturnValueOnce(retry.promise);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Add (?:book|candidate)$/u })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(screen.getByText('Retry same addition')).toBeTruthy());
    const original = jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls[0][0];
    leave();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
    fireEvent.press(screen.getByText('Retry same addition'));
    await waitFor(() => expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(2));
    const replay = jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls[1][0];
    expect(original).toMatchObject({ idempotencyKey: expect.any(String), commandId: expect.any(String) });
    expect(replay).toBe(original);
    expect(replay.idempotencyKey).toBe(original.idempotencyKey);
    expect(replay.commandId).toBe(original.commandId);
    expect(leave().preventDefault).toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Adding this book' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stay' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
    await act(async () => { retry.resolve({ candidateId, authenticatedUserId: identity.userId }); });
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(mockReplacePreventDefault).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
});

it.each([
    ['internal error', new OwnerCorrectionClientError('P9_INTERNAL_ERROR')],
    ['transport error', new Error('connection lost')],
])('keeps fields disabled after an unclear result (%s)', async (_name, error) => {
    jest.mocked(ownerCorrectionService.addManualCandidate).mockRejectedValueOnce(error);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(screen.getByText('The result is unclear. Retry the exact same addition.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Retry same addition' })).not.toBeDisabled();
    expect(screen.getByTestId('missed-title')).toHaveProp('editable', false);
    expect(screen.getByTestId('missed-author-0')).toHaveProp('editable', false);
    expect(screen.getByTestId('missed-title')).toHaveProp('accessibilityState', { disabled: true });
    expect(screen.getByTestId('missed-author-0')).toHaveProp('accessibilityState', { disabled: true });
    expect(screen.getByRole('button', { name: 'Choose language' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose language' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByRole('button', { name: 'Add another author' })).toBeDisabled();
    expect(leave().preventDefault).toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Leave without adding?' })).toBeTruthy();
    expect(screen.getByText('The book may already have been added. Check the review list before adding it again.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    leave();
    fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
    expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
});

it.each([
    ['session', { sessionId: testUuid(99) }],
    ['candidate', { candidateId: testUuid(99) }],
])('reports an unclear addition when the candidate read has a different %s', async (_name, patch) => {
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    jest.mocked(ownerUxService.readCandidate).mockResolvedValueOnce(candidateDetailFixture({ candidateId, ...patch }));
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(screen.getByText('The result is unclear. Retry the exact same addition.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Retry same addition' })).not.toBeDisabled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) });
    leave();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
    const original = jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls[0][0];
    fireEvent.press(screen.getByRole('button', { name: 'Retry same addition' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls[1][0]).toBe(original);
});

it('reports an unclear addition when the server reports another user', async () => {
    jest.mocked(ownerCorrectionService.addManualCandidate).mockResolvedValue({
        candidateId, authenticatedUserId: testUuid(77),
    });
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(screen.getByText('The result is unclear. Retry the exact same addition.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Retry same addition' })).not.toBeDisabled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('missed-title')).toHaveProp('editable', false);
    leave();
    expect(screen.getByRole('alertdialog', { name: 'Leave without adding?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy();
});

it('shows the conflict message when the session re-read fails', async () => {
    jest.mocked(ownerCorrectionService.addManualCandidate).mockRejectedValue(new OwnerCorrectionClientError('P9_STATE_CONFLICT'));
    // The mount read resolves; the re-read after the conflict refuses.
    let sessionReadsFail = false;
    jest.mocked(ownerBatchReviewService.readSessionV3).mockImplementation(async () => {
        if (sessionReadsFail) throw new Error('session read failed');
        return session;
    });
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    sessionReadsFail = true;
    submit(screen);
    await waitFor(() => expect(screen.getByText('This scan cannot accept another book.')).toBeTruthy());
    expect(screen.getByText('The latest scan-session state could not be verified.')).toBeTruthy();
});

it('reports an unclear addition when cache sync declines but the original identity is current again', async () => {
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    // The cache sync declines deterministically; the identity never changes.
    const synchronize = jest.spyOn(ownerCorrectionQueries, 'synchronizeCorrectionCandidate')
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(synchronize).toHaveBeenCalledTimes(1));
    await expect(synchronize.mock.results[0].value).resolves.toBe(false);
    await waitFor(() => expect(screen.getByText('The result is unclear. Retry the exact same addition.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Retry same addition' })).not.toBeDisabled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) });
    leave();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
    const original = jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls[0][0];
    fireEvent.press(screen.getByRole('button', { name: 'Retry same addition' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls[1][0]).toBe(original);
});

it('closes the language panel while a frozen addition exists', async () => {
    const add = deferred<Awaited<ReturnType<typeof ownerCorrectionService.addManualCandidate>>>();
    jest.mocked(ownerCorrectionService.addManualCandidate).mockReturnValueOnce(add.promise);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    openLanguages(screen);
    expect(screen.getByTestId('card-language-picker')).toBeTruthy();
    submit(screen);
    expect(screen.queryByTestId('card-language-picker') === null).toBe(true);
});

it.each([
    ['internal add error', 'add', new OwnerCorrectionClientError('P9_INTERNAL_ERROR')],
    ['transport add error', 'add', new Error('connection lost')],
    ['follow-up read error', 'read', new Error('read failed')],
    ['client error from the follow-up read', 'read', new OwnerCorrectionClientError('P9_REQUEST_INVALID')],
] as const)('invalidates the review list after an unclear %s', async (_name, stage, error) => {
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    if (stage === 'add') jest.mocked(ownerCorrectionService.addManualCandidate).mockRejectedValueOnce(error);
    else jest.mocked(ownerUxService.readCandidate).mockRejectedValueOnce(error);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    submit(screen);
    await waitFor(() => expect(screen.getByText('The result is unclear. Retry the exact same addition.')).toBeTruthy());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) });
    expect(screen.getByTestId('missed-title')).toHaveProp('editable', false);
    expect(screen.getByRole('button', { name: 'Retry same addition' })).not.toBeDisabled();
});

it('a definitive refusal after an unclear result unlocks the fields', async () => {
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    jest.mocked(ownerCorrectionService.addManualCandidate)
        .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_INTERNAL_ERROR'))
        .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_REQUEST_INVALID'));
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    submit(screen);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry same addition' })).not.toBeDisabled());
    fireEvent.press(screen.getByRole('button', { name: 'Retry same addition' }));
    await waitFor(() => expect(screen.getByText('Check the entered information and try again.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Retry same addition' })).toBeNull();
    expect(screen.getByTestId('missed-title')).toHaveProp('editable', true);
    expect(screen.getByTestId('missed-author-0')).toHaveProp('editable', true);
    expect(screen.getByRole('button', { name: 'Add another author' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose language' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled();
    expect(invalidate).toHaveBeenCalledTimes(1);
    openLanguages(screen);
    expect(screen.getByTestId('card-language-picker')).toBeTruthy();
    leave();
    expect(screen.getByText("This book's details exist only on this screen.")).toBeTruthy();
});

it('updates an open leave dialog when an add ends unclear', async () => {
    const add = deferred<Awaited<ReturnType<typeof ownerCorrectionService.addManualCandidate>>>();
    jest.mocked(ownerCorrectionService.addManualCandidate).mockReturnValueOnce(add.promise);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    submit(screen);
    leave();
    expect(screen.getByRole('alertdialog', { name: 'Adding this book' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
    await act(async () => { add.reject(new Error('connection lost')); });
    await waitFor(() => expect(screen.getByRole('alertdialog', { name: 'Leave without adding?' })).toBeTruthy());
    expect(screen.getByText('The book may already have been added. Check the review list before adding it again.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
    expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
});

it('navigates once after success', async () => {
    const batch = deferred<Awaited<ReturnType<typeof ownerBatchReviewService.readBatchReview>>>();
    jest.spyOn(ownerBatchReviewService, 'readBatchReview').mockReturnValue(batch.promise);
    const key = ownerBatchReviewKeys.batchReview(identity, sessionId);
    const observer = new QueryObserver(client, {
        queryKey: key, queryFn: () => ownerBatchReviewService.readBatchReview(sessionId), staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
        const screen = await mount();
        await addBook(screen);
        expect(mockRouter.replace).not.toHaveBeenCalled();
        expect(screen.getByTestId('missed-title')).toHaveProp('editable', false);
        await act(async () => { batch.resolve({
            sessionId, status: 'active', sessionVersion: 1, presentationRevision: 1,
            defaults: session.defaults, batchLabel: null, items: [], updatedAt: '2026-10-20T00:00:00Z',
            counts: { detected: 0, processing: 0, needsAttention: 0, reviewReadySaved: 0,
                committed: 0, ownerRemoved: 0, falseDetections: 0 },
        }); });
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
        expect(mockRouter.replace).toHaveBeenCalledWith('/(store-owner)/inventory/scan/' + sessionId);
        expect(mockReplacePreventDefault).not.toHaveBeenCalled();
        expect(leave().preventDefault).not.toHaveBeenCalled();
        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(screen.getByTestId('missed-title')).toHaveProp('editable', true);
    } finally { unsubscribe(); }
});

it.each([['hi', 'Hindi'], ['fr-CA', 'fr-CA']])('shows the language hint %s as %s in the value and label', async (hint, label) => {
    session = { ...session, defaults: { ...session.defaults, languageHint: hint } };
    const screen = await mount();
    expect(screen.getByLabelText(`Current language: ${label}`)).toHaveTextContent(label);
});

it('starts with the language panel closed and opens it on request', async () => {
    const screen = await mount();
    expect(screen.queryByTestId('card-language-picker')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Choose language' }));
    expect(screen.getByTestId('card-language-picker')).toBeTruthy();
    expect(screen.getByLabelText('Search languages')).toBeTruthy();
});

it('announces whether the language chooser is open', async () => {
    const screen = await mount();
    expect(screen.getByRole('button', { name: 'Choose language' }).props.accessibilityState)
        .toMatchObject({ expanded: false });
    fireEvent.press(screen.getByRole('button', { name: 'Choose language' }));
    expect(screen.getByRole('button', { name: 'Choose language' }).props.accessibilityState)
        .toMatchObject({ expanded: true });
});

it('drops the addition when the store changes', async () => {
    const add = deferred<Awaited<ReturnType<typeof ownerCorrectionService.addManualCandidate>>>();
    jest.mocked(ownerCorrectionService.addManualCandidate).mockReturnValue(add.promise);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1));

    // The resolved store changes while the add is in flight, so the screen is replaced.
    await act(async () => {
        (storeOwnerService.getGateState as jest.Mock).mockResolvedValue({
            state: 'active_owner', storeId: otherStoreId, storeName: 'Other store',
        });
        client.setQueryData(storeOwnerKeys.gate(identity.userId), {
            state: 'active_owner', storeId: otherStoreId, storeName: 'Other store',
        });
    });
    await waitFor(() => expect(screen.getByTestId('missed-title').props.value).toBe(''));

    await act(async () => { add.resolve({ candidateId, authenticatedUserId: identity.userId }); });

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.queryByText('The result is unclear. Retry the exact same addition.')).toBeNull();
    expect(screen.getByTestId('missed-title').props.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Retry same addition' })).toBeNull();
});

it('announces invalid fields assertively', async () => {
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), ' ');
    expect(screen.getByText('Enter a title between 1 and 512 characters.')).toHaveProp('accessibilityLiveRegion', 'assertive');
    expect(screen.getByRole('button', { name: 'Add book' })).toBeDisabled();
});
