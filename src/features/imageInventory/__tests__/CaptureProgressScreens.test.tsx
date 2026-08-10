import { act, fireEvent, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { InventorySessionProgressScreen } from '../screens/CaptureProgressScreens';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockRefetch = jest.fn(() => Promise.resolve({ isError: false, error: null }));
const mockRemoveMutate = jest.fn();
let mockFocused = true;
const mockSession = { data: { status: 'active' }, error: null, refetch: mockRefetch };
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
    useOwnerInventorySession: () => mockSession,
    useOwnerInventoryInputs: () => mockInputs,
    useOwnerInventoryCandidates: () => mockCandidates,
}));
jest.mock('../queries/ownerUxInputQueries', () => ({
    useRemoveOwnerInventoryInput: () => ({
        mutate: mockRemoveMutate,
        isPending: false,
        error: null,
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
