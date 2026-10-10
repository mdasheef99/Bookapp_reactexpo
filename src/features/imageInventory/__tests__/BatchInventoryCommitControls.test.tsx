import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { BatchInventoryCommitControls } from '../components/BatchInventoryCommitControls';
import type {
    CandidateCommitDraft,
    CandidateCommitOutcome,
} from '../commit/inventoryCommitCoordinator';
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
        acceptedAuthorityKey: '4:7:2',
    };
}

describe('Phase 9 NEW 6G-D Add-all controls', () => {
    it('describes the current review count before any bulk result exists', () => {
        const screen = render(
            <BatchInventoryCommitControls candidates={[candidate(1)]} disabled={false}
                pending={false} remainingReviewCount={3} result={null}
                onAddAll={jest.fn()} onRetry={jest.fn()} />,
        );
        expect(screen.getByTestId('remaining-review-count').props.children)
            .toBe('3 books currently in review.');
    });

    it('does not offer Add all for an unaccepted candidate revision', () => {
        const current = candidate(1);
        const stale = { ...current, card: { ...current.card, candidateVersion: 5 } };
        const screen = render(
            <BatchInventoryCommitControls candidates={[stale]} disabled={false}
                pending={false} result={null} onAddAll={jest.fn()} onRetry={jest.fn()} />,
        );
        expect(screen.queryByText('Add all ready books (1)')).toBeNull();
    });

    it('stays in normal layout flow so the review list and footer remain unobscured', () => {
        const screen = render(
            <BatchInventoryCommitControls
                candidates={[candidate(1)]}
                disabled={false}
                pending={false}
                result={null}
                onAddAll={jest.fn()}
                onRetry={jest.fn()}
            />,
        );

        const style = StyleSheet.flatten(screen.getByTestId('add-all-controls').props.style);
        expect(style.position).not.toBe('absolute');
    });

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
                noLongerEligible: 0, needsAttention: 0, stillPending: 0, busy: 0,
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
                remainingReviewCount={3}
                result={{
                    exactN: 3, candidateIds: [testUuid(11), testUuid(12), testUuid(13)],
                    outcomes: [], succeeded: 1, failedRetryable: 1,
                    noLongerEligible: 1, needsAttention: 0, stillPending: 0, busy: 0,
                }}
                onAddAll={jest.fn()}
                onRetry={jest.fn()}
            />,
        );
        expect(screen.getByText('1 book added')).toBeTruthy();
        expect(screen.getByTestId('add-all-result').props.accessibilityLabel).toBe(
            'Bulk add result. 1 book added. Retryable 1. No longer eligible 1. Needs attention 0. Still pending 0. Busy 0. 3 books remain in review.',
        );
        expect(screen.getByTestId('remaining-review-count').props.children)
            .toBe('3 books remain in review.');
        expect(StyleSheet.flatten(screen.getByTestId('add-all-result-counts').props.style).flexWrap)
            .toBe('wrap');
        expect(StyleSheet.flatten(screen.getByTestId('add-all-controls').props.style).padding)
            .toBeLessThanOrEqual(12);
        expect(screen.queryByText(/published successfully/iu)).toBeNull();
    });

    it('keeps local-invalid retry members visible as Needs attention and retryable', () => {
        const onRetry = jest.fn();
        const screen = render(
            <BatchInventoryCommitControls
                candidates={[candidate(1)]}
                disabled={false}
                pending={false}
                result={{
                    exactN: 1, candidateIds: [testUuid(11)], outcomes: [],
                    succeeded: 0, failedRetryable: 0, noLongerEligible: 0,
                    needsAttention: 1, stillPending: 0, busy: 0,
                }}
                onAddAll={jest.fn()}
                onRetry={onRetry}
            />,
        );
        expect(screen.getByTestId('add-all-result').props.accessibilityLabel)
            .toContain('Needs attention 1');
        // A local validation issue remains correctable and does not render the
        // false server-authority statement used for canonical ineligibility.
        expect(screen.queryByText(/This book is no longer eligible/iu)).toBeNull();
    });

    it('excludes authority-blocked and terminal-outcome cards from the Add-all set', () => {
        const blocked = candidate(1);
        const noLongerEligible = candidate(2);
        const ready = candidate(3);
        const outcome: CandidateCommitOutcome = {
            candidateId: noLongerEligible.card.candidateId,
            status: 'no_longer_eligible',
            stage: 'revalidate',
        };
        const screen = render(
            <BatchInventoryCommitControls
                candidates={[blocked, noLongerEligible, ready]}
                blockedCandidateIds={new Set([blocked.card.candidateId])}
                inFlightCandidateIds={new Set()}
                outcomes={new Map([[outcome.candidateId, outcome]])}
                disabled={false}
                pending={false}
                result={null}
                onAddAll={jest.fn()}
                onRetry={jest.fn()}
            />,
        );

        expect(screen.getByText('Add all ready books (1)')).toBeTruthy();
        expect(screen.queryByText('Add all ready books (3)')).toBeNull();
    });

    it('does not keep a no-longer-eligible card in the action count after bulk results', () => {
        const stale = candidate(1);
        const outcome: CandidateCommitOutcome = {
            candidateId: stale.card.candidateId,
            status: 'no_longer_eligible',
            stage: 'revalidate',
        };
        const screen = render(
            <BatchInventoryCommitControls
                candidates={[stale]}
                blockedCandidateIds={new Set()}
                inFlightCandidateIds={new Set()}
                outcomes={new Map([[outcome.candidateId, outcome]])}
                disabled={false}
                pending={false}
                result={{
                    exactN: 1, candidateIds: [stale.card.candidateId], outcomes: [outcome],
                    succeeded: 0, failedRetryable: 0, noLongerEligible: 1,
                    needsAttention: 0, stillPending: 0, busy: 0,
                }}
                onAddAll={jest.fn()}
                onRetry={jest.fn()}
            />,
        );

        expect(screen.queryByRole('button', { name: /Add all ready books/iu })).toBeNull();
        expect(screen.getByTestId('add-all-result')).toBeTruthy();
    });
});
