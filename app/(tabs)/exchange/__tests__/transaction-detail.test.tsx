import { render } from '@testing-library/react-native';
import TransactionDetailScreen from '../transaction/[transactionId]';

const mockUseTransactionDetails = jest.fn();
const mockUseApproveTransaction = jest.fn();
const mockUseDeclineTransaction = jest.fn();
const mockUseCancelTransaction = jest.fn();
const mockUseCompleteTransaction = jest.fn();
const mockUseTransitionStatus = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { back: jest.fn() },
    useLocalSearchParams: () => ({ transactionId: 'txn-1' }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8',
    } }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ session: { user: { id: 'borrower-1' } } }),
}));
jest.mock('@/features/exchange/hooks/useTransactions', () => ({
    useTransactionDetails: (...args: unknown[]) => mockUseTransactionDetails(...args),
    useApproveTransaction: (...args: unknown[]) => mockUseApproveTransaction(...args),
    useDeclineTransaction: (...args: unknown[]) => mockUseDeclineTransaction(...args),
    useCancelTransaction: (...args: unknown[]) => mockUseCancelTransaction(...args),
    useCompleteTransaction: (...args: unknown[]) => mockUseCompleteTransaction(...args),
    useTransitionStatus: (...args: unknown[]) => mockUseTransitionStatus(...args),
}));

const idleMutation = { mutate: jest.fn(), isPending: false };

beforeEach(() => {
    jest.clearAllMocks();
    mockUseApproveTransaction.mockReturnValue(idleMutation);
    mockUseDeclineTransaction.mockReturnValue(idleMutation);
    mockUseCancelTransaction.mockReturnValue(idleMutation);
    mockUseCompleteTransaction.mockReturnValue(idleMutation);
    mockUseTransitionStatus.mockReturnValue(idleMutation);
});

describe('TransactionDetailScreen', () => {
    it('keeps the meetup confirmation action for approved meetup exchanges', () => {
        mockUseTransactionDetails.mockReturnValue({
            data: {
                id: 'txn-1', lender_id: 'lender-1', borrower_id: 'borrower-1', status: 'approved', delivery_type: 'meetup', message: null, awb_number: null, delivery_service: null,
                listing: { photos: [], book: { title: 'Atomic Habits', authors: ['James Clear'] } }, lender: { display_name: 'Lender', city: 'Delhi' }, borrower: { display_name: 'Borrower', city: 'Delhi' },
            },
            isLoading: false, isError: false, refetch: jest.fn(),
        });

        const { getByText, queryByText } = render(<TransactionDetailScreen />);

        expect(getByText('📬 Confirm Meetup')).toBeOnTheScreen();
        expect(queryByText(/payment or delivery steps/i)).toBeNull();
    });

    it('replaces approved non-meetup progression with explanatory copy', () => {
        mockUseTransactionDetails.mockReturnValue({
            data: {
                id: 'txn-1', lender_id: 'lender-1', borrower_id: 'borrower-1', status: 'approved', delivery_type: 'porter', message: null, awb_number: null, delivery_service: null,
                listing: { photos: [], book: { title: 'Atomic Habits', authors: ['James Clear'] } }, lender: { display_name: 'Lender', city: 'Delhi' }, borrower: { display_name: 'Borrower', city: 'Delhi' },
            },
            isLoading: false, isError: false, refetch: jest.fn(),
        });

        const { getByText, queryByText } = render(<TransactionDetailScreen />);

        expect(getByText(/meetup-only exchange/i)).toBeOnTheScreen();
        expect(getByText(/can't move into payment or delivery steps in-app yet/i)).toBeOnTheScreen();
        expect(queryByText('📬 Confirm Meetup')).toBeNull();
        expect(queryByText(/Proceed to Payment/i)).toBeNull();
    });
});