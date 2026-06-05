import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TransactionRatingPrompt } from '../TransactionRatingPrompt';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const colors = {
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

describe('TransactionRatingPrompt', () => {
    it('submits a selected star rating and optional tags', () => {
        const onSubmit = jest.fn();
        const { getByLabelText, getByText } = render(
            <TransactionRatingPrompt
                colors={colors}
                otherPartyName="Priya"
                onSubmit={onSubmit}
                isSubmitting={false}
            />
        );

        fireEvent.press(getByLabelText('Rate 4 stars'));
        fireEvent.press(getByText('Good communication'));
        fireEvent.press(getByText('Submit rating'));

        expect(onSubmit).toHaveBeenCalledWith({
            rating: 4,
            tags: ['good_communication'],
            review: '',
        });
    });

    it('renders an already submitted rating instead of the form', () => {
        const { getByText, queryByText } = render(
            <TransactionRatingPrompt
                colors={colors}
                otherPartyName="Priya"
                onSubmit={jest.fn()}
                isSubmitting={false}
                existingRating={{
                    id: 'rating-1',
                    transaction_id: 'txn-1',
                    from_user_id: 'user-1',
                    to_user_id: 'user-2',
                    rating: 5,
                    tags: ['book_as_described'],
                    review: 'Lovely exchange',
                    created_at: '2026-05-10T10:00:00.000Z',
                }}
            />
        );

        expect(getByText('You rated this exchange')).toBeOnTheScreen();
        expect(getByText('Lovely exchange')).toBeOnTheScreen();
        expect(queryByText('Submit rating')).toBeNull();
    });
});
