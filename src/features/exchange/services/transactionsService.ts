import { supabase } from '@/lib/supabase';
import { profileService, type UserProfileSummary } from '@/features/auth/services/profileService';
import { captureAppException } from '@/lib/sentry';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionStatus =
    | 'requested'
    | 'approved'
    | 'declined'
    | 'cancelled'
    | 'payment_pending'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | 'completed'
    | 'disputed';

export type DeliveryType = 'porter' | 'dunzo' | 'meetup';

export interface Transaction {
    id: string;
    listing_id: string;
    lender_id: string;
    borrower_id: string;
    status: TransactionStatus;
    delivery_type: DeliveryType;
    shipping_address_id: string | null;
    message: string | null;
    payment_order_id: string | null;
    payment_id: string | null;
    shipping_cost: number | null;
    deposit_amount: number | null;
    awb_number: string | null;
    is_signed_copy: boolean;
    tracking_url: string | null;
    delivery_service: string | null;
    created_at: string;
    updated_at: string;
}

/** Lean type for list views — includes listing+book but NOT profiles. */
export interface TransactionWithListing extends Transaction {
    listing: {
        id: string;
        photos: string[];
        condition: string;
        delivery_options: string[];
        book: {
            id: string;
            title: string;
            authors: string[] | null;
            cover_url: string | null;
        } | null;
    } | null;
}

/** Rich type for detail view — includes listing+book AND both profiles. */
export interface TransactionWithDetails extends Transaction {
    lender: UserProfileSummary | null;
    borrower: UserProfileSummary | null;
    listing: {
        id: string;
        photos: string[];
        condition: string;
        delivery_options: string[];
        book: {
            id: string;
            title: string;
            authors: string[] | null;
            cover_url: string | null;
        } | null;
    } | null;
}

export interface RequestTransactionParams {
    listingId: string;
    borrowerId: string;
    deliveryType: DeliveryType;
    message?: string;
    shippingAddressId?: string;
}

export interface FileDisputeParams {
    transactionId: string;
    actorId: string;
    reason: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

function captureTransactionsServiceError(
    error: unknown,
    action: string,
    rpc: string,
    extra?: Record<string, unknown>,
) {
    captureAppException(error, {
        area: 'exchange',
        action,
        tags: {
            feature: 'exchange',
            service: 'transactionsService',
            rpc,
        },
        extra,
    });
}

export const transactionsService = {
    /**
     * Request a book exchange (atomic DB function).
     * Validates listing is active, borrower has ≥1 credit, places hold, creates transaction.
     */
    async requestTransaction(params: RequestTransactionParams): Promise<Transaction> {
        const { listingId, borrowerId, deliveryType, message, shippingAddressId } = params;

        try {
            const { data, error } = await supabase.rpc('request_transaction', {
                p_listing_id: listingId,
                p_borrower_id: borrowerId,
                p_delivery_type: deliveryType,
                p_message: message ?? null,
                p_shipping_address_id: shippingAddressId ?? null,
            });

            if (error) throw error;
            return data as Transaction;
        } catch (error) {
            captureTransactionsServiceError(error, 'request_transaction_failed', 'request_transaction', {
                listing_id: listingId,
                delivery_type: deliveryType,
                has_message: Boolean(message),
                shipping_details_provided: Boolean(shippingAddressId),
            });
            throw error;
        }
    },

    /**
     * Lender approves a REQUESTED transaction → status becomes APPROVED.
     */
    async approveTransaction(transactionId: string, actorId: string): Promise<Transaction> {
        try {
            const { data, error } = await supabase.rpc('approve_transaction', {
                p_transaction_id: transactionId,
                p_actor_id: actorId,
            });
            if (error) throw error;
            return data as Transaction;
        } catch (error) {
            captureTransactionsServiceError(error, 'approve_transaction_failed', 'approve_transaction', {
                transaction_id: transactionId,
            });
            throw error;
        }
    },

    /**
     * Lender declines a REQUESTED transaction → hold released, status DECLINED.
     */
    async declineTransaction(transactionId: string, actorId: string): Promise<Transaction> {
        try {
            const { data, error } = await supabase.rpc('decline_transaction', {
                p_transaction_id: transactionId,
                p_actor_id: actorId,
            });
            if (error) throw error;
            return data as Transaction;
        } catch (error) {
            captureTransactionsServiceError(error, 'decline_transaction_failed', 'decline_transaction', {
                transaction_id: transactionId,
            });
            throw error;
        }
    },

    /**
     * Cancel a transaction (borrower or lender).
     * Releases the credit hold back to borrower's available balance.
     */
    async cancelTransaction(transactionId: string, actorId: string): Promise<Transaction> {
        try {
            const { data, error } = await supabase.rpc('cancel_transaction', {
                p_transaction_id: transactionId,
                p_actor_id: actorId,
            });
            if (error) throw error;
            return data as Transaction;
        } catch (error) {
            captureTransactionsServiceError(error, 'cancel_transaction_failed', 'cancel_transaction', {
                transaction_id: transactionId,
            });
            throw error;
        }
    },

    /**
     * Complete a transaction after delivery confirmation.
     * Releases held credit (consumed), awards lender 1 credit.
     */
    async completeTransaction(transactionId: string, actorId: string): Promise<Transaction> {
        try {
            const { data, error } = await supabase.rpc('complete_transaction', {
                p_transaction_id: transactionId,
                p_actor_id: actorId,
            });
            if (error) throw error;
            return data as Transaction;
        } catch (error) {
            captureTransactionsServiceError(error, 'complete_transaction_failed', 'complete_transaction', {
                transaction_id: transactionId,
            });
            throw error;
        }
    },

    /**
     * Transition to a specific status (payment_pending → ready_to_ship → shipped → delivered).
     */
    async transitionStatus(
        transactionId: string,
        newStatus: TransactionStatus,
        actorId: string
    ): Promise<Transaction> {
        try {
            const { data, error } = await supabase.rpc('transition_transaction_status', {
                p_transaction_id: transactionId,
                p_new_status: newStatus,
                p_actor_id: actorId,
            });
            if (error) throw error;
            return data as Transaction;
        } catch (error) {
            captureTransactionsServiceError(error, 'transition_transaction_status_failed', 'transition_transaction_status', {
                transaction_id: transactionId,
                new_status: newStatus,
            });
            throw error;
        }
    },

    /**
     * File a dispute for a delivered transaction and record the reason in transaction_events metadata.
     */
    async fileDispute(params: FileDisputeParams): Promise<Transaction> {
        const reason = params.reason.trim();
        try {
            const { data, error } = await supabase.rpc('file_transaction_dispute', {
                p_transaction_id: params.transactionId,
                p_actor_id: params.actorId,
                p_reason: reason,
            });
            if (error) throw error;
            return data as Transaction;
        } catch (error) {
            captureTransactionsServiceError(error, 'file_transaction_dispute_failed', 'file_transaction_dispute', {
                transaction_id: params.transactionId,
                has_reason: Boolean(reason),
            });
            throw error;
        }
    },

    /** Get all transactions where user is lender or borrower. */
    async getMyTransactions(userId: string): Promise<Transaction[]> {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`lender_id.eq.${userId},borrower_id.eq.${userId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data ?? []) as Transaction[];
    },

    /**
     * Get all transactions for a user with listing+book data.
     * LEAN: 1-level join — listing + book only, no profiles.
     * Use this for the My Exchanges list screen.
     */
    async getMyTransactionsWithListings(userId: string): Promise<TransactionWithListing[]> {
        const { data, error } = await supabase
            .from('transactions')
            .select(`
                *,
                listing:listings(
                    id, photos, condition, delivery_options,
                    book:books(id, title, authors, cover_url)
                )
            `)
            .or(`lender_id.eq.${userId},borrower_id.eq.${userId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data ?? []) as TransactionWithListing[];
    },

    /**
     * Get a single transaction with listing+book details AND both user profiles.
     * RICH: Fetches transaction+listing+book in one query, then profiles in a batch.
     */
    async getTransactionDetails(transactionId: string): Promise<TransactionWithDetails> {
        const { data, error } = await supabase
            .from('transactions')
            .select(`
                *,
                listing:listings(
                    id, photos, condition, delivery_options,
                    book:books(id, title, authors, cover_url)
                )
            `)
            .eq('id', transactionId)
            .single();

        if (error) throw error;

        // Fetch both profiles in one query (batch)
        const profiles = await profileService.getProfileSummaries(
            [data.lender_id, data.borrower_id]
        );
        const lender = profiles.find(p => p.user_id === data.lender_id) ?? null;
        const borrower = profiles.find(p => p.user_id === data.borrower_id) ?? null;

        return { ...data, lender, borrower } as TransactionWithDetails;
    },

    /**
     * Get incoming exchange requests for a lender (status = requested).
     * LEAN: Returns listing+book only — no borrower profile.
     * Use profileService.getProfileSummary() when lender taps into a request.
     */
    async getIncomingRequests(lenderId: string): Promise<TransactionWithListing[]> {
        const { data, error } = await supabase
            .from('transactions')
            .select(`
                *,
                listing:listings(
                    id, photos, condition, delivery_options,
                    book:books(id, title, authors, cover_url)
                )
            `)
            .eq('lender_id', lenderId)
            .eq('status', 'requested')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data ?? []) as TransactionWithListing[];
    },
};
