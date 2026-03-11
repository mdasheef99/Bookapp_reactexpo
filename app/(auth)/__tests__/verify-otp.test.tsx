jest.mock('expo-router', () => ({
    router: { replace: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => ({ phone: '9876543210' }),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import VerifyOtpScreen from '../verify-otp';
import { router } from 'expo-router';
import { authService } from '@/features/auth/services/authService';
import { profileService } from '@/features/auth/services/profileService';

jest.mock('@/features/auth/services/authService', () => ({ authService: { verifyOtp: jest.fn() } }));
jest.mock('@/features/auth/services/profileService', () => ({ profileService: { getProfile: jest.fn() } }));

beforeEach(() => {
    jest.clearAllMocks();
    (authService.verifyOtp as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, session: { user: { id: 'user-1' } } });
});

describe('VerifyOtpScreen', () => {
    it('routes returning users into the app when a user_profiles row already exists', async () => {
        (profileService.getProfile as jest.Mock).mockResolvedValueOnce({ id: 'profile-1', user_id: 'user-1', display_name: 'Reader One' });

        const { getByTestId } = render(<VerifyOtpScreen />);

        fireEvent.changeText(getByTestId('verify-otp-input'), '123456');
        fireEvent.press(getByTestId('verify-otp-button'));

        await waitFor(() => expect(authService.verifyOtp).toHaveBeenCalledWith('9876543210', '123456'));
        await waitFor(() => expect(profileService.getProfile).toHaveBeenCalledWith('user-1'));
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/library'));
    });

    it('routes new users to setup-profile only when no user_profiles row exists', async () => {
        (profileService.getProfile as jest.Mock).mockResolvedValueOnce(null);

        const { getByTestId } = render(<VerifyOtpScreen />);

        fireEvent.changeText(getByTestId('verify-otp-input'), '123456');
        fireEvent.press(getByTestId('verify-otp-button'));

        await waitFor(() => expect(profileService.getProfile).toHaveBeenCalledWith('user-1'));
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/setup-profile'));
    });
});