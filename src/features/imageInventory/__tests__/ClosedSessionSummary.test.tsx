import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryReadinessSummaryScreen } from '../screens/ReadinessSummaryScreen';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../queries/ownerUxQueries', () => ({}));
jest.mock('../queries/ownerBatchReviewQueries', () => ({
    useOwnerBatchReview: () => ({
        data: null, isLoading: false, error: null, refetch: jest.fn(),
    }),
    useOwnerSessionV3: () => ({ data: {
        sessionId: '00000000-0000-4000-8000-000000000001', status: 'closed',
        sessionVersion: 2, startedAt: '2026-08-24T00:00:00.000Z',
        updatedAt: '2026-08-24T00:00:00.000Z',
        closedAt: '2026-08-24T01:00:00.000Z',
        expiresAt: '2026-08-25T00:00:00.000Z',
        defaults: {
            languageHint: 'en', condition: null, location: 'Front shelf',
            priceMinor: null, quantity: 1, publication: 'private', script: null,
        },
        batchLabel: null,
        allInputsTerminal: true, blockerCounts: {},
        nextBlockingCandidateId: null, closeState: 'closed',
        presentationRevision: 1, closeSummary: {
            imagesSubmitted: 1, imagesProcessed: 1, imagesFailed: 0, imagesSkipped: 0,
            candidatesDetected: 1, candidatesReviewReady: 1, candidatesNeedsReview: 0,
            candidatesFailed: 0, falseDetections: 0, ownerRemovedCandidates: 0,
            manualMissedCandidates: 0, committedInventoryItems: 1,
            quantitiesAddedToExisting: 0,
            privateItems: 1, publishedItems: 0, languageSkips: 0,
            candidateCapSkips: 0, qualitySkips: 0,
        },
    }, isLoading: false, error: null, isFetchedAfterMount: true }),
    useCloseOwnerInventorySessionV3: () => ({ mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false }),
}));
jest.mock('../identity/imageInventoryIdentity', () => ({
    useImageInventoryIdentity: () => ({
        status: 'ready', identity: { userId: 'owner', storeId: 'store' }, storeName: 'Store',
    }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOffline: false }),
}));
jest.mock('../offline/ownerUxOfflineGate', () => ({
    useOwnerUxOfflineGate: () => ({ canMutate: false, isOffline: false, isRefreshingAuthority: false }),
}));
jest.mock('../queries/ownerUxCloseQueries', () => ({
    useCloseOwnerInventorySession: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

describe('closed ingestion session', () => {
    it('U7B-RT18 closed summary renders immutable ingestion outcomes rather than live publication state', () => {
        const screen = render(<QueryClientProvider client={new QueryClient()}>
            <InventoryReadinessSummaryScreen
                sessionId="00000000-0000-4000-8000-000000000001" />
        </QueryClientProvider>);
        expect(screen.getByText(/Private items/u)).toBeTruthy();
        expect(screen.queryByText(/Retry publication/u)).toBeNull();
    });
});
