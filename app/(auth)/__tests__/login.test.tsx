import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../login';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSignInWithOtp = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/features/auth/services/authService', () => ({
  authService: {
    signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
  },
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithOtp.mockResolvedValue({});
  });

  it('sends OTP and opens verify screen for the dev test phone number', async () => {
    const { getByTestId } = render(<LoginScreen />);

    fireEvent.changeText(getByTestId('login-phone-input'), '1234567890');
    fireEvent.press(getByTestId('login-continue-button'));

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith('1234567890');
    });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/verify-otp', params: { phone: '1234567890' } });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('sends OTP and preserves Store Owner intent from the bookstore entry', async () => {
    const { getByText, getByTestId } = render(<LoginScreen />);

    fireEvent.changeText(getByTestId('login-phone-input'), '1234567890');
    fireEvent.press(getByText('Apply as a bookstore'));

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith('1234567890');
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/verify-otp',
      params: { phone: '1234567890', intent: 'store_owner' },
    });
  });
});
