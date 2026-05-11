import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import CreditHistoryScreen, { shouldRefetchCurrentHistoryPageOnRefresh } from '../credit-history';
import { creditService } from '@/features/credits/services/creditService';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ session: { user: { id: 'reader-1' } } }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        phase: 'daylight',
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            accentLight: '#818CF8',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
        },
    }),
}));
jest.mock('@/features/credits/services/creditService', () => ({
    creditService: {
        getCreditBalance: jest.fn(),
        getCreditHistory: jest.fn(),
    },
}));

function renderWithQueryClient() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });

    return {
        queryClient,
        ...render(
            <QueryClientProvider client={queryClient}>
                <CreditHistoryScreen />
            </QueryClientProvider>
        ),
    };
}

describe('CreditHistoryScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (creditService.getCreditBalance as jest.Mock).mockResolvedValue({
            user_id: 'reader-1',
            available: 2,
            held: 1,
            lifetime_earned: 4,
            lifetime_spent: 2,
            updated_at: '2026-05-10T10:00:00.000Z',
        });
        (creditService.getCreditHistory as jest.Mock).mockResolvedValue({
            hasMore: false,
            events: [
                {
                    id: 'event-1',
                    user_id: 'reader-1',
                    event_type: 'signup_bonus',
                    amount: 1,
                    transaction_id: null,
                    hold_release_reason: null,
                    metadata: {},
                    created_at: '2026-05-10T10:00:00.000Z',
                    idempotency_key: null,
                },
                {
                    id: 'event-2',
                    user_id: 'reader-1',
                    event_type: 'hold_placed',
                    amount: -1,
                    transaction_id: 'txn-1',
                    hold_release_reason: null,
                    metadata: {},
                    created_at: '2026-05-09T10:00:00.000Z',
                    idempotency_key: null,
                },
                {
                    id: 'event-3',
                    user_id: 'reader-1',
                    event_type: 'lend_completed',
                    amount: 1,
                    transaction_id: 'txn-2',
                    hold_release_reason: null,
                    metadata: {},
                    created_at: '2026-05-08T10:00:00.000Z',
                    idempotency_key: null,
                },
            ],
        });
    });

    it('renders balance summary and readable credit events', async () => {
        const { getAllByText, getByText, queryClient, unmount } = renderWithQueryClient();

        await waitFor(() => expect(getByText('Signup bonus')).toBeOnTheScreen());

        expect(getByText('Credit History')).toBeOnTheScreen();
        expect(getAllByText('2').length).toBeGreaterThan(0);
        expect(getByText('available')).toBeOnTheScreen();
        expect(getByText('Credit hold placed')).toBeOnTheScreen();
        expect(getByText('Lending reward')).toBeOnTheScreen();
        expect(getAllByText('+1')).toHaveLength(2);
        expect(getByText('-1')).toBeOnTheScreen();

        unmount();
        queryClient.clear();
    });

    it('filters events by type and shows a running balance for each event', async () => {
        const { getAllByText, getByText, queryByText, queryClient, unmount } = renderWithQueryClient();

        await waitFor(() => expect(getByText('Signup bonus')).toBeOnTheScreen());

        expect(getAllByText('Balance after: 2').length).toBeGreaterThan(0);
        expect(getByText('Balance after: 1')).toBeOnTheScreen();

        fireEvent.press(getByText('Holds'));

        expect(getByText('Credit hold placed')).toBeOnTheScreen();
        expect(queryByText('Signup bonus')).toBeNull();
        expect(queryByText('Lending reward')).toBeNull();

        fireEvent.press(getByText('All'));

        expect(getByText('Signup bonus')).toBeOnTheScreen();
        expect(getByText('Lending reward')).toBeOnTheScreen();

        unmount();
        queryClient.clear();
    });

    it('only refetches the current history query when already on the first page', () => {
        expect(shouldRefetchCurrentHistoryPageOnRefresh(0)).toBe(true);
        expect(shouldRefetchCurrentHistoryPageOnRefresh(20)).toBe(false);
    });
});
