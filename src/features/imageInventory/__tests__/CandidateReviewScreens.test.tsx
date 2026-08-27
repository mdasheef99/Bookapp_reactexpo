import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, FlatList } from 'react-native';
import { OwnerUxClientError } from '../api/ownerUxService';
import type {
    OwnerCandidateDetail,
    OwnerSessionSummary,
} from '../contracts/ownerUxContracts';
import {
    InventoryReviewsScreen,
} from '../screens/CandidateReviewScreens';
import { InventoryCandidateReviewScreen } from '../screens/CandidateReviewRouteScreen';
import {
    candidateDetailFixture,
    sessionSummaryFixture,
    testUuid,
} from '../testing/ownerUxTestFixtures';

const mockPush = jest.fn();
type RefetchResult<T> = {
    data: T | undefined;
    isError: boolean;
    error: Error | null;
};
type BeforeRemoveEvent = {
    preventDefault: () => void;
    data: { action: object };
};
type BeforeRemoveListener = (event: BeforeRemoveEvent) => void;
const mockCandidateRefetch = jest.fn<Promise<RefetchResult<OwnerCandidateDetail>>, []>();
const mockSessionRefetch = jest.fn<Promise<RefetchResult<OwnerSessionSummary>>, []>();
const mockMutateAsync = jest.fn();
const mockCommitMutateAsync = jest.fn();
const mockAddListener = jest.fn<
    () => void,
    ['beforeRemove', BeforeRemoveListener]
>(() => jest.fn());
let mockOffline = false;
let mockMutationPending = false;
let mockIdentity = { userId: 'owner-1', storeId: 'store-1' };
let mockCandidateData = candidateDetailFixture();
const mockSessionData = sessionSummaryFixture();
type MockSessionV3 = Omit<typeof mockSessionData, 'defaults'> & {
    defaults: Omit<typeof mockSessionData.defaults, 'condition'> & {
        condition: typeof mockSessionData.defaults.condition | null;
    };
};
let mockSessionV3Data: MockSessionV3 = {
    ...mockSessionData,
    defaults: { ...mockSessionData.defaults },
};
let mockCandidatesState: Record<string, unknown>;
let mockCandidateState: Record<string, unknown>;

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    useNavigation: () => ({ addListener: mockAddListener }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        textPrimary: '#111',
        textSecondary: '#333',
        textTertiary: '#666',
        bgCard: '#fff',
        bgSecondary: '#eee',
        border: '#ccc',
        accent: '#06f',
        error: '#900',
        success: '#070',
    } }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOffline: mockOffline }),
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
jest.mock('../queries/ownerUxQueries', () => ({
    useOwnerInventoryCandidates: () => mockCandidatesState,
    useOwnerInventoryCandidate: () => mockCandidateState,
    // The legacy v2 sibling deliberately fails for a valid nullable 6G
    // session. Candidate-detail v2 remains independently successful.
    useOwnerInventorySession: () => ({
        data: undefined,
        isLoading: false,
        error: new Error('legacy nullable session contract rejected'),
        refetch: mockSessionRefetch,
        isFetchedAfterMount: true,
    }),
}));
jest.mock('../queries/ownerBatchReviewQueries', () => ({
    useOwnerSessionV3: () => ({
        data: mockSessionV3Data,
        isLoading: false,
        error: null,
        refetch: mockSessionRefetch,
        isFetchedAfterMount: true,
    }),
}));
jest.mock('../queries/ownerUxReviewQueries', () => ({
    useUpdateOwnerCandidateReview: () => ({
        mutateAsync: mockMutateAsync,
        isPending: mockMutationPending,
    }),
    useAddOwnerCandidateToInventory: () => ({
        mutateAsync: mockCommitMutateAsync,
        isPending: false,
    }),
}));
jest.mock('../queries/ownerCorrectionQueries', () => ({
    useCorrectionQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
    useMarkCandidateFalse: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useOwnerCandidateVariants: () => ({ data: [], isLoading: false, error: null, refetch: jest.fn() }),
    useDecideOwnerVariant: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useReplaceOwnerVariant: () => ({ mutateAsync: jest.fn(), isPending: false }),
    synchronizeCorrectionCandidate: jest.fn().mockResolvedValue(true),
}));

const summary = (digit: number, title = 'Repeated Book') => ({
    sessionId: testUuid(1),
    sessionStartedAt: '2026-07-31T00:00:00.000Z',
    sessionExpiresAt: '2026-08-30T00:00:00.000Z',
    sessionStatus: 'active',
    candidateId: testUuid(digit),
    inputId: testUuid(3),
    ordinal: digit,
    title,
    authors: ['Original Author'],
    language: 'en',
    candidateState: 'needs_review',
    candidateVersion: 1,
    metadataState: 'manual',
    reviewDisposition: null,
    attentionCodes: ['metadata_manual_required'],
    reviewReady: false,
    updatedAt: '2026-07-31T00:00:00.000Z',
});

describe('Phase 9 Unit 6D candidate list and strict review screens', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockOffline = false;
        mockMutationPending = false;
        mockIdentity = { userId: 'owner-1', storeId: 'store-1' };
        mockCandidateData = candidateDetailFixture();
        mockSessionV3Data = {
            ...mockSessionData,
            defaults: { ...mockSessionData.defaults },
        };
        mockCandidatesState = {
            data: {
                items: [summary(2), summary(4)],
                pageInfo: { nextCursor: null, hasMore: false },
                scopeVersion: 1,
                sessionVersion: null,
            },
            isLoading: false,
            error: null,
            refetch: mockCandidateRefetch,
            isFetchedAfterMount: true,
        };
        mockCandidateState = {
            data: mockCandidateData,
            isLoading: false,
            error: null,
            refetch: mockCandidateRefetch,
            isFetchedAfterMount: true,
        };
        mockCandidateRefetch.mockResolvedValue({
            data: mockCandidateData,
            isError: false,
            error: null,
        });
        mockSessionRefetch.mockResolvedValue({
            data: mockSessionData,
            isError: false,
            error: null,
        });
        mockMutateAsync.mockResolvedValue(candidateDetailFixture({
            candidateState: 'ready',
            candidateVersion: 5,
        }));
        mockCommitMutateAsync.mockResolvedValue({
            sessionId: testUuid(1), candidateId: testUuid(2), candidateVersion: 5,
            inventoryId: testUuid(8), inventoryVersion: 1, outcome: 'committed_private',
        });
    });

    it('loads full correction from candidate detail v2 plus nullable session/default authority v3', () => {
        mockCandidateData = candidateDetailFixture({ ordinal: 2 });
        mockCandidateState = { ...mockCandidateState, data: mockCandidateData };
        mockSessionV3Data = {
            ...mockSessionV3Data,
            defaults: { ...mockSessionV3Data.defaults, condition: null },
        };
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        expect(screen.getByText('Book 2 · Review')).toBeTruthy();
        expect(screen.getByText('Save review')).toBeTruthy();
        expect(screen.queryByText('Candidate details could not be loaded.')).toBeNull();
    });

    afterEach(() => {
        act(() => jest.runOnlyPendingTimers());
        jest.useRealTimers();
    });

    it('renders repeated candidates as separate ordered cards and guards navigation', () => {
        const screen = render(<InventoryReviewsScreen />);
        expect(screen.getAllByText('Repeated Book')).toHaveLength(2);
        expect(screen.getByText('Book 2')).toBeTruthy();
        expect(screen.getByText('Book 4')).toBeTruthy();
        fireEvent.press(screen.getByTestId(`candidate-card-${testUuid(4)}`));
        expect(mockPush).toHaveBeenCalledWith(
            `/(store-owner)/inventory/scan/${testUuid(1)}/candidate/${testUuid(4)}`,
        );
    });

    it('removes legacy duplicate choices and exposes the explicit create-only action', () => {
        mockCandidateData = candidateDetailFixture({
            candidateState: 'ready',
            allowedActions: ['save_review', 'add_to_inventory'],
            duplicateAdvice: {
                state: 'compatible_match', version: 3, targetInventoryId: testUuid(8),
                matchReason: 'exact_validated_edition', compatibility: null, display: null,
                allowedIntents: ['increment_quantity', 'create_separate'],
            },
        });
        mockCandidateState = { ...mockCandidateState, data: mockCandidateData };
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        expect(screen.queryByText('Possible existing item')).toBeNull();
        expect(screen.getByText('Add to inventory')).toBeTruthy();
    });

    it('renders authoritative empty and retry states without private detail', () => {
        mockCandidatesState = {
            ...mockCandidatesState,
            data: { ...(mockCandidatesState.data as object), items: [] },
        };
        const empty = render(<InventoryReviewsScreen />);
        expect(empty.getByText('Nothing to review')).toBeTruthy();
        empty.unmount();

        mockCandidatesState = {
            data: undefined,
            isLoading: false,
            error: new Error('raw sql'),
            refetch: mockCandidateRefetch,
        };
        const failed = render(<InventoryReviewsScreen />);
        expect(failed.getByText('Books could not be loaded.')).toBeTruthy();
        expect(failed.queryByText('raw sql')).toBeNull();
        fireEvent.press(failed.getByText('Retry'));
        expect(mockCandidateRefetch).toHaveBeenCalled();
    });

    it('offers a safe retry for a candidate-detail failure and keeps committed candidates read-only', () => {
        mockCandidateState = {
            data: undefined,
            isLoading: false,
            error: new Error('private transport detail'),
            refetch: mockCandidateRefetch,
        };
        const failed = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        expect(failed.getByText('Candidate details could not be loaded.')).toBeTruthy();
        expect(failed.queryByText('private transport detail')).toBeNull();
        fireEvent.press(failed.getByText('Retry'));
        expect(mockCandidateRefetch).toHaveBeenCalled();
        failed.unmount();

        mockCandidateData = candidateDetailFixture({
            candidateState: 'committed',
            allowedActions: [],
        });
        mockCandidateState = {
            data: mockCandidateData,
            isLoading: false,
            error: null,
            refetch: mockCandidateRefetch,
        };
        const readOnly = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        expect(readOnly.getByText('This candidate is read-only.')).toBeTruthy();
        expect(readOnly.getByText('Save review')).toBeDisabled();
        expect(readOnly.getByTestId('confirm-title')).toBeDisabled();
    });

    it('renders fifteen ordered candidates and a partial failed candidate independently', () => {
        const items = Array.from({ length: 15 }, (_, index) => ({
            ...summary(index + 1, `Book ${index + 1} title`),
            candidateId: testUuid(index + 20),
            candidateState: index === 7 ? 'failed' : 'needs_review',
        }));
        mockCandidatesState = {
            data: {
                items,
                pageInfo: { nextCursor: null, hasMore: false },
                scopeVersion: 1,
                sessionVersion: null,
            },
            isLoading: false,
            error: null,
            refetch: mockCandidateRefetch,
        };
        const screen = render(<InventoryReviewsScreen />);
        expect(screen.getByText('Book 1 title')).toBeTruthy();
        const data = screen.UNSAFE_getByType(FlatList).props.data;
        expect(data).toHaveLength(15);
        expect(data[7]).toMatchObject({ ordinal: 8, candidateState: 'failed' });
        screen.unmount();
    });

    it('detects a repeated opaque cursor instead of requesting it twice', () => {
        mockCandidatesState = {
            ...(mockCandidatesState as object),
            data: {
                ...(mockCandidatesState.data as object),
                pageInfo: { nextCursor: 'opaque-repeat', hasMore: true },
            },
        };
        const screen = render(<InventoryReviewsScreen />);
        fireEvent.press(screen.getByText('Next page'));
        fireEvent.press(screen.getByText('Next page'));
        expect(screen.getByText('The next page changed. Retry from the first page.')).toBeTruthy();
        fireEvent.press(screen.getByText('Restart review list'));
        expect(screen.queryByText('The next page changed. Retry from the first page.')).toBeNull();
    });

    it('shows original-language fields, exact validation, and one canonical save command', async () => {
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        expect(screen.getByDisplayValue('ಕನ್ನಡ ಪುಸ್ತಕ')).toBeTruthy();
        expect(screen.getByDisplayValue('ಲೇಖಕ ಒಬ್ಬರು')).toBeTruthy();
        expect(screen.getByText('Manual book details')).toBeTruthy();
        expect(screen.getByText('Save review')).toBeDisabled();

        fireEvent.changeText(screen.getByTestId('review-price-minor'), '12500');
        fireEvent.press(screen.getByTestId('confirm-title'));
        fireEvent.press(screen.getByTestId('confirm-author-0'));
        await waitFor(() => expect(screen.getByText('Save review')).not.toBeDisabled());
        fireEvent.press(screen.getByText('Save review'));
        fireEvent.press(screen.getByText('Save review'));

        await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
        expect(mockMutateAsync.mock.calls[0][0]).toMatchObject({
            sessionId: testUuid(1),
            candidateId: testUuid(2),
            expectedCandidateVersion: 4,
            expectedMetadataRevision: 7,
            review: {
                originalTitle: 'ಕನ್ನಡ ಪುಸ್ತಕ',
                authors: ['ಲೇಖಕ ಒಬ್ಬರು'],
                priceMinor: 12500,
            },
        });
    });

    it('preserves the draft on stale conflict and requires explicit latest/reapply choice', async () => {
        mockMutateAsync.mockRejectedValueOnce(new OwnerUxClientError(
            'P9_CANDIDATE_VERSION_CONFLICT',
            true,
            'The candidate changed. Refresh and try again.',
        ));
        mockCandidateRefetch.mockResolvedValueOnce({
            data: candidateDetailFixture({ candidateVersion: 5 }),
            isError: false,
            error: null,
        });
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        fireEvent.changeText(screen.getByTestId('review-price-minor'), '12500');
        fireEvent.press(screen.getByTestId('confirm-title'));
        fireEvent.press(screen.getByTestId('confirm-author-0'));
        fireEvent.press(screen.getByText('Save review'));

        await waitFor(() => expect(screen.getByText('Review changed on the server')).toBeTruthy());
        expect(screen.getByDisplayValue('12500')).toBeTruthy();
        expect(screen.getByText('Use latest')).toBeTruthy();
        expect(screen.getByText('Reapply my edits')).toBeTruthy();
        expect(mockCandidateRefetch).toHaveBeenCalled();
    });

    it.each([
        [
            'isError',
            {
                data: candidateDetailFixture({ candidateVersion: 5 }),
                isError: true,
                error: null,
            },
        ],
        [
            'error object',
            {
                data: candidateDetailFixture({ candidateVersion: 5 }),
                isError: false,
                error: new Error('private refetch failure'),
            },
        ],
    ])('fails closed when stale conflict refetch retains cached data with %s', async (
        _label,
        retainedFailure,
    ) => {
        mockMutateAsync.mockRejectedValueOnce(new OwnerUxClientError(
            'P9_CANDIDATE_VERSION_CONFLICT',
            true,
            'The candidate changed. Refresh and try again.',
        ));
        mockCandidateRefetch.mockResolvedValueOnce(retainedFailure);
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        fireEvent.changeText(screen.getByTestId('review-price-minor'), '12500');
        fireEvent.press(screen.getByTestId('confirm-title'));
        fireEvent.press(screen.getByTestId('confirm-author-0'));
        fireEvent.press(screen.getByText('Save review'));

        await waitFor(() => expect(screen.getByText('Retry latest details')).toBeTruthy());
        expect(screen.getByText('Save review')).toBeDisabled();
        expect(screen.getByDisplayValue('12500')).toBeTruthy();
        expect(screen.queryByText('Use latest')).toBeNull();
        expect(screen.queryByText('private refetch failure')).toBeNull();
    });

    it('ignores a late conflict refetch after the candidate route changes', async () => {
        let resolveLate: (result: RefetchResult<OwnerCandidateDetail>) => void = () => {
            throw new Error('late refetch resolver was not installed');
        };
        mockCandidateRefetch.mockImplementationOnce(() => new Promise((resolve) => {
            resolveLate = resolve;
        }));
        mockMutateAsync.mockRejectedValueOnce(new OwnerUxClientError(
            'P9_CANDIDATE_VERSION_CONFLICT',
            true,
            'The candidate changed. Refresh and try again.',
        ));
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        fireEvent.changeText(screen.getByTestId('review-price-minor'), '12500');
        fireEvent.press(screen.getByTestId('confirm-title'));
        fireEvent.press(screen.getByTestId('confirm-author-0'));
        fireEvent.press(screen.getByText('Save review'));
        await waitFor(() => expect(mockCandidateRefetch).toHaveBeenCalled());

        mockCandidateData = candidateDetailFixture({
            candidateId: testUuid(3),
            ordinal: 3,
        });
        mockCandidateState = {
            data: mockCandidateData,
            isLoading: false,
            error: null,
            refetch: mockCandidateRefetch,
        };
        screen.rerender(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(3)} />,
        );
        await act(async () => {
            resolveLate({
                data: candidateDetailFixture({ candidateVersion: 5 }),
                isError: false,
                error: null,
            });
        });

        expect(screen.getByText('Book 3 · Review')).toBeTruthy();
        expect(screen.queryByText('Use latest')).toBeNull();
    });

    it('ignores a late failed conflict refetch after the Owner identity changes', async () => {
        let resolveLate: (result: RefetchResult<OwnerCandidateDetail>) => void = () => {
            throw new Error('late refetch resolver was not installed');
        };
        mockCandidateRefetch.mockImplementationOnce(() => new Promise((resolve) => {
            resolveLate = resolve;
        }));
        mockMutateAsync.mockRejectedValueOnce(new OwnerUxClientError(
            'P9_CANDIDATE_VERSION_CONFLICT',
            true,
            'The candidate changed. Refresh and try again.',
        ));
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        fireEvent.changeText(screen.getByTestId('review-price-minor'), '12500');
        fireEvent.press(screen.getByTestId('confirm-title'));
        fireEvent.press(screen.getByTestId('confirm-author-0'));
        fireEvent.press(screen.getByText('Save review'));
        await waitFor(() => expect(mockCandidateRefetch).toHaveBeenCalled());

        mockIdentity = { userId: 'owner-2', storeId: 'store-2' };
        screen.rerender(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        await act(async () => {
            resolveLate({
                data: candidateDetailFixture({ candidateVersion: 5 }),
                isError: true,
                error: new Error('late private failure'),
            });
        });

        expect(screen.queryByText('Retry latest details')).toBeNull();
        expect(screen.queryByText('Use latest')).toBeNull();
        expect(screen.queryByText('late private failure')).toBeNull();
    });

    it('retries an ambiguous response with the exact same command and key', async () => {
        mockMutateAsync
            .mockRejectedValueOnce(new OwnerUxClientError(
                'P9_INTERNAL_ERROR',
                true,
                'The request could not be completed.',
            ))
            .mockResolvedValueOnce(candidateDetailFixture({
                candidateState: 'ready',
                candidateVersion: 5,
            }));
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        fireEvent.changeText(screen.getByTestId('review-price-minor'), '12500');
        fireEvent.press(screen.getByTestId('confirm-title'));
        fireEvent.press(screen.getByTestId('confirm-author-0'));
        fireEvent.press(screen.getByText('Save review'));
        await waitFor(() => expect(screen.getByText('Retry same save')).toBeTruthy());
        const original = mockMutateAsync.mock.calls[0][0];

        fireEvent.press(screen.getByText('Retry same save'));
        await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
        expect(mockMutateAsync.mock.calls[1][0]).toBe(original);
    });

    it('makes the form read-only offline and installs a dirty navigation guard', () => {
        mockOffline = true;
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        expect(screen.getByText('May be out of date')).toBeTruthy();
        expect(screen.getByText('Save review')).toBeDisabled();
        expect(screen.getByTestId('review-price-minor')).toBeDisabled();
        expect(screen.getByTestId('confirm-title')).toBeDisabled();
    });

    it('uses exactly one coalesced candidate/session refresh path on reconnect', async () => {
        let resolveCandidate!: (result: RefetchResult<OwnerCandidateDetail>) => void;
        let resolveSession!: (result: RefetchResult<OwnerSessionSummary>) => void;
        mockCandidateRefetch.mockImplementationOnce(() => new Promise((resolve) => {
            resolveCandidate = resolve;
        }));
        mockSessionRefetch.mockImplementationOnce(() => new Promise((resolve) => {
            resolveSession = resolve;
        }));
        mockOffline = true;
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        expect(screen.getByText('Save review')).toBeDisabled();
        mockOffline = false;
        await act(async () => {
            screen.rerender(
                <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
            );
            await Promise.resolve();
        });
        await waitFor(() => expect(mockCandidateRefetch).toHaveBeenCalledTimes(1));
        expect(mockSessionRefetch).toHaveBeenCalledTimes(1);
        await act(async () => {
            resolveCandidate({ data: mockCandidateData, isError: false, error: null });
            resolveSession({ data: mockSessionData, isError: false, error: null });
            await Promise.resolve();
        });
        await waitFor(() => expect(screen.getByLabelText('Mark false')).not.toBeDisabled());
    });

    it('blocks navigation while a dirty save is in flight', () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
        const screen = render(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        fireEvent.changeText(screen.getByTestId('review-price-minor'), '100');
        expect(mockAddListener).toHaveBeenCalledWith('beforeRemove', expect.any(Function));
        mockMutationPending = true;
        screen.rerender(
            <InventoryCandidateReviewScreen sessionId={testUuid(1)} candidateId={testUuid(2)} />,
        );
        const listener = mockAddListener.mock.calls.at(-1)?.[1];
        expect(listener).toBeDefined();
        if (!listener) throw new Error('beforeRemove listener was not installed');
        const event: BeforeRemoveEvent = { preventDefault: jest.fn(), data: { action: {} } };
        listener(event);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith(
            'Save in progress',
            expect.any(String),
            [{ text: 'Stay', style: 'cancel' }],
        );
    });
});
