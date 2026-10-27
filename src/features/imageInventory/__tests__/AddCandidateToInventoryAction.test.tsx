// Post-scan SDD-1 §6 (4a), D2-5: legacy Add is removed; coordinated Add stays.
import { render, within } from '@testing-library/react-native';
import { AddCandidateToInventoryAction } from '../components/AddCandidateToInventoryAction';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import { testUuid } from '../testing/ownerUxTestFixtures';
const candidateId = testUuid(13);
it('coordinated success shows only Added to Inventory without Store View navigation', () => {
    const card = { sessionId: testUuid(1), candidateId, allowedActions: ['add_to_inventory'] } as OwnerBatchReviewCard;
    const outcome: CandidateCommitOutcome = { candidateId, status: 'succeeded', stage: 'complete', result: {
        sessionId: testUuid(1), candidateId, candidateVersion: 5,
        inventoryId: testUuid(12), inventoryVersion: 1, outcome: 'committed_private',
    } };
    const screen = render(<AddCandidateToInventoryAction card={card} disabled={false} isOffline={false}
        pending={false} outcome={outcome} onAdd={jest.fn()} />);
    const success = within(screen.getByTestId('add-to-inventory-success-' + candidateId));
    expect(success.getByText('Added to Inventory').props.accessibilityLiveRegion).toBe('polite');
    expect(success.queryByText('View in Store View')).toBeNull();
    expect(success.queryAllByRole('button')).toHaveLength(0);
});

it.each(['candidate', 'session', 'outcome candidate'])('does not show a receipt for another %s', kind => {
    const card = { sessionId: testUuid(1), candidateId, allowedActions: [] } as unknown as OwnerBatchReviewCard;
    const outcome: CandidateCommitOutcome = { candidateId: kind === 'outcome candidate' ? testUuid(99) : candidateId,
        status: 'succeeded', stage: 'complete', result: { sessionId: kind === 'session' ? testUuid(99) : card.sessionId,
            candidateId: kind === 'candidate' ? testUuid(99) : candidateId, candidateVersion: 5,
            inventoryId: testUuid(12), inventoryVersion: 1, outcome: 'committed_private' } };
    const screen = render(<AddCandidateToInventoryAction card={card} disabled isOffline={false}
        pending={false} outcome={outcome} onAdd={jest.fn()} />);
    expect(screen.queryByText('Added to Inventory')).toBeNull();
});
