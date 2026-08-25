import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import SessionRoute from '../../../../app/(store-owner)/inventory/scan/[sessionId]/index';

// Genuine mounted production-route composition:
// app/(store-owner)/inventory/scan/[sessionId]/index
//   -> InventorySessionFoundationScreen
//   -> InventorySessionProgressScreen (Unit 6 lifecycle controller)
// Only true external boundaries are mocked: the Supabase Functions network
// transport, authentication/store-ownership resolution, navigation, and
// connectivity/theme presentation. The query, fencing, service-decode,
// boundary, and screen layers all run as production code.

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({
        sessionId: '00000000-0000-4000-8000-000000000010',
    }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'owner-1' }, isLoading: false }),
}));
jest.mock('@/features/stores/hooks/useStoreOwnerGate', () => ({
    useStoreOwnerGate: () => ({
        data: { state: 'active_owner', storeId: 'store-1', storeName: 'Test Store' },
        isLoading: false,
    }),
}));

const BATCH_VERSION = 'phase9-owner-batch-review-v1';
const UX_VERSION = 'phase9-owner-ux-v1';

type BatchReviewState = {
    counts: Record<string, number>;
    items: unknown[];
} | { failure: true };

// Mutable server-side fixture state, replaced per scenario phase.
let serverState: {
    inputsPage: { presentationState: string; retryState: string; safeCode: string | null }[];
    sessionV3: Record<string, unknown>;
    batchReview: BatchReviewState;
};

function inputFixture(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        inputId: '00000000-0000-4000-8000-000000000001',
        ordinal: 1,
        sourceKind: 'camera',
        inputState: 'processing',
        inputVersion: 2,
        presentationState: 'finding_books',
        safeCode: null,
        retryState: 'none',
        terminal: false,
        polling: true,
        detectedCandidateCount: null,
        acceptedCandidateCount: 0,
        createdAt: '2026-08-24T00:00:00.000Z',
        updatedAt: '2026-08-24T00:00:00.000Z',
        ...overrides,
    };
}

function cardFixture(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        sessionId: '00000000-0000-4000-8000-000000000010',
        candidateId: '00000000-0000-4000-8000-000000000021',
        inputId: null,
        ordinal: 1,
        candidateState: 'ready',
        candidateVersion: 2,
        metadataState: 'pending',
        metadataRevision: 3,
        reviewVersion: null,
        reviewDisposition: null,
        observed: {
            title: 'Detected Book One', authors: ['Author One'],
            language: 'en', script: 'Latn',
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

function zeroCounts() {
    return {
        detected: 0, processing: 0, needsAttention: 0, reviewReadySaved: 0,
        committed: 0, ownerRemoved: 0, falseDetections: 0,
    };
}

function zeroCloseSummary() {
    return {
        imagesSubmitted: 0, imagesProcessed: 0, imagesFailed: 0,
        imagesSkipped: 0, candidatesDetected: 0, candidatesReviewReady: 0,
        candidatesNeedsReview: 0, candidatesFailed: 0, falseDetections: 0,
        ownerRemovedCandidates: 0, manualMissedCandidates: 0,
        committedInventoryItems: 0, quantitiesAddedToExisting: 0,
        privateItems: 0, publishedItems: 0, languageSkips: 0,
        candidateCapSkips: 0, qualitySkips: 0,
    };
}

function baseSessionV3() {
    return {
        sessionId: '00000000-0000-4000-8000-000000000010',
        status: 'active', sessionVersion: 4,
        startedAt: '2026-08-24T00:00:00.000Z',
        updatedAt: '2026-08-24T00:00:00.000Z',
        closedAt: null, expiresAt: '2026-08-25T00:00:00.000Z',
        defaults: {
            languageHint: 'en', condition: null, location: 'Front shelf',
            priceMinor: null, quantity: 1, publication: 'private', script: null,
        },
        batchLabel: null,
        closeSummary: zeroCloseSummary(),
        allInputsTerminal: false,
        closeState: 'not_closeable',
        presentationRevision: 5,
    };
}

function freshServerState() {
    serverState = {
        inputsPage: [{ presentationState: 'finding_books', retryState: 'none', safeCode: null }],
        sessionV3: baseSessionV3(),
        batchReview: {
            counts: { ...zeroCounts(), processing: 1 },
            items: [],
        },
    };
}

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

async function respond(action: string) {
    if (action === 'list_scan_inputs') {
        return {
            data: {
                contractVersion: UX_VERSION,
                data: {
                    items: serverState.inputsPage.map((partial, index) => inputFixture({
                        ordinal: index + 1,
                        inputId: index === 0
                            ? '00000000-0000-4000-8000-000000000001'
                            : '00000000-0000-4000-8000-000000000009',
                        presentationState: partial.presentationState,
                        retryState: partial.retryState,
                        safeCode: partial.safeCode,
                    })),
                    pageInfo: { nextCursor: null, hasMore: false },
                    sessionVersion: 4,
                    presentationRevision: 5,
                },
            },
        };
    }
    if (action === 'read_scan_session_v3') {
        return { data: { contractVersion: BATCH_VERSION, data: serverState.sessionV3 } };
    }
    if (action === 'read_scan_batch_review') {
        if ('failure' in serverState.batchReview && serverState.batchReview.failure) {
            return {
                data: undefined,
                error: {
                    context: {
                        json: () => ({
                            error: 'P9_INTERNAL_ERROR', retryable: true,
                            message: 'aggregate unavailable',
                        }),
                    },
                },
            };
        }
        const aggregate = serverState.batchReview as {
            counts: Record<string, number>; items: unknown[];
        };
        return {
            data: {
                contractVersion: BATCH_VERSION,
                data: {
                    sessionId: '00000000-0000-4000-8000-000000000010',
                    status: 'active', sessionVersion: 4, presentationRevision: 5,
                    defaults: {
                        languageHint: 'en', condition: null, location: 'Front shelf',
                        priceMinor: null, quantity: 1, publication: 'private', script: null,
                    },
                    batchLabel: null,
                    counts: aggregate.counts,
                    items: aggregate.items,
                    updatedAt: '2026-08-24T00:00:00.000Z',
                },
            },
        };
    }
    throw new Error(`unexpected action in integration fixture: ${action}`);
}

describe('Phase 9 NEW 6G-C genuine mounted production-route composition', () => {
    let client: QueryClient;
    let wrapper: ({ children }: PropsWithChildren) => React.JSX.Element;

    beforeEach(() => {
        jest.clearAllMocks();
        freshServerState();
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        wrapper = ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        mockInvoke.mockImplementation(async (_name: string, invocation: { body: { action: string } }) => (
            respond(invocation.body.action)
        ));
    });

    afterEach(() => { client.clear(); });

    async function renderSessionRoute() {
        const screen = render(<SessionRoute />, { wrapper });
        // The real access boundary resolves identity asynchronously first,
        // then the real v3/inputs/aggregate queries load through the fence.
        await screen.findByText('Checking inventory access…').catch(() => undefined);
        await screen.findByText('Finding books');
        return screen;
    }

    async function refetchAll() {
        await act(async () => {
            await client.invalidateQueries({ queryKey: ['phase9'] });
        });
    }

    it('keeps Unit 6 mounted through processing, candidate arrival, aggregate failure, correction entry, and overflow fail-closed', async () => {
        const screen = await renderSessionRoute();

        // Zero candidates initially: the Unit 6 processing surface is present
        // and no candidate-only review screen replaced the route.
        expect(screen.getByText('Finding books')).toBeTruthy();
        expect(screen.getByText('View session summary')).toBeTruthy();
        expect(screen.queryByText(/Detected Book One/u)).toBeNull();

        // Candidate data arrives through the composed path without replacing
        // the Unit 6 lifecycle surface.
        serverState.batchReview = {
            counts: { ...zeroCounts(), detected: 2 },
            items: [cardFixture()],
        };
        await refetchAll();
        await waitFor(() => expect(screen.getAllByText(/Detected Book One/u).length).toBeGreaterThan(0));
        expect(screen.getByText('Finding books')).toBeTruthy();
        expect(screen.getByText('Books found: 1')).toBeTruthy();

        // Full-correction navigation stays reachable through the composed path.
        fireEvent.press(screen.getAllByText('Open full correction')[0]);
        expect(mockRouter.push).toHaveBeenCalledWith(
            '/(store-owner)/inventory/scan/00000000-0000-4000-8000-000000000010/candidate/00000000-0000-4000-8000-000000000021',
        );

        // Aggregate failure degrades only the compact-review subsection;
        // Unit 6 remains mounted and usable.
        serverState.batchReview = { failure: true } as BatchReviewState;
        await refetchAll();
        await waitFor(() => expect(screen.getByTestId('batch-review-degraded')).toBeTruthy());
        expect(screen.getByText('Finding books')).toBeTruthy();
        expect(screen.getByText('View session summary')).toBeTruthy();
        expect(screen.queryByText(/Detected Book One/u)).toBeNull();

        // Historical overflow fails closed instead of looking complete while
        // Unit 6 keeps rendering.
        serverState.batchReview = {
            counts: { ...zeroCounts(), detected: 20, processing: 16 },
            items: [cardFixture()],
        };
        await refetchAll();
        await waitFor(() => expect(screen.getByTestId('batch-review-unsupported')).toBeTruthy());
        expect(screen.queryByText(/Books found:/u)).toBeNull();
        expect(screen.getByText('Finding books')).toBeTruthy();
        expect(screen.getByText('View session summary')).toBeTruthy();
    });

    it('fails closed on detected-count volume beyond single-image support even with small active states', async () => {
        // Historical session whose extra candidates sit OUTSIDE the active
        // review states (previously committed/dispositioned legacy rows):
        // only counts.detected proves the volume, so it must fence alone.
        serverState.inputsPage = [
            { presentationState: 'ready', retryState: 'none', safeCode: null },
        ];
        serverState.batchReview = {
            counts: { ...zeroCounts(), detected: 20 },
            items: [cardFixture()],
        };
        const screen = render(<SessionRoute />, { wrapper });
        await waitFor(() => expect(screen.getByTestId('batch-review-unsupported')).toBeTruthy());
        expect(screen.queryByText(/Books found:/u)).toBeNull();
        expect(screen.queryByText('Continue to book review')).toBeNull();
        expect(screen.queryByText(/Detected Book One/u)).toBeNull();
        expect(screen.getByText('View session summary')).toBeTruthy();
    });

    it('keeps a supported single-image session with detected = 15 and dispositioned candidates unfenced', async () => {
        serverState.inputsPage = [
            { presentationState: 'ready', retryState: 'none', safeCode: null },
        ];
        serverState.batchReview = {
            counts: { ...zeroCounts(), detected: 15, committed: 12, needsAttention: 1 },
            items: [
                cardFixture(),
                cardFixture({
                    candidateId: '00000000-0000-4000-8000-000000000022',
                    ordinal: 2,
                    observed: { title: 'Detected Book Two', authors: [], language: 'en', script: null },
                }),
            ],
        };
        const screen = render(<SessionRoute />, { wrapper });
        await waitFor(() => expect(screen.getAllByText(/Detected Book One/u).length).toBeGreaterThan(0));
        expect(screen.queryByTestId('batch-review-unsupported')).toBeNull();
        expect(screen.getByText('Books found: 2')).toBeTruthy();
    });

});
