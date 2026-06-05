import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TransactionCard } from '../TransactionCard';
import type { TransactionWithListing } from '@/features/exchange/services/transactionsService';
import type { ThemeColors } from '@/hooks/useTheme';

const mockPush = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));

const colors: ThemeColors = {
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F1F5F9',
    bgCard: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    accent: '#4F46E5',
    accentLight: '#818CF8',
    error: '#EF4444',
    errorLight: '#FCA5A5',
    border: '#E2E8F0',
    disabled: '#CBD5E1',
    disabledLight: '#E2E8F0',
    shadow: 'rgba(15,23,42,0.12)',
};

const transaction: TransactionWithListing = {
    id: 'txn-1',
    listing_id: 'listing-1',
    lender_id: 'lender-1',
    borrower_id: 'reader-1',
    status: 'payment_pending',
    delivery_type: 'meetup',
    shipping_address_id: null,
    message: null,
    payment_order_id: null,
    payment_id: null,
    shipping_cost: null,
    deposit_amount: null,
    awb_number: null,
    is_signed_copy: false,
    tracking_url: null,
    delivery_service: null,
    created_at: '2026-05-10T10:00:00.000Z',
    updated_at: '2026-05-10T10:00:00.000Z',
    listing: {
        id: 'listing-1',
        photos: ['https://example.com/cover.jpg'],
        condition: 'good',
        delivery_options: ['meetup'],
        book: {
            id: 'book-1',
            title: 'The Left Hand of Darkness',
            authors: ['Ursula K. Le Guin'],
            cover_url: null,
        },
    },
};

describe('TransactionCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders transaction summary and opens the transaction detail route', () => {
        const { getByText } = render(
            <TransactionCard txn={transaction} userId="reader-1" colors={colors} />
        );

        expect(getByText('The Left Hand of Darkness')).toBeOnTheScreen();
        expect(getByText('Ursula K. Le Guin')).toBeOnTheScreen();
        expect(getByText('Payment Pending')).toBeOnTheScreen();
        expect(getByText('Borrowing')).toBeOnTheScreen();
        expect(getByText('10 May')).toBeOnTheScreen();

        fireEvent.press(getByText('The Left Hand of Darkness'));

        expect(mockPush).toHaveBeenCalledWith('/(tabs)/exchange/transaction/txn-1');
    });

    it('renders lender role and unknown book fallback when listing data is missing', () => {
        const missingListing = { ...transaction, id: 'txn-2', lender_id: 'reader-1', listing: null };

        const { getByText } = render(
            <TransactionCard txn={missingListing} userId="reader-1" colors={colors} />
        );

        expect(getByText('Unknown Book')).toBeOnTheScreen();
        expect(getByText('Lending')).toBeOnTheScreen();
    });
});
