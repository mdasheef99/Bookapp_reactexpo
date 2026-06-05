import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ratingsService,
    type SubmitTransactionRatingInput,
} from '@/features/exchange/services/ratingsService';
import { transactionKeys } from './useTransactions';

export const ratingKeys = {
    all: ['transactionRatings'] as const,
    mine: (transactionId: string, userId: string) =>
        [...ratingKeys.all, 'mine', transactionId, userId] as const,
};

export function useMyTransactionRating(transactionId: string | null, userId: string | null) {
    return useQuery({
        queryKey: ratingKeys.mine(transactionId ?? '', userId ?? ''),
        queryFn: () => ratingsService.getMyRatingForTransaction(transactionId!, userId!),
        enabled: !!transactionId && !!userId,
    });
}

export function useSubmitTransactionRating() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: SubmitTransactionRatingInput) => ratingsService.submitRating(input),
        onSuccess: (_data, input) => {
            queryClient.invalidateQueries({
                queryKey: ratingKeys.mine(input.transactionId, input.fromUserId),
            });
            queryClient.invalidateQueries({
                queryKey: transactionKeys.detail(input.transactionId),
            });
        },
    });
}
