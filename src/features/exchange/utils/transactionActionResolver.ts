import type { TransactionStatus } from '@/features/exchange/services/transactionsService';

export type TransactionActorRole = 'lender' | 'borrower' | 'viewer';
export type TransactionActionTone = 'accent' | 'success' | 'danger';
export type TransactionActionVariant = 'solid' | 'outline';
export type TransactionMessageTone = 'neutral' | 'success' | 'muted';
export type TransactionActionKey = 'approve' | 'decline' | 'cancel' | 'complete' | 'transition' | 'dispute';

export interface TransactionAction {
    key: TransactionActionKey;
    label: string;
    tone: TransactionActionTone;
    variant: TransactionActionVariant;
    nextStatus?: TransactionStatus;
}

export type TransactionActionResolution =
    | { kind: 'actions'; actions: TransactionAction[] }
    | { kind: 'message'; message: string; tone: TransactionMessageTone };

interface ResolveTransactionActionsInput {
    status: TransactionStatus;
    role: TransactionActorRole;
    deliveryType: string;
}

const SHIPPING_DISABLED_STATUSES: TransactionStatus[] = ['payment_pending', 'ready_to_ship', 'shipped'];

export function resolveTransactionActions({
    status,
    role,
    deliveryType,
}: ResolveTransactionActionsInput): TransactionActionResolution {
    const isMeetup = deliveryType === 'meetup';

    if (!isMeetup && SHIPPING_DISABLED_STATUSES.includes(status)) {
        return {
            kind: 'message',
            message: 'Meetup-only exchange: delivery-based progress is not currently supported in-app.',
            tone: 'neutral',
        };
    }

    if (status === 'requested') {
        if (role === 'lender') {
            return {
                kind: 'actions',
                actions: [
                    { key: 'decline', label: 'Decline', tone: 'danger', variant: 'outline' },
                    { key: 'approve', label: 'Approve', tone: 'success', variant: 'solid' },
                ],
            };
        }
        if (role === 'borrower') {
            return {
                kind: 'actions',
                actions: [
                    { key: 'cancel', label: 'Cancel Request', tone: 'danger', variant: 'solid' },
                ],
            };
        }
    }

    if (status === 'approved') {
        if (role === 'borrower') {
            if (!isMeetup) {
                return {
                    kind: 'message',
                    message: "Meetup-only exchange: this request can't move into payment or delivery steps in-app yet.",
                    tone: 'neutral',
                };
            }
            return {
                kind: 'actions',
                actions: [
                    {
                        key: 'transition',
                        label: 'Confirm Meetup',
                        tone: 'accent',
                        variant: 'solid',
                        nextStatus: 'delivered',
                    },
                ],
            };
        }
        if (role === 'lender') {
            return {
                kind: 'actions',
                actions: [
                    { key: 'cancel', label: 'Cancel', tone: 'danger', variant: 'solid' },
                ],
            };
        }
    }

    if (status === 'ready_to_ship' && role === 'lender') {
        return {
            kind: 'actions',
            actions: [
                { key: 'transition', label: 'Mark as Shipped', tone: 'accent', variant: 'solid', nextStatus: 'shipped' },
            ],
        };
    }

    if (status === 'shipped' && role === 'borrower') {
        return {
            kind: 'actions',
            actions: [
                { key: 'transition', label: 'Confirm Delivery', tone: 'accent', variant: 'solid', nextStatus: 'delivered' },
            ],
        };
    }

    if (status === 'delivered' && (role === 'lender' || role === 'borrower')) {
        return {
            kind: 'actions',
            actions: [
                { key: 'complete', label: 'Complete Exchange', tone: 'success', variant: 'solid' },
                { key: 'dispute', label: 'File Dispute', tone: 'danger', variant: 'outline' },
            ],
        };
    }

    if (status === 'disputed' && (role === 'lender' || role === 'borrower')) {
        return {
            kind: 'actions',
            actions: [
                { key: 'complete', label: 'Resolve & Complete', tone: 'success', variant: 'solid' },
            ],
        };
    }

    if (status === 'completed') {
        return {
            kind: 'message',
            message: 'Exchange successfully completed!',
            tone: 'success',
        };
    }

    return {
        kind: 'message',
        message: 'No actions available for this status.',
        tone: 'muted',
    };
}
