import {
    resolveTransactionActions,
    type TransactionActionResolution,
    type TransactionActorRole,
} from '../transactionActionResolver';

function resolve(status: Parameters<typeof resolveTransactionActions>[0]['status'], role: TransactionActorRole, deliveryType = 'meetup') {
    return resolveTransactionActions({
        status,
        role,
        deliveryType,
    });
}

describe('resolveTransactionActions', () => {
    it('returns approve and decline actions for a lender reviewing a request', () => {
        const result = expectActions(resolve('requested', 'lender'));

        expect(result.actions).toEqual([
            { key: 'decline', label: 'Decline', tone: 'danger', variant: 'outline' },
            { key: 'approve', label: 'Approve', tone: 'success', variant: 'solid' },
        ]);
    });

    it('returns cancel for a borrower with a pending request', () => {
        const result = expectActions(resolve('requested', 'borrower'));

        expect(result.actions).toEqual([
            { key: 'cancel', label: 'Cancel Request', tone: 'danger', variant: 'solid' },
        ]);
    });

    it('allows borrowers to confirm approved meetup exchanges', () => {
        const result = expectActions(resolve('approved', 'borrower', 'meetup'));

        expect(result.actions).toEqual([
            {
                key: 'transition',
                label: 'Confirm Meetup',
                tone: 'accent',
                variant: 'solid',
                nextStatus: 'delivered',
            },
        ]);
    });

    it('guards approved non-meetup exchanges while shipping is disabled', () => {
        const result = resolve('approved', 'borrower', 'porter');

        expect(result).toEqual({
            kind: 'message',
            message: "Meetup-only exchange: this request can't move into payment or delivery steps in-app yet.",
            tone: 'neutral',
        });
    });

    it('returns completion and terminal messages for final statuses', () => {
        expect(resolve('delivered', 'borrower')).toEqual({
            kind: 'actions',
            actions: [
                { key: 'complete', label: 'Complete Exchange', tone: 'success', variant: 'solid' },
                { key: 'dispute', label: 'File Dispute', tone: 'danger', variant: 'outline' },
            ],
        });

        expect(resolve('disputed', 'lender')).toEqual({
            kind: 'actions',
            actions: [
                { key: 'complete', label: 'Resolve & Complete', tone: 'success', variant: 'solid' },
            ],
        });

        expect(resolve('completed', 'lender')).toEqual({
            kind: 'message',
            message: 'Exchange successfully completed!',
            tone: 'success',
        });

        expect(resolve('declined', 'borrower')).toEqual({
            kind: 'message',
            message: 'No actions available for this status.',
            tone: 'muted',
        });
    });

    it('does not expose delivered or disputed participant actions to viewers', () => {
        expect(resolve('delivered', 'viewer')).toEqual({
            kind: 'message',
            message: 'No actions available for this status.',
            tone: 'muted',
        });

        expect(resolve('disputed', 'viewer')).toEqual({
            kind: 'message',
            message: 'No actions available for this status.',
            tone: 'muted',
        });
    });
});

function expectActions(result: TransactionActionResolution): Extract<TransactionActionResolution, { kind: 'actions' }> {
    if (result.kind !== 'actions') {
        throw new Error(`Expected actions, got ${result.kind}`);
    }
    return result;
}
