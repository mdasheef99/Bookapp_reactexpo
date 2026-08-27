import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
    InventoryCapturePreviewScreen,
    InventoryCaptureSetupScreen,
} from '../screens/CaptureScreens';
import {
    InventorySessionFoundationScreen,
    InventorySummaryFoundationScreen,
} from '../screens/InventoryFoundationScreens';
import { captureService } from '../api/captureService';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockWorkflow = { selected: null as any, select: jest.fn(), clear: jest.fn() };
const mockIdentity = { userId: 'owner-1', storeId: 'store-1' };
let mockPreviewInputItems: any[] = [];
const mockQueryClient = { invalidateQueries: jest.fn(() => Promise.resolve()) };

let mockDiscovery: any;
let mockInputs: any;
let mockSessionV3: any;
let mockBatchReview: any;
let mockStartV2Mutate: jest.Mock;
let mockRemoveCandidateMutate: jest.Mock;
let mockCloseV3Mutate: jest.Mock;
let mockSaveReviewMutate: jest.Mock;
let mockRemoveInputMutate: jest.Mock;
let mockAddCandidate: jest.Mock;
let mockCandidateDetail: any;

function processingCounts(overrides: Record<string, number> = {}) {
    return {
        detected: 0, processing: 0, needsAttention: 0, reviewReadySaved: 0,
        committed: 0, ownerRemoved: 0, falseDetections: 0, ...overrides,
    };
}

function defaultsFixture() {
    return {
        languageHint: 'en', condition: null, location: 'Front shelf',
        priceMinor: null, quantity: 1, publication: 'private', script: null,
    };
}

function cardFixture(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        sessionId: '00000000-0000-4000-8000-000000000010',
        candidateId: '00000000-0000-4000-8000-000000000021',
        inputId: '00000000-0000-4000-8000-000000000001',
        ordinal: 1,
        candidateState: 'ready',
        candidateVersion: 2,
        metadataState: 'selected',
        metadataRevision: 3,
        reviewVersion: null,
        reviewDisposition: null,
        observed: {
            title: 'Detected Book One',
            authors: ['Author One'],
            language: 'en',
            script: 'Latn',
        },
        metadataSummary: null,
        review: null,
        fieldSources: {
            cover: 'missing', title: 'detected', authors: 'detected',
            language: 'detected', condition: 'default', price: 'default',
            quantity: 'default', location: 'default', publication: 'default',
            damage: 'default',
        },
        attentionCodes: [],
        blockers: [],
        reviewReady: false,
        allowedActions: ['view_metadata', 'remove_from_scan'],
        updatedAt: '2026-08-24T00:00:00.000Z',
        ...overrides,
    };
}

function batchReviewFixture(items: any[], countOverrides: Record<string, number> = {}) {
    return {
        data: {
            sessionId: '00000000-0000-4000-8000-000000000010',
            status: 'active', sessionVersion: 4, presentationRevision: 5,
            defaults: defaultsFixture(), batchLabel: null,
            counts: processingCounts({
                processing: items.length === 0 ? 1 : 0,
                ...countOverrides,
            }),
            items,
            updatedAt: '2026-08-24T00:00:00.000Z',
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(() => Promise.resolve({ isError: false, error: null })),
    };
}

function resetMocks() {
    mockDiscovery = {
        data: { activeSession: null, needsReviewCount: 0 },
        isLoading: false, error: null, isFetchedAfterMount: true,
        refetch: jest.fn(() => Promise.resolve({ isError: false, error: null })),
    };
    mockInputs = {
        data: { presentationRevision: 1, items: [] },
        isLoading: false, error: null, isFetchedAfterMount: true,
        refetch: jest.fn(() => Promise.resolve({ isError: false, error: null })),
    };
    mockSessionV3 = {
        data: {
            sessionId: '00000000-0000-4000-8000-000000000010',
            status: 'active', sessionVersion: 4,
            startedAt: '2026-08-24T00:00:00.000Z',
            updatedAt: '2026-08-24T00:00:00.000Z',
            closedAt: null, expiresAt: '2026-08-25T00:00:00.000Z',
            defaults: defaultsFixture(), batchLabel: null,
            closeSummary: {}, allInputsTerminal: false,
            closeState: 'not_closeable', presentationRevision: 5,
        },
        isLoading: false, error: null, isFetchedAfterMount: true,
        refetch: jest.fn(() => Promise.resolve({ isError: false, error: null })),
    };
    mockBatchReview = batchReviewFixture([]);
    mockStartV2Mutate = jest.fn();
    mockRemoveCandidateMutate = jest.fn();
    mockCloseV3Mutate = jest.fn();
    mockSaveReviewMutate = jest.fn();
    mockRemoveInputMutate = jest.fn();
    mockAddCandidate = jest.fn().mockResolvedValue({ status: 'succeeded' });
    mockCandidateDetail = {
        observed: {
            title: 'Detected Book One', authors: ['Author One'],
            language: 'en', script: 'Latn',
        },
        metadata: { snapshot: null },
    };
    mockRouter.push.mockReset();
    mockRouter.replace.mockReset();
    mockRouter.back.mockReset();
}

jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({ sessionId: '00000000-0000-4000-8000-000000000010' }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        textPrimary: '#111', textSecondary: '#333', error: '#900', border: '#ccc',
    } }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOffline: false, isConnected: true }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: any) => children,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: any) => children,
}));
jest.mock('../screens/InventoryAccessBoundary', () => ({
    InventoryAccessBoundary: ({ children }: any) => children(mockIdentity),
}));
jest.mock('../capture/CaptureWorkflowContext', () => ({
    useCaptureWorkflow: () => mockWorkflow,
}));
jest.mock('../api/captureService', () => ({
    CaptureClientError: class CaptureClientError extends Error {
        code: string;
        retryable: boolean;
        constructor(...mockArgs: [string, boolean, string]) {
            super(mockArgs[2]);
            this.code = mockArgs[0];
            this.retryable = mockArgs[1];
        }
    },
    captureService: {
        startSession: jest.fn(),
        prepareUpload: jest.fn(),
    },
    INGESTION_CONTRACT_VERSION: 'phase9-v1',
}));
jest.mock('../queries/ownerUxQueries', () => ({
    getResolvedImageInventoryIdentity: () => mockIdentity,
    imageInventoryKeys: {
        all: ['phase9', 'ownerInventory', 'phase9-owner-ux-v1'],
        identity: (_identity: unknown) => ['phase9', 'ownerInventory', 'identity'],
        discovery: jest.fn(() => ['discovery']),
        session: jest.fn(() => ['session']),
        inputs: jest.fn(() => ['inputs']),
        readiness: jest.fn(() => ['readiness']),
    },
    useOwnerInventoryDiscovery: () => mockDiscovery,
    useOwnerInventoryInputs: () => mockInputs,
    useOwnerInventoryCandidate: () => ({
        data: mockCandidateDetail, isLoading: false, error: null,
        refetch: jest.fn(),
    }),
}));
jest.mock('../commit/useInventoryCommitCoordinator', () => ({
    useInventoryCommitCoordinator: () => ({
        addCandidate: mockAddCandidate,
        addAll: jest.fn(), retryAddAll: jest.fn(),
        claimSlot: jest.fn(() => 'slot'), releaseSlot: jest.fn(),
        isCommandActive: jest.fn(() => false),
        inFlight: new Set(), outcomes: new Map(),
        bulkResult: null, bulkPending: false,
    }),
}));
jest.mock('../queries/ownerUxInputQueries', () => ({
    useRemoveOwnerInventoryInput: () => ({
        mutate: mockRemoveInputMutate, isPending: false, error: null,
    }),
}));
// NEW 6G-C composition roots. At the checkpoint baseline these modules do not
// exist: this suite must fail until the composition is implemented.
jest.mock('../queries/ownerBatchReviewQueries', () => ({
    useOwnerSessionV3: () => mockSessionV3,
    useOwnerBatchReview: () => mockBatchReview,
    useStartScanSessionV2: () => ({ mutate: mockStartV2Mutate, isPending: false }),
    useRemoveOwnerInventoryCandidate: () => ({
        mutate: mockRemoveCandidateMutate, isPending: false,
    }),
    useSaveOwnerCandidateReview: () => ({
        mutate: mockSaveReviewMutate, isPending: false,
    }),
    useCloseOwnerInventorySessionV3: () => ({
        mutate: mockCloseV3Mutate,
        mutateAsync: mockCloseV3Mutate,
        isPending: false,
    }),
}));

jest.mock('expo-image-picker', () => ({
    getCameraPermissionsAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
    getMediaLibraryPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));

jest.setTimeout(60_000);

const selectedMedia = {
    uri: 'file:///private/scan.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
    width: 100,
    height: 200,
    source: 'camera' as const,
};

function mockSuccessfulUploadRegistration() {
    (captureService.prepareUpload as jest.Mock).mockResolvedValue({
        expiresAt: '2099-01-01T00:00:00.000Z',
        upload: () => ({ promise: Promise.resolve(), cancel: jest.fn() }),
        register: jest.fn().mockResolvedValue({
            inputId: '00000000-0000-4000-8000-000000000001',
            state: 'uploaded',
        }),
    });
}

describe('Phase 9 NEW 6G-C mounted production-route composition', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetMocks();
        mockQueryClient.invalidateQueries.mockReset().mockResolvedValue(undefined);
        mockPreviewInputItems = [];
    });

    it('SCENARIO A: Start v2 -> ONE image -> upload -> registration -> processing before candidates -> automatic card arrival -> full correction -> v3 Close', async () => {
        // Phase 1: pre-scan defaults and semantic Start v2 on the real setup screen.
        const setup = render(<InventoryCaptureSetupScreen />);
        fireEvent.changeText(setup.getByTestId('setup-location'), 'Front shelf');
        const startButton = setup.getByTestId('capture-start');
        await waitFor(() => expect(startButton.props.accessibilityState?.disabled).toBe(false));
        fireEvent.press(startButton);
        await waitFor(() => expect(mockStartV2Mutate).toHaveBeenCalledTimes(1));
        const firstStartCall = mockStartV2Mutate.mock.calls[0][0];
        expect(firstStartCall.location).toBe('Front shelf');
        expect(firstStartCall.languageHint).toBe('en');
        expect(firstStartCall.condition).toBeNull();

        // Ambiguous Start: pressing Start again replays the SAME semantic identity.
        await act(async () => {
            mockStartV2Mutate.mock.calls[0][1].onError(new Error('ambiguous'));
        });
        fireEvent.press(setup.getByTestId('capture-start'));
        await waitFor(() => expect(mockStartV2Mutate).toHaveBeenCalledTimes(2));
        const replayCall = mockStartV2Mutate.mock.calls[1][0];
        expect(replayCall.idempotencyKey).toBe(firstStartCall.idempotencyKey);
        expect(replayCall.commandId).toBe(firstStartCall.commandId);

        // Reconciling success unlocks the existing Unit 6 source-selection step.
        await act(async () => {
            mockStartV2Mutate.mock.calls[1][1].onSuccess({
                sessionId: '00000000-0000-4000-8000-000000000010',
                sessionVersion: 4,
                defaults: {
                    languageHint: 'en', condition: null, location: 'Front shelf',
                    priceMinor: null, quantity: 1, publication: 'private', script: null,
                },
                batchLabel: null,
            });
        });
        await waitFor(() => expect(setup.getByTestId('capture-camera')).toBeTruthy());

        // ONE image selection composes into the existing Unit 6 entry flow.
        const cameraPicker = require('expo-image-picker');
        cameraPicker.getCameraPermissionsAsync.mockResolvedValue({
            granted: true, canAskAgain: true, status: 'granted', expires: 'never',
        });
        cameraPicker.launchCameraAsync.mockResolvedValue({
            canceled: false,
            assets: [{ uri: selectedMedia.uri, mimeType: 'image/jpeg', fileSize: 1024, width: 100, height: 200 }],
        });
        fireEvent.press(setup.getByTestId('capture-camera'));
        await waitFor(() => expect(mockWorkflow.select).toHaveBeenCalled());
        expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({
            pathname: '/(store-owner)/inventory/scan/preview',
        }));

        // Phase 2: private upload + registration through Unit 6 preview.
        mockWorkflow.selected = selectedMedia;
        mockPreviewInputItems = [];
        mockSuccessfulUploadRegistration();
        const preview = render(
            <InventoryCapturePreviewScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        fireEvent.press(preview.getByText('Upload image'));
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(
            '/(store-owner)/inventory/scan/00000000-0000-4000-8000-000000000010',
        ));
        preview.unmount();
        mockRouter.replace.mockClear();
        mockRouter.push.mockClear();

        // Phase 3: mounted session surface stays on Unit 6 lifecycle authority.
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1, inputVersion: 2,
            presentationState: 'finding_books', retryState: 'none',
            safeCode: null, acceptedCandidateCount: 0,
        }];
        let screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        // Processing state is visible BEFORE candidates exist.
        expect(screen.getByText('Finding books')).toBeTruthy();
        // Empty aggregate must not imply idle/complete/unrecoverable.
        expect(screen.queryByText(/all books processed/iu)).toBeNull();
        expect(mockRouter.replace).not.toHaveBeenCalled();

        // Candidates appear automatically while the route stays mounted.
        mockBatchReview = batchReviewFixture([
            cardFixture(),
            cardFixture({
                candidateId: '00000000-0000-4000-8000-000000000022',
                ordinal: 2,
                observed: { title: 'Detected Book Two', authors: [], language: 'en', script: null },
                fieldSources: {
                    cover: 'missing', title: 'detected', authors: 'missing',
                    language: 'default', condition: 'custom', price: 'missing',
                    quantity: 'default', location: 'custom', publication: 'default',
                    damage: 'default',
                },
            }),
        ], { detected: 2 });
        screen.rerender(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getAllByText(/Detected Book One/u).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Detected Book Two/u).length).toBeGreaterThan(0);

        // Full correction remains reachable through client navigation delegation.
        fireEvent.press(screen.getAllByText('Open full correction')[0]);
        expect(mockRouter.push).toHaveBeenCalledWith(
            '/(store-owner)/inventory/scan/00000000-0000-4000-8000-000000000010/candidate/00000000-0000-4000-8000-000000000021',
        );

        // Phase 4: v3 readiness and v3 Close.
        mockSessionV3 = {
            ...mockSessionV3,
            data: {
                ...mockSessionV3.data,
                allInputsTerminal: true, closeState: 'closeable',
            },
        };
        const summary = render(
            <InventorySummaryFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        fireEvent.press(summary.getByText('Close session'));
        fireEvent.press(summary.getAllByText('Close session').at(-1)!);
        await waitFor(() => expect(mockCloseV3Mutate).toHaveBeenCalled());
        expect(mockCloseV3Mutate.mock.calls[0][0]).toEqual(expect.objectContaining({
            sessionId: '00000000-0000-4000-8000-000000000010',
            expectedSessionVersion: 4,
        }));
    });

    it('SCENARIO B: terminal pre-lineage input failure -> bounded guidance -> removal -> replacement reachable -> upload -> processing resumes', () => {
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1, inputVersion: 3,
            presentationState: 'needs_attention', retryState: 'new_upload_required',
            safeCode: 'P9_VISION_SCHEMA_INVALID', acceptedCandidateCount: 0,
        }];
        mockBatchReview = batchReviewFixture([]);
        const screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByText(/Image needs attention/u)).toBeTruthy();
        expect(screen.queryByText('More than 15 books')).toBeNull();

        // Deliberate removal of the failed input where Unit 6 permits it.
        fireEvent.press(screen.getByText('Remove image'));
        fireEvent.press(screen.getByText('Remove image now'));
        expect(mockRemoveInputMutate).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: '00000000-0000-4000-8000-000000000010',
            inputId: '00000000-0000-4000-8000-000000000001',
            expectedInputVersion: 3,
        }), expect.any(Object));

        // Replacement becomes reachable once the slot is empty.
        mockInputs.data.items = [];
        screen.rerender(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        fireEvent.press(screen.getByText('Choose replacement image'));
        expect(mockRouter.push).toHaveBeenCalledWith('/(store-owner)/inventory/scan');
        mockInputs.data.items = [];

        // The replacement upload completes registration and processing
        // resumes on the same Unit 6 lifecycle surface.
        const removalOptions = mockRemoveInputMutate.mock.calls[0][1] as {
            onSuccess?: () => void;
        };
        act(() => { removalOptions.onSuccess?.(); });
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000008',
            ordinal: 1, inputVersion: 2,
            presentationState: 'finding_books', retryState: 'none',
            safeCode: null, acceptedCandidateCount: 0,
        }];
        mockBatchReview = batchReviewFixture([]);
        screen.rerender(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByText('Finding books')).toBeTruthy();
        expect(screen.queryByText(/all books processed/iu)).toBeNull();

        // Candidates then arrive for the replacement without replacing Unit 6.
        mockBatchReview = batchReviewFixture([
            cardFixture({ candidateId: '00000000-0000-4000-8000-000000000031' }),
        ], { detected: 1 });
        screen.rerender(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getAllByText(/Detected Book One/u).length).toBeGreaterThan(0);
        expect(screen.getByText('Finding books')).toBeTruthy();
        mockInputs.data.items = [];
    });

    it('mounts the complete compact-to-metadata-to-deep-correction-to-Add journey with nullable v3 defaults', async () => {
        const review = {
            originalTitle: 'Detected Book One', authors: ['Author One'],
            originalLanguage: 'en', script: 'Latn',
            metadataChoice: { mode: 'manual', selectionId: null },
            quantity: 1, priceMinor: 25000, baseCondition: 'good',
            damageDisclosure: {
                hasDamage: false, damageTypes: [], damageNote: null,
                isSellable: true, completeReadableSafe: true,
            },
            shelfLocation: 'Front shelf',
            notes: { publicNote: null, internalNote: null },
            publicationIntent: 'private', duplicateIntent: null,
            originalFieldConfirmation: { title: true, authors: [true] },
            candidateDisposition: 'reviewed',
        };
        const initial = cardFixture({
            metadataState: 'manual', reviewVersion: 1, review,
            allowedActions: ['view_metadata', 'remove_from_scan'],
        });
        mockBatchReview = batchReviewFixture([initial], { detected: 1 });
        const screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );

        expect(screen.getByText('Edit title and authors')).toBeTruthy();
        expect(screen.getByText('Edit language')).toBeTruthy();
        expect(screen.getByText('Edit price')).toBeTruthy();
        expect(screen.getByText('Edit quantity')).toBeTruthy();
        expect(screen.getByText('Edit location')).toBeTruthy();
        expect(screen.getByText('Edit publication')).toBeTruthy();
        expect(screen.getByText('Edit damage')).toBeTruthy();
        expect(screen.queryByText('Save changes')).toBeNull();
        expect(screen.queryByText('Add to inventory')).toBeNull();

        fireEvent.press(screen.getByTestId('card-condition-open'));
        fireEvent.press(screen.getByText('Acceptable'));
        fireEvent.press(screen.getByText('View metadata'));
        expect(screen.getByText('Book metadata')).toBeTruthy();
        expect(screen.getByTestId('metadata-no-selected-details')).toBeTruthy();
        fireEvent.press(screen.getByText('Close metadata'));
        fireEvent.press(screen.getByText('Open full correction'));
        expect(mockRouter.push).toHaveBeenCalledWith(
            '/(store-owner)/inventory/scan/00000000-0000-4000-8000-000000000010/candidate/00000000-0000-4000-8000-000000000021',
        );

        mockBatchReview = batchReviewFixture([cardFixture({
            metadataState: 'manual', candidateVersion: 3, reviewVersion: 2,
            review: { ...review, quantity: 2 }, reviewReady: true,
            allowedActions: ['view_metadata', 'remove_from_scan', 'add_to_inventory'],
        })], { detected: 1, reviewReadySaved: 1 });
        screen.rerender(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        fireEvent.press(screen.getByText('Use latest saved review'));
        expect(screen.getByText('Quantity: 2')).toBeTruthy();
        await act(async () => {
            fireEvent.press(screen.getByText('Add to inventory'));
            await Promise.resolve();
        });
        expect(mockAddCandidate).toHaveBeenCalledWith(expect.objectContaining({
            review: expect.objectContaining({ quantity: 2 }),
        }));
    });

    it('fails closed on a historical multi-input session instead of presenting a complete compact review', () => {
        mockInputs.data.items = [
            {
                inputId: '00000000-0000-4000-8000-000000000001',
                ordinal: 1, inputVersion: 2,
                presentationState: 'ready', retryState: 'none',
                safeCode: null, acceptedCandidateCount: 2,
            },
            {
                inputId: '00000000-0000-4000-8000-000000000007',
                ordinal: 2, inputVersion: 2,
                presentationState: 'ready', retryState: 'none',
                safeCode: null, acceptedCandidateCount: 3,
            },
        ];
        mockBatchReview = batchReviewFixture([cardFixture()], { detected: 5 });
        const screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        // Unit 6 surface stays authoritative...
        expect(screen.getByText('Saved on server. Processing continues if you leave.')).toBeTruthy();
        expect(screen.getByText('View session summary')).toBeTruthy();
        // ...but the compact projection never claims completeness and offers
        // no pagination or hidden-candidate handling.
        expect(screen.getByTestId('batch-review-unsupported')).toBeTruthy();
        expect(screen.queryByText(/Books found:/u)).toBeNull();
        expect(screen.queryByText('Continue to book review')).toBeNull();
        expect(screen.queryByText(/Detected Book One/u)).toBeNull();
        expect(screen.queryByText('Add missed book')).toBeNull();
        mockInputs.data.items = [];
    });

    it('fails closed when counts.detected proves candidate volume beyond single-image support', () => {
        // Active states are small: only the lifetime detected count proves
        // that unsupported historical volume exists outside active review.
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1, inputVersion: 2,
            presentationState: 'ready', retryState: 'none',
            safeCode: null, acceptedCandidateCount: 15,
        }];
        mockBatchReview = batchReviewFixture([cardFixture()], { detected: 20 });
        const screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByTestId('batch-review-unsupported')).toBeTruthy();
        expect(screen.queryByText(/Books found:/u)).toBeNull();
        expect(screen.queryByText('Continue to book review')).toBeNull();
        expect(screen.queryByText(/Detected Book One/u)).toBeNull();
        expect(screen.getByText('View session summary')).toBeTruthy();
        mockInputs.data.items = [];
    });

    it('does not over-fence a supported session at the detected = 15 absolute cap with dispositioned candidates', () => {
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1, inputVersion: 2,
            presentationState: 'ready', retryState: 'none',
            safeCode: null, acceptedCandidateCount: 15,
        }];
        mockBatchReview = batchReviewFixture([cardFixture()], {
            detected: 15, committed: 13, needsAttention: 1,
        });
        const screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.queryByTestId('batch-review-unsupported')).toBeNull();
        expect(screen.getAllByText(/Detected Book One/u).length).toBeGreaterThan(0);
        expect(screen.getByText('Books found: 1')).toBeTruthy();
        mockInputs.data.items = [];
    });

    it('OWNER GUARD: a legitimate current one-image over-limit failure is never fenced as legacy overflow', () => {
        // detected = 20 here has a live legitimate explanation: the ONE
        // current input terminal-failed with P9_VISION_OVER_LIMIT, so Unit 6
        // intentionally produces zero candidates and bounded failure with
        // replacement reachable. The 6G unsupported-legacy banner must never
        // intercept this state just because detected reports 16+.
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1, inputVersion: 3,
            presentationState: 'needs_attention', retryState: 'new_upload_required',
            safeCode: 'P9_VISION_OVER_LIMIT', terminal: true,
            acceptedCandidateCount: 0,
        }];
        mockBatchReview = batchReviewFixture([], { processing: 0, detected: 20 });
        const screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.queryByTestId('batch-review-unsupported')).toBeNull();
        // The existing Unit 6 over-limit failure/guidance surface remains
        // fully authoritative (same assertions as Scenario C).
        expect(screen.getByText(/More than 15 books/u)).toBeTruthy();
        expect(screen.queryByText(/Detected Book One/u)).toBeNull();
        expect(screen.queryByText('Add another image')).toBeNull();
        expect(screen.getByText('Saved on server. Processing continues if you leave.')).toBeTruthy();
        expect(screen.getByText('View session summary')).toBeTruthy();

        // The recovery path stays reachable: remove then choose replacement.
        fireEvent.press(screen.getByText('Remove image'));
        fireEvent.press(screen.getByText('Remove image now'));
        mockInputs.data.items = [];
        screen.rerender(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByText('Choose replacement image')).toBeTruthy();
    });

    it('fails closed once an over-limit input was removed and detected volume has no current explanation', () => {
        // Deliberate edge: with the over-limit input gone there is no live
        // legitimate explanation left, so detected >= 16 is unsupportable
        // historical data and must fail closed again.
        mockInputs.data.items = [];
        mockBatchReview = batchReviewFixture([cardFixture()], { detected: 20 });
        const screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByTestId('batch-review-unsupported')).toBeTruthy();
        expect(screen.queryByText(/Books found:/u)).toBeNull();
        expect(screen.queryByText('Continue to book review')).toBeNull();
        expect(screen.queryByText(/Detected Book One/u)).toBeNull();
        mockInputs.data.items = [];
    });

    it('SCENARIO C: over-limit inherits P9_VISION_OVER_LIMIT with zero candidates, no truncation, and reachable replacement', () => {
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1, inputVersion: 3,
            presentationState: 'needs_attention', retryState: 'new_upload_required',
            safeCode: 'P9_VISION_OVER_LIMIT', acceptedCandidateCount: 0,
        }];
        mockBatchReview = batchReviewFixture([], { processing: 0 });
        const screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByText(/More than 15 books/u)).toBeTruthy();
        // Zero candidates: nothing was truncated to 15 and no cards are rendered.
        expect(screen.queryByText(/Detected Book One/u)).toBeNull();
        expect(screen.queryByText('Add another image')).toBeNull();

        // A replacement image with 1..15 books continues normally.
        fireEvent.press(screen.getByText('Remove image'));
        fireEvent.press(screen.getByText('Remove image now'));
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000009',
            ordinal: 1, inputVersion: 2,
            presentationState: 'ready', retryState: 'none',
            safeCode: null, acceptedCandidateCount: 2,
        }];
        mockBatchReview = batchReviewFixture([cardFixture()], { detected: 2, processing: 0 });
        screen.rerender(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getAllByText(/Detected Book One/u).length).toBeGreaterThan(0);
    });

    it('zero-candidate aggregate never hides that the input is still processing or implies completion', () => {
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1, inputVersion: 2,
            presentationState: 'checking_image', retryState: 'server_retrying',
            safeCode: null, acceptedCandidateCount: 0,
        }];
        const screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByText('Trying again')).toBeTruthy();
        expect(screen.queryByText(/no books were found/iu)).toBeNull();
    });

    it('keeps general Remove from scan distinct from false detection inside compact review', () => {
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1, inputVersion: 2,
            presentationState: 'ready', retryState: 'none',
            safeCode: null, acceptedCandidateCount: 1,
        }];
        mockBatchReview = batchReviewFixture([cardFixture({
            allowedActions: ['save_review', 'view_metadata', 'remove_from_scan'],
        })], { detected: 1 });
        const screen = render(
            <InventorySessionFoundationScreen
                sessionId="00000000-0000-4000-8000-000000000010"
                key="remove-distinct" />,
        );
        expect(screen.getAllByText('Remove from this scan').length).toBeGreaterThan(0);
        expect(screen.queryByText('Mark false detection')).toBeNull();
    });

    it('renders no Add, Add-all, or commit controls anywhere on the composed surface', () => {
        mockInputs.data.items = [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1, inputVersion: 2,
            presentationState: 'ready', retryState: 'none',
            safeCode: null, acceptedCandidateCount: 2,
        }];
        mockBatchReview = batchReviewFixture([
            cardFixture(),
            cardFixture({
                candidateId: '00000000-0000-4000-8000-000000000022', ordinal: 2,
                reviewReady: true,
                allowedActions: ['save_review', 'view_metadata', 'remove_from_scan'],
            }),
        ], { detected: 2, reviewReadySaved: 1 });
        const screen = render(
            <InventorySessionFoundationScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.queryByText('Add to inventory')).toBeNull();
        expect(screen.queryByText(/Add all ready books/iu)).toBeNull();
        expect(mockRemoveCandidateMutate).not.toHaveBeenCalled();
    });
});
