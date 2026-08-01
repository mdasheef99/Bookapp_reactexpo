import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Modal, TextInput } from 'react-native';
import { createRef } from 'react';
import { OwnerConfirmationDialog } from '../components/OwnerConfirmationDialog';

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        textPrimary: '#111', textSecondary: '#333', bgCard: '#fff',
        border: '#ccc', error: '#900', accent: '#06f', disabled: '#aaa', disabledLight: '#bbb',
    } }),
}));

describe('Phase 9 Unit 6F accessible confirmation', () => {
    it('labels the modal, never confirms accidentally, and restores focus on cancel', async () => {
        const confirm = jest.fn();
        const cancel = jest.fn();
        const restore = createRef<TextInput>();
        const focus = jest.fn();
        restore.current = { focus } as unknown as TextInput;
        const screen = render(<OwnerConfirmationDialog
            visible
            title="Close this scan session?"
            description="Close ends capture and review activity. It does not commit inventory."
            confirmLabel="Close session"
            onConfirm={confirm}
            onCancel={cancel}
            restoreFocusRef={restore}
        />);
        expect(screen.getByLabelText('Close this scan session?')).toBeTruthy();
        fireEvent.press(screen.getByTestId('confirmation-backdrop'));
        expect(confirm).not.toHaveBeenCalled();
        fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
        expect(cancel).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(focus).toHaveBeenCalled());
    });

    it('announces pending state and disables both actions', () => {
        const screen = render(<OwnerConfirmationDialog
            visible title="Confirm action" description="Consequence" confirmLabel="Confirm"
            pending onConfirm={jest.fn()} onCancel={jest.fn()}
        />);
        expect(screen.getByText('Confirming…')).toBeTruthy();
        expect(screen.getByLabelText('Confirm').props.accessibilityState.disabled).toBe(true);
        expect(screen.getByLabelText('Cancel').props.accessibilityState.disabled).toBe(true);
    });
});
