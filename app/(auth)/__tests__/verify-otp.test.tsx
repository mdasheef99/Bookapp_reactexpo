let mockSearchParams: Record<string, string> = { phone: '9876543210' };

jest.mock('expo-router', () => ({
    router: { replace: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => mockSearchParams,
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import VerifyOtpScreen from '../verify-otp';
import { router } from 'expo-router';
import { authService } from '@/features/auth/services/authService';
import { profileService } from '@/features/auth/services/profileService';

jest.mock('@/features/auth/services/authService', () => ({ authService: { verifyOtp: jest.fn() } }));
jest.mock('@/features/auth/services/profileService', () => ({ profileService: { hasProfile: jest.fn() } }));

beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = { phone: '9876543210' };
    (authService.verifyOtp as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, session: { user: { id: 'user-1' } } });
});

describe('VerifyOtpScreen', () => {
    it('routes returning users into the app when a user_profiles row already exists', async () => {
        (profileService.hasProfile as jest.Mock).mockResolvedValueOnce(true);

        const { getByTestId } = render(<VerifyOtpScreen />);

        fireEvent.changeText(getByTestId('verify-otp-input'), '123456');
        fireEvent.press(getByTestId('verify-otp-button'));

        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/library'));
        expect(authService.verifyOtp).toHaveBeenCalledWith('9876543210', '123456');
        expect(profileService.hasProfile).toHaveBeenCalledWith('user-1');
    });

    it('routes new users to setup-profile only when no user_profiles row exists', async () => {
        (profileService.hasProfile as jest.Mock).mockResolvedValueOnce(false);

        const { getByTestId } = render(<VerifyOtpScreen />);

        fireEvent.changeText(getByTestId('verify-otp-input'), '123456');
        fireEvent.press(getByTestId('verify-otp-button'));

        await waitFor(() => expect(profileService.hasProfile).toHaveBeenCalledWith('user-1'));
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/setup-profile'));
    });

    it('routes returning Store Owner intent users into the Store Owner gate', async () => {
        mockSearchParams = { phone: '9876543210', intent: 'store_owner' };
        (profileService.hasProfile as jest.Mock).mockResolvedValueOnce(true);

        const { getByTestId } = render(<VerifyOtpScreen />);

        fireEvent.changeText(getByTestId('verify-otp-input'), '123456');
        fireEvent.press(getByTestId('verify-otp-button'));

        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(store-owner)'));
    });

    it('preserves Store Owner intent while routing new users to setup-profile', async () => {
        mockSearchParams = { phone: '9876543210', intent: 'store_owner' };
        (profileService.hasProfile as jest.Mock).mockResolvedValueOnce(false);

        const { getByTestId } = render(<VerifyOtpScreen />);

        fireEvent.changeText(getByTestId('verify-otp-input'), '123456');
        fireEvent.press(getByTestId('verify-otp-button'));

        await waitFor(() => expect(router.replace).toHaveBeenCalledWith({
            pathname: '/(auth)/setup-profile',
            params: { intent: 'store_owner' },
        }));
    });
});
