import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { InventorySessionProgressScreen } from '../screens/CaptureProgressScreens';
import { BatchReviewCard } from '../components/BatchReviewCard';
import { useUnsavedEditsLeaveGuard } from '../review/useUnsavedEditsLeaveGuard';
import { selectedChoices } from '../testing/editionPickerClientFixtures';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitTypes';

const mockNavigation = { addListener: jest.fn((_name: string, _listener: (event: any) => void) => jest.fn()), dispatch: jest.fn() };
let mockInFlight = new Set<string>();
const mockOutcomes = new Map<string, CandidateCommitOutcome>();
const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockRefetch = jest.fn(() => Promise.resolve({ isError: false, error: null }));
const mockRemoveMutate = jest.fn();
const mockResolveDuplicateMutate = jest.fn();
const mockCandidateRemoveMutate = jest.fn();
const mockClaimSlot = jest.fn<string | null, [string, string]>(() => 'slot-token');
const mockReleaseSlot = jest.fn();
let mockBulkResult: any = null;
let mockFocused = true;
// NEW 6G-C composition: session authority is read through v3 and the compact
// review aggregate is supplemental candidate authority alongside Unit 6 input
// observation.
const mockSessionV3: Record<string, unknown> = {
    data: {
        sessionId: '00000000-0000-4000-8000-000000000010',
        status: 'active', sessionVersion: 4,
        startedAt: '2026-07-31T00:00:00.000Z',
        updatedAt: '2026-07-31T00:00:00.000Z',
        closedAt: null, expiresAt: '2026-08-30T00:00:00.000Z',
        defaults: {
            languageHint: 'en', condition: null, location: 'Front shelf',
            priceMinor: null, quantity: 1, publication: 'private', script: null,
        },
        batchLabel: null,
        closeSummary: {}, allInputsTerminal: false,
        closeState: 'not_closeable', presentationRevision: 5,
    },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
};
const mockInputs = {
    data: {
        presentationRevision: 2,
        items: [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1,
            inputVersion: 3,
            presentationState: 'needs_attention',
            retryState: 'new_upload_required',
            safeCode: 'P9_VISION_OVER_LIMIT',
            acceptedCandidateCount: 0,
        }],
    },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
};
const mockBatchReview: Record<string, unknown> = {
    data: {
        sessionId: '00000000-0000-4000-8000-000000000010',
        status: 'active', sessionVersion: 4, presentationRevision: 5,
        defaults: {
            languageHint: 'en', condition: null, location: 'Front shelf',
            priceMinor: null, quantity: 1, publication: 'private', script: null,
        },
        batchLabel: null,
        counts: {
            detected: 1, processing: 0, needsAttention: 1, reviewReadySaved: 0,
            committed: 0, ownerRemoved: 0, falseDetections: 0,
        },
        items: [{
            sessionId: '00000000-0000-4000-8000-000000000010',
            candidateId: '00000000-0000-4000-8000-000000000002',
            inputId: null,
            ordinal: 1,
            title: 'Original book',
            authors: ['Original author'],
            language: 'en',
            candidateState: 'needs_review',
            candidateVersion: 1,
            metadataState: 'manual',
            metadataRevision: 1,
            reviewDisposition: null,
            observed: {
                title: 'Original book',
                authors: ['Original author'],
                language: 'en',
                script: null,
            },
            metadataSummary: null,
            review: null,
            reviewVersion: null,
            fieldSources: {
                cover: 'missing', title: 'detected', authors: 'detected',
                language: 'detected', condition: 'missing', price: 'missing',
                quantity: 'default', location: 'missing', publication: 'default',
                damage: 'default',
            },
            attentionCodes: ['metadata_manual_required'],
            blockers: [],
            reviewReady: false,
            allowedActions: [],
            updatedAt: '2026-07-31T00:00:00.000Z',
        }],
        updatedAt: '2026-07-31T00:00:00.000Z',
    },
    isLoading: false,
    error: null as Error | null,
    refetch: mockRefetch,
};

jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useNavigation: () => mockNavigation }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        textPrimary: '#111', textSecondary: '#333', error: '#900', border: '#ccc',
    } }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOffline: false }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: any) => children,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: any) => children,
}));
jest.mock('../screens/InventoryAccessBoundary', () => ({
    InventoryAccessBoundary: ({ children }: any) => children({ userId: 'owner-1', storeId: 'store-1' }),
}));
jest.mock('../queries/ownerUxQueries', () => ({
    useOwnerInventoryDiscovery: jest.fn(),
    useOwnerInventoryInputs: () => mockInputs,
}));
jest.mock('../queries/ownerBatchReviewQueries', () => ({
    useOwnerSessionV3: () => mockSessionV3,
    useOwnerBatchReview: () => mockBatchReview,
    useRemoveOwnerInventoryCandidate: () => ({
        mutate: mockCandidateRemoveMutate,
        isPending: false,
    }),
    useSaveOwnerCandidateReview: () => ({ mutate: jest.fn(), isPending: false }),
    useCloseOwnerInventorySessionV3: () => ({ mutate: jest.fn(), isPending: false }),
}));
// Picker SDD §§6–7: edition reads are covered by mounted picker suites; this
// legacy progress suite supplies the same query seam as its other hook mocks.
jest.mock('../queries/ownerEditionPickerQueries', () => ({
    useOwnerEditionChoices: () => ({ data: undefined, isLoading: false, error: null }),
}));
jest.mock('../queries/ownerUxInputQueries', () => ({
    useRemoveOwnerInventoryInput: () => ({
        mutate: mockRemoveMutate,
        isPending: false,
        error: null,
    }),
    useResolveDuplicateOwnerInventoryInput: () => ({
        mutate: mockResolveDuplicateMutate,
        isPending: false,
        error: null,
    }),
}));
jest.mock('../commit/useInventoryCommitCoordinator', () => ({
    useInventoryCommitCoordinator: () => ({
        addCandidate: jest.fn(),
        addAll: jest.fn(),
        retryAddAll: jest.fn(),
        inFlight: mockInFlight,
        outcomes: mockOutcomes,
        bulkResult: mockBulkResult,
        bulkPending: false,
        claimSlot: mockClaimSlot,
        releaseSlot: mockReleaseSlot,
        isCommandActive: () => false,
    }),
}));
jest.mock('../capture/captureIds', () => ({
    createSemanticKey: () => 'remove-input:00000000-0000-4000-8000-000000000008',
    createCaptureUuid: () => '00000000-0000-4000-8000-000000000009',
}));

describe('Phase 9 Unit 6C server progress and handoff', () => {
    const registeredInput = mockInputs.data.items[0];
    afterEach(async () => {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 60));
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockBulkResult = null;
        mockFocused = true;
        registeredInput.safeCode = 'P9_VISION_OVER_LIMIT';
        registeredInput.acceptedCandidateCount = 0;
        mockInputs.data.items = [registeredInput];
    });

    it('keeps remove image but does not offer a second image while one is registered', () => {
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );

        expect(screen.getByText('Remove image')).toBeTruthy();
        expect(screen.queryByText('Add another image')).toBeNull();
        expect(screen.queryByText('Choose replacement image')).toBeNull();
    });

    it('shows a dismissible duplicate warning that can be reopened and explicitly proceeded', async () => {
        mockInputs.data.items[0] = {
            ...mockInputs.data.items[0],
            inputState: 'awaiting_duplicate_confirmation',
            presentationState: 'duplicate_confirmation_required',
            retryState: 'none', terminal: false, polling: false,
            safeCode: 'P9_MEDIA_DUPLICATE_INPUT',
            duplicateConfirmationVersion: 1,
            duplicateConfirmationExpiresAt: '2026-08-30T00:00:00.000Z',
        } as any;
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        await waitFor(() => expect(screen.getByText('Duplicate image')).toBeTruthy());
        fireEvent.press(screen.getByText('Not now'));
        expect(screen.queryByText('Continue with this upload?')).toBeNull();
        fireEvent.press(screen.getByText('Review duplicate'));
        fireEvent.press(screen.getByText('Proceed'));
        expect(mockResolveDuplicateMutate).toHaveBeenCalledWith(expect.objectContaining({
            decision: 'proceed', expectedConfirmationVersion: 1,
        }), expect.any(Object));
        expect(screen.queryByText('Trying again')).toBeNull();
    });

    it('does not reuse a duplicate command after the confirmation version changes', async () => {
        mockInputs.data.items[0] = {
            ...mockInputs.data.items[0],
            inputState: 'awaiting_duplicate_confirmation',
            presentationState: 'duplicate_confirmation_required',
            retryState: 'none', terminal: false, polling: false,
            safeCode: 'P9_MEDIA_DUPLICATE_INPUT',
            inputVersion: 3,
            duplicateConfirmationVersion: 1,
            duplicateConfirmationExpiresAt: '2026-08-30T00:00:00.000Z',
        } as any;
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        await waitFor(() => expect(screen.getByText('Duplicate image')).toBeTruthy());
        fireEvent.press(screen.getByText('Proceed'));
        const first = mockResolveDuplicateMutate.mock.calls[0][0];
        mockInputs.data.items[0] = {
            ...mockInputs.data.items[0], inputVersion: 4, duplicateConfirmationVersion: 2,
        } as any;
        screen.rerender(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        await waitFor(() => expect(screen.getByText('Duplicate image')).toBeTruthy());
        fireEvent.press(screen.getByText('Proceed'));
        const second = mockResolveDuplicateMutate.mock.calls[1][0];
        expect(first).toEqual(expect.objectContaining({ expectedInputVersion: 3, expectedConfirmationVersion: 1 }));
        expect(second).toEqual(expect.objectContaining({ expectedInputVersion: 4, expectedConfirmationVersion: 2 }));
    });

    it('labels image attention separately from per-book review counts', () => {
        const originalInput = mockInputs.data.items[0];
        const originalCounts = (mockBatchReview.data as Record<string, any>).counts;
        mockInputs.data.items = [{
            ...originalInput,
            presentationState: 'ready',
            retryState: 'none',
            safeCode: null,
            terminal: true,
            acceptedCandidateCount: 1,
        }] as any;
        (mockBatchReview.data as Record<string, any>).counts = {
            ...originalCounts,
            detected: 1,
            processing: 0,
            needsAttention: 1,
        };
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );

        expect(screen.getByText('Image processing: 1 ready, 0 need attention, 0 processing.')).toBeTruthy();
        expect(screen.getByText(/Book review is counted separately below/iu)).toBeTruthy();
        expect(screen.queryByText(/Need review counts individual books/iu)).toBeNull();
        expect(screen.getByText('Need review')).toBeTruthy();

        mockInputs.data.items = [originalInput];
        (mockBatchReview.data as Record<string, any>).counts = originalCounts;
    });

    it('offers a replacement only after the current image has disappeared', () => {
        const originalItems = mockInputs.data.items;
        mockInputs.data.items = [] as typeof originalItems;
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );

        fireEvent.press(screen.getByText('Choose replacement image'));
        expect(mockRouter.push).toHaveBeenCalledWith('/(store-owner)/inventory/scan');
        mockInputs.data.items = originalItems;
    });

    it('does not offer input removal after book candidates exist', () => {
        const input = mockInputs.data.items[0];
        const originalCount = input.acceptedCandidateCount;
        input.acceptedCandidateCount = 1;
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );

        expect(screen.queryByText('Remove image')).toBeNull();
        expect(screen.getByText('Review the books found from this image instead of removing it.')).toBeTruthy();
        input.acceptedCandidateCount = originalCount;
    });

    it('renders terminal over-limit guidance without a full-correction action', () => {
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByText(/More than 15 books/u)).toBeTruthy();
        expect(screen.queryByText('Open first book in full review')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Open full correction' })).toBeNull();
    });

    it('opens the real missed-book route from an accessible reviewable session', () => {
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        fireEvent.press(screen.getByRole('button', { name: 'Add a book' }));
        expect(mockRouter.push).toHaveBeenCalledWith(
            '/(store-owner)/inventory/scan/00000000-0000-4000-8000-000000000010/missed',
        );
    });

    it('fails safely for an expired session', () => {
        mockSessionV3.data = { ...mockSessionV3.data as object, status: 'expired' };
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByText('This scan session is unavailable.')).toBeTruthy();
        fireEvent.press(screen.getByText('Return to Inventory'));
        expect(mockRouter.replace).toHaveBeenCalledWith('/(store-owner)/inventory');
        mockSessionV3.data = { ...mockSessionV3.data as object, status: 'active' };
    });

    it('keeps Unit 6 progress mounted with only bounded review degradation on aggregate failure', () => {
        mockBatchReview.error = new Error('private candidate query detail');
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        // Unit 6 lifecycle/progress surface remains mounted and usable.
        expect(screen.getByText('Saved on server. Processing continues if you leave.')).toBeTruthy();
        expect(screen.getByText(/More than 15 books/u)).toBeTruthy();
        expect(screen.getByText('Remove image')).toBeTruthy();
        // The whole-screen lifecycle error branch must not be hijacked by the
        // supplemental aggregate.
        expect(screen.queryByText('Saved scan progress could not be loaded.')).toBeNull();
        // Only the compact-review subsection shows bounded degraded treatment.
        expect(screen.getByTestId('batch-review-degraded')).toBeTruthy();
        expect(screen.queryByText('private candidate query detail')).toBeNull();
        fireEvent.press(screen.getByText('Retry book review'));
        expect(mockBatchReview.refetch).toHaveBeenCalled();
        mockBatchReview.error = null;
    });

    it('fails closed instead of looking complete for a historical multi-input session', () => {
        const singleInput = mockInputs.data.items[0];
        mockInputs.data.items = [
            singleInput,
            { ...singleInput, inputId: '00000000-0000-4000-8000-000000000007', ordinal: 2 },
        ];
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        // Unit 6 surface remains authoritative...
        expect(screen.getByText('Saved on server. Processing continues if you leave.')).toBeTruthy();
        expect(screen.getAllByText(/More than 15 books/u).length).toBeGreaterThan(0);
        expect(screen.getByText('View session summary')).toBeTruthy();
        // ...but the compact projection must never present as complete.
        expect(screen.getByTestId('batch-review-unsupported')).toBeTruthy();
        expect(screen.queryByText(/Books found:/u)).toBeNull();
        expect(screen.queryByText('Continue to book review')).toBeNull();
        expect(screen.queryByText('Original book')).toBeNull();
        expect(screen.getByRole('button', { name: 'Add a book' })).toBeDisabled();
        mockInputs.data.items = [singleInput];
    });

    it('fails closed when active-review counts exceed the returned compact projection', () => {
        const originalCounts = (mockBatchReview.data as Record<string, any>).counts;
        (mockBatchReview.data as Record<string, any>).counts = {
            ...originalCounts,
            processing: 16,
        };
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByTestId('batch-review-unsupported')).toBeTruthy();
        expect(screen.queryByText(/Books found: 1/u)).toBeNull();
        expect(screen.getByText('Saved on server. Processing continues if you leave.')).toBeTruthy();
        (mockBatchReview.data as Record<string, any>).counts = originalCounts;
    });

    it('counts every active review state once in the remaining-review summary', () => {
        const aggregate = mockBatchReview.data as Record<string, any>;
        const originalCounts = aggregate.counts;
        const originalItems = aggregate.items;
        const seed = originalItems[0];
        aggregate.items = [seed,
            { ...seed, candidateId: '00000000-0000-4000-8000-000000000003', ordinal: 2,
                candidateState: 'processing' },
            { ...seed, candidateId: '00000000-0000-4000-8000-000000000004', ordinal: 3,
                candidateState: 'ready' },
        ];
        aggregate.counts = { ...originalCounts, detected: 3, processing: 1,
            needsAttention: 1, reviewReadySaved: 1 };
        mockBulkResult = { exactN: 1, candidateIds: [], outcomes: [], succeeded: 0,
            failedRetryable: 0, noLongerEligible: 0, needsAttention: 0,
            stillPending: 0, busy: 0 };
        try {
            const screen = render(
                <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
            );
            expect(screen.getByTestId('remaining-review-count').props.children)
                .toBe('3 books remain in review.');
        } finally {
            aggregate.counts = originalCounts;
            aggregate.items = originalItems;
        }
    });

    it('counts confirmed successes still present in a stale review aggregate only once', () => {
        const aggregate = mockBatchReview.data as Record<string, any>;
        const originalCounts = aggregate.counts;
        const originalItems = aggregate.items;
        const seed = originalItems[0];
        const second = { ...seed, candidateId: '00000000-0000-4000-8000-000000000003', ordinal: 2 };
        const third = { ...seed, candidateId: '00000000-0000-4000-8000-000000000004', ordinal: 3 };
        aggregate.items = [seed, second, third];
        aggregate.counts = { ...originalCounts, detected: 3, processing: 0,
            needsAttention: 3, reviewReadySaved: 0 };
        mockBulkResult = { exactN: 1, candidateIds: [seed.candidateId],
            outcomes: [{ candidateId: seed.candidateId, status: 'succeeded', stage: 'complete' }],
            succeeded: 1, failedRetryable: 0, noLongerEligible: 0,
            needsAttention: 0, stillPending: 0, busy: 0 };
        try {
            const screen = render(
                <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
            );
            expect(screen.getByTestId('remaining-review-count').props.children)
                .toBe('2 books remain in review.');
            aggregate.items = [second, third];
            aggregate.counts = { ...aggregate.counts, needsAttention: 2, committed: 1 };
            screen.rerender(
                <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
            );
            expect(screen.getByTestId('remaining-review-count').props.children)
                .toBe('2 books remain in review.');
        } finally {
            aggregate.counts = originalCounts;
            aggregate.items = originalItems;
            mockBulkResult = null;
        }
    });

    it('requires confirmation and sends the exact registered input version for removal', () => {
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );

        fireEvent.press(screen.getByText('Remove image'));
        expect(screen.getByText('Remove Image 1?')).toBeTruthy();
        expect(mockRemoveMutate).not.toHaveBeenCalled();

        fireEvent.press(screen.getByText('Remove image now'));
        expect(mockRemoveMutate).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: '00000000-0000-4000-8000-000000000010',
            inputId: '00000000-0000-4000-8000-000000000001',
            expectedInputVersion: 3,
            idempotencyKey: expect.stringMatching(/^remove-input:/u),
            commandId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
        }), expect.any(Object));
    });

    it('F02: claims the shared command slot for candidate Remove and reports busy without a request when the slot is held', () => {
        mockClaimSlot.mockReturnValue('remove-slot-token');
        // Emulate react-query delivering a terminal success so release runs.
        mockCandidateRemoveMutate.mockImplementation(
            (_request: unknown, callbacks: { onSuccess?: () => void }) => {
                callbacks?.onSuccess?.();
            },
        );
        (mockBatchReview.data as Record<string, any>).items[0].allowedActions = ['remove_from_scan'];
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );

        fireEvent.press(screen.getByText('Remove from this scan'));
        fireEvent.press(screen.getByText('Remove book from scan'));
        expect(mockClaimSlot).toHaveBeenCalledWith(
            '00000000-0000-4000-8000-000000000002', 'remove',
        );
        expect(mockCandidateRemoveMutate).toHaveBeenCalledTimes(1);
        // Terminal outcome releases the exact claimed slot token.
        expect(mockReleaseSlot).toHaveBeenCalledWith(
            '00000000-0000-4000-8000-000000000002', 'remove-slot-token',
        );

        mockCandidateRemoveMutate.mockClear();
        mockClaimSlot.mockReturnValue(null);
        const busyScreen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        fireEvent.press(busyScreen.getByText('Remove from this scan'));
        fireEvent.press(busyScreen.getByText('Remove book from scan'));
        // No second command may own the candidate; nothing is queued or sent.
        expect(mockCandidateRemoveMutate).not.toHaveBeenCalled();
        expect(busyScreen.getByText(/busy/iu)).toBeTruthy();
        (mockBatchReview.data as Record<string, any>).items[0].allowedActions = [];
    });

    it('does not refresh or expose per-item live regions while the route is blurred', () => {
        mockFocused = false;
        const listener = jest.spyOn(AppState, 'addEventListener');
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        const onChange = listener.mock.calls.at(-1)?.[1];
        act(() => { onChange?.('active'); });
        expect(mockRefetch).not.toHaveBeenCalled();
        expect(screen.queryAllByText(/Image needs attention/u).filter(
            (node) => node.props.accessibilityLiveRegion === 'polite',
        )).toHaveLength(0);
    });
});

it('guards unsaved card edits on leave', () => {
    jest.clearAllMocks();
    const batch = mockBatchReview.data as any;
    const original = batch.items[0];
    batch.items[0] = { ...original, allowedActions: ['save_review'] };
    const view = render(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
    const leave = () => {
        const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
        const listener = mockNavigation.addListener.mock.calls.at(-1)?.[1];
        act(() => listener?.(event)); return event;
    };
    expect(leave().preventDefault).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('Edit title for Book 1: Original book'));
    fireEvent.changeText(view.getByTestId('card-title-input'), 'Unsaved title');
    expect(leave().preventDefault).toHaveBeenCalled();
    expect(view.getByText('Leave without saving?')).toBeTruthy();
    expect(view.getByText('Your card edits are not saved and will be discarded.')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Stay' }));
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    expect(view.queryByText('Leave without saving?')).toBeNull();
    leave();
    fireEvent.press(view.getByText('Leave and discard'));
    expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
    batch.items[0] = original;
});

it('does not guard edits after the card Add outcome succeeds', () => {
    jest.clearAllMocks();
    const batch = mockBatchReview.data as any;
    const candidateId = batch.items[0].candidateId;
    const view = render(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
    try {
        const card = view.UNSAFE_getByType(BatchReviewCard);
        act(() => {
            card.props.onDraftChange(candidateId, { priceMinor: 2500 });
            card.props.onUnsavedEditsChange(candidateId, true);
        });
        mockOutcomes.set(candidateId, { candidateId, status: 'succeeded', stage: 'complete' });
        view.rerender(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
        expect(view.UNSAFE_getByType(BatchReviewCard).props.card.candidateId).toBe(candidateId);

        const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
        act(() => mockNavigation.addListener.mock.calls.at(-1)?.[1](event));
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(view.queryByText('Leave without saving?')).toBeNull();
    } finally {
        view.unmount();
        mockOutcomes.clear();
    }
});

it('does not guard edits after the card is removed from the batch', () => {
    jest.clearAllMocks();
    const batch = mockBatchReview.data as any;
    const originalItems = batch.items;
    const candidateId = originalItems[0].candidateId;
    const view = render(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
    try {
        const card = view.UNSAFE_getByType(BatchReviewCard);
        act(() => {
            card.props.onDraftChange(candidateId, { priceMinor: 2500 });
            card.props.onUnsavedEditsChange(candidateId, true);
        });
        batch.items = [];
        view.rerender(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
        expect(view.UNSAFE_queryAllByType(BatchReviewCard)).toHaveLength(0);

        const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
        act(() => mockNavigation.addListener.mock.calls.at(-1)?.[1](event));
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(view.queryByText('Leave without saving?')).toBeNull();
    } finally {
        view.unmount();
        batch.items = originalItems;
    }
});

it.each(['Add', 'edition'] as const)('blocks leave with a Stay-only dialog while %s is in flight', kind => {
    jest.clearAllMocks();
    mockInFlight = new Set();
    const batch = mockBatchReview.data as any;
    const view = render(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
    if (kind === 'Add') {
        mockInFlight = new Set([batch.items[0].candidateId]);
        view.rerender(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
    } else {
        act(() => view.UNSAFE_getByType(BatchReviewCard).props.onEditionPendingChange(batch.items[0].candidateId, true));
    }
    const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
    act(() => mockNavigation.addListener.mock.calls.at(-1)?.[1](event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(view.getByText('Add in progress')).toBeTruthy();
    expect(view.getByText('Wait for Add to finish before leaving.')).toBeTruthy();
    expect(view.queryByText('Leave and discard')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Stay' }));
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    mockInFlight = new Set();
});

it('guards a still-mounted screen again after discard and a clean state', () => {
    const copy = { title: 'Leave?', description: 'Unsaved', discardLabel: 'Discard',
        busyTitle: 'Busy', busyDescription: 'Wait' };
    const hook = renderHook(({ dirty }: { dirty: boolean }) => useUnsavedEditsLeaveGuard(dirty, false, copy),
        { initialProps: { dirty: true } });
    const leave = () => {
        const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
        act(() => mockNavigation.addListener.mock.calls.at(-1)?.[1](event));
        return event;
    };
    leave();
    expect(hook.result.current).toEqual(expect.objectContaining({ visible: true }));
    act(() => hook.result.current.onConfirm?.());
    hook.rerender({ dirty: false });
    hook.rerender({ dirty: true });
    expect(leave().preventDefault).toHaveBeenCalled();
});

it('switches an open discard dialog to Stay-only while an edition command starts', () => {
    jest.clearAllMocks();
    const batch = mockBatchReview.data as any;
    const view = render(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
    const card = view.UNSAFE_getByType(BatchReviewCard);
    act(() => card.props.onUnsavedEditsChange(batch.items[0].candidateId, true));
    const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
    act(() => mockNavigation.addListener.mock.calls.at(-1)?.[1](event));
    expect(view.getByText('Leave and discard')).toBeTruthy();
    act(() => card.props.onEditionPendingChange(batch.items[0].candidateId, true));
    expect(view.getByText('Add in progress')).toBeTruthy();
    expect(view.queryByText('Leave and discard')).toBeNull();
    fireEvent.press(view.getByText('Stay'));
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
});

it.each(['ready', 'failed'] as const)('does not refetch the batch review when edition choices become %s', status => {
    jest.clearAllMocks();
    mockFocused = true;
    const batch = mockBatchReview.data as any;
    const original = batch.items[0];
    batch.items[0] = { ...original, metadataState: 'pending' };
    const view = render(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
    mockRefetch.mockClear();
    const choices = selectedChoices({ sessionId: batch.sessionId, candidateId: original.candidateId, lookupStatus: 'pending' });
    act(() => view.UNSAFE_getByType(BatchReviewCard).props.onEditionChoices(choices));
    expect(mockRefetch).not.toHaveBeenCalled();
    act(() => view.UNSAFE_getByType(BatchReviewCard).props.onEditionChoices({ ...choices, lookupStatus: status }));
    expect(mockRefetch).not.toHaveBeenCalled();
    batch.items[0] = original;
});

// Post-scan SDD-1 §6 (4a), AC4-3/6: capacity comes from the aggregate, never visible cards.
describe('slice 4a add-a-book capacity', () => {
    it('disables Add a book without scan-full text until detectedCount is loaded', () => {
        const previous = mockBatchReview.data;
        mockBatchReview.data = undefined;
        mockBatchReview.isLoading = true;
        const view = render(<InventorySessionProgressScreen sessionId={(mockSessionV3.data as any).sessionId} />);
        try {
            expect(view.getByRole('button', { name: /^Add (?:a book|missed book)$/u })).toBeDisabled();
            expect(view.queryByText('This scan already has 15 books — scan the rest separately.')).toBeNull();
        } finally { view.unmount(); mockBatchReview.data = previous; mockBatchReview.isLoading = false; }
    });
    it('explains the 15-book limit', () => {
        const batch = mockBatchReview.data as any;
        const previous = batch.counts;
        batch.counts = { ...previous, detected: 15, committed: 10, ownerRemoved: 4 };
        const view = render(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
        try {
            expect(batch.items.length).toBeLessThan(15);
            const button = view.getByRole('button', { name: /^Add (?:a book|missed book)$/u });
            expect(button).toBeDisabled();
            expect(button.props.accessibilityLabel).toBe('Add a book');
            expect(button.props.accessibilityHint).toMatch(/add.*book.*title/iu);
            const text = 'This scan already has 15 books — scan the rest separately.';
            expect(view.getByText(text).props).toMatchObject({ selectable: true, accessibilityLiveRegion: 'polite' });
            expect(view.getByLabelText(text)).toBeTruthy();
        } finally { view.unmount(); batch.counts = previous; }
    });
    it('shows the limit text instead of hiding the button on overflow', () => {
        const batch = mockBatchReview.data as any;
        const previous = mockInputs.data.items;
        mockInputs.data.items = [previous[0], { ...previous[0], inputId: '00000000-0000-4000-8000-000000000099' }];
        const view = render(<InventorySessionProgressScreen sessionId={batch.sessionId} />);
        try {
            expect(view.getByRole('button', { name: /^Add (?:a book|missed book)$/u })).toBeDisabled();
            const text = 'This scan already has 15 books — scan the rest separately.';
            expect(view.getByText(text).props).toMatchObject({ selectable: true, accessibilityLiveRegion: 'polite' });
            expect(view.getByLabelText(text)).toBeTruthy();
        } finally { view.unmount(); mockInputs.data.items = previous; }
    });
});
