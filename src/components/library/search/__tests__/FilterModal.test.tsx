import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FilterModal } from '../FilterModal';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        bgCard: '#fff', bgSecondary: '#eee', border: '#ccc', accent: '#123',
        textPrimary: '#111', textSecondary: '#444',
    } }),
}));

describe('Library search filter accessibility and state', () => {
    it('exposes checked filter radios and applies the current selection', () => {
        const onApply = jest.fn();
        const onClose = jest.fn();
        const screen = render(
            <FilterModal visible onClose={onClose} filters={{ genre: 'fiction' }} onApply={onApply} />,
        );

        const selectedGenre = screen.getByLabelText('Fiction');
        expect(selectedGenre.props.accessibilityRole).toBe('radio');
        expect(selectedGenre.props.accessibilityState).toEqual({ checked: true, disabled: false });
        expect(screen.getByLabelText('Mystery').props.accessibilityState).toEqual({ checked: false, disabled: false });

        fireEvent.press(screen.getByLabelText('Mystery'));
        fireEvent.press(screen.getByLabelText('Apply filters'));
        expect(onApply).toHaveBeenCalledWith({ genre: 'mystery' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('resynchronizes selected values whenever the modal reopens', async () => {
        const props = { visible: true, onClose: jest.fn(), filters: { genre: 'fiction' }, onApply: jest.fn() };
        const screen = render(<FilterModal {...props} />);
        expect(screen.getByLabelText('Fiction').props.accessibilityState.checked).toBe(true);

        screen.rerender(<FilterModal {...props} visible={false} filters={{ genre: 'mystery' }} />);
        screen.rerender(<FilterModal {...props} visible filters={{ genre: 'mystery' }} />);
        await waitFor(() => expect(screen.getByLabelText('Mystery').props.accessibilityState.checked).toBe(true));
    });
});
