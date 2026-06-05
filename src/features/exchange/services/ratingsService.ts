import { supabase } from '@/lib/supabase';

export interface TransactionRating {
    id: string;
    transaction_id: string;
    from_user_id: string;
    to_user_id: string;
    rating: number;
    tags: string[] | null;
    review: string | null;
    created_at: string;
}

export interface SubmitTransactionRatingInput {
    transactionId: string;
    fromUserId: string;
    toUserId: string;
    rating: number;
    tags?: string[];
    review?: string;
}

export const ratingsService = {
    async getMyRatingForTransaction(
        transactionId: string,
        fromUserId: string
    ): Promise<TransactionRating | null> {
        const { data, error } = await supabase
            .from('transaction_ratings')
            .select('*')
            .eq('transaction_id', transactionId)
            .eq('from_user_id', fromUserId)
            .maybeSingle();

        if (error) throw error;
        return data as TransactionRating | null;
    },

    async submitRating(input: SubmitTransactionRatingInput): Promise<TransactionRating> {
        const review = input.review?.trim() || null;
        const { data, error } = await supabase.rpc('submit_transaction_rating', {
            p_transaction_id: input.transactionId,
            p_rating: input.rating,
            p_tags: input.tags ?? [],
            p_review: review,
        });

        if (error) throw error;
        return data as TransactionRating;
    },
};
