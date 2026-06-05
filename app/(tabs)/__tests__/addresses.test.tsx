import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import AddressesScreen from '../addresses';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockSetDefaultMutate = jest.fn();
const mockDeleteMutate = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-router', () => ({
    router: {
        back: (...args: unknown[]) => mockBack(...args),
        canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
        replace: (...args: unknown[]) => mockReplace(...args),
    },
}));
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
            error: '#EF4444',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
        },
    }),
}));
jest.mock('@/features/exchange/hooks/useAddresses', () => ({
    useAddresses: jest.fn(() => ({
        data: [
            {
                id: 'address-1',
                user_id: 'reader-1',
                name: 'Priya Sharma',
                phone: '9876543210',
                line1: 'Flat 4',
                line2: 'MG Road',
                city: 'Delhi',
                state: 'Delhi',
                pincode: '110001',
                is_default: true,
                created_at: '2026-05-10T10:00:00.000Z',
            },
            {
                id: 'address-2',
                user_id: 'reader-1',
                name: 'Office',
                phone: '9876543211',
                line1: 'Tower B',
                line2: null,
                city: 'Delhi',
                state: 'Delhi',
                pincode: '110002',
                is_default: false,
                created_at: '2026-05-09T10:00:00.000Z',
            },
        ],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        isRefetching: false,
    })),
    useCreateAddress: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
    useUpdateAddress: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
    useDeleteAddress: jest.fn(() => ({ mutate: mockDeleteMutate, isPending: false })),
    useSetDefaultAddress: jest.fn(() => ({ mutate: mockSetDefaultMutate, isPending: false })),
}));

describe('AddressesScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCanGoBack.mockReturnValue(false);
    });

    it('renders saved addresses and lets the user set a default address', () => {
        const { getByText } = render(<AddressesScreen />);

        expect(getByText('Addresses')).toBeOnTheScreen();
        expect(getByText('Priya Sharma')).toBeOnTheScreen();
        expect(getByText('Default')).toBeOnTheScreen();
        expect(getByText('Office')).toBeOnTheScreen();

        fireEvent.press(getByText('Set default'));

        expect(mockSetDefaultMutate).toHaveBeenCalledWith({
            userId: 'reader-1',
            addressId: 'address-2',
        });
    });

    it('asks the delete mutation to remove an address', () => {
        const { getAllByText } = render(<AddressesScreen />);

        fireEvent.press(getAllByText('Delete')[0]);

        expect(mockDeleteMutate).toHaveBeenCalledWith('address-1');
    });

    it('falls back to Profile when the header back button has no local history', () => {
        const { getByLabelText } = render(<AddressesScreen />);

        fireEvent.press(getByLabelText('Go back'));

        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/profile');
        expect(mockBack).not.toHaveBeenCalled();
    });
});
