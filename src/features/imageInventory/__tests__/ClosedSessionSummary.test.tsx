import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryReadinessSummaryScreen } from '../screens/ReadinessSummaryScreen';

jest.mock('../queries/ownerUxQueries', () => ({
    useOwnerInventoryReadiness: () => ({ data: {
        sessionId: '00000000-0000-4000-8000-000000000001', sessionStatus: 'closed',
        sessionVersion: 2, allInputsTerminal: true, blockerCounts: {},
        nextBlockingCandidateId: null, closeState: 'closed', closeAllowed: false,
        presentationRevision: 1, closeSummary: {
            imagesSubmitted: 1, imagesProcessed: 1, imagesFailed: 0, imagesSkipped: 0,
            candidatesDetected: 1, candidatesReviewReady: 1, candidatesNeedsReview: 0,
            candidatesFailed: 0, falseDetections: 0, manualMissedCandidates: 0,
            committedInventoryItems: 1, quantitiesAddedToExisting: 0,
            privateItems: 1, publishedItems: 0, languageSkips: 0,
            candidateCapSkips: 0, qualitySkips: 0,
        },
    }, isLoading: false, error: null }),
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
    useOwnerUxOfflineGate: () => ({ canMutate: false, message: null }),
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
