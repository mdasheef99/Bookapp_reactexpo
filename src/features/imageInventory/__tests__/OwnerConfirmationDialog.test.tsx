import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Modal, ScrollView } from 'react-native';
import { OwnerConfirmationDialog } from '../components/OwnerConfirmationDialog';

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        textPrimary: '#111', textSecondary: '#333', bgCard: '#fff',
        border: '#ccc', error: '#900', accent: '#06f', disabled: '#aaa', disabledLight: '#bbb',
    } }),
}));

describe('Phase 9 Unit 6F accessible confirmation', () => {
    it('uses alert-dialog semantics, Cancel-first action order, and bounded reflow', async () => {
        const confirm = jest.fn();
        const cancel = jest.fn();
        const screen = render(<OwnerConfirmationDialog
            visible
            title="Close this scan session?"
            description="Close ends capture and review activity. It does not commit inventory."
            confirmLabel="Close session"
            onConfirm={confirm}
            onCancel={cancel}
        />);
        expect(screen.getByLabelText('Close this scan session?')).toBeTruthy();
        expect(screen.getByTestId('confirmation-dialog').props.role).toBe('alertdialog');
        expect(screen.getByTestId('confirmation-dialog').props['aria-labelledby']).toBe('owner-confirmation-title');
        expect(screen.getByTestId('confirmation-dialog').props['aria-describedby']).toBe('owner-confirmation-description');
        const actions = screen.getByTestId('confirmation-actions').children;
        expect(actions[0].props.accessibilityLabel).toBe('Cancel');
        expect(actions[1].props.accessibilityLabel).toBe('Close session');
        expect(screen.UNSAFE_getByType(ScrollView).props.style).toEqual(expect.arrayContaining([
            expect.objectContaining({ flexShrink: 1 }),
        ]));
        fireEvent.press(screen.getByTestId('confirmation-backdrop'));
        expect(confirm).not.toHaveBeenCalled();
        expect(cancel).toHaveBeenCalledTimes(1);
        fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
        expect(cancel).toHaveBeenCalledTimes(2);
    });

    it('announces pending state and disables both actions', () => {
        const screen = render(<OwnerConfirmationDialog
            visible title="Confirm action" description="Consequence" confirmLabel="Confirm"
            pending onConfirm={jest.fn()} onCancel={jest.fn()}
        />);
        expect(screen.getByText(/Confirming/u)).toBeTruthy();
        expect(screen.getByLabelText('Confirm').props.accessibilityState.disabled).toBe(true);
        expect(screen.getByLabelText('Cancel').props.accessibilityState.disabled).toBe(true);
    });

    it('preserves long Unicode/RTL consequence text in a narrow, height-bounded layout', () => {
        const description = '×”×¡×¨×” ××¨×•×›×” · ಕನ್ನಡ ಪಠ್ಯ · consequence '.repeat(12);
        const screen = render(<OwnerConfirmationDialog
            visible title="×¡×’×•×¨ ××ª ×”×”×¤×¢×œ×”?" description={description} confirmLabel="××™×©×•×¨"
            onConfirm={jest.fn()} onCancel={jest.fn()}
        />);
        expect(screen.getByText(description)).toBeTruthy();
        expect(screen.getByTestId('confirmation-dialog').props.style).toEqual(expect.objectContaining({
            width: '100%', maxWidth: 560, maxHeight: '90%',
        }));
        expect(screen.getByText(description).props.style).toEqual(expect.objectContaining({
            flexShrink: 1, writingDirection: 'auto',
        }));
    });
});
