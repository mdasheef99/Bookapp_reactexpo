import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { VariantDecisionSheet } from '../components/VariantDecisionSheet';
import { OwnerCorrectionClientError } from '../api/ownerCorrectionService';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

const mockDecide = jest.fn();
const mockReplace = jest.fn();
const mockRefetchVariants = jest.fn();
const mockRefetchCandidate = jest.fn();
const mockClose = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());
let mockOffline = false;
let mockVariantState: Record<string, unknown>;

const variantRow = (overrides: Record<string, unknown> = {}) => ({
    proposalId: testUuid(11), version: 2, targetType: 'title', authorPosition: null,
    confirmedSourceText: 'ಮೂಲ', proposedText: 'Moola', variantType: 'primary_roman',
    sourceLanguage: 'kn', sourceScript: 'Knda', variantLanguage: 'kn-Latn',
    variantScript: 'Latn', lifecycleStatus: 'proposed', staleConflictReason: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    allowedActions: ['approve', 'reject', 'replace', 'leave_unresolved'],
    ...overrides,
});

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    textPrimary: '#111', textSecondary: '#333', border: '#ccc', accent: '#06f', error: '#900',
} }) }));
jest.mock('expo-router', () => ({ useNavigation: () => ({ addListener: mockAddListener, dispatch: jest.fn() }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../queries/ownerCorrectionQueries', () => ({
    useOwnerCandidateVariants: () => mockVariantState,
    useDecideOwnerVariant: () => ({ mutateAsync: mockDecide, isPending: false }),
    useReplaceOwnerVariant: () => ({ mutateAsync: mockReplace, isPending: false }),
    useCorrectionQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
    synchronizeCorrectionCandidate: jest.fn().mockResolvedValue(true),
}));

describe('Phase 9 Unit 6E variant decisions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockOffline = false;
        mockVariantState = { data: [variantRow()], isLoading: false, error: null, refetch: mockRefetchVariants };
        mockRefetchVariants.mockResolvedValue({ data: [variantRow({ version: 3, lifecycleStatus: 'active' })], isError: false, error: null });
        mockRefetchCandidate.mockResolvedValue({
            data: candidateDetailFixture(), isError: false, error: null,
        });
        mockDecide.mockResolvedValue({ authenticatedUserId: testUuid(90) });
        mockReplace.mockResolvedValue({ authenticatedUserId: testUuid(90) });
    });

    const renderSheet = () => render(<VariantDecisionSheet
        identity={{ userId: testUuid(90), storeId: testUuid(8) }}
        detail={candidateDetailFixture({
            allowedActions: ['open_variant_review'],
            variantSummary: { unresolvedCount: 1, proposalVersions: [{ proposalId: testUuid(11), version: 2, allowedActions: ['approve', 'reject', 'replace'] }] },
        })}
        refetchCandidate={mockRefetchCandidate}
        onClose={mockClose}
    />);

    it('renders each action only from the exact M24 row and leaves unresolved without mutation', () => {
        mockVariantState = {
            data: [variantRow({ allowedActions: ['reject', 'leave_unresolved'] })],
            isLoading: false, error: null, refetch: mockRefetchVariants,
        };
        const screen = renderSheet();
        expect(screen.queryByText('Approve')).toBeNull();
        expect(screen.getByText('Reject')).toBeTruthy();
        expect(screen.queryByText('Replace')).toBeNull();
        fireEvent.press(screen.getByText('Leave unresolved'));
        expect(mockClose).toHaveBeenCalled();
        expect(mockDecide).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('dispatches approve with the M24 lifecycle version and store scope', async () => {
        const screen = renderSheet();
        fireEvent.press(screen.getByText('Approve'));
        await waitFor(() => expect(mockDecide).toHaveBeenCalledWith(expect.objectContaining({
            storeId: testUuid(8), proposalId: testUuid(11), expectedVersion: 2,
            action: 'approve', reason: 'owner_approved',
        })));
        expect(mockReplace).not.toHaveBeenCalled();
        expect(mockRefetchCandidate).toHaveBeenCalled();
    });

    it('preserves a replacement draft across stale conflict and requires explicit latest or reapply', async () => {
        mockReplace.mockRejectedValueOnce(new OwnerCorrectionClientError('P9_STALE_VERSION'));
        mockRefetchVariants.mockResolvedValueOnce({
            data: [variantRow({ version: 3, proposedText: 'Mula', lifecycleStatus: 'stale', staleConflictReason: 'materially_changed' })],
            isError: false,
            error: null,
        });
        const screen = renderSheet();
        fireEvent.press(screen.getByText('Replace'));
        fireEvent.changeText(screen.getByTestId('variant-replacement-text'), 'My replacement');
        fireEvent.press(screen.getByText('Save replacement'));
        await waitFor(() => expect(screen.getByText('Proposal changed')).toBeTruthy());
        expect(screen.getByDisplayValue('My replacement')).toBeTruthy();
        expect(screen.getByText('Use latest')).toBeTruthy();
        expect(screen.getByText('Reapply')).toBeTruthy();
    });

    it('fails closed when stale refetch retains data with an error', async () => {
        mockDecide.mockRejectedValueOnce(new OwnerCorrectionClientError('P9_VARIANT_SOURCE_MISMATCH'));
        mockRefetchVariants.mockResolvedValueOnce({ data: [variantRow({ version: 3 })], isError: true, error: new Error('private') });
        const screen = renderSheet();
        fireEvent.press(screen.getByText('Reject'));
        await waitFor(() => expect(screen.getByText('Latest proposal details could not be loaded.')).toBeTruthy());
        expect(screen.queryByText('Reapply')).toBeNull();
        expect(screen.queryByText('private')).toBeNull();
    });

    it('maps duplicate replacement to safe inline copy and renders no raw failure', async () => {
        mockReplace.mockRejectedValueOnce(new OwnerCorrectionClientError('P9_VARIANT_DUPLICATE'));
        const screen = renderSheet();
        fireEvent.press(screen.getByText('Replace'));
        fireEvent.changeText(screen.getByTestId('variant-replacement-text'), 'Duplicate');
        fireEvent.press(screen.getByText('Save replacement'));
        await waitFor(() => expect(screen.getByText('That replacement already exists.')).toBeTruthy());
    });

    it('guards a dirty replacement draft before leaving the sheet', () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
        const screen = renderSheet();
        fireEvent.press(screen.getByText('Replace'));
        fireEvent.changeText(screen.getByTestId('variant-replacement-text'), 'Unsaved wording');
        fireEvent.press(screen.getByText('Leave unresolved'));
        expect(alert).toHaveBeenCalledWith(
            'Leave without saving?',
            expect.stringContaining('replacement'),
            expect.any(Array),
        );
        expect(mockClose).not.toHaveBeenCalled();
    });

    it('retries an ambiguous unchanged decision with the identical command and key', async () => {
        mockDecide
            .mockRejectedValueOnce(new OwnerCorrectionClientError('P9_INTERNAL_ERROR'))
            .mockResolvedValueOnce({ authenticatedUserId: testUuid(90) });
        const screen = renderSheet();
        fireEvent.press(screen.getByText('Approve'));
        await waitFor(() => expect(screen.getByText('Retry same decision')).toBeTruthy());
        const original = mockDecide.mock.calls[0][0];
        fireEvent.press(screen.getByText('Retry same decision'));
        await waitFor(() => expect(mockDecide).toHaveBeenCalledTimes(2));
        expect(mockDecide.mock.calls[1][0]).toBe(original);
    });

    it('ignores a late decision after the authenticated identity changes', async () => {
        let resolveLate: (value: { authenticatedUserId: string }) => void = () => {
            throw new Error('late resolver not installed');
        };
        mockDecide.mockImplementationOnce(() => new Promise((resolve) => { resolveLate = resolve; }));
        const detail = candidateDetailFixture({
            allowedActions: ['open_variant_review'],
            variantSummary: { unresolvedCount: 1, proposalVersions: [{ proposalId: testUuid(11), version: 2, allowedActions: ['approve'] }] },
        });
        const screen = render(<VariantDecisionSheet
            identity={{ userId: testUuid(90), storeId: testUuid(8) }} detail={detail}
            refetchCandidate={mockRefetchCandidate} onClose={mockClose}
        />);
        fireEvent.press(screen.getByText('Approve'));
        await waitFor(() => expect(mockDecide).toHaveBeenCalled());
        screen.rerender(<VariantDecisionSheet
            identity={{ userId: testUuid(91), storeId: testUuid(8) }} detail={detail}
            refetchCandidate={mockRefetchCandidate} onClose={mockClose}
        />);
        resolveLate({ authenticatedUserId: testUuid(90) });
        await Promise.resolve();
        expect(mockRefetchCandidate).not.toHaveBeenCalled();
    });
});
