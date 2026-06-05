jest.mock('@/lib/supabase');

import { supabase } from '@/lib/supabase';
import { ratingsService } from '../ratingsService';

function mockQuery(response: Record<string, unknown>) {
    const builder: any = {};
    ['select', 'insert', 'eq', 'single', 'maybeSingle'].forEach(method => {
        builder[method] = jest.fn(() => builder);
    });
    builder.then = jest.fn((resolve: (value: unknown) => unknown) => resolve(response));
    return builder;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('ratingsService', () => {
    it('fetches the current user rating for a transaction', async () => {
        const rating = { id: 'rating-1', transaction_id: 'txn-1', from_user_id: 'user-1', rating: 5 };
        const builder = mockQuery({ data: rating, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        const result = await ratingsService.getMyRatingForTransaction('txn-1', 'user-1');

        expect(supabase.from).toHaveBeenCalledWith('transaction_ratings');
        expect(builder.select).toHaveBeenCalledWith('*');
        expect(builder.eq).toHaveBeenCalledWith('transaction_id', 'txn-1');
        expect(builder.eq).toHaveBeenCalledWith('from_user_id', 'user-1');
        expect(builder.maybeSingle).toHaveBeenCalled();
        expect(result).toEqual(rating);
    });

    it('submits a transaction rating through the hardening RPC with trimmed review text', async () => {
        const saved = {
            id: 'rating-1',
            transaction_id: 'txn-1',
            from_user_id: 'borrower-1',
            to_user_id: 'lender-1',
            rating: 4,
            tags: ['good_communication'],
            review: 'Great exchange',
        };
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: saved, error: null });

        const result = await ratingsService.submitRating({
            transactionId: 'txn-1',
            fromUserId: 'borrower-1',
            toUserId: 'lender-1',
            rating: 4,
            tags: ['good_communication'],
            review: '  Great exchange  ',
        });

        expect(supabase.rpc).toHaveBeenCalledWith('submit_transaction_rating', {
            p_transaction_id: 'txn-1',
            p_rating: 4,
            p_tags: ['good_communication'],
            p_review: 'Great exchange',
        });
        expect(result).toEqual(saved);
    });
});
