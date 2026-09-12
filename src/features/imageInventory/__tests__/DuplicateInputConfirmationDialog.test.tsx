import { fireEvent, render } from '@testing-library/react-native';
import { Modal } from 'react-native';
import { DuplicateInputConfirmationDialog } from '../components/DuplicateInputConfirmationDialog';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    bgCard: '#fff', textPrimary: '#111', textSecondary: '#333',
} }) }));

describe('duplicate input confirmation dialog', () => {
    it('treats backdrop and system Back as dismiss only', () => {
        const onDismiss = jest.fn();
        const onCancelUpload = jest.fn();
        const onProceed = jest.fn();
        const screen = render(<DuplicateInputConfirmationDialog visible pending={false}
            onDismiss={onDismiss} onCancelUpload={onCancelUpload} onProceed={onProceed} />);
        fireEvent.press(screen.getByTestId('duplicate-confirmation-backdrop'));
        fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
        expect(onDismiss).toHaveBeenCalledTimes(2);
        expect(onCancelUpload).not.toHaveBeenCalled();
        expect(onProceed).not.toHaveBeenCalled();
    });

    it('keeps Cancel upload and Proceed as distinct explicit commands', () => {
        const onCancelUpload = jest.fn();
        const onProceed = jest.fn();
        const screen = render(<DuplicateInputConfirmationDialog visible pending={false}
            onDismiss={jest.fn()} onCancelUpload={onCancelUpload} onProceed={onProceed} />);
        fireEvent.press(screen.getByText('Cancel upload'));
        fireEvent.press(screen.getByText('Proceed'));
        expect(onCancelUpload).toHaveBeenCalledTimes(1);
        expect(onProceed).toHaveBeenCalledTimes(1);
    });
});
