jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('../review/useUnsavedEditsLeaveGuard', () => ({ useUnsavedEditsLeaveGuard: () => ({ visible: false }) }));
jest.mock('../screens/InventoryAccessBoundary', () => ({ InventoryAccessBoundary: ({ children }: any) => children({ userId: 'owner-a', storeId: 'store-a' }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
// Only the native window is simulated; the screen, cards and coordinator are real.
jest.mock('react-native/Libraries/Lists/FlatList', () => ({ __esModule: true, default: (props: any) => {
    const React = require('react');
    const { View, Text, Pressable } = require('react-native');
    const [visible, setVisible] = React.useState(true);
    return React.createElement(View, null, props.ListHeaderComponent,
        React.createElement(Pressable, { onPress: () => setVisible(!visible) },
            React.createElement(Text, null, visible ? 'Scroll cards out of view' : 'Scroll cards back into view')),
        visible ? props.data.map((item: any) => React.createElement(View, { key: item.candidateId }, props.renderItem({ item }))) : null,
        props.ListFooterComponent);
} }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanupAsync, fireEvent, render, waitFor } from '@testing-library/react-native';
import { InventoryCommitCoordinator } from '../commit/inventoryCommitCoordinator';
import { candidateCommitAuthorityKey } from '../commit/inventoryCommitPolicy';
import { InventorySessionProgressScreen } from '../screens/CaptureProgressScreens';
import { ownerBatchReviewKeys } from '../queries/ownerBatchReviewKeys';
import { ownerBatchReviewService } from '../api/ownerBatchReviewService';
import { ownerUxService } from '../api/ownerUxService';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { pickerCard, pickerDetail, pickerReview, pickerDefaults, pickerIdentity, selectedChoices, deferred } from '../testing/editionPickerClientFixtures';
import { resetOwnerRequestFence } from '../identity/ownerRequestFence';
import { resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import * as ownerUxQueries from '../queries/ownerUxQueries';
import type { OwnerBatchReview } from '../contracts/ownerBatchReviewContracts';

let testClient: QueryClient;
afterEach(async () => { await cleanupAsync(); testClient?.clear(); jest.restoreAllMocks(); });

// SDD-1 section 2/D2-2: retry keeps the saved command and the Owner's draft.
it.each(['retry', 'offscreen retry', 'external price', 'external equal'])('preserves command authority through the screen: %s', async mode => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
    testClient = client;
    resetOwnerRequestFence(pickerIdentity); resetImageInventoryIdentityForTests(pickerIdentity);
    jest.spyOn(ownerUxQueries, 'useOwnerInventoryInputs').mockReturnValue({ data: { items: [] },
        isLoading: false, refetch: jest.fn() } as any);
    let choices = selectedChoices();
    let card = pickerCard(choices, { ...pickerReview, quantity: 1, priceMinor: 25_000 });
    let detail = pickerDetail(choices, card.review);
    const batch = (): OwnerBatchReview => ({ sessionId: card.sessionId, status: 'active', sessionVersion: 1,
        presentationRevision: card.candidateVersion, defaults: { ...pickerDefaults, quantity: 1 }, batchLabel: null,
        counts: { detected: 1, processing: 0, needsAttention: 0, reviewReadySaved: 1, committed: 0, ownerRemoved: 0, falseDetections: 0 },
        items: [card], updatedAt: card.updatedAt });
    jest.spyOn(ownerBatchReviewService, 'readSessionV3').mockResolvedValue({ sessionId: card.sessionId,
        status: 'active', sessionVersion: 1, defaults: pickerDefaults, allInputsTerminal: false } as any);
    jest.spyOn(ownerBatchReviewService, 'readBatchReview').mockImplementation(async () => batch());
    jest.spyOn(ownerEditionPickerService, 'readEditionChoices').mockImplementation(async () => choices);
    const read = deferred<ReturnType<typeof pickerDetail>>();
    const candidateRead = jest.spyOn(ownerUxService, 'readCandidate').mockImplementationOnce(() => read.promise).mockImplementation(async () => detail);
    const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockImplementation(async request => {
        choices = { ...choices, candidateVersion: choices.candidateVersion + 1, reviewVersion: 1 };
        card = pickerCard(choices, request.review); detail = pickerDetail(choices, request.review);
        return detail;
    });
    const commit = jest.spyOn(ownerUxService, 'addCandidateToInventory').mockImplementation(async request => {
        card = { ...card, candidateState: 'committed', candidateVersion: request.expectedCandidateVersion + 1, allowedActions: [] };
        detail = { ...detail, candidateState: 'committed', candidateVersion: card.candidateVersion, allowedActions: [] };
        return { sessionId: request.sessionId, candidateId: request.candidateId, candidateVersion: card.candidateVersion,
            inventoryId: 'inventory', inventoryVersion: 1, outcome: 'committed_private' };
    });
    const retry = jest.spyOn(InventoryCommitCoordinator.prototype, 'retryAddAll');
    const screen = render(<QueryClientProvider client={client}><InventorySessionProgressScreen sessionId={card.sessionId} /></QueryClientProvider>);
    await screen.findByTestId('card-price-field');
    fireEvent.press(screen.getByTestId('card-price-field'));
    fireEvent.changeText(screen.getByTestId('card-custom-rupees'), '150');
    fireEvent.press(screen.getByLabelText('Use custom price'));
    if (mode === 'offscreen retry') {
        fireEvent.press(screen.getByText('Scroll cards out of view'));
        expect(screen.queryByTestId('card-price-field')).toBeNull();
    }
    fireEvent.press(screen.getByText('Add all ready books (1)'));
    await act(async () => { fireEvent.press(screen.getByText('Add all 1')); });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(candidateRead).toHaveBeenCalledTimes(1));
    const savedAuthorityKey = candidateCommitAuthorityKey(card);
    if (mode.startsWith('external')) {
        choices = { ...choices, candidateVersion: choices.candidateVersion + 1, reviewVersion: 2 };
        const changed = { ...card.review!, priceMinor: mode === 'external price' ? 99_000 : 15_000 };
        card = pickerCard(choices, changed); detail = pickerDetail(choices, changed);
        await act(async () => { await client.invalidateQueries({ queryKey: ownerBatchReviewKeys.batchReview(pickerIdentity, card.sessionId) }); });
        await screen.findByTestId('compact-authority-changed');
        await act(async () => { read.resolve(detail); });
        await screen.findByText('This book changed. Check it and press Add again.');
        expect(screen.getByTestId('compact-authority-changed')).toBeTruthy();
        expect(screen.getByTestId('card-price-overlay')).toBeTruthy();
        expect(screen.queryByText('Added to Inventory')).toBeNull();
        expect(commit).not.toHaveBeenCalled();
        expect(save).toHaveBeenCalledTimes(1);
        return;
    }
    await act(async () => { read.reject(new Error('read temporarily unavailable')); });
    await screen.findByText('Retry unresolved books');
    expect(screen.queryByTestId('compact-authority-changed')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByText('Retry unresolved books')); });
    expect(retry.mock.calls[0][1]?.[0].acceptedAuthorityKey).toBe(savedAuthorityKey);
    expect(commit).toHaveBeenCalledTimes(1);
    if (mode === 'offscreen retry') fireEvent.press(screen.getByText('Scroll cards back into view'));
    await screen.findByText('Added to Inventory');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ review: expect.objectContaining({
        priceMinor: 15_000, baseCondition: 'good', quantity: 1,
    }) }), expect.anything());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ expectedCandidateVersion: card.candidateVersion - 1,
        expectedReviewVersion: 1 }), expect.anything());
    await cleanupAsync(); client.clear(); jest.restoreAllMocks();
});
