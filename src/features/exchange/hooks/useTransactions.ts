import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
    transactionsService,
    type FileDisputeParams,
    type RequestTransactionParams,
    type TransactionStatus,
} from '../services/transactionsService';
import { listingKeys } from './useListings';

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const transactionKeys = {
    all: ['transactions'] as const,
    incoming: (lenderId: string) =>
        [...transactionKeys.all, 'incoming', lenderId] as const,
    outgoing: (borrowerId: string) =>
        [...transactionKeys.all, 'outgoing', borrowerId] as const,
    myList: (userId: string) =>
        [...transactionKeys.all, 'myList', userId] as const,
    detail: (transactionId: string) =>
        [...transactionKeys.all, 'detail', transactionId] as const,
};

function invalidateCreditQueries(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: ['creditBalance'] });
    queryClient.invalidateQueries({ queryKey: ['creditHistory'] });
}

function invalidateListingAndCreditQueries(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: listingKeys.all });
    invalidateCreditQueries(queryClient);
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Get incoming exchange requests for the current user (as lender).
 */
export function useIncomingRequests(lenderId: string | null) {
    return useQuery({
        queryKey: transactionKeys.incoming(lenderId ?? ''),
        queryFn: () => transactionsService.getIncomingRequests(lenderId!),
        enabled: !!lenderId,
    });
}

/**
 * Get all transactions where the user is lender or borrower.
 */
export function useMyTransactions(userId: string | null) {
    return useQuery({
        queryKey: transactionKeys.outgoing(userId ?? ''),
        queryFn: () => transactionsService.getMyTransactions(userId!),
        enabled: !!userId,
    });
}

/**
 * Get all user transactions with listing+book data for the list screen.
 * LEAN: 1-level join — listing + book only, no profiles.
 */
export function useMyTransactionsWithListings(userId: string | null) {
    return useQuery({
        queryKey: transactionKeys.myList(userId ?? ''),
        queryFn: () => transactionsService.getMyTransactionsWithListings(userId!),
        enabled: !!userId,
    });
}

/**
 * Get full details for a single transaction (listing + book + both profiles).
 */
export function useTransactionDetails(transactionId: string | null) {
    return useQuery({
        queryKey: transactionKeys.detail(transactionId ?? ''),
        queryFn: () => transactionsService.getTransactionDetails(transactionId!),
        enabled: !!transactionId,
    });
}

/**
 * Mutation hook to request a book exchange.
 * Calls the atomic `request_transaction` RPC:
 * validates listing → creates transaction → holds 1 credit → reserves listing.
 * On success, invalidates all transaction queries.
 */
export function useRequestTransaction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: RequestTransactionParams) =>
            transactionsService.requestTransaction(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: transactionKeys.all });
            invalidateListingAndCreditQueries(queryClient);
        },
    });
}

/**
 * Lender approves a REQUESTED transaction → status becomes APPROVED.
 */
export function useApproveTransaction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ transactionId, actorId }: { transactionId: string; actorId: string }) =>
            transactionsService.approveTransaction(transactionId, actorId),
        onSuccess: (_data, { transactionId }) => {
            queryClient.invalidateQueries({ queryKey: transactionKeys.all });
            queryClient.invalidateQueries({ queryKey: transactionKeys.detail(transactionId) });
        },
    });
}

/**
 * Lender declines a REQUESTED transaction → hold released, status DECLINED.
 */
export function useDeclineTransaction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ transactionId, actorId }: { transactionId: string; actorId: string }) =>
            transactionsService.declineTransaction(transactionId, actorId),
        onSuccess: (_data, { transactionId }) => {
            queryClient.invalidateQueries({ queryKey: transactionKeys.all });
            queryClient.invalidateQueries({ queryKey: transactionKeys.detail(transactionId) });
            invalidateListingAndCreditQueries(queryClient);
        },
    });
}

/**
 * Cancel a transaction (borrower or lender).
 * Releases the credit hold back to borrower's available balance.
 */
export function useCancelTransaction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ transactionId, actorId }: { transactionId: string; actorId: string }) =>
            transactionsService.cancelTransaction(transactionId, actorId),
        onSuccess: (_data, { transactionId }) => {
            queryClient.invalidateQueries({ queryKey: transactionKeys.all });
            queryClient.invalidateQueries({ queryKey: transactionKeys.detail(transactionId) });
            invalidateListingAndCreditQueries(queryClient);
        },
    });
}

/**
 * Complete a transaction after delivery confirmation.
 * Releases held credit (consumed), awards lender 1 credit.
 */
export function useCompleteTransaction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ transactionId, actorId }: { transactionId: string; actorId: string }) =>
            transactionsService.completeTransaction(transactionId, actorId),
        onSuccess: (_data, { transactionId }) => {
            queryClient.invalidateQueries({ queryKey: transactionKeys.all });
            queryClient.invalidateQueries({ queryKey: transactionKeys.detail(transactionId) });
            invalidateListingAndCreditQueries(queryClient);
        },
    });
}

/**
 * Transition transaction to a specific status:
 * payment_pending → ready_to_ship → shipped → delivered
 */
export function useTransitionStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            transactionId,
            newStatus,
            actorId,
        }: {
            transactionId: string;
            newStatus: TransactionStatus;
            actorId: string;
        }) => transactionsService.transitionStatus(transactionId, newStatus, actorId),
        onSuccess: (_data, { transactionId }) => {
            queryClient.invalidateQueries({ queryKey: transactionKeys.all });
            queryClient.invalidateQueries({ queryKey: transactionKeys.detail(transactionId) });
        },
    });
}

/**
 * File a dispute for a delivered transaction.
 */
export function useFileDispute() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: FileDisputeParams) => transactionsService.fileDispute(params),
        onSuccess: (_data, { transactionId }) => {
            queryClient.invalidateQueries({ queryKey: transactionKeys.all });
            queryClient.invalidateQueries({ queryKey: transactionKeys.detail(transactionId) });
        },
    });
}

