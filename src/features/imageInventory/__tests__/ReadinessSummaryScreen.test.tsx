import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { InventoryReadinessSummaryScreen } from '../screens/ReadinessSummaryScreen';
import { testUuid } from '../testing/ownerUxTestFixtures';

const mockPush = jest.fn();
const mockRefetch = jest.fn();
const mockBatchRefetch = jest.fn();
const mockClose = jest.fn();
let mockOffline = false;
let mockState: Record<string, unknown>;
let mockBatchReviewState: Record<string, unknown>;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    textPrimary: '#111', textSecondary: '#333', bgCard: '#fff', border: '#ccc',
    error: '#900', accent: '#06f', disabled: '#aaa', disabledLight: '#bbb',
} }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../screens/InventoryAccessBoundary', () => ({
    InventoryAccessBoundary: ({ children }: { children: (identity: { userId: string; storeId: string }) => React.ReactNode }) => children({ userId: 'owner-1', storeId: 'store-1' }),
}));
jest.mock('../queries/ownerUxQueries', () => ({}));
jest.mock('../queries/ownerBatchReviewQueries', () => ({
    useOwnerSessionV3: () => mockState,
    useOwnerBatchReview: () => mockBatchReviewState,
    useCloseOwnerInventorySessionV3: () => ({ mutateAsync: mockClose, mutate: mockClose, isPending: false }),
}));

const closeSummary = {
    imagesSubmitted: 0, imagesProcessed: 0, imagesFailed: 0, imagesSkipped: 0,
    candidatesDetected: 0, candidatesReviewReady: 0, candidatesNeedsReview: 0,
    candidatesFailed: 0, falseDetections: 0, ownerRemovedCandidates: 0,
    manualMissedCandidates: 0, committedInventoryItems: 0,
    quantitiesAddedToExisting: 0, privateItems: 0,
    publishedItems: 0, languageSkips: 0, candidateCapSkips: 0, qualitySkips: 0,
};

// NEW 6G-C cutover: the summary surface reads the v3 session contract.
const readiness = (overrides: Record<string, unknown> = {}) => ({
    sessionId: testUuid(1), status: 'active', sessionVersion: 2,
    startedAt: '2026-08-24T00:00:00.000Z', updatedAt: '2026-08-24T00:00:00.000Z',
    closedAt: null, expiresAt: '2026-08-25T00:00:00.000Z',
    defaults: {
        languageHint: 'en', condition: 'good', location: 'Front shelf',
        priceMinor: null, quantity: 1, publication: 'private', script: null,
    },
    batchLabel: null,
    closeSummary,
    allInputsTerminal: true,
    closeState: 'closeable',
    presentationRevision: 3, ...overrides,
});

const zeroBlockerCounts = {
    input_processing: 0, candidate_processing: 0, candidate_failed: 0,
    review_missing: 0, title_unconfirmed: 0, author_confirmation_incomplete: 0,
    language_missing: 0, metadata_choice_missing: 0, quantity_invalid: 0,
    price_invalid: 0, condition_missing: 0, damage_answer_missing: 0,
    damage_details_missing: 0, location_missing: 0, publication_intent_missing: 0,
    duplicate_intent_missing: 0, variant_source_stale: 0,
};

function aggregateCard(overrides: Record<string, unknown> = {}) {
    return {
        sessionId: testUuid(1),
        candidateId: testUuid(21),
        inputId: null,
        ordinal: 1,
        candidateState: 'needs_review',
        candidateVersion: 2,
        metadataState: 'selected',
        metadataRevision: 3,
        reviewVersion: null,
        reviewDisposition: null,
        observed: { title: 'Book A', authors: ['Author A'], language: 'en', script: 'Latn' },
        metadataSummary: null,
        review: null,
        fieldSources: {
            cover: 'missing', title: 'detected', authors: 'detected', language: 'detected',
            condition: 'missing', price: 'missing', quantity: 'default',
            location: 'missing', publication: 'default', damage: 'default',
        },
        attentionCodes: [],
        blockers: [],
        reviewReady: false,
        allowedActions: ['view_metadata'],
        updatedAt: '2026-08-24T00:00:00.000Z',
        ...overrides,
    };
}

function batchReviewFixture(cards: unknown[] = [], overrides: Record<string, unknown> = {}) {
    return {
        data: {
            sessionId: testUuid(1), status: 'active', sessionVersion: 2,
            presentationRevision: 3,
            defaults: {
                languageHint: 'en', condition: null, location: 'Front shelf',
                priceMinor: null, quantity: 1, publication: 'private', script: null,
            },
            batchLabel: null,
            counts: {
                detected: cards.length, processing: 0, needsAttention: cards.length,
                reviewReadySaved: 0, committed: 0, ownerRemoved: 0, falseDetections: 0,
            },
            items: cards,
            updatedAt: '2026-08-24T00:00:00.000Z',
            ...overrides,
        },
        isLoading: false,
        error: null as Error | null,
        refetch: mockBatchRefetch.mockResolvedValue({ isError: false, error: null }),
    };
}

describe('Phase 9 Unit 6F readiness summary and Close', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockOffline = false;
        mockRefetch.mockResolvedValue({ data: readiness(), isError: false, error: null });
        mockClose.mockResolvedValue({
            sessionId: testUuid(1), sessionStatus: 'closed', sessionVersion: 3,
            allInputsTerminal: true, closeSummary, blockerCounts: zeroBlockerCounts,
            nextBlockingCandidateId: null, closeState: 'closed',
            closeAllowed: false, presentationRevision: 4,
        });
        mockState = { data: readiness(), isLoading: false, error: null, refetch: mockRefetch, isFetchedAfterMount: true };
        mockBatchReviewState = batchReviewFixture();
    });

    it('keeps zero categories visible and shows the all-zero state', async () => {
        const screen = render(<InventoryReadinessSummaryScreen sessionId={testUuid(1)} />);
        expect(screen.getByText('No images or books yet')).toBeTruthy();
        expect(screen.getByText('Images submitted: 0')).toBeTruthy();
        expect(screen.getByText('Published items: 0')).toBeTruthy();
    });

    it('shows bounded nonterminal guidance and no enabled Close action', () => {
        mockState = { data: readiness({ allInputsTerminal: false, closeState: 'not_closeable', closeAllowed: false }), isLoading: false, error: null, refetch: mockRefetch, isFetchedAfterMount: true };
        const screen = render(<InventoryReadinessSummaryScreen sessionId={testUuid(1)} />);
        expect(screen.getByText('Some images are still processing')).toBeTruthy();
        expect(screen.queryByText('Close session')).toBeNull();
    });

    it('fails closed for offline or retained-cache error state', () => {
        mockOffline = true;
        let screen = render(<InventoryReadinessSummaryScreen sessionId={testUuid(1)} />);
        expect(screen.getByText('Close session')).toBeDisabled();
        screen.unmount();

        mockOffline = false;
        mockState = { data: readiness(), isLoading: false, error: new Error('private failure'), refetch: mockRefetch, isFetchedAfterMount: true };
        screen = render(<InventoryReadinessSummaryScreen sessionId={testUuid(1)} />);
        expect(screen.getByText('Close session')).toBeDisabled();
        expect(screen.queryByText('private failure')).toBeNull();
    });

    it('requires confirmation, sends one canonical Close command, and never exposes a commit action', async () => {
        const screen = render(<InventoryReadinessSummaryScreen sessionId={testUuid(1)} />);
        await waitFor(() => expect(screen.getByText('Close session')).toBeTruthy());
        fireEvent.press(screen.getByText('Close session'));
        expect(mockClose).not.toHaveBeenCalled();
        const confirm = screen.getAllByText('Close session').at(-1)!;
        fireEvent.press(confirm);
        fireEvent.press(confirm);
        await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1));
        expect(mockClose.mock.calls[0][0]).toMatchObject({
            sessionId: testUuid(1), expectedSessionVersion: 2,
        });
        expect(screen.queryByText(/^Commit inventory$/i)).toBeNull();
        expect(screen.queryByText(/^Publish inventory$/i)).toBeNull();
    });

    it('composes pre-close blockers from the supplemental batch aggregate with review-next-blocker navigation', () => {
        mockState = {
            data: readiness({ allInputsTerminal: true, closeState: 'not_closeable' }),
            isLoading: false, error: null, refetch: mockRefetch, isFetchedAfterMount: true,
        };
        mockBatchReviewState = batchReviewFixture([
            aggregateCard({
                blockers: [{
                    code: 'price_invalid', candidateId: testUuid(21), inputId: null,
                    field: 'priceMinor', safeMessage: 'Price needs correction.',
                }],
            }),
            aggregateCard({
                candidateId: testUuid(22),
                blockers: [{
                    code: 'price_invalid', candidateId: testUuid(22), inputId: null,
                    field: 'priceMinor', safeMessage: 'Price needs correction.',
                }, {
                    code: 'location_missing', candidateId: testUuid(22), inputId: null,
                    field: 'shelfLocation', safeMessage: 'Shelf location missing.',
                }],
            }),
        ]);
        const screen = render(<InventoryReadinessSummaryScreen sessionId={testUuid(1)} />);
        expect(screen.getByTestId('pre-close-review-blockers')).toBeTruthy();
        expect(screen.getByText('Price needs correction: 2')).toBeTruthy();
        expect(screen.getByText('Shelf location missing: 1')).toBeTruthy();
        fireEvent.press(screen.getByText('Review next blocker'));
        expect(mockPush).toHaveBeenCalledWith(
            `/(store-owner)/inventory/scan/${testUuid(1)}/candidate/${testUuid(21)}`,
        );
    });

    it('never lets visible review cards substitute for server-authoritative v3 Close availability', () => {
        // Cards exist and carry attention items, but v3 closeState denies Close.
        mockState = {
            data: readiness({ allInputsTerminal: false, closeState: 'not_closeable' }),
            isLoading: false, error: null, refetch: mockRefetch, isFetchedAfterMount: true,
        };
        mockBatchReviewState = batchReviewFixture([aggregateCard({
            blockers: [{
                code: 'price_invalid', candidateId: testUuid(21), inputId: null,
                field: 'priceMinor', safeMessage: 'Price needs correction.',
            }],
        })]);
        const screen = render(<InventoryReadinessSummaryScreen sessionId={testUuid(1)} />);
        expect(screen.getByTestId('pre-close-review-blockers')).toBeTruthy();
        expect(screen.queryByText('Close session')).toBeNull();
        screen.unmount();

        // Aggregate failure also cannot unlock or block the v3 Close gate.
        mockState = {
            data: readiness(),
            isLoading: false, error: null, refetch: mockRefetch, isFetchedAfterMount: true,
        };
        mockBatchReviewState = { ...batchReviewFixture([]), error: new Error('aggregate down') };
        const aggregateFailureScreen = render(<InventoryReadinessSummaryScreen sessionId={testUuid(1)} />);
        expect(aggregateFailureScreen.getByText('Close session')).toBeTruthy();
    });

    it('shows bounded degradation when the pre-close aggregate fails while summary authority stays intact', () => {
        mockState = {
            data: readiness({ allInputsTerminal: true, closeState: 'not_closeable' }),
            isLoading: false, error: null, refetch: mockRefetch, isFetchedAfterMount: true,
        };
        mockBatchReviewState = { ...batchReviewFixture([]), error: new Error('aggregate down') };
        const screen = render(<InventoryReadinessSummaryScreen sessionId={testUuid(1)} />);
        expect(screen.getByText('Book review status could not be loaded.')).toBeTruthy();
        expect(screen.queryByText('aggregate down')).toBeNull();
        fireEvent.press(screen.getByText('Retry book review'));
        expect(mockBatchRefetch).toHaveBeenCalled();
    });
});
