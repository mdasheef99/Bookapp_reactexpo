import { act, fireEvent, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { InventorySessionProgressScreen } from '../screens/CaptureProgressScreens';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockRefetch = jest.fn(() => Promise.resolve({ isError: false, error: null }));
const mockRemoveMutate = jest.fn();
const mockCandidateRemoveMutate = jest.fn();
const mockClaimSlot = jest.fn<string | null, [string, string]>(() => 'slot-token');
const mockReleaseSlot = jest.fn();
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

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
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
}));
jest.mock('../queries/ownerUxInputQueries', () => ({
    useRemoveOwnerInventoryInput: () => ({
        mutate: mockRemoveMutate,
        isPending: false,
        error: null,
    }),
}));
jest.mock('../commit/useInventoryCommitCoordinator', () => ({
    useInventoryCommitCoordinator: () => ({
        addCandidate: jest.fn(),
        addAll: jest.fn(),
        retryAddAll: jest.fn(),
        inFlight: new Set(),
        outcomes: new Map(),
        bulkResult: null,
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
    beforeEach(() => {
        jest.clearAllMocks();
        mockFocused = true;
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

    it('renders terminal over-limit guidance and hands off only to the review shell', () => {
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByText(/More than 15 books/u)).toBeTruthy();
        fireEvent.press(screen.getByText('Continue to book review'));
        expect(mockRouter.push).toHaveBeenCalledWith(
            '/(store-owner)/inventory/scan/00000000-0000-4000-8000-000000000010/candidate/00000000-0000-4000-8000-000000000002',
        );
    });

    it('opens the real missed-book route from an accessible reviewable session', () => {
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        fireEvent.press(screen.getByText('Add missed book'));
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
        expect(screen.queryByText('Add missed book')).toBeNull();
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
