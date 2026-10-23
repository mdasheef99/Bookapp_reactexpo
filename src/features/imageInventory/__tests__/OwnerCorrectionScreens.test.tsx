// Post-scan SDD-1 §§2/6 (4a), AC4-2/3/6/9. Real screen, access, queries and guard.
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { deferred, pickerChoices } from '../testing/editionPickerClientFixtures';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { OwnerUxClientError } from '../api/ownerUxTransport';
import { ownerEditionPickerKeys } from '../queries/ownerEditionPickerKeys';

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
    jest.spyOn(ownerEditionPickerService, 'setCandidateIsbn').mockResolvedValue({
        sessionId, candidateId, candidateVersion: 5, metadataRevision: 7,
        requestGeneration: 2, ownerIsbn13: '9780804429573',
    });
    jest.spyOn(ownerEditionPickerService, 'readEditionChoices').mockResolvedValue(pickerChoices({
        sessionId, candidateId, candidateVersion: 6, requestGeneration: 9, ownerIsbn13: '9780804429573',
    }));
    jest.spyOn(ownerEditionPickerService, 'requestEditionOptions').mockResolvedValue({
        operationId: testUuid(40), status: 'pending', requestGeneration: 10, optionsVersion: 1, available: false,
    });
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
function screenElement() {
    return <QueryClientProvider client={client}>
        <InventoryMissedBookScreen sessionId={sessionId} />
    </QueryClientProvider>;
}
async function mount() {
    const screen = render(screenElement());
    await waitFor(() => expect(screen.getByTestId('missed-title')).toBeTruthy());
    return screen;
}
// Offline Web pauses refetches, so a batch invalidation can stay pending until reconnect.
function stallBatchReviewRefresh() {
    const invalidate = client.invalidateQueries.bind(client);
    jest.spyOn(client, 'invalidateQueries').mockImplementation(((filters: { queryKey?: readonly unknown[] } = {}) => {
        if (filters.queryKey?.includes('batchReview')) return new Promise<void>(() => {});
        return invalidate(filters as never);
    }) as typeof client.invalidateQueries);
}
// Narrow submit copy so stale copy cannot hide a navigation/error/guard failure.
function submit(screen: Awaited<ReturnType<typeof mount>>) {
    fireEvent.press(screen.getByRole('button', { name: /^Add book$/u }));
}
async function addBook(screen: Awaited<ReturnType<typeof mount>>) {
    fireEvent.changeText(screen.getByTestId('missed-title'), ' A book ');
    fireEvent.changeText(screen.getByTestId('missed-author-0'), ' An author ');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Add book$/u })).not.toBeDisabled());
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
    expect(screen.getByRole('button', { name: 'Add book' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add candidate' })).toBeNull();
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
it('publishes an unclear result while the review refresh never settles', async () => {
    stallBatchReviewRefresh();
    jest.mocked(ownerCorrectionService.addManualCandidate)
        .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_INTERNAL_ERROR'));
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(screen.getByText('The result is unclear. Retry the exact same addition.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Retry same addition' })).not.toBeDisabled();
    leave();
    expect(screen.getByRole('alertdialog', { name: 'Leave without adding?' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
    expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
});
it('navigates once after success while the review refresh never settles', async () => {
    stallBatchReviewRefresh();
    const screen = await mount();
    await addBook(screen);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(store-owner)/inventory/scan/' + sessionId);
    expect(mockReplacePreventDefault).not.toHaveBeenCalled();
    expect(leave().preventDefault).not.toHaveBeenCalled();
});
it('publishes the conflict refusal while the session re-read never settles', async () => {
    jest.mocked(ownerCorrectionService.addManualCandidate)
        .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_STATE_CONFLICT'));
    let sessionReadStuck = false;
    jest.mocked(ownerBatchReviewService.readSessionV3).mockImplementation(async () => (
        sessionReadStuck ? new Promise<never>(() => {}) : session
    ));
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    sessionReadStuck = true;
    submit(screen);
    await waitFor(() => expect(screen.getByText('The item state changed. Refresh before trying again.')).toBeTruthy());
    expect(screen.getByTestId('missed-title')).toHaveProp('editable', true);
    expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Retry same addition' })).toBeNull();
});
it('keeps the newer outcome when a late conflict re-check reports an error', async () => {
    const reRead = deferred<OwnerSessionSummaryV3>();
    let reReadHeld = false;
    jest.mocked(ownerBatchReviewService.readSessionV3).mockImplementation(async () => (
        reReadHeld ? reRead.promise : session
    ));
    jest.mocked(ownerCorrectionService.addManualCandidate)
        .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_STATE_CONFLICT'))
        .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_REQUEST_INVALID'));
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    reReadHeld = true;
    submit(screen);
    await waitFor(() => expect(screen.getByText('The item state changed. Refresh before trying again.')).toBeTruthy());
    submit(screen);
    await waitFor(() => expect(screen.getByText('Check the entered information and try again.')).toBeTruthy());
    await act(async () => { reRead.reject(new Error('late session read failure')); });
    await waitFor(() => expect(screen.getByText('This scan cannot accept another book.')).toBeTruthy());
    expect(screen.getByText('Check the entered information and try again.')).toBeTruthy();
    expect(screen.queryByText('The latest scan-session state could not be verified.')).toBeNull();
});
it('maps the limit error to the scan-full text', async () => {
    jest.mocked(ownerCorrectionService.addManualCandidate).mockRejectedValue(new OwnerCorrectionClientError('P9_LIMIT_EXCEEDED'));
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Add book$/u })).not.toBeDisabled());
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
    await waitFor(() => expect(screen.getByRole('button', { name: /^Add book$/u })).not.toBeDisabled());
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
    await waitFor(() => expect(screen.getByRole('button', { name: /^Add book$/u })).not.toBeDisabled());
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
    expect(screen.getByRole('button', { name: /^Add book$/u })).toBeDisabled();
    submit(screen);
    expect(ownerCorrectionService.addManualCandidate).not.toHaveBeenCalled();
});
it('disables Retry offline and keeps Leave available', async () => {
    jest.mocked(ownerCorrectionService.addManualCandidate)
        .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_INTERNAL_ERROR'));
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry same addition' })).not.toBeDisabled());
    mockOffline = true;
    act(() => { screen.rerender(screenElement()); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry same addition' })).toBeDisabled());
    fireEvent.press(screen.getByRole('button', { name: 'Retry same addition' }));
    expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1);
    leave();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
    expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
});
it('retry replays the same key and command ID', async () => {
    const retry = deferred<Awaited<ReturnType<typeof ownerCorrectionService.addManualCandidate>>>();
    jest.mocked(ownerCorrectionService.addManualCandidate)
        .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_INTERNAL_ERROR'))
        .mockReturnValueOnce(retry.promise);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Add book$/u })).not.toBeDisabled());
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

it('shows the same unclear result after a second failure and replays the third attempt identically', async () => {
    const success = deferred<Awaited<ReturnType<typeof ownerCorrectionService.addManualCandidate>>>();
    jest.mocked(ownerCorrectionService.addManualCandidate)
        .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_INTERNAL_ERROR'))
        .mockRejectedValueOnce(new Error('connection lost'))
        .mockReturnValueOnce(success.promise);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    submit(screen);
    const retry = () => screen.getByRole('button', { name: 'Retry same addition' });
    await waitFor(() => expect(retry()).not.toBeDisabled());
    const original = jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls[0][0];
    fireEvent.press(retry());
    await waitFor(() => expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(retry()).not.toBeDisabled());
    expect(screen.getByText('The result is unclear. Retry the exact same addition.')).toBeTruthy();
    leave();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
    fireEvent.press(retry());
    await waitFor(() => expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(3));
    const third = jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls[2][0];
    expect(third).toBe(original);
    expect(third.idempotencyKey).toBe(original.idempotencyKey);
    expect(third.commandId).toBe(original.commandId);
    await act(async () => { success.resolve({ candidateId, authenticatedUserId: identity.userId }); });
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
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
        // The outcome is published without waiting for the paused batch refresh.
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
        expect(mockRouter.replace).toHaveBeenCalledWith('/(store-owner)/inventory/scan/' + sessionId);
        expect(screen.getByTestId('missed-title')).toHaveProp('editable', true);
        await act(async () => { batch.resolve({
            sessionId, status: 'active', sessionVersion: 1, presentationRevision: 1,
            defaults: session.defaults, batchLabel: null, items: [], updatedAt: '2026-10-20T00:00:00Z',
            counts: { detected: 0, processing: 0, needsAttention: 0, reviewReadySaved: 0,
                committed: 0, ownerRemoved: 0, falseDetections: 0 },
        }); });
        expect(mockRouter.replace).toHaveBeenCalledTimes(1);
        expect(mockReplacePreventDefault).not.toHaveBeenCalled();
        expect(leave().preventDefault).not.toHaveBeenCalled();
        expect(screen.queryByRole('alertdialog')).toBeNull();
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

it.each([
    ['store', async () => {
        (storeOwnerService.getGateState as jest.Mock).mockResolvedValue({
            state: 'active_owner', storeId: otherStoreId, storeName: 'Other store',
        });
        client.setQueryData(storeOwnerKeys.gate(identity.userId), {
            state: 'active_owner', storeId: otherStoreId, storeName: 'Other store',
        });
    }],
    ['account', async () => {
        const otherUserId = testUuid(92);
        setAuthState({ status: 'authenticated', initializationError: null, session: {
            access_token: 'test', refresh_token: 'test', expires_in: 3600, token_type: 'bearer',
            user: { id: otherUserId, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-20T00:00:00Z' },
        } });
        client.setQueryData(storeOwnerKeys.gate(otherUserId), {
            state: 'active_owner', storeId: identity.storeId, storeName: 'Test store',
        });
    }],
])('drops the addition when the %s changes', async (_name, switchScope) => {
    const add = deferred<Awaited<ReturnType<typeof ownerCorrectionService.addManualCandidate>>>();
    jest.mocked(ownerCorrectionService.addManualCandidate).mockReturnValue(add.promise);
    const screen = await mount();
    fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
    submit(screen);
    await waitFor(() => expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1));

    // The resolved scope or identity changes while the add is in flight, so the screen is replaced.
    await act(async () => { await switchScope(); });
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

// SDD 01a §15, dated Owner note and AC5b-1–8. The real screen owns navigation/guard.
describe('optional ISBN addition', () => {
    const saved = 'Book added. Open Find or change edition to choose its edition.';
    const saveFailed = "Book added, but the ISBN wasn't saved.";
    const searchFailed = "Book added. The ISBN search didn't start.";
    const set = () => jest.mocked(ownerEditionPickerService.setCandidateIsbn);
    const read = () => jest.mocked(ownerEditionPickerService.readEditionChoices);
    const search = () => jest.mocked(ownerEditionPickerService.requestEditionOptions);
    async function start(isbn = '0-8044-2957-X') {
        const screen = await mount();
        fireEvent.changeText(screen.getByLabelText('ISBN'), isbn);
        fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
        submit(screen);
        return screen;
    }
    function noAddRetry(screen: Awaited<ReturnType<typeof mount>>) {
        expect(screen.queryByRole('button', { name: 'Retry same addition' })).toBeNull();
        expect(mockRouter.replace).not.toHaveBeenCalled();
    }
    function finishLeaving(screen: Awaited<ReturnType<typeof mount>>, title: string) {
        fireEvent.press(screen.getByRole('button', { name: title }));
        expect(mockRouter.replace).toHaveBeenCalledTimes(1);
        expect(mockRouter.replace).toHaveBeenCalledWith('/(store-owner)/inventory/scan/' + sessionId);
        expect(mockReplacePreventDefault).not.toHaveBeenCalled();
    }
    it('labels the active-session ISBN box and configures text entry', async () => {
        const screen = await mount();
        expect(screen.getByText('ISBN (optional)')).toBeTruthy();
        expect(screen.getByText('On the back cover, above or below the barcode')).toBeTruthy();
        expect(screen.getByLabelText('ISBN').props).toMatchObject({
            maxLength: 17, autoCapitalize: 'characters', autoCorrect: false, editable: true,
        });
    });
    it.each(['9780140449137', '1000000000009'])('announces invalid %s under the box and sends nothing', async isbn => {
        const screen = await mount();
        fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
        fireEvent.changeText(screen.getByLabelText('ISBN'), isbn);
        expect(screen.getByText("Check the ISBN; the last digit doesn't match")).toHaveProp('accessibilityLiveRegion', 'assertive');
        expect(screen.UNSAFE_getAllByType(Text).filter(node => node.props.accessibilityLiveRegion === 'assertive')).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Add book' })).toBeDisabled();
        submit(screen);
        expect(ownerCorrectionService.addManualCandidate).not.toHaveBeenCalled();
        expect(set()).not.toHaveBeenCalled(); expect(search()).not.toHaveBeenCalled();
    });
    it.each(['', '   '])('runs the unchanged add-only path for %j', async isbn => {
        const screen = await start(isbn);
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
        expect(set()).not.toHaveBeenCalled(); expect(read()).not.toHaveBeenCalled(); expect(search()).not.toHaveBeenCalled();
        expect(jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls[0][0]).not.toHaveProperty('isbn');
        expect(jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls[0][0]).not.toHaveProperty('isbn13');
        expect(screen.queryByText(saved)).toBeNull();
    });
    it('adds, reads, saves the normalized ISBN, then caches/reuses re-read generation before search', async () => {
        stallBatchReviewRefresh();
        read().mockResolvedValueOnce(pickerChoices({ candidateId, candidateVersion: 6, requestGeneration: 9 , ownerIsbn13: '9780804429573' }))
            .mockResolvedValue(pickerChoices({ candidateId, candidateVersion: 7, requestGeneration: 21 , ownerIsbn13: '9780804429573' }));
        search().mockImplementationOnce(async () => {
            expect(client.getQueryData(ownerEditionPickerKeys.choices(identity, sessionId, candidateId)))
                .toMatchObject({ requestGeneration: 9 });
            return { operationId: testUuid(40), status: 'pending', requestGeneration: 10, optionsVersion: 1, available: false };
        });
        const screen = await start();
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        const add = jest.mocked(ownerCorrectionService.addManualCandidate);
        const candidateRead = jest.mocked(ownerUxService.readCandidate);
        expect(add.mock.invocationCallOrder[0]).toBeLessThan(candidateRead.mock.invocationCallOrder[0]);
        expect(candidateRead.mock.invocationCallOrder[0]).toBeLessThan(set().mock.invocationCallOrder[0]);
        expect(set().mock.invocationCallOrder[0]).toBeLessThan(read().mock.invocationCallOrder[0]);
        expect(read().mock.invocationCallOrder[0]).toBeLessThan(search().mock.invocationCallOrder[0]);
        expect(set()).toHaveBeenCalledWith(expect.objectContaining({
            sessionId, candidateId, isbn13: '9780804429573',
            expectedCandidateVersion: candidateDetailFixture().candidateVersion,
        }), expect.any(AbortSignal));
        expect(search()).toHaveBeenCalledTimes(1);
        expect(search()).toHaveBeenCalledWith(expect.objectContaining({ expectedRequestGeneration: 9 }), expect.any(AbortSignal));
        await waitFor(() => expect(client.getQueryData(ownerEditionPickerKeys.choices(identity, sessionId, candidateId)))
            .toMatchObject({ requestGeneration: 21 }));
        expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) });
        noAddRetry(screen);
        expect(screen.getByText(saved)).toHaveProp('accessibilityLiveRegion', 'polite');
        for (const label of ['Title required', 'Author 1', 'ISBN']) expect(screen.getByLabelText(label)).toHaveProp('editable', false);
        for (const name of ['Add another author', 'Choose language', 'Add book']) expect(screen.getByRole('button', { name })).toBeDisabled();
        expect(leave().preventDefault).not.toHaveBeenCalled();
        expect(screen.queryByRole('alertdialog')).toBeNull();
        finishLeaving(screen, 'Back to review');
    });
    it('finishes the ISBN path while every invalidation stays pending', async () => {
        jest.spyOn(client, 'invalidateQueries').mockImplementation(() => new Promise(() => {}));
        const screen = await start();
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        expect(set()).toHaveBeenCalledTimes(1);
        expect(search()).toHaveBeenCalledTimes(1);
        expect(client.getQueryData(imageInventoryKeys.candidate(identity, sessionId, candidateId)))
            .toMatchObject({ candidateId, sessionId });
        for (const queryKey of [imageInventoryKeys.discovery(identity), imageInventoryKeys.session(identity, sessionId),
            imageInventoryKeys.readiness(identity, sessionId)]) {
            expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey });
        }
        expect(screen.getByRole('button', { name: 'Back to review' })).not.toBeDisabled();
    });
    it('keeps Retry search after a failed session refetch and resumes when authority recovers', async () => {
        const screen = await mount();
        fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
        fireEvent.changeText(screen.getByLabelText('ISBN'), '0-8044-2957-X');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
        jest.mocked(ownerBatchReviewService.readSessionV3).mockRejectedValue(new Error('session refetch failed'));
        search().mockRejectedValueOnce(new Error('search failed'));
        submit(screen);
        await waitFor(() => expect(client.getQueryState(ownerBatchReviewKeys.sessionV3(identity, sessionId))?.status).toBe('error'));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Retry search' })).toBeDisabled());
        expect(screen.getByText(searchFailed)).toBeTruthy();
        expect(screen.queryByText('This scan cannot accept another book.')).toBeNull();
        jest.mocked(ownerBatchReviewService.readSessionV3).mockResolvedValue(session);
        await act(async () => { await client.refetchQueries({ queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId) }); });
        await waitFor(() => expect(screen.getByRole('button', { name: 'Retry search' })).not.toBeDisabled());
        fireEvent.press(screen.getByRole('button', { name: 'Retry search' }));
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        expect(search()).toHaveBeenCalledTimes(2);
        expect(set()).toHaveBeenCalledTimes(1);
        expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1);
    });
    it('keeps the successful Back to review title and message style after a session refetch fails', async () => {
        const screen = await mount();
        const messageColor = screen.getByText('Adds one book to this scan for you to check.').props.style.color;
        fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
        fireEvent.changeText(screen.getByLabelText('ISBN'), '0-8044-2957-X');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
        jest.mocked(ownerBatchReviewService.readSessionV3).mockRejectedValue(new Error('session refetch failed'));
        submit(screen);
        await waitFor(() => expect(client.getQueryState(ownerBatchReviewKeys.sessionV3(identity, sessionId))?.status).toBe('error'));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Back to review' })).not.toBeDisabled());
        expect(screen.getByText(saved)).toHaveStyle({ color: messageColor });
        finishLeaving(screen, 'Back to review');
    });
    it('finishes a confirmed search when receipt cache acceptance throws after a confirmed card outcome', async () => {
        search().mockImplementationOnce(async () => {
            client.setQueryData(imageInventoryKeys.candidate(identity, sessionId, candidateId),
                candidateDetailFixture({ candidateId, candidateState: 'committed' }));
            return { operationId: testUuid(40), status: 'pending', requestGeneration: 10, optionsVersion: 1, available: false };
        });
        const screen = await start();
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        expect(screen.queryByRole('button', { name: 'Retry search' })).toBeNull();
        expect(search()).toHaveBeenCalledTimes(1);
        finishLeaving(screen, 'Back to review');
    });
    it('replays a lost add response with the same add command before running ISBN steps', async () => {
        jest.mocked(ownerCorrectionService.addManualCandidate).mockRejectedValueOnce(new Error('lost add'));
        const screen = await start();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Retry same addition' })).not.toBeDisabled());
        expect(set()).not.toHaveBeenCalled(); expect(read()).not.toHaveBeenCalled(); expect(search()).not.toHaveBeenCalled();
        fireEvent.press(screen.getByRole('button', { name: 'Retry same addition' }));
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        const calls = jest.mocked(ownerCorrectionService.addManualCandidate).mock.calls;
        expect(calls[1][0]).toBe(calls[0][0]);
        expect(calls[1][0]).toEqual(calls[0][0]);
    });
    it.each(['network', 'internal'])('retries a %s ISBN save with the frozen command/version after the card moves', async kind => {
        stallBatchReviewRefresh();
        set().mockRejectedValueOnce(kind === 'internal' ? new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'internal') : new Error('lost'));
        const screen = await start();
        await waitFor(() => expect(screen.getByText(saveFailed)).toBeTruthy());
        noAddRetry(screen);
        expect(screen.getByText(saveFailed)).toHaveProp('accessibilityLiveRegion', 'polite');
        expect(read()).not.toHaveBeenCalled(); expect(search()).not.toHaveBeenCalled();
        const frozen = set().mock.calls[0][0];
        jest.mocked(ownerUxService.readCandidate).mockResolvedValue(candidateDetailFixture({ candidateId, candidateVersion: 30 }));
        read().mockResolvedValue(pickerChoices({ candidateId, candidateVersion: 31, requestGeneration: 11 , ownerIsbn13: '9780804429573' }));
        leave();
        expect(screen.getByRole('alertdialog', { name: 'Leave this screen?' })).toBeTruthy();
        expect(screen.getByText("This book is added, but its ISBN isn't saved.")).toBeTruthy();
        fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
        fireEvent.press(screen.getByRole('button', { name: 'Retry ISBN save' }));
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        expect(set()).toHaveBeenCalledTimes(2);
        expect(set().mock.calls[1][0]).toBe(frozen); expect(set().mock.calls[1][0]).toEqual(frozen);
        expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1);
        expect(ownerUxService.readCandidate).toHaveBeenCalledTimes(1);
        expect(search().mock.calls[0][0].expectedRequestGeneration).toBe(11);
    });
    it.each([
        ['P9_STATE_CONFLICT', 'active', "Book added, but the ISBN wasn't saved. This book can't be changed now."],
        ['P9_STATE_CONFLICT', 'closed', "Book added. This scan is closed, so the ISBN can't be saved."],
        ...(['P9_CANDIDATE_VERSION_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_REQUEST_INVALID', 'P9_IDEMPOTENCY_MISMATCH',
            'P9_NOT_FOUND', 'P9_OWNER_NOT_AUTHORIZED'] as const).map(code =>
            [code, 'active', "Book added, but the ISBN wasn't saved. Open Find or change edition to enter it."] as const),
    ] as const)('does not replay set refusal %s with an %s session and Leave navigates once', async (code, status, message) => {
        set().mockImplementation(async () => {
            session = { ...session, status };
            throw new OwnerUxClientError(code, true, 'refused');
        });
        const screen = await start();
        await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
        noAddRetry(screen);
        expect(screen.queryByRole('button', { name: 'Retry ISBN save' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Retry search' })).toBeNull();
        expect(read()).not.toHaveBeenCalled(); expect(search()).not.toHaveBeenCalled();
        submit(screen); submit(screen);
        finishLeaving(screen, 'Leave');
        expect(set()).toHaveBeenCalledTimes(1);
        expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1);
    });
    it.each(['active', 'closed'] as const)('publishes the set conflict before a pending session refetch reports %s', async status => {
        const refreshed = deferred<OwnerSessionSummaryV3>();
        set().mockImplementationOnce(async () => {
            jest.mocked(ownerBatchReviewService.readSessionV3).mockReturnValue(refreshed.promise);
            throw new OwnerUxClientError('P9_STATE_CONFLICT', true, 'refused');
        });
        const screen = await start();
        const generic = "Book added, but the ISBN wasn't saved. This book can't be changed now.";
        await waitFor(() => expect(screen.getByText(generic)).toBeTruthy());
        expect(screen.queryByRole('button', { name: 'Retry ISBN save' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Leave' })).not.toBeDisabled();
        await act(async () => refreshed.resolve({ ...session, status }));
        await waitFor(() => expect(screen.getByText(status === 'closed'
            ? "Book added. This scan is closed, so the ISBN can't be saved." : generic)).toBeTruthy());
        expect(set()).toHaveBeenCalledTimes(1);
    });
    it.each(['read', 'search'])('retries the first unfinished %s step without repeating the set or add', async step => {
        if (step === 'read') read().mockRejectedValueOnce(new Error('lost read'));
        else search().mockRejectedValueOnce(new Error('lost search'));
        const screen = await start();
        await waitFor(() => expect(screen.getByText(searchFailed)).toBeTruthy());
        noAddRetry(screen);
        if (step === 'read') expect(search()).not.toHaveBeenCalled();
        const frozen = search().mock.calls[0]?.[0];
        read().mockResolvedValue(pickerChoices({ candidateId, candidateVersion: 40, requestGeneration: 20 , ownerIsbn13: '9780804429573' }));
        leave();
        expect(screen.getByText("This book is added and its ISBN is saved, but the search didn't start.")).toBeTruthy();
        fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
        fireEvent.press(screen.getByRole('button', { name: 'Retry search' }));
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1);
        expect(set()).toHaveBeenCalledTimes(1);
        if (step === 'search') {
            expect(search()).toHaveBeenCalledTimes(2);
            expect(search().mock.calls[1][0]).toBe(frozen); expect(search().mock.calls[1][0]).toEqual(frozen);
            expect(frozen.expectedRequestGeneration).toBe(9);
        } else expect(search().mock.calls[0][0].expectedRequestGeneration).toBe(20);
    });
    it.each(['read', 'search'].flatMap(step =>
        (['P9_VERSION_CONFLICT', 'P9_STATE_CONFLICT', 'P9_REQUEST_INVALID'] as const).map(code => [step, code] as const)))
    ('does not retry a refused %s with %s and offers Leave', async (step, code) => {
        (step === 'read' ? read() : search()).mockRejectedValue(new OwnerUxClientError(code, true, 'refused'));
        const screen = await start();
        await waitFor(() => expect(screen.getByText(searchFailed + ' Open Find or change edition to search.')).toBeTruthy());
        noAddRetry(screen);
        expect(screen.queryByRole('button', { name: 'Retry search' })).toBeNull();
        if (step === 'read') {
            expect(read()).toHaveBeenCalledTimes(1);
            expect(search()).not.toHaveBeenCalled();
        }
        submit(screen); submit(screen);
        finishLeaving(screen, 'Leave');
        expect(step === 'read' ? read() : search()).toHaveBeenCalledTimes(1);
    });
    it.each(['set', 'read', 'search'])('blocks leaving/double presses while %s is pending and stays until search ends', async step => {
        const done = deferred<any>();
        const operation = step === 'set' ? set() : step === 'read' ? read() : search();
        operation.mockReturnValueOnce(done.promise);
        const screen = await start();
        await waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
        expect(mockRouter.replace).not.toHaveBeenCalled();
        submit(screen); submit(screen);
        expect(screen.getByLabelText('ISBN')).toHaveProp('editable', false);
        leave();
        expect(screen.getByRole('alertdialog', { name: 'Adding this book' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
        fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
        await act(async () => done.resolve(step === 'set' ? { sessionId, candidateId, candidateVersion: 5, metadataRevision: 7,
            requestGeneration: 2, ownerIsbn13: '9780804429573' } : step === 'read'
            ? pickerChoices({ candidateId, candidateVersion: 6, requestGeneration: 9 , ownerIsbn13: '9780804429573' })
            : { operationId: testUuid(40), status: 'pending', requestGeneration: 10, optionsVersion: 1, available: false }));
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1);
        expect(set()).toHaveBeenCalledTimes(1); expect(search()).toHaveBeenCalledTimes(1);
        noAddRetry(screen);
    });
    it.each(['initially closed', 'closed after typing'])('ignores ISBN when %s', async when => {
        if (when === 'initially closed') session = { ...session, status: 'closed' };
        const screen = await mount();
        if (when === 'closed after typing') {
            fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
            await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
            fireEvent.changeText(screen.getByLabelText('ISBN'), 'bad ISBN');
            session = { ...session, status: 'closed' };
            await act(async () => { await client.invalidateQueries({ queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId) }); });
            expect(client.getQueryData(ownerBatchReviewKeys.sessionV3(identity, sessionId))).toMatchObject({ status: 'closed' });
        }
        await waitFor(() => expect(screen.queryByLabelText('ISBN') === null).toBe(true));
        await addBook(screen);
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
        expect(set()).not.toHaveBeenCalled(); expect(read()).not.toHaveBeenCalled(); expect(search()).not.toHaveBeenCalled();
    });
    it.each(['set', 'read', 'search'])('ignores a late %s result after unmount', async step => {
        const done = deferred<any>();
        (step === 'set' ? set() : step === 'read' ? read() : search()).mockReturnValueOnce(done.promise);
        const screen = await start();
        const operation = step === 'set' ? set() : step === 'read' ? read() : search();
        await waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
        const signal = operation.mock.calls[0][1];
        screen.unmount();
        expect(signal.aborted).toBe(true);
        await act(async () => done.resolve({ sessionId, candidateId }));
        expect(mockRouter.replace).not.toHaveBeenCalled();
        if (step === 'set') expect(read()).not.toHaveBeenCalled();
        if (step !== 'search') expect(search()).not.toHaveBeenCalled();
    });
    it.each(['set', 'read', 'search'])('aborts and ignores late %s results when the store changes', async step => {
        const done = deferred<any>();
        const operation = step === 'set' ? set() : step === 'read' ? read() : search();
        operation.mockReturnValueOnce(done.promise);
        const screen = await start();
        await waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
        const signal = operation.mock.calls[0][1];
        await act(async () => {
            (storeOwnerService.getGateState as jest.Mock).mockResolvedValue({ state: 'active_owner', storeId: otherStoreId, storeName: 'Other' });
            client.setQueryData(storeOwnerKeys.gate(identity.userId), { state: 'active_owner', storeId: otherStoreId, storeName: 'Other' });
        });
        await waitFor(() => expect(screen.getByTestId('missed-title').props.value).toBe(''));
        expect(signal.aborted).toBe(true);
        await act(async () => done.resolve({ sessionId, candidateId }));
        expect(mockRouter.replace).not.toHaveBeenCalled();
        expect(screen.queryByText(saved)).toBeNull();
        if (step === 'set') expect(read()).not.toHaveBeenCalled();
        if (step !== 'search') expect(search()).not.toHaveBeenCalled();
    });
    it.each(['set', 'read', 'search'])('aborts and ignores late %s results when the session changes', async step => {
        const done = deferred<any>();
        const operation = step === 'set' ? set() : step === 'read' ? read() : search();
        operation.mockReturnValueOnce(done.promise);
        const screen = await start();
        await waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
        const signal = operation.mock.calls[0][1];
        const nextSessionId = testUuid(93);
        const calls = [set().mock.calls.length, read().mock.calls.length, search().mock.calls.length];
        const invalidate = jest.spyOn(client, 'invalidateQueries');
        session = { ...session, sessionId: nextSessionId };
        screen.rerender(<QueryClientProvider client={client}>
            <InventoryMissedBookScreen sessionId={nextSessionId} />
        </QueryClientProvider>);
        await waitFor(() => expect(screen.getByTestId('missed-title').props.value).toBe(''));
        expect(signal.aborted).toBe(true);
        fireEvent.changeText(screen.getByTestId('missed-title'), 'Session B draft');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Add book' })).not.toBeDisabled());
        const nextScreen = screen.toJSON();
        await act(async () => done.resolve(step === 'set'
            ? { sessionId, candidateId, candidateVersion: 5, metadataRevision: 7, requestGeneration: 2, ownerIsbn13: '9780804429573' }
            : step === 'read' ? pickerChoices({ candidateId, candidateVersion: 6, requestGeneration: 9 , ownerIsbn13: '9780804429573' })
                : { operationId: testUuid(40), status: 'pending', requestGeneration: 10, optionsVersion: 1, available: false }));
        expect([set().mock.calls.length, read().mock.calls.length, search().mock.calls.length]).toEqual(calls);
        expect(invalidate).not.toHaveBeenCalled();
        expect(screen.toJSON()).toEqual(nextScreen);
        expect(screen.queryByText(saved)).toBeNull();
        expect(mockRouter.replace).not.toHaveBeenCalled();
        expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    });
    it('checks the ISBN set response scope before proceeding', async () => {
        set().mockResolvedValueOnce({ sessionId, candidateId: testUuid(99), candidateVersion: 5,
            metadataRevision: 7, requestGeneration: 2, ownerIsbn13: '9780804429573' });
        const screen = await start();
        await waitFor(() => expect(screen.getByText(saveFailed + ' Open Find or change edition to enter it.')).toBeTruthy());
        expect(screen.queryByRole('button', { name: 'Retry ISBN save' })).toBeNull();
        noAddRetry(screen);
        expect(read()).not.toHaveBeenCalled(); expect(search()).not.toHaveBeenCalled();
        submit(screen);
        expect(set()).toHaveBeenCalledTimes(1);
        finishLeaving(screen, 'Leave');
    });
    it('reports an unretryable save when the ISBN set response has a different candidate', async () => {
        set().mockResolvedValueOnce({ sessionId, candidateId: testUuid(99), candidateVersion: 5,
            metadataRevision: 7, requestGeneration: 2, ownerIsbn13: '9780804429573' });
        const screen = await start();
        await waitFor(() => expect(screen.getByText("Book added, but the ISBN wasn't saved. Open Find or change edition to enter it.")).toBeTruthy());
        expect(screen.queryByRole('button', { name: 'Retry ISBN save' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Retry search' })).toBeNull();
        noAddRetry(screen);
        expect(jest.mocked(ownerCorrectionService.addManualCandidate)).toHaveBeenCalledTimes(1);
        expect(set()).toHaveBeenCalledTimes(1);
        expect(read()).not.toHaveBeenCalled(); expect(search()).not.toHaveBeenCalled();
        finishLeaving(screen, 'Leave');
    });
    it('refreshes lists when the ISBN save is refused with P9_STATE_CONFLICT', async () => {
        const invalidate = jest.spyOn(client, 'invalidateQueries');
        set().mockRejectedValueOnce(new OwnerUxClientError('P9_STATE_CONFLICT', true, 'refused'));
        const screen = await start();
        await waitFor(() => expect(screen.getByText("Book added, but the ISBN wasn't saved. This book can't be changed now.")).toBeTruthy());
        expect(set()).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('button', { name: 'Retry ISBN save' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Retry search' })).toBeNull();
        noAddRetry(screen);
        expect(read()).not.toHaveBeenCalled(); expect(search()).not.toHaveBeenCalled();
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: imageInventoryKeys.candidate(identity, sessionId, candidateId) });
        finishLeaving(screen, 'Leave');
    });
    it('does not retry a mismatching ISBN choices re-read', async () => {
        read().mockResolvedValueOnce(pickerChoices({ candidateId: testUuid(99), candidateVersion: 6 }));
        const screen = await start();
        await waitFor(() => expect(screen.getByText(searchFailed + ' Open Find or change edition to search.')).toBeTruthy());
        expect(screen.queryByRole('button', { name: 'Retry search' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Retry ISBN save' })).toBeNull();
        noAddRetry(screen);
        expect(search()).not.toHaveBeenCalled();
        expect(set()).toHaveBeenCalledTimes(1);
        expect(jest.mocked(ownerCorrectionService.addManualCandidate)).toHaveBeenCalledTimes(1);
        expect(jest.mocked(ownerUxService.readCandidate)).toHaveBeenCalledTimes(1);
        expect(read()).toHaveBeenCalledTimes(1);
        submit(screen);
        expect(search()).not.toHaveBeenCalled();
        finishLeaving(screen, 'Leave');
    });
    it.each([['another ISBN', '9780140449136'], ['no ISBN', null]])(
        'stops without a search when another device changed the ISBN before the re-read (%s)', async (_label, other) => {
        read().mockResolvedValueOnce(pickerChoices({ candidateId, candidateVersion: 7, metadataRevision: 8,
            requestGeneration: 10, ownerIsbn13: other }));
        const screen = await start();
        await waitFor(() => expect(screen.getByText('Book added. The ISBN was saved, but this book changed before the search could start. Open Find or change edition to search.')).toBeTruthy());
        expect(screen.queryByRole('button', { name: 'Retry search' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Retry ISBN save' })).toBeNull();
        noAddRetry(screen);
        expect(search()).not.toHaveBeenCalled();
        expect(set()).toHaveBeenCalledTimes(1);
        expect(jest.mocked(ownerCorrectionService.addManualCandidate)).toHaveBeenCalledTimes(1);
        expect(read()).toHaveBeenCalledTimes(1);
        submit(screen);
        expect(search()).not.toHaveBeenCalled();
        finishLeaving(screen, 'Leave');
    });
    it('still searches from the re-read generation when only a benign change raised it', async () => {
        read().mockResolvedValueOnce(pickerChoices({ candidateId, candidateVersion: 8, metadataRevision: 9,
            requestGeneration: 12, ownerIsbn13: '9780804429573' }));
        const screen = await start();
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        expect(search()).toHaveBeenCalledTimes(1);
        expect(search().mock.calls[0][0]).toMatchObject({ expectedRequestGeneration: 12 });
        finishLeaving(screen, 'Back to review');
    });
    it('publishes search success before a best-effort reconciliation stalls', async () => {
        read().mockResolvedValueOnce(pickerChoices({ candidateId, candidateVersion: 6, requestGeneration: 9 , ownerIsbn13: '9780804429573' }))
            .mockReturnValueOnce(new Promise(() => {}));
        const screen = await start();
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        await waitFor(() => expect(read()).toHaveBeenCalledTimes(2));
        expect(screen.getByRole('button', { name: 'Back to review' })).not.toBeDisabled();
        finishLeaving(screen, 'Back to review');
    });
    it('uses the ISBN keyboard with X available on iOS', async () => {
        const select = Platform.select;
        jest.spyOn(Platform, 'select').mockImplementation(options => options.ios === 'numbers-and-punctuation' ? options.ios : select(options));
        const screen = await mount();
        expect(screen.getByLabelText('ISBN')).toHaveProp('keyboardType', 'numbers-and-punctuation');
    });
    it('resumes a failed candidate read without repeating a confirmed ISBN add', async () => {
        const invalidate = jest.spyOn(client, 'invalidateQueries');
        jest.mocked(ownerUxService.readCandidate).mockRejectedValueOnce(new Error('lost read'));
        const screen = await start();
        await waitFor(() => expect(screen.getByText(saveFailed)).toBeTruthy());
        expect(invalidate.mock.calls.filter(([filters]) =>
            JSON.stringify(filters?.queryKey) === JSON.stringify(ownerBatchReviewKeys.batchReview(identity, sessionId)))).toHaveLength(1);
        noAddRetry(screen);
        expect(set()).not.toHaveBeenCalled(); expect(read()).not.toHaveBeenCalled(); expect(search()).not.toHaveBeenCalled();
        fireEvent.press(screen.getByRole('button', { name: 'Retry ISBN save' }));
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1);
        expect(ownerUxService.readCandidate).toHaveBeenCalledTimes(2);
    });
    it('refreshes the review list when synchronization declines and retries only the unfinished synchronization', async () => {
        const synchronize = jest.spyOn(ownerCorrectionQueries, 'cacheCorrectionCandidate').mockReturnValueOnce(false);
        const invalidate = jest.spyOn(client, 'invalidateQueries');
        const screen = await start();
        await waitFor(() => expect(screen.getByText(saveFailed)).toBeTruthy());
        expect(invalidate.mock.calls.filter(([filters]) =>
            JSON.stringify(filters?.queryKey) === JSON.stringify(ownerBatchReviewKeys.batchReview(identity, sessionId)))).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Retry ISBN save' })).not.toBeDisabled();
        expect(set()).not.toHaveBeenCalled();
        fireEvent.press(screen.getByRole('button', { name: 'Retry ISBN save' }));
        await waitFor(() => expect(screen.getByText(saved)).toBeTruthy());
        expect(synchronize).toHaveBeenCalledTimes(2);
        expect(ownerUxService.readCandidate).toHaveBeenCalledTimes(1);
        expect(ownerCorrectionService.addManualCandidate).toHaveBeenCalledTimes(1);
    });
    it.each(['set', 'read', 'search'])('ignores late %s results after switching account', async step => {
        const done = deferred<any>();
        const operation = step === 'set' ? set() : step === 'read' ? read() : search();
        operation.mockReturnValueOnce(done.promise);
        const screen = await start();
        await waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
        const signal = operation.mock.calls[0][1];
        const otherUserId = testUuid(92);
        await act(async () => {
            setAuthState({ status: 'authenticated', initializationError: null, session: {
                access_token: 'test', refresh_token: 'test', expires_in: 3600, token_type: 'bearer',
                user: { id: otherUserId, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-20T00:00:00Z' },
            } });
            client.setQueryData(storeOwnerKeys.gate(otherUserId), { state: 'active_owner', storeId: identity.storeId, storeName: 'Test' });
        });
        await waitFor(() => expect(screen.getByTestId('missed-title').props.value).toBe(''));
        expect(signal.aborted).toBe(true);
        await act(async () => done.resolve({ sessionId, candidateId }));
        expect(mockRouter.replace).not.toHaveBeenCalled();
        expect(screen.queryByText(saved)).toBeNull();
        if (step === 'set') expect(read()).not.toHaveBeenCalled();
        if (step !== 'search') expect(search()).not.toHaveBeenCalled();
    });
});
