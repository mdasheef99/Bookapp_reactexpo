import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BatchInventoryCommitControls } from '../components/BatchInventoryCommitControls';
import type { CandidateCommitDraft } from '../commit/inventoryCommitCoordinator';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import { testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb', bgCard: '#fff', border: '#ddd', error: '#b91c1c',
        textPrimary: '#111', textSecondary: '#555', disabled: '#999', disabledLight: '#ddd',
    } }),
}));
jest.mock('expo-linear-gradient', () => ({
    LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const review: OwnerCandidateReview = {
    originalTitle: 'Book', authors: ['Author'], originalLanguage: 'en', script: 'Latn',
    metadataChoice: { mode: 'manual', selectionId: null }, quantity: 1, priceMinor: 100,
    baseCondition: 'good', damageDisclosure: {
        hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
        completeReadableSafe: true,
    }, shelfLocation: 'A1', notes: { publicNote: null, internalNote: null },
    publicationIntent: 'private', duplicateIntent: null,
    originalFieldConfirmation: { title: true, authors: [true] },
    candidateDisposition: 'reviewed',
};

function candidate(index: number): CandidateCommitDraft {
    return {
        card: {
            sessionId: testUuid(1), candidateId: testUuid(index + 10), inputId: testUuid(2),
            ordinal: index, candidateState: 'ready', candidateVersion: 4,
            metadataState: 'manual', metadataRevision: 7, reviewVersion: 2,
            reviewDisposition: 'reviewed', observed: {
                title: `Book ${index}`, authors: ['Author'], language: 'en', script: 'Latn',
            }, metadataSummary: null, review, fieldSources: {
                cover: 'missing', title: 'custom', authors: 'custom', language: 'custom',
                condition: 'custom', price: 'custom', quantity: 'default', location: 'custom',
                publication: 'default', damage: 'default',
            }, attentionCodes: [], blockers: [], reviewReady: true,
            allowedActions: ['save_review', 'add_to_inventory'],
            updatedAt: '2026-08-25T00:00:00.000Z',
        },
        edits: {},
    };
}

describe('Phase 9 NEW 6G-D Add-all controls', () => {
    it('confirms and submits the exact three-candidate set even if a fourth later arrives', async () => {
        const initial = [candidate(1), candidate(2), candidate(3)];
        const onAddAll = jest.fn(async (values: readonly CandidateCommitDraft[]) => ({
            command: {
                commandId: testUuid(40), exactN: values.length,
                candidateIds: values.map((value) => value.card.candidateId),
                commands: [], outcomes: new Map(),
            },
            result: {
                exactN: values.length, candidateIds: values.map((value) => value.card.candidateId),
                outcomes: [], succeeded: values.length, failedRetryable: 0,
                noLongerEligible: 0, stillPending: 0, busy: 0,
            },
        }));
        const props = {
            disabled: false, pending: false, result: null,
            onAddAll, onRetry: jest.fn(),
        };
        const screen = render(<BatchInventoryCommitControls candidates={initial} {...props} />);
        fireEvent.press(screen.getByText('Add all ready books (3)'));
        expect(screen.getByText('Add exactly 3 books?')).toBeTruthy();
        await act(async () => {
            fireEvent.press(screen.getByText('Add all 3'));
            await Promise.resolve();
        });
        screen.rerender(
            <BatchInventoryCommitControls candidates={[...initial, candidate(4)]} {...props} />,
        );
        await waitFor(() => expect(onAddAll).toHaveBeenCalledTimes(1));
        expect(onAddAll.mock.calls[0][0].map((value) => value.card.candidateId))
            .toEqual(initial.map((value) => value.card.candidateId));
    });

    it('announces mixed outcomes explicitly and never claims publication', () => {
        const screen = render(
            <BatchInventoryCommitControls
                candidates={[]}
                disabled={false}
                pending={false}
                result={{
                    exactN: 3, candidateIds: [testUuid(11), testUuid(12), testUuid(13)],
                    outcomes: [], succeeded: 1, failedRetryable: 1,
                    noLongerEligible: 1, stillPending: 0, busy: 0,
                }}
                onAddAll={jest.fn()}
                onRetry={jest.fn()}
            />,
        );
        expect(screen.getByTestId('add-all-result').props.children).toBe(
            'Added 1 · Retryable 1 · No longer eligible 1 · Still pending 0 · Busy 0',
        );
        expect(screen.queryByText(/published successfully/iu)).toBeNull();
    });
});
