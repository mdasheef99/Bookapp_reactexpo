import { fireEvent, render } from '@testing-library/react-native';
import { InventorySessionProgressScreen } from '../screens/CaptureProgressScreens';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockRefetch = jest.fn(() => Promise.resolve());
const mockSession = { data: { status: 'active' }, error: null, refetch: mockRefetch };
const mockInputs = {
    data: {
        presentationRevision: 2,
        items: [{
            inputId: '00000000-0000-4000-8000-000000000001',
            ordinal: 1,
            presentationState: 'needs_attention',
            retryState: 'new_upload_required',
            safeCode: 'P9_VISION_OVER_LIMIT',
        }],
    },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
};
const mockCandidates = {
    data: { items: [{
        sessionId: '00000000-0000-4000-8000-000000000010',
        sessionStartedAt: '2026-07-31T00:00:00.000Z',
        sessionExpiresAt: '2026-08-30T00:00:00.000Z',
        sessionStatus: 'active',
        candidateId: '00000000-0000-4000-8000-000000000002',
        inputId: null,
        ordinal: 1,
        title: 'Original book',
        authors: ['Original author'],
        language: 'en',
        candidateState: 'needs_review',
        candidateVersion: 1,
        metadataState: 'manual',
        reviewDisposition: null,
        attentionCodes: ['metadata_manual_required'],
        reviewReady: false,
        updatedAt: '2026-07-31T00:00:00.000Z',
    }] },
    isLoading: false,
    error: null as Error | null,
    refetch: mockRefetch,
};

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
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
    useOwnerInventorySession: () => mockSession,
    useOwnerInventoryInputs: () => mockInputs,
    useOwnerInventoryCandidates: () => mockCandidates,
}));

describe('Phase 9 Unit 6C server progress and handoff', () => {
    beforeEach(() => jest.clearAllMocks());

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

    it('fails safely for an expired session', () => {
        mockSession.data.status = 'expired';
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByText('This scan session is unavailable.')).toBeTruthy();
        fireEvent.press(screen.getByText('Return to Inventory'));
        expect(mockRouter.replace).toHaveBeenCalledWith('/(store-owner)/inventory');
        mockSession.data.status = 'active';
    });

    it('shows a retry instead of zero books when candidate loading fails', () => {
        mockCandidates.error = new Error('private candidate query detail');
        const screen = render(
            <InventorySessionProgressScreen sessionId="00000000-0000-4000-8000-000000000010" />,
        );
        expect(screen.getByText('Saved scan progress could not be loaded.')).toBeTruthy();
        expect(screen.queryByText('private candidate query detail')).toBeNull();
        fireEvent.press(screen.getByText('Retry'));
        expect(mockRefetch).toHaveBeenCalled();
        mockCandidates.error = null;
    });
});
