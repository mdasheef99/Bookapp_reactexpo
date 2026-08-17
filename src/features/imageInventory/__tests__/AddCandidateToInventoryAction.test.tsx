import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AddCandidateToInventoryAction } from '../components/AddCandidateToInventoryAction';
import { useAddOwnerCandidateToInventory } from '../queries/ownerUxReviewQueries';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockMutateAsync = jest.fn();
const mockRefetchCandidate = jest.fn<Promise<unknown>, []>();

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));
jest.mock('../queries/ownerUxReviewQueries', () => ({
    useAddOwnerCandidateToInventory: jest.fn(),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb',
        accentLight: '#60a5fa',
        bgCard: '#ffffff',
        border: '#d1d5db',
        disabled: '#9ca3af',
        disabledLight: '#d1d5db',
        error: '#b91c1c',
        textPrimary: '#111827',
        textSecondary: '#4b5563',
    } }),
}));
jest.mock('expo-linear-gradient', () => ({
    LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const identity = { userId: testUuid(10), storeId: testUuid(11) } as const;
const inventoryId = testUuid(12);

function readyDetail() {
    return candidateDetailFixture({
        candidateState: 'ready',
        allowedActions: ['save_review', 'add_to_inventory'],
        review: {
            value: {
                originalTitle: 'ಕನ್ನಡ ಪುಸ್ತಕ',
                authors: ['ಲೇಖಕ ಒಬ್ಬರು'],
                originalLanguage: 'kn',
                script: 'Knda',
                metadataChoice: { mode: 'manual', selectionId: null },
                quantity: 1,
                priceMinor: 12500,
                baseCondition: 'good',
                damageDisclosure: {
                    hasDamage: false,
                    damageTypes: [],
                    damageNote: null,
                    isSellable: true,
                    completeReadableSafe: true,
                },
                shelfLocation: 'Shelf A1',
                notes: { publicNote: null, internalNote: null },
                publicationIntent: 'private',
                duplicateIntent: null,
                originalFieldConfirmation: { title: true, authors: [true] },
                candidateDisposition: 'reviewed',
            },
            reviewVersion: 3,
        },
    });
}

describe('Unit 7C WU5 post-add handoff', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRefetchCandidate.mockResolvedValue(undefined);
        mockMutateAsync.mockResolvedValue({
            sessionId: testUuid(1),
            candidateId: testUuid(2),
            candidateVersion: 5,
            inventoryId,
            inventoryVersion: 1,
            outcome: 'committed_private',
        });
        (useAddOwnerCandidateToInventory as jest.Mock).mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
        });
    });

    it('shows the canonical success state and routes by returned inventoryId', async () => {
        const screen = render(
            <AddCandidateToInventoryAction
                identity={identity}
                detail={readyDetail()}
                disabled={false}
                hasUnsavedReview={false}
                isOffline={false}
                refetchCandidate={mockRefetchCandidate}
            />,
        );

        fireEvent.press(screen.getByText('Add to inventory'));
        await waitFor(() => expect(screen.getByTestId('add-to-inventory-success')).toBeTruthy());

        expect(screen.getByText('✓ Added to Inventory')).toBeTruthy();
        expect(screen.getByText('Continue Reviewing')).toBeTruthy();
        expect(screen.getByText('View in Store View')).toBeTruthy();
        expect(screen.queryByText('Add to inventory')).toBeNull();

        fireEvent.press(screen.getByTestId('view-in-store-view'));
        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/(store-owner)/store-view/[inventoryId]',
            params: { inventoryId },
        });
        expect(JSON.stringify(mockPush.mock.calls)).not.toContain('listingId');

        fireEvent.press(screen.getByTestId('continue-reviewing'));
        expect(mockReplace).toHaveBeenCalledWith('/(store-owner)/inventory/reviews');
        expect(mockRefetchCandidate).toHaveBeenCalledTimes(1);
    });

    it('does not expose the handoff until the commit resolves', async () => {
        let resolveCommit!: (value: unknown) => void;
        mockMutateAsync.mockReturnValueOnce(new Promise((resolve) => { resolveCommit = resolve; }));
        const screen = render(
            <AddCandidateToInventoryAction
                identity={identity}
                detail={readyDetail()}
                disabled={false}
                hasUnsavedReview={false}
                isOffline={false}
                refetchCandidate={mockRefetchCandidate}
            />,
        );

        fireEvent.press(screen.getByText('Add to inventory'));
        expect(screen.queryByTestId('add-to-inventory-success')).toBeNull();

        resolveCommit({
            sessionId: testUuid(1), candidateId: testUuid(2), candidateVersion: 5,
            inventoryId, inventoryVersion: 1, outcome: 'committed_private',
        });
        await waitFor(() => expect(screen.getByTestId('view-in-store-view')).toBeTruthy());
    });
});
