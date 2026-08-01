import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { InventoryReadinessSummaryScreen } from '../screens/ReadinessSummaryScreen';
import { testUuid } from '../testing/ownerUxTestFixtures';

const mockPush = jest.fn();
const mockRefetch = jest.fn();
const mockClose = jest.fn();
let mockOffline = false;
let mockState: Record<string, unknown>;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }));
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
jest.mock('../queries/ownerUxQueries', () => ({
    useOwnerInventoryReadiness: () => mockState,
}));
jest.mock('../queries/ownerUxCloseQueries', () => ({
    useCloseOwnerInventorySession: () => ({ mutateAsync: mockClose, isPending: false }),
}));

const readiness = (overrides: Record<string, unknown> = {}) => ({
    sessionId: testUuid(1), sessionStatus: 'active', sessionVersion: 2,
    allInputsTerminal: true,
    closeSummary: {
        imagesSubmitted: 0, imagesProcessed: 0, imagesFailed: 0, imagesSkipped: 0,
        candidatesDetected: 0, candidatesReviewReady: 0, candidatesNeedsReview: 0,
        candidatesFailed: 0, falseDetections: 0, manualMissedCandidates: 0,
        committedInventoryItems: 0, quantitiesAddedToExisting: 0, privateItems: 0,
        publishedItems: 0, languageSkips: 0, candidateCapSkips: 0, qualitySkips: 0,
    },
    blockerCounts: {
        input_processing: 0, candidate_processing: 0, candidate_failed: 0,
        review_missing: 0, title_unconfirmed: 0, author_confirmation_incomplete: 0,
        language_missing: 0, metadata_choice_missing: 0, quantity_invalid: 0,
        price_invalid: 0, condition_missing: 0, damage_answer_missing: 0,
        damage_details_missing: 0, location_missing: 0, publication_intent_missing: 0,
        duplicate_intent_missing: 0, variant_source_stale: 0,
    }, nextBlockingCandidateId: null, closeState: 'closeable', closeAllowed: true,
    presentationRevision: 3, ...overrides,
});

describe('Phase 9 Unit 6F readiness summary and Close', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockOffline = false;
        mockRefetch.mockResolvedValue({ data: readiness(), isError: false, error: null });
        mockClose.mockResolvedValue({ ...readiness(), sessionStatus: 'closed', sessionVersion: 3, closeState: 'closed', closeAllowed: false });
        mockState = { data: readiness(), isLoading: false, error: null, refetch: mockRefetch, isFetchedAfterMount: true };
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
});
