import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditBalance {
    user_id: string;
    available: number;
    held: number;
    lifetime_earned: number;
    lifetime_spent: number;
    updated_at: string | null;
}

export type CreditEventType =
    | 'signup_bonus'
    | 'lend_completed'
    | 'borrow_spent'
    | 'referral_bonus'
    | 'admin_adjustment'
    | 'hold_placed'
    | 'hold_released';

export type HoldReleaseReason =
    | 'transaction_completed'
    | 'transaction_declined'
    | 'transaction_cancelled'
    | 'transaction_expired'
    | 'dispute_resolved';

export interface CreditEvent {
    id: string;
    user_id: string;
    event_type: CreditEventType;
    amount: number;
    transaction_id: string | null;
    hold_release_reason: HoldReleaseReason | null;
    metadata: Record<string, unknown>;
    created_at: string;
    idempotency_key: string | null;
}

export interface CreditHistoryResult {
    events: CreditEvent[];
    hasMore: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const creditService = {
    /**
     * Fetch the current credit balance for a user.
     * Returns null if the user has no balance row yet (e.g., bonus not yet granted).
     */
    async getCreditBalance(userId: string): Promise<CreditBalance | null> {
        const { data, error } = await supabase
            .from('user_credit_balances')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data as CreditBalance | null;
    },

    /**
     * Fetch paginated credit event history for a user.
     * Most recent events first.
     */
    async getCreditHistory(
        userId: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<CreditHistoryResult> {
        const { data, error } = await supabase
            .from('credit_events')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit);

        if (error) throw error;

        const rows = (data ?? []) as CreditEvent[];
        return {
            events: rows.slice(0, limit),
            hasMore: rows.length > limit,
        };
    },

    /**
     * Subscribe to real-time credit balance changes for a user.
     * Returns the Supabase RealtimeChannel — caller must call .unsubscribe() on cleanup.
     *
     * Usage:
     *   const channel = creditService.subscribeToCreditBalance(userId, (balance) => setBalance(balance));
     *   return () => channel.unsubscribe();
     */
    subscribeToCreditBalance(
        userId: string,
        onUpdate: (balance: CreditBalance) => void
    ) {
        const channel = supabase
            .channel(`credit_balance:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_credit_balances',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    if (payload.new) {
                        onUpdate(payload.new as CreditBalance);
                    }
                }
            )
            .subscribe();

        return channel;
    },

    /**
     * Subscribe to new credit events for a user (e.g., to show toast notifications).
     * Returns the Supabase RealtimeChannel — caller must call .unsubscribe() on cleanup.
     */
    subscribeToCreditEvents(
        userId: string,
        onEvent: (event: CreditEvent) => void
    ) {
        const channel = supabase
            .channel(`credit_events:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'credit_events',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    if (payload.new) {
                        onEvent(payload.new as CreditEvent);
                    }
                }
            )
            .subscribe();

        return channel;
    },
};

