import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { CandidateCorrectionActions } from '../components/CandidateCorrectionActions';
import { InventoryMissedBookScreen } from '../screens/MissedBookScreen';
import { OwnerCorrectionClientError } from '../api/ownerCorrectionService';
import { candidateDetailFixture, sessionSummaryFixture, testUuid } from '../testing/ownerUxTestFixtures';

const mockPush = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());
const mockDispatch = jest.fn();
const mockFalse = jest.fn();
const mockAdd = jest.fn();
const mockReadCandidate = jest.fn();
const mockCandidateRefetch = jest.fn();
const mockUserId = '00000000-0000-4000-8000-000000000090';
const mockStoreId = '00000000-0000-4000-8000-000000000008';
let mockOffline = false;
let mockSession = sessionSummaryFixture();

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
    useNavigation: () => ({ addListener: mockAddListener, dispatch: mockDispatch }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        textPrimary: '#111', textSecondary: '#333', border: '#ccc',
        accent: '#06f', error: '#900', bgCard: '#fff', bgSecondary: '#eee',
    } }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOffline: mockOffline }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../screens/InventoryAccessBoundary', () => ({
    InventoryAccessBoundary: ({ children }: { children: (identity: { userId: string; storeId: string }) => React.ReactNode }) => (
        children({ userId: mockUserId, storeId: mockStoreId })
    ),
}));
jest.mock('../api/ownerUxService', () => ({
    ownerUxService: { readCandidate: (...args: unknown[]) => mockReadCandidate(...args) },
    OwnerUxClientError: class OwnerUxClientError extends Error {},
}));
jest.mock('../queries/ownerCorrectionQueries', () => ({
    useAddManualCandidate: () => ({ mutateAsync: mockAdd, isPending: false }),
    useMarkCandidateFalse: () => ({ mutateAsync: mockFalse, isPending: false }),
    useOwnerCandidateVariants: () => ({ data: [], isLoading: false, error: null, refetch: jest.fn() }),
    useDecideOwnerVariant: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useReplaceOwnerVariant: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useCorrectionQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
    synchronizeCorrectionCandidate: jest.fn().mockResolvedValue(true),
}));
jest.mock('../queries/ownerUxQueries', () => ({
    useOwnerInventorySession: () => ({
        data: mockSession,
        isLoading: false,
        error: null,
        isFetchedAfterMount: true,
        refetch: jest.fn().mockResolvedValue({ data: mockSession, isError: false, error: null }),
    }),
    getResolvedImageInventoryIdentity: () => ({ userId: mockUserId, storeId: mockStoreId }),
}));

describe('Phase 9 Unit 6E false and missed-book screens', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockOffline = false;
        mockSession = sessionSummaryFixture();
        mockCandidateRefetch.mockResolvedValue({
            data: candidateDetailFixture({ candidateVersion: 5, allowedActions: ['view_readiness'] }),
            isError: false,
            error: null,
        });
        mockReadCandidate.mockResolvedValue(candidateDetailFixture({ candidateId: testUuid(30) }));
        mockFalse.mockResolvedValue({ candidateId: testUuid(2), authenticatedUserId: testUuid(90) });
        mockAdd.mockResolvedValue({ candidateId: testUuid(30), authenticatedUserId: testUuid(90) });
    });

    it('requires destructive confirmation, cancel does nothing, and duplicate confirmation dispatches once', async () => {
        const screen = render(<CandidateCorrectionActions
            identity={{ userId: testUuid(90), storeId: testUuid(8) }}
            detail={candidateDetailFixture()}
            refetchCandidate={mockCandidateRefetch}
        />);
        fireEvent.press(screen.getByText('Mark false'));
        expect(screen.getByText('Mark as false detection?')).toBeTruthy();
        expect(screen.getByText(/cannot be undone/u)).toBeTruthy();
        fireEvent.press(screen.getByText('Cancel'));
        expect(mockFalse).not.toHaveBeenCalled();
        fireEvent.press(screen.getByText('Mark false'));
        act(() => {
            const confirm = screen.getAllByText('Mark false').at(-1)!;
            fireEvent.press(confirm);
            fireEvent.press(confirm);
        });
        await waitFor(() => expect(mockFalse).toHaveBeenCalledTimes(1));
    });

    it('fails closed for a failed candidate even when M29 advertises mark_false', () => {
        const screen = render(<CandidateCorrectionActions
            identity={{ userId: testUuid(90), storeId: testUuid(8) }}
            detail={candidateDetailFixture({ candidateState: 'failed' })}
            refetchCandidate={mockCandidateRefetch}
        />);
        expect(screen.queryByText('Mark false')).toBeNull();
    });

    it('retries an ambiguous false disposition with the identical command and key', async () => {
        mockFalse
            .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_INTERNAL_ERROR'))
            .mockResolvedValueOnce({ candidateId: testUuid(2), authenticatedUserId: testUuid(90) });
        const screen = render(<CandidateCorrectionActions
            identity={{ userId: testUuid(90), storeId: testUuid(8) }}
            detail={candidateDetailFixture()}
            refetchCandidate={mockCandidateRefetch}
        />);
        fireEvent.press(screen.getByText('Mark false'));
        fireEvent.press(screen.getAllByText('Mark false').at(-1)!);
        await waitFor(() => expect(screen.getByLabelText('Retry same false action')).toBeTruthy());
        const original = mockFalse.mock.calls[0][0];
        fireEvent.press(screen.getByLabelText('Retry same false action'));
        await waitFor(() => expect(mockFalse).toHaveBeenCalledTimes(2));
        expect(mockFalse.mock.calls[1][0]).toBe(original);
    });

    it('submits the minimal missed-book command once, refetches canonical detail, and opens Unit 6D review', async () => {
        const screen = render(<InventoryMissedBookScreen sessionId={testUuid(1)} />);
        fireEvent.changeText(screen.getByTestId('missed-title'), ' ಕನ್ನಡ ಪುಸ್ತಕ ');
        fireEvent.changeText(screen.getByTestId('missed-author-0'), ' ಲೇಖಕ ');
        fireEvent.changeText(screen.getByTestId('missed-language'), 'KN-knda');
        fireEvent.press(screen.getByText('Add candidate'));
        fireEvent.press(screen.getByText('Add candidate'));
        await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
        expect(mockAdd.mock.calls[0][0]).toMatchObject({
            sessionId: testUuid(1), title: 'ಕನ್ನಡ ಪುಸ್ತಕ', authors: ['ಲೇಖಕ'], language: 'kn-Knda',
        });
        expect(mockReadCandidate).toHaveBeenCalledWith(testUuid(1), testUuid(30));
        expect(mockPush).toHaveBeenCalledWith(
            `/(store-owner)/inventory/scan/${testUuid(1)}/candidate/${testUuid(30)}`,
        );
    });

    it('commits the successful draft fingerprint before navigation and requires a real edit for another command', async () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
        const screen = render(<InventoryMissedBookScreen sessionId={testUuid(1)} />);
        fireEvent.changeText(screen.getByTestId('missed-title'), 'First missed book');
        fireEvent.changeText(screen.getByTestId('missed-language'), 'en');
        fireEvent.press(screen.getByText('Add candidate'));
        await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));

        const listenerCalls = mockAddListener.mock.calls as unknown as Array<[
            string,
            (event: { preventDefault: () => void; data: { action: { type: string } } }) => void,
        ]>;
        const latestBeforeRemove = listenerCalls
            .filter(([event]) => event === 'beforeRemove')
            .at(-1)?.[1] as ((event: {
                preventDefault: () => void;
                data: { action: { type: string } };
            }) => void) | undefined;
        const preventDefault = jest.fn();
        latestBeforeRemove?.({ preventDefault, data: { action: { type: 'GO_BACK' } } });
        expect(preventDefault).not.toHaveBeenCalled();
        expect(alert).not.toHaveBeenCalled();

        fireEvent.press(screen.getByText('Add candidate'));
        expect(mockAdd).toHaveBeenCalledTimes(1);

        fireEvent.changeText(screen.getByTestId('missed-title'), 'Second missed book');
        const dirtyBeforeRemove = listenerCalls
            .filter(([event]) => event === 'beforeRemove')
            .at(-1)?.[1] as typeof latestBeforeRemove;
        dirtyBeforeRemove?.({ preventDefault, data: { action: { type: 'GO_BACK' } } });
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(alert).toHaveBeenCalledWith(
            'Leave without adding?',
            expect.stringContaining('only on this screen'),
            expect.any(Array),
        );

        fireEvent.press(screen.getByText('Add candidate'));
        await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(2));
        expect(mockAdd.mock.calls[1][0]).toMatchObject({ title: 'Second missed book' });
        expect(mockAdd.mock.calls[1][0]).not.toBe(mockAdd.mock.calls[0][0]);
    });

    it('keeps missed-book mutation disabled offline and installs a dirty guard', () => {
        mockOffline = true;
        const screen = render(<InventoryMissedBookScreen sessionId={testUuid(1)} />);
        expect(screen.getByText('Add candidate')).toBeDisabled();
        fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
        expect(mockAddListener).toHaveBeenCalledWith('beforeRemove', expect.any(Function));
    });

    it('retries an ambiguous missed-book response with the identical semantic command', async () => {
        mockAdd
            .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_INTERNAL_ERROR'))
            .mockResolvedValueOnce({ candidateId: testUuid(30), authenticatedUserId: testUuid(90) });
        const screen = render(<InventoryMissedBookScreen sessionId={testUuid(1)} />);
        fireEvent.changeText(screen.getByTestId('missed-title'), 'Book');
        fireEvent.press(screen.getByText('Add candidate'));
        await waitFor(() => expect(screen.getByText('Retry same addition')).toBeTruthy());
        const original = mockAdd.mock.calls[0][0];
        fireEvent.press(screen.getByText('Retry same addition'));
        await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(2));
        expect(mockAdd.mock.calls[1][0]).toBe(original);
    });
});
