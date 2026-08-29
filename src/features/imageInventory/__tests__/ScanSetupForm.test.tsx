import { fireEvent, render } from '@testing-library/react-native';
import { ScanSetupForm } from '../components/ScanSetupForm';
import { initialScanSetupForm } from '../scanSetup/scanSetupForm';

const mockTheme = {
    colors: {
        bgCard: '#fff',
        bgSecondary: '#f5f5f5',
        textPrimary: '#111',
        textSecondary: '#444',
        textTertiary: '#777',
        accent: '#345',
        accentLight: '#678',
        border: '#ccc',
        shadow: '#000',
        error: '#900',
    },
};

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => mockTheme }));

describe('ScanSetupForm', () => {
    it('groups the SDD defaults and keeps required fields bounded', () => {
        const onChange = jest.fn();
        const screen = render(<ScanSetupForm form={initialScanSetupForm} onChange={onChange} />);

        expect(screen.getByText('Batch')).toBeTruthy();
        expect(screen.getByText('Location')).toBeTruthy();
        expect(screen.getByText('Book defaults')).toBeTruthy();
        expect(screen.getByText('Publication')).toBeTruthy();
        expect(screen.getByTestId('setup-location').props.maxLength).toBe(120);
        expect(screen.getByTestId('setup-batch-label').props.maxLength).toBe(80);
        expect(screen.queryByTestId('setup-quantity')).toBeNull();
        expect(screen.queryByText('Donation')).toBeNull();
        expect(screen.queryByText('Store room')).toBeNull();
    });

    it('keeps the complete price contract available behind a compact selector', () => {
        const onChange = jest.fn();
        const screen = render(<ScanSetupForm form={initialScanSetupForm} onChange={onChange} />);

        expect(screen.getByTestId('setup-price-selector')).toBeTruthy();
        expect(screen.getByTestId('setup-price-2500')).toBeTruthy();
        fireEvent.press(screen.getByTestId('setup-price-selector'));
        expect(screen.getByTestId('setup-price-2500')).toBeTruthy();
        expect(screen.getByTestId('setup-price-custom')).toBeTruthy();
        fireEvent.changeText(screen.getByTestId('setup-price-custom'), '175');
        expect(onChange).toHaveBeenLastCalledWith({
            ...initialScanSetupForm,
            priceMinor: 17500,
        });
    });

    it('marks the selected language, condition, and publication intent accessibly', () => {
        const onChange = jest.fn();
        const screen = render(<ScanSetupForm form={{
            ...initialScanSetupForm,
            languageHint: 'hi',
            condition: 'very_good',
            publication: 'publish',
        }} onChange={onChange} />);

        fireEvent.press(screen.getByTestId('setup-language-selector'));
        fireEvent.press(screen.getByTestId('setup-condition-selector'));
        expect(screen.getByTestId('setup-language-hi').props.accessibilityState).toEqual({ selected: true });
        expect(screen.getByTestId('setup-condition-very_good').props.accessibilityState).toEqual({ selected: true });
        expect(screen.getByTestId('setup-publication-publish').props.accessibilityState).toEqual({ selected: true });
        expect(screen.getByText('Hint only — detected language wins when available.')).toBeTruthy();
    });

    it('supports both shelf-code selection and direct location entry', () => {
        const onChange = jest.fn();
        const screen = render(<ScanSetupForm form={initialScanSetupForm} onChange={onChange} />);

        fireEvent.press(screen.getByTestId('setup-location-letter-selector'));
        fireEvent.press(screen.getByTestId('setup-location-letter-C'));
        fireEvent.press(screen.getByTestId('setup-location-number-selector'));
        fireEvent.press(screen.getByTestId('setup-location-number-9'));
        expect(onChange).toHaveBeenLastCalledWith({ ...initialScanSetupForm, location: 'C9' });

        fireEvent.changeText(screen.getByTestId('setup-location'), 'Receiving table');
        expect(onChange).toHaveBeenLastCalledWith({ ...initialScanSetupForm, location: 'Receiving table' });
    });
});
